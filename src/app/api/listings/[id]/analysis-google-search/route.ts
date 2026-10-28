/**
 * Analysis Google Search Pipeline
 * 
 * Complete end-to-end pipeline for analysis-phase Google research:
 * 1. Query Generation - Generate targeted queries using Gemini
 * 2. Search Execution - Execute Google searches
 * 3. Domain Credibility Scoring - Score domains with whitelist + Gemini
 * 4. Curation - Curate results by category with credibility weighting
 * 
 * @see docs/ANALYSIS_GOOGLE_SEARCH_PIPELINE.md for complete documentation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MEGA_CATEGORIES, generateBarrelAPrompt, GENERATE_BARREL_B_PROMPT, CURATION_PROMPT } from '@/lib/prompts/research-queries-advanced';
import { executeMultipleSearches } from '@/lib/google-search';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { createStepLogger, getProgressCallback } from '@/lib/orchestrator-progress';
import { vertexRAG, RAGResult } from '@/lib/vertex-rag'; // Import RAG client
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

/**
 * Concurrency limiter: maintains exactly N concurrent tasks, starts next as soon as one completes
 */
function limitConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return Promise.resolve([]);
  if (maxConcurrency <= 1) {
    return Promise.all(items.map((item, index) => handler(item, index)));
  }
  
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;
  
  return new Promise((resolve, reject) => {
    const processNext = () => {
      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }
      
      while (active < maxConcurrency && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        active++;
        
        handler(items[currentIndex], currentIndex)
          .then((result) => {
            results[currentIndex] = result;
          })
          .catch((error) => {
            results[currentIndex] = error as R;
          })
          .finally(() => {
            active--;
            processNext();
          });
      }
    };
    
    processNext();
  });
}

// Force module to be loaded/initialized at import time
// This ensures the module state is accessible when the endpoint runs
// On fresh server starts, Next.js might lazy-load modules, so we force initialization
if (typeof getProgressCallback === 'function') {
  // Module is loaded - this is just to ensure it's initialized
  void 0;
}

// ============================================================================
// Configuration & Setup
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

interface AnalysisGoogleSearchOptions {
  maxSnippetsPerCategory?: number;
  allowGeminiFallbackForUnknownDomains?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse Gemini JSON response with robust error recovery
 */
function parseGeminiJsonResponse(text: string, categoryName: string, logger: { log: (...args: any[]) => void; error: (...args: any[]) => void } = console): any {
  let cleaned = text.trim();
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  
  // Remove trailing commas
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    logger.error(`❌ JSON parse error for ${categoryName}:`, parseError);
    logger.error('Raw response length:', text?.length);
    logger.error('Raw response preview:', text?.substring(0, 500));
    
    // Try to extract JSON from the response if embedded in text
    const jsonMatch = text?.match(/\{[\s\S]*/);
    if (jsonMatch) {
      try {
        let fixed = jsonMatch[0];
        
        // Handle incomplete strings
        const stringMatches = Array.from(fixed.matchAll(/"([^"\\]|\\.)*/g));
        if (stringMatches.length > 0) {
          const lastMatch = stringMatches[stringMatches.length - 1];
          const afterLastString = fixed.indexOf('"', lastMatch.index! + lastMatch[0].length);
          if (afterLastString === -1) {
            fixed = fixed + '"';
          }
        }
        
        // Remove trailing commas
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        
        // Balance braces/brackets
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;
        
        if (openBraces > closeBraces) {
          fixed = fixed + '}'.repeat(openBraces - closeBraces);
        }
        if (openBrackets > closeBrackets) {
          fixed = fixed + ']'.repeat(openBrackets - closeBrackets);
        }
        
        const parsed = JSON.parse(fixed);
        logger.log(`✅ Recovered JSON for ${categoryName} after truncation`);
        return parsed;
      } catch (recoveryError) {
        logger.error(`❌ JSON recovery failed for ${categoryName}:`, recoveryError);
        throw recoveryError;
      }
    }
    
    throw new Error(`No valid JSON found in response for ${categoryName}`);
  }
}

/**
 * Fetch photo analysis summaries (E3 Whole Property - REQUIRED, E4/Allocentric - OPTIONAL)
 */
