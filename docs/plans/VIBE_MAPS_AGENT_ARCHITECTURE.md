# ⚠️ SUPERSEDED

> **This document has been consolidated into the unified Agentic Maps documentation.**
>
> **New location**: [`/docs/agentic-maps/AGENTIC_MAPS.md`](../agentic-maps/AGENTIC_MAPS.md)
>
> Content from this document has been migrated to:
> - [`architecture/AGENT-PATTERN.md`](../agentic-maps/architecture/AGENT-PATTERN.md)
> - [`architecture/CHAT-UI.md`](../agentic-maps/architecture/CHAT-UI.md)
> - All 7 scenario files in `scenarios/`

---

# Vibe Maps - AI Agent Architecture

> **Status**: Superseded → See `docs/agentic-maps/`  
> **Created**: December 2024  
> **Location**: `/src/app/vibe-maps/`

---

## Overview

This document describes the architecture for an AI agent that can handle multiple types of travel queries through a unified tool-calling interface. The pattern follows modern best practices used by **Cursor**, **Lovable**, **Vercel AI SDK**, and **OpenAI Assistants**.

### Supported Query Types

| Query Type | Description | Example |
|------------|-------------|---------|
| **Neighborhoods (Activities)** | Find areas for things to do | "Best bars in Berlin tonight" |
| **Neighborhoods (Stay)** | Find areas to book accommodation | "Where to stay in Tokyo" |
| **Neighborhoods (Stay + Activities)** | Trip planning with both | "Romantic weekend in Paris" |
| **Road Trip** | Scenic driving routes with POIs | "Barcelona to Valencia coastal drive" |
| **Ambiguous** | Needs clarification | "Barcelona" |

---

