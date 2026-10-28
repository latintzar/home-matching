/**
 * Script to clear all photo analysis and downstream data for a listing
 * Clears from whole-property analysis step onwards
 */

import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

async function clearListingData(listingId: string) {
  console.log(`🧹 Clearing photo analysis and downstream data for listing ${listingId}...\n`);

  const listingIdNum = parseInt(listingId, 10);
  if (isNaN(listingIdNum)) {
    throw new Error(`Invalid listing ID: ${listingId}`);
  }

  const tables = [
    { name: 'whole_property_analysis', key: 'listing_id' },
    { name: 'room_analyses', key: 'listing_id' },
    { name: 'research_aggregated_results', key: 'listing_id' },
    { name: 'final_renovation_scope', key: 'listing_id' },
    { name: 'next_steps_reports', key: 'listing_id' },
    { name: 'renovation_pricing_reports', key: 'listing_id' },
    { name: 'renovation_timeline_reports', key: 'listing_id' },
    { name: 'renovation_permits_reports', key: 'listing_id' },
  ];

  // Also clear listing diagnostic analysis phases from text_analysis_results
  const textAnalysisPhases = ['listing_diagnostic', 'integrated_summary'];

  let totalDeleted = 0;

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table.name)
      .delete()
      .eq(table.key, listingIdNum)
      .select();

    if (error) {
      console.error(`❌ Error deleting from ${table.name}:`, error.message);
    } else {
      const count = data?.length || 0;
      totalDeleted += count;
      if (count > 0) {
        console.log(`✅ Deleted ${count} record(s) from ${table.name}`);
      } else {
        console.log(`ℹ️  No records found in ${table.name}`);
      }
    }
  }

  // Clear integrated analysis phases
  for (const phase of textAnalysisPhases) {
    const { data, error } = await supabase
      .from('text_analysis_results')
      .delete()
      .eq('listing_id', listingIdNum)
      .eq('phase', phase)
      .select();

    if (error) {
      console.error(`❌ Error deleting ${phase} from text_analysis_results:`, error.message);
    } else {
      const count = data?.length || 0;
      totalDeleted += count;
      if (count > 0) {
        console.log(`✅ Deleted ${count} record(s) from text_analysis_results (phase: ${phase})`);
      }
    }
  }

  console.log(`\n✨ Done! Total records deleted: ${totalDeleted}`);
  return totalDeleted;
}

// Run if called directly
if (require.main === module) {
  const listingId = process.argv[2];
  if (!listingId) {
    console.error('Usage: ts-node clear-listing-photo-analysis-downstream.ts <listing_id>');
    process.exit(1);
  }

  clearListingData(listingId)
    .then(() => {
      console.log('\n✅ Cleanup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { clearListingData };

