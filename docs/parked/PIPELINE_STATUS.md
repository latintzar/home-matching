# Pipeline Status Dashboard

**Last Updated:** 2025-11-23  
**Purpose:** Track the health and functionality of all pipeline components, orchestrators, and UI elements

## 🎉 Recent Successes
- **Smart Address Logic Restored** (2025-11-23): Fixed regression where robust coordinate extraction was bypassing text-based address cleaning. Now runs Autocomplete *with* coordinate bias to ensure perfectly formatted addresses.
- **Client-Side Scraping Optimization** (2025-11-23): Implemented "Instant Redirect" strategy. Extension sends lightweight metadata for <1s redirect, then uploads high-res photos in background via Service Worker. Added Universal Heuristic parser for non-Idealista sites.
- **Physical Features Extraction Fixed** (2025-01-27): Completely redesigned robust scraper's physical features extraction. Now grabs all features from `.details-property_features` divs, filters out basics (area, bedrooms, bathrooms) and non-essentials (energy ratings, construction dates), keeping only meaningful physical features. Successfully extracted 6 physical features from test property: "Chalet pareado", "Terraza", "Plaza de garaje incluida en el precio", "Orientación sur", "No dispone de calefacción", "Jardín".
- **B1 Parallel Processing Implemented** (2025-01-27): Updated B1 categorization to process 1 claim per call in parallel, eliminating duplication and improving accuracy. All 7 claims processed simultaneously with perfect results.
- **Complete URL-to-C Pipeline Tested** (2025-01-27): Successfully tested full pipeline with new property URL `https://www.idealista.com/inmueble/106982362/`. Extracted 60 photos, completed A-C analysis, generated headlines, snippets, and unknowns.
- **URL-to-C Orchestrator Fixed** (2024-01-27): Resolved filename sanitization issue in photo storage. Supabase Storage now accepts sanitized filenames without special characters. Complete pipeline working end-to-end.
- **Database Architecture Cleaned** (2024-01-27): Renamed `analysis_results` to `photo_analysis_results`, standardized phase names (`a_context`), updated all endpoints to use correct table names. Clean 3-table architecture implemented.
- **Photo Extraction Fixed** (2024-01-27): Resolved JavaScript-to-JSON conversion issue in robust scraper. Now successfully extracts and stores photos from Idealista URLs in Supabase Storage.
- **Full HTML Storage Added** (2024-01-27): Enhanced robust scraper to store complete HTML content in `scraped_data.full_html` field, providing complete control and debugging capabilities for re-processing without re-scraping.

## Orchestrators

| Orchestrator | Status | Purpose | Definition |
|--------------|--------|---------|------------|
| `/api/orchestrate-renovation` | ✅ | Renovation Engine orchestrator | **Unified Renovation Engine** that coordinates Smart M2, Baseline Check, Strategy, Research (RAG), and Scope generation. **Updated 2025-11-20**: Full flow implemented and verified. |

## Core Endpoints - Detailed Status

| Endpoint | Status | Input Source | Input Status | Output Destination | Output Status | External API | API Status | Definition |
|----------|--------|--------------|--------------|-------------------|---------------|---------------|-------------|------------|
| `/api/scrape/robust` | ✅ | Idealista URL | ✅ | `listings` + `listing_photos` tables + Supabase Storage | ✅ | Scrapfly API | ✅ | **Main scraper** with retry logic. **Updated 2025-01-27**: Creates listing record immediately, then calls Scrapfly, then updates with scraped data. Extracts property data and photos from Idealista URLs, stores photos in Supabase Storage, saves full HTML in `scraped_data.full_html` |
| `/api/listings/[id]/photos/store` | ✅ | `listing_photos` URLs | ✅ | Supabase Storage | ✅ | Supabase Storage | ✅ | **Photo storage endpoint** that downloads photos from URLs and uploads to Supabase Storage bucket |
| `/api/listings/[id]/extraction` | ✅ | Listing data | ✅ | `text_analysis_results` | ✅ | Gemini API | ✅ | **Text Analysis Pipeline** - A-C passes that extract structured data from listing text. **B1 Updated 2025-01-27**: Now processes 1 claim per call in parallel for maximum accuracy. |
| `/api/listings/[id]/renovation/search` | ✅ | Unified Strategy | ✅ | `renovation_research_results` | ✅ | Vertex AI RAG | ✅ | **Node 2: The Researcher**. Queries Pricing, Legal, and Catalog stores to ground renovation plans in real data. |
| `/api/listings/[id]/renovation/baseline-check` | ✅ | Smart M2 | ✅ | `text_analysis_results` | ✅ | Vertex AI RAG | ✅ | **Baseline Check**. Calculates preliminary cost ranges based on inferred room sizes and market pricing. |
| `/api/listings/[id]/analysis/whole-property` | ✅ | Photos + facts | ✅ | `photo_analysis_results` | ✅ | Gemini API | ✅ | **Stage 1 Analysis** - Analyzes all photos together, returns general impression, summary ratings (envelope, moisture, etc.), top checks, and notes. Spanish output with English tags. |
| `/api/listings/[id]/analysis/by-cluster` | ✅ | Clustered photos | ✅ | `photo_analysis_results` | ✅ | Gemini API | ✅ | **Stage 2 Analysis** - Analyzes each photo cluster as a room. Returns room name, condition, observations (mode/element/visual_cue), risks, verify checks, and likely_work assessment. |
| `/api/listings/[id]/analysis/integrated` | ✅ | Stage 1+2 outputs | ✅ | `text_analysis_results` | ✅ | Gemini API | ✅ | **Integrated Diagnostic Analysis** - Merges text analysis (a-facts, b3-snippets, c-unknowns) + photo analysis into 9-section diagnostic report using Gemini 2.5 Pro. |

