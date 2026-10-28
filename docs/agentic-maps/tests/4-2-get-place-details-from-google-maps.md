---
test_id: "4.2"
name: "Get place details from Google Maps"
scenario: 4
scenario_name: "Scenario 4: Single Place"
status: not-started
api: "ScrapingDog Google Maps"
cost: "$0.001"
implementation: null
last_tested: null
---

### Test 4.2 - Get place details from Google Maps

| | |
|---|---|
| **Input** | Place name + city (e.g., "Fuunji Tokyo") |
| **Output** | Card with details + pin on map |
| **API** | ScrapingDog Google Maps |
| **Cost** | $0.001 |
| **Proves** | ScrapingDog GMaps returns structured place data |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take place name + city | Input from text field or Test 4.1 output |
| 2 | Build search query | `"{placeName} {city}"` |
| 3 | Call ScrapingDog Google Maps Search | `GET https://api.scrapingdog.com/google_maps?api_key={key}&query={encoded}` |
| 4 | Parse response | Extract first result from `local_results` |
| 5 | Extract: `title`, `address`, `rating`, `reviews`, `price`, `hours`, `gps_coordinates` | Map to structured object |
| 6 | Store `place_id` for review fetching | Keep for Test 4.3 |
| 7 | Render info card | Display in `PlaceCard` component |
| 8 | Place pin on map | Call Shared.3 with coordinates |

**📋 TEST INPUT (copy-paste):**
```
Fuunji, Tokyo
```

**Expected output:**
```
📍 Fuunji
   2-14-3 Yoyogi, Shibuya City
   ⭐ 4.5 (2,847 reviews)
   💰 $$
   🕐 11:00 AM - 3:00 PM, 5:00 PM - 9:00 PM
   [Pin on map at 139.7020, 35.6833]
```
