/**
 * Coordinate Precision Detection & Verification Utility
 * 
 * Provides smart coordinate handling for real estate harvesters:
 * 1. Nominatim geocoding with full address component extraction
 * 2. Distance calculation between coordinates (Haversine)
 * 3. Coordinate verification (compare embedded vs geocoded)
 * 4. Precision determination based on address quality
 * 
 * Precision levels:
 * - "precise" - actual property address (has street name)
 * - "approximate" - neighborhood/area level (has neighborhood but no street)
 * - "city_center" - likely just city centroid (only city/province)
 * - "unknown" - can't determine
 */

// ============================================================
// TYPES
// ============================================================

export type CoordinatePrecision = 'precise' | 'approximate' | 'city_center' | 'unknown';

export interface AddressComponents {
  streetAddress: string | null;  // e.g., "Calle Mayor 15"
  neighborhood: string | null;   // e.g., "Puerto Banús"
  city: string | null;           // e.g., "Marbella"
  province: string | null;       // e.g., "Málaga"
  region: string | null;         // e.g., "Andalucía"
  postalCode: string | null;     // e.g., "29660"
  country: string;               // e.g., "Spain"
}

export interface CoordinateInfo {
  lat: number | null;
  lng: number | null;
  precision: CoordinatePrecision;
  address: AddressComponents;
  displayAddress: string;
  precisionSignal: string;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox?: string[];
  importance?: number;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  address: AddressComponents;
  confidence: 'high' | 'medium' | 'low';
  raw: NominatimResult;
}

export interface CoordinateVerification {
  finalLat: number | null;
  finalLng: number | null;
  precision: CoordinatePrecision;
  precisionSignal: string;
  address: AddressComponents;
  displayAddress: string;
  embeddedDistance: number | null;  // km from embedded to geocoded
  usedSource: 'embedded' | 'geocoded' | 'none';
}

// ============================================================
// CONFIGURATION
// ============================================================

// Self-hosted Nominatim URL (or use public as fallback)
const NOMINATIM_URL = process.env.NOMINATIM_URL || '';
const NOMINATIM_FALLBACK = 'https://nominatim.openstreetmap.org';

// Distance thresholds (in km)
const PRECISE_THRESHOLD_KM = 0.5;      // < 500m = coords match
const APPROXIMATE_THRESHOLD_KM = 2.0;  // < 2km = reasonable area
const CITY_CENTER_THRESHOLD_KM = 5.0;  // > 5km = definitely wrong

// ============================================================
// STREET ADDRESS PATTERNS
// ============================================================

const SPANISH_STREET_PATTERNS = [
  /\b(calle|c\/|c\.|cl\.)\s+[\wáéíóúñü]+/i,
  /\b(avenida|av\.|avda\.)\s+[\wáéíóúñü]+/i,
  /\b(plaza|pl\.|pza\.)\s+[\wáéíóúñü]+/i,
  /\b(paseo|pº\.?)\s+[\wáéíóúñü]+/i,
  /\b(carrer|c\/)\s+[\wàèéíòóúç]+/i,
  /\b(rúa)\s+[\wáéíóúñ]+/i,
  /\b(kalea)\s+[\w]+/i,
  /\b(camino|cno\.)\s+[\wáéíóúñü]+/i,
  /\b(travesía|trav\.)\s+[\wáéíóúñü]+/i,
  /\b(ronda)\s+[\wáéíóúñü]+/i,
  /\b(urbanización|urb\.)\s+[\wáéíóúñü]+/i,
  /\b(polígono|pol\.)\s+[\wáéíóúñü]+/i,
  /\b(partida)\s+[\wáéíóúñü]+/i,
  /\b(número|nº|num\.?|n\.?)\s*\d+/i,
];

const ENGLISH_STREET_PATTERNS = [
  /\b(street|st\.)\s+[\w]+/i,
  /\b(avenue|ave\.)\s+[\w]+/i,
  /\b(road|rd\.)\s+[\w]+/i,
  /\b(boulevard|blvd\.)\s+[\w]+/i,
  /\b(lane|ln\.)\s+[\w]+/i,
  /\b(drive|dr\.)\s+[\w]+/i,
  /\d+\s+[\w]+\s+(street|st\.|avenue|ave\.|road|rd\.)/i,
];

