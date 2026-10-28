# P0-02: WPA Pipeline — Whole Property Analysis

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Overview

WPA (Whole Property Analysis) is a 2-step process that analyzes listing photos and extracts 35 dimensions.

```
PHOTOS → [DESCRIBE] → PROSE → [SCORE] → 35 DIMENSIONS → CACHE
```

---

## The 2-Step Process

### Step 1: Describe (Vision → Prose)

- **Input:** Up to 30 listing photos (URLs)
- **Model:** Gemini 2.5 Flash-Lite
- **Output:** Rich prose description of the property
- **Cost:** ~$0.001

```typescript
// POST /api/wpa/describe
{
  listing_id: "idealista_12345",
  photos: ["https://img.idealista.com/xyz.jpg", ...]
}

// Response
{
  description: "This is a bright apartment with high ceilings and large 
                south-facing windows. The living room opens onto a generous
                balcony with sea views. Kitchen is compact but modern with
                stainless steel appliances..."
}
```

### Step 2: Score (Prose → 35 Dimensions)

- **Input:** Prose description from Step 1
- **Model:** Gemini 2.5 Flash-Lite (no vision needed)
- **Output:** Structured JSON with 35 dimension scores
- **Cost:** ~$0.002

```typescript
// POST /api/wpa/score
{
  listing_id: "idealista_12345",
  description: "This is a bright apartment..."
}

// Response
{
  scores: {
    natural_light_intensity: 85,
    light_distribution: 72,
    ceiling_height: 80,
    kitchen_size: 45,
    outdoor_space_quality: 90,
    // ... 30 more dimensions
  },
  confidence: "high",
  standouts: ["Large south-facing windows", "Sea view balcony"],
  concerns: ["Compact kitchen"]
}
```

---

## The 35 Dimensions

### Light & Air
| Dimension | Description |
|-----------|-------------|
| `natural_light_intensity` | How bright and sunny? |
| `light_distribution` | Light in all rooms or just some? |
| `cross_ventilation` | Can air flow through? |
| `ceiling_height` | How tall are ceilings? |

### Layout & Flow
| Dimension | Description |
|-----------|-------------|
| `entrance_experience` | First impression entering? |
| `kitchen_living_relationship` | Open plan or separated? |
| `bathroom_privacy` | Where's the bathroom? |
| `bedroom_seclusion` | Bedroom isolated? |
| `flow_for_entertaining` | Good for hosting? |
| `furniture_feasibility` | Will furniture fit? |
| `two_person_living` | Good for couples? |
| `escape_room_potential` | Room to retreat? |
| `real_walls_vs_separators` | Real walls or partitions? |

### Kitchen
| Dimension | Description |
|-----------|-------------|
| `counter_space` | Prep area size? |
| `appliance_quality` | Fixtures quality? |
| `kitchen_storage` | Cabinets/storage? |
| `cooking_ventilation` | Extraction/windows? |

### Bathroom & Bedroom
| Dimension | Description |
|-----------|-------------|
| `bathroom_functionality` | Usable? Modern? |
| `bedroom_size_fit` | Fits bed + furniture? |
| `closet_storage` | Built-in wardrobes? |
| `morning_light_bedroom` | Morning sun? |

### Condition
| Dimension | Description |
|-----------|-------------|
| `renovation_state` | Move-in ready? |
| `signs_of_aging` | Visible wear? |

### Comfort & Lifestyle
| Dimension | Description |
|-----------|-------------|
| `cozy_corner_potential` | Reading nook? |
| `wfh_potential` | Space for desk/calls? |
| `outdoor_space_quality` | Balcony/terrace quality? |
| `balcony_security` | Safe for kids/pets? |
| `storage_total` | Overall storage? |

### Safety Flags
| Flag | Description |
|------|-------------|
| `has_cubicle_bathroom` | Bathroom in closet? |
| `has_mezzanine` | Loft with ladder? |
| `needs_full_renovation` | Gut job needed? |
| `ground_floor_exposed` | Street-level window? |
| `is_house_share` | Multi-tenant? |
| `child_hazards` | Unsafe for children? |
| `elderly_hazards` | Unsafe for elderly? |
| `accessibility_issues` | Mobility barriers? |

