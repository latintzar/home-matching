# P0-06: UI Components — Map, Carousel, Cards

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Overview

The UI has two main modes:
1. **During Call:** Live map with real-time updates + vibe-check overlays
2. **Dashboard:** Property cards with fit scores and explanations

---

## Live Map (During Call)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LIVE MAP ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SINGLE MAPBOX INSTANCE (Never Reloads)                                    │
│   ──────────────────────────────────────                                    │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                                                                 │       │
│   │   BASE MAP                                                      │       │
│   │   │                                                             │       │
│   │   ├── Commute Zone Layer (Turf.js circles)                     │       │
│   │   │   └── Concentric rings at 30, 45, 60 min                   │       │
│   │   │                                                             │       │
│   │   ├── Neighborhood Layer (Fill polygons)                        │       │
│   │   │   └── Colored by dimension match                           │       │
│   │   │                                                             │       │
│   │   ├── Heatmap Layer (Gradient circles)                          │       │
│   │   │   └── POI scores as heat intensity                         │       │
│   │   │                                                             │       │
│   │   └── POI Markers                                               │       │
│   │       └── Coffee, gym, etc. with icons                         │       │
│   │                                                                 │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│   LAYER UPDATES VIA WEBSOCKET (No reload)                                   │
│   ─────────────────────────────────────────                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| `LiveMap.tsx` | Single Mapbox instance (never reloads) |
| `useLiveMapUpdates.ts` | Update layers without reload |
| `CommuteZoneLayer.tsx` | Turf.js radial circles |
| `NeighborhoodLayer.tsx` | Fill polygons per neighborhood |
| `HeatmapLayer.tsx` | Gradient overlay from fit scores |
| `POIMarkers.tsx` | Show POIs with icons |
| `HeatmapLegend.tsx` | Score legend explanation |

### Heatmap Color Scheme (Hot → Cold)

**Consistent across landing page, intake call, and dashboard.**

| Zone | Color | Hex | Opacity | Meaning |
|------|-------|-----|---------|---------|
| 🔴 **Hot** | Red | `#ef4444` | 0.5 | Great for your Lifestyle |
| 🟡 **Warm** | Yellow | `#eab308` | 0.4 | Good for your Commute |
| 🔵 **Cool** | Blue | `#3b82f6` | 0.3 | Out of the way |
| ⬜ **None** | Transparent | — | 0 | Outside zones |

```typescript
// src/lib/map/heatmap-colors.ts

export const HEATMAP_COLORS = {
  lifestyle: { color: '#ef4444', opacity: 0.5, label: 'Great for Lifestyle' },
  commute:   { color: '#eab308', opacity: 0.4, label: 'Good for Commute' },
  far:       { color: '#3b82f6', opacity: 0.3, label: 'Out of the way' },
} as const;

// Mapbox heatmap layer paint
export const heatmapPaint = {
  'heatmap-color': [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(0,0,0,0)',           // Transparent
    0.3, 'rgba(59,130,246,0.3)',  // Blue
    0.6, 'rgba(234,179,8,0.4)',   // Yellow
    1, 'rgba(239,68,68,0.5)',     // Red
  ],
  'heatmap-radius': 30,
  'heatmap-opacity': 0.8,
};
```

**Usage:**
- **Landing page:** Static SVG overlay on Mapbox screenshot
- **Intake call:** Live Mapbox heatmap layer  
- **Dashboard/Profile:** Same live heatmap

### WebSocket Integration

```typescript
// src/hooks/useLiveMapUpdates.ts

export function useLiveMapUpdates(mapRef: MapRef) {
  const channel = useSupabaseChannel('map-updates');
  
  useEffect(() => {
    channel.on('ZOOM_TO_CITY', ({ city, bounds }) => {
      mapRef.current?.fitBounds(bounds, { padding: 50 });
    });
    
    channel.on('ADD_COMMUTE_ZONE', ({ anchorId, geojson }) => {
      mapRef.current?.addSource(`zone-${anchorId}`, { type: 'geojson', data: geojson });
      mapRef.current?.addLayer({
        id: `zone-${anchorId}`,
        type: 'fill',
        source: `zone-${anchorId}`,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['get', 'opacity'],
        }
      });
    });
    
    channel.on('SET_NEIGHBORHOODS', ({ geojson }) => {
      mapRef.current?.getSource('neighborhoods')?.setData(geojson);
    });
    
    channel.on('UPDATE_HEATMAP', ({ geojson }) => {
      mapRef.current?.getSource('heatmap')?.setData(geojson);
    });
    
    return () => channel.unsubscribe();
  }, [channel, mapRef]);
}
```

---

## Desktop vs Mobile

### Desktop: Continuous Side-by-Side

