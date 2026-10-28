---
test_id: "S.1"
name: "Render vibe circles on map"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "Mapbox GL (already loaded)"
cost: "Included in map load"
implementation: null
last_tested: null
---

### Shared.1 - Render vibe circles on map

| | |
|---|---|
| **Input** | Array of areas with name, lat, lng, radius, color |
| **Output** | Colored circles on Mapbox, clickable |
| **API** | Mapbox GL (already loaded) |
| **Cost** | Included in map load |
| **Proves** | Core map visualization works |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take array of area objects | Input from any area-generating test |
| 2 | Convert to GeoJSON FeatureCollection | `{ type: 'FeatureCollection', features: areas.map(a => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: { name: a.name, color: a.color } })) }` |
| 3 | Add source to map | `map.addSource('vibe-areas', { type: 'geojson', data: geojson })` |
| 4 | Add circle layer | `map.addLayer({ id: 'vibe-circles', type: 'circle', source: 'vibe-areas', paint: { 'circle-radius': 40, 'circle-color': ['get', 'color'], 'circle-opacity': 0.6 } })` |
| 5 | Add click handler | `map.on('click', 'vibe-circles', (e) => { setCurrentArea(e.features[0].properties) })` |
| 6 | Add hover cursor | `map.on('mouseenter', 'vibe-circles', () => map.getCanvas().style.cursor = 'pointer')` |

**📋 TEST INPUT (copy-paste):**
```json
[
  { "name": "El Born", "lat": 41.3851, "lng": 2.1816, "color": "#f97316", "why": "Best nightlife" },
  { "name": "Gràcia", "lat": 41.4036, "lng": 2.1567, "color": "#f97316", "why": "Local vibe" },
  { "name": "Raval", "lat": 41.3797, "lng": 2.1682, "color": "#f97316", "why": "Edgy art scene" }
]
```
