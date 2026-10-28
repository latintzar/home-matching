/**
 * Parsing Pipeline Types
 */

// Selector rule for a domain
export interface ScrapingRule {
  domain: string;
  selectors: {
    title?: string;
    price?: string;
    sqm?: string;
    bedrooms?: string;
    bathrooms?: string;
    description?: string;
    address?: string;
    features?: string;
    photos?: string;
  };
  trust_level: number;  // 0-10+, >= 10 means trusted
  last_validated: string;
  validation_failures: number;
  created_at: string;
  updated_at: string;
}

// Parsed listing data
export interface ParsedListing {
  listing_id: string;  // domain_url_hash
  url: string;
  domain: string;
  
  // Core fields
  title?: string;
  price_eur?: number;
  price_raw?: string;
  sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  
  // Location
  address?: string;
  city?: string;
  neighborhood?: string;
  province?: string;
  postal_code?: string;
  
  // Details
  description?: string;
  features?: string[];
  property_type?: string;
  operation_type?: 'sale' | 'rent';
  
  // Photos
  photo_urls?: string[];
  
  // Metadata
  scraped_at: string;
  parsed_at: string;
  parse_method: 'cheerio' | 'llm' | 'hybrid';
  confidence: number;  // 0-1
}

// LLM extraction result
export interface LLMExtractionResult {
  selectors: ScrapingRule['selectors'];
  extracted_data: Partial<ParsedListing>;
  confidence: number;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  issues?: string[];
  confidence: number;
}

// Parse job status
export interface ParseJob {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_files: number;
  processed_files: number;
  success_count: number;
  failure_count: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

