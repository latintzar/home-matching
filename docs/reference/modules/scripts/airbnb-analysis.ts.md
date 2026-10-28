# scripts/airbnb-analysis.ts

[Source](../../../../scripts/airbnb-analysis.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `NeighborhoodProfile` | interface | [L66](../../../../scripts/airbnb-analysis.ts#L66) |  |
| `ReviewData` | interface | [L108](../../../../scripts/airbnb-analysis.ts#L108) |  |
| `openAirbnbDB` | function | [L120](../../../../scripts/airbnb-analysis.ts#L120) |  |
| `getDocClient` | function | [L132](../../../../scripts/airbnb-analysis.ts#L132) |  |
| `countKeywordMatches` | function | [L150](../../../../scripts/airbnb-analysis.ts#L150) | text, keywords |
| `analyzeReviewKeywords` | function | [L155](../../../../scripts/airbnb-analysis.ts#L155) | comments |
| `runKeywordAnalysis` | function | [L176](../../../../scripts/airbnb-analysis.ts#L176) | db |
| `runLLMAnalysis` | function | [L323](../../../../scripts/airbnb-analysis.ts#L323) | db, profiles |
| `discoverSchema` | function | [L428](../../../../scripts/airbnb-analysis.ts#L428) | db |
| `saveProfiles` | function | [L500](../../../../scripts/airbnb-analysis.ts#L500) | profiles |
| `main` | function | [L548](../../../../scripts/airbnb-analysis.ts#L548) |  |

Imports: `fs`, `path`, `better-sqlite3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `../src/lib/gemini-rest-client`
