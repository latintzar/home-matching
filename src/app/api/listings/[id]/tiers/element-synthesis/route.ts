import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { TierElementSynthesis, TierRenovationWork } from '@/types/renovation-intelligence';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const ajv = new Ajv({ allErrors: true });

type Tier = 'estandar' | 'optimo' | 'plus';

const responseSchema = {
  type: 'object',
  properties: {
    tier: {
      type: 'string',
      enum: ['estandar', 'optimo', 'plus']
    },
    works: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          element_id: { type: 'string' },
          room_id: { type: 'string' },
          room_name: { type: 'string' },
          family_id: { type: 'string', nullable: true },
          action: {
            type: 'string',
            enum: ['keep', 'remove', 'minor_change', 'upgrade', 'replace', 'premium_upgrade']
          },
          work_description: { type: 'string' },
          technical_details: { type: 'string' },
          rationale: { type: 'string' },
          style_alignment: { type: 'string', nullable: true },
          estimated_effort: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            nullable: true
          },
          requires_permit: { type: 'boolean', nullable: true }
        },
        required: ['element_id', 'room_id', 'room_name', 'action', 'work_description', 'technical_details', 'rationale']
      }
    },
    cohesion_summary: {
      type: 'object',
      properties: {
        material_consistency: { type: 'string' },
        color_harmony: { type: 'string' },
        style_coherence: { type: 'string' },
        progression_consistency: { type: 'string' }
      },
      required: ['material_consistency', 'color_harmony', 'style_coherence', 'progression_consistency']
    },
    total_works: { type: 'number' },
    works_by_room: {
      type: 'object',
      additionalProperties: { type: 'number' }
    },
    works_by_family: {
      type: 'object',
      additionalProperties: { type: 'number' }
    }
  },
  required: ['tier', 'works', 'cohesion_summary', 'total_works', 'works_by_room', 'works_by_family']
};

const validateResponse = ajv.compile(responseSchema);

