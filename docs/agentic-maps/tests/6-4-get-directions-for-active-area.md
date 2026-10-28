---
test_id: "6.4"
name: "Get Directions for active area"
scenario: 6
scenario_name: "Scenario 6: Areas to Explore Together"
status: not-started
api: "None (URL construction)"
cost: "FREE"
implementation: null
last_tested: null
---

### Test 6.4 - Get Directions for active area

| | |
|---|---|
| **Input** | Active intersection centroid + Person A location + Person B location |
| **Output** | "Get Directions" button → menu → opens Google Maps |
| **API** | None (URL construction) |
| **Cost** | FREE |
| **Proves** | Seamless handoff to navigation apps |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take active intersection polygon | From 6.2 or 6.3 |
| 2 | Calculate centroid | `turf.centroid(intersection)` |
| 3 | Have Person A and Person B locations | From Test 5.1 (geocoded) |
| 4 | Show "Get Directions" button on active card | Prominent button |
| 5 | On click → show menu | "For Person A" / "For Person B" |
| 6 | On selection → build Google Maps URL | Origin = person location, Dest = centroid |
| 7 | URL format | `https://www.google.com/maps/dir/{origin_lat},{origin_lng}/{dest_lat},{dest_lng}` |
| 8 | Open in new tab | `window.open(url, '_blank')` |

**📋 TEST INPUT (copy-paste):**
```
Active area: Angel, London [51.5362, -0.1058]
Person A: Shoreditch [51.5246, -0.0777]
Person B: Camden [51.5390, -0.1426]
```

**Expected output:**
```
Card shows:
┌─────────────────────────────────────┐
│ Angel Area                          │
│ 3 neighborhoods to explore          │
│                                     │
│ [🗺️ Get Directions]                 │
└─────────────────────────────────────┘

On click "Get Directions":
┌─────────────────────────────────────┐
│ Navigate to Angel from:             │
│                                     │
│ [👤 Person A (Shoreditch)]          │
│ [👤 Person B (Camden)]              │
└─────────────────────────────────────┘

Click "Person A" → opens:
https://www.google.com/maps/dir/51.5246,-0.0777/51.5362,-0.1058
```
