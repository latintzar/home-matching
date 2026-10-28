// Renovation Intelligence Pipeline - Data Contracts
// This file defines all the TypeScript interfaces for the renovation intelligence pipeline

export interface RenovationScopeReport {
  listing_id: string;
  generated_at: string;
  tiers: {
    estandar: RenovationTier;
    optimo: RenovationTier;
    plus: RenovationTier;
  };
}

export interface RenovationTier {
  description: string;
  rationale: string;
  relative_cost_scale: "€" | "€€" | "€€€";
  effort_level: "low" | "medium" | "high";
  expected_duration_weeks: number;
  work_items: WorkItem[];
  base_timeline: BasicPhase[];
  likely_permits: string[];
}

export interface WorkItem {
  id: string;
  category: "structure" | "layout" | "finishes" | "services" | "energy" | "documentation" | "other";
  description: string;
  effort_level: "low" | "medium" | "high";
  requires_permit: boolean;
  rationale: string;
}

export interface BasicPhase {
  name: string;
  description: string;
  duration_weeks: number;
}

export interface RenovationResearchResults {
  listing_id: string;
  category: "price" | "time" | "permits";
  summaries: Array<{
    subcategory: string;
    summary: string;
    confidence: "high" | "medium" | "low";
    sources: string[];
    metrics?: {
      low?: number;
      high?: number;
      unit?: string;
      typical_duration_weeks?: number;
    };
  }>;
}

export interface RenovationPricingReport extends Omit<RenovationScopeReport, 'tiers'> {
  tiers: {
    [tier_name: string]: {
      work_items: Array<WorkItem & {
        cost_low_eur: number;
        cost_high_eur: number;
        cost_basis: string;
      }>;
      total_estimate_range_eur: [number, number];
    };
  };
}

export interface RenovationTimelineReport {
  listing_id: string;
  tiers: {
    [tier_name: string]: {
      phases: Array<{
        name: string;
        start_offset_weeks: number;
        duration_weeks: number;
        milestone: string;
        dependencies: string[];
      }>;
    };
  };
}

export interface RenovationPermitsReport {
  listing_id: string;
  permits: Array<{
    permit_type: string;
    why_needed: string;
    documentation_required: string[];
    issuing_authority: string;
    expected_time_weeks: number;
    common_pitfalls: string[];
    sources?: string[];
  }>;
}

export interface RenovationStylePrompts {
  listing_id: string;
  tiers: {
    estandar: string;
    optimo: string;
    plus: string;
  };
}

export interface NextStepsReport {
  listing_id: string;
  sections: {
    key_verifications: string[];
    practical_implications: string[];
    preparation_tips: string[];
    mindset_check: string[];
  };
}

// Research Query Generation
export interface ResearchQueries {
  queries_by_category: {
    costs: string[];
    durations: string[];
    permits: string[];
    norms: string[];
  };
}

// Google Search Results (for internal use)
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  query: string;
}

export interface SearchResults {
  query: string;
  results: SearchResult[];
  total_results: number;
}

// Architecture Improvement: New Types

// Photo Analysis Types
export interface WholePropertyAnalysis {
  listing_id: string;
  lenses: {
    structural_envelope: string;
    finishes_surfaces: string;
    lighting_ventilation: string;
    fittings_fixtures: string;
    energy_insulation: string;
    accessibility_safety: string;
    spatial_coherence_flow: string;
    potential_limitations: string;
  };
  overall_condition_summary: string;
  confidence_notes: string;             // Declare certainty limits
  photo_coverage_summary: string;       // What's missing or unclear
}

export interface RoomAnalysis {
  room_id: string;
  room_name: string;
  findings_by_lens: {
    structural_envelope?: string;
    finishes_surfaces: string;
    lighting_ventilation: string;
    fittings_fixtures?: string;
    moisture_hygiene: string;
    energy_insulation?: string;
    accessibility_safety?: string;
    potential_limitations: string;
  };
  notable_issues: string[];             // Explicit, photo-anchored issues
  overall_room_condition: "poor" | "fair" | "good";
  confidence: "low" | "medium" | "high";
}

export interface RoomBullets {
  room_id: string;
  room_name: string;
  bullets: string[]; // 4–7 concise, buyer-friendly points (≤140 chars where possible)
}

// Allocentric Layout Types (Phase 1: Pipeline Simplification)
export interface RoomLayoutAllocentric {
  room_id: string;
  room_name: string;
  
