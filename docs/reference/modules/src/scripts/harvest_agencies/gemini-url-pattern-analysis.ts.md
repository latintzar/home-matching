# src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts

[Source](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `DomainInput` | interface | [L26](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L26) |  |
| `DomainUrls` | interface | [L32](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L32) |  |
| `GeminiClassification` | interface | [L38](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L38) |  |
| `main` | function | [L48](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L48) |  |
| `analyzeWithGemini` | function | [L213](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L213) | domains |
| `fetchSitemapUrls` | function | [L279](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L279) | sitemapUrl, maxUrls, depth |
| `fetchWithTimeout` | function | [L320](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L320) | url |
| `sleep` | function | [L339](../../../../../../src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts#L339) | ms |

Imports: `fs`, `csv-parse/sync`, `csv-stringify/sync`, `cheerio`, `@/lib/gemini-rest-client`
