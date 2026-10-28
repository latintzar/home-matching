---
test_id: "2.2"
name: "Generate nearby highlights for a stay area"
scenario: 2
scenario_name: "Scenario 2: Where to Stay"
status: not-started
api: "Gemini 2.5 Flash"
cost: "~$0.001"
implementation: null
last_tested: null
---

### Test 2.2 - Generate nearby highlights for a stay area

| | |
|---|---|
| **Input** | Neighborhood name + coordinates |
| **Output** | 3 "things to do near your hotel" suggestions |
| **API** | Gemini 2.5 Flash |
| **Cost** | ~$0.001 |
| **Proves** | AI understands "near accommodation" context |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area object (name, city, lat, lng) | Input from Test 2.1 output or hardcoded |
| 2 | Send to Gemini 2.5 Flash | `POST` to Vertex AI |
| 3 | Prompt: "For someone staying in {area}, {city}, suggest 3 things to do NEARBY (walking distance). Return JSON array with `emoji`, `activity`, `distance`, `searchQuery`" | Structured output prompt |
| 4 | Parse JSON array | `JSON.parse()` |
| 5 | Generate search URLs for each | Call Shared.4 |
| 6 | Display in "Near your stay" section of info card | Render in UI |

**📋 TEST INPUT (copy-paste):**
```
Shibuya, Tokyo [35.6580, 139.7016]
```

**Expected output:**
```
🍜 Morning ramen spots (5 min walk) → [GMaps] [TikTok]
🛍️ Shibuya 109 shopping (2 min walk) → [GMaps] [TikTok]
🌸 Yoyogi Park stroll (10 min walk) → [GMaps] [TikTok]
```
