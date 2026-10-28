# src/lambda/daily-recommend-users.ts

[Source](../../../../../src/lambda/daily-recommend-users.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `LifeProfile` | interface | [L37](../../../../../src/lambda/daily-recommend-users.ts#L37) |  |
| `ParsedListing` | interface | [L62](../../../../../src/lambda/daily-recommend-users.ts#L62) |  |
| `Match` | interface | [L78](../../../../../src/lambda/daily-recommend-users.ts#L78) |  |
| `DeliveryItem` | interface | [L84](../../../../../src/lambda/daily-recommend-users.ts#L84) |  |
| `handler` | function | [L94](../../../../../src/lambda/daily-recommend-users.ts#L94) | event |
| `getCompleteProfiles` | function | [L186](../../../../../src/lambda/daily-recommend-users.ts#L186) |  |
| `getNewListings` | function | [L216](../../../../../src/lambda/daily-recommend-users.ts#L216) |  |
| `findMatchesForProfile` | function | [L239](../../../../../src/lambda/daily-recommend-users.ts#L239) | profile, listings |
| `queueForDelivery` | function | [L331](../../../../../src/lambda/daily-recommend-users.ts#L331) | item |
| `sendBatchedDeliveries` | function | [L341](../../../../../src/lambda/daily-recommend-users.ts#L341) | queue |
| `sendEmailDelivery` | function | [L393](../../../../../src/lambda/daily-recommend-users.ts#L393) | item |
| `sendWhatsAppDelivery` | function | [L466](../../../../../src/lambda/daily-recommend-users.ts#L466) | item |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@supabase/supabase-js`
