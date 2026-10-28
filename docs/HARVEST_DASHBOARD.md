# Harvest Dashboard

> **Last Updated**: December 7, 2025  
> **Status**: All 7 premium domains operational and deployed to AWS Lambda

---

## ⚠️ IMPORTANT: Premium Domains ONLY

**We harvest from 7 premium domains ONLY. The old bulk harvester (thousands of domains) is PARKED.**

| What We Use | What's Parked |
|-------------|---------------|
| 7 premium domain Lambdas | `daily-harvest-delta.ts` |
| Bespoke parsing per domain | `harvest-orchestrator.ts` |
| Self-continuation for reliability | `spider-single.ts`, `sitemap-single.ts` |
| ~64,000+ quality listings | `leo-scraping-rules` table |

**Why:** Quality over quantity. Premium agencies have the best data and we can guarantee freshness.

---

## 🎯 The Simple Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HARVEST PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   STEP 1: HARVEST                    STEP 2: PARSE                      │
│   ════════════════                   ═══════════════                    │
│                                                                          │
│   ┌─────────────┐                    ┌─────────────┐                    │
│   │  Discover   │                    │  Extract    │                    │
│   │    URLs     │   Download HTML    │  Structured │    Store in        │
│   │             │ ─────────────────▶ │    Data     │ ─────────────────▶ │
│   │  (sitemap   │   to S3 bucket     │             │   DynamoDB         │
│   │  or spider) │                    │  (Cheerio   │   (leo-listings)   │
│   └─────────────┘                    │   or LLM)   │                    │
│                                      └─────────────┘                    │
│                                                                          │
│   OUTPUT: HTML files in S3           OUTPUT: Listings for recommender   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Two Types of Domains

### Type 1: Premium Domains (Direct API/SSR)
**Fast, complete, daily updates**

| Domain | Method | Status | Listings | Coords | Lambda |
|--------|--------|--------|----------|--------|--------|
| **Engel & Völkers** | `/es/en/properties/` + `__NEXT_DATA__` | ✅ Verified | ~14,000 | ✅ In SSR | `ev-harvest-delta` |
| **Lucas Fox** | `sitemap.xml` + JSON-LD | ✅ Verified | ~4,600 | ⏳ Nominatim | `lf-harvest-delta` |
| **donpiso** | `/listado` pages + `data-code` | ✅ Verified | ~2,800 | ✅ JSON-LD | `dp-harvest-delta` |
| **Tecnocasa** ⭐ | Gzipped sitemap + Vue `:estate` | ✅ Verified | ~7,300 | ✅ In JSON | `tc-harvest-delta` |
| **Century21** | `ref/sitemap/0.xml` + HTML | ✅ Verified | ~23,000 | ⏳ Nominatim | `c21-harvest-delta` |
| **RE/MAX** | `sitemap-general.xml` index + HTML | ✅ Verified | ~8,000 | ⏳ Nominatim | `remax-harvest-delta` |
| **aProperties** | `sitemap-es.xml` + HTML | ✅ Verified | ~9,800 | ⏳ Nominatim | `aproperties-harvest-delta` |

**How Premium Domains Work:**
```
1. Fetch search/sitemap URLs
2. Download detail pages for EACH listing
3. Parse structured data (JSON-LD, SSR, meta tags)
4. Extract: title, price, location, photos, amenities, coordinates
5. Write to leo-listings table (normalized)
6. Schedule: 3x daily (7am, 12pm, 6pm Spain)
```

### ~~Type 2: General Domains (Traditional Scraping)~~ — **PARKED**

> ⚠️ **This system is PARKED and NOT IN USE.**
> We decided to focus on premium domains only for quality over quantity.

| Phase | Status | Count |
|-------|--------|-------|
| URLs Discovered | 🚫 PARKED | 587,897 |
| HTML Downloaded | 🚫 PARKED | 546,678 |
| Classified | 🚫 PARKED | 580,903 |
| Parsed | 🚫 PARKED | - |

**Parked files:** `daily-harvest-delta.ts`, `harvest-orchestrator.ts`, `spider-single.ts`, `sitemap-single.ts`, `src/harvest/*`

---

## 🗄️ Data Storage

### S3: Raw HTML
```
puedo-casa-html-archive/
└── html/
    └── {domain}/
        └── {hash}__{slug}.html
```
- **Purpose**: Archive of downloaded pages
- **Size**: ~50GB
- **Cost**: ~$1.15/month

### DynamoDB: Structured Data

