/**
 * STUDENT - Cheerio Parser
 * 
 * Uses learned CSS selectors to parse listings.
 * Runs locally with ZERO LLM cost after selectors are learned.
 */

import * as cheerio from 'cheerio';
import { validateSpainCoords } from '@/lib/geo/spain-bounds';

export interface ParsedListing {
  url: string;
  domain: string;
  
  // Basic info
  title?: string;
  price_eur?: number;
  price_period?: 'total' | 'month' | 'week';
  
  // Size
  m2_built?: number;
  m2_useful?: number;
  bedrooms?: number;
  bathrooms?: number;
  
  // Location (Nominatim-compatible)
  street_name?: string;      // "Calle Gran Vía"
  street_number?: string;    // "42"
  address?: string;          // Full address string for fallback
  neighborhood?: string;     // "Chamberí"
  city?: string;             // "Madrid"
  region?: string;           // "Comunidad de Madrid" 
  postal_code?: string;      // "28013"
  lat?: number;
  lng?: number;
  spain_territory?: string;  // mainland_spain, balearics, canaries
  
  // Details
  description?: string;
  features?: string[];       // Raw feature strings
  reference?: string;
  
  // Type (ListingEditor-aligned)
  listing_type?: 'sale' | 'rent' | 'rent_to_own';
  property_subtype?: 'flat' | 'penthouse' | 'duplex' | 'studio' | 'chalet_detached' | 'chalet_semi' | 'chalet_terraced' | 'rustic';
  housing_situation?: 'free' | 'rented' | 'bare_ownership' | 'squatted' | 'auction';
  ad_origin?: 'standard' | 'bank';
  condition?: 'new' | 'good' | 'renovate';
  
  // Building specs
  floor_level?: 'ground' | 'intermediate' | 'top';
  floor_number?: number;
  has_elevator?: boolean;
  is_exterior?: boolean;
  
  // Amenities (booleans)
  has_terrace?: boolean;
  terrace_orientation?: 'north' | 'south' | 'east' | 'west' | 'unknown';
  has_balcony?: boolean;
  balcony_orientation?: 'north' | 'south' | 'east' | 'west' | 'unknown';
  has_pool?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  has_air_conditioning?: boolean;
  has_wardrobes?: boolean;
  is_accessible?: boolean;
  has_storage?: boolean;
  
  // Media
  photos?: string[];
  main_image?: string;
  
  // Agency
  agency_name?: string;
  agency_logo?: string;
  agency_phone?: string;
  agency_email?: string;
  agency_whatsapp?: string;
  agent_name?: string;
  
  // Metadata
  parsed_at: string;
  selector_version: number;
}

export interface Selectors {
  // Basic info
  title?: string | null;
  price?: string | null;
  price_period?: string | null;
  
  // Size
  bedrooms?: string | null;
  bathrooms?: string | null;
  m2_built?: string | null;
  m2_useful?: string | null;
  
  // Location (Nominatim-compatible)
  street_name?: string | null;
  street_number?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  lat?: string | null;
  lng?: string | null;
  
  // Property type
  listing_type?: string | null;
  property_subtype?: string | null;
  housing_situation?: string | null;
  ad_origin?: string | null;
  condition?: string | null;
  
  // Building specs
  floor_level?: string | null;
  floor_number?: string | null;
  has_elevator?: string | null;
  is_exterior?: string | null;
  
  // Amenities
  has_terrace?: string | null;
  has_balcony?: string | null;
  has_pool?: string | null;
  has_garage?: string | null;
  has_garden?: string | null;
  has_air_conditioning?: string | null;
  has_wardrobes?: string | null;
  is_accessible?: string | null;
  has_storage?: string | null;
  
  // Details
  description?: string | null;
  features?: string | null;
  reference?: string | null;
  
  // Media
  photos?: string | null;
  main_image?: string | null;
  
  // Agency
  agency_name?: string | null;
  agency_logo?: string | null;
  agency_phone?: string | null;
  agency_email?: string | null;
  agent_name?: string | null;
  
