import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function saveStageResult(
  listingId: string,
  stageName: string,
  stageResult: any
) {
  try {
    // Get or create test run ID for this listing
    const { data: existingRun } = await supabase
      .from('auto_clustering_test_runs')
      .select('id')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const testRunId = existingRun?.id || randomUUID();

    // Build update data
    const updateData: any = {
      id: testRunId,
      listing_id: listingId,
      [`${stageName}_result`]: stageResult,
    };

    if (!existingRun) {
      // First stage - create new test run
      updateData.created_at = new Date().toISOString();
      updateData.test_type = 'full';
      updateData.success = true;
    }

    const { error } = await supabase
      .from('auto_clustering_test_runs')
      .upsert(updateData, { onConflict: 'id' });

    if (error) {
      console.warn(`⚠️ Failed to save ${stageName} result:`, error.message);
      return { success: false, error: error.message };
    } else {
      console.log(`✅ Saved ${stageName} result to test run ${testRunId}`);
      return { success: true, test_run_id: testRunId };
    }
  } catch (error: any) {
    console.error(`❌ Error saving ${stageName} result:`, error);
    return { success: false, error: error.message };
  }
}

