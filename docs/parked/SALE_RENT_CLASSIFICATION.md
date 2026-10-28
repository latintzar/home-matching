# Sale/Rent Classification Strategy

> **Status**: Design Complete  
> **Last Updated**: December 1, 2025  
> **Principle**: LLM is expensive. Use code to learn patterns from LLM output.

---

## The Problem

- 297K URLs in `leo-urls`
- 17% can be classified by URL pattern (venta, alquiler in URL)
- **83% unknown** - need to see HTML to classify

**Constraint**: Can't afford LLM on every URL. Mistral costs ~$0.0004/call × 250K = $100

---

## Strategy: Pattern Learning from Parsed Samples

### Concept

```
Phase 1: Parse sample (LLM extracts operation_type)
         ↓
Phase 2: Learn patterns (code analyzes URL→type mappings)
         ↓
Phase 3: Apply patterns (code classifies rest without LLM)
         ↓
Phase 4: LLM only for ambiguous (fallback)
```

---

## Implementation

### Phase 1: Parsing (Already Designed)

During parsing (`parse-html-batch.ts`), the Teacher LLM already extracts:

```typescript
// bedrock-teacher.ts extractWithLLM()
{
  "operation_type": "sale" | "rent",
  // ... other fields
}
```

This gets saved to `leo-listings` table.

**After parsing 10K-50K URLs**, we have ground truth:
```
URL: https://inmobiliaria.com/piso-venta-madrid-12345
operation_type: sale

URL: https://inmobiliaria.com/apartamento-alquiler-bcn-67890
operation_type: rent
```

---

### Phase 2: Pattern Learning Script

**New script**: `src/scripts/learn-operation-patterns.ts`

```typescript
/**
 * Learn Sale/Rent URL Patterns
 * 
 * Analyzes parsed listings to find URL patterns that predict operation_type.
 * Run AFTER initial parsing batch.
 * 
 * Output: Pattern rules per domain stored in leo-scraping-rules
 */

interface PatternRule {
  pattern: string;           // RegExp source
  operation_type: 'sale' | 'rent';
  confidence: number;        // 0-1, how often this pattern is correct
  sample_size: number;       // How many URLs we learned from
}

interface DomainPatterns {
  domain: string;
  patterns: PatternRule[];
  default_type?: 'sale' | 'rent';  // If domain is 95%+ one type
  coverage: number;          // % of URLs that match a pattern
}

async function learnPatterns(): Promise<void> {
  // 1. Get all parsed listings from leo-listings
  const listings = await getAllParsedListings();
  
  // 2. Group by domain
  const byDomain = groupByDomain(listings);
  
  // 3. For each domain, find patterns
  for (const [domain, domainListings] of byDomain) {
    const patterns = analyzeUrlPatterns(domain, domainListings);
    await savePatterns(domain, patterns);
  }
}

function analyzeUrlPatterns(domain: string, listings: ParsedListing[]): PatternRule[] {
  const patterns: PatternRule[] = [];
  
  // Known patterns to check
  const KNOWN_PATTERNS = [
    { regex: /venta/i, type: 'sale' },
    { regex: /en-venta/i, type: 'sale' },
    { regex: /comprar/i, type: 'sale' },
    { regex: /for-sale/i, type: 'sale' },
    { regex: /verkauf/i, type: 'sale' },
    { regex: /alquiler/i, type: 'rent' },
    { regex: /en-alquiler/i, type: 'rent' },
    { regex: /rent/i, type: 'rent' },
    { regex: /arrendar/i, type: 'rent' },
    { regex: /miete/i, type: 'rent' },
  ];
  
  // Check each known pattern
  for (const { regex, type } of KNOWN_PATTERNS) {
    const matching = listings.filter(l => regex.test(l.url));
    if (matching.length > 0) {
      const correct = matching.filter(l => l.operation_type === type).length;
      const confidence = correct / matching.length;
      
      if (confidence > 0.8 && matching.length >= 5) {
        patterns.push({
          pattern: regex.source,
          operation_type: type,
          confidence,
          sample_size: matching.length,
        });
      }
    }
  }
  
  // Also discover NEW patterns from URL structure
  // e.g., /tipo/venta vs /tipo/alquiler
  const discoveredPatterns = discoverNewPatterns(domain, listings);
  patterns.push(...discoveredPatterns);
  
  return patterns;
}

function discoverNewPatterns(domain: string, listings: ParsedListing[]): PatternRule[] {
  // Analyze URL path segments
  // Find segments that correlate with operation_type
  // e.g., /properties/sale vs /properties/rent
  
  const patterns: PatternRule[] = [];
  
  // Split URLs into segments
  const saleUrls = listings.filter(l => l.operation_type === 'sale').map(l => new URL(l.url).pathname);
  const rentUrls = listings.filter(l => l.operation_type === 'rent').map(l => new URL(l.url).pathname);
  
  // Find discriminating segments
  const saleSegments = findCommonSegments(saleUrls);
  const rentSegments = findCommonSegments(rentUrls);
  
  // Segments in sale but not rent → sale pattern
  for (const seg of saleSegments) {
    if (!rentSegments.includes(seg) && seg.length > 2) {
      patterns.push({
        pattern: `/${seg}/`,
        operation_type: 'sale',
        confidence: 0.9,
        sample_size: saleUrls.filter(u => u.includes(`/${seg}/`)).length,
      });
    }
  }
  
  // Similar for rent...
  
  return patterns;
}
```

