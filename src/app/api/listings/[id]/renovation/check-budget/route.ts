import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Check Budget Endpoint
 * 
 * Provides instant feedback on User Budget vs. Physics Baseline.
 * 
 * Logic:
 * - Low (< 80% of Baseline Low): "Tight budget. Suggest 'Value Max' or 'Show Range'."
 * - Healthy (Within Baseline): "Solid budget. Suggest 'Stick to Budget' or 'Value Max'."
 * - High (> 120% of Baseline High): "Premium budget. Suggest 'Value Max' to see full potential."
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { user_budget } = await request.json();

    if (!user_budget || isNaN(user_budget)) {
      return NextResponse.json({ success: false, error: 'Invalid budget' }, { status: 400 });
    }

    // 1. Fetch Baseline Data
    const { data: textAnalysis } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'baseline_check')
      .single();

    if (!textAnalysis?.results?.baseline_rom) {
      return NextResponse.json({ 
        success: false, 
        error: 'missing_baseline', 
        message: 'Baseline Check not found. Run /renovation/baseline-check first.' 
      }, { status: 400 });
    }

    const baseline = textAnalysis.results.baseline_rom; // { low, high, currency }
    const low = baseline.low;
    const high = baseline.high;

    // 2. Analyze Budget
    let assessment = '';
    let feedback = '';
    let recommended_strategy = '';
    let traffic_light = ''; // 'red', 'yellow', 'green'

    if (user_budget < low * 0.8) {
      // Very Low
      assessment = 'Tight';
      traffic_light = 'red';
      feedback = `€${user_budget.toLocaleString()} is significantly below the typical baseline for this property (starts around €${low.toLocaleString()}). At this level, we'd be looking at a "Smart Flip" (cosmetic only) rather than a full renovation.`;
      recommended_strategy = 'show_range'; // "Show Range" to educate them
    } else if (user_budget < low) {
      // Lowish
      assessment = 'Challenging';
      traffic_light = 'yellow';
      feedback = `€${user_budget.toLocaleString()} is a bit tight (baseline starts at €${low.toLocaleString()}), but workable if we prioritize strictly.`;
      recommended_strategy = 'show_range';
    } else if (user_budget >= low && user_budget <= high * 1.2) {
      // Sweet Spot
      assessment = 'Healthy';
      traffic_light = 'green';
      feedback = `€${user_budget.toLocaleString()} is a solid budget for this property. You should be able to achieve a great result.`;
      recommended_strategy = 'stick_to_budget'; // "Stick to Budget" is safe here
    } else {
      // High
      assessment = 'Premium';
      traffic_light = 'green';
      feedback = `€${user_budget.toLocaleString()} is a strong budget. You have room for premium finishes or structural changes.`;
      recommended_strategy = 'value_max'; // Show them what they can do with the extra cash
    }

    return NextResponse.json({
      success: true,
      data: {
        user_budget,
        baseline_range: { low, high },
        assessment,
        feedback,
        traffic_light,
        recommended_strategy,
        strategies: [
          {
            id: 'stick_to_budget',
            label: 'Stick to My Budget',
            description: 'Optimizes scope to fit your number exactly.'
          },
          {
            id: 'show_range',
            label: 'Show Me The Range',
            description: `Compare your budget vs. the ideal baseline (€${low.toLocaleString()}).`
          },
          {
            id: 'value_max',
            label: 'Maximize Value',
            description: 'Strategic investment options regardless of the cap.'
          }
        ]
      }
    });

  } catch (error: any) {
    console.error('Check Budget Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

