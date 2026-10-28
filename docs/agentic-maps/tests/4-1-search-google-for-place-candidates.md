---
test_id: "4.1"
name: "Search Google for place candidates"
scenario: 4
scenario_name: "Scenario 4: Single Place"
status: not-started
api: "ScrapingDog Google Search"
cost: "$0.001"
implementation: null
last_tested: null
---

### Test 4.1 - Search Google for place candidates

| | |
|---|---|
| **Input** | Query + location (e.g., "best ramen Shibuya quiet") |
| **Output** | List of 3 candidate place names with snippets |
| **API** | ScrapingDog Google Search |
| **Cost** | $0.001 |
| **Proves** | ScrapingDog returns useful results for place discovery |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take query string | Input from text field |
| 2 | URL encode the query | `encodeURIComponent(query)` |
| 3 | Call ScrapingDog Google Search API | `GET https://api.scrapingdog.com/google?api_key={key}&query={encoded}&results=10` |
| 4 | Parse response JSON | Extract `organic_results` array |
| 5 | Filter to top 3 relevant results | Check for place-like titles (has location words) |
| 6 | Extract `title` and `snippet` for each | Map to `{ name, snippet }` |
| 7 | Display as numbered list | Render in UI |

**📋 TEST INPUT (copy-paste):**
```
best quiet ramen Shibuya Tokyo
```

**Expected output:**
```
1. Fuunji - "legendary tsukemen, calm atmosphere..."
2. Ichiran Shibuya - "private booths, solo dining..."
3. Afuri Shibuya - "light yuzu ramen, modern space..."
```
