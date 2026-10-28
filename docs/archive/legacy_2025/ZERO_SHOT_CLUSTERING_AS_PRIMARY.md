# Zero-Shot Clustering as Primary Method - Implementation Plan

**Created:** 2025-01-27  
**Status:** 🚧 **IN PROGRESS**  
**Purpose:** Make Gemini 3 zero-shot clustering the PRIMARY and ONLY auto-clustering method, replacing the pair-graph pipeline (Stages 0A-0D). Add Gemini 3 visibility step and integrate into Basic Package orchestrator.

---

## 🎯 Overview

The **Gemini 3 zero-shot clustering method** (with refined visual-priority prompts) will become the **primary and only** auto-clustering engine. This replaces the multi-stage pair-graph pipeline (0A → 0B → 0C → 0D) with a simpler, more accurate single-pass approach.

### Key Changes

1. **Primary Clustering Engine**: Gemini 3 Pro Preview zero-shot clustering (temperature 0.7, visual-priority prompt)
2. **Visibility Step**: Gemini 3 Pro Preview visibility mapping (Stage 4-style) on top of zero-shot clusters
3. **Direct Write**: Results written directly to `clusters` table in Supabase (Stage 4 format)
4. **Basic Package Integration**: Step D (clustering) now uses zero-shot pipeline exclusively
5. **Pair-Graph Pipeline**: Deleted (no longer used in production)

---

## 📋 Implementation Steps

### Step 1: Extract Shared Zero-Shot Helper

**Goal**: Create a single source of truth for Gemini 3 zero-shot clustering logic.

**File**: `src/lib/auto-clustering/zeroShotGemini3.ts`

**Responsibilities**:
- Fetch listing + photos from Supabase
- Convert photos to base64
- Build refined visual-priority prompt (same as current `zero-shot-batch` prompt)
- Call Gemini 3 Pro Preview REST API with `thinkingLevel: 'HIGH'`
- Parse streaming JSON response → structured result

**Interface**:
```typescript
export interface ZeroShotCluster {
  cluster_name: string;
  photo_indices: number[];
  room_type?: string;
  description?: string;
  confidence?: number;
}

export interface ZeroShotRunConfig {
  listingId: string;
  temperature: number;                // e.g. 0.7
  promptVariant: 'visual-priority';   // only this variant in production
}

export async function runZeroShotGemini3(
  config: ZeroShotRunConfig
): Promise<{
  clusters: ZeroShotCluster[];
  excluded_content?: { 
    type: string; 
    photo_indices: number[]; 
    reason: string 
  }[];
  reasoning?: string;
}>
```

