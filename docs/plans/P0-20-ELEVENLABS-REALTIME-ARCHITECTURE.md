# P0-20: ElevenLabs Real-Time Architecture — Conversation + Heatmap Flow

> **Parent:** [P0 Index](./P0_INDEX.md)
> 
> **Related:** [P0-05-ELEVENLABS-AGENTS](./P0-05-ELEVENLABS-AGENTS.md), [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md), [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md)
>
> **Created:** December 8, 2025
> **Updated:** December 8, 2025 — Added Leo Brain orchestrator architecture

---

## Overview

This document explains how ElevenLabs voice agents, backend calculations, real-time map updates, and user data persistence work together during an intake call.

**Key Insight:** ElevenLabs is the voice interface, but **"Leo Brain"** (a backend LLM orchestrator) handles all planning, reasoning, and execution decisions — similar to how an AI coding assistant plans, searches, and executes.

---

## Two Architecture Options

### Option A: ElevenLabs as Orchestrator (Simple but Limited)

ElevenLabs' LLM decides which tools to call based on conversation.

**Limitations:**
- No complex multi-step planning
- Can't reason about data source selection
- Can't accumulate state across tool calls
- Can't decide "do I need more info first?"

### Option B: Leo Brain as Orchestrator (Recommended) ✅

ElevenLabs is **voice I/O only**. A backend LLM ("Leo Brain") handles:
- Planning what to do
- Selecting data sources
- Deciding execution order
- Accumulating state
- Determining if more info is needed
- Generating response text

**This is like how Cursor works** — the LLM plans, reasons, calls tools, and accumulates context.

---

## ⭐ Leo Brain Architecture (Recommended)

### The Core Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LEO BRAIN = REASONING ENGINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ELEVENLABS                              LEO BRAIN (Backend)                │
│  ══════════                              ══════════════════                  │
│                                                                             │
│  Voice interface only                    Planning + Reasoning + Execution   │
│  Speaks to user                          Decides what to do                 │
│  Receives speech                         Selects data sources               │
│  Calls ONE tool: process_input           Accumulates state                  │
│                                          Tells ElevenLabs what to say       │
│                                                                             │
│  ❌ Does NOT decide:                     ✅ DOES decide:                    │
│     - Which data source                     - OSM vs ScrapingDog vs ATP     │
│     - Execution order                       - Geocode first, then score     │
│     - Weight inference                      - "essential" = 1.8 weight      │
│     - Need more info?                       - Should I ask about budget?    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Leo Brain is Needed

| User Says | What Needs to Happen | Why ElevenLabs Can't Do This |
|-----------|---------------------|------------------------------|
| "I want good coffee nearby" | Decide: ScrapingDog (quality) vs OSM (generic) | Requires reasoning about "good" |
| "I work at Diagonal and love creative areas" | Parse 2 intents, order execution | Requires planning |
| "Creative vibes are essential" | Infer weight = 1.8 from "essential" | Requires nuanced interpretation |
| "Near the beach would be nice" | Infer weight = 1.2 from "nice" (weak) | Requires language understanding |
| Complex state after 5 turns | Remember all prior context | Requires state accumulation |

### The Agent Loop

```typescript
// /api/agents/process-input/route.ts
// This is the ONLY tool ElevenLabs calls

export async function POST(req: Request) {
  const { userId, transcript, currentUtterance } = await req.json();
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Load Current State
  // ═══════════════════════════════════════════════════════════════════════
  const state = await loadUserState(userId);
  // state = { 
  //   anchors: [], 
  //   poiSearches: [], 
  //   dimensionWeights: {},
  //   heatmapLayers: [],
  //   pendingQuestions: [],
  //   conversationSummary: "User is looking for a rental in Barcelona..."
  // }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Leo Brain REASONS About What To Do
  // ═══════════════════════════════════════════════════════════════════════
  const plan = await leoBrainPlan({
    currentUtterance,        // "I work at Diagonal and want good coffee nearby"
    conversationHistory: transcript,
    currentState: state,
    availableActions: AVAILABLE_ACTIONS,
    dataSources: DATA_SOURCE_DESCRIPTIONS,
  });
  
  // plan = {
  //   reasoning: "User mentioned work location AND coffee preference. 
  //               Work location is concrete - geocode it.
  //               'Good coffee' implies quality preference - needs ScrapingDog.
  //               Should do both, then ask about relative importance.",
  //   steps: [
  //     { action: 'geocode_anchor', params: { address: 'Diagonal', type: 'work' } },
  //     { action: 'search_quality_pois', params: { query: 'specialty coffee' } },
  //   ],
  //   followUpQuestion: "Is being close to good coffee more important than 
  //                      a short commute, or about equal?",
  //   parallelizable: true,
  // }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Execute the Plan
  // ═══════════════════════════════════════════════════════════════════════
  const results = await executePlan(plan, state);
  // Calls internal functions: geocodeAddress(), searchQualityPois(), etc.
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Accumulate State
  // ═══════════════════════════════════════════════════════════════════════
  const newState = accumulateResults(state, results);
  await saveUserState(userId, newState);
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Push Map Updates via WebSocket
  // ═══════════════════════════════════════════════════════════════════════
  for (const update of results.mapUpdates) {
    await pushWebSocket(userId, update.event, update.payload);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Generate Response for ElevenLabs to Speak
  // ═══════════════════════════════════════════════════════════════════════
  const response = await generateResponse({
    plan,
    results,
    followUpQuestion: plan.followUpQuestion,
  });
  
  return Response.json({
    speakThis: response.text,      // ElevenLabs will say this
    mapUpdates: results.mapUpdates,
    stateSnapshot: newState,
  });
}
```

---

## Data Source Decision Tree

