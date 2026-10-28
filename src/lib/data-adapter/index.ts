/**
 * Unified Data Adapter
 * 
 * Routes data operations to Supabase or DynamoDB based on where data lives.
 * 
 * ARCHITECTURE:
 * - Legacy listings (ID like 1000000001) → Supabase
 * - Harvested listings (domain-based ID) → DynamoDB
 * - Analysis/clustering for any listing → Same source as listing
 * - WPA cache → DynamoDB (faster, cheaper)
 * 
 * This adapter provides a clean separation between the two data sources
 * while maintaining a unified API for the rest of the application.
 */

import { 
  UnifiedListing, 
  ListingQueryOptions, 
  AnalysisResult, 
  PhotoCluster, 
  WPACache,
  DataSource 
} from './types';

import {
  existsInSupabase,
  getListingFromSupabase,
  getAnalysisFromSupabase,
  saveAnalysisToSupabase,
  getClustersFromSupabase,
  saveClustersToSupabase,
  getWPAFromSupabase,
  saveWPAToSupabase,
  getRawSupabaseClient,
} from './supabase-adapter';

import {
  existsInDynamoDB,
  getListingFromDynamoDB,
  saveListingToDynamoDB,
  getAnalysisFromDynamoDB,
  saveAnalysisToDynamoDB,
  getWPAFromDynamoDB,
  saveWPAToDynamoDB,
  queryListingsByCity,
  queryListingsByDomain,
} from './dynamodb-adapter';

// Re-export types
export * from './types';

// Re-export raw clients for advanced use cases
export { getRawSupabaseClient };

/**
 * Determine the data source for a listing ID
 * 
 * Legacy IDs (1000000001, 1000000002, etc.) → Supabase
 * New IDs (domain_url_hash or similar) → DynamoDB
 */
export function determineSource(listingId: string): DataSource {
  // Legacy Supabase listings have numeric IDs starting with 1000000
  if (/^10000000\d+$/.test(listingId)) {
    return 'supabase';
  }
  
  // Numeric IDs that might be from Supabase
  if (/^\d+$/.test(listingId) && parseInt(listingId) < 2000000000) {
    return 'supabase';
  }
  
  // Everything else is DynamoDB (harvested listings)
  return 'dynamodb';
}

/**
 * Find the actual source by checking both databases
 * Use this when you're unsure where a listing is
 */
export async function findSource(listingId: string): Promise<DataSource | null> {
  // Check expected source first
  const expectedSource = determineSource(listingId);
  
  if (expectedSource === 'supabase') {
    if (await existsInSupabase(listingId)) {
      return 'supabase';
    }
    // Might have been migrated to DynamoDB
    if (await existsInDynamoDB(listingId)) {
      return 'dynamodb';
    }
  } else {
    if (await existsInDynamoDB(listingId)) {
      return 'dynamodb';
    }
    // Might be a legacy listing
    if (await existsInSupabase(listingId)) {
      return 'supabase';
    }
  }
  
  return null;
}

// ============================================================================
// LISTING OPERATIONS
// ============================================================================

/**
 * Get a listing from the appropriate source
 */
export async function getListing(
  listingId: string,
  options: ListingQueryOptions = {}
): Promise<UnifiedListing | null> {
  // If source is forced, use that
  if (options.source) {
    return options.source === 'supabase'
      ? getListingFromSupabase(listingId, options)
      : getListingFromDynamoDB(listingId, options);
  }
  
  // Otherwise, determine source
  const source = await findSource(listingId);
  
  if (!source) {
    return null;
  }
  
  return source === 'supabase'
    ? getListingFromSupabase(listingId, options)
    : getListingFromDynamoDB(listingId, options);
}

/**
 * Check if a listing exists
 */
export async function listingExists(listingId: string): Promise<boolean> {
  const source = determineSource(listingId);
  
  if (source === 'supabase') {
    return existsInSupabase(listingId);
  }
  
  return existsInDynamoDB(listingId);
}

/**
 * Save a listing (new harvested listings go to DynamoDB)
 */
export async function saveListing(
  listing: Partial<UnifiedListing> & { id: string }
): Promise<boolean> {
  // New listings always go to DynamoDB
  return saveListingToDynamoDB(listing);
}

// ============================================================================
// ANALYSIS OPERATIONS
// ============================================================================

/**
 * Get analysis results for a listing
 */
export async function getAnalysis(
  listingId: string,
  analysisType: string
): Promise<AnalysisResult | null> {
  const source = determineSource(listingId);
  
  return source === 'supabase'
    ? getAnalysisFromSupabase(listingId, analysisType)
    : getAnalysisFromDynamoDB(listingId, analysisType);
}

