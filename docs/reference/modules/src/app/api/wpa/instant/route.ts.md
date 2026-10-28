# src/app/api/wpa/instant/route.ts

[Source](../../../../../../../../src/app/api/wpa/instant/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `InstantWPAResult` | interface | [L27](../../../../../../../../src/app/api/wpa/instant/route.ts#L27) |  |
| `getDocClient` | function | [L58](../../../../../../../../src/app/api/wpa/instant/route.ts#L58) |  |
| `getCachedInstantWPA` | function | [L78](../../../../../../../../src/app/api/wpa/instant/route.ts#L78) | listingId |
| `cacheInstantWPA` | function | [L98](../../../../../../../../src/app/api/wpa/instant/route.ts#L98) | result |
| `fetchImageAsBase64` | function | [L115](../../../../../../../../src/app/api/wpa/instant/route.ts#L115) | url |
| `selectHeroPhotos` | function | [L146](../../../../../../../../src/app/api/wpa/instant/route.ts#L146) | urls, max |
| `generateInstantWPA` | function | [L189](../../../../../../../../src/app/api/wpa/instant/route.ts#L189) | listingId, imageUrls, context |
| `POST` | function | [L287](../../../../../../../../src/app/api/wpa/instant/route.ts#L287) | request |
| `GET` | function | [L344](../../../../../../../../src/app/api/wpa/instant/route.ts#L344) | request |

Imports: `next/server`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`
