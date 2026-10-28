# Engel & Völkers Harvest Strategy V2

> **TL;DR**: Two-phase harvest extracts FULL property data including amenities, coordinates, and all photos
> 
> **Current Coverage**: 6,016 listings (40% of claimed 14,889)
> **Target Coverage**: 80-90% with full property details

---

## 🎯 Key Discovery: Detail Pages Have Everything!

### The Problem with Search Pages
E&V search pages (SSR) only provide:
- ❌ 10 photos max (properties have 40-50!)
- ❌ No coordinates (lat/lng)
- ❌ No amenities (pool, garden, etc.)
- ❌ No description text
- ❌ No construction year, condition, etc.

### The Solution: Detail Page URLs

**URL Pattern**: `https://www.engelvoelkers.com/es/en/exposes/{UUID}`

The detail page `__NEXT_DATA__` contains **everything**:

| Field | Search Page | Detail Page |
|-------|-------------|-------------|
| Photos | 10 images | **47 images** (4.7x more!) |
| Coordinates | ❌ None | ✅ `displayLat`, `displayLng` |
| Amenities | ❌ None | ✅ Full list |
| Description | ❌ None | ✅ Full text |
| Year Built | ❌ None | ✅ `constructionYear` |
| Condition | ❌ None | ✅ `condition` |

### Verified Example

```
Search Page:  10 images, no coords, no amenities
Detail Page:  47 images, lat: 41.215, lng: 1.554
              garden ✓, pool ✓, terrace ✓, built-in kitchen ✓
              Built: 1998, Condition: Very Good, Flooring: Tiles
```

---

## 🚀 Two-Phase Harvest Strategy

### Phase 1: Discover All Listings (Search Pages)

**Script**: `scripts/ev-full-harvest-v2.ts`

1. Recursively crawl all geo-segmented search URLs
2. Extract listing IDs (UUIDs) and basic data from `__NEXT_DATA__`
3. Build complete list of all listing IDs
4. Save progress to resume if interrupted

**Time**: ~15-30 minutes
**Output**: List of all listing IDs + basic data

### Phase 2: Enrich Each Listing (Detail Pages)

**Script**: Same script, continues from Phase 1

1. For each listing ID, construct detail URL: `/es/en/exposes/{UUID}`
2. Fetch detail page and parse `__NEXT_DATA__`
3. Extract coordinates, amenities, description, all photos
4. Save incrementally to avoid data loss

**Time**: ~2-3 hours for 6,000 listings (300ms delay each)
**Output**: Complete property data with all fields

---

## 📊 Complete Data Schema

### From Search Page (Phase 1)
```typescript
interface EVListingBasic {
  id: string;              // UUID for detail page URL
  displayId: string;       // Human-readable: "W-02X0DI"
  propertyType: string;    // "house", "apartment", "land"
  marketingType: string;   // "rent" or "sale"
  title: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  totalSurface: number | null;
  livingSurface: number | null;
  plotSurface: number | null;
  country: string;
  region: string;
  city: string;
  shopName: string;
  imageIds: string[];      // Only 10 images
  isNew: boolean;
  isExclusive: boolean;
}
```

### From Detail Page (Phase 2)
```typescript
interface EVListingFull extends EVListingBasic {
  // Location
  lat: number | null;      // 41.21536880059024
  lng: number | null;      // 1.5543269718575443
  
  // Amenities
  amenities: {
    hasGarden: boolean;
    hasSwimmingPool: boolean;
    hasTerrace: boolean;
    hasBalcony: boolean;
    hasBasement: boolean;
    hasBuiltInKitchen: boolean;
    hasBuiltInWardrobe: boolean;
    hasMountainView: boolean;
    hasPatio: boolean;
    hasCoveredParking: boolean;
    isFurnished: boolean;
    isPetsAllowed: boolean;
  };
  
  // Description
  description: string;           // Full property description
  locationDescription: string;   // Neighborhood/area info
  
  // Building Details
  constructionYear: number | null;  // 1998
  condition: string;                // "condition.veryGood"
  flooring: string[];               // ["tiles", "parquet"]
  heatingType: string[];            // ["heatingType.radiator"]
  floors: number | null;
  
  // All Photos
  allImageIds: string[];  // 47 images vs 10 from search!
  
  // Agency
  agentName: string;
  shopEmail: string;
  shopPhone: string;
  
  // Timestamps
  url: string;
  detailUrl: string;
  harvestedAt: string;
  enrichedAt: string | null;
  publishedAt: string | null;
}
```

