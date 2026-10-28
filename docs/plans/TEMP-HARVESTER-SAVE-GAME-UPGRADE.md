# Harvester "SAVE GAME" Upgrade Plan

## Overview

Upgrade all harvesters to match E&V's robust timeout and progress logging pattern:
- **14m 30s safe timeout** (instead of 13m)
- **Detailed "SAVE GAME" logging** on timeout with full progress status
- **Consistent memory logging** at checkpoints

## Reference: E&V Pattern (The Gold Standard)

```typescript
// Timeout constant
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s

// On timeout, log detailed progress:
console.log('════════════════════════════════════════════════════════════════');
console.log('💾 SAVE GAME - Discovery in progress');
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log(`   Listings discovered so far: ${totalDiscovered}`);
console.log(`   ScrapFly credits used: ${scrapflyCredits}`);
console.log('   Phase status:');
console.log(`      Discovery: ${discoveryStatus}`);
console.log(`      Enrichment: ${enrichmentStatus}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

---

## Harvester-by-Harvester Analysis

### 1. tc-harvest-delta.ts (Tecnocasa)

**Current State:**
- Timeout: `LAMBDA_TIMEOUT_BUFFER_MS = 2 * 60 * 1000` (13 minutes effective)
- Uses `getRemainingTime()` pattern (different from others)
- Single phase harvester (no multi-phase like C21)
- Basic state save on timeout

**Changes Required:**
```typescript
// REPLACE
const LAMBDA_TIMEOUT_BUFFER_MS = 2 * 60 * 1000;

// WITH  
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s
```

**SAVE GAME logging to add:**
```typescript
// On timeout, before saveState():
console.log('════════════════════════════════════════════════════════════════');
console.log('💾 SAVE GAME - Harvest in progress');
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log(`   URLs processed: ${state.processedUrls?.length || 0}/${state.allUrls?.length || 0}`);
console.log(`   New listings found: ${newListingsCount}`);
console.log(`   Written to DynamoDB: ${writtenToDynamo}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

**Complexity:** 🟡 Medium - Need to refactor timeout check from `getRemainingTime()` to time-based

---

### 2. c21-harvest-delta.ts (Century 21)

**Current State:**
- Timeout: `TIMEOUT_BUFFER_MS = 2 * 60 * 1000` (13 minutes effective)
- Multi-phase: `discovery → scraping → geocoding → removed_detection → complete`
- Basic state save on timeout per phase

**Changes Required:**
```typescript
// REPLACE
const TIMEOUT_BUFFER_MS = 2 * 60 * 1000;
const continueThreshold = lambdaTimeout - TIMEOUT_BUFFER_MS;

// WITH
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s
```

**SAVE GAME logging to add (per phase):**
```typescript
// On timeout in any phase:
console.log('════════════════════════════════════════════════════════════════');
console.log(`💾 SAVE GAME - ${state.phase} in progress`);
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log(`   Phase: ${state.phase}`);
console.log('   Progress:');
console.log(`      Sitemap URLs: ${state.allSitemapUrls.length}`);
console.log(`      Listings scraped: ${state.scrapedListingIds.length}`);
console.log(`      Geocoded: ${state.geocodedIds?.length || 0}`);
console.log(`      Written to DB: ${state.writtenToDynamo || 0}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

**Complexity:** 🟢 Low - Straightforward constant replacement + logging

---

### 3. lf-harvest-delta.ts (Lucas Fox)

**Current State:**
- Timeout: `TIMEOUT_BUFFER_MS = 2 * 60 * 1000` (13 minutes effective)
- Multi-phase: `scraping → geocoding → complete`
- Has self-continuation via Lambda invoke (needs removal for safety)

**Changes Required:**
```typescript
// REPLACE
const TIMEOUT_BUFFER_MS = 2 * 60 * 1000;
const continueThreshold = lambdaTimeout - TIMEOUT_BUFFER_MS; // 13 minutes

// WITH
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s
```

**SAVE GAME logging to add:**
```typescript
// On timeout:
console.log('════════════════════════════════════════════════════════════════');
console.log(`💾 SAVE GAME - ${state.phase} in progress`);
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log(`   Phase: ${state.phase}`);
console.log('   Progress:');
console.log(`      URLs to process: ${state.allUrls.length}`);
console.log(`      Scraped: ${state.scrapedUrls.length}`);
console.log(`      Geocoded: ${state.geocodedIds.length}`);
console.log(`      New listings: ${state.totalNewFound}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

**⚠️ ADDITIONAL:** Remove self-invocation code (Lambda recursive detection safety)

**Complexity:** 🟡 Medium - Need to also remove self-invocation pattern

---

### 4. dp-harvest-delta.ts (donpiso)

**Current State:**
- Timeout: `TIMEOUT_BUFFER_MS = 2 * 60 * 1000` (13 minutes effective)
- Simpler structure (discovery + scraping combined)
- Has self-continuation via Lambda invoke (needs removal)

**Changes Required:**
```typescript
// REPLACE
const TIMEOUT_BUFFER_MS = 2 * 60 * 1000;
const continueThreshold = lambdaTimeout - TIMEOUT_BUFFER_MS;

// WITH
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s
```

**SAVE GAME logging to add:**
```typescript
// On timeout:
console.log('════════════════════════════════════════════════════════════════');
console.log('💾 SAVE GAME - Harvest in progress');
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log('   Progress:');
console.log(`      List pages: ${state.lastListPageIndex}/${allListPages.length}`);
console.log(`      Listings discovered: ${state.allDiscoveredListingIds.length}`);
console.log(`      Processed: ${state.processedListingIds.length}`);
console.log(`      New in DB: ${newInDb}`);
console.log(`      Updated in DB: ${updatedInDb}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

