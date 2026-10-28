# Auto-Clustering Test Endpoints

**Purpose**: Test automated clustering pipeline to potentially replace manual Step D (Photo Clustering)

**Status**: Experimental - Testing phase

## Overview

This pipeline uses a multi-stage approach with Gemini models:
0. **Gemini Pro** (Stage 0): Visual cluster analysis - detect visual clusters and excluded content
1. **Flash Lite** (Stage 1): Cheap structural inference - extract home layout
1.5. **Flash Lite** (Stage 1.5): Merge visual and structural approaches - definitive cluster decision
2. **Gemini Pro** (Stage 2): Choose best photo per target space (excludes excluded content)
3. **Gemini Pro** (Stage 3): Match remaining photos to clusters (excludes excluded content)
4. **Gemini Pro** (Stage 4): Cross-visibility mapping
5. **Stage 5**: Visual refinement - merge redundant clusters and create explicit excluded clusters

### Excluded Content Detection

The pipeline automatically detects and excludes:
- **Views**: External views (marina, skyline) without property content
- **Floorplans**: Architectural drawings and layout diagrams
- **Certificates**: Energy performance certificates and legal documents

See [Excluded Content Detection](./EXCLUDED_CONTENT_DETECTION.md) for details.

## Endpoints

### Stage 0: Visual Cluster Analysis
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-0`

**Description**: Uses Gemini 2.5 Pro to analyze all photos visually and identify:
- Visual clusters based on visual similarity
- Excluded content (views, floorplans, certificates)
- Reasoning and uncertainties

**Request**: No body required

**Response**:
```json
{
  "success": true,
  "stage": "stage-0",
  "model": "gemini-2.5-pro",
  "total_photos": 29,
  "response_time_ms": 12345,
  "result": {
    "visual_clusters": [
      {
        "cluster_name": "Master Bedroom",
        "photo_indices": [8, 9, 17],
        "visual_description": "...",
        "reasoning": "...",
        "is_excluded": false
      },
      {
        "cluster_name": "External Marina Views",
        "photo_indices": [23, 24],
        "is_excluded": true,
        "excluded_type": "views",
        "excluded_reason": "Photos primarily show external marina view"
      }
    ],
    "total_clusters": 13,
    "reasoning": "...",
    "uncertainties": [...]
  }
}
```

---

### Stage 1: Extract Home Structure
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-1`

**Description**: Uses Gemini 2.5 Flash Lite to analyze photos and extract:
- Number of bedrooms
- Number of bathrooms  
- Other spaces (kitchen, living room, garage, terrace, etc.)
- Target "SPACE SET" (ideal cluster names)

**Request**: No body required

**Response**:
```json
{
  "success": true,
  "stage": "stage-1",
  "model": "gemini-2.5-flash-lite",
  "photos_analyzed": 20,
  "total_photos": 45,
  "response_time_ms": 1234,
  "space_set": {
    "bedrooms": 3,
    "bathrooms": 2,
    "kitchen": true,
    "living_room": true,
    "garage": false,
    "terrace": true,
    "storage": false,
    "target_clusters": ["Dormitorio 1", "Dormitorio 2", "Dormitorio 3", "Baño 1", "Baño 2", "Cocina", "Salón", "Terraza"]
  }
}
```

---

### Stage 2: Choose Best Photo Per Space
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-2`

**Description**: Uses Gemini 2.5 Pro to select ONE best representative photo for each target space.

**Request Body**:
```json
{
  "space_set": {
    "target_clusters": ["Dormitorio 1", "Dormitorio 2", "Cocina", ...]
  }
}
```

**Response**:
```json
{
  "success": true,
  "stage": "stage-2",
  "model": "gemini-2.5-pro",
  "total_photos": 45,
  "selected_count": 8,
  "remaining_count": 37,
  "response_time_ms": 5678,
  "result": {
    "selected_photos": [
      {
        "space_name": "Dormitorio 1",
        "photo_index": 5,
        "photo_url": "https://...",
        "confidence": 0.95,
        "reasoning": "Clear view of bedroom with bed and window"
      },
      ...
    ],
    "remaining_photo_indices": [0, 1, 2, 3, 4, 6, 7, ...]
  }
}
```

---

### Stage 3: Match Remaining Photos
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-3`

