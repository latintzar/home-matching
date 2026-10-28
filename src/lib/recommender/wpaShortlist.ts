/**
 * WPA on Shortlist
 * 
 * Runs Whole Property Analysis on shortlisted listings for the Recommender.
 * Phase R4 of the Recommender system.
 * 
 * This is a simplified WPA focused on attributes that matter for matching:
 * - Natural light quality
 * - Noise levels (inferred)
 * - Outdoor space
 * - Storage
 * - Condition/renovation needs
 * - Layout quality
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';
import { FilteredListing } from './harvestFilter';

// ============================================================================
// Types
// ============================================================================

export interface RecommenderWPA {
  listing_id: string;
  
  // Key attributes for matching (0-100 scores)
  scores: {
    naturalLight: number;
    quietness: number;        // Inferred from photos/location
    outdoorSpace: number;     // Terrace, balcony, garden
    storage: number;          // Closets, storage rooms
    condition: number;        // How turnkey vs renovation needed
    layout: number;           // Open plan, flow, bedroom separation
    views: number;            // Quality of views from photos
    modernization: number;    // Kitchen, bathrooms modernity
  };
  
  // Textual insights
  insights: {
    lightDescription: string;
    outdoorDescription: string;
    conditionDescription: string;
    layoutDescription: string;
    standoutFeatures: string[];
    concerns: string[];
  };
  
  // Metadata
  photoCount: number;
  confidence: 'high' | 'medium' | 'low';
  analyzedAt: string;
}

export interface WPAResult {
  listing: FilteredListing;
  wpa: RecommenderWPA | null;
  error?: string;
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

/**
 * Get cached WPA from DynamoDB
 */
async function getCachedWPA(listingId: string): Promise<RecommenderWPA | null> {
  try {
    const client = getDocClient();
    const result = await client.send(new GetCommand({
      TableName: 'leo-wpa-cache',
      Key: { listing_id: listingId },
    }));
    
    if (result.Item) {
      console.log(`[WPA] Cache hit for ${listingId}`);
      return result.Item as RecommenderWPA;
    }
    
    return null;
  } catch (error) {
    console.error('[WPA] Cache read error:', error);
    return null;
  }
}

/**
 * Save WPA to DynamoDB cache
 */
async function cacheWPA(wpa: RecommenderWPA): Promise<void> {
  try {
    const client = getDocClient();
    await client.send(new PutCommand({
      TableName: 'leo-wpa-cache',
      Item: wpa,
    }));
    console.log(`[WPA] Cached result for ${wpa.listing_id}`);
  } catch (error) {
    console.error('[WPA] Cache write error:', error);
  }
}

