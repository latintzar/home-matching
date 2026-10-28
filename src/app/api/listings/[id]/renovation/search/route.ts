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
 * J-Reno Double-Barrel Research Endpoint (Node 2)
 * 
 * The "Researcher" - Gets real numbers and laws for the Strategy.
 * 
 * Architecture:
 * - Barrel 1 (Legal RAG): Checks Spanish Technical Code & Bureaucratic Forms (Local & Regional)
 * - Barrel 2 (Pricing RAG): Habitissimo costs, timings, contractor norms
 * - Barrel 3 (ScrapingDog/Google): Live scraping for specific items (Stub)
 * 
 * Input: unified_strategy (text_analysis_results phase)
 * Output: renovation_research_results (category, tier, content)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`🔍 Starting J-Reno Double-Barrel Research for listing ${listingId}`);

    // 1. Fetch Unified Strategy & Listing Location
    const { data: textResults } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'unified_strategy')
      .single();

    const { data: listing } = await supabase
      .from('listings')
      .select('city, region')
      .eq('id', listingId)
      .single();

    if (!textResults?.results) {
      return NextResponse.json({ 
        success: false, 
        error: 'missing_strategy', 
        message: 'Unified Strategy not found. Run /renovation/unified-strategy first.' 
      }, { status: 400 });
    }

    const strategy = textResults.results;
    const tiers = ['estandar', 'optimo', 'plus'] as const;
    
    // Use actual listing location, fail if missing (no hardcoded defaults)
    if (!listing?.city || !listing?.region) {
      return NextResponse.json({ 
        success: false, 
        error: 'missing_location', 
        message: 'Listing location (city/region) is required for research queries.' 
      }, { status: 400 });
    }

    const location = {
      city: listing.city,
      region: listing.region
    };

    // 2. Generate Granular Research Queries per Work Item
    // Ensures consistent rigor by systematically generating queries for all categories
    const researchQueries = await generateResearchQueries(strategy, location);

    // 3. Execute Multi-Source Research
    const allResults = [];

    for (const tier of tiers) {
      console.log(`🔍 Researching tier: ${tier}`);
          
      // Barrel 1: Legal RAG (Local & Regional Permits)
      const legalResults = await queryLegalRAG(researchQueries[tier], location);
      
      // Barrel 2: Pricing RAG (Costs, Timings, Contractor Norms)
      // We use the Pricing Store for both Costs and Timings now.
      const pricingResults = await queryPricingStore(researchQueries[tier], location);

      // Barrel 3: Live Scraping (Stub/Placeholder for specific materials)
      const scrapingResults = await queryScrapingDog(researchQueries[tier]);
      
      // 4. Curate and Save Results
      const curatedResults = {
        costs: {
          legal: legalResults.costs || [],
          pricing_rag: pricingResults.costs || [], // Main source for labor/generic costs
          scraping: scrapingResults.costs || [] // Specific products via ScrapingDog
        },
        permits: {
          legal: legalResults.permits || [] // Main source for regulations
        },
        timings: {
          pricing_rag: pricingResults.timings || [] // Habitissimo durations
        },
        contractor: {
          pricing_rag: pricingResults.contractor || [] // "Partidas olvidadas", etc.
        }
      };

      // Save to renovation_research_results (Clean delete & insert)
      const categories = ['costs', 'permits', 'timings', 'contractor'];
      
      for (const category of categories) {
        await supabase
          .from('renovation_research_results')
          .delete()
          .eq('listing_id', parseInt(listingId))
          .eq('category', category)
          .eq('tier', tier);

        // @ts-ignore - dynamic access
        const reportData = curatedResults[category as keyof typeof curatedResults];
        
        // Store results if we have any data
        if (reportData && Object.keys(reportData).length > 0) {
             await supabase
            .from('renovation_research_results')
          .insert({
              listing_id: parseInt(listingId),
              category: category,
              tier: tier,
              report_data: reportData
            });
        }
        }

      allResults.push({ tier, results: curatedResults });
    }

    return NextResponse.json({
      success: true,
      data: allResults,
      message: 'J-Reno research complete for all tiers'
    });

  } catch (error: any) {
    console.error('J-Reno Research Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Generate research queries from unified strategy
 * Extracts Work Items and generates Local/Regional queries.
 */
async function generateResearchQueries(strategy: any, location: { city: string, region: string }): Promise<Record<string, any>> {
  const prompt = `You are a senior renovation researcher.
  
LOCATION: ${location.city}, ${location.region}, Spain.
UNIFIED STRATEGY:
${JSON.stringify(strategy, null, 2)}

TASK:
For each tier (estandar, optimo, plus):
1. Analyze the "actions_by_room" to identify KEY WORK ITEMS (e.g. "Kitchen Demolition", "New Flooring").
2. Generate specific queries for:
   - COSTS: "precio [item] ${location.city}" (Local market rates)
   - PERMITS: "licencia [action] ${location.city}" AND "normativa [action] ${location.region}" (Parallel Local/Regional)
   - TIMINGS: "duración [item]" (Sequencing)
   - CONTRACTOR: "problemas frecuentes [item]" (Tacit knowledge)

OUTPUT JSON:
{
  "estandar": {
    "costs": ["query1", "query2"...],
    "permits": ["query1", "query2"...],
    "timings": ["query1", "query2"...],
    "contractor": ["query1"...]
  },
  "optimo": { ... },
  "plus": { ... }
}`;

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    responseMimeType: 'application/json'
  });

  if (!result.success || !result.text) {
    throw new Error(result.error || 'Query generation failed');
  }

  return JSON.parse(result.text);
}

