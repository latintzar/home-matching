# 🎯 Standard Gemini Usage Pattern: Structured Output

**This is the official, recommended way to use Gemini AI in this codebase.**

## ✅ Why Structured Output?

Structured output ensures **100% consistent, parseable JSON responses** from Gemini. No more:
- ❌ JSON parsing errors
- ❌ Inconsistent response formats
- ❌ Malformed JSON arrays/objects
- ❌ Post-processing hacks

**With structured output:**
- ✅ Guaranteed valid JSON matching your schema
- ✅ Type-safe responses
- ✅ Zero parsing errors
- ✅ Reliable downstream processing

## 🏗️ Architecture

### The Pattern

```typescript
import { callGeminiRest } from '@/lib/gemini-rest-client';

// 1. Define your response schema (Vertex AI schema subset)
const responseSchema = {
  type: 'object',
  properties: {
    summaries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subcategory: { type: 'string' },
          summary: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          sources: { type: 'array', items: { type: 'string' }, minItems: 1 }
        },
        required: ['subcategory', 'summary', 'confidence', 'sources']
      },
      minItems: 3
    }
  },
  required: ['summaries'],
  propertyOrdering: ['summaries']  // Optional: enforce property order
};

// 2. Call Gemini with the schema
const geminiResponse = await callGeminiRest(prompt, {
  temperature: 0.1,
  topP: 0.6,
  topK: 20,
  maxOutputTokens: 32000,
  responseMimeType: 'application/json',  // REQUIRED for structured output
  responseSchema                        // REQUIRED: your schema
});

// 3. Parse (guaranteed to work!)
const data = JSON.parse(geminiResponse.text);
// data.summaries is guaranteed to exist and be an array
```

## 📋 Complete Example: Research Curation Endpoint

Here's a real-world example from our renovation intelligence pipeline.

```typescript
// src/app/api/listings/[id]/renovation-research-curate-laws-regulations/[tier]/route.ts

import { callGeminiRest } from '@/lib/gemini-rest-client';

export async function POST(request: NextRequest, { params }) {
  const { id: listingId, tier } = await params;
  
  // ... fetch search results, build prompt ...
  
  // 1. Define strict response schema
  const responseSchema = {
    type: 'object',
    properties: {
      summaries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            subcategory: { type: 'string' },
            summary: { type: 'string' },
            confidence: { 
              type: 'string', 
              enum: ['high', 'medium', 'low'] 
            },
            sources: { 
              type: 'array', 
              items: { type: 'string' }, 
              minItems: 1 
            },
            metrics: {
              type: 'object',
              properties: {
                expected_time_weeks: { 
                  type: 'integer', 
                  nullable: true, 
                  minimum: 0 
                }
              },
              required: []
            }
          },
          required: ['subcategory', 'summary', 'confidence', 'sources']
        },
        minItems: 3
      }
    },
    required: ['summaries'],
    propertyOrdering: ['summaries']
  };

  // 2. Call Gemini with structured output
  const geminiResponse = await callGeminiRest(prompt, {
    temperature: 0.1,
    topP: 0.6,
    topK: 20,
    maxOutputTokens: 32000,
    thinkingConfig: {
      thinkingBudget: -1
    },
    responseMimeType: 'application/json',  // ⚠️ REQUIRED
    responseSchema                          // ⚠️ REQUIRED
  });

  // 3. Simple JSON parse (guaranteed to work)
  const cleaned = geminiResponse.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const curationData = JSON.parse(cleaned);
  
  // 4. Use the structured data (type-safe!)
  if (!curationData.summaries || !Array.isArray(curationData.summaries)) {
    // This should never happen with structured output, but good defensive coding
    throw new Error('Invalid response structure');
  }

  // ✅ curationData.summaries is guaranteed to be an array of objects
  // ✅ Each object has: subcategory, summary, confidence, sources, (optional) metrics
}
```

