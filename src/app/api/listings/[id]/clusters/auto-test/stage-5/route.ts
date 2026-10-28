/**
 * Stage 5: Visual Refinement & Merge
 *
 * Visual verification and finalization step that:
 * - Uses Gemini Pro to visually verify cluster assignments by looking at all images
 * - Compares Stage 0's one-shot visual proposals with Stages 1-3's multi-step results (via Stage 1.5)
 * - For each photo/cluster, decides which approach is more accurate based on visual evidence
 * - Finalizes clusters by:
 *    - Using Stage 1.5's merged groupings as the structural foundation (visual + structural merged)
 *    - Comparing with Stage 0's visual proposals to catch any missed visual similarities
 *    - Merging redundant clusters and correcting photo assignments based on visual evidence
 *    - Choosing the best, human-friendly names from Stage 3 clusters
 *
 * Result: Solid, finalized clusters verified visually that combine the best of both one-shot visual analysis and multi-step structural matching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { convertSupabaseUrlToBase64 } from '@/lib/photo-storage';
import { VertexAI } from '@google-cloud/vertexai';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

export const dynamic = 'force-dynamic';

type FinalCluster = {
  cluster_name: string;
  photo_indices: number[];
  source_stage?: string | null;
  confidence?: number | null;
};

type VisualCluster = {
  cluster_name: string;
  photo_indices: number[];
  visual_description?: string;
  is_excluded?: boolean;
  excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other';
  excluded_reason?: string;
};

interface Stage5RequestBody {
  final_clusters?: FinalCluster[]; // Stages 1-3 multi-step results
  stage1_5_result?: {
    result?: {
      merged_photo_groupings?: MergedPhotoGrouping[]; // Multi-step definitive groupings
    } | null;
  };
  stage0_result?: {
    result?: {
      visual_clusters?: VisualCluster[]; // Stage 0 one-shot visual proposals
    } | null;
  };
}

interface MergedPhotoGrouping {
  cluster_name: string;
  photo_indices: number[];
  is_excluded?: boolean;
  excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other';
  excluded_reason?: string;
}

interface RefinedCluster extends FinalCluster {
  merged_from?: string[];
  reasoning?: string;
  source_stage?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body: Stage5RequestBody = await request.json();

    const finalClusters: FinalCluster[] = body.final_clusters || []; // Stages 1-3 multi-step results

    // Stage 1.5's merged photo groupings (multi-step: visual + structural merged)
    const mergedGroupings: MergedPhotoGrouping[] =
      body.stage1_5_result?.result?.merged_photo_groupings || [];

    // Stage 0's one-shot visual proposals (for comparison)
    const stage0Proposals: VisualCluster[] =
      body.stage0_result?.result?.visual_clusters || [];

    if (finalClusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'missing_final_clusters' },
        { status: 400 }
      );
    }

    if (mergedGroupings.length === 0) {
      // Stage 1.5 is the structural foundation; without it, refinement cannot proceed
      return NextResponse.json(
        { success: false, error: 'missing_merged_groupings', details: 'Stage 5 requires Stage 1.5 merged_photo_groupings' },
        { status: 400 }
      );
    }

    console.log(`🔍 Stage 5: Comparing one-shot (Stage 0: ${stage0Proposals.length} proposals) vs multi-step (Stage 1.5: ${mergedGroupings.length} groupings)`);

    // Fetch all photos for visual comparison
    const { data: photos, error: photosError } = await supabase
      .from('listing_photos')
      .select('url, display_order')
      .eq('listing_id', listingId)
      .order('display_order');

    if (photosError || !photos || photos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_photos', details: 'Failed to fetch photos for visual comparison' },
        { status: 400 }
      );
    }

    console.log(`📸 Stage 5: Loaded ${photos.length} photos for visual comparison`);

    // Convert all photos to base64 for visual comparison
    console.log(`🖼️ Encoding ${photos.length} photos for visual verification...`);
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const photoUrls: string[] = [];

    for (const photo of photos) {
      try {
        const base64 = await convertSupabaseUrlToBase64(photo.url);
        imageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
          },
        });
        photoUrls.push(photo.url);
      } catch (error) {
        console.warn(`⚠️ Failed to convert photo ${photo.url}:`, error);
      }
    }

    if (imageParts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_images', details: 'Failed to convert any photos to base64' },
        { status: 400 }
      );
    }

    console.log(`✅ Encoded ${imageParts.length} photos for visual comparison`);

    // Prepare for visual verification (include all clusters, including excluded ones for full coverage)
    const refinedClusters: RefinedCluster[] = [];
    const mergesApplied: Array<{
      new_cluster: string;
      merged_from: string[];
      reason: string;
    }> = [];

    // Initialize Vertex AI with Pro for visual verification
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.1, // Lowered for deterministic finisher behavior - only fix obvious outliers
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 30000, // Increased thinking budget for comprehensive visual verification
        responseMimeType: 'application/json',
      },
    });

    // Build Stage 0 proposals summary (include all, including excluded for full coverage)
    const stage0Summary = stage0Proposals.map((p: any, i) => 
      `${i + 1}. "${p.cluster_name}": photos [${p.photo_indices.join(', ')}]${p.is_excluded ? ` [EXCLUDED: ${p.excluded_type || 'other'}]` : ''}${p.visual_description ? ` - ${p.visual_description}` : ''}${p.reasoning ? ` (${p.reasoning})` : ''}`
    ).join('\n');

    // Build Stage 3 (final clusters) summary
    const stage3Summary = finalClusters.map((c, i) => 
      `${i + 1}. "${c.cluster_name}": photos [${c.photo_indices.join(', ')}]`
    ).join('\n');

    // Build Stage 1.5 merged groupings summary (include all, including excluded for full coverage)
    const mergedSummary = mergedGroupings.map((g, i) => 
      `${i + 1}. "${g.cluster_name}": photos [${g.photo_indices.join(', ')}]${g.is_excluded ? ` [EXCLUDED: ${g.excluded_type || 'other'}]` : ''}`
    ).join('\n');

    // Build prompt for visual verification and finalization
    const prompt = `You are finalizing photo cluster assignments by visually comparing two approaches.

ONE-SHOT VISUAL APPROACH (Stage 0):
${stage0Summary || 'No Stage 0 proposals provided'}

MULTI-STEP STRUCTURAL APPROACH (Stages 1-3, merged in Stage 1.5):
Stage 1.5 Merged Groupings:
${mergedSummary}

Stage 3 Final Clusters:
${stage3Summary}

TASK:
You are the FINISHER. Start from the merged_photo_groupings from Super Stage 0 as your baseline. Your job is to fix obvious outliers - photos that clearly don't belong in their current cluster and clearly fit better elsewhere.

Look at all ${imageParts.length} photos (indexed 0 to ${imageParts.length - 1}) and verify the cluster assignments visually. This includes both property spaces AND excluded content (views, floorplans, certificates) for full coverage.

For each merged grouping (including excluded ones), you need to:
1. Visually verify that the photos in that grouping actually belong together (look at the actual images)
2. Identify any obvious outliers - photos that clearly don't match the other photos in their cluster
3. For outliers, determine if they clearly fit better in another existing cluster
4. Only reassign photos if they are CLEARLY misplaced - if uncertain, keep the original assignment
5. Only merge clusters if they CLEARLY show the same space visually - be conservative
6. Finalize the cluster name (prefer descriptive Spanish names from Stage 3 clusters, or use "excluded - ..." format for excluded content)
7. For excluded clusters, verify they are correctly identified as non-property content (views, floorplans, certificates)

MINIMIZE CHANGES: Only fix what's clearly wrong. If both approaches (Super Stage 0 vs Stages 2-3) agree, keep that assignment.

OUTPUT FORMAT (JSON):
{
  "refined_clusters": [
    {
      "cluster_name": "<final_cluster_name>",
      "photo_indices": [<0-based_indices>],
      "reasoning": "<why_this_grouping_is_correct_visually>",
      "comparison": "<how_one-shot_and_multi-step_approaches_compare>",
      "source_preference": "<one-shot|multi-step|both_agree>"
    },
    ...
  ],
  "reassignments": [
    {
      "photo_index": <index>,
      "from_cluster": "<old_cluster_name>",
      "to_cluster": "<new_cluster_name>",
      "reason": "<visual_evidence_for_reassignment>"
    },
    ...
  ],
  "merges_applied": [
    {
      "new_cluster": "<cluster_name>",
      "merged_from": ["<cluster1>", "<cluster2>", ...],
      "reason": "<why_these_were_merged_visually>"
    },
    ...
  ]
}

IMPORTANT:
- Start from merged_photo_groupings as your baseline - these are the definitive groupings from Super Stage 0
- Use the actual images to make visual decisions, not just the text summaries
- Only move a photo if it's CLEARLY an outlier in its current cluster AND CLEARLY fits better elsewhere
- If both approaches agree, keep that assignment (strong visual confirmation)
- Be conservative: if uncertain whether a photo belongs, keep the original assignment
- Only merge clusters if they CLEARLY show the same space visually
- Only split clusters if photos are CLEARLY from different spaces
- Minimize changes - your job is to fix obvious mistakes, not to recluster everything
- Every photo index (0 to ${imageParts.length - 1}) must appear in exactly one refined_cluster`;

    console.log(`🤖 Calling Gemini Pro for visual verification and finalization...`);
    const startTime = Date.now();

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      }],
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Pro response received in ${duration}ms`);

    // Extract JSON response
    const responseText = (result.response as any)?.text || result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini Pro');
    }

    // Parse JSON
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini Pro response');
    }
    cleanText = jsonMatch[0];

    const aiResult = JSON.parse(cleanText);

    // Validate AI response
    if (!aiResult.refined_clusters || !Array.isArray(aiResult.refined_clusters) || aiResult.refined_clusters.length === 0) {
      throw new Error('Gemini Pro did not return valid refined_clusters array');
    }

    // Convert AI's refined clusters to our format
    const aiRefinedClusters: RefinedCluster[] = aiResult.refined_clusters.map((rc: any) => ({
      cluster_name: rc.cluster_name,
      photo_indices: rc.photo_indices || [],
      source_stage: 'stage-5',
      reasoning: rc.reasoning || rc.comparison || 'Visual verification by Gemini Pro',
    }));

    // Add AI's refined clusters to the result (after excluded clusters)
    refinedClusters.push(...aiRefinedClusters);

    // Add AI's merges
    if (aiResult.merges_applied && Array.isArray(aiResult.merges_applied)) {
      mergesApplied.push(...aiResult.merges_applied);
    }

    console.log(`✅ AI verified and refined ${aiRefinedClusters.length} clusters`);

    return NextResponse.json({
      success: true,
      stage: 'stage-5',
      model: 'gemini-2.5-pro',
      photos_analyzed: imageParts.length,
      response_time_ms: duration,
      result: {
        refined_clusters: refinedClusters,
        reassignments: aiResult.reassignments || [],
        merges_applied: mergesApplied,
        ai_verification: true,
      },
      raw_response: responseText,
    });
  } catch (error: any) {
    console.error('❌ Stage 5 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_5_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

