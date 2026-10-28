import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { getModelForTask } from '@/lib/model-registry';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

export const dynamic = 'force-dynamic';

type Tier = 'estandar' | 'optimo' | 'plus';

interface RenovationPrompt {
  room_id: string;
  room_name: string;
  element_id: string;
  prompt_text: string; // Whole paragraph per element, super detailed
}

interface RenovationPromptsResponse {
  prompts: RenovationPrompt[];
}

const responseSchema = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_id: { type: 'string' },
          room_name: { type: 'string' },
          element_id: { type: 'string' },
          prompt_text: { type: 'string' }
        },
        required: ['room_id', 'room_name', 'element_id', 'prompt_text']
      }
    }
  },
  required: ['prompts']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * R2b: Generate Detailed Renovation Prompts (Per-Photo Processing)
 * 
 * Refactored to:
 * 1. Use Final Renovation Scope (Node 3 output) as source of truth
 * 2. Process each photo separately (all elements for that photo in one call)
 * 3. Include cross-room visible elements (elements from other rooms visible in this photo)
 * 4. Parallelize per-photo calls
 * 
 * Endpoint: POST /api/listings/[id]/visuals/r2-prompt
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R2b';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

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

    logger.log(`📝 R2b: Generate Detailed Renovation Prompts (Per-Photo) for listing ${listingId}, tier ${tier}`);

    // Fetch R2a egocentric descriptions
    const { data: descriptions, error: descError } = await supabase
      .from('room_image_descriptions')
      .select('room_id, description_data')
      .eq('listing_id', listingId.toString());

    if (descError || !descriptions || descriptions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'r2a_descriptions_not_found',
          details: 'R2a egocentric descriptions not found. Run after/describe-room-images (R2a) first.'
        },
        { status: 404 }
      );
    }

    const descriptionsMap = new Map(
      descriptions.map(d => [d.room_id, d.description_data])
    );

    // Fetch Final Renovation Scope (Node 3: Unified Scope)
    const { data: scopeRecord, error: scopeError } = await supabase
      .from('final_renovation_scope')
      .select('scope_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (scopeError || !scopeRecord?.scope_data) {
      return NextResponse.json(
        {
          success: false,
          error: 'final_scope_not_found',
          details: 'Final Renovation Scope not found. Run unified-scope (Node 3) first.'
        },
        { status: 404 }
      );
    }

    const scopeData = scopeRecord.scope_data as any;
    const tierData = scopeData.tiers?.[tier];

    if (!tierData) {
      return NextResponse.json(
        {
          success: false,
          error: 'tier_data_missing',
          details: `Scope data for tier ${tier} is missing.`
        },
        { status: 404 }
      );
    }

    const workItems = tierData.work_items || [];

    // Build map of room_id -> elements for quick lookup
    const roomElementsMap = new Map<string, Array<{
      element_id: string;
      action: string;
      details: string;
      reason: string;
      room_id: string; // Original room this element belongs to
    }>>();

    // Filter to only renovation works
    // In Final Scope, everything is a work item, so we assume all are actionable
    const renovationWorks = workItems;

    // Group works by room_id
    for (const work of renovationWorks) {
      // Use room_ref as the primary key for grouping
      const roomId = work.room_ref || 'unknown';
      
      if (!roomElementsMap.has(roomId)) {
        roomElementsMap.set(roomId, []);
      }
      
      roomElementsMap.get(roomId)!.push({
        element_id: work.id,
        action: 'renovate', // Generic action, detailed in name/subtitle
        details: `${work.name} - ${work.subtitle || ''}`,
        reason: 'Part of renovation scope',
        room_id: roomId
      });
    }

    // Fetch master reference snippets (optional)
    const { data: masterRefs } = await supabase
      .from('master_reference_images')
      .select('element_id, reference_snippet, url')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier)
      .eq('element_type', 'architectural');

    const masterRefsMap = new Map(
      masterRefs?.map(r => [r.element_id, { snippet: r.reference_snippet, url: r.url }]) || []
    );
    
    if (masterRefsMap.size > 0) {
      logger.log(`  ℹ️  Found ${masterRefsMap.size} master reference(s) (optional)`);
    }

    // Filter to rooms that have R2a descriptions
    const roomsToProcess = Array.from(descriptionsMap.keys()).filter(roomId => {
      const hasOwnElements = (roomElementsMap.get(roomId) || []).length > 0;
      return hasOwnElements;
    });

    if (roomsToProcess.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_matching_rooms',
          details: 'No rooms found with both R2a descriptions and scope elements'
        },
        { status: 404 }
      );
    }

    logger.log(`🔄 Processing ${roomsToProcess.length} rooms (per-photo, parallelized)`);

    // Concurrency limiter
    const pLimit = <T,>(max: number, tasks: Array<() => Promise<T>>): Promise<T[]> => {
      if (max <= 1) return Promise.all(tasks.map((t) => t()));
      const results: T[] = [];
      let index = 0;
      let active = 0;
      return new Promise((resolve, reject) => {
        const next = () => {
          if (index >= tasks.length && active === 0) return resolve(results);
          while (active < max && index < tasks.length) {
            const current = tasks[index];
            index += 1;
            active += 1;
            current()
              .then((res) => { results.push(res); })
              .catch(reject)
              .finally(() => { active -= 1; next(); });
          }
        };
        next();
      });
    };

    // Process a single room (photo) - generates ALL prompts for that photo
    const processRoom = async (roomId: string): Promise<{
      room_id: string;
      prompts: RenovationPrompt[];
      error?: string;
    }> => {
      try {
        const egocentricDesc = descriptionsMap.get(roomId);
        if (!egocentricDesc) {
          throw new Error(`R2a description not found for ${roomId}`);
        }

        // Get this room's own elements only
        const ownElements = roomElementsMap.get(roomId) || [];

        if (ownElements.length === 0) {
          logger.log(`  ⏭️  Skipping ${roomId}: no elements to process`);
          return { room_id: roomId, prompts: [] };
        }

        logger.log(`  🏠 Processing ${roomId}: ${ownElements.length} element(s)`);

        // Build data for this room
        const roomData = {
          room_id: roomId,
          room_name: (egocentricDesc as any).room_name || roomId,
          egocentric_description: egocentricDesc,
          elements: ownElements.map(e => ({
            element_id: e.element_id,
            action: e.action,
            details: e.details,
            reason: e.reason,
            master_reference_snippet: masterRefsMap.get(e.element_id)?.snippet // Optional
          }))
        };

        const prompt = `Generate renovation prompts for image editing. You are generating prompts for ONE SPECIFIC PHOTO (room: ${roomId}).

TIER: ${tier}

CRITICAL: Generate prompts for ALL elements that belong to this room.

ROOM DATA:
${JSON.stringify(roomData, null, 2)}

TASK:
Generate a prompt for EACH element listed above. Each prompt MUST use frame-relative, plane-aware language that targets the visible region to edit.

FORMAT PER PROMPT (strict):
- target:
  - plane: one of [floor, wall_left, wall_right, wall_back, ceiling, opening_door, opening_window, fixture, surface_custom]
  - region: approximate position in frame (use thirds/percentages: "left third", "foreground 0-30%", "center 33-66%", etc.)
  - visibility: which faces are visible (top/front/left/right/bottom), what occludes it
- modify:
  - action: one of [replace, upgrade, refinish, recolor, relight_local]
  - material/finish: specific details (color, gloss, texture, pattern if applicable)
  - keep: edges, silhouette, opening extents, plane continuity, vanishing point alignment
- lighting_invariance:
  - preserve incoming light direction/intensity/shadow hardness

INTERPRETATION RULES:
- Use R2a egocentric description to determine plane and region
- "add/install" → modify/upgrade the existing element in that location; do NOT introduce new volume
- For openings (doors/windows), edits must stay within existing opening extents
- NEVER create new structures - only modify what exists in the frame

REQUIREMENTS FOR EACH PROMPT:
- Use frame-relative positioning
- Specify the plane being edited
- Describe material/finish changes precisely
- Keep structural edges and openings unchanged
- CRITICAL REALISM REQUIREMENT: Maintain the same photorealistic quality and realism level as the original listing photos.
- Only reference areas/elements that are visible in the photo according to R2a
- Keep camera angle, perspective, and framing the same
- Match lighting conditions from R2a
- Focus ONLY on this element - do not describe changes for other elements

OUTPUT:
Return JSON with prompts array, one per element, each with room_id, room_name, element_id, and prompt_text.
Each prompt_text should be a clear, direct instruction for editing the photo FOR THIS ELEMENT ONLY.

Return JSON with prompts array.`;

        // Call Gemini (one call per room/photo)
        const result = await callGeminiRest(prompt, {
          model: getModelForTask('visuals.prompt'),
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          thinkingConfig: { thinkingBudget: -1 }, // Use default thinking if available for this model
          maxOutputTokens: 65536,
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        });

        if (!result.success || !result.text) {
          throw new Error(result.error || 'Gemini call failed');
        }

        // Accumulate token usage
        if (result.usage) {
          totalInputTokens += result.usage.promptTokenCount || 0;
          totalOutputTokens += result.usage.candidatesTokenCount || 0;
          if (result.model) detectedModel = result.model;
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
          throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }

        // Validate structure
        if (!validateResponse(parsed)) {
          throw new Error(`Invalid response structure: ${JSON.stringify(validateResponse.errors)}`);
        }

        const promptsResponse = parsed as unknown as RenovationPromptsResponse;
        return { room_id: roomId, prompts: promptsResponse.prompts };

      } catch (error: any) {
        logger.error(`  ❌ Error processing room ${roomId}:`, error);
        return {
          room_id: roomId,
          prompts: [],
          error: error?.message || 'Unknown error'
        };
      }
    };

    // Check for existing prompts
    const { data: existingPrompts } = await supabase
      .from('renovation_prompts')
      .select('room_id, element_id')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier);

    const existingKeys = new Set(
      existingPrompts?.map(p => `${p.room_id}::${p.element_id}`) || []
    );

    // Filter rooms that need processing
    const roomsToGenerate = force
      ? roomsToProcess
      : roomsToProcess.filter(roomId => {
          // Check if room has any missing prompts
          const ownElements = roomElementsMap.get(roomId) || [];
          return ownElements.some(e => !existingKeys.has(`${roomId}::${e.element_id}`));
        });

    if (roomsToGenerate.length === 0) {
      logger.log(`⏭️  All rooms already have prompts`);
      return NextResponse.json({
        success: true,
        processed: 0,
        total_rooms: roomsToProcess.length,
        saved: 0,
        errors: 0,
        message: 'All prompts already exist'
      });
    }

    logger.log(`🔄 Generating prompts for ${roomsToGenerate.length} rooms (concurrency: 3)`);

    // Track token usage
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let detectedModel = getModelForTask('visuals.prompt');

    // Process rooms in parallel
    const concurrency = Math.max(1, Math.min(5, Number(process.env.R2B_ROOM_CONCURRENCY) || 3));
    const tasks = roomsToGenerate.map(roomId => () => processRoom(roomId));
    const roomResults = await pLimit(concurrency, tasks);

    // Collect all prompts and errors
    const allPrompts: RenovationPrompt[] = [];
    const allErrors: Array<{ room_id: string; error: string }> = [];

    for (const result of roomResults) {
      if (result.error) {
        allErrors.push({ room_id: result.room_id, error: result.error });
      } else {
        allPrompts.push(...result.prompts);
      }
    }

    logger.log(`✅ Generated ${allPrompts.length} prompts from ${roomResults.length} rooms`);

    // Save all prompts to database
    const allSaved: Array<{ room_id: string; element_id: string }> = [];
    const saveErrors: Array<{ room_id: string; element_id: string; error: string }> = [];

    for (const promptItem of allPrompts) {
      try {
        const { error: saveError } = await supabase
          .from('renovation_prompts')
          .upsert({
            listing_id: listingId.toString(),
            tier: tier,
            room_id: promptItem.room_id,
            element_id: promptItem.element_id,
            prompt_text: promptItem.prompt_text
          }, {
            onConflict: 'listing_id,tier,room_id,element_id'
          });

        if (saveError) {
          throw new Error(saveError.message);
        }

        allSaved.push({ room_id: promptItem.room_id, element_id: promptItem.element_id });
      } catch (error: any) {
        saveErrors.push({
          room_id: promptItem.room_id,
          element_id: promptItem.element_id,
          error: error?.message || 'Unknown error'
        });
      }
    }

    const totalProcessed = allSaved.length;
    const totalErrors = allErrors.length + saveErrors.length;
    logger.log(`✅ R2b: Completed. ${totalProcessed} prompts saved, ${totalErrors} errors`);

    return NextResponse.json({
      success: totalErrors === 0,
      processed: totalProcessed,
      total_rooms: roomsToProcess.length,
      rooms_processed: roomsToGenerate.length,
      saved: totalProcessed,
      errors: totalErrors,
      error_details: [...allErrors, ...saveErrors],
      alignment_applied: false,
      usage: {
        promptTokenCount: totalInputTokens,
        candidatesTokenCount: totalOutputTokens,
        totalTokenCount: totalInputTokens + totalOutputTokens
      },
      model: detectedModel
    });

  } catch (error: any) {
    logger.error('❌ R2b: Generate Detailed Renovation Prompts failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'prompt_generation_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
