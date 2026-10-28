# 🧩 Renovation Intelligence Pipeline

You're implementing the complete "Renovation Intelligence" phase — the prescriptive layer that follows the *Integrated Analysis* report.
These endpoints together generate renovation options, price and time estimates, permit details, stylistic cues for image generation, and the buyer advisory *Próximos Pasos (Next Steps)* section.

The system must remain **credible, composable, and agent-safe** —
it should make the property feel **possible**, not perfect, and show what's realistically achievable for different levels of ambition.

---

# 🧩 Endpoints Overview

| Order | Endpoint                                                | Purpose                                                     | Model                         |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| 1️⃣   | `/api/listings/[id]/renovation-scope`                   | Generate 3 coherent renovation tiers (thinking mode)        | Gemini 2.5 Pro (max thinking) |
| 2a️⃣  | `/api/listings/[id]/renovation-research-queries`        | Generate Google search terms for cost, time, permits, norms | Gemini 2.5 Pro                |
| 2b️⃣  | `/api/listings/[id]/renovation-research-search`         | Execute Google Custom Search for generated queries          | internal search endpoint      |
| 2c️⃣  | `/api/listings/[id]/renovation-research-curate-price`   | Summarize search results on renovation cost                 | Gemini 2.5 Flash              |
| 2d️⃣  | `/api/listings/[id]/renovation-research-curate-time`    | Summarize search results on renovation durations            | Gemini 2.5 Flash              |
| 2e️⃣  | `/api/listings/[id]/renovation-research-curate-permits` | Summarize search results on permits and regulations         | Gemini 2.5 Flash              |
| 3️⃣   | `/api/listings/[id]/renovation-pricing`                 | Add credible € ranges to each work item                     | Gemini 2.5 Flash              |
| 4️⃣   | `/api/listings/[id]/renovation-timeline`                | Refine phase durations and sequencing                       | Gemini 2.5 Pro                |
| 5️⃣   | `/api/listings/[id]/renovation-permits`                 | Expand each permit into full procedural info                | Gemini 2.5 Pro                |
| ~~6️⃣~~   | ~~`/api/listings/[id]/renovation-style-prompts`~~           | ~~Generate stylistic text per tier for image-gen~~ - **REMOVED** (replaced by R2b)              | ~~Gemini 2.5 Pro~~                |
| 7️⃣   | `/api/listings/[id]/recommendations/next-steps`         | Produce supportive advisory text (Próximos Pasos)           | Gemini 2.5 Pro                |

---

# 🧱 Data Contracts

### 1️⃣ RenovationScopeReport

Output of `/renovation-scope`

```typescript
interface RenovationScopeReport {
  listing_id: string;
  generated_at: string;
  tiers: {
    estandar: RenovationTier;
    optimo: RenovationTier;
    plus: RenovationTier;
  };
}

interface RenovationTier {
  description: string;
  rationale: string;
  relative_cost_scale: "€" | "€€" | "€€€";
  effort_level: "low" | "medium" | "high";
  expected_duration_weeks: number;
  work_items: WorkItem[];
  base_timeline: BasicPhase[];
  likely_permits: string[];
}

interface WorkItem {
  id: string;
  category: "structure" | "layout" | "finishes" | "services" | "energy" | "documentation" | "other";
  description: string;
  effort_level: "low" | "medium" | "high";
  requires_permit: boolean;
  rationale: string;
}

interface BasicPhase {
  name: string;
  description: string;
  duration_weeks: number;
}
```

---

### 2️⃣ RenovationResearchResults (2c–2e output)

```typescript
interface RenovationResearchResults {
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
```

---

### 3️⃣ RenovationPricingReport

Output of `/renovation-pricing`

```typescript
interface RenovationPricingReport extends RenovationScopeReport {
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
```

---

### 4️⃣ RenovationTimelineReport

Output of `/renovation-timeline`

```typescript
interface RenovationTimelineReport {
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
```

---

### 5️⃣ RenovationPermitsReport

Output of `/renovation-permits`

```typescript
interface RenovationPermitsReport {
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
```

---

### 6️⃣ RenovationStylePrompts

~~Output of `/renovation-style-prompts`~~ - **REMOVED** (replaced by R2b output)

```typescript
interface RenovationStylePrompts {
  listing_id: string;
  tiers: {
    estandar: string;
    optimo: string;
    plus: string;
  };
}
```

---

### 7️⃣ NextStepsReport

Output of `/recommendations/next-steps`

```typescript
interface NextStepsReport {
  listing_id: string;
  sections: {
    key_verifications: string[];
    practical_implications: string[];
    preparation_tips: string[];
    mindset_check: string[];
  };
}
```

---

# 🧠 PROMPTS (by endpoint)

---

### 1️⃣ `/renovation-scope` — Holistic Thinking Pass

