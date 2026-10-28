import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Unified Strategy Endpoint (Node 1)
 * 
 * The "Architect" of the renovation.
 * Defines the high-level strategy for 3 Tiers (Estandar, Optimo, Plus)
 * based on the user's Budget, Strategy Mode, and Directives.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();
    const { 
      user_budget, 
      strategy_mode = 'show_range', // 'stick_to_budget' | 'show_range' | 'value_max'
      scope_directives, 
      style_preferences 
    } = body;

    console.log(`🧠 Starting Unified Strategy for listing ${listingId}`, { strategy_mode, user_budget });

    // 1. Fetch Context Data
    // Need: Buyer Report (condition), Smart M2 (sizes), Baseline (ROM), Agent Notes (Listing)
    const { data: textResults } = await supabase
      .from('text_analysis_results')
      .select('phase, results')
      .eq('listing_id', listingId)
      .in('phase', ['buyer_report', 'smart_m2', 'baseline_check']);

    const { data: listing } = await supabase
      .from('listings')
      .select('agent_notes')
      .eq('id', listingId)
      .single();

    const buyerReport = textResults?.find(r => r.phase === 'buyer_report')?.results;
    const smartM2 = textResults?.find(r => r.phase === 'smart_m2')?.results;
    const baseline = textResults?.find(r => r.phase === 'baseline_check')?.results;
    const agentNotes = listing?.agent_notes;

    if (!buyerReport || !smartM2) {
      return NextResponse.json({ success: false, error: 'missing_data', message: 'Missing Buyer Report or Smart M2.' }, { status: 400 });
    }

    // 2. Construct Prompt
    // Define the "Strategy Logic" based on mode
    let strategyInstruction = "";
    if (strategy_mode === 'stick_to_budget') {
      strategyInstruction = `USER CONSTRAINT: Strict Budget of €${user_budget}.
      - Tier 1 (Estándar): "Essential Repairs Only" (well below budget).
      - Tier 2 (Óptimo): "Target Budget" (Hit exactly €${user_budget}).
      - Tier 3 (Plus): "Stretch Goal" (Just slightly above €${user_budget}, ~+15%).`;
    } else if (strategy_mode === 'value_max') {
      strategyInstruction = `USER CONSTRAINT: Maximize Value (Budget €${user_budget} is a floor, not a ceiling).
      - Tier 1: "Smart Investment" (High ROI updates).
      - Tier 2: "Premium Renovation" (The user's budget level).
      - Tier 3: "Luxury Transformation" (Unleash full potential).`;
    } else {
      // show_range (Default)
      strategyInstruction = `USER CONSTRAINT: Show the Range.
      - Tier 1: "Economy" (Half of baseline).
      - Tier 2: "User's Budget" (€${user_budget}).
      - Tier 3: "Full Potential" (Ideal renovation, regardless of cost).`;
    }

    const prompt = `You are a Lead Architect defining renovation strategies.

INPUTS:
1. PROPERTY CONDITION (Buyer Report): ${JSON.stringify(buyerReport.house_diagnostics || {}, null, 2)}
2. ROOM SIZES (Smart M2): ${JSON.stringify(smartM2.rooms || [], null, 2)}
3. PHYSICS BASELINE: ${JSON.stringify(baseline?.baseline_rom || {}, null, 2)}
4. USER DIRECTIVES: "${scope_directives || 'None'}"
5. USER STYLE: "${style_preferences || 'Modern/Neutral'}"
6. BUYER AGENT NOTES: "${agentNotes || 'None'}"

STRATEGY INSTRUCTION:
${strategyInstruction}

TASK:
Define the high-level strategy for 3 Tiers (Estándar, Óptimo, Plus).
For EACH Tier, define:
- "philosophy": The guiding concept (e.g. "Cosmetic Flip", "Owner-Occupier Comfort").
- "budget_target": The rough target price range.
- "actions_by_room": High-level bullet points of what happens in each room (e.g. "Kitchen: Replace cabinet fronts only", "Living: Knock down partition wall").
- "user_alignment": How this tier respects (or challenges) the user's directives.

CRITICAL RULES:
- Respect User Directives: If they said "Open Kitchen", AT LEAST one tier (usually Optimo/Plus) MUST do it.
- Respect Agent Notes: If the agent mentioned specific issues (e.g. "Client hates open kitchens"), prioritizing this context is CRITICAL.
- Smart Upselling: Tier 3 should always show "what they didn't know they wanted" (e.g. adding an en-suite).
- Style Consistency: Apply the "${style_preferences}" style direction appropriately to the budget level (e.g. "IKEA-hack Modern" vs "Custom Joinery Modern").

OUTPUT JSON:
{
  "strategies": {
    "estandar": { "philosophy": "...", "budget_target": "...", "actions_by_room": {...}, "user_alignment": "..." },
    "optimo": { ... },
    "plus": { ... }
  }
}`;

    // 3. Call Gemini 3 Pro
    const result = await callGeminiRest(prompt, {
      model: 'gemini-3-pro-preview',
      temperature: 0.4, // Creative but grounded
      thinkingConfig: { thinkingLevel: 'HIGH' },
      responseMimeType: 'application/json'
    });

    if (!result.success || !result.text) {
      throw new Error(result.error || 'Gemini strategy generation failed');
    }

    const parsed = JSON.parse(result.text);

    // 4. Save Result
    // Store as 'unified_strategy' phase
    await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'unified_strategy',
        results: parsed
      }, { onConflict: 'listing_id,phase' });

    return NextResponse.json({ success: true, data: parsed });

  } catch (error: any) {
    console.error('Unified Strategy Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

