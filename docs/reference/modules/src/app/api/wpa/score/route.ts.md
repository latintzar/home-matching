# src/app/api/wpa/score/route.ts

[Source](../../../../../../../../src/app/api/wpa/score/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getDocClient` | function | [L34](../../../../../../../../src/app/api/wpa/score/route.ts#L34) |  |
| `getCachedScores` | function | [L54](../../../../../../../../src/app/api/wpa/score/route.ts#L54) | listingId |
| `cacheScores` | function | [L74](../../../../../../../../src/app/api/wpa/score/route.ts#L74) | scores |
| `generateScores` | function | [L162](../../../../../../../../src/app/api/wpa/score/route.ts#L162) | listingId, description |
| `POST` | function | [L319](../../../../../../../../src/app/api/wpa/score/route.ts#L319) | request |
| `GET` | function | [L376](../../../../../../../../src/app/api/wpa/score/route.ts#L376) | request |

Imports: `next/server`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`, `../describe/route`, `@/types/wpa-score`, `@/types/wpa-score`
