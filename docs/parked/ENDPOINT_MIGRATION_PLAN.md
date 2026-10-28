# Endpoint Migration Plan: Supabase → DynamoDB

## Overview

Migrate 53 endpoints from direct Supabase queries to the unified data-adapter, which can read from DynamoDB (bulk data) or Supabase (user-facing data).

## Migration Strategy

### Priority Tiers

**Tier 1: Critical Path (Do First)**
- Property display endpoints
- Listing CRUD endpoints
- These power the main UI

**Tier 2: Analysis Pipeline**
- Text analysis endpoints
- Photo analysis endpoints
- WPA endpoints

**Tier 3: Renovation Pipeline**
- Tier scope, timeline, permits
- After-photo generation
- These use Supabase for now (renovation data stays on Supabase)

**Tier 4: Low Priority / Stay on Supabase**
- Agent endpoints
- DeepDive endpoints
- Auth-related
- These intentionally stay on Supabase

---

## Tier 1: Critical Path Endpoints

### 1.1 Core Listing Endpoints

| File | Current | Change To | Priority |
|------|---------|-----------|----------|
| `src/app/api/listings/route.ts` | `supabase.from('listings')` | `getListings()` | HIGH |
| `src/app/api/listings/[id]/route.ts` | `supabase.from('listings')` | `getListingById()` | HIGH |
| `src/app/api/listings/latest/route.ts` | `supabase.from('listings')` | `getListings({limit: 10})` | HIGH |
| `src/app/api/listings/manual/route.ts` | `supabase.from('listings')` | Keep Supabase (writes) | MEDIUM |

### 1.2 Property Page

| File | Current | Change To | Priority |
|------|---------|-----------|----------|
| `src/app/property/[id]/page.tsx` | `supabase.from('listings')` | `getListingById()` | HIGH |
| `src/hooks/usePropertyDetailsData.ts` | `supabase.from('listings')` | `getListingById()` | HIGH |

---

## Tier 2: Analysis Pipeline Endpoints

### 2.1 Text Analysis

| File | Current | Change To | Priority |
|------|---------|-----------|----------|
| `src/app/api/listings/[id]/text-analysis/a-facts/route.ts` | Mixed | `getAnalysis()` for reads | MEDIUM |
| `src/app/api/listings/[id]/text-analysis/c-unknowns/route.ts` | Mixed | `getAnalysis()` for reads | MEDIUM |
| `src/app/api/listings/[id]/text-analysis/results/route.ts` | `supabase.from()` | `getAllAnalyses()` | MEDIUM |

### 2.2 Photo Analysis

| File | Current | Change To | Priority |
|------|---------|-----------|----------|
| `src/app/api/listings/[id]/photo-analysis/whole-property/route.ts` | Mixed | `getWPA()` / `putWPA()` | MEDIUM |
| `src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts` | Mixed | `getAnalysis()` | MEDIUM |
| `src/app/api/listings/[id]/analysis/whole-property/route.ts` | Mixed | `getWPA()` | MEDIUM |

### 2.3 Clustering

| File | Current | Change To | Priority |
|------|---------|-----------|----------|
| `src/lib/auto-clustering/zeroShotGemini3.ts` | `supabase.from('clusters')` | Embedded in listing | MEDIUM |
| `src/lib/auto-clustering/visibilityGemini3.ts` | `supabase.from('clusters')` | Embedded in listing | MEDIUM |

---

## Tier 3: Renovation Pipeline (Stay on Supabase)

These endpoints handle renovation-specific data that's not being migrated:

| File | Status |
|------|--------|
| `src/app/api/listings/[id]/renovation-scope/route.ts` | STAY |
| `src/app/api/listings/[id]/renovation-timeline/route.ts` | STAY |
| `src/app/api/listings/[id]/renovation-permits/route.ts` | STAY |
| `src/app/api/listings/[id]/renovation-pricing/route.ts` | STAY |
| `src/app/api/listings/[id]/tiers/*` | STAY |

**Reason:** Renovation data (tier_scope, timeline_milestones, permit_notes) stays on Supabase as it's user-facing and small.

---

## Tier 4: Stay on Supabase (Intentional)

| File | Reason |
|------|--------|
| Agent endpoints | User-facing, auth-related |
| DeepDive endpoints | User-facing, paywall |
| Auth endpoints | Supabase Auth |
| Lifestyle/recommendations | User profiles |

---

## Implementation Order

### Phase A: Core Reads (Today)
1. ✅ `src/app/api/listings/[id]/route.ts`
2. ✅ `src/app/api/listings/route.ts`
3. ✅ `src/app/api/listings/latest/route.ts`
4. ✅ `src/app/property/[id]/page.tsx`
5. ✅ `src/hooks/usePropertyDetailsData.ts`

### Phase B: Analysis Reads
1. `src/app/api/listings/[id]/text-analysis/results/route.ts`
2. `src/app/api/listings/[id]/analysis/whole-property/route.ts`
3. `src/app/api/listings/[id]/photo-analysis/*`

### Phase C: Writes (Careful)
1. Update `putListing()` calls
2. Update `putAnalysis()` calls
3. Dual-write to both for safety

---

## Data Adapter Functions Needed

### Already Implemented
- `getListingById(id)` ✅
- `getListingBySourceUrl(url)` ✅
- `getListings(options)` ✅
- `getAgent(id)` ✅
- `getDeepDive(id)` ✅

### Need to Add
- `getListingWithPhotos(id)` - Include photo URLs
- `getListingWithClusters(id)` - Include cluster data
- `updateListing(id, data)` - Dual-write
- `getTextAnalysisResults(listingId)` - All phases
- `getRoomAnalyses(listingId)` - Room-by-room data

---

## Testing Checklist

For each endpoint migration:
- [ ] Read operations return correct data
- [ ] Data shape matches Supabase format
- [ ] Null handling is correct
- [ ] Error handling works
- [ ] Performance is acceptable

---

## Rollback Plan

If issues occur:
```bash
# Disable DynamoDB reads
USE_DYNAMODB=false

# All endpoints fall back to Supabase
# Data is still there (migration was non-destructive)
```

---

## Success Criteria

- [ ] Property page loads from DynamoDB
- [ ] Listing API returns data from DynamoDB
- [ ] Analysis results readable from DynamoDB
- [ ] No regressions in existing functionality
- [ ] Feature flag works for gradual rollout

