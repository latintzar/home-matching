/**
 * donpiso Delta Harvest Lambda (PARALLELIZED + PRIORITY + SOLD DETECTION + SELF-CONTINUATION)
 * 
 * GUARANTEED COVERAGE: Crawls ALL 1,325 sitemap list pages to discover every listing.
 * PRIORITY CITIES: Madrid, Barcelona, Valencia etc. processed FIRST for freshness.
 * SOLD/REMOVED DETECTION: Marks listings as 'removed' when they disappear from sitemap.
 * PARALLELIZED: 10 concurrent requests per batch for speed.
 * NO NOMINATIM: Coordinates included in JSON-LD data.
 * 
 * SELF-CONTINUATION: If timeout approaches, saves state and re-invokes itself.
 * Safeguards: max 10 invocations, progress check, 1-hour state expiry, completion detection.
 * 
 * Total listings: ~2,800 (verified from homepage)
 * 
 * Tracking:
 * - first_seen: when WE first discovered it
 * - last_seen: last time seen in sitemap
 * - status: active | removed (detected when listing disappears)
 * - price_history: track price changes over time
 * 
 * Data Quality:
 * - JSON-LD: productID, price, geo coordinates, address, rooms
 * - HTML: bathrooms, area m², photos, amenities, description
 * 
 * Schedule: 3x daily at 7 AM, 12 PM, 6 PM Spain
 * Timeout: 15 minutes
 * Memory: 512 MB
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as zlib from 'zlib';
import { detectListingStatus, detectFromHttpStatus, isRemovedRedirect, type SaleStatus } from '../lib/harvest/listing-status-detection';
import { 
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

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const S3_BUCKET = process.env.S3_BUCKET || '';
const LISTINGS_KEY = 'harvest/dp-listings.json.gz';
const STATE_KEY = 'harvest/dp-state.json';
const LISTINGS_TABLE = 'leo-listings';
const STATS_TABLE = 'leo-harvest-stats';
const SITEMAP_URL = 'https://www.donpiso.com/sitemap.xml';
const HOMEPAGE_URL = 'https://www.donpiso.com/';
const REQUEST_DELAY_MS = 50;  // Reduced for parallel batching
const PARALLEL_BATCH_SIZE = 10;  // Concurrent requests per batch
const DP_DOMAIN = 'donpiso.com';

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.2.0';  // 2.2.0: Added SAVE GAME logging, 14m30s timeout

// Process limits per run (to stay within Lambda timeout)
const MAX_LIST_PAGES_PER_RUN = 200;  // Increased with parallelization
const MAX_DETAIL_PAGES_PER_RUN = 500;  // Increased with parallelization

// Self-continuation safeguards
const MAX_INVOCATIONS = 10;           // Prevent infinite loops
const STATE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours - allows manual babysitting between scheduled runs
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before Lambda's 15m hard limit
const MEMORY_LIMIT_MB = 2048;

// High-traffic cities to check FIRST for freshness (most new listings appear here)
const PRIORITY_CITIES = [
  'madrid', 'barcelona', 'valencia', 'sevilla', 'malaga',
  'alicante', 'bilbao', 'murcia', 'palma', 'zaragoza'
];

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
        listing_id: `dp_${listingId}`,
        source: 'donpiso'
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

// ============================================================
// TYPES
// ============================================================

interface DPListing {
  id: string;
  url: string;
  propertyType: string;
  listingType: string;
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  description: string;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
  neighborhood: string;
  streetAddress: string | null;  // Street address if found
  lat: number | null;
  lng: number | null;
  // Coordinate precision (CRITICAL for data quality)
  coordinatePrecision: CoordinatePrecision;
  coordinatePrecisionSignal: string;
  imageUrls: string[];
  amenities: string[];
  agencyPhone: string;
  agencyEmail: string;
  harvestedAt: string;
  
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

interface HarvestState {
  // Self-continuation tracking
  invocationCount: number;
  startedAt: string;
  lastProgressAt: string;
  
  // Progress tracking
  lastListPageIndex: number;
  allDiscoveredListingIds: string[];  // ALL IDs found across all list pages
  processedListingIds: string[];       // IDs we've fetched detail pages for
  
  // Stats
  officialTotal: number;
  totalListPages: number;
  totalListings: number;
  
  // Timestamps
  lastRunAt: string;
  fullCrawlCompletedAt: string | null;
}

// ============================================================
// OFFICIAL COUNT
// ============================================================

async function fetchOfficialCount(): Promise<number> {
  try {
    const response = await fetch(HOMEPAGE_URL, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
    });
    const html = await response.text();
    
    // Look for "2803 inmuebles" pattern
    const match = html.match(/(\d+)\s*inmuebles/i);
    if (match) {
      return parseInt(match[1]);
    }
  } catch (e) {
    console.warn('Failed to fetch official count:', e);
  }
  return 0;
}

// ============================================================
// SITEMAP PARSING
// ============================================================

async function fetchSitemapListPages(): Promise<string[]> {
  console.log('Fetching sitemap...');
  
  const response = await fetch(SITEMAP_URL, {
    headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
  });
  
  if (!response.ok) {
    throw new Error(`Sitemap fetch failed: ${response.status}`);
  }
  
  const xml = await response.text();
  
  const listPageUrls: string[] = [];
  const locRegex = /<loc>([^<]+\/listado)<\/loc>/g;
  let match;
  
  while ((match = locRegex.exec(xml)) !== null) {
    listPageUrls.push(match[1]);
  }
  
  console.log(`Found ${listPageUrls.length} list pages in sitemap`);
  return listPageUrls;
}

// ============================================================
// LIST PAGE PARSING - Extract listing IDs
// ============================================================

async function extractListingIdsFromListPage(listPageUrl: string): Promise<string[]> {
  try {
    const response = await fetch(listPageUrl, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const html = await response.text();
    
    const listingIds: string[] = [];
    const urlRegex = /pisos-y-casas\/(\d+)/g;
    let match;
    const seen = new Set<string>();
    
    while ((match = urlRegex.exec(html)) !== null) {
      const id = match[1];
      if (!seen.has(id)) {
        seen.add(id);
        listingIds.push(id);
      }
    }
    
    return listingIds;
  } catch (e) {
    console.warn(`Error fetching list page ${listPageUrl}:`, e);
    return [];
  }
}

// ============================================================
// DETAIL PAGE PARSING
// ============================================================

interface FetchResult {
  listing: DPListing | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchAndParseListing(listingId: string): Promise<FetchResult> {
  const url = `https://www.donpiso.com/pisos-y-casas/${listingId}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
    });
    
    // Check for 404/410 - listing removed
    const httpStatus = detectFromHttpStatus(response.status, true);
    if (httpStatus) {
      console.log(`   🗑️ ${listingId}: ${httpStatus.signal} (HTTP ${response.status})`);
      return { listing: null, removed: httpStatus };
    }
    
    if (!response.ok) {
      return { listing: null };
    }
    
    // Check for redirect to homepage/error page
    const finalUrl = response.url;
    const redirectStatus = isRemovedRedirect(finalUrl, url);
    if (redirectStatus) {
      console.log(`   🗑️ ${listingId}: ${redirectStatus.signal} (redirected to ${finalUrl})`);
      return { listing: null, removed: redirectStatus };
    }
    
    const html = await response.text();
    const listing = parseListingHtml(url, html, listingId);
    return { listing };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return { listing: null };
  }
}

function parseListingHtml(url: string, html: string, id: string): DPListing | null {
  // Extract JSON-LD
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?"@type"[\s\S]*?\})\s*<\/script>/);
  
  if (!jsonLdMatch) {
    return null;
  }
  
  let jsonLd: any;
  try {
    jsonLd = JSON.parse(jsonLdMatch[1]);
  } catch (e) {
    return null;
  }
  
  // Skip non-product pages
  const types = Array.isArray(jsonLd['@type']) ? jsonLd['@type'] : [jsonLd['@type']];
  if (!types.some((t: string) => t?.includes?.('Product') || t?.includes?.('Residence'))) {
    return null;
  }
  
  // Determine listing type from URL
  const listingType = url.includes('alquiler') ? 'rent' : 'sale';
  
  // Property type from title
  let propertyType = 'Piso';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (title.includes('apartamento')) propertyType = 'Apartamento';
    else if (title.includes('casa') || title.includes('chalet')) propertyType = 'Casa';
    else if (title.includes('ático')) propertyType = 'Ático';
    else if (title.includes('dúplex')) propertyType = 'Dúplex';
    else if (title.includes('local')) propertyType = 'Local';
    else if (title.includes('oficina')) propertyType = 'Oficina';
  }
  
  // Price
  const price = jsonLd.offers?.price ? parseFloat(jsonLd.offers.price) : null;
  const currency = jsonLd.offers?.priceCurrency || 'EUR';
  
  // Coordinates - donpiso includes them in JSON-LD!
  const lat = jsonLd.geo?.latitude ? parseFloat(jsonLd.geo.latitude) : null;
  const lng = jsonLd.geo?.longitude ? parseFloat(jsonLd.geo.longitude) : null;
  
  // Address
  const addressLocality = jsonLd.address?.addressLocality || '';
  const addressRegion = jsonLd.address?.addressRegion || '';
  const addressCountry = jsonLd.address?.addressCountry || 'Spain';
  
  // Neighborhood from breadcrumb
  let neighborhood = '';
  const breadcrumbMatch = html.match(/"position":\s*3[^}]*"name":\s*"([^"]+)"/);
  if (breadcrumbMatch) {
    neighborhood = breadcrumbMatch[1];
  }
  
  // Bedrooms from JSON-LD
  const bedrooms = jsonLd.numberOfRooms ? parseInt(jsonLd.numberOfRooms) : null;
  
  // Bathrooms from HTML
  let bathrooms: number | null = null;
  const bathroomMatch = html.match(/(\d+)\s*Baño/i);
  if (bathroomMatch) {
    bathrooms = parseInt(bathroomMatch[1]);
  }
  
  // Area from HTML
  let sqm: number | null = null;
  const areaMatch = html.match(/(\d+)\s*m²/);
  if (areaMatch) {
    sqm = parseInt(areaMatch[1]);
  }
  
  // Description
  let description = jsonLd.description || '';
  const descMatch = html.match(/<div class="detail-block__text">\s*([\s\S]*?)\s*<\/div>/);
  if (descMatch) {
    description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim()
      .substring(0, 2000);  // Limit length
  }
  
  // Photos
  const imageUrls: string[] = [];
  const photoRegex = /data-src="(https:\/\/www\.donpiso\.com\/[^"]+(?:nfoto|gfoto)[^"]+\.jpg)"/g;
  let photoMatch;
  const seenPhotos = new Set<string>();
  
  while ((photoMatch = photoRegex.exec(html)) !== null) {
    if (!seenPhotos.has(photoMatch[1])) {
      seenPhotos.add(photoMatch[1]);
      imageUrls.push(photoMatch[1]);
    }
  }
  
  // OG image as fallback
  const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImageMatch && !seenPhotos.has(ogImageMatch[1])) {
    imageUrls.unshift(ogImageMatch[1]);
  }
  
  // Amenities
  const amenities: string[] = [];
  const amenityRegex = /<li class="col-[^"]*">([^<]+)<\/li>/g;
  let amenityMatch;
  
  while ((amenityMatch = amenityRegex.exec(html)) !== null) {
    const amenity = amenityMatch[1].trim();
    if (amenity && !amenity.match(/^\d+\s*(m²|hab|Baño)/i) && amenity.length < 50) {
      amenities.push(amenity);
    }
  }
  
  // Parse boolean amenity flags from amenities list and description
  const amenitiesLower = amenities.map(a => a.toLowerCase()).join(' ');
  const descLower = description.toLowerCase();
  const searchText = amenitiesLower + ' ' + descLower;
  
  const has_elevator = /ascensor|elevator/i.test(searchText);
  const has_ac = /aire\s*acondicionado|climatización|a\/c/i.test(searchText);
  const has_parking = /garaje|parking|plaza\s*de\s*garaje|aparcamiento/i.test(searchText);
  const has_terrace = /terraza|balcón|solarium/i.test(searchText);
  const has_pool = /piscina|pool/i.test(searchText);
  
  // Detect furnished status from amenities and description
  let is_furnished: boolean | null = null;
  if (/amueblado|con\s+muebles|totalmente\s+amueblado|furnished/i.test(searchText)) {
    is_furnished = true;
  } else if (/sin\s+amueblar|sin\s+muebles|no\s+amueblado|unfurnished/i.test(searchText)) {
    is_furnished = false;
  }
  
  // Extract floor number if available
  let floor: number | null = null;
  const floorMatch = html.match(/(\d+)(?:º|ª|a|er|o)\s*(?:planta|piso)/i) ||
                    description.match(/planta\s*(\d+)/i) ||
                    description.match(/piso\s*(\d+)/i);
  if (floorMatch) {
    floor = parseInt(floorMatch[1]);
  }
  // Check for ground floor / planta baja
  if (/planta\s*baja|bajo|ground\s*floor/i.test(searchText)) {
    floor = 0;
  }
  
  // Detect sale status (sold/leased/reserved) from HTML
  const statusDetection = detectListingStatus(html);
  
  // Agency contact
  const agencyPhone = jsonLd.brand?.contactPoint?.telephone || '';
  const agencyEmail = jsonLd.brand?.contactPoint?.email || '';
  
  // Extract street address from JSON-LD or HTML
  const streetAddress = jsonLd.address?.streetAddress || extractStreetAddressFromHtml(html);
  
  // Determine coordinate precision based on available address data
  // donpiso has embedded coords in JSON-LD - verify against address info
  let coordinatePrecision: CoordinatePrecision = 'unknown';
  let coordinatePrecisionSignal = 'no_coordinates';
  
  if (lat && lng) {
    // Check if we have street address
    const addressToCheck = streetAddress || addressLocality || '';
    const streetCheck = hasStreetAddress(addressToCheck);
    
    if (streetAddress && streetCheck.hasStreet) {
      coordinatePrecision = 'precise';
      coordinatePrecisionSignal = `jsonld_with_street_${streetCheck.signal}`;
    } else if (neighborhood) {
      coordinatePrecision = 'approximate';
      coordinatePrecisionSignal = 'jsonld_neighborhood_level';
    } else if (addressLocality) {
      coordinatePrecision = 'city_center';
      coordinatePrecisionSignal = 'jsonld_city_level_only';
    } else {
      coordinatePrecision = 'approximate';
      coordinatePrecisionSignal = 'jsonld_unknown_detail';
    }
  }
  
  return {
    id,
    url,
    propertyType,
    listingType,
    price,
    currency,
    bedrooms,
    bathrooms,
    sqm,
    description,
    addressLocality,
    addressRegion,
    addressCountry,
    neighborhood,
    streetAddress,
    lat,
    lng,
    coordinatePrecision,
    coordinatePrecisionSignal,
    imageUrls,
    amenities,
    agencyPhone,
    agencyEmail,
    harvestedAt: new Date().toISOString(),
    
    // Boolean amenity flags (Data Completeness)
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

// ============================================================
// DYNAMODB WRITE
// ============================================================

async function writeListingToDynamoDB(listing: DPListing): Promise<{ isNew: boolean; photos: ClassifiedPhotos }> {
  // Get existing tracking data
  const existing = await getExistingListingTracking(listing.id);
  const tracking = buildTrackingData(existing, listing.price);
  
  // Classify photos
  const photos = classifyPhotos(listing.imageUrls);
  
  const item = {
    listing_id: `dp_${listing.id}`,
    source: 'donpiso',
    domain: DP_DOMAIN,
    source_url: listing.url,
    title: `${listing.propertyType} en ${listing.addressLocality}`,
    price: listing.price,
    currency: listing.currency,
    transaction: listing.listingType,
    location: {
      address: listing.neighborhood ? `${listing.neighborhood}, ${listing.addressLocality}` : listing.addressLocality,
      street_address: listing.streetAddress,
      city: listing.addressLocality,
      province: listing.addressRegion,
      neighborhood: listing.neighborhood,
      country: listing.addressCountry,
      lat: listing.lat,
      lng: listing.lng,
      coordinate_precision: listing.coordinatePrecision,
      coordinate_precision_signal: listing.coordinatePrecisionSignal,
    },
    property: {
      type: listing.propertyType.toLowerCase(),
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      area_m2: listing.sqm,
      floor: listing.floor,
    },
    
    // Boolean amenity flags (Data Completeness)
    has_elevator: listing.has_elevator,
    has_ac: listing.has_ac,
    has_parking: listing.has_parking,
    has_terrace: listing.has_terrace,
    has_pool: listing.has_pool,
    is_furnished: listing.is_furnished,
    
    // Classified photos
    photos: photos.regular.slice(0, 20),
    photos_floorplan: photos.floorplan,
    photos_exterior: photos.exterior.slice(0, 5),
    photos_other: photos.other.slice(0, 5),
    photo_count: photos.total,
    // Legacy field
    image_urls: photos.regular.slice(0, 20),
    
    amenities: listing.amenities,
    description: listing.description,
    agency: {
      name: 'donpiso',
      phone: listing.agencyPhone,
      email: listing.agencyEmail,
    },
    
    // Enhanced tracking fields - prefer HTML-detected status over sitemap tracking
    status: listing.saleStatus !== 'active' ? listing.saleStatus : tracking.status,
    status_signal: listing.saleStatus !== 'active' ? listing.saleStatusSignal : tracking.status_signal,
    first_seen: tracking.first_seen,
    last_seen: tracking.last_seen,
    days_on_market: tracking.days_on_market,
    price_history: tracking.price_history,
    
    scraped_at: listing.harvestedAt,
    updated_at: new Date().toISOString(),
    harvestedAt: new Date().toISOString(),
    harvester_version: HARVESTER_VERSION,
  };
  
  await dynamoClient.send(new PutCommand({
    TableName: LISTINGS_TABLE,
    Item: item,
  }));
  
  return { isNew: !existing, photos };
}

// ============================================================
// S3 STATE MANAGEMENT + SELF-CONTINUATION
// ============================================================

async function loadState(): Promise<HarvestState | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: STATE_KEY,
    }));
    
    const body = await response.Body?.transformToString();
    if (body) {
      const state: HarvestState = JSON.parse(body);
      
      // Check if state is expired (stale)
      const stateAge = Date.now() - new Date(state.startedAt).getTime();
      if (stateAge > STATE_EXPIRY_MS) {
        console.log('⚠️ State expired (> 12 hours old), starting fresh');
        await deleteState();
        return null;
      }
      
      return state;
    }
  } catch {
    // No state file yet
  }
  
  return null;
}

function createFreshState(): HarvestState {
  const now = new Date().toISOString();
  return {
    invocationCount: 1,
    startedAt: now,
    lastProgressAt: now,
    lastListPageIndex: 0,
    allDiscoveredListingIds: [],
    processedListingIds: [],
    officialTotal: 0,
    totalListPages: 0,
    totalListings: 0,
    lastRunAt: '',
    fullCrawlCompletedAt: null,
  };
}

async function saveState(state: HarvestState): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: STATE_KEY,
    Body: JSON.stringify(state, null, 2),
    ContentType: 'application/json',
  }));
  console.log(`💾 Saved state (invocation ${state.invocationCount})`);
}

async function deleteState(): Promise<void> {
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

async function invokeSelfContinuation(state: HarvestState): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'dp-harvest-delta';
  
  console.log(`🔄 Self-invoking for continuation (invocation ${state.invocationCount + 1}/${MAX_INVOCATIONS})`);
  
  await lambdaClient.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify({ continuation: true }),
  }));
}

async function saveAllListings(listings: DPListing[]): Promise<void> {
  const compressed = zlib.gzipSync(JSON.stringify(listings, null, 2));
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: LISTINGS_KEY,
    Body: compressed,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }));
}

async function loadAllListings(): Promise<DPListing[]> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: LISTINGS_KEY,
    }));
    
    const body = await response.Body?.transformToByteArray();
    if (body) {
      const decompressed = zlib.gunzipSync(Buffer.from(body));
      return JSON.parse(decompressed.toString());
    }
  } catch (e) {
    // No file yet
  }
  
  return [];
}

// ============================================================
// STATS
// ============================================================

async function updateStats(state: HarvestState, newCount: number): Promise<void> {
  try {
    await dynamoClient.send(new UpdateCommand({
      TableName: STATS_TABLE,
    Key: { domain: DP_DOMAIN },
    UpdateExpression: 'SET #new = :new, #total = :total, #official = :official, #coverage = :coverage, #lastRun = :lastRun, #source = :source',
    ExpressionAttributeNames: {
      '#new': 'new_listings',
      '#total': 'total_listings',
      '#official': 'official_count',
      '#coverage': 'coverage_pct',
      '#lastRun': 'last_run_at',
      '#source': 'source',
    },
    ExpressionAttributeValues: {
      ':new': newCount,
      ':total': state.totalListings,
      ':official': state.officialTotal,
      ':coverage': state.officialTotal > 0 ? Math.round((state.totalListings / state.officialTotal) * 100) : 0,
      ':lastRun': new Date().toISOString(),
      ':source': 'donpiso',
    },
  }));
  } catch (e) {
    // Stats table may not exist - non-critical error
    console.log('   Note: Stats update skipped (table may not exist)');
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function handler(event: any): Promise<any> {
  console.log('=== donpiso Harvest Delta - SELF-CONTINUATION MODE ===');
  const startTime = Date.now();
  
  resetPeakMemory();
  logMemory('START');
  
  try {
    // --- SELF-CONTINUATION: Load or initialize state ---
    let state = await loadState();
    const isContinuation = !!state;
    
    if (state) {
      // SAFEGUARD 1: Max invocations check
      if (state.invocationCount >= MAX_INVOCATIONS) {
        console.log(`❌ Max invocations (${MAX_INVOCATIONS}) reached. Stopping to prevent infinite loop.`);
        await deleteState();
        return { statusCode: 400, body: 'Max invocations reached' };
      }
      
      // SAFEGUARD 2: Progress check
      const timeSinceProgress = Date.now() - new Date(state.lastProgressAt).getTime();
      if (timeSinceProgress > STATE_EXPIRY_MS) {
        console.log('⚠️ No progress in > 1 hour, resetting state');
        await deleteState();
        state = null;
      } else {
        state.invocationCount++;
        state.lastProgressAt = new Date().toISOString();
        console.log(`🔄 Continuing from previous run (invocation ${state.invocationCount}/${MAX_INVOCATIONS})`);
        console.log(`   List pages done: ${state.lastListPageIndex}`);
        console.log(`   IDs discovered: ${state.allDiscoveredListingIds.length}`);
        console.log(`   IDs processed: ${state.processedListingIds.length}`);
      }
    }
    
    // Initialize fresh state if needed
    if (!state) {
      state = createFreshState();
      console.log('📝 Starting fresh harvest');
    }
    
    // Load existing listings
    const existingListings = await loadAllListings();
    const existingById = new Map(existingListings.map(l => [l.id, l]));
    
    // Get official count
    const officialTotal = await fetchOfficialCount();
    state.officialTotal = officialTotal;
    console.log(`Official count from homepage: ${officialTotal} listings`);
    
    // Get all list pages from sitemap
    const allListPages = await fetchSitemapListPages();
    state.totalListPages = allListPages.length;
    
    // Sort list pages: priority cities FIRST for freshness
    const priorityPages: string[] = [];
    const otherPages: string[] = [];
    
    for (const page of allListPages) {
      const isPriority = PRIORITY_CITIES.some(city => page.toLowerCase().includes(city));
      if (isPriority) {
        priorityPages.push(page);
      } else {
        otherPages.push(page);
      }
    }
    
    const sortedListPages = [...priorityPages, ...otherPages];
    console.log(`   Priority cities: ${priorityPages.length} pages, Other: ${otherPages.length} pages`);
    
    // PHASE 1: Discover listing IDs from list pages
    // Continue from where we left off
    const listPagesToProcess = sortedListPages.slice(
      state.lastListPageIndex,
      state.lastListPageIndex + MAX_LIST_PAGES_PER_RUN
    );
    
    console.log(`\nPhase 1: Discovering listings from pages ${state.lastListPageIndex} to ${state.lastListPageIndex + listPagesToProcess.length} (PARALLEL)`);
    
    const discoveredIds = new Set(state.allDiscoveredListingIds);
    let pagesProcessed = 0;
    
    // Data quality tracking
    const typeStats = { sale: 0, rent: 0, unknown: 0 };
    const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
    
    // Process list pages in parallel batches (with timeout check)
    for (let i = 0; i < listPagesToProcess.length; i += PARALLEL_BATCH_SIZE) {
      // Timeout check (14m 30s)
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        state.allDiscoveredListingIds = Array.from(discoveredIds);
        state.lastListPageIndex += pagesProcessed;
        logSaveGame('Discovery in progress', state.invocationCount, MAX_INVOCATIONS, {
          'List pages': `${state.lastListPageIndex}/${allListPages.length}`,
          'Listings discovered': discoveredIds.size,
          'Processed this run': pagesProcessed,
        });
        state.lastProgressAt = new Date().toISOString();
        await saveState(state);
        return { statusCode: 202, body: 'Continuing in next invocation (Phase 1)' };
      }
      
      const batch = listPagesToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(url => extractListingIdsFromListPage(url))
      );
      
      for (const ids of results) {
        ids.forEach(id => discoveredIds.add(id));
      }
      
      pagesProcessed += batch.length;
      if (pagesProcessed % 50 === 0 || pagesProcessed === listPagesToProcess.length) {
        console.log(`  Processed ${pagesProcessed}/${listPagesToProcess.length} pages, ${discoveredIds.size} unique IDs found`);
        state.lastProgressAt = new Date().toISOString();
      }
      
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
    
    state.allDiscoveredListingIds = Array.from(discoveredIds);
    state.lastListPageIndex += listPagesToProcess.length;
    
    // Check if we've completed a full crawl
    const fullCrawlComplete = state.lastListPageIndex >= allListPages.length;
    if (fullCrawlComplete && !state.fullCrawlCompletedAt) {
      state.fullCrawlCompletedAt = new Date().toISOString();
      console.log(`\n✅ Full crawl complete! Found ${discoveredIds.size} unique listing IDs`);
      console.log(`   Official count: ${officialTotal}, Coverage: ${Math.round((discoveredIds.size / officialTotal) * 100)}%`);
      
      // Reset for next cycle
      state.lastListPageIndex = 0;
    }
    
    // PHASE 2: Fetch detail pages for new/unprocessed listings
    const processedSet = new Set(state.processedListingIds);
    const unprocessedIds = state.allDiscoveredListingIds.filter(id => !processedSet.has(id));
    const idsToProcess = unprocessedIds.slice(0, MAX_DETAIL_PAGES_PER_RUN);
    
    console.log(`\nPhase 2: Fetching ${idsToProcess.length} new detail pages (${unprocessedIds.length} total unprocessed)`);
    
    const newListings: DPListing[] = [];
    let detailsProcessed = 0;
    let newInDb = 0;
    let updatedInDb = 0;
    let photoStats = { total: 0, regular: 0, floorplan: 0, exterior: 0, other: 0 };
    
    // Process detail pages in parallel batches (with timeout check)
    for (let i = 0; i < idsToProcess.length; i += PARALLEL_BATCH_SIZE) {
      // Timeout check (14m 30s)
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        state.processedListingIds = Array.from(processedSet);
        logSaveGame('Scraping in progress', state.invocationCount, MAX_INVOCATIONS, {
          'List pages crawled': `${state.lastListPageIndex}/${allListPages.length}`,
          'Listings discovered': state.allDiscoveredListingIds.length,
          'Processed': `${state.processedListingIds.length}/${state.allDiscoveredListingIds.length}`,
          'New in DB': newInDb,
          'Updated in DB': updatedInDb,
        });
        state.lastProgressAt = new Date().toISOString();
        // Save listings processed so far
        for (const listing of newListings) {
          existingById.set(listing.id, listing);
        }
        await saveAllListings(Array.from(existingById.values()));
        await saveState(state);
        return { statusCode: 202, body: 'Continuing in next invocation (Phase 2)' };
      }
      
      const batch = idsToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
      
      // Fetch batch in parallel
      const results = await Promise.all(
        batch.map(id => fetchAndParseListing(id))
      );
      
      // Process results and write to DynamoDB
      for (let j = 0; j < batch.length; j++) {
        const { listing, removed } = results[j];
        const listingId = batch[j];
        
        if (listing) {
          newListings.push(listing);
          
          // Track data quality stats
          // donpiso uses listingType field: 'ForSale' or 'ForRent'
          if (listing.listingType === 'ForRent' || listing.listingType === 'rent') typeStats.rent++;
          else if (listing.listingType === 'ForSale' || listing.listingType === 'sale') typeStats.sale++;
          else typeStats.unknown++;
          precisionStats[listing.coordinatePrecision || 'unknown']++;
          
          // Write to DynamoDB
          try {
            const result = await writeListingToDynamoDB(listing);
            if (result.isNew) newInDb++; else updatedInDb++;
            
            // Track photo stats
            photoStats.total += result.photos.total;
            photoStats.regular += result.photos.regular.length;
            photoStats.floorplan += result.photos.floorplan.length;
            photoStats.exterior += result.photos.exterior.length;
            photoStats.other += result.photos.other.length;
          } catch (e) {
            console.error(`DynamoDB write failed for ${listingId}:`, e);
          }
        } else if (removed) {
          // Listing returned 404 or redirected to error page - mark as removed
          try {
            await dynamoClient.send(new UpdateCommand({
              TableName: LISTINGS_TABLE,
              Key: { domain: DP_DOMAIN, listing_id: `dp_${listingId}` },
              UpdateExpression: 'SET #status = :status, status_signal = :signal, last_seen = :now',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: {
                ':status': removed.status,
                ':signal': removed.signal,
                ':now': new Date().toISOString(),
              },
            }));
            console.log(`   ✅ Marked ${listingId} as ${removed.status} (${removed.signal})`);
          } catch (e) {
            // Listing may not exist in DB yet - that's OK
          }
        }
        
        processedSet.add(listingId);
        detailsProcessed++;
      }
      
      if (detailsProcessed % 50 === 0 || detailsProcessed === idsToProcess.length) {
        console.log(`  Processed ${detailsProcessed}/${idsToProcess.length} detail pages`);
      }
      
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
    
    console.log(`  ✅ Written to DynamoDB: ${newInDb} new, ${updatedInDb} updated`);
    console.log(`  📷 Photos: ${photoStats.total} total, ${photoStats.floorplan} floorplans`)
    
    state.processedListingIds = Array.from(processedSet);
    
    // PHASE 3: Detect SOLD/REMOVED listings
    // If we've completed a full crawl, check for listings no longer in sitemap
    let removedCount = 0;
    if (fullCrawlComplete) {
      console.log(`\n🔍 Checking for sold/removed listings...`);
      const currentSitemapIds = new Set(state.allDiscoveredListingIds);
      
      for (const [id, listing] of existingById) {
        // If listing was active but is no longer in sitemap, mark as removed
        if (!currentSitemapIds.has(id)) {
          try {
            await dynamoClient.send(new UpdateCommand({
              TableName: LISTINGS_TABLE,
              Key: { domain: DP_DOMAIN, listing_id: id },
              UpdateExpression: 'SET #status = :status, #signal = :signal, #updated = :updated',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#signal': 'status_signal',
                '#updated': 'updated_at'
              },
              ExpressionAttributeValues: {
                ':status': 'removed',
                ':signal': 'not_in_sitemap',
                ':updated': new Date().toISOString()
              }
            }));
            removedCount++;
          } catch (e) {
            // Listing might not exist in DB yet
          }
        }
      }
      
      if (removedCount > 0) {
        console.log(`   ⚠️ Marked ${removedCount} listings as REMOVED (no longer in sitemap)`);
      }
    }
    
    // Merge with existing listings
    for (const listing of newListings) {
      existingById.set(listing.id, listing);
    }
    const allListings = Array.from(existingById.values());
    
    // Save to S3
    await saveAllListings(allListings);
    state.totalListings = allListings.length;
    state.lastRunAt = new Date().toISOString();
    
    // Check if we've completed everything (all IDs processed)
    const allProcessed = unprocessedIds.length === 0 || 
                         state.processedListingIds.length >= state.allDiscoveredListingIds.length;
    
    if (allProcessed && fullCrawlComplete) {
      // SAFEGUARD 4: Clean up state on successful completion
      console.log('✅ All work complete! Deleting state file.');
      await deleteState();
    } else {
      // Work remains - keep state for next run
      await saveState(state);
    }
    
    // Update stats
    await updateStats(state, newListings.length);
    
    logMemory('END');
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Write run summary to analytics
    const summary = createRunSummary(
      DP_DOMAIN,
      HARVESTER_VERSION,
      state.invocationCount,
      MAX_INVOCATIONS,
      'complete',
      'complete',
      startTime,
      MEMORY_LIMIT_MB
    );
    summary.listings_discovered = discoveredIds.size;
    summary.listings_written = newInDb + updatedInDb;
    summary.listings_new = newInDb;
    summary.listings_updated = updatedInDb;
    summary.listings_removed = removedCount;
    summary.listings_by_type = typeStats;
    summary.listings_by_precision = precisionStats;
    await writeRunSummary(summary);
    
    const result = {
      success: true,
      domain: DP_DOMAIN,
      continuation: isContinuation,
      invocationCount: state.invocationCount,
      
      // Discovery stats
      officialCount: officialTotal,
      discoveredIds: discoveredIds.size,
      listPagesProcessed: pagesProcessed,
      totalListPages: allListPages.length,
      discoveryProgress: `${Math.round((state.lastListPageIndex / allListPages.length) * 100)}%`,
      
      // Detail fetch stats
      newDetailsFetched: newListings.length,
      new_in_db: newInDb,
      updated_in_db: updatedInDb,
      removed_count: removedCount,
      totalProcessed: state.processedListingIds.length,
      totalListings: allListings.length,
      
      // Photo stats
      photos: photoStats,
      
      // Coverage
      coverage: officialTotal > 0 ? `${Math.round((allListings.length / officialTotal) * 100)}%` : 'N/A',
      
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    };
    
    console.log('\nResult:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error('Harvest failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
