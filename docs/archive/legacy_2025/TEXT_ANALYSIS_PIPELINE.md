# Text Analysis Pipeline Documentation

**Last Updated:** 2025-01-27  
**Purpose:** Complete documentation of the A-B-C text analysis pipeline, including inputs, prompts, outputs, and data flow

## Recent Updates (2025-01-27)

### B1 Prompt Optimization
- **Spanish prompt**: Converted to Spanish for better cultural grounding
- **8 categories**: Added `caracter_arquitectonico` and `marketing_promocional`
- **Clear definitions**: Each category has specific Spanish definitions
- **Marketing handling**: Explicit instruction for subjective/promotional claims

### B3 Prompt Enhancement
- **Comprehensive coverage**: "Every claim_id must appear in at least one snippet"
- **No duplication**: "Do not repeat the same claim_id in more than one snippet"
- **Natural prose**: Focus on flowing sentences (≤140 chars)
- **Structured output**: Clear JSON format requirements
- **No examples**: Removed examples to avoid confusion

### Category Structure Update
- **8 Spanish categories**: `estado_materiales`, `espacios_distribucion`, `entorno_vistas`, `servicios_instalaciones`, `legal_economico`, `seguridad_accesibilidad`, `caracter_arquitectonico`, `marketing_promocional`
- **Updated mappings**: All components (UI, API routes, transforms) use new category names
- **Parallel processing**: B3 processes each category separately (8 parallel calls)

### WhatsApp Agent Integration (2025-01-27)
- **New endpoint**: `/api/listings/[id]/whatsapp-message`
- **Purpose**: Generate professional WhatsApp messages for agents about property unknowns
- **Features**: Uses Gemini Flash to compose contextual messages, open WhatsApp with pre-filled text
- **Integration**: "Ask Agent" button in PropertyDetails UI

## Overview

The text analysis pipeline processes property listings through 6 sequential phases (A-B-C) to extract structured insights from unstructured text. Each phase builds upon the previous one, creating increasingly sophisticated analysis.

## Pipeline Architecture

```
Raw Listing Data → A Facts → B1 Categories → B2 Merge → B3 Snippets → B4 Commentaries → C Unknowns
```

## Phase Details

### A Facts Extraction (`a_facts`)

**Purpose:** Extract factual claims from property listing data using sentence-by-sentence analysis  
**Input:** Raw listing data (title, description, roomsAndAmenities, additionalFeatures)  
**Output:** Array of factual claims with IDs  
**Status:** ✅ Working

**Prompt:** `PASS_A_PROMPT` - Performs sentence-by-sentence fact extraction

**Input:** Complete listing data object  
**Output:**
```typescript
{
  claims: [
    {
      id: "F1-1",
      text: "Property located in Puerto Portals",
      category: "location",
      confidence: "high"
    }
  ]
}
```

**Key Features:**
- Generates unique claim IDs (F1-1, F1-2, etc.)
- Processes each sentence individually
- Extracts ALL factual information
- No dependency on previous phases

---

### B1 Categorization (`b1_categorization`)

**Purpose:** Categorize claims into predefined categories  
**Input:** A facts array  
**Output:** Claims organized by category  
**Status:** ✅ Working (Parallel Processing)

**Prompt:** `PASS_B1_PROMPT` - Categorizes individual claims

**Input:** Individual claim from A  
**Output:**
```typescript
{
  categories: {
    "location": {
      "label": "Ubicación y Accesos",
      "claim_ids": ["F1-1", "F1-2"]
    },
    "structure_condition": {
      "label": "Estructura y Estado",
      "claim_ids": ["F1-3"]
    }
  },
  unassigned_claim_ids: []
}
```

**Key Features:**
- **Parallel Processing:** Processes 1 claim per call for maximum accuracy
- **Error Handling:** Individual claim failures don't break entire process
- **Category Mapping:** Maps to predefined Spanish categories

---

### B2 Merge (`b2_merge`)

**Purpose:** Merge individual categorizations into unified structure  
**Input:** Multiple B1 categorization results  
**Output:** Merged categorization with all claims  
**Status:** ✅ Working