**Description**: Uses Gemini 2.5 Pro to match remaining photos to existing clusters or create new clusters.

**Request Body**:
```json
{
  "space_set": {
    "target_clusters": ["Dormitorio 1", "Dormitorio 2", ...]
  },
  "stage2_result": {
    "selected_photos": [...],
    "remaining_photo_indices": [0, 1, 2, ...]
  }
}
```

**Response**:
```json
{
  "success": true,
  "stage": "stage-3",
  "model": "gemini-2.5-pro",
  "remaining_photos_count": 37,
  "matched_count": 32,
  "new_clusters_count": 2,
  "response_time_ms": 8901,
  "result": {
    "matches": [
      {
        "photo_index": 0,
        "photo_url": "https://...",
        "cluster_name": "Dormitorio 1",
        "confidence": 0.88,
        "reasoning": "Same bedroom, different angle"
      },
      {
        "photo_index": 15,
        "photo_url": "https://...",
        "cluster_name": null,
        "new_cluster_name": "Pasillo",
        "confidence": 0.92,
        "reasoning": "Hallway not in original space set"
      },
      ...
    ],
    "new_clusters": ["Pasillo", "Despacho"]
  }
}
```

---

### Stage 1.5: Merge Visual and Structural Approaches
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-1-5`

**Description**: Uses Gemini 2.5 Flash to merge Stage 0 (visual) and Stage 1 (structural) approaches. This is the **DEFINITIVE DECISION-MAKER** for clusters.

**Request Body**:
```json
{
  "stage0_result": {...},
  "stage1_result": {...}
}
```

**Response**:
```json
{
  "success": true,
  "stage": "stage-1.5",
  "model": "gemini-2.5-flash",
  "result": {
    "target_clusters": ["Terraza con Piscina Privada y Barbacoa", "Salón-Comedor", ...],
    "reasoning": "...",
    "conflicts_resolved": [...],
    "visual_insights": "...",
    "structural_insights": "..."
  }
}
```

---

### Stage 4: Cross-Visibility Mapping
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-4`

**Description**: Uses Gemini 2.5 Pro to determine which clusters are visible from each photo.

**Request Body**:
```json
{
  "final_clusters": [
    {
      "cluster_name": "Dormitorio 1",
      "photo_indices": [5, 0, 1, 2]
    },
    {
      "cluster_name": "Cocina",
      "photo_indices": [8, 9, 10]
    },
    ...
  ]
}
```

**Response**:
```json
{
  "success": true,
  "stage": "stage-4",
  "model": "gemini-2.5-pro",
  "photos_analyzed": 45,
  "clusters_count": 10,
  "response_time_ms": 11234,
  "result": {
    "visibility_mappings": [
      {
        "photo_index": 5,
        "photo_url": "https://...",
        "cluster_name": "Dormitorio 1",
        "visible_clusters": ["Dormitorio 1", "Baño 1"],
        "visibility_details": [
          {
            "cluster_name": "Baño 1",
            "visible_from": "through doorway",
            "confidence": 0.85
          }
        ]
      },
      ...
    ],
    "cluster_adjacency": {
      "Dormitorio 1": ["Baño 1", "Pasillo"],
      "Cocina": ["Salón", "Terraza"],
      ...
    }
  }
}
```

---

