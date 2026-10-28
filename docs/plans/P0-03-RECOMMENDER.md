# P0-03: Recommender Pipeline — Fit Scoring

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Overview

The recommender pipeline scores properties against user preferences using a combination of:
- Pre-WPA filtering (FREE, algorithmic)
- WPA analysis (cached, ~$0.003/listing)
- Location scoring (graduated penalties)
- Neighborhood matching (pre-computed)

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECOMMENDER PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. HARVEST FILTER (DynamoDB Query)                                        │
│   ───────────────────────────────────                                        │
│   Filter by: city, price, bedrooms, area                                    │
│   Result: ~500-2000 listings                                                │
│   Cost: FREE                                                                │
│                                                                             │
│   2. PRE-WPA FIT SCORE (Algorithmic)                                        │
│   ────────────────────────────────────                                      │
│   Score by: location penalty, neighborhood match, listing basics           │
│   Filter: Keep top 100 by pre-WPA score                                    │
│   Cost: FREE                                                                │
│                                                                             │
│   3. WPA ANALYSIS (Gemini Flash-Lite)                                       │
│   ─────────────────────────────────────                                     │
│   Run WPA on top 100 (or use cache)                                         │
│   Cost: ~$0.003/listing (cached)                                            │
│                                                                             │
│   4. FULL FIT SCORE (Algorithmic)                                           │
│   ──────────────────────────────────                                        │
│   Combine: WPA scores × user weights + location + neighborhood             │
│   Cost: FREE                                                                │
│                                                                             │
│   5. THRESHOLD FILTER                                                       │
│   ───────────────────                                                       │
│   Keep listings with fit score >= 50                                        │
│                                                                             │
│   6. EXPLANATION (Flash-Lite)                                               │
│   ───────────────────────────                                               │
│   Generate personalized "why" for top listings                              │
│   Cost: ~$0.001/listing                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pre-WPA Fit Score (FREE)

Before running expensive WPA, score listings using FREE data:

```typescript
// src/lib/recommender/preWpaFitScore.ts

interface PreWpaScore {
  score: number;           // 0-100
  locationScore: number;   // From commute + neighborhood
  listingScore: number;    // From basics (price, size, etc.)
}

export function calculatePreWpaFitScore(
  listing: Listing,
  profile: UserProfile,
  anchors: Anchor[],
  neighborhoods: NeighborhoodProfile[]
): PreWpaScore {
  
  // 1. Calculate commute penalty (from P0-04-LOCATION-SCORING)
  const commutePenalty = calculateCommutePenalty(listing, anchors);
  
  // 2. Get neighborhood multiplier
  const neighborhood = findNeighborhood(listing, neighborhoods);
  const neighborhoodMultiplier = neighborhood 
    ? calculateNeighborhoodMultiplier(neighborhood, profile.dimensionWeights)
    : 1.0;
  
  // 3. Score listing basics
  const listingScore = scoreListingBasics(listing, profile);
  
  // 4. Combine
  const rawScore = listingScore * neighborhoodMultiplier;
  const finalScore = Math.max(0, rawScore + commutePenalty);
  
  return {
    score: Math.round(finalScore),
    locationScore: neighborhoodMultiplier * 50 + commutePenalty,
    listingScore: listingScore,
  };
}

function scoreListingBasics(listing: Listing, profile: UserProfile): number {
  let score = 50; // Start neutral
  
  // Price fit
  const priceRatio = listing.price / profile.maxBudget;
  if (priceRatio <= 0.8) score += 10;      // Under budget
  else if (priceRatio <= 1.0) score += 5;  // At budget
  else if (priceRatio <= 1.1) score -= 5;  // Slightly over
  else score -= 20;                         // Way over
  
  // Size fit
  const sizeRatio = listing.area / profile.minArea;
  if (sizeRatio >= 1.2) score += 10;       // Spacious
  else if (sizeRatio >= 1.0) score += 5;   // Adequate
  else if (sizeRatio >= 0.9) score -= 5;   // Tight
  else score -= 15;                         // Too small
  
  // Bedrooms fit
  if (listing.bedrooms >= profile.minBedrooms) score += 5;
  else score -= 10;
  
  return Math.max(0, Math.min(100, score));
}
```