| Table | Purpose | Key |
|-------|---------|-----|
| `leo-urls` | All discovered URLs + classification | `url` (PK) |
| `leo-listings` | **Parsed listings for recommender** | `listing_id` (PK) |
| `leo-scraping-rules` | Domain configurations | `domain` (PK) |
| `leo-domain-stats` | Harvest statistics | `domain` (PK) |

---

## 📋 `leo-listings` Schema (Recommender Input)

**This is what the recommender reads.** All harvests must write data in this format:

```typescript
interface LeoListing {
  // Identity
  listing_id: string;      // "ev_{uuid}" or "lf_{slug}" or "{domain}_{hash}"
  source: string;          // "engelvoelkers" | "lucasfox" | "scraped"
  source_url: string;      // Original listing URL
  
  // Core Fields (required for recommender)
  title: string;
  price: number;           // In EUR
  currency: string;        // "EUR"
  transaction: string;     // "sale" | "rent"
  
  // Location (critical for recommender)
  location: {
    address?: string;
    city?: string;
    province?: string;
    country: string;       // "ES"
    lat?: number;          // WGS84
    lng?: number;          // WGS84
  };
  
  // Property Details
  property: {
    type?: string;         // "apartment" | "house" | "villa" | etc.
    bedrooms?: number;
    bathrooms?: number;
    area_m2?: number;
    plot_m2?: number;
  };
  
  // Media
  photos: string[];        // Array of image URLs
  
  // Features (for WPA scoring)
  amenities?: string[];    // ["pool", "terrace", "garage", etc.]
  description?: string;    // Full text description
  
  // Metadata
  scraped_at: string;      // ISO timestamp
  updated_at: string;      // ISO timestamp
}
```

---

## 🚀 Lambda Functions

### Premium Domain Lambdas

| Lambda | Schedule | Purpose | Notes |
|--------|----------|---------|-------|
| `ev-harvest-delta` | 6am, 11am, 5pm UTC | Engel & Völkers harvest + parse | SSR data |
| `lf-harvest-delta` | 6am, 11am, 5pm UTC | Lucas Fox harvest + parse | Needs Nominatim |
| `dp-harvest-delta` | 6am, 11am, 5pm UTC | donpiso harvest + parse | JSON-LD |
| `tc-harvest-delta` | 6am, 11am, 5pm UTC | Tecnocasa harvest + parse | ⭐ Best data quality |
| `c21-harvest-delta` | 6am, 11am, 5pm UTC | Century21 harvest + parse | HTML parsing, largest sitemap |
| `remax-harvest-delta` | 6am, 11am, 5pm UTC | RE/MAX harvest + parse | 45 sitemaps, HTML + Nominatim |
| `aproperties-harvest-delta` | 6am, 11am, 5pm UTC | aProperties harvest + parse | Clean HTML, lastmod for delta |

**Each Lambda does BOTH harvest and parse:**
1. Fetch listing URLs from source
2. Download each detail page
3. Parse structured data
4. Write to `leo-listings` table
5. Backup raw data to S3

### General Harvest Lambdas

| Lambda | Purpose |
|--------|---------|
| `sitemap-single` | Discover URLs from sitemap.xml |
| `spider-single` | Crawl site to find URLs |
| `download-single` | Download HTML to S3 |
| `classify-single` | Classify page type |
| `parse-orchestrator-v2` | Orchestrate bulk parsing |

---

## ⚙️ Deployment

### Deploy Premium Lambdas
```bash
cd /Users/peterneyra/puedo_casa
source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION

# Deploy all harvest lambdas
bash src/lambda/deploy-lambdas.sh
```

### Manual Trigger
```bash
# Trigger E&V harvest now
aws lambda invoke --function-name ev-harvest-delta --invocation-type Event /dev/null

# Trigger Lucas Fox harvest now
aws lambda invoke --function-name lf-harvest-delta --invocation-type Event /dev/null
```

### Check Logs
```bash
# E&V logs
aws logs tail /aws/lambda/ev-harvest-delta --follow

# Lucas Fox logs  
aws logs tail /aws/lambda/lf-harvest-delta --follow
```

---

## 🗺️ Geocoding (Nominatim)

**Status**: ✅ Running and operational

| Component | Value |
|-----------|-------|
| Instance | `i-0890cad762bc0c8c7` (**c5.xlarge**, 8GB RAM) |
| IP | `3.230.148.50:8080` |
| Disk | 150GB EBS (135GB used) |
| Container | `nominatim-spain` |
| Data | Spain OSM (~70GB PostgreSQL) |
| Cost | ~$19/month (with scheduled start/stop) |

