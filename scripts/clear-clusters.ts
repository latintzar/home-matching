import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function clearClusters(listingId: string) {
  console.log(`🧹 Clearing all clusters for listing ${listingId}`);
  
  const listingIdNum = parseInt(listingId, 10);
  const isNumeric = !isNaN(listingIdNum);
  
  // Delete from clusters table
  let deleteQuery = supabase
    .from('clusters')
    .delete({ count: 'exact' });
  
  if (isNumeric) {
    deleteQuery = deleteQuery.or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`);
  } else {
    deleteQuery = deleteQuery.eq('listing_id', listingId);
  }
  
  const { error: deleteError, count: deletedCount } = await deleteQuery;
  
  if (deleteError) {
    console.error(`❌ Error deleting clusters: ${deleteError.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Deleted ${deletedCount || 0} cluster(s) from clusters table`);
  
  // Also clear debug test tables
  const { error: testClustersError, count: testClustersCount } = await supabase
    .from('auto_photo_clusters')
    .delete({ count: 'exact' })
    .eq('listing_id', listingId);
  
  if (testClustersError) {
    console.warn(`⚠️ Warning deleting test clusters: ${testClustersError.message}`);
  } else {
    console.log(`✅ Deleted ${testClustersCount || 0} cluster(s) from auto_photo_clusters table`);
  }
  
  const { error: testRunsError, count: testRunsCount } = await supabase
    .from('auto_clustering_test_runs')
    .delete({ count: 'exact' })
    .eq('listing_id', listingId);
  
  if (testRunsError) {
    console.warn(`⚠️ Warning deleting test runs: ${testRunsError.message}`);
  } else {
    console.log(`✅ Deleted ${testRunsCount || 0} test run(s) from auto_clustering_test_runs table`);
  }
  
  console.log(`\n✨ Done! All clusters cleared for listing ${listingId}`);
}

const listingId = process.argv[2];
if (!listingId) {
  console.error('Usage: tsx scripts/clear-clusters.ts <listing_id>');
  process.exit(1);
}

clearClusters(listingId).catch(console.error);

