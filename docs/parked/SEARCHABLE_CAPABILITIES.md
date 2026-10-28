# Searchable Capabilities (Without Full Pipeline)

**Purpose**: What we can actually filter/match on before running expensive AI analysis.  
**Last Updated**: 2025-11-28

---

## Overview

There are two layers of matching:

| Layer | Cost | When It Runs |
|-------|------|--------------|
| **Pre-Filter** | Free/Cheap | Before showing any listing |
| **Deep Analysis** | Expensive | Only on shortlisted properties |

This document covers **Pre-Filter** capabilities — what we can search without running photo analysis, room clustering, or renovation intelligence.

---

## 1. Listing Data (From Scraping)

Data extracted when a listing is scraped from portals. Available in `listings` table.

### Core Fields
| Field | Type | Searchable? |
|-------|------|-------------|
| `price_eur` | DECIMAL | ✅ Range filter |
| `city` | TEXT | ✅ Exact match |
| `region` | TEXT | ✅ Exact match |
| `address` | TEXT | ✅ Text search |
| `lat`, `lng` | DECIMAL | ✅ Geo queries |
| `bedrooms` | INTEGER | ✅ Min/max |
| `bathrooms` | DECIMAL | ✅ Min/max |
| `sqm` | INTEGER | ✅ Min/max |
| `year_built` | INTEGER | ✅ Range filter |

### Amenity Booleans
| Field | Searchable? |
|-------|-------------|
| `has_elevator` | ✅ |
| `has_terrace` | ✅ |
| `has_balcony` | ✅ |
| `has_pool` | ✅ |
| `has_garage` | ✅ |
| `has_garden` | ✅ |
| `has_storage` | ✅ |
| `has_air_conditioning` | ✅ |
| `has_wardrobes` | ✅ |
| `is_accessible` | ✅ |
| `is_exterior` | ✅ |

### Enums
| Field | Values | Searchable? |
|-------|--------|-------------|
| `floor_level` | 'ground', 'intermediate', 'top' | ✅ |
| `condition` | 'new', 'good', 'renovate' | ✅ |
| `orientation` | 'north', 'south', 'east', 'west' | ✅ |
| `property_subtype` | 'flat', 'penthouse', 'duplex', 'studio', 'chalet_detached', etc. | ✅ |
| `housing_situation` | 'free', 'rented', 'bare_ownership', 'squatted', 'auction' | ✅ |
| `ad_origin` | 'standard', 'bank', 'private' | ✅ |

### From `scraped_data` JSONB (queryable but slower)
| Path | What It Contains |
|------|------------------|
| `scraped_data->'areas'->>'constructed'` | Constructed m² |
| `scraped_data->'areas'->>'useful'` | Useful m² |
| `scraped_data->>'description'` | Full listing description |
| `scraped_data->'photos'` | Array of photo URLs |
| `scraped_data->'roomsAndAmenities'` | Detailed room breakdown |

---

## 2. Location Intelligence (Geoapify)

**Cost**: Free tier (3,000 requests/day)

### What We Can Do
| Capability | How |
|------------|-----|
| **Isochrone Generation** | Given a point + mode + time → polygon of reachable area |
| **Sweet Spot Calculation** | Intersection of multiple isochrones |
| **Point-in-Polygon Check** | Is this listing inside the sweet spot? |

### Transport Modes
- `driving` → `drive`
- `transit` → `transit`
- `cycling` → `bicycle`
- `walking` → `walk`

### Matching Flow
```
User Anchors → Geoapify Isochrones → Turf.js Intersection → Sweet Spot Polygon
                                                                    ↓
Listings with lat/lng → turf.booleanPointInPolygon() → ✅ Inside / ❌ Outside
```

**Result**: Zero-cost filtering of 10,000 listings down to ~50 geographically valid ones.

---

## 3. Cadastre Data (Spanish Government API)

**Cost**: Free (public API)

### What We Can Query
| Field | Description |
|-------|-------------|
| `refCat` | Cadastral reference (from lat/lng) |
| `year_built` | Official construction year |
| `area_m2` | Official registered area |
| `use` | Residential, commercial, etc. |
| `floors` | Number of floors in building |
| `units_in_building` | How many units in the parcel |

