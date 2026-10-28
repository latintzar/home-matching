# src/parked/bulk-harvester/harvest/gemini-client.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `GeminiResponse` | interface | [L27](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L27) |  |
| `CallResult` | interface | [L47](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L47) |  |
| `callGemini` | function | [L58](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L58) | model, prompt, options |
| `callTeacher` | function | [L140](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L140) | prompt |
| `callValidator` | function | [L151](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L151) | prompt |
| `calculateCost` | function | [L162](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L162) | model, inputTokens, outputTokens |
| `BudgetTracker` | class | [L175](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L175) |  |
| `constructor` | constructor | [L180](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L180) | budgetUSD |
| `track` | method | [L188](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L188) | model, inputTokens, outputTokens |
| `getTotalCost` | method | [L194](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L194) |  |
| `getRemainingBudget` | method | [L204](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L204) |  |
| `isOverBudget` | method | [L208](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L208) |  |
| `getReport` | method | [L212](../../../../../../../src/parked/bulk-harvester/harvest/gemini-client.ts#L212) |  |

Imports: 
