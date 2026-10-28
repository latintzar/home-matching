---
test_id: "1.2"
name: "Generate itinerary WITHOUT coordinates"
scenario: 1
scenario_name: "Scenario 1: Things to Do"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 1.2 - Generate itinerary WITHOUT coordinates

| | |
|---|---|
| **Input** | Area name + city + vibe (NO coordinates) |
| **Output** | 3 search suggestions with clickable GMaps + TikTok links |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI can create suggestions from area name alone (casual use case) |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area name, city, vibe (no lat/lng) | Input from UI or hardcoded |
| 2 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 3 | Prompt: "Give 3 activity suggestions for {vibe} in {area}, {city}. Return JSON array with `emoji`, `activity`, `searchQuery`" | Structured output prompt |
| 4 | Parse JSON array | `JSON.parse()` |
| 5 | For each item, call Shared.4 to generate URLs | `generateSearchURLs(item.searchQuery, city)` |
| 6 | Render in info card UI | Pass to `ItineraryList` component |

**📋 TEST INPUT (copy-paste):**
```
El Born, Barcelona - nightlife
```

**Expected output:**
```
🍸 Cocktail bars → [GMaps] [TikTok]
🍷 Wine caves → [GMaps] [TikTok]  
🌙 Late night tapas → [GMaps] [TikTok]
```
