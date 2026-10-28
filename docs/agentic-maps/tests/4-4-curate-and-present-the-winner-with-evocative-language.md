---
test_id: "4.4"
name: "Curate and present the winner with evocative language"
scenario: 4
scenario_name: "Scenario 4: Single Place"
status: not-started
api: "Gemini 2.5 Flash Lite"
cost: "~$0.0005"
implementation: null
last_tested: null
---

### Test 4.4 - Curate and present the winner with evocative language

| | |
|---|---|
| **Input** | 3 place candidates with details + user criteria |
| **Output** | Single recommendation with evocative title + explanation, displayed on map |
| **API** | Gemini 2.5 Flash Lite |
| **Cost** | ~$0.0005 |
| **Proves** | AI can pick winner and describe using language that evokes what people think |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take candidates array + criteria array | Input from Tests 4.1-4.3 or hardcoded |
| 2 | Build context string | Format each candidate: name, rating, top 3 review snippets |
| 3 | Send to Gemini 2.5 Flash Lite | `POST` to Vertex AI |
| 4 | Prompt: "User wants {criteria}. Here are 3 options: {context}. Pick the BEST one. Give it an evocative title based on review sentiment (e.g., 'The Local Favorite', 'Hidden Gem', 'The Crowd-Pleaser', 'Quiet Escape', 'Authentic Soul'). Return JSON with `winner`, `evocativeTitle`, `whatPeopleSay` (one-line essence from reviews), `tips`, `warnings`" | Use evocative language |
| 5 | Parse JSON response | `JSON.parse()` |
| 6 | Display winner pin on map | Call Shared.3 with winner coords |
| 7 | Show card with evocative presentation | Title + sentiment + tips |

**📋 TEST INPUT (copy-paste):**
```json
{
  "criteria": ["quiet", "authentic"],
  "candidates": [
    { 
      "name": "Fuunji", 
      "rating": 4.5,
      "address": "2-14-3 Yoyogi, Shibuya",
      "lat": 35.6833,
      "lng": 139.7020,
      "priceLevel": "$$",
      "reviews": [
        "Peaceful atmosphere, no loud music. Just the sound of slurping noodles. Perfect for solo diners.",
        "Traditional Tokyo ramen shop that hasn't changed in 20 years. The owner takes his craft seriously.",
        "Quiet spot tucked away from the tourist crowds. Cash only but worth it.",
        "Authentic tsukemen experience. No frills, just incredible broth and perfect noodles.",
        "Calm and focused vibe. Regulars come here to enjoy the food, not to chat."
      ]
    },
    { 
      "name": "Ichiran Shibuya", 
      "rating": 4.3,
      "address": "1-22-7 Jinnan, Shibuya",
      "lat": 35.6623,
      "lng": 139.6993,
      "priceLevel": "$$",
      "reviews": [
        "Private booths are great for introverts but the line was 45 minutes long. Very touristy.",
        "Efficient system but feels like eating in a factory. Good for quick solo meal.",
        "Decent ramen but the experience feels manufactured. Lost its soul to scale.",
        "Popular with tourists for a reason - reliable and consistent, just not special.",
        "The customization sheet is fun but the vibe is sterile."
      ]
    },
    { 
      "name": "Afuri Shibuya", 
      "rating": 4.4,
      "address": "1-1-2 Ebisu, Shibuya",
      "lat": 35.6468,
      "lng": 139.7102,
      "priceLevel": "$$$",
      "reviews": [
        "Modern hip vibe with loud music and Instagram-worthy presentation. Young trendy crowd.",
        "The yuzu shio broth is unique and delicious but it's always packed and noisy.",
        "Sleek design, great for dates but not for a quiet meal. Wait times can be brutal.",
        "Innovative take on ramen but feels more like a brand than a ramen shop.",
        "Good if you want to be seen. Not traditional at all but the food is solid."
      ]
    }
  ]
}
```

**Expected output:**
```
🏆 The Quiet Escape

   Fuunji
   
   "A calm retreat where the broth speaks for itself"
   
   💡 Tips: Go early, try the thick noodles
   ⚠️ Heads up: Cash only

   [Pin displayed on map at 35.6833, 139.7020]
```

**Evocative title examples:**
- "The Local Favorite" - when reviews mention "locals love this"
- "Hidden Gem" - when off the beaten path, few tourists
- "The Crowd-Pleaser" - high ratings, broad appeal
- "Quiet Escape" - when reviews mention peaceful atmosphere
- "Authentic Soul" - when traditional, unchanged over years
- "The Institution" - long-standing, legendary status
