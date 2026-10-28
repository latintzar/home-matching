# Pipeline Parallelization Opportunities

**Goal:** Identify opportunities to parallelize the Basic Package Orchestrator to reduce total pipeline time.

**Current Pipeline Flow:**
```
A-C (Text Analysis) → Prerequisites Check → D (Zero-Shot Clustering) → 
Cadastre → Intelligence → F3 → RoomByRoom → G → SmartM2 → Baseline → BuyerReport → Qué Verificar
```

**Estimated Current Total Time:** ~5-7 minutes (depending on property size)

---

## 1. Pre-Visual Parallel Block ⚡ **HIGHEST IMPACT**

### Current Behavior
- Text Analysis (A-C) runs first (~30s)
- Then we check for photos and wait if needed
- Then Zero-Shot Clustering runs (~3-5 minutes)
- Then Cadastre, Intelligence, etc. run sequentially

### Opportunity
**Run all non-visual tasks in parallel** while photos are being uploaded/clustered.

### Proposed Flow
```typescript
// Phase 1: Text Analysis (Still first, as it's fast and provides context)
await runStep('A-C');

// Phase 2: Parallel Non-Visual Block (All run simultaneously)
await Promise.all([
  runStep('Cadastre'),      // Needs: Address, Coordinates (from autocomplete)
  runStep('Intelligence'),  // Needs: Coordinates (from autocomplete)
  runStep('G'),            // Needs: Address, Basic Info (from A-C)
  // Note: We can't run D (Clustering) here because it needs photos
]);

// Phase 3: Photo-Dependent Steps (Sequential, as they depend on D)
await runStep('D');         // Zero-Shot Clustering (needs photos)
await runStep('F3');        // Whole Property Analysis (needs clusters)
await runStep('RoomByRoom'); // Room-by-Room (needs clusters)

// Phase 4: Final Steps (Can be parallelized)
await Promise.all([
  runStep('SmartM2'),
  runStep('Baseline')
]);

// Phase 5: Buyer Report (depends on all previous steps)
await runStep('BuyerReport');
await runStep('QueVerificar');
```

### Dependencies Analysis
- **Cadastre:** Needs `address`, `coordinates` (from autocomplete), `claimedSize/Year` (from A-C B3 snippets)
- **Intelligence:** Needs `coordinates` (from autocomplete)
- **G (Google Search):** Needs `address`, basic property info (from A-C)
- **D (Clustering):** Needs `photos` (from background upload)

**Conclusion:** Cadastre, Intelligence, and G can all run in parallel after A-C completes, **before** photos are ready.

### Estimated Time Savings
- **Current:** A-C (30s) → Wait for Photos (0-30s) → D (3-5min) → Cadastre (3min) → Intelligence (10s) → G (2-3min) = **~9-12 minutes**
- **Parallel:** A-C (30s) → [Cadastre + Intelligence + G in parallel] (3min) → D (3-5min) → F3 + RoomByRoom = **~7-9 minutes**
- **Savings:** **~2-3 minutes** (20-25% reduction)

### Implementation Complexity
- **Low-Medium:** Just need to wrap steps in `Promise.all()`
- **Risk:** Low (steps are independent)
- **Considerations:** 
  - Ensure error handling doesn't break the entire block
  - Logging needs to be thread-safe (already handled via SSE)

---

## 2. Parallel Photo Analysis Steps ⚡ **MEDIUM IMPACT** ✅ **CONFIRMED FEASIBLE**

### Current Behavior
- F3 (Whole Property Analysis) runs first (~20-30s)
- Then RoomByRoom runs (~1-2 minutes)
- Both run sequentially even though they're independent

### Opportunity
**Run F3 and RoomByRoom in parallel** - they're completely independent!

### Proposed Flow
```typescript
// After Clustering (D) completes
await Promise.all([
  runStep('F3'),          // Uses: All valid photos (general property condition)
  runStep('RoomByRoom')   // Uses: Clustered photos (specific room details + allocentric layouts)
]);

// Both must complete before G (G needs RoomByRoom's allocentric layouts)
await runStep('G');
```

### Dependencies Analysis
- **F3:**
  - Reads: `text_analysis_results` (a_facts), `listings`, `listing_photos`
  - Writes: `whole_property_analysis`
  - Needs: Clusters exist (for filtering excluded photos)
  
