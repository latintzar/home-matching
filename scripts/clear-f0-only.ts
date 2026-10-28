/**
 * Clear ONLY F0 records and storage files (not OMSRIA)
 * Useful when you want to rerun F0 without regenerating OMSRIA
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

async function clearF0Only(listingId: string) {
  console.log(`🧹 Clearing F0 records and storage files (only) for listing ${listingId}\n`);

  const listingIdStr = listingId.toString();

  // 1. Clear F0 database records
  console.log(`📊 Clearing F0 database records...`);
  const { data: f0Data, error: f0Error } = await supabase
    .from('listing_photos_furniture_free')
    .delete()
    .eq('listing_id', listingIdStr)
    .select();

  if (f0Error) {
    console.error(`❌ Error deleting F0 records:`, f0Error.message);
  } else {
    const f0Count = f0Data?.length || 0;
    console.log(`✅ Deleted ${f0Count} F0 record(s)`);
  }

  // 2. Delete F0 storage files
  console.log(`\n🗂️  Deleting F0 storage files...`);
  const f0Prefix = `${listingIdStr}/furniture-free/`;
  
  // List all files in the furniture-free folder
  const { data: f0Files, error: f0ListError } = await supabase
    .storage
    .from('property-images')
    .list(f0Prefix, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (f0ListError) {
    console.error(`❌ Error listing F0 files:`, f0ListError.message);
  } else if (f0Files && f0Files.length > 0) {
    // Build list of file paths to delete
    const filesToDelete = f0Files.map(file => `${f0Prefix}${file.name}`);
    
    const { data: deleteData, error: deleteError } = await supabase
      .storage
      .from('property-images')
      .remove(filesToDelete);

    if (deleteError) {
      console.error(`❌ Error deleting F0 files:`, deleteError.message);
    } else {
      console.log(`✅ Deleted ${filesToDelete.length} F0 file(s)`);
      if (deleteData && deleteData.length > 0) {
        console.log(`   Files: ${deleteData.join(', ')}`);
      }
    }
  } else {
    console.log(`ℹ️  No F0 files found in storage`);
  }

  console.log(`\n✨ Done! F0 records and storage files cleared.`);
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  clearF0Only(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-f0-only.ts <listing_id>');
  process.exit(1);
}

