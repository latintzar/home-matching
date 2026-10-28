# src/parked/bulk-harvester/lambda/parse-orchestrator.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `BudgetState` | interface | [L39](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L39) |  |
| `calculateCost` | function | [L49](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L49) | state |
| `getHtml` | function | [L58](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L58) | s3Key |
| `smartCleanHtml` | function | [L74](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L74) | html |
| `getListingsByDomain` | function | [L106](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L106) |  |
| `callTeacherLambda` | function | [L144](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L144) | domain, html, url |
| `callValidatorLambda` | function | [L171](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L171) | domain, html, extracted, selectors |
| `saveSelectorsToRules` | function | [L205](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L205) | domain, selectors, trustLevel |
| `handler` | function | [L220](../../../../../../../src/parked/bulk-harvester/lambda/parse-orchestrator.ts#L220) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`
