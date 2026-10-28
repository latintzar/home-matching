# Guide

## Run a match

Run `node --experimental-strip-types tools/first-match.mjs` from the repository root. It loads the original `fitScoringV2.ts`, evaluates three fictional homes for two profiles, checks the analysis inputs remain unchanged and writes a mode-0600 JSON receipt in a private temporary directory.

The receipt contains pre-WPA filtering scores, both rankings, dealbreaker results, the scorer’s source hash and zero-call evidence. `--output /absolute/new/private-file.json` selects a new receipt outside the checkout.

## Change the priorities

Edit `tools/home-fixtures.mjs`. `profiles.homeOffice` raises the weight of working space and neighborhood quietness; `profiles.outdoorSpace` raises daylight and outdoor space. The same `homes[].wpa` and `homes[].neighborhood` objects serve both profiles.

The result is a fit heuristic on the supplied evidence. The source’s score threshold is 50; known must-have failures, selected dealbreakers and relevant safety flags can reject a home earlier. Missing dimensions are omitted from the weighted average. See [workflows](workflows.md) before adding a new score.

## Open the screen

Install and run `starter/`. Its buttons call the actual scorer in the browser and pass its results into the original `/recommend` result scene, extracted as `RecommendationResults`. The native empty-photo state represents these image-free examples. The application’s original cream sidebar, property reports and voice pages remain in `src/` for the full application.

The first-result app is a bounded reuse path. Full-app installation, authentication, databases, provider accounts and migration checks are [separate setup steps](setup.md).

## Extend a workflow

For a new household preference, add a weight or must-have using an existing WPA dimension and cover its effect with a deterministic test. For new property evidence, keep the description/score/cache contract separate from household ranking. For a new location provider, preserve the distinction between a supplied neighborhood score, an approximate geographic calculation and a measured route duration.

Use [module and function references](reference/README.md) to follow the original implementation, then record the reason for a change in the owning module or a dated decision.
