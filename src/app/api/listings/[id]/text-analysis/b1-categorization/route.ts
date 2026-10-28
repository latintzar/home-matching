import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callGeminiJSON, Claim } from '../../../../../../lib/text-analysis-helpers';
import { PASS_B1_PROMPT } from '../../../../../../lib/prompts/text-analysis';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    
    console.log(`🏷️ Pass B1: Starting claim categorization for listing ${listingId}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'b1_categorization')
        .eq('status', 'completed')
        .single();

      if (!cacheError && cached?.results && isCacheValid(cached.results._version, PIPELINE_VERSIONS.B1_CATEGORIZATION)) {
        console.log(`✅ Pass B1: Using cached results v${cached.results._version} (${cached.results.categorizedCount || 0} categorized)`);
        return Response.json({
          success: true,
          cached: true,
          phase: 'b1_categorization',
          results: {
            categories: Object.keys(cached.results.categorization?.categories || {}).length,
            claimsCount: cached.results.claimsCount || 0,
            categorizedCount: cached.results.categorizedCount || 0,
            unassignedCount: cached.results.unassignedCount || 0
          },
          message: 'Pass B1 completed (cached)',
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.B1_CATEGORIZATION)) {
        console.log(`🔄 Pass B1: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.B1_CATEGORIZATION}), regenerating...`);
      }
    }

    console.log(`🔄 Pass B1: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);

    // Get A2 facts results from database
    const { data: a2Results, error: a2Error } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'a_facts')
      .single();

    if (a2Error || !a2Results) {
      return Response.json({ error: 'A2 facts results not found. Run A2 first.' }, { status: 400 });
    }

    const { claims } = a2Results.results;
    if (!claims || !Array.isArray(claims)) {
      return Response.json({ error: 'No claims found in A2 results.' }, { status: 400 });
    }

    console.log(`🏷️ Pass B1: Categorizing ${claims.length} claims (1 claim per call)...`);

    // Process each claim individually in parallel
    const claimPromises = claims.map(async (claim, index) => {
      try {
        console.log(`🏷️ Pass B1: Processing claim ${index + 1}/${claims.length}: ${claim.id}`);
        const result = await callGeminiJSON(PASS_B1_PROMPT([claim]), false, true); // Use Flash Lite for simple categorization
        return { claimIndex: index, claim, result, success: true };
      } catch (error) {
        console.error(`Pass B1 claim ${index + 1} failed:`, error);
        console.error(`Failed claim ID: ${claim.id}`);
        console.error(`Failed claim text: ${JSON.stringify(claim, null, 2)}`);
        // Return a failure result instead of throwing
        return { claimIndex: index, claim, result: null, success: false, error: (error as any)?.message };
      }
    });

    let claimResults: any[];
    try {
      claimResults = await Promise.all(claimPromises);
      console.log(`🏷️ Pass B1: All ${claimResults.length} claims processed`);
      
      // Count successes and failures
      const successful = claimResults.filter(r => r.success).length;
      const failed = claimResults.filter(r => !r.success).length;
      console.log(`🏷️ Pass B1: ${successful} successful, ${failed} failed`);
      
      if (failed > 0) {
        console.warn(`⚠️ Pass B1: ${failed} claims failed to categorize`);
      }
    } catch (error) {
      console.error('Pass B1 parallel processing failed:', error);
      return Response.json({
        error: `Pass B1 failed: ${(error as any)?.message || 'unknown error'}`
      }, { status: 500 });
    }

    // Merge results from all individual claims
    const mergedCategorization = {
      categories: {
        estado_materiales: { label: "Estado y Materiales", claim_ids: [] },
        espacios_distribucion: { label: "Espacios y Distribución", claim_ids: [] },
        entorno_vistas: { label: "Entorno y Vistas", claim_ids: [] },
        servicios_instalaciones: { label: "Servicios e Instalaciones", claim_ids: [] },
        legal_economico: { label: "Legal y Económico", claim_ids: [] },
        seguridad_accesibilidad: { label: "Seguridad y Accesibilidad", claim_ids: [] },
        caracter_arquitectonico: { label: "Carácter Arquitectónico", claim_ids: [] },
        marketing_promocional: { label: "Marketing Promocional", claim_ids: [] }
      },
      unassigned_claim_ids: []
    };

    // Merge results from all individual claims
    claimResults.forEach((claimResult, index) => {
      if (!claimResult.success || !claimResult.result) {
        console.warn(`Skipping failed claim result at index ${index}`);
        return;
      }
      
      const { result } = claimResult;
      if (result.categories) {
        Object.entries(result.categories).forEach(([categoryKey, categoryData]: [string, any]) => {
          if ((mergedCategorization.categories as any)[categoryKey]) {
            (mergedCategorization.categories as any)[categoryKey].claim_ids.push(...(categoryData.claim_ids || []));
          }
        });
      }
      if (result.unassigned_claim_ids) {
        (mergedCategorization.unassigned_claim_ids as any[]).push(...result.unassigned_claim_ids);
      }
    });

    const categorizationResult = mergedCategorization;

    // Validate that all claims are categorized
    const allClaimIds = claims.map((c: Claim) => c.id);
    const categorizedClaimIds = Object.values(categorizationResult.categories || {})
      .flatMap((cat: any) => cat.claim_ids || []);
    const unassignedClaimIds = categorizationResult.unassigned_claim_ids || [];
    
    const totalCategorized = categorizedClaimIds.length + unassignedClaimIds.length;
    console.log(`🏷️ Pass B1: ${totalCategorized}/${allClaimIds.length} claims categorized`);

    // Save B1 results to database (with version)
    const { error: saveError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'b1_categorization',
        results: {
          categorization: categorizationResult,
          claimsCount: claims.length,
          categorizedCount: categorizedClaimIds.length,
          unassignedCount: unassignedClaimIds.length,
          _version: PIPELINE_VERSIONS.B1_CATEGORIZATION
        },
        status: 'completed',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,phase',
        ignoreDuplicates: false
      });

    if (saveError) {
      console.error('Failed to save B1 results:', saveError);
      return Response.json({ error: 'Failed to save B1 results' }, { status: 500 });
    }

    console.log('✅ Pass B1: Claim categorization completed');

    return Response.json({
      success: true,
      phase: 'b1_categorization',
      results: {
        categories: Object.keys(categorizationResult.categories || {}).length,
        claimsCount: claims.length,
        categorizedCount: categorizedClaimIds.length,
        unassignedCount: unassignedClaimIds.length,
        sampleCategories: Object.entries(categorizationResult.categories || {})
          .slice(0, 3)
          .map(([key, cat]: [string, any]) => ({
            key,
            label: cat.label,
            claimCount: cat.claim_ids?.length || 0
          }))
      },
      message: 'Pass B1 completed successfully'
    });

  } catch (error) {
    console.error('Pass B1 error:', error);
    return Response.json({
      error: `Pass B1 failed: ${(error as any)?.message || 'unknown error'}`
    }, { status: 500 });
  }
}