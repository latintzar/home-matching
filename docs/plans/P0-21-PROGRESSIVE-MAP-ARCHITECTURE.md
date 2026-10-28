# P0-21: Progressive Map Architecture

> **Status**: Learning & Documentation  
> **Last Updated**: 2025-12-08  
> **Related**: P0-04 (Location Scoring), P0-19 (Geo Data Pipeline)

## Overview

This document captures our learnings from building a progressive map visualization system for Leo's chat-based UX. The key insight: **you can't render 1M polygons in the browser**, so we need a hybrid approach.

---

## The Problem We Solved

### Original Approach (Failed)
```
424MB GeoJSON (980k H3 hexes) → Browser → 💀 Crash/Freeze
```

- H3 Resolution 12 = ~11m hexes = 980,483 polygons
- Each polygon = ~400 bytes of coordinates
- Browser can't render this efficiently
- Live updates during chat = impossible

### New Approach (Works!)
```
During Chat: Lightweight layers (~1.8MB total) → Toggle on/off
End of Chat: Server generates PNG → Display as raster overlay (5.5MB)
```

**77x file size reduction**: 424MB → 5.5MB

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LEO CHAT SESSION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: "I work near Diagonal"                                               │
│  └─→ Add WORK ANCHOR marker 📍                                              │
│      Draw commute radius circle                                             │
│                                                                             │
│  User: "I like being near the beach"                                        │
│  └─→ Toggle ON: Coast layer 🌊                                              │
│      (Polygon overlay on coastline + sea tint)                              │
│                                                                             │
│  User: "Parks are important"                                                │
│  └─→ Toggle ON: Parks layer 🌳                                              │
│      (Polygon overlays on actual park boundaries)                           │
│                                                                             │
│  User: "I need good metro access"                                           │
│  └─→ Toggle ON: Metro layer 🚇                                              │
│      (Station dots - this works well!)                                      │
│                                                                             │
│  User: "I like Gràcia's vibe"                                               │
│  └─→ Toggle ON: Neighborhoods layer                                         │
│      Highlight Gràcia specifically                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           END OF CHAT                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  "Generating your personalized heatmap..."                                  │
│  └─→ Server: calculateHeatmap(preferences)                                  │
│      └─→ Generate high-res PNG (4096x4096)                                  │
│      └─→ Return image URL                                                   │
│      └─→ Display as Mapbox raster overlay                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Final Map:                                                         │    │
│  │  - PNG heatmap (blue → yellow → red gradient)                       │    │
│  │  - Work anchor marker                                               │    │
│  │  - Optional: Keep some layers visible for context                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What We Built

### 1. PNG Heatmap Generator (`src/scripts/generateHeatmapPNG.ts`)

**What it does:**
- Loads H3 hex GeoJSON (424MB)
- Renders each hex as SVG polygon with color based on fitScore
- Converts SVG → PNG using Sharp
- Outputs transparent PNG overlay

**Output:**
```
Input:  barcelona-h3-heatmap-v2.json (424MB, 980k hexes)
Output: barcelona-heatmap-v2.png (5.5MB, 2048x2048)
```

**Color Scale:**
```
Score 0-3:  Blue   (#3b82f6) - Far from anchors
Score 4-6:  Yellow (#fbbf24) - Decent fit  
Score 7-10: Red    (#ef4444) - Perfect match
```

**Transparency:** Opacity increases with score (blue=25%, red=60%)

### 2. Lightweight Layers Export (`src/scripts/exportLightweightLayers.ts`)

**What it does:**
- Scans DynamoDB tables for geo data
- Filters to Barcelona bounding box
- Exports as GeoJSON files

**Output:**
| Layer | File Size | Features | Quality |
|-------|-----------|----------|---------|
| Neighborhoods | 1.3MB | 220 polygons | ✅ Good |
| Metro Stations | 51KB | 381 points | ✅ Good |
| Parks | 370KB | 2,476 points | ❌ Wrong - need polygons |
| Coast | 1.3KB | 8 points + 1 line | ❌ Wrong - need polygon |

### 3. Progressive Map Component (`src/app/test-map-comparison/page.tsx`)

**Features:**
- Toggle panel for each layer
- Raster heatmap as Mapbox image source
- Markers for anchors
- Legend overlay

---

## Key Learnings

### 1. Browser Rendering Limits

| Polygons | Performance |
|----------|-------------|
| 1,000 | Smooth |
| 10,000 | Acceptable |
| 50,000 | Sluggish |
| 100,000+ | Unusable |

**Rule of thumb:** Keep under 50k polygons for interactive maps.

### 2. H3 Resolution Trade-offs

| Resolution | Edge Length | Hexes in Barcelona | File Size |
|------------|-------------|-------------------|-----------|
| 9 | ~175m | ~5,000 | ~5MB |
| 10 | ~66m | ~20,000 | ~20MB |
| 11 | ~29m | ~50,000 | ~50MB |
| 12 | ~11m | ~200,000 | ~200MB |
| 13 | ~4m | ~1,000,000 | ~1GB |

