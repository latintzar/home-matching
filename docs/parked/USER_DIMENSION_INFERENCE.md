# User Dimension Inference System

> **Purpose**: Infer user preferences for 20 neighborhood dimensions without asking survey questions.
> 
> **Philosophy**: Leo infers from conversation, not interrogates with forms.
> 
> **Output**: Weighted dimension scores with confidence levels for fit scoring.

---

## Overview

We score neighborhoods on **20 dimensions** (see `docs/NEIGHBORHOOD_PROFILES.md`). But we don't ask users:
> "On a scale of 1-10, how important is LGBTQ-friendliness?"

Instead, we **infer** from:
1. **Explicit profile data** (household, constraints, tradeoffs)
2. **Keywords in conversation** (transcript analysis)
3. **Behavioral signals** (locations they mention, properties they save)

---

## Output Schema

```typescript
interface DimensionWeight {
  score: number;           // 0-100: How important is this to the user
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  signals_found: number;   // How many proxy rules matched
  should_probe: boolean;   // Should Leo ask about this in What-Ifs?
  evidence: string[];      // What triggered this inference
}

interface UserDimensionWeights {
  // Life Stage
  student: DimensionWeight;
  young_professional: DimensionWeight;
  couple: DimensionWeight;
  family: DimensionWeight;
  retiree: DimensionWeight;
  
  // Lifestyle
  digital_nomad: DimensionWeight;
  fitness: DimensionWeight;
  foodie: DimensionWeight;
  nightlife: DimensionWeight;
  arts_culture: DimensionWeight;
  nature_access: DimensionWeight;
  pet_friendly: DimensionWeight;
  lgbtq_friendly: DimensionWeight;
  eco_conscious: DimensionWeight;
  
  // Universal
  safety: DimensionWeight;
  quietness: DimensionWeight;
  transport: DimensionWeight;
  
  // Economic
  gentrification_preference: DimensionWeight;  // + = wants up-and-coming
  budget_sensitivity: DimensionWeight;
}
```

---

## Proxy Rules

Each dimension has **proxy signals** we can detect from existing data:

### Life Stage Dimensions

```typescript
const LIFE_STAGE_PROXIES = {
  student: {
    signals: [
      { field: 'constraints.maxBudget', condition: '<150000', weight: 0.3 },
      { field: 'household.workSituation', value: 'other', weight: 0.2 },
      { field: 'propertyPreferences.minBedrooms', condition: '<=1', weight: 0.2 },
      { keywords: ['estudiante', 'universidad', 'compartir', 'student'], weight: 0.3 },
    ],
    default_if_no_signals: 30,
  },
  
  young_professional: {
    signals: [
      { field: 'household.workSituation', value: 'hybrid', weight: 0.3 },
      { field: 'household.adults', value: 1, weight: 0.2 },
      { field: 'household.children.length', value: 0, weight: 0.2 },
      { field: 'constraints.maxBudget', range: [200000, 500000], weight: 0.2 },
      { keywords: ['startup', 'networking', 'carrera', 'profesional'], weight: 0.3 },
    ],
    default_if_no_signals: 50,
  },
  
  couple: {
    signals: [
      { field: 'household.adults', value: 2, weight: 0.5 },
      { field: 'household.children.length', value: 0, weight: 0.3 },
      { keywords: ['pareja', 'juntos', 'couple', 'partner'], weight: 0.4 },
    ],
    default_if_no_signals: 40,
  },
  
  family: {
    signals: [
      { field: 'household.children.length', condition: '>0', weight: 0.9 },  // Slam dunk
      { keywords: ['niños', 'hijos', 'colegio', 'school', 'children', 'family'], weight: 0.7 },
      { field: 'propertyPreferences.minBedrooms', condition: '>=3', weight: 0.3 },
    ],
    default_if_no_signals: 20,
  },
  
  retiree: {
    signals: [
      { field: 'household.workSituation', value: 'retired', weight: 0.9 },
      { keywords: ['jubilado', 'retired', 'pensión', 'retirement'], weight: 0.8 },
      { field: 'constraints.commuteDestination', value: '', weight: 0.2 },  // No commute
    ],
    default_if_no_signals: 20,
  },
};
```

