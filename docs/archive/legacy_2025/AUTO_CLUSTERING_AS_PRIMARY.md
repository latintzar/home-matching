# Auto-Clustering as Primary Step D - Implementation Plan

**Created:** 2025-01-27  
**Purpose:** Promote auto-clustering pipeline (Stages 0-5) as the primary Step D, replacing manual clustering UI. Integrate Stage 4 visibility mappings into Stage R (R1, R2a) and OMSRIA Step 1.

---

## Overview

Auto-clustering (Stages 0-5) is now the **primary Step D** for the pipeline.  
Manual clustering UI is archived and no longer part of the main execution path.

The auto pipeline produces:

- **Refined room clusters** (Stage 5)
- **Per-photo visibility mappings** (Stage 4) - **CRITICAL for Stage R and OMSRIA**
- **Explicit excluded clusters** (`excluded - views`, `excluded - floorplan`, `excluded - certificado energético`)

Downstream steps (Stage R, OMSRIA, analysis steps) consume these results via the existing `clusters` table and `visibility_mappings` schema.

---

## Stage R & OMSRIA: Visibility Mappings Integration

### Current State

**Stage R** (After Image Generation Pipeline) uses visibility mappings in:

1. **R1 - Select Room Images** (`/api/listings/[id]/after/select-room-images`)
   - Reads `visibility_mappings_normalized` from `clusters_normalized` view
   - Uses visibility info to prefer photos with **fewer visible other spaces**
   - Criteria: "If multiple photos show room well, prefer the one where other spaces are least visible"

2. **OMSRIA Step 1** (`/api/listings/[id]/after/omsria`)
   - **Filters**: Only processes images with non-empty `visibility_mappings`
   - **Input**: Selected wide-angle image from R1 + visibility mappings
   - **Output**: Tailored prompt for Step 2 specifying which spaces are visible and their positions
   - Uses `visibility_mappings_normalized` to extract `visible_rooms[]` for each photo

3. **R2a - Describe Room Images** (`/api/listings/[id]/after/render-rooms`)
   - May use visibility mappings for spatial context (needs verification)

### Stage 4 Visibility Output

Stage 4 produces a **per-photo visibility graph**:

```json
{
  "visibility_mappings": [
    {
      "photo_index": 5,
      "photo_url": "https://...",
      "cluster_name": "Salón-Comedor",
      "visible_clusters": ["Cocina", "Terraza"],
      "visibility_details": [
        {
          "cluster_name": "Cocina",
          "visible_from": "through open archway on the right",
          "confidence": 0.92
        }
      ]
    }
  ],
  "cluster_adjacency": {
    "Salón-Comedor": ["Cocina", "Terraza"],
    "Dormitorio Principal": ["Terraza con Piscina Privada y Barbacoa"]
  }
}
```

### Integration Strategy

**Option A: Promotion Pattern (Recommended)**

1. **After auto-clustering completes** (Stages 0-5):
   - Run promotion endpoint: `POST /api/listings/[id]/clusters/promote-auto-to-manual`
   - This populates `clusters` with:
     - Refined clusters from Stage 5
     - `visibility_mappings` built from Stage 4 output

2. **Stage R and OMSRIA continue using existing code**:
   - R1 reads `visibility_mappings_normalized` from `clusters_normalized` view
   - OMSRIA Step 1 reads `visibility_mappings_normalized` from clusters
   - **No code changes needed** - they automatically get Stage 4-derived visibility

3. **Enhancement (Optional)**:
   - Update OMSRIA Step 1 prompt to include `visibility_details` (e.g., "Cocina visible through archway on the right")
   - This provides richer spatial context for better editing decisions

---

## Implementation Steps

### Step 1: Create Promotion Endpoint

**Endpoint**: `POST /api/listings/[id]/clusters/promote-auto-to-manual`

**Responsibilities**:

1. Fetch latest `auto_clustering_test_runs` for listing:
   - `stage5.result.refined_clusters` (final cluster assignments)
   - `stage4_result.visibility_mappings` (per-photo visibility graph)

