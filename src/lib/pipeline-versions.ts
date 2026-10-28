/**
 * Pipeline Endpoint Version Registry
 * 
 * IMPORTANT: Bump the version number when you make meaningful changes to an endpoint's:
 * - AI prompt (improved wording, new instructions)
 * - Output schema (new fields, changed structure)
 * - Processing logic (bug fixes that affect output)
 * 
 * When version changes, cached data for that endpoint will be invalidated
 * and re-processed on next pipeline run.
 * 
 * Version format: "MAJOR.MINOR"
 * - MAJOR: Breaking changes, schema changes
 * - MINOR: Prompt improvements, bug fixes
 */

export const PIPELINE_VERSIONS = {
  // Text Analysis Pipeline (A-C)
  A_FACTS: '1.0',           // Sentence-by-sentence fact extraction
  B1_CATEGORIZATION: '1.0', // Claim categorization
  B2_MERGE: '1.0',          // Category merge and validation
  B3_SNIPPETS: '1.0',       // Snippet generation
  C_UNKNOWNS: '1.0',        // Unknown/missing info detection
  
  // Official Verification
  CADASTRE: '1.0',          // Cadastral data analysis
  INTELLIGENCE: '1.0',      // Social radar / neighborhood intelligence
  
  // Photo Analysis Pipeline
  ZERO_SHOT_CLUSTERING: '1.0', // D - Zero-shot photo clustering
  F3_WHOLE_PROPERTY: '1.0',    // Whole property analysis
  ROOM_BY_ROOM: '1.0',         // Room-by-room analysis
  
  // Research
  G_GOOGLE_SEARCH: '1.0',   // Analysis Google Search
  
  // Buyer Report Generation
  SMART_M2: '1.0',          // Smart M2 inference
  BASELINE: '1.0',          // Habitissimo baseline costing
  BUYER_REPORT: '1.0',      // Final buyer report (final-scope)
  QUE_VERIFICAR: '1.0',     // What to verify checklist
  FINAL_SCOPE: '1.0',       // Alias for buyer report
} as const;

export type PipelineStep = keyof typeof PIPELINE_VERSIONS;

/**
 * Helper to check if cached data is still valid
 * @param cachedVersion - The version stored in the cache
 * @param currentVersion - The current version from PIPELINE_VERSIONS
 * @returns true if cache is valid, false if stale
 */
export function isCacheValid(cachedVersion: string | undefined, currentVersion: string): boolean {
  if (!cachedVersion) return false;
  return cachedVersion === currentVersion;
}

/**
 * Helper to create versioned cache data
 * @param data - The data to cache
 * @param step - The pipeline step name
 * @returns Data with _version field added
 */
export function withVersion<T extends object>(data: T, step: PipelineStep): T & { _version: string } {
  return {
    ...data,
    _version: PIPELINE_VERSIONS[step],
  };
}

