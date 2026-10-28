/**
 * Stage 3: Pro Pass 2 - Match Remaining Photos to Clusters
 * 
 * Uses Gemini 2.5 Pro to:
 * - For each remaining (unassigned) photo, attempt to match it to existing clusters
 * - If no match found, create a NEW CLUSTER
 * 
 * This completes the clustering by assigning all photos to appropriate clusters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { convertSupabaseUrlToBase64 } from '@/lib/photo-storage';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

export const dynamic = 'force-dynamic';

interface ClusterMatch {
  photo_index: number;
  photo_url: string;
  cluster_name: string | null; // null if new cluster needed
  new_cluster_name?: string; // if cluster_name is null, suggest a name
  confidence: number;
  reasoning?: string;
}

interface Stage3Result {
  matches: ClusterMatch[];
  new_clusters: string[]; // List of newly created cluster names
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { 
      space_set,
      stage2_result,
      stage0_result
    } = body as { 
      space_set?: { target_clusters: string[] };
      stage2_result?: { selected_photos: Array<{ space_name: string; photo_index: number; photo_url: string }>; remaining_photo_indices: number[] };
      stage0_result?: { result?: { visual_clusters?: Array<{
        cluster_name?: string;
        is_excluded?: boolean;
        photo_indices: number[];
        anchor_photo_index?: number;
        anchor_photo_description?: string;
        visual_description?: string;
      }> } };
    };

    if (!space_set || !stage2_result) {
      return NextResponse.json(
        { success: false, error: 'missing_inputs', details: 'space_set and stage2_result are required' },
        { status: 400 }
      );
    }

    const existingClusters = stage2_result.selected_photos.map(sp => sp.space_name);
    const remainingIndices = stage2_result.remaining_photo_indices;

    if (remainingIndices.length === 0) {
      return NextResponse.json({
        success: true,
        stage: 'stage-3',
        message: 'No remaining photos to match',
        result: { matches: [], new_clusters: [] },
      });
    }

    console.log(`🔍 Stage 3: Matching ${remainingIndices.length} remaining photos to ${existingClusters.length} clusters`);

    // Fetch all photos
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

    // Get excluded photo indices from Stage 0 if available
    const excludedPhotoIndices = new Set<number>();
    if (stage0_result?.result?.visual_clusters) {
      for (const vc of stage0_result.result.visual_clusters) {
        if (vc.is_excluded) {
          vc.photo_indices.forEach(idx => excludedPhotoIndices.add(idx));
        }
      }
    }

    // Filter remaining indices to exclude excluded photos
    const usableRemainingIndices = remainingIndices.filter(idx => !excludedPhotoIndices.has(idx));

    // Get remaining photos only (excluding excluded photos)
    const remainingPhotos = usableRemainingIndices
      .map(idx => ({ index: idx, photo: photos[idx] }))
      .filter(item => item.photo);

    console.log(`📸 Processing ${remainingPhotos.length} remaining photos`);

    // Initialize Vertex AI with Pro
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 16000, // Doubled to handle large photo sets and detailed matching
        responseMimeType: 'application/json',
      },
    });

    // Convert remaining photos to base64
    console.log(`🖼️ Encoding ${remainingPhotos.length} remaining photos...`);
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const photoUrls: string[] = [];
    const photoIndices: number[] = [];

    for (const { index, photo } of remainingPhotos) {
      try {
        const base64 = await convertSupabaseUrlToBase64(photo.url);
        imageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
          },
        });
        photoUrls.push(photo.url);
        photoIndices.push(index);
      } catch (error) {
        console.warn(`⚠️ Failed to convert photo ${photo.url}:`, error);
      }
    }

    if (imageParts.length === 0) {
      throw new Error('Failed to convert any remaining photos to base64');
    }

    console.log(`✅ Encoded ${imageParts.length} photos`);

    // Also get exemplar photos for each existing cluster (for comparison)
    const exemplarPhotos: Array<{ cluster_name: string; photo_index: number; photo_url: string }> = [];
    for (const selected of stage2_result.selected_photos) {
      if (selected.photo_index >= 0 && selected.photo_index < photos.length && !excludedPhotoIndices.has(selected.photo_index)) {
        exemplarPhotos.push({
          cluster_name: selected.space_name,
          photo_index: selected.photo_index,
          photo_url: selected.photo_url,
        });
      }
    }

    // Convert exemplar photos to base64
    const exemplarImageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    for (const exemplar of exemplarPhotos) {
      try {
        const base64 = await convertSupabaseUrlToBase64(exemplar.photo_url);
        exemplarImageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
          },
        });
      } catch (error) {
        console.warn(`⚠️ Failed to convert exemplar photo ${exemplar.photo_url}:`, error);
      }
    }

    // Build anchor summary from Super Stage 0 (for semantic prototypes)
    let anchorSummary = '';
    if (stage0_result?.result?.visual_clusters) {
      const anchorClusters = stage0_result.result.visual_clusters.filter(vc => !vc.is_excluded);
      if (anchorClusters.length > 0) {
        anchorSummary = `

SUPER STAGE 0 ANCHORS (semantic prototypes for existing clusters):
${anchorClusters.map((vc, i) => {
          const idx = typeof vc.anchor_photo_index === 'number' ? vc.anchor_photo_index : 'unknown';
          const desc = vc.anchor_photo_description || vc.visual_description || '';
          const clusterName = vc.cluster_name || 'unknown';
          return `${i + 1}. "${clusterName}" – anchor photo index ${idx}${desc ? `: ${desc}` : ''}`;
        }).join('\n')}

Use these anchors as semantic prototypes when deciding whether a remaining photo matches an existing cluster.`;
      }
    }

    // Build prompt for matching
    const existingClustersStr = existingClusters.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const prompt = `You are matching remaining photos to existing room clusters or creating new clusters.

EXISTING CLUSTERS (with exemplar photos shown first):
${existingClusters.map((c, i) => `${i + 1}. ${c}`).join('\n')}${anchorSummary}

REMAINING PHOTOS TO MATCH:
${photoIndices.map((idx, i) => `Photo ${i} (original index ${idx})`).join('\n')}

TASK:
You are processing ${remainingPhotos.length} REMAINING photos that were NOT selected in Stage 2.

For each remaining photo (shown after the exemplar photos), determine:
1. **MATCH TO EXISTING CLUSTER**: Compare the photo to each exemplar photo. Does it show the same space/room? If yes, assign it to that cluster.
2. **NEW CLUSTER**: If it doesn't match any existing cluster, it's a NEW CLUSTER. Suggest a descriptive name.

MATCHING CRITERIA (compare remaining photo to exemplar photos):
- Same room type (bedroom, bathroom, kitchen, etc.)
- Same space (e.g., same bedroom, same bathroom)
- Similar architectural features, layout, or style
- Visual consistency with exemplar photo
- Different angles/views of the same room should match

PROCESSING ORDER:
1. First, try to match each remaining photo to existing clusters (using exemplar photos as reference)
2. Only create new clusters for photos that don't match any existing cluster
3. Be conservative - if uncertain, prefer matching to existing cluster over creating new one

OUTPUT FORMAT (JSON):
{
  "matches": [
    {
      "photo_index": <original_index_in_photos_array>,
      "photo_url": "<url>",
      "cluster_name": "<existing_cluster_name>" | null,
      "new_cluster_name": "<suggested_name>" (only if cluster_name is null),
      "confidence": <0-1>,
      "reasoning": "<brief explanation>"
    },
    ...
  ],
  "new_clusters": ["<cluster_name_1>", "<cluster_name_2>", ...]
}

IMPORTANT:
- photo_index refers to the ORIGINAL index in the full photos array (not the remaining photos array)
- If cluster_name is null, new_cluster_name must be provided
- Use Spanish naming conventions: "Dormitorio", "Baño", "Cocina", "Salón", "Terraza", "Garaje", "Trastero", "Pasillo", "Despacho", etc.
- Be specific: "Baño Principal", "Dormitorio Principal", "Cocina Americana", etc.`;

    console.log(`🤖 Calling Gemini Pro for photo matching...`);
    const startTime = Date.now();

    // Include exemplar photos first, then remaining photos
    const allImageParts = [...exemplarImageParts, ...imageParts];

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          ...allImageParts,
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
    const cleanText = responseText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const stage3Result: Stage3Result = JSON.parse(cleanText);

    // Add photo URLs to matches
    stage3Result.matches = stage3Result.matches.map(match => {
      const originalIndex = photoIndices.findIndex(idx => idx === match.photo_index);
      return {
        ...match,
        photo_url: originalIndex >= 0 && originalIndex < photoUrls.length 
          ? photoUrls[originalIndex] 
          : match.photo_url || 'unknown',
      };
    });

    console.log(`✅ Matched ${stage3Result.matches.length} photos, created ${stage3Result.new_clusters.length} new clusters`);

    return NextResponse.json({
      success: true,
      stage: 'stage-3',
      model: 'gemini-2.5-pro',
      remaining_photos_count: imageParts.length,
      matched_count: stage3Result.matches.filter(m => m.cluster_name !== null).length,
      new_clusters_count: stage3Result.new_clusters.length,
      response_time_ms: duration,
      result: stage3Result,
      raw_response: responseText,
    });

  } catch (error: any) {
    console.error('❌ Stage 3 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_3_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

