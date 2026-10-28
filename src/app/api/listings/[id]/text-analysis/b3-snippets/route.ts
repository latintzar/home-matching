import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiJSON } from '../../../../../../lib/text-analysis-helpers';
import { PASS_B3_PROMPT } from '../../../../../../lib/prompts/text-analysis';
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
    
    console.log(`📝 Pass B3: Starting snippet generation for listing ${listingId}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'b3_snippets')
        .eq('status', 'completed')
        .single();

      if (!cacheError && cached?.results && isCacheValid(cached.results._version, PIPELINE_VERSIONS.B3_SNIPPETS)) {
        console.log(`✅ Pass B3: Using cached results v${cached.results._version} (${cached.results.totalSnippets || 0} snippets)`);
        return Response.json({
          success: true,
          cached: true,
          phase: 'b3_snippets',
          results: {
            categoriesCount: cached.results.categoriesCount || 0,
            totalSnippets: cached.results.totalSnippets || 0
          },
          message: 'Pass B3 completed (cached)',
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.B3_SNIPPETS)) {
        console.log(`🔄 Pass B3: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.B3_SNIPPETS}), regenerating...`);
      }
    }

    console.log(`🔄 Pass B3: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);

    // Get B2 merged categories from database
    const { data: b2Results, error: b2Error } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'b2_merge')
      .single();

    if (b2Error || !b2Results) {
      return Response.json({ error: 'B2 merge results not found. Run B2 first.' }, { status: 400 });
    }

    // Get A2 claims for context
    const { data: a2Results, error: a2Error } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'a_facts')
      .single();

    if (a2Error || !a2Results) {
      return Response.json({ error: 'A2 facts results not found. Run A2 first.' }, { status: 400 });
    }

    const { mergedCategories } = b2Results.results;
    const { claims } = a2Results.results;

    if (!mergedCategories || !mergedCategories.categories) {
      return Response.json({ error: 'No merged categories found in B2 results.' }, { status: 400 });
    }

    console.log(`📝 Pass B3: Generating snippets for ${Object.keys(mergedCategories.categories).length} categories`);

    // Generate snippets for each category in parallel
    const categorySnippets: any = {};
    const b3Promises = Object.entries(mergedCategories.categories).map(async ([key, val]) => {
      try {
        // Get claims for this category
        const catClaims = claims.filter((c: any) => (val as any).claim_ids.includes(c.id));
        console.log(`📝 Pass B3: Generating snippets for ${key} (${catClaims.length} claims)`);
        
        const snippets = await callGeminiJSON(PASS_B3_PROMPT(catClaims, key), false, true); // Use Flash Lite for simple snippet generation
        return { key, snippets };
      } catch (error) {
        console.error(`Pass B3 failed for category ${key}:`, error);
        return { key, snippets: [] };
      }
    });

    const b3Results = await Promise.all(b3Promises);
    for (const result of b3Results) {
      categorySnippets[result.key] = result.snippets;
    }

    console.log(`✅ Pass B3: Generated snippets for ${Object.keys(categorySnippets).length} categories`);
    
    // Debug: Log snippet count
    let totalSnippetCount = 0;
    for (const [category, categoryData] of Object.entries(categorySnippets)) {
      if (categoryData && typeof categoryData === 'object' && 'snippets_by_category' in categoryData) {
        const nestedSnippets = (categoryData as any).snippets_by_category;
        for (const snippets of Object.values(nestedSnippets)) {
          if (Array.isArray(snippets)) {
            totalSnippetCount += snippets.length;
            console.log(`  ${category}: ${snippets.length} snippets`);
          }
        }
      }
    }
    console.log(`📝 Pass B3: Total snippets: ${totalSnippetCount}`);

    // Save B3 results to database (with version)
    const { error: saveError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'b3_snippets',
        results: {
          categorySnippets,
          categoriesCount: Object.keys(categorySnippets).length,
          totalSnippets: Object.values(categorySnippets).reduce((sum: number, categoryData: any) => {
            // categoryData has structure: { snippets_by_category: { categoryName: [snippets] } }
            if (categoryData?.snippets_by_category) {
              return sum + Object.values(categoryData.snippets_by_category).reduce((catSum: number, snippets: any) => {
                return catSum + (Array.isArray(snippets) ? snippets.length : 0);
              }, 0);
            }
            return sum;
          }, 0),
          _version: PIPELINE_VERSIONS.B3_SNIPPETS
        },
        status: 'completed',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,phase'
      });

    if (saveError) {
      console.error('Failed to save B3 results:', saveError);
      return Response.json({ error: 'Failed to save B3 results' }, { status: 500 });
    }

    console.log('✅ Pass B3: Snippet generation completed');

    return Response.json({
      success: true,
      phase: 'b3_snippets',
      results: {
        categoriesCount: Object.keys(categorySnippets).length,
        totalSnippets: Object.values(categorySnippets).reduce((sum: number, categoryData: any) => {
          if (categoryData?.snippets_by_category) {
            return sum + Object.values(categoryData.snippets_by_category).reduce((catSum: number, snippets: any) => {
              return catSum + (Array.isArray(snippets) ? snippets.length : 0);
            }, 0);
          }
          return sum;
        }, 0),
        sampleSnippets: Object.entries(categorySnippets).slice(0, 3).map(([key, categoryData]: [string, any]) => {
          const snippetCount = categoryData?.snippets_by_category ? 
            Object.values(categoryData.snippets_by_category).reduce((sum: number, snippets: any) => 
              sum + (Array.isArray(snippets) ? snippets.length : 0), 0) : 0;
          const firstSnippet = categoryData?.snippets_by_category ? 
            (Object.values(categoryData.snippets_by_category).find((snippets: any) => 
              Array.isArray(snippets) && snippets.length > 0) as any)?.[0] : null;
          return {
            category: key,
            snippetCount,
            firstSnippet
          };
        })
      },
      message: 'Pass B3 completed successfully'
    });

  } catch (error) {
    console.error('Pass B3 error:', error);
    return Response.json({ 
      error: `Pass B3 failed: ${(error as any)?.message || 'unknown error'}` 
    }, { status: 500 });
  }
}
