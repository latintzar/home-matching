---
test_id: "2.1"
name: "Generate stay areas with booking links"
scenario: 2
scenario_name: "Scenario 2: Where to Stay"
status: implementing
api: "Gemini 2.5 Pro + grounding"
cost: "~$0.005"
implementation: "/src/app/vibe-maps/page.tsx#generateStayAreas"
last_tested: null
depends_on:
  - "S.1 (Render circles)"
  - "S.2 (Render info card)"
  - "S.5 (Generate booking URLs)"
---

### Test 2.1 - Generate stay areas with booking links

| | |
|---|---|
| **Input** | City + trip type (e.g., "Tokyo romantic trip") |
| **Output** | 5 circles with price tier labels + Airbnb/Booking.com link buttons |
| **API** | Gemini 2.5 Pro + grounding |
| **Cost** | ~$0.005 |
| **Proves** | AI can distinguish "stay" neighborhoods and we can generate booking URLs |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take user query string | Input from text field |
| 2 | Send to Gemini 2.5 Pro with grounding | `POST` to Vertex AI with `tools: [{ googleSearch: {} }]` |
| 3 | Prompt: "For a {trip type} trip, recommend 5 neighborhoods to STAY in {city}. Return JSON with `name`, `lat`, `lng`, `priceTier` (1-3), `why`" | Structured output prompt |
| 4 | Parse JSON response | `JSON.parse()` |
| 5 | For each area, call Shared.5 to generate booking URLs | `generateBookingURLs(area.name, city, dates)` |
| 6 | Render circles with price tier badges (💰💰💰) | Pass to `renderVibeCircles(areas)` with `priceTier` overlay |

**📋 TEST INPUT (copy-paste):**
```
romantic trip to Tokyo
```

**Expected output:**
- Shibuya (💰💰 mid-range) + [Airbnb] [Booking.com]
- Shinjuku (💰💰💰 luxury) + [Airbnb] [Booking.com]
- Asakusa (💰 budget) + [Airbnb] [Booking.com]
- ...

---

## Implementation Details

### Files Modified

1. **`/src/lib/vibe-maps/bookingUrls.ts`** (NEW)
   - `generateBookingURLs({ areaName, city, checkin?, checkout? })` - Generates Airbnb and Booking.com search URLs
   - `getPriceTierDisplay(priceTier)` - Returns 💰, 💰💰, or 💰💰💰
   - `getPriceTierLabel(priceTier)` - Returns "budget", "mid-range", or "luxury"
   - `getPriceTierColor(priceTier)` - Returns color hex for price tier

2. **`/src/components/vibe-maps/types.ts`** (MODIFIED)
   - Added `priceTier?: 1 | 2 | 3` field to `VibeArea` interface
   - Added `areaType?: 'activity' | 'stay'` field to distinguish area types
   - Added `bookingUrls?: { airbnb: string; booking: string }` field

3. **`/src/app/vibe-maps/page.tsx`** (MODIFIED)
   - Added `generateStayAreas()` function with stay-focused prompt
   - Added `isStayQuery()` helper to detect stay-related queries
   - Modified `handleLandingSubmit()` to route to correct generator based on test ID or query

4. **`/src/components/vibe-maps/MapPanel.tsx`** (MODIFIED)
   - Added price tier badge display in info card
   - Added booking URL buttons (Airbnb/Booking.com) for stay areas
   - Changed icon from 📍 to 🏨 for stay areas
   - Changed "Suggested itinerary" to "Nearby highlights" for stay areas

### Prompt Design

The stay-focused prompt differs from the activity prompt by:
1. Asking for ACCOMMODATION neighborhoods (not activity neighborhoods)
2. Requesting price tier classification (1-3)
3. Asking for "nearby highlights" instead of "itinerary"
4. Considering safety, walkability, and hotel availability

### Color Scheme (Price Tiers)

| Tier | Label | Color | Example |
|------|-------|-------|---------|
| 1 | budget | `#22c55e` (green) | Hostels, budget hotels |
| 2 | mid-range | `#f59e0b` (amber) | 3-4 star hotels, nice Airbnbs |
| 3 | luxury | `#a855f7` (purple) | 5-star hotels, luxury apartments |

### Test Detection

The system automatically uses `generateStayAreas()` when:
1. Test ID is `2.1` (explicit test mode)
2. Query contains stay-related keywords: "stay", "hotel", "accommodation", "airbnb", "hostel", "where to stay", etc.

---

## Testing Checklist

- [ ] Test with "romantic trip to Tokyo" input
- [ ] Verify 5 areas are returned with valid coordinates
- [ ] Verify each area has a priceTier (1, 2, or 3)
- [ ] Verify price tier badges are displayed (💰, 💰💰, 💰💰💰)
- [ ] Verify Airbnb button opens correct URL
- [ ] Verify Booking.com button opens correct URL
- [ ] Verify circles are color-coded by price tier
- [ ] Verify "Nearby highlights" section shows for each area
- [ ] Verify grounding indicator shows when web-verified

---

## Known Limitations

1. **No date support yet**: Booking URLs don't include check-in/check-out dates
2. **No live availability**: URLs lead to search pages, not confirmed availability
3. **Price tier is AI-estimated**: Not based on real-time pricing data

---

*Last Updated: 2025-12-12*
