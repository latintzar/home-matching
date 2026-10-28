# Renovation Tiers V2: Tone, Data Contracts, Prompts, and Validation (Chunk 2)

Last updated: 2025-01-27

The below hits the core of two intertwined problems: **language precision for users**, and **data precision for consistency**. Let's unpack it surgically, with zero fluff.

---

## 2️⃣ Data Flow — Keeping Materials/Surfaces Consistent

**Critical**: Your per-room analysis (E1-E2) is now the authoritative description of surfaces and objects.

This needs to cascade cleanly through all the way to renovation tier logic and style generation.

### 🧩 A. Merge into the Photo Analysis Schema

Both whole-property and room-by-room analyses should now carry a reference block from E1-E2:

```json
"layout_reference": {
  "room_id": "cluster_2",
  "surfaces": { "floor": "oak", "walls": "matte_white" },
  "objects": ["sofa", "table", "doorway to cluster_3"]
}
```

So your integrated analysis endpoint receives:

```json
{
  "photoAnalysis": {
    "wholeProperty": {...},
    "roomByRoom": [
      {..., "layout_reference": {...}}, ...
    ]
  }
}
```

That makes it straightforward later to say:

> "When generating renovation scopes, reference the existing surfaces and objects for realism."

### 🧩 B. Feed into Renovation Tier Generation

Your `/renovation-scope` prompt now explicitly takes this:

```ts
export interface ScopeSeedInput {
  ...
  room_layouts: RoomLayoutJSON[];    // E1 outputs
  unified_layout: HomeLayoutJSON;    // E2 output
}
```

Then modify the prompt body (see Section 1 below) to:

- Use `room_layouts` to identify surfaces or elements that visibly require update
- Mention materials (`surfaces.floor`, `surfaces.walls`) and visible adjacencies to support realistic cross-room continuity
- Reference `unified_layout.connections` to ensure structural changes are physically consistent

That way:

- Each tier reuses the same material vocabulary (oak → oak upgrade / replace oak with porcelain, etc.)
- Your "knock down wall between kitchen and living room" statements are physically consistent with E2's connections array
- You can even add small "cross-room rationale" lines ("opening between kitchen and living area permits uniform flooring")

---

## 🧱 1️⃣ Tone & Language of Work Items

Yes — I fully caught your note, and you’re absolutely right.

### 🎯 Goal

The work item list should **read like a renovation plan you can picture**, not a bill of quantities.

Here’s a clean, **drop-in update** for every endpoint **from `renovation-scope` onward** (excluding the Google-search mini-pipeline). It bakes in your naming tone, mandatory photo linkage, permit/job mapping, offseted timelines, and totals computed only in the finalizer.

---

## Decisions (2025-11-03)
- Seed IDs: Deterministic and stable per item (e.g., `opt-03`) so pricing, timeline, and permits stitch to the same job across passes and re‑runs.
- Photo refs policy: Accept `listing_photos.id` (preferred). If unavailable, accept `room_ref`/cluster id as a fallback; seed should fail without at least one of these.
- Permits approach (v1): Let the model output free‑text `permit_type` and details; no taxonomy table required initially.
- Timeline mapping: 100% of items must be mapped to phases; re‑prompt/refine until all are placed.
- Language: Spanish by default for buyer‑facing text (permits, next‑steps excerpts shown in UI).
- AJV: Validate all outputs server-side before persisting; return 422 on failure (no partial saves).
- Final-scope vs tiers finalizer: `renovation-scope-finalize` powers tier UI; `analysis/final-scope` powers Verify and Next Steps.
- Redirect links: display destination domain for redirected URLs when shown to users.
- Gemini SIs: Use explicit system instructions to enforce tone/structure and strict JSON schemas per step.

# 1) `POST /api/listings/[id]/renovation-scope` *(internal seed ideation)*

### Data contract

