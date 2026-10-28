/**
 * WPA Explain API
 * 
 * Generates personalized explanations of why a property matches (or doesn't)
 * a specific user's preferences.
 * 
 * Takes:
 * - WPA scores (from /api/wpa/score)
 * - User profile weights and preferences
 * - Fit score result
 * 
 * Produces:
 * - Personalized "why this works for you" text
 * - Trade-off explanations
 * - Comparison to user's priorities
 * 
 * Uses Gemini 2.5 Flash-lite (cheapest model)
 * Cost: ~$0.0003 per explanation
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { WPAScores } from '../score/route';

// ============================================================================
// Types
// ============================================================================

export interface UserFitProfile {
  // User's weighted priorities (0-2, default 1.0)
  weights: Record<string, number>;
  
  // Dealbreakers
  dealbreakers: {
    cubicle_bathroom?: boolean;
    mezzanine_ladder?: boolean;
    needs_full_renovation?: boolean;
    ground_floor_exposed?: boolean;
    is_house_share?: boolean;
  };
  
  // Must-haves (minimum scores required)
  must_haves: Record<string, number>;
  
  // Life situation
  has_children: boolean;
  planning_children: boolean;
  has_pets: boolean;
  works_from_home: boolean;
  living_alone: boolean;
}

export interface FitScoreResult {
  score: number;
  pass: boolean;
  topMatches: string[];
  concerns: string[];
  failReason?: string;
}

export interface PersonalizedExplanation {
  listing_id: string;
  user_id: string;
  
  // Main explanation (2-3 sentences)
  explanation: string;
  
  // What matches their priorities
  matchReasons: Array<{
    dimension: string;
    score: number;
    userPriority: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  
  // Trade-offs they're making
  tradeoffs: Array<{
    dimension: string;
    score: number;
    explanation: string;
  }>;
  
  // Life situation relevance
  lifeSituationNotes: string[];
  
  // Overall recommendation
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'dealbreaker';
  
  // Metadata
  generatedAt: string;
}

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

const EXPLANATIONS_TABLE = 'leo-user-property-explanations';

async function getCachedExplanation(
  listingId: string,
  userId: string
): Promise<PersonalizedExplanation | null> {
  try {
    const client = getDocClient();
    const result = await client.send(new GetCommand({
      TableName: EXPLANATIONS_TABLE,
      Key: { 
        listing_id: listingId,
        user_id: userId,
      },
    }));
    
    if (result.Item) {
      console.log(`[WPA/explain] Cache hit for ${listingId}/${userId}`);
      return result.Item as PersonalizedExplanation;
    }
    
    return null;
  } catch (error) {
    console.error('[WPA/explain] Cache read error:', error);
    return null;
  }
}

async function cacheExplanation(explanation: PersonalizedExplanation): Promise<void> {
  try {
    const client = getDocClient();
    await client.send(new PutCommand({
      TableName: EXPLANATIONS_TABLE,
      Item: explanation,
    }));
    console.log(`[WPA/explain] Cached for ${explanation.listing_id}/${explanation.user_id}`);
  } catch (error) {
    console.error('[WPA/explain] Cache write error:', error);
  }
}

// ============================================================================
// Explanation Generation
// ============================================================================

const EXPLAIN_PROMPT = `You are helping a home seeker understand why a property matches (or doesn't match) their lifestyle.

Given:
1. The property's WPA scores (0-100 for various dimensions)
2. The user's priorities (weights, dealbreakers, must-haves)
3. Their life situation (kids, pets, WFH, etc.)

Generate a PERSONALIZED explanation that:
- Speaks directly to their priorities
- Highlights relevant matches and mismatches
- Explains trade-offs they'd be making
- Considers their life situation

Be conversational and helpful, like a friend giving advice.
Use "you" language. Be specific, not generic.

Respond with JSON:
{
  "explanation": "2-3 sentence personalized summary",
  "matchReasons": [
    {
      "dimension": "natural_light",
      "score": 85,
      "userPriority": "high|medium|low",
      "explanation": "Why this matters for them specifically"
    }
  ],
  "tradeoffs": [
    {
      "dimension": "outdoor_space",
      "score": 40,
      "explanation": "What they'd be giving up"
    }
  ],
  "lifeSituationNotes": ["Relevant notes about their situation"],
  "recommendation": "strong_yes|yes|maybe|no|dealbreaker"
}`;

function categorizeWeight(weight: number): 'high' | 'medium' | 'low' {
  if (weight >= 1.5) return 'high';
  if (weight >= 0.8) return 'medium';
  return 'low';
}

async function generateExplanation(
  listingId: string,
  userId: string,
  scores: WPAScores,
  profile: UserFitProfile,
  fitResult: FitScoreResult
): Promise<PersonalizedExplanation | null> {
  // Check cache first
  const cached = await getCachedExplanation(listingId, userId);
  if (cached) {
    return cached;
  }
  
  console.log(`[WPA/explain] Generating for ${listingId}/${userId}`);
  
  // Build context for prompt
  const context = `
PROPERTY SCORES:
${Object.entries(scores.scores)
  .filter(([_, v]) => v !== null)
  .map(([k, v]) => `- ${k}: ${v}/100`)
  .join('\n')}

FLAGS:
${Object.entries(scores.flags)
  .filter(([_, v]) => v)
  .map(([k]) => `- ${k}`)
  .join('\n') || 'None'}

STANDOUTS: ${scores.standouts.join(', ')}
CONCERNS: ${scores.concerns.join(', ')}

USER PRIORITIES (weights):
${Object.entries(profile.weights)
  .filter(([_, v]) => v !== 1.0)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .map(([k, v]) => `- ${k}: ${v} (${categorizeWeight(v as number)})`)
  .join('\n')}

USER DEALBREAKERS:
${Object.entries(profile.dealbreakers)
  .filter(([_, v]) => v)
  .map(([k]) => `- ${k}`)
  .join('\n') || 'None'}

USER MUST-HAVES (minimum scores):
${Object.entries(profile.must_haves)
  .map(([k, v]) => `- ${k}: min ${v}`)
  .join('\n') || 'None'}

LIFE SITUATION:
- Has children: ${profile.has_children}
- Planning children: ${profile.planning_children}
- Has pets: ${profile.has_pets}
- Works from home: ${profile.works_from_home}
- Living alone: ${profile.living_alone}

FIT SCORE: ${fitResult.score}/100 (${fitResult.pass ? 'PASS' : 'FAIL'})
${fitResult.failReason ? `FAIL REASON: ${fitResult.failReason}` : ''}
TOP MATCHES: ${fitResult.topMatches.join(', ')}
CONCERNS: ${fitResult.concerns.join(', ')}
`;

  const fullPrompt = `${EXPLAIN_PROMPT}

${context}

Generate the personalized explanation:`;

  // Call Gemini Flash-lite (cheapest)
  const response = await callGeminiRest(fullPrompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.3,
    maxOutputTokens: 1000,
    responseMimeType: 'application/json',
  });
  
  if (!response.success || !response.text) {
    console.error(`[WPA/explain] Error for ${listingId}:`, response.error);
    return null;
  }
  
  // Parse response
  try {
    const parsed = JSON.parse(response.text);
    
    const explanation: PersonalizedExplanation = {
      listing_id: listingId,
      user_id: userId,
      explanation: parsed.explanation || '',
      matchReasons: (parsed.matchReasons || []).map((r: any) => ({
        dimension: r.dimension,
        score: r.score,
        userPriority: r.userPriority || 'medium',
        explanation: r.explanation,
      })),
      tradeoffs: (parsed.tradeoffs || []).map((t: any) => ({
        dimension: t.dimension,
        score: t.score,
        explanation: t.explanation,
      })),
      lifeSituationNotes: parsed.lifeSituationNotes || [],
      recommendation: parsed.recommendation || 'maybe',
      generatedAt: new Date().toISOString(),
    };
    
    // Cache result
    await cacheExplanation(explanation);
    
    console.log(`[WPA/explain] Completed for ${listingId}/${userId}:`, {
      recommendation: explanation.recommendation,
      matchCount: explanation.matchReasons.length,
    });
    
    return explanation;
  } catch (error) {
    console.error(`[WPA/explain] Parse error for ${listingId}:`, error);
    return null;
  }
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, userId, scores, profile, fitResult, skipCache } = body;
    
    if (!listingId || !userId) {
      return NextResponse.json(
        { error: 'listingId and userId are required' },
        { status: 400 }
      );
    }
    
    if (!scores) {
      return NextResponse.json(
        { error: 'scores object is required (from /api/wpa/score)' },
        { status: 400 }
      );
    }
    
    if (!profile) {
      return NextResponse.json(
        { error: 'profile object is required (user fit profile)' },
        { status: 400 }
      );
    }
    
    if (!fitResult) {
      return NextResponse.json(
        { error: 'fitResult object is required' },
        { status: 400 }
      );
    }
    
    // Check cache first (unless skipCache is set)
    if (!skipCache) {
      const cached = await getCachedExplanation(listingId, userId);
      if (cached) {
        return NextResponse.json({
          success: true,
          explanation: cached,
          cached: true,
        });
      }
    }
    
    // Generate new explanation
    const explanation = await generateExplanation(
      listingId,
      userId,
      scores,
      profile,
      fitResult
    );
    
    if (!explanation) {
      return NextResponse.json(
        { error: 'Failed to generate explanation' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      explanation,
      cached: false,
    });
    
  } catch (error: any) {
    console.error('[WPA/explain] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve cached explanation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    const userId = searchParams.get('userId');
    
    if (!listingId || !userId) {
      return NextResponse.json(
        { error: 'listingId and userId query parameters are required' },
        { status: 400 }
      );
    }
    
    const cached = await getCachedExplanation(listingId, userId);
    
    if (!cached) {
      return NextResponse.json(
        { error: 'Explanation not found', listingId, userId },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      explanation: cached,
    });
    
  } catch (error: any) {
    console.error('[WPA/explain] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

