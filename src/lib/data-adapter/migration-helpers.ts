/**
 * Migration Helpers
 * 
 * Utilities to help migrate endpoints from direct Supabase to data adapter.
 * These provide backward-compatible wrappers during the migration period.
 */

import { getListing, getAnalysis, saveAnalysis, getRawSupabaseClient, determineSource } from './index';
import { UnifiedListing } from './types';

/**
 * Get listing with backward compatibility
 * Returns both unified listing and raw Supabase data for endpoints
 * that need specific fields not in the unified schema
 */
export async function getListingWithRaw(listingId: string): Promise<{
  listing: UnifiedListing | null;
  raw: Record<string, unknown> | null;
  source: 'supabase' | 'dynamodb';
}> {
  const source = determineSource(listingId);
  const listing = await getListing(listingId, { 
    includeDescription: true, 
    includePhotos: true 
  });
  
  if (!listing) {
    return { listing: null, raw: null, source };
  }
  
  // For Supabase listings, also fetch raw data
  let raw: Record<string, unknown> | null = null;
  if (source === 'supabase') {
    const supabase = getRawSupabaseClient();
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();
    raw = data as unknown as Record<string, unknown> | null;
  }
  
  return { listing, raw, source };
}

/**
 * Get or create analysis result
 * Wrapper for common pattern: check cache, return if valid, else null
 */
export async function getCachedAnalysis<T>(
  listingId: string,
  analysisType: string,
  versionCheck?: (results: T) => boolean
): Promise<{ cached: true; results: T } | { cached: false }> {
  const analysis = await getAnalysis(listingId, analysisType);
  
  if (!analysis?.results) {
    return { cached: false };
  }
  
  const results = analysis.results as T;
  
  // If version check provided, validate
  if (versionCheck && !versionCheck(results)) {
    return { cached: false };
  }
  
  return { cached: true, results };
}

/**
 * Save analysis with standard format
 */
export async function saveAnalysisResult(
  listingId: string,
  analysisType: string,
  results: Record<string, unknown>,
  version?: string
): Promise<boolean> {
  const toSave = version ? { ...results, _version: version } : results;
  return saveAnalysis(listingId, analysisType, toSave);
}

/**
 * Get Supabase client for tables that haven't been migrated
 * Use sparingly - prefer data adapter methods
 */
export function getSupabaseForLegacyTables() {
  return getRawSupabaseClient();
}

/**
 * Check if listing exists and get source in one call
 */
export async function checkListingSource(listingId: string): Promise<{
  exists: boolean;
  source: 'supabase' | 'dynamodb' | null;
}> {
  const listing = await getListing(listingId);
  if (!listing) {
    return { exists: false, source: null };
  }
  return { exists: true, source: listing.source };
}

/**
 * Batch get listings (useful for list views)
 */
export async function batchGetListings(listingIds: string[]): Promise<Map<string, UnifiedListing>> {
  const results = new Map<string, UnifiedListing>();
  
  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < listingIds.length; i += batchSize) {
    const batch = listingIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(id => getListing(id))
    );
    
    batch.forEach((id, idx) => {
      if (batchResults[idx]) {
        results.set(id, batchResults[idx]!);
      }
    });
  }
  
  return results;
}

