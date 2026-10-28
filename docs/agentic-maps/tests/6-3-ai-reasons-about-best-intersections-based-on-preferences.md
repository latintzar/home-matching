---
test_id: "6.3"
name: "AI reasons about best intersections based on preferences"
scenario: 6
scenario_name: "Scenario 6: Areas to Explore Together"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 6.3 - AI reasons about best intersections based on preferences

| | |
|---|---|
| **Input** | 9 intersection polygons + user transport preferences |
| **Output** | Top 3 recommended combinations with rationale |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can reason about transport trade-offs to pick best options |

**Note:** This test is a compound exercise combining:
- Test 5.4 (identify neighborhoods in intersection polygons)
- Test 1.2 (itinerary for each area)

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take 9 intersections with areas calculated | From Test 6.2 |
| 2 | Ask user transport preferences | UI: "How do you prefer to travel?" |
| 3 | Collect: Person A preference, Person B preference | Dropdowns or chat: walk/transit/drive |
| 4 | Build context for AI | Each combo: modes, area size, neighborhoods |
| 5 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 6 | Prompt: "Given 9 transport combinations and their intersection sizes, Person A prefers {X}, Person B prefers {Y}. Which 3 combos are best? Consider: preference alignment, area size, fairness. Return JSON `{ top3: [{ personAMode, personBMode, reason }] }`" | |
| 7 | Parse response | `JSON.parse()` |
| 8 | Highlight top 3 on map | Different styling (thicker border) |
| 9 | Show rationale cards | "This works because..." |
| 10 | For selected combo → run 5.4 + 1.2 | Identify neighborhoods + generate itinerary |

**📋 TEST INPUT (copy-paste):**
```json
{
  "personA": {
    "name": "Sarah",
    "location": "Brooklyn (Williamsburg)",
    "preference": "transit",
    "notes": "Doesn't have a car, prefers subway"
  },
  "personB": {
    "name": "Mike", 
    "location": "Manhattan (Midtown)",
    "preference": "walking",
    "notes": "Lives close to work, likes to walk everywhere"
  },
  "intersections": [
    { "a": "walk", "b": "walk", "areaSqKm": 0, "viable": false },
    { "a": "walk", "b": "transit", "areaSqKm": 1.8, "neighborhoods": ["Lower East Side"], "viable": true },
    { "a": "walk", "b": "drive", "areaSqKm": 3.2, "neighborhoods": ["Lower East Side", "East Village"], "viable": true },
    { "a": "transit", "b": "walk", "areaSqKm": 2.1, "neighborhoods": ["SoHo"], "viable": true },
    { "a": "transit", "b": "transit", "areaSqKm": 28.5, "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square"], "viable": true },
    { "a": "transit", "b": "drive", "areaSqKm": 45.0, "neighborhoods": ["SoHo", "NoHo", "West Village", "Chelsea", "Union Square", "Flatiron"], "viable": true },
    { "a": "drive", "b": "walk", "areaSqKm": 3.5, "neighborhoods": ["Midtown", "Times Square"], "viable": false, "reason": "Sarah doesn't drive" },
    { "a": "drive", "b": "transit", "areaSqKm": 52.0, "neighborhoods": ["Midtown", "Hell's Kitchen"], "viable": false, "reason": "Sarah doesn't drive" },
    { "a": "drive", "b": "drive", "areaSqKm": 125.0, "neighborhoods": ["Wide area"], "viable": false, "reason": "Neither prefers driving" }
  ],
  "question": "Which 3 transport combinations work best for Sarah and Mike?"
}
```

**Expected output:**
```
🏆 Top 3 Recommendations for Sarah & Mike:

1. Sarah: Transit | Mike: Walk
   ✅ "Perfect match! Sarah takes the L train, Mike walks from Midtown. 
       Meet in SoHo - 2.1 km² of options."
   Neighborhoods: SoHo
   
2. Sarah: Transit | Mike: Transit  
   ✅ "Largest overlap (28.5 km²) - both hop on the subway.
       Tons of options from West Village to Union Square."
   Neighborhoods: SoHo, NoHo, West Village, Chelsea, Union Square
   
3. Sarah: Walk | Mike: Transit
   ⚠️ "Workable but Sarah walks more than she'd prefer.
       Limited to Lower East Side (1.8 km²)."
   Neighborhoods: Lower East Side

[Top 3 highlighted on map with numbered badges: 1️⃣ 2️⃣ 3️⃣]
```
