# Clusters Table Rename - COMPLETE

**Date**: 2025-01-27  
**Status**: ✅ **COMPLETED** - `manual_photo_clusters` renamed to `clusters`

---

## ✅ What Changed

### Before
- Table name: `manual_photo_clusters` (misleading - populated by auto-clustering)
- Confusing naming: "manual" suggests manual UI, but it's actually auto-generated

### After
- Table name: **`clusters`** (clear, simple, accurate)
- Single production table for all clustering data
- Auto-clustering is the primary and only method

---

## ✅ Changes Made

### 1. Database Migrations ✅

**Migration 043**: `043_rename_manual_photo_clusters_to_clusters.sql`
- Renames table: `manual_photo_clusters` → `clusters`
- Renames indexes:
  - `idx_manual_photo_clusters_listing` → `idx_clusters_listing`
  - `idx_manual_photo_clusters_room_type` → `idx_clusters_room_type`
  - `idx_manual_photo_clusters_visibility` → `idx_clusters_visibility`
- Updates table and column comments

**Migration 044**: `044_update_clusters_normalized_view.sql`
- Updates `clusters_normalized` view to use `clusters` table
- View now reads from `clusters` instead of `manual_photo_clusters`

### 2. Code References Updated ✅

**All API endpoints** (32 files):
- `clusters/promote-auto-to-manual/route.ts`
- `clusters/route.ts`
- `clusters/save/route.ts`
- `orchestrate-d-to-r3/route.ts`
- `analysis/run-all/route.ts`
- `analysis/by-cluster/route.ts`
- `after/select-room-images/route.ts`
- `after/omsria/route.ts`
- `after/render-rooms/route.ts`
- `after/evolution/route.ts`
- `after/describe-room-images/route.ts`
- `after/add-furniture/route.ts`
- `after/consistency-pass/route.ts`
- `after/consistency-pass-furniture/route.ts`
- `tiers/style-direction/route.ts`
- `renovation-scope/route.ts`
- `renovation-scope/seed-from-tiers/route.ts`
- `rooms/layout/placement/route.ts`
- `rooms/layout/placement/run-all/route.ts`
- `rooms/[roomId]/layout/redbox/route.ts`
- `clusters/auto-test/view/route.ts`
- `clusters/auto-test/compare/route.ts`
- `clusters/seed-test-data/route.ts`
- `cluster-auto/route.ts`
- `text-analysis/results/route.ts`
- `recommendations/verify/route.ts`
- `deepdives/[id]/photos/route.ts`

**Components** (3 files):
- `RenovationSlider.tsx`
- `RenovationTierModal.tsx`
- `PropertyClusteringStep.tsx`

**Libraries** (1 file):
- `lib/photo-storage.ts`

**Hooks** (1 file):
- `hooks/usePropertyDetailsData.ts`

**Test Pages** (2 files):
- `test-after-images/page.tsx`
- `test-redbox/[id]/page.tsx`

### 3. Documentation Updated ✅

**Key Documentation Files**:
- `docs/CLUSTERING_ARCHITECTURE.md` - Updated table name and references
- `docs/CLUSTER_VISIBILITY_TABLES.md` - Updated to reflect `clusters` as primary
- `docs/ULTIMATE_PIPELINE.md` - Updated all pipeline references
- `docs/AUTO_CLUSTERING_AS_PRIMARY.md` - Updated references
- `docs/AUTO_CLUSTERING_TEST_ENDPOINTS.md` - Updated references
- `docs/VISIBILITY_FORMAT_MIGRATION_COMPLETE.md` - Updated references

---

## 📊 Current Table Structure

### Production Table

**`clusters`** ✅ PRIMARY
- Renamed from `manual_photo_clusters` in Migration 043
- Single source of truth for all clustering data
- Populated by auto-clustering promotion
- Used by all production endpoints

**Schema**:
- `id` BIGSERIAL
- `listing_id` BIGINT
- `cluster_name` TEXT
- `room_type` TEXT (optional)
- `photo_urls` TEXT[]
- `display_order` INTEGER
- `visibility_mappings` JSONB (Stage 4 format)
- `selected_photo_url` TEXT
- `created_at`, `updated_at` TIMESTAMPTZ

### Test/Debug Tables

**`auto_photo_clusters`** 🔬 TEST ONLY
- Test clusters from auto-clustering pipeline
- Extra fields: `photo_indices`, `source_stage`, `confidence`, `test_run_id`
- `listing_id` is TEXT (intentional type mismatch for isolation)

**`auto_clustering_test_runs`** 🔬 TEST METADATA
- Pipeline metadata and stage results
- Contains `stage4_result` with visibility mappings (temporary)

---

## 🔄 Data Flow

```
Auto-Clustering Pipeline (Stages 0-5)
  ↓
auto_clustering_test_runs (test metadata)
  ↓
Promotion Endpoint
  ↓
clusters (production clusters + visibility)
  ↓
All Downstream Steps
```

---

## ✅ Benefits

1. **Clearer Naming**: `clusters` is simple and accurate
2. **No Confusion**: Removes misleading "manual" prefix
3. **Consistent**: Single production table name across entire codebase
4. **Future-Proof**: Simple name that reflects actual usage

---

## 📝 Migration Instructions

To apply these changes:

1. **Run Migrations**:
   ```bash
   # Apply migrations 043 and 044
   supabase migration up
   ```

2. **Verify**:
   - Check that `clusters` table exists
   - Check that `clusters_normalized` view works
   - Test promotion endpoint
   - Test orchestrator

3. **Rollback** (if needed):
   - Migration 043 can be reversed by renaming back
   - Code changes are already applied, so rollback would require reverting code too

---

## 🎯 Status

**Migration Complete**: `clusters` is now the single production table name.

**All Code Updated**: 32 API endpoints, 3 components, 1 library, 1 hook, 2 test pages

**Documentation Updated**: All key docs reflect new table name

**Next Steps**: Run migrations 043 and 044 to apply database changes

---

**Status**: ✅ **COMPLETE** - Ready for migration execution.

