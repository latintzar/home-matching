---
status: design
last_updated: 2024-12-12
building_blocks: [4.1, 4.2, 4.3, 4.4, Shared.3, Shared.4]
---

# Scenario 4: Single Place

> "Best ramen near Shibuya"

## Overview

Find ONE specific venue that matches detailed criteria. Uses ScrapingDog for real web data and Google Maps reviews, then Gemini Flash Lite for curation. Returns a verified place with authentic review insights.

## When This Triggers

- Looking for ONE specific place (not areas)
- Detailed taste/criteria specified
- Location constraint (near X, in Y neighborhood)
- "Best", "recommend", "where can I find" patterns

**Example queries**:
- "best ramen near Shibuya"
- "quiet coffee shop with WiFi in Soho"
- "romantic rooftop bar Barcelona"
- "best pizza near me" (with location)
- "authentic tacos in Mexico City"

## Why Not Use Google AI Grounding?

Google Search grounding is great for area-level knowledge but lacks:
- **Recent reviews**: Can't access latest Google Maps reviews
- **Specific details**: Hours, price range, current menu items
- **Authentic voice**: Real customer experiences
- **Verification**: Confirming place still exists and is good

ScrapingDog + Gemini provides richer, more trustworthy recommendations.

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY (Gemini 2.5 Flash)                      Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "best ramen near Shibuya quiet atmosphere"                          │
│  Output: {                                                                  │
│    scenario: "single-place",                                                │
│    placeType: "restaurant",                                                 │
│    cuisine: "ramen",                                                        │
│    location: "Shibuya, Tokyo",                                              │
│    criteria: ["quiet", "high quality"]                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: GOOGLE SEARCH (ScrapingDog)                      Cost: $0.001     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Query: "best quiet ramen Shibuya Tokyo"                                    │
│  Returns: 10 search results with snippets                                   │
│  Purpose: Find candidate places and review sources                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: EXTRACT CANDIDATES (Gemini 2.5 Flash Lite)       Cost: ~$0.0005   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: Search results                                                      │
│  Output: Top 3 place names to investigate                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: GET PLACE DETAILS (ScrapingDog Google Maps)      Cost: $0.003     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  For each candidate (3x):                                                   │
│  - Name, address, coordinates                                               │
│  - Rating, review count                                                     │
│  - Hours, price level                                                       │
│  - Place ID for reviews                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: GET REVIEWS (ScrapingDog Google Maps Reviews)    Cost: $0.001     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  For top candidate only:                                                    │
│  - Recent reviews array                                                     │
│  - Review text, rating, date                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 6: CURATE & RANK (Gemini 2.5 Flash Lite)            Cost: ~$0.0005   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: Place details + reviews + user criteria                             │
│  Output: Final recommendation with:                                         │
│  - Why this place matches criteria                                          │
│  - Review highlights (quotes)                                               │
│  - Any warnings or tips                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 7: RENDER (Mapbox)                                  Cost: $0.005     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Map centered on place                                                    │
│  - Single marker with place details                                         │
│  - Info card with reviews + GMaps link                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface SinglePlaceResult {
  place: {
    name: string;              // "Fuunji"
    address: string;           // "2-14-3 Yoyogi, Shibuya"
    coordinates: [number, number];
    
    rating: number;            // 4.5
    reviewCount: number;       // 1,234
    priceLevel: '$' | '$$' | '$$$' | '$$$$';
    
    hours: string;             // "11:00 AM - 3:00 PM, 5:00 PM - 9:00 PM"
    phone?: string;
    website?: string;
    
    gmapsUrl: string;          // Direct link to Google Maps
  };
  
  recommendation: {
    whyThisPlace: string;      // Matches user criteria
    reviewHighlights: Array<{
      quote: string;           // "Best tsukemen I've ever had"
      rating: number;
      source: string;          // "Google Maps review"
    }>;
    tips: string[];            // ["Go early to avoid line", "Try the special"]
    warnings?: string[];       // ["Cash only", "Long wait on weekends"]
  };
  
  alternatives?: Array<{       // If user wants options
    name: string;
    rating: number;
    whyNot: string;            // "Great but louder atmosphere"
  }>;
}
```

## Google Maps URL Generation (FREE)

```typescript
// Generate GMaps link without API call
const getGMapsPlaceUrl = (placeName: string, address: string) => {
  const query = encodeURIComponent(`${placeName} ${address}`);
  return `https://www.google.com/maps/search/${query}`;
};

// Example:
getGMapsPlaceUrl('Fuunji', 'Shibuya Tokyo');
// → "https://www.google.com/maps/search/Fuunji%20Shibuya%20Tokyo"
```

## Example Output

**Query**: "quiet ramen place near Shibuya"

```json
{
  "place": {
    "name": "Fuunji",
    "address": "2-14-3 Yoyogi, Shibuya City, Tokyo",
    "coordinates": [139.7020, 35.6833],
    "rating": 4.5,
    "reviewCount": 2847,
    "priceLevel": "$$",
    "hours": "11:00 AM - 3:00 PM, 5:00 PM - 9:00 PM",
    "gmapsUrl": "https://www.google.com/maps/search/Fuunji+Shibuya+Tokyo"
  },
  "recommendation": {
    "whyThisPlace": "Legendary tsukemen spot with a calm, focused atmosphere. No loud music, just the sound of people enjoying exceptional noodles. Perfect for a solo quiet meal.",
    "reviewHighlights": [
      {
        "quote": "The broth is incredibly rich but not overwhelming. Worth every minute of the wait.",
        "rating": 5,
        "source": "Google Maps review"
      },
      {
        "quote": "Peaceful atmosphere, everyone is focused on their food. Perfect for introverts.",
        "rating": 5,
        "source": "Google Maps review"
      }
    ],
    "tips": [
      "Arrive 10 minutes before opening to avoid the longest waits",
      "Try the special thick noodles (太麺)",
      "Counter seating only - great for solo diners"
    ],
    "warnings": [
      "Cash only",
      "Closes between lunch and dinner - check hours"
    ]
  },
  "alternatives": [
    {
      "name": "Ichiran Shibuya",
      "rating": 4.3,
      "whyNot": "Individual booths are quiet but more touristy, less authentic"
    }
  ]
}
```

## UI Components

### Place Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Fuunji                                              ⭐ 4.5 (2,847 reviews) │
│  ─────────────────────────────────────────────────────────────────────────  │
│  2-14-3 Yoyogi, Shibuya City, Tokyo                           💰 $$        │
│  🕐 11:00 AM - 3:00 PM, 5:00 PM - 9:00 PM                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✨ Why This Place                                                  │   │
│  │  Legendary tsukemen spot with a calm, focused atmosphere.           │   │
│  │  Perfect for a solo quiet meal.                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  💬 What People Say:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "The broth is incredibly rich but not overwhelming..."    ⭐⭐⭐⭐⭐ │   │
│  │ "Peaceful atmosphere, everyone is focused on their food"  ⭐⭐⭐⭐⭐ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  💡 Tips:                                                                   │
│  • Arrive 10 min before opening                                            │
│  • Try the special thick noodles (太麺)                                     │
│                                                                             │
│  ⚠️ Heads up: Cash only                                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │              [📍 Open in Google Maps]                             │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Step | Service | Cost |
|------|---------|------|
| Query Classification | Gemini 2.5 Flash | ~$0.001 |
| Google Search | ScrapingDog | $0.001 |
| Extract Candidates | Gemini 2.5 Flash Lite | ~$0.0005 |
| Place Details (×3) | ScrapingDog GMaps | $0.003 |
| Reviews (×1) | ScrapingDog GMaps Reviews | $0.001 |
| Curate & Rank | Gemini 2.5 Flash Lite | ~$0.0005 |
| Map Display | Mapbox Maps GL | $0.005 |
| **Total** | | **~$0.012** |

## ScrapingDog API Usage

### Google Search

```typescript
const searchGoogle = async (query: string) => {
  const response = await fetch(
    `https://api.scrapingdog.com/google?api_key=${API_KEY}&query=${encodeURIComponent(query)}&results=10`
  );
  return response.json();
};
```

### Google Maps Place Search

```typescript
const getPlaceDetails = async (placeName: string, location: string) => {
  const response = await fetch(
    `https://api.scrapingdog.com/google_maps?api_key=${API_KEY}&query=${encodeURIComponent(placeName + ' ' + location)}`
  );
  return response.json();
  // Returns: name, address, coordinates, rating, reviews, hours, etc.
};
```

### Google Maps Reviews

```typescript
const getPlaceReviews = async (placeId: string) => {
  const response = await fetch(
    `https://api.scrapingdog.com/google_maps_reviews?api_key=${API_KEY}&place_id=${placeId}`
  );
  return response.json();
  // Returns: array of reviews with text, rating, date, author
};
```

## Curation Prompt

```typescript
const curationPrompt = `
User is looking for: ${userQuery}
Location: ${location}
Criteria: ${criteria.join(', ')}

Here are 3 candidate places with their details and reviews:
${JSON.stringify(candidates, null, 2)}

Select the BEST match and explain:
1. Why this place matches their specific criteria
2. Pull 2-3 review quotes that support your choice
3. Provide 2-3 actionable tips
4. Note any warnings (cash only, long waits, etc.)

If the top choice has issues, briefly mention 1 alternative.

Return as JSON.
`;
```

## Edge Cases

| Case | Handling |
|------|----------|
| No good matches | Widen search, explain limitations |
| Place closed/gone | Check hours, verify with recent reviews |
| Conflicting reviews | Mention the controversy, let user decide |
| Too many options | Ask clarifying question to narrow down |
| Vague criteria | Ask: "What's most important - atmosphere, price, or food quality?" |

## Follow-up Opportunities

After providing a single place recommendation:

```
"Fuunji looks perfect for your quiet ramen craving! 🍜

Would you like me to:
• Find a coffee spot nearby for after?
• Plan a route with multiple stops?
• Find alternatives if this one is full?"
```

This enables smooth transitions to Scenario 7 (Multi-Stop).

---

[← Stay + Do](03-STAY-AND-DO.md) | [Back to Index](../AGENTIC_MAPS.md) | [Meet in Middle →](05-MEET-IN-MIDDLE.md)
