---
test_id: "5.4"
name: "Identify neighborhoods in a polygon"
scenario: 5
scenario_name: "Scenario 5: Meet in Middle"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 5.4 - Identify neighborhoods in a polygon

| | |
|---|---|
| **Input** | GeoJSON polygon coordinates (the intersection zone) |
| **Output** | List of neighborhood names + circles inside the zone |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can identify which neighborhoods fall within bounds |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take intersection polygon + city name | Input from Test 5.3 |
| 2 | Calculate bounding box | `turf.bbox(polygon)` → `[minLng, minLat, maxLng, maxLat]` |
| 3 | Calculate centroid | `turf.centroid(polygon)` → `[lng, lat]` |
| 4 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 5 | Prompt: "In {city}, what neighborhoods fall within these bounds: SW corner ({minLat}, {minLng}), NE corner ({maxLat}, {maxLng})? Return JSON array with `name`, `lat`, `lng` for each neighborhood" | Structured output prompt |
| 6 | Parse JSON response | `JSON.parse()` |
| 7 | Filter: only keep points inside polygon | `turf.booleanPointInPolygon([lng, lat], polygon)` |
| 8 | Render circles inside zone | Call Shared.1 for filtered neighborhoods |

**📋 TEST INPUT (copy-paste):**
```json
{
  "zone": {
    "type": "Polygon",
    "description": "Intersection zone between Shoreditch and Camden 20-min walks",
    "boundingBox": {
      "sw": { "lat": 51.5240, "lng": -0.1176 },
      "ne": { "lat": 51.5446, "lng": -0.0877 }
    },
    "coordinates": [[
      [-0.1100, 51.5280], [-0.1000, 51.5250], [-0.0920, 51.5280],
      [-0.0880, 51.5350], [-0.0900, 51.5420], [-0.0980, 51.5450],
      [-0.1080, 51.5440], [-0.1150, 51.5380], [-0.1160, 51.5320],
      [-0.1100, 51.5280]
    ]],
    "areaSqKm": 0.45
  },
  "city": "London",
  "context": "Fair meeting zone for two people - one from Shoreditch, one from Camden"
}
```

**Expected output:**
```
Neighborhoods in fair zone:
• Angel (51.5362, -0.1058)
• Clerkenwell (51.5226, -0.1036)
• Kings Cross (51.5308, -0.1238)
[3 orange circles drawn inside the green intersection zone]
```
