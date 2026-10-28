# 🗺️ Heatmap-Based Location Personalization

> ⚠️ **SUPERSEDES**: This document **replaces** the GREEN/YELLOW/ORANGE zone system and the 8-step permutation follow-up logic documented in `P0_LEAN_APP.md` Parts 6-6.3.
> 
> **Key change:** Location fit is a **gradient**, not zones. Everything is on a spectrum.
> 
> | OLD Approach | NEW Approach |
> |--------------|--------------|
> | GREEN/YELLOW/ORANGE zones | Continuous 0-100% heatmap |
> | 8-step permutation state machine | 2 simple levers (POI softness, commute tolerance) |
> | Complex follow-up negotiations | Simple questions: "Can X be further?" |
> | Zones feel arbitrary | Gradient is intuitive |
> | Surprises need special logic | Surprises emerge naturally from high scores |

---

## 🚨 CRITICAL: NO HARD BOUNDARIES — CITY-WIDE HEATMAP

**The heatmap covers THE ENTIRE CITY.** There is NO geographic exclusion. Every listing in the city gets scored.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   THE HEATMAP EXTENDS TO ALL LISTINGS IN THE CITY                           │
│   ═══════════════════════════════════════════════                           │
│                                                                             │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│   ░░░░░░░░░░ 5% ░░░░░░░░░░░░░░░░░░░░░░░░░ 8% ░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│   ░░░░░░▒▒▒▒▒▒ 15% ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 12% ▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░░│
│   ░░░▒▒▒▒▓▓▓▓▓▓ 45% ▓▓▓▓▓▓▓▓▓▓▓ 38% ▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░│
│   ░░▒▒▓▓▓▓████ 72% ████████ 85% ████████ 68% ███▓▓▓▓▒▒▒░░░░░░░░░░░░░░░░░░│
│   ░░▒▓▓████████ 92% ████████████ 88% ██████████▓▓▓▓▒▒░░░░░░░░░░░░░░░░░░░░│
│   ░░▒▒▓▓████████████████████████████████████████▓▓▓▒▒░░░░░░░░░░░░░░░░░░░░│
│   ░░░▒▒▒▓▓▓▓████████████████████████████████▓▓▓▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░│
│   ░░░░░▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░│
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│                                                                             │
│   ↑ This is the ENTIRE city. Every point has a score. No exclusions.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Things ACTUALLY Mean:

| Concept | What It IS | What It Is NOT |
|---------|-----------|----------------|
| **Commute penalty** | Graduated point deduction (-20, -40, -70...) | Hard boundary / exclusion |
| **"The Shape"** | Visualization overlay on the map | Search filter |
| **90-minute commute** | -90 points (listing CAN still surface) | Automatic exclusion |
| **Isochrones** | Visual bands showing commute times | Geographic fences |
| **Outside work isochrone** | Very low score (5-15%) | Hidden from user |

### Key Behaviors:

1. **A listing 90 minutes from work** with perfect neighborhood match (95%), excellent POIs (90%), and ideal vibe (90%) **CAN STILL SURFACE** with explanation: *"Far commute, but nails everything else you want."*

2. **The heatmap extends to ALL listings in the city.** Every listing gets scored. Far listings get heavy commute penalties but are NEVER excluded from consideration.

3. **There is no "inside" vs "outside".** There's only "high score" vs "low score". Low scores are shown at the bottom of results, not hidden.

