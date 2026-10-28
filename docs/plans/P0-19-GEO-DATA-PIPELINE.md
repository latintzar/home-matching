# P0-19: Geo Data Pipeline — Spain Spatial Infrastructure

> **Parent:** [P0 Index](./P0_INDEX.md)
> 
> **Status:** ✅ COMPLETE (Dec 7, 2025)
> 
> **Purpose:** Load all geospatial data for Spain into DynamoDB to enable:
> 1. Landing page "map comparison" visual with real neighborhood boundaries
> 2. Production app location scoring with rapid queries

---

## 🎉 Pipeline Complete!

| Table | Records | Purpose | Cost |
|-------|---------|---------|------|
| `leo-census-sections` | **36,308** | Income per census section (INE) | ~$0.05 |
| `leo-neighborhood-boundaries` | **17,594** | Barrio polygons for SERP matching | ~$0.02 |
| `leo-osm-pois` | **595,191** | Parks, metro, beaches, schools, supermarkets, healthcare | ~$0.75 |
| `leo-atp-pois` | **92,375** | Chain businesses, cafes, restaurants, gyms | ~$0.12 |
| **TOTAL** | **741,468** | **All of Spain geospatial infrastructure** | **~$0.94** |

> ✅ **Verified via DynamoDB scan** — Dec 7, 2025

### Neighborhoods by Major City

| City | Barrios Imported |
|------|------------------|
| Other Spain | 16,085 |
| Málaga | 368 |
| Barcelona | 220 |
| Madrid | 197 |
| Valencia | 138 |
| Sevilla | 128 |
| Bilbao | 68 |
| Zaragoza | 17 |

---

## The Complete Heatmap Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   LAYER 4: QUALITY POIs (ScrapingDog + Flash-Lite)                         │
│   ═══════════════════════════════════════════════                          │
│   When: User asks for something SPECIFIC or QUALITY-DEPENDENT              │
│   Examples: "Good specialty coffee", "Best gyms", "LGBTQ bars"             │
│   Cost: ~$0.01/search + ~$0.002 Flash-Lite                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 3b: VIBE POIs (AllThePlaces) ✅ 92,375 imported                    │
│   ═══════════════════════════════════                                      │
│   Source: alltheplaces.xyz GeoJSON                                         │
│   What: Cafe density, restaurant density → "area vibe"                     │
│   Updates: Weekly                                                          │
│   Cost: FREE                                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 3a: STATIC POIs (spain.pbf) ✅ 126,009 imported                    │
│   ═════════════════════════════════                                        │
│   Source: geo2day.com spain.pbf + canary-islands.pbf                       │
│   What: Parks, metro, beaches, schools, supermarkets, healthcare           │
│   Query: Turf.js distance to nearest                                       │
│   Cost: FREE                                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 2: NEIGHBORHOOD MULTIPLIER (spain.pbf + SERP) ✅ 17,221 imported   │
│   ════════════════════════════════════════════════════                     │
│   Source: spain.pbf admin_level=10 (barrios) + SERP research               │
│   What: 20 lifestyle dimensions per barrio                                 │
│   Query: Point-in-polygon → barrio → SERP scores → multiplier (0.7x-1.3x)  │
│   Cost: FREE (pre-computed)                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 1.5: INCOME LAYER (Census Sections + INE) ✅ 36,317 imported       │
│   ═══════════════════════════════════════════════                          │
│   Source: spain-datasets GeoJSON + "Renta media en España" CSV             │
│   What: Income per person/household per census section                     │
│   Query: Point-in-polygon → census section → income → budget match         │
│   Cost: FREE                                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 1: COMMUTE PENALTY (Anchor Points + Turf.js)                       │
│   ════════════════════════════════════════════════════                     │
│   Source: User anchor addresses → Geocoding → Turf.js radial circles       │
│   Geocoding: Geoapify (3,000/day free tier) — Nominatim for harvesting     │
│   Query: Distance → estimate minutes → penalty curve                       │
│   Cost: FREE (within 3k/day limit)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources Summary

| Layer | Source | Updates | Cost | Status |
|-------|--------|---------|------|--------|
| **Anchor geocoding** | Geoapify (heatmaps) / Nominatim (harvesting) | On-demand | FREE (3k/day) | ✅ Ready |
| **Commute circles** | Turf.js | On-demand | FREE | ✅ Ready |
| **Census income** | spain-datasets GeoJSON + CSV | Yearly | FREE | ✅ Imported |
| **Barrio polygons** | spain.pbf admin_level=10 | Monthly | FREE | ✅ Imported |
| **SERP dimensions** | Pre-researched per barrio | Quarterly | ~$0.10/barrio | ✅ 78 matched |
| **Static POIs** | spain.pbf (parks, metro, coast) | Monthly | FREE | ✅ Imported |
| **Vibe POIs** | AllThePlaces | Weekly | FREE | ✅ Imported |
| **Quality POIs** | ScrapingDog + Flash-Lite | On-demand | ~$0.01/search | ✅ Ready |

---

## Data Files Downloaded

