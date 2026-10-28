# Ultimate Pipeline Documentation

**Last Updated**: 2025-01-28  
**Status**: Production-Ready (Basic & Renovation & Lifestyle)  
**Master Doc**: [LEO_PLATFORM_ARCHITECTURE.md](./LEO_PLATFORM_ARCHITECTURE.md)  
**Primary Clustering Method**: Zero-Shot Clustering (Gemini 3 Pro Preview)
**Renovation Engine**: Unified Strategy + Double-Barrel RAG (Live)
**Lifestyle Engine**: Autonomous Profiler + Scout + Orchestrator (Live)

---

## 🎯 Overview

This document describes **Pillars 3 & 4** of the Leo Platform:

| Pillar | Package | Trigger | Purpose |
|--------|---------|---------|---------|
| **3. Analysis** | Basic Package | User requests viewing OR Extension adds property | Deep dive for viewing preparation |
| **4. Reno** | Renovation Upgrade | User upgrades after Analysis | Renovation tiers, before/after, scope |

### Where This Fits in the Platform

```
HARVEST → RECOMMENDER → ANALYSIS (you are here) → RENO (you are here)
```

- **Before this**: Harvest Engine provides parsed listing data. Recommender filters to shortlist and may have already run WPA.
- **This doc**: What happens when a user commits to viewing a property or a professional adds one via extension.

### Relationship to WPA (Whole Property Analysis)

**Important**: The Recommender may have already run WPA on a property (during shortlist scoring).

- **If WPA exists**: Analysis uses the cached WPA, goes deeper with room-by-room analysis.
- **If WPA doesn't exist**: Analysis runs WPA first, then continues.

This document describes the **complete, production-ready pipeline** from URL input to published Deep Dive.

### 📸 Critical: Fetch-and-Dump for Photo Analysis

**We do NOT store images.** All photo analysis uses the **Fetch-and-Dump** pattern:

```
When Gemini analysis needed:
1. FETCH: Download images from original agency URLs (stored in listing.image_urls)
2. SEND: Pass to Gemini for analysis (WPA, clustering, room-by-room)
3. STORE: Save analysis results only
4. DUMP: Don't keep the images — they're still on agency servers
```

