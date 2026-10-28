# Clear Records Guide - Pipeline Simplification

**Date:** 2025-01-27  
**Phase 1 & 2:** Enhanced Room-by-Room + Tier Element Synthesis

---

## 🎯 Recommended Clearing Points

### Option 1: Clear from RoomByRoom (Recommended)
**Clear from:** `RoomByRoom` step

**Why:**
- Room-by-Room now uses OMSRIA images (R1.5) - but has fallback to original photos
- Room-by-Room now generates allocentric layouts (new fields)
- TierElementSynthesis needs Room-by-Room's allocentric layouts (optional but preferred)

**What to clear:**
```sql
-- Clear Room-by-Room outputs (will regenerate with new structure)
DELETE FROM room_analyses WHERE listing_id = 'YOUR_LISTING_ID';

-- Clear legacy tier generation (will be replaced by TierElementSynthesis)
DELETE FROM group_tier_directives WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM e2_tier_target_states WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM cohesion_notes WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM tier_element_synthesis WHERE listing_id = 'YOUR_LISTING_ID'; -- Clear old if exists

-- Clear downstream steps that depend on tier generation
DELETE FROM renovation_scope_reports WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM renovation_prompts WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM after_photos WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM room_image_descriptions WHERE listing_id = 'YOUR_LISTING_ID';

-- KEEP whole_property_analysis (F3 runs before RoomByRoom, H and T1.5 need it)
-- KEEP text_analysis_results (G and H need it)
-- KEEP manual_photo_clusters (required for RoomByRoom)
-- KEEP omsria_processed_images (already processed, RoomByRoom will use them)
```

**Then run orchestrator from:** `RoomByRoom`

---

### Option 2: Clear from TierElementSynthesis (Minimal)
**Clear from:** `TierElementSynthesis` step

**Why:**
- TierElementSynthesis is a new consolidated step
- Room-by-Room can work with existing data (has fallback)
- Only tier generation needs regeneration

**What to clear:**
```sql
-- Clear legacy tier generation
DELETE FROM group_tier_directives WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM e2_tier_target_states WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM cohesion_notes WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM tier_element_synthesis WHERE listing_id = 'YOUR_LISTING_ID';

-- Clear downstream steps
DELETE FROM renovation_scope_reports WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM renovation_prompts WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM after_photos WHERE listing_id = 'YOUR_LISTING_ID';
```

**Then run orchestrator from:** `TierElementSynthesis`

**Note:** Room-by-Room will use existing data (won't get new allocentric layouts unless you clear it)

---

### Option 3: Clear from R1.5 (OMSRIA) - Full Test
**Clear from:** `R1.5` step

**Why:**
- Ensures Room-by-Room gets OMSRIA images (no fallback)
- Ensures all Phase 1 & 2 features are tested fresh
- Most comprehensive test

**What to clear:**
```sql
-- Clear OMSRIA outputs (will regenerate)
DELETE FROM omsria_processed_images WHERE listing_id = 'YOUR_LISTING_ID';

-- Clear Room-by-Room (will regenerate with OMSRIA images)
DELETE FROM room_analyses WHERE listing_id = 'YOUR_LISTING_ID';

-- Clear legacy tier generation
DELETE FROM group_tier_directives WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM e2_tier_target_states WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM cohesion_notes WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM tier_element_synthesis WHERE listing_id = 'YOUR_LISTING_ID';

-- Clear downstream steps
DELETE FROM renovation_scope_reports WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM renovation_prompts WHERE listing_id = 'YOUR_LISTING_ID';
DELETE FROM after_photos WHERE listing_id = 'YOUR_LISTING_ID';
```

**Then run orchestrator from:** `R1.5`

**Note:** This requires R1 (Select Room Images) to have run first

---

## 📋 Step Dependencies

### Room-by-Room (Phase 1 Enhancement) Needs:
- ✅ `manual_photo_clusters` - Room clusters (must exist)
- ✅ `omsria_processed_images` - OMSRIA images (preferred, has fallback)
- ⚠️ `room_analyses.unified_home_layout_json` - E2 layout (optional, backward compatible)
- ⚠️ `room_analyses.room_layout_json` - E1 layouts (optional, backward compatible)

### TierElementSynthesis (Phase 2) Needs:
- ✅ `tier_philosophies` - Tier definitions (T2)
- ✅ `style_direction` - Style direction (T2.5)
- ✅ `room_families` - Room families (T1)
- ✅ `e2_element_mapping` - Element mappings
- ⚠️ `room_analyses.layout_allocentric` - Allocentric layouts (optional, preferred)
- ⚠️ `room_analyses.whole_home_summary` - Whole-home summary (optional, preferred)

---

## 🚀 Quick Commands

### Clear from RoomByRoom (Recommended)
```bash
# Using MCP Supabase
# Then run orchestrator:
cd /Users/peterneyra/puedo_casa && npx tsx scripts/run-orchestrator.ts YOUR_LISTING_ID --startFrom RoomByRoom
```

### Clear from TierElementSynthesis (Minimal)
```bash
# Using MCP Supabase
# Then run orchestrator:
cd /Users/peterneyra/puedo_casa && npx tsx scripts/run-orchestrator.ts YOUR_LISTING_ID --startFrom TierElementSynthesis
```

### Clear from R1.5 (Full Test)
```bash
# Using MCP Supabase
# Then run orchestrator:
cd /Users/peterneyra/puedo_casa && npx tsx scripts/run-orchestrator.ts YOUR_LISTING_ID --startFrom R1.5
```

---

## ⚠️ Important Notes

1. **Room-by-Room has fallback** - Can work without OMSRIA images (uses original photos)
2. **TierElementSynthesis has fallback** - Can work without allocentric layouts (uses E2 unified layout)
3. **Legacy tables are deprecated** - But clearing them ensures clean test
4. **Downstream steps must be cleared** - I, J, K, L, M, N, R2a, R2b, R3 all depend on tier generation

---

## ✅ Recommended Approach

**For testing Phase 1 & 2 together:**
- Clear from: `RoomByRoom`
- This ensures:
  - Room-by-Room regenerates with allocentric layouts
  - TierElementSynthesis gets fresh allocentric layouts
  - All downstream steps regenerate with new data

**For testing Phase 2 only:**
- Clear from: `TierElementSynthesis`
- This ensures:
  - Tier generation uses new consolidated approach
  - Room-by-Room data can be reused (if acceptable)

---

**Last Updated:** 2025-01-27

