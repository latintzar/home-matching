---
test_id: "6.1"
name: "Generate multi-modal isochrones for one person"
scenario: 6
scenario_name: "Scenario 6: Areas to Explore Together"
status: not-started
api: "Geoapify Isoline (3 calls)"
cost: "$0.015"
implementation: null
last_tested: null
---

### Test 6.1 - Generate multi-modal isochrones for one person

| | |
|---|---|
| **Input** | Coordinates + 3 modes (walk, transit, drive @ 30min each) |
| **Output** | 3 overlapping polygons on map (different colors per mode) |
| **API** | Geoapify Isoline (3 calls) |
| **Cost** | $0.015 |
| **Proves** | We can show travel options from one origin |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take coordinates + modes array + minutes | Input from UI or hardcoded |
| 2 | Define color map | `{ walk: '#22c55e', transit: '#3b82f6', drive: '#a855f7' }` |
| 3 | For each mode, call Geoapify Isoline (parallel) | `Promise.all(modes.map(mode => fetch(geoapifyUrl)))` |
| 4 | Parse all responses | Extract GeoJSON polygons |
| 5 | Store all polygons for later intersection | Keep in state as `{ walk: polygon, transit: polygon, drive: polygon }` |
| 6 | Add layers in order: drive (bottom), transit, walk (top) | Larger polygons behind smaller |
| 7 | Add legend showing mode colors | Render in UI corner |

**📋 TEST INPUT (copy-paste):**
```
40.6782, -73.9442 | walk, transit, drive | 30 min
```

**Expected output:**
- 🟢 Walk polygon (smallest)
- 🔵 Transit polygon (medium)
- 🟣 Drive polygon (largest)
