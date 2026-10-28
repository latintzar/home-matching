
/**
 * Stage 1: Flash - Extract Home Structure
 *
 * Uses Gemini 2.5 Flash to look at a subset of photos and infer:
 * - Number of bedrooms / bathrooms
 * - Presence of kitchen, living room, terrace, storage
 * - A "space set" of target clusters: Dormitorio 1, Baño 1, etc.
 *
 * This is a cheap structural pass that feeds Stage 1.5 and beyond.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { convertSupabaseUrlToBase64 } from '@/lib/photo-storage';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const GOOGLE_CLOUD_LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

export const dynamic = 'force-dynamic';

interface SpaceSet {
  bedrooms: number;
  bathrooms: number;
  kitchen: boolean;
  living_room: boolean;
  garage: boolean;
  terrace: boolean;
  storage: boolean;
  other_spaces: string[];
  target_clusters: string[];
  reasoning: string;
  uncertainties?: Array<{
    issue: string;
    affected_spaces: string[];
    reasoning: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    // Fetch photos for this listing (limit to keep token usage reasonable)
    const { data: photos, error: photosError } = await supabase
      .from('listing_photos')
      .select('url, display_order')
      .eq('listing_id', listingId)
      .order('display_order')
      .limit(20);

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'no_photos',
          details: 'No photos found for this listing',
        },
        { status: 400 }
      );
    }

    // Convert photos to base64 for Gemini
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> =
      [];

    for (const photo of photos) {
      try {
        const base64 = await convertSupabaseUrlToBase64(photo.url);
        imageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
          },
        });
      } catch (error) {
        console.warn(`⚠️ Stage 1: Failed to convert photo ${photo.url}`, error);
      }
    }

    if (imageParts.length === 0) {
      throw new Error('Failed to convert any photos to base64');
    }

    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 16000, // Increased to avoid truncation on detailed reasoning
        responseMimeType: 'application/json',
      },
    });

    const prompt = `You are analyzing photos of a single Spanish property.

TASK:
Infer the STRUCTURE of the home (how many bedrooms, bathrooms, and which core spaces exist) based ONLY on what you can see in the photos.

You may see:
- Bedrooms (different styles)
- Bathrooms (with different fixtures)
- Kitchen
- Living room
- Dining area
- Hallways / entrance
- Terrace / outdoor spaces
- Communal areas
- Documents or floor plans

FOCUS:
- Distinguish clearly between:
  * Bedrooms (Dormitorio 1, Dormitorio 2, Dormitorio 3, etc.)
  * Bathrooms (Baño 1, Baño 2, Baño 3, etc.)
  * Kitchen (Cocina)
  * Living room (Salón)
  * Dining room (Comedor)
  * Terrace (Terraza)
  * Storage (Trastero) if clearly visible
- If some spaces are implied but not directly visible (e.g., garage mentioned in documents but no photo), you can mention them in uncertainties.

OUTPUT FORMAT (JSON ONLY):
{
  "bedrooms": <integer>,
  "bathrooms": <integer>,
  "kitchen": <true|false>,
  "living_room": <true|false>,
  "garage": <true|false>,
  "terrace": <true|false>,
  "storage": <true|false>,
  "other_spaces": ["<space_name_1>", "<space_name_2>", "..."],
  "target_clusters": [
    "<space_name_1>",
    "<space_name_2>",
    "<space_name_3>",
    "..."
  ],
  "reasoning": "<brief explanation of how you inferred the structure>",
  "uncertainties": [
    {
      "issue": "<what is uncertain>",
      "affected_spaces": ["<space_name_1>", "..."],
      "reasoning": "<why this is uncertain>"
    }
  ]
}

GUIDELINES:
- Use Spanish names in target_clusters (Dormitorio, Baño, Cocina, Salón, Comedor, Terraza, Trastero, etc.).
- If you see multiple distinct bedrooms, number them: "Dormitorio 1", "Dormitorio 2", "Dormitorio 3".
- Same for bathrooms: "Baño 1", "Baño 2", "Baño 3".
- If you are not sure about a space (e.g., garage, storage), mark it in uncertainties.
- Do NOT include any extra commentary outside the JSON.`;

    const startTime = Date.now();

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, ...imageParts],
        },
      ],
    });

    const duration = Date.now() - startTime;

    const responseText =
      (result.response as any)?.text ||
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Empty response from Gemini Flash');
    }

    // Basic cleaning to be robust against markdown-wrapped JSON
    let cleanText = responseText.trim();
    cleanText = cleanText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    cleanText = cleanText.trim();

    let spaceSet: SpaceSet;
    try {
      spaceSet = JSON.parse(cleanText);
    } catch (error: any) {
      throw new Error(
        `Failed to parse JSON response from Stage 1: ${error.message}. Preview: ${cleanText.substring(
          0,
          2000
        )}`
      );
    }

    return NextResponse.json({
      success: true,
      stage: 'stage-1',
      model: 'gemini-2.5-flash',
      photos_analyzed: imageParts.length,
      total_photos: photos.length,
      response_time_ms: duration,
      space_set: spaceSet,
      raw_response: responseText,
    });
  } catch (error: any) {
    console.error('❌ Stage 1 failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'stage_1_failed',
        details: error.message || 'Unknown error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}


