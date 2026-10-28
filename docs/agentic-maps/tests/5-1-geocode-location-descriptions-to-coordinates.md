---
test_id: "5.1"
name: "Geocode location descriptions to coordinates"
scenario: 5
scenario_name: "Scenario 5: Meet in Middle"
status: not-started
api: "Mapbox Geocoding"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 5.1 - Geocode location descriptions to coordinates

| | |
|---|---|
| **Input** | Two text locations (e.g., "Shoreditch, London" and "Camden, London") |
| **Output** | Two pins on map with coordinates displayed |
| **API** | Mapbox Geocoding |
| **Cost** | ~$0.001 |
| **Proves** | Fuzzy locations convert to precise coordinates |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take two location strings | Input from text fields |
| 2 | For each location, call Mapbox Geocoding API | `GET https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json?access_token={token}` |
| 3 | Parse response | Extract first result's `center` array `[lng, lat]` |
| 4 | Store coordinates | `{ locationA: { lng, lat }, locationB: { lng, lat } }` |
| 5 | Place colored pins on map | Call Shared.3 twice with different colors |
| 6 | Display coordinates in UI | Show under each location name |
| 7 | Fit map bounds to show both pins | `map.fitBounds([[lng1, lat1], [lng2, lat2]])` |

**📋 TEST INPUT (copy-paste):**
```
Shoreditch, London | Camden, London
```

**Expected output:**
```
🔵 Shoreditch: -0.0777, 51.5246 [pin on map]
🔴 Camden: -0.1426, 51.5390 [pin on map]
```