// ============================================================
// KNOWN CITY CENTERS (for fallback detection)
// ============================================================

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'valencia': { lat: 39.4699, lng: -0.3763 },
  'sevilla': { lat: 37.3891, lng: -5.9845 },
  'málaga': { lat: 36.7213, lng: -4.4214 },
  'malaga': { lat: 36.7213, lng: -4.4214 },
  'zaragoza': { lat: 41.6488, lng: -0.8891 },
  'bilbao': { lat: 43.2630, lng: -2.9350 },
  'alicante': { lat: 38.3452, lng: -0.4810 },
  'murcia': { lat: 37.9922, lng: -1.1307 },
  'palma': { lat: 39.5696, lng: 2.6502 },
  'marbella': { lat: 36.5099, lng: -4.8864 },
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if address string contains a street-level address
 */
export function hasStreetAddress(address: string): { hasStreet: boolean; signal: string } {
  if (!address) return { hasStreet: false, signal: 'no_address' };
  
  const allPatterns = [...SPANISH_STREET_PATTERNS, ...ENGLISH_STREET_PATTERNS];
  
  for (const pattern of allPatterns) {
    if (pattern.test(address)) {
      return { hasStreet: true, signal: 'street_pattern_matched' };
    }
  }
  
  // Check for house number + postal code
  if (/\b\d{1,4}\s*[,\s]\s*\d{5}\b/.test(address)) {
    return { hasStreet: true, signal: 'number_with_postal' };
  }
  
  return { hasStreet: false, signal: 'no_street_found' };
}

/**
 * Check if coordinates are near a known city center
 */
export function isNearCityCenter(
  lat: number, lng: number, cityName?: string
): { isCenter: boolean; city: string | null; distance: number } {
  if (cityName) {
    const normalized = cityName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const center = CITY_CENTERS[normalized];
    if (center) {
      const dist = haversineDistance(lat, lng, center.lat, center.lng);
      if (dist < 1) { // Within 1km of known city center
        return { isCenter: true, city: cityName, distance: dist };
      }
    }
  }
  
  // Check all known centers
  for (const [city, center] of Object.entries(CITY_CENTERS)) {
    const dist = haversineDistance(lat, lng, center.lat, center.lng);
    if (dist < 1) {
      return { isCenter: true, city, distance: dist };
    }
  }
  
  return { isCenter: false, city: null, distance: Infinity };
}

// ============================================================
// NOMINATIM GEOCODING
// ============================================================

/**
 * Forward geocode an address string with full address details
 */
