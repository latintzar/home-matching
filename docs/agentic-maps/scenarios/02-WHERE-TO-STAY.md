---
status: design
last_updated: 2024-12-12
building_blocks: [2.1, 2.2, Shared.1, Shared.2, Shared.5]
---

# Scenario 2: Where to Stay

> "Where should I stay in Tokyo?"

## Overview

Accommodation-focused area recommendations. Returns 5 neighborhoods optimized for different traveler profiles (budget, location, vibe). **Critically, we do NOT recommend specific hotels/apartments** - we recommend *areas* and provide direct links to booking platforms.

## CRITICAL: No Specific Accommodation Recommendations

### Why We Don't Recommend Specific Hotels/Apartments

1. **Price Volatility**: Hotel prices change hourly based on demand, inventory, and booking platform
2. **Availability**: A "recommended" hotel that's fully booked creates frustration
3. **User Preferences**: Room types, amenities, cancellation policies are deeply personal
4. **Platform Expertise**: Airbnb and Booking.com have superior filtering and reviews
5. **Liability**: We can't verify current conditions, cleanliness, or service quality

### Agent Response Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER: "What's the best hotel in Barcelona?"                                │
│                                                                             │
│  AGENT: "I can help you find the best NEIGHBORHOODS to stay in Barcelona   │
│          based on your trip style! 🏨                                       │
│                                                                             │
│          Rather than recommending specific hotels (prices and availability │
│          change constantly), I'll show you 5 great areas and give you      │
│          direct links to search Airbnb and Booking.com in those areas!"    │
│                                                                             │
│          What kind of trip is this?                                         │
│          • Romantic weekend                                                 │
│          • Family vacation                                                  │
│          • Budget backpacking                                               │
│          • Business + leisure                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## When This Triggers

- Single city mentioned
- Accommodation intent (stay, hotel, where to sleep, neighborhood for trip)
- No activities focus
- Not asking for specific hotel name

**Example queries**:
- "where to stay in Tokyo"
- "best neighborhoods in Paris for a romantic trip"
- "areas to book hotel in Barcelona"
- "which part of London should I stay"

**Redirected queries** (specific hotels → areas):
- "best hotel in Rome" → "Here are the best AREAS to stay in Rome..."
- "recommend Airbnb Barcelona" → "Here are neighborhoods to search on Airbnb..."

## Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: CLASSIFY (Gemini 2.5 Flash)                      Cost: ~$0.001    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Input: "where to stay in Tokyo for a romantic trip"                        │
│  Output: {                                                                  │
│    scenario: "where-to-stay",                                               │
│    city: "Tokyo",                                                           │
│    tripType: "romantic",                                                    │
│    specificHotelRequest: false                                              │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: GENERATE STAY AREAS (Gemini 2.5 Pro + Grounding) Cost: ~$0.005    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Prompt: Generate 5 neighborhoods in Tokyo for accommodation...             │
│  Focus: proximity to attractions, safety, transport, character              │
│                                                                             │
│  Output: 5 StayArea objects with:                                           │
│  - name, center, radius                                                     │
│  - description emphasizing "stay" factors                                   │
│  - price tier indication                                                    │
│  - Airbnb + Booking.com search links                                        │
│  - 3 exploration suggestions for the area                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: RENDER (Mapbox)                                  Cost: $0.005     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  - Display map centered on city                                             │
│  - Draw 5 stay circles (different color than activity areas)                │
│  - Show info cards with booking links on click                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Output Schema

```typescript
interface StayArea {
  name: string;              // "Shibuya"
  center: [number, number];  // [139.7016, 35.6580]
  radius: number;            // meters
  
  description: string;       // Focus on why to STAY here
  priceTier: 'budget' | 'mid' | 'luxury';
  
  // KEY DIFFERENTIATOR: Booking platform links
  bookingLinks: {
    airbnb: string;          // Direct Airbnb search URL
    bookingCom: string;      // Direct Booking.com search URL
  };
  
  whyStayHere: string;       // "Central location, great transport, vibrant nightlife"
  
  // What to do NEAR your accommodation
  nearbyHighlights: Array<{
    text: string;            // "Morning coffee in Shibuya Stream"
    gmapsUrl: string;
    tiktokUrl: string;
  }>;
}
```

## Booking Platform URL Generation (FREE)

No API calls needed - we generate URLs directly:

```typescript
// Airbnb search URL
const getAirbnbSearchUrl = (area: string, city: string, checkIn?: string, checkOut?: string) => {
  const baseUrl = `https://www.airbnb.com/s/${encodeURIComponent(area + ' ' + city)}/homes`;
  const params = new URLSearchParams();
  if (checkIn) params.set('checkin', checkIn);
  if (checkOut) params.set('checkout', checkOut);
  return params.toString() ? `${baseUrl}?${params}` : baseUrl;
};

// Booking.com search URL  
const getBookingSearchUrl = (area: string, city: string, checkIn?: string, checkOut?: string) => {
  const params = new URLSearchParams({
    ss: `${area} ${city}`,
    ...(checkIn && { checkin: checkIn }),
    ...(checkOut && { checkout: checkOut })
  });
  return `https://www.booking.com/searchresults.html?${params}`;
};

// Examples:
getAirbnbSearchUrl('Shibuya', 'Tokyo');
// → "https://www.airbnb.com/s/Shibuya%20Tokyo/homes"

