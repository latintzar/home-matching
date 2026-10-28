---
test_id: "7.5"
name: "Insert stops based on constraints"
scenario: 7
scenario_name: "Scenario 7: Multi-Stop Route"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.01"
implementation: null
last_tested: null
---

### Test 7.5 - Insert stops based on constraints

| | |
|---|---|
| **Input** | Route combinations + constraints (siesta, wheelchair, etc.) |
| **Output** | Modified routes with inserted breaks, labeled by fit to time window |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.01 |
| **Proves** | AI can adapt routes to real-world constraints |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take combinations from 7.4 + constraints from 7.3 | |
| 2 | For each combination, AI determines where to insert breaks | "Insert 2hr break after stop 2 for siesta" |
| 3 | Filter venues for accessibility | Check wheelchair accessible |
| 4 | Recalculate timing with breaks | Add break duration to route |
| 5 | Compare end time to target | `delta = actualEnd - targetEnd` |
| 6 | Label each option | "⏱️ 15 min under" or "⚠️ 45 min over" |
| 7 | Color code | Green (under), yellow (close ±30min), red (over) |
| 8 | Display all options with timing labels | |
| 9 | For each option, show stops with arrows | Navigate between stops in card |
| 10 | Separate card for option description | Navigate between options |

**📋 TEST INPUT (copy-paste):**
```json
{
  "routeOptions": [
    {
      "id": "A",
      "name": "Trinity First",
      "stops": [
        { 
          "order": 1, 
          "name": "Trinity College", 
          "type": "attraction",
          "lat": 53.3438, "lng": -6.2546,
          "arrival": "11:00", 
          "departure": "12:30", 
          "duration": "1h 30min",
          "wheelchairAccessible": true,
          "walkFromPrevious": null
        },
        { 
          "order": 2, 
          "name": "Temple Bar lunch", 
          "type": "food",
          "lat": 53.3454, "lng": -6.2644,
          "arrival": "12:45", 
          "departure": "14:30", 
          "duration": "1h 45min",
          "wheelchairAccessible": true,
          "walkFromPrevious": "15 min (800m)"
        },
        { 
          "order": 3, 
          "name": "SIESTA BREAK", 
          "type": "break",
          "lat": null, "lng": null,
          "arrival": "15:00", 
          "departure": "17:00", 
          "duration": "2h",
          "note": "Rest at hotel or café"
        },
        { 
          "order": 4, 
          "name": "Georgian Quarter", 
          "type": "explore",
          "lat": 53.3382, "lng": -6.2591,
          "arrival": "17:15", 
          "departure": "19:00", 
          "duration": "1h 45min",
          "wheelchairAccessible": true,
          "walkFromPrevious": "15 min (750m)"
        },
        { 
          "order": 5, 
          "name": "Guinness Storehouse", 
          "type": "attraction",
          "lat": 53.3419, "lng": -6.2867,
          "arrival": "19:30", 
          "departure": "21:35", 
          "duration": "2h 05min",
          "wheelchairAccessible": true,
          "walkFromPrevious": "30 min (1.5km)"
        }
      ],
      "totals": {
        "walkingTime": "60 min",
        "walkingDistance": "3.05 km",
        "finishTime": "21:35",
        "targetEndTime": "22:00",
        "delta": "-25 min",
        "status": "under"
      }
    },
    {
      "id": "B", 
      "name": "Guinness First",
      "stops": [
        { "order": 1, "name": "Guinness Storehouse", "arrival": "11:00", "departure": "13:30", "duration": "2h 30min", "wheelchairAccessible": true },
        { "order": 2, "name": "Temple Bar lunch", "arrival": "14:00", "departure": "15:00", "duration": "1h", "wheelchairAccessible": true, "walkFromPrevious": "25 min" },
        { "order": 3, "name": "SIESTA BREAK", "arrival": "15:00", "departure": "17:00", "duration": "2h" },
        { "order": 4, "name": "Trinity College", "arrival": "17:20", "departure": "18:50", "duration": "1h 30min", "wheelchairAccessible": true, "walkFromPrevious": "20 min" },
        { "order": 5, "name": "Georgian Quarter", "arrival": "19:05", "departure": "21:50", "duration": "2h 45min", "wheelchairAccessible": true, "walkFromPrevious": "15 min" }
      ],
      "totals": { "walkingTime": "60 min", "finishTime": "21:50", "targetEndTime": "22:00", "delta": "-10 min", "status": "under" }
    },
    {
      "id": "C",
      "name": "Cultural Focus",
      "stops": [
        { "order": 1, "name": "Trinity College", "arrival": "11:00", "departure": "13:00", "duration": "2h", "wheelchairAccessible": true },
        { "order": 2, "name": "National Museum", "arrival": "13:15", "departure": "15:00", "duration": "1h 45min", "wheelchairAccessible": true, "walkFromPrevious": "15 min" },
        { "order": 3, "name": "SIESTA BREAK", "arrival": "15:00", "departure": "17:00", "duration": "2h" },
        { "order": 4, "name": "Georgian Quarter", "arrival": "17:15", "departure": "19:00", "duration": "1h 45min", "wheelchairAccessible": true },
        { "order": 5, "name": "Temple Bar pubs", "arrival": "19:20", "departure": "22:35", "duration": "3h 15min", "wheelchairAccessible": true, "walkFromPrevious": "20 min" }
      ],
      "totals": { "walkingTime": "50 min", "finishTime": "22:35", "targetEndTime": "22:00", "delta": "+35 min", "status": "over" }
    }
  ],
  "constraints": {
    "startTime": "11:00",
    "targetEndTime": "22:00",
    "siestaRequired": { "around": "15:00", "duration": "2h", "for": "Dad" },
    "wheelchairRequired": { "for": "Friend", "allVenuesMustBeAccessible": true },
    "groupSize": 4,
    "pace": "relaxed"
  },
  "preferences": {
    "focus": ["pubs", "history"],
    "mustSee": ["Trinity College"]
  }
}
```

**Expected output:**
```
┌─────────────────────────────────────────────────────────────┐
│ Option A: Trinity First                                     │
│ ✅ 25 min UNDER target (finishes 21:35)                     │
├─────────────────────────────────────────────────────────────┤
│ 1. 🏛️ Trinity College      11:00-12:30  (1h30m)  ♿         │
│    ↓ 15 min walk                                            │
│ 2. 🍽️ Temple Bar lunch     12:45-14:30  (1h45m)  ♿         │
│    ↓ transit to hotel                                       │
│ 3. 🛏️ SIESTA BREAK         15:00-17:00  (2h)     Dad       │
│    ↓ 15 min walk                                            │
│ 4. 🚶 Georgian Quarter     17:15-19:00  (1h45m)  ♿         │
│    ↓ 30 min walk                                            │
│ 5. 🍺 Guinness Storehouse  19:30-21:35  (2h05m)  ♿         │
├─────────────────────────────────────────────────────────────┤
│ Total walking: 60 min (3.05 km)                             │
│ [← Prev Option]     Option 1 of 3     [Next Option →]       │
└─────────────────────────────────────────────────────────────┘

Timing labels across options:
• Option A: ✅ 25 min under
• Option B: ✅ 10 min under  
• Option C: ⚠️ 35 min over
```
