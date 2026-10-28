# G Endpoint Performance Analysis

## Current Performance Issues

### 1. Batch Amounts Confusion
**Issue**: Batch numbers in logs can be confusing because:
- The calculation `batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urls.length / BATCH_SIZE)}` is correct
- But if there are retries or different stages, the total count might appear to change
- The logging format doesn't clearly show progress

**Current Log Format**:
```
🔍 Fetching credibility for batch 1/5 (100 URLs)...
🔍 Fetching credibility for batch 2/5 (100 URLs)...
```

**Problem**: If the total number of URLs changes between stages, or if there are retries, the denominator might change, causing confusion.

### 2. Why It's Slow

**Current Sequential Bottlenecks**:

1. **Query Generation (Step 2)**: 15 sequential Gemini API calls
   - One call per category (15 categories)
   - Each call takes ~1-2 seconds
   - **Total: ~15-30 seconds** (could be ~3-5 seconds with parallelization)

2. **Google Searches (Step 3)**: Scrapingdog API with 5 concurrent
   - Already optimized with concurrency limiter
   - **Total: Depends on number of queries** (reasonable)

3. **Domain Credibility (Step 5)**: Sequential batches of 100 URLs
   - Necessary due to API limits (max 100 per request)
   - Each batch takes ~2-5 seconds
   - **Total: Depends on number of URLs** (could be improved with parallel batches)

4. **Curation (Step 7)**: Sequential Gemini API calls
   - One call per category (up to 15 categories)
   - Each call takes ~1-2 seconds
   - **Total: ~15-30 seconds** (could be ~3-5 seconds with parallelization)

**Total Sequential Time**: ~30-60 seconds just for Gemini calls (query generation + curation)

### 3. What We're Using

- **Scrapingdog API**: For Google searches (5 concurrent queries)
- **Gemini 2.5 Flash**: For query generation and curation
- **Domain Credibility Endpoint**: Batched processing (100 URLs per batch)

## Implemented Improvements ✅

### 1. ✅ Fixed Batch Logging Clarity
- Stores total batch count upfront (`totalBatches` calculated before loop)
- Shows concurrent processing information
- Clearer progress indicators with consistent batch numbers
- **Fix**: Batch count inconsistency (/12 vs /13) resolved by calculating total upfront

### 2. ✅ Parallelized Query Generation
- Uses `limitConcurrency` utility (8 concurrent categories)
- **Speedup**: 15-30s → ~3-5s (3-6x faster)

### 3. ✅ Parallelized Curation
- Uses `limitConcurrency` utility (8 concurrent categories)
- **Speedup**: 15-30s → ~3-5s (3-6x faster)

### 4. ✅ Parallelized Domain Credibility Batches
- Processes 5 batches concurrently
- Improved batch logging with upfront total count
- **Speedup**: Depends on number of batches (2-5x faster for large batches)

## Expected Overall Speedup

**Before**: ~60-90 seconds total
**After**: ~20-30 seconds total
**Speedup**: **2-3x faster** ✅

## Implementation Details

1. **Query Generation**: 8 concurrent Gemini API calls (was sequential)
2. **Curation**: 8 concurrent Gemini API calls (was sequential)
3. **Domain Credibility**: 5 concurrent batches (was sequential)
4. **Google Searches**: Already parallelized (5 concurrent, unchanged)

## Concurrency Limits

- **Query Generation**: 8 concurrent (safe for Gemini API)
- **Curation**: 8 concurrent (safe for Gemini API)
- **Domain Credibility**: 5 concurrent batches (respects API limits)
- **Google Searches**: 5 concurrent (unchanged, Scrapingdog API)

## Batch Count Fix

**Problem**: Batch numbers were inconsistent (e.g., `/12` vs `/13`) because `Math.ceil(urls.length / BATCH_SIZE)` was recalculated in each log message.

**Solution**: Calculate `totalBatches` upfront before the loop and use that fixed value in all log messages. This ensures consistent batch numbering throughout processing.

