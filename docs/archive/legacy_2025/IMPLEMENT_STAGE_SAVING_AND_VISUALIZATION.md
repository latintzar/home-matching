# Implementation Guide: Stage Saving & Graph Visualization

## Overview

This guide covers:
1. **Auto-saving each stage to Supabase** - For modular debugging and result persistence
2. **Graph visualization** - Visual representation of pair judgements and clusters
3. **Parallelization** - Speed up stages by processing items concurrently

---

## Part 1: Auto-Save Each Stage to Supabase

### Step 1: Create Shared Utility Function

**File:** `src/lib/save-stage-result.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function saveStageResult(
  listingId: string,
  stageName: string,
  stageResult: any
) {
  try {
    // Get or create test run ID for this listing
    const { data: existingRun } = await supabase
      .from('auto_clustering_test_runs')
      .select('id')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const testRunId = existingRun?.id || randomUUID();

    // Build update data
    const updateData: any = {
      id: testRunId,
      listing_id: listingId,
      [`${stageName}_result`]: stageResult,
      updated_at: new Date().toISOString(),
    };

    if (!existingRun) {
      // First stage - create new test run
      updateData.created_at = new Date().toISOString();
      updateData.test_type = 'full';
      updateData.success = true;
    }

    const { error } = await supabase
      .from('auto_clustering_test_runs')
      .upsert(updateData, { onConflict: 'id' });

    if (error) {
      console.warn(`⚠️ Failed to save ${stageName} result:`, error.message);
      return { success: false, error: error.message };
    } else {
      console.log(`✅ Saved ${stageName} result to test run ${testRunId}`);
      return { success: true, test_run_id: testRunId };
    }
  } catch (error: any) {
    console.error(`❌ Error saving ${stageName} result:`, error);
    return { success: false, error: error.message };
  }
}
```

### Step 2: Add Saving to Each Stage

#### Stage 0A (`src/app/api/listings/[id]/clusters/auto-test/stage-0a-descriptors/route.ts`)

**Add import:**
```typescript
import { saveStageResult } from '@/lib/save-stage-result';
```

**Before return statement (around line 169):**
```typescript
// Save to Supabase
await saveStageResult(listingId, 'stage0a', {
  descriptors: descriptors,
  photos_processed: descriptors.length,
  model: 'gemini-2.5-flash',
});

return NextResponse.json({
  success: true,
  stage: 'stage-0a-descriptors',
  model: 'gemini-2.5-flash',
  photos_processed: descriptors.length,
  descriptors,
});
```

#### Stage 0B (`src/app/api/listings/[id]/clusters/auto-test/stage-0b-pairs/route.ts`)

**Add import:**
```typescript
import { saveStageResult } from '@/lib/save-stage-result';
```

**Before return statement (around line 293):**
```typescript
// Calculate statistics
const yesCount = judgements.filter(j => j.same_space === 'yes').length;
const yesHighConf = judgements.filter(j => j.same_space === 'yes' && j.confidence >= 0.7).length;

// Save to Supabase
await saveStageResult(listingId, 'stage0b', {
  judgements: judgements,  // Save as 'judgements' for consistency with Stage 0D
  candidates_selected: limitedCandidates.length,
  total_judgements: judgements.length,
  yes_count: yesCount,
  yes_high_conf_count: yesHighConf,
  no_count: judgements.filter(j => j.same_space === 'no').length,
  maybe_count: judgements.filter(j => j.same_space === 'maybe').length,
  model: 'gemini-2.5-flash',
});

return NextResponse.json({
  success: true,
  stage: 'stage-0b-pairs',
  model: 'gemini-2.5-flash',
  candidates_selected: limitedCandidates.length,
  pair_judgements: judgements,
});
```

#### Stage 0C (`src/app/api/listings/[id]/clusters/auto-test/stage-0c-graph/route.ts`)

**Add import:**
```typescript
import { saveStageResult } from '@/lib/save-stage-result';
```

