import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, undefined, requireRecipientConfiguration);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    // Get clusters from clusters (single source of truth)
    // Handle both string and numeric listing_id
    const listingIdNum = parseInt(listingId, 10);
    const isNumeric = !isNaN(listingIdNum);

    // Get all clusters for this listing, ordered by created_at DESC, then display_order
    let clustersQuery = supabase
      .from('clusters')
      .select('*')
      .order('created_at', { ascending: false })
      .order('display_order', { ascending: true });

    if (isNumeric) {
      clustersQuery = clustersQuery.or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`);
    } else {
      clustersQuery = clustersQuery.eq('listing_id', listingId);
    }

    const { data: allClusters, error: clustersError } = await clustersQuery;

    if (clustersError) {
      throw new Error(`Failed to fetch clusters: ${clustersError.message}`);
    }

    // If no clusters exist, return empty array
    if (!allClusters || allClusters.length === 0) {
      return NextResponse.json({
        success: true,
        clusters: [],
        count: 0
      });
    }

    // Group clusters by rounded timestamp (to the nearest 2 seconds) to handle multiple runs
    // Pipeline runs typically create all clusters within a few seconds, so we group by 2-second windows
    const clustersByTime = new Map<string, typeof allClusters>();
    for (const cluster of allClusters) {
      // Round to nearest 2 seconds to group clusters from the same pipeline run
      const timestamp = new Date(cluster.created_at);
      const roundedTime = new Date(Math.floor(timestamp.getTime() / 2000) * 2000).toISOString();
      if (!clustersByTime.has(roundedTime)) {
        clustersByTime.set(roundedTime, []);
      }
      clustersByTime.get(roundedTime)!.push(cluster);
    }

    // Get the most recent timestamp group (should be the largest group, as latest run)
    const sortedTimes = Array.from(clustersByTime.keys()).sort().reverse();
    
    // Find the largest group (most clusters) among recent groups (within last 5 groups)
    // This handles cases where timestamps might be slightly off
    let largestGroup: typeof allClusters = [];
    let largestGroupTime = '';
    for (let i = 0; i < Math.min(5, sortedTimes.length); i++) {
      const time = sortedTimes[i];
      const group = clustersByTime.get(time) || [];
      if (group.length > largestGroup.length) {
        largestGroup = group;
        largestGroupTime = time;
      }
    }
    
    // If no large group found, use the most recent
    const clusters = largestGroup.length > 0 ? largestGroup : (clustersByTime.get(sortedTimes[0]) || []);
    
    // Sort by display_order within the group
    clusters.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Transform to match expected format (include visibility_mappings from Stage 4)
    const transformedClusters = clusters?.map((cluster: any) => ({
      id: cluster.id,
      cluster_name: cluster.cluster_name,
      display_order: cluster.display_order || 0,
      created_at: cluster.created_at,
      photos: cluster.photo_urls || [],
      visibility_mappings: cluster.visibility_mappings || null,
    })) || [];

    return NextResponse.json({
      success: true,
      clusters: transformedClusters,
      count: transformedClusters.length
    });

  } catch (error) {
    console.error('Clusters fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as any)?.message || 'Failed to fetch clusters' 
      },
      { status: 500 }
    );
  }
}
