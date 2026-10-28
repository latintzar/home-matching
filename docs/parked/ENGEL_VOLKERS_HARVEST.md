# Engel & Völkers Direct Harvest

> **TL;DR**: We extract listing data from embedded JSON in their HTML pages. No API needed!
> Got 6,016 listings in ~3 minutes. Could get more with deeper geo-segmentation.

## 🎯 The Discovery

Engel & Völkers uses **Next.js with Server-Side Rendering (SSR)**. This means:
- Search results are embedded directly in the HTML as JSON
- No API calls needed - just parse the HTML
- Data is in a `<script id="__NEXT_DATA__">` tag

## 🔧 How It Works

### The Mechanism (NOT an API!)

```
1. Browser requests: https://www.engelvoelkers.com/es/en/properties/res/rent/house
   
2. Server returns HTML with embedded JSON:
   <script id="__NEXT_DATA__" type="application/json">
   {
     "props": {
       "pageProps": {
         "searchModule": {
           "initialSearchResults": {
             "listingsTotal": 578,        ← Total available
             "listings": [...]            ← Only 35 returned (SSR limit)
           }
         }
       }
     }
   }
   </script>

3. We extract the JSON and parse listings
```

### Why Only 35 Per Page?

Next.js SSR returns a **fixed 35 listings** per page. Pagination happens **client-side** via their internal API (which blocks external access with 301 redirects).

### Our Workaround: Geo-Segmentation

Since each URL returns 35 listings, we hit **every region/city URL**:

```
Base URL: /es/en/properties/res/rent/house (35 listings from Spain)
│
├── /andalusia (35 from Andalusia)
│   ├── /costa-del-sol (35 from Costa del Sol)
│   ├── /seville (35 from Seville)
│   └── ...
│
├── /catalonia (35 from Catalonia)
│   ├── /barcelona (35 from Barcelona)
│   ├── /costa-brava (35 from Costa Brava)
│   └── ...
│
└── ...
```

Each URL returns up to 35 **different** listings. We deduplicate by listing ID.

## 📊 Results

### What We Captured

| Category | E&V Claims | We Got | Coverage |
|----------|------------|--------|----------|
| Rent/House | 578 | 359 | 62% |
| Rent/Apartment | 1,199 | 471 | 39% |
| Sale/House | 6,623 | 2,776 | 42% |
| Sale/Apartment | 5,258 | 1,607 | 31% |
| Sale/Land | 1,231 | 803 | 65% |
| **TOTAL** | **~14,889** | **6,016** | **40%** |

### Why We're Missing 60%

The gap comes from **regions with >35 listings**:
- Barcelona might have 500 listings
- Their Barcelona page only returns 35
- Sub-areas (Eixample, Gràcia, etc.) might not have dedicated URLs

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

Photos use **UploadCare CDN**:
```
https://ucarecdn.com/{imageId}/-/scale_crop/760x506/
```

## 🚀 Scripts

### Full Harvest
```bash
npx tsx scripts/ev-full-harvest.ts
```

### Output
- **File**: `data/ev-listings-full.json`
- **Size**: ~177K lines
- **Time**: ~3 minutes

## 🔮 Improvements to Get 100%

### Option 1: More Granular Geo-Segmentation
- Extract ALL sub-region URLs from each page
- Recursively follow links to get more specific areas
- Issue: Diminishing returns, some areas share listings

### Option 2: Browser Automation
- Use Playwright to scroll/paginate client-side
- Issue: Slower, rate limiting, IP blocks

### Option 3: Discover Their Internal API
- Monitor network requests to find API format
- Issue: They return 301 for external requests

### Option 4: Accept 40% Coverage
- 6,016 listings is still substantial
- Run daily to catch new listings
- Deduplication ensures we grow over time

## 📝 Key Learnings

1. **SSR sites embed data as JSON** - No need for HTML parsing with Cheerio
2. **Geo-segmentation bypasses pagination limits** - Hit every region URL
3. **Photo IDs are UUIDs** - Easy to construct CDN URLs
4. **Agency attribution is included** - Good for source tracking
5. **Deduplication is critical** - Same listing appears on multiple region pages

## 🎯 Applicability to Other Agencies

This approach works for ANY Next.js SSR site. Check if they have:
- `__NEXT_DATA__` script tag in HTML
- Region/city-specific URLs
- Listings embedded in pageProps

**Candidates to investigate:**
- Century21 (might use similar stack)
- Coldwell Banker
- Sotheby's International Realty
- Other modern agency websites

---

**Last Updated**: 2025-12-05
**Total Listings**: 6,016
**Coverage**: ~40% of E&V Spain inventory