```ts
export interface ScopeSeedInput {
  listing_id: string;
  diagnostic_report_id: string;           // from Integrated Analysis
  whole_property_analysis_id: string;
  room_analyses_id: string;               // clusters/rooms
  room_layouts: RoomLayoutJSON[];         // E1 outputs: per-room layouts with surfaces, objects
  unified_layout: HomeLayoutJSON;         // E2 output: complete home layout with connections
  // Optional: style_direction_id if you already run it earlier
}

export type TierId = "estandar" | "optimo" | "plus";

export interface ScopeWorkItemSeed {
  id: string;                             // stable across pipeline (e.g., "opt-03")
  tier: TierId;                           // DO NOT change downstream
  name: string;                           // plain, referential: "Replace flooring in the living room"
  subtitle?: string;                      // short realism: "Continuous oak-look porcelain to unify space"
  room_ref?: string;                      // room/cluster id
  photo_refs: string[];                   // BEFORE photos (at least one) — mandatory
  // Internal-only hints (no UI use; can aid mapping in refinements):
  likely_permit_types_guess?: string[];   // e.g., ["obra_mayor","obra_menor","comunidad"]
  notes_internal?: string;                // terse, technical note for downstream prompts
}

export interface ScopeSeedOutput {
  listing_id: string;
  tiers: Record<TierId, {
    title: string;                        // UI label if you want (“Livable / Comfortable / Competitive”)
    work_items: ScopeWorkItemSeed[];      // 5–10 per tier
  }>;
  generated_at: string;
}
```

### Prompt (scope seed)

```
SYSTEM:
You are creating an initial, buyer-digestible renovation plan seed for three tiers (Estándar, Óptimo, Plus).
Use the diagnostic report + whole-property + room analyses + room layouts.

GOAL:
Create 5–10 plainspoken work items per tier. Each item must be easy to picture and link to at least one BEFORE photo.

NAMING RULES (critical):
- Natural, referential, one line: "Replace flooring in the living room", "Knock down wall between kitchen and living room".
- Subtitle (optional): add one short, realistic detail ("Continuous oak-look porcelain"; "Paint walls and ceiling in warm white").
- Avoid technical jargon and BoQ. Users need to see what's changing, not how it's built.

LAYOUT CONSISTENCY (critical):
- Use room_layouts to identify surfaces or elements that visibly require update.
- Reference existing materials (surfaces.floor, surfaces.walls) to support realistic upgrades:
  * "Replace oak flooring" (not generic "replace flooring")
  * "Upgrade matte white walls to semi-gloss" (preserves material continuity)
- Use unified_layout.connections to ensure structural changes are physically consistent:
  * "Knock down wall between kitchen and living room" only if connections array shows adjacency
  * Add cross-room rationale: "Opening between kitchen and living area permits uniform flooring"
- Reuse the same material vocabulary across tiers (oak → oak upgrade / replace oak with porcelain, etc.).

STRUCTURE:
- Do NOT include costs, durations, or dependencies here.
- Include room_ref when clear, and ALWAYS include at least one photo_ref for UI linking.
- If you anticipate permits, add likely_permit_types_guess minimally (e.g., "obra_mayor" for structural or layout changes).

OUTPUT:
Valid JSON matching ScopeSeedOutput. Preserve tier per item; tiers must be meaningfully distinct.
```

---

# 2) `POST /api/listings/[id]/renovation-pricing` *(precision pass)*

### Data contract

```ts
export interface PricingInput {
  listing_id: string;
  seed: ScopeSeedOutput;
  aggregated_research_id: string; // from your research aggregator (all tiers, per-item evidence)
}

export interface PricedItem {
  id: string;          // same as seed
  tier: TierId;        // immutable
  cost_low_eur: number;
  cost_high_eur: number;
  cost_basis: string;  // short basis: "habitissimo 2025 avg (Mallorca)"; "supplier quotes map"
  confidence: "high" | "medium" | "low";
}

export interface PricingOutput {
  listing_id: string;
  priced_items: PricedItem[];
  rounding_rules: {
    item: "nearest_€100";
    totals: "nearest_€1,000";
  };
  generated_at: string;
}
```

