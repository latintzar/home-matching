---
test_id: "5.3"
name: "Compute intersection of two isochrones (handles multi-polygon)"
scenario: 5
scenario_name: "Scenario 5: Meet in Middle"
status: not-started
api: "Turf.js (FREE, local)"
cost: "FREE"
implementation: null
last_tested: null
---

### Test 5.3 - Compute intersection of two isochrones (handles multi-polygon)

| | |
|---|---|
| **Input** | Two isochrone GeoJSONs (may be Polygon or MultiPolygon) |
| **Output** | One or more highlighted "fair zone" polygons on map |
| **API** | Turf.js (FREE, local) |
| **Cost** | FREE |
| **Proves** | Polygon intersection works even with wonky isochrones |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two GeoJSONs from Test 5.2 | May be Polygon or MultiPolygon |
| 2 | Import Turf.js | `import * as turf from '@turf/turf'` |
| 3 | Normalize inputs | If MultiPolygon, use `turf.flatten()` to get individual polygons |
| 4 | Wrap as FeatureCollections | `turf.featureCollection([...polygons])` |
| 5 | Compute intersection | `turf.intersect(featureCollection_a, featureCollection_b)` |
| 6 | Handle result types | May return `null`, `Polygon`, `MultiPolygon`, or `GeometryCollection` |
| 7 | If no intersection → show "No overlap found" | Handle `null` gracefully |
| 8 | If MultiPolygon/GeometryCollection → extract all pieces | `turf.flatten()` again if needed |
| 9 | Store as array of polygons | `intersectionZones: Feature[]` |
| 10 | Fade original polygons | Update layer opacity to 0.1 |
| 11 | Render EACH intersection zone | Same bright color, or label them "Zone A", "Zone B" |
| 12 | Calculate total area | `zones.reduce((sum, z) => sum + turf.area(z), 0)` |
| 13 | Fit map to all intersection bounds | Combined bbox |

**📋 TEST INPUT (copy-paste):**
```json
{
  "polygon_a": {
    "type": "Polygon",
    "description": "20-min walk isochrone from Shoreditch",
    "center": { "name": "Shoreditch", "lat": 51.5246, "lng": -0.0777 },
    "coordinates": [[
      [-0.0977, 51.5146], [-0.0877, 51.5096], [-0.0727, 51.5096], [-0.0577, 51.5146],
      [-0.0527, 51.5246], [-0.0527, 51.5346], [-0.0577, 51.5396], [-0.0727, 51.5446],
      [-0.0877, 51.5446], [-0.0977, 51.5396], [-0.1027, 51.5296], [-0.1027, 51.5196],
      [-0.0977, 51.5146]
    ]]
  },
  "polygon_b": {
    "type": "Polygon",
    "description": "20-min walk isochrone from Camden",
    "center": { "name": "Camden", "lat": 51.5390, "lng": -0.1426 },
    "coordinates": [[
      [-0.1626, 51.5290], [-0.1526, 51.5240], [-0.1376, 51.5240], [-0.1226, 51.5290],
      [-0.1176, 51.5390], [-0.1176, 51.5490], [-0.1226, 51.5540], [-0.1376, 51.5590],
      [-0.1526, 51.5590], [-0.1626, 51.5540], [-0.1676, 51.5440], [-0.1676, 51.5340],
      [-0.1626, 51.5290]
    ]]
  }
}
```

**Expected output:**
- Original polygons faded (blue for Shoreditch, red for Camden)
- Intersection zone highlighted in bright green
- Label: "1 fair zone found (0.45 km²)"
- Area around Angel/Islington where both can walk to
