# 4 November Edits - Implementation Plan

Last updated: 2025-01-27 (updated with E1-E2 layout integration)

## 🎯 Overview

This document outlines the four major implementation chunks for today's development session. Each chunk represents a complete, self-contained feature that builds on the existing pipeline architecture.

---

## 📋 Implementation Chunks

### ✅ Chunk 1: Room Layout Consistency

**Document**: [`ROOM_LAYOUT_CONSISTENCY_SPEC.md`](ROOM_LAYOUT_CONSISTENCY_SPEC.md)

**Goal**: Build structured room layouts and fuse them into a unified home representation using visibility mappings.

**Key Components**:
- **E1**: Room Layout Extraction (Gemini 2.5 Flash)
  - Input: Photos + visibility_mappings + cluster_name
  - Output: Structured room layout JSON with geometry, objects, materials
  - Endpoint: `POST /api/listings/[id]/rooms/[roomId]/layout/extraction`

- **E2**: Unified Home Layout Fusion (Gemini 2.5 Flash)
  - Input: All room layouts + listing text + visibility mappings
  - Output: Single allocentric home layout with connections
  - Endpoint: `POST /api/listings/[id]/rooms/layout/fusion`

**Data Model**:
- `room_analyses.room_layout_json` (JSONB) - Per-room layouts
- `room_analyses.unified_home_layout_json` (JSONB) - Complete home layout

**Status**: Ready for implementation

---

### ✅ Chunk 2: Renovation Tiers V2

**Document**: [`RENOVATION_TIERS_V2_PIPELINE.md`](RENOVATION_TIERS_V2_PIPELINE.md)

**Goal**: Create a precision renovation pipeline with proper tone, data contracts, and validation from seed through finalization.

**Key Components**:
1. **Scope Seed** - `POST /api/listings/[id]/renovation-scope`
   - Plainspoken work items with photo linkage
   - Deterministic IDs, tier assignment
   - **NEW**: Uses E1-E2 room layouts for material consistency
   - **NEW**: References `unified_layout.connections` for structural changes
   - **NEW**: Material vocabulary continuity (oak → oak upgrade, etc.)

2. **Pricing** - `POST /api/listings/[id]/renovation-pricing`
   - Per-item ranges (€100 rounding)
   - Evidence-based costing

3. **Timeline** - `POST /api/listings/[id]/renovation-timeline`
   - 5-7 phases with durations
   - 100% item→phase mapping

4. **Permits** - `POST /api/listings/[id]/renovation-permits`
   - Per-job permit mapping
   - Spanish explanations

5. **Finalize** - `POST /api/listings/[id]/renovation-scope-finalize`
   - Merge all passes
   - Compute tier totals (€1,000 rounding)
   - Timeline offsets

6. **Style Prompts** - ~~`POST /api/listings/[id]/renovation-style-prompts`~~ - **REMOVED** (replaced by R2b)
   - Photo-aware, per-room per-tier
   - Grounded in final scope

**Data Contracts**: Strict JSON schemas with AJV validation

**Layout Integration**:
- `ScopeSeedInput` now includes `room_layouts` (E1) and `unified_layout` (E2)
- Prompt uses layout data to identify surfaces/elements requiring updates
- Material vocabulary maintained across tiers for consistency
- Structural changes validated against `unified_layout.connections`

**Status**: Ready for implementation

---

### ✅ Chunk 3: After Image Generation Pipeline

**Document**: [`AFTER_IMAGE_GENERATION_PIPELINE.md`](AFTER_IMAGE_GENERATION_PIPELINE.md)

**Goal**: Generate consistent, high-quality "after renovation" renders for all property photos, maintaining visual consistency across angles and visible room adjacencies.

**⚠️ STATUS: All Q pipeline endpoints described below have been REMOVED.**

**Current Standard Pipeline:** R Pipeline (Room-Based Approach)

See `PIPELINE_FLOW.md` for current R pipeline documentation.

**Removed Q Pipeline Endpoints:**
- ~~**Q1**: `/api/listings/[id]/style-direction`~~ - **REMOVED** (replaced by T2.5)
- ~~**Q2**: `/api/listings/[id]/renovation-style-prompts`~~ - **REMOVED** (replaced by R2b)
- ~~**Q3**: `/api/listings/[id]/rooms/[roomId]/after/anchor`~~ - **REMOVED** (replaced by R3)
- ~~**Q4**: `/api/listings/[id]/rooms/[roomId]/after/angle-match`~~ - **REMOVED** (replaced by R3)
- ~~**Q5**: `/api/listings/[id]/after/cross-room-consistency`~~ - **REMOVED** (replaced by R4 + R6)
- ~~**Orchestration**: `/api/listings/[id]/after/generate-all`~~ - **REMOVED** (Q pipeline removed)

