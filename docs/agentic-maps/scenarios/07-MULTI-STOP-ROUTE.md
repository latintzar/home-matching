---
status: design
last_updated: 2024-12-12
building_blocks: [7.1, 7.2, 7.3, 7.4, 7.5, 4.1, 4.2, 1.1, Shared.1, Shared.3]
---

# Scenario 7: Multi-Stop Route

> "Plan a pub crawl in Dublin" / "Road trip from Barcelona to Valencia"

## Overview

The **unified multi-stop planning engine**. Handles everything from "100% areas" (scenic road trip) to "100% specific places" (pub crawl with named bars) and everything in between. The **mix ratio** is dynamically determined based on city character, user preference, and occasion type.

## The Unified Concept

Instead of separate "road trip" and "pub crawl" modes, this is ONE engine with variable specificity:

```
100% Areas ◄──────────────────────────────────────────────► 100% Places
   │                                                              │
   │  "Scenic drive along                    "Pub crawl in       │
   │   the coast"                             Dublin with        │
   │                                          specific bars"     │
   │                                                              │
   │        "Date night - some planned,                          │
   │         some spontaneous"                                    │
   │              (50/50 mix)                                     │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

## When This Triggers

- Multiple stops/destinations mentioned
- "Crawl", "hop", "route", "road trip"
- Itinerary planning
- "Plan my evening/day/weekend"

**Example queries**:
- "pub crawl in Dublin" → 100% specific places
- "road trip Barcelona to Valencia" → 100% areas
- "romantic evening in Paris - dinner and drinks" → 60% places, 40% areas
- "bar hop in Shoreditch" → 80% places, 20% areas

## The Mix Ratio

### Factors That Determine Mix

```typescript
interface MixDecision {
  cityCharacter: number;     // 1-10: wing-it (1) to plan-ahead (10)
  userPreference: number;    // 1-10: spontaneous (1) to specific (10)
  occasionBias: number;      // -2 to +2: areas (-) to places (+)
  
  // Output
  specificPlaceRatio: number; // 0.0 to 1.0
}
```

### City Character Assessment

Cities have different "planability":

| City | Score | Character | Why |
|------|-------|-----------|-----|
| Barcelona | 4 | Wing-it | Walkable, dense, discovery-friendly |
| Tokyo | 8 | Plan-ahead | Complex transit, reservations matter |
| London | 8 | Plan-ahead | Spread out, need reservations for good spots |
| Amsterdam | 5 | Balanced | Compact but specific cafes have queues |
| Rome | 6 | Moderate | Some need reservations, some spontaneous |
| NYC | 7 | Plan-ahead | High demand, specific places book up |
| Dublin | 5 | Balanced | Pubs everywhere but good ones get crowded |

```typescript
// Cache to avoid re-calculating
const CITY_PLANNING_SCORES: Record<string, CityCharacter> = {
  'barcelona': { score: 4, bias: 'areas', reason: 'Walkable, dense, discovery-friendly' },
  'tokyo': { score: 8, bias: 'places', reason: 'Complex transit, reservations critical' },
  'london': { score: 8, bias: 'places', reason: 'Spread out, reservations matter' },
  'dublin': { score: 5, bias: 'balanced', reason: 'Pubs everywhere but good ones busy' },
  // ...
};
```

### Occasion Bias

| Occasion | Bias | Example |
|----------|------|---------|
| Road trip | −2 | "Scenic drive to Valencia" |
| Exploring | −1 | "Wander around neighborhoods" |
| Date night | +1 | "Romantic evening" → specific restaurants |
| Pub crawl | +2 | "Bar hop" → specific bars |
| Business | +2 | "Lunch meetings" → specific restaurants |

### Decision Formula

```typescript
const calculateMixRatio = (
  cityScore: number,         // 1-10
  userPreference: number,    // 1-10 (inferred or asked)
  occasionBias: number       // -2 to +2
): number => {
  // Base ratio from city + preference
  const baseRatio = ((cityScore + userPreference) / 20);
  
  // Apply occasion bias (each point = 15% shift)
  const adjustedRatio = baseRatio + (occasionBias * 0.15);
  
  // Clamp to 0-1
  return Math.max(0, Math.min(1, adjustedRatio));
};

