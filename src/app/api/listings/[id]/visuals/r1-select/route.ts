import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

export const dynamic = 'force-dynamic';

interface RoomImageSelection {
  room_id: string;
  room_name: string;
  selected_photo_url: string;
  reason: string;
}

interface RoomImageSelectionResponse {
  selections: RoomImageSelection[];
}

const responseSchema = {
  type: 'object',
  properties: {
    selections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_id: { type: 'string' },
          room_name: { type: 'string' },
          selected_photo_url: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['room_id', 'room_name', 'selected_photo_url', 'reason']
      }
    }
  },
  required: ['selections']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * R1: Select Best Image Per Room
 * 
 * For each room with multiple photos, selects the most wide-angle image.
 * Processes rooms individually (only for rooms with >1 photo).
 * 
 * Criteria: Best perspective, placement, camera angle, coverage of room.
 * 
 * Endpoint: POST /api/listings/[id]/after/select-room-images
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R1';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { force }: { force?: boolean } = body;

    logger.log(`📸 R1: Select Best Image Per Room for listing ${listingId}`);

    // Fetch normalized clusters from database view (includes visibility mappings)
    logger.log(`📥 Fetching normalized clusters from database view...`);
    const { data: allNormalizedClusters, error: normalizedError } = await supabase
      .from('clusters_normalized')
      .select('cluster_id, cluster_name, original_photo_urls, selected_photo_url, visibility_mappings_normalized')
      .eq('listing_id', listingId.toString())
      .order('display_order');

    if (normalizedError) {
      logger.error('❌ Error fetching normalized clusters:', normalizedError);
      return NextResponse.json(
        {
          success: false,
          error: 'clusters_fetch_failed',
          details: normalizedError.message
        },
        { status: 500 }
      );
    }

    // Filter out excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const clusters = [];
    for (const c of (allNormalizedClusters || [])) {
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      if (!isExcluded) {
        clusters.push(c);
      }
    }

    if (!clusters || clusters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_clusters_found',
          details: 'No room clusters found for this listing'
        },
        { status: 404 }
      );
    }

    // Separate rooms by photo count
    const roomsWithMultiplePhotos = clusters.filter(c => {
      const photoUrls = c.original_photo_urls || [];
      return photoUrls.length > 1;
    });

    const roomsWithSinglePhoto = clusters.filter(c => {
      const photoUrls = c.original_photo_urls || [];
      return photoUrls.length === 1;
    });

    logger.log(`📊 Found ${roomsWithMultiplePhotos.length} rooms with multiple photos, ${roomsWithSinglePhoto.length} rooms with single photo`);

    const results: Array<{ room_id: string; room_name: string; selected_photo_url: string }> = [];
    const errors: Array<{ room_id: string; error: string }> = [];

    // Process each room individually
    for (const cluster of roomsWithMultiplePhotos) {
      try {
        const roomId = `cluster_${cluster.cluster_id}`;
        const roomName = cluster.cluster_name || roomId;
        const originalUrls = cluster.original_photo_urls || [];

        // Skip if already selected and not forcing
        if (!force && cluster.selected_photo_url) {
          logger.log(`  ⏭️  ${roomName}: Already has selected photo, skipping`);
          results.push({
            room_id: roomId,
            room_name: roomName,
            selected_photo_url: cluster.selected_photo_url
          });
          continue;
        }

        logger.log(`  🔍 Analyzing ${roomName}: ${originalUrls.length} photos`);

        // Use original URLs directly (R1 uses original photos, F0 runs after R1.5)
        const photosToAnalyze = originalUrls.map((url: string) => ({
          original_photo_url: url
        }));

        // Fetch images as base64
        const imagesBase64: Array<{ mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }> = [];
        for (const photo of photosToAnalyze) {
          try {
            const response = await fetch(photo.original_photo_url);
            if (!response.ok) continue;
            
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            
            // Ensure mimeType matches GeminiImageInput type
            const validMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 
              contentType.startsWith('image/jpeg') ? 'image/jpeg' :
              contentType.startsWith('image/png') ? 'image/png' :
              contentType.startsWith('image/webp') ? 'image/webp' :
              contentType.startsWith('image/gif') ? 'image/gif' :
              'image/jpeg';
            
            imagesBase64.push({
              mimeType: validMimeType,
              data: base64
            });
          } catch (e) {
            logger.warn(`  ⚠️  Failed to fetch ${photo.original_photo_url}:`, e);
          }
        }

        if (imagesBase64.length === 0) {
          throw new Error('No photos could be fetched');
        }

        // Get visibility mappings for this cluster to inform selection
        const visibilityMappings = cluster.visibility_mappings_normalized as Record<string, { visible_rooms?: string[] }> | null;
        
        // Build visibility info for each photo
        const photoVisibilityInfo: Array<{ index: number; visibleOtherSpaces: string[] }> = [];
        for (let i = 0; i < originalUrls.length; i++) {
          const photoUrl = originalUrls[i];
          const mapping = visibilityMappings?.[photoUrl];
          const visibleOtherSpaces = mapping?.visible_rooms || [];
          photoVisibilityInfo.push({
            index: i + 1, // 1-based index
            visibleOtherSpaces
          });
        }

        // Build visibility context for prompt (simplified)
        let visibilityContext = '';
        if (photoVisibilityInfo.some(p => p.visibleOtherSpaces.length > 0)) {
          visibilityContext = '\n\nOTHER SPACES VISIBLE:\n';
          photoVisibilityInfo.forEach((info) => {
            if (info.visibleOtherSpaces.length > 0) {
              visibilityContext += `Photo ${info.index}: ${info.visibleOtherSpaces.join(', ')}\n`;
            } else {
              visibilityContext += `Photo ${info.index}: None (best)\n`;
            }
          });
        }

        // Build prompt for selection (simplified and clearer)
        const prompt = `Select the best photo of ${roomName} for renovation visualization.

${imagesBase64.length} photos provided.${visibilityContext}

Note: Photos show furniture, but focus on room layout and architecture. Furniture will be removed and is not relevant to selection.

CRITERIA:
1. Best view of ${roomName} - shows the whole space clearly with good coverage of the room's layout, boundaries, and features
2. If multiple photos show ${roomName} well, prefer the one where other spaces are least visible

Return JSON:
- room_id: "${roomId}"
- room_name: "${roomName}"
- selected_photo_index: Index (1-based) of selected photo
- reason: Why this photo best shows ${roomName}`;

        // Call Gemini to select best photo
        const result = await callGeminiRest(prompt, {
          model: 'gemini-2.5-flash',
          temperature: 0.2,
          topP: 0.6,
          topK: 20,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              room_id: { type: 'string' },
              room_name: { type: 'string' },
              selected_photo_index: { type: 'number' },
              reason: { type: 'string' }
            },
            required: ['room_id', 'room_name', 'selected_photo_index', 'reason']
          },
          images: imagesBase64
        });

        if (!result.success || !result.text) {
          throw new Error(`Gemini call failed: ${result.error}`);
        }

        // Parse response with error handling
        let cleaned = result.text.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        
        // Fix common JSON issues
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        
        // Try to fix unterminated strings
        let parsed: any;
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseError: any) {
          if (parseError.message?.includes('Unterminated string')) {
            // Try to fix unterminated strings by closing them
            const lines = cleaned.split('\n');
            const fixedLines = lines.map(line => {
              // Count unescaped quotes
              let quoteCount = 0;
              let escaped = false;
              for (let i = 0; i < line.length; i++) {
                if (line[i] === '\\') {
                  escaped = !escaped;
                  continue;
                }
                if (line[i] === '"' && !escaped) {
                  quoteCount++;
                }
                escaped = false;
              }
              // If odd number of quotes, add closing quote at end
              if (quoteCount % 2 === 1 && !line.trim().endsWith('"')) {
                return line + '"';
              }
              return line;
            });
            cleaned = fixedLines.join('\n');
            try {
              parsed = JSON.parse(cleaned);
            } catch (e2) {
              throw new Error(`JSON parse error: ${parseError.message}. Response preview: ${cleaned.substring(0, 200)}`);
            }
          } else {
            throw new Error(`JSON parse error: ${parseError.message}. Response preview: ${cleaned.substring(0, 200)}`);
          }
        }

        // Validate and get selected photo URL from index
        const selectedIndex = parsed.selected_photo_index;
        if (!selectedIndex || selectedIndex < 1 || selectedIndex > originalUrls.length) {
          throw new Error(`Invalid photo index: ${selectedIndex}. Must be between 1 and ${originalUrls.length}`);
        }
        
        const selectedPhotoUrl = originalUrls[selectedIndex - 1]; // Convert to 0-based index
        parsed.selected_photo_url = selectedPhotoUrl;

        // Update cluster with selected photo
        const { error: updateError } = await supabase
          .from('clusters')
          .update({ selected_photo_url: parsed.selected_photo_url })
          .eq('id', cluster.cluster_id);

        if (updateError) {
          throw new Error(`Failed to update cluster: ${updateError.message}`);
        }

        logger.log(`  ✅ ${roomName}: Selected ${parsed.selected_photo_url.substring(parsed.selected_photo_url.length - 40)}...`);
        logger.log(`     Reason: ${parsed.reason}`);

        results.push({
          room_id: roomId,
          room_name: roomName,
          selected_photo_url: parsed.selected_photo_url
        });

      } catch (error: any) {
        logger.error(`  ❌ Error processing room ${cluster.cluster_name}:`, error);
        errors.push({
          room_id: `cluster_${cluster.cluster_id}`,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Process single-photo rooms: automatically set selected_photo_url to the only photo
    if (roomsWithSinglePhoto.length > 0) {
      logger.log(`📸 Processing ${roomsWithSinglePhoto.length} rooms with single photo (auto-selecting)`);
      
      for (const cluster of roomsWithSinglePhoto) {
        const roomId = `cluster_${cluster.cluster_id}`;
        const roomName = cluster.cluster_name;
        const photoUrls = cluster.original_photo_urls || [];
        
        if (photoUrls.length === 0) {
          continue; // Skip if no photos
        }

        // Skip if already has selected_photo_url (unless force=true)
        if (!force && cluster.selected_photo_url) {
          logger.log(`  ⏭️  ${roomName}: Already has selected photo, skipping`);
          results.push({
            room_id: roomId,
            room_name: roomName,
            selected_photo_url: cluster.selected_photo_url
          });
          continue;
        }

        const singlePhotoUrl = photoUrls[0];
        
        // Update cluster with selected photo (the only photo)
        const { error: updateError } = await supabase
          .from('clusters')
          .update({ selected_photo_url: singlePhotoUrl })
          .eq('id', cluster.cluster_id);

        if (updateError) {
          logger.error(`  ❌ Error updating ${roomName}:`, updateError);
          errors.push({
            room_id: roomId,
            error: `Failed to update cluster: ${updateError.message}`
          });
          continue;
        }

        logger.log(`  ✅ ${roomName}: Auto-selected single photo`);
        results.push({
          room_id: roomId,
          room_name: roomName,
          selected_photo_url: singlePhotoUrl
        });
      }
    }

    logger.log(`✅ R1: Completed. ${results.length} rooms processed, ${errors.length} errors`);

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      total_rooms: clusters.length,
      rooms_with_multiple_photos: roomsWithMultiplePhotos.length,
      rooms_with_single_photo: roomsWithSinglePhoto.length,
      errors: errors.length,
      error_details: errors,
      selections: results
    });

  } catch (error: any) {
    logger.error('❌ R1: Select Best Image Per Room failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'selection_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}


