/**
 * Geohash Utilities for POI Queries
 * 
 * Converts bounding boxes to geohash prefixes for efficient DynamoDB queries.
 * Used by the /api/pois/[type] endpoint to fetch POIs within a map viewport.
 * 
 * Key Concepts:
 * - Geohash is a hierarchical spatial index (longer = more precise)
 * - Precision 4 = ~39km x 19km (city-level)
 * - Precision 5 = ~5km x 5km (neighborhood-level)  
 * - Precision 6 = ~1.2km x 0.6km (block-level)
 * - Precision 7 = ~150m x 150m (stored in DynamoDB)
 * 
 * Strategy:
 * - For typical map views (~10km), use precision 4-5 prefixes
 * - Query DynamoDB with `begins_with(SK, prefix)` for each prefix
 * - Client-side filter to exact bounds
 * 
 * @see https://en.wikipedia.org/wiki/Geohash
 */

import Geohash from 'ngeohash';

// ============================================================================
// Types
// ============================================================================

export interface BoundingBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface GeohashCoverage {
  prefixes: string[];
  precision: number;
  estimatedCells: number;
}

// ============================================================================
// Constants
// ============================================================================

// Geohash dimensions at each precision (approximate, varies by latitude)
const GEOHASH_DIMENSIONS: Record<number, { kmLat: number; kmLng: number }> = {
  1: { kmLat: 5000, kmLng: 5000 },
  2: { kmLat: 1250, kmLng: 625 },
  3: { kmLat: 156, kmLng: 156 },
  4: { kmLat: 39, kmLng: 19.5 },
  5: { kmLat: 5, kmLng: 5 },
  6: { kmLat: 1.2, kmLng: 0.6 },
  7: { kmLat: 0.15, kmLng: 0.15 },
};

// Maximum number of prefixes to query (prevents excessive DynamoDB calls)
const MAX_PREFIXES = 16;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Convert a bounding box to geohash prefixes that cover the area.
 * 
 * Algorithm:
 * 1. Calculate bbox dimensions in km
 * 2. Choose precision that gives ~4-16 geohashes
 * 3. Generate grid of geohashes covering the bbox
 * 4. Return unique prefixes
 * 
 * @param bbox - Bounding box with min/max lat/lng
 * @returns Array of geohash prefixes to query
 */
export function bboxToGeohashPrefixes(bbox: BoundingBox): GeohashCoverage {
  const { minLng, maxLng, minLat, maxLat } = bbox;
  
  // Calculate dimensions in km (approximate)
  const latKm = (maxLat - minLat) * 111; // 1 degree lat ≈ 111km
  const lngKm = (maxLng - minLng) * 111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  
  // Choose precision based on bbox size
  // Target: 4-16 geohashes for efficiency
  let precision = 5; // Default for neighborhood-level
  
  if (latKm > 50 || lngKm > 50) {
    precision = 4; // City-level
  } else if (latKm < 5 && lngKm < 5) {
    precision = 6; // Block-level
  }
  
  // Generate grid of geohashes covering the bbox
  const prefixes = new Set<string>();
  const dims = GEOHASH_DIMENSIONS[precision];
  
  // Step size in degrees
  const latStep = dims.kmLat / 111;
  const lngStep = dims.kmLng / (111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180));
  
  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      const hash = Geohash.encode(lat, lng, precision);
      prefixes.add(hash);
      
      // Safety: don't generate too many prefixes
      if (prefixes.size >= MAX_PREFIXES) break;
    }
    if (prefixes.size >= MAX_PREFIXES) break;
  }
  
  // Also add corners and center to ensure coverage
  prefixes.add(Geohash.encode(minLat, minLng, precision));
  prefixes.add(Geohash.encode(minLat, maxLng, precision));
  prefixes.add(Geohash.encode(maxLat, minLng, precision));
  prefixes.add(Geohash.encode(maxLat, maxLng, precision));
  prefixes.add(Geohash.encode((minLat + maxLat) / 2, (minLng + maxLng) / 2, precision));
  
  return {
    prefixes: Array.from(prefixes),
    precision,
    estimatedCells: prefixes.size,
  };
}

/**
 * Check if a point is within a bounding box.
 * Used for client-side filtering after geohash query.
 */
export function isPointInBbox(lat: number, lng: number, bbox: BoundingBox): boolean {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/**
 * Encode a lat/lng to geohash at given precision.
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 7): string {
  return Geohash.encode(lat, lng, precision);
}

/**
 * Decode a geohash to lat/lng bounds.
 */
export function decodeGeohash(hash: string): BoundingBox {
  const decoded = Geohash.decode_bbox(hash);
  return {
    minLat: decoded[0],
    minLng: decoded[1],
    maxLat: decoded[2],
    maxLng: decoded[3],
  };
}

/**
 * Get neighboring geohashes (for edge cases).
 */
export function getGeohashNeighbors(hash: string): string[] {
  return Geohash.neighbors(hash);
}

// ============================================================================
// Barcelona-Specific Helpers
// ============================================================================

/** Barcelona metropolitan area bounding box */
export const BARCELONA_METRO_BBOX: BoundingBox = {
  minLng: 1.90,
  maxLng: 2.35,
  minLat: 41.25,
  maxLat: 41.50,
};

/** Barcelona city center bounding box */
export const BARCELONA_CENTER_BBOX: BoundingBox = {
  minLng: 2.10,
  maxLng: 2.20,
  minLat: 41.36,
  maxLat: 41.42,
};

/**
 * Validate that a bbox is within Spain (sanity check).
 */
export function isBboxInSpain(bbox: BoundingBox): boolean {
  // Spain approximate bounds
  const SPAIN_BOUNDS = {
    minLng: -9.5,
    maxLng: 4.5,
    minLat: 35.9,
    maxLat: 43.8,
  };
  
  return (
    bbox.minLng >= SPAIN_BOUNDS.minLng &&
    bbox.maxLng <= SPAIN_BOUNDS.maxLng &&
    bbox.minLat >= SPAIN_BOUNDS.minLat &&
    bbox.maxLat <= SPAIN_BOUNDS.maxLat
  );
}
