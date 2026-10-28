/**
 * OMSRIA (Organic Multi-Space Reduction Image Altering) Endpoint
 * 
 * Pipeline Position: R1.5 (after R1: select-room-images, before R2a: describe-room-images)
 * 
 * Process:
 * 1. Filter: Only process images with visibility_mappings
 * 2. Step 1: Generate prompts for Step 2 (parallel)
 * 3. Step 2: Generate editing plans (parallel)
 * 4. Step 3: Execute editing plans with retry validation (parallel across images)
 * 5. Step 4: Dead-end detection and storage
 * 6. Step 5: Optimization pass (redundancy elimination)
 * 7. Step 6: Final output
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePromptForStep2 } from '@/lib/omsria/generate-prompt';
import { generateEditingPlan } from '@/lib/omsria/generate-plan';
import { executeEditingPlan } from '@/lib/omsria/execute-plan';
import { extractSpaceInfo, detectRedundancy, makeSelectionDecision, ImageInfo } from '@/lib/omsria/optimize-images';
import { storePhotoInSupabase } from '@/lib/photo-storage';
import { createStepLogger } from '@/lib/orchestrator-progress';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * Fetch image as base64
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'PuedoCasa-OMSRIA/1.0' }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
  
  if (contentType.includes('image/webp')) mimeType = 'image/webp';
  else if (contentType.includes('image/png')) mimeType = 'image/png';
  else if (contentType.includes('image/gif')) mimeType = 'image/gif';

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType };
}

/**
 * POST: Run OMSRIA process
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R1.5';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.log(`🚀 OMSRIA PROCESS STARTING`);
    logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.log(`   Listing ID: ${listingId}`);
    logger.log(`   Timestamp: ${new Date().toISOString()}\n`);

    // PREREQUISITE CHECK: Verify R1 (select-room-images) has run
    logger.log(`\n🔍 Checking prerequisites...`);
    // R1.5 depends on R1, not F0 (F0 now runs after R1.5)
    const { data: clustersWithSelection, error: r1CheckError } = await supabase
      .from('clusters')
      .select('id, cluster_name, selected_photo_url')
      .eq('listing_id', listingId.toString())
      .not('selected_photo_url', 'is', null)
      .limit(1);
    
    if (r1CheckError || !clustersWithSelection || clustersWithSelection.length === 0) {
      const errorMsg = `Prerequisite failed: R1 (select-room-images) must be run before R1.5 (OMSRIA). No clusters with selected photos found for listing ${listingId}.`;
      logger.error(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.error(`❌ ${errorMsg}`);
      logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return NextResponse.json({
        success: false,
        error: 'prerequisite_failed',
        details: errorMsg
      }, { status: 400 });
    }
    logger.log(`   ✅ R1 (select-room-images) has run - found ${clustersWithSelection.length} cluster(s) with selected photos`);

    // Fetch normalized clusters from database view (includes normalized visibility mappings)
    logger.log(`\n📥 Fetching normalized clusters from database view...`);
    const { data: normalizedClusters, error: normalizedError } = await supabase
      .from('clusters_normalized')
      .select('*')
      .eq('listing_id', listingId.toString())
      .order('display_order');

    if (normalizedError) {
      throw new Error(`Failed to fetch normalized clusters: ${normalizedError.message}`);
    }

    if (!normalizedClusters || normalizedClusters.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'no_clusters_found',
        details: 'No clusters found for this listing'
      }, { status: 404 });
    }

    logger.log(`   ✅ Found ${normalizedClusters.length} normalized cluster(s)`);
    
    // Check clusters with selected photos
    const clustersWithSelected = normalizedClusters.filter(c => c.selected_photo_url);
    logger.log(`   📊 Clusters with selected photos: ${clustersWithSelected.length}`);

    // Filter: Only process images with visibility_mappings (using normalized visibility mappings)
    const clustersWithVisibility = normalizedClusters.filter(c => {
      const mappings = c.visibility_mappings_normalized as Record<string, { visible_rooms?: string[] }> | null;
      const selectedPhoto = c.selected_photo_url;
      return selectedPhoto && mappings && mappings[selectedPhoto] && mappings[selectedPhoto].visible_rooms && mappings[selectedPhoto].visible_rooms!.length > 0;
    });

    const clustersWithoutVisibility = normalizedClusters.filter(c => {
      const mappings = c.visibility_mappings_normalized as Record<string, { visible_rooms?: string[] }> | null;
      const selectedPhoto = c.selected_photo_url;
      return !selectedPhoto || !mappings || !mappings[selectedPhoto] || !mappings[selectedPhoto].visible_rooms || mappings[selectedPhoto].visible_rooms!.length === 0;
    });

    logger.log(`\n   📊 Filtering Results:`);
    logger.log(`      Clusters WITH visibility mappings: ${clustersWithVisibility.length}`);
    logger.log(`      Clusters WITHOUT visibility mappings: ${clustersWithoutVisibility.length}`);

    // Build cluster names map for reference (already in normalized clusters, but keep for compatibility)
    const clusterNames = new Map(normalizedClusters.map(c => [c.cluster_id, c.cluster_name]));
    
    // Note: clusters_normalized view already includes selected_photo_furniture_free_url
    // No need to build a map - use the view's field directly

    // Process clusters WITH visibility mappings (OMSRIA)
    const processedImages: Array<{
      room_id: string;
      image_url: string;
      image_type: 'SINGLE_SPACE' | 'DEAD_END' | 'MULTI_SPACE';
      visible_spaces: string[];
      hidden_spaces: string[];
      unavoidable_spaces: string[];
      editing_plan: any;
      retry_counts: Record<string, number>;
    }> = [];

    // Process clusters WITHOUT visibility mappings (direct SINGLE_SPACE)
    if (clustersWithoutVisibility.length > 0) {
      logger.log(`\n📋 Processing ${clustersWithoutVisibility.length} cluster(s) without visibility mappings (direct SINGLE_SPACE)...`);
      for (const cluster of clustersWithoutVisibility) {
        const selectedPhoto = cluster.selected_photo_url;
        if (!selectedPhoto) continue;

        // Use original selected photo URL (R1.5 now uses original photos, F0 runs after)
        // Directly store as SINGLE_SPACE
        processedImages.push({
          room_id: `cluster_${cluster.cluster_id}`,
          image_url: selectedPhoto,
          image_type: 'SINGLE_SPACE',
          visible_spaces: [cluster.cluster_name],
          hidden_spaces: [],
          unavoidable_spaces: [],
          editing_plan: null,
          retry_counts: {}
        });
        logger.log(`   ✅ ${cluster.cluster_name} → SINGLE_SPACE (no processing needed)`);
      }
    }

    // Process clusters WITH visibility mappings (OMSRIA steps) - PARALLEL
    if (clustersWithVisibility.length > 0) {
      logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.log(`🎯 PROCESSING CLUSTERS WITH VISIBILITY MAPPINGS`);
      logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.log(`   Total clusters to process: ${clustersWithVisibility.length} (sequential)\n`);
    }
    
    // Utility function for parallel processing
    // CRITICAL: Handles errors gracefully - doesn't reject on individual task failures
    // This ensures all tasks complete even if some fail
    const limitConcurrency = async <T, R>(
      items: T[],
      maxConcurrency: number,
      handler: (item: T, index: number) => Promise<R>
    ): Promise<R[]> => {
      if (items.length === 0) return Promise.resolve([]);
      if (maxConcurrency <= 1) {
        // Sequential processing - handle errors gracefully
        const results: R[] = [];
        for (let i = 0; i < items.length; i++) {
          try {
            const result = await handler(items[i], i);
            results[i] = result;
          } catch (error) {
            // Handler should catch errors, but if it doesn't, log and continue
            logger.error(`Error in sequential handler for item ${i}:`, error);
            results[i] = null as R; // Will be filtered out downstream
          }
        }
        return results;
      }
      
      const results: R[] = new Array(items.length);
      let nextIndex = 0;
      let active = 0;
      let completed = 0;
      
      return new Promise((resolve, reject) => {
        const processNext = () => {
          // Start new tasks if we have capacity and more items
          while (active < maxConcurrency && nextIndex < items.length) {
            const currentIndex = nextIndex++;
            active++;
            
            handler(items[currentIndex], currentIndex)
              .then((result) => {
                results[currentIndex] = result;
                active--;
                completed++;
                // Continue processing or resolve if all done
                if (completed === items.length) {
                  resolve(results);
                } else {
                  processNext();
                }
              })
              .catch((error) => {
                // For OMSRIA, we want errors to propagate (clusters can't fail)
                // Log error with full details but re-throw so the endpoint fails loudly
                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;
                logger.error(`\n❌ Error processing item ${currentIndex} (cluster ${clustersWithVisibility[currentIndex]?.cluster_name}):`);
                logger.error(`   Message: ${errorMsg}`);
                if (errorStack) {
                  logger.error(`   Stack: ${errorStack.split('\n').slice(0, 5).join('\n')}`);
    }
                active--;
                completed++;
                // Reject the entire promise - these clusters CANNOT fail
                reject(error);
              });
          }
          
          // If no more items to start and all active tasks are done, resolve
          if (nextIndex >= items.length && active === 0 && completed === items.length) {
            resolve(results);
          }
        };
        
        processNext();
      });
    };
    
    const processCluster = async (cluster: typeof clustersWithVisibility[0], index: number): Promise<typeof processedImages[0] | null> => {
      try {
        const selectedPhoto = cluster.selected_photo_url!;
        // Use original selected photo URL (R1.5 now uses original photos, F0 runs after)

        // Fetch image
        logger.log(`   📥 Fetching original image...`);
        const { base64, mimeType } = await fetchImageAsBase64(selectedPhoto);
        logger.log(`   ✅ Image fetched (${mimeType}, ${Math.round(base64.length / 1024)}KB)`);

        // Use normalized visibility mappings (already has room names, not IDs)
        const visibilityMappings = cluster.visibility_mappings_normalized as Record<string, { visible_rooms?: string[] }> | null;
        const mapping = visibilityMappings?.[selectedPhoto];
        const visibleSpaceNames = mapping?.visible_rooms || [];

        logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.log(`🔄 Processing: ${cluster.cluster_name} (Cluster ${cluster.cluster_id})`);
        logger.log(`   Primary Space: ${cluster.cluster_name}`);
        logger.log(`   Visible Spaces: ${visibleSpaceNames.join(', ') || 'None'}`);
        logger.log(`   Selected Photo URL: ${selectedPhoto}`);
        logger.log(`   ✅ Using original image (F0 will process after R1.5)`);

        // Step 1: Generate prompt for Step 2
        logger.log(`\n   📝 Step 1: Generating tailored prompt for Step 2...`);
        
        if (visibleSpaceNames.length === 0) {
          throw new Error(`No visible spaces found for selected photo: ${selectedPhoto}`);
        }
        
        const step1Result = await generatePromptForStep2({
          imageBase64: base64,
          imageMimeType: mimeType,
          visibleClusterNames: visibleSpaceNames, // Stage 4 format: names directly
          primaryClusterName: cluster.cluster_name
        });
        logger.log(`   ✅ Step 1 complete - Prompt generated (${step1Result.prompt.length} chars)`);

        // Step 2: Generate editing plan
        logger.log(`\n   📋 Step 2: Generating OMSRIA editing plan...`);
        const step2Result = await generateEditingPlan({
          imageBase64: base64,
          imageMimeType: mimeType,
          step1Prompt: step1Result.prompt
        });

        const plan = step2Result.plan;
        logger.log(`   ✅ Step 2 complete - Plan generated:`);
        logger.log(`      Decision: ${plan.decision}`);
        logger.log(`      Reasoning: ${plan.reasoning || 'None'}`);
        logger.log(`      Prompts: ${plan.prompts.length}`);
        if (plan.prompts.length > 0) {
          plan.prompts.forEach((prompt) => {
            logger.log(`        Prompt ${prompt.id}: ${prompt.text.substring(0, 80)}${prompt.text.length > 80 ? '...' : ''}`);
          });
        } else {
          logger.log(`      ⚠️  WARNING: Plan has no prompts - image will be saved unchanged`);
          logger.log(`      Step 1 prompt length: ${step1Result.prompt.length} chars`);
          logger.log(`      Step 1 prompt preview: ${step1Result.prompt.substring(0, 200)}${step1Result.prompt.length > 200 ? '...' : ''}`);
        }
        if (plan.decision === 'NOT_POSSIBLE') {
          logger.log(`      ⚠️  WARNING: Plan marked as NOT_POSSIBLE - image will be saved unchanged`);
          logger.log(`      Step 1 prompt length: ${step1Result.prompt.length} chars`);
          logger.log(`      Step 1 prompt preview: ${step1Result.prompt.substring(0, 200)}${step1Result.prompt.length > 200 ? '...' : ''}`);
        }

        // Step 3: Execute editing plan (if there are prompts)
        let finalImageBase64 = base64;
        let retryCounts: Record<string, number> = {};
        let executionSuccess = false;

        if (plan.prompts.length > 0) {
          logger.log(`\n   🎨 Step 3: Executing editing plan (${plan.prompts.length} prompts)...`);
          const step3Result = await executeEditingPlan({
            imageBase64: base64,
            imageMimeType: mimeType,
            editingPlan: plan,
            targetSpaces: visibleSpaceNames, // Pass visible spaces for validation
            maxRetries: 10
          });
          finalImageBase64 = step3Result.finalImageBase64;
          retryCounts = step3Result.retryCounts;
          executionSuccess = step3Result.success;
          
          logger.log(`   ✅ Step 3 complete - All prompts executed`);
          const totalRetries = Object.values(retryCounts).reduce((sum, count) => sum + count, 0);
          if (totalRetries > 0) {
            logger.log(`      Retry Summary:`);
            Object.entries(retryCounts).forEach(([promptKey, count]) => {
              if (count > 0) {
                logger.log(`        ${promptKey}: ${count} retries`);
              }
            });
          } else {
            logger.log(`      All prompts succeeded on first attempt ✨`);
          }
        } else {
          logger.log(`   ⏭️  Step 3 skipped - No prompts to execute`);
          if (plan.decision === 'NOT_POSSIBLE') {
            logger.log(`      Reason: Plan marked as NOT_POSSIBLE`);
          } else {
            logger.log(`      Reason: Plan has empty prompts array (${plan.prompts.length} prompts)`);
          }
          logger.log(`      ⚠️  Image will be saved unchanged (original image)`);
        }

        // Determine image type AFTER execution
        // Mark as DEAD_END if Decision is NOT_POSSIBLE, PARTIALLY_POSSIBLE, OR execution failed
        let imageType: 'SINGLE_SPACE' | 'DEAD_END' = 'SINGLE_SPACE';
        if (plan.decision === 'NOT_POSSIBLE') {
          imageType = 'DEAD_END';
          logger.log(`   ⚠️  Marked as DEAD_END (NOT_POSSIBLE)`);
        } else if (plan.decision === 'PARTIALLY_POSSIBLE') {
          imageType = 'DEAD_END';
          logger.log(`   ⚠️  Marked as DEAD_END (PARTIALLY_POSSIBLE - some spaces unavoidable)`);
        } else if (plan.prompts.length > 0 && !executionSuccess) {
          imageType = 'DEAD_END';
          logger.log(`   ⚠️  Marked as DEAD_END (execution failed)`);
        }

        // Upload processed image to storage
        logger.log(`\n   💾 Step 4: Uploading processed image to storage...`);
        const processedImageBuffer = Buffer.from(finalImageBase64, 'base64');
        const storagePath = `${listingId}/omsria/cluster_${cluster.cluster_id}_processed.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(storagePath, processedImageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Failed to upload processed image: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(storagePath);

        const processedImageUrl = urlData.publicUrl;
        logger.log(`   ✅ Image uploaded: ${storagePath}`);

        // Build visible spaces array
        // For SINGLE_SPACE: only primary space (all others hidden)
        // For DEAD_END: primary space (some spaces may be unavoidable but we don't track them separately)
        const visibleSpaces = [cluster.cluster_name];

        // Return result
        const result = {
          room_id: `cluster_${cluster.cluster_id}`,
          image_url: processedImageUrl,
          image_type: imageType,
          visible_spaces: visibleSpaces,
          hidden_spaces: visibleSpaceNames, // Spaces we tried to hide
          unavoidable_spaces: plan.decision === 'PARTIALLY_POSSIBLE' ? visibleSpaceNames : [], // If partially possible, some may be unavoidable
          editing_plan: plan,
          retry_counts: retryCounts
        };

        logger.log(`\n   ✅ ${cluster.cluster_name} complete: ${imageType}`);
        logger.log(`      Visible: ${visibleSpaces.join(', ')}`);
        if (visibleSpaceNames.length > 0) {
          logger.log(`      Hidden: ${visibleSpaceNames.join(', ')}`);
        }
        if (plan.decision === 'PARTIALLY_POSSIBLE') {
          logger.log(`      Note: Some spaces may be partially visible (PARTIALLY_POSSIBLE)`);
        }
        logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        return result;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.error(`❌ CRITICAL ERROR processing ${cluster.cluster_name} (Cluster ${cluster.cluster_id})`);
        logger.error(`   Error: ${errorMessage}`);
        logger.error(`   Selected Photo URL: ${cluster.selected_photo_url || 'NOT FOUND'}`);
        if (errorStack) {
          logger.error(`   Stack (first 10 lines):`);
          logger.error(errorStack.split('\n').slice(0, 10).join('\n'));
        }
        logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        // Re-throw instead of returning null - we need to know what failed
        throw new Error(`Failed to process cluster ${cluster.cluster_id} (${cluster.cluster_name}): ${errorMessage}`);
      }
    };
    
    // Process clusters sequentially (1 at a time) for easier error tracking
    logger.log(`🔄 Starting sequential processing of ${clustersWithVisibility.length} clusters (1 at a time)...`);
    const clusterResults = await limitConcurrency(clustersWithVisibility, 1, processCluster);
    
    // Collect successful results and track failures
    // Note: With improved error handling, failures will throw instead of returning null
    // But we still check for nulls in case limitConcurrency catches errors
    const failedClusters: Array<{ cluster_id: number; cluster_name: string; error?: string }> = [];
    for (let i = 0; i < clusterResults.length; i++) {
      const result = clusterResults[i];
      const cluster = clustersWithVisibility[i];
      if (result) {
        processedImages.push(result);
      } else {
        // This shouldn't happen now (errors throw), but check anyway
        failedClusters.push({
          cluster_id: cluster.cluster_id,
          cluster_name: cluster.cluster_name,
          error: 'Unknown error - returned null'
        });
      }
    }
    
    logger.log(`✅ Parallel processing complete: ${processedImages.length} successful, ${failedClusters.length} failed`);
    
    // CRITICAL: Fail loudly if any clusters failed - these clusters CANNOT fail
    if (failedClusters.length > 0) {
      const failedNames = failedClusters.map(c => `${c.cluster_name} (${c.cluster_id})`).join(', ');
      const errorMsg = `❌ CRITICAL: ${failedClusters.length} cluster(s) failed processing: ${failedNames}. These clusters have visibility mappings and MUST be processed.`;
      logger.error(errorMsg);
      logger.error(`   Failed clusters: ${JSON.stringify(failedClusters, null, 2)}`);
      throw new Error(errorMsg);
    }

    // Step 5: Optimization Pass
    logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.log(`🔍 Step 5: Running optimization pass (redundancy elimination)...`);
    logger.log(`   Total images processed: ${processedImages.length}`);
    
    // Extract space info (already done, but ensure consistency)
    const imageInfos: ImageInfo[] = processedImages.map(img => ({
      image_id: img.room_id,
      image_url: img.image_url,
      image_type: img.image_type,
      room_id: img.room_id,
      visible_spaces: img.visible_spaces,
      unavoidable_spaces: img.unavoidable_spaces,
      editing_plan: img.editing_plan
    }));

    const extractedInfos = extractSpaceInfo(imageInfos);
    const redundancyCases = detectRedundancy(extractedInfos);

    logger.log(`   📊 Found ${redundancyCases.length} redundancy case(s)`);
    
    if (redundancyCases.length > 0) {
      redundancyCases.forEach((rc, idx) => {
        logger.log(`\n   Case ${idx + 1}:`);
        logger.log(`      DEAD_END Image: ${rc.deadEndImage.room_id} (shows: ${rc.deadEndImage.visible_spaces.join(', ')})`);
        logger.log(`      SINGLE_SPACE Images: ${rc.singleSpaceImages.map(img => `${img.room_id} (${img.visible_spaces[0]})`).join(', ')}`);
      });
    } else {
      logger.log(`   ✅ No redundancy detected - all images are unique`);
    }

    // Process each redundancy case
    const imagesToMarkRedundant = new Set<string>();
    const imagesToReclassify: Array<{ room_id: string; new_type: 'MULTI_SPACE' }> = [];

    for (let idx = 0; idx < redundancyCases.length; idx++) {
      const redundancyCase = redundancyCases[idx];
      try {
        logger.log(`\n   🤔 Making selection decision for Case ${idx + 1}...`);
        const decision = await makeSelectionDecision(redundancyCase);
        
        logger.log(`   ✅ Decision: ${decision.decision}`);
        logger.log(`      Reasoning: ${decision.reasoning}`);
        logger.log(`      Keep: ${decision.images_to_keep.join(', ')}`);
        logger.log(`      Discard: ${decision.images_to_discard.join(', ')}`);
        
        if (decision.decision === 'KEEP_MULTI_SPACE') {
          // Mark DEAD_END as MULTI_SPACE, discard SINGLE_SPACE images
          imagesToReclassify.push({
            room_id: redundancyCase.deadEndImage.room_id,
            new_type: 'MULTI_SPACE'
          });
          decision.images_to_discard.forEach(id => imagesToMarkRedundant.add(id));
        } else {
          // Keep SINGLE_SPACE images, discard DEAD_END
          imagesToMarkRedundant.add(redundancyCase.deadEndImage.room_id);
        }
      } catch (error: any) {
        logger.error(`   ❌ Error making selection decision:`, error);
        // Default: keep multi-space
        logger.log(`   ⚠️  Defaulting to KEEP_MULTI_SPACE`);
        imagesToReclassify.push({
          room_id: redundancyCase.deadEndImage.room_id,
          new_type: 'MULTI_SPACE'
        });
        redundancyCase.singleSpaceImages.forEach(img => imagesToMarkRedundant.add(img.room_id));
      }
    }
    
    logger.log(`\n   📊 Optimization Summary:`);
    logger.log(`      Images to reclassify: ${imagesToReclassify.length}`);
    logger.log(`      Images to mark redundant: ${imagesToMarkRedundant.size}`);
    logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Step 6: Save to database
    logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.log(`💾 Step 6: Saving results to database...`);

    // Delete existing OMSRIA results for this listing
    logger.log(`   🗑️  Deleting existing OMSRIA results for listing ${listingId}...`);
    const { error: deleteError } = await supabase
      .from('omsria_processed_images')
      .delete()
      .eq('listing_id', listingId.toString());
    
    if (deleteError) {
      logger.warn(`   ⚠️  Warning: Failed to delete existing results: ${deleteError.message}`);
    } else {
      logger.log(`   ✅ Existing results deleted`);
    }

    // Insert all processed images
    const insertData = processedImages.map(img => ({
      listing_id: listingId.toString(),
      room_id: img.room_id,
      image_url: img.image_url,
      image_type: imagesToMarkRedundant.has(img.room_id) 
        ? img.image_type // Will be marked redundant
        : imagesToReclassify.find(r => r.room_id === img.room_id)?.new_type || img.image_type,
      visible_spaces: img.visible_spaces,
      hidden_spaces: img.hidden_spaces,
      unavoidable_spaces: img.unavoidable_spaces,
      editing_plan: img.editing_plan,
      retry_counts: img.retry_counts,
      is_redundant: imagesToMarkRedundant.has(img.room_id)
    }));

    logger.log(`   📝 Inserting ${insertData.length} image record(s)...`);
    const { error: insertError } = await supabase
      .from('omsria_processed_images')
      .insert(insertData);

    if (insertError) {
      throw new Error(`Failed to save OMSRIA results: ${insertError.message}`);
    }

    const finalCount = insertData.filter(img => !img.is_redundant).length;
    const redundantCount = insertData.filter(img => img.is_redundant).length;
    const singleSpaceCount = insertData.filter(img => !img.is_redundant && img.image_type === 'SINGLE_SPACE').length;
    const multiSpaceCount = insertData.filter(img => !img.is_redundant && img.image_type === 'MULTI_SPACE').length;

    // Build clear list of valid (non-redundant) clusters for downstream processing
    const validClusters = insertData
      .filter(img => !img.is_redundant)
      .map(img => ({
        room_id: img.room_id,
        image_type: img.image_type,
        visible_spaces: img.visible_spaces
      }));

    const redundantClusters = insertData
      .filter(img => img.is_redundant)
      .map(img => img.room_id);

    logger.log(`   ✅ Database save complete`);
    logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.log(`✅ OMSRIA PROCESS COMPLETE`);
    logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.log(`   📊 Final Statistics:`);
    logger.log(`      Total processed: ${processedImages.length}`);
    logger.log(`      Kept (active): ${finalCount}`);
    logger.log(`         - SINGLE_SPACE: ${singleSpaceCount}`);
    logger.log(`         - MULTI_SPACE: ${multiSpaceCount}`);
    logger.log(`      Marked redundant: ${redundantCount}`);
    logger.log(`   📋 Valid Clusters (${validClusters.length}): ${validClusters.map(c => c.room_id).join(', ')}`);
    if (redundantClusters.length > 0) {
      logger.log(`   🗑️  Redundant Clusters (${redundantClusters.length}): ${redundantClusters.join(', ')}`);
    }
    logger.log(`   📈 Pipeline Details:`);
    logger.log(`      With visibility mappings: ${clustersWithVisibility.length}`);
    logger.log(`      Without visibility mappings: ${clustersWithoutVisibility.length}`);
    logger.log(`      Redundancy cases resolved: ${redundancyCases.length}`);
    logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return NextResponse.json({
      success: true,
      processed: processedImages.length,
      kept: finalCount,
      redundant: redundantCount,
      valid_clusters: validClusters, // Clear list of clusters that should be processed downstream
      redundant_clusters: redundantClusters, // List of clusters marked as redundant
      details: {
        with_visibility: clustersWithVisibility.length,
        without_visibility: clustersWithoutVisibility.length,
        redundancy_cases: redundancyCases.length,
        single_space: singleSpaceCount,
        multi_space: multiSpaceCount
      }
    });

  } catch (error: any) {
    logger.error('❌ OMSRIA error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'omsria_failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}

