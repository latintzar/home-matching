export interface Property {
  id: string;
  title: string;
  address: string;
  price_eur: number;
  beds: number;
  baths: number;
  area_m2: number;
  plot_m2: number;
}

export interface TechnicalReport {
  structure: string;
  electrical: string;
  plumbing: string;
  windows: string;
  energyRating: string;
  permitsLikely: string;
  pdfUrl?: string;
}

export interface BeforeAfter {
  beforeUrl: string;
  afterUrl: string;
  caption: string;
}

export interface CostItem {
  item: string;
  rangeEur: string; // "€X–Y"
}

export type PermitStatus = "todo" | "done";

export interface PermitStep {
  step: string;
  owner: string;      // "Owner" | "Architect" | "GC"
  duration: string;   // "2 months", "4 weeks", etc.
  dependsOn?: string | null;
  status: PermitStatus;
}

export type TierId = "livable" | "comfortable" | "competitive";

export type Trade =
  | "Demolition"
  | "Masonry/Structural"
  | "Electrical"
  | "Plumbing"
  | "HVAC"
  | "Windows/Insulation"
  | "Kitchen"
  | "Bathroom"
  | "Finishes"
  | "SmartHome";

export type PermitType = "none" | "minor" | "major" | "major_structural";

export interface MonthRange {
  min: number; // in months
  max: number;
}

export interface MoneyRange {
  minEur: number;
  maxEur: number;
}

// Timeline phases for renovation plan (exactly 5 when rendered)
export interface TimelinePhase {
  name: string;           // e.g., "Planning & Permits"
  description: string;    // short subtitle
  weeks: string;          // human-friendly duration, e.g., "1–3 wk" or "TBD"
}

export interface ScopeItem {
  id: string;
  label: string;            // "Replace windows to double-glazed"
  trade: Trade;             // for grouping + contractor playbook
  permitImpact: PermitType; // local impact (none→major_structural)
  time: MonthRange;         // trade-level time for this item
  cost: MoneyRange;         // range for this item
  notes?: string;
  selected?: boolean;       // UX toggle
}

export interface Tier {
  id: TierId;
  name: string;               // "Essential" | "Comfortable" | "Premium"
  priceRangeEur: string;      // "€45k–65k"
  permitDifficulty: string;   // "Easy" | "Moderate" | "Complex"
  timeEstimate: string;       // "3–4 months"
  beforeAfter: BeforeAfter[];
  scope: any[];
  costBreakdown: CostItem[];
  permitChecklist: PermitStep[];      // permits are part of the contract
  // NEW: structured scope items; optional for backward compatibility
  scopeItems?: ScopeItem[];
  // NEW: structured timeline phases; optional for backward compatibility
  timeline?: TimelinePhase[];         // consumers normalize/pad to 5 for UI
}

export interface ProcessStep {
  stage: string;       // "Purchase contract"
  duration: string;    // "2–4 weeks"
  who: string;         // "Owner", "Architect + Owner", etc.
  deliverables: string[];
}

export interface QAAnswer {
  question: string;
  answer: string;
}

export interface QA {
  suggestedSearches: string[];
  mockAnswers: QAAnswer[];
  placeholder?: string;
}

export interface RenovationData {
  property: Property;
  technicalReport: TechnicalReport;
  tiers: Tier[];
  process: ProcessStep[];
  qa: QA;
}