### Prompt (pricing)

```
SYSTEM:
Price each work item from the scope seed using aggregated research evidence.
Return ranges per item; do not compute tier totals here.

RULES:
- Keep tier and id from seed unchanged.
- Use evidence from the aggregator; add a short cost_basis note.
- Round item ranges to nearest €100 (finalizer will handle totals rounding).

OUTPUT:
Valid JSON matching PricingOutput. No new or missing ids.
```

---

# 3) `POST /api/listings/[id]/renovation-timeline` *(precision pass)*

### Data contract

```ts
export interface TimelineInput {
  listing_id: string;
  seed: ScopeSeedOutput;
  aggregated_research_id: string; // timings + market + permit durations
}

export interface TimelinePhase {
  name: string;                   // "Design & Permits", "Wet Areas & Electrical", etc.
  subtitle: string;               // one-line realism: "Submit mayor works license; select materials"
  duration_weeks: number;         // integer (no offsets here)
}

export interface ItemPlacement {
  id: string;                     // work item id
  phase_name: string;             // must match a phase name above
}

export interface TimelineOutput {
  listing_id: string;
  phases: TimelinePhase[];        // ordered
  item_placement: ItemPlacement[];// map items to phases
  notes?: string[];               // brief scheduling assumptions
  generated_at: string;
}
```

### Prompt (timeline)

```
SYSTEM:
Produce an ordered list of timeline phases with durations (weeks) and one-line subtitles.
Also map each work item id to the phase where it mainly happens.

RULES:
- Do NOT compute start offsets. Do NOT compute totals. The finalizer will do that.
- Include real inspections and admin phases (e.g., ITE check, permit wait, commissioning).
- Keep phase count compact (5–7). Use realistic durations by evidence.

OUTPUT:
Valid JSON matching TimelineOutput.
```

---

# 4) `POST /api/listings/[id]/renovation-permits` *(precision pass)*

### Data contract

```ts
export interface PermitsInput {
  listing_id: string;
  seed: ScopeSeedOutput;
  aggregated_research_id: string; // permits + laws + norms for location
}

export interface PermitRecord {
  permit_type: string;                // "Licencia de Obra Mayor", "Comunicación Previa de Obra Menor", "Autorización Comunidad"
  applies_to_work_ids: string[];      // ids from seed
  why_needed: string;                 // 2–4 lines, plain Spanish
  what_needed: string[];              // docs list
  issuing_authority: string;          // e.g., "Ayuntamiento de Calvià"
  expected_time_weeks: number;        // integer
  pitfalls?: string[];                // optional
  confidence: "high" | "medium" | "low";
}

export interface PermitsOutput {
  listing_id: string;
  permits: PermitRecord[];
  generated_at: string;
}
```

### Prompt (permits)

```
SYSTEM:
Determine which permits apply to WHICH work items. Explain each permit once and reference its work ids.

RULES:
- Map permits at the WORK level (not the tier level).
- Keep explanations concise and practical: why, docs, authority, expected time, pitfalls.
- Use local norms from evidence; don’t duplicate identical permit text per tier.

OUTPUT:
Valid JSON matching PermitsOutput. applies_to_work_ids must be a subset of seed ids.
```

---

# 5) `POST /api/listings/[id]/renovation-scope-finalize` *(single source of truth for UI)*

### Data contract

