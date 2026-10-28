# Harvester Status Report - 2025-12-11

**Generated**: 12:50 UTC (Updated 13:44 UTC)
**Purpose**: Track harvester progress and identify issues

---

## ✅ FIXES APPLIED (13:44 UTC)

1. **Lucas Fox**: Fixed state preservation - `listingsToGeocode` now saved across invocations
2. **Tecnocasa**: Fixed type tracking - now handles Spanish (`venta`/`alquiler`)
3. **donpiso**: Fixed type tracking - now handles Schema.org (`ForSale`/`ForRent`)
4. **Deployed**: lf-harvest-delta, tc-harvest-delta, dp-harvest-delta
5. **Re-invoked**: Lucas Fox (fresh start)

---

## Quick Status

| Harvester | Catch-Up Status | Last Run | Issues |
|-----------|-----------------|----------|--------|
| **tecnocasa.es** | ✅ UP TO DATE | Complete @ 12:32 | Type tracking bug |
| **century21.es** | ✅ UP TO DATE | Complete @ 12:27 | None |
| **donpiso.com** | ⚠️ STALE STATE | Complete @ 12:15 | Type tracking bug |
| **lucasfox.com** | ✅ UP TO DATE | Complete @ 12:45 | 🚨 **0 WRITTEN** |
| **engelvoelkers.com** | 🔄 NEEDS CATCH-UP | Discovery @ 12:59 | In progress |
| **remax.es** | 🔄 NEEDS CATCH-UP | Scraping (70/12780) | Very slow |
| **aproperties.es** | 🔄 NEEDS CATCH-UP | Scraping (406/1206) | In progress |

---

## Detailed Status

### ✅ UP TO DATE (No pending work)

#### Tecnocasa (tecnocasa.es)
- **Status**: Complete
- **State File**: Cleared (stale marker)
- **Results**: 7,297 discovered, 7,297 written
- **Type Stats**: S:0 R:0 U:104 ← **BUG: Spanish vs English mismatch**
- **Precision**: P:104 A:0 C:0
- **Action**: Fix type tracking, redeploy

#### Century 21 (century21.es)
- **Status**: Complete  
- **State File**: None (clean)
- **Results**: 22 discovered, 22 written
- **Type Stats**: S:22 R:0 U:0 ✅
- **Precision**: P:0 A:0 C:0 (geocoding tracks separately)
- **Action**: None needed

#### Lucas Fox (lucasfox.com)
- **Status**: Complete (BUT FAILED)
- **State File**: None (deleted on "completion")
- **Results**: 4,803 discovered, **0 written** 🚨
- **Type Stats**: S:0 R:0 U:0
- **Root Cause**: State didn't preserve `newListings` array across invocations
- **Action**: **FIX STATE PRESERVATION, RE-RUN**

---

### 🔄 NEEDS CATCH-UP (Pending work in state file)

#### Engel & Völkers (engelvoelkers.com)
- **Status**: Discovery in progress
- **State File**: 2.2 MB (invocation 2)
- **Phase**: `discovery`
- **Progress**: 1,268+ listings discovered, geo-recursive crawl ongoing
- **Action**: Re-invoke to continue discovery

#### RE/MAX (remax.es)
- **Status**: Scraping in progress
- **State File**: 2.1 MB (invocation 1)
- **Phase**: `scraping`
- **Progress**: 70 / 12,780 URLs scraped (0.5%)
- **Rate**: ~70 per 15 min = **~45 hours to complete** 😱
- **Action**: Re-invoke; consider rate optimization

#### aProperties (aproperties.es)
- **Status**: Scraping in progress
- **State File**: 3.3 MB (invocation 1)
- **Phase**: `scraping`
- **Progress**: 406 / 1,206 URLs scraped (34%)
- **Using**: ScrapFly with age filter
- **Action**: Re-invoke to continue

---

### ⚠️ STALE STATE (Completed but state not cleaned)

#### donpiso (donpiso.com)
- **Status**: Complete (per stats) but state file exists
- **State File**: 10 KB (345 processed)
- **Results**: 345 discovered, 345 written
- **Type Stats**: S:0 R:0 U:345 ← **BUG: Wrong field name**
- **Action**: Clear state, fix type tracking, redeploy

---

## Critical Issues

