---
test_id: "S.2"
name: "Render info card for area"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "None (UI component)"
cost: "FREE"
implementation: null
last_tested: null
---

### Shared.2 - Render info card for area

| | |
|---|---|
| **Input** | Area object with name, why, itinerary |
| **Output** | Info card overlay with navigation arrows |
| **API** | None (UI component) |
| **Cost** | FREE |
| **Proves** | UI displays area details correctly |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area object + current index + total count | Input from click handler or state |
| 2 | Render card container | Fixed position overlay, bottom-right or floating near circle |
| 3 | Display area name as header | `<h3>{area.name}</h3>` |
| 4 | Display "why" description | `<p>{area.why}</p>` |
| 5 | Display itinerary list (if present) | Map `area.itinerary` to clickable items |
| 6 | Add navigation arrows | `< Prev` / `Next >` buttons that cycle `currentAreaIndex` |
| 7 | Add close button | Sets `showCard = false` |
| 8 | Show position indicator | `"2 of 5"` based on index |

**📋 TEST INPUT (copy-paste):**
```json
{
  "name": "El Born",
  "why": "The heart of Barcelona's nightlife - narrow medieval streets packed with wine bars and cocktail lounges",
  "itinerary": [
    { "emoji": "🍸", "activity": "Cocktail bars", "searchQuery": "cocktail bars El Born" },
    { "emoji": "🍷", "activity": "Wine caves", "searchQuery": "wine caves El Born" }
  ],
  "currentIndex": 1,
  "totalCount": 5
}
```
