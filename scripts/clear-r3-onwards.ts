/**
 * Clear records from R3 onwards for a specific listing
 * R3 onwards includes: R3, R4, R5-Master, R5, R6
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

async function clearR3Onwards(listingId: string) {
  console.log(`🧹 Clearing R3 onwards for listing ${listingId}`);

  const listingIdStr = listingId.toString();
  const listingIdNum = parseInt(listingId, 10);

  // Tables to clear (R3 onwards)
  const tables = [
    // R3: Render Rooms
    { name: 'after_photos', key: 'listing_id', type: 'number' },
    // R4: Consistency Pass (if exists)
    // R5-Master: Generate Furniture Master References (if exists)
    // R5: Add Furniture (if exists)
    // R6: Consistency Pass Furniture (if exists)
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

  console.log(`\n✨ Done! Total records deleted: ${totalDeleted}`);
  return totalDeleted;
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  clearR3Onwards(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-r3-onwards.ts <listing_id>');
  process.exit(1);
}

