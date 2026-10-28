import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { pricingOutputSchema } from '@/lib/schemas/renovation-schemas';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

// Initialize AJV validator
const ajv = new Ajv({ strict: true, allErrors: false, removeAdditional: false });
addFormats(ajv);
const validatePricingOutput = ajv.compile(pricingOutputSchema);

/**
 * Round number to nearest €100
 */
function roundToNearest100(value: number): number {
  return Math.round(value / 100) * 100;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'K';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params;

  try {
    logger.log(`💰 Generating renovation pricing for listing ${listingId}`);

    // Fetch renovation scope report (scope seed output)
    const { data: scopeData, error: scopeError } = await supabase
      .from('renovation_scope_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (scopeError || !scopeData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No renovation scope found for this listing. Run renovation-scope endpoint first.',
          details: scopeError?.message 
        },
        { status: 404 }
      );
    }

    const scopeSeed = scopeData.report_data;
    
    // Extract all work items from all tiers into a flat array
    const allWorkItems: Array<{ id: string; tier: string; name: string; subtitle?: string; room_ref?: string; photo_refs: string[] }> = [];
    
    for (const tierKey of ['estandar', 'optimo', 'plus'] as const) {
      const tier = scopeSeed.tiers?.[tierKey];
      if (tier?.work_items) {
        for (const item of tier.work_items) {
          allWorkItems.push({
            id: item.id,
            tier: item.tier || tierKey,
            name: item.name,
            subtitle: item.subtitle,
            room_ref: item.room_ref,
            photo_refs: item.photo_refs || []
          });
        }
      }
    }

    if (allWorkItems.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No work items found in renovation scope' 
        },
        { status: 400 }
      );
    }

    // Fetch cost research results from renovation_research_results
    const { data: researchResults, error: researchError } = await supabase
      .from('renovation_research_results')
      .select('category, report_data')
      .eq('listing_id', listingId)
      .like('category', 'costs_%');

    if (researchError) {
      logger.warn('⚠️ Could not fetch research results:', researchError);
      }

    // Organize research by tier
    const researchByTier: Record<string, any> = {};
    if (researchResults) {
      for (const result of researchResults) {
        const tier = result.category.replace('costs_', '');
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

    // Create prompt for pricing
    const prompt = `You are a cost estimator for Spanish renovations. Assign realistic cost ranges to each work item.

PROPERTY CONTEXT:
- Listing ID: ${listingId}
- Location: ${listingData.city || 'Spain'}, ${listingData.region || ''}
- Area: ${listingData.scraped_data?.useful_area_m2 || listingData.scraped_data?.constructed_area_m2 || 'Unknown'} m²

WORK ITEMS TO PRICE:
${JSON.stringify(allWorkItems, null, 2)}

COST RESEARCH DATA (BY TIER):
${JSON.stringify(researchByTier, null, 2)}

TASK:
Assign cost ranges (cost_low_eur, cost_high_eur) to each work item. Consider:
1. **PRIORITIZE research metrics**: If research results contain metrics.low and metrics.high for a work item, use those as the base. Research data overrides general estimates.
2. Spanish market data from research results (check metrics fields for quantitative data)
3. Materials + labor + permits/design/admin (~10-15% professional fees)
4. Contractor overhead (~15%)
5. VAT (21%)
6. Tier complexity: Plus > Óptimo > Estándar

CRITICAL: If research summaries contain specific cost numbers (e.g., "€8,000-15,000 for bathroom renovation"), use those ranges as the foundation. Only use general knowledge if research metrics are missing or low confidence.

CRITICAL RULES:
- Keep the exact same 'id' and 'tier' from each work item
- Round cost_low_eur and cost_high_eur to nearest €100 (use Math.round(value / 100) * 100)
- Add brief 'cost_basis' explanation (3-140 chars, Spanish)
- Add 'confidence' level: 'high', 'medium', or 'low'
- Ensure cost_low_eur ≤ cost_high_eur

OUTPUT FORMAT:
Return JSON matching this exact structure:
{
  "listing_id": "${listingId}",
  "generated_at": "${new Date().toISOString()}",
  "rounding_rules": {
    "item": "nearest_€100",
    "totals": "nearest_€1,000"
  },
  "priced_items": [
        {
      "id": "est-01",
      "tier": "estandar",
          "cost_low_eur": 1000,
          "cost_high_eur": 1500,
      "cost_basis": "Basado en datos de mercado español para [tipo de trabajo]",
      "confidence": "high"
    }
    // ... one entry per work item, preserving id and tier exactly
  ]
}

Ensure ALL prices are multiples of €100.`;

    // Define simplified response schema for Gemini (avoid "too many states" error)
    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        generated_at: { type: 'string' },
        rounding_rules: {
          type: 'object',
          properties: {
            item: { type: 'string' },
            totals: { type: 'string' }
          }
        },
        priced_items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
              tier: { type: 'string' },
              cost_low_eur: { type: 'number' },
              cost_high_eur: { type: 'number' },
              cost_basis: { type: 'string' },
              confidence: { type: 'string' }
            }
          }
        }
      }
    };

    // Call Gemini REST API
    logger.log(`🤖 Calling Gemini REST API for pricing analysis (${allWorkItems.length} items)...`);
    
    // Calculate estimated tokens needed: ~200 tokens per work item + overhead
    const estimatedTokens = Math.max(16384, allWorkItems.length * 250 + 4000);
    const maxOutputTokens = Math.min(32768, estimatedTokens); // Cap at 32k
    
    logger.log(`📊 Estimated tokens needed: ${estimatedTokens}, using maxOutputTokens: ${maxOutputTokens}`);
    
    const geminiResponse = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro', // Use Pro model like other endpoints
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: maxOutputTokens, // Increased for large work item lists
      thinkingConfig: {
        thinkingBudget: 32768 // Match other endpoints
      },
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!geminiResponse.success || !geminiResponse.text) {
      logger.error('❌ Gemini REST API call failed:', geminiResponse.error);
      logger.error('📋 Raw error response:', geminiResponse.rawResponse);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to get AI response',
          details: geminiResponse.error,
          rawError: geminiResponse.rawResponse
        },
        { status: 500 }
      );
    }

    // Parse JSON response
    // With responseSchema, we should get pure JSON, but handle edge cases
    let pricingOutput: any;
    try {
      let cleaned = geminiResponse.text.trim();
      
      // Remove markdown code blocks if present (shouldn't be with responseSchema, but handle it)
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      // Try to extract JSON if response is wrapped in text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      pricingOutput = JSON.parse(cleaned);
      logger.log(`✅ Successfully parsed pricing output (${pricingOutput.priced_items?.length || 0} items)`);
    } catch (parseError) {
      logger.error('❌ Failed to parse AI response:', parseError);
      logger.error('📋 Response length:', geminiResponse.text.length);
      logger.error('📋 Response preview (first 500 chars):', geminiResponse.text.substring(0, 500));
      logger.error('📋 Response preview (last 500 chars):', geminiResponse.text.substring(Math.max(0, geminiResponse.text.length - 500)));
      
      // Check if response looks truncated
      const looksTruncated = !geminiResponse.text.trim().endsWith('}') && !geminiResponse.text.trim().endsWith(']');
      if (looksTruncated) {
        logger.error('⚠️ Response appears truncated - may need higher maxOutputTokens');
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to parse AI response',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          responseLength: geminiResponse.text.length,
          looksTruncated
        },
        { status: 500 }
      );
    }

    // Round all prices to nearest €100 (enforce rounding even if Gemini didn't)
    if (pricingOutput.priced_items) {
      for (const item of pricingOutput.priced_items) {
        item.cost_low_eur = roundToNearest100(item.cost_low_eur);
        item.cost_high_eur = roundToNearest100(item.cost_high_eur);
        // Ensure low <= high
        if (item.cost_low_eur > item.cost_high_eur) {
          item.cost_high_eur = item.cost_low_eur;
        }
      }
    }

    // Validate with AJV
    const isValid = validatePricingOutput(pricingOutput);
    if (!isValid) {
      logger.error('❌ AJV validation failed:', validatePricingOutput.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Generated pricing output does not match schema',
          details: validatePricingOutput.errors 
        },
        { status: 422 }
      );
    }

    // Verify all work items from scope have corresponding priced items
    const pricedItemIds = new Set(pricingOutput.priced_items.map((item: any) => item.id));
    const missingItems = allWorkItems.filter(item => !pricedItemIds.has(item.id));
    if (missingItems.length > 0) {
      logger.warn(`⚠️ Missing priced items for: ${missingItems.map(i => i.id).join(', ')}`);
    }

    // Store the pricing report
    const { error: storeError } = await supabase
      .from('renovation_pricing_reports')
      .upsert({
        listing_id: listingId,
        report_data: pricingOutput,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (storeError) {
      logger.error('❌ Failed to store pricing report:', storeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to store pricing report',
          details: storeError.message 
        },
        { status: 500 }
      );
    }

    logger.log('✅ Pricing report generated and stored successfully');

    return NextResponse.json({
      success: true,
      message: 'Renovation pricing generated successfully',
      data: pricingOutput
    });

  } catch (error) {
    logger.error('Pricing generation error:', error);
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
      .from('renovation_pricing_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No pricing report found for this listing',
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
    // GET handler doesn't use logger since it's not orchestrated
    console.error('Error fetching pricing report:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
