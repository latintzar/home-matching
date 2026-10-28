/**
 * Get Latest Auto-Clustering Test Run Results
 * 
 * Fetches the most recent test run's stage results from Supabase.
 * Useful for debugging individual stages without re-running the full pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    // Fetch the most recent test run for this listing
    const { data: testRun, error } = await supabase
      .from('auto_clustering_test_runs')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !testRun) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_test_run',
          details: 'No test run found for this listing. Run the full pipeline first.',
        },
        { status: 404 }
      );
    }

    // Extract stage results
    const stageResults = {
      stage0a: testRun.stage0a_result,
      stage0b: testRun.stage0b_result,
      stage0c: testRun.stage0c_result,
      stage0d: testRun.stage0d_result,
      stage2: testRun.stage2_result,
      stage3: testRun.stage3_result,
      stage4: testRun.stage4_result,
      stage5: testRun.stage5_result,
    };

    return NextResponse.json({
      success: true,
      test_run_id: testRun.id,
      created_at: testRun.created_at,
      stages: stageResults,
      final_clusters: testRun.final_clusters,
      summary: testRun.summary,
    });

  } catch (error: any) {
    console.error('❌ Failed to fetch latest test run:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'fetch_failed',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