4. **Commute isochrones are for VISUALIZATION**, not filtering. We show bands (10/20/30/40/50/60 min) on the map to help users understand geography, but scoring uses the exact calculated minutes.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Three-Layer System](#the-three-layer-system)
3. [Continuous Scoring Model](#continuous-scoring-model-beyond-binary-shapes)
4. [Non-Overlapping Anchors](#non-overlapping-anchors-no-intersection-problem)
5. [Multi-Mode Destination Access](#multi-mode-destination-access)
6. [City Familiarity & Tradeoff Awareness](#city-familiarity--tradeoff-awareness)
7. [Layer 2: Neighborhood Scoring](#layer-2-neighborhood-scoring)
8. [Real-Time Progressive Building](#real-time-progressive-building)
9. [POI Scoring with Flash-Lite](#poi-scoring-with-flash-lite)
10. [The Combined Heatmap Formula](#the-combined-heatmap-formula)
11. [Airbnb Data Integration](#airbnb-data-integration)
12. [Adaptation Timeline](#adaptation-timeline)
13. [API Endpoints](#api-endpoints)
14. [Cost Analysis](#cost-analysis)
15. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   OLD: Binary Zones                    NEW: Continuous Heatmap              │
│   ══════════════════                   ════════════════════════             │
│                                                                             │
│   ┌─────────────┐                      ░░░░▒▒▒▒▓▓▓▓████████▓▓▓▒▒░░         │
│   │   GREEN     │ "Perfect"            ░░▒▒▓▓████  92  ████▓▓▒▒░░          │
│   ├─────────────┤                      ░▒▓███  85  ███  78  ██▓▒░          │
│   │   YELLOW    │ "Needs tradeoff"     ░▒▓██████████████████████▓░          │
│   ├─────────────┤                      ░░▒▒▓▓████████████▓▓▓▒▒░░░          │
│   │   ORANGE    │ "Stretch"                                                 │
│   └─────────────┘                      Every point has a SCORE (0-100)      │
│                                                                             │
│   Problems:                            Benefits:                            │
│   • Hard boundaries feel arbitrary     • Smooth gradients                   │
│   • Complex 8-step permutations        • Simple threshold slider            │
│   • "Surprise" areas need hacks        • Surprises emerge naturally         │
│   • Follow-ups feel like failure       • Easy adaptation                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Three-Layer System

The heatmap is built from **three stacked layers**, each contributing to the final score:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   LAYER 3: POI HEATMAP (Fine-grained gradient)                              │
│   ════════════════════════════════════════════                              │
│                                                                             │
│        ░░░▒▒▓▓███████▓▓▒▒░░░                                               │
│        ░▒▓████  POI  ████▓▒░   ← Gradient based on POI proximity/quality   │
│        ░▒▓████ SCORE ████▓▒░                                               │
│        ░░░▒▒▓▓███████▓▓▒▒░░░                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 2: NEIGHBORHOOD SCORES (Solid colors per boundary)                  │
│   ════════════════════════════════════════════════════════                  │
│                                                                             │
│      ┌────────────┬────────────┬────────────┐                               │
│      │            │            │            │                               │
│      │  GRÀCIA    │  EIXAMPLE  │ SANT MARTÍ │                               │
│      │    85%     │    72%     │    68%     │   ← Solid color per hood     │
│      │  (bright)  │  (medium)  │  (medium)  │      based on 20 dimensions  │
│      │            │            │            │                               │
│      └────────────┴────────────┴────────────┘                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 1: COMMUTE PENALTY (Graduated scoring, NOT a hard boundary)         │
│   ═══════════════════════════════════════════════════════════════════       │
│                                                                             │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                            │
│      ░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░                              │
│      ░░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░                                │
│      ░▒▒▓▓▓████████████████████████▓▓▓▒▒░   ← Gradient from work           │
│      ░▒▓▓████  0 penalty  ████████▓▓▒░       30min=0, 45=-20, 60=-40...   │
│      ░▒▓████████████████████████████▓▒░                                    │
│      ░░▒▓▓████████████████████████▓▓▒░░      NOT a boundary!               │
│      ░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░░       Just another gradient layer   │
│      ░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer 1: COMMUTE PENALTY LAYER (Graduated, Not Binary)

Created by **Turf.js radial circles** for visualization, with **graduated penalties** for scoring. (MVP approach - ~70% accuracy, works well in Spain due to regular city layouts and multi-modal culture.)

```
         Work ◉ ←──────────────────────────────────────────────────────
              │
              │  30 min: ████████ 0 penalty (ideal)
              │  45 min: ▓▓▓▓▓▓▓▓ -20 penalty (acceptable)
              │  60 min: ▒▒▒▒▒▒▒▒ -40 penalty (stretch)
              │  90 min: ░░░░░░░░ -70 penalty (difficult but possible)
              │  90+min: ········ -90 penalty (very unlikely to surface)
              ▼
         GRADIENT extends to entire city, no hard cutoff
```

**Implementation:** Generate isochrones at 10-minute increments (10, 20, 30, 40, 50, 60, 70, 80, 90 min) for visualization. For scoring, interpolate exact travel time to penalty.

**What contributes to commute penalty:**
- Work commute (most common anchor)
- Partner's work (if applicable)
- School/childcare (if applicable)
- Any other daily fixed-destination anchor

**NOT a boundary** — A listing at 75 min commute CAN surface if it scores 95%+ on everything else.

### Layer 2: NEIGHBORHOOD SCORES (Dimension Match)

Each neighborhood in the city gets a **solid color** based on how well its 20 dimensions match the user's lifestyle preferences.

```
      ┌────────────┬────────────┬────────────┐
      │████████████│▓▓▓▓▓▓▓▓▓▓▓▓│░░░░░░░░░░░░│
      │████████████│▓▓▓▓▓▓▓▓▓▓▓▓│░░░░░░░░░░░░│
      │██ GRÀCIA ██│▓▓ EIXAMPLE ▓│░░ SARRIÀ ░░│
      │████ 85% ███│▓▓▓▓ 72% ▓▓▓▓│░░░░ 45% ░░░│
      │████████████│▓▓▓▓▓▓▓▓▓▓▓▓│░░░░░░░░░░░░│
      └────────────┴────────────┴────────────┘
```

**Changes:** When user reveals lifestyle preferences during call

**What contributes:**
- 20 neighborhood dimensions from SERP research
- User's dimension weights (inferred from conversation)
- Acts as a **MULTIPLIER** on POI scores

### Layer 3: POI HEATMAP (Fine-Grained Gradient)

Created by **scoring each point** based on POI proximity and quality.

```
                    ┌─────────────────────┐
                    │░░░░▒▒▒▓▓▓████▓▓▓▒▒░│
                    │░░▒▒▓▓████████████▓▒│  ← Gradient within each hood
                    │░▒▓███  92  █████▓▓▒│
                    │▒▓████████████████▓▒│
                    │░▒▓██  85  ███  78 ▒│
                    │░░▒▒▓▓████████▓▓▒▒░░│
                    └─────────────────────┘
```

**Changes:** EASILY (Day 3 - just adjust weights/acceptable distances)

**What contributes to POI layer:**
- Specialty coffee proximity + quality
- Gym proximity + quality  
- Parks proximity
- Grocery stores proximity
- Airbnb quietness (tourist density)
- Any user-specific POI searches

---

## Continuous Scoring Model (Beyond Binary Shapes)

### The Evolution: Shape → Penalty

The traditional approach uses "THE SHAPE" as a **hard boundary**:
- Inside shape = considered
- Outside shape = excluded

Our evolution: Shape becomes a **heavy penalty**, not an absolute exclusion:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   TRADITIONAL MODEL:                  OUR MODEL:                            │
│   ══════════════════                  ═══════════                           │
│                                                                             │
│   ┌─────────────────┐                 ░░░░ 5% ░░░░░░░░ 8% ░░░░░            │
│   │                 │                 ░░░▒▒▒ 15% ▒▒▒▒▒▒ 12% ▒░░░           │
│   │   INSIDE =      │                 ░▒▒▓▓▓▓▓ 65% ▓▓▓▓▓ 70% ▓▒░           │
│   │   CONSIDERED    │                 ░▒▓▓████ 85% ████ 82% █▓▒░           │
│   │                 │                 ░▒▓█████ 92% █████████▓▓▒░           │
│   │                 │                 ░▒▒▓▓███████████████▓▓▒▒░░           │
│   └─────────────────┘                 ░░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░           │
│                                                                             │
│   OUTSIDE = EXCLUDED                  Everything gets a SCORE               │
│   (never shown)                       Far areas = very low, not zero        │
│                                                                             │
│   PROBLEMS:                           BENEFITS:                             │
│   • Arbitrary cutoff                  • No accidental exclusion             │
│   • Perfect apt 2 min outside?        • Perfect apt far away can surface    │
│   • Excluded forever                  • "Surprising finds" emerge naturally │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Commute as Graduated Penalty

Instead of a binary isochrone boundary, commute distance applies a **graduated penalty**:

```typescript
function getCommutePenalty(commuteMinutes: number): number {
  // Returns negative points to subtract from final score
  
  if (commuteMinutes <= 30) return 0;        // No penalty - ideal range
  if (commuteMinutes <= 45) return -20;      // Mild penalty - acceptable
  if (commuteMinutes <= 60) return -40;      // Significant - needs tradeoffs
  if (commuteMinutes <= 90) return -70;      // Severe - effectively excluded
  return -90;                                 // Almost impossible to surface
}

// A listing with 75-minute commute needs 90%+ on everything else to surface
// Possible, but rare - which is the correct behavior!
```

### Multi-Band Commute Zones (Turf.js Approximation)

For MVP, we use **Turf.js radial circles** instead of expensive API isochrones. This works well in Spain because:

1. **Spanish cities are more uniform** than London — regular grid layouts, good coverage
2. **Multi-modal culture** — Many people use mopeds, bikes, or drive. Not purely transit-dependent.
3. **Metro systems are radial** — Barcelona/Madrid metros spread outward from center, so circles approximate well

```typescript
import * as turf from '@turf/turf';

// Average effective speeds (km/h) including stops, parking, etc.
const EFFECTIVE_SPEEDS = {
  transit: 17,      // Metro + walk to/from station + wait
  walk: 5,          // ~80m/min
  bike: 15,         // Urban cycling with stops
  moped: 22,        // With traffic, parking
  drive: 25,        // City driving with traffic/parking
};

// Generate commute bands using Turf.js circles (FREE!)
function generateCommuteBands(
  anchorCoords: [number, number], // [lng, lat]
  mode: 'transit' | 'walk' | 'bike' | 'moped' | 'drive' = 'transit'
): CommuteBand[] {
  
  const BAND_MINUTES = [10, 20, 30, 45, 60, 90];
  const speed = EFFECTIVE_SPEEDS[mode];
  
  return BAND_MINUTES.map(minutes => {
    // Distance in km = speed (km/h) × time (hours)
    const radiusKm = speed * (minutes / 60);
    
    // Create circular buffer
    const polygon = turf.circle(anchorCoords, radiusKm, {
      units: 'kilometers',
      steps: 64, // Smooth circle
    });
    
    return {
      minutes,
      radiusKm,
      polygon,
      penalty: getCommutePenalty(minutes),
    };
  });
}

// Calculate commute penalty from straight-line distance
function getCommutePenalty(
  listingCoords: [number, number],
  anchorCoords: [number, number],
  mode: 'transit' | 'walk' | 'bike' | 'moped' | 'drive' = 'transit'
): { estimatedMinutes: number; penalty: number } {
  
  const speed = EFFECTIVE_SPEEDS[mode];
  const distanceKm = turf.distance(listingCoords, anchorCoords, { units: 'kilometers' });
  
  // Estimated time = distance / speed × 60
  const estimatedMinutes = Math.round((distanceKm / speed) * 60);
  
  // Apply graduated penalty
  let penalty = 0;
  if (estimatedMinutes > 30) penalty = -20;
  if (estimatedMinutes > 45) penalty = -40;
  if (estimatedMinutes > 60) penalty = -60;
  if (estimatedMinutes > 90) penalty = -80;
  
  return { estimatedMinutes, penalty };
}

// Example: Barcelona
// 30 min by transit (17 km/h) = 8.5 km radius
// 30 min by moped (22 km/h) = 11 km radius
// This covers most of the urban area comfortably
```

**Cost Analysis: $0** 🎉

**Accuracy:** ~70% vs real isochrones. Fine for MVP because:
- Penalties are graduated (±5 min doesn't change penalty bracket)
- Spain has good multi-modal options (moped covers gaps in transit)
- We disclose it's an estimate

**Visualization:** Show concentric circles on map:
- 30 min: Solid green ring
- 45 min: Semi-transparent yellow  
- 60 min: Light orange
- 90 min: Very faint red

**UI Disclaimer:**
> 🚇 *Commute times are estimates. Actual times vary by route and transport mode.*

**Future Upgrade:** When revenue justifies it, switch to Geoapify isochrones for ~$0.01/anchor for precise transit routing.

### Why This Works Better

```
SCENARIO: Perfect apartment 5 minutes outside the "traditional" isochrone

OLD MODEL:
  └── Excluded. User never sees it. Missed opportunity.

OUR MODEL:
  └── Commute: 35 min → -20 penalty
  └── Neighborhood match: 95% → +95 points
  └── POI score: 92% → +92 points × 0.4 weight
  └── FINAL: ~85% → SHOWN! With explanation.

User sees: "This one's slightly outside your ideal commute (35 min) 
           but scores 85% because it nails everything else you want."
```

### Surfacing "Surprises"

High-scoring outliers naturally emerge without special logic:

```
USER: Work in Eixample, wants beach access, specialty coffee, quiet

EXPECTED: Poblenou (near beach, coffee, commute OK)
SURPRISE: Upper Gràcia scores 87%!

Why? Despite being further from beach (bike: 15 min):
  • Commute: 22 min metro → 0 penalty  
  • Beach: 15 min bike → 8/10 (multi-mode!)
  • Coffee: 3 specialty shops within 8 min → 10/10
  • Quiet: Very low tourist activity → 10/10
  • Hood match: 90% for young professional
  
The surprise EMERGES from the math, no special "wildcard" logic needed.
```

---

## Non-Overlapping Anchors (No Intersection Problem)

### The Old Problem

With binary isochrones, non-overlapping work locations **break the system**:

```
OLD MODEL (Binary Intersection):

Partner A works: North Barcelona (Diagonal)
Partner B works: South Barcelona (Zona Franca)

                    ┌─────────┐
                    │  Work A │
                    │  30min  │
                    └────┬────┘
                         │
                         │ NO OVERLAP!
                         │
                    ┌────┴────┐
                    │  Work B │
                    │  30min  │
                    └─────────┘

Binary intersection = EMPTY SEARCH AREA
→ Call breaks down at minute 5
→ "Hmm, there's no overlap... can one of you accept 45min?"
→ Awkward negotiation BEFORE we know anything else
→ User feels interrogated, not helped
```

### The Solution: Independent Penalties Stack

With continuous scoring, each anchor applies its **own penalty independently**:

```typescript
// Each anchor has its own penalty function
function getCommutePenalty(minutes: number): number {
  if (minutes <= 30) return 0;
  if (minutes <= 45) return -20;
  if (minutes <= 60) return -40;
  if (minutes <= 90) return -70;
  return -90;
}

// Total commute penalty = sum of individual penalties
function getTotalCommutePenalty(
  listing: Coords,
  anchors: Anchor[]
): number {
  return anchors.reduce((total, anchor) => {
    const minutes = getTransitMinutes(listing, anchor.location);
    return total + getCommutePenalty(minutes);
  }, 0);
}
```

### How It Works Visually

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    Work A (Diagonal)                                        │
│                         ◉                                                   │
│                        /|\                                                  │
│                       / | \                                                 │
│                      /  |  \   ← 30min = 0 penalty from A                   │
│                     /   |   \                                               │
│                    ─────┼─────                                              │
│                         │                                                   │
│                    SWEET SPOT (Eixample)                                    │
│                    35min to A = -20 penalty                                 │
│                    35min to B = -20 penalty                                 │
│                    TOTAL = -40 penalty                                      │
│                         │                                                   │
│                    ─────┼─────                                              │
│                     \   |   /                                               │
│                      \  |  /    ← 30min = 0 penalty from B                  │
│                       \ | /                                                 │
│                        \|/                                                  │
│                         ◉                                                   │
│                    Work B (Zona Franca)                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NO INTERSECTION NEEDED!                                                    │
│                                                                             │
│  Scoring comparison:                                                        │
│                                                                             │
│  Near A only:    25min + 55min → 0 + (-40) = -40 penalty                   │
│  Near B only:    55min + 25min → (-40) + 0 = -40 penalty                   │
│  Midpoint:       35min + 35min → (-20) + (-20) = -40 penalty               │
│                                                                             │
│  All THREE are equally penalized for commute!                               │
│  The winner is decided by OTHER factors:                                    │
│  → Neighborhood quality                                                     │
│  → POI proximity                                                            │
│  → Beach access                                                             │
│                                                                             │
│  The "sweet spot" emerges from TOTAL scoring, not geometry.                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Conversation Flow (No Early Confrontation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  MINUTE 3:                                                                  │
│  User: "I work at Diagonal, my partner works in Zona Franca"                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  OLD MODEL:                           NEW MODEL:                            │
│  ══════════                           ══════════                            │
│                                                                             │
│  → Calculate isochrones               → Record both anchors                 │
│  → No intersection found              → Note: distant from each other       │
│  → STOP THE CALL                      → CONTINUE THE CONVERSATION           │
│  → "There's no overlap..."            → "Got it! What else matters?"        │
│  → "Can one accept 45min?"            → Learn about beach, coffee, etc.     │
│  → Awkward negotiation                → Build complete picture              │
│  → User feels like a problem          → User feels understood               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MINUTE 12 (End of call):                                                   │
│                                                                             │
│  Leo: "I found some great options. The highest-scoring areas are in        │
│        Eixample - about 35 minutes from both your jobs. They also          │
│        score really well on your coffee and transit preferences.           │
│                                                                             │
│        There are 6 listings above 70% fit. Want me to send them?"          │
│                                                                             │
│  User NEVER had to negotiate commute times during the call.                 │
│  They just see the best options that balance EVERYTHING.                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example: Final Scoring with Non-Overlapping Anchors

```
USER: Partner A at Diagonal, Partner B at Zona Franca
      Wants: Beach, specialty coffee, quiet neighborhood

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  AREA 1: Sant Martí (Near Diagonal only)                                    │
│  ════════════════════════════════════════                                   │
│  Commute: A=20min + B=55min → 0 + (-40) = -40                              │
│  Beach: 9/10 (close)                                                        │
│  Coffee: 6/10 (some options)                                                │
│  Quiet: 7/10 (mixed)                                                        │
│  Hood match: 70%                                                            │
│  FINAL: ~58%                                                                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  AREA 2: Sants (Near Zona Franca only)                                      │
│  ═════════════════════════════════════                                      │
│  Commute: A=50min + B=15min → (-40) + 0 = -40                              │
│  Beach: 5/10 (far)                                                          │
│  Coffee: 5/10 (limited)                                                     │
│  Quiet: 8/10 (residential)                                                  │
│  Hood match: 60%                                                            │
│  FINAL: ~48%                                                                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  AREA 3: Eixample (Midpoint) ✨                                             │
│  ════════════════════════════                                               │
│  Commute: A=35min + B=35min → (-20) + (-20) = -40                          │
│  Beach: 6/10 (bike distance)                                                │
│  Coffee: 9/10 (excellent scene)                                             │
│  Quiet: 8/10 (residential parts)                                            │
│  Hood match: 85%                                                            │
│  FINAL: ~72% ← WINNER despite same commute penalty!                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

The midpoint wins because it's BETTER on everything else,
not because of special geometric treatment.
```

### Key Insight

| Aspect | Old (Intersection) | New (Penalty) |
|--------|-------------------|---------------|
| No overlap? | **System breaks** | Works fine |
| Early negotiation? | Required at minute 5 | **Never** |
| User experience | "Can you compromise?" | "Here's what works" |
| Midpoint favored? | Artificially (only option) | Only if truly best |
| Far commute shown? | Never | Yes, with explanation |

**The non-overlapping anchors case is now a non-issue.** The math just works.

---

## Multi-Mode Destination Access

### The Problem with Single-Mode

Traditional approach: "Near beach" → 15-minute **walking** isochrone → Only beachfront areas

This **excludes better neighborhoods** where users would happily bike/moped to the beach!

```
PROBLEM SCENARIO:

"I want to be near the beach"
         │
         ▼
Walking isochrone (15 min)
         │
         ▼
Only Barceloneta qualifies
         │
         ▼
User ends up in touristy area
         │
         ▼
Regrets. "I wish I'd known locals live in Gràcia and bike to the beach."
```

### Three Destination Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  TYPE 1: CRITICAL ANCHORS                                                   │
│  ════════════════════════                                                   │
│                                                                             │
│  Daily fixed-location destinations:                                         │
│  • Work office                                                              │
│  • Partner's work                                                           │
│  • Kid's school                                                             │
│                                                                             │
│  SCORING: Heavy commute PENALTY (not hard boundary)                         │
│  MODE: Turf.js radial zones (17 km/h avg transit speed)                     │
│  WHY: Fixed location, regular trip - radial approx works for Spanish cities │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TYPE 2: DESTINATION AMENITIES (Multi-Mode)                                 │
│  ══════════════════════════════════════════                                 │
│                                                                             │
│  Places you GO TO but don't need to walk:                                   │
│  • Beach                                                                    │
│  • Nightlife hub (you "go out")                                             │
│  • Specific gym / CrossFit                                                  │
│  • Friends' neighborhood                                                    │
│                                                                             │
│  SCORING: Best of (walk, bike, moped, transit)                              │
│  WHY: Multiple modes are acceptable; nicer neighborhood can win             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TYPE 3: DAILY WALKABLES                                                    │
│  ════════════════════════                                                   │
│                                                                             │
│  Things you want at your doorstep:                                          │
│  • Coffee shops                                                             │
│  • Groceries                                                                │
│  • Parks / green space                                                      │
│  • Restaurants for casual dinners                                           │
│                                                                             │
│  SCORING: Walking distance only (Turf.js geometry)                          │
│  WHY: You WALK there; nobody metros to their morning coffee                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Mode Scoring Algorithm

For DESTINATION AMENITIES, we score across all reasonable transport modes:

```typescript
interface MultiModeAccessScore {
  walk: number;      // 0-10
  bike: number;      // 0-10
  moped: number;     // 0-10
  transit: number;   // 0-10
  best: number;      // Max of above
  bestMode: string;  // Which mode won
}

function scoreDestinationAccess(
  listingCoords: Coords, 
  destinationCoords: Coords,
  userTransportPrefs?: string[]  // e.g., ["bike", "moped"] if stated
): MultiModeAccessScore {
  
  // Estimate times (all Turf.js geometry-based - MVP approach)
  const walkMin = estimateWalkMinutes(listingCoords, destinationCoords);   // 5 km/h
  const bikeMin = estimateBikeMinutes(listingCoords, destinationCoords);   // 15 km/h
  const mopedMin = estimateMopedMinutes(listingCoords, destinationCoords); // 22 km/h
  const transitMin = estimateTransitMinutes(listingCoords, destinationCoords); // 17 km/h avg
  
  // Convert to 0-10 scores (higher = better access)
  const walkScore = walkMin <= 15 
    ? 10 - (walkMin / 3)                          // Great if under 15 min
    : Math.max(0, 5 - walkMin / 10);              // Drops off after
  
  const bikeScore = bikeMin <= 20 
    ? 10 - (bikeMin / 4)                          // Great if under 20 min
    : Math.max(2, 6 - bikeMin / 10);              // Never terrible if bikeable
  
  const mopedScore = mopedMin <= 15 
    ? 10 - (mopedMin / 3)                         // Great if under 15 min
    : Math.max(2, 6 - mopedMin / 10);
  
  const transitScore = transitMin <= 30 
    ? 8 - (transitMin / 7.5)                      // Max 8 (transit has overhead)
    : Math.max(1, 4 - transitMin / 15);
  
  // Best mode wins
  const scores = { walk: walkScore, bike: bikeScore, moped: mopedScore, transit: transitScore };
  const best = Math.max(...Object.values(scores));
  const bestMode = Object.entries(scores).find(([_, v]) => v === best)?.[0] || 'walk';
  
  return { ...scores, best, bestMode };
}
```

### Example: Beach Access Scoring

```
USER: "I want to be near the beach"

┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  BARCELONETA (1km from beach):                                             │
│    Walk:   12min → 10 - (12/3) = 6.0/10                                    │
│    Bike:   3min  → 10 - (3/4)  = 9.25/10 ✓                                 │
│    Moped:  2min  → 10 - (2/3)  = 9.3/10                                    │
│    Transit: N/A                                                            │
│    BEST: Bike 9.25/10                                                      │
│                                                                            │
│  GRÀCIA (4km from beach):                                                  │
│    Walk:   50min → 5 - (50/10) = 0/10                                      │
│    Bike:   15min → 10 - (15/4) = 6.25/10 ✓                                 │
│    Moped:  10min → 10 - (10/3) = 6.67/10                                   │
│    Transit: 25min → 8 - (25/7.5) = 4.67/10                                 │
│    BEST: Moped 6.67/10                                                     │
│                                                                            │
│  SARRIÀ (6km from beach):                                                  │
│    Walk:   75min → 0/10                                                    │
│    Bike:   22min → 6 - (22/10) = 3.8/10                                    │
│    Moped:  15min → 10 - (15/3) = 5.0/10 ✓                                  │
│    Transit: 35min → 4 - (35/15) = 1.67/10                                  │
│    BEST: Moped 5.0/10                                                      │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  RAW BEACH SCORES:                                                         │
│  • Barceloneta: 9.25/10                                                    │
│  • Gràcia: 6.67/10                                                         │
│  • Sarrià: 5.0/10                                                          │
│                                                                            │
│  BUT! After neighborhood quality multiplier:                               │
│                                                                            │
│  • Barceloneta: 9.25 × 0.85 (touristy) = 7.86                              │
│  • Gràcia: 6.67 × 1.25 (great hood) = 8.34 ✨ WINNER!                       │
│  • Sarrià: 5.0 × 1.1 (quiet, family) = 5.5                                 │
│                                                                            │
│  Result: Gràcia beats Barceloneta despite being further!                   │
│          "Nicer neighborhood with quick bike ride" wins.                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### When to Apply Multi-Mode

Leo's agent decides based on amenity type:

```typescript
function shouldUseMultiMode(amenityType: string): boolean {
  const DESTINATION_AMENITIES = [
    'beach', 'sea', 'coast',
    'nightlife', 'bars', 'clubs',
    'gym', 'crossfit', 'fitness_center',
    'friends_area', 'family_area',
    'specific_restaurant', 'specific_venue'
  ];
  
  const DAILY_WALKABLES = [
    'coffee', 'cafes',
    'grocery', 'supermarket',
    'park', 'green_space',
    'generic_restaurants'
  ];
  
  return DESTINATION_AMENITIES.includes(amenityType.toLowerCase());
}
```

---

## City Familiarity & Tradeoff Awareness

### City Familiarity Probing

Early in the intake call, Leo asks about the user's knowledge of the city:

```
Leo: "Have you spent any time in Barcelona before?"

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  RESPONSE                          LEO'S BEHAVIOR                           │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  "Never been" /                    MAXIMUM LOCAL WISDOM MODE                │
│  "Just saw photos"                 • Proactively explain neighborhood vibes │
│                                    • Surface tradeoffs before they ask      │
│                                    • "BTW, the areas closest to the beach   │
│                                       tend to be quite touristy..."         │
│                                    • More educational, less assumptive      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  "Visited friends" /               CALIBRATED MODE                          │
│  "Been a few times"                • "Where did you stay? What was the     │
│                                       vibe like?"                           │
│                                    • Leo learns their reference points      │
│                                    • "You know Gràcia? [Nearby area] has a │
│                                       similar vibe but..."                  │
│                                    • Connect new info to what they know     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  "Lived there" /                   TRUST THEIR EXPERTISE MODE               │
│  "I know it well"                  • Less explanation needed                │
│                                    • Trust their neighborhood preferences   │
│                                    • "You probably know this already..."    │
│                                    • Focus on logistics, not education      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ElevenLabs Tool: `probe_city_familiarity`

```json
{
  "name": "probe_city_familiarity",
  "description": "Record user's familiarity level with the target city",
  "parameters": {
    "type": "object",
    "properties": {
      "familiarity_level": {
        "type": "string",
        "enum": ["none", "visited", "lived", "expert"],
        "description": "How well the user knows the city"
      },
      "reference_neighborhoods": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Areas the user has visited or knows"
      },
      "perception_notes": {
        "type": "string",
        "description": "What they thought of areas they know"
      }
    },
    "required": ["familiarity_level"]
  }
}
```

### Tradeoff Awareness: The "Barceloneta Trap"

Certain amenities have **inherent tradeoffs** that locals understand but newcomers don't.

#### The Pattern

```
USER: "I want to be near the beach"

NAIVE SYSTEM:                        LEO'S APPROACH:
═══════════════                      ═══════════════

Beach walking isochrone              Recognizes "beach" has tradeoffs
         │                                    │
         ▼                                    ▼
Recommends Barceloneta               Asks: "Quick thought on beach proximity..."
         │                                    │
         ▼                                    ▼
User moves there                     Surfaces local wisdom BEFORE they commit
         │                                    │
         ▼                                    ▼
Discovers it's touristy,             Offers: "Walking distance to sand, OR
noisy, not "classy"                          nicer neighborhood with quick
         │                                    bike ride? Lots of locals
         ▼                                    prefer the second option."
REGRET                                        │
                                              ▼
                                    User makes INFORMED choice
```

#### Pre-Loaded City Intelligence

```typescript
const CITY_TRADEOFFS: Record<string, TradeoffConfig[]> = {
  barcelona: [
    {
      amenity: 'beach',
      tradeoff: "Beach-adjacent areas tend to be touristy and transient",
      clarification: `Quick thought on beach proximity - the areas closest 
        to the water tend to be more touristy and can get noisy at night. 
        A lot of locals prefer living in neighborhoods like Gràcia or 
        Eixample and getting to the beach by bike or moped in 10-15 minutes. 
        
        What's more important to you - walking distance to the sand, or a 
        quieter neighborhood feel with quick beach access?`,
      alternatives: {
        "Walk to beach": ["Barceloneta", "Poblenou"],
        "Bike to beach (quieter)": ["Gràcia", "Sant Antoni", "Poble Sec"],
        "Moped to beach (more space)": ["Eixample", "Les Corts"]
      }
    },
    {
      amenity: 'nightlife',
      tradeoff: "Nightlife is inland, not coastal",
      clarification: `FYI, the main nightlife in Barcelona is actually 
        inland - Gràcia, Born, Raval - not down by the beach. 
        
        Do you want to be right IN the action (fun but can be noisy), 
        or is being a quick walk/ride away fine?`,
      lifeStageAdjustment: {
        "new_to_city": "Probably want to be closer to meet people",
        "settled": "Might prefer quiet with easy access"
      }
    },
    {
      amenity: 'gothic_quarter',
      tradeoff: "Beautiful but very tourist-heavy",
      clarification: `The Gothic Quarter is gorgeous but can feel like 
        you're living in a tourist attraction. Born has similar vibes 
        but slightly more local feel.
        
        What matters more - the architecture, or the day-to-day 
        neighborhood feel?`
    }
  ],
  madrid: [
    {
      amenity: 'centro',
      tradeoff: "Central areas are lively but can be noisy",
      clarification: `Living right in Centro is exciting but can get 
        loud, especially on weekends. Malasaña has the same energy 
        but slightly more residential feel. Chamberí is quieter but 
        still very connected.`
    }
  ]
};
```

#### When Leo Surfaces Tradeoffs

```typescript
function shouldSurfaceTradeoff(
  amenity: string, 
  city: string, 
  userFamiliarity: 'none' | 'visited' | 'lived' | 'expert'
): boolean {
  
  const tradeoff = CITY_TRADEOFFS[city]?.find(t => t.amenity === amenity);
  if (!tradeoff) return false;
  
  // Always surface for unfamiliar users
  if (userFamiliarity === 'none') return true;
  
  // For visitors, surface major tradeoffs only
  if (userFamiliarity === 'visited') {
    return tradeoff.severity === 'major';
  }
  
  // For locals/experts, assume they know
  return false;
}
```

### Lifecycle Awareness

User preferences evolve. Leo recognizes life stage patterns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PHASE 1 SIGNALS:                  PHASE 2 SIGNALS:                         │
│  ════════════════                  ════════════════                         │
│                                                                             │
│  • "I'm moving for work"           • "Been here a few years"                │
│  • "Don't know anyone there"       • "Looking for more space"               │
│  • "Want to meet people"           • "Partner and I want..."                │
│  • "First time living abroad"      • "Settling down"                        │
│  • Young professional indicators   • Nesting indicators                     │
│                                                                             │
│  LEO ADJUSTS:                      LEO ADJUSTS:                             │
│  • Nightlife/social = HIGH         • Space/quiet = HIGH                     │
│  • Accept smaller apartments       • Accept longer commutes                 │
│  • Prioritize location/vibe        • Prioritize €/m² value                  │
│  • Beach = "I want to BE there"    • Beach = "Easy access is fine"          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Leo can recognize these patterns and explicitly check:

```
Leo: "Sounds like you're in a settling-down phase - is having more 
      space worth a slightly longer commute to work? Some of the 
      quieter neighborhoods give you much more bang for your buck."
```

### Multi-Factor Resolution

When tradeoffs exist, the scoring system handles them naturally:

```
USER: "I want to be near the beach"

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  IF USER CHOOSES: "Walking distance to beach"                               │
│  ═══════════════════════════════════════════                                │
│                                                                             │
│  → Beach walk score: WEIGHTED HIGH                                          │
│  → Neighborhood quality: WEIGHTED LOWER                                     │
│  → Barceloneta may win                                                      │
│  → Leo: "Got it - prioritizing sand access over quiet."                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  IF USER CHOOSES: "Quieter with quick bike access"                          │
│  ═══════════════════════════════════════════════════                        │
│                                                                             │
│  → Beach multi-mode score: BIKE MODE ACCEPTABLE                             │
│  → Neighborhood quality: WEIGHTED HIGH                                      │
│  → Gràcia likely wins                                                       │
│  → Leo: "Perfect - focusing on neighborhood quality with beach              │
│          a quick ride away."                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

The system doesn't judge - it scores what they ACTUALLY want.
Their choice after understanding tradeoffs = true preference.
```

---

## Layer 2: Neighborhood Scoring

### The 20 Dimensions

Each neighborhood has pre-computed scores (0-100) across 20 lifestyle dimensions from SERP research:

```typescript
interface NeighborhoodProfile {
  neighborhood_id: string;
  city: string;
  name: string;
  
  // Life Stage Dimensions
  young_professional: number;   // 0-100
  family_friendly: number;
  retiree_friendly: number;
  student_friendly: number;
  
  // Lifestyle Dimensions
  nightlife: number;
  creative_scene: number;
  foodie_scene: number;
  outdoor_lifestyle: number;
  fitness_culture: number;
  lgbtq_friendly: number;
  pet_friendly: number;
  digital_nomad: number;
  expat_community: number;
  
  // Universal Quality Dimensions
  safety: number;
  cleanliness: number;
  green_spaces: number;
  walkability: number;
  transit_access: number;
  quietness: number;
  
  // Economic Dimensions
  affordability: number;
  gentrification_risk: number;
}
```

### Calculating Neighborhood Score for a User

```typescript
function calculateNeighborhoodScore(
  neighborhood: NeighborhoodProfile,
  userWeights: Record<string, number>  // From intake conversation
): number {
  
  const dimensions = [
    'young_professional', 'family_friendly', 'retiree_friendly', 'student_friendly',
    'nightlife', 'creative_scene', 'foodie_scene', 'outdoor_lifestyle',
    'fitness_culture', 'lgbtq_friendly', 'pet_friendly', 'digital_nomad',
    'expat_community', 'safety', 'cleanliness', 'green_spaces',
    'walkability', 'transit_access', 'quietness', 'affordability'
  ];
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const dim of dimensions) {
    const userWeight = userWeights[dim] ?? 0;  // 0 = don't care
    if (userWeight > 0) {
      weightedSum += neighborhood[dim] * userWeight;
      totalWeight += 100 * userWeight;
    }
  }
  
  return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;
}
```

### Converting Score to Multiplier

The neighborhood score becomes a **multiplier** (0.7 to 1.3) on POI scores:

```typescript
function neighborhoodMultiplier(score: number): number {
  // 0 score → 0.7 multiplier (30% penalty)
  // 50 score → 1.0 multiplier (neutral)
  // 100 score → 1.3 multiplier (30% boost)
  return 0.7 + (score / 100) * 0.6;
}
```

### Explicit Mention Boost

If the user **explicitly mentions** a neighborhood, it gets an additional boost:

```typescript
interface NeighborhoodScore {
  neighborhood_id: string;
  dimension_score: number;       // 0-100 from weighted dimensions
  explicitly_mentioned: boolean; // Did user say "I want to live in Gràcia"?
  mention_sentiment: 'positive' | 'negative' | 'neutral';
  final_multiplier: number;
}

function calculateFinalMultiplier(
  dimensionScore: number,
  explicitlyMentioned: boolean,
  mentionSentiment: 'positive' | 'negative' | 'neutral'
): number {
  
  // Base multiplier from dimension score (0.7 - 1.3)
  let multiplier = 0.7 + (dimensionScore / 100) * 0.6;
  
  // Explicit mention adjustments
  if (explicitlyMentioned) {
    switch (mentionSentiment) {
      case 'positive':
        // "I love Gràcia" or "I've heard good things about El Born"
        multiplier *= 1.2;  // +20% boost
        break;
      case 'negative':
        // "I don't want to live in Gothic Quarter"
        multiplier *= 0.3;  // Heavy penalty (almost excluded)
        break;
      case 'neutral':
        // "I've been looking at Eixample"
        multiplier *= 1.1;  // +10% boost (interest signal)
        break;
    }
  }
  
  // Cap at reasonable bounds
  return Math.max(0.2, Math.min(1.5, multiplier));
}
```

**Examples:**

```
USER: "I love Gràcia, and I've heard El Born is cool too. 
       I definitely don't want to live near the tourist areas in Gothic."

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  NEIGHBORHOOD    Dimension   Mentioned?  Sentiment    Final Multiplier      │
│                  Score                                                      │
│  ───────────────────────────────────────────────────────────────────────    │
│  Gràcia          85%         YES         positive     1.26 × 1.2 = 1.50 ✨  │
│  El Born         78%         YES         positive     1.17 × 1.2 = 1.40     │
│  Gothic Quarter  72%         YES         negative     1.13 × 0.3 = 0.34 ⛔  │
│  Eixample        70%         NO          -            1.12                  │
│  Sarrià          45%         NO          -            0.77                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Result:
• Gràcia gets MAX boost (great dimensions + explicitly loved)
• Gothic Quarter nearly excluded (good dimensions BUT user said NO)
• El Born boosted beyond its dimension score
• Eixample and Sarrià scored purely on dimensions
```

**Why This Matters:**

1. **Respects stated preferences** - User said they want Gràcia, we prioritize it
2. **Respects dealbreakers** - User said no Gothic, we nearly exclude it
3. **Still shows surprises** - A non-mentioned hood with great dimensions can still score well
4. **Combines knowledge** - User intuition + our dimension data

### Example: How Neighborhood Multiplier Affects Listings

```
USER: Values creativity (HIGH), nightlife (HIGH), family-friendly (LOW)

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  NEIGHBORHOOD    Creativity  Nightlife  Family   DIMENSION   MULTIPLIER    │
│                  (wt=1.5)    (wt=1.5)   (wt=0.5)   SCORE                    │
│  ───────────────────────────────────────────────────────────────────────    │
│  Gràcia          90          75         60        84%         1.30          │
│  Eixample        70          85         50        76%         1.16          │
│  Sarrià          40          30         95        41%         0.75          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

LISTING A in Gràcia:
  POI Score: 70% (good coffee nearby, ok gym)
  Neighborhood Multiplier: 1.30
  FINAL SCORE: 70 × 1.30 = 91% ✨

LISTING B in Sarrià:
  POI Score: 80% (excellent coffee, great gym)
  Neighborhood Multiplier: 0.75
  FINAL SCORE: 80 × 0.75 = 60% 😐

→ Listing A wins despite worse POI access because the NEIGHBORHOOD fits better!
```

### Visual: The Combined Layers

```
LAYER 2 ONLY              LAYER 3 ONLY              COMBINED
(Neighborhood)            (POI Heatmap)             (Multiplied)

┌──────┬──────┬──────┐    ░░░▒▒▓▓███▓▓▒░░░        ┌──────┬──────┬──────┐
│██████│▓▓▓▓▓▓│░░░░░░│    ░▒▓███████████▓▒░        │██████│▓▓████│░░░░░░│
│██████│▓▓▓▓▓▓│░░░░░░│  × ░▓█████████████▓░    =   │██████│▓█████│░▒▒▒░░│
│██████│▓▓▓▓▓▓│░░░░░░│    ░▒▓███████████▓▒░        │██████│▓▓████│░░░░░░│
│ 85%  │ 72%  │ 45%  │    (POI gradient)           │ MAX! │ GOOD │ WEAK │
└──────┴──────┴──────┘                             └──────┴──────┴──────┘

Gràcia has great       There's a POI          Even though POI cluster
dimension match        cluster here           overlaps Sarrià, the
                                              neighborhood score dims it
```

### How User Weights Are Inferred

During the intake call, the ElevenLabs agent infers dimension weights from natural conversation:

| User Says | Inferred Weight |
|-----------|-----------------|
| "I love going out at night" | nightlife = 1.5 |
| "I'm a creative type, work in design" | creative_scene = 1.5 |
| "We have two kids" | family_friendly = 2.0, nightlife = 0.5 |
| "I work from home a lot" | quietness = 1.5, transit_access = 0.5 |
| "I bike everywhere" | walkability = 0.5, fitness_culture = 1.0 |
| "Safety is really important" | safety = 2.0 |

### How Neighborhood Mentions Are Tracked

The ElevenLabs agent also tracks explicit neighborhood mentions:

| User Says | Extracted |
|-----------|-----------|
| "I love Gràcia" | `{ hood: "gracia", sentiment: "positive" }` |
| "El Born seems cool" | `{ hood: "el-born", sentiment: "positive" }` |
| "I've been looking at Eixample" | `{ hood: "eixample", sentiment: "neutral" }` |
| "Definitely not Gothic Quarter" | `{ hood: "gothic", sentiment: "negative" }` |
| "I heard Poblenou is up and coming" | `{ hood: "poblenou", sentiment: "positive" }` |
| "I want to avoid touristy areas" | `{ avoid_tags: ["touristy"] }` (no specific hood) |

**ElevenLabs Tool:** `extract_neighborhood_mentions`

```typescript
interface NeighborhoodMention {
  neighborhood_id: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  verbatim: string;  // What user actually said, for context
}

// Tool output after each user message:
{
  "mentions": [
    { "neighborhood_id": "gracia", "sentiment": "positive", "verbatim": "I love Gràcia" }
  ],
  "avoid_tags": ["touristy", "noisy"]  // General avoidances
}
```

---

## Real-Time Progressive Building

**Key insight:** We search and score POIs **as-we-go** during the intake call. The heatmap builds up progressively as more layers are added, giving users instant visual feedback that their words are being turned into a personalized map.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   MINUTE 2: User mentions work location                                     │
│   ══════════════════════════════════════                                    │
│                                                                             │
│   → Generate initial SHAPE (work commute isochrone)                         │
│   → Show shape on map (outline only, no heatmap yet)                        │
│                                                                             │
│   [Map shows: Grey shape outline]                                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   MINUTE 3: User reveals lifestyle ("I'm a creative, love going out")       │
│   ══════════════════════════════════════════════════════════════════        │
│                                                                             │
│   → BACKGROUND: Infer dimension weights (creative_scene=1.5, nightlife=1.5) │
│   → BACKGROUND: Calculate neighborhood scores for all hoods in shape        │
│   → NEIGHBORHOOD LAYER appears (solid colors per boundary)                  │
│                                                                             │
│   [Map shows: Shape with colored neighborhoods]                             │
│                                                                             │
│   Leo: "Based on that, I can already see Gràcia and El Born lighting        │
│         up for you - they have great creative and nightlife scenes."        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   MINUTE 5: User says "I love specialty coffee"                             │
│   ═════════════════════════════════════════════                             │
│                                                                             │
│   → BACKGROUND: ScrapingDog searches "specialty coffee [city]"              │
│   → BACKGROUND: Flash-Lite scores each result for user fit                  │
│   → POI layer appears ON TOP of neighborhood layer                          │
│                                                                             │
│   [Map shows: Neighborhoods + coffee gradient overlay]                      │
│                                                                             │
│   n = 1 POI category, combined = neighborhood × coffee                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   MINUTE 7: User says "I need a CrossFit gym specifically"                  │
│   ════════════════════════════════════════════════════════                  │
│                                                                             │
│   → BACKGROUND: ScrapingDog searches "CrossFit gym [city]"                  │
│   → BACKGROUND: Flash-Lite scores results                                   │
│   → POI layer updates (coffee + gym)                                        │
│                                                                             │
│   [Map shows: Neighborhoods × (coffee + gym) gradient]                      │
│                                                                             │
│   n = 2 categories, heatmap recalculates with both                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   MINUTE 8: User says "I hate touristy areas"                               │
│   ═══════════════════════════════════════════                               │
│                                                                             │
│   → BACKGROUND: Load Airbnb H3 heatmap data for shape                       │
│   → Flash-Lite scores each H3 hex for "quiet, non-touristy"                 │
│   → Heatmap layer 3 added (Airbnb quietness)                                │
│                                                                             │
│   [Map shows: Full gradient with coffee + gym + quietness]                  │
│                                                                             │
│   Some previously "bright" areas dim (touristy coffee shops)                │
│   Some new areas brighten (quiet areas with good POIs)                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   MINUTE 10: User mentions beach access would be nice                       │
│   ═══════════════════════════════════════════════════                       │
│                                                                             │
│   → SHAPE EXPANDS: Intersect with beach isochrone                           │
│   → Heatmap recalculates for new shape                                      │
│                                                                             │
│   [Map shows: Expanded shape, updated gradient]                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   END OF CALL: Full personalized heatmap revealed                           │
│   ═══════════════════════════════════════════════                           │
│                                                                             │
│   Leo: "Here's your personalized map. The brighter areas are where          │
│         you'll find the specialty coffee spots you'd love, CrossFit         │
│         gyms nearby, and quieter streets away from tourist crowds.          │
│         I found 12 listings scoring above 75% - you'll get the first        │
│         batch tomorrow."                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Progressive Heatmap Visualization

```
MINUTE 2        MINUTE 4        MINUTE 6        MINUTE 8        MINUTE 10
┌───────┐       ┌───────┐       ┌───────┐       ┌───────┐       ┌───────────┐
│       │       │░░░░░░░│       │░░▒▒▒░░│       │░▒▓▓▒░░│       │░░▒▓▓▓▒░░░│
│ SHAPE │       │░░░░░░░│       │░▒▓▓▒░░│       │▒▓██▓░░│       │░▒▓███▓▒░░│
│ ONLY  │       │░░░░░░░│       │░▒▓▓▒░░│       │▒▓██▓▒░│       │▒▓████▓▒░░│
│       │       │░░░░░░░│       │░░▒▒░░░│       │░▒▓▓▒░░│       │░▒▓██▓▒░░░│
└───────┘       └───────┘       └───────┘       └───────┘       └───────────┘
  n=0             n=1             n=2             n=3             n=4
  (no POIs)       (coffee)        (+gym)          (+quiet)        (+beach shape)
```

---

## POI Scoring with Flash-Lite

### API Endpoint: `POST /api/recommender/score-pois`

**When called:** After each POI category is searched (in background during call)

**Input:**
```typescript
interface ScorePOIsRequest {
  user_profile: {
    preferences_summary: string;  // "Wants specialty coffee with good vibes..."
    poi_preferences: Array<{
      category: string;           // "coffee", "gym", "quiet"
      importance: "critical" | "high" | "medium" | "low";
      explicit_max_time?: number; // User said "within 10 min" (optional)
      explicit_mode?: "walk" | "bike" | "transit" | "drive"; // (optional)
    }>;
  };
  
  pois: Array<{
    id: string;
    category: string;
    name: string;
    lat: number;
    lng: number;
    rating: number;
    review_count: number;
    sample_reviews: string[];     // 3-5 representative reviews
    description?: string;
  }>;
  
  airbnb_areas?: Array<{
    id: string;                   // H3 hex ID
    name: string;                 // "Gothic Quarter area"
    sample_reviews: string[];     // 3-5 representative Airbnb reviews
  }>;
}
```

**Flash-Lite Prompt:**
```
You are scoring Points of Interest for a user looking for a home.

USER PROFILE:
${user_profile.preferences_summary}

EXPLICIT PREFERENCES:
${JSON.stringify(user_profile.poi_preferences)}

For each POI below, provide:
1. user_fit (0-10): How well does this match what the user wants?
2. reasoning (1 sentence): Why this score?
3. suggested_max_time (minutes): Reasonable travel time for this POI type given user's lifestyle
4. suggested_mode: "walk" | "bike" | "transit" | "drive"

SCORING GUIDELINES:
- 9-10: Perfect match for user's stated preferences
- 7-8: Good match, minor misalignment
- 5-6: Acceptable but not ideal
- 3-4: Significant mismatch with preferences
- 0-2: Opposite of what user wants

POIs TO SCORE:
${JSON.stringify(pois)}

${airbnb_areas ? `
AIRBNB AREAS TO SCORE (for quietness/vibe):
${JSON.stringify(airbnb_areas)}
` : ''}

Return JSON:
{
  "scored_pois": [
    {
      "id": "poi_1",
      "user_fit": 9,
      "reasoning": "Third-wave specialty coffee with laptop-friendly vibes",
      "suggested_max_time": 10,
      "suggested_mode": "walk"
    }
  ],
  "scored_areas": [
    {
      "id": "h3_gothic",
      "user_fit": 2,
      "reasoning": "Reviews mention noise and tourists - opposite of quiet preference"
    }
  ]
}
```

**Output:**
```typescript
interface ScorePOIsResponse {
  scored_pois: Array<{
    id: string;
    user_fit: number;           // 0-10
    reasoning: string;          // For explanations
    suggested_max_time: number; // Minutes
    suggested_mode: "walk" | "bike" | "transit" | "drive";
  }>;
  
  scored_areas?: Array<{
    id: string;
    user_fit: number;           // 0-10
    reasoning: string;
  }>;
}
```

### Transport Mode Inference

The LLM infers appropriate transport modes based on POI type and user hints:

| POI Type | Typical Mode | Reasoning |
|----------|--------------|-----------|
| Coffee shop | Walk | Daily ritual, should be walkable |
| Gym | Walk/Bike | Frequent visits, exercise mindset |
| Grocery | Walk | Should be very close |
| Beach | Transit/Bike | Occasional, can be further |
| Airport | Drive/Transit | Rare, distance acceptable |
| Parks | Walk | Should be walkable |
| Restaurants | Walk/Bike | Frequent, neighborhood feel |

If user says "I bike everywhere" → LLM adjusts suggested modes accordingly.

---

## The Combined Heatmap Formula

### Core Formula (Three-Layer Multiplication)

For each coordinate (lat, lng) inside the shape:

```
FINAL_SCORE = POI_SCORE × NEIGHBORHOOD_MULTIPLIER

Where:
  POI_SCORE = Σ(DISTANCE_SCORE × USER_FIT × CATEGORY_WEIGHT) / Σ(10 × 10 × CATEGORY_WEIGHT)
              ──────────────────────────────────────────────────────────────────────────────
                                      for all scored POIs
  
  NEIGHBORHOOD_MULTIPLIER = 0.7 + (NEIGHBORHOOD_SCORE / 100) × 0.6
                           ────────────────────────────────────────
                           Converts 0-100 score to 0.7-1.3 range
```

**Variables:**
- `DISTANCE_SCORE` = 0-10 (10 = very close, 0 = at max acceptable distance)
- `USER_FIT` = 0-10 (from Flash-Lite POI scoring)
- `CATEGORY_WEIGHT` = 0.5-2.0 (based on user's stated importance)
- `NEIGHBORHOOD_SCORE` = 0-100 (from 20-dimension weighted match)
- `NEIGHBORHOOD_MULTIPLIER` = 0.7-1.3 (penalty to boost)
- Result = 0 to ~130 (cap at 100)

### Why Multiplication Works

```
SCENARIO A: Great POIs in bad neighborhood
  POI Score: 85%
  Neighborhood Multiplier: 0.75 (45% dimension match)
  FINAL: 85 × 0.75 = 64%  ← Penalized

SCENARIO B: OK POIs in great neighborhood  
  POI Score: 70%
  Neighborhood Multiplier: 1.25 (85% dimension match)
  FINAL: 70 × 1.25 = 88%  ← Boosted

SCENARIO C: Great POIs in great neighborhood
  POI Score: 85%
  Neighborhood Multiplier: 1.25
  FINAL: 85 × 1.25 = 100% (capped)  ← Maximum
```

### Distance Score Function

```typescript
function distanceScore(actualMinutes: number, maxMinutes: number): number {
  if (actualMinutes >= maxMinutes) return 0;
  return Math.round(10 * (1 - actualMinutes / maxMinutes));
}

// Examples with max acceptable = 15 min:
// 0 min → 10
// 5 min → 7
// 10 min → 3
// 15 min → 0
// 20 min → 0 (capped)
```

### Importance to Weight Conversion

```typescript
function importanceToWeight(importance: string): number {
  switch (importance) {
    case 'critical': return 2.0;
    case 'high': return 1.5;
    case 'medium': return 1.0;
    case 'low': return 0.5;
    default: return 1.0;
  }
}
```

### Example Calculation

```
USER: "Specialty coffee (HIGH), CrossFit (HIGH), Quiet streets (HIGH)"
      + lifestyle: creative_scene (HIGH), nightlife (HIGH)

COORDINATE: (41.3920, 2.1645) - in GRÀCIA neighborhood

STEP 1: POI SCORE
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  POI                    Dist   Dist    User   Weight   Product   Max     │
│                         (min)  Score   Fit                               │
│  ─────────────────────────────────────────────────────────────────────   │
│  Satan's Coffee         6      8       9      1.5      108       150     │
│  Starbucks              3      9       3      1.5      40.5      150     │
│  CrossFit Eixample      12     5       8      1.5      60        150     │
│  Basic Gym              4      9       4      1.5      54        150     │
│  Airbnb Quietness*      -      10      8      1.5      120       150     │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────   │
│  SUM                                                   382.5     750     │
│                                                                          │
│  POI_SCORE = 382.5 / 750 = 51%                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

* Airbnb has distance_score=10 because it's area-based (you're IN the hex)

STEP 2: NEIGHBORHOOD MULTIPLIER
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  GRÀCIA NEIGHBORHOOD SCORES:                                             │
│  ─────────────────────────────────────────────────────────────────────   │
│  creative_scene:  90 × weight 1.5 = 135                                  │
│  nightlife:       75 × weight 1.5 = 112.5                                │
│  ─────────────────────────────────────────────────────────────────────   │
│  SUM: 247.5 / MAX: 300                                                   │
│                                                                          │
│  NEIGHBORHOOD_SCORE = 247.5 / 300 = 82.5%                                │
│  NEIGHBORHOOD_MULTIPLIER = 0.7 + (82.5 / 100) × 0.6 = 1.20               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

STEP 3: FINAL COMBINED SCORE
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  FINAL_SCORE = POI_SCORE × NEIGHBORHOOD_MULTIPLIER                       │
│              = 51% × 1.20                                                │
│              = 61%                                                       │
│                                                                          │
│  The neighborhood BOOSTED this location by 10 points!                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Heatmap Calculation Implementation

```typescript
// /api/recommender/calculate-heatmap

interface HeatmapInput {
  shape: GeoJSON.Polygon;
  scored_pois: ScoredPOI[];
  scored_areas: ScoredArea[];              // Airbnb H3 hexes
  poi_preferences: POIPreference[];
  neighborhood_scores: NeighborhoodScore[]; // Pre-calculated per-hood scores
  user_dimension_weights: Record<string, number>; // From intake
}

interface NeighborhoodScore {
  neighborhood_id: string;
  boundary: GeoJSON.Polygon;
  dimension_score: number;  // 0-100
  multiplier: number;       // 0.7-1.3
}

function calculateHeatmap(input: HeatmapInput): GeoJSON.FeatureCollection {
  const grid = generateGridPoints(input.shape, resolution = 100); // 100m grid
  
  return {
    type: "FeatureCollection",
    features: grid.map(point => {
      
      // ═══════════════════════════════════════════════════════════════
      // STEP 1: Calculate POI Score (0-100)
      // ═══════════════════════════════════════════════════════════════
      
      let weightedSum = 0;
      let maxPossible = 0;
      
      for (const poi of input.scored_pois) {
        const pref = input.poi_preferences.find(p => p.category === poi.category);
        const weight = importanceToWeight(pref?.importance || 'medium');
        
        const travelMinutes = calculateTravelTime(
          point,
          poi.location,
          poi.suggested_mode
        );
        
        const maxTime = pref?.explicit_max_time || poi.suggested_max_time;
        const distScore = distanceScore(travelMinutes, maxTime);
        
        weightedSum += distScore * poi.user_fit * weight;
        maxPossible += 10 * 10 * weight;
      }
      
      // Add Airbnb area score
      const areaScore = getAreaScoreForPoint(point, input.scored_areas);
      if (areaScore) {
        const quietPref = input.poi_preferences.find(p => p.category === 'quiet');
        const weight = importanceToWeight(quietPref?.importance || 'medium');
        weightedSum += 10 * areaScore.user_fit * weight;
        maxPossible += 10 * 10 * weight;
      }
      
      const poiScore = maxPossible > 0 ? (weightedSum / maxPossible) * 100 : 50;
      
      // ═══════════════════════════════════════════════════════════════
      // STEP 2: Get Neighborhood Multiplier (0.7-1.3)
      // ═══════════════════════════════════════════════════════════════
      
      const neighborhood = findNeighborhoodForPoint(point, input.neighborhood_scores);
      const multiplier = neighborhood?.multiplier ?? 1.0; // Default neutral
      
      // ═══════════════════════════════════════════════════════════════
      // STEP 3: Calculate Final Score
      // ═══════════════════════════════════════════════════════════════
      
      const finalScore = Math.min(100, poiScore * multiplier);
      
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: { 
          score: Math.round(finalScore),
          poi_score: Math.round(poiScore),
          neighborhood_id: neighborhood?.neighborhood_id,
          neighborhood_multiplier: multiplier,
          // For explanations:
          components: {
            poi: Math.round(poiScore),
            neighborhood: neighborhood?.dimension_score,
            multiplier: multiplier,
          }
        }
      };
    })
  };
}

// Pre-calculate neighborhood scores based on user's dimension weights
function calculateNeighborhoodScores(
  neighborhoods: NeighborhoodProfile[],
  userWeights: Record<string, number>
): NeighborhoodScore[] {
  return neighborhoods.map(hood => {
    const dimensionScore = calculateNeighborhoodDimensionScore(hood, userWeights);
    const multiplier = 0.7 + (dimensionScore / 100) * 0.6; // 0.7-1.3
    
    return {
      neighborhood_id: hood.neighborhood_id,
      boundary: hood.boundary,
      dimension_score: dimensionScore,
      multiplier: multiplier,
    };
  });
}
```

---

## Airbnb Data Integration

### Two Storage Options

**Option A: H3 Heatmap (Recommended)**

Pre-compute quietness scores for H3 hexes (~150m resolution):

```typescript
// DynamoDB: leo-airbnb-heatmap
{
  h3_index: "893969a4b27ffff",
  city: "barcelona",
  
  // Raw counts
  airbnb_count: 12,
  review_count: 450,
  
  // Pre-computed (from keyword analysis or Flash-Lite)
  noise_mentions: 23,
  safety_mentions: 2,
  tourist_mentions: 45,
  
  // Derived scores (0-100)
  quietness_score: 35,        // Low = many noise/tourist mentions
  safety_score: 85,
}
```

**Option B: Point Cloud (For detailed queries)**

Store each Airbnb listing for fine-grained lookups:

```typescript
// DynamoDB: leo-airbnb-points
{
  listing_id: "airbnb-123456",
  h3_index: "893969a4b27ffff",
  lat: 41.3987,
  lng: 2.1542,
  
  // From reviews
  noise_flag_count: 3,
  safety_flag_count: 0,
  
  // For map display
  name: "Cozy apartment in Gothic",
  rating: 4.2,
}
```

### Airbnb in Heatmap Scoring

Airbnb data is treated as a **quality signal** about the area, not a POI to travel to:

```typescript
// When scoring a coordinate:
const h3Index = h3.latLngToCell(point.lat, point.lng, 9);
const airbnbData = await getAirbnbHex(h3Index);

// User fit for this area (from Flash-Lite scoring of sample reviews)
const areaUserFit = scoredAreas.find(a => a.id === h3Index)?.user_fit || 5;

// Distance score is always 10 (you're IN the area)
const areaContribution = 10 * areaUserFit * quietWeight;
```

---

## Adaptation Timeline

### Core Principle: No Early Confrontation

With **continuous penalty scoring**, we NEVER ask users to compromise on commute during the initial call:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   INITIAL CALL: Gather ALL preferences, no negotiations                     │
│   ═══════════════════════════════════════════════════                       │
│                                                                             │
│   • Record work locations (even if far apart)                               │
│   • Record POI preferences (coffee, gym, beach)                             │
│   • Record neighborhood preferences                                         │
│   • Show heatmap at end                                                     │
│                                                                             │
│   The system finds the BEST options given their constraints.                │
│   If anchors don't overlap, the midpoint emerges naturally.                 │
│   No "can you compromise?" questions during the call.                       │
│                                                                             │
│   FOLLOW-UP: Only if inventory is truly insufficient                        │
│   ════════════════════════════════════════════════════                      │
│                                                                             │
│   • Day 3: Ask about POI flexibility (coffee further away?)                 │
│   • Week 2-3: LAST RESORT - ask about commute flexibility                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Two Levers (Follow-Up Only)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   LEVER 1: POI SOFTNESS (Day 3)                                             │
│   ═════════════════════════════                                             │
│                                                                             │
│   "How far is acceptable for [POI type]?"                                   │
│                                                                             │
│   STRICT                                             SOFT                   │
│   ├──────────────────────────────────────────────────┤                      │
│   ●════════════►                                     │                      │
│   │                                                  │                      │
│   10 min walk to coffee                              25 min walk to coffee  │
│                                                                             │
│   Effect: More area becomes "bright" on heatmap                             │
│   User impact: Low (still getting good coffee, just a bit further)          │
│   When: DAY 3 (first adjustment if needed)                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LEVER 2: COMMUTE TOLERANCE (Week 2-3 ONLY, LAST RESORT)                   │
│   ═══════════════════════════════════════════════════════                   │
│                                                                             │
│   "How long can you commute to [anchor]?"                                   │
│                                                                             │
│   STRICT                                             FLEXIBLE               │
│   ├──────────────────────────────────────────────────┤                      │
│   ●════════════►                                     │                      │
│   │                                                  │                      │
│   30 min → 0 penalty                                 50 min → -30 penalty   │
│                                                                             │
│   Effect: Reduces commute penalty, more listings surface                    │
│   User impact: HIGH (daily quality of life change)                          │
│   When: WEEK 2-3 ONLY, after POI softening failed                           │
│                                                                             │
│   ⚠️  NEVER during initial call                                             │
│   ⚠️  Only after weeks of low inventory                                     │
│   ⚠️  Explicitly framed as "last option"                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Commute is Last Resort

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   POI FLEXIBILITY:                    COMMUTE FLEXIBILITY:                  │
│   ═════════════════                   ════════════════════                  │
│                                                                             │
│   Coffee 15min instead of 10?         45min commute instead of 30?          │
│                                                                             │
│   Impact: Once a week annoyance       Impact: DAILY quality of life         │
│                                                                             │
│   "I walked 5 extra minutes           "I spend 30 extra minutes             │
│    for coffee today"                   on metro EVERY day"                  │
│                                                                             │
│   Reversal: Easy                      Reversal: Hard (lease signed)         │
│                                                                             │
│   Leo asks this: Day 3                Leo asks this: Week 2-3 ONLY          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Timeline

```
DAY 0: STRICT
════════════════════════════════════════════════════════════════════════════════

  SHAPE: Work(30min) ∩ Beach(20min)
  HEATMAP: Coffee(10min), Gym(15min), Quiet(HIGH)
  THRESHOLD: 75%
  
  Result: 6 listings found ✓
  
────────────────────────────────────────────────────────────────────────────────

DAY 3: SOFTEN POI WEIGHTS (if <10 listings at threshold)
════════════════════════════════════════════════════════════════════════════════

  Leo (email/call): "There aren't many options right now. Would you be okay 
                     with specialty coffee being a 15-min walk instead of 10?"
  
  SHAPE: [UNCHANGED]
  HEATMAP: Coffee(15min) ← was (10min)
           Gym(20min)    ← was (15min)
  THRESHOLD: 70% (slightly lower)
  
  Result: 18 listings found ✓
  
  Visual effect: Same shape, more area is "bright"
  
────────────────────────────────────────────────────────────────────────────────

WEEK 2-3: EXPAND THE SHAPE (last resort)
════════════════════════════════════════════════════════════════════════════════

  Leo (call): "We've been monitoring for 2 weeks and there just isn't much 
               in your area. Would you consider a 40-min commute to work 
               instead of 30? This opens up neighborhoods like X and Y."
  
  SHAPE: Work(40min) ∩ Beach(20min) ← EXPANDED
  HEATMAP: [same weights]
  THRESHOLD: [same]
  
  Result: 45 listings found ✓
  
  Visual effect: The shape itself gets bigger

════════════════════════════════════════════════════════════════════════════════
```

### Follow-Up Triggers

```typescript
// Day 3 cron job
async function checkUserInventory(userId: string) {
  const prefs = await getUserPreferences(userId);
  const listings = await queryListings({
    city: prefs.city,
    minFitScore: 70,  // Reasonable threshold
  });
  
  if (listings.length < 10) {
    // Not enough inventory - schedule follow-up
    await scheduleFollowUp(userId, {
      type: 'poi_softening',
      trigger: 'day_3_low_inventory',
      listingsFound: listings.length,
    });
    
    await sendEmail(userId, {
      template: 'low_inventory_day_3',
      data: { listingsCount: listings.length }
    });
  }
}

// Week 2 cron job (only if Day 3 softening didn't help)
async function checkUserInventoryWeek2(userId: string) {
  const prefs = await getUserPreferences(userId);
  const listings = await queryListings({
    city: prefs.city,
    minFitScore: 65,  // Already softened POIs
  });
  
  if (listings.length < 5 && !prefs.commuteAlreadyExpanded) {
    // Last resort - ask about commute
    await scheduleFollowUp(userId, {
      type: 'commute_expansion',
      trigger: 'week_2_still_low',
      listingsFound: listings.length,
    });
  }
}
```

### Follow-Up Call Flow (Day 3 - POI Softening)

**Email trigger:**
```
Subject: Quick check-in about your Barcelona search 🏠

Hey [Name]!

I've been searching for 3 days and found 6 places that really 
match what you're looking for. That's not a lot, but I have 
an idea that might help.

Got 5 minutes for a quick call? I want to ask about a small 
adjustment that could triple your options.

Talk soon,
Leo
```

**Follow-Up Call Script (Leo):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Leo: "Hey! So I found 6 places that score above 70% for you.              │
│         Not terrible, but I think we can do better.                         │
│                                                                             │
│         Quick question - you mentioned wanting specialty coffee             │
│         within 10 minutes. Would 15 minutes be okay? There's                │
│         still great coffee, just a slightly longer walk."                   │
│                                                                             │
│   User: "Yeah, that's fine."                                                │
│                                                                             │
│   Leo: "Great! What about the gym - could that be 20 minutes                │
│         instead of 15?"                                                     │
│                                                                             │
│   User: "Hmm, I'd prefer to keep gym close."                                │
│                                                                             │
│   Leo: "No problem, gym stays at 15. Let me recalculate...                  │
│         Nice! That gives us 22 options now. I'll send you the               │
│         best ones by tonight."                                              │
│                                                                             │
│   WHAT LEO DOES NOT ASK:                                                    │
│   ❌ "Can you commute longer?"                                              │
│   ❌ "Can your partner commute longer?"                                     │
│   (These are Week 2-3 last resort questions ONLY)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Follow-Up Call Script (Week 2-3, Last Resort)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Leo: "Hey, I wanted to check in. We've been monitoring for 2 weeks        │
│         and the market in your area is pretty tight right now.              │
│                                                                             │
│         Would you consider a 40-minute commute to work instead of 30?       │
│         That would open up some great neighborhoods like Gràcia and         │
│         Poblenou that score really well on everything else you care         │
│         about."                                                             │
│                                                                             │
│   User: "I guess I could do 40 minutes."                                    │
│                                                                             │
│   Leo: "Perfect. Let me regenerate your map... Wow, that's a big            │
│         difference - we now have 45 options. I'll send you the top          │
│         10 tomorrow morning."                                               │
│                                                                             │
│   [BACKGROUND: Regenerate shape with Work(40min), recalculate everything]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Differences from OLD Zone Permutations:**

| OLD (8 Permutations) | NEW (2 Levers) |
|----------------------|----------------|
| Try weighting top dimensions 2× | N/A (already in formula) |
| Try including surprise neighborhoods | N/A (automatic from dimension scores) |
| Try different POI travel modes | Just ask: "Can X be further?" |
| Try relaxing POI count | Just lower threshold |
| Try expanding POI radius | Ask about each important POI |
| Try different anchor modes | N/A (user specified) |
| Try relaxing commute | Ask directly (last resort) |
| Try multiple anchors | Ask directly (last resort) |

**Result:** Instead of a complex state machine with 8 branches, we have **2 simple questions**:
1. "Can [POI] be further away?" (Day 3)
2. "Can your commute be longer?" (Week 2-3, last resort)

---

### Threshold Slider (User-Facing)

Instead of complex permutations, users can simply adjust their threshold:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   YOUR FIT THRESHOLD: ████████████████░░░░░░░░ 75%                          │
│                       ◄────────────────────────►                            │
│                                                                             │
│   Listings found: 8 properties                                              │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   YOUR FIT THRESHOLD: ██████████████████████░░ 55%                          │
│                       ◄────────────────────────►                            │
│                                                                             │
│   Listings found: 34 properties                                             │
│                                                                             │
│   "You're now seeing places with longer walks to coffee or                  │
│    in areas with more tourist activity"                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Generate Shape

```
POST /api/recommender/generate-shape

Input:
{
  anchors: [
    { type: "work", address: "Passeig de Gràcia 100", max_minutes: 30, mode: "transit" },
    { type: "beach", address: "Barceloneta", max_minutes: 20, mode: "walk" }
  ]
}

Output:
{
  shape: GeoJSON.Polygon,
  area_km2: 4.5,
  neighborhoods_touched: ["Eixample", "Gràcia", "Sant Martí"]
}
```

### 2. Search POIs

```
POST /api/recommender/search-pois

Input:
{
  category: "coffee",
  query: "specialty coffee",
  city: "Barcelona",
  limit: 15
}

Output:
{
  pois: [
    {
      id: "poi_123",
      name: "Satan's Coffee Corner",
      lat: 41.3856,
      lng: 2.1699,
      rating: 4.8,
      review_count: 1200,
      sample_reviews: ["Amazing third-wave...", ...]
    }
  ]
}
```

### 3. Score POIs for User

```
POST /api/recommender/score-pois

Input: (see ScorePOIsRequest above)

Output: (see ScorePOIsResponse above)
```

### 4. Calculate Heatmap

### 4. Score Neighborhoods for User

```
POST /api/recommender/score-neighborhoods

Input:
{
  city: "barcelona",
  user_dimension_weights: {
    creative_scene: 1.5,
    nightlife: 1.5,
    family_friendly: 0.5,
    safety: 1.0,
    walkability: 1.0
  }
}

Output:
{
  neighborhood_scores: [
    {
      neighborhood_id: "barcelona-gracia",
      name: "Gràcia",
      dimension_score: 85,
      multiplier: 1.21,
      top_dimensions: ["creative_scene", "nightlife"],
      boundary: GeoJSON.Polygon
    },
    {
      neighborhood_id: "barcelona-sarria",
      name: "Sarrià",
      dimension_score: 42,
      multiplier: 0.75,
      top_dimensions: ["family_friendly", "safety"],
      boundary: GeoJSON.Polygon
    }
  ]
}
```

### 5. Calculate Heatmap

```
POST /api/recommender/calculate-heatmap

Input:
{
  shape: GeoJSON.Polygon,
  scored_pois: ScoredPOI[],
  scored_areas: ScoredArea[],
  neighborhood_scores: NeighborhoodScore[],  // From endpoint 4
  poi_preferences: POIPreference[],
  resolution: 100  // meters
}

Output:
{
  heatmap: GeoJSON.FeatureCollection,  // Points with combined scores
  neighborhood_layer: GeoJSON.FeatureCollection,  // Solid colors per hood
  stats: {
    min_score: 22,
    max_score: 94,
    avg_score: 58,
    area_above_75: "2.1 km²",
    best_neighborhoods: ["Gràcia", "El Born"]
  }
}
```

### 6. Get Listings in Heatmap

```
POST /api/recommender/listings-in-heatmap

Input:
{
  shape: GeoJSON.Polygon,
  min_threshold: 75,
  limit: 20
}

Output:
{
  listings: [
    {
      id: "listing_123",
      heatmap_score: 82,
      lat: 41.3920,
      lng: 2.1645,
      // ... listing details
      score_breakdown: {
        coffee: { nearest: "Satan's Coffee", distance: 6, contribution: 45 },
        gym: { nearest: "CrossFit Eixample", distance: 12, contribution: 22 },
        quiet: { area_score: 8, contribution: 35 }
      }
    }
  ]
}
```

---

## Cost Analysis

| Step | Service | Cost per User |
|------|---------|---------------|
| POI Search (10 categories) | ScrapingDog | ~$0.05 |
| POI Scoring | Flash-Lite | ~$0.002 |
| Airbnb Area Scoring | Flash-Lite | ~$0.001 |
| Commute Zone Generation | Turf.js | **FREE** |
| Travel Time Calculations | Turf.js (all modes) | **FREE** |
| Heatmap Math | Local compute | FREE |
| **Total per intake** | | **~$0.05** |

> **MVP Savings:** Using Turf.js instead of Geoapify saves ~$0.02/user. Future upgrade to real isochrones costs ~$0.01/anchor when precision matters.

### Pre-Computation (One-Time)

| Task | Cost |
|------|------|
| Airbnb H3 heatmap (all Spain) | ~$50 |
| Neighborhood boundaries import | FREE |
| Initial POI cache (major cities) | ~$20 |

---

## Live Map UI (During Intake Call)

The heatmap builds **in real-time** during the intake call, giving users instant visual feedback that their words are becoming a personalized map.

### Split-Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────┐                                                                             │
│ │ SIDEBAR │                                                                             │
│ │         │   HABLA CON LEO (50%)              │     LIVE MAP (50%)                    │
│ │ • Home  │   ═════════════════                │     ════════════                       │
│ │ • Search│                                    │                                        │
│ │ • Chat  │   ┌────────────────────────────┐   │   ┌────────────────────────────────┐  │
│ │ • ...   │   │                            │   │   │                                │  │
│ │         │   │   🎙️ Listening...          │   │   │     [MAPBOX MAP]               │  │
│ │         │   │                            │   │   │                                │  │
│ │         │   │   Leo: "¿En qué ciudad     │   │   │     Real-time updates:         │  │
│ │         │   │         estás buscando?"   │   │   │     • Zoom to city             │  │
│ │         │   │                            │   │   │     • Isochrones appear        │  │
│ │         │   │   You: "Barcelona, cerca   │   │   │     • Shape forms              │  │
│ │         │   │         de mi trabajo en   │   │   │     • Heatmap builds           │  │
│ │         │   │         Eixample"          │   │   │                                │  │
│ │         │   │                            │   │   │                                │  │
│ │         │   │   🔊 ━━━━━━━━━━━━━━━━━━━━ │   │   │                                │  │
│ │         │   │                            │   │   │                                │  │
│ │         │   │   [End Call]               │   │   │                                │  │
│ │         │   └────────────────────────────┘   │   └────────────────────────────────┘  │
│ │         │                                    │                                        │
│ └─────────┘                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Progressive Map States

```
MINUTE 0: INITIAL STATE                    MINUTE 2: CITY MENTIONED
┌────────────────────────────────┐         ┌────────────────────────────────┐
│                                │         │                                │
│        [SPAIN MAP]             │         │     [ZOOM TO BARCELONA]        │
│                                │         │                                │
│       ┌───────┐                │         │   ┌─────────────────────┐      │
│       │ SPAIN │                │  ──►    │   │     BARCELONA       │      │
│       └───────┘                │         │   │     (city bounds)   │      │
│                                │         │   └─────────────────────┘      │
│  "Tell me about yourself..."   │         │                                │
│                                │         │   🎯 City detected             │
└────────────────────────────────┘         └────────────────────────────────┘

MINUTE 3: FIRST ANCHOR                     MINUTE 5: SECOND ANCHOR
┌────────────────────────────────┐         ┌────────────────────────────────┐
│                                │         │                                │
│   ┌─────────────────────┐      │         │   ┌─────────────────────┐      │
│   │       ╭─────╮       │      │         │   │   ╭─────╮   ╭────╮  │      │
│   │      ╱       ╲      │      │  ──►    │   │  ╱       ╲ ╱      ╲ │      │
│   │     │  ◉ Work │     │      │         │   │ │  ◉ Work ││🏖Beach││      │
│   │      ╲       ╱      │      │         │   │  ╲       ╱ ╲      ╱ │      │
│   │       ╰─────╯       │      │         │   │   ╰──┬──╯   ╰────╯  │      │
│   └─────────────────────┘      │         │   └─────────────────────┘      │
│                                │         │                                │
│   🚇 Work: 30-min isochrone    │         │   🏖 Beach: 20-min isochrone   │
└────────────────────────────────┘         └────────────────────────────────┘

MINUTE 6: INTERSECTION = SHAPE             MINUTE 7: NEIGHBORHOODS COLORED
┌────────────────────────────────┐         ┌────────────────────────────────┐
│                                │         │                                │
│   ┌─────────────────────┐      │         │   ┌─────────────────────┐      │
│   │     ╭─────────╮     │      │         │   │     ╭─────────╮     │      │
│   │    ╱           ╲    │      │  ──►    │   │    ╱███████████╲    │      │
│   │   │  SWEET SPOT │   │      │         │   │   │██ GRÀCIA ███│   │      │
│   │    ╲           ╱    │      │         │   │   │▓▓ EIXAMPLE ▓▓│  │      │
│   │     ╰─────────╯     │      │         │   │    ╲▓▓▓▓▓▓▓▓▓▓▓╱    │      │
│   └─────────────────────┘      │         │   └─────────────────────┘      │
│                                │         │                                │
│   ✨ Your search boundary!     │         │   🎨 Lifestyle → hood colors   │
└────────────────────────────────┘         └────────────────────────────────┘

MINUTE 9: POI LAYER BUILDS                 MINUTE 13: FINAL MAP
┌────────────────────────────────┐         ┌────────────────────────────────┐
│                                │         │                                │
│   ┌─────────────────────┐      │         │   ┌─────────────────────┐      │
│   │     ╭─────────╮     │      │         │   │     ╭─────────╮     │      │
│   │    ╱░▒▓██████▓▒░╲   │      │  ──►    │   │    ╱░▒▓██████▓▒░╲   │      │
│   │   │▒▓█ ☕92% █▓▒│   │      │         │   │   │▒▓█☕💪92%█▓▒│   │      │
│   │   │▓█ ☕    ██▓│    │      │         │   │   │▓█ 🤫 85%  ██▓│  │      │
│   │    ╲░▒▓████▓▒░╱     │      │         │   │    ╲░▒▓█78%█▓▒░╱    │      │
│   └─────────────────────┘      │         │   └─────────────────────┘      │
│                                │         │   ◉ Work    🏖 Beach           │
│   ☕ Coffee POIs searched      │         │   🎉 14 listings found!        │
└────────────────────────────────┘         └────────────────────────────────┘
```

### Mapbox Integration

**Why Mapbox:**
- 50,000 free map loads/month
- Single map instance, update layers without reload
- Smooth animations for shape/heatmap transitions
- Good mobile support

**Single-Load Architecture:**

```typescript
// components/LiveMap.tsx
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface LiveMapProps {
  onMapReady?: (map: mapboxgl.Map) => void;
}

export function LiveMap({ onMapReady }: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  
  // Initialize map ONCE
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-3.7038, 40.4168], // Spain center
      zoom: 5,
    });
    
    mapRef.current.on('load', () => {
      // Add empty sources for layers we'll update
      mapRef.current!.addSource('isochrones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      mapRef.current!.addSource('shape', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      mapRef.current!.addSource('neighborhoods', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      mapRef.current!.addSource('heatmap', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      mapRef.current!.addSource('pois', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      // Add layers
      mapRef.current!.addLayer({
        id: 'neighborhoods-fill',
        type: 'fill',
        source: 'neighborhoods',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.4
        }
      });
      
      mapRef.current!.addLayer({
        id: 'shape-outline',
        type: 'line',
        source: 'shape',
        paint: {
          'line-color': '#2563eb',
          'line-width': 3
        }
      });
      
      mapRef.current!.addLayer({
        id: 'heatmap-layer',
        type: 'circle',
        source: 'heatmap',
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'interpolate', ['linear'], ['get', 'score'],
            0, '#fee2e2',
            50, '#fef08a',
            75, '#bbf7d0',
            100, '#22c55e'
          ],
          'circle-opacity': 0.7
        }
      });
      
      mapRef.current!.addLayer({
        id: 'poi-markers',
        type: 'symbol',
        source: 'pois',
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.8
        }
      });
      
      onMapReady?.(mapRef.current!);
    });
    
    return () => {
      // Only destroy on full unmount
      mapRef.current?.remove();
    };
  }, []);
  
  return <div ref={mapContainer} className="w-full h-full" />;
}
```

**Updating Layers (No Reload):**

```typescript
// hooks/useLiveMapUpdates.ts
import { useCallback } from 'react';
import type mapboxgl from 'mapbox-gl';

export function useLiveMapUpdates(map: mapboxgl.Map | null) {
  
  const zoomToCity = useCallback((city: string, bounds: [number, number, number, number]) => {
    if (!map) return;
    map.fitBounds(bounds, { padding: 50, duration: 1500 });
  }, [map]);
  
  const addIsochrone = useCallback((geojson: GeoJSON.Feature, color: string) => {
    if (!map) return;
    const source = map.getSource('isochrones') as mapboxgl.GeoJSONSource;
    // Append to existing features
    const existing = (source as any)._data as GeoJSON.FeatureCollection;
    source.setData({
      type: 'FeatureCollection',
      features: [...existing.features, { ...geojson, properties: { ...geojson.properties, color } }]
    });
  }, [map]);
  
  const setShape = useCallback((geojson: GeoJSON.Polygon) => {
    if (!map) return;
    const source = map.getSource('shape') as mapboxgl.GeoJSONSource;
    source.setData(geojson);
  }, [map]);
  
  const setNeighborhoods = useCallback((geojson: GeoJSON.FeatureCollection) => {
    if (!map) return;
    const source = map.getSource('neighborhoods') as mapboxgl.GeoJSONSource;
    source.setData(geojson);
  }, [map]);
  
  const updateHeatmap = useCallback((geojson: GeoJSON.FeatureCollection) => {
    if (!map) return;
    const source = map.getSource('heatmap') as mapboxgl.GeoJSONSource;
    source.setData(geojson);
  }, [map]);
  
  const addPOIs = useCallback((pois: Array<{ lat: number; lng: number; icon: string; name: string }>) => {
    if (!map) return;
    const source = map.getSource('pois') as mapboxgl.GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features: pois.map(poi => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [poi.lng, poi.lat] },
        properties: { icon: poi.icon, name: poi.name }
      }))
    });
  }, [map]);
  
  return {
    zoomToCity,
    addIsochrone,
    setShape,
    setNeighborhoods,
    updateHeatmap,
    addPOIs
  };
}
```

**WebSocket Events (Real-Time Updates):**

```typescript
// During intake call, ElevenLabs tools trigger WebSocket events:

// Tool: detect_city
ws.send({ type: 'ZOOM_TO_CITY', payload: { city: 'barcelona', bounds: [...] } });

// Tool: add_anchor
ws.send({ type: 'ADD_ISOCHRONE', payload: { geojson: {...}, label: 'Work', color: '#3b82f6' } });

// Tool: calculate_intersection
ws.send({ type: 'SET_SHAPE', payload: { geojson: {...} } });

// Tool: score_neighborhoods
ws.send({ type: 'SET_NEIGHBORHOODS', payload: { geojson: {...} } });

// Tool: search_and_score_pois
ws.send({ type: 'ADD_POIS', payload: { pois: [...] } });
ws.send({ type: 'UPDATE_HEATMAP', payload: { geojson: {...} } });
```

### Cost Analysis

```
Mapbox Free Tier: 50,000 map loads/month

Our Usage Estimate (500 active users/month):
├── Intake calls: 500 users × 1 load = 500 loads
├── Profile views: 500 users × 10 views = 5,000 loads
├── Property pages: 500 users × 50 views = 25,000 loads
└── TOTAL: ~30,500 loads/month ✅ UNDER FREE TIER

Key Optimizations:
• Map loads ONCE per page visit
• Shape/heatmap/POI updates are DATA updates, not map reloads
• Lazy load <LiveMap /> component (dynamic import)
• Only load on pages that need it (call, profile, property)
```

### Pages Using the Map

| Page | Map Usage | Load Count |
|------|-----------|------------|
| `/speak-with-leo` | Live split-screen during call | 1 per call |
| `/profile` | View saved heatmap | 1 per visit |
| `/property/[id]` | Show listing on heatmap | 1 per visit |
| `/explore` (future) | Full-screen exploration | 1 per visit |

---

## Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Create `leo-airbnb-heatmap` DynamoDB table (H3 hex → quietness scores)
- [ ] Create `leo-poi-cache` DynamoDB table (POI search results)
- [ ] Create `leo-neighborhood-boundaries` DynamoDB table (GeoJSON per hood)
- [ ] Import Spain neighborhood GeoJSON from geo2day.com
- [ ] Run Airbnb H3 analysis script (`scripts/airbnb-analysis.ts`)
- [ ] Ensure `leo-neighborhood-profiles` has 20 dimensions per hood

### Phase 2: API Endpoints

- [ ] `POST /api/recommender/generate-commute-zones` - Turf.js radial circles (FREE)
- [ ] `POST /api/recommender/search-pois` - ScrapingDog Google Maps search
- [ ] `POST /api/recommender/score-pois` - Flash-Lite user fit scoring
- [ ] `POST /api/recommender/score-neighborhoods` - Calculate hood multipliers from user weights
- [ ] `POST /api/recommender/calculate-heatmap` - Combined 3-layer formula
- [ ] `POST /api/recommender/listings-in-heatmap` - Filter listings by threshold

### Phase 3: Real-Time Integration

**ElevenLabs Tools:**
- [ ] `detect_city` - Triggers `ZOOM_TO_CITY` WebSocket event
- [ ] `add_anchor` - Generates Turf.js circles, triggers `ADD_COMMUTE_ZONE` event
- [ ] `calculate_penalties` - Computes graduated penalties for listings
- [ ] `infer_dimension_weights` - Extract lifestyle preferences
- [ ] `extract_neighborhood_mentions` - Track explicit hood mentions + sentiment
- [ ] `score_neighborhoods` - Calculate multipliers, triggers `SET_NEIGHBORHOODS` event
- [ ] `search_and_score_pois` - Search + score, triggers `ADD_POIS` + `UPDATE_HEATMAP` events

**WebSocket/Pusher:**
- [ ] Pusher channel: `user-{userId}-map` for real-time updates
- [ ] Event types: `ZOOM_TO_CITY`, `ADD_ISOCHRONE`, `SET_SHAPE`, `SET_NEIGHBORHOODS`, `ADD_POIS`, `UPDATE_HEATMAP`
- [ ] Backend route to push events from ElevenLabs tool callbacks

---

## Handling No-Overlap / Isolated Anchors

When isochrones **don't overlap** (no intersection), or one anchor is **isolated** from the Venn, the agent handles it gracefully with an iterative feedback loop.

### Scenario: Isolated Anchor

```
USER: "I work in Eixample, and my gym is in Badalona"

Map shows:
┌────────────────────────────────────────┐
│                                        │
│   ╭─────────╮                          │
│  ╱           ╲                         │
│ │ ◉ Work     │         ╭─────╮         │
│  ╲ (Eixample)╱         │💪Gym│         │
│   ╰─────────╯          │(Bad)│         │
│                        ╰─────╯         │
│        ↑                   ↑           │
│      30-min              Isolated!     │
│     isochrone           No overlap     │
│                                        │
└────────────────────────────────────────┘

Result: calculate_intersection returns { overlap: false, isolated_anchors: ['gym'] }
```

### Agent Flow: No Overlap Detected

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   STEP 1: DETECT & EXPLAIN                                                  │
│   ════════════════════════                                                  │
│                                                                             │
│   Leo: "I can see your gym in Badalona doesn't overlap with your           │
│         30-minute commute to work. On the map, you can see they're          │
│         separate bubbles."                                                  │
│                                                                             │
│   [Map shows two separate isochrones, no intersection]                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STEP 2: OFFER EXTENSION                                                   │
│   ═══════════════════════                                                   │
│                                                                             │
│   Leo: "Would you be okay with a longer trip to your gym? If we             │
│         extended it to 25 minutes, the bubbles would start to overlap."     │
│                                                                             │
│   User: "No, I really need to be close to my gym. I go every morning."      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STEP 3: PIVOT TO ALTERNATIVES                                             │
│   ═════════════════════════════                                             │
│                                                                             │
│   Leo: "Got it! What if we found you a different gym that's within          │
│         your commute area? What makes a good gym for you - is it            │
│         specifically CrossFit? Do you need certain equipment?"              │
│                                                                             │
│   User: "Yeah it needs to be CrossFit with good coaches."                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STEP 4: SEARCH & SHOW ALTERNATIVES                                        │
│   ═══════════════════════════════════                                       │
│                                                                             │
│   [BACKGROUND: ScrapingDog searches "CrossFit gym" within the work shape]   │
│   [BACKGROUND: Flash-Lite scores each for "good coaches"]                   │
│                                                                             │
│   Leo: "Great news! I found 3 CrossFit gyms within your commute area.       │
│         Check out the map - I'm showing them now with how well they         │
│         match what you're looking for."                                     │
│                                                                             │
│   [Map shows: Work isochrone + 3 gym markers with scores]                   │
│                                                                             │
│   💪 CrossFit Eixample (92% match) - "Amazing coaches, tough workouts"      │
│   💪 CrossFit Gràcia (85% match) - "Good community, smaller classes"        │
│   💪 WOD Box (71% match) - "Basic equipment, decent"                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STEP 5: USER CHOOSES OR KEEPS ORIGINAL                                    │
│   ══════════════════════════════════════                                    │
│                                                                             │
│   Leo: "CrossFit Eixample has amazing reviews for their coaching.           │
│         Would any of these work for you, or is your current gym             │
│         non-negotiable?"                                                    │
│                                                                             │
│   OPTION A: User accepts alternative                                        │
│   User: "Actually CrossFit Eixample sounds great!"                          │
│   → Replace gym anchor with POI, continue building heatmap                  │
│                                                                             │
│   OPTION B: User keeps original                                             │
│   User: "No, I really want to stay at my gym in Badalona."                  │
│   → Leo: "No problem! We'll keep Badalona as your gym anchor and            │
│           find places that work for both. The search area will be           │
│           smaller but let's see what we find."                              │
│   → Extend gym travel time just enough to create minimal overlap            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visual: Iterative Feedback Loop

```
NO OVERLAP DETECTED                      ALTERNATIVES SHOWN
┌────────────────────────────────┐       ┌────────────────────────────────┐
│                                │       │                                │
│   ╭─────────╮                  │       │   ╭─────────╮                  │
│  ╱           ╲      ╭─────╮    │       │  ╱   💪92%  ╲                  │
│ │ ◉ Work     │      │💪Gym│    │  ──►  │ │ ◉ Work     │                 │
│  ╲           ╱      │(far)│    │       │  ╲  💪85%   ╱                  │
│   ╰─────────╯       ╰─────╯    │       │   ╰─💪71%──╯                   │
│                                │       │                                │
│   ❌ No overlap!               │       │   ✅ 3 alternatives found!     │
│                                │       │                                │
└────────────────────────────────┘       └────────────────────────────────┘

USER ACCEPTS ALTERNATIVE                 USER KEEPS ORIGINAL (EXTENDED)
┌────────────────────────────────┐       ┌────────────────────────────────┐
│                                │       │                                │
│   ╭─────────╮                  │       │   ╭─────────╮    ╭─────────╮   │
│  ╱░▒▓██████▓▒░╲                │       │  ╱░▒▓████▓▒░╲  ╱░▒▓████▓▒░╲  │
│ │▒▓█ 💪NEW █▓▒│                │       │ │▒▓█   ◉   █▓▒││▒▓█  💪  █▓▒│ │
│  ╲░▒▓██████▓▒░╱                │       │  ╲░▒▓████▓▒░╲╱░▒▓████▓▒░╱   │
│   ╰─────────╯                  │       │   ╰────┬────╯╰────┬────╯     │
│                                │       │        └────┬────┘           │
│   Gym becomes POI in shape     │       │         Small overlap         │
│   Full heatmap continues       │       │         (extended travel)     │
└────────────────────────────────┘       └────────────────────────────────┘
```

### Implementation

**The Problem: Non-Overlapping Commute Zones**

With Turf.js radial circles (our MVP approach), circles may not overlap when anchors are far apart:

```
3 COMMUTE ZONES                          INTERSECTION RESULT
┌────────────────────────────────────┐   ┌────────────────────────────┐
│                                    │   │                            │
│   ╭─────╮  ╭─────╮                 │   │   intersect(A, B, C)       │
│  ╱   A   ╲╱   B   ╲     ╭─────╮    │   │                            │
│ │    ◉    ▓▓▓    ◉│    │  C  │    │   │   Result: EMPTY            │
│  ╲       ╱╲       ╱    │ ◉   │    │   │                            │
│   ╰─────╯  ╰─────╯      ╰─────╯    │   │   ❌ Doesn't tell us       │
│       ↑                    ↑       │   │      WHICH one is isolated │
│    A ∩ B exists         C alone    │   │                            │
│                                    │   └────────────────────────────┘
└────────────────────────────────────┘
```

**Solution: Turf.js Pairwise Analysis**

```typescript
import * as turf from '@turf/turf';

interface IsochoneWithMeta {
  id: string;
  anchor_type: string;     // 'work', 'gym', 'school'
  anchor_name: string;
  geojson: GeoJSON.Polygon;
  travel_minutes: number;
}

interface OverlapAnalysis {
  has_full_overlap: boolean;
  final_shape?: GeoJSON.Polygon;
  overlap_pairs: Array<{ a: string; b: string; area_km2: number }>;
  isolated_anchors: Array<{
    anchor_id: string;
    anchor_type: string;
    anchor_name: string;
    overlaps_with: string[];        // Which other anchors it overlaps with
    min_extension_needed?: number;  // Minutes to extend for full overlap
  }>;
  largest_subset: string[];         // IDs of largest overlapping group
  largest_subset_shape?: GeoJSON.Polygon;
}

function analyzeIsochrones(isochrones: IsochoneWithMeta[]): OverlapAnalysis {
  const n = isochrones.length;
  
  // Step 1: Build overlap graph (pairwise checks)
  const overlapPairs: Array<{ a: string; b: string; area_km2: number }> = [];
  const overlapGraph: Map<string, Set<string>> = new Map();
  
  for (let i = 0; i < n; i++) {
    overlapGraph.set(isochrones[i].id, new Set());
  }
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const intersection = turf.intersect(
        turf.featureCollection([
          turf.feature(isochrones[i].geojson),
          turf.feature(isochrones[j].geojson)
        ])
      );
      
      if (intersection) {
        const area = turf.area(intersection) / 1_000_000; // km²
        overlapPairs.push({ 
          a: isochrones[i].id, 
          b: isochrones[j].id, 
          area_km2: area 
        });
        overlapGraph.get(isochrones[i].id)!.add(isochrones[j].id);
        overlapGraph.get(isochrones[j].id)!.add(isochrones[i].id);
      }
    }
  }
  
  // Step 2: Try full intersection
  let fullIntersection: GeoJSON.Polygon | null = null;
  if (n >= 2) {
    fullIntersection = isochrones.reduce((acc, iso, idx) => {
      if (idx === 0) return iso.geojson;
      const result = turf.intersect(
        turf.featureCollection([
          turf.feature(acc),
          turf.feature(iso.geojson)
        ])
      );
      return result?.geometry as GeoJSON.Polygon || null;
    }, null as GeoJSON.Polygon | null);
  }
  
  // Step 3: Identify isolated anchors
  const isolated: OverlapAnalysis['isolated_anchors'] = [];
  const allIds = isochrones.map(i => i.id);
  
  for (const iso of isochrones) {
    const overlapsWithSet = overlapGraph.get(iso.id)!;
    const overlapsWithAll = allIds.every(
      id => id === iso.id || overlapsWithSet.has(id)
    );
    
    if (!overlapsWithAll) {
      isolated.push({
        anchor_id: iso.id,
        anchor_type: iso.anchor_type,
        anchor_name: iso.anchor_name,
        overlaps_with: Array.from(overlapsWithSet)
      });
    }
  }
  
  // Step 4: Find largest overlapping subset (greedy)
  const largestSubset = findLargestOverlappingSubset(isochrones, overlapGraph);
  let largestSubsetShape: GeoJSON.Polygon | null = null;
  
  if (largestSubset.length >= 2) {
    const subsetIsos = isochrones.filter(i => largestSubset.includes(i.id));
    largestSubsetShape = subsetIsos.reduce((acc, iso, idx) => {
      if (idx === 0) return iso.geojson;
      const result = turf.intersect(
        turf.featureCollection([
          turf.feature(acc),
          turf.feature(iso.geojson)
        ])
      );
      return result?.geometry as GeoJSON.Polygon || null;
    }, null as GeoJSON.Polygon | null);
  }
  
  return {
    has_full_overlap: fullIntersection !== null,
    final_shape: fullIntersection || undefined,
    overlap_pairs: overlapPairs,
    isolated_anchors: isolated,
    largest_subset: largestSubset,
    largest_subset_shape: largestSubsetShape || undefined
  };
}