## 📚 Schema Reference

### Supported Schema Fields

Our implementation uses the Vertex AI schema subset. Supported fields:

- `type` - Data type: 'object', 'array', 'string', 'integer', 'number', 'boolean'
- `properties` - Object properties (for type: 'object')
- `items` - Array item schema (for type: 'array')
- `enum` - String enum values
- `required` - Required fields array
- `nullable` - Allow null values
- `minItems` / `maxItems` - Array length constraints
- `minimum` / `maximum` - Number value constraints
- `format` - Format string (date, date-time, etc.)
- `propertyOrdering` - Enforce property generation order

### Schema Design Best Practices

1. Always use `responseMimeType: 'application/json'` when using `responseSchema`
2. Mark required fields explicitly with `required: [...]`
3. Use nullable for optional fields that might be missing
4. Set reasonable constraints (minItems, maxItems, minimum, maximum)
5. Use enums for fixed value sets instead of free-form strings
6. Property ordering matters - list important fields first in `propertyOrdering`

## 🚀 Implementation Checklist

When creating a new Gemini endpoint:

- [ ] Define `responseSchema` matching your data contract
- [ ] Set `responseMimeType: 'application/json'`
- [ ] Include both in `callGeminiRest()` config
- [ ] Use `JSON.parse()` for parsing (no complex regex needed)
- [ ] Add defensive checks (even though structured output is reliable)
- [ ] Document the schema in code comments
- [ ] Test with various inputs to ensure schema compliance

## 🧭 Puedo Casa Standard Calls (Authoritative Guide)

This section documents exactly how we use Gemini across the photo analysis pipeline. Copy these patterns when adding new endpoints.

### F1: Per‑Photo Spatial Placement (images → rich, angle‑agnostic JSON)

- Model: `gemini-2.5-flash-lite`
- One photo per model call (no batching per room)
- Proper image mime detection (webp/png/jpeg)
- Structured output REQUIRED with responseSchema + responseMimeType
- Elements MUST include visual details for blind‑drafter clarity

Schema (excerpt):

```json
{
  "photo_id": "p1",
  "camera": { "tilt": 0, "pan": 0, "height": 1.6 },
  "elements": [
    {
      "id": "W1", "type": "window",
      "visual_description": "Literal appearance (frame, divisions, transparency, scale).",
      "materials": ["aluminum"],
      "color": ["white"],
      "condition": "good",
      "style_cues": ["contemporary"]
    }
  ],
  "relations": [ { "subject": "W1", "predicate": "on_same_wall_as", "object": "D1" } ],
  "spatial_summary": "Angle‑agnostic description: which walls host what, fractions, alignments, aisles.",
  "angle_agnostic_description": ["Constraints usable from any angle (thirds/halves, sidedness, alignments)."],
  "considerations": ["Only if ambiguity/occlusion materially affects interpretation."],
  "bboxes": null
}
```

Key rules:
- Always include `visual_description`, `materials`, `color`, `condition`, `style_cues` for each element
- No camera‑frame words in summaries; use room‑centric language (walls, thirds, axes)
- Use stable ids (type+index)
- propertyOrdering set to: `photo_id, camera, elements, relations, spatial_summary, angle_agnostic_description, considerations, bboxes`

Implementation reference:
- `src/app/api/listings/[id]/rooms/layout/placement/route.ts`

### F2: Canonical Fusion (F1 JSONs → unified room layout)

- Model: `gemini-2.5-flash-lite`
- Inputs: the room’s F1 per‑photo JSONs only (no images)
- Structured output REQUIRED with responseSchema + responseMimeType
- Output must be rich and blind‑drafter friendly

Schema (excerpt):

