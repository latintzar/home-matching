# src/lambda/daily-recommend-users.ts

[Source](../../../../../src/lambda/daily-recommend-users.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `LifeProfile` | interface | [L38](../../../../../src/lambda/daily-recommend-users.ts#L38) |  |
| `ParsedListing` | interface | [L63](../../../../../src/lambda/daily-recommend-users.ts#L63) |  |
| `Match` | interface | [L79](../../../../../src/lambda/daily-recommend-users.ts#L79) |  |
| `DeliveryItem` | interface | [L85](../../../../../src/lambda/daily-recommend-users.ts#L85) |  |
| `handler` | function | [L95](../../../../../src/lambda/daily-recommend-users.ts#L95) | event |
| `getCompleteProfiles` | function | [L187](../../../../../src/lambda/daily-recommend-users.ts#L187) |  |
| `getNewListings` | function | [L217](../../../../../src/lambda/daily-recommend-users.ts#L217) |  |
| `findMatchesForProfile` | function | [L240](../../../../../src/lambda/daily-recommend-users.ts#L240) | profile, listings |
| `queueForDelivery` | function | [L332](../../../../../src/lambda/daily-recommend-users.ts#L332) | item |
| `sendBatchedDeliveries` | function | [L342](../../../../../src/lambda/daily-recommend-users.ts#L342) | queue |
| `sendEmailDelivery` | function | [L394](../../../../../src/lambda/daily-recommend-users.ts#L394) | item |
| `sendWhatsAppDelivery` | function | [L467](../../../../../src/lambda/daily-recommend-users.ts#L467) | item |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@supabase/supabase-js`, `@/lib/lazy-supabase`
