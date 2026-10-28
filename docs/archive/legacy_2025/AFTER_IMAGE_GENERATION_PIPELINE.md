# After Image Generation Pipeline

**⚠️ STATUS: This document describes the Q pipeline which has been REMOVED.**

**Current Standard Pipeline:** R Pipeline (Room-Based Approach)

See `PIPELINE_FLOW.md` for the current R pipeline documentation:
- F0: Furniture Removal
- R1: Select Room Images
- R2a: Describe Room Images
- R2b-Master: Generate Master References
- R2b: Generate Room Prompts
- R3: Render Rooms
- R4: Consistency Pass (without furniture)
- R5-Master: Generate Furniture Master References
- R5: Add Furniture
- R6: Consistency Pass (with furniture)

---

## 🧭 Q Pipeline (REMOVED)

**Status:** All Q pipeline endpoints have been removed. This documentation is kept for historical reference only.

The Q pipeline created consistent, high-quality "after renovation" renders for all photos of a property using **text-coordinated consistency** instead of visual cascading.

**Q Pipeline Flow (REMOVED):**
1. **Q1** → Style Direction: Establish baseline aesthetic and design directions (REMOVED - replaced by T2.5)
2. **E5** → Per-Photo POV Extraction: Extract camera perspective, composition, visible elements, adjacent rooms (REMOVED - replaced by R2a)
3. **Q2** → Tier-Specific Canonical Layouts: Generate tier-specific "after" layouts with material invariants (REMOVED - material specs now come from T6.5)
4. **Q3** → Per-Photo Prompt Synthesis: Create coordinated per-photo prompts combining all context (REMOVED - replaced by R2a + R2b)
5. **Q4** → After-Image Render: Generate after images using Q3 prompts (REMOVED - replaced by R3)

**Prerequisites:**
- **Tier Ideation Pipeline** (T1-T5.5) must be completed before Q2/Q3:
  - **T1**: Group & Catalog (`/api/listings/[id]/rooms/group-catalog`)
  - **T2**: Tier Ideation (`/api/listings/[id]/tiers/ideation`)
  - **T3**: Apply to Groups (`/api/listings/[id]/tiers/apply-to-groups`)
  - **T4**: Decide Elements (`/api/listings/[id]/tiers/decide-elements`) - **Required for T5**
  - **T5**: Cohesion (`/api/listings/[id]/tiers/cohesion`) - **Identifies consistency issues**
  - **T5.5**: Apply Cohesion Corrections (`/api/listings/[id]/tiers/apply-cohesion-corrections`) - **Required for Q2** (applies T5 corrections to T4 decisions)

**Key Difference from Legacy Old Q2-Q5:**
- ❌ **Legacy**: Image-to-image style transfer with cascading visual references (Old Q3→Old Q4→Old Q5)
- ✅ **New**: Text-coordinated consistency via structured prompts (E5→Q2→Q3→Q4) with tier ideation pipeline integration
- ❌ **Removed**: Old `/api/listings/[id]/after/map-elements` (replaced by T1) and `/api/listings/[id]/after/decide-tier-states` (replaced by T4 → T5.5)

---

## ⚙️ Q1 — After Image Style Direction

### Purpose
Establish the baseline aesthetic and realistic design directions for the property based on current state and renovation tiers.

### Inputs
- Listing metadata (title, location, property type, year)
- Whole property analysis (structure, finishes, lighting)
- Optional room analyses for material cues

### Endpoint
`POST /api/listings/[id]/style-direction`

### Model
- **Gemini 2.5 Flash** with `googleSearch` grounding
- Temperature: 0.15
- Auto thinking enabled

### Output
```json
{
  "listing_id": "1000000121",
  "generated_at": "2025-01-27T10:00:00Z",
  "baseline_summary": "Short 2–3 sentence overview of the property's aesthetic identity and state.",
  "architectural_period": "e.g. '1970s coastal apartment block'",
  "regional_influences": ["..."],
  "viable_directions": ["..."],
  "material_palette": ["..."],
  "tone_summary": "..."
}
```

### Documentation
See existing implementation: `src/app/api/listings/[id]/style-direction/route.ts`

---

## ⚙️ E5 — Per-Photo POV Extraction

### Purpose
Extract detailed camera perspective, composition, and visible elements for each photo to enable coordinated prompt generation.

### Inputs
- Photo (base64 image)
- E1 layout (per-room structure)
- E2 layout (home connections)

### Endpoint
`POST /api/listings/[id]/photos/pov/describe`

### Model
- **Gemini 2.5 Pro** (structured output)
- Temperature: 0.2
- Thinking budget: 16384
- Max output tokens: 8192

