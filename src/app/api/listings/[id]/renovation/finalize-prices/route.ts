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
    console.log(`💰 Finalizing prices based on market research - listing ${listingId}`);

    // Get renovation tiers with work items
    const { data: tiers, error: tiersError } = await supabase
      .from('renovation_tiers')
      .select('*')
      .eq('listing_id', listingId)
      .order('tier_name');

    if (tiersError || !tiers || tiers.length === 0) {
      console.error('❌ Failed to fetch renovation tiers:', tiersError);
      return NextResponse.json(
        { error: 'No renovation tiers found for this listing' },
        { status: 404 }
      );
    }

    // Get processed search results with price data
    const { data: searchResults, error: searchResultsError } = await supabase
      .from('renovation_search_results')
      .select(`
        *,
        renovation_search_terms!inner(
          work_item,
          renovation_tiers!inner(listing_id)
        )
      `)
      .eq('renovation_search_terms.renovation_tiers.listing_id', listingId)
      .not('credibility_score', 'is', null)
      .not('price_data', 'is', null);

    if (searchResultsError) {
      console.error('❌ Failed to fetch search results:', searchResultsError);
      return NextResponse.json(
        { error: 'Failed to fetch market research data' },
        { status: 500 }
      );
    }

    console.log(`📊 Found ${tiers.length} tiers and ${searchResults?.length || 0} market research results`);

    // Process each tier for price finalization
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    const updatedTiers = [];

    for (const tier of tiers) {
      console.log(`💰 Finalizing prices for ${tier.tier_name} tier...`);

      // Get relevant search results for this tier
      const tierSearchResults = searchResults?.filter(result => 
        result.renovation_search_terms.renovation_tiers.tier_name === tier.tier_name
      ) || [];

      const prompt = `
You are a Spanish renovation cost expert. Based on the work items and market research data, calculate realistic prices for each work item in this renovation tier.

TIER: ${tier.tier_name}
DESCRIPTION: ${tier.description || 'Renovation tier'}

WORK ITEMS:
${JSON.stringify(tier.work_items, null, 2)}

MARKET RESEARCH DATA:
${JSON.stringify(tierSearchResults.map(result => ({
  work_item: result.renovation_search_terms.work_item,
  credibility_score: result.credibility_score,
  price_data: result.price_data
})), null, 2)}

For each work item, calculate:
1. Material cost range (min-max)
2. Labor cost range (min-max) 
3. Total cost range (min-max)
4. Estimated hours of work
5. Cost per hour (if applicable)
6. Cost per m² (if applicable)

Consider:
- Spanish market conditions
- Regional pricing variations
- Quality level appropriate for this tier
- Market research credibility scores
- Complexity and scope of work

Return ONLY a valid JSON object with this exact structure:
{
  "tier_name": "${tier.tier_name}",
  "work_items_with_pricing": [
    {
      "category": "Kitchen",
      "name": "Kitchen Renovation",
      "description": "Complete kitchen renovation",
      "estimated_hours": 120,
      "complexity": "high",
      "material_cost_min": 8000,
      "material_cost_max": 15000,
      "labor_cost_min": 6000,
      "labor_cost_max": 12000,
      "total_cost_min": 14000,
      "total_cost_max": 27000,
      "cost_per_hour": 50,
      "cost_per_m2": 400,
      "pricing_notes": "Based on Madrid market research"
    }
  ],
  "total_cost_min": 35000,
  "total_cost_max": 75000,
  "pricing_methodology": "Based on market research with credibility weighting"
}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = (response as any).text();

      console.log(`🤖 Gemini response received for ${tier.tier_name}, parsing...`);

      // Parse the JSON response
      let parsedResponse;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error(`❌ Failed to parse Gemini response for ${tier.tier_name}:`, parseError);
        console.error('Raw response:', text);
        continue;
      }

      if (!parsedResponse.work_items_with_pricing || !Array.isArray(parsedResponse.work_items_with_pricing)) {
        console.error(`❌ Invalid response structure for ${tier.tier_name}:`, parsedResponse);
        continue;
      }

      // Update the tier with finalized pricing
      const { data: updatedTier, error: updateError } = await supabase
        .from('renovation_tiers')
        .update({
          work_items: parsedResponse.work_items_with_pricing,
          total_cost_min: parsedResponse.total_cost_min,
          total_cost_max: parsedResponse.total_cost_max,
        })
        .eq('id', tier.id)
        .select()
        .single();

      if (updateError) {
        console.error(`❌ Failed to update tier ${tier.tier_name}:`, updateError);
        continue;
      }

      updatedTiers.push(updatedTier);
      console.log(`✅ Finalized prices for ${tier.tier_name}: €${parsedResponse.total_cost_min}-€${parsedResponse.total_cost_max}`);
    }

    return NextResponse.json({
      success: true,
      tiers: updatedTiers,
      listingId: parseInt(listingId),
      finalizedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}
