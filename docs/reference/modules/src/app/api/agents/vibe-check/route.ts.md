# src/app/api/agents/vibe-check/route.ts

[Source](../../../../../../../../src/app/api/agents/vibe-check/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `VibeCheckRequest` | interface | [L22](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L22) |  |
| `PropertyForCarousel` | interface | [L29](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L29) |  |
| `VibeCheckResponse` | interface | [L50](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L50) |  |
| `getSupabase` | function | [L61](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L61) |  |
| `loadUserProfile` | function | [L71](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L71) | userId |
| `runInstantWPA` | function | [L92](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L92) | listingId, photos, listingInfo |
| `generateVerbalSummary` | function | [L132](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L132) | properties |
| `pushToFrontend` | function | [L171](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L171) | userId, sessionId, properties |
| `POST` | function | [L204](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L204) | request |
| `PUT` | function | [L324](../../../../../../../../src/app/api/agents/vibe-check/route.ts#L324) | request |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/recommender/orchestratorV2`, `@/types/recommender`
