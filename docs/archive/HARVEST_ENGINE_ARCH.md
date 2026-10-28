# 🚜 HarvestEngine - Complete Architecture

> **Goal**: Build a self-healing scraper that archives ALL Spanish real estate listings (~550k active) to serve any customer in Spain with comprehensive property intelligence.

**Last Updated**: 2025-01-28  
**Master Doc**: [LEO_PLATFORM_ARCHITECTURE.md](./LEO_PLATFORM_ARCHITECTURE.md)

> **Where This Fits**: Harvest Engine is **Pillar 1 of 4**. It provides all listing data to the Recommender and Analysis pipelines. See master doc for how the 4 pillars connect.

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Journey](#2-the-journey)
3. [Market Size](#3-market-size)
4. [Core Philosophy: Student/Teacher with Validation](#4-core-philosophy-studentteacher-with-validation)
5. [Architecture](#5-architecture)
6. [Cost Analysis](#6-cost-analysis)
7. [AWS vs Supabase (Final Split)](#7-aws-vs-supabase-final-split)
8. [Storage Strategy](#8-storage-strategy)
9. [Phase 1: Initial Full Crawl](#9-phase-1-initial-full-crawl)
10. [Phase 2: Daily Delta Updates](#10-phase-2-daily-delta-updates)
11. [Data Structures](#11-data-structures)
12. [Step-by-Step Implementation Guide](#12-step-by-step-implementation-guide)
13. [Scripts & Files](#13-scripts--files)

---

## 1. Overview

### What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│  3,635 Real Estate Agency Websites                             │
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │donpiso  │ │century21│ │tecnocasa│ │ idealista│ ... (3,631) │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Daily Crawl
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HARVEST ENGINE                               │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Crawler    │───▶│    Parser    │───▶│   Analyzer   │     │
│  │ (fetch HTML) │    │(Student Mode)│    │(on-demand AI)│     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       STORAGE                                   │
│                                                                 │
│  AWS S3              AWS DynamoDB         Supabase             │
│  ┌──────────┐       ┌──────────────┐     ┌──────────────┐     │
│  │ HTML     │       │  Listings    │     │  Auth        │     │
│  │ Archive  │       │  Analysis    │     │  Profiles    │     │
│  │ 537 GB   │       │  Tracking    │     │              │     │
│  └──────────┘       └──────────────┘     └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| HTML Storage | AWS S3 | $0.023/GB, uses $1,100 credits |
| Listing Database | AWS DynamoDB | Pay-per-query, scales to millions |
| Analysis Cache | AWS DynamoDB | Too big for Supabase Free (500 MB) |
| **Image Storage** | **Don't store — Fetch-and-Dump** | **Saves 24TB → 0TB ($550/mo saved)** |
| Auth & Profiles | Supabase Free | 50k MAUs free, easy setup |
| Parsing LLM | AWS Bedrock (Mistral 7B) | Cheapest, uses AWS credits |
| Initial Crawl | AWS EC2 Spot | $0.50 for 40 hours |
| Monthly Cost | **$0 out of pocket** | AWS credits cover everything |

### 📸 Critical: Fetch-and-Dump for Photos

**We store image URLs, NOT actual images.**

```
HARVEST:
├── Parse HTML
├── Extract image URLs
└── Store: { listing_id, image_urls: ["https://agency.com/photo1.jpg", ...] }

ANALYSIS (when needed):
├── FETCH: Download images from original agency URLs
├── SEND: Pass to Gemini (WPA, clustering, room analysis)
├── STORE: Save analysis results only
└── DUMP: Don't keep images — they're still on agency servers
```

**Why?**
- 650k × 60 photos × 300KB = **24 TB** = ~$550/month
- With Fetch-and-Dump: **$0** image storage
- Images always fresh from source
- Trade-off: Slight latency, depends on agency keeping URLs alive

---

## 2. The Journey

### What We Did

```
Step 1: Domain Discovery
─────────────────────────────────────────────────────────
• Started with 3,635 agency domains from MASTER_AGENCY_LIST.csv
• Discovered which have sitemaps (1,087) vs don't (2,548)
• Classified URL patterns: Sale, Rent, Both, Unknown

Step 2: URL Pattern Analysis
─────────────────────────────────────────────────────────
• Regex-based classification: 62% success
• Enhanced patterns: 66% success
• Gemini bulk analysis: 92% success
• Homepage analysis for broken sitemaps: 99.3% classified!

Step 3: Market Sizing (from Idealista)
─────────────────────────────────────────────────────────
• Scraped Idealista's province-by-province counts
• For Sale: 470,894 listings
• For Rent: 77,498 listings
• TOTAL: 548,392 active listings in Spain

Step 4: Cost Analysis
─────────────────────────────────────────────────────────
• Calculated storage: 550k × 1MB = 537 GB
• Calculated tokens: ~25k tokens per cleaned HTML
• AWS vs Supabase comparison: AWS is 49% cheaper
• PLUS: $1,100 AWS credits = 5+ years free!

Step 5: Architecture Design
─────────────────────────────────────────────────────────
• Student/Teacher model with 10-validation trust loop
• Mistral 7B on Bedrock for cheap LLM calls
• Hybrid: AWS for scale, Supabase for auth
```

---

## 3. Market Size

### Spain Real Estate (from Idealista, Nov 2025)

| Type | Count |
|------|-------|
| 🏠 **For Sale** | **470,894** |
| 🔑 **For Rent** | **77,498** |
| **TOTAL** | **548,392** |

### Regional Breakdown (Top 10)

| Region | For Sale | For Rent |
|--------|----------|----------|
| Comunidad Valenciana | 81,265 | 13,429 |
| Cataluña | 85,633 | 8,636 |
| Andalucía | 103,933 | 20,084 |
| Madrid | 27,384 | 11,910 |
| Baleares | 23,453 | 4,584 |
| Canarias | 17,023 | 2,797 |
| Murcia | 16,746 | 2,208 |
| Galicia | 22,787 | 3,467 |
| País Vasco | 8,706 | 1,159 |
| Asturias | 8,351 | 1,489 |

### Market Dynamics

```
• ~1,000,000 properties sold per year in Spain
• Average listing lifespan: ~6 months
• Daily new listings: ~2,700
• Daily sold/removed: ~2,700
• Daily churn: ~5,500 listings (1% of total)
```

---

## 4. Core Philosophy: Student/Teacher with Validation

### The Problem with Simple Scraping

```
Traditional approach:
❌ Write selectors manually for each site
❌ Selectors break when sites update
❌ No way to detect silent failures
❌ Expensive to maintain 3,635 domains
```

### Our Solution: Learn Once, Validate, Run Free

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: LEARNING (Teacher Mode)                               │
│                                                                 │
│  LLM (Mistral 7B on Bedrock):                                  │
│  "Here's cleaned HTML from donpiso.com                          │
│   What CSS selectors extract price, beds, sqm?"                │
│                                                                 │
│  Output: { price: '.precio', beds: '.habitaciones', ... }      │
│  Cost: ~$0.004 per domain                                      │
│  Status: trust_level = 0                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: VALIDATION (Student + Teacher verifies)              │
│                                                                 │
│  For each listing:                                             │
│    1. Cheerio extracts with selectors                          │
│       → { price: '€450,000', beds: '3', sqm: '120' }          │
│                                                                 │
│    2. LLM validates: "Is this correct?"                        │
│       → { correct: true }                                      │
│                                                                 │
│    3. If correct: trust_level++                                │
│       If wrong: trust_level = 0, re-learn                      │
│                                                                 │
│  Continue until trust_level >= 10                              │
│  Cost: ~$0.0001 per validation                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 10 consecutive successes
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: TRUSTED (Pure Student Mode - FREE)                   │
│                                                                 │
│  Status: trust_level >= 10 (GRADUATED 🎓)                      │
│  Cheerio runs alone, no LLM validation                         │
│  Cost: $0.00 forever                                           │
│                                                                 │
│  If failures detected later: demote back to Phase 2            │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Works

| Aspect | Benefit |
|--------|---------|
| **Self-healing** | Detects when selectors break |
| **Cost-efficient** | LLM only runs during learning |
| **Scalable** | Handles 3,635 domains |
| **Accurate** | Validates before trusting |
| **Maintainable** | No manual selector updates |

---

## 5. Architecture

### Hybrid: AWS for Scale, Supabase for Auth

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Next.js App                                            │   │
│  │  • User interface                                        │   │
│  │  • Search & browse listings                             │   │
│  │  • Property details & analysis                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────────┐
│       SUPABASE          │         │            AWS              │
│     (Keep existing)     │         │      (Use $1,100 credits)   │
│                         │         │                             │
│  • User auth            │         │  S3: HTML archive (537 GB)  │
│  • User profiles        │         │  DynamoDB: Listings data    │
│  • Preferences          │         │  Bedrock: Mistral 7B LLM    │
│  • Saved searches       │         │  Lambda: Crawl/parse jobs   │
│  • Small app data       │         │  EventBridge: Cron schedule │
│                         │         │                             │
│  Cost: $25/month        │         │  Cost: $17/month            │
│  (already paying)       │         │  (covered by credits)       │
└─────────────────────────┘         └─────────────────────────────┘
```

### AWS Services Used

| Service | Purpose | Cost |
|---------|---------|------|
| **S3** | Store 537 GB of HTML files | $12.35/mo |
| **DynamoDB** | Fast queries, listings data | $2.50/mo |
| **Bedrock** | Mistral 7B for Student/Teacher | $0.87/mo |
| **Lambda** | Run crawl/parse code | Free tier |
| **EventBridge** | Schedule cron jobs | Free |
| **EC2 Spot** | Initial 40-hour crawl | ~$0.50 one-time |

---

## 6. Cost Analysis

### Month 1 (Initial Setup)

| Item | Cost |
|------|------|
| S3 Storage (537 GB) | $12.35 |
| S3 Requests | $0.50 |
| DynamoDB Storage (12 GB) | $3.00 |
| DynamoDB R/W (~6M requests) | $2.50 |
| Learning (3,635 domains × 25k tokens) | $13.99 |
| Validation (10× each) | $3.45 |
| **TOTAL** | **$35.79** |
| Budget | $100 |
| ✅ Under budget by | $64.21 |

### Month 2+ (Ongoing)

| Item | Cost |
|------|------|
| S3 Storage (537 GB) | $12.35 |
| S3 Requests (~100k/month) | $0.50 |
| DynamoDB Storage (12 GB) | $3.00 |
| DynamoDB R/W (~6M requests) | $2.50 |
| Bedrock repairs (5% domains) | $0.87 |
| Lambda (cron jobs) | $0.00 |
| EventBridge (scheduler) | $0.00 |
| **TOTAL** | **$19.22** |
| Budget | $30 |
| ✅ Under budget by | $10.78 |

### With $1,100 AWS Credits

```
Month 1:     $35.79
Month 2-55: $19.22 × 54 = $1,037.88
Total:       $1,073.67

Remaining credits: $26.33

Total coverage: 55 months = 4.5 years!
```

### Cost Breakdown by Operation

| Operation | Tokens | Cost per Call | Total (all domains) |
|-----------|--------|---------------|---------------------|
| Learning (25k tokens) | 25,000 in / 500 out | $0.00385 | $13.99 |
| Validation (500 tokens) | 500 in / 100 out | $0.000095 | $3.45 |
| Daily parsing | 0 (Cheerio) | $0.00 | $0.00 |

---

## 7. AWS vs Supabase (Final Split)

### The Decision: Supabase FREE + AWS

Since we're on **Supabase Free** (500 MB database limit), we maximize AWS usage:

| Data Type | Size | Where | Why |
|-----------|------|-------|-----|
| User profiles | ~15 MB | Supabase Free | Fits in 500 MB |
| Auth | - | Supabase Free | 50k MAUs free |
| Saved searches | ~5 MB | Supabase Free | User data |
| Parsed listings | ~10 GB | AWS DynamoDB | Too big for free |
| WPA cache | ~1 GB | AWS DynamoDB | Too big for free |
| Geo-Intelligence | ~100 MB | AWS DynamoDB | Too big for free |
| HTML archive | 537 GB | AWS S3 | Bulk storage |
| Scraping rules | ~10 MB | AWS DynamoDB | Part of pipeline |

### Final Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE FREE ($0/month)                                       │
│                                                                 │
│  Only lightweight user-facing data:                            │
│  ├── Auth (login, signup, OAuth) - 50k MAUs free              │
│  ├── User profiles & Life Profiles (~10 KB each)              │
│  ├── Saved searches & favorites                                │
│  └── User feedback                                              │
│                                                                 │
│  Usage: ~15 MB / 500 MB limit = plenty of room                 │
│                                                                 │
│  ⚠️ Note: Free projects pause after 1 week inactivity          │
│     Solution: Daily Lambda ping keeps it alive                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AWS (~$20/month - covered by $1,100 credits for 4.5 years)    │
│                                                                 │
│  S3 (537 GB):                                                  │
│  └── HTML archive (550k listing pages)                         │
│                                                                 │
│  DynamoDB (~12 GB):                                            │
│  ├── Parsed listings (550k records)                            │
│  │   └── price, beds, sqm, features, image URLs, etc.         │
│  ├── WPA cache (Whole Property Analysis results)               │
│  ├── Geo-Intelligence (dossier system)                         │
│  ├── Basic Pipeline results                                    │
│  └── Scraping rules (3,635 domains)                            │
│                                                                 │
│  Bedrock (Mistral 7B):                                         │
│  └── Student/Teacher parsing (learning + validation)           │
│                                                                 │
│  Lambda + EventBridge:                                         │
│  └── Daily cron jobs (free tier)                               │
└─────────────────────────────────────────────────────────────────┘
```

### Monthly Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Supabase Free | $0 | Auth + user data only |
| AWS S3 | $12.85 | 537 GB + requests |
| AWS DynamoDB | $5.50 | 12 GB + read/write |
| AWS Bedrock | $0.87 | Monthly repairs only |
| AWS Lambda | $0.00 | Free tier |
| **TOTAL** | **$19.22** | **Covered by credits** |

### Effective Cost

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  OUT OF POCKET:  $0/month                                      │
│                                                                 │
│  Supabase Free:  $0                                            │
│  AWS Credits:    $1,100 → covers 55 months                     │
│                                                                 │
│  TOTAL: $0/month for 4.5 years!                                │
│                                                                 │
│  When to upgrade Supabase to Pro ($25/month):                  │
│  • When you have paying users                                  │
│  • When 500 MB gets tight                                      │
│  • When you want email support                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Storage Strategy

### What We Store

```
✅ STORE (Cheap, valuable)
├── HTML pages (537 GB compressed) ...... $12.35/mo (S3)
├── Structured data (10 GB) ............ $2.50/mo (DynamoDB)
├── Image URLs (NOT actual images!) .... 0 GB
├── Scraping rules (per domain) ........ <1 MB
└── TOTAL .............................. ~$15/mo

❌ DON'T STORE (Expensive, redundant)
├── Actual images (60 per listing)
│   └── 550k × 60 × 300KB = 10 TB = $230/month
│   └── INSTEAD: Fetch on-demand from agency websites
└── Multiple HTML versions (keep only latest)
```

### S3 Bucket Structure

```
s3://puedo-casa-html-archive/

├── html/                           # Raw HTML archive
│   ├── donpiso.com/
│   │   ├── venta_madrid_123.html.gz
│   │   └── ...
│   ├── idealista.com/
│   └── ... (3,000+ domain folders)
│
├── data/                           # Structured exports
│   ├── listings/
│   └── rules/
│
└── logs/                           # Crawl logs
```

### HTML Cleaning (Before LLM)

```typescript
function smartClean(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove noise (keeps structure, removes bloat)
  $('script, style, svg, noscript, iframe').remove();
  $('nav, footer, header').remove();
  $('[class*="cookie"], [class*="banner"]').remove();
  $('[class*="popup"], [class*="modal"]').remove();
  
  // Remove attributes that add tokens but no value
  $('*').removeAttr('data-*');
  $('*').removeAttr('onclick');
  $('*').removeAttr('style');
  
  // Get cleaned HTML
  let clean = $('body').html() || '';
  
  // Truncate if still too large (~25k tokens ≈ 100k chars)
  if (clean.length > 100000) {
    clean = clean.substring(0, 100000);
  }
  
  return clean;
}
```

**Result**: 1MB HTML → ~25k tokens (75% reduction)

---

## 9. Phase 1: Initial Full Crawl

### Overview

| Aspect | Detail |
|--------|--------|
| **Purpose** | Get ALL existing listings into our system |
| **Duration** | ~40 hours |
| **Runs on** | AWS EC2 Spot Instance |
| **Cost** | ~$0.50 total |
| **Frequency** | One time only |

### Step 1A: Sitemap Domains (1,087 domains) - 6 hours

```
For each domain:
    1. Fetch sitemap.xml (or sitemap_index.xml)
    2. Extract all URLs
    3. Filter: Keep only listing URLs
       ✅ /venta/, /alquiler/, /inmueble/, /property/
       ❌ /blog/, /contact/, /about/, /legal/
    4. Download each listing HTML
    5. Compress with gzip
    6. Upload to S3: html/{domain}/{path}.html.gz
    7. Log to DynamoDB: crawl_tracking table

Output: ~350,000 listing HTML files (~350 GB)
```

### Step 1B: No-Sitemap Domains (2,548 domains) - 30 hours

```
For each domain:
    1. Visit homepage: https://agency.com/
    2. Extract all links from HTML
    3. Identify promising paths:
       - /propiedades, /inmuebles, /listings
       - /venta, /alquiler, /comprar
    4. Visit listing index pages
    5. Find pagination: ?page=2, ?page=3...
    6. Extract individual listing URLs
    7. Download each listing HTML
    8. Upload to S3

Output: ~200,000 listing HTML files (~200 GB)
```

### Step 1C: Learn Selectors for All Domains - 4 hours

```
For each domain:
    1. Pick a sample listing HTML
    2. Clean HTML (remove scripts, styles, nav)
    3. Send to Mistral 7B (Bedrock):
       "What CSS selectors extract price, beds, sqm?"
    4. Save selectors to DynamoDB: scraping_rules table
    5. Validate 10 listings with LLM
    6. If 10 pass: mark as GRADUATED
    7. If any fail: re-learn and retry

Output: 3,635 domains with learned selectors
```

---

## 10. Phase 2: Daily Delta Updates

### Overview

| Aspect | Detail |
|--------|--------|
| **Purpose** | Find NEW and CHANGED listings |
| **Duration** | ~30-60 minutes |
| **Runs on** | AWS Lambda (free tier) |
| **Cost** | Free |
| **Frequency** | Daily at 3:00 AM |

### Cron Schedule

```
⏰ 03:00 AM  Lambda: crawl-sitemap-delta
             Check sitemaps for new lastmod dates
             Download ~3,000 new/changed pages
             Time: ~15 minutes

⏰ 03:30 AM  Lambda: crawl-no-sitemap-delta  
             Light re-spider of no-sitemap domains
             Check first pages for new listings
             Time: ~30 minutes

⏰ 04:30 AM  Lambda: parse-new-html
             Parse today's new HTML files with Cheerio
             Update DynamoDB listings
             Time: ~10 minutes

⏰ 05:00 AM  Lambda: detect-removed-listings
             Check for 404s on known URLs
             Mark listings as "removed"
             Time: ~20 minutes

⏰ 06:00 AM  Lambda: generate-daily-report
             New/removed listings count
             Errors encountered
             Send to admin
```

### Delta Detection

```
Sitemap domains (1,087):
─────────────────────────────────────────────────────────
• Check <lastmod> dates in sitemap.xml
• Compare to stored lastmod
• Download only URLs with new dates
• Efficient: ~100 KB sitemap vs ~350 GB HTML

No-sitemap domains (2,548):
─────────────────────────────────────────────────────────
• Visit listing index pages (first 2-3 pages)
• Look for new listing URLs
• Compare to stored URLs
• Download new ones only
```

---

## 11. Data Structures

### DynamoDB: `listings` Table

```javascript
{
  "domain": "donpiso.com",           // Partition key
  "listing_id": "venta_madrid_123",  // Sort key
  "url": "https://donpiso.com/venta/piso/123",
  "price": 250000,
  "bedrooms": 3,
  "bathrooms": 2,
  "sqm": 120,
  "city": "Madrid",
  "neighborhood": "Salamanca",
  "listing_type": "sale",            // sale | rent
  "property_type": "apartment",
  "image_urls": [
    "https://donpiso.com/img/123_1.jpg",
    "https://donpiso.com/img/123_2.jpg"
    // ... (60 URLs, NOT actual images)
  ],
  "s3_path": "html/donpiso.com/venta_123.html.gz",
  "crawled_at": "2025-11-28T03:00:00Z",
  "parsed_at": "2025-11-28T05:00:00Z",
  "status": "active"                 // active | removed
}
```

### DynamoDB: `scraping_rules` Table

```javascript
{
  "domain": "donpiso.com",           // Partition key
  "selectors": {
    "item_selector": ".property-card",
    "link_selector": "a.details-link",
    "fields": {
      "price": ".price",
      "title": "h1.title",
      "beds": ".habitaciones",
      "sqm": ".metros"
    }
  },
  "trust_level": 10,                 // 0-10, graduated at 10
  "status": "graduated",             // learning | validating | graduated
  "last_success": "2025-11-28T03:00:00Z",
  "failure_count": 0,
  "version": 3
}
```

### DynamoDB: `crawl_tracking` Table

```javascript
{
  "domain": "donpiso.com",           // Partition key
  "has_sitemap": true,
  "sitemap_url": "https://donpiso.com/sitemap.xml",
  "last_full_crawl": "2025-11-28T03:00:00Z",
  "last_delta_crawl": "2025-11-29T03:00:00Z",
  "listings_count": 1523,
  "listings_added_today": 45,
  "listings_removed_today": 12,
  "status": "healthy"                // healthy | error | blocked
}
```

---

## 12. Step-by-Step Implementation Guide

### Phase 0: Setup (30 mins) ✅ DONE

```bash
# 1. AWS CLI configured
aws configure
# Access Key: 
# Region: us-east-1

# 2. S3 bucket created
aws s3 mb s3://puedo-casa-html-archive

# 3. Budget alert set
aws budgets create-budget --account-id YOUR_ACCOUNT --budget file://budget.json

# 4. IAM deny policy for expensive services
aws iam create-policy --policy-name PuedoCasa-DenyExpensiveServices --policy-document file://deny-policy.json
```

### Phase 1: Create DynamoDB Tables (15 mins)

```bash
# Run from project root
cd /Users/peterneyra/puedo_casa

# Create all tables
npx tsx src/scripts/aws/create-dynamodb-tables.ts
```

Tables to create:
- `listings` - Parsed listing data (550k records)
- `wpa_cache` - Whole Property Analysis results
- `geo_intelligence` - Dossier system
- `scraping_rules` - Student/Teacher selectors
- `crawl_tracking` - Metadata

### Phase 2: Map All URLs (2-3 hours)

```bash
# Map URLs from all domains (no downloads yet)
npx tsx src/scripts/harvest_agencies/step1-map-all-urls.ts

# Output: data/all_listing_urls.csv (~550k URLs)
```

### Phase 3: Initial Crawl (40 hours)

Option A: Run locally (slow but simple)
```bash
npx tsx src/scripts/harvest_agencies/full-crawl.ts
```

Option B: Run on EC2 Spot (faster, $0.50)
```bash
# Launch spot instance
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.medium \
  --spot-options '{"SpotInstanceType":"one-time"}' \
  --key-name your-key

# SSH in and run crawler
ssh -i your-key.pem ec2-user@<instance-ip>
git clone https://github.com/your-repo
cd puedo_casa && npm install
npx tsx src/scripts/harvest_agencies/full-crawl.ts
```

### Phase 4: Learn Selectors (4-6 hours)

```bash
# Run Student/Teacher on all domains
npx tsx src/scripts/harvest_agencies/learn-all-selectors.ts

# This will:
# 1. For each domain, send cleaned HTML to Bedrock (Mistral 7B)
# 2. Learn CSS selectors
# 3. Validate 10 listings
# 4. Graduate domain when 10 pass
```

### Phase 5: Parse All Listings (2-3 hours)

```bash
# Parse HTML to structured data using learned selectors
npx tsx src/scripts/harvest_agencies/parse-all-listings.ts

# This writes to DynamoDB: listings table
```

### Phase 6: Set Up Daily Cron (30 mins)

```bash
# Deploy Lambda functions
npx tsx src/scripts/aws/deploy-lambdas.ts

# Set up EventBridge schedules
aws events put-rule --name daily-crawl --schedule-expression "cron(0 3 * * ? *)"
aws events put-rule --name daily-parse --schedule-expression "cron(30 4 * * ? *)"
aws events put-rule --name ping-supabase --schedule-expression "cron(0 12 * * ? *)"
```

### Phase 7: Set Up Supabase Auth (when ready)

```bash
# In Supabase dashboard:
# 1. Enable Email/Password auth
# 2. Enable Google OAuth
# 3. Create user_profiles table
# 4. Set up RLS policies
```

---

### Completed ✅

- [x] Phase 0: AWS CLI configured, S3 bucket, budget alerts
- [x] Domain classification: 99.3% of sitemap domains
- [x] URL pattern recognition
- [x] Market sizing from Idealista (548k listings)
- [x] Cost analysis verified via AWS Pricing API
- [x] Architecture designed (Supabase Free + AWS)
- [x] Step-by-step guide documented

### Next Steps 📋

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Create DynamoDB tables | 15 mins | ⬜ |
| 2 | Map all URLs | 2-3 hours | ⬜ |
| 3 | Initial crawl (EC2) | 40 hours | ⬜ |
| 4 | Learn selectors (Bedrock) | 4-6 hours | ⬜ |
| 5 | Parse all listings | 2-3 hours | ⬜ |
| 6 | Set up daily cron | 30 mins | ⬜ |
| 7 | Supabase Auth | when ready | ⬜ |

### Scripts to Build

| Script | Purpose | Status |
|--------|---------|--------|
| `create-dynamodb-tables.ts` | Create all DynamoDB tables | ⬜ |
| `step1-map-all-urls.ts` | Map URLs without downloading | ✅ |
| `full-crawl.ts` | Download all HTMLs to S3 | ⬜ |
| `learn-all-selectors.ts` | Run Bedrock on all domains | ⬜ |
| `parse-all-listings.ts` | Parse HTML to DynamoDB | ⬜ |
| `deploy-lambdas.ts` | Deploy Lambda functions | ⬜ |

---

## 13. Scripts & Files

### Scripts Created

| Script | Purpose |
|--------|---------|
| `s3-html-crawler.ts` | Uploads HTML to S3 |
| `total-url-census.ts` | Counts all URLs across domains |
| `audit-unknown-urls.ts` | Analyzes what "unknown" URLs are |
| `observe-url-patterns.ts` | Regex-based URL classification |
| `observe-url-patterns-enhanced.ts` | Enhanced pattern matching |
| `gemini-bulk-analysis.ts` | Gemini classification (bulk) |
| `gemini-homepage-analysis.ts` | Gemini homepage analysis |
| `fetch-all-lastmod-dates.ts` | Get lastmod from sitemaps |
| `full-listing-census.ts` | Live listing counts |
| `test-parsing.ts` | Test Cheerio parsing on real URLs |
| `step1-map-all-urls.ts` | Map all URLs without downloading |

### Data Files

```
data/
├── MASTER_AGENCY_LIST.csv          # 3,635 domains
├── agencies_sitemaps.csv           # Which have sitemaps
├── agency_sitemap_volumetrics.csv  # URL counts per sitemap
├── domain_url_patterns.csv         # Sale/rent classification
├── domain_url_patterns_final.csv   # Final patterns
├── total_url_census.json           # Full URL census
└── full_listing_census.json        # Live listings count
```

### AWS Scripts

```
src/scripts/aws/
├── check-costs.sh                  # Check current AWS costs
├── cost-protection.ts              # Hard limits on uploads
├── full-audit.sh                   # Audit all AWS services
├── check-alerts.sh                 # Check CloudWatch alarms
├── watch-costs.sh                  # Continuous cost monitoring
└── NUCLEAR_KILLSWITCH.md           # Emergency cost controls
```

---

## Quick Reference

### Budget Summary

| | Month 1 | Month 2+ |
|--|---------|----------|
| Budget | $100 | $30 |
| Actual | $29.80 | $17.72 |
| Status | ✅ | ✅ |

### Key Numbers

| Metric | Value |
|--------|-------|
| Total listings in Spain | ~550,000 |
| Domains to crawl | 3,635 |
| Storage needed | 537 GB |
| AWS credits available | $1,100 |
| Credits last | 5+ years |

### Run Commands

```bash
# Check AWS costs
bash src/scripts/aws/check-costs.sh

# Run URL mapping (no downloads)
npx tsx src/scripts/harvest_agencies/step1-map-all-urls.ts

# Test S3 upload
npx tsx src/scripts/harvest_agencies/s3-html-crawler.ts --test

# Check S3 bucket
aws s3 ls s3://puedo-casa-html-archive/html/ --recursive | head -20
```

---

*This is the master documentation for the HarvestEngine. Keep it updated as implementation progresses.*