**Before return statement (around line 202):**
```typescript
// Save to Supabase
await saveStageResult(listingId, 'stage0c', {
  clusters: rawClusters,
  photos_count: n,
  edges_added: edgesAdded,
  total_clusters: rawClusters.length,
  confidence_threshold: 0.7,
});

return NextResponse.json({
  success: true,
  stage: 'stage-0c-graph',
  photos_count: n,
  edges_added: edgesAdded,
  clusters: rawClusters,
});
```

#### Stage 0D (`src/app/api/listings/[id]/clusters/auto-test/stage-0d-naming/route.ts`)

**Add import:**
```typescript
import { saveStageResult } from '@/lib/save-stage-result';
```

**Before return statement (around line 291):**
```typescript
// Save to Supabase
await saveStageResult(listingId, 'stage0d', stage0DResult);

return NextResponse.json({
  success: true,
  stage: 'stage-0d-naming',
  model: 'gemini-2.5-pro',
  response_time_ms: duration,
  result: stage0DResult,
  raw_response: responseText,
});
```

---

## Part 2: Graph Visualization with React Flow

### Step 1: Install Dependencies

```bash
npm install reactflow
```

### Step 2: Create Visualization Component

**File:** `src/components/clustering/PairGraphVisualization.tsx`

```typescript
'use client';

import { useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Image from 'next/image';

interface PairJudgement {
  i: number;
  j: number;
  same_space: 'yes' | 'no' | 'maybe';
  confidence: number;
  reason: string;
}

interface PhotoDescriptor {
  photo_index: number;
  photo_url: string;
  coarse_room_type: string;
}

interface PairGraphVisualizationProps {
  descriptors: PhotoDescriptor[];
  pairJudgements: PairJudgement[];
  clusters?: Array<{ photo_indices: number[]; cluster_id: string }>;
}

export default function PairGraphVisualization({
  descriptors,
  pairJudgements,
  clusters = [],
}: PairGraphVisualizationProps) {
  // Build cluster map for coloring
  const photoToCluster = new Map<number, string>();
  clusters.forEach((cluster) => {
    cluster.photo_indices.forEach(photoIdx => {
      photoToCluster.set(photoIdx, cluster.cluster_id);
    });
  });

  // Generate nodes (photos as thumbnails)
  const nodes: Node[] = useMemo(() => {
    return descriptors.map((desc, idx) => {
      const clusterId = photoToCluster.get(desc.photo_index);
      const clusterColor = clusterId 
        ? `hsl(${(idx * 137.5) % 360}, 70%, 50%)`
        : '#gray';

      return {
        id: `photo-${desc.photo_index}`,
        type: 'photoNode',
        position: {
          x: Math.cos((idx / descriptors.length) * 2 * Math.PI) * 300 + 400,
          y: Math.sin((idx / descriptors.length) * 2 * Math.PI) * 300 + 400,
        },
        data: {
          label: `Photo ${desc.photo_index}`,
          photoUrl: desc.photo_url,
          roomType: desc.coarse_room_type,
          clusterId: clusterId,
        },
        style: {
          background: clusterColor,
          border: '2px solid #333',
          borderRadius: '8px',
          width: 120,
          height: 120,
        },
      };
    });
  }, [descriptors, photoToCluster]);

  // Generate edges (connections based on judgements)
  const edges: Edge[] = useMemo(() => {
    return pairJudgements
      .filter(j => j.same_space === 'yes' || j.same_space === 'maybe')
      .map((judgement) => ({
        id: `edge-${judgement.i}-${judgement.j}`,
        source: `photo-${judgement.i}`,
        target: `photo-${judgement.j}`,
        label: `${(judgement.confidence * 100).toFixed(0)}%`,
        style: {
          stroke: judgement.same_space === 'yes' 
            ? `rgba(34, 197, 94, ${judgement.confidence})` // green
            : `rgba(251, 191, 36, ${judgement.confidence})`, // yellow for maybe
          strokeWidth: judgement.confidence * 3,
        },
        animated: judgement.same_space === 'yes' && judgement.confidence >= 0.7,
      }));
  }, [pairJudgements]);

  // Custom node component with thumbnail
  const PhotoNode = ({ data }: { data: any }) => {
    return (
      <div className="relative w-[120px] h-[120px] rounded-lg overflow-hidden bg-white shadow-lg">
        <Image
          src={data.photoUrl}
          alt={data.label}
          fill
          className="object-cover"
          sizes="120px"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1">
          <div className="font-bold">#{data.label.split(' ')[1]}</div>
          <div className="text-[10px]">{data.roomType}</div>
        </div>
      </div>
    );
  };

  const nodeTypes = {
    photoNode: PhotoNode,
  };

  const yesCount = pairJudgements.filter(j => j.same_space === 'yes').length;
  const maybeCount = pairJudgements.filter(j => j.same_space === 'maybe').length;
  const noCount = pairJudgements.filter(j => j.same_space === 'no').length;

  return (
    <div className="w-full h-[800px] border rounded-lg relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      
      <div className="absolute top-4 left-4 bg-white/90 p-3 rounded-lg shadow-lg text-sm z-10">
        <div className="font-bold mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Yes (same room)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Maybe</span>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {yesCount} yes, {maybeCount} maybe, {noCount} no
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Add to Auto-Clusters Page

**File:** `src/app/auto-clusters/[id]/page.tsx`

**Add import:**
```typescript
import PairGraphVisualization from '@/components/clustering/PairGraphVisualization';
```

**Add state:**
```typescript
const [graphData, setGraphData] = useState<{
  descriptors: any[];
  pairJudgements: any[];
  clusters: any[];
} | null>(null);
```

**Add useEffect to fetch graph data:**
```typescript
useEffect(() => {
  async function fetchGraphData() {
    try {
      const res = await fetch(`/api/listings/${listingId}/clusters/auto-test/latest-results`);
      const data = await res.json();
      if (data.success) {
        setGraphData({
          descriptors: data.stages.stage0a?.descriptors || [],
          pairJudgements: data.stages.stage0b?.judgements || data.stages.stage0b?.pair_judgements || [],
          clusters: data.stages.stage0c?.clusters || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
    }
  }
  if (listingId) fetchGraphData();
}, [listingId]);
```

**Add visualization to JSX (before clusters display):**
```typescript
{graphData && graphData.descriptors.length > 0 && (
  <div className="mb-12">
    <h2 className="text-2xl font-bold mb-4">Pair Graph Visualization</h2>
    <p className="text-gray-600 mb-4">
      Visual representation of pair judgements. Green edges = same room, Yellow = maybe.
      Nodes are colored by cluster membership.
    </p>
    <PairGraphVisualization {...graphData} />
  </div>
)}
```

---

## Part 3: Parallelization Opportunities

### Overview

The pipeline currently processes items sequentially. Here are parallelization opportunities:

### 1. Stage 0A: Parallel Photo Processing

**Current:** Sequential loop processing one photo at a time  
**Opportunity:** Process photos in batches of 5-10 concurrently

**Location:** `src/app/api/listings/[id]/clusters/auto-test/stage-0a-descriptors/route.ts` (line 83)

**Implementation:**
```typescript
// Replace sequential loop with batched parallel processing
const BATCH_SIZE = 10;

const processPhoto = async (photo: any, index: number) => {
  try {
    const base64 = await convertSupabaseUrlToBase64(photo.url);
    // ... existing prompt and model call ...
    return {
      photo_index: index,
      photo_url: photo.url,
      coarse_room_type: descriptorData.coarse_room_type || 'other',
      anchors: Array.isArray(descriptorData.anchors) ? descriptorData.anchors : [],
      materials: Array.isArray(descriptorData.materials) ? descriptorData.materials : [],
      distinctive_markers: descriptorData.distinctive_markers || '',
    };
  } catch (error: any) {
    console.warn(`⚠️ Failed to process photo ${index}:`, error.message);
    return {
      photo_index: index,
      photo_url: photo.url,
      coarse_room_type: 'other',
      anchors: [],
      materials: [],
      distinctive_markers: 'Failed to analyze',
    };
  }
};

// Process in batches
for (let i = 0; i < photos.length; i += BATCH_SIZE) {
  const batch = photos.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map((photo, batchIdx) => processPhoto(photo, i + batchIdx))
  );
  descriptors.push(...batchResults);
  console.log(`✅ Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(photos.length / BATCH_SIZE)}`);
}
```

**Expected Speedup:** 5-10x faster (depending on API rate limits)

---

### 2. Stage 0B: Parallel Pair Processing

**Current:** Sequential loop processing one pair at a time  
**Opportunity:** Process pairs in batches of 20-50 concurrently

**Location:** `src/app/api/listings/[id]/clusters/auto-test/stage-0b-pairs/route.ts` (line 163)

**Implementation:**
```typescript
// Replace sequential loop with batched parallel processing
const BATCH_SIZE = 30; // Adjust based on API rate limits

const processPair = async (pair: { i: number; j: number }, idx: number) => {
  const { i, j } = pair;
  const descI = descriptors[i];
  const descJ = descriptors[j];

  // ... validation checks ...

  try {
    const [base64I, base64J] = await Promise.all([
      convertSupabaseUrlToBase64(photos[i].url),
      convertSupabaseUrlToBase64(photos[j].url),
    ]);
    
    // ... existing prompt and model call ...
    
    return {
      i,
      j,
      same_space: judgementData.same_space || 'maybe',
      confidence: Math.max(0, Math.min(1, judgementData.confidence || 0.5)),
      reason: judgementData.reason || 'No reason provided',
    };
  } catch (error: any) {
    console.warn(`⚠️ Failed to process pair (${i}, ${j}):`, error.message);
    return {
      i,
      j,
      same_space: 'maybe',
      confidence: 0.3,
      reason: 'Failed to analyze - defaulting to uncertain',
    };
  }
};

// Process in batches
for (let i = 0; i < limitedCandidates.length; i += BATCH_SIZE) {
  const batch = limitedCandidates.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map((pair, batchIdx) => processPair(pair, i + batchIdx))
  );
  judgements.push(...batchResults);
  console.log(`✅ Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(limitedCandidates.length / BATCH_SIZE)}`);
}
```

**Expected Speedup:** 20-50x faster (depending on API rate limits and batch size)

---

### 3. Stage 0D: Parallel Photo Conversion

**Current:** Sequential base64 conversion for representative photos  
**Opportunity:** Convert all photos in parallel

**Location:** `src/app/api/listings/[id]/clusters/auto-test/stage-0d-naming/route.ts` (line 165)

**Implementation:**
```typescript
// Collect all photo indices first
const photoIndicesToConvert: number[] = [];
for (const cluster of finalClusters) {
  for (let i = 0; i < Math.min(2, cluster.photo_indices.length); i++) {
    photoIndicesToConvert.push(cluster.photo_indices[i]);
  }
}

// Convert all photos in parallel
const photoConversions = await Promise.all(
  photoIndicesToConvert.map(async (photoIdx) => {
    if (photoIdx >= 0 && photoIdx < photos.length) {
      try {
        const base64 = await convertSupabaseUrlToBase64(photos[photoIdx].url);
        return { photoIdx, base64, success: true };
      } catch (error) {
        console.warn(`⚠️ Failed to convert photo ${photoIdx}:`, error);
        return { photoIdx, base64: null, success: false };
      }
    }
    return { photoIdx, base64: null, success: false };
  })
);

// Build imageParts from conversions
const base64Map = new Map<number, string>();
photoConversions.forEach(({ photoIdx, base64, success }) => {
  if (success && base64) {
    base64Map.set(photoIdx, base64);
  }
});

// Then build imageParts and clusterPhotoMap using base64Map
for (let cIdx = 0; cIdx < finalClusters.length; cIdx++) {
  const cluster = finalClusters[cIdx];
  const clusterPhotos: number[] = [];
  
  for (let i = 0; i < Math.min(2, cluster.photo_indices.length); i++) {
    const photoIdx = cluster.photo_indices[i];
    const base64 = base64Map.get(photoIdx);
    if (base64) {
      imageParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64,
        },
      });
      photoIndices.push(photoIdx);
      clusterPhotoMap.set(cIdx, [...(clusterPhotoMap.get(cIdx) || []), imageParts.length - 1]);
      clusterPhotos.push(imageParts.length - 1);
    }
  }
}
```

**Expected Speedup:** 2-5x faster (depending on number of representative photos)

---

### 4. Stage 4: Parallel Photo Conversion

**Current:** Sequential base64 conversion for all photos  
**Opportunity:** Convert all photos in parallel

**Location:** `src/app/api/listings/[id]/clusters/auto-test/stage-4/route.ts` (line 120)

**Implementation:**
```typescript
// Replace sequential loop with parallel conversion
console.log(`🖼️ Encoding ${photoIndicesArray.length} photos in parallel...`);

