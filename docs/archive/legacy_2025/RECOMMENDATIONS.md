# Recommendations (Prescriptive Phase)

**Last Updated:** 2025-10-27  
**Status:** ⏳ Planned  
**Purpose:** Generate renovation ideas and action plans based on diagnostic analysis

## 📋 Overview

The Recommendations phase is the **prescriptive** stage of our pipeline, where we generate actionable renovation concepts and provide buyer decision support.

**Canonical Flow (excerpt):** see `PIPELINE_FLOW.md` (letters G..P)
```
G) Integrated → I) Scope Seed → J) Renovation Search → K) Pricing → L) Timeline → M) Permits → N) Finalize → H) Contextual (derived from final scope) → O) Buyer Report → P) Verify
```

---

## 🎯 Components

### 1. Renovation Tiers (Finalize)

**Endpoints:**
- `/api/listings/[id]/renovation-scope` → seed (names/subtitles, photo_ref/room_ref)
- `/api/listings/[id]/renovation-pricing` → ranges per item (€100 rounding)
- `/api/listings/[id]/renovation-timeline` → 5–7 phases; 100% item mapping
- `/api/listings/[id]/renovation-permits` → per‑job mapping (Spanish why/what/authority/time)
- `/api/listings/[id]/renovation-scope-finalize` → per‑tier totals (€1,000), offsets, filtered permits

**Purpose:** Produce finalized per‑tier scopes ready for the UI (Estándar, Óptimo, Plus), grounded in seed + research + precision passes.

**Input:**
- Integrated diagnostic analysis report
- Property metadata (size, layout, condition, location)
- Budget context and feasibility signals

**Process:** seed → renovation search → pricing → timeline → permits → finalize.

**Output:**
- Finalized tiers with work items, totals, timeline offsets, and filtered permits.

**Use Case:** Helps buyer explore "what's possible" for this specific property

---

### 2. Verify / Próximos Pasos

**Endpoint:** `/api/listings/[id]/recommendations/verify`

**Purpose:** Generate the “Qué verificar” viewing checklist after the constellation is complete; link each item to report anchors.

**Tone:** Supportive realism - helping buyer picture the path ahead

**Content:** 7–12 prioritized items with concise reasoning, Spanish tone, anchored links to the buyer report.

**Philosophy:** 
> "If you decide to move forward, here's what it will require of you"

**Output:**
- Prioritized action items that balance opportunity with caution
- Global "Ask agent" button for entire list
- Presented in advisory, not salesy tone

**Spanish:** Qué verificar / Próximos Pasos

---

## 💬 Why Próximos Pasos?

**Balance:**
- Includes both enabling guidance (what's promising) and reality checks (what's demanding)
- Personal and actionable — speaks directly to the buyer's decision moment
- Not salesy — focuses on what buyer needs to do, not what we're selling

**Presentation:**
```
🏗️  Renovation Ideas
💬  Próximos Pasos
→ If you decide to move forward, here's what it will require of you
```

**Result:** Supportive realism that helps buyer picture the path ahead with both enthusiasm and grounded expectations

---

## 🏗️ Implementation Status

| Endpoint | Status | Description |
|----------|--------|-------------|
| `/api/listings/[id]/renovation-scope*` | ✅ Implemented | Seed, pricing, timeline, permits, finalize |
| `/api/listings/[id]/recommendations/verify` | ✅ Implemented | Generate Qué verificar checklist |

---

## 📊 Data Structures

### RenovationOption
```typescript
{
  listing_id: string;
  option_number: number;  // 1-3
  name: string;
  description: string;
  scope: string[];
  budget_range: {
    min: number;
    max: number;
    currency: "EUR";
  };
  timeline: string;
  feasibility: "High" | "Medium" | "Low";
  considerations: string[];
}
```

### NextSteps
```typescript
{
  listing_id: string;
  action_items: Array<{
    priority: "High" | "Medium" | "Low";
    category: "Verification" | "Implication" | "Preparation" | "Mindset";
    item: string;
    reasoning: string;
  }>;
}
```

---

## 🎯 Key Principles

### For Renovation Ideas
- **Divergent** - Generate genuinely different approaches
- **Practical** - Grounded in property realities
- **Specific** - Not generic advice, tailored to this property
- **Balanced** - Mix conservative and ambitious options

### For Próximos Pasos
- **Advisory** - Help buyer understand what's required
- **Personal** - Speak to their decision moment
- **Balanced** - Both enabling and cautionary
- **Actionable** - Clear, practical guidance
- **Realistic** - Grounded expectations

---

## 📚 Related Documentation

- **[Analysis Pipeline](ANALYSIS_PIPELINE.md)** - Diagnostic phase that precedes Recommendations
- **[Google Search Grounding](GOOGLE_SEARCH_GROUNDING.md)** - Context that informs recommendations
- **[Pipeline Flow](../../parked/PIPELINE_FLOW.md)** - Complete 3-phase overview

