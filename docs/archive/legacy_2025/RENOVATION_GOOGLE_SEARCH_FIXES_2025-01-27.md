# Renovation Google Search Endpoint Fixes - January 27, 2025

## Overview
This document details the fixes and improvements made to the renovation Google search endpoint (`/api/listings/[id]/renovation-google-search`) to resolve JSON parsing errors, missing functions, type issues, and improve debugging capabilities.

## Changes Made

### 1. Increased Gemini maxOutputTokens (JSON Truncation Fix)
**Problem:** Gemini responses were being truncated, causing JSON parsing errors (`SyntaxError: Unterminated string in JSON`).

**Solution:** Increased `maxOutputTokens` from 2048 to 4096 in the domain credibility evaluation batch processing.

**Location:** `src/app/api/listings/[id]/renovation-google-search/route.ts` (line ~171)

**Impact:** Prevents JSON truncation when Gemini provides verbose reasoning for domain credibility evaluation.

### 2. Restored getCurationPrompt Function
**Problem:** `ReferenceError: getCurationPrompt is not defined` was occurring during curation.

**Solution:** Restored the `getCurationPrompt` helper function that generates category-specific prompts for Gemini curation.

**Location:** `src/app/api/listings/[id]/renovation-google-search/route.ts` (lines ~1220-1314)

**Functionality:**
- Generates prompts for work-item-specific and tier-wide curation
- Includes category-specific focus instructions (costs, timings, permits, etc.)
- Extracts metrics (low, high, unit) from search results
- Prioritizes reliable sources (Habitissimo, Leroy Merlin)

### 3. Fixed Type Issues
**Problem:** TypeScript errors related to `QueryData` type and missing `source` property.

**Solutions:**
- Added `source?: string` to `allQueryData` type definition
- Ensured `isWorkItemSpecific` is always boolean when pushing to `allQueryData`
- Removed unnecessary type casts
- Fixed variable scope issues (moved `allQueryData`, `domainCredibilityByKey`, `allSearchResults`, `insertData` to top-level scope)

**Location:** `src/app/api/listings/[id]/renovation-google-search/route.ts` (lines ~258-261, ~298-300, ~982-985)

### 4. Added Skip Mode for Faster Debugging
**Problem:** Full pipeline execution (queries → searches → scoring → curation) takes too long for debugging curation issues.

**Solution:** Added `skipSearches` parameter that skips steps 1-5 and goes directly to curation using existing search results from the database.

**Usage:**
```bash
curl -X POST http://localhost:3001/api/listings/1000000121/renovation-google-search \
  -H "Content-Type: application/json" \
  -H "X-Orchestrator-Context: true" \
  -d '{"skipSearches": true}' \
  --max-time 0
```

**Behavior:**
- Fetches existing search results from `renovation_search_results` table
- Builds `allQueryData` from tier×category combinations found in existing results
- Scores domains from existing results
- Runs curation only

**Location:** `src/app/api/listings/[id]/renovation-google-search/route.ts` (lines ~245-1296)

**Impact:** Reduces debugging time from ~850 seconds to ~120 seconds when testing curation logic.

### 5. Domain Credibility System Improvements
**Enhancements:**
- Direct function calls instead of HTTP fetch (prevents `ECONNREFUSED`/`ETIMEDOUT` errors)
- Title-based credibility scoring (considers search result titles for official sources)
- Primary/secondary source classification (high/medium-high vs medium/medium-low)
- Robust JSON parsing with retry logic and markdown stripping

**Location:** `src/app/api/listings/[id]/renovation-google-search/route.ts` (lines ~56-226)

## Related Changes

### Domain Credibility Endpoint
**File:** `src/app/api/research/domain-credibility/route.ts`
- Updated to accept optional `title` field in input schema
- Modified to use `scoreDomainWithTitle` instead of `scoreDomain`
- Enhanced Gemini evaluation prompt to consider titles

### Domain Scoring Library
**File:** `src/lib/cred/scoreDomain.ts`
- Added `PRIMARY_TITLE_KEYWORDS` array for detecting official sources
- Implemented `scoreDomainWithTitle` function that upgrades credibility based on title keywords

### Google Search Library
**File:** `src/lib/google-search.ts`
- Changed `MAX_RESULTS` from 100 to 10 (Google removed 100-result option)
- Updated all search functions to use `results=10` parameter
- Maintained concurrency cap of 5 concurrent queries

## Testing Results

### Skip Mode Test (Listing 1000000121)
- **Execution Time:** ~119 seconds (vs ~851 seconds for full run)
- **Domains Scored:** 439 unique domains
- **Domains Passed:** 398 domains (90.7% pass rate)
  - Primary: 159 domains (high/medium-high)
  - Secondary: 239 domains (medium/medium-low)
  - Filtered: 14 domains (low credibility)
- **Search Results Passed:** 2,801 results from 398 domains
- **Curation Completed:** 6 tier×category combinations

### Domain Credibility Breakdown
- High credibility: 2,026 results (72 domains)
- Medium-high credibility: 152 results (87 domains)
- Medium credibility: 292 results (130 domains)
- Medium-low credibility: 331 results (109 domains)
- Low credibility (filtered): 40 results (14 domains)

## Integration with Orchestrator

The endpoint is fully integrated with the post-F0 orchestrator (`orchestrate-d-to-r3`):

**Step J:** Renovation Google Search
- **Endpoint:** `/api/listings/${listingId}/renovation-google-search`
- **Headers:** `X-Orchestrator-Context: true` (for log streaming)
- **Response Format:**
  ```typescript
  {
    success: true,
    data: {
      searches_executed: number,
      results_saved: number,
      query_sets_generated: number,
      curations_completed: number,
      // ...
    }
  }
  ```

## Performance Improvements

1. **Concurrency Control:** 5 concurrent API calls prevents 429 rate limit errors
2. **Skip Mode:** 85% faster debugging (119s vs 851s)
3. **Direct Function Calls:** Eliminates network errors and improves reliability
4. **Batch Processing:** Processes domains in batches of 5 (reduced from 10) to prevent truncation

## Future Considerations

1. **Monitor maxOutputTokens:** If JSON truncation reoccurs, consider increasing to 8192 or implementing streaming responses
2. **Cache Optimization:** Domain credibility cache TTL could be optimized based on usage patterns
3. **Skip Mode Enhancement:** Could add `skipScoring` option to skip domain scoring and use cached scores only

## Files Modified

- `src/app/api/listings/[id]/renovation-google-search/route.ts` - Main endpoint fixes
- `src/app/api/research/domain-credibility/route.ts` - Title support added
- `src/lib/cred/scoreDomain.ts` - Title-based scoring added
- `src/lib/google-search.ts` - Results limit updated to 10

## Status

✅ **Ready for Production**
- All errors resolved
- Type issues fixed
- Skip mode tested and working
- Orchestrator integration verified
- Domain credibility system functioning correctly

