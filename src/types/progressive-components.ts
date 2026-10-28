/**
 * Standardized Data Contracts for Progressive Components
 * 
 * This module defines the data structures that components expect,
 * ensuring consistent data shapes across the application.
 */

export interface Photo {
  id?: string;
  url: string;
  filename?: string;
  original_url?: string;
  photo_type?: string;
  alt?: string;
  tag?: string;
  photoNumber?: number;
}

export interface Headline {
  text: string;
  category?: string;
  confidence?: number;
}

export interface Unknown {
  text: string;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface Followup {
  text: string;
  category?: string;
  type?: 'question' | 'action' | 'verification';
}

export interface Feature {
  name: string;
  value?: string;
  category?: string;
}

export interface View {
  type: string;
  description?: string;
}

/**
 * Core property data contract that all components should use
 */
export interface PropertyDataContract {
  // Basic property information
  id?: string;
  title?: string;
  price?: number;
  constructedArea?: number;
  usefulArea?: number;
  bedrooms?: number;
  bathrooms?: number;
  year?: number;
  description?: string;
  
  // Location and building info
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  floor?: string;
  communityFee?: number;
  
  // New Idealista-Aligned Filters
  property_subtype?: string | null;
  housing_situation?: string | null;
  ad_origin?: string | null;
  condition?: string | null;
  floor_level?: string | null;
  floor_number?: number | null;
  balcony_orientation?: string | null;
  terrace_orientation?: string | null;

  // Explicit Booleans
  has_elevator?: boolean;
  has_terrace?: boolean;
  has_balcony?: boolean;
  has_pool?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  has_storage?: boolean;
  has_air_conditioning?: boolean;
  has_wardrobes?: boolean;
  is_accessible?: boolean;
  is_exterior?: boolean;
  
  // Features and amenities
  roomsAndAmenities?: string | null;
  additionalFeatures?: string[];
  views?: string[];
  
  // Media
  photos?: Photo[];
  floorplans?: Photo[];
  
  // AI Analysis Results
  headlines?: Headline[];
  categorySnippets?: any;
  categoryUnknowns?: any[];
  unknownsChecklist?: any;
  contextualFollowups?: any;
  
  // Metadata
  agentName?: string;
  listingRef?: string;
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Pipeline-aware data contract that includes stage information
 */
export interface PipelineDataContract extends PropertyDataContract {
  pipelineStage?: 'none' | 'scraped' | 'photos-stored' | 'text-analysis' | 'complete';
  lastProcessedAt?: string;
  processingErrors?: string[];
}

/**
 * API Response contract for consistent data shapes
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  pipelineStage?: 'none' | 'scraped' | 'photos-stored' | 'text-analysis' | 'complete';
  error?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Component props contract for progressive components
 */
export interface ProgressiveComponentProps {
  data: PropertyDataContract | null;
  pipelineStage?: 'none' | 'scraped' | 'photos-stored' | 'text-analysis' | 'complete';
  showStageIndicator?: boolean;
  showSkeletonWhenEmpty?: boolean;
  onStageChange?: (stage: string) => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Skeleton component props
 */
export interface SkeletonComponentProps {
  className?: string;
  showStageIndicator?: boolean;
  pipelineStage?: 'none' | 'scraped' | 'photos-stored' | 'text-analysis' | 'complete';
}

/**
 * Stage indicator props
 */
export interface StageIndicatorProps {
  stage: 'none' | 'scraped' | 'photos-stored' | 'text-analysis' | 'complete';
  showDescription?: boolean;
  showProgress?: boolean;
  className?: string;
}