export async function geocodeAddress(
  address: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<GeocodingResult | null> {
  if (!address || address.length < 3) return null;
  
  const { timeout = 10000, retries = 2 } = options;
  const urls = [NOMINATIM_URL, NOMINATIM_FALLBACK];
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const baseUrl = urls[attempt % urls.length];
    
    try {
      const params = new URLSearchParams({
        q: address,
        format: 'json',
        addressdetails: '1',
        limit: '1',
        countrycodes: 'es,pt,ad', // Spain + Portugal + Andorra
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${baseUrl}/search?${params}`, {
        headers: { 'User-Agent': 'PuedoCasa/1.0 (property-search)' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const results: NominatimResult[] = await response.json();
      
      if (results.length > 0) {
        const r = results[0];
        const addr = r.address || {};
        
        // Build street address from components
        let streetAddress: string | null = null;
        if (addr.road) {
          streetAddress = addr.house_number 
            ? `${addr.road} ${addr.house_number}`
            : addr.road;
        }
        
        const components: AddressComponents = {
          streetAddress,
          neighborhood: addr.neighbourhood || addr.suburb || null,
          city: addr.city || addr.town || addr.village || addr.municipality || null,
          province: addr.county || addr.state || null,
          region: addr.state || null,
          postalCode: addr.postcode || null,
          country: addr.country || 'Spain',
        };
        
        // Determine confidence based on what we got
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (streetAddress) confidence = 'high';
        else if (components.neighborhood) confidence = 'medium';
        
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
          address: components,
          confidence,
          raw: r,
        };
      }
    } catch (error) {
      // Try next attempt/URL
      continue;
    }
  }
  
  return null;
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(
  lat: number, lng: number,
  options: { timeout?: number } = {}
): Promise<GeocodingResult | null> {
  const { timeout = 10000 } = options;
  const urls = [NOMINATIM_URL, NOMINATIM_FALLBACK];
  
  for (const baseUrl of urls) {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${baseUrl}/reverse?${params}`, {
        headers: { 'User-Agent': 'PuedoCasa/1.0 (property-search)' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const r: NominatimResult = await response.json();
      
      if (r && r.lat) {
        const addr = r.address || {};
        
        let streetAddress: string | null = null;
        if (addr.road) {
          streetAddress = addr.house_number 
            ? `${addr.road} ${addr.house_number}`
            : addr.road;
        }
        
        const components: AddressComponents = {
          streetAddress,
          neighborhood: addr.neighbourhood || addr.suburb || null,
          city: addr.city || addr.town || addr.village || addr.municipality || null,
          province: addr.county || addr.state || null,
          region: addr.state || null,
          postalCode: addr.postcode || null,
          country: addr.country || 'Spain',
        };
        
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (streetAddress) confidence = 'high';
        else if (components.neighborhood) confidence = 'medium';
        
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
          address: components,
          confidence,
          raw: r,
        };
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

// ============================================================
// COORDINATE VERIFICATION
// ============================================================

/**
 * Verify embedded coordinates by comparing with geocoded address
 * This is the main function to use for smart coordinate handling
 */
export async function verifyCoordinates(
  embeddedLat: number | null,
  embeddedLng: number | null,
  addressText: string,
  existingComponents?: Partial<AddressComponents>
): Promise<CoordinateVerification> {
  // Default result
  const defaultResult: CoordinateVerification = {
    finalLat: embeddedLat,
    finalLng: embeddedLng,
    precision: 'unknown',
    precisionSignal: 'no_data',
    address: {
      streetAddress: existingComponents?.streetAddress || null,
      neighborhood: existingComponents?.neighborhood || null,
      city: existingComponents?.city || null,
      province: existingComponents?.province || null,
      region: existingComponents?.region || null,
      postalCode: existingComponents?.postalCode || null,
      country: existingComponents?.country || 'Spain',
    },
    displayAddress: addressText || 'Unknown location',
    embeddedDistance: null,
    usedSource: embeddedLat && embeddedLng ? 'embedded' : 'none',
  };
  
  // Build the best address string for geocoding
  const addressParts = [
    existingComponents?.streetAddress,
    existingComponents?.neighborhood,
    existingComponents?.city,
    existingComponents?.province,
    'Spain',
  ].filter(Boolean);
  
  const geocodeQuery = addressParts.length > 1 
    ? addressParts.join(', ')
    : addressText;
  
  // Check if we have a street address
  const { hasStreet } = hasStreetAddress(geocodeQuery);
  
  // Forward geocode the address
  const geocoded = await geocodeAddress(geocodeQuery);
  
  if (!geocoded) {
    // Geocoding failed, use what we have
    if (embeddedLat && embeddedLng) {
      // Check if embedded coords are at city center
      const { isCenter, city } = isNearCityCenter(
        embeddedLat, embeddedLng, 
        existingComponents?.city || undefined
      );
      
      if (isCenter) {
        return {
          ...defaultResult,
          precision: 'city_center',
          precisionSignal: `near_${city}_center_geocoding_failed`,
        };
      }
      
      return {
        ...defaultResult,
        precision: hasStreet ? 'approximate' : 'city_center',
        precisionSignal: 'geocoding_failed_using_embedded',
      };
    }
    
    return defaultResult;
  }
  
  // Merge address components (geocoded takes priority for missing fields)
  const mergedAddress: AddressComponents = {
    streetAddress: existingComponents?.streetAddress || geocoded.address.streetAddress,
    neighborhood: existingComponents?.neighborhood || geocoded.address.neighborhood,
    city: existingComponents?.city || geocoded.address.city,
    province: existingComponents?.province || geocoded.address.province,
    region: geocoded.address.region || existingComponents?.region || null,
    postalCode: geocoded.address.postalCode || existingComponents?.postalCode || null,
    country: geocoded.address.country,
  };
  
  // Build display address
  const displayParts = [
    mergedAddress.streetAddress,
    mergedAddress.neighborhood,
    mergedAddress.city,
    mergedAddress.province,
  ].filter(Boolean);
  const displayAddress = displayParts.join(', ') || geocoded.displayName;
  
  // No embedded coords - use geocoded
  if (!embeddedLat || !embeddedLng) {
    const hasStreetResult = hasStreetAddress(displayAddress);
    let precision: CoordinatePrecision = 'city_center';
    
    if (mergedAddress.streetAddress || hasStreetResult.hasStreet) {
      precision = 'precise';
    } else if (mergedAddress.neighborhood) {
      precision = 'approximate';
    }
    
    return {
      finalLat: geocoded.lat,
      finalLng: geocoded.lng,
      precision,
      precisionSignal: 'geocoded_no_embedded',
      address: mergedAddress,
      displayAddress,
      embeddedDistance: null,
      usedSource: 'geocoded',
    };
  }
  
  // Compare embedded vs geocoded
  const distance = haversineDistance(
    embeddedLat, embeddedLng,
    geocoded.lat, geocoded.lng
  );
  
  // Determine precision and which coords to use
  let precision: CoordinatePrecision;
  let finalLat: number;
  let finalLng: number;
  let usedSource: 'embedded' | 'geocoded';
  let signal: string;
  
  if (distance < PRECISE_THRESHOLD_KM) {
    // Coords match well - embedded is good
    finalLat = embeddedLat;
    finalLng = embeddedLng;
    usedSource = 'embedded';
    
    if (mergedAddress.streetAddress || hasStreet) {
      precision = 'precise';
      signal = `coords_match_${distance.toFixed(2)}km_has_street`;
    } else if (mergedAddress.neighborhood) {
      precision = 'approximate';
      signal = `coords_match_${distance.toFixed(2)}km_neighborhood_level`;
    } else {
      precision = 'approximate';
      signal = `coords_match_${distance.toFixed(2)}km`;
    }
  } else if (distance < APPROXIMATE_THRESHOLD_KM) {
    // Slight mismatch but acceptable
    finalLat = embeddedLat;
    finalLng = embeddedLng;
    usedSource = 'embedded';
    precision = 'approximate';
    signal = `coords_close_${distance.toFixed(2)}km`;
  } else if (distance < CITY_CENTER_THRESHOLD_KM) {
    // Significant mismatch - embedded might be neighborhood center
    finalLat = geocoded.lat;
    finalLng = geocoded.lng;
    usedSource = 'geocoded';
    precision = 'approximate';
    signal = `coords_differ_${distance.toFixed(2)}km_using_geocoded`;
  } else {
    // Large mismatch - embedded is probably city center
    finalLat = geocoded.lat;
    finalLng = geocoded.lng;
    usedSource = 'geocoded';
    precision = mergedAddress.neighborhood ? 'approximate' : 'city_center';
    signal = `coords_very_different_${distance.toFixed(2)}km_embedded_was_city_center`;
  }
  
  return {
    finalLat,
    finalLng,
    precision,
    precisionSignal: signal,
    address: mergedAddress,
    displayAddress,
    embeddedDistance: distance,
    usedSource,
  };
}

// ============================================================
// HTML EXTRACTION HELPERS
// ============================================================

/**
 * Extract street address from HTML using common patterns
 */
export function extractStreetAddressFromHtml(html: string): string | null {
  const patterns = [
    // Schema.org
    /<[^>]*itemprop="streetAddress"[^>]*>([^<]+)</i,
    // Common class names
    /<[^>]*class="[^"]*street[^"]*address[^"]*"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*direccion[^"]*"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*address-line[^"]*"[^>]*>([^<]+)</i,
    // JSON patterns
    /"streetAddress"\s*:\s*"([^"]+)"/i,
    /"street"\s*:\s*"([^"]+)"/i,
    /"direccion"\s*:\s*"([^"]+)"/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const addr = match[1].trim();
      if (hasStreetAddress(addr).hasStreet) {
        return addr;
      }
    }
  }
  
  return null;
}