### Lifestyle Dimensions

```typescript
const LIFESTYLE_PROXIES = {
  digital_nomad: {
    signals: [
      { field: 'household.workSituation', value: 'remote', weight: 0.7 },
      { keywords: ['coworking', 'wifi', 'nómada', 'nomad', 'freelance', 'remoto'], weight: 0.6 },
      { field: 'constraints.commuteDestination', value: '', weight: 0.3 },  // No fixed office
    ],
    default_if_no_signals: 40,
  },
  
  fitness: {
    signals: [
      { keywords: ['gym', 'gimnasio', 'correr', 'running', 'yoga', 'deporte', 'fitness'], weight: 0.7 },
      { field: 'lifestyle.morningRoutine', contains: ['gym', 'run', 'exercise', 'gimnasio'], weight: 0.8 },
      { field: 'lifestyle.weekendActivities', contains: ['hiking', 'deporte', 'bike'], weight: 0.5 },
    ],
    default_if_no_signals: 50,
  },
  
  foodie: {
    signals: [
      { keywords: ['restaurante', 'gastro', 'cocinar', 'mercado', 'brunch', 'foodie'], weight: 0.6 },
      { field: 'lifestyle.eveningRoutine', contains: ['cook', 'cocinar', 'dinner'], weight: 0.5 },
      { field: 'lifestyle.weekendActivities', contains: ['brunch', 'mercado', 'restaurant'], weight: 0.6 },
    ],
    default_if_no_signals: 50,
  },
  
  nightlife: {
    signals: [
      { field: 'tradeoffs.quietVsVibrant', condition: '>2', weight: 0.8 },  // +5 scale, >2 = vibrant
      { keywords: ['fiesta', 'club', 'bar', 'salir', 'copas', 'nightlife', 'party'], weight: 0.7 },
      { field: 'lifestyle.weekendActivities', contains: ['salir', 'fiesta', 'club'], weight: 0.6 },
    ],
    default_if_no_signals: 50,
  },
  
  arts_culture: {
    signals: [
      { keywords: ['museo', 'teatro', 'gallery', 'arte', 'cultura', 'concierto'], weight: 0.7 },
      { field: 'lifestyle.weekendActivities', contains: ['museo', 'gallery', 'theater'], weight: 0.6 },
    ],
    default_if_no_signals: 50,
  },
  
  nature_access: {
    signals: [
      { keywords: ['parque', 'playa', 'montaña', 'verde', 'naturaleza', 'hiking', 'beach'], weight: 0.7 },
      { field: 'lifestyle.weekendActivities', contains: ['hiking', 'beach', 'park', 'nature'], weight: 0.6 },
      { field: 'lifestyle.mustHaves', contains: ['verde', 'parque', 'nature'], weight: 0.5 },
    ],
    default_if_no_signals: 50,
  },
  
  pet_friendly: {
    signals: [
      { field: 'household.pets.length', condition: '>0', weight: 1.0 },  // Direct match
      { keywords: ['perro', 'dog', 'gato', 'cat', 'mascota', 'pet'], weight: 0.8 },
    ],
    default_if_no_signals: 40,
  },
  
  lgbtq_friendly: {
    signals: [
      // Can't directly ask, but can infer from location preferences
      { keywords: ['chueca', 'gayxample', 'eixample izquierdo', 'pride', 'ambiente gay'], weight: 0.9 },
      { field: 'propertyPreferences.preferredLocations', contains: ['Chueca', 'Gayxample'], weight: 0.9 },
      // Note: We do NOT infer from household structure - that's invasive
    ],
    default_if_no_signals: 50,  // Neutral - don't assume
  },
  
  eco_conscious: {
    signals: [
      { keywords: ['bici', 'bike', 'sostenible', 'sustainable', 'verde', 'eco', 'reciclaje'], weight: 0.6 },
      { field: 'lifestyle.mustHaves', contains: ['bici', 'sostenible', 'bike'], weight: 0.7 },
    ],
    default_if_no_signals: 50,
  },
};
```

