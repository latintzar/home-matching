# Harvest Session - December 5, 2025

> **Session Summary**: Fixed spider blocklist, re-spidered priority domains, discovered Engel & Völkers SSR extraction method - got 6,016 listings in 3 minutes!

---

## 1. The Problem: Domains With Zero Listings

### Background
After running the full harvest pipeline (sitemap + spider + classification), we discovered **~700 domains had 0 classified listings**. This was concerning because these included major agencies.

### Investigation
We created a tracking system to understand the issue:

```bash
# The old way was SLOW - scanning entire DynamoDB table
aws dynamodb scan --table-name leo-urls --filter-expression "domain = :d" ...
# This took forever and gave incomplete results
```

### Solution: Domain Stats Table

Created `scripts/build-domain-stats.ts` to pre-aggregate stats into `leo-domain-stats` DynamoDB table:

```typescript
// Aggregates per domain:
{
  domain: "example.com",
  urls: 1234,           // Total URLs discovered
  html: 890,            // URLs with downloaded HTML
  listings: 456,        // Classified as listings
  list_pages: 123,      // Classified as list pages
  junk: 311,            // Classified as junk
  classification_breakdown: [...],
  last_updated: "2025-12-05T..."
}
```

**Run**: `npx tsx scripts/build-domain-stats.ts`

### Documented Issues
- See `docs/HARVEST_TRACKING_ISSUES.md` - Why tracking was messy
- See `docs/DOMAINS_WITHOUT_LISTINGS.md` - Full list of 700+ domains with 0 listings

---

## 2. Spider Blocklist Bug

### The Problem
Major agencies like Century21, RE/MAX had very few pages crawled. Investigation revealed the spider's blocklist was **too aggressive**:

```typescript
// OLD BLOCKLIST (BAD)
const BLOCKLIST = [
  /\.(pdf|jpg|jpeg|png|gif|css|js|xml|json)$/i,  // ❌ Blocked sitemaps/APIs!
  /\/category\//i,                                // ❌ Blocked listing categories!
  /\/page\/\d+$/i,                                // ❌ BLOCKED PAGINATION!
  ...
];
```

### The Fix
Updated `src/lambda/spider-single.ts`:

```typescript
// NEW BLOCKLIST (FIXED)
const BLOCKLIST = [
  /\.(pdf|jpg|jpeg|png|gif|css|js)$/i,  // ✅ Removed xml, json
  // REMOVED: /\/category\//             // ✅ Keep categories
  // REMOVED: /\/page\/\d+$/             // ✅ KEEP PAGINATION!
  ...
];
```

### Re-Spider Executed
- Redeployed `spider-single` Lambda
- Fired 36 Lambda invocations for priority domains
- Major agencies got 3 passes each

**Scripts**:
- `scripts/respider-fire.ts` - Fire-and-forget spider invocations

---

## 3. 🏆 The Engel & Völkers Discovery

### User's Wild Idea
User had saved an E&V webpage locally. Asked: "Can you check if they use an API?"