// Examples:
// Barcelona (4) + spontaneous user (3) + road trip (-2) = 0.05 → 95% areas
// Tokyo (8) + specific user (8) + pub crawl (+2) = 1.0 → 100% places
// London (8) + balanced user (5) + date night (+1) = 0.80 → 80% places
```

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY & DETERMINE MIX (Gemini 2.5 Flash)      Cost: ~$0.002    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "pub crawl in Dublin"                                               │
│  Output: {                                                                  │
│    scenario: "multi-stop-route",                                            │
│    city: "Dublin",                                                          │
│    stops: 5,                                                                │
│    cityScore: 5,                                                            │
│    occasionBias: +2,                                                        │
│    mixRatio: 0.85  // 85% specific places                                   │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: FOR EACH STOP, DECIDE: Area or Specific?                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│  With 85% ratio and 5 stops:                                                │
│  Stop 1: Specific bar (85% chance)                                          │
│  Stop 2: Specific bar                                                       │
│  Stop 3: Specific bar                                                       │
│  Stop 4: Area to explore (15% chance)                                       │
│  Stop 5: Specific bar                                                       │
│  → 4 specific + 1 area                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌─────────────────────────────────┐     ┌─────────────────────────────────────┐
│  FOR SPECIFIC STOPS:            │     │  FOR AREA STOPS:                    │
│  (ScrapingDog pipeline)         │     │  (Gemini + Grounding)               │
│  ─────────────────────────────  │     │  ───────────────────────────────    │
│  • Google search                │     │  • Generate area recommendation     │
│  • GMaps place details          │     │  • Include search suggestions       │
│  • Reviews for verification     │     │  • No specific venue verification   │
│  Cost: ~$0.020 per place        │     │  Cost: ~$0.002 per area             │
└─────────────────────────────────┘     └─────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: OPTIMIZE ROUTE (Mapbox Matrix + Directions)      Cost: varies     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Calculate optimal order using Matrix API                                 │
│  • Get turn-by-turn for each leg                                            │
│  • Total time/distance calculation                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: RENDER (Mapbox)                                  Cost: $0.005     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Draw route line connecting all stops                                     │
│  • Pin markers for specific places                                          │
│  • Circle markers for areas                                                 │
│  • Info cards appropriate to stop type                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface MultiStopRoute {
  city: string;
  mixRatio: number;            // What ratio was used
  totalStops: number;
  
  stops: Array<SpecificStop | AreaStop>;
  
  route: {
    totalDistance: number;     // km
    totalTime: number;         // minutes (walking between stops)
    optimizedOrder: number[];  // Indices for optimal route
  };
  
  legs: Array<{
    from: number;              // Stop index
    to: number;
    distance: number;
    duration: number;
    polyline: string;          // Encoded route line
  }>;
}

interface SpecificStop {
  type: 'specific';
  position: number;
  place: SinglePlaceResult['place'];
  recommendation: SinglePlaceResult['recommendation'];
}

interface AreaStop {
  type: 'area';
  position: number;
  area: VibeArea;
}
```

## Cost Calculation

The cost **scales with mix ratio**:

```typescript
const calculateRouteCost = (
  stops: number,
  mixRatio: number  // 0-1, where 1 = all specific
): number => {
  const specificStops = Math.round(stops * mixRatio);
  const areaStops = stops - specificStops;
  
  // Base costs
  const classificationCost = 0.002;
  const mapCost = 0.005;
  
  // Per-stop costs
  const specificCost = 0.020;  // ScrapingDog pipeline
  const areaCost = 0.002;      // Gemini grounding
  
  // Matrix API (N×N elements)
  const matrixElements = stops * stops;
  const matrixCost = matrixElements * 0.0005;  // $0.0005 per element
  
  // Directions for each leg
  const directionsCost = (stops - 1) * 0.002;
  
  return (
    classificationCost +
    mapCost +
    (specificStops * specificCost) +
    (areaStops * areaCost) +
    matrixCost +
    directionsCost
  );
};

// Examples:
// 5 stops, 100% specific: $0.002 + $0.005 + $0.100 + $0.0125 + $0.008 = $0.128
// 5 stops, 100% areas:    $0.002 + $0.005 + $0.010 + $0.0125 + $0.008 = $0.038
// 5 stops, 50/50:         $0.002 + $0.005 + $0.055 + $0.0125 + $0.008 = $0.083
```

