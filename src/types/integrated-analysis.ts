/**
 * Integrated Analysis Type Definitions
 * 
 * These types match the exact data contract specification for the Photo Analysis Pipeline.
 * The final output must conform to the IntegratedAnalysis interface exactly.
 */

export type Rating = 'Good' | 'Fair' | 'Poor' | 'Unknown' | 'Claimed-verify';
export type CertaintyMode = 'Observed' | 'Inferred' | 'Unknown' | 'Claimed';
export type PhotoLayout = 'grid-3' | 'grid-2' | 'panorama' | 'masonry';
export type LikelyWork = 'Cosmetic' | 'Repair' | 'Replace' | 'Specialist';

/**
 * Main Integrated Analysis Output (Stage 3)
 * This is the final production JSON that the UI renders
 */
export interface IntegratedAnalysis {
  report_meta: ReportMeta;
  summary: Summary;
  whole_property_notes: PropertyNote[];
  rooms: RoomAnalysis[];
  systems: SystemObservation[];
  documents_to_request: DocumentRequest[];
  strategic_view: StrategicAssessment[];
}

export interface ReportMeta {
  property_title: string;
  price: string;
  size: string;
  bedrooms_bathrooms: string;
  floor_info: string | null;
  year_built: number;
  community_fee: string | null;
  agent_name: string | null;
  listing_ref: string | null;
  run_date_iso: string;
  photos_reviewed: number;
  disclaimer: string;
}

export interface Summary {
  general_impression: string;
  summary_ratings: SummaryRatings;
  how_sure_we_are: CertaintyBreakdown;
  must_verify_next: VerificationItem[];
}

export interface SummaryRatings {
  envelope: Rating;
  moisture: Rating;
  windows_doors: Rating;
  kitchen_baths: Rating;
  electrical: Rating;
  plumbing: Rating;
  heating_cooling: Rating;
  finishes: Rating;
  accessibility_safety: Rating;
  energy_comfort: Rating;
}

export interface CertaintyBreakdown {
  observed_pct: number;
  inferred_pct: number;
  unknown_pct: number;
}

export interface VerificationItem {
  room: string;
  element: string;
  what_to_check: string;
  sure: CertaintyMode;
}

export interface PropertyNote {
  category: string;
  text: string;
  sure: CertaintyMode;
}

export interface RoomAnalysis {
  name: string;
  condition: Rating;
  photo_layout: PhotoLayout;
  observations: RoomObservation[];
  risks: string[];
  verify: string[];
  likely_work: LikelyWork;
}

export interface RoomObservation {
  mode: CertaintyMode;
  element: string;
  visual_cue: string;
}

export interface SystemObservation {
  domain: 'electrical' | 'plumbing' | 'heating_cooling' | 'accessibility_safety';
  observation: string;
  confidence: CertaintyMode;
}

export interface DocumentRequest {
  title: string;
  description: string;
}

export interface StrategicAssessment {
  category: string;
  assessment: string;
  action: string;
}

/**
 * Stage 1 (Whole Property) Output Shape - PRIVATE
 * Used internally by the Integrator to merge with Stage 2
 */
export interface WholePropertyAnalysis {
  general_impression: string;
  summary_ratings: SummaryRatings;
  top_checks: Array<{
    room: string;
    element: string;
    why: string;
    sure: CertaintyMode;
  }>;
  notes: Array<{
    category: string;
    text: string;
    sure: CertaintyMode;
  }>;
}

/**
 * Stage 2 (Room-by-Room) Output Shape - PRIVATE
 * Used internally by the Integrator to merge with Stage 1
 */
export interface RoomByRoomAnalysis {
  rooms: Array<{
    name: string;
    condition: Rating;
    observations: RoomObservation[];
    risks: string[];
    verify: string[];
    likely_work: LikelyWork;
  }>;
  systems: SystemObservation[];
}

/**
 * Photo Cluster (from auto-clustering pipeline)
 * Used by the analysis pipeline and all downstream steps
 * Matches the clusters table schema
 */
export interface Cluster {
  id: number;
  listing_id: number;
  cluster_name: string;
  photo_urls: string[];
  display_order: number;
  visibility_mappings?: Record<string, any>; // Stage 4 format
  selected_photo_url?: string; // Set by R1
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Use Cluster instead. This interface name is misleading - clusters are auto-generated, not manual.
 */
export type ManualPhotoCluster = Cluster;

/**
 * Analysis Results Database Record
 * Used to store all three stages in the analysis_results table
 */
export interface AnalysisResult {
  id: number;
  listing_id: number;
  analysis_type: 'whole_property' | 'by_cluster' | 'integrated';
  analysis_data: WholePropertyAnalysis | RoomByRoomAnalysis | IntegratedAnalysis;
  created_at: string;
  updated_at: string;
}

/**
 * Utility Types for Validation
 */
export type AnalysisType = 'whole_property' | 'by_cluster' | 'integrated';

export interface AnalysisValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Type Guards for Runtime Validation
 */
export function isIntegratedAnalysis(data: any): data is IntegratedAnalysis {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.report_meta === 'object' &&
    typeof data.summary === 'object' &&
    Array.isArray(data.rooms) &&
    Array.isArray(data.systems) &&
    Array.isArray(data.documents_to_request) &&
    Array.isArray(data.strategic_view)
  );
}

export function isWholePropertyAnalysis(data: any): data is WholePropertyAnalysis {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.general_impression === 'string' &&
    typeof data.summary_ratings === 'object' &&
    Array.isArray(data.top_checks) &&
    Array.isArray(data.notes)
  );
}

export function isRoomByRoomAnalysis(data: any): data is RoomByRoomAnalysis {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.rooms) &&
    Array.isArray(data.systems)
  );
}

/**
 * Default Values for Required Fields
 */
export const DEFAULT_INTEGRATED_ANALYSIS: Partial<IntegratedAnalysis> = {
  report_meta: {
    property_title: '',
    price: '',
    size: '',
    bedrooms_bathrooms: '',
    floor_info: null,
    year_built: 0,
    community_fee: null,
    agent_name: null,
    listing_ref: null,
    run_date_iso: new Date().toISOString().split('T')[0],
    photos_reviewed: 0,
    disclaimer: 'Visual, photo-based review only; not a survey or compliance opinion.'
  },
  summary: {
    general_impression: '',
    summary_ratings: {
      envelope: 'Unknown',
      moisture: 'Unknown',
      windows_doors: 'Unknown',
      kitchen_baths: 'Unknown',
      electrical: 'Unknown',
      plumbing: 'Unknown',
      heating_cooling: 'Unknown',
      finishes: 'Unknown',
      accessibility_safety: 'Unknown',
      energy_comfort: 'Unknown'
    },
    how_sure_we_are: {
      observed_pct: 0,
      inferred_pct: 0,
      unknown_pct: 100
    },
    must_verify_next: []
  },
  whole_property_notes: [],
  rooms: [],
  systems: [],
  documents_to_request: [],
  strategic_view: []
};