  // Structured data
  json_ld?: string | null;
}

/**
 * Extract text from element(s) matching selector
 */
function getText($: cheerio.CheerioAPI, selector: string | null): string | undefined {
  if (!selector) return undefined;
  const el = $(selector).first();
  return el.length ? el.text().trim() : undefined;
}

/**
 * Extract number from text
 */
function extractNumber(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/\./g, '').match(/[\d,]+/);
  if (!match) return undefined;
  return parseInt(match[0].replace(/,/g, ''));
}

/**
 * Extract price with currency handling
 */
function extractPrice(text: string | undefined): number | undefined {
  if (!text) return undefined;
  // Remove currency symbols and extract number
  const clean = text.replace(/[€$£]/g, '').replace(/\./g, '').replace(/,/g, '.');
  const match = clean.match(/[\d.]+/);
  if (!match) return undefined;
  return Math.round(parseFloat(match[0]));
}

/**
 * Extract lat/lng from various sources
 */
function extractCoordinates($: cheerio.CheerioAPI, html: string, selectors: Selectors): { lat?: number; lng?: number; region?: string } {
  // Method 1: Check JSON-LD first
  const jsonLd = $('script[type="application/ld+json"]').html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      const geo = data.geo || data.location?.geo;
      if (geo?.latitude && geo?.longitude) {
        const validated = validateSpainCoords(parseFloat(geo.latitude), parseFloat(geo.longitude));
        if (validated) return validated;
      }
    } catch {}
  }

  // Method 2: Map container data attributes
  const mapSelectors = ['#ideMapDetail', '#main-map', '[data-latitude]', '.map-container'];
  for (const sel of mapSelectors) {
    const el = $(sel);
    if (el.length) {
      const lat = el.attr('data-latitude') || el.attr('data-lat');
      const lng = el.attr('data-longitude') || el.attr('data-lng') || el.attr('data-lon');
      if (lat && lng) {
        const validated = validateSpainCoords(parseFloat(lat), parseFloat(lng));
        if (validated) return validated;
      }
    }
  }

  // Method 3: Search in scripts
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const text = $(script).html() || '';
    
    // Pattern: latitude/longitude in JSON
    const latMatch = text.match(/["']?latitude["']?\s*:\s*["']?([-\d.]+)["']?/i);
    const lngMatch = text.match(/["']?longitude["']?\s*:\s*["']?([-\d.]+)["']?/i);
    if (latMatch && lngMatch) {
      const validated = validateSpainCoords(parseFloat(latMatch[1]), parseFloat(lngMatch[1]));
      if (validated) return validated;
    }

    // Pattern: LatLng(lat, lng)
    const latLngMatch = text.match(/LatLng\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
    if (latLngMatch) {
      const validated = validateSpainCoords(parseFloat(latLngMatch[1]), parseFloat(latLngMatch[2]));
      if (validated) return validated;
    }

    // Pattern: center: [lng, lat] (Mapbox - reversed order!)
    const centerMatch = text.match(/center\s*:\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]/);
    if (centerMatch) {
      // Mapbox uses [lng, lat]
      const validated = validateSpainCoords(parseFloat(centerMatch[2]), parseFloat(centerMatch[1]));
      if (validated) return validated;
    }
  }

  // Method 4: Custom selector if provided
  if (selectors.lat && selectors.lng) {
    const latText = getText($, selectors.lat);
    const lngText = getText($, selectors.lng);
    if (latText && lngText) {
      const validated = validateSpainCoords(parseFloat(latText), parseFloat(lngText));
      if (validated) return validated;
    }
  }

  return {};
}

/**
 * Extract photos from various sources
 */
function extractPhotos($: cheerio.CheerioAPI, html: string, selector: string | null): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  const addPhoto = (url: string | undefined) => {
    if (!url || seen.has(url)) return;
    // Filter out obvious non-photos
    if (url.includes('logo') || url.includes('icon') || url.includes('avatar')) return;
    if (url.includes('placeholder') || url.includes('loading')) return;
    seen.add(url);
    photos.push(url);
  };

  // Method 1: Custom selector
  if (selector) {
    $(selector).each((_, el) => {
      addPhoto($(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy'));
    });
  }

  // Method 2: Gallery arrays in scripts
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const text = $(script).html() || '';
    
    // Look for common gallery patterns
    const patterns = [
      /fullScreenGalleryPics\s*[:=]\s*(\[[\s\S]*?\])/,
      /galleryImages\s*[:=]\s*(\[[\s\S]*?\])/,
      /"images"\s*:\s*(\[[\s\S]*?\])/,
      /photos\s*[:=]\s*(\[[\s\S]*?\])/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          // Clean up JS array to valid JSON
          let arrayStr = match[1]
            .replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":')
            .replace(/'/g, '"');
          const arr = JSON.parse(arrayStr);
          if (Array.isArray(arr)) {
            arr.forEach((item: any) => {
              const url = typeof item === 'string' ? item : item.url || item.src || item.imageDataService;
              addPhoto(url);
            });
          }
        } catch {}
      }
    }
  }

  // Method 3: JSON-LD images
  const jsonLd = $('script[type="application/ld+json"]').html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      const images = data.image || data.images || data.photo;
      if (Array.isArray(images)) {
        images.forEach((img: any) => addPhoto(typeof img === 'string' ? img : img.url));
      } else if (typeof images === 'string') {
        addPhoto(images);
      }
    } catch {}
  }

  // Method 4: Fallback to all gallery images
  if (photos.length === 0) {
    $('img[data-src], .gallery img, .carousel img, .slider img').each((_, el) => {
      addPhoto($(el).attr('src') || $(el).attr('data-src'));
    });
  }

  return photos;
}

