import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { vertexRAG, RAGResult } from '@/lib/vertex-rag';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * AI Price Extractor (Flash Lite)
 * Extracts precise EUR/m2 from unstructured Habitissimo snippets.
 */
async function extractPriceFromText(text: string, context: string): Promise<{ price_m2: number; confidence: string; reasoning: string } | null> {
    try {
        // Updated prompt to handle JSON artifacts and be more robust
        const prompt = `You are a construction estimator in Spain. Extract the renovation price per square meter (EUR/m2) from the potentially messy text snippet.

CONTEXT: ${context}
TEXT: "${text}"

RULES:
1. IGNORE JSON syntax, HTML tags, or metadata. Focus on the content.
2. LOOK FOR prices matching the CONTEXT. 
   - If Context is "Complete Kitchen/Bath Renovation", look for "Reforma Integral" or similar full-scope prices.
   - If Context is "Living/Bedroom Update" or specific tasks (e.g. "Smoothing Walls"), LOOK FOR those specific component prices (e.g. "Alisar paredes: 15-20€/m2", "Pintura: 10€/m2", "Suelo: 30€/m2").
3. If multiple components are found for a "Update" context (e.g. walls + floor), SUM THEM UP for a total /m2.
4. If a range is given (e.g. "600-800 €/m2"), return the AVERAGE (700).
5. If a total price is given for a specific size (e.g. "3000 € for 6m2"), calculate per m2 (500).
6. If no valid price is found, return null.

OUTPUT JSON:
{
  "price_m2": number | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "string"
}`;

        const result = await callGeminiRest(prompt, {
            model: 'gemini-2.5-flash-lite', // Fast & Cheap
            temperature: 0.0,
            responseMimeType: 'application/json'
        });

        if (!result.success || !result.text) return null;
        const parsed = JSON.parse(result.text);
        
        if (!parsed.price_m2) return null;
        return parsed;

    } catch (e) {
        console.warn('Price extraction failed', e);
        return null;
    }
}

/**
 * Query Pricing Store (Vertex AI RAG) with Retry Strategy
 */
async function queryPricingStore(queries: string[], roomContext: string): Promise<{ price_m2: number; confidence: string; source: string } | null> {
  try {
    if (!vertexRAG.isConfigured('pricing')) {
        console.warn('⚠️ Pricing RAG not configured');
        return null;
    }

    // Try each query in order
    for (const query of queries) {
        console.log(`🔍 RAG Query: "${query}"`);
        const results = await vertexRAG.search('pricing', query, 3); // Get top 3 to increase hit chance
        
        if (results && results.length > 0) {
            // Iterate through results to find a valid price
            for (const result of results) {
                console.log(`  📄 Analyze Result: "${result.title}"`);
                
                // 1. Try Metadata First (If it looks like a valid m2 price)
                // Use metadata price if it's reasonable (200-3000 EUR). 
                // If it's < 100, it might be 'painting' or 'm2' unit price. 
                // If it's > 3000, it's likely total price.
                // Rely on AI extraction for safety.
                
                // 2. AI Extraction from Content
                const extracted = await extractPriceFromText(result.content || result.title || "", roomContext);
                
                if (extracted && extracted.price_m2 && extracted.confidence !== 'low') {
                    console.log(`  ✅ Valid Price Found: ${extracted.price_m2} €/m2 (${extracted.reasoning})`);
                    
                    // For Dry Rooms (Living/Bed), if the price is too low (< 50), it's likely just ONE component (e.g. painting).
                    // We should probably stack them or assume a minimum baseline for a "Renovation".
                    // Simple heuristic: If context implies multiple trades but price is < 100, assume it's a partial price and maybe double it for rough baseline? 
                    // OR better: Trust the "Reforma Integral" query results if they exist.
                    
                    return {
                        price_m2: extracted.price_m2,
                        confidence: extracted.confidence,
                        source: `Habitissimo: ${result.title}`
                    };
                }
            }
        } else {
            console.log(`  ⚠️ RAG Miss for "${query}"`);
        }
    }
  } catch (error) {
    console.warn('RAG Pricing query failed:', error);
  }

  return null;
}

