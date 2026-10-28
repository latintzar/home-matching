---
status: design
last_updated: 2024-12-12
building_blocks: [1.1, 1.2, Shared.1, Shared.2, Shared.4]
implemented_in: /src/app/vibe-maps/page.tsx
---

# Scenario 1: Things to Do

> "What are cool bars in Barcelona?"

## Overview

The simplest and most common scenario. User wants activity recommendations in a single city. Returns 5 "vibe areas" - neighborhoods or districts with a specific character that matches their query.

## When This Triggers

- Single city mentioned
- Activity-focused query (not accommodation)
- No multi-person coordination needed
- No specific venue required

**Example queries**:
- "cool bars in Barcelona"
- "romantic spots in Paris"
- "family activities in Tokyo"
- "nightlife in Berlin"
- "artsy neighborhoods in Brooklyn"

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY (Gemini 2.5 Flash)                      Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "cool bars in Barcelona"                                            │
│  Output: {                                                                  │
│    scenario: "things-to-do",                                                │
│    city: "Barcelona",                                                       │
│    vibe: "nightlife",                                                       │
│    specificity: "area"                                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: GENERATE AREAS (Gemini 2.5 Pro + Grounding)      Cost: ~$0.005    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Prompt: Generate 5 neighborhoods in Barcelona for cool bars...             │
│  With: Google Search grounding enabled                                       │
│                                                                             │
│  Output: 5 VibeArea objects with:                                           │
│  - name, center coordinates, radius                                         │
│  - description, vibe tags                                                   │
│  - "why" reason specific to query                                           │
│  - 3 search suggestions                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: RENDER (Mapbox)                                  Cost: $0.005     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Display map centered on city                                             │
│  - Draw 5 vibe circles                                                      │
│  - Show info cards on click                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface VibeArea {
  name: string;              // "El Born"
  center: [number, number];  // [2.1816, 41.3851]
  radius: number;            // meters, typically 300-800
  
  description: string;       // 2-3 sentences about the area
  vibes: string[];           // ["artsy", "trendy", "historic"]
  
  whyReason: string;         // Why this matches user's query
  
  searchSuggestions: Array<{
    text: string;            // "hidden cocktail bars El Born"
    gmapsUrl: string;        // Google Maps search URL
    tiktokUrl: string;       // TikTok search URL
  }>;
}
```

## Example Output

**Query**: "cool bars in Barcelona"

```json
{
  "areas": [
    {
      "name": "El Born",
      "center": [2.1816, 41.3851],
      "radius": 500,
      "description": "Medieval streets hiding speakeasy cocktail bars and natural wine spots. The neighborhood's Gothic architecture creates intimate drinking dens that feel centuries old.",
      "vibes": ["speakeasy", "natural wine", "historic"],
      "whyReason": "El Born has Barcelona's highest concentration of craft cocktail bars in atmospheric medieval buildings",
      "searchSuggestions": [
        {
          "text": "speakeasy bars El Born Barcelona",
          "gmapsUrl": "https://www.google.com/maps/search/speakeasy+bars+El+Born+Barcelona",
          "tiktokUrl": "https://www.tiktok.com/search?q=speakeasy+bars+el+born+barcelona"
        },
        {
          "text": "natural wine bars El Born",
          "gmapsUrl": "https://www.google.com/maps/search/natural+wine+bars+El+Born+Barcelona",
          "tiktokUrl": "https://www.tiktok.com/search?q=natural+wine+el+born+barcelona"
        },
        {
          "text": "rooftop bars Gothic Quarter",
          "gmapsUrl": "https://www.google.com/maps/search/rooftop+bars+Gothic+Quarter+Barcelona",
          "tiktokUrl": "https://www.tiktok.com/search?q=rooftop+bars+gothic+quarter"
        }
      ]
    }
    // ... 4 more areas
  ]
}
```

## UI Components

### Map View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│           ┌─────┐                                                           │
│           │  1  │  El Born                                                  │
│           └─────┘                                                           │
│                        ┌─────┐                                              │
│                        │  2  │  Gràcia                                      │
│                        └─────┘                                              │
│     ┌─────┐                                                                 │
│     │  3  │  Raval                          ┌─────┐                         │
│     └─────┘                                 │  4  │  Poblenou               │
│                                             └─────┘                         │
│                   ┌─────┐                                                   │
│                   │  5  │  Barceloneta                                      │
│                   └─────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Info Card (on area click)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  El Born                                                              [×]   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Medieval streets hiding speakeasy cocktail bars and natural wine spots.   │
│  The neighborhood's Gothic architecture creates intimate drinking dens.    │
│                                                                             │
│  💡 Why this matches: El Born has Barcelona's highest concentration of     │
│     craft cocktail bars in atmospheric medieval buildings                   │
│                                                                             │
│  🔍 Search Ideas:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ speakeasy bars El Born Barcelona          [GMaps] [TikTok]          │   │
│  │ natural wine bars El Born                 [GMaps] [TikTok]          │   │
│  │ rooftop bars Gothic Quarter               [GMaps] [TikTok]          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Step | Service | Cost |
|------|---------|------|
| Query Classification | Gemini 2.5 Flash | ~$0.001 |
| Area Generation | Gemini 2.5 Pro + Grounding | ~$0.005 |
| Map Display | Mapbox Maps GL | $0.005 |
| **Total** | | **~$0.011** |

## Caching Strategy

- **City-vibe combinations**: Cache for 7 days
  - Key: `areas:barcelona:nightlife`
  - Value: Generated areas array
- **Benefits**: Repeat queries hit cache, cost → $0.005 (map only)

## Edge Cases

| Case | Handling |
|------|----------|
| Unknown city | Ask for clarification: "I don't recognize that city. Did you mean...?" |
| Too vague ("things to do") | Generate "general exploration" areas, ask for specifics |
| Very specific ("jazz bars") | Narrow down, may only return 3 areas if that's all that qualifies |
| Non-urban location | Expand radius, return "areas of interest" instead of neighborhoods |

## Implementation Notes

### Gemini Prompt Structure

```typescript
const prompt = `
You are a local expert on ${city}. Generate exactly 5 neighborhood recommendations
for someone looking for: "${userQuery}"

For each neighborhood, provide:
1. Name (official neighborhood name)
2. Center coordinates [lng, lat]
3. Radius in meters (300-800m typical)
4. 2-3 sentence description focusing on ${vibe}
5. Why this area matches their specific query
6. 3 search suggestions they can use to find specific spots

Use current, real information. Focus on authentic local recommendations,
not tourist traps.

Return as JSON array.
`;
```

### Response Streaming

Stream the response via SSE for better UX:

```typescript
// API route
export async function POST(req: Request) {
  const { query } = await req.json();
  
  // Return SSE stream
  return new Response(
    new ReadableStream({
      async start(controller) {
        // Step 1: Classify
        controller.enqueue(`data: {"step":"classifying"}\n\n`);
        const classification = await classifyQuery(query);
        
        // Step 2: Generate
        controller.enqueue(`data: {"step":"generating","city":"${classification.city}"}\n\n`);
        const areas = await generateAreas(classification);
        
        // Step 3: Complete
        controller.enqueue(`data: {"step":"complete","areas":${JSON.stringify(areas)}}\n\n`);
        controller.close();
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}
```

## Related Scenarios

- **[Where to Stay](02-WHERE-TO-STAY.md)**: Same flow but for accommodation areas
- **[Stay + Do](03-STAY-AND-DO.md)**: Combines this with stay recommendations
- **[Single Place](04-SINGLE-PLACE.md)**: When user wants a specific venue, not areas

---

[← Back to Index](../AGENTIC_MAPS.md) | [Next: Where to Stay →](02-WHERE-TO-STAY.md)