  // Structured fields (for machines)
  layout_structured: {
    approx_dimensions?: {
      length_m?: number;
      width_m?: number;
      height_m?: number;
    };
    envelope: {
      walls: string[]; // e.g. ["north wall with window", "south wall with door to terrace"]
      openings: string[]; // doors, windows, arches with descriptions
    };
    key_surfaces: string[]; // floor type, main wall finishes, ceiling type
    obvious_adjacencies?: string[]; // ["opens to dining via arch", "connects to terrace"]
  };
  
  // Expressive narrative (for LLM semantics)
  layout_narrative: string; // 1-2 paragraphs: "This is a long, narrow living-dining space running east-west, with large sliding glass doors along the south wall opening to the terrace, and a low, continuous media wall on the north side in textured white plaster..."
}

export interface WholeHomeSummary {
  room_list: Array<{ room_id: string; room_name: string }>;
  spatial_organization: string; // "Day zone (living/dining/kitchen) flows into night zone (bedrooms) via central hallway"
  major_axes: string[]; // ["east-west living axis", "north-south circulation"]
  key_connections: string[]; // ["Terrace connects to dining via wide arch", "Kitchen opens to dining"]
}

// Tier Element Synthesis Types (Phase 2: Pipeline Simplification)
export interface TierRenovationWork {
  element_id: string;
  room_id: string;
  room_name: string;
  family_id?: string; // Room family (bathrooms, bedrooms, etc.)
  action: 'keep' | 'remove' | 'minor_change' | 'upgrade' | 'replace' | 'premium_upgrade';
  work_description: string; // Buyer-friendly description: "Replace ceramic floor tiles with porcelain"
  technical_details: string; // Technical spec: "Porcelain tiles, 60x60cm, matte finish, warm gray"
  rationale: string; // Why this work is needed
  style_alignment?: string; // How this aligns with tier style direction
  estimated_effort?: 'low' | 'medium' | 'high';
  requires_permit?: boolean;
}

export interface TierElementSynthesis {
  tier: 'estandar' | 'optimo' | 'plus';
  works: TierRenovationWork[]; // Canonical, additive list of all renovation works
  cohesion_summary: {
    material_consistency: string;
    color_harmony: string;
    style_coherence: string;
    progression_consistency: string;
  };
  total_works: number;
  works_by_room: Record<string, number>; // room_id -> count
  works_by_family: Record<string, number>; // family_id -> count
}

// Research Aggregation Types
export interface AggregatedResearchResults {
  listing_id: string;
  tier: "estandar" | "optimo" | "plus";
  aggregated_results: Record<string, { // key = work_item_name
    costs?: AggregatedCategory;
    timings?: AggregatedCategory;
    permits?: AggregatedCategory;
    laws?: AggregatedCategory;
    norms?: AggregatedCategory;
    market?: AggregatedCategory;
    incentives?: AggregatedCategory;
    overall_confidence: "high" | "medium" | "low";
    combined_sources: string[];
  }>;
}

export interface AggregatedCategory {
  summary: string;
  metrics?: { low?: number; high?: number; unit?: string };
  confidence: "high" | "medium" | "low";
  sources: string[];
}

// Final Scope (UI-ready)
export interface FinalRenovationScope {
  listing_id: string;
  generated_at: string;
  tiers: {
    estandar: FinalTier;
    optimo: FinalTier;
    plus: FinalTier;
  };
}

export interface FinalTier {
  description: string;
  rationale: string;
  work_items: Array<{
    id: string;
    name: string;
    category: "structure" | "layout" | "finishes" | "services" | "energy" | "documentation" | "other";
    summary: string;                 // Short, buyer-facing
    cost_low_eur: number;
    cost_high_eur: number;
    cost_basis: string;              // e.g., "habitissimo 2025 avg"
    duration_weeks: number;          // Active weeks for the item
    dependencies: string[];          // Names/ids of other items/phases
    requires_permit: boolean;
  }>;
  total_estimate_range_eur: [number, number];
  timeline: {
    phases: Array<{
      name: string;                  // deal, design, permits, works, delivery
      start_offset_weeks: number;
      duration_weeks: number;
      milestone: string;
      dependencies: string[];
    }>;
  };
  permits: Array<{
    permit_type: string;             // obra menor/mayor, etc.
    why_needed: string;
    documentation_required: string[];
    issuing_authority: string;
    expected_time_weeks: number;
    common_pitfalls: string[];
  }>;
}