// Find largest subset of isochrones that all mutually overlap
function findLargestOverlappingSubset(
  isochrones: IsochoneWithMeta[],
  overlapGraph: Map<string, Set<string>>
): string[] {
  // For small n (typically 2-5 anchors), brute force is fine
  const ids = isochrones.map(i => i.id);
  let best: string[] = [];
  
  // Check all subsets from largest to smallest
  for (let size = ids.length; size >= 2; size--) {
    for (const subset of combinations(ids, size)) {
      if (allMutuallyOverlap(subset, overlapGraph)) {
        return subset; // First found at this size is good enough
      }
    }
  }
  
  return best;
}

function allMutuallyOverlap(ids: string[], graph: Map<string, Set<string>>): boolean {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (!graph.get(ids[i])!.has(ids[j])) {
        return false;
      }
    }
  }
  return true;
}
```

**Example: 3 Isochrones, 1 Isolated**

```
INPUT:
  isochrones = [
    { id: 'work', geojson: workPolygon },
    { id: 'partner_work', geojson: partnerPolygon },
    { id: 'gym', geojson: gymPolygon }  // Isolated!
  ]

OUTPUT:
  {
    has_full_overlap: false,
    final_shape: undefined,
    
    overlap_pairs: [
      { a: 'work', b: 'partner_work', area_km2: 12.5 }
      // Note: no pairs with 'gym'
    ],
    
    isolated_anchors: [
      {
        anchor_id: 'gym',
        anchor_type: 'gym',
        anchor_name: 'CrossFit Badalona',
        overlaps_with: []  // Doesn't overlap with anything!
      }
    ],
    
    largest_subset: ['work', 'partner_work'],
    largest_subset_shape: { type: 'Polygon', coordinates: [...] }  // The Venn
  }
