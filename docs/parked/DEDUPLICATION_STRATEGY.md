# 🔒 Deduplication Strategy: The "Waterfall" Identity System

**Status**: Draft  
**Goal**: Prevent duplicate listings, save AI costs, and maintain a Single Source of Truth (SSOT).

---

## 1. The Problem

We ingest listings from multiple sources (Idealista, Agency Websites, User Extension).  
A single property often exists in multiple places with slightly different URLs but the same underlying identity.

**Duplicate listings cause:**
1.  **Wasted Money**: Re-running expensive Whole Property & Room-by-Room analysis ($0.50 - $1.00 per duplicate).
2.  **Fragmented Data**: A user might "Fit Score" one version but not see the other.
3.  **Polluted Search**: Recommendations might show the same house twice.

---

## 2. The Solution: "Waterfall" Identity Resolution

We implement a **3-Level Check** before creating any new listing. The system stops at the first match found.

### 🌊 Level 1: The URL Check (Exact)
*   **Logic**: `source_url` exact match.
*   **Status**: ✅ Implemented.
*   **Use Case**: User clicks the extension button twice on the exact same page.

### 🌊 Level 2: The Reference Check (Smart)
*   **Logic**: Match `reference_number` + **Secondary Validation**.
*   **The Challenge**: "Ref-1" from Agency A might be a different house than "Ref-1" from Agency B.
*   **The Fix (Secondary Signal)**:
    *   **Primary**: Normalized Reference Match (e.g., "REF-123" -> "123").
    *   **Validation**: 
        *   Price is within ±5% (Prices change slightly between portals).
        *   **OR** City/Postal Code matches exactly.
*   **Status**: 🚧 Planned.
*   **Use Case**: 
    *   Listing A: Idealista URL (Ref: "VILLA-22")
    *   Listing B: Agency Website URL (Ref: "VILLA-22")
    *   **Result**: Merged into one SSOT.

### 🌊 Level 3: The Content Fingerprint (Future)
*   **Logic**: Visual hash of main image OR Fuzzy Address Match.
*   **Status**: ⏳ Future.

---

## 3. Implementation Plan

### Step 1: Normalization Utility (`src/lib/utils/listing-identity.ts`)
We need a shared brain for cleaning references.

```typescript
export function normalizeReference(ref: string): string {
  if (!ref) return '';
  return ref
    .replace(/^(ref|reference|referencia)[:\.]?/i, '') // Remove "Ref:" prefix
    .replace(/[\s\-_]/g, '') // Remove spaces, dashes, underscores
    .toUpperCase(); // Standardize case
}
```

### Step 2: Upgrade Ingestion Endpoints
Modify `/api/ingest/server` and `/api/ingest/browser`.

**Pseudo-Code Flow:**

```typescript
// 1. Normalize Input
const normRef = normalizeReference(scrapedData.reference);
const inputPrice = scrapedData.price;

// 2. Check URL (Level 1)
let match = await db.listings.find({ source_url: url });

// 3. Check Reference (Level 2) - Only if no URL match
if (!match && normRef.length > 2) { // Ignore short refs like "1", "A"
  const candidates = await db.listings.find({ 
    reference_number: normRef // DB column should be normalized or we normalize on query
  });
  
  for (const candidate of candidates) {
    // Secondary Validation: Price Safety Check
    const priceDiff = Math.abs(candidate.price - inputPrice);
    const percentDiff = priceDiff / inputPrice;
    
    if (percentDiff < 0.05) { // 5% tolerance
      match = candidate;
      console.log(`✅ Deduplication: Linked via Reference ${normRef} (Price delta: ${percentDiff*100}%)`);
      break; 
    }
  }
}

// 4. Upsert or Insert
if (match) {
  updateListing(match.id, scrapedData);
  return match.id;
} else {
  return createListing(scrapedData);
}
```

### Step 3: Database Indexing
Ensure `listings.reference_number` is indexed for fast Level 2 lookups.

```sql
CREATE INDEX IF NOT EXISTS idx_listings_reference_number ON listings(reference_number);
```

---

## 4. Handling "The Match Both" Constraint

User Concern: *"The ref system might be used by another agent though, so it has to match both..."*

**Scenario**: 
*   Agent A lists Property X as "Ref: 100".
*   Agent B lists Property Y as "Ref: 100".

**Our Protection**:
The **Secondary Validation (Price Check)** is the firewall.
*   If Property X is €500k and Property Y is €2M -> **No Match** (Safe).
*   If Property X is €500k and Property Y is €500k -> **Potential Match**.
    *   *Edge Case*: Two different houses, same price, same ref, different agents. Very rare in the same region, but possible.
    *   *Refinement*: Add **City Check**. Matches must have same Ref AND (Price ~Match) AND (City Exact Match).

This "Triangulation" (Ref + Price + City) makes false positives statistically impossible for our use case.

