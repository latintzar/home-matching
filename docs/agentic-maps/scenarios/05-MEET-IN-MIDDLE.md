---
status: design
last_updated: 2024-12-12
level: 2-spec
derives_from: AGENTIC_MAPS.md
building_blocks: [5.1, 5.2, 5.3, 5.4, 4.1, 4.2, 4.3, 4.4, Shared.3]
feedback_from: BUILDING_BLOCKS.md
---

# Scenario 5: Meet in Middle

<!-- 
📊 HIERARCHY: Level 2 (Spec)
- Derives from: AGENTIC_MAPS.md (vision)
- Implemented by: Building blocks 5.1-5.4
- Update when: Building block tests reveal design changes
-->

> "Coffee spot between us - I'm in Shoreditch, she's in Camden"

## Overview

Find a **specific place** that's conveniently located between multiple people. Uses Geoapify Isochrones to calculate fair travel zones, then ScrapingDog to find and verify the best place within that zone.

## When This Triggers

- Multiple starting locations mentioned
- Looking for ONE specific venue
- "Between us", "meet halfway", "convenient for both"
- Date planning, friend meetups, business meetings

**Example queries**:
- "coffee between Shoreditch and Camden"
- "dinner spot equidistant from all three of us"
- "bar halfway between Brooklyn and Manhattan"
- "restaurant convenient for meeting - I'm near Victoria, they're in Islington"

## Why Geoapify Over Local Calculation?

