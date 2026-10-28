# ⚠️ SUPERSEDED

> **This document has been consolidated into the unified Agentic Maps documentation.**
>
> **New location**: [`/docs/agentic-maps/AGENTIC_MAPS.md`](../../docs/agentic-maps/AGENTIC_MAPS.md)
>
> Content from this document has been migrated to:
> - [`scenarios/07-MULTI-STOP-ROUTE.md`](../../docs/agentic-maps/scenarios/07-MULTI-STOP-ROUTE.md) (100% areas variant)
> - Road trips are now handled as "100% areas" mode in the unified Multi-Stop Route engine

---

# Road Trip Planner Feature

> **Integration Status**: This feature is part of the unified Agentic Maps system as the "100% areas" variant of Multi-Stop Route.  
> **See also**: `/docs/agentic-maps/scenarios/07-MULTI-STOP-ROUTE.md` for the full implementation.

---

## Overview

A scenic road trip route planner that finds beautiful alternatives to the fastest route between two points, using minimal API calls and local geospatial analysis.

**Agent Integration**: Rather than a separate UI, Road Trip functionality is now accessed through the same chat interface as neighborhood queries. The AI agent classifies the user's intent and calls the appropriate tools (`get_routes`, `analyze_route_scenic`, `find_pois_in_corridor`, etc.).

**User Input Example:**
> "Road trip from Barcelona to Valencia - scenic coastal routes, avoid highways, we have time"

**Output:**
- 3-5 route alternatives displayed on Mapbox
- Each route scored for scenic value, detour time, road types
- Same card UI with prev/next navigation
- Gemini-powered explanations of why each route is special

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│  "Barcelona to Valencia, scenic, avoid highways"                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   1. MAPBOX DIRECTIONS API                       │
│  • Single API call with alternatives=true                       │
│  • Returns 3 route alternatives                                 │
│  • Profile: driving (can exclude motorways)                     │
│  • Free tier: 100,000 requests/month                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   2. TURF.JS LOCAL ANALYSIS                      │
│  For each route:                                                │
│  • turf.length() - total distance                               │
│  • turf.buffer() - create 5km corridor around route             │
│  • turf.bbox() - bounding box for POI queries                   │
│  • turf.along() - sample points along route                     │
│  • Calculate detour % vs fastest route                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. LOCAL OSM/POI DATA                          │
│  Query our local datasets for features in each corridor:        │
│  • Natural: beaches, forests, mountains, lakes, rivers          │
│  • Cultural: historic sites, viewpoints, villages               │
│  • Infrastructure: rest areas, scenic overlooks                 │
│  • Road metadata: road types, surfaces, elevation               │
│                                                                 │
│  Data sources:                                                  │
│  • spain-datasets/pois/ - Points of interest                    │
│  • spain-datasets/boundaries/ - Natural areas                   │
│  • Overpass Turbo exports (one-time download)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   4. GEMINI REASONING                            │
│  Input to Gemini:                                               │
│  • Route geometries                                             │
│  • POIs within each corridor                                    │
│  • User preferences (scenic, avoid highways, etc.)              │
│                                                                 │
│  Gemini outputs:                                                │
│  • Scenic score (1-10) for each route                           │
│  • Explanation of why route is special                          │
│  • Suggested stops along the way                                │
│  • Time estimates and detour percentages                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   5. MAPBOX DISPLAY                              │
│  • Draw routes as LineStrings with different colors             │
│  • Highlight POIs along routes                                  │
│  • Info card (bottom-left) with:                                │
│    - Route name/description                                     │
│    - Scenic score                                               │
│    - Distance & time                                            │
│    - Detour % from fastest                                      │
│    - Key highlights                                             │
│    - Prev/Next navigation                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Analysis

### Mapbox Pricing (December 2024)

| API | Pricing | Free Tier |
|-----|---------|-----------|
| **Maps GL (map load)** | **$0.005 per load** | First 50,000 loads/month FREE |
| **Matrix API** | **$0.002 per element** | First 100,000 elements/month FREE |
| Directions API | $0.002 per request | First 100,000 requests/month FREE |

**Key insights**: 
- Maps GL is charged per map load (page/session) at $0.005
- Matrix is priced per **element** (each cell in the N×N matrix), not per API call

### Per-Search Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| **Mapbox Maps GL** | **$0.005** | 1 map load per session |
| Mapbox Directions | FREE (100k/month) | 1 call for baseline + alternatives |
| **Mapbox Matrix (10×10)** | **$0.20** | 100 elements × $0.002 |
| Turf.js | FREE | Client-side library |
| Local OSM data | FREE | One-time download |
| Gemini API | ~$0.003 | Route architect call |

**Total per search: ~$0.21** (mostly Matrix API)

### Monthly Cost Per User (Conservative Estimate)

| Usage | Calculation | Monthly Cost |
|-------|-------------|--------------|
| **Typical user** | 2 trips × 20 Matrix iterations × 100 elements + 2 map loads | **$8.01/user** |

