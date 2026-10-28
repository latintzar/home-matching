---
test_id: "7.4"
name: "Compute route combinations with matrix"
scenario: 7
scenario_name: "Scenario 7: Multi-Stop Route"
status: not-started
api: "Mapbox Matrix + Directions"
cost: "~$0.02"
implementation: null
last_tested: null
---

### Test 7.4 - Compute route combinations with matrix

| | |
|---|---|
| **Input** | Areas (from 7.1) + preferences + logistics |
| **Output** | All route combinations with cards + multi-stop directions on map |
| **API** | Mapbox Matrix + Directions |
| **Cost** | ~$0.02 |
| **Proves** | Matrix computation works for multi-stop planning |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Filter areas matching preferences | From 7.1, keep relevant areas |
| 2 | Get coordinates for 4-6 candidate areas | |
| 3 | Call Mapbox Matrix API | `GET .../directions-matrix/v1/mapbox/{mode}/{coords}` |
| 4 | Parse durations matrix | 2D array in seconds |
| 5 | Generate candidate permutations | Different orderings of stops |
| 6 | For each permutation, calculate total time | Sum matrix values along route |
| 7 | Display all combinations as cards | "Option A: 4.5 hours" |
| 8 | On hover/click → show route on map | Mapbox Directions polyline |
| 9 | Show per-segment times | "Stop 1 → Stop 2: 12 min" |

**📋 TEST INPUT (copy-paste):**
```json
{
  "areas": ["Temple Bar", "Trinity College", "Georgian Quarter", "Guinness Storehouse"],
  "mode": "walking",
  "preferences": { "pace": "relaxed", "mustSee": ["Trinity College"] }
}
```

**Expected output:**
```
Option A: Trinity → Temple Bar → Georgian → Guinness
         Total: 4.2 hours walking

Option B: Trinity → Georgian → Temple Bar → Guinness
         Total: 3.8 hours walking

Option C: Guinness → Temple Bar → Trinity → Georgian
         Total: 4.5 hours walking

[Click any option to see route on map]
```
