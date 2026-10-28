# src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Selectors` | interface | [L39](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L39) |  |
| `ExtractedData` | interface | [L56](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L56) |  |
| `initBudget` | function | [L70](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L70) |  |
| `recordSpend` | function | [L101](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L101) | cost |
| `recordDomainResult` | function | [L115](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L115) | graduated |
| `compressHtml` | function | [L127](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L127) | html, maxChars |
| `simpleExtract` | function | [L145](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L145) | html, selectors, url |
| `callTeacher` | function | [L177](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L177) | html, domain |
| `callProValidator` | function | [L251](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L251) | htmls, extractions, selectors, teacherReasoning, domain |
| `callFlashValidator` | function | [L331](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L331) | htmls, extractions |
| `getListingsForDomain` | function | [L405](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L405) | domain, limit |
| `getHtmlFromS3` | function | [L449](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L449) | s3Key |
| `saveGraduatedSelectors` | function | [L462](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L462) | domain, selectors, passRate |
| `parkDomain` | function | [L475](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L475) | domain, reasons |
| `getDomainsToProcess` | function | [L486](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L486) |  |
| `processDomain` | function | [L514](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L514) | domain, currentSpent |
| `handler` | function | [L606](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator-v2.ts#L606) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/client-s3`