### Universal Dimensions

```typescript
const UNIVERSAL_PROXIES = {
  safety: {
    signals: [
      { field: 'household.children.length', condition: '>0', weight: 0.7 },  // Parents care more
      { keywords: ['seguro', 'safe', 'seguridad', 'security', 'safety'], weight: 0.6 },
      { field: 'lifestyle.dealbreakers', contains: ['inseguro', 'unsafe', 'crime'], weight: 0.9 },
    ],
    default_if_no_signals: 60,  // Everyone cares somewhat
  },
  
  quietness: {
    signals: [
      { field: 'tradeoffs.quietVsVibrant', condition: '<-2', weight: 0.9 },  // Strongly prefer quiet
      { field: 'household.workSituation', value: 'remote', weight: 0.5 },   // WFH needs quiet
      { field: 'lifestyle.dealbreakers', contains: ['ruido', 'noise'], weight: 0.9 },
      { keywords: ['tranquilo', 'silencio', 'paz', 'quiet', 'peaceful'], weight: 0.7 },
    ],
    default_if_no_signals: 50,
  },
  
  transport: {
    signals: [
      { field: 'constraints.commuteDestination', condition: '!=empty', weight: 0.6 },
      { field: 'constraints.maxCommuteMinutes', condition: '<30', weight: 0.5 },
      { keywords: ['metro', 'transporte', 'bus', 'cercanías', 'commute'], weight: 0.5 },
      { field: 'household.workSituation', value: 'office', weight: 0.4 },
    ],
    default_if_no_signals: 60,  // Most people need some transport
  },
};
```

### Economic Dimensions

```typescript
const ECONOMIC_PROXIES = {
  gentrification_preference: {
    signals: [
      // Positive = wants up-and-coming areas
      { keywords: ['emergente', 'up and coming', 'potencial', 'transformación', 'trendy'], weight: 0.7 },
      // Negative = wants established areas
      { keywords: ['consolidado', 'established', 'tradicional', 'clásico'], weight: -0.7 },
      // Renovation appetite can be a proxy
      { field: 'constraints.renovationAppetite', value: 'full', weight: 0.3 },  // Willing to renovate = open to rough areas
    ],
    default_if_no_signals: 50,  // Neutral
  },
  
  budget_sensitivity: {
    signals: [
      { field: 'constraints.maxBudget', condition: '<200000', weight: 0.8 },  // Tight budget
      { keywords: ['económico', 'budget', 'barato', 'cheap', 'affordable'], weight: 0.7 },
    ],
    default_if_no_signals: 50,
  },
};
```

---

## Inference Algorithm

