/**
 * Data Adapter - Unified access to Supabase AND DynamoDB
 * 
 * This adapter provides a single interface for endpoints to access data,
 * abstracting whether it comes from Supabase or DynamoDB.
 * 
 * Migration strategy:
 * 1. Phase 2A: Data copied to DynamoDB (Supabase still primary)
 * 2. Phase 2B: Endpoints gradually switch to this adapter
 * 3. Phase 3: DynamoDB becomes primary for bulk data
 * 
 * Tables that STAY on Supabase (user-facing, auth):
 * - agents
 * - deepdives
 * - user_lifestyle_profiles
 * - auth.users
 * 
 * Tables that MOVE to DynamoDB (bulk data):
 * - listings → leo-listings
 * - listing_photos → embedded in leo-listings
 * - clusters → embedded in leo-listings
 * - text_analysis_results → leo-analysis-cache
 * - whole_property_analysis → leo-wpa-cache
 * - room_analyses → leo-analysis-cache
 * - scraping_rules → leo-scraping-rules
 * - harvest_queue → leo-crawl-tracking
 */

import { createClient } from '@supabase/supabase-js';
import { getListing, getListingByUrl, putListing, getWPA, getAnalysis, Listing as DynamoListing } from './dynamodb';

// Feature flag: Use DynamoDB for bulk data
// Set to true when ready to switch endpoints
const USE_DYNAMODB_FOR_LISTINGS = process.env.USE_DYNAMODB === 'true';

// Lazy-initialize Supabase client (env vars may not be available at module load)
let _supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabaseClient;
}

// Re-export for backward compatibility (use getSupabase() internally)
export { getSupabase };

// ============================================================================
// LISTINGS - Can come from Supabase OR DynamoDB
// ============================================================================

export interface ListingData {
  id: string;
  title: string;
  address: string;
  city: string;
  region: string;
  price_eur: number;
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  lat?: number;
  lng?: number;
  source_url?: string;
  scraped_data?: Record<string, any>;
  pipeline_checkpoints?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  // Embedded data
  photos?: { url: string; original_url?: string }[];
  clusters?: { name: string; room_type: string; photo_urls: string[] }[];
}

/**
 * Get a listing by ID
 * Uses DynamoDB if enabled, otherwise Supabase
 */
export async function getListingById(id: string): Promise<ListingData | null> {
  if (USE_DYNAMODB_FOR_LISTINGS) {
    // DynamoDB requires domain + listing_id
    // For now, scan by listing_id (not ideal, but works for migration)
    // In production, we'd have a GSI on listing_id
    console.log('[DataAdapter] Using DynamoDB for listing', id);
    
    // Try Supabase first to get the domain
    const { data: sbListing } = await getSupabase()
      .from('listings')
      .select('source_url')
      .eq('id', id)
      .single();
    
    const sourceUrl = (sbListing as { source_url?: string } | null)?.source_url;
    if (sourceUrl) {
      const listing = await getListingByUrl(sourceUrl);
      if (listing) {
        return transformDynamoToAdapter(listing);
      }
    }
    
    // Fallback to Supabase
    console.log('[DataAdapter] Falling back to Supabase');
  }
  
  // Use Supabase (default)
  const { data: rawData, error } = await getSupabase()
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !rawData) return null;
  
  // Cast to any for flexibility with dynamic Supabase schema
  const data = rawData as any;
  
  return {
    id: data.id.toString(),
    title: data.title,
    address: data.address,
    city: data.city,
    region: data.region,
    price_eur: data.price_eur,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    sqm: data.sqm,
    lat: data.lat,
    lng: data.lng,
    source_url: data.source_url,
    scraped_data: data.scraped_data,
    pipeline_checkpoints: data.pipeline_checkpoints,
    created_at: data.created_at,
    updated_at: data.updated_at,
    photos: data.listing_photos?.map((p: any) => ({
      url: p.url,
      original_url: p.original_url,
    })),
    clusters: data.clusters?.map((c: any) => ({
      name: c.cluster_name,
      room_type: c.room_type,
      photo_urls: c.photo_urls,
    })),
  };
}

/**
 * Get a listing by URL
 */
