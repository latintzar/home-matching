/**
 * DynamoDB Client for Leo Platform
 * 
 * Provides typed access to DynamoDB tables:
 * - leo-listings: Property listings (from harvest)
 * - leo-scraping-rules: Domain selectors
 * - leo-crawl-tracking: Crawl metadata
 * - leo-wpa-cache: Whole Property Analysis cache
 * - leo-analysis-cache: Text/room analysis cache
 * - leo-geo-intelligence: Geo-dossier system
 * - leo-market-velocity: Sold/rented analytics
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

// Initialize client
const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Table names
export const TABLES = {
  LISTINGS: 'leo-listings',
  SCRAPING_RULES: 'leo-scraping-rules',
  CRAWL_TRACKING: 'leo-crawl-tracking',
  WPA_CACHE: 'leo-wpa-cache',
  ANALYSIS_CACHE: 'leo-analysis-cache',
  GEO_INTELLIGENCE: 'leo-geo-intelligence',
  MARKET_VELOCITY: 'leo-market-velocity',
  NEIGHBORHOOD_BOUNDARIES: 'leo-neighborhood-boundaries',
} as const;

// ============================================================================
// LISTINGS
// ============================================================================

export interface Listing {
  domain: string;
  listing_id: string;
  url?: string;
  title?: string;
  address?: string;
  city?: string;
  region?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  lat?: number;
  lng?: number;
  image_urls?: string[]; // Fetch-and-Dump: store URLs only
  clusters?: { name: string; room_type: string; photo_urls: string[] }[];
  scraped_data?: Record<string, any>;
  s3_path?: string;
  crawled_at?: string;
  parsed_at?: string;
  status?: 'active' | 'removed' | 'sold' | 'rented' | 'reserved' | 'expired';
  status_signal?: string;
  days_on_market?: number;
  first_seen?: string;
  last_seen?: string;
}

export async function getListing(domain: string, listingId: string): Promise<Listing | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.LISTINGS,
    Key: { domain, listing_id: listingId },
  }));
  return result.Item as Listing | null;
}

export async function getListingByUrl(url: string): Promise<Listing | null> {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    // Query by domain, then filter by URL
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.LISTINGS,
      KeyConditionExpression: '#d = :domain',
      FilterExpression: '#u = :url',
      ExpressionAttributeNames: { '#d': 'domain', '#u': 'url' },
      ExpressionAttributeValues: { ':domain': domain, ':url': url },
      Limit: 1,
    }));
    return result.Items?.[0] as Listing | null;
  } catch {
    return null;
  }
}

export async function putListing(listing: Listing): Promise<void> {
  // SAFEGUARD: Block base64 images from being stored (cost control)
  rejectBase64Images(listing as unknown as Record<string, unknown>);
  
  await docClient.send(new PutCommand({
    TableName: TABLES.LISTINGS,
    Item: {
      ...listing,
      last_seen: new Date().toISOString(),
    },
  }));
}

export async function getListingsByCity(city: string, limit = 50): Promise<Listing[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLES.LISTINGS,
    FilterExpression: '#c = :city',
    ExpressionAttributeNames: { '#c': 'city' },
    ExpressionAttributeValues: { ':city': city },
    Limit: limit,
  }));
  return result.Items as Listing[] || [];
}

// ============================================================================
// WPA CACHE (Whole Property Analysis)
// ============================================================================

export interface WPACache {
  listing_url: string;
  domain?: string;
  schema_version?: string;
  analyzed_at?: string;
  photo_count?: number;
  analysis_data?: Record<string, any>;
  rooms?: any[];
  layout?: Record<string, any>;
  light?: Record<string, any>;
  condition?: Record<string, any>;
  potential?: Record<string, any>;
  building_observations?: string[];
  street_observations?: string[];
}

export async function getWPA(listingUrl: string): Promise<WPACache | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.WPA_CACHE,
    Key: { listing_url: listingUrl },
  }));
  return result.Item as WPACache | null;
}

export async function putWPA(wpa: WPACache): Promise<void> {
  // SAFEGUARD: Block base64 images from being stored (cost control)
  rejectBase64Images(wpa as unknown as Record<string, unknown>);
  
  await docClient.send(new PutCommand({
    TableName: TABLES.WPA_CACHE,
    Item: {
      ...wpa,
      analyzed_at: new Date().toISOString(),
    },
  }));
}

// ============================================================================
// ANALYSIS CACHE
// ============================================================================

export interface AnalysisCache {
  listing_id: string;
  analysis_type: string; // text_a1, text_a2, room_by_room, etc.
  results: Record<string, any>;
  created_at?: string;
  schema_version?: string;
}

export async function getAnalysis(listingId: string, analysisType: string): Promise<AnalysisCache | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.ANALYSIS_CACHE,
    Key: { listing_id: listingId, analysis_type: analysisType },
  }));
  return result.Item as AnalysisCache | null;
}

export async function putAnalysis(analysis: AnalysisCache): Promise<void> {
  // SAFEGUARD: Block base64 images from being stored (cost control)
  rejectBase64Images(analysis as unknown as Record<string, unknown>);
  
  await docClient.send(new PutCommand({
    TableName: TABLES.ANALYSIS_CACHE,
    Item: {
      ...analysis,
      created_at: new Date().toISOString(),
    },
  }));
}

export async function getAllAnalyses(listingId: string): Promise<AnalysisCache[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.ANALYSIS_CACHE,
    KeyConditionExpression: 'listing_id = :id',
    ExpressionAttributeValues: { ':id': listingId },
  }));
  return result.Items as AnalysisCache[] || [];
}

// ============================================================================
// SCRAPING RULES
// ============================================================================

export interface ScrapingRule {
  domain: string;
  selectors?: Record<string, string>;
  trust_level?: number; // 0-10, 10 = graduated
  status?: 'learning' | 'validating' | 'graduated' | 'broken';
  last_success?: string;
  failure_count?: number;
  version?: number;
}

export async function getScrapingRule(domain: string): Promise<ScrapingRule | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.SCRAPING_RULES,
    Key: { domain },
  }));
  return result.Item as ScrapingRule | null;
}

export async function putScrapingRule(rule: ScrapingRule): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.SCRAPING_RULES,
    Item: rule,
  }));
}

// ============================================================================
// CRAWL TRACKING
// ============================================================================

export interface CrawlTracking {
  domain: string;
  has_sitemap?: boolean;
  sitemap_url?: string;
  last_full_crawl?: string;
  last_delta_crawl?: string;
  listings_count?: number;
  listings_added_today?: number;
  listings_removed_today?: number;
  status?: 'healthy' | 'error' | 'blocked';
}

export async function getCrawlTracking(domain: string): Promise<CrawlTracking | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.CRAWL_TRACKING,
    Key: { domain },
  }));
  return result.Item as CrawlTracking | null;
}

export async function updateCrawlTracking(domain: string, updates: Partial<CrawlTracking>): Promise<void> {
  const updateExpression: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, string> = {};
  
  Object.entries(updates).forEach(([key, value], index) => {
    if (key !== 'domain' && value !== undefined) {
      updateExpression.push(`#k${index} = :v${index}`);
      expressionAttributeNames[`#k${index}`] = key;
      expressionAttributeValues[`:v${index}`] = value;
    }
  });
  
  if (updateExpression.length === 0) return;
  
  await docClient.send(new UpdateCommand({
    TableName: TABLES.CRAWL_TRACKING,
    Key: { domain },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

// ============================================================================
// GEO INTELLIGENCE (Dossier System)
// ============================================================================

export interface GeoIntelligence {
  geohash: string;
  insight_id: string;
  lat?: number;
  lng?: number;
  radius_m?: number; // 0 = exact, 500 = neighborhood
  city?: string;
  insight_type?: 'property' | 'building' | 'street' | 'era';
  insight_category?: string;
  insight_key?: string;
  insight_value?: Record<string, any>;
  confidence?: number;
  source_type?: string;
  observation_count?: number;
}

export async function getGeoInsights(geohash: string): Promise<GeoIntelligence[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.GEO_INTELLIGENCE,
    KeyConditionExpression: 'geohash = :g',
    ExpressionAttributeValues: { ':g': geohash },
  }));
  return result.Items as GeoIntelligence[] || [];
}

export async function putGeoInsight(insight: GeoIntelligence): Promise<void> {
  // SAFEGUARD: Block base64 images from being stored (cost control)
  rejectBase64Images(insight as unknown as Record<string, unknown>);
  
  await docClient.send(new PutCommand({
    TableName: TABLES.GEO_INTELLIGENCE,
    Item: insight,
  }));
}

// ============================================================================
// MARKET VELOCITY
// ============================================================================

export interface MarketVelocity {
  location_key: string; // e.g., "Madrid/Salamanca"
  period: string; // e.g., "2025-11"
  property_type?: string;
  avg_days_on_market?: number;
  median_days_on_market?: number;
  total_sold?: number;
  total_rented?: number;
  avg_sold_price?: number;
}

export async function getMarketVelocity(locationKey: string, period: string): Promise<MarketVelocity | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.MARKET_VELOCITY,
    Key: { location_key: locationKey, period },
  }));
  return result.Item as MarketVelocity | null;
}

// ============================================================================
// NEIGHBORHOOD BOUNDARIES (from geo2day.com Spain GeoJSON)
// ============================================================================

export interface NeighborhoodBoundary {
  city: string;                    // PK: "barcelona", "madrid", etc.
  neighborhood_id: string;         // SK: unique ID
  name: string;                    // Display name (e.g., "Gràcia")
  geojson: GeoJSON.Feature;        // GeoJSON Feature with Polygon/MultiPolygon
  centroid: { lat: number; lng: number }; // For label positioning
  properties?: Record<string, any>; // Original properties from GeoJSON
}

export async function getNeighborhoodBoundaries(city: string): Promise<NeighborhoodBoundary[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.NEIGHBORHOOD_BOUNDARIES,
    KeyConditionExpression: 'city = :city',
    ExpressionAttributeValues: { ':city': city.toLowerCase() },
  }));
  return result.Items as NeighborhoodBoundary[] || [];
}

export async function putNeighborhoodBoundary(neighborhood: NeighborhoodBoundary): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLES.NEIGHBORHOOD_BOUNDARIES,
    Item: neighborhood,
  }));
}

export async function getNeighborhood(city: string, neighborhoodId: string): Promise<NeighborhoodBoundary | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.NEIGHBORHOOD_BOUNDARIES,
    Key: { city: city.toLowerCase(), neighborhood_id: neighborhoodId },
  }));
  return result.Item as NeighborhoodBoundary | null;
}

// ============================================================================
// BASE64 IMAGE BLOCKER (Cost Control)
// ============================================================================

/**
 * Detect and reject base64-encoded images before they're stored.
 * This prevents accidental storage of image data which would bloat costs.
 * 
 * We only store photo URLS, never the actual image data.
 */