```
data/geo/
├── pbf/
│   ├── spain.pbf           # 1.1 GB - mainland + Balearics
│   └── canary-islands.pbf  # 47 MB
├── spain-datasets/         # Git clone from miguel-angel-monjas
│   ├── data/census/*.json  # Census section GeoJSON by region
│   └── data/Renta media en España.csv
├── alltheplaces/
│   └── output/             # 1.4 GB extracted GeoJSON files
└── osm-extracts/
    ├── barrios.geojson     # admin_level=10 boundaries
    ├── parks.geojson       # All named parks
    ├── metro.geojson       # Metro/subway stations
    ├── beaches.geojson     # Beach polygons
    ├── schools.geojson     # Schools
    ├── supermarkets.geojson
    └── healthcare.geojson
```

---

## Scripts Created

| Script | Purpose | Location |
|--------|---------|----------|
| `extract-osm-pois.sh` | Extract POI types from spain.pbf using osmium | `scripts/geo/` |
| `import-census-sections.ts` | Import census GeoJSON + join income CSV → DynamoDB | `scripts/geo/` |
| `import-osm-barrios.ts` | Import admin_level=10 boundaries → DynamoDB | `scripts/geo/` |
| `import-osm-pois.ts` | Import named parks, metro, beaches, etc → DynamoDB | `scripts/geo/` |
| `import-alltheplaces.ts` | Filter Spain POIs from AllThePlaces → DynamoDB | `scripts/geo/` |

### Script Features
- ✅ Batch writes (25 items per batch)
- ✅ Duplicate key handling (appends counter)
- ✅ Oversized geometry handling (skips >350KB)
- ✅ Progress indicators
- ✅ Dry-run mode
- ✅ Type filtering (--type flag)
- ✅ Region filtering (--region flag)

---

## DynamoDB Table Schemas

### `leo-census-sections`

```typescript
{
  PK: "ES",                        // Country
  SK: "08019060012",               // CUSEC code (unique census section ID)
  cusec: string,
  province_code: string,           // "08" = Barcelona
  municipality_name: string,
  province_name: string,
  community_name: string,          // "Cataluña"
  geometry: GeoJSON.Polygon,
  centroid: { lng: number, lat: number },
  bbox: { minLat, maxLat, minLng, maxLng },
  income_per_person: number,       // €/year
  income_per_household: number,    // €/year
  geohash: string,                 // 7-char for spatial queries
  importedAt: string
}
```

### `leo-neighborhood-boundaries`

```typescript
{
  city: string,                    // "barcelona", "madrid", "other"
  neighborhood_id: string,         // Normalized name: "gracia", "el-born"
  osmId: string,
  name: string,                    // Original: "Gràcia"
  nameEs: string | null,           // Spanish name variant
  nameCa: string | null,           // Catalan name variant
  adminLevel: string,              // Usually "10"
  wikidata: string | null,
  wikipedia: string | null,
  centroid: { lng, lat },
  bbox: { minLat, maxLat, minLng, maxLng } | null,
  geohash: string,
  geometry: GeoJSON.Polygon | null, // null if oversized
  geometryOversized: boolean,
  serpData: object | null,         // To be populated via SERP matching
  importedAt: string
}
```

### `leo-osm-pois`

```typescript
{
  PK: string,                      // POI type: "park", "metro", "beach", etc.
  SK: string,                      // "{geohash}#{osmId}"
  osmId: string,
  type: string,
  name: string,
  centroid: { lng, lat },
  geohash: string,
  tags: object,                    // All OSM tags
  importedAt: string
}
```

### `leo-atp-pois`

```typescript
{
  PK: string,                      // Brand/category
  SK: string,                      // "{geohash}#{id}"
  id: string,
  brand: string | null,
  name: string,
  centroid: { lng, lat },
  geohash: string,
  addr_country: string,            // "ES" (filtered)
  category: string,
  properties: object,              // All AllThePlaces properties
  importedAt: string
}
```

---

## Query Flow Example

```typescript
async function scoreLocation(listing: Listing, user: UserProfile): number {
  
  // LAYER 1: COMMUTE PENALTY
  const anchors = await geocodeAnchors(user.anchors); // Geoapify (3k/day free)
  const commutePenalty = calculateCommutePenalty(listing, anchors); // Turf.js
  // → -10 (35 min from work)

  // LAYER 1.5: INCOME MATCH
  const censusSection = pointInPolygon(listing.coords, censusSections);
  const incomeMatch = matchBudget(censusSection.income_per_person, user.budget);
  // → 0.85 (good match)

  // LAYER 2: NEIGHBORHOOD MULTIPLIER
  const barrio = pointInPolygon(listing.coords, barrios);
  const serpProfile = getSerpProfile(barrio.name);
  const lifestyleMultiplier = calculateMultiplier(serpProfile, user.weights);
  // → 1.26x

  // LAYER 3a: STATIC POIs
  const parkScore = scoreNearestPOI(listing, 'park');   // → 8/10
  const metroScore = scoreNearestPOI(listing, 'metro'); // → 9/10
  const beachScore = scoreNearestPOI(listing, 'beach'); // → 4/10

  // LAYER 3b: VIBE POIs
  const cafeCount = countPOIsInRadius(listing, 'cafe', 500);
  const vibeScore = normalizeVibe(cafeCount); // → 8/10

  // LAYER 4: QUALITY POIs (only if user asked for something specific)
  let qualityScore = null;
  if (user.qualityPOIs.length > 0) {
    const shops = await scrapingDogSearch(user.qualityPOIs[0].query);
    const scored = await flashLiteScore(shops, user.preferences);
    qualityScore = scoreNearestQuality(listing, scored);
  }

  // COMBINE
  const poiScore = weightedAverage([parkScore, metroScore, beachScore, vibeScore, qualityScore]);
  return (poiScore * lifestyleMultiplier * incomeMatch) + commutePenalty;
}
```