Leo Brain uses reasoning to select the right data source:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA SOURCE DECISION TREE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User says "near X"                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Is X a GENERIC category?                                            │    │
│  │ (park, metro, beach, school, supermarket, hospital, gym)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                              │                                      │
│      YES                             NO                                     │
│       │                              │                                      │
│       ▼                              ▼                                      │
│  ┌────────────────┐     ┌──────────────────────────────────────────┐        │
│  │  OSM Lookup    │     │ Is X QUALITY-specific?                   │        │
│  │  (FREE)        │     │ Contains: good, best, specialty, nice,   │        │
│  │                │     │ quality, top, great, amazing, etc.       │        │
│  │ leo-osm-pois   │     └──────────────────────────────────────────┘        │
│  │ (595k records) │          │                        │                     │
│  └────────────────┘         YES                       NO                    │
│                              │                        │                     │
│                              ▼                        ▼                     │
│                   ┌──────────────────┐     ┌──────────────────┐             │
│                   │  ScrapingDog     │     │  AllThePlaces    │             │
│                   │  (PAID ~$0.01)   │     │  (FREE)          │             │
│                   │                  │     │                  │             │
│                   │  Google Maps     │     │  leo-atp-pois    │             │
│                   │  search + score  │     │  Density count   │             │
│                   │  with Flash-Lite │     │  (92k records)   │             │
│                   └──────────────────┘     └──────────────────┘             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User mentions neighborhood/lifestyle preference                            │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SERP Profile Lookup (FREE, pre-computed)                           │    │
│  │  leo-neighborhood-boundaries with serpData                          │    │
│  │  → Returns 20 lifestyle dimensions for that barrio                  │    │
│  │  → Used to calculate neighborhood multiplier (0.7x - 1.3x)          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User mentions commute location (work, school, partner's work)              │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Geocode address (Geoapify - 3k/day free)                        │    │
│  │  2. Generate Turf.js circles (FREE)                                 │    │
│  │  3. This MUST happen before POI scoring (need radius for context)   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision Examples

| User Says | Leo Brain Reasoning | Data Source |
|-----------|---------------------|-------------|
| "Near a park" | Generic category | OSM (`leo-osm-pois`) |
| "Near the metro" | Generic category | OSM (`leo-osm-pois`) |
| "Lots of cafes around" | Vibe/density | AllThePlaces (`leo-atp-pois`) |
| "Good specialty coffee" | Quality-specific ("good", "specialty") | ScrapingDog + Flash-Lite |
| "Best gyms" | Quality-specific ("best") | ScrapingDog + Flash-Lite |
| "Creative neighborhood" | Lifestyle dimension | SERP profiles |
| "I work at Diagonal" | Commute anchor | Geoapify + Turf.js |

---

## Weight Inference from Language

Leo Brain infers importance weights from conversational nuance:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEIGHT INFERENCE FROM LANGUAGE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STRONG SIGNALS (Weight 1.7 - 2.0)                                          │
│  ─────────────────────────────────                                          │
│  "X is essential"                    → 1.9                                  │
│  "I really need X"                   → 1.8                                  │
│  "X is super important"              → 1.8                                  │
│  "Can't live without X"              → 2.0                                  │
│  "X is a dealbreaker"                → 2.0 (or hard requirement)            │
│  "X is everything"                   → 1.9                                  │
│                                                                             │
│  MEDIUM SIGNALS (Weight 1.3 - 1.6)                                          │
│  ─────────────────────────────────                                          │
│  "I want X"                          → 1.5                                  │
│  "I'd love X"                        → 1.5                                  │
│  "X matters to me"                   → 1.4                                  │
│  "I prefer X"                        → 1.3                                  │
│  "X would be great"                  → 1.4                                  │
│                                                                             │
│  WEAK SIGNALS (Weight 1.0 - 1.2)                                            │
│  ─────────────────────────────────                                          │
│  "X would be nice"                   → 1.2                                  │
│  "X is a plus"                       → 1.1                                  │
│  "I guess X"                         → 1.0                                  │
│  "X if possible"                     → 1.1                                  │
│  "Not a priority but X"              → 1.0                                  │
│                                                                             │
│  NEGATIVE SIGNALS (Weight 0.5 - 0.9)                                        │
│  ──────────────────────────────────                                         │
│  "X doesn't matter much"             → 0.8                                  │
│  "I don't care about X"              → 0.5                                  │
│  "X is not important"                → 0.6                                  │
│                                                                             │
│  DEALBREAKERS (Hard filter, not weight)                                     │
│  ──────────────────────────────────────                                     │
│  "No X"                              → filter out                           │
│  "I can't have X"                    → filter out                           │
│  "X is a dealbreaker"                → filter out                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Inside Leo Brain planning prompt

const weightInferenceGuidelines = `
When user expresses preference for something, infer a weight (0.5 - 2.0):

EXAMPLES:
- "Good coffee is essential" → creative_scene: 1.9
- "I'd love a creative area" → creative_scene: 1.5  
- "Parks would be nice" → green_spaces: 1.2
- "I don't care about nightlife" → nightlife: 0.5
- "No ground floor apartments" → dealbreaker, not weight

Always explain your weight inference in the reasoning field.
`;
```

---

## State Accumulation

Leo Brain maintains conversation state that evolves over time:

```typescript
// State structure in Supabase: user_lifestyle_profiles.agent_state

interface AgentState {
  // Accumulated data
  anchors: Anchor[];                    // Work, school, etc.
  poiSearches: POISearch[];             // Quality POI searches performed
  dimensionWeights: Record<string, number>;  // Lifestyle weights
  dealbreakers: string[];               // Hard filters
  
  // Heatmap layers built so far
  heatmapLayers: ('commute_zones' | 'neighborhoods' | 'pois' | 'final')[];
  
  // Conversation context
  conversationSummary: string;          // Rolling summary
  pendingQuestions: string[];           // Things to ask
  cityFamiliarity: 'none' | 'visited' | 'expert';
  
  // Metadata
  turnCount: number;
  lastUpdated: string;
}
```

### State Evolution Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STATE EVOLUTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TURN 1: "I work at Diagonal"                                               │
│  ───────────────────────────────                                            │
│  state = {                                                                  │
│    anchors: [{ type: 'work', address: 'Diagonal', coords: {...} }],         │
│    poiSearches: [],                                                         │
│    dimensionWeights: {},                                                    │
│    heatmapLayers: ['commute_zones'],                                        │
│    conversationSummary: "User works at Diagonal, Barcelona.",               │
│    pendingQuestions: ['budget', 'lifestyle', 'dealbreakers'],               │
│  }                                                                          │
│                                                                             │
│  TURN 2: "Good coffee is essential to me"                                   │
│  ─────────────────────────────────────────                                  │
│  state = {                                                                  │
│    anchors: [{ type: 'work', ... }],                                        │
│    poiSearches: [{                                                          │
│      type: 'quality',                                                       │
│      query: 'specialty coffee',                                             │
│      source: 'scrapingDog',                                                 │
│      results: [...],                                                        │
│      weight: 1.9,  // "essential" → high weight                             │
│    }],                                                                      │
│    dimensionWeights: {},                                                    │
│    heatmapLayers: ['commute_zones', 'pois'],                                │
│    conversationSummary: "User works at Diagonal. Specialty coffee is        │
│                          essential (weight 1.9).",                          │
│    pendingQuestions: ['budget', 'lifestyle'],                               │
│  }                                                                          │
│                                                                             │
│  TURN 3: "I love creative neighborhoods, that's super important"            │
│  ─────────────────────────────────────────────────────────────────          │
│  state = {                                                                  │
│    anchors: [...],                                                          │
│    poiSearches: [...],                                                      │
│    dimensionWeights: {                                                      │
│      creative_scene: 1.8,  // "super important" → high weight               │
│    },                                                                       │
│    heatmapLayers: ['commute_zones', 'pois', 'neighborhoods'],               │
│    conversationSummary: "User works at Diagonal. Specialty coffee is        │
│                          essential (1.9). Creative neighborhoods super      │
│                          important (1.8).",                                 │
│    pendingQuestions: ['budget'],                                            │
│  }                                                                          │
│                                                                             │
│  TURN 4: "My budget is around €1500/month"                                  │
│  ──────────────────────────────────────────                                 │
│  state = {                                                                  │
│    ...previous,                                                             │
│    budgetMax: 1500,                                                         │
│    pendingQuestions: [],  // All core info gathered!                        │
│  }                                                                          │
│                                                                             │
│  → Leo Brain notices pendingQuestions is empty                              │
│  → Triggers final heatmap calculation                                       │
│  → Moves to vibe-check phase                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Leo Brain Planning Prompt

The planning prompt gives Leo Brain the context to reason:

```typescript
const leoBrainPlan = async (context: PlanContext): Promise<Plan> => {
  const response = await gemini.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{
      role: 'user',
      parts: [{ text: `
You are Leo's Brain - the reasoning engine behind a property search assistant.
You decide WHAT to do, WHICH data sources to use, and WHETHER to ask for more info.

═══════════════════════════════════════════════════════════════════════════════
CURRENT USER STATE
═══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(context.currentState, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
USER JUST SAID
═══════════════════════════════════════════════════════════════════════════════
"${context.currentUtterance}"

═══════════════════════════════════════════════════════════════════════════════
CONVERSATION SO FAR
═══════════════════════════════════════════════════════════════════════════════
${context.conversationHistory}

═══════════════════════════════════════════════════════════════════════════════
AVAILABLE ACTIONS
═══════════════════════════════════════════════════════════════════════════════
- geocode_anchor: Convert address to coordinates, generate commute zones
- query_osm_pois: Look up generic POIs (parks, metro, beaches) - FREE
- query_atp_density: Count POIs in area for "vibe" - FREE  
- search_quality_pois: ScrapingDog + Flash-Lite scoring - PAID (~$0.01)
- lookup_neighborhood_serp: Get lifestyle dimensions for barrio - FREE
- update_dimension_weight: Set weight for a lifestyle dimension
- calculate_heatmap_layer: Generate a layer of the heatmap
- ask_clarification: Need more info before proceeding

═══════════════════════════════════════════════════════════════════════════════
DATA SOURCE SELECTION RULES
═══════════════════════════════════════════════════════════════════════════════
- "near X" where X is generic (park, metro) → query_osm_pois (FREE)
- "near X" where X has quality words (good, best, specialty) → search_quality_pois (PAID)
- "lots of X around" or "X vibe" → query_atp_density (FREE)
- neighborhood/lifestyle mention → lookup_neighborhood_serp (FREE)
- commute location → geocode_anchor first (required before scoring)

═══════════════════════════════════════════════════════════════════════════════
WEIGHT INFERENCE RULES
═══════════════════════════════════════════════════════════════════════════════
- "essential", "can't live without", "dealbreaker" → 1.8-2.0
- "really want", "super important", "love" → 1.6-1.8
- "want", "prefer", "matters" → 1.3-1.5
- "nice to have", "if possible", "plus" → 1.0-1.2
- "don't care", "not important" → 0.5-0.8

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════
1. PARSE: What is the user trying to tell us?
2. DECIDE: What data sources are needed?
3. CHECK: Do we have enough info, or should we ask first?
4. PLAN: What's the execution order? (dependencies matter)
5. RESPOND: What should Leo say back?

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════
{
  "reasoning": "Step-by-step thinking about what user wants and how to handle it",
  "intentsParsed": ["work_location", "coffee_preference"],
  "steps": [
    { 
      "action": "geocode_anchor", 
      "params": { "address": "Diagonal", "type": "work" },
      "why": "Need coords before we can do POI searches"
    },
    {
      "action": "search_quality_pois",
      "params": { "query": "specialty coffee", "weight": 1.9 },
      "why": "'Good' implies quality, 'essential' implies high weight"
    }
  ],
  "needsMoreInfo": false,
  "clarificationQuestion": null,
  "parallelizable": true,
  "responseText": "What Leo should say after executing the plan"
}
`}]
    }],
  });
  
  return JSON.parse(response.text);
};
```

---

## Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         LEO BRAIN EXECUTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  USER                    ELEVENLABS              LEO BRAIN (Backend)            │
│  ════                    ══════════              ══════════════════             │
│                                                                                 │
│  "I work at             Voice I/O only          Planning + Execution           │
│   Diagonal and                │                       │                        │
│   want good                   │                       │                        │
│   coffee nearby"              │                       │                        │
│      │                        │                       │                        │
│      └───────────────────────►│                       │                        │
│                               │  POST /process-input  │                        │
│                               │──────────────────────►│                        │
│                               │  { transcript,        │                        │
│                               │    utterance }        │                        │
│                               │                       │                        │
│                               │                  ┌────┴────┐                   │
│                               │                  │  PLAN   │                   │
│                               │                  │         │                   │
│                               │                  │ 1. Parse: 2 intents         │
│                               │                  │    - work location          │
│                               │                  │    - coffee (quality)       │
│                               │                  │                             │
│                               │                  │ 2. Data sources:            │
│                               │                  │    - Geoapify (geocode)     │
│                               │                  │    - ScrapingDog (coffee)   │
│                               │                  │                             │
│                               │                  │ 3. Order:                   │
│                               │                  │    - Geocode FIRST          │
│                               │                  │    - Then POI search        │
│                               │                  │                             │
│                               │                  │ 4. Weight: 1.5              │
│                               │                  │    ("want" = medium)        │
│                               │                  └────┬────┘                   │
│                               │                       │                        │
│                               │                  ┌────┴────┐                   │
│                               │                  │ EXECUTE │                   │
│                               │                  │         │                   │
│                               │                  │ → Geoapify: geocode         │
│                               │                  │ → Turf.js: zones            │
│                               │                  │ → ScrapingDog: search       │
│                               │                  │ → Flash-Lite: score         │
│                               │                  │ → Supabase: save            │
│                               │                  │ → WebSocket: push           │
│                               │                  └────┬────┘                   │
│                               │                       │                        │
│                               │  { speakThis: "...",  │                        │
│                               │◄───mapUpdates: [...] }┘                        │
│                               │                                                │
│  ◄───"Got it! I've           │                                                │
│      mapped your              │                                                │
│      commute from             │                                                │
│      Diagonal and found       │                                                │
│      some great coffee        │                                                │
│      spots nearby..."         │                                                │
│                               │                                                │
│  [Map shows: commute zones + coffee POIs]                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Leo Brain: Cost & Latency

### Cost Per Turn

| Component | Model | Cost | Notes |
|-----------|-------|------|-------|
| **Planning** | Gemini 2.5 Pro | ~$0.002 | ~1k input + ~500 output tokens |
| **Weight inference** | Included in planning | $0 | Part of planning prompt |
| **POI scoring** | Flash-Lite | ~$0.001/POI | Only for quality searches |
| **Response generation** | Included in planning | $0 | Part of planning output |

**Estimated cost per intake call (10-15 turns):** ~$0.03-0.05

### Latency Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LATENCY PER TURN                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ElevenLabs STT:           ~300ms                                           │
│  Network to backend:       ~50ms                                            │
│  Leo Brain planning:       ~800-1500ms  ← Main latency addition             │
│  Execution (parallel):     ~200-500ms   (geocode, DB queries)               │
│  WebSocket push:           ~50ms                                            │
│  Network to ElevenLabs:    ~50ms                                            │
│  ElevenLabs TTS:           ~300ms                                           │
│  ─────────────────────────────────────                                      │
│  TOTAL:                    ~1.8-2.8 seconds                                 │
│                                                                             │
│  Without Leo Brain:        ~1.0-1.5 seconds                                 │
│  Leo Brain overhead:       ~0.8-1.3 seconds                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Mitigation:** Leo Brain can return `speakThis` immediately with a "processing" message while expensive operations run in background, then push updates via WebSocket.

---

## Leo Brain: Error Handling

### Planning Failures

```typescript
// If Gemini Pro fails to return valid JSON
const plan = await leoBrainPlan(context).catch(async (error) => {
  console.error('Leo Brain planning failed:', error);
  
  // Fallback: Simple intent extraction without full planning
  return {
    reasoning: 'Planning failed, using fallback',
    steps: [],
    needsMoreInfo: true,
    clarificationQuestion: "I didn't quite catch that. Could you tell me more about what you're looking for?",
    responseText: "I want to make sure I understand you correctly...",
  };
});
```

### Execution Failures (Mid-Plan)

```typescript
async function executePlan(plan: Plan, state: AgentState): Promise<ExecutionResult> {
  const results: StepResult[] = [];
  const mapUpdates: MapUpdate[] = [];
  
  for (const step of plan.steps) {
    try {
      const result = await executeStep(step, state);
      results.push({ step, success: true, result });
      mapUpdates.push(...result.mapUpdates);
      
    } catch (error) {
      console.error(`Step ${step.action} failed:`, error);
      
      // Record failure but continue with remaining steps
      results.push({ step, success: false, error: error.message });
      
      // Some failures are recoverable
      if (step.action === 'search_quality_pois') {
        // Fall back to AllThePlaces density instead
        const fallback = await executeStep({
          action: 'query_atp_density',
          params: { category: step.params.query },
        }, state);
        results.push({ step: { ...step, action: 'query_atp_density' }, success: true, result: fallback });
      }
    }
  }
  
  return { results, mapUpdates, partialSuccess: results.some(r => r.success) };
}
```

### Timeout Handling

```typescript
// Leo Brain must respond within 5 seconds (ElevenLabs limit)

const PLANNING_TIMEOUT = 3000;  // Leave 2s for execution
const EXECUTION_TIMEOUT = 1500;

async function processInput(context: ProcessInputContext) {
  const planPromise = leoBrainPlan(context);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Planning timeout')), PLANNING_TIMEOUT)
  );
  
  try {
    const plan = await Promise.race([planPromise, timeoutPromise]);
    const results = await executeWithTimeout(plan, EXECUTION_TIMEOUT);
    return generateResponse(plan, results);
    
  } catch (error) {
    if (error.message === 'Planning timeout') {
      // Return acknowledgment, process in background
      return {
        speakThis: "Got it, let me think about that for a moment...",
        processingInBackground: true,
      };
    }
    throw error;
  }
}
```

---

## Leo Brain: ElevenLabs Tool Configuration

### The Only Tool: `process_input`

```json
{
  "type": "webhook",
  "name": "process_input",
  "description": "Process user input through Leo Brain. Call this for EVERY user message. Leo Brain will decide what to do, which data sources to query, and what to say back. Do NOT try to parse intents yourself - just send the transcript.",
  "response_timeout_secs": 5,
  "api_schema": {
    "url": "https://leo.casa/api/agents/process-input",
    "method": "POST",
    "content_type": "application/json",
    "request_body_schema": {
      "type": "object",
      "required": ["userId", "currentUtterance"],
      "properties": {
        "userId": {
          "type": "string",
          "is_system_provided": true,
          "dynamic_variable": "user_id"
        },
        "currentUtterance": {
          "type": "string",
          "description": "What the user just said (transcribed)"
        },
        "transcript": {
          "type": "string",
          "description": "Full conversation transcript so far"
        }
      }
    }
  }
}
```

### ElevenLabs Agent System Prompt (Simplified)

```
You are Leo, a friendly property finding assistant.

YOUR ONLY JOB: Be a voice interface. You do NOT make decisions.

For EVERY user message:
1. Call the process_input tool with what they said
2. Speak EXACTLY what the tool returns in speakThis
3. Do NOT add your own commentary or questions

The process_input tool handles ALL reasoning:
- Understanding what the user wants
- Deciding what data to look up
- Updating the map
- Generating responses