```
┌──────────────────────────────┬──────────────────────────────────────────────┐
│                              │                                              │
│   CALL/CHAT UI               │   MAP (always visible, updating)             │
│                              │                                              │
│   Leo: "Tell me about..."    │       ╭─────────╮                            │
│                              │      ╱░▒▓████▓▒░╲  ← Updates live            │
│   You: "I work in..."        │     │▒▓████████▓▒│   as you speak            │
│                              │      ╲░▒▓████▓▒░╱                            │
│   Leo: "Got it! And..."      │       ╰─────────╯                            │
│                              │                                              │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

### Mobile: Checkpoint-Based Overlays

| # | Trigger | Style | Duration |
|---|---------|-------|----------|
| 1 | City mentioned | Toast | 2-3 sec (auto-dismiss) |
| 2 | First anchor | Toast | 2-3 sec |
| 3 | Commute zones formed | Bottom sheet (60%) | Until dismissed |
| 4 | Vibe-check | Full overlay | Until complete |
| 5 | Heatmap complete | Full overlay | Until dismissed |

### Mobile Components

| Component | Purpose |
|-----------|---------|
| `MapToast.tsx` | Quick update notification |
| `MapBottomSheet.tsx` | Commute zone reveal |
| `MapFullOverlay.tsx` | Final map reveal |
| `useMapDisplayMode.ts` | Responsive hook (desktop vs mobile) |

---

## Vibe-Check Overlay

During vibe-check, property photos replace the map:

```
NORMAL MODE (Map)                        VIBE-CHECK MODE (Properties)
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ CALL UI        │    MAP         │      │ CALL UI        │  VIBE-CHECK    │
│                │                │      │                │                │
│ Leo: "Tell me  │  ╭─────────╮   │      │ Leo: "Forget   │ ┌────────────┐ │
│ about your     │ ╱░▒▓████▓▒░╲  │      │ location for   │ │ 📸 PHOTO 1 │ │
│ lifestyle..."  │ │▒▓██ 85% █▓▒│ │  ──► │ a sec. What    │ │            │ │
│                │  ╲░▒▓████▓▒░╱  │      │ do you think   │ │  "Light: 8"│ │
│                │   ╰─────────╯  │      │ of this one?"  │ │  "Space: 7"│ │
│                │                │      │                │ └────────────┘ │
│ [Mute] [End]   │                │      │ [Mute] [End]   │ [Love] [Meh]  │
└─────────────────────────────────┘      └─────────────────────────────────┘
```

### Vibe-Check Components

| Component | Purpose |
|-----------|---------|
| `VibeCheckOverlay.tsx` | Show listing photos, capture reaction |
| `PropertyCarousel.tsx` | Swipeable property photos |
| `ReactionButtons.tsx` | Love/Meh/Nope buttons |
| `useVibeCheckCarousel.ts` | Handle vibe-check flow |

---

## Property Cards (Dashboard)

### Card Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌─────────────────────┐  ┌─────────────────────────────────────────────┐  │
│   │                     │  │  Piso en Gràcia, 3 hab                      │  │
│   │    📸 PHOTO         │  │                                             │  │
│   │                     │  │  €1,200/mes · 75m² · 3 hab                  │  │
│   │                     │  │                                             │  │
│   │   [❤️]    [🔗]      │  │  ┌─────────────────────────────────────┐    │  │
│   └─────────────────────┘  │  │  FIT SCORE: 82%                     │    │  │
│                            │  │  ████████████████░░░░                │    │  │
│                            │  └─────────────────────────────────────┘    │  │
│                            │                                             │  │
│                            │  "This place nails what you care about     │  │
│                            │   most - those huge south-facing windows    │  │
│                            │   mean great light for your home office."   │  │
│                            │                                             │  │
│                            │  ✅ Natural light · ✅ WFH space · ⚠️ Kitchen │  │
│                            │                                             │  │
│                            │  [View Details →]                           │  │
│                            └─────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Card Components

| Component | Purpose |
|-----------|---------|
| `PropertyCard.tsx` | Full card layout |
| `FitScoreBar.tsx` | Visual score indicator |
| `PersonalizedMatch.tsx` | "Why this matches you" text |
| `DimensionTags.tsx` | Top matches + concerns |
| `SaveButton.tsx` | Like/save to shortlist |

---

## Responsive Hook

```typescript
// src/hooks/useMapDisplayMode.ts

type DisplayMode = 'desktop-split' | 'mobile-toast' | 'mobile-overlay';

export function useMapDisplayMode(): DisplayMode {
  const { width } = useWindowSize();
  
  if (width >= 1024) return 'desktop-split';
  return 'mobile-toast'; // Transitions to 'mobile-overlay' at checkpoints
}
```

---

## Animation Patterns

### Map Layer Transitions

```css
/* Smooth layer opacity transitions */
.mapboxgl-layer {
  transition: opacity 0.3s ease-in-out;
}

/* Commute zone pulse animation */
@keyframes zone-pulse {
  0% { opacity: 0.3; }
  50% { opacity: 0.5; }
  100% { opacity: 0.3; }
}
```

### Card Entrance

```typescript
// Staggered card entrance using framer-motion
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.1 }}
>
  <PropertyCard {...card} />
