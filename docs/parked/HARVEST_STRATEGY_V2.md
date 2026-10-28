# Harvest Strategy V2: Direct Extraction First

> **Goal**: Achieve 100% up-to-date coverage of major agencies via direct extraction, with traditional spidering as fallback.

---

## The Insight

Not all agencies need traditional scraping. Modern agencies often expose data in ways that are:
- **More complete** - All listings, not just what we can crawl
- **More structured** - JSON data, not HTML to parse
- **More reliable** - Official data, not scraped guesses
- **Easily refreshable** - Daily sync with minimal effort

---

## Extraction Hierarchy (Best → Worst)

### Tier 1: Official API 🏆
**Best case** - Agency provides a documented API

```
Agency API → JSON response → Our database
```

- ✅ Complete inventory
- ✅ Real-time updates
- ✅ Structured data
- ✅ Rate limits known
- ❌ Rare (most agencies don't offer public APIs)

**Status**: Need to investigate if any agencies have public APIs

---

### Tier 2: SSR/Hydration Data 🥈
**What we achieved with E&V** - Extract embedded JSON from Next.js/React pages

```
Search page HTML → <script id="__NEXT_DATA__"> → JSON → Our database
```

- ✅ Structured data (no parsing)
- ✅ All fields available
- ✅ Easy daily refresh
- ⚠️ Pagination limits (35/page for E&V)
- ⚠️ Need geo-segmentation for full coverage

**Status**: ✅ Working for Engel & Völkers (6,016 listings)

---

### Tier 3: JSON-in-HTML 🥉
Some sites embed listing data in script tags (not SSR, but structured)

```html
<script>
  window.__INITIAL_STATE__ = { listings: [...] };
</script>
```

- ✅ Structured data
- ⚠️ Not standardized (varies per site)
- ⚠️ May require custom extraction per agency

**Status**: Need to investigate which agencies use this

---

### Tier 4: Sitemap + Classification 📋
Traditional approach for sites without structured data

```
Sitemap → URLs → Download HTML → Classify → Parse with LLM
```

- ⚠️ May miss some pages
- ⚠️ Requires HTML parsing
- ⚠️ LLM costs for parsing
- ✅ Works for any site

**Status**: ✅ Working (165K listings identified)

---

### Tier 5: Spider Crawling 🕷️
Fallback for sites without sitemaps

```
Homepage → Crawl links → Download HTML → Classify → Parse
```

- ⚠️ May miss deep pages
- ⚠️ Rate limiting issues
- ⚠️ Requires HTML parsing
- ✅ Last resort that works

**Status**: ✅ Working (fixed blocklist issue)

---

## Implementation Plan

### Phase 1: Audit Major Agencies (Priority)

Check each major agency for extraction method:

| Agency | Domain | SSR? | API? | JSON-in-HTML? | Status |
|--------|--------|------|------|---------------|--------|
| Engel & Völkers | engelvoelkers.com | ✅ Yes | ❓ | - | **✅ DONE** |
| Century 21 | century21.es | ❓ | ❓ | ❓ | TODO |
| RE/MAX | remax.es | ❓ | ❓ | ❓ | TODO |
| Coldwell Banker | coldwellbanker.es | ❓ | ❓ | ❓ | TODO |
| Savills | savills.es | ❓ | ❓ | ❓ | TODO |
| Sotheby's | sothebysrealty.com | ❓ | ❓ | ❓ | TODO |
| Barnes | barnes-international.com | ❓ | ❓ | ❓ | TODO |
| Tecnocasa | tecnocasa.es | ❓ | ❓ | ❓ | TODO |
| Keller Williams | kwspain.es | ❓ | ❓ | ❓ | TODO |
| Housfy | housfy.com | ❓ | ❓ | ❓ | TODO |
| Grocasa | grocasa.com | ❓ | ❓ | ❓ | TODO |

### Phase 2: Build Extraction Scripts

For each agency with Tier 1-3 access:
1. Create `scripts/{agency}-harvest.ts`
2. Test coverage (what % of their inventory do we get?)
3. Set up daily refresh cron

### Phase 3: Traditional Harvest for Rest

For agencies without direct extraction:
1. Run sitemap harvest
2. Spider crawl if no sitemap
3. Classify pages
4. Parse with LLM

---

## How to Check an Agency

### Step 1: Check for `__NEXT_DATA__` (SSR)

```bash
curl -s "https://agency.com/properties" | grep -o '__NEXT_DATA__' | head -1
```

If found → **Tier 2** (like E&V)

### Step 2: Check for JSON in scripts

```bash
curl -s "https://agency.com/properties" | grep -oE '<script[^>]*>.*listings.*</script>'
```

If found → **Tier 3** (JSON-in-HTML)

### Step 3: Check Network tab for API calls

Open browser DevTools, go to property search page, check Network tab for:
- `/api/` endpoints
- GraphQL queries
- JSON responses with listing data

If found → Potentially **Tier 1** or undocumented API

### Step 4: Check for sitemap

```bash
curl -s "https://agency.com/sitemap.xml" | head -20
```

If exists → **Tier 4** (Sitemap harvest)

### Step 5: Fallback to spider

If nothing else works → **Tier 5** (Spider crawl)

---

## Benefits of This Approach

### For Agencies with Direct Extraction:
- **Daily sync** - Run script, get latest inventory
- **No parsing errors** - Data is structured
- **100% coverage** - Get everything they have
- **Low cost** - No LLM needed for parsing
- **Fast** - Minutes instead of hours

### For Traditional Harvest:
- **Still works** - Fallback for any agency
- **Already built** - Infrastructure exists
- **Comprehensive** - Classification + parsing pipeline ready

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Major agencies with direct extraction | 10+ |
| Coverage of major agency inventory | 80%+ |
| Daily refresh capability | Yes |
| Traditional harvest as backup | Yes |

---

## Current Status

### ✅ Completed
- Engel & Völkers SSR extraction (6,016 listings)
- Traditional harvest infrastructure
- Classification pipeline
- Parsing pipeline (Teacher/Student)

### 🔜 Next Steps
1. Audit Century21, RE/MAX, etc. for extraction methods
2. Build extraction scripts for compatible agencies
3. Set up daily refresh crons
4. Use traditional harvest for incompatible agencies

---

## File Structure (Proposed)

```
scripts/
├── harvest/
│   ├── ev-harvest.ts           # Engel & Völkers (✅ done)
│   ├── century21-harvest.ts    # TODO
│   ├── remax-harvest.ts        # TODO
│   └── ...
├── sitemap-fire-all.ts         # Traditional sitemap
├── spider-fire-all.ts          # Traditional spider
└── classify-fire-all.ts        # Classification
```

---

## The Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPANISH REAL ESTATE DATA                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TIER 1-3: Direct Extraction (Preferred)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ E&V → 6,016 listings (daily refresh)                     │   │
│  │ Century21 → ??? listings (if SSR available)              │   │
│  │ RE/MAX → ??? listings (if SSR available)                 │   │
│  │ ...                                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  TIER 4-5: Traditional Harvest (Fallback)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ~1,900 smaller agencies → Sitemap/Spider → LLM Parse     │   │
│  │ 165,000+ listings identified                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  RESULT: Complete, up-to-date Spanish real estate inventory     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Created**: December 5, 2025
**Last Updated**: December 5, 2025

