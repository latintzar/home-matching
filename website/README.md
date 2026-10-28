# Project website

This site presents Home Matching and embeds the actual isolated recommendation starter. The local example uses authored homes and calls the original deterministic fit functions. It is separate from full-app provider commissioning.

From the repository root:

```sh
npm ci --prefix starter
npm run build --prefix starter
python3 website/build.py
python3 -m http.server 8000 --bind 127.0.0.1 --directory website/dist/public
```

Open `http://127.0.0.1:8000/home-matching/`. The reusable native entry is `/apps/home-matching/index.html`; changing profiles reranks the same fixture in the browser.

The builder packages only the starter's prerendered HTML, client JavaScript/CSS and local fonts. It rebases runtime assets under `/apps/home-matching/`, and records the source and output hashes in `website/dist/manifest.json`. Server bundles, preview cookies, caches, source maps and private configuration stay outside that output.

The marketing shell uses the original Source Sans 3 and Playfair Display fonts, original recommendation palette and native scene. `site.js` removes the embedded scene's minimum viewport height and fits the iframe to its whole contents. The standalone native entry keeps its original viewport layout. The source app and full application remain independently editable. Landing copy and links live in `index.html`; layout lives in `site.css`.

For shared hosting, serve `website/dist/public/home-matching/` at `/home-matching` and `website/dist/public/apps/home-matching/` at `/apps/home-matching/`. The same native entry can be copied into the shared Atelier preview project. Update the three canonical destinations in the template when hosting a fork: website, preview and documentation.

Original code uses MIT. Font files retain the OFL notices carried with their source. [Third-party notices](../THIRD-PARTY-NOTICES.md).