```

**Visual: What The Analysis Tells Us**

```
RAW DATA                                 ANALYSIS RESULT
┌────────────────────────────────────┐   ┌────────────────────────────────────┐
│                                    │   │                                    │
│   ╭─────╮  ╭─────╮                 │   │   OVERLAP GRAPH:                   │
│  ╱ work  ╲╱partner╲     ╭─────╮    │   │                                    │
│ │    ◉   ▓▓▓    ◉│    │ gym │    │   │   work ──── partner                │
│  ╲       ╱╲       ╱    │  ◉  │    │   │                                    │
│   ╰─────╯  ╰─────╯      ╰─────╯    │   │   gym (isolated)                   │
│                                    │   │                                    │
└────────────────────────────────────┘   │   LARGEST SUBSET: [work, partner]  │
                                         │   SHAPE: ▓▓▓ (the Venn)            │
                                         │                                    │
                                         │   ISOLATED: gym                    │
                                         │   → Offer alternatives             │
                                         └────────────────────────────────────┘
```

**Tool: `calculate_intersection`**

```typescript
interface IntersectionResult {
  success: boolean;
  overlap: boolean;
  shape?: GeoJSON.Polygon;
  isolated_anchors?: Array<{
    anchor_id: string;
    anchor_type: string;         // 'work', 'gym', 'school', etc.
    anchor_name: string;
    overlaps_with: string[];     // Which anchors it DOES overlap with
    min_extension_needed: number; // Minutes to extend for overlap
  }>;
  overlap_area_km2?: number;
  // NEW: For partial overlap scenarios
  largest_overlapping_subset?: string[];
  largest_subset_shape?: GeoJSON.Polygon;
}

