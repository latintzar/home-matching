---
test_id: "4.3"
name: "Get reviews for a place"
scenario: 4
scenario_name: "Scenario 4: Single Place"
status: not-started
api: "ScrapingDog Google Maps Reviews"
cost: "$0.001"
implementation: null
last_tested: null
---

### Test 4.3 - Get reviews for a place

| | |
|---|---|
| **Input** | Place name or place ID |
| **Output** | 5 recent reviews with quotes, ratings, dates |
| **API** | ScrapingDog Google Maps Reviews |
| **Cost** | $0.001 |
| **Proves** | Can fetch authentic review content |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take `place_id` from Test 4.2 (or search first if not available) | Input string |
| 2 | Call ScrapingDog Google Maps Reviews | `GET https://api.scrapingdog.com/google_maps_reviews?api_key={key}&data_id={place_id}` |
| 3 | Parse response | Extract `reviews` array |
| 4 | For top 5 reviews, extract: `rating`, `text`, `relative_date` | Map to structured objects |
| 5 | Generate star display | `'⭐'.repeat(rating)` |
| 6 | Truncate long review text | First 100 chars + "..." |
| 7 | Display as list | Render in `ReviewsList` component |

**📋 TEST INPUT (copy-paste):**
```
Fuunji Tokyo
```

**Expected output:**
```
⭐⭐⭐⭐⭐ "The broth is incredibly rich..." - 2 days ago
⭐⭐⭐⭐⭐ "Peaceful atmosphere, focused on food" - 1 week ago
⭐⭐⭐⭐ "Worth the wait, cash only though" - 2 weeks ago
```
