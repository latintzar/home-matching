/**
 * Extract Voice Profile API
 * 
 * Takes an ElevenLabs conversation ID, fetches the transcript,
 * and extracts a LifeProfile using Gemini.
 * 
 * Now includes completeness tracking - we know what we have and what's missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { VertexAI } from '@google-cloud/vertexai';
import { calculateCompleteness, LifeProfile } from '@/types/recommender';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

// Fetch conversation transcript from ElevenLabs
async function fetchElevenLabsTranscript(conversationId: string): Promise<string> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch conversation: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract transcript from conversation data
  // Format: "Agent: message\nUser: message\n..."
  const transcript = data.transcript
    ?.map((turn: any) => `${turn.role === 'agent' ? 'Leo' : 'Usuario'}: ${turn.message}`)
    .join('\n') || '';

  return transcript;
}

// Extract profile from transcript using Gemini
async function extractProfileFromTranscript(transcript: string): Promise<any> {
  const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  if (!GOOGLE_CLOUD_PROJECT_ID) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');
  }

  const vertexAI = new VertexAI({
    project: GOOGLE_CLOUD_PROJECT_ID,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Analiza esta conversación de intake inmobiliario y extrae un perfil estructurado del usuario.

CONVERSACIÓN:
${transcript}

EXTRAE la siguiente información en JSON. Si algo no se menciona, usa null o valores por defecto razonables:

{
  "household": {
    "adults": número de adultos (default 1),
    "children": [{ "age": edad }] o [],
    "pets": [{ "type": "dog"|"cat"|"other", "size": "small"|"medium"|"large" }] o [],
    "workSituation": "remote"|"hybrid"|"office"|"retired"|"other"
  },
  "lifestyle": {
    "morningRoutine": string o "",
    "eveningRoutine": string o "",
    "weekendActivities": [string] o [],
    "dealbreakers": [string] - cosas que NO quieren (ruido, falta de luz, etc),
    "mustHaves": [string] - cosas imprescindibles (terraza, parking, etc)
  },
  "constraints": {
    "maxBudget": número en euros (si dicen "300k" = 300000),
    "maxCommuteMinutes": minutos máximos de commute,
    "commuteDestination": string o "",
    "renovationAppetite": "turnkey"|"cosmetic"|"full"|"any"
  },
  "propertyPreferences": {
    "propertyTypes": ["piso", "casa", "chalet", "ático", etc],
    "minBedrooms": número mínimo de habitaciones,
    "minBathrooms": número mínimo de baños,
    "minSqm": metros cuadrados mínimos,
    "preferredLocations": [zonas preferidas],
    "avoidLocations": [zonas a evitar]
  },
  "needsSummary": {
    "headline": "Una frase corta y directa que resuma su búsqueda (ej: 'Piso luminoso en el centro para pareja con perro')",
    "bullets": [
      "5-7 bullet points en español, cada uno empezando con emoji relevante",
      "Cada punto debe ser claro y específico",
      "Ejemplos: '🏠 Buscáis un piso o ático', '💰 Presupuesto hasta 350.000€', '🐕 Con espacio para vuestro perro'"
    ],
    "personality": "1-2 frases describiendo su estilo de vida y prioridades de forma cálida y personal"
  },
  "confidence": 0-100 (qué tan seguro estás de la extracción),
  "missing": [lista de campos importantes que faltan]
}

IMPORTANTE para needsSummary:
- Escribe como si Leo estuviera hablando directamente al usuario
- Usa "vosotros/vosotras" si son pareja/familia, "tú" si es individual
- Sé específico con los detalles que mencionaron
- Incluye dealbreakers y must-haves de forma positiva
- Los bullets deben ser fáciles de leer de un vistazo

Responde SOLO con el JSON, sin explicaciones.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  
  return JSON.parse(text);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { conversationId, profileId } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    console.log(`[ExtractVoiceProfile] Processing conversation: ${conversationId}`);

    // 1. Fetch transcript from ElevenLabs
    let transcript: string;
    try {
      transcript = await fetchElevenLabsTranscript(conversationId);
      console.log(`[ExtractVoiceProfile] Transcript length: ${transcript.length}`);
    } catch (error: any) {
      console.error('[ExtractVoiceProfile] Failed to fetch transcript:', error);
      return NextResponse.json({ 
        error: `Failed to fetch transcript: ${error.message}` 
      }, { status: 500 });
    }

    if (!transcript || transcript.length < 50) {
      return NextResponse.json({ 
        error: 'Transcript too short or empty',
        transcript 
      }, { status: 400 });
    }

    // 2. Extract profile using Gemini
    let extractedProfile: any;
    try {
      extractedProfile = await extractProfileFromTranscript(transcript);
      console.log(`[ExtractVoiceProfile] Extracted profile:`, extractedProfile);
    } catch (error: any) {
      console.error('[ExtractVoiceProfile] Failed to extract profile:', error);
      return NextResponse.json({ 
        error: `Failed to extract profile: ${error.message}` 
      }, { status: 500 });
    }

    // 3. Save to Supabase if profileId provided
    if (profileId) {
      // Build JSONB columns to match table schema
      const lifestyleDna: any = {
        intakeCompleted: extractedProfile.confidence >= 60,
      };
      
      if (extractedProfile.household) {
        lifestyleDna.adults = extractedProfile.household.adults;
        lifestyleDna.children = extractedProfile.household.children;
        lifestyleDna.pets = extractedProfile.household.pets;
        lifestyleDna.workSituation = extractedProfile.household.workSituation;
      }
      
      if (extractedProfile.lifestyle) {
        lifestyleDna.morningRoutine = extractedProfile.lifestyle.morningRoutine;
        lifestyleDna.eveningRoutine = extractedProfile.lifestyle.eveningRoutine;
        lifestyleDna.weekendActivities = extractedProfile.lifestyle.weekendActivities;
        lifestyleDna.dealbreakers = extractedProfile.lifestyle.dealbreakers;
        lifestyleDna.mustHaves = extractedProfile.lifestyle.mustHaves;
      }
      
      const propertyConstraints: any = {};
      if (extractedProfile.constraints) {
        propertyConstraints.maxBudget = extractedProfile.constraints.maxBudget;
        propertyConstraints.maxCommuteMinutes = extractedProfile.constraints.maxCommuteMinutes;
        propertyConstraints.commuteDestination = extractedProfile.constraints.commuteDestination;
        propertyConstraints.renovationAppetite = extractedProfile.constraints.renovationAppetite;
      }
      
      if (extractedProfile.propertyPreferences) {
        propertyConstraints.propertyTypes = extractedProfile.propertyPreferences.propertyTypes;
        propertyConstraints.minBedrooms = extractedProfile.propertyPreferences.minBedrooms;
        propertyConstraints.minBathrooms = extractedProfile.propertyPreferences.minBathrooms;
        propertyConstraints.minSqm = extractedProfile.propertyPreferences.minSqm;
        propertyConstraints.preferredLocations = extractedProfile.propertyPreferences.preferredLocations;
        propertyConstraints.avoidLocations = extractedProfile.propertyPreferences.avoidLocations;
      }

      const updateData: any = {
        lifestyle_dna: lifestyleDna,
        property_constraints: propertyConstraints,
        voice_transcript: transcript,
        voice_conversation_id: conversationId,
        // Store the user-facing needs summary
        needs_summary: extractedProfile.needsSummary || null,
      };

      const { error: updateError } = await supabase
        .from('user_lifestyle_profiles')
        .update(updateData)
        .eq('id', profileId);

      if (updateError) {
        console.error('[ExtractVoiceProfile] Failed to save to Supabase:', updateError);
        // Don't fail the request, just log
      } else {
        console.log(`[ExtractVoiceProfile] Saved profile to Supabase: ${profileId}`);
      }
    }

    // 4. Calculate completeness
    const partialProfile: Partial<LifeProfile> = {
      household: extractedProfile.household,
      lifestyle: extractedProfile.lifestyle,
      constraints: extractedProfile.constraints,
      propertyPreferences: extractedProfile.propertyPreferences,
    };
    
    const completeness = calculateCompleteness(partialProfile);
    
    // Profile is "complete" if minimum is met OR confidence is high enough
    const isComplete = completeness.minimumMet || extractedProfile.confidence >= 70;
    
    return NextResponse.json({
      success: true,
      profile: {
        ...extractedProfile,
        completeness,
      },
      transcript,
      conversationId,
      profileId,
      isComplete,
      completeness,
      // Useful for UI: can we give recommendations?
      canRecommend: completeness.minimumMet,
      // What's missing (for notifications/followup)
      missingFields: completeness.missingFields,
      completenessScore: completeness.completenessScore,
    });

  } catch (error: any) {
    console.error('[ExtractVoiceProfile] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