/**
 * Tier Element Synthesis (Phase 2: Consolidated T3+T4+T5+T5.5+T6.5)
 * 
 * Generates a canonical, additive list of renovation works per tier.
 * Consolidates the logic of:
 * - T3: Apply to Groups (family-level directives)
 * - T4: Decide Elements (element-level decisions)
 * - T5: Cohesion (consistency checks)
 * - T5.5: Apply Cohesion Corrections (fixes)
 * - T6.5: Iterate Element Decisions (budget calibration updates)
 * 
 * Output is directly consumable by R2b and UI.
 * 
 * Endpoint: POST /api/listings/[id]/tiers/element-synthesis
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'TierElementSynthesis';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { tier }: { tier?: Tier } = body;

    const tiersToProcess: Tier[] = tier 
      ? [tier] 
      : ['estandar', 'optimo', 'plus'];

    logger.log(`🎯 Tier Element Synthesis: Generating consolidated renovation works for listing ${listingId}, tiers: ${tiersToProcess.join(', ')}`);

    // Fetch required inputs
    logger.log(`📥 Fetching inputs...`);

    // 1. Tier philosophies
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

    // 2. Style direction
    const { data: styleDirectionData } = await supabase
      .from('style_direction')
      .select('direction_data')
      .eq('listing_id', listingId.toString())
      .single();

    const styleDirections = styleDirectionData?.direction_data?.tiers || null;

    // 3. Room families
    const { data: families } = await supabase
      .from('room_families')
      .select('*')
      .eq('listing_id', listingId.toString());

    if (!families || families.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Room families not found. Run rooms/group-catalog first.' },
        { status: 404 }
      );
    }

    // 4. Element mappings
    const { data: mappings } = await supabase
      .from('e2_element_mapping')
      .select('*')
      .eq('listing_id', listingId.toString());

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Element mappings not found. Ensure RoomByRoom has run.' },
        { status: 404 }
      );
    }

    // 5. Allocentric layouts (Phase 1 - REQUIRED)
    const { data: roomAnalysis } = await supabase
      .from('room_analyses')
      .select('layout_allocentric, whole_home_summary')
      .eq('listing_id', parseInt(listingId, 10))
      .single();

    const allocentricLayouts = roomAnalysis?.layout_allocentric || null;
    const wholeHomeSummary = roomAnalysis?.whole_home_summary || null;
    
    if (!allocentricLayouts || allocentricLayouts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Allocentric layouts not found. RoomByRoom must run before TierElementSynthesis.' },
        { status: 404 }
      );
    }

    // 6. Budget calibration (optional - for T6.5 logic)
    const { data: calibratedScope } = await supabase
      .from('final_renovation_scope_calibrated')
      .select('scope_data')
      .eq('listing_id', listingId.toString())
      .single();

    // Process each tier
    const allSyntheses: TierElementSynthesis[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let detectedModel = 'gemini-2.5-pro';

    for (const currentTier of tiersToProcess) {
      logger.log(`\n🏗️  Processing tier: ${currentTier.toUpperCase()}`);

      // Check if already exists
      const { data: existing } = await supabase
        .from('tier_element_synthesis')
        .select('tier')
        .eq('listing_id', listingId.toString())
        .eq('tier', currentTier)
        .limit(1);

      if (existing && existing.length > 0) {
        const { data: cached } = await supabase
          .from('tier_element_synthesis')
          .select('*')
          .eq('listing_id', listingId.toString())
          .eq('tier', currentTier)
          .single();

        if (cached?.synthesis_data) {
          allSyntheses.push(cached.synthesis_data as TierElementSynthesis);
          logger.log(`✅ Synthesis already exists for tier ${currentTier} (${cached.synthesis_data.works?.length || 0} works)`);
          continue;
        }
      }

      const tierPhilosophy = philosophiesData.philosophies[currentTier];
      const tierStyleDirection = styleDirections?.[currentTier] || null;

      // Fetch lower tier synthesis for progression
      let lowerTierSynthesis: TierElementSynthesis | null = null;
      if (currentTier === 'optimo') {
        const { data: estandar } = await supabase
          .from('tier_element_synthesis')
          .select('synthesis_data')
          .eq('listing_id', listingId.toString())
          .eq('tier', 'estandar')
          .single();
        if (estandar?.synthesis_data) {
          lowerTierSynthesis = estandar.synthesis_data as unknown as TierElementSynthesis;
        }
      } else if (currentTier === 'plus') {
        const { data: optimo } = await supabase
          .from('tier_element_synthesis')
          .select('synthesis_data')
          .eq('listing_id', listingId.toString())
          .eq('tier', 'optimo')
          .single();
        if (optimo?.synthesis_data) {
          lowerTierSynthesis = optimo.synthesis_data as unknown as TierElementSynthesis;
        }
      }

      // Build comprehensive prompt
      const prompt = `You are generating a canonical, additive list of renovation works for the "${currentTier.toUpperCase()}" tier.

This consolidates:
- Family-level directives (what changes per room family)
- Element-level decisions (specific actions per element)
- Cohesion checks (material/color/style consistency)
- Progression enforcement (additive across tiers)

TIER PHILOSOPHY:
- Intent: ${tierPhilosophy.intent}
- Quality Band: ${tierPhilosophy.quality_band}
- Constraints: ${tierPhilosophy.constraints.join(', ')}

${tierStyleDirection ? `TIER-SPECIFIC STYLE DIRECTION:
- Style Summary: ${tierStyleDirection.style_summary}
- Color Palette: ${tierStyleDirection.color_palette?.join(', ') || 'N/A'}
- Material Guidance: ${tierStyleDirection.material_guidance?.join(', ') || 'N/A'}
- Design Philosophy: ${tierStyleDirection.design_philosophy}
- Key Style Elements: ${tierStyleDirection.key_style_elements?.join(', ') || 'N/A'}` : ''}

ROOM FAMILIES:
${JSON.stringify(families, null, 2)}

ELEMENT MAPPINGS:
${JSON.stringify(mappings.slice(0, 50), null, 2)}${mappings.length > 50 ? `\n... (${mappings.length - 50} more elements)` : ''}

${allocentricLayouts ? `ALLOCENTRIC ROOM LAYOUTS (Phase 1 - use for spatial context):
${JSON.stringify(allocentricLayouts.slice(0, 10), null, 2)}${allocentricLayouts.length > 10 ? `\n... (${allocentricLayouts.length - 10} more rooms)` : ''}` : ''}

${wholeHomeSummary ? `WHOLE-HOME SUMMARY (Phase 1 - spatial organization):
${JSON.stringify(wholeHomeSummary, null, 2)}` : ''}


${lowerTierSynthesis ? `LOWER TIER SYNTHESIS (${currentTier === 'optimo' ? 'Estándar' : 'Óptimo'} - for progression):
${JSON.stringify({
  total_works: lowerTierSynthesis.total_works,
  works_by_room: lowerTierSynthesis.works_by_room,
  works_by_family: lowerTierSynthesis.works_by_family,
  sample_works: lowerTierSynthesis.works.slice(0, 10)
}, null, 2)}` : ''}

CRITICAL REQUIREMENTS:

1. **ADDITIVE PROGRESSION**:
   ${lowerTierSynthesis ? `
   - ${currentTier === 'optimo' ? 'Óptimo' : 'Plus'} MUST include ALL works from ${currentTier === 'optimo' ? 'Estándar' : 'Óptimo'}
   - You can ADD more works, but NEVER remove lower-tier works
   - If lower tier says "replace", this tier must also replace or upgrade
   - Review lower tier works and ensure they're all included` : `
   - Estándar is the base tier - include all necessary works for functional refresh`}

2. **COHESION**:
   - Material consistency: Similar materials across rooms in same family
   - Color harmony: Cohesive color palette across the tier
   - Style coherence: All works align with tier style direction
   - Progression consistency: Clear upgrade path from lower tier

3. **WORK DESCRIPTIONS**:
   - work_description: Buyer-friendly, clear description ("Replace ceramic floor tiles with porcelain")
   - technical_details: Technical spec for contractors ("Porcelain tiles, 60x60cm, matte finish, warm gray")
   - rationale: Why this work is needed
   - style_alignment: How this aligns with tier style (if style direction exists)

4. **ELEMENT ACTIONS**:
   - keep: No change needed
   - remove: Remove element
   - minor_change: Small update (paint, hardware)
   - upgrade: Improve existing element
   - replace: Replace with equivalent quality
   - premium_upgrade: Replace with premium quality

5. **EFFORT & PERMITS**:
   - estimated_effort: low/medium/high based on work complexity
   - requires_permit: true if structural/plumbing/electrical changes

OUTPUT:
Generate a comprehensive list of ALL renovation works for this tier, ensuring:
- Additive progression (includes all lower-tier works)
- Cohesion (material/color/style consistency)
- Completeness (all elements that need work are included)
- Clarity (buyer-friendly descriptions, technical details)

Return ONLY valid JSON matching the schema.`;

      logger.log(`🤖 Calling Gemini for tier ${currentTier}...`);

      const result = await callGeminiRest(prompt, {
        model: 'gemini-2.5-pro',
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        thinkingConfig: { thinkingBudget: 32768 },
        maxOutputTokens: 32768,
        responseMimeType: 'application/json',
        responseSchema
      });

      if (!result.success || !result.text) {
        logger.error(`❌ Gemini API error for tier ${currentTier}:`, result.error);
        throw new Error(`Failed to generate synthesis for tier ${currentTier}: ${result.error || 'No response text'}`);
      }

      // Parse response
      let synthesis: TierElementSynthesis;
      try {
        let cleaned = result.text.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .replace(/,(\s*[}\]])/g, '$1');
        
        synthesis = JSON.parse(cleaned);
        
        // Validate
        if (!validateResponse(synthesis)) {
          logger.error(`❌ Validation errors:`, validateResponse.errors);
          throw new Error(`Invalid response structure: ${JSON.stringify(validateResponse.errors)}`);
        }

        // Ensure tier matches
        synthesis.tier = currentTier;

        // Calculate summary stats if missing
        if (!synthesis.total_works) {
          synthesis.total_works = synthesis.works.length;
        }
        if (!synthesis.works_by_room) {
          synthesis.works_by_room = {};
          synthesis.works.forEach(w => {
            synthesis.works_by_room[w.room_id] = (synthesis.works_by_room[w.room_id] || 0) + 1;
          });
        }
        if (!synthesis.works_by_family) {
          synthesis.works_by_family = {};
          synthesis.works.forEach(w => {
            if (w.family_id) {
              synthesis.works_by_family[w.family_id] = (synthesis.works_by_family[w.family_id] || 0) + 1;
            }
          });
        }

        logger.log(`✅ Generated synthesis for tier ${currentTier} (synthesis.tier=${synthesis.tier}): ${synthesis.total_works} works`);

      } catch (parseError) {
        logger.error(`❌ Parse error for tier ${currentTier}:`, parseError);
        throw new Error(`Failed to parse synthesis for tier ${currentTier}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Save to database
      logger.log(`💾 Saving synthesis for tier ${currentTier} (synthesis.tier=${synthesis.tier}) to database...`);
      const { error: saveError } = await supabase
        .from('tier_element_synthesis')
        .upsert({
          listing_id: listingId.toString(),
          tier: currentTier,
          synthesis_data: synthesis,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'listing_id,tier'
        });

      if (saveError) {
        logger.error(`❌ Database save error for tier ${currentTier}:`, saveError);
        throw new Error(`Failed to save synthesis for tier ${currentTier}: ${saveError.message || JSON.stringify(saveError)}`);
      }
      
      logger.log(`✅ Saved synthesis for tier ${currentTier} (saved as ${synthesis.tier}) to database`);

      // Accumulate token usage
      if (result.usage) {
        totalInputTokens += result.usage.promptTokenCount || 0;
        totalOutputTokens += result.usage.candidatesTokenCount || 0;
        if (result.model) detectedModel = result.model;
      }

      allSyntheses.push(synthesis);
    }

    logger.log(`✅ Tier Element Synthesis completed: ${allSyntheses.length} tier(s) processed`);

    return NextResponse.json({
      success: true,
      message: `Tier element synthesis completed for ${allSyntheses.length} tier(s)`,
      data: allSyntheses,
      usage: {
        promptTokenCount: totalInputTokens,
        candidatesTokenCount: totalOutputTokens,
        totalTokenCount: totalInputTokens + totalOutputTokens
      },
      model: detectedModel
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('❌ Tier element synthesis error:', errorMessage);
    if (errorStack) {
      logger.error('Error stack:', errorStack);
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage || 'Tier element synthesis failed',
      details: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined
    }, { status: 500 });
  }
}

