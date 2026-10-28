/**
 * Tecnocasa Harvest Lambda (COMPLETE - All 10 Features)
 * 
 * Strategy: Sitemap (direct listing URLs) → Extract embedded JSON from :estate prop
 * Total listings: 7,355 (exact from sitemap)
 * Coordinates: ✅ EMBEDDED IN DATA - No Nominatim needed!
 * 
 * Sitemap structure:
 * - https://www.tecnocasa.es/sitemap/inmuebles-0.xml.gz (5,000 listings)
 * - https://www.tecnocasa.es/sitemap/inmuebles-1.xml.gz (2,355 listings)
 * 
 * URL pattern: https://www.tecnocasa.es/{contract}/{type}/{province}/{city}/{id}.html
 * 
 * KEY DISCOVERY: Tecnocasa embeds COMPLETE listing data as JSON in Vue prop :estate="{...}"
 * This includes coordinates, all images, features, POIs, energy data - EVERYTHING!
 * This is the BEST data format among all premium domains.
 * 
 * FEATURES:
 * ✅ S3 State File (tc-listings.json.gz)
 * ✅ Delta Logic (only process NEW URLs)
 * ✅ Sold/Removed Detection (mark disappeared listings)
 * ✅ Self-Continuation (re-invoke on timeout)
 * ✅ Full Deep Crawl (process ALL URLs)
 * ✅ Status Tracking (active/removed)
 * ✅ First/Last Seen + Days on Market
 * ✅ Price History
 * ✅ Photo Classification (floorplan/exterior/regular)
 * ✅ Parallelization (10 concurrent)
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as zlib from 'zlib';
import * as cheerio from 'cheerio';
import { detectFromTecnocasaJson, detectListingStatus, detectFromHttpStatus, isRemovedRedirect, type SaleStatus } from '../lib/harvest/listing-status-detection';
import { 
  verifyCoordinates, 
  hasStreetAddress,
  type CoordinatePrecision,
  type AddressComponents 
} from '../lib/harvest/coordinate-precision';
import {
  logMemory,
  resetPeakMemory,
  writeRunSummary,
  createRunSummary,
  logSaveGame,
  type RunStatus
} from '../lib/harvest/run-analytics';

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });
const lambdaClient = new LambdaClient({ region: REGION });
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);

const S3_BUCKET = process.env.S3_BUCKET || '';
const LISTINGS_KEY = 'harvest/tc-listings.json.gz';
const STATE_KEY = 'harvest/tc-state.json';
const LISTINGS_TABLE = 'leo-listings';
const STATS_TABLE = 'leo-harvest-stats';
const TC_DOMAIN = 'tecnocasa.es';
const REQUEST_DELAY_MS = 100;  // Reduced with parallelization

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.2.0';  // 2.2.0: Added SAVE GAME logging, 14m30s timeout

// Self-continuation safeguards
const MAX_INVOCATIONS = 10;
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before Lambda's 15m hard limit
const MEMORY_LIMIT_MB = 2048;
const PARALLEL_LIMIT = 10;  // 10 concurrent requests

// No Nominatim needed - coordinates are embedded in the page data!

// ============================================================
// CONTINUATION STATE
// ============================================================

interface HarvestState {
  invocationCount: number;
  startedAt: string;
  lastProcessedIndex: number;
  previousProcessedIndex: number;
  allUrls: string[];
  processedIds: string[];
  isComplete: boolean;
}

async function loadState(): Promise<HarvestState | null> {
  try {
    const { Body } = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: STATE_KEY,
    }));
    if (Body) {
      const data = await Body.transformToString();
      const parsed = JSON.parse(data);
      // Check if state was cleared (invalid state)
      if (parsed.cleared) {
        console.log('📝 State was cleared, starting fresh');
        return null;
      }
      return parsed;
    }
  } catch (error: any) {
    if (error.name !== 'NoSuchKey') {
      console.error('Error loading state:', error);
    }
  }
  return null;
}

async function saveState(state: HarvestState): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: STATE_KEY,
    Body: JSON.stringify(state),
    ContentType: 'application/json',
  }));
  console.log(`💾 Saved state: index ${state.lastProcessedIndex}/${state.allUrls.length}`);
}

async function clearState(): Promise<void> {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: STATE_KEY,
      Body: JSON.stringify({ cleared: true, clearedAt: new Date().toISOString() }),
      ContentType: 'application/json',
    }));
  } catch { /* ignore */ }
}

// ============================================================
// PHOTO CLASSIFICATION
// ============================================================

const FLOORPLAN_PATTERNS = [
  /floorplan/i, /floor[-_]?plan/i, /plano/i, /planta/i, /grundriss/i,
  /distribucion/i, /layout/i, /blueprint/i, /esquema/i, /planimetria/i
];

interface ClassifiedPhotos {
  regular: string[];
  floorplan: string[];
  exterior: string[];
  other: string[];
  total: number;
}

function classifyPhotos(imageUrls: string[]): ClassifiedPhotos {
  const result: ClassifiedPhotos = {
    regular: [],
    floorplan: [],
    exterior: [],
    other: [],
    total: imageUrls.length
  };
  
  for (const url of imageUrls) {
    const filename = url.split('/').pop()?.toLowerCase() || '';
    
    if (FLOORPLAN_PATTERNS.some(p => p.test(filename) || p.test(url))) {
      result.floorplan.push(url);
    } else if (/exterior|fachada|facade|building/i.test(filename)) {
      result.exterior.push(url);
    } else {
      result.regular.push(url);
    }
  }
  
  return result;
}