### What This Enables
- **Building Age Verification**: Cross-check listing year vs. cadastre
- **Area Discrepancy Detection**: Listing says 90m², cadastre says 75m²
- **Era Risk Flagging**: Pre-1980 buildings → potential aluminosis, old wiring

---

## 4. Places Search (ScrapingDog + Google Maps)

**Cost**: ~$0.002 per search

### What We Can Search
| Query Type | Example |
|------------|---------|
| Amenity search | "Crossfit gym near [lat,lng]" |
| Specific places | "Mercadona supermarket" |
| Category search | "coffee shop", "metro station" |

### What We Get Back
- Place name, lat/lng
- Rating, review count
- Categories/types
- Distance from point

### What This Enables
- Verify user's "hidden gem" requirements exist nearby
- Check for deal-breakers ("no gyms within 10 min walk")
- Vibe verification (AI Scout checks if places match user's taste)

---

## 5. What We CAN'T Search (Without Pipeline)

These require running the expensive analysis:

| Capability | Why It's Expensive |
|------------|-------------------|
| **Natural light quality** | Requires photo analysis (orientation + window detection) |
| **Layout style (open vs. chopped)** | Requires floor plan analysis or photo inference |
| **Noise level estimation** | Requires street view analysis + traffic data |
| **Renovation cost estimate** | Requires room-by-room condition analysis |
| **"Staging vs. real" detection** | Requires photo analysis |
| **Building community vibe** | No data source for this |
| **Street character** | Would need street view analysis |

---

## 6. Mapping: What Leo Learns → What We Can Search

| What Leo Learns | Pre-Filter Capability | Notes |
|-----------------|----------------------|-------|
| **Anchors (locations)** | ✅ Geoapify isochrones | Core capability |
| **Transport mode** | ✅ Isochrone mode param | |
| **Max commute time** | ✅ Isochrone range | |
| **Household composition** | ⚠️ Bedrooms/bathrooms only | Can't filter "good for kids" |
| **Pets** | ❌ No data | Rental listings sometimes have this |
| **Work from home** | ⚠️ Sqm as proxy | Can't detect "home office potential" |
| **Noise sensitivity** | ❌ No pre-filter | Would need street analysis |
| **Light priority** | ⚠️ `is_exterior`, `orientation` | Imperfect proxy |
| **Stairs tolerance** | ✅ `floor_level`, `has_elevator` | |
| **Building era preference** | ✅ `year_built` | Via cadastre or scraped |
| **Aesthetic style** | ❌ No pre-filter | Requires photo analysis |
| **Street energy** | ❌ No pre-filter | Would need neighborhood data |
| **Nightlife proximity** | ⚠️ Places search | Can search for bars nearby |
| **Renovation appetite** | ✅ `condition` field | 'new', 'good', 'renovate' |
| **Budget** | ✅ `price_eur` | |
| **Property features** | ✅ All boolean amenities | |

---

## 7. Recommended Pre-Filter Strategy

### Hard Filters (SQL WHERE)
```sql
WHERE price_eur <= :max_price
  AND city = :city
  AND bedrooms >= :min_bedrooms
  AND (has_elevator = true OR floor_level = 'ground')  -- if stairs_tolerance = 0
  AND condition IN ('new', 'good')  -- if renovation_appetite = 'move_in_ready'
```

### Spatial Filter (Turf.js)
```typescript
const inSweetSpot = turf.booleanPointInPolygon(
  turf.point([listing.lng, listing.lat]),
  sweetSpotPolygon
);
```

### Soft Scoring (Post-Filter)
- +10 if `is_exterior` and user wants light
- +10 if `year_built > 1980` and user prefers modern
- +5 if amenities match preferences
- -10 if `year_built < 1960` and user is risk-averse

---

## 8. Gap Analysis: What Would Help

| Missing Capability | How to Get It |
|-------------------|---------------|
| **Noise indicators** | Street type classification from OSM? |
| **Neighborhood character** | Pre-computed area profiles? |
| **Building reputation** | Scrape community forums? ITE database? |
| **Street View analysis** | Google Street View API + AI |
| **Natural light scoring** | Run lightweight photo analysis on shortlist |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-11-28 | Initial capability audit |

