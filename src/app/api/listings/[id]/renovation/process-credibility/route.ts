import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGenAI } from '@/lib/genaiClient';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const supabase = lazySupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    console.log(`🔍 Processing credibility and extracting price data - listing ${listingId}`);

    // Get all search results for this listing
    const { data: searchResults, error: searchResultsError } = await supabase
      .from('renovation_search_results')
      .select(`
        *,
        renovation_search_terms!inner(
          *,
          renovation_tiers!inner(listing_id)
        )
      `)
      .eq('renovation_search_terms.renovation_tiers.listing_id', listingId)
      .is('credibility_score', null); // Only process unprocessed results

    if (searchResultsError || !searchResults || searchResults.length === 0) {
      console.error('❌ Failed to fetch search results:', searchResultsError);
      return NextResponse.json(
        { error: 'No unprocessed search results found for this listing' },
        { status: 404 }
      );
    }

    console.log(`📊 Found ${searchResults.length} unprocessed search results, analyzing...`);

    // Process search results using Gemini 2.5 Flash
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });

    const processedResults = [];

    // Process results in batches to avoid token limits
    const batchSize = 5;
    for (let i = 0; i < searchResults.length; i += batchSize) {
      const batch = searchResults.slice(i, i + batchSize);
      
      const prompt = `
You are a Spanish renovation market research expert. Analyze these search results for credibility and extract price information.

For each search result, provide:
1. Credibility score (0.00 to 1.00) based on:
   - Website authority and reputation
   - Content quality and specificity
   - Contact information availability
   - Professional presentation
   - Spanish market relevance

2. Extracted price data (if available):
   - Price ranges mentioned
   - Cost per unit (m², hour, etc.)
   - Material costs
   - Labor costs
   - Total project estimates

SEARCH RESULTS TO ANALYZE:
${JSON.stringify(batch.map(result => ({
  id: result.id,
  url: result.url,
  title: result.title,
  content: result.content
})), null, 2)}

Return ONLY a valid JSON object with this exact structure:
{
  "results": [
    {
      "id": 1,
      "credibility_score": 0.85,
      "price_data": {
        "price_ranges": ["€50-€80/m²", "€2,000-€5,000 total"],
        "cost_per_unit": "€65/m²",
        "material_costs": ["€30/m² materials"],
        "labor_costs": ["€35/m² labor"],
        "total_estimates": ["€3,500 average project"],
        "currency": "EUR",
        "notes": "Prices for Madrid area"
      }
    }
  ]
}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = (response as any).text();

      console.log(`🤖 Gemini response received for batch ${Math.floor(i/batchSize) + 1}, parsing...`);

      // Parse the JSON response
      let parsedResponse;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response:', parseError);
        console.error('Raw response:', text);
        continue;
      }

      if (!parsedResponse.results || !Array.isArray(parsedResponse.results)) {
        console.error('❌ Invalid response structure:', parsedResponse);
        continue;
      }

      // Update search results with credibility scores and price data
      for (const analysisResult of parsedResponse.results) {
        const { data: updatedResult, error: updateError } = await supabase
          .from('renovation_search_results')
          .update({
            credibility_score: analysisResult.credibility_score,
            price_data: analysisResult.price_data,
          })
          .eq('id', analysisResult.id)
          .select()
          .single();

        if (updateError) {
          console.error(`❌ Failed to update result ${analysisResult.id}:`, updateError);
          continue;
        }

        processedResults.push(updatedResult);
        console.log(`✅ Processed result ${analysisResult.id} with credibility ${analysisResult.credibility_score}`);
      }

      // Add delay between batches
      if (i + batchSize < searchResults.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return NextResponse.json({
      success: true,
      processedResults: processedResults,
      listingId: parseInt(listingId),
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}
