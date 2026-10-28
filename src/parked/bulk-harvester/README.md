# Bulk Harvester - PARKED

> ⚠️ **This system is PARKED and NOT IN USE.**

## What This Was

The "bulk harvester" was a system designed to harvest listings from thousands of Spanish real estate agency websites using:
- Generic parsing rules stored in `leo-scraping-rules` DynamoDB table
- Spider-based URL discovery
- Sitemap parsing
- LLM-based HTML parsing (Gemini)

## Why It's Parked

We decided to focus on **premium domains only** for the following reasons:

1. **Quality over quantity** - Premium agencies (E&V, Lucas Fox, etc.) have the best data quality
2. **Guaranteed freshness** - Each premium domain has a bespoke Lambda with 13 requirements
3. **Cost efficiency** - No need to maintain thousands of parsing rules
4. **Reliability** - Premium Lambdas have self-continuation, delta logic, and status tracking
5. **Coverage** - ~64,000+ listings from top Spanish agencies is sufficient

## What's Here

### `lambda/`
- `daily-harvest-delta.ts` - Old bulk URL discovery
- `daily-parse.ts` - Old bulk HTML parsing
- `harvest-orchestrator.ts` - Coordinated bulk harvesting
- `parse-orchestrator.ts` / `parse-orchestrator-v2.ts` - LLM parsing orchestration
- `cascade-orchestrator.ts` - Multi-stage orchestration
- `spider-single.ts` - Single domain spider
- `sitemap-single.ts` - Single sitemap processor
- `classify-single.ts` - Page classification
- `cleanup-*.ts` - Cleanup utilities

### `harvest/`
- `spider-crawler.ts` - URL discovery crawler
- `sitemap-mapper.ts` - Sitemap parsing
- `page-classifier.ts` - HTML page classification
- `cheerio-student.ts` - LLM-based HTML parsing
- `gemini-client.ts` - Gemini API client
- Various utilities and configs

### `scripts/`
- `spider-fire-all.ts` - Mass spider launcher
- `harvest-sitemap-run.ts` - Sitemap harvest runner
- Various cleanup and utility scripts

## Current System

We now use **7 premium domain Lambdas**:
- `ev-harvest-delta` - Engel & Völkers
- `lf-harvest-delta` - Lucas Fox
- `dp-harvest-delta` - donpiso
- `tc-harvest-delta` - Tecnocasa
- `c21-harvest-delta` - Century21
- `remax-harvest-delta` - RE/MAX
- `aproperties-harvest-delta` - aProperties

See `docs/plans/P0-14-HARVESTING.md` for the current harvesting architecture.

## DO NOT USE

These files are kept for reference only. Do not:
- Deploy any of these Lambdas
- Run any of these scripts
- Reference `leo-scraping-rules` DynamoDB table

---

**Parked:** December 7, 2025

