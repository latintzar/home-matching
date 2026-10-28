# Harvest System - Complete Documentation

> **Last Updated:** 2025-12-05
> **Status:** First crawl complete, E&V direct harvest operational

---

## 🆕 Recent Discoveries (Dec 5, 2025)

### 🎯 New Strategy: Direct Extraction First

**See `docs/HARVEST_STRATEGY_V2.md` for full strategy**

The new approach prioritizes direct data extraction over traditional scraping:

1. **Tier 1-3**: API/SSR/JSON extraction for agencies that support it
   - Complete inventory, structured data, daily refresh
   - ✅ E&V working (6,016 listings)
   - 🔜 Audit Century21, RE/MAX, etc.

2. **Tier 4-5**: Traditional sitemap/spider for the rest
   - Fallback that works for any site
   - Already built and operational

### Engel & Völkers SSR Extraction
**Major breakthrough!** We can extract 6,016+ listings directly from E&V without traditional scraping.

- **Method**: Extract embedded JSON from Next.js `__NEXT_DATA__` tags
- **Result**: 6,016 listings in 3 minutes
- **Coverage**: ~40% of their Spain inventory (can improve with deeper geo-segmentation)
- **Doc**: `docs/ENGEL_VOLKERS_HARVEST.md`
- **Script**: `scripts/ev-full-harvest.ts`
- **Data**: `data/ev-listings-full.json`

### Session Notes
Full session documentation: `docs/HARVEST_SESSION_2025_12_05.md`

Includes:
- Domain stats tracking table (`leo-domain-stats`)
- Spider blocklist fix (was blocking pagination!)
- 700+ domains with 0 listings investigation
- E&V SSR discovery and implementation

---

## Overview

The harvest system is a Google-style crawler for Spanish real estate listings, running entirely on AWS Lambda with 400 concurrent executions.

### Current Stats (Post-First-Crawl)
- **S3 HTML Files:** 546,678
- **URLs in DynamoDB:** 587,897
- **Classified:** 580,903 (99%)
- **Listings to Parse:** 165,695
- **List Pages (Delta Sources):** 263,250

---

## Architecture: "1 Lambda = 1 Domain"

**This is the core pattern. Do not deviate.**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Orchestrator   │────▶│  Lambda Pool    │────▶│   DynamoDB      │
│  (fires all)    │     │  (400 concurrent)│     │   + S3          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌─────────────────┐
        │               │ Each Lambda =   │
        │               │ 1 Domain        │
        │               │ Self-contained  │
        └──────────────▶│ 5-min timeout   │
                        └─────────────────┘
```

### Why This Pattern?
1. **True parallelism** - 400 domains processed simultaneously
2. **No coordination** - each Lambda is independent
3. **Fault isolation** - one domain failing doesn't affect others
4. **Simple scaling** - just fire more Lambdas

### What NOT To Do
- ❌ One Lambda processing multiple domains
- ❌ Orchestrator waiting for batches to complete before firing next
- ❌ Sequential processing in loops
- ❌ Local scripts doing heavy lifting (use Lambda orchestrators)

---

## Pipeline Phases

### Phase 1: Sitemap Harvest
**Lambda:** `sitemap-single`
**Script:** `scripts/harvest-sitemap-run.ts`

```bash
# Run sitemap harvest
cd /Users/peterneyra/puedo_casa
source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
npx tsx scripts/harvest-sitemap-run.ts
```

- Fetches sitemap.xml from each domain
- Handles gzipped sitemaps (.xml.gz)
- Handles sitemap indexes (sitemap of sitemaps)
- Saves URLs to `leo-urls` table
- Marks domains without sitemaps for spidering

### Phase 2: Spider Crawl
**Lambda:** `spider-single`
**Script:** `scripts/spider-fire-all.ts`

```bash
# Run spider for all domains needing it
npx tsx scripts/spider-fire-all.ts
```

- Crawls domains without sitemaps
- Downloads HTML while discovering URLs
- Saves HTML to S3, URLs to DynamoDB
- 5-minute timeout, 2000 pages max per domain

**Critical Bug Fix Applied:**
The spider now saves `s3_key` to DynamoDB when marking URLs as downloaded:
```typescript
// In saveUrls function - MUST include s3_key
Item: {
  url: { S: item.url },
  domain: { S: item.domain },
  source: { S: 'spider' },
  status: { S: 'downloaded' },
  s3_key: { S: item.s3Key },  // CRITICAL - was missing before
  discovered_at: { S: new Date().toISOString() },
}
```

### Phase 3: Download (for sitemap URLs)
**Lambda:** `download-single`
**Script:** `scripts/download-run.ts`

```bash
# Download all pending URLs
npx tsx scripts/download-run.ts
```

- Downloads HTML for URLs discovered via sitemap
- Spider URLs are already downloaded during crawl

### Phase 4: Classification
**Lambda:** `classify-single`
**Orchestrator:** `classify-orchestrator`

```bash
# Deploy and trigger classification
npx tsx scripts/deploy-classify-orchestrator.ts
aws lambda invoke --function-name classify-orchestrator --invocation-type Event /dev/null
```

- Classifies each HTML using heuristics (no LLM)
- Determines: pageType, transaction, assetClass, action
- Actions: `parse` (listing), `delta_source` (list page), `skip` (irrelevant)

**Critical Bug Fix Applied:**
The orchestrator extracts domain from URL when not present in DynamoDB:
```typescript
let domain = item.domain?.S;
if (!domain) {
  try {
    domain = new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    totalSkipped++;
    continue;
  }
}
```

### Phase 5: Parsing (TODO)
Extract structured data from listing pages using LLM.

---

## Delta Strategy (Daily Updates)

### The Insight
List pages are **known entry points** to new listings. Instead of blind crawling from homepages, we start from 263K list pages where new listings appear.

### How It Works
```
Day 1 (First Crawl):
  Homepage → Spider → Find everything → 588K URLs

