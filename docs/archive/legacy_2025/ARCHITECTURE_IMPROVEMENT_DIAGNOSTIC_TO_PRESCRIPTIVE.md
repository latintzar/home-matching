# Architecture Improvement: Diagnostic to Prescriptive Pipeline

**Status:** 📋 Specification  
**Last Updated:** 2025-01-27  
**Purpose:** Refine the analysis, integrated analysis, and recommendations/renovations pipeline to produce credible, photo-anchored diagnostics and evidence-based renovation plans.

---

## 🎯 Goal & Principles

**Goal:** Make homes feel **possible** (not "perfect") by producing a credible, photo-anchored diagnostic and a refined, evidence-based renovation plan.

### Core Principles

1. **Diagnostic before prescriptive** — Complete understanding before recommendations
2. **Supportive realism** — Credible, enabling tone; never alarmist or salesy
3. **One canonical truth per topic in the UI** — No duplicated or stale tables
4. **Photo-anchored evidence** — Explicit about what's visible vs. uncertain

---

## 0) Scope & Non-Goals

### What Gets Hidden from UI

- **`/renovation-scope` is now internal-only** (draft ideation). It seeds the chain but is **never shown** to users.
- Rough timings/costs in scope are internal; UI uses refined results from `/renovation-timeline` and `/renovation-pricing`.

### UI Display Rules

- **UI shows only:**
  - Integrated Analysis (diagnostic) + per-room bullets with mini-carousel
  - Finalized Renovation tiers (Estándar/Óptimo/Plus)
  - Next Steps (buyer advisory)
- **Permits displayed in UI come only from `/renovation-permits`** (single source of truth).

---

## 1) Endpoints (Create/Update)

### A. Photo Analysis (Updated)

#### 1. `POST /api/listings/[id]/photo-analysis/whole-property`

- **Input:** `listing_id`, `photos[]` (all non-plan images), minimal listing metadata
- **Model:** Gemini 2.5 Pro, **max-thinking**, low temp
- **Output:** `WholePropertyAnalysis` (see data contracts)
- **Purpose:** Comprehensive property assessment across multiple lenses

#### 2. `POST /api/listings/[id]/photo-analysis/room-by-room`

- **Input:** `listing_id`, `rooms[]` with photos per room (clusters), minimal listing metadata
- **Model:** Gemini 2.5 Pro, **max-thinking**, low temp
- **Output:** `RoomAnalyses` (array of `RoomAnalysis`)
- **Purpose:** Per-room detailed analysis

#### 3. `POST /api/listings/[id]/photo-analysis/room-bullets` *(NEW)*

- **Purpose:** Rewrite each `RoomAnalysis` into 4–7 buyer-friendly bullets for the Integrated Analysis UI
- **Input:** `RoomAnalyses`
- **Output:** `RoomBullets[]`
- **Tone:** Supportive realism, concise, buyer-facing

> **Critical Rule:** Do not feed whole-property text into room analysis (avoid bias). Run both in parallel; they first meet inside Integrated Analysis.

---

### B. Diagnostic (Updated Schema)

#### 4. `POST /api/listings/[id]/analysis/integrated`

- **Consumes:**
  - `WholePropertyAnalysis`
  - `RoomAnalyses`
  - Text Analysis outputs (B3 snippets, C unknowns)
  - (Optional) curated research headlines
- **Produces:** **Integrated Diagnostic Report** (revised schema below)
- **Model:** Gemini 2.5 Pro, low temp, structured JSON
- **Changes:** Revised schema (see data contracts section)

#### 5. `POST /api/listings/[id]/analysis/integrated-summary`

- **Produces:** 5× ≤140-char supportive-realism bullets for the preview card
- **Input:** Diagnostic report from endpoint #4

#### 5.5. `POST /api/listings/[id]/analysis-google-search` *(NEW - Consolidated)*

- **Purpose:** Consolidated endpoint for analysis-phase Google research (replaces separate search + curation endpoints)
- **Flow:**
  1. Generate queries for all 15 research categories (`RESEARCH_CATEGORIES`)
  2. Execute Google searches in parallel
  3. Score domains for credibility (high/medium/low/unknown)
  4. Sort & filter by credibility + rank per category
  5. Curate all results by category using Gemini
