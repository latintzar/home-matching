
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

console.log('URL:', SUPABASE_URL);
// console.log('KEY:', SUPABASE_SERVICE_KEY); // Don't log key

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugListing() {
  const listingId = '1000000138';
  console.log(`Fetching ${listingId}...`);

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Found:', data);
  }
}

debugListing();

