# src/lambda/download-single.ts

[Source](../../../../../src/lambda/download-single.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Event` | interface | [L19](../../../../../src/lambda/download-single.ts#L19) |  |
| `getS3Key` | function | [L25](../../../../../src/lambda/download-single.ts#L25) | url, domain |
| `updateStatus` | function | [L32](../../../../../src/lambda/download-single.ts#L32) | url, status, s3Key, errorMsg |
| `handler` | function | [L59](../../../../../src/lambda/download-single.ts#L59) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `crypto`
