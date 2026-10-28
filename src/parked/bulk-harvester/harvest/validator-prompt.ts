/**
 * Enhanced Validator Prompt - Active Search Mode
 * 
 * Instead of just verifying what was extracted, this prompt
 * tells the Validator to ACTIVELY SEARCH for all data and then compare.
 * This catches silent failures where Cheerio returned null but data exists.
 */

export interface ValidationInput {
  domain: string;
  html: string;
  extracted: Record<string, any>;
  selectors: Record<string, string | null>;
}

export interface ValidationOutput {
  valid: boolean;
  confidence: number;  // 0.0 - 1.0
  essentialFieldsFound: number;  // How many of price/bedrooms/m2 were found
  issues: string[];
  missedData: {
    field: string;
    foundValue: string;
    location: string;  // Where in HTML it was found
  }[];
  suggestions: string[];
}

/**
 * Generate the enhanced Validator prompt
 */
export function generateValidatorPrompt(input: ValidationInput): string {
  const { domain, html, extracted, selectors } = input;

  return `You are a DATA EXTRACTION AUDITOR for Spanish real estate listings.

## YOUR MISSION
ACTIVELY SEARCH the HTML for ALL property data, then check if we got everything.
Do NOT just verify what was extracted - HUNT for data we might have missed.

## DOMAIN: ${domain}

## WHAT WE EXTRACTED (using Cheerio):
${JSON.stringify(extracted, null, 2)}

## SELECTORS WE USED:
${JSON.stringify(selectors, null, 2)}

## HTML TO AUDIT (search EVERYWHERE including script tags):
${html.slice(0, 80000)}

---

## STEP 1: ACTIVE DATA HUNT

Search for these fields IN ORDER OF IMPORTANCE:

### ESSENTIAL (must have at least one):
1. **PRICE** - Look for: €, EUR, euros, precio, price in HTML AND in script tags (JSON, variables)
2. **BEDROOMS** - Look for: habitaciones, dormitorios, rooms, bedrooms
3. **AREA (m²)** - Look for: m², metros, superficie, m2, square meters

### IMPORTANT:
4. **ADDRESS** - Full address, street, neighborhood
5. **CITY** - Ciudad, location
6. **DESCRIPTION** - Property description text
7. **PHOTOS** - Image URLs, gallery arrays in scripts

### NICE TO HAVE:
8. **BATHROOMS** - baños, bathrooms
9. **REFERENCE** - Ref, ID, código
10. **AGENCY** - Agent/agency name, phone

## STEP 2: CHECK SCRIPT TAGS

Script tags often contain gold! Look for:
- \`<script type="application/ld+json">\` - Structured data
- \`var listingData = {...}\` - Listing objects
- \`window.__INITIAL_STATE__\` - App state
- \`fullScreenGalleryPics\` - Photo arrays
- \`latitude\`, \`longitude\` - Coordinates

## STEP 3: COMPARE AND REPORT

For each field:
- Did we extract it? ✓ or ✗
- If ✗, is it actually in the HTML?
- If yes, WHERE? (give the selector or location)

## STEP 4: ESSENTIAL FIELDS CHECK

Count how many ESSENTIAL fields we successfully extracted:
- Price: extracted or found?
- Bedrooms: extracted or found?
- Area (m²): extracted or found?

**If 0 essential fields: This extraction FAILED**
**If 1-2 essential fields: Needs improvement**
**If 3 essential fields: Good extraction**

---

## OUTPUT FORMAT (JSON only):

{
  "valid": true/false,
  "confidence": 0.0-1.0,
  "essentialFieldsFound": 0-3,
  "issues": [
    "Price not extracted but found at .precio-inmueble",
    "Bedrooms missed - found in JSON-LD"
  ],
  "missedData": [
    {
      "field": "price",
      "foundValue": "€250,000",
      "location": "script[type='application/ld+json'] → price"
    }
  ],
  "suggestions": [
    "Use '.precio-inmueble' instead of '.price' for price",
    "Check JSON-LD for bedrooms"
  ]
}

## VALIDATION RULES:
- valid=true ONLY if: essentialFieldsFound >= 2 AND no critical issues
- valid=false if: essentialFieldsFound < 2 OR major data is missing
- Be STRICT - we need quality data

OUTPUT JSON ONLY.`;
}

/**
 * Parse Validator response
 */
export function parseValidatorResponse(text: string): ValidationOutput {
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      valid: Boolean(parsed.valid),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      essentialFieldsFound: typeof parsed.essentialFieldsFound === 'number' ? parsed.essentialFieldsFound : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      missedData: Array.isArray(parsed.missedData) ? parsed.missedData : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch (error: any) {
    return {
      valid: false,
      confidence: 0,
      essentialFieldsFound: 0,
      issues: [`Failed to parse validator response: ${error.message}`],
      missedData: [],
      suggestions: [],
    };
  }
}

/**
 * Generate re-teach prompt with failure history
 */
export function generateReteachPrompt(
  originalHtml: string,
  domain: string,
  failedSelectors: Record<string, string | null>,
  validationFailures: ValidationOutput[]
): string {
  // Collect all issues and suggestions from failures
  const allIssues = validationFailures.flatMap(v => v.issues);
  const allMissedData = validationFailures.flatMap(v => v.missedData);
  const allSuggestions = validationFailures.flatMap(v => v.suggestions);

  return `## CORRECTION NEEDED - Previous selectors failed validation

### DOMAIN: ${domain}

### WHAT FAILED:
${allIssues.map(i => `- ${i}`).join('\n')}

### DATA WE MISSED:
${allMissedData.map(m => `- ${m.field}: "${m.foundValue}" at ${m.location}`).join('\n')}

### VALIDATOR SUGGESTIONS:
${allSuggestions.map(s => `- ${s}`).join('\n')}

### PREVIOUS SELECTORS (these didn't work well):
${JSON.stringify(failedSelectors, null, 2)}

### HTML TO RE-ANALYZE:
${originalHtml.slice(0, 100000)}

---

Based on the failure feedback above, generate CORRECTED selectors.
Pay special attention to:
1. The locations where data WAS found (in missedData)
2. The specific suggestions from the validator
3. Script tags and JSON-LD if regular selectors failed

OUTPUT JSON SELECTORS ONLY.`;
}