Day 2+ (Delta):
  List Pages (263K) → Spider → Find only NEW URLs
  
  Why fast?
  - 95% of URLs already in DynamoDB → skip
  - Only download truly new listings
  - 5-min timeout is overkill, most finish in seconds
```

### Pagination Handled
- **250K list pages** have no pagination param (page 1)
- **10K list pages** are page 2+ (captured during first crawl)
- New listings appear on page 1 first
- We monitor page 1 → catch new listings immediately

### Delta Lambda Design
```typescript
// delta-single Lambda (TODO)
async function handler(event: { listPageUrl: string, domain: string }) {
  // 1. Fetch list page
  const html = await fetch(listPageUrl);
  
  // 2. Extract all listing URLs from page
  const listingUrls = extractListingUrls(html);
  
  // 3. Batch check against DynamoDB
  const existing = await batchGetUrls(listingUrls);
  const newUrls = listingUrls.filter(u => !existing.has(u));
  
  // 4. Download & classify only NEW URLs
  for (const url of newUrls) {
    await downloadAndClassify(url);
  }
  
  return { found: listingUrls.length, new: newUrls.length };
}
```

### Delta Frequency
- **Daily** is sufficient for most domains
- New listings/day across all 1,953 domains: ~1-5K
- 5-min Lambda can easily handle this

---

## DynamoDB Tables

### `leo-urls`
Primary table for all discovered URLs.
```
url (PK)           - The URL
domain             - Domain name (may be missing for spider URLs)
source             - 'sitemap' | 'spider'
status             - 'pending' | 'downloaded' | 'failed'
s3_key             - S3 path to HTML file
classification     - JSON string with classification results
classification_status - 'classified' | 'failed'
```

### `leo-scraping-rules`
Domain configuration and status.
```
domain (PK)        - Domain name
has_sitemap        - Boolean
needs_spider       - Boolean
spider_status      - 'pending' | 'complete' | 'failed'
```

### `leo-delta-sources`
List pages for delta monitoring.
```
url (PK)           - List page URL
domain             - Domain name
page_type          - list_sale | list_rent | list_mixed
last_checked_at    - Timestamp of last delta check
```

---

## S3 Structure

```
puedo-casa-html-archive/
└── html/
    └── {domain}/
        └── {hash}__{slug}.html
