import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { convertToMarkdown, callGeminiJSON, Claim } from '../../../../../../lib/text-analysis-helpers';
import { PASS_A_PROMPT } from '../../../../../../lib/prompts/text-analysis';
import { normalizeScrapedData } from '@/lib/scraper-normalizer';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    
    console.log(`🧠 Pass A: Starting sentence-by-sentence fact extraction for listing ${listingId}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'a_facts')
        .eq('status', 'completed')
        .single();

      if (!cacheError && cached?.results && isCacheValid(cached.results._version, PIPELINE_VERSIONS.A_FACTS)) {
        console.log(`✅ Pass A: Using cached results v${cached.results._version} (${cached.results.count || cached.results.claims?.length || 0} claims)`);
        return Response.json({
          success: true,
          cached: true,
          phase: 'a_facts',
          results: {
            claimsCount: cached.results.count || cached.results.claims?.length || 0,
            sampleClaims: (cached.results.claims || []).slice(0, 5)
          },
          message: 'Pass A completed (cached)',
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.A_FACTS)) {
        console.log(`🔄 Pass A: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.A_FACTS}), regenerating...`);
      }
    }

    console.log(`🔄 Pass A: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);

    // Get listing data directly from database
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Normalize scraped data to ensure consistent input shape
    const normalized = normalizeScrapedData(listing.scraped_data || {}, listing.source_url || '');

    // Prepare listing data for A2 prompt using normalized structure
    const listingData = {
      title: normalized.title || listing.title,
      description: normalized.description || '',
      property_subtype: normalized.property_subtype,
      housing_situation: normalized.housing_situation,
      ad_origin: normalized.ad_origin,
      condition: normalized.condition,
      floor_level: normalized.floor_level,
      has_elevator: normalized.has_elevator,
      has_terrace: normalized.has_terrace,
      has_balcony: normalized.has_balcony,
      has_pool: normalized.has_pool,
      has_garage: normalized.has_garage,
      has_air_conditioning: normalized.has_air_conditioning,
      has_wardrobes: normalized.has_wardrobes,
      is_accessible: normalized.is_accessible,
      has_storage: normalized.has_storage,
      floor_number: normalized.floor_number,
      balcony_orientation: normalized.balcony_orientation,
      terrace_orientation: normalized.terrace_orientation,
      roomsAndAmenities: normalized.roomsAndAmenities || '',
      additionalFeatures: normalized.additionalFeatures || [],
      price_eur: normalized.price_eur,
      areas: normalized.areas
    };

    console.log('🧠 Pass A2: Calling Gemini for sentence-by-sentence fact extraction...');
    console.log('🧠 Pass A2: Listing data:', JSON.stringify(listingData, null, 2));

    // Call Gemini for sentence-by-sentence fact extraction
    let allClaims: Claim[] = [];
    try {
      const result = await callGeminiJSON(PASS_A_PROMPT(listingData), true, true); // Use Flash Lite for simple fact extraction
      
      // Assign globally unique IDs to claims
      allClaims = result.map((cl: any, claimIndex: number) => ({
        id: `F1-${claimIndex + 1}`,
        sentence_id: cl.sentence_id || `S1-${claimIndex + 1}`,
        fact: cl.fact,
        source_span: cl.source_span,
        polarity: cl.polarity || 'affirmed',
        units: cl.units || null,
        numeric_value: cl.numeric_value || null,
        normalized_value: cl.normalized_value || null
      }));

      console.log(`🧠 Pass A2: Extracted ${allClaims.length} claims from property listing`);
    } catch (error) {
      console.error('Pass A2 Gemini call failed:', error);
      return Response.json({ 
        error: `Pass A2 failed: ${(error as any)?.message || 'unknown error'}` 
      }, { status: 500 });
    }

    // Save A2 results to database (with version)
    const { error: saveError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'a_facts',
        results: {
          claims: allClaims,
          count: allClaims.length,
          _version: PIPELINE_VERSIONS.A_FACTS
        },
        status: 'completed',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,phase'
      });

    if (saveError) {
      console.error('Failed to save A2 results:', saveError);
      return Response.json({ error: 'Failed to save A2 results' }, { status: 500 });
    }

    console.log('✅ Pass A2: Sentence-by-sentence fact extraction completed');

    return Response.json({
      success: true,
      phase: 'a_facts',
      results: {
        claimsCount: allClaims.length,
        sampleClaims: allClaims.slice(0, 5) // First 5 claims for debugging
      },
      message: 'Pass A2 completed successfully'
    });

  } catch (error) {
    console.error('Pass A2 error:', error);
    return Response.json({ 
      error: `Pass A2 failed: ${(error as any)?.message || 'unknown error'}` 
    }, { status: 500 });
  }
}
