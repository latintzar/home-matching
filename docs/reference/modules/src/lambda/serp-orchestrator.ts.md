# src/lambda/serp-orchestrator.ts

[Source](../../../../../src/lambda/serp-orchestrator.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SerpItem` | interface | [L30](../../../../../src/lambda/serp-orchestrator.ts#L30) |  |
| `getUrlsToDownload` | function | [L40](../../../../../src/lambda/serp-orchestrator.ts#L40) | cityFilter |
| `getNeighborhoodsToAnalyze` | function | [L87](../../../../../src/lambda/serp-orchestrator.ts#L87) | cityFilter |
| `fireDownloadLambdas` | function | [L140](../../../../../src/lambda/serp-orchestrator.ts#L140) | urls |
| `fireAnalyzeLambdas` | function | [L173](../../../../../src/lambda/serp-orchestrator.ts#L173) | neighborhoods |
| `handler` | function | [L189](../../../../../src/lambda/serp-orchestrator.ts#L189) | event |
| `main` | function | [L271](../../../../../src/lambda/serp-orchestrator.ts#L271) |  |

Imports: `@aws-sdk/client-lambda`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`
