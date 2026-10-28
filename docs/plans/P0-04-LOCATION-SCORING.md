# P0-04: Location Scoring — Three-Layer Heatmap System

> **Parent:** [P0 Index](./P0_INDEX.md)
> **Full Algorithm:** [HEATMAP_LOCATION_SCORING.md](../HEATMAP_LOCATION_SCORING.md)

---

## ⚠️ CRITICAL: No Hard Boundaries

**The heatmap covers the ENTIRE CITY.** There is NO geographic exclusion.

- Commute distance → **graduated penalty**, not binary filter
- A listing 90 min from work CAN surface if it scores extremely high elsewhere
- All listings in the city get scored — best ones rise to the top

---

## The Scoring Formula

```
FINAL_SCORE = (POI_SCORE × NEIGHBORHOOD_MULTIPLIER) + COMMUTE_PENALTY
```

Every location gets a **continuous score from 0-100%** based on three stacked layers.

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   LAYER 3: POI HEATMAP (Fine-grained gradient)                              │
│   ═══════════════════════════════════════════                               │
│                                                                             │
│        ░░░▒▒▓▓███████▓▓▒▒░░░                                               │
│        ░▒▓████  POI  ████▓▒░   ← Gradient based on POI proximity/quality   │
│        ░▒▓████ SCORE ████▓▒░                                               │
│        ░░░▒▒▓▓███████▓▓▒▒░░░                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 2: NEIGHBORHOOD MULTIPLIER (0.7x - 1.3x)                            │
│   ══════════════════════════════════════════════                            │
│                                                                             │
│      ┌────────────┬────────────┬────────────┐                               │
│      │  GRÀCIA    │  EIXAMPLE  │ SANT MARTÍ │                               │
│      │   1.26x    │   1.08x    │   0.95x    │   ← Based on 20+ dimensions   │
│      └────────────┴────────────┴────────────┘                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 1: COMMUTE PENALTY (Graduated, NOT hard boundary)                   │
│   ═══════════════════════════════════════════════════════                   │
│                                                                             │
│      30 min = 0 penalty                                                     │
│      45 min = -20 penalty                                                   │
│      60 min = -40 penalty                                                   │
│      90 min = -70 penalty (effectively out, but not excluded)               │
│                                                                             │
│      ⚠️ NO GEOGRAPHIC EXCLUSION - All listings scored                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Commute Penalty (Graduated Scoring)

### NOT Hard Boundaries — Graduated Penalties

| Commute Time | Penalty | Effect |
|--------------|---------|--------|
| ≤30 min | 0 | No impact |
| 30-45 min | -10 to -20 | Slight disadvantage |
| 45-60 min | -20 to -40 | Significant disadvantage |
| 60-90 min | -40 to -70 | Heavy disadvantage |
| >90 min | -70+ | Effectively out (but not excluded) |

### Turf.js for MVP (FREE)

**We're NOT using Geoapify isochrones for MVP.** Instead: Turf.js radial circles.

| Old Approach | New Approach (MVP) |
|--------------|-------------------|
| Geoapify isochrones | Turf.js radial circles |
| ~$0.001/isochrone | **FREE** |
| `generate-shape` endpoint | `generate-commute-zones` endpoint |
| Transit-aware routing | Distance ÷ speed approximation |

