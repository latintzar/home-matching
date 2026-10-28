/**
 * Clear curation results (renovation_research_results) for a listing
 * Keeps search results (renovation_search_results) intact
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function clearCurationResults(listingId: string) {
  console.log(`🗑️  Clearing curation results for listing ${listingId}...`);

  const listingIdNum = parseInt(listingId, 10);
  
  // Delete from renovation_research_results (curation results)
  const { error: deleteError, count } = await supabase
    .from('renovation_research_results')
    .delete()
    .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
    .select('*', { count: 'exact', head: true });

  if (deleteError) {
    console.error('❌ Error clearing curation results:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Cleared curation results for listing ${listingId}`);
  console.log(`   (Search results in renovation_search_results are preserved)`);
}

const listingId = process.argv[2];
if (!listingId) {
  console.error('Usage: tsx scripts/clear-curation-results.ts <listing_id>');
  process.exit(1);
}

clearCurationResults(listingId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