// ============================================================================
// Image Fetching
// ============================================================================

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<GeminiImageInput | null> {
  try {
    // Use photo proxy to avoid CORS issues
    const proxyUrl = `/api/photo-proxy?url=${encodeURIComponent(url)}`;
    
    // For server-side, fetch directly
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      console.log(`[WPA] Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Map content type to allowed types
    let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
    if (contentType.includes('png')) mimeType = 'image/png';
    else if (contentType.includes('webp')) mimeType = 'image/webp';
    else if (contentType.includes('gif')) mimeType = 'image/gif';
    
    return { mimeType, data: base64 };
  } catch (error) {
    console.log(`[WPA] Image fetch error: ${error}`);
    return null;
  }
}

// ============================================================================
// WPA Generation
// ============================================================================

const RECOMMENDER_WPA_PROMPT = `You are analyzing a property listing for a home recommendation system.
Your goal is to extract attributes that help match buyers to properties based on lifestyle fit.

Analyze the photos and provide:

1. SCORES (0-100 for each):
- naturalLight: How bright and well-lit are the spaces? (100 = abundant natural light, floor-to-ceiling windows)
- quietness: Based on location/views, how quiet would this be? (100 = isolated, green views; 0 = busy street)
- outdoorSpace: Quality of terrace/balcony/garden (100 = large private garden; 0 = no outdoor space)
- storage: Closet space, storage rooms visible (100 = walk-in closets, storage room; 0 = minimal)
- condition: How move-in ready? (100 = brand new/recently renovated; 0 = needs full renovation)
- layout: Flow, room separation, practicality (100 = excellent open plan + private bedrooms)
- views: Quality of views from windows (100 = panoramic city/nature views; 0 = brick wall)
- modernization: Kitchen/bathroom modernity (100 = modern appliances, new fixtures)

2. INSIGHTS (brief text):
- lightDescription: One sentence about natural light
- outdoorDescription: One sentence about outdoor space
- conditionDescription: One sentence about renovation needs
- layoutDescription: One sentence about the layout
- standoutFeatures: Array of 2-3 best features
- concerns: Array of 1-2 potential issues

3. CONFIDENCE: 'high' (5+ good photos), 'medium' (3-4 photos), 'low' (1-2 photos)

Respond in JSON format matching this schema exactly.`;

/**
 * Run WPA on a single listing
 */
export async function runWPA(listing: FilteredListing): Promise<RecommenderWPA | null> {
  const listingId = listing.listing_id;
  
  // Check cache first
  const cached = await getCachedWPA(listingId);
  if (cached) {
    return cached;
  }
  
  console.log(`[WPA] Analyzing listing ${listingId}`);
  
  // Get photos
  const photoUrls = listing.image_urls || [];
  if (photoUrls.length === 0) {
    console.log(`[WPA] No photos for ${listingId}`);
    return null;
  }
  
  // Fetch up to 8 photos (balance between coverage and cost)
  const maxPhotos = 8;
  const photosToFetch = photoUrls.slice(0, maxPhotos);
  
  console.log(`[WPA] Fetching ${photosToFetch.length} photos...`);
  
  const images: GeminiImageInput[] = [];
  for (const url of photosToFetch) {
    const img = await fetchImageAsBase64(url);
    if (img) {
      images.push(img);
    }
  }
  
  if (images.length === 0) {
    console.log(`[WPA] Could not fetch any images for ${listingId}`);
    return null;
  }
  
  console.log(`[WPA] Fetched ${images.length} images, calling Gemini...`);
  
  // Build context
  const context = `
Property: ${listing.title || 'Unknown'}
Location: ${listing.city || ''} ${listing.region || ''}
Price: ${listing.price ? `€${listing.price.toLocaleString()}` : 'Unknown'}
Size: ${listing.sqm ? `${listing.sqm}m²` : 'Unknown'}
Bedrooms: ${listing.bedrooms || 'Unknown'}
Bathrooms: ${listing.bathrooms || 'Unknown'}
`;

  const fullPrompt = `${RECOMMENDER_WPA_PROMPT}

Property Context:
${context}

Analyze the ${images.length} photos below:`;

  // Call Gemini
  const response = await callGeminiRest(fullPrompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    maxOutputTokens: 2000,
    responseMimeType: 'application/json',
    images,
  });
  
  if (!response.success || !response.text) {
    console.error(`[WPA] Gemini error for ${listingId}:`, response.error);
    return null;
  }
  
  // Parse response
  try {
    let parsed = JSON.parse(response.text);
    
    // Normalize structure
    const wpa: RecommenderWPA = {
      listing_id: listingId,
      scores: {
        naturalLight: parsed.scores?.naturalLight ?? parsed.naturalLight ?? 50,
        quietness: parsed.scores?.quietness ?? parsed.quietness ?? 50,
        outdoorSpace: parsed.scores?.outdoorSpace ?? parsed.outdoorSpace ?? 50,
        storage: parsed.scores?.storage ?? parsed.storage ?? 50,
        condition: parsed.scores?.condition ?? parsed.condition ?? 50,
        layout: parsed.scores?.layout ?? parsed.layout ?? 50,
        views: parsed.scores?.views ?? parsed.views ?? 50,
        modernization: parsed.scores?.modernization ?? parsed.modernization ?? 50,
      },
      insights: {
        lightDescription: parsed.insights?.lightDescription ?? parsed.lightDescription ?? '',
        outdoorDescription: parsed.insights?.outdoorDescription ?? parsed.outdoorDescription ?? '',
        conditionDescription: parsed.insights?.conditionDescription ?? parsed.conditionDescription ?? '',
        layoutDescription: parsed.insights?.layoutDescription ?? parsed.layoutDescription ?? '',
        standoutFeatures: parsed.insights?.standoutFeatures ?? parsed.standoutFeatures ?? [],
        concerns: parsed.insights?.concerns ?? parsed.concerns ?? [],
      },
      photoCount: images.length,
      confidence: images.length >= 5 ? 'high' : images.length >= 3 ? 'medium' : 'low',
      analyzedAt: new Date().toISOString(),
    };
    
    // Cache result
    await cacheWPA(wpa);
    
    console.log(`[WPA] Completed for ${listingId}:`, {
      naturalLight: wpa.scores.naturalLight,
      condition: wpa.scores.condition,
      confidence: wpa.confidence,
    });
    
    return wpa;
  } catch (error) {
    console.error(`[WPA] Parse error for ${listingId}:`, error);
    return null;
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Run WPA on multiple listings with rate limiting
 */
export async function runWPABatch(
  listings: FilteredListing[],
  options: {
    maxConcurrent?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<WPAResult[]> {
  const { maxConcurrent = 2, delayMs = 1000, onProgress } = options;
  
  console.log(`[WPA] Starting batch of ${listings.length} listings`);
  
  const results: WPAResult[] = [];
  let completed = 0;
  
  // Process in batches to respect rate limits
  for (let i = 0; i < listings.length; i += maxConcurrent) {
    const batch = listings.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async (listing) => {
      try {
        const wpa = await runWPA(listing);
        return { listing, wpa };
      } catch (error: any) {
        return { listing, wpa: null, error: error.message };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    completed += batch.length;
    onProgress?.(completed, listings.length);
    
    // Delay between batches
    if (i + maxConcurrent < listings.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successCount = results.filter(r => r.wpa !== null).length;
  console.log(`[WPA] Batch complete: ${successCount}/${listings.length} successful`);
  
  return results;
}

/**
 * Get WPA results for listings, using cache where available
 */
export async function getWPAForListings(listings: FilteredListing[]): Promise<WPAResult[]> {
  const results: WPAResult[] = [];
  const needsAnalysis: FilteredListing[] = [];
  
  // Check cache first
  for (const listing of listings) {
    const cached = await getCachedWPA(listing.listing_id);
    if (cached) {
      results.push({ listing, wpa: cached });
    } else {
      needsAnalysis.push(listing);
    }
  }
  
  console.log(`[WPA] Cache: ${results.length} hits, ${needsAnalysis.length} misses`);
  
  // Run WPA on uncached listings
  if (needsAnalysis.length > 0) {
    const newResults = await runWPABatch(needsAnalysis);
    results.push(...newResults);
  }
  
  return results;
}