## Example 1: Pub Crawl (100% Specific)

**Query**: "pub crawl in Dublin, 5 stops"

```json
{
  "city": "Dublin",
  "mixRatio": 1.0,
  "totalStops": 5,
  
  "stops": [
    {
      "type": "specific",
      "position": 1,
      "place": {
        "name": "The Stag's Head",
        "address": "1 Dame Ct, Dublin 2",
        "rating": 4.6,
        "gmapsUrl": "..."
      },
      "recommendation": {
        "whyThisPlace": "Victorian pub with original mahogany bar. Perfect first stop for pints.",
        "reviewHighlights": [...]
      }
    },
    {
      "type": "specific",
      "position": 2,
      "place": {
        "name": "The Long Hall",
        "address": "51 S Great George's St",
        "rating": 4.7
      }
    },
    // ... 3 more specific bars
  ],
  
  "route": {
    "totalDistance": 1.8,
    "totalTime": 25,
    "optimizedOrder": [0, 2, 1, 4, 3]  // Optimal walking order
  }
}
```

## Example 2: Road Trip (100% Areas)

**Query**: "scenic road trip Barcelona to Valencia"

```json
{
  "city": "Barcelona → Valencia",
  "mixRatio": 0.0,
  "totalStops": 4,
  
  "stops": [
    {
      "type": "area",
      "position": 1,
      "area": {
        "name": "Sitges",
        "center": [1.8117, 41.2371],
        "radius": 800,
        "description": "Charming coastal town with whitewashed buildings and great beaches.",
        "whyReason": "Perfect first stop, 40 min from Barcelona. Great for coffee and a walk.",
        "searchSuggestions": [
          { "text": "breakfast spots Sitges", "gmapsUrl": "..." },
          { "text": "beach walks Sitges", "gmapsUrl": "..." }
        ]
      }
    },
    {
      "type": "area",
      "position": 2,
      "area": {
        "name": "Tarragona Old Town",
        "center": [1.2445, 41.1189],
        "description": "Roman ruins and medieval streets. UNESCO World Heritage site."
      }
    },
    {
      "type": "area",
      "position": 3,
      "area": {
        "name": "Peñíscola",
        "description": "Stunning castle on a peninsula. Game of Thrones filming location."
      }
    },
    {
      "type": "area",
      "position": 4,
      "area": {
        "name": "El Carmen (Valencia)",
        "description": "Historic heart of Valencia. Great for dinner exploration."
      }
    }
  ],
  
  "route": {
    "totalDistance": 350,
    "totalTime": 240,  // 4 hours driving
    "optimizedOrder": [0, 1, 2, 3]  // Already in logical order
  }
}
```

## Example 3: Date Night (60% Specific)

**Query**: "romantic evening in London - dinner then drinks"

```json
{
  "city": "London",
  "mixRatio": 0.6,
  "totalStops": 3,
  
  "stops": [
    {
      "type": "specific",
      "position": 1,
      "place": {
        "name": "Brat",
        "address": "First Floor, 4 Redchurch St, Shoreditch",
        "rating": 4.5,
        "priceLevel": "$$$"
      },
      "recommendation": {
        "whyThisPlace": "Wood-fired excellence in an intimate setting. Book the counter seats for the full experience.",
        "tips": ["Book 2-3 weeks ahead", "Try the turbot"]
      }
    },
    {
      "type": "area",
      "position": 2,
      "area": {
        "name": "Columbia Road Area",
        "description": "Wander through the flower market streets. Great for a post-dinner stroll before drinks.",
        "searchSuggestions": [
          { "text": "wine bars Columbia Road", "gmapsUrl": "..." }
        ]
      }
    },
    {
      "type": "specific",
      "position": 3,
      "place": {
        "name": "Nightjar",
        "address": "129 City Rd, Shoreditch",
        "rating": 4.6
      },
      "recommendation": {
        "whyThisPlace": "Speakeasy vibes with exceptional cocktails. Perfect romantic finale.",
        "tips": ["Book a table, don't just show up"]
      }
    }
  ]
}
```