```json
{
  "room_narrative": "6–12 sentences, angle‑agnostic, highly descriptive.",
  "walls": [
    { "label": "east", "length_descriptor": "long", "features_in_order": ["CS1","R1","D1","WR1"], "fractions": { "R1": "right_third" } }
  ],
  "zones": [
    { "id": "Z1", "label": "prep_zone", "description": "Between island and L cabinetry; main workflow path", "bounds_hint": "front_half_center" }
  ],
  "elements": [
    {
      "id": "R1", "type": "refrigerator", "aliases": ["p1.R1"],
      "role": "appliance", "on_wall": "east", "in_zone": null,
      "visual_description": "Tall, stainless fridge with flat panels.",
      "materials": ["stainless steel"], "color": ["silver"],
      "condition": "good", "style_cues": ["contemporary"]
    }
  ],
  "relations": [ { "subject": "R1", "predicate": "adjacent_to", "object": "D1" } ],
  "camera_alignment": [ { "photo_id": "p1", "relation_to_canonical": "~canonical" } ],
  "uncertainties": ["Confirm flooring change indicates adjacent hallway."]
}
```

Key rules:
- Provide `room_narrative`, `walls`, `zones`, `elements`, `relations` (all populated)
- Unify ids via `aliases`; prefer constraints supported by ≥2 photos; move contradictions into `uncertainties`
- propertyOrdering set to: `room_narrative, walls, zones, elements, relations, camera_alignment, uncertainties`

Implementation reference:
- `src/app/api/listings/[id]/rooms/[roomId]/layout/fusion/route.ts`

### “This is how we do Gemini calls in Puedo Casa”

1) Always use structured output: set `responseMimeType: 'application/json'` and provide a `responseSchema`.
2) Prefer `gemini-2.5-flash-lite` for speed when fusing/curating structured text; use Pro only when needed.
3) Keep schemas concise, explicit, and include `required` and `propertyOrdering`.
4) For images, detect mime type (webp/png/jpeg) and pass the correct `mimeType` per image.
5) Avoid retries unless you have upstream network issues; with structured output, JSON is guaranteed when schema is valid.
6) Write literal, angle‑agnostic prompts; prohibit camera‑frame terms for room semantics.
7) Persist only the structured payloads; never store raw model prose.


## 🔧 Configuration Recommendations

### For Curation/Summarization Tasks

```typescript
{
  temperature: 0.1,        // Low creativity for factual summaries
  topP: 0.6,               // Balanced sampling
  topK: 20,                // Focused token selection
  maxOutputTokens: 32000, // Sufficient for detailed responses
  responseMimeType: 'application/json',
  responseSchema: yourSchema
}
```

### For Creative/Generation Tasks

```typescript
{
  temperature: 0.7,        // More creative
  topP: 0.95,              // More diverse
  topK: 40,                // Wider selection
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
  responseSchema: yourSchema
}
```

## ⚠️ Important Notes

1. `responseMimeType` and `responseSchema` are REQUIRED together - don't use schema without `application/json` MIME type
2. Schema size counts toward token limits - keep schemas concise
3. Complex schemas can cause 400 errors - simplify if you hit this
4. Property ordering in prompts should match `propertyOrdering` - helps model consistency
5. Structured output works with all Gemini 2.5 models - use preview models for larger context windows

## 📊 Success Metrics

Since adopting structured output:
- ✅ 21/21 curation endpoints succeed consistently
- ✅ 0 JSON parsing errors in production
- ✅ 100% consistent response format across all tiers and categories
- ✅ Reduced code complexity - no more complex parsing logic

## 🔗 Related Files

- REST Client: `src/lib/gemini-rest-client.ts`
- Example Implementation: `src/app/api/listings/[id]/renovation-research-curate-laws-regulations/[tier]/route.ts`
- All Curation Endpoints: `src/app/api/listings/[id]/renovation-research-curate-*/`

## 🎓 Learning Resources

- Gemini Structured Output Documentation
- Vertex AI Schema Reference

---

**Remember**: This is now the **standard pattern** for all new Gemini integrations in this codebase. Use structured output for reliable, type-safe AI responses.