**Used by**: Lucas Fox, Century21, RE/MAX, aProperties

**Test:**
```bash
curl "http://3.230.148.50:8080/search?q=Eixample,Barcelona,Spain&format=json&limit=1"
```

---

## 📊 Current Statistics

### Premium Domains

| Source | Listings | Coordinates | Data Quality | Verified |
|--------|----------|-------------|--------------|----------|
| Engel & Völkers | ~14,000 | ✅ In SSR | Excellent | Dec 7 ✅ |
| Lucas Fox | ~4,600 | ⏳ Nominatim | Good | Dec 7 ✅ |
| donpiso | ~2,800 | ✅ JSON-LD | Very Good | Dec 7 ✅ |
| Tecnocasa | ~7,300 | ✅ In JSON | ⭐ Best | Dec 7 ✅ |
| Century21 | ~23,000 | ⏳ Nominatim | Good | Dec 7 ✅ |
| RE/MAX | ~8,000 | ⏳ Nominatim | Good | Dec 7 ✅ |
| aProperties | ~9,800 | ⏳ Nominatim | Excellent | Dec 7 ✅ |

**Total: ~69,500 listings**

### Test Script

Verify all domains can fetch N latest listings:

```bash
npx tsx scripts/test-latest-listings.ts 10
```

All 7 domains must pass before deployment.

**Tecnocasa Discovery**: Embeds COMPLETE listing data as Vue prop `:estate="{...}"` including coordinates, all images, energy data, POIs - the best data format found!

**Century21 Discovery**: Uses Next.js App Router with React Server Components. JSON-LD only renders client-side, but rich data available from HTML elements (price, beds, baths, area, photos) and og:image params (address for geocoding). Largest sitemap at 23,056 URLs.

**RE/MAX Discovery**: WordPress site with 45 sitemaps organized by property type. JSON-LD has control characters that must be sanitized, but HTML parsing works well. URL structure contains full location info (province/city/neighborhood). Photos hosted on anaconda-guru.s3.

**aProperties Discovery**: Clean HTML structure with specific CSS classes (`propHeader__priceCurrent`, `propHeader__specs__itemValue`). Sitemap has lastmod dates for efficient delta harvesting. Property IDs extractable from photo URLs (`/media/properties/{id}/`). Multi-language support (ES, EN, CA, FR, DE) but Spanish sitemap has most listings.

### General Harvest

| Metric | Count |
|--------|-------|
| Domains | 1,953 |
| URLs in DynamoDB | 587,897 |
| HTML in S3 | 546,678 |
| Classified | 580,903 |
| **Listings to Parse** | **165,695** |
| List Pages (for delta) | 263,250 |

---

## 💰 Monthly Costs

| Resource | Cost |
|----------|------|
| Lambda (3x daily × 2 domains) | ~$2 |
| DynamoDB | ~$2 |
| S3 (~50GB) | ~$1.15 |
| Nominatim EC2 (when running) | ~$15 |
| **Total (without Nominatim)** | **~$5/month** |
| **Total (with Nominatim)** | **~$20/month** |

---

## 🔄 Daily Operations

### What Runs Automatically
- **7am Spain**: E&V + Lucas Fox + donpiso + Tecnocasa + Century21 + RE/MAX + aProperties delta harvest
- **12pm Spain**: E&V + Lucas Fox + donpiso + Tecnocasa + Century21 + RE/MAX + aProperties delta harvest  
- **6pm Spain**: E&V + Lucas Fox + donpiso + Tecnocasa + Century21 + RE/MAX + aProperties delta harvest

**Total Premium Coverage**: ~48,000+ listings from 7 domains

### What Needs Manual Trigger
- Initial harvest for new domains
- Re-parsing after selector changes
- Bulk backfill operations

---

## 📁 Key Files

| Purpose | Location |
|---------|----------|
| **E&V Lambda** | `src/lambda/ev-harvest-delta.ts` |
| **Lucas Fox Lambda** | `src/lambda/lf-harvest-delta.ts` |
| **donpiso Lambda** | `src/lambda/dp-harvest-delta.ts` |
| **Tecnocasa Lambda** | `src/lambda/tc-harvest-delta.ts` |
| **Century21 Lambda** | `src/lambda/c21-harvest-delta.ts` |
| **RE/MAX Lambda** | `src/lambda/remax-harvest-delta.ts` |
| **aProperties Lambda** | `src/lambda/aproperties-harvest-delta.ts` |
| **Deploy Script** | `src/lambda/deploy-lambdas.sh` |
| **Nominatim Client** | `src/lib/geocoding/nominatim.ts` |
| **Domain Analysis Guide** | `docs/PREMIUM_DOMAIN_HARVEST_GUIDE.md` |
| **E&V Strategy Doc** | `docs/ENGEL_VOLKERS_HARVEST_STRATEGY.md` |

