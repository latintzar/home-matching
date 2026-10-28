import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

// Define the schema for a single tier to avoid repetition
const tierSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    total_price_estimated: { type: 'NUMBER' },
    duration_weeks: { type: 'NUMBER' },
    permit_level: { type: 'STRING' },
    rooms: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          room_name: { type: 'STRING' },
          m2: { type: 'NUMBER' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                action: { type: 'STRING' },
                spec: { type: 'STRING' },
                cost_est: { type: 'NUMBER' }
              },
              required: ['action', 'spec', 'cost_est']
            }
          }
        },
        required: ['room_name', 'm2', 'items']
      }
    }
  },
  required: ['summary', 'total_price_estimated', 'duration_weeks', 'permit_level', 'rooms']
};

/**
 * Unified Scope Endpoint (Node 3)
 * 
 * The "Contractor".
 * Takes the "Architect's Strategy" (Node 1) and turns it into a detailed line-item quote.
 * Consolidates Scope, Pricing, Timeline, and Permits into one mega-generation.
 * 
 * Inputs:
 * - Unified Strategy (Tier Definitions)
 * - J-Reno Results (Search Data - Pricing/Permits)
 * - Smart M2 (Dimensions)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    console.log(`👷 Starting Unified Scope Generation for listing ${listingId}`);

    // 0. Check Cache (Idempotency)
    if (!forceRefresh) {
        const { data: cachedScope } = await supabase
            .from('final_renovation_scope')
            .select('scope_data')
            .eq('listing_id', parseInt(listingId))
            .single();

        if (cachedScope) {
            console.log(`✅ Found cached scope for listing ${listingId}. Skipping generation.`);
            return NextResponse.json({ 
                success: true, 
                message: 'Unified Scope retrieved from cache',
                cached: true,
                data: cachedScope.scope_data 
            });
        }
    }

    if (forceRefresh) {
        console.log(`🔄 Force refresh requested - regenerating scope...`);
    }

    // 1. Fetch Context
    const { data: textResults } = await supabase
      .from('text_analysis_results')
      .select('phase, results')
      .eq('listing_id', listingId)
      .in('phase', ['unified_strategy', 'smart_m2']);

    // Fetch J-Reno results (using renovation_research_results table)
    const { data: researchResults } = await supabase
      .from('renovation_research_results')
      .select('*')
      .eq('listing_id', parseInt(listingId));

    const strategy = textResults?.find(r => r.phase === 'unified_strategy')?.results;
    const smartM2 = textResults?.find(r => r.phase === 'smart_m2')?.results;

    if (!strategy) {
      return NextResponse.json({ success: false, error: 'missing_strategy', message: 'Run unified-strategy first.' }, { status: 400 });
    }

    // 2. Construct Prompt
    const prompt = `You are a Master General Contractor creating a detailed renovation quote.

INPUTS:
1. STRATEGY (The Architect's Plan): ${JSON.stringify(strategy.strategies || {}, null, 2)}
2. DIMENSIONS (Room Sizes): ${JSON.stringify(smartM2?.rooms || [], null, 2)}
3. MARKET DATA (J-Reno Research): ${JSON.stringify(researchResults || [], null, 2)}

TASK:
Generate the "Final Renovation Scope" for all 3 Tiers (Estándar, Óptimo, Plus).
For EACH Tier, you must generate:
1. "scope": Detailed line items per room (Action + Material + Spec).
2. "pricing": Precise cost estimation (Material + Labor + Margin).
3. "timeline": Realistic duration in weeks (Gantt logic).
4. "permits": Required legal paperwork based on the scope intensity.

PRICING RULES:
- Use the J-Reno data where available.
- If J-Reno data is missing, use your internal knowledge of Spanish market rates (2025).
- Estándar = Economy/Standard materials.
- Óptimo = Mid-range/Quality materials.
- Plus = Premium/Luxury materials.
- Add 15% Contractor Margin/Contingency to the final sum.

TIMELINE RULES:
- Be realistic. Bathroom = 2-3 weeks. Kitchen = 3-4 weeks.
- Factor in drying times and overlapping trades.

OUTPUT JSON SCHEMA:
{
  "tiers": {
    "estandar": {
      "summary": "...",
      "total_price_estimated": 15000,
      "duration_weeks": 4,
      "permit_level": "Obra Menor / Comunicada",
      "rooms": [
        {
          "room_name": "Kitchen",
          "m2": 12,
          "items": [
            { "action": "Paint walls", "spec": "Plastic paint matte white", "cost_est": 300 }
          ]
        }
      ]
    },
    "optimo": { ... },
    "plus": { ... }
  }
}`;

    // 3. Call Gemini 3 Pro
    const result = await callGeminiRest(prompt, {
      model: 'gemini-3-pro-preview',
      temperature: 0.2, // Precise
      thinkingConfig: { thinkingLevel: 'HIGH' },
      maxOutputTokens: 16000,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          tiers: {
            type: 'OBJECT',
            properties: {
              estandar: tierSchema,
              optimo: tierSchema,
              plus: tierSchema
            },
            required: ['estandar', 'optimo', 'plus']
          }
        },
        required: ['tiers']
      }
    });

    if (!result.success || !result.text) {
      throw new Error(result.error || 'Gemini scope generation failed');
    }

    const parsed = JSON.parse(result.text);

    // 4. Save Result
    // This is the "Final Scope" used by the UI
    await supabase
      .from('final_renovation_scope')
      .upsert({
        listing_id: parseInt(listingId),
        scope_data: parsed
      }, { onConflict: 'listing_id' });

    // Also save as text_analysis_results phase for consistency
    await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'unified_scope',
        results: parsed
      }, { onConflict: 'listing_id,phase' });

    return NextResponse.json({ success: true, data: parsed });

  } catch (error: any) {
    console.error('Unified Scope Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
