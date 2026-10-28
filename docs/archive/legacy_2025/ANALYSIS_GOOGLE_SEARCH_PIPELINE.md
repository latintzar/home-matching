# Analysis Google Search Pipeline (Step F)

**Last Updated:** 2025-01-27  
**Status:** ✅ Complete & Production-Ready  
**Pipeline Step:** F - Google Search Grounding (Analysis Phase)

## 📋 Executive Summary

The Analysis Google Search pipeline provides **real-world context grounding** for property diagnostics by executing targeted Google searches across 15 research categories. It combines AI-powered query generation, intelligent domain credibility scoring (whitelist + Gemini evaluation), and automated curation to produce context-aware summaries that ground agent claims and photo evidence in local reality.

**Key Characteristics:**
- **Input-Driven:** Uses B3-snippets (known facts), C-unknowns (information gaps), and photo analysis (E2/E3/E4) to generate property-specific queries
- **Credibility-Aware:** Multi-tier domain scoring system (whitelist → deterministic → heuristics → Gemini evaluation)
- **Comprehensive:** Covers 15 research categories from regulatory to social context
- **R&D Mode:** Uses UPSERT to overwrite existing results for iterative testing

---

## 🏗️ Architecture Overview

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP F: Analysis Google Search                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. Fetch Prerequisites                                       │
│    ├─ Text Analysis (B3-snippets, C-unknowns)              │
│    ├─ Listing Data                                           │
│    └─ Photo Analysis (E2/E3/E4) - Optional                 │
│                                                              │
│ 2. Generate Queries (F1)                                     │
│    ├─ 15 Research Categories                                 │
│    ├─ Gemini 2.5 Flash                                      │
│    ├─ 10 queries per category (max)                        │
│    └─ Property-specific + Spatial context                   │
│                                                              │
│ 3. Execute Searches (F2)                                    │
│    ├─ Google Custom Search API                              │
│    ├─ 10 results per query                                  │
│    └─ Store raw results                                      │
│                                                              │
│ 4. Domain Credibility Scoring (F3)                         │
│    ├─ Whitelist (high credibility)                         │
│    ├─ Deterministic rules                                   │
│    ├─ Heuristic patterns                                    │
│    └─ Gemini Flash evaluation (10 domains/batch)            │
│                                                              │
│ 5. Curate Results (F4)                                      │
│    ├─ Group by category                                     │
│    ├─ Sort by credibility + rank                           │
│    ├─ Gemini 2.5 Flash summarization                        │
│    └─ Store curated summaries                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Endpoints

### Primary Endpoint

**`POST /api/listings/[id]/analysis-google-search`**

**Purpose:** Complete end-to-end pipeline execution (query generation → search → credibility → curation)

**Request Body:**
```typescript
{
  options?: {
    maxSnippetsPerCategory?: number;        // Default: 20
    allowGeminiFallbackForUnknownDomains?: boolean;  // Default: true
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    listing_id: string;
    queries_generated: number;
    searches_executed: number;
    results_found: number;
    results_saved: number;
    domains_scored: number;
    categories_curated: number;
    curated_results: Array<{
      category: string;
      summary: string;
      key_points: string[];
      confidence_level: 'high' | 'medium' | 'low';
      representative_snippets: Array<{
        source_domain: string;
        credibility: string;
        text: string;
        url: string;
      }>;
      sources_used: string[];
    }>;
  };
}
```

### Curation-Only Endpoint

**`POST /api/listings/[id]/analysis-google-search-curate`**

**Purpose:** Post-search curation (runs after search results are saved)

**Use Case:** Re-run curation without regenerating queries or re-executing searches

**Request Body:**
```typescript
{
  options?: {
    maxSnippetsPerCategory?: number;  // Default: 20
  }
}
```

---

## 🔍 Step-by-Step Implementation

### Step 1: Fetch Prerequisites

**Inputs Required:**
- Text Analysis results (`text_analysis_results` table)
  - Phase: `b3_snippets` (categorized claims)
  - Phase: `c_unknowns` or `c1_unknowns` (information gaps)
- Listing data (`listings` table)
- Photo Analysis (optional, enhances query specificity)
  - E2: Unified home layout (`room_analyses.unified_home_layout_json`)
  - E3: Whole-property analysis (`whole_property_analysis.analysis_data`)
  - E4: Room-by-room analysis (`room_analyses.analysis_data`)

**Error Handling:**
- Missing text analysis → Returns 404 with helpful error message
- Missing listing → Returns 404
- Missing photo analysis → Logs warning, continues (optional inputs)

### Step 2: Query Generation (F1)

**Process:**
1. Iterate through all 15 `RESEARCH_CATEGORIES`
2. For each category, generate prompt using:
   - Property data (title, location, size, bedrooms, bathrooms, price)
   - Known facts (B3-snippets by category)
   - Unknowns (C-unknowns checklist)
   - Photo analysis summaries (E2/E3/E4) - if available
3. Call Gemini 2.5 Flash with structured output schema
4. Parse JSON response with robust error recovery
5. Extract queries (max 10 per category)

**Prompt Template:** `src/lib/prompts/research-queries-category.ts`

