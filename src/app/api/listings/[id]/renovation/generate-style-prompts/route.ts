import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGenAI } from '@/lib/genaiClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    console.log(`🎨 Generating style prompts for image generation - listing ${listingId}`);

    // Get renovation tiers with finalized pricing
    const { data: tiers, error: tiersError } = await supabase
      .from('renovation_tiers')
      .select('*')
      .eq('listing_id', listingId)
      .order('tier_name');

    if (tiersError || !tiers || tiers.length === 0) {
      console.error('❌ Failed to fetch renovation tiers:', tiersError);
      return NextResponse.json(
        { error: 'No renovation tiers found for this listing' },
        { status: 404 }
      );
    }

    console.log(`📊 Found ${tiers.length} tiers, generating style prompts...`);

    // Generate style prompts using Gemini 2.5 Flash
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });

    const updatedTiers = [];

    for (const tier of tiers) {
      console.log(`🎨 Generating style prompt for ${tier.tier_name} tier...`);

      const prompt = `
You are a Spanish interior design expert. Based on the renovation tier and work items, generate a detailed style prompt for AI image generation.

TIER: ${tier.tier_name}
BUDGET RANGE: €${tier.total_cost_min}-€${tier.total_cost_max}
DESCRIPTION: ${tier.description || 'Renovation tier'}

WORK ITEMS:
${JSON.stringify(tier.work_items, null, 2)}

Generate a comprehensive style prompt that describes:
1. Overall aesthetic and design philosophy
2. Color palette and materials
3. Lighting and ambiance
4. Furniture and decor style
5. Spanish design influences
6. Quality level appropriate for the budget

The prompt should be detailed enough for AI image generation while maintaining the original camera angle and perspective.

Style guidelines by tier:
- LIVABLE: Functional, clean, basic finishes, neutral colors, practical furniture
- COMFORTABLE: Modern, stylish, quality materials, contemporary design, good lighting
- COMPETITIVE: Luxury, premium materials, designer touches, sophisticated palette, high-end finishes

Return ONLY a valid JSON object with this exact structure:
{
  "tier_name": "${tier.tier_name}",
  "style_prompts": {
    "overall_style": "Modern Spanish apartment with clean lines and warm neutral tones",
    "color_palette": "Warm whites, soft grays, natural wood accents, and Spanish terracotta touches",
    "materials": "Polished concrete floors, white subway tiles, natural wood cabinetry, brushed metal hardware",
    "lighting": "Natural light from large windows, pendant lights over kitchen island, recessed LED lighting",
    "furniture": "Contemporary Spanish furniture with clean lines, comfortable seating, functional storage",
    "decor": "Minimalist decor with Spanish ceramic accents, plants, and modern artwork",
    "quality_level": "High-quality finishes with attention to detail, premium materials throughout",
    "full_prompt": "Transform this Spanish apartment interior to a '${tier.tier_name}' renovation level with modern Spanish design: Warm neutral color palette with natural wood accents and Spanish terracotta touches. Polished concrete floors, white subway tiles, natural wood cabinetry with brushed metal hardware. Contemporary Spanish furniture with clean lines and functional storage. Natural light from large windows, pendant lights over kitchen island, recessed LED lighting. Minimalist decor with Spanish ceramic accents, plants, and modern artwork. High-quality finishes with attention to detail, premium materials throughout. Maintain the exact same camera angle, perspective, and composition as the original photo. Only transform the interior elements according to the renovation level. Keep the same room layout, window positions, and architectural features."
  }
}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = (response as any).text();

      console.log(`🤖 Gemini response received for ${tier.tier_name}, parsing...`);

      // Parse the JSON response
      let parsedResponse;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error(`❌ Failed to parse Gemini response for ${tier.tier_name}:`, parseError);
        console.error('Raw response:', text);
        continue;
      }

      if (!parsedResponse.style_prompts) {
        console.error(`❌ Invalid response structure for ${tier.tier_name}:`, parsedResponse);
        continue;
      }

      // Update the tier with style prompts
      const { data: updatedTier, error: updateError } = await supabase
        .from('renovation_tiers')
        .update({
          style_prompts: parsedResponse.style_prompts,
        })
        .eq('id', tier.id)
        .select()
        .single();

      if (updateError) {
        console.error(`❌ Failed to update tier ${tier.tier_name}:`, updateError);
        continue;
      }

      updatedTiers.push(updatedTier);
      console.log(`✅ Generated style prompts for ${tier.tier_name}`);
    }

    return NextResponse.json({
      success: true,
      tiers: updatedTiers,
      listingId: parseInt(listingId),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}
