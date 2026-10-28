/**
 * Spain Bounding Boxes
 * 
 * Clean, usable bounds for Mainland, Balearics, and Canary Islands.
 * Used for coordinate validation in parsing and geocoding.
 */

export interface BoundingBox {
  name: string;
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

// Mainland Spain (Peninsular)
export const MAINLAND_SPAIN: BoundingBox = {
  name: 'mainland_spain',
  min_lat: 36.0,
  max_lat: 43.8,
  min_lng: -9.3,
  max_lng: 3.3,
};

// Balearic Islands (Mallorca, Menorca, Ibiza, Formentera)
export const BALEARICS: BoundingBox = {
  name: 'balearics',
  min_lat: 38.6,
  max_lat: 40.1,
  min_lng: 1.1,
  max_lng: 4.4,
};

// Western Canary Islands (El Hierro, La Palma, La Gomera, Tenerife)
export const CANARIES_WEST: BoundingBox = {
  name: 'canaries_west',
  min_lat: 27.6,
  max_lat: 29.5,
  min_lng: -18.2,
  max_lng: -16.0,
};

// Eastern Canary Islands (Gran Canaria, Lanzarote, Fuerteventura)
export const CANARIES_EAST: BoundingBox = {
  name: 'canaries_east',
  min_lat: 27.6,
  max_lat: 29.3,
  min_lng: -15.9,
  max_lng: -13.3,
};

// All Spain territories (not recommended for filtering, but useful for quick checks)
export const SPAIN_ALL: BoundingBox = {
  name: 'spain_all_territories',
  min_lat: 27.6,
  max_lat: 43.8,
  min_lng: -18.2,
  max_lng: 4.4,
};

// All bounding boxes for iteration
export const SPAIN_BOUNDS: BoundingBox[] = [
  MAINLAND_SPAIN,
  BALEARICS,
  CANARIES_WEST,
  CANARIES_EAST,
];

/**
 * Check if coordinates are within a bounding box
 */
export const isInBounds = (lat: number, lng: number, bounds: BoundingBox): boolean => {
  return (
    lat >= bounds.min_lat &&
    lat <= bounds.max_lat &&
    lng >= bounds.min_lng &&
    lng <= bounds.max_lng
  );
};

/**
 * Check if coordinates are within ANY Spain territory
 */
export const isInSpain = (lat: number, lng: number): boolean => {
  return SPAIN_BOUNDS.some(bounds => isInBounds(lat, lng, bounds));
};

/**
 * Get which Spain region contains the coordinates
 */
export const getSpainRegion = (lat: number, lng: number): string | null => {
  for (const bounds of SPAIN_BOUNDS) {
    if (isInBounds(lat, lng, bounds)) {
      return bounds.name;
    }
  }
  return null;
};

/**
 * Validate and clean coordinates - returns null if not in Spain
 */
export const validateSpainCoords = (
  lat: number | null | undefined,
  lng: number | null | undefined
): { lat: number; lng: number; region: string } | null => {
  if (lat == null || lng == null) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (isNaN(lat) || isNaN(lng)) return null;
  
  const region = getSpainRegion(lat, lng);
  if (!region) return null;
  
  return { lat, lng, region };
};

