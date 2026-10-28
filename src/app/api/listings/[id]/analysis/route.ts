import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_AI_API_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    // Get cluster analyses from room_analyses table
    const { data: clusterAnalyses, error: clusterError } = await supabase
      .from('room_analyses')
      .select('analysis_data')
      .eq('listing_id', listingId)
      .single();

    if (clusterError || !clusterAnalyses) {
      throw new Error(`Failed to fetch cluster analyses: ${clusterError?.message || 'No data found'}`);
    }

    // Get whole property analysis from whole_property_analysis table
    const { data: wholePropertyAnalysis, error: wholePropertyError } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data')
      .eq('listing_id', listingId)
      .single();

    if (wholePropertyError) {
      throw new Error(`Failed to fetch whole property analysis: ${wholePropertyError.message}`);
    }

    // Get text analysis results for additional context
    const { data: textAnalysis, error: textAnalysisError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .in('phase', ['integrated_summary', 'c1_unknowns', 'c2_followups'])
      .single();

    if (textAnalysisError) {
      throw new Error('No text analysis data found.');
    }

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        title, address, price_eur, sqm, bedrooms, bathrooms, description,
        floor_level, floor_number, orientation, property_condition,
        property_subtype, housing_situation, ad_origin,
        has_elevator, has_terrace, has_balcony, has_pool, has_garage, has_garden,
        balcony_orientation, terrace_orientation
      `)
      .eq('id', listingId)
      .single();

    if (listingError) {
      throw new Error('No listing data found.');
    }

    // Prepare synthesis context
    const synthesisContext = {
      property: {
        title: listing.title,
        address: listing.address,
        price: listing.price_eur,
        area: listing.sqm,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        type: listing.property_subtype,
        floor: `${listing.floor_level} ${listing.floor_number ? `(${listing.floor_number})` : ''}`,
        orientation: listing.orientation,
        condition: listing.property_condition,
        features: [
            listing.has_elevator ? 'Ascensor' : null,
            listing.has_terrace ? `Terraza (${listing.terrace_orientation || 'Unknown'})` : null,
            listing.has_balcony ? `Balcón (${listing.balcony_orientation || 'Unknown'})` : null,
            listing.has_pool ? 'Piscina' : null,
            listing.has_garage ? 'Garaje' : null,
            listing.has_garden ? 'Jardín' : null
        ].filter(Boolean).join(', ')
      },
      wholePropertyAnalysis: wholePropertyAnalysis?.analysis_data || wholePropertyAnalysis,
      clusterAnalyses: Array.isArray(clusterAnalyses?.analysis_data) 
        ? clusterAnalyses.analysis_data.map((ca: any) => ({
            room: ca.room_name || ca.cluster_name || 'Unknown',
        type: 'room',
        analysis: {
              summary: ca.summary || ca.analysis_summary || '',
              suggestions: ca.suggestions || ca.recommendations || []
        }
          }))
        : [],
      extraction: {
        headlines: textAnalysis?.results?.headlines || [],
        unknowns: textAnalysis?.results?.unknowns || [],
        followups: textAnalysis?.results?.followups || []
      }
    };

    // Generate integrated analysis using Gemini 2.5 Pro
    const synthesisPrompt = `
Sintetiza un análisis integral de esta propiedad española basándote en todos los análisis previos.

DATOS DE LA PROPIEDAD:
- Título: ${synthesisContext.property.title}
- Dirección: ${synthesisContext.property.address}
- Precio: €${synthesisContext.property.price?.toLocaleString() || 'N/A'}
- Área: ${synthesisContext.property.area || 'N/A'} m²
- Dormitorios: ${synthesisContext.property.bedrooms || 'N/A'}
- Baños: ${synthesisContext.property.bathrooms || 'N/A'}
    - Tipo: ${synthesisContext.property.type || 'N/A'}
    - Planta: ${synthesisContext.property.floor || 'N/A'}
    - Orientación: ${synthesisContext.property.orientation || 'N/A'}
    - Estado: ${synthesisContext.property.condition || 'N/A'}
    - Características: ${synthesisContext.property.features || 'N/A'}

ANÁLISIS DE PROPIEDAD COMPLETA:
${JSON.stringify(synthesisContext.wholePropertyAnalysis, null, 2)}

ANÁLISIS POR HABITACIONES:
${synthesisContext.clusterAnalyses.map((ca: any) => `
HABITACIÓN: ${ca.room} (${ca.type})
${JSON.stringify(ca.analysis, null, 2)}
`).join('\n')}

DATOS ADICIONALES:
- Titulares: ${JSON.stringify(synthesisContext.extraction.headlines)}
- Desconocidos: ${JSON.stringify(synthesisContext.extraction.unknowns)}
- Seguimientos: ${JSON.stringify(synthesisContext.extraction.followups)}

Proporciona un análisis integrado y sintético en español que combine todos estos elementos:

1. RESUMEN EJECUTIVO: Visión general de la propiedad
2. ANÁLISIS INTEGRADO: Cómo se relacionan los análisis por habitación con el análisis general
3. PRIORIDADES DE RENOVACIÓN: Orden de prioridades basado en todos los análisis
4. ESTIMACIÓN DE COSTES TOTALES: Rango de costes para diferentes niveles de renovación
5. RECOMENDACIONES ESTRATÉGICAS: Consejos para maximizar valor
6. RIESGOS Y CONSIDERACIONES: Aspectos a tener en cuenta
7. PLAN DE ACCIÓN: Pasos recomendados

Formato JSON:
{
  "executive_summary": "string",
  "integrated_analysis": "string",
  "renovation_priorities": [
    {
      "priority": 1,
      "area": "string",
      "description": "string",
      "estimated_cost": "string",
      "timeline": "string"
    }
  ],
  "total_cost_estimation": {
    "minimal": "string",
    "standard": "string", 
    "premium": "string"
  },
  "strategic_recommendations": ["string"],
  "risks_and_considerations": ["string"],
  "action_plan": ["string"],
  "investment_potential": "string"
}
`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { 
          temperature: 0.2,
          topP: 0.7,
          topK: 40,
          maxOutputTokens: 6144
        },
        contents: [{ parts: [{ text: synthesisPrompt }]}]
      })
    });

    const geminiData = await geminiResponse.json();
    const synthesisText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let integratedAnalysis;
    try {
      const cleanText = synthesisText.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
      integratedAnalysis = JSON.parse(cleanText);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      integratedAnalysis = {
        executive_summary: synthesisText.substring(0, 500),
        integrated_analysis: 'Análisis integrado generado por IA',
        renovation_priorities: [{
          priority: 1,
          area: 'General',
          description: 'Análisis en progreso',
          estimated_cost: 'Por determinar',
          timeline: 'Por evaluar'
        }],
        total_cost_estimation: {
          minimal: 'Por determinar',
          standard: 'Por determinar',
          premium: 'Por determinar'
        },
        strategic_recommendations: ['Revisar análisis completo'],
        risks_and_considerations: ['Verificar datos'],
        action_plan: ['Completar análisis'],
        investment_potential: 'Por evaluar'
      };
    }

    // Integrated analysis doesn't need to be saved to room_analyses
    // It's used for the deep dive generation

    return NextResponse.json({
      success: true,
      analysis: integratedAnalysis,
      message: 'Integrated analysis completed successfully'
    });

  } catch (error) {
    console.error('Integrated analysis error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: (error as any)?.message || 'Integrated analysis failed' 
      },
      { status: 500 }
    );
  }
}
