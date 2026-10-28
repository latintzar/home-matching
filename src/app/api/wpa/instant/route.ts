/**
 * WPA Instant API
 * 
 * Fast WPA for live calls with ElevenLabs agents.
 * Uses 3-5 hero photos only for 2-3 second latency.
 * 
 * Optimized for real-time use during voice conversations:
 * - Small photo count (3-5 photos)
 * - Shorter prompt
 * - Quick summary format
 * 
 * Uses Claude 3 Haiku on Bedrock for fast vision
 * Fallback to Gemini 2.5 Flash if Bedrock unavailable
 * 
 * Cost: ~$0.02 per listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';

// ============================================================================
// Types
// ============================================================================

export interface InstantWPAResult {
  listing_id: string;
  
  // Quick summary for agent to verbalize
  quickScore: number;            // 0-100 overall impression
  twoStandouts: string[];        // Best 2 features (agent says these)
  oneConcern: string | null;     // Main concern (if any)
  
  // Structured quick scores (for UI)
  quickScores: {
    light: number;               // 0-100
    condition: number;           // 0-100
    space: number;               // 0-100
    outdoor: number | null;      // 0-100 or null if no outdoor
  };
  
  // For agent script
  verbalSummary: string;         // 1-2 sentences agent can read
  
  // Metadata
  photoCount: number;
  latencyMs: number;
  analyzedAt: string;
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

const INSTANT_WPA_TABLE = 'leo-wpa-instant';

async function getCachedInstantWPA(listingId: string): Promise<InstantWPAResult | null> {
  try {
    const client = getDocClient();
    const result = await client.send(new GetCommand({
      TableName: INSTANT_WPA_TABLE,
      Key: { listing_id: listingId },
    }));
    
    if (result.Item) {
      console.log(`[WPA/instant] Cache hit for ${listingId}`);
      return result.Item as InstantWPAResult;
    }
    
    return null;
  } catch (error) {
    console.error('[WPA/instant] Cache read error:', error);
    return null;
  }
}

async function cacheInstantWPA(result: InstantWPAResult): Promise<void> {
  try {
    const client = getDocClient();
    await client.send(new PutCommand({
      TableName: INSTANT_WPA_TABLE,
      Item: result,
    }));
    console.log(`[WPA/instant] Cached result for ${result.listing_id}`);
  } catch (error) {
    console.error('[WPA/instant] Cache write error:', error);
  }
}

// ============================================================================
// Image Fetching
// ============================================================================

async function fetchImageAsBase64(url: string): Promise<GeminiImageInput | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeoCasa/1.0)',
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
    if (contentType.includes('png')) mimeType = 'image/png';
    else if (contentType.includes('webp')) mimeType = 'image/webp';
    else if (contentType.includes('gif')) mimeType = 'image/gif';
    
    return { mimeType, data: base64 };
  } catch (error) {
    return null;
  }
}

/**
 * Select hero photos (first photo usually best, + kitchen, bathroom, outdoor if available)
 */
function selectHeroPhotos(urls: string[], max: number = 5): string[] {
  if (urls.length <= max) {
    return urls;
  }
  
  // Always include first photo (usually hero shot)
  const selected = [urls[0]];
  
  // Add photos from different parts of the listing
  // Heuristic: spread evenly through the set
  const step = Math.floor((urls.length - 1) / (max - 1));
  for (let i = 1; i < max && i * step < urls.length; i++) {
    selected.push(urls[i * step]);
  }
  
  return selected.slice(0, max);
}

// ============================================================================
// Instant WPA Generation
// ============================================================================

const INSTANT_WPA_PROMPT = `Analyze these property photos QUICKLY for a live voice assistant.

Provide a BRIEF assessment that can be spoken aloud:

{
  "quickScore": 0-100 overall impression,
  "twoStandouts": ["Best feature 1", "Best feature 2"],
  "oneConcern": "Main concern" or null if none obvious,
  "quickScores": {
    "light": 0-100 natural light,
    "condition": 0-100 move-in ready,
    "space": 0-100 room sizes,
    "outdoor": 0-100 or null if no outdoor space visible
  },
  "verbalSummary": "1-2 sentences the agent can read aloud to describe the property"
}

Be concise. This is for a live phone call.
Focus on what matters for daily living: light, space, condition.
The verbalSummary should sound natural when spoken.`;