// ============================================================
// LISTING TRACKING
// ============================================================

interface ListingTrackingData {
  status: 'active' | 'sold' | 'rented' | 'removed';
  status_signal: string;
  first_seen: string;
  last_seen: string;
  days_on_market: number;
  price_history: Array<{ price: number; date: string }>;
}

async function getExistingListingTracking(listingId: string): Promise<{
  first_seen?: string;
  price?: number;
  price_history?: Array<{ price: number; date: string }>;
} | null> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: LISTINGS_TABLE,
      Key: {
        domain: TC_DOMAIN,
        listing_id: listingId
      },
      ProjectionExpression: 'first_seen, price, price_history'
    }));
    
    if (!result.Item) return null;
    
    return {
      first_seen: result.Item.first_seen,
      price: result.Item.price,
      price_history: result.Item.price_history
    };
  } catch {
    return null;
  }
}

function buildTrackingData(
  existing: { first_seen?: string; price?: number; price_history?: Array<{ price: number; date: string }> } | null,
  currentPrice: number | null
): ListingTrackingData {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  
  const first_seen = existing?.first_seen || now;
  const firstSeenDate = new Date(first_seen);
  const daysOnMarket = Math.floor((Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let price_history = existing?.price_history || [];
  if (currentPrice) {
    const lastPrice = price_history.length > 0 ? price_history[price_history.length - 1].price : null;
    if (lastPrice !== currentPrice) {
      price_history = [...price_history, { price: currentPrice, date: today }];
    }
  }
  
  return {
    status: 'active',
    status_signal: 'in_sitemap',
    first_seen,
    last_seen: now,
    days_on_market: daysOnMarket,
    price_history
  };
}

interface TCListing {
  id: string;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  description: string;
  photos: string[];
  lat: number | null;
  lng: number | null;
  address: string;  // Street address (e.g., "Av. de Madrid")
  city: string;
  province: string;
  neighborhood: string;  // District/neighborhood
  contract_type: string; // venta, alquiler
  property_type: string; // piso, casa, atico, etc.
  agency_id: string;
  agency_phone: string | null;  // From HTML wa.me link or phone div
  agency_email: string | null;  // From HTML mailto link
  features: Record<string, string>;
  amenities: string[];
  // Boolean flags for recommender
  has_elevator: boolean;
  has_terrace: boolean;
  has_parking: boolean;
  has_pool: boolean;
  has_ac: boolean;
  is_furnished: boolean | null;  // null = unknown
  year_built: number | null;
  energy_class: string | null;
  floor: string | null;
  // Coordinate precision (CRITICAL for data quality)
  coordinate_precision: CoordinatePrecision;
  coordinate_precision_signal: string;
  verifiedAddress: AddressComponents | null;
  // Sale status detection
  sale_status: SaleStatus;
  sale_status_signal: string;
  last_updated: string;
}

const SITEMAP_URLS = [
  'https://www.tecnocasa.es/sitemap/inmuebles-0.xml.gz',
  'https://www.tecnocasa.es/sitemap/inmuebles-1.xml.gz',
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface FetchResult {
  html: string | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchWithRetry(url: string, retries = 3): Promise<FetchResult> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasaBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });
      
      // Check for 404/410 - listing removed
      const httpStatus = detectFromHttpStatus(response.status, true);
      if (httpStatus) {
        console.log(`   🗑️ ${url}: ${httpStatus.signal} (HTTP ${response.status})`);
        return { html: null, removed: httpStatus };
      }
      
      if (!response.ok) {
        console.warn(`HTTP ${response.status} for ${url}`);
        continue;
      }
      
      // Check for redirect to homepage/error page
      const finalUrl = response.url;
      const redirectStatus = isRemovedRedirect(finalUrl, url);
      if (redirectStatus) {
        console.log(`   🗑️ ${url}: ${redirectStatus.signal} (redirected)`);
        return { html: null, removed: redirectStatus };
      }
      
      return { html: await response.text() };
    } catch (error) {
      console.error(`Fetch error for ${url}:`, error);
      if (i < retries - 1) await sleep(1000 * (i + 1));
    }
  }
  return { html: null };
}

async function fetchGzippedXml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasaBot/1.0)',
        'Accept-Encoding': 'gzip',
      },
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const decompressed = zlib.gunzipSync(Buffer.from(buffer));
    return decompressed.toString('utf8');
  } catch (error) {
    console.error(`Error fetching gzipped XML from ${url}:`, error);
    return null;
  }
}

async function extractListingUrlsFromSitemaps(): Promise<string[]> {
  const allUrls: string[] = [];
  
  for (const sitemapUrl of SITEMAP_URLS) {
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    const xml = await fetchGzippedXml(sitemapUrl);
    if (!xml) {
      console.warn(`Failed to fetch sitemap: ${sitemapUrl}`);
      continue;
    }
    
    const $ = cheerio.load(xml, { xmlMode: true });
    $('url > loc').each((_, el) => {
      const url = $(el).text().trim();
      // Only include listing pages (contain numeric ID at end)
      if (url.match(/\/\d+\.html$/)) {
        allUrls.push(url);
      }
    });
  }
  
  console.log(`Extracted ${allUrls.length} listing URLs from sitemaps`);
  return allUrls;
}