- **Saves:**
  - `research_search_results` (after step 2)
  - `domain_credibility_cache` (populated via domain-credibility endpoint)
  - `research_curated_results` (after step 5)
- **Output:** Summary with queries generated, searches executed, domains scored, categories curated
- **Benefits:** Single orchestration call, intermediate saves for debugging, credibility filtering ensures quality

---

### C. Recommendations (Existing + Small Changes)

#### 6. `POST /api/listings/[id]/renovation-scope`

- **Now internal-only:** Seeds tiers & work items using all diagnostics + photo passes (no UI exposure)
- **Status:** Remains as implemented; keep for internal orchestration

#### 7. `POST /api/listings/[id]/renovation-google-search` *(NEW - Consolidated)*

- **Purpose:** Consolidated endpoint for renovation-phase Google research (replaces separate queries + search + curation endpoints)
- **Flow:**
  1. Generate queries for all tiers × categories (3 tiers × 7 categories = 21 sets)
  2. Execute all Google searches in parallel
  3. Validate domains (two-tier credibility control) BEFORE curation
     - Core static whitelist per category (Spain/EU focus)
     - Dynamic AI-derived whitelist: for unknown domains, ask Gemini YES/NO + confidence; cache result
  4. Curate only validated snippets by tier × category using Gemini
- **Saves:**
  - `renovation_research_queries` (optional, after step 1)
  - `renovation_search_results` (after step 2)
  - `ai_domain_whitelist` (new; dynamic approvals with category + confidence)
  - `renovation_research_results` (after step 4, format: `{category}_{tier}`)
- **Output:** Summary with query sets generated, searches executed, curations completed per tier/category
- **Benefits:** Single orchestration call instead of 25+ separate endpoint calls, intermediate saves for debugging
- **Note:** Old individual endpoints (`/renovation-research-queries`, `/renovation-research-search`, `/renovation-research-curate-*`) remain available during migration period

#### 8. `POST /api/listings/[id]/renovation-research-aggregate` *(Existing)*

- **Purpose:** Merge per-item evidence → canonical tier evidence map

**Research Aggregation Details:**
- **Purpose:** Collector and normalizer between per-item, per-category curation endpoints and precision passes (pricing/timeline/permits)
- **Input:** `listing_id`, `tier`
- **Process:**
  1. Fetches all curated research results for listing + tier from `research_curated_results` table
  2. Normalizes data: cleans summaries, extracts metrics (€/m², weeks, %, etc.)
  3. Merges by work item: groups under each `work_item_name`, fuses duplicates, keeps highest-confidence values
  4. Outputs consolidated `AggregatedResearchResults` object per tier
- **Output:** One unified JSON map per tier with all 7 categories (costs, timings, permits, laws, norms, market, incentives) grouped by work item
- **Why Needed:** Without it, 21 independent curation results (3 tiers × 7 categories × many work items) remain scattered. Aggregator provides single normalized structure for downstream endpoints to consume reliably.

#### 9. `POST /api/listings/[id]/renovation-pricing`

- **Consumes:** Aggregated research (all tiers) + scope work_items (current tier)
- **Produces:** Cost ranges per work item + tier totals with basis notes
- **Change:** Now accepts all-tiers aggregated evidence for precision

#### 10. `POST /api/listings/[id]/renovation-timeline`

- **Consumes:** Aggregated research (time + market + permits), scope work_items (current tier)
- **Produces:** Phased schedule with week offsets, dependencies, inspections
- **Enhanced:** Insert real inspections (pre, mid, final), contractor lead times, municipal delays

#### 11. `POST /api/listings/[id]/renovation-permits`

