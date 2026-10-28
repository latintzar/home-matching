# Native recommendation screen

These four captures render the real `starter/` app in Chromium at desktop and phone sizes. It calls the original V2 fit scorer and reuses the original `/recommend` result scene, extracted into `RecommendationResults.tsx`.

The homes, purchase amounts, property analysis and neighborhood scores are authored examples. The native empty-photo state is retained. Profile switching performs a real deterministic rerank; the captures are distinct from a live photo-analysis, cloud-cache or voice session.

`proof.json` records source and image hashes, viewports, visible first result, blocked-foreign-request acceptance and zero provider/model calls. Reproduce with the starter running on loopback and `python3 starter/capture-interface.py --output /absolute/output-directory`; install the Playwright version specified by CI first.
