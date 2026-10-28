# src/app/api/cron/daily-recommendations/route.ts

[Source](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getSupabase` | function | [L41](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L41) |  |
| `ActiveUser` | interface | [L51](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L51) |  |
| `getActiveUsers` | function | [L61](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L61) |  |
| `storeRecommendations` | function | [L110](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L110) | userId, recommendations, runId |
| `queueNotification` | function | [L142](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L142) | userId, recommendations, prefs |
| `GET` | function | [L201](../../../../../../../../src/app/api/cron/daily-recommendations/route.ts#L201) | request |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/recommender/orchestratorV2`, `@/types/recommender`
