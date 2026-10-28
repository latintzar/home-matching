/**
 * Stage 1.5: Flash Merge - Combine Visual and Structural Approaches
 * 
 * Uses Gemini 2.5 Flash to intelligently merge:
 * - Stage 0: Visual cluster analysis (what photos look like)
 * - Stage 1: Structural extraction (what description says)
 * 
 * Produces a unified, reasoned space set that resolves conflicts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { createClient } from '@supabase/supabase-js';
import { convertSupabaseUrlToBase64 } from '@/lib/photo-storage';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

interface MergedPhotoGrouping {
  cluster_name: string;
  photo_indices: number[];
  is_excluded?: boolean;
  excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other';
  excluded_reason?: string;
}

interface MergedSpaceSet {
  target_clusters: string[];
  merged_photo_groupings: MergedPhotoGrouping[]; // Definitive photo groupings after merging visual + structural
  reasoning: string; // How visual and structural approaches were merged
  conflicts_resolved: Array<{
    visual_cluster: string;
    structural_cluster: string;
    resolution: string;
    reasoning: string;
  }>;
  visual_insights: string; // Key insights from visual analysis
  structural_insights: string; // Key insights from structural analysis
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();
    const { 
      stage0_result, 
      stage1_result 
    } = body as { 
      stage0_result?: { result: { visual_clusters: Array<{ cluster_name: string; photo_indices: number[]; visual_description: string; reasoning: string; room_type_hypothesis?: string; is_excluded?: boolean; excluded_type?: 'views' | 'floorplan' | 'certificate' | 'other'; excluded_reason?: string }>; reasoning: string; uncertainties?: Array<any> } };
      stage1_result?: { space_set: { target_clusters: string[]; bedrooms: number; bathrooms: number; reasoning?: string; uncertainties?: Array<any>; [key: string]: any } };
    };

    if (!stage0_result || !stage1_result) {
      return NextResponse.json(
        { success: false, error: 'missing_inputs', details: 'stage0_result and stage1_result are required' },
        { status: 400 }
      );
    }

    console.log(`🔀 Stage 1.5: Merging visual and structural approaches`);

    // Fetch property details (like PropertyDetails component)
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*, scraped_data')
      .eq('id', listingId)
      .single();

    if (listingError) {
      console.warn(`⚠️ Failed to fetch listing details: ${listingError.message}`);
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

    // Fetch photos for context and encoding
    const { data: photos } = await supabase
      .from('listing_photos')
      .select('url, display_order')
      .eq('listing_id', listingId)
      .order('display_order');

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_photos', details: 'No photos found for this listing' },
        { status: 400 }
      );
    }

    // Convert photos to base64 for visual analysis
    console.log(`🖼️ Encoding ${photos.length} photos for Stage 1.5 visual reference...`);
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
        { success: false, error: 'photo_conversion_failed', details: 'Failed to convert any photos to base64' },
        { status: 500 }
      );
    }

    console.log(`✅ Encoded ${imageParts.length} photos for Stage 1.5`);

    const visualClusters = stage0_result.result.visual_clusters;
    const structuralSpaceSet = stage1_result.space_set;

    // Identify excluded clusters from Stage 0
    const excludedClusters = visualClusters.filter(vc => vc.is_excluded);
    const excludedClustersSummary = excludedClusters.map(vc => ({
      name: vc.cluster_name,
      type: vc.excluded_type || 'other',
      photos: vc.photo_indices.length,
      reason: vc.excluded_reason || vc.reasoning,
    }));

    // Initialize Vertex AI with Flash
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 16000, // Increased significantly to handle very detailed reasoning, conflict resolution, and visual/structural insights
        responseMimeType: 'application/json',
      },
    });

    // Build prompt for merging
    const visualClustersStr = visualClusters.map((vc, i) => 
      `${i + 1}. "${vc.cluster_name}": Photos ${vc.photo_indices.join(', ')} - ${vc.visual_description}\n   Reasoning: ${vc.reasoning}\n   Hypothesis: ${vc.room_type_hypothesis || 'unknown'}`
    ).join('\n\n');

    const structuralClustersStr = structuralSpaceSet.target_clusters.map((c, i) => 
      `${i + 1}. ${c}`
    ).join('\n');

    const propertyContextStr = propertyDetails.title || propertyDetails.address
      ? `PROPERTY DETAILS (from listing):
- Title: ${propertyDetails.title || 'N/A'}
- Address: ${propertyDetails.address || 'N/A'}, ${propertyDetails.city || ''}
- Listed bedrooms: ${propertyDetails.bedrooms || 'unknown'}
- Listed bathrooms: ${propertyDetails.bathrooms || 'unknown'}
- Property type: ${propertyDetails.propertyType || 'unknown'}
- Constructed area: ${propertyDetails.constructedArea || 'unknown'} m²
- Description: ${propertyDetails.description ? propertyDetails.description.substring(0, 800) : 'N/A'}
- Rooms and amenities: ${propertyDetails.roomsAndAmenities || 'N/A'}
- Additional features: ${propertyDetails.additionalFeatures?.join(', ') || 'None'}
- Total photos analyzed: ${photos?.length || 0}`
      : '';

    const excludedClustersStr = excludedClustersSummary.length > 0
      ? `\n\nEXCLUDED CLUSTERS (from Stage 0 - these are NOT property spaces):
${excludedClustersSummary.map((ec, i) => 
  `${i + 1}. "${ec.name}" (type: ${ec.type}, ${ec.photos} photos)\n   Reason: ${ec.reason}`
).join('\n\n')}

IMPORTANT: These excluded clusters (views, floorplans, certificates) should NOT be counted as bedrooms, bathrooms, or other property spaces. They are separate and will be handled separately in the pipeline.`
      : '';

    const visualUncertaintiesStr = stage0_result.result.uncertainties && stage0_result.result.uncertainties.length > 0
      ? `\n\nVISUAL UNCERTAINTIES (from Stage 0):
${stage0_result.result.uncertainties.map((u: any, i: number) => 
  `${i + 1}. ${u.issue} (affects: ${u.affected_clusters?.join(', ') || 'unknown'})\n   Reasoning: ${u.reasoning}`
).join('\n\n')}`
      : '';

    const structuralUncertaintiesStr = structuralSpaceSet.uncertainties && structuralSpaceSet.uncertainties.length > 0
      ? `\n\nSTRUCTURAL UNCERTAINTIES (from Stage 1):
${structuralSpaceSet.uncertainties.map((u: any, i: number) => 
  `${i + 1}. ${u.issue} (affects: ${u.affected_spaces?.join(', ') || 'unknown'})\n   Reasoning: ${u.reasoning}`
).join('\n\n')}`
      : '';

    const prompt = `You are merging two approaches to identify spaces in a Spanish property. You have access to ALL ${imageParts.length} property photos to verify and make your definitive decision.

${propertyContextStr}

VISUAL APPROACH (from Stage 0 - what photos actually show):
${visualClustersStr}${excludedClustersStr}
${stage0_result.result.reasoning ? `\nVisual reasoning: ${stage0_result.result.reasoning}` : ''}${visualUncertaintiesStr}

STRUCTURAL APPROACH (from Stage 1 - what description implies):
- Bedrooms: ${structuralSpaceSet.bedrooms}
- Bathrooms: ${structuralSpaceSet.bathrooms}
- Kitchen: ${structuralSpaceSet.kitchen ? 'Yes' : 'No'}
- Living Room: ${structuralSpaceSet.living_room ? 'Yes' : 'No'}
- Terrace: ${structuralSpaceSet.terrace ? 'Yes' : 'No'}
- Other spaces: ${structuralSpaceSet.other_spaces?.join(', ') || 'None'}

Target clusters from structural approach:
${structuralClustersStr}
${structuralSpaceSet.reasoning ? `\nStructural reasoning: ${structuralSpaceSet.reasoning}` : ''}${structuralUncertaintiesStr}

TASK:
You are the DEFINITIVE DECISION-MAKER. You have access to all ${imageParts.length} photos below. Use them to verify the visual and structural analyses, resolve conflicts, and decide the final, authoritative cluster list.

IMPORTANT:
- Review the photos yourself to verify what Stage 0 and Stage 1 found
- If photos show something different from what either approach suggests, trust what you see in the photos
- Use the photos to resolve conflicts between visual and structural approaches
- Make your decision based on what the photos actually show, not just on the summaries above

Your decision should:
1. Resolve conflicts by choosing the most accurate representation (visual evidence often trumps structural assumptions)
2. Use visual insights to correct structural errors (e.g., if description says "pool" and "terrace" separately but photos show they're the same space, merge them)
3. Trust visual evidence when it contradicts structural assumptions (photos show reality, descriptions may be inaccurate)
4. Produce a FINAL, AUTHORITATIVE target_clusters list that will be used for all subsequent stages
5. Be decisive - this is the definitive space set, not a suggestion
6. DO NOT include excluded clusters (views, floorplans, certificates) in target_clusters - these are handled separately

CONFLICT RESOLUTION EXAMPLES:
- If visual shows pool+terrace as one cluster but structural lists them separately → merge into one "Terraza con Piscina"
- If visual shows 2 bedrooms but structural says 3 → trust visual (photos show reality)
- If structural lists "Dining Room" but visual doesn't show it → include it but note it might be part of living room

OUTPUT FORMAT (JSON):
{
  "target_clusters": ["<space_name_1>", "<space_name_2>", ...],
  "merged_photo_groupings": [
    {
      "cluster_name": "<definitive_cluster_name>",
      "photo_indices": [<photo_index_1>, <photo_index_2>, ...],
      "is_excluded": false
    },
    {
      "cluster_name": "excluded - views",
      "photo_indices": [<photo_index_1>, <photo_index_2>, ...],
      "is_excluded": true,
      "excluded_type": "views",
      "excluded_reason": "<why_these_are_excluded>"
    },
    ...
  ],
  "reasoning": "<detailed_explanation_of_your_definitive_decision_and_how_you_resolved_conflicts>",
  "conflicts_resolved": [
    {
      "visual_cluster": "<visual_cluster_name>",
      "structural_cluster": "<structural_cluster_name>",
      "resolution": "<your_definitive_decision>",
      "reasoning": "<why_you_chose_this_as_the_authoritative_answer>"
    },
    ...
  ],
  "visual_insights": "<key_insights_from_visual_analysis_that_informed_your_decision>",
  "structural_insights": "<key_insights_from_structural_analysis_that_informed_your_decision>"
}

CRITICAL FOR merged_photo_groupings:
- This is the DEFINITIVE photo grouping that merges Stage 0's visual clusters with Stage 1's structural clusters
- Each grouping should have a cluster_name from target_clusters (or excluded cluster name)
- photo_indices should include ALL photos that belong to this cluster based on your merged analysis
- If Stage 0 showed photos [5,6,7] as "Kitchen" and Stage 1 said "Kitchen" exists, merge them into one grouping
- If Stage 0 showed pool+terrace as one visual cluster but Stage 1 listed them separately, use your definitive decision to group photos
- Include excluded clusters (views, floorplans, certificates) with is_excluded: true
- Every photo should be assigned to exactly one grouping

CRITICAL:
- This target_clusters list is DEFINITIVE and will be used for all subsequent clustering stages
- You are making the final decision - be confident and decisive
- When in conflict, prioritize visual evidence (photos show reality)
- Use Spanish naming: "Dormitorio", "Baño", "Cocina", "Salón", "Terraza", etc.
- Be specific: "Dormitorio Principal", "Baño Principal", "Cocina Americana", etc.
- Include all spaces that exist based on your comparison
- Explain your reasoning clearly - this decision affects the entire pipeline`;

    console.log(`🤖 Calling Gemini Flash for merge...`);
    const startTime = Date.now();

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts, // Include all photos so Stage 1.5 can see them
        ],
      }],
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Flash response received in ${duration}ms`);

    // Extract JSON response
    const responseText = (result.response as any)?.text || result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini Flash');
    }

    // Parse JSON
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    
    cleanText = cleanText.trim();

    let mergedResult: MergedSpaceSet;
    try {
      mergedResult = JSON.parse(cleanText);
    } catch (parseError: any) {
      // Try to fix truncated JSON
      let fixedText = cleanText;
      
      // If conflicts_resolved array is incomplete, try to close it
      if (parseError.message.includes('Expected') && parseError.message.includes(']')) {
        // Find last complete object in conflicts_resolved array
        const conflictsMatch = fixedText.match(/"conflicts_resolved"\s*:\s*\[([\s\S]*)\]/);
        if (conflictsMatch) {
          const arrayContent = conflictsMatch[1];
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
            const completeArrayContent = arrayContent.substring(0, lastCompleteIndex + 1);
            fixedText = fixedText.replace(/"conflicts_resolved"\s*:\s*\[[\s\S]*\]/, `"conflicts_resolved": [${completeArrayContent}]`);
            // Ensure other required fields exist
            if (!fixedText.includes('"visual_insights"')) {
              fixedText = fixedText.replace(/\}$/, ', "visual_insights": "", "structural_insights": ""}');
            }
          }
        }
      }
      
      try {
        mergedResult = JSON.parse(fixedText);
        console.log(`⚠️ Fixed truncated JSON and retried successfully`);
      } catch (retryError: any) {
      console.error(`❌ JSON parse error: ${parseError.message}`);
        throw new Error(`Failed to parse JSON response: ${parseError.message}. Response length: ${cleanText.length}, Preview: ${cleanText.substring(0, 3000)}`);
      }
    }

    console.log(`✅ Merged into ${mergedResult.target_clusters.length} target clusters`);

    return NextResponse.json({
      success: true,
      stage: 'stage-1.5',
      model: 'gemini-2.5-flash',
      response_time_ms: duration,
      result: mergedResult,
      raw_response: responseText,
    });

  } catch (error: any) {
    console.error('❌ Stage 1.5 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_1.5_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

