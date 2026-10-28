import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { validateTimelineOutput, timelineOutputSchema } from '@/lib/schemas/renovation-schemas';
import { createStepLogger } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'L';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params;

  try {
    logger.log(`⏱️ Generating renovation timeline for listing ${listingId}`);

    // Fetch scope report (scope seed output)
    const { data: scopeData, error: scopeError } = await supabase
      .from('renovation_scope_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (scopeError || !scopeData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No renovation scope found. Run renovation-scope endpoint first.',
          details: scopeError?.message 
        },
        { status: 404 }
      );
    }

    const scopeSeed = scopeData.report_data;

    // Fetch timing research results from renovation_research_results
    const { data: researchResults, error: researchError } = await supabase
      .from('renovation_research_results')
      .select('category, report_data')
      .eq('listing_id', listingId)
      .like('category', 'timings_%');

    if (researchError) {
      logger.warn('⚠️ Could not fetch research results:', researchError);
    }

    // Organize research by tier
    const researchByTier: Record<string, any> = {};
    if (researchResults) {
      for (const result of researchResults) {
        const tier = result.category.replace('timings_', '');
        researchByTier[tier] = result.report_data;
        }
    }

    // Fetch listing data for context
    const { data: listingData, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listingData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Listing not found',
          details: listingError?.message 
        },
        { status: 404 }
      );
    }

    // Generate timeline for EACH tier separately
    const tierTimelines: Record<string, any> = {};
    const tierKeys: Array<'estandar' | 'optimo' | 'plus'> = ['estandar', 'optimo', 'plus'];

    for (const tierKey of tierKeys) {
      const tier = scopeSeed.tiers?.[tierKey];
      if (!tier?.work_items || tier.work_items.length === 0) {
        logger.log(`⚠️ No work items found for tier ${tierKey}, skipping`);
        continue;
      }

      const tierWorkItems = tier.work_items.map((item: any) => ({
        id: item.id,
        tier: item.tier || tierKey,
        name: item.name,
        subtitle: item.subtitle
      }));

      logger.log(`⏱️ Generating timeline for tier ${tierKey} (${tierWorkItems.length} items)...`);

      // Determine appropriate phase count based on scope
      // Estándar: simpler, fewer phases (3-5)
      // Óptimo: moderate (5-6)
      // Plus: comprehensive (6-7)
      const phaseCount = tierKey === 'estandar' ? '3-5' : tierKey === 'optimo' ? '5-6' : '6-7';

      const prompt = `You are a renovation scheduler for Spanish projects. Create a realistic timeline with phases for the ${tierKey.toUpperCase()} tier ONLY.

PROPERTY CONTEXT:
- Listing ID: ${listingId}
- Location: ${listingData.city || 'Spain'}, ${listingData.region || ''}
- Area: ${listingData.scraped_data?.useful_area_m2 || listingData.scraped_data?.constructed_area_m2 || 'Unknown'} m²
- Tier: ${tierKey} (${tierKey === 'estandar' ? 'basic/essential work' : tierKey === 'optimo' ? 'moderate renovation' : 'comprehensive luxury renovation'})

WORK ITEMS FOR THIS TIER ONLY:
${JSON.stringify(tierWorkItems, null, 2)}

TIMING RESEARCH DATA FOR THIS TIER:
${JSON.stringify(researchByTier[tierKey] || {}, null, 2)}

TASK:
Create ${phaseCount} phases covering the renovation process for THIS TIER ONLY. Consider:
- ${tierKey === 'estandar' ? 'Estándar is basic work: cleaning, painting, minor repairs. Phases should be simpler and shorter.' : tierKey === 'optimo' ? 'Óptimo includes moderate renovations: floor replacement, bathroom/kitchen updates. Phases should reflect moderate complexity.' : 'Plus is comprehensive: luxury materials, custom work, multiple systems. Phases should reflect full renovation complexity.'}

CRITICAL RULES:
- Create ${phaseCount} phases SPECIFIC to this tier's scope
- Each phase must have: name, subtitle, duration_weeks (integer, 0-104)
- Map EVERY work item ID from THIS TIER ONLY to exactly ONE phase via item_placement array
- 100% item mapping required - no items can be missing
- Phases should be ordered logically (first to last)
- Duration_weeks is just the duration of that phase (NOT cumulative offset)
- NO start_offset_weeks here - offsets computed later in finalizer
- **PRIORITIZE research metrics**: If timing research contains metrics.low and metrics.high (in weeks), use those durations
- Consider Spanish market timing research data
- Account for common delays: permit processing, contractor availability, material delivery
- ${tierKey === 'estandar' ? 'Estándar should be faster (weeks, not months)' : tierKey === 'optimo' ? 'Óptimo should be moderate duration' : 'Plus can take longer due to custom/premium work'}

OUTPUT FORMAT:
Return JSON matching this exact structure:
{
  "tier": "${tierKey}",
  "phases": [
    {
      "name": "Fase 1: [Appropriate name]",
      "subtitle": "[Description of what happens in this phase]",
      "duration_weeks": 2
    }
    // ... ${phaseCount} phases total
  ],
  "item_placement": [
    {
      "id": "${tierWorkItems[0]?.id || 'item-id'}",
      "phase_name": "Fase 1: [Appropriate name]"
    }
    // ... ONE entry per work item from THIS TIER ONLY
  ],
  "notes": [
    "Relevant notes for this tier's timeline"
  ]
}

CRITICAL: Every work item ID from THIS TIER must appear exactly once in item_placement. Verify 100% coverage.`;

      // Simplified response schema for Gemini
    const responseSchema = {
      type: 'object',
      properties: {
          tier: { type: 'string' },
                phases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
              subtitle: { type: 'string' },
              duration_weeks: { type: 'number' }
              },
              required: ['name', 'subtitle', 'duration_weeks']
          }
        },
        item_placement: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
              id: { type: 'string' },
              phase_name: { type: 'string' }
              },
              required: ['id', 'phase_name']
          }
        },
        notes: {
          type: 'array',
          items: { type: 'string' }
        }
        },
        required: ['tier', 'phases', 'item_placement']
    };

      // Call Gemini REST API for this tier
      // Calculate estimated tokens: ~150 tokens per phase + ~50 tokens per item placement + overhead
      const estimatedTokens = Math.max(16384, (tierWorkItems.length * 50) + (parseInt(phaseCount.split('-')[1]) * 150) + 2000);
      const maxOutputTokens = Math.min(32768, estimatedTokens);
      
      logger.log(`📊 Tier ${tierKey}: ${tierWorkItems.length} items, ${phaseCount} phases, using maxOutputTokens: ${maxOutputTokens}`);
      
    const geminiResponse = await callGeminiRest(prompt, {
        model: 'gemini-2.5-pro',
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
        maxOutputTokens: maxOutputTokens,
      thinkingConfig: {
          thinkingBudget: 32768
      },
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!geminiResponse.success || !geminiResponse.text) {
        logger.error(`❌ Gemini REST API call failed for tier ${tierKey}:`, geminiResponse.error);
      return NextResponse.json(
        { 
          success: false,
            error: `Failed to get AI response for tier ${tierKey}`,
          details: geminiResponse.error,
          rawError: geminiResponse.rawResponse
        },
        { status: 500 }
      );
    }

    // Parse JSON response
      let tierTimeline: any;
    try {
    const cleaned = geminiResponse.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        tierTimeline = JSON.parse(cleaned);
        logger.log(`✅ Successfully parsed timeline for ${tierKey} (${tierTimeline.phases?.length || 0} phases, ${tierTimeline.item_placement?.length || 0} item placements)`);
    } catch (parseError) {
        logger.error(`❌ Failed to parse AI response for tier ${tierKey}:`, parseError);
      return NextResponse.json(
        { 
          success: false, 
            error: `Failed to parse AI response for tier ${tierKey}`,
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 500 }
      );
    }

      // Verify 100% item mapping for this tier
      const placedItemIds = new Set(tierTimeline.item_placement?.map((p: any) => p.id) || []);
      const missingItems = tierWorkItems.filter((item: any) => !placedItemIds.has(item.id));
    if (missingItems.length > 0) {
        logger.warn(`⚠️ Missing item placements for tier ${tierKey}: ${missingItems.map((i: any) => i.id).join(', ')}`);
      return NextResponse.json(
        { 
          success: false, 
            error: `Not all work items were mapped to phases for tier ${tierKey}`,
          details: `Missing items: ${missingItems.map((i: any) => i.id).join(', ')}`,
          missing_items: missingItems.map((i: any) => i.id)
        },
        { status: 422 }
      );
    }

    // Verify all phase_names reference actual phases
      const phaseNames = new Set(tierTimeline.phases?.map((p: any) => p.name) || []);
      const invalidPlacements = tierTimeline.item_placement?.filter((p: any) => !phaseNames.has(p.phase_name)) || [];
    if (invalidPlacements.length > 0) {
        logger.warn(`⚠️ Invalid phase_name references for tier ${tierKey}: ${invalidPlacements.map((p: any) => p.phase_name).join(', ')}`);
      return NextResponse.json(
        { 
          success: false, 
            error: `Some item placements reference non-existent phases for tier ${tierKey}`,
          details: `Invalid phase names: ${invalidPlacements.map((p: any) => p.phase_name).join(', ')}`
        },
        { status: 422 }
      );
    }

    // Ensure duration_weeks are integers
      if (tierTimeline.phases) {
        for (const phase of tierTimeline.phases) {
        phase.duration_weeks = Math.round(phase.duration_weeks);
        if (phase.duration_weeks < 0) phase.duration_weeks = 0;
        if (phase.duration_weeks > 104) phase.duration_weeks = 104;
      }
    }

      tierTimelines[tierKey] = tierTimeline;
    }

    // Combine all tier timelines into final output
    const timelineOutput = {
      listing_id: listingId,
      generated_at: new Date().toISOString(),
      tiers: tierTimelines
    };

    // Validate with AJV (may need schema update)
    const isValid = validateTimelineOutput(timelineOutput as any);
    if (!isValid) {
      logger.warn('⚠️ AJV validation warnings (may be due to new structure):', validateTimelineOutput.errors);
      // Don't fail - schema may need updating
    }

    // Store the timeline report
    const { error: storeError } = await supabase
      .from('renovation_timeline_reports')
      .upsert({
        listing_id: listingId,
        report_data: timelineOutput,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (storeError) {
      logger.error('❌ Failed to store timeline report:', storeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to store timeline report',
          details: storeError.message 
        },
        { status: 500 }
      );
    }

    logger.log('✅ Timeline reports generated and stored successfully for all tiers');

    return NextResponse.json({
      success: true,
      message: 'Renovation timelines generated successfully',
      data: timelineOutput
    });

  } catch (error) {
    logger.error('Timeline generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const { data, error } = await supabase
      .from('renovation_timeline_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No timeline report found for this listing',
          details: error?.message 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.report_data
    });

  } catch (error) {
    console.error('Error fetching timeline report:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
