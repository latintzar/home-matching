/**
 * Listing Tracking Utilities for Premium Domain Harvesters
 * 
 * Provides consistent tracking across all premium domain Lambda harvesters:
 * - Photo classification (floorplan vs regular)
 * - Status tracking (active/sold/removed)
 * - First seen / last seen dates
 * - Days on market calculation
 * - Publication date detection
 * 
 * Usage:
 *   import { classifyPhotos, buildTrackingData } from '../lib/harvest/listing-tracking';
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({});
const LEO_LISTINGS_TABLE = 'leo-listings';

// ============================================================
// PHOTO CLASSIFICATION
// ============================================================

/**
 * Patterns to identify floorplan photos
 */
const FLOORPLAN_PATTERNS = [
  /floorplan/i,
  /floor[-_]?plan/i,
  /plano/i,
  /planta/i,
  /grundriss/i,        // German
  /plan[-_]?de[-_]?planta/i,
  /distribucion/i,
  /layout/i,
  /blueprint/i,
  /esquema/i,
  /croquis/i,
  /planimetria/i,
  /pianta/i,           // Italian
  /2d[-_]?plan/i,
  /floor[-_]?drawing/i
];

/**
 * Patterns to identify other special photo types
 */
const SPECIAL_PHOTO_PATTERNS: Record<string, RegExp[]> = {
  exterior: [/exterior/i, /fachada/i, /facade/i, /outside/i, /building/i, /edificio/i],
  aerial: [/aerial/i, /drone/i, /bird[-_]?eye/i, /aereo/i],
  map: [/map/i, /mapa/i, /location/i, /ubicacion/i, /situacion/i],
  video: [/video/i, /tour/i, /360/i, /virtual/i],
  energyCertificate: [/energy/i, /certificado[-_]?energetico/i, /cee/i, /eficiencia/i]
};

export interface ClassifiedPhotos {
  regular: string[];
  floorplan: string[];
  exterior: string[];
  aerial: string[];
  map: string[];
  other: string[];
  total: number;
}

/**
 * Classify photos into categories based on URL/filename patterns
 */
export function classifyPhotos(photoUrls: string[]): ClassifiedPhotos {
  const result: ClassifiedPhotos = {
    regular: [],
    floorplan: [],
    exterior: [],
    aerial: [],
    map: [],
    other: [],
    total: photoUrls.length
  };
  
  for (const url of photoUrls) {
    const filename = url.split('/').pop()?.toLowerCase() || '';
    const fullPath = url.toLowerCase();
    
    // Check for floorplan
    if (FLOORPLAN_PATTERNS.some(p => p.test(filename) || p.test(fullPath))) {
      result.floorplan.push(url);
      continue;
    }
    
    // Check for other special types
    let isSpecial = false;
    for (const [type, patterns] of Object.entries(SPECIAL_PHOTO_PATTERNS)) {
      if (patterns.some(p => p.test(filename) || p.test(fullPath))) {
        if (type === 'exterior') result.exterior.push(url);
        else if (type === 'aerial') result.aerial.push(url);
        else if (type === 'map') result.map.push(url);
        else result.other.push(url);
        isSpecial = true;
        break;
      }
    }
    
    if (!isSpecial) {
      result.regular.push(url);
    }
  }
  
  return result;
}

// ============================================================
// LISTING STATUS TRACKING
// ============================================================

export type ListingStatus = 'active' | 'sold' | 'rented' | 'removed' | 'unknown';

export interface ListingTrackingData {
  status: ListingStatus;
  status_signal: string;
  first_seen: string;
  last_seen: string;
  days_on_market: number;
  publication_date: string | null;
  price_history: Array<{ price: number; date: string }>;
}

/**
 * Get existing listing data from DynamoDB to track history
 */