### Output Schema
```json
{
  "items": [
    {
      "photo_url": "https://...",
      "camera_pov": "from bed toward terrace",
      "orientation": "toward window wall",
      "composition": {
        "thirds": {
          "left": ["sofa", "side table"],
          "center": ["window", "sea view"],
          "right": ["sideboard", "artwork"]
        },
        "depth": {
          "fg": ["sofa", "coffee table"],
          "mg": ["window frame", "curtains"],
          "bg": ["sea", "sky"]
        }
      },
      "visible_in_room": [
        {
          "element": "sofa",
          "surface": "fabric",
          "prominence": "high",
          "notes": "Patterned cushions"
        }
      ],
      "visible_adjacent_rooms": [
        {
          "room_id": "76",
          "room_name": "Dining Area",
          "elements_visible": ["table edge", "pendant lights", "doorway opening"]
        }
      ],
      "watermark_present": true,
      "uncertainties": {
        "level": "low",
        "notes": []
      }
    }
  ]
}
```

### Database
Saves to `photo_pov` table:
- `listing_id`, `room_id`, `photo_url` (primary key)
- `camera_pov`, `orientation`, `composition`, `visible_in_room`
- `visible_adjacent_rooms`, `watermark_present`, `uncertainties`

### Documentation
See implementation: `src/app/api/listings/[id]/photos/pov/describe/route.ts`

---

## ⚙️ Q2 — Tier-Specific Canonical Layouts

### Purpose
Translate corrected element decisions ("what changes") into material specifications ("how it looks") for consistent image generation across all photos. Generates tier-specific "after" layouts with material invariants (surfaces, colors, allowed changes).

### Inputs
- **Corrected T4: Tier target states** (`e2_tier_target_states` table) - Element-level decisions after T5.5 corrections applied
- **T5: Cohesion notes** (`cohesion_notes` table) - Holistic guidance for material consistency, color harmony, style coherence
- E2 unified layout
- Final renovation scope for tier
- Style direction (Q1)

### Endpoint
`POST /api/listings/[id]/after/layouts`

### Model
- **Gemini 2.5 Pro** (structured output)
- Temperature: 0.3
- Thinking budget: 32768
- Max output tokens: 16384

### Output Schema
```json
{
  "layout_after": {
    "surfaces": {
      "75": {
        "walls": { "color_hex": "#F9F8F6", "finish": "matte" },
        "floor": { "type": "natural oak", "color_hex": "#C6A67A", "finish": "satin" },
        "trim": { "color_hex": "#EDEAE5", "finish": "eggshell" }
      }
    },
    "allowed_changes": {
      "75": ["modernize existing sofa upholstery", "update lighting fixtures"]
    },
    "global_invariants": {
      "palette": [
        { "name": "Warm White", "hex": "#F9F8F6" },
        { "name": "Natural Oak", "hex": "#C6A67A" }
      ],
      "metals": ["brushed nickel", "matte black"],
      "wood_tones": [
        { "name": "Natural Oak", "hex": "#C6A67A" }
      ],
      "sheen_levels": {
        "walls": "matte",
        "trim": "eggshell",
        "cabinetry": "satin"
      }
    },
    "photography_realism_rules": [
      "Film-like tone-curve",
      "Natural lighting",
      "No HDR",
      "Lived-in realism"
    ]
  }
}
```

### Database
Saves to `after_layouts` table:
- `listing_id`, `tier` (primary key)
- `layout_after` (JSONB)

### Documentation
See implementation: `src/app/api/listings/[id]/after/layouts/route.ts`

---

## ⚙️ Q3 — Per-Photo Prompt Synthesis

### Purpose
Generate coordinated per-photo prompts that combine E5 POV data, Q2 layouts, E1/E2 structural context, style direction, renovation scope, and cohesion notes into a single, comprehensive prompt for image generation.

### Inputs
- **Corrected T4: Tier target states** (`e2_tier_target_states` table) - Element-level decisions after T5.5 corrections
- **T5: Cohesion notes** (`cohesion_notes` table) - Holistic guidance for material consistency, color harmony, style coherence
- E5 POV data (per photo)
- Q2 layout (per tier)
- E1/E2 layouts (structural context)
- Style direction (Q1)
- Final renovation scope (per tier)

### Endpoint
`POST /api/listings/[id]/after/prompts`

### Model
- **Gemini 2.5 Pro** (text output)
- Temperature: 0.2
- Thinking budget: 16384
- Max output tokens: 8192

### Output
Array of prompts, one per photo/tier:
```json
{
  "prompts": [
    {
      "photo_url": "https://...",
      "prompt_text": "PHOTOGRAPHY LOCK:\nPreserve EXACT camera viewpoint...\n\nSURFACES/MATERIAL INVARIANTS:\nWalls: #F9F8F6 matte...\n\n..."
    }
  ]
}
```

