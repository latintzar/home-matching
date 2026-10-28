# Vibe Areas - Colored Circle Overlays

**Status**: ✅ Working (as of Dec 2024)
**Last Updated**: Dec 9, 2024

## Overview

This document describes the implementation of **Vibe Areas** - colored circle overlays that replace the previous heatmap image approach.

## Supported Sites

The extension works on:
- **Airbnb** (`*.airbnb.com`, `*.airbnb.co.uk`, `*.airbnb.es`)
- **Booking.com** (`*.booking.com/searchresults*`) ← NEW
- **Idealista** (planned)

Each site has its own search refresh logic in `triggerSearchRefresh()` since they handle URL state differently.

## Quick Reference

```
┌──────────────────────────────────────────────────────────┐
│  VIBE AREAS CONFIG (in injected-script.js)               │
├──────────────────────────────────────────────────────────┤
│  🔴 Gothic Quarter  │ #E74C3C │ 400m │ romantic, historic│
│  🔵 El Born         │ #3498DB │ 350m │ hipster, trendy   │
│  🟢 Gràcia          │ #2ECC71 │ 500m │ local, bohemian   │
│  🟡 Barceloneta     │ #F39C12 │ 400m │ beach, seafood    │
│  🟣 Eixample        │ #9B59B6 │ 600m │ upscale, modernist│
└──────────────────────────────────────────────────────────┘
```

## Architecture Change

### Before (Heatmap Image)
```
┌─────────────────────────────────────┐
│  4096x4096 PNG Heatmap Image        │
│  ┌─────────────────────────────┐    │
│  │  Single geo-referenced      │    │
│  │  OverlayView covering       │    │
│  │  entire Barcelona bounds    │    │
│  └─────────────────────────────┘    │
│  - Slow to load (large image)       │
│  - Complex pixel-based scoring      │
│  - Static bounds                    │
└─────────────────────────────────────┘
```

### After (Vibe Areas)
```
┌─────────────────────────────────────┐
│  Multiple google.maps.Circle        │
│                                     │
│    🔴 Gothic Quarter (romantic)     │
│    🟢 El Born (hipster)             │
│    🔵 Gràcia (local)                │
│    🟡 Barceloneta (beach)           │
│    🟣 Eixample (upscale)            │
│                                     │
│  - Instant rendering (no image)     │
│  - Simple coordinate-based scoring  │
│  - Dynamic, follows map pan/zoom    │
└─────────────────────────────────────┘
```

## Key Components

### 1. Vibe Area Definitions (`VIBE_AREAS`)

Each area is defined with:
- `name`: Human-readable name
- `lat`, `lng`: Center coordinates  
- `radius`: Size in meters
- `color`: Hex color for the area
- `vibes`: Array of vibe tags (romantic, hipster, local, etc.)

```javascript
const VIBE_AREAS = [
  { 
    name: "Gothic Quarter", 
    lat: 41.3833, lng: 2.1777, 
    radius: 400, 
    color: "#E74C3C",
    vibes: ["romantic", "historic", "nightlife"]
  },
  // ... more areas
];
```

### 2. Circle Creation (in `createOverlay()`)

Uses native Google Maps API with click-to-zoom:
```javascript
const circle = new google.maps.Circle({
  map: map,
  center: { lat: area.lat, lng: area.lng },
  radius: area.radius,  // meters
  fillColor: area.color,
  fillOpacity: 0.25,
  strokeColor: area.color,
  strokeOpacity: 0.7,
  strokeWeight: 2,
  clickable: true,  // Enable click to zoom
  zIndex: 1
});

// Click handler - zooms to fill viewport
circle.addListener('click', () => {
  const bounds = circle.getBounds();
  map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  showVibeToast(area.name, area.vibes);
});

// Hover effect
circle.addListener('mouseover', () => {
  circle.setOptions({ fillOpacity: 0.45, strokeWeight: 3 });
});
circle.addListener('mouseout', () => {
  circle.setOptions({ fillOpacity: 0.25, strokeWeight: 2 });
});
```

### 3. Click-to-Zoom Behavior

When a user clicks on a vibe area circle:
1. Map zooms to fit the circle with 50px padding on all sides
2. Toast notification shows area name and vibe tags
3. Hover highlights the circle before clicking