</motion.div>
```

---

## Heatmap Color Scheme

**Consistent across:** Landing page, intake call map, dashboard map, property page map.

### Color Gradient (Hot → Cold)

| Zone | Color | Hex | Opacity | Meaning |
|------|-------|-----|---------|---------|
| 🔴 **Red** | Red | `#ef4444` | 0.5 | **Great for your Lifestyle** — High fit score, near POIs you care about |
| 🟡 **Yellow** | Amber | `#eab308` | 0.4 | **Good for your Commute** — Reasonable commute, some lifestyle matches |
| 🔵 **Blue** | Blue | `#3b82f6` | 0.3 | **Out of the way** — Long commute or few lifestyle matches |
| ⬜ **Transparent** | — | — | 0 | **Outside zones** — Not considered |

### Visual Logic

```
                    🏢 Work
                      │
         ┌────────────┼────────────┐
         │      🔴🔴🔴🔴🔴         │ ← Red: "This is YOUR zone"
         │    🔴🔴🔴🔴🔴🔴🔴       │    Near work + your gym + good coffee
         │  🟡🟡🔴🔴🔴🔴🔴🟡🟡     │
         │🟡🟡🟡🟡🔴🔴🔴🟡🟡🟡🟡   │ ← Yellow: "Commute is fine"
         │🔵🔵🟡🟡🟡🟡🟡🟡🟡🔵🔵   │    But fewer lifestyle matches
         │🔵🔵🔵🔵🟡🟡🟡🔵🔵🔵🔵   │
         │  🔵🔵🔵🔵🔵🔵🔵🔵🔵     │ ← Blue: "Out of the way"
         │    🔵🔵🔵🔵🔵🔵🔵       │    Long commute, not ideal
         └────────────────────────┘
                   │
                   ↓
              Transparent (not shown)
```

### Mapbox Layer Implementation

```typescript
// src/components/map/HeatmapLayer.tsx

export const HEATMAP_COLORS = {
  lifestyle: '#ef4444',  // Red - Great for lifestyle
  commute: '#eab308',    // Yellow - Good for commute
  far: '#3b82f6',        // Blue - Out of the way
};

export const HeatmapLayer = ({ scores }: { scores: GeoJSON.FeatureCollection }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map.current) return;
    
    map.current.addLayer({
      id: 'lifestyle-heatmap',
      type: 'fill',
      source: 'heatmap-source',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'score'],
          0, 'transparent',           // 0% - not shown
          0.3, '#3b82f6',             // 30% - Blue (out of way)
          0.5, '#eab308',             // 50% - Yellow (commute ok)
          0.7, '#ef4444',             // 70%+ - Red (lifestyle match)
        ],
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'score'],
          0, 0,
          0.3, 0.3,
          0.5, 0.4,
          0.7, 0.5,
        ],
      },
    });
  }, [map, scores]);
  
  return null;
};
```

### Legend Component

```typescript
// src/components/map/HeatmapLegend.tsx

export const HeatmapLegend = ({ locale }: { locale: 'es' | 'en' }) => {
  const labels = {
    en: {
      lifestyle: 'Great for your Lifestyle',
      commute: 'Good for your Commute', 
      far: 'Out of the way',
    },
    es: {
      lifestyle: 'Ideal para tu Estilo de Vida',
      commute: 'Buen Commute',
      far: 'Lejos',
    },
  };
  
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-stone-200">
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span className="text-stone-700">{labels[locale].lifestyle}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500" />
          <span className="text-stone-700">{labels[locale].commute}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-stone-600">{labels[locale].far}</span>
        </div>
      </div>
    </div>
  );
};
```

### Where This Appears

| Location | Component | Notes |
|----------|-----------|-------|
| **Landing page** | `PersonalizedHeatmapIllustration` | Static overlay on Barcelona screenshot |
| **Intake call** | `LiveMap` + `HeatmapLayer` | Real-time updates via WebSocket |
| **Dashboard** | `DashboardMap` | Shows saved areas + recommendations |
| **Property page** | `PropertyLocationMap` | Single property in context of user's heatmap |

---

## File Structure

```
src/components/map/
├── LiveMap.tsx
├── CommuteZoneLayer.tsx
├── NeighborhoodLayer.tsx
├── HeatmapLayer.tsx
├── POIMarkers.tsx
├── HeatmapLegend.tsx
└── index.ts

src/components/map/mobile/
├── MapToast.tsx
├── MapBottomSheet.tsx
└── MapFullOverlay.tsx

src/components/vibe-check/
├── VibeCheckOverlay.tsx
├── PropertyCarousel.tsx
├── ReactionButtons.tsx
└── index.ts

src/components/property/
├── PropertyCard.tsx
├── FitScoreBar.tsx
├── PersonalizedMatch.tsx
├── DimensionTags.tsx
└── SaveButton.tsx

src/hooks/
├── useLiveMapUpdates.ts
├── useMapDisplayMode.ts
├── useVibeCheckCarousel.ts
└── usePropertyCards.ts
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | What layers show |
| [P0-05-ELEVENLABS-AGENTS](./P0-05-ELEVENLABS-AGENTS.md) | WebSocket events |

---

*Last Updated: December 2024*

