# src/parked/bulk-harvester/lambda/daily-parse.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ScrapingRule` | interface | [L30](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L30) |  |
| `ParsedListing` | interface | [L37](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L37) |  |
| `isAlreadyParsed` | function | [L57](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L57) | listingId |
| `getScrapingRule` | function | [L73](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L73) | domain |
| `getHtmlFromS3` | function | [L88](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L88) | key |
| `parseWithCheerio` | function | [L110](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L110) | html, selectors |
| `learnSelectors` | function | [L153](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L153) | html, domain |
| `generateListingId` | function | [L206](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L206) | url, domain |
| `keyToUrl` | function | [L215](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L215) | key |
| `parseFile` | function | [L225](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L225) | s3Key |
| `listUnparsedFiles` | function | [L300](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L300) | limit |
| `handler` | function | [L328](../../../../../../../src/parked/bulk-harvester/lambda/daily-parse.ts#L328) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-runtime`, `cheerio`, `zlib`
