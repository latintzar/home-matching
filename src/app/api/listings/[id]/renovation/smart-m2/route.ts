import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * Smart M2 Inference Endpoint
 * 
 * Uses Gemini 3 Pro to infer room dimensions based on:
 * 1. Total Property M2 (Official Cadastre Truth > Scraped Claim)
 * 2. Visual cues from photos (e.g. "large living room", "tight galley kitchen")
 * 3. Adjacency/Visibility (from zero-shot clustering)
 * 4. Standard architectural ratios
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`📐 Starting Smart M2 Inference for listing ${listingId}`);

    const listingIdNum = parseInt(listingId, 10);
    if (isNaN(listingIdNum)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    // 1. Fetch Data
    // Listing Data (Total M2)
    const { data: listing } = await supabase
      .from('listings')
      .select('scraped_data')
      .eq('id', listingIdNum)
      .single();

    // Fetch Cadastre Data (The Truth)
    const { data: textResults } = await supabase
        .from('text_analysis_results')
        .select('phase, results')
        .eq('listing_id', listingId)
        .eq('phase', 'cadastral_data')
        .single();
    
    const cadastreData = textResults?.results?.report;
    let totalM2 = 0;
    let m2Source = "scraped";

    // Prioritize Official Cadastre Data (Level 4)
    if (cadastreData?.level4?.unit?.surfaceConstructed) {
        totalM2 = cadastreData.level4.unit.surfaceConstructed;
        m2Source = "cadastre_level_4_unit";
        console.log(`✅ Using Official Unit Size: ${totalM2}m2`);
    } 
    // Fallback to Scraped Data
    else if (listing?.scraped_data?.area) {
        // Handle "85 m²" or raw number
        const areaStr = String(listing.scraped_data.area);
        totalM2 = parseInt(areaStr.replace(/\D/g, '')) || 0;
        console.log(`⚠️ Using Scraped Size: ${totalM2}m2`);
    }

    if (totalM2 === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'missing_area', 
        message: 'Total area (m2) not found in Cadastre or Scraped data. Cannot infer room sizes.' 
      }, { status: 400 });
    }

    // Clusters & Visibility
    const { data: clusters } = await supabase
      .from('clusters')
      .select('*')
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
      .order('display_order', { ascending: true });

    if (!clusters || clusters.length === 0) {
      return NextResponse.json({ success: false, error: 'no_clusters', message: 'Run zero-shot clustering first.' }, { status: 400 });
    }

    // 2. Construct Prompt
    const clusterSummaries = clusters.map(c => ({
      name: c.cluster_name,
      photo_count: c.photo_urls?.length || 0,
      visibility: c.visibility_mappings // Adjacency clues
    }));

    const prompt = `You are an expert architect estimating room sizes and ceiling heights from a floor plan mental model.

INPUTS:
- Total Property Size: ${totalM2} m² (Source: ${m2Source})
- Detected Rooms (Clusters): ${JSON.stringify(clusterSummaries, null, 2)}

TASK:
1. Distribute the ${totalM2} m² across the detected rooms.
   - Use standard architectural ratios (Living Room largest, Bathrooms small).
   - Use photo counts/visibility as clues.
   - Account for walls/circulation (~10-15%).
2. Estimate Ceiling Height (meters) for each room based on room type and visual cues (inferred from standard construction).
   - Standard modern: 2.5m
   - Old high ceilings: 3.0m+
   - False ceilings (Kitchen/Bath): 2.3-2.4m

OUTPUT JSON:
{
  "rooms": [
    {
      "cluster_name": "Living Room",
      "estimated_m2": 25,
      "estimated_height_m": 2.7,
      "confidence": "high",
      "reasoning": "Central hub, standard high ceiling"
    }
  ],
  "circulation_and_walls_m2": 15,
  "total_check": 100
}
Ensure the sum equals exactly ${totalM2}.`;

    // 3. Call Gemini
    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.1, // Precision is key
      responseMimeType: 'application/json'
    });

    if (!result.success || !result.text) {
      throw new Error(result.error || 'Gemini inference failed');
    }

    const parsed = JSON.parse(result.text);

    // 4. Save Result (to text_analysis_results for now)
    await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'smart_m2',
        results: parsed
      }, { onConflict: 'listing_id,phase' });

    return NextResponse.json({ success: true, data: parsed });

  } catch (error: any) {
    console.error('Smart M2 Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
