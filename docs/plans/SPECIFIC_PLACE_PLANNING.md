# Specific Place Planning - Architecture

> **Status**: Planning  
> **Created**: December 2024  
> **Related**: `/docs/plans/VIBE_MAPS_AGENT_ARCHITECTURE.md`

---

## Overview

This document describes the architecture for **specific place planning** - when users want to find actual venues (restaurants, bars, cafes) rather than areas/neighborhoods.

### When This Applies

| ✅ Use This Pattern | Example |
|---------------------|---------|
| Date night planning | "Romantic dinner in Gràcia then cocktails, ending around midnight" |
| Pub crawl | "Plan a pub crawl in Soho starting at 7pm" |
| Food tour | "Best taco spots in CDMX, walking distance from each other" |
| Activity chain | "Coffee shop, then bookstore, then lunch in Greenwich Village" |

### When NOT to Use (Use Area-Based Instead)

| ❌ Different Pattern | Use Instead |
|---------------------|-------------|
| "Scenic drive Barcelona to Valencia" | Road Trip Planning (areas) |
| "Walking tour of Gothic Quarter" | Vibe Areas |
| "What neighborhoods for nightlife in Berlin" | Vibe Areas |

---

## The Game-Changer: Google Maps Grounding

### What It Provides

Google's **Grounding with Google Maps** tool for Gemini returns:

```json
{
  "groundingChunks": [
    {
      "maps": {
        "uri": "https://maps.google.com/?cid=13100894621228039586",
        "title": "Bar Marsella",
        "placeId": "places/ChIJ0-zA1vBZwokRon0fGj-6z7U"
      }
    }
  ],
  "groundingSupports": [
    {
      "segment": {
        "text": "Bar Marsella is a legendary absinthe bar open until 2:30am..."
      },
      "groundingChunkIndices": [0]
    }
  ]
}
```

### What We Get for FREE

- ✅ **Real, verified places** (from Google Maps database)
- ✅ **placeId** for each place
- ✅ **Opening hours** mentioned in the text
- ✅ **Reviews and ratings** in context
- ✅ **Google Maps URI** (can extract coordinates)
- ✅ **"Places API Place Details Essentials (IDs Only)"** - UNLIMITED FREE to get coordinates from placeId

### Pricing: $0.025 per grounded query

| Tier | Price |
|------|-------|
| Free | 500 requests/day |
| Paid | **$25 per 1,000 prompts** = $0.025 each |

---

