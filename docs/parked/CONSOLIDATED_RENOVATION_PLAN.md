
# Consolidated Renovation Plan: Unified Engine & RAG

**Last Updated**: 2025-11-20
**Status**: ✅ **COMPLETED**
**Architecture**: 3-Node Unified Engine (Strategy, Search, Scope) + RAG Data Stores
**Flow**: Auto-Pilot (Default) -> Co-Pilot (User Feedback)

---

## 1. The "Physics-Based" Foundation

Before any AI hallucination happens, we ground the system in physics and market data.

### A. Smart M2 Inference (Node D+) ✅
**Goal:** We need room dimensions to calculate costs. Scrapers only give total M2.
- **Input Tables:** `listings` (total m2), `clusters` (photo count, connectivity).
- **Output Table:** `text_analysis_results` (phase: `smart_m2`).
- **Schema:** `{ rooms: [{ name: "Kitchen", m2: 12, confidence: 0.8 }] }`.

### B. Baseline Check (Pre-Computation) ✅
**Goal:** Anchor expectations before the user even clicks anything.
- **Input Source:** `text_analysis_results` (phase: `smart_m2`) + **RAG Pricing Store**.
- **Output Table:** `text_analysis_results` (phase: `baseline_check`).
- **Schema:** `{ baseline_rom: { low: 80000, high: 120000 }, breakdown:_by_category }`.

---

## 2. The Interactive Gateway (Phase 6)

### A. UI Components ✅
1.  **"Personalise" Button:** Right-aligned in "Renovation Ideas" header.
2.  **Modal Pop-up:**
    -   **Budget Slider:** Range slider synced with number input.
    -   **Directives Text Area:** "What would you like to change?"
    -   **Submit Button:** "Update Renovation".
3.  **Feedback Engine (Instant):**
    -   Endpoint: `/api/listings/[id]/renovation/check-budget`
    -   Trigger: On slider change (debounced).
    -   Logic: Compare `User Budget` vs `Baseline Check` result.
    -   Output: Traffic Light (Red/Yellow/Green) + Text ("This budget is tight for a full renovation").

---

## 3. The Unified Renovation Engine (Phase 7)

This replaces the old T1-N pipeline. It runs in two modes: **Default** (Auto) and **Custom** (User Input).

### Node 1: The Architect (Unified Strategy) ✅
**Goal:** Define the "Soul" of the renovation (3 Tiers).
- **Endpoint:** `POST /api/listings/[id]/renovation/unified-strategy`
- **Input Tables:** 
    - `text_analysis_results` (Phase: `smart_m2`, `buyer_report`)
    - `whole_property_analysis`
- **Input Body:** `user_directives` (Optional: `{ budget: 50000, style: "Modern" }`)
- **Output Table:** `text_analysis_results` (Phase: `unified_strategy`).
- **Schema:** `{ tiers: { estandar: { philosophy: "...", key_actions: [] }, ... } }`

### Node 2: The Researcher (J-Reno Double-Barrel) ✅
**Goal:** Get real numbers and laws for the Strategy.
- **Endpoint:** `POST /api/listings/[id]/renovation/search`
- **Input Table:** `text_analysis_results` (Phase: `unified_strategy`).
- **Architecture:**
    -   **Barrel 1 (Legal RAG):** Checks *Spanish Technical Code* & *Bureaucratic Forms*.
    -   **Barrel 2 (Google Product Search):** Live scraping for specific items.
    -   **Barrel 3 (Catalog RAG):** Lookups in *Bauhaus/Obramat CSVs*.
- **Output Table:** `renovation_research_results` (Columns: `category`, `tier`, `content`).

### Node 3: The Contractor (Unified Scope) ✅
**Goal:** The detailed quote.
- **Endpoint:** `POST /api/listings/[id]/renovation/unified-scope`
- **Input Tables:** 
    - `text_analysis_results` (Phase: `unified_strategy`, `smart_m2`)
    - `renovation_research_results`
- **Output Table:** `final_renovation_scope`.
- **Schema:** `tier`, `scope_data` (JSON: line_items, total_price, timeline, permits).

---

## 4. Visual Execution (Phase 8)

### R2: Unified Prompter ✅
**Goal:** Turn scope into image prompts.
- **Endpoint:** `POST /api/listings/[id]/visuals/r2-prompt`
- **Input Table:** `final_renovation_scope` + `style_direction` (if exists).
- **Output Table:** `renovation_prompts`.
- **Schema:** `tier`, `room_id`, `prompt_text`.

---

## 5. RAG Data Store Setup (Vertex AI) ✅

We need to create 4 Data Stores in Google Cloud Vertex AI Agent Builder:

1.  **Pricing Store (Unstructured + Manifest):** ✅
    -   Source: Habitissimo Price Guides (1,422+ HTML pages).
    -   Format: Raw HTML (JSONL Manifest).
2.  **Legal Store (Unstructured):** ✅
    -   Source: CTE (Código Técnico), Ley de Propiedad Horizontal, BOE.
    -   Format: PDF.
3.  **Forms Store (Unstructured):** ✅
    -   Source: Official Municipal Permit Forms.
    -   Format: PDF.
4.  **Catalog Store (Structured):** ✅
    -   Source: Bauhaus / Obramat Product Catalogs.
    -   Format: CSV (Name, SKU, Price, Category).

---

## 6. Infrastructure & Scraping (Parallel Track) 🛠️