---

## 🎯 Harvester Requirements Specification

**Every premium harvester Lambda must implement ALL of these features.**

### Architecture: One Lambda Does Everything

```
┌─────────────────────────────────────────────────────────────────┐
│                    {domain}-harvest-delta.ts                     │
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│   │   INITIAL    │ = │    DELTA     │ = │    SAME      │        │
│   │   HARVEST    │   │   HARVEST    │   │   LAMBDA     │        │
│   └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
│   First run: Gets everything                                     │
│   Subsequent: Only processes NEW/CHANGED listings                │
│   Detection: Marks REMOVED listings automatically                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why one Lambda?**
- Simpler deployment and maintenance
- Same logic handles both cases
- S3 state file tracks what we've seen before
- DynamoDB tracks individual listing history

---

### ✅ Required Features (Non-Negotiable)

| # | Feature | Purpose | Implementation |
|---|---------|---------|----------------|
| 1 | **S3 State File** | Track harvested listings | `harvest/{domain}-listings.json.gz` |
| 2 | **Delta Logic** | Only process NEW URLs | Compare URLs vs state |
| 3 | **Sold/Removed Detection** | Mark disappeared listings | Compare crawl vs state |
| 4 | **Self-Continuation** | Re-invoke on timeout | Save state + invoke self |
| 5 | **Full Deep Crawl** | Process ALL URLs | Complete coverage |
| 6 | **Status Tracking** | Know listing state | `status: active\|removed` |
| 7 | **First/Last Seen** | Track listing age | `first_seen`, `last_seen` |
| 8 | **Price History** | Detect price changes | Array of `{price, date}` |
| 9 | **Photo Classification** | Separate floorplans | `photos`, `photos_floorplan` |
| 10 | **Parallelization** | Fast execution | 10 concurrent fetches |
| 11 | **Data Completeness** | All recommender fields | See below |
| 12 | **URLs Only (No Files)** | Store photo URLs, not images | S3 cost control |

---

### 🚫 Photo Storage Policy (Feature #12)

**Store ONLY URLs, NEVER download image files to S3.**

| Process | Action |
|---------|--------|
| **Harvester** | Store URLs only → DynamoDB |
| **WPA** | Fetch → Analyze → Discard (don't store) |
| **UI/Emails** | `<img src={url}>` directly from source CDN |

---

### 📋 Data Completeness (Feature #11)

**Every listing MUST have these fields:**

| Category | Fields |
|----------|--------|
| **Core** | `listing_id`, `url`, `title`, `price`, `bedrooms`, `bathrooms`, `sqm` |
| **Location** | `lat`, `lng`, `address`, `city`, `region`, `neighborhood` |
| **Photos** | `image_urls[]`, `photos_floorplan[]` |
| **Flags** | `has_elevator`, `has_terrace`, `has_parking`, `has_pool`, `has_ac` |
| **Tracking** | `status`, `first_seen`, `last_seen`, `days_on_market`, `price_history` |
| **Extra** | `floor`, `year_built`, `energy_class`, `description`, `amenities` |

**Coords by domain:**
- ✅ In-data: E&V, Tecnocasa, donpiso (no Nominatim)
- ❌ Needs Nominatim: Lucas Fox, Century21, RE/MAX, aProperties

---

### 📊 COMPLIANCE MATRIX (Current Status)

| Domain | S3 State | Delta | Sold Det. | Self-Continue | Status |
|--------|----------|-------|-----------|---------------|--------|
| **E&V** | ✅ | ✅ | ✅ | ❌ | Partial |
| **Lucas Fox** | ✅ | ✅ | ✅ | ❌ | Partial |
| **donpiso** | ✅ | ✅ | ✅ | ❌ | Partial |
| **Tecnocasa** | ✅ | ✅ | ✅ | ✅ | **COMPLETE** ✅ |
| **Century21** | ❌ | ❌ | ❌ | ❌ | **INCOMPLETE** |
| **RE/MAX** | ❌ | ❌ | ❌ | ❌ | **INCOMPLETE** |
| **aProperties** | ❌ | ❌ | ❌ | ❌ | **INCOMPLETE** |

**✅ COMPLETE:** Tecnocasa (all 10 features)
**⚠️ Partial:** E&V, Lucas Fox, donpiso (need self-continuation)
**🚨 Incomplete:** C21, RE/MAX, aProperties (need S3 state + delta + sold + self-continue)

---

### 📊 Status & Tracking Schema

```typescript
// Required fields in every listing written to DynamoDB
{
  // Status tracking
  status: 'active' | 'sold' | 'rented' | 'removed',
  status_signal: 'in_sitemap' | 'not_in_sitemap' | 'not_in_search' | 'page_404',
  
  // Time tracking
  first_seen: '2024-12-01T10:00:00Z',  // When we first discovered it
  last_seen: '2024-12-07T18:00:00Z',   // Last time we saw it active
  days_on_market: 6,                    // Calculated: last_seen - first_seen
  
  // Price tracking
  price: 450000,
  price_history: [
    { price: 475000, date: '2024-12-01' },
    { price: 450000, date: '2024-12-05' }  // Price drop!
  ],
  
  // Photo classification
  photos: ['url1', 'url2', ...],         // Regular interior photos
  photos_floorplan: ['floor1', ...],     // Floorplan images
  photos_exterior: ['ext1', ...],        // Exterior/building shots
  photos_other: ['other1', ...],         // 3D tours, videos, etc.
  photo_count: 15,                       // Total count
}
```

---

### 🔄 Sold/Removed Detection Logic

```typescript
// At end of each harvest run:

