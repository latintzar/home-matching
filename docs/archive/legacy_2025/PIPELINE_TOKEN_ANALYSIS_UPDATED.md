# Pipeline Token Usage Analysis - Updated Models

**Date:** 2025-01-27  
**Listing Analyzed:** 1000000121 (Piso en Portals Nous - Bendinat, Calvià)  
**Photos:** 29, **Clusters:** 13

## Executive Summary

**Maximum Potential Cost per Listing: $37.75**  
**Previous Maximum: $60.61**  
**Cost Reduction: 38% decrease**

### Model Changes Impact

The pipeline has been optimized with model changes that significantly reduce costs:

1. **Text Analysis (A, B1, B3, C) → Flash Lite** (was Flash)
   - Cost reduction: ~67% (Flash Lite is 3x cheaper)
   - Impact: Saves ~$0.50-1.00 per listing

2. **After Render (Q4) → Flash Image** (was Pro)
   - Cost reduction: ~88% (Flash Image is much cheaper for images)
   - Impact: Saves ~$25 per listing (biggest savings!)

3. **Style Direction (Q1) → Flash** (was Pro)
   - Cost reduction: ~75%
   - Impact: Saves ~$0.10-0.15 per listing

4. **Contextual Analysis → Pro** (was Flash)
   - Cost increase: ~350% (Pro is more expensive)
   - Impact: Adds ~$3.50 per listing

5. **Buyer Report → Pro** (was Flash)
   - Cost increase: ~300% (Pro is more expensive)
   - Impact: Adds ~$0.50 per listing

6. **Pricing → Pro** (was Flash)
   - Cost increase: ~350% (Pro is more expensive)
   - Impact: Adds ~$0.30 per listing

## Updated Maximum Potential Cost Breakdown

### Token Breakdown (Maximum Potential)
- **Total API Calls:** 311
- **Total Max Input Tokens:** 2,010,544
- **Total Max Output Tokens:** 7,448,478
- **Total Thinking Tokens:** 1,388,544
- **Maximum Potential Cost:** $37.75

### Cost by Model (Maximum Potential)
- **Gemini 2.5 Flash Lite:** $0.13 (38 calls)
  - Max Input: 76,000 tokens
  - Max Output: 311,296 tokens
- **Gemini 2.5 Flash:** $3.62 (123 calls)
  - Max Input: 258,288 tokens
  - Max Output: 1,415,872 tokens
  - Thinking: 12,288 tokens
- **Gemini 2.5 Pro:** $30.58 (63 calls)
  - Max Input: 1,502,256 tokens
  - Max Output: 2,870,494 tokens
  - Thinking: 1,376,256 tokens
- **Gemini 2.5 Flash Image:** $3.42 (87 calls)
  - Max Input: 174,000 tokens
  - Max Output: 2,850,816 tokens (estimated: 87 images × 1290 tokens)

## Major Cost Drivers (Updated)

### 1. E5-POV Extraction: $18.07 (48% of max cost)
- **Calls:** 29 (1 per photo)
- **Max Output per Call:** 60,000 tokens
- **Total Max Output:** 1,740,000 tokens
- **Model:** Gemini 2.5 Pro @ $10.00/1M tokens
- **Thinking:** 16,384 tokens per call

### 2. H-Contextual Analysis: $4.45 (12% of max cost)
- **Calls:** 12 (1 per category)
- **Max Output per Call:** 32,768 tokens
- **Total Max Output:** 393,216 tokens
- **Model:** Gemini 2.5 Pro @ $10.00/1M tokens
- **Thinking:** 32,768 tokens per call
- **Note:** This increased significantly due to Pro model + thinking budget

### 3. Q4-After Render: $3.42 (9% of max cost)
- **Calls:** 87 (29 photos × 3 tiers)
- **Estimated Output:** 87 images × 1290 tokens = 112,230 tokens
- **Model:** Gemini 2.5 Flash Image @ $30.00/1M tokens
- **Note:** Much cheaper than before! (was $28.73 with Pro)

### 4. J-Renovation Google Search - Curate: $1.10 (3% of max cost)
- **Calls:** 36 (3 tiers × 4 categories × 3 scopes)
- **Max Output per Call:** 12,000 tokens
- **Total Max Output:** 432,000 tokens
- **Model:** Gemini 2.5 Flash @ $2.50/1M tokens

## Cost Comparison: Before vs After Model Changes

| Stage | Old Model | Old Max Cost | New Model | New Max Cost | Change |
|-------|-----------|--------------|-----------|--------------|--------|
| A-Facts | Flash | $0.05 | Flash Lite | $0.01 | -80% |
| B1-Categorization | Flash | $1.27 | Flash Lite | $0.10 | -92% |
| B3-Snippets | Flash | $0.40 | Flash Lite | $0.13 | -68% |
| H-Contextual | Flash | $0.99 | Pro | $4.45 | +350% |
| O-Buyer Report | Flash | $0.16 | Pro | $0.70 | +338% |
| K-Pricing | Flash | $0.08 | Pro | $0.37 | +363% |
| Q1-Style Direction | Pro | $0.14 | Flash | $0.10 | -29% |
| Q4-After Render | Pro | $28.73 | Flash Image | $3.42 | -88% |

**Net Change:** -$22.86 (38% reduction)

## Key Insights

### Cost Savings
1. **After Image Generation:** Biggest win - $25.31 saved by switching to Flash Image
2. **Text Analysis:** Significant savings by using Flash Lite for simple tasks
3. **Style Direction:** Moderate savings by using Flash instead of Pro

### Cost Increases
1. **Contextual Analysis:** Increased by $3.46 due to Pro model + thinking budget
2. **Buyer Report:** Increased by $0.54 due to Pro model
3. **Pricing:** Increased by $0.29 due to Pro model

### Overall Impact
- **Maximum potential cost reduced by 38%** ($60.61 → $37.75)
- **Actual costs likely reduced by similar percentage** (estimated $0.68 → ~$0.42)
- **After image generation is now much more cost-effective**

## Model Usage Summary

### Flash Lite (38 calls)
- Text analysis pipeline (A, B1, B3, C)
- Simple, structured tasks
- Very cost-effective for basic operations

### Flash (123 calls)
- Photo analysis
- Google search queries
- Style direction
- Most general-purpose tasks

### Pro (63 calls)
- Tier ideation pipeline
- Renovation planning
- Contextual analysis (new)
- Buyer report (new)
- Pricing (new)
- POV extraction
- Complex reasoning tasks

### Flash Image (87 calls)
- After image generation
- Image editing/rendering
- Much cheaper than Pro for image outputs

## Running the Updated Analysis

```bash
# Analyze maximum potential costs with updated models
node scripts/analyze-pipeline-max-tokens.js [listing_id]
```

The script now reflects:
- ✅ Flash Lite for text analysis (A, B1, B3, C)
- ✅ Pro for contextual analysis, buyer report, pricing
- ✅ Flash for style direction
- ✅ Flash Image for after render
- ✅ All maxOutputTokens settings from actual code
- ✅ All execution counts (parallel, per-room, per-tier, per-photo)