## UI Components - Data Flow Status

| Component | Status | Data Source | Data Status | Display Status | Definition |
|-----------|--------|--------------|-------------|-----------------|------------|
| **Property Details Composer** | ❓ | `listings` table | ❓ | ❓ | **Main property display component** that shows property info, photos, and analysis results |
| **AnalysisModal** | ❌ | `photo_analysis_results` | ❌ | ❌ | **Photo Analysis popup** that displays the Integrated Analysis (Stage 3) results |
| **Photo Clustering UI** | ❓ | `listing_photos` | ❓ | ❓ | **NotebookWizard clustering interface** for manually organizing photos into rooms |
| **Property Page** | ❓ | `deepdives` table | ❓ | ❓ | **Agency-ready Property Page** at `/property/[id]` that displays renovation tiers and intelligent consideraciones |
| **Admin Dashboard** | ❓ | Multiple tables | ❓ | ❓ | **Pipeline monitoring interface** for tracking scraping, analysis, and deep dive generation |
| **Renovation Tiers** | ❓ | `deepdives` data | ❓ | ❓ | **Tier modals** (Estándar, Óptimo, Plus) that show renovation scope and timelines |

## Pipeline Stages - Definitions

| Stage | Definition | Input | Output | Status |
|-------|------------|-------|--------|--------|
| **Scraping** | Extract property data and photos from Idealista URLs, store in Supabase Storage | Idealista URL | `listings` + `listing_photos` tables + Supabase Storage | ✅ |
| **A Context Preparation** | Prepare context from structured data, exclude basic facts | `listings` table | `text_analysis_results` (a_context) | ✅ |
| **A-C Analysis** | AI analysis of rich text content only | A context | `text_analysis_results` (a-c) | ✅ |
| **Photo Analysis Stage 1** | Whole-property photo analysis | All photos + facts | `photo_analysis_results` (whole-property) | ✅ **Analyzes all 29 photos together, returns general impression + summary ratings in Spanish** |
| **Photo Analysis Stage 2** | Room-by-room photo analysis | Clustered photos | `photo_analysis_results` (by-cluster) | ✅ **Analyzes each cluster as a room, returns detailed observations with mode tags (Observed/Inferred/Unknown)** |
| **Photo Analysis Stage 3** | Integrated Analysis generation | Stage 1+2 outputs + text analysis | `text_analysis_results` (integrated_diagnostic) | ✅ **Merges text + photo analysis into comprehensive 9-section diagnostic report** |
| **Deep Dive Generation** | Create renovation tiers and consideraciones | Analysis results | `deepdives` + `intelligent_consideraciones` tables | ❓ |
| **Publishing** | Make deep dive public for agency use | Deep dive data | Public Property Page at `/property/[id]` | ❓ |

## UI Test Cases