**Refactoring**:
- `zero-shot-batch/route.ts`: Replace local `runZeroShotClustering` with calls to `runZeroShotGemini3`
- `zero-shot/route.ts`: Use same helper (debug endpoint, doesn't write to DB)

---

### Step 2: Create Zero-Shot Full Pipeline Endpoint

**Goal**: Single endpoint that runs clustering + visibility + writes to `clusters` table.

**File**: `src/app/api/listings/[id]/clusters/zero-shot/full/route.ts`

**Endpoint**: `POST /api/listings/[id]/clusters/zero-shot/full`

**Pipeline Flow**:

```
1. Run Gemini 3 Zero-Shot Clustering
   ↓
2. Run Gemini 3 Visibility Mapping (Stage 4-style)
   ↓
3. Map photo_indices → photo_urls
   ↓
4. Delete existing clusters for listing
   ↓
5. Build cluster rows with visibility_mappings
   ↓
6. Insert into clusters table
   ↓
7. Return summary
```

**Implementation Details**:

```typescript
export async function POST(request, { params }) {
  const listingId = params.id;

  // 1) Run zero-shot clustering
  const zeroShot = await runZeroShotGemini3({
    listingId,
    temperature: 0.7,
    promptVariant: 'visual-priority',
  });
  const finalClusters = zeroShot.clusters;

  // 2) Run visibility (Stage 4 Gemini 3)
  const stage4 = await runVisibilityGemini3({ 
    listingId, 
    final_clusters: finalClusters 
  });
  // Returns: { visibility_mappings, cluster_adjacency }

  // 3) Fetch photos to map indices → URLs
  const { data: photos } = await supabase
    .from('listing_photos')
    .select('url, display_order')
    .eq('listing_id', listingId)
    .order('display_order');

  // 4) Delete existing clusters
  await supabase
    .from('clusters')
    .delete()
    .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`);

  // 5) Build cluster rows with visibility_mappings
  const rows = finalClusters
    .filter(c => !c.cluster_name.toLowerCase().startsWith('excluded -'))
    .map((cluster, idx) => ({
      listing_id: listingIdNum,
      cluster_name: cluster.cluster_name,
      room_type: cluster.cluster_name, // for now
      photo_urls: cluster.photo_indices.map(i => photos[i].url),
      display_order: idx,
      visibility_mappings: {
        visibility_mappings: stage4.result.visibility_mappings
          .filter(vm => cluster.photo_indices.includes(vm.photo_index))
          .map(vm => ({
            photo_url: photos[vm.photo_index].url,
            cluster_name: vm.cluster_name,
            visible_clusters: vm.visible_clusters,
            visibility_details: vm.visibility_details || [],
          })),
        cluster_adjacency: stage4.result.cluster_adjacency,
      },
    }));

  // 6) Insert into clusters
  await supabase.from('clusters').insert(rows);

  // 7) Return summary
  return NextResponse.json({
    success: true,
    clusters_count: rows.length,
    visibility_mappings_count: stage4.result.visibility_mappings.length,
  });
}
```

**Visibility Helper**:

Extract visibility logic from `stage-4-gemini3/route.ts` into a shared helper:

**File**: `src/lib/auto-clustering/visibilityGemini3.ts`

```typescript
export async function runVisibilityGemini3({
  listingId,
  final_clusters,
}: {
  listingId: string;
  final_clusters: Array<{ cluster_name: string; photo_indices: number[] }>;
}): Promise<{
  success: boolean;
  result: {
    visibility_mappings: Array<{
      photo_index: number;
      photo_url?: string;
      cluster_name: string;
      visible_clusters: string[];
      visibility_details?: Array<{
        cluster_name: string;
        visible_from: string;
        confidence: number;
      }>;
    }>;
    cluster_adjacency: Record<string, string[]>;
  };
}>
```

---

### Step 3: Update Basic Package Orchestrator

**Goal**: Make zero-shot pipeline the ONLY auto-clustering step used by Basic Package.

**File**: `src/app/api/listings/[id]/orchestrate-basic-package/route.ts`

**Changes**:

**Before** (current):
```typescript
if (!clusters || clusters.length === 0) {
  sendUpdate('🔄 Auto-clustering not found. Running auto-clustering pipeline...', {}, 'prerequisites');
  const autoClusterResponse = await fetch(`${BASE_URL}/api/listings/${listingId}/clusters/auto-test/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  // ... consume SSE stream
}
```

**After** (new):
```typescript
if (!clusters || clusters.length === 0) {
  sendUpdate('🔄 Auto-clustering not found. Running zero-shot clustering pipeline...', {}, 'prerequisites');
  
  const autoClusterResponse = await fetch(`${BASE_URL}/api/listings/${listingId}/clusters/zero-shot/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!autoClusterResponse.ok) {
    const errorData = await autoClusterResponse.json().catch(() => ({ error: 'Unknown error' }));
    sendUpdate(`❌ Zero-shot clustering pipeline failed: ${autoClusterResponse.status} ${errorData.error}`, {
      status: autoClusterResponse.status,
      error: errorData.error
    }, 'prerequisites');
    throw new Error(`Zero-shot clustering pipeline failed: ${autoClusterResponse.status} ${errorData.error}`);
  }

  const result = await autoClusterResponse.json();
  sendUpdate(`✅ Zero-shot clustering complete: ${result.clusters_count} clusters, ${result.visibility_mappings_count} visibility mappings`, {
    clusters_count: result.clusters_count,
    visibility_mappings_count: result.visibility_mappings_count
  }, 'prerequisites');
}
```

**Note**: If you want timeline logs (SSE), make `zero-shot/full` an SSE endpoint similar to `auto-test/full`. For simplicity, start with JSON response.

---

### Step 4: Delete Pair-Graph Pipeline

**Goal**: Remove all pair-graph clustering endpoints (Stages 0A-0D) since they're no longer used in production.

**Files to Delete**:

1. `src/app/api/listings/[id]/clusters/auto-test/stage-0a-descriptors/route.ts`
2. `src/app/api/listings/[id]/clusters/auto-test/stage-0b-pairs/route.ts`
3. `src/app/api/listings/[id]/clusters/auto-test/stage-0c-graph/route.ts`
4. `src/app/api/listings/[id]/clusters/auto-test/stage-0d-naming/route.ts`
5. `src/app/api/listings/[id]/clusters/auto-test/full/route.ts` (or keep as experimental, but update docs)

**Optional**: Keep `auto-test/full` as experimental/research endpoint, but update documentation to mark it as deprecated.

---

### Step 5: Update Documentation

**Files to Update**:

1. **`docs/CLUSTERING_ARCHITECTURE.md`**:
   - Update "Primary Method" section to reflect zero-shot clustering
   - Remove references to pair-graph pipeline (or mark as experimental)
   - Update pipeline flow diagram

2. **`docs/AUTO_CLUSTERING_AS_PRIMARY.md`**:
   - Update to reflect zero-shot as primary method
   - Note that pair-graph pipeline is deprecated/deleted

3. **`docs/PIPELINE_STATUS.md`**:
   - Update Step D status to "Zero-Shot Clustering (Gemini 3)"
   - Remove or deprecate pair-graph pipeline entries

---

## 📊 Data Flow (After Implementation)

```
Basic Package Orchestrator
  ↓
