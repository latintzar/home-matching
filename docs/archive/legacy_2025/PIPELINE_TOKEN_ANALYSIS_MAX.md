# Pipeline Token Usage Analysis - Maximum Potential

**Date:** 2025-01-27  
**Listing Analyzed:** 1000000121 (Piso en Portals Nous - Bendinat, Calvià)  
**Photos:** 29, **Clusters:** 13

## Executive Summary

**Maximum Potential Cost per Listing: $60.61**  
**Actual Cost per Listing: $0.68**  
**Efficiency Ratio: 1.1% of maximum potential**

### Key Findings

This analysis uses `maxOutputTokens` settings from all endpoints and accounts for execution counts (parallel calls, per-room, per-tier, per-photo). This represents the **worst-case scenario** if every endpoint produced maximum output.

### Token Breakdown (Maximum Potential)
- **Total API Calls:** 308
- **Total Max Input Tokens:** 1,549,888
- **Total Max Output Tokens:** 7,873,182
- **Total Thinking Tokens:** 933,888
- **Maximum Potential Cost:** $60.6088

### Cost by Model (Maximum Potential)
- **Gemini 2.5 Flash:** $6.68 (171 calls)
  - Max Input: 342,000 tokens
  - Max Output: 2,631,391 tokens
- **Gemini 2.5 Pro:** $53.93 (137 calls)
  - Max Input: 1,207,888 tokens
  - Max Output: 5,241,791 tokens
  - Thinking: 933,888 tokens

## Major Cost Drivers (Maximum Potential)

### 1. Q4-After Render: $28.73 (47% of max cost)
- **Calls:** 87 (29 photos × 3 tiers)
- **Max Output per Call:** 32,768 tokens
- **Total Max Output:** 2,850,816 tokens
- **Model:** Gemini 2.5 Pro @ $10.00/1M tokens

### 2. E5-POV Extraction: $18.07 (30% of max cost)
- **Calls:** 29 (1 per photo)
- **Max Output per Call:** 60,000 tokens
- **Total Max Output:** 1,740,000 tokens
- **Model:** Gemini 2.5 Pro @ $10.00/1M tokens
- **Thinking:** 16,384 tokens per call

### 3. J-Renovation Google Search - Curate: $1.10 (2% of max cost)
- **Calls:** 36 (3 tiers × 4 categories × 3 scopes)
- **Max Output per Call:** 12,000 tokens
- **Total Max Output:** 432,000 tokens
- **Model:** Gemini 2.5 Flash @ $2.50/1M tokens

### 4. H-Contextual Analysis: $0.99 (2% of max cost)
- **Calls:** 12 (1 per category)
- **Max Output per Call:** 32,768 tokens
- **Total Max Output:** 393,216 tokens
- **Model:** Gemini 2.5 Flash @ $2.50/1M tokens

### 5. B1-Categorization: $1.27 (2% of max cost)
- **Calls:** 25 (parallel: 1 per claim)
- **Max Output per Call:** 20,000 tokens
- **Total Max Output:** 500,000 tokens
- **Model:** Gemini 2.5 Flash @ $2.50/1M tokens

## Comparison: Maximum vs Actual

| Metric | Maximum Potential | Actual | Ratio |
|--------|------------------|--------|-------|
| **Total Cost** | $60.61 | $0.68 | 1.1% |
| **Total Calls** | 308 | ~34 | 11% |
| **Output Tokens** | 7,873,182 | 99,114 | 1.3% |
| **Input Tokens** | 1,549,888 | 342,943 | 22% |
| **Thinking Tokens** | 933,888 | 294,912 | 32% |

## Key Insights

### Why Maximum is So Much Higher

1. **After Image Generation (Q4):** 
   - Maximum: 87 renders × 32,768 tokens = 2.85M tokens = $28.73
   - Actual: Likely much less (images are smaller outputs)
   - **This is the biggest gap**

2. **POV Extraction (E5):**
   - Maximum: 29 photos × 60,000 tokens = 1.74M tokens = $18.07
   - Actual: Likely much less per photo
   - **Second biggest gap**

3. **Parallel Processing:**
   - B1-Categorization: 25 parallel calls (max 500k tokens)
   - J-Google Search: 36 parallel calls (max 432k tokens)
   - Actual outputs are much smaller than max

4. **Output Efficiency:**
   - Pipeline is highly efficient: only 1.3% of maximum output tokens used
   - Most endpoints produce much less than their maxOutputTokens limit

### Cost Planning Recommendations

1. **Budget for Maximum:** Plan for $60-70 per listing as worst case
2. **Average Expectation:** Based on actual data, expect ~$0.70 per listing
3. **Optimization Targets:**
   - After image generation (Q4) - biggest potential cost
   - POV extraction (E5) - second biggest potential cost
   - Consider reducing maxOutputTokens for these if not needed

### Risk Assessment

