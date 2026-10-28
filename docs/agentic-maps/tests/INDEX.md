---
title: Building Block Tests Index
last_updated: 2025-12-08
total_tests: 35
---

# Building Block Tests Index

> Individual test documents split from BUILDING_BLOCKS.md for easier tracking and implementation.

## Quick Stats

| Status | Count |
|--------|-------|
| ✅ Implemented | 8 |
| 🟡 In Progress | 1 |
| ⬜ Not Started | 26 |
| **Total** | **35** |

---

## Scenario 1: Things to Do

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [1.1](./1-1-generate-vibe-areas-from-a-trip-description.md) | Generate vibe areas from a trip description | Gemini 2.5 Pro + Google Search grounding | ~$0.005 | ✅ |
| [1.2](./1-2-generate-itinerary-without-coordinates.md) | Generate itinerary WITHOUT coordinates | Gemini 2.5 Flash | ~$0.001 | ⬜ |
| [1.3](./1-3-generate-itinerary-with-coordinates.md) | Generate itinerary WITH coordinates | Gemini 2.5 Flash | ~$0.001 | ⬜ |

## Scenario 2: Where to Stay

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [2.1](./2-1-generate-stay-areas-with-booking-links.md) | Generate stay areas with booking links | Gemini 2.5 Pro + grounding | ~$0.005 | ✅ |
| [2.2](./2-2-generate-nearby-highlights-for-a-stay-area.md) | Generate nearby highlights for a stay area | Gemini 2.5 Flash | ~$0.001 | ⬜ |

## Scenario 3: Stay + Do

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [3.1](./3-1-generate-dual-layer-areas-stay-activity.md) | Generate dual-layer areas (stay + activity) | Gemini 2.5 Pro + grounding (single call) | ~$0.005 | ✅ |
| [3.2](./3-2-visual-travel-lines-between-areas.md) | Visual travel lines between areas | Turf.js (local, no API) | FREE | ⬜ |

## Scenario 4: Single Place

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [4.1](./4-1-search-google-for-place-candidates.md) | Search Google for place candidates | ScrapingDog Google Search | $0.001 | ⬜ |
| [4.2](./4-2-get-place-details-from-google-maps.md) | Get place details from Google Maps | ScrapingDog Google Maps | $0.001 | ⬜ |
| [4.3](./4-3-get-reviews-for-a-place.md) | Get reviews for a place | ScrapingDog Google Maps Reviews | $0.001 | ⬜ |
| [4.4](./4-4-curate-and-present-the-winner-with-evocative-language.md) | Curate and present the winner with evocative language | Gemini 2.5 Flash Lite | ~$0.0005 | ⬜ |

## Scenario 5: Meet in Middle

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [5.1](./5-1-geocode-location-descriptions-to-coordinates.md) | Geocode location descriptions to coordinates | Mapbox Geocoding | ~$0.001 | ⬜ |
| [5.2](./5-2-generate-isochrone-from-a-location-mapbox.md) | Generate isochrone from a location (Mapbox) | Mapbox Isochrone (cheaper than Geoapify) | ~$0.001 | ⬜ |
| [5.3](./5-3-compute-intersection-of-two-isochrones-handles-multi-polygon.md) | Compute intersection of two isochrones (handles multi-polygon) | Turf.js (FREE, local) | FREE | ⬜ |
| [5.4](./5-4-identify-neighborhoods-in-a-polygon.md) | Identify neighborhoods in a polygon | Gemini 2.5 Flash | ~$0.001 | ⬜ |
| [5.5](./5-5-multi-polygon-fair-zone-with-distinct-areas.md) | Multi-polygon fair zone with distinct areas | Mapbox Isochrone + Turf.js | ~$0.002 | ⬜ |

## Scenario 6: Areas to Explore Together

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [6.1](./6-1-generate-multi-modal-isochrones-for-one-person.md) | Generate multi-modal isochrones for one person | Geoapify Isoline (3 calls) | $0.015 | ⬜ |
| [6.2](./6-2-interactive-matrix-with-hover-to-show-intersections.md) | Interactive matrix with hover-to-show intersections | Turf.js (local) | FREE | ⬜ |
| [6.3](./6-3-ai-reasons-about-best-intersections-based-on-preferences.md) | AI reasons about best intersections based on preferences | Gemini 2.5 Flash | ~$0.001 | ⬜ |
| [6.4](./6-4-get-directions-for-active-area.md) | Get Directions for active area | None (URL construction) | FREE | ⬜ |

## Scenario 7: Multi-Stop Route

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [7.1](./7-1-city-character-analysis-areas-overview.md) | City character analysis (areas overview) | Gemini 2.5 Pro + grounding | ~$0.005 | 🟡 |
| [7.2](./7-2-chat-to-understand-user-preferences.md) | Chat to understand user preferences | Gemini 2.5 Flash (conversational) | ~$0.003 | ⬜ |
| [7.3](./7-3-chat-to-understand-logistics-constraints.md) | Chat to understand logistics & constraints | Gemini 2.5 Flash (conversational) | ~$0.003 | ⬜ |
| [7.4](./7-4-compute-route-combinations-with-matrix.md) | Compute route combinations with matrix | Mapbox Matrix + Directions | ~$0.02 | ⬜ |
| [7.5](./7-5-insert-stops-based-on-constraints.md) | Insert stops based on constraints | Gemini 2.5 Flash | ~$0.01 | ⬜ |
| [7.6](./7-6-ai-chooses-best-option-s-with-rationale.md) | AI chooses best option(s) with rationale | Gemini 2.5 Flash | ~$0.001 | ⬜ |
| 7.7 (`./7-7-two-stop-directions-with-google-maps-handoff.md`, historical reference) | Two-stop directions with Google Maps handoff | Mapbox Directions | ~$0.002 | ⬜ |
| 7.8 (`./7-8-multi-stop-directions-with-google-maps-handoff.md`, historical reference) | Multi-stop directions with Google Maps handoff | Mapbox Directions | ~$0.01 | ⬜ |

## Shared Building Blocks

| Test | Name | API | Cost | Status |
|------|------|-----|------|--------|
| [S.1](./s-1-render-vibe-circles-on-map.md) | Render vibe circles on map | Mapbox GL (already loaded) | Included in map load | ✅ |
| [S.2](./s-2-render-info-card-for-area.md) | Render info card for area | None (UI component) | FREE | ✅ |
| [S.3](./s-3-render-place-pin-on-map.md) | Render place pin on map | Mapbox GL | Included in map load | ⬜ |
| [S.4](./s-4-generate-gmaps-tiktok-search-urls.md) | Generate GMaps/TikTok search URLs | None (URL construction) | FREE | ✅ |
| [S.5](./s-5-generate-booking-platform-urls.md) | Generate booking platform URLs (with guests & budget filters) | None (URL construction) | FREE | ✅ |
| [S.6](./s-6-resolve-area-names-to-real-polygons-athena.md) | Resolve area names to real polygons (Athena) | AWS Athena + Daylight OSM | $0.01-0.05 | ⬜ |
| [S.7](./s-7-natural-language-poi-search.md) | Natural language POI search (worldwide) | iD Presets + Athena | $0.01-0.03 | ⬜ |

---

## Status Legend

- ⬜ Not Started
- 🟡 In Progress  
- ✅ Implemented
- ⚠️ Needs Fix

---

*Updated on 2025-12-08*