This allows users to quickly explore different neighborhoods.

## Files Modified

| File | Change |
|------|--------|
| `injected-script.js` | Replace `LeoVibeOverlay` class with `createVibeCircles()` function |
| `content-script.js` | Remove heatmap URL passing (no longer needed) |

## What Stays the Same (DO NOT MODIFY)

These components are fragile and must NOT be changed:

1. **`hookGoogleMaps()`** - Constructor interception
2. **`findMapInstance()`** - 8+ methods to find map
3. **`init()`** - Polling and initialization logic
4. **`setupMutationObserver()`** - DOM watching
5. **`setupPeriodicMapCheck()`** - Fallback detection

## Benefits

| Aspect | Heatmap | Vibe Areas |
|--------|---------|------------|
| Load time | ~2-5s (4MB image) | Instant |
| Memory | High | Low |
| Filtering | Complex pixel sampling | Simple distance check |
| Customization | Requires new image | Edit JS config |
| Accuracy | Bounded to image | GPS-accurate |

## Barcelona Vibe Areas

Initial 5 areas covering distinct neighborhoods:

1. **Gothic Quarter** (Barri Gòtic) - Historic center, romantic, nightlife
2. **El Born** - Trendy, hipster, boutiques
3. **Gràcia** - Local vibe, bohemian, authentic
4. **Barceloneta** - Beach, seafood, tourists
5. **Eixample** - Upscale, modernist architecture, shopping

## Parked Features (Documentation Only)

### Listing Filtering by Vibe Area

**Status**: 📄 Code removed from extension, preserved in documentation only

The filtering functionality has been removed from the extension to keep things clean. Below is the full implementation for future reference if needed.

**Full Implementation** (copy to injected-script.js if needed):

```javascript
// ============================================
// VIBE FILTERING - Circle-based scoring
// ============================================

/**
 * Get vibe score for a location based on VIBE_AREAS circles
 * Returns: { score: 0-1, inArea: boolean, areaName: string|null, vibes: string[] }
 */
function getVibeScore(lat, lng) {
  for (const area of VIBE_AREAS) {
    const distance = getDistanceMeters(lat, lng, area.lat, area.lng);
    if (distance <= area.radius) {
      const score = 1 - (distance / area.radius) * 0.5;
      return { score, inArea: true, areaName: area.name, vibes: area.vibes };
    }
  }
  return { score: 0.2, inArea: false, areaName: null, vibes: [] };
}

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Filter listings by vibe threshold (0-1)
 * Fades markers and cards with scores below threshold
 */
function filterListingsByVibe(threshold) {
  // Find map markers with price buttons
  const mapContainer = document.querySelector('.gm-style');
  const priceButtons = mapContainer?.querySelectorAll('button') || [];
  
  priceButtons.forEach(btn => {
    if (!btn.textContent?.match(/[£$€][\d,]+/)) return;
    
    // Get marker position (approximate from screen position)
    const rect = btn.getBoundingClientRect();
    const mapRect = mapContainer.getBoundingClientRect();
    
    // Convert to lat/lng using map bounds (requires map instance)
    // ... coordinate conversion logic ...
    
    const vibeResult = getVibeScore(lat, lng);
    const shouldHide = vibeResult.score < threshold;
    
    if (shouldHide) {
      btn.style.cssText = 'opacity: 0.2 !important; filter: grayscale(100%) !important;';
    } else {
      btn.style.cssText = 'opacity: 1 !important; filter: none !important;';
    }
  });
}

// Listen for filter events from popup
window.addEventListener('leo-vibe-filter', (e) => {
  filterListingsByVibe(e.detail?.threshold ?? 0.3);
});
```

**To activate in the future**:
1. Copy the code above into `injected-script.js`
2. Add a slider to `popup.html`
3. Dispatch `leo-vibe-filter` event with threshold value
4. Listings outside vibe areas will be faded/greyed out

**Why removed**: Keeps extension simple. Click-to-zoom is the core UX.

---

## Future Enhancements

- [ ] More areas (Raval, Poble Sec, Sant Antoni, etc.)
- [ ] Per-vibe filtering (show only "romantic" areas)
- [ ] Activate listing filtering via popup UI
- [ ] Multi-city support with different area configs
- [ ] User-customizable areas