/**
 * Baseline Check Endpoint
 * 
 * Calculates the "Physics Baseline" cost for renovation.
 * 
 * Workflow:
 * 1. Get Room Sizes (Smart M2)
 * 2. Apply RAG-derived "Cost per M2" for each room type
 * 3. Sum up to get "Hard Cost Baseline"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`🏗️ Starting Baseline Check for listing ${listingId}`);

    const listingIdNum = parseInt(listingId, 10);

    // 1. Fetch Smart M2 Data
    const { data: textAnalysis } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'smart_m2')
      .single();

    if (!textAnalysis?.results?.rooms) {
      return NextResponse.json({ 
        success: false, 
        error: 'missing_smart_m2', 
        message: 'Smart M2 data not found. Run /renovation/smart-m2 first.' 
      }, { status: 400 });
    }

    const rooms = textAnalysis.results.rooms;
    
    // 2. Fetch Room Analysis (to determine condition/level)
    const { data: roomAnalysesData } = await supabase
      .from('room_analyses')
      .select('analysis_data')
      .eq('listing_id', listingIdNum)
      .maybeSingle();

    const findAnalysis = (name: string) => {
      if (!roomAnalysesData?.analysis_data) return null;
      return roomAnalysesData.analysis_data.find((r: any) => 
        r.room_name === name || 
        r.room_name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(r.room_name.toLowerCase())
      );
    };

    // 3. Calculate Baseline Costs
    let totalBaseLow = 0;
    let totalBaseHigh = 0;
    const breakdown = [];

    for (const room of rooms) {
      const analysis = findAnalysis(room.cluster_name);
      const condition = analysis?.overall_room_condition || 'unknown';
      
      // Determine Search Queries (Targeted "Golden Titles" Strategy)
      let searchQueries = [];
      let context = "General Renovation";
      const name = room.cluster_name.toLowerCase();

      if (name.includes('cocina')) {
          searchQueries = [
              "presupuestos_proyecto-y-reforma-integral-cocina", // Validated Golden Title
              "precio reforma integral cocina m2", // General Fallback
              "precio cambiar cocina completa"
          ];
          context = "Complete Kitchen Renovation";
      } else if (name.includes('baño') || name.includes('aseo')) {
          searchQueries = [
              "presupuestos_proyecto-y-reforma-integral-bano", // Validated Golden Title
              "precio reforma integral baño m2",
              "precio baño completo"
          ];
          context = "Complete Bathroom Renovation";
      } else if (name.includes('terraza') || name.includes('jardín') || name.includes('balcón')) {
          searchQueries = [
              "precio reforma terraza exterior m2",
              "precio impermeabilizar terraza",
              "precio suelo exterior m2"
          ];
          context = "Terrace Renovation";
      } else if (name.includes('salón') || name.includes('dormitorio') || name.includes('habitación')) {
          searchQueries = [
             // Try specific high-value components for "Dry Rooms" which often lack a "whole room" guide
             "precio alisar paredes y pintar m2", 
             "precio poner tarima flotante m2",
             "precio renovar electricidad m2",
             "precio reforma integral piso m2" // Fallback
          ];
          context = "Living/Bedroom Update (Smoothing Walls + Painting + Flooring + Electrics)";
      } else {
          searchQueries = [
              "presupuestos_proyecto-y-reforma-integral-vivienda", // Validated Golden Title
              "precio reforma integral vivienda m2"
          ];
          context = "General Renovation";
      }

      // Call RAG (Smart Loop)
      const pricing = await queryPricingStore(searchQueries, context);
      
      let priceM2 = 0;
      let source = 'DATA_MISSING';
      let confidence = 'low';

      if (pricing) {
        priceM2 = pricing.price_m2;
        source = pricing.source;
        confidence = pricing.confidence;
      } else {
         console.warn(`⚠️ No pricing found for ${room.cluster_name} after expanded search.`);
      }
      
      // Calculate Room Cost
      const estimatedCost = room.estimated_m2 * priceM2;
      
      // Apply a simple range (+/- 15%)
      const costLow = Math.round(estimatedCost * 0.85);
      const costHigh = Math.round(estimatedCost * 1.15);

      totalBaseLow += costLow;
      totalBaseHigh += costHigh;

      breakdown.push({
        room_name: room.cluster_name,
        m2: room.estimated_m2,
        price_m2_ref: priceM2,
        estimated_range: { low: costLow, high: costHigh },
        source: source,
        condition: condition
      });
    }

    // Add "General Expenses" (Licenses, debris, technical fees) - usually ~20% of PEM
    const generalExpensesLow = Math.round(totalBaseLow * 0.20);
    const generalExpensesHigh = Math.round(totalBaseHigh * 0.25);

    const finalTotalLow = totalBaseLow + generalExpensesLow;
    const finalTotalHigh = totalBaseHigh + generalExpensesHigh;

    const result = {
      listing_id: listingId,
      baseline_rom: {
        low: finalTotalLow,
        high: finalTotalHigh,
        currency: "EUR"
      },
      details: {
        hard_costs: { low: totalBaseLow, high: totalBaseHigh },
        soft_costs: { low: generalExpensesLow, high: generalExpensesHigh },
        breakdown
      },
      methodology: "Physics Baseline: Smart M2 x Habitissimo RAG (AI Extracted)"
    };

    // 3. Save Result
    await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'baseline_check',
        results: result
      }, { onConflict: 'listing_id,phase' });

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    console.error('Baseline Check Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}