### Central Model Registry 🔧
**Goal:** Decouple logic from model versions. Stop hardcoding strings.
- **Action:** Create `src/lib/model-registry.ts`.
- **Function:** `getModelForTask(task: 'clustering' | 'strategy' | 'scope'): string`
- **Benefit:** One-line config change to switch entire pipeline to Gemini 4 when it comes out.

### Universal Scraper (Phase 1 Expansion) 🌍
**Goal:** Accept ANY real estate URL (Fotocasa, Agent sites) + Manual Entry.
- **Endpoint:** `POST /api/scrape/universal`
- **Output Table:** `listings` (with `scraped_data`).
- **Strategy:**
  1. **Fotocasa:** Extract `__NEXT_DATA__` or feed raw HTML to Gemini.
  2. **Generic:** Feed raw HTML to Gemini ("Extract Price, M2...").
  3. **Manual:** `POST /api/listings/manual` for form-based entry.

---

## 7. Orchestration Strategy 🎻

We will maintain two distinct orchestrators to separate the "Basic" product from the "Premium" renovation upgrade.

### Orchestrator 1: Basic Package (The Setup) ✅
- **Endpoint:** `POST /api/listings/[id]/orchestrate-basic-package`
- **Scope:** Phase 1 (Scraping*) -> Phase 5 (Qué Verificar).
- **Steps:** Text Analysis -> Clustering -> Photo Analysis -> Search -> Buyer Report.
- **Output:** A complete "As-Is" intelligence report.
- **Debug Mode:** Supports `startFrom: "StepName"` to resume execution.
- **Common Test Start:** `startFrom: "F3"` (assumes zero-shot clustering already complete).

### Orchestrator 2: Renovation Engine (The Upgrade) ✅
- **Endpoint:** `POST /api/listings/[id]/orchestrate-renovation`
- **Scope:** Phase 6 (Setup) -> Phase 8 (Visuals).
- **Prerequisite:** Basic Package must be complete (checked at start).
- **Steps:**
  1. **Setup:** Smart M2 + Baseline Check (Linked to RAG).
  2. **Strategy:** Node 1 (Architect).
  3. **Research:** Node 2 (Researcher).
  4. **Scope:** Node 3 (Contractor).
  5. **Visuals:** R1 -> R1.5 -> F0 -> R2 -> R3.
- **Debug Mode:** Supports `startFrom: "Node1"` etc.

---

## 8. Implementation & Verification Checklist 📋

### Phase A: Implementation (Do This First) 🛠️

1.  ✅ **Documentation:** Update `ULTIMATE_PIPELINE.md` and `CONSOLIDATED_RENOVATION_PLAN.md` (Done).
2.  ✅ **Endpoint Structure:** Move `visuals/` endpoints to match documentation (Done).
3.  ✅ **Orchestrator Paths:** Update orchestrator to use `visuals/` endpoints (Done).
4.  **Database Migrations:** Check if any new tables/columns needed:
    -   `text_analysis_results.phase` enum: Add `smart_m2`, `baseline_check`, `unified_strategy` if missing.
    -   `final_renovation_scope` table: Verify exists with `tier`, `scope_data` columns.
    -   **Action:** Use MCP Supabase to check schema, apply migrations if needed.
5.  **Prerequisites Check:** Verify listing `1000000121` has:
    -   `clusters` table populated (zero-shot clustering complete).
    -   `listing_photos` table populated.
    -   **Action:** Query via MCP Supabase to confirm.

### Phase B: Verification (STOP HERE - Wait for User) ⏸️

**After Phase A is complete, STOP and report:**
- ✅ All endpoints exist and match documentation.
- ✅ All migrations applied (or confirmed not needed).
- ✅ Prerequisites verified for test listing.
- ✅ Ready for testing.

**Wait for user command: "start testing"**

### Phase C: Testing (User-Initiated) 🧪

**When user says "start testing", execute:**

1.  **Test Command:**
    ```bash
    curl -N -X POST http://localhost:3000/api/listings/1000000121/orchestrate-basic-package \
      -H "Content-Type: application/json" \
      -d '{"startFrom": "F3", "force": true}'
    ```
2.  **Expected Behavior:**
    -   Skips Text Analysis (A-C) and Clustering (D) (assumed complete).
    -   Starts at F3 (Whole Property Analysis).
    -   Streams full SSE logs to terminal (no truncation).
    -   Completes through Qué Verificar.
3.  **Verification Points:**
    -   Check `whole_property_analysis` table populated.
    -   Check `room_analyses` table populated.
    -   Check `analysis_curated_results` table populated (8 Mega-Categories).
    -   Check `text_analysis_results` (phase: `buyer_report`) exists.
    -   Check `verify_recommendations` table populated.

---

## 9. Implementation Order (High-Level)

1.  ✅ **Document:** Update Pipeline Docs (Done).
2.  ✅ **Stub Endpoints:** Create structure for New Nodes (Done).
3.  ✅ **Verify Basic Package:** Test Phase 1-5 on real listing (Done).
4.  ✅ **Cloud Setup:** Create Vertex AI Data Stores & Upload Data (Done).
5.  ✅ **Connect RAG:** Implement `src/lib/vertex-rag.ts` and connect to endpoints (Done).
6.  ✅ **UI Implementation:** Build "Personalise" Modal & Renovation Cards (Done).
7.  ✅ **Orchestrate:** Implement `/orchestrate-renovation` endpoint (Done).
8.  ✅ **Infrastructure:** Build Model Registry & Universal Scraper (Done).
