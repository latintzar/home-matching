/**
 * Engel & Völkers Delta Harvest Lambda
 * 
 * FULL GEO-RECURSIVE with ScrapFly + AGE-BASED CUTOFF
 * 
 * Strategy:
 * - Uses ScrapFly (basic, no JS rendering) for all fetches (E&V blocks AWS IPs)
 * - Geo-recursive: crawls region→city→neighborhood sub-URLs for complete coverage
 * - Age cutoff: stops when hitting listings older than threshold
 *   - Rentals: 30 days
 *   - Sales: 3 months (90 days)
 * - E&V sorts by PUBLISHED_AT_DESC, so newest appear first
 * 
 * Schedule: 3x daily at 7 AM, 12 PM, 6 PM Spain (CET)
 * Timeout: 15 minutes (safe limit: 14m 30s)
 * Memory: 2048 MB
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// LambdaClient removed - no self-invocation (AWS recursive detection safety)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as zlib from 'zlib';
import { detectListingStatus, detectFromHttpStatus, type SaleStatus } from '../lib/harvest/listing-status-detection';
import { 
  verifyCoordinates,
  hasStreetAddress,
  type CoordinatePrecision,
  type AddressComponents 
} from '../lib/harvest/coordinate-precision';
import {
  logMemory,
  resetPeakMemory,
  getPeakMemory,
  writeRunSummary,
  createRunSummary,
  type RunStatus
} from '../lib/harvest/run-analytics';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
// lambdaClient removed - no self-invocation
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const S3_BUCKET = process.env.S3_BUCKET || '';
const LISTINGS_KEY = 'harvest/ev-listings.json.gz';
const STATE_KEY = 'harvest/ev-harvest-state.json';
const LISTINGS_TABLE = 'leo-listings';
const STATS_TABLE = 'leo-harvest-stats';
const EV_DOMAIN = 'engelvoelkers.com';

// ScrapFly config - BASIC only (no JS rendering needed for E&V)
const SCRAPFLY_KEY = process.env.SCRAPFLY_KEY || '';

// Age cutoffs (in days)
const RENTAL_CUTOFF_DAYS = 30;
const SALE_CUTOFF_DAYS = 90;  // 3 months

// Self-continuation config
const MAX_INVOCATIONS = 10;
const STATE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours - allows manual babysitting between scheduled runs
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before Lambda's 15m hard limit
const MEMORY_LIMIT_MB = 2048; // For analytics tracking

// Parallelization
const PARALLEL_BATCH_SIZE = 5; // Lower for ScrapFly rate limits
const SCRAPFLY_DELAY_MS = 500; // Delay between ScrapFly requests

// Harvester version - increment when making changes to data schema
const HARVESTER_VERSION = '2.3.0';  // 2.3.0: Fix discovery - remove per-category timeout, track geo-progress, only complete on cutoff

// ============================================================
// TYPES
// ============================================================

interface EVListing {
  id: string;
  displayId: string;
  propertyType: string;
  marketingType: string;
  title: string;
  price: number | null;
  priceType: string; // "sale" or "rent"
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  totalSurface: number | null;
  livingSurface: number | null;
  plotSurface: number | null;
  country: string;
  region: string;
  city: string;
  neighborhood?: string | null;    // Extracted from title or description
  shopName: string;
  shopPhone?: string;      // Local office phone from detail page
  advisorName?: string;    // Agent name from detail page
  imageIds: string[];
  isNew: boolean;
  isExclusive: boolean;
  lat?: number | null;
  lng?: number | null;
  // Coordinate precision (CRITICAL for data quality)
  coordinate_precision?: CoordinatePrecision;
  coordinate_precision_signal?: string;
  amenities?: {
    hasGarden: boolean;
    hasSwimmingPool: boolean;
    hasTerrace: boolean;
    hasBalcony: boolean;
    hasBasement: boolean;
    hasBuiltInKitchen: boolean;
    hasBuiltInWardrobe: boolean;
    hasMountainView: boolean;
    hasPatio: boolean;
    hasCoveredParking: boolean;
    hasAirConditioning: boolean;
    isFurnished: boolean;
    isPetsAllowed: boolean;
  };
  description?: string;
  allImageIds?: string[];
  constructionYear?: number | null;
  condition?: string;
  floor?: number | null;
  url: string;
  detailUrl?: string;
  harvestedAt: string;
  enrichedAt?: string;
  
  // Sale status detection
  saleStatus?: SaleStatus;
  saleStatusSignal?: string;
}

interface CategoryProgress {
  visited: string[];       // URLs already crawled
  pending: [string, number][];  // [url, depth] pairs waiting to be crawled
  hitCutoff: boolean;      // True if age cutoff reached (discovery complete for this category)
  fullyExplored: boolean;  // True if all geo-paths exhausted
}

interface HarvestState {
  invocationCount: number;
  startedAt: string;
  lastProgressAt: string;
  phase: 'discovery' | 'scraping' | 'enriching' | 'complete';
  categoryIndex: number;
  discoveredUrls: string[];
  scrapedUrls: string[];
  processedListingIds: string[];
  enrichedListingIds: string[];
  scrapflyCreditsUsed: number;
  // NEW: Persist discovered listings across invocations
  discoveredListings?: EVListing[];
  // NEW: Track geo-progress per category for proper resumption
  categoryProgress?: { [key: string]: CategoryProgress };
}

interface ClassifiedPhotos {
  regular: string[];
  floorplan: string[];
  exterior: string[];
  other: string[];
  total: number;
}

// ============================================================
// SCRAPFLY - BASIC (no JS rendering)
// ============================================================

let scrapflyCreditsUsed = 0;

interface ScrapflyResult {
  html: string | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchWithScrapfly(url: string): Promise<ScrapflyResult> {
  if (!SCRAPFLY_KEY) {
    console.log('   ⚠️ SCRAPFLY_KEY not configured');
    return { html: null };
  }
  
  try {
    // BASIC ScrapFly - no asp, no render_js (E&V uses SSR)
    const params = new URLSearchParams({
      key: SCRAPFLY_KEY,
      url: url,
      country: 'ES',
      // NO asp, NO render_js - saves credits!
    });
    
    const response = await fetch(`https://api.scrapfly.io/scrape?${params}`, {
      signal: AbortSignal.timeout(45000),
    });
    
    scrapflyCreditsUsed++;
    
    if (!response.ok) {
      console.log(`   ⚠️ ScrapFly HTTP ${response.status} for ${url}`);
      return { html: null };
    }
    
    const data = await response.json();
    
    // Check if the upstream site returned 404
    const upstreamStatus = data.result?.response_headers?.status || data.result?.status_code;
    if (upstreamStatus === 404 || upstreamStatus === 410) {
      const httpStatus = detectFromHttpStatus(upstreamStatus, true);
      if (httpStatus) {
        console.log(`   🗑️ ${url}: ${httpStatus.signal} (upstream HTTP ${upstreamStatus})`);
        return { html: null, removed: httpStatus };
      }
    }
    
    if (data.result?.error) {
      console.log(`   ⚠️ ScrapFly error: ${data.result.error.message}`);
      return { html: null };
    }
    
    return { html: data.result?.content || null };
  } catch (err: any) {
    console.log(`   ⚠️ ScrapFly error: ${err.message || err}`);
    return { html: null };
  }
}

// ============================================================
// E&V DATA EXTRACTION
// ============================================================

const CATEGORIES = [
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/house', type: 'sale', propertyType: 'house' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment', type: 'sale', propertyType: 'apartment' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/land', type: 'sale', propertyType: 'land' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/house', type: 'rent', propertyType: 'house' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/apartment', type: 'rent', propertyType: 'apartment' },
];

function extractSubUrls(html: string, currentPath: string, categoryBasePath: string): string[] {
  // Look for URLs that:
  // 1. Start with the category base path (e.g., /es/en/properties/res/sale/house)
  // 2. Are one level deeper than the CURRENT page path
  
  const regex = new RegExp(`href="(${categoryBasePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]+)"`, 'g');
  const urls = new Set<string>();
  
  const currentDepth = currentPath.split('/').filter(Boolean).length;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    const path = match[1];
    const pathDepth = path.split('/').filter(Boolean).length;
    
    // Only get direct children of current page (one level deeper than current)
    if (pathDepth === currentDepth + 1) {
      urls.add(`https://www.engelvoelkers.com${path}`);
    }
  }
  
  return Array.from(urls);
}

function extractListingsFromHtml(html: string, listingType: string): EVListing[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
  if (!match) return [];

  try {
    const data = JSON.parse(match[1]);
    const searchResults = data?.props?.pageProps?.searchModule?.initialSearchResults;
    if (!searchResults?.listings) return [];

    const now = new Date().toISOString();

    return searchResults.listings.map((item: any) => {
      const l = item.listing;
      if (!l) return null;

      const addressParts = l.addressComponents || [];
      const country = addressParts.find((a: any) => a.placeType === 'country')?.text || '';
      const region = addressParts.find((a: any) => a.placeType === 'administrative_area_level_1')?.text || '';
      const city = addressParts.find((a: any) => a.placeType === 'locality')?.text || '';

      let price: number | null = null;
      let priceType = listingType;
      if (l.price?.rentTotal?.min) { price = l.price.rentTotal.min; priceType = 'rent'; }
      else if (l.price?.salesPrice?.min) { price = l.price.salesPrice.min; priceType = 'sale'; }
      else if (l.price?.salePrice?.min) { price = l.price.salePrice.min; priceType = 'sale'; }
      else if (l.basePrice?.rentTotal?.min) { price = l.basePrice.rentTotal.min; priceType = 'rent'; }
      else if (l.basePrice?.salesPrice?.min) { price = l.basePrice.salesPrice.min; priceType = 'sale'; }
      else if (l.basePrice?.salePrice?.min) { price = l.basePrice.salePrice.min; priceType = 'sale'; }

      const imageDisturbers = l.imageDisturbers || [];

      // Extract coordinates from search results if available
      const lat = l.displayLat ?? l.lat ?? null;
      const lng = l.displayLng ?? l.lng ?? null;
      
      // Extract neighborhood from title or address components
      const neighborhood = addressParts.find((a: any) => 
        a.placeType === 'neighborhood' || 
        a.placeType === 'sublocality' ||
        a.placeType === 'administrative_area_level_3'
      )?.text || null;
      
      // Determine coordinate precision - E&V API usually provides city/neighborhood level
      // They typically hide exact locations for privacy/exclusivity
      let coordinate_precision: CoordinatePrecision = 'unknown';
      let coordinate_precision_signal = 'no_coordinates';
      
      if (lat && lng) {
        // E&V coords are typically neighborhood-level (they hide exact addresses)
        if (neighborhood) {
          coordinate_precision = 'approximate';
          coordinate_precision_signal = 'api_with_neighborhood';
        } else if (city) {
          coordinate_precision = 'city_center';
          coordinate_precision_signal = 'api_city_level_only';
        } else {
          coordinate_precision = 'approximate';
          coordinate_precision_signal = 'api_unknown_detail';
        }
      }

      return {
        id: l.id,
        displayId: l.displayId,
        propertyType: l.propertyType || '',
        marketingType: l.propertyMarketingType || l.marketingType || '',
        title: l.profile?.title || '',
        price,
        priceType,
        bedrooms: l.bedrooms?.min ?? null,
        bathrooms: l.bathrooms?.min ?? null,
        rooms: l.rooms?.min ?? null,
        totalSurface: l.area?.totalSurface?.min ?? null,
        livingSurface: l.area?.livingSurface?.min ?? null,
        plotSurface: l.area?.plotSurface?.min ?? null,
        country,
        region,
        city,
        neighborhood,
        shopName: l.shopName || '',
        imageIds: l.uploadCareImageIds || [],
        isNew: l.isNew || false,
        isExclusive: imageDisturbers.includes('EXCLUSIVE'),
        lat,
        lng,
        coordinate_precision,
        coordinate_precision_signal,
        url: `https://www.engelvoelkers.com/es/en/property/${l.displayId}`,
        harvestedAt: now,
      };
    }).filter(Boolean) as EVListing[];
  } catch {
    return [];
  }
}

// ============================================================
// AGE-BASED CUTOFF LOGIC
// ============================================================

function shouldStopCrawling(
  listings: EVListing[],
  existingListings: Map<string, EVListing>,
  listingType: string
): boolean {
  const cutoffDays = listingType === 'rent' ? RENTAL_CUTOFF_DAYS : SALE_CUTOFF_DAYS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
  
  // Count how many listings are "old" (first_seen before cutoff)
  let oldCount = 0;
  let knownCount = 0;
  
  for (const listing of listings) {
    const existing = existingListings.get(listing.id);
    if (existing) {
      knownCount++;
      const firstSeen = new Date(existing.harvestedAt);
      if (firstSeen < cutoffDate) {
        oldCount++;
      }
    }
  }
  
  // Stop if >80% of listings are old (we've gone past the fresh ones)
  if (knownCount >= 5 && oldCount / knownCount > 0.8) {
    console.log(`   🛑 Cutoff reached: ${oldCount}/${knownCount} listings older than ${cutoffDays} days`);
    return true;
  }
  
  return false;
}

// ============================================================
// GEO-RECURSIVE DISCOVERY
// ============================================================

interface DiscoveryResult {
  urls: string[];
  listings: EVListing[];
  hitCutoff: boolean;
  fullyExplored: boolean;
  // For state persistence:
  visited: string[];
  pending: [string, number][];
}

async function discoverGeoRecursive(
  baseUrl: string,
  listingType: string,
  existingListings: Map<string, EVListing>,
  maxDepth: number = 3,
  lambdaStartTime: number,  // When the Lambda started (for global timeout check)
  previousProgress?: CategoryProgress  // NEW: resume from saved progress
): Promise<DiscoveryResult> {
  const allUrls = new Set<string>();
  const allListings: EVListing[] = [];
  const seenIds = new Set<string>();
  let hitCutoff = false;
  
  const basePath = new URL(baseUrl).pathname;
  
  // Resume from previous progress OR start fresh
  const visited = new Set<string>(previousProgress?.visited || []);
  const queue: [string, number][] = previousProgress?.pending?.length 
    ? [...previousProgress.pending]  // Resume pending queue
    : [[baseUrl, 0]];  // Start fresh
  
  // If resuming with no pending items but not marked complete, we're done exploring
  if (previousProgress && previousProgress.pending?.length === 0 && !previousProgress.hitCutoff) {
    console.log('   📋 Category fully explored in previous run');
    return {
      urls: Array.from(visited),
      listings: [],
      hitCutoff: false,
      fullyExplored: true,
      visited: Array.from(visited),
      pending: []
    };
  }
  
  console.log(`   📋 Starting with ${visited.size} visited, ${queue.length} pending`);
  
  while (queue.length > 0 && !hitCutoff) {
    // Check global Lambda timeout (14m 30s)
    const elapsed = Date.now() - lambdaStartTime;
    if (elapsed > LAMBDA_SAFE_TIMEOUT_MS) {
      console.log(`   ⏰ Lambda timeout (14m 30s) reached, saving progress`);
      break;
    }
    
    // Take batch for parallel fetching
    const batch: [string, number][] = [];
    while (batch.length < PARALLEL_BATCH_SIZE && queue.length > 0) {
      const item = queue.shift()!;
      if (!visited.has(item[0])) {
        visited.add(item[0]);
        batch.push(item);
      }
    }
    
    if (batch.length === 0) continue;
    
    // Fetch batch with ScrapFly (with delays to respect rate limits)
    for (const [url, depth] of batch) {
      console.log(`   📍 Fetching (depth ${depth}): ${url.replace('https://www.engelvoelkers.com', '')}`);
      
      const { html } = await fetchWithScrapfly(url);
      await new Promise(r => setTimeout(r, SCRAPFLY_DELAY_MS));
      
      if (!html) continue;
      
      allUrls.add(url);
      
      // Extract listings
      const listings = extractListingsFromHtml(html, listingType);
      console.log(`      Found ${listings.length} listings`);
      
      // Add new listings
      for (const listing of listings) {
        if (!seenIds.has(listing.id)) {
          seenIds.add(listing.id);
          allListings.push(listing);
        }
      }
      
      // Check if we should stop (hit old listings)
      if (shouldStopCrawling(listings, existingListings, listingType)) {
        hitCutoff = true;
        console.log(`   🛑 Age cutoff reached! Discovery complete for this category.`);
        break;
      }
      
      // Discover sub-URLs if not at max depth
      if (depth < maxDepth && !hitCutoff) {
        const currentPath = new URL(url).pathname;
        const subUrls = extractSubUrls(html, currentPath, basePath);
        console.log(`      Found ${subUrls.length} sub-URLs at depth ${depth}`);
        for (const subUrl of subUrls) {
          if (!visited.has(subUrl) && !queue.some(q => q[0] === subUrl)) {
            queue.push([subUrl, depth + 1]);
          }
        }
      }
    }
  }
  
  const fullyExplored = queue.length === 0 && !hitCutoff;
  if (fullyExplored) {
    console.log('   ✅ Category fully explored (all geo-paths crawled)');
  }
  
  return { 
    urls: Array.from(allUrls), 
    listings: allListings, 
    hitCutoff,
    fullyExplored,
    visited: Array.from(visited),
    pending: queue  // Return remaining queue for state persistence
  };
}

// ============================================================
// PHOTO CLASSIFICATION
// ============================================================

const FLOORPLAN_PATTERNS = [
  /floorplan/i, /floor[-_]?plan/i, /plano/i, /planta/i, /grundriss/i,
  /distribucion/i, /layout/i, /blueprint/i, /esquema/i, /planimetria/i
];

function buildImageUrl(imageId: string, width = 760, height = 506): string {
  return `https://ucarecdn.com/${imageId}/-/scale_crop/${width}x${height}/`;
}

function classifyPhotos(imageIds: string[]): ClassifiedPhotos {
  const result: ClassifiedPhotos = {
    regular: [],
    floorplan: [],
    exterior: [],
    other: [],
    total: imageIds.length
  };
  
  for (const imageId of imageIds) {
    const url = buildImageUrl(imageId);
    const id = imageId.toLowerCase();
    
    if (FLOORPLAN_PATTERNS.some(p => p.test(id))) {
      result.floorplan.push(url);
    } else if (/exterior|fachada|facade|building/i.test(id)) {
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
      Key: { domain: EV_DOMAIN, listing_id: listingId },
      ProjectionExpression: 'first_seen, price, price_history'
    }));
    return result.Item ? {
      first_seen: result.Item.first_seen,
      price: result.Item.price,
      price_history: result.Item.price_history
    } : null;
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
    status_signal: 'in_search_results',
    first_seen,
    last_seen: now,
    days_on_market: daysOnMarket,
    price_history
  };
}

// ============================================================
// DETAIL PAGE ENRICHMENT (with ScrapFly)
// ============================================================

interface EnrichResult {
  listing: EVListing;
  removed?: { status: SaleStatus; signal: string };
}

async function enrichFromDetailPage(listing: EVListing): Promise<EnrichResult> {
  const detailUrl = `https://www.engelvoelkers.com/es/en/exposes/${listing.id}`;
  listing.detailUrl = detailUrl;

  try {
    const { html, removed } = await fetchWithScrapfly(detailUrl);
    await new Promise(r => setTimeout(r, SCRAPFLY_DELAY_MS));
    
    // If listing page returned 404, mark as removed
    if (removed) {
      listing.saleStatus = removed.status;
      listing.saleStatusSignal = removed.signal;
      return { listing, removed };
    }
    
    if (!html) return { listing };

    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
    if (!match) return { listing };

    const data = JSON.parse(match[1]);
    const detail = data?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.listing;
    if (!detail) return { listing };

    const features = detail.features || {};
    const profile = detail.profile || {};

    listing.lat = detail.displayLat ?? listing.lat;
    listing.lng = detail.displayLng ?? listing.lng;

    listing.amenities = {
      hasGarden: features.hasGarden || detail.hasGarden || false,
      hasSwimmingPool: features.hasSwimmingPool || detail.hasSwimmingPool || false,
      hasTerrace: features.hasTerrace || detail.hasTerrace || false,
      hasBalcony: features.hasBalcony || detail.hasBalcony || false,
      hasBasement: features.hasBasement || detail.hasBasement || false,
      hasBuiltInKitchen: features.hasBuiltInKitchen || detail.hasBuiltInKitchen || false,
      hasBuiltInWardrobe: features.hasBuiltInWardrobe || detail.hasBuiltInWardrobe || false,
      hasMountainView: features.hasMountainView || detail.hasMountainView || false,
      hasPatio: features.hasPatio || detail.hasPatio || false,
      hasCoveredParking: features.hasCoveredParking || false,
      hasAirConditioning: features.hasAirConditioning || false,
      isFurnished: features.isFurnished || detail.isFurnished || false,
      isPetsAllowed: features.isPetsAllowed || detail.isPetsAllowed || false,
    };

    listing.description = profile.description || '';
    listing.constructionYear = detail.constructionYear?.min ?? null;
    listing.condition = detail.condition || '';
    listing.floor = detail.floor?.min ?? null;
    listing.allImageIds = detail.uploadCareImageIds || listing.imageIds;
    listing.enrichedAt = new Date().toISOString();

    // Extract agent contact from rendered HTML (not in __NEXT_DATA__)
    // Phone: <a href="tel:+34 93 515 44 44"><span>+34 93 515 44 44</span></a>
    const phoneMatch = html.match(/href="tel:([^"]+)"/);
    if (phoneMatch) {
      listing.shopPhone = phoneMatch[1].trim();
    }
    
    // Advisor: <p ...>Your advisor: Francesc Garcia</p>
    const advisorMatch = html.match(/Your advisor:\s*([^<]+)/i);
    if (advisorMatch) {
      listing.advisorName = advisorMatch[1].trim();
    }
    
    // Detect sale status (sold/leased/reserved) from HTML
    const statusDetection = detectListingStatus(html);
    listing.saleStatus = statusDetection.saleStatus;
    listing.saleStatusSignal = statusDetection.statusSignal;

  } catch {
    // Enrichment failed, keep basic data
  }

  return { listing };
}

// ============================================================
// S3 OPERATIONS
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
      const stateAge = Date.now() - new Date(state.startedAt).getTime();
      if (stateAge > STATE_EXPIRY_MS) {
        console.log('⚠️ State expired, starting fresh');
        await deleteHarvestState();
        return null;
      }
      return state;
    }
  } catch { /* No state file */ }
  return null;
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
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: STATE_KEY }));
    console.log('🗑️ Deleted state');
  } catch { /* OK */ }
}

