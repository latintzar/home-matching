# 🎓 Cascade Learning Parser Architecture

## Overview

A self-improving parsing system that learns from each domain to build a "Universal Ruleset" that works across all Spanish real estate sites.

## Core Principles

### 1. Sequential Learning (Not Parallel)
- Process domains one-by-one during learning phase
- Each domain's success patterns inform the next
- By domain 1000, the system "knows" common patterns

### 2. Failure Isolation
- If a domain fails after 2 teaching attempts, PARK it
- Don't let edge cases pollute the Universal Ruleset
- Failed domains are recorded separately for later analysis

### 3. Cumulative Intelligence
- Universal Ruleset grows with each graduation
- Teacher receives increasingly rich context
- Later domains benefit from earlier learnings

---

## The Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN N                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ STEP 1: TEACHER                                      │    │
│  │                                                      │    │
│  │ Input:                                               │    │
│  │   - Sample HTML from domain                          │    │
│  │   - Universal Ruleset (patterns from N-1 domains)    │    │
│  │   - Domain URL                                       │    │
│  │                                                      │    │
│  │ Output:                                              │    │
│  │   - CSS selectors for this domain                    │    │
│  │   - Extraction patterns                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ STEP 2: VALIDATE (5 different listings)              │    │
│  │                                                      │    │
│  │ For each listing:                                    │    │
│  │   1. Parse with Cheerio (using Teacher's selectors)  │    │
│  │   2. Validator checks: Does extraction match HTML?   │    │
│  │   3. Record: PASS or FAIL + reason                   │    │
│  │                                                      │    │
│  │ Result: X/5 passed                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│              ┌────────────┴────────────┐                    │
│              │                         │                    │
│         5/5 PASS                  <5 PASS                   │
│              │                         │                    │
│              ▼                         ▼                    │
│  ┌───────────────────┐    ┌───────────────────────────┐    │
│  │ GRADUATE! ✅       │    │ STEP 3: RE-TEACH          │    │
│  │                   │    │                           │    │
│  │ - Add patterns    │    │ Input:                    │    │
│  │   to Universal    │    │   - Original HTML         │    │
│  │   Ruleset         │    │   - Failed selectors      │    │
│  │                   │    │   - Failure reasons       │    │
│  │ - Store selectors │    │   - What WAS found        │    │
│  │   for domain      │    │                           │    │
│  │                   │    │ Output:                   │    │
│  │ - Move to N+1     │    │   - Corrected selectors   │    │
│  └───────────────────┘    └───────────────────────────┘    │
│                                        │                    │
│                                        ▼                    │
│                           ┌───────────────────────────┐    │
│                           │ STEP 4: VALIDATE AGAIN    │    │
│                           │ (5 more listings)         │    │
│                           └───────────────────────────┘    │
│                                        │                    │
│                           ┌────────────┴────────────┐      │
│                           │                         │      │
│                      5/5 PASS                  <5 PASS     │
│                           │                         │      │
│                           ▼                         ▼      │
│               ┌───────────────────┐    ┌─────────────────┐ │
│               │ GRADUATE! ✅       │    │ PARK DOMAIN 🅿️  │ │
│               │ (same as above)   │    │                 │ │
│               └───────────────────┘    │ - Record fails  │ │
│                                        │ - Don't pollute │ │
│                                        │ - Move to N+1   │ │
│                                        └─────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Universal Ruleset Structure

```typescript
interface UniversalRuleset {
  // Common selector patterns that work across sites
  commonPatterns: {
    price: string[];      // [".precio", ".price", "[data-price]", "meta[property='price']"]
    area: string[];       // [".superficie", ".m2", ".area", "[data-m2]"]
    bedrooms: string[];   // [".habitaciones", ".rooms", ".bedrooms"]
    // ... more fields
  };

  // Lat/Lng extraction methods (ordered by reliability)
  coordinateMethods: [
    "JSON-LD geo object",
    "data-latitude/data-longitude on map container",
    "google.maps.LatLng() in scripts",
    "Mapbox center: [lng, lat]",
    "OpenStreetMap embed"
  ];

  // Photo extraction patterns
  photoPatterns: [
    "fullScreenGalleryPics array in script",
    "data-src on gallery images",
    "srcset attribute (pick largest)",
    "JSON-LD images array"
  ];

  // Known working selectors by domain (for reference)
  domainSelectors: {
    [domain: string]: Selectors;
  };

  // Statistics
  stats: {
    totalDomains: number;
    graduated: number;
    parked: number;
    averageValidationAttempts: number;
  };
}
```

---

## End State

After processing 2,002 domains:

| Category | Count | Description |
|----------|-------|-------------|
| **Graduated** | ~1,800 | Universal Ruleset works, ready for Cheerio |
| **Parked** | ~200 | Recorded failures, needs review |

### What to do with Parked Domains

1. **Try Universal Ruleset** - Maybe patterns from other sites work
2. **Manual review** - Identify what's unique about these sites
3. **Skip** - Some sites may be too custom/broken to parse
4. **Flag for spider exclusion** - Don't waste resources on them

---

## Cost Estimate

| Phase | Teacher Calls | Validator Calls | Estimated Cost |
|-------|---------------|-----------------|----------------|
| Initial teach | 2,002 | 10,010 (5 per domain) | ~$90 |
| Re-teach (20%) | ~400 | 2,000 | ~$30 |
| **Total** | ~2,400 | ~12,000 | **~$120** |

Still well under $200 budget.

---

## Why This Works

### ✅ Strengths

1. **Self-improving**: Later domains benefit from earlier learnings
2. **Failure isolation**: Bad domains don't corrupt good patterns
3. **Clear outcome**: Know exactly what worked and what didn't
4. **Efficient**: Universal Ruleset means later domains are faster
5. **Auditable**: Full failure history for parked domains

### ⚠️ Considerations

1. **Sequential = slower**: Can't parallelize learning phase
2. **Order matters**: First domains set the foundation
3. **Universal may overfit**: Patterns from early domains may not generalize

---

## Implementation Priority

1. **Phase 1**: Build the cascade orchestrator
2. **Phase 2**: Run on all 2,002 domains
3. **Phase 3**: Review parked domains
4. **Phase 4**: Apply Universal Ruleset to delta (new listings)

---

## Questions to Resolve

1. What order should we process domains? (by listing count? alphabetically?)
2. Should we seed with known patterns (Idealista, Fotocasa)?
3. How much failure history to include in re-teach prompt?

