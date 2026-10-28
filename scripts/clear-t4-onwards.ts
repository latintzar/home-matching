/**
 * Clear records from T4 onwards for a specific listing
 * T4 onwards includes: T4, T5, T5.5, T6, T6.5, and all R pipeline steps
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

async function clearT4Onwards(listingId: string) {
  console.log(`🧹 Clearing T4 onwards for listing ${listingId}`);

  const listingIdStr = listingId.toString();
  const listingIdNum = parseInt(listingId, 10);

  // Tables to clear (T4 onwards)
  const tables = [
    // T4: Decide Elements
    { name: 'e2_tier_target_states', key: 'listing_id', type: 'string' },
    // T5: Cohesion
    { name: 'cohesion_notes', key: 'listing_id', type: 'string' },
    // Phase 5: Renovation Pipeline (I, J, K, L, M, N)
    { name: 'renovation_scope_reports', key: 'listing_id', type: 'number' },
    { name: 'renovation_pricing_reports', key: 'listing_id', type: 'number' },
    { name: 'renovation_timeline_reports', key: 'listing_id', type: 'number' },
    { name: 'renovation_permits_reports', key: 'listing_id', type: 'number' },
    { name: 'final_renovation_scope', key: 'listing_id', type: 'number' },
    // T6: Budget Calibration
    { name: 'tier_budget_calibration', key: 'listing_id', type: 'string' },
    { name: 'final_renovation_scope_calibrated', key: 'listing_id', type: 'string' },
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
  clearT4Onwards(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-t4-onwards.ts <listing_id>');
  process.exit(1);
}