```text
SYSTEM PROMPT:
You are an architectural renovation planner in Spain.
Given the Integrated Analysis JSON, design 3 coherent renovation tiers — Estándar (light), Óptimo (medium), and Plus (ambitious).

For each tier, include:
- 6–10 grouped work items with rationale and permit flags
- Effort level, relative cost scale (€ / €€ / €€€)
- Expected duration (weeks)
- Base 6-step timeline: offer & closing, inspection, design, permits, works, delivery

Think as a developer balancing feasibility, cost, and appeal.
Output valid JSON matching RenovationScopeReport.
```

---

### 2a️⃣ `/renovation-research-queries` — Query Generation

```text
SYSTEM PROMPT:
Given the Integrated Analysis and RenovationScopeReport, generate Google search queries to collect Spain-specific renovation data for:
- Material & labor costs
- Typical renovation durations
- Permit processes & regulations
- Regional norms

Use Spanish phrasing suitable for Google searches.
Each query ≤ 12 words; include location context.
Output JSON: { "queries_by_category": { "costs":[], "durations":[], "permits":[], "norms":[] } }
```

---

### 2b️⃣ `/renovation-research-search` — Google Search Execution

*(No Gemini; handled by your own search endpoint.)*

---

### 2c️⃣ `/renovation-research-curate-price`

```text
SYSTEM PROMPT:
You are summarizing Spain-specific renovation cost data.
Given search snippets, synthesize 2024–2025 ranges for labor, materials, and turnkey renovations.
Summarize by category; include € per m² when possible.
Output valid JSON matching RenovationResearchResults for category "price".
```

---

### 2d️⃣ `/renovation-research-curate-time`

```text
SYSTEM PROMPT:
You are summarizing typical renovation durations and sequencing in Spain.
Given snippets, output realistic timeframes for design, permits, and works.
Highlight dependencies (permit delays, supply times).
Output JSON matching RenovationResearchResults for category "time".
```

---

### 2e️⃣ `/renovation-research-curate-permits`

```text
SYSTEM PROMPT:
You are summarizing Spanish renovation permit requirements.
Given snippets, describe when "obra menor" or "obra mayor" apply, typical documents, authorities, and times.
Output JSON matching RenovationResearchResults for category "permits".
```

---

### 3️⃣ `/renovation-pricing`

```text
SYSTEM PROMPT:
You are a cost estimator combining RenovationScopeReport and RenovationResearchResults (price).
Assign realistic cost ranges for each work item using Spain-wide data (Habitissimo, Obramat, etc.).

Consider:
• Labor & materials
• Permit/design/admin costs
• Contractor overhead (~15%)
• VAT

Output RenovationPricingReport.
```

---

### 4️⃣ `/renovation-timeline`

```text
SYSTEM PROMPT:
You are a renovation scheduler.
Given RenovationScopeReport and RenovationResearchResults (time), produce detailed weekly timelines for each tier.
Include all phases (deal → inspection → design → permits → works → delivery), durations, and dependencies.
Output RenovationTimelineReport.
```

---

### 5️⃣ `/renovation-permits`

```text
SYSTEM PROMPT:
You are a compliance expert.
Given RenovationResearchResults (permits) and the list of permit types from scope, explain for each:
- Why required
- Documentation
- Issuing authority
- Time (weeks)
- Common pitfalls
Output RenovationPermitsReport.
```

---

### ~~6️⃣ `/renovation-style-prompts`~~ - **REMOVED** (replaced by R2b `/after/generate-room-prompts`)

```text
SYSTEM PROMPT:
You are a renovation designer describing visual mood.
Given property context and renovation tiers, write stylistic briefs per tier:
• materials, palette, lighting, and spatial feel
• realistic for Spain
Tone: architectural, not promotional.
Output RenovationStylePrompts.
```

---

### 7️⃣ `/recommendations/next-steps`

```text
SYSTEM PROMPT:
You are writing the buyer's advisory "Próximos Pasos".
Given Integrated Analysis + finalized renovation tiers, summarize:
1. Key verifications (permits, docs)
2. Practical implications (effort, duration)
3. Preparation tips (budget, experts)
4. Mindset check (type of buyer suited)
Tone: supportive realism — enabling, calm, precise.
Output NextStepsReport.
```

---

# ✅ Implementation Summary

This pipeline produces the full prescriptive layer after analysis:

```
Integrated Analysis
   ↓
Renovation Scope (ideas)
   ↓
Google Research (queries → search → curated summaries)
   ↓
Pricing • Timeline • Permits
   ↓
Stylistic Prompts → After Images
   ↓
Next Steps (buyer advisory)
```

Each endpoint is modular, schema-aligned, and chainable for either single-listing or batch generation.
It preserves credibility while maintaining the emotional logic of **Puedo: "making homes feel possible."**
