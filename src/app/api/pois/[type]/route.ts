/**
 * POI Query API Endpoint
 * 
 * GET /api/pois/[type]?bbox=minLng,minLat,maxLng,maxLat&filter=sport:tennis
 * 
 * Fetches Points of Interest from DynamoDB within a bounding box.
 * Uses geohash prefixes for efficient querying (Query, not Scan).
 * 
 * Query Parameters:
 * - bbox: Bounding box as "minLng,minLat,maxLng,maxLat" (required)
 * - filter: Optional attribute filter as "key:value" (e.g., "sport:tennis")
 * - limit: Maximum results (default: 500, max: 1000)
 * 
 * Response: GeoJSON FeatureCollection
 * 
 * Performance:
 * - Uses DynamoDB Query with begins_with(SK, geohashPrefix)
 * - Parallel queries for multiple geohash prefixes
 * - ~50-100ms typical latency for Barcelona-sized viewport
 * 
 * @see src/lib/geo/geohash-utils.ts for geohash logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, QueryCommand, QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { bboxToGeohashPrefixes, isPointInBbox, type BoundingBox } from '@/lib/geo/geohash-utils';

// ============================================================================
// Config
// ============================================================================

const TABLE_NAME = 'leo-osm-pois';
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

// Valid POI types (must match import script)
const VALID_POI_TYPES = new Set([
  'parks', 'metro', 'beaches', 'schools', 'healthcare', 
  'playgrounds', 'dog_parks', 'sports_pitches',
  'supermarkets', 'cafes', 'bakeries', 'restaurants', 'bars', 'gyms', 'pharmacies'
]);

// Multi-value attributes use semicolon-delimited values in OSM data
// These require contains() instead of exact match (=) for filtering
// e.g., sport: "tennis;padel" should match filter "sport:tennis"
// @see src/data/osm-schema.json for auto-discovered multi-value attributes
const MULTI_VALUE_ATTRIBUTES = new Set([
  'sport',      // tennis, tennis;padel, soccer;basketball
  'cuisine',    // italian;pizza, fish;seafood;mediterranean
]);

// DynamoDB client (lazy init)
let client: DynamoDBClient | null = null;

function getClient(): DynamoDBClient {
  if (!client) {
    client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

// ============================================================================
// Types
// ============================================================================

interface POIFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    name: string;
    type: string;
    [key: string]: unknown;
  };
}

interface POIResponse {
  type: 'FeatureCollection';
  features: POIFeature[];
  metadata: {
    type: string;
    bbox: BoundingBox;
    count: number;
    geohashPrefixes: string[];
    queryTimeMs: number;
  };
}

// ============================================================================
// Query Logic
// ============================================================================

/**
 * Query POIs for a single geohash prefix.
 */
async function queryPOIsForPrefix(
  type: string,
  prefix: string,
  filter?: { key: string; value: string }
): Promise<Record<string, unknown>[]> {
  const dynamodb = getClient();
  
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': { S: type },
      ':prefix': { S: prefix },
    },
    Limit: MAX_LIMIT, // Will be filtered further
  };
  
  // Add filter expression if provided
  // Use contains() for multi-value attributes (semicolon-delimited)
  // Use exact match (=) for single-value attributes
  if (filter) {
    if (MULTI_VALUE_ATTRIBUTES.has(filter.key)) {
      // Multi-value: sport="tennis;padel" matches filter "tennis"
      params.FilterExpression = 'contains(#filterKey, :filterValue)';
    } else {
      // Single-value: exact match
      params.FilterExpression = '#filterKey = :filterValue';
    }
    params.ExpressionAttributeNames = { '#filterKey': filter.key };
    params.ExpressionAttributeValues![':filterValue'] = { S: filter.value };
  }
  
  const result = await dynamodb.send(new QueryCommand(params));
  return (result.Items || []).map(item => unmarshall(item));
}

/**
 * Query POIs across multiple geohash prefixes in parallel.
 */
