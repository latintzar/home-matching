# Re-Architected Analysis Pipeline Documentation

**Date:** 2025-01-27  
**Status:** 🚧 In Progress  
**Purpose:** New two-phase pipeline architecture (Diagnostic → Prescriptive)

## 📋 Executive Summary

We are re-architecting the analysis pipeline into two distinct phases that separate **diagnostic analysis** (what we know) from **prescriptive recommendations** (what to do).

### Key Changes
1. **Eliminate premature summarization** - B4-headlines endpoint removed (not enough context)
2. **Integrated Analysis becomes diagnostic** - Merges text + photo analysis into comprehensive diagnostic report
3. **New Summary Generation** - 5×140-character headlines generated AFTER integrated analysis
4. **Recommendations Phase** - New prescriptive step that generates renovation options based on full diagnostic analysis
5. **No "Ask agent" buttons in Analysis** - Analysis is reporting, Recommendations is action-oriented

---

## 🏗️ New Pipeline Architecture

### Phase 1: Analysis (Diagnostic)

**Flow:**
```
Text Analysis → Photo Analysis → Google Search Contextualising → Integrated Analysis → Summary
```

**Components:**

1. **Text Analysis** (Existing)
   - A-facts: Sentence-by-sentence claims extraction
   - B3-snippets: Categorized claims into snippets
   - C-unknowns: Critical information gaps
   - **DEPRECATED:** B4-headlines (removed - not enough context)

2. **Photo Analysis** (Existing)
   - Whole-property analysis
   - Room-by-room analysis

3. **Google Search Contextualising** (NEW - Re-architected)
   - **Input:** B3-snippets (categorized claims) + C-unknowns (information gaps) + Listing metadata
   - **Output:** Web search results with clickable citations (title, snippet, URL, domain)
   - **Process:**
     - Gemini generates 5-8 targeted Spanish search queries based on property context
     - Google Custom Search API executes queries in parallel
     - Results stored in `research_search_results` table
   - **Purpose:** Grounds analysis with real-world context (typical costs, regulations, local norms)
   - **Endpoint:** `/api/listings/[id]/search-research`
   - **Documentation:** See [Google Search Grounding](GOOGLE_SEARCH_GROUNDING.md) for full 15-category framework

4. **Integrated Analysis** (NEW - Re-architected)
   - **Input:** Text analysis + Photo analysis + Search results + Listing metadata
   - **Output:** Comprehensive diagnostic report in 9-section structure
   - **Two Endpoints:**
     - `/api/listings/[id]/analysis/integrated` - Generates diagnostic report
     - `/api/listings/[id]/analysis/integrated-summary` - Generates 5×140-character headlines

5. **Summary Generation** (NEW)
   - Generates 5 bullet-point headlines from the diagnostic report
   - Replaces the old B4-headlines output
   - Saved to `text_analysis_results` with phase `integrated_summary`
   - **Used by PropertyDetails component** for display

### Phase 2: Recommendations (Prescriptive)

**Flow:**
```
Integrated Analysis → Recommendations (Options + Things to Look Into)
```

**Components:**

1. **Renovation Options** (NEW)
   - Endpoint: `/api/listings/[id]/recommendations/options`
   - Generates 3 divergent renovation options based on diagnostic analysis
   - Uses Gemini Pro with creative divergent prompt
   - Each option has "Ask agent" button

2. **Things to Look Into** (NEW)
   - Endpoint: `/api/listings/[id]/recommendations/things-to-look-into`
   - Combines integrated analysis + renovation options
   - Prioritizes action items based on feasibility
   - Global "Ask agent" button for entire list

---

## 📊 Data Structures

### DiagnosticAnalysisReport
```typescript
{
  listing_id: string;
  analysis_date: string;
  overview: string;  // 2-3 sentences
  scope: string[];   // Input sources
  findings_by_category: {  // 7 categories
    estado_materiales: string;
    espacios_distribucion: string;
    entorno_vistas: string;
    servicios_instalaciones: string;
    legal_economico: string;
    seguridad_accesibilidad: string;
    caracter_arquitectonico: string;
  };
  critical_unknowns: string[];
  photo_highlights: string[];
  implications: string;  // 2-3 sentences
  next_steps: string[];
  key_takeaways: string[];  // 5 bullets (≤140 chars each)
  limitations: string;
}
```

