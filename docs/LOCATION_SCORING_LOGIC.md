# Location Scoring Logic

> ⚠️ **CRITICAL**: The heatmap covers the **ENTIRE CITY**. There are **NO hard boundaries**.
> Isochrones are for **visualization only**. Commute distance applies a **graduated penalty**, not exclusion.
> A listing 90 min from work can still surface if it scores extremely high on everything else.
> See `HEATMAP_LOCATION_SCORING.md` for the complete heatmap architecture.

## The Core Principle

**Transit isochrones are only for destinations you COMMUTE to. Everything else is walkable lifestyle, so straight-line geometry works.**

This document explains the logical framework for how Leo scores location preferences, why certain methods are used, and how this creates an explainable, cost-effective system.

---

## Key Concepts

### Continuous Scoring (No Binary Exclusion)

Instead of "inside/outside" the search shape, **everything gets a score**:

- Far from work? Heavy commute **penalty** (not exclusion)
- A perfect apartment 5 minutes outside the "ideal" area? Still surfaces with explanation
- "Surprising finds" emerge naturally from high scores despite distance
- **Non-overlapping anchors work fine** - penalties stack independently, sweet spot emerges from total scoring

See `HEATMAP_LOCATION_SCORING.md` for detailed implementation.

### No Early Confrontation (Follow-Up Only)

We NEVER ask users to compromise on commute during the initial call:

- **Initial call**: Gather ALL preferences, show heatmap, no negotiations
- **Day 3**: If low inventory, ask about POI softening ("coffee 15min instead of 10?")
- **Week 2-3**: LAST RESORT only - ask about commute flexibility

Commute affects daily quality of life. POI flexibility is a minor inconvenience. We try the minor one first.

### Multi-Mode Destination Access

**Destination amenities** (beach, nightlife, specific gym) are scored across **multiple transport modes**:
- Walk, bike, moped, transit
- Best mode wins
- Allows "nicer neighborhood with quick bike ride" to beat "touristy area within walking distance"

### City Familiarity & Tradeoff Awareness

Leo adjusts behavior based on how well the user knows the city:
- **Unfamiliar**: Proactive local wisdom, surface tradeoffs
- **Visited**: Connect new info to their reference points  
- **Expert**: Trust their preferences, less explanation

---

## The Three-Tier Destination Model

Not all "location preferences" are equal. We categorize them into three types:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  TYPE 1: CRITICAL ANCHORS (Commute Penalty)                                 │
│  ══════════════════════════════════════════                                 │
│                                                                             │
│  Daily fixed-location destinations:                                         │
│  • Work office                                                              │
│  • Partner's work                                                           │
│  • Kid's school                                                             │
│                                                                             │
│  SCORING: Heavy commute PENALTY based on estimated travel time              │
│           30min = 0 penalty → 60min = -40 → 90min = -70 (effectively out)  │
│  METHOD: Turf.js radial circles (distance ÷ avg speed = estimated time)    │
│  COST: FREE (geometry only)                                                 │
│                                                                             │
│  WHY NOT HARD BOUNDARY?                                                     │
│  A perfect apartment 35 min away can still surface with high scores         │
│  elsewhere. User sees: "Slightly outside ideal commute, but nails           │
│  everything else."                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TYPE 2: DESTINATION AMENITIES (Multi-Mode Access)                          │
│  ══════════════════════════════════════════════════                         │
│                                                                             │
│  Places you GO TO but don't need to walk:                                   │
│  • Beach / sea                                                              │
│  • Nightlife hub (you "go out")                                             │
│  • Specific gym / CrossFit                                                  │
│  • Friends' neighborhood                                                    │
│                                                                             │
│  SCORING: Best of (walk, bike, moped, transit)                              │
│           15min bike = 8/10, 50min walk = 0/10 → bike mode wins             │
│  METHOD: Turf.js distance ÷ mode speed (all modes)                          │
│  COST: FREE                                                                 │
│                                                                             │
│  WHY MULTI-MODE?                                                            │
│  "Near beach" via 15-min bike in a nice neighborhood beats                  │
│  "walk to beach" in a touristy area. Let better hoods compete.              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TYPE 3: DAILY WALKABLES (Walk-Only Scoring)                                │
│  ═══════════════════════════════════════════                                │
│                                                                             │
│  Things you want at your doorstep:                                          │
│  • Coffee shops                                                             │
│  • Groceries / supermarket                                                  │
│  • Parks / green space                                                      │
│  • Restaurants for casual dinners                                           │
│                                                                             │
│  SCORING: Walking distance only                                             │
│           5min walk = 10/10, 15min walk = 5/10, 30min = 0/10                │
│  METHOD: Turf.js straight-line × 1.3 street factor                          │
│  COST: FREE                                                                 │
│                                                                             │
│  WHY WALK-ONLY?                                                             │
│  Nobody metros to their morning coffee. If you can't walk there,            │
│  it's not "your neighborhood coffee shop."                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision Logic for ElevenLabs Agent

