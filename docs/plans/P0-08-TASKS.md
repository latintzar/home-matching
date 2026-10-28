# P0-08: Implementation Tasks — Checklist & Phases

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Phase Summary

| Phase | Area | Est. Hours | Status |
|-------|------|------------|--------|
| **Phase 1** | Foundation | 11 hr | ⏳ TODO |
| **Phase 2** | During-Call Features | 14 hr | ⏳ TODO |
| **Phase 3** | UI Components | 20 hr | ⏳ TODO |
| **Phase 4** | ElevenLabs Agent | 12 hr | ⏳ TODO |
| **Phase 5** | Batch Processing | 16 hr | ⏳ TODO |
| **Phase 6** | Monitoring | 14 hr | ⏳ TODO |
| **TOTAL** | | **~87 hr** | |

---

## Phase 1: Foundation (Week 1)

**Can test:** Profile storage, commute zone generation, heatmap calculation

```
□ 1.1 Supabase migration (2 hr)
      - Add dimension_weights, anchors, poi_preferences columns
      - Run migration 079_recommender_v3_schema.sql
      - Verify schema

□ 1.2 Update update_profile tool (2 hr)
      - Accept dimension_weights, poi_preferences, anchors
      - Store in Supabase

□ 1.3 Commute zone generation route (3 hr)
      - POST /api/recommender/generate-commute-zones
      - Use Turf.js radial circles (NOT Geoapify)
      - Return GeoJSON for map display

□ 1.4 Heatmap calculation route (4 hr)
      - POST /api/recommender/calculate-heatmap
      - 3-layer formula: POI × neighborhood × commute penalty
      - Return heatmap GeoJSON (score per grid point)

TEST: Manual API calls to verify commute zones + heatmap calculation work
```

---

## Phase 2: During-Call Features (Week 2)

**Can test:** Vibe-check flow, POI searches

```
□ 2.1 WPA Quick (no clusters) (4 hr)
      - src/lib/wpa/wpaQuick.ts
      - Single Gemini call, all photos
      - Return 35 dimension scores

□ 2.2 Trigger Early WPA route (2 hr)
      - POST /api/agents/trigger-early-wpa
      - Pick 3 diverse listings
      - Fire WPA in background, cache results

□ 2.3 POI Search route (2 hr)
      - POST /api/agents/poi-search
      - ScrapingDog for quality POIs
      - Return lat/lng + scores

□ 2.4 Vibe-check routes (3 hr)
      - POST /api/agents/vibe-check (push listing to UI)
      - POST /api/agents/record-calibration (store reaction)

□ 2.5 City familiarity routes (3 hr)
      - POST /api/agents/probe-familiarity
      - POST /api/agents/surface-tradeoff

TEST: Manual flow through vibe-check, verify WPA caching works
```

---

## Phase 3: UI Components (Week 2-3)

**Can test:** Map updates, vibe-check overlay, property cards

```
□ 3.1 LiveMap component (6 hr)
      - Mapbox single instance (never reloads)
      - Layer sources: commute-zones, neighborhoods, heatmap, pois
      - WebSocket integration for real-time updates

□ 3.2 Commute zone layer (2 hr)
      - CommuteZoneLayer.tsx
      - Render Turf.js circles with opacity gradients
      - Support multiple anchors

□ 3.3 Neighborhood layer (2 hr)
      - NeighborhoodLayer.tsx
      - Fill polygons colored by match score

□ 3.4 Heatmap layer (2 hr)
      - HeatmapLayer.tsx
      - Gradient circles from POI scores

□ 3.5 Vibe-check overlay (4 hr)
      - VibeCheckOverlay.tsx
      - PropertyCarousel.tsx
      - ReactionButtons.tsx

□ 3.6 Property cards (4 hr)
      - PropertyCard.tsx
      - FitScoreBar.tsx
      - PersonalizedMatch.tsx

TEST: Full visual flow - map builds during simulated call, vibe-check works
```

---

## Phase 4: ElevenLabs Agent (Week 3)

**Can test:** End-to-end agent call with all tools

