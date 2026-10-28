/**
 * Cleanup script to clear remaining records from D onwards
 * Handles text_analysis_results phases and renovation_search_results timeout
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupRemaining(listingId: string) {
  console.log(`🧹 Cleaning up remaining records for listing ${listingId}`);

  const listingIdStr = listingId.toString();

  // Clear specific phases from text_analysis_results
  const phasesToClear = ['analysis_google_search', 'integrated_diagnostic', 'smart_m2'];
  let totalDeleted = 0;

  for (const phase of phasesToClear) {
    const { data, error } = await supabase
      .from('text_analysis_results')
      .delete()
      .eq('listing_id', listingIdStr)
      .eq('phase', phase)
      .select();
    
    if (error) {
      console.error(`❌ Error deleting text_analysis_results (phase: ${phase}):`, error.message);
    } else {
      const count = data?.length || 0;
      totalDeleted += count;
      if (count > 0) {
        console.log(`✅ Deleted ${count} record(s) from text_analysis_results (phase: ${phase})`);
      } else {
        console.log(`ℹ️  No records found in text_analysis_results (phase: ${phase})`);
      }
    }
  }

  // Try to clear renovation_search_results in batches (it timed out before)
  console.log(`\n🔄 Attempting to clear renovation_search_results in batches...`);
  let batchDeleted = 0;
  let hasMore = true;
  const batchSize = 100;

  while (hasMore) {
    // Get a batch of IDs
    const { data: batch, error: fetchError } = await supabase
      .from('renovation_search_results')
      .select('id')
      .eq('listing_id', listingIdStr)
      .limit(batchSize);

    if (fetchError) {
      console.error(`❌ Error fetching batch:`, fetchError.message);
      break;
    }

    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    // Delete this batch
    const ids = batch.map(r => r.id);
    const { error: deleteError } = await supabase
      .from('renovation_search_results')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`❌ Error deleting batch:`, deleteError.message);
      break;
    }

    batchDeleted += batch.length;
    console.log(`✅ Deleted batch of ${batch.length} records (total: ${batchDeleted})`);

    // If we got fewer than batchSize, we're done
    if (batch.length < batchSize) {
      hasMore = false;
    }
  }

  totalDeleted += batchDeleted;

  console.log(`\n✨ Done! Total records deleted: ${totalDeleted}`);
  return totalDeleted;
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  cleanupRemaining(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-d-onwards-cleanup.ts <listing_id>');
  process.exit(1);
}