- **Consumes:** Aggregated research (permits + laws + norms), scope "likely_permits" hints
- **Produces:** Canonical permit list with why/what docs/authority/duration/pitfalls
- **Status:** **UI source of truth for permits** (drop scope's permit table)

#### 12. `POST /api/listings/[id]/renovation-scope-finalize` *(NEW)*

- **Purpose:** Reconcile scope with refined pricing/timeline/permits; drop/merge/retier work items; output **UI-ready tiers**
- **Consumes:**
  - Seed scope (internal)
  - Pricing results
  - Timeline results
  - Permits results
- **Produces:** `FinalRenovationScope` stored as **new records** in `final_renovation_scope` table (not updating existing `renovation_tiers`)
- **Rationale:** Creates separate final records for UI control; keeps internal scope intact for audit trail

#### 13. `POST /api/listings/[id]/recommendations/next-steps`

- **Consumes:** Integrated Diagnostic + FinalRenovationScope
- **Produces:** Buyer advisory *Próximos Pasos*:
  - Key verifications
  - Practical implications
  - Preparation tips
  - Mindset check

---

## 2) Data Contracts (TypeScript)

### A. Photo Analysis

```typescript
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
```

### B. Integrated Diagnostic (Revised)

```typescript
export interface DiagnosticAnalysisReport {
  listing_id: string;
  analysis_date: string;

  // 7 factual categories (keep these headings stable)
  findings_by_category: {
    estado_materiales: string;          // Finishes & surfaces
    espacios_distribucion: string;      // Layout & flow
    entorno_vistas: string;             // Light, outlook, exposure
    servicios_instalaciones: string;    // Visible MEP hints
    legal_economico: string;            // Listing-level legal/econ notes
    seguridad_accesibilidad: string;    // Observed safety & access
    caracter_arquitectonico: string;    // Style/period cues
  };

  visible_strengths: string[];          // Photo-anchored positives (replace 'opportunities')
  critical_unknowns: string[];          // What's not visible / unverified
  verification_checks: string[];        // 1:1 with unknowns — what to confirm at viewing
  effort_impact: string;                // What this implies for buyer effort/timeline (no "next steps" text here)
  key_takeaways: string[];              // Exactly 5 bullets ≤ 140 chars
  limitations: string;                  // Explicit "photos-only" disclaimer
  confidence_notes: string;             // Confidence + why
  photo_coverage_summary: string;       // Where evidence was thin or missing
}
```

### C. Research Aggregation → Pricing/Timeline/Permits

```typescript
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
```

### D. Final Scope (UI)

```typescript
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
```

---

## 3) Prompts (Concise, Production-Ready)

### A. Photo Analysis

#### Whole-Property (max-thinking, low temp)

```
SYSTEM:
You are a building inspector reviewing ALL photos of one property.
Report ONLY what can be seen. If uncertain, say so.
Analyze under these lenses:
- Structural & Envelope
- Finishes & Surfaces
- Lighting & Ventilation
- Fittings & Fixtures
- Energy & Insulation
- Accessibility & Safety
- Spatial Coherence & Flow
- Potential & Limitations

OUTPUT: WholePropertyAnalysis JSON (fields must match).
STYLE: factual, concise, no speculation; include confidence_notes and photo_coverage_summary.
```

#### Room-by-Room (per cluster; no whole-set text input)

```
SYSTEM:
You are reviewing photos of ONE room. Use ONLY visible evidence.
Lenses:
- Structural & Envelope
- Finishes & Surfaces
- Lighting & Ventilation
- Fittings & Fixtures
- Moisture & Hygiene
- Energy & Insulation
- Accessibility & Safety
- Potential & Limitations

OUTPUT: RoomAnalysis JSON for this room. Include notable_issues[], overall_room_condition, confidence.
```

#### Room Bullets (buyer-friendly)

```
SYSTEM:
Rewrite each RoomAnalysis into 4–7 concise, buyer-facing bullets.
Tone: supportive realism (credible, enabling, non-salesy).
Each bullet ≤ 140 chars where possible.
OUTPUT: RoomBullets[] (room_id, room_name, bullets[]).
```

### B. Integrated Diagnostic (Revised)

```
SYSTEM:
Produce a diagnostic report that synthesizes WholePropertyAnalysis + RoomAnalyses + Text Analysis.
No advice. No sales language. Photos-only credibility.
Map critical_unknowns → verification_checks (1:1).
Replace 'opportunities' with 'visible_strengths' (photo-anchored).
Include effort_impact (effort/timeline implication only).
Include confidence_notes and photo_coverage_summary.
OUTPUT: DiagnosticAnalysisReport JSON (fields must match).
```

#### Summary (5 bullets)

```
SYSTEM:
Write 5 bullets (≤140 chars) capturing the diagnostic's essence.
Tone: calm, factual, encouraging (supportive realism).
OUTPUT: {"listing_id":"...", "bullets":["...x5"]}.
```

### C. Recommendations Chain

**Scope (internal):** Seed 3 tiers + work items from diagnostics & photo passes.

**Queries/Search/Curate (per tier × per work item × 7 categories):** Already implemented—keep per-item granularity.

**Aggregate:** As specified in `AggregatedResearchResults`.

**Pricing:** Use aggregated evidence from **all tiers**; apply basis note per item; include VAT note logic separately if needed.

**Timeline:** Insert real inspections (pre, mid, final), contractor lead times, municipal delays; produce dependencies.

**Permits:** Replace placeholders; single truth for UI.

#### Scope-Finalize Prompt (NEW)

```
SYSTEM:
Given (a) seed scope (internal), (b) Pricing, (c) Timeline, (d) Permits,
reconcile final tiers:
- Drop or merge unrealistic/overlapping items
- Ensure Estándar=feasible baseline, Óptimo=balanced uplift, Plus=ambitious
- Align item durations/dependencies with timeline
- Attach canonical permits (from Permits endpoint)
OUTPUT: FinalRenovationScope JSON (match interface).
```

---

## 4) Orchestration (Single Listing)

```
Photos → [Whole-Property] + [Room-by-Room]             (parallel)
          ↓                   ↓
           └───────────────┬──┘
                           ↓
                [Room-Bullets] (from RoomAnalyses)
                           ↓
                /analysis/integrated  →  /analysis/integrated-summary
                           ↓
                   /renovation-scope  (internal seed - NOT shown to UI)
                           ↓
   /renovation-research-queries → search → curate (7 cats, per item) → aggregate
                           ↓
       /renovation-pricing · /renovation-timeline · /renovation-permits
                           ↓
                 /renovation-scope-finalize  (UI-ready tiers)
                           ↓
        ~~/renovation-style-prompts~~ → **REMOVED** (replaced by R2b → R3, out of scope here)
                           ↓
               /recommendations/next-steps  (buyer advisory)
```

### Key Orchestration Rules

1. **Parallel execution:** Whole-property and room-by-room analysis run simultaneously (no bias)
2. **Room bullets generated separately** from integrated analysis (buyer-facing transformation)
3. **Scope is internal-only** — never exposed to UI
4. **Research aggregation happens before** pricing/timeline/permits finalization
5. **Scope-finalize produces UI-ready tiers** that replace all intermediate scope data

---

## 5) UI Requirements (Integrated Report Popup)

### Header
- Listing basics (title, price, size, beds/baths)

### Whole-Property Overview
- 5–7 sentence diagnostic (from integrated)
- **Visible strengths** prominently displayed

### Per-Room Sections

Each room takes up **full width** of the popup with a side-by-side layout:

```
┌─────────────────────────────────────────┐
│ Room Name Header                        │
├──────────────────┬──────────────────────┤
│                  │                      │
│ Photo Carousel   │  Bullets (4–7 pts)  │
│ (thumbnails →    │  (from room-bullets) │
│  lightbox)       │                      │
│                  │                      │
└──────────────────┴──────────────────────┘
```

- **Layout:** Photo carousel on left, bullets on right (50/50 split)
- **Room title:** Header across full width (e.g., "Kitchen")
- **Photo carousel:** Thumbnails that expand to lightbox on click
- **Bullets:** 4–7 concise buyer-friendly points from `/photo-analysis/room-bullets`

### Verification Checks
- Short checklist mapped 1:1 to `critical_unknowns`
- Format: "Confirm X", "Revisar Y"

### Effort Impact
- 2–3 sentences explaining what this implies for buyer effort/timeline

### Limitations + Confidence
- Explicit photos-only disclaimer
- Coverage notes (what was missing or unclear)

### Optional: Lightweight Citations
- Up to 1–2 source labels per relevant legal/cost fact
- Domain name only, no link spam

### What Users Never See

- ❌ Scope (internal) tables
- ❌ Intermediate permit tables from scope
- ❌ Draft work items before finalization
- ❌ Rough cost/timing estimates (only refined from pricing/timeline endpoints)

---

## 6) Testing & Acceptance

### Photo Passes

- **Deliberately remove 20–30% of photos;** `photo_coverage_summary` must reflect gaps
- **Similar-looking rooms** must still yield distinct room analyses (no whole-property bias)
- **Parallel execution test:** Whole-property and room analyses should not reference each other

### Integrated Diagnostic

- `critical_unknowns.length === verification_checks.length` (1:1 mapping) ✅
- `key_takeaways.length === 5` and each ≤ 140 chars ✅
- `visible_strengths` array populated (replaces 'opportunities')
- `effort_impact` provides timeline implication only (no prescriptive "next steps")

### Permits

- UI shows only `/renovation-permits` output ✅
- Scope contains no permit table (all removed)
- Permits list matches work items that `requires_permit: true`

### Scope-Finalize

- Estándar/Óptimo/Plus must be clearly differentiated in cost and complexity ✅
- Totals must equal the sum of item ranges within ± rounding tolerance ✅
- No overlapping or duplicate work items
- Permits attached from canonical permits endpoint

### End-to-End

- Toggle a high-cost market scenario (market summaries) and confirm timeline/pricing shift accordingly
- Verify room bullets appear in UI with photo carousel
- Verify verification checks map correctly to unknowns
- Test with incomplete data (missing photos, missing text analysis) — must handle gracefully

---

## 7) Migration Notes

### Database Schema Updates

Add storage tables for:
- `whole_property_analysis` — Store `WholePropertyAnalysis`
- `room_analyses` — Store `RoomAnalyses[]`
- `room_bullets` — Store `RoomBullets[]` **(stored separately, not generated on-demand)**
- `diagnostic_analysis` — Store `DiagnosticAnalysisReport` (updated schema)
- `research_aggregated_results` — Store `AggregatedResearchResults`
- `final_renovation_scope` — Store `FinalRenovationScope` (UI source of truth - **new records**)

### UI Component Updates

1. **Hide scope tables/permit tables from existing UI**
   - Scope endpoint remains for internal orchestration only
   - Remove any UI components that display draft scope data

2. **Update Integrated Analysis UI**
   - **Add room-by-room sections** (currently missing)
   - Each room: full-width section with room name header
   - Layout: Photo carousel (left) + Bullets (right) side-by-side
   - Photos: Thumbnails that expand to lightbox on click
   - Bullets: 4–7 concise points from `room_bullets` table
   - Display `visible_strengths` (replace 'opportunities')
   - Show `verification_checks` mapped to `critical_unknowns`
   - Display `effort_impact` (timeline implication only)

3. **Update Renovation Tiers UI**
   - Pull from `final_renovation_scope` table (not scope)
   - Display permits from canonical permits endpoint only
   - Show refined pricing/timeline from dedicated endpoints

### Endpoint Adjustments

- Ensure endpoints accept **all-tiers aggregated evidence** in precision passes while retaining **tier-specific prompts** for relevance
- Add `/renovation-research-aggregate` endpoint
- Add `/renovation-scope-finalize` endpoint
- Update `/analysis/integrated` to use revised schema
- Update `/photo-analysis/room-by-room` to enforce no whole-property text input
- Add `/photo-analysis/room-bullets` endpoint

### Data Flow Migration

1. **Existing listings:** Run new endpoints to populate updated schema
2. **Diagnostic regeneration:** 
   - Regenerate all `DiagnosticAnalysisReport` records with new schema (including `visible_strengths`)
   - Delete old records with `opportunities` field (no customer data, safe to regenerate)
3. **Room bullets:** Store separately in `room_bullets` table (not generated on-demand)
4. **Scope-finalize:** Creates new `final_renovation_scope` records (not updating existing `renovation_tiers`)
5. **Progressive enhancement:** UI should handle missing room bullets gracefully (show room analysis as fallback)
6. **Backward compatibility:** Keep existing endpoints until migration complete

---

## 8) Tone & Safety

### Tone Across All Outputs

**Supportive Realism** — Credible, enabling, never alarmist or salesy

- ✅ "Visible cues suggest structural soundness"
- ✅ "Photos indicate potential moisture concerns; verify during viewing"
- ❌ "This property is perfect!"
- ❌ "This property has serious problems"

### Credibility Language

- Never assert hidden conditions
- Use confidence language: "visible cues suggest...", "appears to be...", "likely indicates..."
- Always distinguish: "observed" vs "inferred" vs "unknown"

### Citations

- At most 1–2 **domain labels** per legal/cost section
- Format: Inline as "(source.com)" or domain name only
- No link spam or excessive citations

---

## 9) Deliverables Summary

### Implementation Checklist

- [x] Implement/adjust photo analysis endpoints (#1, #2, #3) ✅ **COMPLETE**
  - `/photo-analysis/whole-property` - Uses REST client with base64 images, saves to `whole_property_analysis`
  - `/photo-analysis/room-by-room` - Uses REST client with base64 images, saves to `room_analyses`
  - `/photo-analysis/room-bullets` - Transforms room analyses into buyer-friendly bullets, saves to `room_bullets`
- [x] Update integrated analysis endpoint with revised schema (#4) ✅ **COMPLETE**
  - Consumes new photo analysis tables (`whole_property_analysis`, `room_analyses`)
  - Outputs revised schema: `visible_strengths`, `effort_impact`, `confidence_notes`, `photo_coverage_summary`
  - Validates 1:1 mapping of `critical_unknowns` → `verification_checks`
  - Uses REST client with structured JSON output
- [x] Update integrated-summary endpoint (#5) ✅ **COMPLETE**
  - `/analysis/integrated-summary` - Generates 5×≤140-char bullets from diagnostic report
  - Uses new schema, saves to `text_analysis_results` with phase `integrated_summary`
  - Falls back to `key_takeaways` if already perfect
- [x] Add research aggregation endpoint (#7) ✅ **COMPLETE**
  - `/renovation-research-aggregate` - Aggregates curated research per tier/work-item, saves to `research_aggregated_results`
- [x] Update pricing/timeline/permits endpoints to consume aggregated research (#8, #9, #10) ✅ **COMPLETE**
  - All three endpoints now read from `research_aggregated_results` instead of raw curated research
  - Use REST client with structured output (`responseSchema`)
  - Save to respective report tables
- [x] Add scope-finalize endpoint (#11) ✅ **COMPLETE**
  - `/renovation-scope-finalize` - Reconciles scope + pricing + timeline + permits
  - Outputs `FinalRenovationScope`, saves to `final_renovation_scope` table
- [x] Add next-steps endpoint (#12) ✅ **COMPLETE**
  - `/recommendations/next-steps` - Buyer advisory Próximos Pasos
  - Consumes Integrated Diagnostic + FinalRenovationScope
  - Outputs `NextStepsReport` with 4 sections: key_verifications, practical_implications, preparation_tips, mindset_check
  - Saves to `next_steps_reports` table
- [ ] Update UI to hide internal scope tables ⚠️ **PENDING**
- [ ] Update Integrated Analysis UI with per-room bullets + carousel ⚠️ **PENDING**
- [ ] Update Renovation Tiers UI to use final scope ⚠️ **PENDING**
- [x] Create database tables for new data contracts ✅ **COMPLETE**
  - Migration `014_architecture_improvement_tables.sql` created with all required tables
- [ ] Update orchestration to follow new flow ⚠️ **PENDING** - Orchestration scripts need update
- [ ] Test end-to-end with incomplete data scenarios ⚠️ **PENDING** - Needs testing after UI updates

### Success Criteria

- ✅ Diagnostic report is photo-anchored and credible
- ✅ Room bullets appear in UI with photo carousel
- ✅ Verification checks map 1:1 to unknowns
- ✅ UI shows only finalized tiers (not draft scope)
- ✅ Permits come only from canonical permits endpoint
- ✅ Supportive realism tone throughout
- ✅ No duplicated or stale tables in UI

---

## 10) Related Documentation

- **[Analysis Pipeline](ANALYSIS_PIPELINE.md)** — Current analysis phase documentation
- **[Integrated Analysis Spec](INTEGRATED_ANALYSIS_SPEC.md)** — Current integrated analysis implementation
- **[Renovation Intelligence Architecture](RENOVATION_INTELLIGENCE_ARCHITECTURE.md)** — Current renovation pipeline
- **[Research Curation Architecture](RESEARCH_CURATION_ARCHITECTURE.md)** — Google Search research pipeline

---

**Last Updated:** 2025-01-27  
**Status:** 🚧 In Progress - Backend Endpoints Complete, UI Pending  
**Implementation Progress:** 10/11 endpoints complete ✅ | Database ready ✅ | UI updates pending ⚠️

