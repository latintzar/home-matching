# Harvest Tracking Issues

**Date**: 2025-12-05

## The Problem

Currently, getting any information about our harvest requires:
- Scanning 600K+ items in DynamoDB (slow, times out)
- Ad-hoc queries that don't give complete pictures
- No pre-computed metrics or dashboards
- No tracking of WHY things failed (bot protection, JS-rendered, etc.)

## What We're Missing

### 1. Domain-Level Summary Table
We need a `leo-domain-stats` table with:
```
domain: string (PK)
total_urls: number
urls_with_html: number
urls_with_classification: number
listings_count: number        # action=parse
list_pages_count: number      # action=delta_source
junk_count: number            # action=skip
errors: {
  bot_protection: number
  timeout: number
  404: number
  other: number
}
last_updated: timestamp
```

### 2. Error Tracking
When spider/download fails, we don't know WHY:
- Bot protection (403, Cloudflare, etc.)
- JavaScript-rendered (empty HTML)
- Timeout
- 404/Gone
- Rate limited

### 3. HTML Quality Metrics
- How many HTMLs are actually useful?
- How many are empty/tiny (<1KB)?
- How many are bot protection pages?

### 4. Sitemap vs Spider Tracking
- Which domains came from sitemaps?
- Which were spidered?
- Which have broken/wrong sitemaps?

## Current State (Best Guess)

Based on slow ad-hoc queries:
- Total domains in leo-scraping-rules: ~2,774
- Domains with action=parse listings: ~2,002 (72%)
- Domains with 0 listings: ~773 (28%)

## Why This Happened

1. **No upfront planning** for observability
2. **DynamoDB scans are expensive** - should have used aggregations
3. **No pipeline state machine** tracking each domain's journey
4. **Errors silently swallowed** - no logging of failure reasons

## The Fix: Build `leo-domain-stats` Table

Need to:
1. Create the summary table
2. Run a one-time aggregation job to populate it
3. Update it whenever we process a domain
4. Use it for all dashboard/status queries

## Major Agencies Investigation (UPDATED with Stats)

From `leo-domain-stats` table:

| Domain | URLs | HTMLs | Listings | List Pages | Junk | Issue |
|--------|------|-------|----------|------------|------|-------|
| tecnocasa.es | 7,792 | 7,708 | 6,773 | 325 | 610 | ✅ Working! |
| remax.es | 111 | 111 | 0 | 0 | 110 | All navigation, no individual listings |
| century21.es | 162 | 162 | 0 | 0 | 160 | All navigation, no individual listings |
| engelvoelkers.com | 0 | 0 | 0 | 0 | 0 | Never crawled (in rules but no URLs) |
| housfy.com | 0 | 0 | 0 | 0 | 0 | Never crawled (in rules but no URLs) |
| grocasa.com | 0 | 0 | 0 | 0 | 0 | Never crawled (in rules but no URLs) |

**Root causes identified:**
1. **Some domains never crawled** - In scraping rules but spider never ran or failed silently
2. **Shallow crawl** - Spider found surface pages but didn't follow into property detail pages
3. **JS-rendered content** - Individual listings likely require JavaScript execution
4. **Classifier is correct** - Navigation pages correctly marked as junk

## COMPLETE HARVEST STATS (from leo-domain-stats)

```
📊 TOTALS
   Domains:           2,716
   URLs:              606,472
   HTMLs downloaded:  587,897
   URLs classified:   580,903

📈 CLASSIFICATION BREAKDOWN
   Listings (parse):  165,747
   List pages:        263,349
   Junk (skip):       150,404

🏠 DOMAIN STATUS
   With listings:     2,002 (73.7%)
   Zero listings:     714 (26.3%)
   Zero URLs:         0 (all domains have at least some URLs now)
```

## Action Items

1. [x] Document these issues
2. [x] Create `leo-domain-stats` table
3. [x] Run aggregation job to populate it
4. [ ] Add error categorization to spider/download
5. [ ] Build simple CLI dashboard
6. [ ] Re-spider major agencies with deeper crawling
7. [ ] Investigate why housfy/grocasa/engelvoelkers never crawled