```ts
export interface ScopeFinalizeInput {
  listing_id: string;
  seed: ScopeSeedOutput;
  pricing: PricingOutput;
  timeline: TimelineOutput;
  permits: PermitsOutput;
}

export interface FinalWorkItem {
  id: string;
  tier: TierId;                           // unchanged
  name: string;                           // from seed
  subtitle?: string;                      // from seed
  room_ref?: string;
  photo_refs: string[];
  cost_low_eur: number;
  cost_high_eur: number;
  stage: string;                          // equals a TimelinePhase.name
}

export interface FinalPermit {
  permit_type: string;
  why_needed: string;
  what_needed: string[];
  issuing_authority: string;
  expected_time_weeks: number;
  applies_to_work_ids: string[];
}

export interface FinalTimelinePhase {
  name: string;
  subtitle: string;
  start_offset_weeks: number;             // computed cumulative
  duration_weeks: number;                 
  display_duration: string;               // "6 weeks" or "~3 months" if >8 weeks (nearest)
}

export interface FinalRenovationScope {
  listing_id: string;
  generated_at: string;
  tiers: Record<TierId, {
    title: string;                        // "Livable"|"Comfortable"|"Competitive" (or localized)
    tier_subtitle: string;                // one-liner about intent
    work_items: FinalWorkItem[];
    total_estimate_range_eur: [number, number]; // rounded to nearest €1,000
    timeline: {
      phases: FinalTimelinePhase[];       // offsets + human display
      total_duration_display: string;     // "5–7 months" or "14–22 weeks"
    };
    permits: FinalPermit[];               // filtered to this tier’s work ids
  }>;
  validation: {
    pricing_ids_covered: boolean;
    timeline_items_mapped: boolean;
    permit_ids_mapped: boolean;
    sums_check_passed: boolean;          // cost ranges recomputed here (not upstream)
  };
}
```

### Prompt (scope finalizer)

```
SYSTEM:
You merge precision passes into a single, UI-ready plan per tier.

INPUTS:
- seed (plain work items with photo links)
- pricing (per-item ranges)
- timeline (phases with durations; item→phase mapping)
- permits (permit records with applies_to_work_ids)

TASKS:
1) Merge by id; DO NOT re-tier items. If a seed id is missing in refinements, keep the item but mark it out of scope (skip here if all present).
2) For each tier, include only its items.
3) Compute tier totals by summing item ranges; round totals to nearest €1,000.
4) Build timeline with start_offset_weeks as cumulative sums; create display_duration (“~X months” if >8 weeks, nearest).
5) Filter permits to those whose applies_to_work_ids intersect this tier’s items. Keep text once; list the linked jobs.
6) Keep names/subtitles exactly; no technical rewording.

OUTPUT:
Valid JSON matching FinalRenovationScope. Set validation flags true only if checks pass.
```

---

# 6) ~~`POST /api/listings/[id]/renovation-style-prompts`~~ *(REMOVED - replaced by R2b generate-room-prompts)*

### Data contract (updated to require photos)

```ts
export interface StylePromptInput {
  listing_id: string;
  final_scope: FinalRenovationScope;      // for items, names, tiers
  style_direction_id: string;             // or inline object if you prefer
  room_analyses_id: string;               // current-state facts
  whole_property_analysis_id: string;
  room_photos: Array<{
    room_id: string;
    photo_id: string;
    base64_image: string;                 // BEFORE photo
  }>;
}

export interface StylePrompt {
  tier: TierId;
  room_id: string;
  photo_id: string;
  room_name: string;
  before_context: string;                 // 1–2 lines grounded in the photo + room analysis
  after_prompt: string;                   // “Update THIS photo…” description
  style_summary: string;                  // 2–3 sentence intention
}

export interface StylePromptOutput {
  listing_id: string;
  generated_at: string;
  prompts: StylePrompt[];
}
```

### Prompt (style prompts)

```
SYSTEM:
You direct image prompts for renovating THIS specific photo. Use:
- Final scope (names/subtitles → what changes)
- Style direction (baseline + viable directions)
- Room & whole-property analyses (facts)
- The provided BEFORE photo (base64)

GOAL:
For each tier × photo, write an “update THIS photo” prompt that keeps structure and camera angle, and applies the tier’s changes coherently.

RULES:
- Preserve walls, window positions, proportions, and perspective.
- Reference the room item names/subtitles to stay concrete.
- Use regional/material realism from style direction.
- After_prompt: 80–120 words, neutral, descriptive English.
- Absolutely no fantasizing layouts that contradict the photo.

OUTPUT:
StylePromptOutput JSON.
```

