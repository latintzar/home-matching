# src/app/api/wpa/describe/route.ts

[Source](../../../../../../../../src/app/api/wpa/describe/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `WPADescription` | interface | [L22](../../../../../../../../src/app/api/wpa/describe/route.ts#L22) |  |
| `getDocClient` | function | [L66](../../../../../../../../src/app/api/wpa/describe/route.ts#L66) |  |
| `getCachedDescription` | function | [L86](../../../../../../../../src/app/api/wpa/describe/route.ts#L86) | listingId |
| `cacheDescription` | function | [L106](../../../../../../../../src/app/api/wpa/describe/route.ts#L106) | description |
| `fetchImageAsBase64` | function | [L124](../../../../../../../../src/app/api/wpa/describe/route.ts#L124) | url |
| `generateDescription` | function | [L207](../../../../../../../../src/app/api/wpa/describe/route.ts#L207) | listingId, imageUrls, context |
| `POST` | function | [L335](../../../../../../../../src/app/api/wpa/describe/route.ts#L335) | request |
| `GET` | function | [L392](../../../../../../../../src/app/api/wpa/describe/route.ts#L392) | request |

Imports: `next/server`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`
