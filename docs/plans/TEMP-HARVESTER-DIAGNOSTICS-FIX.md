# Harvester Diagnostics Fix Plan

**Date**: 2025-12-11
**Status**: Investigation Complete, Fixes Identified

## Issues Identified

### 1. Tecnocasa: Type Stats All "Unknown" (0/0/104)

**Root Cause**: Contract type mismatch
- TC uses Spanish values: `'venta'` / `'alquiler'`
- Tracking code checks English: `'rent'` / `'sale'`

**Evidence**:
```typescript
// Line 401: TC parses as Spanish
contract_type: match[1], // venta, alquiler

// Line 612: From estate data
contract_type: estateData.contract?.slug || '',  // 'venta' or 'alquiler'

// Lines 1051-1052: Tracking checks English
if (listing.contract_type === 'rent') typeStats.rent++;
else if (listing.contract_type === 'sale') typeStats.sale++;
else typeStats.unknown++;  // ← ALL GO HERE
```

**Fix** (in `tc-harvest-delta.ts` lines 1050-1057):
```typescript
// Track data quality stats
// Tecnocasa uses Spanish: 'venta' (sale) / 'alquiler' (rent)
if (listing.contract_type === 'alquiler' || listing.contract_type === 'rent') typeStats.rent++;
else if (listing.contract_type === 'venta' || listing.contract_type === 'sale') typeStats.sale++;
else typeStats.unknown++;
```

---

### 2. Tecnocasa: Type Stats Only Count NEW Listings (104 of 7297)

**Root Cause**: Tracking only happens in new listing processing block
- Type/precision stats are incremented only when new listings are parsed
- Existing listings (7193 of 7297) are written but NOT tracked

**Why This Happens**:
- TC processes ALL URLs from sitemap
- For existing listings, it skips parsing (already in S3)
- For new listings only (104), it parses and tracks

**This is actually CORRECT behavior** for delta tracking - we only want to track NEW listings per run, not re-count existing ones.

---

### 3. Lucas Fox: 4803 Discovered but 0 Written to DynamoDB

**Root Cause**: State doesn't preserve `newListings` array across invocations

**Evidence from logs**:
```
Invocation 1:
- Scraped: 4828
- Geocoded: 190/4803
- SAVE GAME at 14m30s timeout

Invocation 2:
- "Resuming: 1 URLs remaining to scrape"  ← Only 1!
- "Written to DynamoDB: 0"  ← LOST 4803 listings!
```

**The Bug**:
1. First invocation discovers 4803 listings, stores in `newListings` array
2. Times out during geocoding, saves state with `geocodedIds` but NOT the listings data
3. Second invocation resumes, but `newListings` is empty
4. Skips geocoding since no listings to geocode
5. Completes with 0 written

**Fix Required** (in `lf-harvest-delta.ts`):
The state needs to preserve `newListings` (or `discoveredListings`) for geocoding phase continuation.

**Current State Interface** (approximate):
```typescript
interface HarvestState {
  phase: string;
  allUrls: string[];
  scrapedUrls: string[];
  geocodedIds: string[];
  // MISSING: discoveredListings or listingsToGeocode
}
```

**Fix Options**:
1. **Save listings to S3 during scraping phase** (before geocoding) - RECOMMENDED
2. Store listings in state (may be large)
3. Re-scrape from URLs on continuation (wasteful)

---

### 4. Lucas Fox: DynamoDB Write Failures

**Evidence from logs**:
```
⚠️ Failed to write VIL64063 to DynamoDB
⚠️ Failed to write GIR60997 to DynamoDB
⚠️ Failed to write GAV65082 to DynamoDB
⚠️ Failed to write IBZ57042 to DynamoDB
```

**Possible Causes**:
1. **Item too large** - DynamoDB has 400KB item limit
2. **Invalid data type** - Some field has wrong type
3. **Missing required key** - `domain` or `listing_id` missing
4. **Throttling** - Write capacity exceeded

**Investigation Steps**:
1. Add detailed error logging to `writeToLeoListings()` function
2. Check specific listing data for the failing IDs
3. Verify item size before write

---

## Fix Priority

| Issue | Priority | Effort | Impact |
|-------|----------|--------|--------|
| TC type mismatch | P1 | 5 min | Accurate analytics |
| LF state preservation | P1 | 30 min | 4803 listings lost! |
| LF write failures | P2 | 15 min | Some listings failing |
| TC stats count only new | N/A | - | Correct behavior |

---

## Implementation Plan

### Step 1: Fix TC Type Tracking (5 min)
```typescript
// In tc-harvest-delta.ts lines 1050-1057
if (listing.contract_type === 'alquiler' || listing.contract_type === 'rent') typeStats.rent++;
else if (listing.contract_type === 'venta' || listing.contract_type === 'sale') typeStats.sale++;
else typeStats.unknown++;
```

### Step 2: Fix LF State Preservation (30 min)

Add `listingsToGeocode` to state and save during scraping phase:

```typescript
// In state interface
interface HarvestState {
  // ... existing
  listingsToGeocode: LFListing[];  // ADD THIS
}

// Before scraping phase completes, save listings
state.listingsToGeocode = newListings;
await saveHarvestState(state);

// In geocoding phase, load from state if resuming
if (state.listingsToGeocode?.length > 0 && newListings.length === 0) {
  newListings = state.listingsToGeocode;
}
```

### Step 3: Add LF Write Error Logging (15 min)
```typescript
// In writeToLeoListings function
try {
  await dynamoClient.send(new PutCommand({...}));
} catch (error) {
  console.error(`❌ DynamoDB write failed for ${listing.id}:`, error);
  console.error(`   Item size: ${JSON.stringify(normalizedListing).length} bytes`);
  console.error(`   Keys: domain=${normalizedListing.domain}, listing_id=${normalizedListing.listing_id}`);
  throw error;
}
```

---

## Verification

After fixes:
1. Redeploy TC and verify type stats show correct sale/rent counts
2. Clear LF state and re-run, verify all listings are written
3. Monitor LF write errors and check specific failing items