| Component | Test Case | Status | Notes |
|-----------|-----------|--------|-------|
| Property Details Composer | Load oldest listing | ❓ | Test with `ORDER BY created_at ASC LIMIT 1` |
| Property Details Composer | Load newest listing | ❓ | Test with `ORDER BY created_at DESC LIMIT 1` |
| Property Details Composer | Load specific ID | ❓ | Test with hardcoded listing ID |
| AnalysisModal | Render with mock data | ❓ | Test with sample Integrated Analysis JSON |
| Photo Clustering UI | Save clusters | ❓ | Test cluster persistence to `manual_photo_clusters` |
| Photo Clustering UI | Load existing clusters | ❓ | Test cluster retrieval from database |
| Property Page | Display published deep dive | ❓ | Test with `deepdives` table data at `/property/[id]` |
| Admin Dashboard | Monitor pipeline progress | ❓ | Test with multiple pipeline stages |

## Architecture Notes

### Clear Separation of Concerns
- **Scraping** = Get facts from HTML (robust scraper only)
- **A** = Prepare context from structured data (no HTML parsing)
- **A-C** = Analyze rich text content (uses A context)

### Data Flow
1. **Robust Scraper** extracts all essential info and stores photos in Supabase Storage
2. **A Context Preparation** reads from `listings` table and prepares context for AI analysis
3. **A-C Analysis** uses A context instead of raw HTML
4. **Photo Analysis Pipeline** uses photos from Supabase Storage for multimodal analysis

## 🔧 Recent Fixes Applied

### Client-Side Scraping Optimization (2025-11-23)
- ✅ **Instant Redirect Strategy** - Extension now sends lightweight metadata payload first for < 1s redirect
- ✅ **Background Uploads** - Implemented detached service worker upload process for high-res photos (keeps main thread free)
- ✅ **Universal Heuristic** - Added generic regex/heuristic parsing to `content.js` to support ANY real estate site
- ✅ **Smart Address Repair** - Added auto-retry logic in `ListingEditor` to fix address typos/prefixes using Google Maps Autocomplete
- ✅ **Zero-Lag UI** - Decoupled text loading from photo loading in `ListingEditor` for instant perceived performance

### Text Analysis Pipeline Fixes (2025-01-27)
- ✅ **B3 Snippets Counting Fixed** - Corrected nested structure counting in `snippets_by_category` to properly sum snippet arrays
- ✅ **B4 Headlines Field Alignment** - Updated prompt and code to use `commentaries` field instead of `headlines` for consistency
- ✅ **Database Upsert Conflicts Resolved** - Added `onConflict: 'listing_id,phase', ignoreDuplicates: false` to all text analysis endpoints
- ✅ **B1 Error Handling Improved** - Individual claim failures no longer break entire categorization process
- ✅ **All A-C Endpoints Working** - Complete text analysis pipeline tested and functional

### Physical Features Extraction Redesign (2025-01-27)
- ✅ **Completely redesigned extraction logic** - Instead of trying to parse specific HTML structure, now grabs all features from `.details-property_features` divs
- ✅ **Smart filtering implemented** - Filters out basics (Superficie, Habitaciones, Baños, Área construida) and non-essentials (Construido, Obra nueva, kWh/m² año, CO₂/m² año, etc.)
- ✅ **Meaningful features preserved** - Keeps only actual physical features like "Chalet pareado", "Terraza", "Orientación sur", "Jardín"

### Photo Analysis Pipeline Implementation (2025-10-27)
- ✅ **Whole-property analysis working** - Analyzes all photos, returns Spanish general impression + 10-category ratings (Good/Fair/Poor/Unknown)
- ✅ **Room-by-room analysis working** - Analyzes each cluster, returns detailed observations with mode tags (Observed/Inferred/Unknown), risks, verify checks, likely_work
- ✅ **Professional prompt refinements** - Added language locks (Spanish text, English tags), diversified top-checks (2-4 items), unknown fallbacks, verification cues
- ✅ **Simplified clustering** - Removed room_type dependency, filter only by name contains "excluded" or "floorplan"
- ✅ **Unified architecture** - Single table `manual_photo_clusters`, no normalization needed, Gemini sees any cluster name you provide
- ✅ **Tested successfully** - Extracted 6 physical features from test property, properly stored in database
- ✅ **A context updated** - Modified A context preparation to properly separate physical features from basic property data

### B1 Parallel Processing Implementation (2025-01-27)
- ✅ **Updated B1 categorization** - Now processes 1 claim per call in parallel instead of chunks
- ✅ **Eliminated duplication** - Each claim gets individual attention, preventing blending
- ✅ **Improved accuracy** - Maximum precision with parallel processing speed
- ✅ **Tested successfully** - All 7 claims processed simultaneously with perfect results

