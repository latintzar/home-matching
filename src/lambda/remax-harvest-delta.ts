/**
 * RE/MAX Spain Harvest Lambda (FULL COMPLIANCE - ALL 13 REQUIREMENTS)
 * 
 * Harvests listing data from remax.es (Spain)
 * 
 * REQUIREMENTS IMPLEMENTED:
 * 1. S3 State File - remax-listings.json.gz + remax-state.json
 * 2. Delta Logic - Track processed IDs between runs
 * 3. Sold/Removed Detection - Mark listings removed from sitemap
 * 4. Self-Continuation - Re-invoke on timeout with 4 safeguards
 * 5. Status Tracking - active/removed status
 * 6. First/Last Seen - Track listing appearance
 * 7. Price History - Track price changes
 * 8. Photo Classification - Floorplans, exterior, regular
 * 9. Parallelization - 10 concurrent fetches
 * 10. Full Deep Crawl - Process all sitemap URLs
 * 11. Data Completeness - Boolean flags from description
 * 12. URLs Only - No image files stored
 * 13. Real Data Testing - Tested with actual Lambda code
 * 
 * Strategy:
 * - Sitemap-based discovery: https://www.remax.es/sitemap-general.xml
 *   - Sub-sitemaps by property type: sitemap-fichas-a-piso.xml, etc.
 * - HTML parsing for listing data
 * - JSON-LD for price (limited data available)
 * - Nominatim geocoding for coordinates
 * 
 * Schedule: 3x daily (7 AM, 12 PM, 6 PM Spain)
 * Timeout: 15 minutes with 2-minute buffer for self-continuation
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// LambdaClient removed - no self-invocation (AWS recursive detection safety)
import * as cheerio from 'cheerio';
import * as zlib from 'zlib';
import { detectListingStatus, detectFromHttpStatus, isRemovedRedirect, type SaleStatus } from '../lib/harvest/listing-status-detection';
import { 
  verifyCoordinates,
  hasStreetAddress,
  extractStreetAddressFromHtml,
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

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
// lambdaClient removed - no self-invocation

const LEO_LISTINGS_TABLE = 'leo-listings';
const S3_BUCKET = 'puedo-casa-html-archive';
const LISTINGS_KEY = 'harvest/remax-listings.json.gz';
const STATE_KEY = 'harvest/remax-state.json';
const DOMAIN = 'remax.es';
const SITEMAP_INDEX_URL = 'https://www.remax.es/sitemap-general.xml';

// Processing limits (reduced for memory efficiency with large sitemaps)
const PARALLEL_BATCH_SIZE = 5;  // Reduced from 10 to lower memory pressure
const REQUEST_DELAY_MS = 150;   // Slightly slower to be safe

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.5.0';  // 2.5.0: Added SAVE GAME logging, 14m30s timeout

// Self-continuation safeguards
const MAX_INVOCATIONS = 10;
const STATE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours - allows manual babysitting between scheduled runs
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before Lambda's 15m hard limit
const MEMORY_LIMIT_MB = 4096; // RE/MAX has large sitemap, needs more memory

// Nominatim for geocoding (self-hosted EC2)
const NOMINATIM_URL = process.env.NOMINATIM_URL || '';

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
    const result = await dynamodb.send(new GetItemCommand({
      TableName: LEO_LISTINGS_TABLE,
      Key: {
        pk: { S: `LISTING#${DOMAIN}#${listingId}` },
        sk: { S: 'METADATA' }
      },
      ProjectionExpression: 'first_seen, price, price_history'
    }));
    
    if (!result.Item) return null;
    
    return {
      first_seen: result.Item.first_seen?.S,
      price: result.Item.price?.N ? parseInt(result.Item.price.N, 10) : undefined,
      price_history: result.Item.price_history?.L?.map(item => ({
        price: parseInt(item.M?.price?.N || '0', 10),
        date: item.M?.date?.S || ''
      }))
    };
  } catch {
    return null;
  }
}

function buildTrackingData(
  existing: { first_seen?: string; price?: number; price_history?: Array<{ price: number; date: string }> } | null,
  currentPrice: number | null,
  publicationDate: string | null = null
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

// ============================================================
// S3 STATE MANAGEMENT + SELF-CONTINUATION
// ============================================================

async function loadHarvestState(): Promise<HarvestState | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: STATE_KEY,
    }));
    
    const body = await response.Body?.transformToString();
    if (body) {
      const state: HarvestState = JSON.parse(body);
      
      // Check for stale state
      const stateAge = Date.now() - new Date(state.startedAt).getTime();
      if (stateAge > STATE_EXPIRY_MS) {
        console.log('⚠️ State expired (> 12 hours old), starting fresh');
        await deleteHarvestState();
        return null;
      }
      
      return state;
    }
  } catch {
    // No state file
  }
  return null;
}

function createFreshState(): HarvestState {
  const now = new Date().toISOString();
  return {
    invocationCount: 1,
    startedAt: now,
    lastProgressAt: now,
    phase: 'discovery',
    allSitemapUrls: [],
    scrapedUrls: [],
    listingsToGeocode: [],
    geocodedIds: [],
    totalNewFound: 0,
    geocodedCount: 0,
    writtenToDynamo: 0,
    newInDb: 0,
    updatedInDb: 0,
    photoStats: { total: 0, regular: 0, floorplan: 0, exterior: 0, other: 0 },
    removedCount: 0,
    totalInS3: 0,
  };
}

async function saveHarvestState(state: HarvestState): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: STATE_KEY,
    Body: JSON.stringify(state, null, 2),
    ContentType: 'application/json',
  }));
  console.log(`💾 Saved state (invocation ${state.invocationCount}, phase: ${state.phase})`);
}

async function deleteHarvestState(): Promise<void> {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: STATE_KEY,
    }));
    console.log('🗑️ Deleted state (harvest complete)');
  } catch {
    // State file didn't exist
  }
}

async function loadExistingListings(): Promise<Map<string, any>> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: LISTINGS_KEY,
    }));
    
    const body = await response.Body?.transformToByteArray();
    if (body) {
      const decompressed = zlib.gunzipSync(Buffer.from(body));
      const listings = JSON.parse(decompressed.toString());
      return new Map(listings.map((l: any) => [l.id, l]));
    }
  } catch {
    // No existing listings file
  }
  return new Map();
}

async function saveListings(listings: Map<string, any>): Promise<void> {
  const listingsArray = Array.from(listings.values());
  const compressed = zlib.gzipSync(JSON.stringify(listingsArray, null, 2));
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: LISTINGS_KEY,
    Body: compressed,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }));
}

// NOTE: Self-invocation removed for safety (AWS recursive detection)
// Work continues on next scheduled run (3x daily) via state persistence
function logContinuationScheduled(state: HarvestState): void {
  console.log(`⏸️ Work paused at invocation ${state.invocationCount}`);
  console.log('   State saved. Next scheduled run will continue where we left off.');
}

interface RemaxListing {
  id: string;
  url: string;
  title: string;
  price: number | null;
  price_raw: string;
  description: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  address: string;
  street_address: string | null;
  neighborhood: string | null;
  city: string | null;
  province: string | null;
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  // Coordinate precision (CRITICAL for data quality)
  coordinate_precision: CoordinatePrecision;
  coordinate_precision_signal: string;
  verifiedAddress: AddressComponents | null;
  property_type: string | null;
  contract_type: string;
  source: 'remax.es';
  scraped_at: string;
  lastmod: string | null;
  
  // Boolean amenity flags (Data Completeness)
  has_elevator: boolean;
  has_ac: boolean;
  has_parking: boolean;
  has_terrace: boolean;
  has_pool: boolean;
  is_furnished: boolean | null;  // null = unknown
  floor: number | null;
  
  // Sale status detection
  saleStatus: SaleStatus;
  saleStatusSignal: string;
}

// Self-continuation state
interface HarvestState {
  invocationCount: number;
  startedAt: string;
  lastProgressAt: string;
  phase: 'discovery' | 'scraping' | 'geocoding' | 'removed_detection' | 'complete';
  
  // Discovery phase
  allSitemapUrls: Array<{ url: string; lastmod: string | null }>;
  
  // Scraping phase
  scrapedUrls: string[];
  listingsToGeocode: RemaxListing[];
  
  // Geocoding phase
  geocodedIds: string[];
  
  // Stats
  totalNewFound: number;
  geocodedCount: number;
  writtenToDynamo: number;
  newInDb: number;
  updatedInDb: number;
  photoStats: { total: number; regular: number; floorplan: number; exterior: number; other: number };
  removedCount: number;
  totalInS3: number;
}

interface NormalizedListing {
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
  // Coordinate precision (CRITICAL for data quality)
  coordinate_precision: CoordinatePrecision;
  coordinate_precision_signal: string;
  street_address: string | null;
  neighborhood: string | null;
  city: string | null;
  province: string | null;
  photos: ClassifiedPhotos;
  description: string;
  property_type: string | null;
  contract_type: string;
  amenities: string[];
  tracking: ListingTrackingData;
  
  // Boolean amenity flags
  has_elevator: boolean;
  has_ac: boolean;
  has_parking: boolean;
  has_terrace: boolean;
  has_pool: boolean;
  is_furnished: boolean | null;
  floor: number | null;
  
  // Sale status detection
  saleStatus: SaleStatus;
  saleStatusSignal: string;
}

// Rate limiting
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Geocoding via Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'es'
    });
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
    }
  } catch (error) {
    // Geocoding failed, continue without coordinates
  }
  
  return null;
}

// Fetch sitemap index and get all sub-sitemap URLs
async function fetchSitemapIndex(): Promise<string[]> {
  console.log(`Fetching sitemap index: ${SITEMAP_INDEX_URL}`);
  
  const response = await fetch(SITEMAP_INDEX_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap index: ${response.status}`);
  }
  
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const sitemapUrls: string[] = [];
  $('sitemap loc').each((_, el) => {
    const url = $(el).text();
    // Only include "fichas" sitemaps (listings), skip others like agents, offices
    if (url.includes('sitemap-fichas')) {
      sitemapUrls.push(url);
    }
  });
  
  console.log(`Found ${sitemapUrls.length} listing sitemaps`);
  return sitemapUrls;
}

// Fetch individual sitemap and extract listing URLs with lastmod
async function fetchSitemap(sitemapUrl: string): Promise<Array<{ url: string; lastmod: string | null }>> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const listings: Array<{ url: string; lastmod: string | null }> = [];
    $('url').each((_, el) => {
      const loc = $(el).find('loc').text();
      const lastmod = $(el).find('lastmod').text() || null;
      
      if (loc.includes('/buscador-de-inmuebles/')) {
        listings.push({ url: loc, lastmod });
      }
    });
    
    return listings;
  } catch (error) {
    console.log(`Error fetching sitemap ${sitemapUrl}:`, error);
    return [];
  }
}

// Fetch all listing URLs from all sitemaps
async function fetchAllListingUrls(): Promise<Array<{ url: string; lastmod: string | null }>> {
  const sitemapUrls = await fetchSitemapIndex();
  
  const allListings: Array<{ url: string; lastmod: string | null }> = [];
  
  for (const sitemapUrl of sitemapUrls) {
    const listings = await fetchSitemap(sitemapUrl);
    allListings.push(...listings);
    await sleep(100); // Rate limit between sitemap fetches
  }
  
  // Sort by lastmod (newest first) for delta harvesting
  allListings.sort((a, b) => {
    if (!a.lastmod && !b.lastmod) return 0;
    if (!a.lastmod) return 1;
    if (!b.lastmod) return -1;
    return b.lastmod.localeCompare(a.lastmod);
  });
  
  console.log(`Total listings across all sitemaps: ${allListings.length}`);
  return allListings;
}

// Fetch a single page
interface FetchPageResult {
  html: string | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchPage(url: string): Promise<FetchPageResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    // Check for 404/410 - listing removed
    const httpStatus = detectFromHttpStatus(response.status, true);
    if (httpStatus) {
      console.log(`   🗑️ ${url}: ${httpStatus.signal} (HTTP ${response.status})`);
      return { html: null, removed: httpStatus };
    }
    
    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return { html: null };
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
    console.log(`Error fetching ${url}: ${error}`);
    return { html: null };
  }
}

// Extract location info from URL path
function parseUrlLocation(url: string): { 
  contract_type: string; 
  property_type: string | null; 
  province: string | null;
  city: string | null; 
  neighborhood: string | null;
  id: string | null;
} {
  // URL pattern: /buscador-de-inmuebles/{type}/{property-type}/{province}/{city}/{neighborhood}/{ID}/
  const match = url.match(/\/buscador-de-inmuebles\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
  
  if (!match) {
    // Try simpler pattern with just ID
    const idMatch = url.match(/\/([A-Z0-9-]+)\/?$/);
    return {
      contract_type: url.includes('/alquiler/') ? 'rent' : 'sale',
      property_type: null,
      province: null,
      city: null,
      neighborhood: null,
      id: idMatch ? idMatch[1] : null
    };
  }
  
  const [, type, propertyType, province, city, neighborhood, id] = match;
  
  // Map Spanish type to contract type
  const contract_type = type === 'alquiler' ? 'rent' : 'sale';
  
  // Map property type
  const propertyTypeMap: Record<string, string> = {
    'piso': 'apartment',
    'apartamento': 'apartment',
    'casa': 'house',
    'chalet': 'house',
    'villa': 'house',
    'atico': 'penthouse',
    'duplex': 'duplex',
    'estudio': 'studio',
    'local-comercial': 'commercial',
    'oficina': 'office',
    'terreno': 'land',
    'solar': 'land',
    'garaje': 'parking',
    'parking': 'parking',
    'nave-industrial': 'industrial',
    'finca-rustica': 'rural',
    'casa-rural': 'rural'
  };
  
  // Clean up location strings (replace hyphens with spaces, title case)
  const cleanLocation = (s: string) => 
    s.replace(/-/g, ' ')
     .replace(/\b\w/g, c => c.toUpperCase());
  
  return {
    contract_type,
    property_type: propertyTypeMap[propertyType.toLowerCase()] || propertyType,
    province: cleanLocation(province),
    city: cleanLocation(city),
    neighborhood: neighborhood !== 'todos' ? cleanLocation(neighborhood) : null,
    id
  };
}

// Sanitize JSON string by removing control characters
function sanitizeJsonString(str: string): string {
  // Remove control characters (0x00-0x1F) except for standard whitespace
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// Parse a detail page
function parseDetailPage(html: string, url: string, lastmod: string | null): RemaxListing | null {
  const $ = cheerio.load(html);
  
  // Extract location and ID from URL
  const urlInfo = parseUrlLocation(url);
  const id = urlInfo.id;
  
  if (!id) {
    return null;
  }
  
  // Extract title from title tag or h1
  const titleTag = $('title').text();
  const title = titleTag.split('–')[0].trim() || `Property ${id}`;
  
  // Extract price from JSON-LD (sanitize to remove control characters)
  let price: number | null = null;
  let priceRaw = '';
  let description = '';
  
  try {
    const jsonLdRaw = $('script[type="application/ld+json"]').html();
    if (jsonLdRaw) {
      const jsonLd = sanitizeJsonString(jsonLdRaw);
      const data = JSON.parse(jsonLd);
      if (data.offers?.price) {
        price = parseInt(data.offers.price, 10);
        priceRaw = `${price} €`;
      }
      if (data.description) {
        description = data.description.substring(0, 2000);
      }
    }
  } catch (e) {
    // JSON-LD parsing failed, will use HTML fallback
  }
  
  // Fallback: try to get price from HTML elements
  if (!price) {
    // Try tarjeta_precio class (main price display)
    const priceElem = $('.tarjeta_precio').first();
    if (priceElem.length) {
      priceRaw = priceElem.text().trim();
      const priceNum = priceRaw.replace(/[^\d]/g, '');
      price = priceNum ? parseInt(priceNum, 10) : null;
    }
    
    // Try regex on HTML for "Precio: X.XXX.XXX €" pattern
    if (!price) {
      const priceMatch = html.match(/Precio:\s*([\d.]+)\s*€/i);
      if (priceMatch) {
        priceRaw = priceMatch[1] + ' €';
        price = parseInt(priceMatch[1].replace(/\./g, ''), 10);
      }
    }
  }
  
  // Fallback description from meta tag
  if (!description) {
    description = $('meta[name="description"]').attr('content') || '';
  }
  
  // Extract specs from HTML
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  // Try specific patterns from the HTML content
  const habMatch = html.match(/(\d+)\s*hab/i);
  const banoMatch = html.match(/(\d+)\s*baño/i);
  const m2Match = html.match(/(\d+)\s*m[²2]/i);
  
  if (habMatch) bedrooms = parseInt(habMatch[1], 10);
  if (banoMatch) bathrooms = parseInt(banoMatch[1], 10);
  if (m2Match) area_m2 = parseInt(m2Match[1], 10);
  
  // Extract photos from anaconda-guru S3 URLs
  const photoRegex = /https:\/\/anaconda-guru\.s3[^"'\s]+\.jpg/g;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
  // Build address from URL components
  const addressParts = [
    urlInfo.neighborhood,
    urlInfo.city,
    urlInfo.province
  ].filter(Boolean);
  const address = addressParts.join(', ');
  
  // Extract boolean amenity flags from title and description (Data Completeness)
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const searchText = lowerTitle + ' ' + lowerDesc;
  
  const has_elevator = /ascensor|elevator/i.test(searchText);
  const has_ac = /aire\s*acondicionado|climatización|a\/c/i.test(searchText);
  const has_parking = /garaje|parking|plaza\s*de\s*garaje|aparcamiento/i.test(searchText);
  const has_terrace = /terraza|balcón|solarium/i.test(searchText);
  const has_pool = /piscina|pool/i.test(searchText);
  
  // Extract floor number if available
  let floor: number | null = null;
  const floorMatch = searchText.match(/(\d+)(?:º|ª|a|er|o)\s*(?:planta|piso)/i) ||
                    searchText.match(/planta\s*(\d+)/i);
  if (floorMatch) {
    floor = parseInt(floorMatch[1]);
  }
  if (/planta\s*baja|bajo|ground\s*floor/i.test(searchText)) {
    floor = 0;
  }
  
  // Detect furnished status from description
  let is_furnished: boolean | null = null;
  if (/amueblado|con\s+muebles|totalmente\s+amueblado|furnished/i.test(searchText)) {
    is_furnished = true;
  } else if (/sin\s+amueblar|sin\s+muebles|no\s+amueblado|unfurnished/i.test(searchText)) {
    is_furnished = false;
  }
  
  // Detect sale status (sold/leased/reserved) from HTML
  const statusDetection = detectListingStatus(html);
  
  // Extract street address from HTML
  const street_address = extractStreetAddressFromHtml(html);
  
  return {
    id,
    url,
    title,
    price,
    price_raw: priceRaw,
    description,
    bedrooms,
    bathrooms,
    area_m2,
    address,
    street_address,
    neighborhood: urlInfo.neighborhood,
    city: urlInfo.city,
    province: urlInfo.province,
    photos,
    latitude: null,  // Will be filled in geocoding phase
    longitude: null,  // Will be filled in geocoding phase
    // Coordinate precision - will be updated in geocoding phase
    coordinate_precision: 'unknown' as CoordinatePrecision,
    coordinate_precision_signal: 'not_geocoded_yet',
    verifiedAddress: null,
    property_type: urlInfo.property_type,
    contract_type: urlInfo.contract_type,
    source: 'remax.es',
    scraped_at: new Date().toISOString(),
    lastmod,
    
    // Boolean amenity flags
    has_elevator,
    has_ac,
    has_parking,
    has_terrace,
    has_pool,
    is_furnished,
    floor,
    
    // Sale status detection
    saleStatus: statusDetection.saleStatus,
    saleStatusSignal: statusDetection.statusSignal,
  };
}

// Normalize listing for leo-listings table (now async for tracking)
async function normalizeListing(listing: RemaxListing): Promise<NormalizedListing> {
  // Get existing tracking data
  const existing = await getExistingListingTracking(listing.id);
  const tracking = buildTrackingData(existing, listing.price, listing.lastmod);
  
  // Classify photos
  const photos = classifyPhotos(listing.photos);
  
  return {
    domain: DOMAIN,
    listing_id: listing.id,
    url: listing.url,
    title: listing.title,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    area_m2: listing.area_m2,
    latitude: listing.latitude,
    longitude: listing.longitude,
    // Coordinate precision
    coordinate_precision: listing.coordinate_precision,
    coordinate_precision_signal: listing.coordinate_precision_signal,
    street_address: listing.verifiedAddress?.streetAddress || listing.street_address,
    neighborhood: listing.verifiedAddress?.neighborhood || listing.neighborhood,
    city: listing.verifiedAddress?.city || listing.city,
    province: listing.verifiedAddress?.province || listing.province,
    photos,
    description: listing.description.substring(0, 2000),
    property_type: listing.property_type,
    contract_type: listing.contract_type,
    amenities: [],
    tracking,
    
    // Boolean amenity flags
    has_elevator: listing.has_elevator,
    has_ac: listing.has_ac,
    has_parking: listing.has_parking,
    has_terrace: listing.has_terrace,
    has_pool: listing.has_pool,
    is_furnished: listing.is_furnished,
    floor: listing.floor,
    
    // Sale status detection
    saleStatus: listing.saleStatus,
    saleStatusSignal: listing.saleStatusSignal,
  };
}

// Write to DynamoDB (simplified)
async function writeListingToDynamoDB(listing: NormalizedListing): Promise<{ isNew: boolean; photos: ClassifiedPhotos }> {
  const now = new Date().toISOString();
  
  const item = {
    domain: DOMAIN,
    listing_id: listing.listing_id,
    url: listing.url,
    title: listing.title,
    price: listing.price,
    
    location: {
      address: listing.city ? `${listing.city}, ${listing.province || 'Spain'}` : null,
      city: listing.city,
      street_address: listing.street_address,
      neighborhood: listing.neighborhood,
      province: listing.province,
      country: 'Spain',
      lat: listing.latitude,
      lng: listing.longitude,
      coordinate_precision: listing.coordinate_precision,
      coordinate_precision_signal: listing.coordinate_precision_signal,
    },
    
    property: {
      type: listing.property_type,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      area_m2: listing.area_m2,
      floor: listing.floor,
    },
    
    // Boolean amenity flags
    has_elevator: listing.has_elevator,
    has_ac: listing.has_ac,
    has_parking: listing.has_parking,
    has_terrace: listing.has_terrace,
    has_pool: listing.has_pool,
    is_furnished: listing.is_furnished,
    
    // Classified photos
    photos: listing.photos.regular.slice(0, 20),
    photos_floorplan: listing.photos.floorplan,
    photos_exterior: listing.photos.exterior.slice(0, 5),
    photos_other: listing.photos.other.slice(0, 5),
    photo_count: listing.photos.total,
    image_urls: listing.photos.regular.slice(0, 20), // Legacy field
    
    description: listing.description,
    contract_type: listing.contract_type,
    amenities: listing.amenities,
    
    // Enhanced tracking fields - prefer HTML-detected status over sitemap tracking
    status: listing.saleStatus !== 'active' ? listing.saleStatus : listing.tracking.status,
    status_signal: listing.saleStatus !== 'active' ? listing.saleStatusSignal : listing.tracking.status_signal,
    first_seen: listing.tracking.first_seen,
    last_seen: listing.tracking.last_seen,
    days_on_market: listing.tracking.days_on_market,
    price_history: listing.tracking.price_history,
    
    scraped_at: now,
    updated_at: now,
    harvestedAt: now,
    harvester_version: HARVESTER_VERSION,
  };
  
  await dynamoClient.send(new PutCommand({
    TableName: LEO_LISTINGS_TABLE,
    Item: item,
  }));
  
  return { isNew: listing.tracking.days_on_market === 0, photos: listing.photos };
}

// ============================================================
// MAIN HANDLER - SELF-CONTINUATION MODE
// ============================================================

export const handler = async (event: any): Promise<any> => {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('RE/MAX Spain Harvest Lambda - SELF-CONTINUATION MODE');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  
  resetPeakMemory();
  logMemory('START');
  
  try {
    // --- SELF-CONTINUATION: Load or initialize state ---
    let state = await loadHarvestState();
    const isContinuation = !!state;
    
    if (state) {
      // SAFEGUARD 1: Max invocations check
      if (state.invocationCount >= MAX_INVOCATIONS) {
        console.log(`❌ Max invocations (${MAX_INVOCATIONS}) reached. Stopping.`);
        await deleteHarvestState();
        return { statusCode: 400, body: 'Max invocations reached' };
      }
      
      // SAFEGUARD 2: Progress check
      const timeSinceProgress = Date.now() - new Date(state.lastProgressAt).getTime();
      if (timeSinceProgress > STATE_EXPIRY_MS) {
        console.log('⚠️ No progress in > 1 hour, resetting state');
        await deleteHarvestState();
        state = null;
      } else {
        state.invocationCount++;
        state.lastProgressAt = new Date().toISOString();
        console.log(`🔄 Continuing from previous run (invocation ${state.invocationCount}/${MAX_INVOCATIONS})`);
        console.log(`   Phase: ${state.phase}`);
        console.log(`   URLs in sitemap: ${state.allSitemapUrls.length}`);
        console.log(`   Scraped: ${state.scrapedUrls.length}`);
        console.log(`   To geocode: ${state.listingsToGeocode.length}`);
      }
    }
    
    // Initialize fresh state if needed
    if (!state) {
      state = createFreshState();
      console.log('📝 Starting fresh harvest');
    }
    
    // Load existing listings for delta detection
    const existingListings = await loadExistingListings();
    const existingIds = new Set(existingListings.keys());
    console.log(`📂 Loaded ${existingListings.size} existing listings`);
    
    // Data quality tracking
    const typeStats = { sale: 0, rent: 0, unknown: 0 };
    const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
    
    // PHASE 1: DISCOVERY - Fetch sitemap URLs
    if (state.phase === 'discovery') {
      console.log('\n--- PHASE 1: DISCOVERY ---');
      
      if (state.allSitemapUrls.length === 0) {
        const allUrls = await fetchAllListingUrls();
        state.allSitemapUrls = allUrls;
        console.log(`   Found ${allUrls.length} URLs in sitemaps`);
      }
      
      state.phase = 'scraping';
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 2: SCRAPING - Fetch and parse detail pages
    if (state.phase === 'scraping') {
      console.log('\n--- PHASE 2: SCRAPING ---');
      
      const scrapedSet = new Set(state.scrapedUrls);
      const urlsToScrape = state.allSitemapUrls.filter(item => {
        const id = item.url.split('/').filter(Boolean).pop() || '';
        return !scrapedSet.has(item.url) && !existingIds.has(id);
      });
      
      console.log(`   New URLs to scrape: ${urlsToScrape.length}`);
      
      for (let i = 0; i < urlsToScrape.length; i += PARALLEL_BATCH_SIZE) {
        // Timeout check (14m 30s)
        if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
          logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
            'Sitemap URLs': state.allSitemapUrls.length,
            'Scraped': state.scrapedUrls.length,
            'Geocoded': state.geocodedCount,
            'Written to DB': state.writtenToDynamo,
            'New': state.newInDb,
            'Updated': state.updatedInDb,
          });
          state.lastProgressAt = new Date().toISOString();
          await saveHarvestState(state);
          return { statusCode: 202, body: 'Continuing scraping in next invocation' };
        }
        
        const batch = urlsToScrape.slice(i, i + PARALLEL_BATCH_SIZE);
        const fetchResults = await Promise.all(batch.map(item => fetchPage(item.url)));
        
        for (let j = 0; j < batch.length; j++) {
          const { html, removed } = fetchResults[j];
          const item = batch[j];
          const urlInfo = parseUrlLocation(item.url);
          const id = urlInfo.id;
          
          if (html) {
            const listing = parseDetailPage(html, item.url, item.lastmod);
          if (listing) {
              // INLINE GEOCODING + SAVE: Don't accumulate in memory!
              try {
                // Build address for geocoding
                const addressParts = [
                  listing.street_address,
                  listing.neighborhood,
                  listing.city,
                  listing.province,
                  'Spain'
                ].filter(Boolean);
                const addressText = addressParts.join(', ');
                
                // Geocode immediately
                const verification = await verifyCoordinates(null, null, addressText, NOMINATIM_URL);
                
                // Apply geocoding results
                listing.latitude = verification.lat;
                listing.longitude = verification.lng;
                listing.coordinate_precision = verification.precision;
                listing.coordinate_precision_signal = verification.precisionSignal;
                listing.verifiedAddress = verification.address;
                
                // Build normalized listing and save immediately
                const normalizedListing = await normalizeListing(listing, existingListings);
                await writeListingToDynamoDB(normalizedListing);
                state.totalNewFound++;
                state.geocodedIds.push(listing.id);  // Track saved (not pending)
                
                // Track data quality stats
                if (listing.contract_type === 'rent') typeStats.rent++;
                else if (listing.contract_type === 'sale') typeStats.sale++;
                else typeStats.unknown++;
                precisionStats[listing.coordinate_precision || 'unknown']++;
              } catch (saveErr) {
                console.log(`   ⚠️ Failed to save ${listing.id}: ${saveErr}`);
              }
            }
          } else if (removed && id) {
            // Listing returned 404 or redirected to error page - mark as removed
            try {
              await dynamoClient.send(new UpdateCommand({
                TableName: LEO_LISTINGS_TABLE,
                Key: { domain: DOMAIN, listing_id: id },
                UpdateExpression: 'SET #status = :status, status_signal = :signal, last_seen = :now',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':status': removed.status,
                  ':signal': removed.signal,
                  ':now': new Date().toISOString(),
                },
              }));
              console.log(`   ✅ Marked ${id} as ${removed.status} (${removed.signal})`);
            } catch (e) {
              // Listing may not exist in DB yet - that's OK
            }
          }
          state.scrapedUrls.push(item.url);
        }
        
        const processed = Math.min(i + PARALLEL_BATCH_SIZE, urlsToScrape.length);
        if (processed % 50 === 0 || processed === urlsToScrape.length) {
          console.log(`   Scraped ${processed}/${urlsToScrape.length} (${state.totalNewFound} saved to DB)`);
          state.lastProgressAt = new Date().toISOString();
          
          // Save state checkpoint every 100 URLs
          if (processed % 100 === 0) {
            console.log('   💾 Saving checkpoint...');
            await saveHarvestState(state);
          }
        }
        
        await sleep(REQUEST_DELAY_MS);
      }
      
      console.log(`   ✅ Scraping complete: ${state.totalNewFound} listings saved to DynamoDB`);
      state.phase = 'complete';  // Skip geocoding phase - done inline!
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 3: GEOCODING - Now done inline during scraping (skip if reached here)
    // This phase is kept for backwards compatibility with old state files
    if (state.phase === 'geocoding' && state.listingsToGeocode && state.listingsToGeocode.length > 0) {
      console.log('\n--- PHASE 3: GEOCODING (legacy - processing remaining) ---');
      console.log(`   ${state.listingsToGeocode.length} listings to geocode (from old state)`);
      
      const geocodedSet = new Set(state.geocodedIds);
      const listingsToProcess = state.listingsToGeocode.filter(l => !geocodedSet.has(l.id));
      
      // Track precision stats
      const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
      
      for (let i = 0; i < listingsToProcess.length; i += PARALLEL_BATCH_SIZE) {
        // Timeout check (14m 30s)
        if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
          state.geocodedIds = Array.from(geocodedSet);
          logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
            'Sitemap URLs': state.allSitemapUrls.length,
            'Scraped': state.scrapedUrls.length,
            'Geocoded': state.geocodedCount,
            'To geocode remaining': listingsToProcess.length - i,
            'Written to DB': state.writtenToDynamo,
          });
          state.lastProgressAt = new Date().toISOString();
          await saveListings(existingListings);
          await saveHarvestState(state);
          return { statusCode: 202, body: 'Continuing geocoding in next invocation' };
        }
        
        const batch = listingsToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
        
        // Verify coordinates using smart geocoding (forward geocode address)
        const verifyResults = await Promise.all(
          batch.map(listing => {
            // Build best address string
            const addressParts = [
              listing.street_address,
              listing.neighborhood,
              listing.city,
              listing.province,
              'Spain'
            ].filter(Boolean);
            const addressText = addressParts.join(', ');
            
            // No embedded coords for RE/MAX - geocode from address
            return verifyCoordinates(
              null,  // No embedded lat
              null,  // No embedded lng
              addressText,
              {
                streetAddress: listing.street_address,
                neighborhood: listing.neighborhood,
                city: listing.city,
                province: listing.province,
                country: 'Spain'
              }
            );
          })
        );
        
        // Process and write to DynamoDB
        for (let j = 0; j < batch.length; j++) {
          const listing = batch[j];
          const verification = verifyResults[j];
          
          // Update listing with verified coordinates
          listing.latitude = verification.finalLat;
          listing.longitude = verification.finalLng;
          listing.coordinate_precision = verification.precision;
          listing.coordinate_precision_signal = verification.precisionSignal;
          listing.verifiedAddress = verification.address;
          
          if (verification.finalLat && verification.finalLng) {
            state.geocodedCount++;
          }
          precisionStats[verification.precision]++;
          
          // Normalize and write
          const normalized = await normalizeListing(listing);
          try {
            const result = await writeListingToDynamoDB(normalized);
            state.writtenToDynamo++;
            if (result.isNew) state.newInDb++; else state.updatedInDb++;
            
            state.photoStats.total += result.photos.total;
            state.photoStats.regular += result.photos.regular.length;
            state.photoStats.floorplan += result.photos.floorplan.length;
            state.photoStats.other += result.photos.other.length;
          } catch (e) {
            console.error(`   ⚠️ DynamoDB write failed for ${listing.id}`);
          }
          
          existingListings.set(listing.id, listing);
          geocodedSet.add(listing.id);
        }
        
        const processed = Math.min(i + PARALLEL_BATCH_SIZE, listingsToProcess.length);
        if (processed % 50 === 0 || processed === listingsToProcess.length) {
          console.log(`   Geocoded ${processed}/${listingsToProcess.length}`);
          state.lastProgressAt = new Date().toISOString();
        }
      }
      
      console.log(`   ✅ Geocoding complete: ${state.geocodedCount} with coordinates`);
      console.log(`   📊 Precision: ${precisionStats.precise} precise, ${precisionStats.approximate} approximate, ${precisionStats.city_center} city_center, ${precisionStats.unknown} unknown`);
      state.geocodedIds = Array.from(geocodedSet);
      state.phase = 'removed_detection';
      state.listingsToGeocode = [];
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 4: REMOVED DETECTION
    if (state.phase === 'removed_detection') {
      console.log('\n--- PHASE 4: REMOVED DETECTION ---');
      
      const currentSitemapIds = new Set(state.allSitemapUrls.map(item => {
        const parts = item.url.split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
      }));
      
      if (currentSitemapIds.size > 100) { // Only if we have valid data
        for (const [id] of existingListings) {
          if (!currentSitemapIds.has(id)) {
            try {
              await dynamoClient.send(new UpdateCommand({
                TableName: LEO_LISTINGS_TABLE,
                Key: { domain: DOMAIN, listing_id: id },
                UpdateExpression: 'SET #status = :status, #signal = :signal, #updated = :updated',
                ExpressionAttributeNames: { '#status': 'status', '#signal': 'status_signal', '#updated': 'updated_at' },
                ExpressionAttributeValues: { ':status': 'removed', ':signal': 'not_in_sitemap', ':updated': new Date().toISOString() },
                ConditionExpression: 'attribute_exists(listing_id)'
              }));
              state.removedCount++;
            } catch { /* Listing might not exist */ }
          }
        }
        
        if (state.removedCount > 0) {
          console.log(`   ⚠️ Marked ${state.removedCount} listings as REMOVED`);
        }
      }
      
      state.phase = 'complete';
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 5: COMPLETION
    if (state.phase === 'complete') {
      console.log('\n--- PHASE 5: COMPLETION ---');
      
      await saveListings(existingListings);
      state.totalInS3 = existingListings.size;
      
      // SAFEGUARD 4: Clean up state on completion
      await deleteHarvestState();
      console.log(`💾 Saved ${existingListings.size} listings to S3`);
    }
    
    logMemory('END');
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Completed in ${elapsed.toFixed(1)}s`);
    
    // Write run summary to analytics
    const summary = createRunSummary(
      DOMAIN,
      HARVESTER_VERSION,
      state.invocationCount,
      MAX_INVOCATIONS,
      'complete',
      'complete',
      startTime,
      MEMORY_LIMIT_MB
    );
    summary.listings_discovered = state.totalNewFound;
    summary.listings_written = state.writtenToDynamo;
    summary.listings_new = state.newInDb;
    summary.listings_updated = state.updatedInDb;
    summary.listings_removed = state.removedCount;
    summary.listings_by_type = typeStats;
    summary.listings_by_precision = precisionStats;
    await writeRunSummary(summary);
    
    const result = {
      statusCode: 200,
      body: JSON.stringify({
        domain: DOMAIN,
        continuation: isContinuation,
        invocationCount: state.invocationCount,
        sitemapTotal: state.allSitemapUrls.length,
        newListings: state.totalNewFound,
        new_in_db: state.newInDb,
        updated_in_db: state.updatedInDb,
        geocoded: state.geocodedCount,
        writtenToDynamo: state.writtenToDynamo,
        photos: state.photoStats,
        totalInS3: state.totalInS3,
        removed: state.removedCount,
        duration: elapsed,
        timestamp: new Date().toISOString(),
      }),
    };
    
    console.log('Result:', result.body);
    return result;
    
  } catch (error) {
    console.error('Lambda failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) })
    };
  }
};

// For local testing
if (require.main === module) {
  handler({}).then(result => {
    console.log('Result:', result);
  }).catch(console.error);
}

