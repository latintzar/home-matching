---
test_id: "S.3"
name: "Render place pin on map"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "Mapbox GL"
cost: "Included in map load"
implementation: null
last_tested: null
---

### Shared.3 - Render place pin on map

| | |
|---|---|
| **Input** | Place object with name, coords, rating |
| **Output** | Pin marker with popup |
| **API** | Mapbox GL |
| **Cost** | Included in map load |
| **Proves** | Single-place visualization works |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take place object | Input from Test 4.2 or any place-fetching test |
| 2 | Create marker element | `const el = document.createElement('div'); el.className = 'place-marker'` |
| 3 | Style marker (or use Mapbox default) | CSS for custom pin icon |
| 4 | Create Mapbox Marker | `new mapboxgl.Marker(el).setLngLat([place.lng, place.lat])` |
| 5 | Create popup with place info | `new mapboxgl.Popup().setHTML(\`<h4>${place.name}</h4><p>⭐ ${place.rating}</p>\`)` |
| 6 | Attach popup to marker | `marker.setPopup(popup)` |
| 7 | Add marker to map | `marker.addTo(map)` |
| 8 | Store marker reference for cleanup | Keep in state array for removal later |

**📋 TEST INPUT (copy-paste):**
```json
{
  "name": "Fuunji",
  "lat": 35.6833,
  "lng": 139.7020,
  "rating": 4.5,
  "address": "2-14-3 Yoyogi, Shibuya City"
}
```