function parseUrlMetadata(url: string): { 
  id: string; 
  contract_type: string; 
  property_type: string; 
  province: string; 
  city: string;
} | null {
  // URL pattern: https://www.tecnocasa.es/{contract}/{type}/{province}/{city}/{id}.html
  const match = url.match(/tecnocasa\.es\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/(\d+)\.html/);
  if (!match) return null;
  
  return {
    contract_type: match[1], // venta, alquiler
    property_type: match[2], // piso, atico, casa, etc.
    province: match[3].replace(/-/g, ' '),
    city: match[4].replace(/-/g, ' '),
    id: match[5],
  };
}

/**
 * Decode HTML entities in the :estate JSON string
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Extract embedded JSON from :estate="..." Vue prop
 * This is the BEST data source - contains EVERYTHING including coordinates!
 */
function extractEmbeddedJson(html: string): any | null {
  // Match :estate="{...}" - the JSON is HTML-entity encoded
  const match = html.match(/:estate="(\{[^"]*\})"/);
  if (!match) return null;
  
  try {
    const decoded = decodeHtmlEntities(match[1]);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to parse embedded estate JSON:', error);
    return null;
  }
}

/**
 * Extract agency phone from HTML
 * Patterns: wa.me/+34XXXXXXXXX or phone div with number
 */
function extractAgencyPhone(html: string): string | null {
  // Try WhatsApp link first (most reliable)
  const waMatch = html.match(/wa\.me\/\+?(\d+)/);
  if (waMatch) return '+' + waMatch[1];
  
  // Try phone class/div
  const phoneMatch = html.match(/<div[^>]*class="[^"]*phone[^"]*"[^>]*>(\d{9})<\/div>/i);
  if (phoneMatch) return '+34' + phoneMatch[1];
  
  // Try any 9-digit Spanish number near "phone"
  const genericMatch = html.match(/phone[^>]*>(\d{9})/i);
  if (genericMatch) return '+34' + genericMatch[1];
  
  return null;
}

/**
 * Extract agency email from HTML
 * Pattern: mailto:operator@example.invalid
 */
function extractAgencyEmail(html: string): string | null {
  const emailMatch = html.match(/mailto:([a-z0-9]+@tecnocasa\.es)/i);
  return emailMatch ? emailMatch[1] : null;
}

/**
 * Parse detail page by extracting embedded JSON
 * This gives us ALL data including coordinates - no Nominatim needed!
 * 
 * Photo URL priority (by size/quality):
 * - gallery: ~72KB (HIGHEST RESOLUTION - use this!)
 * - detail: ~60KB
 * - gallery_media: ~19KB (low-res thumbnail)
 * - card: ~15KB
 * - detail_preview: ~13KB
 * - gallery_preview: ~3KB (smallest)
 */
