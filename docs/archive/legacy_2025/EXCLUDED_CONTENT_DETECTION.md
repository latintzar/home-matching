# Excluded Content Detection System

## Overview

The auto-clustering pipeline now automatically detects and excludes non-property content (views, floorplans, certificates) from clustering and analysis. This ensures that only actual property spaces are included in room clusters and analysis endpoints.

## Architecture

### Detection Flow

```
Stage 0 (Visual Analysis)
  ↓
Detects excluded content types:
  - Views only (external marina/skyline views)
  - Floorplans (architectural drawings)
  - Certificates (energy performance certificates)
  ↓
Tags clusters with is_excluded flag
  ↓
Stages 2 & 3 (Photo Selection/Matching)
  ↓
Automatically filter out excluded photos
  ↓
Stage 5 (Refinement)
  ↓
Creates explicit "excluded - ..." clusters
```

## Excluded Content Types

### 1. Views (`excluded_type: "views"`)
- Photos that primarily show external views (port, skyline, sea, mountains)
- Do not show significant parts of the property itself
- Example: Marina views, skyline shots

### 2. Floorplans (`excluded_type: "floorplan"`)
- Architectural drawings, layout diagrams, schematics, blueprints
- 2D representations of the property layout
- Example: Floorplan images

### 3. Certificates (`excluded_type: "certificate"`)
- Energy performance certificates
- Legal documents, official paperwork
- Example: Energy efficiency certificates

### 4. Other (`excluded_type: "other"`)
- Any other non-property content
- Maps, brochures, unrelated images

## Implementation Details

### Stage 0: Visual Cluster Analysis

**File**: `src/app/api/listings/[id]/clusters/auto-test/stage-0/route.ts`

**Changes**:
- Added `is_excluded`, `excluded_type`, and `excluded_reason` fields to `VisualCluster` interface
- Updated prompt to explicitly detect and classify excluded content
- Model now tags each cluster as excluded or not

**Output Format**:
```json
{
  "visual_clusters": [
    {
      "cluster_name": "External Marina Views",
      "photo_indices": [23, 24],
      "is_excluded": true,
      "excluded_type": "views",
      "excluded_reason": "Photos primarily show external marina view without property"
    },
    {
      "cluster_name": "Master Bedroom",
      "photo_indices": [8, 9, 17],
      "is_excluded": false
    }
  ]
}
```

### Stage 2 & 3: Photo Filtering

**Files**:
- `src/app/api/listings/[id]/clusters/auto-test/stage-2/route.ts`
- `src/app/api/listings/[id]/clusters/auto-test/stage-3/route.ts`

**Changes**:
- Extract excluded photo indices from Stage 0 visual clusters
- Filter out excluded photos before processing
- Map usable photo indices back to original indices for output

**Behavior**:
- Only non-excluded photos are sent to Gemini for analysis
- Excluded photos never appear in `selected_photos` or `matches`
- Logs show count of excluded photos: `"Analyzing 25 photos (4 excluded)"`

### Stage 5: Explicit Excluded Clusters

**File**: `src/app/api/listings/[id]/clusters/auto-test/stage-5/route.ts`

**Changes**:
- Detects excluded clusters from Stage 0
- Creates explicit clusters with names:
  - `excluded - views`
  - `excluded - floorplan`
  - `excluded - certificado energético`
  - `excluded - other`

**Output**:
```json
{
  "refined_clusters": [
    {
      "cluster_name": "excluded - views",
      "photo_indices": [23, 24],
      "source_stage": "stage-5",
      "reasoning": "Excluded cluster (views): Photos primarily show external marina view"
    }
  ]
}
```

## Helper Functions

### `isClusterExcluded()`

**File**: `src/lib/photo-storage.ts`

**Purpose**: Check if a cluster is excluded (works with both manual and auto-clustering)

**Logic**:
1. Quick check: Cluster name starts with `"excluded -"` → excluded
2. Check auto-clustering: Query `auto_photo_clusters` for `is_excluded` flag
3. Fallback: Check cluster name patterns (for manual clusters)

**Usage**:
```typescript
const { isClusterExcluded } = await import('@/lib/photo-storage');
const isExcluded = await isClusterExcluded(clusterName, listingId, supabase);
```