---

## Phase Completion Log

| Phase | What | Records | Status |
|-------|------|---------|--------|
| **Phase 1** | Download spain.pbf + canary-islands.pbf | 1.1 GB | ✅ Complete |
| **Phase 2** | Clone spain-datasets repo (census + income) | - | ✅ Complete |
| **Phase 3** | Download AllThePlaces output.zip | 1.4 GB | ✅ Complete |
| **Phase 4** | Extract OSM POIs with osmium | 7 files | ✅ Complete |
| **Phase 5** | Import census sections → DynamoDB | **36,308** | ✅ Complete |
| **Phase 6** | Import OSM POIs → DynamoDB | **595,191** | ✅ Complete |
| **Phase 7** | Import AllThePlaces → DynamoDB | **92,375** | ✅ Complete |
| **Phase 8** | Import OSM Barrios → DynamoDB | **17,594** | ✅ Complete |
| **Phase 9** | Match SERP data to barrios by name | **78/86 (91%)** | ✅ Complete |
| **Phase 10** | Live map component | TBD | ⏳ Pending |
| **TOTAL DATA IMPORT** | **~1 hr total** | **741,468** | ✅ **Complete** |

### SERP Matching Details (Phase 9)

78 of 86 SERP neighborhood profiles matched to OSM barrios:
- **72 exact matches** — name matched perfectly
- **6 fuzzy matches** — matched with article prefix (el/la/les)
- **8 unmatched** — neighborhoods not in OSM admin_level=10

Unmatched profiles (not in OSM data):
- Valencia: Patraix, Extramurs
- Palma: El Terreno, Son Armadams, El Molinar  
- Alicante: Carolinas, Playa San Juan
- Donostia: Parte Vieja

**Note:** Future SERP research should start from OSM barrio names to ensure 100% match rate.

---

## Cost Summary

| Resource | Usage | Cost |
|----------|-------|------|
| DynamoDB writes | 741,468 items | ~$0.94 |
| S3 storage (source files) | ~3 GB | Not stored (local) |
| Data sources | All free/open | $0.00 |
| **TOTAL** | | **~$0.94** |

> 💡 **Less than $1 for all of Spain's geospatial infrastructure!**

---

## Next Steps

### ⏳ Code Implementation (See P0-04)

| # | Component | File | Est. |
|---|-----------|------|------|
| 1 | Geoapify geocoder | `src/lib/geo/geoapify.ts` | 30m |
| 2 | Turf.js commute zones | `src/lib/geo/commute-zones.ts` | 30m |
| 3 | DynamoDB spatial queries | `src/lib/geo/spatial-queries.ts` | 1h |
| 4 | Scoring functions | `src/lib/recommender/scoring.ts` | 1h |
| 5 | Combined heatmap API | `/api/recommender/calculate-heatmap` | 1h |
| 6 | Mapbox component | `src/components/HeatmapView.tsx` | 2h |

**Total: ~6 hours**

### Future Enhancements
1. **Airbnb heatmap layer** — For rental investment scoring
2. **Crime data layer** — When available from official sources
3. **Noise data layer** — Environmental quality scoring
4. **School ratings** — From public datasets

---

## API Keys Required

| Service | Env Variable | Limit | Status |
|---------|--------------|-------|--------|
| Geoapify | `GEOAPIFY_API_KEY` | 3,000/day free | ✅ Configured |
| ScrapingDog | `SCRAPINGDOG_API_KEY` | Pay per use | ✅ Configured |
| Mapbox | `NEXT_PUBLIC_MAPBOX_TOKEN` | 50k/month free | ✅ Configured |

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | How geo data is used in scoring — **code TODOs here** |
| [P0-18-LANDING-PAGE](./P0-18-LANDING-PAGE.md) | Map comparison visual |
| [DATA_SOURCES_ARCHITECTURE.md](../DATA_SOURCES_ARCHITECTURE.md) | High-level data source overview |

---

*Created: Dec 7, 2025*
*Data import completed: Dec 7, 2025*
*SERP matching completed: Dec 7, 2025 (78/86 profiles)*
*Total cost: ~$0.94 for all of Spain's geospatial infrastructure!*
