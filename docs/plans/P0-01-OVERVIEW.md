# P0-01: Overview & Quick Reference

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## What P0 Delivers

A **complete, working property recommendation app** with:

- Voice intake via ElevenLabs agents
- 35-dimension WPA (Whole Property Analysis)
- Algorithmic fit scoring (no LLM per-score)
- City-wide heatmap with graduated penalties
- Daily recommendation emails
- €10/month subscription via Stripe

---

## Total Investment: ~$72

| Phase | Cost | What |
|-------|------|------|
| **One-time setup** | $27 | Airbnb analysis, SERP research, initial harvest |
| **Month 1 fixed** | $45 | ScrapingDog ($40) + DynamoDB (~$5) |
| **Per user** | $0.15-0.32 | WPA, Psychologist, Explains |

### Break-even: 5 users @ €10/month

---

## Evolution Notice

This section defines the **NEW approach** to WPA, Fit Scoring, and Recommendations.
It **supersedes** all previous implementations:

| Component | OLD Location | NEW Approach |
|-----------|--------------|--------------|
| WPA | `src/app/api/listings/[id]/analysis/whole-property/` | **NEW**: 2-step (describe → score), 35 dimensions, cached in DynamoDB |
| Fit Scoring | Scattered/incomplete | **NEW**: Algorithmic 55-dimension scoring in `fitScoringV2.ts` |
| Recommendations | `src/lib/recommender/orchestrator.ts` | **EVOLVE**: Add pre-WPA scoring, WPA integration, threshold-based flow |
| Location Scoring | Geoapify isochrones | **NEW**: Turf.js radial circles (FREE), graduated penalties |
| Neighborhood | Social Radar only | **NEW**: 20-dimension SERP research + H3 geo-matching |

### Key Changes

- WPA is **2 calls** (describe then score) instead of 1
- WPA uses **Gemini 2.5 Flash-Lite** (~$0.003/WPA)
- WPA has **35 dimensions** (was ~8)
- Fit scoring is **algorithmic** (no LLM)
- Recommendations are **threshold-based** (not just ranked)
- All WPA is **cached in DynamoDB** (shared across users)
- Location scoring uses **Turf.js** (FREE), not Geoapify
- No hard boundaries — **graduated commute penalties**

---

## Code to Deprecate/Replace

```
DEPRECATE (old approach, keep for reference):
├── src/app/api/listings/[id]/analysis/whole-property/   # Old single-call WPA
├── src/lib/recommender/wpaShortlist.ts                  # Old WPA integration
├── src/lib/lifestyle/geoapify-engine.ts                 # Geoapify isochrones (upgrade path)
└── src/lib/intelligence/social-radar.ts                 # Replace with SERP data

EVOLVE (modify existing):
├── src/lib/recommender/orchestrator.ts                  # Add pre-WPA + threshold flow
├── src/lib/lifestyle/ai-profiler.ts                     # Output dimension weights
├── src/app/(app)/property/[id]/LeanPropertyContent.tsx  # Add PersonalizedMatch
└── src/app/(app)/speak-with-leo/SpeakWithLeoContent.tsx # Add carousel component

CREATE (new files):
├── src/app/api/wpa/*                                    # New 2-step WPA
├── src/lib/recommender/fitScoringV2.ts                  # Algorithmic scoring
├── src/lib/recommender/preWpaFitScore.ts                # Free pre-filtering
├── src/lib/recommender/commuteScoring.ts                # Turf.js penalties
├── src/lib/geo/neighborhoodMatcher.ts                   # H3 geo-matching
├── tool_configs/show_property.json                      # ElevenLabs tool
└── scripts/serp-research.ts                             # One-time SERP research
```

---

## Implementation Phases (Summary)

| Phase | Status | Est. Hours |
|-------|--------|------------|
| **Phase 1**: Foundation | ⏳ TODO | 11 hr |
| **Phase 2**: During-Call Features | ⏳ TODO | 14 hr |
| **Phase 3**: UI Components | ⏳ TODO | 20 hr |
| **Phase 4**: ElevenLabs Agent | ⏳ TODO | 12 hr |
| **Phase 5**: Batch Processing | ⏳ TODO | 16 hr |
| **Phase 6**: Monitoring | ⏳ TODO | 14 hr |
| **TOTAL** | | **~87 hr** |

See [P0-08-TASKS.md](./P0-08-TASKS.md) for detailed implementation checklist.

---

## AI Operations Summary

| Operation | Model | Cost | What It Does |
|-----------|-------|------|--------------|
| **WPA** | Gemini 2.5 Flash-Lite | $0.003/listing | Visual analysis of 30 property photos |
| **AI Profiler** | Gemini 2.5 Pro | $0.30/profile | User lifestyle/preference inference |
| **Social Radar** | Gemini 2.5 Flash | $0.02/scan | Airbnb review analysis (noise, tourists) |
| **Cadastre** | Gov API | FREE | Official m², year built, building info |
| **ElevenLabs** | GPT-4o Mini + Multilingual v2 | $0.08/min | Voice conversation |
| **Explanations** | Flash-Lite | $0.001/listing | "Why this matches you" text |

---

## Cost Control Safeguards

| Safeguard | Status | Notes |
|-----------|--------|-------|
| WPA uses Gemini 2.5 Flash-Lite | ✅ Documented | ~$0.003/WPA, NOT Flash (~$0.03) or Pro (~$0.90) |
| No listing photo storage | ✅ Implemented | `rejectBase64Images()` in dynamodb.ts |
| Turf.js instead of Geoapify | ✅ Documented | FREE vs ~$0.01/isochrone |
| S3 image upload blocked | 📝 Documented | S3 bucket policy needed |
| ESLint base64 rules | 📝 Documented | Add to .eslintrc.js |

---

## External Service Dependencies

| Service | Purpose | Cost | Status |
|---------|---------|------|--------|
| **Turf.js** | Commute zone calculation | **FREE** | ✅ Use this |
| **ScrapingDog** | Quality POI searches | $30/mo for 50k | Required |
| **Mapbox** | Map display | $5/1k after 50k | Required |
| **Pusher/Realtime** | WebSocket | $49/mo | Required |
| **Resend** | Email delivery | $20/mo for 50k | Required |
| **ElevenLabs** | Voice AI agents | Usage-based | Required |
| **Gemini Flash-Lite** | WPA, explanations | ~$0.003/WPA | Required |
| ~~**Geoapify**~~ | ~~Isochrone generation~~ | ~~$49/mo~~ | Deferred (upgrade path) |

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-02-WPA-PIPELINE](./P0-02-WPA-PIPELINE.md) | WPA describe/score/explain flow |
| [P0-03-RECOMMENDER](./P0-03-RECOMMENDER.md) | Fit scoring algorithm |
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | Three-layer heatmap system |
| [HEATMAP_LOCATION_SCORING.md](../HEATMAP_LOCATION_SCORING.md) | Full algorithm reference |

---

*Last Updated: December 2024*