### `getExcludedPhotoUrls()`

**File**: `src/lib/photo-storage.ts`

**Purpose**: Get set of all excluded photo URLs for a listing

**Returns**: `Set<string>` of excluded photo URLs

**Usage**:
```typescript
const { getExcludedPhotoUrls } = await import('@/lib/photo-storage');
const excludedUrls = await getExcludedPhotoUrls(listingId, supabase);
```

### `fetchValidListingPhotos()`

**File**: `src/lib/photo-storage.ts`

**Purpose**: Fetch photos excluding excluded content (updated to use new helpers)

**Changes**:
- Now checks both `manual_photo_clusters` and `auto_photo_clusters`
- Uses `isClusterExcluded()` instead of hardcoded string matching
- Uses `getExcludedPhotoUrls()` to filter individual photos

## Analysis Endpoints Updated

All analysis endpoints now use `isClusterExcluded()` helper instead of hardcoded string matching:

### Updated Files:
- `src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts`
- `src/app/api/listings/[id]/analysis/by-cluster/route.ts`
- `src/app/api/listings/[id]/after/select-room-images/route.ts`
- `src/app/api/listings/[id]/after/render-rooms/route.ts`
- `src/app/api/listings/[id]/tiers/style-direction/route.ts`
- `src/app/api/listings/[id]/after/evolution/route.ts`
- `src/app/api/listings/[id]/rooms/layout/placement/route.ts`
- `src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts`

### Pattern Change:

**Before**:
```typescript
const clusters = allClusters.filter(c => {
  const nameLower = c.cluster_name.toLowerCase();
  return !nameLower.includes('excluded') && 
         !nameLower.includes('floorplan');
});
```

**After**:
```typescript
const { isClusterExcluded } = await import('@/lib/photo-storage');
const clusters = [];
for (const c of allClusters) {
  const isExcluded = await isClusterExcluded(c.cluster_name, listingId, supabase);
  if (!isExcluded) {
    clusters.push(c);
  }
}
```

## Benefits

1. **Single Source of Truth**: Exclusion logic centralized in helper functions
2. **Works with Both Systems**: Manual clusters and auto-clustering
3. **Consistent Behavior**: All endpoints use same exclusion logic
4. **Easier Maintenance**: Change logic in one place
5. **Supports New Types**: Views, floorplan, certificate, other
6. **AI-Based Detection**: No hardcoded URL patterns needed

## Testing

### Test Case 1: Listing with Views
- Stage 0 should detect view-only photos
- Stages 2 & 3 should exclude them
- Stage 5 should create `excluded - views` cluster

### Test Case 2: Listing with Floorplan
- Stage 0 should detect floorplan image
- Stages 2 & 3 should exclude it
- Stage 5 should create `excluded - floorplan` cluster

### Test Case 3: Listing with Certificate
- Stage 0 should detect certificate image
- Stages 2 & 3 should exclude it
- Stage 5 should create `excluded - certificado energético` cluster

### Test Case 4: Analysis Endpoints
- All analysis endpoints should skip excluded clusters
- `fetchValidListingPhotos()` should return only valid photos
- Room-by-room analysis should not process excluded rooms

## Database Schema

### `auto_photo_clusters` Table
- Excluded clusters identified by cluster name prefix: `"excluded -"`
- No separate `is_excluded` column needed (identified by naming convention)

### `clusters` Table (renamed from `manual_photo_clusters` in Migration 043)
- Excluded clusters identified by name patterns (handled by `isClusterExcluded()` fallback)

## Future Enhancements

1. **Add `is_excluded` column** to `auto_photo_clusters` table for explicit flagging
2. **Cache excluded photo URLs** per listing to avoid repeated queries
3. **Add excluded content metrics** to pipeline summary
4. **UI indicators** for excluded clusters in visualization pages

## Related Documentation

- [Auto Clustering Test Endpoints](./AUTO_CLUSTERING_TEST_ENDPOINTS.md)
- [Progressive Component Pattern](../../parked/PROGRESSIVE_COMPONENT_PATTERN.md)

