# Database Cleanup Analysis - Photos, Clusters, Visibility

**Date**: 2025-01-27  
**Purpose**: Identify unneeded, confusing, or deprecated tables related to photos, clusters, visibility, and storage

---

## 🔴 Critical Issues (Broken Code)

### 1. `room_clusters` Table - DROPPED BUT STILL REFERENCED

**Status**: ❌ **BROKEN** - Migration 010 dropped this table, but code still references it

**Migration**: `010_drop_deprecated_tables.sql` (line 9-11)
```sql
DROP TABLE IF EXISTS room_clusters CASCADE;
```

**But Code Still Uses It**:
- `src/app/api/listings/[id]/analysis/run-all/route.ts` (lines 51, 85, 198)
- `src/components/renovation/RenovationSlider.tsx` (line 853)
- `src/components/renovation/RenovationTierModal.tsx` (lines 57, 88)
- `src/app/api/listings/[id]/analysis/route.ts` (line 28)

**Impact**: These endpoints will fail at runtime with "relation does not exist" errors

**Fix Required**: 
- Update all references to use `manual_photo_clusters` instead
- Or verify if migration actually ran (check Supabase)

---

### 2. `deepdive_photos` Table - DEPRECATED BUT STILL REFERENCED

**Status**: ⚠️ **UNCLEAR** - Migration 008 says it was replaced, but code still uses it

**Migration**: `008_manual_photo_clusters.sql` (line 3)
```sql
-- Replaces: Dependence on deepdive_photos table for clustering storage
```

**But Code Still Uses It**:
- `src/app/api/deepdives/[id]/photos/route.ts` (lines 20, 33)

**Impact**: 
- If table doesn't exist → runtime error
- If table exists → using deprecated table

**Fix Required**:
- Check if `deepdive_photos` table actually exists
- If exists → migrate data to `manual_photo_clusters` and drop table
- If doesn't exist → update code to use `manual_photo_clusters`

---

## ⚠️ Confusing/Unneeded Columns

### 3. `room_type` Column - REDUNDANT WITH `cluster_name`

**Status**: ⚠️ **CONFUSING** - Exists but documentation says it's not needed

**Location**: 
- `manual_photo_clusters.room_type` (Migration 008)
- `auto_photo_clusters.room_type` (Migration 040)

**Documentation Says** (`docs/CLUSTERING_ARCHITECTURE.md`):
> **No classification needed** - just names and photos:
> - You create clusters with any names you want ("walk in wardrobe", "Master Suite")
> - Gemini analyzes the photos regardless of room name
> - The name is just descriptive, not a category

**Current Usage**:
- Some code sets it: `clusters/save/route.ts` sets `room_type: cluster.name`
- Some code reads it: `tiers/style-direction/route.ts` reads it for display
- Most code ignores it: Analysis endpoints use `cluster_name` only

**Index Exists**: `idx_manual_photo_clusters_room_type` (Migration 008, line 18)

**Recommendation**:
- **Option A**: Remove column entirely (breaking change if any code depends on it)
- **Option B**: Keep column but mark as deprecated, don't use in new code
- **Option C**: Keep column but document its purpose clearly (if it serves a different purpose than `cluster_name`)

**Decision Needed**: What is `room_type` actually for? Is it different from `cluster_name`?

---

## 🔄 Duplicate/Similar Tables

### 4. `auto_photo_clusters` vs `manual_photo_clusters` - CONFUSING NAMING

**Status**: ⚠️ **CONFUSING** - Both tables have nearly identical schemas

**Current State**:
- `manual_photo_clusters`: "Primary" clusters (populated by auto-clustering promotion)
- `auto_photo_clusters`: "Test" clusters (from auto-clustering pipeline)

**Problem**: 
- Auto-clustering is now **primary** (not test)
- Naming suggests "manual" is primary, but it's actually populated by auto-clustering
- Both tables have same columns: `cluster_name`, `room_type`, `photo_urls`, `display_order`

**Schema Comparison**:
```sql
-- manual_photo_clusters (Migration 008)
listing_id BIGINT
cluster_name TEXT
room_type TEXT
photo_urls TEXT[]
display_order INTEGER
visibility_mappings JSONB (added Migration 019)
selected_photo_url TEXT (added Migration 032)

-- auto_photo_clusters (Migration 040)
listing_id TEXT  -- ⚠️ Different type!
cluster_name TEXT
room_type TEXT
photo_urls TEXT[]
photo_indices INTEGER[]  -- Extra field
display_order INTEGER
source_stage TEXT  -- Extra field
confidence DECIMAL  -- Extra field
test_run_id TEXT  -- Extra field
```

