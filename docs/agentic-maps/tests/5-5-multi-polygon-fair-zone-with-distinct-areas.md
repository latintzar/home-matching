---
test_id: "5.5"
name: "Multi-polygon fair zone with distinct areas"
scenario: 5
scenario_name: "Scenario 5: Meet in Middle"
status: not-started
api: "Mapbox Isochrone + Turf.js"
cost: "~$0.002"
implementation: null
last_tested: null
---

### Test 5.5 - Multi-polygon fair zone with distinct areas

| | |
|---|---|
| **Input** | Two locations that create discontinuous intersection (river, park between) |
| **Output** | Multiple fair zones: one covering several neighborhoods, another just one |
| **API** | Mapbox Isochrone + Turf.js |
| **Cost** | ~$0.002 |
| **Proves** | System handles discontinuous fair zones gracefully |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two locations in city with natural barriers | e.g., "Westminster" + "Southwark" (River Thames) |
| 2 | Generate isochrones for both | Mapbox Isochrone API |
| 3 | Compute intersection | Turf.js (same as 5.3) |
| 4 | Expect: 2+ separate polygons | One larger (bridges/tunnels area), one smaller |
| 5 | For each zone, calculate area | `turf.area(zone)` |
| 6 | Label zones by size | "Zone A (large)" vs "Zone B (small)" |
| 7 | For each zone, run Test 5.4 | Identify neighborhoods in each zone |
| 8 | Display zones with distinct borders | Solid vs dashed, or different shades |
| 9 | Show summary | "Zone A: 3 neighborhoods" + "Zone B: 1 neighborhood" |
| 10 | User can click each zone to see details | Separate info cards |

**📋 TEST INPUT (copy-paste):**
```
Westminster, London | Southwark, London | walking | 15 min
```

**Expected output:**
```
Map shows:
- 2 distinct green intersection zones

Zone A (near bridges): 0.6 km²
- Waterloo
- South Bank  
- Embankment

Zone B (isolated): 0.15 km²
- Borough
  (reachable via London Bridge only)

Card: "2 fair zones found"
      [Zone A] [Zone B] ← clickable tabs
```
