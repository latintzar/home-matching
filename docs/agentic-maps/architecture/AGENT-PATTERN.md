---
status: design
last_updated: 2024-12-12
---

# Agent Architecture

> How the AI agent classifies queries, orchestrates tools, and generates responses.

## Overview

The Agentic Maps system uses a **tool-calling architecture** where a central AI orchestrator (Gemini 2.5 Flash) understands user intent and invokes specialized tools to gather data and generate responses.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER QUERY                                        │
│                    "pub crawl in Dublin"                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI ORCHESTRATOR (Gemini 2.5 Flash)                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. Understand intent                                                       │
│  2. Classify into scenario (1-7)                                            │
│  3. Determine required tools                                                │
│  4. Execute tool calls                                                      │
│  5. Synthesize response                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│   DATA TOOLS    │      │  GEOSPATIAL TOOLS   │      │   AI TOOLS      │
│  ─────────────  │      │  ─────────────────  │      │  ─────────────  │
│  • ScrapingDog  │      │  • Mapbox Geocode   │      │  • Gemini Pro   │
│  • GMaps Search │      │  • Mapbox Matrix    │      │    + Grounding  │
│  • GMaps Reviews│      │  • Mapbox Directions│      │  • Gemini Lite  │
│                 │      │  • Geoapify Iso     │      │    (curation)   │
│                 │      │  • Turf.js (local)  │      │                 │
└─────────────────┘      └─────────────────────┘      └─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE SYNTHESIS                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Combine tool results                                                     │
│  • Generate natural language explanation                                    │
│  • Format for UI (areas, places, routes)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Query Classification

### The Classifier

```typescript
interface ClassificationResult {
  scenario: ScenarioType;
  confidence: number;
  
  // Extracted entities
  city?: string;
  cities?: string[];           // For multi-city routes
  origins?: string[];          // For meet-in-middle scenarios
  
  // Intent details
  placeType?: string;          // "bar", "restaurant", "cafe"
  vibe?: string;               // "romantic", "lively", "quiet"
  occasion?: string;           // "date", "business", "friends"
  
  // Route-specific
  stops?: number;
  mixRatio?: number;           // For multi-stop
}

type ScenarioType = 
  | 'things-to-do'             // Scenario 1
  | 'where-to-stay'            // Scenario 2
  | 'stay-and-do'              // Scenario 3
  | 'single-place'             // Scenario 4
  | 'meet-in-middle'           // Scenario 5
  | 'areas-to-explore'         // Scenario 6
  | 'multi-stop-route';        // Scenario 7
```

### Classification Prompt

```typescript
const classificationPrompt = `
You are a travel planning assistant. Classify the user's query into one of these scenarios:

1. things-to-do: Looking for activities/areas in ONE city
   Example: "cool bars in Barcelona"

2. where-to-stay: Looking for accommodation areas in ONE city
   Example: "where should I stay in Tokyo"

3. stay-and-do: Planning a trip with both stay and activities
   Example: "weekend in Paris"

4. single-place: Looking for ONE specific venue
   Example: "best ramen near Shibuya"

5. meet-in-middle: Finding a place between MULTIPLE PEOPLE
   Example: "coffee between Shoreditch and Camden"

6. areas-to-explore: Finding AREAS for multiple people to meet
   Example: "neighborhoods to explore together"

7. multi-stop-route: Planning a ROUTE with multiple stops
   Example: "pub crawl in Dublin" or "road trip to Valencia"

User query: "${query}"

Return JSON:
{
  "scenario": "...",
  "confidence": 0.0-1.0,
  "city": "...",
  "cities": [...],
  "origins": [...],
  "placeType": "...",
  "vibe": "...",
  "occasion": "...",
  "stops": N
}
`;
```

### Classification Decision Tree

```
Is there more than one origin/person?
├── YES: Is it looking for a SPECIFIC place?
│   ├── YES → meet-in-middle (5)
│   └── NO → areas-to-explore (6)
└── NO: Is it a multi-stop journey?
    ├── YES → multi-stop-route (7)
    └── NO: Is it about accommodation?
        ├── YES: Also about activities?
        │   ├── YES → stay-and-do (3)
        │   └── NO → where-to-stay (2)
        └── NO: Is it for a SPECIFIC venue?
            ├── YES → single-place (4)
            └── NO → things-to-do (1)
```

## Tool Definitions

### Available Tools

```typescript
const tools = [
  {
    name: 'generateVibeAreas',
    description: 'Generate neighborhood recommendations using AI with Google Search grounding',
    parameters: {
      city: 'string',
      vibe: 'string',
      count: 'number',
      type: '"activity" | "stay"'
    }
  },
  {
    name: 'searchPlaces',
    description: 'Search for specific places using ScrapingDog Google Search',
    parameters: {
      query: 'string',
      location: 'string'
    }
  },
  {
    name: 'getPlaceDetails',
    description: 'Get detailed information about a place from Google Maps',
    parameters: {
      placeName: 'string',
      location: 'string'
    }
  },
  {
    name: 'getPlaceReviews',
    description: 'Get reviews for a specific place',
    parameters: {
      placeId: 'string'
    }
  },
  {
    name: 'geocodeLocation',
    description: 'Convert a location name to coordinates',
    parameters: {
      location: 'string'
    }
  },
  {
    name: 'getIsochrone',
    description: 'Get reachable area polygon for a location and travel time',
    parameters: {
      coordinates: '[number, number]',
      mode: '"walk" | "transit" | "drive"',
      minutes: 'number'
    }
  },
  {
    name: 'computeIntersection',
    description: 'Compute intersection of multiple polygons',
    parameters: {
      polygons: 'GeoJSON.Polygon[]'
    }
  },
  {
    name: 'getRouteMatrix',
    description: 'Get travel times between multiple points',
    parameters: {
      coordinates: '[number, number][]',
      mode: '"walking" | "driving"'
    }
  },
  {
    name: 'getDirections',
    description: 'Get turn-by-turn directions between two points',
    parameters: {
      origin: '[number, number]',
      destination: '[number, number]',
      mode: '"walking" | "driving"'
    }
  },
  {
    name: 'curateResults',
    description: 'Use AI to select best option from candidates',
    parameters: {
      candidates: 'any[]',
      criteria: 'string'
    }
  }
];
```