```
□ 4.1 Tool configurations (4 hr)
      - add_anchor.json
      - show_property.json
      - probe_city_familiarity.json
      - surface_tradeoff.json
      - generate_commute_zones.json

□ 4.2 Agent prompts (4 hr)
      - Update Leo-Intake-Renter with new tools
      - Update Leo-Intake-Buyer with new tools
      - Add local wisdom instructions

□ 4.3 ElevenLabs CLI integration (2 hr)
      - Push tools to ElevenLabs
      - Attach tools to agents
      - Test end-to-end

□ 4.4 WebSocket event handlers (2 hr)
      - Map update events
      - Vibe-check trigger events
      - Error handling

TEST: Complete intake call with real agent, verify all tools fire correctly
```

---

## Phase 5: Batch Processing (Week 3-4)

**Can test:** Daily recommendations, email delivery

```
□ 5.1 Pre-WPA scoring (4 hr)
      - src/lib/recommender/preWpaFitScore.ts
      - FREE algorithmic scoring
      - Filter to top 100

□ 5.2 Full fit scoring (4 hr)
      - src/lib/recommender/fitScoringV2.ts
      - Combine WPA + location + basics
      - Threshold filtering

□ 5.3 Batch processing cron (4 hr)
      - POST /api/cron/daily-recommendations
      - Run 3x daily
      - WPA only on cache misses

□ 5.4 Email templates (4 hr)
      - new-recommendations.tsx
      - stock-insufficient.tsx
      - listing-alert.tsx

TEST: Run batch on test users, verify emails sent with correct content
```

---

## Phase 6: Monitoring & Polish (Week 4)

**Can test:** Full user lifecycle over 1 week

```
□ 6.1 Day 3 check cron (3 hr)
      - POST /api/cron/stock-check
      - Count listings above threshold
      - Trigger POI softening prompts if low

□ 6.2 Weekly monitoring cron (3 hr)
      - Check for new high-fit listings
      - Check for saved listings gone off-market
      - Send proactive notifications

□ 6.3 Follow-up adaptation (4 hr)
      - POI softening lever (day 3)
      - Commute extension lever (week 2-3, last resort)

□ 6.4 Production hardening (4 hr)
      - Error handling
      - Logging
      - Monitoring dashboard

TEST: Full user lifecycle over 1 week
```

---

## API Routes Checklist

### Recommender APIs (New)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/recommender/generate-commute-zones` | POST | Turf.js radial circles | ⏳ |
| `/api/recommender/calculate-penalties` | POST | Graduated commute scoring | ⏳ |
| `/api/recommender/search-pois` | POST | ScrapingDog + AllThePlaces | ⏳ |
| `/api/recommender/score-pois` | POST | Flash-Lite user fit scoring | ⏳ |
| `/api/recommender/score-neighborhoods` | POST | Calculate hood multipliers | ⏳ |
| `/api/recommender/calculate-heatmap` | POST | Combined 3-layer formula | ⏳ |
| `/api/recommender/listings-in-heatmap` | POST | Filter by threshold | ⏳ |

### Agent APIs (New)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/agents/add-anchor` | POST | Add commute anchor | ⏳ |
| `/api/agents/probe-familiarity` | POST | Record city familiarity | ⏳ |
| `/api/agents/surface-tradeoff` | POST | Show local wisdom | ⏳ |
| `/api/agents/vibe-check` | POST | Show property carousel | ✅ Exists |
| `/api/agents/record-calibration` | POST | Store vibe-check reaction | ⏳ |

### WPA APIs (New)

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/wpa/describe` | POST | Photos → prose | ⏳ |
| `/api/wpa/score` | POST | Prose → 35 dimensions | ⏳ |
| `/api/wpa/explain` | POST | Personalized explanation | ⏳ |
| `/api/wpa/instant` | POST | Quick WPA for vibe-check | ⏳ |

### Cron APIs

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/cron/daily-recommendations` | POST | 3x daily batch | ⏳ |
| `/api/cron/stock-check` | POST | Day 3 + weekly checks | ⏳ |

---

## ElevenLabs Tools Checklist