### Stage 5: Visual Refinement & Merge
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/stage-5`

**Description**: Refines clusters based on Stage 0 visual ground truth. Merges redundant clusters and creates explicit excluded clusters.

**Request Body**:
```json
{
  "final_clusters": [...],
  "stage0_result": {
    "visual_clusters": [...]
  }
}
```

**Response**:
```json
{
  "success": true,
  "stage": "stage-5",
  "result": {
    "refined_clusters": [
      {
        "cluster_name": "Terraza con Piscina Privada y Barbacoa",
        "photo_indices": [0, 16, 18, 19, 20, 21, 22, 25],
        "source_stage": "stage-5"
      },
      {
        "cluster_name": "excluded - views",
        "photo_indices": [23, 24],
        "source_stage": "stage-5",
        "reasoning": "Excluded cluster (views): Photos primarily show external marina view"
      },
      {
        "cluster_name": "excluded - floorplan",
        "photo_indices": [28],
        "source_stage": "stage-5",
        "reasoning": "Excluded cluster (floorplan): The image is a 2D floorplan diagram"
      }
    ],
    "merges_applied": [...]
  }
}
```

---

### Full Pipeline
**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/full`

**Description**: Runs all 4 stages sequentially and returns complete results.

**Request**: No body required

**Response**:
```json
{
  "success": true,
  "listing_id": 12345,
  "stages": {
    "stage1": {...},
    "stage2": {...},
    "stage3": {...},
    "stage4": {...}
  },
  "final_clusters": [
    {
      "cluster_name": "Dormitorio 1",
      "photo_indices": [5, 0, 1, 2]
    },
    ...
  ],
  "errors": [],
  "summary": {
    "total_duration_ms": 25000,
    "clusters_count": 10,
    "total_photos": 45,
    "stages_completed": 4,
    "errors_count": 0
  }
}
```

---

## Test Tables

Results are saved to separate test tables so you can test without affecting manual clusters:

- **`auto_photo_clusters`**: Stores auto-generated clusters (separate from `clusters`)
- **`auto_clustering_test_runs`**: Stores test run metadata and full pipeline results

## Testing

### Using the Test Script

```bash
# Test with latest listing (results NOT saved to DB)
tsx scripts/test-auto-clustering.ts

# Test with latest listing AND save results to test table
tsx scripts/test-auto-clustering.ts --save

# Test with specific listing ID and save results
tsx scripts/test-auto-clustering.ts 12345 --save
```

### Save Results Endpoint

**Endpoint**: `POST /api/listings/[id]/clusters/auto-test/save`

**Description**: Saves auto-clustering results to `auto_photo_clusters` test table.

**Request Body**: Full pipeline response (from `/full` endpoint)

**Response**:
```json
{
  "success": true,
  "test_run_id": "uuid-here",
  "clusters_saved": 10,
  "message": "Results saved to auto_photo_clusters table"
}
```

### View Results Endpoint

**Endpoint**: `GET /api/listings/[id]/clusters/auto-test/view`

**Description**: View saved auto-clustering results.

**Query Parameters**:
- `test_run_id` (optional): Specific test run ID, or latest if omitted
- `include_manual` (optional): Include manual clusters for comparison (`true`/`false`)

**Response**:
```json
{
  "success": true,
  "listing_id": 12345,
  "auto_clusters": [...],
  "test_runs": [...],
  "current_test_run": {...},
  "manual_clusters": [...],  // if include_manual=true
  "comparison": {...}  // if include_manual=true
}
```

### Compare Endpoint

**Endpoint**: `GET /api/listings/[id]/clusters/auto-test/compare`

**Description**: Side-by-side comparison of auto vs manual clusters.

**Query Parameters**:
- `test_run_id` (optional): Specific test run ID, or latest if omitted

**Response**:
```json
{
  "success": true,
  "listing_id": 12345,
  "test_run_id": "uuid-here",
  "comparison": {
    "auto_clusters_count": 10,
    "manual_clusters_count": 8,
    "auto_photos_count": 45,
    "manual_photos_count": 42,
    "overlapping_photos_count": 40,
    "auto_only_photos_count": 5,
    "manual_only_photos_count": 2,
    "overlap_percentage": "88.9"
  },
  "cluster_matches": [
    {
      "auto_cluster": "Dormitorio 1",
      "manual_cluster": "Dormitorio Principal",
      "auto_photos": 5,
      "manual_photos": 4,
      "overlap": 4,
      "similarity": 0.85
    },
    ...
  ],
  "auto_clusters": [...],
  "manual_clusters": [...]
}
```

