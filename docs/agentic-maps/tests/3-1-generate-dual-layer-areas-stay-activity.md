---
test_id: "3.1"
name: "Generate dual-layer areas (stay + activity)"
scenario: 3
scenario_name: "Scenario 3: Stay + Do"
status: not-started
api: "Gemini 2.5 Pro + grounding (single call)"
cost: "~$0.005"
implementation: null
last_tested: null
---

### Test 3.1 - Generate dual-layer areas (stay + activity)

| | |
|---|---|
| **Input** | Trip description (e.g., "weekend in Paris") |
| **Output** | 2 blue circles (stay) + 3 orange circles (activities), with collapsible navigation |
| **API** | Gemini 2.5 Pro + grounding (single call) |
| **Cost** | ~$0.005 |
| **Proves** | Single AI call can produce two distinct recommendation sets with proper UI |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take user query string | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt: "For {query}, provide TWO lists: (1) 2 neighborhoods to STAY, (2) 3 neighborhoods for ACTIVITIES. Return JSON with `stayAreas: [...]` and `activityAreas: [...]`, each with `name`, `lat`, `lng`, `why`" | Request 2 stay + 3 activity |
| 4 | Parse JSON with both arrays | `JSON.parse()` |
| 5 | Assign colors: `stayAreas` = blue, `activityAreas` = orange | Set `color` property |
| 6 | Render 2 blue circles + 3 orange circles on map | Call `renderVibeCircles()` |
| 7 | Build unified list: [Stay 1, Stay 2, Do 1, Do 2, Do 3] | Merge arrays with type labels |
| 8 | In card header, show small-text collapsible list | "STAY #1 • STAY #2 • DO #1 • DO #2 • DO #3" |
| 9 | Click list → card becomes list view showing all 5 | Each row: type + number + name |
| 10 | Click row → focus that area, return to detail view | `setCurrentAreaIndex(clickedIndex)` |
| 11 | Prev/Next arrows cycle through ALL 5 as unified list | Stay 1 → Stay 2 → Do 1 → Do 2 → Do 3 → Stay 1... |

**📋 TEST INPUT (copy-paste):**
```
romantic weekend in Paris
```

**Expected output:**
```
Card header (collapsed): STAY #1 • STAY #2 • DO #1 • DO #2 • DO #3
                         ▼ (click to expand)

Card header (expanded):
┌─────────────────────────────┐
│ STAY #1  Le Marais          │ ← click to view
│ STAY #2  Saint-Germain      │
│ DO #1    Montmartre         │
│ DO #2    Latin Quarter      │
│ DO #3    Bastille           │
└─────────────────────────────┘

Map: 2 blue circles + 3 orange circles
Navigation: ← Prev | 2 of 5 | Next →
```
