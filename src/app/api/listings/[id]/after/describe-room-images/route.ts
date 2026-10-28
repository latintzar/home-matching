import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

export const dynamic = 'force-dynamic';

interface ElementVisibility {
  element_id: string;
  element_type: string;
  visible_sides: string[]; // e.g., ["front", "top", "left_edge"]
  occlusion_details: string;
  position_in_frame: string; // e.g., "left third", "center", "foreground"
}

interface RoomBoundary {
  boundary_type: string; // "doorway", "archway", "window", etc.
  visible_room: string; // room_id of adjacent room
  visible_elements: string[]; // natural language descriptions of what's visible (e.g., "floor", "wall")
  element_ids: string[]; // T6.5 element IDs that are visible (e.g., ["cluster_94_surface_floor"])
  extent_visible: string; // e.g., "approximately 2 meters of floor"
}

interface EgocentricDescription {
  room_id: string;
  room_name: string;
  camera_perspective: {
    angle: string; // e.g., "from left wall toward right wall"
    height: string; // e.g., "eye-level", "slightly elevated"
    tilt: string; // e.g., "level", "slight downward"
  };
  visible_elements: ElementVisibility[];
  boundaries: RoomBoundary[];
  occlusion_details: string[]; // Array of occlusion descriptions
  off_camera_elements: string[]; // What's not visible
  lighting_conditions: {
    source: string; // e.g., "harsh direct sunlight from upper right"
    shadows: string; // e.g., "deep, hard shadows"
    quality: string; // e.g., "bright", "soft", "harsh"
  };
}

interface EgocentricDescriptionsResponse {
  descriptions: EgocentricDescription[];
}

