# ⚠️ SUPERSEDED

> **This document has been consolidated into the unified Agentic Maps documentation.**
>
> **New location**: [`/docs/agentic-maps/AGENTIC_MAPS.md`](../agentic-maps/AGENTIC_MAPS.md)
>
> Content from this document has been migrated to:
> - [`scenarios/04-SINGLE-PLACE.md`](../agentic-maps/scenarios/04-SINGLE-PLACE.md)
> - [`scenarios/05-MEET-IN-MIDDLE.md`](../agentic-maps/scenarios/05-MEET-IN-MIDDLE.md)
> - [`scenarios/06-AREAS-TO-EXPLORE.md`](../agentic-maps/scenarios/06-AREAS-TO-EXPLORE.md)
> - [`scenarios/07-MULTI-STOP-ROUTE.md`](../agentic-maps/scenarios/07-MULTI-STOP-ROUTE.md)
> - [`architecture/API-REFERENCE.md`](../agentic-maps/architecture/API-REFERENCE.md)

---

# Specific Place Planning: ScrapingDog + Gemini Flash Lite Architecture

> **Purpose**: Deep-dive place discovery using real web data instead of algorithmic results
> **Key Advantage**: Full review analysis + web-sourced recommendations = authentic, verified suggestions
> **Five Modes**: Single Place (~$0.035) | Meet in the Middle (~$0.055) | Areas to Explore (~$0.07) | Adaptive Hybrid (~$0.23) | Multi-Stop Journey (~$0.38)

---

## Table of Contents