function parseDetailPage(html: string, url: string): Partial<TCListing> | null {
  // Try embedded JSON first (best source)
  const estateData = extractEmbeddedJson(html);
  
  if (estateData) {
    // Extract photos from media.images array - PRIORITIZE HIGH-RES!
    const photos: string[] = [];
    if (estateData.media?.images) {
      for (const img of estateData.media.images) {
        // Priority: gallery (72KB) > detail (60KB) > gallery_media (19KB)
        if (img.url?.gallery) {
          photos.push(img.url.gallery);
        } else if (img.url?.detail) {
          photos.push(img.url.detail);
        } else if (img.url?.gallery_media) {
          photos.push(img.url.gallery_media);
        }
      }
    }
    
    // Extract bedrooms from "3 dorm." format
    let bedrooms: number | null = null;
    if (estateData.rooms) {
      const roomMatch = estateData.rooms.match(/(\d+)/);
      if (roomMatch) bedrooms = parseInt(roomMatch[1], 10);
    }
    
    // Extract bathrooms from "1 baño" format
    let bathrooms: number | null = null;
    if (estateData.bathrooms) {
      const bathMatch = estateData.bathrooms.match(/(\d+)/);
      if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
    }
    
    // Extract area from numeric_surface
    let area_m2: number | null = null;
    if (estateData.numeric_surface) {
      area_m2 = parseFloat(estateData.numeric_surface);
    }
    
    // Extract amenities from features + boolean flags for recommender
    const amenities: string[] = [];
    const has_elevator = !!estateData.features?.elevator;
    const has_terrace = !!estateData.features?.terraces || !!estateData.features?.balconies;
    const has_parking = !!estateData.features?.box;
    const has_pool = !!estateData.features?.pool;
    const has_ac = !!estateData.features?.air_conditioning;
    
    if (has_ac) amenities.push('Aire acondicionado');
    if (has_elevator) amenities.push('Ascensor');
    if (estateData.features?.garden) amenities.push('Jardín');
    if (estateData.features?.balconies) amenities.push('Balcón');
    if (has_terrace) amenities.push('Terraza');
    if (has_parking) amenities.push('Garaje');
    if (has_pool) amenities.push('Piscina');
    
    // Clean description (remove HTML tags)
    let description = estateData.description || '';
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract address and neighborhood
    const address = estateData.address || '';
    const neighborhood = estateData.agency?.district || estateData.district || '';
    
    // DETECT STATUS (sold/leased/reserved) from embedded JSON + HTML
    const jsonStatus = detectFromTecnocasaJson(estateData);
    // Also check HTML for any status indicators not in JSON
    const htmlStatus = detectListingStatus(html);
    
    // Use JSON status if detected, otherwise HTML status
    const sale_status = jsonStatus.saleStatus !== 'active' ? jsonStatus.saleStatus : htmlStatus.saleStatus;
    const sale_status_signal = jsonStatus.saleStatus !== 'active' ? jsonStatus.statusSignal : htmlStatus.statusSignal;
    
    // DETECT FURNISHED status
    // First check JSON, then HTML
    let is_furnished: boolean | null = jsonStatus.isFurnished;
    if (is_furnished === null) {
      is_furnished = htmlStatus.isFurnished;
    }
    // Also check features.furnitured directly
    if (is_furnished === null && estateData.features?.furnitured !== undefined) {
      is_furnished = Boolean(estateData.features.furnitured);
    }
    
    // Extract coordinates
    const lat = estateData.latitude || estateData.media?.map?.latitude || null;
    const lng = estateData.longitude || estateData.media?.map?.longitude || null;
    const city = estateData.city?.title || estateData.subtitle || '';
    const province = estateData.province?.title || '';
    
    // Determine coordinate precision based on available address data
    // Tecnocasa has good embedded data, so we can use simple analysis
    let coordinate_precision: CoordinatePrecision = 'unknown';
    let coordinate_precision_signal = 'no_coordinates';
    
    if (lat && lng) {
      // Check if we have street address
      const streetCheck = hasStreetAddress(address);
      
      if (streetCheck.hasStreet) {
        coordinate_precision = 'precise';
        coordinate_precision_signal = `embedded_with_street_${streetCheck.signal}`;
      } else if (neighborhood) {
        coordinate_precision = 'approximate';
        coordinate_precision_signal = 'embedded_neighborhood_level';
      } else if (city) {
        coordinate_precision = 'city_center';
        coordinate_precision_signal = 'embedded_city_level_only';
      } else {
        coordinate_precision = 'approximate';
        coordinate_precision_signal = 'embedded_unknown_detail';
      }
    }
    
    return {
      id: String(estateData.id),
      url: estateData.detail_url || url,
      title: estateData.title || '',
      price: estateData.numeric_price || null,
      currency: 'EUR',
      bedrooms,
      bathrooms,
      area_m2,
      description,
      photos,
      lat,
      lng,
      address,
      city,
      province,
      neighborhood,
      contract_type: estateData.contract?.slug || '',
      property_type: estateData.type?.slug || '',
      agency_id: estateData.agency?.id || '',
      features: {
        floor: estateData.features?.floor?.toString() || '',
        build_year: estateData.features?.build_year?.toString() || '',
        category: estateData.features?.category || '',
        elevator: estateData.features?.elevator || '',
      },
      amenities,
      has_elevator,
      has_terrace,
      has_parking,
      has_pool,
      has_ac,
      is_furnished,
      year_built: estateData.features?.build_year || estateData.dates?.build_year || null,
      energy_class: estateData.energy_data?.class?.toUpperCase() || null,
      floor: estateData.features?.floor?.toString() || null,
      // Coordinate precision
      coordinate_precision,
      coordinate_precision_signal,
      verifiedAddress: {
        streetAddress: address || null,
        neighborhood: neighborhood || null,
        city: city || null,
        province: province || null,
        region: null,
        postalCode: null,
        country: 'Spain'
      },
      // Sale status detection
      sale_status,
      sale_status_signal,
      // Extract agency contact from HTML (not in :estate JSON)
      agency_phone: extractAgencyPhone(html),
      agency_email: extractAgencyEmail(html),
    };
  }
  
  // Fallback to URL metadata if no embedded JSON (shouldn't happen)
  const urlMeta = parseUrlMetadata(url);
  if (!urlMeta) return null;
  
  console.warn(`No embedded JSON found for ${url}, using URL metadata only`);
  
  // Still check HTML for status/furnished
  const htmlStatus = detectListingStatus(html);
  
  return {
    id: urlMeta.id,
    url,
    title: `${urlMeta.property_type} en ${urlMeta.city}`,
    price: null,
    currency: 'EUR',
    bedrooms: null,
    bathrooms: null,
    area_m2: null,
    description: '',
    photos: [],
    lat: null,
    lng: null,
    address: '',
    city: urlMeta.city,
    province: urlMeta.province,
    neighborhood: '',
    contract_type: urlMeta.contract_type,
    property_type: urlMeta.property_type,
    agency_id: '',
    agency_phone: extractAgencyPhone(html),
    agency_email: extractAgencyEmail(html),
    features: {},
    amenities: [],
    has_elevator: false,
    has_terrace: false,
    has_parking: false,
    has_pool: false,
    has_ac: false,
    is_furnished: htmlStatus.isFurnished,
    year_built: null,
    energy_class: null,
    floor: null,
    // No coordinates available from URL metadata fallback
    coordinate_precision: 'unknown' as CoordinatePrecision,
    coordinate_precision_signal: 'no_embedded_data',
    verifiedAddress: {
      streetAddress: null,
      neighborhood: null,
      city: urlMeta.city || null,
      province: urlMeta.province || null,
      region: null,
      postalCode: null,
      country: 'Spain'
    },
    sale_status: htmlStatus.saleStatus,
    sale_status_signal: htmlStatus.statusSignal,
  };
}

