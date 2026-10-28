# Variable-Cost Photo Analysis Architecture

**Last Updated**: 2025-01-27  
**Status**: Design Phase  
**Goal**: Analyze photos only for properties that pass lifestyle recommender, with reusable analysis and per-user fit scoring

---

## 🎯 Core Concept

Instead of analyzing all 10k daily properties (flat cost), we:
1. **Filter first** → Only analyze properties that pass the lifestyle recommender (Sweet Spot + hard criteria)
2. **One-time analysis** → Use Gemini 3 Pro Preview for high-quality, detailed analysis
3. **Store & reuse** → Save analysis in `whole_property_analysis` table
4. **Per-user scoring** → Use Gemini 2.5 Flash to calculate fit scores per user (cheap, reuses stored analysis)

**Result**: Variable cost per paying customer, not flat daily cost.

---

## 📊 Cost Analysis

### Per-Property Analysis (One-Time, Gemini 3 Pro Preview)

**Model**: Gemini 3 Pro Preview
- Input: **$2.00** per 1M tokens
- Output: **$12.00** per 1M tokens

**Token Estimation** (30 images average):
- Input: ~8,310 tokens (600 text prompt + 7,710 for 30 images)
- Output: ~2,500 tokens (detailed JSON analysis)

**Cost per listing**:
- Input: (8,310 / 1,000,000) × $2.00 = **$0.0166**
- Output: (2,500 / 1,000,000) × $12.00 = **$0.0300**
- **Total: ~$0.047 per listing** (one-time)

### Per-User Fit Scoring (Gemini 2.5 Flash)

**Model**: Gemini 2.5 Flash Lite
- Input: **$0.10** per 1M tokens
- Output: **$0.40** per 1M tokens

**Token Estimation** (per listing):
- Input: ~1,500 tokens (stored analysis + user preferences)
- Output: ~200 tokens (fit score + brief explanation)

**Cost per listing**:
- Input: (1,500 / 1,000,000) × $0.10 = **$0.00015**
- Output: (200 / 1,000,000) × $0.40 = **$0.00008**
- **Total: ~$0.00023 per listing** (per user)

### Example User Session

**Scenario**: User gets 50 recommendations
- **20 new listings** (need analysis): 20 × $0.047 = **$0.94**
- **50 fit scores**: 50 × $0.00023 = **$0.0115**
- **Total per user: ~$0.95**

**Comparison**:
- **Old approach**: $18/day flat (10k properties × $0.0018)
- **New approach**: $0.95 per paying customer
- **Break-even**: ~19 paying customers/day to match old cost
- **Benefit**: Cost scales with revenue, not volume

---

## 🏗️ Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Lifestyle Recommender (Zero-Cost Spatial Filter)        │
│    - Filters 10k listings → ~50 matches                    │
│    - Sweet Spot + Hard Criteria (price, beds, etc.)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Check Analysis Cache                                     │
│    - For each match, check whole_property_analysis table    │
│    - If exists → Skip analysis, use cached                  │
│    - If missing → Trigger analysis                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Whole Property Analysis (One-Time, Gemini 3 Pro)        │
│    - Analyzes all photos (30 avg)                           │
│    - Extracts: lighting, finishes, structure, etc.          │
│    - Stores in whole_property_analysis table                 │
│    - Cost: $0.047 per listing (one-time)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Fit Scoring (Per-User, Gemini 2.5 Flash Lite)            │
│    - Takes stored analysis + user preferences                │
│    - Calculates fit score (0-100)                            │
│    - Explains match/mismatch                                 │
│    - Cost: $0.00023 per listing (per user)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Ranked Recommendations                                    │
│    - Sort by fit score                                       │
│    - Return top matches with scores                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### 1. Modified Recommender Endpoint

**File**: `src/app/api/lifestyle/recommendations/route.ts`