```typescript
type DestinationType = 'anchor' | 'destination' | 'walkable';

function categorizeLocationPreference(userStatement: string): DestinationType {
  
  // TYPE 1: ANCHOR signals
  const anchorSignals = [
    'work at', 'works at', 'office', 'commute',
    'school', 'kids go to', 'partner works'
  ];
  if (anchorSignals.some(s => userStatement.toLowerCase().includes(s))) {
    return 'anchor';
  }
  
  // TYPE 2: DESTINATION AMENITY signals
  const destinationSignals = [
    'beach', 'sea', 'coast',
    'nightlife', 'bars', 'clubs', 'go out',
    'gym', 'crossfit', 'yoga studio',
    'friends live', 'family lives'
  ];
  if (destinationSignals.some(s => userStatement.toLowerCase().includes(s))) {
    return 'destination';
  }
  
  // TYPE 3: DAILY WALKABLE (default for amenities)
  return 'walkable';
}
```

---

## Why This Split Makes Sense

### Transit Changes Everything for Commutes

```
Without transit understanding:
  🏠 3km from work = 36 min walk = "far"
  
With transit understanding:
  🏠 3km from work BUT next to metro = 12 min door-to-door = "close"
```

For daily commutes, transit is the primary mode. A 45-minute metro ride is acceptable; a 45-minute walk is not. **Transit isochrones are essential here.**

### Transit is Irrelevant for Lifestyle Amenities

```
User: "I want to be near the beach"

What they mean:
  • Morning jogs on the sand
  • Evening walks along the promenade  
  • Weekend swims after brunch
  • The VIBE of a beach neighborhood

What they DON'T mean:
  • "I'll take the L4 three stops to swim, then reverse commute home"
```

Nobody metros to their morning beach jog. If you need transit to reach the beach, you don't "live near the beach." **Straight-line distance works here.**

---

## Data Sources Overview

| Source | What It Provides | Update Frequency | Cost |
|--------|------------------|------------------|------|
| **Turf.js circles** | Commute zone visualization + penalty calculation | On-demand | **FREE** |
| **OSM (geo2day.com)** | Natural features: parks, beaches, metro stations | Daily | FREE |
| **AllThePlaces.xyz** | Business density/vibe: cafes, restaurants, shops | Weekly builds | FREE (CC-0) |
| **ScrapingDog** | Specific quality: reviews, ratings, specific types | On-demand | ~$0.01/search |
| **Airbnb (pre-analyzed)** | Neighborhood quietness/vibe from guest reviews | Monthly refresh | FREE (pre-computed) |

> **MVP Note:** Using Turf.js radial circles instead of API isochrones. Works well in Spain:
> - Regular city layouts (not choppy like London)
> - Multi-modal culture (mopeds, bikes common — covers transit gaps)
> - ~70% accurate vs real isochrones, fine for graduated penalties
> - Future: upgrade to Geoapify (~$0.01/anchor) when revenue justifies precision

### The Mental Model:

