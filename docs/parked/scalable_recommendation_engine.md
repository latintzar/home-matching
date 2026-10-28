# Plan: Scalable Recommendation Engine Implementation

## 🎯 Goal
Implement a high-performance, database-native filtering system for the Recommendation Engine. This replaces the temporary in-memory filtering approach with efficient SQL queries using indexed columns.

## 🏗️ Architecture

### 1. Database Schema (✅ Completed)
- **Migration 057**: Restored `bedrooms`, `bathrooms`, `sqm`, and `year_built` as top-level columns.
- **Indexes**: Added B-Tree indexes on these columns for fast range queries.
- **Backfill**: Existing data has been backfilled from `scraped_data` JSONB.

### 2. Ingestion Pipeline Updates
We must ensure all entry points populate these new columns immediately.
- **Browser Extension (`/api/ingest/browser`)**: Update `insert` payload.
- **Server Scraper (`/api/ingest/server`)**: Update `update` payload.
- **Manual Entry (`/api/listings/manual`)**: Update `insert` payload.

### 3. Recommendation Engine Upgrade (`/api/lifestyle/recommendations`)
Refactor the API to use purely database-side filtering for:
- **Price**: `price_eur` (Existing)
- **Size**: `sqm`, `bedrooms`, `bathrooms` (New)
- **Amenities**: `has_elevator`, `has_terrace`, etc. (Existing Booleans)
- **Attributes**: `floor_level`, `orientation`, `condition` (Existing Enums)

The only part remaining in-memory (or handled via PostGIS later) is the complex "Point in Polygon" check for the `sweetSpot`, unless we switch to PostGIS geometry columns (out of scope for this immediate fix, but the roadmap).

## 📋 Execution Steps

1.  **Update `src/app/api/ingest/browser/route.ts`**: Map normalized fields to new DB columns.
2.  **Update `src/app/api/ingest/server/route.ts`**: Map normalized fields to new DB columns.
3.  **Update `src/app/api/listings/manual/route.ts`**: Map normalized fields to new DB columns.
4.  **Refactor `src/app/api/lifestyle/recommendations/route.ts`**: Remove in-memory JSONB parsing and use `gte`/`lte` on new columns.
5.  **Verification**: Confirm a new recommendation request correctly filters by bedrooms/bathrooms without fetching unnecessary rows.