/**
 * Extract boolean amenity from features/description
 */
function hasAmenity(features: string[], description: string, keywords: string[]): boolean {
  const text = [...features, description].join(' ').toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

/**
 * Detect orientation (north/south/east/west) for terraces/balconies
 */
function detectOrientation(features: string[], description: string, context: string): ParsedListing['terrace_orientation'] {
  const text = [...features, description].join(' ').toLowerCase();
  
  // Look for orientation near the context word
  const orientationPatterns = [
    { keywords: ['norte', 'north', 'orientación norte'], value: 'north' as const },
    { keywords: ['sur', 'south', 'orientación sur'], value: 'south' as const },
    { keywords: ['este', 'east', 'orientación este'], value: 'east' as const },
    { keywords: ['oeste', 'west', 'orientación oeste'], value: 'west' as const },
  ];
  
  for (const { keywords, value } of orientationPatterns) {
    if (keywords.some(kw => text.includes(kw))) {
      return value;
    }
  }
  
  return 'unknown';
}

/**
 * Extract WhatsApp number from page
 */
function extractWhatsApp($: cheerio.CheerioAPI, html: string): string | undefined {
  // Method 1: Look for WhatsApp links
  const waLink = $('a[href*="wa.me"], a[href*="whatsapp.com/send"]').attr('href');
  if (waLink) {
    const match = waLink.match(/[\d+]+/);
    if (match) return match[0];
  }
  
  // Method 2: Look for data attributes
  const waData = $('[data-whatsapp]').attr('data-whatsapp');
  if (waData) return waData;
  
  // Method 3: Search in script tags for WhatsApp numbers
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const text = $(script).html() || '';
    const match = text.match(/whatsapp['":\s]+['"]([\d+]+)['"]/i);
    if (match) return match[1];
  }
  
  return undefined;
}

/**
 * Detect property subtype from text
 */
