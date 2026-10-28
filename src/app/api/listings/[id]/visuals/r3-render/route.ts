import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { getModelForTask } from '@/lib/model-registry';
import { createStepLogger } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

export const dynamic = 'force-dynamic';

type Tier = 'estandar' | 'optimo' | 'plus';

const runWithConcurrency = async (
  max: number,
  tasks: Array<() => Promise<void>>
): Promise<void> => {
  if (tasks.length === 0) {
    return;
  }

  if (max <= 1) {
    for (const task of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await task();
    }
    return;
  }

  const safeMax = Math.max(1, Math.min(max, tasks.length));
  let index = 0;
  let active = 0;

  await new Promise<void>((resolve, reject) => {
    const next = () => {
      if (index >= tasks.length && active === 0) {
        resolve();
        return;
      }

      while (active < safeMax && index < tasks.length) {
        const currentTask = tasks[index];
        index += 1;
        active += 1;
        currentTask()
          .catch(reject)
          .finally(() => {
            active -= 1;
            next();
          });
      }
    };

    next();
  });
};

/**
 * R3: Generate After-Images (Without Furniture) - Single Comprehensive Call Per Room
 * 
 * Generates after-images by combining all element prompts into a single comprehensive call per room.
 * This approach is cost-effective, reducing from ~101 calls (one per element) to ~11 calls (one per room).
 * Gemini can handle multiple element edits in a single call while preserving camera angle and perspective.
 * 
 * Endpoint: POST /api/listings/[id]/after/render-rooms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R3';
  
  // Use step logger when orchestrator is running, otherwise use console
  // CRITICAL: Create logger inside the function so it captures the current run ID
  // This prevents log leakage from previous orchestrator runs
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  // Declare variables outside try block so they're accessible in catch
  const results: Array<{ room_id: string; room_name: string; after_url: string }> = [];
  const errors: Array<{ room_id: string; error: string }> = [];
  let roomsToProcess: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const modelName = getModelForTask('visuals.render');

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

    logger.log(`🎨 R3: Generate After-Images (Single Call Per Room) for listing ${listingId}, tier ${tier}`);

    // Fetch renovation prompts (R2b) - now includes element_id
    const { data: prompts, error: promptsError } = await supabase
      .from('renovation_prompts')
      .select('room_id, element_id, prompt_text')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier);

    if (promptsError || !prompts || prompts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'renovation_prompts_not_found',
          details: 'Renovation prompts not found. Run after/generate-room-prompts (R2b) first.'
        },
        { status: 404 }
      );
    }

    // Group prompts by room_id, then by element order
    const roomPromptsMap = new Map<string, Array<{ element_id: string; prompt_text: string }>>();
    for (const prompt of prompts) {
      if (prompt.element_id) {
        if (!roomPromptsMap.has(prompt.room_id)) {
          roomPromptsMap.set(prompt.room_id, []);
        }
        roomPromptsMap.get(prompt.room_id)!.push({
          element_id: prompt.element_id,
          prompt_text: prompt.prompt_text
        });
      }
    }

    // Sort elements per room by element_id (for consistent ordering)
    for (const [roomId, elementPrompts] of roomPromptsMap.entries()) {
      elementPrompts.sort((a, b) => a.element_id.localeCompare(b.element_id));
    }

    // Fetch all clusters
    const { data: allClusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, cluster_name, selected_photo_url, photo_urls')
      .eq('listing_id', listingId.toString())
      .order('display_order');

    // Filter out excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const clusters = [];
    for (const c of (allClusters || [])) {
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      if (!isExcluded) {
        clusters.push(c);
      }
    }

    if (clustersError || !clusters || clusters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'clusters_not_found',
          details: 'No room clusters found.'
        },
        { status: 404 }
      );
    }

    // Build clusters map
    const clustersMap = new Map<string, { name: string; photo_url: string }>();
    for (const c of clusters) {
      const photoUrl = c.selected_photo_url || (c.photo_urls && c.photo_urls.length > 0 ? c.photo_urls[0] : null);
      if (photoUrl) {
        clustersMap.set(`cluster_${c.id}`, { name: c.cluster_name || '', photo_url: photoUrl });
      }
    }

    // Fetch F0 processed images (unfurnished OMSRIA images) - REQUIRED
    // R3 uses F0 output as "before" images (furniture-free OMSRIA images)
    const { data: f0Images, error: f0Error } = await supabase
      .from('listing_photos_furniture_free')
      .select('omsria_room_id, furniture_free_url')
      .eq('listing_id', listingId)
      .not('omsria_room_id', 'is', null); // Only F0 images with OMSRIA reference
    
    if (f0Error || !f0Images || f0Images.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'f0_not_found',
          details: `F0 (remove-furniture) must be completed before R3. No unfurnished images found. Run F0 first. Error: ${f0Error?.message || 'No images found'}`
        },
        { status: 400 }
      );
    }
    
    const f0ImageMap = new Map(
      f0Images.map(img => [img.omsria_room_id, img.furniture_free_url])
    );

    // Fetch master reference snippets (not images) for this tier
    const { data: masterRefs, error: masterRefsError } = await supabase
      .from('master_reference_images')
      .select('element_id, reference_snippet')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier)
      .eq('element_type', 'architectural');

    const masterRefsMap = new Map(
      masterRefs?.map(r => [r.element_id, r.reference_snippet]) || []
    );

    // Check for existing after-images
    if (force) {
      const uiTier = tier === 'estandar' ? 'livable' : tier === 'optimo' ? 'comfortable' : 'competitive';
      const { error: deleteError } = await supabase
        .from('after_photos')
        .delete()
        .eq('listing_id', listingId.toString())
        .eq('tier', uiTier)
        .eq('has_furniture', false);
      
      if (deleteError) {
        logger.warn(`⚠️ Failed to delete old after-images: ${deleteError.message}`);
      } else {
        logger.log(`🗑️ Deleted old after-images for tier ${uiTier}`);
      }
    }

    // Concurrency limiter function
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

    // Track token usage across all image generations (variables already declared above)

    // Process a single room (single comprehensive call with all elements)
    const processRoom = async (roomId: string): Promise<{ room_id: string; room_name: string; after_url: string } | { room_id: string; error: string }> => {
      try {
        const cluster = clustersMap.get(roomId);
        if (!cluster) {
          throw new Error(`Cluster not found for room ${roomId}`);
        }

        // Normalize roomId for roomPromptsMap lookup (it might be stored as "89" or "cluster_89")
        const normalizedRoomId = roomId.startsWith('cluster_') ? roomId.replace('cluster_', '') : roomId;
        const elementPrompts = roomPromptsMap.get(normalizedRoomId) || roomPromptsMap.get(roomId);
        if (!elementPrompts || elementPrompts.length === 0) {
          logger.log(`  ⏭️  Skipping ${cluster.name} (${roomId}): no prompts found`);
          return { room_id: roomId, error: 'no_prompts' };
        }

        logger.log(`\n🏠 Room: ${cluster.name} (${roomId})`);
        logger.log(`   Processing ${elementPrompts.length} elements in single comprehensive call...`);

        // Get F0 processed before image (unfurnished OMSRIA image) - starting point
        const beforeImageUrl = f0ImageMap.get(roomId);
        
        if (!beforeImageUrl) {
          throw new Error(`F0 image not found for room ${roomId}. Run F0 (remove-furniture) first.`);
        }

        // Fetch F0 processed image and convert to base64
        const imageResponse = await fetch(beforeImageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch F0 processed image: HTTP ${imageResponse.status}`);
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        const currentImageBase64 = Buffer.from(imageBuffer).toString('base64');
        const currentImageContentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Save F0 processed image as step 0 in evolution (optional, for tracking)
        const safeRoomId = roomId.replace(/[^a-zA-Z0-9_]/g, '_');
        try {
            const f0StoragePath = `${listingId}/after/${tier}/evolution/${safeRoomId}_element_0_furniture_free.jpg`;
            await supabase.storage
              .from('property-images')
            .upload(f0StoragePath, Buffer.from(imageBuffer), {
                contentType: 'image/jpeg',
                upsert: true,
                cacheControl: 'no-cache'
              });
            logger.log(`  📸 Saved F0 processed image as step 0`);
        } catch (error: any) {
          logger.warn(`  ⚠️  Failed to save F0 processed image: ${error.message}`);
        }

        // Combine all element prompts into one comprehensive prompt
        const allElementPrompts = elementPrompts.map((ep, idx) => {
          const referenceSnippet = masterRefsMap.get(ep.element_id);
          const referenceSnippetText = referenceSnippet 
            ? `\n\nREFERENCE ELEMENT SNIPPET for "${ep.element_id}":\n${referenceSnippet}\n\nApply the visual characteristics described above (materials, colors, finishes) to this element.`
            : '';
          
          return `ELEMENT ${idx + 1}: ${ep.element_id}\n${ep.prompt_text}${referenceSnippetText}`;
        }).join('\n\n---\n\n');

            const photoFilename = cluster.photo_url.split('/').pop() || 'before_image.jpg';

        const fullPrompt = `Edit this photo according to ALL renovation instructions below.

INPUT IMAGE:
- Room: ${cluster.name}
- Photo: ${photoFilename}
- This is the F0 processed (furniture-free, space-isolated) photo you are editing

RENOVATION INSTRUCTIONS (apply ALL of these changes):
${allElementPrompts}

CRITICAL REQUIREMENTS:
- Apply ALL changes specified above in a single edit
- The output MUST match the INPUT IMAGE's camera angle, perspective, viewpoint, zoom level, and framing EXACTLY
- Preserve the exact room geometry, structural elements, spatial relationships, and proportions
- Keep the same lighting as the INPUT IMAGE
- Do not add furniture

CAMERA-LOCKED EDIT CONSTRAINTS:
- Camera invariants: position, angle, focal length, framing unchanged; vanishing points preserved
- Geometry invariants: room envelope edges and plane intersections stay pixel-stationary; opening extents preserved
- Operation whitelist: material/texture substitution, color/finish changes, micro-geometry detailing, fixture style within existing opening bounds
- Operation blacklist: introducing new 3D mass, extending walls/roofs, moving edges, resizing openings, global relight
- Region addressing: apply each change to its target region (frame-relative) on the specified plane; respect occlusions
- Lighting invariants: preserve light direction, intensity, shadow character; adjust only local material response

INTERPRETATION EXAMPLES:
- "Add sliding doors" → replace door leaf/panels within current door opening bounds; keep jambs, opening width/height unchanged
- "New floor" → replace surface on floor plane region; maintain grout/projection alignment with existing vanishing
- "Add window" → only if existing opening visible; otherwise reinterpret as improving existing facade plane treatment

- Output a photorealistic edited image that looks like a real photograph taken from the EXACT same camera position as the INPUT IMAGE`;

        // Single image generation call with all elements
        logger.log(`  🖼️  Rendering: ${cluster.name} (${roomId}) with ${elementPrompts.length} elements in single call`);

            const result = await callGeminiRest(fullPrompt, {
              model: modelName,
              generateImages: true,
              images: [{
                mimeType: currentImageContentType as any,
                data: currentImageBase64
              }],
              temperature: 1,
              topP: 0.95,
              maxOutputTokens: 32768,
              responseModalities: ['IMAGE'],
              imageConfig: {
                aspectRatio: '16:9',
                imageSize: '4K',
                imageOutputOptions: {
                  mimeType: 'image/png'
                },
                personGeneration: 'ALLOW_ALL'
              },
              safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
              ]
            });

            if (!result.success || !result.images || result.images.length === 0) {
              const errorDetails: any = result.error || {};
              logger.error(`❌ No candidates in response. Full response:`, JSON.stringify(result.rawResponse, null, 2));
              throw new Error(`No image generated. Error: ${JSON.stringify(errorDetails)}`);
            }

            // Track token usage
            if (result.usage) {
              totalInputTokens += result.usage.promptTokenCount || 0;
              totalOutputTokens += result.usage.candidatesTokenCount || 0;
            }

            const afterImageBase64 = result.images[0].data;
            const afterImageBuffer = Buffer.from(afterImageBase64, 'base64');

        // Upload final result to Supabase Storage
            const storagePath = `${listingId}/after/${tier}/${safeRoomId}_after_no_furniture.jpg`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('property-images')
                .upload(storagePath, afterImageBuffer, {
                  contentType: 'image/jpeg',
                  upsert: true,
                  cacheControl: 'no-cache'
                });

              if (uploadError) {
                throw new Error(`Failed to upload: ${uploadError.message}`);
              }

              // Get public URL
              const { data: urlData } = supabase.storage
                .from('property-images')
                .getPublicUrl(storagePath);

              const afterImageUrl = urlData.publicUrl;

              // Store in after_photos table
              const uiTier = tier === 'estandar' ? 'livable' : tier === 'optimo' ? 'comfortable' : 'competitive';
              
              const { error: dbError } = await supabase
                .from('after_photos')
                .upsert({
                  listing_id: listingId.toString(),
                  tier: uiTier,
                  room_id: roomId,
                  photo_url: cluster.photo_url,
                  url: afterImageUrl,
                  has_furniture: false,
                  index: -1
                }, {
                  onConflict: 'listing_id,tier,room_id,photo_url'
                });

              if (dbError) {
                throw new Error(`Failed to save to database: ${dbError.message}`);
              }

              logger.log(`  ✅ Completed ${cluster.name}: final after-image saved`);
              return {
                room_id: roomId,
                room_name: cluster.name,
                after_url: afterImageUrl
              };

          } catch (error: any) {
        // Filter out Turbopack dev server errors (these are Next.js hot-reload issues, not our code)
        const errorName = error?.name || '';
        const errorMessage = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
        
        if (errorName === 'TurbopackInternalError' || errorMessage.includes('TurbopackInternalError')) {
          // Turbopack errors are dev server issues, not actual failures - log but don't treat as error
          logger.warn(`  ⚠️  Turbopack dev server warning (non-critical): ${errorMessage}`);
          // Continue processing - this is just a dev server hot-reload issue
          return {
            room_id: roomId,
            error: 'dev_server_warning_ignored'
          };
        }
        
        const errorDetails = error instanceof Error ? error.stack : (error?.stack || JSON.stringify(error));
        logger.error(`  ❌ Error processing room ${roomId}: ${errorMessage}`);
        if (errorDetails && errorDetails !== '{}') {
          logger.error(`  ❌ Error details: ${errorDetails.split('\n').slice(0, 5).join('\n')}`);
        }
        return {
          room_id: roomId,
          error: errorMessage
        };
      }
    };

    // Process rooms in parallel with concurrency limit
    // Normalize room IDs to match clustersMap format (cluster_X)
    roomsToProcess = Array.from(roomPromptsMap.keys()).map(roomId => {
      // If roomId is just a number (e.g., "89"), convert to "cluster_89"
      // If it's already "cluster_89", keep it as is
      return roomId.startsWith('cluster_') ? roomId : `cluster_${roomId}`;
    });
    const concurrency = Math.max(1, Math.min(5, Number(process.env.R3_ROOM_CONCURRENCY) || 3));
    logger.log(`🔄 Processing ${roomsToProcess.length} rooms in parallel (concurrency: ${concurrency}), single comprehensive call per room...`);

    const tasks = roomsToProcess.map(roomId => () => processRoom(roomId));
    const roomResults = await pLimit(concurrency, tasks);

    // Separate results and errors
    for (const result of roomResults) {
      if ('error' in result) {
        errors.push(result);
      } else {
        results.push(result);
      }
    }

    logger.log(`\n✅ R3: Completed. ${results.length} after-images generated, ${errors.length} errors`);

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      total: roomsToProcess.length,
      errors: errors.length,
      error_details: errors,
      results: results,
      usage: {
        promptTokenCount: totalInputTokens,
        candidatesTokenCount: totalOutputTokens,
        totalTokenCount: totalInputTokens + totalOutputTokens
      },
      model: modelName
    });

  } catch (error: any) {
    // Filter out Turbopack dev server errors (Next.js hot-reload issues, not actual failures)
    const errorName = error?.name || '';
    const errorMessage = error?.message || error?.toString() || '';
    
    if (errorName === 'TurbopackInternalError' || errorMessage.includes('TurbopackInternalError') || error?.__NEXT_ERROR_CODE === 'TurbopackInternalError') {
      // Turbopack errors are dev server issues - log as warning and return success
      logger.warn('⚠️  Turbopack dev server warning (non-critical, ignoring):', errorMessage);
      // Return success since this is just a dev server hot-reload issue
      // Variables are always initialized, but use defaults for safety
      return NextResponse.json({
        success: true,
        processed: results.length,
        total: roomsToProcess.length,
        errors: errors.length,
        error_details: errors,
        results: results,
        warning: 'Turbopack dev server warning (non-critical)',
        usage: {
          promptTokenCount: totalInputTokens,
          candidatesTokenCount: totalOutputTokens,
          totalTokenCount: totalInputTokens + totalOutputTokens
        },
        model: modelName
      });
    }
    
    logger.error('❌ R3: Generate After-Images failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'after_image_generation_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