### 🚨 Issue 1: Lucas Fox Lost 4,803 Listings

**Severity**: CRITICAL  
**Impact**: Zero listings written despite successful scraping

**What Happened**:
1. Invocation 1: Scraped 4,828 URLs, started geocoding, hit timeout at 190/4,803
2. SAVE GAME triggered, saved `geocodedIds` but NOT the `newListings` array
3. Invocation 2: Resumed but `newListings` was empty
4. Completed immediately with 0 written

**Fix Required** (`lf-harvest-delta.ts`):
```typescript
// Add to state interface
interface HarvestState {
  // ... existing fields
  listingsToGeocode: LFListing[];  // NEW: preserve across invocations
}

// Before geocoding phase, save listings to state
state.listingsToGeocode = newListings;
await saveHarvestState(state);

// On resume, load from state
if (state.listingsToGeocode?.length > 0 && newListings.length === 0) {
  newListings = state.listingsToGeocode;
}
```

---

### ⚠️ Issue 2: Type Tracking Language Mismatch

**Affected**: Tecnocasa, donpiso
**Severity**: Medium (analytics only, data is correct)

**Problem**:
```typescript
// Tracking code checks English
if (listing.contract_type === 'rent') typeStats.rent++;
else if (listing.contract_type === 'sale') typeStats.sale++;

// But harvesters use:
// - Tecnocasa: 'venta' / 'alquiler' (Spanish)
// - donpiso: 'ForSale' / 'ForRent' (Schema.org)
```

**Fix**: Update tracking to handle all variants:
```typescript
// Tecnocasa
if (['alquiler', 'rent'].includes(listing.contract_type)) typeStats.rent++;
else if (['venta', 'sale'].includes(listing.contract_type)) typeStats.sale++;

// donpiso
if (['ForRent', 'rent'].includes(listing.listingType)) typeStats.rent++;
else if (['ForSale', 'sale'].includes(listing.listingType)) typeStats.sale++;
```

---

### ⚠️ Issue 3: RE/MAX Extremely Slow

**Severity**: Medium
**Impact**: Would take ~45 hours to complete at current rate

**Observed**: 70 listings scraped in 14.5 minutes = 4.8/min

**Possible Causes**:
1. Website rate limiting
2. Slow response times
3. Too much delay between requests

**Investigation Needed**: Check if parallelization is working

---

## DynamoDB Totals

| Domain | Listings in DB | Notes |
|--------|----------------|-------|
| tecnocasa.es | 7,573 | Healthy |
| century21.es | 17,133 | Healthy |
| donpiso.com | 359 | Healthy |
| engelvoelkers.com | 338 | Growing |
| lucasfox.com | 274 | **Should be ~4,800** |
| remax.es | 2,723 | Growing |
| aproperties.es | 1,182 | Growing |
| **TOTAL** | **29,582** | |

---

## Recommended Actions

### Immediate (Do Now)
1. ⬜ **Fix LF state preservation** - Critical, 4,803 listings lost
2. ⬜ **Re-invoke** E&V, RE/MAX, aProperties to continue

### Short-term (Today)
3. ⬜ **Fix TC type tracking** - Spanish/English mismatch
4. ⬜ **Fix DP type tracking** - Wrong field name
5. ⬜ **Clear DP stale state** - Clean up

### Investigation
6. ⬜ **RE/MAX slowness** - Why only 70 in 15 min?
7. ⬜ **LF DynamoDB failures** - Why did some writes fail?

---

## Commands

### Re-invoke harvesters that need catch-up
```bash
aws lambda invoke --function-name ev-harvest-delta --invocation-type Event --payload '{}' /dev/null
aws lambda invoke --function-name remax-harvest-delta --invocation-type Event --payload '{}' /dev/null
aws lambda invoke --function-name aproperties-harvest-delta --invocation-type Event --payload '{}' /dev/null
```

### Clear stale state files
```bash
aws s3 rm s3://puedo-casa-html-archive/harvest/dp-state.json
aws s3 rm s3://puedo-casa-html-archive/harvest/tc-state.json
```

### Check current progress
```bash
aws dynamodb scan --table-name leo-harvest-stats --select ALL_ATTRIBUTES --output json | \
  jq -r '.Items[] | select(.timestamp.S >= "2025-12-11") | "[\(.domain.S)] \(.status.S)"'
```
