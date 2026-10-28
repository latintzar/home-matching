---
status: design
last_updated: 2024-12-12
building_blocks: [3.1, 3.2, Shared.1, Shared.2, Shared.4, Shared.5]
---

# Scenario 3: Stay + Do

> "Planning a weekend in Paris"

## Overview

Combined accommodation and activity recommendations for trip planning. Returns **two sets of areas**: 5 stay neighborhoods and 5 activity areas. This is the "complete trip planner" mode for a single city.

## When This Triggers

- Single city mentioned
- General trip planning intent
- Both accommodation AND activities implied
- "Weekend in", "trip to", "visiting" patterns

**Example queries**:
- "planning a weekend in Paris"
- "first time visiting Barcelona"
- "romantic getaway to Rome"
- "family trip to Tokyo"
- "where to stay and what to do in London"

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY (Gemini 2.5 Flash)                      Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "romantic weekend in Paris"                                         │
│  Output: {                                                                  │
│    scenario: "stay-and-do",                                                 │
│    city: "Paris",                                                           │
│    tripType: "romantic",                                                    │
│    duration: "weekend"                                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────────┐
│  Step 2a: GENERATE STAY AREAS     │ │  Step 2b: GENERATE ACTIVITY AREAS     │
│  (Gemini 2.5 Pro + Grounding)     │ │  (Gemini 2.5 Pro + Grounding)         │
│  Cost: ~$0.005                    │ │  Cost: ~$0.005                        │
│  ──────────────────────────────── │ │  ─────────────────────────────────────│
│  5 stay areas with:               │ │  5 activity areas with:               │
│  - Airbnb/Booking links           │ │  - GMaps/TikTok search links          │
│  - Price tiers                    │ │  - Activity-specific vibes            │
│  - Nearby highlights              │ │  - "Why" reasons                      │
└───────────────────────────────────┘ └───────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: RENDER (Mapbox)                                  Cost: $0.005     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Display map with TWO LAYERS:                                             │
│    • Stay areas (blue circles)                                              │
│    • Activity areas (orange circles)                                        │
│  - Toggle visibility per layer                                              │
│  - Different info cards per type                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface StayAndDoResponse {
  city: string;
  tripType: string;
  
  stayAreas: StayArea[];      // 5 accommodation neighborhoods
  activityAreas: VibeArea[];  // 5 activity neighborhoods
  
  // Cross-references: which activity areas are near which stay areas
  proximity: Array<{
    stayArea: string;
    nearbyActivities: string[];  // Activity area names within walking distance
  }>;
}
```

## Example Output

**Query**: "romantic weekend in Paris"

```json
{
  "city": "Paris",
  "tripType": "romantic",
  
  "stayAreas": [
    {
      "name": "Le Marais",
      "center": [2.3622, 48.8566],
      "radius": 500,
      "description": "Historic Jewish quarter with charming cobblestone streets, boutique hotels, and intimate wine bars. Perfect romantic base.",
      "priceTier": "mid",
      "bookingLinks": {
        "airbnb": "https://www.airbnb.com/s/Le%20Marais%20Paris/homes",
        "bookingCom": "https://www.booking.com/searchresults.html?ss=Le+Marais+Paris"
      },
      "whyStayHere": "Most romantic neighborhood with medieval charm, walkable to major sights",
      "nearbyHighlights": [
        { "text": "morning croissants at Carette", "gmapsUrl": "...", "tiktokUrl": "..." },
        { "text": "sunset walk along Seine", "gmapsUrl": "...", "tiktokUrl": "..." },
        { "text": "wine tasting in hidden caves", "gmapsUrl": "...", "tiktokUrl": "..." }
      ]
    }
    // ... 4 more stay areas
  ],
  
  "activityAreas": [
    {
      "name": "Montmartre",
      "center": [2.3431, 48.8867],
      "radius": 600,
      "description": "Artist's village perched on a hill. Sacré-Cœur at sunset, street artists, intimate bistros with city views.",
      "vibes": ["romantic", "artistic", "scenic"],
      "whyReason": "The most romantic viewpoint in Paris with intimate atmosphere",
      "searchSuggestions": [
        { "text": "sunset spots Montmartre", "gmapsUrl": "...", "tiktokUrl": "..." },
        { "text": "romantic dinner Montmartre", "gmapsUrl": "...", "tiktokUrl": "..." },
        { "text": "hidden bars Montmartre", "gmapsUrl": "...", "tiktokUrl": "..." }
      ]
    }
    // ... 4 more activity areas
  ],
  
  "proximity": [
    { "stayArea": "Le Marais", "nearbyActivities": ["Saint-Germain", "Latin Quarter"] },
    { "stayArea": "Saint-Germain", "nearbyActivities": ["Latin Quarter", "Le Marais"] }
  ]
}
```

## UI Components

### Dual-Layer Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [🏨 Stay Areas]  [🎯 Activities]  [Both]      Legend: 🔵 Stay  🟠 Activity │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│           🟠                                                                │
│          Montmartre                                                         │
│                                                                             │
│                        🔵 🟠                                                │
│                    Le Marais                                                │
│                   (overlapping)                                             │
│                                                                             │
│     🔵                           🟠                                         │
│   St-Germain                  Latin Quarter                                 │
│                                                                             │
│           🔵                              🟠                                │
│         7th Arr                        Bastille                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Combined View Info Card

When a stay area overlaps or is near activity areas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Le Marais                                       🏨 Stay  💰 Mid-range      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Historic Jewish quarter with charming cobblestone streets, boutique       │
│  hotels, and intimate wine bars. Perfect romantic base.                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Search Accommodations                                           │   │
│  │  [🏠 Airbnb]  [🏨 Booking.com]                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🚶 Walking Distance to Activities:                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Saint-Germain (15 min walk)                                       │   │
│  │ • Latin Quarter (10 min walk)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📍 Things to Do Nearby:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ morning croissants at Carette          [GMaps] [TikTok]             │   │
│  │ sunset walk along Seine                [GMaps] [TikTok]             │   │
│  │ wine tasting in hidden caves           [GMaps] [TikTok]             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Step | Service | Cost |
|------|---------|------|
| Query Classification | Gemini 2.5 Flash | ~$0.001 |
| Stay Area Generation | Gemini 2.5 Pro + Grounding | ~$0.005 |
| Activity Area Generation | Gemini 2.5 Pro + Grounding | ~$0.005 |
| Map Display | Mapbox Maps GL | $0.005 |
| **Total** | | **~$0.016** |

## Optimization: Single Gemini Call

For efficiency, both stay and activity areas can be generated in one call:

```typescript
const prompt = `
You are a Paris travel expert planning a ${tripType} trip.

Generate TWO sets of recommendations:

SET 1 - STAY AREAS (5 neighborhoods):
For each: name, coordinates, radius, description, price tier, why stay here, 3 nearby activities

SET 2 - ACTIVITY AREAS (5 neighborhoods):  
For each: name, coordinates, radius, description, vibes, why this matches ${tripType}, 3 search suggestions

Also provide: which activity areas are walking distance from which stay areas.

Return as JSON with structure: { stayAreas: [...], activityAreas: [...], proximity: [...] }
`;
```

This reduces cost from $0.016 to **~$0.011** (single Pro call instead of two).

## Proximity Calculation

Use Turf.js locally to calculate which areas overlap or are nearby:

```typescript
import { distance, point } from '@turf/turf';

const calculateProximity = (stayAreas: StayArea[], activityAreas: VibeArea[]) => {
  return stayAreas.map(stay => {
    const stayPoint = point(stay.center);
    const nearby = activityAreas
      .filter(activity => {
        const activityPoint = point(activity.center);
        const dist = distance(stayPoint, activityPoint, { units: 'meters' });
        return dist < 1500; // 15-20 min walk
      })
      .map(a => a.name);
    
    return { stayArea: stay.name, nearbyActivities: nearby };
  });
};
```

## Smart Follow-ups

After generating both area types, the agent can offer:

```
"I've found great neighborhoods for your romantic Paris weekend! 

🏨 For staying: Le Marais, Saint-Germain, and 3 more options
🎯 For activities: Montmartre, Latin Quarter, and 3 more

Would you like me to:
• Focus on a specific neighborhood?
• Find a specific restaurant for dinner?
• Plan a multi-stop romantic evening?"
```

This enables smooth transitions to other scenarios (Single Place, Multi-Stop).

## Edge Cases

| Case | Handling |
|------|----------|
| Short trip (day) | Skip stay areas, just do "Things to Do" |
| Long trip (week+) | Add day-by-day suggestions |
| Budget emphasis | Prioritize budget stay areas, free activities |
| Specific interest | Weight activity areas toward that interest |

---

[← Where to Stay](02-WHERE-TO-STAY.md) | [Back to Index](../AGENTIC_MAPS.md) | [Single Place →](04-SINGLE-PLACE.md)
