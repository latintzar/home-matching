import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import {lazySupabaseClient} from '@/lib/lazy-supabase';
import {lazyResource} from '@/lib/lazy-resource.mjs';

const supabase = lazySupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET = 'property-images';

const vertexAI = lazyResource(()=>new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
}));

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    const body = await request.json();
    const { tier = 'livable' } = body;

    if (!['livable', 'comfortable', 'competitive'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Get valid "before" photos (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    let beforePhotos: Array<{ url: string; filename?: string; display_order?: number }> = [];
    try {
      const validPhotos = await fetchValidListingPhotos(listingId);
      // Extract filename from URL if possible
      beforePhotos = validPhotos.map((p, idx) => ({
        url: p.url,
        filename: p.url.split('/').pop() || undefined,
        display_order: idx
      }));
    } catch (error) {
      return NextResponse.json({ 
        error: `Failed to fetch valid before photos: ${(error as Error).message}` 
      }, { status: 500 });
    }

    const total = beforePhotos.length;

    if (total === 0) {
      return NextResponse.json({ error: 'No before photos found for this listing' }, { status: 404 });
    }

    // Generate "after" photos using Gemini 2.5 Flash Image
    const results = [];
    
    for (let index = 0; index < total; index++) {
      try {
        const beforePhoto = beforePhotos[index];
        
        // Fetch the image and convert to base64
        const imageResponse = await fetch(beforePhoto.url);
        if (!imageResponse.ok) {
          console.error(`Failed to fetch image ${index}: ${imageResponse.status}`);
          continue;
        }
        
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageArrayBuffer).toString('base64');

        // Create tier-specific renovation prompt
        const renovationPrompt = getRenovationPrompt(tier);
        
        console.log(`Generating after photo ${index} for tier ${tier}...`);
        console.log(`Base64 image length: ${base64Image.length}`);
        
        // Generate "after" photo using VertexAI Gemini 2.5 Flash Image
        const model = vertexAI.getGenerativeModel({
          model: 'gemini-2.5-flash-image',
          generationConfig: {
            temperature: 1,
            topP: 0.95,
            maxOutputTokens: 32768,
            responseModalities: ["TEXT", "IMAGE"]
          } as any,
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" }
          ] as any,
        });

        const contents = [{
          role: 'user',
          parts: [
            { text: `${renovationPrompt}

IMPORTANT: Maintain the exact same camera angle, perspective, and composition as the original photo. Only transform the interior elements according to the renovation level. Keep the same room layout, window positions, and architectural features.` },
            { 
              inlineData: { 
                mimeType: 'image/jpeg', 
                data: base64Image 
              } 
            }
          ]
        }];

        const result = await model.generateContent({ contents });
        console.log(`Gemini response for ${index}:`, JSON.stringify(result.response, null, 2));
        
        // Extract the generated image from the response
        const generatedImage = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        
        if (!generatedImage || !generatedImage.data) {
          console.error(`Failed to generate image for ${index}:`, generatedImage);
          continue;
        }

        // Convert generated image to buffer
        const imageBuffer = Buffer.from(generatedImage.data, 'base64');
        
        // Upload to Supabase Storage
        const afterPath = `${listingId}/after/${tier}/${index}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(afterPath, imageBuffer, { 
            upsert: true, 
            contentType: 'image/jpeg' 
          });

        if (uploadError) {
          console.error(`Upload failed for ${index}:`, uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(afterPath);

        // Insert into database (upsert to handle duplicates)
        const { error: dbError } = await supabase
          .from('after_photos')
          .upsert({
            listing_id: parseInt(listingId),
            tier,
            index,
            url: publicUrl
          }, {
            onConflict: 'listing_id,tier,index'
          });

        if (dbError) {
          console.error(`Database insert failed for ${index}:`, dbError);
          continue;
        }

        results.push({ index, url: publicUrl });
        console.log(`✅ Generated after photo ${index} for tier ${tier}`);

      } catch (error) {
        console.error(`Failed to process photo ${index}:`, error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      generated: results.length,
      total,
      tier,
      listingId: parseInt(listingId)
    });

  } catch (error) {
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}

function getRenovationPrompt(tier: string): string {
  const prompts = {
    livable: `Transform this Spanish apartment interior to a "Livable" renovation level with INDUSTRIAL STYLE:

- Exposed brick walls or concrete finishes with industrial paint (grays, blacks, whites)
- Industrial light fixtures (pendant lights, track lighting, Edison bulbs)
- Concrete floors or polished concrete with industrial sealant
- Metal hardware and fixtures (black steel, brushed nickel)
- Exposed ductwork and pipes painted in industrial colors
- Industrial-style furniture (metal frames, reclaimed wood)
- Minimalist industrial decor and accessories
- Clean lines and functional design
- Good task lighting throughout
- Raw, unfinished aesthetic with clean surfaces

Style: Industrial, functional, move-in ready. Focus on raw materials, exposed elements, and clean industrial design.`,

    comfortable: `Transform this Spanish apartment interior to a "Comfortable" renovation level with INDUSTRIAL STYLE:

- High-quality industrial finishes (polished concrete, exposed brick, metal accents)
- Modern industrial kitchen with stainless steel appliances and concrete countertops
- Industrial bathrooms with concrete tiles and metal fixtures
- Polished concrete flooring or industrial-grade hardwood
- Exposed structural elements (beams, columns, ductwork)
- Industrial lighting design with multiple light sources
- Metal window frames and industrial-style treatments
- Comfortable industrial furniture with metal and reclaimed wood
- Custom industrial storage solutions
- Smart home technology integrated into industrial aesthetic

Style: Modern industrial, comfortable, well-designed. Focus on quality industrial materials and thoughtful industrial design choices.`,

    competitive: `Transform this Spanish apartment interior to a "Competitive" renovation level with INDUSTRIAL STYLE:

- Premium industrial finishes and high-end materials throughout
- Custom industrial kitchen with premium stainless steel appliances and concrete/metal cabinetry
- Luxury industrial bathrooms with premium concrete, metal, and glass finishes
- High-end industrial flooring (polished concrete, reclaimed hardwood, metal accents)
- Smart home technology integrated into industrial aesthetic
- Custom industrial lighting design with premium fixtures
- Designer industrial furniture and decor
- Custom industrial storage solutions and built-ins
- Premium metal window treatments and hardware
- Architectural industrial details and custom metalwork
- High-end industrial appliances and smart home features

Style: Luxury industrial, high-end, magazine-worthy. Focus on premium industrial materials, custom design, and luxury industrial finishes.`
  };

  return prompts[tier as keyof typeof prompts] || prompts.livable;
}
