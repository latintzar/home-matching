# src/lib/intelligence/social-radar.ts

[Source](../../../../../../src/lib/intelligence/social-radar.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SocialRadarResult` | interface | [L9](../../../../../../src/lib/intelligence/social-radar.ts#L9) |  |
| `SocialRadar` | class | [L30](../../../../../../src/lib/intelligence/social-radar.ts#L30) |  |
| `constructor` | constructor | [L33](../../../../../../src/lib/intelligence/social-radar.ts#L33) |  |
| `ensureAirbnbDb` | method | [L37](../../../../../../src/lib/intelligence/social-radar.ts#L37) |  |
| `getHaversineDistance` | method | [L50](../../../../../../src/lib/intelligence/social-radar.ts#L50) | lat1, lon1, lat2, lon2 |
| `analyzeLocation` | method | [L61](../../../../../../src/lib/intelligence/social-radar.ts#L61) | lat, lon, addressTerms, locationType |
| `scanAirbnb` | method | [L72](../../../../../../src/lib/intelligence/social-radar.ts#L72) | lat, lon, locationType |
| `generateReport` | method | [L167](../../../../../../src/lib/intelligence/social-radar.ts#L167) | airbnb, locationName |

Imports: `path`, `../gemini-rest-client`, `zod`
