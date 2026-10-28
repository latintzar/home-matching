/**
 * WPA Caching Service
 * 
 * Caches WPA results in DynamoDB for cost savings.
 * Each listing can have multiple cache entries:
 *   - 'instant': Fast WPA results (5 photos, basic analysis)
 *   - 'descriptions': Full property descriptions
 *   - 'scores': 35-dimension scores
 *   - 'full': Complete WPA (descriptions + scores combined)
 * 
 * Cache invalidation:
 *   - Photos change (different photo hash)
 *   - 30 days TTL
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';

// ============================================================================
// Config
// ============================================================================

const CACHE_TABLE = 'leo-wpa-cache';
const CACHE_TTL_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

export type WpaMode = 'instant' | 'descriptions' | 'scores' | 'full';

export interface WpaCacheEntry {
  listing_id: string;
  wpa_mode: WpaMode;
  city: string;
  
  // Photo fingerprint for invalidation
  photo_hash: string;
  
  // Cached data (depends on mode)
  data: any;
  
  // Metadata
  created_at: string;
  ttl: number; // Unix timestamp for DynamoDB TTL
}

export interface WpaDescriptions {
  overall_impression: string;
  space_and_layout: string;
  light_and_brightness: string;
  condition_and_finishes: string;
  kitchen_assessment: string;
  bathroom_assessment: string;
  storage_and_functionality: string;
  outdoor_space: string;
  standout_features: string;
  concerns_or_issues: string;
}

export interface WpaScores {
  // Condition (0-100)
  overall_condition: number;
  renovation_needed: number;
  move_in_ready: number;
  
  // Space
  space_efficiency: number;
  storage_adequacy: number;
  room_proportions: number;
  
  // Light
  natural_light: number;
  brightness_overall: number;
  window_quality: number;
  
  // Kitchen
  kitchen_modernity: number;
  kitchen_functionality: number;
  kitchen_storage: number;
  
  // Bathroom
  bathroom_modernity: number;
  bathroom_functionality: number;
  bathroom_size: number;
  
  // Finishes
  flooring_quality: number;
  wall_condition: number;
  fixtures_quality: number;
  
  // Character
  architectural_interest: number;
  charm_factor: number;
  instagram_worthy: number;
  
  // Practical
  layout_flow: number;
  privacy: number;
  noise_insulation: number;
  
  // Outdoor
  outdoor_space: number;
  view_quality: number;
  
  // Safety/Comfort
  security_features: number;
  heating_cooling: number;
  ventilation: number;
  
  // Red flags
  structural_concerns: number;
  moisture_issues: number;
  electrical_concerns: number;
  plumbing_concerns: number;
  
  // Summary
  overall_appeal: number;
  value_for_money: number;
}

export interface WpaInstantResult {
  quickScore: number;
  standouts: string[];
  concerns: string[];
}

export interface WpaFullResult {
  descriptions: WpaDescriptions;
  scores: WpaScores;
  highlights: string[];
  concerns: string[];
  red_flags: string[];
  safety: Record<string, boolean>;
  comfort_extras: Record<string, boolean>;
  confidence: number;
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
// Photo Hash (for cache invalidation)
// ============================================================================

/**
 * Generate a hash of photo URLs for cache invalidation
 */
export function generatePhotoHash(photoUrls: string[]): string {
  const sortedUrls = [...photoUrls].sort();
  return crypto.createHash('md5').update(sortedUrls.join('|')).digest('hex').substring(0, 12);
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached WPA result if available and valid
 */
export async function getWpaCached(
  listingId: string,
  mode: WpaMode,
  currentPhotoHash: string
): Promise<any | null> {
  const client = getDocClient();
  
  try {
    const result = await client.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: {
        listing_id: listingId,
        wpa_mode: mode,
      },
    }));
    
    if (!result.Item) {
      return null;
    }
    
    const entry = result.Item as WpaCacheEntry;
    
    // Check if photos have changed
    if (entry.photo_hash !== currentPhotoHash) {
      console.log(`[WPA Cache] Photo hash mismatch for ${listingId}:${mode}, invalidating`);
      return null;
    }
    
    // Check TTL (DynamoDB handles this, but double-check)
    if (entry.ttl && entry.ttl < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    console.log(`[WPA Cache] HIT for ${listingId}:${mode}`);
    return entry.data;
    
  } catch (error) {
    console.error(`[WPA Cache] Get error for ${listingId}:${mode}:`, error);
    return null;
  }
}

/**
 * Store WPA result in cache
 */
export async function setWpaCached(
  listingId: string,
  mode: WpaMode,
  city: string,
  photoHash: string,
  data: any
): Promise<void> {
  const client = getDocClient();
  
  const ttl = Math.floor(Date.now() / 1000) + (CACHE_TTL_DAYS * 24 * 60 * 60);
  
  const entry: WpaCacheEntry = {
    listing_id: listingId,
    wpa_mode: mode,
    city: city.toLowerCase(),
    photo_hash: photoHash,
    data,
    created_at: new Date().toISOString(),
    ttl,
  };
  
  try {
    await client.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: entry,
    }));
    console.log(`[WPA Cache] SET ${listingId}:${mode}`);
  } catch (error) {
    console.error(`[WPA Cache] Set error for ${listingId}:${mode}:`, error);
  }
}

/**
 * Invalidate all cached WPA for a listing
 */
export async function invalidateWpaCache(listingId: string): Promise<void> {
  const client = getDocClient();
  const modes: WpaMode[] = ['instant', 'descriptions', 'scores', 'full'];
  
  for (const mode of modes) {
    try {
      await client.send(new DeleteCommand({
        TableName: CACHE_TABLE,
        Key: {
          listing_id: listingId,
          wpa_mode: mode,
        },
      }));
    } catch (error) {
      // Ignore if not found
    }
  }
  
  console.log(`[WPA Cache] Invalidated all cache for ${listingId}`);
}

/**
 * Get all cached WPA for a city (for analysis)
 */
export async function getWpaCacheByCity(city: string): Promise<WpaCacheEntry[]> {
  const client = getDocClient();
  const results: WpaCacheEntry[] = [];
  
  let lastKey: any;
  
  do {
    const result = await client.send(new QueryCommand({
      TableName: CACHE_TABLE,
      IndexName: 'city-index',
      KeyConditionExpression: 'city = :city',
      ExpressionAttributeValues: {
        ':city': city.toLowerCase(),
      },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      results.push(item as WpaCacheEntry);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return results;
}

// ============================================================================
// Cache Stats
// ============================================================================

export interface WpaCacheStats {
  total: number;
  byMode: Record<WpaMode, number>;
  byCity: Record<string, number>;
}

/**
 * Get cache statistics
 */
export async function getWpaCacheStats(): Promise<WpaCacheStats> {
  const client = getDocClient();
  const stats: WpaCacheStats = {
    total: 0,
    byMode: { instant: 0, descriptions: 0, scores: 0, full: 0 },
    byCity: {},
  };
  
  // Note: This is a full scan, only use for debugging
  let lastKey: any;
  
  do {
    const result = await client.send(new QueryCommand({
      TableName: CACHE_TABLE,
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    
    // Can't get detailed stats without full scan
    // This is a simplified version
    stats.total += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return stats;
}

// ============================================================================
// Exports
// ============================================================================

export {
  CACHE_TABLE,
  CACHE_TTL_DAYS,
};