```typescript
function inferDimensionWeights(
  profile: LifeProfile,
  conversationTranscript?: string
): UserDimensionWeights {
  
  const weights: UserDimensionWeights = {};
  const allProxies = { ...LIFE_STAGE_PROXIES, ...LIFESTYLE_PROXIES, ...UNIVERSAL_PROXIES, ...ECONOMIC_PROXIES };
  
  for (const [dimension, config] of Object.entries(allProxies)) {
    let totalWeight = 0;
    let signalsMatched = 0;
    const evidence: string[] = [];
    
    for (const signal of config.signals) {
      let matched = false;
      
      // Field-based signals
      if (signal.field) {
        const value = getNestedField(profile, signal.field);
        
        if (signal.value !== undefined && value === signal.value) {
          matched = true;
          evidence.push(`${signal.field} = ${signal.value}`);
        }
        if (signal.condition && evaluateCondition(value, signal.condition)) {
          matched = true;
          evidence.push(`${signal.field} ${signal.condition}`);
        }
        if (signal.contains && Array.isArray(value)) {
          const found = signal.contains.filter(k => value.some(v => v.toLowerCase().includes(k)));
          if (found.length > 0) {
            matched = true;
            evidence.push(`${signal.field} contains [${found.join(', ')}]`);
          }
        }
        if (signal.range && typeof value === 'number') {
          if (value >= signal.range[0] && value <= signal.range[1]) {
            matched = true;
            evidence.push(`${signal.field} in range ${signal.range}`);
          }
        }
      }
      
      // Keyword-based signals (from transcript)
      if (signal.keywords && conversationTranscript) {
        const text = conversationTranscript.toLowerCase();
        const found = signal.keywords.filter(k => text.includes(k.toLowerCase()));
        if (found.length > 0) {
          matched = true;
          evidence.push(`Keywords: [${found.join(', ')}]`);
        }
      }
      
      if (matched) {
        totalWeight += signal.weight;
        signalsMatched++;
      }
    }
    
    // Calculate final score
    const score = signalsMatched > 0 
      ? Math.min(100, Math.round(config.default_if_no_signals + (totalWeight * 50)))
      : config.default_if_no_signals;
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' | 'unknown';
    if (signalsMatched >= 3 || totalWeight >= 0.8) {
      confidence = 'high';
    } else if (signalsMatched >= 2 || totalWeight >= 0.5) {
      confidence = 'medium';
    } else if (signalsMatched >= 1) {
      confidence = 'low';
    } else {
      confidence = 'unknown';
    }
    
    weights[dimension] = {
      score,
      confidence,
      signals_found: signalsMatched,
      should_probe: confidence === 'unknown' || confidence === 'low',
      evidence,
    };
  }
  
  return weights;
}
```

---

## Confidence Levels

| Level | Signals | Meaning | Action |
|-------|---------|---------|--------|
| **high** | 3+ or weight ≥0.8 | We're confident | Use in scoring |
| **medium** | 2 or weight ≥0.5 | Probably right | Use with lower weight |
| **low** | 1 | Weak signal | Use default, consider probing |
| **unknown** | 0 | No data | Use neutral (50), probe if relevant |

---

## Probing Strategy (What-Ifs)

When `should_probe: true`, Leo can ask indirectly during What-Ifs:

```typescript
const PROBE_QUESTIONS = {
  nightlife: "What's your ideal Friday night?",
  quietness: "When you're working from home, do you need total silence or is some background buzz okay?",
  foodie: "Are you the type who knows all the good restaurants, or do you mainly cook at home?",
  nature_access: "How important is having green space or a park nearby?",
  lgbtq_friendly: null,  // Never probe directly - infer from location preferences
  arts_culture: "Do you go to museums or shows much?",
  fitness: "Do you have a gym routine or prefer outdoor exercise?",
  eco_conscious: "Do you bike or use public transport mostly?",
  gentrification_preference: "Would you prefer an established neighborhood or somewhere that's up-and-coming?",
};
```

**Leo's approach:**
> "I realized I'm not sure about something - what's your ideal Friday night? Are you the going-out type or more of a homebody?"

---

## Usage in Fit Scoring

```typescript
// In fitScoringV2.ts
function calculateNeighborhoodFitScore(
  neighborhood: NeighborhoodProfile,
  userWeights: UserDimensionWeights
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const [dimension, dimWeight] of Object.entries(userWeights)) {
    const neighborhoodScore = neighborhood[dimension];  // 0-100
    const importance = dimWeight.score / 100;           // 0-1
    
    // Reduce weight if confidence is low
    const confidenceMultiplier = {
      high: 1.0,
      medium: 0.8,
      low: 0.5,
      unknown: 0.3,
    }[dimWeight.confidence];
    
    const weight = importance * confidenceMultiplier;
    totalScore += neighborhoodScore * weight;
    totalWeight += weight * 100;
  }
  
  return totalWeight > 0 ? Math.round(totalScore / totalWeight * 100) : 50;
}
```

---

## Example Output

