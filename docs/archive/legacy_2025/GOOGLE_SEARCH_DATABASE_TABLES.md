# Google Search Pipeline - Database Tables

This document describes the database tables used by the consolidated Google Search endpoints and their relationships.

**Naming Convention:** Tables are prefixed with their phase:
- Analysis phase: `analysis_*`
- Renovation phase: `renovation_*`

## Endpoints & Their Tables

### `/api/listings/[id]/analysis-google-search`

**Purpose:** Analysis-phase Google research (property context for diagnostics)

**Tables Used:**

1. **`analysis_search_results`** (WRITE)
   - **When:** After executing Google searches
   - **Content:** Raw search results (URL, title, snippet, rank)
   - **Metadata:** `{ category: string, reasoning: string }`
   - **Schema:**
     ```typescript
     {
       id: UUID;
       listing_id: TEXT; // References listings.id
       query: TEXT;
       url: TEXT;
       title: TEXT;
       snippet: TEXT;
       display_link: TEXT;
       rank: INTEGER;
       metadata: JSONB;
       created_at: TIMESTAMPTZ;
     }
     ```

2. **`domain_credibility_cache`** (READ/WRITE via `/api/research/domain-credibility`)
   - **When:** During credibility scoring step
   - **Content:** Cached credibility scores (high/medium/low/unknown) per domain
   - **Note:** Populated automatically by domain-credibility endpoint, shared between phases

3. **`analysis_curated_results`** (WRITE)
   - **When:** After curation step
   - **Content:** Curated summaries per research category (15 categories)
   - **Schema:**
     ```typescript
     {
       id: UUID;
       listing_id: TEXT; // References listings.id
       category: string; // e.g., 'local_built_environment', 'renovation_maintenance', etc.
       summary: string;
       key_points: string[]; // JSONB
       confidence_level: 'high' | 'medium' | 'low';
       representative_snippets: Array<{ source_domain, credibility, text, url }>; // JSONB
       sources_used: string[]; // JSONB
       created_at: TIMESTAMPTZ;
     }
     ```
   - **Query Filter:** `listing_id = {listingId}` AND `category IN (15 categories)`

---

### `/api/listings/[id]/renovation-google-search`

**Purpose:** Renovation-phase Google research (tier-specific renovation data)

**Tables Used:**

1. **`renovation_research_queries`** (OPTIONAL WRITE)
   - **When:** After query generation step (optional, for debugging/audit)
   - **Content:** Generated search queries per tier × category
   - **Schema:**
     ```typescript
     {
       id: BIGINT;
       listing_id: INTEGER; // Note: INTEGER, references listings.id
       tier: 'estandar' | 'optimo' | 'plus';
       category: string; // e.g., 'costs', 'timings', 'permits', etc.
       queries_data: {
         queries: Array<QueryObject | string> // Work-item-specific or tier-wide
       }; // JSONB
       created_at: TIMESTAMPTZ;
     }
     ```
   - **Note:** This table is optional - queries can be generated and executed without saving

2. **`renovation_search_results`** (WRITE)
   - **When:** After executing Google searches
   - **Content:** Raw search results (URL, title, snippet, rank)
   - **Metadata:** 
     ```typescript
     {
       tier: string;
       category: string;
       work_item_id?: string;
       work_item_name?: string;
     }
     ```
   - **Schema:**
     ```typescript
     {
       id: UUID;
       listing_id: TEXT; // References listings.id
       query: TEXT;
       url: TEXT;
       title: TEXT;
       snippet: TEXT;
       display_link: TEXT;
       rank: INTEGER;
       metadata: JSONB; // Contains tier, category, work_item info
       created_at: TIMESTAMPTZ;
     }
     ```
   - **Query Filter:** `listing_id = {listingId}` AND `metadata->>'tier' = {tier}` AND `metadata->>'category' = {category}`

