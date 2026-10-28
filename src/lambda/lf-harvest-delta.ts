/**
 * Lucas Fox Delta Harvest Lambda (PARALLELIZED + SELF-CONTINUATION)
 * 
 * GUARANTEED LATEST:
 * 1. First fetches ?sort=newest search pages (sitemap can be stale!)
 * 2. Then combines with sitemap for complete coverage (~4,800 URLs)
 * 3. Processes newest listings FIRST
 * 
 * PARALLELIZED: 10 concurrent requests per batch for speed.
 * NOMINATIM: Handles compound localities like "El Campello | Villajoyosa"
 * 
 * SELF-CONTINUATION: If timeout approaches, saves state and re-invokes itself.
 * Safeguards: max 10 invocations, progress check, 1-hour state expiry, completion detection.
 * 
 * Schedule: 3x daily at 7 AM, 12 PM, 6 PM Spain
 *   - cron(0 6 * * ? *)   = 7 AM Spain
 *   - cron(0 11 * * ? *)  = 12 PM Spain
 *   - cron(0 17 * * ? *)  = 6 PM Spain
 * 
 * Timeout: 15 minutes
 * Memory: 512 MB
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as zlib from 'zlib';
import { detectFromHttpStatus, isRemovedRedirect, type SaleStatus } from '../lib/harvest/listing-status-detection';
import { 
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

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const S3_BUCKET = process.env.S3_BUCKET || '';
const LISTINGS_KEY = 'harvest/lf-listings.json.gz';
const STATE_KEY = 'harvest/lf-harvest-state.json';  // Self-continuation state
const LISTINGS_TABLE = 'leo-listings';
const STATS_TABLE = 'leo-harvest-stats';
const SITEMAP_URL = 'https://www.lucasfox.com/sitemap.xml';
// NOTE: Lucas Fox uses /rent-property/ NOT /property-to-rent/
const NEWEST_SEARCH_URLS = [
  'https://www.lucasfox.com/property-for-sale/spain.html?sort=newest',
  'https://www.lucasfox.com/rent-property/spain.html?sort=newest',  // Fixed: was /property-to-rent/
];
const REQUEST_DELAY_MS = 100;  // Reduced for parallel batching
const PARALLEL_BATCH_SIZE = 10;  // Concurrent requests per batch
const LF_DOMAIN = 'lucasfox.com';
const NOMINATIM_URL = process.env.NOMINATIM_URL || '';

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.2.0';  // 2.2.0: Added SAVE GAME logging, 14m30s timeout

// Self-continuation safeguards
const MAX_INVOCATIONS = 10;           // Prevent infinite loops
const STATE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours - allows manual babysitting between scheduled runs
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before Lambda's 15m hard limit
const MEMORY_LIMIT_MB = 2048;

// Self-continuation state interface
interface HarvestState {
  invocationCount: number;
  startedAt: string;
  lastProgressAt: string;
  phase: 'scraping' | 'geocoding' | 'complete';
  scrapedUrls: string[];
  geocodedIds: string[];
  allUrls: string[];  // All URLs to process
  totalNewFound: number;
  listingsToGeocode?: LFListing[];  // Preserve listings across invocations for geocoding
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
  publication_date: string | null;
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
        domain: LF_DOMAIN,
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
    publication_date: null,
    price_history
  };
}

// ============================================================
// TYPES
// ============================================================

interface LFListing {
  id: string;              // BCN64665
  url: string;
  propertyType: string;    // Apartment, House, etc.
  listingType: string;     // res_sale, res_rent
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  description: string;
  
  // Location - raw from page
  addressLocality: string;  // Eixample Right (neighborhood)
  addressRegion: string;    // Barcelona (city)
  addressCountry: string;   // Spain
  postalCode: string;
  locationPath: string;     // spain/barcelona/bcn-city/eix-right
  streetAddress: string | null;  // Street address if found
  
  // Coordinates (verified via Nominatim)
  lat: number | null;
  lng: number | null;
  coordinatePrecision: CoordinatePrecision;      // 'precise' | 'approximate' | 'city_center' | 'unknown'
  coordinatePrecisionSignal: string;              // Why we determined this precision
  
  // Verified address components (from Nominatim)
  verifiedAddress: AddressComponents | null;
  
  // Images
  imageUrls: string[];
  
  // Amenities (extracted from meta description)
  amenities: string[];
  
  // Agency
  officeReference: string;  // bcn
  agentPhone: string | null;   // From JSON-LD potentialAction.agent.telephone
  agentEmail: string | null;   // From JSON-LD (operator@example.invalid)
  
  // Sale status - detected from HTML content
  saleStatus: 'active' | 'sold' | 'leased' | 'reserved';
  saleStatusSignal: string;  // What triggered the status (e.g., "html_sold_badge")
  
  // Meta
  harvestedAt: string;
  geocodedAt?: string;
}

// ============================================================
// NOMINATIM GEOCODING
// ============================================================

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    neighbourhood?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
  };
}

// NOTE: Canary Islands will return WRONG coords from Nominatim (mainland Spain cities).
// This is a known limitation - see P0-14-HARVESTING.md for TODO.

async function geocodeAddress(locality: string, region: string, country: string = 'Spain'): Promise<{ lat: number; lng: number } | null> {
  // Handle compound localities like "El Campello | Villajoyosa"
  const localities = locality.split(/[|\/]/).map(s => s.trim()).filter(Boolean);
  
  // Build multiple query attempts
  const queries: string[] = [];
  
  // Try first part of compound locality
  if (localities.length > 0) {
    queries.push([localities[0], region, country].filter(Boolean).join(', '));
  }
  
  // Try full locality
  if (localities.length > 1) {
    queries.push([locality.replace(/[|\/]/g, ','), region, country].filter(Boolean).join(', '));
  }
  
  // Try just region + country as fallback
  if (region) {
    queries.push([region, country].filter(Boolean).join(', '));
  }
  
  for (const query of queries) {
    if (!query || query.length < 3) continue;
    
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '1',
        countrycodes: 'es,pt,fr,ad',  // Spain + neighbors
      });
      
      const response = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
        headers: { 'User-Agent': 'PuedoCasa/1.0 (property search)' },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) continue;
      
      const results: NominatimResult[] = await response.json();
      
      if (results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
        };
      }
    } catch (error) {
      // Try next query
      continue;
    }
  }
  
  return null;
}

// ============================================================
// SITEMAP PARSING
// ============================================================

// Fetch NEWEST listings from search pages (sitemap can be stale!)
async function fetchNewestFromSearch(): Promise<string[]> {
  console.log('🆕 Fetching NEWEST listings from search pages...');
  
  const allUrls: string[] = [];
  
  for (const searchUrl of NEWEST_SEARCH_URLS) {
    try {
      const response = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        console.log(`   ⚠️ HTTP ${response.status} for ${searchUrl}`);
        continue;
      }
      
      const html = await response.text();
      
      // Extract property URLs (handles both absolute and relative URLs)
      // Patterns: /property-for-sale/.../xxx12345.html OR /rent-property/.../xxx12345.html
      // NOTE: Lucas Fox uses /rent-property/ NOT /property-to-rent/
      const urlMatches = html.matchAll(/href="((?:https:\/\/www\.lucasfox\.com)?\/(?:property-for-sale|rent-property)\/[^"]+\/[a-z]{2,4}\d{4,6}\.html)"/gi);
      
      for (const match of urlMatches) {
        let url = match[1];
        // Ensure absolute URL
        if (url.startsWith('/')) {
          url = 'https://www.lucasfox.com' + url;
        }
        if (!allUrls.includes(url)) {
          allUrls.push(url);
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Failed to fetch ${searchUrl}`);
    }
  }
  
  console.log(`   Found ${allUrls.length} URLs from newest search pages`);
  return allUrls;
}

async function fetchSitemap(): Promise<string[]> {
  console.log('📥 Fetching Lucas Fox sitemap...');
  
  const response = await fetch(SITEMAP_URL, {
    headers: {
      'User-Agent': 'PuedoCasa/1.0 (+https://leo.casa)',
    },
    signal: AbortSignal.timeout(60000),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }
  
  const xml = await response.text();
  
  // Extract property URLs (pattern: /property-for-sale/.../{id}.html or /rent-property/.../{id}.html)
  // NOTE: Lucas Fox uses /rent-property/ NOT /property-to-rent/
  const propertyUrls: string[] = [];
  const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
  
  for (const match of locMatches) {
    const url = match[1].trim();
    // Property URLs have an ID like bcn64665.html at the end
    if ((url.includes('/property-for-sale/') || url.includes('/rent-property/')) && 
        /\/[a-z]{2,4}\d{4,6}\.html$/.test(url)) {
      propertyUrls.push(url);
    }
  }
  
  console.log(`   Found ${propertyUrls.length} property URLs in sitemap`);
  return propertyUrls;
}

// ============================================================
// DETAIL PAGE PARSING
// ============================================================

interface FetchDetailResult {
  listing: LFListing | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchAndParseDetailPage(url: string): Promise<FetchDetailResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(30000),
    });
    
    // Check for 404/410 - listing removed
    const httpStatus = detectFromHttpStatus(response.status, true);
    if (httpStatus) {
      console.log(`   🗑️ ${url}: ${httpStatus.signal} (HTTP ${response.status})`);
      return { listing: null, removed: httpStatus };
    }
    
    if (!response.ok) return { listing: null };
    
    // Check for redirect to homepage/error page
    const finalUrl = response.url;
    const redirectStatus = isRemovedRedirect(finalUrl, url);
    if (redirectStatus) {
      console.log(`   🗑️ ${url}: ${redirectStatus.signal} (redirected)`);
      return { listing: null, removed: redirectStatus };
    }
    
    const html = await response.text();
    return { listing: parseDetailPage(url, html) };
  } catch {
    return { listing: null };
  }
}

function parseDetailPage(url: string, html: string): LFListing | null {
  const now = new Date().toISOString();
  
  // DETECT SOLD/LEASED STATUS from HTML content
  // We still harvest these, but mark them with proper status for filtering
  let saleStatus: 'active' | 'sold' | 'leased' | 'reserved' = 'active';
  let saleStatusSignal = 'in_sitemap';
  
  // English patterns (Lucas Fox uses English)
  const soldPatterns: Array<{ pattern: RegExp; status: 'sold' | 'leased' | 'reserved'; signal: string }> = [
    { pattern: /\b(apartment|house|villa|penthouse|property)\s+sold\b/i, status: 'sold', signal: 'html_property_sold' },
    { pattern: /<span[^>]*>\s*Sold\s*<\/span>/i, status: 'sold', signal: 'html_sold_badge' },
    { pattern: /\bsold\s*<\/span>/i, status: 'sold', signal: 'html_sold_span' },
    { pattern: /\b(apartment|house|villa|penthouse|property)\s+leased\b/i, status: 'leased', signal: 'html_property_leased' },
    { pattern: /<span[^>]*>\s*Leased\s*<\/span>/i, status: 'leased', signal: 'html_leased_badge' },
    { pattern: /\bleased\s*<\/span>/i, status: 'leased', signal: 'html_leased_span' },
    { pattern: /\brented\s*<\/span>/i, status: 'leased', signal: 'html_rented_span' },
    { pattern: /<span[^>]*>\s*Reserved\s*<\/span>/i, status: 'reserved', signal: 'html_reserved_badge' },
    { pattern: /\breserved\s*<\/span>/i, status: 'reserved', signal: 'html_reserved_span' },
    // Spanish patterns (in case they switch languages)
    { pattern: /\bvendido\s*<\/span>/i, status: 'sold', signal: 'html_vendido_span' },
    { pattern: /\balquilado\s*<\/span>/i, status: 'leased', signal: 'html_alquilado_span' },
    { pattern: /\breservado\s*<\/span>/i, status: 'reserved', signal: 'html_reservado_span' },
  ];
  
  for (const { pattern, status, signal } of soldPatterns) {
    if (pattern.test(html)) {
      saleStatus = status;
      saleStatusSignal = signal;
      break;  // Use first match
    }
  }
  
  // Extract JSON-LD (skip BreadcrumbList, get the property one)
  const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/gi);
  let propertyData: any = null;
  
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] && data['@type'] !== 'BreadcrumbList') {
        propertyData = data;
        break;
      }
    } catch {
      continue;
    }
  }
  
  if (!propertyData) return null;
  
  // Extract GTM dataLayer
  const dataLayerMatch = html.match(/dataLayer\s*=\s*\[\s*({[^}]+})\s*\]/);
  let gtmData: any = {};
  if (dataLayerMatch) {
    try {
      gtmData = JSON.parse(dataLayerMatch[1]);
    } catch {
      // Continue without GTM data
    }
  }
  
  // Extract amenities from meta description
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  const amenities: string[] = [];
  if (metaDescMatch) {
    const desc = metaDescMatch[1].toLowerCase();
    const amenityKeywords = [
      'terrace', 'garden', 'pool', 'swimming pool', 'lift', 'elevator', 
      'parking', 'garage', 'balcony', 'air conditioning', 'heating',
      'sea view', 'mountain view', 'furnished', 'wooden flooring',
      'high ceilings', 'natural light', 'modernist'
    ];
    for (const keyword of amenityKeywords) {
      if (desc.includes(keyword)) {
        amenities.push(keyword);
      }
    }
  }
  
  // Parse sqm from "200 MTK" format
  let sqm: number | null = null;
  if (propertyData.floorSize) {
    const sqmMatch = propertyData.floorSize.match(/(\d+)/);
    if (sqmMatch) sqm = parseInt(sqmMatch[1], 10);
  }
  
  // Extract ID from URL (e.g., bcn64665 from the path)
  const idMatch = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
  const id = idMatch ? idMatch[1].toUpperCase() : propertyData.identifier || '';
  
  // Determine listing type from URL (Lucas Fox uses /rent-property/ for rentals)
  const isRental = url.includes('/rent-property/');
  const listingType = gtmData.property_class || (isRental ? 'res_rent' : 'res_sale');
  
  // Extract price - handle "Price on request" cases
  let price: number | null = null;
  if (propertyData.potentialAction?.price) {
    const priceValue = propertyData.potentialAction.price;
    if (typeof priceValue === 'number') {
      price = priceValue;
    } else if (typeof priceValue === 'string') {
      const numericPrice = parseFloat(priceValue.replace(/[^0-9.]/g, ''));
      if (!isNaN(numericPrice) && numericPrice > 0) {
        price = numericPrice;
      }
    }
  }
  
  // Extract street address - try JSON-LD first, then HTML patterns
  let streetAddress: string | null = propertyData.address?.streetAddress || null;
  if (!streetAddress) {
    streetAddress = extractStreetAddressFromHtml(html);
  }
  
  // Extract better neighborhood from HTML if JSON-LD has only city-level
  const addressLocality = propertyData.address?.addressLocality || '';
  let neighborhood: string | null = addressLocality;
  const htmlNeighborhood = extractNeighborhoodFromHtml(html);
  if (htmlNeighborhood && htmlNeighborhood !== addressLocality) {
    neighborhood = htmlNeighborhood;
  }
  
  return {
    id,
    url,
    propertyType: propertyData['@type'] || gtmData.property_type || '',
    listingType,
    price,
    currency: propertyData.potentialAction?.priceCurrency || 'EUR',
    bedrooms: propertyData.numberOfBedrooms ?? null,
    bathrooms: propertyData.numberOfBathroomsTotal ?? null,
    sqm,
    description: propertyData.description || '',
    
    addressLocality: neighborhood || addressLocality,  // Use best neighborhood
    addressRegion: propertyData.address?.addressRegion || '',
    addressCountry: propertyData.address?.addressCountry || 'Spain',
    postalCode: propertyData.address?.postalCode || '',
    locationPath: gtmData.location_path || '',
    streetAddress,  // NEW: Street address if found
    
    // Coordinates will be filled in by verification step
    lat: null,
    lng: null,
    coordinatePrecision: 'unknown' as CoordinatePrecision,
    coordinatePrecisionSignal: 'not_geocoded_yet',
    verifiedAddress: null,
    
    imageUrls: Array.isArray(propertyData.image) ? propertyData.image : [],
    amenities,
    officeReference: gtmData.office_reference || '',
    // Agent contact from JSON-LD potentialAction.agent
    agentPhone: propertyData.potentialAction?.agent?.telephone || null,
    agentEmail: 'operator@example.invalid', // Standard Lucas Fox email
    
    // Sale status detection (from HTML patterns detected above)
    saleStatus,
    saleStatusSignal,
    
    harvestedAt: now,
  };
}

// ============================================================
// S3 OPERATIONS
// ============================================================

// --- SELF-CONTINUATION STATE MANAGEMENT ---

async function loadHarvestState(): Promise<HarvestState | null> {
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
        await deleteHarvestState();
        return null;
      }
      
      return state;
    }
  } catch {
    // No state file exists
  }
  return null;
}

async function saveHarvestState(state: HarvestState): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: STATE_KEY,
    Body: JSON.stringify(state, null, 2),
    ContentType: 'application/json',
  }));
  console.log(`💾 Saved continuation state (invocation ${state.invocationCount}, phase: ${state.phase})`);
}

async function deleteHarvestState(): Promise<void> {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: STATE_KEY,
    }));
    console.log('🗑️ Deleted continuation state (harvest complete)');
  } catch {
    // State file didn't exist
  }
}

async function invokeSelfContinuation(state: HarvestState): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'lf-harvest-delta';
  
  console.log(`🔄 Self-invoking for continuation (invocation ${state.invocationCount + 1}/${MAX_INVOCATIONS})`);
  
  await lambdaClient.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify({ continuation: true }),
  }));
}

// --- END SELF-CONTINUATION ---

async function loadExistingListings(): Promise<Map<string, LFListing>> {
  const listings = new Map<string, LFListing>();

  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: LISTINGS_KEY,
    }));

    const compressed = await response.Body?.transformToByteArray();
    if (compressed) {
      const json = zlib.gunzipSync(Buffer.from(compressed)).toString('utf-8');
      const existingListings: LFListing[] = JSON.parse(json);
      for (const listing of existingListings) {
        listings.set(listing.id, listing);
      }
    }
  } catch {
    console.log('No existing listings file, starting fresh');
  }

  return listings;
}

async function saveListings(listings: Map<string, LFListing>): Promise<void> {
  const array = Array.from(listings.values());
  const json = JSON.stringify(array);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'));

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: LISTINGS_KEY,
    Body: compressed,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Metadata: {
      'listing-count': String(array.length),
      'updated-at': new Date().toISOString(),
    },
  }));
}

// ============================================================
// DYNAMODB - WRITE TO leo-listings FOR RECOMMENDER
// ============================================================

async function writeToLeoListings(listing: LFListing): Promise<{ isNew: boolean; photos: ClassifiedPhotos }> {
  const now = new Date().toISOString();
  
  // Get existing tracking data
  const existing = await getExistingListingTracking(listing.id);
  const tracking = buildTrackingData(existing, listing.price);
  
  // Classify photos
  const photos = classifyPhotos(listing.imageUrls);
  
  const normalizedListing = {
    // Keys
    domain: LF_DOMAIN,
    listing_id: listing.id,
    
    // Core fields
    url: listing.url,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqm: listing.sqm,
    
    // Location (raw from page)
    // CRITICAL: city cannot be empty - DynamoDB GSI requires non-empty string
    // Use || to handle both undefined and empty strings
    city: (listing.verifiedAddress?.city && listing.verifiedAddress.city.trim()) 
          || (listing.addressRegion && listing.addressRegion.trim()) 
          || (listing.addressLocality && listing.addressLocality.trim()) 
          || 'Unknown',
    neighborhood: (listing.verifiedAddress?.neighborhood || listing.addressLocality || '').trim() || null,
    street_address: (listing.verifiedAddress?.streetAddress || listing.streetAddress || '').trim() || null,
    postal_code: (listing.verifiedAddress?.postalCode || listing.postalCode || '').trim() || null,
    province: (listing.verifiedAddress?.province || '').trim() || null,
    location_path: listing.locationPath,
    lat: listing.lat,
    lng: listing.lng,
    
    // Coordinate precision (CRITICAL for data quality)
    coordinate_precision: listing.coordinatePrecision,
    coordinate_precision_signal: listing.coordinatePrecisionSignal,
    
    // Classification
    listing_type: listing.listingType === 'res_rent' ? 'rent' : 'sale',
    property_type: listing.propertyType.toLowerCase(),
    
    // Classified photos
    photos: photos.regular.slice(0, 20),
    photos_floorplan: photos.floorplan,
    photos_exterior: photos.exterior.slice(0, 5),
    photos_other: photos.other.slice(0, 5),
    photo_count: photos.total,
    
    // Legacy field for backward compatibility
    image_urls: photos.regular.slice(0, 20),
    image_count: photos.total,
    
    // Content
    title: `${listing.sqm || ''}m² ${listing.propertyType} in ${listing.addressLocality}`.trim(),
    description: listing.description,
    
    // Amenities (as array)
    amenities: listing.amenities,
    has_terrace: listing.amenities.includes('terrace'),
    has_garden: listing.amenities.includes('garden'),
    has_pool: listing.amenities.includes('pool') || listing.amenities.includes('swimming pool'),
    has_elevator: listing.amenities.includes('lift') || listing.amenities.includes('elevator'),  // Normalized name
    has_lift: listing.amenities.includes('lift') || listing.amenities.includes('elevator'),  // Legacy
    has_parking: listing.amenities.includes('parking') || listing.amenities.includes('garage'),
    has_balcony: listing.amenities.includes('balcony'),
    has_ac: listing.amenities.includes('air conditioning'),  // Added for data completeness
    is_furnished: listing.amenities.includes('furnished'),
    
    // Agency
    lf_id: listing.id,
    office_reference: listing.officeReference,
    agent_phone: listing.agentPhone,
    agent_email: listing.agentEmail,
    
    // Enhanced tracking fields
    // Prefer HTML-detected status (sold/leased/reserved) over sitemap tracking
    status: listing.saleStatus !== 'active' ? listing.saleStatus : tracking.status,
    status_signal: listing.saleStatus !== 'active' ? listing.saleStatusSignal : tracking.status_signal,
    first_seen: tracking.first_seen,
    last_seen: tracking.last_seen,
    days_on_market: tracking.days_on_market,
    price_history: tracking.price_history,
    
    // Legacy timestamps
    crawled_at: listing.harvestedAt,
    parsed_at: now,
    harvestedAt: now,
    harvester_version: HARVESTER_VERSION,
  };
  
  await dynamoClient.send(new PutCommand({
    TableName: LISTINGS_TABLE,
    Item: normalizedListing,
  }));
  
  return { isNew: !existing, photos };
}

async function updateStats(newCount: number, totalCount: number): Promise<void> {
  try {
    await dynamoClient.send(new UpdateCommand({
      TableName: STATS_TABLE,
      Key: { source: 'lucasfox' },
      UpdateExpression: 'SET last_run = :now, new_found = :new, total_count = :total, runs = if_not_exists(runs, :zero) + :one',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':new': newCount,
        ':total': totalCount,
        ':zero': 0,
        ':one': 1,
      },
    }));
  } catch {
    // Stats update is non-critical
  }
}

// ============================================================
// MAIN LAMBDA HANDLER
// ============================================================

export async function handler(event: any): Promise<any> {
  console.log('🦊 Lucas Fox Delta Harvest Lambda - SELF-CONTINUATION MODE');
  const startTime = Date.now();
  
  resetPeakMemory();
  logMemory('START');

  // --- SELF-CONTINUATION: Load or initialize state ---
  let state = await loadHarvestState();
  const isContinuation = !!state;
  
  if (state) {
    // SAFEGUARD 1: Max invocations check
    if (state.invocationCount >= MAX_INVOCATIONS) {
      console.log(`❌ Max invocations (${MAX_INVOCATIONS}) reached. Stopping to prevent infinite loop.`);
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
      console.log(`   Scraped: ${state.scrapedUrls.length}`);
      console.log(`   Geocoded: ${state.geocodedIds.length}`);
    }
  }

  // Load existing listings from S3
  const existingListings = await loadExistingListings();
  const existingIds = new Set(existingListings.keys());
  console.log(`📂 Loaded ${existingListings.size} existing listings`);
  
  // Data quality tracking
  const typeStats = { sale: 0, rent: 0, unknown: 0 };
  const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };

  let allUrls: string[];
  let newUrls: string[];
  
  if (state && state.allUrls.length > 0) {
    // Use URLs from previous state
    allUrls = state.allUrls;
    // Filter to URLs not yet scraped
    const scrapedSet = new Set(state.scrapedUrls);
    newUrls = allUrls.filter(url => {
      const idMatch = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
      const id = idMatch ? idMatch[1].toUpperCase() : null;
      return id && !existingIds.has(id) && !scrapedSet.has(url);
    });
    console.log(`📊 Resuming: ${newUrls.length} URLs remaining to scrape`);
  } else {
    // Fresh start: fetch URLs
    // STEP 1: Fetch NEWEST listings from search pages (sitemap can be stale!)
    const newestUrls = await fetchNewestFromSearch();
    
    // STEP 2: Fetch sitemap for complete coverage
    const sitemapUrls = await fetchSitemap();
    
    // Combine: newest first, then sitemap (deduplicated)
    allUrls = [...newestUrls];
    for (const url of sitemapUrls) {
      if (!allUrls.includes(url)) {
        allUrls.push(url);
      }
    }
    
    console.log(`\n📊 Total unique URLs: ${allUrls.length} (${newestUrls.length} from search, rest from sitemap)`);
    
    // Find new URLs (not in our existing set)
    newUrls = allUrls.filter(url => {
      const idMatch = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
      return idMatch && !existingIds.has(idMatch[1].toUpperCase());
    });
    
    // Initialize state
    state = {
      invocationCount: 1,
      startedAt: new Date().toISOString(),
      lastProgressAt: new Date().toISOString(),
      phase: 'scraping',
      scrapedUrls: [],
      geocodedIds: [],
      allUrls: allUrls,
      totalNewFound: 0,
    };
  }
  
  console.log(`🆕 ${newUrls.length} new URLs to scrape (newest listed first)`);
  
  const newListings: LFListing[] = [];
  let writtenToDynamo = 0;
  let geocodedCount = state.geocodedIds.length; // Start from previous count
  let newInDb = 0;
  let updatedInDb = 0;
  let photoStats = { total: 0, regular: 0, floorplan: 0, exterior: 0, other: 0 };
  
  // Scrape new listings (with self-continuation)
  if (state.phase === 'scraping') {
    console.log(`\n📥 Scraping phase...`);
    
    for (let i = 0; i < newUrls.length; i += PARALLEL_BATCH_SIZE) {
      // Timeout check (14m 30s)
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        state.phase = 'scraping';
        logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
          'Total URLs': state.allUrls.length,
          'Scraped': state.scrapedUrls.length,
          'New listings': state.totalNewFound,
          'Geocoded': state.geocodedIds.length,
        });
        state.lastProgressAt = new Date().toISOString();
        // Save all listings scraped so far
        for (const listing of newListings) {
          existingListings.set(listing.id, listing);
        }
        await saveListings(existingListings);
        await saveHarvestState(state);
        return { statusCode: 202, body: 'Continuing scraping in next invocation' };
      }
      
      const batch = newUrls.slice(i, i + PARALLEL_BATCH_SIZE);
      
      // Fetch batch in parallel
      const fetchResults = await Promise.all(
        batch.map(url => fetchAndParseDetailPage(url))
      );
      
      for (let j = 0; j < fetchResults.length; j++) {
        const { listing, removed } = fetchResults[j];
        const url = batch[j];
        
        if (listing) {
          newListings.push(listing);
          state.scrapedUrls.push(url);
        } else if (removed) {
          // Listing returned 404 - extract ID and mark as removed
          const idMatch = url.match(/\/([a-z0-9]+)\.html$/i);
          const id = idMatch ? idMatch[1].toUpperCase() : null;
          
          if (id) {
            try {
              await dynamoClient.send(new UpdateCommand({
                TableName: LISTINGS_TABLE,
                Key: { domain: LF_DOMAIN, listing_id: id },
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
      }
      
      // Progress
      const processed = Math.min(i + PARALLEL_BATCH_SIZE, newUrls.length);
      if (processed % 50 === 0 || processed === newUrls.length) {
        console.log(`   📥 Scraped ${processed}/${newUrls.length} (${newListings.length} valid)...`);
        state.lastProgressAt = new Date().toISOString();
      }
      
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
    
    console.log(`\n✅ Scraped ${newListings.length} new listings`);
    state.phase = 'geocoding';
    state.totalNewFound = newListings.length;
    // CRITICAL: Save listings to state for continuation across invocations
    state.listingsToGeocode = newListings;
    await saveHarvestState(state);
  }
  
  // Geocode + verify coordinates for new listings via Nominatim (with self-continuation)
  // CRITICAL: Load listings from state if resuming in geocoding phase
  if (state.listingsToGeocode && state.listingsToGeocode.length > 0 && newListings.length === 0) {
    console.log(`📂 Loading ${state.listingsToGeocode.length} listings from state for geocoding`);
    newListings.push(...state.listingsToGeocode);
  }
  
  // Filter to listings not yet geocoded (for continuation)
  const geocodedSet = new Set(state.geocodedIds);
  const listingsToGeocode = newListings.filter(l => !geocodedSet.has(l.id));
  
  if (listingsToGeocode.length > 0 && state.phase === 'geocoding') {
    console.log(`\n🌍 Verifying coordinates for ${listingsToGeocode.length} listings via Nominatim...`);
    
    // Process in parallel batches, then write to DynamoDB
    for (let i = 0; i < listingsToGeocode.length; i += PARALLEL_BATCH_SIZE) {
      // Timeout check (14m 30s)
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        state.geocodedIds = Array.from(geocodedSet);
        logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
          'Total URLs': state.allUrls.length,
          'Scraped': state.scrapedUrls.length,
          'Geocoded': state.geocodedIds.length,
          'To geocode remaining': listingsToGeocode.length - i,
        });
        state.lastProgressAt = new Date().toISOString();
        // Save listings processed so far
        await saveListings(existingListings);
        await saveHarvestState(state);
        return { statusCode: 202, body: 'Continuing geocoding in next invocation' };
      }
      
      const batch = listingsToGeocode.slice(i, i + PARALLEL_BATCH_SIZE);
      
      // Verify coordinates in parallel - builds best address and geocodes via Nominatim
      const verifyResults = await Promise.all(
        batch.map(listing => {
          // Build the best address string we can
          const addressParts = [
            listing.streetAddress,
            listing.addressLocality,
            listing.addressRegion,
            listing.addressCountry,
          ].filter(Boolean);
          const addressText = addressParts.join(', ');
          
          // No embedded coords for Lucas Fox - we'll geocode and verify
          return verifyCoordinates(
            null,  // No embedded lat
            null,  // No embedded lng  
            addressText,
            {
              streetAddress: listing.streetAddress,
              neighborhood: listing.addressLocality,
              city: listing.addressRegion,
              province: null,
              postalCode: listing.postalCode || null,
              country: listing.addressCountry,
            }
          );
        })
      );
      
      // Apply verification results and write to DynamoDB
      for (let j = 0; j < batch.length; j++) {
        const listing = batch[j];
        const verification = verifyResults[j];
        
        // Update listing with verified coordinates
        listing.lat = verification.finalLat;
        listing.lng = verification.finalLng;
        listing.coordinatePrecision = verification.precision;
        listing.coordinatePrecisionSignal = verification.precisionSignal;
        listing.verifiedAddress = verification.address;
          listing.geocodedAt = new Date().toISOString();
        
        if (verification.finalLat && verification.finalLng) {
          geocodedCount++;
        }
        precisionStats[verification.precision]++;
        
        // Track listing type
        if (listing.listingType === 'rent' || listing.listingType === 'ForRent') typeStats.rent++;
        else if (listing.listingType === 'sale' || listing.listingType === 'ForSale') typeStats.sale++;
        else typeStats.unknown++;
        
        // Add to existing listings map
        existingListings.set(listing.id, listing);
        geocodedSet.add(listing.id);
        
        // Write to DynamoDB
        try {
          const result = await writeToLeoListings(listing);
          writtenToDynamo++;
          if (result.isNew) newInDb++; else updatedInDb++;
        
          // Track photo stats
          photoStats.total += result.photos.total;
          photoStats.regular += result.photos.regular.length;
          photoStats.floorplan += result.photos.floorplan.length;
          photoStats.exterior += result.photos.exterior.length;
          photoStats.other += result.photos.other.length;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`   ⚠️ Failed to write ${listing.id} to DynamoDB: ${errMsg}`);
        }
      }
      
      // Progress
      const processed = Math.min(i + PARALLEL_BATCH_SIZE, listingsToGeocode.length);
      if (processed % 50 === 0 || processed === listingsToGeocode.length) {
        console.log(`   📍 Verified ${processed}/${listingsToGeocode.length}...`);
        state.lastProgressAt = new Date().toISOString();
      }
    }
    
    console.log(`   ✅ Geocoded ${geocodedCount} with coordinates`);
    console.log(`   📊 Precision: ${precisionStats.precise} precise, ${precisionStats.approximate} approximate, ${precisionStats.city_center} city_center, ${precisionStats.unknown} unknown`);
    console.log(`   ✅ Written ${writtenToDynamo} to DynamoDB (${newInDb} new, ${updatedInDb} updated)`);
    console.log(`   📷 Photos: ${photoStats.total} total, ${photoStats.floorplan} floorplans, ${photoStats.exterior} exterior`);
  }
  
  state.phase = 'complete';
  
  // DETECT SOLD/REMOVED: Check existing listings not found in current sitemap+search
  const currentUrlIds = new Set(allUrls.map(url => {
    const match = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
    return match ? match[1].toUpperCase() : null;
  }).filter(Boolean) as string[]);
  
  let removedCount = 0;
  
  if (currentUrlIds.size > 100) { // Only if we have valid data
    for (const [id] of existingListings) {
      // If listing was in our DB but not in current sitemap/search, mark as removed
      if (!currentUrlIds.has(id)) {
        try {
          await dynamoClient.send(new UpdateCommand({
            TableName: LISTINGS_TABLE,
            Key: { domain: LF_DOMAIN, listing_id: id },
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
        } catch {
          // Listing might not exist or already removed
        }
      }
    }
    
    if (removedCount > 0) {
      console.log(`⚠️ Marked ${removedCount} listings as REMOVED (not in sitemap)`);
    }
  }

  // Save to S3
  if (newListings.length > 0 || isContinuation) {
    await saveListings(existingListings);
    console.log(`💾 Saved ${existingListings.size} listings to S3`);
  }

  // Update stats
  const totalNewThisRun = newListings.length + (isContinuation ? state.totalNewFound : 0);
  await updateStats(totalNewThisRun, existingListings.size);

  // SAFEGUARD 4: Completion - clean up state file
  await deleteHarvestState();

  logMemory('END');
  const elapsed = (Date.now() - startTime) / 1000;
  const totalInvocations = state.invocationCount;
  
  console.log(`\n✅ Harvest COMPLETE in ${elapsed.toFixed(1)}s (${totalInvocations} invocation${totalInvocations > 1 ? 's' : ''})`);
  console.log(`   New listings: ${totalNewThisRun}`);
  console.log(`   Geocoded: ${geocodedCount}`);
  console.log(`   Written to DynamoDB: ${writtenToDynamo}`);
  console.log(`   Removed: ${removedCount}`);
  console.log(`   Total: ${existingListings.size}`);

  // Write run summary to analytics
  const summary = createRunSummary(
    LF_DOMAIN,
    HARVESTER_VERSION,
    state.invocationCount,
    MAX_INVOCATIONS,
    'complete',
    'complete',
    startTime,
    MEMORY_LIMIT_MB
  );
  summary.listings_discovered = totalNewThisRun;
  summary.listings_written = writtenToDynamo;
  summary.listings_new = newInDb;
  summary.listings_updated = updatedInDb;
  summary.listings_removed = removedCount;
  summary.listings_by_type = typeStats;
  summary.listings_by_precision = precisionStats;
  await writeRunSummary(summary);

  return {
    statusCode: 200,
    body: JSON.stringify({
      domain: LF_DOMAIN,
      newListings: totalNewThisRun,
      new_in_db: newInDb,
      updated_in_db: updatedInDb,
      geocoded: geocodedCount,
      writtenToDynamo,
      removed: removedCount,
      photos: photoStats,
      total: existingListings.size,
      sitemapTotal: allUrls.length,
      duration: elapsed,
      invocations: totalInvocations,
      timestamp: new Date().toISOString(),
    }),
  };
}