async function fetchPhotoAnalysisSummaries(listingId: string, logger: { log: (...args: any[]) => void } = console): Promise<{
  spatialLayout: string; // Allocentric layouts (optional)
  e3WholeProperty: string; // Whole property analysis
  e4RoomByRoom: string;
}> {
  const summaries = {
    spatialLayout: '',
    e3WholeProperty: '',
    e4RoomByRoom: ''
  };

  const listingIdNum = parseInt(listingId, 10);

  // Fetch allocentric layouts (OPTIONAL - from RoomByRoom endpoint)
  const { data: allocentricData, error: allocentricError } = await supabase
    .from('room_analyses')
    .select('layout_allocentric, whole_home_summary')
    .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
    .maybeSingle();

  if (allocentricError) {
    logger.log(`⚠️ Error fetching allocentric layouts (non-fatal): ${allocentricError.message}`);
  }

  // If allocentric data exists, use it (but not required)
  if (allocentricData) {
  const layouts = allocentricData.layout_allocentric || [];
  const wholeHomeSummary = allocentricData.whole_home_summary;
  
    if (layouts.length > 0) {
  const roomNames = layouts.map((l: any) => l.room_name).join(', ');
  const adjacencies = layouts.flatMap((l: any) => l.layout_structured?.obvious_adjacencies || []).length;
  const spatialOrg = wholeHomeSummary?.spatial_organization || '';
  
  summaries.spatialLayout = `Spatial Layout: ${layouts.length} rooms (${roomNames}). ${adjacencies} room adjacencies identified. ${spatialOrg ? `Spatial organization: ${spatialOrg.substring(0, 200)}` : ''}`;
  logger.log(`✅ Found allocentric layouts: ${layouts.length} rooms, ${adjacencies} adjacencies`);
    } else {
      logger.log(`ℹ️ No allocentric layouts available (RoomByRoom may not have run yet)`);
    }
  } else {
    logger.log(`ℹ️ No room_analyses record found - proceeding without allocentric data`);
  }

  // Fetch E3 whole-property analysis
  const { data: e3AnalysisData, error: e3Error } = await supabase
    .from('whole_property_analysis')
    .select('analysis_data')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!e3Error && e3AnalysisData?.analysis_data) {
    const analysis = e3AnalysisData.analysis_data;
    const notableIssues = analysis.notable_issues || [];
    const strengths = analysis.strengths || [];
    const summary = analysis.summary || '';
    summaries.e3WholeProperty = `Whole-Property Analysis: ${summary ? summary.substring(0, 300) : ''} Key strengths: ${strengths.slice(0, 3).join(', ')}. Notable issues: ${notableIssues.slice(0, 3).map((i: any) => i.issue || i).join(', ')}.`;
    logger.log(`✅ Found E3 whole-property analysis`);
  }

  // Fetch E4 room-by-room analysis (from analysis_data field)
  const { data: e4AnalysisData, error: e4Error } = await supabase
    .from('room_analyses')
    .select('analysis_data')
    .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
    .not('analysis_data', 'is', null)
    .single();

  if (!e4Error && e4AnalysisData?.analysis_data) {
    const rooms = Array.isArray(e4AnalysisData.analysis_data) 
      ? e4AnalysisData.analysis_data 
      : [];
    
    const roomSummaries = rooms.slice(0, 5).map((room: any) => {
      const issues = room.notable_issues || [];
      const roomName = room.room_name || room.cluster_name || 'Unknown room';
      return `${roomName}: ${issues.slice(0, 2).map((i: any) => i.issue || i).join(', ')}`;
    });
    
    summaries.e4RoomByRoom = `Room-by-Room Analysis: ${roomSummaries.join(' | ')}`;
    logger.log(`✅ Found E4 room-by-room analysis: ${rooms.length} rooms`);
  }

  return summaries;
}

/**
 * Score domains for credibility (batched)
 */