For **specific, imminent plans**, users need accuracy:
- Turf.js midpoint ≠ equal travel time (traffic, transit routes)
- Geoapify considers real road networks and transit
- $0.0049/call is worth it for actual meetup planning

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY (Gemini 2.5 Flash)                      Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "wine bar between Shoreditch and Camden for a date"                 │
│  Output: {                                                                  │
│    scenario: "meet-in-middle",                                              │
│    origins: ["Shoreditch, London", "Camden, London"],                       │
│    placeType: "wine bar",                                                   │
│    occasion: "date"                                                         │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: GEOCODE ORIGINS (Mapbox)                         Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Convert location names to coordinates:                                     │
│  - Shoreditch → [−0.0777, 51.5246]                                         │
│  - Camden → [−0.1426, 51.5390]                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: GENERATE ISOCHRONES (Geoapify)                   Cost: $0.0098    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  For each origin (2x):                                                      │
│  - 20-minute travel polygon (transit or walk)                               │
│  Returns: GeoJSON polygons of reachable areas                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: COMPUTE INTERSECTION (Geoapify Geometry)         Cost: $0.0049    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Intersect the two isochrone polygons                                       │
│  Returns: "Fair zone" polygon where both can reach in ~20 min               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: SEARCH WITHIN ZONE (ScrapingDog)                 Cost: $0.004     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Google Search: "wine bar [intersection area name]"                         │
│  Then: Get details for top 3 candidates                                     │
│  Then: Get reviews for #1 candidate                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 6: CURATE (Gemini 2.5 Flash Lite)                   Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Select best place within fair zone                                         │
│  Consider: occasion (date), criteria (wine bar), reviews                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 7: RENDER (Mapbox)                                  Cost: $0.005     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Show both origin points                                                  │
│  - Display isochrone polygons (semi-transparent)                            │
│  - Highlight intersection zone                                              │
│  - Place marker with info card                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface MeetInMiddleResult {
  origins: Array<{
    name: string;              // "Shoreditch"
    coordinates: [number, number];
  }>;
  
  fairZone: {
    polygon: GeoJSON.Polygon;  // Intersection area
    neighborhoods: string[];   // ["Angel", "Clerkenwell"]
  };
  
  recommendation: SinglePlaceResult;  // Same as Scenario 4
  
  travelTimes: Array<{
    from: string;              // "Shoreditch"
    duration: number;          // minutes
    mode: 'walk' | 'transit' | 'drive';
  }>;
}
```

## Example Output

**Query**: "wine bar between Shoreditch and Camden for a date"

```json
{
  "origins": [
    { "name": "Shoreditch", "coordinates": [-0.0777, 51.5246] },
    { "name": "Camden", "coordinates": [-0.1426, 51.5390] }
  ],
  
  "fairZone": {
    "polygon": { "type": "Polygon", "coordinates": [...] },
    "neighborhoods": ["Angel", "Islington", "Kings Cross"]
  },
  
  "recommendation": {
    "place": {
      "name": "Noble Rot",
      "address": "51 Lamb's Conduit St, London WC1N 3NB",
      "coordinates": [-0.1183, 51.5215],
      "rating": 4.6,
      "reviewCount": 892,
      "priceLevel": "$$$",
      "hours": "5:00 PM - 11:00 PM",
      "gmapsUrl": "https://www.google.com/maps/search/Noble+Rot+Lambs+Conduit"
    },
    "recommendation": {
      "whyThisPlace": "Intimate wine bar with exceptional natural wines and small plates. Perfect romantic atmosphere in a cozy Victorian setting. Located in the fair zone - 15 min from Shoreditch, 18 min from Camden.",
      "reviewHighlights": [
        { "quote": "Best date spot in London. The sommelier recommendations were perfect.", "rating": 5 },
        { "quote": "Cozy, romantic, and the wine list is unmatched.", "rating": 5 }
      ],
      "tips": [
        "Book ahead - small venue fills up",
        "Let the sommelier guide you",
        "Try the cheese board"
      ]
    }
  },
  
  "travelTimes": [
    { "from": "Shoreditch", "duration": 15, "mode": "transit" },
    { "from": "Camden", "duration": 18, "mode": "transit" }
  ]
}
```

## UI Components

### Map View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│     ┌─────────────────────────────────────────┐                             │
│     │ 🔴 Camden (18 min)                      │                             │
│     │    ╲                                    │                             │
│     │     ╲  ┌──────────────────┐            │                             │
│     │      ╲ │  FAIR ZONE       │            │                             │
│     │       ╲│   ✦ Noble Rot    │            │                             │
│     │        │                  │ ╱          │                             │
│     │        └──────────────────┘╱           │                             │
│     │                          ╱             │                             │
│     │                    🔵 Shoreditch (15 min)                            │
│     └─────────────────────────────────────────┘                             │
│                                                                             │
│  Legend: ░░░ Person A's 20min zone  ▓▓▓ Person B's 20min zone              │
│          ██ Fair zone (intersection)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Info Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Noble Rot                                       ⭐ 4.6 (892 reviews)       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  51 Lamb's Conduit St, London WC1N 3NB                        💰 $$$       │
│                                                                             │
│  ⏱️ Travel Times:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔵 From Shoreditch: 15 min (transit)                                │   │
│  │ 🔴 From Camden: 18 min (transit)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ✨ Why This Place:                                                         │
│  Perfect romantic atmosphere. Located in the fair zone - convenient        │
│  for both of you.                                                          │
│                                                                             │
│  💬 "Best date spot in London. The sommelier recommendations were perfect" │
│                                                                             │
│  [📍 Open in Google Maps]                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Step | Service | Cost |
|------|---------|------|
| Query Classification | Gemini 2.5 Flash | ~$0.001 |
| Geocoding (2×) | Mapbox | ~$0.001 |
| Isochrones (2×) | Geoapify | $0.0098 |
| Intersection | Geoapify Geometry | $0.0049 |
| Google Search | ScrapingDog | $0.001 |
| Place Details (3×) | ScrapingDog GMaps | $0.003 |
| Reviews | ScrapingDog GMaps | $0.001 |
| Curation | Gemini Flash Lite | ~$0.001 |
| Map Display | Mapbox Maps GL | $0.005 |
| **Total** | | **~$0.035** |

## Scaling to 3+ People

For 3 people:
- 3 isochrone calls ($0.0147)
- 1 intersection call (handles N polygons) ($0.0049)
- Total Geoapify: $0.0196

For 4 people:
- 4 isochrone calls ($0.0196)
- 1 intersection call ($0.0049)
- Total Geoapify: $0.0245

## Geoapify API Usage

### Isochrones

```typescript
const getIsochrone = async (
  lat: number, 
  lng: number, 
  mode: 'walk' | 'transit' | 'drive',
  minutes: number
) => {
  const response = await fetch(
    `https://api.geoapify.com/v1/isoline?` +
    `lat=${lat}&lon=${lng}&type=time&mode=${mode}&range=${minutes * 60}` +
    `&apiKey=${GEOAPIFY_KEY}`
  );
  return response.json();
  // Returns: GeoJSON polygon of reachable area
};
```

### Polygon Intersection

```typescript
const getIntersection = async (polygons: GeoJSON.Polygon[]) => {
  const response = await fetch(
    `https://api.geoapify.com/v1/geometry/intersection?apiKey=${GEOAPIFY_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: polygons.map(p => ({ type: 'Feature', geometry: p }))
      })
    }
  );
  return response.json();
  // Returns: GeoJSON polygon of intersection
};
```

## Edge Cases

| Case | Handling |
|------|----------|
| No intersection | Suggest meeting point at midpoint, note unequal travel |
| Very small intersection | Warn about limited options, offer to expand time |
| Different cities | Explain limitation, suggest video call or travel |
| 5+ people | Warn about complexity, find geographic centroid |
| No good places in zone | Expand search radius, suggest nearby neighborhoods |

## Alternative: Show Multiple Options

Instead of one place, offer 2-3 within the fair zone:

```
"I found 3 wine bars in the fair zone between you:

1. Noble Rot ($$$ - 15/18 min) - Best for intimate date
2. The Winemakers Club ($$ - 12/20 min) - More casual
3. Vinoteca ($$$ - 17/15 min) - Great food too

Which vibe works best for your date?"
```

---

[← Single Place](04-SINGLE-PLACE.md) | [Back to Index](../AGENTIC_MAPS.md) | [Areas to Explore →](06-AREAS-TO-EXPLORE.md)
