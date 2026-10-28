# scripts/geo/match-serp-to-barrios.ts

[Source](../../../../../scripts/geo/match-serp-to-barrios.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SerpProfile` | interface | [L37](../../../../../scripts/geo/match-serp-to-barrios.ts#L37) |  |
| `BarrioBoundary` | interface | [L72](../../../../../scripts/geo/match-serp-to-barrios.ts#L72) |  |
| `normalizeForMatching` | function | [L82](../../../../../scripts/geo/match-serp-to-barrios.ts#L82) | name |
| `levenshteinDistance` | function | [L91](../../../../../scripts/geo/match-serp-to-barrios.ts#L91) | a, b |
| `loadSerpProfiles` | function | [L123](../../../../../scripts/geo/match-serp-to-barrios.ts#L123) |  |
| `loadBarriosForCity` | function | [L143](../../../../../scripts/geo/match-serp-to-barrios.ts#L143) | city |
| `MatchResult` | interface | [L171](../../../../../scripts/geo/match-serp-to-barrios.ts#L171) |  |
| `findBestMatch` | function | [L210](../../../../../scripts/geo/match-serp-to-barrios.ts#L210) | profile, barrios, city |
| `updateBarrioWithSerpData` | function | [L282](../../../../../scripts/geo/match-serp-to-barrios.ts#L282) | city, neighborhoodId, serpData |
| `main` | function | [L304](../../../../../scripts/geo/match-serp-to-barrios.ts#L304) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