```
┌─────────────────────────────────────────────────────────────────┐
│  OSM = "The Landscape"                                          │
│  What doesn't change: parks, beaches, metro stations, schools   │
│  A park is a park. Quality doesn't vary.                        │
└─────────────────────────────────────────────────────────────────┘
                              +
┌─────────────────────────────────────────────────────────────────┐
│  AllThePlaces = "Area Vibe" (like Airbnb for businesses)        │
│  Is this area lively? Are there cafes, restaurants, shops?      │
│  Density scoring, not quality scoring.                          │
│  "34 cafes within 500m" tells you it's a vibrant area.          │
└─────────────────────────────────────────────────────────────────┘
                              +
┌─────────────────────────────────────────────────────────────────┐
│  ScrapingDog = "Specific Lifestyle Needs"                       │
│  User cares about a SPECIFIC type or QUALITY.                   │
│  "Specialty coffee" - can't find on AllThePlaces                │
│  "Good gym with equipment reviews" - needs actual reviews       │
└─────────────────────────────────────────────────────────────────┘
                              +
┌─────────────────────────────────────────────────────────────────┐
│  Airbnb = "Neighborhood Character"                              │
│  Is it quiet? Noisy? Touristy? Local?                           │
│  Pre-analyzed from guest reviews, stored as H3 hex scores.      │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Need Categories

### Category 1: ANCHORS (Regular Commute Destinations)

| Signal | Example Phrases | Technical Solution |
|--------|-----------------|-------------------|
| Work | "I work at Diagonal" | Turf.js radial zones + graduated penalty |
| Partner's work | "My partner works in Hospitalet" | Turf.js radial zones + graduated penalty |
| School | "Kids go to Escola X" | Turf.js radial zones + graduated penalty |
| Specific regular destination | "I go to CrossFit Raval daily" | Turf.js radial zones + graduated penalty |

**Why radial approximation (MVP)?**
- Spanish cities have regular layouts (unlike London's choppy transit)
- Multi-modal culture: mopeds/bikes cover transit gaps
- ~70% accurate vs real isochrones, fine for graduated penalties
- Specific destination gets geocoded, then we calculate distance → time

**Cost:** FREE (Turf.js geometry only)

> **Future upgrade:** Geoapify isochrones (~$0.01/anchor) when revenue justifies precision

---

### Category 2: LIFESTYLE AMENITIES (Walkable Existence-Based)

| Signal | Example Phrases | Technical Solution |
|--------|-----------------|-------------------|
| Beach/sea | "Near the beach", "Walking distance to sea" | Turf.js distance to coastline |
| Parks | "Near parks", "Green space", "Nature" | Turf.js distance to park polygons (OSM) |
| Metro access | "Good transport", "Near metro" | Turf.js distance to metro stations (OSM) |
| Playgrounds | "Family friendly", "Kids can play outside" | Turf.js distance to playgrounds (OSM) |

**Why straight-line geometry?**
- Distributed amenities (many options, use nearest)
- You WALK there for daily enjoyment
- Transit is irrelevant - nobody metros to their local park
- Quality doesn't vary much (a park is a park)

**Cost:** FREE (Turf.js + OSM data we already have)

**Distance to time conversion:**
```typescript
const WALKING_SPEED_M_PER_MIN = 80; // ~5km/h
const STREET_GRID_FACTOR = 1.3;     // Streets aren't straight

function estimateWalkingMinutes(straightLineMeters: number): number {
  return (straightLineMeters * STREET_GRID_FACTOR) / WALKING_SPEED_M_PER_MIN;
}

// 800m straight line → 800 * 1.3 / 80 = 13 min walk
```

---

### Category 3: AREA VIBE (Business Density/Character)

| Signal | Example Phrases | Technical Solution |
|--------|-----------------|-------------------|
| Vibrancy | "Lively area", "Lots going on" | AllThePlaces density count |
| Cafe culture | "Area with cafes" (generic) | AllThePlaces cafe density |
| Food scene | "Restaurant area", "Food options" | AllThePlaces restaurant density |
| Nightlife area | "Near bars" (not specific quality) | AllThePlaces bar/club density |
| Shopping | "Walkable shopping" | AllThePlaces retail density |

**Why AllThePlaces?**
- Shows WHERE businesses exist (commercial vs residential zoning)
- More current than OSM for businesses
- Has opening hours (can filter to "currently operating")
- Has brand info (chain vs independent ratio)
- Quality doesn't matter here - just DENSITY

**Cost:** FREE (CC-0 license, pre-imported to DynamoDB)

**Process:**
```
User: "I want a lively area with cafes and restaurants"
         │
         ▼
Query AllThePlaces: POIs within 500m of listing
         │
         ▼
Returns: 47 businesses
         ├── 18 cafes (12 independent, 6 chain)
         ├── 22 restaurants
         ├── 7 bars
         └── 38 currently open (opening_hours check)
         │
         ▼
Density Score: HIGH vibrancy
         │
         ▼
Heatmap: Areas with high business density score higher
```

**AllThePlaces vs OSM for Businesses:**
| Aspect | OSM | AllThePlaces |
|--------|-----|--------------|
| Currentness | Often outdated | Scraped from live websites |
| Opening hours | Rarely present | Usually included |
| Brand info | Sometimes | Always (spider knows the brand) |
| Coverage | Volunteer-dependent | Systematic scraping |

---

### Category 4: SPECIFIC QUALITY (Need Reviews/Scoring)

| Signal | Example Phrases | Technical Solution |
|--------|-----------------|-------------------|
| Specialty coffee | "Good SPECIALTY coffee", "Third wave" | ScrapingDog + Flash-Lite |
| Quality restaurants | "GOOD restaurants", "Fine dining" | ScrapingDog + Flash-Lite |
| Specific gym | "Gym with good EQUIPMENT", "CrossFit" | ScrapingDog + Flash-Lite |
| Specific nightlife | "Good COCKTAIL bars", "Live music venues" | ScrapingDog + Flash-Lite |

**Why ScrapingDog (not AllThePlaces)?**
- User wants a SPECIFIC TYPE (specialty, craft, artisan)
- Quality matters - need REVIEWS to assess
- AllThePlaces has locations but not reviews/ratings
- User preferences affect what "good" means

**Cost:** ~$0.01 per search + ~$0.002 Flash-Lite scoring

**When to trigger ScrapingDog vs AllThePlaces:**
```
┌─────────────────────────────────────────┐
│ User says: "near cafes"                 │
│ → Generic density → AllThePlaces (FREE) │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ User says: "near GOOD specialty coffee" │
│ → Specific quality → ScrapingDog (PAID) │
└─────────────────────────────────────────┘
```

**Process:**
```
User: "Good specialty coffee"
         │
         ▼
