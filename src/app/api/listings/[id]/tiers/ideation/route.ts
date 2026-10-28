import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });

interface TierPhilosophy {
  intent: string;
  quality_band: string;
  constraints: string[];
}

interface TierPhilosophies {
  estandar: TierPhilosophy;
  optimo: TierPhilosophy;
  plus: TierPhilosophy;
}

interface IdeationResponse {
  philosophies: TierPhilosophies;
}

const responseSchema = {
  type: 'object',
  properties: {
    philosophies: {
      type: 'object',
      properties: {
        estandar: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            quality_band: { type: 'string' },
            constraints: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['intent', 'quality_band', 'constraints']
        },
        optimo: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            quality_band: { type: 'string' },
            constraints: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['intent', 'quality_band', 'constraints']
        },
        plus: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            quality_band: { type: 'string' },
            constraints: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['intent', 'quality_band', 'constraints']
        }
      },
      required: ['estandar', 'optimo', 'plus']
    }
  },
  required: ['philosophies']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * Tier Ideation: Define whole-house tier philosophies
 * 
 * Defines tier philosophies:
 * - Estándar: Lower passable - functional, basic, practical
 * - Óptimo: Sweet spot - modern, quality, good value
 * - Plus: All-out with reason - premium, luxury, sophisticated
 * 
 * Endpoint: POST /api/listings/[id]/tiers/ideation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'T2';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`💭 Tier Ideation: Defining tier philosophies for listing ${listingId}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('tier_philosophies')
      .select('philosophies')
      .eq('listing_id', listingId.toString())
      .single();

    if (existing) {
      logger.log(`✅ Tier philosophies already exist`);
      return NextResponse.json({
        success: true,
        philosophies: existing.philosophies,
        cached: true
      });
    }

    // Fetch Integrated Diagnostic (H) - saved with phase 'listing_diagnostic'
    const listingIdNum = parseInt(listingId, 10);
    const { data: diagnosticData } = await supabase
      .from('text_analysis_results')
      .select('results')
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
      .eq('phase', 'listing_diagnostic')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!diagnosticData?.results) {
      return NextResponse.json(
        { success: false, error: 'Integrated diagnostic not found. Run integrated analysis first.' },
        { status: 404 }
      );
    }

    const diagnostic = diagnosticData.results;

    // Fetch tier budgeting (T1.5) - NEW: Required for realistic tier philosophies
    const { data: budgetingData } = await supabase
      .from('tier_budgeting')
      .select('budgeting_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (!budgetingData?.budgeting_data) {
      return NextResponse.json(
        { success: false, error: 'Tier budgeting not found. Run tiers/budgeting first (T1.5).' },
        { status: 404 }
      );
    }

    const tierBudgets = budgetingData.budgeting_data;

    // Fetch room families
    const { data: families } = await supabase
      .from('room_families')
      .select('*')
      .eq('listing_id', listingId.toString());

    // Fetch listing metadata
    const { data: listing } = await supabase
      .from('listings')
      .select('title, price, size, bedrooms, bathrooms, location')
      .eq('id', parseInt(listingId, 10))
      .single();

    // Build prompt
    const prompt = `You are defining whole-house tier philosophies for renovation planning.

INTEGRATED DIAGNOSTIC:
${JSON.stringify(diagnostic, null, 2)}

TIER BUDGET BRACKETS (T1.5 - provides budget context):
${JSON.stringify(tierBudgets, null, 2)}

${families && families.length > 0 ? `ROOM FAMILIES:
${JSON.stringify(families, null, 2)}` : ''}

${listing ? `LISTING METADATA:
- Title: ${listing.title}
- Price: ${listing.price}
- Size: ${listing.size} m²
- Bedrooms: ${listing.bedrooms}
- Bathrooms: ${listing.bathrooms}
- Location: ${listing.location || 'N/A'}` : ''}

TASK:
Define three tier philosophies that guide renovation decisions. CRITICAL: Align philosophies with the budget brackets provided.

1. **Estándar (Lower Passable)**:
   - Intent: Functional, clean, basic finishes
   - Quality Band: Lower passable - meets minimum standards
   - Constraints: Minimal structural changes, basic materials, practical solutions
   - Budget Context: ${tierBudgets.estandar.min_eur}-${tierBudgets.estandar.max_eur} EUR (${tierBudgets.renovation_percentage_of_value.estandar} of property value)
   - Philosophy must be realistic for this budget range

2. **Óptimo (Sweet Spot)**:
   - Intent: Modern, stylish, quality materials
   - Quality Band: Sweet spot - best value for money
   - Constraints: Includes all Estándar changes, upgrade key finishes, modernize where needed
   - Budget Context: ${tierBudgets.optimo.min_eur}-${tierBudgets.optimo.max_eur} EUR (${tierBudgets.renovation_percentage_of_value.optimo} of property value)
   - Philosophy must be realistic for this budget range

3. **Plus (All-out with Reason)**:
   - Intent: Luxury, premium materials, designer touches
   - Quality Band: All-out with reason - premium upgrades justified by property value
   - Constraints: Includes all Óptimo changes, replace outdated items, premium finishes
   - Budget Context: ${tierBudgets.plus.min_eur}-${tierBudgets.plus.max_eur} EUR (${tierBudgets.renovation_percentage_of_value.plus} of property value)
   - Philosophy must be realistic for this budget range

Each philosophy should:
- Be specific to this property (consider diagnostic findings, property value, location)
- Align with the budget brackets (philosophies must be achievable within budget ranges)
- Guide consistent decisions across all room families
- Ensure clear progression (Plus includes Óptimo includes Estándar)
- Be realistic given property context and budget constraints

OUTPUT:
Return JSON with philosophies object containing estandar, optimo, and plus.

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
          error: 'ideation_failed',
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

    const ideationResponse = parsed as unknown as IdeationResponse;

    // Save to database
    const { error: insertError } = await supabase
      .from('tier_philosophies')
      .upsert({
        listing_id: listingId.toString(),
        philosophies: ideationResponse.philosophies
      }, {
        onConflict: 'listing_id'
      });

    if (insertError) {
      logger.error('❌ Failed to save tier philosophies:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'save_failed',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Tier Ideation: Defined tier philosophies`);

    return NextResponse.json({
      success: true,
      philosophies: ideationResponse.philosophies,
      usage: result.usage,
      model: result.model
    });

  } catch (error: any) {
    logger.error('❌ Tier Ideation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'ideation_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

