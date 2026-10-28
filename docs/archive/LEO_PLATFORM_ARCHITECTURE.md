# Leo Platform Architecture

> Master overview of how Leo's systems work together

## The Four Pillars

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

---

## 1. HARVEST ENGINE

**Purpose**: Build and maintain the Spanish property data lake

**Flow**:
```
3,635 Domains → Sitemap/Crawl → HTML Storage (S3) → Parsing → Structured Data (DynamoDB)
```

**Components**:
- **Initial Crawl**: ~40 hours, ~650k URLs → S3
- **Daily Cron**: Detect new/updated listings via sitemap `lastmod`
- **Student/Teacher Parsing**: Bedrock learns selectors, Cheerio executes
- **Validation Loop**: 10 consecutive successes → graduate to pure Cheerio

**Outputs**:
- `listings` table: title, price, m2, beds, baths, balcony, image_urls, etc.
- `scraping_rules` table: domain selectors (learned)
- Raw HTMLs in S3 (for re-parsing if schema changes)

**Detailed Doc**: [HARVEST_ENGINE_ARCH.md](./HARVEST_ENGINE_ARCH.md)

---

## 2. RECOMMENDER

**Purpose**: Match users to properties that support their lifestyle

**Flow**:
```
User Intake → Life Profile → Parsed Data Filter → Shortlist (~20-50) → WPA → Score → Recommend
```

**Key Insight**: WPA runs on the **shortlist only**, not all 650k listings!

### 2.1 Intake
- Guided conversation about lifestyle goals
- Outputs: Life Profile (needs, deal-breakers, sweet spot)

### 2.2 Parsed Data Filter (Fast, Free)
- Location (sweet spot radius)
- Price range
- Beds, baths
- Basic amenities (from parsed data)
- **Result**: 20-50 candidate properties

### 2.3 WPA (Whole Property Analysis)
- Run Gemini on shortlist photos
- Extract lifestyle-relevant signals:
  - Natural light quality
  - WFH potential
  - Guest sleeping options
  - Outdoor space
  - Storage capacity
- **Versioned & Cached**: Reuse if already analyzed

### 2.4 Scoring
- Match WPA signals against Life Profile
- Confidence levels: ✅ Strong / ⚠️ Possible / ❌ Unlikely
- Ranking with explanations

### 2.5 Geo-Intelligence (Dossier System)
- Building/street/neighborhood knowledge
- Grows from Analysis observations (the Flywheel)
- Enables smarter filtering over time
- See detailed section below

### 2.6 Schema Evolution Cron (Weekly)
- Aggregate what users are asking for
- Identify gaps in WPA extraction
- Update prompt, queue backfill of shortlist properties

**Detailed Doc**: [RECOMMENDER_ARCHITECTURE.md](./RECOMMENDER_ARCHITECTURE.md)

---

## 3. ANALYSIS (Basic Package)

**Purpose**: Deep property intelligence for viewing preparation

**Triggers**:
1. User requests viewing → triggers Analysis
2. Professional adds via browser extension → triggers Analysis

**Flow**:
```
Request → Photo Clustering → Room-by-Room Analysis → Viewing Checklist → Observations → Geo-Intelligence
```

**Outputs**:
- Detailed room analysis
- Condition assessment
- What to check on viewing
- Questions for the agent
- Red flags to investigate

**Key Difference from WPA**:
- WPA: "Is this worth viewing?" (filtering)
- Analysis: "What should I look for?" (preparation)

**Detailed Doc**: [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) - Basic Package section

---

## 4. RENO (Renovation Package)

**Purpose**: Full renovation intelligence for purchased properties

**Triggers**:
- User upgrades to renovation analysis
- Professional requests for client

**Flow**:
```
Analysis Output → Tier Generation → Before/After → Scope → Timeline → Permits
```

**Tiers**:
- **Estándar**: Essential updates
- **Óptimo**: Enhanced living
- **Plus**: Premium transformation

**Outputs**:
- Before/after visualizations
- Cost estimates
- Timeline projections
- Permit requirements
- Contractor considerations

**Detailed Doc**: [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) - Renovation Package section

---

## The Flywheel: How Analysis Makes Recommender Smarter

**This is the core feedback loop of the platform.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE FLYWHEEL                                        │
│                                                                             │
│  ANALYSIS runs → Extracts OBSERVATIONS → Feeds GEO-INTELLIGENCE             │
│       ↑                                              │                      │
│       │                                              ▼                      │
│       │                                   RECOMMENDER can now:              │
│       │                                   • Search for more categories      │
│       │                                   • Have higher confidence          │
│       │                                   • Know about buildings/streets    │
│       │                                              │                      │
│       │                                              ▼                      │
│       │                                   Better recommendations            │
│       │                                              │                      │
│       └──────────────────────────────────────────────┘                      │
│                     More users request viewings                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Feeds Geo-Intelligence

| Source | What It Extracts | Example |
|--------|------------------|---------|
| **WPA** | `building_observations`, `street_observations` | "Pre-war building, original tiles visible" |
| **Basic Pipeline** | Deep room condition, detailed findings | "Humidity in bathroom, 1960s wiring" |
| **Cadastre** | Building year, official area, construction type | "Built 1965, 95m² official" |

### What Geo-Intelligence Enables

| Before Flywheel | After Flywheel |
|-----------------|----------------|
| Can only filter by parsed data | Can filter by analyzed attributes |
| Don't know about buildings | Know specific buildings have issues |
| Generic street info | Know "Carrer Blai = noisy weekends" |
| Guess at era patterns | Know "1960s Barcelona = aluminosis risk" |

