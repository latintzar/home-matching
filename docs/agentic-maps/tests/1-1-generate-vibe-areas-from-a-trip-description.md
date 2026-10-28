---
test_id: "1.1"
name: "Generate vibe areas from a trip description"
scenario: 1
scenario_name: "Scenario 1: Things to Do"
status: not-started
api: "Gemini 2.5 Pro + Google Search grounding"
cost: "~$0.005"
implementation: null
last_tested: null
---

### Test 1.1 - Generate vibe areas from a trip description

| | |
|---|---|
| **Input** | Text description of trip (e.g., "cool bars in Barcelona") |
| **Output** | 5 colored circles on map at neighborhood coordinates |
| **API** | Gemini 2.5 Pro + Google Search grounding |
| **Cost** | ~$0.005 |
| **Proves** | AI can identify real neighborhoods with accurate lat/lng |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take user query string | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding enabled | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt asks for JSON: 5 neighborhoods with `name`, `lat`, `lng`, `why` | Structured output prompt |
| 4 | Parse JSON response | `JSON.parse()` the model output |
| 5 | Pass array to Shared.1 (render circles) | Call `renderVibeCircles(areas)` |

**📋 TEST INPUT (copy-paste):**
```
cool bars in Barcelona
```

**Expected output:**
- El Born (circle at ~2.18, 41.38)
- Gràcia (circle at ~2.15, 41.40)
- Raval (circle at ~2.17, 41.38)
- Barceloneta (circle at ~2.19, 41.38)
- Poble Sec (circle at ~2.16, 41.37)
