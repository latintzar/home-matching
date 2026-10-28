/**
 * Stage 2: Pro Pass 1 - Choose Best Photo Per Target Space
 * 
 * Uses Gemini 2.5 Pro to:
 * - For each target space in SPACE SET, choose ONE best representative photo
 * - Mark selected photos and remaining unassigned photos
 * 
 * This creates initial cluster seeds with high-quality exemplars.
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

interface PhotoSelection {
  space_name: string; // e.g., "Bedroom 1", "Kitchen"
  photo_index: number; // Index in the photos array (0-based)
  photo_url: string;
  confidence: number; // 0-1
  reasoning?: string;
}

interface Stage2Result {
  selected_photos: PhotoSelection[];
  remaining_photo_indices: number[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { space_set, visual_clusters } = body as { 
      space_set?: { target_clusters: string[] };
      visual_clusters?: Array<{ 
        cluster_name: string; 
        photo_indices: number[]; 
        visual_description?: string; 
        reasoning?: string;
        is_excluded?: boolean;
        excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other';
        anchor_photo_index?: number; // NEW: anchor photo from Super Stage 0
        anchor_photo_description?: string; // NEW: rich description of anchor
      }>;
    };

    if (!space_set || !space_set.target_clusters || space_set.target_clusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'missing_space_set', details: 'space_set with target_clusters is required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Stage 2: Choosing best photos for ${space_set.target_clusters.length} target spaces`);
    if (visual_clusters) {
      console.log(`👁️ Using ${visual_clusters.length} visual clusters from Stage 0 for guidance`);
    }

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
    if (visual_clusters) {
      for (const vc of visual_clusters) {
        if (vc.is_excluded) {
          vc.photo_indices.forEach(idx => excludedPhotoIndices.add(idx));
        }
      }
    }

    // Filter out excluded photos
    const usablePhotos = photos
      .map((photo, index) => ({ index, photo }))
      .filter(({ index }) => !excludedPhotoIndices.has(index));

    if (usablePhotos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_usable_photos', details: 'No usable photos found after excluding views, floorplans, and certificates' },
        { status: 400 }
      );
    }

    console.log(`📸 Analyzing ${usablePhotos.length} photos (${excludedPhotoIndices.size} excluded)`);

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
        maxOutputTokens: 40000, // Increased further to prevent JSON truncation
        responseMimeType: 'application/json',
      },
    });

    // Convert usable photos to base64
    console.log(`🖼️ Encoding ${usablePhotos.length} photos...`);
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const photoUrls: string[] = [];
    const photoIndexMap = new Map<number, number>(); // Map original index to usable index

    for (let i = 0; i < usablePhotos.length; i++) {
      const { index: originalIndex, photo } = usablePhotos[i];
      photoIndexMap.set(i, originalIndex); // Store mapping: usable index -> original index
      
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
      throw new Error('Failed to convert any photos to base64');
    }

    console.log(`✅ Encoded ${imageParts.length} photos`);

    // Build prompt for photo selection
    const targetClustersStr = space_set.target_clusters.map((c, i) => `${i + 1}. ${c}`).join('\n');
    
    // Build reverse map: original index -> usable index (for mapping anchor indices)
    const originalToUsableIndex = new Map<number, number>();
    for (let i = 0; i < usablePhotos.length; i++) {
      const { index: originalIndex } = usablePhotos[i];
      originalToUsableIndex.set(originalIndex, i);
    }
    
    let visualClustersContext = '';
    if (visual_clusters && visual_clusters.length > 0) {
      visualClustersContext = `\n\nVISUAL CLUSTER ANALYSIS (from Super Stage 0):
These are the clusters and their proposed ANCHOR photos, based on visual similarity and listing context:

${visual_clusters.map((vc, i) => {
  // Map anchor photo index from original space to usable space
  let anchorUsableIndex: number | null = null;
      if (typeof vc.anchor_photo_index === 'number' && !excludedPhotoIndices.has(vc.anchor_photo_index)) {
        anchorUsableIndex = originalToUsableIndex.get(vc.anchor_photo_index) ?? null;
      }
      
      const anchorText = anchorUsableIndex !== null
        ? ` (anchor photo index: ${anchorUsableIndex}${
            vc.anchor_photo_description ? ` - ${vc.anchor_photo_description}` : ''
          })`
        : '';
      
      // Map photo_indices from original to usable space
      const usablePhotoIndices = vc.photo_indices
        .filter(idx => !excludedPhotoIndices.has(idx))
        .map(idx => originalToUsableIndex.get(idx))
        .filter((idx): idx is number => idx !== undefined);
      
      return `${i + 1}. "${vc.cluster_name}": photos [${usablePhotoIndices.join(', ')}]` +
             `${vc.visual_description ? ` - ${vc.visual_description}` : ''}` +
             `${anchorText}`;
}).join('\n\n')}

IMPORTANT:
- Treat the Super Stage 0 anchor as a STRONG prior for which photo best represents each space
- You may override it only if you see a clearly better candidate in the current set of usable photos
- Use the anchor descriptions to understand what each space should look like
- Photo indices shown above are in the usable photo space (0 to ${imageParts.length - 1})`;
    }
    
    const prompt = `You are analyzing ${imageParts.length} photos of a Spanish property to select the BEST representative photo for each target space.

TARGET SPACES (SPACE SET):
${targetClustersStr}${visualClustersContext}

TASK:
For each target space above, choose EXACTLY ONE photo (by index, 0-based) that best represents that space. This photo will serve as the exemplar/seed for that cluster.

The selected photo should:
- Clearly show the space's key features
- Be well-lit and in focus
- Show the most representative view of the space
- Avoid photos that are too close-up or show only details
- Consider visual clusters: if multiple target spaces map to the same visual cluster, choose the best photo from that cluster

CRITICAL RULES:
- Each target space must get exactly ONE photo (no more, no less)
- Each photo can only be selected for ONE space (no duplicates)
- All photos NOT selected will be passed to the next stage for matching
- If a space cannot be clearly identified in any photo, set photo_index to -1
- Photos are indexed from 0 to ${imageParts.length - 1} (these are the usable photos, excluding views, floorplans, and certificates)
- Use visual cluster information to avoid confusion (e.g., if pool and terrace are visually the same, treat them as one space)
- Note: Some photos (views, floorplans, certificates) have been excluded from this selection process

This stage creates the initial cluster seeds. The next stage will match remaining photos to these seeds.

OUTPUT FORMAT (JSON ONLY - NO COMMENTS OR EXPLANATIONS OUTSIDE JSON):
{
  "selected_photos": [
    {
      "space_name": "<target_space_name>",
      "photo_index": <0-based_index>,
      "photo_url": "<url>",
      "confidence": <0-1>,
      "reasoning": "<brief explanation>"
    },
    ...
  ],
  "remaining_photo_indices": [<indices of photos not selected>]
}

CRITICAL: Output ONLY valid JSON. Do not add any text, comments, or explanations outside the JSON object. The remaining_photo_indices array should contain all photo indices (0-${imageParts.length - 1}) that were NOT selected for any space.`;

    console.log(`🤖 Calling Gemini Pro for photo selection...`);
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

    console.log(`📝 Raw response length: ${responseText.length} chars`);
    console.log(`📝 Raw response preview: ${responseText.substring(0, 500)}...`);

    // Parse JSON with better cleaning
    let cleanText = responseText.trim();
    
    // Remove markdown code blocks
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    // Try to extract JSON if wrapped in other text
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    
    cleanText = cleanText.trim();

    console.log(`📝 Cleaned text length: ${cleanText.length} chars`);
    console.log(`📝 Cleaned text preview: ${cleanText.substring(0, 500)}...`);

    let stage2Result: Stage2Result;
    try {
      stage2Result = JSON.parse(cleanText);
    } catch (parseError: any) {
      // Try to fix common JSON issues
      let fixedText = cleanText;
      
      // Try to find and extract just the JSON object if it's wrapped
      const jsonStart = fixedText.indexOf('{');
      const jsonEnd = fixedText.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        fixedText = fixedText.substring(jsonStart, jsonEnd + 1);
      }
      
      // Try to fix truncated JSON by removing incomplete last entry
      if (parseError.message.includes('Unexpected token') || parseError.message.includes('end of JSON')) {
        // Find the last complete object in selected_photos array
        const selectedPhotosMatch = fixedText.match(/"selected_photos"\s*:\s*\[([\s\S]*)\]/);
        if (selectedPhotosMatch) {
          const arrayContent = selectedPhotosMatch[1];
          // Find last complete object
          let braceCount = 0;
          let lastCompleteIndex = -1;
          for (let i = 0; i < arrayContent.length; i++) {
            if (arrayContent[i] === '{') braceCount++;
            if (arrayContent[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastCompleteIndex = i;
              }
            }
          }
          if (lastCompleteIndex >= 0) {
            // Extract up to last complete object and close arrays/objects
            const completeArrayContent = arrayContent.substring(0, lastCompleteIndex + 1);
            fixedText = fixedText.replace(/"selected_photos"\s*:\s*\[[\s\S]*\]/, `"selected_photos": [${completeArrayContent}]`);
            // Ensure remaining_photo_indices exists
            if (!fixedText.includes('remaining_photo_indices')) {
              fixedText = fixedText.replace(/\}$/, ', "remaining_photo_indices": []}');
            }
          }
        }
      }
      
      try {
        stage2Result = JSON.parse(fixedText);
        console.log(`⚠️ Fixed JSON parsing issue and retried successfully`);
      } catch (retryError: any) {
        console.error(`❌ JSON parse error at position ${parseError.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
        const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
        console.error(`❌ Error context: ${cleanText.substring(Math.max(0, errorPos - 200), Math.min(cleanText.length, errorPos + 200))}`);
        throw new Error(`Failed to parse JSON response: ${parseError.message}. Response length: ${cleanText.length}, Preview: ${cleanText.substring(0, 2000)}`);
      }
    }

    // Map usable indices back to original indices and add photo URLs
    // Build a reverse map: original index -> URL (for lookup after mapping)
    const originalIndexToUrl = new Map<number, string>();
    for (let i = 0; i < usablePhotos.length; i++) {
      const { index: originalIndex, photo } = usablePhotos[i];
      originalIndexToUrl.set(originalIndex, photo.url);
    }
    
    stage2Result.selected_photos = stage2Result.selected_photos.map(sel => {
      const originalIndex = photoIndexMap.get(sel.photo_index) ?? sel.photo_index;
      // Get URL from original index, not usable index
      const photoUrl = originalIndexToUrl.get(originalIndex) || 
                       (sel.photo_index >= 0 && sel.photo_index < photoUrls.length ? photoUrls[sel.photo_index] : null) ||
                       sel.photo_url || 
                       'unknown';
      return {
        ...sel,
        photo_index: originalIndex, // Convert back to original index
        photo_url: photoUrl,
      };
    });

    // Map remaining indices back to original indices
    stage2Result.remaining_photo_indices = stage2Result.remaining_photo_indices
      .map(usableIdx => photoIndexMap.get(usableIdx) ?? usableIdx)
      .filter(idx => !excludedPhotoIndices.has(idx)); // Double-check excluded photos aren't included

    console.log(`✅ Selected ${stage2Result.selected_photos.length} photos, ${stage2Result.remaining_photo_indices.length} remaining`);

    return NextResponse.json({
      success: true,
      stage: 'stage-2',
      model: 'gemini-2.5-pro',
      total_photos: imageParts.length,
      selected_count: stage2Result.selected_photos.length,
      remaining_count: stage2Result.remaining_photo_indices.length,
      response_time_ms: duration,
      result: stage2Result,
      raw_response: responseText,
    });

  } catch (error: any) {
    console.error('❌ Stage 2 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_2_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

