// Deepdive generation constants - single source of truth
export const TIERS = ["livable", "comfortable", "competitive"] as const;
export type Tier = typeof TIERS[number];

export const PERMIT_IMPACTS = ["none", "minor", "major", "major_structural"] as const;
export type PermitImpact = typeof PERMIT_IMPACTS[number];

export const PHASE_KEYS = [
  "acquisition_planning",
  "design_permitting", 
  "demolition_structural",
  "construction_finishing",
  "completion_handover"
] as const;
export type PhaseKey = typeof PHASE_KEYS[number];

// Database field mappings - what the AI should generate
export const PERMIT_FIELD_MAPPING = {
  permit_type: "permit_id",
  who_files_it: "who_files_it", 
  checklist_documents: "checklist_documents",
  where_filed: "where_filed",
  what_to_expect: "what_to_expect"
} as const;

export const LESSON_FIELD_MAPPING = {
  topic: "title",
  note: "content"
} as const;

// Validation helpers
export const isValidTier = (tier: string): tier is Tier => 
  TIERS.includes(tier as Tier);

export const isValidPermitImpact = (impact: string): impact is PermitImpact => 
  PERMIT_IMPACTS.includes(impact as PermitImpact);

export const isValidPhaseKey = (phase: string): phase is PhaseKey => 
  PHASE_KEYS.includes(phase as PhaseKey);