---

### Phase 3: Apply Patterns to Unclassified URLs

**New script**: `src/scripts/classify-urls.ts`

```typescript
/**
 * Classify URLs using learned patterns
 * 
 * For URLs not yet parsed, use pattern rules to predict operation_type.
 * No LLM needed.
 */

async function classifyUrls(): Promise<void> {
  // 1. Get all URLs from leo-urls that haven't been parsed
  const unclassified = await getUnparsedUrls();
  
  // 2. Get pattern rules per domain
  const rules = await getAllPatternRules();
  
  // 3. Classify each URL
  for (const url of unclassified) {
    const domain = getDomain(url);
    const domainRules = rules[domain];
    
    if (domainRules) {
      const classification = applyRules(url, domainRules);
      if (classification) {
        await updateUrlClassification(url, classification);
      }
    }
  }
}

function applyRules(url: string, rules: DomainPatterns): 'sale' | 'rent' | null {
  // Try each pattern
  for (const rule of rules.patterns) {
    if (new RegExp(rule.pattern, 'i').test(url)) {
      if (rule.confidence >= 0.85) {
        return rule.operation_type;
      }
    }
  }
  
  // Check domain default
  if (rules.default_type && rules.coverage < 0.5) {
    // Domain is mostly one type
    return rules.default_type;
  }
  
  return null; // Ambiguous, needs LLM during parsing
}
```

---

### Phase 4: LLM Fallback (Only for Ambiguous)

URLs that couldn't be classified by patterns get classified during parsing.
The Student/Teacher system already does this.

**No additional work needed** - just let parsing handle the ~10-20% that patterns can't classify.

---

## Data Model

### leo-urls (add field)

```typescript
{
  url: string;
  domain: string;
  // ... existing fields ...
  
  // NEW:
  operation_type?: 'sale' | 'rent' | 'unknown';  // Predicted or from parsing
  classification_source?: 'pattern' | 'llm';     // How we classified
}
```

### leo-scraping-rules (add field)

```typescript
{
  domain: string;
  selectors: {...};
  // ... existing fields ...
  
  // NEW:
  operation_patterns?: PatternRule[];    // Learned patterns for sale/rent
  default_operation?: 'sale' | 'rent';   // If domain is mostly one type
}
```

---

## Execution Order

```
1. INITIAL HARVEST
   - Spider all domains
   - Download all HTMLs to S3
   - Record URLs in leo-urls (no classification yet)

2. SAMPLE PARSING (~10K URLs)
   - Run parse-html-batch.ts --limit=10000
   - LLM extracts operation_type for each
   - Save to leo-listings

3. LEARN PATTERNS
   - Run learn-operation-patterns.ts
   - Analyze URL→operation_type mappings
   - Save patterns to leo-scraping-rules

4. CLASSIFY ALL URLS
   - Run classify-urls.ts
   - Apply patterns to all URLs in leo-urls
   - Mark classified URLs with operation_type

5. FULL PARSING
   - Run parse-html-batch.ts (all remaining)
   - Pattern-classified URLs: skip LLM for operation_type
   - Unclassified URLs: LLM fills in operation_type

6. GENERATE URL→CATEGORY TABLE
   - Export leo-urls with operation_type
   - Use for analytics, filtering, etc.
```

---

## Cost Comparison

### Without Pattern Learning
```
250K URLs × $0.0004/LLM call = $100
```

### With Pattern Learning
```
10K sample × $0.0004 = $4        (initial learning)
+ 25K ambiguous × $0.0004 = $10  (fallback)
= $14 total

Savings: ~$86 (86%)
```

---

## Output: URL Category Table

After all phases, we can export:

```sql
-- Export URL category table
SELECT 
  domain,
  url,
  operation_type,
  classification_source,
  COUNT(*) OVER (PARTITION BY domain, operation_type) as count_per_domain
FROM leo_urls
WHERE operation_type IS NOT NULL
ORDER BY domain, operation_type;
```

Or as a summary:

```sql
-- Summary per domain
SELECT 
  domain,
  COUNT(*) FILTER (WHERE operation_type = 'sale') as sale_count,
  COUNT(*) FILTER (WHERE operation_type = 'rent') as rent_count,
  COUNT(*) FILTER (WHERE operation_type IS NULL) as unknown_count
FROM leo_urls
GROUP BY domain
ORDER BY (sale_count + rent_count) DESC;
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Pattern coverage | >80% of URLs classified by pattern |
| Pattern accuracy | >90% match LLM classification |
| LLM fallback | <20% of URLs need LLM |
| Total cost | <$20 for classification |

---

*This approach uses LLM to learn, then code to scale.*

