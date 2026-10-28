# src/lib/recommender/fitScoring.ts

[Source](../../../../../../src/lib/recommender/fitScoring.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ScoredListing` | interface | [L26](../../../../../../src/lib/recommender/fitScoring.ts#L26) |  |
| `WeightConfig` | interface | [L36](../../../../../../src/lib/recommender/fitScoring.ts#L36) |  |
| `calculateWeights` | function | [L54](../../../../../../src/lib/recommender/fitScoring.ts#L54) | profile |
| `calculateBreakdown` | function | [L137](../../../../../../src/lib/recommender/fitScoring.ts#L137) | listing, wpa, profile |
| `calculateOverallScore` | function | [L203](../../../../../../src/lib/recommender/fitScoring.ts#L203) | breakdown, weights |
| `generateExplanations` | function | [L223](../../../../../../src/lib/recommender/fitScoring.ts#L223) | listing, wpa, breakdown, profile |
| `scoreListing` | function | [L322](../../../../../../src/lib/recommender/fitScoring.ts#L322) | listing, wpa, profile |
| `scoreAndRankListings` | function | [L355](../../../../../../src/lib/recommender/fitScoring.ts#L355) | listings, profile |
| `scoredListingToMatch` | function | [L377](../../../../../../src/lib/recommender/fitScoring.ts#L377) | scored, profileId |

Imports: `@/types/recommender`, `./harvestFilter`, `./wpaShortlist`
