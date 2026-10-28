# Re-Spider Priority List

**Date**: 2025-12-05

## TIER 1: Major Agency Brands (0 listings - need deep re-spider 3x)

| Domain | Current URLs | HTMLs | Listings | Priority |
|--------|-------------|-------|----------|----------|
| century21.es | 162 | 162 | 0 | 🔴 HIGH |
| remax.es | 111 | 111 | 0 | 🔴 HIGH |
| remaxpremium.es | 160 | 160 | 0 | 🔴 HIGH |
| remaxcasaelite.es | 113 | 113 | 0 | 🔴 HIGH |
| tecnicasa.net | 74 | 74 | 0 | 🔴 HIGH |
| andorra-sothebysrealty.com | 191 | 191 | 0 | 🔴 HIGH |

## TIER 1B: Never Crawled (in scraping rules but 0 URLs)

| Domain | Status |
|--------|--------|
| engelvoelkers.com | Never crawled |
| housfy.com | Never crawled |
| grocasa.com | Never crawled |
| kwspain.es | Never crawled |

## TIER 2: Low Listing Count (have URLs but few listings)

| Domain | URLs | HTMLs | Listings |
|--------|------|-------|----------|
| savills.es | 509 | 509 | 8 |
| coldwellbanker.es | 345 | 345 | 1 |

## TIER 3: High URL Count Sites (likely real estate, need investigation)

| Domain | URLs | HTMLs | Listings |
|--------|------|-------|----------|
| gestinfer.es | 6,846 | 821 | 0 |
| elgi.es | 3,809 | 3,808 | 0 |
| vincent-realestate.com | 3,740 | 3,311 | 0 |
| castilloproperties.es | 1,092 | 1,063 | 0 |
| vibeinmobiliaria.com | 718 | 718 | 0 |
| inmobiliariacalidad.com | 700 | 700 | 0 |
| vallesdelpirineo.com | 676 | 676 | 0 |
| manuelaperez.com | 642 | 642 | 0 |
| impulsoinmobiliario.com | 639 | 639 | 0 |
| tenerife-inmobiliarias.es | 627 | 627 | 0 |

## Strategy

1. **Run 3x for TIER 1** - Major agencies need multiple deep crawls
2. **Run 1x for TIER 1B** - First crawl attempt
3. **Run 2x for TIER 2** - Deeper crawl to find more listings
4. **Run 1x for TIER 3** - See what we get

## Command to Execute

```bash
npx tsx scripts/respider-priority.ts
```

