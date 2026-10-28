/**
 * External Renovation Analysis API Schema (Blueprint)
 *
 * Purpose
 * - Defines the exact JSON contract your Google Cloud API should return for renovation deep‑dive screens.
 * - Mirrors the hardcoded structure used in RenovationSliderMock so every UI string is data‑driven (no templates).
 * - All fields are optional unless marked REQUIRED. When data is absent, the UI should hide the related section.
 *
 * Conventions
 * - Money values are always in Euros. Use integers for whole‑euro fields; include range fields when uncertain.
 * - Time values are in months with decimals allowed (e.g., 0.5 == ~2 weeks). Provide min/max as ranges when applicable.
 * - URLs must be absolute HTTPS URLs. Images should be optimized and publicly accessible.
 * - Text strings should be plain text (no HTML). Use sentence case unless noted.
 * - Lists preserve order of items as returned.
 *
 * Top‑level object represents a single listing’s renovation analysis.
 */

export interface ExternalRenovationAnalysis {
  // REQUIRED: Property descriptor used in headers and section captions
  property: PropertyMeta;

  // REQUIRED: Technical report for "Today's State" card
  technicalReport: TechnicalReport;

  // REQUIRED: Tiers backing the Renovation Scenarios (tabs)
  tiers: Tier[];

  // OPTIONAL: Q&A/suggestions inputs powering Follow‑Up questions
  qa?: QASection;
}

/**
 * Property metadata powering header blocks and labels
 */
export interface PropertyMeta {
  // Full postal address (used as primary title where available).
  // Example: "Calle del Sol 12, Marbella, Málaga 29600, Spain"
  address: string; // REQUIRED, non‑empty string

  // Short marketing title (if different from address)
  title?: string; // optional, 3–120 chars

  // Pricing in EUR (whole number). If unknown, omit.
  price_eur?: number; // integer >= 0

  // Basic descriptors
  beds?: number; // integer >= 0
  baths?: number; // integer >= 0
  area_m2?: number; // integer >= 0 (constructed area)
  plot_m2?: number; // integer >= 0 (plot/land area)

  // Location helpers (optional but useful for maps/search)
  city?: string; // e.g., "Marbella"
  region?: string; // e.g., "Málaga"
  lat?: number; // -90..90
  lng?: number; // -180..180

  // Original listing URL (external)
  url?: string; // https://... absolute URL
}

/**
 * Technical state of the property today, shown in the "Today's State" card.
 * Provide succinct, human‑friendly summaries (max ~120 chars each).
 */
export interface TechnicalReport {
  structure: string; // REQUIRED. Ex: "Masonry frame; no visible cracks"
  electrical: string; // REQUIRED. Ex: "Aging panel; partial rewiring advised"
  plumbing: string; // REQUIRED. Ex: "Original copper/PVC mix; dated fixtures"
  windows: string; // REQUIRED. Ex: "Single pane; consider upgrade"
  energyRating: string; // REQUIRED. EU label or estimate (e.g., "E (estimated)")
  permitsLikely: string; // REQUIRED. Ex: "Minor/major depending on scope"
}

/**
 * Renovation Scenarios (tabs). Exactly three tiers are expected by UI order:
 * - livable (a.k.a. essential)
 * - comfortable (a.k.a. premium)
 * - competitive (a.k.a. enhanced)
 *
 * id must be one of: "livable" | "comfortable" | "competitive".
 */
export interface Tier {
  id: "livable" | "comfortable" | "competitive"; // REQUIRED

  // Human‑friendly tier name to display on the tab (e.g., "Livable").
  name: string; // REQUIRED, 3–40 chars

  /**
   * Before/After media carousel. Provide ordered list. If empty or missing, the UI hides the carousel.
   */
  beforeAfter?: BeforeAfterItem[];

  /**
   * Work scope. Prefer explicit ScopeItem objects. If unavailable, you may provide simple strings in `scope`
   * and the UI will infer reasonable defaults (trade, permit, time, cost) — but for full control, use scopeItems.
   */
  scopeItems?: ScopeItem[]; // preferred
  scope?: string[]; // fallback list of labels (each 5–80 chars)

  /**
   * Optional permit checklist (not displayed if empty). Keep each item short (<= 120 chars).
   */
  permitChecklist?: string[];
}

export interface BeforeAfterItem {
  beforeUrl: string; // REQUIRED, https URL
  afterUrl: string; // REQUIRED, https URL
  caption?: string; // optional, <= 120 chars
}

/**
 * A line item in the scope matrix (drives cost/time totals + permit derivation).
 * If any of the ranged values are unknown, approximate conservatively and document in notes.
 */