// Example response when gym is isolated:
{
  success: true,
  overlap: false,
  isolated_anchors: [
    {
      anchor_id: "gym_1",
      anchor_type: "gym",
      anchor_name: "CrossFit Badalona",
      min_extension_needed: 15  // Need 25min instead of 10min
    }
  ]
}
```

**ElevenLabs Agent State: `HANDLE_NO_OVERLAP`**

```typescript
// Agent state machine addition:
{
  state: "HANDLE_NO_OVERLAP",
  
  on_enter: (isolatedAnchors) => {
    // Explain the situation
    speak(`I can see your ${isolatedAnchors[0].anchor_type} doesn't overlap 
           with your commute area...`);
  },
  
  transitions: {
    "user_extends_travel": {
      // User agrees to extend travel time
      next_state: "RECALCULATE_INTERSECTION",
      action: (newTravelTime) => updateAnchor(anchor_id, newTravelTime)
    },
    
    "user_wants_alternatives": {
      // User wants to explore alternatives
      next_state: "SEARCH_ALTERNATIVE_POIS",
      action: () => askForPOICriteria()
    },
    
    "user_insists_on_original": {
      // User won't budge
      next_state: "FORCE_MINIMAL_OVERLAP",
      action: () => extendToMinimalOverlap()
    }
  }
}
```

**Tool: `search_alternative_pois`**

```typescript
// Triggered when user wants alternatives
{
  tool: "search_alternative_pois",
  parameters: {
    category: "gym",
    query: "CrossFit gym good coaches",  // From user's criteria
    within_shape: current_work_isochrone, // Search within existing shape
    exclude_location: "Badalona"          // Exclude their current gym area
  }
}