/**
 * Extract neighborhood from HTML
 */
export function extractNeighborhoodFromHtml(html: string): string | null {
  const patterns = [
    /<[^>]*itemprop="addressLocality"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*neighborhood[^"]*"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*barrio[^"]*"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*zona[^"]*"[^>]*>([^<]+)</i,
    /"neighborhood"\s*:\s*"([^"]+)"/i,
    /"barrio"\s*:\s*"([^"]+)"/i,
    /"zone"\s*:\s*"([^"]+)"/i,
    /"suburb"\s*:\s*"([^"]+)"/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract city from HTML
 */
export function extractCityFromHtml(html: string): string | null {
  const patterns = [
    /<[^>]*itemprop="addressRegion"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*city[^"]*"[^>]*>([^<]+)</i,
    /<[^>]*class="[^"]*ciudad[^"]*"[^>]*>([^<]+)</i,
    /"city"\s*:\s*"([^"]+)"/i,
    /"ciudad"\s*:\s*"([^"]+)"/i,
    /"addressLocality"\s*:\s*"([^"]+)"/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract best available address from HTML
 */
export function extractBestAddressFromHtml(
  html: string,
  existingComponents?: Partial<AddressComponents>
): AddressComponents {
  return {
    streetAddress: existingComponents?.streetAddress || extractStreetAddressFromHtml(html),
    neighborhood: existingComponents?.neighborhood || extractNeighborhoodFromHtml(html),
    city: existingComponents?.city || extractCityFromHtml(html),
    province: existingComponents?.province || null,
    region: existingComponents?.region || null,
    postalCode: existingComponents?.postalCode || null,
    country: existingComponents?.country || 'Spain',
  };
}

