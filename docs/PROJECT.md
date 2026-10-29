# Home search ranked around how a household lives

Home Matching is a property search app that ranks homes against a household’s routines, budget and priorities. Compare daylight, work space, accessibility, outdoor space and neighbourhood fit, then save homes and prepare a viewing.

Two households can look at the same property and need different things. A useful search needs to explain how each home fits the people moving into it.

| Feature | What it does |
| --- | --- |
| Household profile | Capture required conditions, preferences and their relative importance. |
| Explainable ranking | Apply dealbreakers before weighted matching and show the fit and concerns. |
| Property reports | Inspect rooms, location and the evidence behind a recommendation. |
| Shortlist and viewings | Save favourites and keep viewing notes. |
| Voice and intake | The source retains the original conversational, map and ingestion workflows. |

## Workflow

Describe the household → Analyse property evidence → Apply requirements and weights → Compare recommendations → Shortlist and view

## Design decisions

- A property’s analysis can be reused. Changing preferences reranks that evidence through deterministic scoring.
- Required conditions are checked before softer preferences, so a high score cannot quietly erase a dealbreaker.

## Status and next steps

The native app opens eight authored homes with the original scoring and recovered project images. Favourites, notes and preference changes use a private visitor workspace. Fresh ingestion, mapping and voice providers have their own setup. Connect an owned property feed and validate the match explanation with households and agents.

Source: [docs/workflows.md](../docs/workflows.md), [docs/native-workspace.md](../docs/native-workspace.md), [docs/setup.md](../docs/setup.md).
