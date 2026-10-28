/**
 * Renovation Scope Finalize Endpoint (N)
 * 
 * Merges seed scope + pricing + timeline + permits into final UI-ready tiers.
 * Per RENOVATION_TIERS_V2_PIPELINE.md spec.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { FinalRenovationScope, RenovationScopeReport } from '@/types/renovation-intelligence';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { validateFinalRenovationScope, finalRenovationScopeSchema } from '@/lib/schemas/renovation-schemas';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * Round to nearest €1,000 for tier totals
 */
function roundToNearest1000(value: number): number {
  return Math.round(value / 1000) * 1000;
}

/**
 * Format duration display: "~X months" if >8 weeks, else "X weeks"
 */
function formatDurationDisplay(durationWeeks: number): string {
  if (durationWeeks > 8) {
    const months = Math.round(durationWeeks / 4);
    return `~${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  return `${durationWeeks} ${durationWeeks === 1 ? 'semana' : 'semanas'}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'N';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params;

  try {
    logger.log(`🧱 Finalizing renovation scope for listing ${listingId}`);

    // Fetch seed scope
    const { data: scopeData, error: scopeError } = await supabase
      .from('renovation_scope_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (scopeError || !scopeData) {
      return NextResponse.json(
        { success: false, error: 'No seed scope found. Run renovation-scope first.' },
        { status: 404 }
      );
    }

    const scopeReport: RenovationScopeReport = scopeData.report_data;

    // Fetch pricing, timeline, permits
    const [{ data: pricing }, { data: timeline }, { data: permits }] = await Promise.all([
      supabase.from('renovation_pricing_reports').select('report_data').eq('listing_id', listingId).single(),
      supabase.from('renovation_timeline_reports').select('report_data').eq('listing_id', listingId).single(),
      supabase.from('renovation_permits_reports').select('report_data').eq('listing_id', listingId).single()
    ]);

    if (!pricing || !timeline || !permits) {
      return NextResponse.json(
        { success: false, error: 'Missing refined results. Ensure pricing, timeline, and permits are generated.' },
        { status: 400 }
      );
    }

    const pricingData = pricing.report_data;
    const timelineData = timeline.report_data;
    const permitsData = permits.report_data;

    logger.log(`📊 Merging seed + pricing + timeline + permits for ${listingId}`);

    // Build structured prompt per spec
    // Note: timelineData now has structure: { tiers: { estandar: {...}, optimo: {...}, plus: {...} } }
    const inputs = {
      listing_id: listingId,
      seed_scope: scopeReport,
      pricing: pricingData,
      timeline: timelineData,
      permits: permitsData
    };

    const prompt = `SYSTEM:
You merge precision passes into a single, UI-ready plan per tier.

INPUTS:
- seed (plain work items with photo links, names, subtitles, tier assignments)
- pricing (per-item cost ranges: cost_low_eur, cost_high_eur, already rounded to €100)
- timeline (structure: { tiers: { estandar: {phases, item_placement}, optimo: {phases, item_placement}, plus: {phases, item_placement} } } - each tier has its own phases and item_placement)
- permits (structure: { tiers: { estandar: {permits}, optimo: {permits}, plus: {permits} } } - each tier has its own permits array)

IMPORTANT: Both timeline and permits now have separate data per tier. For each tier, use the corresponding data:
- For "estandar" tier: 
  - Use timeline.tiers.estandar.phases and timeline.tiers.estandar.item_placement
  - Use permits.tiers.estandar.permits (array of permit records for this tier)
- For "optimo" tier: 
  - Use timeline.tiers.optimo.phases and timeline.tiers.optimo.item_placement
  - Use permits.tiers.optimo.permits (array of permit records for this tier)
- For "plus" tier: 
  - Use timeline.tiers.plus.phases and timeline.tiers.plus.item_placement
  - Use permits.tiers.plus.permits (array of permit records for this tier)

TASKS:
1) Merge by id; preserve seed tier assignment for all items.
2) For each tier, include only its items from seed.
3) Compute tier totals by summing item cost ranges; round totals to nearest €1,000.
4) Build timeline with start_offset_weeks as cumulative sums (first phase = 0, each subsequent = sum of previous durations).
   - Create display_duration: "~X meses" if duration_weeks > 8 (round to nearest month), else "X semanas"
   - Use phase names/subtitles from timeline
5) Use permits from permits.tiers.[tier].permits for this tier. Each permit already has applies_to_work_ids filtered to this tier's items. Keep permit text once per tier.
6) Keep names/subtitles exactly from seed; preserve buyer-facing tone ("renovation plan you can picture", maintain referential, concise, tactile style anchored in visual reality). Preserve the original wording and style.
7) Set validation flags:
   - pricing_ids_covered: true if all seed items have pricing
   - timeline_items_mapped: true if 100% items mapped to phases
   - permit_ids_mapped: true if all permit applies_to_work_ids reference valid item IDs
   - sums_check_passed: true if tier totals match sum of item ranges (within rounding)

OUTPUT:
Valid JSON matching FinalRenovationScope structure:
{
  "listing_id": "${listingId}",
  "generated_at": "<ISO 8601 date>",
  "tiers": {
    "estandar": {
      "title": "Estándar",
      "tier_subtitle": "<one-liner about intent>",
      "work_items": [
        {
          "id": "<from seed>",
          "tier": "estandar",
          "name": "<from seed, exact>",
          "subtitle": "<from seed, exact>",
          "room_ref": "<from seed>",
          "photo_refs": ["<from seed>"],
          "cost_low_eur": <from pricing>,
          "cost_high_eur": <from pricing>,
          "stage": "<phase name from timeline>"
        }
      ],
      "total_estimate_range_eur": [<rounded to €1,000>, <rounded to €1,000>],
      "timeline": {
        "phases": [
          {
            "name": "<from timeline>",
            "subtitle": "<from timeline>",
            "start_offset_weeks": <cumulative>,
            "duration_weeks": <from timeline>,
            "display_duration": "<X semanas> or <~X meses>"
          }
        ],
        "total_duration_display": "<X-Y semanas> or <X-Y meses>"
      },
      "permits": [
        {
          "permit_type": "<from permits>",
          "why_needed": "<from permits>",
          "what_needed": ["<from permits>"],
          "issuing_authority": "<from permits>",
          "expected_time_weeks": <from permits>,
          "applies_to_work_ids": ["<filtered to this tier>"]
        }
      ]
    },
    "optimo": { ... },
    "plus": { ... }
            },
  "validation": {
    "pricing_ids_covered": <boolean>,
    "timeline_items_mapped": <boolean>,
    "permit_ids_mapped": <boolean>,
    "sums_check_passed": <boolean>
          }
        }

CRITICAL RULES:
- Tier totals must be multiples of €1,000 (round to nearest)
- start_offset_weeks must be cumulative (phase 1 = 0, phase 2 = phase1.duration, etc.)
- display_duration: "~X meses" if >8 weeks (round to nearest), else "X semanas"
- Permits filtered per tier by applies_to_work_ids intersection
- All names/subtitles preserved exactly from seed (preserve original wording and style)
- Maintain buyer-facing tone: "renovation plan you can picture", use referential, tactile language
- Preserve referential, concise, tactile style anchored in visual reality
- Keep Spanish, agency-display neutral style from seed

INPUT DATA:
${JSON.stringify(inputs, null, 2)}`;

    // Call Gemini with structured output
    let finalScope: FinalRenovationScope | null = null;
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      logger.log(`🔄 Attempt ${attempt}/3: Calling Gemini to finalize scope...`);

      const resp = await callGeminiRest(prompt, {
        model: 'gemini-2.5-pro',
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        thinkingConfig: { thinkingBudget: 32768 }, // Maxed out thinking budget
        maxOutputTokens: 65535, // Maximum for Gemini 2.5 Pro to handle full final scope JSON with all tiers
        responseMimeType: 'application/json'
      });

      if (!resp.success || !resp.text) {
        lastErr = resp.error || 'ai_call_failed';
        logger.error(`❌ Gemini call failed (attempt ${attempt}):`, lastErr);
        continue;
      }

      try {
        const cleaned = resp.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);

        // Normalize: convert null/undefined subtitles to empty strings
        for (const tierKey of ['estandar', 'optimo', 'plus']) {
          if (parsed?.tiers?.[tierKey]?.work_items) {
            for (const item of parsed.tiers[tierKey].work_items) {
              if (item.subtitle === null || item.subtitle === undefined) {
                item.subtitle = '';
              }
            }
          }
        }

        // Basic validation
        if (
          parsed?.listing_id &&
          parsed?.generated_at &&
          parsed?.tiers?.estandar &&
          parsed?.tiers?.optimo &&
          parsed?.tiers?.plus
        ) {
          // AJV validation with strict schema
          const valid = validateFinalRenovationScope(parsed);
          if (!valid) {
            lastErr = `Schema validation failed: ${JSON.stringify(validateFinalRenovationScope.errors)}`;
            logger.error(`❌ Schema validation failed (attempt ${attempt}):`, validateFinalRenovationScope.errors);
            continue;
          }

          finalScope = parsed as unknown as FinalRenovationScope;
          logger.log(`✅ Successfully finalized scope (attempt ${attempt})`);
          break;
        } else {
          lastErr = 'Missing required fields in response';
          logger.error(`❌ Invalid response structure (attempt ${attempt})`);
        }
      } catch (e) {
        lastErr = e;
        logger.error(`❌ JSON parse error (attempt ${attempt}):`, e);
      }
    }

    if (!finalScope) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate final scope',
          details: lastErr instanceof Error ? lastErr.message : String(lastErr)
        },
        { status: 500 }
      );
    }

    // Store in database
    const { error: saveError } = await supabase
      .from('final_renovation_scope')
      .upsert({
        listing_id: String(listingId),
        scope_data: finalScope,
        updated_at: new Date().toISOString()
      }, { onConflict: 'listing_id' });

    if (saveError) {
      logger.error('❌ Failed to save final scope:', saveError);
      return NextResponse.json(
        { success: false, error: 'Failed to save final scope', details: saveError.message },
        { status: 500 }
      );
    }

    logger.log(`✅ Final scope saved successfully for listing ${listingId}`);

    return NextResponse.json({
      success: true,
      data: finalScope
    });

  } catch (error) {
    logger.error('❌ Scope finalize error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