---

## Full Fit Score (After WPA)

Combines all signals into final score:

```typescript
// src/lib/recommender/fitScoringV2.ts

interface FitResult {
  score: number;              // 0-100 overall fit
  pass: boolean;              // Score >= 50
  reason: string;             // Human-readable summary
  breakdown: {
    wpaScore: number;         // From WPA analysis
    locationScore: number;    // Commute + neighborhood
    listingScore: number;     // Basics (price, size)
  };
  topMatches: string[];       // Top 3 matching dimensions
  concerns: string[];         // From WPA concerns
  failReason?: string;        // If pass = false
}

export function calculateFitScore(
  wpa: WPAOutput,
  profile: UserFitProfile,
  neighborhood: NeighborhoodProfile | null,
  listing: ListingBasics,
  anchors: Anchor[]
): FitResult {
  
  // STEP 1: DEALBREAKER CHECKS (Instant Fail)
  const dealbreaker = checkDealbreakers(wpa, profile);
  if (dealbreaker) return fail(dealbreaker);
  
  // STEP 2: MUST-HAVE CHECKS (Minimum Thresholds)
  const mustHaveFail = checkMustHaves(wpa, profile);
  if (mustHaveFail) return fail(mustHaveFail);
  
  // STEP 3: WPA WEIGHTED SCORE
  const wpaScore = calculateWpaWeightedScore(wpa, profile.weights);
  
  // STEP 4: NEIGHBORHOOD MULTIPLIER
  const neighborhoodMultiplier = neighborhood 
    ? calculateNeighborhoodMultiplier(neighborhood, profile.dimensionWeights)
    : 1.0;
  
  // STEP 5: COMMUTE PENALTY
  const commutePenalty = calculateCommutePenalty(listing, anchors);
  
  // STEP 6: LISTING BASICS SCORE
  const listingScore = scoreListingBasics(listing, profile);
  
  // STEP 7: COMBINE
  const combinedScore = (wpaScore * 0.5 + listingScore * 0.3 + 70 * 0.2);
  const adjustedScore = combinedScore * neighborhoodMultiplier;
  const finalScore = Math.max(0, adjustedScore + commutePenalty);
  
  // STEP 8: BONUS/PENALTY ADJUSTMENTS
  const adjustments = calculateAdjustments(wpa, profile);
  const score = Math.max(0, Math.min(100, finalScore + adjustments));
  
  return {
    score: Math.round(score),
    pass: score >= 50,
    reason: generateReason(score),
    breakdown: {
      wpaScore,
      locationScore: neighborhoodMultiplier * 50 + commutePenalty,
      listingScore,
    },
    topMatches: findTopMatches(wpa, profile),
    concerns: wpa.concerns,
  };
}
```

---

## User Profile Structure

User preferences come from the AI Profiler (Psychologist):

```typescript
interface UserFitProfile {
  // Dimension weights (0-2, default 1.0)
  // Higher = user cares more
  weights: {
    natural_light_intensity: number;
    wfh_potential: number;
    counter_space: number;
    outdoor_space_quality: number;
    // ... all 35 dimensions
  };
  
  // Dealbreakers (Instant fail if true)
  dealbreakers: {
    cubicle_bathroom: boolean;
    mezzanine_ladder: boolean;
    needs_full_renovation: boolean;
    ground_floor_exposed: boolean;
    is_house_share: boolean;
  };
  
  // Must-haves (Minimum acceptable score)
  must_haves: {
    natural_light_intensity?: number;  // e.g., 60
    outdoor_space_quality?: number;    // e.g., 50
    wfh_potential?: number;            // e.g., 60
  };
  
  // Life situation
  has_children: boolean;
  planning_children: boolean;
  has_pets: boolean;
  works_from_home: boolean;
  living_alone: boolean;
}
```