---

# 7) `POST /api/listings/[id]/renovation-image-generate` *(photo-conditioned “after”)*

### Data contract

```ts
export interface RenovationImageInput {
  listing_id: string;
  tier: TierId;
  room_id: string;
  photo_id: string;
  base64_image: string;   // BEFORE
  after_prompt: string;   // from style prompts
}

export interface RenovationImageOutput {
  listing_id: string;
  tier: TierId;
  room_id: string;
  photo_id: string;
  generated_at: string;
  after_image_base64: string;
}
```

### Prompt (image model)

```
SYSTEM:
Render an “after” image by updating the given BEFORE photo according to the description.
Preserve architecture, camera angle, and daylight direction. Apply materials and palette as described.
No hallucinated room geometry or impossible features.
```

---

# 8) `POST /api/listings/[id]/recommendations/next-steps` *(simplified, actionable)*

### Data contract

```ts
export interface NextStepsRecommendation {
  listing_id: string;
  generated_at: string;
  summary: string;               // 2–3 sentence setup: what proceeding entails
  action_plan: string[];         // 5–9 concise, ordered actions (mix of verify/logistics/prepare)
  effort_outlook: string;        // 1–2 sentences on time/effort realism (use final timeline & totals)
  mindset_note: string;          // 1–2 sentences: who this suits
}
```

### Prompt (next steps)

```
SYSTEM:
Produce a short, practical “Next Steps” brief based on the FinalRenovationScope and Diagnostic.
Make the home feel possible, not perfect. Supportive realism.

OUTPUT STRUCTURE:
- summary (2–3 sentences)
- action_plan: 5–9 chronological steps (verification, permits, quotes, planning)
- effort_outlook: 1–2 sentences (months/weeks, coordination level, budget sense)
- mindset_note: 1–2 sentences (buyer fit)

RULES:
- Map steps to actual items/permits/timeline.
- No sales language. Be clear and specific.
- Spanish, agency-display neutral.
```

---

## Global Normalization Rules (baked into Finalizer)

* **Costs:** item ranges rounded **nearest €100**; **tier totals nearest €1,000**.
* **Timeline:** phases in **weeks**; finalizer derives `start_offset_weeks`; any phase **> 8 weeks** gets `display_duration="~X months"` (nearest).
* **Permits:** one description per permit **with `applies_to_work_ids`**; UI shows it once per tier, listing the jobs it enables.
* **Tiers:** **never re-tier items** downstream; seed tier is canonical.
* **Names/Subtitles:** keep buyer-language from seed; no technical rewrites.
* **Photo linkage:** every work item must keep at least one **BEFORE** `photo_ref` (for carousel jump).

---

## Why this fixes your observed issues

* **Weird timeline numbers** → offsets now computed only in **finalizer**; phases remain simple durations in timeline pass.
* **Same permits text across tiers** → permits are **per job**, then **filtered** per tier in finalizer; no duplication.
* **All items in one tier** → every item carries immutable `tier`; the finalizer groups by this, not by a fragile JSON nest.
* **Totals don’t add up** → **only finalizer** sums and rounds; upstream passes only annotate items.
* **Item language & linking** → enforced at **scope seed**; every item is plainspoken and linked to photos, which propagates through prompts and makes image gen coherent.

---

Perfect. Here are **strict JSON Schemas** (Draft 2020-12) for **runtime validation of every OUTPUT** from `renovation-scope` onward (we’re excluding the Google-search mini-pipeline as requested). These will **hard-fail drift** (missing fields, wrong enums, bad rounding, etc.). Use with AJV (strict mode).

---

