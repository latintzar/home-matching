# src/scripts/parsing/parse-html-batch.ts

[Source](../../../../../../src/scripts/parsing/parse-html-batch.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ParseStats` | interface | [L51](../../../../../../src/scripts/parsing/parse-html-batch.ts#L51) |  |
| `getScrapingRule` | function | [L63](../../../../../../src/scripts/parsing/parse-html-batch.ts#L63) | domain |
| `saveScrapingRule` | function | [L78](../../../../../../src/scripts/parsing/parse-html-batch.ts#L78) | rule |
| `updateTrustLevel` | function | [L88](../../../../../../src/scripts/parsing/parse-html-batch.ts#L88) | domain, success |
| `saveParsedListing` | function | [L116](../../../../../../src/scripts/parsing/parse-html-batch.ts#L116) | listing |
| `getHtmlFromS3` | function | [L126](../../../../../../src/scripts/parsing/parse-html-batch.ts#L126) | key |
| `keyToUrl` | function | [L152](../../../../../../src/scripts/parsing/parse-html-batch.ts#L152) | key |
| `parseHtmlFile` | function | [L163](../../../../../../src/scripts/parsing/parse-html-batch.ts#L163) | s3Key, stats |
| `listHtmlFiles` | function | [L299](../../../../../../src/scripts/parsing/parse-html-batch.ts#L299) | limit, filterDomain |
| `main` | function | [L331](../../../../../../src/scripts/parsing/parse-html-batch.ts#L331) |  |

Imports: `zlib`, `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `dotenv`, `./types`, `./cheerio-parser`, `./bedrock-teacher`