This assumes:
- 10 locations in Matrix (10×10 = 100 elements)
- ~20 iterations per trip (refining, exploring options)
- 2 trips planned per month
- 1 map load per trip

### Business Implication

Road trip planning should be a **premium feature** ($10-15/month subscription) to:
- Cover Mapbox Matrix + Maps GL costs
- Maintain healthy margins
- Position as high-value feature

See `/docs/plans/VIBE_MAPS_AGENT_ARCHITECTURE.md` for full business case analysis.

---

## Data Requirements

### One-Time Downloads (Overpass Turbo)

```
// Natural features - Spain
[out:json];
area["name"="España"]->.spain;
(
  node["natural"="beach"](area.spain);
  node["natural"="viewpoint"](area.spain);
  node["natural"="peak"](area.spain);
  way["natural"="coastline"](area.spain);
  way["waterway"="river"](area.spain);
  relation["boundary"="national_park"](area.spain);
);
out geom;
```

```
// Historic/Cultural - Spain
[out:json];
area["name"="España"]->.spain;
(
  node["historic"](area.spain);
  node["tourism"="viewpoint"](area.spain);
  node["tourism"="attraction"](area.spain);
  way["building"="castle"](area.spain);
);
out geom;
```

### Estimated Data Size
- Natural features: ~50MB
- Cultural features: ~30MB
- Road metadata: ~100MB (optional, for road type analysis)

---

## UI Design

### Landing Page
```
┌─────────────────────────────────────────────────────────────────┐
│                         🚗 Road Trip Planner                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ From: [Barcelona_________________________]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ To:   [Valencia__________________________]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Preferences: [scenic coastal, avoid highways, relaxed]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                    [🗺️ Find Routes]                             │
│                                                                 │
│  Popular routes:                                                │
│  [Barcelona → Valencia] [Madrid → Seville] [Bilbao → Santiago] │
└─────────────────────────────────────────────────────────────────┘
```

### Map View with Routes
```
┌─────────────────────────────────────────────────────────────────┐
│  🚗  From → To                              [✨ New Search]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ╭──────────────╮                             │
│                   ╱                ╲                            │
│      ━━━━━━━━━━━╱   Route 1        ╲━━━━━━━━━━━                │
│                ╱   (Coastal)        ╲                           │
│     ┄┄┄┄┄┄┄┄┄╱                       ╲┄┄┄┄┄┄┄┄┄                │
│             ╱  Route 2 (Inland)       ╲                         │
│            ╱                           ╲                        │
│           ●                             ●                       │
│        Barcelona                    Valencia                    │
│                                                                 │
│  ┌────────────────────────────────┐                             │
│  │ 🏖️ Coastal Paradise Route      │                             │
│  │                                │                             │
│  │ ⭐ Scenic: 9/10                │                             │
│  │ 📏 350km (+15% detour)         │                             │
│  │ ⏱️ 4h 30min                    │                             │
│  │                                │                             │
│  │ Hugs the Mediterranean coast   │                             │
│  │ through Tarragona, passing     │                             │
│  │ Roman ruins and golden beaches │                             │
│  │                                │                             │
│  │ 📍 Highlights:                 │                             │
│  │ • Sitges beach town            │                             │
│  │ • Tarragona amphitheater       │                             │
│  │ • Peñíscola castle             │                             │
│  │                                │                             │
│  │     [←]  1 / 3  [→]            │                             │
│  └────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Basic Route Display
1. Create `/vibe-maps/road-trip` page
2. Input fields for From/To
3. Mapbox Directions API integration
4. Display 3 alternative routes on map
5. Basic info card with distance/time

### Phase 2: Local Analysis
1. Download OSM scenic POI data for Spain
2. Implement Turf.js corridor analysis
3. Count scenic features per route corridor
4. Calculate scenic scores

### Phase 3: Gemini Enhancement
1. Send route data + POIs to Gemini
2. Generate route descriptions
3. Suggest highlights/stops
4. Rank routes by user preferences

### Phase 4: Polish
1. Route highlighting on hover
2. Smooth transitions between routes
3. Export/share route functionality
4. Popular route suggestions

---

## Technical Notes

### Mapbox Directions API Call
```javascript
const response = await fetch(
  `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}` +
  `?alternatives=true` +           // Get multiple routes
  `&geometries=geojson` +          // GeoJSON for Turf.js
  `&overview=full` +               // Full route geometry
  `&exclude=motorway` +            // Avoid highways (optional)
  `&access_token=${MAPBOX_TOKEN}`
);
```

### Turf.js Analysis
```javascript
import * as turf from '@turf/turf';

// Create 5km buffer around route
const corridor = turf.buffer(route, 5, { units: 'kilometers' });

// Find POIs within corridor
const scenicPOIs = allPOIs.filter(poi => 
  turf.booleanPointInPolygon(poi, corridor)
);

// Calculate scenic density
const routeLength = turf.length(route, { units: 'kilometers' });
const scenicDensity = scenicPOIs.length / routeLength;

