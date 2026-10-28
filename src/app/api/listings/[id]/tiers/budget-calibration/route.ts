import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { finalRenovationScopeSchema } from '@/lib/schemas/renovation-schemas';
import type { FinalRenovationScope } from '@/lib/schemas/renovation-schemas';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ajv = new Ajv({ allErrors: true });
addFormats(ajv); // Add support for date-time format
const validateResponse = ajv.compile(finalRenovationScopeSchema);

/**
 * Convert AJV schema to Gemini-compatible schema by removing unsupported features
 * Gemini doesn't support: $id, const, multipleOf, additionalProperties, pattern
 * All objects MUST have type: 'object' explicitly
 */
function toGeminiSchema(schema: any): any {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(toGeminiSchema);
  }

  const cleaned: any = {};

  // Preserve type field first
  if (schema.type) {
    cleaned.type = schema.type;
}

  for (const [key, value] of Object.entries(schema)) {
    // Skip unsupported features
    if (key === '$id' || key === 'additionalProperties' || key === 'multipleOf' || key === 'pattern' || key === 'type') {
      continue; // type already handled above
    }

    // Convert 'const' to 'enum' for Gemini compatibility
    if (key === 'const') {
      cleaned.type = 'string'; // Gemini needs type with enum
      cleaned.enum = [value];
      continue;
}

    // Recursively clean nested objects/arrays
    if (typeof value === 'object' && value !== null) {
      cleaned[key] = toGeminiSchema(value);
    } else {
      cleaned[key] = value;
}
  }

  // Ensure objects have type field - check if it has properties (it's an object schema)
  if (cleaned.properties) {
    if (!cleaned.type) {
      cleaned.type = 'object';
    }
  } else if (cleaned.items) {
    // Array items - ensure items schema has type
    if (typeof cleaned.items === 'object' && cleaned.items !== null && !cleaned.items.type) {
      // If items is an object without type, infer it
      if (cleaned.items.properties) {
        cleaned.items.type = 'object';
      }
    }
  }

  return cleaned;
}

// Create Gemini-compatible schema (without unsupported features)
const geminiResponseSchema = toGeminiSchema(finalRenovationScopeSchema);

// Debug: Check for objects without type field
function validateSchemaHasTypes(schema: any, path = 'root'): string[] {
  const errors: string[] = [];
  if (typeof schema === 'object' && schema !== null && !Array.isArray(schema)) {
    if (schema.properties && !schema.type) {
      errors.push(`${path}: object with properties missing type`);
    }
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        errors.push(...validateSchemaHasTypes(value, `${path}.${key}`));
      } else if (key === 'items' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        errors.push(...validateSchemaHasTypes(value, `${path}.items`));
      }
    }
  }
  return errors;
}

const schemaErrors = validateSchemaHasTypes(geminiResponseSchema);
if (schemaErrors.length > 0) {
  console.warn('⚠️ Schema validation errors:', schemaErrors);
}