## 1) `/renovation-scope` → `ScopeSeedOutput`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/scope-seed-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "tiers", "generated_at"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "tiers": {
      "type": "object",
      "additionalProperties": false,
      "required": ["estandar", "optimo", "plus"],
      "properties": {
        "estandar": { "$ref": "#/$defs/TierSeed" },
        "optimo": { "$ref": "#/$defs/TierSeed" },
        "plus": { "$ref": "#/$defs/TierSeed" }
      }
    }
  },
  "$defs": {
    "TierId": { "enum": ["estandar", "optimo", "plus"] },
    "TierSeed": {
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "work_items"],
      "properties": {
        "title": { "type": "string", "minLength": 1, "maxLength": 64 },
        "work_items": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/ScopeWorkItemSeed" }
        }
      }
    },
    "ScopeWorkItemSeed": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "tier", "name", "photo_refs"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "tier": { "$ref": "#/$defs/TierId" },
        "name": { "type": "string", "minLength": 4, "maxLength": 120 },
        "subtitle": { "type": "string", "minLength": 4, "maxLength": 160 },
        "room_ref": { "type": "string", "minLength": 1 },
        "photo_refs": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "minLength": 1 }
        },
        "likely_permit_types_guess": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["obra_mayor", "obra_menor", "comunidad", "lpo", "declaracion_responsable"]
          }
        },
        "notes_internal": { "type": "string", "maxLength": 240 }
      }
    }
  }
}
```

---

## 2) `/renovation-pricing` → `PricingOutput`

*(enforces rounding: items must be multiples of €100)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/pricing-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "priced_items", "rounding_rules", "generated_at"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "rounding_rules": {
      "type": "object",
      "additionalProperties": false,
      "required": ["item", "totals"],
      "properties": {
        "item": { "const": "nearest_€100" },
        "totals": { "const": "nearest_€1,000" }
      }
    },
    "priced_items": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/PricedItem" }
    }
  },
  "$defs": {
    "TierId": { "enum": ["estandar", "optimo", "plus"] },
    "PricedItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "tier", "cost_low_eur", "cost_high_eur", "cost_basis", "confidence"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "tier": { "$ref": "#/$defs/TierId" },
        "cost_low_eur": { "type": "number", "minimum": 0, "multipleOf": 100 },
        "cost_high_eur": { "type": "number", "minimum": 0, "multipleOf": 100 },
        "cost_basis": { "type": "string", "minLength": 3, "maxLength": 140 },
        "confidence": { "enum": ["high", "medium", "low"] }
      }
    }
  }
}
```

---

## 3) `/renovation-timeline` → `TimelineOutput`

*(phases have durations only; offsets computed later)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/timeline-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "phases", "item_placement", "generated_at"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "phases": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/TimelinePhase" }
    },
    "item_placement": {
      "type": "array",
      "items": { "$ref": "#/$defs/ItemPlacement" }
    },
    "notes": {
      "type": "array",
      "items": { "type": "string", "maxLength": 200 }
    }
  },
  "$defs": {
    "TimelinePhase": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "subtitle", "duration_weeks"],
      "properties": {
        "name": { "type": "string", "minLength": 3, "maxLength": 80 },
        "subtitle": { "type": "string", "minLength": 3, "maxLength": 140 },
        "duration_weeks": { "type": "integer", "minimum": 0, "maximum": 104 }
      }
    },
    "ItemPlacement": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "phase_name"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "phase_name": { "type": "string", "minLength": 3, "maxLength": 80 }
      }
    }
  }
}
```

---

## 4) `/renovation-permits` → `PermitsOutput`

*(permits mapped to work IDs; per-job, not per-tier)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/permits-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "permits", "generated_at"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "permits": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/PermitRecord" }
    }
  },
  "$defs": {
    "PermitRecord": {
      "type": "object",
      "additionalProperties": false,
      "required": ["permit_type", "applies_to_work_ids", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "confidence"],
      "properties": {
        "permit_type": { "type": "string", "minLength": 3, "maxLength": 80 },
        "applies_to_work_ids": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "minLength": 1 }
        },
        "why_needed": { "type": "string", "minLength": 10, "maxLength": 600 },
        "what_needed": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "minLength": 2, "maxLength": 120 }
        },
        "issuing_authority": { "type": "string", "minLength": 2, "maxLength": 120 },
        "expected_time_weeks": { "type": "integer", "minimum": 0, "maximum": 104 },
        "pitfalls": {
          "type": "array",
          "items": { "type": "string", "maxLength": 140 }
        },
        "confidence": { "enum": ["high", "medium", "low"] }
      }
    }
  }
}
```

