# src/lib/wpa/cache.ts

[Source](../../../../../../src/lib/wpa/cache.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `WpaMode` | type | [L32](../../../../../../src/lib/wpa/cache.ts#L32) |  |
| `WpaCacheEntry` | interface | [L34](../../../../../../src/lib/wpa/cache.ts#L34) |  |
| `WpaDescriptions` | interface | [L50](../../../../../../src/lib/wpa/cache.ts#L50) |  |
| `WpaScores` | interface | [L63](../../../../../../src/lib/wpa/cache.ts#L63) |  |
| `WpaInstantResult` | interface | [L124](../../../../../../src/lib/wpa/cache.ts#L124) |  |
| `WpaFullResult` | interface | [L130](../../../../../../src/lib/wpa/cache.ts#L130) |  |
| `getDocClient` | function | [L147](../../../../../../src/lib/wpa/cache.ts#L147) |  |
| `generatePhotoHash` | function | [L169](../../../../../../src/lib/wpa/cache.ts#L169) | photoUrls |
| `getWpaCached` | function | [L181](../../../../../../src/lib/wpa/cache.ts#L181) | listingId, mode, currentPhotoHash |
| `setWpaCached` | function | [L226](../../../../../../src/lib/wpa/cache.ts#L226) | listingId, mode, city, photoHash, data |
| `invalidateWpaCache` | function | [L261](../../../../../../src/lib/wpa/cache.ts#L261) | listingId |
| `getWpaCacheByCity` | function | [L285](../../../../../../src/lib/wpa/cache.ts#L285) | city |
| `WpaCacheStats` | interface | [L316](../../../../../../src/lib/wpa/cache.ts#L316) |  |
| `getWpaCacheStats` | function | [L325](../../../../../../src/lib/wpa/cache.ts#L325) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `crypto`, `./table-contracts`
