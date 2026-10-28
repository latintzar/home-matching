# Integrated Analysis Specification

**Status:** ✅ IMPLEMENTED - Ready for Testing  
**Last Updated:** 2025-10-27  
**Purpose:** The diagnostic report that turns raw data into *clarity and momentum* for buyers

---

## 🎯 Feature Overview

**Integrated Analysis** is the final step of the Analysis phase. It combines:
- Text analysis (B3 snippets + C unknowns)
- Photo analysis (whole property + room-by-room)
- **Google Search curated research** (local norms, regulations, market expectations)

Into a **single empowering diagnostic report** that shows buyers what's **possible**, not just what's broken.

---

## 📋 Philosophy: "Supportive Realism"

### Tone Principles
- **Credible yet empowering** — truth that enables, not truth that discourages
- **Frame ambiguities as "verify"** not "problem"
- **Highlight what works, what's fixable, what's already in good shape**
- Language: Developer-style factual ("appears sound", "likely cosmetic", "may require verification")
- Architecture/Apple Maps aesthetic: clean, confident, factual, no marketing fluff

### Primary Goal
Help buyers see *what's real, what's unclear, and what's doable* so the property feels **possible to act on**, not overwhelming.

---

## 🔄 Pipeline Integration

```
Text Analysis (B3 + C) 
    ↓
Photo Analysis (whole + room-by-room)
    ↓
Google Search Research (curated summaries)
    ↓
Integrated Analysis (THIS - diagnostic report)
    ↓
Renovation Ideas + Next Steps (Recommendations phase)
```

**Input sources:**
1. `text_analysis_results` (B3 snippets, C unknowns)
2. `photo_analysis_results` (whole property, by cluster)
3. `research_curated_results` (Google Search summaries by category) ✅ **NEW**
4. `listings` (metadata: price, size, rooms, location)

**Output:**
- Diagnostic report stored in `text_analysis_results` with `phase: 'integrated_diagnostic'`
- Can generate summary headlines via `/api/listings/[id]/analysis/integrated-summary`

---

## 📊 Data Contract

### Input Type
```typescript
interface IntegratedAnalysisInputs {
  textAnalysis: {
    categorySnippets: Record<string, any>;  // B3 snippets by category
    unknowns: string[];  // C unknowns checklist
  };
  photoAnalysis: {
    wholeProperty: any;
    roomByRoom: any;
    photosCount: number;
  };
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
  researchContext?: {  // ✅ NEW - Curated Google Search research
    [category: string]: {
      summary: string;
      key_points: string[];
      confidence_level: string;
      sources_used: string[];
    };
  };
}
```

### Output Type
```typescript
interface DiagnosticAnalysisReport {
  listing_id: string;
  analysis_date: string; // ISO date
  overview: string; // Short intro - what's seen, what works, what's promising
  
  scope: string[]; // Input sources used
  
  // 9 diagnostic sections
  findings_by_category: {
    estado_materiales: string; // Materials & condition
    espacios_distribucion: string; // Layout & distribution
    entorno_vistas: string; // Environment & views
    servicios_instalaciones: string; // Services & installations
    seguridad_accesibilidad: string; // Safety & accessibility
    legal_economico: string; // Legal & economic
    energia_confort: string; // Energy & comfort ✅ NEW
    caracter_arquitectonico: string; // Architectural character
    otros_factores?: string; // Other relevant factors ✅ NEW
  };
  
  critical_unknowns: string[]; // What's not visible/verifiable
  verification_checks: string[]; // "Confirm X", "Revisar Y" format ✅ NEW
  opportunities: string[]; // "Layout luminoso", "Oportunidad mejora" format ✅ NEW
  
  implications: string; // What this means for effort/timeline/scope
  next_steps_intro: string; // "If you proceed, you'll need to..." ✅ NEW
  key_takeaways: string[]; // 5 concise bullets (10-15 words each)
  limitations: string; // Disclaimer about photo-based nature
}
```

---

## 🎨 Frontend Display (Future Work)