**JSON Schema:**
```typescript
{
  queries: Array<{
    query: string;        // Spanish Google search query
    reasoning: string;   // Why this query is relevant
  }>;
}
```

**Robust Parsing:**
- Removes markdown code blocks
- Handles trailing commas
- Balances braces/brackets
- Recovers from truncated responses

**Output:** Array of query objects with `category`, `query`, `reasoning`

### Step 3: Search Execution (F2)

**Process:**
1. Extract query strings from generated queries
2. Call `executeMultipleSearches()` (from `@/lib/google-search`)
3. Google Custom Search API executes searches in parallel
4. Returns 10 results per query (configurable)

**Storage:**
- Stores raw results in `analysis_search_results` table
- Uses UPSERT (overwrites in R&D mode)
- Deduplicates by `(listing_id, query, url)` before saving
- Metadata includes: `{ category, reasoning }`

**Google Search Configuration:**
- Uses OAuth2 service account authentication
- Requires `GOOGLE_SEARCH_ENGINE_ID` and `GOOGLE_APPLICATION_CREDENTIALS`
- 10 results per query (default)

### Step 4: Domain Credibility Scoring (F3)

**Multi-Tier Scoring System:**

1. **Whitelist Check** (Highest Priority)
   - Trusted domains get `high` credibility automatically
   - See `ANALYSIS_WHITELIST` in `src/lib/domain-whitelists.ts`
   - Includes: `.gob.es`, `boe.es`, `idealista.com`, `codigotecnico.org`, etc.

2. **Deterministic Rules** (Fast Path)
   - Pattern matching for known domain types
   - Examples: `.gob.es` → `high`, `.edu` → `medium-high`, `forocoches` → `low`

3. **Heuristic Patterns** (Medium Path)
   - Regex-based pattern matching
   - Examples: `gob|gov` → `high`, `academic_org` → `medium-high`

4. **Gemini Flash Evaluation** (Fallback)
   - For unknown domains (not in whitelist, no pattern match)
   - Batched evaluation (10 domains per call)
   - Provides credibility score + reasoning

**Caching:**
- Results cached in `domain_credibility_cache` table
- Cache lookup before scoring
- Cache TTL: 1 year (deterministic), 90 days (others)

**Batch Processing:**
- Processes domains in batches of 100 (max supported by endpoint)
- Calls `/api/research/domain-credibility` endpoint
- Uses `phase: 'analysis'` parameter for correct whitelist lookup

### Step 5: Curation (F4)

**Process:**
1. Enrich search results with credibility scores
2. Group results by category (from `metadata.category`)
3. Sort by credibility (high → medium → unknown → low), then by rank
4. Take top N snippets per category (default: 20)
5. Generate curation prompt with truncated snippets
6. Call Gemini 2.5 Flash for summarization
7. Store curated results in `analysis_curated_results` table

**Curation Schema:**
```typescript
{
  summary: string;                    // 2-5 sentence synthesis
  key_points: string[];              // Bullet points
  confidence_level: 'high' | 'medium' | 'low';
}
```

**Storage:**
- Uses UPSERT (overwrites existing curation for same `listing_id + category`)
- Stores representative snippets (top 3 per category)
- Tracks sources used (unique domains)

---

## 📊 Research Categories

The pipeline generates queries for **15 research categories**:

1. **`local_built_environment`** - Typical buildings in the area
2. **`renovation_maintenance`** - Renovation trends and common issues
3. **`regulatory_zoning`** - Legal and planning constraints
4. **`energy_sustainability`** - Energy standards and incentives
5. **`infrastructure_utilities`** - Connectivity and services
6. **`environmental_risks`** - Physical risks and environmental factors
7. **`market_price`** - Price context and market norms
8. **`neighborhood_livability`** - Daily life and area perception
9. **`legal_administrative`** - Bureaucratic and ownership aspects
10. **`developer_reputation`** - Developer and community reliability
11. **`heritage_protection`** - Design constraints and historical controls
12. **`planned_developments`** - Active/planned nearby projects
13. **`insurance_safety`** - Insurance and safety considerations
14. **`comparables`** - Reference properties for comparison
15. **`social_media`** - Recent discussions and local news

**Category Definitions:** `src/lib/prompts/research-queries-advanced.ts`

---

## 🗄️ Database Tables

### `analysis_search_results`
**Purpose:** Raw Google search results

**Schema:**
```sql
CREATE TABLE analysis_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL,
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  display_link TEXT,
  rank INTEGER,
  metadata JSONB,  -- { category: string, reasoning: string }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, query, url)
);
```

### `analysis_curated_results`
**Purpose:** Curated summaries per research category

**Schema:**
```sql
CREATE TABLE analysis_curated_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL,
  category TEXT NOT NULL,  -- RESEARCH_CATEGORIES[].id
  summary TEXT NOT NULL,
  key_points JSONB NOT NULL,  -- string[]
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  representative_snippets JSONB NOT NULL,
  sources_used JSONB NOT NULL,  -- string[]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, category)
);
```

### `domain_credibility_cache`
**Purpose:** Cached domain credibility scores (shared across phases)

