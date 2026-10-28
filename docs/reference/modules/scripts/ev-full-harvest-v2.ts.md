# scripts/ev-full-harvest-v2.ts

[Source](../../../../scripts/ev-full-harvest-v2.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `EVListingBasic` | interface | [L35](../../../../scripts/ev-full-harvest-v2.ts#L35) |  |
| `EVListingFull` | interface | [L58](../../../../scripts/ev-full-harvest-v2.ts#L58) |  |
| `HarvestProgress` | interface | [L106](../../../../scripts/ev-full-harvest-v2.ts#L106) |  |
| `fetchHtml` | function | [L117](../../../../scripts/ev-full-harvest-v2.ts#L117) | url |
| `extractNextData` | function | [L137](../../../../scripts/ev-full-harvest-v2.ts#L137) | html |
| `parseSearchPage` | function | [L151](../../../../scripts/ev-full-harvest-v2.ts#L151) | html |
| `extractSubUrls` | function | [L203](../../../../scripts/ev-full-harvest-v2.ts#L203) | html, basePath |
| `parseDetailPage` | function | [L222](../../../../scripts/ev-full-harvest-v2.ts#L222) | html |
| `loadProgress` | function | [L281](../../../../scripts/ev-full-harvest-v2.ts#L281) |  |
| `saveProgress` | function | [L295](../../../../scripts/ev-full-harvest-v2.ts#L295) | progress |
| `loadExistingListings` | function | [L300](../../../../scripts/ev-full-harvest-v2.ts#L300) |  |
| `saveListings` | function | [L310](../../../../scripts/ev-full-harvest-v2.ts#L310) | listings |
| `phase1DiscoverListings` | function | [L319](../../../../scripts/ev-full-harvest-v2.ts#L319) | progress, listings |
| `phase2EnrichListings` | function | [L429](../../../../scripts/ev-full-harvest-v2.ts#L429) | progress, listings |
| `main` | function | [L499](../../../../scripts/ev-full-harvest-v2.ts#L499) |  |

Imports: `fs/promises`