**For live updates:** Resolution 9-10 max  
**For final PNG:** Resolution 12-13 is fine

### 3. Mapbox Layer Types

| Type | Use Case | Our Usage |
|------|----------|-----------|
| `fill` | Polygons | Neighborhoods, Parks (should be) |
| `line` | Lines/outlines | Neighborhood borders, Coast (should be) |
| `circle` | Points | Metro stations ✅, Parks (wrong) |
| `raster` | Images | Heatmap PNG ✅ |
| `symbol` | Icons/text | Markers |

### 4. Image Overlay Coordinates

Mapbox `image` source needs coordinates in this order:
```typescript
// [NW, NE, SE, SW] - clockwise from top-left
const HEATMAP_BOUNDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [2.02, 41.47],   // Top-left (NW)
  [2.23, 41.47],   // Top-right (NE)  
  [2.23, 41.32],   // Bottom-right (SE)
  [2.02, 41.32],   // Bottom-left (SW)
];
```

### 5. Data Quality Matters

Our DynamoDB data has issues:
- **Parks**: Stored as points (lat/lng), not polygon boundaries
- **Coast**: Only 8 beach points, no coastline polygon
- **Neighborhoods**: Good! Full polygon geometries

**Lesson:** The data you import determines what you can visualize.

---

## Ideas for Improvement

### 1. Higher Resolution PNG

**Current:** 2048x2048 (~11m per pixel at Barcelona scale)  
**Improvement:** 4096x4096 or 8192x8192

```typescript
// In generateHeatmapPNG.ts
const IMAGE_WIDTH = 4096;  // or 8192 for ultra-high-res
const IMAGE_HEIGHT = 4096;
```

**Trade-off:** Larger file size, longer generation time

### 2. Proper Park Polygons

**Problem:** We have park centroids (points), not boundaries.

**Solutions:**

**Option A: Fetch from OpenStreetMap**
```typescript
// Overpass API query for park polygons
const query = `
  [out:json];
  (
    way["leisure"="park"](41.32,2.05,41.47,2.23);
    relation["leisure"="park"](41.32,2.05,41.47,2.23);
  );
  out body;
  >;
  out skel qt;
`;
```

**Option B: Use Mapbox's built-in park layer**
```typescript
// Reference Mapbox's landuse layer for parks
<Layer
  id="parks-highlight"
  type="fill"
  source="composite"
  source-layer="landuse"
  filter={["==", ["get", "class"], "park"]}
  paint={{
    "fill-color": "#22c55e",
    "fill-opacity": 0.3,
  }}
/>
```

This is the BEST option - uses Mapbox's own data!

### 3. Proper Coast/Sea Polygon

**Problem:** We have beach points, not a coastline polygon.

**Solutions:**

**Option A: Fetch from OpenStreetMap**
```typescript
// Overpass query for coastline
const query = `
  [out:json];
  way["natural"="coastline"](41.32,2.05,41.47,2.23);
  out body;
  >;
  out skel qt;
`;
```

**Option B: Use Mapbox's water layer**
```typescript
// Highlight the sea using Mapbox's water layer
<Layer
  id="sea-highlight"
  type="fill"
  source="composite"
  source-layer="water"
  paint={{
    "fill-color": "#0ea5e9",
    "fill-opacity": 0.2,
  }}
/>
```

**Option C: Create a sea polygon manually**
```typescript
// Simple polygon covering the sea area
const SEA_POLYGON = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[
      [2.05, 41.32],  // SW corner of map
      [2.25, 41.32],  // SE
      [2.25, 41.35],  // Follow coastline...
      // ... more points tracing coast
      [2.05, 41.35],
      [2.05, 41.32],
    ]]
  }
};
```

### 4. Smarter Layer Toggle UX

**Current:** All-or-nothing toggles  
**Improvement:** Progressive reveal with animations

```typescript
// Fade layers in when toggled
paint={{
  "fill-opacity": [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, 0.1,
    14, 0.4,
  ],
  "fill-opacity-transition": { duration: 500 },
}}
```

### 5. Highlight Specific Neighborhoods

When user says "I like Gràcia", highlight just that neighborhood:

```typescript
<Layer
  id="highlighted-neighborhood"
  type="fill"
  filter={["==", ["get", "name"], "Gràcia"]}
  paint={{
    "fill-color": "#f59e0b",
    "fill-opacity": 0.4,
  }}
/>
```

### 6. Server-Side PNG Generation API

**Current:** Pre-generated PNG  
**Improvement:** Generate on-demand based on user preferences

```typescript
// POST /api/heatmap/generate
{
  anchors: [
    { type: "work", lat: 41.3874, lng: 2.1686 },
    { type: "gym", lat: 41.4036, lng: 2.1899 },
  ],
  weights: {
    commute: 0.5,
    lifestyle: 0.3,
    budget: 0.2,
  },
  preferences: {
    nearBeach: true,
    nearParks: true,
    nightlife: false,
  }
}

// Returns: { imageUrl: "/generated/heatmap-abc123.png" }
```

