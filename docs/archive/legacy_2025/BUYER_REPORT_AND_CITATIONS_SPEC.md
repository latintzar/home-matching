## Buyer-Facing Report and Citations – Working Spec (Chunk 4)

Last updated: 2025-01-27

### Purpose
One buyer-facing report that merges House Diagnostics (tight, house-only) with Context & Execution (constraints/opportunities) in a single read. Internally we compute them in separate passes; the modal shows both together with citations.

---

## Table of Contents (buyer-facing)
1) Cover and Listing Snapshot
- Title, key facts, main photo, last updated

2) The House as a Whole
- Short narrative synthesis (whole-property + rolled‑up room‑by‑room)
- Cross‑room themes/risks (3–5 bullets)
- One‑line per room with deep links to room sections

3) House Diagnostics (tight, house-only)
- Estado de materiales (materials & condition)
- Espacios y distribución (layout & distribution)
- Entorno / vistas (light, views, orientation)
- Servicios e instalaciones (MEP hints)
- Seguridad / accesibilidad (safety)
- Carácter arquitectónico (architectural character)
- Each claim carries citations

4) Context & Execution (constraints and opportunities)
- Permits environment & pathways
- Contractor availability & lead times
- Seasonality & work windows
- Community/HOA bylaws & building rules
- Local norms/standards, market practices, cost context (OOM)
- Links and citations per category

5) Rooms – Detailed Findings
- Per-room write‑ups (photos, findings, uncertainties) with anchors (e.g., `room-<id>`)
- Uncertainties are embedded per-room, not in a separate top-level section

6) Citations & References
- Collapsed reference list (expands; becomes endnotes in PDF)

**Note**: Uncertainties are integrated into the report prose (diagnostic findings, room descriptions) rather than appearing in a separate section. The "Qué verificar" checklist synthesizes all uncertainties into actionable verification items.

8) Next: "Qué verificar" (outside report)
- Derived later from final scope (house + context + intended works)

---

## Decisions (2025-11-03)
- Contextual categories: Use the same 12 categories as the Renovation Google Search (names and order) for the contextual endpoint and storage.
- Evidence handling: Persist prose with inline hooks and store sources in normalized records (per paragraph/claim → sources). Chip counts and confidence are computed server-side.
- Citation pass: Always server-side post‑generation. Persist the spliced text + evidence; UI renders as-is.
- Final aggregation naming/output: Keep `renovation-scope-finalize` for tier UI. Add `analysis/final-scope` to merge house + context + direction for Verify and Next Steps (not the tier UI).
- Language: Spanish by default for buyer‑facing text (contextual, permits, next-steps).
- PDF: Chips become superscripts with endnotes; chips/overlay are hidden in print.
- Redirect links: Show destination domain in UI when URLs come via redirects (vertexai/google), preserving destination URL.
- Gemini system instructions: Use strong SIs (persona, tone, structure, Spanish, strict JSON schema) to ensure consistency.

## Recent Changes (2025-11-06)
- **Removed uncertainties section**: Top-level `uncertainties_contradictions` section removed from buyer report. Uncertainties are now integrated in prose (diagnostic findings, room descriptions) rather than appearing redundantly. The "Qué verificar" checklist synthesizes all uncertainty sources into actionable items.
- **Qué verificar synthesis**: Updated to synthesize uncertainties from all sources (embedded prose, per-room arrays, contextual constraints) rather than relying on a top-level uncertainties section.
- **Photo URLs**: Fixed to use real URLs from `manual_photo_clusters` database table (no mock placeholders).
- **Prompt improvements**: Removed hardcoded examples (e.g., "cluster_75", "Casa de 1985", specific cost numbers) that could bias the model. Added explicit instructions to use real data from the report.
- **Chat endpoint**: Fully translated to Spanish with balanced, approachable senior advisor tone.

---

## Generation Order (pipeline view)
1) Whole‑property analysis → Room‑by‑room analysis
2) Integrated diagnostic endpoint synthesizes:
   - Narrative “The House as a Whole”
   - Cross‑room themes/risks
   - Per‑room one‑liners with anchors
   - Lean house categories (citations ready)
3) Contextual analysis endpoint (reno‑agnostic) interprets 12 categories (permits, contractors, HOA, seasonality, norms, market, etc.) given property, location, and neutralized "work intents" (derived from renovation thinking but not tier‑specific)
4) Post‑factum citation pass (see UX below)
5) Final‑scope aggregator (house + context + chosen direction)
6) "Qué verificar" generator (derived, prioritized checklist; links back into report)

---

## Endpoints (proposal)
- `POST /api/listings/:id/analysis/integrated`
  - Inputs: whole‑property outputs, room findings, room layouts (E1-E2 outputs)
  - Outputs: house narrative; cross‑room themes; lean categories (with per‑claim citation hooks); room one‑liners + room anchors
  - Photo analysis schema now includes `layout_reference` block per room:
    ```json
    {
      "wholeProperty": {...},
      "roomByRoom": [
        {
          "room_id": "cluster_2",
          "analysis": {...},
          "layout_reference": {
            "room_id": "cluster_2",
            "surfaces": { "floor": "oak", "walls": "matte_white", "ceiling": "white" },
            "objects": ["sofa", "table", "doorway to cluster_3"],
            "openings": [{"type": "arch", "faces_room": "cluster_3"}]
          }
        }
      ]
    }
    ```