function detectPropertySubtype(title: string, description: string, url: string): ParsedListing['property_subtype'] {
  const text = [title, description, url].join(' ').toLowerCase();
  
  if (text.includes('ático') || text.includes('penthouse') || text.includes('atico')) return 'penthouse';
  if (text.includes('dúplex') || text.includes('duplex')) return 'duplex';
  if (text.includes('estudio') || text.includes('studio') || text.includes('loft')) return 'studio';
  if (text.includes('chalet independiente') || text.includes('detached')) return 'chalet_detached';
  if (text.includes('chalet pareado') || text.includes('semi-detached')) return 'chalet_semi';
  if (text.includes('chalet adosado') || text.includes('adosado') || text.includes('terraced')) return 'chalet_terraced';
  if (text.includes('finca') || text.includes('rústica') || text.includes('rustic')) return 'rustic';
  if (text.includes('piso') || text.includes('apartamento') || text.includes('flat') || text.includes('apartment')) return 'flat';
  
  return 'flat'; // Default
}

/**
 * Detect condition from text
 */
function detectCondition(description: string, features: string[]): ParsedListing['condition'] {
  const text = [...features, description].join(' ').toLowerCase();
  
  if (text.includes('obra nueva') || text.includes('a estrenar') || text.includes('new build')) return 'new';
  if (text.includes('reformar') || text.includes('para reformar') || text.includes('to renovate')) return 'renovate';
  
  return 'good'; // Default
}

/**
 * Detect floor level from floor number or text
 */
function detectFloorLevel(floorNum: number | undefined, features: string[]): ParsedListing['floor_level'] {
  const text = features.join(' ').toLowerCase();
  
  if (floorNum === 0 || text.includes('bajo') || text.includes('planta baja') || text.includes('ground')) return 'ground';
  if (text.includes('ático') || text.includes('última planta') || text.includes('top floor')) return 'top';
  
  return 'intermediate';
}

/**
 * Extract postal code from address
 */
function extractPostalCode(address: string): string | undefined {
  const match = address.match(/\b(0[1-9]|[1-4][0-9]|5[0-2])\d{3}\b/);  // Spanish postal codes
  return match ? match[0] : undefined;
}

/**
 * Parse listing HTML using learned selectors
 */
export function parseWithStudent(
  html: string,
  url: string,
  domain: string,
  selectors: Selectors,
  selectorVersion: number = 1
): ParsedListing {
  const $ = cheerio.load(html);

  // Extract coordinates with Spain validation
  const coords = extractCoordinates($, html, selectors);

  // Extract photos
  const photos = extractPhotos($, html, selectors.photos || null);
  
  // Extract base fields
  const title = getText($, selectors.title) || '';
  const description = getText($, selectors.description) || '';
  const address = getText($, selectors.address) || '';
  const features = selectors.features 
    ? $(selectors.features).map((_, el) => $(el).text().trim()).get().filter(Boolean)
    : [];
  const floorNum = extractNumber(getText($, selectors.floor_number));

  // Build parsed listing
  const listing: ParsedListing = {
    url,
    domain,
    
    // Basic info
    title,
    price_eur: extractPrice(getText($, selectors.price)),
    price_period: detectPricePeriod(getText($, selectors.price_period) || url),
    
    // Size
    m2_built: extractNumber(getText($, selectors.m2_built)),
    m2_useful: extractNumber(getText($, selectors.m2_useful)),
    bedrooms: extractNumber(getText($, selectors.bedrooms)),
    bathrooms: extractNumber(getText($, selectors.bathrooms)),
    
    // Location (Nominatim-compatible)
    street_name: getText($, selectors.street_name),
    street_number: getText($, selectors.street_number),
    address,
    neighborhood: getText($, selectors.neighborhood),
    city: getText($, selectors.city),
    region: getText($, selectors.region),
    postal_code: extractPostalCode(address),
    lat: coords.lat,
    lng: coords.lng,
    spain_territory: coords.region,
    
    // Type
    listing_type: detectListingType(url, title),
    property_subtype: detectPropertySubtype(title, description, url),
    housing_situation: detectHousingSituation(description, features),
    ad_origin: detectAdOrigin(description, url),
    condition: detectCondition(description, features),
    
    // Building specs
    floor_level: detectFloorLevel(floorNum, features),
    floor_number: floorNum,
    has_elevator: hasAmenity(features, description, ['ascensor', 'elevator', 'lift']),
    is_exterior: hasAmenity(features, description, ['exterior']) || !hasAmenity(features, description, ['interior']),
    
    // Amenities
    has_terrace: hasAmenity(features, description, ['terraza', 'terrace']),
    terrace_orientation: detectOrientation(features, description, 'terraza'),
    has_balcony: hasAmenity(features, description, ['balcón', 'balcon', 'balcony']),
    balcony_orientation: detectOrientation(features, description, 'balcón'),
    has_pool: hasAmenity(features, description, ['piscina', 'pool']),
    has_garage: hasAmenity(features, description, ['garaje', 'garage', 'parking', 'plaza de garaje']),
    has_garden: hasAmenity(features, description, ['jardín', 'jardin', 'garden']),
    has_air_conditioning: hasAmenity(features, description, ['aire acondicionado', 'air conditioning', 'a/c', 'climatización']),
    has_wardrobes: hasAmenity(features, description, ['armarios empotrados', 'built-in wardrobes', 'armarios']),
    is_accessible: hasAmenity(features, description, ['accesible', 'accessible', 'adaptado']),
    has_storage: hasAmenity(features, description, ['trastero', 'storage', 'almacén']),
    
    // Details
    description,
    features,
    reference: getText($, selectors.reference),
    
    // Media
    photos: photos.length > 0 ? photos : undefined,
    main_image: photos[0] || getText($, selectors.main_image),
    
    // Agency
    agency_name: getText($, selectors.agency_name),
    agency_logo: $(selectors.agency_logo || '.agency-logo img').attr('src'),
    agency_phone: getText($, selectors.agency_phone),
    agency_email: getText($, selectors.agency_email),
    agency_whatsapp: extractWhatsApp($, html),
    agent_name: getText($, selectors.agent_name),
    
    // Metadata
    parsed_at: new Date().toISOString(),
    selector_version: selectorVersion,
  };

  return listing;
}

