import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const ajv = new Ajv({ allErrors: true });

type Tier = 'estandar' | 'optimo' | 'plus';

interface TierStyleDirection {
  style_summary: string;
  color_palette: string[];
  material_guidance: string[];
  design_philosophy: string;
  key_style_elements: string[];
}

interface StyleDirectionResponse {
  listing_id: string;
  generated_at: string;
  baseline?: {
    baseline_summary: string;
    architectural_period?: string;
    regional_influences?: string[];
    material_palette?: string[];
    tone_summary?: string;
  };
  tiers: {
    estandar: TierStyleDirection;
    optimo: TierStyleDirection;
    plus: TierStyleDirection;
  };
}

const tierStyleSchema = {
  type: 'object',
  properties: {
    style_summary: { type: 'string' },
    color_palette: {
      type: 'array',
      items: { type: 'string' }
    },
    material_guidance: {
      type: 'array',
      items: { type: 'string' }
    },
    design_philosophy: { type: 'string' },
    key_style_elements: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['style_summary', 'color_palette', 'material_guidance', 'design_philosophy', 'key_style_elements']
};

const allTiersStyleSchema = {
  type: 'object',
  properties: {
    estandar: tierStyleSchema,
    optimo: tierStyleSchema,
    plus: tierStyleSchema
  },
  required: ['estandar', 'optimo', 'plus']
};

const validateTierStyle = ajv.compile(tierStyleSchema);

/**
 * Tier Style Direction (T2.5): Generate tier-specific style directions
 * 
 * Generates tier-specific style directions between T2 (Tier Ideation) and T3 (Apply to Groups).
 * This ensures style choices inform cost decisions throughout the pipeline.
 * 
 * Inputs:
 * - Photos organized by room (from clusters)
 * - Tier scope from T2 (tier philosophies)
 * - Basic property info (location, year built, property type, size)
 * 
 * Output:
 * - Tier-specific style directions (one per tier: estandar, optimo, plus)
 * 
 * Endpoint: POST /api/listings/[id]/tiers/style-direction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'T2.5';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`🎨 Tier Style Direction (T2.5): Generating tier-specific style directions for listing ${listingId}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('style_direction')
      .select('direction_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (existing?.direction_data?.tiers) {
      logger.log(`✅ Tier style directions already exist`);
      return NextResponse.json({
        success: true,
        data: existing.direction_data,
        cached: true
      });
    }

    // Fetch tier philosophies (T2)
    const { data: philosophiesData } = await supabase
      .from('tier_philosophies')
      .select('philosophies')
      .eq('listing_id', listingId.toString())
      .single();

    if (!philosophiesData?.philosophies) {
      return NextResponse.json(
        { success: false, error: 'Tier philosophies not found. Run tiers/ideation first (T2).' },
        { status: 404 }
      );
    }

    const philosophies = philosophiesData.philosophies;

    // Fetch photos organized by room (from clusters)
    const { data: allClusters } = await supabase
      .from('clusters')
      .select('cluster_name, room_type, photo_urls')
      .eq('listing_id', parseInt(listingId, 10))
      .order('display_order', { ascending: true });

    // Filter out excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const clusters = [];
    for (const c of (allClusters || [])) {
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      if (!isExcluded) {
        clusters.push(c);
      }
    }

    if (!clusters || clusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid photo clusters found. Organize photos into clusters first (excluding Excluded/Floorplans).' },
        { status: 404 }
      );
    }

    // Fetch listing metadata
    const listingIdNum = parseInt(listingId, 10);
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('title, price_eur, city, region, scraped_data')
      .or(`id.eq.${listingIdNum},id.eq.${listingId}`)
      .maybeSingle();

    if (listingError) {
      return NextResponse.json(
        { success: false, error: `Error fetching listing: ${listingError.message}` },
        { status: 500 }
      );
    }

    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found.' },
        { status: 404 }
      );
    }

    const propertyInfo = {
      title: listing.title,
      price_eur: listing.price_eur || listing.scraped_data?.price || 0,
      size_sqm: listing.scraped_data?.areas?.constructed || listing.scraped_data?.areas?.useful || 0,
      property_type: listing.scraped_data?.property_type || listing.scraped_data?.typology || 'apartment',
      location: listing.city || listing.region || listing.scraped_data?.location?.city || listing.scraped_data?.location?.address || 'Spain',
      year_built: listing.scraped_data?.year_built || null
    };

    // Fetch allocentric layouts (REQUIRED - saved by RoomByRoom endpoint)
    const { data: roomAnalysis } = await supabase
      .from('room_analyses')
      .select('layout_allocentric, whole_home_summary')
      .eq('listing_id', parseInt(listingId, 10))
      .single();

    if (!roomAnalysis?.layout_allocentric || roomAnalysis.layout_allocentric.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Allocentric layouts not found. RoomByRoom must run before T2.5.' },
        { status: 404 }
      );
    }

    const allocentricLayouts = roomAnalysis.layout_allocentric;
    const wholeHomeSummary = roomAnalysis.whole_home_summary;

    // Fetch and encode ALL valid photos (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const validPhotos = await fetchValidListingPhotos(listingId);
    const photoUrls = validPhotos.map(p => p.url);

    const images: GeminiImageInput[] = [];
    
    logger.log(`📸 Fetching ${photoUrls.length} valid photos for style assessment...`);
    for (const photoUrl of photoUrls) {
      try {
        const response = await fetch(photoUrl, {
          redirect: 'follow',
          headers: { 'User-Agent': 'PuedoCasa-StyleDirection/1.0' }
        });
        
        if (!response.ok) {
          logger.warn(`⚠️ Failed to fetch photo ${photoUrl}: HTTP ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
        
        if (contentType.includes('image/webp')) mimeType = 'image/webp';
        else if (contentType.includes('image/png')) mimeType = 'image/png';
        else if (contentType.includes('image/gif')) mimeType = 'image/gif';

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        if (base64 && base64.length > 64) {
          images.push({ mimeType, data: base64 });
        }
      } catch (err) {
        logger.warn(`⚠️ Error fetching photo ${photoUrl}:`, err);
      }
    }

    logger.log(`✅ Successfully encoded ${images.length} images for style assessment`);

    // Optional: Generate baseline aesthetic (for reference)
    let baseline: any = null;
    let baselineResult: any = null;
    if (images.length > 0) {
      const baselinePrompt = `You are analyzing the current aesthetic of a Spanish property.

PROPERTY INFORMATION:
- Location: ${propertyInfo.location}
- Year Built: ${propertyInfo.year_built || 'Unknown'}
- Property Type: ${propertyInfo.property_type}
- Size: ${propertyInfo.size_sqm} m²

PHOTOS ORGANIZED BY ROOM:
${clusters.map(c => `- ${c.cluster_name} (${c.room_type || 'Unknown'}): ${c.photo_urls.length} photos`).join('\n')}

TASK:
Analyze the current aesthetic state of the property based on visual evidence from photos.
Describe materials, light, geometry, and overall character.

OUTPUT (JSON):
{
  "baseline_summary": "2-3 sentence overview of the property's current aesthetic",
  "architectural_period": "e.g. '1970s coastal apartment block' or 'Contemporary'",
  "regional_influences": ["..."],
  "material_palette": ["..."],
  "tone_summary": "..."
}

RULES:
- Stay factual and credible; no exaggeration
- Base assessment primarily on visual evidence from photos
- Focus on CURRENT state - describe what exists now
- Mention specific eras or influences only if supported by visual cues
- Avoid aspirational adjectives like 'luxurious' or 'beautiful'
- Output only the JSON`;

      baselineResult = await callGeminiRest(baselinePrompt, {
        model: 'gemini-2.5-flash',
        temperature: 0.15,
        maxOutputTokens: 8000,
        images: images, // Use all valid photos
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            baseline_summary: { type: 'string' },
            architectural_period: { type: 'string' },
            regional_influences: { type: 'array', items: { type: 'string' } },
            material_palette: { type: 'array', items: { type: 'string' } },
            tone_summary: { type: 'string' }
          },
          required: ['baseline_summary', 'architectural_period', 'regional_influences', 'material_palette', 'tone_summary']
        }
      });

      if (baselineResult.success && baselineResult.text) {
        try {
          const cleaned = baselineResult.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
          baseline = JSON.parse(cleaned);
        } catch (e) {
          logger.warn('⚠️ Failed to parse baseline, continuing without it');
        }
      }
    }

    // Generate all tier-specific style directions in ONE call for alignment
    const allTiersPrompt = `You are an architectural stylist defining style directions for THREE renovation tiers of a Spanish property. Generate all three tiers together to ensure they are aligned, progressive, and architecturally coherent.

TIER PHILOSOPHIES:
ESTÁNDAR:
- Intent: ${philosophies.estandar.intent}
- Quality Band: ${philosophies.estandar.quality_band}
- Constraints: ${philosophies.estandar.constraints.join(', ')}

ÓPTIMO:
- Intent: ${philosophies.optimo.intent}
- Quality Band: ${philosophies.optimo.quality_band}
- Constraints: ${philosophies.optimo.constraints.join(', ')}

PLUS:
- Intent: ${philosophies.plus.intent}
- Quality Band: ${philosophies.plus.quality_band}
- Constraints: ${philosophies.plus.constraints.join(', ')}

PROPERTY INFORMATION:
- Location: ${propertyInfo.location}
- Year Built: ${propertyInfo.year_built || 'Unknown'}
- Property Type: ${propertyInfo.property_type}
- Size: ${propertyInfo.size_sqm} m²
- Property Value: ${propertyInfo.price_eur} EUR

${baseline ? `CURRENT PROPERTY AESTHETIC (baseline):
${JSON.stringify(baseline, null, 2)}` : ''}

PHOTOS ORGANIZED BY ROOM:
${clusters.map(c => `- ${c.cluster_name} (${c.room_type || 'Unknown'}): ${c.photo_urls.length} photos`).join('\n')}

ALLOCENTRIC ROOM LAYOUTS (spatial context):
${JSON.stringify(allocentricLayouts, null, 2)}

${wholeHomeSummary ? `WHOLE-HOME SUMMARY (spatial organization):
${JSON.stringify(wholeHomeSummary, null, 2)}` : ''}

TIER CONTEXT:
- Estándar: Cost-conscious refresh, basic fixtures, refreshed finishes. Style should be practical, clean, and move-in ready without major transformations.
- Óptimo: Modernized with comfort upgrades, better materials, smart features. Style should be contemporary, efficient, and comfortable.
- Plus: Transformative but architecturally credible, high-end design, premium finishes. Style should be sophisticated, premium, and architecturally refined.

TASK:
Generate style directions for ALL THREE tiers that:
1. Build on the baseline aesthetic (if provided) - don't contradict the property's fundamental character
2. Are PROGRESSIVE and ALIGNED - each tier should build naturally on the previous one
3. Reflect the ambition level and scope of each tier appropriately
4. Provide concrete design guidance appropriate for each tier's budget and scope
5. Consider each tier's philosophy (intent, quality band, constraints)

CRITICAL INSTRUCTIONS:
- Generate all three tiers TOGETHER to ensure alignment and progression
- Estándar should be practical and accessible
- Óptimo should be a natural evolution from Estándar with better materials and modern touches
- Plus should be a premium transformation that builds on both but elevates everything
- Build on baseline - don't contradict the property's fundamental character
- Stay regionally appropriate and architecturally credible
- Be specific about design choices (e.g., "warm white walls with matte finish" not just "white walls")
- Style choices should inform cost decisions (e.g., Mediterranean luxury = ornate fixtures, Industrial loft = exposed pipes)

OUTPUT (JSON):
{
  "estandar": {
    "style_summary": "2-3 sentence overview of style direction for Estándar tier",
    "color_palette": ["specific colors appropriate for Estándar"],
    "material_guidance": ["specific materials and finishes for Estándar"],
    "design_philosophy": "1-2 sentences describing Estándar design approach",
    "key_style_elements": ["specific style elements that define Estándar aesthetic"]
  },
  "optimo": {
    "style_summary": "2-3 sentence overview of style direction for Óptimo tier",
    "color_palette": ["specific colors appropriate for Óptimo"],
    "material_guidance": ["specific materials and finishes for Óptimo"],
    "design_philosophy": "1-2 sentences describing Óptimo design approach",
    "key_style_elements": ["specific style elements that define Óptimo aesthetic"]
  },
  "plus": {
    "style_summary": "2-3 sentence overview of style direction for Plus tier",
    "color_palette": ["specific colors appropriate for Plus"],
    "material_guidance": ["specific materials and finishes for Plus"],
    "design_philosophy": "1-2 sentences describing Plus design approach",
    "key_style_elements": ["specific style elements that define Plus aesthetic"]
  }
}

RULES:
- Generate all three tiers together for alignment
- Build on baseline, don't contradict it
- Ensure progressive evolution from Estándar → Óptimo → Plus
- Match tier ambition levels
- Be specific and actionable
- Stay architecturally credible
- Output only the JSON`;

    logger.log(`🎨 Generating all three tier style directions in one aligned call...`);
    
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let detectedModel = 'gemini-2.5-pro';

    const result = await callGeminiRest(allTiersPrompt, {
        model: 'gemini-2.5-pro',
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        thinkingConfig: { thinkingBudget: 16384 },
        maxOutputTokens: 16384,
      images: images, // Use all valid photos
        responseMimeType: 'application/json',
      responseSchema: allTiersStyleSchema
      });

      if (!result.success || !result.text) {
      logger.error(`❌ Gemini call failed for tier style directions:`, result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate tier style directions',
          details: result.error
        },
        { status: 500 }
      );
      }

      let parsed: any;
      try {
        const cleaned = result.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
      logger.error(`❌ Failed to parse AI response:`, parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse tier style directions response',
          details: (parseError as Error).message
        },
        { status: 500 }
      );
      }

    // Validate structure for all tiers
    const tierDirections: Record<string, TierStyleDirection> = {};
    for (const tier of ['estandar', 'optimo', 'plus'] as Tier[]) {
      if (!parsed[tier]) {
        logger.error(`❌ Missing tier ${tier} in response`);
        return NextResponse.json(
          {
            success: false,
            error: `Missing tier ${tier} in response`
          },
          { status: 500 }
        );
      }

      if (!validateTierStyle(parsed[tier])) {
        logger.error(`❌ Invalid response structure for tier ${tier}:`, validateTierStyle.errors);
        return NextResponse.json(
          {
            success: false,
            error: `Invalid structure for tier ${tier}`,
            details: validateTierStyle.errors
          },
          { status: 500 }
        );
      }

      tierDirections[tier] = parsed[tier] as unknown as TierStyleDirection;
      }

      // Accumulate token usage
      if (result.usage) {
        totalInputTokens += result.usage.promptTokenCount || 0;
        totalOutputTokens += result.usage.candidatesTokenCount || 0;
        if (result.model) detectedModel = result.model;
      }

    logger.log(`✅ Generated all three tier style directions in one aligned call`);

    // Accumulate baseline usage (if baseline was generated)
    if (baselineResult && baselineResult.usage) {
      totalInputTokens += baselineResult.usage.promptTokenCount || 0;
      totalOutputTokens += baselineResult.usage.candidatesTokenCount || 0;
      if (baselineResult.model) detectedModel = baselineResult.model;
    }

    if (Object.keys(tierDirections).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate any tier style directions'
        },
        { status: 500 }
      );
    }

    // Combine baseline and tier-specific directions
    const output: StyleDirectionResponse = {
      listing_id: listingId.toString(),
      generated_at: new Date().toISOString(),
      ...(baseline && { baseline }),
      tiers: {
        estandar: tierDirections.estandar!,
        optimo: tierDirections.optimo!,
        plus: tierDirections.plus!
      }
    };

    // Save to database
    const { error: saveError } = await supabase
      .from('style_direction')
      .upsert({
        listing_id: listingId.toString(),
        direction_data: output,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (saveError) {
      logger.error('❌ Failed to save style direction:', saveError);
      return NextResponse.json(
        {
          success: false,
          error: 'save_failed',
          details: saveError.message
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Tier Style Direction (T2.5): Generated tier-specific style directions`);

    return NextResponse.json({
      success: true,
      data: output,
      usage: {
        promptTokenCount: totalInputTokens,
        candidatesTokenCount: totalOutputTokens,
        totalTokenCount: totalInputTokens + totalOutputTokens
      },
      model: detectedModel
    });

  } catch (error: any) {
    logger.error('❌ Tier Style Direction failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'style_direction_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