### 7. WebGL Shader-Based Rendering

For truly smooth heatmaps without visible hexes:

```typescript
// Instead of polygons, use a custom WebGL shader
// that interpolates colors smoothly between sample points
```

This is complex but gives the smoothest result.

---

## File Structure

```
public/heatmap-demo/
├── layers/
│   ├── barcelona-neighborhoods.json  (1.3MB) ✅
│   ├── barcelona-metro-stations.json (51KB)  ✅
│   ├── barcelona-parks.json          (370KB) ❌ Points, need polygons
│   └── barcelona-coast.json          (1.3KB) ❌ Points, need polygon
├── barcelona-heatmap-v1.png          (1.7MB) - 48k hexes
├── barcelona-heatmap-v2.png          (5.5MB) - 980k hexes
├── barcelona-heatmap-v1-metadata.json
├── barcelona-heatmap-v2-metadata.json
└── [Large JSON files - CAN DELETE]
    ├── barcelona-h3-heatmap.json     (51MB)
    ├── barcelona-h3-heatmap-v2.json  (424MB)
    ├── barcelona-heatmap-v1.svg      (7.3MB)
    └── barcelona-heatmap-v2.svg      (133MB)
```

---

## Cost Analysis

| Operation | Items | Cost |
|-----------|-------|------|
| DynamoDB scans (one-time) | ~600k items | ~$0.50 |
| PNG generation | CPU-bound | Free (local) |
| S3 storage (if deployed) | ~10MB | ~$0.01/month |
| Mapbox loads | Included in free tier | $0 |

**Total: ~$0.50 one-time, negligible ongoing**

---

## Summary

### What Works Well
- ✅ PNG raster heatmap (77x smaller than JSON)
- ✅ Neighborhood polygons (good data)
- ✅ Metro station points (good data)
- ✅ Toggle panel UX
- ✅ **Enhanced POI data** with area, wikidata, dog-friendly tags (Dec 8, 2025)
- ✅ **Curated notable POIs** for 10 SERP cities (49 POIs with vibes/tips)

### What Needs Work
- ❌ Parks Display: Use Mapbox's built-in `landuse` layer (not our point data)
- ❌ Coast Display: Use Mapbox's built-in `water` layer for sea highlight
- ⚠️ PNG resolution: Could be higher (4096+)

### Key Insight

> **The progressive layer approach is the right architecture.**  
> Show your "research" during chat (lightweight).  
> Generate the final heatmap at the end (heavy computation, but only once).

This makes the UX feel responsive while still delivering high-quality results.

---

## POI Data Enhancement (Dec 8, 2025)

### Enhanced `leo-osm-pois` Table

Re-imported 126,009 POIs with new fields:

| Field | Purpose | Example |
|-------|---------|---------|
| `areaM2` | Filter big vs small | `74310` |
| `wikidata` | Notable indicator | `"Q43174653"` |
| `notable` | Combined filter (wikidata OR area>10k) | `true` |
| `dog` | Dog-friendly | `"yes"`, `"leashed"`, `"no"` |
| `wheelchair` | Accessibility | `"yes"`, `"limited"` |
| `lit` | Night lighting | `"yes"` |
| `surface` | Ground type | `"grass"`, `"sand"` |
| `access` | Public access | `"public"`, `"private"` |

**Stats:**
- 22,081 notable POIs (wikidata OR large area)
- 10,594 large areas (>10,000m²)  
- 13,732 with Wikipedia reference
- 113 dog-friendly

### Curated Notable POIs (`src/data/notable-pois.ts`)

49 hand-curated POIs for the 10 SERP cities with:
- Vibe descriptions
- "Good for" / "Not good for" tags
- Local tips

Cities: Barcelona, Madrid, Valencia, Sevilla, Málaga, San Sebastián, Bilbao, Palma, Granada, Alicante

---

## Three-Tier POI System

### Tier 1: Curated Notable POIs
- 49 hand-crafted entries with vibes/tips
- Used for Leo Brain recommendations
- File: `src/data/notable-pois.ts`

### Tier 2: Auto-Filtered POIs
- 22k+ POIs with `notable=true`
- Query: `wikidata exists OR areaM2 > 10000`
- Used for scoring calculations

### Tier 3: Gemini World Knowledge
- Gemini knows famous parks/beaches
- Fills gaps in data
- Provides reasoning about "what's good for dogs" etc.

---

## Next Steps (When Ready to Implement)

1. **Fix Parks Display**: Use Mapbox's built-in `landuse` layer instead of our point data
2. **Fix Coast Display**: Use Mapbox's built-in `water` layer for sea highlight
3. **Higher Res PNG**: Increase to 4096x4096
4. **Server API**: Create on-demand heatmap generation endpoint
5. **Delete Large Files**: Remove 615MB of JSON/SVG files

---

## References

- [H3 Documentation](https://h3geo.org/)
- [Mapbox GL JS Layers](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/)
- [Mapbox Raster Sources](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#image)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [Overpass API (OSM)](https://overpass-api.de/)
