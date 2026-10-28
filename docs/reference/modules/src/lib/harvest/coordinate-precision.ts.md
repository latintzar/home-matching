# src/lib/harvest/coordinate-precision.ts

[Source](../../../../../../src/lib/harvest/coordinate-precision.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CoordinatePrecision` | type | [L21](../../../../../../src/lib/harvest/coordinate-precision.ts#L21) |  |
| `AddressComponents` | interface | [L23](../../../../../../src/lib/harvest/coordinate-precision.ts#L23) |  |
| `CoordinateInfo` | interface | [L33](../../../../../../src/lib/harvest/coordinate-precision.ts#L33) |  |
| `NominatimResult` | interface | [L42](../../../../../../src/lib/harvest/coordinate-precision.ts#L42) |  |
| `GeocodingResult` | interface | [L65](../../../../../../src/lib/harvest/coordinate-precision.ts#L65) |  |
| `CoordinateVerification` | interface | [L74](../../../../../../src/lib/harvest/coordinate-precision.ts#L74) |  |
| `haversineDistance` | function | [L156](../../../../../../src/lib/harvest/coordinate-precision.ts#L156) | lat1, lng1, lat2, lng2 |
| `hasStreetAddress` | function | [L174](../../../../../../src/lib/harvest/coordinate-precision.ts#L174) | address |
| `isNearCityCenter` | function | [L196](../../../../../../src/lib/harvest/coordinate-precision.ts#L196) | lat, lng, cityName |
| `geocodeAddress` | function | [L228](../../../../../../src/lib/harvest/coordinate-precision.ts#L228) | address, options |
| `reverseGeocode` | function | [L311](../../../../../../src/lib/harvest/coordinate-precision.ts#L311) | lat, lng, options |
| `verifyCoordinates` | function | [L390](../../../../../../src/lib/harvest/coordinate-precision.ts#L390) | embeddedLat, embeddedLng, addressText, existingComponents |
| `extractStreetAddressFromHtml` | function | [L576](../../../../../../src/lib/harvest/coordinate-precision.ts#L576) | html |
| `extractNeighborhoodFromHtml` | function | [L606](../../../../../../src/lib/harvest/coordinate-precision.ts#L606) | html |
| `extractCityFromHtml` | function | [L631](../../../../../../src/lib/harvest/coordinate-precision.ts#L631) | html |
| `extractBestAddressFromHtml` | function | [L654](../../../../../../src/lib/harvest/coordinate-precision.ts#L654) | html, existingComponents |
| `analyzeCoordinates` | function | [L677](../../../../../../src/lib/harvest/coordinate-precision.ts#L677) | lat, lng, rawAddress, components |
| `determineCoordinatePrecision` | function | [L743](../../../../../../src/lib/harvest/coordinate-precision.ts#L743) | lat, lng, addressString, city, neighborhood |

Imports: 
