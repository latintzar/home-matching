import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { interceptConsoleLog } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

export const dynamic = 'force-dynamic';

type Tier = 'estandar' | 'optimo' | 'plus';

/**
 * R5: Add Furniture Layer
 * 
 * Adds furniture to after-images using a coherent whole-house staging plan (R4.5).
 * Ensures furniture style, budget, and staging approach are consistent across the entire property.
 * 
 * Endpoint: POST /api/listings/[id]/after/add-furniture
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, intercept console.log to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R5';
  let restoreConsole: (() => void) | null = null;
  
  if (isOrchestratorContext) {
    restoreConsole = interceptConsoleLog(stepName);
  }

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

    console.log(`🪑 R5: Add Furniture Layer for listing ${listingId}, tier ${tier}`);

    const uiTier = tier === 'estandar' ? 'livable' : tier === 'optimo' ? 'comfortable' : 'competitive';

    // Fetch after-images (without furniture, consistency-corrected)
    const { data: afterImages, error: imagesError } = await supabase
      .from('after_photos')
      .select('room_id, url')
      .eq('listing_id', parseInt(listingId, 10))
      .eq('tier', uiTier)
      .eq('has_furniture', false);

    if (imagesError || !afterImages || afterImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'after_images_not_found',
          details: 'After-images (without furniture) not found. Run after/render-rooms (R3) first.'
        },
        { status: 404 }
      );
    }

    // Fetch furniture staging plan (R4.5)
    const { data: stagingPlanData, error: stagingPlanError } = await supabase
      .from('furniture_staging_plans')
      .select('staging_plan')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier)
      .single();

    if (stagingPlanError || !stagingPlanData?.staging_plan) {
      return NextResponse.json(
        {
          success: false,
          error: 'staging_plan_not_found',
          details: 'Furniture staging plan not found. Run after/generate-furniture-staging-plan (R4.5) first.'
        },
        { status: 404 }
      );
    }

    const stagingPlan = stagingPlanData.staging_plan;

    // Fetch cluster names and room families for room type mapping
    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, cluster_name')
      .eq('listing_id', listingId.toString());

    const clusterNamesMap = new Map(
      clusters?.map(c => [`cluster_${c.id}`, c.cluster_name]) || []
    );

    // Fetch room families to map rooms to room types
    const { data: families } = await supabase
      .from('room_families')
      .select('family_id, family_name, room_ids')
      .eq('listing_id', listingId.toString());

    // Build room type map: room_id -> room_type (bedrooms, bathrooms, living_areas, etc.)
    const roomTypeMap = new Map<string, string>();
    if (families) {
      for (const family of families) {
        const roomIds = Array.isArray(family.room_ids) ? family.room_ids : [];
        for (const roomId of roomIds) {
          roomTypeMap.set(roomId, family.family_id); // Use family_id as room type
        }
      }
    }

    // Check for existing furniture-added images
    const { data: existingImages } = await supabase
      .from('after_photos')
      .select('room_id')
      .eq('listing_id', parseInt(listingId, 10))
      .eq('tier', uiTier)
      .eq('has_furniture', true);

    const existingRoomIds = new Set(existingImages?.map(i => i.room_id) || []);

    // Filter images to process
    const imagesToProcess = force
      ? afterImages
      : afterImages.filter(img => !existingRoomIds.has(img.room_id));

    if (imagesToProcess.length === 0) {
      console.log(`✅ All ${afterImages.length} rooms already have furniture-added images`);
      return NextResponse.json({
        success: true,
        processed: 0,
        total: afterImages.length,
        already_existing: afterImages.length,
        message: 'All rooms already have furniture-added images'
      });
    }

    console.log(`🔄 Adding furniture to ${imagesToProcess.length} rooms (${afterImages.length - imagesToProcess.length} already exist)`);

    // Initialize Vertex AI
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        temperature: 0.1,
        topP: 0.7,
        maxOutputTokens: 32768
      }
    });

    const results: Array<{ room_id: string; room_name: string; after_url: string }> = [];
    const errors: Array<{ room_id: string; error: string }> = [];

    // Process rooms in batches
    const batchSize = 3;

    for (let i = 0; i < imagesToProcess.length; i += batchSize) {
      const batch = imagesToProcess.slice(i, i + batchSize);
      const batchPromises = batch.map(async (img) => {
        try {
          const roomId = img.room_id;
          const roomName = clusterNamesMap.get(roomId) || roomId;

          // Determine room type from room families
          const roomType = roomTypeMap.get(roomId) || 'other';

          // Get staging approach for this room type
          const roomTypeStaging = stagingPlan.room_type_staging?.[roomType] || stagingPlan.room_type_staging?.other || null;

          console.log(`  🪑 Adding furniture to ${roomName} (${roomId}, type: ${roomType})`);

          // Fetch after-image (without furniture)
          const afterResponse = await fetch(img.url);
          if (!afterResponse.ok) {
            throw new Error(`Failed to fetch after-image: HTTP ${afterResponse.status}`);
          }

          const afterBuffer = await afterResponse.arrayBuffer();
          const afterBase64 = Buffer.from(afterBuffer).toString('base64');
          const afterContentType = afterResponse.headers.get('content-type') || 'image/jpeg';

          // Build furniture staging prompt using coherent staging plan
          const prompt = `You are adding furniture to a renovated room image using a coherent whole-house staging plan.

BEFORE IMAGE: The renovated room image (without furniture) is provided below.

ROOM CONTEXT:
- Room: ${roomName} (${roomId})
- Room Type: ${roomType}

WHOLE-HOUSE STAGING PLAN:
Overall Approach: ${stagingPlan.overall_staging_approach}

Furniture Style Theme: ${stagingPlan.furniture_style_theme}

Material Palette:
- Primary Materials: ${stagingPlan.material_palette.primary_materials.join(', ')}
- Color Scheme: ${stagingPlan.material_palette.color_scheme}
- Finish Style: ${stagingPlan.material_palette.finish_style}

Budget Guidelines:
- Budget Range: ${stagingPlan.budget_guidelines.furniture_budget_range}
- Cost Per Room: ${stagingPlan.budget_guidelines.cost_per_room_guideline}
- Budget-Appropriate Categories: ${stagingPlan.budget_guidelines.budget_appropriate_categories.join(', ')}

ROOM-SPECIFIC STAGING:
${roomTypeStaging ? `
Staging Level: ${roomTypeStaging.staging_level}
Furniture Categories: ${roomTypeStaging.furniture_categories.join(', ')}
Rationale: ${roomTypeStaging.staging_rationale}
` : 'Use overall staging approach for this room type.'}

Coherence Notes: ${stagingPlan.coherence_notes}

REQUIREMENTS:
- Stage this room according to the staging plan above
- Use furniture categories appropriate for this room type and staging level
- Ensure furniture matches the material palette and color scheme
- Keep furniture budget-appropriate for the tier (${tier})
- Maintain style coherence with the whole-house theme
- Position furniture appropriately for the room layout
- Maintain the exact camera angle, perspective, and framing of the before image
- Preserve room geometry and architectural elements
- Apply lighting consistently with the before image
- Output a photorealistic image with furniture staged according to the plan

Generate the room image with furniture staged now.`;

          // Prepare parts for Gemini call (no master reference images needed - using staging plan)
          const parts: any[] = [
            { text: prompt },
            {
              inlineData: {
                mimeType: afterContentType,
                data: afterBase64
              }
              }
          ];

          const result = await model.generateContent({
            contents: [{
              role: 'user',
              parts: parts
            }]
          });

          // Extract image from response
          const response = result.response;
          const candidates = response.candidates;
          if (!candidates || candidates.length === 0) {
            throw new Error('No image generated');
          }

          const partsResponse = candidates[0].content?.parts;
          if (!partsResponse || partsResponse.length === 0) {
            throw new Error('No image parts in response');
          }

          const imagePart = partsResponse.find((p: any) => p.inlineData?.data);
          if (!imagePart?.inlineData?.data) {
            throw new Error('No image data in response');
          }

          const furnitureImageBase64 = imagePart.inlineData.data;
          const furnitureImageBuffer = Buffer.from(furnitureImageBase64, 'base64');

          // Upload to Supabase Storage
          const safeRoomId = roomId.replace(/[^a-zA-Z0-9_]/g, '_');
          const storagePath = `${listingId}/after/${tier}/${safeRoomId}_after_with_furniture.jpg`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(storagePath, furnitureImageBuffer, {
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

          const furnitureImageUrl = urlData.publicUrl;

          // Store in after_photos table (with has_furniture: true)
          const { error: dbError } = await supabase
            .from('after_photos')
            .upsert({
              listing_id: parseInt(listingId, 10),
              tier: uiTier,
              room_id: roomId,
              photo_url: img.url, // Reference to original photo
              url: furnitureImageUrl,
              has_furniture: true,
              index: -1
            }, {
              onConflict: 'listing_id,tier,room_id,photo_url'
            });

          if (dbError) {
            throw new Error(`Failed to save to database: ${dbError.message}`);
          }

          console.log(`  ✅ Added furniture to ${roomName}: ${furnitureImageUrl.substring(furnitureImageUrl.length - 40)}...`);

          return {
            room_id: roomId,
            room_name: roomName,
            after_url: furnitureImageUrl
          };
        } catch (error: any) {
          console.error(`  ❌ Error adding furniture to ${img.room_id}:`, error);
          return {
            room_id: img.room_id,
            error: error.message || 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if ('error' in result) {
          errors.push({ room_id: result.room_id, error: result.error });
        } else {
          results.push(result);
        }
      }

      console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imagesToProcess.length / batchSize)}: ${results.length} successful, ${errors.length} errors`);
    }

    console.log(`✅ R5: Completed. ${results.length} rooms updated with furniture, ${errors.length} errors`);

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      total: afterImages.length,
      already_existing: afterImages.length - imagesToProcess.length,
      errors: errors.length,
      error_details: errors,
      results: results
    });

  } catch (error: any) {
    console.error('❌ R5: Add Furniture Layer failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'add_furniture_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (restoreConsole) {
      restoreConsole();
    }
  }
}