Step D: Zero-Shot Clustering
  POST /api/listings/[id]/clusters/zero-shot/full
  ↓
1. Gemini 3 Zero-Shot Clustering (visual-priority, temp 0.7)
   → Returns: clusters[], excluded_content[]
  ↓
2. Gemini 3 Visibility Mapping (Stage 4-style)
   → Returns: visibility_mappings[], cluster_adjacency{}
  ↓
3. Write to clusters table
   → cluster_name, photo_urls[], visibility_mappings{}
  ↓
All Downstream Steps (F3, RoomByRoom, G, H, etc.)
```

---

## ✅ Success Criteria

1. ✅ Shared `runZeroShotGemini3` helper extracted and used by all zero-shot endpoints
2. ✅ New `zero-shot/full` endpoint runs clustering + visibility + writes to `clusters`
3. ✅ Basic Package orchestrator uses `zero-shot/full` as only clustering method
4. ✅ Pair-graph pipeline deleted (or marked experimental)
5. ✅ Documentation updated to reflect zero-shot as primary method
6. ✅ All downstream steps (F3, RoomByRoom, R1, OMSRIA) continue working with `clusters` table

---

## 🔄 Migration Notes

### Backward Compatibility

- **`clusters` table schema**: No changes needed (already supports Stage 4 format)
- **Downstream endpoints**: No changes needed (they read from `clusters` table)
- **Visibility mappings**: Same format as Stage 4, so R1/OMSRIA continue working

### Testing

1. Test zero-shot clustering on existing listing (e.g., `1000000121`)
2. Verify clusters written to `clusters` table
3. Verify visibility_mappings populated correctly
4. Test Basic Package orchestrator end-to-end
5. Verify downstream steps (F3, RoomByRoom) work with new clusters

---

## 📝 Files Created/Modified

### New Files
- `src/lib/auto-clustering/zeroShotGemini3.ts` - Shared zero-shot helper
- `src/lib/auto-clustering/visibilityGemini3.ts` - Shared visibility helper
- `src/app/api/listings/[id]/clusters/zero-shot/full/route.ts` - Production pipeline endpoint

### Modified Files
- `src/app/api/listings/[id]/clusters/zero-shot/route.ts` - Use shared helper
- `src/app/api/listings/[id]/clusters/zero-shot-batch/route.ts` - Use shared helper
- `src/app/api/listings/[id]/orchestrate-basic-package/route.ts` - Use zero-shot/full
- `docs/CLUSTERING_ARCHITECTURE.md` - Update primary method
- `docs/AUTO_CLUSTERING_AS_PRIMARY.md` - Update status
- `docs/PIPELINE_STATUS.md` - Update Step D

### Deleted Files
- `src/app/api/listings/[id]/clusters/auto-test/stage-0a-descriptors/route.ts`
- `src/app/api/listings/[id]/clusters/auto-test/stage-0b-pairs/route.ts`
- `src/app/api/listings/[id]/clusters/auto-test/stage-0c-graph/route.ts`
- `src/app/api/listings/[id]/clusters/auto-test/stage-0d-naming/route.ts`
- `src/app/api/listings/[id]/clusters/auto-test/full/route.ts` (optional: keep as experimental)

---

## 🎯 Status

**Current**: 🚧 **IN PROGRESS**  
**Next Steps**: 
1. Extract shared helpers
2. Create zero-shot/full endpoint
3. Update orchestrator
4. Delete pair-graph pipeline
5. Update documentation

---

**Last Updated**: 2025-01-27