2. For each **non-excluded** refined cluster:
   - Map `photo_indices` → `photo_urls` from `listing_photos`
   - Insert/update `clusters`:
     - `cluster_name`
     - `photo_urls[]`
     - `display_order`
     - `visibility_mappings` (built from Stage 4)

3. Build `visibility_mappings` JSON:
   ```json
   {
     "https://.../photo.jpg": {
       "visible_cluster_ids": [2, 3],
       "visible_cluster_names": ["Cocina", "Terraza"],
       "details": [
         {
           "cluster_name": "Cocina",
           "visible_from": "through archway on the right",
           "confidence": 0.92
         }
       ]
     }
   }
   ```

4. For excluded clusters:
   - **Skip** populating `clusters` (they remain in `auto_photo_clusters` only)
   - Or optionally store with `cluster_name` prefixed by `excluded -` but **empty `visibility_mappings`**

**Implementation Notes**:

- Use `clusters_normalized` view or direct `clusters` queries
- Map cluster names to cluster IDs for `visible_cluster_ids` field
- Preserve existing `visibility_mappings` structure for backward compatibility

---

### Step 2: Wire Promotion into Full Pipeline

**Update**: `/api/listings/[id]/clusters/auto-test/full/route.ts`

After Stage 4 & Stage 5 complete successfully:

```typescript
// After Stage 5 completes
if (stage5Result.success) {
  // Promote auto-clusters to clusters
  const promoteUrl = `${baseUrl}/api/listings/${listingId}/clusters/promote-auto-to-manual`;
  const promoteRes = await fetch(promoteUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  if (promoteRes.ok) {
    await sendSSE('promotion', { status: 'success', message: 'Promoted clusters to clusters' });
  } else {
    await sendSSE('promotion', { status: 'warning', message: 'Promotion failed but clusters saved' });
  }
}
```

**Alternative**: Call promotion explicitly from orchestrator (`orchestrate-d-to-r3`) after auto-clustering completes.

---

### Step 3: Enhance OMSRIA Step 1 with Visibility Details (Optional)

**Current**: OMSRIA Step 1 uses `visible_rooms[]` from `visibility_mappings_normalized`.

**Enhancement**: Include `visibility_details` in prompt generation:

```typescript
// In /api/listings/[id]/after/omsria/route.ts

// After extracting visible_rooms, also extract visibility_details
const visibilityDetails = mapping?.details || [];

// Build richer context for prompt generation
const visibilityContext = visibleSpaceNames.map((space, idx) => {
  const detail = visibilityDetails.find(d => d.cluster_name === space);
  if (detail) {
    return `${space} (${detail.visible_from}, confidence: ${detail.confidence})`;
  }
  return space;
}).join(', ');
```

This provides spatial context like "Cocina (through archway on the right, confidence: 0.92)" instead of just "Cocina".

---

### Step 4: Archive Manual Clustering UI

**Files to Archive**:

- `src/components/ClusteringOnlyWizard.tsx`
- `src/components/ClusterVisibilityMapper.tsx`
- `src/app/cluster/` directory (all routes)

**Process**:

1. Create archive directory: `archive/`
2. Zip files: `archive/manual-clustering-ui.zip`
3. Remove from active source tree
4. Commit with clear message

**Commands**:

```bash
mkdir -p archive
zip -r archive/manual-clustering-ui.zip \
  src/components/ClusteringOnlyWizard.tsx \
  src/components/ClusterVisibilityMapper.tsx \
  src/app/cluster

rm src/components/ClusteringOnlyWizard.tsx
rm src/components/ClusterVisibilityMapper.tsx
rm -rf src/app/cluster

git add archive/manual-clustering-ui.zip
git rm src/components/ClusteringOnlyWizard.tsx src/components/ClusterVisibilityMapper.tsx
git rm -r src/app/cluster
git commit -m "Archive manual clustering UI and promote auto-clustering as primary Step D"
```

---

## Pipeline Flow (Updated)

