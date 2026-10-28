# Neighborhood Profiles System

> **Purpose**: Quantified neighborhood intelligence for What-Ifs, Opportunity Mapping, and Fit Scoring.
> 
> **Storage**: DynamoDB `leo-neighborhood-profiles`
> 
> **Source**: SERP research → Gemini 2.5 Flash-Lite extraction

---

## Schema (All Numeric for Querying)

```typescript
interface NeighborhoodProfile {
  // === KEYS ===
  neighborhood_id: string;        // PK: "barcelona-gracia"
  city: string;                   // GSI: for city-level queries
  name: string;                   // Display: "Gràcia"
  
  // === LIFE STAGE FIT (0-100) ===
  // "Who should live here?"
  student_friendly: number;       // Cheap, nightlife, university, shared flats
  young_professional: number;     // Networking, modern, coworking, career
  couple_friendly: number;        // Romantic, walkable, dining, date spots
  family_friendly: number;        // Schools, parks, safe, quiet, playgrounds
  retiree_friendly: number;       // Healthcare, calm, accessible, services
  
  // === LIFESTYLE FIT (0-100) ===
  // "What can you do here?"
  digital_nomad: number;          // Coworking, wifi cafes, expat community
  fitness_friendly: number;       // Gyms, running paths, sports, yoga
  foodie_scene: number;           // Restaurant variety, markets, gastro
  nightlife: number;              // Bars, clubs, late night, party
  arts_culture: number;           // Galleries, theaters, museums, events
  nature_access: number;          // Parks, green space, beach, mountains
  pet_friendly: number;           // Dog parks, pet acceptance, vets
  lgbtq_friendly: number;         // Scene, acceptance, community, pride
  eco_conscious: number;          // Bike lanes, recycling, organic, green
  
  // === UNIVERSAL QUALITY (0-100) ===
  // "How's the quality of life?"
  safety: number;                 // Crime rates, feeling safe at night
  quietness: number;              // Noise levels (100=silent, 0=loud)
  transport: number;              // Metro, bus, bike, walkability
  
  // === ECONOMIC INDICATORS (0-100) ===
  // "What's the market like?"
  gentrification_risk: number;    // 0=stable, 100=rapidly gentrifying
  affordability: number;          // 0=luxury only, 100=budget-friendly
  
  // === QUALITATIVE (for display, not filtering) ===
  vibes: string[];                // ["hipster", "bohemian", "traditional", "touristy"]
  evidence: Record<string, string[]>; // Supporting snippets per dimension
  
  // === META ===
  source_count: number;           // SERP results analyzed
  confidence: 'high' | 'medium' | 'low';
  updated_at: string;             // ISO timestamp
}
```

---

## Usage: What-Ifs Conversations

When Leo asks "would you consider somewhere quieter?" or user says "I need good transport":

```typescript
// User: "I want somewhere more LGBTQ-friendly"
async function findNeighborhoodsForWhatIf(
  currentNeighborhood: string,
  dimension: string,
  minScore: number
): Promise<NeighborhoodProfile[]> {
  const current = await getProfile(currentNeighborhood);
  const currentScore = current[dimension];
  
  // Find neighborhoods that beat current on this dimension
  return queryProfiles({
    city: current.city,
    filter: `${dimension} >= ${Math.max(minScore, currentScore + 10)}`,
    orderBy: `${dimension} DESC`,
    limit: 5
  });
}

// Examples:
// "somewhere quieter" → quietness >= current.quietness + 20
// "good for families" → family_friendly >= 70
// "LGBTQ scene" → lgbtq_friendly >= 70
// "not too gentrified" → gentrification_risk <= 40
```

**Leo's Verbalization:**
```
"Gràcia scores 70 on LGBTQ-friendliness, but if that's important to you, 
Eixample Left scores 85 - it's the heart of the gay scene. The tradeoff? 
It's a bit noisier (quietness: 45 vs Gràcia's 55)."
```

---

## Usage: Opportunity Mapping / Isochrones

For "show me neighborhoods within 30min of my office that are family-friendly":

```typescript
interface OpportunityFilter {
  // From isochrone
  neighborhoods: string[];  // H3-matched neighborhoods in commute range
  
  // From user preferences
  minScores: {
    family_friendly?: number;
    safety?: number;
    transport?: number;
    // ... any dimension
  };
  
  // Economic
  maxGentrification?: number;
  minAffordability?: number;
}

async function findOpportunities(filter: OpportunityFilter): Promise<{
  neighborhood: NeighborhoodProfile;
  matchScore: number;
  tradeoffs: string[];
}[]> {
  const results = [];
  
  for (const id of filter.neighborhoods) {
    const profile = await getProfile(id);
    
    // Check all minimums
    let passes = true;
    for (const [dim, min] of Object.entries(filter.minScores)) {
      if (profile[dim] < min) passes = false;
    }
    
    if (passes) {
      results.push({
        neighborhood: profile,
        matchScore: calculateWeightedScore(profile, filter.minScores),
        tradeoffs: identifyTradeoffs(profile)
      });
    }
  }
  
  return results.sort((a, b) => b.matchScore - a.matchScore);
}
```

