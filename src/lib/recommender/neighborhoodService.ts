/**
 * Neighborhood Service
 * 
 * Integrates H3 geo-lookup with neighborhood profiles for fit scoring.
 * 
 * Usage:
 *   const profile = await getNeighborhoodProfile(lat, lng);
 *   const score = calculateNeighborhoodMatch(profile, userWeights);
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { lookupNeighborhood, lookupNeighborhoodFast, preloadH3Cache, H3LookupEntry } from '@/lib/geo/h3-lookup';
import { NeighborhoodProfile, flattenNeighborhoodScores, NeighborhoodScores } from '@/types/neighborhood';

// ============================================================================
// Config
// ============================================================================

const PROFILES_TABLE = 'leo-neighborhood-profiles';

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
// Profile Cache
// ============================================================================

// In-memory cache for neighborhood profiles
let profileCache: Map<string, NeighborhoodProfile> | null = null;

/**
 * Preload all neighborhood profiles into memory
 */
export async function preloadNeighborhoodProfiles(): Promise<void> {
  const client = getDocClient();
  profileCache = new Map();
  
  let lastKey: any;
  
  do {
    const result = await client.send(new ScanCommand({
      TableName: PROFILES_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const profile = item as NeighborhoodProfile;
      profileCache.set(profile.neighborhood_id, profile);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`[NeighborhoodService] Preloaded ${profileCache.size} neighborhood profiles`);
}

/**
 * Initialize both H3 lookup and profile caches
 */
export async function initializeNeighborhoodService(): Promise<void> {
  await Promise.all([
    preloadH3Cache(),
    preloadNeighborhoodProfiles(),
  ]);
  console.log('[NeighborhoodService] Service initialized');
}

// ============================================================================
// Profile Lookup
// ============================================================================

/**
 * Get neighborhood profile by ID
 */
export async function getNeighborhoodProfileById(neighborhoodId: string): Promise<NeighborhoodProfile | null> {
  // Try cache first
  if (profileCache) {
    return profileCache.get(neighborhoodId) || null;
  }
  
  // Fallback to DynamoDB
  const client = getDocClient();
  
  try {
    const result = await client.send(new GetCommand({
      TableName: PROFILES_TABLE,
      Key: { neighborhood_id: neighborhoodId },
    }));
    
    return result.Item as NeighborhoodProfile || null;
  } catch (error) {
    console.error(`[NeighborhoodService] Profile lookup error for ${neighborhoodId}:`, error);
    return null;
  }
}

/**
 * Get neighborhood profile for a lat/lng location
 */
export async function getNeighborhoodProfile(lat: number, lng: number): Promise<NeighborhoodProfile | null> {
  // First, find which neighborhood this lat/lng is in
  let h3Entry: H3LookupEntry | null;
  
  try {
    // Try fast in-memory lookup first
    h3Entry = lookupNeighborhoodFast(lat, lng);
  } catch {
    // Fallback to DynamoDB lookup
    h3Entry = await lookupNeighborhood(lat, lng);
  }
  
  if (!h3Entry) {
    return null;
  }
  
  // Then get the full profile
  return getNeighborhoodProfileById(h3Entry.neighborhood_id);
}

/**
 * Get neighborhood scores for fit scoring (flattened format)
 */
export async function getNeighborhoodScores(lat: number, lng: number): Promise<NeighborhoodScores | null> {
  const profile = await getNeighborhoodProfile(lat, lng);
  
  if (!profile) {
    return null;
  }
  
  return flattenNeighborhoodScores(profile);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch get neighborhood profiles for multiple listings
 */
export async function batchGetNeighborhoodProfiles(
  listings: Array<{ listing_id: string; lat: number; lng: number }>
): Promise<Map<string, NeighborhoodProfile | null>> {
  const results = new Map<string, NeighborhoodProfile | null>();
  
  for (const listing of listings) {
    const profile = await getNeighborhoodProfile(listing.lat, listing.lng);
    results.set(listing.listing_id, profile);
  }
  
  return results;
}

/**
 * Get all neighborhood profiles for a city
 */
export async function getNeighborhoodsByCity(city: string): Promise<NeighborhoodProfile[]> {
  // Try cache first
  if (profileCache) {
    return Array.from(profileCache.values()).filter(p => 
      p.city.toLowerCase() === city.toLowerCase()
    );
  }
  
  // Fallback to DynamoDB scan
  const client = getDocClient();
  const profiles: NeighborhoodProfile[] = [];
  
  let lastKey: any;
  
  do {
    const result = await client.send(new ScanCommand({
      TableName: PROFILES_TABLE,
      FilterExpression: 'city = :city',
      ExpressionAttributeValues: {
        ':city': city.toLowerCase(),
      },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      profiles.push(item as NeighborhoodProfile);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return profiles;
}

// ============================================================================
// Default/Fallback Profiles
// ============================================================================

/**
 * Get a default neighborhood profile when no data is available
 */
export function getDefaultNeighborhoodProfile(city: string): NeighborhoodProfile {
  return {
    neighborhood_id: `${city.toLowerCase()}-unknown`,
    city: city.toLowerCase(),
    name: 'Unknown',
    
    life_stages: {
      student_friendly: 50,
      young_professional: 50,
      couple_friendly: 50,
      family_friendly: 50,
      retiree_friendly: 50,
    },
    
    lifestyle: {
      digital_nomad: 50,
      fitness_active: 50,
      foodie_scene: 50,
      nightlife_social: 50,
      arts_culture: 50,
      nature_outdoor: 50,
      pet_friendly: 50,
      lgbtq_friendly: 50,
      eco_conscious: 50,
    },
    
    universal: {
      safety: 50,
      quietness: 50,
      transport: 50,
      vibes: ['neutral'],
    },
    
    economics: {
      gentrification_stage: 'unknown',
      budget_level: 'middle',
    },
    
    source_count: 0,
    confidence: 'low',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Get neighborhood profile with fallback to default
 */
export async function getNeighborhoodProfileWithDefault(
  lat: number,
  lng: number,
  city: string
): Promise<NeighborhoodProfile> {
  const profile = await getNeighborhoodProfile(lat, lng);
  
  if (profile) {
    return profile;
  }
  
  return getDefaultNeighborhoodProfile(city);
}

// ============================================================================
// Exports
// ============================================================================

export { PROFILES_TABLE };

