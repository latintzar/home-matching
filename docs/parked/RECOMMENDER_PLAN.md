# Recommender System Plan

## Overview

The Recommender is **100% NEW** - nothing is implemented yet. It matches buyers to properties based on lifestyle needs, not just filters.

## Core Concept

```
Traditional Search: "3 bed, 2 bath, Madrid, <€400k"
Leo Recommender:   "Work from home, have a dog, hate commuting, love natural light"
                   → Scored matches with explanations
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RECOMMENDER FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. INTAKE                                                   │
│     └── Conversational UI → Life Profile                     │
│                                                              │
│  2. SWEET SPOT                                               │
│     └── Life Profile → Geographic candidates (Geoapify)      │
│                                                              │
│  3. FILTER                                                   │
│     └── Harvest DB → Matching listings in sweet spot         │
│                                                              │
│  4. ANALYZE                                                  │
│     └── WPA on shortlist → Deep property understanding       │
│                                                              │
│  5. SCORE                                                    │
│     └── Life Profile × WPA → Fit scores + explanations       │
│                                                              │
│  6. PRESENT                                                  │
│     └── Ranked matches with "why this fits you"              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase R1: Life Profile Intake

### What We Capture

```typescript
interface LifeProfile {
  // Identity
  household: {
    adults: number;
    children: { age: number }[];
    pets: { type: string; size: string }[];
    workSituation: 'remote' | 'hybrid' | 'office' | 'retired';
  };
  
  // Lifestyle DNA
  lifestyle: {
    morningRoutine: string;      // "Coffee on balcony", "Gym at 6am"
    eveningRoutine: string;      // "Cook elaborate meals", "Netflix"
    weekendActivities: string[]; // ["hiking", "hosting friends"]
    dealbreakers: string[];      // ["no natural light", "street noise"]
    mustHaves: string[];         // ["outdoor space", "quiet street"]
  };
  
  // Constraints
  constraints: {
    maxBudget: number;
    maxCommute: { minutes: number; to: string };
    moveInDate: string;
    renovationAppetite: 'turnkey' | 'cosmetic' | 'full';
  };
  
  // Trade-offs (forced choices)
  tradeoffs: {
    spaceVsLocation: number;     // -5 to +5
    newVsCharacter: number;      // -5 to +5
    quietVsVibrant: number;      // -5 to +5
    viewsVsPrivacy: number;      // -5 to +5
  };
}
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R1.1 | Design intake conversation flow | 2h |
| R1.2 | Build conversational UI component | 4h |
| R1.3 | Create Life Profile schema | 1h |
| R1.4 | Store in `user_lifestyle_profiles` (Supabase) | 1h |
| R1.5 | AI extraction from conversation | 3h |

**Total: ~11h**

---

## Phase R2: Sweet Spot Generation

### Geoapify Integration

Use Geoapify to find areas that match lifestyle:

```typescript
// Example: Remote worker who likes hiking
const sweetSpot = await generateSweetSpot(lifeProfile);

// Returns:
{
  primary: [
    { name: "Pozuelo de Alarcón", score: 92, reasons: ["quiet", "nature access", "good internet"] },
    { name: "Las Rozas", score: 88, reasons: ["hiking trails", "family-friendly"] },
  ],
  secondary: [...],
  avoid: [
    { name: "Centro", reasons: ["too noisy", "no parking for weekend trips"] }
  ]
}
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R2.1 | Geoapify API integration | 2h |
| R2.2 | Sweet spot algorithm | 4h |
| R2.3 | Commute time calculations | 2h |
| R2.4 | Amenity scoring (parks, gyms, etc.) | 3h |
| R2.5 | Cache results in `leo-geo-intelligence` | 1h |

**Total: ~12h**

---

## Phase R3: Harvest Filtering

### Query DynamoDB

```typescript
// Filter harvested listings by sweet spot
const candidates = await filterListings({
  locations: sweetSpot.primary.map(s => s.name),
  maxPrice: lifeProfile.constraints.maxBudget,
  minBedrooms: calculateMinBedrooms(lifeProfile.household),
  propertyTypes: inferPropertyTypes(lifeProfile),
});
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R3.1 | DynamoDB query by location | 2h |
| R3.2 | Price/size filtering | 1h |
| R3.3 | Property type inference | 2h |
| R3.4 | Shortlist generation (top 50) | 1h |

**Total: ~6h**

---

## Phase R4: WPA on Shortlist

### Analyze Candidates

For each candidate in shortlist:

