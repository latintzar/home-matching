/**
 * usePOIs - React Hook for On-Demand POI Loading
 * 
 * Fetches Points of Interest from the /api/pois/[type] endpoint based on
 * map viewport bounds. Includes caching and deduplication.
 * 
 * Usage:
 * ```tsx
 * const { pois, loading, error } = usePOIs({
 *   type: 'bakeries',
 *   bbox: { minLng: 2.1, maxLng: 2.2, minLat: 41.3, maxLat: 41.4 },
 *   enabled: visibility.bakeries,
 * });
 * 
 * // With filter
 * const { pois: tennis } = usePOIs({
 *   type: 'sports_pitches',
 *   bbox: mapBounds,
 *   filter: { sport: 'tennis' },
 *   enabled: visibility.tennis,
 * });
 * ```
 * 
 * Features:
 * - Debounced fetching (waits for viewport to settle)
 * - In-memory caching by bbox hash
 * - Type-safe GeoJSON response
 * - Automatic refetch when bbox changes significantly
 * 
 * @see /api/pois/[type]/route.ts for API documentation
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface BoundingBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface POIFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    name: string;
    type: string;
    sport?: string;
    cuisine?: string;
    brand?: string;
    opening_hours?: string;
    outdoor_seating?: string;
    wheelchair?: string;
    areaM2?: number;
    notable?: boolean;
    [key: string]: unknown;
  };
}

export interface POIResponse {
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

export interface UsePOIsOptions {
  /** POI type to fetch (e.g., 'bakeries', 'sports_pitches') */
  type: string;
  /** Bounding box for the query */
  bbox: BoundingBox | null;
  /** Optional filter (e.g., { sport: 'tennis' }) */
  filter?: { [key: string]: string };
  /** Whether to enable fetching (default: true) */
  enabled?: boolean;
  /** Maximum results (default: 500) */
  limit?: number;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
}

export interface UsePOIsResult {
  /** POI features as GeoJSON */
  pois: POIFeature[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Full response metadata */
  metadata: POIResponse['metadata'] | null;
  /** Force refetch */
  refetch: () => void;
}

// ============================================================================
// Cache
// ============================================================================

// Simple in-memory cache (persists across re-renders but not page reloads)
const poiCache = new Map<string, { data: POIResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cache key from query parameters.
 */
function getCacheKey(type: string, bbox: BoundingBox, filter?: { [key: string]: string }): string {
  // Round bbox to 3 decimal places for cache hits on similar viewports
  const roundedBbox = {
    minLng: Math.round(bbox.minLng * 1000) / 1000,
    maxLng: Math.round(bbox.maxLng * 1000) / 1000,
    minLat: Math.round(bbox.minLat * 1000) / 1000,
    maxLat: Math.round(bbox.maxLat * 1000) / 1000,
  };
  
  const filterStr = filter ? Object.entries(filter).sort().map(([k, v]) => `${k}:${v}`).join(',') : '';
  return `${type}:${JSON.stringify(roundedBbox)}:${filterStr}`;
}

/**
 * Check if cached data is still valid.
 */
function getCachedData(key: string): POIResponse | null {
  const cached = poiCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    poiCache.delete(key);
    return null;
  }
  
  return cached.data;
}

// ============================================================================
// Hook
// ============================================================================

export function usePOIs(options: UsePOIsOptions): UsePOIsResult {
  const {
    type,
    bbox,
    filter,
    enabled = true,
    limit = 500,
    debounceMs = 300,
  } = options;
  
  const [pois, setPois] = useState<POIFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<POIResponse['metadata'] | null>(null);
  
  // Refs for debouncing
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Stabilize filter object - convert to string for comparison
  const filterKey = filter ? JSON.stringify(filter) : '';
  
  // Stabilize bbox - only update ref when values actually change
  const bboxRef = useRef<BoundingBox | null>(null);
  const bboxChanged = bbox && (!bboxRef.current || 
    bbox.minLng !== bboxRef.current.minLng ||
    bbox.maxLng !== bboxRef.current.maxLng ||
    bbox.minLat !== bboxRef.current.minLat ||
    bbox.maxLat !== bboxRef.current.maxLat
  );
  if (bboxChanged && bbox) {
    bboxRef.current = bbox;
  }
  
  /**
   * Fetch POIs from API.
   */
  const fetchPOIs = useCallback(async (fetchBbox: BoundingBox) => {
    // Parse filter from stable key
    const parsedFilter = filterKey ? JSON.parse(filterKey) as { [key: string]: string } : undefined;
    
    // Check cache first
    const cacheKey = getCacheKey(type, fetchBbox, parsedFilter);
    const cached = getCachedData(cacheKey);
    
    if (cached) {
      setPois(cached.features);
      setMetadata(cached.metadata);
      setLoading(false);
      return;
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    try {
      // Build URL
      const params = new URLSearchParams({
        bbox: `${fetchBbox.minLng},${fetchBbox.minLat},${fetchBbox.maxLng},${fetchBbox.maxLat}`,
        limit: String(limit),
      });
      
      // Add filter if provided
      if (parsedFilter) {
        const [key, value] = Object.entries(parsedFilter)[0];
        params.set('filter', `${key}:${value}`);
      }
      
      const response = await fetch(`/api/pois/${type}?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: POIResponse = await response.json();
      
      // Cache the result
      poiCache.set(cacheKey, { data, timestamp: Date.now() });
      
      setPois(data.features);
      setMetadata(data.metadata);
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPois([]);
      
    } finally {
      setLoading(false);
    }
  }, [type, filterKey, limit]);
  
  /**
   * Refetch with current bbox.
   */
  const refetch = useCallback(() => {
    const currentBbox = bboxRef.current;
    if (currentBbox && enabled) {
      // Clear cache for this query
      const parsedFilter = filterKey ? JSON.parse(filterKey) as { [key: string]: string } : undefined;
      const cacheKey = getCacheKey(type, currentBbox, parsedFilter);
      poiCache.delete(cacheKey);
      fetchPOIs(currentBbox);
    }
  }, [enabled, type, filterKey, fetchPOIs]);
  
  // Effect: Debounced fetch when bbox changes
  // Using bboxRef.current to avoid object reference issues
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const currentBbox = bboxRef.current;
    
    // Don't fetch if disabled or no bbox
    if (!enabled || !currentBbox) {
      setPois([]);
      setMetadata(null);
      return;
    }
    
    // Debounce the fetch
    timeoutRef.current = setTimeout(() => {
      fetchPOIs(currentBbox);
    }, debounceMs);
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxRef.current, enabled, fetchPOIs, debounceMs]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    pois,
    loading,
    error,
    metadata,
    refetch,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get map bounds from react-map-gl viewport.
 * Use with onMove callback from Map component.
 */
export function useMapBounds(): {
  bounds: BoundingBox | null;
  handleViewportChange: (evt: { viewState: { bounds?: [[number, number], [number, number]] } }) => void;
} {
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  
  const handleViewportChange = useCallback((evt: { viewState: { bounds?: [[number, number], [number, number]] } }) => {
    const mapBounds = evt.viewState.bounds;
    if (mapBounds) {
      setBounds({
        minLng: mapBounds[0][0],
        minLat: mapBounds[0][1],
        maxLng: mapBounds[1][0],
        maxLat: mapBounds[1][1],
      });
    }
  }, []);
  
  return { bounds, handleViewportChange };
}

/**
 * Clear the POI cache (useful for testing or force refresh).
 */
export function clearPOICache(): void {
  poiCache.clear();
}

export default usePOIs;