**Why?**
- 650k listings × 60 photos = 24 TB of images = ~$550/month
- With Fetch-and-Dump: $0 image storage, always fresh photos
- See [LEO_PLATFORM_ARCHITECTURE.md](./LEO_PLATFORM_ARCHITECTURE.md#critical-architecture-fetch-and-dump-for-photo-analysis)

### 🔒 Immutable Listing Cache & Deduplication

We enforce a **Single Source of Truth (SSOT)** for every property to avoid duplicate costs and fragmented data.

1.  **Identity Resolution (The "Three-Check" System)**:
    *   **Check 1: URL Match** (Fastest) - Exact match on `source_url`.
    *   **Check 2: Reference Match** (Cross-Source) - Matches `reference_number` (e.g., "REF-123") across different URLs (Idealista vs. Agency Site).
    *   **Check 3: Content Fingerprint** (Future) - Visual/Address similarity.

2.  **Idempotency Policy**:
    *   **Write Once, Read Many**: Expensive analyses (Whole Property, Room-by-Room, Search) are generated **once** per listing.
    *   **Auto-Skip**: Every endpoint checks for existing valid results before triggering AI.
    *   **Global Reuse**: The Lifestyle Engine reuses Basic Package analysis, and vice versa.

3.  **User Layer Separation**:
    *   **Immutable Layer**: `listings`, `whole_property_analysis`, `room_analyses`, `analysis_search_results`. (Objective property facts).
    *   **User Layer**: `fit_scores`, `favorites`, `user_notes`. (Subjective user data, calculated *on top* of the cache).

---

## 💰 Pricing & Cost Structure

**Central Configuration**: `src/lib/pricing-config.ts`

### Vertex AI (Google Cloud)
*   **Gemini 3 Pro Preview:**
    *   Input: **$2.00** / 1M tokens
    *   Output: **$12.00** / 1M tokens
*   **Gemini 2.5 Flash:**
    *   Input: **$0.30** / 1M tokens
    *   Output: **$2.50** / 1M tokens
*   **Gemini 2.5 Flash Lite (Scoring/Ingest):**
    *   Input: **$0.15** / 1M tokens
    *   Output: **$1.25** / 1M tokens

### External APIs
*   **ScrapingDog/Scrapfly:** **$0.004** per request.
*   **Google Maps:** Places ($0.017) / Routes ($0.005).

---

## 🔄 Complete Pipeline Flow: Scraping → R3

### Phase 1: Scraping & Data Collection 📦 **Basic Package**

#### **Ingest Node: "The Gatekeeper"** ✅
- **Idempotency**: ✅ (Checks URL + Reference)
- **Endpoints**: 
  - `/api/ingest/browser` (Client-Side Extension Push)
  - `/api/ingest/server` (Server-Side Fetch/AI)
- **Architecture**: 
  - **Universal Deduplication**:
    1.  Receives URL.
    2.  Checks DB for `source_url`.
    3.  If no match, scrapes data & extracts `reference_number`.
    4.  Checks DB for `reference_number` (e.g., finding a listing ingested via a different agent URL).
    5.  **Merge/Link**: If match found, updates the existing Master Listing. If new, inserts.
- **Input Table**: None (External URL)
- **Output Table**: `listings`, `listing_photos`

---

### Phase 2: Text Analysis Pipeline 📦 **Basic Package**

#### **A-C Nodes: "Text Intelligence"** ✅
- **Idempotency**: ✅ (Checks `text_analysis_results` by phase)
- **Endpoint**: `/api/listings/[id]/text-analysis/[phase]`
- **Model**: Gemini 2.5 Flash Lite / Flash
- **Input Table**: `listings` (Column: `scraped_data`)
- **Output Table**: `text_analysis_results`
  - **Schema**: `{ phase: 'a_facts' | 'b3_snippets' | 'c_unknowns', results: JSON }`

---

### Phase 2.5: Official Verification (Cadastre Node) 📦 **Basic Package**

#### **Cadastre Node: "The Truth Engine"** ✅
- **Idempotency**: ✅ (Checks `text_analysis_results` phase `cadastral_data`)
- **Endpoint**: `POST /api/listings/[id]/analysis/cadastre`
- **Model**: Deterministic (Government API) + Gemini 2.5 Flash (Sampler)
- **Output Table**: `text_analysis_results` (Phase: `cadastral_data`)

---

### Phase 2.7: Location Intelligence 📦 **Basic Package**

#### **Intelligence Suite Node: "The Forensic Analyst"** ✅
- **Idempotency**: ✅ (Checks `listings.social_intelligence`)
- **Endpoint**: `POST /api/listings/[id]/intelligence/social-radar`
- **Output Table**: `listings` (Column: `social_intelligence`)

---

### Phase 3: Photo Analysis Pipeline 📦 **Basic Package**

#### **D Node: "The Zero-Shot Clusterer"** ⭐ **PRIMARY METHOD** ✅
- **Idempotency**: ✅ (Checks `clusters` table)
- **Endpoint**: `POST /api/listings/[id]/clusters/zero-shot/full`
- **Model**: Gemini 3 Pro Preview
- **Output Table**: `clusters`

#### **F3 Node: "Whole Property Analyzer"** ✅
- **Idempotency**: ✅ (Checks `whole_property_analysis` by URL & Listing ID)
- **Endpoint**: `/api/listings/[id]/analysis/whole-property`
- **Model**: Gemini 3 Pro Preview
- **Role**: **Objective** description of the property (Structure, Light, Finishes). Reused for Fit Scoring.
- **Output Table**: `whole_property_analysis`

#### **RoomByRoom Node: "The Room Inspector"** ✅
- **Idempotency**: ✅ (Checks `room_analyses` by URL & Listing ID)
- **Endpoint**: `/api/listings/[id]/photo-analysis/room-by-room`
- **Model**: Gemini 2.5 Flash
- **Output Table**: `room_analyses`

---

### Phase 4: Analysis Search (Double-Barrel) 📦 **Basic Package**

#### **G Node: "The Super Search" (2-Barrel Context Engine)** ✅
- **Idempotency**: ✅ (Checks `analysis_curated_results` count)
- **Endpoint**: `POST /api/listings/[id]/analysis-google-search`
- **Model**: Gemini 3 Pro Preview (Barrel B) / Flash (Barrel A)
- **Output Tables**: `analysis_search_results`, `analysis_curated_results`

---

### Phase 5: Synthesis & Reporting 📦 **Basic Package**

#### **Buyer Report Node: "The 3-Chapter Report"** ✅
- **Idempotency**: ✅ (Checks `text_analysis_results` phase `buyer_report`)
- **Endpoint**: `POST /api/listings/[id]/analysis/final-scope`
- **Model**: Gemini 3 Pro Preview (High Thinking)
- **Output Table**: `text_analysis_results` (Phase: `buyer_report`)

---

### Phase 6: Renovation Interface (The Gateway) ⬆️ **Renovation Upgrade**

#### **Baseline Check Node (Auto)** ✅
- **Idempotency**: ✅ (Checks `text_analysis_results` phase `baseline_check`)
- **Endpoint**: `POST /api/listings/[id]/renovation/baseline-check`

---

### Phase 7: Unified Renovation Engine ⬆️ **Renovation Upgrade**

#### **Node 1: "The Architect" (Unified Strategy)** ✅
- **Idempotency**: ✅ (Checks `text_analysis_results` phase `unified_strategy`)
- **Endpoint**: `POST /api/listings/[id]/renovation/unified-strategy`

#### **Node 2: "The Researcher" (J-Reno Double-Barrel)** ✅
- **Idempotency**: ✅ (Checks `renovation_research_results`)
- **Endpoint**: `POST /api/listings/[id]/renovation/search`

#### **Node 3: "The Contractor" (Unified Scope)** ✅
- **Idempotency**: ✅ (Checks `final_renovation_scope`)
- **Endpoint**: `POST /api/listings/[id]/renovation/unified-scope`
- **Output Table**: `final_renovation_scope`

---

### Phase 8: Visual Execution (R-Pipeline) ⬆️ **Renovation Upgrade**
- **R1/R2/R3 Nodes**: ✅ (Most check for existing URLs in `after_photos` or `omsria_processed_images`)

---

### Phase 9: Lifestyle Intelligence (The Life Fit) 🆕 **Lifestyle Package**

The Lifestyle Engine uses a multi-node architecture to match properties to user lifestyles.

#### **Node 1: "The Psychologist" (AI Profiler)** ✅
- **File**: `src/lib/lifestyle/ai-profiler.ts`
- **Model**: Gemini 3 Pro Preview
- **Role**: Converts free-text user input into a structured `AIProfile`:
  - `user_persona` - Core identity
  - `core_values` - What matters most
  - `hidden_gems` - Creative search ideas
  - `hard_constraints` - Non-negotiables (commute, budget)
  - `soft_constraints` - Nice-to-haves
  - `property_preferences` - Physical requirements
- **Output**: `SmartLifestyleResult` with profile + alternative scenarios

#### **Node 2: "The Cartographer" (Geoapify Engine)** ✅
- **File**: `src/lib/lifestyle/geoapify-engine.ts`
- **API**: Geoapify Isoline API
- **Role**: Generates isochrone polygons (travel-time boundaries) from anchor points
- **Input**: Anchor location + transport mode + max duration
- **Output**: GeoJSON polygon representing reachable area

#### **Node 3: "The Scout" (AI Vibe Checker)** ✅
- **File**: `src/lib/lifestyle/ai-scout.ts`
- **Model**: Gemini 2.5 Flash
- **Role**: Filters search results by "vibe" - soft criteria that can't be captured by ratings alone
- **Example**: "Authentic, non-corporate, village feel" → Rejects chains, keeps local gems
- **Output**: `Map<place_id, VibeCheckResult>` with match/reject + reason

#### **Node 4: "The Orchestrator" (Sweet Spot Generator)** ✅
- **File**: `src/lib/lifestyle/orchestrator.ts`
- **Role**: The brain that coordinates everything:
  1. Resolves anchors (fixed locations or search queries)
  2. Applies filters (rating thresholds)
  3. Runs AI Scout for vibe verification
  4. Resolves dependencies ("must be near Italian sandwich shop")
  5. Generates isochrones for each anchor
  6. **Intersects all polygons** → The "Sweet Spot"
- **Output**: `OrchestratorResult` with `sweetSpot` polygon + map layers

#### **Node 5: "The Fit Scorer" (Per-User Matching)** ✅
- **File**: `src/lib/lifestyle/fit-scoring.ts`
- **Model**: Gemini 2.5 Flash Lite
- **Idempotency**: ✅ (Reuses cached `whole_property_analysis`)
- **Role**: Calculates a 0-100 fit score for each listing based on:
  - Property preferences match
  - Lifestyle DNA match
  - Visual quality match (from Whole Property Analysis)
- **Output**: `FitScoreResult` with score + strengths + concerns

#### **Entry Point: Engine** ✅
- **File**: `src/lib/lifestyle/engine.ts`
- **Endpoint**: `/api/lifestyle/generate-polygon`, `/api/lifestyle/test-single`
- **Role**: Bridges the Profiler → Orchestrator → Polygon generation
