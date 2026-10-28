import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

interface TierBudget {
  min_eur: number;
  max_eur: number;
  rationale: string;
}

interface TierBudgetingData {
  estandar: TierBudget;
  optimo: TierBudget;
  plus: TierBudget;
  property_value_eur: number;
  renovation_percentage_of_value: {
    estandar: string;
    optimo: string;
    plus: string;
  };
}

interface BudgetingResponse {
  budgeting_data: TierBudgetingData;
}

const responseSchema = {
  type: 'object',
  properties: {
    budgeting_data: {
      type: 'object',
      properties: {
        estandar: {
          type: 'object',
          properties: {
            min_eur: { type: 'number' },
            max_eur: { type: 'number' },
            rationale: { type: 'string' }
          },
          required: ['min_eur', 'max_eur', 'rationale']
        },
        optimo: {
          type: 'object',
          properties: {
            min_eur: { type: 'number' },
            max_eur: { type: 'number' },
            rationale: { type: 'string' }
          },
          required: ['min_eur', 'max_eur', 'rationale']
        },
        plus: {
          type: 'object',
          properties: {
            min_eur: { type: 'number' },
            max_eur: { type: 'number' },
            rationale: { type: 'string' }
          },
          required: ['min_eur', 'max_eur', 'rationale']
        },
        property_value_eur: { type: 'number' },
        renovation_percentage_of_value: {
          type: 'object',
          properties: {
            estandar: { type: 'string' },
            optimo: { type: 'string' },
            plus: { type: 'string' }
          },
          required: ['estandar', 'optimo', 'plus']
        }
      },
      required: ['estandar', 'optimo', 'plus', 'property_value_eur', 'renovation_percentage_of_value']
    }
  },
  required: ['budgeting_data']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * Tier Budgeting (T1.5): Calculate baseline budget brackets per tier
 * 
 * Calculates baseline budget brackets for each tier (Estándar, Óptimo, Plus) based on:
 * - Property value (from listings table - price)
 * - Property condition (from whole property analysis + room-by-room analysis)
 * - Property size (m² from listings table)
 * - Property type (apartment, house, etc.)
 * - Location (for regional cost context)
 * 
 * Runs BEFORE T2 (Tier Ideation) - tier philosophies need budget context to be realistic.
 * 
 * Endpoint: POST /api/listings/[id]/tiers/budgeting
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'T1.5';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`💰 Tier Budgeting (T1.5): Calculating baseline budget brackets for listing ${listingId}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('tier_budgeting')
      .select('budgeting_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (existing) {
      logger.log(`✅ Tier budgeting already exists`);
      return NextResponse.json({
        success: true,
        budgeting_data: existing.budgeting_data,
        cached: true
      });
    }

    // Fetch listing metadata
    const listingIdInt = parseInt(listingId, 10);
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('title, price_eur, city, region, scraped_data')
      .eq('id', listingIdInt)
      .single();

    if (listingError || !listing) {
      logger.error('Listing query error:', listingError);
      return NextResponse.json(
        { success: false, error: `Listing not found. ID: ${listingId} (parsed as ${listingIdInt}), Error: ${listingError?.message || 'Unknown'}` },
        { status: 404 }
      );
    }

    const propertyValue = listing.price_eur || listing.scraped_data?.price || 0;
    const propertySize = listing.scraped_data?.areas?.constructed || listing.scraped_data?.areas?.useful || listing.scraped_data?.sqm || 0;
    const propertyType = (listing as any).property_type || listing.scraped_data?.property_type || listing.scraped_data?.typology || 'apartment';
    const location = listing.city || listing.region || listing.scraped_data?.location?.city || listing.scraped_data?.location?.address || 'Spain';

    // Fetch Integrated Diagnostic for property condition assessment
    const { data: diagnosticData } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId.toString())
      .eq('phase', 'integrated_diagnostic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const diagnostic = diagnosticData?.results || null;

    // Fetch whole property analysis for condition assessment
    const { data: wholePropertyData } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data')
      .eq('listing_id', parseInt(listingId, 10))
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const wholePropertyAnalysis = wholePropertyData?.analysis_data || null;

    // Build prompt
    const prompt = `You are calculating baseline budget brackets for renovation tiers based on property context.

PROPERTY INFORMATION:
- Title: ${listing.title}
- Property Value: ${propertyValue} EUR
- Size: ${propertySize} m²
- Property Type: ${propertyType}
- Location: ${location}

${diagnostic ? `INTEGRATED DIAGNOSTIC (property condition assessment):
${JSON.stringify(diagnostic, null, 2)}` : ''}

${wholePropertyAnalysis ? `WHOLE PROPERTY ANALYSIS (condition details):
${JSON.stringify(wholePropertyAnalysis, null, 2)}` : ''}

TASK:
Calculate baseline budget brackets for three renovation tiers:

1. **Estándar (Lower Passable)**:
   - Typical range: 5-15% of property value
   - Focus: Functional refresh, basic finishes, minimal structural changes
   - Consider: Property condition (worse condition = higher minimums)
   - Consider: Property size (larger = higher absolute costs)
   - Consider: Regional context (Spanish market norms)

2. **Óptimo (Sweet Spot)**:
   - Typical range: 15-30% of property value
   - Focus: Modernized comfort, quality materials, smart features
   - Must be higher than Estándar maximum
   - Consider: Property value (higher value = higher renovation budgets make sense)

3. **Plus (All-out with Reason)**:
   - Typical range: 30-60% of property value
   - Focus: Transformative renovation, premium finishes, designer touches
   - Must be higher than Óptimo maximum
   - Consider: Property value and condition (justify premium investment)

CALCULATION LOGIC:
- Consider property value (higher value = higher renovation budgets make sense)
- Consider property condition (worse condition = higher minimums)
- Consider property size (larger = higher absolute costs)
- Consider regional context (Spanish market norms)
- Calculate as percentage of property value (typical ranges: Estándar 5-15%, Óptimo 15-30%, Plus 30-60%)
- Ensure clear progression (Plus > Óptimo > Estándar)

OUTPUT:
Return JSON with budgeting_data containing:
- estandar: { min_eur, max_eur, rationale }
- optimo: { min_eur, max_eur, rationale }
- plus: { min_eur, max_eur, rationale }
- property_value_eur: ${propertyValue}
- renovation_percentage_of_value: { estandar: "X-Y%", optimo: "X-Y%", plus: "X-Y%" }

Each rationale should explain why these budget ranges are appropriate for this property.

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
          error: 'budgeting_failed',
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

    const budgetingResponse = parsed as unknown as BudgetingResponse;

    // Save to database
    const { error: insertError } = await supabase
      .from('tier_budgeting')
      .upsert({
        listing_id: listingId.toString(),
        budgeting_data: budgetingResponse.budgeting_data
      }, {
        onConflict: 'listing_id'
      });

    if (insertError) {
      logger.error('❌ Failed to save tier budgeting:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'save_failed',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Tier Budgeting (T1.5): Calculated budget brackets`);

    return NextResponse.json({
      success: true,
      budgeting_data: budgetingResponse.budgeting_data
    });

  } catch (error: any) {
    logger.error('❌ Tier Budgeting failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'budgeting_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