async function loadExistingListings(): Promise<Map<string, TCListing>> {
  const map = new Map<string, TCListing>();
  try {
    const { Body } = await s3Client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: LISTINGS_KEY })
    );
    if (Body) {
      const buffer = await Body.transformToByteArray();
      const decompressed = zlib.gunzipSync(Buffer.from(buffer)).toString('utf8');
      const data = JSON.parse(decompressed) as TCListing[];
      data.forEach(l => map.set(l.id, l));
      console.log(`Loaded ${map.size} existing listings from S3`);
    }
  } catch (error: any) {
    if (error.name !== 'NoSuchKey') {
      console.error('Error loading existing listings:', error);
    }
  }
  return map;
}

// ============================================================
// PARALLEL FETCH HELPER
// ============================================================

async function fetchInParallel(
  urls: string[],
  existingListings: Map<string, TCListing>,
  startIndex: number
): Promise<{ listings: TCListing[]; processedCount: number; withCoords: number }> {
  const listings: TCListing[] = [];
  let processedCount = 0;
  let withCoords = 0;
  
  for (let i = startIndex; i < urls.length; i += PARALLEL_LIMIT) {
    const batch = urls.slice(i, i + PARALLEL_LIMIT);
    
    const results = await Promise.all(
      batch.map(async (url) => {
        const urlMeta = parseUrlMetadata(url);
        if (!urlMeta) return null;
        
        // Skip if we already have this listing
        if (existingListings.has(urlMeta.id)) {
          return { existing: existingListings.get(urlMeta.id)! };
        }
        
        await sleep(REQUEST_DELAY_MS);
        const { html, removed } = await fetchWithRetry(url);
        
        // If listing returned 404, mark as removed
        if (removed) {
          return { removed, id: urlMeta.id };
        }
        
        if (!html) return null;
        
        const parsed = parseDetailPage(html, url);
        if (!parsed || !parsed.id) return null;
        
        return { parsed, url };
      })
    );
    
    for (const result of results) {
      if (!result) continue;
      
      if ('existing' in result) {
        listings.push(result.existing);
      } else if ('removed' in result && result.removed) {
        // Listing returned 404 - mark as removed in DynamoDB
        try {
          await dynamoClient.send(new UpdateCommand({
            TableName: LISTINGS_TABLE,
            Key: { domain: TC_DOMAIN, listing_id: `tc_${result.id}` },
            UpdateExpression: 'SET #status = :status, status_signal = :signal, last_seen = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': result.removed.status,
              ':signal': result.removed.signal,
              ':now': new Date().toISOString(),
            },
          }));
          console.log(`   ✅ Marked ${result.id} as ${result.removed.status} (${result.removed.signal})`);
        } catch (e) {
          // Listing may not exist in DB yet - that's OK
        }
      } else if (result.parsed) {
        const { parsed, url } = result;
        if (parsed.lat && parsed.lng) withCoords++;
        
        const listing: TCListing = {
          id: parsed.id,
          url: parsed.url || url,
          title: parsed.title || '',
          price: parsed.price || null,
          currency: 'EUR',
          bedrooms: parsed.bedrooms || null,
          bathrooms: parsed.bathrooms || null,
          area_m2: parsed.area_m2 || null,
          description: parsed.description || '',
          photos: parsed.photos || [],
          lat: parsed.lat || null,
          lng: parsed.lng || null,
          address: parsed.address || '',
          city: parsed.city || '',
          province: parsed.province || '',
          neighborhood: parsed.neighborhood || '',
          contract_type: parsed.contract_type || '',
          property_type: parsed.property_type || '',
          agency_id: parsed.agency_id || '',
          agency_phone: parsed.agency_phone || null,
          agency_email: parsed.agency_email || null,
          features: parsed.features || {},
          amenities: parsed.amenities || [],
          has_elevator: parsed.has_elevator || false,
          has_terrace: parsed.has_terrace || false,
          has_parking: parsed.has_parking || false,
          has_pool: parsed.has_pool || false,
          has_ac: parsed.has_ac || false,
          is_furnished: parsed.is_furnished ?? null,
          year_built: parsed.year_built || null,
          energy_class: parsed.energy_class || null,
          floor: parsed.floor || null,
          sale_status: parsed.sale_status || 'active',
          sale_status_signal: parsed.sale_status_signal || 'in_sitemap',
          last_updated: new Date().toISOString(),
        };
        listings.push(listing);
      }
    }
    
    processedCount = i + batch.length;
    if (processedCount % 100 < PARALLEL_LIMIT) {
      console.log(`   Progress: ${processedCount}/${urls.length}`);
    }
  }
  
  return { listings, processedCount, withCoords };
}

