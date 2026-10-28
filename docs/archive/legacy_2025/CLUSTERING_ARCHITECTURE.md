# Photo Clustering Architecture

**Last Updated**: 2025-01-27  
**Status**: Zero-Shot Clustering (Gemini 3) is the PRIMARY and ONLY method

---

## 🎯 Primary Method: Zero-Shot Clustering (Gemini 3)

Zero-shot clustering using Gemini 3 Pro Preview is now the **primary and only clustering method**. The pair-graph pipeline (Stages 0A-0D) has been deleted.

**Pipeline**: `POST /api/listings/[id]/clusters/zero-shot/full`  
**Components**:
1. Gemini 3 Zero-Shot Clustering (visual-priority prompt, temp 0.7)
2. Gemini 3 Visibility Mapping (Stage 4-style)
3. Direct write to `clusters` table

See: [Zero-Shot Clustering as Primary](ZERO_SHOT_CLUSTERING_AS_PRIMARY.md)

---

## Single Source of Truth: `clusters`

### Table Schema (Migration 008, renamed in Migration 043)
```sql
CREATE TABLE clusters (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,  -- AI-generated names (e.g., "Kitchen", "Bedroom 1")
  photo_urls TEXT[] NOT NULL,  -- Array of photo URLs
  display_order INTEGER DEFAULT 0,
  visibility_mappings JSONB,  -- Stage 4 format: {visibility_mappings: [...], cluster_adjacency: {...}}
  selected_photo_url TEXT,  -- Set by R1
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### What This Stores
- **cluster_name**: AI-generated cluster names (e.g., "Kitchen", "Bedroom 1", "Living Room")
- **photo_urls**: Array of photo URLs that belong to this cluster
- **visibility_mappings**: Stage 4 format visibility mappings (see [Visibility Format Migration](VISIBILITY_FORMAT_MIGRATION_COMPLETE.md))
- **listing_id**: Which listing these photos belong to

### How Clusters Are Created

1. **Zero-Shot Clustering Pipeline** (Gemini 3):
   - **Step 1**: Gemini 3 Pro Preview zero-shot clustering (visual-priority prompt, temp 0.7)
     - Single-pass clustering with refined prompts
     - Detects excluded content (views, floorplans, certificates)
   - **Step 2**: Gemini 3 Pro Preview visibility mapping (Stage 4-style)
     - Cross-visibility analysis between clusters
     - Builds adjacency graph
   - **Step 3**: Direct write to `clusters` table
     - Clusters written with `visibility_mappings` in Stage 4 format
   - Excluded clusters (`excluded - views`, `excluded - floorplan`, etc.) are NOT written

### Deprecated Tables
- ❌ **room_clusters** - Replaced by `clusters`
- ❌ **image_clusters** - Unused table
- ❌ **deepdive_photos** - Deprecated (use `clusters`)

### Usage in Codebase

#### 1. Get Clusters (DB → Consumers)
- Endpoint: `GET /api/listings/[id]/clusters`
- Returns: All clusters for the listing (from `clusters`)
- Used by: UI display, analysis pipeline, renovation pipeline

#### 2. Room-by-Room Analysis
- Endpoint: `POST /api/listings/[id]/analysis/by-cluster`
- Reads from: `clusters`
- Skips: Any cluster with name starting with "excluded -" (auto-detected)
- Analyzes: Everything else using the cluster_name + photo_urls

#### 3. Visibility Mappings
- Stored in: `clusters.visibility_mappings` (Stage 4 format)
- Normalized view: `clusters_normalized.visibility_mappings_normalized`
- Used by: R1 (select room images), OMSRIA Step 1, R2a

### Filtering Rules

During analysis, clusters are automatically skipped if:
- Name starts with `"excluded -"` (case insensitive)
  - `"excluded - views"` - Views/photos of outside
  - `"excluded - floorplan"` - Floorplan images
  - `"excluded - certificado energético"` - Energy certificates
  - `"excluded - other"` - Other non-property images

These are automatically detected by Stage 0 and created by Stage 5.

Everything else gets analyzed.

---

## 🔄 Data Flow

```
Zero-Shot Clustering Pipeline (Gemini 3)
  POST /api/listings/[id]/clusters/zero-shot/full
  ↓
1. Gemini 3 Zero-Shot Clustering
   → Returns: clusters[], excluded_content[]
  ↓
2. Gemini 3 Visibility Mapping
   → Returns: visibility_mappings[], cluster_adjacency{}
  ↓
3. Write Directly to clusters table
   → cluster_name, photo_urls[], visibility_mappings{}
  ↓
All Downstream Steps (F3, RoomByRoom, G, H, R1, OMSRIA, etc.)
```

**Note**: The pair-graph pipeline (`/clusters/auto-test/full`) has been deleted. Zero-shot clustering is the only production method.

---

## 📚 Related Documentation

- [Zero-Shot Clustering as Primary](ZERO_SHOT_CLUSTERING_AS_PRIMARY.md) - Implementation plan and details
- [Auto-Clustering as Primary](AUTO_CLUSTERING_AS_PRIMARY.md) - Legacy documentation (deprecated)
- [Visibility Format Migration](VISIBILITY_FORMAT_MIGRATION_COMPLETE.md) - Stage 4 format details
- [Cluster Visibility Tables](CLUSTER_VISIBILITY_TABLES.md) - Table structure