```

Example: `html/tecnocasa.es/a1b2c3d4__venta_piso_madrid.html`

---

## Lessons Learned (Mistakes to Avoid)

### 1. Sequential Lambda Invocation
**Wrong:**
```typescript
for (const domain of domains) {
  await lambda.invoke({ domain });  // SEQUENTIAL!
}
```
**Right:**
```typescript
await Promise.all(domains.map(d => lambda.invoke({ domain: d })));  // PARALLEL
```

### 2. Missing Attributes in DynamoDB Writes
**Wrong:** Spider downloaded HTML but didn't save `s3_key`
```typescript
Item: {
  url: { S: item.url },
  status: { S: 'downloaded' },
  // MISSING: s3_key!
}
```
**Right:** Always include all required attributes
```typescript
Item: {
  url: { S: item.url },
  status: { S: 'downloaded' },
  s3_key: { S: item.s3Key },  // REQUIRED
}
```

### 3. Assuming Attributes Exist
**Wrong:** Classifier required `domain` attribute that spider URLs didn't have
```typescript
if (item.url?.S && item.domain?.S) {  // domain missing for spider URLs!
```
**Right:** Extract from URL if missing
```typescript
let domain = item.domain?.S || new URL(item.url.S).hostname;
```

### 4. Local Scripts for Heavy Work
**Wrong:** Running classification orchestrator locally (timed out)
**Right:** Deploy orchestrator as Lambda with 15-min timeout

### 5. Slow S3 Operations
**Wrong:** `aws s3 rm --recursive` (hours for 500K files)
**Right:** Lambda-based parallel deletion

### 6. Not Checking Filter Conditions
**Wrong:** Orchestrator filtered by `status='downloaded'` but some URLs had no status
**Right:** Filter by `attribute_exists(s3_key)` - the actual requirement

---

## Commands Reference

### Check Status
```bash
cd /Users/peterneyra/puedo_casa
source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION

# S3 file count
aws s3 ls s3://puedo-casa-html-archive/html/ --recursive --summarize | grep "Total Objects"

# URLs in DynamoDB
aws dynamodb scan --table-name leo-urls --select COUNT | grep '"Count"'

# Classified count
aws dynamodb scan --table-name leo-urls \
  --filter-expression "classification_status = :c" \
  --expression-attribute-values '{":c":{"S":"classified"}}' \
  --select COUNT | grep '"Count"'
```

### Deploy Lambdas
```bash
npx tsx scripts/deploy-classify-orchestrator.ts
npx tsx scripts/deploy-classify-single.ts
```

### Trigger Classification
```bash
aws lambda invoke --function-name classify-orchestrator --invocation-type Event /dev/null
```

### Check Lambda Logs
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/classify-orchestrator \
  --start-time $(($(date +%s) - 600))000 \
  --query 'events[*].message' --output text
```

---

## Cost Estimates

| Operation | Cost |
|-----------|------|
| First crawl (588K URLs) | ~$5-10 |
| Daily delta | ~$0.50-1.00 |
| Classification (580K) | ~$2-3 |
| S3 storage (50GB) | ~$1.15/month |
| DynamoDB | ~$1-2/month |

---

## Parsing Architecture

### Teacher/Student Pattern

| Phase | Model | Cost |
|-------|-------|------|
| **Teacher** (learn selectors) | Gemini 3 Pro Preview | ~$62 |
| **Validator** (verify 10x) | Gemini 2.5 Flash | ~$67 |
| **Student** (parse 165K) | Cheerio (FREE) | $0 |
| **TOTAL** | | **~$129** |

### Teacher Prompt Intelligence (`src/harvest/teacher-prompt.ts`)

The Teacher prompt includes learnings from 2000+ Spanish agency sites:

1. **Lat/Lng Extraction** - Check map containers, JSON-LD, inline scripts, data attributes
   - Spain bounds validation: lat [35.5, 43.8], lng [-18.2, 4.5]
   - Watch for Mapbox's reversed lng,lat order
   
2. **JSON-LD First** - Many sites have structured data in `<script type="application/ld+json">`
   
3. **Multilingual Keywords** - ES, EN, DE, FR, Catalan support
   - Price: desde, precio a consultar, /mes, /monat
   - Area: m², m2, qm, metros cuadrados
   - Rooms: habitaciones, Schlafzimmer, chambres

4. **Photo Extraction** - Check gallery arrays in scripts, data-src, srcset

5. **Reference Numbers** - Look for "Ref:", "REF.", "Referencia:", "ID:"

### Big Agencies in Database

| Agency | Domains |
|--------|---------|
| Engel & Völkers | engelvoelkers.com |
| RE/MAX | 6 domains |
| Century 21 | century21.es |
| Sotheby's | 3 domains |
| Savills | savills.es |
| Coldwell Banker | coldwellbanker.es |
| Barnes | 3 domains |

---

## Next Steps

1. **Build Parser** - Extract structured data from 165K listings
2. **Build Delta Lambda** - Daily monitoring of 263K list pages
3. **Schedule Delta** - CloudWatch Events rule for daily trigger
4. **Monitor & Alert** - SNS notifications for failures

---

## File Locations

| Purpose | File |
|---------|------|
| Sitemap Lambda | `src/lambda/sitemap-single.ts` |
| Spider Lambda | `src/lambda/spider-single.ts` |
| Download Lambda | `src/lambda/download-single.ts` |
| Classify Lambda | `src/lambda/classify-single.ts` |
| Classify Orchestrator | `src/lambda/classify-orchestrator.ts` |
| Classifier Logic | `src/harvest/page-classifier.ts` |
| Deploy Scripts | `scripts/deploy-*.ts` |
| Run Scripts | `scripts/*-fire-all.ts` |
| **E&V Harvest** | `scripts/ev-full-harvest.ts` |
| **Domain Stats** | `scripts/build-domain-stats.ts` |
| **Re-spider Fire** | `scripts/respider-fire.ts` |

---

## Direct Extraction (SSR Sites)

Some modern agencies use Next.js/React with SSR. These embed listing data as JSON:

```html
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "searchModule": {
        "initialSearchResults": {
          "listings": [...]  // Structured data!
        }
      }
    }
  }
}
</script>
```

**Advantages:**
- No HTML parsing needed
- Data already structured
- Faster than Cheerio
- More reliable than selectors

**Known SSR Sites:**
- ✅ Engel & Völkers (`scripts/ev-full-harvest.ts`)
- ❓ Century21 (needs investigation)
- ❓ RE/MAX (needs investigation)
- ❓ Coldwell Banker (needs investigation)

See `docs/ENGEL_VOLKERS_HARVEST.md` for detailed implementation.

