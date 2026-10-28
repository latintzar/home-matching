# Endpoint to Pipeline Map

> **Complete mapping of ALL 155 API endpoints to their pipeline phases.**  
> **Last Updated**: 2025-11-30  
> **Status**: Migration Needed for DynamoDB Support

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Endpoint Count](#complete-endpoint-count)
3. [Migration Status Summary](#migration-status-summary)
4. [Data Layer Architecture](#data-layer-architecture)
5. [Phase 1: Scraping & Ingest](#phase-1-scraping--ingest)
6. [Phase 2: Text Analysis (A-C Nodes)](#phase-2-text-analysis-a-c-nodes)
7. [Phase 2.5: Cadastre](#phase-25-cadastre)
8. [Phase 2.7: Intelligence Suite](#phase-27-intelligence-suite)
9. [Phase 3: Photo Analysis](#phase-3-photo-analysis)
10. [Phase 4: Analysis Search](#phase-4-analysis-search)
11. [Phase 5: Synthesis & Reporting](#phase-5-synthesis--reporting)
12. [Phase 6: Renovation Gateway](#phase-6-renovation-gateway)
13. [Phase 7: Renovation Engine](#phase-7-renovation-engine)
14. [Phase 8: Visual Execution (R-Pipeline)](#phase-8-visual-execution-r-pipeline)
15. [Phase 9: Lifestyle Intelligence](#phase-9-lifestyle-intelligence)
16. [Utility & Support Endpoints](#utility--support-endpoints)
17. [Recommender Endpoints](#recommender-endpoints)
18. [Non-Listing Endpoints](#non-listing-endpoints)
19. [Endpoints That Don't Use Supabase](#endpoints-that-dont-use-supabase)
20. [Migration Strategy](#migration-strategy)

---

## Overview

Leo has **155 total API endpoints**. Of these, **121 directly use Supabase**, which means they **cannot access listings stored in DynamoDB** from the Harvest Engine.

---

## Complete Endpoint Count

| Category | Count | Uses Supabase | Used By | Notes |
|----------|-------|---------------|---------|-------|
| **Listings (Analysis/Reno)** | 104 | 101 | ~25 by UI, ~60 by orchestrators, ~20 orphaned | Core pipeline |
| **Recommender** | 6 | 5 | ✅ UI | Intake/search |
| **Lifestyle** | 5 | 0 | ✅ Test pages | All migrated |
| **Deepdives** | 5 | 5 | ⚠️ **ORPHANED** | No UI uses these |
| **Ingest** | 2 | 2 | ✅ UI | URL ingestion |
| **AI Utilities** | 5 | 2 | ✅ UI | Chat, suggestions |
| **Places/Geocoding** | 3 | 0 | ✅ UI | External APIs |
| **Stripe** | 2 | 1 | ✅ Payments | |
| **Cron** | 1 | 1 | ✅ Internal | Scheduled jobs |
| **Agents** | 1 | 1 | ✅ UI | Agency management |
| **Test/Debug** | 5 | 0 | ✅ Dev | Development only |
| **Other Utilities** | 16 | 3 | Mixed | Various |
| **TOTAL** | **155** | **121** | | |

### Usage Breakdown

| Usage Type | Count | Description |
|------------|-------|-------------|
| ✅ **Called by UI** | ~25 | React components call these directly |
| 🔧 **Called by Orchestrators** | ~60 | Internal pipeline steps |
| ⚠️ **ORPHANED** | ~40 | Nothing calls these (can be deleted) |
| ✅ **External/Utility** | ~30 | Places, Stripe, Auth, etc. |

### The Problem

```
HARVEST ENGINE                    ANALYSIS/RENO PIPELINE
     ↓                                    ↓
  DynamoDB                            Supabase
  (500k listings)                   (104 endpoints)
     ↓                                    ↓
  ✅ Works                      ❌ Can't find listings
```

### The Solution

Either:
- **Option A**: Update all 104 endpoints to use `data-adapter.ts`
- **Option B**: Copy listing to Supabase when user requests Analysis (hybrid)

---

## Migration Status Summary

### By Pipeline Phase

| Category | Endpoints | Migrated | Pending |
|----------|-----------|----------|---------|
| **Core Listings** | 3 | ✅ 3 | 0 |
| **Phase 1: Ingest** | 2 | 0 | 2 |
| **Phase 2: Text Analysis** | 7 | 0 | 7 |
| **Phase 2.5: Cadastre** | 1 | 0 | 1 |
| **Phase 2.7: Intelligence** | 1 | 0 | 1 |
| **Phase 3: Photo Analysis** | 32 | 0 | 32 |
| **Phase 4: Analysis Search** | 2 | 0 | 2 |
| **Phase 5: Synthesis** | 3 | 0 | 3 |
| **Phase 6: Reno Gateway** | 1 | 0 | 1 |
| **Phase 7: Reno Engine** | 15 | 0 | 15 |
| **Phase 8: R-Pipeline** | 15 | 0 | 15 |
| **Phase 9: Lifestyle** | 5 | ✅ 5 | 0 |
| **Utility/Support** | 26 | ✅ 10 | 16 |
| **Recommender** | 6 | ✅ 1 | 5 |
| **Non-Listing (Deepdives, AI, etc.)** | 36 | ✅ 15 | 21 |
| **TOTAL** | **155** | **34** | **121** |

### By Migration Need

| Status | Count | Description |
|--------|-------|-------------|
| ✅ **No migration needed** | 34 | Use `data-adapter`, external APIs, or pure utilities |
| ❌ **Need migration** | 121 | Direct Supabase imports |
| 🎯 **Critical path** | ~15 | Ingest + Text Analysis + Clustering + WPA |

---

## Data Layer Architecture

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│                     API ENDPOINTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ MIGRATED (6 endpoints)     ❌ NOT MIGRATED (104 endpoints)│
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │ /api/listings       │       │ /api/listings/[id]/*    │  │
│  │ /api/listings/[id]  │       │ (text-analysis, photos, │  │
│  │ /api/listings/latest│       │  clusters, renovation,  │  │
│  │ /api/recommender/*  │       │  visuals, etc.)         │  │
│  └─────────┬───────────┘       └───────────┬─────────────┘  │
│            │                               │                 │
│            ▼                               ▼                 │
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │   data-adapter.ts   │       │  Direct Supabase Import │  │
│  │  (DynamoDB + fallback)      │  createClient(...)      │  │
│  └─────────┬───────────┘       └───────────┬─────────────┘  │
│            │                               │                 │
│            ▼                               ▼                 │
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │     DynamoDB        │       │       Supabase          │  │
│  │   (harvest data)    │       │   (old 150 listings)    │  │
│  └─────────────────────┘       └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────┐
│                     API ENDPOINTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ALL ENDPOINTS USE data-adapter.ts                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              data-adapter.ts                         │   │
│  │  ┌───────────────────┐  ┌───────────────────────┐   │   │
│  │  │ Listing Operations│  │ Analysis Operations   │   │   │
│  │  │ (DynamoDB primary)│  │ (Supabase - user data)│   │   │
│  │  └─────────┬─────────┘  └───────────┬───────────┘   │   │
│  └────────────┼────────────────────────┼───────────────┘   │
│               ▼                        ▼                    │
│  ┌─────────────────────┐       ┌─────────────────────────┐ │
│  │     DynamoDB        │       │       Supabase          │ │
│  │   - listings        │       │   - user_profiles       │ │
│  │   - scraping_rules  │       │   - text_analysis_*     │ │
│  │   - crawl_tracking  │       │   - clusters            │ │
│  │   - wpa_cache       │       │   - room_analyses       │ │
│  │   - geo_intelligence│       │   - renovation_*        │ │
│  └─────────────────────┘       └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Scraping & Ingest

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 1

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/manual` | Ingest | Manual listing creation | Supabase: `listings` | ❌ Pending |
| `POST /api/listings/[id]/extraction` | Ingest | Extract data from scraped HTML | Supabase: `listings`, `idealista_info_extraction` | ❌ Pending |
| `POST /api/listings/[id]/checkpoints` | Ingest | Pipeline checkpoint management | Supabase: `listings.pipeline_checkpoints` | ❌ Pending |

**Tables Used**:
- `listings` (core listing data)
- `idealista_info_extraction` (NL mining results)

---

## Phase 2: Text Analysis (A-C Nodes)

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 2: Text Analysis Pipeline

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/text-analysis/a-facts` | A Node | Extract basic facts | Supabase: `listings`, `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/text-analysis/b2-merge` | B2 Node | Merge categorizations | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/text-analysis/b3-snippets` | B3 Node | Generate snippets | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/text-analysis/c-unknowns` | C Node | Identify unknowns | Supabase: `text_analysis_results` | ❌ Pending |
| `GET /api/listings/[id]/text-analysis/results` | Results | Aggregate all results | Supabase: `listings`, `text_analysis_results`, `clusters` | ❌ Pending |
| `POST /api/listings/[id]/generate-questions` | Support | Generate viewing questions | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/answer-question` | Support | Answer user questions | Supabase: `listings`, `text_analysis_results` | ❌ Pending |

**Tables Used**:
- `listings` (source data)
- `text_analysis_results` (phase results)

---

## Phase 2.5: Cadastre

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 2.5: Official Verification

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/analysis/cadastre` | Cadastre Node | Verify with government data | Supabase: `listings`, `text_analysis_results` | ❌ Pending |

**External APIs**: Spanish Cadastre API

---

## Phase 2.7: Intelligence Suite

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 2.7: Location Intelligence

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/intelligence/social-radar` | Intelligence Suite | Social/location analysis | Supabase: `listings.social_intelligence` | ❌ Pending |

**External APIs**: Google Places, Street View

---

## Phase 3: Photo Analysis

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 3: Photo Analysis Pipeline

### D Node: Zero-Shot Clustering

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/clusters/zero-shot` | D Node | Quick clustering | Supabase: `listing_photos`, `clusters` | ❌ Pending |
| `POST /api/listings/[id]/clusters/zero-shot/full` | D Node (Full) | Complete clustering with validation | Supabase: `listing_photos`, `clusters` | ❌ Pending |
| `GET /api/listings/[id]/clusters` | D Node | Get clusters | Supabase: `clusters` | ❌ Pending |
| `DELETE /api/listings/[id]/clusters/clear` | D Node | Clear clusters | Supabase: `clusters` | ❌ Pending |
| `POST /api/listings/[id]/clusters/promote-auto-to-manual` | D Node | Promote auto clusters | Supabase: `clusters` | ❌ Pending |

### Cluster Auto-Test Pipeline (⚠️ ORPHANED - Dev/QA Only)

**Status**: These 14 endpoints are **NOT called by any UI or orchestrator**. They were development/QA tooling for testing clustering algorithms. Production uses `clusters/zero-shot/full` directly.

| Endpoint | Purpose | Data Access | Used By |
|----------|---------|-------------|---------|
| `POST /api/listings/[id]/clusters/auto-test/stage-0` | Initialize | Supabase: `listing_photos` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-1` | First pass | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-1-5` | Refinement | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-2` | Second pass | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-3` | Third pass | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-4` | Fourth pass | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-4-gemini3` | Gemini 3 variant | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/stage-5` | Final pass | Supabase: `clusters_auto_test` | ❌ Nothing |
| `GET /api/listings/[id]/clusters/auto-test/latest-results` | Get latest | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/auto-test/save` | Save results | Supabase: `clusters_auto_test` | ❌ Nothing |
| `GET /api/listings/[id]/clusters/auto-test/view` | View results | Supabase: `clusters_auto_test` | ❌ Nothing |
| `GET /api/listings/[id]/clusters/auto-test/compare` | Compare results | Supabase: `clusters_auto_test` | ❌ Nothing |
| `POST /api/listings/[id]/clusters/seed-test-data` | Seed test data | Supabase: `clusters` | ❌ Nothing |
| `POST /api/listings/[id]/cluster-auto` | Run auto clustering | Supabase: `clusters` | ❌ Nothing |

**Recommendation**: Delete these 14 endpoints to reduce codebase complexity.

### F3 Node: Whole Property Analysis

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/analysis/whole-property` | F3 Node | WPA generation | Supabase: `listings`, `whole_property_analysis` | ❌ Pending |
| `POST /api/listings/[id]/photo-analysis/whole-property` | F3 Node | Alternative WPA endpoint | Supabase: `whole_property_analysis` | ❌ Pending |

### RoomByRoom Node

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/photo-analysis/room-by-room` | RoomByRoom | Room-level analysis | Supabase: `clusters`, `room_analyses` | ❌ Pending |

### Photo Management

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `GET /api/listings/[id]/photos` | Support | Get photos | Supabase: `listing_photos` | ❌ Pending |
| `POST /api/listings/[id]/photos/upload-base64` | Support | Upload photo | Supabase: `listing_photos`, Storage | ❌ Pending |
| `POST /api/listings/[id]/photos/store` | Support | Store photo URLs | Supabase: `listing_photos` | ❌ Pending |

**Tables Used**:
- `listing_photos` (photo URLs)
- `clusters` (cluster assignments)
- `clusters_auto_test` (development testing)
- `whole_property_analysis` (WPA results)
- `room_analyses` (room-level results)

---

## Phase 4: Analysis Search

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 4: Analysis Search (Double-Barrel)

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/analysis-google-search` | G Node | Double-barrel search | Supabase: `analysis_search_results`, `analysis_curated_results` | ❌ Pending |
| `POST /api/listings/[id]/generate-all-research-queries` | G Node Support | Generate search queries | Supabase: `text_analysis_results` | ❌ Pending |

**Tables Used**:
- `analysis_search_results` (raw search results)
- `analysis_curated_results` (curated/processed results)

---

## Phase 5: Synthesis & Reporting

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 5: Synthesis & Reporting

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/analysis/final-scope` | Buyer Report Node | Generate 3-chapter report | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/orchestrate-basic-package` | Orchestrator | Run full Basic Package | Supabase: multiple tables | ❌ Pending |
| `POST /api/listings/[id]/analysis/run-all` | Orchestrator | Run all analysis | Supabase: multiple tables | ❌ Pending |

---

## Phase 6: Renovation Gateway

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 6: Renovation Interface

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/renovation/baseline-check` | Baseline Check | Verify Basic Package complete | Supabase: `text_analysis_results` | ❌ Pending |

---

## Phase 7: Renovation Engine

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 7: Unified Renovation Engine

### Node 1: The Architect (Unified Strategy)

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/renovation/unified-strategy` | Architect | Generate reno strategy | Supabase: `text_analysis_results` | ❌ Pending |

### Node 2: The Researcher (J-Reno Double-Barrel)

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/renovation/search` | Researcher | Research pricing/materials | Supabase: `renovation_research_results` | ❌ Pending |
| `POST /api/listings/[id]/renovation/search-terms` | Researcher | Generate search terms | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/renovation/process-credibility` | Researcher | Validate sources | Supabase: `renovation_research_results` | ❌ Pending |

### Node 3: The Contractor (Unified Scope)

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/renovation/unified-scope` | Contractor | Generate work scope | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation/finalize-prices` | Contractor | Finalize pricing | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation/check-budget` | Contractor | Budget validation | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation/expand-whitelist` | Contractor | Expand work items | Supabase: `final_renovation_scope` | ❌ Pending |

### Supporting Renovation Endpoints

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/renovation/generate-tiers` | Tiers | Generate 3 tiers | Supabase: `renovation_tiers` | ❌ Pending |
| `POST /api/listings/[id]/renovation/smart-m2` | Support | Calculate m² | Supabase: `listings` | ❌ Pending |
| `POST /api/listings/[id]/renovation/generate-style-prompts` | Support | Style prompts | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/orchestrate-renovation` | Orchestrator | Run full Reno Package | Supabase: multiple tables | ❌ Pending |

**Tables Used**:
- `renovation_research_results` (search results)
- `final_renovation_scope` (work items)
- `renovation_tiers` (tier definitions)

---

## Phase 8: Visual Execution (R-Pipeline)

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 8: Visual Execution

### R1/R2/R3 Nodes

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/listings/[id]/visuals/r1-select` | R1 Node | Select photos for editing | Supabase: `listing_photos`, `clusters` | ❌ Pending |
| `POST /api/listings/[id]/visuals/r1-5-omsria` | R1.5 Node | OMSRIA processing | Supabase: `omsria_processed_images` | ❌ Pending |
| `POST /api/listings/[id]/visuals/r2-prompt` | R2 Node | Generate edit prompts | Supabase: `text_analysis_results` | ❌ Pending |
| `POST /api/listings/[id]/visuals/r3-render` | R3 Node | Render final images | Supabase: `after_photos` | ❌ Pending |

### After Photo Management

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `GET /api/listings/[id]/photos/after` | After | Get after photos | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/photos/after/generate` | After | Generate after photos | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/photos/after/generate-simple` | After | Simple generation | Supabase: `after_photos` | ❌ Pending |
| `DELETE /api/listings/[id]/after/clear` | After | Clear after photos | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/after/consistency-pass` | After | Consistency check | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/after/consistency-pass-furniture` | After | Furniture consistency | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/after/evolution` | After | Evolution tracking | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/after/describe-room-images` | After | Describe images | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/after/add-furniture` | After | Add furniture | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/after/generate-furniture-staging-plan` | After | Staging plan | Supabase: `after_photos` | ❌ Pending |
| `POST /api/listings/[id]/photos/remove-furniture` | After | Remove furniture | Supabase: `listing_photos` | ❌ Pending |

**Tables Used**:
- `after_photos` (generated images)
- `omsria_processed_images` (intermediate processing)

---

## Phase 9: Lifestyle Intelligence

**Pipeline Reference**: `ULTIMATE_PIPELINE.md` - Phase 9: Lifestyle Intelligence

| Endpoint | Pipeline Node | Purpose | Data Access | Migration Status |
|----------|---------------|---------|-------------|------------------|
| `POST /api/lifestyle/generate-polygon` | Orchestrator | Generate sweet spot polygon | Supabase: `user_lifestyle_profiles` | ❌ Pending |
| `POST /api/lifestyle/test-single` | Test | Test single location | External APIs | ❌ Pending |

**Note**: Lifestyle endpoints are under `/api/lifestyle/`, not `/api/listings/`.

---

## Utility & Support Endpoints

### Room Layout Management (⚠️ ORPHANED)

**Status**: These 10 endpoints are **NOT called by any UI or orchestrator**. They were for a planned room layout editor feature.

| Endpoint | Purpose | Data Access | Used By |
|----------|---------|-------------|---------|
| `POST /api/listings/[id]/rooms/group-catalog` | Group rooms by type | Supabase: `clusters` | ❌ Nothing |
| `GET /api/listings/[id]/rooms/[roomId]/detailed-state` | Get room state | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/layout/placement` | Layout placement | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/layout/placement/run-all` | Batch placement | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/layout/redbox` | Redbox layout | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/[roomId]/layout/redbox` | Room redbox | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/[roomId]/layout/fusion` | Layout fusion | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/[roomId]/layout/placement` | Room placement | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/[roomId]/layout/persist` | Persist layout | Supabase: `room_analyses` | ❌ Nothing |
| `POST /api/listings/[id]/rooms/[roomId]/layout/verify` | Verify layout | Supabase: `room_analyses` | ❌ Nothing |

**Recommendation**: Delete these 10 endpoints.

### Tier Management (⚠️ ORPHANED)

**Status**: These 5 endpoints are **NOT called by any UI or orchestrator**. They were for a legacy tier customization UI.

| Endpoint | Purpose | Data Access | Used By |
|----------|---------|-------------|---------|
| `POST /api/listings/[id]/tiers/budget-calibration` | Calibrate budget | Supabase: `renovation_tiers` | ❌ Nothing |
| `POST /api/listings/[id]/tiers/style-direction` | Set style | Supabase: `renovation_tiers` | ❌ Nothing |
| `POST /api/listings/[id]/tiers/element-synthesis` | Synthesize elements | Supabase: `renovation_tiers` | ❌ Nothing |
| `POST /api/listings/[id]/tiers/budgeting` | Budget calculation | Supabase: `renovation_tiers` | ❌ Nothing |
| `POST /api/listings/[id]/tiers/ideation` | Generate ideas | Supabase: `renovation_tiers` | ❌ Nothing |

**Recommendation**: Delete these 5 endpoints.

### Deep Dive & Recommendations

| Endpoint | Purpose | Data Access | Used By |
|----------|---------|-------------|---------|
| `POST /api/listings/[id]/deepdive/generate-stream` | Stream deep dive | Supabase: `deepdives` | ⚠️ Called by `/api/deepdives/[id]/generate-deepdive` (which is orphaned) |
| `POST /api/listings/[id]/recommendations/next-steps` | Generate next steps | Supabase: `text_analysis_results` | ⚠️ Unknown |
| `POST /api/listings/[id]/recommendations/verify` | Verify recommendations | Supabase: `text_analysis_results` | ✅ ViewingChecklist component |

### Miscellaneous

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `POST /api/listings/[id]/analysis/listing-diagnostic` | Diagnostic | Supabase: `listings` | ❌ Pending |
| `POST /api/listings/[id]/analysis/contextual` | Contextual analysis | Supabase: `listings` | ❌ Pending |
| `POST /api/listings/[id]/analysis/by-cluster` | Analysis by cluster | Supabase: `clusters` | ❌ Pending |
| `POST /api/listings/[id]/analysis/citations-sweep` | Citations | Supabase: `analysis_curated_results` | ❌ Pending |
| `POST /api/listings/[id]/renovation-scope` | Reno scope | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation-scope/seed-from-tiers` | Seed scope | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation-scope-finalize` | Finalize scope | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation-timeline` | Timeline | Supabase: `renovation_timelines` | ❌ Pending |
| `POST /api/listings/[id]/renovation-permits` | Permits | Supabase: `renovation_permits` | ❌ Pending |
| `POST /api/listings/[id]/renovation-pricing` | Pricing | Supabase: `final_renovation_scope` | ❌ Pending |
| `POST /api/listings/[id]/renovation-research-aggregate` | Aggregate research | Supabase: `renovation_research_results` | ❌ Pending |
| `POST /api/listings/[id]/image-gen/redbox` | Image generation | External API | ❌ Pending |
| `POST /api/listings/[id]/whatsapp-message` | WhatsApp | External API | ❌ Pending |
| `POST /api/listings/[id]/cleanup-curation-data` | Cleanup | Supabase: `analysis_curated_results` | ❌ Pending |
| `GET /api/listings/[id]/debug-research-snippets` | Debug | Supabase: `analysis_search_results` | ❌ Pending |

---

## Recommender Endpoints

**Location**: `/api/recommender/`

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `GET/POST /api/recommender/profile` | Life profile CRUD | Supabase: `user_lifestyle_profiles` | ✅ Migrated |
| `POST /api/recommender/search` | Search recommendations | data-adapter + Supabase | ✅ Migrated |
| `POST /api/recommender/elevenlabs-chat` | ElevenLabs chat | Supabase: `user_lifestyle_profiles` | ✅ Migrated |
| `POST /api/recommender/extract-voice-profile` | Extract from voice | Supabase: `user_lifestyle_profiles` | ❌ Pending |
| `POST /api/recommender/intake-chat` | Chat intake | Supabase: `user_lifestyle_profiles` | ❌ Pending |

---

## Migration Strategy

### Option A: Full Migration (Recommended)

Update all 104 endpoints to use `data-adapter.ts`:

```typescript
// BEFORE (direct Supabase)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(URL, KEY);
const { data } = await supabase.from('listings').select('*').eq('id', id);

// AFTER (data adapter)
import { getListingById } from '@/lib/data-adapter';
const listing = await getListingById(id);
```

**Pros**:
- Clean architecture
- Single source of truth
- DynamoDB for bulk data, Supabase for user data

**Cons**:
- 104 files to update
- Testing required for each

### Option B: Hybrid Copy-on-Demand

When user requests Analysis on a DynamoDB listing:
1. Copy listing to Supabase
2. Run existing pipeline unchanged
3. Results stay in Supabase

```typescript
async function ensureListingInSupabase(listingId: string) {
  // Check if exists in Supabase
  const { data } = await supabase.from('listings').select('id').eq('id', listingId).single();
  if (data) return; // Already exists
  
  // Fetch from DynamoDB
  const dynamoListing = await getListingFromDynamoDB(listingId);
  
  // Copy to Supabase
  await supabase.from('listings').insert(transformForSupabase(dynamoListing));
}
```

**Pros**:
- Minimal code changes
- Pipeline continues working
- Progressive migration

**Cons**:
- Data duplication
- Sync complexity
- Supabase storage grows

### Recommended Approach: Option B First, Option A Later

1. **Immediate**: Implement copy-on-demand for Analysis requests
2. **Short-term**: Migrate high-traffic endpoints to data-adapter
3. **Long-term**: Migrate remaining endpoints incrementally

---

## Supabase Tables Reference

### Analysis Pipeline Tables (Stay in Supabase - User Data)

| Table | Purpose | Size |
|-------|---------|------|
| `text_analysis_results` | A-C phase results | Per analysis |
| `whole_property_analysis` | WPA cache | Per listing |
| `room_analyses` | Room-by-room results | Per room |
| `analysis_search_results` | Search results | Per search |
| `analysis_curated_results` | Curated results | Per listing |
| `clusters` | Photo clusters | Per listing |
| `clusters_auto_test` | Development testing | Per test |

### Renovation Pipeline Tables (Stay in Supabase - User Data)

| Table | Purpose | Size |
|-------|---------|------|
| `renovation_research_results` | Research results | Per listing |
| `final_renovation_scope` | Work items | Per listing |
| `renovation_tiers` | Tier definitions | Per listing |
| `after_photos` | Generated images | Per listing |
| `omsria_processed_images` | Intermediate images | Per listing |
| `renovation_timelines` | Timelines | Per listing |
| `renovation_permits` | Permit info | Per listing |

### Bulk Data Tables (Move to DynamoDB)

| Table | Purpose | Size |
|-------|---------|------|
| `listings` | Core listing data | 500k+ rows |
| `listing_photos` | Photo URLs | 30M+ rows |

---

## Non-Listing Endpoints

### Ingest Endpoints (Used by UI ✅)

| Endpoint | Purpose | Data Access | Used By |
|----------|---------|-------------|---------|
| `POST /api/ingest/browser` | Browser extension push | Supabase: `listings` | Extension |
| `POST /api/ingest/server` | Server-side fetch | Supabase: `listings` | Add Property page |

### Deepdives Endpoints (⚠️ ORPHANED - No UI Uses These)

**Status**: These endpoints exist but NO UI page calls them. They were likely planned for a paywall feature that was never completed.

| Endpoint | Purpose | Data Access | Used By |
|----------|---------|-------------|---------|
| `GET /api/deepdives` | List deepdives | Supabase: `deepdives` | ❌ Nothing |
| `POST /api/deepdives/[id]/generate-deepdive` | Generate deepdive | Supabase: `deepdives` | ❌ Nothing |
| `POST /api/deepdives/[id]/publish` | Publish deepdive | Supabase: `deepdives` | ❌ Nothing |
| `GET /api/deepdives/[id]/paywall` | Paywall check | Supabase: `deepdives` | ❌ Nothing |
| `GET /api/deepdives/[id]/photos` | Deepdive photos | Supabase: `listing_photos` | ❌ Nothing |

**Recommendation**: Consider removing these endpoints or implementing the UI that uses them.

### AI Endpoints

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `POST /api/ai/chat` | Property chat | Supabase: `listings` | ❌ Pending |
| `POST /api/ai/suggest` | Suggestions | Supabase: `listings` | ❌ Pending |
| `POST /api/ai/clean-address` | Address cleaning | None (pure AI) | ✅ N/A |
| `POST /api/ai/parse-amenities` | Amenity parsing | None (pure AI) | ✅ N/A |
| `POST /api/ai/determine-cta` | CTA determination | None (pure AI) | ✅ N/A |

### Agents Endpoints

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `POST /api/agents/[id]/upscale-logo` | Upscale agent logo | Supabase: `agents` | ❌ Pending |

### Cron Endpoints

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `POST /api/cron/harvest` | Trigger harvest | Supabase: various | ❌ Pending |

### Stripe Endpoints

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `POST /api/stripe/webhook` | Stripe webhooks | Supabase: `deepdives` | ❌ Pending |
| `POST /api/stripe/create-checkout-session` | Checkout | None (Stripe API) | ✅ N/A |

### Early Access

| Endpoint | Purpose | Data Access | Migration Status |
|----------|---------|-------------|------------------|
| `POST /api/early-access` | Email collection | Supabase: `early_access_emails` | ❌ Pending |

---

## Endpoints That Don't Use Supabase (34 total)

These endpoints either use `data-adapter.ts`, external APIs only, or are pure utilities.

### ✅ Migrated to data-adapter (3)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/listings` | List listings |
| `GET /api/listings/[id]` | Get single listing |
| `GET /api/listings/latest` | Get latest listing |

### ✅ Lifestyle Endpoints (5) - Don't need listing data

| Endpoint | Purpose |
|----------|---------|
| `POST /api/lifestyle/fit-score` | Calculate fit score |
| `POST /api/lifestyle/generate-polygon` | Generate sweet spot |
| `POST /api/lifestyle/test-single` | Test single location |
| `POST /api/lifestyle/extract-profile` | Extract profile from text |
| `GET /api/lifestyle/test-results` | View test results |

### ✅ Places/Geocoding (3) - External APIs only

| Endpoint | Purpose |
|----------|---------|
| `GET /api/places/autocomplete` | Google Places autocomplete |
| `GET /api/places/reverse-geocode` | Reverse geocoding |
| `GET /api/geocode` | Nominatim geocoding |

### ✅ Recommender - Migrated (1)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/recommender/elevenlabs-chat` | ElevenLabs chat |

### ✅ Test/Debug (5) - Development only

| Endpoint | Purpose |
|----------|---------|
| `POST /api/test/intelligence` | Test intelligence |
| `POST /api/test/universal-extraction` | Test extraction |
| `GET /api/debug/html` | Debug HTML |
| `GET /api/debug-rag` | Debug RAG |
| `GET /api/tools/sitemap-stats` | Sitemap statistics |

### ✅ Pure AI Utilities (3) - No data access

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai/clean-address` | Clean address string |
| `POST /api/ai/parse-amenities` | Parse amenities |
| `POST /api/ai/determine-cta` | Determine CTA |

### ✅ Other Utilities (10)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/photo-proxy` | CORS proxy for images |
| `POST /api/cluster/normalize-name` | Normalize cluster names |
| `POST /api/landing/generate-images` | Landing page images |
| `POST /api/landing/generate-reno-after` | Reno after images |
| `POST /api/research/domain-credibility` | Domain credibility check |
| `POST /api/stripe/create-checkout-session` | Stripe checkout |
| `GET /api/listings/[id]/checkpoints/[step]` | Single checkpoint |
| `POST /api/listings/[id]/curate-all-research-sequential` | Research curation |
| `POST /api/listings/[id]/curate-all-research-parallel` | Research curation (parallel) |
| `POST /api/listings/[id]/generate-all-research-queries-parallel` | Research queries |
| `POST /api/listings/[id]/renovation/orchestrate-full-pipeline` | Reno orchestrator |
| `POST /api/listings/[id]/renovation-postprocess` | Reno postprocess |

---

---

## Endpoint Usage Analysis

### ✅ Endpoints ACTUALLY Called by UI (25 endpoints)

These are called directly from React components/pages:

| Endpoint | Called By | Calls |
|----------|-----------|-------|
| `/api/recommender/profile` | Intake page | 5 |
| `/api/recommender/extract-voice-profile` | Intake page | 3 |
| `/api/recommender/search` | Recommend page | 1 |
| `/api/recommender/elevenlabs-chat` | Intake page | 1 |
| `/api/listings/${id}/orchestrate-basic-package` | Property page, Analyze page | 2 |
| `/api/listings/${id}/text-analysis/results` | Property page | 1 |
| `/api/listings/${id}/photos` | Property page, BuyerReportModal, ListingEditor | 3 |
| `/api/listings/${id}/photos/after` | Property page | 1 |
| `/api/listings/${id}/clusters` | BuyerReportModal | 1 |
| `/api/listings/${id}/analysis/citations-sweep` | BuyerReportModal | 1 |
| `/api/listings/${id}/renovation/check-budget` | PersonaliseRenovationModal | 1 |
| `/api/listings/${id}/orchestrate-renovation` | PersonaliseRenovationModal | 1 |
| `/api/listings/${id}/renovation-permits` | RenovationSlider | 1 |
| `/api/listings/${id}/recommendations/verify` | ViewingChecklist | 1 |
| `/api/listings/${id}/whatsapp-message` | PropertyDetails | 1 |
| `/api/listings/manual` | ListingEditor | 1 |
| `/api/listings/${id}` | ListingEditor | 1 |
| `/api/lifestyle/generate-polygon` | Test pages | 1 |
| `/api/lifestyle/extract-profile` | Test pages | 1 |
| `/api/lifestyle/test-results` | Test pages | 1 |
| `/api/ingest/server` | Add Property | 1 |
| `/api/ai/suggest` | AISidebar | 1 |
| `/api/ai/parse-amenities` | ListingEditor | 1 |
| `/api/ai/clean-address` | ListingEditor | 1 |
| `/api/places/autocomplete` | ListingEditor | 1 |
| `/api/places/reverse-geocode` | ListingEditor | 1 |

### 🔧 Endpoints Called by Orchestrators (~60 endpoints)

These are called internally by `orchestrate-basic-package` and `orchestrate-renovation`, not by UI:

| Category | Endpoints | Called By |
|----------|-----------|-----------|
| Text Analysis (A-C) | `a-facts`, `b2-merge`, `b3-snippets`, `c-unknowns` | `orchestrate-basic-package` |
| Photo Clustering | `clusters/zero-shot/full` | `orchestrate-basic-package` |
| Analysis | `analysis/whole-property`, `photo-analysis/room-by-room` | `orchestrate-basic-package` |
| Search | `analysis-google-search` | `orchestrate-basic-package` |
| Synthesis | `analysis/final-scope` | `orchestrate-basic-package` |
| Renovation Strategy | `renovation/unified-strategy` | `orchestrate-renovation` |
| Renovation Search | `renovation/search` | `orchestrate-renovation` |
| Renovation Scope | `renovation/unified-scope` | `orchestrate-renovation` |
| Visuals | `visuals/r1-select`, `r2-prompt`, `r3-render` | `orchestrate-renovation` |

**Note**: These are in ULTIMATE_PIPELINE.md and work correctly - they're called by orchestrators, not UI.

### ⚠️ ORPHANED Endpoints - No Callers (~40 endpoints)

These endpoints exist but **nothing calls them** (not UI, not orchestrators):

| Category | Count | Endpoints | Notes |
|----------|-------|-----------|-------|
| **Deepdives** | 5 | All `/api/deepdives/*` | Planned paywall feature, never implemented UI |
| **Cluster Auto-Test** | 14 | All `/api/listings/[id]/clusters/auto-test/*` | Dev/QA tooling, no production use |
| **Tiers Management** | 5 | All `/api/listings/[id]/tiers/*` | Legacy UI helpers, not used |
| **Room Layout** | 10 | All `/api/listings/[id]/rooms/*` | Legacy UI helpers, not used |
| **After Photo Utils** | 6 | `after/add-furniture`, `after/evolution`, etc. | Superseded by orchestrator |
| **Other** | ~5 | `listing-diagnostic`, `contextual`, `by-cluster` | Legacy/unused |

**Recommendation**: These could be deleted to reduce codebase complexity.

---

## Migration Priority Matrix

Based on user flow, here's the priority for migration:

### P0: Critical Path (Migrate First)

| Endpoint | Why |
|----------|-----|
| `/api/ingest/*` | Entry point for new listings |
| `/api/listings/[id]/text-analysis/*` | First analysis step |
| `/api/listings/[id]/clusters/*` | Photo clustering |
| `/api/listings/[id]/analysis/whole-property` | WPA |

### P1: High Priority (For Basic Package)

| Endpoint | Why |
|----------|-----|
| `/api/listings/[id]/photo-analysis/*` | Room analysis |
| `/api/listings/[id]/analysis-google-search` | Research |
| `/api/listings/[id]/analysis/final-scope` | Report |
| `/api/listings/[id]/orchestrate-basic-package` | Full flow |

### P2: Medium Priority (For Renovation)

| Endpoint | Why |
|----------|-----|
| `/api/listings/[id]/renovation/*` | All renovation |
| `/api/listings/[id]/visuals/*` | Before/after |
| `/api/listings/[id]/after/*` | After photos |

### P3: Low Priority (Supporting)

| Endpoint | Why |
|----------|-----|
| `/api/listings/[id]/tiers/*` | Tier management |
| `/api/listings/[id]/rooms/*` | Room layout |
| `/api/listings/[id]/recommendations/*` | Recommendations |
| `/api/deepdives/*` | Publishing |

---

## Change Log

| Date | Change |
|------|--------|
| 2025-11-30 | Initial documentation of all 104 endpoints |
| 2025-11-30 | Mapped to ULTIMATE_PIPELINE.md phases |
| 2025-11-30 | Added migration strategy options |
| 2025-11-30 | **Expanded to ALL 155 endpoints** |
| 2025-11-30 | Added non-listing endpoints (ingest, deepdives, AI, etc.) |
| 2025-11-30 | Added 34 endpoints that don't use Supabase |
| 2025-11-30 | Added migration priority matrix |

---

*This document is the source of truth for endpoint-to-pipeline mapping and migration status.*