/**
 * Detect listing type from URL or title
 */
function detectListingType(url: string, title: string): ParsedListing['listing_type'] {
  const text = [url, title].join(' ').toLowerCase();
  if (text.includes('alquiler') || text.includes('/rent') || text.includes('for-rent')) return 'rent';
  if (text.includes('venta') || text.includes('/sale') || text.includes('for-sale')) return 'sale';
  return 'sale'; // Default
}

/**
 * Detect price period
 */
function detectPricePeriod(text: string): ParsedListing['price_period'] {
  const lower = text.toLowerCase();
  if (lower.includes('/mes') || lower.includes('/month') || lower.includes('mensual')) return 'month';
  if (lower.includes('/semana') || lower.includes('/week') || lower.includes('semanal')) return 'week';
  return 'total';
}

/**
 * Detect housing situation
 */
function detectHousingSituation(description: string, features: string[]): ParsedListing['housing_situation'] {
  const text = [...features, description].join(' ').toLowerCase();
  if (text.includes('alquilado') || text.includes('inquilino') || text.includes('rented')) return 'rented';
  if (text.includes('nuda propiedad') || text.includes('bare ownership')) return 'bare_ownership';
  if (text.includes('okupado') || text.includes('squatted')) return 'squatted';
  if (text.includes('subasta') || text.includes('auction')) return 'auction';
  return 'free';
}

/**
 * Detect ad origin (bank or standard)
 */
function detectAdOrigin(description: string, url: string): ParsedListing['ad_origin'] {
  const text = [description, url].join(' ').toLowerCase();
  if (text.includes('banco') || text.includes('bank') || text.includes('entidad bancaria')) return 'bank';
  return 'standard';
}

/**
 * Quick validation - check if essential fields were extracted
 */
export function hasEssentialFields(listing: ParsedListing): boolean {
  // Must have at least price OR (bedrooms AND area)
  const hasPrice = listing.price_eur && listing.price_eur > 0;
  const hasBasicInfo = listing.bedrooms && listing.bedrooms > 0 && listing.m2_built && listing.m2_built > 0;
  return hasPrice || hasBasicInfo;
}

