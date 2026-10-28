# Renovation Intelligence Architecture: "Double Barrel" RAG

**Status**: Draft
**Date**: 2025-01-29

This document outlines the architecture for enhancing the Renovation Intelligence pipeline using a "Double Barrel" search strategy: **Vertex AI Search (RAG)** for internal curated knowledge + **Google Search** for external real-time data.

---

## 1. The Core Concept: "Double Barrel" Search

Every research node in the pipeline now fires two parallel queries:

1.  **Barrel 1 (Internal RAG - High Trust)**: Queries our curated, clean datasets via **Vertex AI Agent Builder**.
    *   *Source A (Pricing)*: 1,400+ parsed Habitissimo price guides (JSONL).
    *   *Source B (Legal)*: 250+ Spanish Government Technical Code (CTE) & Forms (PDFs).
    *   *Tech*: Semantic Search (Vector + Keyword).
    *   *Value*: Exact forms, specific historical quotes, no SEO spam.

2.  **Barrel 2 (External Web - Real Time)**: Queries the open web via **Google Search API**.
    *   *Source*: Live internet (Leroy Merlin, recent blogs, forums).
    *   *Tech*: Keyword Search.
    *   *Value*: Current market rates (inflation checks), forum discussions, product availability.

---

## 2. Data Sources & Pre-processing

### A. The Pricing Store (Habitissimo)
*   **Raw Input**: 1,422 HTML files from Habitissimo Price Guides.
*   **Processing**: `scripts/preprocess_habitissimo.js` -> `data/habitissimo_prices.jsonl`
*   **Schema**:
    ```json
    {
      "id": "presupuestos_reforma_integral",
      "title": "Precio Reforma Integral",
      "description": "Detailed breakdown...",
      "price_avg": 45000,
      "price_min": 30000,
      "price_max": 60000,
      "url": "..."
    }
    ```
*   **RAG Engine**: Vertex AI Search (Structured Data Store).

### B. The Legal Store (Spanish Gov)
*   **Raw Input**: 250+ PDFs (CTE - Código Técnico de la Edificación, Application Forms).
*   **Processing**: None (Upload raw PDFs).
*   **RAG Engine**: Vertex AI Search (Unstructured Data Store) with OCR enabled.

---

## 3. Pipeline Integration Points

### Phase 7: Tier Ideation

#### **Node T1.5: "The Budget Setter"** (Enhanced)
*   **Goal**: Establish realistic budget brackets *before* detailed scope exists.
*   **The "Smart M2" Calculation**:
    1.  **Input**: Listing total M2 + Room Clusters (from Zero-Shot Step D).
    2.  **AI Step**: Gemini 3 Pro analyzes all room photos relative to total M2 to estimate per-room dimensions (e.g., "Living room looks ~25m2", "Kitchen ~12m2").
    3.  **RAG Query**:
        *   *Query*: `"precio reforma cocina 12m2 calidades medias"`
        *   *Source*: Pricing Store.
    4.  **Result**: Grounded base budgets per room, summed up for the property.

### Phase 8: Renovation Scope

#### **Node J-Reno: "The Renovation Researcher"** (Enhanced)
*   **Goal**: Get precise costs and timings for specific work items.
*   **Flow**:
    1.  **Input**: Work Item (e.g., "Install ducted AC").
    2.  **Gemini Query Gen**:
        *   *Semantic Query*: `"instalación aire acondicionado conductos"`
        *   *Web Query*: `"precio instalación aire acondicionado conductos 2025"`
    3.  **Execution**:
        *   *Barrel 1*: Returns JSON record `{ avg: 4500, min: 3000 }` from Habitissimo.
        *   *Barrel 2*: Returns Leroy Merlin product page `Machine: 1200€`.
    4.  **Synthesis**: "Base installation ~3000€ (Habitissimo) + Machine ~1200€ (Web) = ~4200€ Total."

#### **Node M: "The Permit Finder"** (Enhanced)
*   **Goal**: Identify permits and provide actual forms.
*   **Flow**:
    1.  **Input**: Work Scope (e.g., "Removing load-bearing wall").
    2.  **RAG Query**: `"solicitud licencia obra mayor estructura"` against **Legal Store**.
    3.  **Result**:
        *   Retrieves explicit PDF: `Modelo_Solicitud_Obra_Mayor.pdf`
        *   Retrieves relevant CTE section: `DB-SE (Seguridad Estructural)`
    4.  **Output**: "You need a Major License. Here is the official PDF form to download."

---

## 4. Implementation Roadmap

1.  **Cloud Setup**:
    *   [ ] Create Vertex AI Search App.
    *   [ ] Upload `habitissimo_prices.jsonl` to GCS.
    *   [ ] Upload `Spanish Government/` PDFs to GCS.
    *   [ ] Connect Data Stores to App.

2.  **Client Library**:
    *   [ ] Create `src/lib/services/rag-search.ts`.
    *   [ ] Implement `searchInternalKnowledge(query, type)` method.

3.  **Pipeline Logic**:
    *   [ ] **Step D Enhancement**: Add "Room Size Estimator" prompt to Gemini 3 (using total M2 + visual analysis).
    *   [ ] **Update J-Reno**: Replace Habitissimo CSE with RAG call.
    *   [ ] **Update Node M**: Add "Form Retrieval" logic using Legal Store.

4.  **Testing**:
    *   [ ] Verify pricing accuracy (RAG vs Web).
    *   [ ] Verify PDF retrieval relevance.