- `POST /api/listings/:id/analysis/contextual`
  - Inputs: listingId, integrated summary, location, curated research (from analysis_curated_results)
  - Outputs: 12 interpreted contextual categories → stance (2–3 sentences for this property this year), signals (risks/lead‑times/permit class/seasonality/cost OOM), evidence bullets (links), confidence
  - **Style**: Senior analyst synthesis (narrative weaving, not intern-style source-by-source citation)
  - **Evidence**: Used for attribution/verification, not primary content. AI synthesizes multiple sources into coherent analysis
  - **Model**: gemini-2.5-pro with max thinking budget (32768) and 32768 output tokens

- `POST /api/listings/:id/analysis/final-scope` (buyer report aggregator)
  - **Inputs**: Integrated diagnostic, contextual analysis, whole-property analysis, room-by-room analysis, E2 unified home layout, room bullets
  - **Outputs**: Unified buyer-facing report with 6 sections (property_info, house_as_a_whole, house_diagnostics, contextual_analysis, room_findings, citations_references)
  - **Critical**: Uses E2 unified home layout as primary source for ALL rooms (not consolidated room bullets)
  - **Critical**: Explicitly copies `findings_by_category` from integrated diagnostic (7 categories required with minLength validation)
  - **Model**: gemini-2.5-pro with max thinking budget (32768) and 65535 output tokens
  - **Note**: Renovation options/tiers are NOT included (they're in tier UI)
  - **Note**: Uncertainties are integrated in prose (diagnostic findings, room descriptions), not in a separate section

- `POST /api/listings/:id/recommendations/verify`
  - **Inputs**: Buyer report (house diagnostics, contextual analysis, room findings with embedded uncertainties)
  - **Outputs**: Exactly 5 prioritized verification items with headline, brief, priority, and fluid expansion fields
  - **Synthesis**: Synthesizes uncertainties from all sources:
    - Embedded in diagnostic prose (e.g., "se desconoce", "no visible", "requiere verificación")
    - Per-room uncertainties from room_findings arrays
    - Contextual constraints (permits, community rules, etc.)
  - **Photo URLs**: Uses real URLs from manual_photo_clusters (no placeholders)
  - **Model**: gemini-2.5-pro with max thinking budget (32768) and 16384 output tokens
  - **Tone**: Balanced, approachable, pragmatic senior advisor voice (warm, reassuring, solution-oriented)

---

## Citations UX – How It Feels
Inline + explicit without clutter. Clean prose by default; evidence on demand.

- Subtle dotted-underlines on 1–2 key phrases per paragraph. Hover/focus shows a tiny source card (title, domain, date, “open”).
- An "Evidence (n)" chip floats on the right of each paragraph/section:
  - Desktop: pill aligned to paragraph baseline; Mobile: small row under the paragraph.
  - Shows aggregate confidence dot (High/Med/Low from count, agreement, recency).
  - Hover: popover with top 2 sources; Click: opens right‑side drawer scoped to that paragraph.
- Evidence drawer (scoped list): grouped by type (Gov/Regs, HOA, Market, Trade…), deduped; each item has a 1–2 line snippet, date, confidence, and actions (Open, Copy link, Copy cite). Clicking a source highlights the exact underlined phrase(s) in text.
- Section end shows a collapsed “References” block for print/read‑later (in PDF: superscripts + endnotes; chips hidden).
- Power users: temporary “Evidence overlay” toggle paints superscripts inline everywhere; toggle off restores clean prose.
- Accessibility: chip is keyboard reachable (role=button, aria-controls drawer); mobile uses a bottom sheet; long‑press opens source card.

---

## Anchors & Linking
- House categories: `#toc-*` (e.g., `#toc-key`, `#toc-details`, `#toc-categories`)
- Rooms: `#room-<id>` anchors; room one‑liners in "The House as a Whole" link to these.
- “Qué verificar” items in main UI link back to relevant anchors.

---

## Data Notes
- Citations model: each claim/paragraph carries `evidence[]` with {id, url, title, publisher, date, type, snippet, confidence}.
- Post‑factum citation pass can splice inline links and fill chip counts while keeping prose readable.

---

## Milestones
1) Integrated endpoint emits: house narrative, cross‑room themes, room one‑liners, lean categories + evidence hooks
2) Contextual endpoint (12 categories) – interpretation‑first with links
3) Citation pass & Evidence UI (chip, popover, drawer, print)
4) Final‑scope + Verify generator

---

## Recent Fixes (2025-11-05)

### Buyer Report Endpoint Fixes
- **Fixed room count issue**: Now fetches E2 unified home layout and room-by-room analysis to ensure ALL rooms are included (not just consolidated room bullets)
- **Fixed empty diagnostic categories**: Added explicit prompt instruction to copy `findings_by_category` from integrated diagnostic, with strict schema validation (all 7 categories required, minLength: 10)
- **Data sources**: Endpoint now fetches integrated diagnostic, contextual analysis, whole-property analysis, room-by-room analysis, E2 unified layout, and room bullets
- **Verified**: All 12 rooms now included, all 7 diagnostic categories populated correctly


