import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { getModelForTask } from '@/lib/model-registry';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { validateFurnitureRemoval } from '@/lib/furniture-validation';
import { writeFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

export const dynamic = 'force-dynamic';

/**
 * F0: Furniture Removal Preprocessing
 * 
 * CRITICAL: This endpoint runs AFTER R1.5 (OMSRIA) and processes only OMSRIA output images.
 * It removes furniture from isolated space images (one per room) produced by OMSRIA.
 * 
 * Prerequisites: R1.5 (OMSRIA) must be completed
 * 
 * Removes furniture from OMSRIA-processed images using AI image editing.
 * Stores furniture-free photos for use by R2a, R2b, and R3 (Render Rooms) pipeline.
 * 
 * Endpoint: POST /api/listings/[id]/photos/remove-furniture
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'F0';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { force }: { force?: boolean } = body;

    logger.log(`🪑 F0: Furniture Removal for listing ${listingId}`);

    // NEW: Prerequisite check for R1.5
    logger.log(`🔍 Checking prerequisites: R1.5 (OMSRIA) must be completed...`);
    const { data: omsriaImages, error: omsriaError } = await supabase
      .from('omsria_processed_images')
      .select('room_id, image_url, image_type, listing_id')
      .eq('listing_id', listingId)
      .eq('is_redundant', false);

    if (omsriaError) {
      logger.error('❌ Error fetching OMSRIA images:', omsriaError);
      return NextResponse.json(
        {
          success: false,
          error: 'omsria_fetch_failed',
          details: `Failed to fetch OMSRIA images: ${omsriaError.message}`
        },
        { status: 500 }
      );
    }

    if (!omsriaImages || omsriaImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'prerequisite_failed',
          details: 'R1.5 (OMSRIA) must be completed before F0. No OMSRIA images found. Run R1.5 first.'
        },
        { status: 400 }
      );
    }

    logger.log(`✅ Found ${omsriaImages.length} OMSRIA images to process`);

    // Process only OMSRIA images
    const photos = omsriaImages.map(omsriaImg => ({
      url: omsriaImg.image_url,
      room_id: omsriaImg.room_id,
      image_type: omsriaImg.image_type,
      omsria_image_url: omsriaImg.image_url
    }));

    // Check for existing furniture-free photos (by omsria_room_id)
    const { data: existingFurnitureFree } = await supabase
      .from('listing_photos_furniture_free')
      .select('omsria_room_id')
      .eq('listing_id', listingId)
      .not('omsria_room_id', 'is', null);

    const existingRoomIds = new Set(existingFurnitureFree?.map(f => f.omsria_room_id).filter(Boolean) || []);

    // Filter photos to process
    const photosToProcess = force 
      ? photos 
      : photos.filter(p => !existingRoomIds.has(p.room_id));

    if (photosToProcess.length === 0) {
      logger.log(`✅ All ${photos.length} photos already have furniture-free versions`);
      return NextResponse.json({
        success: true,
        processed: 0,
        total: photos.length,
        already_existing: photos.length,
        message: 'All photos already processed'
      });
    }

    logger.log(`🔄 Processing ${photosToProcess.length} photos (${photos.length - photosToProcess.length} already exist)`);

    const results: Array<{ original_photo_url: string; furniture_free_url: string }> = [];
    const errors: Array<{ original_photo_url: string; error: string }> = [];
    
    // Collect validation logs per room for diagnostic export
    const allValidationLogs: Record<string, Array<{
      attempt: number;
      hasItems: boolean;
      rawResponse: string;
      filteredDirective: string;
      passed: boolean;
      reason: string;
    }>> = {};

    // Process photos in batches (concurrency limit: 10)
    const batchSize = 5; // Reduced to prevent database timeouts
    const totalBatches = Math.ceil(photosToProcess.length / batchSize);

    for (let i = 0; i < photosToProcess.length; i += batchSize) {
      const batch = photosToProcess.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      logger.log(`📦 Starting batch ${batchNumber}/${totalBatches} (${batch.length} photo(s))`);
      
      const batchPromises = batch.map(async (photo: any, photoIndex) => {
        try {
          const photoUrl = photo.url;
          const photoNumber = i + photoIndex + 1;
          logger.log(`  🖼️ [${photoNumber}/${photosToProcess.length}] Processing: ${photoUrl.substring(photoUrl.length - 40)}...`);

          // Fetch original photo
          const photoResponse = await fetch(photoUrl);
          if (!photoResponse.ok) {
            throw new Error(`Failed to fetch photo: HTTP ${photoResponse.status}`);
          }

          const photoBuffer = await photoResponse.arrayBuffer();
          let currentImageBase64 = Buffer.from(photoBuffer).toString('base64');
          const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';

          // Simple, direct base prompt with clear instructions
          const basePrompt = `The house owners have moved out and taken all their furniture, decorations, and personal belongings with them. Generate what the property looks like now - empty and bare, with only permanent fixtures remaining.

Remove all furniture, decorations, and personal items from this image. Keep the exact same resolution, detail, and quality as the original.

KEEP these permanent fixtures:
- Kitchen islands, countertops, and all kitchen appliances (refrigerators, ovens, stoves, dishwashers, microwaves, range hoods - all types)
- Built-in cabinets, storage, bathroom vanities, and under-sink units
- Sinks, faucets, and plumbing fixtures
- Built-in lighting fixtures
- Curtains and window treatments (keep exactly as they are, especially if drawn)
- All walls, doors, windows, and architectural elements

REMOVE these items:
- All loose furniture (sofas, chairs, tables, beds, etc.)
- Electronics (TVs, speakers, etc.)
- Decorations, artwork, and personal items
- Rugs and any loose items that movers would take

When removing items, continue the wall, floor, or ceiling pattern that's already visible where the item was. Do not create any new windows, doors, openings, alcoves, arches, niches, shelves, or other architectural features. Do not change the number, size, shape, or position of any existing windows, doors, openings, or arches. If unsure what's behind something, continue the same surface that's visible around it.

Only remove things - never add anything.`;

          // Generate furniture-free image (with validation and one retry)
          let furnitureFreeBase64 = '';
          let currentImageForGeneration = currentImageBase64;
          let currentPrompt = basePrompt;
          let retryCount = 0;
          const maxRetries = 5; // Allow 5 retries (6 total attempts)
          const interimImages: Array<{ attempt: number; base64: string }> = []; // Store interim retry images
          const validationLogs: Array<{
            attempt: number;
            hasItems: boolean;
            rawResponse: string;
            filteredDirective: string;
            passed: boolean;
            reason: string;
          }> = []; // Store validation logs for this photo

          // Generate and validate loop
          while (retryCount <= maxRetries) {
            const attemptNum = retryCount + 1;
            if (retryCount > 0) {
              logger.log(`  🔄 Retry attempt ${attemptNum}/${maxRetries + 1}...`);
              logger.log(`  📸 Using previous output as input (progressive removal)`);
            } else {
              logger.log(`  🎨 Initial generation attempt...`);
            }

            // Generate furniture-free image
            try {
              const modelName = getModelForTask('visuals.inpaint');
              
              const result = await callGeminiRest(currentPrompt, {
                model: modelName,
                generateImages: true,
                images: [{
                  mimeType: contentType as any,
                  data: currentImageForGeneration
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
                throw new Error(result.error || 'No image generated');
              }

              furnitureFreeBase64 = result.images[0].data;
            } catch (apiError: any) {
              throw new Error(`Gemini API error: ${apiError?.message || JSON.stringify(apiError)}`);
            }
            
            // Save interim image for this attempt
            interimImages.push({
              attempt: attemptNum,
              base64: furnitureFreeBase64
            });

            // Validation: Check what's left using proper validation function (run before retry)
            if (retryCount < maxRetries) {
              try {
                logger.log(`  🔍 Validating result (checking for remaining items)...`);
                const validation = await validateFurnitureRemoval({
                  imageBase64: furnitureFreeBase64,
                  imageMimeType: contentType
                });

                // Capture validation output
                const validationLog = {
                  attempt: attemptNum,
                  hasItems: validation.has_furniture,
                  rawResponse: validation.directive_prompt || 'NO_RESPONSE',
                  filteredDirective: '', // No longer used, but keep for backward compatibility with HTML generator
                  passed: validation.passed,
                  reason: validation.passed 
                    ? (validation.has_furniture 
                        ? 'Only permanent fixtures/watermarks detected' 
                        : 'No removable items detected')
                    : 'Removable items still present'
                };

                if (!validation.passed) {
                  // Validation failed - items still need to be removed
                  logger.log(`  ⚠️  Validation FAILED - removable items still present:`);
                  if (validation.items_found && validation.items_found.length > 0) {
                    const itemsList = validation.items_found.map(i => `${i.item} (${i.location})`).join(', ');
                    logger.log(`  📝 Items found: ${itemsList.substring(0, 200)}${itemsList.length > 200 ? '...' : ''}`);
                  }
                  if (validation.directive_prompt) {
                    logger.log(`  📝 Directive: ${validation.directive_prompt.substring(0, 200)}${validation.directive_prompt.length > 200 ? '...' : ''}`);
                  }
                  
                  // Append validation directive to base prompt with the catch-all instruction
                  const retryPrompt = validation.directive_prompt 
                    ? `${basePrompt}

${validation.directive_prompt} Remove these but anything else I might have missed too, because I want the place bare.

Do not change the layout or structure of the room. Do not open curtains that are closed - keep them exactly as they are. If features aren't clearly visible in the original, don't add them.`
                    : basePrompt;
                    
                  currentPrompt = retryPrompt;
                    currentImageForGeneration = furnitureFreeBase64; // Use generated image as input for retry (progressive removal)
                    retryCount++;
                    validationLogs.push(validationLog);
                    continue;
                  } else {
                  // Validation passed - no removable items remain
                  logger.log(`  ✅ Validation PASSED - no removable items remain`);
                  if (validation.items_found && validation.items_found.length > 0) {
                    logger.log(`  ℹ️  Only permanent fixtures detected (not removable)`);
                  }
                  validationLogs.push(validationLog);
                  break;
                }
              } catch (validationError: any) {
                // If validation fails, log but continue with current result
                logger.log(`  ⚠️  Validation error: ${validationError.message} - proceeding with current result`);
                validationLogs.push({
                  attempt: attemptNum,
                  hasItems: false,
                  rawResponse: `VALIDATION_ERROR: ${validationError.message}`,
                  filteredDirective: '',
                  passed: false,
                  reason: `Validation error: ${validationError.message}`
                });
                break;
              }
            } else {
              // Max retries reached - use current result
              break;
            }
          }

          // Clear old interim images for this room before saving new ones
          const roomId = photo.room_id;
          try {
            const { data: oldInterimFiles } = await supabase.storage
              .from('property-images')
              .list(`${listingId}/furniture-free/`, {
                limit: 1000
              });
            
            if (oldInterimFiles) {
              const roomInterimFiles = oldInterimFiles.filter(file => 
                file.name.startsWith(`${roomId}_retry_`) && file.name.endsWith('.jpg')
              );
              
              if (roomInterimFiles.length > 0) {
                const pathsToDelete = roomInterimFiles.map(file => 
                  `${listingId}/furniture-free/${file.name}`
                );
                
                const { error: deleteError } = await supabase.storage
                  .from('property-images')
                  .remove(pathsToDelete);
                
                if (!deleteError) {
                  logger.log(`  🗑️  Cleared ${roomInterimFiles.length} old interim image(s)`);
                } else {
                  logger.log(`  ⚠️  Could not clear old interim images: ${deleteError.message}`);
                }
              }
            }
          } catch (clearError: any) {
            logger.log(`  ⚠️  Error clearing old interim images: ${clearError.message}`);
          }

          // Save interim retry images to storage (only save up to the last attempt that was actually executed)
          const interimImageUrls: string[] = [];
          // Find the last attempt that was actually executed (from validation logs)
          const lastAttempt = validationLogs.length > 0 
            ? Math.max(...validationLogs.map(log => log.attempt))
            : interimImages.length;
          
          // Only save interim images up to the last attempt
          const imagesToSave = interimImages.filter(img => img.attempt <= lastAttempt);
          
          if (imagesToSave.length > 0) {
            logger.log(`  💾 Saving ${imagesToSave.length} interim retry image(s) (attempts: ${imagesToSave.map(i => i.attempt).join(', ')})...`);
            for (const interim of imagesToSave) {
              try {
                const interimBuffer = Buffer.from(interim.base64, 'base64');
                const interimStoragePath = `${listingId}/furniture-free/${roomId}_retry_${interim.attempt}.jpg`;
                
                const { error: interimUploadError } = await supabase.storage
                  .from('property-images')
                  .upload(interimStoragePath, interimBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                  });
                
                if (!interimUploadError) {
                  const { data: interimUrlData } = supabase.storage
                    .from('property-images')
                    .getPublicUrl(interimStoragePath);
                  interimImageUrls.push(interimUrlData.publicUrl);
                  logger.log(`  ✅ Saved interim image attempt ${interim.attempt}`);
                } else {
                  logger.log(`  ⚠️  Failed to save interim image ${interim.attempt}: ${interimUploadError.message}`);
                }
              } catch (interimError: any) {
                logger.log(`  ⚠️  Error saving interim image ${interim.attempt}: ${interimError.message}`);
              }
            }
            if (interimImageUrls.length > 0) {
              logger.log(`  ✅ Saved ${interimImageUrls.length}/${imagesToSave.length} interim images`);
            } else {
              logger.log(`  ⚠️  No interim images were saved successfully (${imagesToSave.length} attempts processed)`);
            }
          }

          const furnitureFreeBuffer = Buffer.from(furnitureFreeBase64, 'base64');

          // Upload to Supabase Storage with retry logic
          // Use room_id instead of filename for storage path (roomId already defined above)
          const storagePath = `${listingId}/furniture-free/${roomId}_furniture_free.jpg`;

          // Retry storage upload (up to 3 attempts)
          let uploadData;
          let uploadError;
          const maxUploadRetries = 3;
          for (let uploadRetry = 0; uploadRetry < maxUploadRetries; uploadRetry++) {
            const result = await supabase.storage
            .from('property-images')
            .upload(storagePath, furnitureFreeBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

            uploadData = result.data;
            uploadError = result.error;
            
            if (!uploadError) {
              break; // Success
            }
            
            // If it's a timeout or connection error, retry
            const isRetryableError = uploadError.message.includes('timeout') || 
                                     uploadError.message.includes('connection') ||
                                     uploadError.message.includes('Internal Server Error');
            
            if (!isRetryableError || uploadRetry === maxUploadRetries - 1) {
            throw new Error(`Failed to upload: ${uploadError.message}`);
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (uploadRetry + 1)));
            logger.log(`  🔄 Storage upload retry ${uploadRetry + 1}/${maxUploadRetries}...`);
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('property-images')
            .getPublicUrl(storagePath);

          const furnitureFreeUrl = urlData.publicUrl;

          // Store in database with retry logic
          const omsriaImageUrl = photo.omsria_image_url || photoUrl;
          
          // Delete any existing records for this OMSRIA room first (to avoid conflicts with old constraint)
          // Also delete any records with the same original_photo_url (OMSRIA image URL) to handle edge cases
          await supabase
            .from('listing_photos_furniture_free')
            .delete()
            .eq('listing_id', listingId)
            .or(`omsria_room_id.eq.${roomId},original_photo_url.eq.${photoUrl}`);
          
          let dbError;
          const maxDbRetries = 3;
          for (let dbRetry = 0; dbRetry < maxDbRetries; dbRetry++) {
            const result = await supabase
            .from('listing_photos_furniture_free')
            .insert({
              listing_id: listingId,
              original_photo_url: photoUrl, // OMSRIA image URL
              furniture_free_url: furnitureFreeUrl,
              storage_path: storagePath,
              omsria_room_id: roomId, // NEW: Reference to OMSRIA room
              omsria_image_url: omsriaImageUrl // NEW: Original OMSRIA image URL
            });

            dbError = result.error;
            
            if (!dbError) {
              break; // Success
            }
            
            // If it's a timeout or connection error, retry
            const isRetryableError = dbError.message.includes('timeout') || 
                                     dbError.message.includes('connection') ||
                                     dbError.message.includes('Internal Server Error');

            if (!isRetryableError || dbRetry === maxDbRetries - 1) {
            throw new Error(`Failed to save to database: ${dbError.message}`);
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (dbRetry + 1)));
            logger.log(`  🔄 Database save retry ${dbRetry + 1}/${maxDbRetries}...`);
          }

          logger.log(`  ✅ [${photoNumber}/${photosToProcess.length}] Processed: ${furnitureFreeUrl.substring(furnitureFreeUrl.length - 40)}...`);

          // Store validation logs for this room
          if (validationLogs.length > 0) {
            allValidationLogs[roomId] = validationLogs;
          }

          return {
            original_photo_url: photoUrl,
            furniture_free_url: furnitureFreeUrl
          };
        } catch (error: any) {
          const errorMessage = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
          logger.error(`  ❌ Error processing ${photo.url}:`, errorMessage);
          if (error?.stack) {
            logger.error(`  Stack:`, error.stack.substring(0, 200));
          }
          return {
            original_photo_url: photo.url,
            error: errorMessage
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if ('error' in result) {
          errors.push(result as { original_photo_url: string; error: string });
        } else {
          results.push(result as { original_photo_url: string; furniture_free_url: string });
        }
      }

      logger.log(`✅ Completed batch ${batchNumber}/${totalBatches}: ${results.length} successful, ${errors.length} errors`);
      if (i + batchSize < photosToProcess.length) {
        logger.log(`⏳ Waiting before next batch...`);
      }
    }

    // CRITICAL: Verify all batches completed
    const expectedProcessed = photosToProcess.length;
    const actualProcessed = results.length + errors.length;
    if (actualProcessed !== expectedProcessed) {
      logger.error(`❌ F0 BATCH MISMATCH: Expected ${expectedProcessed} photos, but only ${actualProcessed} completed (${results.length} success + ${errors.length} errors)`);
      throw new Error(`F0 incomplete: Only ${actualProcessed}/${expectedProcessed} photos processed`);
    }

    const totalProcessed = results.length + (photos.length - photosToProcess.length);
    logger.log(`✅ F0: All batches completed. ${results.length} photos processed successfully, ${errors.length} errors`);
    logger.log(`📊 F0 Summary: ${totalProcessed}/${photos.length} total (${results.length} processed + ${photos.length - photosToProcess.length} already existed)`);

    // Save validation logs to JSON file for diagnostic export
    if (Object.keys(allValidationLogs).length > 0) {
      const validationLogPath = join(process.cwd(), `f0-validation-logs-${listingId}.json`);
      try {
        writeFileSync(validationLogPath, JSON.stringify(allValidationLogs, null, 2), 'utf-8');
        logger.log(`  📋 Validation logs saved to ${validationLogPath}`);
      } catch (logError: any) {
        logger.log(`  ⚠️  Failed to save validation logs: ${logError.message}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      total: photos.length,
      already_existing: photos.length - photosToProcess.length,
      errors: errors.length,
      error_details: errors,
      results: results
    });

  } catch (error: any) {
    logger.error('❌ F0: Furniture Removal failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'furniture_removal_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