You are the mouth and ears. Leo Brain is the brain.
```

---

## Leo Brain: Conversation Summary

### Rolling Summary Updates

Leo Brain maintains a rolling summary to avoid context explosion:

```typescript
interface ConversationSummary {
  coreInfo: {
    city: string | null;
    budget: number | null;
    bedrooms: number | null;
    moveInDate: string | null;
  };
  anchors: string[];              // "Works at Diagonal (30 min transit)"
  preferences: string[];          // "Specialty coffee (essential)", "Creative areas (important)"
  dealbreakers: string[];         // "No ground floor", "No shared apartments"
  openQuestions: string[];        // "Budget not yet discussed"
  turnCount: number;
}

// Updated after each turn by Leo Brain
async function updateSummary(
  currentSummary: ConversationSummary,
  newUtterance: string,
  planResults: ExecutionResult
): Promise<ConversationSummary> {
  // Leo Brain includes summary update in planning response
  return {
    ...currentSummary,
    ...planResults.summaryUpdates,
    turnCount: currentSummary.turnCount + 1,
  };
}
```

### Summary in Planning Prompt

```typescript
const planningPrompt = `
CONVERSATION SUMMARY (condensed):
- City: ${summary.city || 'not specified'}
- Budget: ${summary.budget ? `€${summary.budget}/month` : 'not specified'}
- Anchors: ${summary.anchors.join(', ') || 'none'}
- Preferences: ${summary.preferences.join(', ') || 'none'}
- Dealbreakers: ${summary.dealbreakers.join(', ') || 'none'}
- Still need: ${summary.openQuestions.join(', ') || 'nothing'}
- Turn: ${summary.turnCount}

USER JUST SAID: "${currentUtterance}"

Based on this context, plan what to do next...
`;
```

---

## Full Architecture with Leo Brain

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE LEO BRAIN ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────┐                                                           │
│  │      USER        │                                                           │
│  │    (Browser)     │                                                           │
│  │                  │                                                           │
│  │  ┌────────────┐  │        ┌─────────────────────────────────────────────┐   │
│  │  │ Microphone │◄─┼────────┤           ELEVENLABS CLOUD                  │   │
│  │  │  Speaker   │──┼────────►  (Voice I/O only - no reasoning)            │   │
│  │  └────────────┘  │  audio │                                             │   │
│  │                  │        │  • STT (speech-to-text)                     │   │
│  │  ┌────────────┐  │        │  • Calls ONE tool: process_input            │   │
│  │  │   Mapbox   │  │        │  • TTS (text-to-speech)                     │   │
│  │  │    Map     │  │        │                                             │   │
│  │  └────────────┘  │        └───────────────────┬─────────────────────────┘   │
│  │        ▲         │                            │                             │
│  │        │         │                            │ POST /api/agents/           │
│  │   WebSocket      │                            │      process-input          │
│  │        │         │                            ▼                             │
│  └────────┼─────────┘        ┌─────────────────────────────────────────────┐   │
│           │                  │              LEO BRAIN                       │   │
│           │                  │         (Your Backend - Next.js)             │   │
│           │                  │                                             │   │
│           │                  │  ┌───────────────────────────────────────┐  │   │
│           │                  │  │         PLANNING (Gemini Pro)         │  │   │
│           │                  │  │                                       │  │   │
│           │                  │  │  • Parse user intent                  │  │   │
│           │                  │  │  • Select data sources                │  │   │
│           │                  │  │  • Determine execution order          │  │   │
│           │                  │  │  • Infer weights from language        │  │   │
│           │                  │  │  • Decide if more info needed         │  │   │
│           │                  │  └───────────────────────────────────────┘  │   │
│           │                  │                    │                        │   │
│           │                  │                    ▼                        │   │
│           │                  │  ┌───────────────────────────────────────┐  │   │
│           │                  │  │            EXECUTION                  │  │   │
│           │                  │  │                                       │  │   │
│           │                  │  │  ┌─────────────────────────────────┐  │  │   │
│           │                  │  │  │ Geoapify    │ Geocode anchors   │  │  │   │
│           │                  │  │  ├─────────────┼───────────────────┤  │  │   │
│           │                  │  │  │ Turf.js     │ Commute circles   │  │  │   │
│           │                  │  │  ├─────────────┼───────────────────┤  │  │   │
│           │                  │  │  │ DynamoDB    │ OSM/ATP lookups   │  │  │   │
│           │                  │  │  ├─────────────┼───────────────────┤  │  │   │
│           │                  │  │  │ ScrapingDog │ Quality POIs      │  │  │   │
│           │                  │  │  ├─────────────┼───────────────────┤  │  │   │
│           │                  │  │  │ Flash-Lite  │ Score POIs        │  │  │   │
│           │                  │  │  └─────────────┴───────────────────┘  │  │   │
│           │                  │  └───────────────────────────────────────┘  │   │
│           │                  │                    │                        │   │
│           │                  │                    ▼                        │   │
│           │                  │  ┌───────────────────────────────────────┐  │   │
│           │                  │  │         STATE ACCUMULATION            │  │   │
│           │                  │  │                                       │  │   │
│           │                  │  │  • Update user_lifestyle_profiles     │  │   │
│           │                  │  │  • Add to heatmapLayers               │  │   │
│           │                  │  │  • Track pendingQuestions             │  │   │
│           │                  │  │  • Update conversationSummary         │  │   │
│           │                  │  └───────────────────────────────────────┘  │   │
│           │                  │                    │                        │   │
│           │                  │                    ▼                        │   │
│           │                  │  ┌───────────────────────────────────────┐  │   │
│           │                  │  │         RESPONSE GENERATION           │  │   │
│           │                  │  │                                       │  │   │
│           │                  │  │  • Generate speakThis text            │  │   │
│           │                  │  │  • Push WebSocket map updates         │  │   │
│           │                  │  │  • Return to ElevenLabs               │  │   │
│           │                  │  └───────────────────────────────────────┘  │   │
│           │                  │                                             │   │
│           │                  └──────────────────┬──────────────────────────┘   │
│           │                                     │                              │
│           │◄────────────────────────────────────┘                              │
│           │         WebSocket: map updates                                     │
│           │                                                                    │
│  ┌────────┴──────────────────────────────────────────────────────────────────┐ │
│  │                              DATA LAYER                                    │ │
│  │                                                                            │ │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────────┐   │ │
│  │  │         SUPABASE            │    │          DYNAMODB               │   │ │
│  │  │                             │    │                                 │   │ │
│  │  │  user_lifestyle_profiles    │    │  leo-osm-pois (595k)            │   │ │
│  │  │  • anchors                  │    │  leo-atp-pois (92k)             │   │ │
│  │  │  • dimensionWeights         │    │  leo-neighborhood-boundaries    │   │ │
│  │  │  • poiSearches              │    │  leo-census-sections            │   │ │
│  │  │  • agent_state              │    │                                 │   │ │
│  │  │                             │    │                                 │   │ │
│  │  │  Realtime: map-updates      │    │                                 │   │ │
│  │  └─────────────────────────────┘    └─────────────────────────────────┘   │ │
│  │                                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## The Simple Architecture (Without Leo Brain)

For reference, here's the simpler architecture where ElevenLabs does the reasoning:

### Answer: ElevenLabs' LLM

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     RESPONSIBILITY SPLIT                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ELEVENLABS (Cloud)                    YOUR BACKEND (Next.js)                │
│  ─────────────────                     ──────────────────────                │
│                                                                              │
│  ✅ Speech-to-text                     ✅ Geocoding (Geoapify)               │
│  ✅ LLM reasoning                      ✅ Turf.js calculations               │
│  ✅ Tool selection                     ✅ DynamoDB/Supabase queries          │
│  ✅ Parameter extraction               ✅ Scoring algorithms                 │
│  ✅ Conversation continuity            ✅ WebSocket event publishing         │
│  ✅ Text-to-speech                     ✅ Data persistence                   │
│                                                                              │
│  ❌ Calculations                       ❌ Conversation reasoning             │
│  ❌ Data storage                       ❌ Tool selection logic               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Do You Need a Parallel LLM?

| Scenario | Parallel LLM Needed? | Why |
|----------|---------------------|-----|
| Conversation reasoning | **NO** | ElevenLabs' LLM decides when to call tools |
| Parameter extraction | **NO** | ElevenLabs' LLM extracts from natural language |
| POI quality scoring | **YES** (backend) | Flash-Lite scores cafés against user preferences |
| WPA analysis | **YES** (backend) | Flash-Lite analyzes property photos |
| Explanation generation | **YES** (backend) | Flash-Lite generates personalized "why" |

**Key:** Backend LLM calls are tool-internal, not conversation-parallel. They happen inside your API routes, not alongside ElevenLabs.

---

## Conversation Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CONVERSATION FLOW                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [User speaks into microphone]                                               │
│       │                                                                      │
│       ▼                                                                      │
│  [ElevenLabs SDK] ─────────────────────────────────────────────────────────┐ │
│       │ captures audio, sends to ElevenLabs Cloud                          │ │
│       ▼                                                                    │ │
│  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│  │                     ELEVENLABS CLOUD                                 │   │ │
│  │                                                                      │   │ │
│  │  1. STT (speech-to-text)                                            │   │ │
│  │       │                                                              │   │ │
│  │       ▼                                                              │   │ │
│  │  2. LLM Reasoning                                                    │   │ │
│  │     ├── System prompt (Leo personality)                              │   │ │
│  │     ├── Tool definitions (add_anchor, update_profile, etc.)          │   │ │
│  │     ├── Conversation history (full context)                          │   │ │
│  │     └── Decision: What to say + which tools to call                  │   │ │
│  │       │                                                              │   │ │
│  │       ├──────────────────────────────────────────────────────────┐   │   │ │
│  │       │ Tool Call (if any)                                       │   │   │ │
│  │       │   POST /api/agents/add-anchor                            │   │   │ │
│  │       │   { address: "Diagonal", anchorType: "work" }            │   │   │ │
│  │       │                     │                                    │   │   │ │
│  │       │                     ▼                                    │   │   │ │
│  │       │  ┌──────────────────────────────────────────────────┐    │   │   │ │
│  │       │  │            YOUR BACKEND                          │    │   │   │ │
│  │       │  │                                                  │    │   │   │ │
│  │       │  │  1. Geocode address (Geoapify)                   │    │   │   │ │
│  │       │  │  2. Generate Turf.js circles                     │    │   │   │ │
│  │       │  │  3. Save to Supabase (permanent)                 │    │   │   │ │
│  │       │  │  4. Push WebSocket event                         │    │   │   │ │
│  │       │  │  5. Return result to ElevenLabs                  │    │   │   │ │
│  │       │  │                                                  │    │   │   │ │
│  │       │  └──────────────────────────────────────────────────┘    │   │   │ │
│  │       │                     │                                    │   │   │ │
│  │       │                     ▼                                    │   │   │ │
│  │       │  Tool Result: { success: true, zones: [...] }            │   │   │ │
│  │       └──────────────────────────────────────────────────────────┘   │   │ │
│  │       │                                                              │   │ │
│  │       ▼                                                              │   │ │
│  │  3. LLM continues with tool result                                   │   │ │
│  │     "Got it! I've mapped out your commute zones from Diagonal..."    │   │ │
│  │       │                                                              │   │ │
│  │       ▼                                                              │   │ │
│  │  4. TTS (text-to-speech)                                            │   │ │
│  │                                                                      │   │ │
│  └──────────────────────────────────────────────────────────────────────┘   │ │
│       │                                                                      │ │
│       ▼                                                                      │ │
│  [Audio response plays]◄────────────────────────────────────────────────────┘ │
│                                                                              │
│  MEANWHILE (parallel):                                                       │
│  ─────────────────────                                                       │
│  [Frontend WebSocket listener] receives ADD_COMMUTE_ZONE event               │
│       │                                                                      │
│       ▼                                                                      │
│  [Mapbox] adds new layer (no page refresh)                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management: Three Locations

| Location | What's Stored | Persistence | Use Case |
|----------|---------------|-------------|----------|
| **ElevenLabs** | Conversation transcript, context | Session only | LLM reasoning |
| **Supabase** | Anchors, preferences, dimension weights | Permanent | User profile |
| **Frontend React** | Map layers, GeoJSON data | Session only | Visual state |

### Why Three Locations?

```
ELEVENLABS CONVERSATION STATE
─────────────────────────────
"User mentioned they work at Diagonal"
"User prefers creative neighborhoods"
"User hasn't mentioned budget yet"
→ Used by LLM to decide next question

SUPABASE USER PROFILE
─────────────────────
{
  anchors: [{ type: 'work', lat: 41.39, lng: 2.14, ... }],
  dimension_weights: { creative_scene: 1.8, nightlife: 1.5 },
  quality_pois: [{ type: 'coffee', query: 'specialty', ... }],
  budget_max: 1500,
  ...
}
→ Permanent storage, survives page refresh

