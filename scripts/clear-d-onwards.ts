/**
 * Clear records from D (Auto Photo Clustering) onwards for a specific listing
 * D onwards includes: D, F3, RoomByRoom, G, H, T1, T1.5, T2, T2.5, TierElementSynthesis, I, J, K, L, M, N, T6, F0, R1, R1.5, R2a, R2b, R3
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

async function clearDOnwards(listingId: string) {
  console.log(`🧹 Clearing D (Auto Photo Clustering) onwards for listing ${listingId}`);

  const listingIdStr = listingId.toString();
  const listingIdNum = parseInt(listingId, 10);

  // Tables to clear (D onwards)
  const tables = [
    // D: Auto Photo Clustering
    { name: 'clusters', key: 'listing_id', type: 'number' },
    { name: 'auto_photo_clusters', key: 'listing_id', type: 'string' },
    { name: 'auto_clustering_test_runs', key: 'listing_id', type: 'string' },
    
    // F3: Whole-Property Analysis
    { name: 'whole_property_analysis', key: 'listing_id', type: 'string' },
    
    // RoomByRoom: Room Analyses
    { name: 'room_analyses', key: 'listing_id', type: 'number' },
    
    // G: Analysis Google Search
    { name: 'analysis_search_results', key: 'listing_id', type: 'string' },
    { name: 'analysis_curated_results', key: 'listing_id', type: 'string' },
    
    // H: Integrated Diagnostic
    // Note: text_analysis_results uses phase column, we'll clear specific phases
    
    // T1: Group & Catalog
    { name: 'room_families', key: 'listing_id', type: 'string' },
    
    // T1.5: Tier Budgeting
    { name: 'tier_budgets', key: 'listing_id', type: 'string' },
    
    // T2: Tier Ideation
    { name: 'tier_philosophies', key: 'listing_id', type: 'string' },
    
    // T2.5: Tier Style Direction
    { name: 'style_direction', key: 'listing_id', type: 'string' },
    
    // TierElementSynthesis: Consolidated T3-T6.5
    { name: 'tier_element_synthesis', key: 'listing_id', type: 'string' },
    { name: 'e2_tier_target_states', key: 'listing_id', type: 'string' },
    { name: 'group_tier_directives', key: 'listing_id', type: 'string' },
    { name: 'cohesion_notes', key: 'listing_id', type: 'string' },
    
    // I: Seed Scope from Tiers
    { name: 'renovation_scope_reports', key: 'listing_id', type: 'string' },
    
    // J: Renovation Google Search
    { name: 'renovation_google_search_results', key: 'listing_id', type: 'string' },
    { name: 'renovation_research_results', key: 'listing_id', type: 'number' },
    { name: 'renovation_search_results', key: 'listing_id', type: 'string' },
    
    // K: Pricing
    { name: 'renovation_pricing', key: 'listing_id', type: 'string' },
    { name: 'renovation_pricing_reports', key: 'listing_id', type: 'number' },
    
    // L: Timeline
    { name: 'renovation_timeline', key: 'listing_id', type: 'string' },
    { name: 'renovation_timeline_reports', key: 'listing_id', type: 'number' },
    
    // M: Permits
    { name: 'renovation_permits', key: 'listing_id', type: 'string' },
    { name: 'renovation_permits_reports', key: 'listing_id', type: 'number' },
    
    // N: Finalize Tiers
    { name: 'final_renovation_scope', key: 'listing_id', type: 'string' },
    
    // T6: Budget Calibration
    { name: 'tier_budget_calibration', key: 'listing_id', type: 'string' },
    { name: 'final_renovation_scope_calibrated', key: 'listing_id', type: 'string' },
    
    // F0: Furniture Removal
    { name: 'listing_photos_furniture_free', key: 'listing_id', type: 'string' },
    
    // R1.5: OMSRIA
    { name: 'omsria_processed_images', key: 'listing_id', type: 'string' },
    
    // R2a: Describe Room Images
    { name: 'room_image_descriptions', key: 'listing_id', type: 'string' },
    
    // R2b: Generate Room Prompts
    { name: 'renovation_prompts', key: 'listing_id', type: 'string' },
    { name: 'master_reference_images', key: 'listing_id', type: 'string' },
    
    // R3: Render Rooms
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
      // Check if it's a "table doesn't exist" error - skip silently
      if (error.message.includes('does not exist') || error.message.includes('Could not find the table')) {
        console.log(`ℹ️  Table ${table.name} does not exist, skipping`);
      } else {
        console.error(`❌ Error deleting from ${table.name}:`, error.message);
      }
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

  // Clear specific phases from text_analysis_results (G and H outputs)
  const phasesToClear = ['analysis_google_search', 'integrated_diagnostic', 'smart_m2'];
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
      }
    }
  }

  // Clear selected_photo_url from clusters (R1 output)
  const { data: clusters, error: clustersError } = await supabase
    .from('clusters')
    .select('id')
    .eq('listing_id', listingIdNum);

  if (!clustersError && clusters && clusters.length > 0) {
    const { error: updateError } = await supabase
      .from('clusters')
      .update({ selected_photo_url: null })
      .eq('listing_id', listingIdNum);

    if (updateError) {
      console.error(`❌ Error clearing selected_photo_url:`, updateError.message);
    } else {
      console.log(`✅ Cleared selected_photo_url from ${clusters.length} cluster(s)`);
    }
  }

  console.log(`\n✨ Done! Total records deleted: ${totalDeleted}`);
  return totalDeleted;
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  clearDOnwards(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-d-onwards.ts <listing_id>');
  process.exit(1);
}

