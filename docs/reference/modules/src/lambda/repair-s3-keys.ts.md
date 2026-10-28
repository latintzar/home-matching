# src/lambda/repair-s3-keys.ts

[Source](../../../../../src/lambda/repair-s3-keys.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getS3Key` | function | [L23](../../../../../src/lambda/repair-s3-keys.ts#L23) | url, domain |
| `s3FileExists` | function | [L34](../../../../../src/lambda/repair-s3-keys.ts#L34) | key |
| `updateUrlS3Key` | function | [L47](../../../../../src/lambda/repair-s3-keys.ts#L47) | url, s3Key |
| `markNeedsRedownload` | function | [L59](../../../../../src/lambda/repair-s3-keys.ts#L59) | url |
| `handler` | function | [L72](../../../../../src/lambda/repair-s3-keys.ts#L72) |  |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `crypto`
