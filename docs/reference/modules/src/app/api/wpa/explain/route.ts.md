# src/app/api/wpa/explain/route.ts

[Source](../../../../../../../../src/app/api/wpa/explain/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `UserFitProfile` | interface | [L31](../../../../../../../../src/app/api/wpa/explain/route.ts#L31) |  |
| `FitScoreResult` | interface | [L55](../../../../../../../../src/app/api/wpa/explain/route.ts#L55) |  |
| `PersonalizedExplanation` | interface | [L63](../../../../../../../../src/app/api/wpa/explain/route.ts#L63) |  |
| `getDocClient` | function | [L101](../../../../../../../../src/app/api/wpa/explain/route.ts#L101) |  |
| `getCachedExplanation` | function | [L121](../../../../../../../../src/app/api/wpa/explain/route.ts#L121) | listingId, userId |
| `cacheExplanation` | function | [L147](../../../../../../../../src/app/api/wpa/explain/route.ts#L147) | explanation |
| `categorizeWeight` | function | [L202](../../../../../../../../src/app/api/wpa/explain/route.ts#L202) | weight |
| `generateExplanation` | function | [L208](../../../../../../../../src/app/api/wpa/explain/route.ts#L208) | listingId, userId, scores, profile, fitResult |
| `POST` | function | [L333](../../../../../../../../src/app/api/wpa/explain/route.ts#L333) | request |
| `GET` | function | [L410](../../../../../../../../src/app/api/wpa/explain/route.ts#L410) | request |

Imports: `next/server`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`, `../score/route`
