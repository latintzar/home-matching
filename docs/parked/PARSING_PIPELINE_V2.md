# 🔧 Parsing Pipeline V2 - Pro + Flash Flow

## Budget

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARD BUDGET: $250                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  If we hit $250, STOP IMMEDIATELY.                               │
│  No exceptions. Better to parse 80% than blow budget.            │
│                                                                  │
│  Expected cost: ~$140-160 for 2002 domains                       │
│  Buffer: ~$90-110 for edge cases                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Flow (Final Version)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FOR EACH DOMAIN                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: TEACHER (Gemini 3 Pro)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   INPUT:  1 sample HTML from this domain                                     │
│   TASK:   "Figure out CSS selectors for all fields"                          │
│   OUTPUT: { price: ".precio", bedrooms: ".hab", ... }                        │
│                                                                              │
│   💰 COST: ~$0.02                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: CHEERIO EXTRACTS FROM 5 LISTINGS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Using selectors from Teacher, extract data from 5 different listings.      │
│                                                                              │
│   💰 COST: $0.00 (just code)                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: PRO VALIDATES + COURSE-CORRECTS (All 5 at once!)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   INPUT:                                                                     │
│   • The selectors that were used                                             │
│   • 5 compressed HTMLs (~5K each)                                            │
│   • 5 extraction results                                                     │
│                                                                              │
│   TASK:                                                                      │
│   "For each listing, verify the extraction against the HTML.                 │
│    If anything is wrong or missing, provide CORRECTED selectors."            │
│                                                                              │
│   OUTPUT:                                                                    │
│   {                                                                          │
│     "allCorrect": false,                                                     │
│     "issues": ["Price wrong on listing 3", "Missed photos on all"],          │
│     "correctedSelectors": { price: ".precio-valor", photos: ".gallery img" } │
│   }                                                                          │
│                                                                              │
│   💡 KEY: One call does validation AND correction!                           │
│                                                                              │
│   💰 COST: ~$0.05                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: CHEERIO EXTRACTS FROM 5 MORE LISTINGS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Using CORRECTED selectors (or original if no corrections needed).          │
│   Extract from 5 DIFFERENT listings (not the same as Step 2).                │
│                                                                              │
│   💰 COST: $0.00 (just code)                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: FLASH FINAL VALIDATION (Sanity Check)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   INPUT:                                                                     │
│   • 5 compressed HTMLs                                                       │
│   • 5 extraction results                                                     │
│                                                                              │
│   TASK:                                                                      │
│   "Quick check: Do these extractions match the HTML? Yes/No for each."       │
│                                                                              │
│   OUTPUT:                                                                    │
│   {                                                                          │
│     "results": [                                                             │
│       { "listing": 1, "pass": true },                                        │
│       { "listing": 2, "pass": true },                                        │
│       { "listing": 3, "pass": false, "reason": "Price mismatch" },           │
│       { "listing": 4, "pass": true },                                        │
│       { "listing": 5, "pass": true }                                         │
│     ],                                                                       │
│     "passRate": "4/5"                                                        │
│   }                                                                          │
│                                                                              │
│   💰 COST: ~$0.003                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: DECISION                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                                                                 │       │
│   │   Flash says 4/5 or 5/5 pass?                                   │       │
│   │                                                                 │       │
│   │              YES                      NO                        │       │
│   │               │                        │                        │       │
│   │               ▼                        ▼                        │       │
│   │        ┌──────────┐            ┌──────────────┐                 │       │
│   │        │ GRADUATE │            │     PARK     │                 │       │
│   │        └──────────┘            └──────────────┘                 │       │
│   │               │                        │                        │       │
│   │               ▼                        ▼                        │       │
│   │      Save selectors           Record failures                   │       │
│   │      Move to next             Move to next                      │       │
│   │                               (Don't waste more $)              │       │
│   │                                                                 │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│   NOTE: We don't re-teach. Pro already had a chance to correct.              │
│   If it still fails, we PARK and move on. Budget > Perfection.               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Per Domain

```
┌─────────────────────────────────────────────────────────────────┐
│                    COST BREAKDOWN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Pro Teacher           $0.020                            │
│  Step 2: Cheerio               $0.000                            │
│  Step 3: Pro Validate+Correct  $0.050                            │
│  Step 4: Cheerio               $0.000                            │
│  Step 5: Flash Final Check     $0.003                            │
│  ─────────────────────────────────────                           │
│  TOTAL PER DOMAIN:             $0.073                            │
│                                                                  │
│  ═══════════════════════════════════════════════════════════     │
│  2002 DOMAINS × $0.073 = $146                                    │
│  ═══════════════════════════════════════════════════════════     │
│                                                                  │
│  BUFFER: $250 - $146 = $104 for edge cases                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Budget Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUDGET ENFORCEMENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STORED IN: DynamoDB `leo-budget-tracker` table                  │
│                                                                  │
│  {                                                               │
│    "id": "parsing-v2",                                           │
│    "budget_limit": 250.00,                                       │
│    "spent": 45.23,                                               │
│    "domains_processed": 620,                                     │
│    "domains_graduated": 589,                                     │
│    "domains_parked": 31,                                         │
│    "last_updated": "2024-12-04T15:30:00Z"                        │
│  }                                                               │
│                                                                  │
│  BEFORE EACH DOMAIN:                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ if (spent + estimated_domain_cost > budget_limit) {     │    │
│  │   console.log("⛔ BUDGET LIMIT REACHED");                │    │
│  │   console.log(`Spent: $${spent}, Limit: $${limit}`);    │    │
│  │   console.log(`Processed: ${domains_processed} domains`);│    │
│  │   STOP_EXECUTION();                                      │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  AFTER EACH LLM CALL:                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ spent += actual_cost_from_response;                      │    │
│  │ update_budget_tracker();                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quality Gates

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUALITY CHECKS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ESSENTIAL FIELDS (must have at least 2/3):                      │
│  • price                                                         │
│  • address OR (city + neighborhood)                              │
│  • m2_built OR bedrooms                                          │
│                                                                  │
│  If Flash validation shows < 2/3 essential fields:               │
│  → PARK the domain (don't waste time on garbage)                 │
│                                                                  │
│  COORDINATE VALIDATION:                                          │
│  • If lat/lng extracted, must be within Spain bounds             │
│  • Otherwise: null out the coordinates                           │
│                                                                  │
│  PASS THRESHOLD:                                                 │
│  • 4/5 or 5/5 Flash passes → GRADUATE                            │
│  • <4/5 passes → PARK                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Expected Outcome

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPECTED RESULTS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2002 DOMAINS:                                                   │
│                                                                  │
│  ├── ✅ ~1700 GRADUATED (85%)                                    │
│  │      High-quality selectors, validated twice                  │
│  │                                                               │
│  ├── ⚠️  ~200 PARTIAL (10%)                                      │
│  │      Work but missing some non-essential fields               │
│  │                                                               │
│  └── 🅿️  ~102 PARKED (5%)                                        │
│         JS-heavy sites, weird templates, etc.                    │
│                                                                  │
│  TOTAL SPEND: ~$146 (well under $250)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Files

```
src/
├── lambda/
│   ├── parse-teacher-v2.ts      # Step 1: Pro Teacher
│   ├── parse-validator-v2.ts    # Step 3: Pro Validate+Correct
│   ├── parse-flash-check.ts     # Step 5: Flash Final Check
│   └── parse-orchestrator-v2.ts # Coordinates the flow + budget tracking
│
├── harvest/
│   ├── cheerio-student.ts       # Steps 2 & 4: Extraction
│   ├── budget-tracker.ts        # Budget tracking utilities
│   └── html-compressor.ts       # Compress HTML to ~5K tokens
│
└── DynamoDB Tables:
    ├── leo-domain-selectors     # Graduated selectors per domain
    ├── leo-parked-domains       # Failed domains with reasons
    └── leo-budget-tracker       # Real-time spend tracking
```

---

## Run Command

```bash
# Deploy and start
npx tsx scripts/deploy-parsing-v2.ts

# The orchestrator will:
# 1. Process domains sequentially
# 2. Track budget in real-time
# 3. STOP if budget hits $250
# 4. Log progress every 50 domains
```
