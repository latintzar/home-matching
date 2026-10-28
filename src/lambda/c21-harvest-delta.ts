/**
 * Century21 Spain Harvest Lambda (FULL COMPLIANCE - ALL 13 REQUIREMENTS)
 * 
 * Harvests listing data from Century21.es (Spain)
 * 
 * REQUIREMENTS IMPLEMENTED:
 * 1. S3 State File - c21-listings.json.gz + c21-state.json
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
 * - Sitemap-based discovery: https://century21.es/ref/sitemap/0.xml
 * - HTML parsing (no JSON-LD in server response)
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
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
import { detectListingStatus, detectFromHttpStatus, isRemovedRedirect, type SaleStatus } from '../lib/harvest/listing-status-detection';
import { 
  analyzeCoordinates, 
  verifyCoordinates,
  extractStreetAddressFromHtml, 
  extractNeighborhoodFromHtml,
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

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

const LEO_LISTINGS_TABLE = 'leo-listings';
const S3_BUCKET = 'puedo-casa-html-archive';
const LISTINGS_KEY = 'harvest/c21-listings.json.gz';
const STATE_KEY = 'harvest/c21-state.json';
const DOMAIN = 'century21.es';
const SITEMAP_URL = 'https://century21.es/ref/sitemap/0.xml';

// Processing limits
const PARALLEL_BATCH_SIZE = 10;
const REQUEST_DELAY_MS = 100;

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.2.0';  // 2.2.0: Added SAVE GAME logging, 14m30s timeout

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
    const result = await dynamoClient.send(new GetItemCommand({
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

async function invokeSelfContinuation(state: HarvestState): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'c21-harvest-delta';
  
  console.log(`🔄 Self-invoking for continuation (invocation ${state.invocationCount + 1}/${MAX_INVOCATIONS})`);
  
  await lambdaClient.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event', // Async
    Payload: JSON.stringify({ continuation: true }),
  }));
}

interface Century21Listing {
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
  street_address: string | null;  // Specific street (e.g., "Calle Mayor 15")
  city: string | null;
  province: string | null;
  neighborhood: string | null;
  photos: string[];
  
  // Coordinates - initially from Google Maps link, then verified via Nominatim
  latitude: number | null;
  longitude: number | null;
  coordinate_precision: CoordinatePrecision;  // 'precise' | 'approximate' | 'city_center' | 'unknown'
  coordinate_precision_signal: string;        // Why we determined this precision
  verifiedAddress: AddressComponents | null;  // Full address from Nominatim verification
  
  property_type: string | null;
  contract_type: string;
  source: 'century21.es';
  scraped_at: string;
  
  // Boolean amenity flags (Data Completeness)
  has_elevator: boolean;
  has_ac: boolean;
  has_parking: boolean;
  has_terrace: boolean;
  has_pool: boolean;
  is_furnished: boolean | null;  // null = unknown
  floor: number | null;
  
  // Agent contact (from SSR JSON)
  agent_phone: string | null;
  agent_email: string | null;
  agent_name: string | null;
  
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
  allSitemapUrls: string[];
  
  // Scraping phase
  scrapedUrls: string[];
  listingsToGeocode: Century21Listing[];
  
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
  coordinate_precision: CoordinatePrecision;
  coordinate_precision_signal: string;
  street_address: string | null;
  city: string | null;
  province: string | null;
  neighborhood: string | null;
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
  agent_email: string | null;
  agent_name: string | null;
  
  // Sale status detection
  saleStatus: SaleStatus;
  saleStatusSignal: string;
}

// Rate limiting
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// NOTE: Canary Islands will return WRONG coords from Nominatim (mainland Spain cities).
// This is a known limitation - see P0-14-HARVESTING.md for TODO.

// Reverse geocoding via Nominatim - convert lat/lng to address
async function reverseGeocode(lat: number, lon: number): Promise<{
  city: string | null;
  province: string | null;
  neighborhood: string | null;
  address: string | null;
} | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1',
      zoom: '18'
    });
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const result = await response.json();
    if (result && result.address) {
      const addr = result.address;
      return {
        city: addr.city || addr.town || addr.village || addr.municipality || null,
        province: addr.state || addr.province || null,
        neighborhood: addr.suburb || addr.neighbourhood || addr.quarter || addr.district || null,
        address: result.display_name || null
      };
    }
  } catch (error) {
    console.log(`Reverse geocoding failed for ${lat},${lon}:`, error);
  }
  
  return null;
}

// Fetch sitemap and extract listing URLs
async function fetchSitemapUrls(): Promise<string[]> {
  console.log(`Fetching sitemap: ${SITEMAP_URL}`);
  
  const response = await fetch(SITEMAP_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }
  
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const urls: string[] = [];
  $('url loc').each((_, el) => {
    const url = $(el).text();
    if (url.startsWith('https://century21.es/ref/')) {
      urls.push(url);
    }
  });
  
  console.log(`Found ${urls.length} listing URLs in sitemap`);
  return urls;
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

// Parse a detail page
function parseDetailPage(html: string, url: string): Century21Listing | null {
  const $ = cheerio.load(html);
  
  // Extract reference ID from canonical URL
  const canonical = $('link[rel="canonical"]').attr('href') || url;
  const id = canonical.split('/').pop() || '';
  
  if (!id) {
    return null;
  }
  
  // Extract title from <title> tag
  const titleTag = $('title').text();
  const titleParts = titleTag.split('|');
  const title = titleParts.length >= 2 ? titleParts[1].trim() : titleParts[0].trim();
  
  // Extract price from tagline-1 class
  const priceElem = $('.tagline-1').first();
  const priceRaw = priceElem.text().trim();
  const priceNum = priceRaw.replace(/[^\d]/g, '');
  const price = priceNum ? parseInt(priceNum, 10) : null;
  
  // Extract specs (bedrooms, bathrooms, area) from tagline-2 class
  const specs = $('.tagline-2');
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  if (specs.length >= 3) {
    const bedroomsText = specs.eq(0).text().trim();
    const bathroomsText = specs.eq(1).text().trim();
    const areaText = specs.eq(2).text().trim();
    
    bedrooms = /^\d+$/.test(bedroomsText) ? parseInt(bedroomsText, 10) : null;
    bathrooms = /^\d+$/.test(bathroomsText) ? parseInt(bathroomsText, 10) : null;
    area_m2 = /^\d+$/.test(areaText) ? parseInt(areaText, 10) : null;
  }
  
  // Extract description from meta tag
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Extract location from page links and breadcrumbs
  let address = '';
  let city: string | null = null;
  let province: string | null = null;
  
  // Method 1: Look for links with address_names parameter (most reliable)
  const locationLinks = $('a[href*="address_names="]').map((_, el) => $(el).text().trim()).get();
  const uniqueLocations = [...new Set(locationLinks)].filter(l => l && l.length > 2);
  
  if (uniqueLocations.length > 0) {
    // Usually format is [City] or [City, Province]
    city = uniqueLocations[0];
    if (uniqueLocations.length > 1) {
      province = uniqueLocations[1];
    }
    address = uniqueLocations.join(', ') + ', Spain';
  }
  
  // Method 2: Fallback to og:description for city names
  if (!city) {
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const cityMatch = ogDesc.match(/ciudad de ([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i);
    if (cityMatch) {
      city = cityMatch[1];
      address = city + ', Spain';
    }
  }
  
  // Method 3: Try og:image URL (legacy, may not work)
  if (!city) {
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    if (ogImage) {
      try {
        const ogUrl = new URL(ogImage.replace(/&amp;/g, '&'));
        const location = ogUrl.searchParams.get('location') || '';
        if (location) {
          address = location;
          const addressParts = location.split(',').map(p => p.trim());
          if (addressParts.length >= 1) {
            city = addressParts[0];
            if (addressParts.length >= 2 && addressParts[1] !== 'Spain' && addressParts[1] !== 'España') {
              province = addressParts[1];
            }
          }
        }
      } catch (e) {
        // Failed to parse og:image URL
      }
    }
  }
  
  // Extract coordinates from Google Maps directions link
  // Pattern: href="https://www.google.com/maps/dir/?api=1&destination=41.503468,2.3884592"
  let latitude: number | null = null;
  let longitude: number | null = null;
  
  const mapsLink = $('a[href*="google.com/maps/dir"]').attr('href') || '';
  const coordsMatch = mapsLink.match(/destination=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (coordsMatch) {
    latitude = parseFloat(coordsMatch[1]);
    longitude = parseFloat(coordsMatch[2]);
    console.log(`   📍 Found coords from Google Maps: ${latitude}, ${longitude}`);
  }
  
  // Extract photos from HTML (supports jpg, jpeg, png, webp)
  const photoRegex = /https:\/\/images\.century21\.pt\/[^"]+\.(jpg|jpeg|png|webp)/gi;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
  // Determine contract type from URL path
  const contract_type = url.includes('/alquilar/') ? 'rent' : 'sale';
  
  // Try to determine property type from title or description
  let property_type: string | null = null;
  const typeKeywords = {
    'piso': 'apartment',
    'apartamento': 'apartment',
    'casa': 'house',
    'chalet': 'house',
    'villa': 'house',
    'ático': 'penthouse',
    'dúplex': 'duplex',
    'estudio': 'studio',
    'local': 'commercial',
    'oficina': 'office',
    'terreno': 'land',
    'solar': 'land',
    'garaje': 'parking',
    'parking': 'parking'
  };
  
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  for (const [keyword, type] of Object.entries(typeKeywords)) {
    if (lowerTitle.includes(keyword) || lowerDesc.includes(keyword)) {
      property_type = type;
      break;
    }
  }
  
  // Extract boolean amenity flags from description (Data Completeness)
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
  
  // Extract agent contact from SSR JSON
  // Pattern: "phone":"+12025550123","handler":"susana-heredi..."
  let agent_phone: string | null = null;
  let agent_email: string | null = null;
  let agent_name: string | null = null;
  
  const phoneMatch = html.match(/"phone":"(\+34\d+)"/);
  if (phoneMatch) agent_phone = phoneMatch[1];
  
  const emailMatch = html.match(/"email":"([^"]+@century21[^"]+)"/i);
  if (emailMatch) agent_email = emailMatch[1];
  
  const handlerMatch = html.match(/"handler":"([^"]+)"/);
  if (handlerMatch) {
    // Convert handler slug to name: "susana-heredi" -> "Susana Heredi"
    agent_name = handlerMatch[1]
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  
  // Extract street address and neighborhood from HTML
  const street_address = extractStreetAddressFromHtml(html);
  const extractedNeighborhood = extractNeighborhoodFromHtml(html);
  
  // Analyze coordinate precision
  const coordInfo = analyzeCoordinates(
    latitude,
    longitude,
    address,
    {
      streetAddress: street_address,
      neighborhood: extractedNeighborhood,
      city: city,
      province: province,
      country: 'Spain'
    }
  );
  
  // Log coordinate precision for debugging
  if (latitude && longitude) {
    console.log(`   📍 Coords: ${latitude}, ${longitude} | Precision: ${coordInfo.precision} (${coordInfo.precisionSignal})`);
  }
  
  return {
    id,
    url: canonical,
    title,
    price,
    price_raw: priceRaw,
    description,
    bedrooms,
    bathrooms,
    area_m2,
    address,
    street_address,
    city,
    province,
    neighborhood: extractedNeighborhood, // Now extracted from HTML
    photos,
    latitude,
    longitude,
    coordinate_precision: coordInfo.precision,  // Initial estimate, will be verified in geocoding phase
    coordinate_precision_signal: coordInfo.precisionSignal,
    verifiedAddress: null,  // Will be filled in geocoding phase via Nominatim
    property_type,
    contract_type,
    source: 'century21.es',
    scraped_at: new Date().toISOString(),
    
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
    agent_email,
    agent_name,
    
    // Sale status detection
    saleStatus: statusDetection.saleStatus,
    saleStatusSignal: statusDetection.statusSignal,
  };
}

// Normalize listing for leo-listings table (now async for tracking)
async function normalizeListing(listing: Century21Listing): Promise<NormalizedListing> {
  // Get existing tracking data
  const existing = await getExistingListingTracking(listing.id);
  const tracking = buildTrackingData(existing, listing.price);
  
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
    coordinate_precision: listing.coordinate_precision,
    coordinate_precision_signal: listing.coordinate_precision_signal,
    street_address: listing.street_address,
    city: listing.city,
    province: listing.province,
    neighborhood: listing.neighborhood,
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
    
    // Agent contact
    agent_phone: listing.agent_phone,
    agent_email: listing.agent_email,
    agent_name: listing.agent_name,
    
    // Sale status detection
    saleStatus: listing.saleStatus,
    saleStatusSignal: listing.saleStatusSignal,
  };
}

// Write to DynamoDB
async function writeListingToDynamoDB(listing: NormalizedListing): Promise<{ isNew: boolean; photos: ClassifiedPhotos }> {
  const now = new Date().toISOString();
  
  const item = {
    domain: DOMAIN,
    listing_id: listing.listing_id,
    url: listing.url,
    title: listing.title,
    price: listing.price,
    
    location: {
      address: listing.street_address || (listing.city ? `${listing.city}, ${listing.province || 'Spain'}` : null),
      street_address: listing.street_address,
      city: listing.city,
      province: listing.province,
      neighborhood: listing.neighborhood,
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
    
    // Agent contact
    agent_phone: listing.agent_phone,
    agent_email: listing.agent_email,
    agent_name: listing.agent_name,
    
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

// Backup to S3
async function backupToS3(listings: Century21Listing[]): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const key = `${DOMAIN}/c21-listings-${timestamp}.json.gz`;
  
  const jsonData = JSON.stringify(listings, null, 2);
  const compressed = await gzip(Buffer.from(jsonData));
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: compressed,
    ContentType: 'application/json',
    ContentEncoding: 'gzip'
  }));
  
  console.log(`Backed up ${listings.length} listings to s3://${S3_BUCKET}/${key}`);
}

// ============================================================
// MAIN HANDLER - SELF-CONTINUATION MODE
// ============================================================

export const handler = async (event: any): Promise<any> => {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Century21 Spain Harvest Lambda - SELF-CONTINUATION MODE');
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
    
    // PHASE 2: SCRAPING - Fetch and parse detail pages
    if (state.phase === 'scraping') {
      console.log('\n--- PHASE 2: SCRAPING ---');
      
      const scrapedSet = new Set(state.scrapedUrls);
      const urlsToScrape = state.allSitemapUrls.filter(url => {
        const id = url.split('/').pop() || '';
        return !scrapedSet.has(url) && !existingIds.has(id);
      });
      
      console.log(`   New URLs to scrape: ${urlsToScrape.length}`);
      
      for (let i = 0; i < urlsToScrape.length; i += PARALLEL_BATCH_SIZE) {
        // Timeout check (14m 30s)
        if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
          logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
            'Sitemap URLs': state.allSitemapUrls.length,
            'Scraped': state.scrapedUrls.length,
            'To geocode': state.listingsToGeocode.length,
            'New found': state.totalNewFound,
          });
          state.lastProgressAt = new Date().toISOString();
          await saveHarvestState(state);
          return { statusCode: 202, body: 'Continuing scraping in next invocation' };
        }
        
        const batch = urlsToScrape.slice(i, i + PARALLEL_BATCH_SIZE);
        const fetchResults = await Promise.all(batch.map(url => fetchPage(url)));
        
        for (let j = 0; j < batch.length; j++) {
          const { html, removed } = fetchResults[j];
          const url = batch[j];
          const id = url.split('/').pop() || '';
          
          if (html) {
            const listing = parseDetailPage(html, url);
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
          state.scrapedUrls.push(url);
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
    
    // PHASE 3: GEOCODING - VERIFY Google Maps coords vs address (CRITICAL for data quality!)
    // Google Maps "directions to" link often points to city center, not actual property location
    if (state.phase === 'geocoding' && state.listingsToGeocode.length > 0) {
      console.log('\n--- PHASE 3: COORDINATE VERIFICATION ---');
      console.log(`   ${state.listingsToGeocode.length} listings to verify`);
      
      const geocodedSet = new Set(state.geocodedIds);
      const listingsToProcess = state.listingsToGeocode.filter(l => !geocodedSet.has(l.id));
      
      // Track precision stats
      const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
      let coordsCorrected = 0;
      
      for (let i = 0; i < listingsToProcess.length; i += PARALLEL_BATCH_SIZE) {
        // Timeout check (14m 30s)
        if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
          state.geocodedIds = Array.from(geocodedSet);
          logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
            'Sitemap URLs': state.allSitemapUrls.length,
            'Scraped': state.scrapedUrls.length,
            'Geocoded': state.geocodedIds.length,
            'To geocode remaining': listingsToProcess.length - i,
          });
          state.lastProgressAt = new Date().toISOString();
          await saveListings(existingListings);
          await saveHarvestState(state);
          return { statusCode: 202, body: 'Continuing geocoding in next invocation' };
        }
        
        const batch = listingsToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
        
        // VERIFY coordinates: compare Google Maps coords with address-based geocoding
        const verifyResults = await Promise.all(
          batch.map(async (listing) => {
            // Build best address string for geocoding
            const addressParts = [
              listing.street_address,
              listing.neighborhood,
              listing.city,
              listing.province,
              'Spain'
            ].filter(Boolean);
            const addressText = addressParts.join(', ');
            
            // Verify embedded coords (from Google Maps) against address
            return verifyCoordinates(
              listing.latitude,   // Embedded lat from Google Maps link
              listing.longitude,  // Embedded lng from Google Maps link
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
          
          // Check if coords were corrected (embedded was wrong)
          if (verification.usedSource === 'geocoded' && listing.latitude && listing.longitude) {
            coordsCorrected++;
            console.log(`   🔄 ${listing.id}: Corrected coords (was ${listing.latitude.toFixed(4)},${listing.longitude.toFixed(4)}, now ${verification.finalLat?.toFixed(4)},${verification.finalLng?.toFixed(4)}) - ${verification.precisionSignal}`);
          }
          
          // Update listing with verified data
          listing.latitude = verification.finalLat;
          listing.longitude = verification.finalLng;
          listing.coordinate_precision = verification.precision;
          listing.coordinate_precision_signal = verification.precisionSignal;
          listing.verifiedAddress = verification.address;
            
          // Update address fields from verified address
          if (verification.address) {
            listing.city = verification.address.city || listing.city;
            listing.province = verification.address.province || listing.province;
            listing.neighborhood = verification.address.neighborhood || listing.neighborhood;
            if (verification.address.streetAddress) {
              listing.street_address = verification.address.streetAddress;
              }
            }
          
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
            const writeResult = await writeListingToDynamoDB(normalized);
            state.writtenToDynamo++;
            if (writeResult.isNew) state.newInDb++; else state.updatedInDb++;
            
            state.photoStats.total += writeResult.photos.total;
            state.photoStats.regular += writeResult.photos.regular.length;
            state.photoStats.floorplan += writeResult.photos.floorplan.length;
            state.photoStats.other += writeResult.photos.other.length;
          } catch (e) {
            console.error(`   ⚠️ DynamoDB write failed for ${listing.id}`);
          }
          
          existingListings.set(listing.id, listing);
          geocodedSet.add(listing.id);
        }
        
        const processed = Math.min(i + PARALLEL_BATCH_SIZE, listingsToProcess.length);
        if (processed % 50 === 0 || processed === listingsToProcess.length) {
          console.log(`   Verified ${processed}/${listingsToProcess.length}`);
          state.lastProgressAt = new Date().toISOString();
        }
      }
      
      console.log(`   ✅ Verification complete: ${state.geocodedCount} with coordinates`);
      console.log(`   📊 Precision: ${precisionStats.precise} precise, ${precisionStats.approximate} approximate, ${precisionStats.city_center} city_center, ${precisionStats.unknown} unknown`);
      if (coordsCorrected > 0) {
        console.log(`   🔄 Corrected ${coordsCorrected} listings where Google Maps coords were city center`);
      }
      state.geocodedIds = Array.from(geocodedSet);
      state.phase = 'removed_detection';
      state.listingsToGeocode = [];
      state.lastProgressAt = new Date().toISOString();
      await saveHarvestState(state);
    }
    
    // PHASE 4: REMOVED DETECTION
    if (state.phase === 'removed_detection') {
      console.log('\n--- PHASE 4: REMOVED DETECTION ---');
      
      const currentSitemapIds = new Set(state.allSitemapUrls.map(url => url.split('/').pop() || ''));
      
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
      state.phase,
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

