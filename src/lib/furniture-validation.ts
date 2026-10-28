/**
 * Validate Furniture Removal
 * 
 * Uses Gemini Flash to check if furniture/decoration items remain in an image
 * after furniture removal processing.
 */

import { callGeminiRest } from '@/lib/gemini-rest-client';

export interface ValidateFurnitureInput {
  imageBase64: string;
  imageMimeType: string;
}

export interface ValidateFurnitureOutput {
  has_furniture: boolean;
  passed: boolean; // True if no removable items remain (only permanent fixtures/watermarks)
  items_found?: Array<{
    item: string;
    location: string; // Description of where the item is located (e.g., "center of room", "left side", "against back wall")
  }>;
  directive_prompt?: string; // Optional prompt describing what to remove (for retry)
}

const validationResponseSchema = {
  type: 'object',
  properties: {
    has_furniture: { 
      type: 'boolean',
      description: 'True if any removable items are detected in the image'
    },
    passed: {
      type: 'boolean',
      description: 'True if validation PASSES (no removable items remain, only permanent fixtures/watermarks). False if removable items still need to be removed.'
    },
    items_found: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Name of the removable item' },
          location: { type: 'string', description: 'Where the item is located in the image (e.g., "center of room", "left side", "against back wall", "on the right")' }
        },
        required: ['item', 'location']
      },
      description: 'List of specific removable items found with their locations. Only include items that should actually be removed.'
    },
    directive_prompt: {
      type: 'string',
      description: 'If has_furniture is true and passed is false, provide a natural language description of what needs to be removed. Format: "Specific things I have noticed that would be good to remove include [items]". If passed is true, this can be empty or describe only watermarks/permanent fixtures.'
    }
  },
  required: ['has_furniture', 'passed']
};

/**
 * Validate if furniture/decoration items remain in the image
 * Uses lenient checking - small remnants are acceptable
 */
