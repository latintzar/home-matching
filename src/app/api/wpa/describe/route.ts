/**
 * WPA Describe API
 * 
 * Phase 1 of the 2-step WPA pipeline:
 * Vision → Prose (converts photos to detailed descriptions)
 * 
 * Uses Gemini 2.5 Flash for cost-effective vision analysis
 * Output is cached in DynamoDB for reuse across users
 * 
 * Cost: ~$0.05-0.10 per listing (8-15 photos)
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';

// ============================================================================
// Types
// ============================================================================

export interface WPADescription {
  listing_id: string;
  
  // Overall property description
  overall: {
    summary: string;           // 2-3 sentence overview
    style: string;             // "Modern minimalist", "Traditional Spanish", etc.
    condition: string;         // "Move-in ready", "Needs cosmetic updates", etc.
    atmosphere: string;        // "Bright and airy", "Cozy and warm", etc.
  };
  
  // Room-by-room descriptions
  rooms: Array<{
    type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining' | 'outdoor' | 'entrance' | 'storage' | 'other';
    description: string;       // Detailed description of the room
    features: string[];        // Notable features
    concerns: string[];        // Potential issues
    estimatedSize: 'small' | 'medium' | 'large' | 'unknown';
  }>;
  
  // Photo-level observations
  photoObservations: Array<{
    photoIndex: number;
    roomType: string;
    keyFeatures: string[];
    qualityNotes: string;      // "Well-lit", "Dark corners", etc.
  }>;
  
  // Standout features and concerns (across all photos)
  standouts: string[];         // Best 3-5 features
  concerns: string[];          // Top 2-3 concerns
  
  // Metadata
  photoCount: number;
  confidence: 'high' | 'medium' | 'low';
  describedAt: string;
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

const WPA_DESCRIBE_TABLE = 'leo-wpa-descriptions';

async function getCachedDescription(listingId: string): Promise<WPADescription | null> {
  try {
    const client = getDocClient();
    const result = await client.send(new GetCommand({
      TableName: WPA_DESCRIBE_TABLE,
      Key: { listing_id: listingId },
    }));
    
    if (result.Item) {
      console.log(`[WPA/describe] Cache hit for ${listingId}`);
      return result.Item as WPADescription;
    }
    
    return null;
  } catch (error) {
    console.error('[WPA/describe] Cache read error:', error);
    return null;
  }
}

async function cacheDescription(description: WPADescription): Promise<void> {
  try {
    const client = getDocClient();
    await client.send(new PutCommand({
      TableName: WPA_DESCRIBE_TABLE,
      Item: description,
    }));
    console.log(`[WPA/describe] Cached result for ${description.listing_id}`);
  } catch (error) {
    console.error('[WPA/describe] Cache write error:', error);
    // Don't throw - caching failure shouldn't fail the request
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
      console.log(`[WPA/describe] Failed to fetch image: ${response.status}`);
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
    console.log(`[WPA/describe] Image fetch error:`, error);
    return null;
  }
}

// ============================================================================
// WPA Description Generation
// ============================================================================

const WPA_DESCRIBE_PROMPT = `You are an expert real estate analyst creating detailed property descriptions from photos.

Your goal is to create a comprehensive, objective description that captures:
1. The overall character and feel of the property
2. Room-by-room details that matter for daily living
3. Notable features (both positive and concerning)

IMPORTANT: Be specific and observational, not generic. Describe what you SEE.

Analyze ALL the photos and respond with a JSON object:

{
  "overall": {
    "summary": "2-3 sentences summarizing the property's character",
    "style": "Architectural/design style (e.g., 'Modern minimalist', 'Traditional Spanish')",
    "condition": "Current condition (e.g., 'Recently renovated', 'Good but dated')",
    "atmosphere": "Feel of the space (e.g., 'Bright and spacious', 'Cozy and intimate')"
  },
  "rooms": [
    {
      "type": "living|bedroom|kitchen|bathroom|dining|outdoor|entrance|storage|other",
      "description": "Detailed 2-3 sentence description",
      "features": ["Notable feature 1", "Notable feature 2"],
      "concerns": ["Potential concern 1"],
      "estimatedSize": "small|medium|large|unknown"
    }
  ],
  "photoObservations": [
    {
      "photoIndex": 0,
      "roomType": "The room type shown",
      "keyFeatures": ["What stands out in this specific photo"],
      "qualityNotes": "Photo lighting/angle quality notes"
    }
  ],
  "standouts": ["Top 3-5 best features across the property"],
  "concerns": ["Top 2-3 concerns or potential issues"]
}

Focus on details that matter for daily living:
- Natural light quality and sources
- Storage and closet space
- Kitchen functionality (counter space, appliances, storage)
- Bathroom condition and fixtures
- Outdoor space (balcony, terrace, views)
- Flow between rooms
- Noise indicators (street-facing, interior-facing)
- Signs of wear, damage, or needed repairs`;

async function generateDescription(
  listingId: string,
  imageUrls: string[],
  context?: {
    title?: string;
    price?: number;
    sqm?: number;
    bedrooms?: number;
    bathrooms?: number;
    location?: string;
  }
): Promise<WPADescription | null> {
  // Check cache first
  const cached = await getCachedDescription(listingId);
  if (cached) {
    return cached;
  }
  
  console.log(`[WPA/describe] Generating description for ${listingId}`);
  
  if (imageUrls.length === 0) {
    console.log(`[WPA/describe] No photos for ${listingId}`);
    return null;
  }
  
  // Fetch up to 15 photos (balance between coverage and cost)
  const maxPhotos = 15;
  const photosToFetch = imageUrls.slice(0, maxPhotos);
  
  console.log(`[WPA/describe] Fetching ${photosToFetch.length} photos...`);
  
  const images: GeminiImageInput[] = [];
  for (const url of photosToFetch) {
    const img = await fetchImageAsBase64(url);
    if (img) {
      images.push(img);
    }
  }
  
  if (images.length === 0) {
    console.log(`[WPA/describe] Could not fetch any images for ${listingId}`);
    return null;
  }
  
  console.log(`[WPA/describe] Fetched ${images.length} images, calling Gemini...`);
  
  // Build context
  const contextStr = context ? `
Property Context:
- Title: ${context.title || 'Unknown'}
- Location: ${context.location || 'Unknown'}
- Price: ${context.price ? `€${context.price.toLocaleString()}` : 'Unknown'}
- Size: ${context.sqm ? `${context.sqm}m²` : 'Unknown'}
- Bedrooms: ${context.bedrooms || 'Unknown'}
- Bathrooms: ${context.bathrooms || 'Unknown'}
` : '';

  const fullPrompt = `${WPA_DESCRIBE_PROMPT}

${contextStr}
Analyze the ${images.length} photos below and provide your structured description:`;

  // Call Gemini
  const response = await callGeminiRest(fullPrompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 4000,
    responseMimeType: 'application/json',
    images,
  });
  
  if (!response.success || !response.text) {
    console.error(`[WPA/describe] Gemini error for ${listingId}:`, response.error);
    return null;
  }
  
  // Parse response
  try {
    const parsed = JSON.parse(response.text);
    
    const description: WPADescription = {
      listing_id: listingId,
      overall: {
        summary: parsed.overall?.summary || '',
        style: parsed.overall?.style || 'Unknown',
        condition: parsed.overall?.condition || 'Unknown',
        atmosphere: parsed.overall?.atmosphere || 'Unknown',
      },
      rooms: (parsed.rooms || []).map((r: any) => ({
        type: r.type || 'other',
        description: r.description || '',
        features: r.features || [],
        concerns: r.concerns || [],
        estimatedSize: r.estimatedSize || 'unknown',
      })),
      photoObservations: (parsed.photoObservations || []).map((p: any) => ({
        photoIndex: p.photoIndex || 0,
        roomType: p.roomType || 'unknown',
        keyFeatures: p.keyFeatures || [],
        qualityNotes: p.qualityNotes || '',
      })),
      standouts: parsed.standouts || [],
      concerns: parsed.concerns || [],
      photoCount: images.length,
      confidence: images.length >= 10 ? 'high' : images.length >= 5 ? 'medium' : 'low',
      describedAt: new Date().toISOString(),
    };
    
    // Cache result
    await cacheDescription(description);
    
    console.log(`[WPA/describe] Completed for ${listingId}:`, {
      rooms: description.rooms.length,
      standouts: description.standouts.length,
      confidence: description.confidence,
    });
    
    return description;
  } catch (error) {
    console.error(`[WPA/describe] Parse error for ${listingId}:`, error);
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
      const cached = await getCachedDescription(listingId);
      if (cached) {
        return NextResponse.json({
          success: true,
          description: cached,
          cached: true,
        });
      }
    }
    
    // Generate new description
    const description = await generateDescription(listingId, imageUrls, context);
    
    if (!description) {
      return NextResponse.json(
        { error: 'Failed to generate description' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      description,
      cached: false,
    });
    
  } catch (error: any) {
    console.error('[WPA/describe] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve cached description
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
    
    const cached = await getCachedDescription(listingId);
    
    if (!cached) {
      return NextResponse.json(
        { error: 'Description not found', listingId },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      description: cached,
    });
    
  } catch (error: any) {
    console.error('[WPA/describe] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

