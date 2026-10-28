/**
 * Nominatim Geocoding Client
 * 
 * Supports both self-hosted and public API with automatic fallback.
 * 
 * Usage:
 *   import { geocode, reverseGeocode, autocomplete } from '@/lib/geocoding/nominatim';
 *   
 *   const results = await geocode('Chamberí, Madrid');
 *   const address = await reverseGeocode(40.4168, -3.7038);
 *   const suggestions = await autocomplete('Cham', { countryCode: 'es' });
 */

// Configuration
const SELF_HOSTED_URL = process.env.NOMINATIM_URL || '';
const PUBLIC_API_URL = 'https://nominatim.openstreetmap.org';

// Rate limiting for public API (1 req/sec)
let lastPublicRequest = 0;
const PUBLIC_RATE_LIMIT_MS = 1100; // Slightly over 1 second to be safe

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox?: string[];
  importance?: number;
  type?: string;
  class?: string;
}

interface GeocodeOptions {
  countryCode?: string;  // 'es' for Spain
  limit?: number;
  bounded?: boolean;
  viewbox?: string;  // 'lon1,lat1,lon2,lat2'
}

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  city?: string;
  neighborhood?: string;
  region?: string;
  postcode?: string;
  country?: string;
  importance?: number;
  raw: NominatimResult;
}

/**
 * Check if self-hosted Nominatim is available
 */
async function isSelfHostedAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${SELF_HOSTED_URL}/status`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the appropriate API URL (self-hosted or public)
 */
async function getApiUrl(): Promise<{ url: string; isSelfHosted: boolean }> {
  const selfHosted = await isSelfHostedAvailable();
  return {
    url: selfHosted ? SELF_HOSTED_URL : PUBLIC_API_URL,
    isSelfHosted: selfHosted,
  };
}

/**
 * Rate limit for public API
 */
async function rateLimitPublicApi(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastPublicRequest;
  
  if (timeSinceLastRequest < PUBLIC_RATE_LIMIT_MS) {
    await new Promise(resolve => 
      setTimeout(resolve, PUBLIC_RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }
  
  lastPublicRequest = Date.now();
}

/**
 * Make a request to Nominatim
 */
async function nominatimRequest(
  endpoint: string,
  params: Record<string, string>,
  isSelfHosted: boolean
): Promise<NominatimResult[]> {
  // Rate limit if using public API
  if (!isSelfHosted) {
    await rateLimitPublicApi();
  }
  
  const searchParams = new URLSearchParams({
    ...params,
    format: 'json',
    addressdetails: '1',
  });
  
  const { url } = await getApiUrl();
  const fullUrl = `${url}/${endpoint}?${searchParams.toString()}`;
  
  console.log(`[Nominatim] ${isSelfHosted ? 'Self-hosted' : 'Public'}: ${endpoint}?q=${params.q || params.lat}`);
  
  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent': 'Leo/1.0 (https://leo.casa)',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

/**
 * Transform Nominatim result to our format
 */
function transformResult(result: NominatimResult): GeocodeResult {
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    displayName: result.display_name,
    city: result.address?.city || result.address?.municipality,
    neighborhood: result.address?.neighbourhood || result.address?.suburb,
    region: result.address?.state,
    postcode: result.address?.postcode,
    country: result.address?.country,
    importance: result.importance,
    raw: result,
  };
}

/**
 * Forward geocoding: Address → Coordinates
 * 
 * @example
 * const results = await geocode('Chamberí, Madrid, Spain');
 * console.log(results[0].lat, results[0].lng);
 */
export async function geocode(
  query: string,
  options: GeocodeOptions = {}
): Promise<GeocodeResult[]> {
  const { url, isSelfHosted } = await getApiUrl();
  
  const params: Record<string, string> = {
    q: query,
    limit: String(options.limit || 5),
  };
  
  // Default to Spain for our use case
  if (options.countryCode) {
    params.countrycodes = options.countryCode;
  }
  
  if (options.bounded && options.viewbox) {
    params.bounded = '1';
    params.viewbox = options.viewbox;
  }
  
  const results = await nominatimRequest('search', params, isSelfHosted);
  return results.map(transformResult);
}

/**
 * Reverse geocoding: Coordinates → Address
 * 
 * @example
 * const address = await reverseGeocode(40.4168, -3.7038);
 * console.log(address.city, address.neighborhood);
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  const { url, isSelfHosted } = await getApiUrl();
  
  const params: Record<string, string> = {
    lat: String(lat),
    lon: String(lng),
    zoom: '18', // Street-level detail
  };
  
  const results = await nominatimRequest('reverse', params, isSelfHosted);
  
  if (results.length === 0) {
    return null;
  }
  
  return transformResult(results[0]);
}

/**
 * Autocomplete: Partial query → Suggestions
 * 
 * Note: Nominatim doesn't have true autocomplete, this uses search with prefix
 * For better UX, consider caching common searches
 * 
 * @example
 * const suggestions = await autocomplete('Cham', { countryCode: 'es' });
 */
export async function autocomplete(
  partialQuery: string,
  options: GeocodeOptions = {}
): Promise<GeocodeResult[]> {
  // Nominatim works best with at least 3 characters
  if (partialQuery.length < 3) {
    return [];
  }
  
  return geocode(partialQuery, {
    ...options,
    limit: options.limit || 5,
    countryCode: options.countryCode || 'es', // Default to Spain
  });
}

/**
 * Batch geocode multiple addresses
 * Automatically handles rate limiting
 * 
 * @example
 * const addresses = ['Chamberí, Madrid', 'Salamanca, Madrid', 'Retiro, Madrid'];
 * const results = await batchGeocode(addresses);
 */
export async function batchGeocode(
  queries: string[],
  options: GeocodeOptions = {}
): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>();
  
  for (const query of queries) {
    try {
      const geocodeResults = await geocode(query, options);
      results.set(query, geocodeResults[0] || null);
    } catch (error) {
      console.error(`[Nominatim] Failed to geocode "${query}":`, error);
      results.set(query, null);
    }
  }
  
  return results;
}

/**
 * Check Nominatim service status
 */
export async function getStatus(): Promise<{
  available: boolean;
  isSelfHosted: boolean;
  url: string;
}> {
  const selfHosted = await isSelfHostedAvailable();
  
  return {
    available: true, // Public API is always available (with rate limits)
    isSelfHosted: selfHosted,
    url: selfHosted ? SELF_HOSTED_URL : PUBLIC_API_URL,
  };
}

