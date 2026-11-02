# src/app/api/wpa/score/route.ts

[Source](../../../../../../../../src/app/api/wpa/score/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getDocClient` | function | [L35](../../../../../../../../src/app/api/wpa/score/route.ts#L35) |  |
| `getCachedScores` | function | [L56](../../../../../../../../src/app/api/wpa/score/route.ts#L56) | listingId |
| `cacheScores` | function | [L76](../../../../../../../../src/app/api/wpa/score/route.ts#L76) | scores |
| `generateScores` | function | [L164](../../../../../../../../src/app/api/wpa/score/route.ts#L164) | listingId, description |
| `POST` | function | [L321](../../../../../../../../src/app/api/wpa/score/route.ts#L321) | request |
| `GET` | function | [L378](../../../../../../../../src/app/api/wpa/score/route.ts#L378) | request |

Imports: `next/server`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`, `../describe/route`, `@/lib/wpa/table-contracts`, `@/types/wpa-score`, `@/types/wpa-score`
