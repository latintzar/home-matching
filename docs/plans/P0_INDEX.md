# P0 Lean App - Documentation Index

> **Single Source of Truth** for the Leo.casa P0 MVP build.
> This is a **complete, working app** — not a prototype.

---

## Quick Reference

| Metric | Value |
|--------|-------|
| **Total Setup Cost** | ~$72 |
| **Per-User Cost** | ~$0.15-0.32 |
| **Break-Even** | 5 users @ €10/mo |
| **MVP Model** | Turf.js (FREE) → Geoapify upgrade later |

---

## Documentation Structure

### Core Architecture (Modular - Updated Dec 2024)

| Document | Contents |
|----------|----------|
| [**P0-01-OVERVIEW**](./P0-01-OVERVIEW.md) | Quick reference, costs, break-even, what to deprecate |
| [**P0-02-WPA-PIPELINE**](./P0-02-WPA-PIPELINE.md) | 2-step WPA (describe→score), 35 dimensions, caching |
| [**P0-03-RECOMMENDER**](./P0-03-RECOMMENDER.md) | Fit scoring V2, pre-WPA filtering, threshold flow |
| [**P0-04-LOCATION-SCORING**](./P0-04-LOCATION-SCORING.md) | Three-layer heatmap, Turf.js commute zones, graduated penalties |
| [**P0-05-ELEVENLABS-AGENTS**](./P0-05-ELEVENLABS-AGENTS.md) | Tools, state machine, prompts, during-call flow |
| [**P0-06-UI-COMPONENTS**](./P0-06-UI-COMPONENTS.md) | Live map, vibe-check, property carousel, mobile/desktop |
| [**P0-07-DATABASE**](./P0-07-DATABASE.md) | Supabase schema, DynamoDB tables, migrations |
| [**P0-08-TASKS**](./P0-08-TASKS.md) | Implementation checklist, phased build order |

### Feature Specs (Complete - Dec 2024)

| Document | Contents |
|----------|----------|
| [**P0-09-BILLING-STRIPE**](./P0-09-BILLING-STRIPE.md) | Stripe integration, products, webhooks, billing UI |
| [**P0-10-NOTES-SYSTEM**](./P0-10-NOTES-SYSTEM.md) | WhatsApp-style notes, signal extraction, Leo's "two cents" |
| [**P0-11-USER-TYPES-FLOWS**](./P0-11-USER-TYPES-FLOWS.md) | 4 user types, linked profiles, Pro flow, routes |
| [**P0-12-AUTH-TESTING**](./P0-12-AUTH-TESTING.md) | Test auth system, test users, environment variables |
| [**P0-13-CORE-TASKS**](./P0-13-CORE-TASKS.md) | Tasks 1,4,5,6,7 detailed specs, ElevenLabs agents |
| [**P0-14-HARVESTING**](./P0-14-HARVESTING.md) | Premium agency pipeline (8 agencies, ~73k listings), Nominatim geocoding |
| [**P0-15-LEGAL-COMPLIANCE**](./P0-15-LEGAL-COMPLIANCE.md) | GDPR, privacy policy, email preferences, terms, business address |
| [**P0-16-EMAIL-TEMPLATES**](./P0-16-EMAIL-TEMPLATES.md) | All transactional emails, templates, triggers, orchestration |
| [**P0-17-TRIAL-PAYWALL**](./P0-17-TRIAL-PAYWALL.md) | 1-week trial, paywall UI, weekly billing, conversion flow |
| [**P0-18-LANDING-PAGE**](./P0-18-LANDING-PAGE.md) | Landing page features, map comparison visual, value prop |
| [**P0-19-GEO-DATA-PIPELINE**](./P0-19-GEO-DATA-PIPELINE.md) | ✅ Spain geo data: **741k records** (census, OSM POIs, AllThePlaces, barrios) |
| [**P0-20-ELEVENLABS-REALTIME-ARCHITECTURE**](./P0-20-ELEVENLABS-REALTIME-ARCHITECTURE.md) | Real-time conversation + heatmap flow, WebSocket events, state management |
| [**P0-21-MIS-PROPIEDADES**](./P0-21-MIS-PROPIEDADES.md) | User dashboard, property grid, fit scores, notes panel, liked segregation |

### Reference Documentation

| Document | Purpose |
|----------|---------|
| [HEATMAP_LOCATION_SCORING.md](../HEATMAP_LOCATION_SCORING.md) | Full heatmap algorithm (definitive) |
| [DATA_SOURCES_ARCHITECTURE.md](../DATA_SOURCES_ARCHITECTURE.md) | All data sources and how they combine |
| [LOCATION_SCORING_LOGIC.md](../LOCATION_SCORING_LOGIC.md) | Decision logic for data source selection |
| [ULTIMATE_PIPELINE.md](../archive/ULTIMATE_PIPELINE.md) | Data pipeline and AI models |

---

## Quick Navigation: What Lives Where