## Tool Selection by Scenario

| Scenario | Required Tools |
|----------|---------------|
| 1. Things to Do | `generateVibeAreas` |
| 2. Where to Stay | `generateVibeAreas` (type: stay) |
| 3. Stay + Do | `generateVibeAreas` (×2) |
| 4. Single Place | `searchPlaces` → `getPlaceDetails` → `getPlaceReviews` → `curateResults` |
| 5. Meet in Middle | `geocodeLocation` → `getIsochrone` → `computeIntersection` → `searchPlaces` → `curateResults` |
| 6. Areas to Explore | `geocodeLocation` → `getIsochrone` (×6) → `computeIntersection` → `generateVibeAreas` → `getDirections` |
| 7. Multi-Stop | Mixed based on ratio + `getRouteMatrix` + `getDirections` |

## Agentic Loop

```typescript
const agenticLoop = async (query: string) => {
  // Step 1: Classify
  const classification = await classifyQuery(query);
  
  // Step 2: Plan tool calls
  const toolPlan = planToolCalls(classification);
  
  // Step 3: Execute tools (potentially multiple rounds)
  let context = {};
  for (const step of toolPlan) {
    const results = await executeToolBatch(step.tools, context);
    context = { ...context, ...results };
    
    // Check if we need user input
    if (step.requiresUserInput) {
      return { type: 'clarification', question: step.question, partialResults: context };
    }
  }
  
  // Step 4: Synthesize response
  const response = await synthesizeResponse(classification, context);
  
  return { type: 'complete', response };
};
```

## Streaming Response

Use Server-Sent Events for real-time updates:

```typescript
// API Route: /api/vibe-maps/query
export async function POST(req: Request) {
  const { query, chatId } = await req.json();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      
      // Classification
      send('status', { step: 'classifying' });
      const classification = await classifyQuery(query);
      send('classification', classification);
      
      // Tool execution
      send('status', { step: 'gathering_data' });
      const toolResults = await executeTools(classification);
      
      // Stream partial results as they come in
      for await (const result of toolResults) {
        send('tool_result', result);
      }
      
      // Final synthesis
      send('status', { step: 'synthesizing' });
      const response = await synthesize(classification, toolResults);
      send('complete', response);
      
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

## Client-Side Consumption

```typescript
const useAgenticQuery = () => {
  const [status, setStatus] = useState<'idle' | 'classifying' | 'gathering' | 'complete'>('idle');
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [results, setResults] = useState<any>(null);
  
  const query = async (text: string) => {
    setStatus('classifying');
    
    const response = await fetch('/api/vibe-maps/query', {
      method: 'POST',
      body: JSON.stringify({ query: text })
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const events = parseSSE(text);
      
      for (const event of events) {
        switch (event.type) {
          case 'classification':
            setClassification(event.data);
            break;
          case 'status':
            setStatus(event.data.step);
            break;
          case 'complete':
            setResults(event.data);
            setStatus('complete');
            break;
        }
      }
    }
  };
  
  return { query, status, classification, results };
};
```

## Error Handling

```typescript
const handleToolError = async (error: Error, tool: string, context: any) => {
  // Log for debugging
  console.error(`Tool ${tool} failed:`, error);
  
  // Graceful degradation
  switch (tool) {
    case 'getPlaceReviews':
      // Continue without reviews
      return { reviews: [], warning: 'Reviews unavailable' };
      
    case 'getIsochrone':
      // Fall back to Turf.js circle approximation
      return approximateIsochrone(context);
      
    case 'searchPlaces':
      // Try alternative search
      return fallbackSearch(context);
      
    default:
      throw error;
  }
};
```

## Caching Strategy

```typescript
// Cache keys by scenario
const getCacheKey = (classification: ClassificationResult): string => {
  switch (classification.scenario) {
    case 'things-to-do':
    case 'where-to-stay':
      return `areas:${classification.city}:${classification.vibe}`;
      
    case 'single-place':
      return `place:${classification.city}:${classification.placeType}:${classification.vibe}`;
      
    default:
      return null; // Don't cache dynamic queries
  }
};

// Cache durations
const CACHE_TTL = {
  areas: 7 * 24 * 60 * 60,      // 7 days for area recommendations
  places: 24 * 60 * 60,         // 1 day for place details
  routes: 60 * 60,              // 1 hour for route calculations
};
```

---

[Back to Index](../AGENTIC_MAPS.md) | [Chat UI →](CHAT-UI.md)
