/**
 * WPA Score API
 * 
 * Phase 2 of the 2-step WPA pipeline:
 * Prose → 35 Dimension Scores (converts descriptions to structured scores)
 * 
 * Takes the output of /api/wpa/describe and produces 35 dimensions
 * that can be used for algorithmic fit scoring.
 * 
 * Uses Gemini 2.5 Flash-lite for cheap text-to-JSON conversion
 * 
 * Cost: ~$0.003 per listing (text only, no vision)
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { WPADescription } from '../describe/route';

// ============================================================================
// Types - 35 Dimensions
// ============================================================================

export type { WPAScores } from '@/types/wpa-score';
import type { WPAScores } from '@/types/wpa-score';

// ============================================================================
// DynamoDB Client
// ============================================================================

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

// ============================================================================
// Cache Functions
// ============================================================================

const WPA_SCORES_TABLE = 'leo-wpa-cache';

async function getCachedScores(listingId: string): Promise<WPAScores | null> {
  try {
    const client = getDocClient();
    const result = await client.send(new GetCommand({
      TableName: WPA_SCORES_TABLE,
      Key: { listing_id: listingId },
    }));
    
    if (result.Item?.scores) {
      console.log(`[WPA/score] Cache hit for ${listingId}`);
      return result.Item as WPAScores;
    }
    
    return null;
  } catch (error) {
    console.error('[WPA/score] Cache read error:', error);
    return null;
  }
}

async function cacheScores(scores: WPAScores): Promise<void> {
  try {
    const client = getDocClient();
    await client.send(new PutCommand({
      TableName: WPA_SCORES_TABLE,
      Item: scores,
    }));
    console.log(`[WPA/score] Cached result for ${scores.listing_id}`);
  } catch (error) {
    console.error('[WPA/score] Cache write error:', error);
  }
}

// ============================================================================
// Score Generation
// ============================================================================

const WPA_SCORE_PROMPT = `You are a real estate analyst converting property descriptions into structured scores.

Given a detailed property description, extract scores for 35 dimensions.
Each score is 0-100 where:
- 0 = Terrible/Non-existent
- 25 = Poor/Below average
- 50 = Average/Acceptable
- 75 = Good/Above average
- 100 = Excellent/Outstanding

Use NULL if the description doesn't provide enough information to score that dimension.

SCORING DIMENSIONS:

LIGHT & AIR:
- natural_light_intensity: Overall brightness from windows
- light_distribution: Even lighting across all rooms
- cross_ventilation: Potential for airflow (windows on multiple sides)
- ceiling_height: Perceived height (standard ~50, high ~75+)
- window_quality: Size and type of windows

LAYOUT & FLOW:
- entrance_experience: First impression entering
- kitchen_living_relationship: Open plan (high) vs closed (low based on preference)
- bathroom_privacy: Bathroom not directly off living areas
- bedroom_seclusion: Bedrooms away from noise/activity
- flow_for_entertaining: Good for hosting gatherings
- furniture_feasibility: Rooms shaped for standard furniture
- two_person_living: Adequate for couple (two sinks, space)
- escape_room_potential: Private space to retreat

KITCHEN:
- counter_space: Preparation area
- appliance_quality: Age/quality of appliances
- kitchen_storage: Cabinet and pantry space
- cooking_ventilation: Range hood or window nearby

BATHROOM & BEDROOM:
- bathroom_functionality: Layout and fixture quality
- bedroom_size_fit: Can fit king bed + furniture
- closet_storage: Built-in wardrobes/closets
- morning_light_bedroom: East-facing for morning light

CONDITION:
- renovation_state: Move-in ready (100) to needs full reno (0)
- signs_of_aging: Visible wear (inverted: 100 = no wear)
- kitchen_modernity: Kitchen age/updates
- bathroom_modernity: Bathroom age/updates

COMFORT & LIFESTYLE:
- cozy_corner_potential: Spots for reading/relaxing
- wfh_potential: Space for home office
- outdoor_space_quality: Balcony/terrace quality
- balcony_security: Safe for pets/kids
- storage_total: Overall storage space
- guest_hosting: Can host overnight guests

VIEWS & EXPOSURE:
- view_quality: What you see from windows
- street_exposure: Protection from street noise and loss of privacy (0 = highly exposed/noisy, 100 = quiet/private). Higher means better fit.
- floor_level_safety: Low = ground floor risk, High = upper floors
- building_position: Interior courtyard vs street-facing

Also identify:
- FLAGS: Binary issues (cubicle bathroom, mezzanine, etc.)
- SAFETY: Hazards for children, elderly, accessibility, pets
- STANDOUTS: Top 3 best features
- CONCERNS: Top 3 issues

Respond with JSON matching this exact structure.`;

async function generateScores(
  listingId: string,
  description: WPADescription
): Promise<WPAScores | null> {
  // Check cache first
  const cached = await getCachedScores(listingId);
  if (cached) {
    return cached;
  }
  
  console.log(`[WPA/score] Generating scores for ${listingId}`);
  
  // Build description text for scoring
  const descriptionText = `
PROPERTY OVERVIEW:
${description.overall.summary}
Style: ${description.overall.style}
Condition: ${description.overall.condition}
Atmosphere: ${description.overall.atmosphere}

ROOMS:
${description.rooms.map(r => `
${r.type.toUpperCase()}:
${r.description}
Features: ${r.features.join(', ') || 'None noted'}
Concerns: ${r.concerns.join(', ') || 'None'}
Size: ${r.estimatedSize}
`).join('\n')}

STANDOUT FEATURES:
${description.standouts.join('\n- ')}

CONCERNS:
${description.concerns.join('\n- ')}

Photos analyzed: ${description.photoCount}
Confidence: ${description.confidence}
`;

  const fullPrompt = `${WPA_SCORE_PROMPT}

PROPERTY DESCRIPTION:
${descriptionText}

Provide your JSON scores:`;

  // Call Gemini Flash-lite (cheap text model)
  const response = await callGeminiRest(fullPrompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.1,
    maxOutputTokens: 3000,
    responseMimeType: 'application/json',
  });
  
  if (!response.success || !response.text) {
    console.error(`[WPA/score] Gemini error for ${listingId}:`, response.error);
    return null;
  }
  
  // Parse response
  try {
    const parsed = JSON.parse(response.text);
    
    const scores: WPAScores = {
      listing_id: listingId,
      scores: {
        // Light & Air
        natural_light_intensity: parsed.scores?.natural_light_intensity ?? null,
        light_distribution: parsed.scores?.light_distribution ?? null,
        cross_ventilation: parsed.scores?.cross_ventilation ?? null,
        ceiling_height: parsed.scores?.ceiling_height ?? null,
        window_quality: parsed.scores?.window_quality ?? null,
        
        // Layout & Flow
        entrance_experience: parsed.scores?.entrance_experience ?? null,
        kitchen_living_relationship: parsed.scores?.kitchen_living_relationship ?? null,
        bathroom_privacy: parsed.scores?.bathroom_privacy ?? null,
        bedroom_seclusion: parsed.scores?.bedroom_seclusion ?? null,
        flow_for_entertaining: parsed.scores?.flow_for_entertaining ?? null,
        furniture_feasibility: parsed.scores?.furniture_feasibility ?? null,
        two_person_living: parsed.scores?.two_person_living ?? null,
        escape_room_potential: parsed.scores?.escape_room_potential ?? null,
        
        // Kitchen
        counter_space: parsed.scores?.counter_space ?? null,
        appliance_quality: parsed.scores?.appliance_quality ?? null,
        kitchen_storage: parsed.scores?.kitchen_storage ?? null,
        cooking_ventilation: parsed.scores?.cooking_ventilation ?? null,
        
        // Bathroom & Bedroom
        bathroom_functionality: parsed.scores?.bathroom_functionality ?? null,
        bedroom_size_fit: parsed.scores?.bedroom_size_fit ?? null,
        closet_storage: parsed.scores?.closet_storage ?? null,
        morning_light_bedroom: parsed.scores?.morning_light_bedroom ?? null,
        
        // Condition
        renovation_state: parsed.scores?.renovation_state ?? null,
        signs_of_aging: parsed.scores?.signs_of_aging ?? null,
        kitchen_modernity: parsed.scores?.kitchen_modernity ?? null,
        bathroom_modernity: parsed.scores?.bathroom_modernity ?? null,
        
        // Comfort & Lifestyle
        cozy_corner_potential: parsed.scores?.cozy_corner_potential ?? null,
        wfh_potential: parsed.scores?.wfh_potential ?? null,
        outdoor_space_quality: parsed.scores?.outdoor_space_quality ?? null,
        balcony_security: parsed.scores?.balcony_security ?? null,
        storage_total: parsed.scores?.storage_total ?? null,
        guest_hosting: parsed.scores?.guest_hosting ?? null,
        
        // Views & Exposure
        view_quality: parsed.scores?.view_quality ?? null,
        street_exposure: parsed.scores?.street_exposure ?? null,
        floor_level_safety: parsed.scores?.floor_level_safety ?? null,
        building_position: parsed.scores?.building_position ?? null,
      },
      flags: {
        has_cubicle_bathroom: parsed.flags?.has_cubicle_bathroom ?? false,
        has_mezzanine: parsed.flags?.has_mezzanine ?? false,
        needs_full_renovation: parsed.flags?.needs_full_renovation ?? false,
        ground_floor_exposed: parsed.flags?.ground_floor_exposed ?? false,
        is_house_share: parsed.flags?.is_house_share ?? false,
        no_natural_light: parsed.flags?.no_natural_light ?? false,
        no_kitchen: parsed.flags?.no_kitchen ?? false,
        no_bathroom: parsed.flags?.no_bathroom ?? false,
      },
      safety_flags: {
        child_hazards: parsed.safety_flags?.child_hazards ?? [],
        elderly_hazards: parsed.safety_flags?.elderly_hazards ?? [],
        accessibility_issues: parsed.safety_flags?.accessibility_issues ?? [],
        pet_hazards: parsed.safety_flags?.pet_hazards ?? [],
      },
      standouts: parsed.standouts ?? description.standouts,
      concerns: parsed.concerns ?? description.concerns,
      confidence: description.confidence,
      scoredAt: new Date().toISOString(),
    };
    
    // Cache result
    await cacheScores(scores);
    
    console.log(`[WPA/score] Completed for ${listingId}:`, {
      scoresCount: Object.values(scores.scores).filter(v => v !== null).length,
      flagsSet: Object.values(scores.flags).filter(Boolean).length,
      confidence: scores.confidence,
    });
    
    return scores;
  } catch (error) {
    console.error(`[WPA/score] Parse error for ${listingId}:`, error);
    return null;
  }
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, description, skipCache } = body;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
        { status: 400 }
      );
    }
    
    if (!description) {
      return NextResponse.json(
        { error: 'description object is required (from /api/wpa/describe)' },
        { status: 400 }
      );
    }
    
    // Check cache first (unless skipCache is set)
    if (!skipCache) {
      const cached = await getCachedScores(listingId);
      if (cached) {
        return NextResponse.json({
          success: true,
          scores: cached,
          cached: true,
        });
      }
    }
    
    // Generate new scores
    const scores = await generateScores(listingId, description);
    
    if (!scores) {
      return NextResponse.json(
        { error: 'Failed to generate scores' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      scores,
      cached: false,
    });
    
  } catch (error: any) {
    console.error('[WPA/score] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve cached scores
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId query parameter is required' },
        { status: 400 }
      );
    }
    
    const cached = await getCachedScores(listingId);
    
    if (!cached) {
      return NextResponse.json(
        { error: 'Scores not found', listingId },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      scores: cached,
    });
    
  } catch (error: any) {
    console.error('[WPA/score] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