// NOTE: Self-invocation removed for safety (AWS recursive detection)
// Work continues on next scheduled run (3x daily) via state persistence
function logContinuationScheduled(): void {
  console.log('⏸️ Work paused - will continue on next scheduled run');
  console.log('   State saved. Next run will pick up where we left off.');
}

async function loadExistingListings(): Promise<Map<string, EVListing>> {
  const listings = new Map<string, EVListing>();
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: LISTINGS_KEY,
    }));
    const compressed = await response.Body?.transformToByteArray();
    if (compressed) {
      const json = zlib.gunzipSync(Buffer.from(compressed)).toString('utf-8');
      const existingListings: EVListing[] = JSON.parse(json);
      for (const listing of existingListings) {
        listings.set(listing.id, listing);
      }
    }
  } catch {
    console.log('No existing listings, starting fresh');
  }
  return listings;
}

async function saveListings(listings: Map<string, EVListing>): Promise<void> {
  const array = Array.from(listings.values());
  const json = JSON.stringify(array);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'));
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: LISTINGS_KEY,
    Body: compressed,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Metadata: { 'listing-count': String(array.length), 'updated-at': new Date().toISOString() },
  }));
}

// ============================================================
// DYNAMODB WRITE
// ============================================================

async function writeToLeoListings(listing: EVListing): Promise<{ isNew: boolean }> {
  const now = new Date().toISOString();
  const existing = await getExistingListingTracking(listing.id);
  const tracking = buildTrackingData(existing, listing.price);
  const imageIds = listing.allImageIds || listing.imageIds || [];
  const photos = classifyPhotos(imageIds);
  
  const normalizedListing: Record<string, any> = {
    domain: EV_DOMAIN,
    listing_id: listing.id,
    url: listing.detailUrl || listing.url,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqm: listing.totalSurface,
    // DynamoDB city-index doesn't allow empty strings - omit if empty
    ...(listing.city ? { city: listing.city } : {}),
    ...(listing.region ? { region: listing.region } : {}),
    ...(listing.neighborhood ? { neighborhood: listing.neighborhood } : {}),
    lat: listing.lat,
    lng: listing.lng,
    // Coordinate precision (CRITICAL for data quality)
    coordinate_precision: listing.coordinate_precision || 'unknown',
    coordinate_precision_signal: listing.coordinate_precision_signal || 'not_set',
    listing_type: listing.priceType,
    property_type: listing.propertyType,
    photos: photos.regular.slice(0, 20),
    photos_floorplan: photos.floorplan,
    photos_exterior: photos.exterior.slice(0, 5),
    photos_other: photos.other.slice(0, 5),
    photo_count: photos.total,
    image_urls: photos.regular.slice(0, 20),
    image_count: photos.total,
    ev_display_id: listing.displayId,
    title: listing.title,
    description: listing.description,
    rooms: listing.rooms,
    living_surface: listing.livingSurface,
    plot_surface: listing.plotSurface,
    construction_year: listing.constructionYear,
    condition: listing.condition,
    floor: listing.floor,
    has_garden: listing.amenities?.hasGarden,
    has_pool: listing.amenities?.hasSwimmingPool,
    has_terrace: listing.amenities?.hasTerrace,
    has_balcony: listing.amenities?.hasBalcony,
    has_kitchen: listing.amenities?.hasBuiltInKitchen,
    has_ac: listing.amenities?.hasAirConditioning,
    has_parking: listing.amenities?.hasCoveredParking,
    is_furnished: listing.amenities?.isFurnished,
    has_mountain_view: listing.amenities?.hasMountainView,
    shop_name: listing.shopName,
    shop_phone: listing.shopPhone || null,
    advisor_name: listing.advisorName || null,
    // Enhanced tracking fields - prefer HTML-detected status over sitemap tracking
    status: listing.saleStatus && listing.saleStatus !== 'active' ? listing.saleStatus : tracking.status,
    status_signal: listing.saleStatus && listing.saleStatus !== 'active' ? listing.saleStatusSignal : tracking.status_signal,
    first_seen: tracking.first_seen,
    last_seen: tracking.last_seen,
    days_on_market: tracking.days_on_market,
    price_history: tracking.price_history,
    crawled_at: listing.harvestedAt,
    parsed_at: listing.enrichedAt || now,
    is_new: listing.isNew,
    is_exclusive: listing.isExclusive,
    // Date tracking: publication_date = actual listing date (if source provides it)
    // first_seen = when WE discovered it. date_type tells UI which to show.
    publication_date: null, // E&V doesn't expose publication date
    date_type: 'discovered', // 'published' | 'discovered' - for UI badge
    harvestedAt: new Date().toISOString(),
    harvester_version: HARVESTER_VERSION,
  };
  
  await dynamoClient.send(new PutCommand({
    TableName: LISTINGS_TABLE,
    Item: normalizedListing,
  }));
  
  return { isNew: !existing };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function handler(event: any): Promise<any> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🏠 E&V Harvest Lambda - GEO-RECURSIVE + SCRAPFLY + AGE CUTOFF');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   Cutoffs: Rentals ${RENTAL_CUTOFF_DAYS} days, Sales ${SALE_CUTOFF_DAYS} days`);
  console.log(`   Timeout: 14m 30s (Lambda max: 15m)`);
  console.log(`   Memory: ${MEMORY_LIMIT_MB} MB`);
  
  const startTime = Date.now();
  resetPeakMemory();
  logMemory('START');
  
  // Load or initialize state
  let state = await loadHarvestState();
  
  if (state) {
    if (state.invocationCount >= MAX_INVOCATIONS) {
      console.log('❌ Max invocations reached');
      await deleteHarvestState();
      return { statusCode: 400, body: 'Max invocations' };
    }
    state.invocationCount++;
    state.lastProgressAt = new Date().toISOString();
    console.log(`🔄 Continuing (invocation ${state.invocationCount}/${MAX_INVOCATIONS}, phase: ${state.phase})`);
    scrapflyCreditsUsed = state.scrapflyCreditsUsed;
  } else {
    state = {
      invocationCount: 1,
      startedAt: new Date().toISOString(),
      lastProgressAt: new Date().toISOString(),
      phase: 'discovery',
      categoryIndex: 0,
      discoveredUrls: [],
      scrapedUrls: [],
      processedListingIds: [],
      enrichedListingIds: [],
      scrapflyCreditsUsed: 0,
      categoryProgress: {},  // NEW: track progress per category
    };
    console.log('📝 Starting fresh harvest');
  }
  
  // Initialize categoryProgress if not present (migration from old state)
  if (!state.categoryProgress) {
    state.categoryProgress = {};
  }
  
  // Load existing listings
  const existingListings = await loadExistingListings();
  console.log(`📂 Loaded ${existingListings.size} existing listings`);
  
  // Data quality tracking
  const typeStats = { sale: 0, rent: 0, unknown: 0 };
  const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
  
  const newListings: EVListing[] = [];
  const processedIds = new Set(state.processedListingIds);
  
  // ============================================================
  // PHASE 1: GEO-RECURSIVE DISCOVERY
  // ============================================================
  
  if (state.phase === 'discovery') {
    console.log('\n--- PHASE 1: GEO-RECURSIVE DISCOVERY ---');
    
    // Load any previously discovered listings from state
    if (state.discoveredListings && state.discoveredListings.length > 0) {
      console.log(`   📂 Resuming with ${state.discoveredListings.length} previously discovered listings`);
      for (const listing of state.discoveredListings) {
        if (!existingListings.has(listing.id) && !processedIds.has(listing.id)) {
          newListings.push(listing);
          processedIds.add(listing.id);
        }
      }
    }
    
    let timedOut = false;
    
    for (let catIdx = state.categoryIndex; catIdx < CATEGORIES.length && !timedOut; catIdx++) {
      const category = CATEGORIES[catIdx];
      const catKey = `${category.type}/${category.propertyType}`;
      const catProgress = state.categoryProgress[catKey];
      
      // Skip if category already complete (hit cutoff or fully explored)
      if (catProgress?.hitCutoff || catProgress?.fullyExplored) {
        console.log(`\n📂 ${catKey} (${catIdx + 1}/${CATEGORIES.length}) - ALREADY COMPLETE ✅`);
        continue;
      }
      
      console.log(`\n📂 ${catKey} (${catIdx + 1}/${CATEGORIES.length})`);
      
      // Check timeout BEFORE starting category
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        console.log('⏰ Timeout before starting category');
        timedOut = true;
        break;
      }
      
      // Geo-recursive discovery for this category (with progress resumption)
      const result = await discoverGeoRecursive(
        category.url,
        category.type,
        existingListings,
        3, // max depth
        startTime,
        catProgress  // Pass previous progress for resumption
      );
      
      console.log(`   📊 This run: ${result.listings.length} listings, ${result.visited.length} URLs visited`);
      
      // Update category progress
      state.categoryProgress[catKey] = {
        visited: result.visited,
        pending: result.pending,
        hitCutoff: result.hitCutoff,
        fullyExplored: result.fullyExplored
      };
      
      // Add new listings
      for (const listing of result.listings) {
        if (!existingListings.has(listing.id) && !processedIds.has(listing.id)) {
          newListings.push(listing);
          processedIds.add(listing.id);
        }
      }
      
      // Check if we timed out mid-category
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        timedOut = true;
      }
      
      // If category is complete, move to next
      if (result.hitCutoff || result.fullyExplored) {
        state.categoryIndex = catIdx + 1;
      }
    }
    
    // Check if ALL categories are complete
    const allCategoriesComplete = CATEGORIES.every(cat => {
      const key = `${cat.type}/${cat.propertyType}`;
      const prog = state.categoryProgress?.[key];
      return prog?.hitCutoff || prog?.fullyExplored;
    });
    
    if (allCategoriesComplete) {
      state.phase = 'enriching';
      console.log(`\n✅ DISCOVERY COMPLETE: All ${CATEGORIES.length} categories done!`);
    } else if (timedOut) {
      // Log "save game" status
      console.log('\n');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('💾 SAVE GAME - Discovery in progress');
      console.log('════════════════════════════════════════════════════════════════');
      console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
      console.log(`   Listings discovered so far: ${newListings.length}`);
      console.log(`   ScrapFly credits used: ${scrapflyCreditsUsed}`);
      console.log('   Category status:');
      for (const cat of CATEGORIES) {
        const key = `${cat.type}/${cat.propertyType}`;
        const prog = state.categoryProgress?.[key];
        let status = '⏳ Not started';
        if (prog?.hitCutoff) status = '✅ Complete (age cutoff)';
        else if (prog?.fullyExplored) status = '✅ Complete (fully explored)';
        else if (prog?.visited?.length) status = `🔄 In progress (${prog.visited.length} visited, ${prog.pending?.length || 0} pending)`;
        console.log(`      ${key}: ${status}`);
      }
      console.log('════════════════════════════════════════════════════════════════');
      console.log('   Next scheduled run will continue from here.');
      console.log('════════════════════════════════════════════════════════════════');
    }
    
    // Save state
    logMemory('DISCOVERY_CHECKPOINT');
    state.processedListingIds = Array.from(processedIds);
    state.discoveredListings = newListings;
    state.scrapflyCreditsUsed = scrapflyCreditsUsed;
    await saveHarvestState(state);
    
    if (timedOut && !allCategoriesComplete) {
      // Write run summary for discovery timeout
      const summary = createRunSummary(
        EV_DOMAIN,
        HARVESTER_VERSION,
        state.invocationCount,
        MAX_INVOCATIONS,
        'discovery',
        'discovery_timeout',
        startTime,
        MEMORY_LIMIT_MB
      );
      summary.scrapfly_credits = scrapflyCreditsUsed;
      summary.listings_discovered = newListings.length;
      // Add category progress to summary
      summary.category_progress = {};
      for (const cat of CATEGORIES) {
        const key = `${cat.type}/${cat.propertyType}`;
        const prog = state.categoryProgress?.[key];
        if (prog) {
          summary.category_progress[key] = {
            visited: prog.visited?.length || 0,
            pending: prog.pending?.length || 0,
            hitCutoff: prog.hitCutoff || false,
            fullyExplored: prog.fullyExplored || false
          };
        }
      }
      await writeRunSummary(summary);
      
      return { statusCode: 202, body: `Discovery in progress (${newListings.length} listings found)` };
    }
    
    console.log(`   Total discovered: ${newListings.length} new listings`);
    console.log(`   ScrapFly credits used: ${scrapflyCreditsUsed}`);
  }
  
  // ============================================================
  // PHASE 2: ENRICH & WRITE TO DYNAMODB
  // ============================================================
  
  if (state.phase === 'enriching') {
    console.log('\n--- PHASE 2: ENRICHING & WRITING ---');
    
    // Load discovered listings from state if resuming
    if (newListings.length === 0 && state.discoveredListings && state.discoveredListings.length > 0) {
      console.log(`   📂 Loading ${state.discoveredListings.length} listings from state`);
      newListings.push(...state.discoveredListings);
    }
    
    const enrichedIds = new Set(state.enrichedListingIds);
    const listingsToEnrich = newListings.filter(l => !enrichedIds.has(l.id));
    
    console.log(`   ${listingsToEnrich.length} listings to enrich (${enrichedIds.size} already done)`);
    
    let writtenToDynamo = 0;
    let newInDb = 0;
    
    for (const listing of listingsToEnrich) {
      // Check timeout (14m 30s)
      if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
        logMemory('ENRICHMENT_TIMEOUT');
        console.log('\n');
        console.log('════════════════════════════════════════════════════════════════');
        console.log('💾 SAVE GAME - Enrichment in progress');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
        console.log(`   Enriched: ${enrichedIds.size}/${newListings.length}`);
        console.log(`   Written to DynamoDB: ${writtenToDynamo}`);
        console.log(`   ScrapFly credits used: ${scrapflyCreditsUsed}`);
        console.log('════════════════════════════════════════════════════════════════');
        state.enrichedListingIds = Array.from(enrichedIds);
        state.scrapflyCreditsUsed = scrapflyCreditsUsed;
        await saveHarvestState(state);
        
        // Write run summary for enrichment timeout
        const summary = createRunSummary(
          EV_DOMAIN,
          HARVESTER_VERSION,
          state.invocationCount,
          MAX_INVOCATIONS,
          'enriching',
          'enrichment_timeout',
          startTime,
          MEMORY_LIMIT_MB
        );
        summary.scrapfly_credits = scrapflyCreditsUsed;
        summary.listings_discovered = newListings.length;
        summary.listings_enriched = enrichedIds.size;
        summary.listings_written = writtenToDynamo;
        await writeRunSummary(summary);
        
        logContinuationScheduled();
        return { statusCode: 202, body: 'Continuing enrichment' };
      }
      
      // Enrich with detail page (uses ScrapFly)
      const { listing: enriched, removed } = await enrichFromDetailPage(listing);
      existingListings.set(enriched.id, enriched);
      enrichedIds.add(enriched.id);
      
      // Write to DynamoDB (even if removed, to update status)
      try {
        const result = await writeToLeoListings(enriched);
        writtenToDynamo++;
        if (result.isNew) newInDb++;
        if (removed) {
          console.log(`   🗑️ Marked ${enriched.displayId} as ${removed.status} (${removed.signal})`);
        }
        
        // Track data quality stats
        if (enriched.listingType === 'rent') typeStats.rent++;
        else if (enriched.listingType === 'sale') typeStats.sale++;
        else typeStats.unknown++;
        precisionStats[enriched.coordinatePrecision || 'unknown']++;
      } catch (error) {
        console.error(`   ⚠️ Failed to write ${enriched.displayId}:`, error);
      }
      
      if (enrichedIds.size % 20 === 0) {
        console.log(`   📝 Enriched ${enrichedIds.size}, written ${writtenToDynamo}`);
      }
    }
    
    console.log(`\n✅ Enrichment complete: ${writtenToDynamo} written (${newInDb} new)`);
    state.phase = 'complete';
  }
  
  // ============================================================
  // SAVE & CLEANUP
  // ============================================================
  
  logMemory('BEFORE_SAVE');
  
  await saveListings(existingListings);
  console.log(`💾 Saved ${existingListings.size} listings to S3`);
  
  await deleteHarvestState();
  
  logMemory('END');
  
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ HARVEST COMPLETE in ${elapsed.toFixed(1)}s`);
  console.log(`   New listings: ${newListings.length}`);
  console.log(`   Total in S3: ${existingListings.size}`);
  console.log(`   ScrapFly credits used: ${scrapflyCreditsUsed}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  // Write run summary to analytics
  const summary = createRunSummary(
    EV_DOMAIN,
    HARVESTER_VERSION,
    state.invocationCount,
    MAX_INVOCATIONS,
    'complete',
    'complete',
    startTime,
    MEMORY_LIMIT_MB
  );
  summary.scrapfly_credits = scrapflyCreditsUsed;
  summary.listings_discovered = newListings.length;
  summary.listings_written = existingListings.size;
  summary.listings_by_type = typeStats;
  summary.listings_by_precision = precisionStats;
  await writeRunSummary(summary);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      domain: EV_DOMAIN,
      newListings: newListings.length,
      totalInS3: existingListings.size,
      scrapflyCreditsUsed,
      duration: elapsed,
      invocations: state.invocationCount,
    }),
  };
}