ScrapingDog: Search "specialty coffee [city]"
         │
         ▼
Returns: 20 cafes with ratings, reviews
         │
         ▼
Flash-Lite: Score each for user fit (0-10)
         │  "This user values quiet work spaces"
         │  "Cafe A has 'great for laptops' reviews → 9/10"
         ▼
Turf.js: Distance from each listing to scored cafes
         │
         ▼
Heatmap: Areas near high-fit cafes score higher
```

---

### Category 5: META-AMENITIES (Connectivity/Character)

| Signal | Example Phrases | Technical Solution |
|--------|-----------------|-------------------|
| Transit access | "Good connections", "Well connected" | OSM metro/bus stops + density scoring |
| Walkability | "Walkable area", "Don't need a car" | AllThePlaces density within radius |
| Quietness | "Quiet area", "Not too noisy" | Airbnb review analysis (pre-computed) |
| Neighborhood vibe | "Young area", "Family friendly" | Neighborhood dimension matching |

**Why multiple sources?**
- Transit → OSM (doesn't change often)
- Walkability → AllThePlaces (business density = walkable errands)
- Quietness → Airbnb (guest reviews mention noise)
- Vibe → Pre-computed neighborhood profiles

---

## The Decision Tree (For ElevenLabs Agent)

```
User mentions location preference
            │
            ▼
┌─────────────────────────────────────┐
│ Is it a SPECIFIC DESTINATION        │
│ they go to REGULARLY?               │
│                                     │
│ Signals:                            │
│ • "I work at..."                    │
│ • "My partner works at..."          │
│ • "I go to [specific place] daily"  │
│ • "Kids go to school at..."         │
└───────────────┬─────────────────────┘
                │
        ┌───────┴───────┐
        │ YES           │ NO
        ▼               ▼
┌───────────────┐ ┌─────────────────────────────┐
│ ANCHOR        │ │ Is it a NATURAL FEATURE?    │
│               │ │                             │
│ Action:       │ │ Signals:                    │
│ • Geocode it  │ │ • Beach, sea, coast         │
│ • Generate    │ │ • Parks, green space        │
│   transit     │ │ • Metro, train stations     │
│   isochrone   │ │ • Schools, playgrounds      │
│ • Add to      │ └─────────────┬───────────────┘
│   SHAPE       │               │
└───────────────┘       ┌───────┴───────┐
                        │ YES           │ NO
                        ▼               ▼
                ┌───────────────┐ ┌─────────────────────────────┐
                │ EXISTENCE     │ │ Is it about AREA VIBE?      │
                │ (Natural)     │ │ (generic business density)  │
                │               │ │                             │
                │ Source: OSM   │ │ Signals:                    │
                │ Cost: FREE    │ │ • "Lively area"             │
                │               │ │ • "Near cafes" (generic)    │
                │ Action:       │ │ • "Restaurant area"         │
                │ • Turf.js     │ │ • "Walkable shopping"       │
                │   distance    │ └─────────────┬───────────────┘
                │ • Add to      │               │
                │   HEATMAP     │       ┌───────┴───────┐
                └───────────────┘       │ YES           │ NO
                                        ▼               ▼
                                ┌───────────────┐ ┌───────────────┐
                                │ AREA VIBE     │ │ SPECIFIC      │
                                │ (Density)     │ │ QUALITY       │
                                │               │ │               │
                                │ Source:       │ │ Signals:      │
                                │ AllThePlaces  │ │ • "Good..."   │
                                │ Cost: FREE    │ │ • "Specialty" │
                                │               │ │ • "Best..."   │
                                │ Action:       │ │ • "Quality"   │
                                │ • Count POIs  │ │               │
                                │   in radius   │ │ Source:       │
                                │ • Density     │ │ ScrapingDog   │
                                │   score       │ │ Cost: ~$0.01  │
                                │ • Add to      │ │               │
                                │   HEATMAP     │ │ Action:       │
                                └───────────────┘ │ • Search +    │
                                                  │   reviews     │
                                                  │ • Flash-Lite  │
                                                  │   scoring     │
                                                  │ • Add to      │
                                                  │   HEATMAP     │
                                                  └───────────────┘
