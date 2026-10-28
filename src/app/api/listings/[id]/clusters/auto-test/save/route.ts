/**
 * Save Auto-Clustering Results to Test Table
 * 
 * Saves the results from auto-clustering pipeline to `auto_photo_clusters` table
 * so you can test and compare without affecting manual clusters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
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
    const { id: listingId } = await params;
    const body = await request.json();
    const { 
      final_clusters, 
      stages, 
      summary,
      test_type = 'full'
    } = body as {
      final_clusters?: Array<{ cluster_name: string; photo_indices: number[] }>;
      stages?: any;
      summary?: any;
      test_type?: string;
    };

    if (!final_clusters || final_clusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_clusters', details: 'final_clusters array is required' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving auto-clustering results for listing ${listingId}`);

    // Generate test run ID
    const testRunId = randomUUID();
    console.log(`📝 Test run ID: ${testRunId}`);

    // Fetch photos to get URLs from indices
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
        { success: false, error: 'no_photos', details: 'No photos found for this listing' },
        { status: 400 }
      );
    }

    // Build cluster records
    const clusterRecords: Array<{
      listing_id: string;
      cluster_name: string;
      room_type: string | null;
      photo_urls: string[];
      photo_indices: number[];
      display_order: number;
      source_stage: string | null;
      confidence: number | null;
      test_run_id: string;
    }> = [];

    for (let i = 0; i < final_clusters.length; i++) {
      const cluster = final_clusters[i];
      const photoUrls: string[] = [];
      
      for (const idx of cluster.photo_indices) {
        if (idx >= 0 && idx < photos.length) {
          photoUrls.push(photos[idx].url);
        }
      }

      if (photoUrls.length === 0) {
        console.warn(`⚠️ Skipping cluster ${cluster.cluster_name} - no valid photos`);
        continue;
      }

      // Try to determine source stage and confidence from stages data
      let sourceStage: string | null = null;
      let confidence: number | null = null;

      // Check if this cluster came from stage-2 (exemplar)
      if (stages?.stage2?.result?.selected_photos) {
        const exemplar = stages.stage2.result.selected_photos.find(
          (sp: any) => sp.space_name === cluster.cluster_name && 
                      cluster.photo_indices.includes(sp.photo_index)
        );
        if (exemplar) {
          sourceStage = 'stage-2';
          confidence = exemplar.confidence || null;
        }
      }

      // Check if this cluster came from stage-3 (matched)
      if (!sourceStage && stages?.stage3?.result?.matches) {
        const match = stages.stage3.result.matches.find(
          (m: any) => (m.cluster_name === cluster.cluster_name || m.new_cluster_name === cluster.cluster_name) &&
                      cluster.photo_indices.includes(m.photo_index)
        );
        if (match) {
          sourceStage = 'stage-3';
          confidence = match.confidence || null;
        }
      }

      clusterRecords.push({
        listing_id: listingId,
        cluster_name: cluster.cluster_name,
        room_type: cluster.cluster_name, // Use cluster name as room type for now
        photo_urls: photoUrls,
        photo_indices: cluster.photo_indices,
        display_order: i,
        source_stage: sourceStage,
        confidence: confidence,
        test_run_id: testRunId,
      });
    }

    console.log(`📦 Prepared ${clusterRecords.length} cluster records`);

    // Save clusters to test table
    const { error: insertError } = await supabase
      .from('auto_photo_clusters')
      .insert(clusterRecords);

    if (insertError) {
      throw new Error(`Failed to save clusters: ${insertError.message}`);
    }

    // Save test run metadata
    const { error: runError } = await supabase
      .from('auto_clustering_test_runs')
      .insert({
        id: testRunId,
        listing_id: listingId,
        test_type: test_type,
        space_set: stages?.stage1?.space_set || null,
        stage0a_result: stages?.stage0a || null, // Pair-graph: descriptors
        stage0b_result: stages?.stage0b || null, // Pair-graph: pair judgements
        stage0c_result: stages?.stage0c || null, // Pair-graph: graph clusters
        stage0d_result: stages?.stage0d || null, // Pair-graph: naming (replaces Super Stage 0)
        stage2_result: stages?.stage2?.result || null,
        stage3_result: stages?.stage3?.result || null,
        stage4_result: stages?.stage4?.result || null,
        stage5_result: stages?.stage5?.result || null,
        final_clusters: final_clusters,
        summary: summary || null,
        total_duration_ms: summary?.total_duration_ms || null,
        success: true,
        errors: body.errors || [],
      });

    if (runError) {
      console.warn(`⚠️ Failed to save test run metadata: ${runError.message}`);
      // Don't fail if metadata save fails
    }

    console.log(`✅ Saved ${clusterRecords.length} clusters with test run ID: ${testRunId}`);

    return NextResponse.json({
      success: true,
      test_run_id: testRunId,
      clusters_saved: clusterRecords.length,
      message: `Results saved to auto_photo_clusters table (test run: ${testRunId})`,
    });

  } catch (error: any) {
    console.error('❌ Failed to save auto-clustering results:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'save_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

