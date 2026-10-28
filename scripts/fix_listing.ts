
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixListing() {
  const listingId = '1000000138';
  console.log(`Fixing ${listingId}...`);

  const { error } = await supabase
    .from('listings')
    .update({ 
      lat: 41.398, 
      lng: 2.180 
    })
    .eq('id', listingId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Fixed coordinates.');
  }
}

fixListing();

