---
test_id: "5.2"
name: "Generate isochrone from a location (Mapbox)"
scenario: 5
scenario_name: "Scenario 5: Meet in Middle"
status: not-started
api: "Mapbox Isochrone (cheaper than Geoapify)"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 5.2 - Generate isochrone from a location (Mapbox)

| | |
|---|---|
| **Input** | Coordinates + travel mode + minutes |
| **Output** | Shaded polygon on map showing reachable area |
| **API** | Mapbox Isochrone (cheaper than Geoapify) |
| **Cost** | ~$0.001 |
| **Proves** | Isochrone API works and renders properly |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take coordinates, mode, minutes | Input from Test 5.1 or hardcoded |
| 2 | Map mode to Mapbox format | `{ walk: 'walking', bike: 'cycling', drive: 'driving' }` |
| 3 | Call Mapbox Isochrone API | `GET https://api.mapbox.com/isochrone/v1/mapbox/{mode}/{lng},{lat}?contours_minutes={minutes}&polygons=true&access_token={token}` |
| 4 | Parse response | Extract `features[0].geometry` (GeoJSON Polygon or MultiPolygon) |
| 5 | Note: Result may be MultiPolygon if area has gaps | Isochrones can be "wonky" |
| 6 | Store GeoJSON for later intersection | Keep in state |
| 7 | Add polygon layer to Mapbox | `map.addLayer({ type: 'fill', source: { type: 'geojson', data: polygon }, paint: { 'fill-opacity': 0.3, 'fill-color': '#3b82f6' } })` |

**📋 TEST INPUT (copy-paste):**
```
51.5246, -0.0777 | walking | 20 min
```

**Expected output:**
- Semi-transparent polygon on map showing 20-min walk reach from Shoreditch
- Note: May show as multiple disconnected areas if blocked by river/park
