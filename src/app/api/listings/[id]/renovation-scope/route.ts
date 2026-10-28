import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { validateScopeSeedOutput } from '@/lib/schemas/renovation-schemas';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    console.log(`🏗️ Generating renovation scope for listing ${listingId}`);

    // Get integrated analysis data from text analysis results
    const { data: textResults, error: textError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true });

    if (textError || !textResults || textResults.length === 0) {
      console.error('❌ Failed to fetch text analysis results:', textError);
      return NextResponse.json(
        { error: 'No text analysis results found for this listing' },
        { status: 404 }
      );
    }

    // Organize results by phase
    const resultsByPhase = textResults.reduce((acc, result) => {
      acc[result.phase] = result;
      return acc;
    }, {} as Record<string, any>);

    // Get listing diagnostic data
    const listingDiagnostic = resultsByPhase.listing_diagnostic?.results || {};
    
    if (!listingDiagnostic || Object.keys(listingDiagnostic).length === 0) {
      console.error('❌ No listing diagnostic data found');
      return NextResponse.json(
        { error: 'No listing diagnostic analysis found for this listing' },
        { status: 404 }
      );
    }

    // Fetch E1/E2 layout data from room_analyses
    const { data: roomAnalysesData, error: roomAnalysesError } = await supabase
      .from('room_analyses')
      .select('room_layout_json, unified_home_layout_json')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const roomLayoutsMap = roomAnalysesData?.room_layout_json || {}; // JSONB object: roomId -> RoomLayoutJSON
    const unifiedLayout = roomAnalysesData?.unified_home_layout_json || null; // JSONB object: UnifiedHomeLayoutJSON
    
    // Convert roomLayoutsMap to array format
    const roomLayouts = Object.entries(roomLayoutsMap).map(([roomId, layout]) => ({
      room_id: roomId,
      ...(layout as Record<string, any>)
    }));

    // Fetch valid photos for photo_refs (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const validPhotos = await fetchValidListingPhotos(listingId);
    const photoUrls = validPhotos.map(p => p.url);

    // Fetch clusters for room_refs
    const { data: clusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, cluster_name, photo_urls')
      .eq('listing_id', listingId)
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

    // Get listing data for additional context
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      console.error('❌ Failed to fetch listing:', listingError);
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    console.log('🏗️ Calling Gemini REST API for renovation scope seed generation...');

    const prompt = `
SYSTEM:
You are creating an initial, buyer-digestible renovation plan seed for three tiers (Estándar, Óptimo, Plus).
Use the diagnostic report + whole-property + room analyses + room layouts.

🎯 GOAL:
The work item list should read like a renovation plan you can picture, not a bill of quantities.
Think "what will actually change in my home?", not "what trades will do which tasks?".

Create 5–10 plainspoken work items per tier. Each item must be easy to picture and link to at least one BEFORE photo.

✅ IDEAL LANGUAGE MODEL:
Tone: referential, concise, tactile, anchored in visual reality.

Example progression:

Too Technical | Too Vague | ✅ Just Right
---|---|---
"Replacement of flooring finishes in main living area" | "Renovate living room" | "Replace flooring in the living room"
"Installation of new HVAC ducted system" | "Improve climate system" | "Add ducted climate system throughout home"
"Demolition of existing partition wall between kitchen and lounge" | "Open up kitchen" | "Knock down wall between kitchen and living room"

NAMING RULES (critical):
- Use plain present tense ("Replace", "Add", "Install", "Remove")
- Refer directly to visible elements ("flooring", "wall", "cabinetry")
- One sentence long, natural to read aloud
- All names must be in Spanish

💡 UI-LEVEL FORMULA:
[Action Verb] + [Visible Element] + [Location]

Example:
- Name: "Replace flooring in the living room"
- Subtitle (optional): "Install continuous oak-look porcelain floor to unify spaces"
- Use room_ref and photo_refs for visual coherence

🧠 GRANULARITY:
You want a digestible, buyer-level list — about 5–10 work items per tier, not 40.

Instead of "replace taps", "replace mirror", "replace lighting" →
combine into: "Refresh bathroom finishes and fittings"

Then use the subtitle for extra realism:
"Apply microcement on tiles, update lighting, and replace vanity unit."

Group small sub-actions that are:
- In the same room
- Same trade type (e.g. finishes, fittings)
- Same permit classification

This makes it: ✅ credible, ✅ visually matchable, ✅ readable

LAYOUT CONSISTENCY (critical):
- Use room_layouts to identify surfaces or elements that visibly require update.
- Reference existing materials (surfaces.floor, surfaces.walls) to support realistic upgrades:
  * "Replace oak flooring" (not generic "replace flooring")
  * "Upgrade matte white walls to semi-gloss" (preserves material continuity)
- Use unified_layout.connections to ensure structural changes are physically consistent:
  * "Knock down wall between kitchen and living room" only if connections array shows adjacency
  * Add cross-room rationale: "Opening between kitchen and living area permits uniform flooring"
- Reuse the same material vocabulary across tiers (oak → oak upgrade / replace oak with porcelain, etc.).

STRUCTURE:
- Do NOT include costs, durations, or dependencies here.
- Include room_ref when clear, and ALWAYS include at least one photo_ref for UI linking.
- Use deterministic IDs: "est-01", "est-02", "opt-01", "opt-02", "plus-01", etc. (tier prefix + sequential number)
- If you anticipate permits, add likely_permit_types_guess minimally (e.g., ["obra_mayor"] for structural or layout changes).

LISTING DIAGNOSTIC:
${JSON.stringify(listingDiagnostic, null, 2)}

ROOM LAYOUTS (E1):
${JSON.stringify(roomLayouts, null, 2)}

UNIFIED HOME LAYOUT (E2):
${JSON.stringify(unifiedLayout, null, 2)}

AVAILABLE PHOTOS (use URLs for photo_refs):
${JSON.stringify(photoUrls.slice(0, 50), null, 2)}

ROOM CLUSTERS (use cluster IDs for room_refs):
${JSON.stringify(clusters?.map(c => ({ id: c.id, name: c.cluster_name })), null, 2)}

OUTPUT:
Valid JSON matching ScopeSeedOutput. Preserve tier per item; tiers must be meaningfully distinct.`;

    // Define response schema for structured output (matching ScopeSeedOutput)
    // Simplified schema to avoid "too many states" error from Gemini
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
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      tier: { type: 'string' },
                      name: { type: 'string' },
                      subtitle: { type: 'string' },
                      room_ref: { type: 'string' },
                      photo_refs: {
                        type: 'array',
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
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      tier: { type: 'string' },
                      name: { type: 'string' },
                      subtitle: { type: 'string' },
                      room_ref: { type: 'string' },
                      photo_refs: {
                        type: 'array',
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
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      tier: { type: 'string' },
                      name: { type: 'string' },
                      subtitle: { type: 'string' },
                      room_ref: { type: 'string' },
                      photo_refs: {
                        type: 'array',
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
      required: ['listing_id', 'generated_at', 'tiers']
    };

    const startTime = Date.now();
    const response = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.7, // Higher temperature for creative renovation planning
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingBudget: 32768 // Max thinking tokens
      },
      responseMimeType: 'application/json',
      responseSchema
    });
    const duration = Date.now() - startTime;
    
    console.log(`🤖 Gemini REST API call completed in ${duration}ms`);

    if (!response.success || !response.text) {
      console.error('❌ Gemini REST API call failed:', response.error);
      console.error('❌ Raw error response:', response.rawResponse);
      return NextResponse.json(
        { error: 'Failed to generate renovation scope', details: response.error, rawError: response.rawResponse },
        { status: 500 }
      );
    }

    const responseText = response.text;
    console.log('📊 Raw Gemini response length:', responseText.length);

    let scopeSeed: any;
    try {
      // Structured output should provide clean JSON, but strip markdown code blocks if present
      const cleaned = responseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      scopeSeed = JSON.parse(cleaned);
      
      // Ensure listing_id is set correctly
      scopeSeed.listing_id = listingId;
      scopeSeed.generated_at = new Date().toISOString();
      
      // Fix deterministic IDs format (est-01, opt-01, plus-01, etc.) before validation
      const tierPrefixes = { estandar: 'est', optimo: 'opt', plus: 'plus' };
      for (const [tierKey, tier] of Object.entries(scopeSeed.tiers || {})) {
        const prefix = tierPrefixes[tierKey as keyof typeof tierPrefixes];
        const tierData = tier as { work_items?: Array<any> };
        if (tierData.work_items) {
          tierData.work_items.forEach((item: any, index: number) => {
            // Ensure ID matches expected format or fix it
            const expectedId = `${prefix}-${String(index + 1).padStart(2, '0')}`;
            if (!item.id || !item.id.startsWith(prefix)) {
              console.warn(`⚠️ Fixing work item ID: ${item.id} → ${expectedId}`);
              item.id = expectedId;
            }
            // Ensure tier matches
            if (item.tier !== tierKey) {
              console.warn(`⚠️ Fixing work item tier: ${item.tier} → ${tierKey}`);
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
      const isValid = validateScopeSeedOutput(scopeSeed);
      if (!isValid) {
        console.error('❌ AJV validation failed:', validateScopeSeedOutput.errors);
        return NextResponse.json(
          { 
            error: 'Schema validation failed', 
            details: validateScopeSeedOutput.errors 
          },
          { status: 422 }
        );
      }
      
      console.log(`✅ Generated and validated renovation scope seed for listing ${listingId}`);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response:', parseError);
      console.error('Raw response:', responseText);
      return NextResponse.json(
        { error: 'Invalid response format from AI', details: parseError instanceof Error ? parseError.message : 'Unknown parsing error' },
        { status: 500 }
      );
    }

    // Store in database (using renovation_scope_reports table for now, will be updated when we have renovation_scope_seeds table)
    const { error: storeError } = await supabase
      .from('renovation_scope_reports')
      .upsert({
        listing_id: parseInt(listingId),
        report_data: scopeSeed,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (storeError) {
      console.error('❌ Failed to store renovation scope seed:', storeError);
      return NextResponse.json(
        { error: 'Failed to store renovation scope seed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scope_seed: scopeSeed
    });

  } catch (error) {
    console.error('❌ Renovation scope generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`📋 Fetching renovation scope for listing ${listingId}`);

    const { data, error } = await supabase
      .from('renovation_scope_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (error || !data) {
      console.error('❌ Failed to fetch renovation scope:', error);
      return NextResponse.json(
        { error: 'No renovation scope found for this listing' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      renovation_scope: data.report_data
    });

  } catch (error) {
    console.error('❌ Get renovation scope error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
