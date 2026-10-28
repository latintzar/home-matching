# Harvester Technical Reference

> Complete technical documentation for the premium domain harvester infrastructure.
> 
> **Last Updated:** December 11, 2025

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Self-Continuation System](#2-self-continuation-system)
3. [SAVE GAME Logging](#3-save-game-logging)
4. [Coordinate Verification](#4-coordinate-verification)
5. [Run Analytics](#5-run-analytics)
6. [State Management](#6-state-management)
7. [Type & Precision Tracking](#7-type--precision-tracking)
8. [Troubleshooting Guide](#8-troubleshooting-guide)

---

## 1. Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HARVESTER PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Website     Lambda             Nominatim        DynamoDB      Analytics   │
│  ┌──────┐   ┌─────────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐ │
│  │ HTML │──▶│  DISCOVERY  │──▶│ Geocode  │──▶│leo-listings│   │leo-harvest││
│  │ Data │   │  SCRAPING   │   │ & Verify │   │           │──▶│  -stats   ││
│  └──────┘   │  GEOCODING  │   └──────────┘   └───────────┘   └──────────┘ │
│             │  COMPLETION │                                                │
│             └──────┬──────┘                                                │
│                    │                                                        │
│                    ▼                                                        │
│             ┌──────────────┐                                               │
│             │  S3 State    │  ← Continuation state for multi-invocation   │
│             │  S3 Backup   │  ← Full listings backup (gzipped)            │
│             └──────────────┘                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Processing Phases

Every harvester follows this phase pattern:

```typescript
type HarvestPhase = 
  | 'discovery'        // Find URLs from sitemap/search
  | 'scraping'         // Fetch and parse detail pages
  | 'geocoding'        // Verify coordinates via Nominatim
  | 'removed_detection' // Mark listings no longer in source
  | 'complete';        // Finished successfully
```

---

## 2. Self-Continuation System

### Why It's Needed

AWS Lambda has a 15-minute hard timeout. Large harvests (e.g., RE/MAX with 12,000+ listings) cannot complete in a single invocation. The self-continuation system allows work to span multiple Lambda invocations.

### Implementation Pattern

```typescript
// Constants
const MAX_INVOCATIONS = 10;                    // Prevent infinite loops
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s - stop before 15m limit
const STATE_EXPIRY_MS = 60 * 60 * 1000;        // 1 hour - reset stale state

// State interface (varies by harvester)
interface HarvestState {
  invocationCount: number;
  startedAt: string;
  lastProgressAt: string;
  phase: HarvestPhase;
  
  // Progress tracking
  allSitemapUrls: string[];
  scrapedUrls: string[];
  geocodedIds: string[];
  
  // CRITICAL for continuation (added Dec 11, 2025)
  listingsToGeocode?: Listing[];  // Preserve listings across invocations
  
  // Stats
  totalNewFound: number;
  writtenToDynamo: number;
  newInDb: number;
  updatedInDb: number;
}
```

### Safeguards

| Safeguard | Purpose | Implementation |
|-----------|---------|----------------|
| **Max Invocations** | Prevent infinite loops | Stop after 10 invocations |
| **Progress Check** | Detect stuck loops | Compare progress between invocations |
| **State Expiry** | Handle abandoned runs | Reset state older than 1 hour |
| **Timeout Buffer** | Safe exit | Stop at 14m 30s (before 15m limit) |

### Continuation Flow

```
Invocation 1:
├── Load state (empty on first run)
├── Process items 1-500
├── ⏰ Approaching timeout (14m 30s)
├── 💾 SAVE GAME: Save state to S3
└── Return 202 "Continuing..."

Invocation 2 (scheduled or manual):
├── Load state from S3
├── ✅ State is fresh, invocation 2/10
├── Resume from item 501
├── Process items 501-1000
├── ⏰ Approaching timeout
├── 💾 SAVE GAME
└── Return 202

Invocation 3:
├── Load state
├── Process items 1001-1325
├── ✅ Complete!
├── Run removed detection
├── Write run summary to analytics
├── Delete state file
└── Return 200 with summary
```

---

## 3. SAVE GAME Logging

### Purpose

When a harvester times out, it logs detailed progress information for debugging and monitoring.

### Implementation

```typescript
// src/lib/harvest/run-analytics.ts
export function logSaveGame(
  phase: string,
  invocation: number,
  maxInvocations: number,
  progress: Record<string, string | number>
): void {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`💾 SAVE GAME - ${phase}`);
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`   Invocation: ${invocation}/${maxInvocations}`);
  console.log('   Progress:');
  for (const [key, value] of Object.entries(progress)) {
    console.log(`      ${key}: ${value}`);
  }
  console.log('════════════════════════════════════════════════════════════════');
  console.log('   Next scheduled run will continue from here.');
  console.log('════════════════════════════════════════════════════════════════');
  logMemory('TIMEOUT_CHECKPOINT');
}
```

### Example Output

```
════════════════════════════════════════════════════════════════
💾 SAVE GAME - scraping in progress
════════════════════════════════════════════════════════════════
   Invocation: 1/10
   Progress:
      Sitemap URLs: 12780
      Scraped: 70
      Geocoded: 0
      Written to DB: 0
════════════════════════════════════════════════════════════════
   Next scheduled run will continue from here.
════════════════════════════════════════════════════════════════
📊 Memory [TIMEOUT_CHECKPOINT]: 92MB heap / 236MB RSS
```

### Usage in Harvesters

```typescript
// In harvester main loop
for (let i = 0; i < urls.length; i += BATCH_SIZE) {
  // Check timeout
  if (Date.now() - startTime > LAMBDA_SAFE_TIMEOUT_MS) {
    logSaveGame(`${state.phase} in progress`, state.invocationCount, MAX_INVOCATIONS, {
      'Sitemap URLs': state.allSitemapUrls.length,
      'Scraped': state.scrapedUrls.length,
      'Geocoded': state.geocodedIds.length,
      'Written to DB': state.writtenToDynamo,
    });
    await saveHarvestState(state);
    return { statusCode: 202, body: 'Continuing in next invocation' };
  }
  
  // Process batch...
}
```

---

## 4. Coordinate Verification

### Why Verify Coordinates?

Some sources provide coordinates that are actually city centers, not specific addresses. We verify all coordinates using Nominatim reverse geocoding.

### Precision Levels

```typescript
type CoordinatePrecision = 
  | 'precise'       // Street-level accuracy (within 100m of address)
  | 'approximate'   // Neighborhood-level (100m-1km)
  | 'city_center'   // City center placeholder (>1km from stated address)
  | 'unknown';      // No coordinates or verification failed
```

### Verification Process

```typescript
// src/lib/harvest/coordinate-precision.ts
export async function verifyCoordinates(
  embeddedLat: number | null,
  embeddedLng: number | null,
  addressText: string,
  addressComponents: AddressComponents
): Promise<CoordinateVerification> {
  
  // Step 1: Geocode the address text via Nominatim
  const geocoded = await geocodeAddress(addressText);
  
  // Step 2: If we have embedded coords, compare with geocoded
  if (embeddedLat && embeddedLng && geocoded) {
    const distance = haversineDistance(
      embeddedLat, embeddedLng,
      geocoded.lat, geocoded.lng
    );
    
    if (distance < 100) {
      return { precision: 'precise', finalLat: embeddedLat, finalLng: embeddedLng };
    } else if (distance < 1000) {
      return { precision: 'approximate', finalLat: embeddedLat, finalLng: embeddedLng };
    } else {
      // Embedded coords are city center - use geocoded instead
      return { precision: 'city_center', finalLat: geocoded.lat, finalLng: geocoded.lng };
    }
  }
  
  // Step 3: No embedded coords - use geocoded
  if (geocoded) {
    return { precision: 'approximate', finalLat: geocoded.lat, finalLng: geocoded.lng };
  }
  
  return { precision: 'unknown', finalLat: null, finalLng: null };
}
```

### Address Extraction

For sites without structured addresses, we extract from HTML:

```typescript
// Extract street address from listing HTML
export function extractStreetAddressFromHtml(html: string): string | null {
  const patterns = [
    /Calle\s+[A-Z][^,\n]+/gi,
    /C\/\s*[A-Z][^,\n]+/gi,
    /Avda?\.\s+[A-Z][^,\n]+/gi,
    /Plaza\s+[A-Z][^,\n]+/gi,
    /Paseo\s+[A-Z][^,\n]+/gi,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[0];
  }
  return null;
}
```

### Usage in Harvesters

```typescript
// During geocoding phase
for (const listing of listingsToGeocode) {
  const verification = await verifyCoordinates(
    listing.latitude,
    listing.longitude,
    `${listing.street_address}, ${listing.neighborhood}, ${listing.city}, Spain`,
    {
      streetAddress: listing.street_address,
      neighborhood: listing.neighborhood,
      city: listing.city,
      province: listing.province,
      country: 'ES'
    }
  );
  
  // Update listing with verified data
  listing.latitude = verification.finalLat;
  listing.longitude = verification.finalLng;
  listing.coordinate_precision = verification.precision;
  listing.coordinate_precision_signal = verification.precisionSignal;
  listing.verifiedAddress = verification.address;
  
  // Track precision stats
  precisionStats[verification.precision]++;
}
```

---

## 5. Run Analytics

### Purpose

Track harvester performance and data quality across runs. Enables monitoring dashboards and debugging.

### DynamoDB Table: `leo-harvest-stats`

```typescript
interface RunSummary {
  // Keys
  stat_id: string;              // "{domain}#{timestamp}"
  domain: string;               // e.g., "tecnocasa.es"
  
  // Run info
  timestamp: string;            // ISO timestamp
  harvester_version: string;    // e.g., "2.2.0"
  invocation: number;           // Which invocation (1-10)
  max_invocations: number;      // Max allowed (10)
  phase: string;                // Final phase
  status: RunStatus;            // 'complete' | 'discovery_timeout' | etc.
  
  // Performance
  duration_ms: number;
  memory_peak_mb: number;
  memory_limit_mb: number;
  
  // Counts
  listings_discovered?: number;
  listings_written?: number;
  listings_new?: number;
  listings_updated?: number;
  listings_removed?: number;
  
  // Data quality (added Dec 11, 2025)
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
  
  // Domain-specific
  scrapfly_credits?: number;    // For aProperties
}
```

### Writing Run Summary

```typescript
// At end of harvester
const summary = createRunSummary(
  DOMAIN,
  HARVESTER_VERSION,
  state.invocationCount,
  MAX_INVOCATIONS,
  state.phase,
  'complete',
  startTime,
  MEMORY_LIMIT_MB
);

summary.listings_discovered = state.totalNewFound;
summary.listings_written = state.writtenToDynamo;
summary.listings_new = state.newInDb;
summary.listings_updated = state.updatedInDb;
summary.listings_removed = state.removedCount;
summary.listings_by_type = typeStats;
summary.listings_by_precision = precisionStats;

await writeRunSummary(summary);
```

### Console Output

```
════════════════════════════════════════════════════════════════
📈 RUN SUMMARY RECORDED
════════════════════════════════════════════════════════════════
   Domain: tecnocasa.es
   Status: complete
   Duration: 285s
   Memory peak: 312MB / 2048MB
   Discovered: 104
   Written to DB: 104 (87 new, 17 updated)
   By Type: 45 sale, 59 rent, 0 unknown
   By Precision: 104 precise, 0 approx, 0 city, 0 unknown
════════════════════════════════════════════════════════════════
```

---

## 6. State Management

### State Files in S3

Each harvester maintains state in `s3://puedo-casa-html-archive/harvest/`:

| Harvester | State File | Listings Backup |
|-----------|------------|-----------------|
| Tecnocasa | `tc-state.json` | `tc-listings.json.gz` |
| Century21 | `c21-state.json` | `c21-listings.json.gz` |
| Lucas Fox | `lf-harvest-state.json` | `lf-listings.json.gz` |
| donpiso | `dp-state.json` | `dp-listings.json.gz` |
| RE/MAX | `remax-state.json` | `remax-listings.json.gz` |
| aProperties | `aproperties-state.json` | `aproperties-listings.json.gz` |
| E&V | `ev-harvest-state.json` | `ev-listings.json.gz` |

### State Lifecycle

```
Fresh Run:
├── Check S3 for state file
├── No state → Initialize fresh state
├── Process until timeout or complete
├── Save state (if continuing) or delete (if complete)

Continuation:
├── Load state from S3
├── Validate: Not expired, under max invocations
├── Resume from saved progress
├── Continue processing
├── Save/delete state
```

### Critical: Preserving Data Across Phases

**Problem (Fixed Dec 11, 2025):** When transitioning from scraping to geocoding, the `newListings` array must be preserved in state. Otherwise, on continuation, the listings are lost.

**Solution:**

```typescript
// When scraping phase completes
console.log(`✅ Scraped ${newListings.length} new listings`);
state.phase = 'geocoding';
state.totalNewFound = newListings.length;

// CRITICAL: Save listings to state for continuation
state.listingsToGeocode = newListings;
await saveHarvestState(state);

// ...

// When resuming in geocoding phase
if (state.listingsToGeocode?.length > 0 && newListings.length === 0) {
  console.log(`📂 Loading ${state.listingsToGeocode.length} listings from state`);
  newListings.push(...state.listingsToGeocode);
}
```

### Clearing Stale State

Some harvesters use a "cleared" marker instead of deleting state:

```typescript
async function clearState(): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: STATE_KEY,
    Body: JSON.stringify({ cleared: true, clearedAt: new Date().toISOString() }),
  }));
}
```

**Important:** When loading state, check for this marker:

```typescript
async function loadState(): Promise<HarvestState | null> {
  const data = await fetchFromS3();
  const parsed = JSON.parse(data);
  
  // Check if state was cleared (invalid)
  if (parsed.cleared) {
    console.log('📝 State was cleared, starting fresh');
    return null;
  }
  
  return parsed;
}
```

---

## 7. Type & Precision Tracking

### Contract Type Detection

Different sources use different values for contract type:

| Source | Sale | Rent |
|--------|------|------|
| Tecnocasa | `'venta'` | `'alquiler'` |
| donpiso | `'ForSale'` | `'ForRent'` |
| Lucas Fox | `'sale'` | `'rent'` |
| Others | `'sale'` | `'rent'` |

### Implementation

```typescript
// Initialize at start of handler
const typeStats = { sale: 0, rent: 0, unknown: 0 };
const precisionStats = { precise: 0, approximate: 0, city_center: 0, unknown: 0 };

// Track during processing
// Tecnocasa (Spanish)
if (listing.contract_type === 'alquiler' || listing.contract_type === 'rent') {
  typeStats.rent++;
} else if (listing.contract_type === 'venta' || listing.contract_type === 'sale') {
  typeStats.sale++;
} else {
  typeStats.unknown++;
}

// Track precision after verification
precisionStats[listing.coordinate_precision || 'unknown']++;

// Include in run summary
summary.listings_by_type = typeStats;
summary.listings_by_precision = precisionStats;
```

### Querying Stats

```bash
# Get today's stats
aws dynamodb scan --table-name leo-harvest-stats \
  --filter-expression "begins_with(stat_id, :today)" \
  --expression-attribute-values '{":today": {"S": "2025-12-11"}}' \
  --query 'Items[*].[domain.S, status.S, listings_by_type.M, listings_by_precision.M]'
```

---

## 8. Troubleshooting Guide

### Common Issues

#### Harvester Shows "Complete" But Wrote 0 Listings

**Cause:** State didn't preserve listings across invocations (e.g., `listingsToGeocode` not saved).

**Fix:** Ensure listings are saved to state before phase transitions:
```typescript
state.listingsToGeocode = newListings;
await saveHarvestState(state);
```

#### Type Stats All "Unknown"

**Cause:** Contract type field name mismatch (e.g., checking `'rent'` but source uses `'alquiler'`).

**Fix:** Check both variants:
```typescript
if (listing.contract_type === 'alquiler' || listing.contract_type === 'rent') {
  typeStats.rent++;
}
```

#### State File Shows Invalid Data

**Cause:** State was cleared but not deleted; loader doesn't check `cleared` flag.

**Fix:** Check for cleared state:
```typescript
if (parsed.cleared) return null;
```

#### Harvester Stuck / Not Making Progress

**Symptoms:** Same progress across multiple invocations.

**Steps:**
1. Check CloudWatch logs for errors
2. Verify state file contents: `aws s3 cp s3://bucket/harvest/state.json -`
3. Clear state: `aws s3 rm s3://bucket/harvest/state.json`
4. Re-invoke

#### Memory Issues

**Symptoms:** Lambda OOM errors, large heap in logs.

**Steps:**
1. Check `Memory peak` in run summary
2. Increase Lambda memory if needed (up to 10GB)
3. Consider processing in smaller batches
4. Ensure large arrays are cleared after use

### Useful Commands

```bash
# Check state files
for f in tc c21 lf dp remax aproperties ev-harvest; do
  echo "=== $f ===";
  aws s3 cp s3://puedo-casa-html-archive/harvest/$f-state.json - 2>/dev/null | jq '.phase, .invocationCount' || echo "No state";
done

# Check today's harvest stats
aws dynamodb scan --table-name leo-harvest-stats --output json | \
  jq -r '.Items[] | select(.timestamp.S >= "2025-12-11") | 
    "[\(.domain.S)] \(.status.S) - \(.listings_written.N // "?") written"'

# Clear all state files (nuclear option)
aws s3 rm s3://puedo-casa-html-archive/harvest/ --recursive --include "*-state.json"

# Re-invoke a harvester
aws lambda invoke --function-name tc-harvest-delta --invocation-type Event --payload '{}' /dev/null
```

---

## Related Documentation

- [P0-14-HARVESTING.md](./plans/P0-14-HARVESTING.md) - Main harvesting documentation
- [HARVESTER_PIPELINE.md](./HARVESTER_PIPELINE.md) - Pipeline overview
- [COORDINATE_PRECISION_IMPLEMENTATION.md](./COORDINATE_PRECISION_IMPLEMENTATION.md) - Coordinate verification details

---

*Last Updated: December 11, 2025*
