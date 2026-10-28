# Data Sources Architecture

> Complete reference for all data sources used in Leo's location intelligence and property recommendation system.

## Overview

Leo uses a multi-layer data architecture to provide personalized property recommendations.

### POI Data Source Hierarchy

When querying POIs, use this decision tree:

| Question | Source | Examples |
|----------|--------|----------|
| **Rarely changes? (10+ years stable)** | OSM (`leo-osm-pois`) | Parks, metro, beaches, schools, hospitals, sports facilities |
| **Business that may open/close?** | AllThePlaces (`leo-atp-pois`) | Bakeries, cafes, restaurants, gyms, retail, services |
| **Needs reviews/ratings/quality?** | ScrapingDog (live API) | "Best specialty coffee", "dog-friendly restaurants", "quiet coworking" |

**Rule of thumb:**
- 🏛️ **OSM** = Infrastructure (won't move)
- 🏪 **ATP** = Businesses (may close, but good enough for density/existence)
- ⭐ **ScrapingDog** = Quality matters (need reviews to answer the question)


```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOCATION SCORING LAYERS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: COMMUTE PENALTY (Graduated Scoring - NOT hard boundary)           │
│  ─────────────────────────────────────────────────────────────               │
│  Turf.js radial circles for visualization + distance-based penalties        │
│  All listings scored; farther = heavier penalty (no exclusion)              │
│                                                                              │
│  LAYER 2: NEIGHBORHOOD MULTIPLIER                                           │
│  ─────────────────────────────────                                          │
│  - Hood SERP research (35 dimensions)                                       │
│  - INE income data (aggregated from census sections)                        │
│  - Airbnb perceived vibe                                                    │
│  Each neighborhood gets a composite score 0-1                               │
│                                                                              │
│  LAYER 3: POI HEATMAP (Continuous Gradient)                                 │
│  ─────────────────────────────────                                          │
│  - OSM POIs (parks, metro, beaches)                                         │
│  - AllThePlaces POIs (cafes, gyms, etc.)                                    │
│  - ScrapingDog quality POIs (reviewed places)                               │
│  Travel time weighted scoring                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Commute Zone Visualization (Turf.js Circles)

**Purpose:** Visualize commute zones and calculate graduated penalties

**Method:** Turf.js radial circles (FREE) — not API isochrones

**Why This Works for Spain:**
- Spanish cities have regular grid layouts (unlike London's choppy transit)
- Multi-modal culture: many people use mopeds, bikes, or drive
- Metro systems (Barcelona, Madrid) spread radially from center
- Radial approximation is ~70% accurate, which is fine for graduated penalties

**When Used:** 
- Real-time during intake call
- When user mentions work address, school, family location

**⚠️ IMPORTANT:** Commute zones are for **VISUALIZATION + PENALTY CALCULATION**. They do NOT define a search boundary. The heatmap covers the **entire city**.

**Data Flow:**
```
User says "I work in Diagonal Mar" 
  → Geocode to coordinates
  → Generate Turf.js circles at 10, 20, 30, 45, 60, 90 min
  → Display as concentric rings on map
  → For each listing: calculate distance → estimate minutes → apply penalty
  → NO hard boundary - listings anywhere in city are scored
```

**Speed Assumptions:**
```typescript
const EFFECTIVE_SPEEDS = {
  transit: 17,      // km/h (metro + walking + waiting)
  moped: 22,        // km/h (with traffic)
  bike: 15,         // km/h (urban cycling)
  drive: 25,        // km/h (city traffic + parking)
  walk: 5,          // km/h
};

// 30 min transit = 8.5 km radius
// 30 min moped = 11 km radius (covers transit gaps!)
```

**Storage:** Generated on-the-fly (Turf.js is instant)

**Cost:** **$0** 🎉

**Future Upgrade:** Geoapify isochrones (~$0.01/anchor) when revenue justifies precision

---

## 1.5 On-Demand POI Query System

**Purpose:** Fast, dynamic POI loading for map visualizations and user interactions.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ON-DEMAND POI QUERY FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User toggles "Show Bakeries" on map                                        │
│         ↓                                                                   │
│  Frontend gets visible map bounds (bbox)                                    │
│         ↓                                                                   │
│  GET /api/pois/bakeries?bbox=2.05,41.33,2.25,41.45                         │
│         ↓                                                                   │
│  Server converts bbox → geohash prefixes (e.g., ["sp3e", "sp3s"])          │
│         ↓                                                                   │
│  Parallel DynamoDB Queries: begins_with(SK, prefix)                         │
│         ↓                                                                   │
│  Return GeoJSON FeatureCollection (~50-100ms)                               │
│         ↓                                                                   │
│  Frontend renders Markers with caching                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Files:**
- `src/lib/geo/geohash-utils.ts` - Bbox → geohash prefix conversion
- `src/app/api/pois/[type]/route.ts` - POI query API endpoint
- `src/hooks/usePOIs.ts` - React hook with debouncing and caching

**API Endpoint:**
```
GET /api/pois/{type}?bbox={minLng},{minLat},{maxLng},{maxLat}&filter={key}:{value}&limit={n}

Parameters:
- type: POI type (bakeries, sports_pitches, cafes, etc.)
- bbox: Bounding box (required)
- filter: Optional attribute filter (e.g., filter=sport:tennis)
- limit: Max results (default 500, max 1000)

Response: GeoJSON FeatureCollection with metadata
```

**Supported POI Types:**
| Type | Count | Key Attributes |
|------|-------|----------------|
| parks | 409,644 | name, leisure, wikipedia |
| schools | 83,721 | name, amenity, school:type |
| restaurants | 61,315 | name, cuisine, outdoor_seating |
| supermarkets | 42,647 | name, brand, shop |
| bars | 36,754 | name, cuisine, outdoor_seating |
| healthcare | 30,469 | name, amenity, healthcare |
| beaches | 22,614 | name, natural, surface |
| cafes | 20,347 | name, cuisine, outdoor_seating |
| gyms | 19,530 | name, sport, fitness_centre |
| sports_pitches | 14,865 | name, **sport**, surface |
| pharmacies | 13,452 | name, amenity, dispensing |
| bakeries | 10,057 | name, shop, brand |
| metro | 6,096 | name, station, network |
| playgrounds | 3,545 | name, leisure |
| dog_parks | 706 | name, leisure |

**Filtering by Attributes:**
```typescript
// Tennis courts only (matches "tennis", "tennis;padel", "padel;tennis")
usePOIs({ type: 'sports_pitches', filter: { sport: 'tennis' }, bbox });

// Japanese restaurants (matches "japanese", "japanese;sushi")
usePOIs({ type: 'restaurants', filter: { cuisine: 'japanese' }, bbox });

// Vegan-friendly cafes
usePOIs({ type: 'cafes', filter: { 'diet:vegan': 'yes' }, bbox });
```

**⚠️ Multi-Value Attributes (Important for Leo Brain):**

OSM uses semicolon-delimited values for certain attributes. The API automatically uses `contains()` for these fields:

| Attribute | Example Values | Filter Behavior |
|-----------|---------------|-----------------|
| `sport` | `tennis`, `tennis;padel`, `soccer;basketball` | `contains()` - matches substring |
| `cuisine` | `italian`, `italian;pizza`, `fish;seafood` | `contains()` - matches substring |
| (others) | `brand`, `name`, etc. | Exact match (`=`) |

This means:
- `filter=sport:tennis` matches facilities with `sport: "tennis"`, `sport: "tennis;padel"`, or `sport: "padel;tennis"`
- The schema file (`src/data/osm-schema.json`) includes `multiValueAttributes` for each POI type

**Performance:**
- Query latency: 50-100ms typical
- Cache TTL: 5 minutes (client-side)
- Geohash precision: Auto-selected based on viewport size

**Demo:** `/test-map-comparison` - Toggle POIs layer to see dynamic loading

---

## 2. Spain PBF (OpenStreetMap)

**Source:** `/Random Files I Want To Give Cursor/spain.pbf` (1.1GB)

**Contains:**
- Administrative boundaries (neighborhoods, districts)
- POI polygons (parks, beaches, green spaces)
- Transit infrastructure (metro stations, bus stops)
- Amenities (schools, hospitals, pharmacies)

**Extraction Commands:**
```bash
# Neighborhoods (admin_level 9-10)
osmium tags-filter spain.pbf r/boundary=administrative r/admin_level=9,10 -o neighborhoods.pbf

# Parks and green spaces
osmium tags-filter spain.pbf nwr/leisure=park nwr/landuse=forest -o parks.pbf

# Metro stations
osmium tags-filter spain.pbf n/station=subway n/railway=station -o metro.pbf
```

**Storage:** 
- Neighborhoods → `leo-neighborhood-boundaries` (DynamoDB)
- POIs → `leo-osm-pois` (DynamoDB, by city + type)

**Scoring:** Per-type user preference (e.g., "How important is proximity to parks?")

**Update Frequency:** Monthly (OSM data is refreshed regularly)

---

## 3. AllThePlaces Data

**Source:** https://alltheplaces.xyz/

**Contains:**
- Chain businesses (Starbucks, McDonald's, gym chains)
- Retail stores
- Services
- GeoJSON format with coordinates

**Purpose:** Vibe/concentration scoring - density of certain business types indicates neighborhood character

**Examples:**
- High yoga studio density → Health-conscious area
- Many vintage shops → Trendy/artistic area
- Dense fast food → More commercial/less residential

**Storage:** `leo-alltheplaces-cache` (DynamoDB)

**Scoring:** Per-type user preference based on lifestyle dimensions

**Update Frequency:** Weekly (AllThePlaces updates regularly)

---

## 4. ScrapingDog Quality POIs

**Source:** ScrapingDog Google Maps API

**When Used:** For niche, quality-dependent POIs that require reviews

**Examples:**
- "Best specialty coffee shops near me"
- "LGBTQ-friendly bars"
- "Dog-friendly restaurants"
- "Coworking spaces with fast wifi"

**Data Returned:**
```json
{
  "name": "Satan's Coffee Corner",
  "rating": 4.7,
  "reviews_count": 1523,
  "reviews": ["Great specialty coffee...", ...],
  "coordinates": [2.1734, 41.3851]
}
```

**Processing:**
1. ScrapingDog returns POIs with reviews
2. Flash-Lite analyzes reviews against user preferences
3. Each POI gets a personalized fit score
4. Results contribute to heatmap layer

**Storage:** `leo-scraped-pois` (DynamoDB, cached 7 days)

**Cost:** ~$0.002 per search

---

## 5. Airbnb Reviews Heatmap

**Source:** Airbnb listings with reviews (scraped or API)

**Purpose:** Perceived neighborhood vibe from visitor perspective

**Processing:**
1. Collect Airbnb listings within city
2. Flash-Lite analyzes review text for dimension signals
3. Aggregate scores by neighborhood
4. Create heatmap layer for "tourist perception" dimensions

**Dimension Examples:**
- "Nightlife" → Reviews mentioning bars, clubs, late-night activity
- "Family-friendly" → Reviews about kid activities, safety
- "Quiet/residential" → Reviews about peaceful stays

**Storage:** `leo-airbnb-heatmap` (DynamoDB, by neighborhood)

**Update Frequency:** Monthly

---

## 6. Hood SERP Research

**Source:** Pre-computed SERP research per neighborhood

**Contains:** 35 dimension scores per neighborhood based on Google search results

**Dimensions Include:**
- LGBTQ+ friendliness
- Family-friendly
- Nightlife
- Health/fitness culture
- Art/creative scene
- Expat community
- Safety perception
- Walkability
- Green spaces
- etc.

**Storage:** `leo-hood-serp` (DynamoDB)

**Scoring:** User preferences weighted against hood dimension scores

**Update Frequency:** Quarterly (neighborhoods don't change quickly)

---

## 7. INE Census Income Data

**Source:** `spain-datasets/data/Renta media en España.csv`

**Contains:**
- Average income per person
- Average income per household
- Per census section (36,626 sections in Spain)

**Processing:**
```
Census Sections (fine-grained)
        ↓ Spatial aggregation
Neighborhood Boundaries (from OSM)
        ↓ Weighted average
Income score per neighborhood (0-1 normalized)
```

**Storage:** Aggregated to `leo-neighborhood-boundaries` (income_score field)

**Use Cases:**
- Budget alignment scoring
- Lifestyle inference
- Rent expectation validation

---

## 8. Census Section Polygons

**Source:** `spain-datasets/data/census/SECC_CE_ES-*.json`

**Contains:**
- GeoJSON polygons for all census sections
- ~36,000 sections across Spain
- Properties include CUSEC code for income matching

**Processing:**
1. Load census section polygons
2. Join with INE income data via CUSEC code
3. Spatial join with neighborhood polygons
4. Aggregate income to neighborhood level

**Storage:** Intermediate (used for aggregation, not queried directly)

---

## 9. Cadastre Data

**Source:** Spanish Cadastre (Catastro)

**Contains:**
- Building construction year
- Building type (residential, commercial)
- Square meters
- Number of floors
- Property boundaries

**Use Cases:**
- WPA context (building age affects renovation scope)
- Construction quality inference
- Historical building identification

**Storage:** Queried on-demand per listing address

---

## 10. Harvester Listings

**Source:** Leo Harvester (Idealista, Fotocasa, etc.)

**Storage:** `leo-listings` (DynamoDB)

**Contains:**
```json
{
  "listing_id": "idealista_12345",
  "url": "https://idealista.com/...",
  "title": "Piso en Gràcia",
  "price": 1200,
  "coordinates": [2.1566, 41.4036],
  "photos": ["url1", "url2", ...],
  "description": "...",
  "scraped_at": "2025-12-06T10:00:00Z"
}
```

**Processing:**
1. Harvester scrapes listings daily
2. Pre-WPA fit scoring based on user dimensions
3. Full WPA on photos for detailed analysis
4. Post-WPA fit scoring with visual insights
5. Top listings presented to user

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTAKE CALL                                     │
│                                                                              │
│  User mentions anchors    User shares preferences    User describes lifestyle│
│         ↓                        ↓                          ↓                │
│    Turf.js                 Dimension                   POI searches         │
│    radial zones            weights                     triggered            │
│         ↓                        ↓                          ↓                │
│  COMMUTE PENALTIES      User Profile               Heatmap layers            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCORING PIPELINE                                   │
│                                                                              │
│  For each listing in CITY (all listings, no hard boundary):                  │
│                                                                              │
│  1. Neighborhood score = Hood SERP × User weights                           │
│                        + Income alignment                                    │
│                        + Airbnb vibe match                                   │
│                                                                              │
│  2. POI score = Σ(nearby POIs × type weights × distance decay)              │
│                                                                              │
│  3. Pre-WPA fit = Neighborhood × POI × basic listing match                  │
│                                                                              │
│  4. WPA = Visual analysis of listing photos                                 │
│                                                                              │
│  5. Post-WPA fit = Pre-WPA adjusted by WPA insights                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT TO USER                                     │
│                                                                              │
│  Top 10 listings above fit threshold                                        │
│  + Personalized explanations                                                │
│  + Map visualization with heatmap                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## DynamoDB Tables Summary

| Table | Primary Key | Sort Key | Purpose |
|-------|-------------|----------|---------|
| `leo-listings` | domain | listing_id | Harvested properties |
| `leo-neighborhood-boundaries` | city | neighborhood_id | Hood polygons + scores |
| `leo-hood-serp` | city | neighborhood_id | 35-dimension research |
| `leo-osm-pois` | **poi_type** | **geohash#osmId** | Parks, metro, beaches, etc. (775k POIs) |
| `leo-alltheplaces-cache` | city | category | Vibe POIs |
| `leo-scraped-pois` | search_key | poi_id | Quality POIs (7-day cache) |
| `leo-airbnb-heatmap` | city | neighborhood_id | Vibe perception |
| `leo-census-income` | city | neighborhood_id | Aggregated income |

**`leo-osm-pois` Schema Details:**
- **PK:** POI type (e.g., "bakeries", "sports_pitches")
- **SK:** `{geohash7}#{osmId}` (enables efficient geo queries with `begins_with`)
- **Attributes:** All OSM tags preserved (sport, cuisine, opening_hours, brand, etc.)
- **Query Pattern:** `PK = 'sports_pitches' AND begins_with(SK, 'sp3e')` → all sports pitches in geohash sp3e
- **See:** `src/data/osm-schema.json` for auto-discovered attributes per type

---

## Cost Estimates (Per User)

| Source | Calls | Cost |
|--------|-------|------|
| Turf.js commute zones | ~5 | **FREE** |
| ScrapingDog POIs | ~10 | $0.02 |
| Flash-Lite WPA | ~50 listings | $0.10 |
| Flash-Lite POI analysis | ~30 | $0.03 |
| **Total per user** | | **~$0.15** |

Pre-computed data (OSM, AllThePlaces, SERP, Airbnb, INE) has no per-user cost.

> **MVP Note:** Using Turf.js instead of Geoapify saves ~$0.005/user. Future upgrade for precision: Geoapify ~$0.01/anchor.

---

## Update Schedule

| Data Source | Frequency | Method |
|-------------|-----------|--------|
| Listings | Daily | Harvester cron |
| OSM POIs | Monthly | PBF re-import |
| AllThePlaces | Weekly | Download + import |
| Hood SERP | Quarterly | Manual research |
| Airbnb heatmap | Monthly | Scrape + process |
| INE income | Yearly | Manual update |
| Cadastre | On-demand | API query |

---

## File Locations

```
/Random Files I Want To Give Cursor/
├── spain.pbf                          # Full OSM data (1.1GB)
├── spain-datasets/                    # GitHub repo
│   ├── data/
│   │   ├── census/                    # Census section GeoJSONs
│   │   │   ├── SECC_CE_ES-CT_*.json  # Catalonia
│   │   │   └── ...
│   │   └── Renta media en España.csv  # Income data
│   └── README.md
└── caj_esp_072025/                    # INE Callejero (code lists only)
```

---

*Last Updated: 2025-12-08*