### Growth Over Time

| Analyses Run | What Recommender Can Do |
|--------------|-------------------------|
| 0 | Filter by price, beds, location only |
| 100 | Era patterns emerging (30% confidence) |
| 1,000 | Most neighborhoods known (50% confidence) |
| 10,000 | Street-level intelligence in hot areas (70%) |
| 50,000 | Building-level knowledge common (85%) |

**The more Analysis runs, the smarter Recommender gets. This is the Flywheel.**

---

## Critical Architecture: Fetch-and-Dump for Photo Analysis

**This saves us 24TB of storage and ~$550/month.**

### The Problem
- 650k listings × 60 photos × 300KB = **24 TB of images**
- S3 cost at that scale: ~$550/month
- We can't afford to store all images

### The Solution: Fetch-and-Dump

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FETCH-AND-DUMP PATTERN                                  │
│                                                                             │
│  HARVEST (once):                                                            │
│  ├── Parse HTML                                                             │
│  ├── Extract image URLs (store the URLs, NOT the images)                    │
│  └── Store: { listing_id, image_urls: ["https://agency.com/photo1.jpg"...] }│
│                                                                             │
│  ANALYSIS (on-demand):                                                      │
│  ├── User requests viewing OR property enters shortlist                     │
│  ├── FETCH: Download images from original agency URLs                       │
│  ├── SEND: Pass images to Gemini for analysis                               │
│  ├── STORE: Save analysis results (WPA, room analysis, etc.)                │
│  └── DUMP: Don't keep the images, they're still on agency servers           │
│                                                                             │
│  RESULT:                                                                    │
│  ├── Storage: 537 GB (HTMLs) instead of 24 TB (images)                      │
│  ├── Cost: ~$12/mo instead of ~$550/mo                                      │
│  └── Images: Always fresh from source when needed                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What We Store vs. Don't Store

| ✅ STORE | ❌ DON'T STORE |
|----------|----------------|
| HTML pages (537 GB) | Actual images (24 TB) |
| Parsed listing data | Multiple HTML versions |
| **Image URLs** | Downloaded images |
| Analysis results (WPA, room) | Raw Gemini responses |
| Scraping rules | |

### Trade-offs

| Pro | Con |
|-----|-----|
| Saves $550+/month | Agency might delete images |
| Images always fresh | Slight latency on analysis |
| No storage scaling issues | Depends on external URLs |

**Mitigation**: For high-value analyses (Reno), we can optionally cache images temporarily in S3 during the analysis session.

---

## Infrastructure Split

| Component | Location | Cost |
|-----------|----------|------|
| **Auth** | Supabase Free | $0 |
| **User Profiles** | Supabase Free | $0 |
| **Life Profiles** | Supabase Free | $0 |
| **Listings (650k)** | AWS DynamoDB | ~$5/mo |
| **HTMLs (537 GB)** | AWS S3 | ~$12/mo |
| **Image URLs** | AWS DynamoDB | included (just strings) |
| **Scraping Rules** | AWS DynamoDB | included |
| **WPA Cache** | AWS DynamoDB | ~$1/mo |
| **Geo-Intelligence** | AWS DynamoDB | ~$1/mo |
| **Parsing (Bedrock)** | AWS Bedrock | ~$1/mo |
| **Analysis (Gemini)** | Google Cloud | per-use |
| **Actual Images** | **NOT STORED** | $0 (fetch on-demand) |

**Total Fixed Cost**: ~$19/month (covered by $1,100 AWS credits for 4.5 years)

---

## Data Flow Diagram

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
            │ Life Profile  │                │ (Searching)   │                │ (Professionals)│
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

---

## Cron Jobs

| Job | Frequency | Purpose | Location |
|-----|-----------|---------|----------|
| **Daily Harvest** | Daily 3am | Check sitemaps for new/updated listings | AWS Lambda |
| **Daily Parse** | Daily 4am | Parse any new HTMLs | AWS Lambda |
| **Schema Evolution** | Weekly | Expand WPA fields based on user demand | AWS Lambda |
| **Selector Repair** | Daily | Fix broken domain selectors | AWS Lambda |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [HARVEST_ENGINE_ARCH.md](./HARVEST_ENGINE_ARCH.md) | Complete harvest system (HTML, parsing, crons) |
| [RECOMMENDER_ARCHITECTURE.md](./RECOMMENDER_ARCHITECTURE.md) | Intake, filtering, WPA, scoring, Geo-Intelligence |
| [ULTIMATE_PIPELINE.md](./ULTIMATE_PIPELINE.md) | Analysis (Basic) + Renovation packages |
| [WHAT_LEO_LEARNS.md](../parked/WHAT_LEO_LEARNS.md) | Life Profile schema |
| [SEARCHABLE_CAPABILITIES.md](../parked/SEARCHABLE_CAPABILITIES.md) | What we filter without AI |
| [PIPELINE_STATUS.md](../parked/PIPELINE_STATUS.md) | Current system status |

---

## Key Principles

1. **WPA is expensive** → Only run on shortlists (~50 properties), not all 650k
2. **Parsed data is free** → Use it for broad filtering first
3. **Cache everything** → Don't re-analyze unnecessarily
4. **Schema evolves** → Start simple, expand based on user demand
5. **Flywheel compounds** → Analysis observations grow Geo-Intelligence → Recommender gets smarter
6. **Building intel grows** → The more we analyze, the more categories we can search for

---

*Last Updated: 2025-01-28*