**Input:** Array of B1 results  
**Output:**
```typescript
{
  mergedCategories: {
    categories: {
      "location": {
        "label": "Ubicación y Accesos",
        "claim_ids": ["F1-1", "F1-2", "F1-3"]
      }
    },
    unassigned_claim_ids: []
  }
}
```

**Key Logic:**
- Combines all individual categorizations
- Merges claim IDs by category
- Identifies unassigned claims

---

### B3 Snippets Generation (`b3_snippets`)

**Purpose:** Generate detailed snippets for each category  
**Input:** B2 merged categories + A facts  
**Output:** Category-specific snippets  
**Status:** ✅ Working (Natural Prose)

**Prompt:** `PASS_B3_PROMPT` - Generates natural prose snippets per category

**Input:** Category data + claims  
**Output:**
```typescript
{
  categorySnippets: {
    "location": {
      "snippets_by_category": {
        "location": [
          {
            "text": "Ubicación privilegiada en Puerto Portals con acceso directo a la marina",
            "claim_ids_used": ["F1-1", "F1-2"]
          }
        ]
      }
    }
  },
  totalSnippets: 18
}
```

**Key Features:**
- **Natural Prose:** Generates flowing, readable text instead of bullet points
- **Comprehensive Coverage:** Includes ALL relevant details from claims
- **Direct Statements:** Avoids "It has" constructions
- **Claim Attribution:** Links snippets to source claims

---

### B4 Commentaries Generation (`b4_headlines`)

**Purpose:** Generate cross-category commentaries (headlines)  
**Input:** B2 merged categories + B3 snippets + A facts  
**Output:** Compelling selling point commentaries  
**Status:** ✅ Working (Field Alignment Fixed)

**Prompt:** `PASS_B4_PROMPT` - Generates cross-category commentaries

**Input:** All previous data  
**Output:**
```typescript
{
  commentaries: [
    {
      "text": "La ubicación privilegiada en Puerto Portals con vistas al mar y acceso directo a la marina asegura un estilo de vida exclusivo y valor duradero.",
      "claim_ids_used": ["F1-2", "F1-9", "F1-12"]
    }
  ]
}
```

**Key Features:**
- **Cross-Category:** Combines insights from multiple categories
- **Selling Points:** Focuses on compelling property advantages
- **Field Alignment:** Uses `commentaries` field (not `headlines`)

---

### C Unknowns Identification (`c_unknowns`)

**Purpose:** Identify important unknowns and missing information  
**Input:** All previous analysis data  
**Output:** List of critical unknowns  
**Status:** ✅ Working

**Prompt:** `PASS_C_PROMPT` - Identifies unknowns

**Input:** Complete analysis data  
**Output:**
```typescript
{
  unknowns: [
    {
      "question": "¿Cuál es el estado exacto de la instalación eléctrica?",
      "importance": "high",
      "category": "technical"
    }
  ]
}
```

**Key Features:**
- **Critical Focus:** Identifies high-importance unknowns
- **Categorized:** Groups unknowns by type
- **Actionable:** Provides specific questions to investigate

---

## Database Schema

### `text_analysis_results` Table

```sql
CREATE TABLE text_analysis_results (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  results JSONB NOT NULL,
  status TEXT DEFAULT 'completed',
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one result per listing per phase
  UNIQUE(listing_id, phase)
);
```

**Key Constraints:**
- `UNIQUE(listing_id, phase)` prevents duplicate results
- `onConflict: 'listing_id,phase', ignoreDuplicates: false` in upsert calls

## API Endpoints

| Endpoint | Phase | Input | Output | Status |
|----------|-------|-------|--------|--------|
| `/api/listings/[id]/text-analysis/a-facts` | A | Listing data | Claims array | ✅ |
| `/api/listings/[id]/text-analysis/b1-categorization` | B1 | A claims | Categorized claims | ✅ |
| `/api/listings/[id]/text-analysis/b2-merge` | B2 | B1 results | Merged categories | ✅ |
| `/api/listings/[id]/text-analysis/b3-snippets` | B3 | B2 + A | Category snippets | ✅ |
| `/api/listings/[id]/text-analysis/b4-headlines` | B4 | B2 + B3 + A | Commentaries | ✅ |
| `/api/listings/[id]/text-analysis/c-unknowns` | C | All data | Unknowns list | ✅ |
| `/api/listings/[id]/whatsapp-message` | - | Listing + C unknowns | WhatsApp URL | ✅ |

