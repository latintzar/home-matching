import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
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
 * Qué Verificar Endpoint
 * 
 * Generates a prioritized checklist of items to verify during a property visit.
 * Uses the buyer report (house diagnostics, contextual analysis, room findings) to
 * generate specific, actionable verification items with links to report sections.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    const listingIdNum = parseInt(listingId, 10);
    
    if (isNaN(listingIdNum)) {
      return NextResponse.json(
        { success: false, error: 'invalid_listing_id', message: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    console.log(`📋 Generating verify checklist for listing ${listingId}`);

    // Fetch buyer report (contains house diagnostics, contextual analysis, room findings)
    const { data: buyerReportData, error: buyerReportError } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'buyer_report')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (buyerReportError || !buyerReportData) {
      return NextResponse.json(
        {
          success: false,
          error: 'buyer_report_not_found',
          message: 'Buyer report not found. Run /analysis/final-scope first.',
          details: buyerReportError?.message
        },
        { status: 404 }
      );
    }

    const buyerReport = buyerReportData.results as any;

    // ========================================================================
    // STEP 1.5: Fetch General Research Results (J-General) - Optional but recommended
    // ========================================================================
    console.log(`📊 Fetching general research results for verification checklist...`);
    const { data: generalResearchData, error: generalResearchError } = await supabase
      .from('general_research_results')
      .select('category, report_data')
      .eq('listing_id', listingIdNum)
      .in('category', [
        'general_permits',
        'laws_regulations',
        'norms_standards',
        'general_costs',
        'general_timings'
      ]);

    const generalResearch: Record<string, any> = {};
    if (generalResearchData && !generalResearchError) {
      generalResearchData.forEach((item: any) => {
        generalResearch[item.category] = item.report_data;
      });
      console.log(`✅ Loaded ${generalResearchData.length} general research categories for verification`);
    } else {
      console.warn(`⚠️ No general research results found (J-General may not have run yet - verification will be less complete)`);
    }

    // Extract key sections for verification generation (new 3-Chapter structure)
    const forensicRiskAudit = buyerReport?.forensic_risk_audit || {};
    const executionRealityCheck = buyerReport?.execution_reality_check || {};
    const financialIntelligence = buyerReport?.financial_intelligence || {};
    const roomByRoom = buyerReport?.execution_reality_check?.room_by_room || [];
    const propertyInfo = buyerReport?.property_info || {};
    
    // Extract uncertainties from room-by-room analysis (they're embedded per-room, not top-level)
    const roomUncertainties = roomByRoom
      .filter((room: any) => room.uncertainties && room.uncertainties.length > 0)
      .map((room: any) => ({
        room_id: room.room_id,
        room_name: room.room_name,
        uncertainties: room.uncertainties
      }));

    // Fetch photo clusters to map room_id to real photo URLs
    const { data: clusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, cluster_name, photo_urls')
      .eq('listing_id', listingIdNum)
      .order('display_order', { ascending: true });

    // Create mapping: room_id (cluster ID) -> photo URLs
    const roomIdToPhotoUrls = new Map<string, string[]>();
    if (clusters && !clustersError) {
      clusters.forEach((cluster: any) => {
        const clusterId = cluster.id.toString();
        const photoUrls = Array.isArray(cluster.photo_urls) ? cluster.photo_urls : [];
        roomIdToPhotoUrls.set(clusterId, photoUrls);
      });
    }

    const prompt = `Eres un asesor senior que genera una lista de "Qué verificar" para una visita a una propiedad. 
Escribe en español, con tono cercano, equilibrado y pragmático.

TONO (MUY IMPORTANTE):
- Suena cercano, profesional y pragmático. Nada catastrofista.
- Reconoce lo bueno ("la casa tiene cosas muy buenas"), y matiza con calma lo que conviene comprobar.
- Usa un registro natural: "bueno", "normal para la edad", "con un plan y buen oficio se deja muy bien".
- Evita dramatizar; si hay algo importante, dilo claro pero sin alarmismo.
- Construye confianza: si no se confirma en la visita, "se apunta, se pide documento y se sigue el plan".
- Concluye implícitamente "se puede" (no bloquea la operación, solo pide orden y detalle).
- Español natural de España; frases cortas y claras.

TAREA:
Genera EXACTAMENTE 5 puntos de verificación prioritarios basados en el informe del comprador.

FUENTES DE INFORMACIÓN (Nueva estructura de 3 Capítulos):

1. 🛡️ CAPÍTULO 1: ANÁLISIS FORENSE DE RIESGOS (forensic_risk_audit):
${JSON.stringify(forensicRiskAudit, null, 2)}
NOTA: Incluye patología estructural, hostilidad ambiental, contexto social/seguridad, y legalidad urbanística. Las "red_flags" son críticas para verificación. Las incertidumbres están integradas en el texto (ej: "se desconoce", "no visible en fotos", "requiere verificación").

2. 🛠️ CAPÍTULO 2: REALIDAD DE EJECUCIÓN (execution_reality_check):
${JSON.stringify(executionRealityCheck, null, 2)}
NOTA: Incluye realidad de renovación (costos, plazos, permisos), infraestructura, y análisis habitación por habitación. Identifica restricciones y requisitos que necesitan verificación (permisos, normas comunidad, costos reales, etc.).

3. 💰 CAPÍTULO 3: INTELIGENCIA FINANCIERA (financial_intelligence):
${JSON.stringify(financialIntelligence, null, 2)}
NOTA: Incluye costos ocultos (OpEx), incentivos, y contexto de mercado. Úsalo para verificar costos reales y oportunidades financieras.

4. ANÁLISIS HABITACIÓN POR HABITACIÓN (room_by_room dentro de execution_reality_check):
${JSON.stringify(roomByRoom, null, 2)}
NOTA: Cada habitación puede tener un array "uncertainties" con incertidumbres específicas de esa habitación, y "renovation_costs" con costos específicos.

5. INCERTIDUMBRES POR HABITACIÓN (extraídas):
${JSON.stringify(roomUncertainties, null, 2)}

6. INFORMACIÓN DE LA PROPIEDAD:
${JSON.stringify(propertyInfo, null, 2)}

7. INVESTIGACIÓN GENERAL (ahora parte de G - Double-Barrel) - Costos, tiempos, permisos, leyes, normas:
${Object.keys(generalResearch).length > 0 ? JSON.stringify(generalResearch, null, 2) : 'No disponible (la investigación general ahora está integrada en G - Double-Barrel Hybrid Engine)'}
NOTA: Usa esta información para:
- Verificaciones de permisos (general_permits)
- Requisitos legales y normativos (laws_regulations, norms_standards)
- Estimaciones de orden de magnitud (general_costs, general_timings) para items de verificación

IMPORTANTE: Las incertidumbres están dispersas por el informe en la nueva estructura de 3 capítulos:
- Capítulo 1 (Forensic Risk Audit): Integradas en el texto de cada sub-sección (structural_pathology, environmental_hostility, social_security, urban_legality), especialmente en "red_flags"
- Capítulo 2 (Execution & Reality Check): En realidad de renovación (costos, plazos), infraestructura, y en los arrays "uncertainties" de cada habitación
- Capítulo 3 (Financial Intelligence): En costos ocultos y oportunidades de incentivos
Sintetiza todas estas fuentes para generar los 5 puntos de verificación prioritarios, mapeando cada item al capítulo relevante.

ESTRUCTURA DE CADA ITEM:
- headline: 2-3 palabras en español cercano (ej: "Seguridad piscina", "Instalaciones al día", "Normas comunidad")
- brief: EXACTAMENTE 2 frases:
  * Primera: qué verificar específicamente (qué mirar, medir, preguntar)
  * Segunda: por qué importa pero solucionable ("normal para la edad", "con X se resuelve", "nada grave si se pilla a tiempo")
- priority: 1-5 (1 = más importante)
- expansion: bloques fluidos (solo incluye lo relevante para este item):
  * steps: cómo verificar (1-5 bullets) - solo si aplica
  * photos: habitaciones implicadas (1-4 fotos con room_id, url, note) - solo si aplica
  * questions_for_agent: preguntas concretas para el agente - solo si aplica
  * context: narrativa corta sobre era/tipología - solo si aplica
  * links: 2-3 enlaces (colapsados) - solo si aplica
  * acceptance: qué es ok vs señal de riesgo - solo si aplica
  * oom: orden de magnitud coste/tiempo (solo si ayuda decisión) - solo si aplica
  * evidence_note: nota breve si necesita respaldo - solo si aplica

REGLAS:
- Agrupa micro-checks relacionados bajo un solo headline (ej: "Instalaciones al día" agrupa eléctrico + fontanería)
- Prioriza items que más cambian viabilidad/coste/tiempo si cambian
- Cada item debe ser autocontenido (no referencias a secciones del informe)
- Las fotos deben venir de habitaciones implicadas (room_by_room del Capítulo 2)
- No todos los items necesitan todos los campos de expansion - solo lo relevante
- Prioriza items que:
  * Tienen incertidumbres identificadas (en Capítulo 1 red_flags, Capítulo 2 realidad de renovación, o en habitaciones)
  * Requieren verificación física (no visible en fotos)
  * Son críticos para decisiones de compra/renovación (cambian viabilidad, coste o tiempo)
  * Están relacionados con permisos, normativas o costes contextuales (Capítulo 2)
  * Son "red flags" del Capítulo 1 (riesgos estructurales, ambientales, legales, de seguridad)
- Mapea cada item de verificación al capítulo relevante:
  * Items de Capítulo 1: Riesgos estructurales, ambientales, legales, de seguridad
  * Items de Capítulo 2: Costos reales, plazos, permisos, infraestructura, habitaciones específicas
  * Items de Capítulo 3: Costos ocultos, incentivos, contexto de mercado
- Usa información de investigación general (general_permits, laws_regulations, norms_standards) para generar items de verificación relacionados con permisos y cumplimiento normativo
- Usa general_costs y general_timings para proporcionar estimaciones de orden de magnitud (oom) cuando sea relevante

EJEMPLOS DE TONO:
- "Échale un ojo a [X]: mira [señal]. Es normal en casas de esta edad; si toca actuar, con [acción] se resuelve bien."
- "Comprueba [X] (cómo: [paso]). Nada grave si se pilla a tiempo; con [proveedor] y buen detalle queda perfecto."
- "Bueno hay que averiguarlo que puede ser un problema pero tampoco tanto"

ESTRUCTURA DE SALIDA:
Devuelve SOLO JSON válido con esta estructura exacta:
{
  "listing_id": "${listingId}",
  "generated_at": "${new Date().toISOString()}",
  "items": [
    {
      "headline": "Texto corto 2-3 palabras",
      "brief": "Primera frase: qué verificar. Segunda frase: por qué importa pero solucionable.",
      "priority": 1,
      "expansion": {
        "steps": ["Paso 1 de verificación", "Paso 2..."],
        "photos": [{"room_id": "ID_de_habitacion_del_informe", "url": "URL_real_de_foto", "note": "Nota descriptiva"}],
        "questions_for_agent": ["Pregunta concreta 1", "Pregunta concreta 2"],
        "context": "Contexto breve sobre era/tipología si aplica",
        "links": [{"url": "URL_real", "title": "Título", "snippet": "Snippet opcional"}],
        "acceptance": ["Criterio OK", "Criterio de riesgo"],
        "oom": {"cost": {"low": numero, "high": numero, "currency": "EUR"}, "time_weeks": {"low": numero, "high": numero}},
        "evidence_note": "Nota sobre evidencia si aplica"
      }
    }
  ]
}

IMPORTANTE:
- Usa room_id reales del informe (room_by_room del Capítulo 2)
- Usa URLs reales de fotos de las habitaciones implicadas
- NO uses valores de ejemplo como "cluster_75", "Abre panel...", "Casa de 1985", etc.
- Genera contenido específico basado en el informe proporcionado (nueva estructura de 3 capítulos)
- Los números de coste/tiempo deben ser realistas para esta propiedad específica
- Mapea cada item de verificación al capítulo relevante (Capítulo 1, 2, o 3) para facilitar la navegación

Devuelve EXACTAMENTE 5 items, SOLO JSON válido, sin texto adicional.`;

    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        generated_at: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              headline: { type: 'string', minLength: 2, maxLength: 50 },
              brief: { type: 'string', minLength: 50 },
              priority: { type: 'number', minimum: 1, maximum: 5 },
              expansion: {
                type: 'object',
                properties: {
                  steps: { type: 'array', items: { type: 'string' } },
                  photos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        room_id: { type: 'string' },
                        url: { type: 'string' },
                        note: { type: 'string' }
                      },
                      required: ['room_id', 'url']
                    }
                  },
                  questions_for_agent: { type: 'array', items: { type: 'string' } },
                  context: { type: 'string' },
                  links: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string' },
                        title: { type: 'string' },
                        snippet: { type: 'string' }
                      },
                      required: ['url']
                    }
                  },
                  acceptance: { type: 'array', items: { type: 'string' } },
                  oom: {
                    type: 'object',
                    properties: {
                      cost: {
                        type: 'object',
                        properties: {
                          low: { type: 'number' },
                          high: { type: 'number' },
                          currency: { type: 'string' }
                        }
                      },
                      time_weeks: {
                        type: 'object',
                        properties: {
                          low: { type: 'number' },
                          high: { type: 'number' }
                        }
                      }
                    }
                  },
                  evidence_note: { type: 'string' }
                },
                additionalProperties: false
              }
            },
            required: ['headline', 'brief', 'priority'],
            additionalProperties: false
          },
          minItems: 5,
          maxItems: 5
        }
      },
      required: ['listing_id', 'generated_at', 'items'],
      additionalProperties: false
    };

    const result = await callGeminiRest(prompt, {
      model: 'gemini-3-pro-preview',
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingLevel: 'MEDIUM' }, // Medium thinking (like zero-shot clustering uses HIGH)
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      console.error('❌ Verify generation failed:', result.error);
      return NextResponse.json(
        { success: false, error: 'verify_generation_failed', details: result.error },
        { status: 500 }
      );
    }

    let parsed: {
      listing_id: string;
      generated_at: string;
      items: Array<{
        headline: string;
        brief: string;
        priority: number;
        expansion?: {
          steps?: string[];
          photos?: Array<{ room_id: string; url: string; note?: string }>;
          questions_for_agent?: string[];
          context?: string;
          links?: Array<{ url: string; title?: string; snippet?: string }>;
          acceptance?: string[];
          oom?: { cost?: { low: number; high: number; currency: string }; time_weeks?: { low: number; high: number } };
          evidence_note?: string;
        };
      }>;
    };

    try {
      parsed = JSON.parse(result.text.trim());
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      // Fallback minimal structure
      parsed = {
        listing_id: String(listingId),
        generated_at: new Date().toISOString(),
        items: []
      };
    }

    // Validate items are sorted by priority
    parsed.items.sort((a, b) => a.priority - b.priority);

    // Replace placeholder photo URLs with real URLs from clusters
    parsed.items.forEach((item) => {
      if (item.expansion?.photos) {
        (item.expansion as any).photos = item.expansion.photos.map((photo: any) => {
          const roomId = photo.room_id;
          const photoUrls = roomIdToPhotoUrls.get(roomId) || [];
          
          // Use first available photo URL, or keep original if no match found
          if (photoUrls.length > 0) {
            return {
              room_id: roomId,
              url: photoUrls[0], // Use first photo from cluster
              note: photo.note || `Foto de ${roomByRoom.find((r: any) => r.room_id === roomId)?.room_name || 'habitación'}`
            };
    }
          
          // If no cluster match, try to find photo by room name
          const room = roomByRoom.find((r: any) => r.room_id === roomId);
          if (room) {
            // Try to find cluster by room name
            const clusterByName = clusters?.find((c: any) => 
              c.cluster_name === room.room_name || 
              c.cluster_name?.toLowerCase().includes(room.room_name?.toLowerCase() || '')
            );
            if (clusterByName?.photo_urls && clusterByName.photo_urls.length > 0) {
              return {
                room_id: roomId,
                url: clusterByName.photo_urls[0],
                note: photo.note || `Foto de ${room.room_name}`
              };
            }
          }
          
          // Fallback: remove photo if no real URL found (don't include placeholders)
          return null;
        }).filter((photo: any): photo is { room_id: string; url: string; note?: string } => photo !== null);
        
        // If no photos remain, remove photos array entirely
        if (item.expansion.photos.length === 0) {
          delete item.expansion.photos;
        }
      }
    });

    // Persist
    const { error: upsertErr } = await supabase
      .from('verify_recommendations')
      .upsert(
        {
          listing_id: listingId, // Use string ID to match listings table
        recommendations: parsed,
        },
        { onConflict: 'listing_id' }
      );

    if (upsertErr) {
      console.error('❌ Persist error:', upsertErr);
      return NextResponse.json(
        { success: false, error: 'persist_failed', details: upsertErr.message },
        { status: 500 }
      );
    }

    console.log(`✅ Verify checklist generated: ${parsed.items.length} items`);

    return NextResponse.json({ success: true, data: parsed });
  } catch (e: any) {
    console.error('❌ Verify endpoint error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'unknown_error' },
      { status: 500 }
    );
  }
}