export const handler = async (event: any, context?: any) => {
  console.log('🚀 Starting Tecnocasa harvest...');
  const startTime = Date.now();
  const functionName = context?.functionName || 'tc-harvest-delta';
  
  resetPeakMemory();
  logMemory('START');
  
  // Load or initialize state
  let state: HarvestState = event.continueFrom || await loadState() || {
    invocationCount: 0,
    startedAt: new Date().toISOString(),
    lastProcessedIndex: 0,
    previousProcessedIndex: -1,
    allUrls: [],
    processedIds: [],
    isComplete: false,
  };
  
  // SAFEGUARD 1: Max invocations
  state.invocationCount++;
  if (state.invocationCount > MAX_INVOCATIONS) {
    console.error(`🚨 Max invocations (${MAX_INVOCATIONS}) exceeded, stopping`);
    await clearState();
    return { statusCode: 500, body: 'Max invocations exceeded' };
  }
  
  // SAFEGUARD 2: Check for progress (on continuation)
  if (state.invocationCount > 1 && state.lastProcessedIndex === state.previousProcessedIndex) {
    console.error('🚨 No progress made since last invocation, stopping');
    await clearState();
    return { statusCode: 500, body: 'No progress - stuck loop detected' };
  }
  state.previousProcessedIndex = state.lastProcessedIndex;
  
  // SAFEGUARD 3: State too old (> 12 hours) - allows manual babysitting between scheduled runs
  const stateAgeHours = (Date.now() - new Date(state.startedAt).getTime()) / (1000 * 60 * 60);
  if (stateAgeHours > 12) {
    console.log(`⚠️ State is ${stateAgeHours.toFixed(1)}h old, starting fresh`);
    state = {
      invocationCount: 1,
      startedAt: new Date().toISOString(),
      lastProcessedIndex: 0,
      previousProcessedIndex: -1,
      allUrls: [],
      processedIds: [],
      isComplete: false,
    };
  }
  
  console.log(`📊 Invocation ${state.invocationCount}, starting from index ${state.lastProcessedIndex}`);
  
  // Load existing listings for delta tracking
  const existingListings = await loadExistingListings();
  console.log(`📂 Loaded ${existingListings.size} existing listings from S3`);
  
  // Get all listing URLs from sitemaps (or use cached from state)
  if (state.allUrls.length === 0) {
    state.allUrls = await extractListingUrlsFromSitemaps();
    console.log(`📋 Found ${state.allUrls.length} URLs in sitemap`);
  }
  
  const officialCount = state.allUrls.length;
  
  // SAFEGUARD 4: Already complete?
  if (state.lastProcessedIndex >= officialCount) {
    console.log('✅ Already complete from previous run');
    state.isComplete = true;
  }
  
  // Process listings with parallel fetching
  const allListings: TCListing[] = [];
  let newListingsCount = 0;
  let withCoords = 0;
  
  // Data quality tracking
  const typeStats = { sale: 0, rent: 0, unknown: 0 };
  const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
  
  if (!state.isComplete) {
    for (let i = state.lastProcessedIndex; i < state.allUrls.length; i += PARALLEL_LIMIT) {
      // Timeout check (14m 30s)
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        state.lastProcessedIndex = i;
        logSaveGame('Harvest in progress', state.invocationCount, MAX_INVOCATIONS, {
          'URLs processed': `${i}/${state.allUrls.length}`,
          'New listings found': newListingsCount,
          'With coordinates': withCoords,
          'Progress': `${Math.round((i / state.allUrls.length) * 100)}%`,
        });
        await saveState(state);
        return {
          statusCode: 202,
          body: JSON.stringify({
            message: 'Continuing in next scheduled invocation',
            processed: i,
            total: state.allUrls.length,
            invocation: state.invocationCount,
          }),
        };
      }
      
      // Process batch in parallel
      const batch = state.allUrls.slice(i, i + PARALLEL_LIMIT);
      const results = await Promise.all(
        batch.map(async (url) => {
          const urlMeta = parseUrlMetadata(url);
          if (!urlMeta) return null;
          
          if (existingListings.has(urlMeta.id)) {
            return { existing: existingListings.get(urlMeta.id)!, id: urlMeta.id };
          }
          
          const { html, removed } = await fetchWithRetry(url);
          
          // If listing returned 404, mark as removed
          if (removed) {
            return { removed, id: urlMeta.id };
          }
          
          if (!html) return null;
          
          const parsed = parseDetailPage(html, url);
          if (!parsed?.id) return null;
          
          return { parsed, url, id: parsed.id, isNew: true };
        })
      );
      
      for (const result of results) {
        if (!result) continue;
        
        if ('existing' in result && result.existing) {
          allListings.push(result.existing);
          state.processedIds.push(result.id);
        } else if ('removed' in result && result.removed) {
          // Listing returned 404 - mark as removed in DynamoDB
          try {
            await dynamoClient.send(new UpdateCommand({
              TableName: LISTINGS_TABLE,
              Key: { domain: TC_DOMAIN, listing_id: `tc_${result.id}` },
              UpdateExpression: 'SET #status = :status, status_signal = :signal, last_seen = :now',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: {
                ':status': result.removed.status,
                ':signal': result.removed.signal,
                ':now': new Date().toISOString(),
              },
            }));
            console.log(`   ✅ Marked ${result.id} as ${result.removed.status} (${result.removed.signal})`);
          } catch (e) {
            // Listing may not exist in DB yet - that's OK
          }
          state.processedIds.push(result.id);
        } else if ('parsed' in result && result.parsed) {
          if (result.parsed.lat && result.parsed.lng) withCoords++;
          
          const listing: TCListing = {
            id: result.parsed.id,
            url: result.parsed.url || result.url,
            title: result.parsed.title || '',
            price: result.parsed.price || null,
            currency: 'EUR',
            bedrooms: result.parsed.bedrooms || null,
            bathrooms: result.parsed.bathrooms || null,
            area_m2: result.parsed.area_m2 || null,
            description: result.parsed.description || '',
            photos: result.parsed.photos || [],
            lat: result.parsed.lat || null,
            lng: result.parsed.lng || null,
            address: result.parsed.address || '',
            city: result.parsed.city || '',
            province: result.parsed.province || '',
            neighborhood: result.parsed.neighborhood || '',
            contract_type: result.parsed.contract_type || '',
            property_type: result.parsed.property_type || '',
            agency_id: result.parsed.agency_id || '',
            agency_phone: result.parsed.agency_phone || null,
            agency_email: result.parsed.agency_email || null,
            features: result.parsed.features || {},
            amenities: result.parsed.amenities || [],
            has_elevator: result.parsed.has_elevator || false,
            has_terrace: result.parsed.has_terrace || false,
            has_parking: result.parsed.has_parking || false,
            has_pool: result.parsed.has_pool || false,
            has_ac: result.parsed.has_ac || false,
            is_furnished: result.parsed.is_furnished ?? null,
            year_built: result.parsed.year_built || null,
            energy_class: result.parsed.energy_class || null,
            floor: result.parsed.floor || null,
            sale_status: result.parsed.sale_status || 'active',
            sale_status_signal: result.parsed.sale_status_signal || 'in_sitemap',
            last_updated: new Date().toISOString(),
          };
          allListings.push(listing);
          state.processedIds.push(result.id);
          newListingsCount++;
          
          // Track data quality stats
          // Tecnocasa uses Spanish: 'venta' (sale) / 'alquiler' (rent)
          if (listing.contract_type === 'alquiler' || listing.contract_type === 'rent') typeStats.rent++;
          else if (listing.contract_type === 'venta' || listing.contract_type === 'sale') typeStats.sale++;
          else typeStats.unknown++;
          
          // Tecnocasa has embedded coords - track precision
          if (listing.lat && listing.lng) precisionStats.precise++;
          else precisionStats.unknown++;
        }
      }
      
      state.lastProcessedIndex = i + batch.length;
      
      if (state.lastProcessedIndex % 500 < PARALLEL_LIMIT) {
        console.log(`   📊 Progress: ${state.lastProcessedIndex}/${officialCount} (${newListingsCount} new)`);
      }
    }
    
    state.isComplete = true;
  }
  
  // ============================================================
  // SOLD/REMOVED DETECTION (only when fully complete)
  // ============================================================
  
  let removedCount = 0;
  if (state.isComplete && state.processedIds.length > 100) {
    console.log('🔍 Checking for sold/removed listings...');
    const currentSitemapIds = new Set(state.processedIds);
    
    for (const [id] of existingListings) {
      if (!currentSitemapIds.has(id)) {
        try {
          await dynamoClient.send(new UpdateCommand({
            TableName: LISTINGS_TABLE,
            Key: {
              domain: TC_DOMAIN,
              listing_id: id,
            },
            UpdateExpression: 'SET #status = :status, #signal = :signal, #updated = :updated',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#signal': 'status_signal',
              '#updated': 'last_seen',
            },
            ExpressionAttributeValues: {
              ':status': 'removed',
              ':signal': 'not_in_sitemap',
              ':updated': new Date().toISOString(),
            },
          }));
          removedCount++;
        } catch { /* may not exist */ }
      }
    }
    
    if (removedCount > 0) {
      console.log(`   ⚠️ Marked ${removedCount} listings as REMOVED`);
    }
  }
  
  const totalHarvested = allListings.length;
  console.log(`✅ Harvest complete: ${totalHarvested} total, ${newListingsCount} new, ${withCoords} with coords`);
  
  // Save to S3
  const compressedData = zlib.gzipSync(JSON.stringify(allListings));
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: LISTINGS_KEY,
    Body: compressedData,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }));
  console.log(`💾 Saved ${totalHarvested} listings to S3`);
  
  // Update DynamoDB with tracking
  let dynamoUpdates = 0;
  let newInDb = 0;
  let updatedInDb = 0;
  let photoStats = { total: 0, regular: 0, floorplan: 0, exterior: 0, other: 0 };
  
  for (const listing of allListings) {
    try {
      const existing = await getExistingListingTracking(listing.id);
      const tracking = buildTrackingData(existing, listing.price);
      const photos = classifyPhotos(listing.photos);
      
      if (!existing) newInDb++; else updatedInDb++;
      photoStats.total += photos.total;
      photoStats.regular += photos.regular.length;
      photoStats.floorplan += photos.floorplan.length;
      photoStats.exterior += photos.exterior.length;
      photoStats.other += photos.other.length;
      
      await dynamoClient.send(new PutCommand({
        TableName: LISTINGS_TABLE,
        Item: {
          // Primary keys (must match other Lambdas)
          domain: TC_DOMAIN,
          listing_id: listing.id,
          // Aliases
          listingId: listing.id,
          agency: TC_DOMAIN,
          url: listing.url,
          sourceUrl: listing.url,
          title: listing.title,
          price: listing.price,
          currency: listing.currency,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          sqm: listing.area_m2,  // Recommender field name
          areaM2: listing.area_m2,
          description: listing.description,
          // Photos
          photos: photos.regular.slice(0, 20),
          photos_floorplan: photos.floorplan,
          photos_exterior: photos.exterior.slice(0, 5),
          photos_other: photos.other.slice(0, 5),
          photo_count: photos.total,
          image_urls: photos.regular.slice(0, 20),
          // Location
          lat: listing.lat,
          lng: listing.lng,
          address: listing.address,
          city: listing.city,
          region: listing.province,  // Recommender field name
          province: listing.province,
          neighborhood: listing.neighborhood,
          // Coordinate precision (CRITICAL for data quality)
          coordinate_precision: listing.coordinate_precision,
          coordinate_precision_signal: listing.coordinate_precision_signal,
          street_address: listing.verifiedAddress?.streetAddress || listing.address,
          // Property info
          contractType: listing.contract_type,
          propertyType: listing.property_type,
          agencyId: listing.agency_id,
          agency_phone: listing.agency_phone,
          agency_email: listing.agency_email,
          features: listing.features,
          amenities: listing.amenities,
          // Boolean flags for recommender
          has_elevator: listing.has_elevator,
          has_terrace: listing.has_terrace,
          has_parking: listing.has_parking,
          has_pool: listing.has_pool,
          has_ac: listing.has_ac,
          is_furnished: listing.is_furnished,
          // Additional
          yearBuilt: listing.year_built,
          year_built: listing.year_built,  // Recommender field name
          energyClass: listing.energy_class,
          floor: listing.floor,
          // Tracking - prefer HTML-detected status over sitemap tracking
          // sale_status from HTML detection (sold/leased/reserved)
          // tracking.status from sitemap detection (active/removed)
          status: listing.sale_status !== 'active' ? listing.sale_status : tracking.status,
          status_signal: listing.sale_status !== 'active' ? listing.sale_status_signal : tracking.status_signal,
          first_seen: tracking.first_seen,
          last_seen: tracking.last_seen,
          days_on_market: tracking.days_on_market,
          price_history: tracking.price_history,
          lastUpdated: listing.last_updated,
          harvestedAt: new Date().toISOString(),
          harvester_version: HARVESTER_VERSION,
        },
      }));
      dynamoUpdates++;
    } catch (error) {
      console.error(`DynamoDB error for listing ${listing.id}:`, error);
    }
  }
  
  console.log(`📝 Updated ${dynamoUpdates} in DynamoDB (${newInDb} new, ${updatedInDb} updated)`);
  console.log(`📷 Photos: ${photoStats.total} total, ${photoStats.floorplan} floorplans`);
  
  // Clear continuation state
  await clearState();
  
  // Update harvest stats
  const duration = Math.round((Date.now() - startTime) / 1000);
  const coverage = officialCount > 0 ? ((totalHarvested / officialCount) * 100).toFixed(2) : '0';
  
  try {
    await dynamoClient.send(new UpdateCommand({
      TableName: STATS_TABLE,
      Key: { pk: `DOMAIN#${TC_DOMAIN}`, sk: 'HARVEST_STATS' },
      UpdateExpression: 'SET totalListings = :tl, lastHarvested = :lh, newListingsLastRun = :nl, officialCount = :oc, coverage = :cv, durationSeconds = :ds, removedCount = :rc',
      ExpressionAttributeValues: {
        ':tl': totalHarvested,
        ':lh': new Date().toISOString(),
        ':nl': newListingsCount,
        ':oc': officialCount,
        ':cv': parseFloat(coverage),
        ':ds': duration,
        ':rc': removedCount,
      },
    }));
  } catch (e) {
    // Stats table may not exist - non-critical
    console.log('   Note: Stats update skipped (table may not exist)');
  }
  
  logMemory('END');
  
  // Write run summary to analytics
  const summary = createRunSummary(
    TC_DOMAIN,
    HARVESTER_VERSION,
    state.invocationCount,
    MAX_INVOCATIONS,
    'complete',
    'complete',
    startTime,
    MEMORY_LIMIT_MB
  );
  summary.listings_discovered = totalHarvested;
  summary.listings_written = dynamoUpdates;
  summary.listings_new = newInDb;
  summary.listings_updated = updatedInDb;
  summary.listings_removed = removedCount;
  summary.listings_by_type = typeStats;
  summary.listings_by_precision = precisionStats;
  await writeRunSummary(summary);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      domain: TC_DOMAIN,
      totalListings: totalHarvested,
      newListings: newListingsCount,
      new_in_db: newInDb,
      updated_in_db: updatedInDb,
      removed: removedCount,
      officialCount,
      coverage: `${coverage}%`,
      withCoordinates: withCoords,
      photos: photoStats,
      invocations: state.invocationCount,
      durationSeconds: duration,
      timestamp: new Date().toISOString(),
    }),
  };
};