## Orchestration

### URL-to-C Stream Orchestrator

**Endpoint:** `/api/orchestrate-url-to-c2-stream`  
**Purpose:** Complete pipeline from URL to C analysis  
**Status:** ✅ Working

**Flow:**
1. **Scraping:** Extract property data and photos
2. **A-C Analysis:** Run all text analysis phases
3. **Streaming:** Real-time progress updates
4. **Completion:** Full analysis results

**Test Command:**
```bash
curl -X POST http://localhost:3002/api/orchestrate-url-to-c2-stream \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.idealista.com/inmueble/105445918/"}'
```

## Recent Fixes Applied

### B3 Snippets Counting Fix (2025-01-27)
- **Issue:** Incorrect counting of nested snippet arrays
- **Root Cause:** `snippets_by_category` has nested structure
- **Fix:** Updated counting logic to traverse nested arrays
- **Result:** Now correctly reports 18 snippets instead of 0

### B4 Field Alignment Fix (2025-01-27)
- **Issue:** AI returning `commentaries` but code expecting `headlines`
- **Root Cause:** Prompt and code field mismatch
- **Fix:** Updated prompt to return `commentaries` field
- **Result:** Now correctly extracts 5 commentaries

### Database Upsert Conflicts Fix (2025-01-27)
- **Issue:** `UNIQUE(listing_id, phase)` constraint causing upsert failures
- **Root Cause:** Missing `onConflict` parameter in upsert calls
- **Fix:** Added `onConflict: 'listing_id,phase', ignoreDuplicates: false`
- **Result:** All phases can now save results successfully

### B1 Error Handling Improvement (2025-01-27)
- **Issue:** Individual claim failures breaking entire categorization
- **Root Cause:** `Promise.all` throwing on single failure
- **Fix:** Individual error handling with fallback objects
- **Result:** Pipeline continues even if some claims fail

## Testing Commands

```bash
# Test individual phases
curl -X POST http://localhost:3002/api/listings/1000000118/text-analysis/a-facts
curl -X POST http://localhost:3002/api/listings/1000000118/text-analysis/b1-categorization
curl -X POST http://localhost:3002/api/listings/1000000118/text-analysis/b2-merge
curl -X POST http://localhost:3002/api/listings/1000000118/text-analysis/b3-snippets
curl -X POST http://localhost:3002/api/listings/1000000118/text-analysis/b4-headlines
curl -X POST http://localhost:3002/api/listings/1000000118/text-analysis/c-unknowns

# Test complete pipeline
curl -X POST http://localhost:3002/api/orchestrate-url-to-c2-stream \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.idealista.com/inmueble/105445918/"}'
```

## Performance Metrics

- **A-C Complete Pipeline:** ~2 minutes
- **Individual Phase:** ~10-30 seconds
- **B1 Parallel Processing:** 7 claims processed simultaneously
- **Database Operations:** All upserts successful with conflict resolution

## Status Summary

| Phase | Status | Input | Output | Key Features |
|-------|--------|-------|--------|--------------|
| A | ✅ | Listing data | Claims | Sentence-by-sentence extraction |
| B1 | ✅ | Claims | Categories | Parallel processing |
| B2 | ✅ | B1 results | Merged | Category consolidation |
| B3 | ✅ | B2 + A | Snippets | Natural prose |
| B4 | ✅ | All data | Commentaries | Field alignment |
| C | ✅ | All data | Unknowns | Critical focus |

**Overall Pipeline Status:** ✅ **FULLY FUNCTIONAL**

---

**Note:** This documentation should be updated whenever the pipeline is modified, tested, or fixed to maintain accurate technical reference.
