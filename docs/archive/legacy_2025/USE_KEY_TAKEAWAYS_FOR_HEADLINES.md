# Use key_takeaways for Headlines Instead of Separate Summary

**Date**: 2025-01-27  
**Summary**: Simplified headlines generation by using existing `key_takeaways` from integrated diagnostic report instead of generating a separate summary endpoint.

## Changes

### Why This Change

The integrated analysis report already includes a `key_takeaways` section with 5 supportive realism bullets. There's no need for a separate summary generation endpoint.

### What Changed

1. **Updated Diagnostic Analysis Prompt** (`src/lib/prompts/diagnostic-analysis.ts`)
   - Added stronger guidance for `key_takeaways` to use "supportive realism" tone
   - Specified structure: (1) what works, (2) verification needed, (3) opportunity, (4) realistic effort, (5) suitability
   - Added constraints: ≤140 characters, no marketing language, no exaggeration, no negativity

2. **Updated Results API** (`src/app/api/listings/[id]/text-analysis/results/route.ts`)
   - Now fetches `integrated_diagnostic` phase results
   - Maps `key_takeaways` to headlines (fallback to `integrated_summary.bullets` if needed)
   - Updated headline count logic

3. **Updated usePropertyDetailsData Hook** (`src/hooks/usePropertyDetailsData.ts`)
   - Now looks for `key_takeaways` from `integrated_diagnostic` phase
   - Falls back to `integrated_summary.bullets` if needed

4. **Removed Redundant Endpoint**
   - Deleted `src/app/api/listings/[id]/analysis/integrated-summary/route.ts`
   - No longer needed since we use key_takeaways directly

### Data Flow

```
Integrated Analysis Generation
  ↓
key_takeaways (5 bullets with supportive realism tone)
  ↓
PropertyDetails Component Headlines
```

### Benefits

- **Simpler architecture**: One source of truth (key_takeaways in integrated report)
- **Consistent tone**: Both integrated analysis and headlines use the same supportive realism approach
- **Less redundancy**: No need to regenerate what already exists
- **Better maintainability**: Single place to update the tone/style

### Usage

The headlines in PropertyDetails now display the `key_takeaways` from the integrated diagnostic report. These are 5 concise bullets (≤140 characters each) that follow the supportive realism tone.

**Tone Guidelines**:
- ✅ Calm, factual, encouraging
- ✅ "What's possible" rather than marketing fluff
- ✅ Empowering truth for buyers and agents
- ❌ No "amazing", "perfect", "bad" language
- ❌ No exaggeration or negativity

## Related Files

- `src/lib/prompts/diagnostic-analysis.ts` - Prompt with key_takeaways guidance
- `src/app/api/listings/[id]/text-analysis/results/route.ts` - Results API
- `src/hooks/usePropertyDetailsData.ts` - Hook that fetches headlines
- `src/components/PropertyDetails.tsx` - Component that displays headlines

## Migration

**No database changes needed**. The `key_takeaways` already exist in the `integrated_diagnostic` records.

**Existing data**: Any properties that already have `integrated_diagnostic` records will automatically start using `key_takeaways` for headlines. No re-generation needed.

