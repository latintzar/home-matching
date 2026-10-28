/**
 * Supabase Data Adapter
 * 
 * Handles all Supabase-specific data operations
 * Uses the shared Supabase client from @/lib/supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { UnifiedListing, ListingQueryOptions, AnalysisResult, PhotoCluster, RenovationData, WPACache } from './types';

// Use the shared Supabase client (service role for server operations)
function getSupabase(): SupabaseClient {
  return getSupabaseServiceClient();
}

/**
 * Check if a listing exists in Supabase
 */
export async function existsInSupabase(listingId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .single();
  
  return !error && !!data;
}

/**
 * Get listing from Supabase
 */
export async function getListingFromSupabase(
  listingId: string, 
  options: ListingQueryOptions = {}
): Promise<UnifiedListing | null> {
  const supabase = getSupabase();
  
  // Build select query
  let selectFields = 'id, url, title, address, city, neighborhood, province, postal_code, price_eur, sqm, bedrooms, bathrooms, property_type, operation_type, agency_name, scraped_at, pipeline_status';
  
  if (options.includeDescription) {
    selectFields += ', description';
  }
  if (options.includePhotos) {
    selectFields += ', photo_urls';
  }
  
  const { data, error } = await supabase
    .from('listings')
    .select(selectFields)
    .eq('id', listingId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Cast to any to access dynamic fields (Supabase types are overly strict)
  const row = data as unknown as Record<string, unknown>;
  
  // Map to unified format
  return {
    id: String(row.id || ''),
    source: 'supabase',
    url: String(row.url || ''),
    domain: row.url ? new URL(String(row.url)).hostname : '',
    title: row.title as string | undefined,
    address: row.address as string | undefined,
    city: row.city as string | undefined,
    neighborhood: row.neighborhood as string | undefined,
    province: row.province as string | undefined,
    postal_code: row.postal_code as string | undefined,
    price_eur: row.price_eur as number | undefined,
    sqm: row.sqm as number | undefined,
    bedrooms: row.bedrooms as number | undefined,
    bathrooms: row.bathrooms as number | undefined,
    property_type: row.property_type as string | undefined,
    operation_type: row.operation_type as 'sale' | 'rent' | undefined,
    description: row.description as string | undefined,
    photo_urls: row.photo_urls as string[] | undefined,
    scraped_at: row.scraped_at as string | undefined,
    agency_name: row.agency_name as string | undefined,
    pipeline_status: row.pipeline_status as string | undefined,
  };
}

/**
 * Get analysis results from Supabase
 */
export async function getAnalysisFromSupabase(
  listingId: string,
  analysisType: string
): Promise<AnalysisResult | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('text_analysis_results')
    .select('*')
    .eq('listing_id', listingId)
    .eq('phase', analysisType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    listing_id: listingId,
    analysis_type: analysisType,
    results: data.results,
    created_at: data.created_at,
  };
}

/**
 * Save analysis results to Supabase
 */
export async function saveAnalysisToSupabase(
  listingId: string,
  analysisType: string,
  results: Record<string, unknown>
): Promise<boolean> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('text_analysis_results')
    .upsert({
      listing_id: listingId,
      phase: analysisType,
      results,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'listing_id,phase',
    });
  
  return !error;
}

/**
 * Get photo clusters from Supabase
 */
export async function getClustersFromSupabase(
  listingId: string
): Promise<PhotoCluster[]> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('room_clusters')
    .select('*')
    .eq('listing_id', listingId);
  
  if (error || !data) {
    return [];
  }
  
  return data.map(cluster => ({
    cluster_id: cluster.id?.toString(),
    listing_id: listingId,
    room_type: cluster.room_type,
    photo_urls: cluster.photo_urls || [],
    confidence: cluster.confidence,
  }));
}

/**
 * Save photo clusters to Supabase
 */
export async function saveClustersToSupabase(
  listingId: string,
  clusters: PhotoCluster[]
): Promise<boolean> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('room_clusters')
    .upsert(
      clusters.map(c => ({
        listing_id: listingId,
        room_type: c.room_type,
        photo_urls: c.photo_urls,
        confidence: c.confidence,
      }))
    );
  
  return !error;
}

/**
 * Get WPA cache from Supabase
 */
export async function getWPAFromSupabase(
  listingId: string
): Promise<WPACache | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('whole_property_analysis')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    listing_id: listingId,
    analysis: data.analysis_data,
    model_used: data.model_used || 'unknown',
    cached_at: data.created_at,
    ttl_days: 30,
  };
}

/**
 * Save WPA to Supabase
 */
export async function saveWPAToSupabase(
  listingId: string,
  analysis: Record<string, unknown>,
  modelUsed: string
): Promise<boolean> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('whole_property_analysis')
    .upsert({
      listing_id: listingId,
      analysis_data: analysis,
      model_used: modelUsed,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'listing_id',
    });
  
  return !error;
}

/**
 * Get raw Supabase client for advanced queries
 * Use sparingly - prefer typed methods above
 */
export function getRawSupabaseClient(): SupabaseClient {
  return getSupabase();
}