---

## Usage: Pre-WPA Fit Scoring

**BEFORE running expensive WPA** (~$0.05/listing), use neighborhood profile as free signal:

```typescript
// From user's LifeProfile
interface UserNeighborhoodWeights {
  // Which dimensions matter (0-10)
  safety: number;           // e.g., 8 (family with kids)
  quietness: number;        // e.g., 7 (WFH)
  lgbtq_friendly: number;   // e.g., 9 (gay couple)
  digital_nomad: number;    // e.g., 6 (remote worker)
  pet_friendly: number;     // e.g., 8 (has dog)
}

function calculatePreWpaNeighborhoodScore(
  profile: NeighborhoodProfile,
  weights: UserNeighborhoodWeights
): number {
  let score = 0;
  let totalWeight = 0;
  
  for (const [dimension, weight] of Object.entries(weights)) {
    if (weight > 0 && profile[dimension] !== undefined) {
      score += profile[dimension] * weight;
      totalWeight += weight * 100;
    }
  }
  
  return totalWeight > 0 ? Math.round(score / totalWeight * 100) : 50;
}

// Use in pre-filtering:
// - Neighborhood score < 30 → skip listing (don't waste WPA)
// - Neighborhood score 30-60 → include but lower priority
// - Neighborhood score > 60 → prioritize for WPA
```

---

## Usage: Post-WPA Fit Scoring (55 Dimensions)

Combines **35 WPA property dimensions** + **20 neighborhood dimensions**:

```typescript
function calculateFullFitScore(
  wpaScores: WPAScores,           // 35 property dimensions
  neighborhoodProfile: NeighborhoodProfile,  // 20 neighborhood dimensions
  userProfile: UserFitProfile
): FitResult {
  
  // Property scores (from WPA)
  const propertyScore = weightedAverage(wpaScores, userProfile.propertyWeights);
  
  // Neighborhood scores (FREE - from cached profile)
  const neighborhoodScore = weightedAverage({
    safety: neighborhoodProfile.safety,
    quietness: neighborhoodProfile.quietness,
    transport: neighborhoodProfile.transport,
    lgbtq_friendly: neighborhoodProfile.lgbtq_friendly,
    // ... all 20 dimensions
  }, userProfile.neighborhoodWeights);
  
  // Combined score (configurable blend)
  const PROPERTY_WEIGHT = 0.65;
  const NEIGHBORHOOD_WEIGHT = 0.35;
  
  return {
    score: propertyScore * PROPERTY_WEIGHT + neighborhoodScore * NEIGHBORHOOD_WEIGHT,
    propertyBreakdown: wpaScores,
    neighborhoodBreakdown: neighborhoodProfile,
    topMatches: findTopMatches(wpaScores, neighborhoodProfile, userProfile),
    concerns: findConcerns(wpaScores, neighborhoodProfile, userProfile),
  };
}
```

---

## Cost Tracking

Uses same pattern as harvest lambdas:

```typescript
// Gemini 2.5 Flash-Lite pricing
const FLASH_LITE_INPUT_PRICE_PER_1M = 0.10;   // $0.10 per 1M input tokens
const FLASH_LITE_OUTPUT_PRICE_PER_1M = 0.40;  // $0.40 per 1M output tokens

interface ExtractionCostTracker {
  neighborhoodsProcessed: number;
  inputTokens: number;
  outputTokens: number;
  serpSearches: number;
  serpCost: number;  // Serper credits used
}

function calculateExtractionCost(tracker: ExtractionCostTracker): number {
  const geminiCost = 
    (tracker.inputTokens / 1_000_000) * FLASH_LITE_INPUT_PRICE_PER_1M +
    (tracker.outputTokens / 1_000_000) * FLASH_LITE_OUTPUT_PRICE_PER_1M;
  
  // Serper: ~$0.004 per search (at $10/2500 credits)
  const serperCost = tracker.serpSearches * 0.004;
  
  return geminiCost + serperCost;
}

// Expected costs per neighborhood:
// - 20 SERP searches: 20 × $0.004 = $0.08
// - 1 Gemini extraction: ~2K input, ~1K output = $0.0006
// - TOTAL: ~$0.08 per neighborhood
// - 86 neighborhoods: ~$7 one-time
```

### Extraction Function with Cost Tracking

```typescript
async function extractNeighborhoodProfile(
  neighborhoodId: string,
  serpResults: SerpResult[],
  tracker: ExtractionCostTracker
): Promise<{ profile: NeighborhoodProfile; cost: number }> {
  
  const prompt = buildExtractionPrompt(serpResults);
  
  const response = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.1,
    maxOutputTokens: 1500,
    responseMimeType: 'application/json',
  });
  
  // Track tokens
  const inputTokens = response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
  
  tracker.inputTokens += inputTokens;
  tracker.outputTokens += outputTokens;
  tracker.neighborhoodsProcessed += 1;
  
  const cost = 
    (inputTokens / 1_000_000) * FLASH_LITE_INPUT_PRICE_PER_1M +
    (outputTokens / 1_000_000) * FLASH_LITE_OUTPUT_PRICE_PER_1M;
  
  console.log(`   Tokens: ${inputTokens} in / ${outputTokens} out`);
  console.log(`   Cost: $${cost.toFixed(4)}`);
  
  return { 
    profile: JSON.parse(response.text),
    cost 
  };
}
```

