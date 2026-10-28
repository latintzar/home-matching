# Research Curation Architecture

## Overview

**Status: ✅ FULLY OPERATIONAL**

A credibility-scoring system for Google Search snippets that uses deterministic rules, heuristic patterns, and optional Gemini 2.5 Flash fallback to tag and curate research results before feeding them into integrated analysis.

**What It Does:**
1. Fetches raw Google Search research snippets for a property
2. Scores domain credibility (high/medium/low/unknown) using rules + heuristics
3. Truncates long snippets to prevent token limits
4. Calls Gemini 2.5 Flash to generate AI summaries per research category
5. Stores curated results in `research_curated_results` table
6. Produces research-backed insights for property diagnostics

**Tested & Working:** Listing `1000000121` successfully processed with all 14 categories returning real AI summaries.

## How It Works

### Step-by-Step Flow

1. **Google Search** (`/api/listings/[id]/search-research`)
   - Generates research queries using Gemini 2.5 Pro
   - Executes Google Custom Search API
   - Stores raw snippets in `research_search_results` table

2. **Domain Credibility Scoring** (`/api/research/domain-credibility`)
   - Fetches unique URLs from raw snippets
   - Scores each domain using deterministic + heuristic rules
   - Caches results in `domain_credibility_cache` table
   - Returns: `{url, credibility: "high|medium|low|unknown"}`

3. **Research Curation** (`/api/listings/[id]/research-curation`)
   - Groups snippets by category (regulatory_zoning, market_price, etc.)
   - Truncates snippets to 500 chars each to prevent prompt bloat
   - Calls Gemini 2.5 Flash with `maxOutputTokens: 8192`
   - Generates AI summary for each category
   - Stores in `research_curated_results` with:
     - Summary (AI-generated synthesis)
     - Key points (bullet list)
     - Representative snippets (top 3 most credible)
     - Confidence level (high/medium/low)

4. **Integrated Analysis** (`/api/listings/[id]/analysis/integrated`)
   - Consumes curated research from `research_curated_results`
   - Feeds into Gemini for property diagnostics
   - Produces research-backed recommendations

### Architecture Flow

```
Google Search API (search-research endpoint)
        ↓
Stores raw snippets (research_search_results)
        ↓
Domain Credibility Scoring (domain-credibility endpoint)
        ↓
Caches credibility scores (domain_credibility_cache)
        ↓
Research Curation (research-curation endpoint)
        ↓
Stores AI summaries (research_curated_results)
        ↓
Integrated Analysis (consumes curated research)
```

## Endpoints

### 1. POST /api/research/domain-credibility

Scores a batch of domains/URLs and caches results.

**Request (JSON)**
```json
{
  "items": [
    {"url": "https://ajuntament.barcelona.cat/urbanisme", "category": "regulatory_zoning"},
    {"url": "https://boe.es/...", "category": "regulatory_zoning"},
    {"url": "https://burbuja.info/...", "category": "neighborhood_livability"}
  ],
  "options": {
    "allowGeminiFallback": true,
    "forceRefresh": false
  }
}
```

**Response (JSON)**
```json
{
  "results": [
    {
      "url": "https://ajuntament.barcelona.cat/urbanisme",
      "domain": "ajuntament.barcelona.cat",
      "etld1": "barcelona.cat",
      "credibility": "high",
      "method": "heuristic",
      "matched_signals": ["ajuntament", ".cat official"],
      "ttl_sec": 7776000
    }
  ]
}
```

**HTTP Codes**
- 200: OK
- 400: invalid payload
- 429: rate-limited
- 500: unexpected

### 2. POST /api/listings/[id]/research-curation

Fetches raw snippets, scores domains, cleans/dedupes, summarizes, persists results.

**Request**
```json
{
  "listing_id": "1000000121",
  "options": {
    "maxSnippetsPerCategory": 20,
    "allowGeminiFallbackForUnknownDomains": true
  }
}
```

**Response**
```json
{
  "listing_id": "1000000121",
  "categories": [
    {
      "category": "regulatory_zoning",
      "summary": "Major works require municipal license (4–6 months)...",
      "key_points": ["Coastal protections limit expansions"],
      "confidence_level": "high",
      "representative_snippets": [
        {"source_domain": "calvia.com", "credibility": "high", "text": "..."},
        {"source_domain": "boe.es", "credibility": "high", "text": "..."}
      ],
      "sources_used": ["calvia.com","boe.es"]
    }
  ]
}
```

## Data Model (Supabase)

### `domain_credibility_cache`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid pk | default gen_random_uuid() |
| etld1 | text | registrable domain (PSL) |
| domain | text | full hostname (subdomain.domain.tld) |
| source_url | text | first URL seen for this domain |
| credibility | text | enum: high, medium-high, medium, medium-low, low, unknown |
| method | text | deterministic \| heuristic \| gemini_fallback |
| matched_signals | jsonb | array of matched patterns/keywords |
| first_seen_at | timestamptz | default now() |
| last_seen_at | timestamptz | update on hit |
| ttl_sec | int | suggested cache TTL |
| expires_at | timestamptz | computed: first_seen_at + ttl |
| notes | text | optional, e.g., "manual override" |
| version | int | ruleset version used |

**Indexes**
- unique (domain) and/or (etld1, domain)
- expires_at for cleanup

