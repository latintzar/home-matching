/**
 * View Auto-Clustering Test Results
 * 
 * Retrieves saved auto-clustering results from test table.
 * Can compare with manual clusters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const testRunId = searchParams.get('test_run_id');
    const includeManual = searchParams.get('include_manual') === 'true';

    console.log(`👀 Viewing auto-clustering results for listing ${listingId}`);

    // Get test run metadata first to determine which test_run_id to use
    let runQuery = supabase
      .from('auto_clustering_test_runs')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (testRunId) {
      runQuery = runQuery.eq('id', testRunId);
    } else {
      runQuery = runQuery.limit(1); // Get latest if no test_run_id specified
    }

    const { data: testRuns, error: runError } = await runQuery;

    if (runError) {
      console.warn(`⚠️ Failed to fetch test run metadata: ${runError.message}`);
    }

    // Determine which test_run_id to use
    const currentTestRun = testRuns && testRuns.length > 0 ? testRuns[0] : null;
    const effectiveTestRunId = testRunId || currentTestRun?.id;

    // Get auto clusters - ALWAYS filter by test_run_id to avoid duplicates
    let query = supabase
      .from('auto_photo_clusters')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order');

    if (effectiveTestRunId) {
      query = query.eq('test_run_id', effectiveTestRunId);
    } else {
      // If no test runs exist, return empty clusters
      return NextResponse.json({
        success: true,
        listing_id: listingId,
        auto_clusters: [],
        test_runs: [],
        current_test_run: null,
        message: 'No test runs found for this listing',
      });
    }

    const { data: autoClusters, error: autoError } = await query;

    if (autoError) {
      throw new Error(`Failed to fetch auto clusters: ${autoError.message}`);
    }

    const result: any = {
      success: true,
      listing_id: listingId,
      auto_clusters: autoClusters || [],
      test_runs: testRuns || [],
      current_test_run: currentTestRun,
      test_run_id: effectiveTestRunId, // Include the effective test_run_id used
    };

    // Optionally include production clusters for comparison
    if (includeManual) {
      const { data: productionClusters, error: productionError } = await supabase
        .from('clusters')
        .select('*')
        .eq('listing_id', listingId)
        .order('display_order');

      if (!productionError) {
        result.production_clusters = productionClusters || [];
        result.comparison = {
          auto_clusters_count: autoClusters?.length || 0,
          production_clusters_count: productionClusters?.length || 0,
          auto_photos_count: autoClusters?.reduce((sum: number, c: any) => sum + (c.photo_urls?.length || 0), 0) || 0,
          production_photos_count: productionClusters?.reduce((sum: number, c: any) => sum + (c.photo_urls?.length || 0), 0) || 0,
        };
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Failed to view auto-clustering results:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'view_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

