---
test_id: "7.6"
name: "AI chooses best option(s) with rationale"
scenario: 7
scenario_name: "Scenario 7: Multi-Stop Route"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 7.6 - AI chooses best option(s) with rationale

| | |
|---|---|
| **Input** | All evaluated combinations from 7.5 |
| **Output** | Top 1-3 options with clear rationale |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can make final recommendation with explanation |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take all options with timing evaluations | |
| 2 | Send to Gemini | |
| 3 | Prompt: "Given options, preferences {X}, constraints {Y}, which 1-3 are best? Return JSON `{ recommendations: [{ optionId, rationale }] }`" | |
| 4 | Parse response | |
| 5 | Fade or hide non-recommended options | |
| 6 | Display recommended options prominently | |
| 7 | Show rationale under each | "Best because..." |

**📋 TEST INPUT (copy-paste):**
```json
{
  "evaluatedOptions": [
    {
      "id": "A",
      "name": "Trinity First",
      "route": "Trinity → Temple Bar lunch → SIESTA → Georgian Quarter → Guinness",
      "finishTime": "21:35",
      "delta": "-25 min",
      "status": "under",
      "highlights": ["Trinity College (must-see ✓)", "Ends at Guinness (easy transport home)"],
      "concerns": [],
      "allAccessible": true,
      "siestaFits": true,
      "totalWalking": "60 min"
    },
    {
      "id": "B",
      "name": "Guinness First",
      "route": "Guinness → Temple Bar lunch → SIESTA → Trinity → Georgian Quarter",
      "finishTime": "21:50",
      "delta": "-10 min",
      "status": "under",
      "highlights": ["Beat crowds at Guinness (opens 9:30am)", "Trinity in golden hour light"],
      "concerns": ["Tight buffer if delays"],
      "allAccessible": true,
      "siestaFits": true,
      "totalWalking": "60 min"
    },
    {
      "id": "C",
      "name": "Cultural Focus",
      "route": "Trinity → National Museum → SIESTA → Georgian Quarter → Temple Bar pubs",
      "finishTime": "22:35",
      "delta": "+35 min",
      "status": "over",
      "highlights": ["More history/culture", "Ends in pub area"],
      "concerns": ["35 min over target", "Might rush last stop", "Dad might be tired"],
      "allAccessible": true,
      "siestaFits": true,
      "totalWalking": "50 min"
    },
    {
      "id": "D",
      "name": "Pub Crawl Heavy",
      "route": "Temple Bar → Brazen Head → SIESTA → Guinness → Stag's Head → Kehoe's",
      "finishTime": "23:15",
      "delta": "+75 min",
      "status": "over",
      "highlights": ["Maximum pub time", "Historic pubs"],
      "concerns": ["Way over target (75 min)", "Skips Trinity (must-see!)", "Too much for Dad"],
      "allAccessible": false,
      "siestaFits": false,
      "totalWalking": "45 min"
    }
  ],
  "constraints": {
    "targetEndTime": "22:00",
    "mustSee": ["Trinity College"],
    "wheelchairRequired": true,
    "siestaRequired": true,
    "pace": "relaxed"
  },
  "groupContext": "4 people: couple, Dad (needs siesta), friend (wheelchair)"
}
```

**Expected output:**
```
🏆 Top Pick: Option A - Trinity First

"This is your best bet because:
• ⏱️ Finishes 25 min early - buffer for bathroom breaks, photos, Dad resting
• 🏛️ Trinity College first thing when everyone's fresh
• 🛏️ Siesta (3-5pm) fits perfectly after lunch
• ♿ All 5 venues wheelchair accessible for your friend
• 🍺 Ends at Guinness - easy to grab taxi/bus back from there
• ✅ Hits your must-see (Trinity) without rushing"

🥈 Also Good: Option B - Guinness First

"Solid backup:
• Beat the Guinness crowds (opens 9:30am, gets busy by noon)
• See Trinity in beautiful late afternoon light
• ⚠️ Only 10 min buffer though - if anything runs late, you're cutting it close"

❌ Not Recommended:
• Option C: 35 min over target - Dad will be exhausted
• Option D: Skips Trinity entirely + not wheelchair accessible

[Option A highlighted prominently on map, Option B shown as secondary]
```