---

## 5) `/renovation-scope-finalize` → `FinalRenovationScope`

*(single source of truth for UI; totals/offsets enforced; totals rounded to €1,000)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/final-renovation-scope.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "generated_at", "tiers", "validation"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "tiers": {
      "type": "object",
      "additionalProperties": false,
      "required": ["estandar", "optimo", "plus"],
      "properties": {
        "estandar": { "$ref": "#/$defs/FinalTier" },
        "optimo": { "$ref": "#/$defs/FinalTier" },
        "plus": { "$ref": "#/$defs/FinalTier" }
      }
    },
    "validation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["pricing_ids_covered", "timeline_items_mapped", "permit_ids_mapped", "sums_check_passed"],
      "properties": {
        "pricing_ids_covered": { "type": "boolean" },
        "timeline_items_mapped": { "type": "boolean" },
        "permit_ids_mapped": { "type": "boolean" },
        "sums_check_passed": { "type": "boolean" }
      }
    }
  },
  "$defs": {
    "TierId": { "enum": ["estandar", "optimo", "plus"] },
    "FinalTier": {
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "tier_subtitle", "work_items", "total_estimate_range_eur", "timeline", "permits"],
      "properties": {
        "title": { "type": "string", "minLength": 1, "maxLength": 64 },
        "tier_subtitle": { "type": "string", "minLength": 4, "maxLength": 120 },
        "work_items": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/FinalWorkItem" }
        },
        "total_estimate_range_eur": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": { "type": "number", "minimum": 0, "multipleOf": 1000 }
        },
        "timeline": { "$ref": "#/$defs/FinalTimeline" },
        "permits": {
          "type": "array",
          "items": { "$ref": "#/$defs/FinalPermit" }
        }
      }
    },
    "FinalWorkItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "tier", "name", "photo_refs", "cost_low_eur", "cost_high_eur", "stage"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "tier": { "$ref": "#/$defs/TierId" },
        "name": { "type": "string", "minLength": 4, "maxLength": 120 },
        "subtitle": { "type": "string", "minLength": 4, "maxLength": 160 },
        "room_ref": { "type": "string" },
        "photo_refs": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "minLength": 1 }
        },
        "cost_low_eur": { "type": "number", "minimum": 0, "multipleOf": 100 },
        "cost_high_eur": { "type": "number", "minimum": 0, "multipleOf": 100 },
        "stage": { "type": "string", "minLength": 3, "maxLength": 80 }
      }
    },
    "FinalPermit": {
      "type": "object",
      "additionalProperties": false,
      "required": ["permit_type", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "applies_to_work_ids"],
      "properties": {
        "permit_type": { "type": "string", "minLength": 3, "maxLength": 80 },
        "why_needed": { "type": "string", "minLength": 10, "maxLength": 600 },
        "what_needed": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "minLength": 2, "maxLength": 120 }
        },
        "issuing_authority": { "type": "string", "minLength": 2, "maxLength": 120 },
        "expected_time_weeks": { "type": "integer", "minimum": 0, "maximum": 104 },
        "applies_to_work_ids": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "minLength": 1 }
        }
      }
    },
    "FinalTimeline": {
      "type": "object",
      "additionalProperties": false,
      "required": ["phases", "total_duration_display"],
      "properties": {
        "phases": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/FinalTimelinePhase" }
        },
        "total_duration_display": {
          "type": "string",
          "pattern": "^(\\d+–\\d+\\sweeks|\\d+–\\d+\\smonths)$"
        }
      }
    },
    "FinalTimelinePhase": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "subtitle", "start_offset_weeks", "duration_weeks", "display_duration"],
      "properties": {
        "name": { "type": "string", "minLength": 3, "maxLength": 80 },
        "subtitle": { "type": "string", "minLength": 3, "maxLength": 140 },
        "start_offset_weeks": { "type": "integer", "minimum": 0, "maximum": 520 },
        "duration_weeks": { "type": "integer", "minimum": 0, "maximum": 104 },
        "display_duration": {
          "type": "string",
          "pattern": "^(\\d+\\sweeks|~\\d+\\smonths)$"
        }
      }
    }
  }
}
```

---

## 6) ~~`/renovation-style-prompts`~~ → **REMOVED** (replaced by R2b `/after/generate-room-prompts`)

*(photo-aware; per tier × per photo)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/style-prompts-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "generated_at", "prompts"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "prompts": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/StylePrompt" }
    }
  },
  "$defs": {
    "TierId": { "enum": ["estandar", "optimo", "plus"] },
    "StylePrompt": {
      "type": "object",
      "additionalProperties": false,
      "required": ["tier", "room_id", "photo_id", "room_name", "before_context", "after_prompt", "style_summary"],
      "properties": {
        "tier": { "$ref": "#/$defs/TierId" },
        "room_id": { "type": "string", "minLength": 1 },
        "photo_id": { "type": "string", "minLength": 1 },
        "room_name": { "type": "string", "minLength": 1, "maxLength": 80 },
        "before_context": { "type": "string", "minLength": 8, "maxLength": 300 },
        "after_prompt": { "type": "string", "minLength": 40, "maxLength": 900 },
        "style_summary": { "type": "string", "minLength": 20, "maxLength": 400 }
      }
    }
  }
}
```