getBookingSearchUrl('El Born', 'Barcelona', '2024-03-15', '2024-03-18');
// → "https://www.booking.com/searchresults.html?ss=El+Born+Barcelona&checkin=2024-03-15&checkout=2024-03-18"
```

## Example Output

**Query**: "romantic trip Tokyo where to stay"

```json
{
  "areas": [
    {
      "name": "Shibuya",
      "center": [139.7016, 35.6580],
      "radius": 600,
      "description": "Iconic intersection, endless shopping, and vibrant energy. Perfect for couples who want to be in the heart of the action with easy access to trendy cafes and nightlife.",
      "priceTier": "mid",
      "bookingLinks": {
        "airbnb": "https://www.airbnb.com/s/Shibuya%20Tokyo/homes",
        "bookingCom": "https://www.booking.com/searchresults.html?ss=Shibuya+Tokyo"
      },
      "whyStayHere": "Central hub with best transport connections, walking distance to Harajuku and Omotesando",
      "nearbyHighlights": [
        {
          "text": "sunset drinks at Shibuya Sky",
          "gmapsUrl": "https://www.google.com/maps/search/Shibuya+Sky",
          "tiktokUrl": "https://www.tiktok.com/search?q=shibuya+sky+sunset"
        },
        {
          "text": "romantic dinner in Ebisu",
          "gmapsUrl": "https://www.google.com/maps/search/romantic+dinner+Ebisu+Tokyo",
          "tiktokUrl": "https://www.tiktok.com/search?q=ebisu+romantic+dinner"
        },
        {
          "text": "morning walk in Yoyogi Park",
          "gmapsUrl": "https://www.google.com/maps/search/Yoyogi+Park",
          "tiktokUrl": "https://www.tiktok.com/search?q=yoyogi+park+morning"
        }
      ]
    }
    // ... 4 more areas
  ]
}
```

## UI Components

### Info Card (on area click)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shibuya                                                     💰 Mid-range  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Iconic intersection, endless shopping, and vibrant energy. Perfect for    │
│  couples who want to be in the heart of the action.                        │
│                                                                             │
│  🏨 Why Stay Here: Central hub with best transport connections, walking    │
│     distance to Harajuku and Omotesando                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Search Accommodations                                           │   │
│  │  ┌───────────────────────┐  ┌───────────────────────┐               │   │
│  │  │ 🏠 Search Airbnb      │  │ 🏨 Search Booking.com │               │   │
│  │  └───────────────────────┘  └───────────────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📍 Things to Do Nearby:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ sunset drinks at Shibuya Sky            [GMaps] [TikTok]            │   │
│  │ romantic dinner in Ebisu                [GMaps] [TikTok]            │   │
│  │ morning walk in Yoyogi Park             [GMaps] [TikTok]            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Rentals & Houses for Sale → Leo.casa

When users ask about long-term rentals or property purchases, redirect to Leo.casa:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER: "I'm looking for an apartment to rent in Barcelona"                  │
│                                                                             │
│  AGENT: "For long-term rentals and property purchases, I can help you      │
│          through our housing service Leo.casa! 🏠                          │
│                                                                             │
│          Leo.casa specializes in:                                          │
│          • Long-term apartment rentals                                     │
│          • Houses and apartments for sale                                  │
│          • AI-powered property analysis                                    │
│                                                                             │
│          [🏠 Go to Leo.casa →]                                             │
│                                                                             │
│          For short-term travel stays, I can recommend neighborhoods        │
│          with Airbnb and Booking.com links instead!"                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detection Keywords

```typescript
const isRentalOrPurchaseQuery = (query: string): boolean => {
  const keywords = [
    'rent', 'rental', 'lease', 'long-term',
    'buy', 'purchase', 'for sale', 'property',
    'apartment to rent', 'house to buy',
    'moving to', 'relocating'
  ];
  return keywords.some(kw => query.toLowerCase().includes(kw));
};
```

## Cost Breakdown

| Step | Service | Cost |
|------|---------|------|
| Query Classification | Gemini 2.5 Flash | ~$0.001 |
| Area Generation | Gemini 2.5 Pro + Grounding | ~$0.005 |
| Map Display | Mapbox Maps GL | $0.005 |
| Booking URLs | Generated locally | FREE |
| **Total** | | **~$0.011** |

## Differences from "Things to Do"

| Aspect | Things to Do | Where to Stay |
|--------|--------------|---------------|
| Focus | Activities, vibes | Accommodation logistics |
| Card links | GMaps + TikTok | **Airbnb + Booking.com** + GMaps |
| Price info | Not included | Price tier shown |
| Area selection | Best for activity type | Best for traveler needs |
| Suggestions | Activities to do | Things to do NEAR where you stay |

## Edge Cases

| Case | Handling |
|------|----------|
| "Best hotel?" | Redirect to areas: "I'll show you the best AREAS..." |
| Specific hotel name | "I can show you the neighborhood around [Hotel], but for booking..." |
| Budget constraints | Filter areas by price tier, emphasize budget options |
| Long-term rental | Redirect to Leo.casa |
| "Safest area" | Prioritize safety in area rankings |

## Chrome Extension Integration

When user clicks Airbnb/Booking.com link from a stay area card:
1. Opens booking platform in new tab
2. If Chrome extension is installed and authenticated:
   - Extension detects the platform page
   - Fetches all stay areas from user's active chat
   - Overlays vibe circles on the booking platform's map
   - User can visually see recommended areas while browsing listings

See [Chrome Extension](../architecture/CHROME-EXTENSION.md) for full integration details.

---

[← Things to Do](01-THINGS-TO-DO.md) | [Back to Index](../AGENTIC_MAPS.md) | [Stay + Do →](03-STAY-AND-DO.md)
