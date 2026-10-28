# src/lib/wpa/cache.ts

[Source](../../../../../../src/lib/wpa/cache.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `WpaMode` | type | [L31](../../../../../../src/lib/wpa/cache.ts#L31) |  |
| `WpaCacheEntry` | interface | [L33](../../../../../../src/lib/wpa/cache.ts#L33) |  |
| `WpaDescriptions` | interface | [L49](../../../../../../src/lib/wpa/cache.ts#L49) |  |
| `WpaScores` | interface | [L62](../../../../../../src/lib/wpa/cache.ts#L62) |  |
| `WpaInstantResult` | interface | [L123](../../../../../../src/lib/wpa/cache.ts#L123) |  |
| `WpaFullResult` | interface | [L129](../../../../../../src/lib/wpa/cache.ts#L129) |  |
| `getDocClient` | function | [L146](../../../../../../src/lib/wpa/cache.ts#L146) |  |
| `generatePhotoHash` | function | [L167](../../../../../../src/lib/wpa/cache.ts#L167) | photoUrls |
| `getWpaCached` | function | [L179](../../../../../../src/lib/wpa/cache.ts#L179) | listingId, mode, currentPhotoHash |
| `setWpaCached` | function | [L224](../../../../../../src/lib/wpa/cache.ts#L224) | listingId, mode, city, photoHash, data |
| `invalidateWpaCache` | function | [L259](../../../../../../src/lib/wpa/cache.ts#L259) | listingId |
| `getWpaCacheByCity` | function | [L283](../../../../../../src/lib/wpa/cache.ts#L283) | city |
| `WpaCacheStats` | interface | [L314](../../../../../../src/lib/wpa/cache.ts#L314) |  |
| `getWpaCacheStats` | function | [L323](../../../../../../src/lib/wpa/cache.ts#L323) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `crypto`
