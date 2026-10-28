# Cluster & Visibility Tables - Current State

**Date**: 2025-01-27  
**Status**: Single production table + test/debug tables

---

## 📊 Table Structure

### Production Table (Single Source of Truth)

#### `clusters` ✅ PRIMARY
**Purpose**: Production clusters used by all endpoints (renamed from `manual_photo_clusters` in Migration 043)

**Schema**:
- `id` BIGSERIAL
- `listing_id` BIGINT
- `cluster_name` TEXT
- `room_type` TEXT (optional)
- `photo_urls` TEXT[]
- `display_order` INTEGER
- `visibility_mappings` JSONB ✅ **Has visibility**
- `selected_photo_url` TEXT (from R1)
- `created_at`, `updated_at` TIMESTAMPTZ

**Visibility Storage**: 
- Column: `visibility_mappings` JSONB
- Format: Stage 4 format `{visibility_mappings: [...], cluster_adjacency: {...}}`
- Added: Migration 019, updated: Migration 042

**Populated By**: 
- Auto-clustering promotion endpoint (`/clusters/promote-auto-to-manual`)

**Used By**: All production endpoints (analysis, renovation, after images, etc.)

---

### Test/Debug Tables (Separate)

#### `auto_photo_clusters` 🔬 TEST ONLY
**Purpose**: Store auto-clustering test results for debugging

**Schema**:
- `id` BIGSERIAL
- `listing_id` TEXT (⚠️ type mismatch with manual)
- `cluster_name` TEXT
- `room_type` TEXT
- `photo_urls` TEXT[]
- `photo_indices` INTEGER[] (extra field)
- `display_order` INTEGER
- `source_stage` TEXT (extra field)
- `confidence` DECIMAL (extra field)
- `test_run_id` TEXT (extra field)
- ❌ **NO visibility_mappings column**

**Visibility Storage**: None - this table doesn't store visibility

**Populated By**: Auto-clustering test pipeline (`/clusters/auto-test/save`)

**Used By**: Test/debug endpoints only (`/clusters/auto-test/view`, `/clusters/auto-test/compare`)

---

#### `auto_clustering_test_runs` 🔬 TEST METADATA
**Purpose**: Store full auto-clustering pipeline metadata and stage results

**Schema**:
- `id` TEXT (UUID)
- `listing_id` TEXT
- `test_type` TEXT
- `space_set` JSONB (Stage 1)
- `stage2_result` JSONB
- `stage3_result` JSONB
- `stage4_result` JSONB ✅ **Has visibility mappings**
- `stage5_result` JSONB (Migration 041)
- `final_clusters` JSONB
- `summary` JSONB
- `total_duration_ms` INTEGER
- `success` BOOLEAN
- `errors` JSONB
- `created_at` TIMESTAMPTZ

**Visibility Storage**: 
- Column: `stage4_result` JSONB
- Format: Contains Stage 4 visibility mappings (temporary, gets promoted)

**Populated By**: Auto-clustering full pipeline (`/clusters/auto-test/full`) - for debugging only

**Used By**: Not used in production flow. Production pipeline writes directly to `clusters`.

---

## 🔄 Data Flow

```
Auto-Clustering Pipeline
  ↓
Write Directly to clusters (production clusters + visibility)
  ↓
All Production Endpoints
```

**Note**: Test tables (`auto_photo_clusters`, `auto_clustering_test_runs`) exist for debugging but are not part of production flow.

---

## ✅ Answer: Single Production Table

**Production**: 
- ✅ **ONE table**: `clusters` (with visibility) - renamed from `manual_photo_clusters` in Migration 043

**Test/Debug**: 
- 🔬 `auto_photo_clusters` (no visibility, just test clusters)
- 🔬 `auto_clustering_test_runs` (has visibility in `stage4_result`, temporary)

**Conclusion**: We have **ONE production cluster table with visibility**. The auto tables are test-only and separate.

---

## 🎯 Visibility Storage Summary

| Table | Has Visibility? | Format | Purpose |
|-------|-----------------|--------|---------|
| `clusters` | ✅ Yes | `visibility_mappings` JSONB column | Production |
| `auto_photo_clusters` | ❌ No | N/A | Test clusters only |
| `auto_clustering_test_runs` | ✅ Yes | `stage4_result` JSONB (temporary) | Test metadata |

---

## 📝 Notes

1. **Type Mismatch**: `auto_photo_clusters.listing_id` is `TEXT`, but `clusters.listing_id` is `BIGINT`. This is intentional for test data isolation.

2. **Direct Write**: When auto-clustering completes, the pipeline:
   - Extracts visibility mappings from Stage 4 result
   - Writes directly to `clusters.visibility_mappings`
   - No promotion step needed

3. **No Duplication**: Visibility is stored in production table only. Test tables are separate and temporary.

4. **View**: `clusters_normalized` view normalizes `clusters.visibility_mappings` (Stage 4 format → consumer format) for easier consumption.

---

**Status**: ✅ Clean architecture - single production source of truth, separate test tables.

