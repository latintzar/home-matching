import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_AI_API_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Get text analysis results
    const { data: textAnalysis, error: textAnalysisError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', id)
      .in('phase', ['a2_facts', 'b3_snippets', 'c1_unknowns'])
      .order('created_at', { ascending: true });

    if (textAnalysisError || !textAnalysis || textAnalysis.length === 0) {
      return NextResponse.json({ error: 'Text analysis data not found' }, { status: 404 });
    }

    // Get analysis data if available
    const { data: wholePropertyAnalysis } = await supabase
      .from('room_analyses')
      .select('analysis_data')
      .eq('listing_id', id)
      .eq('analysis_type', 'whole_property')
      .single();

    const { data: integratedAnalysis } = await supabase
      .from('room_analyses')
      .select('analysis_data')
      .eq('listing_id', id)
      .eq('analysis_type', 'integrated')
      .single();

    // Generate renovation tiers using Gemini 2.5 Pro
    const renovationPrompt = `
Genera 3 niveles de renovación para esta propiedad española basándote en todos los datos disponibles.

DATOS DE LA PROPIEDAD:
- Título: ${listing.title}
- Dirección: ${listing.address}
- Precio: €${listing.price_eur?.toLocaleString() || 'N/A'}
- Área: ${listing.sqm || 'N/A'} m²
- Dormitorios: ${listing.bedrooms || 'N/A'}
- Baños: ${listing.bathrooms || 'N/A'}
- Descripción: ${listing.description || 'N/A'}

DATOS DE EXTRACCIÓN:
- Afirmaciones: ${JSON.stringify(textAnalysis?.find(t => t.phase === 'a2_facts')?.results?.claims?.slice(0, 20) || [])}
- Categorías: ${JSON.stringify(textAnalysis?.find(t => t.phase === 'b3_snippets')?.results?.categorySnippets || {})}
- Resumen: ${JSON.stringify(textAnalysis?.find(t => t.phase === 'integrated_summary')?.results?.bullets || [])}
- Desconocidos: ${JSON.stringify(textAnalysis?.find(t => t.phase === 'c1_unknowns')?.results?.unknownsChecklist || [])}

ANÁLISIS DISPONIBLE:
${wholePropertyAnalysis ? `Análisis de propiedad completa: ${JSON.stringify(wholePropertyAnalysis.analysis_data)}` : 'No disponible'}
${integratedAnalysis ? `Análisis integrado: ${JSON.stringify(integratedAnalysis.analysis_data)}` : 'No disponible'}

Genera 3 niveles de renovación en español:

1. LIVABLE (Habitabilidad básica): Renovación mínima para hacer la propiedad habitable
2. COMFORTABLE (Confort): Renovación estándar con mejoras de confort
3. COMPETITIVE (Competitivo): Renovación premium para hacer la propiedad competitiva en el mercado

Para cada nivel, proporciona:
- work_item: Descripción del trabajo
- trade: Profesional necesario
- permit_impact: 'none', 'minor', 'major', o 'major_structural'
- time_min_months: Tiempo mínimo en meses
- time_max_months: Tiempo máximo en meses  
- cost_min_eur: Coste mínimo en euros
- cost_max_eur: Coste máximo en euros

Formato JSON:
{
  "tiers": [
    {
      "tier": "livable",
      "work_items": [
        {
          "work_item": "string",
          "trade": "string", 
          "permit_impact": "string",
          "time_min_months": number,
          "time_max_months": number,
          "cost_min_eur": number,
          "cost_max_eur": number
        }
      ]
    }
  ]
}
`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { 
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        },
        contents: [{ parts: [{ text: renovationPrompt }]}]
      })
    });

    const geminiData = await geminiResponse.json();
    const renovationText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let renovationTiers;
    try {
      const cleanText = renovationText.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
      renovationTiers = JSON.parse(cleanText);
    } catch (parseError) {
      // Fallback to default tiers if parsing fails
      renovationTiers = {
        tiers: [
          {
            tier: "livable",
            work_items: [
              { work_item: "Pintura de paredes y techos", trade: "Pintor", permit_impact: "none", time_min_months: 0.5, time_max_months: 1, cost_min_eur: 2000, cost_max_eur: 4000 },
              { work_item: "Renovación de suelos", trade: "Solador", permit_impact: "none", time_min_months: 1, time_max_months: 2, cost_min_eur: 3000, cost_max_eur: 6000 },
              { work_item: "Actualización de baños", trade: "Fontanero", permit_impact: "minor", time_min_months: 1, time_max_months: 2, cost_min_eur: 5000, cost_max_eur: 10000 }
            ]
          },
          {
            tier: "comfortable", 
            work_items: [
              { work_item: "Reforma de cocina completa", trade: "Carpintero", permit_impact: "minor", time_min_months: 2, time_max_months: 3, cost_min_eur: 8000, cost_max_eur: 15000 },
              { work_item: "Mejora de aislamiento", trade: "Aislamiento", permit_impact: "none", time_min_months: 1, time_max_months: 2, cost_min_eur: 3000, cost_max_eur: 6000 }
            ]
          },
          {
            tier: "competitive",
            work_items: [
              { work_item: "Acabados de alta gama", trade: "Acabados", permit_impact: "major", time_min_months: 2, time_max_months: 4, cost_min_eur: 10000, cost_max_eur: 20000 },
              { work_item: "Sistemas domóticos", trade: "Domótica", permit_impact: "minor", time_min_months: 1, time_max_months: 2, cost_min_eur: 5000, cost_max_eur: 10000 }
            ]
          }
        ]
      };
    }

    // Save AI-generated renovation data to tier_scope table
    const tierScopes = [];
    let displayOrder = 0;
    
    // Also prepare data for final_renovation_scope (UI source of truth)
    const finalScopeData: any = {
      tiers: {}
    };

    const tierMap: Record<string, string> = {
      'livable': 'estandar',
      'comfortable': 'optimo',
      'competitive': 'plus'
    };
    
    for (const tier of renovationTiers.tiers) {
      // tier_scope row generation (legacy)
      for (const workItem of tier.work_items) {
        tierScopes.push({
          listing_id: id,
          tier: tier.tier,
          work_item: workItem.work_item,
          trade: workItem.trade,
          permit_impact: workItem.permit_impact,
          time_min_months: workItem.time_min_months,
          time_max_months: workItem.time_max_months,
          cost_min_eur: workItem.cost_min_eur,
          cost_max_eur: workItem.cost_max_eur,
          display_order: displayOrder++
        });
      }

      // final_renovation_scope generation (production UI)
      const targetTierKey = tierMap[tier.tier] || tier.tier; // estandar, optimo, plus
      
      // Calculate totals
      const totalMin = tier.work_items.reduce((sum: number, item: any) => sum + (item.cost_min_eur || 0), 0);
      const totalMax = tier.work_items.reduce((sum: number, item: any) => sum + (item.cost_max_eur || 0), 0);
      
      // Calculate timeline (max of max months)
      const maxMonths = Math.max(...tier.work_items.map((item: any) => item.time_max_months || 0));
      const minMonths = Math.min(...tier.work_items.map((item: any) => item.time_min_months || 0));
      
      finalScopeData.tiers[targetTierKey] = {
        summary: `Renovación ${targetTierKey} basada en análisis AI`,
        total_estimate_eur: Math.round((totalMin + totalMax) / 2),
        total_estimate_range_eur: [totalMin, totalMax],
        timeline_weeks: [Math.round(minMonths * 4.3), Math.round(maxMonths * 4.3)], // Convert months to weeks
        work_items: tier.work_items.map((item: any) => ({
          summary: item.work_item,
          details: `${item.trade} - ${item.permit_impact}`,
          cost_eur: Math.round(((item.cost_min_eur || 0) + (item.cost_max_eur || 0)) / 2),
          quantity: 1,
          unit: "global"
        }))
      };
    }

    // Insert all tier scopes (legacy table)
    const { error: tierScopeError } = await supabase
      .from('tier_scope')
      .insert(tierScopes);

    if (tierScopeError) {
      console.error('Failed to save tier scopes:', tierScopeError);
      // Continue anyway to save to final_renovation_scope
    }

    // Upsert to final_renovation_scope (UI source of truth)
    console.log('Saving to final_renovation_scope for UI visibility...');
    const { error: finalScopeError } = await supabase
      .from('final_renovation_scope')
      .upsert({
        listing_id: parseInt(id, 10), // Ensure integer for this table
        scope_data: finalScopeData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'listing_id' });

    if (finalScopeError) {
      console.error('Failed to save final renovation scope:', finalScopeError);
      return NextResponse.json({ error: 'Failed to save renovation tiers to UI table' }, { status: 500 });
    }

    // Generate intelligent consideraciones using AI
    const consideracionesPrompt = `
Genera consejos inteligentes para esta propiedad española basándote en todos los datos disponibles.

DATOS DE LA PROPIEDAD:
- Título: ${listing.title}
- Dirección: ${listing.address}
- Precio: €${listing.price_eur?.toLocaleString() || 'N/A'}
- Área: ${listing.sqm || 'N/A'} m²
- Dormitorios: ${listing.bedrooms || 'N/A'}
- Baños: ${listing.bathrooms || 'N/A'}

DATOS DE EXTRACCIÓN:
- Afirmaciones: ${JSON.stringify(textAnalysis?.find((t: any) => t.phase === 'a2_facts')?.results?.claims?.slice(0, 20) || [])}
- Categorías: ${JSON.stringify(textAnalysis?.find((t: any) => t.phase === 'b3_snippets')?.results?.categorySnippets || {})}
- Titulares: ${JSON.stringify(textAnalysis?.find((t: any) => t.phase === 'a2_facts')?.results?.headlines || [])}
- Desconocidos: ${JSON.stringify(textAnalysis?.find((t: any) => t.phase === 'c1_unknowns')?.results?.unknownsChecklist || [])}

NIVELES DE RENOVACIÓN GENERADOS:
${JSON.stringify(renovationTiers, null, 2)}

Genera consejos inteligentes en español para:

1. tier_specific_advice: Consejos específicos para cada nivel (livable, comfortable, competitive)
2. general_advice: Consejos generales sobre la propiedad
3. investigation_checklist: Lista de cosas que el comprador debe verificar

Formato JSON:
{
  "tier_specific_advice": {
    "livable": ["string"],
    "comfortable": ["string"], 
    "competitive": ["string"]
  },
  "general_advice": ["string"],
  "investigation_checklist": ["string"]
}
`;

    const consideracionesResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { 
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        },
        contents: [{ parts: [{ text: consideracionesPrompt }]}]
      })
    });

    const consideracionesData = await consideracionesResponse.json();
    const consideracionesText = consideracionesData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('Consideraciones AI response:', consideracionesText.substring(0, 200));
    
    let consideraciones;
    try {
      const cleanText = consideracionesText.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
      consideraciones = JSON.parse(cleanText);
      console.log('Consideraciones parsed successfully:', Object.keys(consideraciones));
    } catch (parseError) {
      console.log('Consideraciones parsing failed, using fallback');
      // Fallback if parsing fails
      consideraciones = {
        tier_specific_advice: {
          livable: ["Enfoque en habitabilidad básica", "Maximizar el presupuesto disponible"],
          comfortable: ["Equilibrio entre calidad y coste", "Mejoras que añaden valor"],
          competitive: ["Acabados premium", "Características únicas"]
        },
        general_advice: [
          "La propiedad requiere análisis detallado antes de la compra",
          "Considerar el potencial de valorización a largo plazo",
          "Evaluar la ubicación y accesibilidad"
        ],
        investigation_checklist: [
          "Verificar estado de las instalaciones eléctricas",
          "Revisar el sistema de calefacción",
          "Evaluar el aislamiento térmico",
          "Comprobar la fontanería"
        ]
      };
    }

    // Save AI-generated consideraciones (upsert to handle existing records)
    console.log('Saving consideraciones for listing:', id);
    console.log('Consideraciones data:', JSON.stringify(consideraciones, null, 2));
    
    const { error: consideracionesError } = await supabase
      .from('intelligent_consideraciones')
      .upsert({
        listing_id: id,
        tier_specific_advice: consideraciones.tier_specific_advice,
        general_advice: consideraciones.general_advice,
        investigation_checklist: consideraciones.investigation_checklist,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (consideracionesError) {
      console.error('Failed to save consideraciones:', consideracionesError);
      console.error('Error details:', JSON.stringify(consideracionesError, null, 2));
      return NextResponse.json({ error: 'Failed to save consideraciones' }, { status: 500 });
    }
    
    console.log('Consideraciones saved successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Deep dive generated successfully with AI',
      renovationTiers,
      consideraciones
    });

  } catch (error) {
    console.error('Deep dive generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deep dive generation failed' },
      { status: 500 }
    );
  }
}
