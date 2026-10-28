# src/parked/bulk-harvester/harvest/budget-tracker.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `BudgetState` | interface | [L26](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L26) |  |
| `LLMUsage` | interface | [L35](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L35) |  |
| `getClient` | function | [L43](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L43) |  |
| `calculateCost` | function | [L53](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L53) | usage |
| `initBudgetTracker` | function | [L63](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L63) |  |
| `getBudgetState` | function | [L113](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L113) |  |
| `canAffordDomain` | function | [L139](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L139) | estimatedCost |
| `recordUsage` | function | [L158](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L158) | usage |
| `recordDomainComplete` | function | [L189](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L189) | graduated |
| `printBudgetSummary` | function | [L210](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L210) |  |
| `resetBudgetTracker` | function | [L228](../../../../../../../src/parked/bulk-harvester/harvest/budget-tracker.ts#L228) |  |

Imports: `@aws-sdk/client-dynamodb`