### Step D: Auto-Clustering (Primary)

1. **Stage 0** - Visual Cluster Analysis (Pro)
   - Cluster photos based on visual similarity
   - Detect excluded content (views, floorplans, certificates)

2. **Stage 1** - Structural Extraction (Flash)
   - Infer home structure from photos + listing data

3. **Stage 1.5** - Merge Visual & Structural (Flash)
   - Definitive decision for `target_clusters`
   - Excludes excluded clusters from `target_clusters`

4. **Stage 2** - Best Photo per Space (Pro)
   - Pick one exemplar photo per `target_cluster`
   - Excludes excluded photos

5. **Stage 3** - Match Remaining Photos (Pro)
   - Match remaining photos to clusters
   - Excludes excluded photos

6. **Stage 5** - Visual Refinement & Excluded Clusters
   - Merge redundant clusters
   - Create explicit excluded clusters

7. **Stage 4** - Cross-Visibility Mapping (Pro)
   - For each photo: identify primary cluster + visible clusters
   - Build `visibility_mappings[]` with `visibility_details`

8. **Promotion** - Auto → Manual
   - Populate `clusters` with refined clusters
   - Populate `visibility_mappings` from Stage 4

### Stage R: After Image Generation

**R1** - Select Room Images
- ✅ Uses `visibility_mappings_normalized` (now from Stage 4)
- Prefers photos with fewer visible other spaces

**OMSRIA** (R1.5) - Organic Multi-Space Reduction
- ✅ Filters: Only images with `visibility_mappings` (non-empty)
- ✅ Step 1: Uses `visible_rooms[]` from `visibility_mappings_normalized`
- ✅ Optional: Enhanced with `visibility_details` for richer context

**R2a** - Describe Room Images
- May use visibility mappings for spatial context (verify)

**R2b** - Generate Room Prompts
- Uses room descriptions from R2a

**R3** - Render Rooms
- Generates after-images based on prompts

---

## Database Schema

### Auto-Clustering Tables

- `auto_clustering_test_runs` - Pipeline runs and stage results
- `auto_photo_clusters` - Final cluster assignments

### Manual Clusters (Populated by Promotion)

- `clusters` - Room clusters (now auto-generated)
  - `cluster_name`
  - `photo_urls[]`
  - `selected_photo_url` (set by R1)
  - `visibility_mappings` (populated from Stage 4)

### Views

- `clusters_normalized` - Normalized view with `visibility_mappings_normalized`
  - Translates cluster IDs → cluster names
  - Used by R1, OMSRIA, and other consumers

---

## Testing Checklist

- [ ] Promotion endpoint populates `clusters` correctly
- [ ] Promotion endpoint builds `visibility_mappings` in correct format
- [ ] R1 reads Stage 4-derived visibility mappings
- [ ] OMSRIA Step 1 filters and uses visibility mappings correctly
- [ ] Excluded clusters are NOT promoted to `clusters`
- [ ] Full pipeline orchestrator calls promotion automatically
- [ ] Manual clustering UI is archived and removed from active codebase

---

## Benefits

1. **Single Source of Truth**: Auto-clustering is the only clustering mechanism
2. **Consistent Visibility**: Stage 4 provides accurate, AI-derived visibility graph
3. **Better R1 Selection**: Visibility info helps select best photos (fewer visible other spaces)
4. **Richer OMSRIA Context**: `visibility_details` provides spatial context for editing decisions
5. **Simplified Codebase**: Manual clustering UI archived, reducing confusion

---

## Summary

- Auto-clustering pipeline (Stages 0-5) is now **primary Step D**
- Stage 4 provides **per-photo visibility graph** that feeds:
  - Legacy `visibility_mappings` schema
  - Stage R (R1, R2a)
  - OMSRIA Step 1
- Stage 5 provides **refined clusters** and **explicit excluded clusters**
- Manual clustering UI is **archived**, not deleted, keeping history but simplifying active codebase
- Promotion step bridges auto-clustering → manual clusters seamlessly

