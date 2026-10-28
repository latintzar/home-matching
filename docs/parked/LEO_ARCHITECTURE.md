# Leo Architecture

> **The single source of truth for Leo's platform architecture.**  
> **Last Updated**: 2025-11-30  
> **Status**: Master Document (Costs Verified)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Model & Unit Economics](#2-business-model--unit-economics)
3. [Critical Patterns](#3-critical-patterns)
4. [Harvest Engine](#4-harvest-engine)
5. [Recommender](#5-recommender)
6. [Analysis (Basic Package)](#6-analysis-basic-package)
7. [Reno (Renovation Package)](#7-reno-renovation-package)
8. [Infrastructure & Costs](#8-infrastructure--costs)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [What Needs Building](#10-what-needs-building)
11. [TBC: Future Work](#11-tbc-future-work)

---

## 1. Executive Summary

### What Leo Does

Leo is a property intelligence platform that helps people find homes that fit their **lifestyle**, not just their filters.

Traditional portals: "3 beds, €300k max, Barcelona" → 8,000 results to scroll through.

Leo: "I work from home, have guests monthly, need morning light, and hate noise" → 8 curated properties that could actually support that life.

### The Four Pillars

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   HARVEST   │ → │ RECOMMENDER │ → │  ANALYSIS   │ → │    RENO     │
│             │   │             │   │   (Basic)   │   │             │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
     ↓                  ↓                  ↓                  ↓
  3,635 sites      Life Profile       Viewing           Renovation
  → HTMLs          → Filter           Requests          Tiers
  → Parsed Data    → WPA Shortlist    → Deep Dive       → Before/After
  → Daily Cron     → Geo-Intel        → Extension       → Scope
                        ↑                  │
                        └──────────────────┘
                           FLYWHEEL
                    (Analysis feeds Geo-Intel
                     → Recommender gets smarter)
```

| Pillar | Purpose | Status |
|--------|---------|--------|
| **Harvest** | Scrape 1,953 Spanish sites → 588k URLs | ✅ **COMPLETE** (see `HARVEST_SYSTEM.md`) |
| **Recommender** | Match lifestyle to properties | 🆕 **100% NEW** |
| **Analysis** | Deep dive for viewing prep | ✅ EXISTS |
| **Reno** | Renovation tiers & before/after | ✅ EXISTS |

### Key Numbers

| Metric | Value |
|--------|-------|
| **Total listings in Spain** | ~548,000 |
| **Domains to crawl** | 3,635 |
| **HTML storage** | 537 GB |
| **Monthly infrastructure** | ~€19 |
| **Break-even** | 250 users |
| **AWS credits** | $1,100 (4.5 years runway) |

### Business Model at a Glance

| Tier | Price | Target |
|------|-------|--------|
| **Renters** | €10/month | 70% of users |
| **Buyers** | €20/month | 30% of users |
| **Blended avg** | €13/user | |

**Profit margin**: 90%+ (€9-18 per user)  
**Break-even**: 250 paying users  
**Target**: €3k salary in 2 months

---

## 2. Business Model & Unit Economics

### Pricing Tiers

| Tier | Monthly | Features |
|------|---------|----------|
| **Renter** | €10 | Recommender + Basic Analysis |
| **Buyer** | €20 | Recommender + Basic + Reno Upgrade |

### Cost Per User

| Component | Cost/User/Month |
|-----------|-----------------|
| AI Analysis (Gemini) | ~€0.50-1.00 |
| Infrastructure share | ~€0.10 |
| **Total Cost** | ~€1-2 |

### Unit Economics

| Metric | Renter | Buyer |
|--------|--------|-------|
| Revenue | €10 | €20 |
| Cost | ~€1 | ~€2 |
| **Profit** | **€9** | **€18** |
| **Margin** | **90%** | **90%** |

### Break-Even Analysis

```
Fixed Costs: ~€19/month (covered by AWS credits for 4.5 years)
Variable Cost: ~€1-2 per user

Assuming 70% renters, 30% buyers:
- Blended revenue: €13/user
- Blended cost: ~€1.30/user
- Blended profit: ~€11.70/user

Break-even (to cover €0 fixed while credits last): 0 users
Break-even (to reach €3k salary): 250 users
```

### Growth Scenarios

| Users | Monthly Revenue | Monthly Profit |
|-------|-----------------|----------------|
| 50 | €650 | ~€585 |
| 100 | €1,300 | ~€1,170 |
| 250 | €3,250 | ~€2,925 |
| 500 | €6,500 | ~€5,850 |
| 1,000 | €13,000 | ~€11,700 |

### Initial Setup Cost

| Item | Cost |
|------|------|
| Domain | ~€10 |
| First month misc | ~€7 |
| **Total** | **~€17** |

---

## 3. Critical Patterns

These patterns are fundamental to how Leo works cost-effectively at scale.

### 3.1 Fetch-and-Dump (Photos)

**Problem**: 650k listings × 60 photos × 300KB = **24 TB** = ~€550/month

**Solution**: Store image URLs, not images.

```
HARVEST (once):
├── Parse HTML
├── Extract image URLs
└── Store: { listing_id, image_urls: ["https://agency.com/photo1.jpg"...] }

ANALYSIS (on-demand):
├── FETCH: Download from original URLs
├── SEND: Pass to Gemini for analysis
├── STORE: Save analysis results only
└── DUMP: Don't keep images
```

**Savings**: €550/month → €0

### 3.2 Flywheel (Analysis → Geo-Intel → Recommender)

```
ANALYSIS runs → Extracts OBSERVATIONS → Feeds GEO-INTELLIGENCE
     ↑                                              │
     │                                              ▼
     │                                   RECOMMENDER can now:
     │                                   • Search more categories
     │                                   • Have higher confidence
     │                                   • Know about buildings/streets
     │                                              │
     └──────────────────────────────────────────────┘
                    More users request viewings
```

**The more Analysis runs, the smarter Recommender gets.**

| Analyses | New Capabilities |
|----------|------------------|
| 100 | Era patterns (1960s = aluminosis risk) |
| 1,000 | Neighborhood vibes |
| 10,000 | Street-level intelligence |
| 50,000 | Building-level knowledge |

### 3.3 Student/Teacher with Validation (Parsing)

```
LEARNING (Teacher Mode):
├── LLM generates CSS selectors
├── Cost: ~€0.004 per domain
└── Status: trust_level = 0

VALIDATION (Student + Teacher):
├── Cheerio extracts with selectors
├── LLM validates: "Is this correct?"
├── If correct: trust_level++
├── If wrong: re-learn
└── Continue until trust_level >= 10

GRADUATED (Pure Student - FREE):
├── Cheerio runs alone
├── No LLM validation
└── Cost: €0.00 forever
```

### 3.4 WPA on Shortlist Only

**Problem**: Running Whole Property Analysis on 650k listings = €32,500

**Solution**: Only run WPA on shortlisted properties (~20-50 per user).

```
650k listings → Parsed Data Filter (FREE) → 50 candidates → WPA (~€2.50 total)
```

### 3.5 Schema Evolution

Users ask for things we don't extract yet ("Is there space for yoga?").

**Weekly Cron**:
1. Aggregate user needs from last 30 days
2. Identify gaps in WPA extraction
3. Update prompt if demand threshold met
4. Queue backfill for popular properties

### 3.6 Lazy WPA

Only run WPA when user actually clicks on a property, not proactively.

**Result**: Pay only for engaged users, not speculative analysis.

---

## 4. Harvest Engine

**Purpose**: Build and maintain the Spanish property data lake.

**Master Doc**: `docs/HARVEST_SYSTEM.md` (complete architecture, lessons learned, commands)

> ⚠️ **Note**: The old `archive/HARVEST_ENGINE_ARCH.md` is outdated. It described EC2/Mistral approach.
> We now use **Lambda (400 concurrent)** with **heuristic classification**.

### Current Harvest Stats (Dec 2025)

| Metric | Count |
|--------|-------|
| **Domains crawled** | 1,953 |
| **S3 HTML files** | 546,678 |
| **URLs in DynamoDB** | 587,897 |
| **Classified** | 580,903 (99%) |
| **Listings to parse** | 165,695 |
| **List pages (delta)** | 263,250 |

### Domain Breakdown

- **819** sitemapped domains (working)
- **1,134** spider-only domains
- **1,953** total domains processed

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  3,635 Real Estate Agency Websites                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Daily Crawl
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HARVEST ENGINE                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Crawler    │───▶│    Parser    │───▶│   Analyzer   │     │
│  │ (fetch HTML) │    │(Student Mode)│    │(on-demand AI)│     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AWS S3              AWS DynamoDB         Supabase             │
│  ┌──────────┐       ┌──────────────┐     ┌──────────────┐     │
│  │ HTML     │       │  Listings    │     │  Auth        │     │
│  │ Archive  │       │  Analysis    │     │  Profiles    │     │
│  │ 537 GB   │       │  Tracking    │     │              │     │
│  └──────────┘       └──────────────┘     └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Initial Crawl (Phase 1)

| Step | Time | What |
|------|------|------|
| 1A: Sitemap domains | 6 hours | 1,087 domains via sitemaps |
| 1B: No-sitemap domains | 30 hours | 2,548 domains via crawling |
| 1C: Learn selectors | 4 hours | Bedrock on all domains |
| **Total** | **~40 hours** | **~650k URLs** |

### Daily Delta (Phase 2)

| Time | Lambda | Purpose |
|------|--------|---------|
| 03:00 | `daily-harvest` | Check sitemaps for new/updated |
| 04:30 | `daily-parse` | Parse new HTMLs with Cheerio |
| 05:00 | `detect-listing-status` | Check for sold/rented/removed |
| 06:00 | `generate-daily-report` | Stats and errors |

### Listing Status Detection

When listings are taken down, we detect **why**:

| Status | Detection Method |
|--------|------------------|
| `sold` | Page text "vendido", badge |
| `rented` | Page text "alquilado", badge |
| `reserved` | Page text "reservado" |
| `removed` | 404, soft 404, ghost |
| `expired` | Page text "caducado" |

**Market Velocity**: Track days on market per area → "Properties in Salamanca sell in 23 days on average"

**Full Spec**: `LISTING_STATUS_DETECTION.md`

### What We Store

| ✅ STORE | ❌ DON'T STORE |
|----------|----------------|
| HTML pages (537 GB) | Actual images (24 TB) |
| Parsed listing data | Multiple HTML versions |
| **Image URLs** | Downloaded images |
| Analysis results | |
| Scraping rules | |

---

## 5. Recommender

**Purpose**: Match users to properties that support their lifestyle.

**Status**: 🆕 **100% NEW** - Not yet implemented

**Detailed Spec**: `archive/RECOMMENDER_ARCHITECTURE.md`

### How It Works (María Example)

#### Step 1: María Talks to Leo

María describes her life:
- "I work from home full-time and need a proper workspace"
- "My boyfriend visits from Madrid most weekends"
- "I do yoga every morning — need floor space"
- "I love natural light but hate street noise"

Leo extracts a **Life Profile**:

```
María's Life Profile:
├── Anchors: None (remote work) → Sweet spot = all of Barcelona
├── Home Use: WFH (critical), guests (weekly), yoga (daily)
├── Tolerances: Light (must), Noise (dealbreaker)
├── Taste: Character over modern, good bones
├── Appetite: Open to renovation
```

#### Step 2: Free Filtering (SQL)

```
All Barcelona (~20,000)
    → Max price, min sqm (~8,000)
    → Keywords "luminoso", condition (~2,000)
    → Take top 20 diverse candidates
```

**Cost**: €0 (just SQL)

#### Step 3: Geo-Intelligence Check

For each candidate, query the dossier system:

```
Property at Carrer Blai 45:
├── Building match? No (haven't analyzed yet)
├── Street match? YES → "Carrer Blai: noisy weekends (bars)"
├── Neighborhood? YES → "Poble Sec: lively, young"
├── Era pattern? YES → "1960s Barcelona: aluminosis risk"
```

#### Step 4: Whole Property Analysis

For each of the 20 candidates:

```
Already analyzed? → Use cached (FREE)
Not yet? → Run Gemini 3 Pro (~€0.05)
```

Extracts:
- Rooms (size, light, condition)
- Layout (flow, flexibility)
- Potential (WFH, guests, yoga space)
- Building/street observations

#### Step 5: Score Against Life Profile

```
Carrer Blai 45 vs. María:
├── WFH need (critical): "corner_possible" → Partial match
├── Guest sleeping: "sofa_bed_possible" → OK
├── Yoga space: "living_room_clearable" → Good
├── Light (must): "excellent" → Perfect ✅
├── Noise (dealbreaker): Street intel says noisy → FLAG ⚠️

SCORE: 72% match
CONFIDENCE: Medium
```

#### Step 6: Present Recommendations

```
Carrer Blai 45 — 72% match

✅ High confidence: Amazing natural light (south-facing)
✅ High confidence: €1,400/month, under your €1,800 limit
⚠️ Worth checking: Living room could work for WFH
❓ Ask when you visit: Street has bars — check noise weekends
```

### Geo-Intelligence (Dossier System)

Stores everything we learn about locations:

| Type | Example | Radius | Source |
|------|---------|--------|--------|
| Property | "Humidity in bathroom" | 0m | WPA |
| Building | "Pre-1960, old wiring" | 10m | Analysis |
| Street | "Carrer Blai = noisy" | 50m | Analysis |
| Neighborhood | "Poble Sec: young, lively" | 500m | Research |
| Era Pattern | "1960s BCN: aluminosis" | City | Aggregated |

### Schema Evolution Cron

**Weekly (Sundays 2am)**:

1. Aggregate: What are users asking for?
2. Identify gaps: "8 users asked about yoga space"
3. Threshold check: 5+ users → add to schema
4. Update prompt version
5. Queue backfill for popular properties

---

## 6. Analysis (Basic Package)

**Purpose**: Deep property intelligence for viewing preparation.

**Detailed Spec**: `archive/ULTIMATE_PIPELINE.md`

### Triggers

1. User requests viewing → triggers Analysis
2. Professional adds via browser extension → triggers Analysis

### Flow

```
Request → Photo Clustering → Room-by-Room → Viewing Checklist → Observations → Geo-Intel
```

### Pipeline Phases

| Phase | Node | Purpose |
|-------|------|---------|
| 1 | Ingest | Scrape/receive listing data |
| 2 | A-C Text | Extract facts, snippets, unknowns |
| 2.5 | Cadastre | Verify with government data |
| 2.7 | Intelligence | Social radar, street view |
| 3 | D Clustering | Zero-shot photo clustering |
| 3 | F3 WPA | Whole property analysis |
| 3 | Room-by-Room | Detailed room inspection |
| 4 | G Search | Double-barrel Google research |
| 5 | Buyer Report | 3-chapter synthesis |

### Outputs

- Detailed room-by-room analysis
- Condition assessment per room
- What to check on viewing
- Questions for the agent
- Red flags to investigate

### Cost

~€0.15-0.20 per property (Gemini tokens)

### Key Difference from Recommender WPA

| WPA (Recommender) | Analysis (Basic) |
|-------------------|------------------|
| "Is this worth viewing?" | "What should I look for?" |
| Filtering | Preparation |
| Broad signals | Deep detail |

---

## 7. Reno (Renovation Package)

**Purpose**: Full renovation intelligence for purchased properties.

**Detailed Spec**: `archive/ULTIMATE_PIPELINE.md`

### Triggers

- User upgrades to renovation analysis
- Professional requests for client

### Three Tiers

| Tier | Purpose | Scope |
|------|---------|-------|
| **Estándar** | Essential updates | Cosmetic, safety |
| **Óptimo** | Enhanced living | Kitchen/bath upgrade |
| **Plus** | Premium transformation | Full renovation |

### Pipeline Phases

| Phase | Node | Purpose |
|-------|------|---------|
| 6 | Baseline Check | Verify Analysis complete |
| 7.1 | Unified Strategy | Architect's plan |
| 7.2 | J-Reno Research | Double-barrel search |
| 7.3 | Unified Scope | Detailed work items |
| 8 | R1/R2/R3 | Before/after visuals |

### Outputs

- Before/after visualizations
- Cost estimates per tier
- Timeline projections
- Permit requirements
- Contractor considerations

### Cost

~€0.50 per property (includes image generation)

---

## 8. Infrastructure & Costs

> **Verified Nov 2024** - All costs double-checked against AWS pricing calculator.

### AWS vs Supabase Split

| Component | Location | Monthly Cost |
|-----------|----------|--------------|
| **Auth** | Supabase Free | $0 |
| **User Profiles** | Supabase Free | $0 |
| **Life Profiles** | Supabase Free | $0 |
| **Listings (500k)** | AWS DynamoDB (on-demand) | ~$0.50 |
| **HTMLs (60 GB)** | AWS S3 | ~$1.40 |
| **Nominatim DB (60GB)** | AWS EBS gp3 | ~$4.80 |
| **WPA Cache** | AWS DynamoDB | included |
| **Geo-Intelligence** | AWS DynamoDB | included |
| **Lambda Crons** | AWS Lambda | FREE (under free tier) |
| **Analysis (Gemini)** | Google Cloud | per-use (~$0.30/user) |
| **Actual Images** | **NOT STORED** | $0 |
| **TOTAL FIXED** | | **~$7/month** |

### AWS Credits

- **Available**: $1,100
- **Monthly burn**: ~$7
- **Runway**: **157 months (13 years)**

### One-Time Setup Costs (Verified)

| Task | Cost | Status |
|------|------|--------|
| S3 bucket | $0 | ✅ Done |
| DynamoDB tables | $0 | ✅ Done |
| Budget alerts | $0 | ✅ Done |
| EC2 harvest (t3.medium on-demand, 8hr) | ~$0.35 | ⚠️ 19% done |
| Parsing (Mistral Student/Teacher) | ~$25 | ❌ Pending |
| Nominatim import | ~$0.50 | ❌ Pending |
| **Total Setup** | **~$26** | |

### Per-User Variable Costs

| Action | Cost |
|--------|------|
| ElevenLabs intake (2-3 min) | ~$0.10 |
| WPA on 20 properties (Gemini) | ~$0.30 |
| Email notifications | ~$0.001 |
| **Per User Acquisition** | **~$0.40** |

### Data Layer Architecture

**IMPORTANT**: The Analysis/Reno pipeline has **104 endpoints** that currently use Supabase directly.  
See `reference/ENDPOINT_PIPELINE_MAP.md` for complete mapping.

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                             │
├─────────────────────────────────────────────────────────────┤
│  HARVEST ENGINE              ANALYSIS/RENO PIPELINE         │
│       ↓                            ↓                        │
│  DynamoDB                     Supabase (direct)             │
│  (500k listings)              (104 endpoints)               │
│       ↓                            ↓                        │
│  ✅ Works                    ❌ Can't see DynamoDB          │
└─────────────────────────────────────────────────────────────┘
```

**Solution**: Hybrid approach - copy listing to Supabase when Analysis requested.

### DynamoDB Tables (Bulk Data - Harvest)

| Table | Purpose | Status |
|-------|---------|--------|
| `leo-listings` | Core property data | ✅ Created |
| `leo-scraping-rules` | Domain selectors | ✅ Created |
| `leo-crawl-tracking` | Crawl metadata | ✅ Created |
| `leo-wpa-cache` | WPA results cache | ✅ Created |
| `leo-geo-intelligence` | Dossier system | ✅ Created |
| `leo-market-velocity` | Sold/rented analytics | ✅ Created |
| `leo-analysis-cache` | Analysis cache | ✅ Created |

### Supabase Tables (User Data - Analysis/Reno)

**Stay on Supabase Free** (user-facing, small volume):

| Table | Purpose | Migrated? |
|-------|---------|-----------|
| `agents` | Agency info | N/A |
| `user_profiles` | User data | N/A |
| `user_lifestyle_profiles` | Life profiles | N/A |
| Auth tables | Supabase Auth | N/A |
| `text_analysis_results` | Analysis results | Keep |
| `whole_property_analysis` | WPA results | Keep |
| `room_analyses` | Room-by-room | Keep |
| `clusters` | Photo clusters | Keep |
| `renovation_*` | Renovation data | Keep |
| `after_photos` | Generated images | Keep |

### Endpoint Migration Status

| Category | Total | Uses Supabase | Notes |
|----------|-------|---------------|-------|
| **Listings (Analysis/Reno)** | 104 | 101 | Core pipeline |
| **Recommender** | 6 | 5 | Intake/search |
| **Lifestyle** | 5 | 0 | ✅ All migrated |
| **Deepdives** | 5 | 5 | Publishing |
| **Ingest** | 2 | 2 | URL ingestion |
| **AI/Places/Geocoding** | 8 | 2 | Mostly external APIs |
| **Other (Stripe, Cron, etc.)** | 25 | 6 | Various |
| **TOTAL** | **155** | **121** | |

**Migration Priority**:
- 🎯 Critical path (~15 endpoints): Ingest → Text Analysis → Clustering → WPA
- See `reference/ENDPOINT_PIPELINE_MAP.md` for complete mapping

### Cost Protection

- ✅ AWS Budget alert at $30/month
- ✅ IAM deny policy blocks expensive services
- ✅ S3 lifecycle auto-deletes after 90 days
- ✅ EC2 GPU instances blocked
- ✅ Monitoring scripts ready

---

## 9. Data Flow Diagrams

### Complete System Flow

```
                                    ┌──────────────────────────────────────┐
                                    │           USER JOURNEY               │
                                    └──────────────────────────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
            ┌───────────────┐                ┌───────────────┐                ┌───────────────┐
            │    INTAKE     │                │   BROWSING    │                │  EXTENSION    │
            │ Life Profile  │                │ (Searching)   │                │(Professionals)│
            └───────────────┘                └───────────────┘                └───────────────┘
                    │                                 │                                 │
                    ▼                                 │                                 │
            ┌───────────────┐                         │                                 │
            │  RECOMMENDER  │                         │                                 │
            │ Filter 650k   │                         │                                 │
            │ → Shortlist   │                         │                                 │
            │ → WPA         │                         │                                 │
            │ → Score       │                         │                                 │
            └───────────────┘                         │                                 │
                    │                                 │                                 │
                    └─────────────────────────────────┼─────────────────────────────────┘
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │   ANALYSIS    │
                                              │ Viewing Prep  │
                                              │       │       │
                                              │       ▼       │
                                              │ Observations  │──────┐
                                              └───────────────┘      │
                                                      │              │
                                                      ▼              ▼
                                              ┌───────────────┐  ┌───────────────┐
                                              │     RENO      │  │ GEO-INTEL     │
                                              │ (If upgraded) │  │ (Flywheel)    │
                                              └───────────────┘  └───────────────┘
                                                                         │
                                                                         ▼
                                                                 ┌───────────────┐
                                                                 │  RECOMMENDER  │
                                                                 │  Gets Smarter │
                                                                 └───────────────┘
```

### Cron Job Schedule

| Time | Job | Purpose |
|------|-----|---------|
| 03:00 | `daily-harvest` | Sitemap delta check |
| 03:30 | `crawl-no-sitemap` | Light re-spider |
| 04:30 | `daily-parse` | Parse new HTMLs |
| 05:00 | `detect-listing-status` | Sold/rented/removed |
| 06:00 | `daily-report` | Stats email |
| Sundays 02:00 | `schema-evolution` | Expand WPA fields |

---

## 10. What Needs Building

> **Updated Nov 30, 2024**

### Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Analysis Pipeline | ✅ EXISTS | - |
| Reno Pipeline | ✅ EXISTS | - |
| Harvest scripts | ✅ EXISTS | Needs parallelization for resume |
| AWS DynamoDB tables | ✅ DONE | 7 tables created |
| AWS S3 bucket | ✅ DONE | 7GB / 319k files |
| Initial crawl | ⚠️ 19% DONE | Spot interrupted, need resume |
| Parsing pipeline | ❌ BLOCKED | Waiting for harvest |
| Daily crons | ❌ BLOCKED | Waiting for parsing |
| **Recommender Intake** | ✅ DONE | Voice/chat with ElevenLabs |
| **Recommender Geocoding** | ✅ DONE | Nominatim self-hosted ready |
| Recommender Filter | ❌ BLOCKED | Need parsed listings |
| Auth (Supabase) | ❌ TODO | - |
| Homepage UI | ❌ TODO | - |
| Dashboard UI | ❌ TODO | - |

### Immediate Next Steps

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Resume harvest (t3.medium on-demand, parallelized) | 6-8 hrs | Ready |
| 2 | Start Nominatim import | 2-3 hrs | Ready |
| 3 | Build parsing pipeline (Student/Teacher) | 1 day | Code needed |
| 4 | Run initial parse | 4-6 hrs | After #3 |
| 5 | Set up daily crons | 2 hrs | After #4 |

### Recommender Build Progress

| Step | Task | Status |
|------|------|--------|
| 1 | Intake → Life Profile | ✅ DONE (ElevenLabs + Supabase) |
| 2 | Delivery preference | ✅ DONE (email/WhatsApp) |
| 3 | Sweet spot generation | ⚠️ READY (Nominatim setup done) |
| 4 | Parsed data filter | ❌ BLOCKED (need parsed data) |
| 5 | WPA on shortlist | ❌ TODO |
| 6 | Scoring against Life Profile | ❌ TODO |
| 7 | Geo-Intelligence dossier | ❌ TODO |
| 8 | Schema Evolution cron | ❌ TODO |
| 9 | Daily user notification cron | ❌ TODO |

---

## 11. TBC: Future Work

### Pipeline Variations: Renter vs Buyer

| Node | Buyer | Renter (TBC) |
|------|-------|--------------|
| Final Scope | Purchase, legal, mortgage | Lease, deposit, contract |
| Checklist | Structural, reno potential | Furniture, appliances |
| Red Flags | Structural, permits | Lease traps, noise |

### Integrations (via MCP)

| Integration | Purpose |
|-------------|---------|
| ElevenLabs | Voice AI for intake |
| Resend | Transactional emails |
| WhatsApp | User notifications |
| Stripe | Payments |

### Market Analytics

| Feature | Purpose |
|---------|---------|
| Days on Market | Avg sell time by area |
| Fast Market Badge | Alert when area is hot |
| Watchlist Alerts | Notify when saved property sells |
| Sold Price History | Comparable sales data |

### UI Work

| Component | Status |
|-----------|--------|
| Homepage | 🆕 TODO |
| Property page | ✅ EXISTS |
| Recommendations feed | 🆕 TODO |
| Onboarding flow | 🆕 TODO |
| User dashboard | 🆕 TODO |
| Agent dashboard | 🆕 TODO |

---

## Reference Documents

For implementation details, see:

| Document | Purpose |
|----------|---------|
| `archive/HARVEST_ENGINE_ARCH.md` | Complete harvest implementation |
| `archive/RECOMMENDER_ARCHITECTURE.md` | Full recommender design |
| `archive/ULTIMATE_PIPELINE.md` | Analysis & Reno endpoints |
| `reference/ENDPOINT_PIPELINE_MAP.md` | **All 104 endpoints mapped to pipeline phases** |
| `LISTING_STATUS_DETECTION.md` | Sold/rented detection spec |
| `WHAT_LEO_LEARNS.md` | Life Profile schema |
| `SEARCHABLE_CAPABILITIES.md` | Filterable fields |
| `PIPELINE_STATUS.md` | Current system status |

---

*This is the master architecture document. All other architecture docs are archived for reference.*

