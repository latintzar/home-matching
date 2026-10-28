# src/scripts/migrate-s3-to-dynamo.ts

[Source](../../../../../src/scripts/migrate-s3-to-dynamo.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `S3Listing` | interface | [L39](../../../../../src/scripts/migrate-s3-to-dynamo.ts#L39) |  |
| `loadS3Listings` | function | [L81](../../../../../src/scripts/migrate-s3-to-dynamo.ts#L81) | domain |
| `getExistingIds` | function | [L106](../../../../../src/scripts/migrate-s3-to-dynamo.ts#L106) | domain |
| `inferContractType` | function | [L133](../../../../../src/scripts/migrate-s3-to-dynamo.ts#L133) | listing |
| `transformToDynamoItem` | function | [L164](../../../../../src/scripts/migrate-s3-to-dynamo.ts#L164) | listing, domain |
| `migrate` | function | [L239](../../../../../src/scripts/migrate-s3-to-dynamo.ts#L239) | domain, dryRun |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `zlib`, `dotenv`