FRONTEND MAP STATE
──────────────────
- Commute zone layer (GeoJSON)
- Neighborhood fill colors
- POI markers
- Heatmap gradient
→ Visual representation, rebuilt from Supabase on refresh
```

---

## How the Heatmap Builds Cumulatively

### Turn-by-Turn Example

```
╔════════════════════════════════════════════════════════════════════════════════╗
║  TURN 1: User says "I work at Diagonal"                                        ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ElevenLabs LLM → calls add_anchor                                             ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Your backend:                                                                 ║
║    1. Geocode "Diagonal" → {lat: 41.3924, lng: 2.1427}                        ║
║    2. Generate Turf.js circles (30/45/60 min)                                 ║
║    3. INSERT into Supabase:                                                   ║
║       UPDATE user_lifestyle_profiles                                          ║
║       SET anchors = anchors || $newAnchor                                     ║
║       WHERE user_id = $userId                                                 ║
║    4. Push WebSocket: { event: 'ADD_COMMUTE_ZONE', geojson: {...} }           ║
║    5. Return to ElevenLabs: { success: true, zones: [...] }                   ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Frontend: useLiveMapUpdates receives event → adds layer to Mapbox            ║
║  ElevenLabs: "Got it! I've mapped out your commute zones..."                  ║
║                                                                                ║
║  MAP STATE: [Commute circles visible]                                          ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║  TURN 2: User says "I need good specialty coffee nearby"                       ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ElevenLabs LLM → calls score_quality_poi                                      ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Your backend:                                                                 ║
║    1. ScrapingDog: search "specialty coffee Barcelona"                        ║
║    2. Flash-Lite LLM: score each café against user preferences  ← LLM CALL    ║
║    3. INSERT into Supabase:                                                   ║
║       UPDATE user_lifestyle_profiles                                          ║
║       SET quality_pois = quality_pois || $scoredPOIs                          ║
║    4. Push WebSocket: { event: 'ADD_POIS', geojson: {...} }                   ║
║    5. Return to ElevenLabs: { success: true, topCafes: [...] }                ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Frontend: adds POI markers to existing map (no refresh)                       ║
║  ElevenLabs: "Found some great spots! There's a cluster in Gràcia..."         ║
║                                                                                ║
║  MAP STATE: [Commute circles + Coffee POI markers]                             ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║  TURN 3: User says "I love creative neighborhoods"                             ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ElevenLabs LLM → calls update_profile                                         ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Your backend:                                                                 ║
║    1. UPDATE Supabase:                                                        ║
║       SET dimension_weights = dimension_weights || '{"creative_scene": 1.8}'  ║
║    2. Query leo-neighborhood-boundaries for neighborhoods with SERP data      ║
║    3. Calculate multipliers (0.7x - 1.3x) using SERP profiles                 ║
║    4. Push WebSocket: { event: 'SET_NEIGHBORHOODS', geojson: {...} }          ║
║    5. Return to ElevenLabs: { success: true }                                 ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Frontend: updates neighborhood fill colors (no refresh)                       ║
║  ElevenLabs: "Creative vibes! Gràcia and El Born are great for that..."       ║
║                                                                                ║
║  MAP STATE: [Commute circles + Coffee POIs + Colored neighborhoods]            ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║  TURN 4: User confirms they're done                                            ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ElevenLabs LLM → calls finalize_heatmap (end of call)                         ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Your backend:                                                                 ║
║    1. Run full scoring: (POI × NEIGHBORHOOD_MULTIPLIER) + COMMUTE_PENALTY     ║
║    2. Generate final heatmap GeoJSON                                          ║
║    3. Save to Supabase: user_lifestyle_profiles.final_heatmap = {...}         ║
║    4. Push WebSocket: { event: 'UPDATE_HEATMAP', geojson: {...} }             ║
║    5. Return to ElevenLabs: { success: true, summary: "..." }                 ║
║      │                                                                         ║
║      ▼                                                                         ║
║  Frontend: shows full heatmap gradient                                         ║
║  ElevenLabs: "I'll search for you and send results within 24 hours..."        ║
║                                                                                ║
║  MAP STATE: [Full heatmap with red/yellow/blue gradient]                       ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## Mapbox Updates Without Refresh

### Single Instance Architecture

```typescript
// LiveMap.tsx - The map NEVER reloads during a call

const LiveMap = () => {
  const mapRef = useRef<MapRef>(null);
  
  // Initialize map ONCE
  useEffect(() => {
    // Map is created here and persists for entire session
  }, []);
  
  // Listen for updates via WebSocket
  useLiveMapUpdates(mapRef);
  
  return <Map ref={mapRef} ... />;
};
```

### Layer Update Methods

```typescript
// useLiveMapUpdates.ts

export function useLiveMapUpdates(mapRef: RefObject<MapRef>) {
  const channel = useSupabaseChannel(`map-updates:${userId}`);
  
  useEffect(() => {
    // ADD NEW LAYER (doesn't touch existing layers)
    channel.on('ADD_COMMUTE_ZONE', ({ anchorId, geojson }) => {
      mapRef.current?.addSource(`zone-${anchorId}`, { 
        type: 'geojson', 
        data: geojson 
      });
      mapRef.current?.addLayer({
        id: `zone-${anchorId}`,
        type: 'fill',
        source: `zone-${anchorId}`,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['get', 'opacity'],
        }
      });
    });
    
    // UPDATE EXISTING LAYER DATA (same layer, new data)
    channel.on('SET_NEIGHBORHOODS', ({ geojson }) => {
      const source = mapRef.current?.getSource('neighborhoods');
      if (source) {
        (source as GeoJSONSource).setData(geojson);
      }
    });
    
    // UPDATE HEATMAP GRADIENT
    channel.on('UPDATE_HEATMAP', ({ geojson }) => {
      const source = mapRef.current?.getSource('heatmap');
      if (source) {
        (source as GeoJSONSource).setData(geojson);
      }
    });
    
    // ADD POI MARKERS
    channel.on('ADD_POIS', ({ pois }) => {
      // Add markers to existing marker layer
      const existingMarkers = mapRef.current?.getSource('pois');
      const combined = mergeFeatureCollections(existingMarkers, pois);
      (existingMarkers as GeoJSONSource).setData(combined);
    });
    
    return () => channel.unsubscribe();
  }, [channel, mapRef]);
}
```

### Why This Works

| Method | Effect | Page Refresh? |
|--------|--------|---------------|
| `addSource()` + `addLayer()` | Adds new layer | NO |
| `source.setData()` | Updates layer data | NO |
| React state change | Re-renders component | NO (map persists) |
| User navigates away | Map destroyed | YES (rebuild from Supabase) |

---

## Data Persistence Flow

### Every Tool Call Saves to Supabase

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOL CALL: /api/agents/add-anchor                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: Validate input                                                     │
│    └── address, anchorType, transportMode, maxMinutes                       │
│                                                                             │
│  Step 2: Geocode address                                                    │
│    └── Geoapify → { lat, lng }                                              │
│                                                                             │
│  Step 3: Generate Turf.js zones                                             │
│    └── turf.circle() for 30, 45, 60 min                                     │
│                                                                             │
│  Step 4: SAVE TO SUPABASE ◄────────────────────────────── CRITICAL          │
│    │                                                                        │
│    │  const { error } = await supabase                                      │
│    │    .from('user_lifestyle_profiles')                                    │
│    │    .update({                                                           │
│    │      anchors: [...existingAnchors, newAnchor],                         │
│    │      updated_at: new Date().toISOString(),                             │
│    │    })                                                                  │
│    │    .eq('user_id', userId);                                             │
│    │                                                                        │
│    └── If error, return error to ElevenLabs (it will retry or handle)       │
│                                                                             │
│  Step 5: Push WebSocket event                                               │
│    │                                                                        │
│    │  await supabase.channel(`map-updates:${userId}`)                       │
│    │    .send({                                                             │
│    │      type: 'broadcast',                                                │
│    │      event: 'ADD_COMMUTE_ZONE',                                        │
│    │      payload: { anchorId, geojson },                                   │
│    │    });                                                                 │
│    │                                                                        │
│    └── Frontend receives this and updates Mapbox                            │
│                                                                             │
│  Step 6: Return to ElevenLabs                                               │
│    │                                                                        │
│    │  return Response.json({                                                │
│    │    success: true,                                                      │
│    │    anchorId: newAnchor.id,                                             │
│    │    zones: zonesGeoJSON,                                                │
│    │    message: `Mapped ${maxMinutes} min commute from ${address}`,        │
│    │  });                                                                   │
│    │                                                                        │
│    └── ElevenLabs LLM uses this to continue conversation                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### State Recovery on Page Refresh

```typescript
// When user refreshes or returns to page

const useBuildMapFromProfile = (mapRef: RefObject<MapRef>) => {
  const { data: profile } = useUserProfile();
  
  useEffect(() => {
    if (!profile || !mapRef.current) return;
    
    // Rebuild commute zones from saved anchors
    for (const anchor of profile.anchors) {
      const zones = generateTurfCircles(anchor);
      mapRef.current.addSource(`zone-${anchor.id}`, { type: 'geojson', data: zones });
      mapRef.current.addLayer({ id: `zone-${anchor.id}`, ... });
    }
    
    // Rebuild neighborhood colors from saved weights
    if (profile.dimension_weights) {
      const neighborhoodColors = calculateNeighborhoodColors(profile.dimension_weights);
      mapRef.current.getSource('neighborhoods')?.setData(neighborhoodColors);
    }
    
    // Rebuild POI markers from saved quality_pois
    if (profile.quality_pois?.length > 0) {
      const poiMarkers = profile.quality_pois.map(toGeoJSONFeature);
      mapRef.current.getSource('pois')?.setData(featureCollection(poiMarkers));
    }
    
    // Rebuild heatmap from saved final_heatmap
    if (profile.final_heatmap) {
      mapRef.current.getSource('heatmap')?.setData(profile.final_heatmap);
    }
    
  }, [profile, mapRef]);
};
```

---

## Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FULL ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────┐       ┌──────────────────────────────────────────────┐    │
│  │      USER        │       │              ELEVENLABS CLOUD                │    │
│  │    (Browser)     │       │                                              │    │
│  │                  │       │  ┌────────────────────────────────────────┐  │    │
│  │  ┌────────────┐  │ audio │  │  System Prompt (Leo personality)       │  │    │
│  │  │ Microphone │◄─┼───────┼──┤  Tool Definitions (webhooks)           │  │    │
│  │  │  Speaker   │──┼───────┼─►│  Conversation History                  │  │    │
│  │  └────────────┘  │       │  │  LLM (reasoning + tool selection)      │  │    │
│  │                  │       │  └────────────────────────────────────────┘  │    │
│  │  ┌────────────┐  │       │                    │                         │    │
│  │  │   Mapbox   │  │       │                    │ POST /api/agents/*      │    │
│  │  │    Map     │  │       │                    │ (tool calls)            │    │
│  │  │            │◄─┼───────┼────────────────────┼─────────────────────┐   │    │
│  │  │ [Layers]   │  │       │                    │                     │   │    │
│  │  │ - Zones    │  │       └────────────────────┼─────────────────────┼───┘    │
│  │  │ - Hoods    │  │                            │                     │        │
│  │  │ - POIs     │  │                            ▼                     │        │
│  │  │ - Heatmap  │  │             ┌──────────────────────────────────┐ │        │
│  │  └────────────┘  │             │       YOUR BACKEND               │ │        │
│  │        ▲         │             │       (Next.js API Routes)       │ │        │
│  │        │         │             │                                  │ │        │
│  │        │         │             │  /api/agents/add-anchor          │ │        │
│  │        │         │             │    ├── Geoapify geocode          │ │        │
│  │   WebSocket      │             │    ├── Turf.js circles           │ │        │
│  │   (Supabase      │             │    ├── Supabase write ───────────┼─┼──┐     │
│  │    Realtime)     │             │    ├── WebSocket push ───────────┼─┘  │     │
│  │        │         │             │    └── Return result ────────────┼────┼──►  │
│  │        │         │             │                                  │    │     │
│  └────────┼─────────┘             │  /api/recommender/score-quality  │    │     │
│           │                       │    ├── ScrapingDog search        │    │     │
│           │                       │    ├── Flash-Lite LLM ◄──────────┼────┼──   │
│           │                       │    ├── Supabase write            │    │     │
│           │                       │    └── WebSocket push            │    │     │
│           │                       │                                  │    │     │
│           │                       └──────────────────────────────────┘    │     │
│           │                                                               │     │
│           │                       ┌──────────────────────────────────┐    │     │
│           │                       │           SUPABASE               │    │     │
│           │                       │                                  │    │     │
│           │                       │  ┌────────────────────────────┐  │    │     │
│           │                       │  │ user_lifestyle_profiles    │◄─┼────┘     │
│           │                       │  │                            │  │          │
│           │                       │  │ - user_id                  │  │          │
│           │                       │  │ - anchors (JSONB)          │  │          │
│           │                       │  │ - dimension_weights (JSONB)│  │          │
│           │                       │  │ - quality_pois (JSONB)     │  │          │
│           │                       │  │ - final_heatmap (JSONB)    │  │          │
│           │                       │  │ - budget_max               │  │          │
│           │                       │  │ - ...                      │  │          │
│           │                       │  └────────────────────────────┘  │          │
│           │                       │                                  │          │
│           └───────────────────────┤  Realtime Channel:               │          │
│                                   │  `map-updates:${userId}`         │          │
│                                   │                                  │          │
│                                   └──────────────────────────────────┘          │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                          DYNAMODB (Read-Only)                            │   │
│  │                                                                          │   │
│  │  leo-census-sections (36k)     leo-osm-pois (595k)                       │   │
│  │  leo-neighborhood-boundaries   leo-atp-pois (92k)                        │   │
│  │  (17k, with SERP data)                                                   │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Event Reference

| Event | Trigger | Payload | Map Action |
|-------|---------|---------|------------|
| `ZOOM_TO_CITY` | User mentions city | `{ city, bounds }` | `map.fitBounds(bounds)` |
| `ADD_COMMUTE_ZONE` | Anchor added | `{ anchorId, geojson }` | `addSource()` + `addLayer()` |
| `SET_NEIGHBORHOODS` | Dimension weights updated | `{ geojson }` | `source.setData()` |
| `ADD_POIS` | Quality POIs searched | `{ pois: GeoJSON }` | Merge with existing source |
| `UPDATE_HEATMAP` | Final scoring complete | `{ geojson }` | `source.setData()` |
| `SHOW_VIBE_CHECK` | Vibe-check triggered | `{ listings }` | Switch to property carousel |

---

## Error Handling

### Tool Call Timeouts

```typescript
// ElevenLabs tool config
{
  "response_timeout_secs": 5,  // ElevenLabs waits 5 seconds max
}

// Your backend should respond within 5 seconds
// If geocoding is slow, return partial result
```

### Failed Tool Calls

```typescript
// /api/agents/add-anchor/route.ts

export async function POST(req: Request) {
  try {
    // ... processing
    return Response.json({ success: true, ... });
  } catch (error) {
    // ElevenLabs will receive this and can retry or inform user
    return Response.json({ 
      success: false, 
      error: 'Failed to geocode address',
      retry: true,  // Hint to ElevenLabs it can retry
    }, { status: 500 });
  }
}
```

### WebSocket Disconnection

```typescript
// useLiveMapUpdates.ts

useEffect(() => {
  const channel = supabase.channel(`map-updates:${userId}`);
  
  channel.on('system', { event: 'disconnect' }, () => {
    // Attempt reconnection
    setTimeout(() => channel.subscribe(), 1000);
  });
  
  return () => channel.unsubscribe();
}, [userId]);
```

---

## 🎯 Leo Brain: Complete Tool Registry (10 Tools)

The full heatmap personalization stack requires 10 tools across 3 scoring layers plus conversation management.

### Layer 1: Commute Tools

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 1: geocode_anchor                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Convert address to coordinates + generate commute zones                │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   address: string,           // "Diagonal", "Plaza Catalunya", etc.             │
│   anchorType: enum,          // "work" | "school" | "partner_work" | "family"   │
│   transportMode?: enum,      // "transit" | "bike" | "moped" | "drive" | "walk" │
│   maxMinutes?: number        // Default: 30                                     │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCE: Geoapify API (3,000/day free)                                      │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. Geocode address → { lat, lng }                                             │
│   2. Generate Turf.js circles at 30, 45, 60 min based on transport speed        │
│   3. Save anchor to Supabase user_lifestyle_profiles.anchors                    │
│   4. Push WebSocket: ADD_COMMUTE_ZONE                                           │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   success: true,                                                                │
│   anchorId: string,                                                             │
│   coords: { lat: number, lng: number },                                         │
│   zones: GeoJSON.FeatureCollection,                                             │
│   mapUpdate: { event: "ADD_COMMUTE_ZONE", payload: GeoJSON }                    │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: Enables commute penalty calculation                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 2: calculate_commute_penalty                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Calculate graduated penalty based on distance from anchors             │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   coords: { lat: number, lng: number },  // Point to score                      │
│   anchors: Anchor[]                       // User's saved anchors               │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCE: Pure math (Turf.js distance calculation)                           │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. For each anchor, calculate distance in km                                  │
│   2. Convert distance to estimated minutes via transport speed                  │
│   3. Find WORST commute (max minutes across all anchors)                        │
│   4. Apply penalty curve:                                                       │
│                                                                                 │
│      ≤30 min  →  0.0  (no penalty)                                              │
│      35 min   → -0.5                                                            │
│      40 min   → -1.0                                                            │
│      45 min   → -1.5                                                            │
│      50 min   → -2.0                                                            │
│      55 min   → -2.5                                                            │
│      60 min   → -3.0                                                            │
│      70 min   → -4.0                                                            │
│      80 min   → -5.0                                                            │
│      90 min   → -6.0                                                            │
│      >90 min  → -7.0  (max penalty, but NOT excluded)                           │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   penalty: number,           // -7.0 to 0.0                                     │
│   worstCommuteMinutes: number,                                                  │
│   worstAnchor: string        // Which anchor is furthest                        │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: SUBTRACTS from final 0-10 score                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Layer 2: Neighborhood Tools

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 3: lookup_neighborhood_serp                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Get lifestyle dimensions for a neighborhood from SERP research         │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   coords?: { lat: number, lng: number },  // Point-in-polygon lookup            │
│   neighborhoodName?: string                // Direct name lookup                │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCE: DynamoDB leo-neighborhood-boundaries                               │
│              (17,594 barrios, 78 with SERP lifestyle data)                      │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. If coords: point-in-polygon to find containing barrio                      │
│   2. If name: fuzzy match against neighborhood names                            │
│   3. Return serpData with 20 lifestyle dimensions (0-100 each)                  │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   neighborhood: string,      // "Gràcia"                                        │
│   city: string,              // "barcelona"                                     │
│   hasSerpData: boolean,                                                         │
│   dimensions: {                                                                 │
│     creative_scene: number,      // 0-100                                       │
│     nightlife: number,                                                          │
│     foodie_scene: number,                                                       │
│     outdoor_lifestyle: number,                                                  │
│     fitness_culture: number,                                                    │
│     young_professional: number,                                                 │
│     family_friendly: number,                                                    │
│     quietness: number,                                                          │
│     safety: number,                                                             │
│     walkability: number,                                                        │
│     transit_access: number,                                                     │
│     green_spaces: number,                                                       │
│     pet_friendly: number,                                                       │
│     expat_community: number,                                                    │
│     digital_nomad: number,                                                      │
│     lgbtq_friendly: number,                                                     │
│     student_friendly: number,                                                   │
│     affordability: number,                                                      │
│     gentrification_risk: number,                                                │
│     cleanliness: number                                                         │
│   }                                                                             │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: Used to calculate neighborhood multiplier (0.7x - 1.3x)   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 4: update_dimension_weight                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Store user's importance weight for a lifestyle dimension               │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   dimension: string,         // "creative_scene", "nightlife", etc.             │
│   weight: number,            // 0.5 - 2.0                                       │
│   reason: string             // "User said 'essential'" (for debugging)         │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCE: Supabase user_lifestyle_profiles.dimension_weights                 │
│                                                                                 │
│ WEIGHT INFERENCE RULES:                                                         │
│                                                                                 │
│   LANGUAGE                          WEIGHT                                      │
│   ────────────────────────────────  ──────                                      │
│   "essential", "must have"          1.9 - 2.0                                   │
│   "really need", "super important"  1.7 - 1.8                                   │
│   "love", "want"                    1.4 - 1.6                                   │
│   "prefer", "like"                  1.2 - 1.4                                   │
│   "nice to have", "if possible"     1.0 - 1.2                                   │
│   "don't care", "not important"     0.5 - 0.8                                   │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. Update dimension_weights in Supabase                                       │
│   2. Query all neighborhoods with SERP data                                     │
│   3. Recalculate multipliers for each neighborhood                              │
│   4. Push WebSocket: SET_NEIGHBORHOODS (recolor map)                            │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   success: true,                                                                │
│   dimension: string,                                                            │
│   weight: number,                                                               │
│   neighborhoodUpdates: number,      // How many hoods were recolored            │
│   mapUpdate: { event: "SET_NEIGHBORHOODS", payload: GeoJSON }                   │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: Weights applied when calculating neighborhood multiplier  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Layer 3: POI Tools

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 5: query_osm_pois                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Look up generic POIs from OpenStreetMap data                           │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   poiType: enum,             // "park" | "metro" | "beach" | "school" |         │
│                              // "supermarket" | "hospital" | "pharmacy"         │
│   nearCoords: { lat, lng },  // Center point for search                         │
│   radiusKm?: number          // Default: 2km                                    │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCE: DynamoDB leo-osm-pois (595,191 POIs)                               │
│ COST: FREE                                                                      │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. Query by PK (poiType) + geohash prefix for spatial filtering               │
│   2. Calculate distance to each POI                                             │
│   3. Filter to radius                                                           │
│   4. Return nearest + count                                                     │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   poiType: string,                                                              │
│   count: number,             // Total in radius                                 │
│   nearest: {                                                                    │
│     name: string,                                                               │
│     distanceKm: number,                                                         │
│     walkMinutes: number                                                         │
│   },                                                                            │
│   score: number              // 0-10 based on distance (10 = <5 min walk)       │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION:                                                           │
│   Distance → Score mapping:                                                     │
│     <5 min walk (400m)   → 10                                                   │
│     5-10 min (800m)      → 8                                                    │
│     10-15 min (1.2km)    → 6                                                    │
│     15-20 min (1.6km)    → 4                                                    │
│     20-30 min (2.4km)    → 2                                                    │
│     >30 min              → 0                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 6: query_atp_density                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Count POIs for "vibe" scoring (cafe density, restaurant density)       │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   category: string,          // "cafe" | "restaurant" | "bar" | "gym"           │
│   nearCoords: { lat, lng },                                                     │
│   radiusKm?: number          // Default: 0.5km (walking radius)                 │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCE: DynamoDB leo-atp-pois (92,375 POIs from AllThePlaces)              │
│ COST: FREE                                                                      │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. Query by category + geohash prefix                                         │
│   2. Count POIs within radius                                                   │
│   3. Calculate density score                                                    │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   category: string,                                                             │
│   count: number,                                                                │
│   densityScore: number       // 0-10                                            │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION:                                                           │
│   Count → Score mapping (for cafes in 500m radius):                             │
│     20+ cafes  → 10 (vibrant area)                                              │
│     15-19      → 8                                                              │
│     10-14      → 6                                                              │
│     5-9        → 4                                                              │
│     2-4        → 2                                                              │
│     0-1        → 0 (dead area)                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 7: search_quality_pois                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Search for quality-specific POIs via Google Maps                       │
│                                                                                 │
│ WHEN TO USE:                                                                    │
│   User says: "good", "best", "specialty", "quality", "top", "great"             │
│   Examples: "good specialty coffee", "best gyms", "quality restaurants"         │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   query: string,             // "specialty coffee", "CrossFit gym"              │
│   weight: number,            // User importance (inferred from language)        │
│   nearCoords: { lat, lng },  // Search center                                   │
│   radiusKm?: number          // Default: 3km                                    │
│ }                                                                               │
│                                                                                 │
│ DATA SOURCES:                                                                   │
│   1. ScrapingDog API (Google Maps search) - ~$0.01/search                       │
│   2. Flash-Lite (Gemini) for scoring results against user context               │
│                                                                                 │
│ LOGIC:                                                                          │
│   1. ScrapingDog: Search "{query} {city}"                                       │
│   2. Parse results: name, rating, reviews, location                             │
│   3. Flash-Lite: Score each result 0-10 based on:                               │
│      - Does it match the query intent?                                          │
│      - Rating quality (4.5+ = good)                                             │
│      - Review count (social proof)                                              │
│   4. Filter to those within user's commute zones                                │
│   5. Save to Supabase for future reference                                      │
│   6. Push WebSocket: ADD_POIS                                                   │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   query: string,                                                                │
│   pois: [                                                                       │
│     {                                                                           │
│       name: string,                                                             │
│       coords: { lat, lng },                                                     │
│       rating: number,                                                           │
│       reviews: number,                                                          │
│       qualityScore: number,  // 0-10 from Flash-Lite                            │
│       distanceKm: number                                                        │
│     }                                                                           │
│   ],                                                                            │
│   avgScore: number,                                                             │
│   mapUpdate: { event: "ADD_POIS", payload: GeoJSON }                            │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION:                                                           │
│   Proximity to high-quality POIs → 0-10 subscore                                │
│   (Weighted by user's stated importance)                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Conversation Tools

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 8: add_dealbreaker                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Record hard filters that exclude listings entirely                     │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   dealbreaker: string,       // "ground_floor", "shared_apartment", etc.        │
│   reason: string             // "User said 'no ground floor'"                   │
│ }                                                                               │
│                                                                                 │
│ COMMON DEALBREAKERS:                                                            │
│   - ground_floor             (security concerns)                                │
│   - shared_apartment         (privacy)                                          │
│   - no_elevator_high_floor   (accessibility)                                    │
│   - street_facing_noisy      (noise sensitivity)                                │
│   - no_natural_light         (windowless rooms)                                 │
│   - needs_full_renovation    (not move-in ready)                                │
│                                                                                 │
│ DATA SOURCE: Supabase user_lifestyle_profiles.dealbreakers                      │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   success: true,                                                                │
│   dealbreakers: string[]     // Full list of user's dealbreakers                │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: N/A (binary filter, not a score)                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 9: ask_clarification                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Pause execution to ask user for more information                       │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   question: string,          // "What's your monthly budget?"                   │
│   reason: string,            // "Need budget to filter listings"                │
│   options?: string[]         // Optional multiple choice                        │
│ }                                                                               │
│                                                                                 │
│ WHEN TO USE:                                                                    │
│   - Missing critical info (budget, move-in date)                                │
│   - Ambiguous preference ("near" could mean 5 min or 20 min)                    │
│   - Conflicting requirements (want quiet + nightlife)                           │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   needsUserInput: true,                                                         │
│   question: string,                                                             │
│   pauseExecution: true       // Stops the agent loop                            │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: N/A (conversation control)                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOL 10: respond_to_user                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ PURPOSE: Generate Leo's spoken response                                         │
│                                                                                 │
│ INPUT SCHEMA:                                                                   │
│ {                                                                               │
│   text: string,              // What Leo should say                             │
│   emotion?: string,          // "excited" | "thoughtful" | "reassuring"         │
│   summaryUpdate?: {          // Updates to conversation state                   │
│     addedInfo: string[],                                                        │
│     stillNeeded: string[]                                                       │
│   }                                                                             │
│ }                                                                               │
│                                                                                 │
│ OUTPUT:                                                                         │
│ {                                                                               │
│   speakThis: string          // Returned to ElevenLabs                          │
│ }                                                                               │
│                                                                                 │
│ SCORING CONTRIBUTION: N/A (conversation output)                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔢 Heatmap Scoring Formula (0-10 per Hex)

The final heatmap assigns a score from 0-10 to every H3 hex (or coordinate) in the city.

### The Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│    FINAL_SCORE = clamp( (POI_SCORE × NEIGHBORHOOD_MULTIPLIER) + COMMUTE_PENALTY,│
│                         0, 10 )                                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### POI Score (0-10)

```typescript
// Weighted average of all POI subscores

function calculatePoiScore(
  coords: Coords,
  userPoiPreferences: PoiPreference[]
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const pref of userPoiPreferences) {
    let subscore: number;
    
    switch (pref.type) {
      case 'osm':
        // Distance to nearest generic POI
        subscore = scoreNearestOsm(coords, pref.poiType);
        break;
      case 'density':
        // Count of POIs in walking radius
        subscore = scoreDensity(coords, pref.category);
        break;
      case 'quality':
        // Proximity to quality-scored POIs
        subscore = scoreNearestQuality(coords, pref.scoredPois);
        break;
    }
    
    totalScore += subscore * pref.weight;
    totalWeight += pref.weight;
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 5; // Default to neutral
}
```

**Example:**
```
User preferences:
  - Parks (OSM): weight 1.0
  - Coffee (Quality): weight 1.8 ("essential")
  - Metro (OSM): weight 1.2

At a specific hex:
  - park_score = 8 (park 5 min away)
  - coffee_score = 9 (great cafe 3 min away)
  - metro_score = 7 (metro 8 min away)

POI_SCORE = (8×1.0 + 9×1.8 + 7×1.2) / (1.0 + 1.8 + 1.2)
          = (8 + 16.2 + 8.4) / 4.0
          = 32.6 / 4.0
          = 8.15
```

#### Neighborhood Multiplier (0.7x - 1.3x)

```typescript
function calculateNeighborhoodMultiplier(
  serpData: NeighborhoodDimensions,
  userWeights: DimensionWeights
): number {
  let matchScore = 0;
  let totalWeight = 0;
  
  for (const [dimension, userWeight] of Object.entries(userWeights)) {
    if (userWeight === 0) continue;
    
    // SERP scores are 0-100, normalize to 0-1
    const hoodScore = (serpData[dimension] || 50) / 100;
    matchScore += hoodScore * userWeight;
    totalWeight += userWeight;
  }
  
  // Normalize to 0-1
  const normalizedMatch = totalWeight > 0 ? matchScore / totalWeight : 0.5;
  
  // Convert to multiplier: 0 → 0.7x, 0.5 → 1.0x, 1.0 → 1.3x
  return 0.7 + (normalizedMatch * 0.6);
}
```

**Example (Gràcia):**
```
SERP data for Gràcia:
  - creative_scene: 90
  - nightlife: 75
  - quietness: 60

User weights:
  - creative_scene: 1.8 ("super important")
  - nightlife: 1.5 ("want")
  - quietness: 0.8 ("don't care much")

Match calculation:
  = (0.90×1.8 + 0.75×1.5 + 0.60×0.8) / (1.8 + 1.5 + 0.8)
  = (1.62 + 1.125 + 0.48) / 4.1
  = 3.225 / 4.1
  = 0.787

MULTIPLIER = 0.7 + (0.787 × 0.6) = 1.17x
```

#### Commute Penalty (-7 to 0)

```typescript
function calculateCommutePenalty(
  coords: Coords,
  anchors: Anchor[]
): number {
  // Find worst commute (longest time to any anchor)
  let worstMinutes = 0;
  
  for (const anchor of anchors) {
    const distanceKm = turf.distance(
      [coords.lng, coords.lat],
      [anchor.lng, anchor.lat],
      { units: 'kilometers' }
    );
    
    // Estimate minutes based on transport mode
    const speed = TRANSPORT_SPEEDS[anchor.transportMode]; // km/h
    const estimatedMinutes = (distanceKm / speed) * 60;
    
    worstMinutes = Math.max(worstMinutes, estimatedMinutes);
  }
  
  // Apply graduated penalty curve
  if (worstMinutes <= 30) return 0;
  if (worstMinutes <= 60) return -((worstMinutes - 30) / 10); // -0 to -3
  if (worstMinutes <= 90) return -3 - ((worstMinutes - 60) / 10); // -3 to -6
  return -7; // Max penalty
}

const TRANSPORT_SPEEDS = {
  transit: 17,  // km/h (includes walking + waiting)
  bike: 15,
  moped: 22,
  drive: 25,
  walk: 5,
};
```

**Penalty curve:**
```
Minutes  │  Penalty
─────────┼──────────
   30    │    0.0
   35    │   -0.5
   40    │   -1.0
   45    │   -1.5
   50    │   -2.0
   55    │   -2.5
   60    │   -3.0
   70    │   -4.0
   80    │   -5.0
   90    │   -6.0
  >90    │   -7.0
```

### Full Calculation Example

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FULL SCORING EXAMPLE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  LOCATION: A hex in Gràcia, 35 min transit from user's work at Diagonal         │
│                                                                                 │
│  STEP 1: POI Score                                                              │
│  ─────────────────                                                              │
│  User preferences:                                                              │
│    - Parks: w=1.0, score=8 (park 5 min)                                         │
│    - Coffee: w=1.8, score=9 (specialty cafe 3 min)                              │
│    - Metro: w=1.2, score=7 (metro 8 min)                                        │
│                                                                                 │
│  POI_SCORE = (8×1.0 + 9×1.8 + 7×1.2) / (1.0+1.8+1.2)                            │
│            = 32.6 / 4.0                                                         │
│            = 8.15                                                               │
│                                                                                 │
│  STEP 2: Neighborhood Multiplier                                                │
│  ───────────────────────────────                                                │
│  Gràcia SERP: creative=90, nightlife=75, quietness=60                           │
│  User weights: creative=1.8, nightlife=1.5, quietness=0.8                       │
│                                                                                 │
│  Match = (0.90×1.8 + 0.75×1.5 + 0.60×0.8) / 4.1 = 0.787                         │
│  MULTIPLIER = 0.7 + (0.787 × 0.6) = 1.17                                        │
│                                                                                 │
│  STEP 3: Commute Penalty                                                        │
│  ───────────────────────                                                        │
│  35 min from work → PENALTY = -0.5                                              │
│                                                                                 │
│  STEP 4: Final Score                                                            │
│  ───────────────────                                                            │
│  RAW_SCORE = 8.15 × 1.17 = 9.54                                                 │
│  FINAL_SCORE = 9.54 + (-0.5) = 9.04                                             │
│  CLAMPED = 9.04 ✓                                                               │
│                                                                                 │
│  RESULT: 9.04 / 10 → 🔴 RED (Excellent match!)                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Heatmap Color Mapping

| Score Range | Color | Meaning |
|-------------|-------|---------|
| 8-10 | 🔴 Red | **Excellent** - Great for your lifestyle |
| 6-8 | 🟠 Orange | **Good** - Strong match |
| 4-6 | 🟡 Yellow | **Decent** - Acceptable commute, some matches |
| 2-4 | 🔵 Blue | **Poor** - Out of the way |
| 0-2 | ⬜ Faded | **Bad** - Very poor match |

---

## 📊 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  USER: "I work at Diagonal, need good coffee, love creative areas"              │
│                                                                                 │
│       │                                                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           ELEVENLABS                                    │   │
│  │                        (Voice I/O Only)                                 │   │
│  │                                                                         │   │
│  │  STT → "I work at Diagonal, need good coffee, love creative areas"      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       │  POST /api/agents/process-input                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           LEO BRAIN                                     │   │
│  │                    (Gemini + Function Calling)                          │   │
│  │                                                                         │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │  │ PARSE INTENTS                                                     │  │   │
│  │  │                                                                   │  │   │
│  │  │ 1. "work at Diagonal"     → geocode_anchor (COMMUTE)              │  │   │
│  │  │ 2. "need good coffee"     → search_quality_pois (POI-QUALITY)     │  │   │
│  │  │    - "good" = quality search (ScrapingDog, not OSM)               │  │   │
│  │  │    - "need" = weight 1.5                                          │  │   │
│  │  │ 3. "love creative areas"  → update_dimension_weight (NEIGHBORHOOD)│  │   │
│  │  │    - "love" = weight 1.6                                          │  │   │
│  │  └───────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                         │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │  │ PLAN EXECUTION                                                    │  │   │
│  │  │                                                                   │  │   │
│  │  │ Order: geocode FIRST (need coords for other searches)             │  │   │
│  │  │ Then: search_quality_pois + update_dimension_weight (parallel)    │  │   │
│  │  │ Finally: respond_to_user                                          │  │   │
│  │  └───────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                         │   │
│  │  TOOL CALLS → executed sequentially/parallel as planned                 │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         TOOL EXECUTION                                  │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                         │   │
│  │  TOOL 1: geocode_anchor({ address: "Diagonal", type: "work" })          │   │
│  │  ─────────────────────────────────────────────────────────────          │   │
│  │    │                                                                    │   │
│  │    ├─► Geoapify API                                                     │   │
│  │    │   └─► { lat: 41.3924, lng: 2.1427 }                                │   │
│  │    │                                                                    │   │
│  │    ├─► Turf.js                                                          │   │
│  │    │   └─► Generate circles: 30min (8.5km), 45min (12.75km), 60min (17km)│  │
│  │    │                                                                    │   │
│  │    ├─► Supabase                                                         │   │
│  │    │   └─► INSERT anchor into user_lifestyle_profiles.anchors           │   │
│  │    │                                                                    │   │
│  │    └─► WebSocket ───────────────────────────────────────────────────┐   │   │
│  │        event: ADD_COMMUTE_ZONE                                      │   │   │
│  │        payload: GeoJSON circles                                     │   │   │
│  │                                                                     │   │   │
│  │  TOOL 7: search_quality_pois({ query: "specialty coffee", w: 1.5 })│   │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │   │
│  │    │                                                                │   │   │
│  │    ├─► ScrapingDog API (~$0.01)                                     │   │   │
│  │    │   └─► Search "specialty coffee Barcelona"                      │   │   │
│  │    │   └─► 15 results with ratings, reviews, coords                 │   │   │
│  │    │                                                                │   │   │
│  │    ├─► Flash-Lite (Gemini)                                          │   │   │
│  │    │   └─► Score each: "Is this good specialty coffee?" 0-10        │   │   │
│  │    │   └─► Top 5: Satan's Coffee (9), Nomad (9), Federal (8)...     │   │   │
│  │    │                                                                │   │   │
│  │    ├─► Filter: Keep only those within 60min commute zone            │   │   │
│  │    │                                                                │   │   │
│  │    ├─► Supabase                                                     │   │   │
│  │    │   └─► INSERT into user_lifestyle_profiles.quality_pois         │   │   │
│  │    │                                                                │   │   │
│  │    └─► WebSocket ───────────────────────────────────────────────┐   │   │   │
│  │        event: ADD_POIS                                          │   │   │   │
│  │        payload: Coffee shop markers                             │   │   │   │
│  │                                                                 │   │   │   │
│  │  TOOL 4: update_dimension_weight({ dim: "creative_scene", w: 1.6 }) │   │   │
│  │  ───────────────────────────────────────────────────────────────────│   │   │
│  │    │                                                                │   │   │
│  │    ├─► Supabase                                                     │   │   │
│  │    │   └─► UPDATE dimension_weights.creative_scene = 1.6            │   │   │
│  │    │                                                                │   │   │
│  │    ├─► DynamoDB: leo-neighborhood-boundaries                        │   │   │
│  │    │   └─► Query all 78 neighborhoods with SERP data                │   │   │
│  │    │                                                                │   │   │
│  │    ├─► Calculate multipliers for each neighborhood                  │   │   │
│  │    │   └─► Gràcia: 1.17x, El Born: 1.14x, Eixample: 0.95x...        │   │   │
│  │    │                                                                │   │   │
│  │    └─► WebSocket ───────────────────────────────────────────────┐   │   │   │
│  │        event: SET_NEIGHBORHOODS                                 │   │   │   │
│  │        payload: Colored polygons                                │   │   │   │
│  │                                                                 │   │   │   │
│  │  TOOL 10: respond_to_user({ text: "Got it! I've mapped..." })   │   │   │   │
│  │  ────────────────────────────────────────────────────────────── │   │   │   │
│  │    └─► Return { speakThis: "Got it! I've mapped your commute    │   │   │   │
│  │        from Diagonal and found 5 great coffee spots. Gràcia     │   │   │   │
│  │        and El Born both have the creative vibe you're after!" } │   │   │   │
│  │                                                                 │   │   │   │
│  └─────────────────────────────────────────────────────────────────│───┘   │   │
│                                                                    │       │   │
│       │  Return to ElevenLabs                                      │       │   │
│       ▼                                                            │       │   │
│  ┌─────────────────────────────────────────────────────────────┐   │       │   │
│  │                      ELEVENLABS                             │   │       │   │
│  │                                                             │   │       │   │
│  │  TTS → "Got it! I've mapped your commute from Diagonal..."  │   │       │   │
│  └─────────────────────────────────────────────────────────────┘   │       │   │
│                                                                    │       │   │
│       MEANWHILE (in parallel):                                     │       │   │
│       ═══════════════════════                                      │       │   │
│                                                                    │       │   │
│  ┌─────────────────────────────────────────────────────────────┐◄──┴───────┘   │
│  │                        FRONTEND                             │               │
│  │                                                             │               │
│  │  WebSocket receives (in order):                             │               │
│  │                                                             │               │
│  │  1. ADD_COMMUTE_ZONE                                        │               │
│  │     └─► Mapbox: addLayer() for commute circles              │               │
│  │     └─► User sees: Concentric circles around Diagonal       │               │
│  │                                                             │               │
│  │  2. ADD_POIS                                                │               │
│  │     └─► Mapbox: addLayer() for coffee markers               │               │
│  │     └─► User sees: ☕ markers at Satan's, Nomad, Federal... │               │
│  │                                                             │               │
│  │  3. SET_NEIGHBORHOODS                                       │               │
│  │     └─► Mapbox: setData() on neighborhood layer             │               │
│  │     └─► User sees: Gràcia glows red, El Born orange...      │               │
│  │                                                             │               │
│  │  Map updates WHILE user hears Leo's response!               │               │
│  │                                                             │               │
│  └─────────────────────────────────────────────────────────────┘               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Hex-Level Heatmap Generation (End of Call)

After the intake call completes, generate scores for every H3 hex:

```typescript
// Called at end of intake or when user requests final heatmap

async function generateFullHeatmap(userId: string): Promise<GeoJSON.FeatureCollection> {
  // Load user profile
  const profile = await loadUserProfile(userId);
  
  // Get all H3 hexes covering Barcelona (resolution 9 ≈ 100m hexes)
  const cityBounds = CITY_BOUNDS['barcelona'];
  const hexes = h3.polyfill(cityBounds, 9); // ~50k hexes
  
  const features: GeoJSON.Feature[] = [];
  
  for (const hexId of hexes) {
    const center = h3.h3ToGeo(hexId);
    const coords = { lat: center[0], lng: center[1] };
    
    // ═══════════════════════════════════════════════════════════════
    // LAYER 1: COMMUTE PENALTY
    // ═══════════════════════════════════════════════════════════════
    const commutePenalty = calculateCommutePenalty(coords, profile.anchors);
    
    // Skip hexes with max penalty (optimization)
    if (commutePenalty <= -7 && !profile.includeAllHexes) {
      continue; // Don't render hexes >90 min away
    }
    
    // ═══════════════════════════════════════════════════════════════
    // LAYER 2: NEIGHBORHOOD MULTIPLIER
    // ═══════════════════════════════════════════════════════════════
    const neighborhood = findNeighborhood(coords); // Point-in-polygon
    const multiplier = neighborhood?.serpData
      ? calculateNeighborhoodMultiplier(neighborhood.serpData, profile.dimensionWeights)
      : 1.0; // Default if no SERP data
    
    // ═══════════════════════════════════════════════════════════════
    // LAYER 3: POI SCORE
    // ═══════════════════════════════════════════════════════════════
    const poiSubscores: { score: number; weight: number }[] = [];
    
    // OSM POI preferences
    for (const pref of profile.osmPreferences) {
      const score = scoreNearestOsmPoi(coords, pref.poiType);
      poiSubscores.push({ score, weight: pref.weight });
    }
    
    // Density preferences (vibe)
    for (const pref of profile.densityPreferences) {
      const score = scoreDensity(coords, pref.category);
      poiSubscores.push({ score, weight: pref.weight });
    }
    
    // Quality POI preferences
    for (const pref of profile.qualityPois) {
      const score = scoreNearestQualityPoi(coords, pref.scoredPois);
      poiSubscores.push({ score, weight: pref.weight });
    }
    
    // Weighted average
    const poiScore = weightedAverage(poiSubscores);
    
    // ═══════════════════════════════════════════════════════════════
    // COMBINE: Final Score
    // ═══════════════════════════════════════════════════════════════
    const rawScore = poiScore * multiplier;
    const finalScore = Math.max(0, Math.min(10, rawScore + commutePenalty));
    
    // Create hex polygon feature
    const hexBoundary = h3.h3ToGeoBoundary(hexId, true); // GeoJSON format
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [hexBoundary],
      },
      properties: {
        hexId,
        score: Math.round(finalScore * 10) / 10, // Round to 1 decimal
        poiScore: Math.round(poiScore * 10) / 10,
        multiplier: Math.round(multiplier * 100) / 100,
        commutePenalty,
        neighborhood: neighborhood?.name || null,
      },
    });
  }
  
  // Save to user profile
  await supabase
    .from('user_lifestyle_profiles')
    .update({ final_heatmap: { type: 'FeatureCollection', features } })
    .eq('user_id', userId);
  
  // Push to frontend
  await pushWebSocket(userId, 'UPDATE_HEATMAP', { 
    type: 'FeatureCollection', 
    features 
  });
  
  return { type: 'FeatureCollection', features };
}

// Helper: Weighted average
function weightedAverage(items: { score: number; weight: number }[]): number {
  if (items.length === 0) return 5; // Neutral default
  
  const totalScore = items.reduce((sum, i) => sum + i.score * i.weight, 0);
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  
  return totalWeight > 0 ? totalScore / totalWeight : 5;
}
```

### Output GeoJSON Structure

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.153, 41.389], [2.154, 41.390], ...]]
      },
      "properties": {
        "hexId": "893969a4bffffff",
        "score": 8.5,
        "poiScore": 8.2,
        "multiplier": 1.17,
        "commutePenalty": -0.5,
        "neighborhood": "Gràcia"
      }
    },
    // ... ~30-50k more hexes
  ]
}
```

---

## 💻 Tool Implementation Code

### Tool 1: geocode_anchor

```typescript
// src/lib/leo-brain/tools/geocode-anchor.ts

import * as turf from '@turf/turf';
import { geoapifyGeocode } from '@/lib/geo/geoapify';
import { supabase } from '@/lib/supabase';
import { pushWebSocket } from '@/lib/websocket';

const TRANSPORT_SPEEDS = {
  transit: 17,
  bike: 15,
  moped: 22,
  drive: 25,
  walk: 5,
};

interface GeocodeAnchorInput {
  address: string;
  anchorType: 'work' | 'school' | 'partner_work' | 'family' | 'gym' | 'other';
  transportMode?: 'transit' | 'bike' | 'moped' | 'drive' | 'walk';
  maxMinutes?: number;
}

export async function geocodeAnchor(
  input: GeocodeAnchorInput,
  userId: string
): Promise<ToolResult> {
  const { address, anchorType, transportMode = 'transit', maxMinutes = 30 } = input;
  
  // 1. Geocode address
  const coords = await geoapifyGeocode(address);
  if (!coords) {
    return { success: false, error: `Could not find location: ${address}` };
  }
  
  // 2. Generate commute zones
  const speed = TRANSPORT_SPEEDS[transportMode];
  const zones = {
    type: 'FeatureCollection',
    features: [
      turf.circle([coords.lng, coords.lat], speed * 0.5, { 
        units: 'kilometers', 
        properties: { minutes: 30, opacity: 0.3 } 
      }),
      turf.circle([coords.lng, coords.lat], speed * 0.75, { 
        units: 'kilometers', 
        properties: { minutes: 45, opacity: 0.2 } 
      }),
      turf.circle([coords.lng, coords.lat], speed * 1.0, { 
        units: 'kilometers', 
        properties: { minutes: 60, opacity: 0.1 } 
      }),
    ],
  };
  
  // 3. Create anchor object
  const anchor = {
    id: crypto.randomUUID(),
    type: anchorType,
    address,
    coords,
    transportMode,
    maxMinutes,
    createdAt: new Date().toISOString(),
  };
  
  // 4. Save to Supabase
  const { data: profile } = await supabase
    .from('user_lifestyle_profiles')
    .select('anchors')
    .eq('user_id', userId)
    .single();
  
  const existingAnchors = profile?.anchors || [];
  
  await supabase
    .from('user_lifestyle_profiles')
    .update({ 
      anchors: [...existingAnchors, anchor],
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  
  // 5. Push WebSocket
  await pushWebSocket(userId, 'ADD_COMMUTE_ZONE', {
    anchorId: anchor.id,
    geojson: zones,
  });
  
  return {
    success: true,
    anchorId: anchor.id,
    coords,
    zones,
    mapUpdate: { event: 'ADD_COMMUTE_ZONE', payload: zones },
  };
}
```

### Tool 5: query_osm_pois

```typescript
// src/lib/leo-brain/tools/query-osm-pois.ts

import * as turf from '@turf/turf';
import { dynamodb } from '@/lib/aws/dynamodb';
import * as geohash from 'ngeohash';

interface QueryOsmPoisInput {
  poiType: 'park' | 'metro' | 'beach' | 'school' | 'supermarket' | 'hospital';
  nearCoords: { lat: number; lng: number };
  radiusKm?: number;
}

export async function queryOsmPois(input: QueryOsmPoisInput): Promise<ToolResult> {
  const { poiType, nearCoords, radiusKm = 2 } = input;
  
  // 1. Get geohash prefix for spatial query
  const centerGeohash = geohash.encode(nearCoords.lat, nearCoords.lng, 5);
  
  // 2. Query DynamoDB
  const result = await dynamodb.query({
    TableName: 'leo-osm-pois',
    KeyConditionExpression: 'PK = :poiType AND begins_with(SK, :geohash)',
    ExpressionAttributeValues: {
      ':poiType': poiType,
      ':geohash': centerGeohash,
    },
  });
  
  // 3. Filter by exact distance
  const poisInRadius = (result.Items || []).filter((poi) => {
    const distance = turf.distance(
      [nearCoords.lng, nearCoords.lat],
      [poi.centroid.lng, poi.centroid.lat],
      { units: 'kilometers' }
    );
    return distance <= radiusKm;
  });
  
  // 4. Find nearest
  let nearest = null;
  let minDistance = Infinity;
  
  for (const poi of poisInRadius) {
    const distance = turf.distance(
      [nearCoords.lng, nearCoords.lat],
      [poi.centroid.lng, poi.centroid.lat],
      { units: 'kilometers' }
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { ...poi, distanceKm: distance };
    }
  }
  
  // 5. Calculate score based on distance
  const walkMinutes = nearest ? (nearest.distanceKm / 5) * 60 : 999;
  let score = 0;
  if (walkMinutes < 5) score = 10;
  else if (walkMinutes < 10) score = 8;
  else if (walkMinutes < 15) score = 6;
  else if (walkMinutes < 20) score = 4;
  else if (walkMinutes < 30) score = 2;
  
  return {
    success: true,
    poiType,
    count: poisInRadius.length,
    nearest: nearest ? {
      name: nearest.name,
      distanceKm: Math.round(nearest.distanceKm * 100) / 100,
      walkMinutes: Math.round(walkMinutes),
    } : null,
    score,
  };
}
```

### Tool 7: search_quality_pois

```typescript
// src/lib/leo-brain/tools/search-quality-pois.ts

import { scrapingDogSearch } from '@/lib/scraping/scrapingdog';
import { flashLiteScore } from '@/lib/ai/flash-lite';
import { supabase } from '@/lib/supabase';
import { pushWebSocket } from '@/lib/websocket';
import * as turf from '@turf/turf';

interface SearchQualityPoisInput {
  query: string;
  weight: number;
  nearCoords: { lat: number; lng: number };
  radiusKm?: number;
}

export async function searchQualityPois(
  input: SearchQualityPoisInput,
  userId: string,
  userAnchors: Anchor[]
): Promise<ToolResult> {
  const { query, weight, nearCoords, radiusKm = 3 } = input;
  
  // 1. Search via ScrapingDog
  const searchResults = await scrapingDogSearch({
    query: `${query} Barcelona`,
    location: nearCoords,
  });
  
  if (!searchResults.length) {
    return { success: false, error: `No results found for: ${query}` };
  }
  
  // 2. Score each result with Flash-Lite
  const scoredPois = await Promise.all(
    searchResults.map(async (poi) => {
      const qualityScore = await flashLiteScore({
        prompt: `Rate this place 0-10 for someone looking for "${query}":
                 Name: ${poi.name}
                 Rating: ${poi.rating}/5 (${poi.reviewCount} reviews)
                 Type: ${poi.category}
                 
                 Consider: Does this match "${query}"? Is the rating good? Enough reviews?
                 Return just a number 0-10.`,
      });
      
      return {
        ...poi,
        qualityScore: parseFloat(qualityScore) || 5,
      };
    })
  );
  
  // 3. Filter to those within commute zones
  const maxCommuteKm = Math.max(...userAnchors.map((a) => {
    const speed = TRANSPORT_SPEEDS[a.transportMode];
    return speed * 1.0; // 60 min max
  }));
  
  const poisInRange = scoredPois.filter((poi) => {
    const distance = turf.distance(
      [nearCoords.lng, nearCoords.lat],
      [poi.coords.lng, poi.coords.lat],
      { units: 'kilometers' }
    );
    return distance <= maxCommuteKm;
  });
  
  // 4. Sort by quality score
  const topPois = poisInRange
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 10);
  
  // 5. Save to Supabase
  const poiPreference = {
    id: crypto.randomUUID(),
    type: 'quality',
    query,
    weight,
    scoredPois: topPois,
    createdAt: new Date().toISOString(),
  };
  
  const { data: profile } = await supabase
    .from('user_lifestyle_profiles')
    .select('quality_pois')
    .eq('user_id', userId)
    .single();
  
  await supabase
    .from('user_lifestyle_profiles')
    .update({
      quality_pois: [...(profile?.quality_pois || []), poiPreference],
    })
    .eq('user_id', userId);
  
  // 6. Generate GeoJSON for map
  const geojson = {
    type: 'FeatureCollection',
    features: topPois.map((poi) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [poi.coords.lng, poi.coords.lat],
      },
      properties: {
        name: poi.name,
        rating: poi.rating,
        qualityScore: poi.qualityScore,
        query,
      },
    })),
  };
  
  // 7. Push WebSocket
  await pushWebSocket(userId, 'ADD_POIS', geojson);
  
  return {
    success: true,
    query,
    weight,
    pois: topPois.map((p) => ({
      name: p.name,
      rating: p.rating,
      qualityScore: p.qualityScore,
      distanceKm: turf.distance(
        [nearCoords.lng, nearCoords.lat],
        [p.coords.lng, p.coords.lat],
        { units: 'kilometers' }
      ),
    })),
    avgScore: topPois.reduce((sum, p) => sum + p.qualityScore, 0) / topPois.length,
    mapUpdate: { event: 'ADD_POIS', payload: geojson },
  };
}
```

---

## Implementation Checklist

### Phase 1: Leo Brain Core (The Orchestrator)

- [ ] Create `/api/agents/process-input/route.ts` — Single entry point from ElevenLabs
- [ ] Create `src/lib/leo-brain/planner.ts` — Gemini Pro planning prompt
- [ ] Create `src/lib/leo-brain/executor.ts` — Execute planned steps
- [ ] Create `src/lib/leo-brain/state.ts` — State accumulation logic
- [ ] Create `src/lib/leo-brain/actions/` — Individual action handlers:
  - [ ] `geocodeAnchor.ts`
  - [ ] `queryOsmPois.ts`
  - [ ] `queryAtpDensity.ts`
  - [ ] `searchQualityPois.ts`
  - [ ] `lookupNeighborhoodSerp.ts`
  - [ ] `updateDimensionWeight.ts`
  - [ ] `calculateHeatmapLayer.ts`
- [ ] Add `agent_state` JSONB column to `user_lifestyle_profiles` table

### Phase 2: Infrastructure

- [ ] Set up Supabase Realtime channel for `map-updates:${userId}`
- [ ] Create `useLiveMapUpdates.ts` hook
- [ ] Create `LiveMap.tsx` with persistent Mapbox instance
- [ ] Create `useBuildMapFromProfile.ts` for state recovery

### Phase 3: Data Source Integrations

- [ ] `src/lib/geo/geoapify.ts` — Geocoding (3k/day free)
- [ ] `src/lib/geo/turf-zones.ts` — Commute circle generation
- [ ] `src/lib/geo/osm-queries.ts` — Query `leo-osm-pois` DynamoDB
- [ ] `src/lib/geo/atp-queries.ts` — Query `leo-atp-pois` DynamoDB
- [ ] `src/lib/geo/serp-queries.ts` — Query `leo-neighborhood-boundaries` DynamoDB
- [ ] `src/lib/geo/scrapingdog.ts` — Quality POI searches
- [ ] `src/lib/geo/poi-scorer.ts` — Flash-Lite POI scoring

### Phase 4: Map Layers

- [ ] `CommuteZoneLayer.tsx` — Turf.js circles
- [ ] `NeighborhoodLayer.tsx` — Fill polygons with multiplier colors
- [ ] `POIMarkers.tsx` — Quality POI markers
- [ ] `HeatmapLayer.tsx` — Gradient overlay

### Phase 5: ElevenLabs Configuration

- [ ] Create `process_input` tool config (ONLY tool ElevenLabs needs)
- [ ] Update Leo agent system prompt to use `process_input` for everything
- [ ] Remove individual tool configs (add_anchor, update_profile, etc.)
- [ ] Test voice → Leo Brain → map update flow

### Phase 6: Testing

- [ ] Test multi-intent parsing ("work at X and want Y")
- [ ] Test data source selection (OSM vs ScrapingDog vs ATP)
- [ ] Test weight inference ("essential" vs "nice to have")
- [ ] Test state accumulation across turns
- [ ] Test page refresh state recovery
- [ ] Test error scenarios and fallbacks

### File Structure

```
src/
├── lib/
│   └── leo-brain/
│       ├── index.ts              # Main entry point
│       ├── planner.ts            # Gemini Pro planning
│       ├── executor.ts           # Execute plan steps
│       ├── state.ts              # State management
│       ├── prompts.ts            # Planning prompts
│       ├── types.ts              # TypeScript types
│       └── actions/
│           ├── geocodeAnchor.ts
│           ├── queryOsmPois.ts
│           ├── queryAtpDensity.ts
│           ├── searchQualityPois.ts
│           ├── lookupNeighborhoodSerp.ts
│           ├── updateDimensionWeight.ts
│           └── calculateHeatmapLayer.ts
│
├── app/
│   └── api/
│       └── agents/
│           └── process-input/
│               └── route.ts      # Single ElevenLabs entry point
│
└── components/
    └── map/
        ├── LiveMap.tsx
        ├── CommuteZoneLayer.tsx
        ├── NeighborhoodLayer.tsx
        ├── POIMarkers.tsx
        └── HeatmapLayer.tsx
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-05-ELEVENLABS-AGENTS](./P0-05-ELEVENLABS-AGENTS.md) | Tool definitions, agent prompts |
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | Scoring formula, Turf.js zones |
| [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md) | Map components, WebSocket events |
| [P0-19-GEO-DATA-PIPELINE](./P0-19-GEO-DATA-PIPELINE.md) | DynamoDB geo data (741k records) |

---

*Created: December 8, 2025*
*Updated: December 8, 2025 — Full implementation documentation with 10 tools, scoring formula, and code*

---

## Document Summary

**Lines:** ~2,900

### Complete Documentation Coverage

| Section | What's Documented | Status |
|---------|-------------------|--------|
| **Leo Brain Architecture** | Core concept, why needed, agent loop | ✅ Complete |
| **10 Tool Registry** | All tools with schemas, data sources, scoring | ✅ Complete |
| **Scoring Formula** | 0-10 per hex with full math examples | ✅ Complete |
| **Data Flow Diagram** | User → ElevenLabs → Leo Brain → Tools → Map | ✅ Complete |
| **Hex-Level Generation** | H3 hex iteration, full heatmap code | ✅ Complete |
| **Tool Implementation** | Actual TypeScript code for key tools | ✅ Complete |
| **Cost & Latency** | Estimates per turn and per call | ✅ Complete |
| **Error Handling** | Timeouts, failures, fallbacks | ✅ Complete |
| **ElevenLabs Config** | process_input tool definition | ✅ Complete |
| **Implementation Checklist** | 6 phases with file structure | ✅ Complete |

### The 10 Tools

| # | Tool | Layer | Data Source | Cost |
|---|------|-------|-------------|------|
| 1 | `geocode_anchor` | Commute | Geoapify | FREE (3k/day) |
| 2 | `calculate_commute_penalty` | Commute | Turf.js | FREE |
| 3 | `lookup_neighborhood_serp` | Neighborhood | DynamoDB | FREE |
| 4 | `update_dimension_weight` | Neighborhood | Supabase | FREE |
| 5 | `query_osm_pois` | POI | DynamoDB (595k) | FREE |
| 6 | `query_atp_density` | POI | DynamoDB (92k) | FREE |
| 7 | `search_quality_pois` | POI | ScrapingDog + Flash | ~$0.01 |
| 8 | `add_dealbreaker` | Conversation | Supabase | FREE |
| 9 | `ask_clarification` | Conversation | — | FREE |
| 10 | `respond_to_user` | Conversation | — | FREE |

### Scoring Formula

```
FINAL_SCORE = clamp( (POI_SCORE × NEIGHBORHOOD_MULTIPLIER) + COMMUTE_PENALTY, 0, 10 )
```

- **POI_SCORE** (0-10): Weighted average of OSM, density, and quality subscores
- **NEIGHBORHOOD_MULTIPLIER** (0.7x-1.3x): Based on SERP dimensions × user weights
- **COMMUTE_PENALTY** (-7 to 0): Graduated curve based on worst anchor distance

### Key Architecture Decisions

1. **ElevenLabs = Voice I/O only** — Calls ONE tool: `process_input`
2. **Leo Brain = Orchestrator** — Gemini + function calling for all reasoning
3. **10 Tools** — Full heatmap personalization stack
4. **0-10 Scoring** — Per H3 hex, combining 3 layers
5. **Data sources** — 741k POIs in DynamoDB, SERP in 78 barrios
6. **Real-time updates** — WebSocket pushes while user hears response
7. **Cost** — ~$0.03-0.05 per intake call