**Issues**:
1. `listing_id` type mismatch: `BIGINT` vs `TEXT` (incompatible)
2. `auto_photo_clusters` has extra fields that `manual_photo_clusters` doesn't
3. Naming is backwards: "auto" is now primary, "manual" is deprecated UI

**Recommendation**:
- **Option A**: Rename `manual_photo_clusters` → `photo_clusters` (remove "manual")
- **Option B**: Keep both but document clearly: `auto_photo_clusters` = test/debug, `manual_photo_clusters` = production
- **Option C**: Merge into single table with `source` field (`'auto'` | `'manual'`)

---

## ✅ Views & Functions

### 5. `clusters_normalized` View - USEFUL BUT INCLUDES `room_type`

**Status**: ✅ **USEFUL** - But includes `room_type` which may not be needed

**Purpose**: Pre-joins clusters with furniture-free photos and normalizes visibility mappings

**Used By**:
- `src/lib/room-analysis-helpers.ts` - `getNormalizedClusters()` function
- Analysis endpoints that need normalized data

**Issue**: View includes `room_type` column (line 57) which may not be needed

**Recommendation**: Keep view, but consider removing `room_type` from SELECT if it's not used

---

## 📊 Storage Tables

### 6. `listing_photos` - CORE TABLE (KEEP)

**Status**: ✅ **CORE** - This is the primary photo storage table

**Columns**:
- `id`, `listing_id`, `url` (Supabase Storage URL)
- `original_url` (Idealista URL - Migration 010)
- `filename` (Storage filename - Migration 010)
- `display_order`

**Purpose**: Stores all property photos with Supabase Storage URLs

**Recommendation**: ✅ **KEEP** - This is essential

---

### 7. `listing_photos_furniture_free` - AFTER IMAGE PIPELINE (KEEP)

**Status**: ✅ **USED** - Stores furniture-free versions of photos

**Purpose**: Used by R pipeline (after image generation)

**Recommendation**: ✅ **KEEP** - Required for after image pipeline

---

## 🗑️ Deprecated Tables (Already Dropped)

### 8. Tables Dropped in Migration 010

**Status**: ✅ **DROPPED** - But verify code doesn't reference them

- `idealista_info_extraction` - Replaced by `text_analysis_results`
- `room_clusters` - Replaced by `manual_photo_clusters` (but code still references!)
- `image_clusters` - Unused table
- `segmentation_masks` - Not used in current pipeline

**Action**: Verify no code references these tables

---

## 📋 Summary & Recommendations

### Immediate Actions Required

1. **Fix `room_clusters` references** (CRITICAL)
   - Update `analysis/run-all/route.ts`
   - Update `RenovationSlider.tsx`
   - Update `RenovationTierModal.tsx`
   - Update `analysis/route.ts`
   - Replace with `manual_photo_clusters`

2. **Fix `deepdive_photos` references**
   - Check if table exists
   - Update `deepdives/[id]/photos/route.ts` to use `manual_photo_clusters`
   - Drop table if deprecated

### Cleanup Opportunities

3. **Clarify `room_type` column**
   - Document its purpose vs `cluster_name`
   - Remove if truly redundant
   - Or keep but mark as optional/deprecated

4. **Rename or merge cluster tables**
   - Consider renaming `manual_photo_clusters` → `photo_clusters`
   - Or document clearly: auto = test, manual = production
   - Fix `listing_id` type mismatch between tables

### Keep (Essential)

- ✅ `listing_photos` - Core photo storage
- ✅ `listing_photos_furniture_free` - After image pipeline
- ✅ `manual_photo_clusters` - Primary cluster storage
- ✅ `clusters_normalized` - Useful view for analysis
- ✅ `auto_photo_clusters` - Test/debug clusters (if keeping separate)

---

## 🔍 Verification Checklist

- [ ] Check if `room_clusters` table actually exists (migration may not have run)
- [ ] Check if `deepdive_photos` table exists
- [ ] Verify all code references updated
- [ ] Test endpoints that reference dropped tables
- [ ] Document `room_type` purpose or remove it
- [ ] Decide on cluster table naming strategy

---

## 📝 Migration Plan

### Phase 1: Fix Broken References
1. Update all `room_clusters` → `manual_photo_clusters`
2. Update all `deepdive_photos` → `manual_photo_clusters`
3. Test all affected endpoints

### Phase 2: Cleanup Columns
1. Document or remove `room_type` column
2. Remove index if column removed

### Phase 3: Table Consolidation (Optional)
1. Rename `manual_photo_clusters` → `photo_clusters`
2. Or merge `auto_photo_clusters` into `manual_photo_clusters` with `source` field
3. Fix `listing_id` type consistency

---

**Next Steps**: Review this analysis and decide on:
1. Fix broken references (immediate)
2. `room_type` column fate
3. Cluster table naming strategy