export async function getExistingListing(
  domain: string, 
  listingId: string
): Promise<{ first_seen?: string; price_history?: Array<{ price: number; date: string }> } | null> {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: LEO_LISTINGS_TABLE,
      Key: {
        pk: { S: `LISTING#${domain}#${listingId}` },
        sk: { S: 'METADATA' }
      },
      ProjectionExpression: 'first_seen, price_history, price'
    }));
    
    if (!result.Item) return null;
    
    return {
      first_seen: result.Item.first_seen?.S,
      price_history: result.Item.price_history?.L?.map(item => ({
        price: parseInt(item.M?.price?.N || '0', 10),
        date: item.M?.date?.S || ''
      }))
    };
  } catch (error) {
    // Listing doesn't exist yet
    return null;
  }
}

/**
 * Build tracking data for a listing
 */
export function buildTrackingData(
  existing: { first_seen?: string; price_history?: Array<{ price: number; date: string }> } | null,
  currentPrice: number | null,
  publicationDate: string | null = null
): ListingTrackingData {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  
  // First seen: use existing or set to now
  const first_seen = existing?.first_seen || now;
  
  // Calculate days on market
  const firstSeenDate = new Date(first_seen);
  const daysOnMarket = Math.floor((Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Price history: append if price changed
  let price_history = existing?.price_history || [];
  if (currentPrice) {
    const lastPrice = price_history.length > 0 ? price_history[price_history.length - 1].price : null;
    if (lastPrice !== currentPrice) {
      price_history = [...price_history, { price: currentPrice, date: today }];
    }
  }
  
  return {
    status: 'active', // Will be set to 'removed' by detect-listing-status Lambda
    status_signal: 'in_sitemap',
    first_seen,
    last_seen: now,
    days_on_market: daysOnMarket,
    publication_date: publicationDate,
    price_history
  };
}

// ============================================================
// PUBLICATION DATE DETECTION
// ============================================================

/**
 * Try to extract publication date from various sources
 */
export function extractPublicationDate(
  html: string,
  $: any, // Cheerio API
  lastmod?: string | null
): string | null {
  // Try structured data
  try {
    // JSON-LD datePosted
    const jsonLdScript = $('script[type="application/ld+json"]').html();
    if (jsonLdScript) {
      const data = JSON.parse(jsonLdScript);
      if (data.datePosted) return data.datePosted;
      if (data.datePublished) return data.datePublished;
      if (data.dateCreated) return data.dateCreated;
    }
  } catch (e) {
    // Continue to other methods
  }
  
  // Try meta tags
  const metaDate = $('meta[property="article:published_time"]').attr('content') ||
                   $('meta[name="date"]').attr('content') ||
                   $('meta[name="DC.date"]').attr('content');
  if (metaDate) return metaDate;
  
  // Try common date elements in Spanish real estate sites
  const dateSelectors = [
    '.fecha-publicacion',
    '.date-published',
    '.published-date',
    '[itemprop="datePosted"]',
    '.listing-date',
    '.property-date'
  ];
  
  for (const selector of dateSelectors) {
    const dateText = $(selector).text().trim();
    if (dateText) {
      const parsed = parseSpanishDate(dateText);
      if (parsed) return parsed;
    }
  }
  
  // Fall back to lastmod from sitemap if available
  if (lastmod) return lastmod;
  
  return null;
}

/**
 * Parse Spanish date formats
 */
function parseSpanishDate(text: string): string | null {
  // Common patterns: "15 de diciembre de 2024", "15/12/2024", "2024-12-15"
  
  // ISO format
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  
  // DD/MM/YYYY
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }
  
  // Spanish month names
  const monthMap: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  
  const spanishMatch = text.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (spanishMatch && monthMap[spanishMatch[2]]) {
    return `${spanishMatch[3]}-${monthMap[spanishMatch[2]]}-${spanishMatch[1].padStart(2, '0')}`;
  }
  
  return null;
}

// ============================================================
// DYNAMODB ITEM BUILDER
// ============================================================

export interface EnhancedListingData {
  // Core fields
  domain: string;
  listing_id: string;
  url: string;
  title: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  province: string | null;
  description: string;
  property_type: string | null;
  contract_type: string;
  amenities: string[];
  
  // Photo classification
  photos: ClassifiedPhotos;
  
  // Tracking data
  tracking: ListingTrackingData;
}

/**
 * Build DynamoDB item with all enhanced fields
 */
export function buildDynamoDBItem(listing: EnhancedListingData) {
  const now = new Date().toISOString();
  
  return {
    pk: { S: `LISTING#${listing.domain}#${listing.listing_id}` },
    sk: { S: 'METADATA' },
    domain: { S: listing.domain },
    listing_id: { S: listing.listing_id },
    url: { S: listing.url },
    title: { S: listing.title },
    price: listing.price ? { N: listing.price.toString() } : { NULL: true },
    bedrooms: listing.bedrooms ? { N: listing.bedrooms.toString() } : { NULL: true },
    bathrooms: listing.bathrooms ? { N: listing.bathrooms.toString() } : { NULL: true },
    area_m2: listing.area_m2 ? { N: listing.area_m2.toString() } : { NULL: true },
    latitude: listing.latitude ? { N: listing.latitude.toString() } : { NULL: true },
    longitude: listing.longitude ? { N: listing.longitude.toString() } : { NULL: true },
    city: listing.city ? { S: listing.city } : { NULL: true },
    province: listing.province ? { S: listing.province } : { NULL: true },
    description: { S: listing.description.substring(0, 2000) },
    property_type: listing.property_type ? { S: listing.property_type } : { NULL: true },
    contract_type: { S: listing.contract_type },
    amenities: { L: listing.amenities.map(a => ({ S: a })) },
    
    // Classified photos
    photos: { L: listing.photos.regular.slice(0, 20).map(p => ({ S: p })) },
    photos_floorplan: { L: listing.photos.floorplan.map(p => ({ S: p })) },
    photos_exterior: { L: listing.photos.exterior.slice(0, 5).map(p => ({ S: p })) },
    photos_aerial: { L: listing.photos.aerial.slice(0, 3).map(p => ({ S: p })) },
    photos_other: { L: listing.photos.other.slice(0, 5).map(p => ({ S: p })) },
    photo_count: { N: listing.photos.total.toString() },
    
    // Tracking fields
    status: { S: listing.tracking.status },
    status_signal: { S: listing.tracking.status_signal },
    first_seen: { S: listing.tracking.first_seen },
    last_seen: { S: listing.tracking.last_seen },
    days_on_market: { N: listing.tracking.days_on_market.toString() },
    publication_date: listing.tracking.publication_date ? { S: listing.tracking.publication_date } : { NULL: true },
    price_history: { 
      L: listing.tracking.price_history.map(ph => ({
        M: {
          price: { N: ph.price.toString() },
          date: { S: ph.date }
        }
      }))
    },
    
    // Timestamps
    updated_at: { S: now },
    
    // GSI keys
    gsi1pk: { S: `DOMAIN#${listing.domain}` },
    gsi1sk: { S: now }
  };
}

// ============================================================
// HARVEST STATS
// ============================================================

export interface HarvestStats {
  domain: string;
  sitemap_total: number;
  processed: number;
  new_listings: number;
  updated_listings: number;
  failed: number;
  geocoded: number;
  photos_classified: {
    total: number;
    regular: number;
    floorplan: number;
    other: number;
  };
  duration_seconds: number;
  timestamp: string;
}

export function createHarvestStats(
  domain: string,
  sitemapTotal: number,
  processed: number,
  newListings: number,
  updatedListings: number,
  failed: number,
  geocoded: number,
  photosClassified: { total: number; regular: number; floorplan: number; other: number },
  startTime: number
): HarvestStats {
  return {
    domain,
    sitemap_total: sitemapTotal,
    processed,
    new_listings: newListings,
    updated_listings: updatedListings,
    failed,
    geocoded,
    photos_classified: photosClassified,
    duration_seconds: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  };
}