**Changes**:
- After spatial filtering, check `whole_property_analysis` for each listing
- For missing analyses, trigger async analysis (don't block response)
- Return listings with `analysis_status: 'cached' | 'pending' | 'missing'`

### 2. Enhanced Whole Property Analysis

**File**: `src/app/api/listings/[id]/analysis/whole-property/route.ts`

**Changes**:
- Switch model from `gemini-2.5-flash` to `gemini-3-pro-preview`
- Add `force_refresh` parameter (optional, defaults to false)
- Check cache first, only analyze if missing or forced

### 3. New Fit Scoring Endpoint

**File**: `src/app/api/lifestyle/fit-score/route.ts` (NEW)

**Input**:
```json
{
  "listing_id": 12345,
  "user_preferences": {
    "property_preferences": { ... },
    "lifestyle_dna": { ... }
  }
}
```

**Output**:
```json
{
  "fit_score": 87,
  "explanation": "Excellent match: High natural light, modern finishes...",
  "strengths": ["Natural lighting", "Modern finishes"],
  "concerns": ["May need AC upgrade"]
}
```

**Model**: Gemini 2.5 Flash Lite  
**Cost**: ~$0.00023 per listing

### 4. Batch Analysis Trigger

**File**: `src/app/api/lifestyle/batch-analyze/route.ts` (NEW)

**Purpose**: Background job to analyze pending listings
- Fetches listings with `analysis_status = 'pending'`
- Processes in batches of 10
- Updates status to `'completed'` or `'failed'`

---

## 📋 Data Schema

### Existing Table: `whole_property_analysis`

```sql
CREATE TABLE whole_property_analysis (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL UNIQUE REFERENCES listings(id),
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Analysis Data Structure** (from `WHOLE_PROPERTY_PROMPT`):
```json
{
  "general_impression": "120-180 words...",
  "summary_ratings": {
    "envelope": "Good|Fair|Poor|Unknown",
    "moisture": "Good|Fair|Poor|Unknown",
    "windows_doors": "Good|Fair|Poor|Unknown",
    "kitchen_baths": "Good|Fair|Poor|Unknown",
    "electrical": "Good|Fair|Poor|Unknown",
    "plumbing": "Good|Fair|Poor|Unknown",
    "heating_cooling": "Good|Fair|Poor|Unknown",
    "finishes": "Good|Fair|Poor|Unknown",
    "accessibility_safety": "Good|Fair|Poor|Unknown|Claimed-verify",
    "energy_comfort": "Good|Fair|Poor|Unknown"  // Includes lighting!
  },
  "top_checks": [...],
  "notes": [...]
}
```

### New Table: `lifestyle_fit_scores` (Optional)

```sql
CREATE TABLE lifestyle_fit_scores (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  user_profile_id UUID REFERENCES user_lifestyle_profiles(id),
  fit_score INTEGER NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100),
  explanation TEXT,
  strengths JSONB,
  concerns JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, user_profile_id)
);
```

**Note**: Can also compute on-demand without storing (cheaper storage, but slower).

---

## 🚀 Migration Strategy

### Phase 1: Update Analysis Endpoint
1. Switch to Gemini 3 Pro Preview
2. Add cache check logic
3. Test with single listing

### Phase 2: Integrate with Recommender
1. Add analysis status check to recommender
2. Trigger async analysis for missing listings
3. Return listings with status

### Phase 3: Add Fit Scoring
1. Create fit scoring endpoint
2. Test scoring with sample preferences
3. Integrate into recommender response

### Phase 4: Background Processing
1. Create batch analysis job
2. Set up cron/queue for pending analyses
3. Monitor costs and performance

---

## 💡 Benefits

1. **Variable Cost**: Scales with paying customers, not total volume
2. **Reusability**: Analysis stored and reused across users
3. **Quality**: Gemini 3 Pro Preview provides detailed analysis
4. **Efficiency**: Only analyze properties that matter (passed recommender)
5. **Scalability**: Can handle thousands of users without linear cost increase

---

## 📈 Expected Impact

**Current**: $18/day flat cost (10k properties)  
**New**: ~$0.95 per paying customer

**Break-even**: 19 paying customers/day  
**At 100 customers/day**: $95/day (vs $18/day old approach)  
**But**: Only paying customers incur cost, not all scraped properties

**Key Insight**: Cost now scales with revenue, making it sustainable at any scale.

---

## 🔍 Monitoring

Track:
- Analysis cache hit rate (target: >80% after warm-up)
- Average fit score calculation time
- Cost per user session
- Analysis quality (user feedback)

---

**Next Steps**: Implement Phase 1 (Update Analysis Endpoint)

