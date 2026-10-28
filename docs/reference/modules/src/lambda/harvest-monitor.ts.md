# src/lambda/harvest-monitor.ts

[Source](../../../../../src/lambda/harvest-monitor.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `DomainHealth` | interface | [L46](../../../../../src/lambda/harvest-monitor.ts#L46) |  |
| `MonitorReport` | interface | [L57](../../../../../src/lambda/harvest-monitor.ts#L57) |  |
| `getDomainCount` | function | [L68](../../../../../src/lambda/harvest-monitor.ts#L68) | domain |
| `getRecentCount` | function | [L89](../../../../../src/lambda/harvest-monitor.ts#L89) | domain, hoursAgo |
| `checkExportStatus` | function | [L118](../../../../../src/lambda/harvest-monitor.ts#L118) |  |
| `getHarvesterStats` | function | [L149](../../../../../src/lambda/harvest-monitor.ts#L149) |  |
| `publishMetrics` | function | [L161](../../../../../src/lambda/harvest-monitor.ts#L161) | report |
| `handler` | function | [L199](../../../../../src/lambda/harvest-monitor.ts#L199) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-cloudwatch`
