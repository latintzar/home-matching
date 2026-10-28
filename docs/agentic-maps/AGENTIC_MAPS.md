---
status: design
last_updated: 2024-12-12
owner: peter
level: 1-vision
feedback_from: 
  - BUILDING_BLOCKS.md (rarely - only fundamental changes)
  - scenarios/*.md (sometimes)
---

# Agentic Maps

> AI-powered travel planning with intelligent recommendations for areas, places, and routes.

<!-- 
📊 HIERARCHY POSITION: Level 1 (Vision)

    Level 1: AGENTIC_MAPS.md ◄── YOU ARE HERE
                    │
    Level 2: scenarios/*.md (Detailed specs)
                    │
    Level 3: BUILDING_BLOCKS.md (Implementation details)
                    │
    Level 4: Actual code

🔄 UPDATE RULES:
- This doc defines the VISION and KEY PRINCIPLES
- Only update when fundamental thinking changes
- Day-to-day learnings go in BUILDING_BLOCKS.md
- Scenario-level changes go in scenarios/*.md
-->

## Overview

Agentic Maps is a unified AI agent system that handles diverse travel planning queries through intelligent tool orchestration. The agent classifies user queries into one of seven scenarios and executes the appropriate pipeline to generate recommendations.

## Key Principles

1. **Cost-Effective**: Minimize API calls through smart caching and local processing
2. **Real-World Accuracy**: Use authentic data from reviews and web content
3. **Progressive Enhancement**: Start simple, add complexity only when needed
4. **User-Centric**: Every recommendation includes actionable next steps

## The Seven Scenarios

| # | Scenario | Example Query | Output | Est. Cost |
|---|----------|---------------|--------|-----------|
| 1 | [Things to Do](scenarios/01-THINGS-TO-DO.md) | "cool bars in Barcelona" | 5 vibe areas | ~$0.011 |
| 2 | [Where to Stay](scenarios/02-WHERE-TO-STAY.md) | "where to stay in Tokyo" | 5 stay areas | ~$0.011 |
| 3 | [Stay + Do](scenarios/03-STAY-AND-DO.md) | "weekend in Paris" | 5 stay + 5 activity areas | ~$0.016 |
| 4 | [Single Place](scenarios/04-SINGLE-PLACE.md) | "best ramen near Shibuya" | 1 verified place | ~$0.012 |
| 5 | [Meet in Middle](scenarios/05-MEET-IN-MIDDLE.md) | "coffee between us" | 1-3 equidistant places | ~$0.035 |
| 6 | [Areas to Explore](scenarios/06-AREAS-TO-EXPLORE.md) | "neighborhoods to explore together" | 3-5 shared areas | ~$0.040 |
| 7 | [Multi-Stop Route](scenarios/07-MULTI-STOP-ROUTE.md) | "pub crawl in Dublin" | Optimized route | ~$0.04-0.20 |

*All costs include $0.005 Mapbox Maps GL load*

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER QUERY                                                                  │
│  "romantic date spots in Barcelona"                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  QUERY CLASSIFIER (Gemini 2.5 Flash)                     Cost: ~$0.001      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: User query                                                          │
│  Output: { scenario: "things-to-do", city: "Barcelona", intent: {...} }     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SCENARIO ROUTER                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Routes to appropriate pipeline based on classified scenario                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
    ┌───────────┐           ┌───────────────┐          ┌──────────────┐
    │ Area-Based│           │ Specific Place│          │  Multi-Stop  │
    │ Scenarios │           │   Scenarios   │          │   Scenario   │
    │  (1,2,3)  │           │    (4,5,6)    │          │     (7)      │
    └───────────┘           └───────────────┘          └──────────────┘
          │                         │                         │
          ▼                         ▼                         ▼
    ┌───────────┐           ┌───────────────┐          ┌──────────────┐
    │  Gemini   │           │  ScrapingDog  │          │ Hybrid Engine│
    │ Grounding │           │   + Gemini    │          │ Areas+Places │
    └───────────┘           └───────────────┘          └──────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESPONSE                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Map markers/areas                                                         │
│  • Info cards with descriptions                                              │
│  • Actionable links (GMaps, TikTok, Airbnb, Booking.com)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Sources

| Source | Used For | Cost |
|--------|----------|------|
| **Gemini + Grounding** | Area recommendations, vibes | $0.00025/1K input |
| **ScrapingDog** | Specific place verification | $0.001/request |
| **Geoapify** | Isochrones, intersections | $0.0049/call |
| **Mapbox** | Maps, directions, matrix | $0.005/load + per-call |
| **Turf.js** | Local geo calculations | FREE |
| **OSM Data** | POI discovery (road trips) | FREE |

## Quick Reference

### Scenario Selection Logic

```typescript
const classifyQuery = (query: string): Scenario => {
  // Single city, activities → Things to Do
  // Single city, accommodation → Where to Stay
  // Single city, both → Stay + Do
  // Specific venue search → Single Place
  // Multiple origins, one destination → Meet in Middle
  // Multiple origins, area exploration → Areas to Explore
  // Multiple destinations/stops → Multi-Stop Route
};
```

### Common Output Patterns

**Area Card** (Scenarios 1, 2, 3, 6):
- Title, description, "why" reason
- 3 search suggestions (GMaps + TikTok links)
- For stay areas: Airbnb + Booking.com links

**Place Card** (Scenarios 4, 5, 7):
- Verified name, address, rating
- Hours, price level
- Direct GMaps link
- Review highlights

**Route Card** (Scenario 7):
- Ordered stops with connections
- Total time, distance
- Transport mode options
- Turn-by-turn available

## Platform Integration

### Chrome Extension

The [Chrome Extension](architecture/CHROME-EXTENSION.md) injects vibe areas onto Airbnb and Booking.com:

```
Main App → Generate areas → User clicks "Search Airbnb"
                                    │
                                    ▼
         Extension (on airbnb.com) ← Syncs via chat ID
                                    │
                                    ▼
         Shows same areas on Airbnb's map
```

### Chat History

[Chat History](architecture/CHAT-HISTORY.md) provides ChatGPT-style session management:
- Collapsible sidebar (icon/full-text toggle)
- Auto-generated titles
- Resume previous searches
- Share results via link

## Cost Analysis

### Per-Query Costs (Single Use)

| Scenario | Gemini | ScrapingDog | Geoapify | Mapbox | Total |
|----------|--------|-------------|----------|--------|-------|
| Things to Do | $0.006 | - | - | $0.005 | **$0.011** |
| Where to Stay | $0.006 | - | - | $0.005 | **$0.011** |
| Stay + Do | $0.011 | - | - | $0.005 | **$0.016** |
| Single Place | $0.002 | $0.005 | - | $0.005 | **$0.012** |
| Meet in Middle | $0.003 | $0.012 | $0.015 | $0.005 | **$0.035** |
| Areas to Explore | $0.006 | - | $0.029 | $0.005 | **$0.040** |
| Multi-Stop (areas) | $0.015 | - | - | $0.025 | **$0.040** |
| Multi-Stop (places) | $0.010 | $0.080 | - | $0.110 | **$0.200** |

### Heavy User Analysis (100 queries/month)

| Scenario Mix | Monthly Cost | Per Query |
|--------------|--------------|-----------|
| 100% area-based (1,2,3) | $1.30 | $0.013 |
| 50% areas, 50% places | $6.15 | $0.062 |
| 100% multi-stop | $12.00 | $0.120 |

## Documentation Structure

```
docs/agentic-maps/
├── AGENTIC_MAPS.md          ← You are here
├── BUILDING_BLOCKS.md       ← Modular tests for each capability
├── scenarios/
│   ├── 01-THINGS-TO-DO.md
│   ├── 02-WHERE-TO-STAY.md
│   ├── 03-STAY-AND-DO.md
│   ├── 04-SINGLE-PLACE.md
│   ├── 05-MEET-IN-MIDDLE.md
│   ├── 06-AREAS-TO-EXPLORE.md
│   └── 07-MULTI-STOP-ROUTE.md
└── architecture/
    ├── AGENT-PATTERN.md
    ├── CHAT-UI.md
    ├── CHAT-HISTORY.md
    ├── CHROME-EXTENSION.md
    └── API-REFERENCE.md
```

## Getting Started

1. **Understand the scenarios**: Read through each scenario doc to understand capabilities
2. **Test building blocks**: Use [BUILDING_BLOCKS.md](BUILDING_BLOCKS.md) to verify each capability in isolation
3. **Review architecture**: See how the agent pattern and UI work together
4. **Check API costs**: Use API-REFERENCE.md for detailed pricing
5. **Implement**: Start with simpler scenarios (1-3) before complex ones (4-7)

### Testing Approach

Before building full scenarios, test individual building blocks:

```
Phase 1: Core Rendering (No APIs)
  └─ Shared.1-5: Circles, cards, URL generation

Phase 2: Area Generation  
  └─ Test 1.1, 1.2, 2.1: Vibe areas, itineraries, stay areas

Phase 3: Geo Operations
  └─ Test 5.1-5.3: Geocoding, isochrones, intersections

Phase 4: Place Verification
  └─ Test 4.1-4.4: ScrapingDog search, details, reviews, curation

Phase 5: Routing
  └─ Test 7.2-7.5: Matrix, optimization, directions, mixed routes
```

See [BUILDING_BLOCKS.md](BUILDING_BLOCKS.md) for full test specifications.

## Related Resources

- [Chrome Extension Code](../../leo-vibe-extension/)
- [Vibe Maps App](../../src/app/vibe-maps/)
- API Endpoints (`../../src/app/api/vibe-maps/`, historical reference)

---

*Last Updated: December 2024*
