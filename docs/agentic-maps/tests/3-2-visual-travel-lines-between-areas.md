---
test_id: "3.2"
name: "Visual travel lines between areas"
scenario: 3
scenario_name: "Scenario 3: Stay + Do"
status: not-started
api: "Turf.js (local, no API)"
cost: "FREE"
implementation: null
last_tested: null
---

### Test 3.2 - Visual travel lines between areas

| | |
|---|---|
| **Input** | 2 stay areas + 3 activity areas with coordinates |
| **Output** | Subtle travel lines on map with times, togglable |
| **API** | Turf.js (local, no API) |
| **Cost** | FREE |
| **Proves** | Visual travel planning without API calls |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take 2 stay areas + 3 activity areas with coords | Input from Test 3.1 |
| 2 | Import Turf.js | `import * as turf from '@turf/turf'` |
| 3 | Calculate Stay→Do lines (2×3 = 6 lines) | Each stay to each activity |
| 4 | Calculate Do→Do lines (3 lines) | Do1→Do2, Do2→Do3, Do3→Do1 |
| 5 | For each line, calculate distance | `turf.distance()` |
| 6 | Estimate times for walk/transit/drive | `walk: dist*12, transit: dist*4, drive: dist*2` min/km |
| 7 | Draw subtle dashed lines on map | Mapbox LineString, `line-dasharray: [2, 2]`, opacity 0.4 |
| 8 | Add time labels at line midpoints | Small text: "12 min" |
| 9 | Add iOS-style toggle top-right corner | Colored handle + matching colored label |
| 10 | Toggle labeled "Travel Times" | Toggle ON → show lines; OFF → hide |
| 11 | Line colors: Stay→Do = purple, Do→Do = orange | Visual distinction |

**📋 TEST INPUT (copy-paste):**
```json
{
  "stayAreas": [
    { "name": "Le Marais", "lat": 48.8566, "lng": 2.3622 },
    { "name": "Saint-Germain", "lat": 48.8530, "lng": 2.3350 }
  ],
  "activityAreas": [
    { "name": "Montmartre", "lat": 48.8867, "lng": 2.3431 },
    { "name": "Latin Quarter", "lat": 48.8490, "lng": 2.3470 },
    { "name": "Bastille", "lat": 48.8533, "lng": 2.3692 }
  ]
}
```

**Expected output:**
```
Map shows:
- 6 purple dashed lines (each Stay → each Do) with times
- 3 orange dashed lines (Do1→Do2, Do2→Do3, Do3→Do1) with times

Top-right toggle:
┌──────────────────────┐
│ 🟢 Travel Times      │  ← iOS-style toggle, green when ON
└──────────────────────┘

Line labels: "8 min", "15 min", "12 min", etc.
```
