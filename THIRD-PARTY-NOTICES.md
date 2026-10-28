# Third-party notices

Peter Neyra’s original source is released under the repository’s MIT license. Third-party packages keep their own licenses; package names, versions and available license metadata are inventoried in `docs/dependency-licenses.json`. Package lockfiles remain authoritative for dependency resolution.

## Fonts

Source Sans 3 and Playfair Display are served locally in the full app and first-result app. Their original OFL notices and acquisition provenance are retained in `public/fonts/`; the starter carries its used Source Sans 3 font and notice. The OFL applies to those font files, separately from the repository MIT license.

## UI components

The source uses shadcn/ui-derived components and Radix primitives. The shadcn/ui license follows:

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Data and providers

API adapters, schemas, prompts and acquisition code retain the source license applicable to their authors. Google, ElevenLabs, Supabase, AWS, maps, cadastral, property-portal and payment services keep their own account/service/data terms. The original source includes OSM/Nominatim/Overpass and other geographic acquisition paths; any recipient-generated dataset needs its own attribution and data-license assessment.

The source release excludes the original listing/photo/DB exports and unverified marketing media. The first-result listing, price, analysis and neighborhood inputs are independently authored examples identified in their module and guide.

The retained OpenStreetMap-derived schematic geometry has a separate [ODbL data notice](docs/data-licenses.md).
