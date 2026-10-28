# Harvester Investigation Plan

**Created**: 2025-12-10
**Status**: Ready for implementation
**Estimated Time**: ~1 hour

---

## Issue 1: RE/MAX Error - `Cannot read properties of undefined (reading 'length')`

### Root Cause
**File**: `src/lambda/remax-harvest-delta.ts`

The `HarvestState` interface (line 356-381) defines `scrapedUrls: string[]`, but the code incorrectly references `scrapedIds` which doesn't exist.

### Exact Fixes Required

**Fix 1** - Line 1052:
```typescript
// BEFORE (line 1052)
'Scraped': state.scrapedIds.length,

// AFTER
'Scraped': state.scrapedUrls.length,
```

**Fix 2** - Line 1167:
```typescript
// BEFORE (line 1167)
'Scraped': state.scrapedIds.length,

// AFTER
'Scraped': state.scrapedUrls.length,
```

### Verification
After fix, search for `scrapedIds` in the file - should return 0 results.

---

## Issue 2: aProperties Not Running (15+ hours since invocation)

### Diagnosis Steps

1. **Check state file age**:
   ```bash
   aws s3 ls s3://puedo-casa-html-archive/state/aproperties-state.json
   ```

2. **If state exists and is > 1 hour old**:
   ```bash
   aws s3 rm s3://puedo-casa-html-archive/state/aproperties-state.json
   ```

3. **Re-invoke**:
   ```bash
   aws lambda invoke --function-name aproperties-harvest-delta --invocation-type Event /dev/null
   ```

### Root Cause (Likely)
The harvester hit ScrapFly rate limits (visible in logs: "Rate limited, waiting 3000ms") and eventually timed out. The state file may be stale, preventing fresh runs.

---

## Issue 3: Century 21 Only 42 New Listings

### This is EXPECTED BEHAVIOR ✅

**Evidence from logs**:
```
sitemapTotal: 23079
newListings: 42
new_in_db: 42
```

C21 is a **delta harvester**. It skips URLs that are:
1. Already in `state.scrapedListingIds` (from previous runs)
2. Already in DynamoDB `leo-listings` table

42 new listings since last run is normal if the harvester ran recently.

### No fix needed - Just monitoring

---

## Issue 4: Add Diagnostic Logging for Sale/Rent & Geocoding

### Problem
Currently no aggregate statistics are logged to diagnose:
- Sale vs Rent distribution issues
- Coordinate precision quality

### Implementation

#### Step 1: Add types to `src/lib/harvest/run-analytics.ts`

After line 109, add to `RunSummary` interface:
```typescript
// Data quality stats
listings_by_type?: {
  sale: number;
  rent: number;
  unknown: number;
};
listings_by_precision?: {
  precise: number;
  approximate: number;
  city_center: number;
  unknown: number;
};
```

#### Step 2: Update `writeRunSummary` logging (after line 146)

Add after the existing stats logging:
```typescript
if (summary.listings_by_type) {
  console.log(`   By Type: ${summary.listings_by_type.sale} sale, ${summary.listings_by_type.rent} rent`);
}
if (summary.listings_by_precision) {
  const p = summary.listings_by_precision;
  console.log(`   By Precision: ${p.precise} precise, ${p.approximate} approx, ${p.city_center} city, ${p.unknown} unknown`);
}
```

#### Step 3: Add tracking to each harvester

In each harvester's handler function, after the stats declarations, add:
```typescript
const typeStats = { sale: 0, rent: 0, unknown: 0 };
const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };
```

During listing processing, increment:
```typescript
// After creating/processing a listing:
if (listing.contract_type === 'rent') typeStats.rent++;
else if (listing.contract_type === 'sale') typeStats.sale++;
else typeStats.unknown++;

precisionStats[listing.coordinate_precision || 'unknown']++;
```

Before `writeRunSummary`, add to summary:
```typescript
summary.listings_by_type = typeStats;
summary.listings_by_precision = precisionStats;
```

### Harvesters to Update

