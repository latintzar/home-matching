/**
 * Clear records from T6 onwards for a specific listing
 * T6 onwards includes: T6, T6.5, and all R pipeline steps
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

async function clearT6Onwards(listingId: string) {
  console.log(`🧹 Clearing T6 onwards for listing ${listingId}`);

  const listingIdStr = listingId.toString();
  const listingIdNum = parseInt(listingId, 10);

  // Tables to clear (T6 onwards)
  const tables = [
    // T6: Budget Calibration
    { name: 'tier_budget_calibration', key: 'listing_id', type: 'string' },
    { name: 'final_renovation_scope_calibrated', key: 'listing_id', type: 'string' },
    // T6.5: Iterate Element Decisions (updates e2_tier_target_states, but we'll clear it)
    // Note: T6.5 updates e2_tier_target_states, but clearing it would also clear T4/T5.5 data
    // So we'll skip clearing e2_tier_target_states here - T6.5 will work with existing T4/T5.5 data
    // R pipeline
    { name: 'listing_photos_furniture_free', key: 'listing_id', type: 'string' },
    { name: 'room_image_descriptions', key: 'listing_id', type: 'string' },
    { name: 'master_reference_images', key: 'listing_id', type: 'string' },
    { name: 'renovation_prompts', key: 'listing_id', type: 'string' },
    { name: 'after_photos', key: 'listing_id', type: 'number' },
  ];

  let totalDeleted = 0;

  for (const table of tables) {
    const keyValue = table.type === 'string' ? listingIdStr : listingIdNum;
    
    const { data, error } = await supabase
      .from(table.name)
      .delete()
      .eq(table.key, keyValue)
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

  // Clear selected_photo_url from manual_photo_clusters (R1 output)
  const { data: clusters, error: clustersError } = await supabase
    .from('manual_photo_clusters')
    .select('id')
    .eq('listing_id', listingIdStr);

  if (!clustersError && clusters && clusters.length > 0) {
    for (const cluster of clusters) {
      const { error: updateError } = await supabase
        .from('manual_photo_clusters')
        .update({ selected_photo_url: null })
        .eq('id', cluster.id);

      if (updateError) {
        console.error(`❌ Error clearing selected_photo_url for cluster ${cluster.id}:`, updateError.message);
      }
    }
    console.log(`✅ Cleared selected_photo_url from ${clusters.length} cluster(s)`);
  }

  console.log(`\n✨ Done! Total records deleted: ${totalDeleted}`);
  return totalDeleted;
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  clearT6Onwards(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-t6-onwards.ts <listing_id>');
  process.exit(1);
}

