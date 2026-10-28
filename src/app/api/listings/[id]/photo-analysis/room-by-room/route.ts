import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';
import { ROOM_BY_ROOM_ANALYSIS_PROMPT } from '@/lib/prompts/architecture-improvement-prompts';
import { RoomAnalysis, RoomLayoutAllocentric, WholeHomeSummary } from '@/types/renovation-intelligence';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { getNormalizedClusters } from '@/lib/room-analysis-helpers';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

/**
 * Concurrency limiter: maintains exactly N concurrent tasks, starts next as soon as one completes
 */
function limitConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return Promise.resolve([]);
  if (maxConcurrency <= 1) {
    return Promise.all(items.map((item, index) => handler(item, index)));
  }
  
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;
  
  return new Promise((resolve, reject) => {
    const processNext = () => {
      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }
      
      while (active < maxConcurrency && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        active++;
        
        handler(items[currentIndex], currentIndex)
          .then((result) => {
            results[currentIndex] = result;
          })
          .catch((error) => {
            results[currentIndex] = error as R;
          })
          .finally(() => {
            active--;
            processNext();
          });
      }
    };
    
    processNext();
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * E4: Room-by-Room Analysis (Phase 1 Enhancement: Allocentric Layout Generation)
 * 
 * POST /api/listings/[id]/photo-analysis/room-by-room
 * 
 * Input: listing_id, rooms[] with OMSRIA-processed images (single image per room), minimal listing metadata
 * Model: Gemini 2.5 Flash
 * Output: RoomAnalyses (array of RoomAnalysis) + LayoutAllocentric (array of RoomLayoutAllocentric) + WholeHomeSummary
 * 
 * Phase 1 Changes:
 * - Uses OMSRIA-processed images (single isolated image per room) instead of all photos
 * - Generates allocentric layout (structured + expressive narrative) for each room
 * - Generates whole-home summary synthesizing all room layouts
 * 
 * Critical Rule: Do not feed whole-property analysis text into room analysis (avoid bias)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'RoomByRoom';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params; // Await params as per Next.js 15+ warning
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('force_refresh') === 'true';

  try {
    logger.log(`🛏️ Starting Room-by-Room Analysis (Architecture Improvement) for listing ${listingId}`);


    // Get listing data (needs source_url for dedupe & metadata for context)
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, scraped_data, source_url')
      .eq('id', listingId)
      .single();

    if (listingError) {
      logger.error('Listing query error:', listingError);
      throw new Error(`Failed to fetch listing: ${listingError.message}`);
    }

    if (!listing) {
      throw new Error('No listing data found.');
    }

    logger.log(`✅ Found listing: ${listing.title || listingId}`);

    if (!forceRefresh) {
      // Gather all listing IDs that share this URL (legacy duplicates)
      let listingIdsToCheck: number[] = [Number(listingId)];
      if (listing.source_url) {
        const { data: duplicates } = await supabase
          .from('listings')
          .select('id')
          .eq('source_url', listing.source_url);

        if (duplicates && duplicates.length > 0) {
          listingIdsToCheck = Array.from(
            new Set([
              ...listingIdsToCheck,
              ...duplicates.map((dup) => Number(dup.id)),
            ])
          );
        }
      }

      // Check for cached room analysis
      const { data: cachedAnalysis } = await supabase
        .from('room_analyses')
        .select(
          'listing_id, analysis_data, layout_allocentric, whole_home_summary, unified_home_layout_json, created_at, _version'
        )
        .in('listing_id', listingIdsToCheck)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cachedAnalysis && isCacheValid(cachedAnalysis._version, PIPELINE_VERSIONS.ROOM_BY_ROOM)) {
        logger.log(`✅ Found cached room analysis v${cachedAnalysis._version} from listing ${cachedAnalysis.listing_id}`);
        
        // If cached record belongs to different listing, upsert for this one too
        if (String(cachedAnalysis.listing_id) !== String(listingId)) {
          logger.log(
            `🔁 Linking cached room analysis from listing ${cachedAnalysis.listing_id} to current listing ${listingId}`
          );
          const linkResult = await supabase
            .from('room_analyses')
            .upsert(
              {
                listing_id: Number(listingId),
                analysis_data: cachedAnalysis.analysis_data,
                layout_allocentric: cachedAnalysis.layout_allocentric,
                whole_home_summary: cachedAnalysis.whole_home_summary,
                unified_home_layout_json:
                  cachedAnalysis.unified_home_layout_json,
                _version: cachedAnalysis._version,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'listing_id',
              }
            );

          if (linkResult.error) {
            throw new Error(
              `Failed to link cached room analysis: ${linkResult.error.message}`
            );
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Room-by-room analysis (cached)',
          cached: true,
          data: {
            room_analyses: cachedAnalysis.analysis_data,
            layout_allocentric: cachedAnalysis.layout_allocentric,
            whole_home_summary: cachedAnalysis.whole_home_summary,
            unified_home_layout_json:
              cachedAnalysis.unified_home_layout_json || null,
          },
          created_at: cachedAnalysis.created_at,
        });
      }
      
      if (cachedAnalysis && !isCacheValid(cachedAnalysis._version, PIPELINE_VERSIONS.ROOM_BY_ROOM)) {
        logger.log(`🔄 RoomByRoom: Cache stale (v${cachedAnalysis._version} → v${PIPELINE_VERSIONS.ROOM_BY_ROOM}), regenerating...`);
      }
    }

    logger.log(`🔄 ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new room analyses...`);

    // Fetch normalized clusters from database view (furniture-free URLs + normalized visibility mappings)
    // RoomByRoom needs ALL photos from each cluster + visibility mappings to understand spatial context
    // Database handles all normalization logic - no runtime mapping needed
    logger.log(`🔄 Fetching normalized clusters from database view...`);
    const allNormalizedClusters = await getNormalizedClusters(listingId);
    
    if (!allNormalizedClusters || allNormalizedClusters.length === 0) {
      throw new Error('No room clusters found. Create clusters first.');
    }

    // Filter excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const normalizedClusters: typeof allNormalizedClusters = [];
    for (const c of allNormalizedClusters) {
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      const photos = c.photos || [];
      if (!isExcluded && photos.length > 0) {
        normalizedClusters.push(c);
      }
    }

    if (normalizedClusters.length === 0) {
      throw new Error('No valid room clusters found after filtering.');
    }

    logger.log(`✅ Fetched ${normalizedClusters.length} normalized cluster(s) (filtered from ${allNormalizedClusters.length} total)`);

    // Process each room cluster in parallel (no whole-property text input)
    logger.log(`🛏️ Processing ${normalizedClusters.length} rooms in parallel (5 concurrent)...`);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let detectedModel = 'gemini-2.5-pro';

    // Process room in parallel
    const processRoom = async (normalizedCluster: typeof normalizedClusters[0], index: number): Promise<{ roomAnalysis: RoomAnalysis | null; layout: RoomLayoutAllocentric | null; tokens: { input: number; output: number }; model: string; error?: string }> => {
      try {
        const roomId = normalizedCluster.cluster_id.toString();

        // Use normalized photos (already mapped to furniture-free URLs with visibility info)
        const photos = normalizedCluster.photos;

        if (photos.length === 0) {
          return { roomAnalysis: null, layout: null, tokens: { input: 0, output: 0 }, model: 'gemini-2.5-flash' };
        }

        // Extract photo URLs and visibility info
        const photoUrls = photos.map((p: { photo_url: string; visible_rooms: string[] }) => p.photo_url);
        const photoVisibilityInfo = photos.map((p: { photo_url: string; visible_rooms: string[] }) => ({
          photo_url: p.photo_url,
          visible_rooms: p.visible_rooms
        }));

        const context = {
          listing_id: listingId,
          room_id: roomId,
          room_name: normalizedCluster.cluster_name,
          photo_urls: photoUrls,
          photo_visibility_info: photoVisibilityInfo, // NEW: Which other rooms are visible in each photo
          // Minimal metadata only - NO whole-property analysis text
          property_title: listing.title || listing.scraped_data?.title || undefined,
          size: listing.scraped_data?.areas?.constructed || listing.scraped_data?.areas?.useful || undefined
        };

        const promptText = ROOM_BY_ROOM_ANALYSIS_PROMPT(context);

        // Fetch and encode photos as base64
        const images: GeminiImageInput[] = [];
        for (const photoUrl of photoUrls) {
          try {
            const response = await fetch(photoUrl, {
              redirect: 'follow',
              headers: { 'User-Agent': 'PuedoCasa-RoomAnalysis/1.0' }
            });
            
            if (!response.ok) {
              logger.warn(`⚠️ Failed to fetch photo ${photoUrl}: HTTP ${response.status}`);
              continue;
            }

            const contentType = response.headers.get('content-type') || '';
            let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
            
            if (contentType.includes('image/webp')) mimeType = 'image/webp';
            else if (contentType.includes('image/png')) mimeType = 'image/png';
            else if (contentType.includes('image/gif')) mimeType = 'image/gif';

            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            
            if (base64 && base64.length > 64) {
              images.push({ mimeType, data: base64 });
            }
          } catch (err) {
            logger.warn(`⚠️ Error fetching photo ${photoUrl}:`, err);
          }
        }

        if (images.length === 0) {
          return { roomAnalysis: null, layout: null, tokens: { input: 0, output: 0 }, model: 'gemini-2.5-flash' };
        }

        const photosWithVisibility = photoVisibilityInfo.filter((p: { photo_url: string; visible_rooms: string[] }) => p.visible_rooms.length > 0).length;
        logger.log(`🤖 Analyzing room: ${normalizedCluster.cluster_name} (${images.length} photo(s), ${photosWithVisibility} showing other rooms via visibility mappings)`);

        // Define response schema for structured output (RoomAnalysis + RoomLayoutAllocentric)
        const responseSchema = {
          type: 'object',
          properties: {
            room_analysis: {
          type: 'object',
          properties: {
            room_id: { type: 'string' },
            room_name: { type: 'string' },
            findings_by_lens: {
              type: 'object',
              properties: {
                structural_envelope: { type: 'string', nullable: true },
                finishes_surfaces: { type: 'string' },
                lighting_ventilation: { type: 'string' },
                fittings_fixtures: { type: 'string', nullable: true },
                moisture_hygiene: { type: 'string' },
                energy_insulation: { type: 'string', nullable: true },
                accessibility_safety: { type: 'string', nullable: true },
                potential_limitations: { type: 'string' }
              },
              required: ['finishes_surfaces', 'lighting_ventilation', 'moisture_hygiene', 'potential_limitations']
            },
            notable_issues: {
              type: 'array',
              items: { type: 'string' }
            },
            overall_room_condition: {
              type: 'string',
              enum: ['poor', 'fair', 'good']
            },
            confidence: {
              type: 'string',
              enum: ['low', 'medium', 'high']
            }
          },
          required: ['room_id', 'room_name', 'findings_by_lens', 'notable_issues', 'overall_room_condition', 'confidence']
            },
            layout_allocentric: {
              type: 'object',
              properties: {
                room_id: { type: 'string' },
                room_name: { type: 'string' },
                layout_structured: {
                  type: 'object',
                  properties: {
                    approx_dimensions: {
                      type: 'object',
                      properties: {
                        length_m: { type: 'number', nullable: true },
                        width_m: { type: 'number', nullable: true },
                        height_m: { type: 'number', nullable: true }
                      }
                    },
                    envelope: {
                      type: 'object',
                      properties: {
                        walls: {
                          type: 'array',
                          items: { type: 'string' }
                        },
                        openings: {
                          type: 'array',
                          items: { type: 'string' }
                        }
                      },
                      required: ['walls', 'openings']
                    },
                    key_surfaces: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    obvious_adjacencies: {
                      type: 'array',
                      items: { type: 'string' },
                      nullable: true
                    }
                  },
                  required: ['envelope', 'key_surfaces']
                },
                layout_narrative: { type: 'string' }
              },
              required: ['room_id', 'room_name', 'layout_structured', 'layout_narrative']
            }
          },
          required: ['room_analysis', 'layout_allocentric']
        };

        // Call Gemini with structured output
        const geminiResponse = await callGeminiRest(promptText, {
          model: 'gemini-2.5-flash',
          temperature: 0.1,
          topP: 0.6,
          topK: 20,
          maxOutputTokens: 15000,
          responseMimeType: 'application/json',
          responseSchema,
          images
        });

        if (!geminiResponse.success || !geminiResponse.text) {
          logger.error(`❌ Gemini API error for ${normalizedCluster.cluster_name}:`, geminiResponse.error);
          throw new Error(`Failed to analyze ${normalizedCluster.cluster_name}: ${geminiResponse.error || 'No response text'}`);
        }

        // Parse response
        let parsedResponse: { room_analysis: RoomAnalysis; layout_allocentric: RoomLayoutAllocentric };
        try {
          let cleaned = geminiResponse.text.trim();
          // Remove markdown code blocks if present
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          
          // Try to fix common JSON issues
          // Remove any trailing commas before closing braces/brackets
          cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
          
          parsedResponse = JSON.parse(cleaned);
          logger.log(`✅ Successfully parsed analysis + layout for ${normalizedCluster.cluster_name}`);
        } catch (parseError) {
          logger.error(`❌ JSON parse error for ${normalizedCluster.cluster_name}:`, parseError);
          logger.error('Raw response length:', geminiResponse.text?.length);
          logger.error('Raw response preview:', geminiResponse.text?.substring(0, 500));
          
          // Try to extract JSON from the response if it's embedded in text
          const jsonMatch = geminiResponse.text?.match(/\{[\s\S]*/);
          if (jsonMatch) {
            try {
              let fixed = jsonMatch[0];
              
              // Handle incomplete strings - find the last unclosed string and close it
              let inString = false;
              let escapeNext = false;
              let lastQuotePos = -1;
              for (let i = 0; i < fixed.length; i++) {
                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }
                if (fixed[i] === '\\') {
                  escapeNext = true;
                  continue;
                }
                if (fixed[i] === '"') {
                  inString = !inString;
                  if (inString) lastQuotePos = i;
                }
              }
              
              // If we're still in a string, close it
              if (inString && lastQuotePos >= 0) {
                const afterQuote = fixed.substring(lastQuotePos + 1);
                const nextColon = afterQuote.indexOf(':');
                const nextComma = afterQuote.indexOf(',');
                const nextBrace = afterQuote.indexOf('}');
                
                if (nextColon > 0 && (nextComma < 0 || nextColon < nextComma) && (nextBrace < 0 || nextColon < nextBrace)) {
                  const beforeValue = fixed.substring(0, lastQuotePos + 1);
                  const valuePart = afterQuote.substring(0, Math.min(nextColon, afterQuote.length));
                  fixed = beforeValue + valuePart + '"' + fixed.substring(lastQuotePos + 1 + valuePart.length);
                } else {
                  fixed = fixed.substring(0, lastQuotePos + 1) + '"' + fixed.substring(lastQuotePos + 1);
                }
              }
              
              // Remove trailing commas
              fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
              
              // Balance braces/brackets
              const openBraces = (fixed.match(/\{/g) || []).length;
              const closeBraces = (fixed.match(/\}/g) || []).length;
              const openBrackets = (fixed.match(/\[/g) || []).length;
              const closeBrackets = (fixed.match(/\]/g) || []).length;
              
              fixed += '}'.repeat(Math.max(0, openBraces - closeBraces));
              fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
              
              parsedResponse = JSON.parse(fixed);
              logger.log(`✅ Recovered JSON after parsing error for ${normalizedCluster.cluster_name}`);
            } catch (recoveryError) {
              logger.error(`❌ JSON recovery failed for ${normalizedCluster.cluster_name}:`, recoveryError);
              throw new Error(`Failed to parse response for ${normalizedCluster.cluster_name}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          } else {
            throw new Error(`Failed to parse response for ${normalizedCluster.cluster_name}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
        }

        // Validate required fields
        if (!parsedResponse.room_analysis || !parsedResponse.layout_allocentric) {
          throw new Error(`Invalid response structure for ${normalizedCluster.cluster_name} - missing room_analysis or layout_allocentric`);
        }

        if (!parsedResponse.room_analysis.room_id || !parsedResponse.room_analysis.room_name || !parsedResponse.room_analysis.findings_by_lens) {
          throw new Error(`Invalid room_analysis structure for ${normalizedCluster.cluster_name}`);
        }

        if (!parsedResponse.layout_allocentric.room_id || !parsedResponse.layout_allocentric.room_name || !parsedResponse.layout_allocentric.layout_structured || !parsedResponse.layout_allocentric.layout_narrative) {
          throw new Error(`Invalid layout_allocentric structure for ${normalizedCluster.cluster_name}`);
        }

        // Return result with token usage
        const tokens = {
          input: geminiResponse.usage?.promptTokenCount || 0,
          output: geminiResponse.usage?.candidatesTokenCount || 0
        };
        const model = geminiResponse.model || 'gemini-2.5-flash';

        logger.log(`✅ Analyzed room + generated allocentric layout: ${normalizedCluster.cluster_name}`);

        return {
          roomAnalysis: parsedResponse.room_analysis,
          layout: parsedResponse.layout_allocentric,
          tokens,
          model
        };

      } catch (error) {
        logger.error(`❌ Error analyzing ${normalizedCluster.cluster_name}:`, error);
        return { 
          roomAnalysis: null, 
          layout: null, 
          tokens: { input: 0, output: 0 }, 
          model: 'gemini-2.5-flash',
          error: `Error analyzing ${normalizedCluster.cluster_name}: ${(error as any)?.message || 'Unknown error'}`
        };
      }
    };

    // Process all rooms in parallel (5 concurrent)
    logger.log(`🔄 Starting parallel processing of ${normalizedClusters.length} rooms (5 concurrent)...`);
    const roomResults = await limitConcurrency(normalizedClusters, 5, processRoom);
    
    // Verify all rooms completed
    if (roomResults.length !== normalizedClusters.length) {
      throw new Error(`Parallel processing incomplete: expected ${normalizedClusters.length} results, got ${roomResults.length}`);
    }
    
    logger.log(`✅ All ${roomResults.length} rooms completed processing`);
    
    // Collect errors from failed rooms
    const errors: string[] = [];

    // Collect results and aggregate tokens
    const roomAnalyses: RoomAnalysis[] = [];
    const layoutAllocentric: RoomLayoutAllocentric[] = [];
    
    for (const result of roomResults) {
      if (result.roomAnalysis && result.layout) {
        roomAnalyses.push(result.roomAnalysis);
        layoutAllocentric.push(result.layout);
        totalInputTokens += result.tokens.input;
        totalOutputTokens += result.tokens.output;
        if (result.model) detectedModel = result.model;
      } else if ((result as any).error) {
        errors.push((result as any).error);
      }
    }

    logger.log(`✅ Collected results: ${roomAnalyses.length} successful analyses, ${errors.length} errors`);

    if (roomAnalyses.length === 0) {
      throw new Error(`No room analyses generated. Errors: ${errors.join('; ')}`);
    }

    if (layoutAllocentric.length === 0) {
      throw new Error(`No allocentric layouts generated. Errors: ${errors.join('; ')}`);
    }

    // Generate whole-home summary by synthesizing ALL room layouts together
    // This creates a unified spatial understanding from individual room analyses
    // IMPORTANT: This happens AFTER all rooms are fully processed and results collected
    logger.log(`🏠 Synthesizing whole-home summary from ${layoutAllocentric.length} completed room layouts...`);
    let wholeHomeSummary: WholeHomeSummary | null = null;
    
    try {
      const summaryPrompt = `Based on these room layouts, generate a whole-home spatial summary.

ROOM LAYOUTS:
${JSON.stringify(layoutAllocentric.map(l => ({
  room_id: l.room_id,
  room_name: l.room_name,
  layout_narrative: l.layout_narrative,
  adjacencies: l.layout_structured.obvious_adjacencies || []
})), null, 2)}

TASK:
Generate a concise whole-home summary describing:
1. Spatial organization (how rooms connect, day/night zones, circulation patterns)
2. Major axes (e.g., "east-west living axis", "north-south circulation")
3. Key connections between rooms

Use expressive, professional language. Think floorplan-view (allocentric).

OUTPUT JSON:
{
  "room_list": [{"room_id": "string", "room_name": "string"}],
  "spatial_organization": "string - 1-2 paragraphs describing overall spatial flow",
  "major_axes": ["string array - e.g. 'east-west living axis'"],
  "key_connections": ["string array - e.g. 'Terrace connects to dining via wide arch'"]
}`;

      const summarySchema = {
        type: 'object',
        properties: {
          room_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                room_id: { type: 'string' },
                room_name: { type: 'string' }
              },
              required: ['room_id', 'room_name']
            }
          },
          spatial_organization: { type: 'string' },
          major_axes: {
            type: 'array',
            items: { type: 'string' }
          },
          key_connections: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['room_list', 'spatial_organization', 'major_axes', 'key_connections']
      };

      const summaryResponse = await callGeminiRest(summaryPrompt, {
        model: 'gemini-2.5-flash',
        temperature: 0.2,
        topP: 0.7,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: summarySchema
      });

      if (summaryResponse.success && summaryResponse.text) {
        let cleaned = summaryResponse.text.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .replace(/,(\s*[}\]])/g, '$1');
        
        wholeHomeSummary = JSON.parse(cleaned);
        logger.log(`✅ Room-by-Room: Whole-home summary generated`);
        
        if (summaryResponse.usage) {
          totalInputTokens += summaryResponse.usage.promptTokenCount || 0;
          totalOutputTokens += summaryResponse.usage.candidatesTokenCount || 0;
        }
      } else {
        logger.warn(`⚠️  Failed to generate whole-home summary: ${summaryResponse.error || 'Unknown error'}`);
      }
    } catch (summaryError) {
      logger.warn(`⚠️  Error generating whole-home summary:`, summaryError);
      // Don't fail the whole request if summary generation fails
    }

    // Generate basic unified layout from allocentric layouts
    // This creates a minimal unified layout structure for compatibility
    let generatedUnifiedLayout: any = null;
    if (layoutAllocentric.length > 0) {
      const rooms = layoutAllocentric.map(layout => ({
        room_id: layout.room_id,
        room_name: layout.room_name,
        surfaces: {
          floor: null,
          walls: null,
          ceiling: null
        },
        objects: []
      }));

      // Extract connections from adjacencies
      const connections: any[] = [];
      layoutAllocentric.forEach(layout => {
        const adjacencies = layout.layout_structured?.obvious_adjacencies || [];
        adjacencies.forEach((adj: string) => {
          // Try to extract room name from adjacency string
          const match = adj.match(/(?:to|with|from|connects?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
          if (match) {
            const targetRoomName = match[1];
            const targetRoom = layoutAllocentric.find(l => 
              l.room_name.toLowerCase().includes(targetRoomName.toLowerCase()) ||
              targetRoomName.toLowerCase().includes(l.room_name.toLowerCase())
            );
            if (targetRoom && targetRoom.room_id !== layout.room_id) {
              connections.push({
                from: layout.room_id,
                to: targetRoom.room_id,
                type: 'adjacent'
              });
            }
          }
        });
      });

      generatedUnifiedLayout = {
        home_id: `listing_${listingId}`,
        rooms,
        connections: connections.length > 0 ? connections : [],
        global_features: {}
      };
      logger.log(`✅ Generated basic unified layout: ${rooms.length} rooms, ${connections.length} connections`);
    }

    // Save to room_analyses table (with version)
    // Note: listing_id is BIGINT in schema, but we're using string - Supabase handles conversion
    const { error: saveError } = await supabase
      .from('room_analyses')
      .upsert({
        listing_id: Number(listingId), // Convert to number to match schema (BIGINT)
        analysis_data: roomAnalyses, // Existing field
        layout_allocentric: layoutAllocentric, // NEW field
        whole_home_summary: wholeHomeSummary, // NEW field
        unified_home_layout_json: generatedUnifiedLayout, // Generate basic unified layout for T1 compatibility (or use existing)
        _version: PIPELINE_VERSIONS.ROOM_BY_ROOM,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (saveError) {
      throw new Error(`Failed to save room analyses: ${saveError.message}`);
    }

    logger.log(`✅ Room-by-Room Analysis completed: ${roomAnalyses.length} rooms analyzed, ${layoutAllocentric.length} layouts generated${wholeHomeSummary ? ', whole-home summary generated' : ''}`);

    return NextResponse.json({
      success: true,
      message: `Room-by-room analysis completed for ${roomAnalyses.length} rooms`,
      data: {
        room_analyses: roomAnalyses,
        layout_allocentric: layoutAllocentric,
        whole_home_summary: wholeHomeSummary
      },
      errors: errors.length > 0 ? errors : undefined,
      usage: {
        promptTokenCount: totalInputTokens,
        candidatesTokenCount: totalOutputTokens,
        totalTokenCount: totalInputTokens + totalOutputTokens
      },
      model: detectedModel
    });

  } catch (error) {
    logger.error('❌ Room-by-room analysis error:', error);
    
    return NextResponse.json({
      success: false, 
      error: (error as any)?.message || 'Room-by-room analysis failed' 
    }, { status: 500 });
  }
}

/**
 * GET /api/listings/[id]/photo-analysis/room-by-room
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const { data: analysis, error } = await supabase
      .from('room_analyses')
      .select('analysis_data, created_at, updated_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !analysis) {
      return NextResponse.json({
        success: false,
        error: 'No room-by-room analysis found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analysis.analysis_data // Array of RoomAnalysis
    });

  } catch (error) {
    console.error('Get room-by-room analysis error:', error);
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Failed to fetch analysis'
    }, { status: 500 });
  }
}