async function generateInstantWPA(
  listingId: string,
  imageUrls: string[],
  context?: { price?: number; sqm?: number; bedrooms?: number }
): Promise<InstantWPAResult | null> {
  const startTime = Date.now();
  
  // Check cache first
  const cached = await getCachedInstantWPA(listingId);
  if (cached) {
    return cached;
  }
  
  console.log(`[WPA/instant] Quick analysis for ${listingId}`);
  
  if (imageUrls.length === 0) {
    console.log(`[WPA/instant] No photos for ${listingId}`);
    return null;
  }
  
  // Select 3-5 hero photos
  const heroUrls = selectHeroPhotos(imageUrls, 5);
  
  console.log(`[WPA/instant] Fetching ${heroUrls.length} hero photos...`);
  
  const images: GeminiImageInput[] = [];
  for (const url of heroUrls) {
    const img = await fetchImageAsBase64(url);
    if (img) {
      images.push(img);
    }
  }
  
  if (images.length === 0) {
    console.log(`[WPA/instant] Could not fetch any images for ${listingId}`);
    return null;
  }
  
  // Build prompt with context
  const contextStr = context ? `Context: €${context.price?.toLocaleString() || '?'}, ${context.sqm || '?'}m², ${context.bedrooms || '?'} bed` : '';
  const fullPrompt = `${INSTANT_WPA_PROMPT}\n\n${contextStr}`;
  
  // Call Gemini Flash for speed (fallback from Haiku)
  const response = await callGeminiRest(fullPrompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.1,
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
    images,
  });
  
  const latencyMs = Date.now() - startTime;
  
  if (!response.success || !response.text) {
    console.error(`[WPA/instant] Error for ${listingId}:`, response.error);
    return null;
  }
  
  // Parse response
  try {
    const parsed = JSON.parse(response.text);
    
    const result: InstantWPAResult = {
      listing_id: listingId,
      quickScore: parsed.quickScore ?? 50,
      twoStandouts: (parsed.twoStandouts || []).slice(0, 2),
      oneConcern: parsed.oneConcern || null,
      quickScores: {
        light: parsed.quickScores?.light ?? 50,
        condition: parsed.quickScores?.condition ?? 50,
        space: parsed.quickScores?.space ?? 50,
        outdoor: parsed.quickScores?.outdoor ?? null,
      },
      verbalSummary: parsed.verbalSummary || 'A property worth considering.',
      photoCount: images.length,
      latencyMs,
      analyzedAt: new Date().toISOString(),
    };
    
    // Cache result
    await cacheInstantWPA(result);
    
    console.log(`[WPA/instant] Completed for ${listingId} in ${latencyMs}ms:`, {
      quickScore: result.quickScore,
      standouts: result.twoStandouts.length,
    });
    
    return result;
  } catch (error) {
    console.error(`[WPA/instant] Parse error for ${listingId}:`, error);
    return null;
  }
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, imageUrls, context, skipCache } = body;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
        { status: 400 }
      );
    }
    
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'imageUrls array is required' },
        { status: 400 }
      );
    }
    
    // Check cache first (unless skipCache is set)
    if (!skipCache) {
      const cached = await getCachedInstantWPA(listingId);
      if (cached) {
        return NextResponse.json({
          success: true,
          result: cached,
          cached: true,
        });
      }
    }
    
    // Generate new instant WPA
    const result = await generateInstantWPA(listingId, imageUrls, context);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to generate instant WPA' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      result,
      cached: false,
    });
    
  } catch (error: any) {
    console.error('[WPA/instant] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve cached instant WPA
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
    
    const cached = await getCachedInstantWPA(listingId);
    
    if (!cached) {
      return NextResponse.json(
        { error: 'Instant WPA not found', listingId },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      result: cached,
    });
    
  } catch (error: any) {
    console.error('[WPA/instant] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