### Planning Modes
1. [Single Place Search](#single-place-search) ← "Best X in Y" queries
2. [Meet in the Middle](#meet-in-the-middle) ← Fair meeting point, specific venues
3. [Areas to Explore Together](#areas-to-explore-together) ← Neighborhoods + activity ideas
4. [Adaptive Hybrid Route](#adaptive-hybrid-route) ← **NEWEST: Mix of specific places + areas**
5. [Multi-Stop Journey Planning](#multi-stop-journey-planning) ← All specific places route

### Reference
6. [Overview](#overview)
7. [When to Use This Approach](#when-to-use-this-approach)
8. [Complete Process Flow](#complete-process-flow)
9. [Detailed Step Breakdown](#detailed-step-breakdown)
10. [Example: Romantic Date Night](#example-romantic-date-night)
11. [Cost Analysis](#cost-analysis)
12. [Comparison with Alternatives](#comparison-with-alternatives)
13. [Implementation Notes](#implementation-notes)
14. [API Reference](#api-reference)

---

## Single Place Search

> **Cost**: ~$0.025-0.045 per search (includes $0.005 Mapbox map load)  
> **Use case**: "Best pizza in Soho", "authentic ramen Tokyo", "where do locals eat in El Born"

When someone wants to find **one great place** (or compare a few options), you don't need the expensive Matrix routing. This is a streamlined version that's 10x cheaper.

### Why Better Than Google AI Mode

| Feature | Google AI Mode | ScrapingDog Approach |
|---------|----------------|---------------------|
| **Sources** | Google's index + algorithm | TimeOut, Eater, Reddit, food blogs |
| **Reviews** | Summarized snippets | Full reviews analyzed |
| **Authenticity** | Algorithmic ranking | "Locals recommend" signals |
| **Specificity** | Generic results | Tailored to exact taste |
| **Insider tips** | Generic info | Extracted from real reviews |

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER QUERY: "Best authentic tacos in CDMX, not touristy"                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: TARGETED WEB SEARCHES                                              │
│  ScrapingDog Google Search × 3-5 = $0.003-0.005                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Searches tailored to the specific request:                                 │
│                                                                             │
│  1. "best authentic tacos CDMX locals"                                      │
│  2. "taqueria Mexico City not touristy reddit"                              │
│  3. "CDMX street tacos food blogger"                                        │
│  4. "where do mexicans eat tacos CDMX"                                      │
│  5. "hidden gem taqueria Roma Condesa"                                      │
│                                                                             │
│  Output: 30-50 URLs (Eater, local blogs, Reddit, Infatuation)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: FETCH TOP ARTICLES                                                 │
│  ScrapingDog Web Scraper × 5-8 = $0.005-0.008                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Prioritize:                                                                │
│  • Local food writers/bloggers                                              │
│  • Reddit threads with upvoted answers                                      │
│  • Recent articles (2024)                                                   │
│  • Sources that mention "local", "authentic", "not touristy"               │
│                                                                             │
│  Output: ~15,000 words of recommendations                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: EXTRACT & RANK PLACES                                              │
│  Gemini 2.5 Flash Lite = ~$0.004                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Prompt:                                                                    │
│  "User wants: authentic tacos, not touristy, local vibe                    │
│                                                                             │
│   From these articles, extract taco spots that match.                       │
│   Rank by: how often mentioned + strength of recommendation +               │
│            authenticity signals ('locals love', 'hidden gem', etc.)         │
│                                                                             │
│   For each, capture:                                                        │
│   - Name, neighborhood, price range                                         │
│   - Why recommended (quote key phrases)                                     │
│   - Authenticity signals                                                    │
│   - What to order (if mentioned)"                                          │
│                                                                             │
│  Output: Top 5-10 places ranked by fit                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: VERIFY ON GOOGLE MAPS                                              │
│  ScrapingDog Google Maps × 5-10 = $0.005-0.010                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each extracted place:                                                  │
│  • Verify it exists                                                         │
│  • Get exact coordinates                                                    │
│  • Get opening hours                                                        │
│  • Get rating & review count                                                │
│  • Get price level                                                          │
│                                                                             │
│  Filter out: closed permanently, < 4.0 rating, too few reviews             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: GET REVIEWS FOR TOP PICKS                                          │
│  ScrapingDog Google Maps Reviews × 3-5 = $0.003-0.005                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For top 3-5 candidates, get full reviews:                                  │
│  • Look for authenticity mentions                                           │
│  • Check for tourist complaints ("too crowded with tourists")              │
│  • Find insider tips ("sit at the counter", "order the lengua")            │
│  • Spot red flags (declining quality, rude service)                        │
│                                                                             │
│  Output: 50-150 reviews to analyze                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: FINAL CURATION                                                     │
│  Gemini 2.5 Flash Lite = ~$0.003                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Combine web recommendations + Maps data + reviews:                         │
│                                                                             │
│  Output:                                                                    │
│  {                                                                          │
│    "topPick": {                                                             │
│      "name": "Taquería Orinoco",                                           │
│      "neighborhood": "Roma Norte",                                          │
│      "coordinates": { "lat": 19.4195, "lng": -99.1617 },                   │
│      "rating": 4.7,                                                         │
│      "priceRange": "$",                                                     │
│      "hours": "8am-11pm daily",                                            │
│      "whyTheBest": "Consistently ranked #1 by local food writers...",      │
│      "authenticityScore": "High - 'where taxi drivers eat'",              │
│      "whatToOrder": ["tacos de suadero", "salsa verde"],                   │
│      "insiderTips": ["Go before 2pm to avoid lines", "Cash only"],        │
│      "redFlags": null                                                       │
│    },                                                                       │
│    "alternatives": [ ... 2-3 more options ... ]                            │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost Breakdown: Single Place Search

| Step | Service | Units | Cost |
|------|---------|-------|------|
| 1. Web searches | ScrapingDog Google | 3-5 | $0.003-0.005 |
| 2. Fetch articles | ScrapingDog Web | 5-8 | $0.005-0.008 |
| 3. Extract & rank | Gemini Flash Lite | ~20K tokens | $0.004 |
| 4. Verify on Maps | ScrapingDog Maps | 5-10 | $0.005-0.010 |
| 5. Get reviews | ScrapingDog Reviews | 3-5 | $0.003-0.005 |
| 6. Final curation | Gemini Flash Lite | ~10K tokens | $0.003 |
| 7. Display map | Mapbox Maps GL | 1 load | $0.005 |
| **TOTAL** | | | **$0.025-0.045** |

### Example Output

**Query**: "Best pizza in Soho, authentic Italian style"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🍕 TOP PICK: Pizza Pilgrims                                                │
│                                                                             │
│  📍 11 Dean Street, Soho, W1D 3RP                                          │
│  ⭐ 4.7 (2,340 reviews)  |  💰 ££  |  🕐 11am-11pm                         │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WHY IT'S THE BEST                                                          │
│  "Mentioned by TimeOut, Eater London, and multiple Reddit threads.         │
│   The owners traveled to Naples to learn from masters, and the oven        │
│   was imported from Italy. Reviews consistently praise the authentic       │
│   Neapolitan style - blistered crust, fresh mozzarella, simple toppings."  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🍕 WHAT TO ORDER                                                           │
│  • Nduja pizza (spicy, spreadable salami)                                  │
│  • Classic Margherita (test of any pizzeria)                               │
│  • Nutella pizza ring for dessert                                          │
│                                                                             │
│  💡 INSIDER TIPS                                                            │
│  • "Order at the counter upstairs to skip the queue" - Reddit              │
│  • "Go at 3pm for no wait" - Google review                                 │
│  • "The Padron peppers starter is underrated" - food blogger               │
│                                                                             │
│  ⚠️ WATCH OUT                                                               │
│  • Gets very busy 12-2pm and 6-8pm                                         │
│  • No reservations, queue can be 20+ mins at peak                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  [📍 Get Directions]  [📞 Call]  [🎵 TikTok Search]  [📸 Instagram]        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ALSO GREAT                                                                 │
│                                                                             │
│  🍕 Homeslice (Neal's Yard) - "Best by-the-slice option"                   │
│  🍕 Franco Manca (multiple) - "Sourdough base, very affordable"            │
│  🍕 Luca (Clerkenwell) - "Upscale Italian, pizza is phenomenal"            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Taste-Specific Queries

The approach handles very specific taste preferences:

| Query | Search Strategy |
|-------|-----------------|
| "Best ramen Tokyo, rich tonkotsu" | Search for "tonkotsu ramen Tokyo", filter by richness mentions |
| "Quiet coffee shop for work, Shoreditch" | Search for "laptop friendly cafe", filter by "quiet", "wifi", "plugs" |
| "Best steak, dry-aged, Barcelona" | Search for "dry aged steak Barcelona", verify via reviews |
| "Vegetarian fine dining Paris" | Search for "michelin vegetarian Paris", "plant-based tasting menu" |
| "Dive bar, cheap drinks, authentic NYC" | Search for "dive bar NYC locals", filter out polished/trendy mentions |

The key is **translating the taste preference into search queries** that will surface the right recommendations from the right sources.

### Heavy User Cost: 10 Searches/Day × 30 Days

| Component | Monthly Usage | Cost |
|-----------|---------------|------|
| ScrapingDog Google | 1,200 searches | $1.20 |
| ScrapingDog Web | 2,100 pages | $2.10 |
| ScrapingDog Maps | 2,400 lookups | $2.40 |
| ScrapingDog Reviews | 1,200 places | $1.20 |
| Gemini Flash Lite | ~9M tokens | $1.20 |
| Mapbox Maps GL | 300 loads | $1.50 |
| **TOTAL** | | **~$9.60/month** |

**Compare to Multi-Stop Journey**: ~$114/month (Matrix API dominates)

---

## Meet in the Middle

> **Cost**: ~$0.055 per search (2 people) | ~$0.06 (3 people) — includes $0.005 Mapbox map load  
> **Use case**: "Date spot convenient for both of us", "Where should we meet for drinks?"

When 2-3 people want to find a place that's **fair travel time for everyone**, we use isochrones to find the overlap zone, then search within that area.

### Why This Approach?

| Factor | Simple Midpoint | Isochrone Intersection |
|--------|-----------------|------------------------|
| **Accuracy** | Geometric center (useless) | Actual reachable areas |
| **Transit support** | ❌ Assumes straight lines | ✅ Real metro/bus routes |
| **Fairness** | Arbitrary point | Equal travel time |
| **Neighborhoods** | Random spot | Identifies real areas |

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER QUERY                                                                 │
│  "Good cocktail bar, not too loud. She's in Gràcia, I'm in Poblenou.       │
│   30 min travel max each."                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: GATHER CONSTRAINTS (Chat)                                          │
│  No API cost                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Extract from query or ask:                                                 │
│  • Person 1 location: "Poblenou"                                           │
│  • Person 2 location: "Gràcia"                                             │
│  • Max travel time: 30 minutes each                                        │
│  • Transport mode: Transit (metro + walking)                               │
│  • What looking for: "cocktails, quiet enough to talk"                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: GEOCODE STARTING POINTS                                            │
│  Mapbox Geocoding × 2 = FREE (within 100K/month)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  "Poblenou Barcelona" → [2.1994, 41.4036]                                  │
│  "Gràcia Barcelona"   → [2.1539, 41.4025]                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: GENERATE ISOCHRONES                                                │
│  Geoapify Isochrones × 2 = $0.0049 × 2 = $0.0098                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Person 1 (Poblenou):                                                       │
│  GET /v1/isoline?lat=41.4036&lon=2.1994&type=time&mode=transit&range=1800  │
│  → Polygon A: All areas reachable in 30 min by metro/walking               │
│                                                                             │
│  Person 2 (Gràcia):                                                         │
│  GET /v1/isoline?lat=41.4025&lon=2.1539&type=time&mode=transit&range=1800  │
│  → Polygon B: All areas reachable in 30 min by metro/walking               │
│                                                                             │
│  Visual:                                                                    │
│  ┌─────────────────────────────────────────┐                               │
│  │         ╭───────╮                       │                               │
│  │        ╱ Gràcia  ╲                      │                               │
│  │       ╱    ●      ╲                     │                               │
│  │      │      ╲      │     ╭──────╮       │                               │
│  │      │       ╲     │    ╱Poblenou╲      │                               │
│  │       ╲       ████████╱    ●     │      │                               │
│  │        ╲     ██FAIR██         ╱        │                               │
│  │         ╲    ██ZONE██ ╲      ╱          │                               │
│  │          ╰───╱────────╲─╰────╯          │                               │
│  └─────────────────────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: COMPUTE INTERSECTION                                               │
│  Geoapify Geometry × 1 = $0.0049                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /v1/geometry/intersection                                             │
│  Body: { polygons: [isochroneA, isochroneB] }                              │
│                                                                             │
│  → Intersection polygon: The "fair meeting zone"                           │
│                                                                             │
│  Result: Polygon covering El Born, parts of Ciutat Vella, Barceloneta     │
│                                                                             │
│  ⚠️ Edge case: If intersection is EMPTY                                    │
│     → Suggest increasing travel time                                        │
│     → Suggest using transit instead of walking                             │
│     → Show how close the isochrones get                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: IDENTIFY NEIGHBORHOODS IN INTERSECTION                             │
│  Gemini Flash Lite = ~$0.002                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Send intersection polygon bounds to Gemini:                                │
│                                                                             │
│  Prompt:                                                                    │
│  "This polygon in Barcelona covers these coordinates: [bounds].            │
│   What neighborhoods are in this area? For each, describe the vibe         │
│   and what it's known for (bars, restaurants, nightlife, etc.)"            │
│                                                                             │
│  Output:                                                                    │
│  [                                                                          │
│    { "name": "El Born", "vibe": "trendy, cocktail bars, historic" },       │
│    { "name": "Gothic Quarter", "vibe": "atmospheric, some tourist traps" },│
│    { "name": "Barceloneta", "vibe": "beach bars, casual, seafood" }        │
│  ]                                                                          │
│                                                                             │
│  This helps scope the web searches to relevant areas only.                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: TARGETED WEB SEARCHES (Scoped to Fair Zone)                        │
│  ScrapingDog Google × 4-6 = $0.004-0.006                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Searches ONLY for the identified neighborhoods:                            │
│                                                                             │
│  ✅ "best quiet cocktail bars El Born Barcelona"                           │
│  ✅ "romantic bars Gothic Quarter not loud"                                │
│  ✅ "intimate cocktail spots Barceloneta"                                  │
│  ✅ "date night drinks El Born reddit"                                     │
│                                                                             │
│  ❌ DON'T search: "cocktail bars Gràcia" (outside fair zone!)              │
│  ❌ DON'T search: "bars Poblenou" (outside fair zone!)                     │
│                                                                             │
│  Output: 30-40 URLs, all for places in the fair meeting zone               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: FETCH & EXTRACT PLACES                                             │
│  ScrapingDog Web × 5-8 = $0.005-0.008                                       │
│  Gemini Flash Lite = ~$0.004                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Same as Single Place Search:                                               │
│  • Scrape top articles                                                      │
│  • Extract place names matching taste criteria                              │
│  • Note which neighborhood each is in                                       │
│                                                                             │
│  Output: 8-15 candidate places in the fair zone                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: VERIFY ON MAPS + FILTER BY INTERSECTION                            │
│  ScrapingDog Maps × 10 = $0.010                                             │
│  Turf.js point-in-polygon = FREE                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each extracted place:                                                  │
│                                                                             │
│  1. Get coordinates + hours + rating from ScrapingDog Maps                 │
│  2. Verify coordinates are INSIDE intersection polygon:                     │
│                                                                             │
│     const isInFairZone = turf.booleanPointInPolygon(                       │
│       [place.lng, place.lat],                                               │
│       intersectionPolygon                                                   │
│     );                                                                      │
│                                                                             │
│  3. Filter out any places outside the fair zone                            │
│  4. Store Google Maps link for each verified place                         │
│                                                                             │
│  Output: 5-10 verified places, all within fair travel time                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 9: GET REVIEWS + CURATE                                               │
│  ScrapingDog Reviews × 5 = $0.005                                           │
│  Gemini Flash Lite = ~$0.003                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Same as Single Place Search:                                               │
│  • Get full reviews for top 5 candidates                                    │
│  • Analyze for taste match ("quiet", "romantic", "cocktails")              │
│  • Extract insider tips                                                     │
│  • Flag any red flags                                                       │
│                                                                             │
│  Output: Top 3-5 curated places with full context                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 10: DISPLAY ON MAP                                                    │
│  Mapbox rendering = FREE                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Display:                                                                   │
│  • Person 1's isochrone (blue polygon)                                     │
│  • Person 2's isochrone (green polygon)                                    │
│  • Intersection/overlap highlighted                                         │
│  • Recommended places as pins                                               │
│  • Starting points marked                                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                                                                 │       │
│  │      ╭───────╮                                                  │       │
│  │     ╱ 🔵 Gràcia╲                        Legend:                 │       │
│  │    ╱     ●      ╲                       🔵 Her 30-min reach     │       │
│  │   │       ╲      │     ╭──────╮         🟢 His 30-min reach     │       │
│  │   │        ╲     │    ╱🟢 Poblenou      ███ Fair zone          │       │
│  │    ╲       ████████╱    ●     │         🍸 Recommended          │       │
│  │     ╲     ██ 🍸 ██          ╱                                   │       │
│  │      ╲    ██ 🍷 ██╲       ╱                                     │       │
│  │       ╰───╱────────╲─╰────╯                                     │       │
│  │                                                                 │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Output

**Query**: "Cocktail bar for a date, quiet enough to talk. She's in Gràcia, I'm in Poblenou. 30 min travel max."

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🍸 MEET IN THE MIDDLE: 3 great options in your fair zone                  │
│                                                                             │
│  📍 Fair zone: El Born, Gothic Quarter (both reachable in <30 min)        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🏆 TOP PICK: Paradiso                                                      │
│                                                                             │
│  📍 El Born (Carrer de Rera Palau, 4)                                      │
│  ⭐ 4.6 (1,847 reviews)  |  💰 €€€  |  🕐 7pm-2:30am                       │
│                                                                             │
│  🚇 TRAVEL TIME                                                             │
│  • From Gràcia: 22 min (L4 → Jaume I)                                      │
│  • From Poblenou: 18 min (L4 → Barceloneta + walk)                         │
│                                                                             │
│  WHY IT'S PERFECT                                                           │
│  "World-famous speakeasy hidden behind a pastrami shop fridge.             │
│   Reviews consistently mention 'intimate', 'perfect for dates',            │
│   'quiet enough to talk'. The entrance alone is a conversation starter."   │
│                                                                             │
│  💡 INSIDER TIPS                                                            │
│  • Book 2-3 days ahead on their website                                    │
│  • Before 9pm is quieter                                                   │
│  • Ask bartender for recommendations - they're artists                     │
│                                                                             │
│  [📍 Google Maps] [📞 Reserve] [🎵 TikTok]                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ALSO IN YOUR FAIR ZONE                                                     │
│                                                                             │
│  🍷 Dry Martini (Gothic) - "Classic, sophisticated, quiet booths"          │
│     🚇 25 min from Gràcia | 20 min from Poblenou                           │
│     [📍 Google Maps]                                                        │
│                                                                             │
│  🍸 Two Schmucks (El Born) - "Creative cocktails, intimate vibe"           │
│     🚇 23 min from Gràcia | 17 min from Poblenou                           │
│     [📍 Google Maps]                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost Breakdown: Meet in the Middle

| Step | Service | Units | Cost |
|------|---------|-------|------|
| 1-2. Constraints + Geocode | Chat + Mapbox | - | FREE |
| 3. Isochrones | Geoapify | 2 | $0.0098 |
| 4. Intersection | Geoapify | 1 | $0.0049 |
| 5. Identify neighborhoods | Gemini Flash Lite | ~5K tokens | $0.002 |
| 6. Web searches | ScrapingDog Google | 4-6 | $0.005 |
| 7. Fetch articles | ScrapingDog Web | 5-8 | $0.007 |
| 8. Verify on Maps | ScrapingDog Maps | 10 | $0.010 |
| 9a. Get reviews | ScrapingDog Reviews | 5 | $0.005 |
| 9b. Curate | Gemini Flash Lite | ~15K tokens | $0.004 |
| 10. Display map | Mapbox Maps GL | 1 load | $0.005 |
| **TOTAL (2 people)** | | | **~$0.055** |

### For 3+ People

| People | Isochrones | Intersection | Geo Cost | Total |
|--------|------------|--------------|----------|-------|
| 2 | $0.0098 | $0.0049 | $0.0147 | ~$0.055 |
| 3 | $0.0147 | $0.0049 | $0.0196 | ~$0.06 |
| 4 | $0.0196 | $0.0049 | $0.0245 | ~$0.065 |

### Why Geoapify Instead of Turf.js?

| Factor | Turf.js (Free) | Geoapify ($0.0049) |
|--------|----------------|---------------------|
| **Distance calc** | As-the-crow-flies | Actual walking/transit |
| **Transit support** | ❌ No | ✅ Metro, bus, tram |
| **Accuracy** | ~50% error | Real network routing |
| **Use case** | Rough estimates | "Meet tonight" precision |

**For imminent meetups**: Geoapify is worth the $0.015 because:
- Metro lines aren't circles (L4 goes east-west, not in all directions)
- Walking routes follow streets, not straight lines
- Users are meeting in hours, not "sometime" - precision matters
- Total cost is still only ~$0.055

### Edge Cases

| Scenario | How to Handle |
|----------|---------------|
| **No intersection** | "Your 30-min zones don't overlap. Try 45 min, or meet somewhere one of you travels further." |
| **Tiny intersection** | "Only a small area works for both. Here are the 2 options there..." |
| **Multiple distinct zones** | "Two areas work: El Born (more bars) or Eixample (more restaurants). Which vibe?" |
| **One person much further** | "Fair zone is closer to [person]. Want to adjust, or is that OK?" |

### Heavy User Cost: 10 Searches/Day × 30 Days

| Component | Monthly Usage | Cost |
|-----------|---------------|------|
| Geoapify (isochrones + intersection) | 900 calls | $4.41 |
| ScrapingDog (all) | ~6,000 calls | $6.00 |
| Gemini Flash Lite | ~9M tokens | $1.20 |
| Mapbox Maps GL | 300 loads | $1.50 |
| **TOTAL** | | **~$13/month** |

---

## Areas to Explore Together

> **Cost**: ~$0.07 per search (2 people) | ~$0.09 (3 people)  
> **Use case**: "Where should we hang out?", "Find us some cool neighborhoods to explore"

This is a **lighter variant** of "Meet in the Middle" — instead of finding specific venues, it recommends **neighborhoods/areas** with activity ideas. Cheaper because no ScrapingDog review scraping needed.

### Key Difference from "Meet in the Middle"

| Feature | Meet in the Middle | Areas to Explore |
|---------|-------------------|------------------|
| **Output** | Specific venues (bars, restaurants) | Neighborhoods + activity ideas |
| **Reviews** | 300-500 analyzed | Not needed |
| **ScrapingDog** | Yes | No |
| **Gemini** | Flash Lite (curation) | Pro + Grounding (areas) |
| **Directions** | To specific address | To area center |
| **Cost** | ~$0.055 | **~$0.07** |

### Multi-Mode Isochrone Matrix

The key innovation here is calculating isochrones for **multiple transport modes** upfront, then letting the user choose what works.

#### Step 1: Calculate All Isochrones (Parallel)

For 2 people × 3 modes = **6 isochrones**

```
Person A (Gràcia):              Person B (Poblenou):
├── 🚶 Walking (30 min)         ├── 🚶 Walking (30 min)
├── 🚇 Transit (30 min)         ├── 🚇 Transit (30 min)
└── 🚗 Driving (30 min)         └── 🚗 Driving (30 min)
```

**Cost**: 6 × $0.0049 = **$0.0294**

#### Step 2: Compute Intersection Matrix (Turf.js = FREE)

9 combinations computed locally:

```
                      Person B
                   Walk   Transit   Drive
Person A  Walk      🟢      🟢        🟡
         Transit    🟢      🟢        🟡
         Drive      🟡      🟡        🔴

🟢 = Good overlap (specific areas)
🟡 = Large overlap (less useful)
🔴 = Overlap too big (entire city)
```

#### Step 3: Present Transport Options to User

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🚶 HOW DO YOU WANT TO GET THERE?                                           │
│                                                                             │
│  Based on 30 min travel from each of you, here's what works:               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚶 BOTH WALKING                                          [Select]   │   │
│  │                                                                     │   │
│  │ Fair zone: El Born, Gothic Quarter                                  │   │
│  │ "Intimate area, easy to walk around together"                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚇 BOTH TRANSIT                                          [Select]   │   │
│  │                                                                     │   │
│  │ Fair zone: +Eixample, +Gràcia, +Barceloneta                        │   │
│  │ "More options, metro makes it easy"                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚶+🚗 MIXED (You walk, they drive)                       [Select]   │   │
│  │                                                                     │   │
│  │ Fair zone: Most of city center                                      │   │
│  │ "They can park near you"                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ❌ Both driving: Overlap too large to recommend specific areas            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Step 4: Generate Vibe Areas + Directions

Once user picks a mode combo:

1. Use that intersection polygon
2. Generate 3-5 vibe areas within it (Gemini + Grounding)
3. Calculate Mapbox Directions from **each person** to **each area**

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: GATHER LOCATIONS                                                   │
│  No API cost                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  • "Where are you?" → "Gràcia"                                             │
│  • "Where are they?" → "Poblenou"                                          │
│  • "What are you into?" → "food, street art"                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: GEOCODE LOCATIONS                                                  │
│  Mapbox Geocoding × 2 = FREE                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  "Gràcia Barcelona" → [2.1539, 41.4025]                                    │
│  "Poblenou Barcelona" → [2.1994, 41.4036]                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: CALCULATE ALL ISOCHRONES (Parallel)                                │
│  Geoapify × 6 = $0.0294                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  All 6 isochrones calculated in parallel:                                   │
│  • Person A: walk, transit, drive (30 min each)                            │
│  • Person B: walk, transit, drive (30 min each)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: COMPUTE INTERSECTION MATRIX                                        │
│  Turf.js (local) = FREE                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  9 intersections computed locally:                                          │
│  • A_walk ∩ B_walk → Small zone (El Born, Gothic)                          │
│  • A_walk ∩ B_transit → Medium zone                                        │
│  • A_transit ∩ B_transit → Large zone                                      │
│  • ... etc                                                                  │
│                                                                             │
│  Filter out: empty intersections, oversized zones                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: PRESENT TRANSPORT OPTIONS                                          │
│  No API cost                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Show user which mode combos work:                                          │
│  "Both walking gives you El Born & Gothic Quarter..."                      │
│  "Both transit adds Eixample, Gràcia, Barceloneta..."                      │
│                                                                             │
│  User selects: "Both transit"                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: GENERATE VIBE AREAS                                                │
│  Gemini + Google Search Grounding = ~$0.025                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Prompt:                                                                    │
│  "Generate 3-5 vibe areas within this zone for people interested in        │
│   food and street art. Include why each area is great and 3 activity       │
│   suggestions with search queries."                                         │
│                                                                             │
│  Output:                                                                    │
│  [                                                                          │
│    { name: "El Born", lat: 41.385, lng: 2.182, why: "...",                 │
│      activities: [...] },                                                   │
│    { name: "Gothic Quarter", ... },                                        │
│    { name: "Barceloneta", ... }                                            │
│  ]                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: CALCULATE DIRECTIONS TO EACH AREA                                  │
│  Mapbox Directions × 6 = $0.012                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each vibe area, get directions from BOTH people:                       │
│                                                                             │
│  El Born:                                                                   │
│  • From Gràcia: 20 min transit, route geometry                             │
│  • From Poblenou: 18 min transit, route geometry                           │
│                                                                             │
│  Gothic Quarter:                                                            │
│  • From Gràcia: 22 min transit, route geometry                             │
│  • From Poblenou: 20 min transit, route geometry                           │
│                                                                             │
│  ... etc for all areas                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: DISPLAY MAP + CARDS                                                │
│  Mapbox Maps GL = $0.005                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Display:                                                                   │
│  • Both isochrones (faded)                                                  │
│  • Fair zone (intersection) highlighted                                     │
│  • Vibe circles for each area                                               │
│  • Starting points marked (A, B)                                            │
│                                                                             │
│  When area selected:                                                        │
│  • Show direction lines from BOTH starting points                          │
│  • Info card with why + activities + Get Directions button                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Map Display: Selected Area with Directions

When user clicks/selects a vibe circle, show direction routes from **all people**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│      ╭───────╮                                                              │
│     ╱         ╲                                                             │
│    ╱   🔵 A    ╲                                                            │
│   │     ●───────╲──────────────────╮                                        │
│   │      ╲       │                  │  ← Route from A (20 min)              │
│   │       ╲      │     ╭──────╮     │                                       │
│    ╲       ██████████╱   🟢 B  ╲    │                                       │
│     ╲     ██ 🟠 ██──────────●  │    │  ← Route from B (18 min)              │
│      ╲    ██████╲        ╱                                                  │
│       ╰───╱──────╲──╰────╯                                                  │
│                                                                             │
│  Legend:                                                                    │
│  🔵 Person A (Gràcia)          ━━━ Route from A                            │
│  🟢 Person B (Poblenou)        ━━━ Route from B                            │
│  🟠 Selected area (El Born)                                                 │
│                                                                             │
│  Both routes shown simultaneously when area is selected                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Info Card UI: Selected Vibe Circle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🟠 EL BORN                                        [📤 Get Directions]      │
│  "Historic streets meets hipster food scene"                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🚇 HOW TO GET THERE (routes shown on map)                                  │
│                                                                             │
│  🔵 From Gràcia (Alex):      20 min                                        │
│  🟢 From Poblenou (Sam):     18 min                                        │
│                                                                             │
│  [Toggle: 🚶 Walk | 🚇 Transit | 🚗 Drive]                                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WHY THIS AREA                                                              │
│  Walkable medieval streets packed with tapas bars, cafes, and the          │
│  Picasso Museum. Some of Barcelona's best street art is hidden around      │
│  the Santa Caterina market area.                                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🗺️ THINGS TO DO HERE                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🍽️ Tapas crawl                                                      │   │
│  │ "best tapas bars El Born Barcelona"                                 │   │
│  │ [📍 GMaps Search] [🎵 TikTok Search]                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎨 Street art walk                                                  │   │
│  │ "street art El Born Barcelona"                                      │   │
│  │ [📍 GMaps Search] [🎵 TikTok Search]                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🍷 Vermouth hour                                                    │   │
│  │ "vermouth bars El Born"                                             │   │
│  │ [📍 GMaps Search] [🎵 TikTok Search]                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│      [←]  1 / 3 areas  [→]                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### "Get Directions" Popup

```
┌────────────────────────────────────────┐
│  📤 Get Directions to El Born          │
│                                        │
│  Who's navigating?                     │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🔵 From Gràcia (Alex)          │   │
│  │    20 min by transit           │   │
│  │    → Opens Google Maps         │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🟢 From Poblenou (Sam)         │   │
│  │    18 min by transit           │   │
│  │    → Opens Google Maps         │   │
│  └────────────────────────────────┘   │
│                                        │
│  💡 Pick your transport in Google Maps │
│                                        │
└────────────────────────────────────────┘
```

**Google Maps URL generation** (no API needed):

```javascript
// Generate URL to area center
const getDirectionsUrl = (startLat, startLng, destLat, destLng) => {
  return `https://www.google.com/maps/dir/${startLat},${startLng}/${destLat},${destLng}`;
};

// User picks walk/transit/drive in Google Maps itself
```

### Transport Mode Toggle

When user toggles between Walk/Transit/Drive:

1. **Recalculate directions** using Mapbox Directions API with new profile
2. **Update route lines** on map
3. **Update travel times** in card

```javascript
// Mapbox Directions profiles
const profiles = {
  walk: 'mapbox/walking',
  transit: 'mapbox/driving', // Note: Mapbox doesn't have transit, use driving as proxy
  drive: 'mapbox/driving'
};

// For actual transit times, we already have them from isochrones
// Just display the pre-calculated isochrone-based time
```

**Note**: Mapbox Directions doesn't support transit routing. Options:
1. Use driving as proxy for transit display
2. Show transit time from isochrone data (already calculated)
3. Use a transit API (adds cost)

**Recommended**: Show the **isochrone-calculated transit time** in the card, but use **driving profile** for the route line (close enough for visual).

### Cost Breakdown: Areas to Explore Together

| Step | Service | Cost |
|------|---------|------|
| 1. Gather locations | Chat | FREE |
| 2. Geocode | Mapbox | FREE |
| 3. Isochrones (2 people × 3 modes) | Geoapify × 6 | $0.0294 |
| 4. Intersection matrix (9 combos) | Turf.js | FREE |
| 5. Present options | - | FREE |
| 6. Generate vibe areas | Gemini + Grounding | ~$0.025 |
| 7. Directions (2 people × 3 areas) | Mapbox × 6 | $0.012 |
| 8. Display map | Mapbox Maps GL | $0.005 |
| **TOTAL (2 people)** | | **~$0.07** |

### For 3 People

| Step | Service | Cost |
|------|---------|------|
| Isochrones (3 people × 3 modes) | Geoapify × 9 | $0.0441 |
| Intersections (27 combos) | Turf.js | FREE |
| Directions (3 people × 3 areas) | Mapbox × 9 | $0.018 |
| Rest | Same | ~$0.03 |
| **TOTAL (3 people)** | | **~$0.09** |

### Heavy User Cost: 10 Searches/Day × 30 Days

| Component | Monthly Usage | Cost |
|-----------|---------------|------|
| Geoapify (isochrones) | 1,800 calls | $8.82 |
| Gemini + Grounding | 300 calls | $7.50 |
| Mapbox Directions | 1,800 calls | $3.60 |
| Mapbox Maps GL | 300 loads | $1.50 |
| **TOTAL** | | **~$21/month** |

### When to Use Which "Meet" Mode

| User Says | Mode | Cost | Output |
|-----------|------|------|--------|
| "Where should we hang out?" | **Areas to Explore** | $0.07 | Neighborhoods + ideas |
| "Find us a good cocktail bar" | Meet in the Middle | $0.055 | Specific venue |
| "Plan a date night" | **Adaptive Hybrid** | $0.23 | Mix of specific + areas |
| "Plan every stop precisely" | Multi-Stop Journey | $0.38 | All specific venues + route |

---

## Adaptive Hybrid Route

> **Cost**: ~$0.23 per search (2 specific places + 2 areas)  
> **Use case**: "Date night in Madrid", "Evening out in Barcelona", "Things to do tonight"

The **most sophisticated planning mode** — intelligently mixes specific places (for anchor moments) with exploratory areas (for spontaneous discovery) based on:

1. **City character** — Is it a "plan ahead" or "wing it" city?
2. **User preference** — Do they like specific plans or flexibility?
3. **Occasion type** — Special date vs casual exploration

### Why Hybrid?

| Full Specific Route | Full Area Route | **Hybrid Approach** |
|---------------------|-----------------|---------------------|
| ~$0.38 | ~$0.10 | **~$0.23** |
| Great for precision | Great for exploration | **Best of both** |
| Can feel rigid | Can feel aimless | **Structured flexibility** |
| Every stop researched | No deep research | **Key anchors + exploration** |

### The Key Insight

Not every stop needs the same level of specificity:

| Stop Type | When to Use | What They Get |
|-----------|-------------|---------------|
| **📍 Specific Place** | Anchor moments, reservations needed, unique experience | Name, why, insider tips, GMaps link |
| **🗺️ Area + Suggestions** | Exploration phases, cluster neighborhoods, wing-it vibes | Area name, why, 1-3 place suggestions, 1-3 search ideas |

### City Character Assessment

Some cities are "plan everything" cities, others are "go and wing it" cities:

| City | Planning Score | Specificity Bias | Why |
|------|---------------|------------------|-----|
| **London** | 8/10 | High (70-80% specific) | Spread out, reservations matter, less walkable clusters |
| **Tokyo** | 9/10 | Very High (90%) | Need specific addresses, easy to get lost |
| **Central Madrid** | 4/10 | Low (30-40% specific) | Dense clusters, walk-in culture, wing-it vibes |
| **Barcelona El Born** | 5/10 | Medium (50%) | Walkable clusters but some standout places |
| **Mexico City Roma** | 3/10 | Low (30%) | Every corner has something, exploration is the point |

### User Preference Discovery

Conversationally determine their style:

```
"Quick question — when exploring a new area, do you prefer:

 🎯 Having everything planned out (I'll tell you exactly where to go)
 
 🗺️ A mix of must-hits and areas to explore on your own
 
 🌊 Just point me to the right neighborhoods and I'll figure it out"
```

### Occasion-Based Bias

| Occasion | Specificity Bias | Reasoning |
|----------|------------------|-----------|
| **Special date night** | High (+20%) | "This needs to be perfect" |
| **Friends visiting** | Medium | Some highlights + exploration |
| **Solo exploration** | Low (-20%) | Areas with ideas |
| **Business dinner** | Very High (+40%) | No room for error |
| **Pub crawl** | Medium | Anchor bars + wing-it between |

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: UNDERSTAND QUERY                                                   │
│  Gemini 2.5 Flash = ~$0.002                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: "Plan a date night in Madrid for me and my girlfriend.              │
│         We like wine, tapas, maybe some live music"                         │
│                                                                             │
│  Extract:                                                                   │
│  • City: Madrid                                                             │
│  • Occasion: Date night (medium-high stakes)                               │
│  • Activities: Wine, tapas, live music                                      │
│  • People: 2                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: ASSESS CITY CHARACTER                                              │
│  Gemini + Google Search Grounding = ~$0.025                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Prompt: "What's the planning culture for a night out in central Madrid?   │
│           Is it more 'book ahead and plan' or 'go to an area and wing it'? │
│           Rate on scale: 1 (total wing-it) to 10 (everything planned)"     │
│                                                                             │
│  Response:                                                                  │
│  {                                                                          │
│    "planningScore": 4,                                                      │
│    "reasoning": "Madrid nightlife is famously spontaneous. Locals rarely   │
│                  book for tapas — you hop between bars. La Latina,         │
│                  Malasaña, Chueca are cluster neighborhoods where the      │
│                  vibe is to walk and discover. Exception: upscale          │
│                  restaurants do need reservations.",                        │
│    "clusterNeighborhoods": ["La Latina", "Malasaña", "Chueca", "Lavapiés"],│
│    "reservationNeeded": ["Fine dining only"]                               │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: DISCOVER USER PREFERENCE                                           │
│  No API cost (conversation)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI: "Madrid is a 'walk and discover' kind of city — locals rarely book   │
│       for tapas, they just hop between bars in neighborhoods like          │
│       La Latina or Malasaña.                                               │
│                                                                             │
│       For your date night, would you prefer:                               │
│                                                                             │
│       🎯 Specific places for each stop (I'll find the best spots)          │
│       🗺️ A mix — key highlights + neighborhoods to explore together       │
│       🌊 Just the right areas and you'll figure it out from there"        │
│                                                                             │
│  User: "The mix sounds good — some anchors but we like discovering"        │
│                                                                             │
│  → DECISION: 50% specific, 50% areas                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: PLAN ROUTE STRUCTURE                                               │
│  Gemini Flash = ~$0.002                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Based on:                                                                  │
│  • City score: 4/10 (wing-it culture)                                      │
│  • User preference: Mix                                                     │
│  • Occasion: Date (slightly higher stakes)                                  │
│                                                                             │
│  Route structure:                                                           │
│  1. SPECIFIC - Opening dinner (important to nail)                          │
│  2. AREA - Post-dinner wine bars (exploration phase)                       │
│  3. SPECIFIC - Late-night highlight (end on a high)                        │
│  4. AREA - Live music district (if night continues)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5a: RESEARCH SPECIFIC STOPS                                           │
│  ScrapingDog + Gemini Flash Lite = ~$0.15 (for 2 specific places)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For Stop 1 (Dinner) and Stop 3 (Late-night):                              │
│  • ScrapingDog Google search (5 results each)                              │
│  • Scrape top 3 articles                                                   │
│  • ScrapingDog Google Maps (place details)                                 │
│  • ScrapingDog Reviews (50-100 reviews)                                    │
│  • Gemini Flash Lite: Analyze and extract insights                         │
│                                                                             │
│  Output per place:                                                          │
│  • Name, why it's perfect for their date                                   │
│  • Insider tips from real reviews                                          │
│  • Best time to go, what to order                                          │
│  • Red flags to watch for                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5b: GENERATE AREA SUGGESTIONS                                         │
│  Gemini + Google Search Grounding = ~$0.03 (for 2 areas)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For Stop 2 (Wine bars) and Stop 4 (Live music):                           │
│  • Which neighborhood to go to                                              │
│  • Why this area is perfect                                                │
│  • 1-3 specific place suggestions (names only)                             │
│  • 1-3 search ideas for exploring                                          │
│                                                                             │
│  Output per area:                                                           │
│  {                                                                          │
│    "area": "Calle Cava Baja",                                              │
│    "why": "Madrid's most legendary tapas street - two parallel streets     │
│            packed with wine bars",                                          │
│    "suggestedPlaces": [                                                    │
│      { "name": "Taberna La Concha", "oneLiner": "Tiny wine cave" },        │
│      { "name": "El Tempranillo", "oneLiner": "Local favorite" }            │
│    ],                                                                       │
│    "searchIdeas": [                                                        │
│      "vermouth bars Cava Baja",                                            │
│      "natural wine La Latina"                                              │
│    ]                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: GENERATE GMAPS LINKS (FREE!)                                       │
│  No API cost - URL construction hack                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Instead of calling Google Maps API:                                        │
│                                                                             │
│  const getGMapsSearchUrl = (place, city) =>                                │
│    `https://www.google.com/maps/search/${encodeURIComponent(place + city)}`│
│                                                                             │
│  Examples:                                                                  │
│  • "Casa Lucio Madrid" → Google finds it immediately                       │
│  • "Taberna La Concha Cava Baja" → Works perfectly                         │
│  • "Salmon Guru Madrid" → Unique enough to work                            │
│                                                                             │
│  Cost saved: $0.001 × ~10 places = $0.01 per search                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: WALKING ROUTE                                                      │
│  Mapbox Directions = ~$0.008 (4 waypoints)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Get walking directions between all stops for time estimates                │
│  (Not full Matrix since we already know the order)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: DISPLAY ROUTE                                                      │
│  Mapbox Maps GL = $0.005                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Output: Hybrid Route

```
YOUR MADRID DATE NIGHT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────────────┐
│  STOP 1 — DINNER                                               📍 SPECIFIC │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🍽️ Casa Lucio                                                              │
│  "Iconic Madrid tavern, famous for huevos rotos"                           │
│                                                                             │
│  WHY: "The perfect romantic start — old-school Madrid atmosphere,          │
│        intimate tables, and their signature broken eggs with jamón         │
│        is legendary. Locals have been coming here for 50 years."           │
│                                                                             │
│  💡 TIP: "Ask for a table in the back room — more intimate"                │
│  ⏰ Best time: 9:00-9:30pm (prime Madrid dinner time)                       │
│                                                                             │
│  [📍 Open in Google Maps]                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

          │ 8 min walk through La Latina
          ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│  STOP 2 — POST-DINNER DRINKS                                    🗺️ AREA    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🍷 Calle Cava Baja & Calle Cava Alta                                       │
│  "Madrid's most legendary tapas street"                                    │
│                                                                             │
│  WHY: "This is the heart of La Latina nightlife — two parallel streets     │
│        packed with wine bars and tabernas. Very 'Madrid' to walk in        │
│        anywhere that looks good."                                           │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🎯 SUGGESTED SPOTS (if you want direction)                                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ 🍷 Taberna La Concha                              [📍 GMaps →]     │    │
│  │    "Tiny wine cave, incredible selection by the glass"             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ 🍷 El Tempranillo                                 [📍 GMaps →]     │    │
│  │    "Local favorite for Spanish wines + croquetas"                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  🔍 OR EXPLORE                                                              │
│  [vermouth bars Cava Baja]  [natural wine La Latina]                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

          │ 12 min walk or quick taxi
          ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│  STOP 3 — NIGHTCAP                                             📍 SPECIFIC │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🍸 Salmon Guru                                                             │
│  "One of the world's best cocktail bars"                                   │
│                                                                             │
│  WHY: "End on a high — this place is on the World's 50 Best Bars list.    │
│        The cocktails are theatrical, the design is wild, and it's the     │
│        kind of place you'll remember."                                      │
│                                                                             │
│  💡 TIP: "Order 'Chipotle Chilango' if you like spice"                     │
│  ⚠️ HEADS UP: "Gets crowded after midnight — aim for 11:30pm"              │
│                                                                             │
│  [📍 Open in Google Maps]                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

          │ If the night continues...
          ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│  STOP 4 — LIVE MUSIC (Optional)                                 🗺️ AREA    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🎵 Malasaña                                                                │
│  "Madrid's indie music neighborhood"                                       │
│                                                                             │
│  WHY: "If you want to keep the night going, Malasaña is where Madrid's    │
│        live music scene lives. Walk around Plaza del Dos de Mayo and      │
│        follow your ears."                                                   │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🎯 IF YOU WANT SOMETHING SPECIFIC                                          │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ 🎵 Café Central                                   [📍 GMaps →]     │    │
│  │    "Best jazz club in Madrid — intimate basement venue"            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  🔍 OR EXPLORE                                                              │
│  [live music tonight Malasaña]  [jazz bars Madrid]  [flamenco tablaos]    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Area Card Variants

Depending on what's needed for each area:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VARIANT A: 1 place + 1 search (minimal)                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  🍷 La Latina                                                               │
│                                                                             │
│  🎯 Try: El Tempranillo [📍→]                                               │
│  🔍 Or search: "wine bars La Latina"                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  VARIANT B: 3 places + 2 searches (rich)                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  🍷 Calle Cava Baja                                                         │
│                                                                             │
│  🎯 SUGGESTED SPOTS                                                         │
│  • Taberna La Concha [📍→] — "Tiny wine cave"                              │
│  • El Tempranillo [📍→] — "Local favorite"                                 │
│  • Casa Lucas [📍→] — "Modern Spanish wines"                               │
│                                                                             │
│  🔍 OR EXPLORE                                                              │
│  [vermouth bars Cava Baja]  [natural wine La Latina]                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  VARIANT C: 2 places + 3 searches (exploration-heavy)                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  🎵 Malasaña                                                                │
│                                                                             │
│  🎯 START WITH                                                              │
│  • Café Central [📍→] — "Best jazz club"                                   │
│  • Tupperware [📍→] — "80s dive bar vibes"                                 │
│                                                                             │
│  🔍 THEN EXPLORE                                                            │
│  [live music tonight Malasaña]                                             │
│  [jazz bars Madrid]                                                         │
│  [flamenco tablaos near Malasaña]                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision Logic: When to Make a Stop Specific vs Area

```typescript
interface StopDecision {
  type: 'specific' | 'area';
  reasoning: string;
}

const decideStopType = (
  stopPurpose: string,
  cityScore: number,      // 1-10 (1=wing-it, 10=plan)
  userPreference: number, // 1-10
  occasionBoost: number   // -40 to +40
): StopDecision => {
  
  // Base score from city + user preference
  let specificScore = (cityScore + userPreference) / 2 + occasionBoost;
  
  // Purpose-based adjustments
  const purposeBoosts = {
    'opening_dinner': +20,      // First impression matters
    'closing_highlight': +15,   // End on a high
    'mid_exploration': -20,     // This is where you wing it
    'optional_extension': -10,  // Low stakes
    'fine_dining': +30,         // Reservations needed
    'bar_hopping': -15,         // Discovery is the point
    'unique_experience': +25,   // Don't miss this
  };
  
  specificScore += purposeBoosts[stopPurpose] || 0;
  
  // Decision threshold
  if (specificScore > 50) {
    return { type: 'specific', reasoning: 'High stakes / unique / needs reservation' };
  } else {
    return { type: 'area', reasoning: 'Good for exploration / cluster neighborhood' };
  }
};
```

### Cost Breakdown: Adaptive Hybrid Route

| Step | Service | Cost |
|------|---------|------|
| 1. Understand query | Gemini 2.5 Flash | ~$0.002 |
| 2. Assess city character | Gemini + Grounding | ~$0.025 |
| 3. User preference | Chat | FREE |
| 4. Plan route structure | Gemini Flash | ~$0.002 |
| 5a. Research 2 specific places | ScrapingDog + Flash Lite | ~$0.15 |
| 5b. Generate 2 area suggestions | Gemini + Grounding | ~$0.03 |
| 6. GMaps links | URL construction | **FREE** |
| 7. Walking route | Mapbox Directions | ~$0.008 |
| 8. Display | Mapbox Maps GL | $0.005 |
| **TOTAL** | | **~$0.23** |

### Cost Variants

| Route Mix | Specific Places | Areas | Total Cost |
|-----------|-----------------|-------|------------|
| High specificity (80/20) | 4 | 1 | ~$0.35 |
| **Balanced (50/50)** | 2 | 2 | **~$0.23** |
| High flexibility (20/80) | 1 | 4 | ~$0.12 |
| All areas | 0 | 4 | ~$0.07 |
| All specific | 4 | 0 | ~$0.38 |

### Heavy User Cost: 10 Searches/Day × 30 Days

| Component | Monthly Usage | Cost |
|-----------|---------------|------|
| Gemini Flash (query + structure) | 600 calls | $1.20 |
| Gemini + Grounding (city + areas) | 900 calls | $22.50 |
| ScrapingDog (specific places) | ~4,000 calls | $4.00 |
| Gemini Flash Lite (curation) | ~6M tokens | $0.80 |
| Mapbox Directions | 300 calls | $0.60 |
| Mapbox Maps GL | 300 loads | $1.50 |
| **TOTAL** | | **~$31/month** |

### Implementation Notes

#### GMaps Link Hack

```typescript
// FREE - no API calls needed
const getGMapsSearchUrl = (placeName: string, city: string): string => {
  const query = encodeURIComponent(`${placeName} ${city}`);
  return `https://www.google.com/maps/search/${query}`;
};

// Works for:
// - Well-known places: "Casa Lucio Madrid"
// - Unique names: "Salmon Guru Madrid"
// - Places with context: "Taberna La Concha Cava Baja Madrid"
```

#### TikTok/GMaps Search Chips

```typescript
// Generate search URLs for exploration
const getSearchUrls = (query: string) => ({
  gmaps: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
  tiktok: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
});

// Example:
// "vermouth bars Cava Baja" → 
// - GMaps: shows nearby bars
// - TikTok: shows what people are saying
```

#### City Character Cache

```typescript
// Pre-cache common cities to avoid API call
const CITY_PLANNING_SCORES: Record<string, CityCharacter> = {
  'london': { score: 8, bias: 'specific', reason: 'Spread out, reservations matter' },
  'tokyo': { score: 9, bias: 'specific', reason: 'Need exact addresses' },
  'madrid': { score: 4, bias: 'area', reason: 'Wing-it culture, dense clusters' },
  'barcelona': { score: 5, bias: 'mixed', reason: 'Walkable but has standouts' },
  'mexico-city-roma': { score: 3, bias: 'area', reason: 'Discovery is the point' },
  'new-york': { score: 7, bias: 'specific', reason: 'Neighborhoods distinct, must-hits exist' },
  'paris': { score: 6, bias: 'mixed', reason: 'Neighborhoods walkable but restaurants book up' },
};
```

---

## Multi-Stop Journey Planning

> **Cost**: ~$0.38 per search (includes $0.005 Mapbox map load)  
> **Use case**: "Romantic date night", "pub crawl in Soho", "food tour El Born"

When someone wants to plan a **route between multiple places**, you need the Mapbox Matrix API for accurate walking times.

**See full documentation below.**

---

## Overview

This architecture uses **web scraping + AI curation** to find the best specific places for a user's journey. Unlike Google Maps Grounding (which returns Google's algorithmic picks), this approach:

1. **Searches the real web** for authentic recommendations (TimeOut, Eater, food bloggers, Reddit)
2. **Cross-references with Google Maps** for verified coordinates and opening hours
3. **Analyzes hundreds of reviews** to understand atmosphere, service quality, and red flags
4. **Curates with context** - the AI knows WHY each place was recommended

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         USER QUERY                                          │
│            "Plan a romantic date night in El Born, 8pm-1am"                │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DISCOVERY                                                         │
│  ─────────────────                                                          │
│  ScrapingDog Google Search (10×) → 100 URLs                                │
│  ScrapingDog Web Scraper (12×)   → 40K words of recommendations            │
│  Gemini Flash Lite               → 25-35 extracted place names             │
│                                                                             │
│  Cost: $0.028                                                               │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: VERIFICATION                                                      │
│  ────────────────────                                                       │
│  ScrapingDog Maps API (25×)      → Coordinates, hours, ratings             │
│  Local filter                    → 15-20 places fitting time window        │
│  ScrapingDog Maps Reviews (15×)  → 300-500 real reviews                    │
│                                                                             │
│  Cost: $0.040                                                               │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: CURATION                                                          │
│  ────────────────                                                           │
│  Gemini Flash Lite               → Score places on user criteria           │
│                                  → Select top 10 with reasoning            │
│                                  → Extract insider tips from reviews       │
│                                                                             │
│  Cost: $0.015                                                               │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: ROUTE PLANNING                                                    │
│  ──────────────────────                                                     │
│  Mapbox Matrix (12×12)           → Walking times between all places        │
│  Gemini Flash Lite               → Build 3 route options with timing       │
│                                                                             │
│  Cost: $0.292                                                               │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUT                                         │
│  ────────────────────────────────────────────────────────────────────────  │
│  3 curated route options, each with:                                        │
│  • Specific places with coordinates                                         │
│  • Why each place is perfect for THIS trip                                 │
│  • Suggested arrival times                                                  │
│  • What to order (from reviews)                                            │
│  • Insider tips                                                             │
│  • "Get Directions" export to Google Maps                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## When to Use This Approach

### ✅ Perfect For

| Use Case | Example Query |
|----------|---------------|
| **Date nights** | "Romantic dinner and drinks in Gracia, Friday 8pm" |
| **Pub crawls** | "Best craft beer bars in Poble Sec, walking distance" |
| **Food tours** | "Authentic tapas crawl in El Born, avoid tourist traps" |
| **Special occasions** | "Anniversary dinner with wine pairing, €100 budget" |
| **Themed nights** | "Jazz bars with good cocktails, late night" |
| **Business dining** | "Impressive restaurant for client dinner near Diagonal" |

### ❌ Use Road Trip Architecture Instead

| Use Case | Why Different |
|----------|---------------|
| Scenic drives | Areas, not specific places |
| Multi-city trips | Too large for walking matrix |
| "Things to do" exploration | Vibe areas, not venues |

---

## Complete Process Flow

### Step 1: Smart Web Searches
**Service**: ScrapingDog Google Search  
**Cost**: 10 searches × $0.001 = **$0.010**

Generate 10 targeted searches based on user query:

```javascript
const generateSearchQueries = (userQuery, location, purpose) => {
  // Example for "romantic date night in El Born"
  return [
    `best romantic restaurants ${location}`,
    `${location} date night dinner locals recommend`,
    `hidden gem restaurants ${location} 2024`,
    `romantic cocktail bars ${location}`,
    `${location} tapas bars late night`,
    `${location} food blogger favorites`,
    `where to eat ${location} reddit`,
    `${location} wine bars romantic atmosphere`,
    `best restaurants near ${nearbyLandmark}`,
    `${location} dinner drinks itinerary`
  ];
};
```

**Output**: ~100 URLs (TimeOut, Eater, blogs, Reddit, TripAdvisor articles)

---

### Step 2: Fetch Top Articles
**Service**: ScrapingDog Web Scraper  
**Cost**: 12 pages × $0.001 = **$0.012**

Deduplicate URLs and select 12 most authoritative:

```javascript
const prioritizeUrls = (urls) => {
  const tiers = {
    tier1: ['timeout.com', 'eater.com', 'thrillist.com', 'condanast'],
    tier2: ['tripadvisor.com', 'yelp.com', 'theinfatuation.com'],
    tier3: ['reddit.com', 'medium.com', 'blogspot', 'wordpress']
  };
  
  // Prioritize professional reviews, include local voices
  return selectDiverse(urls, {
    professional: 6,  // TimeOut, Eater, etc.
    userGenerated: 4, // Reddit, TripAdvisor
    blogs: 2          // Food bloggers
  });
};
```

**Output**: ~40,000 words of recommendations and reviews

---

### Step 3: Extract Place Names
**Service**: Gemini 2.5 Flash Lite  
**Cost**: ~45K tokens × ~$0.13/1M = **$0.006**

```javascript
const extractionPrompt = `
Extract every restaurant, bar, and cafe mentioned in these articles.

For each place, capture:
- Exact name (as written)
- Address if mentioned
- Why it was recommended (quote key phrases)
- Atmosphere descriptions
- Price indicators
- Which source(s) mentioned it

Return as JSON array:
[
  {
    "name": "Cal Pep",
    "address": "Plaça de les Olles 8",
    "recommendations": [
      { "source": "TimeOut", "quote": "legendary tapas counter" },
      { "source": "Eater", "quote": "worth the wait" }
    ],
    "atmosphere": "bustling, counter seating, theatrical",
    "priceHint": "€€€"
  }
]
`;
```

**Output**: 25-35 unique places with context from web sources

---

### Step 4: Get Structured Place Data
**Service**: ScrapingDog Google Maps API  
**Cost**: 25 places × $0.001 = **$0.025**

For each extracted place, search Google Maps to get verified data:

```javascript
const getPlaceData = async (placeName, address, city) => {
  const searchQuery = `${placeName} ${address} ${city}`;
  const response = await scrapingdog.googleMaps(searchQuery);
  
  return {
    place_id: response.place_id,
    name: response.name,
    coordinates: {
      lat: response.geometry.location.lat,
      lng: response.geometry.location.lng
    },
    rating: response.rating,
    total_reviews: response.user_ratings_total,
    price_level: response.price_level, // 1-4
    opening_hours: response.opening_hours,
    types: response.types,
    formatted_address: response.formatted_address
  };
};
```

**Output**: 25 places with verified coordinates, hours, and ratings

---

### Step 5: Filter by Time Constraints
**Service**: Local logic (no API cost)  
**Cost**: **$0.000**

```javascript
const filterByTime = (places, userConstraints) => {
  const { startTime, endTime, dayOfWeek } = userConstraints;
  // startTime: "20:00", endTime: "01:00", dayOfWeek: "friday"
  
  return places.filter(place => {
    const hours = place.opening_hours[dayOfWeek];
    if (hours === 'closed') return false;
    
    // Parse hours and check overlap with user's time window
    const { opens, closes } = parseHours(hours);
    return hasOverlap(opens, closes, startTime, endTime);
  });
};
```

**Output**: ~15-20 places that fit the time window

---

### Step 6: Get Reviews for Top Candidates
**Service**: ScrapingDog Google Maps Reviews  
**Cost**: 15 places × $0.001 = **$0.015**

```javascript
const getReviews = async (placeId) => {
  const response = await scrapingdog.googleMapsReviews(placeId);
  
  return {
    place_id: placeId,
    reviews: response.reviews.map(r => ({
      rating: r.rating,
      text: r.text,
      date: r.time,
      language: r.language
    }))
  };
};
```

**Output**: 300-500 real reviews to analyze (~20-35 per place)

---

### Step 7: Curate with AI
**Service**: Gemini 2.5 Flash Lite  
**Cost**: ~112K tokens × ~$0.13/1M = **$0.015**

```javascript
const curationPrompt = `
You are curating places for: "${userQuery}"
Time window: ${startTime} to ${endTime}
Day: ${dayOfWeek}

## Places with Reviews
${JSON.stringify(placesWithReviews, null, 2)}

## Original Web Recommendations
${JSON.stringify(webContext, null, 2)}

## Your Task

Analyze each place considering:
1. **Atmosphere fit** - Does it match "${purpose}"? Look for keywords in reviews.
2. **Service quality** - Focus on RECENT reviews (last 6 months)
3. **Noise level** - Important for conversation on dates
4. **Timing fit** - Will it work for their schedule?
5. **Red flags** - Declining quality, rude staff, recent closures

## Output Requirements

Select the TOP 10 places for this specific trip:
- 4 options for the main activity (dinner for date, first bar for crawl)
- 4 options for secondary activity (drinks after, next bars)
- 2 backup options

For each selected place, provide:
{
  "place_id": "...",
  "name": "...",
  "coordinates": {...},
  "category": "dinner" | "drinks" | "backup",
  "whyPerfect": "2-3 sentences on why this place specifically",
  "bestArrivalTime": "8:30pm",
  "suggestedDuration": "2 hours",
  "whatToOrder": ["dish/drink from reviews"],
  "reservationNeeded": true/false,
  "insiderTips": ["from reviews"],
  "redFlags": ["any concerns"] | null
}
`;
```

**Output**: 10 deeply curated places with context

---

### Step 8: Build Walking Time Matrix
**Service**: Mapbox Matrix API  
**Cost**: 12×12 = 144 elements × $0.002 = **$0.288**

```javascript
const buildWalkingMatrix = async (places, startPoint, endPoint) => {
  const coordinates = [
    startPoint,
    ...places.map(p => p.coordinates),
    endPoint
  ];
  
  const response = await mapbox.matrix({
    profile: 'walking',
    coordinates: coordinates.map(c => [c.lng, c.lat]),
    annotations: ['duration', 'distance']
  });
  
  // Returns NxN matrix of walking times in seconds
  return response.durations;
};
```

**Output**: Complete walking time matrix between all locations

---

### Step 9: Plan Routes
**Service**: Gemini 2.5 Flash Lite  
**Cost**: ~8K tokens × ~$0.13/1M = **$0.004**

```javascript
const routePlanningPrompt = `
## Curated Places
${JSON.stringify(curatedPlaces, null, 2)}

## Walking Time Matrix (minutes)
${formatMatrix(walkingMatrix)}

## User Constraints
- Start: ${startTime} at ${startLocation}
- End: by ${endTime}
- Purpose: ${purpose}

## Create 3 Route Options

Each route should:
1. Start at the start location
2. Visit 2-4 places that flow naturally
3. End by the specified time
4. Account for walking time between stops
5. Allow appropriate time at each stop

Format each route as:
{
  "name": "Route Theme Name",
  "description": "One line description",
  "stops": [
    {
      "place": {...},
      "arriveAt": "8:00pm",
      "departAt": "10:30pm",
      "walkToNext": "8 minutes"
    }
  ],
  "totalWalkingTime": "19 minutes",
  "highlights": ["what makes this route special"]
}
`;
```

**Output**: 3 complete route options with timing

---

## Example: Romantic Date Night

### User Query
> "Plan a romantic date night in El Born, Barcelona. We want dinner and drinks, starting around 8pm, ending by 1am. Looking for authentic local spots, not tourist traps."

### Step-by-Step Execution

#### Step 1: Web Searches ($0.010)

```
Searches performed:
1. "best romantic restaurants El Born Barcelona"
2. "El Born date night dinner locals recommend"
3. "hidden gem restaurants El Born 2024"
4. "romantic cocktail bars El Born Barcelona"
5. "El Born tapas bars late night"
6. "Barcelona food blogger El Born favorites"
7. "where to eat El Born reddit"
8. "El Born wine bars romantic atmosphere"
9. "best restaurants near Santa Maria del Mar"
10. "El Born dinner drinks itinerary"

Results: 100 URLs from TimeOut, Eater, TripAdvisor, Reddit, food blogs
```

#### Step 2: Fetch Articles ($0.012)

```
Selected 12 articles:
1. TimeOut: "Best restaurants in El Born"
2. Eater Barcelona: "Where to Eat in El Born Right Now"
3. The Infatuation: "Barcelona Date Night Guide"
4. Reddit r/Barcelona: "Romantic dinner recommendations?"
5. Barcelona Food Blog: "Our Favorite El Born Spots"
... (7 more)

Total content: 42,000 words
```

#### Step 3: Extract Places ($0.006)

```json
[
  {
    "name": "Cal Pep",
    "address": "Plaça de les Olles, 8",
    "recommendations": [
      {"source": "TimeOut", "quote": "legendary tapas counter, theatrical experience"},
      {"source": "Eater", "quote": "one of the best meals you'll have in Barcelona"}
    ],
    "atmosphere": "bustling counter, open kitchen, convivial",
    "priceHint": "€€€"
  },
  {
    "name": "El Xampanyet",
    "address": "Carrer de Montcada, 22",
    "recommendations": [
      {"source": "Reddit", "quote": "classic cava bar, feels like old Barcelona"},
      {"source": "Food Blog", "quote": "locals outnumber tourists 3 to 1"}
    ],
    "atmosphere": "traditional, tiled walls, standing room",
    "priceHint": "€"
  },
  {
    "name": "Paradiso",
    "address": "Carrer de Rera Palau, 4",
    "recommendations": [
      {"source": "TimeOut", "quote": "world's best bar hidden behind a pastrami shop"},
      {"source": "Thrillist", "quote": "speakeasy that lives up to the hype"}
    ],
    "atmosphere": "speakeasy, intimate, creative cocktails",
    "priceHint": "€€€"
  }
  // ... 28 more places
]
```

#### Step 4: Google Maps Data ($0.025)

```json
{
  "name": "Cal Pep",
  "place_id": "ChIJK6nqC6OipBIRR8K3X_HXBQQ",
  "coordinates": {"lat": 41.3842, "lng": 2.1821},
  "rating": 4.6,
  "total_reviews": 2847,
  "price_level": 3,
  "opening_hours": {
    "monday": "closed",
    "tuesday": "13:00–15:30, 19:30–23:30",
    "wednesday": "13:00–15:30, 19:30–23:30",
    "thursday": "13:00–15:30, 19:30–23:30",
    "friday": "13:00–15:30, 19:30–23:30",
    "saturday": "13:00–15:30, 19:30–23:30",
    "sunday": "13:00–15:30"
  },
  "types": ["restaurant", "bar", "food"]
}
```

#### Step 5: Time Filter ($0.000)

```
User wants: Friday 8pm - 1am

Filtered out:
❌ Cal Pep - closes at 11:30pm (too early for full evening)
❌ Restaurant X - closed Fridays
❌ Bar Y - opens at 11pm (too late for dinner part)

Remaining: 18 places fit the time window
```

#### Step 6: Get Reviews ($0.015)

```json
{
  "place_id": "ChIJ_zNzHKOipBIRgLCo2JQEtgM",
  "name": "Paradiso",
  "reviews": [
    {
      "rating": 5,
      "text": "Absolutely magical for our anniversary. The secret entrance through the fridge door sets the mood perfectly. Bartenders are true artists - ask for their recommendation based on what flavors you like. We stayed 3 hours and could have stayed longer. Book ahead or arrive before 8pm.",
      "date": "2024-11-15"
    },
    {
      "rating": 5,
      "text": "Perfect date spot. Intimate lighting, incredible cocktails, not too loud so you can actually talk. The Negroni variation was exceptional. Gets crowded after 10pm on weekends.",
      "date": "2024-10-28"
    },
    {
      "rating": 4,
      "text": "Amazing cocktails but €18-22 each. Worth it for a special occasion. The pastrami sandwiches in the front are actually really good too.",
      "date": "2024-10-15"
    }
    // ... 32 more reviews
  ]
}
```

#### Step 7: AI Curation ($0.015)

```json
{
  "selected_places": [
    {
      "place_id": "ChIJ...",
      "name": "Bar del Pla",
      "category": "dinner",
      "whyPerfect": "Intimate tapas spot where locals actually eat. Reviews consistently mention 'romantic atmosphere' and 'perfect for couples'. The small plates encourage sharing, which adds to the date vibe.",
      "bestArrivalTime": "8:15pm",
      "suggestedDuration": "2 hours",
      "whatToOrder": ["bomba (signature potato dish)", "grilled octopus", "local vermouth to start"],
      "reservationNeeded": true,
      "insiderTips": ["Ask for the back room - quieter", "The natural wines are excellent"],
      "redFlags": null
    },
    {
      "place_id": "ChIJ...",
      "name": "Paradiso",
      "category": "drinks",
      "whyPerfect": "World-famous speakeasy that actually delivers. The secret entrance (through a fridge in a pastrami shop) is memorable. Reviews from couples consistently mention it's 'perfect for dates'. Not too loud for conversation.",
      "bestArrivalTime": "10:30pm",
      "suggestedDuration": "2 hours",
      "whatToOrder": ["Ask bartender for recommendation", "Don't skip the entrance pastrami sandwich"],
      "reservationNeeded": true,
      "insiderTips": ["Book on their website 2-3 days ahead", "After 11pm gets crowded"],
      "redFlags": ["€18-22 per cocktail - expect €80-100 for the evening here"]
    }
    // ... 8 more places
  ]
}
```

#### Step 8: Walking Matrix ($0.288)

```
Walking times (minutes):

              Start  BarDelPla  Paradiso  ElXampanyet  DryMartini  End
Start           0        7         12          5           15       20
Bar del Pla     7        0          8          4           12       15
Paradiso       12        8          0          6            9       10
El Xampanyet    5        4          6          0           14       18
Dry Martini    15       12          9         14            0        8
End            20       15         10         18            8        0
```

#### Step 9: Route Planning ($0.004)

```json
{
  "routes": [
    {
      "name": "Classic Romance",
      "description": "Intimate dinner followed by world-class cocktails",
      "stops": [
        {
          "place": "Bar del Pla",
          "arriveAt": "8:15pm",
          "departAt": "10:15pm",
          "duration": "2 hours",
          "walkToNext": "8 min to Paradiso"
        },
        {
          "place": "Paradiso",
          "arriveAt": "10:25pm",
          "departAt": "12:30am",
          "duration": "2 hours",
          "walkToNext": "10 min to end point"
        }
      ],
      "totalWalkingTime": "25 minutes",
      "totalCost": "€120-150 for two",
      "highlights": [
        "Both places recommended specifically for dates",
        "Paradiso entrance is a memorable moment",
        "Ends comfortably before 1am"
      ]
    },
    {
      "name": "Wine & Tapas Trail",
      "description": "More stops, more variety, classic Barcelona evening",
      "stops": [
        {
          "place": "El Xampanyet",
          "arriveAt": "8:00pm",
          "departAt": "9:15pm",
          "duration": "1.25 hours",
          "walkToNext": "4 min to Bar del Pla"
        },
        {
          "place": "Bar del Pla",
          "arriveAt": "9:20pm",
          "departAt": "11:00pm",
          "duration": "1.5 hours",
          "walkToNext": "12 min to Dry Martini"
        },
        {
          "place": "Dry Martini",
          "arriveAt": "11:15pm",
          "departAt": "12:45am",
          "duration": "1.5 hours",
          "walkToNext": "8 min to end point"
        }
      ],
      "totalWalkingTime": "24 minutes",
      "totalCost": "€100-130 for two",
      "highlights": [
        "Experience 3 distinct Barcelona vibes",
        "Cava → Tapas → Classic cocktails progression",
        "El Xampanyet is a true local gem"
      ]
    },
    {
      "name": "Foodie Focus",
      "description": "Prioritize the meal with a nightcap finish",
      // ... similar structure
    }
  ]
}
```

---

## Cost Analysis

### Per Search Cost Breakdown (Multi-Stop Journey)

| Step | Service | Units | Rate | Cost |
|------|---------|-------|------|------|
| 1. Web searches | ScrapingDog Google | 10 | $0.001 | **$0.010** |
| 2. Fetch articles | ScrapingDog Web | 12 | $0.001 | **$0.012** |
| 3. Extract places | Gemini Flash Lite | ~45K tokens | ~$0.13/1M | **$0.006** |
| 4. Get place data | ScrapingDog Maps | 25 | $0.001 | **$0.025** |
| 5. Time filter | Local logic | - | - | **$0.000** |
| 6. Get reviews | ScrapingDog Maps Reviews | 15 | $0.001 | **$0.015** |
| 7. AI curation | Gemini Flash Lite | ~112K tokens | ~$0.13/1M | **$0.015** |
| 8. Walking matrix | Mapbox Matrix | 144 elements | $0.002 | **$0.288** |
| 9. Route planning | Gemini Flash Lite | ~8K tokens | ~$0.13/1M | **$0.004** |
| 10. Display map | Mapbox Maps GL | 1 load | $0.005 | **$0.005** |
| **TOTAL** | | | | **~$0.38** |

### Heavy User Scenario: 10 Searches/Day × 30 Days

| Component | Monthly Usage | Rate | Monthly Cost |
|-----------|---------------|------|--------------|
| ScrapingDog Google Search | 3,000 searches | $0.001 | **$3.00** |
| ScrapingDog Web Scraper | 3,600 pages | $0.001 | **$3.60** |
| ScrapingDog Maps API | 7,500 lookups | $0.001 | **$7.50** |
| ScrapingDog Maps Reviews | 4,500 places | $0.001 | **$4.50** |
| Gemini Flash Lite | ~50M tokens | varies | **$7.50** |
| Mapbox Matrix | 43,200 elements | $0.002 | **$86.40** |
| Mapbox Maps GL | 300 loads | $0.005 | **$1.50** |
| **TOTAL** | | | **~$114/month** |

### Cost Distribution

```
Mapbox Matrix:       $86.40  (76%)  ████████████████████████████░░
ScrapingDog (all):   $18.60  (16%)  █████░░░░░░░░░░░░░░░░░░░░░░░░░
Gemini Flash Lite:   $7.50   (7%)   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Mapbox Maps GL:      $1.50   (1%)   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
───────────────────────────────────────────────────────────────────
TOTAL:               ~$114/month
```

**Key Insight**: The Mapbox Matrix API dominates cost (76%). Optimizations should focus there.

### Cost Optimization Strategies

1. **Reduce matrix size**: Use 10 places instead of 12 → 100 elements vs 144 → 31% reduction
2. **Cache common routes**: Store popular place-to-place walking times
3. **Skip matrix for simple queries**: 2-stop routes don't need full matrix
4. **Use Mapbox free tier strategically**: 100K free requests/month

---

## Comparison with Alternatives

### Mode Comparison

| Mode | Use Case | Cost | Key API |
|------|----------|------|---------|
| **Single Place Search** | "Best pizza in Soho" | **$0.025-0.045** | ScrapingDog + Maps GL |
| **Meet in the Middle** | "Fair meeting spot, specific venue" | **~$0.055** | Geoapify + ScrapingDog + Maps GL |
| **Areas to Explore** | "Neighborhoods to hang out" | **~$0.07** | Geoapify + Gemini + Mapbox Directions |
| **Adaptive Hybrid** | "Date night in Madrid" | **~$0.23** | ScrapingDog + Gemini + Grounding |
| **Multi-Stop Journey** | "Plan every stop precisely" | **~$0.38** | Mapbox Matrix + Maps GL |

### vs. Other Approaches

| Approach | Cost/Search | Pros | Cons |
|----------|-------------|------|------|
| **Google AI Mode** | Free | Quick, easy | Algorithmic results, no review depth |
| **Google Maps Grounding** | $0.32 | Simple API | Limited to Google's picks, summary reviews only |
| **ScrapingDog (Single)** | $0.025-0.045 | Real web sources, full reviews | Slightly more complex |
| **ScrapingDog (Meet Middle)** | ~$0.055 | Fair zone + curated venues | Requires isochrones |
| **Areas to Explore** | ~$0.07 | Multi-mode transport + directions | No deep venue reviews |
| **Adaptive Hybrid** | ~$0.23 | Best of both: anchors + exploration | More complex logic |
| **ScrapingDog (Multi-Stop)** | ~$0.38 | Full reviews + accurate routing | Matrix API cost |
| **Manual research** | $0 + time | Most thorough | 30+ minutes per search |

### Data Quality Comparison

| Factor | Google AI Mode | Google Maps Grounding | ScrapingDog Approach |
|--------|----------------|----------------------|---------------------|
| **Source diversity** | Google's index | Just Google Maps | TimeOut, Eater, Reddit, blogs, Maps |
| **Review depth** | Snippets | Summary in text | 50-500 full reviews analyzed |
| **Authenticity signal** | SEO-driven | Algorithm-driven | "Locals recommend" from real sources |
| **Opening hours** | Sometimes | Maybe in text | Verified from Maps API |
| **Insider tips** | Generic | Generic | Extracted from actual reviews |
| **Red flag detection** | None | Limited | Analyze recent negative reviews |
| **Taste specificity** | Limited | Limited | Full control via search queries |
| **Fair meeting point** | ❌ | ❌ | ✅ Isochrone intersection |
| **Multi-mode transport** | ❌ | ❌ | ✅ Walk/Transit/Drive options |
| **City-aware planning** | ❌ | ❌ | ✅ Adapts to city character |
| **Structured flexibility** | ❌ | ❌ | ✅ Mix specific + areas |

### Heavy User Cost Comparison (10 searches/day × 30 days)

| Mode | Monthly Cost | Primary Factor |
|------|--------------|----------------|
| **Single Place Search** | ~$9.60/month | ScrapingDog + Gemini + Maps GL |
| **Meet in the Middle** | ~$13/month | Geoapify + ScrapingDog + Maps GL |
| **Areas to Explore** | ~$21/month | Geoapify + Directions + Maps GL |
| **Adaptive Hybrid** | ~$31/month | Grounding + ScrapingDog + Directions |
| **Multi-Stop Journey** | ~$114/month | Mapbox Matrix (76%) + Maps GL |
| Mixed (typical) | ~$25-50/month | Depends on query types |

---

## Implementation Notes

### ScrapingDog API Integration

```typescript
// src/lib/scrapingdog/client.ts

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;
const BASE_URL = 'https://api.scrapingdog.com';

export const scrapingdog = {
  // Google Search: $0.001 per search
  googleSearch: async (query: string, num: number = 10) => {
    const response = await fetch(
      `${BASE_URL}/google?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(query)}&results=${num}`
    );
    return response.json();
  },
  
  // Web Scraper: $0.001 per page
  scrapeUrl: async (url: string) => {
    const response = await fetch(
      `${BASE_URL}/scrape?api_key=${SCRAPINGDOG_API_KEY}&url=${encodeURIComponent(url)}`
    );
    return response.json();
  },
  
  // Google Maps Search: $0.001 per search
  googleMaps: async (query: string) => {
    const response = await fetch(
      `${BASE_URL}/google_maps?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(query)}`
    );
    return response.json();
  },
  
  // Google Maps Reviews: $0.001 per place
  googleMapsReviews: async (placeId: string) => {
    const response = await fetch(
      `${BASE_URL}/google_maps_reviews?api_key=${SCRAPINGDOG_API_KEY}&place_id=${placeId}`
    );
    return response.json();
  }
};
```

### Gemini Flash Lite Configuration

```typescript
// src/lib/gemini/flashLite.ts

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const callGeminiFlashLite = async (prompt: string, maxTokens: number = 8192) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7
        }
      })
    }
  );
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};
```

### Mapbox Matrix Integration

```typescript
// src/lib/mapbox/matrix.ts

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const getWalkingMatrix = async (coordinates: [number, number][]) => {
  // Format: [[lng, lat], [lng, lat], ...]
  const coordString = coordinates.map(c => c.join(',')).join(';');
  
  const response = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/walking/${coordString}?annotations=duration,distance&access_token=${MAPBOX_TOKEN}`
  );
  
  const data = await response.json();
  
  return {
    durations: data.durations, // seconds, NxN matrix
    distances: data.distances  // meters, NxN matrix
  };
};
```

---

## API Reference

### ScrapingDog Pricing

| API | Cost | Returns |
|-----|------|---------|
| Google Search | $0.001/search | 10 results with URLs, titles, snippets |
| Web Scraper | $0.001/page | Full page HTML/text content |
| Google Maps | $0.001/search | Place details, coordinates, hours, rating |
| Google Maps Reviews | $0.001/place | Array of reviews with text, rating, date |

### Gemini Flash Lite Pricing

| Metric | Cost |
|--------|------|
| Input tokens | $0.075 / 1M tokens |
| Output tokens | $0.30 / 1M tokens |

*Note: These are approximate rates. Check Google AI pricing for current rates.*

### Mapbox Pricing

| Service | Cost | Notes |
|---------|------|-------|
| Maps GL (map load) | $0.005/load | Per session/page load |
| Matrix (routing) | $0.002/element | Element = one cell in NxN matrix |
| Free tier | 100,000 elements/month | Matrix API |

*Example: 12×12 matrix = 144 elements = $0.288*

### Geoapify Pricing (for Meet in the Middle / Areas to Explore)

| API | Cost | Returns |
|-----|------|---------|
| Isochrone | $0.0049/call | Polygon of reachable area |
| Geometry (intersection) | $0.0049/call | Intersection of polygons |

**Meet in the Middle (single mode)**:
- 2 people: 2 isochrones + 1 intersection = $0.0147
- 3 people: 3 isochrones + 1 intersection = $0.0196

**Areas to Explore (multi-mode)**:
- 2 people × 3 modes = 6 isochrones = $0.0294
- Intersections computed locally with Turf.js (FREE)

---

## Document History

| Date | Change |
|------|--------|
| 2024-12-09 | Initial creation with multi-stop journey architecture |
| 2024-12-09 | Added Single Place Search mode |
| 2024-12-09 | Added Meet in the Middle mode (Geoapify isochrones) |
| 2024-12-09 | Added $0.005 Mapbox Maps GL load cost to all calculations |
| 2024-12-09 | Added Areas to Explore Together mode (multi-modal isochrones + directions) |
| 2024-12-09 | Added Adaptive Hybrid Route mode (city-aware specific/area mixing) |

---

## Related Documents

- [Vibe Maps Agent Architecture](./VIBE_MAPS_AGENT_ARCHITECTURE.md) - Unified agent system
- [Road Trip Feature](../../leo-vibe-extension/docs/ROAD_TRIP_FEATURE.md) - Area-based route planning
- [Vibe Maps Chat Plan](./VIBE_MAPS_CHAT_PLAN.md) - Chat UI design

---

## Quick Reference

### All Five Planning Modes

| Query Type | Cost | Example | Output |
|------------|------|---------|--------|
| **Single place** | $0.025-0.045 | "Best ramen Tokyo" | 1-3 curated venues |
| **Meet in the middle** | ~$0.055 | "Bar convenient for both of us" | Specific venue in fair zone |
| **Areas to explore** | ~$0.07 | "Where should we hang out?" | Neighborhoods + activity ideas |
| **Adaptive hybrid** | ~$0.23 | "Date night in Madrid" | Mix of specific + areas |
| **Multi-stop journey** | ~$0.38 | "Date night El Born 8pm-1am" | All specific venues + route |

*All costs include $0.005 Mapbox Maps GL load*

### Mode Selection Guide

```
User query → Which mode?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Best X in Y"                              → Single Place (~$0.035)
"Find us a good X"                         → Meet in Middle (~$0.055)
"Where should we meet/hang out?"           → Areas to Explore (~$0.07)
"Plan a date/evening/night out"            → Adaptive Hybrid (~$0.23)
"Plan everything precisely"                → Multi-Stop Journey (~$0.38)
```

### GMaps Link Hack (FREE)

```typescript
// No API needed - just construct search URLs
const gmapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(placeName + ' ' + city)}`;
```

### Why Better Than Google AI Mode?

- ✅ Real sources (TimeOut, Eater, Reddit, food blogs)
- ✅ Full reviews analyzed (not snippets)
- ✅ Insider tips extracted
- ✅ Taste-specific search queries
- ✅ Verified opening hours
- ✅ Fair meeting point calculation (isochrones)
- ✅ Multi-mode transport options (walk/transit/drive)
- ✅ City-aware planning (wing-it vs plan-ahead cities)
- ✅ Structured flexibility (specific anchors + exploration areas)
