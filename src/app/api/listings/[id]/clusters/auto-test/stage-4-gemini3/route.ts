/**
 * Stage 4 Gemini 3: Pro Visibility Pass - Cross-Visibility Mapping (Gemini 3 Pro Preview)
 * 
 * Duplicate of stage-4 but using Gemini 3 Pro Preview with:
 * - thinking_config with thinkingLevel="HIGH"
 * - temperature: 1
 * - top_p: 0.95
 * - max_output_tokens: 65535
 * - Safety settings all OFF (threshold: "OFF")
 * 
 * Uses Gemini 3 Pro Preview to:
 * - For each photo, determine which clusters (rooms) are visible from that photo
 * - Build a cross-visibility graph (photo → cluster adjacency)
 * 
 * This enables layout reconstruction and adjacency inference.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { convertSupabaseUrlToBase64 } from '@/lib/photo-storage';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-3-pro-preview';
const GENERATE_CONTENT_API = 'streamGenerateContent';

export const dynamic = 'force-dynamic';

interface VisibilityMapping {
  photo_index: number;
  photo_url: string;
  cluster_name: string; // The cluster this photo belongs to
  visible_clusters: string[]; // Clusters visible FROM this photo
  visibility_details?: Array<{
    cluster_name: string;
    visible_from: string; // e.g., "through doorway", "through arch", "adjacent room"
    confidence: number;
  }>;
}

interface Stage4Result {
  visibility_mappings: VisibilityMapping[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { 
      final_clusters,
      temperature = 0.1
    } = body as { 
      final_clusters?: Array<{ cluster_name: string; photo_indices: number[] }>;
      temperature?: number;
    };

    if (!final_clusters || final_clusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'missing_clusters', details: 'final_clusters array is required' },
        { status: 400 }
      );
    }

    console.log(`👁️ Stage 4 Gemini 3: Building cross-visibility mapping for ${final_clusters.length} clusters using Gemini 3 Pro Preview`);

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

    // Build cluster-to-photo mapping
    const clusterMap = new Map<string, number[]>();
    for (const cluster of final_clusters) {
      clusterMap.set(cluster.cluster_name, cluster.photo_indices);
    }

    // Get all unique photo indices
    const allPhotoIndices = new Set<number>();
    for (const indices of clusterMap.values()) {
      indices.forEach(idx => allPhotoIndices.add(idx));
    }

    const photoIndicesArray = Array.from(allPhotoIndices).sort((a, b) => a - b);
    console.log(`📸 Analyzing ${photoIndicesArray.length} photos for visibility`);

    if (!API_KEY) {
      throw new Error('API key not found. Set GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY');
    }

    // Convert all photos to base64 in parallel
    console.log(`🖼️ Encoding ${photoIndicesArray.length} photos in parallel...`);
    
    const photoConversions = await Promise.all(
      photoIndicesArray.map(async (idx) => {
        if (idx >= 0 && idx < photos.length) {
          try {
            const base64 = await convertSupabaseUrlToBase64(photos[idx].url);
            return { idx, base64, url: photos[idx].url, success: true };
          } catch (error) {
            console.warn(`⚠️ Failed to convert photo ${photos[idx].url}:`, error);
            return { idx, base64: null, url: photos[idx].url, success: false };
          }
        }
        return { idx, base64: null, url: null, success: false };
      })
    );

    // Build imageParts from conversions
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const photoUrls: string[] = [];
    const photoIndices: number[] = [];

    photoConversions.forEach(({ idx, base64, url, success }) => {
      if (success && base64 && url) {
          imageParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64,
            },
          });
        photoUrls.push(url);
          photoIndices.push(idx);
      }
    });

    if (imageParts.length === 0) {
      throw new Error('Failed to convert any photos to base64');
    }

    console.log(`✅ Encoded ${imageParts.length} photos`);

    // Build cluster context string
    const clusterContext = final_clusters.map((c, i) => 
      `${i + 1}. ${c.cluster_name} (photos: ${c.photo_indices.join(', ')})`
    ).join('\n');

    // Build prompt for visibility analysis
    const prompt = `You are analyzing photos to determine DIRECT VISIBILITY between room clusters.

CONTEXT & PURPOSE:
This data is used for 3D Architectural Rendering. We need to know which clusters are DIRECTLY VISIBLE in a photo so we can maintain cross-photo consistency.
- Only clusters that are CLEARLY and SUBSTANTIALLY visible in the image should be listed.
- Base your decisions SOLELY on the visual appearance of the other clusters in the image.
- If a cluster is not directly, clearly visible, do NOT list it.

CLUSTER DEFINITIONS:
${clusterContext}

**CRITICAL CONSTRAINT**: You MUST ONLY use cluster names from the CLUSTER DEFINITIONS list above. Do NOT invent or hallucinate cluster names that are not in this list.

Each photo belongs to ONE cluster (as defined above). Photos are indexed from 0 to ${photoIndicesArray.length - 1}.

TASK:
For each photo, identify which OTHER clusters are DIRECTLY and SUBSTANTIALLY visible in the image. Base your decision SOLELY on what you can see with the naked eye.

DIRECT VIEW ONLY RULES:
- **DIRECT VIEW ONLY**: Only mark clusters that are directly visible through open doorways, archways, or windows. No inference, no guessing.
- **SUBSTANTIAL VISIBILITY REQUIRED**: The other cluster must occupy a SUBSTANTIAL portion of the image (at least 10-15% of the visible area) to be considered visible.
- **CLEAR TO NAKED EYE**: You must be able to clearly identify the cluster's distinctive features (furniture, fixtures, flooring, architectural elements) without any doubt.
- **VISUAL EVIDENCE ONLY**: Base decisions SOLELY on visual appearance. Do not use logic, floorplan knowledge, or assumptions about adjacency.
- **DIRECTIONALITY IS CRITICAL**: If a photo is taken looking OUT at a view, interior rooms BEHIND the camera are NOT visible. Do not list them.
- **EXTERIOR WALLS != INTERIOR**: Seeing the outside window/door of a room does NOT count. You must see THROUGH the glass to the INTERIOR furniture/pixels.

WHAT COUNTS AS DIRECT VIEW (Substantial & Clear):
✅ Large open archway/doorway showing SUBSTANTIAL portion of adjacent room (furniture, flooring, walls clearly visible)
✅ Sliding glass doors where terrace/pool features are CLEARLY visible and occupy significant image area
✅ Open floor plan where Kitchen counters/cabinets are SUBSTANTIALLY visible from Living Room (not just a tiny corner)
✅ Wide doorway/window showing enough of another room to clearly identify it (e.g., see full bed = bedroom)

WHAT DOES NOT COUNT (Not Direct/Substantial):
❌ Closed door (even if you know a room is behind it)
❌ Small glimpse through narrow opening (not substantial enough)
❌ Reflection in mirror (unreliable, not direct view)
❌ Inference based on floorplan logic (must SEE it directly)
❌ "Probably connected" or "likely adjacent" - must be DIRECTLY VISIBLE
❌ Tiny corner or edge of another room (not substantial)
❌ The "Outside" of a room (e.g. seeing window frame from garden - must see interior)
❌ Rooms behind the camera (e.g. looking out to sea from terrace = interior NOT visible)
❌ Partial visibility that's too small to matter (< 10% of image)

CONFIDENCE LEVELS (Only mark if substantial):
- 0.9-1.0: Large, clear DIRECT view of the other room (20%+ of image, needs full rendering)
- 0.7-0.8: Significant DIRECT portion visible (15-20% of image, needs partial rendering)
- 0.6-0.7: Substantial DIRECT view (10-15% of image, needs minor rendering details)
- Below 0.6: Do NOT mark - not substantial enough or not clear enough

OUTPUT FORMAT (JSON):
{
  "visibility_mappings": [
    {
      "photo_index": <0-based_index>,
      "photo_url": "<url>",
      "cluster_name": "<cluster_this_photo_belongs_to>",
      "visible_clusters": ["<cluster_name_1>", "<cluster_name_2>", ...],
      "visibility_details": [
        {
          "cluster_name": "<visible_cluster>",
          "visible_from": "<how_it's_visible>",
          "confidence": <0-1>
        },
        ...
      ]
    },
    ...
  ]
}`;

    console.log(`🤖 Calling Gemini 3 Pro Preview REST API for visibility analysis...`);
    const startTime = Date.now();

    // Build request body with Gemini 3 Pro Preview configuration
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...imageParts,
          ]
        }
      ],
      generationConfig: {
        temperature: temperature, // Configurable temperature (default 0.1 for factual, 0.7 for more creative)
        maxOutputTokens: 65535,
        topP: 0.95,
        thinkingConfig: {
          thinkingLevel: 'HIGH'
        },
        responseMimeType: 'application/json',
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'OFF'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'OFF'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'OFF'
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'OFF'
        }
      ]
    };

    const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${encodeURIComponent(API_KEY)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;
    const rawResponse = await response.text();

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = JSON.parse(rawResponse);
      } catch {}
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${rawResponse.substring(0, 500)}`);
    }

    // Parse stream response - it's a JSON array of response objects
    let responseArray: any[];
    try {
      responseArray = JSON.parse(rawResponse);
      if (!Array.isArray(responseArray)) {
        responseArray = [responseArray];
      }
    } catch (parseError) {
      throw new Error(`Failed to parse response: ${parseError}`);
    }

    // Extract text from all chunks
    let responseText = '';
    for (const chunk of responseArray) {
      const candidates = chunk?.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate?.content?.parts || [];
        for (const part of parts) {
          if (part?.text) {
            responseText += part.text;
          }
        }
      }
    }

    if (!responseText) {
      throw new Error('Empty response from Gemini 3 Pro Preview');
    }

    console.log(`✅ Gemini 3 Pro Preview response received in ${duration}ms`);

    // Parse JSON
    const cleanText = responseText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const stage4Result: Stage4Result = JSON.parse(cleanText);

    // Add photo URLs to mappings
    stage4Result.visibility_mappings = stage4Result.visibility_mappings.map(mapping => {
      const idxInArray = photoIndices.findIndex(idx => idx === mapping.photo_index);
      return {
        ...mapping,
        photo_url: idxInArray >= 0 && idxInArray < photoUrls.length 
          ? photoUrls[idxInArray] 
          : mapping.photo_url || 'unknown',
      };
    });

    console.log(`✅ Analyzed ${stage4Result.visibility_mappings.length} photos, built adjacency graph`);

    return NextResponse.json({
      success: true,
      stage: 'stage-4-gemini3',
      model: 'gemini-3-pro-preview',
      photos_analyzed: imageParts.length,
      clusters_count: final_clusters.length,
      response_time_ms: duration,
      result: stage4Result,
      raw_response: responseText,
      config: {
        temperature: temperature,
        topP: 0.95,
        maxOutputTokens: 65535,
        thinkingConfig: { thinkingLevel: 'HIGH' },
        safetySettings: 'all_off',
      },
    });

  } catch (error: any) {
    console.error('❌ Stage 4 Gemini 3 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_4_gemini3_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
        model: 'gemini-3-pro-preview',
      },
      { status: 500 }
    );
  }
}

