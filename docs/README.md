# Leo Documentation

> **Last Updated:** December 7, 2025

## Quick Start

**Start here:** [P0 Index](./plans/P0_INDEX.md) - Master documentation for the Leo platform.

## Documentation Structure

```
docs/
├── plans/P0_INDEX.md          ← START HERE (master index)
│   └── P0-01 to P0-14         ← Detailed specs
├── reference/                 ← Database schemas, AWS scripts
├── *.md (root level)          ← Referenced by P0 docs
├── parked/                    ← Inactive docs (hidden from Cursor)
└── archive/                   ← Legacy docs (hidden from Cursor)
```

## Active Documentation

### P0 Core (15 docs)

| Doc | Description |
|-----|-------------|
| [P0_INDEX](./plans/P0_INDEX.md) | **Master index** - start here |
| [P0-01-OVERVIEW](./plans/P0-01-OVERVIEW.md) | Quick reference, costs, break-even |
| [P0-02-WPA-PIPELINE](./plans/P0-02-WPA-PIPELINE.md) | 2-step WPA (describe→score) |
| [P0-03-RECOMMENDER](./plans/P0-03-RECOMMENDER.md) | Fit scoring V2 |
| [P0-04-LOCATION-SCORING](./plans/P0-04-LOCATION-SCORING.md) | Three-layer heatmap |
| [P0-05-ELEVENLABS-AGENTS](./plans/P0-05-ELEVENLABS-AGENTS.md) | Voice agent tools & flow |
| [P0-06-UI-COMPONENTS](./plans/P0-06-UI-COMPONENTS.md) | Map, carousel, mobile |
| [P0-07-DATABASE](./plans/P0-07-DATABASE.md) | Supabase & DynamoDB |
| [P0-08-TASKS](./plans/P0-08-TASKS.md) | Implementation checklist |
| [P0-09-BILLING-STRIPE](./plans/P0-09-BILLING-STRIPE.md) | Stripe integration |
| [P0-10-NOTES-SYSTEM](./plans/P0-10-NOTES-SYSTEM.md) | WhatsApp-style notes |
| [P0-11-USER-TYPES-FLOWS](./plans/P0-11-USER-TYPES-FLOWS.md) | 4 user types |
| [P0-12-AUTH-TESTING](./plans/P0-12-AUTH-TESTING.md) | Test auth system |
| [P0-13-CORE-TASKS](./plans/P0-13-CORE-TASKS.md) | Tasks 1,4,5,6,7 specs |
| [P0-14-HARVESTING](./plans/P0-14-HARVESTING.md) | Premium agency pipeline |

### Referenced Docs (6 docs)

| Doc | Referenced By |
|-----|---------------|
| [HEATMAP_LOCATION_SCORING](./HEATMAP_LOCATION_SCORING.md) | P0-01, P0-04 |
| [DATA_SOURCES_ARCHITECTURE](./DATA_SOURCES_ARCHITECTURE.md) | P0-04, P0-07 |
| [LOCATION_SCORING_LOGIC](./LOCATION_SCORING_LOGIC.md) | P0-04 |
| [HARVEST_DASHBOARD](./HARVEST_DASHBOARD.md) | P0-14 |
| [PREMIUM_DOMAIN_HARVEST_GUIDE](./PREMIUM_DOMAIN_HARVEST_GUIDE.md) | P0-14 |
| [TECH_STACK_AND_SERVICES](./TECH_STACK_AND_SERVICES.md) | General |

### Reference (2 docs)

| Doc | Description |
|-----|-------------|
| [DATABASE_SCHEMAS](./historical-reference/DATABASE_SCHEMAS.md) | DynamoDB table definitions |
| [AWS_STATUS_SCRIPTS](./historical-reference/AWS_STATUS_SCRIPTS.md) | AWS operations & scripts |

## Parked & Archived

| Folder | Contents | Status |
|--------|----------|--------|
| `parked/` | 65 docs from pre-P0 era | May be useful later, hidden from Cursor |
| `archive/` | ~80 legacy docs | Historical reference only |

To browse parked docs: `ls docs/parked/`

## Environment

See `.env.local.example` for required environment variables.

---

## File Mapping

### What's in `parked/` (65 files)

**From docs/ root (38 files):**
- ARCHITECTURE_FLOWS.md, CLIENT_SIDE_SCRAPING.md, CONSOLIDATED_RENOVATION_PLAN.md
- CRON_JOBS.md, DEDUPLICATION_STRATEGY.md, DEV_MODE.md, DOMAINS_WITHOUT_LISTINGS.md
- ELEVENLABS_AGENT_BEHAVIOR.md, ELEVENLABS_VOICE_AGENT_ARCH.md
- ENGEL_VOLKERS_HARVEST.md, ENGEL_VOLKERS_HARVEST_STRATEGY.md
- HARVEST_SESSION_2025_12_05.md, HARVEST_STRATEGY_V2.md, HARVEST_SYSTEM.md
- HARVEST_TRACKING_ISSUES.md, INE_INCOME_DATA_INTEGRATION.md
- LANDING_PAGE_NEXT_STEPS.md, LEO_ARCHITECTURE.md, LEO_HOMEPAGE_REBUILD.md
- LIFESTYLE_ALGORITHM_ARCH.md, LISTING_STATUS_DETECTION.md, MIGRATION_LOG.md
- NEIGHBORHOOD_PROFILES.md, PARSING_ARCHITECTURE.md, PERSONA_PAGES_ALIGNMENT.md
- PIPELINE_FLOW.md, PIPELINE_STATUS.md, PLAN_REAL_DATA_LAYOUT_12.md
- PROGRESSIVE_COMPONENT_PATTERN.md, RESPIDER_PRIORITY_LIST.md
- SCRAPER_CAPABILITIES.md, SCRAPER_COMPARISON.md, SCRAPING_ARCHITECTURE.md
- SEARCHABLE_CAPABILITIES.md, UI_FLOW_MAP.md, ULTIMATE_PIPELINE_BACKUP.md
- USER_DIMENSION_INFERENCE.md, WHAT_LEO_LEARNS.md

**From docs/plans/ (19 files):**
- BUILD_PLAN.md, CASCADE_LEARNING_EVALUATION.md, CASCADE_LEARNING_PARSER.md
- ENDPOINT_MIGRATION_PLAN.md, lifestyle_recommender_upgrade.md
- listing_editor_improvements.md, listing_refinement_plan.md, P0_LEAN_APP_FULL.md
- parallelization_opportunities.md, PARSING_PIPELINE_V2.md
- PROPERTY_REPORTS_DESIGN.md, RECOMMENDER_PLAN.md, SALE_RENT_CLASSIFICATION.md
- scalable_recommendation_engine.md, SUBSCRIPTION_AND_PAYMENTS.md
- UI_ASCII_AND_ANALYTICS.md, UI_BY_USER_TYPE.md
- upgrade_lifestyle_engine.md, variable_cost_photo_analysis.md

**From docs/reference/ (2 files):**
- ENDPOINT_PIPELINE_MAP.md, PIPELINE_ENDPOINTS.md

**Folders moved (6 files):**
- config/ELEVENLABS_AGENT_CONFIG.md
- feedback/buyer_report_feedback_20240524.md
- snippets/recommender_logic_v2.txt