### What We Found
E&V uses **Next.js with Server-Side Rendering (SSR)**. This means:
- Search results are **embedded as JSON** in the HTML
- Located in `<script id="__NEXT_DATA__">` tag
- **No API calls needed** - just parse the HTML!

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch HTML page                                         │
│     GET https://www.engelvoelkers.com/es/en/.../rent/house  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. HTML contains embedded JSON:                            │
│                                                             │
│     <script id="__NEXT_DATA__" type="application/json">     │
│     {                                                       │
│       "props": {                                            │
│         "pageProps": {                                      │
│           "searchModule": {                                 │
│             "initialSearchResults": {                       │
│               "listingsTotal": 578,                         │
│               "listings": [                                 │
│                 {                                           │
│                   "id": "abc123",                           │
│                   "price": 4000,                            │
│                   "bedrooms": 3,                            │
│                   "city": "Barcelona",                      │
│                   "imageIds": ["uuid1", "uuid2", ...]       │
│                 },                                          │
│                 ...                                         │
│               ]                                             │
│             }                                               │
│           }                                                 │
│         }                                                   │
│       }                                                     │
│     </script>                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Extract JSON → Get structured listing data!             │
│     - Already parsed (no Cheerio needed)                    │
│     - Price is a number, not "€4,000"                       │
│     - Photo UUIDs ready for CDN                             │
└─────────────────────────────────────────────────────────────┘
```

### The 35-Listing Limit Problem

SSR returns **only 35 listings per page**. Pagination is client-side JS.

**Solution**: Geo-segmentation - hit every region/city/neighborhood URL:
- `/es/en/properties/res/sale/house` → 35 listings
- `/es/en/properties/res/sale/house/catalonia` → 35 different listings
- `/es/en/properties/res/sale/house/catalonia/barcelona` → 35 more
- `/es/en/properties/res/sale/house/catalonia/barcelona/eixample` → 35 more

### Results

| Metric | Value |
|--------|-------|
| **Total Listings** | **6,016** |
| For Rent | 830 |
| For Sale | 5,186 |
| URLs Scraped | 1,360 |
| Time | ~3 minutes |

**Coverage**: ~40% of their claimed inventory (they say ~14,000 in Spain)

### Data Per Listing

```json
{
  "id": "a0d8ff0e-b779-5322-a58d-ec0bfb9af176",
  "displayId": "W-047OK9",
  "propertyType": "house",
  "marketingType": "rent",
  "title": "New spacious modern villa with spectacular views",
  "price": 4000,
  "priceType": "rent",
  "bedrooms": 3,
  "bathrooms": 5,
  "totalSurface": 496.4,
  "plotSurface": 595,
  "country": "Spain",
  "region": "Valencian Community",
  "city": "Golf Badia",
  "shopName": "Engel & Völkers Benidorm",
  "imageIds": ["9acf7f0c-ea03-4b91-ae65-2d2f4134c232", ...],
  "url": "https://www.engelvoelkers.com/es/en/property/W-047OK9"
}
```

### Photo URLs
Photos use UploadCare CDN:
```
https://ucarecdn.com/{imageId}/-/scale_crop/760x506/
```

---

## 4. Scripts Created

| Script | Purpose |
|--------|---------|
| `scripts/ev-harvest.ts` | Basic E&V harvest (page 1 only) |
| `scripts/ev-full-harvest.ts` | Geo-segmented harvest (got 6,016) |
| `scripts/ev-deep-harvest.ts` | Recursive URL discovery (not fully run) |
| `scripts/respider-fire.ts` | Fire spider Lambdas for priority domains |
| `scripts/build-domain-stats.ts` | Aggregate domain stats to DynamoDB |

---

## 5. Output Files

| File | Content |
|------|---------|
| `data/ev-listings-full.json` | 6,016 E&V listings (177K lines) |

---

## 6. Where We Left Off

### Completed ✅
- [x] Fixed spider blocklist (removed pagination/category blocks)
- [x] Re-deployed spider-single Lambda
- [x] Fired 36 re-spider invocations for priority domains
- [x] Discovered E&V SSR extraction method
- [x] Harvested 6,016 E&V listings
- [x] Created domain stats tracking table

### Next Steps 🔜
1. **Check spider results** - Did re-spider get more pages for major agencies?
2. **Deep E&V harvest** - Run recursive URL discovery to get closer to 100%
3. **Check other agencies** - Do Century21, RE/MAX, Coldwell Banker use similar SSR patterns?
4. **Import E&V data** - Load 6,016 listings into our database
5. **Daily E&V refresh** - Set up cron to catch new listings

---

## 7. Key Insight

**Not all scraping requires traditional HTML parsing!**

Modern Next.js/React sites often embed data as JSON for SSR hydration. This gives us:
- **Structured data** without parsing
- **Faster extraction** (no DOM traversal)
- **Cleaner results** (data already typed)

Look for `__NEXT_DATA__` in any React site's HTML source.

---

## 8. Documentation References

- `docs/ENGEL_VOLKERS_HARVEST.md` - Full E&V harvest documentation
- `docs/HARVEST_TRACKING_ISSUES.md` - Why tracking was problematic
- `docs/DOMAINS_WITHOUT_LISTINGS.md` - List of 700+ domains with 0 listings
- `docs/RESPIDER_PRIORITY_LIST.md` - Priority domains for re-spidering

---

**Session Date**: December 5, 2025
**Duration**: ~2 hours
**Major Win**: 6,016 E&V listings in 3 minutes via SSR extraction

