import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET = 'listing-photos';

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

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(
            new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          send('open', { ok: true, listingId, tier });

          // 1) Get existing "before" photos to determine count
          const { data: beforeFiles, error: beforeError } = await supabase.storage
            .from(BUCKET)
            .list(`listings/${listingId}/before/`, { 
              sortBy: { column: 'name', order: 'asc' },
              limit: 100 
            });

          if (beforeError) {
            send('error', { message: `Failed to list before photos: ${beforeError.message}` });
            controller.close();
            return;
          }

          const beforePhotos = (beforeFiles || []).filter(f => f.name.endsWith('.jpg'));
          const total = beforePhotos.length;

          if (total === 0) {
            send('error', { message: 'No before photos found for this listing' });
            controller.close();
            return;
          }

          send('log', { step: 'found_before_photos', count: total });

          // 2) Generate "after" photos for each before photo
          for (let index = 0; index < total; index++) {
            send('log', { step: 'generating', index, total });

            try {
              // Mock generation - in production this would call your AI model
              // For now, we'll use a placeholder service or generate based on tier
              const afterImageUrl = await generateAfterPhoto(tier, index);
              
              if (!afterImageUrl) {
                send('error', { index, message: 'Failed to generate after photo' });
                continue;
              }

              // 3) Upload to Supabase Storage
              const path = `listings/${listingId}/after/${tier}/${index}.jpg`;
              
              // Download the generated image
              const imageResponse = await fetch(afterImageUrl);
              const imageBuffer = await imageResponse.arrayBuffer();
              
              const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(path, imageBuffer, { 
                  upsert: true, 
                  contentType: 'image/jpeg' 
                });

              if (uploadError) {
                send('error', { index, message: `Upload failed: ${uploadError.message}` });
                continue;
              }

              // 4) Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from(BUCKET)
                .getPublicUrl(path);

              // 5) Insert into database
              const { error: dbError } = await supabase
                .from('after_photos')
                .insert({
                  listing_id: parseInt(listingId),
                  tier,
                  index,
                  url: publicUrl
                });

              if (dbError) {
                send('error', { index, message: `Database insert failed: ${dbError.message}` });
                continue;
              }

              // 6) Broadcast to realtime channel
              await supabase.channel(`property-updates-${listingId}`).send({
                type: 'broadcast',
                event: 'after_photo_added',
                payload: { 
                  listingId: parseInt(listingId), 
                  tier, 
                  index, 
                  url: publicUrl 
                }
              });

              send('progress', { index: index + 1, total, url: publicUrl });

            } catch (error) {
              send('error', { index, message: `Generation failed: ${error}` });
            }
          }

          // 7) Send completion broadcast
          await supabase.channel(`property-updates-${listingId}`).send({
            type: 'broadcast',
            event: 'after_generation_complete',
            payload: { 
              listingId: parseInt(listingId), 
              tier, 
              total 
            }
          });

          send('done', { success: true, total });

        } catch (error) {
          send('error', { message: `Stream error: ${error}` });
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}

// Mock function to generate after photos
// In production, this would call your AI model with the before photo and tier
async function generateAfterPhoto(tier: string, index: number): Promise<string | null> {
  try {
    // For now, return placeholder images based on tier
    // In production, you'd:
    // 1. Fetch the corresponding before photo
    // 2. Call your AI model (e.g., Stable Diffusion, DALL-E, etc.)
    // 3. Return the generated image URL
    
    const tierColors = {
      livable: 'blue',
      comfortable: 'green', 
      competitive: 'purple'
    };

    // Using picsum with different seeds for variety
    const seed = `${tier}-${index}-${Date.now()}`;
    const width = 1280;
    const height = 720;
    
    return `https://picsum.photos/seed/${seed}/${width}/${height}`;
    
  } catch (error) {
    console.error('Failed to generate after photo:', error);
    return null;
  }
}