async function scoreDomainsForCredibility(
  urls: Array<{ url: string; category?: string }>,
  options: { allowGeminiFallback: boolean },
  requestOrigin: string,
  logger: { log: (...args: any[]) => void; error: (...args: any[]) => void } = console
): Promise<Map<string, { credibility: string; method: string }>> {
  const BATCH_SIZE = 100; // Max batch size supported by endpoint
  const CONCURRENT_BATCHES = 8; // Process 8 batches concurrently (increased from 5)

  // Calculate total batches upfront to avoid inconsistency
  const totalBatches = Math.ceil(urls.length / BATCH_SIZE);

  logger.log(`📊 Found ${urls.length} unique domains, fetching credibility in ${totalBatches} batches (${CONCURRENT_BATCHES} concurrent)...`);

  // Create batches upfront
  const batches: Array<{ batchIndex: number; urls: Array<{ url: string; category?: string }> }> = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push({
      batchIndex: Math.floor(i / BATCH_SIZE),
      urls: urls.slice(i, i + BATCH_SIZE)
    });
  }

  // Process batches with concurrency limit
  const processBatch = async (batch: { batchIndex: number; urls: Array<{ url: string; category?: string }> }): Promise<any[]> => {
    const batchNum = batch.batchIndex + 1;
    logger.log(`🔍 Fetching credibility for batch ${batchNum}/${totalBatches} (${batch.urls.length} URLs)...`);

    const credResponse = await fetch(`${requestOrigin}/api/research/domain-credibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: batch.urls,
        options: {
          allowGeminiFallback: options.allowGeminiFallback,
          phase: 'analysis' // Use analysis phase for whitelist
        }
      })
    });

    if (!credResponse.ok) {
      const errorText = await credResponse.text();
      logger.error(`❌ Domain credibility API error for batch ${batchNum}:`, errorText);
      throw new Error(`Domain credibility failed for batch ${batchNum}: ${credResponse.status}`);
    }

    const credData = await credResponse.json();
    if (credData.results && Array.isArray(credData.results)) {
      logger.log(`✅ Batch ${batchNum}/${totalBatches} completed: ${credData.results.length} results`);
      return credData.results;
    }
    
    return [];
  };

  const allCredResults = await limitConcurrency(batches, CONCURRENT_BATCHES, processBatch);
  const flatResults = allCredResults.flat();

  logger.log(`✅ Received credibility for ${flatResults.length} domains (${totalBatches} batches processed)`);

  return new Map(
    flatResults.map((r: any) => [r.url, { credibility: r.credibility, method: r.method }])
  );
}

/**
 * Curate a single Mega-Category using Double-Barrel curation prompt
 */
async function curateCategory(
  categoryId: string,
  snippets: any[],
  maxSnippets: number,
  propertyData: any,
  logger: { error: (...args: any[]) => void; log: (...args: any[]) => void } = console
): Promise<{
  category: string;
  summary: string;
  key_points: string[];
  confidence_level: 'high' | 'medium' | 'low';
  representative_snippets: any[];
  sources_used: string[];
} | null> {
  // Find the Mega-Category
  const megaCategory = MEGA_CATEGORIES.find(c => c.id === categoryId);
  if (!megaCategory) {
    logger.error(`❌ Mega-Category not found: ${categoryId}`);
    return null;
  }

  // Sort by credibility and rank
  const credOrder = { 'high': 0, 'medium': 1, 'unknown': 2, 'low': 3 };
  const sorted = snippets
    .sort((a, b) => {
      const aCred = credOrder[a.credibility as keyof typeof credOrder] || 4;
      const bCred = credOrder[b.credibility as keyof typeof credOrder] || 4;
      if (aCred !== bCred) return aCred - bCred;
      return (a.rank || 999) - (b.rank || 999);
    })
    .slice(0, maxSnippets);

  // Prepare search results for curation prompt
  const searchResults = sorted.map(s => ({
    title: s.title,
    snippet: s.snippet,
    display_link: s.display_link,
    url: s.url,
    credibility: s.credibility
  }));

  // Use the Double-Barrel curation prompt
  const curationPrompt = CURATION_PROMPT({
    category: megaCategory,
    searchResults,
    propertyData
  });

  const curationSchema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      key_points: {
        type: 'array',
        items: { type: 'string' },
        minItems: 0
      },
      confidence_level: {
        type: 'string',
        enum: ['high', 'medium', 'low']
      },
      representative_snippets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            snippet: { type: 'string' }
          },
          required: ['url', 'snippet']
        }
      }
    },
    required: ['summary', 'key_points', 'confidence_level'],
    propertyOrdering: ['summary', 'key_points', 'confidence_level', 'representative_snippets']
  };

  const curationResponse = await callGeminiRest(curationPrompt, {
    temperature: 0.2, // Lower for factual synthesis
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingLevel: 'HIGH' }, // High thinking like zero-shot clustering
    model: 'gemini-3-pro-preview',
    responseMimeType: 'application/json',
    responseSchema: curationSchema
  });

  if (!curationResponse.success || !curationResponse.text) {
    logger.error(`❌ Curation failed for ${categoryId}:`, curationResponse.error);
    return null;
  }

  const cleaned = curationResponse.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const curationData = JSON.parse(cleaned);

  // Use representative snippets from Gemini if provided, otherwise fall back to top 3
  const repSnippets = curationData.representative_snippets?.length > 0
    ? curationData.representative_snippets.slice(0, 3).map((s: any) => {
        let sourceDomain = 'unknown';
        try {
          if (s.url) {
            sourceDomain = new URL(s.url).hostname.replace(/^www\./, '');
          }
        } catch {
          // If URL parsing fails, use display_link from sorted results
          const matchingResult = sorted.find(r => r.url === s.url);
          sourceDomain = matchingResult?.display_link || 'unknown';
        }
        return {
          source_domain: sourceDomain,
          credibility: sorted.find(r => r.url === s.url)?.credibility || 'unknown',
          text: s.snippet?.substring(0, 200) || '',
          url: s.url || '',
          title: s.title || ''
        };
      })
    : sorted.slice(0, 3).map(s => ({
        source_domain: s.display_link,
        credibility: s.credibility,
        text: s.snippet.substring(0, 200),
        url: s.url,
        title: s.title
      }));

  return {
    category: categoryId,
    summary: curationData.summary,
    key_points: curationData.key_points,
    confidence_level: curationData.confidence_level,
    representative_snippets: repSnippets,
    sources_used: Array.from(new Set(sorted.map(s => s.display_link)))
  };
}

// ============================================================================
// Main Endpoint
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'G';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;
  
  // Debug: Verify callback is accessible
  if (isOrchestratorContext) {
    const callback = getProgressCallback();
    if (!callback) {
      // Log warning if callback isn't available (will appear in server terminal)
      console.warn(`[G endpoint] Warning: Progress callback not available - logs will only appear in server terminal`);
  }
  }
  
  // Debug: Log immediately to verify endpoint is called and logger works
  logger.log(`🚀 G endpoint called - logger initialized`);

  const { id: listingId } = await params;
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('force_refresh') === 'true';
  
  try {
    const body = await request.json().catch(() => ({}));
    const options: AnalysisGoogleSearchOptions = {
      maxSnippetsPerCategory: body.options?.maxSnippetsPerCategory || 20,
      allowGeminiFallbackForUnknownDomains: body.options?.allowGeminiFallbackForUnknownDomains !== false
    };

    logger.log(`🔍 Starting Analysis Google Search for listing ${listingId}`);

    // ========================================================================
    // STEP 0: Check Cache (Idempotency) with Version Checking
    // ========================================================================
    if (!forceRefresh) {
      // Check if we have curated results with valid version
      const { data: cachedResults, error: cacheError } = await supabase
        .from('analysis_curated_results')
        .select('*')
        .eq('listing_id', listingId);

      const count = cachedResults?.length || 0;
      const cachedVersion = cachedResults?.[0]?._version;

      if (!cacheError && count > 0 && isCacheValid(cachedVersion, PIPELINE_VERSIONS.G_GOOGLE_SEARCH)) {
        logger.log(`✅ Found ${count} cached curated results v${cachedVersion}. Skipping search.`);

        return NextResponse.json({
          success: true,
          message: 'Analysis Google Search completed (Cached)',
          cached: true,
          data: {
            listing_id: listingId,
            queries_generated: 0,
            queries_barrel_a: 0,
            queries_barrel_b: 0,
            searches_executed: 0,
            results_found: 0,
            results_saved: 0,
            domains_scored: 0,
            categories_curated: count,
            curated_results: cachedResults
          }
        });
      }
    }

    if (forceRefresh) {
        logger.log(`🔄 Force refresh requested - regenerating search results...`);
    }
    
    // ========================================================================
    // STEP 1: Fetch Prerequisites
    // ========================================================================
    
    // Fetch Text Analysis results (B3-snippets, C-unknowns, Cadastre)
    const { data: textResults, error: textError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .in('phase', ['b3_snippets', 'c_unknowns', 'c1_unknowns', 'cadastral_data'])
      .order('created_at', { ascending: true });

    if (textError || !textResults || textResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Text Analysis results not found. Run Text Analysis pipeline first.',
        message: 'Missing b3_snippets or c_unknowns phases'
      }, { status: 404 });
    }

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({
        success: false,
        error: 'No listing data found.'
      }, { status: 404 });
    }

    logger.log(`✅ Retrieved Text Analysis (${textResults.length} phases) and listing data`);

    // Fetch photo analysis summaries (optional)
    const photoAnalysis = await fetchPhotoAnalysisSummaries(listingId, logger);

    // Build inputs for query generation
    const b3Snippets = textResults.find(r => r.phase === 'b3_snippets')?.results || {};
    const cUnknownsResult = textResults.find(r => r.phase === 'c_unknowns' || r.phase === 'c1_unknowns');
    const cUnknowns = cUnknownsResult?.results || {};
    const cadastralResult = textResults.find(r => r.phase === 'cadastral_data');
    const cadastreReport = cadastralResult?.results?.report; // The TruthReport object

    const unknownsChecklist = cUnknowns.unknownsChecklist || cUnknowns.unknowns || [];
    
    // Prepare Cadastral Context
    let cadastralContext = undefined;
    if (cadastreReport) {
        cadastralContext = {
            officialYear: cadastreReport.level4?.unit?.yearBuilt || cadastreReport.level3?.yearBuiltMostCommon,
            officialUsage: cadastreReport.level4?.unit?.usage || cadastreReport.level3?.dominantUse,
            officialSize: cadastreReport.level4?.unit?.surfaceConstructed,
            neighborhoodAge: cadastreReport.level1?.averageYear,
            buildingType: cadastreReport.level3?.structureType,
            warnings: cadastreReport.warnings
        };
        logger.log(`🏛️ Loaded Cadastral Truth: Year ${cadastralContext.officialYear}, Usage ${cadastralContext.officialUsage}`);
    }

    const propertyData = {
      title: listing.scraped_data?.title || listing.title || 'Property',
      location: listing.scraped_data?.city || listing.city || listing.address || 'Unknown',
      size: cadastralContext?.officialSize || listing.scraped_data?.areas?.constructed || listing.scraped_data?.areas?.useful || 0,
      bedrooms: listing.scraped_data?.bedrooms || 0,
      bathrooms: listing.scraped_data?.bathrooms || 0,
      price: listing.scraped_data?.price || listing.price_eur || 0,
      propertyType: listing.scraped_data?.propertyType,
      yearBuilt: cadastralContext?.officialYear || listing.scraped_data?.yearBuilt
    };

    const knownFacts = b3Snippets.categorySnippets || {};
    const unknowns = Array.isArray(unknownsChecklist) ? unknownsChecklist : [];

    // ========================================================================
    // STEP 2: Generate Queries - Double-Barrel Approach
    // ========================================================================
    
    logger.log(`🔫 Starting Double-Barrel query generation for ${MEGA_CATEGORIES.length} Mega-Categories...`);

    const allQueries: { category: string; query: string; reasoning: string; source: 'barrel_a' | 'barrel_b' }[] = [];

    // Extract visual risk flags from photo analysis
    const visualRiskFlags: string[] = [];
    if (photoAnalysis.e3WholeProperty) {
      const issuesMatch = photoAnalysis.e3WholeProperty.match(/Notable issues: ([^.]*)/i);
      if (issuesMatch) {
        visualRiskFlags.push(...issuesMatch[1].split(',').map(s => s.trim()));
      }
    }
    if (photoAnalysis.e4RoomByRoom) {
      const roomIssuesMatch = photoAnalysis.e4RoomByRoom.match(/issues: ([^|]*)/i);
      if (roomIssuesMatch) {
        visualRiskFlags.push(...roomIssuesMatch[1].split(',').map(s => s.trim()));
      }
    }

    const visualContext = {
      summary: `${photoAnalysis.e3WholeProperty || ''} ${photoAnalysis.e4RoomByRoom || ''}`.trim(),
      risk_flags: visualRiskFlags
    };

    // ========================================================================
    // BARREL A: The Syllabus (Deterministic - No LLM needed)
    // ========================================================================
    logger.log(`📚 Barrel A (Syllabus): Generating mandatory queries...`);
    
    MEGA_CATEGORIES.forEach(category => {
      const barrelAResult = generateBarrelAPrompt(category, {
        ...propertyData,
        description: listing.scraped_data?.description || listing.title,
        floor: listing.floor_number || listing.scraped_data?.floor
      });
      
      barrelAResult.queries.forEach((query, idx) => {
        allQueries.push({
          category: category.id,
          query,
          reasoning: barrelAResult.reasoning[idx] || `[Barrel A] Mandatory check for ${category.name}`,
          source: 'barrel_a'
        });
      });
    });

    logger.log(`✅ Barrel A generated ${allQueries.filter(q => q.source === 'barrel_a').length} queries`);

    // ========================================================================
    // BARREL B: The Detective (LLM Creative - Gemini 3 Pro)
    // ========================================================================
    logger.log(`🕵️ Barrel B (Detective): Generating creative queries (8 concurrent)...`);

    const barrelBResponseSchema = {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              reasoning: { type: 'string' }
            },
            required: ['query', 'reasoning']
          },
          minItems: 0,
          maxItems: 5
        }
      },
      required: ['queries'],
      propertyOrdering: ['queries']
    };

    const processBarrelB = async (category: typeof MEGA_CATEGORIES[0], index: number): Promise<{ category: string; query: string; reasoning: string; source: 'barrel_b' }[]> => {
      try {
        const prompt = GENERATE_BARREL_B_PROMPT({
          category,
          propertyData: {
            ...propertyData,
            description: listing.scraped_data?.description || listing.title
          },
          visualContext,
          cadastralContext
        });

        const geminiResponse = await callGeminiRest(prompt, {
          temperature: 0.7, // Higher for creative investigation
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: 'HIGH' }, // High thinking like zero-shot clustering
          model: 'gemini-3-pro-preview',
          responseMimeType: 'application/json',
          responseSchema: barrelBResponseSchema
        });

        if (!geminiResponse.success || !geminiResponse.text) {
          logger.error(`❌ Barrel B Gemini API error for ${category.name}:`, geminiResponse.error);
          return [];
        }

        const parsed = parseGeminiJsonResponse(geminiResponse.text, category.name, logger);

        if (!parsed.queries || !Array.isArray(parsed.queries)) {
          logger.warn(`⚠️ Invalid Barrel B response structure for ${category.name}`);
          return [];
        }

        if (parsed.queries.length > 0) {
          const categoryQueries = parsed.queries.map((q: { query: string; reasoning: string }) => ({
            category: category.id,
            query: q.query,
            reasoning: `[Barrel B] ${q.reasoning}`,
            source: 'barrel_b' as const
          }));
          
          logger.log(`✅ Barrel B generated ${categoryQueries.length} queries for ${category.name}`);
          return categoryQueries;
        } else {
          logger.log(`ℹ️ Barrel B: No queries generated for ${category.name}`);
          return [];
        }
        
      } catch (error) {
        logger.error(`❌ Error in Barrel B for ${category.name}:`, error);
        return [];
      }
    };

    // Run Barrel B in parallel (8 concurrent)
    const barrelBResults = await limitConcurrency(MEGA_CATEGORIES, 8, processBarrelB);
    allQueries.push(...barrelBResults.flat());

    logger.log(`✅ Barrel B generated ${allQueries.filter(q => q.source === 'barrel_b').length} queries`);

    // ========================================================================
    // Merge & Deduplicate Queries
    // ========================================================================
    const uniqueQueries = Array.from(
      new Map(
        allQueries.map(q => [q.query.toLowerCase().trim(), q])
      ).values()
    );

    logger.log(`📝 Total queries: ${allQueries.length} (${allQueries.filter(q => q.source === 'barrel_a').length} Barrel A + ${allQueries.filter(q => q.source === 'barrel_b').length} Barrel B)`);
    logger.log(`🔍 After deduplication: ${uniqueQueries.length} unique queries`);

    if (uniqueQueries.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No research queries generated for this property',
        data: {
          listing_id: listingId,
          queries_generated: 0,
          results_stored: 0
        }
      });
    }

    // ========================================================================
    // STEP 3: Execute Google Searches
    // ========================================================================
    
    const queryStrings = uniqueQueries.map(q => q.query);
    
    logger.log(`🔍 Executing ${queryStrings.length} Google searches...`);
    const searchResults = await executeMultipleSearches(queryStrings);
    
    logger.log(`✅ Search execution completed - ${searchResults.length} queries executed`);

    // ========================================================================
    // STEP 4b: Fetch Legal RAG Anchors (Barrel B of 2-Barrel Super Search)
    // ========================================================================
    
    // Identify Mega-Categories that need Legal/Regulatory backing
    // Mega 4: Urban Legality, Planning & "Ghosts"
    // Mega 6: Financials, Hidden OpEx & Incentives
    const legalCategories = ['4_urban_legality', '6_financials_incentives'];
    const legalRagResults: any[] = [];

    if (vertexRAG.isConfigured('legal')) {
      logger.log(`🏛️ Checking Legal RAG for Urban Legality & Incentives...`);
      
      // Filter relevant queries for RAG
      const ragQueries = uniqueQueries.filter(q => 
        legalCategories.includes(q.category) && 
        (q.query.includes('licencia') || q.query.includes('normativa') || q.query.includes('ayudas') || q.query.includes('deducción'))
      ).slice(0, 5); // Limit to top 5 most relevant legal queries to avoid overload

      if (ragQueries.length > 0) {
        const ragPromises = ragQueries.map(async (q) => {
          try {
            const results = await vertexRAG.search('legal', q.query, 2);
            return results.map((r: RAGResult) => ({
        listing_id: listingId,
              query: q.query,
              url: `rag://legal/${r.source}`, // Virtual URL for RAG results
              title: `[Legal RAG] ${r.source}`,
              snippet: r.content,
              display_link: 'BOE / CTE (Legal RAG)',
              rank: 1,
        metadata: {
                category: q.category,
                reasoning: `[Legal Anchor] Backing for: ${q.query}`,
                source: 'legal_rag'
        }
      }));
          } catch (e) {
            logger.error(`RAG search failed for ${q.query}:`, e);
            return [];
          }
        });

        const ragResultsNested = await Promise.all(ragPromises);
        legalRagResults.push(...ragResultsNested.flat());
        logger.log(`✅ Found ${legalRagResults.length} Legal RAG anchors`);
      }
    }

    // Combine Google results with RAG results for insertion
    const insertData = searchResults.map(r => ({
      listing_id: listingId,
      query: r.query,
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      display_link: r.display_link,
      rank: r.rank,
      metadata: uniqueQueries.find(q => q.query === r.query) ? {
        category: uniqueQueries.find(q => q.query === r.query)?.category,
        reasoning: uniqueQueries.find(q => q.query === r.query)?.reasoning,
        source: uniqueQueries.find(q => q.query === r.query)?.source
      } : {}
    }));

    const combinedInsertData = [...insertData, ...legalRagResults];

    // Deduplicate by (listing_id, query, url) to avoid UPSERT conflicts
    const uniqueInsertData = Array.from(
      new Map(
        combinedInsertData.map(item => [`${item.listing_id}|${item.query}|${item.url}`, item])
      ).values()
    );

    logger.log(`💾 Preparing to overwrite search results (UPSERT mode) - ${uniqueInsertData.length} unique rows (${combinedInsertData.length - uniqueInsertData.length} duplicates removed)`);

    if (uniqueInsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('analysis_search_results')
        .upsert(uniqueInsertData, {
          onConflict: 'listing_id,query,url'
        });

      if (upsertError) {
        logger.error('❌ Failed to save search results:', upsertError);
        throw new Error(`Failed to save research results: ${upsertError.message}`);
      }
    }

    logger.log(`✅ Overwritten ${uniqueInsertData.length} search results in database`);

    // ========================================================================
    // STEP 5: Domain Credibility Scoring (F3)
    // ========================================================================
    
    const uniqueUrls = Array.from(new Set(uniqueInsertData.map(s => s.url)))
      .map(url => ({ url, category: uniqueInsertData.find(s => s.url === url)?.metadata?.category }));
    
    const origin = new URL(request.url).origin;
    const credibilityByUrl = await scoreDomainsForCredibility(
      uniqueUrls,
      { allowGeminiFallback: options.allowGeminiFallbackForUnknownDomains ?? false },
      origin,
      logger
    );

    // ========================================================================
    // STEP 6: Enrich & Group by Category
    // ========================================================================
    
    const enrichedSnippets = uniqueInsertData.map(snippet => ({
      ...snippet,
      credibility: credibilityByUrl.get(snippet.url)?.credibility || 'unknown',
      method: credibilityByUrl.get(snippet.url)?.method || 'unknown'
    }));

    // Group by category
    const byCategory = new Map<string, typeof enrichedSnippets>();
    enrichedSnippets.forEach(snippet => {
      const category = snippet.metadata?.category || 'unknown';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(snippet);
    });

    logger.log(`📂 Grouped into ${byCategory.size} categories`);

    // ========================================================================
    // STEP 7: Curate All Categories (F4)
    // ========================================================================
    
    const categoryEntries = Array.from(byCategory.entries());
    logger.log(`📝 Curating ${categoryEntries.length} categories (15 concurrent)...`);

    type CuratedResult = Awaited<ReturnType<typeof curateCategory>>;
    const processCuration = async ([categoryId, snippets]: [string, typeof enrichedSnippets], index: number): Promise<CuratedResult> => {
      try {
        const curated = await curateCategory(categoryId, snippets, options.maxSnippetsPerCategory ?? 5, propertyData, logger);
        
        if (!curated) {
          return null;
        }

        // Save to database (upsert to overwrite existing results) with version
        await supabase
          .from('analysis_curated_results')
          .upsert({
            listing_id: listingId,
            category: curated.category,
            summary: curated.summary,
            key_points: curated.key_points,
            representative_snippets: curated.representative_snippets,
            sources_used: curated.sources_used,
            confidence_level: curated.confidence_level,
            _version: PIPELINE_VERSIONS.G_GOOGLE_SEARCH
          }, {
            onConflict: 'listing_id,category'
          });

        logger.log(`✅ Curated ${categoryId}`);
        return curated;
        
      } catch (error) {
        logger.error(`❌ Error curating ${categoryId}:`, error);
        return null;
      }
    };

    // Process curation in parallel (8 concurrent for 8 Mega-Categories)
    const curatedResults = (await limitConcurrency(categoryEntries, 8, processCuration)).filter((r): r is NonNullable<typeof r> => r !== null);

    logger.log(`✅ Completed curation for ${curatedResults.length} categories`);

    return NextResponse.json({
      success: true,
      message: 'Analysis Google Search completed',
      data: {
        listing_id: listingId,
        queries_generated: uniqueQueries.length,
        queries_barrel_a: uniqueQueries.filter(q => q.source === 'barrel_a').length,
        queries_barrel_b: uniqueQueries.filter(q => q.source === 'barrel_b').length,
        searches_executed: searchResults.length,
        results_found: uniqueInsertData.length,
        results_saved: uniqueInsertData.length,
        domains_scored: credibilityByUrl.size,
        categories_curated: curatedResults.length,
        curated_results: curatedResults
      }
    });

  } catch (error) {
    logger.error('Analysis Google Search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