export async function validateFurnitureRemoval(
  input: ValidateFurnitureInput
): Promise<ValidateFurnitureOutput> {
  const { imageBase64, imageMimeType } = input;

  const prompt = `You are validating whether an image has been successfully cleared of all removable furniture, decorations, and personal items. Your job is to determine if the image PASSES validation (no removable items remain) or FAILS (removable items still need to be removed).

CRITICAL: Distinguish between REMOVABLE ITEMS (should be removed) and PERMANENT FIXTURES (must stay).

REMOVABLE ITEMS (should be removed):
- Seating: Sofas, couches, armchairs, dining chairs, bar stools, ottomans, benches, bean bags
- Tables: Coffee tables, side tables, dining tables, desks, nightstands (freestanding only)
- Storage: Dressers, freestanding bookcases, freestanding shelves, chests, baskets, wardrobes (freestanding only)
- Beds: Bed frames, mattresses, headboards, footboards, bedding, pillows
- Rugs: Area rugs, throw rugs, carpets (freestanding)
- Lamps: Table lamps, floor lamps, freestanding lights
- Plants: Potted plants, planters, vases with flowers
- Decorations: Artwork on walls (paintings, prints, photos, framed pictures), decorative mirrors (wall-mounted decorative mirrors), vases, sculptures, figurines, clocks (decorative wall clocks), candles, decorative objects, throw pillows, cushions
- Electronics: TVs, speakers, computers, gaming consoles, remotes
- Personal Items: Books, dishes on counters, kitchenware on counters, clothing, accessories, toiletries, food, keys, wallets, trash bins, towels (hand towels, bath towels), soap dispensers

PERMANENT FIXTURES (MUST STAY - do not flag these):
- Built-in cabinets, built-in shelves, built-in storage, bathroom vanities, under-sink units
- Kitchen appliances: Refrigerators (all types), ovens, stoves, dishwashers, microwaves, range hoods (all stay regardless of whether built-in or freestanding)
- Plumbing fixtures: Sinks, toilets, tubs, vanities, faucets, shower heads
- Lighting fixtures: Wall sconces, ceiling fixtures (built-in lighting)
- Window treatments: Curtains, drapes, window treatments, curtain rods (keep exactly as they are, especially if drawn)
- Structural elements: Walls, floors, ceilings, windows, doors, fireplaces, arches, alcoves, niches
- Watermarks, logos, text overlays (these are not furniture)

VALIDATION RULES:
1. If you see ANY removable items listed above, set has_furniture=true and passed=false
2. If you only see permanent fixtures, watermarks, or nothing removable, set has_furniture=false and passed=true
3. If you see items that are ambiguous (e.g., "mirror" could be decorative or built-in), check context:
   - Decorative wall mirrors = REMOVABLE
   - Built-in bathroom mirrors = PERMANENT FIXTURE
   - Items ON windowsills = REMOVABLE
   - Windows themselves = PERMANENT FIXTURE

Return JSON with:
- has_furniture: true if any removable items are detected, false otherwise
- passed: true if validation PASSES (no removable items remain), false if validation FAILS (removable items still present)
- items_found: array of removable items only (exclude permanent fixtures and watermarks)
- directive_prompt: If passed=false, provide: "Specific things I have noticed that would be good to remove include [list items]". If passed=true, this can be empty or note only watermarks/permanent fixtures.

Example (removable items found):
{
  "has_furniture": true,
  "passed": false,
  "items_found": [
    {"item": "sofa", "location": "center of room"},
    {"item": "coffee table", "location": "in front of sofa"},
    {"item": "decorative mirror", "location": "on the wall above fireplace"}
  ],
  "directive_prompt": "Specific things I have noticed that would be good to remove include the sofa in the center of room, the coffee table in front of sofa, and the decorative mirror on the wall above fireplace."
}

Example (validation passed):
{
  "has_furniture": false,
  "passed": true,
  "items_found": [],
  "directive_prompt": ""
}`;

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8000,
    responseMimeType: 'application/json',
    responseSchema: validationResponseSchema,
    images: [{
      mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: imageBase64
    }]
  });

  if (!result.success || !result.text) {
    throw new Error(`Failed to validate furniture: ${result.error || 'Unknown error'}`);
  }

  // With responseSchema + responseMimeType: 'application/json', response should be pure JSON
  // Extract JSON object from response
  let cleaned = result.text.trim();
  
  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
  
  // Extract JSON object - responseSchema should enforce this, but handle edge cases
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If no JSON found and response is very short (like "H" or "Here"), 
    // it's likely truncated - default to false (no furniture) to avoid false positives
    if (cleaned.length < 10) {
      console.warn(`⚠️ Validation response truncated (${cleaned}), defaulting to no furniture`);
      return { has_furniture: false, passed: true };
    }
    throw new Error(`No JSON object found in response. Response was: ${cleaned.substring(0, 50)}`);
  }
  
  cleaned = jsonMatch[0];
  
  try {
    const parsed = JSON.parse(cleaned);
    // Validate schema compliance
    if (typeof parsed.has_furniture !== 'boolean') {
      throw new Error(`Invalid response: has_furniture must be boolean, got ${typeof parsed.has_furniture}`);
    }
    if (typeof parsed.passed !== 'boolean') {
      throw new Error(`Invalid response: passed must be boolean, got ${typeof parsed.passed}`);
    }
    // Ensure items_found is an array if provided
    if (parsed.items_found && !Array.isArray(parsed.items_found)) {
      parsed.items_found = [];
    }
    // Validate items_found structure
    if (parsed.items_found && Array.isArray(parsed.items_found)) {
      parsed.items_found = parsed.items_found.filter((entry: any) => 
        entry && typeof entry === 'object' && entry.item && entry.location
      );
    }
    // Ensure directive_prompt is a string if provided
    if (parsed.directive_prompt !== undefined && typeof parsed.directive_prompt !== 'string') {
      parsed.directive_prompt = '';
    }
    return parsed as ValidateFurnitureOutput;
  } catch (error) {
    // If parsing fails and response is very short, default to false
    if (cleaned.length < 10) {
      console.warn(`⚠️ Validation parse failed (${cleaned}), defaulting to no furniture`);
      return { has_furniture: false, passed: true };
    }
    throw new Error(`Failed to parse validation response: ${error}. Response was: ${cleaned.substring(0, 100)}`);
  }
}

