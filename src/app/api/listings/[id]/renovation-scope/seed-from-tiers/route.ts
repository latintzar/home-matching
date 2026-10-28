import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { validateScopeSeedOutput } from '@/lib/schemas/renovation-schemas';
import { createStepLogger } from '@/lib/orchestrator-progress';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Seed Scope from Tiers: Convert tier decisions into detailed work items
 * 
 * Uses corrected tier target states (T4 → T5 → T5.5), produces detailed work items,
 * ensures progression (Plus includes Óptimo includes Estándar), maintains buyer-facing tone.
 * 
 * NOTE: Uses TierElementSynthesis which includes cohesion corrections.
 * This endpoint converts decisions to work items only - it does NOT make element-level decisions.
 * 
 * Endpoint: POST /api/listings/[id]/renovation-scope/seed-from-tiers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'I';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`🌱 Seed Scope from Tiers: Converting tier decisions to work items for listing ${listingId}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('renovation_scope_reports')
      .select('report_data')
      .eq('listing_id', parseInt(listingId, 10))
      .single();

    if (existing) {
      logger.log(`✅ Seed scope already exists`);
      return NextResponse.json({
        success: true,
        scope_seed: existing.report_data,
        cached: true
      });
    }

    // Fetch Tier Element Synthesis (Phase 2: Consolidated tier generation)
    const { data: allSyntheses } = await supabase
      .from('tier_element_synthesis')
      .select('tier, synthesis_data')
      .eq('listing_id', listingId.toString());

    if (!allSyntheses || allSyntheses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tier element synthesis not found. Run tiers/element-synthesis first.' },
        { status: 404 }
      );
    }

    // Organize by tier - convert synthesis to work items format
    const tierStatesByTier: Record<string, any> = {
      estandar: { works: [], cohesion_summary: null },
      optimo: { works: [], cohesion_summary: null },
      plus: { works: [], cohesion_summary: null }
    };

    for (const synthesis of allSyntheses) {
      if (synthesis.tier in tierStatesByTier) {
        tierStatesByTier[synthesis.tier] = {
          works: synthesis.synthesis_data.works || [],
          cohesion_summary: synthesis.synthesis_data.cohesion_summary || null
        };
      }
    }

    // Legacy fields for backward compatibility (empty but structure preserved)
    const groupDirectives: any[] = [];
    const cohesionNotes: any[] = [];

    // Fetch E2 unified layout
    const { data: roomAnalysis } = await supabase
      .from('room_analyses')
      .select('unified_home_layout_json')
      .eq('listing_id', parseInt(listingId, 10))
      .single();

    const e2Layout = roomAnalysis?.unified_home_layout_json || null;

    // Fetch valid photos for photo_refs (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const validPhotos = await fetchValidListingPhotos(listingId, supabase as any);
    const photoUrls = validPhotos.map(p => p.url);

    // Fetch clusters for room_refs
    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, cluster_name, photo_urls')
      .eq('listing_id', parseInt(listingId, 10))
      .order('display_order', { ascending: true });

    // Create mapping of photo URL to cluster ID for room_refs
    const photoToClusterMap = new Map<string, string>();
    if (clusters) {
      clusters.forEach(cluster => {
        cluster.photo_urls?.forEach((url: string) => {
          photoToClusterMap.set(url, cluster.id.toString());
        });
      });
    }

    // Fetch listing metadata
    const { data: listing } = await supabase
      .from('listings')
      .select('title, price, size, bedrooms, bathrooms, location')
      .eq('id', parseInt(listingId, 10))
      .single();

    // Build prompt
    const prompt = `You are converting tier element synthesis (consolidated tier generation) into detailed renovation work items.

TIER ELEMENT SYNTHESIS (Phase 2: Consolidated T3+T4+T5+T5.5+T6.5):
${JSON.stringify(tierStatesByTier, null, 2)}

Each tier contains:
- works: Array of renovation works with element_id, room_id, action, work_description, technical_details, rationale
- cohesion_summary: Material consistency, color harmony, style coherence, progression consistency

CRITICAL: Use the works array directly - each work already has:
- work_description: Buyer-friendly description
- technical_details: Technical specification
- rationale: Why this work is needed
- action: keep/remove/minor_change/upgrade/replace/premium_upgrade

${e2Layout ? `E2 UNIFIED LAYOUT:
${JSON.stringify(e2Layout, null, 2)}` : ''}