// Returns POIs scored for user fit, displayed on map immediately
```

### Why This Is Great UX

| Traditional Approach | Our Approach |
|---------------------|--------------|
| "Sorry, no overlap. Please adjust." | "I see the problem. Let me show you alternatives." |
| User has to guess what to change | Agent explains exactly what's happening visually |
| Feels like failure | Feels like collaborative problem-solving |
| Static back-and-forth | Instant visual feedback on map |
| One option at a time | Multiple alternatives shown at once |

### Key Principles

1. **Never just fail** - Always offer a path forward
2. **Show, don't tell** - Map updates make the problem obvious
3. **Give options** - Extend travel OR explore alternatives
4. **Stay collaborative** - "What makes a good gym for you?"
5. **Instant feedback** - Alternatives appear on map immediately
6. **User keeps control** - They can insist on original if they want

---

## Vibe-Check: Property Photos Replace Map

During the **vibe-check** phase (calibrating user perception with 3 WPA-analyzed properties), the map temporarily gives way to property photos.

### When Vibe-Check Triggers

```
MINUTE 8-10: Leo has enough info to do a quick fit score
             → Finds top 3 properties in the shape
             → Runs full WPA on them (30 photos each)
             → Triggers vibe-check UI
```

### Split-Screen During Vibe-Check

```
NORMAL MODE (Map)                        VIBE-CHECK MODE (Properties)
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ CALL UI        │    MAP         │      │ CALL UI        │  VIBE-CHECK    │
│                │                │      │                │                │
│ Leo: "Tell me  │  ╭─────────╮   │      │ Leo: "Forget   │ ┌────────────┐ │
│ about your     │ ╱░▒▓████▓▒░╲  │      │ location for   │ │ 📸 PHOTO 1 │ │
│ lifestyle..."  │ │▒▓██ 85% █▓▒│ │  ──► │ a sec. What    │ │            │ │
│                │  ╲░▒▓████▓▒░╱  │      │ do you think   │ │  "Light: 8"│ │
│                │   ╰─────────╯  │      │ of this one?"  │ │  "Space: 7"│ │
│                │                │      │                │ └────────────┘ │
│ [Mute] [End]   │                │      │ [Mute] [End]   │ [Love] [Meh]  │
└─────────────────────────────────┘      └─────────────────────────────────┘
```

### Vibe-Check Card UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   🏠 VIBE CHECK: Property 1 of 3                                            │
│   ════════════════════════════════                                          │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │                         [HERO PHOTO]                                │   │
│   │                                                                     │   │
│   │                    ◄ ●●○ ►  (swipe for more)                        │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   WPA says:                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  💡 Natural Light    ████████░░  85                                 │   │
│   │  📐 Sense of Space   ███████░░░  72                                 │   │
│   │  ✨ Condition         █████████░  91                                 │   │
│   │  🎨 Style/Character   ██████░░░░  65                                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Leo: "What do you think? Does this feel bright enough for you?"           │
│                                                                             │
│   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│   │    😍 LOVE IT     │  │     😐 MEH        │  │    👎 NOT FOR ME  │       │
│   └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                             │
│   💬 Or tell Leo what you think...                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Calibration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   PROPERTY 1: WPA says Light = 85                                           │
│   ═══════════════════════════════                                           │
│                                                                             │
│   Leo: "WPA scored this 85 for natural light. What do you think?"           │
│                                                                             │
│   User: "Hmm, that looks pretty dark to me actually."                       │
│                                                                             │
│   → CALIBRATION: User perceives 85 as "dark"                                │
│   → Set light_threshold = 95 (user needs higher scores to feel "bright")    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PROPERTY 2: WPA says Space = 72                                           │
│   ═══════════════════════════════                                           │
│                                                                             │
│   Leo: "This one scored 72 for sense of space. How does it feel?"           │
│                                                                             │
│   User: "That actually looks quite spacious!"                               │
│                                                                             │
│   → CALIBRATION: User perceives 72 as "spacious"                            │
│   → Set space_threshold = 65 (user is satisfied with lower scores)          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PROPERTY 3: Overall vibes                                                 │
│   ═════════════════════════                                                 │
│                                                                             │
│   Leo: "Last one! Overall, does this feel like somewhere you'd want         │
│         to live?"                                                           │
│                                                                             │
│   User: "Love it! The style is exactly what I'm looking for."               │
│                                                                             │
│   → Boost style_weight in fit scoring                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### After Vibe-Check: Back to Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   [Vibe-check complete - returning to map]                                  │
│                                                                             │
│   ┌────────────────────────┐    ┌────────────────────────────────────────┐  │
│   │                        │    │                                        │  │
│   │   Leo: "Perfect! Now   │    │         ╭─────────╮                    │  │
│   │   I know you need      │    │        ╱░▒▓██████▓▒░╲                  │  │
│   │   really bright spaces │    │       │▒▓█████████▓▒│   ← Map returns  │  │
│   │   and you're easy on   │    │        ╲░▒▓██████▓▒░╱     with updated │  │
│   │   space. Let me update │    │         ╰─────────╯       thresholds   │  │
│   │   your search..."      │    │                                        │  │
│   │                        │    │   ✨ Heatmap recalculated with          │  │
│   │                        │    │      calibrated thresholds              │  │
│   └────────────────────────┘    └────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

**Component: `VibeCheckOverlay.tsx`**

```typescript
interface VibeCheckProps {
  properties: Array<{
    listing_id: string;
    photos: string[];
    wpa_scores: WPAScores;
  }>;
  onComplete: (calibration: UserCalibration) => void;
  onDismiss: () => void;
}

