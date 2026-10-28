# Pipeline Endpoints Reference

> API routes for Analysis and Renovation pipelines. See `LEO_ARCHITECTURE.md` for overview.

## Basic Package (Analysis)

### Phase 1: Ingest

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingest/browser` | POST | Client-side extension push |
| `/api/ingest/server` | POST | Server-side fetch/AI |

### Phase 2: Text Analysis

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/text-analysis/a-facts` | POST | Extract basic facts |
| `/api/listings/[id]/text-analysis/b3-snippets` | POST | Generate snippets |
| `/api/listings/[id]/text-analysis/c-unknowns` | POST | Identify unknowns |

### Phase 2.5: Cadastre

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/analysis/cadastre` | POST | Government data verification |

### Phase 2.7: Intelligence

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/intelligence/social-radar` | POST | Location intelligence |

### Phase 3: Photo Analysis

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/clusters/zero-shot/full` | POST | Zero-shot clustering |
| `/api/listings/[id]/analysis/whole-property` | POST | WPA (F3 node) |
| `/api/listings/[id]/photo-analysis/room-by-room` | POST | Room inspection |

### Phase 4: Search

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/analysis-google-search` | POST | Double-barrel search |

### Phase 5: Report

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/analysis/final-scope` | POST | Buyer report (3-chapter) |

## Renovation Package

### Phase 6: Gateway

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/renovation/baseline-check` | POST | Verify analysis complete |

### Phase 7: Strategy & Scope

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/renovation/unified-strategy` | POST | Architect's plan |
| `/api/listings/[id]/renovation/search` | POST | J-Reno research |
| `/api/listings/[id]/renovation/unified-scope` | POST | Detailed work items |

### Phase 8: Visuals

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/renovation/r1` | POST | Before prep |
| `/api/listings/[id]/renovation/r2` | POST | After generation |
| `/api/listings/[id]/renovation/r3` | POST | Final visuals |

## Lifestyle Package

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/lifestyle/generate-polygon` | POST | Sweet spot generation |
| `/api/lifestyle/test-single` | POST | Test single property |

## Orchestrator

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/[id]/orchestrate/basic` | POST | Run full basic pipeline |
| `/api/listings/[id]/orchestrate/reno` | POST | Run full reno pipeline |

## Models Used

| Purpose | Model | Config |
|---------|-------|--------|
| Complex analysis | `gemini-3-pro-preview` | `thinkingConfig: { thinkingLevel: 'HIGH' }` |
| Fast analysis | `gemini-2.5-flash` | Default |
| Lite/cheap | `gemini-2.5-flash-lite` | For validation |
| **Bulk parsing** | **Bedrock Mistral 7B** | NOT Gemini |

## Idempotency

All endpoints check for existing results before running AI:

```typescript
// Example pattern
const existing = await db.query('SELECT * FROM analysis WHERE listing_id = ?');
if (existing) return existing; // Skip AI, return cached

// Only run AI if no cached result
const result = await gemini.analyze(...);
await db.insert('analysis', result);
return result;
```

## Cost Per Endpoint

| Endpoint Category | Approx Cost |
|-------------------|-------------|
| Text Analysis (A-C) | ~€0.02 |
| Photo Clustering | ~€0.03 |
| WPA | ~€0.05 |
| Room-by-Room | ~€0.03 |
| Search | ~€0.02 |
| Final Report | ~€0.03 |
| **Basic Total** | **~€0.15** |
| Reno (all phases) | ~€0.35 |
| **Full Total** | **~€0.50** |

---

*Last Updated: 2025-11-28*