## Core Pattern: Agentic Tool Calling

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│        "Scenic road trip Barcelona to Valencia"                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR                            │
│                                                                 │
│  System Prompt:                                                 │
│  "You are Leo, a travel assistant. You have access to tools    │
│   for finding neighborhoods, planning routes, and more.         │
│   Analyze the user's request and use the appropriate tools."   │
│                                                                 │
│  Available Tools:                                               │
│  • classify_intent          • find_pois_in_corridor            │
│  • ask_clarification        • score_routes                     │
│  • generate_vibe_areas      • display_on_map                   │
│  • get_mapbox_routes        • respond_to_user                  │
│  • analyze_route_scenic                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC LOOP                                  │
│                                                                 │
│  while (!done) {                                                │
│    response = await gemini.generateContent({                    │
│      messages,                                                  │
│      tools,                                                     │
│    });                                                          │
│                                                                 │
│    if (response.has_tool_calls) {                              │
│      for (call of response.tool_calls) {                       │
│        result = await execute_tool(call);                      │
│        messages.push({ role: 'tool', content: result });       │
│      }                                                          │
│    } else {                                                     │
│      done = true;  // AI finished, show response               │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Single Entry Point**: All queries go through the same agent endpoint
2. **Tool-Based Routing**: AI decides which tools to call based on query
3. **Iterative Execution**: Agent loops until it has a final response
4. **Streaming Updates**: Client sees tool calls and results in real-time
5. **State Synchronization**: Tool results update both AI context AND UI

---

## Tool Definitions

### 1. Classification Tool

```typescript
{
  name: "classify_intent",
  description: "Classify what the user is looking for. Call this FIRST for any new request.",
  parameters: {
    query: { 
      type: "string", 
      description: "The user's request" 
    }
  },
  returns: {
    type: "'neighborhood' | 'road_trip' | 'ambiguous'",
    city_known: "boolean",
    city_name: "string | null",
    city_lat: "number | null",
    city_lng: "number | null",
    from_city: "string | null",        // For road trips
    to_city: "string | null",          // For road trips
    needs_clarification: "boolean",
    missing_info: "string[]"           // What info is missing
  }
}
```

### 2. Clarification Tool

```typescript
{
  name: "ask_clarification",
  description: "Ask the user a clarifying question. Use when intent or location is unclear.",
  parameters: {
    question: { 
      type: "string", 
      description: "The question to ask" 
    },
    options: { 
      type: "array", 
      description: "Clickable options for the user",
      items: { 
        label: "string",   // Display text
        value: "string",   // Value sent back
        emoji: "string"    // Icon
      }
    }
  }
}
```

### 3. Neighborhood Generation Tool

```typescript
{
  name: "generate_vibe_areas",
  description: "Generate neighborhood recommendations for a city. Uses Google Search grounding.",
  parameters: {
    city: { 
      type: "string", 
      description: "The city to search in" 
    },
    mode: { 
      type: "string",
      enum: ["activities", "stay", "stay+activities"],
      description: "What type of areas to find"
    },
    trip_context: { 
      type: "string", 
      description: "User's trip description for context" 
    },
    preferences: { 
      type: "object",
      description: "Optional preferences (budget, style, etc.)"
    }
  },
  returns: {
    stay_areas: "VibeArea[]",      // 0-2 areas if mode includes 'stay'
    activity_areas: "VibeArea[]"   // 3-5 areas if mode includes 'activities'
  }
}
```

**VibeArea Schema:**
```typescript
interface VibeArea {
  name: string;           // "Gothic Quarter"
  lat: number;            // 41.3833
  lng: number;            // 2.1761
  radius: number;         // 400 (meters)
  color: string;          // "#FF6B6B"
  category: "stay" | "activity";
  why: string;            // Max 140 chars, punchy description
  itinerary: {
    purpose: string;      // "🍽️ Dinner"
    query: string;        // "tapas bars gothic quarter"
  }[];
  grounded: boolean;      // Was Google Search used?
}
```

### 4. Route Generation Tool

```typescript
{
  name: "get_routes",
  description: "Get driving routes between two points from Mapbox Directions API.",
  parameters: {
    from_city: { 
      type: "string", 
      description: "Starting city" 
    },
    to_city: { 
      type: "string", 
      description: "Destination city" 
    },
    avoid: { 
      type: "array",
      items: { type: "string" },
      description: "Things to avoid: 'motorway', 'toll', 'ferry'"
    },
    alternatives: { 
      type: "boolean", 
      default: true,
      description: "Request alternative routes"
    }
  },
  returns: {
    routes: "Route[]",           // Up to 3 routes
    from_coords: "[lng, lat]",
    to_coords: "[lng, lat]"
  }
}
```

**Route Schema:**
```typescript
interface Route {
  index: number;
  geometry: GeoJSON.LineString;
  distance_km: number;
  duration_hours: number;
  waypoints: [number, number][];
}
```

### 5. Route Analysis Tool

```typescript
{
  name: "analyze_route_scenic",
  description: "Analyze a route for scenic features using Turf.js. Creates a corridor and checks terrain.",
  parameters: {
    route_index: { 
      type: "number", 
      description: "Which route to analyze (0-based)" 
    },
    corridor_km: { 
      type: "number", 
      default: 5,
      description: "Width of corridor to analyze (km each side)"
    }
  },
  returns: {
    distance_km: "number",
    duration_hours: "number",
    detour_percent: "number",      // vs direct route
    coastal_segments_km: "number",
    mountain_segments_km: "number",
    scenic_score: "number",        // 1-10
    highlights: "string[]"         // Key features
  }
}
```

### 6. POI Discovery Tool

```typescript
{
  name: "find_pois_in_corridor",
  description: "Find points of interest within a route corridor using local OSM data.",
  parameters: {
    route_index: { 
      type: "number", 
      description: "Which route to search around" 
    },
    poi_types: { 
      type: "array",
      items: { type: "string" },
      description: "Types to find: 'beach', 'viewpoint', 'castle', 'restaurant', 'winery', etc."
    },
    max_per_type: {
      type: "number",
      default: 5,
      description: "Maximum POIs to return per type"
    }
  },
  returns: {
    pois: "POI[]",
    count_by_type: "Record<string, number>"
  }
}
```

**POI Schema:**
```typescript
interface POI {
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance_from_route_km: number;
  description?: string;
  rating?: number;
}
```

### 7. Route Scoring Tool

```typescript
{
  name: "score_and_describe_routes",
  description: "Generate human-readable descriptions and scores for routes based on analysis.",
  parameters: {
    user_preferences: { 
      type: "string", 
      description: "What the user is looking for" 
    },
    routes_with_analysis: { 
      type: "array",
      description: "Routes with their scenic analysis and POIs"
    }
  },
  returns: {
    scored_routes: "ScoredRoute[]"
  }
}
```

**ScoredRoute Schema:**
```typescript
interface ScoredRoute {
  index: number;
  name: string;               // "Coastal Paradise"
  score: number;              // 9.2
  description: string;        // "Hugs the Mediterranean coast with stunning views..."
  highlights: string[];       // ["17 beaches", "3 historic towns", "Coastal cliffs"]
  recommended_stops: POI[];   // Top POIs to visit
  estimated_time: string;     // "4-5 hours with stops"
  best_for: string;           // "Beach lovers, photographers"
}
```

### 8. Map Control Tools

```typescript
{
  name: "zoom_to_location",
  description: "Update the map view to center on a location.",
  parameters: {
    lat: { type: "number" },
    lng: { type: "number" },
    zoom: { type: "number", default: 12 }
  }
}

{
  name: "zoom_to_fit_bounds",
  description: "Fit the map to show all items within bounds.",
  parameters: {
    bounds: {
      type: "object",
      properties: {
        minLng: { type: "number" },
        minLat: { type: "number" },
        maxLng: { type: "number" },
        maxLat: { type: "number" }
      }
    }
  }
}

{
  name: "display_areas_on_map",
  description: "Render vibe circles on the map.",
  parameters: {
    areas: { type: "array", items: "VibeArea" }
  }
}

{
  name: "display_routes_on_map",
  description: "Render route lines on the map with colors.",
  parameters: {
    routes: { type: "array", items: "ScoredRoute" }
  }
}
```

---

## Example Agent Traces

### Trace A: Clear Neighborhood Query

```
User: "Best bars in Berlin tonight"

┌────────────────────────────────────────────────────────┐
│ Step 1: Classify                                       │
├────────────────────────────────────────────────────────┤
│ → classify_intent({ query: "Best bars in Berlin..." })│
│ ← {                                                    │
│     type: "neighborhood",                              │
│     city_known: true,                                  │
│     city_name: "Berlin",                               │
│     city_lat: 52.52,                                   │
│     city_lng: 13.405,                                  │
│     needs_clarification: false                         │
│   }                                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 2: Zoom to city                                   │
├────────────────────────────────────────────────────────┤
│ → zoom_to_location({ lat: 52.52, lng: 13.405, zoom: 12 })
│ ← { success: true }                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 3: Generate areas                                 │
├────────────────────────────────────────────────────────┤
│ → generate_vibe_areas({                                │
│     city: "Berlin",                                    │
│     mode: "activities",                                │
│     trip_context: "nightlife, bars, tonight"           │
│   })                                                   │
│ ← {                                                    │
│     activity_areas: [                                  │
│       { name: "Kreuzberg", lat: 52.49, ... },         │
│       { name: "Friedrichshain", lat: 52.51, ... },    │
│       { name: "Neukölln", lat: 52.48, ... },          │
│       { name: "Prenzlauer Berg", lat: 52.54, ... },   │
│       { name: "Mitte", lat: 52.52, ... }              │
│     ]                                                  │
│   }                                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 4: Display on map                                 │
├────────────────────────────────────────────────────────┤
│ → display_areas_on_map({ areas: activity_areas })     │
│ ← { success: true, displayed: 5 }                      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 5: Final response (no tool call)                  │
├────────────────────────────────────────────────────────┤
│ AI: "Here are 5 great neighborhoods for bars in        │
│      Berlin tonight! 🍺 Kreuzberg is legendary for     │
│      its alternative scene..."                         │
└────────────────────────────────────────────────────────┘
```

### Trace B: Road Trip Query

```
User: "Scenic road trip Barcelona to Valencia, avoid highways"

┌────────────────────────────────────────────────────────┐
│ Step 1: Classify                                       │
├────────────────────────────────────────────────────────┤
│ → classify_intent({ query: "Scenic road trip..." })   │
│ ← {                                                    │
│     type: "road_trip",                                 │
│     from_city: "Barcelona",                            │
│     to_city: "Valencia",                               │
│     needs_clarification: false                         │
│   }                                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 2: Get routes from Mapbox                         │
├────────────────────────────────────────────────────────┤
│ → get_routes({                                         │
│     from_city: "Barcelona",                            │
│     to_city: "Valencia",                               │
│     avoid: ["motorway"],                               │
│     alternatives: true                                 │
│   })                                                   │
│ ← {                                                    │
│     routes: [route1, route2, route3],                  │
│     from_coords: [2.17, 41.38],                        │
│     to_coords: [-0.37, 39.47]                          │
│   }                                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 3: Analyze routes (PARALLEL)                      │
├────────────────────────────────────────────────────────┤
│ → analyze_route_scenic({ route_index: 0 })            │
│ → analyze_route_scenic({ route_index: 1 })            │
│ → analyze_route_scenic({ route_index: 2 })            │
│ ← [analysis0, analysis1, analysis2]                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 4: Find POIs (PARALLEL)                           │
├────────────────────────────────────────────────────────┤
│ → find_pois_in_corridor({                              │
│     route_index: 0,                                    │
│     poi_types: ["beach", "viewpoint", "castle", ...]   │
│   })                                                   │
│ → find_pois_in_corridor({ route_index: 1, ... })      │
│ → find_pois_in_corridor({ route_index: 2, ... })      │
│ ← [pois0, pois1, pois2]                                │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 5: Score and describe                             │
├────────────────────────────────────────────────────────┤
│ → score_and_describe_routes({                          │
│     user_preferences: "scenic, avoid highways",        │
│     routes_with_analysis: [...]                        │
│   })                                                   │
│ ← {                                                    │
│     scored_routes: [                                   │
│       { name: "Coastal Paradise", score: 9.2, ... },  │
│       { name: "Mountain Pass", score: 7.8, ... },     │
│       { name: "Inland Express", score: 6.5, ... }     │
│     ]                                                  │
│   }                                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 6: Display on map                                 │
├────────────────────────────────────────────────────────┤
│ → display_routes_on_map({ routes: scored_routes })    │
│ → zoom_to_fit_bounds({ bounds: route_bounds })        │
│ ← { success: true }                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 7: Final response                                 │
├────────────────────────────────────────────────────────┤
│ AI: "I found 3 scenic routes avoiding highways! 🚗     │
│                                                        │
│      🏆 Coastal Paradise (9.2/10)                      │
│      Hugs the Mediterranean coast with 17 beaches,    │
│      passing through charming towns like Sitges and   │
│      Peñíscola. Best for: beach lovers, photographers │
│      ⏱️ 5-6 hours with stops                           │
│                                                        │
│      🏔️ Mountain Pass (7.8/10)                         │
│      Winds through the Maestrazgo mountains with      │
│      stunning viewpoints and medieval castles.        │
│      Best for: adventure seekers, history buffs       │
│      ⏱️ 6-7 hours with stops                           │
│                                                        │
│      Click on a route to see recommended stops!"       │
└────────────────────────────────────────────────────────┘
```

### Trace C: Ambiguous Query (Needs Clarification)

```
User: "Barcelona"

┌────────────────────────────────────────────────────────┐
│ Step 1: Classify                                       │
├────────────────────────────────────────────────────────┤
│ → classify_intent({ query: "Barcelona" })             │
│ ← {                                                    │
│     type: "ambiguous",                                 │
│     city_known: true,                                  │
│     city_name: "Barcelona",                            │
│     city_lat: 41.38,                                   │
│     city_lng: 2.17,                                    │
│     needs_clarification: true,                         │
│     missing_info: ["intent"]                           │
│   }                                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 2: Zoom to city anyway (give context)             │
├────────────────────────────────────────────────────────┤
│ → zoom_to_location({ lat: 41.38, lng: 2.17, zoom: 12 })
│ ← { success: true }                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Step 3: Ask for clarification                          │
├────────────────────────────────────────────────────────┤
│ → ask_clarification({                                  │
│     question: "What are you looking for in Barcelona?",│
│     options: [                                         │
│       { label: "Things to do", value: "activities",    │
│         emoji: "🎉" },                                 │
│       { label: "Where to stay", value: "stay",         │
│         emoji: "🏨" },                                 │
│       { label: "Both (trip planning)",                 │
│         value: "stay+activities", emoji: "✈️" },       │
│       { label: "Road trip from here",                  │
│         value: "road_trip_from", emoji: "🚗" }         │
│     ]                                                  │
│   })                                                   │
│ ← { paused: true }                                     │
└────────────────────────────────────────────────────────┘

... Agent pauses, waiting for user response ...

User clicks: "🎉 Things to do"

┌────────────────────────────────────────────────────────┐
│ Step 4: Continue with user's choice                    │
├────────────────────────────────────────────────────────┤
│ → generate_vibe_areas({                                │
│     city: "Barcelona",                                 │
│     mode: "activities",                                │
│     trip_context: "things to do"                       │
│   })                                                   │
│ ← { activity_areas: [...] }                            │
└────────────────────────────────────────────────────────┘

... continues as Trace A ...
```

---

## File Structure

```
/src/app/vibe-maps/
├── page.tsx                         # Main page component
├── components/
│   ├── ChatSidebar.tsx              # Left panel chat UI
│   ├── MessageList.tsx              # Chat messages
│   ├── AssistantMessage.tsx         # AI message with options
│   ├── UserMessage.tsx              # User message
│   ├── OptionButtons.tsx            # Clickable clarification options
│   ├── MapContainer.tsx             # Mapbox map wrapper
│   ├── VibeCircles.tsx              # Circle layers for neighborhoods
│   ├── RouteLines.tsx               # Line layers for routes
│   ├── InfoCard.tsx                 # Area/route detail cards
│   ├── CategorySelector.tsx         # Stay vs Activities tabs
│   └── ThinkingIndicator.tsx        # "Leo is thinking..." UI
├── hooks/
│   └── useVibeAgent.ts              # Agent state management hook
└── types.ts                         # TypeScript types

/src/app/api/vibe-maps/
└── agent/
    └── route.ts                     # Streaming agent endpoint

/src/lib/vibe-maps/
├── agent.ts                         # Core agent loop logic
├── tool-executor.ts                 # Tool execution dispatcher
├── prompts.ts                       # System prompts
└── tools/
    ├── classify-intent.ts           # Query classification
    ├── ask-clarification.ts         # Clarification handler
    ├── generate-areas.ts            # Neighborhood generation (Gemini)
    ├── get-routes.ts                # Mapbox Directions API
    ├── analyze-scenic.ts            # Turf.js route analysis
    ├── find-pois.ts                 # OSM POI lookup
    ├── score-routes.ts              # Route scoring (Gemini)
    └── map-actions.ts               # Map control tools
```

---

## API Endpoint Design

### Request

```typescript
POST /api/vibe-maps/agent

{
  messages: [
    { role: "user", content: "Scenic road trip Barcelona to Valencia" },
    { role: "assistant", content: "..." },
    // ... conversation history
  ],
  mapState: {
    viewState: { lat: 41.38, lng: 2.17, zoom: 12 },
    areas: [],      // Current displayed areas
    routes: []      // Current displayed routes
  }
}
```

### Response (Server-Sent Events)

```typescript
// Streaming response format
data: { type: "thinking", step: 1 }

data: { type: "tool_call", tool: "classify_intent", args: { query: "..." } }

data: { type: "tool_result", tool: "classify_intent", result: { type: "road_trip", ... } }

data: { type: "tool_call", tool: "get_routes", args: { from_city: "Barcelona", ... } }

data: { type: "tool_result", tool: "get_routes", result: { routes: [...] } }

// ... more tool calls ...

data: { type: "map_update", action: "display_routes", payload: { routes: [...] } }

data: { type: "response", text: "I found 3 scenic routes! ..." }

data: { type: "done" }
```

---

## Client-Side Hook

```typescript
// /src/app/vibe-maps/hooks/useVibeAgent.ts

interface AgentState {
  messages: Message[];
  areas: VibeArea[];
  routes: ScoredRoute[];
  mapView: { lat: number; lng: number; zoom: number };
  isThinking: boolean;
  currentTool: string | null;
  mode: 'idle' | 'neighborhood' | 'road_trip';
}

interface UseVibeAgentReturn extends AgentState {
  sendMessage: (content: string) => Promise<void>;
  selectOption: (value: string) => Promise<void>;
  selectArea: (index: number) => void;
  selectRoute: (index: number) => void;
}

export function useVibeAgent(): UseVibeAgentReturn {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [areas, setAreas] = useState<VibeArea[]>([]);
  const [routes, setRoutes] = useState<ScoredRoute[]>([]);
  const [mapView, setMapView] = useState({ lat: 0, lng: 0, zoom: 2 });
  const [isThinking, setIsThinking] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'neighborhood' | 'road_trip'>('idle');
  
  const sendMessage = async (content: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsThinking(true);
    
    // Stream from agent endpoint
    const response = await fetch('/api/vibe-maps/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...messages, { role: 'user', content }],
        mapState: { viewState: mapView, areas, routes }
      })
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const events = text.split('\n\n').filter(Boolean);
      
      for (const event of events) {
        if (!event.startsWith('data: ')) continue;
        const data = JSON.parse(event.slice(6));
        
        switch (data.type) {
          case 'thinking':
            setIsThinking(true);
            break;
            
          case 'tool_call':
            setCurrentTool(data.tool);
            break;
            
          case 'tool_result':
            // Handle tool results that affect UI
            handleToolResult(data.tool, data.result);
            break;
            
          case 'map_update':
            handleMapUpdate(data.action, data.payload);
            break;
            
          case 'response':
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: data.text 
            }]);
            setIsThinking(false);
            setCurrentTool(null);
            break;
            
          case 'done':
            setIsThinking(false);
            break;
        }
      }
    }
  };
  
  const handleToolResult = (tool: string, result: unknown) => {
    if (tool === 'ask_clarification') {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.question,
        options: result.options
      }]);
    } else if (tool === 'classify_intent') {
      if (result.type === 'neighborhood') setMode('neighborhood');
      else if (result.type === 'road_trip') setMode('road_trip');
    }
  };
  
  const handleMapUpdate = (action: string, payload: unknown) => {
    switch (action) {
      case 'zoom_to_location':
        setMapView(payload);
        break;
      case 'display_areas':
        setAreas(payload.areas);
        break;
      case 'display_routes':
        setRoutes(payload.routes);
        break;
    }
  };
  
  const selectOption = async (value: string) => {
    await sendMessage(value);
  };
  
  return {
    messages,
    areas,
    routes,
    mapView,
    isThinking,
    currentTool,
    mode,
    sendMessage,
    selectOption,
    selectArea: (i) => { /* ... */ },
    selectRoute: (i) => { /* ... */ }
  };
}
```

---

## System Prompt

```typescript
const SYSTEM_PROMPT = `You are Leo, an intelligent travel assistant that helps people discover amazing places.

You have access to tools that let you:
1. Understand what users want (classify their intent)
2. Ask clarifying questions when needed
3. Find the best neighborhoods for activities or staying
4. Plan scenic road trips with routes and points of interest
5. Control what's displayed on the map

## Guidelines

1. **Always classify first**: For new requests, use classify_intent to understand what the user wants.

2. **Be proactive**: If you can determine what they want, proceed without asking unnecessary questions.

3. **Ask when needed**: If the request is ambiguous, use ask_clarification with clear, helpful options.

4. **Show your work**: Update the map as you go so users see progress.

5. **Be enthusiastic**: You love travel and want to help people have amazing experiences!

## Tool Usage

- For NEIGHBORHOOD queries: classify → zoom_to_location → generate_vibe_areas → display_areas_on_map
- For ROAD TRIP queries: classify → get_routes → analyze_route_scenic (parallel) → find_pois_in_corridor (parallel) → score_and_describe_routes → display_routes_on_map
- For AMBIGUOUS queries: classify → zoom_to_location → ask_clarification → (wait for user) → continue

## Response Style

- Keep final responses concise but informative
- Use emojis to add personality 🎉
- Highlight the best options first
- Mention specific features that match the user's request
- Invite interaction ("Click on a circle to explore!")
`;
```

---

## Model Selection

| Operation | Model | Why |
|-----------|-------|-----|
| Classification | `gemini-2.5-flash` | Fast, cheap, good at structured output |
| Generate Areas | `gemini-2.5-pro` + Grounding | Needs web search for accurate locations |
| Score Routes | `gemini-2.5-pro` | Complex reasoning about preferences |
| Tool Orchestration | `gemini-2.5-flash` | Fast for tool calling loop |

---

## Road Trip Planning: Detailed Process

This section describes the intelligent road trip planning process that uses the Mapbox Matrix API for accurate timing calculations.

### Why Matrix API is Essential

Gemini **cannot** estimate driving times between arbitrary POIs. For accurate, exportable routes, we need real driving times. The Mapbox Matrix API computes many-to-many driving times in a single request.

### The Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: GATHER CONSTRAINTS (Chat with User)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Questions to determine corridor width and time budget:                     │
│                                                                             │
│  • "When are you leaving?" → Departure time                                 │
│  • "When do you need to arrive?" → Arrival deadline                        │
│  • "Any time for stops, or direct drive?" → Time budget for exploration    │
│                                                                             │
│  Example: Leaving 9 AM, arrive by 6 PM = 9 hours total                     │
│  Fastest route: 3h 15min → Up to 5h 45min for stops/exploration            │
│                                                                             │
│  This determines how wide a corridor we can consider!                       │
│  Tight schedule = stay close to direct route                               │
│  Lots of time = can consider bigger detours                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: ESTABLISH BASELINE (1 Mapbox Directions call)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Get fastest route + alternatives:                                          │
│                                                                             │
│  Barcelona ════════════════════════════════════════════► Valencia           │
│  Fastest: 3h 15min, 350km (the "yard stick")                               │
│                                                                             │
│  This tells us:                                                             │
│  • Minimum driving time (baseline)                                          │
│  • Maximum detour tolerance (50% = 1h 37min extra = ~5h total driving)     │
│  • Corridor geometry for POI search                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: DISCOVER POTENTIAL STOP AREAS (FREE - Local Turf.js + OSM)         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Based on time budget, determine corridor width:                            │
│  • Tight schedule: 5km corridor                                             │
│  • Moderate time: 15km corridor                                             │
│  • Lots of time: 30km corridor                                              │
│                                                                             │
│  Find interesting AREAS (not specific restaurants):                         │
│  • 🏖️ Coastal towns (Sitges, Tarragona, Peñíscola)                          │
│  • 🏔️ Mountain villages (Morella, Maestrazgo)                               │
│  • 🏛️ Historic centers (Roman Tarragona, Medieval Peñíscola)               │
│  • 👀 Scenic viewpoints (Costa Daurada lookouts)                            │
│  • 🍷 Wine regions (Penedès, Terra Alta)                                    │
│                                                                             │
│  Filter to ~10 most promising areas based on user preferences               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: BUILD TIME MATRIX (1 Mapbox Matrix call)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  10 locations = 10 × 10 = 100 elements                                      │
│  Cost: 100 × $0.002 = $0.20                                                 │
│                                                                             │
│          │ Start │Sitges│Tarrago│Morella│Peñísc│ End  │                    │
│  ────────┼───────┼──────┼───────┼───────┼──────┼──────┤                    │
│  Start   │   0   │  45m │  1h20 │ 2h30  │ 2h45 │ 3h15 │                    │
│  Sitges  │  45m  │   0  │  52m  │ 2h15  │ 2h20 │ 2h50 │                    │
│  Tarrago │ 1h20  │  52m │   0   │ 1h45  │ 1h38 │ 2h00 │                    │
│  Morella │ 2h30  │ 2h15 │  1h45 │   0   │  55m │ 1h30 │                    │
│  Peñísc  │ 2h45  │ 2h20 │  1h38 │  55m  │   0  │  45m │                    │
│  End     │ 3h15  │ 2h50 │  2h00 │ 1h30  │  45m │   0  │                    │
│                                                                             │
│  NOW Gemini has REAL data to work with!                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: AI ROUTE ARCHITECT (1 Gemini call)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Gemini receives:                                                           │
│  • Full time matrix (actual driving minutes)                               │
│  • User constraints (departure, arrival, lunch window, siesta, etc.)       │
│  • Area descriptions (what's interesting about each)                       │
│  • User preferences ("scenic coastal", "family-friendly", etc.)            │
│                                                                             │
│  Gemini calculates (with REAL times):                                       │
│                                                                             │
│  OPTION 1: "Coastal Explorer"                                               │
│  Start(9:00) → Sitges(9:45, 1h stop) → Tarragona(11:37, lunch 12-2) →      │
│  Peñíscola(3:38, 30m stop) → End(4:23)                                     │
│  Total driving: 3h 23min ✓ Total time: 7h 23min ✓                          │
│                                                                             │
│  OPTION 2: "Mountain & Coast"                                               │
│  Start(9:00) → Tarragona(10:20, 1h) → Morella(1:05, lunch) →               │
│  Peñíscola(3:00, 30m) → End(4:15)                                          │
│  Total driving: 4h 15min ✓ Total time: 7h 15min ✓                          │
│                                                                             │
│  OPTION 3: "Beach Focus"                                                    │
│  Start(9:00) → Sitges(9:45, 2h beach) → Peñíscola(2:35, lunch+castle) →    │
│  End(4:50)                                                                  │
│  Total driving: 3h 50min ✓ Total time: 7h 50min ✓                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: GENERATE STOP CARDS (Like Vibe Areas)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each stop in selected route, generate a card with:                     │
│                                                                             │
│  ┌─────────────────────────────────────────┐                               │
│  │  📍 Sitges                              │                               │
│  │  🔍 Web verified                        │                               │
│  │                                         │                               │
│  │  "Charming beach town with Art Nouveau  │                               │
│  │   architecture and golden sand beaches" │                               │
│  │                                         │                               │
│  │  ⏱️ Arrive: 9:45 AM | Stay: 1 hour     │                               │
│  │                                         │                               │
│  │  🗺️ What to do here:                   │                               │
│  │  ┌─────────────────────────────────┐   │                               │
│  │  │ ☕ Morning coffee               │   │                               │
│  │  │ "best cafes Sitges seafront"   │   │                               │
│  │  │ 💡 Try: Café del Mar            │   │                               │
│  │  │ [📍 Maps] [🎵 TikTok]           │   │                               │
│  │  └─────────────────────────────────┘   │                               │
│  │  ┌─────────────────────────────────┐   │                               │
│  │  │ 🏖️ Beach walk                   │   │                               │
│  │  │ "Sitges beaches promenade"     │   │                               │
│  │  │ 💡 Try: Platja de Sant Sebastià │   │                               │
│  │  │ [📍 Maps] [🎵 TikTok]           │   │                               │
│  │  └─────────────────────────────────┘   │                               │
│  │  ┌─────────────────────────────────┐   │                               │
│  │  │ 📸 Photo spot                   │   │                               │
│  │  │ "Sitges church viewpoint"      │   │                               │
│  │  │ 💡 Try: Iglesia de Sant Bartomeu│   │                               │
│  │  │ [📍 Maps] [🎵 TikTok]           │   │                               │
│  │  └─────────────────────────────────┘   │                               │
│  │                                         │                               │
│  │        [←]  1 / 3 stops  [→]           │                               │
│  └─────────────────────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Layout for Road Trips

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🚗  Barcelona → Valencia                   [📤 Get Directions] [✨ New]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          M  A  P                                            │
│                                                                             │
│           ●━━━━━━━━━━●━━━━━━━━━━━━●━━━━━━━━●                               │
│        Barcelona    Sitges    Tarragona  Peñíscola  Valencia               │
│                  (stop 1)    (stop 2)   (stop 3)      ●                    │
│                                                                             │
│                                                                             │
│  ┌──────────────────────────────────┐         ┌──────────────────────────┐ │
│  │  📍 Sitges                       │         │  ROUTES                  │ │
│  │  ⏱️ 9:45 AM - 10:45 AM          │         │                          │ │
│  │                                  │         │  ● Coastal Explorer      │ │
│  │  "Charming beach town with..."   │         │    3h 23min | 3 stops   │ │
│  │                                  │         │                          │ │
│  │  🗺️ What to do:                 │         │  ○ Mountain & Coast      │ │
│  │  ┌────────────────────────────┐ │         │    4h 15min | 3 stops   │ │
│  │  │ ☕ Morning coffee          │ │         │                          │ │
│  │  │ 💡 Café del Mar            │ │         │  ○ Beach Focus           │ │
│  │  │ [📍 Maps] [🎵 TikTok]      │ │         │    3h 50min | 2 stops   │ │
│  │  └────────────────────────────┘ │         │                          │ │
│  │  ... more activities ...        │         └──────────────────────────┘ │
│  │                                  │              ROUTE SELECTOR          │
│  │      [←]  1 / 3 stops  [→]      │              (bottom-right)          │
│  └──────────────────────────────────┘                                      │
│       STOP INFO CARD (bottom-left)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### "Get Directions" Button

When user clicks **[📤 Get Directions]**, show a popup:

```
┌────────────────────────────────────────┐
│  📤 Get Directions                     │
│                                        │
│  How would you like the directions?    │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🏘️ To the areas                │   │
│  │ Barcelona → Sitges →           │   │
│  │ Tarragona → Peñíscola →        │   │
│  │ Valencia                       │   │
│  │                                │   │
│  │ Best for: Flexibility to      │   │
│  │ explore each town on arrival  │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 📍 To the suggested activities │   │
│  │ Barcelona → Café del Mar →     │   │
│  │ Tarragona Amphitheater →       │   │
│  │ Restaurante X → Peñíscola     │   │
│  │ Castle → Valencia              │   │
│  │                                │   │
│  │ Best for: Following the       │   │
│  │ exact itinerary step-by-step  │   │
│  └────────────────────────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

Generated links:

```javascript
// Option 1: To areas (town centers)
const areasLink = `https://www.google.com/maps/dir/Barcelona/Sitges/Tarragona/Peñíscola/Valencia`;

// Option 2: To specific activities (precise coordinates)
const activitiesLink = `https://www.google.com/maps/dir/41.3874,2.1686/41.2371,1.8058/41.1189,1.2445/40.3584,-0.4080/39.4699,-0.3763`;
```

---

## Detailed Pricing Reference (December 2024)

### Mapbox API Pricing

| API | Free Tier | Paid Rate |
|-----|-----------|-----------|
| **Maps GL (map load)** | 50,000 loads/month | **$0.005/load** |
| **Matrix API** | 100,000 elements/month | **$0.002/element** |
| Directions API | 100,000 requests/month | $0.002/request |
| Geocoding (Temporary) | 100,000 requests/month | $0.00075/request |
| Optimization API | 100,000 requests/month | $0.002/request |

**Key insights**: 
- Maps GL is charged per map load (page/session) at $0.005
- Matrix is priced per **element** (each cell in the N×N matrix), not per API call

### Gemini API Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Gemini 2.5 Flash | $0.30 | $2.50 |
| Gemini 2.5 Pro | $1.25 | $10.00 |

---

## Business Case: Road Trip Planning Costs

### Per-Trip Cost Calculation

For a complex road trip planning session (without free tiers):

| Step | Units | Rate | Cost |
|------|-------|------|------|
| Mapbox Maps GL (map load) | 1 load | $0.005 | $0.005 |
| Mapbox Directions (baseline) | 1 request | $0.002 | $0.002 |
| Initial Matrix (10×10) | 100 elements | $0.002/element | $0.20 |
| User refines route | 100 elements | $0.002/element | $0.20 |
| User tries another option | 100 elements | $0.002/element | $0.20 |
| ... (typical: 10 iterations) | 1,000 elements total | | $2.00 |
| Gemini AI (classification + planning) | ~3K tokens | ~$0.01 | $0.01 |
| **Total per trip session** | | | **~$2.02** |

### Heavy User Scenario: 10 Searches/Day for 1 Month

```
10 searches/day × 30 days = 300 searches/month
Assume: 5 Matrix iterations per search = 1,500 Matrix calls
Matrix elements: 1,500 × 100 = 150,000 elements
Map loads: 300 (one per search session)
```

| Component | Usage | Free Tier | Paid Usage | Cost |
|-----------|-------|-----------|------------|------|
| Mapbox Maps GL | 300 loads | 50,000 free | 0 | **$0.00** |
| Mapbox Matrix | 150,000 elements | 100,000 free | 50,000 paid | **$100.00** |
| Mapbox Directions | 300 requests | 100,000 free | 0 | **$0.00** |
| Gemini tokens | ~900K | - | ~900K | **~$0.90** |
| **TOTAL** | | | | **~$100.90/month** |

**Without any free tiers**: 150,000 elements × $0.002 = **$300/month**

### Monthly Cost Per User

| Usage Pattern | Iterations/Session | Matrix Elements | With Free Tier | Without Free |
|---------------|-------------------|-----------------|----------------|--------------|
| Light (1 trip/month) | 10 | 1,000 | ~$0 (free) | $2.00 |
| **Typical (2 trips/month)** | 20 | 4,000 | ~$0 (free) | **$8.00** |
| Heavy (10 trips/month) | 100 | 10,000 | ~$0 (free) | $20.00 |
| Power (10 searches/day) | 1,500 | 150,000 | ~$100 | $300.00 |

### Break-Even Analysis

| Scenario | Monthly Matrix Elements | Cost | Subscription Needed |
|----------|------------------------|------|---------------------|
| Within free tier | <100,000 | $0 | Free tier works! |
| Light paid | 100,001-200,000 | $0-$200 | $5-15/user |
| Heavy paid | 500,000+ | $800+ | Need volume discount |

### Cost Optimization Strategies

1. **Aggressive caching**: Cache Matrix results for popular routes (Barcelona→Valencia)
2. **Limit iterations**: Cap at 5-10 Matrix calls per session
3. **Smart filtering**: Only include 8-10 POIs instead of 15 (reduces N²)
4. **Tiered access**: Free users get 2 trips/month, premium gets 20
5. **Self-hosted OSRM**: For high volume, self-host routing engine (~$50/month server)

---

## Scope: Area-Based vs. Specific Place Planning

### This Architecture Handles: Area-Based Planning

The road trip planner is designed for discovering **areas** to visit:

| ✅ Good For | Example |
|-------------|---------|
| Scenic drives | "Barcelona to Valencia coastal route" |
| City exploration walks | "Walking tour of Gothic Quarter" |
| Cycling routes | "Bike ride through Penedès wine country" |
| Day trips | "Day trip from Madrid to Toledo and Segovia" |

These all involve:
- Selecting **areas/neighborhoods/towns** to visit
- Flexible activities within each area
- Time spent exploring, not just arriving

### Specific Place Planning (Separate Document)

**Pub crawls, date nights, food tours** need a different approach that finds and verifies specific venues:

| Pattern | Example | See Document |
|---------|---------|--------------|
| Date night | "Romantic dinner then cocktails in El Born" | `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` |
| Pub crawl | "Plan a pub crawl in Soho" | `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` |
| Food tour | "Best 5 taco spots in CDMX" | `SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` |

**Key difference**: Uses **ScrapingDog + Gemini Flash Lite** for deep place discovery:
- Web searches for authentic recommendations (TimeOut, Eater, blogs, Reddit)
- Google Maps API for verified coordinates and hours
- Full review analysis (300-500 reviews per search)
- Walking time matrix between places

**Cost**: ~$0.375 per search (77% is Mapbox Matrix)

**See**: `/docs/plans/SPECIFIC_PLACE_PLANNING_SCRAPINGDOG.md` for full architecture.

---

## External Dependencies

### APIs Required

| API | Purpose | Cost Model |
|-----|---------|------------|
| **Mapbox Matrix** | N×N driving time calculation | $0.002 per element, 100k free |
| **Mapbox Directions** | Route geometry + alternatives | $0.50 per 1k, 100k free |
| **Mapbox Geocoding** | City → coordinates | $0.75 per 1k, 100k free |
| **Gemini API** | AI reasoning + search grounding | Per-token pricing |

### Local Data Required (FREE)

| Data | Purpose | Source |
|------|---------|--------|
| **OSM POI Extract** | Find interesting areas | Download from Geofabrik |
| **Coastal/Mountain GeoJSON** | Scenic scoring | Pre-computed |
| **Turf.js** | Corridor analysis | Client-side library |

### Per-Search Cost Summary

| Component | Cost |
|-----------|------|
| 1× Mapbox Directions (baseline) | FREE |
| 1× Mapbox Matrix (10×10) | $0.20 |
| Local Turf.js + OSM | $0.00 |
| 1× Gemini call (route architect) | $0.003 |
| **Total per search** | **~$0.20** |

---

## Implementation Phases

### Phase 1: Core Agent Loop (MVP)
- [ ] Create `/api/vibe-maps/agent` endpoint
- [ ] Implement basic tool executor
- [ ] Add `classify_intent` tool
- [ ] Add `ask_clarification` tool
- [ ] Add `generate_vibe_areas` tool (reuse existing)
- [ ] Add map control tools
- [ ] Create `useVibeAgent` hook
- [ ] Basic chat sidebar UI

### Phase 2: Road Trip Support
- [ ] Add `get_routes` tool (Mapbox integration)
- [ ] Add `analyze_route_scenic` tool (Turf.js)
- [ ] Add `find_pois_in_corridor` tool (OSM data)
- [ ] Add `score_and_describe_routes` tool
- [ ] Route visualization on map
- [ ] Route info cards

### Phase 3: Polish
- [ ] Streaming UI updates
- [ ] "Leo is thinking..." indicator with tool names
- [ ] Smooth animations
- [ ] Mobile responsiveness
- [ ] Error handling and retries

---

## Testing Scenarios

### Neighborhood Queries
1. "Best bars in Berlin tonight" → activities mode, no clarification
2. "Where to stay in Tokyo" → stay mode, no clarification
3. "Planning 3 days in Paris" → stay+activities, no clarification
4. "Barcelona" → ambiguous, ask for intent
5. "Coffee shops" → ambiguous, ask for city

### Road Trip Queries
1. "Barcelona to Valencia scenic drive" → road trip, no clarification
2. "Road trip from Madrid" → road trip, ask for destination
3. "Coastal drive in Spain" → ambiguous, ask for start/end
4. "Drive through the mountains" → ambiguous, ask for location

### Mixed/Edge Cases
1. "I'm in Rome" → ambiguous, could be activities or road trip start
2. "Weekend getaway" → ambiguous, need location and intent
3. Empty message → prompt for input

---

---

## Planning Mode Comparison

| Planning Mode | Use Case | Per-Search Cost | Primary APIs |
|---------------|----------|-----------------|--------------|
| **Neighborhoods** | "Best bars in Berlin" | ~$0.035 | Gemini + Grounding + Maps GL |
| **Road Trip** | "Barcelona to Valencia scenic" | ~$0.21 | Mapbox Matrix + OSM + Gemini + Maps GL |
| **Single Place** | "Best pizza in Soho" | ~$0.035 | ScrapingDog + Gemini + Maps GL |
| **Meet in the Middle** | "Fair spot for both of us" | ~$0.055 | Geoapify + ScrapingDog + Maps GL |
| **Multi-Stop Journey** | "Date night in El Born" | ~$0.38 | ScrapingDog + Maps + Matrix + Maps GL |

*All costs include $0.005 Mapbox Maps GL load per search*

### Heavy User (10 searches/day for 1 month)

| Mode | Monthly Cost | Dominant Factor |
|------|--------------|-----------------|
| Neighborhoods only | ~$10.50 | Gemini tokens + Maps GL |
| **Single place only** | **~$9.60** | ScrapingDog + Gemini + Maps GL |
| **Meet in the Middle only** | **~$13** | Geoapify + ScrapingDog + Maps GL |
| Road trips only | ~$103 | Mapbox Matrix (76%) |
| Multi-stop journeys only | ~$114 | Mapbox Matrix (76%) |
| Mixed (typical) | ~$25-45 | Depends on query types |

---

*Delete this file after implementation is complete.*