// 1. Build set of all IDs seen in THIS run
const currentRunIds = new Set(allListingsFromThisRun.map(l => l.id));

// 2. Check existing listings in our database
for (const [id, listing] of existingListings) {
  if (!currentRunIds.has(id)) {
    // This listing disappeared - mark as removed
    await dynamoClient.send(new UpdateCommand({
      TableName: 'leo-listings',
      Key: { domain, listing_id: id },
      UpdateExpression: 'SET #status = :removed, #signal = :signal',
      ExpressionAttributeValues: {
        ':removed': 'removed',
        ':signal': 'not_in_sitemap'  // or 'not_in_search'
      }
    }));
  }
}
```

**Recommender automatically filters these out:**
```typescript
// src/lib/recommender/harvestFilter.ts
conditions.push('(attribute_not_exists(#status) OR #status = :activeStatus)');
// Only shows status = 'active' listings
```

---

### 🆕 Freshness Guarantee Methods

| Domain | Method | Why It Works |
|--------|--------|--------------|
| **E&V** | Geo-recursive discovery | Crawls ALL sub-URLs (region→city→neighborhood), sorted by newest by default |
| **Lucas Fox** | `?sort=newest` + sitemap | Search page gives fresh, sitemap gives complete |
| **donpiso** | Priority cities + full sitemap | Process Madrid/Barcelona first, then everything else |
| **Tecnocasa** | Full gzipped sitemap | Complete coverage, fast due to compression |
| **Century21** | Full sitemap | Stale sitemap is a known limitation |
| **RE/MAX** | 45 sub-sitemaps | Iterate through all for complete coverage |
| **aProperties** | Sitemap with `lastmod` | Can use lastmod for smart delta |

---

### 📷 Photo Classification Logic

```typescript
function classifyPhotos(urls: string[]): ClassifiedPhotos {
  const result = {
    regular: [] as string[],
    floorplan: [] as string[],
    exterior: [] as string[],
    other: [] as string[],
    total: urls.length
  };
  
  for (const url of urls) {
    const lower = url.toLowerCase();
    
    if (lower.includes('plano') || lower.includes('floor') || lower.includes('plan')) {
      result.floorplan.push(url);
    } else if (lower.includes('fachada') || lower.includes('exterior') || lower.includes('building')) {
      result.exterior.push(url);
    } else if (lower.includes('video') || lower.includes('360') || lower.includes('tour')) {
      result.other.push(url);
    } else {
      result.regular.push(url);
    }
  }
  
  return result;
}
```

---

### ⚡ Parallelization Pattern

```typescript
const PARALLEL_LIMIT = 10;

async function scrapeInParallel<T>(
  urls: string[],
  scrapeFunc: (url: string) => Promise<T | null>
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < urls.length; i += PARALLEL_LIMIT) {
    const batch = urls.slice(i, i + PARALLEL_LIMIT);
    
    const batchResults = await Promise.all(
      batch.map(url => scrapeFunc(url))
    );
    
    results.push(...batchResults.filter(Boolean) as T[]);
  }
  
  return results;
}
```

---

### 🗺️ Nominatim Integration (When Needed)

**Only use if coordinates NOT in source data.**

```typescript
const NOMINATIM_URL = 'http://3.230.148.50:8080';

