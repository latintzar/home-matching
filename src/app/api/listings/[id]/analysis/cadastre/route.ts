import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CadastreAnalyzer } from '@/lib/cadastre/analyzer';
import { createStepLogger } from '@/lib/orchestrator-progress';
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

/**
 * CADASTRAL NODE (Phase 2.5)
 * 
 * Purpose: Establish the "Official Truth" about the property before visual/deep analysis.
 * Inputs: Scraped Data (Address, Location, Claims).
 * Outputs: Official Year, Surface, Use, Warnings, Neighborhood Context.
 * 
 * Downstream Consumers:
 * - Whole Property Analysis (for Age-related risks)
 * - Room-by-Room Analysis (for Structure/Material context)
 * - Buyer Report (for Forensic Risk Audit)
 * 
 * NOTE: This step can take 3-5 minutes due to:
 * - Cadastre API rate limiting
 * - Neighborhood sampling (50 addresses with 600ms delays each)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'Cadastre';
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    
    logger.log(`🏰 Starting Cadastral Analysis for listing ${listingId}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'cadastral_data')
        .single();

      if (!cacheError && cached?.results?.report && isCacheValid(cached.results._version, PIPELINE_VERSIONS.CADASTRE)) {
        logger.log(`✅ Cadastre: Using cached results v${cached.results._version}`);
        return NextResponse.json({
          success: true,
          cached: true,
          data: cached.results.report,
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results?.report && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.CADASTRE)) {
        logger.log(`🔄 Cadastre: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.CADASTRE}), regenerating...`);
      }
    }

    logger.log(`🔄 Cadastre: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);

    // 1. Fetch Scraped Data & B3 Snippets in parallel (independent queries)
    const [listingResponse, textResultsResponse] = await Promise.all([
      supabase
        .from('listings')
        .select('title, address, city, price_eur, source_url, scraped_data')
        .eq('id', String(listingId))
        .single(),
      supabase
        .from('text_analysis_results')
        .select('phase, results')
        .eq('listing_id', listingId)
        .eq('phase', 'b3_snippets')
        .single()
    ]);

    const { data: listing, error: listingError } = listingResponse;
    const { data: textResults } = textResultsResponse;

    if (listingError || !listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }

    const b3Snippets = textResults?.results || {};
    const scrapedData: any = listing.scraped_data || {};

    // 2. Prepare Input for Analyzer
    const analyzer = new CadastreAnalyzer();
    
    // Extract claims from B3 snippets OR scraped_data (fallback chain)
    const claimedSize = parseInt(b3Snippets.metrics?.size_m2) 
      || scrapedData.areas?.constructed 
      || scrapedData.m2_built 
      || scrapedData.sqm 
      || undefined;
    const claimedFloor = b3Snippets.location?.floor_level 
      || scrapedData.floor_level 
      || scrapedData.floor_number?.toString()
      || undefined;
    const claimedYear = parseInt(b3Snippets.metrics?.year_built) 
      || scrapedData.year_built 
      || undefined;
    const claimedType = b3Snippets.property_type 
      || scrapedData.property_subtype 
      || undefined;

    // Construct full address string if parts exist
    const fullAddress = listing.address ? `${listing.address}, ${listing.city}` : undefined;

    // Extract Coordinates from scraped_data (if available) with multiple fallbacks
    let coordinates: { lat: number; lng: number } | undefined = undefined;
    
    if (scrapedData?.location?.latitude && scrapedData?.location?.longitude) {
        coordinates = {
            lat: parseFloat(scrapedData.location.latitude),
            lng: parseFloat(scrapedData.location.longitude)
        };
    } else if (scrapedData?.lat && scrapedData?.lng) {
         coordinates = {
            lat: parseFloat(scrapedData.lat),
            lng: parseFloat(scrapedData.lng)
        };
    } else if (scrapedData?.latitude && scrapedData?.longitude) {
         coordinates = {
            lat: parseFloat(scrapedData.latitude),
            lng: parseFloat(scrapedData.longitude)
        };
    }
    
    logger.log(`📍 Analyzing: ${fullAddress || 'Unknown Address'} (Claims: ${claimedSize || '?'}m², Year ${claimedYear || '?'})`);
    if (coordinates) logger.log(`   Coords provided: ${coordinates.lat}, ${coordinates.lng}`);
    logger.log(`⏳ Fetching cadastre data & neighborhood samples (this may take 2-4 minutes)...`);

    // 3. Run Analysis
    const startTime = Date.now();
    const report = await analyzer.analyze({
        address: fullAddress,
        coordinates,
        claimedSize,
        claimedFloor,
        claimedYear,
        claimedType
    });
    const duration = Math.round((Date.now() - startTime) / 1000);

    const summary = analyzer.getAnalysisSummary(report);
    logger.log(`✅ Cadastral Analysis Complete in ${duration}s`);

    // 4. Persist Result
    const { error: upsertError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'cadastral_data', // NEW PHASE
        results: {
            report,
            summary_text: summary,
            analyzed_at: new Date().toISOString(),
            _version: PIPELINE_VERSIONS.CADASTRE
        },
      }, { onConflict: 'listing_id,phase' });

    if (upsertError) {
      throw new Error(`Failed to persist cadastral data: ${upsertError.message}`);
    }

    return NextResponse.json({ success: true, data: report });

  } catch (e: any) {
    logger.error(`❌ Cadastral Analysis Error:`, e?.message || e);
    return NextResponse.json(
      { success: false, error: e?.message || 'unknown_error' },
      { status: 500 }
    );
  }
}