### Modal/Slide-Over Layout
1. **Header**: Property title, price, area, rooms, location
2. **Overview**: 2-3 sentences describing the property as-is
3. **Scope**: "This report is based on text, photos, and local research"
4. **Diagnostic Sections (9)**: Accordion or stacked cards, one per category
5. **Critical Unknowns / Verification Checks**: Side-by-side panels
6. **Opportunities**: "What looks promising" section ✅ NEW
7. **Implications**: 1-paragraph takeaway on renovation effort
8. **Next Steps Intro**: Tee-up to Próximos Pasos ✅ NEW
9. **5 Key Takeaways**: Concise badges or bullets
10. **Disclaimer**: "Photo-based diagnostic only" footer

### Visual Style
- Clean, confident, factual
- Apple Maps + Architect's report tone
- No gradients, no marketing fluff
- White or light neutral background, muted earth/teal accents

### Information Hierarchy
- Each section: Clear title → 2-3 crisp sentences
- Confidence indicators:
  - 🟢 Observed
  - 🟡 Inferred
  - ⚪ Unknown

---

## ✅ Implementation Status

### Backend
- [x] Updated `/api/listings/[id]/analysis/integrated` endpoint
- [x] Fetches curated research from `research_curated_results` ✅
- [x] Adds `researchContext` to prompt inputs ✅
- [x] Updated prompt with "supportive realism" tone ✅
- [x] Added citation instructions (inline format: "claim (source.com)") ✅
- [x] Updated TypeScript types to match new structure ✅
- [x] Returns `verification_checks`, `opportunities`, `next_steps_intro` ✅
- [x] Increased `maxOutputTokens` to 8192 ✅
- [x] Extracts citations from curated research representative snippets ✅

### Prompt Engineering
- [x] "Supportive realism" philosophy added
- [x] 9 diagnostic categories (including `energia_confort` and `otros_factores`)
- [x] Opportunities section (highlight what works, what's fixable)
- [x] Verification checks (convert unknowns into actionable "verify X")
- [x] Next steps intro (bridge to Próximos Pasos)
- [x] Inline citation format: "claim (source.com)"

### Frontend (Future)
- [ ] Create modal/slide-over component for "Full Analysis" button
- [ ] Display 9 diagnostic sections in accordion or cards
- [ ] Show verification checks and opportunities prominently
- [ ] 5 key takeaways display
- [ ] Citations rendering with links

---

## 🧪 Testing

To test the updated Integrated Analysis:

```bash
# 1. Ensure research curation has been run for the listing
curl -X POST http://localhost:3000/api/listings/1000000121/research-curation

# 2. Run integrated analysis (it will consume curated research)
curl -X POST http://localhost:3000/api/listings/1000000121/analysis/integrated

# 3. Check the response
curl http://localhost:3000/api/listings/1000000121/analysis/integrated
```

**Expected Result:**
- Full diagnostic report with 9 categories
- `verification_checks` array (what to verify)
- `opportunities` array (what looks promising)
- `next_steps_intro` bridging to Próximos Pasos
- Citations from curated research
- "Supportive realism" tone throughout

---

## 📝 Key Improvements from Old Approach

### Old Approach
- ❌ Used Gemini's Google Search grounding (unreliable, no control)
- ❌ Generic diagnostic without research context
- ❌ No opportunities section
- ❌ No verification checks
- ❌ No bridge to Próximos Pasos

### New Approach
- ✅ Uses curated Google Search research with credibility scoring
- ✅ Consumes AI-generated summaries (not raw snippets)
- ✅ Includes opportunities and verification checks ✅
- ✅ Empowering tone ("supportive realism") ✅
- ✅ Bridge to Próximos Pasos via `next_steps_intro` ✅
- ✅ Inline citations from credible sources ✅

---

## 🎯 Design Intent

> **Integrated Analysis = Empowering Truth**
> 
> Not a sales pitch, not a technical audit — a calm, credible bridge between what *is* and what *could be*.
> 
> It's designed so that agents can share it confidently, and buyers can read it and think:
> **"I can handle this one. Puedo."**

