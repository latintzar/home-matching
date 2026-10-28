import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGenAI } from '@/lib/genaiClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    console.log(`🔍 Generating search terms for renovation tiers - listing ${listingId}`);

    // Get all renovation tiers for this listing
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

    console.log(`📊 Found ${tiers.length} tiers, generating search terms...`);

    // Generate search terms using Gemini 2.5 Flash
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });

    const prompt = `
You are a Spanish renovation market research expert. Generate targeted search terms for finding contractors, materials, and pricing information for renovation work items.

For each work item in each tier, generate 3-5 specific search terms that would help find:
1. Spanish contractors who do this type of work
2. Material suppliers and prices
3. Permit requirements and costs
4. Regional pricing variations

Focus on Spanish websites, contractors, and marketplaces. Include location-specific terms when relevant.

WORK ITEMS TO PROCESS:
${JSON.stringify(tiers.map(tier => ({
  tier_name: tier.tier_name,
  work_items: tier.work_items
})), null, 2)}

For each work item, generate search terms like:
- "reformas cocina Barcelona precio"
- "electricista Madrid presupuesto"
- "permisos obra menor Valencia"
- "materiales construcción Alicante"
- "contratista baño Sevilla"

Return ONLY a valid JSON object with this exact structure:
{
  "search_terms": [
    {
      "tier_id": 1,
      "work_item": "Kitchen Renovation",
      "search_terms": [
        "reformas cocina Barcelona precio",
        "cocinas nuevas Madrid presupuesto",
        "contratista cocina Valencia",
        "materiales cocina Alicante"
      ]
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = (response as any).text();

    console.log('🤖 Gemini response received, parsing...');

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
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    if (!parsedResponse.search_terms || !Array.isArray(parsedResponse.search_terms)) {
      console.error('❌ Invalid response structure:', parsedResponse);
      return NextResponse.json(
        { error: 'Invalid AI response structure' },
        { status: 500 }
      );
    }

    console.log(`✅ Generated search terms for ${parsedResponse.search_terms.length} work items, saving to database...`);

    // Save search terms to the database
    const savedSearchTerms = [];
    for (const searchTermData of parsedResponse.search_terms) {
      const { data: savedSearchTerm, error: saveError } = await supabase
        .from('renovation_search_terms')
        .insert({
          tier_id: searchTermData.tier_id,
          work_item: searchTermData.work_item,
          search_terms: searchTermData.search_terms,
        })
        .select()
        .single();

      if (saveError) {
        console.error(`❌ Failed to save search terms for ${searchTermData.work_item}:`, saveError);
        continue;
      }

      savedSearchTerms.push(savedSearchTerm);
      console.log(`✅ Saved search terms for ${searchTermData.work_item}`);
    }

    return NextResponse.json({
      success: true,
      searchTerms: savedSearchTerms,
      listingId: parseInt(listingId),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}