interface UserCalibration {
  dimension_thresholds: Record<string, number>;  // light: 95, space: 65, etc.
  dimension_weight_boosts: Record<string, number>; // style: 1.5, etc.
}

function VibeCheckOverlay({ properties, onComplete }: VibeCheckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [calibrations, setCalibrations] = useState<CalibrationEntry[]>([]);
  
  const handleResponse = (response: 'love' | 'meh' | 'dislike', feedback?: string) => {
    const property = properties[currentIndex];
    
    // Record calibration
    setCalibrations(prev => [...prev, {
      listing_id: property.listing_id,
      wpa_scores: property.wpa_scores,
      user_response: response,
      user_feedback: feedback
    }]);
    
    if (currentIndex < properties.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      // Calculate final calibration
      const calibration = calculateCalibration(calibrations);
      onComplete(calibration);
    }
  };
  
  return (
    <div className="absolute inset-0 bg-white z-50">
      <VibeCheckCard
        property={properties[currentIndex]}
        index={currentIndex + 1}
        total={properties.length}
        onResponse={handleResponse}
      />
    </div>
  );
}
```

**WebSocket Event:**

```typescript
// ElevenLabs tool triggers vibe-check
ws.send({ 
  type: 'SHOW_VIBE_CHECK', 
  payload: { 
    properties: [...],  // 3 WPA-analyzed properties
    mode: 'calibration'
  } 
});

