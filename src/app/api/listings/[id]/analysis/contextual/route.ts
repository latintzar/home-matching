import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { contextualAnalysisValidator, ContextualAnalysisOutput } from '@/lib/schemas/contextual-analysis.schema';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    console.log(`🔍 Starting contextual analysis for listing ${listingId}`);
    const body = await req.json().catch(() => ({}));

    // ========================================================================
    // STEP 1: Verify final renovation scope exists (Phase 4 requirement)
    // ========================================================================
    console.log(`📊 Fetching final scope for listing ${listingId}...`);
    const listingIdNum = parseInt(listingId, 10);
    if (isNaN(listingIdNum)) {
      return NextResponse.json(
        { success: false, error: 'invalid_listing_id', message: 'Invalid listing ID format' },
        { status: 400 }
      );
    }
    
    const { data: finalScopeData, error: finalScopeError } = await supabase
      .from('final_renovation_scope')
      .select('scope_data')
      .eq('listing_id', listingIdNum)
      .single();

    if (finalScopeError) {
      console.error('❌ Error fetching final scope:', finalScopeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'final_scope_not_found',
          message: 'Final renovation scope not found. Run renovation-scope-finalize first.',
          details: finalScopeError.message
        },
        { status: 404 }
      );
    }

    if (!finalScopeData || !finalScopeData.scope_data) {
      console.error('❌ Final scope data is missing');
      return NextResponse.json(
        { 
          success: false, 
          error: 'final_scope_not_found',
          message: 'Final renovation scope data is empty.'
        },
        { status: 404 }
      );
    }

    const finalScope = finalScopeData.scope_data;
    console.log(`✅ Final scope fetched, has tiers: ${!!finalScope.tiers}`);

    // Validate final scope structure
    if (!finalScope || !finalScope.tiers) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'invalid_final_scope',
          message: 'Final scope structure is invalid. Missing tiers.'
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // STEP 2: Fetch property details (foundation)
    // ========================================================================
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, city, region, country, address, scraped_data, source_url, price_eur, floor_number, property_type')
      .eq('id', listingIdNum)
      .single();

    // Extract property details
    const propertyDetails = {
      title: listing?.title,
      address: listing?.address,
      city: listing?.city,
      region: listing?.region,
      country: listing?.country,
      price_eur: listing?.price_eur,
      constructed_area: listing?.scraped_data?.areas?.constructed,
      useful_area: listing?.scraped_data?.areas?.useful,
      bedrooms: listing?.scraped_data?.bedrooms,
      bathrooms: listing?.scraped_data?.bathrooms,
      year_built: listing?.scraped_data?.yearBuilt,
      floor: listing?.floor_number,
      property_type: listing?.property_type,
      source_url: listing?.source_url
    };

    // ========================================================================
    // STEP 3: Fetch integrated analysis (house characteristics)
    // ========================================================================
    const { data: integratedAnalysis } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingIdNum)
      .eq('phase', 'integrated_diagnostic')
      .single();

    // ========================================================================
    // STEP 4: Fetch curated research from analysis Google search (step F)
    // ========================================================================
    const { data: curatedResearch } = await supabase
      .from('analysis_curated_results')
      .select('category, summary, key_points, representative_snippets, sources_used, confidence_level')
      .eq('listing_id', listingIdNum);

    // Group curated research by category for easy lookup
    const curatedByCategory: Record<string, any> = {};
    (curatedResearch || []).forEach((r: any) => {
      if (r.category) {
        curatedByCategory[r.category] = r;
      }
    });

    // Note: We intentionally do NOT include work intents or tier structure here.
    // The tiers shaped our research queries (Pareto principle for what to search),
    // but contextual analysis describes the environment around THIS HOUSE,
    // not tied to any specific renovation plan.

    const categoriesList = [
      'permits', 'contractors', 'seasonality', 'community_rules', 'norms_standards', 'market_practices',
      'utilities_infrastructure', 'logistics_access', 'waste_management', 'noise_environment', 'cost_context', 'scheduling_windows'
    ];

    // Format integrated analysis for prompt
    const integratedAnalysisText = integratedAnalysis?.results 
      ? (typeof integratedAnalysis.results === 'string' 
          ? integratedAnalysis.results 
          : JSON.stringify(integratedAnalysis.results, null, 2))
      : 'N/A';

    const prompt = `Eres un analista senior que escribe en español para compradores. Usa tono claro, conciso y útil.

Tu tarea: generar un "Análisis Contextual" reno‑agnóstico en 12 categorías, interpretado para ESTE inmueble, ESTE año.

IMPORTANTE: Este análisis describe el entorno contextual alrededor de ESTA CASA (permisos, contratistas, costes, estacionalidad, etc.), NO está vinculado a ningún plan de renovación específico. Es contexto relevante para compradores que consideran esta propiedad.

ENFOQUE DE SÍNTESIS (estilo analista senior, no intern):
- Sintetiza la investigación curada para construir un análisis coherente y bien fundamentado.
- Usa múltiples fuentes de la investigación para informar tu razonamiento, pero NO las cites una por una como un intern ("esta fuente dice X, esa fuente dice Y").
- En su lugar, teje una narrativa que muestre tu entendimiento del contexto, haciendo saltos educados basados en la investigación.
- El objetivo es que el lector confíe en tu síntesis profesional y pueda verificar tus fuentes cuando lo necesite.
- Usa tantas fuentes como necesites para construir un argumento bien fundamentado, pero sintetízalas en un análisis coherente.

Reglas:
- 3-5 frases de "stance" por categoría que integre TODA la información relevante (qué implica aquí y ahora para esta propiedad, riesgos, plazos, clase de licencia, estacionalidad, orden de magnitud de coste, etc.) en un párrafo fluido y coherente. Sintetiza, no cites.
- NO uses bullets separados ("signals") - toda la información debe estar integrada en el párrafo stance.
- Incluye "evidence": fuentes con URL (dominios reales) y snippet breve. Esto es para atribución y verificación, no es el contenido principal. Usa las fuentes más relevantes que respaldan tu análisis sintetizado.
- Usa la investigación curada proporcionada extensivamente. Tienes acceso a múltiples fuentes por categoría - úsalas para construir un análisis bien fundamentado.
- Contextualiza basándote en las características de la casa (tamaño, edad, tipo, ubicación) y su estado (materiales, distribución, etc.).
- Devuelve SOLO JSON con esta estructura exacta:
{
  "categories": [
    {
      "category": "permits",
      "stance": "3-5 frases que integren toda la información relevante (qué implica aquí y ahora, riesgos, plazos, clase de licencia, estacionalidad, orden de magnitud de coste, etc.) en un párrafo fluido. NO uses bullets separados.",
      "evidence": [{"url": "...", "snippet": "..."}],
      "confidence": "high|medium|low"
    }
  ]
}
- Español por defecto.

Categorías exactas (12): ${categoriesList.join(', ')}.

PROPERTY_DETAILS (hechos fundamentales de la propiedad):
${JSON.stringify(propertyDetails, null, 2)}

INTEGRATED_ANALYSIS (características de esta casa):
${integratedAnalysisText}

CURATED_RESEARCH (entorno contextual por categoría):
${JSON.stringify(curatedByCategory, null, 2)}

Devuelve JSON válido con estructura exacta mostrada arriba.`;

    // Define response schema matching ContextualAnalysisOutput
    const responseSchema = {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              stance: { type: 'string' },
              signals: {
                type: 'array',
                items: { type: 'string' },
                minItems: 0
              },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', nullable: true },
                    url: { type: 'string' },
                    title: { type: 'string', nullable: true },
                    publisher: { type: 'string', nullable: true },
                    date: { type: 'string', nullable: true },
                    snippet: { type: 'string', nullable: true },
                    confidence: { 
                      type: 'string', 
                      enum: ['high', 'medium', 'low'],
                      nullable: true
                    }
                  },
                  required: ['url']
                },
                minItems: 0
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low']
              }
            },
            required: ['category', 'stance', 'signals', 'evidence', 'confidence']
          }
        }
      },
      required: ['categories'],
      propertyOrdering: ['categories']
    };

    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 32768 },
      maxOutputTokens: 32768, // Double the output tokens (was 16384)
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      console.error('❌ Gemini call failed:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: 'contextual_generation_failed',
        details: result.error 
      }, { status: 500 });
    }

    let parsed: any;
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
      console.log(`📊 Parsed response structure:`, Object.keys(parsed || {}));
      console.log(`📊 Categories type:`, typeof parsed?.categories, Array.isArray(parsed?.categories) ? `array with ${parsed.categories.length} items` : 'not array');
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw response (first 500 chars):', result.text.substring(0, 500));
      return NextResponse.json({ 
        success: false, 
        error: 'invalid_json',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 422 });
    }

    // With structured output, categories should be directly available
    const categories = Array.isArray(parsed?.categories) ? parsed.categories : [];
    console.log(`📋 Parsed ${categories.length} categories from AI response`);
    
    const enriched: ContextualAnalysisOutput = {
      listing_id: String(listingId),
      generated_at: new Date().toISOString(),
      categories: categories,
    };

    if (!contextualAnalysisValidator(enriched)) {
      return NextResponse.json({ success: false, error: 'schema_validation_failed', details: contextualAnalysisValidator.errors }, { status: 422 });
    }

    // Persist contextual result
    const payload = enriched;

    const { error: upsertErr } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingIdNum,
        phase: 'contextual',
        results: payload,
      }, { onConflict: 'listing_id,phase' });

    if (upsertErr) {
      return NextResponse.json({ success: false, error: 'persist_failed', details: upsertErr.message }, { status: 500 });
    }

    console.log(`✅ Contextual analysis completed for listing ${listingId}`);
    return NextResponse.json({ success: true, data: payload });
  } catch (e: any) {
    console.error(`❌ Contextual analysis error:`, e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'unknown_error',
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    }, { status: 500 });
  }
}


