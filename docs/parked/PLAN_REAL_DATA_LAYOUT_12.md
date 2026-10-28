# Plan: Real Data Integration for Forensic Optimism Layout (Layout 12)

## Goal
Integrate real-world data from Idealista listing `109445875` into the "Forensic Optimism" buyer report layout (Layout 12), which is now the **production standard**. The design aesthetic aligns with `test-recommendations-linear`.

**Architectural Update**:
*   **Basic Orchestrator**: Now includes the full Intelligence Suite (Social Radar, Street View, etc.) and the Buyer Report generation.
*   **Final Scope (`/analysis/final-scope`)**: Is part of the Basic Orchestrator flow.
*   **Qué Verificar**: Logic has been absorbed into the `final-scope` endpoint and is no longer a separate step.
*   **Layout Selection**: Only Layout 12 ("Forensic Optimism") is maintained; previous variations are obsolete.

## Phase 1: Design Aesthetic Alignment
1.  **Audit `test-recommendations-linear`**:
    *   Identify key design tokens: Color palette (slate/emerald/amber usage), Card styling (shadows, borders, roundedness), Typography (headings vs body), and Spacing.
    *   Note specific component usages (e.g., how `Badge`, `Button`, or `Carousel` are styled).
2.  **Apply to `Layout12Optimism`**:
    *   Refine the "Forensic Optimism" component to match the identified aesthetic.
    *   Ensure consistency in icons, layout structure, and visual hierarchy.

## Phase 2: Pipeline Execution (Real Data Generation)
1.  **Scrape Listing**:
    *   Endpoint: `/api/scrape/robust` (or `universal`) targeting `https://www.idealista.com/inmueble/109445875/`.
    *   Action: Create listing record in Supabase.
2.  **Run Basic Orchestrator (Full Intelligence)**:
    *   Endpoint: `/api/listings/[id]/orchestrate-basic-package`.
    *   Action: This single orchestrator now runs the entire pipeline:
        *   Text Analysis (A-C)
        *   Official Verification (Cadastre)
        *   **Intelligence Suite** (Social Radar, Street View, etc.)
        *   Photo Analysis (F3, RoomByRoom)
        *   Google Search (Double-Barrel Hybrid Engine)
        *   **Buyer Report Generation** (via `/analysis/final-scope`)
            *   Includes **Qué Verificar** checklist logic internally.
3.  **Result**:
    *   A complete `buyer_report` JSON blob stored in `text_analysis_results`, containing the 3-chapter structure AND the verification checklist.

## Phase 3: Data Integration
1.  **Fetch Data**:
    *   Create a script (or use Supabase SQL) to fetch the full `buyer_report` for listing `109445875`.
2.  **Update Mock/State**:
    *   Replace the static data in `src/lib/mock-buyer-report.ts` with the actual JSON result from the pipeline.
    *   Ensure specific fields (e.g., `visual_evidence`, `airbnb_listings`, `verification_checklist`) are populated properly.

## Phase 4: Verification
1.  **Test Layout 12**:
    *   Navigate to `http://localhost:3000/test-buyer-report-variations`.
    *   **Verify**: Only Layout 12 is shown (no carousel).
    *   Verify "Street View Carousel" loads real images/pins.
    *   Verify "Airbnb Map" plots real data points.
    *   Verify "Cadastral" card shows real data.
    *   Verify "Qué Verificar" checklist appears with items from the absorbed logic.

## Execution Plan
1.  **Analyze Design**: Read `src/app/test-recommendations-linear/page.tsx`.
2.  **Run Pipeline**: Trigger `orchestrate-basic-package` via script.
3.  **Fetch & Update**: Get JSON, update mock file.
4.  **Refine UI**: Polish `Layout12Optimism.tsx`.