${listing ? `LISTING METADATA:
- Title: ${listing.title}
- Price: ${listing.price}
- Size: ${listing.size} m²
- Bedrooms: ${listing.bedrooms}
- Bathrooms: ${listing.bathrooms}
- Location: ${listing.location || 'N/A'}` : ''}

AVAILABLE PHOTOS (use URLs for photo_refs):
${JSON.stringify(photoUrls, null, 2)}

ROOM CLUSTERS (use cluster IDs for room_refs):
${JSON.stringify(clusters?.map(c => ({ id: c.id, name: c.cluster_name })), null, 2)}

TASK:
Convert tier element synthesis works into detailed, comprehensive work items for the renovation scope.

CRITICAL: You are CONVERTING synthesis works to work items - convert only, do not create new works.
- Use the synthesis works exactly as provided
- Each work in the synthesis → one or more work items
- Use work_description and technical_details from synthesis
- Work with the synthesis as given - convert them to work items only

CRITICAL REQUIREMENTS:

1. **DETAILED WORK ITEMS** (comprehensive list covering all changes):
   - Each element decision → one or more work items
   - Long, detailed list covering all changes
   - Include room_ref and photo_refs for each item
   - Use deterministic IDs: est-1, est-2, opt-1, opt-2, plus-1, plus-2, etc. (no leading zeros, format: prefix-number)

   CRITICAL: Do NOT include furniture-related work items. Furniture is secondary and will be handled separately. Focus only on architectural, structural, and permanent fixture work items. Exclude: furniture removal, furniture installation, furniture-related tasks, decorative items, personal belongings.

2. **PROGRESSION ENFORCEMENT**:
   - Plus tier MUST include all Óptimo work items
   - Óptimo tier MUST include all Estándar work items
   - Higher tiers can ADD items and must preserve all lower tier items

3. **BUYER-FACING TONE**:
   - Use plain present tense ("Replace", "Add", "Install", "Remove")
   - Refer directly to visible elements ("flooring", "wall", "cabinetry")
   - One sentence long, natural to read aloud
   - All names must be in Spanish
   - Think "what will actually change in my home?" - focus on visible changes the buyer will see

4. **GRANULARITY**:
   - Convert each element action into specific work items
   - Example: element action "replace" → work item "Replace bathroom vanity unit"
   - Example: element action "upgrade" → work item "Upgrade kitchen fixtures to modern style"
   - Group related small changes when appropriate (same room, same trade type)

5. **VISUAL COHERENCE**:
   - Link work items to photos (photo_refs) - REQUIRED: Every work item MUST have at least one photo URL in photo_refs array
   - Use room_ref to connect items to rooms
   - Ensure items match element decisions exactly
   - If a work item applies to multiple rooms, include photos from all relevant rooms

OUTPUT:
Return valid JSON matching ScopeSeedOutput structure with comprehensive work items for all three tiers.