**Schema:**
```sql
CREATE TABLE domain_credibility_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  etld1 TEXT NOT NULL,
  credibility TEXT NOT NULL CHECK (credibility IN ('high', 'medium-high', 'medium', 'medium-low', 'low', 'unknown')),
  method TEXT NOT NULL,  -- 'whitelist' | 'deterministic' | 'heuristic' | 'gemini_fallback'
  matched_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  -- ... other fields
);
```

**Note:** RLS disabled for this table (cache-only, no sensitive data)

---

## 🔧 Configuration

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Google Search API
GOOGLE_SEARCH_ENGINE_ID=13b2f30f71cb44f6e
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Gemini API (via Vertex AI)
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_CLOUD_LOCATION=us-central1
```

### Options

**`maxSnippetsPerCategory`** (default: 20)
- Maximum number of snippets to use per category during curation
- Higher = more comprehensive but slower/expensive

**`allowGeminiFallbackForUnknownDomains`** (default: true)
- Enable Gemini Flash evaluation for unknown domains
- If false, unknown domains remain `unknown` credibility

---

## 🎯 Usage Examples

### Full Pipeline Execution

```bash
curl -X POST http://localhost:3000/api/listings/1000000121/analysis-google-search \
  -H "Content-Type: application/json" \
  -d '{
    "options": {
      "maxSnippetsPerCategory": 20,
      "allowGeminiFallbackForUnknownDomains": true
    }
  }'
```

### Curation-Only (Re-run after search)

```bash
curl -X POST http://localhost:3000/api/listings/1000000121/analysis-google-search-curate \
  -H "Content-Type: application/json" \
  -d '{
    "options": {
      "maxSnippetsPerCategory": 30
    }
  }'
```

---

## 🔍 Troubleshooting

### Common Issues

**1. "Text Analysis results not found"**
- **Solution:** Run Text Analysis pipeline first (phases B3 and C)

**2. "Domain credibility failed: 500"**
- **Solution:** Check `/api/research/domain-credibility` endpoint logs
- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set correctly

**3. "No queries generated"**
- **Possible Causes:**
  - Property data insufficient
  - All categories deemed irrelevant by Gemini
- **Solution:** Check property data completeness, review category relevance

**4. Cache RLS Errors**
- **Status:** Fixed - RLS disabled for `domain_credibility_cache` table
- **Note:** Cache is non-blocking (errors logged but don't fail pipeline)

### Performance Considerations

- **Query Generation:** ~15 seconds (15 categories × ~1s each)
- **Search Execution:** ~30-60 seconds (depends on number of queries)
- **Credibility Scoring:** ~5-10 seconds (batched, cached)
- **Curation:** ~20-30 seconds (15 categories × ~2s each)

**Total Runtime:** ~1-2 minutes for full pipeline

---

## 📈 Renovation Research Multi-CSE Notes (Applied to Step N Inputs)

The renovation research pipeline (used downstream by pricing/timings/permits) now uses three search sources with sequential phases and strict rate-limiting:

- Sources: General Google CSE, Habitissimo CSE (`habitissimo.com/guia-de-precios`), Leroy Merlin CSE (`leroymerlin.es`)
- Model settings unified across sources: `gemini-2.5-flash`, temperature 0.3, topP 0.95, topK 40
- Execution: General → Habitissimo → Leroy Merlin, 50 queries per batch, 65s delay between batches
- Storage: results saved to `renovation_search_results` with `metadata.source`
- Curation: prioritizes specialized sources for quantitative metrics

Example (listing `1000000121`):
- Total rows saved: 1,000
- Unique pages (URLs): 504
- Unique websites (domains): 298
- Source distribution (unique domains): General 293, Habitissimo 3, Leroy Merlin 2

See `docs/GOOGLE_CSE_SETUP.md` for environment setup and operational details.

---

## 📚 Related Documentation

- **[Google Search Grounding](GOOGLE_SEARCH_GROUNDING.md)** - Conceptual overview and research categories framework
- **[Google Search Database Tables](GOOGLE_SEARCH_DATABASE_TABLES.md)** - Complete database schema documentation
- **[Analysis Pipeline](ANALYSIS_PIPELINE.md)** - Full analysis phase architecture
- **Domain Credibility System (`../src/lib/cred/`, historical reference)** - Credibility scoring implementation

---

## ✅ Status Checklist

- [x] Query generation with 15 categories
- [x] Google Search API integration (OAuth2)
- [x] Whitelist system for trusted domains
- [x] Deterministic + heuristic credibility scoring
- [x] Gemini Flash evaluation for unknown domains
- [x] Caching system (no RLS errors)
- [x] Batch processing (100 domains per batch)
- [x] Robust JSON parsing with recovery
- [x] UPSERT for R&D mode (overwrites existing results)
- [x] Deduplication to prevent conflicts
- [x] Photo analysis integration (E2/E3/E4)
- [x] Curation with credibility weighting
- [x] Separate curation endpoint for post-search processing
- [x] Comprehensive error handling
- [x] Full logging and debugging support

**Status:** ✅ **Production-Ready**