---

## Caching Strategy

All WPA results are cached in DynamoDB to avoid re-processing.

```typescript
// leo-wpa-cache table
{
  listing_id: "idealista_12345",     // PK
  version: "v2",                      // Schema version
  scores: { ... },
  standouts: [ ... ],
  concerns: [ ... ],
  confidence: "high",
  computed_at: "2024-12-06T10:00:00Z",
  ttl: 1733572800                     // Expire after 30 days
}
```

**Cache Hit Logic:**
1. Check `leo-wpa-cache` for listing_id
2. If exists and `computed_at` < 30 days ago, return cached
3. If missing or stale, run WPA pipeline, cache result

**Why 30 days?**
- Listing photos rarely change
- WPA cost is low (~$0.003) but adds up
- Re-run when listing is viewed and cache expired

---

## Cost Analysis

| Step | Model | Cost |
|------|-------|------|
| Describe (vision) | Flash-Lite | ~$0.001 |
| Score (text) | Flash-Lite | ~$0.002 |
| **Total per WPA** | | **~$0.003** |

**⚠️ CRITICAL:** Use Gemini 2.5 Flash-Lite, NOT:
- Flash (~$0.03/WPA = 10x more)
- Pro (~$0.90/WPA = 300x more)

---

## Quick WPA (For Vibe-Check)

During calls, we need faster WPA without clusters. Uses single pass over all photos.

```typescript
// src/lib/recommender/wpaQuick.ts

export async function runQuickWPA(listing: Listing): Promise<WPAResult> {
  const photos = listing.photos; // All photos, no clusters
  
  // Single Gemini call with all photos
  const prompt = `
    Analyze this property from its photos.
    
    Photos: ${photos.map(p => p.url).join(', ')}
    
    Score each dimension 1-100:
    
    LIGHT & SPACE:
    - natural_light: How bright and sunny?
    - ceiling_height: How tall are ceilings?
    - room_size: How spacious do rooms feel?
    
    [... continue for all 35 dimensions]
    
    Return JSON with scores only.
  `;
  
  const result = await geminiFlash(prompt, photos);
  return parseWPAResult(result);
}
```

**Difference from Full WPA:**
- No cluster-by-cluster analysis
- Single pass over all photos
- Faster (~30 sec vs 3 min)
- Slightly less accurate but good enough for vibe-check

---

## Explain Endpoint (Personalized "Why")

After WPA, generate personalized explanation for a specific user.

```typescript
// POST /api/wpa/explain
{
  listing_id: "idealista_12345",
  user_id: "user_abc",
  fit_score: 82
}

// Response
{
  explanation: "This place nails what you care about most - those huge 
               south-facing windows mean great light for your home office,
               and the balcony gives you outdoor space for breaks. The 
               kitchen is compact, but you mentioned you mostly order in."
}
```

- **Model:** Gemini 2.5 Flash-Lite
- **Cost:** ~$0.001/explanation
- **Cached:** Per user × listing (in Supabase)

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wpa/describe` | POST | Photos → prose description |
| `/api/wpa/score` | POST | Prose → 35 dimension scores |
| `/api/wpa/explain` | POST | Generate personalized explanation |
| `/api/wpa/instant` | POST | Quick WPA for vibe-check |

---

## Files to Create

```
src/app/api/wpa/
├── describe/route.ts    # Vision → prose descriptions
├── score/route.ts       # Prose → 35 dimension scores
├── explain/route.ts     # Per-user personalized "why"
├── instant/route.ts     # Quick WPA for vibe-check
└── route.ts             # Combined WPA endpoint

src/lib/wpa/
├── cache.ts             # DynamoDB cache helpers
├── dimensions.ts        # Dimension definitions
└── prompts.ts           # WPA prompts
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-03-RECOMMENDER](./P0-03-RECOMMENDER.md) | Fit scoring algorithm |
| [ULTIMATE_PIPELINE.md](../archive/ULTIMATE_PIPELINE.md) | AI model decisions |

---

*Last Updated: December 2024*

