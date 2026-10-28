/**
 * Clear OMSRIA and F0 records and storage files for a specific listing
 * Clears:
 * - OMSRIA: omsria_processed_images table + {listingId}/omsria/* storage files
 * - F0: listing_photos_furniture_free table + {listingId}/furniture-free/* storage files
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

async function clearOmsriaAndF0(listingId: string) {
  console.log(`🧹 Clearing OMSRIA and F0 records and storage files for listing ${listingId}\n`);

  const listingIdStr = listingId.toString();

  // 1. Clear OMSRIA database records
  console.log(`📊 Clearing OMSRIA database records...`);
  const { data: omsriaData, error: omsriaError } = await supabase
    .from('omsria_processed_images')
    .delete()
    .eq('listing_id', listingIdStr)
    .select();

  if (omsriaError) {
    console.error(`❌ Error deleting OMSRIA records:`, omsriaError.message);
  } else {
    const omsriaCount = omsriaData?.length || 0;
    console.log(`✅ Deleted ${omsriaCount} OMSRIA record(s)`);
  }

  // 2. Clear F0 database records
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

  // 3. Delete OMSRIA storage files
  console.log(`\n🗂️  Deleting OMSRIA storage files...`);
  const omsriaPrefix = `${listingIdStr}/omsria/`;
  
  // List all files in the omsria folder
  const { data: omsriaFiles, error: omsriaListError } = await supabase
    .storage
    .from('property-images')
    .list(omsriaPrefix, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (omsriaListError) {
    console.error(`❌ Error listing OMSRIA files:`, omsriaListError.message);
  } else if (omsriaFiles && omsriaFiles.length > 0) {
    // Build list of file paths to delete
    const filesToDelete = omsriaFiles.map(file => `${omsriaPrefix}${file.name}`);
    
    const { data: deleteData, error: deleteError } = await supabase
      .storage
      .from('property-images')
      .remove(filesToDelete);

    if (deleteError) {
      console.error(`❌ Error deleting OMSRIA files:`, deleteError.message);
    } else {
      console.log(`✅ Deleted ${filesToDelete.length} OMSRIA file(s)`);
      if (deleteData && deleteData.length > 0) {
        console.log(`   Files: ${deleteData.join(', ')}`);
      }
    }
  } else {
    console.log(`ℹ️  No OMSRIA files found in storage`);
  }

  // 4. Delete F0 storage files
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

  console.log(`\n✨ Done! OMSRIA and F0 records and storage files cleared.`);
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  clearOmsriaAndF0(listingId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/clear-omsria-f0.ts <listing_id>');
  process.exit(1);
}

