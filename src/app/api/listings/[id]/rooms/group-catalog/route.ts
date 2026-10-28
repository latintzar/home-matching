import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

interface RoomFamily {
  family_id: string;
  family_name: string;
  room_ids: string[];
  rationale: string;
}

interface ElementCatalog {
  [element_type: string]: {
    count: number;
    examples: string[];
  };
}

interface GroupCatalogResponse {
  families: RoomFamily[];
  catalog?: ElementCatalog;
}

const responseSchema = {
  type: 'object',
  properties: {
    families: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          family_id: { type: 'string' },
          family_name: { type: 'string' },
          room_ids: {
            type: 'array',
            items: { type: 'string' }
          },
          rationale: { type: 'string' }
        },
        required: ['family_id', 'family_name', 'room_ids', 'rationale']
      }
    },
    catalog: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          count: { type: 'number' },
          examples: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['count', 'examples']
      }
    }
  },
  required: ['families']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * Group & Catalog: Group rooms into families and create element catalog
 * 
 * Groups similar rooms (e.g., all bathrooms, all bedrooms) for consistent treatment.
 * Optionally creates element catalog (can reuse e2_element_mapping structure).
 * 
 * Endpoint: POST /api/listings/[id]/rooms/group-catalog
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'T1';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`👥 Group & Catalog: Normalizing rooms into families for listing ${listingId}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('room_families')
      .select('family_id')
      .eq('listing_id', listingId.toString())
      .limit(1);

    if (existing && existing.length > 0) {
      const { data: families } = await supabase
        .from('room_families')
        .select('*')
        .eq('listing_id', listingId.toString());

      logger.log(`✅ Room families already exist (${families?.length || 0} families)`);
      return NextResponse.json({
        success: true,
        families: families || [],
        cached: true
      });
    }

    // Fetch allocentric layouts (REQUIRED - saved by RoomByRoom endpoint)
    const listingIdNum = parseInt(listingId, 10);
    const { data: roomAnalysis } = await supabase
      .from('room_analyses')
      .select('layout_allocentric, whole_home_summary')
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
      .single();

    if (!roomAnalysis?.layout_allocentric || roomAnalysis.layout_allocentric.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Allocentric layouts not found. RoomByRoom must run before T1.' },
        { status: 404 }
      );
    }

    const allocentricLayouts = roomAnalysis.layout_allocentric;
    const wholeHomeSummary = roomAnalysis.whole_home_summary;

    // Build prompt
    const prompt = `You are grouping similar rooms into families for consistent renovation treatment.

ALLOCENTRIC ROOM LAYOUTS (Phase 1):
${JSON.stringify(allocentricLayouts, null, 2)}

${wholeHomeSummary ? `WHOLE-HOME SUMMARY (spatial organization):
${JSON.stringify(wholeHomeSummary, null, 2)}` : ''}

TASK:
Group rooms into families based on:
1. **Function** (bathrooms, bedrooms, kitchens, living spaces, storage, etc.)
2. **Similar characteristics** (size, condition, finishes, fixtures)
3. **Renovation needs** (similar rooms should get similar treatment)

Examples:
- All bathrooms → "bathrooms" family
- All bedrooms → "bedrooms" family
- Kitchen + dining → "kitchen_dining" family (if connected/open)
- Living room + hall → "living_spaces" family
- Storage/utility rooms → "storage" family

For each family, provide:
- family_id: Lowercase identifier (e.g., "bathrooms", "bedrooms")
- family_name: Display name (e.g., "Bathrooms", "Bedrooms")
- room_ids: Array of room IDs from allocentric layouts that belong to this family
- rationale: Why these rooms are grouped together

OPTIONAL: Create element catalog summarizing element types across the property:
- Group elements by type (furniture, fixture, surface, structural, opening)
- Count occurrences
- List example element IDs

OUTPUT:
Return JSON with families array and optional catalog object.

Return ONLY valid JSON matching the schema.`;

    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 16384 },
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      logger.error('❌ Gemini call failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'grouping_failed',
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
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_json',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 422 }
      );
    }

    // Validate structure
    if (!validateResponse(parsed)) {
      logger.error('❌ Invalid response structure:', validateResponse.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_structure',
          details: validateResponse.errors
        },
        { status: 422 }
      );
    }

    const groupCatalogResponse = parsed as unknown as GroupCatalogResponse;

    // Save to database (one row per family)
    const familiesToInsert = groupCatalogResponse.families.map((family) => ({
      listing_id: listingId.toString(),
      family_id: family.family_id,
      family_name: family.family_name,
      room_ids: family.room_ids,
      rationale: family.rationale
    }));

    const { error: insertError } = await supabase
      .from('room_families')
      .insert(familiesToInsert);

    if (insertError) {
      logger.error('❌ Failed to save room families:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'save_failed',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Group & Catalog: Created ${groupCatalogResponse.families.length} room families`);

    return NextResponse.json({
      success: true,
      families: groupCatalogResponse.families,
      catalog: groupCatalogResponse.catalog,
      usage: result.usage,
      model: result.model
    });

  } catch (error: any) {
    logger.error('❌ Group & Catalog failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'grouping_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