### Prompt Structure (Template)
```
PHOTOGRAPHY LOCK:
Preserve exact camera viewpoint, lens, and framing. Do not shift viewpoint. Match depth-of-field. Film-like tone. No HDR.

SURFACES/MATERIAL INVARIANTS (from Q2):
Walls: #F9F8F6 matte
Floor: natural oak #C6A67A satin
Trim: #EDEAE5 eggshell
Metal: brushed nickel
Stone: Calacatta gold #E7E2D6

PER-PHOTO VISIBLE CONSTRAINTS (from E5):
Visible in frame: left=sofa+throw; center=window bay+sea; right=sideboard
Update upholstery only; do not add furniture; refresh finish per palette

ADJACENT-ROOM HARMONIZATION (from E5):
Visible DiningArea through arch: ensure pendant glow and oak tone match DiningArea invariants

NEGATIVE CONSTRAINTS:
No new pieces unless scope explicitly lists them. Avoid plastic look. Remove ALL watermarks/logos/text.

TIER DELTAS:
[Livable: refresh surfaces only | Comfortable: upgrade key finishes | Competitive: premium finish set]
```

### Database
Saves to `after_prompts` table:
- `listing_id`, `tier`, `photo_url` (primary key)
- `prompt_text`, `tokens_estimate`

### Documentation
See implementation: `src/app/api/listings/[id]/after/prompts/route.ts`

---

## ⚙️ Q4 — After-Image Render

### Purpose
Generate after images using Q3 prompts. **One generation per photo/tier** - no cascading visual references. Consistency achieved via text constraints.

### Inputs
- Q3 prompt (per photo/tier)
- Before photo (base64 image)

### Endpoint
`POST /api/listings/[id]/after/render`

### Model
- **Gemini 2.5 Flash Image**
- Temperature: 0
- TopP: 0.7 (lower than legacy 0.95 for more deterministic output)
- Max output tokens: 32768

### Key Differences from Legacy Q3/Q4/Q5
- ✅ **No anchor images** - each photo generated independently
- ✅ **No cascading visual references** - consistency via text constraints
- ✅ **No multi-image style transfer** - single before photo + prompt
- ✅ **Text-based harmonization** - adjacent rooms harmonized via prompt constraints, not visual references

### Output
```json
{
  "rendered_images": [
    {
      "photo_url": "https://...",
      "after_url": "https://..."
    }
  ]
}
```

