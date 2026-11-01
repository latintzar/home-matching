# src/app/api/cron/daily-recommendations/route.ts

[Source](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getSupabase` | function | [L42](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L42) |  |
| `ActiveUser` | interface | [L52](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L52) |  |
| `getActiveUsers` | function | [L62](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L62) |  |
| `storeRecommendations` | function | [L111](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L111) | userId, recommendations, runId |
| `queueNotification` | function | [L143](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L143) | userId, recommendations, prefs |
| `GET` | function | [L202](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L202) | request |

Imports: `@/lib/security/configured-api`, `next/server`, `@supabase/supabase-js`, `@/lib/recommender/orchestratorV2`, `@/types/recommender`