/**
 * Save analysis results for a listing
 */
export async function saveAnalysis(
  listingId: string,
  analysisType: string,
  results: Record<string, unknown>
): Promise<boolean> {
  const source = determineSource(listingId);
  
  return source === 'supabase'
    ? saveAnalysisToSupabase(listingId, analysisType, results)
    : saveAnalysisToDynamoDB(listingId, analysisType, results);
}

// ============================================================================
// PHOTO CLUSTER OPERATIONS
// ============================================================================

/**
 * Get photo clusters for a listing
 */
export async function getClusters(listingId: string): Promise<PhotoCluster[]> {
  const source = determineSource(listingId);
  
  if (source === 'supabase') {
    return getClustersFromSupabase(listingId);
  }
  
  // TODO: Implement DynamoDB cluster storage when needed
  // For now, clusters are only for Supabase listings (existing analysis pipeline)
  return [];
}

/**
 * Save photo clusters for a listing
 */
export async function saveClusters(
  listingId: string,
  clusters: PhotoCluster[]
): Promise<boolean> {
  const source = determineSource(listingId);
  
  if (source === 'supabase') {
    return saveClustersToSupabase(listingId, clusters);
  }
  
  // TODO: Implement DynamoDB cluster storage when needed
  return false;
}

// ============================================================================
// WPA (WHOLE PROPERTY ANALYSIS) CACHE
// ============================================================================

/**
 * Get WPA from cache
 * Checks DynamoDB first (faster), then Supabase
 */
export async function getWPACache(listingId: string): Promise<WPACache | null> {
  // Try DynamoDB first (primary cache)
  const dynamoResult = await getWPAFromDynamoDB(listingId);
  if (dynamoResult) {
    return dynamoResult;
  }
  
  // Fall back to Supabase for legacy listings
  const source = determineSource(listingId);
  if (source === 'supabase') {
    return getWPAFromSupabase(listingId);
  }
  
  return null;
}

/**
 * Save WPA to cache
 * Always saves to DynamoDB for speed
 */
export async function saveWPACache(
  listingId: string,
  analysis: Record<string, unknown>,
  modelUsed: string
): Promise<boolean> {
  // Save to DynamoDB (primary cache)
  const dynamoSuccess = await saveWPAToDynamoDB(listingId, analysis, modelUsed);
  
  // Also save to Supabase for legacy listings
  const source = determineSource(listingId);
  if (source === 'supabase') {
    await saveWPAToSupabase(listingId, analysis, modelUsed);
  }
  
  return dynamoSuccess;
}

// ============================================================================
// QUERY OPERATIONS (DynamoDB-only)
// ============================================================================

/**
 * Query listings by city
 */
export async function queryByCity(
  city: string,
  limit: number = 100
): Promise<UnifiedListing[]> {
  return queryListingsByCity(city, limit);
}

/**
 * Query listings by domain (agency)
 */
export async function queryByDomain(
  domain: string,
  limit: number = 100
): Promise<UnifiedListing[]> {
  return queryListingsByDomain(domain, limit);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get listing with full data (photos, description)
 */
export async function getListingFull(listingId: string): Promise<UnifiedListing | null> {
  return getListing(listingId, {
    includePhotos: true,
    includeDescription: true,
  });
}

/**
 * Get listing basic info only (fast query)
 */
export async function getListingBasic(listingId: string): Promise<UnifiedListing | null> {
  return getListing(listingId, {
    includePhotos: false,
    includeDescription: false,
  });
}

/**
 * Get multiple listings at once
 */
export async function getListings(
  listingIds: string[],
  options: ListingQueryOptions = {}
): Promise<Map<string, UnifiedListing>> {
  const results = new Map<string, UnifiedListing>();
  
  // Group by source
  const supabaseIds = listingIds.filter(id => determineSource(id) === 'supabase');
  const dynamoIds = listingIds.filter(id => determineSource(id) === 'dynamodb');
  
  // Fetch in parallel
  const [supabaseResults, dynamoResults] = await Promise.all([
    Promise.all(supabaseIds.map(id => getListingFromSupabase(id, options))),
    Promise.all(dynamoIds.map(id => getListingFromDynamoDB(id, options))),
  ]);
  
  // Combine results
  supabaseIds.forEach((id, i) => {
    if (supabaseResults[i]) {
      results.set(id, supabaseResults[i]!);
    }
  });
  
  dynamoIds.forEach((id, i) => {
    if (dynamoResults[i]) {
      results.set(id, dynamoResults[i]!);
    }
  });
  
  return results;
}

