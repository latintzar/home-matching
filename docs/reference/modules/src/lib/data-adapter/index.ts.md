# src/lib/data-adapter/index.ts

[Source](../../../../../../src/lib/data-adapter/index.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `determineSource` | function | [L61](../../../../../../src/lib/data-adapter/index.ts#L61) | listingId |
| `findSource` | function | [L80](../../../../../../src/lib/data-adapter/index.ts#L80) | listingId |
| `getListing` | function | [L112](../../../../../../src/lib/data-adapter/index.ts#L112) | listingId, options |
| `listingExists` | function | [L138](../../../../../../src/lib/data-adapter/index.ts#L138) | listingId |
| `saveListing` | function | [L151](../../../../../../src/lib/data-adapter/index.ts#L151) | listing |
| `getAnalysis` | function | [L165](../../../../../../src/lib/data-adapter/index.ts#L165) | listingId, analysisType |
| `saveAnalysis` | function | [L179](../../../../../../src/lib/data-adapter/index.ts#L179) | listingId, analysisType, results |
| `getClusters` | function | [L198](../../../../../../src/lib/data-adapter/index.ts#L198) | listingId |
| `saveClusters` | function | [L213](../../../../../../src/lib/data-adapter/index.ts#L213) | listingId, clusters |
| `getWPACache` | function | [L235](../../../../../../src/lib/data-adapter/index.ts#L235) | listingId |
| `saveWPACache` | function | [L255](../../../../../../src/lib/data-adapter/index.ts#L255) | listingId, analysis, modelUsed |
| `queryByCity` | function | [L279](../../../../../../src/lib/data-adapter/index.ts#L279) | city, limit |
| `queryByDomain` | function | [L289](../../../../../../src/lib/data-adapter/index.ts#L289) | domain, limit |
| `getListingFull` | function | [L303](../../../../../../src/lib/data-adapter/index.ts#L303) | listingId |
| `getListingBasic` | function | [L313](../../../../../../src/lib/data-adapter/index.ts#L313) | listingId |
| `getListings` | function | [L323](../../../../../../src/lib/data-adapter/index.ts#L323) | listingIds, options |

Imports: `./types`, `./supabase-adapter`, `./dynamodb-adapter`, `./types`