## Architecture: Revised Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CONVERSATIONAL (Gather Requirements)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Understand:                                                                │
│  • What kind of experience? (date, pub crawl, food tour)                   │
│  • Starting point and/or ending point                                      │
│  • Time constraints (start time, end time)                                 │
│  • Number of stops wanted                                                  │
│  • Any preferences (budget, vibe, cuisine)                                 │
│                                                                             │
│  Example: "Date night in El Born, starting at 8pm, ending around 1am,     │
│           romantic dinner then cocktails then maybe dancing"               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: GEMINI + GOOGLE MAPS GROUNDING (Find Real Places)                  │
│  Cost: $0.025                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Single Gemini call with Google Maps grounding enabled:                    │
│                                                                             │
│  tools: [{ googleMaps: {} }]                                               │
│  toolConfig: {                                                              │
│    retrievalConfig: {                                                       │
│      latLng: { latitude: 41.3850, longitude: 2.1825 }  // El Born          │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Prompt engineered for AUTHENTIC places:                                    │
│  "Find romantic restaurants in El Born Barcelona for a special date.       │
│   I need places that are:                                                   │
│   - Actually open past 10pm                                                │
│   - Recommended by local food critics or travel writers                    │
│   - NOT tourist traps or chains                                            │
│   - With intimate atmosphere                                                │
│   Suggest 5-6 options with their opening hours."                           │
│                                                                             │
│  RESPONSE includes for each place:                                         │
│  • Name and description (with opening hours in text)                       │
│  • placeId in groundingChunks                                              │
│  • Google Maps URI                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: EXTRACT COORDINATES (FREE)                                         │
│  Cost: $0.00                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Use "Places API Place Details Essentials (IDs Only)" - UNLIMITED FREE     │
│                                                                             │
│  For each placeId from grounding response:                                 │
│  → Get: { lat, lng, name, formatted_address }                              │
│                                                                             │
│  Or parse coordinates from Google Maps URI:                                │
│  https://maps.google.com/?cid=13100894621228039586                         │
│  → Resolve to get coordinates                                               │
│                                                                             │
│  Result: 10-12 verified places with coordinates                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: MAPBOX MATRIX (Walking Times)                                      │
│  Cost: $0.20 (10×10 = 100 elements × $0.002)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Profile: mapbox/walking (NOT driving!)                                    │
│                                                                             │
│  Input: 10 places + start point + end point = 12 locations                 │
│  Matrix: 12 × 12 = 144 elements = $0.29                                    │
│                                                                             │
│  Output: Walking times between every pair of places                        │
│                                                                             │
│          │ Start │ Rest1 │ Rest2 │ Bar1  │ Bar2  │ Club  │ End   │         │
│  ────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤         │
│  Start   │   0   │  8m   │  12m  │  15m  │  10m  │  18m  │  25m  │         │
│  Rest1   │  8m   │   0   │  6m   │  10m  │  5m   │  14m  │  20m  │         │
│  Rest2   │  12m  │  6m   │   0   │  8m   │  9m   │  12m  │  18m  │         │
│  Bar1    │  15m  │  10m  │  8m   │   0   │  7m   │  6m   │  15m  │         │
│  ...                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: GEMINI ROUTE ARCHITECT (Plan the Evening)                          │
│  Cost: $0.003                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Gemini receives:                                                           │
│  • Walking time matrix (actual minutes)                                    │
│  • Place descriptions (from grounding, including hours)                    │
│  • Time constraints (8pm start, 1am end = 5 hours)                         │
│  • User preferences (romantic, dinner → drinks → dancing)                  │
│                                                                             │
│  Gemini plans with REAL data:                                              │
│                                                                             │
│  OPTION 1: "Classic Romance"                                                │
│  8:00pm  Start at Passeig del Born                                         │
│  8:05pm  → 5min walk → Restaurant Cal Pep (dinner until 10:30pm)          │
│  10:35pm → 7min walk → Paradiso (speakeasy cocktails, open til 2:30am)    │
│  12:30am → 4min walk → End near Santa Maria del Mar                        │
│  ✓ Fits timeline, all places open, logical flow                            │
│                                                                             │
│  OPTION 2: "Wine & Tapas Trail"                                             │
│  8:00pm  Start at Passeig del Born                                         │
│  8:10pm  → 10min walk → El Xampanyet (cava & tapas, closes 11pm)          │
│  9:30pm  → 6min walk → La Vinya del Senyor (wine bar, closes 1am)         │
│  11:30pm → 8min walk → Dry Martini (classic cocktails, closes 3am)        │
│  1:00am  → 12min walk → End                                                │
│  ✓ Fits timeline, checked closing times                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: GENERATE PLACE CARDS                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each place in the route, create a card:                               │
│                                                                             │
│  ┌─────────────────────────────────────────┐                               │
│  │  📍 Cal Pep                             │                               │
│  │  ⭐ 4.6 • €€€ • Tapas                   │                               │
│  │  🕐 Open until 11:30pm                  │                               │
│  │                                         │                               │
│  │  "Legendary tapas counter where chef   │                               │
│  │   Pep serves sublime seafood. Book the │                               │
│  │   bar seats for the full experience."  │                               │
│  │                                         │                               │
│  │  ⏱️ Arrive: 8:05pm | Stay: ~2.5 hours  │                               │
│  │  🚶 5 min walk from previous stop      │                               │
│  │                                         │                               │
│  │  💡 What to try:                       │                               │
│  │  • Gambas al ajillo (their signature)  │                               │
│  │  • Whatever Pep recommends that day    │                               │
│  │  • Save room - portions are generous   │                               │
│  │                                         │                               │
│  │  [📍 Google Maps] [📞 Reserve]         │                               │
│  │                                         │                               │
│  │        [←]  1 / 3 stops  [→]           │                               │
│  └─────────────────────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: DISPLAY ROUTES (Same UI as Road Trips)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🌙 Date Night in El Born            [📤 Get Directions] [✨ New]  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │                    M  A  P                                          │   │
│  │                                                                     │   │
│  │         ●━━━━━●━━━━━━●━━━━━●                                       │   │
│  │       Start  Cal   Paradiso  End                                   │   │
│  │              Pep                                                    │   │
│  │                                                                     │   │
│  │  ┌──────────────────────────┐    ┌──────────────────────────────┐ │   │
│  │  │  📍 Cal Pep              │    │  ROUTES                      │ │   │
│  │  │  ⭐ 4.6 • €€€            │    │                              │ │   │
│  │  │  🕐 Until 11:30pm        │    │  ● Classic Romance           │ │   │
│  │  │                          │    │    3 stops • 5 hours        │ │   │
│  │  │  "Legendary tapas..."    │    │                              │ │   │
│  │  │                          │    │  ○ Wine & Tapas Trail        │ │   │
│  │  │  💡 Try: Gambas al ajillo│    │    4 stops • 5 hours        │ │   │
│  │  │                          │    │                              │ │   │
│  │  │  [📍 Maps] [📞 Reserve]  │    └──────────────────────────────┘ │   │
│  │  │                          │         ROUTE SELECTOR              │   │
│  │  │    [←]  1 / 3  [→]       │         (bottom-right)             │   │
│  │  └──────────────────────────┘                                      │   │
│  │       PLACE CARD (bottom-left)                                     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: "GET DIRECTIONS" EXPORT                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Button exports walking directions to Google Maps:                         │
│                                                                             │
│  https://www.google.com/maps/dir/                                          │
│    41.3850,2.1825/                    // Start                             │
│    Cal+Pep+Barcelona/                  // Stop 1 (by name)                 │
│    Paradiso+Barcelona/                 // Stop 2                           │
│    41.3840,2.1820/                     // End                              │
│    ?travelmode=walking                                                      │
│                                                                             │
│  Or with placeIds for precision:                                           │
│  https://www.google.com/maps/dir/?api=1                                    │
│    &origin=41.3850,2.1825                                                  │
│    &destination=41.3840,2.1820                                             │
│    &waypoints=place_id:ChIJ...%7Cplace_id:ChIJ...                         │
│    &travelmode=walking                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Pricing Reference (December 2024)

### Gemini API Pricing

#### Gemini 2.5 Flash (Used for Grounding calls)

| Type | Price per 1M tokens |
|------|---------------------|
| Input (text, image, video) | $0.30 |
| Text output | $2.50 |
| Audio input | $1.00 |

#### Grounding Pricing

| Grounding Type | Price | Free Tier |
|----------------|-------|-----------|
| **Google Maps Grounding** | **$25 / 1,000 prompts** ($0.025 each) | ❌ None |
| Google Search Grounding | $35 / 1,000 prompts | 1,500/day free |
| Grounding with your data | $2.50 / 1,000 requests | - |

**Note**: Google Maps Grounding has **NO free tier** - it's $0.025 from the first request.

### Mapbox API Pricing (Post-Free Tier)

| API | Free Tier | Paid Rate |
|-----|-----------|-----------|
| **Matrix API** | 100,000 elements/month | **$2.00 / 1,000 elements** ($0.002 each) |
| Directions API | 100,000 requests/month | $2.00 / 1,000 requests |
| Geocoding (Temporary) | 100,000 requests/month | $0.75 / 1,000 requests |
| Search Box (Sessions) | 500 sessions/month | $3.00 / 1,000 sessions |

---

## Cost Analysis: Detailed Breakdown

### Per-Search Cost (Assuming NO Free Tiers)

| Step | Service | Units | Rate | Cost |
|------|---------|-------|------|------|
| 1. Find places | Gemini + Google Maps Grounding | 1 prompt | $0.025/prompt | **$0.025** |
| 2. Gemini tokens | Input ~2K tokens | 2,000 | $0.30/1M | $0.0006 |
| 3. Gemini tokens | Output ~1K tokens | 1,000 | $2.50/1M | $0.0025 |
| 4. Get coordinates | Places API (IDs Only) | 10 lookups | FREE | **$0.00** |
| 5. Walking times | Mapbox Matrix (12×12) | 144 elements | $0.002/element | **$0.288** |
| 6. Route planning | Gemini 2.5 Flash | ~1K tokens | ~$0.003 | $0.003 |
| **Total per search** | | | | **~$0.32** |

### Heavy User Scenario: 10 Searches/Day for 1 Month

```
10 searches/day × 30 days = 300 searches/month
```

#### With Free Tiers Available

| Component | Usage | Free Tier | Paid Usage | Cost |
|-----------|-------|-----------|------------|------|
| Google Maps Grounding | 300 prompts | ❌ None | 300 prompts | **$7.50** |
| Mapbox Matrix | 43,200 elements | 100,000 | 0 (under free) | **$0.00** |
| Gemini tokens | ~900K tokens | - | ~900K | **~$0.90** |
| **TOTAL** | | | | **~$8.40/month** |

#### Without Free Tiers (Testing exhausted them)

| Component | Usage | Rate | Cost |
|-----------|-------|------|------|
| Google Maps Grounding | 300 prompts | $0.025/prompt | **$7.50** |
| Mapbox Matrix | 43,200 elements | $0.002/element | **$86.40** |
| Gemini tokens | ~900K tokens | ~$0.003/search | **~$0.90** |
| **TOTAL** | | | **~$94.80/month** |

### Cost Breakdown Chart

```
Without Free Tiers - 10 searches/day for 30 days:
                                                              
Google Maps Grounding ($7.50)   ████░░░░░░░░░░░░░░░░░░░░  8%
                                                              
Mapbox Matrix ($86.40)          ███████████████████████░  91%
                                                              
Gemini Tokens ($0.90)           ░░░░░░░░░░░░░░░░░░░░░░░░  1%
                                                              
TOTAL: ~$95/month

The Matrix API is the killer cost when free tier is exhausted.
```

### Scaling Scenarios

| Daily Searches | Monthly Searches | Matrix Elements | With Free Tiers | Without Free Tiers |
|----------------|------------------|-----------------|-----------------|-------------------|
| 1 | 30 | 4,320 | ~$0.75 | ~$9.39 |
| 5 | 150 | 21,600 | ~$3.75 | ~$46.95 |
| **10** | **300** | **43,200** | **~$8.40** | **~$94.80** |
| 20 | 600 | 86,400 | ~$15.00 | ~$187.80 |
| 50 | 1,500 | 216,000 | ~$18.75 + $232 matrix | ~$469.50 |

### Break-Even Analysis

To make this sustainable as a business:

| Scenario | Monthly Cost | Subscription Needed |
|----------|--------------|---------------------|
| Light user (1 search/day) | ~$10 | $15/month |
| Typical user (5 searches/day) | ~$47 | $60/month (expensive!) |
| Heavy user (10 searches/day) | ~$95 | Not viable without volume discount |

**Key Insight**: The Mapbox Matrix API is the cost bottleneck. Options:
1. Cache common route matrices (Barcelona restaurants → save for reuse)
2. Reduce matrix size (8×8 instead of 12×12 = 64 vs 144 elements)
3. Negotiate volume pricing with Mapbox
4. Use alternative APIs (OSRM self-hosted = free but requires server)

---

## Google Maps Grounding: Number of Results

### How Many Places Does It Return?

Based on the API documentation and examples:

| Query Type | Typical Results | Max Observed |
|------------|-----------------|--------------|
| "restaurants near me" | 5-8 places | ~10 |
| "best Italian restaurants in [area]" | 4-6 places | ~8 |
| Specific query with constraints | 3-5 places | ~6 |

The `groundingChunks` array typically contains **5-10 places**, but:
- Quality > Quantity: Results are curated for relevance
- The exact number depends on what Google Maps has for that query
- You can influence results through prompt engineering

### Ensuring Enough Results

To get 10 candidates for your planning:

```javascript
const prompt = `Find 10-12 romantic restaurants in El Born Barcelona.
For each restaurant, include:
- Name and what makes it special
- Opening hours (especially closing time)
- Price range
- Why it's good for a date

I need multiple options to plan different route possibilities.`;
```

### What Each Result Contains

```json
{
  "groundingChunks": [
    {
      "maps": {
        "uri": "https://maps.google.com/?cid=...",
        "title": "Restaurant Name",
        "placeId": "places/ChIJ..."
      }
    }
  ],
  "groundingSupports": [
    {
      "segment": {
        "startIndex": 0,
        "endIndex": 150,
        "text": "Restaurant Name is a romantic spot known for..."
      },
      "groundingChunkIndices": [0]
    }
  ]
}
```

You get:
- ✅ Place name (`title`)
- ✅ Google Maps URI (contains CID for direct link)
- ✅ Place ID (for coordinate lookup)
- ✅ Description with hours/ratings in the text segment

---

## Comparison: Google Maps Grounding vs Manual Approach

| Approach | Place Discovery | Coordinates | Opening Hours | Total/Search |
|----------|-----------------|-------------|---------------|--------------|
| **Google Maps Grounding** | $0.025 | FREE | ✅ Included | **$0.32** |
| Manual (Gemini + Geocoding) | $0.003 | $0.075 | ❌ None | $0.28 |
| Manual + Places Details | $0.003 | $0.075 | $0.075 | $0.43 |

**Google Maps Grounding wins**: Slightly more expensive than barebones, but:
- ✅ Includes opening hours automatically
- ✅ Places are verified to exist
- ✅ Single API call instead of multiple
- ✅ Better quality recommendations

---

## Validation & Fallback (Explained)

### The Problem

Even with Google Maps Grounding, things can go wrong:

```
Scenario 1: Gemini asks for 5 places but Maps only returns 3
Scenario 2: A place appears closed when user actually goes
Scenario 3: Walking route is blocked (construction, event)
Scenario 4: User doesn't like one of the suggestions
```

### The Solution: Buffer + Graceful Degradation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BUFFER STRATEGY                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER WANTS: 3 stops for their date night                                  │
│                                                                             │
│  WE ASK GEMINI FOR: 8-10 places (buffer of 5-7 extras)                     │
│                                                                             │
│  GEMINI + GROUNDING RETURNS: 8 places with placeIds                        │
│                                                                             │
│  WE VALIDATE:                                                               │
│  ✅ Place 1: placeId valid, coordinates obtained                           │
│  ✅ Place 2: placeId valid, coordinates obtained                           │
│  ❌ Place 3: placeId invalid (maybe place closed recently)                 │
│  ✅ Place 4: placeId valid, coordinates obtained                           │
│  ✅ Place 5: placeId valid, coordinates obtained                           │
│  ...                                                                        │
│                                                                             │
│  RESULT: 7 valid places (enough to plan routes with 3-4 stops)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Opening Hours Double-Check

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROMPT ENGINEERING FOR OPENING HOURS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  In the Gemini prompt, we EXPLICITLY ask:                                  │
│                                                                             │
│  "I need restaurants for a date starting at 8pm and ending around 1am.    │
│   Only suggest places that are:                                            │
│   - Open past 10pm for dinner options                                      │
│   - Open past 1am for bar options                                          │
│   - Include the closing time in your response"                             │
│                                                                             │
│  Google Maps Grounding will pull opening hours from Maps data and          │
│  include them in the response text. Gemini can then reason about           │
│  which places fit the timeline.                                             │
│                                                                             │
│  EXAMPLE RESPONSE:                                                          │
│  "Bar Marsella (closes 2:30am) would be perfect for late-night drinks.    │
│   They've been serving absinthe since 1820..."                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fallback in Route Planning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ROUTE OPTIONS AS FALLBACK                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  We generate 2-3 route options, not just one:                              │
│                                                                             │
│  OPTION 1: Uses places A, B, C                                              │
│  OPTION 2: Uses places A, D, E (different bars)                            │
│  OPTION 3: Uses places F, B, G (different restaurant)                      │
│                                                                             │
│  If user finds Option 1's bar is actually closed:                          │
│  → They can switch to Option 2 which uses different bars                   │
│                                                                             │
│  This provides BUILT-IN FALLBACK without additional API calls.             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Google Places API Pricing Reference

From official Google pricing (December 2024):

| SKU | Free Cap | Price per 1,000 |
|-----|----------|-----------------|
| Geocoding | 10,000/month | $5.00 |
| Places Details Essentials | 10,000/month | $5.00 |
| **Places Details Essentials (IDs Only)** | **Unlimited** | **FREE** |
| Text Search Essentials (IDs Only) | Unlimited | FREE |
| Autocomplete Requests | 10,000/month | $2.83 |

### Key Insight: "IDs Only" is FREE

The "Places API Place Details Essentials (IDs Only)" tier is **unlimited and free**. This lets us:
1. Get placeId from Google Maps Grounding
2. Look up coordinates from placeId for free
3. Use coordinates in Mapbox Matrix

This makes the coordinate extraction step **$0.00**.

---

## Comparison: Area-Based vs Specific Place Planning

| Aspect | Area-Based (Road Trips) | Specific Places (Date Night) |
|--------|-------------------------|------------------------------|
| **Discovery** | Local OSM data | Google Maps Grounding |
| **Granularity** | Towns, neighborhoods | Specific restaurants, bars |
| **Opening hours** | Not critical | Critical |
| **Transport mode** | Usually driving | Usually walking |
| **Matrix size** | 10×10 areas | 12×12 places |
| **Cost per search** | ~$0.20 | ~$0.32 |
| **Monthly (typical)** | ~$8/user | ~$6.40/user |

---

## Implementation Notes

### Google Maps Grounding API Call

```javascript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: userLocation.lat,
            longitude: userLocation.lng
          }
        }
      }
    })
  }
);

// Extract placeIds from grounding chunks
const groundingChunks = response.candidates[0]?.groundingMetadata?.groundingChunks || [];
const places = groundingChunks
  .filter(chunk => chunk.maps)
  .map(chunk => ({
    title: chunk.maps.title,
    placeId: chunk.maps.placeId,
    uri: chunk.maps.uri
  }));
```

### Getting Coordinates from PlaceId (FREE)

```javascript
// Use Places API with fields=geometry only (IDs Only tier = FREE)
const placeDetails = await fetch(
  `https://maps.googleapis.com/maps/api/place/details/json?` +
  `place_id=${placeId}&fields=geometry&key=${API_KEY}`
);

const { lat, lng } = placeDetails.result.geometry.location;
```

### Mapbox Matrix for Walking

```javascript
// Use walking profile, not driving!
const matrixUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/walking/${coordinates}?` +
  `access_token=${MAPBOX_TOKEN}`;

const response = await fetch(matrixUrl);
const durations = response.durations; // Walking times in seconds
```

---

## Service Requirements

### Google Maps Grounding Attribution

When using Google Maps Grounding, we must:

1. **Show Google Maps sources** with each place recommendation
2. **Link to Google Maps** using the provided URI
3. **Display "Google Maps" text** following brand guidelines
4. **Include the Google Maps favicon** (optional but recommended)

```html
<!-- Example attribution -->
<div class="place-source">
  <img src="https://www.google.com/images/branding/product/ico/maps15_bnuw3a_32dp.ico" />
  <span translate="no">Google Maps</span>
  <a href="https://maps.google.com/?cid=...">View on Maps</a>
</div>
```

---

## What's NOT Covered Here

| Feature | Why Not | Future |
|---------|---------|--------|
| Reservations | Requires external integration (OpenTable, Resy) | Phase 2 |
| Real-time availability | Google doesn't provide this | Not planned |
| Menu/pricing details | Limited in Maps data | Maybe with grounding |
| Event-based closures | Not in Maps data | Accept imperfection |

---

*This document complements the main Vibe Maps Agent Architecture. Delete after implementation.*