### Using cURL

```bash
# Get latest listing ID
LATEST_ID=$(curl -s http://localhost:3000/api/listings/latest | jq -r '.listing.id')

# Run full pipeline
curl -X POST http://localhost:3000/api/listings/$LATEST_ID/clusters/auto-test/full \
  -H "Content-Type: application/json" | jq > results.json

# Save results to test table
curl -X POST http://localhost:3000/api/listings/$LATEST_ID/clusters/auto-test/save \
  -H "Content-Type: application/json" \
  -d @results.json | jq

# View saved results
curl "http://localhost:3000/api/listings/$LATEST_ID/clusters/auto-test/view?include_manual=true" | jq

# Compare auto vs manual
curl "http://localhost:3000/api/listings/$LATEST_ID/clusters/auto-test/compare" | jq
```

### Testing Individual Stages

```bash
# Stage 1
curl -X POST http://localhost:3000/api/listings/12345/clusters/auto-test/stage-1 | jq

# Stage 2 (requires Stage 1 output)
curl -X POST http://localhost:3000/api/listings/12345/clusters/auto-test/stage-2 \
  -H "Content-Type: application/json" \
  -d '{"space_set": {"target_clusters": ["Dormitorio 1", "Cocina"]}}' | jq
```

---

## Architecture Notes

### Why This Approach?

1. **Flash Lite for Structure**: Cheap, fast inference of home layout from photos
2. **Pro for Visual Clustering**: High-quality semantic disambiguation across similar rooms
3. **Two-Pass Pro Approach**: 
   - Pass 1: Choose exemplars (stable, low noise)
   - Pass 2: Match remaining (handles edge cases)
4. **Visibility Pass**: Enables layout reconstruction and adjacency inference

### Model Selection

- **Stage 1**: `gemini-2.5-flash-lite` - Cheap structural extraction
- **Stages 2-4**: `gemini-2.5-pro` - High-fidelity visual analysis

### Cost Considerations

- Flash Lite: ~$0.075 per 1M input tokens, ~$0.30 per 1M output tokens
- Pro: ~$1.25 per 1M input tokens, ~$5.00 per 1M output tokens
- Stage 1 uses Flash Lite (cheap) for bulk analysis
- Stages 2-4 use Pro only when needed for quality

---

## Database Schema

### Test Tables

**`auto_photo_clusters`** (Migration 040):
- Same structure as `clusters` but with additional fields:
  - `test_run_id`: Links clusters to a specific test run
  - `source_stage`: Which pipeline stage created this cluster
  - `confidence`: AI model confidence score
  - `photo_indices`: Original photo indices for reference

**`auto_clustering_test_runs`**:
- Stores full pipeline metadata
- Includes all stage results and summary
- Links to clusters via `test_run_id`

## Next Steps

If testing is successful:
1. Review results in `auto_photo_clusters` table
2. Compare with manual clusters using `/compare` endpoint
3. If quality is good, integrate into main pipeline (replace manual Step D)
4. Add UI for reviewing/editing auto-generated clusters
5. Add option to promote test clusters to production (`clusters`)

---

## Known Limitations

- Flash Lite may miss subtle spaces (hallways, storage)
- Pro can be slow with many photos (consider batching)
- Visibility mapping requires high-quality photos
- No validation against listing metadata (bedrooms, bathrooms)

---

**Last Updated**: 2025-11-17

## Related Documentation

- [Excluded Content Detection](./EXCLUDED_CONTENT_DETECTION.md) - Automatic detection and exclusion of views, floorplans, and certificates

