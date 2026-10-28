/**
 * Diagnostic Analysis Types
 * 
 * New structure for the re-architected Listing Diagnostic pipeline.
 * This replaces the old photo-analysis-focused structure with a diagnostic report
 * that merges text analysis, photo analysis, and listing metadata.
 */

export interface DiagnosticAnalysisReport {
  listing_id: string;
  analysis_date: string;

  findings_by_category: {
    estado_materiales: string;          // Finishes & surfaces
    espacios_distribucion: string;      // Layout & flow
    entorno_vistas: string;             // Light, orientation, views
    servicios_instalaciones: string;    // Visible services (plumbing, electrical, HVAC)
    legal_economico: string;            // Basic compliance or cost cues
    seguridad_accesibilidad: string;    // Safety & accessibility
    caracter_arquitectonico: string;    // Style or architectural context
  };

  visible_strengths: string[];          // 4–7 photo-backed positives
  verification_focus: Array<{
    aspect: string;                     // What's missing, uncertain, or potentially problematic
    why_uncertain: string;              // Why it's unclear (e.g. no photo, ambiguous listing)
    suggested_action: string;           // What to verify / ask / inspect
    severity: "low" | "medium" | "high";// Importance or risk if unverified
  }>;

  effort_impact: string;                // 2–3 sentences on expected buyer effort or timeline
  key_takeaways: string[];              // 5 concise bullets (≤140 chars each)
  disclaimer: string;                   // "Photos only" limitation notice
}

export interface DiagnosticAnalysisSummary {
  listing_id: string;
  bullets: string[]; // 5×140-character headlines
}

/**
 * Input data structure for Listing Diagnostic Analysis
 * 
 * Takes B3 snippets (categorized claims) + C unknowns + Photo Analysis + Basic metadata
 */
export interface ListingDiagnosticInputs {
  listingId?: string; // Listing ID for the report
  textAnalysis: {
    // B3: Categorized snippets - "What we know"
    categorySnippets: Record<string, any>;
    // C: Unknowns checklist - "What's missing"
    unknowns: string[];
  };
  photoAnalysis: {
    wholeProperty: any;
    roomByRoom: any; // Array of RoomAnalysis with layout_reference blocks
    photosCount: number;
  };
  roomLayouts?: Array<{
    room_id: string;
    room_name?: string;
    surfaces?: { floor?: string; walls?: string; ceiling?: string };
    objects?: Array<{ id: string; type: string; room_ref?: string }>;
    openings?: Array<{ type: string; faces_room?: string }>;
  }>; // E1 outputs: per-room layouts
  unifiedLayout?: {
    home_id?: string;
    rooms?: Array<{
      room_id: string;
      room_name?: string;
      surfaces?: { floor?: string; walls?: string; ceiling?: string };
    }>;
    connections?: Array<{
      from_room: string;
      to_room: string;
      connection_type: string;
    }>;
  } | null; // E2 output: unified home layout
  listingMetadata: {
    title: string;
    price: number;
    size: number;
    bedrooms: number;
    bathrooms: number;
    floor?: string;
    yearBuilt?: number;
    location?: string;
  };
  researchContext?: Record<string, {
    summary: string;
    key_points: string[];
    confidence_level: 'high' | 'medium' | 'low';
    sources_used: string[];
  }>;
}

/**
 * Type guards
 */
export function isDiagnosticAnalysisReport(data: any): data is DiagnosticAnalysisReport {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.listing_id === 'string' &&
    typeof data.analysis_date === 'string' &&
    typeof data.findings_by_category === 'object' &&
    Array.isArray(data.visible_strengths) &&
    Array.isArray(data.verification_focus) &&
    data.verification_focus.every((v: any) => 
      typeof v === 'object' &&
      typeof v.aspect === 'string' &&
      typeof v.why_uncertain === 'string' &&
      typeof v.suggested_action === 'string' &&
      ['low', 'medium', 'high'].includes(v.severity)
    ) &&
    typeof data.effort_impact === 'string' &&
    Array.isArray(data.key_takeaways) &&
    typeof data.disclaimer === 'string'
  );
}

export function isDiagnosticAnalysisSummary(data: any): data is DiagnosticAnalysisSummary {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.listing_id === 'string' &&
    Array.isArray(data.bullets) &&
    data.bullets.length === 5 &&
    data.bullets.every((bullet: any) => typeof bullet === 'string' && bullet.length <= 140)
  );
}