const responseSchema = {
  type: 'object',
  properties: {
    descriptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_id: { type: 'string' },
          room_name: { type: 'string' },
          camera_perspective: {
            type: 'object',
            properties: {
              angle: { type: 'string' },
              height: { type: 'string' },
              tilt: { type: 'string' }
            },
            required: ['angle', 'height', 'tilt']
          },
          visible_elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                element_id: { type: 'string' },
                element_type: { type: 'string' },
                visible_sides: { type: 'array', items: { type: 'string' } },
                occlusion_details: { type: 'string' },
                position_in_frame: { type: 'string' }
              },
              required: ['element_id', 'element_type', 'visible_sides', 'position_in_frame']
            }
          },
          boundaries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                boundary_type: { type: 'string' },
                visible_room: { type: 'string' },
                visible_elements: { type: 'array', items: { type: 'string' } },
                element_ids: { type: 'array', items: { type: 'string' } },
                extent_visible: { type: 'string' }
              },
              required: ['boundary_type', 'visible_room']
            }
          },
          occlusion_details: { type: 'array', items: { type: 'string' } },
          off_camera_elements: { type: 'array', items: { type: 'string' } },
          lighting_conditions: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              shadows: { type: 'string' },
              quality: { type: 'string' }
            },
            required: ['source', 'shadows', 'quality']
          }
        },
        required: ['room_id', 'room_name', 'camera_perspective', 'visible_elements', 'boundaries', 'occlusion_details', 'off_camera_elements', 'lighting_conditions']
      }
    }
  },
  required: ['descriptions']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * R2a: Describe Selected Images (Egocentric Camera-Centric Description)
 * 
 * Analyzes all selected wide-angle images together (single batch call).
 * References allocentric layout elements but describes from camera's perspective.
 * 
 * Describes:
 * - How allocentric layout elements are arranged from camera's POV
 * - What delineates boundary to another room
 * - Which parts of adjacent rooms are visible
 * - Which parts are off-camera
 * - Occlusion details
 * - Which sides of elements are visible
 * 
 * Endpoint: POST /api/listings/[id]/after/describe-room-images
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R2a';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { force }: { force?: boolean } = body;

    logger.log(`📸 R2a: Describe Selected Images (Egocentric) for listing ${listingId}`);

    // Fetch allocentric layouts (REQUIRED - saved by RoomByRoom endpoint)
    const { data: roomAnalysis, error: layoutError } = await supabase
      .from('room_analyses')
      .select('layout_allocentric, whole_home_summary')
      .eq('listing_id', listingId.toString())
      .single();

    if (layoutError || !roomAnalysis?.layout_allocentric || roomAnalysis.layout_allocentric.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'allocentric_layouts_not_found',
          details: 'Allocentric layouts not found. RoomByRoom must run before R2a.'
        },
        { status: 404 }
      );
    }

    const allocentricLayouts = roomAnalysis.layout_allocentric;
    const wholeHomeSummary = roomAnalysis.whole_home_summary;

    // Fetch Tier Element Synthesis (Phase 2: for element IDs - R2a runs after TierElementSynthesis)
    // This allows R2a to know which elements exist and can be referenced in boundaries
    const { data: synthesisData } = await supabase
      .from('tier_element_synthesis')
      .select('tier, synthesis_data')
      .eq('listing_id', listingId.toString());

    // Build element ID map: room_id -> element_ids[]
    // Only include actual cluster IDs (format: "89", "90", etc. or "cluster_89", "cluster_90")
    // Filter out group IDs like "all", "all_habitable", "bedrooms", etc.
    const roomElementIds = new Map<string, string[]>();
    if (synthesisData && synthesisData.length > 0) {
      for (const synthesis of synthesisData) {
        const works = synthesis.synthesis_data?.works || [];
        for (const work of works) {
          const roomId = work.room_id;
          const elementId = work.element_id;
          
          // Filter: Only process actual cluster IDs (numeric strings like "89", "90", or "cluster_89", "cluster_90")
          // Skip group IDs like "all", "all_habitable", "bedrooms", etc.
          const isClusterId = /^(cluster_)?\d+$/.test(roomId);
          if (!isClusterId) {
            continue; // Skip group IDs
          }
          
          // Normalize room_id to "cluster_X" format for consistency
          const normalizedRoomId = roomId.startsWith('cluster_') ? roomId : `cluster_${roomId}`;
        
        // Merge element IDs for each room (across all tiers)
          const existing = roomElementIds.get(normalizedRoomId) || [];
          if (!existing.includes(elementId)) {
            roomElementIds.set(normalizedRoomId, [...existing, elementId]);
          }
        }
      }
      logger.log(`📋 Loaded element IDs for ${roomElementIds.size} actual rooms (clusters) from Tier Element Synthesis`);
    } else {
      logger.log(`⚠️  No Tier Element Synthesis found - boundaries will not include element IDs`);
    }

    // Fetch F0 processed images (unfurnished OMSRIA images) - REQUIRED
    // R2a runs AFTER F0, so it must use F0 output (furniture-free OMSRIA images)
    const { data: f0Images, error: f0Error } = await supabase
      .from('listing_photos_furniture_free')
      .select('omsria_room_id, furniture_free_url, omsria_image_url')
      .eq('listing_id', listingId)
      .not('omsria_room_id', 'is', null); // Only F0 images with OMSRIA reference
    
    if (f0Error || !f0Images || f0Images.length === 0) {
      throw new Error(`F0 (remove-furniture) must be completed before R2a. No furniture-free images found. Run F0 first. Error: ${f0Error?.message || 'No images found'}`);
    }
    
    logger.log(`📸 Found ${f0Images.length} F0-processed images (furniture-free OMSRIA images)`);
    
    // Map F0 images by room_id
    const f0ImageMap = new Map(
      f0Images.map(img => [img.omsria_room_id, img.furniture_free_url])
    );
    
    // Get list of room IDs from F0 images
    const roomIds = Array.from(f0ImageMap.keys());

    // Extract cluster IDs from F0 room_ids (format: "cluster_91")
    const clusterIds = roomIds
      .map(roomId => {
        const match = roomId.match(/^cluster_(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((id): id is number => id !== null);

    if (clusterIds.length === 0) {
      throw new Error('No valid cluster IDs found in F0 results');
    }

    // Fetch cluster names for OMSRIA-processed rooms
    const { data: clusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, cluster_name')
      .eq('listing_id', listingId.toString())
      .in('id', clusterIds);

    if (clustersError) {
      logger.error('❌ Error fetching clusters:', clustersError);
      return NextResponse.json(
        {
          success: false,
          error: 'clusters_fetch_failed',
          details: clustersError.message
        },
        { status: 500 }
      );
    }

    // Build map: room_id -> cluster_name
    const clusterNameMap = new Map<string, string>();
    for (const cluster of clusters || []) {
      clusterNameMap.set(`cluster_${cluster.id}`, cluster.cluster_name);
    }

    // Check for existing descriptions
    const { data: existingDescriptions } = await supabase
      .from('room_image_descriptions')
      .select('room_id')
      .eq('listing_id', listingId);

    const existingRoomIds = new Set(existingDescriptions?.map(d => d.room_id) || []);

    // Filter F0 rooms to process (only those without existing descriptions, unless force=true)
    const roomsToProcess = force
      ? roomIds
      : roomIds.filter(roomId => !existingRoomIds.has(roomId));

    if (roomsToProcess.length === 0) {
      logger.log(`✅ All ${roomIds.length} F0-processed rooms already have descriptions`);
      return NextResponse.json({
        success: true,
        processed: 0,
        total: roomIds.length,
        already_existing: roomIds.length,
        message: 'All F0-processed rooms already have descriptions'
      });
    }

    logger.log(`🔄 Processing ${roomsToProcess.length} rooms (${roomIds.length - roomsToProcess.length} already exist)`);

    // Prepare images and room data for batch processing
    const imagesBase64: Array<{ mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }> = [];
    const roomData: Array<{ room_id: string; room_name: string; photo_url: string }> = [];

    for (const roomId of roomsToProcess) {
      const furnitureFreeUrl = f0ImageMap.get(roomId);
      const clusterName = clusterNameMap.get(roomId) || roomId; // Fallback to room_id if name not found
      
      if (!furnitureFreeUrl) {
        logger.warn(`  ⚠️  F0 image URL missing for room ${roomId}, skipping`);
        continue; // Skip instead of erroring
      }

      try {
        const response = await fetch(furnitureFreeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch F0 processed image: HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Ensure mimeType is one of the valid types
        const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
        const mimeType = (validMimeTypes.includes(contentType as any) ? contentType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

        imagesBase64.push({
          mimeType,
          data: base64
        });

        roomData.push({
          room_id: roomId,
          room_name: clusterName,
          photo_url: furnitureFreeUrl
        });
      } catch (e) {
        logger.warn(`  ⚠️  Error fetching ${furnitureFreeUrl}:`, e);
      }
    }

    if (imagesBase64.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_images_fetched',
          details: 'Could not fetch any images for processing'
        },
        { status: 500 }
      );
    }

    logger.log(`📸 Fetched ${imagesBase64.length} images for batch processing`);

    // Build comprehensive prompt for all rooms
    const roomsInfo = roomData.map((r, idx) => 
      `- Room ${idx + 1}: ${r.room_name} (${r.room_id})`
    ).join('\n');

    // Build element IDs context for prompt
    const elementIdsContext = Object.fromEntries(roomElementIds);
    const elementIdsContextStr = Object.keys(elementIdsContext).length > 0
      ? JSON.stringify(elementIdsContext, null, 2)
      : '{}';

    const prompt = `You are analyzing selected wide-angle images from multiple rooms to generate egocentric (camera-centric) descriptions.

ALLOCENTRIC ROOM LAYOUTS (what exists in each room):
${JSON.stringify(allocentricLayouts, null, 2)}

${wholeHomeSummary ? `WHOLE-HOME SUMMARY (spatial organization):
${JSON.stringify(wholeHomeSummary, null, 2)}` : ''}

ELEMENT IDs BY ROOM (from TierElementSynthesis - use these when identifying visible elements in boundaries):
${elementIdsContextStr}

ROOMS TO ANALYZE (in order of images):
${roomsInfo}

TASK:
For each room's selected image, generate an egocentric description that:
1. **References allocentric layout elements** but describes from camera's perspective
   - Example: "Left wall (rough white stucco) occupies left third of frame"
   - Example: "Floor (polished cream marble) - top surface visible from foreground to middle distance"

2. **Describes camera perspective**:
   - Angle: "from left wall toward right wall", "from entrance toward window"
   - Height: "eye-level", "slightly elevated", "low angle"
   - Tilt: "level", "slight downward", "looking up"

3. **Describes visible elements** with which sides visible:
   - Example: "Left wall (rough white stucco) - front face fully visible, right edge partially visible at corner, back face not visible"
   - Example: "Dining table (white wooden table) - top surface fully visible, front legs fully visible, back legs partially visible (occluded by tabletop), left side not visible, right side edge visible"
   - Include position_in_frame: "left third", "center", "foreground", "background"

4. **Describes boundaries to other rooms** (CRITICAL - include element IDs):
   - Example: "Arched doorway (white painted frame) visible on right wall, opening reveals Dining Area"
   - Example: "Through the archway, approximately 2 meters of Dining Area floor visible, with white table legs in frame"
   - What delineates the boundary (doorway, archway, window, etc.)
   - Which parts of adjacent rooms are visible (natural language in visible_elements)
   - **MUST include matching element IDs in element_ids array** - for each visible element description, find the corresponding element ID from the ELEMENT IDs BY ROOM section above
   - Example: If you see "floor" from Dining Area (cluster_94), include "cluster_94_surface_floor" in element_ids
   - Example: If you see "wall" from Kitchen (cluster_98), include "cluster_98_surface_walls" in element_ids
   - Extent visible (e.g., "approximately 2 meters")

5. **Describes occlusion**:
   - Example: "Dining table partially occludes view of floor behind it"
   - Example: "Left wall's front face visible, but right edge occluded by corner column"
   - Example: "Kitchen counter occludes lower portion of kitchen wall, but upper cabinets fully visible"

6. **Describes off-camera elements**:
   - Example: "Right wall extends beyond frame"
   - Example: "Ceiling not visible in this angle"
   - Example: "Back wall of adjacent room not visible, only opening visible"

7. **Describes lighting conditions**:
   - Source: "harsh direct sunlight from upper right", "soft natural light from window"
   - Shadows: "deep, hard shadows", "soft shadows", "minimal shadows"
   - Quality: "bright", "soft", "harsh", "dim"

CRITICAL:
- Reference allocentric layout elements explicitly
- Be specific about which sides/faces are visible (front, back, left, right, top, bottom)
- Describe occlusion in detail (what occludes what, what's partially visible)
- Describe lighting and shadows (important for later image generation)
- Match room order to image order
- **For boundaries: ALWAYS include element_ids array with matching T6.5 element IDs for each visible element**

OUTPUT:
Return JSON with descriptions array, one per room, matching the order of images provided.`;

    // Call Gemini with all images at once
    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: -1 },
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      images: imagesBase64
    });

    if (!result.success || !result.text) {
      logger.error('❌ Gemini call failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'gemini_call_failed',
          details: result.error || 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Parse response
    let cleaned = result.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      logger.error('❌ Failed to parse response:', parseError);
      logger.error('Response preview:', cleaned.substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: 'parse_error',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 500 }
      );
    }

    // Validate structure
    if (!validateResponse(parsed)) {
      logger.error('❌ Invalid response structure:', validateResponse.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_response_structure',
          details: JSON.stringify(validateResponse.errors)
        },
        { status: 500 }
      );
    }

    // Type assertion after validation
    if (!parsed.descriptions || !Array.isArray(parsed.descriptions)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_response_structure',
          details: 'Response missing descriptions array'
        },
        { status: 500 }
      );
    }

    const descriptionsResponse = parsed as unknown as EgocentricDescriptionsResponse;

    // Store descriptions in database
    const saved: string[] = [];
    const saveErrors: Array<{ room_id: string; error: string }> = [];

    for (const desc of descriptionsResponse.descriptions) {
      try {
        const { error: saveError } = await supabase
          .from('room_image_descriptions')
          .upsert({
            listing_id: listingId,
            room_id: desc.room_id,
            description_data: desc
          }, {
            onConflict: 'listing_id,room_id'
          });

        if (saveError) {
          throw new Error(saveError.message);
        }

        saved.push(desc.room_id);
        logger.log(`  ✅ Saved description for ${desc.room_name} (${desc.room_id})`);
      } catch (error: any) {
        logger.error(`  ❌ Failed to save description for ${desc.room_id}:`, error);
        saveErrors.push({
          room_id: desc.room_id,
          error: error.message || 'Unknown error'
        });
      }
    }

    logger.log(`✅ R2a: Completed. ${saved.length} descriptions saved, ${saveErrors.length} errors`);

    return NextResponse.json({
      success: saveErrors.length === 0,
      processed: saved.length,
      total: roomsToProcess.length,
      saved: saved.length,
      errors: saveErrors.length,
      error_details: saveErrors,
      descriptions: descriptionsResponse.descriptions,
      usage: result.usage,
      model: result.model
    });

  } catch (error: any) {
    logger.error('❌ R2a: Describe Selected Images failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'description_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

