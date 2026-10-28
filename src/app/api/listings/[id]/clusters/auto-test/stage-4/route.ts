/**
 * Stage 4: Pro Visibility Pass - Cross-Visibility Mapping
 * 
 * Uses Gemini 2.5 Pro to:
 * - For each photo, determine which clusters (rooms) are visible from that photo
 * - Build a cross-visibility graph (photo → cluster adjacency)
 * 
 * This enables layout reconstruction and adjacency inference.
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
  cluster_adjacency: Record<string, string[]>; // cluster_name -> [adjacent_cluster_names]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { 
      final_clusters 
    } = body as { 
      final_clusters?: Array<{ cluster_name: string; photo_indices: number[] }>;
    };

    if (!final_clusters || final_clusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'missing_clusters', details: 'final_clusters array is required' },
        { status: 400 }
      );
    }

    console.log(`👁️ Stage 4: Building cross-visibility mapping for ${final_clusters.length} clusters`);

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
        maxOutputTokens: 60000, // Increased to handle large photo sets and detailed visibility mappings
        responseMimeType: 'application/json',
      },
    });

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
    const prompt = `You are analyzing photos to determine cross-visibility between room clusters.

CLUSTER DEFINITIONS:
${clusterContext}

Each cluster contains multiple photos. Photos are indexed from 0 to ${photoIndicesArray.length - 1}.

TASK:
For each photo, determine:
1. Which cluster does this photo belong to? (based on cluster definitions above)
2. Which OTHER clusters are visible FROM this photo? (e.g., "Kitchen seen from Living Room 1")
3. How are they visible? (through doorway, arch, garden door, window, open space, etc.)

VISIBILITY RULES:
- A cluster is "visible" ONLY if a SIGNIFICANT PORTION of that room/space is visible from the current photo
- Significant means: enough visible area that future architectural renders would need to maintain consistency between photos
- Examples of SIGNIFICANT visibility:
  - Large open archway showing substantial portion of adjacent room
  - Sliding glass doors showing a view of a terrace/outdoor space
  - Wide open floor plan where multiple rooms are clearly visible
- Do NOT mark if the other space is obscure, unfocused or lacking detail e.g. tiny glimpse of another room, distant view through a narrow opening, a reflection or edge of another space barely visible.
- If you infer adjacency, but the room isn't actually visually visible, be cautious.
- Be VERY conservative - err on the side of NOT marking visibility if uncertain
- The photo's OWN cluster is always visible (implicitly)

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
          "confidence": <0-1> // Higher confidence = larger visible area (significant portion). Lower confidence = smaller visible area (may not affect R3 consistency)
        },
        ...
      ]
    },
    ...
  ],
  "cluster_adjacency": {
    "<cluster_name>": ["<adjacent_cluster_1>", "<adjacent_cluster_2>", ...],
    ...
  }
}

The cluster_adjacency object should map each cluster to all clusters that are adjacent/connected to it (based on visibility patterns).`;

    console.log(`🤖 Calling Gemini Pro for visibility analysis...`);
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
      stage: 'stage-4',
      model: 'gemini-2.5-pro',
      photos_analyzed: imageParts.length,
      clusters_count: final_clusters.length,
      response_time_ms: duration,
      result: stage4Result,
      raw_response: responseText,
    });

  } catch (error: any) {
    console.error('❌ Stage 4 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_4_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

