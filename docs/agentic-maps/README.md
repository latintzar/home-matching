# Agentic Maps Documentation Index

> Quick reference for all docs with status tracking and feedback loops.

## Status Legend

| Status | Meaning |
|--------|---------|
| 🟢 `done` | Implemented and working |
| 🟡 `implementing` | Being built right now |
| 🔵 `design` | Current thinking, not yet built |
| ⚪ `idea` | Brainstorm, not committed to |
| 🔴 `superseded` | Replaced by another doc |

---

## Documentation Hierarchy

**Design flows DOWN. Learnings flow UP.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Level 1: VISION                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  AGENTIC_MAPS.md                                                    │
│  • "Why" - Vision, principles, key decisions                        │
│  • "What" - The 7 scenarios at a glance                            │
│  • Updates: Only when fundamental thinking changes                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   │                   ▼
┌─────────────────────────┐       │       ┌─────────────────────────┐
│  Level 2a: SPECS        │       │       │  Level 2b: ARCHITECTURE │
│  ─────────────────────  │       │       │  ─────────────────────  │
│  scenarios/*.md         │       │       │  architecture/*.md      │
│  • "What exactly"       │       │       │  • System design        │
│  • Detailed per-scenario│       │       │  • UI patterns          │
│  • User flows, outputs  │       │       │  • Data models          │
└────────────┬────────────┘       │       └─────────────────────────┘
             │                    │
             └────────────────────┼────────────────────┐
                                  ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│  Level 3: IMPLEMENTATION DETAILS                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  BUILDING_BLOCKS.md                                                 │
│  • "How" - Testable units with sample inputs/outputs               │
│  • Detailed enough to write code                                   │
│  • Where you discover "this won't work" or "we need X"             │
│  • Updates: Frequently, as you test and learn                      │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Level 4: CODE                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  /src/app/vibe-maps/, /src/components/vibe-maps/, API routes       │
│  • Actual implementation                                            │
│  • Tests in browser                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### The Two-Way Flow

```
DESIGN DOWN                              LEARNINGS UP
────────────                             ────────────

"We need 7 scenarios"                    "Isochrone API is expensive,
         │                                let's use Turf.js locally"
         ▼                                         ▲
"Scenario 5 needs                        "Test 5.3 revealed we can
 isochrone intersection"                  compute intersections FREE"
         │                                         ▲
         ▼                                         │
"Building block 5.3:                     [Run test, see result]
 Compute intersection"                             ▲
         │                                         │
         ▼                                         │
[Write code, test it] ─────────────────────────────┘
```

---

## 🔄 Feedback Loop (Learnings Flow UP)

**BUILDING_BLOCKS.md is where you discover what actually works.**

### When testing reveals something:

```
┌─────────────────────────────────────────────────────────────────┐
│  You test Building Block 5.2 (Generate isochrone)              │
│  ─────────────────────────────────────────────────────────────  │
│  Discovery: "Geoapify costs $0.0049/call, but Turf.js can      │
│             approximate isochrones for FREE using road network" │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Update BUILDING_BLOCKS.md                              │
│  ─────────────────────────────────────────────────────────────  │
│  "Test 5.2 - Alternative: Turf.js buffer (FREE but less        │
│   accurate). Use Geoapify only when precision matters."         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Does this change the scenario design?
                              │
              ┌───────────────┴───────────────┐
              │ YES                           │ NO
              ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  Step 2: Update scenario    │   │  Just note in building      │
│  05-MEET-IN-MIDDLE.md       │   │  blocks, move on            │
│  "Use Turf.js for casual    │   │                             │
│   queries, Geoapify for     │   │                             │
│   actual meetups"           │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘
              │
              ▼ Does this change the overall vision?
              │
              │ (rarely)
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Update AGENTIC_MAPS.md                                 │
│  ─────────────────────────────────────────────────────────────  │
│  "Key Principle: Use FREE local computation (Turf.js) for      │
│   exploration, paid APIs only for final user actions"           │
└─────────────────────────────────────────────────────────────────┘
```

### Update frequency by level:

| Level | Doc | Update frequency |
|-------|-----|-----------------|
| 1 | AGENTIC_MAPS.md | Rarely - only fundamental changes |
| 2 | scenarios/*.md | Sometimes - when design changes |
| 3 | BUILDING_BLOCKS.md | Often - as you test and learn |
| 4 | Code | Constantly - implementation |

---

## Document Status

### Core Docs

| Document | Status | Last Updated | Notes |
|----------|--------|--------------|-------|
| [AGENTIC_MAPS.md](AGENTIC_MAPS.md) | 🔵 design | 2024-12-12 | Main overview |
| [BUILDING_BLOCKS.md](BUILDING_BLOCKS.md) | 🔵 design | 2024-12-12 | Detailed test specs |

### Scenarios

| # | Scenario | Status | Building Blocks | Implemented? |
|---|----------|--------|-----------------|--------------|
| 1 | [Things to Do](scenarios/01-THINGS-TO-DO.md) | 🔵 design | 1.1, 1.2, Shared.1-4 | Partial (`/vibe-maps`) |
| 2 | [Where to Stay](scenarios/02-WHERE-TO-STAY.md) | 🔵 design | 2.1, 2.2, Shared.1-5 | No |
| 3 | [Stay + Do](scenarios/03-STAY-AND-DO.md) | 🔵 design | 3.1, 3.2, Shared.1-5 | No |
| 4 | [Single Place](scenarios/04-SINGLE-PLACE.md) | 🔵 design | 4.1-4.4, Shared.3-4 | No |
| 5 | [Meet in Middle](scenarios/05-MEET-IN-MIDDLE.md) | 🔵 design | 5.1-5.4, 4.1-4.4 | No |
| 6 | [Areas to Explore](scenarios/06-AREAS-TO-EXPLORE.md) | 🔵 design | 5.1-5.2, 6.1-6.3 | No |
| 7 | [Multi-Stop Route](scenarios/07-MULTI-STOP-ROUTE.md) | 🔵 design | 7.1-7.5, 4.1-4.2, 1.1 | No |

### Architecture

| Document | Status | Last Updated | Implemented? |
|----------|--------|--------------|--------------|
| [AGENT-PATTERN.md](architecture/AGENT-PATTERN.md) | 🔵 design | 2024-12-12 | No |
| [CHAT-UI.md](architecture/CHAT-UI.md) | 🟡 implementing | 2024-12-12 | `/vibe-maps` |
| [CHAT-HISTORY.md](architecture/CHAT-HISTORY.md) | 🔵 design | 2024-12-12 | Partial |
| [CHROME-EXTENSION.md](architecture/CHROME-EXTENSION.md) | 🟡 implementing | 2024-12-12 | `/leo-vibe-extension` |
| [API-REFERENCE.md](architecture/API-REFERENCE.md) | 🔵 design | 2024-12-12 | Reference doc |

---

## Building Blocks → Scenario Mapping

Which building blocks each scenario needs:

```
Scenario 1 (Things to Do):
  └─ 1.1 Generate vibe areas ✓ (working in prototype)
  └─ 1.2 Generate itinerary ✓ (working in prototype)
  └─ Shared.1 Render circles ✓
  └─ Shared.2 Render info card ✓
  └─ Shared.4 GMaps/TikTok URLs ✓

Scenario 5 (Meet in Middle):
  └─ 5.1 Geocode locations ○ (needs testing)
  └─ 5.2 Generate isochrone ○ (needs testing)
  └─ 5.3 Compute intersection ○ (needs testing)
  └─ 5.4 Identify neighborhoods ○ (needs testing)
  └─ 4.1-4.4 Place verification ○ (needs testing)

(✓ = done/working, ○ = not yet tested)
```

---

## How to Update Docs

### When you test a building block:

1. Run the test in the UI
2. Update `BUILDING_BLOCKS.md` with results
3. If design changed, update the scenario doc
4. Update status in frontmatter: `status: implementing` or `status: done`
5. Update `last_updated` date

### When design thinking evolves:

1. Update `BUILDING_BLOCKS.md` first (it's the working doc)
2. Once stable, update the scenario doc
3. Keep frontmatter `feeds_into` / `building_blocks` lists accurate

### Frontmatter fields:

```yaml
---
status: design | implementing | done | idea | superseded
last_updated: YYYY-MM-DD
building_blocks: [1.1, 1.2, Shared.1]  # Which blocks this uses
implemented_in: /src/app/vibe-maps/    # Where the code lives
feeds_into: [scenarios/01-THINGS-TO-DO.md]  # What this doc influences
superseded_by: ./NEW_DOC.md            # If replaced
---
```

---

## Quick Commands

Check status of all docs:
```bash
grep -r "^status:" docs/agentic-maps/ | sort
```

Find docs being implemented:
```bash
grep -r "status: implementing" docs/agentic-maps/
```

Find which scenarios use a building block:
```bash
grep -r "5.2" docs/agentic-maps/scenarios/
```

---

*Last updated: December 2024*