## UI Components

### Route Overview Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Your Route: Dublin Pub Crawl                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  📍 5 stops  •  🚶 1.8 km  •  ⏱️ ~25 min walking                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. The Stag's Head              📍 Specific  •  ⭐ 4.6             │   │
│  │     Victorian pub, perfect start                                    │   │
│  │                          ↓ 5 min walk                               │   │
│  │  2. The Long Hall                📍 Specific  •  ⭐ 4.7             │   │
│  │     Most beautiful bar in Dublin                                    │   │
│  │                          ↓ 8 min walk                               │   │
│  │  3. Temple Bar Area              🟠 Area to explore                 │   │
│  │     Wander and find a spot                                          │   │
│  │                          ↓ 4 min walk                               │   │
│  │  4. The Brazen Head               📍 Specific  •  ⭐ 4.4             │   │
│  │     Oldest pub in Ireland                                           │   │
│  │                          ↓ 8 min walk                               │   │
│  │  5. Kehoe's                      📍 Specific  •  ⭐ 4.5             │   │
│  │     Perfect finale, classic Dublin                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [🗺️ View Full Route]  [📋 Copy to Notes]  [📤 Share]                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mixed Stop Card (Area)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stop 3: Temple Bar Area                                    🟠 Explore     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Iconic Dublin neighborhood - take your time wandering and find a spot     │
│  that catches your eye. Touristy but fun late night.                       │
│                                                                             │
│  🔍 Search Ideas:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ live music Temple Bar                     [GMaps] [TikTok]          │   │
│  │ hidden pubs Temple Bar Dublin             [GMaps] [TikTok]          │   │
│  │ late night food Temple Bar                [GMaps] [TikTok]          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  💡 Tip: If you want a specific spot here instead, just ask!               │
│                                                                             │
│                                    ↓ 4 min to next stop                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Summary by Mix

| Mix Ratio | 5 Stops | 8 Stops | Description |
|-----------|---------|---------|-------------|
| 100% areas | ~$0.04 | ~$0.06 | Scenic road trip |
| 75% areas | ~$0.06 | ~$0.09 | Mostly exploring |
| 50/50 | ~$0.08 | ~$0.12 | Balanced |
| 75% places | ~$0.10 | ~$0.16 | Mostly specific |
| 100% places | ~$0.13 | ~$0.20 | Full pub crawl |

## Mapbox Matrix API Usage

For route optimization:

```typescript
const optimizeRoute = async (stops: Coordinates[]) => {
  // Matrix API returns N×N travel times
  const response = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/walking/` +
    `${stops.map(s => s.join(',')).join(';')}` +
    `?access_token=${MAPBOX_TOKEN}`
  );
  
  const { durations } = await response.json();
  // durations[i][j] = time from stop i to stop j
  
  // Use traveling salesman heuristic to find optimal order
  return findOptimalOrder(durations);
};
```

**Cost**: $0.50 per 1000 elements. 5 stops = 25 elements = $0.0125.

## GMaps Link Hack (FREE)

For specific places, generate Google Maps link without API:

```typescript
const getGMapsSearchUrl = (placeName: string, city: string) => {
  return `https://www.google.com/maps/search/${encodeURIComponent(placeName + ' ' + city)}`;
};

// In place card:
// "The Stag's Head" → https://www.google.com/maps/search/The+Stag%27s+Head+Dublin
```

## Edge Cases

| Case | Handling |
|------|----------|
| Unknown city | Ask for clarification, use moderate defaults |
| Very long route | Warn about time, suggest breaking into days |
| All stops closed | Check hours, suggest alternatives or different time |
| User overrides mix | Allow: "I want all specific places" |
| Too few stops | Suggest minimum 3, or convert to single place |

## Transitions

After generating a route:

```
"Your Dublin pub crawl is ready! 🍺

I've planned 4 specific bars + 1 area to explore in between.

Would you like me to:
• Make all stops specific bars instead?
• Add another stop?
• Find dinner before you start?"
```

---

[← Areas to Explore](06-AREAS-TO-EXPLORE.md) | [Back to Index](../AGENTIC_MAPS.md) | [Architecture →](../architecture/AGENT-PATTERN.md)
