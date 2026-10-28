# Home Matching

Home Matching is a property search app for people choosing a home in Spain, and the agents helping them. It brings a household’s routines, budget and priorities into the search: daylight, working from home, outdoor space, accessibility and neighborhood fit.

[Website](https://atelierneyra.com/home-matching) · [Documentation](https://docs.atelierneyra.com/home-matching/overview/)

Property analysis is shared across searches. Changing a household’s priorities reranks the same analysis through deterministic scoring. The source includes the original intake, recommendations, property reports, maps, voice flows, data adapters and ingestion tools.

![Original recommendation screen with fictional homes](docs/assets/matching-home-office-desktop.png)

The example uses fictional purchase homes and actual deterministic scores.

## Run the recommendation scene

Use Node 22.18 or later in the Node 22 line:

```sh
git clone https://github.com/latintzar/home-matching.git
cd home-matching/starter
npm ci
npm run dev
```

Visit **http://127.0.0.1:3000** to explore the original recommendation interface with authored listings and scores. The full application and its provider setup are described in [Setup](docs/setup.md).

To run the original scorer directly, from the repository root:

```sh
node --experimental-strip-types tools/first-match.mjs
node --experimental-strip-types --test tests/first-match.test.mjs
```

## Build with it

- [Guide](docs/guide.md): first result, changes and next steps.
- [Setup](docs/setup.md): recipient-owned private configuration and full-app dependencies.
- [Workflows](docs/workflows.md): property analysis, household fit, voice and location.
- [Architecture](docs/architecture.md): modules, storage contracts and execution boundaries.
- [Decisions](docs/decisions.md): original choices and extraction tradeoffs.
- [Source reference](docs/reference/README.md): modules, functions and machine-readable symbols.
- [Release status](RELEASE-STATUS.md): tested scope and integration acceptance.
- [Original plans](docs/plans/P0_INDEX.md): retained historical product specifications.

Original code: MIT, copyright Peter Neyra. [Third-party notices](THIRD-PARTY-NOTICES.md) cover dependencies and fonts. [Provenance](docs/provenance.md) records the source pin, authored examples and retained historical experiments.

[made by atelier neyra](https://atelierneyra.com)
