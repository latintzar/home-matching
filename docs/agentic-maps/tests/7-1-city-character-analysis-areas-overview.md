---
test_id: "7.1"
name: "City character analysis (areas overview)"
scenario: 7
scenario_name: "Scenario 7: Multi-Stop Route"
status: not-started
api: "Gemini 2.5 Pro + grounding"
cost: "~$0.005"
implementation: null
last_tested: null
---

### Test 7.1 - City character analysis (areas overview)

| | |
|---|---|
| **Input** | City name |
| **Output** | Map centered on city, circles for all notable areas, cards with specific/area mix per area |
| **API** | Gemini 2.5 Pro + grounding |
| **Cost** | ~$0.005 |
| **Proves** | AI understands city geography and area characters |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take city name | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt: "For {city}, identify 8-10 distinct areas visitors might explore. For each: name, coordinates, character description, and what % of visits there would be SPECIFIC PLACES (restaurants, landmarks) vs AREAS to wander. Return JSON array with `name`, `lat`, `lng`, `character`, `specificPercent`, `areaPercent`" | |
| 4 | Parse response | `JSON.parse()` |
| 5 | Render circles for all areas on map | Color-code by character type |
| 6 | Fit map to show all areas | `map.fitBounds()` |
| 7 | In each area's card, show | Character + "Mix: 70% specific / 30% explore" |
| 8 | Clicking area shows its character detail | Info card with mix breakdown |

**📋 TEST INPUT (copy-paste):**
```
Dublin
```

**Expected output:**
```
Map: 8 colored circles across Dublin

Cards for each area:
┌─────────────────────────────────────┐
│ Temple Bar                          │
│ "Tourist hub, lively pubs"          │
│ Mix: 80% specific / 20% explore     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Georgian Quarter                    │
│ "Historic streets, architecture"    │
│ Mix: 30% specific / 70% explore     │
└─────────────────────────────────────┘
```
