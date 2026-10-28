/**
 * Intake Chat API
 * 
 * Chat-based life profile intake for the Recommender.
 * Uses conversational AI to extract lifestyle preferences naturally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { createClient } from '@supabase/supabase-js';
import { LifeProfile, DEFAULT_LIFE_PROFILE } from '@/types/recommender';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return createClient(url, key);
}

// System prompt for intake conversation
const INTAKE_SYSTEM_PROMPT = `Eres Leo, un asistente de búsqueda de vivienda. Tu trabajo es conocer al usuario a través de una conversación natural para entender su estilo de vida y ayudarle a encontrar la casa perfecta.

**TU OBJETIVO:**
Extraer información sobre el usuario de forma conversacional y amigable. NO hagas preguntas tipo formulario. Fluye naturalmente.

**INFORMACIÓN QUE NECESITAS RECOPILAR:**

1. **Hogar (household)**
   - Cuántas personas vivirán (adultos, niños y sus edades)
   - Mascotas (tipo y tamaño)
   - Situación laboral (remoto, híbrido, oficina, jubilado)

2. **Estilo de vida (lifestyle)**
   - Rutinas de mañana y tarde
   - Actividades de fin de semana
   - Qué NO soportarían (dealbreakers)
   - Qué es imprescindible (must-haves)

3. **Límites (constraints)**
   - Presupuesto máximo
   - Tiempo máximo de commute y destino
   - Apetito de reforma (llave en mano, cosmética, integral)

4. **Preferencias (tradeoffs)**
   - Espacio vs ubicación
   - Nuevo vs con carácter
   - Tranquilidad vs vida de barrio
   - Vistas vs privacidad

5. **Vivienda (propertyPreferences)**
   - Tipo (piso, casa, chalet, ático, dúplex)
   - Habitaciones y baños mínimos
   - Metros cuadrados mínimos
   - Zonas preferidas y a evitar

**ESTILO DE CONVERSACIÓN:**
- Sé cálido y cercano, usa "tú"
- Haz 1-2 preguntas por mensaje, no más
- Relaciona preguntas con lo que ya te han contado
- Usa emojis ocasionalmente pero no en exceso
- Muestra interés genuino en su vida

**FLUJO SUGERIDO:**
1. Saludo y pregunta abierta sobre qué buscan
2. Conocer quién vivirá (familia, mascotas)
3. Entender su día a día (trabajo, rutinas)
4. Explorar qué valoran (luz, tranquilidad, etc.)
5. Definir límites (presupuesto, zona, reforma)
6. Confirmar que tienes suficiente info

**CUANDO TENGAS SUFICIENTE INFORMACIÓN:**
Al final de tu mensaje, incluye un bloque JSON con la información recopilada:

\`\`\`json
{
  "profile_complete": true,
  "extracted_profile": {
    "household": { ... },
    "lifestyle": { ... },
    "constraints": { ... },
    "tradeoffs": { ... },
    "propertyPreferences": { ... }
  }
}
\`\`\`

Solo incluye el JSON cuando tengas AL MENOS:
- Presupuesto
- Número de personas/mascotas
- 1-2 dealbreakers o must-haves
- Tipo de vivienda preferida

**EJEMPLOS DE PREGUNTAS NATURALES:**
- "¡Hola! 👋 Cuéntame, ¿qué te ha llevado a buscar casa ahora?"
- "¿Viviréis solos o hay más familia? ¿Alguna mascota?"
- "¿Cómo es tu día típico? ¿Trabajas desde casa o tienes que ir a la oficina?"
- "Si te imaginas un sábado ideal en tu nueva casa, ¿qué estarías haciendo?"
- "¿Hay algo que NO soportarías? Ruido, falta de luz, escaleras..."
- "¿Hasta cuánto estáis dispuestos a invertir?"

**IMPORTANTE:**
- Responde SIEMPRE en español
- No preguntes todo de golpe
- Si mencionan algo interesante, profundiza
- Sé empático con sus necesidades`;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body?.messages) ? body.messages : [];
    const profileId = body?.profileId ?? null;

    // Build conversation history
    const history = messages.map(m => `${m.role === 'user' ? 'Usuario' : 'Leo'}: ${m.content}`).join('\n\n');

    // Get existing profile data if available
    let existingProfile: Partial<LifeProfile> = {};
    if (profileId) {
      const { data } = await supabase
        .from('user_lifestyle_profiles')
        .select('*')
        .eq('id', profileId)
        .single();
      
      if (data) {
        existingProfile = {
          household: {
            adults: data.adults || 1,
            children: data.children || [],
            pets: data.pets || [],
            workSituation: data.work_situation || 'hybrid',
          },
          constraints: {
            maxBudget: data.max_budget || 0,
            maxCommuteMinutes: data.max_commute_minutes || 30,
            commuteDestination: data.commute_destination || '',
            moveInDate: data.move_in_date,
            renovationAppetite: data.renovation_appetite || 'cosmetic',
          },
          propertyPreferences: {
            propertyTypes: data.property_types || [],
            minBedrooms: data.min_bedrooms || 0,
            minBathrooms: data.min_bathrooms || 0,
            minSqm: data.min_sqm || 0,
            preferredLocations: data.preferred_locations || [],
            avoidLocations: data.avoid_locations || [],
          },
        };
      }
    }

    const existingDataStr = Object.keys(existingProfile).length > 0
      ? `\n\n=== DATOS YA RECOPILADOS ===\n${JSON.stringify(existingProfile, null, 2)}\n=== FIN DATOS ===\n`
      : '';

    const userPrompt = `${existingDataStr}=== CONVERSACIÓN ===\n${history}\n\nLeo:`;

    // Initialize Vertex AI
    const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!GOOGLE_CLOUD_PROJECT_ID) {
      return NextResponse.json({ success: false, error: 'GOOGLE_CLOUD_PROJECT_ID not configured' }, { status: 500 });
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const vertexAI = new VertexAI({
            project: GOOGLE_CLOUD_PROJECT_ID,
            location: GOOGLE_CLOUD_LOCATION,
          });

          const model = vertexAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
              temperature: 0.7,
              topP: 0.9,
              maxOutputTokens: 2000,
            },
            systemInstruction: {
              role: 'system',
              parts: [{ text: INTAKE_SYSTEM_PROMPT }],
            },
          });

          let accumulatedText = '';

          const streamResult = await model.generateContentStream({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
          });

          for await (const item of streamResult.stream) {
            const chunkText = (item as any).candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunkText) {
              accumulatedText += chunkText;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`));
            }
          }

          // Check if response contains extracted profile JSON
          const jsonMatch = accumulatedText.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              const extracted = JSON.parse(jsonMatch[1]);
              if (extracted.profile_complete && extracted.extracted_profile) {
                console.log('[IntakeChat] Profile extraction complete:', extracted.extracted_profile);
                
                const profile = extracted.extracted_profile;
                
                // Save to database - create new if no profileId
                if (profileId) {
                  await supabase
                    .from('user_lifestyle_profiles')
                    .update({
                      adults: profile.household?.adults,
                      children: profile.household?.children,
                      pets: profile.household?.pets,
                      work_situation: profile.household?.workSituation,
                      morning_routine: profile.lifestyle?.morningRoutine,
                      evening_routine: profile.lifestyle?.eveningRoutine,
                      weekend_activities: profile.lifestyle?.weekendActivities,
                      dealbreakers: profile.lifestyle?.dealbreakers,
                      must_haves: profile.lifestyle?.mustHaves,
                      max_budget: profile.constraints?.maxBudget,
                      max_commute_minutes: profile.constraints?.maxCommuteMinutes,
                      commute_destination: profile.constraints?.commuteDestination,
                      renovation_appetite: profile.constraints?.renovationAppetite,
                      tradeoff_space_vs_location: profile.tradeoffs?.spaceVsLocation || 0,
                      tradeoff_new_vs_character: profile.tradeoffs?.newVsCharacter || 0,
                      tradeoff_quiet_vs_vibrant: profile.tradeoffs?.quietVsVibrant || 0,
                      tradeoff_views_vs_privacy: profile.tradeoffs?.viewsVsPrivacy || 0,
                      property_types: profile.propertyPreferences?.propertyTypes,
                      min_bedrooms: profile.propertyPreferences?.minBedrooms,
                      min_bathrooms: profile.propertyPreferences?.minBathrooms,
                      min_sqm: profile.propertyPreferences?.minSqm,
                      preferred_locations: profile.propertyPreferences?.preferredLocations,
                      avoid_locations: profile.propertyPreferences?.avoidLocations,
                      intake_completed: true,
                    })
                    .eq('id', profileId);
                }

                // Remove the JSON block from the visible response
                const cleanedText = accumulatedText.replace(/```json\s*[\s\S]*?```/g, '').trim();
                
                // Send cleaned text update
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  chunk: '', // Empty chunk to signal we're done with text
                  finalText: cleanedText
                })}\n\n`));

                // Send profile completion event
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  profileComplete: true, 
                  extractedProfile: profile,
                  profileId: profileId
                })}\n\n`));
              }
            } catch (e) {
              console.error('[IntakeChat] Failed to parse extracted profile:', e);
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error('[IntakeChat] Error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error?.message || 'Failed' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    console.error('[IntakeChat] API error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}

