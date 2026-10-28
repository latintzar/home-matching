# src/parked/bulk-harvester/lambda/spider-single.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `shouldSkip` | function | [L43](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L43) | url |
| `normalizeUrl` | function | [L47](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L47) | url |
| `getDomain` | function | [L64](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L64) | url |
| `getS3Key` | function | [L72](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L72) | url, domain |
| `extractLinks` | function | [L79](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L79) | html, baseUrl |
| `getStartUrl` | function | [L104](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L104) | domain |
| `saveUrls` | function | [L115](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L115) | urls |
| `updateDomainStatus` | function | [L148](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L148) | domain, status, stats |
| `Event` | interface | [L165](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L165) |  |
| `handler` | function | [L169](../../../../../../../src/parked/bulk-harvester/lambda/spider-single.ts#L169) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `crypto`