```typescript
const wpa = await runWholePropertyAnalysis(listing);

// WPA extracts:
{
  naturalLight: "excellent - south-facing with floor-to-ceiling windows",
  noise: "moderate - busy street but double glazing",
  outdoorSpace: "large terrace with mountain views",
  storage: "limited - single closet per bedroom",
  condition: "needs cosmetic updates in kitchen",
  layout: "open plan living, 3 separate bedrooms",
  // ... 50+ attributes
}
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R4.1 | Batch WPA trigger | 2h |
| R4.2 | Rate limiting (Gemini quotas) | 1h |
| R4.3 | Result caching in `leo-wpa-cache` | 1h |
| R4.4 | Progress tracking UI | 2h |

**Total: ~6h**

---

## Phase R5: Fit Scoring

### Score Algorithm

```typescript
function calculateFitScore(lifeProfile: LifeProfile, wpa: WPA): FitScore {
  const scores = {
    lightScore: scoreNaturalLight(lifeProfile, wpa),      // 0-100
    noiseScore: scoreNoise(lifeProfile, wpa),             // 0-100
    spaceScore: scoreSpace(lifeProfile, wpa),             // 0-100
    outdoorScore: scoreOutdoor(lifeProfile, wpa),         // 0-100
    conditionScore: scoreCondition(lifeProfile, wpa),     // 0-100
    layoutScore: scoreLayout(lifeProfile, wpa),           // 0-100
  };
  
  // Weighted by user's trade-offs
  const weights = calculateWeights(lifeProfile.tradeoffs);
  
  return {
    overall: weightedAverage(scores, weights),
    breakdown: scores,
    explanations: generateExplanations(lifeProfile, wpa, scores),
  };
}
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R5.1 | Scoring functions per attribute | 4h |
| R5.2 | Weight calculation from trade-offs | 2h |
| R5.3 | Explanation generation (AI) | 3h |
| R5.4 | Store scores in `leo-wpa-cache` | 1h |

**Total: ~10h**

---

## Phase R6: Presentation UI

### Match Cards

```typescript
// What user sees
<MatchCard
  listing={listing}
  fitScore={92}
  topReasons={[
    "☀️ Exceptional natural light - exactly what you wanted",
    "🐕 Ground floor with direct garden access for Max",
    "🏃 15 min jog to Casa de Campo trails",
  ]}
  concerns={[
    "⚠️ Kitchen needs updating (you said turnkey preferred)",
  ]}
/>
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R6.1 | Match card component | 3h |
| R6.2 | Explanation display | 2h |
| R6.3 | Comparison view | 3h |
| R6.4 | Save/dismiss actions | 1h |
| R6.5 | Re-ranking based on feedback | 2h |

**Total: ~11h**

---

## Phase R7: Flywheel (Geo-Intelligence)

### Learning from Data

Every WPA feeds back into location intelligence:

```typescript
// After analyzing 100 properties in Salamanca district:
geoIntelligence.update({
  location: "Madrid/Salamanca",
  insights: {
    avgNaturalLight: 7.2,  // out of 10
    avgNoise: 5.8,
    commonIssues: ["dated kitchens", "small balconies"],
    pricePerSqm: { median: 6200, p25: 5100, p75: 7800 },
  }
});
```

### Implementation

| Task | Description | Est. Time |
|------|-------------|-----------|
| R7.1 | Aggregation pipeline | 3h |
| R7.2 | Location-level insights | 2h |
| R7.3 | Trend detection | 2h |
| R7.4 | Feed into sweet spot | 2h |

**Total: ~9h**

---

## Database Tables

### New Tables Needed

| Table | Purpose | Location |
|-------|---------|----------|
| `user_lifestyle_profiles` | Life Profile storage | Supabase |
| `leo-wpa-cache` | WPA results | DynamoDB ✅ |
| `leo-geo-intelligence` | Location insights | DynamoDB ✅ |
| `user_matches` | User → property matches | Supabase |
| `match_feedback` | User reactions | Supabase |

---

## Total Estimates

| Phase | Description | Est. Time |
|-------|-------------|-----------|
| R1 | Life Profile Intake | 11h |
| R2 | Sweet Spot Generation | 12h |
| R3 | Harvest Filtering | 6h |
| R4 | WPA on Shortlist | 6h |
| R5 | Fit Scoring | 10h |
| R6 | Presentation UI | 11h |
| R7 | Flywheel | 9h |
| **Total** | | **~65h** |

---

## Implementation Order

### MVP (Minimal Viable Recommender)
1. R1: Life Profile (simplified)
2. R3: Basic filtering
3. R5: Simple scoring
4. R6: Basic UI

**MVP: ~25h**

### Full Version
5. R2: Sweet spot (Geoapify)
6. R4: WPA integration
7. R7: Flywheel

**Full: ~40h more**

---

## Dependencies

- ✅ Harvest running (populating DynamoDB)
- ✅ DynamoDB tables created
- ✅ WPA pipeline exists (needs DynamoDB integration)
- ⏳ Geoapify API key needed
- ⏳ UI framework for intake conversation

