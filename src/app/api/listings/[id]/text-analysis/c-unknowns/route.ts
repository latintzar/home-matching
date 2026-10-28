import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiJSON } from '../../../../../../lib/text-analysis-helpers';
import { PASS_C_PROMPT } from '../../../../../../lib/prompts/text-analysis';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    
    console.log(`❓ Pass C: Starting unknowns generation for listing ${listingId}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'c_unknowns')
        .eq('status', 'completed')
        .single();

      if (!cacheError && cached?.results && isCacheValid(cached.results._version, PIPELINE_VERSIONS.C_UNKNOWNS)) {
        console.log(`✅ Pass C: Using cached results v${cached.results._version} (${cached.results.totalUnknowns || 0} unknowns)`);
        return Response.json({
          success: true,
          cached: true,
          phase: 'c_unknowns',
          results: {
            totalUnknowns: cached.results.totalUnknowns || 0,
            categoriesWithUnknowns: cached.results.categoriesWithUnknowns || 0,
            categoriesUsed: cached.results.categoriesUsed || 0
          },
          message: 'Pass C completed (cached)',
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.C_UNKNOWNS)) {
        console.log(`🔄 Pass C: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.C_UNKNOWNS}), regenerating...`);
      }
    }

    console.log(`🔄 Pass C: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);

    // Get all previous results
    const [a2Results, b2Results] = await Promise.all([
      supabase.from('text_analysis_results').select('results').eq('listing_id', listingId).eq('phase', 'a_facts').single(),
      supabase.from('text_analysis_results').select('results').eq('listing_id', listingId).eq('phase', 'b2_merge').single()
    ]);

    // Check for missing results
    const missingPhases = [];
    if (a2Results.error || !a2Results.data) missingPhases.push('A');
    if (b2Results.error || !b2Results.data) missingPhases.push('B2');

    if (missingPhases.length > 0) {
      return Response.json({ 
        error: `Missing required phases: ${missingPhases.join(', ')}. Run all previous phases first.` 
      }, { status: 400 });
    }

    // Get essential info from listing data
    const { data: listing } = await supabase.from('listings').select('*').eq('id', listingId).single();
    
    // Use normalizer for consistent data access
    const { normalizeScrapedData } = await import('@/lib/scraper-normalizer');
    const normalized = normalizeScrapedData(listing?.scraped_data || {}, listing?.source_url || '');

    const essentialInfo = {
      title: normalized.title || listing?.title,
      price: normalized.price_eur,
      areas: normalized.areas || {},
      bedrooms: normalized.bedrooms,
      bathrooms: normalized.bathrooms,
      physicalFeatures: normalized.additionalFeatures || [],
      // New Idealista-Aligned fields
      property_subtype: normalized.property_subtype,
      housing_situation: normalized.housing_situation,
      ad_origin: normalized.ad_origin,
      condition: normalized.condition,
      floor_level: normalized.floor_level,
      // Pass booleans to help AI know what's already defined
      booleans: {
        has_elevator: normalized.has_elevator,
        has_terrace: normalized.has_terrace,
        has_balcony: normalized.has_balcony,
        has_pool: normalized.has_pool,
        has_garage: normalized.has_garage,
        has_air_conditioning: normalized.has_air_conditioning,
        has_wardrobes: normalized.has_wardrobes,
        is_accessible: normalized.is_accessible,
        has_storage: normalized.has_storage
      }
    };
    const { claims } = a2Results.data?.results;
    const { mergedCategories } = b2Results.data?.results;

    console.log(`❓ Pass C1: Generating unknowns from ${Object.keys(mergedCategories.categories).length} categories`);

    // Generate category-specific unknowns (one call per category)
    let categoryUnknowns: any = {};
    const c1Promises = Object.entries(mergedCategories.categories).map(async ([categoryKey, categoryData]) => {
      try {
        // Get claims for this category
        const catClaims = claims.filter((c: any) => (categoryData as any).claim_ids.includes(c.id));
        console.log(`❓ Pass C: Generating unknowns for ${categoryKey} (${catClaims.length} claims)`);
        
        const result = await callGeminiJSON(PASS_C_PROMPT(catClaims, categoryKey, categoryData, essentialInfo), false, true); // Use Flash Lite for simple unknown extraction
        return { categoryKey, unknowns: result.categoryUnknowns?.[categoryKey] || [] };
      } catch (error) {
        console.error(`Pass C failed for category ${categoryKey}:`, error);
        return { categoryKey, unknowns: [] };
      }
    });

    const c1Results = await Promise.all(c1Promises);
    for (const result of c1Results) {
      if (result.unknowns.length > 0) {
        categoryUnknowns[result.categoryKey] = result.unknowns;
      }
    }

    console.log(`❓ Pass C: Generated unknowns for ${Object.keys(categoryUnknowns).length} categories`);

      // Save C results to database (with version)
    const { error: saveError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'c_unknowns',
        results: {
          categoryUnknowns,
          totalUnknowns: Object.values(categoryUnknowns).flat().length,
          categoriesWithUnknowns: Object.keys(categoryUnknowns).length,
          categoriesUsed: Object.keys(mergedCategories.categories).length,
          _version: PIPELINE_VERSIONS.C_UNKNOWNS
        },
        status: 'completed',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,phase',
        ignoreDuplicates: false
      });

    if (saveError) {
      console.error('Failed to save C1 results:', saveError);
      return Response.json({ error: 'Failed to save C1 results' }, { status: 500 });
    }

    console.log('✅ Pass C: Unknowns generation completed');

    return Response.json({
      success: true,
      phase: 'c_unknowns',
      results: {
        totalUnknowns: Object.values(categoryUnknowns).flat().length,
        categoriesWithUnknowns: Object.keys(categoryUnknowns).length,
        categoriesUsed: Object.keys(mergedCategories.categories).length,
        sampleCategoryUnknowns: Object.fromEntries(
          Object.entries(categoryUnknowns).slice(0, 2).map(([key, unknowns]) => [key, (unknowns as any[]).slice(0, 2)])
        )
      },
      message: 'Pass C completed successfully'
    });

  } catch (error) {
    console.error('Pass C error:', error);
    return Response.json({ 
      error: `Pass C1 failed: ${(error as any)?.message || 'unknown error'}` 
    }, { status: 500 });
  }
}
