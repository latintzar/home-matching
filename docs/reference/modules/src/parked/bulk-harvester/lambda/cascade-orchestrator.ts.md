# src/parked/bulk-harvester/lambda/cascade-orchestrator.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `BudgetTracker` | interface | [L48](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L48) |  |
| `calculateCost` | function | [L55](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L55) | budget |
| `getHtml` | function | [L66](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L66) | s3Key |
| `cleanHtml` | function | [L82](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L82) | html |
| `getListingsForDomain` | function | [L113](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L113) | domain |
| `getAllDomains` | function | [L142](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L142) |  |
| `callTeacher` | function | [L169](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L169) | domain, html, universalContext, budget |
| `callValidator` | function | [L201](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L201) | domain, html, extracted, selectors, budget |
| `processDomain` | function | [L252](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L252) | domain, ruleset, budget |
| `handler` | function | [L390](../../../../../../../src/parked/bulk-harvester/lambda/cascade-orchestrator.ts#L390) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `../harvest/universal-ruleset`, `../harvest/validator-prompt`
