/**
 * Data Adapter Types
 * 
 * Unified types for listing data across Supabase and DynamoDB
 */

// Listing source type
export type DataSource = 'supabase' | 'dynamodb';

// Unified listing type that works with both sources
export interface UnifiedListing {
  id: string;
  source: DataSource;
  
  // Core fields (always present)
  url: string;
  domain: string;
  title?: string;
  
  // Location
  address?: string;
  city?: string;
  neighborhood?: string;
  province?: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
  
  // Property details
  price_eur?: number;
  sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  operation_type?: 'sale' | 'rent';
  
  // Description
  description?: string;
  features?: string[];
  
  // Photos
  photo_urls?: string[];
  
  // Metadata
  scraped_at?: string;
  parsed_at?: string;
  agency_name?: string;
  
  // Pipeline status
  pipeline_status?: string;
  
  // Raw data (for debugging)
  raw_data?: Record<string, unknown>;
}

// Listing query options
export interface ListingQueryOptions {
  source?: DataSource;          // Force specific source
  includePhotos?: boolean;      // Include photo_urls
  includeDescription?: boolean; // Include full description
  includeRaw?: boolean;         // Include raw data
}

// Analysis result storage
export interface AnalysisResult {
  listing_id: string;
  analysis_type: string;
  results: Record<string, unknown>;
  created_at: string;
}

// Photo cluster data
export interface PhotoCluster {
  cluster_id: string;
  listing_id: string;
  room_type: string;
  photo_urls: string[];
  confidence?: number;
}

// Renovation data
export interface RenovationData {
  listing_id: string;
  tier: 'estandar' | 'optimo' | 'plus';
  scope: Record<string, unknown>;
  timeline: Record<string, unknown>;
  budget: Record<string, unknown>;
}

// WPA (Whole Property Analysis) cache
export interface WPACache {
  listing_id: string;
  analysis: Record<string, unknown>;
  model_used: string;
  cached_at: string;
  ttl_days: number;
}