| Topic | Document |
|-------|----------|
| **Recommender architecture** | P0-01 through P0-08 |
| **Location scoring (Turf.js)** | P0-04-LOCATION-SCORING |
| **WPA pipeline** | P0-02-WPA-PIPELINE |
| **Fit scoring algorithm** | P0-03-RECOMMENDER |
| **ElevenLabs tools** | P0-05-ELEVENLABS-AGENTS |
| **Stripe/billing** | P0-09-BILLING-STRIPE |
| **Notes system (WhatsApp-style)** | P0-10-NOTES-SYSTEM |
| **User types & flows** | P0-11-USER-TYPES-FLOWS |
| **Auth & testing** | P0-12-AUTH-TESTING |
| **Core tasks (1,4,5,6,7)** | P0-13-CORE-TASKS |
| **Pro/Agent flow** | P0-11-USER-TYPES-FLOWS |
| **Environment variables** | P0-12-AUTH-TESTING |
| **Error handling** | P0-12-AUTH-TESTING |
| **GDPR/Legal compliance** | P0-15-LEGAL-COMPLIANCE |
| **Privacy policy** | P0-15-LEGAL-COMPLIANCE |
| **Email preferences** | P0-15-LEGAL-COMPLIANCE |
| **Transactional emails** | P0-16-EMAIL-TEMPLATES |
| **Email templates** | P0-16-EMAIL-TEMPLATES |
| **Cron jobs (email)** | P0-16-EMAIL-TEMPLATES |
| **Free trial** | P0-17-TRIAL-PAYWALL |
| **Paywall / subscription** | P0-17-TRIAL-PAYWALL |
| **Weekly billing** | P0-17-TRIAL-PAYWALL |
| **Landing page** | P0-18-LANDING-PAGE |
| **Map comparison visual** | P0-18-LANDING-PAGE |
| **Census sections / INE income** | P0-19-GEO-DATA-PIPELINE |
| **OSM boundaries / POIs** | P0-19-GEO-DATA-PIPELINE |
| **AllThePlaces import** | P0-19-GEO-DATA-PIPELINE |
| **Spatial aggregation** | P0-19-GEO-DATA-PIPELINE |
| **ElevenLabs real-time flow** | P0-20-ELEVENLABS-REALTIME-ARCHITECTURE |
| **WebSocket map updates** | P0-20-ELEVENLABS-REALTIME-ARCHITECTURE |
| **Conversation + heatmap state** | P0-20-ELEVENLABS-REALTIME-ARCHITECTURE |
| **Mis Propiedades (user dashboard)** | P0-21-MIS-PROPIEDADES |
| **Property grid view (user-facing)** | P0-21-MIS-PROPIEDADES |
| **Fit Score display** | P0-21-MIS-PROPIEDADES |
| **Notes in property details** | P0-10 + P0-21 |
| **Liked/favorites segregation** | P0-21-MIS-PROPIEDADES |

---

## Key Architecture Decisions (Summary)

### 1. NO Hard Boundaries — City-Wide Heatmap

The heatmap covers the **entire city**. There is no geographic exclusion.

- Commute distance → **graduated penalty** (30 min = 0, 60 min = -40, 90 min = -70)
- Far listings CAN surface if they score high on everything else
- All listings in the city get scored — best ones rise to top

### 2. Turf.js for Commute Zones (FREE MVP)

**Not using Geoapify isochrones for MVP.** Instead: Turf.js radial circles.

| Approach | Cost | Accuracy |
|----------|------|----------|
| Turf.js radial circles | **FREE** | ~70% |
| Geoapify isochrones | ~$0.01/anchor | ~95% |

