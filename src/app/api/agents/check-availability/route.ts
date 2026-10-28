import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/agents/check-availability
 * Check how many properties match the user's criteria
 * Called by ElevenLabs agent via webhook tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      budgetMin, 
      budgetMax, 
      areas = [], 
      bedroomsMin,
      transactionType = 'rent' 
    } = body;

    console.log('[check-availability] Request:', { budgetMin, budgetMax, areas, bedroomsMin, transactionType });

    const supabase = await getSupabaseServer();

    // Build query to count matching properties
    let query = supabase
      .from("listings")
      .select("id, title, city, price_eur, bedrooms", { count: 'exact' });

    // Filter by price
    if (budgetMax) {
      query = query.lte("price_eur", budgetMax);
    }
    if (budgetMin) {
      query = query.gte("price_eur", budgetMin);
    }

    // Filter by bedrooms
    if (bedroomsMin) {
      query = query.gte("bedrooms", bedroomsMin);
    }

    // Filter by areas (city or address contains area name)
    // For now, we'll do a simple check - in production you'd want proper geocoding
    if (areas.length > 0) {
      // Create OR condition for areas
      const areaFilters = areas.map((area: string) => 
        `city.ilike.%${area}%,address.ilike.%${area}%`
      ).join(',');
      query = query.or(areaFilters);
    }

    const { data: properties, count, error } = await query.limit(50);

    if (error) {
      console.error('[check-availability] DB error:', error);
      return NextResponse.json({ 
        hasEnough: false, 
        count: 0, 
        error: error.message 
      });
    }

    const matchCount = count || 0;
    const hasEnough = matchCount >= 10;

    // Generate flexibility suggestions if not enough properties
    let flexibilityAnalysis: Array<{
      type: string;
      question_es: string;
      question_en: string;
      impact: string;
    }> = [];

    if (!hasEnough) {
      // Suggest budget flexibility
      if (budgetMax) {
        const stretchBudget = Math.round(budgetMax * 1.15);
        flexibilityAnalysis.push({
          type: 'budget',
          question_es: `¿Podrías estirar el presupuesto hasta €${stretchBudget.toLocaleString()}?`,
          question_en: `Could you stretch the budget to €${stretchBudget.toLocaleString()}?`,
          impact: 'high'
        });
      }

      // Suggest area flexibility
      if (areas.length > 0) {
        // In production, you'd look up adjacent neighborhoods
        flexibilityAnalysis.push({
          type: 'location',
          question_es: `¿Considerarías barrios cercanos a ${areas[0]}?`,
          question_en: `Would you consider neighborhoods near ${areas[0]}?`,
          impact: 'high'
        });
      }

      // Suggest bedroom flexibility
      if (bedroomsMin && bedroomsMin > 1) {
        flexibilityAnalysis.push({
          type: 'bedrooms',
          question_es: `¿Funcionaría con ${bedroomsMin - 1} habitaciones?`,
          question_en: `Would ${bedroomsMin - 1} bedrooms work?`,
          impact: 'medium'
        });
      }

      // Sort by impact
      flexibilityAnalysis.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.impact as keyof typeof order] || 2) - (order[b.impact as keyof typeof order] || 2);
      });
    }

    // Get matched locations for context
    const matchedLocations = [...new Set(properties?.map(p => p.city).filter(Boolean))].slice(0, 5);

    const response = {
      hasEnough,
      count: matchCount,
      matchedLocations,
      flexibilityAnalysis,
      searchCriteria: {
        budgetMin,
        budgetMax,
        areas,
        bedroomsMin,
        transactionType
      }
    };

    console.log('[check-availability] Response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error("[check-availability] Error:", error);
    return NextResponse.json({ 
      hasEnough: false, 
      count: 0, 
      error: "Failed to check availability" 
    });
  }
}