---

## 7) `/renovation-image-generate` → `RenovationImageOutput`

*(base64 sanity check)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/renovation-image-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "tier", "room_id", "photo_id", "generated_at", "after_image_base64"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "tier": { "enum": ["estandar", "optimo", "plus"] },
    "room_id": { "type": "string", "minLength": 1 },
    "photo_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "after_image_base64": {
      "type": "string",
      "minLength": 100,
      "pattern": "^[A-Za-z0-9+/=]+$"
    }
  }
}
```

---

## 8) `/recommendations/next-steps` → `NextStepsRecommendation`

*(short, actionable, supportive realism)*

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://puedo.casa/schemas/next-steps-output.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["listing_id", "generated_at", "summary", "action_plan", "effort_outlook", "mindset_note"],
  "properties": {
    "listing_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "format": "date-time" },
    "summary": { "type": "string", "minLength": 20, "maxLength": 400 },
    "action_plan": {
      "type": "array",
      "minItems": 5,
      "maxItems": 9,
      "items": { "type": "string", "minLength": 6, "maxLength": 160 }
    },
    "effort_outlook": { "type": "string", "minLength": 12, "maxLength": 240 },
    "mindset_note": { "type": "string", "minLength": 10, "maxLength": 200 }
  }
}
```

---

## How to enforce (AJV)

* Use AJV v8+, `strict: true`, `allErrors: false` (fail fast), `removeAdditional: false`.
* Pre-compile each schema; validate **every endpoint response** before persisting/serving.
* Log schema errors verbosely; reject responses that don’t pass (prevents UI drift).
* Optional: add a runtime check to ensure `cost_low_eur ≤ cost_high_eur` (can’t express cross-field inequality in JSON Schema without custom keyword; do it in code).

This locks your pipeline. If anything drifts (missing photo links, wrong tier, unrounded costs, timeline offsets in the wrong step, duplicated permit text), it **fails at the gate** instead of leaking to UI.