---

## Gemini Extraction Prompt

```typescript
const NEIGHBORHOOD_EXTRACTION_PROMPT = `
You are analyzing search results about a neighborhood to score it on 20 dimensions.

NEIGHBORHOOD: {neighborhood}, {city}
SEARCH RESULTS:
{serpResults}

Score each dimension 0-100 based ONLY on evidence in the search results.
- 0-30: Negative/poor
- 31-50: Below average  
- 51-70: Average/decent
- 71-85: Good/above average
- 86-100: Excellent/outstanding

If no evidence, use 50 (neutral).

Return JSON:
{
  "student_friendly": <0-100>,
  "young_professional": <0-100>,
  "couple_friendly": <0-100>,
  "family_friendly": <0-100>,
  "retiree_friendly": <0-100>,
  "digital_nomad": <0-100>,
  "fitness_friendly": <0-100>,
  "foodie_scene": <0-100>,
  "nightlife": <0-100>,
  "arts_culture": <0-100>,
  "nature_access": <0-100>,
  "pet_friendly": <0-100>,
  "lgbtq_friendly": <0-100>,
  "eco_conscious": <0-100>,
  "safety": <0-100>,
  "quietness": <0-100>,
  "transport": <0-100>,
  "gentrification_risk": <0-100>,
  "affordability": <0-100>,
  "vibes": ["<3-5 descriptive words>"],
  "evidence": {
    "<dimension>": ["<supporting quote from results>"],
    ...
  }
}
`;
```

---

## DynamoDB Table Schema

```
Table: leo-neighborhood-profiles
PK: neighborhood_id (String)
GSI: city-index (city -> neighborhood_id)

Attributes: All 20 dimension scores stored as Numbers
```

---

## Query Patterns

```typescript
// By city
await docClient.send(new QueryCommand({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-index',
  KeyConditionExpression: 'city = :city',
  ExpressionAttributeValues: { ':city': 'barcelona' }
}));

// By dimension threshold
await docClient.send(new ScanCommand({
  TableName: 'leo-neighborhood-profiles',
  FilterExpression: 'lgbtq_friendly >= :min AND safety >= :safety',
  ExpressionAttributeValues: { ':min': 70, ':safety': 60 }
}));

// Get single profile
await docClient.send(new GetCommand({
  TableName: 'leo-neighborhood-profiles',
  Key: { neighborhood_id: 'barcelona-gracia' }
}));
```

---

## Cost Summary

| Operation | Cost |
|-----------|------|
| Initial research (86 neighborhoods) | ~$7 one-time |
| Per-neighborhood lookup | FREE (DynamoDB) |
| Pre-WPA filtering | FREE (in-memory) |
| Full fit scoring | FREE (cached data) |
| What-If queries | FREE (cached data) |

The $7 investment enables **unlimited free queries** for all users.

---

## Data Pipeline

### Step 1: SERP Collection (~$7)
```bash
npx tsx scripts/serp-specific-dimensions.ts --city=<city>
```
- 20 specific searches per neighborhood (one per dimension)
- Saves raw SERP to `leo-serp-extractions` DynamoDB
- Initial keyword-based scores to `leo-neighborhood-profiles`

### Step 2: Gemini Analysis (~$0.09)
```bash
npx tsx scripts/analyze-neighborhood-serp.ts
```
- Read raw SERP from `leo-serp-extractions`
- Feed snippets to Gemini 2.5 Flash-Lite
- Get proper 0-100 scores + evidence
- Overwrite `leo-neighborhood-profiles` with accurate data

### Collection Status (Updated Dec 4, 2024)

| City | SERP Collected | Gemini Analyzed |
|------|----------------|-----------------|
| Barcelona | ✅ | ✅ |
| Madrid | ✅ | ✅ |
| Valencia | ✅ | ✅ |
| Sevilla | ✅ | ✅ |
| Malaga | ✅ | ✅ |
| Bilbao | ✅ | ✅ |
| San Sebastian | ✅ | ✅ |
| Alicante | ✅ | ✅ |
| Palma | ✅ | ✅ |
| Granada | ✅ | ✅ |

**Total: 84/86 neighborhoods analyzed** (2 had insufficient SERP data)

### Sample Results

**Gràcia, Barcelona:**
- LGBTQ: 85, Safety: 75, Nightlife: 70, Foodie: 85
- Vibes: "pueblo dentro de la ciudad", "bohemio", "local vibes"

**Chueca, Madrid (gay neighborhood):**
- LGBTQ: 100, Safety: 60, Nightlife: 90, Foodie: 85
- Vibes: "vibrant", "chic", "bohemian", "fashionable"