3. **`renovation_research_results`** (WRITE)
   - **When:** After curation step
   - **Content:** Curated summaries per tier × category
   - **Schema:**
     ```typescript
     {
       id: BIGINT;
       listing_id: INTEGER; // References listings.id
       category: string; // Format: '{category}_{tier}' e.g., 'costs_estandar', 'timings_optimo'
       report_data: {
         summaries: Array<{
           work_item_id?: string;
           work_item_name?: string;
           summary: string;
           confidence: 'high' | 'medium' | 'low';
           sources: string[];
           metrics?: { low?: number; high?: number; unit?: string };
         }>;
       }; // JSONB
       created_at: TIMESTAMPTZ;
     }
     ```
   - **Query Filter:** `listing_id = {listingId}` AND `category LIKE '{category}_%'`

---

## Table Relationships

```
┌─────────────────────────────────────────────────────────┐
│  ANALYSIS PHASE                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  /analysis-google-search                                │
│    ↓                                                     │
│  analysis_search_results (raw Google results)          │
│    ↓                                                     │
│  domain_credibility_cache (via domain-credibility API)  │
│    ↓                                                     │
│  analysis_curated_results (15 categories)              │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  RENOVATION PHASE                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  /renovation-google-search                              │
│    ↓                                                     │
│  renovation_research_queries (optional, queries only)   │
│    ↓                                                     │
│  renovation_search_results (raw Google results)        │
│    ↓                                                     │
│  renovation_research_results (21 tier×category sets)    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Shared Tables

### `domain_credibility_cache`
- **Shared by:** Both analysis and renovation phases
- **Purpose:** Caches domain credibility scores to avoid re-scoring the same domains
- **Differentiated by:** Not phase-specific - all domains cached regardless of phase
- **Query Pattern:** Domain-based lookup, not listing-based

## Table Usage Patterns

### Reading Data

**Analysis Phase:**
```sql
-- Get curated analysis research
SELECT * FROM analysis_curated_results 
WHERE listing_id = '1000000121';

-- Get raw search results (if needed)
SELECT * FROM analysis_search_results 
WHERE listing_id = '1000000121';
```

**Renovation Phase:**
```sql
-- Get curated renovation research for a tier
SELECT * FROM renovation_research_results 
WHERE listing_id = 1000000121 
  AND category LIKE 'costs_%';

-- Get raw search results for a tier×category
SELECT * FROM renovation_search_results 
WHERE listing_id = '1000000121' 
  AND metadata->>'tier' = 'estandar'
  AND metadata->>'category' = 'costs';
```

### Cleaning Up Data

**Clear analysis phase data:**
```sql
DELETE FROM analysis_curated_results WHERE listing_id = '1000000121';
DELETE FROM analysis_search_results WHERE listing_id = '1000000121';
```

**Clear renovation phase data:**
```sql
DELETE FROM renovation_research_results WHERE listing_id = 1000000121;
DELETE FROM renovation_research_queries WHERE listing_id = 1000000121;
DELETE FROM renovation_search_results WHERE listing_id = '1000000121';
```

## Notes

1. **ID Type Differences:**
   - **Analysis tables:** `listing_id` → `TEXT` (matches `listings.id` type)
     - `analysis_search_results.listing_id` → `TEXT`
     - `analysis_curated_results.listing_id` → `TEXT`
   - **Renovation tables:** Mixed (historical reasons)
     - `renovation_search_results.listing_id` → `TEXT` (matches `listings.id`)
     - `renovation_research_results.listing_id` → `INTEGER` (legacy)
     - `renovation_research_queries.listing_id` → `INTEGER` (legacy)

2. **Category Naming:**
   - Analysis: Uses `RESEARCH_CATEGORIES` IDs (e.g., `'local_built_environment'`, `'renovation_maintenance'`)
   - Renovation: Uses category names + tier suffix (e.g., `'costs_estandar'`, `'timings_optimo'`)

3. **Metadata Structure:**
   - Analysis: `{ category: string, reasoning: string }`
   - Renovation: `{ tier: string, category: string, work_item_id?: string, work_item_name?: string }`
   - **No `source` field needed** - phase separation is handled by separate tables

4. **Credibility Cache:**
   - Shared across both phases
   - Populated automatically by `/api/research/domain-credibility`
   - Never manually inserted by Google search endpoints
   - Domain-based, not listing-based

5. **Table Naming Convention:**
   - `analysis_*` → Analysis phase (property context research)
   - `renovation_*` → Renovation phase (tier-specific renovation research)
   - Clear phase separation eliminates need for `metadata.source` field