- **RoomByRoom:**
  - Reads: `listings`, `clusters` (normalized)
  - Writes: `room_analyses` (includes allocentric layouts)
  - Needs: Clusters exist
  
- **G:**
  - Needs: RoomByRoom's allocentric layouts (from `room_analyses.layout_allocentric`)
  - Doesn't need: F3's whole-property analysis (optional enhancement)

**Conclusion:** F3 and RoomByRoom are **completely independent** - they read different tables, write different tables, and process different aspects. They can run simultaneously. G needs RoomByRoom's outputs, but that's fine - both complete before G runs.

### Estimated Time Savings
- **Current:** F3 (30s) + RoomByRoom (90s) = **~2 minutes sequential**
- **Parallel:** max(F3, RoomByRoom) = **~90 seconds**
- **Savings:** **~30 seconds** (25% reduction)

### Implementation Complexity
- **Low:** Simple `Promise.all()` wrapper
- **Risk:** Medium (Higher token usage spike - both calling Gemini simultaneously)
- **Considerations:**
  - Monitor token usage (both steps use image models)
  - May hit rate limits if running simultaneously
  - Consider adding a small delay between starts (100-200ms) to avoid API throttling
  - Both must complete before G runs (G needs RoomByRoom's allocentric layouts)

---

## 3. Room-by-Room Internal Concurrency ⚡ **HIGH IMPACT** (Within Endpoint)

### Current Behavior
Inside `/api/listings/[id]/photo-analysis/room-by-room`, we iterate through clusters sequentially:
```typescript
for (const cluster of clusters) {
  await analyzeRoom(cluster); // ~15-20s per room
}
```

### Opportunity
**Process multiple rooms concurrently** with a concurrency limit.

### Proposed Flow
```typescript
// Inside room-by-room endpoint
const clusters = await getClusters(listingId);
const concurrencyLimit = 3; // Process 3 rooms at a time

const results = [];
for (let i = 0; i < clusters.length; i += concurrencyLimit) {
  const batch = clusters.slice(i, i + concurrencyLimit);
  const batchResults = await Promise.all(
    batch.map(cluster => analyzeRoom(cluster))
  );
  results.push(...batchResults);
}
```

### Dependencies Analysis
- Each room analysis is independent
- No shared state between rooms
- Only constraint: API rate limits

**Conclusion:** Perfect candidate for concurrency.

### Estimated Time Savings
- **Current:** 5 rooms × 20s = **100 seconds sequential**
- **Parallel (3x):** (5 rooms / 3) × 20s = **~40 seconds**
- **Savings:** **~60 seconds** (60% reduction for large properties)

### Implementation Complexity
- **Medium:** Need to modify the endpoint logic
- **Risk:** Medium (Rate limits, token usage spikes)
- **Considerations:**
  - Add concurrency limit (start with 2-3)
  - Monitor API errors and back off if rate limited
  - Consider exponential backoff for retries

---

## 4. Text Analysis Micro-Parallelism ⚡ **LOW IMPACT**

### Current Behavior
- A (Facts) → B1 (Categorization) → B2 (Merge) → B3 (Snippets) → C (Unknowns)

### Opportunity
**A and B1 can run in parallel** since they both analyze raw text independently.

### Proposed Flow
```typescript
// A and B1 are independent
const [aResult, b1Result] = await Promise.all([
  callEndpoint('A'),
  callEndpoint('B1')
]);

// B2 needs B1, so sequential
await callEndpoint('B2');

// B3 needs B2, so sequential
await callEndpoint('B3');

// C needs B3, so sequential
await callEndpoint('C');
```

### Dependencies Analysis
- **A (Facts):** Raw text → Structured facts
- **B1 (Categorization):** Raw text → Categories
- **B2 (Merge):** B1 results → Merged categories
- **B3 (Snippets):** B2 results → Snippets
- **C (Unknowns):** B3 results → Unknowns checklist

**Conclusion:** Only A and B1 can be parallelized.

### Estimated Time Savings
- **Current:** A (18s) + B1 (4s) = **22 seconds sequential**
- **Parallel:** max(A, B1) = **~18 seconds**
- **Savings:** **~4 seconds** (18% reduction)

### Implementation Complexity
- **Low:** Simple `Promise.all()` wrapper
- **Risk:** Low (both are text-only, no rate limit concerns)
- **Considerations:** Minimal - very safe change

---

## 5. Final Steps Parallel Block ⚡ **LOW-MEDIUM IMPACT**

### Current Behavior
- SmartM2 → Baseline → BuyerReport → Qué Verificar (all sequential)

### Opportunity
**SmartM2 and Baseline can run in parallel** since they're independent cost estimation steps.

### Proposed Flow
```typescript
// After RoomByRoom completes
await Promise.all([
  runStep('SmartM2'),   // M2 inference (needs: property data, cadastre)
  runStep('Baseline')   // Habitissimo costing (needs: property data)
]);

// BuyerReport depends on both, so sequential
await runStep('BuyerReport');
await runStep('QueVerificar');
```

### Dependencies Analysis
- **SmartM2:** Needs property data, cadastre data (for official size)
- **Baseline:** Needs property data, renovation scope
- **BuyerReport:** Needs SmartM2, Baseline, RoomByRoom, G, Cadastre

**Conclusion:** SmartM2 and Baseline are independent and can run together.

### Estimated Time Savings
- **Current:** SmartM2 (10s) + Baseline (15s) = **25 seconds sequential**
- **Parallel:** max(SmartM2, Baseline) = **~15 seconds**
- **Savings:** **~10 seconds** (40% reduction)

### Implementation Complexity
- **Low:** Simple `Promise.all()` wrapper
- **Risk:** Low (both are independent API calls)
- **Considerations:** Minimal

---

## 6. A and B1 Parallel Execution ⚡ **MEDIUM IMPACT** (NEW)

### Current Behavior
- A (Facts Extraction) runs first (~18s)
- Then B1 (Categorization) runs (~4s)

### Opportunity
**A and B1 can run in parallel** since they both read from the same source (`scraped_data`) independently.

### Proposed Flow
```typescript
// A and B1 both read from scraped_data independently
const [aResult, b1Result] = await Promise.all([
  callEndpoint('A'),   // Reads scraped_data, extracts facts
  callEndpoint('B1')    // Reads scraped_data, categorizes (but wait...)
]);

// Actually, B1 needs A results! Let me check...
```

### Dependencies Analysis
**CRITICAL DISCOVERY:** After reviewing the code:
- **A:** Reads `scraped_data` → Extracts claims → Writes to `text_analysis_results` (phase: `a_facts`)
- **B1:** Reads `text_analysis_results` (phase: `a_facts`) → Categorizes claims → Writes to `text_analysis_results` (phase: `b1_categorization`)

**Conclusion:** B1 **depends on A's output**, so they cannot run in parallel. However, B1 is **already internally parallelized** - it processes each claim in parallel (see `b1-categorization/route.ts` line 31-43).

**Status:** ❌ **Not feasible** - B1 requires A's results.

---

## 7. G (Google Search) Category Curation Parallelization ⚡ **MEDIUM IMPACT** (NEW)

### Current Behavior
Inside the G endpoint, after searches complete, categories are curated sequentially:
```typescript
for (const category of categories) {
  await curateCategory(category, snippets);
}
```

### Opportunity
**Curate multiple categories in parallel** with a concurrency limit.

### Proposed Flow
```typescript
// Inside G endpoint, after search execution
const categories = [...]; // 8 mega-categories
const curationResults = await limitConcurrency(
  categories,
  3, // Process 3 categories at a time
  (category) => curateCategory(category, snippets, maxSnippets, propertyData, logger)
);
```

### Dependencies Analysis
- Each category curation is independent
- Uses Gemini for summarization (rate limits apply)
- No shared state between categories

**Conclusion:** Perfect candidate for concurrency.

### Estimated Time Savings
- **Current:** 8 categories × 10s = **80 seconds sequential**
- **Parallel (3x):** (8 categories / 3) × 10s = **~27 seconds**
- **Savings:** **~53 seconds** (66% reduction)

### Implementation Complexity
- **Medium:** Need to add concurrency limiter (similar to Barrel B)
- **Risk:** Medium (Gemini rate limits, token usage spike)
- **Considerations:**
  - Use existing `limitConcurrency` helper from G endpoint
  - Monitor for rate limit errors
  - Consider 2-3 concurrent categories (not 8)

---

## 8. G Can Run Earlier + Photo Guidance Enhancement ⚡ **HIGHEST IMPACT** (REFINED)

### Current Behavior
- G runs **after** RoomByRoom completes
- But G only needs: A-C (B3 snippets, C unknowns), Cadastre (optional), Address
- Photo analysis (F3, RoomByRoom) runs **blind** - doesn't know what to look for

### The Problem
If G runs early and discovers things (e.g., "This area has high humidity issues"), photo analysis should specifically look for those things (e.g., "Signs of moisture damage, mold, water stains"). Currently, photo analysis runs blind.

### Opportunity (Two-Part)
1. **Move G to run early** (before photo analysis)
2. **Extract "Photo Analysis Guidance" from G's curated results** and feed to F3/RoomByRoom

### Proposed Flow
```typescript
// After A-C completes
await Promise.all([
  runStep('Cadastre'),
  runStep('Intelligence'),
  runStep('G')  // MOVED UP - generates curated results
]);

// Extract Photo Guidance from G's curated results
const photoGuidance = await generatePhotoGuidance(listingId); // NEW ENDPOINT

// Then photo-dependent steps (now with guidance)
await runStep('D');
await runStep('F3', { photoGuidance });  // Pass guidance to prompt
await runStep('RoomByRoom', { photoGuidance });  // Pass guidance to prompt
```

### Photo Guidance Structure
```typescript
interface PhotoAnalysisGuidance {
  general_focus_areas: string[];  // e.g., ["Check for humidity damage", "Look for structural cracks"]
  category_specific_checks: {
    [category: string]: {
      what_to_look_for: string[];
      why_important: string;
      confidence: 'high' | 'medium' | 'low';
    };
  };
  risk_flags: string[];  // Things discovered in G that need visual verification
}
```

### Implementation Options

#### Option A: New Endpoint (Cleaner)
```typescript
// POST /api/listings/[id]/photo-guidance/generate
// Reads analysis_curated_results, generates guidance JSON
// Returns PhotoAnalysisGuidance
```

#### Option B: Pass G Results Directly (Simpler)
```typescript
// Modify F3 and RoomByRoom endpoints to:
// 1. Read analysis_curated_results if available
// 2. Extract guidance inline
// 3. Append to prompt
```

### Dependencies Analysis
- **G needs:** B3 snippets, C unknowns, Cadastre (optional), Address
- **G doesn't need:** Photo analysis (F3, RoomByRoom)
- **Photo analysis CAN benefit from:** G's curated results (what to look for)
- **Current position:** After RoomByRoom (unnecessary wait + missed opportunity)

**Conclusion:** G should run early AND provide guidance to photo analysis.

### Estimated Time Savings
- **Current:** G waits for D + F3 + RoomByRoom = **~5-7 minutes** before starting
- **Early:** G runs immediately after A-C = **starts ~30 seconds** into pipeline
- **Savings:** **~5-7 minutes** of wait time eliminated
- **Bonus:** Photo analysis becomes more targeted and intelligent (better results)

### Implementation Complexity
- **Medium:** 
  1. Move G step to earlier parallel block (easy)
  2. Create photo guidance extraction logic (medium)
  3. Modify F3/RoomByRoom prompts to accept guidance (medium)
- **Risk:** Low-Medium (need to ensure guidance doesn't bias photo analysis incorrectly)
- **Considerations:**
  - Guidance should be **suggestions**, not requirements
  - Photo analysis should still report what it sees, not what G expects
  - Guidance should enhance, not replace, visual analysis
  - Consider confidence levels - only high-confidence guidance should be emphasized
  - Example: If G finds "high humidity area", guidance says "Pay special attention to moisture indicators" but photo analysis still reports objectively

---

## 9. Zero-Shot Clustering Streaming Optimization ⚡ **LOW IMPACT** (NEW)

### Current Behavior
- Step 1: Zero-shot clustering runs (~3-5 minutes)
- Step 2: Visibility mapping runs (~30s-1min) - waits for clustering to complete

### Opportunity
**If Gemini streaming supports it**, visibility mapping could start processing clusters as they're generated (streaming).

### Proposed Flow
```typescript
// Theoretical streaming approach (if Gemini API supports it)
const clusteringStream = runZeroShotGemini3Streaming(listingId);
const visibilityStream = runVisibilityGemini3Streaming(listingId);

// Process clusters as they arrive
for await (const cluster of clusteringStream) {
  visibilityStream.processCluster(cluster);
}
```

### Dependencies Analysis
- **Visibility mapping:** Needs complete cluster list (all photo indices assigned)
- **Current API:** Gemini returns complete JSON, not streaming clusters
- **Feasibility:** Would require Gemini API changes or custom streaming parser

**Conclusion:** ❌ **Not feasible** with current Gemini API - it returns complete JSON, not incremental clusters.

**Status:** Future optimization if Gemini adds streaming cluster support.

---

## 10. Room Bullets Can Run Earlier ⚡ **LOW IMPACT** (NEW)

### Current Behavior
- RoomByRoom completes (~90s)
- Then Room Bullets runs (~10s) - sequential

### Opportunity
**Room Bullets could potentially run in parallel with another step** since it only needs RoomByRoom results.

### Proposed Flow
```typescript
// After RoomByRoom completes
await Promise.all([
  runStep('RoomBullets'),  // Needs RoomByRoom results
  runStep('G')            // If G wasn't moved earlier
]);
```

### Dependencies Analysis
- **Room Bullets:** Needs RoomByRoom analysis results
- **G:** Doesn't need Room Bullets

**Conclusion:** Room Bullets could run in parallel with G (if G wasn't moved earlier), but the time savings are minimal (~10s).

### Estimated Time Savings
- **Current:** Room Bullets (10s) sequential
- **Parallel with G:** 0s (G already running)
- **Savings:** **~10 seconds** (only if G wasn't moved earlier)

### Implementation Complexity
- **Low:** Simple parallel wrapper
- **Risk:** Low
- **Considerations:** Minimal benefit if G is moved earlier (see #8)

---

## Summary Table

| Opportunity | Time Saved | Complexity | Risk | Priority |
|------------|------------|------------|------|----------|
| **1. Pre-Visual Parallel Block** | 2-3 min | Low-Medium | Low | 🔥 **HIGHEST** |
| **8. G Can Run Earlier** | 5-7 min wait eliminated | Low | Low | 🔥 **HIGHEST** |
| **3. Room-by-Room Concurrency** | 60s (large props) | Medium | Medium | ⚡ High |
| **7. G Category Curation Parallel** | 53s | Medium | Medium | ⚡ High |
| **2. Parallel F3 + RoomByRoom** | 30s | Low | Medium | ⚡ Medium |
| **5. Final Steps Parallel** | 10s | Low | Low | 📝 Low |
| **10. Room Bullets Parallel** | 10s | Low | Low | 📝 Low |
| **4. Text Analysis Micro-Parallel** | ❌ Not feasible (B1 needs A) | - | - | ❌ Cancelled |
| **6. A and B1 Parallel** | ❌ Not feasible (B1 needs A) | - | - | ❌ Cancelled |
| **9. Zero-Shot Streaming** | ❌ Not feasible (API limitation) | - | - | ❌ Future |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Low Risk, High Value)
1. ✅ **#1: Pre-Visual Parallel Block** - Biggest impact, complements background photo upload
2. ✅ **#8: G Can Run Earlier** - Eliminates 5-7 minute wait, G doesn't need photo analysis
3. ✅ **#5: Final Steps Parallel** - Easy, safe, immediate benefit

### Phase 2: Medium Risk (Monitor Closely)
4. ⚠️ **#3: Room-by-Room Concurrency** - Already implemented! (5 concurrent) - Verify it's working optimally
5. ⚠️ **#7: G Category Curation Parallel** - High impact (53s saved), needs rate limit monitoring
6. ⚠️ **#2: Parallel F3 + RoomByRoom** - Medium impact, watch token usage

### Phase 3: Micro-Optimizations (Nice to Have)
7. 📝 **#10: Room Bullets Parallel** - Small gain (~10s), only if G wasn't moved earlier

---

## Implementation Notes

### Error Handling Strategy
- Use `Promise.allSettled()` instead of `Promise.all()` for parallel blocks
- Log which steps succeeded/failed
- Continue pipeline if non-critical steps fail (e.g., Intelligence can fail, but BuyerReport should still run)

### Rate Limiting Considerations
- Monitor Gemini API rate limits (especially for image models)
- Consider adding delays between parallel starts (100-200ms stagger)
- Implement exponential backoff for retries

### Token Usage Monitoring
- Parallel steps = higher concurrent token usage
- Monitor costs closely during initial rollout
- Consider implementing a token budget per pipeline run

### Testing Strategy
1. Test with small properties (1-2 rooms) first
2. Test with large properties (5+ rooms) to verify concurrency limits
3. Monitor error rates and API response times
4. Compare total pipeline time before/after

---

## Expected Overall Impact

**Current Pipeline Time:** ~5-7 minutes  
**With All Optimizations:** ~2-3 minutes  
**Total Time Savings:** **~3-4 minutes (60-70% reduction)**

### Key Discoveries

1. **G (Google Search) is massively over-delayed** - It runs after photo analysis but only needs A-C. Moving it earlier eliminates 5-7 minutes of unnecessary wait time.

2. **Room-by-Room is already optimized** - The endpoint already processes rooms in parallel (5 concurrent). Verify this is working correctly.

3. **G's internal curation can be parallelized** - Currently sequential, could save ~53 seconds with 3x concurrency.

4. **A and B1 cannot be parallelized** - B1 depends on A's output. However, B1 is already internally parallelized (processes each claim in parallel).

**Most Critical:** 
- **#8: G Can Run Earlier + Photo Guidance** - Eliminates biggest bottleneck (5-7 min wait) AND makes photo analysis more intelligent
- **#1: Pre-Visual Parallel Block** - Complements G move and saves additional 2-3 minutes

**Key Insight:** Moving G early isn't just about speed - it enables **intelligent photo analysis** that knows what to look for based on research findings. This is a **quality AND speed improvement**.

---

## 11. Buyer Report Database Queries Parallelization ⚡ **MEDIUM IMPACT** (NEW - Internal)

### Current Behavior
Buyer Report endpoint makes **7 sequential database queries**:
1. Text analysis results (b3_snippets, c_unknowns, cadastral_data, smart_m2, baseline_check)
2. Whole property analysis
3. Room analyses
4. Curated research
5. Room bullets
6. Listing metadata (with fallback logic)
7. Clusters

### Opportunity
**All 7 queries are independent** - they can run in parallel!

### Proposed Flow
```typescript
// Inside final-scope/route.ts - STEP 1
const [
  textResults,
  wholePropertyData,
  roomAnalysesData,
  curatedResearch,
  roomBulletsData,
  listingNumeric,
  clusters
] = await Promise.all([
  supabase.from('text_analysis_results').select(...).in('phase', [...]),
  supabase.from('whole_property_analysis').select(...).eq('listing_id', listingId).single(),
  supabase.from('room_analyses').select(...).eq('listing_id', listingId).single(),
  supabase.from('analysis_curated_results').select(...).eq('listing_id', listingId),
  supabase.from('room_bullets').select(...).eq('listing_id', listingId).single(),
  supabase.from('listings').select(...).eq('id', listingIdNum).maybeSingle(),
  supabase.from('clusters').select(...).eq('listing_id', listingIdNum).order(...)
]);
```

### Dependencies Analysis
- All queries are independent (no shared state)
- Listing metadata has fallback logic (numeric → string ID), but we can handle both in parallel
- No cross-dependencies between queries

**Conclusion:** Perfect candidate for parallelization.

### Estimated Time Savings
- **Current:** 7 queries × ~50ms = **~350ms sequential**
- **Parallel:** max(all queries) = **~50-100ms** (network overhead)
- **Savings:** **~250-300ms** (70-85% reduction)

### Implementation Complexity
- **Low:** Simple `Promise.all()` wrapper
- **Risk:** Low (all queries are independent)
- **Considerations:**
  - Handle listing metadata fallback (try both numeric and string ID in parallel)
  - Error handling: Use `Promise.allSettled()` if some queries can fail gracefully

---

## 12. Cadastre Endpoint Database Queries Parallelization ⚡ **LOW IMPACT** (NEW - Internal)

### Current Behavior
Cadastre endpoint makes **2 sequential database queries**:
1. Fetch listing (line 35)
2. Fetch textResults/B3 snippets (line 45)

### Opportunity
**Both queries are independent** - they can run in parallel!

### Proposed Flow
```typescript
// Inside cadastre/route.ts
const [listing, textResults] = await Promise.all([
  supabase.from('listings').select(...).eq('id', String(listingId)).single(),
  supabase.from('text_analysis_results').select(...).eq('listing_id', listingId).eq('phase', 'b3_snippets').single()
]);
```

### Dependencies Analysis
- Listing query: Independent
- TextResults query: Independent (only needs listingId)
- No cross-dependencies

**Conclusion:** Simple parallelization opportunity.

### Estimated Time Savings
- **Current:** 2 queries × ~50ms = **~100ms sequential**
- **Parallel:** max(both queries) = **~50ms**
- **Savings:** **~50ms** (50% reduction)

### Implementation Complexity
- **Very Low:** Simple `Promise.all()` wrapper
- **Risk:** Very Low
- **Considerations:** Minimal

---

## 13. Cadastre Analyzer Level 1-2 Parallelization ⚡ **LOW-MEDIUM IMPACT** (NEW - Internal)

### Current Behavior
Cadastre Analyzer runs Level 1 (Neighborhood) and Level 2 (Block) sequentially:
1. Level 1: Sample neighborhood (line 27)
2. Level 2: Sample block (line 53)

### Opportunity
**Level 1 and Level 2 are independent** - they can run in parallel!

### Proposed Flow
```typescript
// Inside cadastre/analyzer.ts
const [hoodProfile, blockProfile] = await Promise.all([
  this.sampler.sampleArea('neighborhood', listing.address),
  this.sampler.sampleArea('block', street, number)
]);
```

### Dependencies Analysis
- Level 1: Needs address only
- Level 2: Needs address (parsed for street/number)
- Both are independent sampling operations
- Level 2 uses Level 1 results for trend calculation, but that's just comparison logic (can happen after both complete)

**Conclusion:** Can run in parallel, then compare results.

### Estimated Time Savings
- **Current:** Level 1 (~2s) + Level 2 (~2s) = **~4 seconds sequential**
- **Parallel:** max(Level 1, Level 2) = **~2 seconds**
- **Savings:** **~2 seconds** (50% reduction)

### Implementation Complexity
- **Low:** Simple `Promise.all()` wrapper
- **Risk:** Low
- **Considerations:**
  - Trend calculation (line 57-60) happens after both complete, which is fine
  - Both operations are independent API calls to Cadastre

---

## Summary of Internal Parallelization Opportunities

| Opportunity | Time Saved | Complexity | Risk | Priority |
|------------|------------|------------|------|----------|
| **11. Buyer Report DB Queries** | 250-300ms | Low | Low | ⚡ Medium |
| **12. Cadastre DB Queries** | 50ms | Very Low | Very Low | 📝 Low |
| **13. Cadastre Level 1-2** | 2s | Low | Low | ⚡ Medium |

**Total Internal Savings:** ~2.3-2.35 seconds per pipeline run

---

## Already Optimized (No Action Needed) ✅

### Internal Parallelization Already Implemented

1. **B1 (Categorization)** - ✅ Processes each claim in parallel (see `b1-categorization/route.ts` line 31-43)
2. **RoomByRoom** - ✅ Processes rooms in parallel with 5x concurrency (see `room-by-room/route.ts` line 144)
3. **G (Google Search)** - ✅ Barrel B queries run in parallel (8 concurrent) (see `analysis-google-search/route.ts` line 708)
4. **G (Google Search)** - ✅ Google searches execute in parallel via `executeMultipleSearches` (line 744)
5. **Intelligence Suite** - ✅ All 4 modules run in parallel (Social, Visual, Tender, Geology) (see `intelligence/orchestrator.ts` line 26-31)
6. **SmartM2 & Baseline** - ✅ Already parallelized in orchestrator (line 664)

### Current Parallel Blocks in Orchestrator

- ✅ **B3 & C** - Already parallelized (line 390)
- ✅ **Cadastre & Intelligence** - Already parallelized (line 547)
- ✅ **SmartM2 & Baseline** - Already parallelized (line 664)

**Note:** The orchestrator already has some parallelization! The main opportunities are:
1. Moving G earlier (biggest win)
2. Adding G to the pre-visual parallel block
3. Parallelizing G's internal category curation
4. Parallelizing F3 + RoomByRoom (if token limits allow)

