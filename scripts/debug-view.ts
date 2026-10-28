
import { config } from 'dotenv';
import { resolve } from 'path';
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testView() {
  console.log('Testing clusters_normalized view directly...');
  
  const { data, error } = await supabase
    .from('clusters_normalized')
    .select('*')
    .eq('listing_id', 1000000121)
    .limit(1);

  if (error) {
    console.error('❌ Error querying view:', error);
  } else {
    console.log('✅ View query successful:', data?.length, 'rows');
  }

  console.log('\nTesting normalize_visibility_mappings function...');
  // Fetch raw data to test function call manually if possible (via RPC if exposed, or just infer)
  const { data: clusters } = await supabase
    .from('clusters')
    .select('id, listing_id, visibility_mappings')
    .eq('listing_id', 1000000121)
    .limit(1);

  if (clusters && clusters.length > 0) {
    console.log('Cluster ID:', clusters[0].id);
    console.log('Listing ID:', clusters[0].listing_id);
    console.log('Visibility Mappings Type:', typeof clusters[0].visibility_mappings);
  }
}

testView().catch(console.error);