async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
  // Try multiple query permutations for compound addresses
  const queries = [
    address,
    address.replace(' | ', ', '),  // "El Campello | Villajoyosa" → "El Campello, Villajoyosa"
    address.split(',')[0] + ', Spain'
  ];
  
  for (const q of queries) {
    const response = await fetch(
      `${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&countrycodes=es&limit=1`
    );
    const data = await response.json();
    
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  }
  
  return null;
}
```

**Known Limitation**: Nominatim doesn't cover Canary Islands (PBF is mainland Spain only).

---

### 📁 Lambda File Structure

```typescript
// src/lambda/{domain}-harvest-delta.ts

// 1. Imports and config
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as cheerio from 'cheerio';
import * as zlib from 'zlib';

const DOMAIN = '{domain}';
const S3_BUCKET = 'puedo-casa-html-archive';
const LISTINGS_KEY = `harvest-state/${DOMAIN}-listings.json.gz`;
const PARALLEL_LIMIT = 10;

// 2. Types
interface Listing { ... }

// 3. Fetch functions
async function fetchSitemap(): Promise<string[]> { ... }
async function fetchDetailPage(url: string): Promise<Listing | null> { ... }

// 4. Parse functions
function parseDetailPage(html: string): Listing { ... }
function classifyPhotos(urls: string[]): ClassifiedPhotos { ... }

// 5. Tracking functions
function updateTracking(existing: Listing | null, current: Listing): ListingTracking { ... }

// 6. Write functions
async function writeToLeoListings(listing: Listing): Promise<void> { ... }
async function saveState(listings: Map<string, Listing>): Promise<void> { ... }

// 7. Handler
export async function handler(event: any): Promise<any> {
  const startTime = Date.now();
  
  // Load existing state from S3
  const existingListings = await loadExistingListings();
  
  // Get current URLs (sitemap/search)
  const currentUrls = await fetchSitemap();
  
  // Filter to new URLs only
  const newUrls = currentUrls.filter(url => !existingListings.has(extractId(url)));
  
  // Scrape in parallel batches
  const newListings = await scrapeInParallel(newUrls, fetchDetailPage);
  
  // Write to DynamoDB with tracking
  for (const listing of newListings) {
    const tracking = updateTracking(existingListings.get(listing.id), listing);
    await writeToLeoListings({ ...listing, ...tracking });
  }
  
  // CRITICAL: Detect removed listings
  const currentIds = new Set(currentUrls.map(extractId));
  for (const [id] of existingListings) {
    if (!currentIds.has(id)) {
      await markAsRemoved(id);
    }
  }
  
  // Save state to S3
  await saveState(existingListings);
  
  return { newListings: newListings.length, total: existingListings.size };
}
```

---

## ✅ Checklist: Adding a New Premium Domain

1. [ ] Analyze site structure (SSR? JSON-LD? API?)
2. [ ] Identify data endpoints (search pages, sitemap)
3. [ ] **Determine freshness strategy** (sort by newest? full sitemap?)
4. [ ] Map fields to `leo-listings` schema
5. [ ] Create Lambda: `{domain}-harvest-delta.ts`
6. [ ] **Implement status tracking** (active/removed)
7. [ ] **Implement price history tracking**
8. [ ] **Implement photo classification**
9. [ ] **Add sold/removed detection**
10. [ ] **Add parallelization** (10 concurrent)
11. [ ] Test locally with sample URLs
12. [ ] Add to `deploy-lambdas.sh`
13. [ ] Deploy and schedule (CloudWatch Events)
14. [ ] Monitor first few runs
15. [ ] Document in this file

---

## 🐛 Troubleshooting

### Lambda Times Out
- Check rate limiting (add delays)
- Reduce batch size
- Check network issues

### No Data in leo-listings
- Check Lambda logs for errors
- Verify DynamoDB permissions
- Check if source site changed structure

### Geocoding Fails
- Check Nominatim EC2 is running
- Check disk space on EC2
- Fall back to null coordinates (backfill later)

### Classification Wrong
- Review `src/harvest/page-classifier.ts`
- Check for site structure changes
- Add domain-specific rules if needed

---

*For detailed implementation notes, see individual strategy docs in `docs/`*
