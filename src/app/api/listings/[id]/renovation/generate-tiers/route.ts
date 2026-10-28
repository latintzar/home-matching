import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGenAI } from '@/lib/genaiClient';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const supabase = lazySupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface WorkItem {
  category: string;
  name: string;
  description: string;
  estimated_hours?: number;
  complexity: 'low' | 'medium' | 'high';
}

interface Permit {
  name: string;
  type: string;
  explanation: string;
  requirements: string[];
  process: string;
  estimated_days: number;
}

interface TimelineMilestone {
  name: string;
  description: string;
  duration_weeks: number;
  order: number;
  dependencies?: string[];
}

interface RenovationTier {
  tier_name: 'livable' | 'comfortable' | 'competitive';
  work_items: WorkItem[];
  permits: Permit[];
  timeline: TimelineMilestone[];
  total_time_months: number;
  description: string;
  target_budget_range: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    console.log(`📋 Fetching renovation tiers for listing ${listingId}`);

    const { data: tiers, error } = await supabase
      .from('renovation_tiers')
      .select('*')
      .eq('listing_id', listingId)
      .order('tier_name');

    if (error) {
      console.error('❌ Failed to fetch renovation tiers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch renovation tiers' },
        { status: 500 }
      );
    }

    if (!tiers || tiers.length === 0) {
      return NextResponse.json(
        { error: 'No renovation tiers found for this listing' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tiers,
      listingId: parseInt(listingId)
    });

  } catch (error) {
    console.error('❌ Get renovation tiers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    console.log(`🏗️ Generating renovation tiers for listing ${listingId}`);

    // Get the listing diagnostic analysis report
    const { data: analysisData, error: analysisError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .eq('phase', 'listing_diagnostic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (analysisError || !analysisData) {
      console.error('❌ Failed to fetch integrated analysis:', analysisError);
      return NextResponse.json(
        { error: 'No integrated analysis found for this listing' },
        { status: 404 }
      );
    }

    console.log('📊 Found integrated analysis, generating tiers...');

    // Generate renovation tiers using Gemini 2.5 Pro
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    const prompt = `
You are a Spanish renovation expert with deep knowledge of Spanish building codes, permits, and market conditions. 

Based on this integrated property analysis, generate 3 renovation tiers for a Spanish property:

INTEGRATED ANALYSIS:
${JSON.stringify(analysisData, null, 2)}

Generate 3 tiers: "livable", "comfortable", and "competitive" with the following structure:

1. LIVABLE TIER:
   - Target: Basic functionality, safety, and habitability
   - Budget: Lower-end renovation (€15,000-€35,000)
   - Focus: Essential repairs, basic improvements, safety compliance
   - Timeline: 2-4 months

2. COMFORTABLE TIER:
   - Target: Modern comfort, efficiency, and quality
   - Budget: Mid-range renovation (€35,000-€75,000)
   - Focus: Quality improvements, modern amenities, energy efficiency
   - Timeline: 4-6 months

3. COMPETITIVE TIER:
   - Target: Premium quality, market appeal, luxury finishes
   - Budget: High-end renovation (€75,000-€150,000+)
   - Focus: Luxury finishes, premium features, market differentiation
   - Timeline: 6-12 months

For each tier, provide:

WORK ITEMS (array of objects):
- category: "Structural", "Electrical", "Plumbing", "HVAC", "Flooring", "Kitchen", "Bathroom", "Interior", "Exterior"
- name: Specific work item name
- description: Detailed description of work
- estimated_hours: Estimated hours of work
- complexity: "low", "medium", "high"

CRITICAL: Do NOT include furniture-related work items. Furniture is secondary and will be handled separately. Focus only on architectural, structural, and permanent fixture work items. Exclude: furniture removal, furniture installation, furniture-related tasks, decorative items, personal belongings.

PERMITS (array of objects):
- name: Permit name in Spanish
- type: "Obra Mayor", "Obra Menor", "Instalación", "Cambio de Uso"
- why_needed: Clear explanation of why this permit is needed for this specific tier (mention specific work items)
- what_needed: What documents/materials are required to obtain it
- how_obtained: Practical details - where to go, who to contact, how long to wait, etc.

TIMELINE (array of objects):
- header: Clear phase name (e.g., "Planning & Permits", "Demolition & Prep", "Core Systems", "Finishes")
- subtitle: Detailed description of what needs to be done in this phase
- duration_weeks: Object with min and max weeks (e.g., {"min": 2, "max": 4} for 2-4 weeks)
- order: Sequential order (1, 2, 3...)
- dependencies: Optional array of prerequisite phase names

IMPORTANT: Timeline should be variable length (3-8 phases) based on the complexity of the renovation. Be creative but realistic. Each phase should have a clear purpose and logical sequence. Use week ranges for duration_weeks.

Include realistic Spanish permits like:
- Licencia de Obra Mayor/Menor
- Licencia de Instalaciones
- Licencia de Cambio de Uso
- Certificado de Eficiencia Energética
- ITE (Inspección Técnica de Edificios)
- Licencia de Actividad

Consider Spanish building regulations, energy efficiency requirements, and local market conditions.

Return ONLY a valid JSON object with this exact structure:
{
  "tiers": [
    {
      "tier_name": "livable",
      "work_items": [...],
      "permits": [...],
      "timeline": [...],
      "total_time_months": 3,
      "description": "Basic renovation for habitability",
      "target_budget_range": "€15,000-€35,000"
    },
    {
      "tier_name": "comfortable", 
      "work_items": [...],
      "permits": [...],
      "timeline": [...],
      "total_time_months": 5,
      "description": "Quality renovation for modern living",
      "target_budget_range": "€35,000-€75,000"
    },
    {
      "tier_name": "competitive",
      "work_items": [...],
      "permits": [...],
      "timeline": [...],
      "total_time_months": 8,
      "description": "Premium renovation for market appeal",
      "target_budget_range": "€75,000-€150,000+"
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('🤖 Gemini response received, parsing...');
    console.log('Raw response text:', text.substring(0, 500) + '...');

    // Parse the JSON response
    let parsedResponse;
    try {
      // Extract JSON from the response (in case there's extra text)
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

    if (!parsedResponse.tiers || !Array.isArray(parsedResponse.tiers)) {
      console.error('❌ Invalid response structure:', parsedResponse);
      return NextResponse.json(
        { error: 'Invalid AI response structure' },
        { status: 500 }
      );
    }

    console.log(`✅ Generated ${parsedResponse.tiers.length} tiers, saving to database...`);

    // Save each tier to the database
    const savedTiers = [];
    for (const tier of parsedResponse.tiers) {
      const { data: savedTier, error: saveError } = await supabase
        .from('renovation_tiers')
        .upsert({
          listing_id: parseInt(listingId),
          tier_name: tier.tier_name,
          work_items: tier.work_items,
          permits: tier.permits,
          timeline: tier.timeline,
          total_time_months: tier.total_time_months,
          style_prompts: null, // Will be generated later
        }, {
          onConflict: 'listing_id,tier_name'
        })
        .select()
        .single();

      if (saveError) {
        console.error(`❌ Failed to save tier ${tier.tier_name}:`, saveError);
        continue;
      }

      savedTiers.push(savedTier);
      console.log(`✅ Saved ${tier.tier_name} tier`);
    }

    return NextResponse.json({
      success: true,
      tiers: savedTiers,
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
