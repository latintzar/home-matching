import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { interceptConsoleLog } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

type Tier = 'estandar' | 'optimo' | 'plus';

const responseSchema = {
  type: 'object',
  properties: {
    tier: {
      type: 'string',
      enum: ['estandar', 'optimo', 'plus']
    },
    overall_staging_approach: {
      type: 'string' // Coherent staging strategy description
    },
    furniture_style_theme: {
      type: 'string' // Overall furniture style/theme for the house
    },
    material_palette: {
      type: 'object',
      properties: {
        primary_materials: { type: 'array', items: { type: 'string' } },
        color_scheme: { type: 'string' },
        finish_style: { type: 'string' }
      },
      required: ['primary_materials', 'color_scheme', 'finish_style']
    },
    budget_guidelines: {
      type: 'object',
      properties: {
        furniture_budget_range: { type: 'string' },
        cost_per_room_guideline: { type: 'string' },
        budget_appropriate_categories: { type: 'array', items: { type: 'string' } }
      },
      required: ['furniture_budget_range', 'cost_per_room_guideline', 'budget_appropriate_categories']
    },
    room_type_staging: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          staging_level: {
            type: 'string',
            enum: ['minimal', 'essential', 'comfortable', 'fully_furnished']
          },
          furniture_categories: { type: 'array', items: { type: 'string' } },
          staging_rationale: { type: 'string' }
        },
        required: ['staging_level', 'furniture_categories', 'staging_rationale']
      }
    },
    coherence_notes: {
      type: 'string' // Notes on how furniture flows between rooms
    }
  },
  required: ['tier', 'overall_staging_approach', 'furniture_style_theme', 'material_palette', 'budget_guidelines', 'room_type_staging', 'coherence_notes']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * R4.5: Generate Furniture Staging Plan
 * 
 * Generates a coherent whole-house furniture staging plan (not individual pieces per room).
 * Ensures furniture style, budget, and staging approach are consistent across the entire property.
 * 
 * Endpoint: POST /api/listings/[id]/after/generate-furniture-staging-plan
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, intercept console.log to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'R4.5';
  let restoreConsole: (() => void) | null = null;
  
  if (isOrchestratorContext) {
    restoreConsole = interceptConsoleLog(stepName);
  }

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

    console.log(`🎨 R4.5: Generate Furniture Staging Plan for listing ${listingId}, tier ${tier}`);

    // Check for existing staging plan
    if (!force) {
      const { data: existing } = await supabase
        .from('furniture_staging_plans')
        .select('id')
        .eq('listing_id', listingId.toString())
        .eq('tier', tier)
        .single();

      if (existing) {
        console.log(`✅ Staging plan already exists for tier ${tier}`);
        return NextResponse.json({
          success: true,
          message: 'Staging plan already exists',
          tier
        });
      }
    }

    // Fetch required inputs
    console.log(`📥 Fetching inputs for staging plan...`);

    // 1. Tier philosophy
    const { data: philosophiesData } = await supabase
      .from('tier_philosophies')
      .select('philosophies')
      .eq('listing_id', listingId.toString())
      .single();

    if (!philosophiesData?.philosophies) {
      return NextResponse.json(
        {
          success: false,
          error: 'tier_philosophies_not_found',
          details: 'Tier philosophies not found. Run tiers/ideation first.'
        },
        { status: 404 }
      );
    }

    const tierPhilosophy = philosophiesData.philosophies[tier];

    // 2. Style direction (T2.5)
    const { data: styleDirectionData } = await supabase
      .from('style_direction')
      .select('direction_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (!styleDirectionData?.direction_data) {
      return NextResponse.json(
        {
          success: false,
          error: 'style_direction_not_found',
          details: 'Style direction not found. Run tiers/style-direction first.'
        },
        { status: 404 }
      );
    }

    const styleDirection = styleDirectionData.direction_data.tiers?.[tier] || styleDirectionData.direction_data.baseline;

    // 3. Budget constraints (T6)
    const { data: budgetData } = await supabase
      .from('tier_budget_calibration')
      .select('calibration')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier)
      .single();

    // Also fetch tier budgeting (T1.5) for baseline
    const { data: tierBudgetingData } = await supabase
      .from('tier_budgeting')
      .select('budgeting_data')
      .eq('listing_id', listingId.toString())
      .single();

    const budgetConstraints = budgetData?.calibration || tierBudgetingData?.budgeting_data?.[tier] || null;

    // 4. Room layouts (Room-by-Room analysis)
    const { data: roomAnalysesData } = await supabase
      .from('room_analyses')
      .select('layout_allocentric, whole_home_summary')
      .eq('listing_id', listingId.toString())
      .single();

    const roomLayouts = roomAnalysesData?.layout_allocentric || null;
    const wholeHomeSummary = roomAnalysesData?.whole_home_summary || null;

    // 5. After-images (R3) - to understand renovated spaces
    const { data: afterImages } = await supabase
      .from('after_photos')
      .select('room_id, url')
      .eq('listing_id', parseInt(listingId, 10))
      .eq('tier', tier === 'estandar' ? 'livable' : tier === 'optimo' ? 'comfortable' : 'competitive')
      .eq('has_furniture', false);

    // 6. Room families for context
    const { data: families } = await supabase
      .from('room_families')
      .select('*')
      .eq('listing_id', listingId.toString());

    // 7. Listing info
    const { data: listing } = await supabase
      .from('listings')
      .select('title, scraped_data')
      .eq('id', listingId.toString())
      .single();

    console.log(`✅ Fetched all inputs`);

    // Build prompt for coherent staging plan
    const prompt = `You are creating a coherent whole-house furniture staging plan for a renovated property.

PROPERTY CONTEXT:
- Title: ${listing?.title || 'Property'}
- Tier: ${tier} (${tier === 'estandar' ? 'Estándar - lower passable' : tier === 'optimo' ? 'Óptimo - sweet spot' : 'Plus - all-out with reason'})

TIER PHILOSOPHY:
${JSON.stringify(tierPhilosophy, null, 2)}

STYLE DIRECTION:
${JSON.stringify(styleDirection, null, 2)}

BUDGET CONSTRAINTS:
${budgetConstraints ? JSON.stringify(budgetConstraints, null, 2) : 'No specific budget constraints available - use tier philosophy to guide budget-appropriate furniture selection'}

ROOM LAYOUTS:
${roomLayouts ? `Allocentric room layouts:\n${JSON.stringify(roomLayouts, null, 2)}` : 'Room layouts not available'}
${wholeHomeSummary ? `\nWhole-home summary:\n${JSON.stringify(wholeHomeSummary, null, 2)}` : ''}

ROOM FAMILIES:
${families && families.length > 0 ? JSON.stringify(families, null, 2) : 'No room families defined'}

AFTER-IMAGES:
${afterImages && afterImages.length > 0 ? `${afterImages.length} renovated after-images available (without furniture) - these show the renovated spaces that need staging` : 'After-images not yet generated'}

TASK:
Generate a coherent whole-house furniture staging plan. This is NOT about individual furniture pieces per room, but about creating a cohesive staging strategy that:

1. **Overall Staging Approach**: Define the staging philosophy (minimalist for Estándar, more furnished for Plus, etc.)
2. **Furniture Style Theme**: Establish a coherent style/theme that works across all rooms
3. **Material Palette**: Define consistent materials, colors, and finishes that tie the house together
4. **Budget Guidelines**: Ensure furniture selection is budget-appropriate for the tier (don't put expensive furniture in Estándar)
5. **Room Type Staging**: Define staging approach per room type (bedrooms, bathrooms, living areas, etc.) - NOT per individual room
6. **Coherence Notes**: Explain how furniture flows between rooms and maintains consistency

CRITICAL REQUIREMENTS:
- This is a STAGING PLAN, not individual furniture pieces
- Budget-appropriate: Estándar should use budget-friendly furniture, Plus can use premium pieces
- Style-coherent: Furniture should match the tier's style direction
- Whole-house coherence: Furniture should feel like it belongs to the same property
- Room-appropriate: Different room types need different staging levels (bedrooms vs living rooms vs bathrooms)

OUTPUT FORMAT:
Return a JSON object with:
- tier: "${tier}"
- overall_staging_approach: "1-2 paragraph description of the staging philosophy"
- furniture_style_theme: "Description of the coherent style theme"
- material_palette: { primary_materials: [...], color_scheme: "...", finish_style: "..." }
- budget_guidelines: { furniture_budget_range: "...", cost_per_room_guideline: "...", budget_appropriate_categories: [...] }
- room_type_staging: { "bedrooms": { staging_level: "...", furniture_categories: [...], staging_rationale: "..." }, "bathrooms": {...}, "living_areas": {...}, etc. }
- coherence_notes: "Notes on how furniture flows between rooms and maintains consistency"

Generate the staging plan now.`;

    console.log(`🤖 Generating staging plan with Gemini...`);

    const response = await callGeminiRest(prompt, {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 32768, // Increased from 16000 to handle comprehensive staging plans with multiple room types
      model: 'gemini-2.5-pro',
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!response.success || !response.text) {
      return NextResponse.json(
        {
          success: false,
          error: 'gemini_api_error',
          details: response.error || 'Failed to generate staging plan'
        },
        { status: 500 }
      );
    }

    // Parse and validate response
    let stagingPlan;
    try {
      stagingPlan = JSON.parse(response.text);
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'parse_error',
          details: 'Failed to parse Gemini response',
          raw: response.text.substring(0, 500)
        },
        { status: 500 }
      );
    }

    if (!validateResponse(stagingPlan)) {
      return NextResponse.json(
        {
          success: false,
          error: 'validation_error',
          details: 'Response does not match schema',
          errors: validateResponse.errors,
          data: stagingPlan
        },
        { status: 500 }
      );
    }

    console.log(`✅ Generated staging plan for tier ${tier}`);

    // Store in database
    const { error: dbError } = await supabase
      .from('furniture_staging_plans')
      .upsert({
        listing_id: listingId.toString(),
        tier,
        staging_plan: stagingPlan,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,tier'
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'database_error',
          details: dbError.message
        },
        { status: 500 }
      );
    }

    console.log(`💾 Staging plan saved to database`);

    return NextResponse.json({
      success: true,
      tier,
      staging_plan: stagingPlan,
      usage: response.usage
    });

  } catch (error: any) {
    console.error('❌ R4.5: Generate Furniture Staging Plan failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'generate_staging_plan_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (restoreConsole) {
      restoreConsole();
    }
  }
}