### DiagnosticAnalysisSummary
```typescript
{
  listing_id: string;
  bullets: string[];  // Exactly 5, each ≤140 chars
}
```

### Why This Structure?

**Benefits:**
- ✅ **Factual and objective** - No vague adjectives, measurable claims
- ✅ **Comprehensive** - 9 sections cover all aspects
- ✅ **Hierarchical** - Overview → Detail → Action
- ✅ **Gemini-friendly** - Structured JSON scaffold for consistent output
- ✅ **Human-readable** - Works for both lay buyers and professionals

---

## 🎯 Prompt Design

### Integrated Analysis Prompt

**Strategy:**
- Rigid JSON scaffold with field names
- Include knowns + unknowns arrays inline
- Remind Gemini: "Do not invent details beyond claims or photos"
- Temperature: 0.1-0.2 for factual tone
- Limit length: "Each section ≤ 3 sentences except overview"
- Few-shot examples for coherence

**Input Structure:**
```typescript
IntegratedAnalysisInputs {
  textAnalysis: {
    claims: Array<Claim>;
    unknowns: string[];
    categories: Record<string, any>;
  };
  photoAnalysis: {
    wholeProperty: any;
    roomByRoom: any;
    photosCount: number;
  };
  listingMetadata: {
    title, price, size, bedrooms, bathrooms, etc.
  };
}
```

### Summary Generation Prompt

**Strategy:**
- Extract 5 key takeaways from diagnostic report
- Each bullet ≤140 characters
- Focus on critical findings and actions
- Objective and factual tone

---

## 🔄 Endpoint Changes

### New Endpoints
| Endpoint | Purpose | Model | Status |
|----------|---------|-------|--------|
| `/api/listings/[id]/analysis/integrated` | Generate diagnostic report | Gemini 2.5 Pro | 🚧 Creating |
| `/api/listings/[id]/analysis/integrated-summary` | Generate 5 headlines | Gemini 2.5 Pro | 🚧 Creating |
| `/api/listings/[id]/recommendations/options` | Generate 3 renovation options | Gemini Pro | ⏳ Planned |
| `/api/listings/[id]/recommendations/things-to-look-into` | Generate action items | Gemini Pro | ⏳ Planned |

### Deprecated Endpoints
| Endpoint | Reason | Migration |
|----------|--------|-----------|
| `/api/listings/[id]/text-analysis/b4-headlines` | Not enough context at this stage | Use `integrated-summary` instead |

### Updated Endpoints
| Endpoint | Changes |
|----------|--------|
| `/api/listings/[id]/analysis/integrated` | Now takes text + photo analysis, generates diagnostic report |
| PropertyDetails component | Now uses `integrated_summary` phase instead of `b4_headlines` |

---

## 📁 File Structure

```
src/
├── types/
│   ├── diagnostic-analysis.ts          # NEW: Diagnostic report types
│   └── integrated-analysis.ts          # DEPRECATED: Old photo-analysis types
├── lib/
│   └── prompts/
│       ├── diagnostic-analysis.ts       # NEW: Diagnostic prompts
│       └── photo-analysis.ts           # KEEP: Photo analysis prompts
└── app/api/listings/[id]/
    ├── analysis/
    │   ├── integrated/
    │   │   └── route.ts                 # UPDATED: Now generates diagnostic report
    │   └── integrated-summary/           # NEW
    │       └── route.ts                   # NEW: Generates 5 headlines
    ├── recommendations/                  # NEW
    │   ├── options/
    │   │   └── route.ts                   # NEW: 3 renovation options
    │   └── things-to-look-into/         # NEW
    │       └── route.ts                   # NEW: Action items
    └── text-analysis/
        └── b4-headlines/
            └── route.ts                  # DELETE: No longer needed
```

---

## 🔧 Implementation Status

### ✅ Completed
- [x] Define DiagnosticAnalysisReport and DiagnosticAnalysisSummary types
- [x] Create DIAGNOSTIC_ANALYSIS_PROMPT and DIAGNOSTIC_SUMMARY_PROMPT
- [x] Update `/api/listings/[id]/analysis/integrated` to generate diagnostic report
- [x] Create `/api/listings/[id]/analysis/integrated-summary` endpoint