Return ONLY valid JSON matching the schema.`;

    // Use same response schema as existing seed endpoint
    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        generated_at: { type: 'string' },
        tiers: {
          type: 'object',
          properties: {
            estandar: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                work_items: {
                  type: 'array',
                  minItems: 1, // Allow comprehensive list
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', pattern: '^est-\\d+$' },
                      tier: { type: 'string', const: 'estandar' },
                      name: { type: 'string' },
                      subtitle: { type: 'string' },
                      room_ref: { type: 'string' },
                      photo_refs: {
                        type: 'array',
                        minItems: 1,
                        items: { type: 'string' }
                      },
                      likely_permit_types_guess: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      notes_internal: { type: 'string' }
                    },
                    required: ['id', 'tier', 'name', 'photo_refs']
                  }
                }
              },
              required: ['title', 'work_items']
            },
            optimo: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                work_items: {
                  type: 'array',
                  minItems: 1, // Allow comprehensive list
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', pattern: '^opt-\\d+$' },
                      tier: { type: 'string', const: 'optimo' },
                      name: { type: 'string' },
                      subtitle: { type: 'string' },
                      room_ref: { type: 'string' },
                      photo_refs: {
                        type: 'array',
                        minItems: 1,
                        items: { type: 'string' }
                      },
                      likely_permit_types_guess: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      notes_internal: { type: 'string' }
                    },
                    required: ['id', 'tier', 'name', 'photo_refs']
                  }
                }
              },
              required: ['title', 'work_items']
            },
            plus: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                work_items: {
                  type: 'array',
                  minItems: 1, // Allow comprehensive list
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', pattern: '^plus-\\d+$' },
                      tier: { type: 'string', const: 'plus' },
                      name: { type: 'string' },
                      subtitle: { type: 'string' },
                      room_ref: { type: 'string' },
                      photo_refs: {
                        type: 'array',
                        minItems: 1,
                        items: { type: 'string' }
                      },
                      likely_permit_types_guess: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      notes_internal: { type: 'string' }
                    },
                    required: ['id', 'tier', 'name', 'photo_refs']
                  }
                }
              },
              required: ['title', 'work_items']
            }
          },
          required: ['estandar', 'optimo', 'plus']
        }
      },
      required: ['listing_id', 'tiers']
    };

    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 32768 },
      maxOutputTokens: 32768, // High limit to handle comprehensive work items for all tiers (can generate many items)
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      logger.error('❌ Gemini call failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'seed_failed',
          details: result.error
        },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      logger.error('❌ Failed to parse AI response:', parseError);
      logger.error('❌ Response length:', result.text?.length || 0);
      logger.error('❌ Response preview (first 500 chars):', result.text?.substring(0, 500));
      logger.error('❌ Response preview (last 500 chars):', result.text?.substring(Math.max(0, (result.text?.length || 0) - 500)));
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_json',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          response_length: result.text?.length || 0,
          response_preview: result.text?.substring(0, 1000)
        },
        { status: 422 }
      );
    }

    // Add generated_at if missing
    if (!parsed.generated_at) {
      parsed.generated_at = new Date().toISOString();
    }

    // Add listing_id if missing
    if (!parsed.listing_id) {
      parsed.listing_id = listingId.toString();
    }

    // Fix work item IDs to match required pattern (est-1, opt-1, plus-1, etc.)
    const tierPrefixes = { estandar: 'est', optimo: 'opt', plus: 'plus' };
    for (const [tierKey, tier] of Object.entries(parsed.tiers || {})) {
      const prefix = tierPrefixes[tierKey as keyof typeof tierPrefixes];
      const tierData = tier as { work_items?: Array<any> };
      if (tierData.work_items) {
        tierData.work_items.forEach((item: any, index: number) => {
          // Ensure ID matches expected format: prefix-number (no leading zeros)
          const expectedId = `${prefix}-${index + 1}`;
          if (!item.id || !item.id.match(new RegExp(`^${prefix}-\\d+$`))) {
            logger.warn(`⚠️ Fixing work item ID: ${item.id} → ${expectedId} (tier: ${tierKey})`);
            item.id = expectedId;
          }
          // Ensure tier matches
          if (item.tier !== tierKey) {
            logger.warn(`⚠️ Fixing work item tier: ${item.tier} → ${tierKey}`);
            item.tier = tierKey;
          }
          // Ensure photo_refs is an array with at least one item
          if (!item.photo_refs || !Array.isArray(item.photo_refs) || item.photo_refs.length === 0) {
            // Try to get a photo from the room_ref or use first available photo
            if (item.room_ref && clusters) {
              const cluster = clusters.find((c: any) => c.id.toString() === item.room_ref);
              if (cluster?.photo_urls && cluster.photo_urls.length > 0) {
                item.photo_refs = [cluster.photo_urls[0]];
              } else if (photoUrls.length > 0) {
                item.photo_refs = [photoUrls[0]];
              }
            } else if (photoUrls.length > 0) {
              item.photo_refs = [photoUrls[0]];
            }
          }
        });
      }
    }

    // AJV validation with strict schema
    const isValid = validateScopeSeedOutput(parsed);
    if (!isValid) {
      logger.error('❌ AJV validation failed:', validateScopeSeedOutput.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'schema_validation_failed',
          details: validateScopeSeedOutput.errors
        },
        { status: 422 }
      );
    }

    // Store in database
    const { error: storeError } = await supabase
      .from('renovation_scope_reports')
      .upsert({
        listing_id: parseInt(listingId, 10),
        report_data: parsed,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (storeError) {
      logger.error('❌ Failed to store seed scope:', storeError);
      return NextResponse.json(
        {
          success: false,
          error: 'save_failed',
          details: storeError.message
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Seed Scope from Tiers: Generated comprehensive work items`);

    return NextResponse.json({
      success: true,
      scope_seed: parsed
    });

  } catch (error: any) {
    logger.error('❌ Seed Scope from Tiers failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'seed_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