---

## How User Weights Are Derived

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PSYCHOLOGIST (Gemini 3 Pro) → User Weights                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: Intake conversation transcript                                      │
│                                                                             │
│  User: "I work from home full-time, so I need good light and a quiet       │
│         spot for video calls. Oh, and I cook a lot - love having           │
│         counter space. We might have kids in a couple years."              │
│                                                                             │
│  OUTPUT:                                                                    │
│                                                                             │
│  {                                                                          │
│    weights: {                                                               │
│      natural_light_intensity: 1.8,  // "good light" → high                 │
│      wfh_potential: 2.0,            // "work from home full-time" → max    │
│      counter_space: 1.5,            // "love having counter space"         │
│      neighborhood_quietness: 1.5,   // Implied by WFH                      │
│    },                                                                       │
│    dealbreakers: {                                                          │
│      cubicle_bathroom: true,        // Universal default                    │
│    },                                                                       │
│    must_haves: {                                                            │
│      wfh_potential: 60,             // Must have at least decent WFH       │
│    },                                                                       │
│    planning_children: true,         // "might have kids in a couple years" │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Threshold-Based Flow

Instead of just ranking, we use thresholds:

| Score | Interpretation | Action |
|-------|----------------|--------|
| 80-100 | Excellent match | Show first, highlight |
| 60-79 | Good match | Show in recommendations |
| 50-59 | Decent match | Show if inventory is low |
| 0-49 | Poor match | Don't show |

---

## Batch Processing (3x Daily)

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║                           BATCH PROCESSING (3x Daily)                                   ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

For each user with active profile:
  
  1. QUERY: Get listings matching basic criteria (city, price, bedrooms)
  2. PRE-WPA SCORE: Calculate pre-WPA fit for all listings (FREE)
  3. FILTER: Keep top 100 by pre-WPA score
  4. WPA: Run WPA on listings not in cache
  5. FULL SCORE: Calculate full fit score
  6. FILTER: Keep listings with score >= 50
  7. EXPLAIN: Generate personalized explanation for top 10
  8. NOTIFY: Send email/push if new high-fit listings found
```

---

## Caching Strategy

### WPA Cache (DynamoDB)
- **Key:** listing_id
- **TTL:** 30 days
- **Shared:** All users share same WPA for same listing

### Explanation Cache (Supabase)
- **Key:** user_id + listing_id
- **TTL:** 7 days (preferences may change)
- **Per-user:** Each user gets unique explanation

### Pre-WPA Cache (Optional)
- Can cache pre-WPA scores per user + listing
- Invalidate when user preferences change

---

## Cost Per User

| Step | Cost | Notes |
|------|------|-------|
| Harvest query | FREE | DynamoDB |
| Pre-WPA scoring | FREE | Algorithmic |
| WPA (10 new listings) | ~$0.03 | Most are cached |
| Full scoring | FREE | Algorithmic |
| Explanations (10) | ~$0.01 | Flash-Lite |
| **Total per batch** | **~$0.04** | |

With 3 batches/day for 30 days: ~$3.60/month

---

## Files to Create

```
src/lib/recommender/
├── fitScoringV2.ts        # Full fit scoring algorithm
├── preWpaFitScore.ts      # FREE pre-WPA ranking
├── commuteScoring.ts      # Turf.js commute penalties
├── neighborhoodService.ts # H3 geo-matching
├── profileWeights.ts      # User preference weights
├── orchestratorV2.ts      # Pipeline orchestration
└── explainService.ts      # Personalized explanations
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-02-WPA-PIPELINE](./P0-02-WPA-PIPELINE.md) | WPA describe/score flow |
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | Three-layer heatmap |

---

*Last Updated: December 2024*

