# Data licenses

## OpenStreetMap-derived schematic

The simplified Barcelona boundary in `src/scripts/generateHeatmapDemo.ts` is explicitly identified by the original source as simplified from OpenStreetMap. The corresponding boundary/geometry in `src/lib/geo/barcelona-demo-paths.ts` is distributed with that origin and the Open Database License notice:

© OpenStreetMap contributors. OpenStreetMap-derived geographic data is available under the [Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright).

The generator’s application code remains MIT. This separate data notice applies to the OpenStreetMap-derived geometry and its derivatives. Preserve visible attribution when displaying it and preserve applicable data terms when redistributing a modified geographic dataset. The source’s example commute/lifestyle scores are schematic calculations, separate from measured routes.

The other old generated `barcelona-heatmap-paths.ts` file had an unverified upstream geometry origin and is excluded. Its original renderer remains available with an explicit recipient-provided paths prop. The runnable first-match screen uses neither geographic dataset.

## Recipient datasets

Listings, property photos, market prices, census exports, scraped HTML, tiles, route results and private geographic exports are supplied under their own grants. This source release includes acquisition code and schemas; a recipient records the source, date, license, attribution and permitted reuse for each acquired dataset.

The first-match homes, purchase amounts, property scores and neighborhood scores in `tools/home-fixtures.mjs` are authored synthetic inputs released with the original-code MIT grant. `sweetSpot.ts` also uses newly authored fictional neighborhood inputs. They are examples for engineering and UI behavior.

Primary license sources checked 2026-10-28: the two OpenStreetMap/ODbL links above.