export async function getListingBySourceUrl(url: string): Promise<ListingData | null> {
  if (USE_DYNAMODB_FOR_LISTINGS) {
    const listing = await getListingByUrl(url);
    if (listing) {
      return transformDynamoToAdapter(listing);
    }
  }
  
  // Supabase fallback
  const { data: rawData, error } = await getSupabase()
    .from('listings')
    .select('*')
    .eq('source_url', url)
    .single();
  
  if (error || !rawData) return null;
  
  // Cast to any for flexibility with dynamic Supabase schema
  const data = rawData as any;
  
  return {
    id: data.id.toString(),
    title: data.title,
    address: data.address,
    city: data.city,
    region: data.region,
    price_eur: data.price_eur,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    sqm: data.sqm,
    lat: data.lat,
    lng: data.lng,
    source_url: data.source_url,
    scraped_data: data.scraped_data,
    pipeline_checkpoints: data.pipeline_checkpoints,
    created_at: data.created_at,
    updated_at: data.updated_at,
    photos: data.listing_photos?.map((p: any) => ({
      url: p.url,
      original_url: p.original_url,
    })),
    clusters: data.clusters?.map((c: any) => ({
      name: c.cluster_name,
      room_type: c.room_type,
      photo_urls: c.photo_urls,
    })),
  };
}

/**
 * Get all listings (paginated)
 */
export async function getListings(options?: {
  limit?: number;
  offset?: number;
  city?: string;
}): Promise<ListingData[]> {
  // Always use Supabase for now (DynamoDB scan is expensive)
  let query = getSupabase()
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (options?.city) {
    query = query.eq('city', options.city);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }
  
  const { data, error } = await query;
  
  if (error || !data) return [];
  
  return data.map((listing: any) => ({
    id: listing.id.toString(),
    title: listing.title,
    address: listing.address,
    city: listing.city,
    region: listing.region,
    price_eur: listing.price_eur,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqm: listing.sqm,
    lat: listing.lat,
    lng: listing.lng,
    source_url: listing.source_url,
    scraped_data: listing.scraped_data,
    pipeline_checkpoints: listing.pipeline_checkpoints,
    created_at: listing.created_at,
    updated_at: listing.updated_at,
    photos: listing.listing_photos?.map((p: any) => ({
      url: p.url,
      original_url: p.original_url,
    })),
    clusters: listing.clusters?.map((c: any) => ({
      name: c.cluster_name,
      room_type: c.room_type,
      photo_urls: c.photo_urls,
    })),
  }));
}

// ============================================================================
// AGENTS - Always Supabase (user-facing)
// ============================================================================

export async function getAgent(id: string) {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  
  return error ? null : data;
}

export async function getAgentByName(name: string) {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('*')
    .eq('name', name)
    .single();
  
  return error ? null : data;
}

// ============================================================================
// DEEPDIVES - Always Supabase (user-facing)
// ============================================================================

export async function getDeepDive(id: string) {
  const { data, error } = await getSupabase()
    .from('deepdives')
    .select('*')
    .eq('id', id)
    .single();
  
  return error ? null : data;
}

export async function getDeepDiveBySlug(slug: string) {
  const { data, error } = await getSupabase()
    .from('deepdives')
    .select('*')
    .eq('public_slug', slug)
    .single();
  
  return error ? null : data;
}

// ============================================================================
// HELPERS
// ============================================================================

function transformDynamoToAdapter(listing: DynamoListing): ListingData {
  return {
    id: listing.listing_id,
    title: listing.title || '',
    address: listing.address || '',
    city: listing.city || '',
    region: listing.region || '',
    price_eur: listing.price || 0,
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms || 0,
    sqm: listing.sqm || 0,
    lat: listing.lat,
    lng: listing.lng,
    source_url: listing.url,
    scraped_data: listing.scraped_data,
    created_at: listing.first_seen,
    updated_at: listing.last_seen,
    photos: listing.image_urls?.map(url => ({ url, original_url: url })),
    clusters: listing.clusters,
  };
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Check if listing exists in DynamoDB
 */
export async function listingExistsInDynamo(url: string): Promise<boolean> {
  const listing = await getListingByUrl(url);
  return listing !== null;
}

/**
 * Get data source for debugging
 */
export function getDataSource(): string {
  return USE_DYNAMODB_FOR_LISTINGS ? 'DynamoDB' : 'Supabase';
}

export default {
  getSupabase,
  getListingById,
  getListingBySourceUrl,
  getListings,
  getAgent,
  getAgentByName,
  getDeepDive,
  getDeepDiveBySlug,
  listingExistsInDynamo,
  getDataSource,
};