const BASE64_IMAGE_PATTERNS = [
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,/,  // Data URI
  /^\/9j\//,           // JPEG magic bytes in base64
  /^iVBORw0KGgo/,      // PNG magic bytes in base64
  /^R0lGOD/,           // GIF magic bytes in base64
  /^UklGR/,            // WEBP magic bytes in base64
];

function checkForBase64Images(value: unknown, path: string): void {
  // Only check strings > 1KB (URLs are typically <500 chars, base64 is huge)
  if (typeof value === 'string' && value.length > 1000) {
    for (const pattern of BASE64_IMAGE_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(
          `🚫 BLOCKED: Base64 image detected at "${path}". ` +
          `Store URLs only, not image data. String length: ${value.length} chars. ` +
          `This would cost ~$${(value.length / 1024 / 1024 * 0.25).toFixed(4)} in DynamoDB storage PER ITEM.`
        );
      }
    }
  }
  
  // Recursively check arrays
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkForBase64Images(v, `${path}[${i}]`));
  }
  
  // Recursively check objects
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([k, v]) => checkForBase64Images(v, `${path}.${k}`));
  }
}

/**
 * Validate that an item doesn't contain base64-encoded images.
 * Call this before any DynamoDB put operation.
 */
export function rejectBase64Images(item: Record<string, unknown>): void {
  Object.entries(item).forEach(([key, value]) => checkForBase64Images(value, key));
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if a listing exists in DynamoDB
 */
export async function listingExists(url: string): Promise<boolean> {
  const listing = await getListingByUrl(url);
  return listing !== null;
}

/**
 * Get photo URLs for a listing (Fetch-and-Dump pattern)
 * Returns original agency URLs, not stored copies
 */
export async function getListingPhotos(domain: string, listingId: string): Promise<string[]> {
  const listing = await getListing(domain, listingId);
  return listing?.image_urls || [];
}

export default {
  docClient,
  TABLES,
  // Listings
  getListing,
  getListingByUrl,
  putListing,
  getListingsByCity,
  listingExists,
  getListingPhotos,
  // WPA
  getWPA,
  putWPA,
  // Analysis
  getAnalysis,
  putAnalysis,
  getAllAnalyses,
  // Scraping Rules
  getScrapingRule,
  putScrapingRule,
  // Crawl Tracking
  getCrawlTracking,
  updateCrawlTracking,
  // Geo Intelligence
  getGeoInsights,
  putGeoInsight,
  // Market Velocity
  getMarketVelocity,
  // Neighborhood Boundaries
  getNeighborhoodBoundaries,
  putNeighborhoodBoundary,
  getNeighborhood,
  // Validators
  rejectBase64Images,
};

