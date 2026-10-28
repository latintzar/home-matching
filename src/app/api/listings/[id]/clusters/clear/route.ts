import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  
  try {
    const listingIdNum = parseInt(listingId, 10);
    const isNumeric = !isNaN(listingIdNum);
    
    // Delete from clusters table (production)
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
      throw new Error(`Failed to delete clusters: ${deleteError.message}`);
    }
    
    // Also clear debug test tables
    const { error: testClustersError, count: testClustersCount } = await supabase
      .from('auto_photo_clusters')
      .delete({ count: 'exact' })
      .eq('listing_id', listingId);
    
    const { error: testRunsError, count: testRunsCount } = await supabase
      .from('auto_clustering_test_runs')
      .delete({ count: 'exact' })
      .eq('listing_id', listingId);
    
    return NextResponse.json({
      success: true,
      deleted: {
        clusters: deletedCount || 0,
        test_clusters: testClustersCount || 0,
        test_runs: testRunsCount || 0,
      },
      message: `Cleared ${deletedCount || 0} production clusters, ${testClustersCount || 0} test clusters, and ${testRunsCount || 0} test runs`,
    });
    
  } catch (error: any) {
    console.error('❌ Failed to clear clusters:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to clear clusters',
      },
      { status: 500 }
    );
  }
}

