/**
 * H3 Geo-Lookup for Neighborhood Profiles
 * 
 * Uses H3 hexagonal indexing for efficient property-to-neighborhood matching.
 * 
 * Resolution 7 = ~5km² hexagons (perfect for neighborhoods)
 * Resolution 8 = ~0.7km² hexagons (for denser urban areas)
 * 
 * Flow:
 * 1. Pre-compute H3 index for each neighborhood center
 * 2. Store neighborhood_id -> h3_index mapping in DynamoDB
 * 3. At query time: lat,lng -> H3 index -> neighborhood profile
 */

import { DynamoDBDocumentClient, QueryCommand, PutCommand, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import * as h3 from 'h3-js';

// ============================================================================
// Config
// ============================================================================

const H3_RESOLUTION = 7; // ~5km² per hexagon
const H3_LOOKUP_TABLE = 'leo-h3-lookup';

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
// Types
// ============================================================================

export interface H3LookupEntry {
  h3_index: string;
  neighborhood_id: string;
  city: string;
  neighborhood_name: string;
}

export interface NeighborhoodCoordinates {
  neighborhood_id: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
}

// ============================================================================
// H3 Index Functions
// ============================================================================

/**
 * Convert lat/lng to H3 index at configured resolution
 */
export function latLngToH3(lat: number, lng: number): string {
  return h3.latLngToCell(lat, lng, H3_RESOLUTION);
}

/**
 * Get H3 indexes for a neighborhood area (center + ring)
 * This accounts for properties on the edge of neighborhoods
 */
export function getH3CoverageForNeighborhood(lat: number, lng: number, ringSize: number = 1): string[] {
  const centerH3 = latLngToH3(lat, lng);
  return h3.gridDisk(centerH3, ringSize);
}

// ============================================================================
// DynamoDB Operations
// ============================================================================

/**
 * Build H3 lookup table from neighborhood coordinates
 */
export async function buildH3LookupTable(neighborhoods: NeighborhoodCoordinates[]): Promise<void> {
  const client = getDocClient();
  const entries: H3LookupEntry[] = [];
  
  console.log(`Building H3 lookup table for ${neighborhoods.length} neighborhoods...`);
  
  for (const n of neighborhoods) {
    // Get center and surrounding hexagons
    const h3Indexes = getH3CoverageForNeighborhood(n.lat, n.lng, 1);
    
    for (const h3Index of h3Indexes) {
      entries.push({
        h3_index: h3Index,
        neighborhood_id: n.neighborhood_id,
        city: n.city,
        neighborhood_name: n.name,
      });
    }
  }
  
  // Batch write to DynamoDB
  for (let i = 0; i < entries.length; i += 25) {
    const batch = entries.slice(i, i + 25);
    
    const writeRequests = batch.map(e => ({
      PutRequest: { Item: e },
    }));
    
    try {
      await client.send(new BatchWriteCommand({
        RequestItems: {
          [H3_LOOKUP_TABLE]: writeRequests,
        },
      }));
    } catch (error) {
      console.error('Batch write error:', error);
      
      // Fallback to individual writes
      for (const entry of batch) {
        try {
          await client.send(new PutCommand({
            TableName: H3_LOOKUP_TABLE,
            Item: entry,
          }));
        } catch (e) {
          console.error('Individual write error:', e);
        }
      }
    }
  }
  
  console.log(`✅ Built H3 lookup table with ${entries.length} entries`);
}

/**
 * Look up neighborhood for a property by lat/lng
 */
export async function lookupNeighborhood(lat: number, lng: number): Promise<H3LookupEntry | null> {
  const client = getDocClient();
  const h3Index = latLngToH3(lat, lng);
  
  try {
    const result = await client.send(new QueryCommand({
      TableName: H3_LOOKUP_TABLE,
      KeyConditionExpression: 'h3_index = :h3',
      ExpressionAttributeValues: {
        ':h3': h3Index,
      },
      Limit: 1,
    }));
    
    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as H3LookupEntry;
    }
    
    return null;
  } catch (error) {
    console.error('H3 lookup error:', error);
    return null;
  }
}

/**
 * Batch lookup neighborhoods for multiple properties
 */
export async function batchLookupNeighborhoods(
  coordinates: Array<{ lat: number; lng: number; listing_id: string }>
): Promise<Map<string, H3LookupEntry | null>> {
  const results = new Map<string, H3LookupEntry | null>();
  
  // Group by H3 index to minimize queries
  const h3ToListings = new Map<string, string[]>();
  for (const coord of coordinates) {
    const h3Index = latLngToH3(coord.lat, coord.lng);
    const existing = h3ToListings.get(h3Index) || [];
    existing.push(coord.listing_id);
    h3ToListings.set(h3Index, existing);
  }
  
  // Query each unique H3 index
  for (const [h3Index, listingIds] of h3ToListings) {
    const entry = await lookupNeighborhood(
      ...h3.cellToLatLng(h3Index) as [number, number]
    );
    
    for (const listingId of listingIds) {
      results.set(listingId, entry);
    }
  }
  
  return results;
}

// ============================================================================
// Geocoding (Using Nominatim or similar)
// ============================================================================

/**
 * Geocode a neighborhood name to coordinates
 * Uses OSM Nominatim (FREE, rate limited)
 */
export async function geocodeNeighborhood(
  neighborhood: string,
  city: string
): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${neighborhood}, ${city}, Spain`);
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'PuedoCasa/1.0',
        },
      }
    );
    
    if (!response.ok) {
      console.error(`Nominatim error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Geocoding error for ${neighborhood}, ${city}:`, error);
    return null;
  }
}

/**
 * Batch geocode neighborhoods with rate limiting
 */
export async function batchGeocodeNeighborhoods(
  neighborhoods: Array<{ neighborhood_id: string; city: string; name: string }>
): Promise<NeighborhoodCoordinates[]> {
  const results: NeighborhoodCoordinates[] = [];
  
  for (const n of neighborhoods) {
    const coords = await geocodeNeighborhood(n.name, n.city);
    
    if (coords) {
      results.push({
        neighborhood_id: n.neighborhood_id,
        city: n.city,
        name: n.name,
        lat: coords.lat,
        lng: coords.lng,
      });
    }
    
    // Rate limit: 1 request per second for Nominatim
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  
  return results;
}

// ============================================================================
// In-Memory Cache for Fast Lookups
// ============================================================================

// Cache structure: H3 index -> neighborhood entry
let h3Cache: Map<string, H3LookupEntry> | null = null;

/**
 * Load entire H3 lookup table into memory for fast lookups
 * Use this if you're processing many properties
 */
export async function preloadH3Cache(): Promise<void> {
  const client = getDocClient();
  h3Cache = new Map();
  
  let lastKey: any;
  
  do {
    const result = await client.send(new ScanCommand({
      TableName: H3_LOOKUP_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const entry = item as H3LookupEntry;
      h3Cache.set(entry.h3_index, entry);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`Preloaded ${h3Cache.size} H3 entries into cache`);
}

/**
 * Fast in-memory lookup (requires preloadH3Cache)
 */
export function lookupNeighborhoodFast(lat: number, lng: number): H3LookupEntry | null {
  if (!h3Cache) {
    throw new Error('H3 cache not loaded. Call preloadH3Cache() first.');
  }
  
  const h3Index = latLngToH3(lat, lng);
  return h3Cache.get(h3Index) || null;
}

// ============================================================================
// Exports
// ============================================================================

export {
  H3_RESOLUTION,
  H3_LOOKUP_TABLE,
};

