# src/parked/bulk-harvester/harvest/cheerio-student.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ParsedListing` | interface | [L11](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L11) |  |
| `Selectors` | interface | [L86](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L86) |  |
| `getText` | function | [L156](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L156) | $, selector |
| `extractNumber` | function | [L165](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L165) | text |
| `extractPrice` | function | [L175](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L175) | text |
| `extractCoordinates` | function | [L187](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L187) | $, html, selectors |
| `extractPhotos` | function | [L260](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L260) | $, html, selector |
| `addPhoto` | function | [L264](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L264) | url |
| `hasAmenity` | function | [L340](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L340) | features, description, keywords |
| `detectOrientation` | function | [L348](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L348) | features, description, context |
| `extractWhatsApp` | function | [L371](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L371) | $, html |
| `detectPropertySubtype` | function | [L397](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L397) | title, description, url |
| `detectCondition` | function | [L415](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L415) | description, features |
| `detectFloorLevel` | function | [L427](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L427) | floorNum, features |
| `extractPostalCode` | function | [L439](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L439) | address |
| `parseWithStudent` | function | [L447](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L447) | html, url, domain, selectors, selectorVersion |
| `detectListingType` | function | [L553](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L553) | url, title |
| `detectPricePeriod` | function | [L563](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L563) | text |
| `detectHousingSituation` | function | [L573](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L573) | description, features |
| `detectAdOrigin` | function | [L585](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L585) | description, url |
| `hasEssentialFields` | function | [L594](../../../../../../../src/parked/bulk-harvester/harvest/cheerio-student.ts#L594) | listing |

Imports: `cheerio`, `@/lib/geo/spain-bounds`
