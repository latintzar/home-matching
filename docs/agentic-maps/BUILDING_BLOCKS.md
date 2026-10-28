---
status: design
last_updated: 2024-12-12
revision: major-restructure-33-tests
owner: peter
level: 3-implementation
derives_from:
  - scenarios/01-THINGS-TO-DO.md
  - scenarios/02-WHERE-TO-STAY.md
  - scenarios/03-STAY-AND-DO.md
  - scenarios/04-SINGLE-PLACE.md
  - scenarios/05-MEET-IN-MIDDLE.md
  - scenarios/06-AREAS-TO-EXPLORE.md
  - scenarios/07-MULTI-STOP-ROUTE.md
feeds_back_to:
  - scenarios/*.md (when design changes)
  - AGENTIC_MAPS.md (rarely, fundamental changes only)
---

# Agentic Maps - Building Block Tests

> Modular, testable units that can be verified individually before stringing together for full scenarios.

<!-- 
📊 HIERARCHY POSITION: Level 3 (Implementation Details)

    Level 1: AGENTIC_MAPS.md (Vision - rarely changes)
                    │
    Level 2: scenarios/*.md (Specs - sometimes changes)
                    │
    Level 3: BUILDING_BLOCKS.md ◄── YOU ARE HERE
                    │
    Level 4: Actual code

🔄 FEEDBACK LOOP:
- Design flows DOWN from scenarios to here
- Learnings flow UP from here to scenarios (and rarely to vision)
- This is the "working doc" where you discover what actually works
- When you learn something, propagate UP if it changes the design
-->

## Philosophy

Each building block is:
- **Self-contained**: Can be tested in isolation
- **Controlled input**: Pre-defined test data, not dependent on prior steps
- **Visual output**: Results appear on the map
- **Composable**: When all blocks work, they chain into full scenarios

---

## Test Selector UI

In the chat+map interface, clicking a test shows a form with sample data:

```
┌─────────────────────────────────────────┐
│  🧪 Building Block Tests                │
├─────────────────────────────────────────┤
│  ▼ Scenario 1: Things to Do             │
│    • 1.1 Generate vibe areas            │
│    • 1.2 Generate itinerary             │
│                                         │
│  ▼ Scenario 5: Meet in Middle           │
│    • 5.1 Geocode locations              │
│    • 5.2 Generate isochrone             │
│    • 5.3 Compute intersection           │
│    • 5.4 Identify neighborhoods         │
│                                         │
│  ▼ Shared                               │
│    • Render circles                     │
│    • Render info card                   │
│    ...                                  │
└─────────────────────────────────────────┘
```

---

## Scenario 1: Things to Do

### Test 1.1 - Generate vibe areas from a trip description

| | |
|---|---|
| **Input** | Text description of trip (e.g., "cool bars in Barcelona") |
| **Output** | 5 colored circles on map at neighborhood coordinates |
| **API** | Gemini 2.5 Pro + Google Search grounding |
| **Cost** | ~$0.005 |
| **Proves** | AI can identify real neighborhoods with accurate lat/lng |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take user query string | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding enabled | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt asks for JSON: 5 neighborhoods with `name`, `lat`, `lng`, `why` | Structured output prompt |
| 4 | Parse JSON response | `JSON.parse()` the model output |
| 5 | Pass array to Shared.1 (render circles) | Call `renderVibeCircles(areas)` |

**📋 TEST INPUT (copy-paste):**
```
cool bars in Barcelona
```

**Expected output:**
- El Born (circle at ~2.18, 41.38)
- Gràcia (circle at ~2.15, 41.40)
- Raval (circle at ~2.17, 41.38)
- Barceloneta (circle at ~2.19, 41.38)
- Poble Sec (circle at ~2.16, 41.37)

---

### Test 1.2 - Generate itinerary WITHOUT coordinates

| | |
|---|---|
| **Input** | Area name + city + vibe (NO coordinates) |
| **Output** | 3 search suggestions with clickable GMaps + TikTok links |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can create suggestions from area name alone (casual use case) |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area name, city, vibe (no lat/lng) | Input from UI or hardcoded |
| 2 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 3 | Prompt: "Give 3 activity suggestions for {vibe} in {area}, {city}. Return JSON array with `emoji`, `activity`, `searchQuery`" | Structured output prompt |
| 4 | Parse JSON array | `JSON.parse()` |
| 5 | For each item, call Shared.4 to generate URLs | `generateSearchURLs(item.searchQuery, city)` |
| 6 | Render in info card UI | Pass to `ItineraryList` component |

**📋 TEST INPUT (copy-paste):**
```
El Born, Barcelona - nightlife
```

**Expected output:**
```
🍸 Cocktail bars → [GMaps] [TikTok]
🍷 Wine caves → [GMaps] [TikTok]  
🌙 Late night tapas → [GMaps] [TikTok]
```

---

### Test 1.3 - Generate itinerary WITH coordinates

| | |
|---|---|
| **Input** | Area name + city + lat/lng + vibe |
| **Output** | 3 search suggestions with clickable GMaps + TikTok links |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | Coordinates improve suggestion relevance and precision |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area object (name, city, lat, lng, vibe) | Input from Test 1.1 output or hardcoded |
| 2 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 3 | Prompt: "Give 3 activity suggestions for {vibe} in {area}, {city} (centered at {lat}, {lng}). Return JSON array with `emoji`, `activity`, `searchQuery`" | Include coords in prompt for precision |
| 4 | Parse JSON array | `JSON.parse()` |
| 5 | For each item, call Shared.4 to generate URLs | `generateSearchURLs(item.searchQuery, city)` |
| 6 | Render in info card UI | Pass to `ItineraryList` component |

**📋 TEST INPUT (copy-paste):**
```
El Born, Barcelona [41.3851, 2.1816] - nightlife
```

**Expected output:**
```
🍸 Hidden speakeasies → [GMaps] [TikTok]
🍷 Natural wine bars → [GMaps] [TikTok]  
🌙 Late-night pintxos → [GMaps] [TikTok]
```

---

## Scenario 2: Where to Stay

### Test 2.1 - Generate stay areas with booking links

| | |
|---|---|
| **Input** | City + trip type (e.g., "Tokyo romantic trip") |
| **Output** | 5 circles with price tier labels + Airbnb/Booking.com link buttons |
| **API** | Gemini 2.5 Pro + grounding |
| **Cost** | ~$0.005 |
| **Proves** | AI can distinguish "stay" neighborhoods and we can generate booking URLs |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take user query string | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt: "For a {trip type} trip, recommend 5 neighborhoods to STAY in {city}. Return JSON with `name`, `lat`, `lng`, `priceTier` (1-3), `why`" | Structured output prompt |
| 4 | Parse JSON response | `JSON.parse()` |
| 5 | For each area, call Shared.5 to generate booking URLs | `generateBookingURLs(area.name, city, dates)` |
| 6 | Render circles with price tier badges (💰💰💰) | Pass to `renderVibeCircles(areas)` with `priceTier` overlay |

**📋 TEST INPUT (copy-paste):**
```
romantic trip to Tokyo
```

**Expected output:**
- Shibuya (💰💰 mid-range) + [Airbnb] [Booking.com]
- Shinjuku (💰💰💰 luxury) + [Airbnb] [Booking.com]
- Asakusa (💰 budget) + [Airbnb] [Booking.com]
- ...

---

### Test 2.2 - Generate nearby highlights for a stay area

| | |
|---|---|
| **Input** | Neighborhood name + coordinates |
| **Output** | 3 "things to do near your hotel" suggestions |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI understands "near accommodation" context |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area object (name, city, lat, lng) | Input from Test 2.1 output or hardcoded |
| 2 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 3 | Prompt: "For someone staying in {area}, {city}, suggest 3 things to do NEARBY (walking distance). Return JSON array with `emoji`, `activity`, `distance`, `searchQuery`" | Structured output prompt |
| 4 | Parse JSON array | `JSON.parse()` |
| 5 | Generate search URLs for each | Call Shared.4 |
| 6 | Display in "Near your stay" section of info card | Render in UI |

**📋 TEST INPUT (copy-paste):**
```
Shibuya, Tokyo [35.6580, 139.7016]
```

**Expected output:**
```
🍜 Morning ramen spots (5 min walk) → [GMaps] [TikTok]
🛍️ Shibuya 109 shopping (2 min walk) → [GMaps] [TikTok]
🌸 Yoyogi Park stroll (10 min walk) → [GMaps] [TikTok]
```

---

## Scenario 3: Stay + Do

### Test 3.1 - Generate dual-layer areas (stay + activity)

| | |
|---|---|
| **Input** | Trip description (e.g., "weekend in Paris") |
| **Output** | 2 blue circles (stay) + 3 orange circles (activities), with collapsible navigation |
| **API** | Gemini 2.5 Pro + grounding (single call) |
| **Cost** | ~$0.005 |
| **Proves** | Single AI call can produce two distinct recommendation sets with proper UI |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take user query string | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt: "For {query}, provide TWO lists: (1) 2 neighborhoods to STAY, (2) 3 neighborhoods for ACTIVITIES. Return JSON with `stayAreas: [...]` and `activityAreas: [...]`, each with `name`, `lat`, `lng`, `why`" | Request 2 stay + 3 activity |
| 4 | Parse JSON with both arrays | `JSON.parse()` |
| 5 | Assign colors: `stayAreas` = blue, `activityAreas` = orange | Set `color` property |
| 6 | Render 2 blue circles + 3 orange circles on map | Call `renderVibeCircles()` |
| 7 | Build unified list: [Stay 1, Stay 2, Do 1, Do 2, Do 3] | Merge arrays with type labels |
| 8 | In card header, show small-text collapsible list | "STAY #1 • STAY #2 • DO #1 • DO #2 • DO #3" |
| 9 | Click list → card becomes list view showing all 5 | Each row: type + number + name |
| 10 | Click row → focus that area, return to detail view | `setCurrentAreaIndex(clickedIndex)` |
| 11 | Prev/Next arrows cycle through ALL 5 as unified list | Stay 1 → Stay 2 → Do 1 → Do 2 → Do 3 → Stay 1... |

**📋 TEST INPUT (copy-paste):**
```
romantic weekend in Paris
```

**Expected output:**
```
Card header (collapsed): STAY #1 • STAY #2 • DO #1 • DO #2 • DO #3
                         ▼ (click to expand)

Card header (expanded):
┌─────────────────────────────┐
│ STAY #1  Le Marais          │ ← click to view
│ STAY #2  Saint-Germain      │
│ DO #1    Montmartre         │
│ DO #2    Latin Quarter      │
│ DO #3    Bastille           │
└─────────────────────────────┘

Map: 2 blue circles + 3 orange circles
Navigation: ← Prev | 2 of 5 | Next →
```

---

### Test 3.2 - Visual travel lines between areas

| | |
|---|---|
| **Input** | 2 stay areas + 3 activity areas with coordinates |
| **Output** | Subtle travel lines on map with times, togglable |
| **API** | Turf.js (local, no API) |
| **Cost** | FREE |
| **Proves** | Visual travel planning without API calls |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take 2 stay areas + 3 activity areas with coords | Input from Test 3.1 |
| 2 | Import Turf.js | `import * as turf from '@turf/turf'` |
| 3 | Calculate Stay→Do lines (2×3 = 6 lines) | Each stay to each activity |
| 4 | Calculate Do→Do lines (3 lines) | Do1→Do2, Do2→Do3, Do3→Do1 |
| 5 | For each line, calculate distance | `turf.distance()` |
| 6 | Estimate times for walk/transit/drive | `walk: dist*12, transit: dist*4, drive: dist*2` min/km |
| 7 | Draw subtle dashed lines on map | Mapbox LineString, `line-dasharray: [2, 2]`, opacity 0.4 |
| 8 | Add time labels at line midpoints | Small text: "12 min" |
| 9 | Add iOS-style toggle top-right corner | Colored handle + matching colored label |
| 10 | Toggle labeled "Travel Times" | Toggle ON → show lines; OFF → hide |
| 11 | Line colors: Stay→Do = purple, Do→Do = orange | Visual distinction |

**📋 TEST INPUT (copy-paste):**
```json
{
  "stayAreas": [
    { "name": "Le Marais", "lat": 48.8566, "lng": 2.3622 },
    { "name": "Saint-Germain", "lat": 48.8530, "lng": 2.3350 }
  ],
  "activityAreas": [
    { "name": "Montmartre", "lat": 48.8867, "lng": 2.3431 },
    { "name": "Latin Quarter", "lat": 48.8490, "lng": 2.3470 },
    { "name": "Bastille", "lat": 48.8533, "lng": 2.3692 }
  ]
}
```

**Expected output:**
```
Map shows:
- 6 purple dashed lines (each Stay → each Do) with times
- 3 orange dashed lines (Do1→Do2, Do2→Do3, Do3→Do1) with times

Top-right toggle:
┌──────────────────────┐
│ 🟢 Travel Times      │  ← iOS-style toggle, green when ON
└──────────────────────┘

Line labels: "8 min", "15 min", "12 min", etc.
```

---

## Scenario 4: Single Place

### Test 4.1 - Search Google for place candidates

| | |
|---|---|
| **Input** | Query + location (e.g., "best ramen Shibuya quiet") |
| **Output** | List of 3 candidate place names with snippets |
| **API** | ScrapingDog Google Search |
| **Cost** | $0.001 |
| **Proves** | ScrapingDog returns useful results for place discovery |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take query string | Input from text field |
| 2 | URL encode the query | `encodeURIComponent(query)` |
| 3 | Call ScrapingDog Google Search API | `GET https://api.scrapingdog.com/google?api_key={key}&query={encoded}&results=10` |
| 4 | Parse response JSON | Extract `organic_results` array |
| 5 | Filter to top 3 relevant results | Check for place-like titles (has location words) |
| 6 | Extract `title` and `snippet` for each | Map to `{ name, snippet }` |
| 7 | Display as numbered list | Render in UI |

**📋 TEST INPUT (copy-paste):**
```
best quiet ramen Shibuya Tokyo
```

**Expected output:**
```
1. Fuunji - "legendary tsukemen, calm atmosphere..."
2. Ichiran Shibuya - "private booths, solo dining..."
3. Afuri Shibuya - "light yuzu ramen, modern space..."
```

---

### Test 4.2 - Get place details from Google Maps

| | |
|---|---|
| **Input** | Place name + city (e.g., "Fuunji Tokyo") |
| **Output** | Card with details + pin on map |
| **API** | ScrapingDog Google Maps |
| **Cost** | $0.001 |
| **Proves** | ScrapingDog GMaps returns structured place data |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take place name + city | Input from text field or Test 4.1 output |
| 2 | Build search query | `"{placeName} {city}"` |
| 3 | Call ScrapingDog Google Maps Search | `GET https://api.scrapingdog.com/google_maps?api_key={key}&query={encoded}` |
| 4 | Parse response | Extract first result from `local_results` |
| 5 | Extract: `title`, `address`, `rating`, `reviews`, `price`, `hours`, `gps_coordinates` | Map to structured object |
| 6 | Store `place_id` for review fetching | Keep for Test 4.3 |
| 7 | Render info card | Display in `PlaceCard` component |
| 8 | Place pin on map | Call Shared.3 with coordinates |

**📋 TEST INPUT (copy-paste):**
```
Fuunji, Tokyo
```

**Expected output:**
```
📍 Fuunji
   2-14-3 Yoyogi, Shibuya City
   ⭐ 4.5 (2,847 reviews)
   💰 $$
   🕐 11:00 AM - 3:00 PM, 5:00 PM - 9:00 PM
   [Pin on map at 139.7020, 35.6833]
```

---

### Test 4.3 - Get reviews for a place

| | |
|---|---|
| **Input** | Place name or place ID |
| **Output** | 5 recent reviews with quotes, ratings, dates |
| **API** | ScrapingDog Google Maps Reviews |
| **Cost** | $0.001 |
| **Proves** | Can fetch authentic review content |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take `place_id` from Test 4.2 (or search first if not available) | Input string |
| 2 | Call ScrapingDog Google Maps Reviews | `GET https://api.scrapingdog.com/google_maps_reviews?api_key={key}&data_id={place_id}` |
| 3 | Parse response | Extract `reviews` array |
| 4 | For top 5 reviews, extract: `rating`, `text`, `relative_date` | Map to structured objects |
| 5 | Generate star display | `'⭐'.repeat(rating)` |
| 6 | Truncate long review text | First 100 chars + "..." |
| 7 | Display as list | Render in `ReviewsList` component |

**📋 TEST INPUT (copy-paste):**
```
Fuunji Tokyo
```

**Expected output:**
```
⭐⭐⭐⭐⭐ "The broth is incredibly rich..." - 2 days ago
⭐⭐⭐⭐⭐ "Peaceful atmosphere, focused on food" - 1 week ago
⭐⭐⭐⭐ "Worth the wait, cash only though" - 2 weeks ago
```

---

### Test 4.4 - Curate and present the winner with evocative language

| | |
|---|---|
| **Input** | 3 place candidates with details + user criteria |
| **Output** | Single recommendation with evocative title + explanation, displayed on map |
| **API** | Gemini 2.5 Flash Lite |
| **Cost** | ~$0.0005 |
| **Proves** | AI can pick winner and describe using language that evokes what people think |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take candidates array + criteria array | Input from Tests 4.1-4.3 or hardcoded |
| 2 | Build context string | Format each candidate: name, rating, top 3 review snippets |
| 3 | Send to Gemini 2.5 Flash Lite | `POST` to Vertex AI |
| 4 | Prompt: "User wants {criteria}. Here are 3 options: {context}. Pick the BEST one. Give it an evocative title based on review sentiment (e.g., 'The Local Favorite', 'Hidden Gem', 'The Crowd-Pleaser', 'Quiet Escape', 'Authentic Soul'). Return JSON with `winner`, `evocativeTitle`, `whatPeopleSay` (one-line essence from reviews), `tips`, `warnings`" | Use evocative language |
| 5 | Parse JSON response | `JSON.parse()` |
| 6 | Display winner pin on map | Call Shared.3 with winner coords |
| 7 | Show card with evocative presentation | Title + sentiment + tips |

**📋 TEST INPUT (copy-paste):**
```json
{
  "criteria": ["quiet", "authentic"],
  "candidates": [
    { 
      "name": "Fuunji", 
      "rating": 4.5,
      "address": "2-14-3 Yoyogi, Shibuya",
      "lat": 35.6833,
      "lng": 139.7020,
      "priceLevel": "$$",
      "reviews": [
        "Peaceful atmosphere, no loud music. Just the sound of slurping noodles. Perfect for solo diners.",
        "Traditional Tokyo ramen shop that hasn't changed in 20 years. The owner takes his craft seriously.",
        "Quiet spot tucked away from the tourist crowds. Cash only but worth it.",
        "Authentic tsukemen experience. No frills, just incredible broth and perfect noodles.",
        "Calm and focused vibe. Regulars come here to enjoy the food, not to chat."
      ]
    },
    { 
      "name": "Ichiran Shibuya", 
      "rating": 4.3,
      "address": "1-22-7 Jinnan, Shibuya",
      "lat": 35.6623,
      "lng": 139.6993,
      "priceLevel": "$$",
      "reviews": [
        "Private booths are great for introverts but the line was 45 minutes long. Very touristy.",
        "Efficient system but feels like eating in a factory. Good for quick solo meal.",
        "Decent ramen but the experience feels manufactured. Lost its soul to scale.",
        "Popular with tourists for a reason - reliable and consistent, just not special.",
        "The customization sheet is fun but the vibe is sterile."
      ]
    },
    { 
      "name": "Afuri Shibuya", 
      "rating": 4.4,
      "address": "1-1-2 Ebisu, Shibuya",
      "lat": 35.6468,
      "lng": 139.7102,
      "priceLevel": "$$$",
      "reviews": [
        "Modern hip vibe with loud music and Instagram-worthy presentation. Young trendy crowd.",
        "The yuzu shio broth is unique and delicious but it's always packed and noisy.",
        "Sleek design, great for dates but not for a quiet meal. Wait times can be brutal.",
        "Innovative take on ramen but feels more like a brand than a ramen shop.",
        "Good if you want to be seen. Not traditional at all but the food is solid."
      ]
    }
  ]
}
```

**Expected output:**
```
🏆 The Quiet Escape

   Fuunji
   
   "A calm retreat where the broth speaks for itself"
   
   💡 Tips: Go early, try the thick noodles
   ⚠️ Heads up: Cash only

   [Pin displayed on map at 35.6833, 139.7020]
```

**Evocative title examples:**
- "The Local Favorite" - when reviews mention "locals love this"
- "Hidden Gem" - when off the beaten path, few tourists
- "The Crowd-Pleaser" - high ratings, broad appeal
- "Quiet Escape" - when reviews mention peaceful atmosphere
- "Authentic Soul" - when traditional, unchanged over years
- "The Institution" - long-standing, legendary status

---

## Scenario 5: Meet in Middle

### Test 5.1 - Geocode location descriptions to coordinates

| | |
|---|---|
| **Input** | Two text locations (e.g., "Shoreditch, London" and "Camden, London") |
| **Output** | Two pins on map with coordinates displayed |
| **API** | Mapbox Geocoding |
| **Cost** | ~$0.001 |
| **Proves** | Fuzzy locations convert to precise coordinates |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two location strings | Input from text fields |
| 2 | For each location, call Mapbox Geocoding API | `GET https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json?access_token={token}` |
| 3 | Parse response | Extract first result's `center` array `[lng, lat]` |
| 4 | Store coordinates | `{ locationA: { lng, lat }, locationB: { lng, lat } }` |
| 5 | Place colored pins on map | Call Shared.3 twice with different colors |
| 6 | Display coordinates in UI | Show under each location name |
| 7 | Fit map bounds to show both pins | `map.fitBounds([[lng1, lat1], [lng2, lat2]])` |

**📋 TEST INPUT (copy-paste):**
```
Shoreditch, London | Camden, London
```

**Expected output:**
```
🔵 Shoreditch: -0.0777, 51.5246 [pin on map]
🔴 Camden: -0.1426, 51.5390 [pin on map]
```

---

### Test 5.2 - Generate isochrone from a location (Mapbox)

| | |
|---|---|
| **Input** | Coordinates + travel mode + minutes |
| **Output** | Shaded polygon on map showing reachable area |
| **API** | Mapbox Isochrone (cheaper than Geoapify) |
| **Cost** | ~$0.001 |
| **Proves** | Isochrone API works and renders properly |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take coordinates, mode, minutes | Input from Test 5.1 or hardcoded |
| 2 | Map mode to Mapbox format | `{ walk: 'walking', bike: 'cycling', drive: 'driving' }` |
| 3 | Call Mapbox Isochrone API | `GET https://api.mapbox.com/isochrone/v1/mapbox/{mode}/{lng},{lat}?contours_minutes={minutes}&polygons=true&access_token={token}` |
| 4 | Parse response | Extract `features[0].geometry` (GeoJSON Polygon or MultiPolygon) |
| 5 | Note: Result may be MultiPolygon if area has gaps | Isochrones can be "wonky" |
| 6 | Store GeoJSON for later intersection | Keep in state |
| 7 | Add polygon layer to Mapbox | `map.addLayer({ type: 'fill', source: { type: 'geojson', data: polygon }, paint: { 'fill-opacity': 0.3, 'fill-color': '#3b82f6' } })` |

**📋 TEST INPUT (copy-paste):**
```
51.5246, -0.0777 | walking | 20 min
```

**Expected output:**
- Semi-transparent polygon on map showing 20-min walk reach from Shoreditch
- Note: May show as multiple disconnected areas if blocked by river/park

---

### Test 5.3 - Compute intersection of two isochrones (handles multi-polygon)

| | |
|---|---|
| **Input** | Two isochrone GeoJSONs (may be Polygon or MultiPolygon) |
| **Output** | One or more highlighted "fair zone" polygons on map |
| **API** | Turf.js (FREE, local) |
| **Cost** | FREE |
| **Proves** | Polygon intersection works even with wonky isochrones |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two GeoJSONs from Test 5.2 | May be Polygon or MultiPolygon |
| 2 | Import Turf.js | `import * as turf from '@turf/turf'` |
| 3 | Normalize inputs | If MultiPolygon, use `turf.flatten()` to get individual polygons |
| 4 | Wrap as FeatureCollections | `turf.featureCollection([...polygons])` |
| 5 | Compute intersection | `turf.intersect(featureCollection_a, featureCollection_b)` |
| 6 | Handle result types | May return `null`, `Polygon`, `MultiPolygon`, or `GeometryCollection` |
| 7 | If no intersection → show "No overlap found" | Handle `null` gracefully |
| 8 | If MultiPolygon/GeometryCollection → extract all pieces | `turf.flatten()` again if needed |
| 9 | Store as array of polygons | `intersectionZones: Feature[]` |
| 10 | Fade original polygons | Update layer opacity to 0.1 |
| 11 | Render EACH intersection zone | Same bright color, or label them "Zone A", "Zone B" |
| 12 | Calculate total area | `zones.reduce((sum, z) => sum + turf.area(z), 0)` |
| 13 | Fit map to all intersection bounds | Combined bbox |

**📋 TEST INPUT (copy-paste):**
```json
{
  "polygon_a": {
    "type": "Polygon",
    "description": "20-min walk isochrone from Shoreditch",
    "center": { "name": "Shoreditch", "lat": 51.5246, "lng": -0.0777 },
    "coordinates": [[
      [-0.0977, 51.5146], [-0.0877, 51.5096], [-0.0727, 51.5096], [-0.0577, 51.5146],
      [-0.0527, 51.5246], [-0.0527, 51.5346], [-0.0577, 51.5396], [-0.0727, 51.5446],
      [-0.0877, 51.5446], [-0.0977, 51.5396], [-0.1027, 51.5296], [-0.1027, 51.5196],
      [-0.0977, 51.5146]
    ]]
  },
  "polygon_b": {
    "type": "Polygon",
    "description": "20-min walk isochrone from Camden",
    "center": { "name": "Camden", "lat": 51.5390, "lng": -0.1426 },
    "coordinates": [[
      [-0.1626, 51.5290], [-0.1526, 51.5240], [-0.1376, 51.5240], [-0.1226, 51.5290],
      [-0.1176, 51.5390], [-0.1176, 51.5490], [-0.1226, 51.5540], [-0.1376, 51.5590],
      [-0.1526, 51.5590], [-0.1626, 51.5540], [-0.1676, 51.5440], [-0.1676, 51.5340],
      [-0.1626, 51.5290]
    ]]
  }
}
```

**Expected output:**
- Original polygons faded (blue for Shoreditch, red for Camden)
- Intersection zone highlighted in bright green
- Label: "1 fair zone found (0.45 km²)"
- Area around Angel/Islington where both can walk to

---

### Test 5.4 - Identify neighborhoods in a polygon

| | |
|---|---|
| **Input** | GeoJSON polygon coordinates (the intersection zone) |
| **Output** | List of neighborhood names + circles inside the zone |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can identify which neighborhoods fall within bounds |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take intersection polygon + city name | Input from Test 5.3 |
| 2 | Calculate bounding box | `turf.bbox(polygon)` → `[minLng, minLat, maxLng, maxLat]` |
| 3 | Calculate centroid | `turf.centroid(polygon)` → `[lng, lat]` |
| 4 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 5 | Prompt: "In {city}, what neighborhoods fall within these bounds: SW corner ({minLat}, {minLng}), NE corner ({maxLat}, {maxLng})? Return JSON array with `name`, `lat`, `lng` for each neighborhood" | Structured output prompt |
| 6 | Parse JSON response | `JSON.parse()` |
| 7 | Filter: only keep points inside polygon | `turf.booleanPointInPolygon([lng, lat], polygon)` |
| 8 | Render circles inside zone | Call Shared.1 for filtered neighborhoods |

**📋 TEST INPUT (copy-paste):**
```json
{
  "zone": {
    "type": "Polygon",
    "description": "Intersection zone between Shoreditch and Camden 20-min walks",
    "boundingBox": {
      "sw": { "lat": 51.5240, "lng": -0.1176 },
      "ne": { "lat": 51.5446, "lng": -0.0877 }
    },
    "coordinates": [[
      [-0.1100, 51.5280], [-0.1000, 51.5250], [-0.0920, 51.5280],
      [-0.0880, 51.5350], [-0.0900, 51.5420], [-0.0980, 51.5450],
      [-0.1080, 51.5440], [-0.1150, 51.5380], [-0.1160, 51.5320],
      [-0.1100, 51.5280]
    ]],
    "areaSqKm": 0.45
  },
  "city": "London",
  "context": "Fair meeting zone for two people - one from Shoreditch, one from Camden"
}
```

**Expected output:**
```
Neighborhoods in fair zone:
• Angel (51.5362, -0.1058)
• Clerkenwell (51.5226, -0.1036)
• Kings Cross (51.5308, -0.1238)
[3 orange circles drawn inside the green intersection zone]
```

---

### Test 5.5 - Multi-polygon fair zone with distinct areas

| | |
|---|---|
| **Input** | Two locations that create discontinuous intersection (river, park between) |
| **Output** | Multiple fair zones: one covering several neighborhoods, another just one |
| **API** | Mapbox Isochrone + Turf.js |
| **Cost** | ~$0.002 |
| **Proves** | System handles discontinuous fair zones gracefully |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two locations in city with natural barriers | e.g., "Westminster" + "Southwark" (River Thames) |
| 2 | Generate isochrones for both | Mapbox Isochrone API |
| 3 | Compute intersection | Turf.js (same as 5.3) |
| 4 | Expect: 2+ separate polygons | One larger (bridges/tunnels area), one smaller |
| 5 | For each zone, calculate area | `turf.area(zone)` |
| 6 | Label zones by size | "Zone A (large)" vs "Zone B (small)" |
| 7 | For each zone, run Test 5.4 | Identify neighborhoods in each zone |
| 8 | Display zones with distinct borders | Solid vs dashed, or different shades |
| 9 | Show summary | "Zone A: 3 neighborhoods" + "Zone B: 1 neighborhood" |
| 10 | User can click each zone to see details | Separate info cards |

**📋 TEST INPUT (copy-paste):**
```
Westminster, London | Southwark, London | walking | 15 min
```

**Expected output:**
```
Map shows:
- 2 distinct green intersection zones

Zone A (near bridges): 0.6 km²
- Waterloo
- South Bank  
- Embankment

Zone B (isolated): 0.15 km²
- Borough
  (reachable via London Bridge only)

Card: "2 fair zones found"
      [Zone A] [Zone B] ← clickable tabs
```

---

## Scenario 6: Areas to Explore Together

### Test 6.1 - Generate multi-modal isochrones for one person

| | |
|---|---|
| **Input** | Coordinates + 3 modes (walk, transit, drive @ 30min each) |
| **Output** | 3 overlapping polygons on map (different colors per mode) |
| **API** | Geoapify Isoline (3 calls) |
| **Cost** | $0.015 |
| **Proves** | We can show travel options from one origin |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take coordinates + modes array + minutes | Input from UI or hardcoded |
| 2 | Define color map | `{ walk: '#22c55e', transit: '#3b82f6', drive: '#a855f7' }` |
| 3 | For each mode, call Geoapify Isoline (parallel) | `Promise.all(modes.map(mode => fetch(geoapifyUrl)))` |
| 4 | Parse all responses | Extract GeoJSON polygons |
| 5 | Store all polygons for later intersection | Keep in state as `{ walk: polygon, transit: polygon, drive: polygon }` |
| 6 | Add layers in order: drive (bottom), transit, walk (top) | Larger polygons behind smaller |
| 7 | Add legend showing mode colors | Render in UI corner |

**📋 TEST INPUT (copy-paste):**
```
40.6782, -73.9442 | walk, transit, drive | 30 min
```

**Expected output:**
- 🟢 Walk polygon (smallest)
- 🔵 Transit polygon (medium)
- 🟣 Drive polygon (largest)

---

### Test 6.2 - Interactive matrix with hover-to-show intersections

| | |
|---|---|
| **Input** | 6 isochrones (3 per person) as GeoJSON |
| **Output** | 3×3 matrix in card; hover shows blended-color intersection on map |
| **API** | Turf.js (local) |
| **Cost** | FREE |
| **Proves** | Interactive exploration of transport combinations |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take 6 polygon GeoJSONs (3 per person) | Input from Test 6.1 (run twice) |
| 2 | Import Turf.js | `import * as turf from '@turf/turf'` |
| 3 | Define mode colors | `{ walk: '#3b82f6' (blue), transit: '#22c55e' (green), drive: '#eab308' (yellow) }` |
| 4 | Render all 6 isochrones VERY FAINTLY on map | `opacity: 0.08`, subtle presence |
| 5 | Create all 9 combinations | `modes.flatMap(a => modes.map(b => [a, b]))` |
| 6 | For each combo, compute intersection | `turf.intersect(person_a[modeA], person_b[modeB])` |
| 7 | Calculate blended color for each combo | `blendColors(colorA, colorB)` |
| 8 | Calculate area of each intersection | `turf.area(intersection)` |
| 9 | Categorize size | `✗` (none), `S`, `M`, `L`, `XL` |
| 10 | Render 3×3 matrix card bottom-right | Cells show size labels |
| 11 | On HOVER over cell → show that intersection on map | Bright blended color, opacity 0.5 |
| 12 | On hover out → hide intersection | Return to faint isochrones only |
| 13 | On CLICK cell → lock intersection, trigger 5.4 | Show neighborhoods |

**Color blending rules:**
```
Person A    Person B    Blended Result
─────────   ─────────   ──────────────
Walk (blue) + Walk (blue)     = Blue (#3b82f6)
Walk (blue) + Transit (green) = Teal (#22d3ee)
Walk (blue) + Drive (yellow)  = Green (#22c55e)
Transit     + Transit         = Green (#22c55e)
Transit     + Drive           = Lime (#84cc16)
Drive       + Drive           = Yellow (#eab308)
```

**📋 TEST INPUT (copy-paste):**
```json
{
  "personA": {
    "name": "Brooklyn (Williamsburg)",
    "location": { "lat": 40.7081, "lng": -73.9571 },
    "isochrones": {
      "walk": { "areaSqKm": 3.2, "color": "#3b82f6" },
      "transit": { "areaSqKm": 45.0, "color": "#22c55e" },
      "drive": { "areaSqKm": 180.0, "color": "#eab308" }
    }
  },
  "personB": {
    "name": "Manhattan (Midtown)",
    "location": { "lat": 40.7549, "lng": -73.9840 },
    "isochrones": {
      "walk": { "areaSqKm": 3.5, "color": "#3b82f6" },
      "transit": { "areaSqKm": 52.0, "color": "#22c55e" },
      "drive": { "areaSqKm": 195.0, "color": "#eab308" }
    }
  },
  "precomputedIntersections": [
    { "a": "walk", "b": "walk", "areaSqKm": 0, "sizeLabel": "✗", "neighborhoods": [] },
    { "a": "walk", "b": "transit", "areaSqKm": 1.8, "sizeLabel": "S", "neighborhoods": ["Lower East Side"] },
    { "a": "walk", "b": "drive", "areaSqKm": 3.2, "sizeLabel": "M", "neighborhoods": ["Lower East Side", "East Village"] },
    { "a": "transit", "b": "walk", "areaSqKm": 2.1, "sizeLabel": "S", "neighborhoods": ["SoHo"] },
    { "a": "transit", "b": "transit", "areaSqKm": 28.5, "sizeLabel": "L", "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square"] },
    { "a": "transit", "b": "drive", "areaSqKm": 45.0, "sizeLabel": "L", "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square", "Flatiron", "Gramercy"] },
    { "a": "drive", "b": "walk", "areaSqKm": 3.5, "sizeLabel": "M", "neighborhoods": ["Midtown", "Times Square"] },
    { "a": "drive", "b": "transit", "areaSqKm": 52.0, "sizeLabel": "L", "neighborhoods": ["Midtown", "Times Square", "Hell's Kitchen", "Upper West Side", "Upper East Side"] },
    { "a": "drive", "b": "drive", "areaSqKm": 125.0, "sizeLabel": "XL", "neighborhoods": ["Midtown", "Times Square", "Hell's Kitchen", "Upper West Side", "Upper East Side", "Harlem", "Bronx South"] }
  ],
  "travelTime": 30,
  "travelUnit": "minutes"
}
```

**Expected output:**
```
Map: 6 very faint isochrone outlines (3 per person)

Card (bottom-right):
┌───────────────────────────────────────────────────┐
│                Person B (Midtown)                 │
│              Walk    Transit    Drive             │
│ Person A   ───────────────────────────            │
│ (Brooklyn)                                        │
│    Walk      ✗        S         M                 │
│    Transit   S        L         L                 │ ← hover to see
│    Drive     M        L         XL                │   on map
└───────────────────────────────────────────────────┘

On hover "Transit-Transit" (L):
- Map shows GREEN intersection polygon (green + green = green)
- Shows: SoHo, NoHo, West Village, Chelsea, Union Square
- Area: 28.5 km²

On hover "Walk-Drive" (M):
- Map shows TEAL intersection polygon (blue + yellow = green)
- Shows: Lower East Side, East Village
- Area: 3.2 km²
```

---

### Test 6.3 - AI reasons about best intersections based on preferences

| | |
|---|---|
| **Input** | 9 intersection polygons + user transport preferences |
| **Output** | Top 3 recommended combinations with rationale |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can reason about transport trade-offs to pick best options |

**Note:** This test is a compound exercise combining:
- Test 5.4 (identify neighborhoods in intersection polygons)
- Test 1.2 (itinerary for each area)

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take 9 intersections with areas calculated | From Test 6.2 |
| 2 | Ask user transport preferences | UI: "How do you prefer to travel?" |
| 3 | Collect: Person A preference, Person B preference | Dropdowns or chat: walk/transit/drive |
| 4 | Build context for AI | Each combo: modes, area size, neighborhoods |
| 5 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 6 | Prompt: "Given 9 transport combinations and their intersection sizes, Person A prefers {X}, Person B prefers {Y}. Which 3 combos are best? Consider: preference alignment, area size, fairness. Return JSON `{ top3: [{ personAMode, personBMode, reason }] }`" | |
| 7 | Parse response | `JSON.parse()` |
| 8 | Highlight top 3 on map | Different styling (thicker border) |
| 9 | Show rationale cards | "This works because..." |
| 10 | For selected combo → run 5.4 + 1.2 | Identify neighborhoods + generate itinerary |

**📋 TEST INPUT (copy-paste):**
```json
{
  "personA": {
    "name": "Sarah",
    "location": "Brooklyn (Williamsburg)",
    "preference": "transit",
    "notes": "Doesn't have a car, prefers subway"
  },
  "personB": {
    "name": "Mike", 
    "location": "Manhattan (Midtown)",
    "preference": "walking",
    "notes": "Lives close to work, likes to walk everywhere"
  },
  "intersections": [
    { "a": "walk", "b": "walk", "areaSqKm": 0, "viable": false },
    { "a": "walk", "b": "transit", "areaSqKm": 1.8, "neighborhoods": ["Lower East Side"], "viable": true },
    { "a": "walk", "b": "drive", "areaSqKm": 3.2, "neighborhoods": ["Lower East Side", "East Village"], "viable": true },
    { "a": "transit", "b": "walk", "areaSqKm": 2.1, "neighborhoods": ["SoHo"], "viable": true },
    { "a": "transit", "b": "transit", "areaSqKm": 28.5, "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square"], "viable": true },
    { "a": "transit", "b": "drive", "areaSqKm": 45.0, "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square", "Flatiron"], "viable": true },
    { "a": "drive", "b": "walk", "areaSqKm": 3.5, "neighborhoods": ["Midtown", "Times Square"], "viable": false, "reason": "Sarah doesn't drive" },
    { "a": "drive", "b": "transit", "areaSqKm": 52.0, "neighborhoods": ["Midtown", "Hell's Kitchen"], "viable": false, "reason": "Sarah doesn't drive" },
    { "a": "drive", "b": "drive", "areaSqKm": 125.0, "neighborhoods": ["Wide area"], "viable": false, "reason": "Neither prefers driving" }
  ],
  "question": "Which 3 transport combinations work best for Sarah and Mike?"
}
```

**Expected output:**
```
🏆 Top 3 Recommendations for Sarah & Mike:

1. Sarah: Transit | Mike: Walk
   ✅ "Perfect match! Sarah takes the L train, Mike walks from Midtown. 
       Meet in SoHo - 2.1 km² of options."
   Neighborhoods: SoHo
   
2. Sarah: Transit | Mike: Transit  
   ✅ "Largest overlap (28.5 km²) - both hop on the subway.
       Tons of options from West Village to Union Square."
   Neighborhoods: SoHo, NoHo, West Village, Chelsea, Union Square
   
3. Sarah: Walk | Mike: Transit
   ⚠️ "Workable but Sarah walks more than she'd prefer.
       Limited to Lower East Side (1.8 km²)."
   Neighborhoods: Lower East Side

[Top 3 highlighted on map with numbered badges: 1️⃣ 2️⃣ 3️⃣]
```

---

### Test 6.4 - Get Directions for active area

| | |
|---|---|
| **Input** | Active intersection centroid + Person A location + Person B location |
| **Output** | "Get Directions" button → menu → opens Google Maps |
| **API** | None (URL construction) |
| **Cost** | FREE |
| **Proves** | Seamless handoff to navigation apps |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take active intersection polygon | From 6.2 or 6.3 |
| 2 | Calculate centroid | `turf.centroid(intersection)` |
| 3 | Have Person A and Person B locations | From Test 5.1 (geocoded) |
| 4 | Show "Get Directions" button on active card | Prominent button |
| 5 | On click → show menu | "For Person A" / "For Person B" |
| 6 | On selection → build Google Maps URL | Origin = person location, Dest = centroid |
| 7 | URL format | `https://www.google.com/maps/dir/{origin_lat},{origin_lng}/{dest_lat},{dest_lng}` |
| 8 | Open in new tab | `window.open(url, '_blank')` |

**📋 TEST INPUT (copy-paste):**
```
Active area: Angel, London [51.5362, -0.1058]
Person A: Shoreditch [51.5246, -0.0777]
Person B: Camden [51.5390, -0.1426]
```

**Expected output:**
```
Card shows:
┌─────────────────────────────────────┐
│ Angel Area                          │
│ 3 neighborhoods to explore          │
│                                     │
│ [🗺️ Get Directions]                 │
└─────────────────────────────────────┘

On click "Get Directions":
┌─────────────────────────────────────┐
│ Navigate to Angel from:             │
│                                     │
│ [👤 Person A (Shoreditch)]          │
│ [👤 Person B (Camden)]              │
└─────────────────────────────────────┘

Click "Person A" → opens:
https://www.google.com/maps/dir/51.5246,-0.0777/51.5362,-0.1058
```

---

## Scenario 7: Multi-Stop Route

### Test 7.1 - City character analysis (areas overview)

| | |
|---|---|
| **Input** | City name |
| **Output** | Map centered on city, circles for all notable areas, cards with specific/area mix per area |
| **API** | Gemini 2.5 Pro + grounding |
| **Cost** | ~$0.005 |
| **Proves** | AI understands city geography and area characters |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take city name | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt: "For {city}, identify 8-10 distinct areas visitors might explore. For each: name, coordinates, character description, and what % of visits there would be SPECIFIC PLACES (restaurants, landmarks) vs AREAS to wander. Return JSON array with `name`, `lat`, `lng`, `character`, `specificPercent`, `areaPercent`" | |
| 4 | Parse response | `JSON.parse()` |
| 5 | Render circles for all areas on map | Color-code by character type |
| 6 | Fit map to show all areas | `map.fitBounds()` |
| 7 | In each area's card, show | Character + "Mix: 70% specific / 30% explore" |
| 8 | Clicking area shows its character detail | Info card with mix breakdown |

**📋 TEST INPUT (copy-paste):**
```
Dublin
```

**Expected output:**
```
Map: 8 colored circles across Dublin

Cards for each area:
┌─────────────────────────────────────┐
│ Temple Bar                          │
│ "Tourist hub, lively pubs"          │
│ Mix: 80% specific / 20% explore     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Georgian Quarter                    │
│ "Historic streets, architecture"    │
│ Mix: 30% specific / 70% explore     │
└─────────────────────────────────────┘
```

---

### Test 7.2 - Chat to understand user preferences

| | |
|---|---|
| **Input** | City name (from 7.1) |
| **Output** | Conversational flow collecting vibe, interests, pace |
| **API** | Gemini 2.5 Flash (conversational) |
| **Cost** | ~$0.003 |
| **Proves** | AI can have natural preference-gathering conversation |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | User has seen city areas (7.1) | Context established |
| 2 | AI opens conversation | "What kind of day are you imagining? Lively pubs, cultural sites, local hidden gems?" |
| 3 | User responds | Free text |
| 4 | AI asks follow-up | "Are you more 'tick off the highlights' or 'wander and discover'?" |
| 5 | Continue 2-3 turns | Gather: vibe, interests, pace |
| 6 | AI summarizes | "Got it: pub-focused with some history, relaxed pace" |
| 7 | Store preferences | `{ vibe, interests, pace, impliedMix }` |

**📋 TEST CONVERSATION (respond to AI prompts):**

**Your response 1:**
```
Definitely want to hit some classic pubs, but also see some history
```

**Your response 2:**
```
More relaxed, we have my dad with us
```

**Your response 3:**
```
Would love to see Trinity College
```

**Expected AI summary:**
```
✨ Got it! Here's what I'm hearing:
• Pub-focused with history mixed in
• Relaxed pace (dad-friendly)
• Trinity College is a must
Ready to talk logistics?
```

---

### Test 7.3 - Chat to understand logistics & constraints

| | |
|---|---|
| **Input** | Preferences from 7.2 |
| **Output** | Conversational flow collecting timing, people, constraints |
| **API** | Gemini 2.5 Flash (conversational) |
| **Cost** | ~$0.003 |
| **Proves** | AI handles complex constraint gathering gracefully |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | AI asks timing | "What time are you starting, and when do you need to wrap up?" |
| 2 | User responds | "Starting at 11am, want to be done by 10pm" |
| 3 | AI asks about group | "How many people? Any accessibility needs or quirks?" |
| 4 | User responds | "4 people - dad needs a siesta around 3pm, friend in wheelchair" |
| 5 | AI confirms constraints | "So: wheelchair accessible venues, 2-hour break ~3pm. Anything else?" |
| 6 | User confirms or adds | "That's it!" |
| 7 | AI announces ready | "✅ I have everything! Here's what I'm working with: [summary]" |
| 8 | Store logistics | `{ startTime, endTime, people, constraints: [...] }` |

**📋 TEST CONVERSATION (respond to AI prompts):**

**Your response 1:**
```
Probably around 11am, need to finish by 10pm for the last bus
```

**Your response 2:**
```
4 of us - me, my partner, my dad, and a friend. Dad usually needs a siesta around 3pm, and my friend uses a wheelchair
```

**Your response 3:**
```
Nope, that's everything
```

**Expected AI summary:**
```
✅ Perfect, I have everything I need!

📋 Planning for:
• 4 people, 11am - 10pm
• Pubs + history, relaxed pace
• Trinity College must-see
• Wheelchair accessible
• Siesta break 3-5pm

Let me work out some options...
```

---

### Test 7.4 - Compute route combinations with matrix

| | |
|---|---|
| **Input** | Areas (from 7.1) + preferences + logistics |
| **Output** | All route combinations with cards + multi-stop directions on map |
| **API** | Mapbox Matrix + Directions |
| **Cost** | ~$0.02 |
| **Proves** | Matrix computation works for multi-stop planning |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Filter areas matching preferences | From 7.1, keep relevant areas |
| 2 | Get coordinates for 4-6 candidate areas | |
| 3 | Call Mapbox Matrix API | `GET .../directions-matrix/v1/mapbox/{mode}/{coords}` |
| 4 | Parse durations matrix | 2D array in seconds |
| 5 | Generate candidate permutations | Different orderings of stops |
| 6 | For each permutation, calculate total time | Sum matrix values along route |
| 7 | Display all combinations as cards | "Option A: 4.5 hours" |
| 8 | On hover/click → show route on map | Mapbox Directions polyline |
| 9 | Show per-segment times | "Stop 1 → Stop 2: 12 min" |

**📋 TEST INPUT (copy-paste):**
```json
{
  "areas": ["Temple Bar", "Trinity College", "Georgian Quarter", "Guinness Storehouse"],
  "mode": "walking",
  "preferences": { "pace": "relaxed", "mustSee": ["Trinity College"] }
}
```

**Expected output:**
```
Option A: Trinity → Temple Bar → Georgian → Guinness
         Total: 4.2 hours walking

Option B: Trinity → Georgian → Temple Bar → Guinness
         Total: 3.8 hours walking

Option C: Guinness → Temple Bar → Trinity → Georgian
         Total: 4.5 hours walking

[Click any option to see route on map]
```

---

### Test 7.5 - Insert stops based on constraints

| | |
|---|---|
| **Input** | Route combinations + constraints (siesta, wheelchair, etc.) |
| **Output** | Modified routes with inserted breaks, labeled by fit to time window |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.01 |
| **Proves** | AI can adapt routes to real-world constraints |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take combinations from 7.4 + constraints from 7.3 | |
| 2 | For each combination, AI determines where to insert breaks | "Insert 2hr break after stop 2 for siesta" |
| 3 | Filter venues for accessibility | Check wheelchair accessible |
| 4 | Recalculate timing with breaks | Add break duration to route |
| 5 | Compare end time to target | `delta = actualEnd - targetEnd` |
| 6 | Label each option | "⏱️ 15 min under" or "⚠️ 45 min over" |
| 7 | Color code | Green (under), yellow (close ±30min), red (over) |
| 8 | Display all options with timing labels | |
| 9 | For each option, show stops with arrows | Navigate between stops in card |
| 10 | Separate card for option description | Navigate between options |

**📋 TEST INPUT (copy-paste):**
```json
{
  "routeOptions": [
    {
      "id": "A",
      "name": "Trinity First",
      "stops": [
        { 
          "order": 1, 
          "name": "Trinity College", 
          "type": "attraction",
          "lat": 53.3438, "lng": -6.2546,
          "arrival": "11:00", 
          "departure": "12:30", 
          "duration": "1h 30min",
          "wheelchairAccessible": true,
          "walkFromPrevious": null
        },
        { 
          "order": 2, 
          "name": "Temple Bar lunch", 
          "type": "food",
          "lat": 53.3454, "lng": -6.2644,
          "arrival": "12:45", 
          "departure": "14:30", 
          "duration": "1h 45min",
          "wheelchairAccessible": true,
          "walkFromPrevious": "15 min (800m)"
        },
        { 
          "order": 3, 
          "name": "SIESTA BREAK", 
          "type": "break",
          "lat": null, "lng": null,
          "arrival": "15:00", 
          "departure": "17:00", 
          "duration": "2h",
          "note": "Rest at hotel or café"
        },
        { 
          "order": 4, 
          "name": "Georgian Quarter", 
          "type": "explore",
          "lat": 53.3382, "lng": -6.2591,
          "arrival": "17:15", 
          "departure": "19:00", 
          "duration": "1h 45min",
          "wheelchairAccessible": true,
          "walkFromPrevious": "15 min (750m)"
        },
        { 
          "order": 5, 
          "name": "Guinness Storehouse", 
          "type": "attraction",
          "lat": 53.3419, "lng": -6.2867,
          "arrival": "19:30", 
          "departure": "21:35", 
          "duration": "2h 05min",
          "wheelchairAccessible": true,
          "walkFromPrevious": "30 min (1.5km)"
        }
      ],
      "totals": {
        "walkingTime": "60 min",
        "walkingDistance": "3.05 km",
        "finishTime": "21:35",
        "targetEndTime": "22:00",
        "delta": "-25 min",
        "status": "under"
      }
    },
    {
      "id": "B", 
      "name": "Guinness First",
      "stops": [
        { "order": 1, "name": "Guinness Storehouse", "arrival": "11:00", "departure": "13:30", "duration": "2h 30min", "wheelchairAccessible": true },
        { "order": 2, "name": "Temple Bar lunch", "arrival": "14:00", "departure": "15:00", "duration": "1h", "wheelchairAccessible": true, "walkFromPrevious": "25 min" },
        { "order": 3, "name": "SIESTA BREAK", "arrival": "15:00", "departure": "17:00", "duration": "2h" },
        { "order": 4, "name": "Trinity College", "arrival": "17:20", "departure": "18:50", "duration": "1h 30min", "wheelchairAccessible": true, "walkFromPrevious": "20 min" },
        { "order": 5, "name": "Georgian Quarter", "arrival": "19:05", "departure": "21:50", "duration": "2h 45min", "wheelchairAccessible": true, "walkFromPrevious": "15 min" }
      ],
      "totals": { "walkingTime": "60 min", "finishTime": "21:50", "targetEndTime": "22:00", "delta": "-10 min", "status": "under" }
    },
    {
      "id": "C",
      "name": "Cultural Focus",
      "stops": [
        { "order": 1, "name": "Trinity College", "arrival": "11:00", "departure": "13:00", "duration": "2h", "wheelchairAccessible": true },
        { "order": 2, "name": "National Museum", "arrival": "13:15", "departure": "15:00", "duration": "1h 45min", "wheelchairAccessible": true, "walkFromPrevious": "15 min" },
        { "order": 3, "name": "SIESTA BREAK", "arrival": "15:00", "departure": "17:00", "duration": "2h" },
        { "order": 4, "name": "Georgian Quarter", "arrival": "17:15", "departure": "19:00", "duration": "1h 45min", "wheelchairAccessible": true },
        { "order": 5, "name": "Temple Bar pubs", "arrival": "19:20", "departure": "22:35", "duration": "3h 15min", "wheelchairAccessible": true, "walkFromPrevious": "20 min" }
      ],
      "totals": { "walkingTime": "50 min", "finishTime": "22:35", "targetEndTime": "22:00", "delta": "+35 min", "status": "over" }
    }
  ],
  "constraints": {
    "startTime": "11:00",
    "targetEndTime": "22:00",
    "siestaRequired": { "around": "15:00", "duration": "2h", "for": "Dad" },
    "wheelchairRequired": { "for": "Friend", "allVenuesMustBeAccessible": true },
    "groupSize": 4,
    "pace": "relaxed"
  },
  "preferences": {
    "focus": ["pubs", "history"],
    "mustSee": ["Trinity College"]
  }
}
```

**Expected output:**
```
┌─────────────────────────────────────────────────────────────┐
│ Option A: Trinity First                                     │
│ ✅ 25 min UNDER target (finishes 21:35)                     │
├─────────────────────────────────────────────────────────────┤
│ 1. 🏛️ Trinity College      11:00-12:30  (1h30m)  ♿         │
│    ↓ 15 min walk                                            │
│ 2. 🍽️ Temple Bar lunch     12:45-14:30  (1h45m)  ♿         │
│    ↓ transit to hotel                                       │
│ 3. 🛏️ SIESTA BREAK         15:00-17:00  (2h)     Dad       │
│    ↓ 15 min walk                                            │
│ 4. 🚶 Georgian Quarter     17:15-19:00  (1h45m)  ♿         │
│    ↓ 30 min walk                                            │
│ 5. 🍺 Guinness Storehouse  19:30-21:35  (2h05m)  ♿         │
├─────────────────────────────────────────────────────────────┤
│ Total walking: 60 min (3.05 km)                             │
│ [← Prev Option]     Option 1 of 3     [Next Option →]       │
└─────────────────────────────────────────────────────────────┘

Timing labels across options:
• Option A: ✅ 25 min under
• Option B: ✅ 10 min under  
• Option C: ⚠️ 35 min over
```

---

### Test 7.6 - AI chooses best option(s) with rationale

| | |
|---|---|
| **Input** | All evaluated combinations from 7.5 |
| **Output** | Top 1-3 options with clear rationale |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can make final recommendation with explanation |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take all options with timing evaluations | |
| 2 | Send to Gemini | |
| 3 | Prompt: "Given options, preferences {X}, constraints {Y}, which 1-3 are best? Return JSON `{ recommendations: [{ optionId, rationale }] }`" | |
| 4 | Parse response | |
| 5 | Fade or hide non-recommended options | |
| 6 | Display recommended options prominently | |
| 7 | Show rationale under each | "Best because..." |

**📋 TEST INPUT (copy-paste):**
```json
{
  "evaluatedOptions": [
    {
      "id": "A",
      "name": "Trinity First",
      "route": "Trinity → Temple Bar lunch → SIESTA → Georgian Quarter → Guinness",
      "finishTime": "21:35",
      "delta": "-25 min",
      "status": "under",
      "highlights": ["Trinity College (must-see ✓)", "Ends at Guinness (easy transport home)"],
      "concerns": [],
      "allAccessible": true,
      "siestaFits": true,
      "totalWalking": "60 min"
    },
    {
      "id": "B",
      "name": "Guinness First",
      "route": "Guinness → Temple Bar lunch → SIESTA → Trinity → Georgian Quarter",
      "finishTime": "21:50",
      "delta": "-10 min",
      "status": "under",
      "highlights": ["Beat crowds at Guinness (opens 9:30am)", "Trinity in golden hour light"],
      "concerns": ["Tight buffer if delays"],
      "allAccessible": true,
      "siestaFits": true,
      "totalWalking": "60 min"
    },
    {
      "id": "C",
      "name": "Cultural Focus",
      "route": "Trinity → National Museum → SIESTA → Georgian Quarter → Temple Bar pubs",
      "finishTime": "22:35",
      "delta": "+35 min",
      "status": "over",
      "highlights": ["More history/culture", "Ends in pub area"],
      "concerns": ["35 min over target", "Might rush last stop", "Dad might be tired"],
      "allAccessible": true,
      "siestaFits": true,
      "totalWalking": "50 min"
    },
    {
      "id": "D",
      "name": "Pub Crawl Heavy",
      "route": "Temple Bar → Brazen Head → SIESTA → Guinness → Stag's Head → Kehoe's",
      "finishTime": "23:15",
      "delta": "+75 min",
      "status": "over",
      "highlights": ["Maximum pub time", "Historic pubs"],
      "concerns": ["Way over target (75 min)", "Skips Trinity (must-see!)", "Too much for Dad"],
      "allAccessible": false,
      "siestaFits": false,
      "totalWalking": "45 min"
    }
  ],
  "constraints": {
    "targetEndTime": "22:00",
    "mustSee": ["Trinity College"],
    "wheelchairRequired": true,
    "siestaRequired": true,
    "pace": "relaxed"
  },
  "groupContext": "4 people: couple, Dad (needs siesta), friend (wheelchair)"
}
```

**Expected output:**
```
🏆 Top Pick: Option A - Trinity First

"This is your best bet because:
• ⏱️ Finishes 25 min early - buffer for bathroom breaks, photos, Dad resting
• 🏛️ Trinity College first thing when everyone's fresh
• 🛏️ Siesta (3-5pm) fits perfectly after lunch
• ♿ All 5 venues wheelchair accessible for your friend
• 🍺 Ends at Guinness - easy to grab taxi/bus back from there
• ✅ Hits your must-see (Trinity) without rushing"

🥈 Also Good: Option B - Guinness First

"Solid backup:
• Beat the Guinness crowds (opens 9:30am, gets busy by noon)
• See Trinity in beautiful late afternoon light
• ⚠️ Only 10 min buffer though - if anything runs late, you're cutting it close"

❌ Not Recommended:
• Option C: 35 min over target - Dad will be exhausted
• Option D: Skips Trinity entirely + not wheelchair accessible

[Option A highlighted prominently on map, Option B shown as secondary]
```

---

### Test 7.7 - Two-stop directions with Google Maps handoff

| | |
|---|---|
| **Input** | Two stops (origin + destination) |
| **Output** | Directions on map + "Get Directions" → Google Maps |
| **API** | Mapbox Directions |
| **Cost** | ~$0.002 |
| **Proves** | Single-segment navigation handoff works |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two stop coordinates | Input or from selected route |
| 2 | Get Mapbox directions | Display polyline on map |
| 3 | Show duration/distance | "12 min walk, 950m" |
| 4 | Show "Get Directions" button | |
| 5 | On click → open Google Maps | `https://www.google.com/maps/dir/{lat1},{lng1}/{lat2},{lng2}` |

**📋 TEST INPUT (copy-paste):**
```
Trinity College, Dublin [53.3438, -6.2546] → Temple Bar, Dublin [53.3454, -6.2644]
```

**Expected output:**
```
Map: Blue route line Trinity → Temple Bar

Card:
┌─────────────────────────────────────┐
│ Trinity College → Temple Bar        │
│ 8 min walk (650m)                   │
│                                     │
│ [🗺️ Get Directions]                 │
└─────────────────────────────────────┘

Click → opens Google Maps with route
```

---

### Test 7.8 - Multi-stop directions with Google Maps handoff

| | |
|---|---|
| **Input** | Array of 3+ stops |
| **Output** | Full route on map + "Get Directions" → Google Maps multi-stop |
| **API** | Mapbox Directions |
| **Cost** | ~$0.01 |
| **Proves** | Full route navigation handoff works |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take array of stop coordinates | From chosen option |
| 2 | Get Mapbox directions with waypoints | Full route geometry |
| 3 | Display polyline on map | |
| 4 | Label each stop with number | Markers: ①, ②, ③, ④, ⑤ |
| 5 | Show total time and breakdown | "Total: 45 min | 8+12+15+10 min" |
| 6 | Show "Get Directions" button | |
| 7 | Build Google Maps multi-stop URL | `https://www.google.com/maps/dir/{stop1}/{stop2}/{stop3}/...` |
| 8 | Open in new tab | |

**📋 TEST INPUT (copy-paste):**
```
Trinity College [53.3438, -6.2546] → Temple Bar [53.3454, -6.2644] → Guinness [53.3419, -6.2867] → Phoenix Park [53.3559, -6.3298]
```

**Expected output:**
```
Map: Route line through all 4 stops with numbered markers

Card:
┌─────────────────────────────────────────────────┐
│ Your Route (4 stops)                            │
│                                                 │
│ ① Trinity → ② Temple Bar      8 min            │
│ ② Temple Bar → ③ Guinness     15 min           │
│ ③ Guinness → ④ Phoenix Park   20 min           │
│                                                 │
│ Total: 43 min walking                           │
│                                                 │
│ [🗺️ Get Directions in Google Maps]              │
└─────────────────────────────────────────────────┘

Click → opens:
https://www.google.com/maps/dir/53.3438,-6.2546/53.3454,-6.2644/53.3419,-6.2867/53.3559,-6.3298
```

---

## Shared Building Blocks

Used across multiple scenarios:

### Shared.1 - Render vibe circles on map

| | |
|---|---|
| **Input** | Array of areas with name, lat, lng, radius, color |
| **Output** | Colored circles on Mapbox, clickable |
| **API** | Mapbox GL (already loaded) |
| **Cost** | Included in map load |
| **Proves** | Core map visualization works |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take array of area objects | Input from any area-generating test |
| 2 | Convert to GeoJSON FeatureCollection | `{ type: 'FeatureCollection', features: areas.map(a => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: { name: a.name, color: a.color } })) }` |
| 3 | Add source to map | `map.addSource('vibe-areas', { type: 'geojson', data: geojson })` |
| 4 | Add circle layer | `map.addLayer({ id: 'vibe-circles', type: 'circle', source: 'vibe-areas', paint: { 'circle-radius': 40, 'circle-color': ['get', 'color'], 'circle-opacity': 0.6 } })` |
| 5 | Add click handler | `map.on('click', 'vibe-circles', (e) => { setCurrentArea(e.features[0].properties) })` |
| 6 | Add hover cursor | `map.on('mouseenter', 'vibe-circles', () => map.getCanvas().style.cursor = 'pointer')` |

**📋 TEST INPUT (copy-paste):**
```json
[
  { "name": "El Born", "lat": 41.3851, "lng": 2.1816, "color": "#f97316", "why": "Best nightlife" },
  { "name": "Gràcia", "lat": 41.4036, "lng": 2.1567, "color": "#f97316", "why": "Local vibe" },
  { "name": "Raval", "lat": 41.3797, "lng": 2.1682, "color": "#f97316", "why": "Edgy art scene" }
]
```

---

### Shared.2 - Render info card for area

| | |
|---|---|
| **Input** | Area object with name, why, itinerary |
| **Output** | Info card overlay with navigation arrows |
| **API** | None (UI component) |
| **Cost** | FREE |
| **Proves** | UI displays area details correctly |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area object + current index + total count | Input from click handler or state |
| 2 | Render card container | Fixed position overlay, bottom-right or floating near circle |
| 3 | Display area name as header | `<h3>{area.name}</h3>` |
| 4 | Display "why" description | `<p>{area.why}</p>` |
| 5 | Display itinerary list (if present) | Map `area.itinerary` to clickable items |
| 6 | Add navigation arrows | `< Prev` / `Next >` buttons that cycle `currentAreaIndex` |
| 7 | Add close button | Sets `showCard = false` |
| 8 | Show position indicator | `"2 of 5"` based on index |

**📋 TEST INPUT (copy-paste):**
```json
{
  "name": "El Born",
  "why": "The heart of Barcelona's nightlife - narrow medieval streets packed with wine bars and cocktail lounges",
  "itinerary": [
    { "emoji": "🍸", "activity": "Cocktail bars", "searchQuery": "cocktail bars El Born" },
    { "emoji": "🍷", "activity": "Wine caves", "searchQuery": "wine caves El Born" }
  ],
  "currentIndex": 1,
  "totalCount": 5
}
```

---

### Shared.3 - Render place pin on map

| | |
|---|---|
| **Input** | Place object with name, coords, rating |
| **Output** | Pin marker with popup |
| **API** | Mapbox GL |
| **Cost** | Included in map load |
| **Proves** | Single-place visualization works |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take place object | Input from Test 4.2 or any place-fetching test |
| 2 | Create marker element | `const el = document.createElement('div'); el.className = 'place-marker'` |
| 3 | Style marker (or use Mapbox default) | CSS for custom pin icon |
| 4 | Create Mapbox Marker | `new mapboxgl.Marker(el).setLngLat([place.lng, place.lat])` |
| 5 | Create popup with place info | `new mapboxgl.Popup().setHTML(\`<h4>${place.name}</h4><p>⭐ ${place.rating}</p>\`)` |
| 6 | Attach popup to marker | `marker.setPopup(popup)` |
| 7 | Add marker to map | `marker.addTo(map)` |
| 8 | Store marker reference for cleanup | Keep in state array for removal later |

**📋 TEST INPUT (copy-paste):**
```json
{
  "name": "Fuunji",
  "lat": 35.6833,
  "lng": 139.7020,
  "rating": 4.5,
  "address": "2-14-3 Yoyogi, Shibuya City"
}
```

---

### Shared.4 - Generate GMaps/TikTok search URLs

| | |
|---|---|
| **Input** | Search query + location |
| **Output** | Clickable links that open platform searches |
| **API** | None (URL construction) |
| **Cost** | FREE |
| **Proves** | URL patterns are correct |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take search query + location | Input strings |
| 2 | Combine into full query | `"${query} ${location}"` |
| 3 | URL encode for GMaps | `encodeURIComponent(fullQuery).replace(/%20/g, '+')` |
| 4 | Build GMaps URL | `https://www.google.com/maps/search/${encoded}` |
| 5 | URL encode for TikTok (lowercase) | `encodeURIComponent(fullQuery.toLowerCase()).replace(/%20/g, '+')` |
| 6 | Build TikTok URL | `https://www.tiktok.com/search?q=${encoded}` |
| 7 | Return both URLs | `{ gmaps: gmapsUrl, tiktok: tiktokUrl }` |
| 8 | Render as clickable buttons | `<a href={url} target="_blank">` |

**📋 TEST INPUT (copy-paste):**
```
speakeasy bars | El Born Barcelona
```

**Expected output:**
```
GMaps: https://www.google.com/maps/search/speakeasy+bars+El+Born+Barcelona
TikTok: https://www.tiktok.com/search?q=speakeasy+bars+el+born+barcelona
```

---

### Shared.5 - Generate booking platform URLs

| | |
|---|---|
| **Input** | Area name + city + optional dates |
| **Output** | Clickable Airbnb + Booking.com links |
| **API** | None (URL construction) |
| **Cost** | FREE |
| **Proves** | Accommodation search URLs are correct |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area name, city, optional checkin/checkout dates | Input strings |
| 2 | Combine location | `"${areaName} ${city}"` |
| 3 | Build Airbnb base URL | `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes` |
| 4 | Add dates if provided | `?checkin=${checkin}&checkout=${checkout}` |
| 5 | Build Booking.com base URL | `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(location).replace(/%20/g, '+')}` |
| 6 | Add dates if provided | `&checkin=${checkin}&checkout=${checkout}` |
| 7 | Return both URLs | `{ airbnb: airbnbUrl, booking: bookingUrl }` |
| 8 | Render as branded buttons | Airbnb pink, Booking blue styling |

**📋 TEST INPUT (copy-paste):**
```
Shibuya | Tokyo | 2024-03-15 | 2024-03-18
```

**Expected output:**
```
Airbnb: https://www.airbnb.com/s/Shibuya%20Tokyo/homes?checkin=2024-03-15&checkout=2024-03-18
Booking: https://www.booking.com/searchresults.html?ss=Shibuya+Tokyo&checkin=2024-03-15&checkout=2024-03-18
```

---

## Implementation Priority

### Phase 1: Core Rendering (No APIs)
1. Shared.1 - Render circles ✅ (already works)
2. Shared.2 - Render info card ✅ (already works)
3. Shared.4 - Generate search URLs
4. Shared.5 - Generate booking URLs

### Phase 2: Area Generation
5. Test 1.1 - Generate vibe areas ✅ (prototype)
6. Test 1.2 - Generate itinerary (no coords)
7. Test 1.3 - Generate itinerary (with coords)
8. Test 2.1 - Stay areas with booking links

### Phase 3: Stay + Do
9. Test 3.1 - Dual-layer (2 stay + 3 activity)
10. Test 3.2 - Visual travel lines

### Phase 4: Geo Operations
11. Test 5.1 - Geocode locations
12. Test 5.2 - Generate isochrone (Mapbox)
13. Test 5.3 - Compute intersection (multi-polygon)
14. Test 5.4 - Identify neighborhoods
15. Test 5.5 - Multi-polygon fair zones

### Phase 5: Meet in Middle
16. Test 6.1 - Multi-modal isochrones
17. Test 6.2 - Interactive matrix with hover
18. Test 6.3 - AI picks best intersections
19. Test 6.4 - Get Directions handoff

### Phase 6: Place Verification
20. Test 4.1 - ScrapingDog Google Search
21. Test 4.2 - ScrapingDog GMaps details
22. Test 4.3 - ScrapingDog reviews
23. Test 4.4 - Curate with evocative language

### Phase 7: Multi-Stop Routes
24. Test 7.1 - City character analysis
25. Test 7.2 - Chat for preferences
26. Test 7.3 - Chat for logistics/constraints
27. Test 7.4 - Route matrix combinations
28. Test 7.5 - Insert stops for constraints
29. Test 7.6 - AI picks best option(s)
30. Test 7.7 - Two-stop Google Maps handoff
31. Test 7.8 - Multi-stop Google Maps handoff

---

## Test Count Summary

| Scenario | Tests | Status |
|----------|-------|--------|
| 1: Things to Do | 3 (1.1-1.3) | 1.1 ✅ |
| 2: Where to Stay | 2 (2.1-2.2) | - |
| 3: Stay + Do | 2 (3.1-3.2) | - |
| 4: Single Place | 4 (4.1-4.4) | - |
| 5: Meet in Middle | 5 (5.1-5.5) | - |
| 6: Areas Together | 4 (6.1-6.4) | - |
| 7: Multi-Stop | 8 (7.1-7.8) | - |
| Shared | 5 | 2 ✅ |
| **Total** | **33 tests** | |

---

## Next Steps

1. Build test selector UI in the chat panel
2. Implement each test with sample data
3. Verify API integrations one at a time
4. Chain blocks into full scenarios

---

*Last Updated: December 2024*

