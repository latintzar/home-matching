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
}

export interface BeforeAfter {
  beforeUrl: string;
  afterUrl: string;
  caption: string;
}

export interface CostItem {
  item: string;
  rangeEur: string;
}

export interface PermitStep {
  step: string;
  owner: string;
  duration: string;
  status: "todo" | "done";
}

export interface Tier {
  id: "lovable" | "fomrotable" | "competitive";
  name: string;
  priceRangeEur: string;
  permitDifficulty: string;
  timeEstimate: string;
  beforeAfter: BeforeAfter[];
  scope: string[];
  costBreakdown: CostItem[];
  permitChecklist: PermitStep[];
}

export interface ProcessStep {
  stage: string;
  duration: string;
  who: string;
  deliverables: string[];
}

export interface QA {
  suggestedSearches: string[];
  mockAnswers: {
    question: string;
    answer: string;
  }[];
}

export interface RenovationData {
  property: Property;
  technicalReport: TechnicalReport;
  tiers: Tier[];
  process: ProcessStep[];
  qa: QA;
}