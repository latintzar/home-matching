import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { VertexAI } from '@google-cloud/vertexai';
import Ajv from 'ajv';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const ajv = new Ajv({ allErrors: true });

export const dynamic = 'force-dynamic';

type Tier = 'estandar' | 'optimo' | 'plus';

interface ConsistencyEdit {
  room_to_edit: string;
  room_name: string;
  adjacent_room: string;
  adjacent_room_name: string;
  edit_prompt: string;
  reason: string;
}

interface ConsistencyPlan {
  overlapping_pairs: Array<{
    room_1: string;
    room_1_name: string;
    room_2: string;
    room_2_name: string;
    overlap_description: string;
  }>;
  edit_order: string[];
  edits: ConsistencyEdit[];
}

interface ConsistencyPlanResponse {
  plan: ConsistencyPlan;
}

const responseSchema = {
  type: 'object',
  properties: {
    plan: {
      type: 'object',
      properties: {
        overlapping_pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              room_1: { type: 'string' },
              room_1_name: { type: 'string' },
              room_2: { type: 'string' },
              room_2_name: { type: 'string' },
              overlap_description: { type: 'string' }
            },
            required: ['room_1', 'room_1_name', 'room_2', 'room_2_name', 'overlap_description']
          }
        },
        edit_order: { type: 'array', items: { type: 'string' } },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              room_to_edit: { type: 'string' },
              room_name: { type: 'string' },
              adjacent_room: { type: 'string' },
              adjacent_room_name: { type: 'string' },
              edit_prompt: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['room_to_edit', 'room_name', 'adjacent_room', 'adjacent_room_name', 'edit_prompt', 'reason']
          }
        }
      },
      required: ['overlapping_pairs', 'edit_order', 'edits']
    }
  },
  required: ['plan']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * R6: Cross-Room Consistency Pass (With Furniture)
 * 
 * Final consistency pass for after-images with furniture added.
 * Same process as R4 but applied to furniture-added images.
 * 
 * Endpoint: POST /api/listings/[id]/after/consistency-pass-furniture
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { tier, force }: { tier?: Tier; force?: boolean } = body;

    if (!tier || !['estandar', 'optimo', 'plus'].includes(tier)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_tier',
          details: 'Tier must be: estandar, optimo, or plus'
        },
        { status: 400 }
      );
    }

    console.log(`🔄 R6: Cross-Room Consistency Pass (With Furniture) for listing ${listingId}, tier ${tier}`);

    const uiTier = tier === 'estandar' ? 'livable' : tier === 'optimo' ? 'comfortable' : 'competitive';

    // Fetch after-images (with furniture)
    const { data: afterImages, error: imagesError } = await supabase
      .from('after_photos')
      .select('room_id, url')
      .eq('listing_id', parseInt(listingId, 10))
      .eq('tier', uiTier)
      .eq('has_furniture', true);

    if (imagesError || !afterImages || afterImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'after_images_not_found',
          details: 'After-images (with furniture) not found. Run after/add-furniture (R5) first.'
        },
        { status: 404 }
      );
    }

    // Fetch R2a descriptions for boundary information
    const { data: descriptions, error: descError } = await supabase
      .from('room_image_descriptions')
      .select('room_id, description_data')
      .eq('listing_id', parseInt(listingId, 10));

    if (descError || !descriptions || descriptions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'r2a_descriptions_not_found',
          details: 'R2a descriptions not found. Run after/describe-room-images (R2a) first.'
        },
        { status: 404 }
      );
    }

    const descriptionsMap = new Map(descriptions.map(d => [d.room_id, d.description_data]));

    // Fetch cluster names
    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, cluster_name')
      .eq('listing_id', listingId.toString());

    const clusterNamesMap = new Map(
      clusters?.map(c => [`cluster_${c.id}`, c.cluster_name]) || []
    );

    console.log(`📸 Found ${afterImages.length} after-images (with furniture) to check for consistency`);

    // Fetch images as base64
    const imagesData: Array<{ room_id: string; room_name: string; base64: string; mimeType: string }> = [];
    for (const img of afterImages) {
      try {
        const response = await fetch(img.url);
        if (!response.ok) continue;

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        imagesData.push({
          room_id: img.room_id,
          room_name: clusterNamesMap.get(img.room_id) || img.room_id,
          base64: base64,
          mimeType: contentType
        });
      } catch (e) {
        console.warn(`  ⚠️  Failed to fetch ${img.url}:`, e);
      }
    }

    if (imagesData.length < 2) {
      console.log(`✅ Only ${imagesData.length} room(s) - no consistency check needed`);
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'Only one room - no consistency check needed'
      });
    }

    // Build prompt for overlap identification and edit planning
    const roomsInfo = imagesData.map(r => ({
      room_id: r.room_id,
      room_name: r.room_name,
      boundaries: (descriptionsMap.get(r.room_id) as any)?.boundaries || []
    }));

    const prompt = `You are analyzing renovated room images WITH FURNITURE to identify overlapping areas and plan final consistency edits.

ROOMS DATA:
${JSON.stringify(roomsInfo, null, 2)}

TASK:
1. **Identify Overlapping Rooms**: Based on boundary information from R2a, identify rooms that are visible in each other's images
2. **Describe Overlaps**: For each overlapping pair, describe what's visible from each room's perspective (including furniture)
3. **Generate Edit Prompts**: For each overlap, generate a prompt to edit one of the photos to match the other (ensuring furniture consistency too)
4. **Decide Edit Order**: Determine which room's image to edit first (consider visibility, importance, complexity)

REQUIREMENTS:
- Only edit rooms where there's a clear boundary/overlap (doorway, archway, window, etc.)
- Edit prompts should ensure both architectural elements AND furniture match at boundaries
- Edit order should ensure edits build on each other (edit simpler rooms first, or rooms with more visibility)
- Each edit should reference the adjacent room's image to ensure consistency

OUTPUT:
Return a consistency plan with:
- overlapping_pairs: Array of room pairs with overlap descriptions
- edit_order: Array of room_ids in order to edit
- edits: Array of edit instructions (which room to edit, what to change, why)

Return JSON with plan object.`;

    // Call Gemini Pro to analyze overlaps and plan edits
    const imagesForAnalysis = imagesData.map(d => ({
      mimeType: d.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: d.base64
    }));

    const analysisResult = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.1,
      topP: 0.7,
      topK: 20,
      thinkingConfig: { thinkingBudget: -1 },
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      images: imagesForAnalysis
    });

    if (!analysisResult.success || !analysisResult.text) {
      console.error('❌ Gemini analysis failed:', analysisResult.error);
      return NextResponse.json(
        {
          success: false,
          error: 'consistency_analysis_failed',
          details: analysisResult.error || 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Parse analysis response
    let cleaned = analysisResult.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('❌ Failed to parse analysis response:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'parse_error',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 500 }
      );
    }

    if (!validateResponse(parsed)) {
      console.error('❌ Invalid response structure:', validateResponse.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_response_structure',
          details: JSON.stringify(validateResponse.errors)
        },
        { status: 500 }
      );
    }

    const plan = (parsed as unknown as ConsistencyPlanResponse).plan;

    if (plan.edits.length === 0) {
      console.log(`✅ No consistency edits needed`);
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No consistency edits needed',
        plan: plan
      });
    }

    console.log(`🔄 Executing ${plan.edits.length} consistency edits in order: ${plan.edit_order.join(', ')}`);

    // Initialize Vertex AI for image generation
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        temperature: 0.1,
        topP: 0.7,
        maxOutputTokens: 32768,
        responseModalities: ['IMAGE']
      } as any,
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
      ] as any,
    });

    const results: Array<{ room_id: string; room_name: string; updated: boolean }> = [];
    const errors: Array<{ room_id: string; error: string }> = [];

    // Execute edits in order (sequential)
    for (const edit of plan.edits) {
      try {
        const roomToEdit = edit.room_to_edit;
        const adjacentRoom = edit.adjacent_room;

        // Find current image for room to edit
        const currentImageData = imagesData.find(d => d.room_id === roomToEdit);
        if (!currentImageData) {
          throw new Error(`Current image not found for room ${roomToEdit}`);
        }

        // Find adjacent room image (for reference)
        const adjacentImageData = imagesData.find(d => d.room_id === adjacentRoom);
        if (!adjacentImageData) {
          throw new Error(`Adjacent room image not found for room ${adjacentRoom}`);
        }

        console.log(`  🎨 Editing ${edit.room_name} to match ${edit.adjacent_room_name}`);

        // Build edit prompt
        const editPrompt = `You are editing a renovated room image WITH FURNITURE to ensure consistency with an adjacent room.

CURRENT ROOM IMAGE: The image to edit is provided below.
ADJACENT ROOM IMAGE: The adjacent room image (for reference) is provided below.

EDIT INSTRUCTIONS:
${edit.edit_prompt}

REASON: ${edit.reason}

REQUIREMENTS:
- Apply the edit while maintaining the overall room design
- Ensure consistency at boundaries (doorways, arches, etc.) for both architectural elements AND furniture
- Maintain photorealistic quality
- Output the edited image.`;

        // Execute edit
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: editPrompt },
              {
                inlineData: {
                  mimeType: currentImageData.mimeType,
                  data: currentImageData.base64
                }
              },
              {
                inlineData: {
                  mimeType: adjacentImageData.mimeType,
                  data: adjacentImageData.base64
                }
              }
            ]
          }]
        });

        // Extract edited image
        const response = result.response;
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('No image generated');
        }

        const parts = candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
          throw new Error('No image parts in response');
        }

        const imagePart = parts.find((p: any) => p.inlineData?.data);
        if (!imagePart?.inlineData?.data) {
          throw new Error('No image data in response');
        }

        const editedImageBase64 = imagePart.inlineData.data;
        const editedImageBuffer = Buffer.from(editedImageBase64, 'base64');

        // Upload updated image (overwrite existing)
        const safeRoomId = roomToEdit.replace(/[^a-zA-Z0-9_]/g, '_');
        const storagePath = `${listingId}/after/${tier}/${safeRoomId}_after_with_furniture.jpg`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(storagePath, editedImageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Failed to upload: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(storagePath);

        const updatedImageUrl = urlData.publicUrl;

        // Update after_photos table
        const { error: dbError } = await supabase
          .from('after_photos')
          .update({ url: updatedImageUrl })
          .eq('listing_id', parseInt(listingId, 10))
          .eq('tier', uiTier)
          .eq('room_id', roomToEdit)
          .eq('has_furniture', true);

        if (dbError) {
          throw new Error(`Failed to update database: ${dbError.message}`);
        }

        // Update local image data for next iteration
        const imageDataIndex = imagesData.findIndex(d => d.room_id === roomToEdit);
        if (imageDataIndex >= 0) {
          imagesData[imageDataIndex].base64 = editedImageBase64;
        }

        console.log(`  ✅ Updated ${edit.room_name}`);
        results.push({
          room_id: roomToEdit,
          room_name: edit.room_name,
          updated: true
        });

      } catch (error: any) {
        console.error(`  ❌ Error editing ${edit.room_name}:`, error);
        errors.push({
          room_id: edit.room_to_edit,
          error: error.message || 'Unknown error'
        });
      }
    }

    console.log(`✅ R6: Completed. ${results.length} rooms updated, ${errors.length} errors`);

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      total_edits: plan.edits.length,
      errors: errors.length,
      error_details: errors,
      results: results,
      plan: plan
    });

  } catch (error: any) {
    console.error('❌ R6: Cross-Room Consistency Pass (With Furniture) failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'consistency_pass_furniture_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