/**
 * Barrel 1: Legal RAG (connected to Vertex AI RAG)
 */
async function queryLegalRAG(queries: any, location: any): Promise<any> {
  try {
    if (vertexRAG.isConfigured('legal')) {
      // Execute parallel searches for permits
      const searchPromises = (queries.permits || []).slice(0, 3).map((q: string) => 
        vertexRAG.search('legal', q, 2)
      );
      
      const results = await Promise.all(searchPromises);
      const flatResults = results.flat(); // Flatten array of arrays
      
      if (flatResults.length > 0) {
        return {
          costs: [],
          permits: flatResults.map((doc: RAGResult) => ({
            source: `RAG-Legal: ${doc.source}`,
            content: doc.content,
            relevance: 'high'
          }))
        };
      }
    }
  } catch (error) {
    console.warn('RAG Legal query failed:', error);
  }

  return { costs: [], permits: [] };
}

/**
 * Barrel 2: Pricing RAG (Habitissimo Data)
 * Handles Costs, Timings, and Contractor Norms.
 */
async function queryPricingStore(queries: any, location: any): Promise<any> {
  try {
    if (vertexRAG.isConfigured('pricing')) {
      // Parallelize queries across categories
      const costQueries = (queries.costs || []).slice(0, 3);
      const timeQueries = (queries.timings || []).slice(0, 2);
      const contractorQueries = (queries.contractor || []).slice(0, 2);
      
      const allQueries = [...costQueries, ...timeQueries, ...contractorQueries];
      
      if (allQueries.length === 0) return { costs: [], timings: [], contractor: [] };

      // Execute all
      const results = await Promise.all(allQueries.map(q => vertexRAG.search('pricing', q, 2)));
      
      // Separate results back into buckets
      const costResults = results.slice(0, costQueries.length).flat();
      const timeResults = results.slice(costQueries.length, costQueries.length + timeQueries.length).flat();
      const contractorResults = results.slice(costQueries.length + timeQueries.length).flat();

      return {
        costs: costResults.map((r: RAGResult) => ({ source: `RAG-Price: ${r.source}`, content: r.content, relevance: 'high' })),
        timings: timeResults.map((r: RAGResult) => ({ source: `RAG-Time: ${r.source}`, content: r.content, relevance: 'high' })),
        contractor: contractorResults.map((r: RAGResult) => ({ source: `RAG-Contractor: ${r.source}`, content: r.content, relevance: 'high' }))
      };
    }
  } catch (error) {
    console.warn('RAG Pricing query failed:', error);
  }

  return { costs: [], timings: [], contractor: [] };
}

/**
 * Barrel 3: Live Scraping (Stub - ScrapingDog)
 */
async function queryScrapingDog(queries: any): Promise<any> {
  // Placeholder for ScrapingDog integration
  // Will use queries.costs to find specific material prices on Google Shopping / Vendor sites
  return {
    costs: [] // Return empty until implemented
  };
}