**Why this works for Spain:**
- Regular city layouts (unlike London's choppy transit)
- Multi-modal culture: mopeds, bikes common — covers transit gaps
- Fine for graduated penalties, upgrade later with revenue

### 3. Three-Layer Scoring System

```
FINAL_SCORE = (POI_SCORE × NEIGHBORHOOD_MULTIPLIER) + COMMUTE_PENALTY
```

| Layer | What | Cost |
|-------|------|------|
| **Layer 1: Commute Penalty** | Graduated, NOT hard boundary | FREE |
| **Layer 2: Neighborhood Multiplier** | SERP research, INE income, Airbnb vibe | FREE (pre-computed) |
| **Layer 3: POI Heatmap** | OSM + AllThePlaces + ScrapingDog | Mostly FREE |

### 4. No Early Confrontation

- **During call**: Gather ALL preferences, no negotiations
- **Day 3**: If low inventory, soften POI criteria first
- **Week 2-3**: LAST RESORT — ask about commute flexibility

---

## Cost Summary

### Per-User Costs

| Step | Service | Cost |
|------|---------|------|
| Commute zone generation | Turf.js | **FREE** |
| POI searches (if quality-specific) | ScrapingDog | ~$0.02 |
| Vibe-check WPA (3 listings) | Flash-Lite | ~$0.009 |
| Full WPA (top listings) | Flash-Lite | ~$0.003/listing |
| Explanations | Flash-Lite | ~$0.001/listing |
| **Total per intake** | | **~$0.05-0.15** |

### Pre-Computed (One-Time) — ✅ DONE

| Task | Records | Cost |
|------|---------|------|
| Census sections + INE income | 36,308 | ~$0.05 |
| OSM POIs (parks, metro, etc.) | 595,191 | ~$0.75 |
| AllThePlaces (cafes, gyms, etc.) | 92,375 | ~$0.12 |
| Neighborhood boundaries (barrios) | 17,594 | ~$0.02 |
| **TOTAL GEO DATA** | **741,468** | **~$0.94** |
| Airbnb H3 heatmap | TBD | ~$50 |
| Hood SERP research | Per hood | ~$0.10/hood |

---

## Implementation Status

### ✅ Done
- `leo-neighborhood-boundaries` DynamoDB table created
- Neighborhood boundaries imported via Overpass API
- `spain-datasets` repo cloned (census sections + income data)
- Spatial aggregation script created
- All modular documentation complete (P0-01 through P0-13)
- **[P0-19-GEO-DATA-PIPELINE](./P0-19-GEO-DATA-PIPELINE.md):** ✅ COMPLETE — All Spain geo data loaded!
  - `leo-census-sections`: 36,308 census sections with INE income data
  - `leo-osm-pois`: 595,191 POIs (parks, metro, beaches, schools, etc.)
  - `leo-atp-pois`: 92,375 AllThePlaces POIs (cafes, restaurants, gyms, etc.)
  - `leo-neighborhood-boundaries`: 17,594 barrios for SERP lifestyle matching
  - **Total: 741,468 geospatial records for all of Spain (~$0.94 cost)**
  - ✅ **SERP data matched:** 78/86 neighborhood profiles (91%) linked to barrios with 20 lifestyle dimensions

### ⏳ Pending — Heatmap Code (P0-04)

| # | Component | Est. | Description |
|---|-----------|------|-------------|
| 1 | Geoapify geocoder | 30m | `src/lib/geo/geoapify.ts` — address → coords (3k/day free) |
| 2 | Turf.js commute zones | 30m | Radial circles for anchor points |
| 3 | DynamoDB spatial queries | 1h | Point-in-polygon, geohash POI lookup |
| 4 | Scoring functions | 1h | `calculateCommutePenalty`, `calculateNeighborhoodMultiplier`, `calculatePOIScore` |
| 5 | Combined heatmap API | 1h | `/api/recommender/calculate-heatmap` |
| 6 | Mapbox component | 2h | Render polygons, circles, gradient overlay |

### ⏳ Pending — Other

- Create `leo-airbnb-heatmap` table
- **Legal:** Create `/privacy` page with policy content
- **Legal:** Create `/terms` page with ToS content
- **Legal:** Add email preferences to Settings dashboard
- **Legal:** Get virtual office address for Spain

---

## Complete Document List

```
docs/plans/
├── P0_INDEX.md                    # This file - master index
├── P0-01-OVERVIEW.md              # Overview, costs, deprecation
├── P0-02-WPA-PIPELINE.md          # WPA 2-step process
├── P0-03-RECOMMENDER.md           # Fit scoring algorithm
├── P0-04-LOCATION-SCORING.md      # Turf.js, heatmap, penalties
├── P0-05-ELEVENLABS-AGENTS.md     # Voice agents, tools
├── P0-06-UI-COMPONENTS.md         # Maps, cards, mobile
├── P0-07-DATABASE.md              # Supabase + DynamoDB
├── P0-08-TASKS.md                 # Build order
├── P0-09-BILLING-STRIPE.md        # Stripe integration
├── P0-10-NOTES-SYSTEM.md          # WhatsApp-style notes
├── P0-11-USER-TYPES-FLOWS.md      # 4 user types, routes
├── P0-12-AUTH-TESTING.md          # Auth, env vars, testing
├── P0-13-CORE-TASKS.md            # Tasks 1,4,5,6,7 details
├── P0-14-HARVESTING.md            # Premium agency pipeline
├── P0-15-LEGAL-COMPLIANCE.md      # GDPR, privacy, email prefs, terms
├── P0-16-EMAIL-TEMPLATES.md       # Transactional emails, triggers, crons
├── P0-17-TRIAL-PAYWALL.md         # 1-week trial, paywall, weekly billing
├── P0-18-LANDING-PAGE.md          # Landing page, map comparison visual
├── P0-19-GEO-DATA-PIPELINE.md     # ✅ Census, OSM, AllThePlaces, barrios (741k records)
├── P0-20-ELEVENLABS-REALTIME-ARCHITECTURE.md  # Real-time conversation + heatmap flow
├── P0-21-MIS-PROPIEDADES.md       # User dashboard, property grid, fit scores, notes
├── P0_LEAN_APP.md                 # Redirect to this index
└── P0_LEAN_APP_FULL.md            # Archive - original 12k line doc
```

---

*Last Updated: December 8, 2025 — Added P0-21 Mis Propiedades user dashboard documentation*
