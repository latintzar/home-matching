# Leo Recommender Architecture

**Purpose**: The complete system for how Leo finds places that could support the life you want to live.  
**Last Updated**: 2025-01-28  
**Status**: Detailed Subsystem Documentation  
**Master Doc**: [LEO_PLATFORM_ARCHITECTURE.md](./LEO_PLATFORM_ARCHITECTURE.md)

> **Where This Fits**: Recommender is Pillar 2 of 4. Data comes from [HARVEST_ENGINE_ARCH.md](./HARVEST_ENGINE_ARCH.md). When user requests viewing, triggers [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) (Analysis).

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [How It Actually Works (Plain English Example)](#how-it-actually-works-plain-english-example)
3. [System Overview](#system-overview)
4. [Complete Data Flow](#complete-data-flow)
5. [Phase 1: Intake (Life Profile)](#phase-1-understand-the-life-intake)
6. [Phase 2: Free Filtering](#phase-2-find-candidates-free-filtering)
7. [Phase 3: Geo-Intelligence (Dossier System)](#phase-3-geo-intelligence-the-dossier-system)
8. [Phase 4: Whole Property Analysis](#phase-4-whole-property-analysis)
9. [Phase 5: Scoring & Recommendations](#phase-5-scoring--recommendations)
10. [Schema Evolution (Cron Job)](#schema-evolution-the-cron-job)
11. [New City Request Flow](#new-city-request-flow)
12. [Cost Model](#cost-model)
13. [What Needs to Be Built](#what-needs-to-be-built)

---

## Core Philosophy

**Leo doesn't search for properties. Leo finds places that could support how you want to live.**

- People describe lives, not filters. "I work from home and have guests sometimes" ≠ `WHERE bedrooms >= 3`
- We evaluate "could this place support that life?" — not "does it tick boxes?"
- We're honest about what we know vs. what we're guessing vs. what you'll only know when you visit
- **Analyze once, score many times** — property intelligence is cached and reused across all users
- **The system gets smarter** — every analysis feeds the Geo-Intelligence layer

---

## How It Actually Works (Plain English Example)

Let's walk through what happens when María signs up:

### Step 1: María Talks to Leo

María tells Leo about her life:
- "I work from home full-time and need a proper workspace"
- "My boyfriend visits from Madrid most weekends"  
- "I do yoga every morning — need floor space"
- "I love natural light but hate street noise"
- "I'd consider something that needs work if the bones are good"

Leo extracts a **Life Profile** — not filters, but a picture of the life she wants:

```
María's Life Profile:
├── Anchors: None (remote work) → Sweet spot = all of Barcelona
├── Home Use: WFH (critical), guests (weekly), yoga (daily)
├── Tolerances: Light (must), Noise (dealbreaker)
├── Taste: Character over modern, good bones
├── Appetite: Open to renovation
```

### Step 2: Where Could She Live?

**The Sweet Spot**: Since María works remotely and has no commute anchors (office, gym, family), her "sweet spot" polygon is effectively **all of Barcelona**. This is different from someone who needs to be 30 mins from an office — their sweet spot would be a specific zone.

Leo starts filtering:
1. **Geo Filter**: All Barcelona listings (~20,000)
2. **Hard Filters**: Her max price, minimum sqm → ~8,000
3. **Soft Scoring**: Keywords like "luminoso" (bright), condition preferences → Ranked list
4. **Take Top 20**: Diverse selection for analysis

### Step 3: What Do We Know About These Places?

For each of the 20 candidates, Leo checks the **Geo-Intelligence Layer** (our dossier system):

```
Property at Carrer Blai 45:
├── Building match? No (we haven't analyzed this building yet)
├── Street match? YES → "Carrer Blai: known for bars, noisy on weekends"
├── Neighborhood? YES → "Poble Sec: lively, young, gentrifying"
├── Era pattern? YES → "1960s Barcelona: check for aluminosis, small kitchens typical"
```

Leo now knows: *This could be too noisy for María, but flag it as a concern rather than reject.*

### Step 4: Look at the Photos (Whole Property Analysis)

For each candidate, Leo checks: **Have we analyzed this property before?**

- **Already analyzed?** Use the cached analysis (FREE)
- **Not yet?** Run Gemini 3 Pro on the photos (~$0.05)

**Note**: We use **Fetch-and-Dump** — images are fetched on-demand from agency URLs, sent to Gemini, then discarded. We store analysis results, not images. See [LEO_PLATFORM_ARCHITECTURE.md](./LEO_PLATFORM_ARCHITECTURE.md#critical-architecture-fetch-and-dump-for-photo-analysis).

The analysis extracts everything we might ever need:

```
Property Profile for Carrer Blai 45:
├── Rooms: Living (large), Bedroom (medium), Kitchen (tiny), Bath (dated)
├── Layout: Semi-open, good flow, flexible
├── Light: Excellent — south-facing, floor-to-ceiling windows
├── Condition: Needs cosmetic work, structure looks solid
├── Potential:
│   ├── WFH: "corner_possible" (no dedicated room, but large living)
│   ├── Guest sleeping: "sofa_bed_possible"
│   └── Exercise: "living_room_clearable" (could do yoga)
├── Building observations: "Pre-war building, original tiles visible"
├── Street observations: "Photos show bar signage across street"
```

**Key insight**: This analysis is stored forever. If Pedro searches tomorrow with different needs, we don't re-analyze — we just re-score.

### Step 5: Does This Place Support María's Life?

Leo scores each property against María's profile:

```
Carrer Blai 45 vs. María:
├── WFH need (critical): "corner_possible" → Partial match (she wanted dedicated)
├── Guest sleeping (important): "sofa_bed_possible" → OK (she said guests, not live-in)
├── Yoga space (daily): "living_room_clearable" → Good match
├── Light (must): "excellent" → Perfect match ✅
├── Noise (dealbreaker): Street intel says noisy → FLAG THIS ⚠️
├── Renovation appetite: "needs cosmetic work" → She's open to this ✅

SCORE: 72% match
CONFIDENCE: Medium (noise concern needs verification)
```

### Step 6: Present Recommendations

Leo shows María 5-8 properties with honest explanations:

> **Carrer Blai 45** — 72% match
> 
> ✅ **High confidence**: Amazing natural light (south-facing, floor-to-ceiling)
> ✅ **High confidence**: €1,400/month, well under your €1,800 limit
> ⚠️ **Worth checking**: Living room could work for WFH, but no dedicated office
> ⚠️ **Worth checking**: Large enough for morning yoga
> ❓ **Ask when you visit**: Street has bars — visit on a weekend evening to check noise

### Step 7: The Flywheel (Getting Smarter)

When María requests a viewing, the **Analysis pipeline** runs. This extracts detailed observations that feed back into Geo-Intelligence:

```
María requests viewing
        ↓
Analysis runs (Basic Pipeline)
        ↓
Extracts: "Pre-war building, humidity in bathroom, bar 50m away"
        ↓
Observations → Geo-Intelligence
        ↓
Next time ANY user searches this area:
  • Know about this building's humidity issue
  • Know about bar noise potential
  • Can filter/warn based on real observations
```

**The more Analysis runs, the smarter Recommender gets.** This is the Flywheel — data from Analysis feeds Geo-Intelligence, which expands what Recommender can search for.

---

## System Overview

### Data Source: Harvest Engine

All listing data comes from the **Harvest Engine** (see [HARVEST_ENGINE_ARCH.md](./HARVEST_ENGINE_ARCH.md)):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LISTING CORPUS (from Harvest Engine)                                        │
│                                                                             │
│ • 3,635 Spanish real estate domains                                         │
│ • ~650k listing URLs (sitemap + crawl)                                      │
│ • Full HTMLs in AWS S3 (~537 GB)                                            │
│ • Parsed listing data in AWS DynamoDB                                       │
│ • Daily cron updates (new/changed listings)                                 │
│                                                                             │
│ RECOMMENDER-SPECIFIC                                                        │
│ • WPA Cache (Whole Property Analyses) — grows over time                     │
│ • Geo-Intelligence layer — neighborhood/building/street knowledge           │
│ • Life Profiles — user lifestyle needs                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Pipeline (Overview)

```
USER SIGNS UP → Leo Intake Conversation → Life Profile
                                              ↓
                                    Generate Sweet Spot (Geoapify)
                                              ↓
                        ┌─────────────────────┴─────────────────────┐
                        ↓                                           ↓
              FILTERING (FREE)                            GEO-INTELLIGENCE
              Supabase queries                            (constant dossier check)
              Geo → SQL → Keywords                        "What do we know?"
                        ↓                                           ↓
                        └─────────────────────┬─────────────────────┘
                                              ↓
                                    TOP 15-20 CANDIDATES
                                              ↓
                              ┌───────────────┴───────────────┐
                              ↓                               ↓
                        ALREADY ANALYZED?                 NOT YET?
                              ↓                               ↓
                        Use cached (FREE)            Run Whole Property
                                                     Analysis (~$0.05)
                                                     Store in cache
                              ↓                               ↓
                              └───────────────┬───────────────┘
                                              ↓
                                    SCORE AGAINST LIFE PROFILE
                                              ↓
                                    RECOMMEND 5-8 PROPERTIES
                                    (with confidence levels)
                                              ↓
                                    USER REQUESTS VIEWING
                                              ↓
                                    ANALYSIS RUNS → FLYWHEEL
                                    (observations feed geo_intelligence)
```

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
└─────────────────────────────────────────────────────────────────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    SPIDER     │           │      AWS      │           │   EXTERNAL    │
│  URL Corpus   │           │    HTMLs      │           │    APIs       │
│  (all Spain)  │           │ (main cities) │           │ (Cadastre,    │
│               │           │               │           │  Geoapify)    │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        │                           ▼                           │
        │                   ┌───────────────┐                   │
        │                   │    PARSER     │                   │
        │                   │  HTML → JSON  │                   │
        │                   └───────────────┘                   │
        │                           │                           │
        ▼                           ▼                           │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  listings   │  │    user_    │  │    geo_     │  │  property_  │        │
│  │   table     │  │  profiles   │  │intelligence │  │  analyses   │        │
│  │ (parsed     │  │  (Life      │  │  (dossier   │  │  (cached    │        │
│  │  data)      │  │  Profiles)  │  │   system)   │  │   WPA)      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
        │                   │               │                   │
        ▼                   ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RECOMMENDATION ENGINE                              │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ STAGE 1-5: FILTERING (FREE)                                          │  │
│  │                                                                      │  │
│  │  User Profile ──▶ Sweet Spot ──▶ Geo Filter ──▶ SQL Filter ──▶      │  │
│  │                                  (listings)     (listings)           │  │
│  │                                                      │               │  │
│  │                     ◀─── Dossier Check ◀────────────┘               │  │
│  │                          (geo_intelligence)                          │  │
│  │                                  │                                   │  │
│  │                                  ▼                                   │  │
│  │                          TOP 15-20 CANDIDATES                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│  ┌──────────────────────────────────┴───────────────────────────────────┐  │
│  │ STAGE 6: WHOLE PROPERTY ANALYSIS                                     │  │
│  │                                                                      │  │
│  │  For each candidate:                                                 │  │
│  │    ┌─────────────────────────────────────────┐                       │  │
│  │    │ Check: property_analyses cache          │                       │  │
│  │    │        (by listing_id)                  │                       │  │
│  │    └─────────────────────────────────────────┘                       │  │
│  │              │                         │                             │  │
│  │              ▼                         ▼                             │  │
│  │         CACHED?                   NOT CACHED?                        │  │
│  │              │                         │                             │  │
│  │              ▼                         ▼                             │  │
│  │         Use it (FREE)          Run Gemini 3 Pro (~$0.05)             │  │
│  │                                        │                             │  │
│  │                                        ▼                             │  │
│  │                                 Store in cache                       │  │
│  │                                 Feed geo_intelligence                │  │
│  │                                        │                             │  │
│  │              └────────────┬────────────┘                             │  │
│  │                           ▼                                          │  │
│  │                   ANALYZED PROPERTIES                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│  ┌──────────────────────────────────┴───────────────────────────────────┐  │
│  │ STAGE 7: SCORING                                                     │  │
│  │                                                                      │  │
│  │  Property Analysis + User Profile ──▶ Life Fit Score                 │  │
│  │                                                                      │  │
│  │  "Could this place support how they want to live?"                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│                          TOP 5-8 RECOMMENDATIONS                            │
│                          (with confidence levels)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THE FLYWHEEL                                    │
│                                                                             │
│  When user requests viewing → Analysis runs → Extracts observations         │
│           │                                                                 │
│           ├──▶ Building observations → geo_intelligence                     │
│           ├──▶ Street observations → geo_intelligence                       │
│           └──▶ Room condition findings → geo_intelligence                   │
│                                                                             │
│  RESULT: Recommender gains more searchable categories over time             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Flywheel in Detail

**Flywheel = Analysis feeds Geo-Intelligence → Recommender gains capabilities**

| Source | What It Extracts | Where It Goes |
|--------|------------------|---------------|
| **WPA (Recommender)** | Building observations, street observations | `geo_intelligence` |
| **Basic Pipeline (Analysis)** | Deep room findings, condition details | `geo_intelligence` |
| **Cadastre API** | Building year, official area, construction | `geo_intelligence` |

**Example flywheel cycle:**

```
1. María requests viewing at Carrer Blai 45
        ↓
2. Analysis (Basic Pipeline) runs on the property
        ↓
3. Extracts observations:
   - "Pre-war building, original tiles visible"
   - "Photos show bar signage across street"
   - "Humidity stains in bathroom"
        ↓
4. Observations → geo_intelligence:
   { building: {...}, street: "Carrer Blai", insight: "noise_source", value: "bars" }
        ↓
5. Pedro searches next week, noise-sensitive
        ↓
6. Recommender queries geo_intelligence for Carrer Blai area
        ↓
7. Carrer Blai properties get flagged automatically:
   "⚠️ Building intelligence suggests bar noise — check when you visit"
```

**The more Analysis runs, the smarter Recommender gets.**

### What This Enables Over Time

| Analyses Run | New Recommender Capabilities |
|--------------|------------------------------|
| 100 | Era patterns (1960s = aluminosis risk) |
| 1,000 | Neighborhood vibes (Poble Sec = young, noisy) |
| 10,000 | Street-level intelligence (Carrer Blai = bars) |
| 50,000 | Building-level knowledge (specific buildings flagged) |

---

## Phase 1: Understand the Life (Intake)

See `WHAT_LEO_LEARNS.md` for the complete schema.

**Key principle**: We collect a "Life Profile" — not a filter list, but a picture of how they want to live.

### What We Capture

| Category | Examples |
|----------|----------|
| **Anchors** | Where they need to be (work, gym, family) |
| **Home Use** | Who lives there, WFH, hosting, hobbies |
| **Tolerances** | Noise, light, stairs |
| **Taste** | Modern vs. character, aesthetic preferences |
| **Appetite** | Move-in ready vs. willing to renovate |
| **Flexibility** | What they could compromise on |

### Fuzzy Requirements

Users often can't give direct answers. We store the *intent*:

```json
{
  "space_purposes": [
    { "need": "guest_sleeping", "priority": "important", "flexibility": "sofa bed ok" },
    { "need": "work_from_home", "priority": "important", "flexibility": "corner of room ok" }
  ]
}
```

Not: `WHERE bedrooms >= 3`

---

## Phase 2: Find Candidates (Free Filtering)

### Stage 1: Geo Filter

**Sweet Spot Polygon**: Where all their commute needs intersect (Geoapify isochrones + Turf.js intersection)

**Special case**: If a user has no anchors (fully remote, no specific gym/family needs), their sweet spot is the **entire city**. This is fine — the other filters will narrow it down.

**5 Opportunity Areas**: We also generate "what if you flexed?" zones:
1. 5 mins longer commute to work
2. Different transport mode (bike instead of metro)
3. Edge of their preferred neighborhood
4. Up-and-coming adjacent neighborhood
5. The "hidden gem" zone (places most people overlook)

These show users what's possible if they're flexible, and often surface great options.

**Result**: ~300 candidates

### Stage 2: Hard Constraints (SQL)
- Price ceiling
- Minimum sqm
- Dealbreakers (e.g., no elevator + stairs_tolerance = 0)
- **Result**: ~100 candidates

### Stage 3: Soft Scoring
- Amenity matches (terrace, AC, pool, etc.)
- Building age alignment
- Condition alignment (move-in ready vs. project)
- Keyword signals from description ("luminoso", "reformado", "amplio")
- **Result**: Ranked ~100 candidates

### Stage 4: Cadastre Enrichment
- Verify building year
- Check area discrepancy (listing vs. official)
- Apply era-specific risk patterns (pre-1960 → aluminosis risk)
- **Result**: Risk-adjusted scores

### Stage 5: Top Selection
- Take top 15-20 by combined score
- Ensure diversity (some from each opportunity area)

---

## Phase 3: Geo-Intelligence (The Dossier System)

The Geo-Intelligence layer is our **institutional memory** — everything we've ever learned about buildings, streets, neighborhoods, and patterns, stored with coordinates so we can query it spatially.

Think of it like an intelligence agency's dossier system: "Do we have anything on file for this location?"

### Core Principle

**We won't have exact matches early on. That's fine.**

The system is designed to work with partial knowledge:
- Exact building match? Great, high confidence.
- Only know about a building 200m away? Still useful, lower confidence.
- Only know era patterns for the city? Still better than nothing.

**We're honest about what we know and don't know.**

### What Gets Stored

| Type | Example | Radius | Source |
|------|---------|--------|--------|
| **Property** | "This flat has humidity in bathroom" | 0m (exact) | Whole Property Analysis |
| **Building** | "This building is pre-1960, has old wiring" | 10m | Basic Pipeline / Cadastre |
| **Street** | "Carrer de Blai is noisy weekends (bars)" | 50m along road | Analysis + User Feedback |
| **Immediate Area** | "Bar on corner, can hear music" | 200m | Analysis |
| **Neighborhood** | "Poble Sec: young, lively, gentrifying" | 500m / barrio | Research + Patterns |
| **Era Pattern** | "1960s Barcelona: aluminosis risk, small kitchens" | City-wide | Aggregated analyses |
| **POI** | "CrossFit Poblenou: hardcore vibe, rating 4.5" | Point | Places API + Vibe Check |

### Data Model

```sql
CREATE TABLE geo_intelligence (
  id BIGSERIAL PRIMARY KEY,
  
  -- Location
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  radius_m INTEGER DEFAULT 0,  -- 0=exact point, 10=building, 500=neighborhood
  
  -- For street-level (optional)
  street_name TEXT,
  
  -- For neighborhood-level (optional)
  barrio TEXT,
  city TEXT,
  
  -- For era patterns (optional)
  building_era TEXT,  -- '1960s', 'pre-1940', 'post-2000'
  
  -- The insight itself
  insight_type TEXT NOT NULL,  -- 'property', 'building', 'street', 'neighborhood', 'era', 'poi'
  insight_category TEXT,  -- 'noise', 'structural', 'condition', 'vibe', 'amenity'
  insight_key TEXT NOT NULL,  -- 'noise_level', 'aluminosis_risk', 'gym_quality'
  insight_value JSONB NOT NULL,
  
  -- Confidence & Provenance
  confidence DECIMAL(3, 2) DEFAULT 0.50,  -- 0.00 to 1.00
  source_type TEXT,  -- 'whole_property_analysis', 'basic_pipeline', 'user_feedback', 'research', 'cadastre', 'places_api'
  source_listing_id BIGINT,
  source_ids BIGINT[],
  observation_count INTEGER DEFAULT 1,
  
  -- Schema tracking
  schema_version TEXT DEFAULT '1.0',
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Spatial index for fast geo queries
CREATE INDEX idx_geo_intelligence_location ON geo_intelligence 
  USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326));

-- Index for era pattern queries
CREATE INDEX idx_geo_intelligence_era ON geo_intelligence (city, building_era) 
  WHERE insight_type = 'era';

-- Index for neighborhood queries  
CREATE INDEX idx_geo_intelligence_barrio ON geo_intelligence (city, barrio) 
  WHERE insight_type = 'neighborhood';
```

### How We Query: Concentric Circles of Knowledge

When evaluating a listing, we query in expanding circles until we find something useful.

```
For listing at (lat, lng), year_built 1965, in Poble Sec, Barcelona:

┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 1: EXACT BUILDING                                        │
│  Query: Within 10m AND same cadastre ref                        │
│  Confidence: 95%                                                │
│  Early days: Almost never matches                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (no match)
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 2: SAME STREET                                           │
│  Query: Same street_name OR within 50m along road axis          │
│  Confidence: 70%                                                │
│  Early days: Rare                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (no match)
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 3: IMMEDIATE AREA                                        │
│  Query: Within 200m radius                                      │
│  Confidence: 50%                                                │
│  Early days: Sometimes                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (found: "bar 150m away is noisy")
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 4: NEIGHBORHOOD                                          │
│  Query: Same barrio OR within 500m                              │
│  Confidence: 40%                                                │
│  Early days: Likely                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (found: "Poble Sec: lively, young")
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 5: BUILDING ERA PATTERN                                  │
│  Query: Same building_era AND city                              │
│  Confidence: 30%                                                │
│  Early days: Likely (after ~100 analyses)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (found: "1960s BCN: aluminosis risk")
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 6: CITY-WIDE BASELINE                                    │
│  Query: Same city, general patterns                             │
│  Confidence: 20%                                                │
│  Early days: Always available                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Query Implementation

```typescript
interface GeoIntelligenceQuery {
  lat: number;
  lng: number;
  cadastre_ref?: string;
  street_name?: string;
  barrio?: string;
  city: string;
  year_built?: number;
}

async function queryGeoIntelligence(query: GeoIntelligenceQuery): Promise<GeoInsight[]> {
  const results: GeoInsight[] = [];
  
  // Level 1: Exact building (cadastre match)
  if (query.cadastre_ref) {
    const exact = await db.query(`
      SELECT *, 0 as distance_m FROM geo_intelligence 
      WHERE source_cadastre_ref = $1
    `, [query.cadastre_ref]);
    results.push(...exact.map(r => ({
      ...r, effective_confidence: r.confidence * 0.95
    })));
  }
  
  // Level 2-4: Spatial queries (expanding radius)
  const spatial = await db.query(`
    SELECT *, ST_Distance(...) as distance_m
    FROM geo_intelligence
    WHERE ST_DWithin(..., 500)  -- 500m max
    ORDER BY distance_m ASC
  `, [query.lng, query.lat]);
  
  results.push(...spatial.map(r => ({
    ...r, effective_confidence: r.confidence * distanceDecay(r.distance_m)
  })));
  
  // Level 5: Era patterns
  if (query.year_built) {
    const era = getEraFromYear(query.year_built);
    const eraPatterns = await db.query(`
      SELECT * FROM geo_intelligence
      WHERE insight_type = 'era' AND building_era = $1 AND city = $2
    `, [era, query.city]);
    results.push(...eraPatterns.map(r => ({
      ...r, effective_confidence: r.confidence * 0.30
    })));
  }
  
  return deduplicateInsights(results)
    .sort((a, b) => b.effective_confidence - a.effective_confidence);
}

function distanceDecay(distance_m: number): number {
  if (distance_m <= 10) return 1.0;
  if (distance_m <= 50) return 0.9;
  if (distance_m <= 100) return 0.75;
  if (distance_m <= 200) return 0.6;
  if (distance_m <= 300) return 0.45;
  return 0.3;
}
```

### Confidence Growth Over Time

| Stage | Data Volume | Typical Query Results |
|-------|-------------|----------------------|
| **Day 1** | 0 analyses | City baseline only (20% confidence) |
| **100 analyses** | Scattered | Era patterns emerging, some neighborhoods (25-35%) |
| **1,000 analyses** | Good coverage | Most neighborhoods covered, some streets (40-50%) |
| **10,000 analyses** | Dense in popular areas | Street-level in hot areas, buildings starting (60-70%) |
| **50,000 analyses** | Comprehensive | Building-level common, high confidence (80-90%) |

### How Insights Get Created

| Source | Trigger | What It Adds |
|--------|---------|--------------|
| **Whole Property Analysis** | Top 20 filtering | Property condition, building observations, street observations |
| **Basic Pipeline** | User requests viewing | Deep room-by-room analysis, detailed condition assessment |
| **User Feedback** | After visit/dismiss | Noise reports, building impressions, actual visit learnings |
| **Research** | Pre-launch seeding | Neighborhood profiles, known era issues (aluminosis, etc.) |
| **Cadastre API** | Any query | Building year, official area, construction type |

### The "Viewing Requested" Trigger

When a user clicks "Request Viewing" on a property, we run a **deeper analysis** (the Basic Pipeline we already built):

```
USER CLICKS: "I want to see this place"
                    ↓
SYSTEM: This listing hasn't had deep analysis yet
                    ↓
TRIGGER: Run Basic Pipeline (detailed room-by-room)
                    ↓
RESULT: 
  - Deep condition assessment per room
  - Specific renovation estimates
  - Detailed findings stored in geo_intelligence
  - User gets viewing confirmation + extra intel
```

**Why this trigger?** We don't want to run expensive deep analysis on every listing. But if someone is serious enough to request a viewing, it's worth investing ~$0.10-0.15 to give them (and future users) much better intelligence.

This is different from the Whole Property Analysis (WPA):

| | Whole Property Analysis | Basic Pipeline |
|---|---|---|
| **Trigger** | Top 20 filtering | Viewing requested |
| **Depth** | Comprehensive overview | Room-by-room detail |
| **Cost** | ~$0.05 | ~$0.10-0.15 |
| **Output** | Property Profile | Deep findings + geo intel |

---

## Phase 4: Whole Property Analysis

**Cost**: ~$0.05 per property (Gemini 3 Pro Preview)  
**Run on**: Top 15-20 candidates only

### Key Principle: Analyze Once, Score Many Times

We don't analyze for a specific user. We extract a comprehensive "Property Profile" that can be scored against any user.

```
ONE PROPERTY ANALYSIS → STORED FOREVER
         ↓
    ┌────┴────┐────────┐
    ↓         ↓        ↓
 User A    User B   User C
    ↓         ↓        ↓
 Score 85%  Score 62%  Score 91%
```

**Concrete example:**

Property at Carrer Valencia 200 gets analyzed once:
```json
{
  "layout": { "style": "open_plan", "flexibility": "high" },
  "light": { "overall": "excellent", "best_rooms": ["living", "bedroom_1"] },
  "potential": {
    "wfh": "dedicated_room",
    "hosting": "living_room_fits_6-8",
    "guest_sleeping": "guest_bedroom"
  }
}
```

**Same analysis, three different users:**

| User | Their Needs | Score | Why |
|------|-------------|-------|-----|
| **María** | WFH + yoga space | 95% | Dedicated office + open living for yoga |
| **Carlos** | Dinner parties + no WFH | 80% | Great for hosting, dedicated office wasted |
| **Lucía** | Guests weekly + dark preference | 45% | Has guest room, but too bright for her |

**The property didn't change. We just re-scored it against different profiles.**

This is why the WPA must be **comprehensive** — we need to extract everything that anyone might ever care about, not just what the current user asked for.

### WPA Schema (v1.2)

```typescript
interface WholePropertyAnalysis {
  schema_version: string;  // "1.2"
  analyzed_at: string;
  photo_count: number;
  
  // CORE (always extracted)
  rooms: RoomAnalysis[];
  layout: LayoutAnalysis;
  light: LightAnalysis;
  condition: ConditionAnalysis;
  aesthetic: AestheticAnalysis;
  outdoor_space: OutdoorAnalysis | null;
  
  // POTENTIAL (v1.1+)
  potential: {
    hosting: string;        // "living_room_fits_6-8_people"
    wfh: string;            // "dedicated_room" | "corner_possible" | "none"
    guest_sleeping: string; // "guest_bedroom" | "sofa_bed_possible" | "none"
  };
  
  // EXTENDED (v1.2+)
  extended?: {
    exercise_space?: string;   // "dedicated_room" | "living_room_clearable" | "none"
    instrument_space?: string; // "fits_piano" | "fits_guitar_only" | "tight"
    pet_friendly?: string;     // "good_layout" | "some_concerns" | "not_ideal"
  };
  
  // OBSERVATIONS (feeds geo_intelligence)
  building_observations?: string[];
  street_observations?: string[];
}

interface RoomAnalysis {
  type: string;           // "living_room", "bedroom", "kitchen"
  size_estimate: string;  // "large", "medium", "small", "tiny"
  light_quality: string;  // "excellent", "good", "limited", "poor"
  condition: string;      // "excellent", "good", "dated", "needs_work"
  features: string[];     // ["balcony_access", "high_ceilings"]
}

interface LayoutAnalysis {
  style: string;          // "open_plan", "semi_open", "traditional_divided"
  flow: string;           // "excellent", "good", "choppy", "awkward"
  flexibility: string;    // "highly_flexible", "some_flexibility", "fixed"
}

interface LightAnalysis {
  overall: string;        // "excellent", "good", "mixed", "limited", "poor"
  best_rooms: string[];
  concerns: string[];
  orientation_guess?: string;
}

interface ConditionAnalysis {
  overall: string;        // "move_in_ready", "light_refresh", "needs_cosmetic", "needs_renovation"
  specifics: { kitchen: string; bathrooms: string; floors: string; walls: string; windows: string; };
  red_flags?: string[];
}

interface AestheticAnalysis {
  style: string;          // "modern_minimal", "traditional_spanish", "dated"
  quality: string;        // "high_end", "mid_range", "basic"
  staging: string;        // "professionally_staged", "lived_in", "empty"
}
```

### The WPA Prompt

```
You are analyzing property listing photos to extract structured intelligence.

TASK: Analyze all provided photos and extract comprehensive information.

## ROOMS - Identify each room, estimate size, assess light and condition
## LAYOUT - Open/divided, flow between spaces, flexibility
## LIGHT - Windows, brightness, orientation clues
## CONDITION - Kitchen, bathrooms, floors, walls, red flags
## AESTHETIC - Style, quality, staging, target demographic
## OUTDOOR - Type, size, usability, sun exposure

## POTENTIAL (critical for matching)
- HOSTING: Could someone host dinner for 6-8?
- WFH: Dedicated office or workable space?
- GUEST SLEEPING: Dedicated room or sofa situation?

## EXTENDED (v1.2)
- EXERCISE: Could someone do yoga/workout?
- INSTRUMENT: Could a piano fit?
- PET FRIENDLY: Good layout for pets?

## OBSERVATIONS (for geo_intelligence)
- BUILDING: Anything visible about the building?
- STREET: Anything visible about the street?

Be specific. If unclear from photos, say "unclear".
```

### Handling Context Window Limits (30+ Photos)

```typescript
async function analyzePropertyMultiPass(photos: string[]): Promise<WholePropertyAnalysis> {
  const MAX_PHOTOS_PER_PASS = 20;
  
  if (photos.length <= MAX_PHOTOS_PER_PASS) {
    return await runSinglePassAnalysis(photos);
  }
  
  // Pass 1: Core analysis (first 20 photos)
  const corePhotos = photos.slice(0, MAX_PHOTOS_PER_PASS);
  const coreAnalysis = await runCoreAnalysis(corePhotos);
  
  // Pass 2: Extended potentials (remaining photos + context)
  const remainingPhotos = photos.slice(MAX_PHOTOS_PER_PASS);
  const extendedAnalysis = await runExtendedAnalysis(remainingPhotos, coreAnalysis);
  
  return mergeAnalyses(coreAnalysis, extendedAnalysis);
}
```

---

## Phase 5: Scoring & Recommendations

### Scoring Logic

```typescript
function scorePropertyForUser(property: PropertyProfile, user: LifeProfile): Score {
  let score = 0;
  
  // Hard requirements → disqualify
  if (user.needs_wfh && property.potential.wfh === 'none') {
    return { score: 0, disqualified: true, reason: 'No WFH space' };
  }
  
  // Weighted scoring
  score += scoreLight(property.light, user.light_priority) * 0.2;
  score += scoreLayout(property.layout, user.layout_preference) * 0.15;
  score += scorePotential(property.potential, user.space_purposes) * 0.3;
  score += scoreAesthetic(property.aesthetic, user.taste) * 0.15;
  score += scoreCondition(property.condition, user.renovation_appetite) * 0.2;
  
  return { score, reasons: [...] };
}
```

### Confidence Levels in Explanations

| Confidence | Source | Example |
|------------|--------|---------|
| ✅ **High** | Data | "15 min walk to your office" |
| ⚠️ **Medium** | Photo analysis | "Living room looks large enough for hosting" |
| ❓ **Low** | Unknown/inferred | "Street noise — worth checking when you visit" |

---

## Schema Evolution (The Cron Job)

### The Problem

Users ask for things we don't currently extract:
- "I do yoga at home — is there space?"
- "I have a piano — could it fit?"
- "I have a big dog — is the layout pet-friendly?"

If we don't extract it, we can't score for it.

### The Solution: Weekly Schema Review

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEEKLY CRON: SCHEMA EVOLUTION (Sundays 2am)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
    STEP 1: Aggregate user needs from last 30 days
            → { "yoga_space": 8, "piano_room": 5, "pet_friendly": 3 }
                                    │
    STEP 2: Compare to current WPA schema
            → Identify gaps (things users want that we don't extract)
                                    │
    STEP 3: Apply threshold rules
            • 1-2 users: Log only
            • 3-4 users: Add to schema (new analyses only)
            • 5+ users: Add + backfill top 1000 properties
                                    │
    STEP 4: Generate new prompt version (e.g., v1.3)
                                    │
    STEP 5: Queue backfill jobs (spread over 48h)
                                    │
    STEP 6: Log & notify team
```

### Schema Version Tracking

```sql
CREATE TABLE wpa_prompt_versions (
  version TEXT PRIMARY KEY,
  prompt_text TEXT NOT NULL,
  added_fields TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schema_evolution_log (
  id BIGSERIAL PRIMARY KEY,
  run_date DATE NOT NULL,
  user_requests JSONB,
  gaps_identified TEXT[],
  fields_added TEXT[],
  backfill_queued INTEGER,
  new_schema_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## New City Request Flow

When a user requests a city we don't have:

```
USER: "I want to search in Málaga"
                ↓
SYSTEM: Check — Málaga HTMLs ready?
                ↓
            NO
                ↓
LEO: "Málaga is a beautiful choice! I need about 24 hours 
      to prepare the market data. I'll notify you when ready."
                ↓
BACKEND JOB:
  1. Filter spider URLs for Málaga
  2. Scrape full HTMLs → AWS
  3. Parse → Supabase
  4. Cadastre enrichment
  5. Mark city "ready"
  6. Notify user
```

### City Readiness States

| State | Meaning |
|-------|---------|
| `ready` | Full HTMLs, parsed, can serve |
| `scraping` | Job in progress, ETA ~24h |
| `spider_only` | Have URLs, no HTMLs |
| `unknown` | Not in corpus |

---

## Cost Model

### Per-Search Cost

| Stage | Cost |
|-------|------|
| Intake conversation | ~$0.01 |
| Sweet spot generation | FREE (Geoapify) |
| Filtering (Stages 1-5) | FREE (SQL) |
| Dossier check | FREE (cached) |
| Whole Property Analysis | ~$0.05 × N uncached |
| Scoring | FREE |

### Scenarios

| Scenario | Uncached | Cost |
|----------|----------|------|
| Cold start | 15/15 | ~$0.75 |
| 50% cache | 7-8/15 | ~$0.40 |
| 80% cache | 3/15 | ~$0.15 |
| Fully cached | 0/15 | ~$0.01 |

### Corpus Analysis (One-Time)

| City | Listings | Cost |
|------|----------|------|
| Barcelona | ~20,000 | ~$1,000 |
| Madrid | ~25,000 | ~$1,250 |
| Valencia | ~10,000 | ~$500 |
| **Total** | ~55,000 | **~$2,750** |

### Year 1 Projection

| Phase | Cost |
|-------|------|
| Initial corpus | ~$2,750 |
| Monthly refresh (×12) | ~$3,000-4,500 |
| **Total** | **~$6,000-7,500** |

---

## What Text Can vs. Can't Find

| User Need | Text? | Photos? | Visit? |
|-----------|-------|---------|--------|
| Has terrace | ✅ | ✅ | - |
| Good light | ⚠️ "luminoso" | ✅ | ✅✅ |
| Large dining area | ❌ | ✅ | - |
| WFH potential | ❌ | ⚠️ | ✅ |
| Quiet street | ❌ | ❌ | ✅✅ |

---

## What Needs to Be Built

| Component | Status | Priority |
|-----------|--------|----------|
| Spider (URL collection) | ❓ TBD | P1 |
| HTML scraping to AWS | ❓ TBD | P1 |
| HTML → Parsed listings | ✅ Exists | - |
| Life Profile intake | ⚠️ Partial | P1 |
| Sweet spot generation | ✅ Exists | - |
| SQL filtering queries | ⚠️ Can build | P2 |
| Geo-Intelligence layer | ❌ Needs building | P1 |
| Whole Property Analysis | ⚠️ Needs adaptation | P2 |
| Scoring engine | ❌ Needs building | P2 |
| Recommendation API | ❌ Needs building | P2 |
| Recommendation UI | ❌ Needs building | P3 |
| Feedback loop | ❌ Needs building | P3 |
| New city queue | ❌ Needs building | P3 |
| Schema evolution cron | ❌ Needs building | P4 |

---

## Open Questions (TBC)

1. **Listing Volume**: Exact numbers for BCN/MAD/VLC
2. **Pre-analyze vs. Lazy**: Entire corpus upfront, or on-demand?
3. **Re-analysis Threshold**: How many users need a feature before backfill?
4. **Feedback Capture**: How to get users to report back after visits?

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [LEO_PLATFORM_ARCHITECTURE.md](./LEO_PLATFORM_ARCHITECTURE.md) | **Master** — How all 4 pillars connect |
| [HARVEST_ENGINE_ARCH.md](./HARVEST_ENGINE_ARCH.md) | Data source — 3,635 domains → parsed listings |
| [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) | What runs when user requests viewing (Analysis + Reno) |
| [WHAT_LEO_LEARNS.md](../parked/WHAT_LEO_LEARNS.md) | Complete intake schema (Life Profile) |
| [SEARCHABLE_CAPABILITIES.md](../parked/SEARCHABLE_CAPABILITIES.md) | What we can filter without AI |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-11-28 | Initial architecture |
| 2025-11-28 | Added data flow, cost model, reusability |
| 2025-11-28 | Consolidated: Merged Geo-Intelligence, Schema Evolution, WPA schema into single doc |
| 2025-11-28 | Added: Plain English example (María), expanded flywheel, "viewing requested" trigger, opportunity areas |
| 2025-01-28 | **Reorganized**: Now references master LEO_PLATFORM_ARCHITECTURE.md. Data source is Harvest Engine. Clarified relationship to ULTIMATE_PIPELINE.md for Analysis/Reno. |

| [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) | What runs when user requests viewing (Analysis + Reno) |
| [WHAT_LEO_LEARNS.md](../parked/WHAT_LEO_LEARNS.md) | Complete intake schema (Life Profile) |
| [SEARCHABLE_CAPABILITIES.md](../parked/SEARCHABLE_CAPABILITIES.md) | What we can filter without AI |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-11-28 | Initial architecture |
| 2025-11-28 | Added data flow, cost model, reusability |
| 2025-11-28 | Consolidated: Merged Geo-Intelligence, Schema Evolution, WPA schema into single doc |
| 2025-11-28 | Added: Plain English example (María), expanded flywheel, "viewing requested" trigger, opportunity areas |
| 2025-01-28 | **Reorganized**: Now references master LEO_PLATFORM_ARCHITECTURE.md. Data source is Harvest Engine. Clarified relationship to ULTIMATE_PIPELINE.md for Analysis/Reno. |

| [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) | What runs when user requests viewing (Analysis + Reno) |
| [WHAT_LEO_LEARNS.md](../parked/WHAT_LEO_LEARNS.md) | Complete intake schema (Life Profile) |
| [SEARCHABLE_CAPABILITIES.md](../parked/SEARCHABLE_CAPABILITIES.md) | What we can filter without AI |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-11-28 | Initial architecture |
| 2025-11-28 | Added data flow, cost model, reusability |
| 2025-11-28 | Consolidated: Merged Geo-Intelligence, Schema Evolution, WPA schema into single doc |
| 2025-11-28 | Added: Plain English example (María), expanded flywheel, "viewing requested" trigger, opportunity areas |