### Database
Saves to `after_photos` table:
- `listing_id`, `tier`, `room_id`, `photo_url` (unique constraint)
- `url` (after image URL)
- `is_anchor: false`, `harmonized: false` (Q4 doesn't use these concepts)

### Documentation
See implementation: `src/app/api/listings/[id]/after/render/route.ts`

---

## 🔄 Orchestration

### Endpoint
`POST /api/listings/[id]/after/generate-all`

### Process
1. **Q1**: Verify style direction exists (generate if missing)
2. **E5**: Per-photo POV extraction (if not exists or `skip_pov !== true`)
3. **Q2**: Tier-specific layouts (if not exists or `skip_layouts !== true`)
4. **Q3**: Per-photo prompt synthesis (for all tiers)
5. **Q4**: After-image rendering (for all tiers)

### Parameters
```json
{
  "tiers": ["estandar", "optimo", "plus"], // optional, defaults to all
  "skip_pov": false, // optional, skip E5 if POV already exists
  "skip_layouts": false // optional, skip E2-After if layouts already exist
}
```

### Documentation
See implementation: `src/app/api/listings/[id]/after/generate-all/route.ts`

---

## 📊 Database Schema

### `photo_pov` (E5 output)
```sql
CREATE TABLE photo_pov (
  listing_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  camera_pov TEXT NOT NULL,
  orientation TEXT,
  composition JSONB NOT NULL,
  visible_in_room JSONB NOT NULL,
  visible_adjacent_rooms JSONB,
  watermark_present BOOLEAN DEFAULT false,
  uncertainties JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, photo_url)
);
```

### `after_layouts` (Q2 output)
```sql
CREATE TABLE after_layouts (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  layout_after JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier)
);
```

### `after_prompts` (Q3 output)
```sql
CREATE TABLE after_prompts (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  photo_url TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  tokens_estimate INT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier, photo_url)
);
```

### `after_photos` (Q4 output)
```sql
-- Uses existing table, but Q4 images have:
-- is_anchor: false
-- harmonized: false
-- Identified by checking if Q3 prompt exists for photo_url/tier
```

---

## 🎯 Success Criteria (R Pipeline)

- ✅ All rooms have selected images (R1)
- ✅ All selected images have egocentric descriptions (R2a)
- ✅ All tiers have master reference images (R2b-Master)
- ✅ All rooms have detailed renovation prompts (R2b)
- ✅ All rooms have after images without furniture (R3)
- ✅ Cross-room consistency without furniture (R4)
- ✅ All tiers have furniture master references (R5-Master)
- ✅ All rooms have furniture layer (R5)
- ✅ Final consistency pass with furniture (R6)
- ✅ After images match room layouts
- ✅ No watermarks in after images
- ✅ Consistent materials/colors across rooms
- ✅ Realistic (not dream-like) appearance
- ✅ Furniture matches tier style and budget

---

## 🔄 Migration from Legacy Q2-Q5

### Q Pipeline (REMOVED)
All Q pipeline endpoints have been removed:
- ~~Q1: Style Direction (`/api/listings/[id]/style-direction`)~~ - **REMOVED** (replaced by T2.5)
- ~~E5: Per-photo POV extraction (`/api/listings/[id]/photos/pov/describe`)~~ - **REMOVED** (replaced by R2a)
- ~~Q2: Tier-specific canonical layouts (`/api/listings/[id]/after/layouts`)~~ - **REMOVED** (material specs from T6.5)
- ~~Q3: Per-photo prompt synthesis (`/api/listings/[id]/after/prompts`)~~ - **REMOVED** (replaced by R2a + R2b)
- ~~Q4: Single after-image render (`/api/listings/[id]/after/render`)~~ - **REMOVED** (replaced by R3)
- ~~Old Q2: Map Elements (`/api/listings/[id]/after/map-elements`)~~ - **REMOVED** (replaced by T1)
- ~~Old Q3: Decide Tier States (`/api/listings/[id]/after/decide-tier-states`)~~ - **REMOVED** (replaced by T4)
- ~~Old Q2: Room-wide prompts (`/api/listings/[id]/renovation-style-prompts`)~~ - **REMOVED** (replaced by R2b)
- ~~Old Q3: Anchor images (`/api/listings/[id]/rooms/[roomId]/after/anchor`)~~ - **REMOVED** (replaced by R3)
- ~~Old Q4: Angle-matched images (`/api/listings/[id]/rooms/[roomId]/after/angle-match`)~~ - **REMOVED** (replaced by R3)
- ~~Old Q5: Cross-room harmonization (`/api/listings/[id]/after/cross-room-consistency`)~~ - **REMOVED** (replaced by R4 + R6)

### Current Pipeline (R Pipeline - Standard)
- **Tier Ideation Pipeline** (T1-T6.5): Prerequisites for R pipeline
  - T1: Group & Catalog
  - T1.5: Tier Budgeting
  - T2: Tier Ideation
  - T2.5: Tier Style Direction (replaces old Q1)
  - T3: Apply to Groups
  - T4: Decide Elements
  - T5: Cohesion
  - T5.5: Apply Cohesion Corrections
  - T6: Budget Calibration
  - T6.5: Iterate Element Decisions (conditional)
- **R Pipeline**: F0 → R1 → R2a → R2b-Master → R2b → R3 → R4 → R5-Master → R5 → R6

### Key Advantages
1. **No cascading errors** - each image generated independently
2. **Text-coordinated consistency** - shared material invariants ensure consistency
3. **Better realism** - single generation per photo, no compounding artifacts
4. **Easier debugging** - prompts are explicit and reviewable
5. **Faster** - no sequential cascading, parallel generation possible

---

## 📝 Testing

### Test Page
`/test-after-images` - Shows before + R1 after images (with legacy Q3/Q4/Q5 for comparison)

### Test Flow
1. **Prerequisites**: Complete tier ideation pipeline (T1-T5.5)
   - T1: Group & Catalog
   - T2: Tier Ideation
   - T3: Apply to Groups
   - T4: Decide Elements
   - T5: Cohesion (identifies issues)
   - T5.5: Apply Cohesion Corrections (required for Q2 - applies corrections to T4)
2. Run Q1: Style Direction
3. Run E5: POV extraction
4. Run Q2: Layout generation (all tiers) - uses corrected T4 decisions
5. Run Q3: Prompt synthesis (all tiers)
6. Run Q4: Image rendering (all tiers)
7. Verify in test page

---

## 🚀 Future Improvements

- [ ] Optimize prompt length (currently ~2000-4000 tokens)
- [ ] Add prompt caching for faster re-runs
- [ ] Implement prompt versioning
- [ ] Add prompt quality metrics
- [ ] A/B test R1 vs. Q3/Q4/Q5 outputs