**Why this works for Spain:**
- Regular city layouts (unlike London's choppy transit)
- Multi-modal culture: mopeds, bikes common — covers transit gaps
- ~70% accurate vs real isochrones, fine for graduated penalties

**Future upgrade:** Geoapify isochrones (~$0.01/anchor) when revenue justifies precision.

### Geocoding: Geoapify (3,000/day free)

Anchor addresses need to be converted to coordinates before Turf.js can work.

| Service | Use Case | Limit |
|---------|----------|-------|
| **Geoapify** | Heatmap anchor geocoding | 3,000/day free tier |
| **Nominatim** | Harvesting (listing geocoding) | Unlimited (self-hosted) |

```typescript
// src/lib/geo/geoapify.ts
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&filter=countrycode:es&apiKey=${GEOAPIFY_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.features?.[0]) {
    const [lng, lat] = data.features[0].geometry.coordinates;
    return { lat, lng };
  }
  return null;
}
```

### Speed Assumptions

```typescript
const EFFECTIVE_SPEEDS = {
  transit: 17,  // km/h (metro + walking + waiting)
  moped: 22,    // km/h (with traffic)
  bike: 15,     // km/h (urban cycling)
  drive: 25,    // km/h (city traffic + parking)
  walk: 5,      // km/h
};

// Example: 30 min transit = 17 * 0.5 = 8.5 km radius
```

### Penalty Calculation

```typescript
function calculateCommutePenalty(
  listing: { lat: number; lng: number },
  anchors: Anchor[]
): number {
  // Find worst commute across all anchors
  let worstCommute = 0;
  
  for (const anchor of anchors) {
    const distanceKm = turf.distance(
      [listing.lng, listing.lat],
      [anchor.lng, anchor.lat],
      { units: 'kilometers' }
    );
    
    // Estimate time based on user's transport mode
    const speed = EFFECTIVE_SPEEDS[anchor.transportMode || 'transit'];
    const estimatedMinutes = (distanceKm / speed) * 60;
    
    worstCommute = Math.max(worstCommute, estimatedMinutes);
  }
  
  // Apply graduated penalty
  if (worstCommute <= 30) return 0;
  if (worstCommute <= 45) return -10 - ((worstCommute - 30) / 15) * 10;
  if (worstCommute <= 60) return -20 - ((worstCommute - 45) / 15) * 20;
  if (worstCommute <= 90) return -40 - ((worstCommute - 60) / 30) * 30;
  return -70;
}
```

### Visualization (Turf.js Circles)

For map display, generate concentric circles at key thresholds:

```typescript
function generateCommuteZones(anchor: Anchor): GeoJSON.FeatureCollection {
  const center = [anchor.lng, anchor.lat];
  const speed = EFFECTIVE_SPEEDS[anchor.transportMode || 'transit'];
  
  return {
    type: 'FeatureCollection',
    features: [
      turf.circle(center, speed * 0.5, { steps: 64, units: 'kilometers', properties: { minutes: 30, opacity: 0.3 } }),
      turf.circle(center, speed * 0.75, { steps: 64, units: 'kilometers', properties: { minutes: 45, opacity: 0.2 } }),
      turf.circle(center, speed * 1.0, { steps: 64, units: 'kilometers', properties: { minutes: 60, opacity: 0.1 } }),
    ]
  };
}
```

---

## Layer 2: Neighborhood Multiplier (0.7x - 1.3x)

Each neighborhood gets a multiplier based on how well it matches user preferences.

### Data Sources

| Source | What It Provides | Storage |
|--------|------------------|---------|
| **Hood SERP research** | 35 dimensions per neighborhood | `leo-neighborhood-profiles` |
| **INE income data** | Aggregated from census sections | `leo-neighborhood-boundaries` |
| **Airbnb reviews** | Quietness/vibe perception | `leo-airbnb-heatmap` |

### Dimensions (20+)

| Category | Dimensions |
|----------|------------|
| Life Stage | young_professional, family_friendly, retiree_friendly, student_friendly |
| Lifestyle | nightlife, creative_scene, foodie_scene, outdoor_lifestyle, fitness_culture, lgbtq_friendly, pet_friendly, digital_nomad, expat_community |
| Universal | safety, cleanliness, green_spaces, walkability, transit_access, quietness |
| Economic | affordability, gentrification_risk |

### Multiplier Calculation

```typescript
function calculateNeighborhoodMultiplier(
  neighborhood: NeighborhoodProfile,
  userWeights: DimensionWeights
): number {
  let matchScore = 0;
  let totalWeight = 0;
  
  for (const [dimension, userWeight] of Object.entries(userWeights)) {
    if (userWeight === 0) continue;
    
    const hoodScore = neighborhood.dimensions[dimension] || 50;
    matchScore += (hoodScore / 100) * userWeight;
    totalWeight += userWeight;
  }
  
  const normalizedMatch = totalWeight > 0 ? matchScore / totalWeight : 0.5;
  
  // Convert to multiplier: 0% → 0.7x, 50% → 1.0x, 100% → 1.3x
  return 0.7 + (normalizedMatch * 0.6);
}
```

### Explicit Mention Boost

| User Statement | Effect |
|----------------|--------|
| "I love Gràcia" | +20% boost |
| "I've looked at Eixample" | +10% boost |
| "Not Gothic Quarter" | 70% penalty |

---

## Layer 3: POI Heatmap (Fine-Grained Gradient)

### The Three-Tier POI Model

| POI Type | Example | Data Source | Cost |
|----------|---------|-------------|------|
| **EXISTENCE POI** | Beach, parks, metro | OSM (DynamoDB) | FREE |
| **AREA VIBE POI** | Cafe density, restaurant area | AllThePlaces | FREE |
| **QUALITY POI** | "Good specialty coffee" | ScrapingDog + Flash-Lite | PAID |

### Decision Logic: What Triggers What

```
User says "near the beach" → OSM coastline → Turf.js distance → FREE
User says "lively area with cafes" → AllThePlaces density count → FREE
User says "good specialty coffee" → ScrapingDog search + Flash-Lite scoring → PAID
```

### POI Score Calculation

```typescript
function calculatePOIScore(
  listing: Listing,
  userPreferences: POIPreferences
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const pref of userPreferences) {
    let poiScore: number;
    
    switch (pref.type) {
      case 'existence':
        // OSM data - measure distance
        poiScore = scoreExistencePOI(listing, pref);
        break;
      case 'vibe':
        // AllThePlaces - measure density
        poiScore = scoreAreaVibe(listing, pref);
        break;
      case 'quality':
        // ScrapingDog + Flash-Lite - measure fit
        poiScore = scoreQualityPOI(listing, pref);
        break;
    }
    
    totalScore += poiScore * pref.weight;
    totalWeight += pref.weight;
  }
  
  return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 50;
}
```

### Distance → Time Conversion

```typescript
const WALKING_SPEED_M_PER_MIN = 80; // ~5km/h
const STREET_GRID_FACTOR = 1.3;     // Streets aren't straight

function estimateWalkingMinutes(straightLineMeters: number): number {
  return (straightLineMeters * STREET_GRID_FACTOR) / WALKING_SPEED_M_PER_MIN;
}

// 800m straight line → 800 * 1.3 / 80 = 13 min walk
```

### Multi-Modal Destination Access

For **destination amenities** (beach, nightlife, specific gym), score across all modes:

```typescript
function scoreDestinationAccess(listing: Listing, destination: Point): number {
  const distanceKm = turf.distance(listing.coords, destination, { units: 'kilometers' });
  
  const walkMin = distanceKm / 5 * 60;     // 5 km/h
  const bikeMin = distanceKm / 15 * 60;    // 15 km/h
  const mopedMin = distanceKm / 22 * 60;   // 22 km/h
  const transitMin = distanceKm / 17 * 60; // 17 km/h
  
  // Return best mode
  const bestMin = Math.min(walkMin, bikeMin, mopedMin, transitMin);
  
  // Score: 10 min = 100, 30 min = 50, 60 min = 0
  return Math.max(0, 100 - (bestMin - 10) * 2);
}
```

---

## Combined Score Example

```
USER: Values creativity (HIGH), nightlife (HIGH), family-friendly (LOW)
      Works in Diagonal (30 min max preferred)

LISTING: Coordinate in Gràcia neighborhood, 35 min from Diagonal

LAYER 1 - COMMUTE PENALTY:
  35 min commute → -10 penalty

LAYER 2 - NEIGHBORHOOD MULTIPLIER:
  Gràcia: creativity 90%, nightlife 85%, family 40%
  User match: 85%
  + "I love Gràcia" mention: +20%
  Final multiplier: 1.26x

LAYER 3 - POI SCORE:
  Good coffee nearby: 8/10
  Parks: 7/10
  Weighted average: 70%

FINAL SCORE:
  (70 × 1.26) + (-10) = 88.2 - 10 = 78.2% ✨
```

---

## Real-Time Heatmap Building During Call

The heatmap builds **progressively** as the user shares preferences.

### Desktop: Continuous Side-by-Side

```
┌──────────────────────────────┬──────────────────────────────────────────────┐
│                              │                                              │
│   CALL/CHAT UI               │   MAP (always visible, updating)             │
│                              │                                              │
│   Leo: "Tell me about..."    │       ╭─────────╮                            │
│                              │      ╱░▒▓████▓▒░╲  ← Updates live            │
│   You: "I work in..."        │     │▒▓████████▓▒│   as you speak            │
│                              │      ╲░▒▓████▓▒░╱                            │
│   Leo: "Got it! And..."      │       ╰─────────╯                            │
│                              │                                              │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

### Mobile: Checkpoint-Based Overlays

| # | Trigger | Style | Duration |
|---|---------|-------|----------|
| 1 | City mentioned | Toast | 2-3 sec (auto-dismiss) |
| 2 | First anchor | Toast | 2-3 sec |
| 3 | Commute zones formed | Bottom sheet (60%) | Until dismissed |
| 4 | Heatmap complete | Full overlay | Until dismissed |

### WebSocket Events

| Event | Trigger | Map Action |
|-------|---------|------------|
| `ZOOM_TO_CITY` | User mentions city | Zoom + city bounds |
| `ADD_COMMUTE_ZONE` | Anchor detected | Show Turf.js circle |
| `SET_NEIGHBORHOODS` | Lifestyle revealed | Color neighborhoods |
| `ADD_POIS` | POI searched | Show POI markers |
| `UPDATE_HEATMAP` | POI scored | Update gradient |

---

## City Intelligence & Tradeoff Awareness

### Probe City Familiarity

Leo asks early: "Have you spent much time in Barcelona, or will this be a fresh start?"

| Response | Leo's Behavior |
|----------|----------------|
| "Never been" | Maximum local wisdom mode |
| "Visited friends" | Connect new info to reference points |
| "Know it well" | Trust preferences, less explanation |

### Surface Local Wisdom (For Newcomers)

When user says "near the beach" and familiarity = 'none':

> "Quick thought — areas closest to the beach tend to be touristy and noisy. Many locals prefer neighborhoods like Gràcia and get to the beach by bike in 10-15 minutes. What matters more — walking distance to sand, or a quieter neighborhood feel?"

This prevents the "Barceloneta Trap" and similar local pitfalls.

---

## Follow-Up Process (Simplified)

**No early confrontation.** If options are scarce, Leo doesn't panic mid-call.

### End of Call

Leo summarizes: "I'll search for you in [areas]. Expect first results within 24 hours."

### Day 3 Check (Cron Job)

If insufficient listings (< 5 above threshold):

1. **First:** Soften POI criteria ("Would 15 min to coffee work instead of 10?")
2. **Later:** If still insufficient, ask to extend commute times (LAST RESORT)

### Weekly Monitoring

If new high-fit listings appear → proactive notification:
> "A new apartment just hit the market that matches your profile 92%."

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/recommender/generate-commute-zones` | Turf.js radial circles (FREE) |
| `POST /api/recommender/calculate-penalties` | Graduated commute scoring |
| `POST /api/recommender/search-pois` | ScrapingDog Google Maps search |
| `POST /api/recommender/score-pois` | Flash-Lite user fit scoring |
| `POST /api/recommender/score-neighborhoods` | Calculate hood multipliers |
| `POST /api/recommender/calculate-heatmap` | Combined 3-layer formula |
| `POST /api/recommender/listings-in-heatmap` | Filter listings by threshold |

---

## ElevenLabs Agent Tools

| Tool | Purpose |
|------|---------|
| `detect_city` | Triggers `ZOOM_TO_CITY` |
| `add_anchor` | Generates Turf.js circles, triggers `ADD_COMMUTE_ZONE` |
| `generate_commute_zones` | Turf.js radial circles (FREE) |
| `calculate_penalties` | Graduated commute scoring |
| `probe_city_familiarity` | Record user knowledge level |
| `surface_tradeoff` | Show local wisdom for newcomers |
| `score_destination_multimode` | Walk/bike/moped/transit |
| `score_area_vibe` | AllThePlaces density |
| `score_quality_poi` | ScrapingDog + Flash-Lite |

---

## Why This Works Better Than Hard Boundaries

| Hard Boundaries | Continuous Heatmap |
|-----------------|-------------------|
| "Is this inside or outside?" | "This scores 78%" |
| Complex geometric intersection | Simple threshold slider |
| Surprises need special logic | Surprises emerge naturally |
| Arbitrary cutoffs | Smooth gradients |
| Hard to explain | Built-in reasoning |
| Misses gems just outside | Gems surface with penalty note |

---

## Data Prerequisites

> ✅ **Geo Data Pipeline Complete!** All spatial data is loaded into DynamoDB. See [P0-19-GEO-DATA-PIPELINE](./P0-19-GEO-DATA-PIPELINE.md).

| Data Layer | DynamoDB Table | Records | Status |
|------------|----------------|---------|--------|
| Census sections + INE income | `leo-census-sections` | 36,308 | ✅ Imported |
| Neighborhood boundaries + SERP | `leo-neighborhood-boundaries` | 17,594 (78 with SERP) | ✅ Imported |
| OSM POIs | `leo-osm-pois` | 595,191 | ✅ Imported |
| AllThePlaces POIs | `leo-atp-pois` | 92,375 | ✅ Imported |

---

## Implementation Status

### ✅ Done — Data Layer

- All geo data imported (741,468 records)
- SERP profiles matched to barrios (78/86)
- API keys configured (Geoapify, ScrapingDog, Mapbox)

### ⏳ Pending — Code Layer

| # | Component | File | Est. | Status |
|---|-----------|------|------|--------|
| 1 | Geoapify geocoder | `src/lib/geo/geoapify.ts` | 30m | ⏳ |
| 2 | Turf.js commute zones | `src/lib/geo/commute-zones.ts` | 30m | ⏳ |
| 3 | DynamoDB spatial queries | `src/lib/geo/spatial-queries.ts` | 1h | ⏳ |
| 4 | Scoring functions | `src/lib/recommender/scoring.ts` | 1h | ⏳ |
| 5 | Combined heatmap API | `/api/recommender/calculate-heatmap` | 1h | ⏳ |
| 6 | Mapbox component | `src/components/HeatmapView.tsx` | 2h | ⏳ |

**Total estimate: ~6 hours**

---

## Related Documents

| Document | Contents |
|----------|----------|
| [**P0-19-GEO-DATA-PIPELINE**](./P0-19-GEO-DATA-PIPELINE.md) | ✅ Data loading complete (741k records) |
| [HEATMAP_LOCATION_SCORING.md](../HEATMAP_LOCATION_SCORING.md) | Full algorithm reference |
| [DATA_SOURCES_ARCHITECTURE.md](../DATA_SOURCES_ARCHITECTURE.md) | Data sources overview |
| [LOCATION_SCORING_LOGIC.md](../LOCATION_SCORING_LOGIC.md) | Decision logic + implementation checklist |

---

*Last Updated: December 7, 2025 — Geo data complete, code implementation pending*

