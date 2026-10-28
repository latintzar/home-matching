/**
 * Nominatim Client
 * 
 * Self-hosted Nominatim API client for geocoding operations.
 * Uses our EC2-hosted instance for Spain-focused geocoding.
 * 
 * API Endpoints:
 * - /search: Forward geocoding (address → coordinates)
 * - /reverse: Reverse geocoding (coordinates → address)
 * 
 * NOTE: Isochrones still use Geoapify (Nominatim doesn't do routing)
 */

// Use environment variable, fallback to EC2 instance
const NOMINATIM_URL = process.env.NOMINATIM_URL || '';

export interface NominatimSearchResult {
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
  class?: string;
  type?: string;
  importance?: number;
}

export interface AutocompleteResult {
  description: string;
  place_id: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  country: string;
  neighborhood?: string;
  postcode?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  city: string;
  region: string;
  country: string;
  postcode?: string;
  neighborhood?: string;
  place_id: string;
}

/**
 * Search for addresses (forward geocoding / autocomplete)
 */
export async function searchAddress(
  query: string,
  options: {
    limit?: number;
    countryCode?: string;
    viewbox?: string; // "lon1,lat1,lon2,lat2" bounding box
    bounded?: boolean;
  } = {}
): Promise<AutocompleteResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: String(options.limit || 8),
    'accept-language': 'es,en',
  });
  
  // Focus on Spain by default
  if (options.countryCode) {
    params.set('countrycodes', options.countryCode);
  } else {
    params.set('countrycodes', 'es,pt,fr'); // Spain + neighbors
  }
  
  // Optional bounding box for location bias
  if (options.viewbox) {
    params.set('viewbox', options.viewbox);
    if (options.bounded) {
      params.set('bounded', '1');
    }
  }
  
  const url = `${NOMINATIM_URL}/search?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PuedoCasa/1.0 (property search)',
      },
    });
    
    if (!response.ok) {
      console.error(`Nominatim search error: ${response.status}`);
      return [];
    }
    
    const results: NominatimSearchResult[] = await response.json();
    
    return results.map(r => ({
      description: r.display_name,
      place_id: `${r.osm_type}-${r.osm_id}`,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      city: r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || '',
      state: r.address?.state || r.address?.county || '',
      country: r.address?.country || '',
      neighborhood: r.address?.neighbourhood || r.address?.suburb || '',
      postcode: r.address?.postcode,
    }));
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    'accept-language': 'es,en',
  });
  
  const url = `${NOMINATIM_URL}/reverse?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PuedoCasa/1.0 (property search)',
      },
    });
    
    if (!response.ok) {
      console.error(`Nominatim reverse error: ${response.status}`);
      return null;
    }
    
    const result: NominatimSearchResult = await response.json();
    
    if (!result || !result.address) {
      return null;
    }
    
    const addr = result.address;
    
    return {
      address: result.display_name,
      city: addr.city || addr.town || addr.village || addr.municipality || '',
      region: addr.state || addr.county || '',
      country: addr.country || '',
      postcode: addr.postcode,
      neighborhood: addr.neighbourhood || addr.suburb,
      place_id: `${result.osm_type}-${result.osm_id}`,
    };
  } catch (error) {
    console.error('Nominatim reverse error:', error);
    return null;
  }
}

/**
 * Parse an address string into structured components
 * Uses Nominatim to normalize addresses
 */
export async function parseAddress(address: string): Promise<{
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  province?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
} | null> {
  const results = await searchAddress(address, { limit: 1 });
  
  if (results.length === 0) {
    return null;
  }
  
  const r = results[0];
  return {
    city: r.city,
    neighborhood: r.neighborhood,
    province: r.state,
    postcode: r.postcode,
    lat: r.lat,
    lng: r.lng,
  };
}

/**
 * Check if Nominatim is available
 */
export async function checkNominatimStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${NOMINATIM_URL}/status`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the Nominatim URL being used
 */
export function getNominatimUrl(): string {
  return NOMINATIM_URL;
}

