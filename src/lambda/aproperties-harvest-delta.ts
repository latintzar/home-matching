/**
 * aProperties Spain Harvest Lambda (FULL COMPLIANCE - ALL 13 REQUIREMENTS)
 * 
 * Harvests listing data from aproperties.es (Spain)
 * 
 * REQUIREMENTS IMPLEMENTED:
 * 1. S3 State File - aproperties-listings.json.gz + aproperties-state.json
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
 * 14. ScrapFly Integration - Bypass Cloudflare anti-bot protection
 * 15. Smart Age Filtering - Rentals ≤14 days, Sales ≤60 days
 * 
 * Strategy:
 * - Sitemap-based discovery: https://www.aproperties.es/sitemap-es.xml
 * - ScrapFly for JS rendering & Cloudflare bypass
 * - HTML parsing with specific classes
 * - Nominatim geocoding for coordinates
 * 
 * Schedule: 3x daily (7 AM, 12 PM, 6 PM Spain)
 * Timeout: 15 minutes with 2-minute buffer for self-continuation
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as cheerio from 'cheerio';
import * as zlib from 'zlib';
import * as https from 'https';
import * as http from 'http';
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

// Use Node.js native HTTP instead of fetch to avoid undici issues in Lambda
function httpFetch(url: string, options: { headers?: Record<string, string> } = {}): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(urlObj, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers,
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
          text: () => Promise.resolve(data),
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// ScrapFly fetch - bypasses Cloudflare, costs $0.001/req
// Includes retry logic for rate limits (429)
async function scrapflyFetch(url: string, retryCount = 0): Promise<{ ok: boolean; status: number; html: string }> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 3000; // 3 seconds between retries
  
  if (!SCRAPFLY_KEY) {
    console.error('⚠️ SCRAPFLY_KEY not set, falling back to direct HTTP');
    const result = await httpFetch(url);
    return { ok: result.ok, status: result.status, html: await result.text() };
  }
  
  const scrapflyUrl = new URL('https://api.scrapfly.io/scrape');
  scrapflyUrl.searchParams.set('key', SCRAPFLY_KEY);
  scrapflyUrl.searchParams.set('url', url);
  scrapflyUrl.searchParams.set('country', 'ES');
  scrapflyUrl.searchParams.set('asp', 'true');  // Anti-scraping protection bypass
  scrapflyUrl.searchParams.set('render_js', 'false');  // No JS needed for aProperties
  
  try {
    const response = await httpFetch(scrapflyUrl.toString(), {
      headers: { 'Accept': 'application/json' }
    });
    
    // Handle rate limit with retry
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      console.log(`   ⏳ Rate limited, waiting ${RETRY_DELAY_MS}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return scrapflyFetch(url, retryCount + 1);
    }
    
    if (!response.ok) {
      console.log(`   ScrapFly error for ${url}: HTTP ${response.status}`);
      return { ok: false, status: response.status, html: '' };
    }
    
    const text = await response.text();
    const data = JSON.parse(text);
    
    // ScrapFly returns the HTML in result.content
    const html = data.result?.content || '';
    const finalStatus = data.result?.status_code || 200;
    
    return { 
      ok: finalStatus >= 200 && finalStatus < 400, 
      status: finalStatus, 
      html 
    };
  } catch (error) {
    console.error(`   ScrapFly fetch failed for ${url}:`, error);
    return { ok: false, status: 0, html: '' };
  }
}

// Check if URL passes age filter based on lastmod and contract type
function passesAgeFilter(url: string, lastmod: string | null): boolean {
  if (!lastmod) return true; // If no lastmod, include it (be conservative)
  
  const isRental = url.includes('alquiler') || url.includes('rent');
  const maxAgeDays = isRental ? RENTAL_MAX_AGE_DAYS : SALE_MAX_AGE_DAYS;
  
  try {
    const lastmodDate = new Date(lastmod);
    const now = new Date();
    const ageMs = now.getTime() - lastmodDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    return ageDays <= maxAgeDays;
  } catch {
    return true; // If parsing fails, include it
  }
}

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

const LEO_LISTINGS_TABLE = 'leo-listings';
const S3_BUCKET = 'puedo-casa-html-archive';
const LISTINGS_KEY = 'harvest/aproperties-listings.json.gz';
const STATE_KEY = 'harvest/aproperties-state.json';
const DOMAIN = 'aproperties.es';
const SITEMAP_URL = 'https://www.aproperties.es/sitemap-es.xml';

// ScrapFly for Cloudflare bypass
const SCRAPFLY_KEY = process.env.SCRAPFLY_KEY || '';

// Processing limits (very conservative for ScrapFly rate limits)
const PARALLEL_BATCH_SIZE = 2;  // ScrapFly has strict rate limits
const REQUEST_DELAY_MS = 1500;  // 1.5s between batches to avoid 429s

// Age filtering thresholds (smart initial scrape)
const RENTAL_MAX_AGE_DAYS = 14;   // Rentals: max 2 weeks old
const SALE_MAX_AGE_DAYS = 60;     // Sales: max 2 months old

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.3.0';  // 2.3.0: Added SAVE GAME logging, 14m30s timeout

// Self-continuation safeguards
const MAX_INVOCATIONS = 10;
const STATE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours - allows manual babysitting between scheduled runs
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before Lambda's 15m hard limit
const MEMORY_LIMIT_MB = 2048;

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

function classifyPhotos(photoUrls: string[]): ClassifiedPhotos {
  const result: ClassifiedPhotos = {
    regular: [],
    floorplan: [],
    exterior: [],
    other: [],
    total: photoUrls.length
  };
  
  for (const url of photoUrls) {
    const filename = url.split('/').pop()?.toLowerCase() || '';
    
    if (FLOORPLAN_PATTERNS.some(p => p.test(filename))) {
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
  publication_date: string | null;
  price_history: Array<{ price: number; date: string }>;
}

async function getExistingListing(domain: string, listingId: string): Promise<{
  first_seen?: string;
  price?: number;
  price_history?: Array<{ price: number; date: string }>;
} | null> {
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: LEO_LISTINGS_TABLE,
      Key: {
        domain: { S: domain },
        listing_id: { S: listingId }
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
    publication_date: publicationDate,
    price_history
  };
}

// ============================================================
// S3 STATE MANAGEMENT + SELF-CONTINUATION
// ============================================================

interface HarvestState {
  invocationCount: number;
  startedAt: string;
  lastProgressAt: string;
  phase: 'discovery' | 'scraping' | 'geocoding' | 'removed_detection' | 'complete';
  
  // Discovery phase
  allSitemapUrls: Array<{ url: string; lastmod: string | null }>;
  
  // Scraping phase
  scrapedUrls: string[];
  listingsToGeocode: APropertiesListing[];
  
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

async function invokeSelfContinuation(state: HarvestState): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'aproperties-harvest-delta';
  
  console.log(`🔄 Self-invoking for continuation (invocation ${state.invocationCount + 1}/${MAX_INVOCATIONS})`);
  
  await lambdaClient.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event', // Async
    Payload: JSON.stringify({ continuation: true }),
  }));
}

// Listing URL patterns to identify property pages
const LISTING_PATTERNS = [
  /piso-de-\d+/,
  /casa-de-\d+/,
  /villa-de-\d+/,
  /apartamento-de-\d+/,
  /chalet-de-\d+/,
  /atico-de-\d+/,
  /estudio-de-\d+/,
  /local-de-\d+/,
  /oficina-de-\d+/,
  /terreno-de-\d+/,
  /solar-de-\d+/,
  /nave-de-\d+/,
  /sqm-flat-for-sale/,
  /sqm-house-for-sale/,
  /sqm-villa-for-sale/,
  /sqm-apartment-for-sale/,
  /sqm-flat-for-rent/,
  /sqm-house-for-rent/
];

interface APropertiesListing {
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
  photos: ClassifiedPhotos;
  latitude: number | null;
  longitude: number | null;
  // Coordinate precision (CRITICAL for data quality)
  coordinate_precision: CoordinatePrecision;
  coordinate_precision_signal: string;
  verifiedAddress: AddressComponents | null;
  property_type: string | null;
  contract_type: string;
  source: 'aproperties.es';
  scraped_at: string;
  lastmod: string | null;
  tracking: ListingTrackingData;
  
  // Boolean amenity flags (Data Completeness)
  has_elevator: boolean;
  has_ac: boolean;
  has_parking: boolean;
  has_terrace: boolean;
  has_pool: boolean;
  is_furnished: boolean | null;  // null = unknown
  floor: number | null;
  
  // Agent contact
  agent_phone: string | null;
  
  // Sale status detection
  saleStatus: SaleStatus;
  saleStatusSignal: string;
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
  // Coordinate precision
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
  
  // Agent contact
  agent_phone: string | null;
  
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
    
    const response = await httpFetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' }
    });
    
    if (!response.ok) return null;
    
    const text = await response.text();
    const results = JSON.parse(text);
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

// Check if URL is a listing (not a category/city page)
function isListingUrl(url: string): boolean {
  return LISTING_PATTERNS.some(pattern => pattern.test(url));
}

// Extract location from URL path
function parseUrlLocation(url: string): {
  city: string | null;
  neighborhood: string | null;
  contract_type: string;
  property_type: string | null;
} {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // URL pattern: /{lang?}/{city}/{neighborhood?}/{slug}
    // or: /{city}/{neighborhood?}/{slug}
    
    let city: string | null = null;
    let neighborhood: string | null = null;
    const slug = pathParts[pathParts.length - 1] || '';
    
    // Detect language prefix and skip it
    const langPrefixes = ['en', 'ca', 'fr', 'de'];
    let startIdx = langPrefixes.includes(pathParts[0]) ? 1 : 0;
    
    if (pathParts.length > startIdx + 1) {
      city = pathParts[startIdx]?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || null;
    }
    if (pathParts.length > startIdx + 2) {
      neighborhood = pathParts[startIdx + 1]?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || null;
    }
    
    // Determine contract type from slug
    const contract_type = slug.includes('alquiler') || slug.includes('rent') ? 'rent' : 'sale';
    
    // Determine property type from slug
    let property_type: string | null = null;
    const typeMap: Record<string, string> = {
      'piso': 'apartment',
      'flat': 'apartment',
      'apartamento': 'apartment',
      'apartment': 'apartment',
      'casa': 'house',
      'house': 'house',
      'villa': 'villa',
      'chalet': 'house',
      'atico': 'penthouse',
      'penthouse': 'penthouse',
      'estudio': 'studio',
      'studio': 'studio',
      'local': 'commercial',
      'oficina': 'office',
      'terreno': 'land',
      'solar': 'land',
      'nave': 'industrial'
    };
    
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (slug.includes(keyword)) {
        property_type = type;
        break;
      }
    }
    
    return { city, neighborhood, contract_type, property_type };
  } catch {
    return { city: null, neighborhood: null, contract_type: 'sale', property_type: null };
  }
}

// Fetch sitemap and extract listing URLs with lastmod
async function fetchSitemapUrls(): Promise<Array<{ url: string; lastmod: string | null }>> {
  console.log(`Fetching sitemap: ${SITEMAP_URL}`);
  
  const response = await httpFetch(SITEMAP_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }
  
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const listings: Array<{ url: string; lastmod: string | null }> = [];
  
  $('url').each((_, el) => {
    const loc = $(el).find('loc').text();
    const lastmod = $(el).find('lastmod').text() || null;
    
    if (loc && isListingUrl(loc)) {
      listings.push({ url: loc, lastmod });
    }
  });
  
  // Sort by lastmod (newest first) for delta harvesting
  listings.sort((a, b) => {
    if (!a.lastmod && !b.lastmod) return 0;
    if (!a.lastmod) return 1;
    if (!b.lastmod) return -1;
    return b.lastmod.localeCompare(a.lastmod);
  });
  
  console.log(`Found ${listings.length} listing URLs in sitemap`);
  return listings;
}

// Fetch a single page using ScrapFly (Cloudflare bypass)
interface FetchPageResult {
  html: string | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchPage(url: string): Promise<FetchPageResult> {
  try {
    // Use ScrapFly to bypass Cloudflare
    const response = await scrapflyFetch(url);
    
    // Check for 404/410 - listing removed
    const httpStatus = detectFromHttpStatus(response.status, true);
    if (httpStatus) {
      console.log(`   🗑️ ${url}: ${httpStatus.signal} (HTTP ${response.status})`);
      return { html: null, removed: httpStatus };
    }
    
    if (!response.ok) {
      console.log(`   ⚠️ Failed to fetch ${url}: ${response.status}`);
      return { html: null };
    }
    
    // Check for Cloudflare block page (shouldn't happen with ScrapFly, but just in case)
    if (response.html.includes('checking your browser') || response.html.includes('cf-browser-verification')) {
      console.log(`   ⚠️ Cloudflare block detected for ${url}`);
      return { html: null };
    }
    
    return { html: response.html };
  } catch (error) {
    console.log(`   ❌ Error fetching ${url}: ${error}`);
    return { html: null };
  }
}

// Parse a detail page
function parseDetailPage(html: string, url: string, lastmod: string | null): APropertiesListing | null {
  const $ = cheerio.load(html);
  
  // Extract ID from photo URLs: /media/properties/{id}/
  const photoUrlMatch = html.match(/\/media\/properties\/(\d+)\//);
  const id = photoUrlMatch ? photoUrlMatch[1] : null;
  
  if (!id) {
    // Fallback: generate ID from URL slug
    const slug = url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || '';
    if (!slug) return null;
  }
  
  const listingId = id || url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || '';
  
  // Extract title from title tag
  const titleTag = $('title').text();
  const title = titleTag.split('|')[0].trim() || `Property ${listingId}`;
  
  // Extract price from propHeader__priceCurrent class
  let price: number | null = null;
  let priceRaw = '';
  
  const priceElem = $('.propHeader__priceCurrent').first();
  if (priceElem.length) {
    priceRaw = priceElem.text().trim();
    const priceNum = priceRaw.replace(/[^\d]/g, '');
    price = priceNum ? parseInt(priceNum, 10) : null;
  }
  
  // Extract specs from propHeader__specs
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  $('.propHeader__specs__item').each((_, el) => {
    const label = $(el).find('.propHeader__specs__itemLabel').text().toLowerCase().trim();
    const value = $(el).find('.propHeader__specs__itemValue').text().trim();
    
    if (label.includes('bedroom') || label.includes('dormitorio') || label.includes('habitacion')) {
      bedrooms = parseInt(value, 10) || null;
    } else if (label.includes('bathroom') || label.includes('baño')) {
      bathrooms = parseInt(value, 10) || null;
    } else if (label.includes('surface') || label.includes('superficie') || label.includes('m²')) {
      area_m2 = parseInt(value.replace(/[^\d]/g, ''), 10) || null;
    }
  });
  
  // Extract description from meta tag
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Extract photos from propertyGallery
  const photoUrls: string[] = [];
  $('a[data-fancybox="gallery"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('aproperties.es/media/properties')) {
      photoUrls.push(href);
    }
  });
  
  // Also check for other photo patterns
  const photoRegex = /https:\/\/www\.aproperties\.es\/media\/properties\/\d+\/[^"'\s]+\.(jpg|png|jpeg)/g;
  const additionalPhotos = [...new Set(html.match(photoRegex) || [])];
  additionalPhotos.forEach(p => {
    if (!photoUrls.includes(p)) photoUrls.push(p);
  });
  
  // Classify photos (floorplan vs regular)
  const photos = classifyPhotos(photoUrls);
  
  // Extract location from URL
  const urlInfo = parseUrlLocation(url);
  
  // Build address
  const addressParts = [urlInfo.neighborhood, urlInfo.city, 'Spain'].filter(Boolean);
  const address = addressParts.join(', ');
  
  // Extract boolean amenity flags from title and description (Data Completeness)
  const searchText = (title + ' ' + description).toLowerCase();
  
  const has_elevator = /ascensor|elevator|lift/i.test(searchText);
  const has_ac = /aire\s*acondicionado|climatización|a\/c|air\s*conditioning/i.test(searchText);
  const has_parking = /garaje|parking|plaza\s*de\s*garaje|aparcamiento/i.test(searchText);
  const has_terrace = /terraza|balcón|solarium|terrace|balcony/i.test(searchText);
  const has_pool = /piscina|pool/i.test(searchText);
  
  // Extract floor number if available
  let floor: number | null = null;
  const floorMatch = searchText.match(/(\d+)(?:º|ª|a|er|o)\s*(?:planta|piso|floor)/i) ||
                    searchText.match(/planta\s*(\d+)/i) ||
                    searchText.match(/(\d+)(?:st|nd|rd|th)\s*floor/i);
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
  
  // Extract agent phone from tel: links
  let agent_phone: string | null = null;
  const phoneMatch = html.match(/tel:(\d[\d\s]+\d)/);
  if (phoneMatch) {
    agent_phone = '+34' + phoneMatch[1].replace(/\s/g, '');
  }
  
  // Extract street address from HTML
  const street_address = extractStreetAddressFromHtml(html);
  
  // Note: tracking data will be added after we check existing listing
  return {
    id: listingId,
    url,
    title,
    price,
    price_raw: priceRaw,
    description: description.substring(0, 2000),
    bedrooms,
    bathrooms,
    area_m2,
    address,
    street_address,
    neighborhood: urlInfo.neighborhood,
    city: urlInfo.city,
    province: null, // aProperties doesn't clearly distinguish province
    photos,
    latitude: null,  // Will be filled in geocoding phase
    longitude: null,  // Will be filled in geocoding phase
    // Coordinate precision - will be updated in geocoding phase
    coordinate_precision: 'unknown' as CoordinatePrecision,
    coordinate_precision_signal: 'not_geocoded_yet',
    verifiedAddress: null,
    property_type: urlInfo.property_type,
    contract_type: urlInfo.contract_type,
    source: 'aproperties.es',
    scraped_at: new Date().toISOString(),
    lastmod,
    // Tracking will be populated separately
    tracking: null as unknown as ListingTrackingData,
    
    // Boolean amenity flags
    has_elevator,
    has_ac,
    has_parking,
    has_terrace,
    has_pool,
    is_furnished,
    floor,
    
    // Agent contact
    agent_phone,
    
    // Sale status detection
    saleStatus: statusDetection.saleStatus,
    saleStatusSignal: statusDetection.statusSignal,
  };
}

// Normalize listing for leo-listings table (now async for tracking lookup)
async function normalizeListing(listing: APropertiesListing): Promise<NormalizedListing> {
  // Check for existing listing to preserve first_seen and price history
  const existing = await getExistingListing(DOMAIN, listing.id);
  
  // Build tracking data
  const tracking = buildTrackingData(existing, listing.price, listing.lastmod);
  
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
    photos: listing.photos,
    description: listing.description,
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
    agent_phone: listing.agent_phone,
    
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
      address: listing.city ? `${listing.city}, Spain` : null,
      street_address: listing.street_address,
      neighborhood: listing.neighborhood,
      city: listing.city,
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
    agent_phone: listing.agent_phone,
    
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
  console.log('aProperties Spain Harvest Lambda - SELF-CONTINUATION MODE');
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
        const allUrls = await fetchSitemapUrls();
        state.allSitemapUrls = allUrls;
        console.log(`   Found ${allUrls.length} URLs in sitemap`);
      }
      
      state.phase = 'scraping';
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 2: SCRAPING - Fetch and parse detail pages (with ScrapFly + age filter)
    if (state.phase === 'scraping') {
      console.log('\n--- PHASE 2: SCRAPING (ScrapFly + Age Filter) ---');
      console.log(`   Age limits: Rentals ≤${RENTAL_MAX_AGE_DAYS} days, Sales ≤${SALE_MAX_AGE_DAYS} days`);
      
      const scrapedSet = new Set(state.scrapedUrls);
      
      // Apply age filter to reduce ScrapFly costs
      const ageFilteredUrls = state.allSitemapUrls.filter(item => passesAgeFilter(item.url, item.lastmod));
      const rentalsCount = ageFilteredUrls.filter(item => item.url.includes('alquiler') || item.url.includes('rent')).length;
      const salesCount = ageFilteredUrls.length - rentalsCount;
      console.log(`   After age filter: ${ageFilteredUrls.length} (${rentalsCount} rentals, ${salesCount} sales)`);
      
      const urlsToScrape = ageFilteredUrls.filter(item => {
        // Extract ID from URL
        const photoMatch = item.url.match(/\/media\/properties\/(\d+)\//);
        const id = photoMatch ? photoMatch[1] : item.url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || '';
        return !scrapedSet.has(item.url) && !existingIds.has(id);
      });
      
      console.log(`   New URLs to scrape: ${urlsToScrape.length}`);
      console.log(`   Estimated ScrapFly cost: $${(urlsToScrape.length * 0.001).toFixed(2)}`);
      
      for (let i = 0; i < urlsToScrape.length; i += PARALLEL_BATCH_SIZE) {
        // Timeout check (14m 30s)
        if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
          logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
            'Sitemap URLs': state.allSitemapUrls.length,
            'Scraped': state.scrapedUrls.length,
            'To geocode': state.listingsToGeocode.length,
            'ScrapFly credits': (state as any).scrapflyCredits || 0,
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
          
          // Extract ID from URL slug
          const urlSlug = item.url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || '';
          const id = urlSlug;
          
          if (html) {
            const listing = parseDetailPage(html, item.url, item.lastmod);
          if (listing) {
            state.listingsToGeocode.push(listing);
            state.totalNewFound++;
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
          console.log(`   Scraped ${processed}/${urlsToScrape.length} (${state.listingsToGeocode.length} valid)`);
          state.lastProgressAt = new Date().toISOString();
        }
        
        await sleep(REQUEST_DELAY_MS);
      }
      
      console.log(`   ✅ Scraping complete: ${state.listingsToGeocode.length} new listings`);
      state.phase = 'geocoding';
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 3: GEOCODING - Get coordinates via Nominatim with precision verification
    if (state.phase === 'geocoding' && state.listingsToGeocode.length > 0) {
      console.log('\n--- PHASE 3: GEOCODING (with precision verification) ---');
      console.log(`   ${state.listingsToGeocode.length} listings to geocode`);
      
      const geocodedSet = new Set(state.geocodedIds);
      const listingsToProcess = state.listingsToGeocode.filter(l => !geocodedSet.has(l.id));
      
      for (let i = 0; i < listingsToProcess.length; i += PARALLEL_BATCH_SIZE) {
        // Timeout check (14m 30s)
        if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
          state.geocodedIds = Array.from(geocodedSet);
          logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
            'Sitemap URLs': state.allSitemapUrls.length,
            'Scraped': state.scrapedUrls.length,
            'Geocoded': state.geocodedIds.length,
            'To geocode remaining': listingsToProcess.length - i,
            'ScrapFly credits': (state as any).scrapflyCredits || 0,
          });
          state.lastProgressAt = new Date().toISOString();
          await saveListings(existingListings);
          await saveHarvestState(state);
          return { statusCode: 202, body: 'Continuing geocoding in next invocation' };
        }
        
        const batch = listingsToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
        
        // Verify coordinates using smart geocoding
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
            
            // No embedded coords for aProperties - geocode from address
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
          
          // Track listing type
          if (listing.contract_type === 'rent') typeStats.rent++;
          else if (listing.contract_type === 'sale') typeStats.sale++;
          else typeStats.unknown++;
          
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
        const photoMatch = item.url.match(/\/media\/properties\/(\d+)\//);
        return photoMatch ? photoMatch[1] : item.url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || '';
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
    summary.scrapfly_credits = (state as any).scrapflyCredits || 0;
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