### Photo URL Construction
```typescript
// Photos use UploadCare CDN
const getPhotoUrl = (imageId: string, width = 760, height = 506) =>
  `https://ucarecdn.com/${imageId}/-/scale_crop/${width}x${height}/`;
```

---

## 📁 Script Files

```
scripts/
├── ev-full-harvest-v2.ts   # NEW: Two-phase harvest (recommended)
├── ev-deep-harvest.ts      # Old: Search pages only
├── ev-daily-delta.ts       # Daily incremental updates
└── ev-full-harvest.ts      # Old: Basic geo-segmented

data/
├── ev-listings-v2.json         # Full data (Phase 1 + Phase 2)
├── ev-harvest-progress.json    # Resume tracking
├── ev-listings-deep.json       # Old: Search data only
└── ev-listings-full.json       # Old: Initial 6,016 listings
```

---

## 🔧 Running the Harvest

### Initial Full Harvest

```bash
cd /Users/peterneyra/puedo_casa

# Run two-phase harvest (can be interrupted and resumed)
npx tsx scripts/ev-full-harvest-v2.ts
```

**Phase 1** (15-30 min):
- Discovers all listing IDs from search pages
- Can be interrupted - progress saved

**Phase 2** (2-3 hours):
- Fetches detail page for each listing
- 300ms delay between requests
- Progress saved every 50 listings
- Can be interrupted and resumed

### Daily Delta Updates

```bash
# Check for new listings (2-3 min)
npx tsx scripts/ev-daily-delta.ts
```

Checks first page of each category for new listings. New listings get full detail page fetch.

---

## 📅 Operational Schedule

### Initial Setup (One-Time)

```bash
# Run full two-phase harvest
npx tsx scripts/ev-full-harvest-v2.ts

# Check progress if interrupted
cat data/ev-harvest-progress.json

# Resume if needed
npx tsx scripts/ev-full-harvest-v2.ts  # Automatically resumes
```

### Daily Operations (3x/day)

| Time | Action | Expected |
|------|--------|----------|
| 08:00 | `npx tsx scripts/ev-daily-delta.ts` | 10-30 new listings |
| 14:00 | `npx tsx scripts/ev-daily-delta.ts` | 10-30 new listings |
| 20:00 | `npx tsx scripts/ev-daily-delta.ts` | 10-30 new listings |

---

## 📈 Expected Results

| Metric | Phase 1 | Phase 2 |
|--------|---------|---------|
| Time | 15-30 min | 2-3 hours |
| Listings | 10,000+ | 10,000+ |
| Photos/listing | 10 | 40-50 |
| Has coordinates | 0% | 100% |
| Has amenities | 0% | 100% |
| Has description | 0% | 100% |

---

## ⚠️ Rate Limiting & Best Practices

1. **Search pages**: 200ms delay
2. **Detail pages**: 300ms delay (stricter)
3. **Max consecutive errors**: 5 (then pause)
4. **Save frequency**: Every 50 listings
5. **User-Agent**: Standard browser UA
6. **Sequential requests**: No parallelism

---

## 🔄 Data Pipeline Integration

```
E&V Harvest V2 → data/ev-listings-v2.json
     ↓
Parse & Normalize → DynamoDB (leo-listings)
     ↓
Photo Download → S3 (puedo-casa-html-archive)
     ↓
WPA Analysis → Property scoring (now with amenities!)
```

---

## 🎯 Success Criteria

| Milestone | Target | Status |
|-----------|--------|--------|
| Phase 1 complete | 10,000+ listing IDs | ⏳ Pending |
| Phase 2 complete | 100% enriched | ⏳ Pending |
| All have coordinates | 100% | ⏳ Pending |
| All have amenities | 100% | ⏳ Pending |
| Daily delta working | <5 min runtime | ⏳ Pending |

---

**Last Updated**: 2025-12-05
**Version**: 2.0 (Two-Phase Approach)
**Author**: Cursor Agent
