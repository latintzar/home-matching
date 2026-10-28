# Clustering UI Architecture Documentation

**Generated**: 2025-01-27  
**Purpose**: Document the existing proprietary clustering UI to ensure unified architecture

## Current Architecture Overview

The clustering system consists of two main components:
1. **NotebookWizard.tsx** - Main wizard container with unified footer
2. **PropertyClusteringStep.tsx** - Clustering step implementation with photo grid

## UI Flow Analysis

### Step-by-Step User Journey

1. **URL Entry**: User enters Idealista URL
2. **Photo Loading**: Photos are scraped and displayed in grid
3. **Preflight Steps** (optional):
   - **Remove**: Select photos to exclude from analysis
   - **Floorplan**: Select floorplan photos (excluded from analysis, used in DeepDive)
4. **Manual Clustering**: 
   - Click photos to select them (rounded border selection)
   - Click "Save Cluster" to create cluster
   - Rename cluster with real-time spellcheck
   - Drag-and-drop photos between clusters
5. **Submit**: Click "Submit Clusters" to save and proceed

### State Management

```typescript
// Main state in NotebookWizard.tsx
const [clusters, setClusters] = useState<Array<{ 
  id: string; 
  name: string; 
  photoUrls: string[] 
}>>([]);

const [selection, setSelection] = useState<Set<string>>(new Set());
const [preflightStep, setPreflightStep] = useState<'remove' | 'floorplan' | 'done'>('done');
const [preRemoveSel, setPreRemoveSel] = useState<Set<string>>(new Set());
const [prePlanosSel, setPrePlanosSel] = useState<Set<string>>(new Set());
const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
```

## Data Structure

### Current Cluster Representation
```typescript
type Cluster = {
  id: string;           // e.g., "cl_kitchen_1234567890"
  name: string;         // e.g., "Cocina"
  photoUrls: string[];  // Array of photo URLs
}
```

### Submit Payload Structure
```typescript
// From PropertyClusteringStep.tsx submitClusters()
const photos = clusters.flatMap(c => 
  c.photoUrls.map((u, idx) => ({ 
    url: u, 
    tag: c.name || 'Cluster', 
    order: idx 
  }))
);

// Sent to API as:
{
  photos: Array<{ url: string; tag: string; order: number }>
}
```

## API Contract Analysis

### Current Endpoints

1. **Primary**: `/api/deepdives/${deepdiveId}/photos` (POST)
   - **Storage**: `deepdive_photos` table
   - **Schema**: `{ deepdive_id, url, tag, display_order }`
   - **Behavior**: Clears existing photos, inserts new ones

2. **Fallback**: `/api/deepdives/save-photo-tags` (POST) 
   - **Status**: Referenced but NOT IMPLEMENTED
   - **Issue**: This endpoint doesn't exist in the codebase

3. **Auto-clustering**: `/api/listings/${id}/cluster-auto` (POST)
   - **Storage**: `room_clusters` table  
   - **Schema**: `{ listing_id, cluster_id, zone_ids[], confidence }`
   - **Issue**: Uses `zone_ids` (references segmentation masks), not photo URLs

### Storage Mechanism Issues

**Current Problems**:
1. **No dedicated manual clustering table** - clusters are stored in `deepdive_photos` with tags
2. **Legacy endpoint missing** - `/api/deepdives/save-photo-tags` doesn't exist
3. **Schema mismatch** - `room_clusters` expects `zone_ids`, not photo URLs
4. **DeepDive dependency** - Manual clustering requires `deepdiveId`, not just `listingId`

## Strengths of Current UI

✅ **Excellent UX**:
- Rounded border selection provides clear visual feedback
- Drag-and-drop between clusters works smoothly
- Real-time spellcheck with debouncing
- Preflight steps for removing/floorplan photos
- Unified footer with clear instructions

✅ **Robust State Management**:
- Comprehensive state tracking
- Proper cleanup and error handling
- Responsive cluster creation/editing

✅ **Professional Design**:
- Clean, intuitive interface
- Good visual hierarchy
- Mobile-responsive

## Gaps and Issues

❌ **Storage Architecture**:
- No dedicated table for manual photo clusters
- Relies on `deepdive_photos` table (DeepDive-specific)
- Missing fallback endpoint implementation

❌ **Analysis Pipeline Integration**:
- Analysis pipeline expects `room_clusters` table
- Manual clustering doesn't populate `room_clusters`
- Schema mismatch between UI and analysis

❌ **Data Persistence**:
- Clusters lost if DeepDive not created
- No way to retrieve clusters for analysis without DeepDive

## Recommendation: Unified Storage Strategy

### Option A: Extend Existing Mechanism (NOT RECOMMENDED)
- **Pros**: Minimal changes to UI
- **Cons**: Still tied to DeepDive, doesn't solve analysis integration

### Option B: Create New Manual Photo Clusters Table (RECOMMENDED)
- **Pros**: Clean separation, analysis-ready, listing-centric
- **Cons**: Requires UI updates

### Option C: Hybrid Approach (COMPLEX)
- **Pros**: Backward compatibility
- **Cons**: Dual storage, complexity

## Recommended Implementation

### 1. Create New Table: `manual_photo_clusters`
```sql
CREATE TABLE IF NOT EXISTS manual_photo_clusters (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  room_type TEXT,  -- e.g., 'Kitchen', 'Living Room', 'Bedroom 1'
  photo_urls TEXT[] NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Update UI to Use New Table
- Modify `submitClusters()` to POST to `/api/listings/[id]/clusters/save`
- Keep existing UI/UX unchanged
- Add cluster retrieval for analysis pipeline

### 3. Analysis Pipeline Integration
- Analysis endpoints read from `manual_photo_clusters`
- Maintain backward compatibility with `room_clusters` (auto-clustering)

## Decision: Option B - New Table

**Rationale**:
1. **Clean Architecture**: Dedicated table for manual clustering
2. **Analysis Ready**: Direct integration with analysis pipeline
3. **Listing-Centric**: Not dependent on DeepDive creation
4. **Future-Proof**: Supports both manual and auto-clustering
5. **Minimal UI Changes**: Keep excellent existing UX

## Next Steps

1. ✅ Document current architecture
2. 🔄 Create `manual_photo_clusters` table migration
3. 🔄 Create `/api/listings/[id]/clusters/save` endpoint
4. 🔄 Update `submitClusters()` to use new endpoint
5. 🔄 Update analysis pipeline to read from new table
6. 🔄 Add cluster retrieval for existing listings

---

**Last Updated**: Architecture analysis complete, proceeding with Option B implementation