### Complete Pipeline Test (2025-01-27)
- ✅ **End-to-end testing** - Successfully processed new property URL `https://www.idealista.com/inmueble/106982362/`
- ✅ **Photo extraction** - Extracted and stored 60 photos in Supabase Storage
- ✅ **A-C analysis** - Completed all 6 phases of text analysis
- ✅ **Content generation** - Generated headlines, snippets, unknowns, and follow-up questions
- ✅ **Performance** - Complete pipeline completed in ~2 minutes

### Critical Database RLS Policy Fix (2025-01-27)
- ✅ **CRITICAL FIX**: Added missing RLS UPDATE policy for `listings` table
- ✅ **Issue Identified**: Scraper UPDATE operations were returning 0 rows due to missing RLS policy
- ✅ **Root Cause**: `listings` table had INSERT/SELECT policies but no UPDATE policy
- ✅ **Solution Applied**: Added `CREATE POLICY "Public listings update" ON listings FOR UPDATE TO public USING (true) WITH CHECK (true);`
- ✅ **Impact**: Scraper now successfully updates listing records with scraped data
- ✅ **Verification**: UPDATE operations now return 1 row instead of 0, data persists correctly
- ✅ **Prevention**: All database tables must have complete RLS policies (INSERT, SELECT, UPDATE, DELETE)

### Database Architecture Cleanup (2024-01-27)
- ✅ **Renamed `analysis_results` to `photo_analysis_results`** - Clear separation between text analysis and photo analysis
- ✅ **Standardized phase names** - All endpoints now use `a_context` instead of `a_essential`
- ✅ **Updated all endpoints** - Photo analysis endpoints now reference `photo_analysis_results` table
- ✅ **Deprecated legacy table** - `idealista_info_extraction` marked as deprecated
- ✅ **Applied migration 009** - Clean database architecture implemented

### URL-to-C Orchestrator Fixes (2024-01-27)
- ✅ **Fixed filename sanitization** - Supabase Storage now accepts sanitized filenames (removes special characters like `ó`)
- ✅ **Added photo download timeouts** - 10-second timeout prevents hanging on slow photo downloads
- ✅ **Improved error handling** - Better error messages for timeout vs other failures
- ✅ **End-to-end testing** - Complete pipeline tested and working

### Key Changes Made
- ✅ Deleted duplicate pre-pass scraper
- ✅ Redesigned A to read from structured data instead of HTML
- ✅ Updated A-C to use A context output
- ✅ Updated all endpoints to use `listing_photos` table instead of pre-pass results
- ✅ Restored robust scraper timeout to 45 seconds
- ✅ Updated documentation to reflect new architecture

## Key Monitoring Points

| Component | Status | Health Check | Last Tested |
|-----------|--------|---------------|-------------|
| Scrapfly API | ✅ | Rate limits, quotas, anti-bot blocks (Key: ) | 2025-01-27 |
| Supabase Storage | ✅ | Bucket access, upload success rates | 2025-01-27 |
| Gemini API | ✅ | Authentication, response times, token limits | 2025-01-27 |
| Database connections | ✅ | RLS policies, query performance | 2025-01-27 |
| UI Data Flow | ❓ | Component → Database → Display | Not tested |

## Quick Health Check Commands

```bash
# Test Scrapfly
curl -X POST "http://localhost:3000/api/scrape/robust" -d '{"url":"test-url"}'

# Test Photo Storage
curl -X POST "http://localhost:3000/api/listings/test/photos/store"

# Test Gemini
curl -X POST "http://localhost:3000/api/test/gemini-image-test"

# Test Orchestrator
curl -X POST "http://localhost:3000/api/orchestrate-url-to-c" -d '{"url":"https://www.idealista.com/inmueble/106982362/"}'
```

## Current Blockers

- 🟡 **Photo Analysis Pipeline** - Stages 1-3 not implemented
- 🟡 **Clustering UI** - Need to verify save mechanism
- 🟡 **Property Details Component** - Need to test data flow

## Status Legend

- ✅ **Working** - Tested and functional
- ⚠️ **Partial** - Some components work, others don't
- ❌ **Broken** - Not working or not implemented
- ❓ **Unknown** - Not tested or unclear

---

**Note:** This document should be updated whenever components are tested, fixed, or modified to maintain accurate pipeline status tracking.