// After user completes vibe-check
ws.send({ 
  type: 'VIBE_CHECK_COMPLETE', 
  payload: { 
    calibration: { 
      light_threshold: 95, 
      space_threshold: 65,
      style_weight: 1.5 
    } 
  } 
});

// Map returns with updated heatmap
ws.send({ type: 'UPDATE_HEATMAP', payload: { geojson: recalculated_heatmap } });
```

### The "Cursor for Location Finding" Analogy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   CURSOR (Code)                        LEO (Location)                       │
│   ═════════════                        ═════════════                        │
│                                                                             │
│   • You describe what you want         • You describe what you want         │
│   • AI shows you code                  • AI shows you the map               │
│   • You give feedback                  • You give feedback                  │
│   • AI iterates instantly              • AI iterates instantly              │
│   • Visual diff shows changes          • Visual map shows changes           │
│   • You refine until perfect           • You refine until perfect           │
│                                                                             │
│   "Make this function async"           "I need to be close to a gym"        │
│   → Code updates instantly             → Isochrone appears instantly        │
│                                                                             │
│   "Actually, add error handling"       "Actually, can we try CrossFit?"     │
│   → Code updates again                 → POI search + heatmap updates       │
│                                                                             │
│   "Hmm, this looks wrong"              "Hmm, this looks dark to me"         │
│   → AI asks for clarification          → AI calibrates thresholds           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The core UX principle:** Real-time visual feedback creates a collaborative, iterative experience where the user feels in control and the AI feels helpful, not prescriptive.

---

## Responsive Map UI: Desktop vs Mobile

### Desktop: Continuous Side-by-Side

Full step-by-step updates as discussed. The map is always visible and updates in real-time.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DESKTOP: 50/50 SPLIT - CONTINUOUS UPDATES                                   │
├──────────────────────────────┬──────────────────────────────────────────────┤
│                              │                                              │
│   CALL/CHAT UI               │   MAP (always visible, updating)             │
│                              │                                              │
│   Leo: "Tell me about..."    │       ╭─────────╮                            │
│                              │      ╱░▒▓████▓▒░╲  ← Updates live            │
│   You: "I work in..."        │     │▒▓████████▓▒│   as you speak            │
│                              │      ╲░▒▓████▓▒░╱                            │
│   Leo: "Got it! And..."      │       ╰─────────╯                            │
│                              │                                              │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

### Mobile: Checkpoint-Based Experience

On mobile, the map appears at **key moments** as a full-screen or bottom-sheet overlay, then dismisses to return focus to the conversation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MOBILE: CHECKPOINT-BASED - MAP APPEARS AT KEY MOMENTS                       │
└─────────────────────────────────────────────────────────────────────────────┘

NORMAL STATE (95% of call)        CHECKPOINT MOMENT (5% of call)
┌─────────────────────┐           ┌─────────────────────┐
│ ┌─────────────────┐ │           │                     │
│ │   Leo avatar    │ │           │   ╭─────────────╮   │
│ │   "Tell me..."  │ │           │  ╱░▒▓████████▓▒░╲  │
│ └─────────────────┘ │           │ │▒▓██████████████▓▒│ │
│                     │           │  ╲░▒▓████████▓▒░╱  │
│ ┌─────────────────┐ │    ──►    │   ╰─────────────╯   │
│ │   Your message  │ │           │                     │
│ │   "I work in.." │ │           │  "Your sweet spot!" │
│ └─────────────────┘ │           │                     │
│                     │           │  [Got it!]          │
│  🎤 Speaking...     │           │                     │
└─────────────────────┘           └─────────────────────┘
      Full-width call                 Map overlay moment
```

### Mobile Checkpoints

| # | Trigger | What Shows | Duration | Style |
|---|---------|------------|----------|-------|
| 1 | City mentioned | Quick zoom animation | 2-3 sec | Toast/mini-card |
| 2 | First anchor | "Found your work!" + pin | 2-3 sec | Toast |
| 3 | Second anchor | "Adding your partner's work..." | 2 sec | Toast |
| 4 | **Intersection formed** | Full map with sweet spot | Until dismissed | **Bottom sheet** |
| 5 | **Isolated anchor detected** | Map showing gap + options | Until resolved | **Full overlay** |
| 6 | **Vibe-check** | Property photos | Until complete | **Full overlay** |
| 7 | **Heatmap complete** | Full personalized map | Until dismissed | **Full overlay** |

### Mobile UI Components

**1. Toast (Quick Updates)**
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ 📍 Barcelona                        │ │  ← Slides down from top
│ │    Zooming to your city...         │ │     Auto-dismisses after 2s
│ └─────────────────────────────────────┘ │
│                                         │
│        (Call UI continues below)        │
│                                         │
└─────────────────────────────────────────┘
```

**2. Bottom Sheet (Sweet Spot Reveal)**
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │  Leo: "I've found your sweet       │ │  ← Call UI compressed
│ │        spot! Take a look..."       │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ╭───────────────────────────────────╮   │
│ │                                   │   │
│ │       ╭─────────╮                 │   │  ← Bottom sheet
│ │      ╱░▒▓████▓▒░╲                 │   │     (60% height)
│ │     │▒▓████████▓▒│                │   │     Draggable
│ │      ╲░▒▓████▓▒░╱                 │   │
│ │       ╰─────────╯                 │   │
│ │                                   │   │
│ │  🏠 Your Sweet Spot               │   │
│ │  Work + Partner's work overlap    │   │
│ │                                   │   │
│ ╰───────────────────────────────────╯   │
│                                         │
│  [Continue] or swipe down to dismiss    │
└─────────────────────────────────────────┘
```

**3. Full Overlay (Final Map / Vibe-Check)**
```
┌─────────────────────────────────────────┐
│                                         │
│   YOUR PERSONALIZED MAP                 │
│                                         │
│   ╭─────────────────────────────────╮   │
│  ╱░▒▓██████████████████████████▓▒░╲  │
│ │▒▓████████ 💪 ████ ☕ ███████████▓▒│ │
│ │▒▓██████████████████████████████▓▒│ │
│  ╲░▒▓██████████████████████████▓▒░╱  │
│   ╰─────────────────────────────────╯   │
│                                         │
│  ☕ 3 coffee spots scored for you       │
│  💪 2 gyms in your style                │
│  🌳 4 parks nearby                      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │         Looks great!            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Leo is still listening... 🎤           │
│                                         │
└─────────────────────────────────────────┘
```

### The Philosophy: Different Magic for Different Screens

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   DESKTOP MAGIC                        MOBILE MAGIC                         │
│   ═════════════                        ════════════                         │
│                                                                             │
│   "Watch it build in real-time"        "Surprise me at key moments"         │
│                                                                             │
│   • Continuous feedback                • Concentrated reveals               │
│   • Background presence                • Foreground moments                 │
│   • Peripheral awareness               • Full attention captures            │
│   • "I can see it changing"            • "Wow, look at this!"               │
│                                                                             │
│   Like watching code compile           Like getting a notification          │
│   in a split terminal                  that something's ready               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

**Responsive Hook:**

```typescript
function useMapDisplayMode() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return {
    mode: isMobile ? 'checkpoint' : 'continuous',
    
    // Desktop: Always show map panel
    // Mobile: Map starts hidden
    showMapPanel: !isMobile,
    
    // How to display map updates
    displayUpdate: isMobile 
      ? (update: MapUpdate) => {
          switch (update.type) {
            case 'ZOOM_TO_CITY':
            case 'ADD_ANCHOR':
              return { style: 'toast', duration: 2500 };
            case 'INTERSECTION_FORMED':
              return { style: 'bottom-sheet', dismissible: true };
            case 'ISOLATED_ANCHOR':
            case 'VIBE_CHECK':
            case 'HEATMAP_COMPLETE':
              return { style: 'full-overlay', dismissible: true };
          }
        }
      : () => ({ style: 'inline', duration: null }) // Always visible
  };
}
```

**WebSocket Handler (Mobile):**

```typescript
// Mobile: Queue updates and show at checkpoints
const mobileMapHandler = (event: MapEvent) => {
  switch (event.type) {
    case 'ZOOM_TO_CITY':
      showToast({
        icon: '📍',
        text: `${event.city} - Zooming to your city...`,
        duration: 2500
      });
      break;
      
    case 'INTERSECTION_FORMED':
      // This is a checkpoint - show bottom sheet
      showBottomSheet({
        content: <SweetSpotMap shape={event.shape} />,
        title: '🏠 Your Sweet Spot',
        subtitle: event.description,
        onDismiss: () => continueCall()
      });
      break;
      
    case 'HEATMAP_COMPLETE':
      // Major checkpoint - full overlay
      showFullOverlay({
        content: <PersonalizedMap heatmap={event.heatmap} pois={event.pois} />,
        title: 'Your Personalized Map',
        cta: 'Looks great!',
        onDismiss: () => continueCall()
      });
      break;
  }
};
```

**Leo's Dialogue Adapts:**

```
DESKTOP:
Leo: "Check out the map on your right - I'm adding your work location now."

MOBILE:
Leo: "Let me show you something quick..." 
[Map appears as overlay]
Leo: "...there's your sweet spot! Tap 'Got it' when you're ready to continue."
```

### Checkpoint Sequence (Mobile)

```
CALL START
    │
    ▼
[Toast] "📍 Barcelona"                     ← Quick acknowledgment
    │
    ▼
[Toast] "📍 Adding your work..."           ← Quick acknowledgment
    │
    ▼
[Toast] "📍 Adding partner's work..."      ← Quick acknowledgment
    │
    ▼
[Bottom Sheet] "🏠 Your Sweet Spot!"       ← CHECKPOINT: Pause & show
    │                                         User taps "Got it"
    ▼
[Continue conversation for POIs, etc.]
    │
    ▼
[Full Overlay] "🎯 Vibe Check"             ← CHECKPOINT: Full attention
    │                                         3 properties, calibration
    ▼
[Toast] "☕ Found 3 coffee spots..."       ← Quick acknowledgment
    │
    ▼
[Toast] "💪 Found 2 gyms..."               ← Quick acknowledgment
    │
    ▼
[Full Overlay] "🗺️ Your Personalized Map" ← CHECKPOINT: Grand finale
    │                                         Full heatmap reveal
    ▼
CALL END
```

### Why This Works

| Aspect | Desktop Continuous | Mobile Checkpoint |
|--------|-------------------|-------------------|
| Screen space | Plenty | Limited |
| User attention | Can split | Needs focus |
| Update frequency | High (every change) | Low (key moments) |
| Cognitive load | Ambient awareness | Focused reveals |
| "Magic" feeling | "It's building live!" | "Wow, look at this!" |
| Interruption cost | None (always visible) | Brief pause at checkpoints |

Both create a "Cursor for location" experience - just optimized for their context.

### Phase 4: UI Components

**Live Map (Mapbox):**
- [ ] `components/map/LiveMap.tsx` - Single Mapbox instance, never reloads
- [ ] `hooks/useLiveMapUpdates.ts` - Update layers without reload
- [ ] `components/map/MapLegend.tsx` - Score gradient legend
- [ ] Mapbox API key setup (`NEXT_PUBLIC_MAPBOX_TOKEN`)

**Call Page Split-Screen:**
- [ ] Update `/speak-with-leo` layout to 50/50 split
- [ ] Integrate `LiveMap` with WebSocket events
- [ ] Pusher/WebSocket channel for real-time map updates

**Heatmap Display:**
- [ ] `HeatmapLayer.tsx` - Gradient circles from score data
- [ ] `NeighborhoodLayer.tsx` - Solid fill polygons per hood
- [ ] `ShapeLayer.tsx` - Commute intersection outline
- [ ] `POIMarkers.tsx` - Coffee, gym, etc. icons

**Other Components:**
- [ ] `ThresholdSlider.tsx` - User-adjustable threshold
- [ ] `ScoreBreakdown.tsx` - Explain why a listing scored X
- [ ] Progressive reveal animations (Framer Motion)

### Phase 5: Adaptation System

- [ ] Day 3 cron: Check listing count, suggest softening
- [ ] Week 2 cron: Check listing count, suggest shape expansion
- [ ] Email templates for adaptation suggestions

---

## Why This Is Better

| Aspect | Old (Zones) | New (Heatmap) |
|--------|-------------|---------------|
| Complexity | HIGH (8 permutations) | LOW (2 levers) |
| User Understanding | "Why is this yellow?" | "Score 78 - here's why" |
| Surprises | Need special logic | Natural (high scores anywhere) |
| Real-Time Updates | Hard | Progressive build during call |
| Explanations | Hard to generate | Built-in (reasoning stored) |
| Adaptation | Complex negotiations | Simple threshold/softening |
| Data Integration | POIs feel separate | Everything contributes to one score |

---

## Example User Story

> **Maria** is looking for a flat in Barcelona. She works in Eixample, loves specialty coffee, needs a CrossFit gym, and hates touristy areas.
>
> During her call with Leo:
> - Minute 2: Shape appears (30-min commute to work)
> - Minute 4: Coffee layer adds - Gràcia lights up (good coffee scene)
> - Minute 6: Gym layer adds - Sant Martí brightens (CrossFit there)
> - Minute 8: Quiet layer adds - Gothic Quarter dims (too touristy)
>
> End of call: Maria sees a personalized heatmap. The brightest areas (85%+) are in upper Gràcia and parts of Sant Martí - not where she expected!
>
> Leo: "I found some areas you might not have considered. Upper Gràcia scores 87% - it has three specialty coffee shops within 8 minutes, a CrossFit gym 12 minutes away, and very low tourist activity. There are 4 listings there right now."
>
> Maria is delighted by the "surprise" recommendation.

---

## References

- `docs/NEIGHBORHOOD_PROFILES.md` - Neighborhood dimension system
- `docs/plans/P0_LEAN_APP.md` - Main implementation plan
- `src/lib/recommender/` - Existing recommender code
- `src/lib/lifestyle/geoapify-engine.ts` - Isochrone generation

---

**Last Updated:** December 2024
**Status:** Architecture defined, ready for implementation

