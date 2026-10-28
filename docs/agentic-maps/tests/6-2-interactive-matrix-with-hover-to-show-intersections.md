---
test_id: "6.2"
name: "Interactive matrix with hover-to-show intersections"
scenario: 6
scenario_name: "Scenario 6: Areas to Explore Together"
status: not-started
api: "Turf.js (local)"
cost: "FREE"
implementation: null
last_tested: null
---

### Test 6.2 - Interactive matrix with hover-to-show intersections

| | |
|---|---|
| **Input** | 6 isochrones (3 per person) as GeoJSON |
| **Output** | 3×3 matrix in card; hover shows blended-color intersection on map |
| **API** | Turf.js (local) |
| **Cost** | FREE |
| **Proves** | Interactive exploration of transport combinations |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take 6 polygon GeoJSONs (3 per person) | Input from Test 6.1 (run twice) |
| 2 | Import Turf.js | `import * as turf from '@turf/turf'` |
| 3 | Define mode colors | `{ walk: '#3b82f6' (blue), transit: '#22c55e' (green), drive: '#eab308' (yellow) }` |
| 4 | Render all 6 isochrones VERY FAINTLY on map | `opacity: 0.08`, subtle presence |
| 5 | Create all 9 combinations | `modes.flatMap(a => modes.map(b => [a, b]))` |
| 6 | For each combo, compute intersection | `turf.intersect(person_a[modeA], person_b[modeB])` |
| 7 | Calculate blended color for each combo | `blendColors(colorA, colorB)` |
| 8 | Calculate area of each intersection | `turf.area(intersection)` |
| 9 | Categorize size | `✗` (none), `S`, `M`, `L`, `XL` |
| 10 | Render 3×3 matrix card bottom-right | Cells show size labels |
| 11 | On HOVER over cell → show that intersection on map | Bright blended color, opacity 0.5 |
| 12 | On hover out → hide intersection | Return to faint isochrones only |
| 13 | On CLICK cell → lock intersection, trigger 5.4 | Show neighborhoods |

**Color blending rules:**
```
Person A    Person B    Blended Result
─────────   ─────────   ──────────────
Walk (blue) + Walk (blue)     = Blue (#3b82f6)
Walk (blue) + Transit (green) = Teal (#22d3ee)
Walk (blue) + Drive (yellow)  = Green (#22c55e)
Transit     + Transit         = Green (#22c55e)
Transit     + Drive           = Lime (#84cc16)
Drive       + Drive           = Yellow (#eab308)
```

**📋 TEST INPUT (copy-paste):**
```json
{
  "personA": {
    "name": "Brooklyn (Williamsburg)",
    "location": { "lat": 40.7081, "lng": -73.9571 },
    "isochrones": {
      "walk": { "areaSqKm": 3.2, "color": "#3b82f6" },
      "transit": { "areaSqKm": 45.0, "color": "#22c55e" },
      "drive": { "areaSqKm": 180.0, "color": "#eab308" }
    }
  },
  "personB": {
    "name": "Manhattan (Midtown)",
    "location": { "lat": 40.7549, "lng": -73.9840 },
    "isochrones": {
      "walk": { "areaSqKm": 3.5, "color": "#3b82f6" },
      "transit": { "areaSqKm": 52.0, "color": "#22c55e" },
      "drive": { "areaSqKm": 195.0, "color": "#eab308" }
    }
  },
  "precomputedIntersections": [
    { "a": "walk", "b": "walk", "areaSqKm": 0, "sizeLabel": "✗", "neighborhoods": [] },
    { "a": "walk", "b": "transit", "areaSqKm": 1.8, "sizeLabel": "S", "neighborhoods": ["Lower East Side"] },
    { "a": "walk", "b": "drive", "areaSqKm": 3.2, "sizeLabel": "M", "neighborhoods": ["Lower East Side", "East Village"] },
    { "a": "transit", "b": "walk", "areaSqKm": 2.1, "sizeLabel": "S", "neighborhoods": ["SoHo"] },
    { "a": "transit", "b": "transit", "areaSqKm": 28.5, "sizeLabel": "L", "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square"] },
    { "a": "transit", "b": "drive", "areaSqKm": 45.0, "sizeLabel": "L", "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square", "Flatiron", "Gramercy"] },
    { "a": "drive", "b": "walk", "areaSqKm": 3.5, "sizeLabel": "M", "neighborhoods": ["Midtown", "Times Square"] },
    { "a": "drive", "b": "transit", "areaSqKm": 52.0, "sizeLabel": "L", "neighborhoods": ["Midtown", "Times Square", "Hell's Kitchen", "Upper West Side", "Upper East Side"] },
    { "a": "drive", "b": "drive", "areaSqKm": 125.0, "sizeLabel": "XL", "neighborhoods": ["Midtown", "Times Square", "Hell's Kitchen", "Upper West Side", "Upper East Side", "Harlem", "Bronx South"] }
  ],
  "travelTime": 30,
  "travelUnit": "minutes"
}
```

**Expected output:**
```
Map: 6 very faint isochrone outlines (3 per person)

Card (bottom-right):
┌───────────────────────────────────────────────────┐
│                Person B (Midtown)                 │
│              Walk    Transit    Drive             │
│ Person A   ───────────────────────────            │
│ (Brooklyn)                                        │
│    Walk      ✗        S         M                 │
│    Transit   S        L         L                 │ ← hover to see
│    Drive     M        L         XL                │   on map
└───────────────────────────────────────────────────┘

On hover "Transit-Transit" (L):
- Map shows GREEN intersection polygon (green + green = green)
- Shows: SoHo, NoHo, West Village, Chelsea, Union Square
- Area: 28.5 km²

On hover "Walk-Drive" (M):
- Map shows TEAL intersection polygon (blue + yellow = green)
- Shows: Lower East Side, East Village
- Area: 3.2 km²
```
