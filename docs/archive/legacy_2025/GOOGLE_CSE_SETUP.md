# Google Custom Search Engine Setup

## Overview

The renovation search pipeline now supports multiple Custom Search Engines (CSEs) to enhance quantitative data extraction, particularly for cost-related research.

## Supported Search Engines

### 1. Default Search Engine (Required)
- **Environment Variable**: `GOOGLE_SEARCH_ENGINE_ID`
- **Purpose**: General web search for all research categories
- **Required**: Yes

### 2. Habitissimo Price Guide (Optional)
- **Environment Variable**: `GOOGLE_CSE_HABITISSIMO_ID`
- **CSE ID**: `50c57b6f4e3cd4741`
- **Purpose**: Broad per m² price indicators for sense checking
- **Use Case**: Cost validation and market price ranges
- **Note**: Can be wildly inaccurate and generalized, use for context only

### 3. Leroy Merlin Catalogue (Optional)
- **Environment Variable**: `GOOGLE_CSE_LEROY_MERLIN_ID`
- **CSE ID**: `b0b5adb17de8b4eda`
- **Purpose**: Product price verification for specific items
- **Use Case**: Accurate pricing for materials and products
- **Note**: High reliability for quantitative product costs

## Setup Instructions

1. **Add environment variables to `.env.local`**:
   ```bash
   # Required
   GOOGLE_SEARCH_ENGINE_ID=your_default_cse_id
   
   # Optional - for enhanced quantitative data
   GOOGLE_CSE_HABITISSIMO_ID=50c57b6f4e3cd4741
   GOOGLE_CSE_LEROY_MERLIN_ID=b0b5adb17de8b4eda
   ```

2. **Verify CSEs are accessible**:
   - Ensure all CSEs are configured in Google Cloud Console
   - Verify service account has access to all CSEs
   - Test searches manually before production use

## How It Works

When multiple CSEs are configured:

1. **Query Execution (sequential phases)**: General → Habitissimo → Leroy Merlin. Each phase uses batching (50 queries per batch) with a 65s delay between batches to respect the shared 100 qpm limit.
2. **Result Aggregation**: Results from all engines are combined and deduplicated by URL
3. **Source Tagging**: Each result is tagged with its source (`general`, `habitissimo`, `leroy_merlin`)
4. **Prioritization**: Curation prompts prioritize results from specialized CSEs (Habitissimo, Leroy Merlin) for quantitative data
5. **Storage**: Source tags are stored in `metadata.source` field in `renovation_search_results` table

## Benefits

- **Enhanced Quantitative Data**: Specialized CSEs provide more accurate pricing information
- **Better Cost Validation**: Habitissimo offers market context, Leroy Merlin provides exact product prices
- **Source Attribution**: Track which sources contributed to each research finding
- **Fallback Support**: System works with just the default CSE if others are unavailable

## Curation Behavior

The curation process:
- **Prioritizes** results tagged with `habitissimo` or `leroy_merlin` for quantitative data extraction
- **Extracts metrics** (low, high, unit) with higher confidence when sourced from specialized CSEs
- **Marks sources** in research summaries for transparency

## Rate Limiting

- Effective global limit: 100 queries/min across the shared API key
- Batch size: 50 queries; Batch delay: 65s (per phase)
- Phases: run General first, then Habitissimo, then Leroy Merlin

## Model Settings (Unified)

- `model`: `gemini-2.5-flash`
- `temperature`: `0.3`
- `topP`: `0.95`
- `topK`: `40`
- `maxOutputTokens`: `8192`

## Testing

To test multi-engine search:
```bash
curl -X POST http://localhost:3000/api/listings/[id]/renovation-google-search \
  -H "Content-Type: application/json"
```

Check logs for:
- `✅ Added Habitissimo CSE for price guide searches`
- `✅ Added Leroy Merlin CSE for product catalogue searches`
- `🔍 Using X search engines: general, habitissimo, leroy_merlin`