| Tool | Purpose | Status |
|------|---------|--------|
| `detect_city` | Zoom map to city | ⏳ |
| `add_anchor` | Generate commute zones | ⏳ |
| `update_profile` | Save preferences | ✅ Exists |
| `check_availability` | Count matching listings | ✅ Exists |
| `show_property` | Vibe-check carousel | ⏳ |
| `record_calibration` | Store reaction | ⏳ |
| `probe_city_familiarity` | Record city knowledge | ⏳ |
| `surface_tradeoff` | Show local wisdom | ⏳ |

---

## DynamoDB Tables Checklist

| Table | Purpose | Status |
|-------|---------|--------|
| `leo-listings` | Harvested properties | ✅ Exists |
| `leo-wpa-cache` | WPA results | ✅ Exists |
| `leo-neighborhood-boundaries` | Hood polygons | ✅ Created |
| `leo-neighborhood-profiles` | 20+ dimensions | ✅ Exists |
| `leo-osm-pois` | Parks, metro, beaches | ⏳ TODO |
| `leo-atp-pois` | AllThePlaces density | ⏳ TODO |
| `leo-airbnb-heatmap` | Vibe perception | ⏳ TODO |

---

## UI Components Checklist

| Component | Purpose | Status |
|-----------|---------|--------|
| `LiveMap.tsx` | Single Mapbox instance | ⏳ |
| `CommuteZoneLayer.tsx` | Turf.js circles | ⏳ |
| `NeighborhoodLayer.tsx` | Fill polygons | ⏳ |
| `HeatmapLayer.tsx` | Gradient circles | ⏳ |
| `POIMarkers.tsx` | POI icons | ⏳ |
| `VibeCheckOverlay.tsx` | Property carousel | ⏳ |
| `PropertyCarousel.tsx` | Swipeable photos | ✅ Exists |
| `PropertyCard.tsx` | Listing card | ⏳ |
| `FitScoreBar.tsx` | Score visualization | ⏳ |
| `PersonalizedMatch.tsx` | "Why this matches" | ⏳ |

---

## Migrations Checklist

| Migration | Purpose | Status |
|-----------|---------|--------|
| 075_linked_profiles.sql | Profile switching | ⏳ TODO |
| 079_recommender_v3_schema.sql | New columns | ⏳ TODO |

---

## External Dependencies

| Service | Purpose | API Key Env Var | Status |
|---------|---------|-----------------|--------|
| Turf.js | Commute zones | N/A (NPM package) | ✅ FREE |
| ScrapingDog | Quality POIs | `SCRAPINGDOG_API_KEY` | ✅ Have |
| Mapbox | Map display | `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Have |
| ElevenLabs | Voice agents | `ELEVENLABS_API_KEY` | ✅ Have |
| Gemini Flash-Lite | WPA, explains | `GOOGLE_API_KEY` | ✅ Have |
| ~~Geoapify~~ | ~~Isochrones~~ | ~~`GEOAPIFY_API_KEY`~~ | ⏸️ Deferred |

---

## Test Gates

Before moving to next phase, verify:

### Phase 1 → Phase 2
- [ ] Can store dimension_weights in Supabase
- [ ] generate-commute-zones returns valid GeoJSON
- [ ] calculate-heatmap produces sensible scores

### Phase 2 → Phase 3
- [ ] WPA Quick returns 35 scores
- [ ] WPA cache hits work
- [ ] Vibe-check endpoints respond correctly

### Phase 3 → Phase 4
- [ ] Map renders and updates via WebSocket
- [ ] Vibe-check overlay shows properties
- [ ] Property cards display fit scores

### Phase 4 → Phase 5
- [ ] Agent can call all tools
- [ ] Tools trigger correct UI updates
- [ ] End-to-end call works

### Phase 5 → Phase 6
- [ ] Batch processing runs without errors
- [ ] Emails are sent with correct content
- [ ] Cache sharing works across users

### Phase 6 → Done
- [ ] Day 3 check fires correctly
- [ ] Weekly monitoring works
- [ ] Full user lifecycle passes

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0 Index](./P0_INDEX.md) | Master index |
| [P0-07-DATABASE](./P0-07-DATABASE.md) | Schema details |

---

*Last Updated: December 2024*

