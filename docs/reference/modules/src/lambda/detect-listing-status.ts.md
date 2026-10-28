# src/lambda/detect-listing-status.ts

[Source](../../../../../src/lambda/detect-listing-status.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Listing` | interface | [L47](../../../../../src/lambda/detect-listing-status.ts#L47) |  |
| `StatusResult` | interface | [L56](../../../../../src/lambda/detect-listing-status.ts#L56) |  |
| `checkListingStatus` | function | [L66](../../../../../src/lambda/detect-listing-status.ts#L66) | listing |
| `updateListingStatus` | function | [L171](../../../../../src/lambda/detect-listing-status.ts#L171) | listing_id, status |
| `recordStatusChange` | function | [L187](../../../../../src/lambda/detect-listing-status.ts#L187) | listing_id, domain, oldStatus, newStatus, confidence |
| `getListingsToCheck` | function | [L214](../../../../../src/lambda/detect-listing-status.ts#L214) | limit |
| `handler` | function | [L252](../../../../../src/lambda/detect-listing-status.ts#L252) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