**Storage**: `after_photos` table with `is_anchor` and `harmonized` flags

**Status**: All Q pipeline endpoints REMOVED - R pipeline is now standard

---

### ✅ Chunk 4: Buyer-Facing Report and Citations

**Document**: [`BUYER_REPORT_AND_CITATIONS_SPEC.md`](BUYER_REPORT_AND_CITATIONS_SPEC.md)

**Goal**: Create a unified buyer-facing report that merges House Diagnostics with Context & Execution, with inline citations and evidence management.

**Key Components**:
1. **Integrated Diagnostic** - `POST /api/listings/[id]/analysis/integrated`
   - House narrative
   - Cross-room themes
   - Room one-liners with anchors
   - Lean house categories with citation hooks
   - **NEW**: Photo analysis schema includes `layout_reference` block per room
   - **NEW**: References E1-E2 layout data (surfaces, objects, openings)

2. **Contextual Analysis** - `POST /api/listings/[id]/analysis/contextual`
   - 12 reno categories (permits, contractors, HOA, seasonality, etc.)
   - Stance, signals, evidence per category
   - Spanish output

3. **Final Scope Aggregator** - `POST /api/listings/[id]/analysis/final-scope`
   - Merges integrated + contextual + user direction

4. **Verify Generator** - `POST /api/listings/[id]/recommendations/verify`
   - "Qué verificar" checklist
   - Links to report anchors

**UI Features**:
- Evidence chips with confidence indicators
- Inline dotted-underlines on key phrases
- Evidence drawer with grouped sources
- PDF export with superscripts/endnotes

**Status**: Ready for implementation

---

## 🔄 Implementation Order

### Recommended Sequence

1. **Chunk 1** (E1-E2) - Foundation for all downstream work
   - Room layouts feed into renovation scope (Chunk 2)
   - Unified layout feeds into after image generation (Chunk 3)
   - Layout references feed into integrated analysis (Chunk 4)

2. **Chunk 2** (Renovation Pipeline) - Depends on Chunk 1
   - Uses room layouts for scope generation (material consistency)
   - Uses unified layout connections for structural validation
   - Feeds into after image prompts

3. **Chunk 3** (After Images) - Depends on Chunks 1 & 2
   - Uses unified layout from Chunk 1
   - Uses style prompts from Chunk 2
   - Uses visibility mappings from clustering

4. **Chunk 4** (Buyer Report) - Depends on all previous
   - Aggregates integrated + contextual analysis
   - Includes layout_reference in photo analysis schema
   - References renovation scope and after images

---

## 📊 Data Dependencies

```
Clustering (Existing)
  ↓
Chunk 1: Room Layouts (E1-E2)
  ↓
Chunk 2: Renovation Pipeline (Scope → Pricing → Timeline → Permits → Finalize)
  ↓
Chunk 3: After Images (Q1 → Q2 → Q3 → Q4 → Q5)
  ↓
Chunk 4: Buyer Report (Integrated + Contextual + Verify)
```

---

## ✅ Success Criteria

### Chunk 1
- ✅ E1 generates structured room layouts for all clusters
- ✅ E2 merges layouts into unified home representation
- ✅ Data persisted to `room_analyses` table

### Chunk 2
- ✅ All 6 endpoints implemented with strict JSON schemas
- ✅ Validation passes with AJV
- ✅ Tier totals computed correctly (€1,000 rounding)
- ✅ Timeline offsets calculated in finalizer only

### Chunk 3
- ✅ Anchor images generated for all rooms per tier
- ✅ Angle-matching renders for all additional photos
- ✅ Cross-room consistency applied using visibility mappings
- ✅ Images stored in `after_photos` table

### Chunk 4
- ✅ Integrated diagnostic generates house narrative
- ✅ Contextual analysis covers all 12 categories
- ✅ Citations properly linked and displayed
- ✅ Verify generator produces actionable checklist

---

## 🚀 Ready to Implement

All four chunks are fully specified with:
- ✅ Clear API endpoints
- ✅ Input/output schemas
- ✅ Prompt templates
- ✅ Data model definitions
- ✅ Edge cases documented
- ✅ Success criteria defined

**Let's build!** 🎉