**Complexity:** 🟡 Medium - Need to remove self-invocation pattern

---

### 5. remax-harvest-delta.ts (RE/MAX)

**Current State:**
- Timeout: `TIMEOUT_BUFFER_MS = 2 * 60 * 1000` (13 minutes effective)
- Multi-phase: `discovery → scraping → geocoding → removed_detection → complete`
- Already has self-invocation removed ✅
- Inline geocoding (no separate phase needed)

**Changes Required:**
```typescript
// REPLACE
const TIMEOUT_BUFFER_MS = 2 * 60 * 1000;
const continueThreshold = lambdaTimeout - TIMEOUT_BUFFER_MS;

// WITH
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s
```

**SAVE GAME logging to add:**
```typescript
// On timeout:
console.log('════════════════════════════════════════════════════════════════');
console.log(`💾 SAVE GAME - ${state.phase} in progress`);
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log(`   Phase: ${state.phase}`);
console.log('   Progress:');
console.log(`      Sitemap URLs: ${state.allSitemapUrls.length}`);
console.log(`      Scraped: ${state.scrapedIds.length}`);
console.log(`      Geocoded: ${state.geocodedCount}`);
console.log(`      Written to DB: ${state.writtenToDynamo}`);
console.log(`      New: ${state.newInDb}, Updated: ${state.updatedInDb}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

**Complexity:** 🟢 Low - Just timeout constant + logging

---

### 6. aproperties-harvest-delta.ts (aProperties)

**Current State:**
- Timeout: `TIMEOUT_BUFFER_MS = 2 * 60 * 1000` (13 minutes effective)
- Multi-phase: `discovery → scraping → geocoding → removed_detection → complete`
- Uses ScrapFly for Cloudflare bypass
- Has age-based filtering (rentals ≤14 days, sales ≤60 days)

**Changes Required:**
```typescript
// REPLACE
const TIMEOUT_BUFFER_MS = 2 * 60 * 1000;
const continueThreshold = lambdaTimeout - TIMEOUT_BUFFER_MS;

// WITH
const LAMBDA_SAFE_TIMEOUT_MS = 14.5 * 60 * 1000; // 14m 30s
```

**SAVE GAME logging to add:**
```typescript
// On timeout:
console.log('════════════════════════════════════════════════════════════════');
console.log(`💾 SAVE GAME - ${state.phase} in progress`);
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Invocation: ${state.invocationCount}/${MAX_INVOCATIONS}`);
console.log(`   Phase: ${state.phase}`);
console.log('   Progress:');
console.log(`      Sitemap URLs: ${state.allSitemapUrls.length}`);
console.log(`      Scraped: ${state.scrapedIds.length}`);
console.log(`      Geocoded: ${state.geocodedCount}`);
console.log(`      Written to DB: ${state.writtenToDynamo}`);
console.log(`      ScrapFly credits: ${state.scrapflyCredits || 0}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('   Next scheduled run will continue from here.');
console.log('════════════════════════════════════════════════════════════════');
logMemory('TIMEOUT_CHECKPOINT');
```

**Complexity:** 🟢 Low - Just timeout constant + logging

---

## Summary Table

| Harvester | Current Timeout | New Timeout | Self-Invocation | SAVE GAME | Complexity |
|-----------|-----------------|-------------|-----------------|-----------|------------|
| E&V | ✅ 14m 30s | N/A | ✅ Removed | ✅ Done | - |
| Tecnocasa | ❌ 13m | 14m 30s | N/A | ❌ Add | 🟡 Medium |
| Century 21 | ❌ 13m | 14m 30s | N/A | ❌ Add | 🟢 Low |
| Lucas Fox | ❌ 13m | 14m 30s | ⚠️ Remove | ❌ Add | 🟡 Medium |
| donpiso | ❌ 13m | 14m 30s | ⚠️ Remove | ❌ Add | 🟡 Medium |
| RE/MAX | ❌ 13m | 14m 30s | ✅ Removed | ❌ Add | 🟢 Low |
| aProperties | ❌ 13m | 14m 30s | ⚠️ Has it | ❌ Add | 🟢 Low |

---

## Implementation Order (Recommended)

1. **RE/MAX** - Simplest, no self-invocation to remove
2. **Century 21** - Straightforward, good multi-phase template
3. **aProperties** - Similar to C21, has ScrapFly tracking
4. **Tecnocasa** - Different timeout pattern, medium complexity
5. **donpiso** - Need to remove self-invocation
6. **Lucas Fox** - Need to remove self-invocation

---

## Shared Helper Function

Consider adding to `run-analytics.ts`:

```typescript
export function logSaveGame(
  phase: string,
  invocation: number,
  maxInvocations: number,
  progress: Record<string, string | number>
): void {
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

---

## Estimated Time

- Per harvester: 15-30 minutes
- Total: ~2-3 hours
- Testing: Run each harvester once to verify SAVE GAME output

---

## Success Criteria

After implementation, each harvester should:
1. ✅ Use 14m 30s timeout (not 13m)
2. ✅ Log detailed "SAVE GAME" block on timeout
3. ✅ Show invocation count, phase, and progress metrics
4. ✅ Call `logMemory('TIMEOUT_CHECKPOINT')` before saving state
5. ✅ Not use self-invocation (rely on scheduled runs)
6. ✅ Write run analytics to `leo-harvest-stats` on completion