// Sample points for elevation analysis
const samplePoints = [];
for (let i = 0; i <= 100; i++) {
  const point = turf.along(route, (routeLength * i) / 100, { units: 'kilometers' });
  samplePoints.push(point);
}
```

### Scenic Score Calculation
```javascript
const calculateScenicScore = (route, poisInCorridor) => {
  const weights = {
    beach: 3,
    viewpoint: 3,
    national_park: 4,
    castle: 2,
    historic: 2,
    coastline_proximity: 3,
    mountain: 2
  };
  
  let score = 0;
  poisInCorridor.forEach(poi => {
    score += weights[poi.type] || 1;
  });
  
  // Normalize to 1-10 scale
  return Math.min(10, Math.max(1, score / 5));
};
```

---

## Gemini Prompt Template

```
You are a scenic road trip expert for Spain. Analyze these route options and rank them for a traveler.

TRIP REQUEST: "${userPreferences}"

ROUTE OPTIONS:
${routes.map((r, i) => `
Route ${i + 1}:
- Distance: ${r.distance}km
- Duration: ${r.duration} hours
- Detour: ${r.detourPercent}% longer than fastest
- Points of Interest nearby:
  ${r.pois.map(p => `• ${p.name} (${p.type})`).join('\n  ')}
`).join('\n')}

For each route, provide:
1. A catchy name (e.g., "Coastal Paradise Route")
2. Scenic score (1-10)
3. A 2-sentence description of why this route is special
4. Top 3 must-see highlights along the way
5. Best for: [type of traveler]

Return as JSON array.
```

---

## Supported Modes of Transport

This "area-based" planning approach works for any mode where you're choosing **areas to visit** rather than specific addresses:

| Mode | Example Query | Works Well? |
|------|---------------|-------------|
| 🚗 Driving | "Scenic coastal drive Barcelona to Valencia" | ✅ Primary use case |
| 🚶 Walking | "Walking tour of Gothic Quarter" | ✅ Same pattern |
| 🚴 Cycling | "Bike ride through Penedès wine country" | ✅ Same pattern |
| 🚌 Day trips | "Day trip to Montserrat and Sitges" | ✅ Same pattern |

### Different Pattern: Specific Place Planning

This architecture is **NOT designed for** queries about specific places:

| Query Type | Example | Why Different | See |
|------------|---------|---------------|-----|
| Date night | "Romantic dinner and drinks in El Born" | Need specific venues, opening hours | `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` |
| Pub crawl | "Plan a pub crawl in Soho" | Need specific bars, walking route | `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` |
| Food tour | "Best 5 taco spots in CDMX" | Need specific restaurants, reviews | `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` |

**This is handled by a separate architecture** using:
- ScrapingDog Google Search for authentic web recommendations
- ScrapingDog Google Maps API for verified coordinates & hours
- ScrapingDog Google Maps Reviews for 300-500 reviews per search
- Gemini Flash Lite for review analysis and curation
- Mapbox Matrix for walking times between places

**Cost**: ~$0.375 per search (77% is Mapbox Matrix)

**See**: `/docs/plans/SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` for full architecture.

---

## Future Enhancements

1. **Elevation profiles** - Show climb/descent for cyclists
2. **Time-of-day suggestions** - "Best at sunset"
3. **Weather integration** - Avoid routes with bad weather
4. **Fuel/charging stops** - For EVs or long trips
5. **Multi-day itineraries** - Break long trips into days
6. **User reviews** - Community feedback on routes
7. **Offline mode** - Download route for offline use
8. ~~**Specific place planning**~~ - ✅ Documented in `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md`

---

## Related Files

- `/src/app/vibe-maps/page.tsx` - Current neighborhood finder (similar UI)
- `/leo-vibe-extension/` - Chrome extension with vibe circles
- `/spain-datasets/` - Existing Spain geodata
- `/docs/plans/VIBE_MAPS_AGENT_ARCHITECTURE.md` - **Unified agent architecture** (supersedes standalone implementation)
- `/docs/plans/VIBE_MAPS_CHAT_PLAN.md` - Chat sidebar UI design
- `/docs/plans/SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` - **Specific place planning** (date nights, pub crawls, food tours)

---

## Agent-Based Implementation

This document describes the **standalone** road trip planner concept. The actual implementation will be part of the unified Vibe Maps AI Agent, where:

1. **Same entry point**: User types "Barcelona to Valencia scenic route" in the same chat
2. **Intent classification**: Agent recognizes this as a `road_trip` query
3. **Tool calling**: Agent calls `get_routes` → `analyze_route_scenic` → `find_pois_in_corridor` → `score_and_describe_routes`
4. **Same UI**: Routes displayed on the same Mapbox map with info cards

The technical details in this document (Mapbox API calls, Turf.js analysis, Gemini prompts) remain accurate and are used by the agent tools.

See `/docs/plans/VIBE_MAPS_AGENT_ARCHITECTURE.md` for the complete agent implementation plan.

---

*Last Updated: December 2024*
