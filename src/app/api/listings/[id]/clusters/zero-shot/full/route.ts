/**
 * Zero-Shot Full Pipeline Endpoint
 * 
 * Production clustering pipeline:
 * 1. Run Gemini 3 zero-shot clustering (visual-priority, temp 0.7)
 * 2. Run Gemini 3 visibility mapping (Stage 4-style)
 * 3. Write directly to clusters table with visibility_mappings
 * 
 * This is the PRIMARY and ONLY auto-clustering method used by Basic Package orchestrator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runZeroShotGemini3 } from '@/lib/auto-clustering/zeroShotGemini3';
import { runVisibilityGemini3 } from '@/lib/auto-clustering/visibilityGemini3';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    const listingIdNum = parseInt(listingId, 10);

    console.log(`🎯 Starting zero-shot full pipeline for listing ${listingId}`);

    // Step 1: Run zero-shot clustering
    console.log(`📸 Step 1: Running Gemini 3 zero-shot clustering...`);
    const zeroShotResult = await runZeroShotGemini3({
      listingId,
      temperature: 0.7,
      promptVariant: 'visual-priority',
    });

    const finalClusters = zeroShotResult.clusters;
    console.log(`✅ Zero-shot clustering complete: ${finalClusters.length} clusters`);

    // Step 2: Run visibility mapping
    console.log(`👁️ Step 2: Running Gemini 3 visibility mapping...`);
    const visibilityResult = await runVisibilityGemini3({
      listingId,
      final_clusters: finalClusters.map(c => ({
        cluster_name: c.cluster_name,
        photo_indices: c.photo_indices,
      })),
    });

    console.log(`✅ Visibility mapping complete: ${visibilityResult.visibility_mappings.length} mappings`);

    // Step 3: Use photo URLs mapping from shared helper
    // The shared helper returns photo_urls array that maps imageParts index to URL
    const photoUrls = zeroShotResult.photo_urls || [];
    const photoIndicesMapping = zeroShotResult.photo_indices_mapping || [];
    
    // Build index → URL map for visibility mappings (which use original photo indices)
    const indexToUrl = new Map<number, string>();
    photoIndicesMapping.forEach((originalIdx, imagePartsIdx) => {
      const url = photoUrls[imagePartsIdx];
      if (url) {
        indexToUrl.set(originalIdx, url);
      }
    });

    // Step 4: Delete existing clusters for this listing
    const { count: existingCount } = await supabase
      .from('clusters')
      .select('*', { count: 'exact', head: true })
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`);

    console.log(`🗑️ Deleting ${existingCount || 0} existing clusters for listing ${listingId}`);

    const { error: deleteError } = await supabase
      .from('clusters')
      .delete()
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`);

    if (deleteError) {
      throw new Error(`Failed to delete existing clusters: ${deleteError.message}`);
    }

    console.log(`✅ Deleted existing clusters`);

    // Step 5: Build cluster rows with visibility_mappings
    const clustersToInsert: Array<{
      listing_id: number;
      cluster_name: string;
      room_type: string;
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
      };
    }> = [];

    for (let i = 0; i < finalClusters.length; i++) {
      const cluster = finalClusters[i];

      // Skip excluded clusters
      if (cluster.cluster_name.toLowerCase().startsWith('excluded -')) {
        continue;
      }

      // Map photo_indices to photo_urls
      // photo_indices from Gemini reference imageParts array positions (0, 1, 2...)
      // Use the photo_urls array from shared helper to map them
      const clusterPhotoUrls: string[] = [];
      for (const imagePartsIdx of cluster.photo_indices) {
        const url = photoUrls[imagePartsIdx];
        if (url) {
          clusterPhotoUrls.push(url);
        }
      }

      if (clusterPhotoUrls.length === 0) {
        console.warn(`⚠️ Skipping cluster ${cluster.cluster_name} - no valid photo URLs`);
        continue;
      }

      // Build visibility mappings for this cluster's photos (Stage 4 format)
      // visibility_mappings use original photo indices, so use indexToUrl map
      const clusterVisibilityMappings = visibilityResult.visibility_mappings
        .filter(vm => {
          const url = indexToUrl.get(vm.photo_index);
          return url && clusterPhotoUrls.includes(url);
        })
        .map(vm => {
          const photoUrl = indexToUrl.get(vm.photo_index) || vm.photo_url || '';
          return {
            photo_url: photoUrl,
            cluster_name: vm.cluster_name,
            visible_clusters: vm.visible_clusters,
            visibility_details: vm.visibility_details || [],
          };
        });

      // Derive room_type (for now same as cluster_name)
      const roomType = cluster.cluster_name || 'Espacio';

      clustersToInsert.push({
        listing_id: listingIdNum,
        cluster_name: cluster.cluster_name,
        room_type: roomType,
        photo_urls: clusterPhotoUrls,
        display_order: i,
        visibility_mappings: {
          visibility_mappings: clusterVisibilityMappings,
        },
      });
    }

    // Step 6: Insert clusters into production table
    console.log(`💾 Inserting ${clustersToInsert.length} clusters into production table...`);
    const { error: insertError } = await supabase
      .from('clusters')
      .insert(clustersToInsert);

    if (insertError) {
      throw new Error(`Failed to insert clusters: ${insertError.message}`);
    }

    console.log(`✅ Clusters written to production: ${clustersToInsert.length} clusters`);

    return NextResponse.json({
      success: true,
      listing_id: listingId,
      clusters_count: clustersToInsert.length,
      visibility_mappings_count: visibilityResult.visibility_mappings.length,
      excluded_clusters_count: finalClusters.filter(c => 
        c.cluster_name.toLowerCase().startsWith('excluded -')
      ).length,
      result: {
        clusters: finalClusters,
        visibility_mappings: visibilityResult.visibility_mappings,
      },
    });

  } catch (error: any) {
    console.error('❌ Zero-shot full pipeline failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'zero_shot_full_pipeline_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
        full_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      },
      { status: 500 }
    );
  }
}