```

### Quick Reference Table:

| User Says | Category | Source | Cost |
|-----------|----------|--------|------|
| "I work at Diagonal" | ANCHOR | Turf.js radial | **FREE** |
| "Near the beach" | EXISTENCE | OSM | FREE |
| "Near parks" | EXISTENCE | OSM | FREE |
| "Near metro" | EXISTENCE | OSM | FREE |
| "Lively area with cafes" | AREA VIBE | AllThePlaces | FREE |
| "Restaurant neighborhood" | AREA VIBE | AllThePlaces | FREE |
| "Good specialty coffee" | SPECIFIC QUALITY | ScrapingDog | $0.01 |
| "Nice restaurants" | SPECIFIC QUALITY | ScrapingDog | $0.01 |
| "Quiet area" | META (Airbnb) | Pre-computed | FREE |

---

## Data Sources

### From OSM (via geo2day.com PBF files) - FREE

**Use for:** Natural features that don't change often

| Layer | Features in Spain | Use Case |
|-------|-------------------|----------|
| Beaches/coastline | 4,546 | Beach proximity |
| Parks | 52,112 | Green space scoring |
| Metro stations | ~500 | Transit access |
| Bus stops | 55,939 | Transit access |
| Playgrounds | 8,102 | Family-friendly scoring |
| Schools | 3,244 | Family-friendly scoring |

**Storage:** DynamoDB tables
- `leo-neighborhood-boundaries` - Admin boundaries ✅ CREATED
- `leo-osm-beaches` - Coastline/beach polygons
- `leo-osm-parks` - Park polygons
- `leo-osm-metro` - Metro station points

**Update frequency:** Weekly from geo2day.com (they update daily)

---

### From AllThePlaces.xyz - FREE (CC-0 License)

**Use for:** Area vibe, business density, generic "are there cafes here?"

| Data | Coverage | Use Case |
|------|----------|----------|
| Cafes | ~16,000 in Spain | Cafe culture density |
| Restaurants | ~40,000 in Spain | Food scene density |
| Bars/clubs | ~10,000 in Spain | Nightlife density |
| Retail | ~50,000 in Spain | Walkable shopping |
| Gyms (generic) | ~2,000 in Spain | Fitness accessibility |

**What AllThePlaces provides:**
```json
{
  "name": "Satan's Coffee Corner",
  "brand": "Satan's Coffee Corner",
  "opening_hours": "Mo-Fr 08:00-18:00; Sa 09:00-17:00",
  "website": "https://satanscoffee.com",
  "phone": "+34 934 123 456",
  "coords": [2.1734, 41.3851]
}
```

**What AllThePlaces does NOT provide:**
- ❌ Reviews/ratings (can't assess quality)
- ❌ Specific types (can't filter "specialty coffee")
- ❌ User sentiment

**Storage:** DynamoDB table `leo-atp-pois`
- PK: city
- SK: poi_id
- Attributes: category, brand, coords, opening_hours

**Update frequency:** Weekly from alltheplaces.xyz builds

**Source:** https://alltheplaces.xyz/ (GeoJSON downloads, CC-0 license)

---

### From ScrapingDog - PAID (per search)

**Use for:** Specific quality requirements where reviews matter

| Search Type | When Used | Cost |
|-------------|-----------|------|
| "specialty coffee [city]" | User wants SPECIFIC type | ~$0.01 |
| "best restaurants [city]" | User wants QUALITY food | ~$0.01 |
| "CrossFit [city]" | User wants SPECIFIC gym type | ~$0.01 |

**What ScrapingDog provides (via Google Places):**
- Actual reviews and ratings
- Specific business types (not just "cafe" but "specialty coffee")
- User sentiment ("great for working", "quiet")

---

### From Turf.js - FREE (MVP Approach)

**Use for:** Commute anchors (work, school, specific regular destinations)

| Request Type | When Used | Cost |
|--------------|-----------|------|
| Radial distance calculation | Work/school commute | **FREE** |
| Multi-band visualization | Map display | **FREE** |

**Why this works for Spain (MVP):**
- Regular city layouts (not choppy like London)
- Multi-modal culture (mopeds/bikes cover transit gaps)
- ~70% accurate vs real isochrones, fine for graduated penalties

**Future upgrade:** Geoapify isochrones (~$0.01/anchor) when revenue justifies precision

---

### From Airbnb (Pre-Computed) - FREE

**Use for:** Neighborhood quietness/character from guest reviews

| Data | Coverage | Use Case |
|------|----------|----------|
| Quietness scores | Per H3 hex | "Quiet area" preference |
| Tourist density | Per H3 hex | "Local vs touristy" |
| Vibe descriptors | Per H3 hex | Neighborhood character |

**Storage:** DynamoDB table `leo-airbnb-scores` (pre-computed, monthly refresh)

---

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INPUT                                  │
│  "I work at Diagonal, partner works in Hospitalet.              │
│   We want to be near the beach, good coffee, and parks."        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ANCHOR PROCESSING                             │
│                                                                 │
│  "Work at Diagonal"                                             │
│      → Geocode: [2.1527, 41.3937]                               │
│      → Turf.js circles at 30, 45, 60 min (17 km/h transit)      │
│      → Returns: Multi-band GeoJSON polygons                     │
│                                                                 │
│  "Partner in Hospitalet"                                        │
│      → Geocode: [2.1003, 41.3596]                               │
│      → Turf.js circles at 30, 45, 60 min (17 km/h transit)      │
│      → Returns: Multi-band GeoJSON polygons                     │
│                                                                 │
│  Multi-band circles (10, 20, 30, 45, 60, 90 min)             │
│      → Used for VISUALIZATION on map                            │
│      → Scoring uses exact commute minutes → graduated penalty   │
│      → NO hard boundary! All listings scored, far ones penalized│
│                                                                 │
│  Cost: FREE (Turf.js circles)                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HEATMAP SCORING                               │
│                                                                 │
│  For each listing in the CITY (all listings, not just "shape"):                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Near beach" (EXISTENCE POI)                            │    │
│  │                                                         │    │
│  │ OSM beach polygons → Turf.js pointToLineDistance        │    │
│  │ Result: 800m straight line                              │    │
│  │ Estimate: 800m × 1.3 / 80 = 13 min walk                 │    │
│  │ Score: 7/10 (good but not amazing)                      │    │
│  │ Cost: FREE                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Near parks" (EXISTENCE POI)                            │    │
│  │                                                         │    │
│  │ OSM park polygons → Turf.js pointToPolygonDistance      │    │
│  │ Result: 150m to nearest park                            │    │
│  │ Estimate: 150m × 1.3 / 80 = 2.4 min walk                │    │
│  │ Score: 10/10 (excellent)                                │    │
│  │ Cost: FREE                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Good coffee" (QUALITY POI)                             │    │
│  │                                                         │    │
│  │ ScrapingDog: "specialty coffee Barcelona"               │    │
│  │ Returns: 20 cafes with ratings/reviews                  │    │
│  │                                                         │    │
│  │ Flash-Lite scores each for user fit:                    │    │
│  │   "Satan's Coffee Corner" → 9/10 (laptop friendly)      │    │
│  │   "Nomad Coffee" → 8/10 (great beans, busy)             │    │
│  │   ...                                                   │    │
│  │                                                         │    │
│  │ Turf.js: Distance to nearest high-fit cafe              │    │
│  │ Result: "Satan's Coffee" 600m away, fit 9/10            │    │
│  │ Score: 8/10                                             │    │
│  │ Cost: ~$0.012                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Neighborhood multiplier                                 │    │
│  │                                                         │    │
│  │ Listing in "Poblenou"                                   │    │
│  │ User dimension match: 85%                               │    │
│  │ Multiplier: 1.15x                                       │    │
│  │ Cost: FREE (pre-computed)                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  FINAL SCORE = weighted_avg(beach, parks, coffee) × hood_mult   │
│              = (7×0.3 + 10×0.2 + 8×0.5) × 1.15                  │
│              = 8.1 × 1.15 = 9.3/10                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Summary Per User

### Breakdown by Category:

| Category | Component | Method | Cost |
|----------|-----------|--------|------|
| **ANCHOR** | Work commute zones | Turf.js radial | **FREE** |
| **ANCHOR** | Partner commute zones | Turf.js radial | **FREE** |
| **EXISTENCE** | Beach proximity | Turf.js + OSM | FREE |
| **EXISTENCE** | Parks proximity | Turf.js + OSM | FREE |
| **EXISTENCE** | Metro access | Turf.js + OSM | FREE |
| **EXISTENCE** | Playground proximity | Turf.js + OSM | FREE |
| **AREA VIBE** | Cafe/restaurant density | AllThePlaces | FREE |
| **AREA VIBE** | Nightlife density | AllThePlaces | FREE |
| **SPECIFIC QUALITY** | "Good coffee" search | ScrapingDog | ~$0.01 |
| **SPECIFIC QUALITY** | "Nice restaurants" search | ScrapingDog | ~$0.01 |
| **SPECIFIC QUALITY** | Quality scoring | Flash-Lite | ~$0.003 |
| **META** | Quietness scoring | Airbnb (pre-computed) | FREE |

### Typical User Scenarios:

| User Type | Likely Requests | Estimated Cost |
|-----------|-----------------|----------------|
| **Simple user** | Work anchor + beach + parks | ~$0.002 |
| **Foodie** | Work anchor + "good restaurants" + cafe density | ~$0.015 |
| **Quality-focused** | Work anchor + specialty coffee + nice restaurants + good gym | ~$0.035 |
| **Maximum** | 2 anchors + 3 quality searches | ~$0.05 |

### Key Insight:

**Most users won't trigger ScrapingDog at all** if they just want:
- "Near the beach" → FREE (OSM)
- "Lively area with cafes" → FREE (AllThePlaces)
- "Good transit" → FREE (OSM)

ScrapingDog only fires when they say **"good/best/quality/specialty"** - a specific quality requirement.

At €10/month subscription, this gives us **very healthy margins** even with ongoing monitoring.

---

## Why Not Street-Aware Routing for Everything?

### The Question:
"Shouldn't we use actual street routing instead of straight-line × 1.3?"

### The Answer:
For lifestyle amenities, the extra accuracy isn't worth the cost or complexity.

| Approach | Accuracy | Cost | Complexity |
|----------|----------|------|------------|
| Straight-line × 1.3 | ~85% accurate | FREE | Zero |
| Self-hosted OSRM | ~98% accurate | $30/month server | Medium |
| Routing API | ~99% accurate | $0.005/query | Low |

**For commutes (MVP):** Use Turf.js radial approximation (~70% accurate). Spanish cities have regular layouts + multi-modal culture (mopeds cover transit gaps). Future: upgrade to Geoapify for precision.

**For "near the beach":** Whether it's 12 or 14 minutes doesn't change the decision. Use geometry.

### Edge Case Handling:

If someone says **"I need to be at the beach in under 10 minutes"** (hard constraint, not preference), treat it like an anchor:
- Generate walking isochrone from beach access points
- Add to SHAPE calculation
- This is rare and worth the API cost when it happens

---

## Implementation Checklist

### OSM Data Import (One-Time)
- [x] Download neighborhood boundaries via Overpass API
- [x] Store in `leo-neighborhood-boundaries` DynamoDB table
- [ ] Download spain.pbf from geo2day.com
- [ ] Extract beaches, parks, metro stations, playgrounds
- [ ] Store in `leo-osm-*` DynamoDB tables
- [ ] Set up weekly refresh from geo2day.com

### AllThePlaces Import (One-Time)
- [ ] Download latest Spain GeoJSON from alltheplaces.xyz
- [ ] Filter to relevant categories (cafe, restaurant, bar, retail, gym)
- [ ] Store in `leo-atp-pois` DynamoDB table
- [ ] Set up weekly refresh from alltheplaces.xyz builds

### Turf.js Utilities
- [ ] `getDistanceToNearestBeach(listing)` 
- [ ] `getDistanceToNearestPark(listing)`
- [ ] `getDistanceToNearestMetro(listing)`
- [ ] `estimateWalkingMinutes(straightLineMeters)`
- [ ] `getAreaVibrancy(listing, radiusMeters)` - AllThePlaces density

### ElevenLabs Agent Logic
- [ ] Implement decision tree for ANCHOR vs DESTINATION vs WALKABLE
- [ ] Add tools:
  - `generate_commute_zones` (Turf.js radial circles - FREE)
  - `score_destination_multimode` (walk/bike/moped/transit scoring)
  - `score_walkable_poi` (OSM + Turf.js walking only)
  - `score_area_vibe` (AllThePlaces density)
  - `score_quality_poi` (ScrapingDog + Flash-Lite)
  - `probe_city_familiarity` (record user's city knowledge)
  - `get_tradeoff_clarification` (surface local wisdom)

### Multi-Mode Scoring
- [ ] `scoreDestinationAccess(listing, destination)` - Returns best of walk/bike/moped/transit
- [ ] `estimateBikeMinutes(from, to)` - Straight-line / 4.5 (avg city biking speed)
- [ ] `estimateMopedMinutes(from, to)` - Straight-line / 6 (avg moped speed)
- [ ] Integrate multi-mode scores into heatmap calculation

### City Intelligence
- [ ] Create `CITY_TRADEOFFS` configuration for Barcelona, Madrid
- [ ] Store user familiarity level in profile
- [ ] Trigger clarifications based on amenity + familiarity combo

### Heatmap Calculation
- [ ] Combine all POI scores with weights
- [ ] Apply neighborhood multiplier
- [ ] Apply Airbnb quietness scores where relevant
- [ ] Normalize to 0-100 scale

---

## City Intelligence & Tradeoff Awareness

### The Problem: Newcomers Don't Know Local Wisdom

Users unfamiliar with a city often optimize for the wrong things:
- "Near beach" → End up in touristy Barceloneta
- "Near nightlife" → Don't realize it's inland, not coastal
- "Central" → End up in tourist-heavy areas

Locals know the tradeoffs. Leo should too.

### City Familiarity Probing

Early in the call, Leo asks: **"Have you spent any time in [city] before?"**

| Response | Leo's Behavior |
|----------|----------------|
| "Never been" | Maximum local wisdom mode. Proactively surface tradeoffs. |
| "Visited friends" | "Where did you stay?" Learn their reference points. |
| "Know it well" | Trust their preferences. Less explanation. |

### Pre-Loaded Tradeoff Database

```typescript
const TRADEOFFS: Record<string, TradeoffConfig[]> = {
  barcelona: [
    {
      amenity: 'beach',
      tradeoff: "Beach-adjacent areas are touristy and transient",
      clarification: `Quick thought - areas closest to the beach tend to 
        be more touristy and noisy. A lot of locals prefer living in 
        neighborhoods like Gràcia and getting to the beach by bike in 
        10-15 minutes. What matters more - walking distance to sand, 
        or a quieter neighborhood feel?`
    },
    {
      amenity: 'nightlife',
      tradeoff: "Nightlife is inland, not coastal",
      clarification: `FYI, the main nightlife is in Gràcia, Born, Raval - 
        not by the beach. Do you want to be IN the action, or is a 
        quick walk/ride away fine?`
    }
  ]
};
```

### When Leo Surfaces Tradeoffs

```typescript
function shouldSurfaceTradeoff(
  amenity: string, 
  city: string, 
  familiarity: 'none' | 'visited' | 'expert'
): boolean {
  if (familiarity === 'none') return true;      // Always for newcomers
  if (familiarity === 'visited') return major;  // Only major tradeoffs
  return false;                                  // Experts know
}
```

### Implementation

- [ ] Add `probe_city_familiarity` tool to ElevenLabs agent
- [ ] Create `CITY_TRADEOFFS` configuration file
- [ ] Store familiarity level in user profile
- [ ] Trigger tradeoff clarifications when relevant amenities mentioned

See `HEATMAP_LOCATION_SCORING.md` for detailed tradeoff patterns.

---

## Related Documents

- `HEATMAP_LOCATION_SCORING.md` - Detailed heatmap algorithm
- `P0_LEAN_APP.md` - Full implementation plan
- `USER_DIMENSION_INFERENCE.md` - How we infer user preferences

## External Resources

- **OSM Data:** https://geo2day.com/europe/spain.html (daily PBF updates)
- **AllThePlaces:** https://alltheplaces.xyz/ (weekly builds, CC-0 license)
- **Turf.js:** https://turfjs.org/ (client-side geometry calculations - FREE)
- **Geoapify Isochrones:** https://www.geoapify.com/isoline-api (future upgrade for precision)
- **ScrapingDog:** https://www.scrapingdog.com/ (Google Places scraping)

---

*Last Updated: December 2024*
*This document establishes the logical framework for location scoring decisions.*

---

## Changelog

- **Dec 2024:** Switched to Turf.js radial circles for commute zones (FREE, ~70% accuracy vs isochrones). Works well in Spain due to regular city layouts and multi-modal culture (mopeds, bikes). Geoapify reserved for future precision upgrade.
- **Dec 2024:** Added continuous scoring model (no binary exclusion)
- **Dec 2024:** Added multi-mode destination access (walk/bike/moped/transit)
- **Dec 2024:** Added city familiarity probing and tradeoff awareness
- **Dec 2024:** Restructured to Three-Tier Destination Model (anchors, destinations, walkables)
- **Dec 2024:** Added AllThePlaces as data source for area vibe/density scoring
- **Dec 2024:** Clarified three-tier distinction: EXISTENCE vs AREA VIBE vs SPECIFIC QUALITY
- **Dec 2024:** Added decision tree for ElevenLabs agent
- **Dec 2024:** Initial document creation

