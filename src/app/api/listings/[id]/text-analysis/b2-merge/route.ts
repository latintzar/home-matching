import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    
    console.log(`🔄 Pass B2: Starting merge and validation for listing ${listingId}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'b2_merge')
        .eq('status', 'completed')
        .single();

      if (!cacheError && cached?.results && isCacheValid(cached.results._version, PIPELINE_VERSIONS.B2_MERGE)) {
        console.log(`✅ Pass B2: Using cached results v${cached.results._version} (${cached.results.assignedClaims || 0} assigned)`);
        return Response.json({
          success: true,
          cached: true,
          phase: 'b2_merge',
          results: {
            categories: Object.keys(cached.results.mergedCategories?.categories || {}).length,
            assignedClaims: cached.results.assignedClaims || 0,
            totalClaims: cached.results.totalClaims || 0,
            unassignedClaims: cached.results.unassignedClaims || 0
          },
          message: 'Pass B2 completed (cached)',
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.B2_MERGE)) {
        console.log(`🔄 Pass B2: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.B2_MERGE}), regenerating...`);
      }
    }

    console.log(`🔄 Pass B2: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);

    // Get B1 results from database
    const { data: b1Results, error: b1Error } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'b1_categorization')
      .single();

    if (b1Error || !b1Results) {
      return Response.json({ error: 'B1 categorization results not found. Run B1 first.' }, { status: 400 });
    }

    const { categorization } = b1Results.results;

    if (!categorization || !categorization.categories) {
      return Response.json({ error: 'No B1 categorization results found.' }, { status: 400 });
    }

    console.log(`🔄 Pass B2: Processing B1 categorization results`);

    // Since B1 now does parallel processing and merging internally, B2 focuses on validation and cleanup
    const mergedCategories: any = { categories: {} };
    const allAssignedIds = new Set<string>();
    const allUnassignedIds = new Set<string>();

    // Process categories from B1 results
    const categories = categorization.categories || {};
    const unassigned = categorization.unassigned_claim_ids || [];
    
    console.log(`🔍 Processing B1 results with ${Object.keys(categories).length} categories`);
    
    // Add unassigned claims to tracking
    unassigned.forEach((id: string) => allUnassignedIds.add(id));
    
    let assignedCount = 0;
    let duplicateCount = 0;
    
    for (const [key, val] of Object.entries(categories)) {
      mergedCategories.categories[key] = { 
        label: (val as any).label, 
        claim_ids: [] 
      };
      
      // Check for duplicates within this category and deduplicate
      const categoryClaimIds = (val as any).claim_ids || [];
      const uniqueIds = new Set(categoryClaimIds);
      if (uniqueIds.size !== categoryClaimIds.length) {
        duplicateCount += categoryClaimIds.length - uniqueIds.size;
        console.log(`⚠️ B2: Removed ${categoryClaimIds.length - uniqueIds.size} duplicate claim IDs from category ${key}`);
      }
      
      // Add unique claim IDs
      const uniqueClaimIds = Array.from(uniqueIds);
      mergedCategories.categories[key].claim_ids.push(...uniqueClaimIds);
      assignedCount += uniqueClaimIds.length;
      uniqueClaimIds.forEach((id) => allAssignedIds.add(id as string));
    }

    // Add unassigned claims to "other" category
    if (allUnassignedIds.size > 0) {
      if (!mergedCategories.categories.other) {
        mergedCategories.categories.other = { label: "Otros", claim_ids: [] };
      }
      mergedCategories.categories.other.claim_ids.push(...Array.from(allUnassignedIds));
      allUnassignedIds.forEach((id: string) => allAssignedIds.add(id));
    }

    // Debug: Log assignment details
    console.log(`🔍 B2 Debug: ${allAssignedIds.size} assigned, ${assignedCount} from categories, ${allUnassignedIds.size} unassigned`);
    
    // Debug: Show category breakdown
    const categoryBreakdown = Object.entries(mergedCategories.categories).map(([key, cat]) => {
      const count = (cat as any).claim_ids?.length || 0;
      return `${key}: ${count}`;
    }).join(', ');
    console.log(`🔍 Category breakdown: ${categoryBreakdown}`);

    // Validate: every claim assigned exactly once
    const totalClaims = allAssignedIds.size;
    if (totalClaims === 0) {
      console.log(`⚠️ B2: No claims to process - creating empty categories structure`);
      
      // Create empty categories structure for zero claims
      const emptyCategories = {
        categories: {
          estado_materiales: { label: 'Estado y Materiales', claim_ids: [] },
          espacios_distribucion: { label: 'Espacios y Distribución', claim_ids: [] },
          entorno_vistas: { label: 'Entorno y Vistas', claim_ids: [] },
          servicios_instalaciones: { label: 'Servicios e Instalaciones', claim_ids: [] },
          legal_economico: { label: 'Legal y Económico', claim_ids: [] },
          seguridad_accesibilidad: { label: 'Seguridad y Accesibilidad', claim_ids: [] },
          caracter_arquitectonico: { label: 'Carácter Arquitectónico', claim_ids: [] },
          marketing_promocional: { label: 'Marketing Promocional', claim_ids: [] }
        },
        unassigned_claims: [],
        validation: {
          total_claims: 0,
          assigned_claims: 0,
          unassigned_claims: 0,
          categories_count: 10
        }
      };
      
      // Save empty B2 results to database
      const { error: saveError } = await supabase
        .from('text_analysis_results')
        .upsert({
          listing_id: listingId,
          phase: 'b2_merge',
          results: {
            mergedCategories: emptyCategories,
            timestamp: new Date().toISOString()
          }
        }, { onConflict: 'listing_id,phase' });

      if (saveError) {
        console.error('Failed to save B2 empty results:', saveError);
        return Response.json({ error: 'Failed to save B2 results' }, { status: 500 });
      }

      console.log(`✅ Pass B2: Created empty categories structure for zero claims`);
      return Response.json({ 
        success: true, 
        results: { 
          mergedCategories: emptyCategories,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`✅ Pass B2: Merged ${Object.keys(mergedCategories.categories).length} categories`);

    // Save B2 results to database (with version)
    const { error: saveError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'b2_merge',
        results: {
          mergedCategories,
          assignedClaims: allAssignedIds.size,
          totalClaims: totalClaims,
          unassignedClaims: allUnassignedIds.size,
          categoryBreakdown: Object.entries(mergedCategories.categories).map(([key, cat]) => ({
            category: key,
            count: (cat as any).claim_ids?.length || 0
          })),
          _version: PIPELINE_VERSIONS.B2_MERGE
        },
        status: 'completed',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,phase'
      });

    if (saveError) {
      console.error('Failed to save B2 results:', saveError);
      return Response.json({ error: 'Failed to save B2 results' }, { status: 500 });
    }

    console.log('✅ Pass B2: Merge and validation completed');

    return Response.json({
      success: true,
      phase: 'b2_merge',
      results: {
        mergedCategories,  // Add mergedCategories for B3
        categories: Object.keys(mergedCategories.categories).length,
        assignedClaims: allAssignedIds.size,
        totalClaims: totalClaims,
        unassignedClaims: allUnassignedIds.size,
        categoryBreakdown: Object.entries(mergedCategories.categories).map(([key, cat]) => ({
          category: key,
          count: (cat as any).claim_ids?.length || 0
        }))
      },
      message: 'Pass B2 completed successfully'
    });

  } catch (error) {
    console.error('Pass B2 error:', error);
    return Response.json({ 
      error: `Pass B2 failed: ${(error as any)?.message || 'unknown error'}` 
    }, { status: 500 });
  }
}
