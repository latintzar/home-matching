/**
 * Promotion Endpoint: Auto → Production Clusters
 * 
 * Promotes auto-clustering results (Stages 0-5) to clusters table (production).
 * This makes auto-clustering results available to downstream steps (Stage R, OMSRIA, etc.)
 * that read from clusters.
 * 
 * Note: Endpoint name "promote-auto-to-manual" is kept for backward compatibility.
 * It actually promotes to "clusters" table (renamed from manual_photo_clusters).
 * 
 * Responsibilities:
 * 1. Fetch latest auto_clustering_test_runs for listing
 * 2. Extract Stage 5 refined clusters and Stage 4 visibility mappings
 * 3. Map photo_indices → photo_urls
 * 4. Store Stage 4 visibility format directly (no ID conversion)
 * 5. Insert/update clusters with visibility_mappings and cluster_adjacency
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

interface RefinedCluster {
  cluster_name: string;
  photo_indices: number[];
  source_stage?: string;
  merged_from?: string[];
  reasoning?: string;
}

interface VisibilityMapping {
  photo_index: number;
  photo_url: string;
  cluster_name: string;
  visible_clusters: string[];
  visibility_details?: Array<{
    cluster_name: string;
    visible_from: string;
    confidence: number;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { force }: { force?: boolean } = body;

    console.log(`🔄 Promoting auto-clustering results to clusters for listing ${listingId}`);

    // 1. Fetch latest auto_clustering_test_runs for this listing
    const { data: testRuns, error: testRunsError } = await supabase
      .from('auto_clustering_test_runs')
      .select('id, stage4_result, stage5_result, final_clusters')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (testRunsError) {
      throw new Error(`Failed to fetch test runs: ${testRunsError.message}`);
    }

    if (!testRuns || testRuns.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_test_run',
          details: 'No auto-clustering test run found for this listing. Please run the auto-clustering pipeline first.'
        },
        { status: 404 }
      );
    }

    const latestRun = testRuns[0];
    console.log(`📋 Using test run: ${latestRun.id}`);

    // 2. Extract Stage 5 refined clusters (preferred) or fall back to final_clusters
    let refinedClusters: RefinedCluster[] = [];
    
    if (latestRun.stage5_result?.refined_clusters) {
      refinedClusters = latestRun.stage5_result.refined_clusters;
      console.log(`✅ Using Stage 5 refined clusters: ${refinedClusters.length} clusters`);
    } else if (latestRun.final_clusters) {
      refinedClusters = latestRun.final_clusters.map((fc: any) => ({
        cluster_name: fc.cluster_name,
        photo_indices: fc.photo_indices,
        source_stage: 'final',
      }));
      console.log(`⚠️ Stage 5 not available, using final_clusters: ${refinedClusters.length} clusters`);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'no_clusters',
          details: 'No clusters found in test run. Stage 5 or final_clusters required.'
        },
        { status: 400 }
      );
    }

    // 3. Extract Stage 4 visibility mappings and cluster adjacency
    const stage4Result = latestRun.stage4_result as { 
      visibility_mappings?: VisibilityMapping[];
      cluster_adjacency?: Record<string, string[]>;
    } | null;
    const visibilityMappings = stage4Result?.visibility_mappings || [];
    const clusterAdjacency = stage4Result?.cluster_adjacency || {};
    console.log(`👁️ Found ${visibilityMappings.length} visibility mappings and ${Object.keys(clusterAdjacency).length} cluster adjacencies from Stage 4`);

    // 4. Fetch photos to map indices to URLs
    const { data: photos, error: photosError } = await supabase
      .from('listing_photos')
      .select('url, display_order')
      .eq('listing_id', listingId)
      .order('display_order');

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_photos',
          details: 'No photos found for this listing'
        },
        { status: 400 }
      );
    }

    // Build index → URL map
    const indexToUrl = new Map<number, string>();
    photos.forEach((photo, idx) => {
      indexToUrl.set(idx, photo.url);
    });

    // 5. Process each refined cluster (skip excluded clusters)
    const clustersToPromote: Array<{
      listing_id: number;
      cluster_name: string;
      photo_urls: string[];
      display_order: number;
      visibility_mappings: {
        visibility_mappings: Array<{
          photo_url: string;
          cluster_name: string;
          visible_clusters: string[];
          visibility_details?: Array<{
            cluster_name: string;
            visible_from: string;
            confidence: number;
          }>;
        }>;
        cluster_adjacency: Record<string, string[]>;
      };
    }> = [];

    for (let i = 0; i < refinedClusters.length; i++) {
      const cluster = refinedClusters[i];
      
      // Skip excluded clusters (they start with "excluded -")
      if (cluster.cluster_name.toLowerCase().startsWith('excluded -')) {
        console.log(`⏭️  Skipping excluded cluster: ${cluster.cluster_name}`);
        continue;
      }

      // Map photo_indices to photo_urls
      const photoUrls: string[] = [];
      for (const idx of cluster.photo_indices) {
        const url = indexToUrl.get(idx);
        if (url) {
          photoUrls.push(url);
        }
      }

      if (photoUrls.length === 0) {
        console.warn(`⚠️ Skipping cluster ${cluster.cluster_name} - no valid photo URLs`);
        continue;
      }

      // Build visibility mappings for this cluster's photos (Stage 4 format)
      // Filter Stage 4 mappings to only include photos in this cluster
      const clusterVisibilityMappings = visibilityMappings
        .filter(vm => {
          const url = indexToUrl.get(vm.photo_index);
          return url && photoUrls.includes(url);
        })
        .map(vm => {
          const photoUrl = indexToUrl.get(vm.photo_index) || vm.photo_url;
          return {
            photo_url: photoUrl,
            cluster_name: vm.cluster_name,
            visible_clusters: vm.visible_clusters,
            visibility_details: vm.visibility_details || [],
          };
        });

      // Store Stage 4 format: {visibility_mappings: [...], cluster_adjacency: {...}}
      // Each cluster stores its own photo mappings + full adjacency graph
      clustersToPromote.push({
        listing_id: parseInt(listingId, 10),
        cluster_name: cluster.cluster_name,
        photo_urls: photoUrls,
        display_order: i,
        visibility_mappings: {
          visibility_mappings: clusterVisibilityMappings,
          cluster_adjacency: clusterAdjacency, // Full adjacency graph (shared across all clusters)
        },
      });
    }

    console.log(`📦 Prepared ${clustersToPromote.length} clusters for promotion`);

    // 7. Delete existing clusters for this listing (if force=true)
    if (force) {
      const listingIdNum = parseInt(listingId, 10);
      const { error: deleteError } = await supabase
        .from('clusters')
        .delete()
        .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`);

      if (deleteError) {
        console.warn(`⚠️ Failed to delete existing clusters: ${deleteError.message}`);
      } else {
        console.log(`🗑️  Deleted existing clusters (force=true)`);
      }
    }

    // 8. Insert/update clusters
    // Since there's no unique constraint on (listing_id, cluster_name), we'll:
    // - Delete existing clusters with same name (if any) when force=true
    // - Insert new clusters
    const upsertResults: Array<{ cluster_name: string; success: boolean; error?: string }> = [];

    for (const cluster of clustersToPromote) {
      try {
        // If force=true, delete any existing cluster with same name
        if (force) {
          const listingIdNum = parseInt(listingId, 10);
          const { error: deleteError } = await supabase
            .from('clusters')
            .delete()
            .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
            .eq('cluster_name', cluster.cluster_name);

          if (deleteError) {
            console.warn(`⚠️ Failed to delete existing cluster ${cluster.cluster_name}: ${deleteError.message}`);
          }
        }

        // Insert new cluster with Stage 4 format visibility mappings
        const { error: insertError } = await supabase
          .from('clusters')
          .insert({
            listing_id: cluster.listing_id,
            cluster_name: cluster.cluster_name,
            photo_urls: cluster.photo_urls,
            display_order: cluster.display_order,
            visibility_mappings: cluster.visibility_mappings, // Stage 4 format: {visibility_mappings: [...], cluster_adjacency: {...}}
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        upsertResults.push({ cluster_name: cluster.cluster_name, success: true });
      } catch (error: any) {
        console.error(`❌ Failed to promote cluster ${cluster.cluster_name}:`, error);
        upsertResults.push({
          cluster_name: cluster.cluster_name,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = upsertResults.filter(r => r.success).length;
    const errorCount = upsertResults.filter(r => !r.success).length;

    console.log(`✅ Promotion complete: ${successCount} clusters promoted, ${errorCount} errors`);

    return NextResponse.json({
      success: errorCount === 0,
      clusters_promoted: successCount,
      clusters_failed: errorCount,
      results: upsertResults,
      test_run_id: latestRun.id,
      message: `Promoted ${successCount} clusters to clusters`,
    });

  } catch (error: any) {
    console.error('❌ Promotion failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'promotion_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