export interface ScopeItem {
  id: string; // REQUIRED stable id for diffs and selection (e.g., "livable-row-1")
  label: string; // REQUIRED, human‑friendly label, 5–80 chars (e.g., "Kitchen refresh: cabinets + worktop")
  trade: Trade; // REQUIRED
  permitImpact: PermitType; // REQUIRED (impacts timeline)
  time: MonthRange; // REQUIRED: duration range in months
  cost: MoneyRange; // REQUIRED: cost range in EUR
  selected?: boolean; // optional default selection (default true)
}

export type Trade =
  | "Kitchen"
  | "Bathroom"
  | "Windows/Insulation"
  | "HVAC"
  | "Plumbing"
  | "Electrical"
  | "Demolition"
  | "Masonry/Structural"
  | "Finishes";

export type PermitType = "none" | "minor" | "major" | "major_structural";

export interface MonthRange {
  min: number; // >= 0 (months, decimals allowed)
  max: number; // >= min
}

export interface MoneyRange {
  minEur: number; // >= 0, integer EUR
  maxEur: number; // >= minEur, integer EUR
}

/**
 * Optional Q&A block powering Follow‑Up prompts and answers.
 */
export interface QASection {
  // Input placeholder displayed above the question box
  placeholder?: string; // e.g., "Ask anything about this renovation"

  // Pre‑seeded suggestions the user can click. Keep 3–10 entries.
  suggestions?: string[]; // each 8–140 chars

  // Optional previously answered Q&A items; newest first.
  answers?: Array<{ question: string; answer: string }>; // each <= 500 chars
}

/**
 * Permit Notes (separate endpoint recommendation)
 *
 * This data powers the "Permit Notes" panel. If you return it within the main payload, that’s fine,
 * but we recommend a separate endpoint keyed by listingId for reuse across screens.
 */
export interface PermitNoteRecord {
  id: number; // integer id
  listingId: number; // integer listing id
  tierId: Tier["id"] | null; // optional association to a specific tier

  permitType: string; // e.g., "Licencia de Obra Menor"
  coversNote: string; // what it covers (1–3 sentences)
  filerNote: string; // who files (1–2 sentences)
  inputsNote: string; // required documents (can be a bullet‑style string)
  filingLocationNote: string; // where to file (city portal/town hall)
  expectationsNote: string; // timing/expectations (1–3 sentences)

  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

/**
 * Lessons (separate endpoint recommendation)
 */
export interface LessonRecord {
  id: number; // integer id
  listingId: number; // integer listing id
  topic: string; // short title, 5–60 chars
  note: string; // content, 20–500 chars
  priority: 1 | 2 | 3; // 1 (high), 2 (med), 3 (low)
  source: string; // e.g., "Field notes", "Architect"
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

/**
 * Example payload (trimmed)
 */
export const EXAMPLE_ANALYSIS: ExternalRenovationAnalysis = {
  property: {
    address: "Calle del Sol 12, Marbella, Málaga 29600, Spain",
    title: "Sunny Andalusian Villa",
    price_eur: 895000,
    beds: 4,
    baths: 3,
    area_m2: 210,
    plot_m2: 520,
    city: "Marbella",
    region: "Málaga",
    lat: 36.5108,
    lng: -4.8852,
    url: "https://example.com/listing/123",
  },
  technicalReport: {
    structure: "Masonry frame; no visible cracks",
    electrical: "Aging panel; partial rewiring advised",
    plumbing: "Original copper/PVC mix; dated fixtures",
    windows: "Single pane; consider upgrade",
    energyRating: "E (estimated)",
    permitsLikely: "Minor/major depending on scope",
  },
  tiers: [
    {
      id: "livable",
      name: "Livable",
      beforeAfter: [
        {
          beforeUrl: "https://cdn.example.com/ba/kitchen-before.jpg",
          afterUrl: "https://cdn.example.com/ba/kitchen-after.jpg",
          caption: "Kitchen refresh",
        },
      ],
      scopeItems: [
        {
          id: "livable-row-1",
          label: "Kitchen refresh: cabinets + worktop",
          trade: "Kitchen",
          permitImpact: "minor",
          time: { min: 0.5, max: 1.0 },
          cost: { minEur: 6000, maxEur: 12000 },
          selected: true,
        },
      ],
      permitChecklist: [
        "Community (HOA) approval",
        "Waste plan",
      ],
    },
    {
      id: "comfortable",
      name: "Comfortable",
      beforeAfter: [],
      scopeItems: [],
    },
    {
      id: "competitive",
      name: "Competitive",
      beforeAfter: [],
      scopeItems: [],
    },
  ],
  qa: {
    placeholder: "Ask anything about this renovation",
    suggestions: [
      "How are the nearby schools in this area?",
      "What should expats know about buying property here?",
      "Can I rent this place out and what are the rules?",
    ],
    answers: [],
  },
};