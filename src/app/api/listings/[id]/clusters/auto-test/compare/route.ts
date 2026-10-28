/**
 * Compare Auto Test Clusters vs Production Clusters
 * 
 * Shows side-by-side comparison of auto test clusters vs production clusters.
 * Useful for debugging/testing auto-clustering before it becomes production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const testRunId = searchParams.get('test_run_id');

    console.log(`🔍 Comparing auto test clusters vs production clusters for listing ${listingId}`);

    // Get latest auto clusters if no test_run_id specified
    let autoQuery = supabase
      .from('auto_photo_clusters')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order');

    if (testRunId) {
      autoQuery = autoQuery.eq('test_run_id', testRunId);
    } else {
      // Get latest test run
      const { data: latestRun } = await supabase
        .from('auto_clustering_test_runs')
        .select('id')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestRun) {
        autoQuery = autoQuery.eq('test_run_id', latestRun.id);
      }
    }

    const { data: autoClusters, error: autoError } = await autoQuery;

    if (autoError) {
      throw new Error(`Failed to fetch auto clusters: ${autoError.message}`);
    }

    // Get production clusters
    const { data: productionClusters, error: productionError } = await supabase
      .from('clusters')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order');

    if (productionError) {
      throw new Error(`Failed to fetch production clusters: ${productionError.message}`);
    }

    // Build comparison
    const autoPhotoSet = new Set<string>();
    const productionPhotoSet = new Set<string>();

    (autoClusters || []).forEach((c: any) => {
      (c.photo_urls || []).forEach((url: string) => autoPhotoSet.add(url));
    });

    (productionClusters || []).forEach((c: any) => {
      (c.photo_urls || []).forEach((url: string) => productionPhotoSet.add(url));
    });

    // Find overlapping photos
    const overlappingPhotos = Array.from(autoPhotoSet).filter(url => productionPhotoSet.has(url));
    const autoOnlyPhotos = Array.from(autoPhotoSet).filter(url => !productionPhotoSet.has(url));
    const productionOnlyPhotos = Array.from(productionPhotoSet).filter(url => !autoPhotoSet.has(url));

    // Cluster name matching (fuzzy)
    const clusterMatches: Array<{
      auto_cluster: string;
      production_cluster: string | null;
      auto_photos: number;
      production_photos: number;
      overlap: number;
      similarity: number;
    }> = [];

    (autoClusters || []).forEach((autoCluster: any) => {
      const autoName = (autoCluster.cluster_name || '').toLowerCase();
      const autoUrls = new Set(autoCluster.photo_urls || []);
      
      // Find best matching production cluster
      let bestMatch: any = null;
      let bestOverlap = 0;
      let bestSimilarity = 0;

      (productionClusters || []).forEach((productionCluster: any) => {
        const productionName = (productionCluster.cluster_name || '').toLowerCase();
        const productionUrls = new Set(productionCluster.photo_urls || []);
        
        // Calculate overlap
        const overlap = Array.from(autoUrls).filter(url => productionUrls.has(url)).length;
        const total = Math.max(autoUrls.size, productionUrls.size);
        const similarity = total > 0 ? overlap / total : 0;

        // Name similarity (simple)
        const nameSimilarity = autoName === productionName ? 1.0 : 
          (autoName.includes(productionName) || productionName.includes(autoName) ? 0.5 : 0);

        const combinedSimilarity = (similarity * 0.7) + (nameSimilarity * 0.3);

        if (combinedSimilarity > bestSimilarity) {
          bestMatch = productionCluster;
          bestOverlap = overlap;
          bestSimilarity = combinedSimilarity;
        }
      });

      clusterMatches.push({
        auto_cluster: autoCluster.cluster_name,
        production_cluster: bestMatch?.cluster_name || null,
        auto_photos: autoUrls.size,
        production_photos: bestMatch ? new Set(bestMatch.photo_urls || []).size : 0,
        overlap: bestOverlap,
        similarity: bestSimilarity,
      });
    });

    return NextResponse.json({
      success: true,
      listing_id: listingId,
      test_run_id: testRunId || 'latest',
      comparison: {
        auto_clusters_count: autoClusters?.length || 0,
        production_clusters_count: productionClusters?.length || 0,
        auto_photos_count: autoPhotoSet.size,
        production_photos_count: productionPhotoSet.size,
        overlapping_photos_count: overlappingPhotos.length,
        auto_only_photos_count: autoOnlyPhotos.length,
        production_only_photos_count: productionOnlyPhotos.length,
        overlap_percentage: autoPhotoSet.size > 0 
          ? (overlappingPhotos.length / autoPhotoSet.size * 100).toFixed(1) 
          : '0.0',
      },
      cluster_matches: clusterMatches,
      auto_clusters: autoClusters || [],
      production_clusters: productionClusters || [],
    });

  } catch (error: any) {
    console.error('❌ Failed to compare clusters:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'compare_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