const photoConversions = await Promise.all(
  photoIndicesArray.map(async (idx) => {
    if (idx >= 0 && idx < photos.length) {
      try {
        const base64 = await convertSupabaseUrlToBase64(photos[idx].url);
        return { idx, base64, url: photos[idx].url, success: true };
      } catch (error) {
        console.warn(`⚠️ Failed to convert photo ${photos[idx].url}:`, error);
        return { idx, base64: null, url: photos[idx].url, success: false };
      }
    }
    return { idx, base64: null, url: null, success: false };
  })
);

// Build imageParts from conversions
const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
const photoUrls: string[] = [];
const photoIndices: number[] = [];

photoConversions.forEach(({ idx, base64, url, success }) => {
  if (success && base64) {
    imageParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64,
      },
    });
    photoUrls.push(url!);
    photoIndices.push(idx);
  }
});

if (imageParts.length === 0) {
  throw new Error('Failed to convert any photos to base64');
}

console.log(`✅ Encoded ${imageParts.length} photos`);
```

**Expected Speedup:** 5-10x faster (depending on number of photos)

---

## Implementation Priority

1. **High Priority:**
   - Stage 0B parallelization (biggest bottleneck - 500 pairs sequentially)
   - Stage 0A parallelization (29 photos sequentially)
   - Stage 4 photo conversion parallelization (all photos sequentially)

2. **Medium Priority:**
   - Stage 0D photo conversion parallelization
   - Add stage saving to all stages

3. **Low Priority:**
   - Graph visualization (nice to have for debugging)

---

## Testing Parallelization

After implementing parallelization:

1. **Monitor API rate limits** - Start with smaller batch sizes (5-10)
2. **Check error rates** - Ensure parallel processing doesn't increase failures
3. **Measure speedup** - Compare before/after timing
4. **Adjust batch sizes** - Find optimal balance between speed and reliability

---

## Notes

- **API Rate Limits:** Vertex AI has rate limits. Start conservative with batch sizes.
- **Memory:** Parallel processing uses more memory. Monitor for large listings.
- **Error Handling:** Ensure errors in one batch item don't break the whole batch.
- **Progress Logging:** Update progress logging to reflect batch processing.

---

## Success Criteria

✅ Each stage saves results to `auto_clustering_test_runs`  
✅ Graph visualization shows pair judgements and clusters  
✅ Stage 0A processes photos in parallel batches  
✅ Stage 0B processes pairs in parallel batches  
✅ Stage 0D converts photos in parallel  
✅ Overall pipeline speedup of 10-20x

