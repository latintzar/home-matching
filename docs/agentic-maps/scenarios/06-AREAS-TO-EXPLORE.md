---
status: design
last_updated: 2024-12-12
building_blocks: [5.1, 5.2, 6.1, 6.2, 6.3, Shared.1, Shared.2, Shared.4]
---

# Scenario 6: Areas to Explore Together

> "Neighborhoods to explore together - I'm in Brooklyn, she's in the Upper East Side"

## Overview

Combine the **"Meet in Middle"** geo-constraints with **"Things to Do"** area recommendations. Instead of finding one specific place, recommend **neighborhoods/areas** within the fair zone that both people can explore together.

## When This Triggers

- Multiple starting locations
- Interest in exploring an AREA (not one specific place)
- "Neighborhoods", "areas", "district", "explore together"
- Less structured plans, wandering, discovery

**Example queries**:
- "fun neighborhoods to explore together, I'm in Brooklyn, she's in Upper East Side"
- "areas to wander between us - Hackney and Brixton"
- "cool districts between Barcelona and Sitges for a day trip"
- "neighborhoods to check out that work for both of us"

## Key Difference from "Meet in Middle"

| Meet in Middle | Areas to Explore |
|----------------|------------------|
| Find ONE specific place | Find AREAS to wander |
| Uses ScrapingDog for venue | Uses Gemini grounding for areas |
| "Best wine bar between us" | "Cool neighborhoods between us" |
| Pin on map | Vibe circles on map |

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY (Gemini 2.5 Flash)                      Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "fun neighborhoods to explore, Brooklyn and Upper East Side"        │
│  Output: {                                                                  │
│    scenario: "areas-to-explore",                                            │
│    origins: ["Brooklyn, NYC", "Upper East Side, NYC"],                      │
│    vibe: "fun",                                                             │
│    duration: "day"                                                          │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: GEOCODE ORIGINS (Mapbox)                         Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Brooklyn → [−73.9442, 40.6782]                                            │
│  Upper East Side → [−73.9565, 40.7736]                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: MULTI-MODAL ISOCHRONES (Geoapify)                Cost: $0.029     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  For EACH origin, generate isochrones for:                                  │
│  - 30 min walk                                                              │
│  - 30 min transit                                                           │
│  - 30 min drive/cycle                                                       │
│  = 6 isochrone calls (2 origins × 3 modes)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: COMPUTE MODE COMBINATIONS (Geoapify + Turf.js)                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Calculate intersections for each mode combination:                         │
│                                                                             │
│  Combination           | A Mode   | B Mode   | Intersection                │
│  ─────────────────────|──────────|──────────|────────────────────────────  │
│  Both walk            | walk     | walk     | Small zone if close          │
│  A walks, B transit   | walk     | transit  | Moderate zone                │
│  A transit, B walk    | transit  | walk     | Moderate zone                │
│  Both transit         | transit  | transit  | Largest zone typically       │
│  A drives, B transit  | drive    | transit  | Varies                       │
│  Both drive           | drive    | drive    | Very large zone              │
│                                                                             │
│  → Present viable options to user                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: USER SELECTS MODE PREFERENCE                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  "Here are your options:                                                    │
│   • Both take transit: 5 neighborhood options                               │
│   • You walk, she takes transit: 3 neighborhood options                     │
│   • Both walk: No overlap (too far apart)                                   │
│                                                                             │
│   Which works best for you?"                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 6: GENERATE AREAS IN ZONE (Gemini + Grounding)      Cost: ~$0.005    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  With selected intersection zone as context:                                │
│  "Generate 3-5 neighborhoods within this zone for exploring..."             │
│  Returns: VibeArea objects with search suggestions                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 7: RENDER WITH DIRECTIONS (Mapbox)                  Cost: $0.015     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Show both origin points                                                  │
│  - Display selected intersection zone                                       │
│  - Draw vibe circles for recommended areas                                  │
│  - On area select: Show directions from both origins (2 Directions calls)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface AreasToExploreResult {
  origins: Array<{
    name: string;
    coordinates: [number, number];
  }>;
  
  modeOptions: Array<{
    personA: 'walk' | 'transit' | 'drive';
    personB: 'walk' | 'transit' | 'drive';
    intersectionSize: 'none' | 'small' | 'medium' | 'large';
    neighborhoodCount: number;
  }>;
  
  selectedMode: {
    personA: 'walk' | 'transit' | 'drive';
    personB: 'walk' | 'transit' | 'drive';
  };
  
  fairZone: GeoJSON.Polygon;
  
  areas: VibeArea[];  // 3-5 areas within the fair zone
  
  // Directions available after area selection
  directionsToArea?: {
    fromA: MapboxDirectionsResult;
    fromB: MapboxDirectionsResult;
  };
}
```

## Multi-Modal Isochrone Matrix

For 2 people with 3 modes each:

```
                Person B
                Walk    Transit   Drive
Person A  Walk    ✓        ✓        ✓
          Transit ✓        ✓        ✓
          Drive   ✓        ✓        ✓
```

**9 possible combinations**, but we calculate 6 isochrones (3 per person) and compute intersections locally with Turf.js for efficiency.

### Cost Optimization

```typescript
// Generate all isochrones first (6 API calls)
const isochronesA = await Promise.all([
  getIsochrone(originA, 'walk', 30),
  getIsochrone(originA, 'transit', 30),
  getIsochrone(originA, 'drive', 30),
]);
const isochronesB = await Promise.all([
  getIsochrone(originB, 'walk', 30),
  getIsochrone(originB, 'transit', 30),
  getIsochrone(originB, 'drive', 30),
]);

// Compute all 9 intersections locally with Turf.js (FREE)
import { intersect } from '@turf/turf';

const combinations = [];
for (const [iA, modeA] of isochronesA.entries()) {
  for (const [iB, modeB] of isochronesB.entries()) {
    const intersection = intersect(iA, iB);
    if (intersection) {
      combinations.push({
        personA: ['walk', 'transit', 'drive'][iA],
        personB: ['walk', 'transit', 'drive'][iB],
        intersection,
        area: turf.area(intersection)
      });
    }
  }
}
```

## UI Components

### Mode Selection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  How would you like to get there?                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Both take transit                                               │   │
│  │     5 neighborhoods available • Largest selection                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ○ You walk, she takes transit                                      │   │
│  │     3 neighborhoods available • You get exercise!                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ○ She walks, you take transit                                      │   │
│  │     3 neighborhoods available                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✗ Both walk                                                        │   │
│  │     No overlap - you're too far apart for walking!                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Map with Directions

When user selects an area, show directions from both origins:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│     🔴 Upper East Side                                                      │
│        ╲                                                                    │
│         ╲  (25 min transit)                                                │
│          ╲                                                                  │
│           ╲      ┌─────────────────┐                                       │
│            ╲     │                 │                                       │
│             ───▶ │   SoHo  🟠      │                                       │
│                  │   [Selected]    │                                       │
│            ───▶  │                 │                                       │
│           ╱      └─────────────────┘                                       │
│          ╱                                                                  │
│         ╱  (22 min transit)                                                │
│        ╱                                                                    │
│     🔵 Brooklyn                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [🚶 Walk] [🚇 Transit] [🚗 Drive]      Toggle transport mode display       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Area Info Card with Directions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SoHo                                                                 [×]   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Cast-iron architecture meets trendy boutiques. Perfect for wandering,     │
│  window shopping, and discovering hidden cafes together.                   │
│                                                                             │
│  💡 Why meet here: Central location with endless things to discover.       │
│     Great for a spontaneous afternoon together.                            │
│                                                                             │
│  ⏱️ Travel Times:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔵 From Brooklyn: 22 min (transit)                                  │   │
│  │ 🔴 From Upper East Side: 25 min (transit)                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🔍 Search Ideas:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ coffee shops SoHo NYC                     [GMaps] [TikTok]          │   │
│  │ vintage stores SoHo                       [GMaps] [TikTok]          │   │
│  │ brunch spots SoHo                         [GMaps] [TikTok]          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    [📍 Get Directions]                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### "Get Directions" Button Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Get Directions to SoHo                                              [×]   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Where are you coming from?                                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔵 Brooklyn (22 min transit)                                       │   │
│  │     [Open in Google Maps →]                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔴 Upper East Side (25 min transit)                                │   │
│  │     [Open in Google Maps →]                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Google Maps directions URL (FREE - no API):

```typescript
const getGMapsDirectionsUrl = (
  originLat: number, 
  originLng: number, 
  destLat: number, 
  destLng: number
) => {
  return `https://www.google.com/maps/dir/${originLat},${originLng}/${destLat},${destLng}`;
};
```

## Cost Breakdown

| Step | Service | Cost |
|------|---------|------|
| Query Classification | Gemini 2.5 Flash | ~$0.001 |
| Geocoding (2×) | Mapbox | ~$0.001 |
| Isochrones (6×) | Geoapify | $0.029 |
| Intersections (9×) | Turf.js (local) | FREE |
| Area Generation | Gemini 2.5 Pro + Grounding | ~$0.005 |
| Map Display | Mapbox Maps GL | $0.005 |
| Directions (2×) | Mapbox Directions | ~$0.002 |
| **Total** | | **~$0.043** |

## Edge Cases

| Case | Handling |
|------|----------|
| No intersection any mode | Suggest midpoint city/area, recommend video call |
| Only driving works | Note environmental impact, suggest alternatives |
| 3+ people | More isochrones but same pattern |
| Different cities | Explain limitation, focus on where to meet |
| Very small overlap | Show options but warn about limited choice |

## Comparison with Scenario 5

| Aspect | Meet in Middle (5) | Areas to Explore (6) |
|--------|-------------------|----------------------|
| Output | 1 specific place | 3-5 areas |
| Use case | "Let's meet at X" | "Let's wander around" |
| Data source | ScrapingDog | Gemini grounding |
| Card type | Place card | Vibe area card |
| Directions | To the place | To the area center |
| Follow-up | "Find coffee nearby?" | "Find specific spot?" |

---

[← Meet in Middle](05-MEET-IN-MIDDLE.md) | [Back to Index](../AGENTIC_MAPS.md) | [Multi-Stop Route →](07-MULTI-STOP-ROUTE.md)