| Harvester | File | Add tracking after line |
|-----------|------|-------------------------|
| RE/MAX | `src/lambda/remax-harvest-delta.ts` | ~1015 (after existingIds) |
| C21 | `src/lambda/c21-harvest-delta.ts` | ~1045 (after existingIds) |
| Tecnocasa | `src/lambda/tc-harvest-delta.ts` | ~915 (in handler) |
| Lucas Fox | `src/lambda/lf-harvest-delta.ts` | ~900 (in handler) |
| donpiso | `src/lambda/dp-harvest-delta.ts` | ~935 (after discoveredIds) |
| aProperties | `src/lambda/aproperties-harvest-delta.ts` | ~1125 (after existingIds) |
| E&V | `src/lambda/ev-harvest-delta.ts` | ~775 (in handler) |

---

## Implementation Checklist

- [ ] **Fix 1**: RE/MAX `scrapedIds` → `scrapedUrls` (line 1052)
- [ ] **Fix 2**: RE/MAX `scrapedIds` → `scrapedUrls` (line 1167)
- [ ] **Fix 3**: Clear aProperties state file from S3
- [ ] **Enhancement 1**: Add `listings_by_type` and `listings_by_precision` to RunSummary interface
- [ ] **Enhancement 2**: Update `writeRunSummary` logging
- [ ] **Enhancement 3**: Add type/precision tracking to RE/MAX
- [ ] **Enhancement 4**: Add type/precision tracking to C21
- [ ] **Enhancement 5**: Add type/precision tracking to Tecnocasa
- [ ] **Enhancement 6**: Add type/precision tracking to Lucas Fox
- [ ] **Enhancement 7**: Add type/precision tracking to donpiso
- [ ] **Enhancement 8**: Add type/precision tracking to aProperties
- [ ] **Enhancement 9**: Add type/precision tracking to E&V
- [ ] **Deploy**: Run `bash src/lambda/deploy-harvesters-only.sh`
- [ ] **Invoke**: Invoke all harvesters
- [ ] **Verify**: Check `leo-harvest-stats` table for new stats

---

## Expected Outcome

After implementation, each harvester run will log:
```
════════════════════════════════════════════════════════════════
📈 RUN SUMMARY RECORDED
════════════════════════════════════════════════════════════════
   Domain: remax.es
   Status: complete
   Duration: 500s
   Memory peak: 200MB / 2048MB
   Discovered: 1000
   Written to DB: 1000 (500 new, 500 updated)
   By Type: 800 sale, 200 rent
   By Precision: 700 precise, 200 approx, 80 city, 20 unknown
════════════════════════════════════════════════════════════════
```

And DynamoDB `leo-harvest-stats` will contain:
```json
{
  "stat_id": "remax.es#2025-12-10T20:00:00.000Z",
  "listings_by_type": { "sale": 800, "rent": 200, "unknown": 0 },
  "listings_by_precision": { "precise": 700, "approximate": 200, "city_center": 80, "unknown": 20 }
}
```

---

## Sale/Rent Detection Logic Reference

| Harvester | Detection Method | Code Location |
|-----------|------------------|---------------|
| RE/MAX | URL contains `/alquiler/` → rent | Line 618, 630 |
| C21 | URL contains `/alquilar/` → rent | Line 674 |
| Tecnocasa | URL contains `/affitto/` → rent | parseUrlMetadata() |
| Lucas Fox | URL contains `/for-rent/` → rent | parseUrl() |
| donpiso | URL contains `/alquiler/` → rent | fetchAndParseListing() |
| aProperties | URL contains `/en-alquiler/` → rent | parseDetailPage() |
| E&V | URL contains `/alquiler/` OR JSON-LD | parseDetailPage() |

---

## Coordinate Precision Logic Reference

**File**: `src/lib/harvest/coordinate-precision.ts`

| Precision | Definition | Detection |
|-----------|------------|-----------|
| `precise` | Street-level address | Has street pattern (Calle, Avenida, etc.) |
| `approximate` | Neighborhood level | Has neighborhood, no street, < 2km from geocoded |
| `city_center` | City centroid | Only city/province, > 5km from geocoded |
| `unknown` | Can't determine | No address components parsed |

---

## Post-Implementation Monitoring

Query to check data quality across all domains:
```bash
aws dynamodb scan --table-name leo-harvest-stats \
  --filter-expression "begins_with(stat_id, :d)" \
  --expression-attribute-values '{":d":{"S":"2025-12-10"}}' \
  --projection-expression "domain, listings_by_type, listings_by_precision" \
  --output table
```
