# Integrated Summary Update

**Date**: 2025-01-27  
**Summary**: Removed b4_headlines phase and replaced with integrated_summary, updated UI to show cluster names in photo gallery.

## Changes

### 1. Removed b4_headlines Phase

The old `b4_headlines` phase has been completely removed from the pipeline. The new **Integrated Summary** (from `integrated_summary` phase) replaces it with a better 5-bullet summary generated from the full Integrated Analysis report.

**Files Deleted**:
- `src/app/api/listings/[id]/text-analysis/b4-headlines/route.ts`

**Files Updated**:
- `src/app/api/listings/[id]/text-analysis/results/route.ts` - Now fetches `integrated_summary` instead of `b4_headlines`
- `src/app/api/listings/[id]/deepdive/generate-stream/route.ts` - Uses `integrated_summary` for summaries
- `src/app/api/listings/[id]/analysis/route.ts` - Queries `integrated_summary` phase
- `src/hooks/usePropertyDetailsData.ts` - Uses integrated_summary bullets

### 2. Removed "Detalles" Dropdown Section

The old details dropdown section in PropertyDetails component has been removed to simplify the UI. Users now access the full Integrated Analysis via the "Ver Análisis Completo" button.

**Files Updated**:
- `src/components/PropertyDetails.tsx` - Removed entire detalles section

### 3. Photo Gallery Cluster Names

The photo gallery modal now displays cluster names (e.g., "Living Room", "Kitchen") instead of "Photo 1 of 29" when photos are clustered.

**How It Works**:
1. Results API fetches `manual_photo_clusters` from Supabase
2. Creates a map of photo URL → cluster name
3. Applies cluster name to photo `tag` property
4. PhotoGalleryModal displays the tag if available, otherwise falls back to "Photo X of Y"

**Files Updated**:
- `src/components/PhotoGalleryModal.tsx` - Shows cluster name from photo tag
- `src/app/api/listings/[id]/text-analysis/results/route.ts` - Joins clusters and maps names to photos

### 4. Integrated Summary Specifications

The new integrated_summary endpoint generates 5 concise, Spanish bullet points (≤140 characters each) from the full Integrated Analysis report. 

**Features**:
- Non-redundant bullets (each adds unique value)
- 1 bullet per topic: location/concept, works well, verification needed, effort reality, suitability
- Supportive realism tone (calm, factual, encouraging)
- No marketing language or exaggeration

**Files**:
- `src/app/api/listings/[id]/analysis/integrated-summary/route.ts`
- `src/lib/prompts/diagnostic-analysis.ts` - DIAGNOSTIC_SUMMARY_PROMPT

## Migration Path

**Database**: No schema changes needed. The `b4_headlines` records in `text_analysis_results` are simply not used anymore.

**Existing data**: Existing b4_headlines data will not be displayed. New analyses will use integrated_summary only.

## Testing

1. Open PropertyDetails page for a listing
2. Check headlines section shows 5 bullet points from integrated_summary (not b4_headlines)
3. Open photo gallery - should show cluster names instead of "Photo X of Y"
4. Click "Ver Análisis Completo" - should show full Integrated Analysis report
5. Check "Detalles" dropdown is gone

## API Endpoints

### Integrated Summary
- **GET** `/api/listings/[id]/analysis/integrated-summary` - Get 5-bullet summary
- **POST** `/api/listings/[id]/analysis/integrated-summary` - Generate summary from Integrated Analysis

### Photo Gallery
- **GET** `/api/listings/[id]/text-analysis/results` - Returns photos with cluster names mapped

## Related Documentation

- See `docs/INTEGRATED_ANALYSIS_SPEC.md` for the full analysis specification
- See `docs/RESEARCH_CURATION_ARCHITECTURE.md` for research context
- See `docs/ANALYSIS_PIPELINE.md` for the overall analysis flow