### 🚧 In Progress
- [ ] Test integrated analysis endpoint with real data
- [ ] Test integrated-summary endpoint
- [ ] Create recommendations endpoints

### ⏳ Planned
- [ ] Create `/api/listings/[id]/recommendations/options` endpoint
- [ ] Create `/api/listings/[id]/recommendations/things-to-look-into` endpoint
- [ ] Update PropertyDetails component to use `integrated_summary`
- [ ] Remove B4-headlines endpoint
- [ ] Update orchestration to sequence Analysis → Recommendations

---

## 🎯 User Experience

### Before (Old Pipeline)
```
URL → Scrape → Text Analysis → Photos → B4 Headlines → Deep Dive
                                    ↓
                           (premature summary)
```

### After (New Pipeline)
```
URL → Scrape → Text Analysis → Photos → Integrated Analysis → Summary → Recommendations
                                                        ↓              ↓
                                                 (diagnostic)   (prescriptive)
```

**Key Improvements:**
- ✅ No premature summarization (B4 removed)
- ✅ Full context before generating summaries
- ✅ Clear separation: Analysis (reporting) vs Recommendations (action)
- ✅ Diagnostic report has enough detail for credible summaries

---

## 📖 Example Output

### Diagnostic Report (Integrated Analysis)
```json
{
  "listing_id": "atico-cadiz",
  "analysis_date": "2025-01-27",
  "overview": "Propiedad tipo ático en planta 11 con 78 m² construidos y terraza. Se observan buenos acabados interiores y potencial para mejora energética.",
  "scope": [
    "Análisis de texto (claims clasificados por categoría)",
    "Análisis fotográfico (17 imágenes)",
    "Metadatos del listado (precio, superficie, habitaciones)"
  ],
  "findings_by_category": {
    "estado_materiales": "Reformado, carpintería reciente, sin datos sobre cubierta ni aislamiento",
    "espacios_distribucion": "2 habitaciones, 1 baño, terraza orientada S",
    "servicios_instalaciones": "Ascensor confirmado; sin datos sobre calefacción o ACS"
  },
  "critical_unknowns": [
    "Tipo y edad del sistema de calefacción",
    "Estado de la cubierta",
    "Certificado de eficiencia energética"
  ],
  "key_takeaways": [
    "Reformado y bien mantenido",
    "Falta información sobre calefacción / ACS",
    "Cubierta no documentada",
    "Alta posición con buenas vistas",
    "Revisar documentación legal antes de oferta"
  ]
}
```

### Summary (5 Headlines)
```json
{
  "listing_id": "atico-cadiz",
  "bullets": [
    "Reformado con buena distribución",
    "Información de calefacción ausente",
    "Certificado energético pendiente",
    "Cubierta no documentada",
    "Buena orientación y vistas"
  ]
}
```

---

## 🔍 Key Differences

| Aspect | Old Architecture | New Architecture |
|--------|------------------|------------------|
| **B4 Headlines** | Generated after text analysis only | ❌ Removed |
| **Summary** | B4 headlines | ✅ Generated after integrated analysis |
| **Integrated Analysis** | Combined photo stages only | ✅ Combines text + photo + metadata |
| **Tone** | Technical | Diagnostic + approachable |
| **Structure** | Photo-focused | 9-section comprehensive report |
| **Recommendations** | Included in Deep Dive | ✅ Separate prescriptive phase |
| **Context** | Partial (text only) | ✅ Complete (text + photo + metadata) |

---

## 🚨 Migration Notes

### For Developers
1. Update any code that references `b4_headlines` phase to use `integrated_summary`
2. PropertyDetails component should read from `text_analysis_results` where `phase = 'integrated_summary'`
3. Remove calls to `/api/listings/[id]/text-analysis/b4-headlines`
4. New orchestration should sequence: Integrated Analysis → Summary → Recommendations

### For Testing
1. Test integrated analysis with complete text + photo analysis inputs
2. Verify summary generation from diagnostic report
3. Ensure 5 bullets are exactly ≤140 characters each
4. Verify recommendations endpoints work with diagnostic analysis

---

**Last Updated:** 2025-01-27  
**Next Steps:** Test integrated analysis endpoint, create recommendations endpoints  
**Blockers:** None  
**Status:** 🚧 Actively implementing
