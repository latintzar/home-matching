# 🏠 P0 Lean App - Fully Functional MVP

> **Single Source of Truth** for the Leo.casa P0 MVP build.
> 
> **This is a COMPLETE, WORKING APP** — not a prototype.

---

## 🎯 QUICK REFERENCE: What to Build

> ⚠️ **EVOLUTION NOTICE**: This section defines the **NEW approach** to WPA, Fit Scoring, and Recommendations.
> It **supersedes** all previous implementations in the codebase:
> 
> | Component | OLD Location | NEW Approach |
> |-----------|--------------|--------------|
> | WPA | `src/app/api/listings/[id]/analysis/whole-property/` | **NEW**: 2-step (describe → score), 35 dimensions, cached in DynamoDB |
> | Fit Scoring | Scattered/incomplete | **NEW**: Algorithmic 55-dimension scoring in `fitScoring.ts` |
> | Recommendations | `src/lib/recommender/orchestrator.ts` | **EVOLVE**: Add pre-WPA scoring, WPA integration, threshold-based flow |
> | Psychologist | `src/lib/lifestyle/ai-profiler.ts` | **EVOLVE**: Feed into dimension weights for fit scoring |
> | Neighborhood | Social Radar only | **NEW**: 20-dimension SERP research + H3 geo-matching |
> | In-Call Analysis | None | **NEW**: WPA + show_property tool + carousel |
> 
> **Key Changes:**
> - WPA is now **2 calls** (describe then score) instead of 1
> - WPA uses **Gemini 2.5 Flash-Lite** (~$0.003/WPA) for cost sustainability
> - WPA has **35 dimensions** (was ~8)
> - Fit scoring is **algorithmic** (no LLM)
> - Recommendations are **threshold-based** (not just ranked)
> - All WPA is **cached in DynamoDB** (shared across users)
> - Neighborhood data comes from **SERP research** (not just Airbnb)

### Total Investment: ~$72

| Phase | Cost | What |
|-------|------|------|
| **One-time setup** | $27 | Airbnb analysis, SERP research, initial harvest |
| **Month 1 fixed** | $45 | ScrapingDog ($40) + DynamoDB (~$5) |
| **Per user** | $0.32 | WPA, Psychologist, Explains |

### Break-even: 5 users

---

### Code to Deprecate/Replace

```
DEPRECATE (old approach, keep for reference):
├── src/app/api/listings/[id]/analysis/whole-property/   # Old single-call WPA
├── src/lib/recommender/wpaShortlist.ts                  # Old WPA integration
└── src/lib/intelligence/social-radar.ts                 # Replace with SERP data

EVOLVE (modify existing):
├── src/lib/recommender/orchestrator.ts                  # Add pre-WPA + threshold flow
├── src/lib/lifestyle/ai-profiler.ts                     # Output dimension weights
├── src/app/(app)/property/[id]/LeanPropertyContent.tsx  # Add PersonalizedMatch
└── src/app/(app)/speak-with-leo/SpeakWithLeoContent.tsx # Add carousel component

CREATE (new files):
├── src/app/api/wpa/*                                    # New 2-step WPA
├── src/lib/recommender/fitScoring.ts                    # Algorithmic scoring
├── src/lib/recommender/preWpaFitScore.ts                # Free pre-filtering
├── src/lib/geo/neighborhoodMatcher.ts                   # H3 geo-matching
├── tool_configs/show_property.json                      # ElevenLabs tool
└── scripts/serp-research.ts                             # One-time SERP research
```

### Implementation Phases

```
PHASE 1: Pre-Launch Setup (~$27, one-time)
├── [✅] Run Airbnb review analysis script .............. $14 → scripts/airbnb-analysis.ts
├── [✅] Run SERP neighborhood research (10 cities) ..... $8  → scripts/serp-research.ts
├── [✅] Geocode neighborhoods + build H3 lookup ........ FREE → src/lib/geo/h3-lookup.ts
└── [ ] Initial property harvest + parse ................ $5

PHASE 2: Core WPA Pipeline (Week 1) ✅ COMPLETE
├── [✅] POST /api/wpa/describe (vision → prose)
├── [✅] POST /api/wpa/score (prose → 35 dimensions)
├── [✅] DynamoDB: leo-wpa-cache table .................. scripts/setup-dynamodb-tables.ts
└── [✅] src/lib/recommender/fitScoringV2.ts

PHASE 3: Recommender Integration (Week 1-2) ✅ COMPLETE
├── [✅] Pre-WPA fit scoring (FREE, algorithmic) ....... src/lib/recommender/preWpaFitScore.ts
├── [✅] Neighborhood profile lookup (H3 geo-matching) . src/lib/recommender/neighborhoodService.ts
├── [✅] Full fit scoring (WPA + neighborhood + listing) src/lib/recommender/fitScoringV2.ts
└── [✅] Integration with orchestrator.ts .............. src/lib/recommender/orchestratorV2.ts

PHASE 4: Personalization (Week 2) ✅ COMPLETE
├── [✅] POST /api/wpa/explain (Flash-lite, $0.0003)
├── [✅] <PersonalizedMatch /> component ............... src/components/recommender/PersonalizedMatch.tsx
├── [ ] Psychologist profile updates (Flash, $0.006)
└── [✅] user_property_explanations table .............. supabase/migrations/020_vibe_check_tables.sql

PHASE 5: In-Call Vibe Check (Week 3) ✅ MOSTLY COMPLETE
├── [✅] POST /api/wpa/instant (Flash, $0.004)
├── [✅] POST /api/agents/vibe-check (carousel trigger) src/app/api/agents/vibe-check/route.ts
├── [✅] Create tool_configs/show_property.json
├── [ ] elevenlabs tools push show_property.json
├── [ ] elevenlabs agents update (attach tools to Leo-Intake-v2, Leo-Pro-Intake)
├── [ ] Update agent prompts with tool usage instructions
├── [✅] Frontend property carousel component .......... src/components/recommender/PropertyCarousel.tsx
├── [✅] WebSocket/Realtime push to frontend ........... PropertyCarousel.tsx (useVibeCheckCarousel hook)
├── [ ] Parallel WPA during What-Ifs conversation
└── [ ] Feedback interpreter → Psychologist loop

PHASE 6: Daily Recommendations (Week 3) ✅ COMPLETE
├── [✅] Cron: 3x daily recommendation push ............ src/app/api/cron/daily-recommendations/route.ts
├── [✅] Pre-WPA threshold filtering ................... Part of orchestratorV2.ts
├── [✅] WPA caching (shared across users) ............. src/lib/wpa/cache.ts
└── [✅] Push notifications / email .................... supabase/migrations/021_daily_recommendations.sql
```

### Key Files to Create

```
src/app/api/wpa/
├── describe/route.ts    # Vision → prose descriptions
├── score/route.ts       # Prose → 35 dimension scores
├── explain/route.ts     # Per-user personalized "why"
└── route.ts             # WPA endpoint

src/lib/recommender/
├── fitScoring.ts        # Algorithmic 55-dimension scoring
├── preWpaFitScore.ts    # FREE ranking before WPA
├── wpaCache.ts          # DynamoDB cache helpers
└── profileWeights.ts    # User preference weights

src/lib/geo/
└── neighborhoodMatcher.ts  # H3 geo-matching

scripts/
├── airbnb-analysis.ts   # One-time Airbnb processing
├── serp-research.ts     # One-time neighborhood research
└── build-h3-lookup.ts   # Build geo-index

tool_configs/
├── check_availability.json  # ✅ EXISTS
├── update_profile.json      # ✅ EXISTS
└── show_property.json       # ❌ CREATE

agent_configs/  (modify existing)
├── Leo-Intake-v2.json       # Add tools + update prompt
└── Leo-Pro-Intake.json      # Add tools + update prompt
```

### ElevenLabs Agent Setup (via CLI)

```bash
# 1. Export API key
export ELEVENLABS_API_KEY=$(grep ELEVENLABS_API_KEY .env.local | cut -d'=' -f2)

# 2. Pull existing agents
elevenlabs agents pull --all

# 3. Create/update tool configs
tool_configs/
├── check_availability.json  ✅ EXISTS
├── update_profile.json      ✅ EXISTS
└── show_property.json       ❌ NEEDS CREATION

# 4. Push tools to ElevenLabs
elevenlabs tools push tool_configs/check_availability.json
elevenlabs tools push tool_configs/update_profile.json
elevenlabs tools push tool_configs/show_property.json

# 5. Attach tools to agents
elevenlabs agents update Leo-Intake-v2 --add-tool check_availability
elevenlabs agents update Leo-Intake-v2 --add-tool update_profile
elevenlabs agents update Leo-Intake-v2 --add-tool show_property
elevenlabs agents update Leo-Pro-Intake --add-tool check_availability
elevenlabs agents update Leo-Pro-Intake --add-tool update_profile
elevenlabs agents update Leo-Pro-Intake --add-tool show_property

# 6. Push updated agent configs
elevenlabs agents push agent_configs/Leo-Intake-v2.json
elevenlabs agents push agent_configs/Leo-Pro-Intake.json
```

#### Tool Configs Needed

| Tool | Endpoint | Purpose | Status |
|------|----------|---------|--------|
| `check_availability` | `/api/agents/check-availability` | Count properties matching criteria | ✅ EXISTS |
| `update_profile` | `/api/agents/update-profile` | Save extracted preferences | ✅ EXISTS |
| `show_property` | `/api/agents/vibe-check` | Show carousel + get reaction | ❌ CREATE |

#### show_property.json (TO CREATE)

```json
{
  "type": "webhook",
  "name": "show_property",
  "description": "Show the user a property carousel on their screen. Use when you want to validate properties with them or understand their visual preferences.",
  "response_timeout_secs": 10,
  "api_schema": {
    "url": "https://leo.casa/api/agents/vibe-check",
    "method": "POST",
    "content_type": "application/json",
    "request_body_schema": {
      "type": "object",
      "required": ["userId"],
      "properties": {
        "userId": {
          "type": "string",
          "description": "The user's ID",
          "is_system_provided": true,
          "dynamic_variable": "user_id"
        },
        "transcriptContext": {
          "type": "string",
          "description": "Last ~500 chars of conversation for context"
        },
        "specificRequest": {
          "type": "string",
          "description": "What to look for (e.g., 'more light', 'bigger kitchen')"
        },
        "count": {
          "type": "integer",
          "description": "Number of properties to show (1-5)",
          "default": 3
        }
      }
    }
  }
}
```

#### Agent Prompt Updates

Both `Leo-Intake-v2` and `Leo-Pro-Intake` need prompt updates:

```
// Add to agent system prompt:

You have access to these tools:

1. **check_availability** - Call after getting budget + location to tell user how many properties match
2. **update_profile** - Call after extracting any preference to save it immediately
3. **show_property** - Call during What-Ifs to show 3-5 properties and gauge their reaction

IMPORTANT FLOW:
- During core intake: use check_availability to validate search is realistic
- After each preference shared: call update_profile to save immediately
- During What-Ifs: call show_property to visually validate preferences
- Frame property showing as: "Let me show you a few places - it'll help me understand what catches your eye"
```

### Cost Per User Per Month (with Gemini 2.5 Flash-Lite WPA)

| Period | AI Cost | Margin @ €10/mo |
|--------|---------|-----------------|
| Month 1 (cold start, worst case) | ~$3-5 | €5-7 (50-70%) |
| Month 2+ (cache hits) | ~$1-2 | €8-9 (80-90%) |

> **Note (Jan 2025)**: These costs assume Gemini 2.5 **Flash-Lite** for WPA (~$0.003/WPA).
> - Worst case: 900 WPAs/month × $0.003 = $2.70 (just WPA)
> - With ElevenLabs, emails, etc: ~$3-5 total
> - Using Flash ($0.03/WPA) would cost $27/month = unprofitable

---

## 📚 Related Documentation

| Document | Purpose |
|----------|---------|
| [BUILD_PLAN.md](./BUILD_PLAN.md) | Original 12-day build plan with phases |
| [UI_BY_USER_TYPE.md](./UI_BY_USER_TYPE.md) | Detailed UI specs for all 4 user types |
| [PROPERTY_REPORTS_DESIGN.md](./PROPERTY_REPORTS_DESIGN.md) | Property page priority order |
| [LEO_HOMEPAGE_REBUILD.md](LEO_HOMEPAGE_REBUILD.md) | Homepage branding and Jack & Jill inspiration |
| [ULTIMATE_PIPELINE.md](../archive/ULTIMATE_PIPELINE.md) | Data pipeline and AI models |

> **📍 Imminent Tasks (Agents & Billing)** are documented in the [IMMINENT TASKS section](#-imminent-tasks-before-p0-is-complete) below.
---

## 🚨 WHAT'S LEFT TO BUILD (P0 Complete Checklist)

### A. Core App Features (Tasks 1-7)

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| 1. Speak with Leo Agents | 🔴 | ✅ Complete | Basic intake working |
| 2. Billing with Stripe | 🔴 | ✅ Complete | €10/mo renter |
| 3. Notes Processing Flow | 🔴 | ✅ Complete | Text notes working |
| 4. Property Liking Feature | 🟡 | ✅ Complete | Save to shortlist |
| 5. Property Page Improvements | 🟡 | ✅ Complete | |
| **6. Linked Profile Architecture** | 🔴 | ❌ TODO | Renter ↔ Buyer switching |
| **7. Buyer UI (Clone of Renter)** | 🔴 | ❌ TODO | Clone existing UI |

### B. Recommender Pipeline V3 (Parts 1-17 in this doc)

| Phase | Area | Status | Est. Hours | Reference |
|-------|------|--------|------------|-----------|
| **Phase 1** | Foundation | ❌ TODO | 11 hr | Supabase schema, isochrones, zones |
| **Phase 2** | During-Call Features | ❌ TODO | 14 hr | WPA Quick, POI, vibe-check routes |
| **Phase 3** | UI Components | ❌ TODO | 20 hr | Animations, modals, WebSocket, cards |
| **Phase 4** | ElevenLabs Agent | ❌ TODO | 12 hr | State machine, tools, prompts |
| **Phase 5** | Batch Processing | ❌ TODO | 16 hr | Fit scoring v2, emails |
| **Phase 6** | Monitoring | ❌ TODO | 14 hr | Cron jobs, follow-up agent |
| | **TOTAL** | | **~87 hr** | |

### C. AI Operations Summary

| Operation | Model | Cost | What It Does |
|-----------|-------|------|--------------|
| **WPA** | Gemini 2.5 Flash-Lite | $0.003/listing | Visual analysis of 30 property photos |
| **AI Profiler** | Gemini 2.5 Pro | $0.30/profile | User lifestyle/preference inference |
| **Social Radar** | Gemini 2.5 Flash | $0.02/scan | Airbnb review analysis (noise, tourists) |
| **Cadastre** | Gov API | FREE | Official m2, year built, building info |
| **ElevenLabs** | GPT-4o Mini + Multilingual v2 | $0.08/min | Voice conversation |
| **Explanations** | Flash-Lite | $0.001/listing | "Why this matches you" text |


### D. Cost Control Safeguards

| Safeguard | Status | Notes |
|-----------|--------|-------|
| WPA uses Gemini 2.5 Flash-Lite | ✅ Documented | ~$0.003/WPA, NOT Flash (~$0.03) or Pro (~$0.90) |
| No listing photo storage | ✅ Implemented | `rejectBase64Images()` in dynamodb.ts |
| S3 image upload blocked | 📝 Documented | S3 bucket policy needed |
| ESLint base64 rules | 📝 Documented | Add to .eslintrc.js |

### E. Migrations Pending

| Migration | Purpose | Status |
|-----------|---------|--------|
| ✅ 070 | Text analysis | Applied |
| ✅ 071 | Property views | Applied |
| ✅ 072 | Notes | Applied |
| ❌ 075 | Linked profiles | **TODO** |
| ❌ 076 | Notes media (photo/voice) | **TODO** |
| ❌ 077 | Leo responses | **TODO** |
| ❌ 078 | Preference weights | **TODO** |
| ❌ 079 | Recommender V3 schema | **TODO** (Part 9) |

### F. Quick Reference: Where to Find Details

| Topic | Section |
|-------|---------|
| Recommender Pipeline Flow | **Part 1-8** (Intake → Zones → Batch) |
| Implementation Checklist | **Part 9** (Supabase, DynamoDB, APIs, UI) |
| Phased Build Order | **Part 10** (6 phases with test gates) |
| External Dependencies | **Part 11** (API keys, costs) |
| Cost Per User | **Part 12** (~$2.50 month 1, ~$1.50 ongoing) |
| No Photo Storage Rule | **Part 12.1** (URL-only architecture) |
| Error Handling | **Part 13** |
| ElevenLabs Tools | **Part 14** |
| Performance Requirements | **Part 15** |
| Effort Estimate | **Part 16** (~87 hr total) |
| UI Cards (Call + Chat) | **Part 17** (overlays, inline cards) |

### G. Homepage Enhancements (End of P0)

| Task | Description | Est. Hours |
|------|-------------|------------|
| **G.1** | **How It Works Addition** | 1 hr |
| | Add note to renter flow: "If we find there isn't much being listed within your criteria, we'll ask for a follow-up call to get a quick sense of what you're flexible on." | |
| **G.2** | **Neighborhood Discovery Section** | 6 hr |
| | Full-width section under "How It Works" with: | |
| | • Interactive map of Barcelona with neighborhood boundaries (Spain GeoJSON) | |
| | • Labels on neighborhoods: "LGBTQ+ Friendly", "Great for Parents", "Health Conscious" | |
| | • Text explaining: "We help you explore neighborhoods that fit you, even if you don't know the city. We score neighborhoods across 20 dimensions like walkability, nightlife, family-friendliness, green spaces, and more." | |
| **G.3** | **Look & Feel Card Layout** | 2 hr |
| | On desktop: Make "Look & Feel" card full-width (image more visible) | |
| | Other 3 cards below in a single row (3-column grid) | |
| **G.4** | **Spain GeoJSON Import to DynamoDB** | 2 hr |
| | Import neighborhood boundaries from https://geo2day.com/europe/spain.geojson | |
| | Store in `leo-neighborhood-boundaries` table for instant queries | |
| | Same data used for: homepage map, isochrones, neighborhood scoring | |
| | **TOTAL** | **11 hr** |

**G.2 Implementation Details:**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DISCOVER YOUR NEIGHBORHOOD                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │                                 │  │                                         │  │
│  │  [STATIC BARCELONA MAP - SVG]   │  │  Don't know the city? No problem.       │  │
│  │  (Styled like Hero isochrones)  │  │                                         │  │
│  │                                 │  │  We score every neighborhood across     │  │
│  │   ╭─────────╮                   │  │  20 dimensions to find what fits YOU:   │  │
│  │   │ Gràcia  │ "LGBTQ+           │  │                                         │  │
│  │   │   🟢    │  Friendly"        │  │  • Walkability & transit access         │  │
│  │   ╰─────────╯                   │  │  • Nightlife & dining scene             │  │
│  │        ╭──────────╮             │  │  • Family-friendliness                  │  │
│  │        │ Eixample │ "Health     │  │  • Green spaces & outdoor lifestyle     │  │
│  │        │   🟡     │  Conscious" │  │  • LGBTQ+ community                     │  │
│  │        ╰──────────╯             │  │  • Young professional scene             │  │
│  │   ╭───────────╮                 │  │  • Pet-friendliness                     │  │
│  │   │ Sarrià    │ "Great for      │  │  • And 13 more...                       │  │
│  │   │    🟠     │  Parents"       │  │                                         │  │
│  │   ╰───────────╯                 │  │  [Talk to Leo →]                        │  │
│  │                                 │  │                                         │  │
│  │  (Soft blob shapes, gradients)  │  │                                         │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Map Styling (Match Hero Isochrone Blobs):**
- Static SVG rendered from GeoJSON neighborhood boundaries
- Soft, organic blob shapes (SVG path smoothing / bezier curves)
- Gradient fills with transparency (same colors as zone system)
- Gentle glow/shadow effects
- Labels positioned at centroids

**G.3 Card Layout (Desktop):**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LOOK & FEEL (Full Width)                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           [LARGE IMAGE]                                      │   │
│  │                                                                              │   │
│  │  Tell us your vibe and we'll find places that feel like home.               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│  LIFESTYLE                │  │  LOCATION                 │  │  BUDGET                   │
│  [Image]                  │  │  [Image]                  │  │  [Image]                  │
│                           │  │                           │  │                           │
│  Your daily routine       │  │  Commute & neighborhood   │  │  What you can afford      │
│  matters to us.           │  │  preferences.             │  │  (we're honest).          │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
```

**Files to Create/Modify:**

| File | Change |
|------|--------|
| `src/app/page.tsx` | Add neighborhood section, modify card layout |
| `src/components/home/NeighborhoodMapStatic.tsx` | Static SVG from GeoJSON (Hero blob style) |

### G.4: Spain Neighborhood GeoJSON Data (One-Time Setup)

**Source:** https://geo2day.com/europe/spain.geojson

This GeoJSON contains all neighborhood boundaries for Spain. We store it in DynamoDB for instant queries.

**DynamoDB Table:** `leo-neighborhood-boundaries`

| Field | Type | Description |
|-------|------|-------------|
| `city` (PK) | string | "barcelona", "madrid", "valencia", etc. |
| `neighborhood_id` (SK) | string | Unique ID for the neighborhood |
| `name` | string | Display name (e.g., "Gràcia", "Eixample") |
| `geojson` | JSON | GeoJSON Feature geometry (Polygon/MultiPolygon) |
| `centroid` | `{lat, lng}` | Center point for label positioning |

**One-Time Import Script:**

```typescript
// scripts/import-spain-geojson.ts
import { docClient } from '@/lib/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import * as turf from '@turf/turf';

const GEOJSON_URL = 'https://geo2day.com/europe/spain.geojson';
const TABLE_NAME = 'leo-neighborhood-boundaries';

async function importNeighborhoods() {
  console.log('Fetching Spain GeoJSON from geo2day.com...');
  const response = await fetch(GEOJSON_URL);
  const data = await response.json();
  
  console.log(`Found ${data.features.length} features`);
  
  for (const feature of data.features) {
    const { properties, geometry } = feature;
    
    // Extract city from properties (varies by data source)
    const city = extractCity(properties);
    if (!city) continue;
    
    const neighborhoodId = properties.id || slugify(properties.name);
    const centroid = turf.centroid(geometry);
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        city: city.toLowerCase(),
        neighborhood_id: neighborhoodId,
        name: properties.name,
        geojson: geometry,
        centroid: {
          lat: centroid.geometry.coordinates[1],
          lng: centroid.geometry.coordinates[0],
        },
      }
    }));
    
    console.log(`Imported: ${city} / ${properties.name}`);
  }
}

function extractCity(props: any): string | null {
  // Logic depends on GeoJSON structure
  return props.city || props.municipality || null;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

importNeighborhoods();
```

**Query for Homepage (Barcelona):**

```typescript
// src/lib/neighborhoods.ts
import { docClient } from '@/lib/dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export async function getNeighborhoodBoundaries(city: string) {
  const result = await docClient.send(new QueryCommand({
    TableName: 'leo-neighborhood-boundaries',
    KeyConditionExpression: 'city = :city',
    ExpressionAttributeValues: { ':city': city.toLowerCase() },
  }));
  
  return result.Items || [];
}

// Usage in homepage
const barcelonaNeighborhoods = await getNeighborhoodBoundaries('barcelona');
```

**Why DynamoDB (not static file)?**
- Instant queries by city (partition key)
- No file loading at runtime
- Same data used for:
  - **Homepage static map** (G.2)
  - **Shape generation from isochrones** (Part 6)
  - **Neighborhood profile lookups** (scoring)
  - **Fit scoring** (is listing inside preferred neighborhoods?)

**Est. Time:** 2 hr (script + DynamoDB table creation)

---

> **START HERE:** Run Phase 1 tasks first (Part 10). Each phase has a test gate.

---

### 🔧 How to Apply Migrations (DO NOT FORGET)

```bash
# 1. Get project ID
mcp_supabase_list_projects()
# Returns: myugajfmoijskiwvwgfa

# 2. Apply migration via MCP
mcp_supabase_apply_migration(
  project_id: "myugajfmoijskiwvwgfa",
  name: "migration_name_here",
  query: "-- SQL here"
)
```

**NEVER** use the wrong project ID (e.g., `fxaiqfvrrycrjnpctqkq` is wrong).

---

### Task 1: Speak with Leo Agents 🎙️

#### 1.1 Onboarding State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING STATES                             │
├─────────────────────────────────────────────────────────────────┤
│ State 0: NOTHING_DONE                                           │
│   - User signed up but never talked to Leo                      │
│   - intake_step = 0, intake_completed = false                   │
│                                                                 │
│ State 1: CORE_STARTED                                           │
│   - User started onboarding but didn't finish core questions    │
│   - intake_step = 1-5, intake_completed = false                 │
│                                                                 │
│ State 2: CORE_FINISHED                                          │
│   - Core questions done, but whatifs not started                │
│   - intake_step = 6, whatifs_completed = false                  │
│                                                                 │
│ State 3: WHATIFS_FINISHED                                       │
│   - Full onboarding complete                                    │
│   - intake_completed = true, whatifs_completed = true           │
│                                                                 │
│ State 4+: FOLLOWUPS_ADDED                                       │
│   - User has had N follow-up conversations                      │
│   - followup_count = 1, 2, 3, ... N                            │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.2 Database Columns (✅ Applied)

```sql
-- Migration: 070_onboarding_states.sql (APPLIED)
intake_step INTEGER DEFAULT 0
whatifs_completed BOOLEAN DEFAULT FALSE
followup_count INTEGER DEFAULT 0
last_followup_at TIMESTAMPTZ
```

#### 1.3 ElevenLabs Agents to Create

> **⚠️ UPDATED**: Separate agents for Renter vs Buyer. See [Linked Profile Architecture](#-linked-profile-architecture) for full details.

| Agent | Profile Type | Purpose | Gets Context | Updates |
|-------|--------------|---------|--------------|---------|
| `leo-intake-renter` | Renter | First-time renter intake | Nothing | Creates renter profile |
| `leo-intake-buyer` | Buyer | First-time buyer intake | Nothing | Creates buyer profile |
| `leo-intake-renter-pro` | Renter | Pro's client renter intake | Pro info + client | Profile + pro_clients |
| `leo-intake-buyer-pro` | Buyer | Pro's client buyer intake | Pro info + client | Profile + pro_clients |
| `leo-whatifs-renter` | Renter | Explore renter tradeoffs | Renter profile | Tradeoffs, flexibility |
| `leo-whatifs-buyer` | Buyer | Explore buyer tradeoffs | Buyer profile | Tradeoffs, flexibility |
| `leo-followup` | Both | Post-onboarding check-ins | Active profile | Any changes |

**Key Differences:**
- **Renter intake**: Focuses on lifestyle, commute, monthly budget, neighborhood vibe
- **Buyer intake**: Adds renovation appetite, investment vs living, total purchase budget

#### 1.4 APIs to Create

```typescript
// POST /api/agents/context - Get profile context for agent
interface AgentContextRequest {
  agentId: string;
  userId: string;
  conversationType: 'onboarding' | 'whatifs' | 'followup';
}

// POST /api/agents/update-profile - Update profile after conversation
interface ProfileUpdateRequest {
  conversationId: string;
  userId: string;
  extractedData: { budget?, preferences?, dealbreakers?, tradeoffs? };
}
```

#### 1.5 UI States for Speak with Leo Page

| State | Title | Agent | Sidebar Badge |
|-------|-------|-------|---------------|
| NOTHING_DONE | "Conoce a Leo" | `leo-intake-{profileType}` | 🔴 Red |
| CORE_STARTED | "Continúa donde lo dejaste" | `leo-intake-{profileType}` | 🔴 Red |
| CORE_FINISHED | "Exploremos algunos 'qué pasaría si'" | `leo-whatifs-{profileType}` | 🟡 Yellow |
| WHATIFS_FINISHED | "¿Hay algo que quieras actualizar?" | `leo-followup` | None |

> **Note**: Agent is selected based on `user_profiles.active_profile_type` (renter or buyer).

#### 1.6 Fix Orb Cropping

```tsx
// AmorphousOrb.tsx - Add padding to viewBox
const PADDING = 1.3; // 30% padding for blob overflow
viewBox={`0 0 ${size * PADDING} ${size * PADDING}`}
```

#### 1.7 Task 1 Checklist

- [x] Apply migration 070 (onboarding states)
- [x] Apply migration 075 (linked profiles) ✅ Dec 4
- [x] Create ElevenLabs agent configs:
  - [x] `leo-intake-renter` — Renter intake (Leo-Intake-v2.json)
  - [x] `leo-intake-buyer` — Buyer intake (Leo-Intake-Buyer.json)
  - [x] `leo-intake-renter-pro` — Pro's renter client intake (Leo-Intake-Renter-Pro.json)
  - [x] `leo-intake-buyer-pro` — Pro's buyer client intake (Leo-Intake-Buyer-Pro.json)
  - [x] `leo-whatifs-renter` — Renter tradeoffs (Leo-WhatIfs-Renter.json)
  - [x] `leo-whatifs-buyer` — Buyer tradeoffs (Leo-WhatIfs-Buyer.json)
  - [x] `leo-followup` — General followup (Leo-Followup.json)
  - [ ] **TODO**: Push new agents to ElevenLabs Dashboard (CLI only updates existing)
- [x] Create `/api/agents/context` endpoint (updated for profile_type)
- [x] Create `/api/agents/update-profile` endpoint
- [x] Create `/api/profile/switch` endpoint ✅ Dec 4
- [x] Create `/api/profile/create` endpoint ✅ Dec 4
- [x] Update `SpeakWithLeoContent.tsx` with state machine
- [x] Update `SpeakWithLeoContent.tsx` for profile-specific agents ✅ Dec 4
- [x] Add notification badge to sidebar
- [x] Add profile switcher to sidebar ✅ Dec 4
- [x] Add alert banners for incomplete states
- [x] Fix orb cropping issue

---

### Task 2: Billing Page with Stripe 💳

#### 2.1 Install & Configure Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
stripe login --api-key $STRIPE_SECRET_KEY
```

#### 2.2 Stripe Products

> **⚠️ UPDATED**: Billing is now at USER level (not profile). One subscription = one profile type.
> See [Linked Profile Architecture](#-linked-profile-architecture) for subscription rules.

```bash
# Renter - €9.99/month
stripe products create --name="Leo.casa Alquiler (Renter)"
stripe prices create --product="prod_RENTER" --unit-amount=999 --currency=eur --recurring[interval]=month

# Buyer - €9.99/month (same price as renter for P0)
stripe products create --name="Leo.casa Compra (Buyer)"
stripe prices create --product="prod_BUYER" --unit-amount=999 --currency=eur --recurring[interval]=month

# Pro - €49/month
stripe products create --name="Leo.casa Pro"
stripe prices create --product="prod_PRO" --unit-amount=4900 --currency=eur --recurring[interval]=month
```

#### 2.3 Database Columns

> **⚠️ UPDATED**: Billing columns moved to `user_profiles` (not `user_lifestyle_profiles`).

```sql
-- Migration: 071_billing_tables.sql (APPLIED to user_lifestyle_profiles)
-- Migration: 075_linked_profiles.sql (MOVES to user_profiles)

-- On user_profiles (USER level, not profile level):
stripe_customer_id TEXT
subscription_type TEXT  -- 'renter', 'buyer', or 'pro'
subscription_status TEXT DEFAULT 'none'
stripe_subscription_id TEXT
stripe_price_id TEXT
subscription_started_at TIMESTAMPTZ
subscription_ends_at TIMESTAMPTZ
```

#### 2.4 Billing APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/billing/checkout` | POST | Create Stripe Checkout session |
| `/api/billing/subscription` | GET | Get current subscription status |
| `/api/billing/invoices` | GET | Get invoice history |
| `/api/billing/pause` | POST | Pause subscription |
| `/api/billing/resume` | POST | Resume subscription |
| `/api/webhooks/stripe` | POST | Handle Stripe events |

#### 2.5 Billing Page UI

> **⚠️ UPDATED**: Shows per-profile subscriptions. User can subscribe to one or both.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 💳 Facturación                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Tus suscripciones                                                       │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🏠 Alquiler (Renter)                                   ✅ ACTIVA   │ │
│ │ €9,99/mes · Próximo cobro: 15 ene 2026                              │ │
│ │ [Pausar]  [Cancelar]                                                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🔑 Compra (Buyer)                                      ❌ NO ACTIVA │ │
│ │ €9,99/mes                                                           │ │
│ │ [Suscribirse →]                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Historial de facturas                                                   │
│ ─────────────────────────────────────────────────────────────────────── │
│ Fecha      │ Plan     │ Importe │ Estado  │                             │
│ 15 dic 25  │ Alquiler │ €9,99   │ ✅ Paid  │ [Ver →]                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.6 Task 2 Checklist

- [x] Apply migration 071 (billing tables)
- [ ] Install Stripe CLI (user setup required)
- [ ] Configure Stripe products and prices (user setup required)
- [x] Create Checkout endpoint (`/api/billing/checkout`)
- [x] Create subscription status endpoint (`/api/billing/subscription`)
- [x] Create invoices endpoint (`/api/billing/invoices`)
- [x] Create pause/resume endpoints (`/api/billing/pause`, `/api/billing/resume`)
- [x] Set up Stripe webhooks (updated `/api/stripe/webhook`)
- [x] Create Billing page UI (`/billing`)
- [x] Add "Facturación" to sidebar

---

### Task 3: Notes Processing Flow 📝 (HIGH PRIORITY)

User notes are a critical feedback signal. When a user takes notes on a property, we learn what they like/dislike.

#### 3.1 Notes UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User views property → Takes notes                               │
│                                                                 │
│ "Love the balcony but kitchen is too small"                     │
│ "Hate the carpet, would need to redo floors"                    │
│ "Perfect location near the park"                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    [20 minute delay]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Background job triggers:                                        │
│                                                                 │
│ 1. Analyze notes with AI                                        │
│ 2. Extract likes/dislikes                                       │
│ 3. Update user profile preferences                              │
│ 4. Recalculate fit scores for saved properties                  │
│ 5. Queue WPA update if significant preference change            │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Database Schema (Migration Required)

```sql
-- Migration: 072_notes_processing.sql

-- Track when notes were last processed
ALTER TABLE user_notes
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extracted_signals JSONB;

-- Store extracted preference signals
CREATE TABLE IF NOT EXISTS user_preference_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'followup_call', 'onboarding')),
  source_id UUID, -- note ID or conversation ID
  signal_type TEXT NOT NULL CHECK (signal_type IN ('like', 'dislike', 'must_have', 'dealbreaker')),
  category TEXT NOT NULL, -- 'kitchen', 'location', 'floor', 'balcony', etc.
  description TEXT,
  confidence FLOAT DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_preference_signals_user ON user_preference_signals(user_id);
```

#### 3.3 Notes Processing API

```typescript
// POST /api/notes/process - Triggered by cron after 20min delay
interface NotesProcessRequest {
  noteIds: string[]; // Notes to process
}

interface ExtractedSignal {
  type: 'like' | 'dislike' | 'must_have' | 'dealbreaker';
  category: string; // 'kitchen', 'balcony', 'location', etc.
  description: string;
  confidence: number;
}

// What the AI extracts from notes
interface NotesAnalysis {
  signals: ExtractedSignal[];
  profileUpdates: {
    addToPreferences?: string[];
    addToDealbreakers?: string[];
    updateTradeoffs?: Record<string, number>;
  };
  shouldUpdateWPA: boolean; // True if significant new preference
}
```

#### 3.4 Notes Processing: Cron vs Direct

**Why delay processing by 20 minutes?**
- User might add multiple notes in a session
- Batch all notes together = better AI context
- 5 separate API calls vs 1 batched call

**Option A: Vercel Cron (recommended for batching)**
```typescript
// Vercel Cron: /api/cron/process-notes
// Schedule: Every 5 minutes
// vercel.json: { "crons": [{ "path": "/api/cron/process-notes", "schedule": "*/5 * * * *" }] }

export async function GET(request: Request) {
  // 1. Find ALL unprocessed notes across ALL users (> 20 min old)
  const { data: notes } = await supabase
    .from('user_notes')
    .select('*')
    .is('processed_at', null)
    .lt('created_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
    .limit(500); // Pagination for scale

  // 2. Group by user_id
  const byUser = groupBy(notes, 'user_id');

  // 3. Process each user in parallel
  await Promise.all(
    Object.entries(byUser).map(([userId, userNotes]) =>
      processUserNotes(userId, userNotes)
    )
  );
  
  return Response.json({ processed: notes?.length || 0 });
}
```

**Option B: On-demand (debounce after 1 min of no typing)**
```typescript
// In notes panel, debounce processing
const debouncedProcess = useDebouncedCallback(
  async (noteId: string) => {
    await fetch('/api/notes/process', { 
      method: 'POST', 
      body: JSON.stringify({ noteIds: [noteId] }) 
    });
  },
  60_000 // 1 minute of no typing
);
```

**Decision**: Use **both**:
- Option B (debounce) for fast feedback on current note
- Option A (cron) as fallback to catch any missed notes

#### 3.5 Follow-up Calls: How They Update Profile

**Follow-up calls are different from notes:**
- Notes = user writes text → delayed batch processing
- Follow-up calls = real-time conversation → immediate processing via webhook

```
┌─────────────────────────────────────────────────────────────────┐
│ Follow-up Call Flow                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. User clicks "Habla con Leo" (onboarding complete)            │
│ 2. ElevenLabs agent: leo-followup-normal                        │
│ 3. Agent gets context: current profile + recent activity        │
│ 4. User says: "Actually I want a bigger balcony now"            │
│ 5. Conversation ends                                            │
│ 6. ElevenLabs webhook → POST /api/agents/update-profile         │
│ 7. Extract CHANGES from transcript (Gemini)                     │
│ 8. Apply deltas to profile (don't overwrite everything)         │
│ 9. Increment followup_count, set last_followup_at               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key: Deltas, not overwrites**

```typescript
// POST /api/agents/update-profile
interface ProfileDelta {
  // Only fields that changed
  addPreferences?: string[];      // ["bigger balcony"]
  removePreferences?: string[];   // []
  addDealbreakers?: string[];     // []
  updateBudget?: { min?: number; max?: number };
  updateTradeoffs?: Record<string, number>;
}

// Apply delta to existing profile
const updatedProfile = {
  ...existingProfile,
  preferences: [...existingProfile.preferences, ...delta.addPreferences],
  // etc.
};
```

**Stored as preference signal too:**

```sql
INSERT INTO user_preference_signals (
  user_id, source_type, source_id, signal_type, category, description
) VALUES (
  $userId, 'followup_call', $conversationId, 'like', 'balcony', 'wants bigger balcony'
);
```

---

#### 3.6 Fit Score vs WPA: What Updates When?

**IMPORTANT: Two different things get updated at different times.**

```
┌─────────────────────────────────────────────────────────────────┐
│ FIT SCORES = How well a specific property matches the user      │
│ WPA = Search criteria for finding NEW properties                │
└─────────────────────────────────────────────────────────────────┘
```

| What | When | Why |
|------|------|-----|
| **Fit Scores** | IMMEDIATELY after notes/followup | User wants instant feedback |
| **WPA** | Weekly | Major criteria changes are rare |

**Flow after notes/follow-up processed:**

```
Notes processed OR Follow-up call ends
         ↓
Extract preference signals (likes/dislikes)
         ↓
Store in user_preference_signals table
         ↓
IMMEDIATELY: Recalculate fit scores for user's saved properties
         ↓
WEEKLY: Check if WPA needs regeneration
```

**Fit Score Recalculation (immediate):**
```typescript
// After processing notes or follow-up
async function updateFitScores(userId: string) {
  // Get user's saved/viewed properties
  const { data: savedProps } = await supabase
    .from('user_saved_properties')
    .select('listing_id')
    .eq('user_id', userId);
  
  // Get updated preference signals
  const signals = await getUserPreferenceSignals(userId);
  
  // Recalculate fit score for each property
  for (const prop of savedProps) {
    const newFitScore = calculateFitScore(prop.listing_id, signals);
    // Store updated fit score (could be in cache or DB)
  }
}
```

#### 3.7 Weekly WPA Assessment (Search Criteria)

**Weekly WPA job decides whether to regenerate the user's WPA (search criteria).**

Only regenerate WPA for **major** changes:
- New dealbreaker identified
- Budget range changed significantly
- Location preferences shifted
- Multiple consistent patterns (e.g., keeps disliking ground floor)

```
┌─────────────────────────────────────────────────────────────────┐
│ Weekly WPA Assessment (Vercel Cron)                             │
├─────────────────────────────────────────────────────────────────┤
│ For each user:                                                  │
│                                                                 │
│ 1. Check preference_signals since last WPA update               │
│ 2. Look for patterns (3+ similar dislikes = dealbreaker?)       │
│ 3. If significant changes detected:                             │
│    - Generate new WPA with updated criteria                     │
│    - Store new WPA                                              │
│    - Trigger recommendation refresh                             │
└─────────────────────────────────────────────────────────────────┘
```

**Start with Vercel Cron**, switch to Lambda if scale requires it.

#### 3.8 Task 3 Checklist

- [x] Apply migration 072 (notes_processing) - Creates `user_notes`, `user_preference_signals`, `user_saved_properties`
- [x] Create `/api/notes/process` endpoint
- [ ] ~~Add 1-minute debounce to notes panel~~ → **See Task 8: WhatsApp-Style Notes**
- [x] Create `/api/cron/process-notes` cron job (runs every 5 min via vercel.json)
- [x] Implement AI note analysis (keyword-based) → **Upgrading to Gemini in Task 8**
- [x] Create `user_preference_signals` table logic
- [x] **Recalculate fit scores immediately** after notes processed (placeholder implementation)
- [ ] Update weekly WPA cron to check signals (TODO: separate task)
- [ ] ~~Test full flow: note → 1 min → process → fit scores update~~ → **Task 8**

---

### Task 4: Property Liking Feature ❤️

Save/Like functionality must be fully working with proper UI feedback.

#### 4.1 Current State

- ✅ API exists: `/api/saved` (GET, POST, DELETE)
- ✅ Database table exists: `user_saved_properties`
- ⚠️ UI needs polish

#### 4.2 UI Requirements

```
┌─────────────────────────────────────────────────────────────────┐
│ Property Card (in list)                                         │
├─────────────────────────────────────────────────────────────────┤
│ [Photo]                                                         │
│ €250,000 · 3 bed · 2 bath · 85m²                                │
│ Malasaña, Madrid                                                │
│                                              [♡] / [♥]          │
│                                              (toggles on click)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Property Page (detail view)                                     │
├─────────────────────────────────────────────────────────────────┤
│ [Guardar propiedad] button → becomes [♥ Guardada] when saved    │
│ Optimistic UI update (instant feedback)                         │
│ Toast notification on save/unsave                               │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 Task 4 Checklist

- [x] Add heart icon toggle to PropertyCard component (already existed)
- [x] Implement optimistic UI updates (instant feedback)
- [x] Add toast notifications for save/unsave (using Sonner)
- [x] Show "Guardada" state clearly on property page
- [ ] Add saved count to dashboard stats (TODO: dashboard update)
- [ ] Create "Guardados" section in Propiedades page (TODO: saved page)

---

### Task 5: Property Page Improvements 🏠

#### 5.1 Show Property Description

Currently missing from property page. Must display the listing description.

```tsx
// In LeanPropertyContent.tsx, add after basic info:
<div className="mt-6">
  <h3 className="font-medium text-stone-900 mb-2">Descripción</h3>
  <p className="text-stone-600 whitespace-pre-wrap">
    {listing.description}
  </p>
</div>
```

#### 5.2 Fullscreen Photo Viewer

When user clicks a photo, open fullscreen gallery (like `test-recommendations-linear`).

Reference implementation: `src/app/test-recommendations-linear/`

```tsx
// Components needed:
// - FullscreenPhotoViewer (modal/overlay)
// - Photo carousel with navigation arrows
// - Close button (X or click outside)
// - Keyboard navigation (left/right arrows, ESC to close)
// - Swipe on mobile
```

#### 5.3 Task 5 Checklist

- [x] Add property description section to property page
- [x] Import/adapt FullscreenPhotoViewer (using PhotoGalleryModal)
- [x] Add click handler to photos to open fullscreen
- [x] Implement keyboard navigation (arrows, ESC) - via PhotoGalleryModal
- [ ] Test on mobile (swipe gestures) - TODO: testing

---

### Task 6: Linked Profile Architecture 🔗

> **Goal**: Enable one user to have both Renter and Buyer profiles, with independent data.
> See [Linked Profile Architecture](#-linked-profile-architecture) for full spec.

#### 6.1 Database Migration (075_linked_profiles.sql)

```sql
-- Add profile_type to lifestyle_profiles
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter' 
  CHECK (profile_type IN ('renter', 'buyer'));

-- Unique constraint: (user_id, profile_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_profile_type 
  ON user_lifestyle_profiles(user_id, profile_type);

-- Track active profile at user level
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS active_profile_type TEXT DEFAULT 'renter';

-- Add profile_type to saved_properties
ALTER TABLE saved_properties
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter';

-- Move billing to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_type TEXT;
-- (see full migration in Linked Profile Architecture section)
```

#### 6.2 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/profile/switch` | POST | Switch active profile type |
| `/api/profile/create` | POST | Create second profile type |
| `/api/profile` | GET | Get active profile + other profiles |
| `/api/pro/link-request` | POST | Pro requests to link with Leo user |
| `/api/pro/approve-link` | POST | Client approves pro link |

#### 6.3 UI Components

- [ ] Profile switcher dropdown in sidebar
- [ ] "Create Profile" modal for new profile type
- [ ] Updated billing page with per-profile subscriptions
- [ ] Link approval notification for clients

#### 6.4 Task 6 Checklist

- [ ] Apply migration 075 (linked profiles)
- [ ] Create `/api/profile/switch` endpoint
- [ ] Create `/api/profile/create` endpoint
- [ ] Update `/api/profile` endpoint
- [ ] Create `/api/pro/link-request` endpoint
- [ ] Create `/api/pro/approve-link` endpoint
- [ ] Add profile switcher to sidebar
- [ ] Create "Create Profile" modal
- [ ] Update billing page UI
- [ ] Update all data queries to filter by `profile_type`

---

### Task 7: Buyer UI (Clone of Renter) 🔑

> **Goal**: Create Buyer UI as exact clone of Renter UI, just with different label.
> NO buyer-exclusive features in P0 (no checklist, no renovation, no comparison).

#### 7.1 What's Identical

Everything in the Renter flow applies to Buyer:
- Dashboard
- Speak with Leo (different agent, same UI)
- Recommendations feed
- Property detail page
- Saved properties
- Notes (text, photo, voice)
- Settings
- Billing

#### 7.2 What's Different

| Aspect | Renter | Buyer |
|--------|--------|-------|
| **Label** | "Alquilando" | "Comprando" |
| **Icon** | 🏠 | 🔑 |
| **Intake agent** | `leo-intake-renter` | `leo-intake-buyer` |
| **Whatifs agent** | `leo-whatifs-renter` | `leo-whatifs-buyer` |
| **Budget field** | `budget_max` (monthly) | `budget_max` (total purchase) |
| **Price display** | €X/mes | €X |

#### 7.3 ElevenLabs Agents to Create

| Agent | Purpose | Key Questions |
|-------|---------|---------------|
| `leo-intake-buyer` | Buyer intake | Budget, renovation appetite, investment goals |
| `leo-intake-buyer-pro` | Pro's buyer client | Same + pro context |
| `leo-whatifs-buyer` | Buyer tradeoffs | Location vs space, new vs character, etc. |

#### 7.4 Implementation Steps

1. **Create buyer-specific agents** in ElevenLabs
2. **Update agent selection** in `/api/agents/context` to use `profile_type`
3. **Update sidebar** to show correct label/icon based on active profile
4. **Update data fetching** to filter by `profile_type`
5. **Test full flow** with buyer profile

#### 7.5 Task 7 Checklist

- [ ] Create `leo-intake-buyer` agent in ElevenLabs
- [ ] Create `leo-intake-buyer-pro` agent in ElevenLabs
- [ ] Create `leo-whatifs-buyer` agent in ElevenLabs
- [ ] Update `/api/agents/context` for profile-specific agents
- [ ] Update sidebar labels/icons for buyer mode
- [ ] Test buyer intake flow end-to-end
- [ ] Test switching between renter and buyer

---

### Task 8: WhatsApp-Style Notes 📝💬

> **Goal**: Transform the notes panel into a WhatsApp-like chat where users can dump text, photos, and voice notes freely. Leo periodically responds with his "two cents" about the property based on their notes.

#### 8.1 The UX Vision

```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Tus notas sobre este piso                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [You]: La cocina es pequeña         ✓✓ 14:32              │
│                                                             │
│  [You]: Pero me gusta la luz         ✓✓ 14:32              │
│                                                             │
│  [You]: [🎤 0:08 ▶────────]          ✓✓ 14:33              │
│                                                             │
│  [You]: [📸 kitchen photo]           ✓✓ 14:33              │
│                                                             │
│  [Leo]: 🤔 Dame un momento...                               │
│         (ONLY NOW shows loading in send button)             │
│                                                             │
│  [Leo]: ✨ Esto es lo que pienso:                           │
│         La luz natural es algo que valoras mucho -          │
│         cocina pequeña pero luminosa > grande y oscura.     │
│         He actualizado tus preferencias.                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [📷] [🎤] [  Escribe aquí...                     ] [➤]     │
│                                   (normal send, no loading)  │
└─────────────────────────────────────────────────────────────┘
```

#### 8.2 Key UX Principles

| Behavior | WhatsApp-Style | NOT like Q&A Chat |
|----------|----------------|-------------------|
| User sends text | **Instant appear** ✓✓ | ~~Loading spinner~~ |
| User sends photo | **Instant appear** with thumbnail | ~~Wait for processing~~ |
| User sends voice | **Instant appear** with waveform | ~~Transcription wait~~ |
| Send button state | **Normal arrow** (always) | ~~Square while waiting~~ |
| Leo responds | **Loading only then** | ~~Loading on every send~~ |

**The key insight**: User messages are notes, not questions. They appear instantly. Leo responds periodically (after ~1 min idle), NOT after every message.

#### 8.3 Component Architecture

```
NotesChat (new component)
├── NotesList
│   ├── UserNote (text)
│   ├── UserNote (photo) ─────────> Supabase Storage
│   ├── UserNote (voice) ─────────> Supabase Storage
│   └── LeoResponse
├── NotesInput
│   ├── PhotoPicker (camera + gallery)
│   ├── VoiceRecorder (hold-to-record)
│   └── TextInput
└── useDebouncedLeoResponse (1 min idle → trigger Leo)
```

#### 8.4 How It Connects to Recommendation Engine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NOTES → RECOMMENDATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User writes notes     User idle for 1 min     Leo's "Two Cents"        │
│       ↓                      ↓                       ↓                  │
│  Store in DB           Trigger Analysis        Show in Chat             │
│  (instant)             (/api/notes/analyze)    + Toast notification     │
│                              ↓                                          │
│                    ┌─────────────────────┐                              │
│                    │  Gemini Analysis    │                              │
│                    │  - Read all notes   │                              │
│                    │  - Read photos      │                              │
│                    │  - Transcribe voice │                              │
│                    │  - Extract signals  │                              │
│                    └─────────────────────┘                              │
│                              ↓                                          │
│                    ┌─────────────────────┐                              │
│                    │ Store Signals       │                              │
│                    │ user_preference_    │                              │
│                    │ signals table       │                              │
│                    └─────────────────────┘                              │
│                              ↓                                          │
│          ┌───────────────────┴───────────────────┐                      │
│          ↓                                       ↓                      │
│  ┌───────────────────┐               ┌───────────────────┐              │
│  │ IMMEDIATE:        │               │ WEEKLY:           │              │
│  │ Recalculate       │               │ Check if WPA      │              │
│  │ Fit Scores        │               │ needs update      │              │
│  │ for saved props   │               │ (new dealbreakers │              │
│  └───────────────────┘               │  or preferences)  │              │
│          ↓                           └───────────────────┘              │
│  Update property                                                        │
│  cards with new                                                         │
│  fit scores                                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 8.5 Signal Types Extracted from Notes

| Signal Type | Example Note | Impact |
|-------------|--------------|--------|
| `like` | "Me gusta la luz" | +weight to natural_light in fit scoring |
| `dislike` | "La cocina muy pequeña" | -weight to small_kitchen tolerance |
| `must_have` | "Necesito terraza sí o sí" | Adds `outdoor_space` as requirement |
| `dealbreaker` | "Nunca sin ascensor" | Adds `elevator_required` dealbreaker |
| `photo_context` | 📸 of dark room | AI extracts "lighting concern" |
| `voice_sentiment` | 🎤 "Ugh this bathroom..." | AI extracts tone + content |

#### 8.6 Leo's "Two Cents" Response Format

```typescript
interface LeoTwoCentsResponse {
  summary: string;           // "Esto es lo que pienso..."
  observations: {
    positives: string[];     // Things user seems to like
    concerns: string[];      // Things user seems worried about
    tradeoffs: string[];     // "Te gusta la luz > tamaño cocina"
  };
  profileUpdates: {
    newLikes: string[];      // Added to preferences
    newDislikes: string[];   // Added to avoid list
    newDealbreakers: string[]; // Critical requirements
  };
  fitScoreImpact: {
    thisProperty: number;    // Updated fit score for current property
    reason: string;          // "Subió porque valoras la luz"
  };
}
```

#### 8.7 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notes` | POST | Create note (text/photo/voice) - INSTANT |
| `/api/notes` | GET | Get notes for listing |
| `/api/notes/analyze` | POST | **NEW**: Trigger Leo's analysis |
| `/api/notes/upload` | POST | **NEW**: Upload photo/voice to Storage |

#### 8.8 Database Changes

```sql
-- Notes table already exists, add media support:
ALTER TABLE property_notes ADD COLUMN IF NOT EXISTS 
  media_type TEXT CHECK (media_type IN ('text', 'photo', 'voice'));
ALTER TABLE property_notes ADD COLUMN IF NOT EXISTS 
  media_url TEXT;  -- Supabase Storage URL
ALTER TABLE property_notes ADD COLUMN IF NOT EXISTS 
  media_duration_ms INTEGER;  -- For voice notes
ALTER TABLE property_notes ADD COLUMN IF NOT EXISTS 
  transcription TEXT;  -- Voice → text

-- Leo's responses (separate from user notes)
CREATE TABLE IF NOT EXISTS leo_note_responses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  profile_type TEXT DEFAULT 'renter',
  trigger_note_ids BIGINT[],  -- Which notes triggered this response
  response_json JSONB NOT NULL,  -- LeoTwoCentsResponse
  signals_extracted JSONB,
  fit_score_before INTEGER,
  fit_score_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 8.9 Current Implementation Status (As of Dec 4, 2025)

| Component | Have? | What Exists | What's Missing |
|-----------|-------|-------------|----------------|
| Notes CRUD API | ✅ | `/api/notes` - create, read, delete | Media upload |
| Notes table | ✅ | `property_notes` with profile_type | media_type, media_url, transcription columns |
| Signal extraction | ⚠️ | Keyword-based regex in `/api/notes/process` | Gemini-powered extraction |
| `user_preference_signals` table | ✅ | Stores extracted signals | Category → dimension mapping |
| Cron job | ✅ | Every 5 min, processes notes >20 min old | Change to 1-min debounce |
| `recalculateFitScores()` | ⚠️ | Function exists but just logs | Actually recalculate |
| WPA analysis | ✅ | Gemini analyzes photos → scores | - |
| Fit scoring math | ✅ | `fitScoringV2.ts` calculates scores | Wire user signals → weights |
| WhatsApp-style UI | ❌ | - | NotesChat component |
| Photo notes | ❌ | - | PhotoPicker + Storage |
| Voice notes | ❌ | - | VoiceRecorder + transcription |
| Leo's "two cents" | ❌ | - | `/api/notes/analyze` |
| Signals → Weights | ❌ | Signals stored but not used | Wire to fit scoring |

#### 8.9.1 The `user_preference_signals` Table - What It Is

**Current schema:**
```sql
CREATE TABLE user_preference_signals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  source_type TEXT NOT NULL,  -- 'note', 'followup_call', 'onboarding'
  source_id UUID,             -- note ID or conversation ID
  signal_type TEXT NOT NULL,  -- 'like', 'dislike', 'must_have', 'dealbreaker'
  category TEXT,              -- 'light', 'kitchen', 'location', etc.
  description TEXT,           -- original text snippet
  confidence FLOAT,           -- 0-1
  created_at TIMESTAMPTZ
);
```

**Current categories (keyword-based):**
```
kitchen, bathroom, bedroom, living_room, outdoor_space, 
light, location, noise, flooring, storage, size, 
transport, parking, general
```

**The Gap: Categories are informal, not mapped to scoring dimensions.**

These categories are rough keyword buckets. They DON'T cleanly map to:

| What We Have | What We Need to Map To |
|--------------|------------------------|
| `category: 'light'` | `wpa.scores.natural_light_intensity` |
| `category: 'kitchen'` | `wpa.scores.kitchen_functionality` |
| `category: 'size'` | `listing.sqm` + `wpa.scores.perceived_spaciousness` |
| `category: 'location'` | `neighborhood.scores.*` |
| `category: 'noise'` | `wpa.scores.noise_level` + `neighborhood.noise` |

**Solution: Create a mapping layer**

```typescript
// CATEGORY → SCORING DIMENSIONS MAPPING
const SIGNAL_TO_DIMENSION: Record<string, string[]> = {
  // Maps note categories to WPA/listing/neighborhood dimensions
  
  // WPA dimensions
  light: ['wpa.natural_light_intensity'],
  kitchen: ['wpa.kitchen_functionality', 'wpa.kitchen_size'],
  bathroom: ['wpa.bathroom_condition', 'wpa.bathroom_count'],
  outdoor_space: ['wpa.outdoor_space_quality', 'listing.has_terrace'],
  storage: ['wpa.storage_quality'],
  flooring: ['wpa.flooring_condition'],
  
  // Listing dimensions  
  size: ['listing.sqm', 'wpa.perceived_spaciousness'],
  bedroom: ['listing.bedrooms'],
  parking: ['listing.has_parking'],
  
  // Location/neighborhood dimensions
  location: ['neighborhood.overall_score'],
  noise: ['wpa.noise_level', 'neighborhood.noise_score'],
  transport: ['neighborhood.transit_score', 'listing.commute_minutes'],
};
```

This mapping is what connects "user said they like light" to "boost the weight of natural_light_intensity in fit scoring".

#### 8.9.2 Signal → Weight → Fit Score Pipeline (THE GAP)

**This is the critical piece that needs building.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  CURRENT STATE (broken pipe)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Notes → Signals → [STORED] → ??? → Fit Scores                              │
│                         ↑                                                   │
│                         └── Data sits here, unused                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                  NEEDED STATE (complete pipe)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Notes → Signals → MAPPING → Weights → Fit Scores                           │
│              │         │         │           │                              │
│              ▼         ▼         ▼           ▼                              │
│         user_pref   SIGNAL_   user_life   fitScoringV2                      │
│         _signals   TO_DIM    style_prof  .calculateFit                      │
│         table      mapping   .preference  Score()                           │
│                              _weights                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step-by-step what needs to happen:**

```typescript
// STEP 1: User writes note
"Me encanta la luz de este piso"

// STEP 2: Signal extracted (already works)
{
  signal_type: "like",
  category: "light",
  confidence: 0.8
}

// STEP 3: Map category to scoring dimensions (NEEDS BUILDING)
const dimensions = SIGNAL_TO_DIMENSION["light"];
// → ["wpa.natural_light_intensity"]

// STEP 4: Calculate weight adjustment (NEEDS BUILDING)
// Formula: For each "like" signal, increase weight by (0.1 × confidence)
// For each "dislike" signal, decrease weight by (0.1 × confidence)
const adjustment = 0.1 * 0.8; // = +0.08

// STEP 5: Store in user profile (NEEDS BUILDING)
await supabase
  .from('user_lifestyle_profiles')
  .update({
    preference_weights: {
      ...existingWeights,
      "wpa.natural_light_intensity": (existingWeights["wpa.natural_light_intensity"] || 1.0) + 0.08
    }
  })
  .eq('user_id', userId);

// STEP 6: Fit scoring uses weights (NEEDS WIRING)
function calculateFitScore(wpa, profile) {
  const userWeights = profile.preference_weights || {};
  
  // Base weight is 1.0, user adjustment modifies it
  const lightWeight = userWeights["wpa.natural_light_intensity"] || 1.0;
  // lightWeight is now 1.08 (slightly more important to this user)
  
  const lightScore = wpa.scores.natural_light_intensity * lightWeight;
  // ... calculate other dimensions similarly
}
```

**The mapping file we need to create:**

```typescript
// src/lib/signals/signalToDimensionMap.ts

export const SIGNAL_TO_DIMENSION: Record<string, {
  dimensions: string[];
  affectsListingFilter?: boolean;  // Should this change search results too?
  description: string;
}> = {
  // ═══════════════════════════════════════════════════════════════
  // WPA-BASED DIMENSIONS (from photo analysis)
  // ═══════════════════════════════════════════════════════════════
  
  light: {
    dimensions: ['wpa.natural_light_intensity', 'wpa.window_quality'],
    description: 'Natural light and brightness',
  },
  
  kitchen: {
    dimensions: ['wpa.kitchen_functionality', 'wpa.kitchen_size', 'wpa.kitchen_condition'],
    description: 'Kitchen quality and size',
  },
  
  bathroom: {
    dimensions: ['wpa.bathroom_condition', 'wpa.bathroom_modernity'],
    description: 'Bathroom quality',
  },
  
  outdoor_space: {
    dimensions: ['wpa.outdoor_space_quality', 'wpa.has_outdoor_space'],
    affectsListingFilter: true,  // Can become a hard filter
    description: 'Balcony, terrace, garden',
  },
  
  storage: {
    dimensions: ['wpa.storage_quality', 'wpa.closet_space'],
    description: 'Storage and closets',
  },
  
  flooring: {
    dimensions: ['wpa.flooring_condition', 'wpa.flooring_quality'],
    description: 'Floor condition',
  },
  
  living_room: {
    dimensions: ['wpa.living_room_size', 'wpa.living_room_condition'],
    description: 'Living room quality',
  },
  
  bedroom: {
    dimensions: ['wpa.bedroom_size', 'wpa.bedroom_count'],
    affectsListingFilter: true,  // Can change bedroom minimum
    description: 'Bedroom size and count',
  },
  
  // ═══════════════════════════════════════════════════════════════
  // LISTING-BASED DIMENSIONS (from property data)
  // ═══════════════════════════════════════════════════════════════
  
  size: {
    dimensions: ['listing.sqm', 'wpa.perceived_spaciousness'],
    affectsListingFilter: true,
    description: 'Overall property size',
  },
  
  parking: {
    dimensions: ['listing.has_parking', 'listing.parking_type'],
    affectsListingFilter: true,
    description: 'Parking availability',
  },
  
  // ═══════════════════════════════════════════════════════════════
  // LOCATION-BASED DIMENSIONS (from neighborhood analysis)
  // ═══════════════════════════════════════════════════════════════
  
  location: {
    dimensions: ['neighborhood.overall_score', 'neighborhood.safety_score'],
    description: 'General location quality',
  },
  
  noise: {
    dimensions: ['wpa.noise_level', 'neighborhood.noise_score'],
    description: 'Noise and tranquility',
  },
  
  transport: {
    dimensions: ['neighborhood.transit_score', 'listing.metro_distance'],
    description: 'Public transport access',
  },
  
  // ═══════════════════════════════════════════════════════════════
  // GENERAL (fallback)
  // ═══════════════════════════════════════════════════════════════
  
  general: {
    dimensions: ['overall_impression'],
    description: 'General preference, not specific',
  },
};

// Helper function
export function getDimensionsForCategory(category: string): string[] {
  return SIGNAL_TO_DIMENSION[category]?.dimensions || ['overall_impression'];
}

export function shouldAffectFilter(category: string): boolean {
  return SIGNAL_TO_DIMENSION[category]?.affectsListingFilter || false;
}
```

**Task 8 Checklist update - add mapping layer:**

- [ ] Create `src/lib/signals/signalToDimensionMap.ts`
- [ ] Add `preference_weights` JSONB column to `user_lifestyle_profiles`
- [ ] Create `aggregateSignalsToWeights()` function
- [ ] Wire weights into `fitScoringV2.ts`
- [ ] Test: write note → signal extracted → weight updated → fit score changes

#### 8.10 Implementation Steps

**Phase A: Core Chat UI**
1. Create `NotesChat` component (fork of UnifiedChat)
2. Implement instant-send behavior (no loading on user messages)
3. Add message types: text, photo, voice, leo_response
4. Style like WhatsApp (bubbles, timestamps, checkmarks)

**Phase B: Photo Notes**
1. Create `PhotoPicker` component (camera + gallery)
2. Implement Supabase Storage upload
3. Show thumbnail in chat immediately
4. Store photo URL in `property_notes.media_url`

**Phase C: Voice Notes**
1. Create `VoiceRecorder` component (hold-to-record)
2. Implement Supabase Storage upload for audio
3. Show waveform player in chat
4. Transcribe voice using Gemini (async, after upload)

**Phase D: Leo's Two Cents**
1. Implement 1-min debounce hook
2. Create `/api/notes/analyze` endpoint
3. Use Gemini to analyze all recent notes + photos + transcriptions
4. Generate structured response
5. Extract preference signals
6. Update fit scores immediately
7. Return response to chat

**Phase E: Recommendation Integration**
1. Store signals in `user_preference_signals`
2. Trigger fit score recalculation
3. Update property cards with new scores
4. Show "✅ Preferencias actualizadas" toast

#### 8.10 Task 8 Checklist

**Phase A: WhatsApp-Style UI**
- [ ] Create `NotesChat` component with WhatsApp-style UX
- [ ] Implement instant-send (no loading on user messages)
- [ ] Style message bubbles (user right, Leo left, timestamps, checkmarks)

**Phase B: Photo Notes**
- [ ] Add `PhotoPicker` component (camera + gallery)
- [ ] Create Supabase Storage bucket for note media
- [ ] Create `/api/notes/upload` endpoint

**Phase C: Voice Notes**
- [ ] Add `VoiceRecorder` component (hold-to-record)
- [ ] Add `VoicePlayer` component (waveform display)
- [ ] Add voice transcription (Gemini)

**Phase D: Leo's Two Cents**
- [ ] Implement 1-min debounce for Leo's response (`useDebouncedLeoResponse` hook)
- [ ] Create `/api/notes/analyze` endpoint (Gemini)
- [ ] Extract signals from notes (AI-powered, not just keywords)

**Phase E: Signal → Weight → Fit Score Pipeline (THE GAP)**
- [ ] Create `src/lib/signals/signalToDimensionMap.ts` (mapping file)
- [ ] Add `preference_weights` JSONB column to `user_lifestyle_profiles`
- [ ] Create `aggregateSignalsToWeights()` function
- [ ] Wire weights into `fitScoringV2.calculateFitScore()`
- [ ] Test: note → signal → weight updated → fit score changes

**Phase F: Database & Polish**
- [ ] Update `property_notes` table schema for media (migration 076)
- [ ] Create `leo_note_responses` table
- [ ] Add "Preferencias actualizadas" toast
- [ ] Test full flow: note → 1 min → Leo responds → fit scores update

---

### File Structure for Imminent Tasks

```
src/
├── app/
│   ├── (app)/
│   │   ├── billing/
│   │   │   ├── page.tsx
│   │   │   └── BillingContent.tsx
│   │   ├── property/[id]/
│   │   │   └── LeanPropertyContent.tsx  # Integrate NotesChat
│   │   └── speak-with-leo/
│   │       └── SpeakWithLeoContent.tsx  # Updated with state machine
│   └── api/
│       ├── agents/
│       │   ├── context/route.ts
│       │   └── update-profile/route.ts
│       ├── billing/
│       │   ├── checkout/route.ts
│       │   ├── subscription/route.ts
│       │   ├── invoices/route.ts
│       │   ├── pause/route.ts
│       │   └── resume/route.ts
│       ├── cron/
│       │   └── process-notes/route.ts   # Notes processing cron
│       ├── notes/
│       │   ├── route.ts                 # CRUD for notes
│       │   ├── process/route.ts         # Process notes endpoint
│       │   ├── analyze/route.ts         # NEW: Leo's "two cents" (Gemini)
│       │   └── upload/route.ts          # NEW: Upload photo/voice to Storage
│       └── webhooks/
│           └── stripe/route.ts
├── components/
│   ├── billing/
│   │   ├── SubscriptionCard.tsx
│   │   ├── InvoiceTable.tsx
│   │   ├── PauseModal.tsx
│   │   └── ResumeModal.tsx
│   ├── notes/                           # NEW: WhatsApp-Style Notes (Task 8)
│   │   ├── NotesChat.tsx                # Main chat component
│   │   ├── NoteMessage.tsx              # Individual note bubble
│   │   ├── LeoResponse.tsx              # Leo's "two cents" bubble
│   │   ├── PhotoPicker.tsx              # Camera + gallery picker
│   │   ├── VoiceRecorder.tsx            # Hold-to-record
│   │   └── VoicePlayer.tsx              # Waveform audio player
│   ├── property/
│   │   ├── PropertyCard.tsx             # Add heart icon
│   │   └── FullscreenPhotoViewer.tsx    # From test-recommendations-linear
│   └── ui/
│       └── AmorphousOrb.tsx             # Fix cropping
├── hooks/
│   └── useDebouncedLeoResponse.ts       # NEW: 1-min debounce for Leo
└── lib/
    ├── stripe.ts
    ├── notes-processor.ts               # AI note analysis
    ├── notes-analyzer.ts                # NEW: Gemini analysis for Leo's two cents
    └── signals/
        ├── signalToDimensionMap.ts      # NEW: Maps categories → WPA/listing/neighborhood dimensions
        └── aggregateSignalsToWeights.ts # NEW: Converts signals → preference_weights
```

### Migrations Required

| Migration | Purpose | Status |
|-----------|---------|--------|
| 070_onboarding_states.sql | intake_step, whatifs, followup tracking | ✅ Applied |
| 071_billing_tables.sql | Stripe customer/subscription fields | ✅ Applied |
| 072_notes_and_signals.sql | user_notes, user_preference_signals, user_saved_properties | ✅ Applied |
| 075_linked_profiles.sql | profile_type on tables, pro linking, user-level billing | ✅ Applied |
| 076_notes_media.sql | media_type, media_url, transcription on notes | ❌ Pending |
| 077_leo_responses.sql | leo_note_responses table for chat history | ❌ Pending |
| 078_preference_weights.sql | Add preference_weights JSONB to user_lifestyle_profiles | ❌ Pending |

---

## 🎯 What P0 Means

**P0 = A COMPLETE, WORKING APP.** Everything works end-to-end for all 4 user types.

### ✅ Everything That Works in P0

| Category | Feature | Status |
|----------|---------|--------|
| **Auth** | Sign in with Google | ✅ Works |
| **Auth** | Sign in with Apple | ✅ Works |
| **Auth** | Sign in with Magic Link | ✅ Works |
| **Auth** | Sign in split (Renter/Buyer vs Professional) | ✅ Works |
| **Onboarding** | Call/chat with Leo (voice orb) | ✅ Works |
| **Onboarding** | Leo learns preferences | ✅ Works |
| **Profile** | See profile summary | ✅ Works |
| **Profile** | See isochrone map | ✅ Works |
| **Profile** | Have follow-up call to update | ✅ Works |
| **Recommendations** | See properties in Dashboard | ✅ Works |
| **Recommendations** | Get alerts via Email | ✅ Works |
| **Recommendations** | Get alerts via WhatsApp | ✅ Works |
| **Recommendations** | Recommendations update based on notes | ✅ Works |
| **Property** | View property details | ✅ Works |
| **Property** | See Fit Score with reasons | ✅ Works |
| **Property** | Contact Agent (WhatsApp/call) | ✅ Works |
| **Property** | Save/Like property | ✅ Works |
| **Notes** | Add text notes | ✅ Works |
| **Notes** | Add photo notes | ✅ Works |
| **Notes** | Add voice notes | ✅ Works |
| **Notes** | Mark property as viewed | ✅ Works |
| **Saved** | See all saved properties | ✅ Works |
| **Pro** | See all clients in dashboard | ✅ Works |
| **Pro** | Add new client | ✅ Works |
| **Pro** | Choose intake method (self or send link) | ✅ Works |
| **Pro** | View client profile | ✅ Works |
| **Pro** | See client's likes | ✅ Works |
| **Pro** | See client's notes | ✅ Works |
| **Pro** | See recommendations for client | ✅ Works |
| **Pro** | Build shortlist for client | ✅ Works |
| **Pro** | Send shortlist to client | ✅ Works |
| **Public** | Client views shortlist (no login) | ✅ Works |
| **Public** | Client can like properties | ✅ Works |
| **Public** | Client can take notes | ✅ Works |

### ⏳ What's Deferred (Property Page Only)

| Feature | When | Why |
|---------|------|-----|
| AI Chat Sidebar | P1 | Ask Leo questions about property |
| Viewing Checklist | P1 | Suggested questions to ask |
| Renovation Tiers | P2 | Cost estimates for renovation |
| Full Report Cards | P2 | Detailed analysis (Airbnb, geology, etc.) |
| Comparison View | P1 | Compare properties side-by-side |
| Team Dashboard | P2 | Enterprise team management |

**Note**: These deferred features are ONLY for the property detail page. Everything else is fully functional.

---

## 👥 4 User Types

| Type | Pricing | Core Need |
|------|---------|-----------|
| **Renter** | €9.99/mo | Find rentals that fit lifestyle |
| **Buyer** | €9.99/mo | Find purchases that fit lifestyle (same as renter for P0) |
| **Personal Shopper** | €49/client | Manage clients, build shortlists |
| **Relocation Agent** | Enterprise | Same as Personal Shopper (P2 adds team features) |

> **🔗 IMPORTANT**: Renter and Buyer are **separate profile types**, not modes. A user can have BOTH profiles and switch between them. See [Linked Profile Architecture](#-linked-profile-architecture) below.

---

## 🔗 Linked Profile Architecture

> **CRITICAL ARCHITECTURE DECISION**: One user can have multiple search profiles (Renter + Buyer). This enables life transitions (rent while renovating → buy later) without losing data.

### The Core Concept

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ONE AUTH USER (auth.users)                                             │
│  ├── email: operator@example.invalid                                           │
│  ├── id: uuid-123                                                       │
│  └── role: 'renter_buyer' (not 'professional')                          │
│                                                                         │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │  RENTER PROFILE         │    │  BUYER PROFILE          │            │
│  │  ────────────────────── │    │  ────────────────────── │            │
│  │  profile_type: 'renter' │    │  profile_type: 'buyer'  │            │
│  │  budget: €1,200/mo      │    │  budget: €350,000       │            │
│  │  areas: Gràcia, Born    │    │  areas: Poblenou, 22@   │            │
│  │  bedrooms: 2            │    │  bedrooms: 3            │            │
│  │  intake_completed: ✅    │    │  intake_completed: ❌    │            │
│  │                         │    │                         │            │
│  │  [Separate saved props] │    │  [Separate saved props] │            │
│  │  [Separate notes]       │    │  [Separate notes]       │            │
│  │  [Separate recs]        │    │  [Separate recs]        │            │
│  └─────────────────────────┘    └─────────────────────────┘            │
│                                                                         │
│  ACTIVE PROFILE: 'renter' ← User sees renter data in UI                 │
│  [Toggle in sidebar to switch]                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Use Case | Before | After |
|----------|--------|-------|
| Renter buys a house | Loses renter history | Both profiles preserved |
| Buyer rents while renovating | Create new account | Switch to renter profile |
| Pro links to existing user | External contact only | Real account linking |
| Different search criteria | One set of prefs | Independent prefs per type |

### Database Schema Changes

#### Migration: 075_linked_profiles.sql

```sql
-- ============================================
-- 1. Add profile_type to lifestyle_profiles
-- ============================================

-- Add profile_type column (defaults to 'renter' for existing)
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter' 
  CHECK (profile_type IN ('renter', 'buyer'));

-- CRITICAL: One profile per type per user
-- (user_id + profile_type) is the logical primary key
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_profile_type 
  ON user_lifestyle_profiles(user_id, profile_type);

-- ============================================
-- 2. Track active profile at user level
-- ============================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS active_profile_type TEXT DEFAULT 'renter'
  CHECK (active_profile_type IN ('renter', 'buyer'));

-- ============================================
-- 3. Add profile_type to saved_properties
-- ============================================

-- Saved properties are PER PROFILE, not per user
ALTER TABLE saved_properties
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- Update unique constraint
DROP INDEX IF EXISTS saved_properties_user_id_listing_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_properties_unique 
  ON saved_properties(user_id, listing_id, profile_type);

-- ============================================
-- 4. Add profile_type to property_notes
-- ============================================

ALTER TABLE property_notes
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- ============================================
-- 5. Pro-Client Linking (to existing Leo users)
-- ============================================

ALTER TABLE pro_clients
ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id);

-- If linked, the pro can view (not edit) the client's profile
-- The client must approve the link via email/notification

-- ============================================
-- 6. Move billing to user_profiles (user level)
-- ============================================

-- Billing is per USER, not per profile
-- One subscription unlocks ONE profile type

-- Add to user_profiles if not already on user_lifestyle_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_type TEXT 
  CHECK (subscription_type IN ('renter', 'buyer', 'pro', NULL));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'paused', 'canceled', 'past_due'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe 
  ON user_profiles(stripe_customer_id);

-- ============================================
-- 7. Comments
-- ============================================

COMMENT ON COLUMN user_lifestyle_profiles.profile_type IS 
  'Profile type: renter or buyer. One user can have both.';

COMMENT ON COLUMN user_profiles.active_profile_type IS 
  'Which profile the user is currently viewing (renter or buyer)';

COMMENT ON COLUMN user_profiles.subscription_type IS 
  'Which profile type is unlocked by subscription (renter, buyer, or pro)';

COMMENT ON COLUMN pro_clients.linked_user_id IS 
  'If set, links to an existing Leo user. Pro can view their profile.';
```

### API Changes

#### Profile Switching

```typescript
// POST /api/profile/switch
// Switches active profile type for the user

interface SwitchProfileRequest {
  targetProfile: 'renter' | 'buyer';
}

interface SwitchProfileResponse {
  success: boolean;
  activeProfile: 'renter' | 'buyer';
  profileExists: boolean;
  intakeCompleted: boolean;
}

// Implementation:
// 1. Update user_profiles.active_profile_type
// 2. Return whether target profile exists
// 3. If doesn't exist, UI should prompt to create it
```

#### Get Current Profile

```typescript
// GET /api/profile
// Returns the ACTIVE profile for the user

interface GetProfileResponse {
  user: {
    id: string;
    email: string;
    activeProfileType: 'renter' | 'buyer';
    subscription: {
      type: 'renter' | 'buyer' | 'pro' | null;
      status: 'none' | 'active' | 'paused' | 'canceled' | 'past_due';
    };
  };
  profile: UserLifestyleProfile | null;  // The ACTIVE profile
  otherProfiles: {
    type: 'renter' | 'buyer';
    exists: boolean;
    intakeCompleted: boolean;
  }[];
}
```

#### Create Second Profile

```typescript
// POST /api/profile/create
// Creates a new profile type for an existing user

interface CreateProfileRequest {
  profileType: 'renter' | 'buyer';
}

// This creates a new user_lifestyle_profiles row
// with the same user_id but different profile_type
```

### Stripe Billing Changes

#### Updated Products

```bash
# Renter - €9.99/month (unchanged price, just renamed)
stripe products create --name="Leo.casa Renter Subscription"
stripe prices create --product="prod_RENTER" --unit-amount=999 --currency=eur --recurring[interval]=month

# Buyer - €9.99/month (same price as renter for P0)
stripe products create --name="Leo.casa Buyer Subscription"
stripe prices create --product="prod_BUYER" --unit-amount=999 --currency=eur --recurring[interval]=month

# Pro - €49/month (per client pricing in P1)
stripe products create --name="Leo.casa Pro Subscription"
stripe prices create --product="prod_PRO" --unit-amount=4900 --currency=eur --recurring[interval]=month
```

#### Subscription Rules

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SUBSCRIPTION → PROFILE ACCESS                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  subscription_type = 'renter'                                           │
│    → Can access renter profile ✅                                        │
│    → Cannot access buyer profile ❌ (paywall)                            │
│                                                                         │
│  subscription_type = 'buyer'                                            │
│    → Can access buyer profile ✅                                         │
│    → Cannot access renter profile ❌ (paywall)                           │
│                                                                         │
│  subscription_type = NULL (no subscription)                             │
│    → Can do intake for ONE profile (trial)                              │
│    → Hits paywall after intake                                          │
│                                                                         │
│  SWITCHING SUBSCRIPTIONS:                                               │
│    User wants to switch from renter to buyer:                           │
│    1. Cancel renter subscription                                        │
│    2. Start buyer subscription                                          │
│    3. Renter profile preserved but read-only                            │
│                                                                         │
│  BOTH SUBSCRIPTIONS (rare):                                             │
│    User can subscribe to BOTH if they want both active                  │
│    Cost: €9.99 + €9.99 = €19.98/mo                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Billing UI Updates

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 💳 Facturación                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Tus suscripciones                                                       │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🏠 Alquiler (Renter)                                   ✅ ACTIVA   │ │
│ │ €9,99/mes · Próximo cobro: 15 ene 2026                              │ │
│ │ [Pausar]  [Cancelar]                                                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🔑 Compra (Buyer)                                      ❌ NO ACTIVA │ │
│ │ €9,99/mes                                                           │ │
│ │ [Suscribirse →]                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Historial de facturas                                                   │
│ ─────────────────────────────────────────────────────────────────────── │
│ │ Fecha      │ Plan     │ Importe │ Estado │                          │ │
│ │ 15 dic 25  │ Alquiler │ €9,99   │ ✅ Paid │ [Ver →]                 │ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### ElevenLabs Agents (Updated)

> **IMPORTANT**: Separate agents for Renter vs Buyer intake. Different questions, different context.

#### Agent Matrix

| Agent ID | Profile Type | Purpose | Context Passed |
|----------|--------------|---------|----------------|
| `leo-intake-renter` | Renter | First-time renter intake | Nothing (fresh) |
| `leo-intake-buyer` | Buyer | First-time buyer intake | Nothing (fresh) |
| `leo-intake-renter-pro` | Renter (via Pro) | Pro's client renter intake | Pro info + client name |
| `leo-intake-buyer-pro` | Buyer (via Pro) | Pro's client buyer intake | Pro info + client name |
| `leo-whatifs-renter` | Renter | Explore renter tradeoffs | Renter profile |
| `leo-whatifs-buyer` | Buyer | Explore buyer tradeoffs | Buyer profile |
| `leo-followup` | Both | Update preferences | Active profile |

#### Renter vs Buyer Intake Questions

```
RENTER INTAKE (leo-intake-renter):
─────────────────────────────────────
1. "¿Cuántas personas vivirán en el piso?"
2. "¿Cuánto es tu presupuesto mensual máximo?"
3. "¿En qué zonas te gustaría vivir?"
4. "¿Trabajas desde casa, híbrido, o en oficina?"
5. "¿Qué es lo que más te importa en una vivienda?"
6. "¿Hay algo que sea un NO rotundo?"

BUYER INTAKE (leo-intake-buyer):
─────────────────────────────────────
1. "¿Cuántas personas vivirán en la propiedad?"
2. "¿Cuál es tu presupuesto total de compra?"
3. "¿En qué zonas estás buscando?"
4. "¿Es para vivir, invertir, o ambos?"
5. "¿Estás dispuesto a hacer reformas?"
6. "¿Qué características son imprescindibles?"
7. "¿Hay algo que descarte una propiedad automáticamente?"

PRO-CLIENT INTAKE (adds these):
─────────────────────────────────────
- Pro's name and company passed as context
- "Tu agente [Name] de [Company] me ha pedido que te conozca..."
- Questions tailored to what pro already knows vs needs to learn
```

#### Agent Prompts (Key Differences)

**leo-intake-renter**:
```
You are Leo, a friendly Spanish housing assistant helping someone find a rental.
Focus on: lifestyle, commute, neighborhood vibe, budget flexibility.
DO NOT ask about: renovation budget, investment goals, buying power.
```

**leo-intake-buyer**:
```
You are Leo, a friendly Spanish housing assistant helping someone buy a property.
Focus on: total budget, renovation appetite, investment vs living, long-term plans.
You CAN ask about: willingness to renovate, whether they'd rent it out, price flexibility.
```

### Pro-Client Linking

#### How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PRO-CLIENT LINKING FLOW                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCENARIO: Client already has Leo account, hires a relocation agent    │
│                                                                         │
│  1. Pro creates client in their dashboard                               │
│     - Enters client email                                               │
│     - System checks: does this email exist in auth.users?               │
│                                                                         │
│  2a. IF EMAIL EXISTS (existing Leo user):                               │
│      - System sends link request to client                              │
│      - Email: "María from ReloMadrid wants to help with your search"   │
│      - Client clicks "Approve" → accounts linked                        │
│      - pro_clients.linked_user_id = client's auth.users.id              │
│                                                                         │
│  2b. IF EMAIL DOESN'T EXIST (new client):                               │
│      - Pro creates external client as before                            │
│      - Client can do intake via intake_token                            │
│      - If client later signs up, we can auto-link by email              │
│                                                                         │
│  3. ONCE LINKED:                                                        │
│     - Pro sees client's profile (read-only)                             │
│     - Pro sees client's saved properties                                │
│     - Pro can add properties to shared shortlist                        │
│     - Client sees pro's shortlist additions                             │
│     - Client controls their own profile (pro can suggest, not edit)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Link Request API

```typescript
// POST /api/pro/link-request
// Pro requests to link with existing Leo user

interface LinkRequestBody {
  clientEmail: string;
  clientName: string;
  message?: string;  // Optional personal message
}

interface LinkRequestResponse {
  success: boolean;
  clientExists: boolean;
  requestSent?: boolean;
  proClientId?: string;  // Created pro_clients record
}

// If client exists:
//   1. Create pro_clients with linked_user_id = NULL (pending)
//   2. Create link_request record
//   3. Send email to client
//   4. Client approves → update pro_clients.linked_user_id

// If client doesn't exist:
//   1. Create pro_clients as external contact
//   2. Generate intake_token
//   3. Pro sends intake link manually
```

#### Link Approval API

```typescript
// POST /api/pro/approve-link
// Client approves pro's link request

interface ApproveLinkBody {
  requestId: string;  // Link request ID
  approve: boolean;
}

// On approve:
//   1. Update pro_clients.linked_user_id = auth.uid()
//   2. Delete link_request record
//   3. Notify pro that link is approved
```

### Profile Switcher UI

#### Sidebar Component

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Leo Logo]                                                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  María García                                                    │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  [🏠 Alquilando ▼]  ← Dropdown to switch                        │   │
│  │                                                                  │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │ 🏠 Alquilando (activo)           ✅                        │  │   │
│  │  │ 🔑 Comprando                      [Crear perfil →]         │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🏠 Panel                                                               │
│  💬 Habla con Leo                                                       │
│  📋 Recomendaciones                                                     │
│  ❤️ Guardados                                                           │
│  ⚙️ Configuración                                                       │
│  💳 Facturación                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Switching Logic

```typescript
const handleProfileSwitch = async (targetType: 'renter' | 'buyer') => {
  // 1. Check if profile exists
  const profileExists = await checkProfileExists(targetType);
  
  if (!profileExists) {
    // 2a. Profile doesn't exist - prompt to create
    setShowCreateProfileModal(true);
    return;
  }
  
  // 2b. Profile exists - check subscription
  const hasSubscription = await checkSubscription(targetType);
  
  if (!hasSubscription) {
    // 3a. No subscription - show paywall
    router.push(`/billing?upgrade=${targetType}`);
    return;
  }
  
  // 3b. Has subscription - switch
  await switchProfile(targetType);
  
  // 4. Refresh UI with new profile data
  router.refresh();
};
```

### Implementation Checklist

#### Phase A: Database Migration (Migration 075)

- [ ] Add `profile_type` to `user_lifestyle_profiles`
- [ ] Add unique constraint on `(user_id, profile_type)`
- [ ] Add `active_profile_type` to `user_profiles`
- [ ] Add `profile_type` to `saved_properties`
- [ ] Add `profile_type` to `property_notes`
- [ ] Add `linked_user_id` to `pro_clients`
- [ ] Move billing columns to `user_profiles`

#### Phase B: API Updates

- [ ] Create `/api/profile/switch` endpoint
- [ ] Update `/api/profile` to return active profile + other profiles
- [ ] Create `/api/profile/create` endpoint
- [ ] Update `/api/billing/checkout` to handle profile-specific subscriptions
- [ ] Create `/api/pro/link-request` endpoint
- [ ] Create `/api/pro/approve-link` endpoint

#### Phase C: ElevenLabs Agents

- [ ] Create `leo-intake-renter` agent
- [ ] Create `leo-intake-buyer` agent
- [ ] Create `leo-intake-renter-pro` agent
- [ ] Create `leo-intake-buyer-pro` agent
- [ ] Create `leo-whatifs-renter` agent
- [ ] Create `leo-whatifs-buyer` agent
- [ ] Update agent selection logic in `/api/agents/context`

#### Phase D: UI Updates

- [ ] Add profile switcher dropdown to sidebar
- [ ] Create "Create Profile" modal for new profile type
- [ ] Update billing page with per-profile subscriptions
- [ ] Update all data-fetching to filter by `profile_type`
- [ ] Add link request UI for pros
- [ ] Add link approval UI for clients

#### Phase E: Testing

- [ ] Test creating both profiles for one user
- [ ] Test switching between profiles
- [ ] Test separate saved properties per profile
- [ ] Test billing for each profile type
- [ ] Test pro-client linking
- [ ] Test intake agents for each profile type

---

## 🔄 Complete User Flows (P0)

### Non-Pro Flow (Renter & Buyer — essentially identical)

This is what a renter or buyer can do:

```
1. SIGN UP
   - Social Login: Google or Apple
   - OR Magic Link (for users without those accounts)

2. ONBOARDING
   - Call/chat with Leo (voice orb)
   - Leo learns lifestyle, preferences, dealbreakers
   - Profile created with isochrone map

3. RECEIVE RECOMMENDATIONS
   - See properties in Dashboard
   - Get alerts via Email
   - Get alerts via WhatsApp (if number provided)

4. VIEW PROPERTIES
   - Click any property to see details
   - See Fit Score (why it matches/doesn't match)
   - Click "Contact Agent" to reach listing agent

5. TAKE NOTES
   - Add text notes ("ITE pasada pero sin papel")
   - Add photo notes (snap a crack in the ceiling)
   - Add voice notes ("El ruido de la Gran Via...")

6. MANAGE PROFILE
   - See profile summary
   - See isochrone map (commute visualization)
   - Have follow-up call with Leo to update preferences

7. SEE UPDATED RECOMMENDATIONS
   - Recommendations update based on notes
   - Leo learns from your feedback
```

### Pro Flow (Personal Shopper & Relocation Agent — essentially identical)

This is what a pro can do:

```
1. SIGN UP (as Professional)
   - Social Login: Google or Apple
   - OR Magic Link

2. PRO DASHBOARD
   - See all clients at a glance
   - See notifications (new likes, notes, messages)

3. ADD NEW CLIENT
   - Enter client name/email
   - CHOOSE intake method:
     a) "I'll add the profile" → Pro fills in details
     b) "Send client a link" → Client has call/chat with Leo

4. VIEW CLIENT PROFILE
   - See client's lifestyle summary
   - See client's preferences and dealbreakers
   - See client's isochrone map

5. SEE CLIENT ACTIVITY
   - See client's "likes" (favorited properties)
   - See client's notes on properties
   - See which properties client viewed

6. MANAGE RECOMMENDATIONS
   - See Leo's recommendations for this client
   - Add properties manually (from extension or URL)
   - Remove properties that don't fit

7. SEND SHORTLIST
   - Select properties for client
   - Send shortlist link (email or WhatsApp)
   - Client views shortlist WITHOUT needing to log in

8. CLIENT VIEWS SHORTLIST (Public Page)
   - Client sees curated properties
   - Client can "like" properties
   - Client can take notes
   - Pro sees client's likes and notes in real-time
```

---

## 🗺️ Route Structure (P0)

### Auth Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/auth/signin` | Sign in page with Google/Apple/Magic Link | NEW |
| `/auth/callback` | OAuth callback handler | ✅ exists |

### Non-Pro Routes (Renter/Buyer)

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Homepage | ✅ exists |
| `/recommend/intake` | Onboarding call/chat with Leo | ✅ exists |
| `/dashboard` | See new recommendations, activity | NEW |
| `/property/[id]` | View property, fit score, take notes, contact agent | REFACTOR |
| `/saved` | See liked/saved properties | NEW |
| `/profile` | See profile summary, isochrones | ✅ exists |
| `/profile/call` | Follow-up call with Leo to update preferences | NEW |

### Pro Routes (Personal Shopper/Relocation Agent)

| Route | Purpose | Status |
|-------|---------|--------|
| `/pro` | Pro dashboard - see all clients | NEW |
| `/pro/clients/new` | Add new client (choose intake method) | NEW |
| `/pro/clients/[id]` | View client profile, likes, notes, recommendations | NEW |
| `/pro/clients/[id]/shortlist` | Build and send shortlist | NEW |
| `/pro/clients/[id]/intake` | Pro does intake for client | ✅ exists |

### Public Routes (No Auth Required)

| Route | Purpose | Status |
|-------|---------|--------|
| `/shortlist/[token]` | Client views shortlist, can like and take notes | NEW |
| `/invite/[code]` | Client self-service intake (sent by pro) | NEW |

---

## 🎨 Jack & Jill Style Sidebar

Inspired by `app.jacknjill.ai` (see `LEO_HOMEPAGE_REBUILD.md` and `UI_BY_USER_TYPE.md`):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  NORMAL STATE                    │  DURING INTAKE (minimal)             │
│                                  │                                      │
│  🏠 Leo.casa                     │  🏠 Leo.casa                         │
│                                  │                                      │
│  📊 Dashboard                    │  [Exit ×]                            │
│  🏠 Recommendations              │                                      │
│  ❤️ Saved                        │  ┌─────────────────────┐             │
│  📅 Viewings                     │  │                     │             │
│  ⚙️ Settings                     │  │   [Leo Voice Orb]   │             │
│                                  │  │                     │             │
│  ─────────────────               │  │   Full screen       │             │
│  👤 María García                 │  │   conversation      │             │
│     operator@example.invalid              │  │                     │             │
│                                  │  └─────────────────────┘             │
│                                  │                                      │
└──────────────────────────────────┴──────────────────────────────────────┘
```

### Sidebar States

| State | When | Contents |
|-------|------|----------|
| **Full** | Normal app usage | Logo, nav items, user avatar |
| **Minimal** | During intake/onboarding | Logo + Exit button only |
| **Collapsed** | Mobile | Hamburger menu |

### Navigation Items

**Non-Pro:**
- 📊 Dashboard
- 🏠 Recommendations
- ❤️ Saved
- 📅 Viewings
- ⚙️ Settings

**Pro:**
- 📊 Dashboard
- 👥 Clients
- 🔍 Search
- ⚙️ Settings

---

## 📱 Property Page (Fully Functional)

**Used by ALL user types** — everything works:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏠 Leo.casa              [Agent Logo]  [Agent Name]     [💬 WhatsApp]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Photo Carousel]                                                       │
│  €385,000 · 85m² · 3 hab · Gran Via 42, Madrid                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  FIT SCORE: 78%  ████████░░                                         ││
│  │  ✓ Near work (12 min)              ⚠️ Gran Via = noise              ││
│  │  ✓ 3 bedrooms                      ⚠️ Needs renovation              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│        [📞 Contact Agent]              [❤️ Save]                        │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  📝 MY NOTES                                                            │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 💬 "ITE pasada pero sin papel"                         10:34 AM   │ │
│  │ 📷 [Grieta en techo]                                   10:36 AM   │ │
│  │ 🎤 0:12 "El ruido de la Gran Via..."                   10:41 AM   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  [📷 Photo] [🎤 Voice] [💬 Text]                     [✓ Mark as Viewed] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Property Page Features (P0) ✅

| Feature | Works |
|---------|-------|
| Photo Carousel | ✅ Browse listing photos |
| Basic Info | ✅ Price, size, bedrooms, location |
| Fit Score | ✅ % with reasons (✓ good, ⚠️ concerns) |
| Contact Agent | ✅ Click to WhatsApp/call listing agent |
| Save/Like | ✅ Add to saved properties |
| Text Notes | ✅ Type observations |
| Photo Notes | ✅ Snap photos during viewing |
| Voice Notes | ✅ Record voice memos |
| Mark as Viewed | ✅ Track visited properties |

### What's Deferred to P1/P2 (Property Page Only)

| Feature | When | Description |
|---------|------|-------------|
| AI Chat Sidebar | P1 | Ask Leo questions about property |
| Viewing Checklist | P1 | Suggested questions to ask |
| Renovation Tiers | P2 | Cost estimates for renovation levels |
| Full Report Cards | P2 | Detailed analysis (Airbnb, geology, etc.) |
| Comparison View | P1 | Compare properties side-by-side |

---

## 🧩 Components to Build

### New Components

| Component | Used By | Priority |
|-----------|---------|----------|
| `AppSidebar` | All pages | HIGH |
| `AppLayout` | All pages | HIGH |
| `Dashboard` | Non-Pro | HIGH |
| `RecommendationsFeed` | Non-Pro | HIGH |
| `PropertyCardSimple` | Feeds | HIGH |
| `LeanPropertyPage` | Property detail | HIGH |
| `NotesPanel` | Property detail | HIGH |
| `FitScoreSimple` | Property detail | HIGH |
| `QuieroVerloButton` | Property detail | HIGH |
| `ProDashboard` | Pro users | HIGH |
| `ClientCard` | Pro dashboard | HIGH |
| `ClientProfile` | Pro users | MEDIUM |
| `ShortlistBuilder` | Pro users | MEDIUM |
| `PublicShortlist` | Public pages | MEDIUM |

### Reuse Existing

| Component | Location | Status |
|-----------|----------|--------|
| Leo Voice Orb | `/recommend/intake` | ✅ |
| Pro Intake | `/pro/clients/new/intake` | ✅ |
| Homepage | `/` | ✅ |
| Auth | `/auth/*` | ✅ |
| ListingEditor | `/add-property` | ✅ (reference for branding) |
| PropertyCard | `src/components/property/` | ✅ (adapt) |

---

## 🔄 Validation Funnels

### Non-Pro Funnel

```
WhatsApp signup → Alert clicked → Property viewed → "Quiero verlo" → Notes taken
```

**Key Metrics:**
- Alert click rate
- Property view rate
- "Quiero verlo" rate
- Notes taken per property
- Viewing completion rate

### Pro Funnel

```
Client created → Intake done → Extension used → Shortlist sent → Client engaged → Notes taken
```

**Key Metrics:**
- Clients added per pro
- Intake completion rate
- Properties added per client
- Shortlist send rate
- Client engagement rate

---

## 🎨 Branding

Use existing Leo.casa branding (see `LEO_HOMEPAGE_REBUILD.md`):

| Element | Value |
|---------|-------|
| Primary | Green `#6DB035` |
| Secondary | Peach/Coral `#F5CABB` |
| Text | Dark gray/black |
| Background | White with subtle gradients |
| Logo | Leo.casa logo (consistent with homepage) |

---

## 📂 File Structure (P0)

```
src/
├── app/
│   ├── (app)/                    # App shell with sidebar
│   │   ├── layout.tsx            # AppLayout with sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Non-pro dashboard
│   │   ├── recommend/
│   │   │   └── page.tsx          # Recommendations feed
│   │   ├── property/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Lean property page
│   │   ├── saved/
│   │   │   └── page.tsx          # Saved properties
│   │   └── profile/
│   │       └── page.tsx          # User profile (exists)
│   │
│   ├── (pro)/                    # Pro shell with pro sidebar
│   │   ├── layout.tsx            # ProLayout
│   │   └── pro/
│   │       ├── page.tsx          # Pro dashboard
│   │       └── clients/
│   │           ├── new/
│   │           │   └── page.tsx  # Add client
│   │           └── [id]/
│   │               ├── page.tsx  # Client profile
│   │               └── shortlist/
│   │                   └── page.tsx  # Shortlist builder
│   │
│   ├── (public)/                 # No auth required
│   │   ├── shortlist/
│   │   │   └── [token]/
│   │   │       └── page.tsx      # Public shortlist
│   │   └── invite/
│   │       └── [code]/
│   │           └── page.tsx      # Client intake link
│   │
│   ├── auth/                     # Auth pages (exists)
│   └── recommend/
│       └── intake/               # Leo intake (exists)
│
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx        # Jack & Jill style sidebar
│   │   ├── AppLayout.tsx         # Main app layout
│   │   └── ProSidebar.tsx        # Pro variant
│   │
│   ├── property/
│   │   ├── LeanPropertyPage.tsx  # The core P0 component
│   │   ├── FitScoreSimple.tsx    # Simple fit score display
│   │   ├── NotesPanel.tsx        # Notes (text, photo, voice)
│   │   ├── QuieroVerloButton.tsx # CTA button
│   │   └── PropertyCardSimple.tsx # Card for feeds
│   │
│   ├── pro/
│   │   ├── ClientCard.tsx        # Client in dashboard
│   │   ├── ClientProfile.tsx     # Full client view
│   │   └── ShortlistBuilder.tsx  # Add properties to client
│   │
│   └── shared/
│       ├── PhotoCarousel.tsx     # Reusable carousel
│       └── WhatsAppButton.tsx    # Contact button
│
└── lib/
    ├── data-adapter/             # (exists) Supabase + DynamoDB
    └── auth-helpers.ts           # (exists) Auth utilities
```

---

## 🧪 Test Auth System

### Environment Flag

```bash
# .env.local (development only)
NEXT_PUBLIC_ENABLE_TEST_AUTH=true

# .env.production (NEVER set this)
# NEXT_PUBLIC_ENABLE_TEST_AUTH is not set
```

### Test Users (Seeded in Supabase)

| Email | Type | State | Purpose | Created |
|-------|------|-------|---------|---------|
| `operator@example.invalid` | Renter | ✅ Onboarded | Test main app flow | Pre-existing |
| `operator@example.invalid` | Renter | ❌ Fresh | Test onboarding | Pre-existing |
| `operator@example.invalid` | Buyer | ✅ Onboarded | Test main app flow | Pending |
| `operator@example.invalid` | Buyer | ❌ Fresh | Test onboarding | ✅ Dec 4 |
| `operator@example.invalid` | Pro | ✅ Has clients | Test pro dashboard | Pending |
| `operator@example.invalid` | Pro | ❌ Fresh | Test pro onboarding | ✅ Dec 4 |

**Password**: `TestPassword123!`

### Sign-in UI (Dev Mode)

```
┌─────────────────────────────────────────────┐
│            🏠 Leo.casa                      │
│                                             │
│  [🔵 Continue with Google]                  │
│  [⚫ Continue with Apple]                   │
│  [✉️  Continue with Email]                  │
│                                             │
│  ─────────────────────────────────────────  │
│  🧪 Test Mode (dev only)                    │
│                                             │
│  [👤 Renter] [🏠 Buyer] [💼 Pro]            │
│                                             │
│  ☐ Start fresh (reset onboarding)          │
└─────────────────────────────────────────────┘
```

### How It Works

1. Test users are real users in Supabase (dev database only)
2. Clicking a test button creates a session for that user
3. If "Start fresh" is checked, user's profile is cleared first
4. Onboarding redirect works identically to real users
5. All data (notes, saves, etc.) is real and persisted

---

## ✅ Build Plan (Sequential Phases)

### 🚨 IMPORTANT: Build Order

**We build ONE user type at a time, test it, then move to the next.**

```
Phase 1: RENTER     →  User Tests  →  Approved? 
                                          ↓
Phase 2: BUYER      →  User Tests  →  Approved?
                                          ↓
Phase 3: PRO        →  User Tests  →  Approved?
                                          ↓
                                      🎉 P0 Complete!
```

---

### Phase 1: Complete Renter Flow ✅ COMPLETE

**Goal**: A fully working app for renters. Test it. Get approval.

#### 1.1 Foundation ✅
- [x] Jack & Jill sidebar (`AppSidebar`) with amorphous orb icon
- [x] App layout with sidebar (`AppLayout`) + `LanguageProvider`
- [x] Auth page with Google/Apple/Magic Link + dev bypass
- [x] Test user seeding in Supabase (operator@example.invalid)
- [x] Mobile sidebar (full-screen, solid bg, close on nav click)
- [x] Sidebar toggle (icons-only when collapsed)
- [x] Sidebar navigation greyed out when onboarding incomplete

#### 1.2 Onboarding ✅
- [x] Check onboarding status on login
- [x] Redirect to `/speak-with-leo` if not completed
- [x] Amorphous voice orb with real-time speaking animation
- [x] Save lifestyle profile on completion
- [x] Redirect to dashboard after onboarding
- [x] Extract `needsSummary` from voice transcript (AI-generated playback)

#### 1.3 Dashboard ✅
- [x] New recommendations section ("Nuevas recomendaciones")
- [x] Saved properties section ("Mis propiedades guardadas")
- [x] Quick stats (saved properties, viewed, notes count)
- [x] Link to full recommendations feed
- [x] Renamed "Dashboard" → "Propiedades"

#### 1.4 Recommendations ✅
- [x] Property cards with photos
- [x] Connect to Supabase listings (151 available)
- [ ] Filter/sort options (P1)
- [ ] Pagination or infinite scroll (P1)

#### 1.5 Property Page ✅
- [x] 2-column layout (Fit+viewer left, Notes right)
- [x] Photo carousel with navigation
- [x] Basic info (price, size, location, bedrooms, bathrooms)
- [x] Fit score with reasons (mock data)
- [x] Contact Agent button ("Quiero verlo" → WhatsApp)
- [x] Save/Like button with API
- [x] Notes panel (text notes implemented) — **UPGRADING to WhatsApp-style chat (Task 8)**
- [x] Mark as viewed
- [ ] Photo notes — **P0** (Task 8: WhatsApp-Style Notes)
- [ ] Voice notes — **P0** (Task 8: WhatsApp-Style Notes)

#### 1.6 Saved Properties ✅
- [x] Save/unsave API (`/api/saved`)
- [x] Count shown in dashboard stats
- [ ] Full saved properties page with list (P1)

#### 1.7 Profile ✅
- [x] Profile summary with stats (saved, viewed, notes)
- [x] **Needs Summary section** ("Leo te entiende así") - AI playback
- [x] "Lo que busco" section (budget, bedrooms, areas, commute)
- [x] Isochrone map with sweet spot/opportunity zones
- [x] "Habla con Leo" CTA (no edit button)

#### 1.8 Settings & i18n ✅
- [x] Language setting in Configuración (Español/English)
- [x] Full UI translations system (`LanguageProvider`)
- [x] Dynamic language switching (sidebar, pages, buttons)
- [ ] Homepage colors/typography refresh (P1 styling polish)

**Checkpoint**: ✅ Phase 1 COMPLETE - Ready for user testing

---

### Phase 2: Linked Profile Architecture ✅ COMPLETE (Dec 4, 2025)

**Goal**: Enable one user to have both Renter and Buyer profiles.

> See [Task 6: Linked Profile Architecture](#task-6-linked-profile-architecture-) for details.

#### 2.1 Database
- [x] Apply migration 075 (linked profiles) ✅
- [x] Migrate existing profiles (set profile_type = 'renter') - handled by DEFAULT
- [x] Move billing columns to user_profiles ✅

#### 2.2 APIs
- [x] `/api/profile/switch` - Switch active profile ✅
- [x] `/api/profile/create` - Create second profile ✅
- [x] Update `/api/profile` - Return all profiles ✅
- [x] `/api/pro/link-request` - Pro links to existing user ✅
- [x] `/api/pro/approve-link` - Client approves link ✅

#### 2.3 UI
- [x] Profile switcher dropdown in sidebar ✅
- [x] "Create Profile" modal ✅
- [x] Updated billing page with per-profile subscriptions ✅

**Checkpoint**: ✅ Ready for testing. Test profile switching with test user.

---

### Phase 3: Complete Buyer Flow ✅ COMPLETE (Dec 4, 2025)

**Goal**: Clone Renter UI for Buyers. NO buyer-exclusive features in P0.

> See [Task 7: Buyer UI](#task-7-buyer-ui-clone-of-renter-) for details.

#### 3.1 ElevenLabs Agents
- [x] Create `leo-intake-buyer` agent config ✅
- [x] Create `leo-intake-buyer-pro` agent config ✅
- [x] Create `leo-whatifs-buyer` agent config ✅
- [ ] **TODO**: Push new agents to ElevenLabs Dashboard (CLI only updates existing)

#### 3.2 UI Updates
- [x] Update sidebar to show "Comprando" when buyer profile active (via ProfileSwitcher) ✅
- [x] Update agent selection based on profile_type ✅
- [x] Buyer test users seeded ✅

#### 3.3 Testing
- [ ] Test buyer intake end-to-end
- [ ] Test switching between renter and buyer
- [ ] Test separate saved properties per profile

**Checkpoint**: ⏸️ Ready for user testing. Agent configs ready, need to push to ElevenLabs.

---

### Phase 4: Complete Pro Flow

**Goal**: Full pro experience for Personal Shoppers & Relocation Agents.

#### 3.1 Pro Auth
- [ ] "Sign in as Professional" option
- [ ] Pro test users

#### 3.2 Pro Dashboard
- [ ] All clients list
- [ ] Notifications (new likes, notes)
- [ ] Add client button

#### 3.3 Add Client
- [ ] Name/email form
- [ ] Choose intake method:
  - "I'll add the profile" → Pro intake
  - "Send client a link" → Generate invite link

#### 3.4 Client Profile
- [ ] Lifestyle summary
- [ ] Preferences & dealbreakers
- [ ] Isochrone map
- [ ] Client's likes
- [ ] Client's notes
- [ ] Recommendations for client

#### 3.5 Shortlist Builder
- [ ] Add properties to shortlist
- [ ] Remove properties
- [ ] Send shortlist (email/WhatsApp)

#### 3.6 Public Shortlist
- [ ] Client views without login
- [ ] Client can like properties
- [ ] Client can take notes
- [ ] Pro sees activity in real-time

**Checkpoint**: ⏸️ User tests Pro flow. Feedback. Iterate. Approve.

---

### 🎉 P0 Complete!

All user types working with linked profiles:
- ✅ Renter (separate profile)
- ✅ Buyer (separate profile, same UI as renter)
- ✅ Profile switching between renter/buyer
- ✅ Personal Shopper (can link to existing Leo users)
- ✅ Relocation Agent (can link to existing Leo users)

---

## 🚀 Current Status

### ✅ Phase 1 COMPLETE (December 2, 2025)

**Renter flow is fully functional and ready for testing.**

Key achievements:
- Full authentication flow with dev bypass for testing
- Voice-first onboarding with amorphous orb animation
- AI-generated needs summary ("Leo te entiende así")
- 2-column property page with notes
- Save/like functionality
- Isochrone map visualization
- **Full i18n system** - Spanish/English switching

### ✅ Phase 2 COMPLETE (December 4, 2025)

**Linked Profile Architecture implemented.**

Key achievements:
- Migration 075: profile_type on all user tables
- User can have both Renter AND Buyer profiles
- Separate saved properties, notes per profile
- Profile switcher in sidebar
- Billing at user level (one subscription unlocks one profile type)
- Pro-client linking system

### ✅ Phase 3 COMPLETE (December 4, 2025)

**Buyer flow (clone of Renter) implemented.**

Key achievements:
- All ElevenLabs agent configs created (7 agents)
- Agent selection based on profile type
- Test users seeded (buyer, pro-fresh)
- **TODO**: Push new agents to ElevenLabs Dashboard

### 🎯 Next Steps

1. **Push ElevenLabs Agents** — Create new agents in ElevenLabs Dashboard
2. **User Testing** — Test Renter + Buyer + Profile Switching
3. **Phase 4** — Pro flow (client management, shortlists)

### 🔧 Running Locally

```bash
cd puedo_casa
npm run dev
# Open http://localhost:3000
# Dev bypass auto-signs you in as operator@example.invalid
```

### 📊 Database

New columns added (migration 069):
- `user_lifestyle_profiles.needs_summary` (JSONB) - AI-generated playback
- `user_lifestyle_profiles.language` (VARCHAR) - User language preference

---

*Last updated: December 4, 2025 - Phase 1-3 Complete. Linked Profile Architecture + Buyer Flow implemented.*

---

## 🧠 Recommender Evolution Architecture

> **Future Enhancement** — Documented for P1/P2 implementation.
> 
> This section captures the technical design for evolving the recommender 
> from static scoring to a learning system that improves with user feedback.

### Current Recommender Pipeline (P0)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDER PHASES                               │
├─────────────────────────────────────────────────────────────────────┤
│ R1: Life Profile      │ Supabase: user_lifestyle_profiles          │
│ R2: Sweet Spot        │ Isochrones + location preferences          │
│ R3: Harvest Filter    │ DynamoDB: leo-listings (query by filters)  │
│ R4: WPA on Shortlist  │ DynamoDB: leo-wpa-cache (Gemini analysis)  │
│ R5: Fit Scoring       │ Algorithmic weighted scoring               │
└─────────────────────────────────────────────────────────────────────┘
```

### Models & Methods Used

| Phase | Model/Method | Location | Cost |
|-------|--------------|----------|------|
| R1: Life Profile (Psychologist) | **Gemini 3 Pro Preview** (HIGH thinking) | `src/lib/lifestyle/ai-profiler.ts` | ~€0.30/profile |
| R1b: Voice Intake | ElevenLabs Agent (Gemini 2.0 Flash) | ElevenLabs API | ~€0.80/10min |
| R2: Sweet Spot | Algorithmic (isochrones) | `src/lib/recommender/sweetSpot.ts` | Free (local) |
| R3: Harvest Filter | DynamoDB Query | `src/lib/recommender/harvestFilter.ts` | ~€0.0001/query |
| R4b: Full WPA | **Gemini 2.5 Flash-Lite** | `src/lib/recommender/wpaShortlist.ts` | ~€0.003/listing |
| R4c: Social Radar (Airbnb) | Gemini 2.5 Flash + SQLite | `src/lib/intelligence/social-radar.ts` | ~€0.02/scan |
| R4d: **Smart M2** (Buyer) | Gemini 2.5 Pro | `/renovation/smart-m2` | ~€0.05/listing |
| R4e: **Baseline Cost** (Buyer) | Flash-lite + Habitissimo RAG | `/renovation/baseline-check` | ~€0.03/listing |
| R4f: **Instant Reno** (Buyer, live) | Claude 3 Haiku | TODO: `instantReno.ts` | ~€0.02/listing |
| R5: Fit Scoring | Algorithmic (weighted average) | `src/lib/recommender/fitScoring.ts` | Free (local) |
| R5b: **Buyer Fit** (enhanced) | Algorithmic + reno cost | TODO: extend `fitScoring.ts` | Free (local) |
| Notes Processing | Gemini 2.5 Flash-lite | `src/app/api/notes/process/route.ts` | ~€0.01/note |
| Needs Summary | Gemini 2.5 Flash | `src/app/api/recommender/needs-summary/route.ts` | ~€0.02/summary |

### Existing Components (Already Built)

#### AI Profiler / "Psychologist" (`src/lib/lifestyle/ai-profiler.ts`)
```typescript
// Uses Gemini 3 Pro Preview with HIGH thinking
generateSmartLifestyleProfile(userInput: string): Promise<{
  profile: {
    user_persona: string,        // "The Cultured Solitary Athlete"
    core_values: string[],       // Deep lifestyle values
    hidden_gems: string[],       // Creative search ideas
    property_preferences: {...}, // Extracted hard constraints
    hard_constraints: [],
    soft_constraints: [],
  },
  scenarios: AIScenario[],       // 5 trade-off scenarios
}>
```

#### Social Radar / Airbnb Analysis (`src/lib/intelligence/social-radar.ts`)
```typescript
// Already scans Airbnb reviews for noise, tourist saturation, red flags
analyzeLocation(lat, lon, addressTerms): Promise<{
  airbnb: {
    nearbyListings: number,
    reviewsAnalyzed: number,
    redFlags: string[],               // "noise", "smell", "construction"...
    touristSaturationLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    listingsDetail: [...],
  },
  summary: string,                    // AI-generated vibe summary
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
}>
```

**Red Flag Keywords Detected:**
`ruido, noise, olor, smell, obras, construction, frio, cold, damp, humedad, paredes, thin walls, cockroach, cucarachas, robbery, robo, policia`

### WPA Attributes (What AI Sees in Photos)

| Attribute | Score 0-100 | Method |
|-----------|-------------|--------|
| `naturalLight` | Gemini vision | Window size, sun exposure, shadows |
| `quietness` | Gemini inference | Location context, street views, floors |
| `outdoorSpace` | Gemini vision | Terrace, balcony, garden presence |
| `storage` | Gemini vision | Closets, built-in wardrobes |
| `condition` | Gemini vision | Visible wear, renovation state |
| `layout` | Gemini vision | Room flow, separation, open plan |
| `views` | Gemini vision | What's visible from windows |
| `modernization` | Gemini vision | Kitchen/bath fixtures age |

### Attributes WPA Can't Detect (Parked)

| Attribute | Why | Source | Status |
|-----------|-----|--------|--------|
| ~~Noise levels~~ | ~~Can't hear photos~~ | ✅ **Social Radar** (Airbnb reviews) | **DONE** |
| ~~Commute time~~ | ~~Needs geocoding~~ | ✅ Isochrones | **DONE** |
| ~~Proximity~~ | ~~Needs geocoding~~ | ✅ Isochrones | **DONE** |
| ~~Tourist saturation~~ | ~~Not visible~~ | ✅ **Social Radar** (Airbnb density) | **DONE** |
| School quality | Not visible | External school API | P2 |
| Safety/crime | Not visible | Geo-intelligence data | P2 |
| Building community | Not visible | User feedback aggregation | P2 |
| Heating costs | Not visible | Energy certificate data | P3 |

### Database Architecture

**Supabase (User Data):**
```sql
-- User preferences
user_lifestyle_profiles (budget, areas, dealbreakers, tradeoffs...)
user_preference_signals (likes, dislikes, from notes/calls)
user_notes (raw notes, extracted_signals)
saved_properties (user likes)
property_views (user views)
```

**DynamoDB (Bulk Property Data):**
```
leo-listings          → 650k+ properties (from harvest)
leo-wpa-cache         → WPA analysis results (Gemini output)
leo-analysis-cache    → Text/room analysis cache
leo-scraping-rules    → Domain selectors
leo-crawl-tracking    → Crawl metadata
leo-geo-intelligence  → Geo-dossier (future)
leo-market-velocity   → Sold/rented analytics (future)
```

### Fit Scoring Algorithm (V0 - Algorithmic)

> **Philosophy**: WPA outputs structured scores (0-100) for 35 dimensions. Fit Scoring is purely algorithmic - no LLM needed. Fast, free, deterministic.

#### User Profile Structure (Input)

```typescript
interface UserFitProfile {
  // ═══════════════════════════════════════════════════════════════════
  // DIMENSION WEIGHTS (0-2, default 1.0)
  // Higher = user cares more about this dimension
  // Set by Psychologist from intake + vibe-check feedback
  // ═══════════════════════════════════════════════════════════════════
  
  weights: {
    // Light & Air
    natural_light_intensity: number;    // "Light is very important"
    light_distribution: number;
    cross_ventilation: number;
    ceiling_height: number;
    
    // Layout & Flow
    entrance_experience: number;
    kitchen_living_relationship: number;
    bathroom_privacy: number;
    bedroom_seclusion: number;
    flow_for_entertaining: number;      // "I host a lot"
    furniture_feasibility: number;
    two_person_living: number;          // Couples
    escape_room_potential: number;
    real_walls_vs_separators: number;   // Privacy critical
    
    // Kitchen
    counter_space: number;              // "I cook a lot"
    appliance_quality: number;
    kitchen_storage: number;
    cooking_ventilation: number;
    
    // Bathroom & Bedroom
    bathroom_functionality: number;
    bedroom_size_fit: number;
    closet_storage: number;
    morning_light_bedroom: number;
    
    // Condition
    renovation_state: number;           // "Move-in ready"
    signs_of_aging: number;
    
    // Comfort & Lifestyle
    cozy_corner_potential: number;      // "Love reading at home"
    wfh_potential: number;              // "Work from home"
    outdoor_space_quality: number;      // "Balcony is a must"
    balcony_security: number;
    storage_total: number;
    
    // Neighborhood (from 20 dimensions)
    neighborhood_quietness: number;
    neighborhood_safety: number;
    neighborhood_vibe_match: number;
    // ... other relevant dimensions
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // DEALBREAKERS (Instant fail if true)
  // ═══════════════════════════════════════════════════════════════════
  
  dealbreakers: {
    cubicle_bathroom: boolean;          // "Absolutely not"
    mezzanine_ladder: boolean;
    needs_full_renovation: boolean;
    ground_floor_exposed: boolean;
    is_house_share: boolean;            // If user wants to live alone
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // MUST-HAVES (Minimum acceptable score)
  // ═══════════════════════════════════════════════════════════════════
  
  must_haves: {
    natural_light_intensity?: number;   // e.g., 60 = "needs decent light"
    outdoor_space_quality?: number;     // e.g., 50 = "must have some outdoor"
    wfh_potential?: number;             // e.g., 60 = "must have office space"
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // LIFE SITUATION (Affects safety and bonus weights)
  // ═══════════════════════════════════════════════════════════════════
  
  has_children: boolean;
  planning_children: boolean;
  has_pets: boolean;
  works_from_home: boolean;
  living_alone: boolean;
  has_mobility_needs: boolean;
  has_vision_impairment: boolean;
  is_elderly: boolean;
}
```

#### Fit Scoring Algorithm

```typescript
// src/lib/recommender/fitScoring.ts

interface FitResult {
  score: number;              // 0-100 overall fit
  pass: boolean;              // Score >= 50
  reason: string;             // Human-readable summary
  breakdown: Record<string, number>;  // Per-dimension contribution
  adjustments: number;        // Bonus/penalty applied
  topMatches: string[];       // Top 3 matching dimensions
  concerns: string[];         // From WPA concerns
  failReason?: string;        // If pass = false
}

export function calculateFitScore(
  wpa: WPAOutput,
  profile: UserFitProfile,
  neighborhood: NeighborhoodProfile | null,
  listing: ListingBasics
): FitResult {
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: DEALBREAKER CHECKS (Instant Fail)
  // ═══════════════════════════════════════════════════════════════════
  
  // Flag-based dealbreakers
  if (profile.dealbreakers.cubicle_bathroom && wpa.flags.has_cubicle_bathroom) {
    return fail('Dealbreaker: Cubicle bathroom');
  }
  
  if (profile.dealbreakers.mezzanine_ladder && wpa.flags.has_mezzanine) {
    return fail('Dealbreaker: Mezzanine with ladder');
  }
  
  if (profile.dealbreakers.needs_full_renovation && wpa.flags.needs_full_renovation) {
    return fail('Dealbreaker: Needs full renovation');
  }
  
  if (profile.dealbreakers.ground_floor_exposed && wpa.flags.ground_floor_exposed) {
    return fail('Dealbreaker: Ground floor exposed to street');
  }
  
  if (profile.dealbreakers.is_house_share && wpa.flags.is_house_share) {
    return fail('House share - user wants to live alone');
  }
  
  // Safety dealbreakers
  if (profile.has_children && wpa.safety_flags.child_hazards.length > 0) {
    return fail(`Child safety hazards: ${wpa.safety_flags.child_hazards.join(', ')}`);
  }
  
  if (profile.has_mobility_needs && wpa.safety_flags.accessibility_issues.length > 0) {
    return fail(`Accessibility issues: ${wpa.safety_flags.accessibility_issues.join(', ')}`);
  }
  
  if (profile.is_elderly && wpa.safety_flags.elderly_hazards.length > 0) {
    return fail(`Elderly hazards: ${wpa.safety_flags.elderly_hazards.join(', ')}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: MUST-HAVE CHECKS (Minimum Thresholds)
  // ═══════════════════════════════════════════════════════════════════
  
  for (const [dimension, minScore] of Object.entries(profile.must_haves)) {
    const actualScore = wpa.scores[dimension];
    if (actualScore !== null && actualScore < minScore) {
      return fail(`Below minimum ${dimension}: ${actualScore} < ${minScore}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: WEIGHTED SCORE CALCULATION
  // ═══════════════════════════════════════════════════════════════════
  
  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown: Record<string, number> = {};
  
  // Calculate weighted sum for all 35 WPA dimensions
  for (const [dimension, score] of Object.entries(wpa.scores)) {
    if (score === null) continue;  // Can't assess this dimension
    
    // Get user's weight for this dimension (default 1.0)
    const weight = profile.weights[dimension] ?? 1.0;
    
    // Skip dimensions with 0 weight (user doesn't care)
    if (weight === 0) continue;
    
    // Add to weighted sum
    const contribution = score * weight;
    weightedSum += contribution;
    totalWeight += weight * 100;  // Normalize to 0-100 range
    
    // Track breakdown for debugging
    breakdown[dimension] = Math.round(contribution / weight);
  }
  
  // Add neighborhood scores if available
  if (neighborhood) {
    const neighborhoodDimensions = [
      ['quietness', 'neighborhood_quietness'],
      ['safety_overall', 'neighborhood_safety'],
      ['digital_nomad', 'neighborhood_wfh'],
      ['family_friendly', 'neighborhood_family'],
    ];
    
    for (const [nbDim, profileDim] of neighborhoodDimensions) {
      const score = neighborhood.scores[nbDim];
      const weight = profile.weights[profileDim] ?? 1.0;
      
      if (score !== null && weight > 0) {
        weightedSum += score * weight;
        totalWeight += weight * 100;
        breakdown[`nb_${nbDim}`] = score;
      }
    }
  }
  
  // Calculate base score
  const baseScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: BONUS/PENALTY ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════════
  
  let adjustments = 0;
  
  // BONUS: Exceeds expectations on high-priority items (weight >= 1.5)
  const highPriorities = Object.entries(profile.weights)
    .filter(([_, w]) => w >= 1.5)
    .map(([dim]) => dim);
  
  for (const dim of highPriorities) {
    const score = wpa.scores[dim];
    if (score && score >= 85) {
      adjustments += 5;  // +5 for excellent match on priority
    }
  }
  
  // BONUS: Has standout features matching user interests
  const standoutKeywords = {
    wfh_potential: ['office', 'workspace', 'video call'],
    natural_light: ['natural light', 'bright', 'sunny', 'south-facing'],
    outdoor_space: ['balcony', 'terrace', 'garden', 'outdoor'],
    cozy_corner: ['cozy', 'reading nook', 'fireplace'],
  };
  
  for (const [dim, keywords] of Object.entries(standoutKeywords)) {
    if (profile.weights[dim] >= 1.5) {
      const hasMatch = wpa.standouts.some(s => 
        keywords.some(k => s.toLowerCase().includes(k))
      );
      if (hasMatch) adjustments += 3;
    }
  }
  
  // PENALTY: Concerns match user sensitivities
  if (profile.works_from_home) {
    if (wpa.concerns.some(c => c.toLowerCase().includes('noise') || c.toLowerCase().includes('dark'))) {
      adjustments -= 10;
    }
  }
  
  if (profile.has_children || profile.planning_children) {
    if (wpa.concerns.some(c => c.toLowerCase().includes('safety') || c.toLowerCase().includes('stairs'))) {
      adjustments -= 10;
    }
  }
  
  // PENALTY: Low confidence WPA (fewer photos, unclear assessment)
  if (wpa.confidence === 'low') {
    adjustments -= 5;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: FINAL SCORE
  // ═══════════════════════════════════════════════════════════════════
  
  const finalScore = Math.max(0, Math.min(100, baseScore + adjustments));
  const pass = finalScore >= 50;
  
  // Find top matching dimensions
  const topMatches = Object.entries(breakdown)
    .filter(([dim]) => (profile.weights[dim] ?? 1) >= 1.0)  // Only weighted dimensions
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([dim]) => dim);
  
  // Generate reason
  let reason: string;
  if (finalScore >= 80) reason = 'Excellent match - hits most priorities';
  else if (finalScore >= 70) reason = 'Strong match';
  else if (finalScore >= 60) reason = 'Good match with some trade-offs';
  else if (finalScore >= 50) reason = 'Decent match';
  else reason = 'Weak match - missing key requirements';
  
  return {
    score: Math.round(finalScore),
    pass,
    reason,
    breakdown,
    adjustments,
    topMatches,
    concerns: wpa.concerns,
  };
}

// Helper function for instant fails
function fail(reason: string): FitResult {
  return {
    score: 0,
    pass: false,
    reason,
    breakdown: {},
    adjustments: 0,
    topMatches: [],
    concerns: [],
    failReason: reason,
  };
}
```

#### How User Weights Are Derived

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PSYCHOLOGIST (Gemini 3 Pro) → User Weights                                 │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  INPUT: Intake conversation transcript                                      │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  User: "I work from home full-time, so I need good light and a quiet       │
│         spot for video calls. Oh, and I cook a lot - love having           │
│         counter space. We might have kids in a couple years."              │
│                                                                             │
│  PSYCHOLOGIST OUTPUT:                                                       │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  {                                                                          │
│    weights: {                                                               │
│      natural_light_intensity: 1.8,  // "good light" → high                 │
│      wfh_potential: 2.0,            // "work from home full-time" → max    │
│      counter_space: 1.5,            // "love having counter space"         │
│      neighborhood_quietness: 1.5,   // Implied by WFH                      │
│      bedroom_seclusion: 1.3,        // Implied by WFH (calls)              │
│      // Others default to 1.0                                               │
│    },                                                                       │
│    dealbreakers: {                                                          │
│      cubicle_bathroom: true,        // Universal default                    │
│    },                                                                       │
│    must_haves: {                                                            │
│      wfh_potential: 60,             // Must have at least decent WFH       │
│    },                                                                       │
│    planning_children: true,         // "might have kids in a couple years" │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Vibe-check feedback refines weights
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FEEDBACK INTERPRETER (After Vibe-Check)                                    │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  User reacted: "I love those windows! But the living room looks cramped."  │
│                                                                             │
│  WEIGHT ADJUSTMENTS:                                                        │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  natural_light_intensity: 1.8 → 2.0  (+0.2, they REALLY care)             │
│  furniture_feasibility: 1.0 → 1.3    (+0.3, layout matters more)           │
│  flow_for_entertaining: 1.0 → 1.2    (+0.2, space matters)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Example Fit Score Calculation

```
PROPERTY: 2BR in Gràcia, €1,200/month

WPA SCORES:
├── natural_light_intensity: 85
├── wfh_potential: 70
├── counter_space: 60
├── furniture_feasibility: 55
├── cozy_corner_potential: 75
└── (other dimensions...)

USER WEIGHTS:
├── natural_light_intensity: 2.0  (priority)
├── wfh_potential: 2.0            (priority)
├── counter_space: 1.5
├── furniture_feasibility: 1.3
├── cozy_corner_potential: 1.0
└── (others at 1.0)

CALCULATION:
─────────────────────────────────────────────────────────────────
Dimension               Score   Weight    Contribution
─────────────────────────────────────────────────────────────────
natural_light           85      × 2.0     = 170
wfh_potential           70      × 2.0     = 140
counter_space           60      × 1.5     = 90
furniture_feasibility   55      × 1.3     = 71.5
cozy_corner             75      × 1.0     = 75
... (30 more dimensions averaging ~65 × 1.0 = 65 each)
─────────────────────────────────────────────────────────────────
Total weighted sum: ~2,500
Total weight: ~35 dimensions × 1.2 avg weight × 100 = 4,200
Base score: (2,500 / 4,200) × 100 = 59.5

ADJUSTMENTS:
├── +5: Excellent light (85) on high-priority dimension
├── +3: Standout "natural light" matches priority
├── -0: No concerns matching sensitivities
└── TOTAL: +8

FINAL SCORE: 59.5 + 8 = 67.5 → 68 (rounded)
PASS: ✅ (>= 50)
REASON: "Good match with some trade-offs"
TOP MATCHES: ["natural_light", "cozy_corner", "wfh_potential"]
```

#### Fit Scoring Performance

| Metric | Value |
|--------|-------|
| **Cost** | FREE (pure computation) |
| **Latency** | < 1ms |
| **Deterministic** | YES (same inputs → same output) |
| **Debuggable** | YES (breakdown shows contribution) |
| **Dependencies** | WPA output (structured) + User profile |

### WPA Model Decision: Gemini 2.5 Flash-Lite ✅

> **DECISION (Jan 2025)**: Use `gemini-2.5-flash-lite` for ALL WPA operations.
> 
> **Reason**: Cost. At cold start, users may need 900 WPAs/month (10 × 3x daily × 30 days).
> Flash-Lite at ~$0.003/WPA = $2.70/month. Flash at ~$0.03/WPA = $27/month (unprofitable).

| Model | Cost per WPA (30 photos) | Monthly (worst case 900) | Margin @ €10/mo |
|-------|--------------------------|--------------------------|-----------------|
| **Gemini 2.5 Flash-Lite** | ~$0.003 | ~$2.70 | **€7.30 (73%)** ✅ |
| Gemini 2.5 Flash | ~$0.03 | ~$27.00 | ❌ -€17 |
| Gemini 3 Pro Preview | ~$0.90 | ~$810 | ❌ -€800 |

**Flash-Lite Pricing (why it's 10x cheaper):**
- Input: $0.10/1M tokens (vs Flash $0.30)
- Output: $0.40/1M tokens (vs Flash $2.50)

**Why Flash-Lite is sufficient for WPA:**
- WPA describes what it SEES (visual), not deep reasoning
- Flash-Lite supports up to 3,000 images per prompt
- Has thinking capability if needed for complex cases
- Quality is good for structured property analysis
- 10x cost savings makes cold-start sustainable

```typescript
// In src/lib/recommender/wpaShortlist.ts:
const response = await callGeminiRest(fullPrompt, {
  model: 'gemini-2.5-flash-lite',  // COST OPTIMIZED - $0.003/WPA
  temperature: 0.2,
  maxOutputTokens: 2000,
  responseMimeType: 'application/json',
  images,
});
```

---

### Future: Psychologist Reconciler

> **Existing Foundation**: `src/lib/lifestyle/ai-profiler.ts` (already uses Gemini 3 Pro Preview)
> 
> **Concept**: Before scoring, classify user preferences into "matchable now" vs "parked".

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER PREFERENCES                      │  RECONCILER OUTPUT         │
├────────────────────────────────────────┼────────────────────────────┤
│ "Mucha luz natural"                    │ ✅ MATCH: wpa.naturalLight │
│ "Terraza grande"                       │ ✅ MATCH: wpa.outdoorSpace │
│ "Zona tranquila"                       │ 🅿️ PARKED: need noise data │
│ "Buenos colegios"                      │ 🅿️ PARKED: need school API │
│ "Máximo 20 min a Cibeles"              │ ✅ MATCH: isochrone        │
└────────────────────────────────────────┴────────────────────────────┘
```

### Future: Signal Aggregation Cron

> **Weekly cron** to aggregate user feedback and improve recommendations.

```typescript
// Proposed: src/app/api/cron/aggregate-signals/route.ts

// 1. Query all user signals from past week
const signals = await supabase
  .from('user_preference_signals')
  .select('*')
  .gte('created_at', oneWeekAgo);

// 2. Group by listing
const byListing = groupBy(signals, 'listing_id');

// 3. Update DynamoDB aggregates
for (const [listingId, listingSignals] of byListing) {
  await dynamodb.put({
    TableName: 'leo-signal-aggregates',
    Item: {
      listing_id: listingId,
      positive_count: listingSignals.filter(s => s.signal_type === 'like').length,
      negative_count: listingSignals.filter(s => s.signal_type === 'dislike').length,
      noise_feedback: aggregateNoiseSignals(listingSignals),
      updated_at: new Date().toISOString(),
    },
  });
}

// 4. Optionally trigger WPA refresh for listings with strong negative feedback
```

### Future: New DynamoDB Tables Needed

```typescript
// 1. Aggregate signals per listing
'leo-signal-aggregates': {
  listing_id: string,           // HASH
  positive_count: number,
  negative_count: number,
  signals: {
    'noise': { positive: 3, negative: 7 },
    'light': { positive: 10, negative: 1 },
  },
  updated_at: string,
}

// 2. Crowd-sourced attributes (things WPA can't see)
'leo-crowd-attributes': {
  listing_id: string,           // HASH
  noise_score: number,          // Derived from user feedback
  school_rating: number,        // From external API
  confidence: 'low' | 'medium' | 'high',
}
```

### Noise Data from Airbnb Reviews (✅ Already Implemented)

> **Existing Implementation**: `src/lib/intelligence/social-radar.ts`
> 
> **How it works**:
> 1. Queries SQLite DB with 650k+ Airbnb reviews
> 2. Scans reviews within radius (100m, 300m, 500m)
> 3. Detects red flag keywords: `ruido, noise, olor, smell, obras, construction...`
> 4. Calculates `touristSaturationLevel: LOW | MEDIUM | HIGH`
> 5. Generates AI summary of "Vibe and Hidden Risks"

```typescript
// Already exists - just needs to be connected to Recommender
import { SocialRadar } from '@/lib/intelligence/social-radar';

const radar = new SocialRadar();
const result = await radar.analyzeLocation(lat, lon, [address]);

// result.airbnb.redFlags = ["...noise from street...", "...construction nearby..."]
// result.airbnb.touristSaturationLevel = "HIGH"
// result.riskLevel = "MEDIUM"
```

**TODO**: Connect Social Radar output to WPA/Fit Scoring:
- Add `noiseRisk` and `touristPressure` to fit scoring weights
- Store Social Radar results in `leo-crowd-attributes` or similar

### WPA Cache TTL Strategy

> **Current**: WPA cached forever (no expiration).
> 
> **Proposed TTL Policy**:

| Trigger | Action |
|---------|--------|
| Listing > 30 days old | Re-analyze if photos changed |
| Strong negative feedback (5+ users) | Re-analyze with updated prompt |
| Model upgrade | Batch re-analyze high-value listings |
| Listing sold/rented | Archive WPA, don't refresh |

---

---

## 💰 Cost Analysis (Conservative Estimates)

### Model Pricing Reference (Jan 2025)

| Model | Input (/1M tokens) | Output (/1M tokens) | Use Case |
|-------|-------------------|---------------------|----------|
| **Gemini 2.5 Pro** | $1.25 | $10.00 | Complex reasoning (AI Profiler) |
| **Gemini 2.5 Flash** | $0.30 | $2.50 | Social Radar, general analysis |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | **WPA** ✅, explanations |
| **ElevenLabs Agent** | - | - | ~$0.08/min audio |

**ElevenLabs Agent Stack:**
- **TTS**: Multilingual v2 (voice output)
- **LLM**: GPT-4o Mini (conversation logic)
- **Cost**: ~$0.08/min (~$0.80 for 10-min call)

**WPA Cost Breakdown (30 photos, Flash-Lite):**
- Image tokens: ~500 tokens/image × 30 = 15,000 tokens
- Input cost: 16K × $0.10/1M = **$0.0016**
- Output: ~3K tokens × $0.40/1M = **$0.0012**
- **TOTAL: ~$0.003 per WPA** (10x cheaper than Flash)


### Per-User Cost Breakdown

#### A. Initial Onboarding (One-time)

| Step | Model | Cost | Notes |
|------|-------|------|-------|
| Voice Intake (10 min avg) | ElevenLabs | **$0.80** | Turbo agent |
| AI Profiler (Psychologist) | Gemini 3 Pro Preview | **$0.30** | HIGH thinking, full profile |
| First 10 WPAs (30 photos each) | **Gemini 2.5 Flash-Lite** | **$0.03** | $0.003 × 10 listings |
| Social Radar × 10 | Gemini 2.5 Flash + SQLite | **$0.20** | $0.02 × 10 |
| **TOTAL ONBOARDING** | | **$1.33** | |

#### B. Weekly Usage (Active User)

| Activity | Frequency | Cost | Notes |
|----------|-----------|------|-------|
| Follow-up call (5 min) | 1/week | $0.40 | ElevenLabs |
| New WPAs (properties added) | ~5/week | $0.015 | **Gemini 2.5 Flash-Lite**, 30 imgs, $0.003 each |
| Notes processing | ~3 notes/week | $0.05 | Flash-lite |
| Social Radar checks | ~5/week | $0.10 | Flash |
| **WEEKLY TOTAL** | | **$0.57** | |

#### C. Weekly Cron Jobs (Per User)

| Job | Frequency | Cost | Notes |
|-----|-----------|------|-------|
| Signal aggregation | Weekly | $0.02 | DB operations + Flash-lite |
| Profile evolution | Weekly | $0.10 | Flash summary |
| WPA refresh (stale) | Weekly | $0.30 | ~1 listing/week stale |
| **CRON TOTAL** | | **$0.42** | |

### User Lifetime Cost (6-month search)

| Phase | Duration | Cost |
|-------|----------|------|
| Onboarding | Day 1 | $4.30 |
| Active search | 12 weeks | $24.60 (12 × $2.05) |
| Cron jobs | 24 weeks | $10.08 (24 × $0.42) |
| **TOTAL 6-MONTH** | | **$38.98** |

---

## 🚨 Founder Cost Reality Check

### Clustering: DO NOT Move to Recommender

**Current clustering cost:**
```
Gemini 3 Pro Preview + HIGH thinking + 30 images
= ~$0.50 - $1.00 PER LISTING
```

**If we clustered for every recommended property:**
```
10 properties shown to user × $0.75 = $7.50 PER SESSION
User checks 5 times/week × 12 weeks = 60 sessions
60 × $7.50 = $450 just for clustering

THIS WOULD BANKRUPT US
```

**The honest answer:**
> Clustering is for the **paid deep-dive product** only.
> For recommendations, WPA without clusters is enough.
> We look at photos holistically, not room-by-room.

### What CAN We Move (Cost-Safe)

| Component | Cost | Move to Recommender? | Why |
|-----------|------|---------------------|-----|
| **Cadastre** | FREE | ✅ YES | Gov API, no AI |
| **Rental Yield** | FREE | ✅ YES | DynamoDB query |
| **Social Radar** | €0.02 | ✅ Already there | Cheap flash |
| **WPA** | €0.003 | ✅ YES | Flash-Lite, 30 photos |
| **Full WPA** | €0.30 | ⚠️ Limited | Only saved/shortlist |
| **Smart M2** | €0.05 | ⚠️ Buyer saved only | Needs clusters first |
| **Baseline Cost** | €0.03 | ⚠️ Buyer saved only | Needs Smart M2 first |
| **Clustering** | €0.75 | ❌ NEVER | Too expensive |
| **Full Reno Pipeline** | €2-5 | ❌ NEVER | Paid product only |

### The Recommender Cost Pyramid

```
                    ┌─────────────────────┐
                    │   PAID PRODUCT      │  €5-15/property
                    │   Full Clustering   │  (User pays €29-99)
                    │   Full Reno Pipeline│
                    │   Deep Dive         │
                    └──────────┬──────────┘
                               │
               ┌───────────────┴───────────────┐
               │      BUYER SAVED PROPERTY      │  €0.40/property
               │      Smart M2 + Baseline       │  (Only properties
               │      Full WPA (30 photos)      │   they save)
               └───────────────┬───────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       │              ALL RECOMMENDATIONS               │  €0.05/property
       │              WPA (30 photos, Flash-Lite)       │  (Sustainable)
       │              Cadastre (FREE)                   │
       │              Social Radar (€0.02)              │
       │              Rental Yield (FREE)               │
       └───────────────────────────────────────────────┘
```

### Sustainable Cost Model

**Target: <€50/user for 6-month journey**

| Tier | When | Cost/Property | Max Properties | Total |
|------|------|---------------|----------------|-------|
| Browse | All recommendations | €0.05 | 500 | €25 |
| Save | User saves property | €0.40 | 30 | €12 |
| Deep Dive | User pays | €0.00 (they pay) | 3 | €0 |
| **TOTAL** | | | | **€37** ✅

### 💰 Unit Economics (The Real Numbers)

#### Pricing (from SUBSCRIPTION_AND_PAYMENTS.md)

| User Type | Price | Period | Revenue |
|-----------|-------|--------|---------|
| **Renter** | €9.99/month | 6 months | **€60** |
| **Buyer** | €9.99/month | 6 months | **€60** |
| **Pro (Personal Shopper)** | €49/month | 12 months | **€588** |

#### Renter Unit Economics (OPTIMIZED with Pre-Computation)

```
REVENUE (6 months):                    €60.00
─────────────────────────────────────────────
COSTS:
  Onboarding (voice 5min + profiler)   €0.70
  WPA (×100 properties seen)           €0.30   ← Flash-Lite @ €0.003
  Social Radar queries                 €0.00   ← PRE-COMPUTED!
  Cadastre queries                     €0.00   ← PRE-COMPUTED!
  Follow-up calls (×4)                 €1.60
  Cron jobs (24 weeks)                 €2.00
─────────────────────────────────────────────
TOTAL COST:                            €6.30
─────────────────────────────────────────────
GROSS MARGIN:                          €53.70  (90%) ✅
```

**90% margin with pre-computation!**

#### Buyer Unit Economics (OPTIMIZED)

```
REVENUE (6 months):                    €60.00
─────────────────────────────────────────────
COSTS:
  Everything Renter gets               €6.30
  Rental yield queries                 €0.00   ← PRE-COMPUTED!
  Price anomaly queries                €0.00   ← PRE-COMPUTED!
  Instant Reno Estimate (×50)          €1.00   ← Haiku @ €0.02
  Full WPA (×10 saved)                 €3.00   ← Only on SAVED
  Visit Checklist (×10 saved)          €0.30   ← Flash-lite @ €0.03
  Smart M2 + Baseline (×5 serious)     €0.40   ← Only before visits
─────────────────────────────────────────────
TOTAL COST:                            €11.00
─────────────────────────────────────────────
GROSS MARGIN:                          €49.00  (82%) ✅
```

**82% margin for Buyers with Visit Checklist!**

#### Why This Works

| What Changed | Before | After | Savings |
|--------------|--------|-------|---------|
| Social Radar | Per-property €0.02 | Pre-computed €0 | €4.00 |
| Cadastre | Per-property API call | Pre-computed €0 | €2.00 |
| Rental Yield | Computed per-user | Pre-computed €0 | €1.00 |
| Full WPA | All properties | Only SAVED | €15.00 |
| Neighborhood data | Per-property | Per-neighborhood | €3.00 |
| **TOTAL SAVINGS** | | | **€25.00** |

#### Pro (Personal Shopper) Unit Economics

```
REVENUE (12 months):                   €588.00
─────────────────────────────────────────────
COSTS:
  Setup                                €5.00
  Full analyses (×50 properties)       €250.00  ← This is the PAID product
  Support/maintenance                  €20.00
─────────────────────────────────────────────
TOTAL COST:                            €275.00
─────────────────────────────────────────────
GROSS MARGIN:                          €313.00  (53%)
```

**53% margin is HEALTHY.** Pro is where we make money.

---

### 🎯 Cost Optimization Strategy

Given €60 revenue for renters/buyers, we need costs <€30 for healthy margins.

#### MUST DO (Cut costs to €25)

| Optimization | Savings | How |
|--------------|---------|-----|
| **Flash-Lite WPA** | -€25 | Flash-Lite instead of Gemini 3 Pro |
| **Reduce ElevenLabs** usage | -€5 | Shorter conversations, text fallback |
| **Cache aggressively** | -€5 | WPA cache, profile cache, Social Radar cache |
| **Cadastre + Rental Yield** (FREE) | -€0 | Already free, use more! |

#### Target Cost Structure (€25/user)

```
Onboarding:           €0.80  (shorter call + cached profiler)
WPA (×100):           €0.30  (€0.003 × 100 properties seen)
Full WPA (×5 saved):  €1.50  (€0.30 × 5 saved properties)
Social Radar (×20):   €0.40  (€0.02 × 20 properties)
Cadastre (×50):       €0.00  (FREE!)
Rental Yield (×50):   €0.00  (FREE!)
Cron (24 weeks):      €5.00  (optimized)
Weekly calls (×4):    €3.20  (€0.80 × 4 follow-ups)
Notes processing:     €0.24  (€0.01 × 24 notes)
─────────────────────────────
TOTAL:                €13.14  (OPTIMIZED)
─────────────────────────────
MARGIN:               €46.86  (78%) ✅
```

---

## 🏠 Renter vs Buyer: Different Products

### What Each User Type Gets

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RENTER (€9.99/month)                                                   │
│  ─────────────────────                                                  │
│  Goal: Find a nice place to live with good vibe                         │
│                                                                         │
│  ✅ Voice intake (lifestyle, preferences)                               │
│  ✅ WPA (light, layout, outdoor space, views)                           │
│  ✅ Social Radar (noise, tourist pressure)                              │
│  ✅ Fit scoring (match to lifestyle)                                    │
│  ✅ Isochrones (commute)                                                │
│  ❌ NO renovation estimates                                             │
│  ❌ NO visit checklist                                                  │
│  ❌ NO cadastre deep dive                                               │
│                                                                         │
│  Cost target: €13/user (78% margin)                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  BUYER (€9.99/month)                                                    │
│  ─────────────────────                                                  │
│  Goal: Find a property worth investing €300k+ and inspect thoroughly    │
│                                                                         │
│  ✅ Everything Renter gets PLUS:                                        │
│  ✅ Cadastre lookup (official m2, year built, building info)            │
│  ✅ Rental yield estimate (investor ROI)                                │
│  ✅ Renovation budget questions in intake                               │
│  ✅ Instant Reno Estimate (condition + rough €/m2)                      │
│  ✅ Total budget calculation (purchase + reno)                          │
│  ✅ Price vs Neighborhood (detect undervalued properties)               │
│                                                                         │
│  🆕 VISIT CHECKLIST (Buyer exclusive):                                  │
│  ├── Structural checks (cracks, humidity, floor level)                  │
│  ├── Installation checks (electrics, plumbing, gas)                     │
│  ├── Community checks (neighbors, fees, reserves)                       │
│  ├── Legal checks (debts, permits, catastro match)                      │
│  ├── Noise test timing (visit at different hours)                       │
│  └── Questions to ask seller/agent                                      │
│                                                                         │
│  Cost target: €18/user (70% margin)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Visit Checklist (Buyer Only)

When buyer saves a property, generate a personalized checklist:

```typescript
interface VisitChecklist {
  property_specific: {
    // Based on WPA concerns
    items: ChecklistItem[];  // "Check kitchen plumbing - photos show old pipes"
  };
  
  building_specific: {
    // Based on Cadastre (year built, construction type)
    items: ChecklistItem[];  // "Building from 1965 - check for asbestos in pipes"
  };
  
  location_specific: {
    // Based on Social Radar
    items: ChecklistItem[];  // "Tourist area - visit on weekend to test noise"
  };
  
  standard: {
    // Universal buyer checks
    structural: ChecklistItem[];
    installations: ChecklistItem[];
    community: ChecklistItem[];
    legal: ChecklistItem[];
  };
}
```

**Cost**: Generated once when property saved, using Flash-lite with context from WPA + Cadastre + Social Radar = ~€0.03

---

## 🗄️ Pre-Computed Property Database (Amortized Costs)

### The Strategy: Compute Once, Query Forever

Instead of computing per-user-per-property, **pre-compute cheap attributes on ALL harvested properties** and store them. Then queries are FREE.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HARVEST PIPELINE (runs nightly on new listings)                        │
│                                                                         │
│  For EVERY new property in leo-listings:                                │
│                                                                         │
│  1. Parse listing → Already done (FREE)                                 │
│     └── price, sqm, bedrooms, bathrooms, location, photos               │
│                                                                         │
│  2. Geocode → Already done (FREE via Nominatim)                         │
│     └── lat, lng, neighborhood, district                                │
│                                                                         │
│  3. Cadastre lookup → FREE (Gov API)                                    │
│     └── official_m2, year_built, floor, building_units                  │
│                                                                         │
│  4. Neighborhood attributes → Computed ONCE per neighborhood            │
│     └── avg_rent, avg_sale_price, tourist_density, noise_index          │
│                                                                         │
│  5. Rental yield → Computed from our own data (FREE)                    │
│     └── estimated_monthly_rent, gross_yield_pct                         │
│                                                                         │
│  6. Price anomaly → Computed from our own data (FREE)                   │
│     └── price_vs_avg_pct, is_undervalued, is_overpriced                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  leo-listings-enriched (DynamoDB)                                       │
│                                                                         │
│  {                                                                       │
│    listing_id: "idealista-12345",                                       │
│    // Original parsed data                                              │
│    price: 385000,                                                       │
│    sqm: 85,                                                             │
│    bedrooms: 3,                                                         │
│    lat: 41.3991,                                                        │
│    lng: 2.1547,                                                         │
│                                                                         │
│    // PRE-COMPUTED (FREE to query)                                      │
│    cadastre: {                                                          │
│      official_m2: 82,                                                   │
│      year_built: 1968,                                                  │
│      floor: "3",                                                        │
│      building_units: 12                                                 │
│    },                                                                   │
│    neighborhood: {                                                      │
│      name: "Gràcia",                                                    │
│      avg_rent_m2: 16.5,                                                 │
│      avg_sale_m2: 4200,                                                 │
│      tourist_density: "MEDIUM",                                         │
│      noise_index: 62                                                    │
│    },                                                                   │
│    computed: {                                                          │
│      rental_yield_pct: 4.2,                                             │
│      price_vs_neighborhood: -8,  // 8% below avg                        │
│      sqm_discrepancy: -3,        // listing claims 3m² more             │
│      building_age_years: 57,                                            │
│      is_potential_gem: true                                             │
│    },                                                                   │
│    enriched_at: "2024-12-03T10:00:00Z"                                  │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### What We Pre-Compute (Cost Analysis)

| Attribute | Source | Cost | Frequency | Total/Month |
|-----------|--------|------|-----------|-------------|
| **Cadastre lookup** | Gov API | FREE | Per property | €0 |
| **Neighborhood stats** | Our DynamoDB | FREE | Per neighborhood (~500) | €0 |
| **Rental yield** | Our DynamoDB | FREE | Per property | €0 |
| **Price anomaly** | Our DynamoDB | FREE | Per property | €0 |
| **Geocoding** | Nominatim | FREE | Per property | €0 |

**Total cost to enrich 100,000 properties: ~€0** (all free APIs + our own data)

### Neighborhood Pre-Computation

Instead of running Social Radar per-property, pre-compute per-neighborhood:

```typescript
// Run weekly on each neighborhood
interface NeighborhoodProfile {
  neighborhood_id: string;
  name: string;
  
  // From Airbnb data (Social Radar)
  tourist_density: 'LOW' | 'MEDIUM' | 'HIGH';
  noise_index: number;           // 0-100
  common_complaints: string[];   // "noise", "tourists", "construction"
  
  // From our listings data
  avg_rent_per_m2: number;
  avg_sale_per_m2: number;
  rent_to_sale_ratio: number;    // Higher = better rental yield
  
  // From Cadastre aggregate
  avg_building_age: number;
  pct_pre_1980: number;          // Asbestos risk indicator
  
  // Computed
  investment_score: number;      // 0-100
  livability_score: number;      // 0-100
  
  last_computed: string;
}
```

**Cost**: ~€0.50/week for 500 neighborhoods = €2/month total

### Query Patterns (All FREE)

```typescript
// User searches - ALL FREE because pre-computed

// 1. "Show me properties in quiet areas"
const results = await dynamoAdapter.queryListings({
  neighborhood_noise_index_lt: 40,
  ...userFilters
});

// 2. "Find undervalued properties" (Buyer)
const results = await dynamoAdapter.queryListings({
  price_vs_neighborhood_lt: -10,  // 10%+ below average
  ...userFilters
});

// 3. "Best rental yield" (Buyer-Investor)
const results = await dynamoAdapter.queryListings({
  rental_yield_pct_gt: 5,
  ...userFilters
});

// 4. "Modern buildings only"
const results = await dynamoAdapter.queryListings({
  building_age_years_lt: 20,
  ...userFilters
});

// 5. "Listings where seller is lying about m²"
const results = await dynamoAdapter.queryListings({
  sqm_discrepancy_lt: -5,  // Claims 5+ m² more than cadastre
  ...userFilters
});
```

### Updated Cost Model with Pre-Computation

```
BEFORE (per-user costs):
├── Cadastre lookup per property → €0 but slow API calls
├── Social Radar per property → €0.02 each
├── Rental yield calculation → CPU time

AFTER (pre-computed, query FREE):
├── Everything already in DynamoDB
├── User query → Single DynamoDB scan
├── Cost per query → €0.0001
└── No AI needed for basic filtering!
```

### Pre-Computation Pipeline (Nightly Cron)

```typescript
// src/scripts/enrich-listings-nightly.ts
async function enrichNewListings() {
  // 1. Get listings added in last 24h
  const newListings = await dynamoAdapter.getListingsSince(yesterday);
  
  for (const listing of newListings) {
    // 2. Cadastre (FREE)
    const cadastre = await cadastreClient.lookup(listing.lat, listing.lng);
    
    // 3. Neighborhood (already computed, just lookup)
    const neighborhood = await getNeighborhoodProfile(listing.lat, listing.lng);
    
    // 4. Rental yield (query our own data)
    const comparableRents = await dynamoAdapter.queryListings({
      transactionType: 'rent',
      lat: listing.lat, lng: listing.lng,
      radiusKm: 0.3,
      bedrooms: listing.bedrooms,
    });
    const avgRent = average(comparableRents.map(r => r.price));
    const rentalYield = (avgRent * 12) / listing.price * 100;
    
    // 5. Price anomaly (query our own data)
    const comparableSales = await dynamoAdapter.queryListings({
      transactionType: 'sale',
      neighborhood: neighborhood.name,
      bedrooms: listing.bedrooms,
    });
    const avgPrice = average(comparableSales.map(s => s.price));
    const priceVsAvg = ((listing.price - avgPrice) / avgPrice) * 100;
    
    // 6. Store enriched data
    await dynamoAdapter.updateListing(listing.listing_id, {
      cadastre,
      neighborhood: neighborhood.name,
      rental_yield_pct: rentalYield,
      price_vs_neighborhood: priceVsAvg,
      sqm_discrepancy: (listing.sqm || 0) - (cadastre?.official_m2 || listing.sqm || 0),
      building_age_years: new Date().getFullYear() - (cadastre?.year_built || 2000),
      is_potential_gem: priceVsAvg < -10 && rentalYield > 4,
      enriched_at: new Date().toISOString(),
    });
  }
}
```

**Cost per night**: ~€0.10 (DynamoDB writes only)
**Result**: 100,000 properties enriched, queryable for FREE forever

### Geo-Inference: One Building's Data = Nearby Buildings

```typescript
// If we know building A's year from Cadastre...
const buildingA = await cadastreClient.lookup(lat1, lng1);
// year_built: 1968

// Buildings within 50m radius likely same era/construction
const nearbyBuildings = await getNearbyWithinRadius(lat1, lng1, 50);
for (const b of nearbyBuildings) {
  if (!b.cadastre?.year_built) {
    // Infer from nearby
    b.inferred_year_built = buildingA.cadastre.year_built;
    b.inferred_construction_era = "1960s"; // Pre-1980 = asbestos risk
    b.data_source = "geo_inference";
  }
}
```

**What we can geo-infer:**
| Attribute | Inference Logic | Confidence |
|-----------|-----------------|------------|
| Year built | Same building/block | High |
| Construction type | Same neighborhood + era | Medium |
| Noise levels | Same street/block | High |
| Tourist pressure | Same neighborhood | High |
| Building community | Same building | High |
| Energy efficiency | Same era → same regs | Medium |
| Asbestos risk | Pre-1980 construction | High |

---

## 🔄 Recommender Pipeline Flow (FINAL - v3)

**Last Updated**: December 2024

This is the **FINAL** recommender pipeline design. Key decisions:
- **Vibe-check DURING call** - Calibrates perception vs WPA before ending
- **Map shown ONCE at end** - Not updating live (simpler UX)
- **Variable timing** - Progress-based, not time-based
- **Batch processing 3x daily** - After delta harvest completes
- **Fit scoring = weights × thresholds** - Both calibrated from vibe-check

---

### Part 1: Intake Call Flow

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║                           INTAKE CALL (Variable length, ~10-15 min)                     ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

PHASE A: LISTENING & EXTRACTING
────────────────────────────────────────────────────────────────────────────────────────
Leo asks naturally, no fixed timing. Once we have ENOUGH for basic filters:
  ✓ Budget range
  ✓ Min bedrooms / sqm
  ✓ City or rough area
  
→ TRIGGER: "trigger_early_wpa" tool fires in background
           Picks 3 diverse listings, runs WPA (no clusters needed)

Leo continues conversation while WPA runs...

PHASE B: DEEPER QUESTIONS (Map builds progressively)
────────────────────────────────────────────────────────────────────────────────────────
Leo learns:
• Work situation, commute needs → [Map: Isochrone appears, zoom to city]
• Lifestyle, household, pets → [Map: Neighborhoods get colored by score]
• Dealbreakers, preferences → [Map: Neighborhoods adjust]
• POIs they care about → [Map: POI searches fire, heatmap gradient builds]

→ Background: Shape forms from commute intersection
→ Background: Flash-Lite scores POIs for user fit
→ Building dimension WEIGHTS + THRESHOLDS (what they care about)

PHASE C: VIBE-CHECK (When WPA ready, ~3 min after trigger)
────────────────────────────────────────────────────────────────────────────────────────
Leo: "Before we wrap up, I want to calibrate my understanding of what 
      YOU see when you look at a place. I'm gonna show you 3 apartments - 
      don't worry about the location, this is just about the space itself.
      Tell me what jumps out - good or bad."

LISTING 1:
  Leo: "Here's the first one. What do you think?"
  User: "Light is great! Kitchen's too small though."
  
  → Compare to WPA: light=85 (user agrees), kitchen=65 (user thinks bad)
  → THRESHOLD: kitchen needs +15 (user needs 80+)

LISTING 2:
  User: "Meh, feels dark. Love the terrace though."
  
  → Compare to WPA: light=78 (user thinks dark), terrace=90 (user agrees)
  → THRESHOLD: light needs +12 (confirms high standards)

LISTING 3:
  User: "This is what I'm talking about!"
  
  → WPA: light=92, kitchen=80, terrace=85
  → THRESHOLDS CONFIRMED: light ≥88, kitchen ≥80

PHASE D: WRAP-UP & MAP REVEAL
────────────────────────────────────────────────────────────────────────────────────────
• Map has been building progressively during the call
• Final heatmap with all layers (shape, neighborhoods, POIs) is visible

Leo: "Alright, I've got a good picture of what you're looking for.
      
      You can see on your map - the brighter areas are where you'll 
      find what you're looking for. [Leo explains top areas].
      
      I found [X] listings scoring above 75% fit. You can always 
      find this map on your profile page.
      
      In the next few days, as new places get listed, you'll be 
      the first to know. If I find there isn't much available, 
      I'll request a quick follow-up call to see what you might 
      be flexible on.
      
      Sound good?"

CALL ENDS
────────────────────────────────────────────────────────────────────────────────────────
User sees: Full personalized heatmap with scores
User goes back to their day
```

---

### Part 2: Vibe-Check Explained

**Why Vibe-Check?**

WPA gives us **objective** dimension scores (1-100). But users have **subjective** perceptions.
Example: WPA says "light = 85" but user thinks "this feels dark."

Vibe-check calibrates the GAP between:
- **Weights**: How much they CARE about a dimension (0-2)
- **Thresholds**: What score they NEED to be satisfied (baseline + adjustment)

**What Vibe-Check Does NOT Do:**
- ❌ NOT about location (ignore neighborhoods)
- ❌ NOT about recommending these exact properties
- ❌ NOT about budget or size

**Leo's Framing (Casual):**
> "I'm gonna show you 3 quick places - don't worry about where they are or the price, 
> I just want to see how you react to the vibe. Tell me what pops out, good or bad."

---

### Part 3: Fit Scoring Formula

```typescript
// After vibe-check, we have:
// - dimension_weights: { light: 1.5, kitchen: 2.0, terrace: 0.5, ... }
// - dimension_thresholds: { light: 88, kitchen: 80, terrace: 70, ... }
// - dimension_relevance: { light: true, kitchen: true, terrace: true, transport: false, ... }

function calculateFitScore(listing: Listing, profile: UserProfile): number {
  const wpaScores = listing.wpa_scores; // From WPA
  let totalContribution = 0;
  let totalWeight = 0;

  for (const [dim, weight] of Object.entries(profile.dimension_weights)) {
    // Skip if user doesn't care about this dimension
    if (!profile.dimension_relevance[dim]) continue;
    if (weight === 0) continue;

    const wpaScore = wpaScores[dim] ?? 50; // Default to neutral
    const threshold = profile.dimension_thresholds[dim] ?? 70; // Default baseline

    // Does this listing meet their threshold for this dimension?
    if (wpaScore >= threshold) {
      // Full contribution
      totalContribution += wpaScore * weight;
    } else {
      // Below threshold - penalized
      const penalty = (threshold - wpaScore) / threshold;
      totalContribution += wpaScore * weight * (1 - penalty);
    }

    totalWeight += weight;
  }

  // Normalize to 0-100
  return totalWeight > 0 ? (totalContribution / totalWeight) : 50;
}
```

**Key Insight**: The threshold determines the "cutoff" for satisfaction. If WPA=75 but user's threshold=80, they'll see that dimension as "not good enough" even if WPA says it's decent.

---

### Part 4: ElevenLabs Agent State Machine

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║                    ELEVENLABS AGENT: STATE MACHINE / GRAPH                              ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

                              ┌─────────────┐
                              │   START     │
                              └──────┬──────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                       │
│  ┌─────────────────────┐         ┌─────────────────────┐         ┌────────────────┐  │
│  │   EXTRACTING        │         │   HAVE_BASICS?      │         │ TRIGGER_WPA    │  │
│  │                     │────────▶│                     │────────▶│                │  │
│  │ Listen, ask about:  │   Yes   │ Budget, beds, city? │   Yes   │ Fire early WPA │  │
│  │ • Budget            │         │                     │         │ on 3 listings  │  │
│  │ • Beds/sqm          │◀────────│                     │         │ (background)   │  │
│  │ • Area              │   No    └─────────────────────┘         └───────┬────────┘  │
│  │ • Household         │                                                 │           │
│  │ • Work situation    │                                                 │           │
│  └─────────────────────┘                                                 │           │
│           │                                                              │           │
│           │ (continue extracting)                                        │           │
│           ▼                                                              ▼           │
│  ┌─────────────────────┐                                    ┌─────────────────────┐  │
│  │   DEEPER_QUESTIONS  │                                    │   WPA_PENDING       │  │
│  │                     │                                    │                     │  │
│  │ • Commute/anchors   │                                    │ Keep talking while  │  │
│  │ • Lifestyle         │                                    │ WPA runs in BG      │  │
│  │ • POIs              │◀──────────────────────────────────▶│                     │  │
│  │ • Dealbreakers      │         (parallel)                 │                     │  │
│  └──────────┬──────────┘                                    └──────────┬──────────┘  │
│             │                                                          │             │
│             │                          WPA ready?                      │             │
│             │                              │                           │             │
│             │                              ▼                           │             │
│             │                     ┌─────────────────────┐              │             │
  │             └────────────────────▶│   VIBE_CHECK        │◀─────────────┘             │
  │                                   │                     │                            │
  │                                   │ Map temporarily     │                            │
  │                                   │ shows property      │                            │
  │                                   │ photos instead      │                            │
  │                                   │                     │                            │
  │                                   │ Show 3 listings     │                            │
  │                                   │ Capture reactions   │                            │
  │                                   │ Calculate thresholds│                            │
  │                                   └──────────┬──────────┘                            │
  │                                              │                                       │
  │                                              ▼                                       │
  │                                   ┌─────────────────────┐                            │
  │                                   │  FINALIZE_HEATMAP   │                            │
  │                                   │                     │                            │
  │                                   │ Recalculate with    │                            │
  │                                   │ calibrated          │                            │
  │                                   │ thresholds          │                            │
  │                                   │                     │                            │
  │                                   │ Final heatmap       │                            │
  │                                   │ scores updated      │                            │
  │                                   └──────────┬──────────┘                            │
  │                                              │                                       │
  │                                              ▼                                       │
  │                                   ┌─────────────────────┐                            │
  │                                   │   WRAP_UP           │                            │
  │                                   │                     │                            │
  │                                   │ • Map is complete   │                            │
  │                                   │ • Explain top areas │                            │
  │                                   │ • Set expectations  │                            │
  │                                   │ • "See on profile"  │                            │
  │                                   │ • "First to know"   │                            │
  │                                   │ • "Follow-up if     │                            │
  │                                   │   tight"            │                            │
  │                                   └──────────┬──────────┘                            │
│                                              │                                       │
│                                              ▼                                       │
│                                   ┌─────────────────────┐                            │
│                                   │   END               │                            │
│                                   │                     │                            │
│                                   │ Save profile        │                            │
│                                   │ Trigger post-call   │                            │
│                                   │ processing          │                            │
│                                   └─────────────────────┘                            │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**State Transitions (Edges):**

| From State | To State | Trigger |
|------------|----------|---------|
| START | EXTRACTING | Always |
| EXTRACTING | HAVE_BASICS? | After each extraction |
| HAVE_BASICS? | TRIGGER_WPA | If budget + beds + area known |
| HAVE_BASICS? | EXTRACTING | If missing info |
| TRIGGER_WPA | WPA_PENDING | Immediately |
| WPA_PENDING | DEEPER_QUESTIONS | Continue conversation |
| DEEPER_QUESTIONS ↔ WPA_PENDING | (parallel) | Keep talking while map builds |
| WPA_PENDING | VIBE_CHECK | When WPA ready |
| DEEPER_QUESTIONS | VIBE_CHECK | When WPA ready |
| VIBE_CHECK | FINALIZE_HEATMAP | After 3 listings calibrated |
| FINALIZE_HEATMAP | WRAP_UP | Immediately |
| WRAP_UP | END | Always |

**NEW: HANDLE_NO_OVERLAP State (branches from DEEPER_QUESTIONS)**

| From State | To State | Trigger |
|------------|----------|---------|
| DEEPER_QUESTIONS | HANDLE_NO_OVERLAP | If isochrones don't intersect |
| HANDLE_NO_OVERLAP | DEEPER_QUESTIONS | User extends travel time |
| HANDLE_NO_OVERLAP | SEARCH_ALTERNATIVES | User wants to explore alternatives |
| SEARCH_ALTERNATIVES | DEEPER_QUESTIONS | User picks alternative POI |

**Tools by State:**

| State | Tools Available |
|-------|-----------------|
| EXTRACTING | `update_profile`, `check_availability`, `detect_city` |
| TRIGGER_WPA | `trigger_early_wpa` |
| WPA_PENDING | `update_profile`, `add_anchor`, `calculate_intersection` |
| DEEPER_QUESTIONS | `update_profile`, `search_pois`, `score_pois`, `score_neighborhoods`, `update_heatmap` |
| HANDLE_NO_OVERLAP | `explain_no_overlap`, `extend_anchor_time`, `search_alternative_pois` |
| VIBE_CHECK | `show_vibe_check`, `record_calibration` |
| FINALIZE_HEATMAP | `calculate_heatmap`, `recalculate_with_thresholds` |
| WRAP_UP | `show_final_map`, `save_profile`, `trigger_post_call` |

---

### Part 5: Post-Call Batch Processing (3x Daily)

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║                           POST-CALL: BATCH PROCESSING (3x daily)                        ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

RUNS: After delta harvest + parse completes (3x daily)
FOR: All users with active profiles

STEP 1: PRE-WPA FIT SCORE (Fast, no AI)
────────────────────────────────────────────────────────────────────────────────────────
For each user:
  • Get all listings in their search shape (commute intersection)
  • Filter: active only (not let/sold)
  • Filter: meets hard constraints (budget, beds, sqm)
  • Score using: heatmap score (POI × neighborhood multiplier)
  • KEEP: Top 10 above fit threshold (if fewer, that's fine - it's personalization)

STEP 2: WPA (AI, ~3 min per listing)
────────────────────────────────────────────────────────────────────────────────────────
For each user's top 10:
  • Run WPA (no clusters needed - uses all photos)
  • Extract 35 dimensions
  • Cache results in leo-wpa-cache DynamoDB

STEP 3: POST-WPA FIT SCORE (Math, no AI)
────────────────────────────────────────────────────────────────────────────────────────
For each WPA'd listing:
  
  For each dimension:
    IF wpa[dim] >= baseline + user_threshold[dim]:
      contribution = wpa[dim] × user_weight[dim]
    ELSE:
      contribution = 0 (below their threshold)
      
  FIT_SCORE = Σ contributions / Σ weights (where relevant)
  
  KEEP: All that pass fit threshold (e.g., >= 70)

STEP 4: EXPLANATION GENERATION (Flash-Lite, cheap)
────────────────────────────────────────────────────────────────────────────────────────
For each passing listing:
  • Generate "Why it matches YOU" explanation
  • Reference their specific preferences
  • Note any trade-offs
  • ~$0.001 per explanation

STEP 5: EMAIL/NOTIFY
────────────────────────────────────────────────────────────────────────────────────────
If new matches found:
  • Email: "New places that match your search"
  • List all that pass fit score
  • Include personalized explanations
  • "See more on your profile →"
```

---

### Part 6: Location Scoring - The Three-Layer Heatmap System

> 📖 **Full Documentation:** [`docs/HEATMAP_LOCATION_SCORING.md`](../HEATMAP_LOCATION_SCORING.md)

Every location gets a **continuous score from 0-100%** based on three stacked layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   LAYER 3: POI HEATMAP (Fine-grained gradient)                              │
│   ═══════════════════════════════════════════                               │
│                                                                             │
│        ░░░▒▒▓▓███████▓▓▒▒░░░                                               │
│        ░▒▓████  POI  ████▓▒░   ← Gradient based on POI proximity/quality   │
│        ░▒▓████ SCORE ████▓▒░                                               │
│        ░░░▒▒▓▓███████▓▓▒▒░░░                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 2: NEIGHBORHOOD SCORES (Solid colors per boundary)                  │
│   ═══════════════════════════════════════════════════════                   │
│                                                                             │
│      ┌────────────┬────────────┬────────────┐                               │
│      │  GRÀCIA    │  EIXAMPLE  │ SANT MARTÍ │                               │
│      │    85%     │    72%     │    68%     │   ← Multiplier on POI scores  │
│      └────────────┴────────────┴────────────┘      based on 20 dimensions   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LAYER 1: COMMUTE PENALTY (Graduated scoring, NOT hard boundary)           │
│   ═══════════════════════════════════════════════════════════════           │
│                                                                             │
│      Turf.js radial circles for visualization (FREE)                        │
│      30 min = 0 penalty → 60 min = -40 → 90 min = -70                       │
│      ⚠️ NO GEOGRAPHIC EXCLUSION - All listings in city are scored          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

FINAL_SCORE = (POI_SCORE × NEIGHBORHOOD_MULTIPLIER) + COMMUTE_PENALTY
```

---

#### Layer 1: The Shape (Hard Anchors)

Created by **Geoapify isochrone intersection** of non-negotiable commute points.

- Work commute (if applicable)
- School/childcare (if applicable)
- Beach access (if high priority)
- Other "must be within X minutes" anchors

**Changes:** RARELY (only after weeks, with explicit user permission)

---

#### Layer 2: Neighborhood Scores (20 Dimensions)

Each neighborhood gets a score (0-100) based on how its 20 dimensions match user preferences:

| Category | Dimensions |
|----------|------------|
| Life Stage | young_professional, family_friendly, retiree_friendly, student_friendly |
| Lifestyle | nightlife, creative_scene, foodie_scene, outdoor_lifestyle, fitness_culture, lgbtq_friendly, pet_friendly, digital_nomad, expat_community |
| Universal | safety, cleanliness, green_spaces, walkability, transit_access, quietness |
| Economic | affordability, gentrification_risk |

Score converts to a **multiplier (0.7 - 1.3)**:
- 0% match → 0.7× (30% penalty)
- 50% match → 1.0× (neutral)
- 100% match → 1.3× (30% boost)

**Explicit Mention Boost:**
- "I love Gràcia" → +20% boost
- "I've looked at Eixample" → +10% boost
- "Not Gothic Quarter" → 70% penalty

---

#### Layer 3: POI Heatmap (Fine-Grained Gradient)

> **📖 Full Logic:** See `docs/LOCATION_SCORING_LOGIC.md` for the complete framework

For each POI category (coffee, gym, parks, etc.):

```
HEATMAP_SCORE = Σ(DISTANCE_SCORE × USER_FIT × CATEGORY_WEIGHT) / MAX_POSSIBLE
```

Where:
- `DISTANCE_SCORE` = 0-10 (10 = very close, 0 = at max acceptable time)
- `USER_FIT` = 0-10 (from Flash-Lite POI scoring based on reviews/description)
- `CATEGORY_WEIGHT` = 0.5-2.0 (from user's stated importance)

**The Hybrid Approach (CRITICAL DISTINCTION):**

| POI Type | Example | Data Source | Distance Method | Why |
|----------|---------|-------------|-----------------|-----|
| **EXISTENCE POI** | Beach, parks, metro | OSM (DynamoDB) | Turf.js geometry | FREE - quality doesn't vary |
| **QUALITY POI** | Coffee, restaurants | ScrapingDog + reviews | Turf.js geometry | PAID - quality matters |
| **ANCHOR** | Work, school | User-specified | Geoapify transit isochrone | PAID - transit changes math |

**Existence POIs (FREE via OSM):**
- Beach/sea proximity → `turf.pointToLineDistance(listing, coastline)`
- Parks/green space → `turf.pointToPolygonDistance(listing, parkPolygons)`
- Metro stations → `turf.nearestPoint(listing, metroStations)`
- Playgrounds, schools → Same geometry approach

**Quality POIs (PAID via ScrapingDog):**
- "Good specialty coffee" → ScrapingDog search → Flash-Lite scores each for user fit
- "Nice restaurants" → ScrapingDog search → Flash-Lite scores quality
- "A gym with good equipment" → ScrapingDog search → Flash-Lite scores

**Distance → Time Conversion (for Existence POIs):**
```typescript
const WALKING_SPEED_M_PER_MIN = 80; // ~5km/h
const STREET_GRID_FACTOR = 1.3;     // Streets aren't straight lines

function estimateWalkingMinutes(straightLineMeters: number): number {
  return (straightLineMeters * STREET_GRID_FACTOR) / WALKING_SPEED_M_PER_MIN;
}
// 800m straight line → 800 * 1.3 / 80 = 13 min walk
```

**Why This Hybrid Works:**
- Nobody metros to their morning beach jog → geometry is fine
- Nobody cares about "4.5 star vs 4.2 star park" → geometry is fine
- Quality coffee matters → need reviews → ScrapingDog
- Commute defines livability → need transit routing → Geoapify

---

#### Example: Combined Score

```
USER: Values creativity (HIGH), nightlife (HIGH), family-friendly (LOW)
LOCATION: Coordinate in Gràcia neighborhood

POI SCORE: 70% (good coffee nearby, ok gym)
NEIGHBORHOOD MULTIPLIER: 1.26 (85% dimension match + "I love Gràcia" mention)

FINAL SCORE: 70 × 1.26 = 88% ✨
```

---

#### Why This Works Better Than Binary Zones

| Binary Zones | Continuous Heatmap |
|--------------|-------------------|
| "Is this GREEN or YELLOW?" | "This scores 78%" |
| Complex 8-step permutations | Simple threshold slider |
| Surprises need special logic | Surprises emerge naturally |
| Arbitrary boundaries | Smooth gradients |
| Hard to explain | Built-in reasoning |

---

### Part 6.1: Real-Time Heatmap Building During Call

The heatmap builds **progressively during the call** - users see instant visual feedback as they share preferences.

**Desktop:** 50/50 split-screen (conversation + live map)
**Mobile:** Checkpoint-based overlays (toasts, bottom sheets)

```
MINUTE 0: INITIAL STATE                    MINUTE 2: CITY MENTIONED
┌────────────────────────────────┐         ┌────────────────────────────────┐
│        [SPAIN MAP]             │         │     [ZOOM TO BARCELONA]        │
│                                │         │                                │
│       ┌───────┐                │  ──►    │   ┌─────────────────────┐      │
│       │ SPAIN │                │         │   │     BARCELONA       │      │
│       └───────┘                │         │   └─────────────────────┘      │
│                                │         │                                │
│  "Tell me about yourself..."   │         │   🎯 City detected             │
└────────────────────────────────┘         └────────────────────────────────┘

MINUTE 3: FIRST ANCHOR                     MINUTE 5: SHAPE FORMS
┌────────────────────────────────┐         ┌────────────────────────────────┐
│                                │         │                                │
│   ┌─────────────────────┐      │         │   ┌─────────────────────┐      │
│   │       ╭─────╮       │      │  ──►    │   │     ╭─────────╮     │      │
│   │      ╱       ╲      │      │         │   │    ╱           ╲    │      │
│   │     │  ◉ Work │     │      │         │   │   │  SWEET SPOT │   │      │
│   │      ╲       ╱      │      │         │   │    ╲           ╱    │      │
│   │       ╰─────╯       │      │         │   │     ╰─────────╯     │      │
│   └─────────────────────┘      │         │   └─────────────────────┘      │
│                                │         │                                │
│   🚇 Work: 30-min isochrone    │         │   ✨ Commute intersection!      │
└────────────────────────────────┘         └────────────────────────────────┘

MINUTE 7: NEIGHBORHOODS COLORED            MINUTE 10: POI HEATMAP BUILDS
┌────────────────────────────────┐         ┌────────────────────────────────┐
│                                │         │                                │
│   ┌─────────────────────┐      │         │   ┌─────────────────────┐      │
│   │     ╭─────────╮     │      │         │   │     ╭─────────╮     │      │
│   │    ╱███████████╲    │      │  ──►    │   │    ╱░▒▓██████▓▒░╲   │      │
│   │   │██ GRÀCIA ███│   │      │         │   │   │▒▓█☕💪92%█▓▒│   │      │
│   │   │▓▓ EIXAMPLE ▓▓│  │      │         │   │   │▓█ 🤫 85%  ██▓│  │      │
│   │    ╲▓▓▓▓▓▓▓▓▓▓▓╱    │      │         │   │    ╲░▒▓█78%█▓▒░╱    │      │
│   └─────────────────────┘      │         │   └─────────────────────┘      │
│                                │         │                                │
│   🎨 Lifestyle → hood colors   │         │   🎉 Full heatmap complete!    │
└────────────────────────────────┘         └────────────────────────────────┘
```

**WebSocket Events (Real-Time):**

| Event | Trigger | Map Action |
|-------|---------|------------|
| `ZOOM_TO_CITY` | User mentions city | Zoom + city bounds |
| `ADD_ISOCHRONE` | Commute/anchor detected | Show isochrone shape |
| `SET_SHAPE` | Multiple anchors overlap | Show intersection |
| `SET_NEIGHBORHOODS` | Lifestyle revealed | Color neighborhoods |
| `ADD_POIS` | POI searched | Show POI markers |
| `UPDATE_HEATMAP` | POI scored | Update gradient |

---

### Part 6.2: Handling No-Overlap (Isolated Anchors)

When isochrones **don't overlap**, the agent handles it gracefully:

```
NO OVERLAP DETECTED                      PIVOT TO ALTERNATIVES
┌────────────────────────────────┐       ┌────────────────────────────────┐
│                                │       │                                │
│   ╭─────────╮                  │       │   ╭─────────╮                  │
│  ╱           ╲      ╭─────╮    │       │  ╱   💪92%  ╲                  │
│ │ ◉ Work     │      │💪Gym│    │  ──►  │ │ ◉ Work     │                 │
│  ╲           ╱      │(far)│    │       │  ╲  💪85%   ╱                  │
│   ╰─────────╯       ╰─────╯    │       │   ╰─💪71%──╯                   │
│                                │       │                                │
│   ❌ No overlap!               │       │   ✅ 3 alternatives found!     │
└────────────────────────────────┘       └────────────────────────────────┘
```

**Agent Flow:**

1. **Detect & Explain:** "Your gym doesn't overlap with your commute area"
2. **Offer Extension:** "Would a longer trip to the gym work?"
3. **If NO → Pivot:** "What makes a good gym for you? Let me find alternatives"
4. **Search & Show:** ScrapingDog finds alternatives, Flash-Lite scores them
5. **User Chooses:** Accept alternative OR keep original (extend travel)

**Turf.js Pairwise Analysis:** When intersection returns empty, check all pairs locally to identify exactly which anchor is isolated (no extra API calls).

---

### Part 6.3: Follow-Up Adaptation (2 Simple Levers)

Instead of complex permutations, we have **2 levers**:

```
LEVER 1: POI SOFTNESS (changes HEATMAP)          When: Day 3
═════════════════════════════════════════════════════════════
"Can specialty coffee be 15 min instead of 10?"
→ More area becomes "bright" on heatmap
→ Same shape, different gradient

LEVER 2: COMMUTE TOLERANCE (changes SHAPE)       When: Week 2-3 (last resort)
═════════════════════════════════════════════════════════════
"Would you consider 40 min instead of 30?"
→ The shape itself gets bigger
→ Opens entirely new neighborhoods
```

**Day 3 Follow-Up (if <10 listings):**

```
Leo: "There aren't many options right now. Would you be okay 
      with specialty coffee being a 15-min walk instead of 10?"

User: "Yeah, that's fine."

→ Update poi_preferences, recalculate heatmap
→ "Great! That gives us 22 options now."
```

**Week 2-3 Follow-Up (last resort):**

```
Leo: "We've been monitoring for 2 weeks. Would you consider 
      a 40-min commute? Opens up great neighborhoods like X and Y."

User: "I guess I could do 40 minutes."

→ Regenerate shape with Work(40min), recalculate everything
→ "Wow, that's a big difference - 45 options now!"
```

---

### Part 6.4: Desktop vs Mobile Map UI

**Desktop: Continuous Side-by-Side**

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

**Mobile: Checkpoint-Based Overlays**

| # | Trigger | Style | Duration |
|---|---------|-------|----------|
| 1 | City mentioned | Toast | 2-3 sec (auto-dismiss) |
| 2 | First anchor | Toast | 2-3 sec |
| 3 | **Shape formed** | Bottom sheet (60%) | Until dismissed |
| 4 | **Isolated anchor** | Full overlay | Until resolved |
| 5 | **Vibe-check** | Full overlay | Until complete |
| 6 | **Heatmap complete** | Full overlay | Until dismissed |

**Philosophy:**
- **Desktop magic:** "Watch it build in real-time"
- **Mobile magic:** "Surprise me at key moments"

---

### Part 6.5: Vibe-Check Takes Over Map Space

During vibe-check, property photos replace the map:

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

After vibe-check completes → Map returns with updated heatmap (recalculated with calibrated thresholds)

---

### Part 6.6: Heatmap API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/recommender/generate-shape` | Geoapify isochrone intersection |
| `POST /api/recommender/search-pois` | ScrapingDog Google Maps search |
| `POST /api/recommender/score-pois` | Flash-Lite user fit scoring |
| `POST /api/recommender/score-neighborhoods` | Calculate hood multipliers |
| `POST /api/recommender/calculate-heatmap` | Combined 3-layer formula |
| `POST /api/recommender/listings-in-heatmap` | Filter listings by threshold |

**Full implementation details:** See [`docs/HEATMAP_LOCATION_SCORING.md`](../HEATMAP_LOCATION_SCORING.md)

---

### Part 7: Ongoing Monitoring (Crons)

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║                           ONGOING MONITORING (Cron Jobs)                                ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

DAY 3 CHECK
────────────────────────────────────────────────────────────────────────────────────────
For each user where (now - intake_completed_at) = 3 days:
  • Count active listings above fit threshold (75%+) in their search shape
  
  IF count < 10:
    → Update user: stock_status = 'insufficient'
    → Email: "Your search might be tight"
    → "Would you be okay with [POI] being a bit further?" (POI softness lever)
    → Include button: "Schedule Follow-Up"
    
  IF count >= 10:
    → Update user: stock_status = 'sufficient'
    → Do nothing (they're getting recommendations)

WEEKLY CHECK (Every Monday)
────────────────────────────────────────────────────────────────────────────────────────
For each user with active profile:
  • Count active listings above fit threshold in search shape
  • Check if any SAVED listings went off-market
  
  IF saved_listing_went_inactive:
    → Email: "Heads up - [property] is no longer available"
    → "Here are 3 similar places..."
    
  IF count < 10 AND last_alert > 7 days ago:
    → Same as Day 3 check (POI softness first)
    
  IF count still < 10 after 2 weeks:
    → Offer to extend commute (shape expansion lever - last resort)
    
  IF new high-fit listings (score >= 85%):
    → Email: "New place that's a great fit!"
    → Include explanation
```

---

### Part 8: WPA Without Clusters (Update Required)

**Current WPA** expects room clusters. For vibe-check + batch processing, we need a **simplified WPA**:

```typescript
// src/lib/recommender/wpaQuick.ts (NEW FILE)

/**
 * Quick WPA - No clusters required
 * Uses all photos, extracts 35 dimensions directly
 * For: vibe-check during call, batch processing
 */
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
    
    KITCHEN:
    - kitchen_size: Counter space, storage?
    - kitchen_quality: Appliances, fixtures?
    
    BATHROOM:
    - bathroom_size: Spacious or cramped?
    - bathroom_quality: Modern fixtures?
    
    OUTDOOR:
    - terrace: Size and usability?
    - views: What do windows show?
    
    CONDITION:
    - renovation_needed: 100=move-in ready, 1=gut job
    - finish_quality: Materials, craftsmanship?
    
    STORAGE:
    - closet_space: Built-in storage?
    - general_storage: Cabinets, shelves?
    
    LAYOUT:
    - flow: How rooms connect?
    - privacy: Separation of spaces?
    
    [... continue for all 35 dimensions]
    
    Return JSON with scores only.
  `;
  
  const result = await geminiFlash(prompt, photos);
  return parseWPAResult(result);
}
```

**Key Difference from Full WPA:**
- No cluster-by-cluster analysis
- Single pass over all photos
- Faster (~30 sec vs 3 min)
- Slightly less accurate but good enough for vibe-check

---

### Part 9: Implementation Checklist

#### Supabase Schema Updates

```sql
-- Add to user_lifestyle_profiles
ALTER TABLE user_lifestyle_profiles ADD COLUMN IF NOT EXISTS
  dimension_weights JSONB DEFAULT '{}',
  dimension_thresholds JSONB DEFAULT '{}',
  dimension_relevance JSONB DEFAULT '{}',
  poi_searches JSONB DEFAULT '[]',
  anchors JSONB DEFAULT '[]',
  zones JSONB DEFAULT '{}',
  zone_labels JSONB DEFAULT '{}',
  vibe_check_results JSONB DEFAULT '[]',
  last_stock_check TIMESTAMPTZ,
  stock_status TEXT DEFAULT 'unchecked',
  intake_completed_at TIMESTAMPTZ,
  last_recommendations_at TIMESTAMPTZ;

-- Index for batch processing
CREATE INDEX IF NOT EXISTS idx_profiles_active 
  ON user_lifestyle_profiles(intake_completed_at) 
  WHERE intake_completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stock_check
  ON user_lifestyle_profiles(last_stock_check, stock_status);
```

#### DynamoDB Tables

| Table | Purpose | Key Schema | Status |
|-------|---------|------------|--------|
| `leo-listings` | Existing | PK: listing_id | ✅ |
| `leo-wpa-cache` | WPA results | PK: listing_id | ✅ |
| `leo-neighborhood-profiles` | Existing | PK: neighborhood_id | ✅ |
| `leo-neighborhood-boundaries` | Admin boundary GeoJSON | PK: city, SK: neighborhood_id | ✅ CREATED |
| `leo-osm-beaches` | Beach/coastline polygons | PK: city, SK: feature_id | 🔲 TODO |
| `leo-osm-parks` | Park polygons | PK: city, SK: feature_id | 🔲 TODO |
| `leo-osm-metro` | Metro station points | PK: city, SK: station_id | 🔲 TODO |
| `leo-user-zones` | Computed zones (NEW) | PK: user_id, SK: profile_type | 🔲 TODO |

> **OSM Data Source:** geo2day.com PBF files (updated daily) - see `docs/LOCATION_SCORING_LOGIC.md`

#### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents/trigger-early-wpa` | POST | Pick 3 listings, fire WPA |
| `/api/agents/show-vibe-check` | POST | Push listing to UI via WebSocket |
| `/api/agents/record-calibration` | POST | Store threshold from vibe-check |
| `/api/agents/poi-search` | POST | Fire ScrapingDog, return results |
| `/api/agents/generate-isochrone` | POST | Call Geoapify, return polygon |
| `/api/agents/calculate-zones` | POST | Turf.js intersection |
| `/api/agents/show-map` | POST | Push map to UI |
| `/api/agents/save-profile` | POST | Final save with all data |
| `/api/agents/trigger-post-call` | POST | Queue batch processing |
| `/api/batch/process-users` | POST | Pre-WPA → WPA → Post-WPA → Explain |
| `/api/batch/send-recommendations` | POST | Email results |
| `/api/cron/check-stock` | POST | Day 3 + weekly checks |

#### ElevenLabs Agent Changes

| Agent | Changes Needed |
|-------|----------------|
| `Leo-Intake-Renter.json` | Add state machine, new tools, updated prompts |
| `Leo-Intake-Buyer.json` | Same as above |
| `tools/trigger_early_wpa.json` | NEW: Fire background WPA |
| `tools/show_vibe_check.json` | NEW: Show listing in vibe-check modal |
| `tools/record_calibration.json` | NEW: Record user reaction vs WPA |
| `tools/add_anchor.json` | NEW: Add commute/POI anchor, generate isochrone |
| `tools/calculate_intersection.json` | NEW: Compute shape from anchors |
| `tools/score_pois.json` | NEW: Flash-Lite scores POIs for user fit |
| `tools/score_neighborhoods.json` | NEW: Calculate hood multipliers |
| `tools/calculate_heatmap.json` | NEW: Combined 3-layer heatmap |
| `tools/search_alternative_pois.json` | NEW: Find alternatives when anchors don't overlap |
| `tools/show_map.json` | NEW: Display/update live map |

#### UI Components

| Component | Purpose |
|-----------|---------|
| `LiveMap.tsx` | Mapbox single-instance map (never reloads) |
| `useLiveMapUpdates.ts` | Update layers without reload |
| `VibeCheckOverlay.tsx` | Show listing photos, capture reaction |
| `HeatmapLayer.tsx` | Gradient circles from score data |
| `NeighborhoodLayer.tsx` | Solid fill polygons per neighborhood |
| `ShapeLayer.tsx` | Commute intersection outline |
| `POIMarkers.tsx` | Show POIs on map with icons |
| `HeatmapLegend.tsx` | Score gradient explanation |
| `useWebSocket.ts` | Listen for agent pushes |
| `useMapDisplayMode.ts` | Responsive hook (desktop continuous / mobile checkpoint) |
| `MapToast.tsx` | Mobile checkpoint: quick update toast |
| `MapBottomSheet.tsx` | Mobile checkpoint: sweet spot reveal |
| `MapFullOverlay.tsx` | Mobile checkpoint: final map reveal |

#### Email Templates

| Template | Trigger |
|----------|---------|
| `new-recommendations.tsx` | Batch finds new matches |
| `stock-insufficient.tsx` | Day 3 or weekly check fails |
| `listing-alert.tsx` | High-fit listing appears (≥85) |
| `listing-gone.tsx` | Saved listing goes off-market |

---

### Part 10: Phased Implementation Order

**CRITICAL:** Build in this order to enable incremental testing.

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║                        PHASE 1: FOUNDATION (Week 1)                                     ║
║                        Can test: Profile storage, shape generation, heatmap calc        ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

□ 1.1 Supabase migration (2 hr)
      - Add dimension_weights, dimension_thresholds, poi_preferences, etc.
      - Run migration, verify schema

□ 1.2 Update existing update_profile tool (2 hr)
      - Accept dimension_weights, poi_preferences, anchors
      - Store in Supabase

□ 1.3 Shape generation route (3 hr)
      - /api/recommender/generate-shape
      - Call Geoapify for isochrones, compute intersection
      - Return GeoJSON shape

□ 1.4 Heatmap calculation (4 hr)
      - /api/recommender/calculate-heatmap
      - 3-layer formula: POI × neighborhood multiplier
      - Return heatmap GeoJSON (score per grid point)

TEST: Manual API calls to verify shape + heatmap calculation work

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                        PHASE 2: DURING-CALL FEATURES (Week 2)                           ║
║                        Can test: Vibe-check flow, POI searches                          ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

□ 2.1 WPA Quick (no clusters) (4 hr)
      - src/lib/recommender/wpaQuick.ts
      - Single Gemini call, all photos
      - Return 35 dimension scores

□ 2.2 Trigger Early WPA route (2 hr)
      - /api/agents/trigger-early-wpa
      - Pick 3 diverse listings
      - Fire WPA in background, store in cache

□ 2.3 POI Search route (2 hr)
      - /api/agents/poi-search
      - Call ScrapingDog
      - Return lat/lng + travel circles

□ 2.4 Vibe-check routes (3 hr)
      - /api/agents/show-vibe-check (push listing to UI)
      - /api/agents/record-calibration (store reaction)

□ 2.5 WebSocket setup (3 hr)
      - Pusher or Supabase Realtime
      - Push events: ZOOM_TO_CITY, ADD_ISOCHRONE, SET_SHAPE, SET_NEIGHBORHOODS, UPDATE_HEATMAP
      - Frontend listener hook

TEST: Simulate call flow with manual API calls + WebSocket events

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                        PHASE 3: UI COMPONENTS (Week 3)                                  ║
║                        Can test: Full call experience in browser                        ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

□ 3.1 LiveMap.tsx (3 hr)
      - Mapbox single-instance map
      - Load once, update layers via setData()
      - Add empty sources: isochrones, shape, neighborhoods, heatmap, pois

□ 3.2 useLiveMapUpdates.ts (2 hr)
      - zoomToCity, addIsochrone, setShape, setNeighborhoods, updateHeatmap, addPOIs
      - Each updates layers without map reload

□ 3.3 VibeCheckOverlay.tsx (3 hr)
      - Show property photos (temporarily replaces map)
      - WPA score bars
      - Capture user reaction (like/meh/dislike)
      - Send to record-calibration

□ 3.4 WebSocket listener integration (2 hr)
      - useWebSocket hook in Speak with Leo page
      - Listen for map events, call useLiveMapUpdates functions

□ 3.5 Profile page heatmap display (2 hr)
      - Show saved heatmap on profile
      - Score legend component

□ 3.6 Mobile Checkpoint Components (3 hr)
      - MapToast.tsx (quick city/anchor updates)
      - MapBottomSheet.tsx (sweet spot reveal)
      - MapFullOverlay.tsx (vibe-check, final map)
      - useMapDisplayMode.ts (responsive hook)

TEST: Full call with Leo → progressive map building → vibe-check → final reveal

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                        PHASE 4: ELEVENLABS AGENT (Week 4)                               ║
║                        Can test: Complete intake call flow                              ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

□ 4.1 Update agent prompts (4 hr)
      - State machine logic in system prompt
      - When to trigger WPA, vibe-check, zones

□ 4.2 Create new tool definitions (4 hr)
      - trigger_early_wpa.json
      - add_anchor.json (isochrone generation)
      - calculate_intersection.json (shape from anchors)
      - search_pois.json (ScrapingDog lookup)
      - score_pois.json (Flash-Lite scoring)
      - score_neighborhoods.json (dimension matching)
      - calculate_heatmap.json (3-layer formula)
      - search_alternative_pois.json (no-overlap handling)
      - show_vibe_check.json
      - record_calibration.json
      - show_map.json

□ 4.3 Push agents to ElevenLabs (1 hr)
      - Leo-Intake-Renter
      - Leo-Intake-Buyer

□ 4.4 End-to-end testing (4 hr)
      - Multiple test calls
      - Verify state transitions
      - Fix timing issues

TEST: Complete intake call with real user

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                        PHASE 5: BATCH PROCESSING (Week 5)                               ║
║                        Can test: Recommendations after call                             ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

□ 5.1 Fit scoring v2 (3 hr)
      - src/lib/recommender/fitScoringV2.ts
      - Use weights + thresholds
      - Handle N/A dimensions

□ 5.2 Batch processing pipeline (6 hr)
      - /api/batch/process-users
      - Pre-WPA filter → WPA → Post-WPA score → Explain
      - Process all active users

□ 5.3 Explanation generation (2 hr)
      - Flash-Lite call per listing
      - Personalized "why this matches"

□ 5.4 Email templates (3 hr)
      - new-recommendations.tsx
      - stock-insufficient.tsx
      - listing-alert.tsx

□ 5.5 Send recommendations route (2 hr)
      - /api/batch/send-recommendations
      - Resend integration

TEST: Run batch for test users, verify emails

╔════════════════════════════════════════════════════════════════════════════════════════╗
║                        PHASE 6: MONITORING & FOLLOW-UP (Week 6)                         ║
║                        Can test: Full production loop                                   ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

□ 6.1 Cron jobs (4 hr)
      - Day 3 stock check
      - Weekly stock check
      - Trigger follow-up email if needed

□ 6.2 Follow-up call agent (3 hr)
      - Leo-Followup.json
      - Permutation conversation flow
      - Zone recalculation

□ 6.3 Permutation engine (3 hr)
      - src/lib/recommender/permutations.ts
      - Try permutations in order
      - Return best result

□ 6.4 Production hardening (4 hr)
      - Error handling
      - Logging
      - Monitoring dashboard

TEST: Full user lifecycle over 1 week
```

---

### Part 11: External Service Dependencies

| Service | Purpose | API Key Env Var | Free Tier | Cost |
|---------|---------|-----------------|-----------|------|
| **Geoapify** | Isochrone generation | `GEOAPIFY_API_KEY` | 3,000 req/day | $49/mo for 100k |
| **ScrapingDog** | POI searches (Google) | `SCRAPINGDOG_API_KEY` | 1,000 req/mo | $30/mo for 50k |
| **Mapbox** | Map display | `NEXT_PUBLIC_MAPBOX_TOKEN` | 50k loads/mo | $5/1k after |
| **Pusher** | WebSocket (or Supabase Realtime) | `PUSHER_*` | 200k msg/day | $49/mo |
| **Resend** | Email delivery | `RESEND_API_KEY` | 3,000/mo | $20/mo for 50k |
| **ElevenLabs** | Voice AI agents | `ELEVENLABS_API_KEY` | 10k chars/mo | Usage-based |
| **Gemini 2.5 Flash-Lite** | WPA, explanations | `GOOGLE_API_KEY` | $300 credits | **~$0.003/WPA** |

**New Environment Variables Needed:**

```bash
# .env.local additions
GEOAPIFY_API_KEY=xxx
SCRAPINGDOG_API_KEY=xxx
NEXT_PUBLIC_MAPBOX_TOKEN=xxx

# If using Pusher for WebSocket
PUSHER_APP_ID=xxx
PUSHER_KEY=xxx
PUSHER_SECRET=xxx
PUSHER_CLUSTER=xxx

# Email
RESEND_API_KEY=xxx
```

---

### Part 12: Cost Per User (Intake Call)

| Step | Service | Cost |
|------|---------|------|
| Isochrone generation | Geoapify | ~$0.001 |
| POI searches (5 avg) | ScrapingDog | ~$0.003 |
| Vibe-check WPA (3 listings, 30 photos each) | **Gemini 2.5 Flash-Lite** | ~$0.009 |
| Shape calculation | Our server | ~$0.00 |
| Heatmap explanation | Gemini Flash-Lite | ~$0.001 |
| **INTAKE CALL TOTAL (AI)** | | **~$0.02** |
| ElevenLabs (10 min) | ElevenLabs Turbo | ~$0.80 |
| **INTAKE CALL TOTAL (ALL)** | | **~$0.82** |

| Step | Service | Cost |
|------|---------|------|
| Batch WPA (10 listings, 30 photos each) | **Gemini 2.5 Flash-Lite** | ~$0.03 |
| Explanation (10 listings) | Flash-Lite | ~$0.01 |
| Email delivery | Resend | ~$0.001 |
| **BATCH PROCESSING TOTAL** | | **~$0.04** |

**Monthly cost per active user:** ~$1.33 (onboarding) + ~$0.57/week × 4 = **~$3.60/month**

> ⚠️ **CRITICAL**: WPA MUST use Gemini 2.5 Flash-Lite, NOT Flash or Pro.
> - Flash-Lite: $0.003/WPA ✅
> - Flash: $0.03/WPA (10x more) ❌
> - Pro: $0.90/WPA (300x more) ❌

---

### Part 12.1: CRITICAL - No Listing Photo Storage ⚠️

**RULE**: We do NOT store listing photos. We only store URLs.

**Why:**
- 90,000+ listings × 30 photos × 500KB avg = **1.35 TB**
- S3 storage: ~$30/month + transfer costs
- We'd be paying to store photos we don't own
- URLs work fine - we fetch at WPA time, process, discard

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  LISTING PHOTOS: URL-ONLY ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DynamoDB (leo-listings)                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  photos: ["https://img.idealista.com/xyz.jpg", ...]          │   │
│  │  ^^^ URLS ONLY - No base64, no S3 copies                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  WPA Process (on-demand):                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. Fetch URLs from DynamoDB                                 │   │
│  │  2. Stream images to Gemini (no local storage)               │   │
│  │  3. Get WPA result                                           │   │
│  │  4. Cache WPA in DynamoDB (NOT the images)                   │   │
│  │  5. Discard image buffers immediately                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ❌ DO NOT:                                                         │
│  - Store photos in S3                                              │
│  - Store base64 in DynamoDB                                        │
│  - Cache image files locally                                        │
│  - Create "photo archive" buckets                                  │
│                                                                     │
│  ✅ DO:                                                             │
│  - Store photo URLs only                                           │
│  - Fetch → Process → Discard                                       │
│  - Cache WPA RESULTS (text/JSON) in DynamoDB                       │
│  - If source URL dies, listing is stale (re-scrape or mark sold)  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**AWS Safeguards:**

1. **S3 Bucket Policy** - Deny any object with image MIME types:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyImageUploads",
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::puedo-casa-*/*",
    "Condition": {
      "StringLike": {
        "s3:ContentType": ["image/*"]
      }
    }
  }]
}
```

2. **DynamoDB Base64 Blocker** - Validation middleware rejects base64 images:
```typescript
// src/lib/dynamodb/validators.ts
const BASE64_IMAGE_PATTERNS = [
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,/,
  /^\/9j\//,           // JPEG magic bytes in base64
  /^iVBORw0KGgo/,      // PNG magic bytes in base64
  /^R0lGOD/,           // GIF magic bytes in base64
  /^UklGR/,            // WEBP magic bytes in base64
];

export function rejectBase64Images(item: Record<string, unknown>): void {
  const checkValue = (value: unknown, path: string): void => {
    if (typeof value === 'string' && value.length > 1000) {
      for (const pattern of BASE64_IMAGE_PATTERNS) {
        if (pattern.test(value)) {
          throw new Error(
            `BLOCKED: Base64 image detected at ${path}. ` +
            `Store URLs only, not image data. Length: ${value.length}`
          );
        }
      }
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => checkValue(v, `${path}[${i}]`));
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => checkValue(v, `${path}.${k}`));
    }
  };
  
  Object.entries(item).forEach(([key, value]) => checkValue(value, key));
}

// Usage in DynamoDB client wrapper:
export async function putItem(tableName: string, item: Record<string, unknown>) {
  rejectBase64Images(item);  // Throws if base64 image detected
  return dynamoClient.send(new PutItemCommand({ TableName: tableName, Item: marshall(item) }));
}
```

3. **DynamoDB Item Size Alert** - Alert if item > 100KB (indicates base64 creep):
```bash
# CloudWatch alarm on ItemSize metric
aws cloudwatch put-metric-alarm \
  --alarm-name "leo-listings-item-too-large" \
  --metric-name "ConsumedWriteCapacityUnits" \
  --namespace "AWS/DynamoDB" \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

4. **ESLint Rule** - Block suspicious patterns in codebase:
```javascript
// .eslintrc.js - add to rules:
{
  'no-restricted-syntax': ['error', 
    {
      selector: 'Literal[value=/^data:image/]',
      message: 'Do not embed base64 images. Use URLs only.'
    },
    {
      selector: 'CallExpression[callee.property.name="toString"][arguments.0.value="base64"]',
      message: 'Do not convert buffers to base64 for storage.'
    }
  ]
}
```

5. **Code Review Rule** - Any PR touching photo handling must confirm:
   - [ ] No `fs.writeFile` for images
   - [ ] No `s3.putObject` for images  
   - [ ] No `Buffer.from(base64)` storage
   - [ ] No `toString('base64')` for images
   - [ ] WPA uses streaming fetch → Gemini → discard
   - [ ] All `photos` fields contain only URLs (https://)

**Exception: User-Uploaded Photos**

User note photos (their own photos of visits, etc.) ARE stored in Supabase Storage.
This is different from listing photos - users own these.

---

### Part 13: Error Handling & Fallbacks

| Failure | Fallback | User Experience |
|---------|----------|-----------------|
| Geoapify timeout | Use cached isochrone OR skip | "I'll calculate your zones after the call" |
| ScrapingDog timeout | Skip POI, note in profile | "I couldn't find [POI], I'll search later" |
| WPA timeout (vibe-check) | Skip vibe-check | "Let me show you the map - we'll calibrate later" |
| Heatmap calculation error | Show shape-only outline | "Here's your commute area, I'll add more detail" |
| WebSocket disconnect | Polling fallback | Slightly delayed updates |
| Batch WPA failure | Retry 3x, then skip listing | User doesn't see that listing |
| Email delivery failure | Retry queue | Delayed notification |

**Critical principle:** Never block the call. Always have a graceful degradation.

---

### Part 14: ElevenLabs Agent Configs & Tools

**Agent config files created:**

| File | Purpose |
|------|---------|
| `agent_configs/Leo-Intake-Renter-v3.json` | Main intake agent for renters with full state machine |
| `agent_configs/Leo-Intake-Buyer-v3.json` | Main intake agent for buyers with full state machine |
| `agent_configs/Leo-Followup-v3.json` | Follow-up agent for permutation conversations |

**Tool definition files created:**

| File | Purpose |
|------|---------|
| `agent_configs/tools/trigger_early_wpa.json` | Fire background WPA on 3 listings |
| `agent_configs/tools/show_vibe_check.json` | Show property for calibration |
| `agent_configs/tools/record_calibration.json` | Record user reaction vs WPA |
| `agent_configs/tools/calculate_heatmap.json` | Calculate 3-layer heatmap |
| `agent_configs/tools/show_map.json` | Display/update live map |
| `agent_configs/tools/generate_isochrone.json` | Generate commute isochrone |
| `agent_configs/tools/apply_permutation.json` | Apply search permutation |

**Key Agent Prompt Features:**

1. **State Machine** embedded in system prompt:
   - ESTADO 1: EXTRACTING
   - ESTADO 2: TRIGGER_WPA
   - ESTADO 3: DEEPER_QUESTIONS
   - ESTADO 4: VIBE_CHECK
   - ESTADO 5: FINALIZE_HEATMAP
   - ESTADO 6: WRAP_UP

2. **Tool Orchestration**:
   - Tools called at specific states
   - `force_pre_tool_speech: true` for tools that need setup speech
   - `disable_interruptions: true` for tools that push UI

3. **Speech Formatting**:
   - Short sentences (2-3 max per turn)
   - Audio tags: `[laughs]`, `[sighs]`
   - Natural pauses with "..."
   - Muletillas: "oye", "mira", "a ver"

4. **Dynamic Variables**:
   - `{{user_id}}` - User identifier
   - `{{profile_type}}` - "renter" or "buyer"
   - `{{WEBHOOK_BASE_URL}}` - API base URL
   - `{{API_KEY}}` - Authentication

**To Deploy:**

1. Update webhook URLs in agent configs:
   ```bash
   # Replace {{WEBHOOK_BASE_URL}} with actual URL
   sed -i 's/{{WEBHOOK_BASE_URL}}/https://api.puedocasa.com/g' agent_configs/*.json
   ```

2. Push to ElevenLabs:
   ```bash
   elevenlabs agents push agent_configs/Leo-Intake-Renter-v3.json
   elevenlabs agents push agent_configs/Leo-Intake-Buyer-v3.json
   elevenlabs agents push agent_configs/Leo-Followup-v3.json
   ```

3. Register tools in ElevenLabs dashboard (or via API)

---

### Part 15: Performance Requirements

| Operation | Max Time | Notes |
|-----------|----------|-------|
| Isochrone generation | 2 sec | Cache aggressively |
| POI search (single) | 3 sec | Fire in parallel |
| WPA quick (single listing) | 30 sec | Background, don't block |
| Heatmap calculation | 3 sec | Pure math, no AI |
| Heatmap explanation | 2 sec | Flash-Lite is fast |
| WebSocket push | 500 ms | Critical for UX |
| Map render | 1 sec | Pre-load tiles |

**End-of-call flow must complete in <10 sec:**
- Leo says "let me calculate..." (0 sec)
- Map updates throughout call (progressive)
- Final heatmap calculation (3 sec)
- Summary generation (2 sec)  
- WebSocket push (0.5 sec)
- Map render (1 sec)
- Leo explains (immediate)
- **Total: ~7 sec** ✅

---

### Part 16: Effort Estimate (Revised)

| Phase | Area | Hours |
|-------|------|-------|
| **Phase 1** | Foundation | 11 |
| | Supabase migration | 2 |
| | Update update_profile | 2 |
| | Shape generation route | 3 |
| | Heatmap calculation | 4 |
| **Phase 2** | During-Call Features | 14 |
| | WPA Quick | 4 |
| | Trigger Early WPA route | 2 |
| | POI Search route | 2 |
| | Vibe-check routes | 3 |
| | WebSocket setup | 3 |
| **Phase 3** | UI Components | 25 |
| | LiveMap + useLiveMapUpdates | 5 |
| | HeatmapLayer + NeighborhoodLayer | 3 |
| | VibeCheckOverlay | 3 |
| | Mobile checkpoint components | 3 |
| | WebSocket integration | 2 |
| | Profile zone display | 2 |
| | Call Card Overlays | 4 |
| | Chat Card Messages | 2 |
| | Animations | 2 |
| **Phase 4** | ElevenLabs Agent | 12 |
| | Update prompts | 4 |
| | Tool definitions | 3 |
| | Push agents | 1 |
| | E2E testing | 4 |
| **Phase 5** | Batch Processing | 16 |
| | Fit scoring v2 | 3 |
| | Batch pipeline | 6 |
| | Explanation generation | 2 |
| | Email templates | 3 |
| | Send recommendations | 2 |
| **Phase 6** | Monitoring & Follow-up | 14 |
| | Cron jobs | 4 |
| | Follow-up agent | 3 |
| | Permutation engine | 3 |
| | Production hardening | 4 |
| **TOTAL** | | **~87 hr** |

**Timeline:** 6-7 weeks at ~13 hr/week, or 2.5 weeks full-time

---

### Part 17: UI Card Specifications (Call & Chat)

Cards appear differently depending on context:
- **Voice Call**: Centered overlays (orb shrinks/moves)
- **Chat Mode**: Inline message cards (like WhatsApp)
- **Profile Page**: Static display (always visible)

---

#### 17.1 Card Types

| Card Type | Purpose | When Shown |
|-----------|---------|------------|
| `LiveMap` + layers | Live heatmap building during call | Continuous throughout call |
| `VibeCheckCard` | Property photos for calibration | During vibe-check (3x) |
| `LiveMap` + layers | Heatmap with score gradient | Progressive during call |

---

#### 17.2 Voice Mode: Centered Overlays

In voice mode, cards appear as **centered overlays** that partially cover the orb:

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                    SPEAK WITH LEO                                         ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ● Leo                                                              [Chat] Escribir      ║
║                                                                                          ║
║                           ╭─────────────────────────╮                                    ║
║                          ╱    (Orb shrinks to corner) ╲                                  ║
║                          ╲                            ╱                                  ║
║                           ╰─────────────────────────╯                                    ║
║                                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                                    │  ║
║  │  ╔════════════════════════════════════════════════════════════════════════════╗   │  ║
║  │  ║                     🏠 VIBE CHECK 1/3                                      ║   │  ║
║  │  ╠════════════════════════════════════════════════════════════════════════════╣   │  ║
║  │  ║                                                                            ║   │  ║
║  │  ║  ┌──────────────────────────────────────────────────────────────────────┐  ║   │  ║
║  │  ║  │                                                                      │  ║   │  ║
║  │  ║  │                      [PROPERTY PHOTOS CAROUSEL]                      │  ║   │  ║
║  │  ║  │                                                                      │  ║   │  ║
║  │  ║  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │  ║   │  ║
║  │  ║  │   │ Living  │  │ Kitchen │  │ Bedroom │  │ Terrace │               │  ║   │  ║
║  │  ║  │   │   📷    │  │   📷    │  │   📷    │  │   📷    │               │  ║   │  ║
║  │  ║  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘               │  ║   │  ║
║  │  ║  │                                                                      │  ║   │  ║
║  │  ║  │              [◄]  1 / 12  [►]                                       │  ║   │  ║
║  │  ║  │                                                                      │  ║   │  ║
║  │  ║  └──────────────────────────────────────────────────────────────────────┘  ║   │  ║
║  │  ║                                                                            ║   │  ║
║  │  ║  💬 "No te preocupes por la ubicación ni el precio.                       ║   │  ║
║  │  ║      ¿Qué te parece este piso?"                                           ║   │  ║
║  │  ║                                                                            ║   │  ║
║  │  ╚════════════════════════════════════════════════════════════════════════════╝   │  ║
║  │                                                                                    │  ║
║  └────────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                         [Finalizar llamada]                                        │  ║
║  └────────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

**Zone Map Overlay (Voice Mode):**

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                    SPEAK WITH LEO                                         ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ● Leo                                                              [Chat] Escribir      ║
║                                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                                    │  ║
║  │  ╔════════════════════════════════════════════════════════════════════════════╗   │  ║
║  │  ║                        🗺️ TUS ZONAS                                        ║   │  ║
║  │  ╠════════════════════════════════════════════════════════════════════════════╣   │  ║
║  │  ║                                                                            ║   │  ║
║  │  ║  ┌──────────────────────────────────────────────────────────────────────┐  ║   │  ║
║  │  ║  │                         [MAPBOX MAP]                                 │  ║   │  ║
║  │  ║  │                                                                      │  ║   │  ║
║  │  ║  │              ╭───────────────╮                                       │  ║   │  ║
║  │  ║  │            ╱   🟢 GREEN      ╲                                       │  ║   │  ║
║  │  ║  │           │   (Sweet spot)    │    📍 Work                           │  ║   │  ║
║  │  ║  │            ╲                  ╱    🧘 Yoga                            │  ║   │  ║
║  │  ║  │      ╭──────────────────────────────╮                                │  ║   │  ║
║  │  ║  │    ╱      🟡 YELLOW (Considerar)     ╲                               │  ║   │  ║
║  │  ║  │    ╲                                 ╱                               │  ║   │  ║
║  │  ║  │   ╭────────────────────────────────────╮                             │  ║   │  ║
║  │  ║  │  ╱   🟠 ORANGE (Sorpresa)              ╲                             │  ║   │  ║
║  │  ║  │  ╲                                      ╱                            │  ║   │  ║
║  │  ║  │                                                                      │  ║   │  ║
║  │  ║  └──────────────────────────────────────────────────────────────────────┘  ║   │  ║
║  │  ║                                                                            ║   │  ║
║  │  ║  ┌────────────────────────────────────────────────────────────────────┐   ║   │  ║
║  │  ║  │ 🟢 Sweet spot - 12 pisos                                          │   ║   │  ║
║  │  ║  │    "Gràcia y Sant Antoni, cerca de yoga y tu trabajo"             │   ║   │  ║
║  │  ║  │ 🟡 Worth considering - 34 pisos                                   │   ║   │  ║
║  │  ║  │    "Eixample, buen transporte pero menos trendy"                  │   ║   │  ║
║  │  ║  │ 🟠 Might surprise you - 18 pisos                                  │   ║   │  ║
║  │  ║  │    "Horta, auténtico y con comunidad real"                        │   ║   │  ║
║  │  ║  └────────────────────────────────────────────────────────────────────┘   ║   │  ║
║  │  ║                                                                            ║   │  ║
║  │  ╚════════════════════════════════════════════════════════════════════════════╝   │  ║
║  │                                                                                    │  ║
║  └────────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

#### 17.3 Chat Mode: Inline Message Cards

In chat mode, cards appear as **inline message bubbles** from Leo:

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                    CHAT WITH LEO                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║  ● Chat con Leo                                                       [📞] Voz           ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────────────┐ ║
║  │                              [SCROLLABLE MESSAGE AREA]                              │ ║
║  │                                                                                     │ ║
║  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │ ║
║  │  │ 🤖 Leo:                                                                      │  │ ║
║  │  │ Te voy a enseñar 3 pisos - ignora la ubicación y el precio.                 │  │ ║
║  │  └──────────────────────────────────────────────────────────────────────────────┘  │ ║
║  │                                                                                     │ ║
║  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │ ║
║  │  │ 🤖 Leo:                                                                      │  │ ║
║  │  │ ╔══════════════════════════════════════════════════════════════════════╗     │  │ ║
║  │  │ ║  🏠 VIBE CHECK 1/3                                                   ║     │  │ ║
║  │  │ ╠══════════════════════════════════════════════════════════════════════╣     │  │ ║
║  │  │ ║   ┌─────────────────────────────────────────────────────────────┐   ║     │  │ ║
║  │  │ ║   │              [PROPERTY PHOTO CAROUSEL]                      │   ║     │  │ ║
║  │  │ ║   │   ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐               │   ║     │  │ ║
║  │  │ ║   │   │  📷   │  │  📷   │  │  📷   │  │  📷   │               │   ║     │  │ ║
║  │  │ ║   │   └───────┘  └───────┘  └───────┘  └───────┘               │   ║     │  │ ║
║  │  │ ║   └─────────────────────────────────────────────────────────────┘   ║     │  │ ║
║  │  │ ║   "¿Qué te parece este?"                                            ║     │  │ ║
║  │  │ ╚══════════════════════════════════════════════════════════════════════╝     │  │ ║
║  │  └──────────────────────────────────────────────────────────────────────────────┘  │ ║
║  │                                                                                     │ ║
║  │                                                        ┌────────────────────────┐  │ ║
║  │                                                        │ 👤 Tú:                 │  │ ║
║  │                                                        │ La luz mola pero la   │  │ ║
║  │                                                        │ cocina es pequeña     │  │ ║
║  │                                                        └────────────────────────┘  │ ║
║  │                                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────────────────┐ ║
║  │  [         Escribe aquí...                                            ]  [Enviar]  │ ║
║  └─────────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

**Zone Map Card (Chat Mode):**

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                    CHAT WITH LEO                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║  │                                                                                     │ ║
║  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │ ║
║  │  │ 🤖 Leo:                                                                      │  │ ║
║  │  │ ╔══════════════════════════════════════════════════════════════════════╗     │  │ ║
║  │  │ ║  🗺️ TUS ZONAS PERSONALIZADAS                                        ║     │  │ ║
║  │  │ ╠══════════════════════════════════════════════════════════════════════╣     │  │ ║
║  │  │ ║   ┌─────────────────────────────────────────────────────────────┐   ║     │  │ ║
║  │  │ ║   │                    [INTERACTIVE MAP]                        │   ║     │  │ ║
║  │  │ ║   │        ╭────────╮                                           │   ║     │  │ ║
║  │  │ ║   │      ╱ 🟢 GREEN ╲   📍                                      │   ║     │  │ ║
║  │  │ ║   │   ╭─────────────────────╮                                   │   ║     │  │ ║
║  │  │ ║   │  ╱    🟡 YELLOW         ╲                                   │   ║     │  │ ║
║  │  │ ║   │   ╰─────────────────────╯                                   │   ║     │  │ ║
║  │  │ ║   └─────────────────────────────────────────────────────────────┘   ║     │  │ ║
║  │  │ ║   🟢 Sweet spot (12)  │  🟡 Considerar (34)  │  🟠 Sorpresa (18)    ║     │  │ ║
║  │  │ ║            [Ver en pantalla completa →]                             ║     │  │ ║
║  │  │ ╚══════════════════════════════════════════════════════════════════════╝     │  │ ║
║  │  └──────────────────────────────────────────────────────────────────────────────┘  │ ║
║  │                                                                                     │ ║
║  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │ ║
║  │  │ 🤖 Leo:                                                                      │  │ ║
║  │  │ La verde es tu sweet spot. ¡La naranja te podría sorprender!                │  │ ║
║  │  │ Esto lo puedes ver siempre en tu perfil. Te aviso cuando salgan pisos.      │  │ ║
║  │  └──────────────────────────────────────────────────────────────────────────────┘  │ ║
║  └─────────────────────────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

#### 17.4 Component Architecture

```
src/components/
├── map/                            # Map components (single Mapbox instance)
│   ├── LiveMap.tsx                 # Main Mapbox instance (loads once)
│   ├── ShapeLayer.tsx              # Commute intersection outline
│   ├── NeighborhoodLayer.tsx       # Solid fill polygons per neighborhood
│   ├── HeatmapLayer.tsx            # Gradient circles from score data
│   ├── POIMarkers.tsx              # POI icons on map
│   ├── HeatmapLegend.tsx           # Score gradient explanation
│   └── useLiveMapUpdates.ts        # Layer update functions
│
├── call/                           # Voice call components
│   ├── SplitScreenCall.tsx         # Desktop 50/50 layout (call + map)
│   ├── VibeCheckOverlay.tsx        # Property photos during calibration
│   └── FinalMapSummary.tsx         # Wrap-up explanation text
│
├── mobile-checkpoints/             # Mobile overlay components
│   ├── MapToast.tsx                # Quick city/anchor updates
│   ├── MapBottomSheet.tsx          # Sweet spot reveal
│   └── MapFullOverlay.tsx          # Vibe-check, final map
│
├── chat/                           # Chat components  
│   ├── ChatMessage.tsx             # Base message bubble
│   └── VibeCheckMessage.tsx        # Vibe-check as inline card
│
└── shared/                         # Shared between modes
    └── VibeCheckContent.tsx        # Photo carousel + WPA bars (reusable)
```

**Key Principle:** Map is a SINGLE INSTANCE. Only layers are added/updated.

---

#### 17.5 Component Specifications

**LiveMap.tsx** (single instance, never reloads)

```typescript
interface LiveMapProps {
  initialCity: 'barcelona' | 'madrid' | 'valencia' | 'sevilla';
  onMapReady: (map: mapboxgl.Map) => void;
}

// Features:
// - Mapbox GL JS instance
// - Empty sources for: shape, neighborhoods, heatmap, pois
// - Never unmounts during call
// - Layers updated via setData() not reload
```

**useLiveMapUpdates.ts** (layer control)

```typescript
interface UseLiveMapUpdates {
  zoomToCity: (city: string) => void;
  addIsochrone: (anchorId: string, geojson: GeoJSON.Polygon) => void;
  setShape: (geojson: GeoJSON.Polygon) => void;
  setNeighborhoods: (geojson: GeoJSON.FeatureCollection) => void;
  updateHeatmap: (points: HeatmapPoint[]) => void;
  addPOIs: (pois: POI[]) => void;
}

// Called by: WebSocket event handlers
// No map reloads - pure layer updates
```

**VibeCheckContent.tsx** (shared)

```typescript
interface VibeCheckContentProps {
  vibeCheckNumber: 1 | 2 | 3;
  photos: string[];
  wpaScores: Record<string, number>;
  onReaction: (reaction: 'love' | 'meh' | 'nope') => void;
}

// Features:
// - Photo carousel with swipe
// - WPA dimension bars (light, space, kitchen, etc.)
// - 3-button reaction UI
// - Temporarily replaces map during calibration
```

**HeatmapLayer.tsx** (gradient display)

```typescript
interface HeatmapLayerProps {
  points: Array<{ lng: number; lat: number; score: number }>;
}

// Features:
// - Circle layer with gradient fill based on score
// - Updates incrementally as POIs are scored
// - Smooth transitions
```

---

#### 17.6 WebSocket Events

Map layers and overlays are triggered by WebSocket events from the backend:

| Event | Payload | Action |
|-------|---------|--------|
| `ZOOM_TO_CITY` | `{ city, bounds }` | Zoom map to city |
| `ADD_ISOCHRONE` | `{ anchorId, geojson }` | Add isochrone layer |
| `SET_SHAPE` | `{ geojson }` | Set commute intersection shape |
| `SET_NEIGHBORHOODS` | `{ geojson }` | Color neighborhoods by score |
| `ADD_POIS` | `{ pois }` | Add POI markers |
| `UPDATE_HEATMAP` | `{ points }` | Update heatmap gradient |
| `VIBE_CHECK_START` | `{ vibeCheckNumber, photos, wpaScores }` | Show VibeCheckOverlay |
| `VIBE_CHECK_END` | `{}` | Return to map view |
| `NO_OVERLAP` | `{ isolatedAnchors, suggestions }` | Show overlap issue modal |

**WebSocket Hook:**

```typescript
// src/hooks/useLiveCallUpdates.ts

interface UseLiveCallUpdatesReturn {
  // Map layer functions
  mapUpdates: UseLiveMapUpdates;
  
  // Overlay state
  overlayMode: 'none' | 'vibe-check' | 'no-overlap' | 'final-summary';
  vibeCheckData: VibeCheckData | null;
  noOverlapData: NoOverlapData | null;
  
  // Mobile-specific
  pendingCheckpoint: MobileCheckpoint | null;
  dismissCheckpoint: () => void;
}

export function useLiveCallUpdates(userId: string, mapRef: RefObject<mapboxgl.Map>): UseLiveCallUpdatesReturn {
  // Subscribe to Pusher/Supabase Realtime
  // Update map layers directly (no reload)
  // Manage overlay state
}
```

---

#### 17.7 Integration with SpeakWithLeoContent

```typescript
// In SpeakWithLeoContent.tsx - Desktop Split-Screen

import { useLiveCallUpdates } from '@/hooks/useLiveCallUpdates';
import { LiveMap } from '@/components/map/LiveMap';
import { VibeCheckOverlay } from '@/components/call/VibeCheckOverlay';
import { useMapDisplayMode } from '@/hooks/useMapDisplayMode';

export function SpeakWithLeoContent({ userId, ... }: Props) {
  const mapRef = useRef<mapboxgl.Map>(null);
  const { mapUpdates, overlayMode, vibeCheckData } = useLiveCallUpdates(userId, mapRef);
  const { isDesktop, pendingCheckpoint, dismissCheckpoint } = useMapDisplayMode();
  
  // Desktop: 50/50 split with live map
  if (isDesktop) {
    return (
      <div className="flex h-full">
        {/* Left: Call UI */}
        <div className="w-1/2 ...">
          <AmorphousOrb ... />
        </div>
        
        {/* Right: Live Map (or overlay) */}
        <div className="w-1/2 relative">
          {overlayMode === 'vibe-check' ? (
            <VibeCheckOverlay data={vibeCheckData} />
          ) : (
            <LiveMap ref={mapRef} initialCity="barcelona" />
          )}
        </div>
      </div>
    );
  }
  
  // Mobile: Full-width with checkpoint overlays
  return (
    <div className="h-full">
      <AmorphousOrb ... />
      
      {/* Checkpoint overlays (bottom sheet, full screen) */}
      {pendingCheckpoint && (
        <MobileCheckpointOverlay 
          type={pendingCheckpoint.type}
          data={pendingCheckpoint.data}
          onDismiss={dismissCheckpoint}
        />
      )}
    </div>
  );
}
```

---

#### 17.8 Animation Specifications

**Zone Loading Animation:**

```css
/* Blob morph animation */
@keyframes blobMorph {
  0%, 100% { border-radius: 40% 60% 70% 30%; }
  50% { border-radius: 60% 40% 30% 70%; }
}

@keyframes blobPulse {
  0%, 100% { transform: scale(0.8); opacity: 0.3; }
  50% { transform: scale(1.2); opacity: 0.6; }
}

/* Stagger blobs by 0.5s each */
.blob-green { animation-delay: 0s; }
.blob-yellow { animation-delay: 0.5s; }
.blob-orange { animation-delay: 1s; }
```

**Zone Reveal Animation:**

```typescript
// Staggered reveal timings
const REVEAL_TIMINGS = {
  GREEN: 500,      // Show GREEN at 0.5s
  YELLOW: 1000,    // Show YELLOW at 1.0s
  ORANGE: 1500,    // Show ORANGE at 1.5s
  POIS: 2000,      // Drop in POIs at 2.0s
  LEGEND: 2500,    // Show legend at 2.5s
};

// Total reveal time: ~3s
```

**Vibe Check Transition:**

```typescript
// Card slides up from bottom in voice mode
// Card fades in as message in chat mode
const VIBE_CHECK_ANIMATION = {
  voice: { initial: { y: '100%' }, animate: { y: 0 }, transition: { type: 'spring' } },
  chat: { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } },
};
```

---

#### 17.9 Responsive Design

| Breakpoint | Voice Mode Card | Chat Mode Card |
|------------|-----------------|----------------|
| Mobile (<640px) | Full screen overlay | Full width message |
| Tablet (640-1024px) | 80% width centered | 85% width message |
| Desktop (>1024px) | 60% width centered | 70% width message |

---

#### 17.10 Files to Create

| File | Purpose | Priority |
|------|---------|----------|
| `src/hooks/useCallCards.ts` | WebSocket subscription, card state | P0 |
| `src/components/shared/VibeCheckContent.tsx` | Photo carousel + prompt | P0 |
| `src/components/map/LiveMap.tsx` | Main map instance | P0 |
| `src/components/map/HeatmapLayer.tsx` | Score gradient | P0 |
| `src/components/map/NeighborhoodLayer.tsx` | Hood multiplier colors | P0 |
| `src/components/call/CallCardOverlay.tsx` | Voice mode wrapper | P0 |
| `src/components/chat/ChatCard.tsx` | Chat mode wrapper | P0 |
| `src/components/call/VibeCheckOverlay.tsx` | Combines wrapper + content | P0 |
| `src/components/call/SplitScreenCall.tsx` | Desktop 50/50 layout | P0 |
| **`src/lib/dynamodb/validators.ts`** | **Base64 image blocker for DynamoDB** | **P0 (cost control)** |

---

#### 17.11 Effort Estimate (UI Cards)

| Component | Hours |
|-----------|-------|
| useCallCards hook | 2 |
| VibeCheckContent | 3 |
| LiveMap + layers | 5 |
| useLiveMapUpdates | 2 |
| CallCardOverlay | 2 |
| ChatCard wrapper | 1 |
| WebSocket integration | 2 |
| Animations | 2 |
| Testing | 2 |
| **TOTAL** | **20 hr** |

*Note: This is included in Phase 3 of the main estimate.*

---

### Previous Design (Archived) + Reference Material

<details>
<summary>Click to expand old continuous extraction design and reference material</summary>

**⚠️ NOTE**: The sections below are from the previous design. Parts 1-10 above are the **authoritative source**. This old content remains for reference only.

Key changes from old to new:
- **OLD**: Map updates LIVE during call → **NEW**: Map shows ONCE at end
- **OLD**: Fixed timing (minute 5, etc.) → **NEW**: Progress-based triggers
- **OLD**: No vibe-check → **NEW**: Vibe-check to calibrate thresholds
- **OLD**: "Property reveal" at end of call → **NEW**: Batch processing 3x daily

</details>

---

### (ARCHIVED) Tool Schema for Continuous Extraction

```typescript
// update_profile tool - called incrementally after each extraction
{
  "name": "update_profile",
  "description": "Update user profile with newly extracted information",
  "parameters": {
    // Hard constraints (extracted from explicit statements)
    "constraints": {
      "maxBudget": 400000,
      "minBedrooms": 2,
      "maxCommuteMinutes": 30
    },
    
    // Household facts
    "household": {
      "workSituation": "office",  // or "remote", "hybrid"
      "pets": [{ "type": "dog", "name": "Max" }],
      "children": []
    },
    
    // 20 Dimensions with confidence tracking (updated incrementally)
    "dimensions": {
      "pet_friendly":   { "score": 95, "confidence": "high" },
      "fitness":        { "score": 90, "confidence": "high" },
      "quietness":      { "score": null, "confidence": "unknown" },  // ← PROBE THIS
      "nature_access":  { "score": null, "confidence": "unknown" },  // ← PROBE THIS
      "nightlife":      { "score": 30, "confidence": "medium" },     // Inverse of quiet
      "transport":      { "score": 80, "confidence": "high" },       // Has work anchor
      // ... other dimensions
    },
    
    // POI searches for archipelago mapping (noted as user mentions them)
    "poi_searches": [
      { "query": "CrossFit gyms", "importance": "high", "max_travel_minutes": 15 },
      { "query": "dog parks", "importance": "medium", "max_travel_minutes": 10 },
      { "query": "Nomad Coffee Sant Antoni", "importance": "low", "max_travel_minutes": 20 }
    ],
    
    // Anchors for isochrone generation
    "anchors": [
      { "type": "work", "address": "Google Madrid", "max_minutes": 30, "mode": "transit" },
      { "type": "gym", "query": "CrossFit Madrid", "max_minutes": 15, "mode": "walking" }
    ]
  }
}
```

---

### Show Live Map During Call (Progressive Building)

> **✅ CURRENT**: Map builds progressively throughout the call - isochrones, shape, neighborhoods, heatmap.
> See Part 6 for full details.

As soon as Leo has ONE anchor, show the map:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOW MAP TOOL (Called when anchor is extracted)                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ TRIGGER: User says "I work at Google's office in Madrid"                                │
│                                                                                         │
│ 1. Leo extracts anchor: { type: "work", address: "Google Madrid", max_minutes: 30 }     │
│                                                                                         │
│ 2. Leo calls show_map tool                                                              │
│    WHO: Our API (/api/agents/show-map)                                                  │
│    WHAT: Generates isochrone + pushes to UI                                             │
│    HOW:                                                                                 │
│      a) Geocode "Google Madrid" → lat/lng (Nominatim, FREE)                             │
│      b) Generate isochrone (Geoapify, FREE)                                             │
│      c) Push to UI via WebSocket/event                                                  │
│                                                                                         │
│ 3. UI shows map with isochrone overlay                                                  │
│    ┌─────────────────────────────────────┐                                              │
│    │          [MAP]                      │                                              │
│    │     ╭───────────────╮               │                                              │
│    │    ╱  SWEET SPOT 85%  ╲             │                                              │
│    │   │  (30 min commute) │             │                                              │
│    │    ╲    📍 Work      ╱              │                                              │
│    │     ╰───────────────╯               │                                              │
│    │                                     │                                              │
│    │  "Your 30-minute commute zone"      │                                              │
│    └─────────────────────────────────────┘                                              │
│                                                                                         │
│ 4. Leo says verbally:                                                                   │
│    "I just mapped out your commute area - you can see it on screen now.                 │
│     Everything inside is within 30 minutes of your office."                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### (ARCHIVED) When Multiple Anchors: Sweet Spot Intersection

> **Still valid concept** - but now called "zones" and shown once at end of call.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ SWEET SPOT CALCULATION (When 2+ anchors exist)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ User has said:                                                                          │
│   "I work at Google Madrid" → anchor 1 (30 min transit)                                 │
│   "My partner works in Salamanca" → anchor 2 (25 min transit)                           │
│   "I go to CrossFit 4x/week" → anchor 3 (15 min walking to any CrossFit)                │
│                                                                                         │
│ WHO: Our code (Turf.js, NO AI)                                                          │
│ WHAT: Intersect all isochrones                                                          │
│                                                                                         │
│ RESULT:                                                                                 │
│    ┌─────────────────────────────────────┐                                              │
│    │          [MAP]                      │                                              │
│    │                                     │                                              │
│    │   ╭───╮        ╭───╮                │                                              │
│    │  ╱ 📍 ╲      ╱ 📍  ╲               │                                              │
│    │ │ Work │════│Partner│              │   ════ = SWEET SPOT (intersection)           │
│    │  ╲    ╱      ╲     ╱               │                                              │
│    │   ╰───╯        ╰───╯                │                                              │
│    │         ╭───╮                       │                                              │
│    │        │ 🏋️ │                       │                                              │
│    │         ╰───╯                       │                                              │
│    │       CrossFit                      │                                              │
│    │                                     │                                              │
│    │  "Your sweet spot - works for both  │                                              │
│    │   commutes AND near a CrossFit"     │                                              │
│    └─────────────────────────────────────┘                                              │
│                                                                                         │
│ Leo says:                                                                               │
│ "I found your sweet spot - the highlighted area works for both your commute             │
│  AND your partner's, and there are 3 CrossFit gyms within walking distance.             │
│  Let me check how many properties we have there..."                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### (ARCHIVED) Profile Data Structure (Updated with POI searches)

> **See Part 9** for updated schema with dimension_weights, dimension_thresholds, vibe_check_results, etc.

```json
{
  "user_id": "abc-123",
  "profile_type": "renter",
  
  "constraints": {
    "maxBudget": 400000,
    "minBedrooms": 2,
    "maxCommuteMinutes": 30
  },
  
  "household": {
    "workSituation": "office",
    "pets": [{ "type": "dog", "name": "Max" }],
    "children": [],
    "adults": 2
  },
  
  "dimensions": {
    "pet_friendly":    { "score": 95, "confidence": "high" },
    "fitness":         { "score": 90, "confidence": "high" },
    "quietness":       { "score": 85, "confidence": "high" },
    "nature_access":   { "score": 80, "confidence": "high" },
    "nightlife":       { "score": 30, "confidence": "medium" },
    "transport":       { "score": 80, "confidence": "high" },
    "family_friendly": { "score": 40, "confidence": "low" },
    "safety":          { "score": 70, "confidence": "medium" }
  },
  
  "poi_searches": [
    { "query": "CrossFit gyms", "importance": "high", "max_travel_minutes": 15 },
    { "query": "dog parks", "importance": "medium", "max_travel_minutes": 10 }
  ],
  
  "anchors": [
    { "type": "work", "address": "Google Madrid", "lat": 40.45, "lng": -3.69, "max_minutes": 30, "mode": "transit" }
  ],
  
  "unlocked_areas": ["Retiro", "Chamartín", "Salamanca"],
  
  "updated_at": "2025-12-04T15:30:00Z"
}
```

---

### (ARCHIVED) PROPERTY REVEAL: The Only "Slow" Part

> **⚠️ SUPERSEDED**: In the new design, property reveal is BATCH PROCESSED 3x daily, not at end of call. See Part 5.

Everything above happens DURING the call. The only thing that takes time is **WPA** (analyzing photos).

```
╔════════════════════════════════════════════════════════════════════════════════════════╗
║              PROPERTY REVEAL (When user says "show me properties")                      ║
╚════════════════════════════════════════════════════════════════════════════════════════╝

User: "Ok, show me some properties!"
(or call ends, or user clicks "Ver propiedades" in dashboard)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: HARVEST LISTINGS (Instant - DB Query)                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ WHO:     DynamoDB (NO AI)                                                               │
│ TIME:    ~200ms                                                                         │
│                                                                                         │
│ QUERY:                                                                                  │
│   SELECT * FROM leo-listings                                                            │
│   WHERE neighborhood IN (user.unlocked_areas)                                           │
│     AND price <= user.maxBudget                                                         │
│     AND bedrooms >= user.minBedrooms                                                    │
│   ORDER BY (price / sqm) ASC                                                            │
│   LIMIT 50                                                                              │
│                                                                                         │
│ OUTPUT: 47 listings (basic data: price, sqm, photos, address)                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: WPA ON TOP 10 (The Slow Part - ~30 sec total)                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ WHO:     Gemini 2.5 Flash (AI - costs ~€0.15/listing)                                   │
│ TIME:    ~3 sec per listing × 10 = ~30 sec                                              │
│                                                                                         │
│ WHAT:    Analyze photos to extract visual qualities                                     │
│                                                                                         │
│ INPUT:   30 photos per listing                                                          │
│                                                                                         │
│ OUTPUT (per listing):                                                                   │
│   {                                                                                     │
│     natural_light: 85,          // 0-100                                                │
│     kitchen_functionality: 72,                                                          │
│     outdoor_space: 90,                                                                  │
│     perceived_spaciousness: 68,                                                         │
│     storage_quality: 45,                                                                │
│     flooring_condition: 60,                                                             │
│     noise_indicators: 30        // Visual cues (busy street visible, etc.)             │
│   }                                                                                     │
│                                                                                         │
│ COST: ~€0.15 × 10 = €1.50 per user                                                      │
│ CACHING: Results stored in leo-wpa-cache, reused if same listing seen again             │
│                                                                                         │
│ UX: Show skeleton cards → fill in as WPA completes                                      │
│     "Analyzing properties... 3/10 done"                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: FIT SCORING (Instant - Pure Math)                                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ WHO:     Our code (NO AI)                                                               │
│ TIME:    ~50ms                                                                          │
│                                                                                         │
│ FORMULA:                                                                                │
│                                                                                         │
│   PROPERTY_SCORE = weighted_avg(WPA_scores × user_signal_weights)                       │
│   NEIGHBORHOOD_SCORE = weighted_avg(hood_scores × user_dimension_weights)               │
│   FIT_SCORE = (PROPERTY_SCORE × 0.5) + (NEIGHBORHOOD_SCORE × 0.5)                       │
│                                                                                         │
│ EXAMPLE:                                                                                │
│   WPA: { light: 85, outdoor: 90 }                                                       │
│   User weights: { light: 1.0, outdoor: 1.5 } (from "I love light" in notes)             │
│   Hood: { pet_friendly: 92, quietness: 85 }                                             │
│   User dimensions: { pet_friendly: 0.95, quietness: 0.9 }                               │
│                                                                                         │
│   property = (85×1.0 + 90×1.5) / 2.5 = 88                                               │
│   neighborhood = (92×0.95 + 85×0.9) / 1.85 = 88.5                                       │
│   FIT = (88 × 0.5) + (88.5 × 0.5) = 88.25                                               │
│                                                                                         │
│ OUTPUT: Ranked list with fit scores                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: SURPRISE DETECTION (Instant - Simple Logic)                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ WHO:     Our code (NO AI)                                                               │
│ TIME:    ~10ms                                                                          │
│                                                                                         │
│ LOGIC:                                                                                  │
│   Find listings where:                                                                  │
│     fit_score > 80 AND                                                                  │
│     neighborhood NOT IN user.preferredLocations                                         │
│                                                                                         │
│ OUTPUT:                                                                                 │
│   {                                                                                     │
│     listing_id: 123,                                                                    │
│     hood: "Hortaleza",                                                                  │
│     fit_score: 87,                                                                      │
│     beats_preferred_on: ["pet_friendly", "quietness", "nature_access"],                 │
│     price_advantage: "-40%"                                                             │
│   }                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: SHOW DASHBOARD                                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                           DASHBOARD                                             │    │
│  ├─────────────────────────────────────────────────────────────────────────────────┤    │
│  │  ⭐ SURPRISE: Hortaleza - "You might not have considered this area, but..."    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                              │    │
│  │  │ [PHOTO]     │  │ [PHOTO]     │  │ [PHOTO]     │                              │    │
│  │  │ Hortaleza   │  │ Retiro      │  │ Chamartín   │                              │    │
│  │  │ FIT: 87 ★   │  │ FIT: 82     │  │ FIT: 78     │                              │    │
│  │  │ €350k | 85m²│  │ €380k | 90m²│  │ €395k | 88m²│                              │    │
│  │  │ "Great for  │  │ "Near park" │  │ "Quiet area"│                              │    │
│  │  │  Max!" 🐕   │  │             │  │             │                              │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                              │    │
│  │                                                                                 │    │
│  │  [MAP: Shows properties on your opportunity map]                                │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### WHAT-IFS: Probing Low-Confidence Dimensions

This happens DURING the intake call (not as a separate call). When Leo notices a dimension has low confidence but is likely relevant, Leo probes naturally:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ WHAT-IFS PROBING (Part of continuous extraction loop)                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ Leo notices:                                                                            │
│   dimensions.nature_access = { score: null, confidence: "unknown" }                     │
│   BUT user has a dog                                                                    │
│                                                                                         │
│ Leo probes naturally:                                                                   │
│   "By the way, since you have Max - is access to parks and green space                  │
│    really important, or are you fine with quick walks around the block?"                │
│                                                                                         │
│ User: "Oh definitely, we go hiking every weekend. I need green space."                  │
│                                                                                         │
│ Leo updates immediately:                                                                │
│   dimensions.nature_access = { score: 90, confidence: "high" }                          │
│   poi_searches.push({ query: "hiking trails", importance: "high" })                     │
│                                                                                         │
│ Leo can now unlock new neighborhoods:                                                   │
│   "That opens up some great options! Areas like Hortaleza and Moncloa                   │
│    have amazing green space and hiking trails nearby.                                   │
│    [MAP UPDATES to show new areas]                                                      │
│    Want me to include those in your search?"                                            │
│                                                                                         │
│ User: "Yes please!"                                                                     │
│                                                                                         │
│ Leo updates:                                                                            │
│   unlocked_areas = [...unlocked_areas, 'Hortaleza', 'Moncloa']                          │
│   [MAP EXPANDS to show new opportunity areas]                                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### TRADEOFFS: "What If" Scenarios

When Leo has enough info, Leo can propose tradeoffs:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ TRADEOFF EXPLORATION                                                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ Leo has learned:                                                                        │
│   - User wants: quiet, pet-friendly, green space                                        │
│   - User works: remote (no commute constraint)                                          │
│   - User's stated preference: "somewhere central"                                       │
│                                                                                         │
│ Leo notices a tension:                                                                  │
│   Central areas score LOWER on quiet, pet-friendly, green space                         │
│   But user said "central" without explaining why                                        │
│                                                                                         │
│ Leo probes:                                                                             │
│   "You mentioned you want somewhere central, but you also work remote.                  │
│    What is it about central that appeals to you?                                        │
│    Is it the restaurants and nightlife, or just being 'in the action'?"                 │
│                                                                                         │
│ User: "Honestly I just assumed central is better. I don't go out much."                 │
│                                                                                         │
│ Leo proposes:                                                                           │
│   "In that case, what if I showed you areas that are a bit further out                  │
│    but score much higher on everything you actually care about -                        │
│    quiet, dog-friendly, green space - and they're 40% cheaper?                          │
│    You'd get more space for Max and still be 30 min from the center                     │
│    whenever you want to go in."                                                         │
│                                                                                         │
│ User: "That actually sounds perfect. Show me those!"                                    │
│                                                                                         │
│ Leo updates:                                                                            │
│   unlocked_areas = ['Hortaleza', 'Las Rozas', 'Moncloa']  // Expanded!                  │
│   [MAP SHOWS new larger opportunity area]                                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### WHO'S THINKING: Summary Table

| When | Step | Who/What | Type | Cost | Time |
|------|------|----------|------|------|------|
| **DURING CALL** | Transcribe | ElevenLabs (Whisper) | AI | Incl. in ElevenLabs | Real-time |
| **DURING CALL** | Understand + Extract | Gemini 2.0 Flash | AI | Incl. in ElevenLabs | Real-time |
| **DURING CALL** | Update Profile | Supabase | DB write | Free | ~50ms |
| **DURING CALL** | Check Availability | DynamoDB | DB query | ~$0.0001 | ~100ms |
| **DURING CALL** | Neighborhood Lookup | DynamoDB | DB query | ~$0.0001 | ~100ms |
| **DURING CALL** | Generate Isochrone | Geoapify API | External API | Free | ~500ms |
| **DURING CALL** | Show Map | Our UI + WebSocket | Push to frontend | Free | ~100ms |
| **DURING CALL** | Respond | Gemini 2.0 Flash | AI | Incl. in ElevenLabs | Real-time |
| **PROPERTY REVEAL** | Harvest Listings | DynamoDB | DB query | ~$0.001 | ~200ms |
| **PROPERTY REVEAL** | WPA (×10) | Gemini 2.5 Flash-Lite | **AI (vision)** | **~€0.03** | **~30 sec** |
| **PROPERTY REVEAL** | Fit Score | Our code | Pure math | Free | ~50ms |
| **PROPERTY REVEAL** | Surprise Detection | Our code | Array compare | Free | ~10ms |

**Key insight:** Everything except WPA happens in real-time during the call.

**Total AI cost per user:** ~€1.50 (WPA on 10 listings)

**No separate Psychologist needed** - Gemini 2.0 Flash in ElevenLabs does incremental extraction.

---

### What's Built vs Missing (Continuous Model)

**(ARCHIVED)** - See Part 9 and Part 10 for updated implementation checklist.

| Component | Status | Notes |
|-----------|--------|-------|
| **DURING CALL** | | |
| ElevenLabs agents | ✅ Built | Leo-Intake-Renter, Leo-WhatIfs-Renter, etc. |
| update_profile tool | ✅ Built | /api/agents/update-profile |
| check_availability tool | ✅ Built | /api/agents/check-availability |
| neighborhood_lookup tool | ⚠️ Partial | Exists but not wired to 20-dimension profiles |
| Geoapify isochrone | ✅ Built | src/lib/lifestyle/geoapify-engine.ts |
| **DURING CALL - NEW (v3)** | | |
| trigger_early_wpa tool | ❌ **MISSING** | Fire WPA on 3 listings in background |
| show_vibe_check tool | ❌ **MISSING** | Push listing to UI for calibration |
| record_calibration tool | ❌ **MISSING** | Store user reaction vs WPA |
| calculate_heatmap tool | ❌ **MISSING** | 3-layer heatmap formula |
| show_map tool | ❌ **MISSING** | Update live map layers |
| WebSocket/Event push | ❌ **MISSING** | For vibe-check + map |
| **PROFILE SCHEMA - NEW (v3)** | | |
| dimension_weights | ❌ **MISSING** | How much user cares (0-2) |
| dimension_thresholds | ❌ **MISSING** | What score they need |
| dimension_relevance | ❌ **MISSING** | Which dims apply to them |
| vibe_check_results | ❌ **MISSING** | Their reactions to 3 properties |
| search_shape | ❌ **MISSING** | Commute intersection GeoJSON |
| heatmap_data | ❌ **MISSING** | Score grid for location fit |
| **BATCH PROCESSING (3x daily)** | | |
| WPA quick (no clusters) | ❌ **MISSING** | wpaQuick.ts |
| Fit scoring with thresholds | ❌ **MISSING** | Uses weights + thresholds |
| Explanation generation | ❌ **MISSING** | Flash-Lite personalized |
| Email delivery | ❌ **MISSING** | Send recommendations |
| **CRON JOBS** | | |
| Day 3 stock check | ❌ **MISSING** | Follow-up trigger |
| Weekly stock check | ❌ **MISSING** | Ongoing monitoring |
| **EXISTING (still valid)** | | |
| Neighborhood profiles (20 dims) | ✅ Built | DynamoDB leo-neighborhood-profiles |
| Harvest filter | ✅ Built | src/lib/recommender/harvestFilter.ts |
| WPA | ✅ Built | Needs update for no-cluster mode |
| Fit scoring | ✅ Built | Needs update for thresholds |
| Dashboard UI | ✅ Built | /dashboard |

### Priority Order (v3)

1. **Supabase migration** - Add dimension_weights, dimension_thresholds, vibe_check_results, zones to profile
2. **WPA quick (no clusters)** - wpaQuick.ts for vibe-check + batch
3. **trigger_early_wpa tool** - Fire WPA in background when basics known
4. **Vibe-check UI + tools** - show_vibe_check, record_calibration
5. **Heatmap calculation** - 3-layer formula, calculate_heatmap tool
6. **Live map tools** - update layers progressively throughout call
7. **Fit scoring v2** - Use weights × thresholds
8. **Batch processing pipeline** - Pre-WPA → WPA → Post-WPA → Explain
9. **Email delivery** - Send recommendations
10. **Cron jobs** - Day 3 + weekly stock checks

---

### Pre-Computation (One-Time Setup) ✅ STILL VALID

> This section is still valid for the v3 pipeline.

Before the per-user pipeline runs, we need pre-computed data:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ ONE-TIME PRE-COMPUTATION (€14 from your €1k credits)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  A. Tag 5M Airbnb reviews (Flash-lite) → €14                                            │
│     → Extract: noise, safety, tourist pressure, vibe                                    │
│                                                                                         │
│  B. Aggregate per neighborhood → Store in leo-neighborhood-profiles                     │
│     → 20 dimension scores per neighborhood                                              │
│                                                                                         │
│  C. Cadastre lookup all properties → year_built, official_m2                            │
│                                                                                         │
│  D. Calculate rental yields → from our own data                                         │
│                                                                                         │
│  E. Detect price anomalies → vs neighborhood average                                    │
│                                                                                         │
│  Result: leo-listings-enriched table, FREE to query forever                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Nightly Enrichment (For new listings) ✅ STILL VALID

> NOTE: Now runs 3x daily (after delta harvest), not just nightly.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ LISTING ENRICHMENT (Runs 3x daily, after delta harvest)                                 │
│ Cost: ~€0.10/run                                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  For each NEW listing (not already enriched):                                           │
│  ├── Cadastre lookup (FREE) → official m², year built                                   │
│  ├── Assign neighborhood → lookup pre-computed scores                                   │
│  ├── Calculate rental yield → from our rent listings                                    │
│  ├── Calculate price anomaly → vs neighborhood                                          │
│  └── Geo-inference → inherit from nearby buildings                                      │
│                                                                                         │
│  Result: New listings enriched, ready for recommender                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Buyer-Only: Post-Save Deep Analysis ✅ STILL VALID

> This is P1 (post-MVP) functionality but the design is still valid.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ BUYER SAVES PROPERTY → Full Analysis                                                    │
│ Cost: ~€0.35/saved                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  When buyer clicks "Save":                                                              │
│  ├── Full WPA (Gemini 3 Pro, 30 photos) → detailed scores                               │
│  └── Store in saved_properties                                                          │
│                                                                                         │
│  → User sees property in "My Saved"                                                     │
│  → This is the CURRENT Property Page (LeanPropertyContent.tsx)                          │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                    (Buyer only below this point)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ BUYER WANTS TO VISIT (Full Analysis → Viewing Checklist)                                │
│ Cost: ~€1.75                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  When buyer clicks "I want to visit this":                                              │
│  ├── A-C Text Passes → extract what's missing from listing                              │
│  ├── Zero-shot clustering → understand room layout                                      │
│  ├── Room-by-room analysis → detailed condition per room                                │
│  ├── 2-barrel contextual research → building/neighborhood context                       │
│  └── Generate Viewing Checklist:                                                        │
│      ├── Property-specific checks (from room analysis)                                  │
│      ├── Building-specific checks (from cadastre)                                       │
│      ├── Questions to ask seller/agent                                                  │
│      └── Standard buyer checks (structure, legal, etc.)                                 │
│                                                                         │
│  → Shows on SAME Property Page with "Viewing Checklist" section        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PAID: FULL RENOVATION DEEP DIVE (User pays €29-99)                     │
│  Cost: ~€2-5 (they pay, we profit)                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Full renovation analysis (existing pipeline):                          │
│  ├── Smart M2 estimation                                                │
│  ├── Baseline renovation cost                                           │
│  ├── Tier generation (Estándar/Óptimo/Plus)                            │
│  ├── Consideraciones generation                                        │
│  └── Renovation scope and timeline                                      │
│                                                                         │
│  → Shows on SAME Property Page with "Renovation Analysis" section      │
│  → This is our premium upsell for serious buyers                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### UI: Everything on Property Page

**NO "Deep Dive V2 UI"** - everything renders on the current Property Page (`/property/[id]`):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  /property/[id] (LeanPropertyContent.tsx)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Photos Gallery]                                                       │
│                                                                         │
│  📍 Title, Price, Location                                              │
│  ├── Match Score: 87%                                                   │
│  ├── Quick WPA: ☀️ Light 85 | 🏠 Layout 72 | 🌳 Outdoor 60             │
│  └── [Save] [Share] [Contact Agent]                                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📝 DESCRIPTION                                                          │
│  (existing listing description)                                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🏢 PRE-COMPUTED DATA (from enriched DB)                                │
│  ├── Building Year: 1968 (Cadastre)                                     │
│  ├── Official Size: 82m² (vs 85m² claimed)                              │
│  ├── Neighborhood: Gràcia                                               │
│  │   ├── Noise Risk: Medium (23 complaints in area)                     │
│  │   └── Tourist Pressure: High (47 Airbnbs within 300m)                │
│  └── BUYER: Rental Yield Est: 4.2% | Price vs Area: -8%                │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ❤️ IF SAVED: FULL WPA DETAILS                                          │
│  (detailed condition analysis, concerns, standouts)                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📋 BUYER ONLY: VIEWING CHECKLIST (after "I want to visit")             │
│  ├── ⚠️ Property Checks                                                 │
│  │   ├── □ Check kitchen plumbing (photos show old pipes)              │
│  │   ├── □ Inspect bathroom ventilation                                 │
│  │   └── □ Test all light switches                                      │
│  ├── 🏢 Building Checks (1968 construction)                             │
│  │   ├── □ Ask about asbestos remediation                               │
│  │   └── □ Check community reserve fund                                 │
│  ├── 📍 Location Checks                                                 │
│  │   └── □ Visit on weekend evening (tourist noise area)                │
│  └── ❓ Questions for Agent                                             │
│      ├── Why is owner selling?                                          │
│      └── Any pending assessments?                                       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🔧 BUYER ONLY: RENOVATION ANALYSIS (PAID - €29)                        │
│  [Unlock Full Renovation Analysis →]                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Analysis Pipeline Mapping

| Analysis Component | When It Runs | Cost | Who Pays |
|--------------------|--------------|------|----------|
| **Airbnb Review Tags** | Stage 0 (once) | €14 total | Pre-computed |
| **Cadastre** | Stage 0/1 | FREE | Pre-computed |
| **Neighborhood Stats** | Stage 0 (aggregation) | FREE | Pre-computed |
| **Rental Yield** | Stage 1 (nightly) | FREE | Pre-computed |
| **Price Anomaly** | Stage 1 (nightly) | FREE | Pre-computed |
| **WPA** | Recommender (on filtered) | €0.003/each | Us |
| **Full WPA** | On Save | €0.30 | Us |
| **A-C Text Passes** | Buyer: Want to Visit | €0.05 | Us (buyer) |
| **Zero-shot Clustering** | Buyer: Want to Visit | €0.75 | Us (buyer) |
| **Room-by-Room Analysis** | Buyer: Want to Visit | €0.50 | Us (buyer) |
| **2-Barrel Research** | Buyer: Want to Visit | €0.30 | Us (buyer) |
| **Viewing Checklist** | Buyer: Want to Visit | €0.15 | Us (buyer) |
| **Full Reno Pipeline** | Paid Product | €2-5 | User pays €29-99 |

### Airbnb Review Analysis: No LLM Needed for Keyword Detection!

Looking at the current `social-radar.ts`, the expensive part (LLM) is only for generating a "summary". 
But **keyword detection is already programmatic** (line 138-154):

```typescript
// ALREADY PROGRAMMATIC - NO LLM NEEDED
const redFlagKeywords = [
  'ruido', 'noise', 'olor', 'smell', 'obras', 'construction', 
  'frio', 'cold', 'damp', 'humedad', 'paredes', 'thin walls', 
  'cockroach', 'cucarachas', 'robbery', 'robo', 'policia'
];

const flags = reviews.filter(r => 
  r.comments && redFlagKeywords.some(k => r.comments.toLowerCase().includes(k))
);
```

**What we can pre-compute per neighborhood WITHOUT LLM:**

```typescript
interface NeighborhoodStats {
  // ALL FREE - just SQL queries on Airbnb DB
  airbnb_listing_count: number;         // COUNT(*)
  avg_rating: number;                   // AVG(review_scores_rating)
  tourist_saturation: 'LOW' | 'MEDIUM' | 'HIGH';  // Based on density thresholds
  
  // Keyword counts (FREE - just string matching)
  noise_mentions: number;               // COUNT WHERE comments LIKE '%noise%'
  smell_mentions: number;               // COUNT WHERE comments LIKE '%olor%'
  construction_mentions: number;        // COUNT WHERE comments LIKE '%obras%'
  safety_mentions: number;              // COUNT WHERE comments LIKE '%robo%'
  
  // Derived scores (FREE - arithmetic)
  noise_risk_score: number;             // noise_mentions / total_reviews * 100
  safety_risk_score: number;            // safety_mentions / total_reviews * 100
}
```

**Airbnb DB Stats:**
- 121,416 listings
- 4,918,548 reviews
- Avg review length: 242 characters

**Pre-Computation Cost (ONE TIME, use €1k Gemini credits):**

Option A: **Pure SQL/programmatic** (FREE)
```sql
-- Per neighborhood, group reviews by keyword match
SELECT 
  neighborhood,
  COUNT(*) as total_reviews,
  SUM(CASE WHEN LOWER(comments) LIKE '%noise%' OR LOWER(comments) LIKE '%ruido%' THEN 1 ELSE 0 END) as noise_mentions,
  SUM(CASE WHEN LOWER(comments) LIKE '%smell%' OR LOWER(comments) LIKE '%olor%' THEN 1 ELSE 0 END) as smell_mentions
FROM reviews r
JOIN listings l ON r.listing_id = l.id
GROUP BY neighborhood;
```
Cost: €0 (just SQLite)

Option B: **LLM-enhanced** (use your €1k credits)
If you want RICHER analysis (sentiment, severity, specific issues), batch process ALL 5M reviews ONCE:

```typescript
// Process 5M reviews with Flash-lite
// 242 chars avg = ~60 tokens input
// Output: ~20 tokens (tags)
// Flash-lite: $0.02/M input, $0.08/M output

const inputTokens = 5_000_000 * 60 = 300M tokens
const outputTokens = 5_000_000 * 20 = 100M tokens

const cost = (300 * 0.02) + (100 * 0.08) = €6 + €8 = €14 TOTAL
```

**€14 to process ALL 5M reviews once, then query for FREE forever.**

### LLM-Based Review Analysis: Schema Discovery → Batch Extraction

**The Smart Approach:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: SCHEMA DISCOVERY (Gemini 3 Pro, ONE call)                      │
│  Cost: ~€0.50                                                           │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Pass 200-500 sample reviews to Gemini 3 Pro and ask:                  │
│  "What measurable dimensions can we extract from these reviews?"        │
│                                                                         │
│  Output: Schema definition with dimensions like:                        │
│  - noise_level: 1-5 (or N/A if not mentioned)                          │
│  - cleanliness: 1-5 (or N/A)                                           │
│  - host_responsiveness: 1-5 (or N/A)                                   │
│  - location_walkability: 1-5 (or N/A)                                  │
│  - neighborhood_safety: 1-5 (or N/A)                                   │
│  - tourist_crowding: 1-5 (or N/A)                                      │
│  - construction_nearby: boolean (or N/A)                               │
│  - smell_issues: boolean (or N/A)                                      │
│  - parking_difficulty: 1-5 (or N/A)                                    │
│  - etc...                                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: BATCH EXTRACTION (Flash-lite, ALL 5M reviews)                  │
│  Cost: ~€14                                                             │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  For each review, Flash-lite extracts the discovered dimensions:        │
│                                                                         │
│  Input: "Lovely apartment but the street was noisy at night.            │
│          Construction next door started at 7am. Great location          │
│          though, walkable to everything."                               │
│                                                                         │
│  Output:                                                                │
│  {                                                                       │
│    "noise_level": 4,           // High noise mentioned                  │
│    "cleanliness": null,        // Not mentioned                         │
│    "location_walkability": 5,  // "walkable to everything"             │
│    "construction_nearby": true,// Explicit mention                      │
│    "overall_sentiment": 3      // Mixed review                          │
│  }                                                                       │
│                                                                         │
│  → Store in airbnb_reviews_tagged table                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: NEIGHBORHOOD AGGREGATION (FREE - SQL)                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  SELECT                                                                 │
│    neighborhood,                                                        │
│    AVG(noise_level) as avg_noise,                                       │
│    AVG(location_walkability) as avg_walkability,                        │
│    SUM(CASE WHEN construction_nearby THEN 1 ELSE 0 END) as construction,│
│    COUNT(*) as total_reviews                                            │
│  FROM airbnb_reviews_tagged                                             │
│  GROUP BY neighborhood;                                                 │
│                                                                         │
│  → Store in neighborhood_profiles table                                │
│  → Query for FREE forever                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Example Prompt for Step 1 (Schema Discovery):**

```
You are analyzing Airbnb reviews to discover what measurable attributes 
we can extract about the AREA/NEIGHBORHOOD/STREET - NOT the apartment itself.

IGNORE anything about:
- The host (responsiveness, friendliness)
- The apartment interior (cleanliness, bed comfort, TV, wifi)
- Check-in process
- Value for money

FOCUS ONLY ON:
- Street/neighborhood noise levels
- Area safety feeling
- Walkability to amenities
- Tourist density/crowding
- Construction in the area
- Parking situation
- Nightlife/bar noise from outside
- Smells from the street/area
- Public transport access
- Beach/nature proximity feeling

Here are 200 sample reviews from various properties:
[REVIEWS]

TASK: Identify 8-12 measurable dimensions about the AREA that:
1. Are mentioned frequently across reviews
2. Tell us about the NEIGHBORHOOD (not the apartment)
3. Would help a home buyer/renter understand what living there is like
4. Can be scored 1-5 or as boolean

Output JSON schema with name, type, description, example_phrases.
```

**Example Flash-lite Extraction Prompt:**

```
Extract ONLY area/neighborhood attributes. IGNORE apartment/host details.

SCHEMA:
- street_noise: 1(silent)-5(very loud) or null
- walkability: 1(car needed)-5(everything walkable) or null
- safety_feeling: 1(unsafe)-5(very safe) or null
- tourist_crowding: 1(quiet)-5(overrun) or null
- construction_nearby: true/false/null
- street_smells: true/false/null
- parking_difficulty: 1(easy)-5(impossible) or null
- nightlife_noise: true/false/null

REVIEW: "[REVIEW_TEXT]"

JSON only, null if not mentioned:
```

**What We Extract vs Ignore:**

| ✅ EXTRACT (Area/Neighborhood) | ❌ IGNORE (Apartment/Host) |
|-------------------------------|---------------------------|
| "street was noisy" | "bed was comfy" |
| "walkable to restaurants" | "host was responsive" |
| "felt safe walking" | "apartment was clean" |
| "too many tourists" | "good wifi" |
| "construction next door" | "nice shower" |
| "hard to park" | "great kitchen" |
| "bars below were loud" | "check-in was easy" |
| "smell from nearby" | "good value" |

**Database Schema:**

```sql
CREATE TABLE airbnb_reviews_tagged (
  review_id TEXT PRIMARY KEY,
  listing_id TEXT,
  neighborhood TEXT,
  
  -- Extracted dimensions (nullable = N/A)
  noise_level INTEGER,           -- 1-5
  walkability INTEGER,           -- 1-5
  safety_feeling INTEGER,        -- 1-5
  tourist_crowding INTEGER,      -- 1-5
  construction_nearby BOOLEAN,
  smell_issues BOOLEAN,
  parking_difficulty INTEGER,    -- 1-5
  nightlife_noise BOOLEAN,
  
  -- Meta
  overall_sentiment INTEGER,     -- 1-5
  extracted_at TIMESTAMP
);

CREATE TABLE neighborhood_profiles (
  neighborhood_id TEXT PRIMARY KEY,
  name TEXT,
  
  -- Aggregated scores (AVG of non-null values)
  avg_noise_level FLOAT,
  avg_walkability FLOAT,
  avg_safety_feeling FLOAT,
  avg_tourist_crowding FLOAT,
  pct_construction_mentions FLOAT,
  pct_smell_mentions FLOAT,
  avg_parking_difficulty FLOAT,
  pct_nightlife_noise FLOAT,
  
  -- Counts
  total_reviews INTEGER,
  total_listings INTEGER,
  
  updated_at TIMESTAMP
);
```

**Cost Breakdown:**

| Step | Model | Cost |
|------|-------|------|
| Schema Discovery | Gemini 3 Pro (1 call, 500 reviews) | ~€0.50 |
| Batch Extraction | Flash-lite (5M reviews) | ~€14 |
| Aggregation | SQL | FREE |
| **TOTAL** | | **~€15** |

Then queries are FREE forever.

---

## 📚 2-Barrel Research → Recommender (What's Reusable?)

The 2-barrel contextual research has 12 categories. Most are **renovation-focused**, but some are useful for the recommender.

### Current 12 Categories (Renovation-Focused)

| Category | What It Covers | Renter? | Buyer? | Pre-computable? |
|----------|----------------|---------|--------|-----------------|
| `permits` | Local permit processes, timelines | ❌ | ✅ | Per-district |
| `contractors` | Local contractor availability | ❌ | ✅ | Per-city |
| `seasonality` | Best times for renovation | ❌ | ✅ | Per-region |
| `community_rules` | Building/HOA regulations | ✅ | ✅ | Per-building |
| `norms_standards` | Building codes | ❌ | ✅ | Per-city |
| `market_practices` | Transaction norms | ❌ | ✅ | Per-city |
| `utilities_infrastructure` | Utilities, internet | ✅ | ✅ | Per-neighborhood |
| `logistics_access` | Delivery, parking for work | ❌ | ✅ | Per-property |
| `waste_management` | Debris removal | ❌ | ✅ | Per-district |
| `noise_environment` | Noise regs, typical levels | ✅ | ✅ | Per-neighborhood |
| `cost_context` | Local labor/material costs | ❌ | ✅ | Per-city |
| `scheduling_windows` | When work can happen | ❌ | ✅ | Per-building |

### What's Useful for RENTERS

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RENTER-RELEVANT (from 2-barrel)                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  community_rules:                                                       │
│  ├── Pet policy (dogs/cats allowed?)                                   │
│  ├── Noise hours (when is quiet time?)                                 │
│  ├── Short-term rental rules (Airbnb neighbors?)                       │
│  └── Subletting policy                                                  │
│                                                                         │
│  utilities_infrastructure:                                              │
│  ├── Internet providers & speeds available                             │
│  ├── Heating type (gas? electric? included?)                           │
│  ├── Water quality/pressure                                            │
│  └── Mobile coverage                                                    │
│                                                                         │
│  noise_environment:                                                     │
│  ├── Construction hours in area                                        │
│  ├── Nightlife noise regulations                                       │
│  └── Traffic patterns                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### What's Useful for BUYERS (Additional)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BUYER-RELEVANT (beyond renter stuff)                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  permits:                                                               │
│  ├── Typical permit timelines in this district                         │
│  ├── What requires Licencia de Obra Mayor                              │
│  └── Protected building restrictions                                    │
│                                                                         │
│  contractors:                                                           │
│  ├── Local contractor availability                                     │
│  ├── Average wait times                                                │
│  └── Trusted contractor sources                                        │
│                                                                         │
│  cost_context:                                                          │
│  ├── Local labor rates (€/hr)                                          │
│  ├── Material costs vs Barcelona average                               │
│  └── Community fee norms for this area                                 │
│                                                                         │
│  market_practices:                                                      │
│  ├── Typical negotiation margins                                       │
│  ├── Common contract clauses                                           │
│  └── Arras conventions                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pre-Computation Strategy

Instead of running 2-barrel per-property, **pre-compute per-geography**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 1: PER-CITY (run once, share across ALL properties)              │
│  Cost: ~€5/city × 10 cities = €50 total                                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  • contractors (general availability, trusted platforms)               │
│  • norms_standards (city building codes)                               │
│  • cost_context (average labor/material rates)                         │
│  • market_practices (transaction norms)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 2: PER-DISTRICT (~50 districts)                                  │
│  Cost: ~€1/district × 50 = €50 total                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  • permits (district-specific processes, protected zones)              │
│  • waste_management (local debris rules)                               │
│  • seasonality (local construction calendars)                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 3: PER-NEIGHBORHOOD (~500 neighborhoods)                         │
│  Already doing this with Airbnb analysis!                               │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  • noise_environment (from Airbnb reviews)                             │
│  • utilities_infrastructure (internet, water quality reports)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 4: PER-BUILDING (can't pre-compute, but can infer)              │
│  Cost: FREE (inference from cadastre + geo)                            │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  • community_rules (infer from building age, type, size)               │
│  • scheduling_windows (infer from building type)                       │
│                                                                         │
│  Example inferences:                                                    │
│  - Building from 1960s, 12 units → likely has community fee €50-100   │
│  - Building >50 units → likely stricter noise/work rules               │
│  - Building <1980 → likely asbestos concerns                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Renter vs Buyer: What They See

**Renter Property Card:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  📍 Gràcia, Barcelona                                                   │
│                                                                         │
│  FROM PRE-COMPUTED DATA:                                                │
│  ├── 🔊 Noise: Medium (tourist area, nightlife nearby)                 │
│  ├── 🌐 Internet: Fiber available (Movistar, Vodafone)                 │
│  ├── 🐕 Pets: Likely allowed (typical for area)                        │
│  └── 🚗 Parking: Difficult (zone regulated)                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Buyer Property Card:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  📍 Gràcia, Barcelona                                                   │
│                                                                         │
│  FROM PRE-COMPUTED DATA:                                                │
│  ├── Everything Renter sees PLUS:                                      │
│  │                                                                       │
│  ├── 📋 Permits: ~3 months for Obra Mayor in this district             │
│  ├── 👷 Contractors: Good availability, ~€35/hr labor                  │
│  ├── 💰 Market: 5-8% negotiation typical                               │
│  ├── 🏛️ Protection: Not in protected zone                             │
│  └── 📅 Best reno time: Sept-Nov (avoid Aug)                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cost Summary (Original Estimate)

| Level | Items | Cost | Frequency |
|-------|-------|------|-----------|
| Per-City | 10 cities | €50 | Once |
| Per-District | 50 districts | €50 | Once |
| Per-Neighborhood | 500 | Already in Airbnb analysis | Once |
| Per-Building | N/A | FREE (inference) | - |
| **TOTAL** | | **€100** | One-time |

---

## 🔍 Serper.dev + ScrapingDog Strategy: Expanded Pre-Computation

### Environment Setup

```bash
# Add to .env.local
SERPER_API_KEY=<your-key-here>  # 2,500 free queries
```

### API Endpoint

```typescript
// Serper.dev Google Search API
const response = await fetch('https://google.serper.dev/search', {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.SERPER_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    q: `"Gràcia" Barcelona vivir opiniones familias`,
    gl: 'es',  // Spain
    hl: 'es',  // Spanish
    num: 10    // 10 results
  })
});
```

> **TL;DR: 20 Dimensions for ~€5**
> 
> | Metric | Value |
> |--------|-------|
> | **Total queries** | 4,200 (2,500 Serper FREE + 1,700 ScrapingDog credits) |
> | **Neighborhoods covered** | ~300 across 10 cities |
> | **Dimensions extracted** | 20 (5 life stage + 9 lifestyle + 4 universal + 2 economic) |
> | **Pages analyzed** | 42,000 |
> | **Total cost** | ~€5 (one-time) |
> | **Result** | Queryable neighborhood profiles, FREE forever |
>
> **What-If Scenarios Enabled:** Kids, retirement, single life, dog, WFH, fitness, vegan, eco-conscious, LGBTQ+, budget, investment, and more.

### The Math (Updated with ScrapingDog Credits)

```
Total query budget:
├── Serper.dev FREE: 2,500 queries
├── ScrapingDog credits: 1,700 queries
└── TOTAL: 4,200 queries ✅

Neighborhoods across 10 cities: ~300
Queries per neighborhood: 4,200 ÷ 300 = 14 queries

14 queries × 10 results each = 140 pages/neighborhood
300 neighborhoods × 140 pages = 42,000 pages to analyze

Analysis cost: 42k pages × €0.06/1k = ~€2.50
```

### Expanded Dimensions (20 total, grouped into 7 combo queries)

**Instead of 20 separate queries, we combine related dimensions into 7 combo queries:**

```typescript
// 7 combo queries per neighborhood = 7 queries × 300 neighborhoods = 2,100 queries
const comboQueries = {
  // Query 1: Life stages combo (students → retirees)
  life_stages: `"${barrio}" ${city} vivir opiniones familias jóvenes estudiantes jubilados profesionales`,
  
  // Query 2: Social/nightlife combo  
  social: `"${barrio}" ${city} vida nocturna bares citas ambiente social LGBTQ gay friendly`,
  
  // Query 3: Work/productivity combo
  work: `"${barrio}" ${city} coworking wifi cafetería trabajar oficina nómadas digitales`,
  
  // Query 4: Active lifestyle combo
  active: `"${barrio}" ${city} gimnasios correr ciclismo parques naturaleza mascotas perros`,
  
  // Query 5: Food/culture combo
  culture: `"${barrio}" ${city} restaurantes galerías teatro mercados comida vegano`,
  
  // Query 6: Family/safety combo
  family_safety: `"${barrio}" ${city} colegios niños seguridad parques familias crimen`,
  
  // Query 7: Practical/economics combo
  practical: `"${barrio}" ${city} transporte metro ruido precio alquiler gentrificación ecológico`,
};

// 7 queries × 300 neighborhoods = 2,100 queries ✅ Under budget!
// REMAINING: 2,100 queries for priority neighborhoods & city-level research
```

### The 20 Dimensions (Full List)

#### LIFE STAGE DIMENSIONS (5)

| # | Dimension | Who Cares | What We Learn | Enables What-If |
|---|-----------|-----------|---------------|-----------------|
| 1 | `student_friendly` | 18-24 | Cheap eats, nightlife, roommate culture, transport | "What if I'm on a student budget?" |
| 2 | `young_professional` | 25-35 | Dating scene, networking events, trendy cafes, career | "What if I'm single and want to meet people?" |
| 3 | `couple_friendly` | 28-40 | Romantic restaurants, quiet evenings, date spots | "What if we don't have kids?" |
| 4 | `family_friendly` | 30-45 | Schools, parks, playgrounds, kid activities, safety | "What if I have kids in 2 years?" |
| 5 | `retiree_friendly` | 60+ | Healthcare, quiet, accessibility, pace of life | "What if I'm retiring?" |

#### INTEREST/LIFESTYLE DIMENSIONS (9)

| # | Dimension | Who Cares | What We Learn | Enables What-If |
|---|-----------|-----------|---------------|-----------------|
| 6 | `digital_nomad` | Remote workers | Coworking, wifi cafes, international vibe, delivery | "What if I work from home full-time?" |
| 7 | `fitness_active` | Gym-goers, runners | Gyms, running paths, cycling, outdoor sports | "What if I want to get fit?" |
| 8 | `foodie_scene` | Food lovers | Restaurants, markets, specialty food, variety | "What if I'm vegetarian/vegan?" |
| 9 | `nightlife_social` | Social people | Bars, clubs, dating scene, live music | "What if I'm single and want nightlife?" |
| 10 | `arts_culture` | Creative types | Galleries, theaters, music venues, artists | "What if I want cultural activities?" |
| 11 | `nature_outdoor` | Nature lovers | Parks, beach access, hiking nearby, green spaces | "What if I want to escape the city on weekends?" |
| 12 | `pet_friendly` | Pet owners | Dog parks, vets, pet-friendly buildings | "What if I get a dog?" |
| 13 | `lgbtq_friendly` | LGBTQ+ | Gay-friendly venues, pride presence, community | "What if I want an LGBTQ-friendly area?" |
| 14 | `eco_conscious` | Environmentalists | Bike lanes, recycling, farmers markets, green shops | "What if sustainability matters to me?" |

#### UNIVERSAL DIMENSIONS (4)

| # | Dimension | Everyone Cares | What We Learn | Enables What-If |
|---|-----------|----------------|---------------|-----------------|
| 15 | `safety_overall` | All | Crime mentions, night safety, well-lit streets | "What if I come home late?" |
| 16 | `quietness_noise` | All | Traffic, nightlife, construction, quiet hours | "What if I'm sensitive to noise?" |
| 17 | `transport_access` | All | Metro, bus, walkability, bike infrastructure | "What if I don't have a car?" |
| 18 | `vibe_character` | All | Hipster, traditional, international, trendy | "What if I want a certain vibe?" |

#### ECONOMIC DIMENSIONS (2)

| # | Dimension | Who Cares | What We Learn | Enables What-If |
|---|-----------|-----------|---------------|-----------------|
| 19 | `gentrification` | Buyers + Long-term renters | Price trends, changing character, investment | "What if prices keep rising?" |
| 20 | `budget_level` | All | Affordability, cheap options, luxury options | "What if I need to save money?" |

### Query Budget Allocation (Tiered by City Size)

```
TIER 1: Major cities - 10 queries/neighborhood (deeper coverage)
├── Barcelona: 73 neighborhoods × 10 = 730 queries
└── Madrid: 50 neighborhoods × 10 = 500 queries
Subtotal: 1,230 queries

TIER 2: Secondary cities - 7 queries/neighborhood (combo queries only)
├── Valencia: 30 × 7 = 210
├── Sevilla: 25 × 7 = 175
├── Málaga: 25 × 7 = 175
├── Bilbao: 20 × 7 = 140
Subtotal: 700 queries

TIER 3: Smaller cities - 5 queries/neighborhood (essentials only)
├── San Sebastián: 15 × 5 = 75
├── Palma: 20 × 5 = 100
├── Alicante: 20 × 5 = 100
├── Granada: 15 × 5 = 75
Subtotal: 350 queries

═══════════════════════════════════════════
TOTAL USED: 2,280 queries
REMAINING: 1,920 queries for:
├── City-level research (schools ranking, crime stats, events)
├── Priority neighborhood deep-dives (10 hottest neighborhoods)
├── Follow-up queries for thin data neighborhoods
└── Future city expansion (Zaragoza, Murcia, etc.)
═══════════════════════════════════════════
```

### 🚧 P0 Limitation: 10 Cities Only

> **IMPORTANT**: The 20-dimension neighborhood profiling is **only available in 10 cities** for P0.
> For properties outside these cities, we use fallback methods with known limitations.

#### Why This Matters

```
SPAIN COVERAGE:
├── 10 cities with full profiles = ~300 neighborhoods ✅
├── Rest of Spain = ~8,000+ neighborhoods ❌
└── Full country coverage would require: 8,000 × 7 queries = 56,000 queries
                                         56,000 queries × €0.004/query = ~€230
                                         + Analysis: 560k pages × €0.06/1k = ~€35
                                         TOTAL: ~€265 (future funding needed)
```

#### Fallback Strategy for Uncovered Areas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FALLBACK 1: AIRBNB REVIEWS (Partial Coverage)                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  What we CAN extract:                                                   │
│  ✅ Noise levels (complaints about noise)                              │
│  ✅ Safety feeling (mentions of feeling safe/unsafe)                   │
│  ✅ Tourist saturation (crowding mentions)                             │
│  ✅ Walkability (walking distance mentions)                            │
│  ✅ Quietness (quiet/peaceful mentions)                                │
│  ✅ Cleanliness (street cleanliness mentions)                          │
│                                                                         │
│  What we CANNOT extract (guests don't talk about this):                │
│  ❌ Schools quality                                                     │
│  ❌ Family-friendliness (locals' perspective)                          │
│  ❌ Gentrification trajectory                                          │
│  ❌ LGBTQ-friendliness                                                 │
│  ❌ Digital nomad infrastructure                                        │
│  ❌ Fitness facilities                                                  │
│  ❌ Eco-consciousness                                                   │
│  ❌ Local demographics (who actually lives there)                      │
│  ❌ Local vibe/character (beyond tourist perspective)                  │
│  ❌ Price trends / investment potential                                │
│                                                                         │
│  Coverage: ~40% of dimensions                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  FALLBACK 2: ACCEPT LIMITATIONS (Track for Future)                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  For uncovered areas, we:                                               │
│  1. Show only basic listing data (price, size, photos)                 │
│  2. Run WPA for visual assessment (light, condition, layout)           │
│  3. Use Cadastre for official data (year built, m²)                    │
│  4. Display disclaimer: "Limited neighborhood data for this area"      │
│                                                                         │
│  UI Treatment:                                                          │
│  • Grey out What-If scenarios                                           │
│  • Show "?" instead of scores for missing dimensions                   │
│  • Prompt: "Help us improve! Share what you know about this area"      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 📋 Dimensions We CANNOT Filter For (Outside 10 Cities)

**TRACK THIS LIST** - Review periodically for creative solutions:

| Dimension | Why We Can't | Potential Future Solution |
|-----------|--------------|---------------------------|
| `student_friendly` | Airbnb guests aren't students | University location data + rent prices |
| `young_professional` | Local lifestyle not in reviews | Instagram/social media analysis? |
| `couple_friendly` | Tourists ≠ residents | Dating app density? (stretch) |
| `family_friendly` | Parents don't write Airbnb reviews | School proximity + park density APIs |
| `retiree_friendly` | Retirees don't Airbnb | Healthcare facility proximity |
| `digital_nomad` | Only nomads mention coworking | Coworking space APIs (Croissant, etc.) |
| `fitness_active` | Guests rarely mention gyms | Gym location APIs + Strava heatmaps |
| `foodie_scene` | Restaurant data ≠ local scene | Google Places API + TripAdvisor |
| `arts_culture` | Not tourist priority | Event APIs + venue databases |
| `lgbtq_friendly` | Sensitive topic in reviews | Community surveys? Pride events? |
| `eco_conscious` | Rarely mentioned | City cycling data + recycling stats |
| `gentrification` | Only locals know | Price history + building age analysis |
| `budget_level` | Airbnb prices ≠ rent | Rent listing aggregation (we have this!) |
| `vibe_character` | Tourist perspective skewed | Reddit/forums analysis (expensive) |

#### 🔮 Future Pipeline: Full Spain Coverage

**When we have funding** (€300-500 budget):

```
PHASE 1: Expand to 20 major cities (€50)
├── Add: Zaragoza, Murcia, Gijón, A Coruña, Valladolid
├── Add: Vigo, Las Palmas, Pamplona, Santander, Vitoria
└── Coverage: ~600 neighborhoods

PHASE 2: Provincial capitals (€100)
├── All 50 provincial capitals
└── Coverage: ~1,500 neighborhoods

PHASE 3: Coastal tourist areas (€100)
├── Costa Brava, Costa Blanca, Costa del Sol
├── Balearic Islands, Canary Islands
└── Coverage: +500 neighborhoods

PHASE 4: Full country (€250)
├── All municipalities >10k population
└── Coverage: ~8,000 neighborhoods

TOTAL INVESTMENT: ~€500 for complete Spain coverage
ROI: Massive competitive advantage, free to query forever
```

#### Decision: P0 Ships with 10 Cities

**Rationale:**
1. 10 cities cover **80% of our initial user base** (urban renters/buyers)
2. Proves the concept before major investment
3. Fallback methods provide acceptable experience elsewhere
4. Users self-select into supported cities
5. Clear path to expand once funded

**User Communication:**
- "Full neighborhood intelligence available in: Barcelona, Madrid, Valencia..."
- "Basic search available nationwide"
- "Tell us where you're searching - we'll prioritize expansion!"

---

### What-If Scenarios This Enables (20 Dimensions → Rich Personalization)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WHAT-IF SCENARIO ENGINE (20 DIMENSIONS)                                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  LIFE STAGE CHANGES                                                     │
│  ─────────────────                                                      │
│                                                                         │
│  "What if I have kids in 2 years?"                                     │
│  → Boost: family_friendly, safety_overall, quietness_noise             │
│  → Penalize: nightlife_social, student_friendly                         │
│  → Check: school proximity, park density, family mentions               │
│                                                                         │
│  "What if I'm retiring soon?"                                          │
│  → Boost: retiree_friendly, quietness_noise, safety_overall            │
│  → Penalize: student_friendly, nightlife_social                         │
│  → Check: healthcare access, walkability, peaceful mentions             │
│                                                                         │
│  "What if I'm still single and want to meet people?"                   │
│  → Boost: young_professional, nightlife_social, couple_friendly        │
│  → Check: dating scene, bars, social events, age demographics          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LIFESTYLE CHANGES                                                      │
│  ─────────────────                                                      │
│                                                                         │
│  "What if I work from home 3 days/week?"                               │
│  → Boost: digital_nomad, quietness_noise (daytime)                     │
│  → Relax: commute time constraint (from 30min → 45min)                 │
│  → Check: coworking mentions, wifi cafes, daytime quiet                │
│                                                                         │
│  "What if I want to get fit?"                                          │
│  → Boost: fitness_active, nature_outdoor                                │
│  → Check: gym proximity, running paths, bike lanes, beach access       │
│                                                                         │
│  "What if I become vegetarian/vegan?"                                  │
│  → Check: foodie_scene.vegetarian_options                               │
│  → Display: vegan restaurant count, farmers markets                     │
│                                                                         │
│  "What if I get a dog?"                                                │
│  → Boost: pet_friendly, nature_outdoor                                  │
│  → Check: dog parks, vet proximity, building pet rules                 │
│  → Warning: Flag buildings with no-pets policy                          │
│                                                                         │
│  "What if sustainability matters more to me?"                          │
│  → Boost: eco_conscious                                                 │
│  → Check: bike infrastructure, recycling, farmers markets              │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SOCIAL/IDENTITY                                                        │
│  ─────────────────                                                      │
│                                                                         │
│  "What if I want an LGBTQ-friendly neighborhood?"                      │
│  → Boost: lgbtq_friendly score                                          │
│  → Check: pride mentions, gay-friendly venues, community presence       │
│  → Display: specific LGBTQ venues and community centers                │
│                                                                         │
│  "What if I don't speak Spanish well?"                                 │
│  → Boost: international_expat score                                     │
│  → Check: English-speaking mentions, expat community size              │
│  → Display: international schools, expat groups                        │
│                                                                         │
│  "What if I want cultural activities?"                                 │
│  → Boost: arts_culture score                                            │
│  → Check: galleries, theaters, music venues, creative spaces           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ECONOMIC CONCERNS                                                      │
│  ─────────────────                                                      │
│                                                                         │
│  "What if prices keep rising?"                                         │
│  → Check: gentrification.stage, gentrification.price_trend             │
│  → Display: price trajectory, investment risk                           │
│  → Suggest: "early stage" neighborhoods for buyers                     │
│                                                                         │
│  "What if I need to save money?"                                       │
│  → Boost: budget_level, student_friendly                                │
│  → Check: cheap eats, affordable entertainment                          │
│  → Filter: Show only affordable neighborhoods                          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PRACTICAL CONCERNS                                                     │
│  ─────────────────                                                      │
│                                                                         │
│  "What if I come home late at night?"                                  │
│  → Boost: safety_overall.night_walking                                  │
│  → Check: well-lit streets, night safety mentions, crime stats         │
│                                                                         │
│  "What if I'm sensitive to noise?"                                     │
│  → Boost: quietness_noise                                               │
│  → Penalize: nightlife_social, student_friendly                         │
│  → Check: noise sources, quiet pockets, best/worst times               │
│                                                                         │
│  "What if I get a car?" / "What if I don't have a car?"               │
│  → Adjust: transport_access weight                                      │
│  → Check: parking difficulty, metro proximity, walkability             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Example Response (Full What-If)

```
User: "What if I have kids in 2 years?"

Leo: "Let me show you how your saved neighborhoods would rank with kids:

📊 Re-ranking your 5 saved neighborhoods:

1. Gràcia (was #3) → NOW #1 (85% → 92% match)
   ✅ 4 parks within 10min walk
   ✅ 2 public schools rated 'good'
   ✅ 40% of mentions from families
   ✅ Quiet residential streets

2. Sant Antoni (was #1) → NOW #2 (91% → 78% match)
   ⚠️ Nightlife noise on weekends
   ⚠️ Only 1 park nearby
   ✅ Good schools in walking distance

3. Raval (was #2) → NOW #5 (87% → 52% match)
   ❌ High nightlife noise daily
   ❌ Safety concerns at night
   ❌ Few family-oriented spaces
   
Would you like me to suggest some family-friendly alternatives to Raval?"
```

### Legacy What-If Examples (Still Supported)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User says: "What if this neighborhood gentrifies more?"               │
│                                                                         │
│  System checks:                                                         │
│  ├── gentrification trajectory (mentions of "changing", "up and coming")│
│  ├── rent/price trends (from our listing data)                         │
│  ├── new business mentions                                             │
│  └── displacement mentions                                              │
│                                                                         │
│  Response (Buyer):                                                      │
│  "Poblenou is mid-gentrification - prices up 15% in 2 years, lots of  │
│   'up and coming' mentions. Good for appreciation, but character may   │
│   change. Sant Antoni already peaked - stable but pricey."            │
│                                                                         │
│  Response (Renter):                                                     │
│  "Warning: Poblenou rents rose 20% last year. If you sign a 1-year    │
│   contract, expect renewal to be higher. Consider longer lease."       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Search Query Templates (Expanded)

```typescript
const generateQueries = (neighborhood: string, city: string) => ({
  // VIBE & CHARACTER
  vibe_character: [
    `"${neighborhood}" ${city} ambiente barrio opiniones vivir`,
    `"${neighborhood}" ${city} tipo de gente vecinos comunidad`,
  ],
  
  // FAMILY
  family_friendliness: [
    `"${neighborhood}" ${city} familias niños colegios parques`,
    `"${neighborhood}" ${city} vivir con hijos experiencia`,
  ],
  
  // PETS
  pet_friendliness: [
    `"${neighborhood}" ${city} perros mascotas parque canino`,
    `"${neighborhood}" ${city} pisos que admiten mascotas`,
  ],
  
  // REMOTE WORK
  remote_work: [
    `"${neighborhood}" ${city} coworking cafetería wifi trabajar`,
    `"${neighborhood}" ${city} teletrabajo tranquilo día`,
  ],
  
  // NIGHTLIFE/SOCIAL
  nightlife_social: [
    `"${neighborhood}" ${city} vida nocturna bares salir`,
    `"${neighborhood}" ${city} ambiente joven solteros`,
  ],
  
  // FITNESS
  fitness_outdoor: [
    `"${neighborhood}" ${city} gimnasios correr running`,
    `"${neighborhood}" ${city} parques deporte bicicleta`,
  ],
  
  // GENTRIFICATION
  gentrification: [
    `"${neighborhood}" ${city} gentrificación cambios precios`,
    `"${neighborhood}" ${city} barrio de moda subiendo`,
  ],
  
  // NOISE
  noise_environment: [
    `"${neighborhood}" ${city} ruido tranquilo dormir`,
    `"${neighborhood}" ${city} silencioso noche turistas`,
  ],
  
  // SAFETY
  safety_walkability: [
    `"${neighborhood}" ${city} seguridad noche caminar`,
    `"${neighborhood}" ${city} seguro mujer sola`,
  ],
  
  // INTERNATIONAL
  international_expat: [
    `"${neighborhood}" ${city} expats extranjeros inglés`,
    `"${neighborhood}" ${city} comunidad internacional vivir`,
  ],
  
  // FOOD
  food_scene: [
    `"${neighborhood}" ${city} restaurantes mercado comida`,
    `"${neighborhood}" ${city} vegetariano vegano opciones`,
  ],
  
  // AGE DEMOGRAPHICS
  age_demographics: [
    `"${neighborhood}" ${city} edad vecinos jóvenes familias`,
    `"${neighborhood}" ${city} estudiantes jubilados profesionales`,
  ],
});
```

### Extraction Schema (Expanded)

```typescript
interface NeighborhoodProfile {
  neighborhood_id: string;
  city: string;
  
  // VIBE (qualitative)
  vibe: {
    primary_character: 'hipster' | 'traditional' | 'family' | 'international' | 'student' | 'luxury' | 'working_class' | 'mixed';
    secondary_traits: string[];  // ["artsy", "foodie", "quiet", "bustling"]
    changing: boolean;  // Is the vibe shifting?
    sentiment: 'love_it' | 'like_it' | 'mixed' | 'complaints';
  };
  
  // FAMILY (0-100)
  family: {
    score: number;
    schools_mentioned: 'none' | 'some' | 'many' | 'excellent';
    parks_playgrounds: 'none' | 'few' | 'adequate' | 'abundant';
    kid_activities: string[];
    stroller_friendly: boolean;
    family_testimonials: number;  // Count of family-perspective reviews
  };
  
  // PETS (0-100)
  pets: {
    score: number;
    dog_parks: 'none' | 'few' | 'several';
    pet_friendly_buildings: 'rare' | 'some' | 'common';
    vet_proximity: boolean;
    pet_cafes_shops: boolean;
  };
  
  // REMOTE WORK (0-100)
  remote_work: {
    score: number;
    coworking_spaces: number;
    wifi_cafes: 'none' | 'few' | 'many';
    daytime_quiet: boolean;
    delivery_ease: 'difficult' | 'ok' | 'easy';
    fiber_available: boolean;
  };
  
  // NIGHTLIFE (0-100)
  nightlife: {
    score: number;
    bars_density: 'none' | 'few' | 'moderate' | 'many';
    restaurant_variety: 'limited' | 'good' | 'excellent';
    dating_scene: 'dead' | 'ok' | 'active' | 'very_active';
    noise_from_nightlife: boolean;
  };
  
  // FITNESS (0-100)
  fitness: {
    score: number;
    gyms: 'none' | 'few' | 'several';
    running_paths: boolean;
    bike_lanes: boolean;
    beach_access: boolean;
    sports_facilities: string[];
  };
  
  // GENTRIFICATION
  gentrification: {
    stage: 'not_started' | 'early' | 'mid' | 'advanced' | 'peaked' | 'stable';
    price_trajectory: 'falling' | 'stable' | 'rising' | 'rapid_rise';
    new_businesses: 'none' | 'some' | 'many';
    displacement_mentions: boolean;
    investment_opportunity: 'low' | 'medium' | 'high';  // For buyers
    rent_risk: 'low' | 'medium' | 'high';  // For renters
  };
  
  // NOISE (0-100, higher = quieter)
  noise: {
    quietness_score: number;
    sources: string[];  // ["traffic", "nightlife", "tourists", "construction"]
    worst_times: string[];  // ["weekend nights", "summer"]
    quiet_streets_mentioned: string[];
  };
  
  // SAFETY (0-100)
  safety: {
    score: number;
    night_safety: 'avoid' | 'careful' | 'fine' | 'very_safe';
    issues_mentioned: string[];
    well_lit: boolean;
    police_presence: 'none' | 'some' | 'visible';
  };
  
  // INTERNATIONAL (0-100)
  international: {
    score: number;
    expat_community: 'none' | 'small' | 'significant' | 'large';
    english_friendly: boolean;
    international_schools: boolean;
    diversity: 'homogeneous' | 'some_diversity' | 'very_diverse';
  };
  
  // FOOD (0-100)
  food: {
    score: number;
    restaurant_density: 'sparse' | 'adequate' | 'abundant';
    cuisine_variety: string[];
    vegetarian_vegan: 'none' | 'few' | 'good' | 'excellent';
    markets: boolean;
    specialty_food: string[];
  };
  
  // AGE DEMOGRAPHICS
  demographics: {
    primary_age: 'students' | 'young_professionals' | 'families' | 'mixed' | 'retirees';
    secondary_age: string;
    income_level: 'budget' | 'middle' | 'upper_middle' | 'luxury';
  };
  
  // META
  confidence: 'low' | 'medium' | 'high';
  sources_count: number;
  last_updated: string;
}
```

### Query Budget Reallocation

With 12 categories and ~250 queries per city:

```
250 queries ÷ 12 categories = ~21 queries per category per city

If we have 50 neighborhoods:
21 queries ÷ 50 = not enough!

SOLUTION: Prioritize by city character

Barcelona (tourist city):
├── noise_environment: 30 queries (big issue)
├── gentrification: 25 queries (big issue)
├── family: 25 queries
├── pets: 20 queries
├── nightlife: 20 queries
├── remote_work: 20 queries
├── vibe: 20 queries
├── safety: 20 queries
├── fitness: 20 queries
├── international: 20 queries
├── food: 15 queries
└── demographics: 15 queries
TOTAL: 250 ✅

Madrid (business city):
├── remote_work: 30 queries (bigger here)
├── family: 30 queries
├── noise: 25 queries
├── safety: 25 queries
...etc
```

### Search Query Template

```typescript
// Per neighborhood, generate 5 category-specific queries
const generateQueries = (neighborhood: string, city: string) => [
  // noise_environment
  `"${neighborhood}" ${city} ruido vecinos opiniones blog`,
  
  // community_rules
  `"${neighborhood}" ${city} comunidad de vecinos normas mascotas`,
  
  // utilities
  `"${neighborhood}" ${city} fibra internet cobertura calefacción`,
  
  // safety_walkability
  `"${neighborhood}" ${city} seguridad barrio noche opiniones`,
  
  // cost_context
  `"${neighborhood}" ${city} gastos comunidad precio medio alquiler`,
];

// Prioritize blogs with site: operators
const blogPrioritized = query + " site:blog OR site:foro OR inurl:blog";
```

### The Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: SERPER.DEV QUERIES (FREE - 2,500 queries)                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  For each city (10 cities):                                             │
│  ├── For each neighborhood (~50):                                       │
│  │   └── For each category (5):                                         │
│  │       └── Run Serper.dev query → 10 results                         │
│  │                                                                       │
│  Output: 25,000 URLs with titles, snippets, positions                   │
│  Store in: DynamoDB or S3 JSON                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DOWNLOAD PAGES (S3 + Lambda)                                   │
│  Cost: ~€0.50 S3 storage                                                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Download 25k HTML pages:                                               │
│  ├── Use Lambda with concurrency limit (avoid rate limits)             │
│  ├── Store HTML in S3: s3://leo-research-pages/{city}/{neighborhood}/  │
│  ├── Extract main text content (strip nav, ads, etc.)                  │
│  └── Store metadata: URL, title, snippet, neighborhood, category        │
│                                                                         │
│  Avg page: ~50KB HTML → ~5KB text                                       │
│  Total storage: 25k × 5KB = ~125MB                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: FLASH-LITE ANALYSIS (€1-2 total)                               │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  For each page, extract structured data:                                │
│                                                                         │
│  Input: Page text (~5,000 chars = ~1,250 tokens)                       │
│  Output: Structured extraction (~200 tokens)                            │
│                                                                         │
│  Cost calculation:                                                      │
│  ├── 25k pages × 1,250 tokens = 31M input tokens                       │
│  ├── 25k pages × 200 tokens = 5M output tokens                         │
│  ├── Flash-lite: $0.02/M input + $0.08/M output                        │
│  └── Total: (31 × 0.02) + (5 × 0.08) = $0.62 + $0.40 = ~€1             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: AGGREGATE PER NEIGHBORHOOD (FREE - SQL)                        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Store extractions in: leo-neighborhood-research table                  │
│                                                                         │
│  {                                                                       │
│    neighborhood_id: "barcelona-gracia",                                 │
│    city: "Barcelona",                                                    │
│    category: "noise_environment",                                       │
│    sources: [                                                           │
│      {                                                                   │
│        url: "https://blog.example.com/vivir-en-gracia",                │
│        title: "Mi experiencia viviendo en Gràcia",                     │
│        extracted: {                                                     │
│          noise_level: "medium-high",                                   │
│          noise_sources: ["nightlife", "tourists", "construction"],     │
│          quiet_hours_mentioned: "after 11pm strict",                   │
│          sentiment: "mixed"                                            │
│        },                                                               │
│        credibility: "blog_personal_experience"                         │
│      }                                                                   │
│    ],                                                                    │
│    aggregated: {                                                        │
│      noise_score: 3.5,  // 1-5                                          │
│      common_issues: ["tourist noise", "bar noise"],                    │
│      quiet_areas_mentioned: ["upper gracia", "near park guell"],       │
│      confidence: "medium"  // based on # of sources                    │
│    }                                                                     │
│  }                                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flash-Lite Extraction Prompt (20 Dimensions)

```
Extract neighborhood insights from this blog/article.
Focus ONLY on information about the AREA and NEIGHBORHOOD character.
Ignore: specific apartment details, host reviews, smart TVs, furniture.

NEIGHBORHOOD: ${neighborhood}, ${city}
QUERY CATEGORY: ${category}

TEXT:
${pageText}

Extract (null if not mentioned):
{
  // === LIFE STAGE INDICATORS ===
  "life_stages": {
    "student_friendly": 1-5 | null,       // Budget eating, roommates, nightlife
    "young_professional": 1-5 | null,     // Dating, networking, trendy
    "couple_friendly": 1-5 | null,        // Romantic spots, quiet evenings
    "family_friendly": 1-5 | null,        // Schools, parks, playgrounds
    "retiree_friendly": 1-5 | null,       // Healthcare, quiet, accessibility
    "mentioned_demographics": ["students", "families", "young professionals", etc.]
  },
  
  // === LIFESTYLE/INTEREST INDICATORS ===
  "lifestyle": {
    "digital_nomad": 1-5 | null,          // Coworking, wifi cafes, international
    "fitness_active": 1-5 | null,         // Gyms, running, cycling, sports
    "foodie_scene": 1-5 | null,           // Restaurants, markets, variety
    "nightlife_social": 1-5 | null,       // Bars, clubs, dating, music
    "arts_culture": 1-5 | null,           // Galleries, theaters, creative
    "nature_outdoor": 1-5 | null,         // Parks, beach, hiking, green
    "pet_friendly": 1-5 | null,           // Dog parks, vets, pet buildings
    "lgbtq_friendly": 1-5 | null,         // Gay-friendly, pride, community
    "eco_conscious": 1-5 | null,          // Bike lanes, recycling, farmers markets
    "specific_places": ["gym names", "coworking names", "venue names"]
  },
  
  // === UNIVERSAL INDICATORS ===
  "universal": {
    "safety": 1-5 | null,                 // Crime, night safety, well-lit
    "safety_night": 1-5 | null,           // Specifically night walking
    "quietness": 1-5 | null,              // Inverse of noise (5 = very quiet)
    "noise_sources": ["traffic", "nightlife", "construction", etc.],
    "transport": 1-5 | null,              // Metro, bus, walkability
    "vibe": ["hipster", "traditional", "international", "trendy", etc.]
  },
  
  // === ECONOMIC INDICATORS ===
  "economics": {
    "gentrification_stage": "early|mid|advanced|peaked|stable|null",
    "price_trend": "falling|stable|rising|rapid|null",
    "budget_level": "budget|middle|upper|luxury|null",
    "rent_range": "€XXX-€XXX | null"
  },
  
  // === META ===
  "overall_sentiment": "negative|mixed|positive|very_positive",
  "credibility": "official|news|blog_expert|blog_personal|forum|unknown"
}

JSON only:
```

### Analysis Cost Breakdown (Updated for 42k pages)

**42,000 pages to analyze with Flash-lite:**

```
Input tokens:
├── Avg page text: ~5,000 chars = ~1,250 tokens
├── 42,000 pages × 1,250 tokens = 52.5M tokens
└── Cost: 52.5M × $0.02/M = $1.05

Output tokens (structured JSON):
├── 20 dimensions × ~40 tokens each = ~800 tokens/page
├── 42,000 pages × 800 tokens = 33.6M tokens
└── Cost: 33.6M × $0.08/M = $2.69

TOTAL ANALYSIS COST: ~$3.74 (~€3.50)
```

### Total Pipeline Cost (Updated)

| Step | Cost |
|------|------|
| Serper.dev (2,500 queries) | **FREE** |
| ScrapingDog (1,700 queries) | **FREE** (credits) |
| S3 storage (200MB HTML) | ~€0.02 |
| Lambda downloads (42k pages) | ~€0.80 |
| Flash-lite analysis (42k pages) | ~€3.50 |
| Nominatim geocoding | **FREE** (self-hosted) |
| DynamoDB storage | ~€0.15 |
| Aggregation (Lambda) | ~€0.10 |
| **TOTAL** | **~€4.57** |

**~€5 to research ALL neighborhoods in 10 cities with 20 dimensions**, then query FREE forever!

---

## 🗄️ Database Schema (DynamoDB)

### Table 1: `leo-serp-extractions` (Raw per-page extractions)

One row per analyzed page. This is the RAW data before aggregation.

```typescript
// Primary Key: page_id (hash of URL)
// Sort Key: neighborhood_id

interface SerpExtraction {
  // Keys
  page_id: string;              // SHA256(url)
  neighborhood_id: string;      // "barcelona-gracia"
  
  // Source metadata
  url: string;
  title: string;
  serp_snippet: string;
  serp_position: number;        // 1-10
  query_used: string;
  combo_category: string;       // "life_stages", "social", "work", "active", etc.
  
  // Geolocation (from Nominatim)
  city: string;
  city_id: string;              // "barcelona"
  lat: number;                  // Neighborhood center
  lng: number;
  
  // Credibility
  source_type: 'blog_personal' | 'blog_expert' | 'forum' | 'news' | 'official' | 'unknown';
  publish_date: string | null;
  
  // === 20 EXTRACTED DIMENSIONS (nullable = not mentioned) ===
  
  // --- LIFE STAGE DIMENSIONS (1-5) ---
  life_stages: {
    student_friendly: 1 | 2 | 3 | 4 | 5 | null;       // #1
    young_professional: 1 | 2 | 3 | 4 | 5 | null;     // #2
    couple_friendly: 1 | 2 | 3 | 4 | 5 | null;        // #3
    family_friendly: 1 | 2 | 3 | 4 | 5 | null;        // #4
    retiree_friendly: 1 | 2 | 3 | 4 | 5 | null;       // #5
    mentioned_demographics: string[];                  // ["students", "families", etc.]
  } | null;
  
  // --- LIFESTYLE/INTEREST DIMENSIONS (1-5) ---
  lifestyle: {
    digital_nomad: 1 | 2 | 3 | 4 | 5 | null;          // #6
    fitness_active: 1 | 2 | 3 | 4 | 5 | null;         // #7
    foodie_scene: 1 | 2 | 3 | 4 | 5 | null;           // #8
    nightlife_social: 1 | 2 | 3 | 4 | 5 | null;       // #9
    arts_culture: 1 | 2 | 3 | 4 | 5 | null;           // #10
    nature_outdoor: 1 | 2 | 3 | 4 | 5 | null;         // #11
    pet_friendly: 1 | 2 | 3 | 4 | 5 | null;           // #12
    lgbtq_friendly: 1 | 2 | 3 | 4 | 5 | null;         // #13
    eco_conscious: 1 | 2 | 3 | 4 | 5 | null;          // #14
    specific_places: string[];                         // Gym names, coworking, venues
  } | null;
  
  // --- UNIVERSAL DIMENSIONS ---
  universal: {
    safety_overall: 1 | 2 | 3 | 4 | 5 | null;         // #15
    safety_night: 1 | 2 | 3 | 4 | 5 | null;           // Night walking safety
    quietness: 1 | 2 | 3 | 4 | 5 | null;              // #16 (5 = very quiet)
    noise_sources: string[];                           // ["traffic", "nightlife", etc.]
    transport_access: 1 | 2 | 3 | 4 | 5 | null;       // #17
    vibe_character: string[];                          // #18 ["hipster", "traditional", etc.]
    vibe_changing: boolean | null;                     // Is the vibe changing?
  } | null;
  
  // --- ECONOMIC DIMENSIONS ---
  economics: {
    gentrification_stage: 'early' | 'mid' | 'advanced' | 'peaked' | 'stable' | null;  // #19
    price_trend: 'falling' | 'stable' | 'rising' | 'rapid' | null;
    budget_level: 'budget' | 'middle' | 'upper' | 'luxury' | null;                    // #20
    rent_range: string | null;                         // "€800-€1200"
    displacement_mentioned: boolean | null;
  } | null;
  
  // --- META ---
  overall_sentiment: 'negative' | 'mixed' | 'positive' | 'very_positive';
  credibility: 'official' | 'news' | 'blog_expert' | 'blog_personal' | 'forum' | 'unknown';
  extracted_at: string;                                // ISO timestamp
  extraction_confidence: 'low' | 'medium' | 'high';
  raw_text_length: number;
}
```

### 🗺️ How Geo-Matching Works: Property → Neighborhood Profile

**The Problem:** Given a property at `(lat: 41.4036, lon: 2.1574)`, how do we find "Gràcia"?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GEO-MATCHING: Property → Neighborhood Profile                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  OPTION 1: H3 Hexagons (FAST and scalable) ✅ RECOMMENDED                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Use Uber's H3 geospatial index (resolution 8 ≈ 0.7km hexagons)         │
│  • Pre-assign H3 cells to neighborhoods                                    │
│  • Property lookup: O(1) hash lookup                                       │
│  • Pros: Fast, scales infinitely, free library                             │
│                                                                             │
│  OPTION 2: Scraped neighborhood name (SIMPLE fallback)                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Use neighborhood name from listing: "Gràcia", "Gracia", "El Gràcia"    │
│  • Normalize and match: lowercase, remove accents, aliases                 │
│  • Pros: Simple, no geo data needed                                        │
│  • Cons: Name inconsistencies, some listings have no neighborhood          │
│                                                                             │
│  OPTION 3: Nearest centroid (LAST RESORT)                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Find closest neighborhood centroid within 2km                           │
│  • Only if H3 and name lookup both fail                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P0 Geo-Matching Implementation

```typescript
// src/lib/geo/neighborhoodMatcher.ts

import * as h3 from 'h3-js';

// In-memory lookup (loaded once at startup)
let h3ToNeighborhood: Map<string, string>;
let nameToNeighborhood: Map<string, string>;

// ════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION: Get neighborhood profile for a property
// ════════════════════════════════════════════════════════════════════════════

export async function getNeighborhoodProfile(
  lat: number,
  lon: number,
  scrapedNeighborhoodName?: string
): Promise<NeighborhoodProfile | null> {
  
  await ensureLookupLoaded();
  
  // STRATEGY 1: H3 lookup (most accurate)
  const h3Cell = h3.latLngToCell(lat, lon, 8);
  const idFromH3 = h3ToNeighborhood.get(h3Cell);
  if (idFromH3) return fetchProfile(idFromH3);
  
  // STRATEGY 2: Name lookup (fallback)
  if (scrapedNeighborhoodName) {
    const normalized = normalizeName(scrapedNeighborhoodName);
    const idFromName = nameToNeighborhood.get(normalized);
    if (idFromName) return fetchProfile(idFromName);
  }
  
  // STRATEGY 3: Nearest centroid within 2km (last resort)
  const nearest = await findNearestNeighborhood(lat, lon, 2);
  if (nearest) return nearest;
  
  // NO MATCH: Return null
  // → UI shows "Limited neighborhood data for this area"
  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents: Gràcia → Gracia
    .replace(/[^a-z0-9]/g, '')        // Remove special chars
    .trim();
}
```

### Building the H3 Lookup (One-Time Script)

```typescript
// scripts/serp-research/build-neighborhood-geo.ts

// For each neighborhood:
// 1. Get centroid from Nominatim (FREE)
// 2. Generate H3 cells in ~1km radius
// 3. Store mapping

async function buildH3LookupForCity(city: string, neighborhoods: string[]) {
  for (const hood of neighborhoods) {
    // 1. Get geo from Nominatim
    const geo = await nominatim.search(`${hood}, ${city}, Spain`);
    
    // 2. Generate H3 cells
    const centerCell = h3.latLngToCell(geo.lat, geo.lon, 8);
    const cells = h3.gridDisk(centerCell, 2);  // ~1.4km radius
    
    // 3. Store in profile
    await dynamoDB.update({
      TableName: 'leo-neighborhood-profiles',
      Key: { neighborhood_id: `${city.toLowerCase()}-${normalizeName(hood)}` },
      UpdateExpression: 'SET h3_cells = :cells, centroid_lat = :lat, centroid_lon = :lon',
      ExpressionAttributeValues: {
        ':cells': cells,
        ':lat': geo.lat,
        ':lon': geo.lon
      }
    });
  }
}
```

### What If We Don't Have Hood Scores?

```typescript
function calculateFitScore(
  wpa: WPAOutput,
  neighborhood: NeighborhoodProfile | null,  // CAN BE NULL!
  listing: ListingData,
  userProfile: UserProfile
): number {
  
  let score = 0;
  let totalWeight = 0;
  
  // WPA SCORES: Always available (we run WPA on-demand)
  for (const [dim, weight] of Object.entries(userProfile.wpaWeights)) {
    if (wpa.scores[dim] != null && weight > 0) {
      score += wpa.scores[dim] * weight;
      totalWeight += weight;
    }
  }
  
  // NEIGHBORHOOD SCORES: Only if we have coverage!
  if (neighborhood?.scores) {
    for (const [dim, weight] of Object.entries(userProfile.neighborhoodWeights)) {
      const hoodScore = neighborhood.scores[dim];
      if (hoodScore != null && weight > 0) {
        score += (hoodScore / 5 * 100) * weight;  // Convert 1-5 to 0-100
        totalWeight += weight;
      }
    }
  }
  // If no neighborhood data: only WPA scores used, less personalization
  
  // DATABASE FACTORS: Always available
  // ... commute time, price vs avg, etc.
  
  return Math.round(score / totalWeight);
}
```

---

### Table 2: `leo-neighborhood-profiles` (Aggregated per-neighborhood)

One row per neighborhood. Aggregated from all extractions. **This is what we query.**

```typescript
// Primary Key: neighborhood_id
// GSI: city_id (for city-wide queries)

interface NeighborhoodProfile {
  // Keys
  neighborhood_id: string;      // "barcelona-gracia"
  city_id: string;              // "barcelona"
  city: string;                 // "Barcelona"
  neighborhood: string;         // "Gràcia"
  aliases: string[];            // ["Gracia", "Vila de Gràcia"]
  
  // Geolocation (Critical for matching!)
  centroid_lat: number;         // 41.4036
  centroid_lon: number;         // 2.1574
  h3_cells: string[];           // ["89390cd63ffffff", ...] - H3 res 8 cells
  bounds: {                     // For geo queries (from Nominatim)
    ne_lat: number;
    ne_lng: number;
    sw_lat: number;
    sw_lng: number;
  };
  
  // === 20 AGGREGATED DIMENSION SCORES (0-100, null if insufficient data) ===
  
  scores: {
    // LIFE STAGE (5 dimensions)
    student_friendly: number | null;        // #1: Budget, nightlife, transport, roommates
    young_professional: number | null;      // #2: Dating, networking, trendy, career
    couple_friendly: number | null;         // #3: Romance, quiet evenings, date spots
    family_friendly: number | null;         // #4: Schools, parks, playgrounds, safety
    retiree_friendly: number | null;        // #5: Healthcare, quiet, accessibility
    
    // LIFESTYLE/INTEREST (9 dimensions)
    digital_nomad: number | null;           // #6: Coworking, wifi, international
    fitness_active: number | null;          // #7: Gyms, running, cycling, sports
    foodie_scene: number | null;            // #8: Restaurants, markets, variety
    nightlife_social: number | null;        // #9: Bars, clubs, dating, music
    arts_culture: number | null;            // #10: Galleries, theaters, creative
    nature_outdoor: number | null;          // #11: Parks, beach, green spaces
    pet_friendly: number | null;            // #12: Dog parks, vets, pet buildings
    lgbtq_friendly: number | null;          // #13: Gay-friendly, pride, community
    eco_conscious: number | null;           // #14: Bike lanes, recycling, green
    
    // UNIVERSAL (4 dimensions)
    safety_overall: number | null;          // #15: Crime, night safety, well-lit
    quietness: number | null;               // #16: Inverse of noise (100 = silent)
    transport_access: number | null;        // #17: Metro, bus, walkability
    vibe_score: number | null;              // #18: Overall character desirability
    
    // ECONOMIC (2 dimensions)
    gentrification_risk: number | null;     // #19: Higher = more price risk
    budget_friendly: number | null;         // #20: Higher = more affordable
  };
  
  // === CATEGORICAL DATA (for filtering & display) ===
  
  vibe: {
    primary: 'hipster' | 'traditional' | 'family' | 'international' | 'student' | 'luxury' | 'working_class' | 'mixed';
    secondary: string[];                    // Other vibes mentioned
    trending: 'up' | 'stable' | 'down';     // Is character changing?
  };
  
  demographics: {
    primary_age: 'students' | 'young_professionals' | 'couples' | 'families' | 'mixed' | 'retirees';
    secondary_ages: string[];
    income_level: 'budget' | 'middle' | 'upper' | 'luxury';
  };
  
  family: {
    school_quality: 'none' | 'basic' | 'good' | 'excellent';
    parks_density: 'none' | 'few' | 'adequate' | 'abundant';
    kid_activities: string[];               // Specific places mentioned
  };
  
  lifestyle: {
    // Specific places discovered during extraction
    coworking_spaces: string[];
    gyms: string[];
    bars_clubs: string[];
    restaurants: string[];
    galleries_theaters: string[];
    dog_parks: string[];
    lgbtq_venues: string[];
    eco_shops: string[];
  };
  
  noise: {
    level: 'silent' | 'quiet' | 'moderate' | 'noisy' | 'loud';
    sources: string[];                      // ["traffic", "nightlife", "tourists"]
    quiet_pockets: string[];                // Specific quiet streets
    worst_times: string;                    // "Weekend nights 11pm-3am"
  };
  
  safety: {
    overall: 'avoid' | 'caution' | 'fine' | 'safe' | 'very_safe';
    night_walking: 'avoid' | 'careful' | 'fine' | 'safe';
    known_issues: string[];
  };
  
  gentrification: {
    stage: 'not_started' | 'early' | 'mid' | 'advanced' | 'peaked' | 'stable';
    price_trend: 'falling' | 'stable' | 'rising' | 'rapid';
    buyer_opportunity: 'low' | 'medium' | 'high';    // Good for investment?
    renter_risk: 'low' | 'medium' | 'high';          // Risk of rent increases?
    displacement_mentioned: boolean;
  };
  
  food: {
    density: 'sparse' | 'adequate' | 'abundant';
    cuisines: string[];
    vegetarian_vegan: 'none' | 'few' | 'good' | 'excellent';
    markets: string[];
  };
  
  international: {
    expat_size: 'none' | 'small' | 'medium' | 'large';
    english_level: 'none' | 'some' | 'common' | 'widespread';
    nationalities: string[];
  };
  
  // === METADATA ===
  
  sources_count: number;         // How many pages contributed
  confidence: 'low' | 'medium' | 'high';
  last_updated: string;
  
  // === WHAT-IF SCORING IMPACTS ===
  // How much each neighborhood score changes when user's life changes
  // Range: -50 to +50 (relative adjustment to match score)
  
  whatif_impacts: {
    // Life stage changes
    kids: number;                // "What if I have kids?"
    retire: number;              // "What if I'm retiring?"
    single: number;              // "What if I'm single?"
    
    // Lifestyle changes
    dog: number;                 // "What if I get a dog?"
    wfh: number;                 // "What if I work from home?"
    fitness: number;             // "What if I want to get fit?"
    vegan: number;               // "What if I become vegan?"
    eco: number;                 // "What if sustainability matters?"
    lgbtq: number;               // "What if I want LGBTQ-friendly?"
    
    // Economic changes
    budget_tight: number;        // "What if I need to save money?"
    invest: number;              // "What if I want to invest?"
  };
}
```

### Aggregation Logic (Lambda)

```typescript
// Run after all extractions complete
async function aggregateNeighborhood(neighborhoodId: string) {
  // 1. Get all extractions for this neighborhood
  const extractions = await dynamoDB.query({
    TableName: 'leo-serp-extractions',
    KeyConditionExpression: 'neighborhood_id = :nid',
    ExpressionAttributeValues: { ':nid': neighborhoodId }
  });
  
  // 2. Calculate scores (weighted average, ignore nulls)
  const noiseScores = extractions
    .map(e => e.noise?.level)
    .filter(n => n !== null);
  
  const avgNoise = noiseScores.length > 0 
    ? noiseScores.reduce((a, b) => a + b, 0) / noiseScores.length 
    : null;
  
  // Convert 1-5 to 0-100 (inverted for quietness)
  const quietnessScore = avgNoise ? (5 - avgNoise) * 25 : null;
  
  // 3. Determine categorical values (mode/majority)
  const vibeCharacters = extractions
    .flatMap(e => e.vibe?.character_mentioned || []);
  const primaryVibe = mode(vibeCharacters) || 'mixed';
  
  // 4. Calculate What-If impacts
  const familyMentions = extractions.filter(e => e.family?.kid_friendly === true).length;
  const familyComplaints = extractions.filter(e => e.family?.kid_friendly === false).length;
  const kidsImpact = ((familyMentions - familyComplaints) / extractions.length) * 100;
  
  // 5. Geocode neighborhood center (Nominatim)
  const geo = await nominatim.search(`${neighborhood}, ${city}, Spain`);
  
  // 6. Store aggregated profile
  await dynamoDB.put({
    TableName: 'leo-neighborhood-profiles',
    Item: {
      neighborhood_id: neighborhoodId,
      // ... all aggregated fields
      scores: {
        quietness_score: quietnessScore,
        family_score: calculateFamilyScore(extractions),
        // ...
      },
      whatif_impacts: {
        kids: kidsImpact,
        // ...
      },
      sources_count: extractions.length,
      confidence: extractions.length > 10 ? 'high' : extractions.length > 3 ? 'medium' : 'low',
    }
  });
}
```

### Query Patterns (All FREE after aggregation)

```typescript
// ═══════════════════════════════════════════════════════════════════════
// LIFE STAGE QUERIES
// ═══════════════════════════════════════════════════════════════════════

// 1. "Show me family-friendly neighborhoods in Barcelona"
const familyFriendly = await dynamoDB.query({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-family-index',
  KeyConditionExpression: 'city_id = :city',
  FilterExpression: 'scores.family_friendly > :min AND scores.safety_overall > :safe',
  ExpressionAttributeValues: {
    ':city': 'barcelona',
    ':min': 70,
    ':safe': 60
  }
});

// 2. "I'm a young professional, where should I live?"
const youngProf = await dynamoDB.query({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-young-prof-index',
  KeyConditionExpression: 'city_id = :city',
  FilterExpression: 'scores.young_professional > :min',
  ExpressionAttributeValues: {
    ':city': 'madrid',
    ':min': 70
  }
});

// 3. "Best neighborhoods for retirees in Valencia"
const retirees = await dynamoDB.query({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-retiree-index',
  KeyConditionExpression: 'city_id = :city',
  FilterExpression: 'scores.retiree_friendly > :min AND scores.quietness > :quiet',
  ExpressionAttributeValues: {
    ':city': 'valencia',
    ':min': 65,
    ':quiet': 70
  }
});

// ═══════════════════════════════════════════════════════════════════════
// LIFESTYLE QUERIES
// ═══════════════════════════════════════════════════════════════════════

// 4. "Show me quiet neighborhoods good for remote work"
const wfhQuiet = await dynamoDB.scan({
  TableName: 'leo-neighborhood-profiles',
  FilterExpression: 'scores.quietness > :quiet AND scores.digital_nomad > :wfh',
  ExpressionAttributeValues: {
    ':quiet': 70,
    ':wfh': 60
  }
});

// 5. "I want to get fit - where are the gyms and running paths?"
const fitness = await dynamoDB.query({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-fitness-index',
  KeyConditionExpression: 'city_id = :city',
  FilterExpression: 'scores.fitness_active > :min',
  ExpressionAttributeValues: {
    ':city': 'barcelona',
    ':min': 70
  }
});

// 6. "LGBTQ-friendly neighborhoods in Madrid"
const lgbtq = await dynamoDB.query({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-lgbtq-index',
  KeyConditionExpression: 'city_id = :city',
  FilterExpression: 'scores.lgbtq_friendly > :min',
  ExpressionAttributeValues: {
    ':city': 'madrid',
    ':min': 70
  }
});

// 7. "Eco-friendly neighborhoods with good bike infrastructure"
const eco = await dynamoDB.query({
  TableName: 'leo-neighborhood-profiles',
  IndexName: 'city-eco-index',
  KeyConditionExpression: 'city_id = :city',
  FilterExpression: 'scores.eco_conscious > :min AND scores.transport_access > :transport',
  ExpressionAttributeValues: {
    ':city': 'barcelona',
    ':min': 65,
    ':transport': 70
  }
});

// ═══════════════════════════════════════════════════════════════════════
// WHAT-IF SCENARIO QUERIES
// ═══════════════════════════════════════════════════════════════════════

// 8. "What-if I have kids - how do my saved neighborhoods rank?"
const savedNeighborhoods = ['barcelona-gracia', 'barcelona-eixample', 'barcelona-poblenou'];
const profiles = await Promise.all(
  savedNeighborhoods.map(id => dynamoDB.get({
    TableName: 'leo-neighborhood-profiles',
    Key: { neighborhood_id: id }
  }))
);

// Re-rank by family_friendly + whatif_impacts.kids
const rerankedForKids = profiles.Item
  .map(p => ({
    ...p,
    original_score: calculateUserFit(p, userProfile),
    adjusted_score: calculateUserFit(p, userProfile) + p.whatif_impacts.kids
  }))
  .sort((a, b) => b.adjusted_score - a.adjusted_score);

// 9. "What if I get a dog?"
const rerankedForDog = profiles.Item
  .map(p => ({
    ...p,
    original_score: calculateUserFit(p, userProfile),
    adjusted_score: calculateUserFit(p, userProfile) + p.whatif_impacts.dog,
    dog_parks: p.lifestyle.dog_parks  // Show specific places
  }))
  .sort((a, b) => b.adjusted_score - a.adjusted_score);

// 10. "What if I want to work from home full-time?"
const rerankedForWFH = profiles.Item
  .map(p => ({
    ...p,
    original_score: calculateUserFit(p, userProfile),
    adjusted_score: calculateUserFit(p, userProfile) + p.whatif_impacts.wfh,
    coworking: p.lifestyle.coworking_spaces  // Show specific places
  }))
  .sort((a, b) => b.adjusted_score - a.adjusted_score);

// ═══════════════════════════════════════════════════════════════════════
// MULTI-DIMENSION QUERIES
// ═══════════════════════════════════════════════════════════════════════

// 11. "I'm a vegan digital nomad who likes nightlife but wants quiet at home"
const complexQuery = await dynamoDB.scan({
  TableName: 'leo-neighborhood-profiles',
  FilterExpression: `
    scores.digital_nomad > :wfh AND 
    scores.nightlife_social > :nightlife AND 
    scores.quietness > :quiet AND 
    food.vegetarian_vegan IN (:vegan1, :vegan2)
  `,
  ExpressionAttributeValues: {
    ':wfh': 60,
    ':nightlife': 50,
    ':quiet': 60,
    ':vegan1': 'good',
    ':vegan2': 'excellent'
  }
});

// 12. Geo query: "Neighborhoods within 5km of my work"
// (Using Nominatim for initial geocode, then DynamoDB bounds filter)
const workCoords = await nominatim.geocode('Carrer de Pau Claris 50, Barcelona');
const nearWork = await dynamoDB.scan({
  TableName: 'leo-neighborhood-profiles',
  FilterExpression: `
    bounds.sw_lat < :ne_lat AND bounds.ne_lat > :sw_lat AND
    bounds.sw_lng < :ne_lng AND bounds.ne_lng > :sw_lng
  `,
  ExpressionAttributeValues: {
    ':ne_lat': workCoords.lat + 0.045,  // ~5km
    ':sw_lat': workCoords.lat - 0.045,
    ':ne_lng': workCoords.lng + 0.060,
    ':sw_lng': workCoords.lng - 0.060
  }
});
```

### GSI (Global Secondary Indexes) Needed (20 Dimensions)

**Core GSIs (most common queries):**

| GSI Name | Partition Key | Sort Key | Use Case |
|----------|---------------|----------|----------|
| `city-family-index` | city_id | scores.family_friendly | "Family-friendly neighborhoods in Barcelona" |
| `city-safety-index` | city_id | scores.safety_overall | "Safest neighborhoods in Madrid" |
| `city-quietness-index` | city_id | scores.quietness | "Quietest neighborhoods in Valencia" |
| `city-nightlife-index` | city_id | scores.nightlife_social | "Best nightlife in Sevilla" |
| `city-budget-index` | city_id | scores.budget_friendly | "Affordable neighborhoods in Bilbao" |
| `gentrification-index` | gentrification.stage | city_id | Investment opportunities |

**Lifestyle GSIs (for What-If scenarios):**

| GSI Name | Partition Key | Sort Key | What-If |
|----------|---------------|----------|---------|
| `city-student-index` | city_id | scores.student_friendly | "What if I'm on a student budget?" |
| `city-young-prof-index` | city_id | scores.young_professional | "What if I want to meet people?" |
| `city-retiree-index` | city_id | scores.retiree_friendly | "What if I'm retiring?" |
| `city-digital-nomad-index` | city_id | scores.digital_nomad | "What if I WFH full-time?" |
| `city-fitness-index` | city_id | scores.fitness_active | "What if I want to get fit?" |
| `city-pet-index` | city_id | scores.pet_friendly | "What if I get a dog?" |
| `city-lgbtq-index` | city_id | scores.lgbtq_friendly | "What if I want LGBTQ-friendly?" |
| `city-eco-index` | city_id | scores.eco_conscious | "What if sustainability matters?" |
| `city-culture-index` | city_id | scores.arts_culture | "What if I want cultural activities?" |
| `city-nature-index` | city_id | scores.nature_outdoor | "What if I want green spaces?" |

**Note:** DynamoDB supports 20 GSIs per table, which aligns with our 20 dimensions.

### Cities to Cover (10) - Tiered Query Allocation

| Tier | City | ~Neighborhoods | Queries/Neighborhood | Total Queries |
|------|------|----------------|----------------------|---------------|
| **TIER 1** | Barcelona | 73 | 10 | 730 |
| **TIER 1** | Madrid | 50 | 10 | 500 |
| *Subtotal* | | | | **1,230** |
| **TIER 2** | Valencia | 30 | 7 | 210 |
| **TIER 2** | Sevilla | 25 | 7 | 175 |
| **TIER 2** | Málaga | 25 | 7 | 175 |
| **TIER 2** | Bilbao | 20 | 7 | 140 |
| *Subtotal* | | | | **700** |
| **TIER 3** | San Sebastián | 15 | 5 | 75 |
| **TIER 3** | Palma | 20 | 5 | 100 |
| **TIER 3** | Alicante | 20 | 5 | 100 |
| **TIER 3** | Granada | 15 | 5 | 75 |
| *Subtotal* | | | | **350** |
| **TOTAL** | 10 cities | ~293 | - | **2,280** |

**Budget remaining: 4,200 - 2,280 = 1,920 queries** for:
- City-level research (schools ranking, crime stats, major events)
- Priority neighborhood deep-dives (hottest 10-20 neighborhoods)
- Follow-up queries for thin-data neighborhoods
- Future city expansion (Zaragoza, Murcia, Gijón, etc.)

---

### Corrected Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 0: PRE-COMPUTATION (Run ONCE with €1k credits)                   │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  A. Airbnb Review Analysis (€14 one-time)                               │
│     └── Tag all 5M reviews: noise/smell/safety/vibe                     │
│     └── Store tags in airbnb_reviews_tagged table                       │
│                                                                         │
│  B. Neighborhood Profiles (FREE - SQL aggregation)                      │
│     └── Aggregate tagged reviews per neighborhood                       │
│     └── Calculate noise_score, safety_score, vibe_score                 │
│                                                                         │
│  C. Cadastre Enrichment (FREE - Gov API)                                │
│     └── Look up all properties                                          │
│     └── Store year_built, official_m2                                   │
│                                                                         │
│  D. Rental Yield Calculation (FREE - our own data)                      │
│     └── Match sale listings to nearby rent listings                     │
│     └── Calculate gross yield %                                         │
│                                                                         │
│  E. Price Anomaly Detection (FREE - SQL)                                │
│     └── Compare each listing to neighborhood average                    │
│                                                                         │
│  Result: leo-listings-enriched, queryable for FREE                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Key Insight for Founders

> **€0.05/property for browse = sustainable**
> **€0.40/property for saved = acceptable (limited saves)**
> **€5+/property for deep dive = PAID PRODUCT (they pay €29-99)**
>
> **PRE-COMPUTE EVERYTHING YOU CAN.**
> - Cadastre, neighborhood stats, rental yield, price anomalies = FREE
> - Run nightly on new listings
> - User queries become simple DynamoDB scans
> - No AI needed for 80% of filtering
>
> The expensive AI (WPA, clustering) only runs when USER REQUESTS IT.

### WPA: Recommendation vs Full Analysis

| Type | Use Case | Photos | Model | Cost | Time |
|------|----------|--------|-------|------|------|
| **WPA (all use cases)** | Fit scoring, vibe-check, recs | 30 | **Flash-Lite** | **$0.003** | ~15s |

> **Note**: WPA uses Flash-Lite ($0.003/listing) for all use cases - vibe-check, recommendations, and analysis.

---

## 📸 WPA V0 Specification: 2-Step Pipeline + Personalized Explanation

### Philosophy: Describe First, Score Second

WPA uses a **2-step pipeline**:
1. **Step 1 (Describe)**: LLM looks at photos + listing info → writes prose descriptions
2. **Step 2 (Score)**: LLM reads its own descriptions → outputs numeric scores

Then for display to users:
3. **Step 3 (Explain)**: Ultra-cheap LLM reads descriptions + fit score + user profile → writes personalized "why this works for you"

### The 3-Step WPA + Fit Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: DESCRIBE (LLM sees photos + listing info)                          │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Input: Photos (3-5 for Instant, 30 for Full) + Listing text               │
│  Model: Claude Haiku (Instant) or Gemini 3 Pro (Full)                      │
│  Cost: ~$0.01 (Instant) or ~$0.20 (Full)                                   │
│                                                                             │
│  Output: Prose descriptions for each category                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   "light": "Living room has large south-facing windows, but the     │   │
│  │            bedroom faces an internal courtyard - noticeably darker. │   │
│  │            Kitchen has a small window above sink.",                  │   │
│  │   "layout": "Open plan living/kitchen flows well, but bedroom is    │   │
│  │             accessed through living room - privacy concern...",     │   │
│  │   "kitchen": "Galley kitchen, recently updated. Gas cooktop,        │   │
│  │              electric oven, no dishwasher but space for one...",    │   │
│  │   "bathroom": "Single bathroom with shower over tub. Original 90s   │   │
│  │               pink tiles - dated but clean...",                     │   │
│  │   "bedroom": "Fits queen bed with nightstands. Built-in wardrobe -  │   │
│  │              decent for one, tight for two...",                     │   │
│  │   "condition": "Mixed - kitchen renovated last 5 years, bathroom    │   │
│  │                original 90s, floors worn parquet...",               │   │
│  │   "outdoor": "Balcony ~3m x 1.5m, faces street. Table for 2 fits.  │   │
│  │              Afternoon sun, some traffic noise likely.",            │   │
│  │   "storage": "Wardrobe in bedroom, coat closet by entrance. No      │   │
│  │              dedicated storage room. Tight for two people.",        │   │
│  │   "vibe": "Trying to be modern-minimal but on budget. White         │   │
│  │           everything, IKEA furniture. Clean but not cozy.",         │   │
│  │   "wfh": "No dedicated office. Dining table by window could work    │   │
│  │          for one person. Nowhere for a second.",                    │   │
│  │   "safety": "Balcony rail is waist-height, child-safe. No obvious   │   │
│  │             trip hazards. Stairs to building entrance.",            │   │
│  │   "overall": "Functional 2BR, partially updated. Best for single    │   │
│  │              or couple without kids. Light is standout feature."    │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: SCORE (Same LLM reads descriptions → outputs scores)               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Input: The descriptions from Step 1                                        │
│  Model: Same as Step 1 (Haiku or Gemini 3 Pro)                             │
│  Cost: ~$0.005 (text-only, no images)                                      │
│                                                                             │
│  Prompt: "Based on your descriptions above, score each dimension 0-100"    │
│                                                                             │
│  Output: Numeric scores + highlights + concerns + flags                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   "scores": {                                                        │   │
│  │     "natural_light": 72,        // Good in living, dark bedroom     │   │
│  │     "layout_functionality": 55, // Privacy concern                   │   │
│  │     "kitchen_usability": 65,    // Galley but updated               │   │
│  │     "bathroom_quality": 40,     // Dated 90s                        │   │
│  │     "bedroom_comfort": 60,      // Queen fits, storage tight        │   │
│  │     "condition_overall": 55,    // Mixed state                      │   │
│  │     "outdoor_space": 50,        // Small, street-facing             │   │
│  │     "storage": 40,              // Limited                          │   │
│  │     "cozy_potential": 35,       // Sterile vibe                     │   │
│  │     "wfh_suitability": 45,      // Only dining table                │   │
│  │     "privacy": 50,              // Bedroom through living           │   │
│  │     "overall_livability": 55    // Functional but flaws             │   │
│  │   },                                                                 │   │
│  │   "highlights": [                                                    │   │
│  │     "Great natural light in living room",                           │   │
│  │     "Recently renovated kitchen",                                   │   │
│  │     "Quiet courtyard-facing bedroom"                                │   │
│  │   ],                                                                 │   │
│  │   "concerns": [                                                      │   │
│  │     "Dated bathroom needs updating",                                │   │
│  │     "No privacy - bedroom through living room",                     │   │
│  │     "Limited storage for two people"                                │   │
│  │   ],                                                                 │   │
│  │   "red_flags": {                                                     │   │
│  │     "cubicle_bathroom": false,                                      │   │
│  │     "mezzanine_ladder": false,                                      │   │
│  │     "needs_full_renovation": false,                                 │   │
│  │     "child_hazards": [],                                            │   │
│  │     "elderly_hazards": ["stairs_to_building"]                       │   │
│  │   }                                                                  │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Fit Scoring (FREE, algorithmic)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FIT SCORING (Algorithmic - No LLM)                                         │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Input: WPA scores + User profile weights                                   │
│  Cost: FREE                                                                 │
│                                                                             │
│  Output: Fit score + breakdown                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   "fit_score": 68,                                                   │   │
│  │   "pass": true,                                                      │   │
│  │   "top_matches": ["natural_light", "kitchen_usability"],            │   │
│  │   "concerns_for_user": ["wfh_suitability", "storage"]               │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: PERSONALIZED EXPLANATION (Ultra-cheap LLM)                         │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Input: WPA descriptions + Fit score + User profile summary                 │
│  Model: Gemini 2.5 Flash-lite (~$0.003) or GPT-4o-mini (~$0.002)           │
│  When: Run when user views property page (or batch for recommendations)     │
│                                                                             │
│  Prompt:                                                                    │
│  "Write 2-3 sentences explaining why this property suits (or doesn't       │
│   suit) this user. Be specific and honest about trade-offs.                │
│                                                                             │
│   User profile: Works from home, prioritizes light, cooking, quiet         │
│   Fit score: 68/100 (Good match)                                           │
│   WPA highlights: Great living room light, renovated kitchen               │
│   WPA concerns: Dated bathroom, bedroom through living room                │
│   Top matches: light, kitchen                                              │
│   Concerns for user: WFH space, storage"                                   │
│                                                                             │
│  Output:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  "This place hits your two big priorities: the south-facing living  │   │
│  │   room is flooded with light, and the recently renovated kitchen    │   │
│  │   has plenty of counter space for cooking. The catch? You'd be      │   │
│  │   working from the dining table since there's no dedicated office,  │   │
│  │   and the bedroom is accessed through the living room - awkward     │   │
│  │   if you're on a call while your partner wants to nap."             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DISPLAY: Show this on property page as "Why this might work for you"      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost Breakdown: WPA Pipeline (Flash-Lite)

| Step | Cost | Notes |
|------|------|-------|
| **Step 1: Describe** | ~$0.002 | Flash-Lite, 30 photos |
| **Step 2: Score** | ~$0.001 | Text-only scoring |
| **Step 3: Explain** | ~$0.001 | Flash-Lite summary |
| **Fit Scoring** | FREE | Algorithmic |
| **TOTAL** | **~$0.003** | |

### When WPA Runs

| Trigger | When |
|---------|------|
| **Vibe-check** | During call |
| **Recommendations** | 3x daily cron batch |
| **Property page** | On first view (then cached) |

**Caching**: WPA results are cached per listing, reused across all users.

### API Endpoints

```typescript
// POST /api/wpa/describe
// Step 1: Describe photos
interface DescribeRequest {
  listing_id: string;
  photos: string[];        // URLs
  listing_info: string;    // Price, m², beds, location
  mode: 'instant' | 'full';
}
interface DescribeResponse {
  descriptions: {
    light: string;
    layout: string;
    kitchen: string;
    bathroom: string;
    bedroom: string;
    condition: string;
    outdoor: string;
    storage: string;
    vibe: string;
    wfh: string;
    safety: string;
    overall: string;
  };
}

// POST /api/wpa/score
// Step 2: Score based on descriptions
interface ScoreRequest {
  listing_id: string;
  descriptions: DescribeResponse['descriptions'];
  mode: 'instant' | 'full';
}
interface ScoreResponse {
  scores: Record<string, number>;  // 12 core scores, 0-100
  highlights: string[];
  concerns: string[];
  red_flags: {
    cubicle_bathroom: boolean;
    mezzanine_ladder: boolean;
    needs_full_renovation: boolean;
    child_hazards: string[];
    elderly_hazards: string[];
  };
}

// POST /api/wpa/explain
// Step 3: Personalized explanation
interface ExplainRequest {
  descriptions: DescribeResponse['descriptions'];
  scores: ScoreResponse['scores'];
  fit_score: number;
  user_summary: string;      // "Works from home, prioritizes light, cooking"
  top_matches: string[];
  concerns_for_user: string[];
}
interface ExplainResponse {
  explanation: string;       // 2-3 sentences for property page
}
```

### WPA Output Structure (Final - 35 Dimensions)

```typescript
interface WPAOutput {
  // ═══════════════════════════════════════════════════════════════════
  // FROM STEP 1: DESCRIPTIONS (Grouped Prose - captures all nuance)
  // ═══════════════════════════════════════════════════════════════════
  
  descriptions: {
    light_air: string;           // Group 1: Light, windows, air, ceiling
    layout_flow: string;         // Group 2: Flow, rooms, functionality
    kitchen: string;             // Group 3: Cooking, appliances, eating
    bathroom: string;            // Group 4: Bath, shower, condition
    bedroom: string;             // Group 5: Size, closet, light, privacy
    condition_finish: string;    // Group 6: Renovation, floors, aesthetic
    comfort_lifestyle: string;   // Group 7: Cozy, WFH, outdoor, storage
    safety_hazards: string;      // Cross-cutting safety assessment
    red_flags_noted: string;     // Any instant-rejection issues
    overall_summary: string;     // Who this is for, trade-offs
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // FROM STEP 2: ALL 35 DIMENSION SCORES (for fit algorithm)
  // ═══════════════════════════════════════════════════════════════════
  
  scores: {
    // LIGHT & AIR (6)
    natural_light_intensity: number | null;
    light_distribution: number | null;
    light_quality: number | null;
    cross_ventilation: number | null;
    ceiling_height: number | null;
    window_quality: number | null;
    
    // LAYOUT & FLOW (10)
    entrance_experience: number | null;
    kitchen_living_relationship: number | null;
    bathroom_privacy: number | null;
    bedroom_seclusion: number | null;
    flow_for_movement: number | null;
    flow_for_entertaining: number | null;
    dead_space_efficiency: number | null;
    furniture_feasibility: number | null;
    two_person_living: number | null;
    real_walls_vs_separators: number | null;
    
    // KITCHEN (6)
    counter_space: number | null;
    appliance_quality: number | null;
    kitchen_storage: number | null;
    cooking_ventilation: number | null;
    kitchen_workflow: number | null;
    eating_area: number | null;
    
    // BATHROOM (4)
    bathroom_functionality: number | null;
    bathroom_condition: number | null;
    bathroom_storage: number | null;
    bathroom_for_two: number | null;
    
    // BEDROOM (4)
    bedroom_size: number | null;
    closet_storage: number | null;
    bedroom_light: number | null;
    bedroom_privacy: number | null;
    
    // CONDITION & FINISH (5)
    renovation_state: number | null;
    maintenance_quality: number | null;
    floor_condition: number | null;
    finish_quality: number | null;
    aesthetic_vibe: number | null;
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // COMFORT EXTRAS (scored separately for lifestyle matching)
  // ═══════════════════════════════════════════════════════════════════
  
  comfort_extras: {
    cozy_corner_potential: number | null;
    wfh_suitability: number | null;
    outdoor_space_quality: number | null;
    storage_total: number | null;
    guest_accommodation: number | null;
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // HOUSE SHARE SCORES (if is_house_share: true)
  // ═══════════════════════════════════════════════════════════════════
  
  house_share_scores?: {
    private_room_size: number;
    private_room_lockable: number;
    shared_kitchen_quality: number;
    shared_bathroom_situation: number;
    shared_living_comfort: number;
    personal_storage: number;
    noise_between_rooms: number;
    guest_friendliness: number;
    kitchen_time_conflicts: number;
    overall_house_share_vibe: number;
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // HIGHLIGHTS & CONCERNS
  // ═══════════════════════════════════════════════════════════════════
  
  highlights: string[];    // Top 3-5 best features
  concerns: string[];      // Issues/trade-offs
  
  // ═══════════════════════════════════════════════════════════════════
  // RED FLAGS (binary - instant dealbreakers)
  // ═══════════════════════════════════════════════════════════════════
  
  red_flags: {
    cubicle_bathroom: boolean;
    mezzanine_ladder: boolean;
    needs_full_renovation: boolean;
    ground_floor_exposed: boolean;
    is_house_share: boolean;
  };
  
  safety: {
    child_hazards: string[];
    elderly_hazards: string[];
    pet_hazards: string[];
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════
  
  meta: {
    mode: 'instant' | 'full';
    model_used: string;
    photos_analyzed: number;
    confidence: 'low' | 'medium' | 'high';
    created_at: string;
  };
}
```

### Personalized Explanation Display (Property Page)

```tsx
// On property page, show to user:
<Card className="bg-blue-50 border-blue-200">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <Sparkles className="h-5 w-5 text-blue-500" />
      Why this might work for you
    </CardTitle>
    <Badge variant={fitScore >= 70 ? "success" : fitScore >= 50 ? "warning" : "destructive"}>
      {fitScore}% match
    </Badge>
  </CardHeader>
  <CardContent>
    <p className="text-gray-700">
      {/* Step 3 output */}
      "This place hits your two big priorities: the south-facing living
       room is flooded with light, and the recently renovated kitchen
       has plenty of counter space for cooking. The catch? You'd be
       working from the dining table since there's no dedicated office,
       and the bedroom is accessed through the living room - awkward
       if you're on a call while your partner wants to nap."
    </p>
  </CardContent>
</Card>
```

---

### The 35 WPA Dimensions (Full Nuanced Assessment)

**Organized into 7 groups with group-level descriptions + individual dimension scores.**

#### Group 1: 🌅 LIGHT & AIR (6 dimensions)

**Group Description**: Overall light and air quality throughout the property - how bright, airy, and well-ventilated it feels.

| # | Dimension | What to Describe & Score | 0 = | 100 = |
|---|-----------|--------------------------|-----|-------|
| 1 | `natural_light_intensity` | How much natural light floods in overall | Dark cave | Flooded with light |
| 2 | `light_distribution` | How evenly light reaches all rooms | One bright room, rest dark | All rooms well-lit |
| 3 | `light_quality` | Direction (north=cool, south=warm), harshness, time variations | North-facing only, harsh | Multiple exposures, pleasant |
| 4 | `cross_ventilation` | Windows on opposite sides, airflow potential | No airflow possible | Great cross-breeze |
| 5 | `ceiling_height` | How the height feels - oppressive, standard, or airy | Oppressive <2.3m | Soaring >3m or double-height |
| 6 | `window_quality` | Modern/drafty, double-glazed, noise isolation | Old single-pane, drafty | Modern double-glazed |

#### Group 2: 🏠 LAYOUT & FLOW (10 dimensions)

**Group Description**: How the space is organized, flows, and functions for daily living.

| # | Dimension | What to Describe & Score | 0 = | 100 = |
|---|-----------|--------------------------|-----|-------|
| 7 | `entrance_experience` | First impression, entryway vs straight into room | Straight into living room | Grand entry with storage |
| 8 | `kitchen_living_relationship` | Open plan vs separate, smell isolation | Cooking smells everywhere | Well-separated or good extraction |
| 9 | `bathroom_privacy` | Guest access, through bedroom?, isolation | Through bedroom, awkward | Private, well-isolated |
| 10 | `bedroom_seclusion` | Can close off from living noise | Bed visible from living | Separate wing/zone |
| 11 | `flow_for_movement` | Natural circulation, no bottlenecks | Awkward corridors | Intuitive flow |
| 12 | `flow_for_entertaining` | Can people gather, circulate at parties | Everyone crammed in one spot | Natural gathering with flow |
| 13 | `dead_space_efficiency` | Wasted corridors, unusable corners | Lots of wasted m² | Every m² usable |
| 14 | `furniture_feasibility` | Can normal furniture fit sensibly | Sofa won't fit, bed blocks door | Anything fits |
| 15 | `two_person_living` | Can two people coexist (kitchen, bathroom) | Constantly bumping into each other | Two can comfortably be anywhere |
| 16 | `real_walls_vs_separators` | Actual walls vs cubicle/glass/partial separators | Cubicle bathroom, gaps above walls | All real full-height walls |

#### Group 3: 🍳 KITCHEN (6 dimensions)

**Group Description**: Everything about cooking, food prep, and eating at home.

| # | Dimension | What to Describe & Score | 0 = | 100 = |
|---|-----------|--------------------------|-----|-------|
| 17 | `counter_space` | Workspace for meal prep | Nowhere to put a cutting board | Chef-level counter space |
| 18 | `appliance_quality` | Oven type, fridge size, dishwasher, condition | Hotplate only | Full modern suite |
| 19 | `kitchen_storage` | Cabinets, pantry, organization | Almost no storage | Abundant cabinets + pantry |
| 20 | `cooking_ventilation` | Hood, extractor, window for smells | No extraction, smells everywhere | Powerful hood + window |
| 21 | `kitchen_workflow` | Fridge-sink-stove triangle, efficiency | Everything in wrong places | Perfect efficient workflow |
| 22 | `eating_area` | Where you eat daily - counter, table, dining room | No eating spot | Dedicated dining + casual options |

#### Group 4: 🛁 BATHROOM (4 dimensions)

**Group Description**: Bathroom functionality, comfort, and condition.

| # | Dimension | What to Describe & Score | 0 = | 100 = |
|---|-----------|--------------------------|-----|-------|
| 23 | `bathroom_functionality` | Shower/tub/both, usability, water pressure hints | Cramped shower-only | Separate tub + shower |
| 24 | `bathroom_condition` | Age, renovation state, cleanliness visible | 1970s original, worn | Recently renovated, modern |
| 25 | `bathroom_storage` | Vanity, cabinets, shelving | Nowhere to put toiletries | Abundant storage |
| 26 | `bathroom_for_two` | Can two people get ready? Two sinks? Space? | One person at a time | Two sinks, plenty of space |

#### Group 5: 🛏️ BEDROOM (4 dimensions)

**Group Description**: Sleeping comfort, dressing, and bedroom-specific considerations.

| # | Dimension | What to Describe & Score | 0 = | 100 = |
|---|-----------|--------------------------|-----|-------|
| 27 | `bedroom_size` | What bed fits, space around it | Single only, cramped | King with nightstands + space |
| 28 | `closet_storage` | Wardrobe, closet space for 1-2 people | No closet | Walk-in for two |
| 29 | `bedroom_light` | Morning light, blackout potential, control | East-facing blazing sun, no control | Controllable, pleasant |
| 30 | `bedroom_privacy` | Noise from living, street, overlooked | Hear everything, overlooked | Silent, private |

#### Group 6: 🏗️ CONDITION & FINISH (5 dimensions)

**Group Description**: Overall state of repair, renovation, and aesthetic finish.

| # | Dimension | What to Describe & Score | 0 = | 100 = |
|---|-----------|--------------------------|-----|-------|
| 31 | `renovation_state` | How recently updated, what needs work | Untouched for decades | Brand new / full reno |
| 32 | `maintenance_quality` | Cracks, water damage, wear, care | Falling apart | Pristine |
| 33 | `floor_condition` | Type, wear, consistency | Damaged, mismatched | Beautiful, well-maintained |
| 34 | `finish_quality` | Fixtures, fittings, materials quality | Cheap, dated | High-quality finishes |
| 35 | `aesthetic_vibe` | Style, warmth, character | Sterile/dated/ugly | Beautiful, characterful |

#### Additional: 🏠 HOUSE SHARE (if applicable)

When property is a house share, also assess these 10:

| # | Dimension | 0 = | 100 = |
|---|-----------|-----|-------|
| HS1 | `private_room_size` | Tiny, cramped | Spacious |
| HS2 | `private_room_lockable` | No lock | Proper lock |
| HS3 | `shared_kitchen_quality` | Cramped, dirty | Spacious, clean |
| HS4 | `shared_bathroom_situation` | 5+ sharing one | En-suite or 2:1 ratio |
| HS5 | `shared_living_comfort` | No common area | Welcoming living room |
| HS6 | `personal_storage` | Nowhere for your stuff | Dedicated shelves/cabinet |
| HS7 | `noise_between_rooms` | Hear everything | Well-insulated |
| HS8 | `guest_friendliness` | Can't bring anyone | Private guest access |
| HS9 | `kitchen_time_conflicts` | Constant conflicts | Space for 2+ cooking |
| HS10 | `overall_house_share_vibe` | Would hate living here | Would enjoy it |

#### Cross-Cutting: 🛋️ COMFORT & LIFESTYLE (assessed across all photos)

| Aspect | What to Describe | Captures |
|--------|------------------|----------|
| `cozy_corners` | TV watching spot, reading nook, relaxation areas | Where you'd actually hang out |
| `wfh_setup` | Dedicated office?, desk options, video call backgrounds | Work from home viability |
| `outdoor_space` | Balcony/terrace: size, overlooks what, sun, usable? | Outdoor living potential |
| `outdoor_security` | Can leave open when away?, ground floor?, rails | Security/child safety |
| `storage_total` | All storage: closets, pantry, seasonal, overflow | Where life accumulates |
| `guest_accommodation` | Where would guests sleep/stay? | Hosting potential |

#### Safety & Red Flags (Binary - Not Scored)

| Red Flag | Detect If | Instant Effect |
|----------|-----------|----------------|
| `cubicle_bathroom` | Bathroom is fake-wall cube in room | Dealbreaker for most |
| `mezzanine_ladder` | Bed accessed by ladder only | Safety issue, lifestyle limitation |
| `needs_full_renovation` | Uninhabitable without major work | Buyer-only consideration |
| `ground_floor_exposed` | Passersby can see directly in | Privacy dealbreaker |
| `is_house_share` | Shared with strangers | Routes to house share assessment |
| `child_hazards: [...]` | List: climbable rails, gaps, stairs, corners | Parent filter |
| `elderly_hazards: [...]` | List: trip hazards, no grab bars, steps | Accessibility filter |
| `pet_hazards: [...]` | List: balcony gaps, escape routes | Pet owner filter |

---

### Fit Scoring: ALL Data Sources

**Fit Scoring combines WPA + Neighborhood Research + Database + User Profile:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FIT SCORING: ALL INPUTS                                                    │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  FROM WPA (35 dimensions from photos):                                      │
│  ├── Light & Air scores (6)                                                │
│  ├── Layout & Flow scores (10)                                             │
│  ├── Kitchen scores (6)                                                    │
│  ├── Bathroom scores (4)                                                   │
│  ├── Bedroom scores (4)                                                    │
│  ├── Condition scores (5)                                                  │
│  ├── Comfort & Lifestyle observations                                      │
│  └── Red flags & safety hazards                                            │
│                                                                             │
│  FROM NEIGHBORHOOD RESEARCH (20 dimensions from SERP/Airbnb):              │
│  ├── Life stage scores: student, young_prof, family, retiree (5)          │
│  ├── Lifestyle scores: digital_nomad, fitness, foodie, nightlife... (9)   │
│  ├── Universal: safety, quietness, transport, vibe (4)                    │
│  └── Economic: gentrification, budget_level (2)                           │
│                                                                             │
│  FROM DATABASE (pre-computed):                                              │
│  ├── Cadastre: official_m2, year_built, floor                             │
│  ├── Price: price_vs_neighborhood, is_undervalued                         │
│  ├── Rental yield: estimated_rent, gross_yield_pct                        │
│  ├── Commute: isochrone_time_to_work                                      │
│  └── Listing basics: price, m², bedrooms, bathrooms                       │
│                                                                             │
│  FROM USER PROFILE (from Psychologist):                                     │
│  ├── Weights for each WPA dimension (0-2)                                  │
│  ├── Weights for each neighborhood dimension (0-2)                         │
│  ├── Dealbreakers (instant fail)                                           │
│  ├── Must-haves (minimum thresholds)                                       │
│  └── Life situation: has_children, wfh, budget, etc.                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FIT SCORE CALCULATION (Algorithmic - FREE)                                 │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. CHECK DEALBREAKERS (instant fail):                                      │
│     - WPA red flags vs user dealbreakers                                   │
│     - Safety flags vs user situation (kids, elderly)                       │
│     - Price/budget violations                                              │
│                                                                             │
│  2. CHECK MUST-HAVES (minimum thresholds):                                  │
│     - WPA scores vs user minimums                                          │
│     - Neighborhood scores vs user minimums                                 │
│     - Commute time vs user maximum                                         │
│                                                                             │
│  3. WEIGHTED AVERAGE:                                                       │
│     score = Σ(dimension_score × user_weight) / Σ(user_weight)              │
│     - All 35 WPA dimensions                                                │
│     - All 20 neighborhood dimensions                                       │
│     - Database factors (price value, commute, etc.)                        │
│                                                                             │
│  4. ADJUSTMENTS:                                                            │
│     - Bonus for exceeding priorities                                       │
│     - Penalty for concerns matching sensitivities                          │
│                                                                             │
│  OUTPUT: { fit_score: 72, pass: true, breakdown: {...} }                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Personalized Explanation: Uses EVERYTHING

**Step 3 (Explain) receives ALL context to generate the personalized "Why this works for you":**

```typescript
// POST /api/wpa/explain
interface ExplainRequest {
  // FROM WPA
  wpa_descriptions: {
    light: string;
    layout: string;
    kitchen: string;
    // ... all 12 prose descriptions
  };
  wpa_scores: Record<string, number>;  // All 35 dimension scores
  wpa_highlights: string[];
  wpa_concerns: string[];
  
  // FROM NEIGHBORHOOD RESEARCH
  neighborhood: {
    name: string;
    vibe: string;
    scores: Record<string, number>;  // All 20 dimension scores
  };
  
  // FROM DATABASE
  listing: {
    price: number;
    m2: number;
    price_vs_neighborhood: number;    // +5% above avg
    commute_to_work: number;          // 25 minutes
    year_built: number;
    rental_yield?: number;            // For buyers
  };
  
  // FROM FIT SCORING
  fit_score: number;
  top_matches: string[];              // Which dimensions scored highest
  concerns_for_user: string[];        // Which dimensions are weak for THIS user
  
  // USER CONTEXT
  user_summary: string;               // "Works from home, prioritizes light, has a dog"
  user_priorities: string[];          // ["natural_light", "wfh_potential", "pet_friendly"]
}

// Output: Personalized 2-3 sentence explanation
interface ExplainResponse {
  explanation: string;
}
```

### Example Personalized Explanation (Full Context)

```typescript
// User: "Remote worker, prioritizes light and quiet, has a dog, budget €1,200"

const explanation = `
This bright 2BR in Gràcia (€1,150/month - 4% below neighborhood average) hits 
your top priorities: the south-facing living room scores 85/100 for light, and 
Gràcia's neighborhood quietness score of 72 means you'll have a peaceful WFH 
environment. The small balcony overlooks a courtyard - perfect for your dog to 
get fresh air, and there's a dog park 5 minutes away. The catch? The dated 90s 
bathroom (condition: 40/100) will feel tired, and storage is limited if you 
accumulate stuff. At 22 minutes to your office, it's within your commute limit.
`;
```

**The explanation weaves together:**
- WPA scores ("light scores 85/100")
- WPA prose ("south-facing living room", "dated 90s bathroom")
- Neighborhood scores ("quietness score of 72")
- Neighborhood research ("dog park 5 minutes away")
- Database data ("€1,150 - 4% below average", "22 minutes to office")
- User priorities ("your top priorities", "your dog", "your commute limit")

### WPA Prompts (2-Step)

#### Step 1 Prompt: Describe (Grouped Prose)

```typescript
const DESCRIBE_PROMPT = `
Look at these property photos and write detailed descriptions.
Capture ALL nuance - don't force into arbitrary categories.

LISTING CONTEXT: ${listingInfo}

Write prose descriptions for these 7 GROUPS:

═══════════════════════════════════════════════════════════════
GROUP 1: LIGHT & AIR
Describe: How much natural light? Which rooms bright vs dark? 
Window sizes and directions? Cross-ventilation? Ceiling height?
Does it feel airy or oppressive? Window quality (modern/drafty)?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
GROUP 2: LAYOUT & FLOW  
Describe: How do you enter? Kitchen-living relationship? Bedroom 
privacy and access? Can people flow through? Dead space wasted?
Would furniture fit? Could two people coexist? Real walls or 
fake separators with gaps? Overall functionality.
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
GROUP 3: KITCHEN
Describe: Counter space for cooking? All appliances visible? 
Storage (cabinets, pantry)? Ventilation/extraction? Workflow 
efficiency? Where would you eat (counter, table, dining room)?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
GROUP 4: BATHROOM
Describe: Shower, tub, or both? Condition (dated vs updated)?
Storage for toiletries? Ventilation? Could two people get ready?
How many bathrooms visible?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
GROUP 5: BEDROOM
Describe: What bed size fits? Closet/wardrobe situation? Light
quality and control? Privacy from living area? Noise isolation?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
GROUP 6: CONDITION & FINISH
Describe: What's new vs dated? What needs work soon? Overall
maintenance state? Floor condition? Finish quality (cheap vs 
quality materials)? Aesthetic style - cozy, sterile, dated, modern?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
GROUP 7: COMFORT & LIFESTYLE
Describe: Cozy corners for TV/reading? WFH setup options? Outdoor
space (size, overlooks what, usable)? Total storage throughout?
Could you host guests? Overall vibe - who would love this place?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
SAFETY (flag any hazards):
Child hazards: climbable rails, gaps, steep stairs, sharp corners
Elderly hazards: trip risks, no grab bars, steps
Pet hazards: balcony gaps, escape routes
Ground floor exposure: can passersby see in?
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
RED FLAGS (note if present):
- Cubicle bathroom (fake-wall cube inside room)
- Mezzanine with ladder (bed only via ladder)
- Needs full renovation (uninhabitable without major work)
- Is house share (shared with strangers)
═══════════════════════════════════════════════════════════════

Output JSON:
{
  "light_air": "...",
  "layout_flow": "...",
  "kitchen": "...",
  "bathroom": "...",
  "bedroom": "...",
  "condition_finish": "...",
  "comfort_lifestyle": "...",
  "safety_hazards": "...",
  "red_flags_noted": "...",
  "overall_summary": "..."
}
`;
```

#### Step 2 Prompt: Score (All 35 Dimensions)

```typescript
const SCORE_PROMPT = `
Based on your descriptions, score ALL 35 dimensions 0-100.
Use null if you truly can't assess from the photos.

YOUR DESCRIPTIONS:
${JSON.stringify(descriptions)}

═══════════════════════════════════════════════════════════════
SCORE THESE 35 DIMENSIONS (0-100):
═══════════════════════════════════════════════════════════════

LIGHT & AIR (6):
1.  natural_light_intensity     // 0=dark cave, 100=flooded
2.  light_distribution          // 0=one room only, 100=all rooms lit
3.  light_quality               // 0=harsh/north, 100=pleasant multi-exposure
4.  cross_ventilation           // 0=no airflow, 100=great breeze potential
5.  ceiling_height              // 0=oppressive, 50=standard, 100=soaring
6.  window_quality              // 0=drafty old, 100=modern double-glazed

LAYOUT & FLOW (10):
7.  entrance_experience         // 0=into living room, 100=proper entry
8.  kitchen_living_relationship // 0=smells everywhere, 100=well-managed
9.  bathroom_privacy            // 0=through bedroom, 100=private
10. bedroom_seclusion           // 0=hear everything, 100=separate zone
11. flow_for_movement           // 0=awkward, 100=intuitive
12. flow_for_entertaining       // 0=cramped, 100=great for parties
13. dead_space_efficiency       // 0=lots wasted, 100=all usable
14. furniture_feasibility       // 0=nothing fits, 100=anything fits
15. two_person_living           // 0=constant conflict, 100=two coexist
16. real_walls_vs_separators    // 0=cubicle bathroom, 100=real walls

KITCHEN (6):
17. counter_space               // 0=nowhere to prep, 100=chef-level
18. appliance_quality           // 0=hotplate, 100=full modern suite
19. kitchen_storage             // 0=no cabinets, 100=abundant + pantry
20. cooking_ventilation         // 0=no extraction, 100=powerful hood
21. kitchen_workflow            // 0=inefficient, 100=perfect triangle
22. eating_area                 // 0=nowhere, 100=dining + casual options

BATHROOM (4):
23. bathroom_functionality      // 0=cramped shower, 100=tub + shower
24. bathroom_condition          // 0=1970s worn, 100=newly renovated
25. bathroom_storage            // 0=nowhere, 100=abundant
26. bathroom_for_two            // 0=one at a time, 100=two sinks + space

BEDROOM (4):
27. bedroom_size                // 0=single only, 100=king with space
28. closet_storage              // 0=no closet, 100=walk-in for two
29. bedroom_light               // 0=blazing uncontrollable, 100=pleasant/controllable
30. bedroom_privacy             // 0=hear/see everything, 100=silent/private

CONDITION & FINISH (5):
31. renovation_state            // 0=untouched decades, 100=brand new
32. maintenance_quality         // 0=falling apart, 100=pristine
33. floor_condition             // 0=damaged, 100=beautiful
34. finish_quality              // 0=cheap materials, 100=high-end
35. aesthetic_vibe              // 0=ugly/sterile, 100=beautiful character

═══════════════════════════════════════════════════════════════
ALSO OUTPUT:
═══════════════════════════════════════════════════════════════

highlights: [top 3-5 best features from your descriptions]
concerns: [any issues/trade-offs from your descriptions]

red_flags: {
  cubicle_bathroom: boolean,
  mezzanine_ladder: boolean,
  needs_full_renovation: boolean,
  ground_floor_exposed: boolean,
  is_house_share: boolean
}

safety: {
  child_hazards: string[],    // Specific hazards
  elderly_hazards: string[],
  pet_hazards: string[]
}

comfort_extras: {
  cozy_corner_potential: number,    // 0-100
  wfh_suitability: number,          // 0-100
  outdoor_space_quality: number,    // 0-100
  storage_total: number,            // 0-100
  guest_accommodation: number       // 0-100
}

confidence: "low" | "medium" | "high"  // Based on photo coverage

Output as JSON.
`;
```

### WPA Model: Gemini 2.5 Flash-Lite

| Aspect | Value |
|--------|-------|
| **Model** | Gemini 2.5 Flash-Lite |
| **Photos** | 30 photos |
| **Cost** | **~$0.003** |
| **Latency** | ~15 seconds |
| **Use Cases** | Vibe-check, recommendations, property page |
| **Caching** | Cached per listing (reusable across users) |
- Supports up to 3,000 images per prompt
- 1M token context window

### Cost Per Property (Complete Flow) - Gemini 2.5 Flash

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WPA (For Recommendation Ranking)                                           │
│  Model: Gemini 2.5 Flash                                                   │
│  Total: ~$0.004/property                                                    │
│  ├── Step 1: Describe (30 photos) ................ $0.002                  │
│  │   └── Input: 4,250 tokens × $0.30/M = $0.00128                         │
│  │   └── Output: 800 tokens × $2.50/M = $0.002                            │
│  ├── Step 2: Score (text-only) ................... $0.003                  │
│  │   └── Input: 1,500 tokens × $0.30/M = $0.00045                         │
│  │   └── Output: 800 tokens × $2.50/M = $0.002                            │
│  └── Step 3: Explain (Flash-lite) ................ $0.0005                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FULL WPA (Saved Properties / Property Page)                                │
│  Model: Gemini 2.5 Flash                                                   │
│  Total: ~$0.014/property (CACHED - only runs once)                         │
│  ├── Step 1: Describe (30 photos) ................ $0.010                  │
│  │   └── Input: 23,000 tokens × $0.30/M = $0.0069                         │
│  │   └── Output: 1,500 tokens × $2.50/M = $0.00375                        │
│  ├── Step 2: Score (text-only) ................... $0.003                  │
│  │   └── Input: 2,000 tokens × $0.30/M = $0.0006                          │
│  │   └── Output: 800 tokens × $2.50/M = $0.002                            │
│  └── Step 3: Explain (Flash-lite, per-user) ...... $0.0005 × N users       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key insight**: With Gemini 2.5 Flash-Lite, WPA is **~100x cheaper** than Gemini 3 Pro!
- WPA: $0.004 (was $0.015)
- Full WPA: $0.014 (was $0.23)

WPA Steps 1-2 are cached per property. Only Step 3 (Explain) runs per user.

---

## 📊 Realistic Cost Analysis: Barcelona Rentals (On-Demand WPA)

### The Context

- **5,000 rental listings** in Barcelona at any time
- User signs up → Psychologist → Profile → Recommendations
- Question: **What does it cost per user with ON-DEMAND WPA?**

### Strategy: On-Demand WPA (No Pre-Computation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THE FLOW                                                                   │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. DURING CALL:                                                           │
│     Filter 5,000 → ~100 candidates (FREE - DB query)                       │
│     WPA a few to vibe-check (CHEAP - $0.015 each)                  │
│                                                                             │
│  2. AFTER CALL:                                                            │
│     Full WPA properties user showed interest in (~$0.23 each)              │
│     These get CACHED - shared across all users                             │
│                                                                             │
│  3. RECOMMENDATIONS:                                                        │
│     Use WPA to rank candidates                                     │
│     Full WPA only what we actually recommend / user clicks                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Insight: WPA is Shared Across Users

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WPA CACHING EFFECT                                                         │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  User A likes property X → Full WPA X → CACHED                             │
│  User B matches property X → WPA already cached → FREE                     │
│  User C matches property X → WPA already cached → FREE                     │
│                                                                             │
│  Over time:                                                                 │
│  - Popular properties get WPA'd by early users                             │
│  - Later users benefit from cache hits                                     │
│  - Cache hit rate: ~30% month 1 → ~60% month 3 → ~80% month 6             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Realistic User Journey (Barcelona Renter)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ONBOARDING CALL                                                            │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Psychologist (profile creation): $0.05                                    │
│  Filter 5,000 → 80 candidates: FREE                                        │
│  WPA 5 properties for vibe-check: 5 × $0.015 = $0.075              │
│  User likes 2, dislikes 3: feedback captured                               │
│                                                                             │
│  Onboarding total: ~$0.13                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER CALL (First Recommendations)                                         │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Full WPA the 2 they liked: 2 × $0.23 = $0.46                              │
│  WPA to rank top 20: 20 × $0.015 = $0.30                           │
│  Full WPA top 5 for recommendations: 5 × $0.23 = $1.15                     │
│  Explain those 5: 5 × $0.002 = $0.01                                       │
│                                                                             │
│  BUT: Some might be cached from other users!                               │
│  Assume 30% cache hit → 5 Full WPAs × 0.7 = 3.5 × $0.23 = $0.81           │
│                                                                             │
│  First recs total: ~$1.58                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  WEEK 1-4 (Ongoing Recommendations)                                         │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  User behavior (realistic):                                                │
│  - Checks app 3-4x/week                                                    │
│  - Looks at ~3 properties per session                                      │
│  - Saves ~2 properties per week                                            │
│  - Total properties engaged: ~15/week                                      │
│                                                                             │
│  Per week:                                                                  │
│  - WPA for ranking: ~10 × $0.015 = $0.15                          │
│  - Full WPA for clicked/saved: ~8 × $0.23 = $1.84                         │
│  - But ~40% cached: 8 × 0.6 × $0.23 = $1.10                               │
│  - Explanations: ~8 × $0.002 = $0.02                                       │
│                                                                             │
│  Weekly total: ~$1.27                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MONTH 1 TOTAL                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Onboarding: $0.13                                                         │
│  First recs: $1.58                                                         │
│  Week 1-4 (4 weeks): 4 × $1.27 = $5.08                                     │
│  Follow-up calls (2): 2 × $0.08 = $0.16                                    │
│                                                                             │
│  ──────────────────────────────────────────────────────────────────────────│
│  MONTH 1 TOTAL: ~$6.95 per active user                                     │
│                                                                             │
│  Revenue: €10/month → Margin: ~€3.05/user/month                            │
│  ──────────────────────────────────────────────────────────────────────────│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MONTH 2+ (Higher Cache Hit Rate)                                           │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  As more users use the system:                                             │
│  - Cache hit rate increases: 40% → 60%                                     │
│  - User engagement decreases (found place or gave up)                      │
│  - Fewer Full WPAs needed                                                  │
│                                                                             │
│  Weekly cost (month 2):                                                    │
│  - Full WPA: 6 × 0.4 × $0.23 = $0.55                                       │
│  - WPA: ~8 × $0.015 = $0.12                                        │
│  - Explains: $0.02                                                         │
│  Weekly: ~$0.69                                                            │
│                                                                             │
│  MONTH 2+ TOTAL: ~$2.76/user                                               │
│  Margin: ~€7.24/user/month ✅                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost by User Activity Level

| User Type | Properties/Week | Full WPAs/Month | Cost/Month | Margin |
|-----------|-----------------|-----------------|------------|--------|
| **Light** (browses 2x/week) | 5 | ~12 | ~$3.50 | €6.50 |
| **Active** (browses daily) | 20 | ~35 | ~$7.00 | €3.00 |
| **Power** (checks everything) | 40 | ~60 | ~$12.00 | -€2.00 |

**Key insight**: Most users are Light/Active. Power users are rare.

### Platform Costs (Minimal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM COSTS (No Pre-WPA)                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  ONE-TIME: $0 (no batch WPA needed)                                        │
│                                                                             │
│  MONTHLY FIXED:                                                            │
│  ├── Harvester (Scrapfly): ~$50/month                                      │
│  ├── DynamoDB: ~$10/month                                                  │
│  └── Vercel/Supabase: ~$50/month                                           │
│  Monthly total: ~$110/month                                                │
│                                                                             │
│  NO nightly WPA batch needed - all WPA is on-demand!                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Break-Even Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BREAK-EVEN                                                                 │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Fixed costs: $110/month                                                   │
│  Variable cost per user (month 1): ~$7                                     │
│  Variable cost per user (month 2+): ~$3                                    │
│  Revenue per user: €10/month                                               │
│                                                                             │
│  Month 1 margin per user: €10 - $7 = €3                                    │
│  Month 2+ margin per user: €10 - $3 = €7                                   │
│                                                                             │
│  Break-even: $110 / €3 = ~37 users in month 1                              │
│  After month 1: $110 / €7 = ~16 users                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 COMPLETE COST BREAKDOWN: Per User Per Month

### Pricing Reference (Source: `src/lib/pricing-config.ts`)

```typescript
// AI Models
GEMINI_2_5_FLASH:   $0.30/M input,  $2.50/M output   // WPA, Instant
GEMINI_2_5_FLASH_LITE: $0.10/M input, $0.40/M output // Explain
GEMINI_3_PRO:       $2.00/M input, $12.00/M output   // Psychologist (optional)

// APIs
GEOAPIFY:           FREE (3,000 requests/day)        // Isochrones
NOMINATIM:          FREE (1 req/sec rate limit)      // Geocoding
SERPER_DEV:         FREE (2,500 queries lifetime)    // Neighborhood research
```

### Per-Call Cost Calculations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PSYCHOLOGIST (AI Profiler)                                                 │
│  Model: Gemini 2.5 Flash (not 3 Pro - too expensive)                       │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Input: System prompt + user responses = ~3,000 tokens                     │
│  Output: Lifestyle DNA + weights = ~2,000 tokens                           │
│                                                                             │
│  Cost: (3,000 × $0.30/M) + (2,000 × $2.50/M)                              │
│      = $0.0009 + $0.005                                                    │
│      = $0.006 per call                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ISOCHRONE (Geoapify)                                                       │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Per user: 1 isochrone for work location                                   │
│  Updates: Maybe 1-2 more if they change preferences                        │
│                                                                             │
│  Cost: FREE (3,000/day free tier)                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  WPA (Flash-Lite, 30 images)                                                │
│  Model: Gemini 2.5 Flash                                                   │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Step 1 (Describe):                                                        │
│  ├── Input: 30 images × 500 tokens + 500 prompt = 15,500 tokens           │
│  ├── Output: 800 tokens                                                    │
│  └── Cost: (4,250 × $0.30/M) + (800 × $2.50/M) = $0.00128 + $0.002       │
│                                                                             │
│  Step 2 (Score):                                                           │
│  ├── Input: 1,300 tokens                                                   │
│  ├── Output: 600 tokens                                                    │
│  └── Cost: (1,300 × $0.30/M) + (600 × $2.50/M) = $0.0004 + $0.0015       │
│                                                                             │
│  TOTAL: ~$0.004 per property                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FULL WPA (Post-Call, 30 images)                                            │
│  Model: Gemini 2.5 Flash                                                   │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Step 1 (Describe):                                                        │
│  ├── Input: 30 images × 750 + 500 = 23,000 tokens                         │
│  ├── Output: 1,500 tokens                                                  │
│  └── Cost: (23,000 × $0.30/M) + (1,500 × $2.50/M) = $0.0069 + $0.00375   │
│                                                                             │
│  Step 2 (Score):                                                           │
│  ├── Input: 2,000 tokens                                                   │
│  ├── Output: 800 tokens                                                    │
│  └── Cost: (2,000 × $0.30/M) + (800 × $2.50/M) = $0.0006 + $0.002        │
│                                                                             │
│  TOTAL: ~$0.013 per property                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EXPLAIN (Personalized "Why this works for you")                           │
│  Model: Gemini 2.5 Flash-Lite                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Input: WPA + neighborhood + user summary = ~2,000 tokens                  │
│  Output: 2-3 sentences = ~150 tokens                                       │
│                                                                             │
│  Cost: (2,000 × $0.10/M) + (150 × $0.40/M)                                │
│      = $0.0002 + $0.00006                                                  │
│      = $0.0003 per property                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PRE-WPA SCORING                                                            │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Cost: FREE (algorithmic, no LLM)                                          │
│  Uses: Listing data + keywords + neighborhood scores                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FIT SCORING                                                                │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Cost: FREE (algorithmic, no LLM)                                          │
│  Uses: WPA scores + neighborhood scores + user weights                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  NEIGHBORHOOD PROFILE LOOKUP                                                │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Cost: FREE (DynamoDB query, pre-computed)                                 │
│  The SERP research is a one-time platform cost, not per-user               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost Summary Table

| Operation | Model | Cost |
|-----------|-------|------|
| Psychologist | Flash | $0.006 |
| Isochrone | Geoapify | FREE |
| WPA (30 imgs) | Flash-Lite | $0.003 |
| Full WPA (30 imgs) | Flash-Lite | $0.003 |
| Explain | Flash-Lite | $0.0003 |
| Pre-WPA Score | Algorithmic | FREE |
| Fit Score | Algorithmic | FREE |
| Neighborhood Lookup | DynamoDB | FREE |

### Monthly User Cost Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MONTH 1: NEW USER                                                          │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  ONBOARDING CALL (Once):                                                   │
│  ├── Psychologist ............................ $0.006                      │
│  ├── Isochrone for work location ............. FREE                        │
│  ├── Pre-WPA filter + score .................. FREE                        │
│  ├── WPA (10 properties) ............. 10 × $0.004 = $0.04        │
│  └── Subtotal: $0.046                                                      │
│                                                                             │
│  AFTER CALL (Same Day):                                                     │
│  ├── Full WPA on saved properties ............ 3 × $0.013 = $0.039        │
│  ├── Explain for saved ...................... 3 × $0.0003 = $0.001        │
│  └── Subtotal: $0.04                                                       │
│                                                                             │
│  DAILY RECOMMENDATIONS (3x/day × 30 days = 90 pushes):                     │
│  ├── Pre-WPA scoring per push ................ FREE                        │
│  ├── New unique candidates/month ............. ~50                         │
│  ├── Already cached (other users) ............ ~30%                        │
│  ├── New WPAs needed ................. 50 × 0.7 = 35              │
│  ├── WPA cost ........................ 35 × $0.004 = $0.14        │
│  ├── Explains generated ...................... 50 × $0.0003 = $0.015      │
│  └── Subtotal: $0.155                                                      │
│                                                                             │
│  USER ENGAGEMENT (Clicks/Saves):                                            │
│  ├── Properties clicked ...................... ~10/month                   │
│  ├── Already have Full WPA (from in-call) .... ~30%                        │
│  ├── Already cached (other users) ............ ~20%                        │
│  ├── New Full WPAs needed .................... 10 × 0.5 = 5               │
│  ├── Full WPA cost ........................... 5 × $0.013 = $0.065        │
│  └── Subtotal: $0.065                                                      │
│                                                                             │
│  FOLLOW-UP CALLS (2/month):                                                 │
│  ├── Profile update (Psychologist) ........... 2 × $0.006 = $0.012        │
│  ├── Maybe new isochrone ..................... FREE                        │
│  └── Subtotal: $0.012                                                      │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════════│
│  MONTH 1 TOTAL: $0.046 + $0.04 + $0.155 + $0.065 + $0.012 = $0.318        │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Revenue: €10                                                              │
│  Margin: €10 - $0.32 = €9.68 ✅                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MONTH 2+: RETURNING USER                                                   │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  No onboarding (already done)                                              │
│  Higher cache hit rate (more users = more cached WPAs)                     │
│                                                                             │
│  DAILY RECOMMENDATIONS:                                                     │
│  ├── New candidates/month .................... ~40 (less searching)        │
│  ├── Cache hit rate .......................... ~50%                        │
│  ├── New WPAs ........................ 40 × 0.5 = 20              │
│  ├── Cost ................................... 20 × $0.004 = $0.08         │
│  ├── Explains ................................ 40 × $0.0003 = $0.012      │
│  └── Subtotal: $0.092                                                      │
│                                                                             │
│  USER ENGAGEMENT:                                                           │
│  ├── Properties clicked ...................... ~8/month                    │
│  ├── Cache hit rate .......................... ~60%                        │
│  ├── New Full WPAs ........................... 8 × 0.4 = 3.2              │
│  ├── Cost ................................... 3 × $0.013 = $0.039         │
│  └── Subtotal: $0.039                                                      │
│                                                                             │
│  FOLLOW-UP CALLS (1/month):                                                 │
│  └── Profile update: $0.006                                                │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════════│
│  MONTH 2+ TOTAL: $0.092 + $0.039 + $0.006 = $0.137                         │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Revenue: €10                                                              │
│  Margin: €10 - $0.14 = €9.86 ✅✅                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost by User Type

| User Type | Activity | WPAs/Month | Cost/Month | Margin |
|-----------|----------|------------|------------|--------|
| **Light** | Browses 2x/week | ~15 | ~$0.15 | €9.85 |
| **Active** | Browses daily | ~40 | ~$0.35 | €9.65 |
| **Power** | Checks everything | ~80 | ~$0.70 | €9.30 |

**All user types are highly profitable!** 🎉

### Final Cost Summary

| Metric | Month 1 | Month 2+ |
|--------|---------|----------|
| **Per-user variable cost** | $0.32 | $0.14 |
| **Revenue per user** | €10 | €10 |
| **Margin per user** | **€9.68** | **€9.86** |
| **Gross margin %** | **96.8%** | **98.6%** |

### Platform Fixed Costs (Monthly)

| Item | Monthly | Notes |
|------|---------|-------|
| Vercel | **FREE** | Free tier |
| Supabase | **FREE** | Free tier |
| DynamoDB | ~$5 | Pay-as-you-go |
| ScrapingDog | **$40** | Monthly subscription |
| **Total Fixed** | **~$45** |

---

## 🚀 ONE-TIME PLATFORM SETUP COSTS (Before First User)

These costs must be paid ONCE to bootstrap the platform:

### 1. Airbnb Review Analysis (~5M reviews)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AIRBNB REVIEW PROCESSING                                                   │
│  Model: Gemini 2.5 Flash-Lite                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Total reviews: ~5,000,000                                                 │
│  Average review: ~200 tokens                                               │
│  Total input: 5M × 200 = 1B tokens                                         │
│                                                                             │
│  Batch processing (50 reviews per call):                                   │
│  ├── Calls needed: 100,000                                                 │
│  ├── Input per call: 10,000 tokens (reviews) + 500 (prompt) = 10,500      │
│  ├── Output per call: 500 tokens (12 dimensions × 50 reviews)             │
│  ├── Total input: 1.05B tokens                                            │
│  └── Total output: 50M tokens                                             │
│                                                                             │
│  Cost (Flash-Lite: $0.10/M in, $0.40/M out):                              │
│  ├── Input: 1,050M × $0.10/M = $105                                       │
│  ├── Output: 50M × $0.40/M = $20                                          │
│  └── Subtotal: $125                                                        │
│                                                                             │
│  OPTIMIZATION: Use Batch API (50% discount):                               │
│  └── TOTAL: ~$65                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Wait - let me recalculate more carefully:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AIRBNB REVIEW PROCESSING (OPTIMIZED)                                       │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Strategy: Process in large batches per listing                            │
│                                                                             │
│  Total listings with reviews: ~50,000 in Barcelona region                  │
│  Average reviews per listing: 15                                           │
│  Average review length: 150 tokens                                         │
│                                                                             │
│  Per-listing call:                                                         │
│  ├── Input: 15 reviews × 150 = 2,250 + 300 prompt = 2,550 tokens          │
│  ├── Output: 12 dimensions × 5 tokens = 60 tokens                         │
│  └── Total: 50,000 calls                                                   │
│                                                                             │
│  Totals:                                                                   │
│  ├── Input: 50,000 × 2,550 = 127.5M tokens                                │
│  ├── Output: 50,000 × 60 = 3M tokens                                      │
│                                                                             │
│  Cost (Flash-Lite):                                                        │
│  ├── Input: 127.5M × $0.10/M = $12.75                                     │
│  ├── Output: 3M × $0.40/M = $1.20                                         │
│  └── TOTAL: ~$14                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Neighborhood SERP Research (10 Cities)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SERP RESEARCH PIPELINE                                                     │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  STEP 1: Serper.dev Searches                                               │
│  ├── Available: 2,500 free queries                                         │
│  ├── Allocation: 250 per city × 10 cities                                  │
│  ├── Queries per neighborhood: 250 / 25 hoods = 10 searches               │
│  ├── Dimensions covered: 20 (combo queries)                                │
│  └── Cost: FREE                                                            │
│                                                                             │
│  STEP 2: Analyze SERP Snippets                                             │
│  ├── Per search: ~10 results × 150 tokens = 1,500 tokens                  │
│  ├── Total input: 2,500 × 1,500 = 3.75M tokens                            │
│  ├── Output: 2,500 × 200 = 500K tokens                                    │
│  ├── Cost (Flash-Lite): (3.75M × $0.10) + (0.5M × $0.40)                  │
│  └── Subtotal: $0.38 + $0.20 = $0.58                                       │
│                                                                             │
│  STEP 3: Deep-Dive Scraping (Top Articles)                                 │
│  ├── Available: 1,700 ScrapingDog credits                                  │
│  ├── Per credit: $0.004                                                    │
│  └── Cost: 1,700 × $0.004 = $6.80                                          │
│                                                                             │
│  STEP 4: Analyze Scraped Articles                                          │
│  ├── Per article: ~3,000 tokens                                            │
│  ├── Total input: 1,700 × 3,000 = 5.1M tokens                             │
│  ├── Output: 1,700 × 300 = 510K tokens                                    │
│  ├── Cost (Flash-Lite): (5.1M × $0.10) + (0.51M × $0.40)                  │
│  └── Subtotal: $0.51 + $0.20 = $0.71                                       │
│                                                                             │
│  STEP 5: Aggregate into Neighborhood Profiles                              │
│  ├── Neighborhoods: ~250 total                                             │
│  ├── Per profile: merge all extractions                                    │
│  └── Cost: FREE (algorithmic aggregation)                                  │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════════│
│  SERP TOTAL: $0 + $0.58 + $6.80 + $0.71 = ~$8.10                           │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Geocoding & H3 Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GEOCODING (Nominatim)                                                      │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Neighborhoods to geocode: ~250                                            │
│  Cost: FREE (1 req/sec rate limit)                                         │
│                                                                             │
│  H3 Cell Generation: FREE (local computation)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Initial Property Harvesting

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INITIAL HARVEST                                                            │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  ScrapingDog: Included in $40/month subscription                           │
│  Storage (S3): ~$2 for initial crawl                                       │
│  Parsing (Bedrock Mistral): ~$3 for initial batch                          │
│                                                                             │
│  TOTAL: ~$5 (mostly already covered by subscription)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### One-Time Setup Summary

| Component | Cost |
|-----------|------|
| Airbnb Review Analysis | **$14** |
| SERP Neighborhood Research | **$8** |
| Geocoding + H3 | FREE |
| Initial Harvest + Parse | **$5** |
| **TOTAL ONE-TIME** | **~$27** |

---

## 💵 COMPLETE COST TO LAUNCH

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BEFORE FIRST USER (One-Time)                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Airbnb analysis ........................ $14                              │
│  Neighborhood SERP ...................... $8                               │
│  Initial harvest/parse .................. $5                               │
│  ─────────────────────────────────────────                                 │
│  SETUP TOTAL: $27                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MONTH 1 WITH FIRST USER                                                    │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Fixed costs (ScrapingDog + DynamoDB) ... $45                              │
│  First user variable cost ............... $0.32                            │
│  ─────────────────────────────────────────                                 │
│  MONTH 1 TOTAL: $45.32                                                     │
│                                                                             │
│  Revenue (1 user): €10                                                     │
│  Net: -$35.32 (expected - need scale)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  TOTAL INVESTMENT TO FIRST PAYING USER                                      │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  One-time setup ......................... $27                              │
│  Month 1 fixed .......................... $45                              │
│  First user cost ........................ $0.32                            │
│  ─────────────────────────────────────────                                 │
│  TOTAL TO LAUNCH: ~$72                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Break-Even

```
Fixed costs: $45/month
Margin per user: ~€9.70

Break-even: $45 / €9.70 = 5 users ✅✅
```

**With free Vercel/Supabase, break-even is just 5 users!**

### WPA Model Choice: Gemini 2.5 Flash-Lite

```
Model ID: gemini-2.5-flash
Pricing:
├── Input (text, image, video): $0.30/M tokens
├── Output (text): $2.50/M tokens
└── Thinking: Included ✅

Capabilities:
├── Up to 3,000 images per prompt
├── 1M token context window
├── Thinking/reasoning built-in
└── Vision + text in same call

Why Flash for EVERYTHING:
├── Quality: Good enough for our use case
├── Cost: 16x cheaper than Gemini 3 Pro
├── Speed: Fast enough for in-call use
└── Features: Has thinking, vision, long context
```

### How to Reduce Costs Further

1. **Pre-WPA Scoring**: Rank candidates using listing data + keywords + neighborhood scores (FREE)
2. **Threshold-based selection**: Only WPA properties above a score threshold
3. **Cap WPA count**: Maximum 10 WPAs per recommendation batch
4. **Cache aggressively**: WPA cache is shared across ALL users
5. **User caps**: Limit power users to X Full WPAs per week

---

## 🎯 Cost-Controlled Recommendation Flow: Threshold-Based

### The Philosophy

**Don't rank everything. Only recommend what's ACTUALLY GOOD.**

- If nothing passes the threshold → "Nothing great right now, we'll keep looking"
- If 3 pass → Recommend 3
- If 10 pass → Recommend 10 (capped)
- Never WPA more than 10 per batch (cost cap: $1.50 Instant or $2.30 Full)

### The Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THRESHOLD-BASED RECOMMENDATION FLOW                                        │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  STEP 1: DB FILTER (FREE)                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  5000 listings                                                             │
│    → Filter: price ≤ budget, beds ≥ min, commute ≤ max, location match    │
│    → ~100-200 candidates                                                   │
│                                                                             │
│  STEP 2: PRE-WPA SCORING (FREE)                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Score using: listing data + neighborhood scores + description keywords    │
│                                                                             │
│  Inputs (all FREE):                                                        │
│  ├── Price efficiency (how far under budget)                              │
│  ├── Size bonus (extra m² beyond minimum)                                 │
│  ├── Amenities (terrace, elevator, parking, AC)                           │
│  ├── Neighborhood 20 dimensions (from SERP)                               │
│  ├── Keywords: "luminoso", "reformado", "tranquilo", "terraza"           │
│  └── Photo count heuristic                                                │
│                                                                             │
│  Output: pre_wpa_score (0-100)                                             │
│                                                                             │
│  STEP 3: THRESHOLD FILTER (FREE)                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PRE_WPA_THRESHOLD = 60  (tunable)                                         │
│                                                                             │
│  Filter: pre_wpa_score >= PRE_WPA_THRESHOLD                                │
│    → Maybe 20 pass, maybe 5, maybe 0                                       │
│                                                                             │
│  Cap: Take top 10 by score (cost control)                                  │
│    → Maximum 10 candidates for WPA                                         │
│                                                                             │
│  STEP 4: WPA (PAID - max 10)                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Run WPA on ≤10 candidates                                         │
│  Cost: ≤10 × $0.015 = $0.15 max                                           │
│                                                                             │
│  Or Full WPA if user has saved/clicked                                     │
│  Cost: ≤10 × $0.23 = $2.30 max                                            │
│                                                                             │
│  STEP 5: POST-WPA SCORING (FREE - algorithmic)                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Combine: pre_wpa_score + wpa_scores + user_weights                        │
│    → final_fit_score (0-100)                                               │
│                                                                             │
│  STEP 6: FINAL THRESHOLD (FREE)                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  POST_WPA_THRESHOLD = 65  (tunable)                                        │
│                                                                             │
│  Recommend: ALL properties where final_fit_score >= POST_WPA_THRESHOLD     │
│    → Could be 0, 3, 7, or 10 properties                                    │
│                                                                             │
│  NO RANKING - just "these are good for you"                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Code Implementation

```typescript
// src/lib/recommender/thresholdRecommender.ts

const PRE_WPA_THRESHOLD = 60;   // Minimum to consider for WPA
const POST_WPA_THRESHOLD = 65;  // Minimum to recommend to user
const MAX_WPA_COUNT = 10;       // Cost cap

interface RecommendationResult {
  recommendations: Property[];  // 0-10 properties
  message: string;              // "Found 7 great matches!" or "Nothing great right now"
  debug?: {
    candidates_after_filter: number;
    passed_pre_wpa_threshold: number;
    wpa_count: number;
    passed_post_wpa_threshold: number;
  };
}

async function getRecommendations(
  userProfile: UserProfile
): Promise<RecommendationResult> {
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: DB Filter (FREE)
  // ══════════════════════════════════════════════════════════════════════════
  
  const candidates = await filterListings({
    priceMax: userProfile.budgetMax,
    bedroomsMin: userProfile.bedroomsMin,
    commuteMax: userProfile.maxCommuteMinutes,
    locations: userProfile.preferredAreas,
  });
  // → ~100-200 candidates
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Pre-WPA Scoring (FREE)
  // ══════════════════════════════════════════════════════════════════════════
  
  const scored = await Promise.all(
    candidates.map(async (listing) => {
      const neighborhood = await getNeighborhoodProfile(listing.lat, listing.lon);
      const preWpaScore = calculatePreWpaFitScore(listing, neighborhood, userProfile);
      return { listing, neighborhood, preWpaScore };
    })
  );
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Threshold Filter (FREE)
  // ══════════════════════════════════════════════════════════════════════════
  
  const passedThreshold = scored
    .filter(s => s.preWpaScore >= PRE_WPA_THRESHOLD)
    .sort((a, b) => b.preWpaScore - a.preWpaScore)  // Sort to take top N
    .slice(0, MAX_WPA_COUNT);  // Cap at 10
  
  if (passedThreshold.length === 0) {
    return {
      recommendations: [],
      message: "Nothing great matches your criteria right now. We'll keep looking!",
      debug: {
        candidates_after_filter: candidates.length,
        passed_pre_wpa_threshold: 0,
        wpa_count: 0,
        passed_post_wpa_threshold: 0,
      }
    };
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: WPA (PAID - max 10)
  // ══════════════════════════════════════════════════════════════════════════
  
  const withWpa = await Promise.all(
    passedThreshold.map(async ({ listing, neighborhood, preWpaScore }) => {
      // Check cache first
      let wpa = await getWpaFromCache(listing.id);
      
      if (!wpa) {
        // Run WPA (or Full if user has engaged before)
        wpa = await runWPA(listing.id, listing.photos);  // Full 30 photos
        await cacheWpa(listing.id, wpa);
      }
      
      return { listing, neighborhood, preWpaScore, wpa };
    })
  );
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5: Post-WPA Scoring (FREE)
  // ══════════════════════════════════════════════════════════════════════════
  
  const finalScored = withWpa.map(({ listing, neighborhood, preWpaScore, wpa }) => {
    const finalScore = calculateFinalFitScore(
      preWpaScore,
      wpa,
      neighborhood,
      listing,
      userProfile
    );
    return { listing, wpa, finalScore };
  });
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6: Final Threshold (FREE) - NO RANKING, just threshold
  // ══════════════════════════════════════════════════════════════════════════
  
  const recommendations = finalScored
    .filter(s => s.finalScore >= POST_WPA_THRESHOLD)
    .map(s => ({
      ...s.listing,
      wpa: s.wpa,
      fitScore: s.finalScore,
    }));
  
  // Message based on results
  let message: string;
  if (recommendations.length === 0) {
    message = "We checked some promising options, but none quite hit the mark. We'll keep looking!";
  } else if (recommendations.length === 1) {
    message = "Found 1 great match for you!";
  } else {
    message = `Found ${recommendations.length} great matches for you!`;
  }
  
  return {
    recommendations,
    message,
    debug: {
      candidates_after_filter: candidates.length,
      passed_pre_wpa_threshold: passedThreshold.length,
      wpa_count: passedThreshold.length,
      passed_post_wpa_threshold: recommendations.length,
    }
  };
}
```

### Cost Analysis (Threshold-Based) - With Gemini 2.5 Flash

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COST PER RECOMMENDATION BATCH                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Best case (nothing passes pre-WPA threshold):                             │
│  └── WPA cost: $0.00                                                       │
│                                                                             │
│  Typical case (5 pass threshold):                                          │
│  └── WPA cost: 5 × $0.004 = $0.02                                         │
│                                                                             │
│  Worst case (10 pass threshold - capped):                                  │
│  └── WPA cost: 10 × $0.004 = $0.04                                        │
│                                                                             │
│  MAXIMUM COST PER BATCH: $0.04 (Instant) or $0.14 (Full)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MONTHLY USER COST (WITH GEMINI 2.5 FLASH)                                  │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  Onboarding:                                                               │
│  ├── Psychologist: $0.05                                                   │
│  ├── First recommendation batch (max 10 WPA): $0.04               │
│  └── Subtotal: $0.09                                                       │
│                                                                             │
│  Daily (if checking for new):                                               │
│  ├── Pre-WPA scoring new listings: FREE                                    │
│  ├── WPA new matches (avg 2/day × 30 days = 60): 60 × $0.004 = $0.24      │
│  │   BUT most will be cached from other users (~50%): $0.12               │
│  └── Daily subtotal: ~$0.12/month                                          │
│                                                                             │
│  User clicks/saves (triggers Full WPA):                                     │
│  └── ~10/month × $0.014 = $0.14 (but ~40% cached): $0.08                  │
│                                                                             │
│  ──────────────────────────────────────────────────────────────────────────│
│  MONTH 1 TOTAL: ~$0.29/user 🎉                                             │
│  Margin: €10 - $0.29 = ~€9.71/user ✅✅                                    │
│  ──────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  This is 7x cheaper than previous estimates!                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Threshold Tuning

| Pre-WPA Threshold | Effect |
|-------------------|--------|
| 50 | More properties pass → Higher WPA cost, more recommendations |
| 60 | Balanced (recommended starting point) |
| 70 | Fewer pass → Lower cost, fewer recommendations |
| 80 | Very selective → Might return 0 often |

| Post-WPA Threshold | Effect |
|--------------------|--------|
| 55 | Recommend most that pass WPA |
| 65 | Recommend only good matches (recommended) |
| 75 | Very selective → "Nothing great" more often |

---

## 🎯 In-Call WPA: Parallel Processing (Zero Wait Time)

### The Trick: Start WPA During Core Intake, Reveal After What-Ifs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARALLEL WPA TIMELINE                                                      │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  0:00 ─────────────────────────────────────────────────────────── 10:00    │
│                                                                             │
│  CONVERSATION:                                                              │
│  ├── [0:00-5:00] Core Intake (budget, location, beds, commute)             │
│  ├── [5:00] ──── TRIGGER WPA (async) ────────────────────┐                │
│  ├── [5:00-8:00] What-Ifs ("What if budget +10%?")       │ WPA running    │
│  ├── [8:00] What-ifs complete                            │ in background  │
│  └── [8:00] ──── WPA READY (was done at ~5:15!) ─────────┘                │
│                                                                             │
│  BEHIND THE SCENES:                                                         │
│  ├── [5:00] Core intake done → Pre-WPA filter (instant)                   │
│  ├── [5:01] Flash WPA starts on top 10 candidates                         │
│  ├── [5:15] Flash WPA complete ← Results cached, waiting                  │
│  ├── [5:15-8:00] Results sit ready while what-ifs continue                │
│  └── [8:00] What-ifs done → Re-score with new weights → INSTANT reveal    │
│                                                                             │
│  USER WAIT TIME: 0 seconds! ✨                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Full Call Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ONBOARDING CALL FLOW                                                       │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. CORE INTAKE (5-7 min)                                                  │
│     ├── Budget range                                                       │
│     ├── Location preferences (neighborhoods)                               │
│     ├── Bedrooms/bathrooms minimum                                         │
│     ├── Work location + max commute                                        │
│     └── Key dealbreakers                                                   │
│                                                                             │
│     [ON COMPLETE: Trigger async WPA - don't wait!]                        │
│                                                                             │
│  2. WHAT-IFS (3-5 min)                                                     │
│     ├── "What if your budget was 10% higher?"                             │
│     ├── "Would you consider neighborhoods adjacent to X?"                  │
│     ├── "What if commute was 10 minutes longer?"                          │
│     ├── "Any dealbreakers you'd waive for the right place?"               │
│     └── Build flexibility profile                                          │
│                                                                             │
│     [MEANWHILE: WPA completes in background - user doesn't notice]        │
│                                                                             │
│  3. VIBE CHECK (3-5 min)                                                   │
│     ├── Leo: "I want to show you a few properties and see what you        │
│     │         think - it'll help me understand what you look at."         │
│     │                                                                      │
│     ├── [INSTANT - results already ready!]                                │
│     │                                                                      │
│     ├── Show Property 1 → "What's your first impression?"                 │
│     ├── Capture reaction → Adjust weights                                  │
│     ├── Show Property 2 → "This one's different - thoughts?"              │
│     ├── Capture reaction → Adjust weights                                  │
│     ├── Show Property 3 → "Last one - what do you think?"                 │
│     └── Capture reaction → Adjust weights                                  │
│                                                                             │
│     NOT: "Here are 5 great matches!" ❌                                    │
│     YES: "Help me understand what catches your eye" ✅                     │
│                                                                             │
│  4. WRAP-UP (1-2 min)                                                      │
│     ├── Leo: "This was super helpful - I get what you're looking for"     │
│     ├── "I'll send you recommendations 3x a day"                          │
│     ├── "Save anything you like, and I'll learn from that too"            │
│     └── User saves favorites → Queue for Full WPA (3 Pro)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// src/lib/agents/callFlow.ts

let wpaPromise: Promise<WpaResult[]> | null = null;

// Called when core intake completes (step 1 → step 2)
async function onCoreIntakeComplete(profile: CoreProfile) {
  // START WPA IN BACKGROUND - don't await!
  wpaPromise = runParallelWpa(profile);
  
  // Immediately continue to what-ifs
  return { nextStep: 'whatifs' };
}

// Called when what-ifs complete (step 2 → step 3)
async function onWhatIfsComplete(whatIfProfile: WhatIfProfile) {
  // WPA finished 3+ minutes ago - instant resolution
  const wpaResults = await wpaPromise;  // Already resolved!
  
  // Re-score with what-if weights (FREE, instant)
  const rescored = wpaResults.map(r => ({
    ...r,
    finalScore: recalculateFitScore(r, whatIfProfile)
  }));
  
  // Filter by post-WPA threshold
  const toShow = rescored
    .filter(r => r.finalScore >= POST_WPA_THRESHOLD)
    .slice(0, 3);  // Show 3 listings for vibe-check (full WPA each)
  
  return { 
    nextStep: 'vibecheck',
    properties: toShow,
    // Collaborative framing, not sales pitch
    introMessage: `I want to show you a few properties and see what you 
                   think - it'll help me understand what catches your eye.`
  };
}

// Runs in background during what-ifs
async function runParallelWpa(profile: CoreProfile): Promise<WpaResult[]> {
  // 1. Filter (instant)
  const candidates = await filterListings(profile);
  
  // 2. Pre-WPA score (instant)  
  const scored = await preWpaScore(candidates, profile);
  
  // 3. Threshold + cap
  const top10 = scored
    .filter(s => s.score >= PRE_WPA_THRESHOLD)
    .slice(0, 10);
  
  // 4. WPA with Gemini 2.5 Flash-Lite (~10-15 sec total, $0.003/listing)
  const withWpa = await Promise.all(
    top10.map(c => runFlashWpa(c.listing))
  );
  
  return withWpa;
}
```

### Cost for In-Call WPA

| Step | Cost |
|------|------|
| Pre-WPA filter + score | FREE |
| Flash WPA (max 10) | 10 × $0.004 = **$0.04** |
| Re-score after what-ifs | FREE |
| Total per call | **$0.04** |

### Leo's Framing (Collaborative, Not Sales-y)

```typescript
// WRONG ❌ - Sounds like a pitch
const badMessages = {
  0: "Sorry, couldn't find anything for you",
  5: "Found 5 great matches!",
  10: "Great news! Found 10 properties that match your vibe!",
};

// RIGHT ✅ - Collaborative, learning-focused
const goodMessages = {
  intro: `Ok, so I want to show you a few properties and see what you think - 
          it'll help me understand what you look at when you see a listing.`,
  
  showFirst: `Here's one... take a look at the photos. What's your first impression?`,
  
  afterReaction: `Got it - that's really helpful. Let me show you another one 
                  that's a bit different...`,
  
  wrapUp: `This is super useful - I'm getting a much better sense of what 
           clicks for you. I'll use this to find better matches.`,
  
  noneFound: `I couldn't find anything that passes my bar right now, but I'll 
              keep looking and ping you when something good comes up.`,
};
```

### The Psychology

| Framing | User Feels | Result |
|---------|------------|--------|
| "Found 5 great matches!" | Pressure to like something | Polite but dishonest feedback |
| **"Help me understand what you look at"** | Valued, collaborative | Honest gut reactions |

### In-Call Vibe-Check Script

```
Leo: "Alright, before I let you go - I want to show you a few places 
      and get your gut reaction. It'll help me understand what catches 
      your eye when you see a listing."

[Show Property 1]

Leo: "What do you think? Don't overthink it - just first impression."

User: "Hmm, it's nice but feels a bit dark..."

Leo: "Dark - got it. That's useful. Let me show you one that's different..."

[Show Property 2]

Leo: "This one?"

User: "Oh I like this! The kitchen looks great."

Leo: "The kitchen - interesting. What about it specifically?"

User: "The counter space, I like to cook..."

Leo: "Perfect, I'll keep that in mind. One more..."

[Show Property 3]

Leo: "Last one - what do you think?"

User: "Too small, the bedroom looks cramped."

Leo: "Bedroom size matters - noted. This is really helpful, thanks for 
      walking me through your thinking. I'll use all of this to find 
      you better matches."
```

### What Leo Learns From Reactions

| User Says | Leo Records | Adjusts Weight |
|-----------|-------------|----------------|
| "Feels dark" | `natural_light: negative` | +1.5 weight on light |
| "Kitchen looks great" | `kitchen: positive` | +1 weight on kitchen |
| "Counter space for cooking" | `counter_space: explicit_priority` | +2 weight |
| "Bedroom cramped" | `bedroom_size: negative` | +1 weight on bedroom |

This feedback goes to the **Psychologist** to refine the profile for future recommendations.

---

## 🛠️ Implementation Plan: WPA + Fit Scoring + Explain

### Phase 1: Core WPA Pipeline (Week 1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DELIVERABLES                                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. POST /api/wpa/describe                                                 │
│     Input: listing_id, photos[], listing_info, mode (instant|full)         │
│     Output: 10 prose descriptions (grouped)                                │
│     Model: Haiku (instant) or Gemini 3 Pro (full)                          │
│                                                                             │
│  2. POST /api/wpa/score                                                    │
│     Input: listing_id, descriptions, mode                                  │
│     Output: 35 dimension scores + flags + highlights + concerns            │
│     Model: Same as describe (text-only call)                               │
│                                                                             │
│  3. DynamoDB: leo-wpa-cache table                                          │
│     PK: listing_id                                                         │
│     SK: wpa_version (v1)                                                   │
│     Attributes: descriptions, scores, flags, meta, ttl                     │
│                                                                             │
│  4. Batch script: scripts/batch-wpa.ts                                     │
│     - Query all listings without WPA                                       │
│     - Run Full WPA on each                                                 │
│     - Store in cache                                                       │
│     - Progress logging                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Fit Scoring Algorithm (Week 1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DELIVERABLES                                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. src/lib/recommender/fitScoring.ts                                      │
│     - calculateFitScore(wpa, neighborhood, listing, userProfile)           │
│     - Weighted average across all 55 dimensions (35 WPA + 20 neighborhood) │
│     - Dealbreaker checks (instant fail)                                    │
│     - Must-have threshold checks                                           │
│     - Adjustments for life situation                                       │
│                                                                             │
│  2. src/lib/recommender/profileWeights.ts                                  │
│     - Default weights per dimension                                        │
│     - Psychologist-derived weight adjustments                              │
│     - Feedback-derived weight updates                                      │
│                                                                             │
│  3. Integration with recommender orchestrator                              │
│     - After filter, fetch WPA from cache                                   │
│     - Run fit scoring                                                      │
│     - Sort by fit score                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 3: Personalized Explanation (Week 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DELIVERABLES                                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. POST /api/wpa/explain                                                  │
│     Input: wpa_descriptions, wpa_scores, neighborhood_scores,              │
│            listing_data, fit_result, user_summary                          │
│     Output: 2-3 sentence personalized explanation                          │
│     Model: Gemini 2.5 Flash-lite ($0.002/call)                             │
│                                                                             │
│  2. Supabase table: user_property_explanations                             │
│     - user_id, listing_id, explanation, fit_score, created_at             │
│     - Cache per user-property pair (regenerate on profile change)          │
│                                                                             │
│  3. Property page component: <PersonalizedMatch />                         │
│     - Display fit score badge                                              │
│     - Display explanation prose                                            │
│     - Show top matches and concerns                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 4: WPA Caching & Admin (Week 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DELIVERABLES                                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. DynamoDB cache: leo-wpa-cache                                          │
│     - PK: listing_id                                                       │
│     - Store WPA results in cache                                           │
│     - TTL: 30 days (re-run if property updated)                            │
│     - Shared across ALL users                                              │
│                                                                             │
│  2. Cache-aware WPA calls:                                                 │
│     - Check cache before running WPA                                       │
│     - If Instant exists but not Full → upgrade on demand                   │
│     - Track cache hit rate for monitoring                                  │
│                                                                             │
│  3. Admin dashboard:                                                        │
│     - WPA cache stats (hit rate, total cached)                             │
│     - Cost tracking per day/week                                           │
│     - Manual WPA trigger for testing                                       │
│                                                                             │
│  NO BATCH WPA NEEDED - all WPA is on-demand, shared via cache!             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 5: WPA Integration (Flash-Lite)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DELIVERABLES                                                               │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│  1. POST /api/wpa/instant                                                  │
│     Input: listing_id, photos (all 30 photos)                              │
│     Output: Quick scores, 2 standouts, 1 concern                           │
│     Model: Claude 3 Haiku (Bedrock)                                        │
│     Latency target: <3 seconds                                             │
│                                                                             │
│  2. Integration with ElevenLabs agent                                      │
│     - show_property tool calls WPA                                 │
│     - Agent receives prose to verbalize                                    │
│     - Frontend shows carousel                                              │
│                                                                             │
│  3. Background upgrade                                                      │
│     - If user saves property, trigger Full WPA async                       │
│     - Replaces WPA in cache                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Timeline

| Week | Phase | Key Deliverables |
|------|-------|------------------|
| 1 | WPA Pipeline | `/api/wpa/describe`, `/api/wpa/score`, DynamoDB cache |
| 1 | Fit Scoring | `fitScoring.ts`, profile weights, orchestrator integration |
| 2 | Explain | `/api/wpa/explain`, `<PersonalizedMatch />` component |
| 2 | WPA Caching | Cache-aware calls, admin dashboard, cost tracking |
| 3 | WPA (Flash-Lite) | Single WPA model for all use cases |
| 3 | Polish | Testing, edge cases, performance optimization |

### Files to Create/Modify

```
NEW FILES:
├── src/app/api/wpa/
│   ├── describe/route.ts        # Step 1: Describe (vision)
│   ├── score/route.ts           # Step 2: Score (text-only)
│   ├── explain/route.ts         # Step 3: Explain (per-user)
│   └── route.ts                 # WPA endpoint (Flash-Lite)
├── src/lib/recommender/
│   ├── fitScoring.ts            # Algorithmic fit scoring (55 dimensions)
│   ├── profileWeights.ts        # Default + derived weights
│   └── wpaCache.ts              # DynamoDB cache helpers (shared across users)
├── src/components/property/
│   └── PersonalizedMatch.tsx    # "Why this works for you" UI
└── scripts/
    └── test-wpa.ts              # Manual WPA testing

MODIFY:
├── src/lib/recommender/orchestrator.ts  # Integrate fit scoring
├── src/app/(app)/property/[id]/page.tsx # Add PersonalizedMatch
└── src/app/admin/page.tsx               # WPA cache stats, cost tracking
```

---

## ⚡ Instant Recommendations (During Call)

### The Problem
User is on call → wants to see properties → WPA takes 15s+ → awkward silence

### Solution: Two-Tier WPA

```
┌───────────────────────────────────────────────────────────────────────┐
│  WPA (Flash-Lite)                                                     │
│  ─────────────────────                                                │
│  • Model: Claude 3 Haiku (Bedrock) or Gemini 2.5 Flash-lite          │
│  • Photos: All 30 (full WPA)                                          │
│  • Output: Quick scores + 2 standout features                         │
│  • Latency: 2-3 seconds                                               │
│  • Cost: $0.01-0.02 per listing                                       │
│                                                                       │
│  Use for: "Let me show you something interesting..."                  │
└───────────────────────────────────────────────────────────────────────┘
          │
          │ (Async, after call)
          ▼
┌───────────────────────────────────────────────────────────────────────┐
│  FULL WPA (Background)                                                │
│  ───────────────────                                                  │
│  • Model: Gemini 3 Pro Preview (thinking)                            │
│  • Photos: All 30                                                     │
│  • Output: Detailed scores, insights, concerns                        │
│  • Latency: 30-45 seconds                                             │
│  • Cost: $0.30-0.90 per listing                                       │
│                                                                       │
│  Use for: Saved properties, deep dive, recommendations feed           │
└───────────────────────────────────────────────────────────────────────┘
```

### Cheapest Fast Vision Models (Multi-Image)

| Model | Latency | Cost/5 imgs | Quality | Best For |
|-------|---------|-------------|---------|----------|
| **Claude 3 Haiku (Bedrock)** | 1-2s | **$0.002** | Medium | Instant preview |
| Gemini 2.5 Flash-lite | 2-3s | $0.003 | Medium | Instant preview |
| Gemini 2.5 Flash | 3-5s | $0.01 | Good | Quick analysis |
| GPT-4o mini | 2-3s | $0.005 | Good | Fallback |

### WPA Implementation (Flash-Lite)

```typescript
// src/lib/recommender/wpa.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface WPAResult {
  quickScore: number;        // 0-100 overall vibe
  standouts: string[];       // 2 best features
  concerns: string[];        // 1 concern if obvious
  latencyMs: number;
}

export async function runWPA(
  photos: string[],          // All photos (30)
  context: string            // Basic listing info
): Promise<WPAResult> {
  const start = Date.now();
  
  // Use Claude 3 Haiku on Bedrock for speed
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 200,  // Keep output tiny for speed
      messages: [{
        role: "user",
        content: [
          { type: "text", text: WPA_PROMPT },
          ...photos.map(url => ({  // All 30 photos
            type: "image",
            source: { type: "url", url }  // Direct URL, no base64
          }))
        ]
      }]
    }),
  }));
  
  return {
    ...parseResponse(response),
    latencyMs: Date.now() - start
  };
}

const WPA_PROMPT = `Property assessment. 
Give: score (0-100), 2 standouts, 1 concern if obvious.
JSON only: {"score":N,"standouts":["..."],"concerns":["..."]}`;
```

### ElevenLabs Agent Integration

#### Live Call Flow (The Dream)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER ON CALL WITH LEO                                                  │
│                                                                         │
│  User: "I'm looking for something around €400k in Gràcia or Eixample"  │
│        │                                                                │
│        ▼                                                                │
│  ┌─────────────────────────────────────────────┐                       │
│  │ 1. check_availability webhook               │  ← 1 second           │
│  │    → 47 properties match                    │                       │
│  │    → Returns top 3 with photo URLs          │                       │
│  └─────────────────────────────────────────────┘                       │
│        │                                                                │
│        ▼                                                                │
│  ┌─────────────────────────────────────────────┐                       │
│  │ 2. wpa webhook (3 photos each)      │  ← 2 seconds          │
│  │    → Claude 3 Haiku on Bedrock              │                       │
│  │    → Returns: score + 2 standouts + concern │                       │
│  └─────────────────────────────────────────────┘                       │
│        │                                                                │
│        ▼                                                                │
│  Leo: "Great news! I found 47 properties in your range.                │
│        Let me tell you about the best one I see...                     │
│                                                                         │
│        There's a €385k flat in Gràcia with incredible natural light    │
│        and a charming balcony overlooking a quiet courtyard.           │
│        The kitchen looks a bit dated, but that's an easy fix.          │
│                                                                         │
│        Should I save this one for you to look at later?"               │
│                                                                         │
│  User: "Yes! What else do you have?"                                   │
│        │                                                                │
│        ▼                                                                │
│  Leo: "The second one is a €410k place in Eixample - it's got          │
│        beautiful original tile floors and high ceilings, but           │
│        it's on a busier street. Could be noisier..."                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Total latency: ~3 seconds
Total cost: ~$0.06 (availability + 3 WPAs)
```

#### New Webhook Tool: `wpa`

```json
{
  "type": "webhook",
  "name": "wpa",
  "description": "Get a quick 2-second visual analysis of a property. Use after check_availability to describe properties to the user.",
  "api_schema": {
    "url": "https://leo.casa/api/agents/wpa",
    "method": "POST",
    "request_body_schema": {
      "type": "object",
      "required": ["listingId"],
      "properties": {
        "listingId": { "type": "string", "description": "The listing ID to analyze" },
        "photoUrls": { "type": "array", "description": "All photo URLs (optional, fetched if not provided)" }
      }
    }
  }
}
```

#### Agent Prompt Addition

```
TOOLS AVAILABLE:
- check_availability: Check how many properties match criteria. Returns count and top matches.
- wpa: Get quick visual analysis (2 seconds). Use this to describe properties.
- update_profile: Save preferences, dealbreakers, flexibility info.

RECOMMENDATION FLOW:
1. When user gives budget + location, call check_availability
2. If matches found, call wpa on top 1-3 properties
3. Describe properties conversationally using WPA insights
4. Ask if they want to save any
5. Call update_profile to save their preferences
```

---

## 🎯 In-Call Vibe-Check System (Two-Speed Recommendations)

### The Core Idea

**During calls (onboarding/follow-up):** Quick vibe-checks to validate properties with users and learn their preferences implicitly.

**After calls (3x daily cron):** Full recommendation pipeline using refined profile from call feedback.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DURING CALL: Fast Vibe-Check Loop (2-3 seconds)                            │
│  ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐                     │
│  │ Transcript  │───▶│ Flash-lite   │───▶│ DynamoDB    │                     │
│  │ so far      │    │ Interpreter  │    │ Query       │                     │
│  │ + profile   │    │ (~$0.005)    │    │ (FREE)      │                     │
│  └─────────────┘    └──────────────┘    └─────────────┘                     │
│                            │                   │                             │
│                            ▼                   ▼                             │
│                     ┌─────────────────────────────────────┐                 │
│                     │ Filters:                            │                 │
│                     │ • Location (from transcript/profile)│                 │
│                     │ • Basic info (beds, price)          │                 │
│                     │ • 20 dimensions (from profile)      │                 │
│                     └─────────────────────────────────────┘                 │
│                                    │                                         │
│                                    ▼                                         │
│                     ┌─────────────────────────────────────┐                 │
│                     │ Top 5-10 candidates                 │                 │
│                     └─────────────────────────────────────┘                 │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ WPA     │───▶│ Quick Fit       │───▶│ Push to         │         │
│  │ (Claude Haiku)  │    │ Score           │    │ Frontend        │         │
│  │ ~$0.02, 2-3s    │    │ (algorithmic)   │    │ (WebSocket)     │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                        │                     │
│                                                        ▼                     │
│                                   ┌─────────────────────────────────────┐   │
│                                   │  FRONTEND: Property Carousel Card   │   │
│                                   └─────────────────────────────────────┘   │
│                                                        │                     │
│                                                        ▼                     │
│                                              ┌─────────────────┐            │
│                                              │ User Reacts     │            │
│                                              │ (voice/text)    │            │
│                                              │ "Oh that's nice │            │
│                                              │ but too dark"   │            │
│                                              └─────────────────┘            │
│                                                        │                     │
│                                                        ▼                     │
│                                              ┌─────────────────┐            │
│                                              │ FEEDBACK        │            │
│                                              │ INTERPRETER     │            │
│                                              │ (Flash-lite)    │            │
│                                              │ ~$0.01          │            │
│                                              └─────────────────┘            │
│                                                        │                     │
│                                                        ▼                     │
│                                              ┌─────────────────┐            │
│                                              │ Prose Summary   │            │
│                                              │ stored in       │            │
│                                              │ Supabase        │            │
│                                              └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ (End of call)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST-CALL: Full Recommendation Pipeline (3x daily cron)                    │
│  ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PSYCHOLOGIST (Gemini 3 Pro Preview)                                  │    │
│  │                                                                       │    │
│  │ Inputs:                                                               │    │
│  │ ├── Full profile (from intake)                                       │    │
│  │ ├── Feedback summaries from vibe-checks (NEW!)                       │    │
│  │ │   "User rejected Gracia property due to light concerns"           │    │
│  │ │   "User loved Poblenou for the modern feel"                       │    │
│  │ ├── Saved/liked properties                                           │    │
│  │ └── Notes they've added                                              │    │
│  │                                                                       │    │
│  │ Outputs:                                                              │    │
│  │ ├── Refined dimension weights                                        │    │
│  │ ├── Updated dealbreakers (e.g., now MUST have good light)           │    │
│  │ └── Sweet spot locations                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ DynamoDB        │───▶│ Full WPA        │───▶│ Full Fit        │         │
│  │ Filter          │    │ (Gemini 3 Pro)  │    │ Scoring         │         │
│  │ (FREE)          │    │ (CACHED!)       │    │ (algorithmic)   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                        │                     │
│                                                        ▼                     │
│                                              ┌─────────────────┐            │
│                                              │ Push Top 10     │            │
│                                              │ Recommendations │            │
│                                              │ to User         │            │
│                                              └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Frontend: Property Carousel Card

**ElevenLabs can't show UI directly** - but it calls our webhook which pushes to the frontend via Supabase Realtime.

The card appears on the user's screen while they're on the call:

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 Gràcia, Barcelona                              €1,200/mo   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                                                        │   │
│  │     [Photo 1]  [Photo 2]  [Photo 3]  [Photo 4]        │   │
│  │        ●          ○          ○          ○              │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ☀️ Great natural light  │  🔇 Quiet street  │  🛋️ Move-in ready │
│                                                                │
│  "This place has floor-to-ceiling windows facing south,       │
│   modern kitchen with new appliances, and a small balcony.    │
│   It's on a quiet residential street in Gràcia, which has     │
│   great cafes and a young professional vibe."                 │
│                                                                │
│  2BR  •  65m²  •  Floor 3  •  No elevator                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘

User feedback is PURELY CONVERSATIONAL:
- They SAY what they think to Leo (voice)
- Or they TYPE in the chat if using text mode
- NO buttons for like/dislike
```

### Carousel Card Data Structure (WPA-Focused)

```typescript
interface VibeCheckCard {
  // Basic listing
  listing_id: string;
  photos: string[];       // All photos (30)
  price: number;
  bedrooms: number;
  m2: number;
  floor: number;
  has_elevator: boolean;
  
  // Location (from 20 dimensions)
  neighborhood: string;
  city: string;
  neighborhood_vibe: string;      // "Young professional, trendy cafes"
  neighborhood_scores: {
    quietness: number;
    safety: number;
    // whichever dimensions matter for this user
  };
  
  // WPA HIGHLIGHTS (the star of the show)
  wpa: {
    // Visual badges (3-4 max, from WPA scores)
    standout_badges: [
      { icon: "☀️", text: "Great natural light" },
      { icon: "🔇", text: "Quiet street views" },
      { icon: "🛋️", text: "Move-in ready" }
    ];
    
    // Short prose (2-3 sentences describing what they SEE)
    description: string;
    // "Floor-to-ceiling south-facing windows flood the living room with light.
    //  Modern kitchen with stainless appliances. The layout flows well with
    //  separated bedroom and living areas."
    
    // WPA Scores (not shown to user, used for ranking)
    scores: {
      natural_light: 85;
      quietness: 72;
      condition: 90;
      layout: 78;
      views: 65;
      outdoor_space: 40;  // Small balcony
      storage: 55;
      modernization: 88;
    };
    
    // Potential concerns (shown subtly if obvious)
    concerns: ["Limited storage", "No parking"];
  };
  
  // Fit score (not shown, used for ranking)
  fit_score: 82;
}
```

### The Feedback Interpreter (WPA-Focused)

When the user reacts (verbally or via text), we extract their preferences:

```typescript
// Called when Leo detects a reaction in the transcript
async function interpretFeedback(
  propertyShown: VibeCheckCard,
  transcriptSnippet: string,  // Last ~500 chars of conversation
  existingProfile: LifeProfile
): Promise<FeedbackSignal> {
  
  const prompt = `
    A user was shown this property during a call.
    
    WPA ANALYSIS (what they could SEE in photos):
    - Natural Light: ${propertyShown.wpa.scores.natural_light}/100
    - Condition: ${propertyShown.wpa.scores.condition}/100 
    - Layout: ${propertyShown.wpa.scores.layout}/100
    - Views: ${propertyShown.wpa.scores.views}/100
    - Outdoor Space: ${propertyShown.wpa.scores.outdoor_space}/100
    - Storage: ${propertyShown.wpa.scores.storage}/100
    - Modernization: ${propertyShown.wpa.scores.modernization}/100
    - Standouts: ${propertyShown.wpa.standout_badges.map(b => b.text).join(', ')}
    - Concerns: ${propertyShown.wpa.concerns.join(', ')}
    - Description: "${propertyShown.wpa.description}"
    
    NEIGHBORHOOD (${propertyShown.neighborhood}):
    - Vibe: ${propertyShown.neighborhood_vibe}
    - Quietness: ${propertyShown.neighborhood_scores.quietness}/100
    - Safety: ${propertyShown.neighborhood_scores.safety}/100
    
    LISTING BASICS:
    - ${propertyShown.bedrooms}BR, ${propertyShown.m2}m², €${propertyShown.price}/month
    - Floor ${propertyShown.floor}, ${propertyShown.has_elevator ? 'Has elevator' : 'No elevator'}
    
    USER REACTION (from transcript):
    "${transcriptSnippet}"
    
    Extract what the user liked/disliked about:
    
    1. VISUAL ASPECTS (what they SAW in photos - WPA focus)
       - Light, space, condition, style, layout, views, outdoor, storage
       
    2. LOCATION/NEIGHBORHOOD (from our 20 dimensions)
       - Vibe, noise, safety, amenities, commute
       
    3. PRACTICAL ASPECTS
       - Price, size, bedrooms, floor, elevator
    
    Output JSON:
    {
      "sentiment": "positive|neutral|negative",
      "property_liked": boolean,
      "location_liked": boolean,
      
      "visual_reactions": {
        "liked": ["natural light", "modern kitchen"],
        "disliked": ["cramped layout", "dark bedroom"],
        "wpa_weight_adjustments": {
          "natural_light": +20,  // They clearly care about this
          "layout": +15,
          "condition": 0         // Didn't mention
        }
      },
      
      "location_reactions": {
        "liked": ["quiet street", "young vibe"],
        "disliked": [],
        "dimension_adjustments": {
          "quietness": +10,
          "young_professional": +5
        }
      },
      
      "practical_reactions": {
        "concerns": ["price slightly high", "no elevator"],
        "flexibility": {}  // Any changes to budget/beds/etc
      },
      
      "new_dealbreakers": ["no natural light"],
      "new_preferences": ["needs quiet street", "prefers ground floor"],
      
      "prose_summary": "User loved the natural light (south-facing windows 
        stood out to them) and the quiet street in Gràcia. However, they 
        felt the layout was cramped, especially the bedroom. Light quality 
        is clearly a top priority. They also mentioned the lack of elevator 
        on floor 3 was concerning."
    }
  `;
  
  return await callGemini(prompt, { 
    model: 'gemini-2.5-flash-lite',
    temperature: 0.1  // Low temp for consistent extraction
  });
}
```

### Database: Storing Feedback Signals

```sql
-- New table: user_vibe_check_feedback
CREATE TABLE user_vibe_check_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Context
  conversation_id TEXT,           -- ElevenLabs conversation ID
  call_type TEXT,                 -- 'onboarding', 'followup'
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Property shown
  listing_id TEXT NOT NULL,
  listing_snapshot JSONB,         -- VibeCheckCard at time of showing
  
  -- Extracted feedback
  sentiment TEXT,                 -- 'positive', 'neutral', 'negative'
  property_liked BOOLEAN,
  location_liked BOOLEAN,
  
  -- WPA-specific reactions
  visual_liked TEXT[],            -- ['natural light', 'modern kitchen']
  visual_disliked TEXT[],         -- ['cramped layout']
  wpa_weight_adjustments JSONB,   -- {natural_light: +20, layout: +15}
  
  -- Location reactions  
  location_liked_aspects TEXT[],
  location_disliked_aspects TEXT[],
  dimension_adjustments JSONB,    -- {quietness: +10, young_professional: +5}
  
  -- Practical
  practical_concerns TEXT[],
  
  -- Prose for Psychologist
  prose_summary TEXT,
  
  -- Source
  transcript_snippet TEXT,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX idx_vibe_feedback_user ON user_vibe_check_feedback(user_id);
CREATE INDEX idx_vibe_feedback_listing ON user_vibe_check_feedback(listing_id);
```

### How Feedback Feeds the Psychologist

```typescript
// When Psychologist runs (3x daily or after call ends)
async function reconcileProfile(userId: string): Promise<RefinedProfile> {
  
  // Get existing profile
  const profile = await getProfile(userId);
  
  // Get all vibe-check feedback from recent calls
  const feedback = await supabase
    .from('user_vibe_check_feedback')
    .select('*')
    .eq('user_id', userId)
    .order('shown_at', { ascending: false })
    .limit(20);  // Last 20 properties shown
  
  // Build feedback summary for Psychologist
  const feedbackSummary = feedback.data.map(f => ({
    listing_id: f.listing_id,
    sentiment: f.sentiment,
    visual_liked: f.visual_liked,
    visual_disliked: f.visual_disliked,
    location_liked: f.location_liked_aspects,
    wpa_adjustments: f.wpa_weight_adjustments,
    dimension_adjustments: f.dimension_adjustments,
    prose: f.prose_summary
  }));
  
  // Psychologist prompt with feedback
  const psychologistPrompt = `
    Refine this user's profile based on their reactions to properties shown during calls.
    
    CURRENT PROFILE:
    ${JSON.stringify(profile, null, 2)}
    
    FEEDBACK FROM VIBE-CHECKS:
    ${feedbackSummary.map(f => `
      Property ${f.listing_id}:
      - Sentiment: ${f.sentiment}
      - Visual liked: ${f.visual_liked?.join(', ') || 'none'}
      - Visual disliked: ${f.visual_disliked?.join(', ') || 'none'}
      - Summary: "${f.prose}"
    `).join('\n')}
    
    Based on their reactions, update:
    1. WPA weight adjustments (which visual aspects matter most?)
    2. Dimension weight adjustments (which neighborhood aspects matter?)
    3. New dealbreakers discovered
    4. New preferences discovered
    5. Budget/practical flexibility changes
    
    Output the refined profile with updated weights.
  `;
  
  return await callGemini(psychologistPrompt, {
    model: 'gemini-3-pro-preview',
    thinkingConfig: { thinkingLevel: 'HIGH' }
  });
}
```

### ElevenLabs Agent Tool: `show_property`

```json
{
  "type": "webhook",
  "name": "show_property",
  "description": "Show the user a property that matches their criteria. This displays a photo carousel on their screen. Use to validate properties and get their reaction. Listen for their verbal feedback.",
  "response_timeout_secs": 8,
  "api_schema": {
    "url": "https://leo.casa/api/agents/vibe-check",
    "method": "POST",
    "request_body_schema": {
      "type": "object",
      "properties": {
        "transcriptContext": {
          "type": "string",
          "description": "Last ~500 chars of conversation to understand what they want"
        },
        "specificRequest": {
          "type": "string", 
          "description": "What specifically to look for based on their feedback (e.g., 'more light', 'bigger kitchen', 'quieter street')"
        }
      },
      "required": ["transcriptContext"]
    }
  }
}
```

### Conversational Flow Example

```
Leo: "So you're looking for a 2-bedroom in Barcelona, up to €1,500, 
     somewhere quiet enough to work from home..."

[SYSTEM: show_property webhook called]
[FRONTEND: Displays carousel card via WebSocket]

Leo: "Let me show you something interesting. I'm displaying a place 
     on your screen now - it's in Gràcia with beautiful south-facing 
     windows. Take a look at those photos. What catches your eye?"

User: "Oh wow, I love those windows! But honestly the living room 
       looks pretty small. Is there more space somewhere? And is 
       that street noisy? It looks like there's a lot of traffic."

[SYSTEM: Feedback Interpreter processes transcript]
[SYSTEM: Stores: visual_liked=["windows", "natural light"], 
                 visual_disliked=["small living room"],
                 location_concerns=["traffic noise"],
                 wpa_adjustments={natural_light: +20, layout: +15}
                 dimension_adjustments={quietness: +15}]

Leo: "Got it - you want that same amazing light but with a better 
     layout and on a quieter street. Give me a second..."

[SYSTEM: show_property called again with specificRequest="more space, quieter"]
[FRONTEND: Updates carousel with new property]

Leo: "How about this one? It's in Poblenou - bigger open-plan living 
     room, and it's on a residential street away from the main roads. 
     Similar light quality. What do you think?"

User: "That's much better! I like the open feel. Save that one for me."

[SYSTEM: Stores positive feedback, saves property]
```

### Cost Per Vibe-Check

| Step | Model | Cost |
|------|-------|------|
| Transcript → Query | Flash-lite | ~$0.005 |
| DynamoDB Query | - | FREE |
| WPA (1-2 properties) | Flash-Lite | ~$0.003-0.006 |
| Feedback Interpreter | Flash-lite | ~$0.01 |
| **Per Vibe-Check** | | **~$0.04** |

If we do 3-5 vibe-checks per call: **~$0.15-0.20/call**

### Summary: Two-Speed System

| Aspect | In-Call (Vibe-Check) | Post-Call (Full Pipeline) |
|--------|---------------------|---------------------------|
| **When** | During calls, on-demand | 3x daily cron |
| **Speed** | 2-3 seconds | 30-60 seconds |
| **WPA Model** | Gemini 2.5 Flash-Lite (30 photos) | Gemini 2.5 Flash-Lite (30 photos) |
| **Fit Scoring** | Quick algorithmic | Full with all signals |
| **Cost** | ~$0.04/property | ~$0.30-0.90/property |
| **Purpose** | Gather feedback, validate | Final recommendations |
| **Feedback** | Voice/text (conversational) | N/A |
| **WPA Caching** | NOT cached (instant) | CACHED (reused) |

### Why This Works

1. **Cheap in-call checks ($0.04)** gather implicit preferences
2. **No buttons** - pure conversational feedback (voice or text)
3. **WPA-focused** - reactions to what they SEE are most valuable
4. **Feedback Interpreter** turns reactions into structured signals
5. **Psychologist** uses signals to refine profile weights
6. **Full recommendations** benefit from learned preferences
7. **WPAs are cached** so other users benefit from full analysis

---

## 🏠 Analysis Pipeline → Recommender (What Can We Reuse?)

### Buyer vs Renter Feature Split

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RECOMMENDER FEATURES                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─── BOTH RENTER & BUYER ────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  • WPA Core (light, layout, views, outdoor space)              │    │
│  │  • Social Radar (noise, tourist saturation)                    │    │
│  │  • Isochrones (commute, proximity to POIs)                     │    │
│  │  • Fit Scoring (match to lifestyle profile)                    │    │
│  │  • WPA (live call preview)                             │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─── BUYER ONLY (transactionType === 'buy') ─────────────────────┐    │
│  │                                                                 │    │
│  │  FROM ANALYSIS PIPELINE:                                        │    │
│  │  ├── Smart M2 → Room size estimation                           │    │
│  │  ├── Baseline Check → Renovation cost per room type            │    │
│  │  ├── Condition Score → How much work needed (from WPA)         │    │
│  │  ├── Renovation Permits → Complexity indicator                 │    │
│  │  └── RAG Pricing → €/m2 from Habitissimo                       │    │
│  │                                                                 │    │
│  │  NEW PROFILE QUESTIONS:                                         │    │
│  │  ├── "How much renovation budget do you have?" (budgetReno)    │    │
│  │  ├── "Are you open to major works?" (tolerateRenovation)       │    │
│  │  └── "Move-in ready or project?" (conditionPreference)         │    │
│  │                                                                 │    │
│  │  DERIVED CALCULATIONS:                                          │    │
│  │  ├── totalBudget = budgetPurchase + budgetReno                 │    │
│  │  ├── effectivePrice = price + estimatedRenoCost                │    │
│  │  └── "Hidden Gem" Score = good bones + low price + high reno   │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─── RENTER ONLY (transactionType === 'rent') ───────────────────┐    │
│  │                                                                 │    │
│  │  • Nothing special (they care about as-is condition)           │    │
│  │  • Maybe: Furnishing quality score (if furnished)              │    │
│  │  • Maybe: Utility cost estimate (if available)                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Analysis Pipeline Components for Buyers

| Endpoint | What It Does | Cost | Use in Recommender |
|----------|--------------|------|-------------------|
| **Cadastre Lookup** | Official m2, year built, floor | **FREE** (Gov API) | ✅ Move to recommender |
| `/renovation/smart-m2` | Estimates room sizes from photos + total m2 | ~€0.05 (Gemini 2.5 Pro) | Calculate reno scope |
| `/renovation/baseline-check` | €/m2 costs from Habitissimo RAG | ~€0.03 (Flash-lite) | Estimate total reno cost |
| `/renovation-permits` | What permits needed | ~€0.10 (Gemini 3 Pro) | ❌ Too dependent on pipeline |
| `/analysis/whole-property` | Overall condition + details | ~€0.15 (Flash) | Condition score |
| `/intelligence/social-radar` | Noise, tourist pressure | ~€0.02 (Flash + SQLite) | Already for both |
| **Rental Yield** | Comparable rents in radius | **FREE** (DynamoDB query) | ✅ Move to recommender |

### Cadastre → Recommender (FREE!)

The Cadastre API is **completely free** - it's just XML calls to the Spanish government:

```typescript
// src/lib/cadastre/client.ts - Already built!
// Returns:
{
  surfaceConstructed: 85,     // Official m2 (not listing lies)
  yearBuilt: 1965,            // Building age
  floor: "03",                // Floor number
  usage: "vivienda",          // Property type
  livingArea: 75,             // Internal area
  storageArea: 10,            // Storage/parking
}
```

**Use in Recommender:**
- Validate listing claims (85m² claimed vs 72m² actual)
- Building age → maintenance expectations
- Floor number → elevator importance
- **Cost: €0.00**

### Rental Yield Estimate (Buyer-Investor) - FREE!

```typescript
// We have rental listings in leo-listings DynamoDB
async function estimateRentalYield(listing: Listing): Promise<number> {
  // Query same area, similar characteristics
  const comparables = await dynamoAdapter.queryListings({
    transactionType: 'rent',
    lat: listing.lat,
    lng: listing.lng,
    radiusKm: 0.5,
    bedrooms: listing.bedrooms,
    sqmRange: [listing.sqm * 0.85, listing.sqm * 1.15],
  });
  
  // Average monthly rent
  const avgRent = average(comparables.map(c => c.price));
  
  // Annual yield = (avgRent * 12) / purchasePrice * 100
  const grossYield = (avgRent * 12) / listing.price * 100;
  
  return grossYield; // e.g., 4.2%
}

// Cost: €0.00 (DynamoDB query)
```

### Buyer-Specific Profile Fields

```typescript
// user_lifestyle_profiles (extend for buyers)
interface BuyerExtension {
  // Budget
  budget_purchase_max: number;      // Max for purchase price
  budget_renovation: number;        // Available for renovation
  budget_total: number;             // Calculated: purchase + reno
  
  // Renovation Tolerance
  renovation_tolerance: 'none' | 'cosmetic' | 'major' | 'full_gut';
  timeline_tolerance_months: number; // How long can they wait?
  min_condition_score: number;      // 0 = accept any, 50 = decent, 80 = turnkey
  
  // Investor Mode
  is_investor: boolean;             // Looking for rental yield
  min_rental_yield_pct: number;     // e.g., 4.0 = minimum 4% gross yield
}
```

### Buyer Fit Scoring Formula

```typescript
// Enhanced fit scoring for buyers
function calculateBuyerFit(listing: Listing, profile: BuyerProfile, wpa: WPA): number {
  // Base score (same as renter)
  let score = calculateBaseFit(listing, profile, wpa);
  
  // === BUYER-SPECIFIC ADJUSTMENTS ===
  
  // 1. Total Cost Check (Purchase + Reno)
  const estimatedRenoCost = calculateRenoCost(listing, wpa.scores.condition);
  const effectivePrice = listing.price + estimatedRenoCost;
  
  if (effectivePrice > profile.budget_total) {
    score -= 30; // Over budget when including reno
  }
  
  // 2. Condition vs Tolerance
  const conditionScore = wpa.scores.condition;
  
  if (conditionScore < 40 && profile.renovation_tolerance === 'none') {
    score -= 50; // Needs work but buyer won't do it
  }
  
  if (conditionScore < 60 && profile.renovation_tolerance === 'major') {
    score += 15; // Good match - they're open to work
  }
  
  // 3. Price vs Neighborhood (pre-computed, FREE)
  if (listing.computed?.price_vs_neighborhood < -10) {
    score += 10; // 10%+ below neighborhood average = bonus
  }
  
  // 4. Rental Yield (for investor-buyers, pre-computed, FREE)
  if (profile.is_investor && listing.computed?.rental_yield_pct > 5) {
    score += 15; // Good yield = bonus for investors
  }
  
  return Math.max(0, Math.min(100, score));
}
```

### Buyer-Only Agent Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BUYER INTAKE (Additional Questions)                                   │
│                                                                         │
│  Leo: "Now, since you're buying, a few more questions...               │
│                                                                         │
│        What's your total budget including any renovation work?          │
│        [User: €450k total]                                             │
│                                                                         │
│        How much of that could go toward renovations if needed?          │
│        [User: Maybe €50k]                                              │
│                                                                         │
│        Are you open to properties that need work, or do you want        │
│        something move-in ready?"                                        │
│        [User: I'd consider something that needs cosmetic work]         │
│                                                                         │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                         │
│  DERIVED:                                                               │
│  • budget_purchase_max = €400k (450k - 50k buffer)                     │
│  • budget_renovation = €50k                                            │
│  • renovation_tolerance = 'cosmetic'                                   │
│  • seek_fixer_uppers = false (not actively seeking)                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### "Instant Reno Estimate" for Buyers (Live Call)

```typescript
// New webhook tool: instant_reno_estimate
// Super-fast estimate without running full pipeline

interface InstantRenoEstimate {
  conditionScore: number;           // From WPA
  estimatedCostRange: {
    low: number;
    high: number;
  };
  keyAreas: string[];               // "Kitchen looks dated", "Bathrooms need updating"
  latencyMs: number;                // Target: <3s
}

// Prompt for Claude 3 Haiku
const INSTANT_RENO_PROMPT = `Quick renovation estimate for property buyer.
From photos, estimate:
1. Condition score (0-100, 100=new)
2. Rough €/m2 renovation cost: 200=cosmetic, 500=standard, 800=major
3. What rooms need most work

JSON: {"condition":N,"euroPerM2":N,"keyAreas":["..."]}`;
```

---

## 🔍 What's Missing (Gap Analysis)

### Critical Gaps (P0)

| Gap | Impact | Effort | Solution |
|-----|--------|--------|----------|
| **WPA** | Show properties on call | Low | Flash-Lite is fast enough |
| **WPA uses wrong model** | Poor nuance | Low | Change to Gemini 3 Pro Preview |
| **Social Radar disconnected** | Noise data unused | Low | Wire to Fit Scoring |
| **AI Profiler disconnected** | Scenarios unused | Medium | Wire scenarios to recommendations |

### Missing Connections

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENTLY DISCONNECTED                                             │
│                                                                     │
│  AI Profiler outputs:                                               │
│  ├── user_persona ────────────────────┐                            │
│  ├── core_values ─────────────────────┤                            │
│  ├── hidden_gems ─────────────────────┼─── NOT USED IN FIT SCORING │
│  ├── scenarios (5 trade-offs) ────────┤                            │
│  └── property_preferences ────────────┘ (partially used)           │
│                                                                     │
│  Social Radar outputs:                                              │
│  ├── touristSaturationLevel ──────────┐                            │
│  ├── redFlags (noise, etc) ───────────┼─── NOT USED IN FIT SCORING │
│  └── riskLevel ───────────────────────┘                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Missing Infrastructure

| Component | Purpose | Status |
|-----------|---------|--------|
| `leo-user-signals` DynamoDB table | Store aggregated feedback | NOT CREATED |
| `leo-crowd-attributes` table | Store Social Radar results | NOT CREATED |
| Signal aggregation cron | Weekly profile refinement | NOT IMPLEMENTED |
| WPA endpoint | Vision for all cases | Use existing Flash-Lite WPA |

### Missing Integrations

| Integration | From | To | Status |
|-------------|------|-----|--------|
| AI Profiler → Fit Scoring | `ai-profiler.ts` | `fitScoring.ts` | ❌ |
| Social Radar → Fit Scoring | `social-radar.ts` | `fitScoring.ts` | ❌ |
| User Signals → Profile | `user_preference_signals` | `user_lifestyle_profiles` | ❌ |
| Notes → Signals | notes processing | signal aggregation | ⚠️ Partial |

---

## 📋 Implementation Priority

| Enhancement | Priority | Effort | Impact | Cost | Status |
|-------------|----------|--------|--------|------|--------|
| **Nightly Enrichment Pipeline** | P0 | Medium | Critical | ~€0.10/day | TODO |
| **WPA (Flash-Lite)** | P0 | Low | Critical | $0.003 | Single model for all WPA |
| **Cadastre Pre-Computation** | P0 | Low | High | **FREE** | TODO |
| **Neighborhood Profiles** | P0 | Medium | High | €0.50/week | TODO |
| **Rental Yield Pre-Computation** | P0 | Low | High | **FREE** | TODO |
| **Price Anomaly Detection** | P0 | Low | High | **FREE** | TODO |
| **Geo-Inference (nearby buildings)** | P0 | Medium | High | **FREE** | TODO |
| **Buyer: Visit Checklist** | P0 | Medium | High | €0.15 | TODO |
| **Buyer: Full Analysis (want to visit)** | P0 | High | Critical | €1.75 | TODO |
| **Buyer: Reno questions in intake** | P0 | Medium | High | FREE | TODO |
| **Buyer: Instant Reno Estimate** | P1 | Medium | High | €0.02 | TODO |
| Connect AI Profiler scenarios | P1 | Medium | High | FREE | TODO |
| Signal aggregation cron | P1 | Medium | High | FREE | TODO |
| ~~Social Radar~~ | ~~P1~~ | ~~Low~~ | ~~High~~ | | ✅ PRE-COMPUTED |
| ~~Full WPA (browse)~~ | ~~P0~~ | ~~Low~~ | ~~High~~ | ~~€0.30~~ | ⚠️ Only SAVED |
| ~~Smart M2 + Baseline~~ | ~~P1~~ | ~~Medium~~ | ~~High~~ | ~~€0.08~~ | ⚠️ PAID product |
| ~~Psychologist/AI Profiler~~ | ~~P2~~ | ~~High~~ | ~~High~~ | | ✅ DONE |
| leo-listings-enriched table | P2 | Low | High | FREE | TODO |
| ~~Clustering in Recommender~~ | ~~P?~~ | ~~High~~ | ~~?~~ | **€0.75** | ❌ Only Stage 4 |

---