**User Profile:**
- 2 adults, no kids, 1 dog
- Works remote
- Budget: €350,000
- Dealbreakers: "noise", "no light"
- Preferred locations: ["Gràcia"]
- Tradeoffs: quietVsVibrant = -3 (prefers quiet)

**Inferred Weights:**

```json
{
  "couple": {
    "score": 85,
    "confidence": "high",
    "signals_found": 2,
    "evidence": ["household.adults = 2", "household.children.length = 0"]
  },
  "pet_friendly": {
    "score": 95,
    "confidence": "high",
    "signals_found": 1,
    "evidence": ["household.pets.length > 0"]
  },
  "digital_nomad": {
    "score": 80,
    "confidence": "high",
    "signals_found": 2,
    "evidence": ["household.workSituation = remote", "constraints.commuteDestination empty"]
  },
  "quietness": {
    "score": 85,
    "confidence": "high",
    "signals_found": 3,
    "evidence": ["tradeoffs.quietVsVibrant < -2", "household.workSituation = remote", "lifestyle.dealbreakers contains [noise]"]
  },
  "nightlife": {
    "score": 30,
    "confidence": "medium",
    "signals_found": 1,
    "evidence": ["tradeoffs.quietVsVibrant < -2 (inverse)"]
  },
  "lgbtq_friendly": {
    "score": 50,
    "confidence": "unknown",
    "signals_found": 0,
    "should_probe": false,
    "evidence": []
  },
  "foodie": {
    "score": 50,
    "confidence": "unknown",
    "signals_found": 0,
    "should_probe": true,
    "evidence": []
  }
}
```

**Leo's What-If probes:**
- "Are you the type who knows all the good restaurants, or do you mainly cook at home?" (foodie is unknown)

---

## Why NOT Direct Questions

| Approach | Problem |
|----------|---------|
| Survey questions | Feels like a form, not a conversation |
| Rating scales | Users don't know their priorities until they see options |
| Explicit ranking | Cognitive load, users freeze up |

**Instead:**
- Infer from natural conversation
- Probe indirectly during What-Ifs
- Learn from property reactions (save, dismiss, "I love this")

---

## Wildcards (Future - P1)

When we have high-confidence weights, we can generate surprising recommendations:

```typescript
async function generateWildcards(
  userWeights: UserDimensionWeights,
  neighborhoods: NeighborhoodProfile[]
): Promise<WildcardSuggestion[]> {
  
  const wildcards = [];
  
  // Find user's TOP dimension (highest score + confidence)
  const topDimensions = Object.entries(userWeights)
    .filter(([_, w]) => w.confidence === 'high' && w.score >= 70)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);
  
  for (const [dim, weight] of topDimensions) {
    // Find neighborhood that EXCELS at this dimension but isn't obvious
    const surprisingHoods = neighborhoods
      .filter(n => 
        n[dim] >= 85 &&                    // Excellent at this dimension
        n.transport < 70 &&                // Not super central
        n.affordability > 50               // Still affordable
      )
      .sort((a, b) => b[dim] - a[dim]);
    
    if (surprisingHoods.length > 0) {
      wildcards.push({
        neighborhood: surprisingHoods[0],
        dimension: dim,
        reason: `You might not have considered ${surprisingHoods[0].name}, but it scores ${surprisingHoods[0][dim]} on ${dim} - and it's more affordable than the usual suspects.`,
      });
    }
  }
  
  return wildcards.slice(0, 3);
}
```

---

## Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Proxy rules definition | ❌ TODO | `src/lib/recommender/dimensionProxies.ts` |
| Inference function | ❌ TODO | `src/lib/recommender/inferDimensionWeights.ts` |
| Confidence tracking | ❌ TODO | Part of inference |
| Probe question generation | ❌ TODO | `src/lib/recommender/probeQuestions.ts` |
| Integration with fitScoringV2 | ❌ TODO | Update `fitScoringV2.ts` |
| Wildcard generation | ⏳ P1 | Future |

---

## Cost

**$0** - This is all algorithmic, no AI calls needed.

Only the What-If probing uses Leo (voice), which is already happening.

