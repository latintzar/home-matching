import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { NextStepsReport } from '@/types/renovation-intelligence';
import { DiagnosticAnalysisReport } from '@/types/diagnostic-analysis';
import { FinalRenovationScope } from '@/types/renovation-intelligence';
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
 * POST /api/listings/[id]/recommendations/next-steps
 * 
 * Consumes: Integrated Diagnostic + FinalRenovationScope
 * Produces: Buyer advisory Próximos Pasos
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`📋 Generating Next Steps (Próximos Pasos) for listing ${listingId}`);

    // Fetch Listing Diagnostic
    const { data: diagnosticData, error: diagnosticError } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'listing_diagnostic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (diagnosticError || !diagnosticData) {
      return NextResponse.json(
        { success: false, error: 'No diagnostic analysis found. Run /analysis/listing-diagnostic first.' },
        { status: 404 }
      );
    }

    const diagnostic: DiagnosticAnalysisReport = diagnosticData.results as unknown as DiagnosticAnalysisReport;

    // Fetch FinalRenovationScope
    const { data: scopeData, error: scopeError } = await supabase
      .from('final_renovation_scope')
      .select('scope_data')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (scopeError || !scopeData) {
      return NextResponse.json(
        { success: false, error: 'No final renovation scope found. Run /renovation-scope-finalize first.' },
        { status: 404 }
      );
    }

    const finalScope: FinalRenovationScope = scopeData.scope_data;

    const prompt = `SYSTEM:
You are an experienced property advisor summarizing the realistic path forward for a potential home buyer.
Inputs:
- Diagnostic report (key verifications, visible strengths, effort implications)
- Final renovation scope (tiers, costs, timelines, permits)

Task:
Write a practical, credible “Next Steps” brief that makes the home feel possible — not perfect.
Summarize the process in clear, buyer-oriented language.

LISTING DIAGNOSTIC:
${JSON.stringify(diagnostic, null, 2)}

FINALIZED RENOVATION SCOPE:
${JSON.stringify(finalScope, null, 2)}

OUTPUT STRUCTURE:
{
  "listing_id": "${listingId}",
  "generated_at": "<iso_date>",
  "summary": "2–3 sentences explaining what proceeding would entail.",
  "action_plan": [
    "Step-by-step actions (e.g., confirmar X, revisar plazos de licencia, solicitar presupuestos)",
    "5–9 concise, chronological items that combine verification, logistics, and preparation."
  ],
  "effort_outlook": "1–2 sentences summarizing total effort, cost realism, and coordination level required.",
  "mindset_note": "1–2 sentences describing what kind of buyer this suits or what attitude helps."
}

RULES:
- Tone: supportive realism — credible, calm, enabling.
- Be specific, not abstract; avoid “should consider” vagueness.
- Each action must map to something seen or derived from diagnostics.
- Avoid sales language.
- Write in Spanish suitable for agency display.

Return ONLY valid JSON.`;

    // Response schema for structured output
    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        generated_at: { type: 'string' },
        summary: { type: 'string' },
        action_plan: {
          type: 'array',
          items: { type: 'string' },
          minItems: 5,
          maxItems: 9
        },
        effort_outlook: { type: 'string' },
        mindset_note: { type: 'string' }
      },
      required: ['listing_id','generated_at','summary','action_plan','effort_outlook','mindset_note']
    } as const;

    console.log('🤖 Calling Gemini REST API for Next Steps generation...');

    const response = await callGeminiRest(prompt, {
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!response.success || !response.text) {
      return NextResponse.json(
        { success: false, error: 'AI call failed', details: response.error },
        { status: 500 }
      );
    }

    let nextSteps: any;
    try {
      const cleaned = response.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      nextSteps = JSON.parse(cleaned);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response', details: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    }

    // Ensure listing_id and generated_at
    nextSteps.listing_id = listingId;
    if (!nextSteps.generated_at) nextSteps.generated_at = new Date().toISOString();

    // Save to next_steps_reports table
    const { error: saveError } = await supabase
      .from('next_steps_reports')
      .upsert({
        listing_id: String(listingId),
        report_data: nextSteps,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'listing_id' });

    if (saveError) {
      console.warn('⚠️ Failed to save next steps report:', saveError.message);
      // Still return the data even if save fails
    }

    console.log(`✅ Next Steps generated and saved`);

    return NextResponse.json({
      success: true,
      message: 'Next Steps (Próximos Pasos) generated successfully',
      data: nextSteps
    });

  } catch (error) {
    console.error('Next Steps generation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/listings/[id]/recommendations/next-steps
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const { data, error } = await supabase
      .from('next_steps_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'No Next Steps report found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.report_data
    });

  } catch (error) {
    console.error('Get Next Steps error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

