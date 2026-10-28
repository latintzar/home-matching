# API Response Schema & Token Limits Audit - 2025-01-27

## Overview
Comprehensive audit and fixes for all AI endpoint response schemas, syntax errors, and output token limits to ensure reliable JSON parsing and prevent truncation.

## Changes Made

### 1. Response Schema Enforcement

#### Unified Scope Endpoint (`/api/listings/[id]/renovation/unified-scope`)
- **Added**: Explicit JSON schema definition for renovation tiers
- **Schema**: Full tier structure with nested room items and cost estimates
- **Benefit**: Prevents malformed JSON responses from Gemini

#### Deep Dive Generation (`/api/listings/[id]/deepdive/generate-stream`)
- **Added**: `responseMimeType: 'application/json'` to renovation tier generation
- **Added**: `responseMimeType: 'application/json'` to consideraciones generation
- **Benefit**: Ensures consistent JSON output format

#### Text Analysis Helpers (`src/lib/text-analysis-helpers.ts`)
- **Added**: `responseMimeType: 'application/json'` to `callGeminiJSON` function
- **Impact**: All text analysis endpoints (B3, C) now enforce JSON output
- **Benefit**: Global consistency across all text analysis pipeline nodes

### 2. Max Output Token Limits

| Endpoint | Previous | Updated | Rationale |
|----------|----------|---------|-----------|
| Unified Scope | Default (32k) | **16,000** | Sufficient for detailed scopes, prevents over-allocation |
| Buyer Report | 65,535 | **65,535** | Confirmed appropriate (Gemini 3 Pro max) |
| Zero-Shot Clustering | 50,000 | **50,000** | Confirmed appropriate |
| Visibility Mapping | 65,535 | **65,535** | Confirmed appropriate |
| Deep Dive Generation | 8,192 | **8,192** | Confirmed appropriate for tier generation |
| Text Analysis (B3/C) | 8k/20k | **8k/20k** | Confirmed appropriate (Flash Lite/Flash) |

### 3. Syntax Error Fixes

#### Zero-Shot Clustering Route (`/api/listings/[id]/clusters/zero-shot/route.ts`)
- **Fixed**: Undefined variable `photos` on line 101
- **Change**: Replaced with `photoUrls.length` (correct variable from context)
- **Impact**: Prevents runtime errors in debug/test endpoint

### 4. Data Alignment (Previous Session)

#### Renovation Tier Hook (`src/hooks/useRenovationTiers.ts`)
- **Enhanced**: Robust cost extraction handling multiple schema formats
- **Supports**: 
  - Legacy `totals.total_cost_min/max`
  - New `total_estimate_range_eur` array
  - Unified-scope `total_price_estimated` single value
  - Alternative `total_estimate_eur` single value
- **Benefit**: UI components can handle data from any pipeline stage

## Testing Recommendations

1. **Test Unified Scope Generation**: Verify JSON schema compliance
2. **Test Deep Dive Generation**: Verify both renovation tiers and consideraciones return valid JSON
3. **Test Text Analysis Pipeline**: Verify B3 and C endpoints return parseable JSON
4. **Test Zero-Shot Clustering**: Verify no runtime errors in debug endpoint

## Files Modified

- `src/lib/text-analysis-helpers.ts` - Added JSON MIME type enforcement
- `src/app/api/listings/[id]/renovation/unified-scope/route.ts` - Added explicit schema
- `src/app/api/listings/[id]/deepdive/generate-stream/route.ts` - Added JSON MIME types
- `src/app/api/listings/[id]/clusters/zero-shot/route.ts` - Fixed undefined variable
- `src/hooks/useRenovationTiers.ts` - Enhanced schema compatibility (previous session)

## Impact

- ✅ **Reliability**: All AI endpoints now enforce JSON output, preventing parsing errors
- ✅ **Consistency**: Unified response format across all pipeline nodes
- ✅ **Robustness**: Token limits optimized to prevent truncation while avoiding waste
- ✅ **Debugging**: Fixed syntax errors that could cause runtime failures

## Related Documentation

- See `docs/ULTIMATE_PIPELINE.md` for complete pipeline architecture
- See `docs/PIPELINE_STATUS.md` for current pipeline status

