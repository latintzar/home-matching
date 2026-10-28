/**
 * Super Stage 0: Pro Visual + Structural Cluster Analysis
 * 
 * Merges the jobs of old Stage 0, Stage 1, and Stage 1.5 into a single authoritative pass.
 * Uses Gemini 2.5 Pro to:
 * - Analyze all photos visually AND use listing details (bedrooms, bathrooms, description)
 * - Infer definitive space set (visual + structural merged)
 * - Cluster photos into those spaces
 * - Choose anchor photos for each cluster
 * - Provide rich anchor descriptions for use in Stages 2 & 3
 * 
 * This is the single source of truth for cluster definitions.
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

interface MergedPhotoGrouping {
  cluster_name: string;
  photo_indices: number[];
  is_excluded?: boolean;
  excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other';
  excluded_reason?: string;
}

interface VisualCluster {
  cluster_name: string;
  photo_indices: number[];
  visual_description: string;
  reasoning: string; // Why these photos belong together visually
  room_type_hypothesis?: string; // What type of room/space this appears to be
  is_excluded: boolean; // Whether this cluster should be excluded from space clustering
  excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other'; // Type of excluded content
  excluded_reason?: string; // Why this cluster is excluded
  anchor_photo_index: number; // 0-based index in global photos array - best representative photo
  anchor_photo_description: string; // Rich, expressive description of the anchor image
}

interface Stage0Result {
  visual_clusters: VisualCluster[];
  total_clusters: number;
  target_clusters: string[]; // Non-excluded cluster names (definitive space set)
  merged_photo_groupings: MergedPhotoGrouping[]; // Definitive photo groupings (compatible with old Stage 1.5 format)
  reasoning: string; // Overall approach and insights
  uncertainties?: Array<{
    issue: string; // What is unclear or ambiguous
    affected_clusters?: string[]; // Which clusters are affected
    reasoning: string; // Why this is uncertain
  }>; // Things that might be unclear or ambiguous
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`👁️ Super Stage 0: Visual + Structural cluster analysis for listing ${listingId}`);

    // Fetch listing details for structural context (like Stage 1.5 did)
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*, scraped_data')
      .eq('id', listingId)
      .single();

    if (listingError) {
      console.warn(`⚠️ Super Stage 0: failed to fetch listing details: ${listingError.message}`);
    }

    const scrapedData = listing?.scraped_data || {};
    const propertyDetails = {
      title: listing?.title,
      address: listing?.address,
      city: listing?.city,
      bedrooms: scrapedData.bedrooms || listing?.bedrooms,
      bathrooms: scrapedData.bathrooms || listing?.bathrooms,
      description: scrapedData.description,
      roomsAndAmenities: scrapedData.roomsAndAmenities,
      constructedArea: scrapedData.areas?.constructed || scrapedData.sqm || listing?.sqm,
      usefulArea: scrapedData.areas?.useful,
      propertyType: listing?.property_type,
      yearBuilt: listing?.year_built,
      price: listing?.price_eur,
      additionalFeatures: scrapedData.additionalFeatures || [],
    };

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

    console.log(`📸 Analyzing ${photos.length} photos visually`);

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
        maxOutputTokens: 40000, // Increased further to prevent JSON truncation with detailed anchor descriptions
        responseMimeType: 'application/json',
      },
    });

    // Convert all photos to base64
    console.log(`🖼️ Encoding ${photos.length} photos...`);
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
      throw new Error('Failed to convert any photos to base64');
    }

    console.log(`✅ Encoded ${imageParts.length} photos`);

    // Build property context string
    const propertyContextStr = propertyDetails.title || propertyDetails.address
      ? `PROPERTY DETAILS:
- Title: ${propertyDetails.title || 'N/A'}
- Address: ${propertyDetails.address || 'N/A'}, ${propertyDetails.city || ''}
- Bedrooms (listed): ${propertyDetails.bedrooms || 'unknown'}
- Bathrooms (listed): ${propertyDetails.bathrooms || 'unknown'}
- Property type: ${propertyDetails.propertyType || 'unknown'}
- Constructed area: ${propertyDetails.constructedArea || 'unknown'} m²
- Description: ${propertyDetails.description ? propertyDetails.description.substring(0, 800) : 'N/A'}
- Rooms & amenities: ${propertyDetails.roomsAndAmenities || 'N/A'}
- Additional features: ${propertyDetails.additionalFeatures?.join(', ') || 'None'}
- Total photos: ${imageParts.length}`
      : '';

    // Build prompt for Super Stage 0 (visual + structural merged)
    const prompt = `You are doing a single, authoritative clustering pass for a Spanish property.

You see:
- ALL ${imageParts.length} photos (0-based indices: 0..${imageParts.length - 1})
- The listing details below

Your job is to do what previous stages 0, 1, and 1.5 did together:

${propertyContextStr}

TASK OVERVIEW:
1) Infer which spaces/rooms the property actually has (combine visual evidence from photos + listing text hints)
2) Cluster photos into those spaces (plus excluded content like views, floorplans, certificates)
3) For each real space, choose ONE best anchor photo (most representative, wide, clear shot)
4) Describe each anchor photo in rich, expressive detail (for use in later stages)
5) Output a definitive space set and definitive photo groupings

STRUCTURAL VS VISUAL:
- Use the listing text as a HINT about how many bedrooms, bathrooms etc. there "should" be
- But final decisions MUST be anchored in what you actually see in the photos
- If listing says "3 bedrooms" but you only clearly see 2, note the conflict in reasoning/uncertainties
- Trust visual evidence when it contradicts structural assumptions (photos show reality, descriptions may be inaccurate)

CLUSTERING RULES:
- Group photos that show the SAME space/room from different angles or perspectives
- Focus on visual similarity: same materials, colors, furniture, fixtures, architectural features
- Spatial relationships: photos showing different views of the same room
- Visual continuity: same floor, walls, ceiling, windows visible across photos
- **DEPTH AWARENESS**: Describe what's CLOSER vs FURTHER in each image. Focus clustering on the PRIMARY space that's closer to the camera
- When multiple spaces are visible, prioritize the closer, more prominent space for clustering

ANCHOR PHOTO REQUIREMENTS (for each non-excluded cluster):
- Pick exactly ONE anchor_photo_index from its photo_indices
- This should be the most representative, wide, clear shot
- Avoid extreme close-ups, tiny corners, or photos dominated by other spaces
- Write an expressive anchor_photo_description for that image:
  * What's in the foreground vs background
  * Boundaries, layout, key furniture and finishes
  * Lighting, mood, style
  * Spatial relationships visible in the image

EXCLUDED CONTENT DETECTION:
Some photos may show content that should NOT be treated as property spaces. For each cluster, classify it as excluded if it contains:
1. **Views only** (is_excluded: true, excluded_type: "views"): Photos that primarily show external views (port, skyline, sea, mountains) without showing the property itself
2. **Floorplans** (is_excluded: true, excluded_type: "floorplan"): Architectural drawings, layout diagrams, schematics, blueprints
3. **Certificates** (is_excluded: true, excluded_type: "certificate"): Energy performance certificates, legal documents, certificates, official paperwork
4. **Other excluded** (is_excluded: true, excluded_type: "other"): Any other non-property content (e.g., maps, brochures, unrelated images)

For excluded clusters:
- Set is_excluded: true
- Set excluded_type to the appropriate category
- Provide excluded_reason explaining why it's excluded
- These clusters will be separated from actual property spaces

For property spaces (interior/exterior rooms, terraces, gardens, etc.):
- Set is_excluded: false
- Leave excluded_type and excluded_reason empty/null

OUTPUT FORMAT (JSON ONLY):
{
  "visual_clusters": [
    {
      "cluster_name": "<descriptive_name_in_spanish>",
      "photo_indices": [<0-based_indices_for_this_space>],
      "visual_description": "<summary_of_what_this_space_shows>",
      "reasoning": "<why_these_photos_belong_together_visually>",
      "room_type_hypothesis": "<Dormitorio|Baño|Cocina|Salón|Terraza|etc>",
      "is_excluded": <true|false>,
      "excluded_type": "<views|floorplan|certificate|other>" | null,
      "excluded_reason": "<why_this_cluster_is_excluded>" | null,
      "anchor_photo_index": <0-based_index_in_global_photo_array>,
      "anchor_photo_description": "<rich_expressive_description_of_anchor_image>"
    },
    ...
  ],
  "total_clusters": <number>,
  "target_clusters": [
    "<cluster_name_1>",
    "<cluster_name_2>",
    ...
  ],
  "merged_photo_groupings": [
    {
      "cluster_name": "<cluster_name>",
      "photo_indices": [<0-based_indices>],
      "is_excluded": <true|false>,
      "excluded_type": "<views|floorplan|certificate|other>" | null,
      "excluded_reason": "<string>" | null
    },
    ...
  ],
  "reasoning": "<overall_explanation_of_your_definitive_decision>",
  "uncertainties": [
    {
      "issue": "<what_is_uncertain>",
      "affected_clusters": ["<cluster_name_1>", "..."],
      "reasoning": "<why_this_is_uncertain>"
    },
    ...
  ]
}

CRITICAL RULES:
- Every photo index 0..${imageParts.length - 1} must appear in exactly ONE merged_photo_groupings entry
- target_clusters MUST list only non-excluded cluster_name values
- For excluded clusters, cluster_name should follow the "excluded - <type>" convention where appropriate (e.g., "excluded - views")
- Use Spanish naming: "Dormitorio Principal", "Baño Secundario", "Cocina Americana", "Terraza con Piscina", etc.
- Be decisive and consistent: this is the single source of truth for later stages
- anchor_photo_index must be one of the photo_indices in that cluster
- anchor_photo_description should be rich and detailed - it will be used as a semantic prototype in later stages`;

    console.log(`🤖 Calling Gemini Pro for Super Stage 0 (visual + structural merged)...`);
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

    // Parse JSON with better cleaning
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    
    cleanText = cleanText.trim();

    let stage0Result: Stage0Result;
    try {
      stage0Result = JSON.parse(cleanText);
    } catch (parseError: any) {
      console.error(`❌ JSON parse error: ${parseError.message}`);
      throw new Error(`Failed to parse JSON response: ${parseError.message}. Response preview: ${cleanText.substring(0, 2000)}`);
    }

    console.log(`✅ Super Stage 0 complete: ${stage0Result.visual_clusters.length} clusters, ${stage0Result.target_clusters?.length || 0} target spaces`);

    return NextResponse.json({
      success: true,
      stage: 'stage-0',
      model: 'gemini-2.5-pro',
      total_photos: imageParts.length,
      response_time_ms: duration,
      result: stage0Result,
      raw_response: responseText,
    });

  } catch (error: any) {
    console.error('❌ Stage 0 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_0_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