// ============================================================
// LEGACY COMPATIBILITY (for existing code)
// ============================================================

/**
 * Simple coordinate analysis without verification
 * @deprecated Use verifyCoordinates for better results
 */
export function analyzeCoordinates(
  lat: number | null,
  lng: number | null,
  rawAddress: string,
  components?: Partial<AddressComponents>
): CoordinateInfo {
  const address: AddressComponents = {
    streetAddress: components?.streetAddress || null,
    neighborhood: components?.neighborhood || null,
    city: components?.city || null,
    province: components?.province || null,
    region: components?.region || null,
    postalCode: components?.postalCode || null,
    country: components?.country || 'Spain',
  };
  
  const displayParts = [
    address.streetAddress,
    address.neighborhood,
    address.city,
    address.province,
  ].filter(Boolean);
  
  const displayAddress = displayParts.length > 0 
    ? displayParts.join(', ')
    : rawAddress || 'Unknown location';
  
  // Determine precision
  let precision: CoordinatePrecision = 'unknown';
  let signal = 'no_data';
  
  if (lat !== null && lng !== null) {
    const { hasStreet, signal: streetSignal } = hasStreetAddress(displayAddress);
    
    if (hasStreet) {
      precision = 'precise';
      signal = streetSignal;
    } else if (address.neighborhood) {
      precision = 'approximate';
      signal = 'has_neighborhood';
    } else if (address.city) {
      const { isCenter, city } = isNearCityCenter(lat, lng, address.city);
      if (isCenter) {
        precision = 'city_center';
        signal = `near_${city}_center`;
      } else {
        precision = 'city_center';
        signal = 'city_only';
      }
    }
  }
  
  return {
    lat,
    lng,
    precision,
    address,
    displayAddress,
    precisionSignal: signal,
  };
}

/**
 * Determine coordinate precision (legacy)
 * @deprecated Use verifyCoordinates for better results
 */
export function determineCoordinatePrecision(
  lat: number | null,
  lng: number | null,
  addressString: string,
  city?: string,
  neighborhood?: string
): { precision: CoordinatePrecision; signal: string } {
  if (lat === null || lng === null) {
    return { precision: 'unknown', signal: 'no_coordinates' };
  }
  
  const { hasStreet, signal: streetSignal } = hasStreetAddress(addressString);
  if (hasStreet) {
    return { precision: 'precise', signal: streetSignal };
  }
  
  const { isCenter, city: centerCity } = isNearCityCenter(lat, lng, city);
  if (isCenter) {
    return { precision: 'city_center', signal: `near_${centerCity}_center` };
  }
  
  if (neighborhood && neighborhood.length > 0) {
    return { precision: 'approximate', signal: 'has_neighborhood_only' };
  }
  
  if (city && !neighborhood) {
    return { precision: 'city_center', signal: 'city_only_no_detail' };
  }
  
  return { precision: 'approximate', signal: 'limited_address_info' };
}