### `research_curated_results`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid pk | |
| listing_id | uuid | fk to listings |
| category | text | research category |
| summary | text | 2–5 sentence synthesis |
| key_points | jsonb | bullet list |
| representative_snippets | jsonb | array of {source_domain, credibility, text, url} |
| sources_used | jsonb | array of domains |
| confidence_level | text | enum: high/medium/low |
| created_at | timestamptz | default now() |

## Credibility Algorithm

### Deterministic "Fast Path" Rules

```typescript
const DETERMINISTIC = [
  { 
    test: (d:string)=>d.endsWith('.gob.es') || d.includes('boe.es') || /ayunt(amien)?to|ajuntament|diputaci(o|ó)n|cabildo|consell/i.test(d), 
    cred:'high', 
    signal:'gov_local_keyword' 
  },
  { 
    test: (d:string)=>/(^|\.)mitma\.gob\.es|ine\.es|icane|inegi|ine\.pt/i.test(d), 
    cred:'high', 
    signal:'natl_institute' 
  },
  { 
    test: (d:string)=>/(^|\.)edu($|\.)|univ|universidad|csic/i.test(d), 
    cred:'medium-high', 
    signal:'academic' 
  },
  { 
    test: (d:string)=>/(elpais|elmundo|abc|lavanguardia|diariodemallorca|rtve|cadenaSER)\.com/i.test(d), 
    cred:'medium', 
    signal:'major_media' 
  },
  { 
    test: (d:string)=>/(idealista|fotocasa|habitaclia|pisos)\.com/i.test(d), 
    cred:'medium', 
    signal:'major_portal' 
  },
  { 
    test: (d:string)=>/(habitissimo|obramat|bauhaus|leroymerlin)\./i.test(d), 
    cred:'medium-low', 
    signal:'commerce_cost' 
  },
  { 
    test: (d:string)=>/(burbuja\.info|reddit\.com|forocoches|tapatalk|wordpress|blogspot)/i.test(d), 
    cred:'low', 
    signal:'forum_blog' 
  }
];
```

### Heuristic Rules (for unknowns)

```typescript
const HEURISTIC = [
  { regex: /(gob|gov|ayto|ajuntament|diputaci[oó]n|cabildo|consell)/i, cred:'high', signal:'public_keywords' },
  { regex: /\.(cat|eus|gal)$/i, cred:'medium-high', signal:'regional_tld' },
  { regex: /(edu|univ|universidad|research|org)/i, cred:'medium-high', signal:'academic_org' },
  { regex: /(noticia|diario|peri[oó]dico|press|rtve|cadena)/i, cred:'medium', signal:'media_keywords' },
  { regex: /(foro|blog|reddit|burbuja|wordpress|tapatalk)/i, cred:'low', signal:'ugc_keywords' }
];
```

## Real Example Output

For listing `1000000121` (Portals Nous apartment), here's what the research curation produces:

### Example Category: "comparables"

```json
{
  "category": "comparables",
  "summary": "The Portals Nous - Bendinat area, encompassing Puerto Portals and Viejo Bendinat, is consistently presented as an exclusive, luxury, and highly sought-after location. Properties in this area are typically apartments and penthouses, often featuring 2 or 3 bedrooms. Desirable amenities frequently include private pools, terraces, direct access to the port, and sea views.",
  "key_points": [
    "Portals Nous - Bendinat (including Puerto Portals/Viejo Bendinat) is an exclusive, luxury, and sought-after area.",
    "Properties are typically apartments and penthouses.",
    "Common configurations are 2 or 3 bedrooms.",
    "Desirable amenities include private pools, terraces, direct port access, and sea views."
  ],
  "confidence_level": "medium",
  "representative_snippets": [
    {
      "source_domain": "www.idealista.com",
      "credibility": "medium",
      "text": "Increíble apartamento de 3 dormitorios con piscina privada en venta en Puerto Portals...",
      "url": "https://www.idealista.com/..."
    }
  ],
  "sources_used": ["www.idealista.com", "claus-von-benz.com", "mallorcaproperties.es"]
}
```

### Example Category: "regulatory_zoning"

```json
{
  "category": "regulatory_zoning",
  "summary": "Properties in Portals Nous - Bendinat, Calvià, Mallorca, are governed by urban planning and maritime regulations. New construction is permitted in the area, though major projects, including single-family homes, require licenses from the Consell de Mallorca. A significant regulatory constraint for coastal properties is the Ley de Costas (Coastal Law), which is subject to strict enforcement and can limit development or reforms.",
  "confidence_level": "medium"
}
```

## Key Implementation Details

### Token Management
- **Snippet truncation**: Limited to 500 characters per snippet to prevent prompt bloat
- **maxOutputTokens**: Set to 8192 (Gemini's maximum) to prevent response truncation
- **Batch processing**: Domain credibility fetched in batches of 50 URLs

### Error Handling
- Fallback to placeholder text if Gemini fails
- Logs detailed errors for debugging
- Graceful degradation when API calls fail

### Performance
- Domain credibility is cached (90-day TTL)
- Parallel category processing within Gemini constraints
- Efficient JSON parsing with regex fallbacks

## Definition of Done

✅ POST /api/research/domain-credibility live, tested, cached

✅ POST /api/listings/[id]/research-curation working with all 14 categories

✅ DB tables created and populated during curation

✅ All categories returning real AI summaries (not placeholders)

✅ Snippet truncation preventing token limit issues

✅ Increased `maxOutputTokens` to 8192 preventing response truncation

✅ Tested on listing 1000000121 with 210 snippets → 14 curated categories

✅ Ready for integration with `/api/listings/[id]/analysis/integrated`

