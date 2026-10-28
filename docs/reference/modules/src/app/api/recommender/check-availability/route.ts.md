# src/app/api/recommender/check-availability/route.ts

[Source](../../../../../../../../src/app/api/recommender/check-availability/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CheckAvailabilityRequest` | interface | [L39](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L39) |  |
| `FlexibilitySuggestion` | interface | [L52](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L52) |  |
| `MatchedLocation` | interface | [L65](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L65) |  |
| `CheckAvailabilityResponse` | interface | [L70](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L70) |  |
| `buildMinimalProfile` | function | [L87](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L87) | req |
| `analyzeFlexibility` | function | [L132](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L132) | baseFilters, baseCount, req |
| `getMockResults` | function | [L280](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L280) | filters |
| `POST` | function | [L307](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L307) | request |
| `GET` | function | [L426](../../../../../../../../src/app/api/recommender/check-availability/route.ts#L426) | request |

Imports: `next/server`, `@/lib/recommender/sweetSpot`, `@/lib/recommender/harvestFilter`, `@/lib/recommender/neighborhoodAdjacency`, `@/types/recommender`