async function queryPOIsForBbox(
  type: string,
  bbox: BoundingBox,
  filter?: { key: string; value: string },
  limit: number = DEFAULT_LIMIT
): Promise<{ items: Record<string, unknown>[]; prefixes: string[] }> {
  const { prefixes } = bboxToGeohashPrefixes(bbox);
  
  // Query all prefixes in parallel
  const results = await Promise.all(
    prefixes.map(prefix => queryPOIsForPrefix(type, prefix, filter))
  );
  
  // Flatten and dedupe by osmId
  const seen = new Set<string>();
  const items: Record<string, unknown>[] = [];
  
  for (const batch of results) {
    for (const item of batch) {
      const osmId = item.osmId as string;
      if (seen.has(osmId)) continue;
      seen.add(osmId);
      
      // Filter to exact bbox (geohash is approximate)
      const lat = item.lat as number;
      const lng = item.lng as number;
      if (!isPointInBbox(lat, lng, bbox)) continue;
      
      items.push(item);
      
      if (items.length >= limit) break;
    }
    if (items.length >= limit) break;
  }
  
  return { items, prefixes };
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  const { type } = await params;
  
  // Validate POI type
  if (!VALID_POI_TYPES.has(type)) {
    return NextResponse.json(
      { 
        error: 'Invalid POI type',
        validTypes: Array.from(VALID_POI_TYPES),
      },
      { status: 400 }
    );
  }
  
  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const bboxParam = searchParams.get('bbox');
  const filterParam = searchParams.get('filter');
  const limitParam = searchParams.get('limit');
  
  // Validate bbox
  if (!bboxParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: bbox (format: minLng,minLat,maxLng,maxLat)' },
      { status: 400 }
    );
  }
  
  const bboxParts = bboxParam.split(',').map(Number);
  if (bboxParts.length !== 4 || bboxParts.some(isNaN)) {
    return NextResponse.json(
      { error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' },
      { status: 400 }
    );
  }
  
  const bbox: BoundingBox = {
    minLng: bboxParts[0],
    minLat: bboxParts[1],
    maxLng: bboxParts[2],
    maxLat: bboxParts[3],
  };
  
  // Parse filter
  let filter: { key: string; value: string } | undefined;
  if (filterParam) {
    const [key, value] = filterParam.split(':');
    if (key && value) {
      filter = { key, value };
    }
  }
  
  // Parse limit
  const limit = Math.min(
    Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10)),
    MAX_LIMIT
  );
  
  try {
    // Query DynamoDB
    const { items, prefixes } = await queryPOIsForBbox(type, bbox, filter, limit);
    
    // Convert to GeoJSON
    const features: POIFeature[] = items.map(item => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [item.lng as number, item.lat as number],
      },
      properties: {
        id: item.osmId as string,
        name: item.name as string,
        type: item.type as string,
        // Include relevant attributes
        ...(item.sport ? { sport: item.sport } : {}),
        ...(item.cuisine ? { cuisine: item.cuisine } : {}),
        ...(item.brand ? { brand: item.brand } : {}),
        ...(item.opening_hours ? { opening_hours: item.opening_hours } : {}),
        ...(item.outdoor_seating ? { outdoor_seating: item.outdoor_seating } : {}),
        ...(item.wheelchair ? { wheelchair: item.wheelchair } : {}),
        ...(item.areaM2 ? { areaM2: item.areaM2 } : {}),
        ...(item.notable ? { notable: item.notable } : {}),
      },
    }));
    
    const response: POIResponse = {
      type: 'FeatureCollection',
      features,
      metadata: {
        type,
        bbox,
        count: features.length,
        geohashPrefixes: prefixes,
        queryTimeMs: Date.now() - startTime,
      },
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
    
  } catch (error) {
    console.error('POI query error:', error);
    return NextResponse.json(
      { error: 'Failed to query POIs', details: String(error) },
      { status: 500 }
    );
  }
}
