---
test_id: "1.3"
name: "Generate itinerary WITH coordinates"
scenario: 1
scenario_name: "Scenario 1: Things to Do"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 1.3 - Generate itinerary WITH coordinates

| | |
|---|---|
| **Input** | Area name + city + lat/lng + vibe |
| **Output** | 3 search suggestions with clickable GMaps + TikTok links |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | Coordinates improve suggestion relevance and precision |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area object (name, city, lat, lng, vibe) | Input from Test 1.1 output or hardcoded |
| 2 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 3 | Prompt: "Give 3 activity suggestions for {vibe} in {area}, {city} (centered at {lat}, {lng}). Return JSON array with `emoji`, `activity`, `searchQuery`" | Include coords in prompt for precision |
| 4 | Parse JSON array | `JSON.parse()` |
| 5 | For each item, call Shared.4 to generate URLs | `generateSearchURLs(item.searchQuery, city)` |
| 6 | Render in info card UI | Pass to `ItineraryList` component |

**📋 TEST INPUT (copy-paste):**
```
El Born, Barcelona [41.3851, 2.1816] - nightlife
```

**Expected output:**
```
🍸 Hidden speakeasies → [GMaps] [TikTok]
🍷 Natural wine bars → [GMaps] [TikTok]  
🌙 Late-night pintxos → [GMaps] [TikTok]
```