- **Low Risk:** Most endpoints use <10% of maxOutputTokens
- **Medium Risk:** After image generation could spike if all renders hit max
- **High Risk:** POV extraction could be expensive if all 29 photos need full 60k tokens

## Detailed Stage Breakdown (Maximum Potential)

### Text Analysis Pipeline
| Stage | Calls | Max Out/Call | Total Max Out | Max Cost |
|-------|-------|--------------|---------------|----------|
| A-Facts | 1 | 20,000 | 20,000 | $0.0506 |
| B1-Categorization | 25 | 20,000 | 500,000 | $1.2650 |
| B2-Merge | 1 | 20,000 | 20,000 | $0.0506 |
| B3-Snippets | 8 | 20,000 | 160,000 | $0.4048 |
| B4-Headlines | 1 | 20,000 | 20,000 | $0.0506 |
| C1-Unknowns | 1 | 20,000 | 20,000 | $0.0506 |
| C2-Followups | 1 | 20,000 | 20,000 | $0.0506 |

### Photo Analysis Pipeline
| Stage | Calls | Max Out/Call | Total Max Out | Max Cost |
|-------|-------|--------------|---------------|----------|
| Whole Property | 1 | 8,000 | 8,000 | $0.0206 |
| Room Layout (F1) | 13 | 30,000 | 390,000 | $0.9828 |
| Unified Layout (F2) | 1 | 60,000 | 60,000 | $0.1506 |
| Room-by-Room (E4) | 13 | 2,000 | 26,000 | $0.0728 |
| Integrated Diagnostic | 1 | 8,000 | 8,000 | $0.0206 |
| Listing Diagnostic | 1 | 8,192 | 8,192 | $0.0211 |

### Tier Ideation Pipeline
| Stage | Calls | Max Out/Call | Total Max Out | Thinking | Max Cost |
|-------|-------|--------------|---------------|----------|----------|
| T1.5-Budgeting | 1 | 16,384 | 16,384 | 16,384 | $0.1868 |
| T1-Group & Catalog | 1 | 16,384 | 16,384 | 0 | $0.1663 |
| T2-Tier Ideation | 1 | 16,384 | 16,384 | 16,384 | $0.1868 |
| T3-Apply to Groups | 1 | 16,384 | 16,384 | 16,384 | $0.1868 |
| T4-Decide Elements | 1 | 32,768 | 32,768 | 32,768 | $0.3711 |
| T5-Cohesion | 1 | 16,384 | 16,384 | 16,384 | $0.1868 |
| T5.5-Apply Corrections | 1 | 32,768 | 32,768 | 16,384 | $0.3507 |
| T6-Budget Calibration | 1 | 32,768 | 32,768 | 16,384 | $0.3507 |

### Renovation Pipeline
| Stage | Calls | Max Out/Call | Total Max Out | Thinking | Max Cost |
|-------|-------|--------------|---------------|----------|----------|
| I-Seed Scope | 1 | 32,768 | 32,768 | 32,768 | $0.3711 |
| J-Google Search (Query) | 36 | 8,192 | 294,912 | 0 | $0.7589 |
| J-Google Search (Curate) | 36 | 12,000 | 432,000 | 0 | $1.1016 |
| K-Pricing | 1 | 32,768 | 32,768 | 0 | $0.0825 |
| L-Timeline | 3 | 32,768 | 98,304 | 32,768 | $1.1134 |
| M-Permits | 3 | 32,768 | 98,304 | 32,768 | $1.1134 |
| N-Finalize | 1 | 65,535 | 65,535 | 32,768 | $0.6988 |

### After Image Generation
| Stage | Calls | Max Out/Call | Total Max Out | Thinking | Max Cost |
|-------|-------|--------------|---------------|----------|----------|
| Q1-Style Direction | 1 | 12,000 | 12,000 | 16,384 | $0.1430 |
| E5-POV Extraction | 29 | 60,000 | 1,740,000 | 16,384 | $18.0664 |
| Q2-Tier Layouts | 3 | 32,768 | 98,304 | 16,384 | $1.0520 |
| Q3-Prompt Synthesis | 1 | 65,536 | 65,536 | Auto | $0.6579 |
| Q4-After Render | 87 | 32,768 | 2,850,816 | 0 | $28.7257 |

## Running the Analysis

```bash
# Analyze maximum potential costs
node scripts/analyze-pipeline-max-tokens.js [listing_id]
```

This script:
- Reads all endpoint configurations
- Uses actual `maxOutputTokens` settings from code
- Accounts for parallel execution (B1, B3, E4, etc.)
- Accounts for per-room, per-tier, per-photo execution
- Calculates worst-case costs

## Notes

- **Maximum potential** represents worst-case scenario
- **Actual costs** are typically 1-2% of maximum
- **After image generation** has the highest potential cost variance
- **POV extraction** is the second highest potential cost driver
- Most other endpoints are very efficient relative to their limits