/**
 * Glue B - Budget Calibration: Adjust tiers to hit budget targets
 * 
 * Calibrates tiers to hit targets:
 * - Estándar: Lower passable budget
 * - Óptimo: Sweet spot budget
 * - Plus: All-out with reason budget
 * 
 * Endpoint: POST /api/listings/[id]/tiers/budget-calibration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'T6';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    logger.log(`💰 Glue B - Budget Calibration: Adjusting tiers to hit budget targets for listing ${listingId}`);

    // Fetch N's final scope (from renovation-scope-finalize)
    const { data: finalScopeData } = await supabase
      .from('final_renovation_scope')
      .select('scope_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (!finalScopeData?.scope_data) {
      return NextResponse.json(
        { success: false, error: 'Final scope not found. Run renovation-scope-finalize (N) first.' },
        { status: 404 }
      );
    }

    const finalScope = finalScopeData.scope_data;

    // Fetch T1.5 budget brackets
    const { data: tierBudgetingData } = await supabase
      .from('tier_budgeting')
      .select('budgeting_data')
      .eq('listing_id', listingId.toString())
      .single();

    if (!tierBudgetingData?.budgeting_data) {
      return NextResponse.json(
        { success: false, error: 'Tier budgeting not found. Run tiers/budgeting (T1.5) first.' },
        { status: 404 }
      );
    }

    const tierBudgeting = tierBudgetingData.budgeting_data;

    // Check for Customised Tier Budgeting (if exists - future feature)
    // For now, use T1.5 baseline budgeting
    const budgetBrackets = tierBudgeting;

    // Fetch renovation Google Search results (costs) - REQUIRED for realistic calibration
    const { data: researchResults } = await supabase
      .from('renovation_research_results')
      .select('category, report_data')
      .eq('listing_id', parseInt(listingId, 10))
      .like('category', 'costs_%');

    if (!researchResults || researchResults.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cost research results not found. Run renovation-google-search first to get realistic cost data for calibration.' 
        },
        { status: 404 }
      );
    }

    // Fetch tier philosophies
    const { data: philosophiesData } = await supabase
      .from('tier_philosophies')
      .select('philosophies')
      .eq('listing_id', listingId.toString())
      .single();

    if (!philosophiesData?.philosophies) {
      return NextResponse.json(
        { success: false, error: 'Tier philosophies not found. Run tiers/ideation first.' },
        { status: 404 }
      );
    }

    const philosophies = philosophiesData.philosophies;

    // Fetch tier-specific style direction (T2.5) - NEW: Required to account for style-driven costs
    const { data: styleDirectionData } = await supabase
      .from('style_direction')
      .select('direction_data')
      .eq('listing_id', listingId.toString())
      .single();

    const styleDirections = styleDirectionData?.direction_data?.tiers || null;

    // Fetch Tier Element Synthesis (REQUIRED - includes cohesion_summary)
    const { data: synthesisData } = await supabase
      .from('tier_element_synthesis')
      .select('tier, synthesis_data')
      .eq('listing_id', listingId.toString());

    if (!synthesisData || synthesisData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tier Element Synthesis not found. TierElementSynthesis must run before T6.' },
        { status: 404 }
      );
    }

      // Extract cohesion_summary from synthesis
    const cohesionNotes = synthesisData.map(s => ({
        tier: s.tier,
        cohesion: s.synthesis_data.cohesion_summary || null
      }));
    logger.log(`✅ Using cohesion from Tier Element Synthesis`);

    // Fetch room families for context
    const { data: families } = await supabase
      .from('room_families')
      .select('*')
      .eq('listing_id', listingId.toString());

    // Fetch listing metadata for context
    const { data: listing } = await supabase
      .from('listings')
      .select('title, price, size, bedrooms, bathrooms, location')
      .eq('id', parseInt(listingId, 10))
      .single();

    // Build prompt
    const prompt = `You are calibrating renovation tiers to hit budget targets.

FINAL SCOPE (N's output - work items, cost, time, permits):
${JSON.stringify(finalScope, null, 2)}

BUDGET BRACKETS (T1.5 - target ranges per tier):
${JSON.stringify(budgetBrackets, null, 2)}

COST RESEARCH RESULTS (REQUIRED for realistic calibration):
${JSON.stringify(researchResults, null, 2)}

TIER PHILOSOPHIES:
${JSON.stringify(philosophies, null, 2)}

${styleDirections ? `TIER-SPECIFIC STYLE DIRECTIONS (T2.5 - style choices impact material costs):
${JSON.stringify(styleDirections, null, 2)}

CRITICAL: Style choices significantly impact costs:
- Mediterranean luxury (ornate fixtures, terracotta tiles, brass hardware) = higher material costs
- Contemporary minimalism (precision work, seamless detailing) = higher labor costs
- Industrial loft (exposed pipes, reclaimed materials) = lower material costs but may require custom fitting
- Style-driven material costs must be accounted for in budget calibration` : ''}

${cohesionNotes && cohesionNotes.length > 0 ? `COHESION NOTES (Glue A - ensures unity across rooms):
${JSON.stringify(cohesionNotes, null, 2)}` : ''}

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
Calibrate each tier to hit target budget ranges from T1.5 budget brackets:

1. **Estándar (Lower Passable)**:
   - Target: ${budgetBrackets.estandar?.min_eur || 'N/A'} - ${budgetBrackets.estandar?.max_eur || 'N/A'} EUR (from T1.5)
   - Current total: ${finalScope.tiers?.estandar?.total_estimate_range_eur?.[0] || 0} - ${finalScope.tiers?.estandar?.total_estimate_range_eur?.[1] || 0} EUR
   - If over budget, remove/modify items that exceed threshold
   - Keep core functional improvements
   - Revise work items, cost, time, and permits accordingly

2. **Óptimo (Sweet Spot)**:
   - Target: ${budgetBrackets.optimo?.min_eur || 'N/A'} - ${budgetBrackets.optimo?.max_eur || 'N/A'} EUR (from T1.5)
   - Current total: ${finalScope.tiers?.optimo?.total_estimate_range_eur?.[0] || 0} - ${finalScope.tiers?.optimo?.total_estimate_range_eur?.[1] || 0} EUR
   - If over budget, prioritize high-impact items
   - Remove items that don't add proportional value
   - Revise work items, cost, time, and permits accordingly

3. **Plus (All-out with Reason)**:
   - Target: ${budgetBrackets.plus?.min_eur || 'N/A'} - ${budgetBrackets.plus?.max_eur || 'N/A'} EUR (from T1.5)
   - Current total: ${finalScope.tiers?.plus?.total_estimate_range_eur?.[0] || 0} - ${finalScope.tiers?.plus?.total_estimate_range_eur?.[1] || 0} EUR
   - If over budget, keep premium items that justify property value
   - Remove items that don't align with premium positioning
   - Revise work items, cost, time, and permits accordingly

CRITICAL CONSTRAINTS:

1. **PRESERVE PROGRESSION**:
   - Plus MUST include all Óptimo work items
   - Óptimo MUST include all Estándar work items
   - Maintain progression in all adjustments

2. **PRESERVE COHESION**:
   - Preserve items that maintain material consistency (reference cohesion notes)
   - Preserve items that maintain style coherence (reference cohesion notes)
   - Maintain family-level consistency (reference room families)
   - Ensure tier unity, color harmony, and progression consistency from cohesion notes

3. **BUDGET REALISM**:
   - Use cost research results to estimate realistic costs for each work item
   - Reference actual market prices from research data
   - Consider property value and location
   - Target ranges should be realistic for property context based on research findings
   ${styleDirections ? `- Account for style-driven material costs (e.g., Mediterranean luxury = ornate fixtures cost more than basic fixtures)` : ''}
   ${styleDirections ? `- Consider style impact on labor intensity (e.g., minimalist seamless = higher precision work costs)` : ''}

OUTPUT:
Return the REVISED FINAL SCOPE with budget adjustments applied. This should be the same structure as the input final scope, but with:
- Work items adjusted (removed/modified/added based on budget constraints)
- Cost ranges updated to reflect adjustments
- Timeline phases adjusted if work items changed
- Permits updated if work items requiring permits changed
- Total estimate ranges recalculated to match revised work items

CRITICAL RULES:
1. **PRESERVE ORIGINAL WORK ITEM IDs**: When modifying existing work items, keep their original IDs (e.g., "est-1", "opt-2", "plus-3"). Do NOT generate new IDs.
2. **ID FORMAT**: Work item IDs must match these patterns exactly:
   - Estándar tier: IDs must start with "est-" followed by numbers (e.g., "est-1", "est-2")
   - Óptimo tier: IDs must start with "opt-" followed by numbers (e.g., "opt-1", "opt-2")
   - Plus tier: IDs must start with "plus-" followed by numbers (e.g., "plus-1", "plus-2")
3. **ONLY REMOVE, DON'T ADD NEW**: When budget constraints require reductions, remove work items entirely. Do NOT add new work items with new IDs.

The output must maintain the exact same structure as FinalRenovationScope:
- listing_id: "${finalScope.listing_id || listingId}"
- generated_at: Current ISO 8601 timestamp
- tiers: { estandar: {...}, optimo: {...}, plus: {...} }
- validation: { pricing_ids_covered, timeline_items_mapped, permit_ids_mapped, sums_check_passed }

CRITICAL: Apply adjustments to the actual final scope structure - don't just return adjustments. Return the complete revised final scope.

Return ONLY valid JSON matching the FinalRenovationScope schema.`;

    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 32768 },
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema
    });

    if (!result.success || !result.text) {
      logger.error('❌ Gemini call failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'calibration_failed',
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

    const revisedScope = parsed as unknown as FinalRenovationScope;

    // Ensure listing_id is set
    if (!revisedScope.listing_id) {
      revisedScope.listing_id = listingId.toString();
    }

    // Ensure generated_at is set
    if (!revisedScope.generated_at) {
      revisedScope.generated_at = new Date().toISOString();
    }

    // Save revised scope to final_renovation_scope_calibrated table
    // Check if record exists to handle created_at correctly
    const { data: existing } = await supabase
      .from('final_renovation_scope_calibrated')
      .select('created_at')
      .eq('listing_id', listingId.toString())
      .single();

    const upsertData: any = {
      listing_id: listingId.toString(),
      scope_data: revisedScope,
      updated_at: new Date().toISOString()
    };

    // Only set created_at if this is a new record
    if (!existing) {
      upsertData.created_at = new Date().toISOString();
    }

    const { error: insertError } = await supabase
      .from('final_renovation_scope_calibrated')
      .upsert(upsertData, {
        onConflict: 'listing_id'
      });

    if (insertError) {
      logger.error('❌ Failed to save calibrated scope:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'save_failed',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Glue B - Budget Calibration: Revised final scope saved for listing ${listingId}`);

    return NextResponse.json({
      success: true,
      scope_data: revisedScope,
      message: 'Final scope revised and calibrated to budget targets'
    });

  } catch (error: any) {
    logger.error('❌ Glue B - Budget Calibration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'calibration_failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

