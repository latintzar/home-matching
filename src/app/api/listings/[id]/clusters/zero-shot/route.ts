/**
 * Zero-Shot Clustering Endpoint (Debug/Test)
 * 
 * Uses the shared zero-shot clustering helper with consistent settings:
 * - Temperature: 0.7
 * - Prompt: visual-priority
 * - Also runs visibility mapping (but does NOT write to DB)
 * 
 * This is a debug/test endpoint. For production use, use `/zero-shot/full` which writes to DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runZeroShotGemini3 } from '@/lib/auto-clustering/zeroShotGemini3';
import { runVisibilityGemini3 } from '@/lib/auto-clustering/visibilityGemini3';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

// Store results in memory (for debug/test UI)
const zeroShotResultsCache = new Map<string, {
  result: any;
  timestamp: number;
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    
    // Check cache
    const cached = zeroShotResultsCache.get(listingId);
    if (cached) {
      return NextResponse.json(cached.result);
    }

    return NextResponse.json(
      { success: false, error: 'not_found', message: 'No zero-shot clustering results found. Run POST to generate.' },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    
    console.log(`🎯 Starting zero-shot clustering (debug) for listing ${listingId}`);

    // Step 1: Run zero-shot clustering using shared helper
    console.log(`📸 Step 1: Running Gemini 3 zero-shot clustering...`);
    const zeroShotResult = await runZeroShotGemini3({
      listingId,
      temperature: 0.7,
      promptVariant: 'visual-priority',
    });

    console.log(`✅ Zero-shot clustering complete: ${zeroShotResult.clusters.length} clusters`);

    // Step 2: Run visibility mapping
    console.log(`👁️ Step 2: Running Gemini 3 visibility mapping...`);
    const visibilityResult = await runVisibilityGemini3({
      listingId,
      final_clusters: zeroShotResult.clusters.map(c => ({
        cluster_name: c.cluster_name,
        photo_indices: c.photo_indices,
      })),
    });

    console.log(`✅ Visibility mapping complete: ${visibilityResult.visibility_mappings.length} mappings`);

    // Step 3: Map photo indices to URLs using the mapping from shared helper
    // The shared helper returns photo_urls array that maps imageParts index to URL
    const photoUrls = zeroShotResult.photo_urls || [];
    
    // Map photo indices (from Gemini, which reference imageParts array positions) to URLs
    const clustersWithUrls = zeroShotResult.clusters.map(cluster => ({
      ...cluster,
      photo_urls: cluster.photo_indices
        .map(idx => photoUrls[idx]) // idx is position in imageParts array
        .filter((url): url is string => url !== null && url !== undefined),
    }));

    const finalResult = {
      success: true,
      listing_id: listingId,
      model: 'gemini-3-pro-preview',
      photos_analyzed: photoUrls.length,
      clusters_count: clustersWithUrls.length,
      visibility_mappings_count: visibilityResult.visibility_mappings.length,
      result: {
        clusters: clustersWithUrls,
        excluded_content: zeroShotResult.excluded_content,
        reasoning: zeroShotResult.reasoning,
        visibility_mappings: visibilityResult.visibility_mappings,
      },
      config: {
        temperature: 0.7,
        promptVariant: 'visual-priority',
        thinkingConfig: { thinkingLevel: 'HIGH' },
      },
    };

    // Cache the result
    zeroShotResultsCache.set(listingId, {
      result: finalResult,
      timestamp: Date.now(),
    });

    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error('❌ Zero-shot clustering failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'zero_shot_clustering_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
        model: 'gemini-3-pro-preview',
      },
      { status: 500 }
    );
  }
}
