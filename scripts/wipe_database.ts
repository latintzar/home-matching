
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function wipeDatabase() {
  console.log('🚨 STARTING COMPLETE DATABASE WIPE (Listings)...');

  // Delete all listings
  // The CASCADE rules in Postgres (if set up correctly) should handle related tables:
  // - listing_photos
  // - text_analysis_results
  // - photo_analysis_results
  // - deepdives
  // - intelligent_consideraciones
  // - etc.
  
  const { count: total, error: countError } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting listings:', countError);
    return;
  }

  console.log(`Found ${total} listings to delete.`);

  if (total === 0) {
    console.log('Database already clean.');
    return;
  }

  // Delete in batches to avoid timeouts
  let deletedCount = 0;
  
  while (true) {
    // Get a batch of IDs
    const { data: batch } = await supabase
        .from('listings')
        .select('id')
        .limit(50);
        
    if (!batch || batch.length === 0) break;
    
    const ids = batch.map(b => b.id);
    
    const { error: delError } = await supabase
        .from('listings')
        .delete()
        .in('id', ids);
        
    if (delError) {
        console.error('❌ Error deleting batch:', delError);
        break;
    }
    
    deletedCount += ids.length;
    console.log(`   Deleted ${deletedCount}/${total} listings...`);
  }

  console.log('✨ Database wipe complete.');
}

wipeDatabase();

