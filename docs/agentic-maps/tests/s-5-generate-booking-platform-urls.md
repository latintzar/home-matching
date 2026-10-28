---
test_id: "S.5"
name: "Generate booking platform URLs"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "None (URL construction)"
cost: "FREE"
implementation: null
last_tested: null
---

### Shared.5 - Generate booking platform URLs

| | |
|---|---|
| **Input** | Area name + city + optional dates |
| **Output** | Clickable Airbnb + Booking.com links |
| **API** | None (URL construction) |
| **Cost** | FREE |
| **Proves** | Accommodation search URLs are correct |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take area name, city, optional checkin/checkout dates | Input strings |
| 2 | Combine location | `"${areaName} ${city}"` |
| 3 | Build Airbnb base URL | `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes` |
| 4 | Add dates if provided | `?checkin=${checkin}&checkout=${checkout}` |
| 5 | Build Booking.com base URL | `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(location).replace(/%20/g, '+')}` |
| 6 | Add dates if provided | `&checkin=${checkin}&checkout=${checkout}` |
| 7 | Return both URLs | `{ airbnb: airbnbUrl, booking: bookingUrl }` |
| 8 | Render as branded buttons | Airbnb pink, Booking blue styling |

**📋 TEST INPUT (copy-paste):**
```
Shibuya | Tokyo | 2024-03-15 | 2024-03-18
```

**Expected output:**
```
Airbnb: https://www.airbnb.com/s/Shibuya%20Tokyo/homes?checkin=2024-03-15&checkout=2024-03-18
Booking: https://www.booking.com/searchresults.html?ss=Shibuya+Tokyo&checkin=2024-03-15&checkout=2024-03-18
```

---

## Implementation Priority

### Phase 1: Core Rendering (No APIs)
1. Shared.1 - Render circles ✅ (already works)
2. Shared.2 - Render info card ✅ (already works)
3. Shared.4 - Generate search URLs
4. Shared.5 - Generate booking URLs

### Phase 2: Area Generation
5. Test 1.1 - Generate vibe areas ✅ (prototype)
6. Test 1.2 - Generate itinerary (no coords)
7. Test 1.3 - Generate itinerary (with coords)
8. Test 2.1 - Stay areas with booking links

### Phase 3: Stay + Do
9. Test 3.1 - Dual-layer (2 stay + 3 activity)
10. Test 3.2 - Visual travel lines

### Phase 4: Geo Operations
11. Test 5.1 - Geocode locations
12. Test 5.2 - Generate isochrone (Mapbox)
13. Test 5.3 - Compute intersection (multi-polygon)
14. Test 5.4 - Identify neighborhoods
15. Test 5.5 - Multi-polygon fair zones

### Phase 5: Meet in Middle
16. Test 6.1 - Multi-modal isochrones
17. Test 6.2 - Interactive matrix with hover
18. Test 6.3 - AI picks best intersections
19. Test 6.4 - Get Directions handoff

### Phase 6: Place Verification
20. Test 4.1 - ScrapingDog Google Search
21. Test 4.2 - ScrapingDog GMaps details
22. Test 4.3 - ScrapingDog reviews
23. Test 4.4 - Curate with evocative language

### Phase 7: Multi-Stop Routes
24. Test 7.1 - City character analysis
25. Test 7.2 - Chat for preferences
26. Test 7.3 - Chat for logistics/constraints
27. Test 7.4 - Route matrix combinations
28. Test 7.5 - Insert stops for constraints
29. Test 7.6 - AI picks best option(s)
30. Test 7.7 - Two-stop Google Maps handoff
31. Test 7.8 - Multi-stop Google Maps handoff

---

## Test Count Summary

| Scenario | Tests | Status |
|----------|-------|--------|
| 1: Things to Do | 3 (1.1-1.3) | 1.1 ✅ |
| 2: Where to Stay | 2 (2.1-2.2) | - |
| 3: Stay + Do | 2 (3.1-3.2) | - |
| 4: Single Place | 4 (4.1-4.4) | - |
| 5: Meet in Middle | 5 (5.1-5.5) | - |
| 6: Areas Together | 4 (6.1-6.4) | - |
| 7: Multi-Stop | 8 (7.1-7.8) | - |
| Shared | 7 | 2 ✅ |
| **Total** | **35 tests** | |

---

## Next Steps

1. Build test selector UI in the chat panel
2. Implement each test with sample data
3. Verify API integrations one at a time
4. Chain blocks into full scenarios

---

*Last Updated: December 8, 2024*
