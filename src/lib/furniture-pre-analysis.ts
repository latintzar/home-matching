/**
 * Pre-Analysis for Furniture Removal
 * 
 * Uses Gemini Flash to analyze the original image and generate a comprehensive
 * list of removable items BEFORE the main removal generation step.
 * This reduces costs and improves targeting.
 */

import { callGeminiRest } from '@/lib/gemini-rest-client';

export interface PreAnalysisInput {
  imageBase64: string;
  imageMimeType: string;
}

export interface PreAnalysisOutput {
  removalList: string; // Plain English comprehensive list of items to remove
}

export interface DirectivePromptOutput {
  directivePrompt: string; // Ready-to-use directive prompt for image generation
  hasItems: boolean; // Whether any removable items were found
}

/**
 * Analyze original image and generate comprehensive list of items to remove
 * Uses plain English, catch-all approach for maximum coverage
 */
export async function analyzeFurnitureForRemoval(
  input: PreAnalysisInput
): Promise<PreAnalysisOutput> {
  const { imageBase64, imageMimeType } = input;

  const prompt = `You are analyzing an image to identify ALL removable furniture, decorations, and personal items that need to be removed. Your job is to create a detailed, specific list that will be used to instruct an image editor.

SCAN THE ENTIRE IMAGE CAREFULLY and list EVERY removable item you can see.

CRITICAL: Check ALL areas of the image:
- Foreground items (close to camera)
- Midground items (middle distance)
- Background items (far away, in the distance)
- Items visible through doorways, archways, windows
- Items visible in reflections (mirrors, glass)
- Items partially visible or obscured
- Items in adjacent rooms visible through openings
- Items on balconies, patios, or outdoor areas visible through windows/doors
- Items in the far distance or background

Don't miss items just because they're far away, in the background, or partially visible - if you can see them, list them.

REMOVABLE ITEMS - CHECK ALL OF THESE:

**SEATING:**
- Sofas, couches, loveseats, sectionals
- Armchairs, accent chairs, recliners
- Dining chairs, bar stools, counter stools
- Ottomans, poufs, footstools
- Benches, window seats
- Bean bags, floor cushions
- Any chairs or seating furniture

**TABLES:**
- Coffee tables, cocktail tables
- Side tables, end tables, accent tables
- Console tables, sofa tables
- Dining tables, kitchen tables
- Bedside tables, nightstands
- Desks, writing tables
- Any freestanding tables

**STORAGE:**
- Dressers, chests of drawers
- Bookcases, bookshelves, freestanding shelves
- Cabinets, wardrobes, armoires
- Storage boxes, baskets, bins
- Trunks, storage chests
- Any freestanding storage furniture

**BEDS:**
- Beds, bed frames (all types: metal, wood, upholstered)
- Headboards, footboards, bed frames
- Mattresses, box springs
- Bedding: sheets, blankets, duvets, comforters, bedspreads
- Pillows, throw pillows, cushions
- Bed skirts, valances
- Any bed-related furniture

**RUGS & FLOOR COVERINGS:**
- Area rugs, throw rugs
- Carpets (freestanding)
- Floor mats, door mats
- Runners, hallway rugs

**LIGHTING:**
- Table lamps, desk lamps
- Floor lamps, standing lamps
- Freestanding lights, task lights
- Any portable lighting fixtures

**PLANTS & FLOWERS:**
- Potted plants, planters
- Vases with flowers or plants
- Decorative plant arrangements
- Hanging plants

**DECORATIONS:**
- Artwork on walls (paintings, prints, photos, framed pictures)
- Mirrors (freestanding or decorative, wall-mounted decorative mirrors)
- Vases, decorative bowls
- Sculptures, figurines, statues
- Clocks (freestanding or decorative, wall clocks)
- Candles, candle holders, candelabras
- Decorative objects, knick-knacks
- Throw pillows, cushions
- Decorative plates, wall plates
- Wall hangings, tapestries, wall art
- Curtains, drapes, window treatments, curtain rods
- Hanging decorations (wind chimes, mobiles, hanging plants)
- String lights, decorative lighting
- Wall-mounted decorations, wall art
- Hanging baskets, wall planters
- Any decorative items hanging from walls or ceilings

**ELECTRONICS:**
- TVs, televisions
- Speakers, sound systems
- Computers, laptops, tablets
- Gaming consoles, game systems
- Remote controls
- Chargers, cables, wires
- Any electronic devices

**PERSONAL ITEMS:**
- Books, magazines, newspapers
- Dishes, plates, bowls on counters
- Kitchenware on counters (utensils, cutting boards, etc.)
- Clothing, accessories
- Toiletries, personal care items
- Food items, beverages
- Keys, wallets, bags, purses
- Backpacks, suitcases, luggage
- Trash bins, wastebaskets
- Cleaning supplies
- Towels (hand towels, bath towels)
- Soap dispensers, personal hygiene products
- Shavers, razors, toothbrushes
- Bottles, containers, jars
- Any personal belongings

**OUTDOOR & OTHER:**
- Outdoor furniture (chairs, tables, loungers)
- Exercise equipment
- Pet items (beds, toys, bowls)
- Toys, games
- Any other movable objects

FOR EACH ITEM, specify:
- What it is (be specific: "brown leather sofa" not just "sofa")
- Where it is located (e.g., "in center of room", "against left wall", "on right side", "in foreground", "on coffee table", "on countertop")

OUTPUT FORMAT: Start immediately with a numbered list. Do NOT include any preamble, explanation, or introductory text. Begin directly with "1. " followed by the first item.

Each item should be on its own line with its location.
Example format:
1. Brown leather sofa in center of room
2. Glass coffee table in front of sofa
3. Throw pillows on sofa
4. Floor lamp on left side of room
5. Area rug under coffee table

CRITICAL: Start your response immediately with "1. " - no other text before it. Be exhaustive - if you see it and it's removable, list it. Don't miss small items like cushions, books, decorative objects, or personal items. Check every corner, surface, and area of the image.`;

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 20000, // Increased to handle many items
    thinkingConfig: {
      thinkingBudget: -1 // Auto thinking budget for better reasoning
    },
    images: [{
      mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: imageBase64
    }]
  });

  if (!result.success || !result.text) {
    throw new Error(`Failed to analyze furniture: ${result.error || 'Unknown error'}`);
  }

  return {
    removalList: result.text.trim()
  };
}

/**
 * Generate a directive prompt for removing furniture from an image
 * Uses Flash Lite to create a natural, ready-to-use prompt for image generation
 * This leverages Flash Lite's ability to create effective prompts directly
 */
export async function generateRemovalDirectivePrompt(
  input: PreAnalysisInput
): Promise<DirectivePromptOutput> {
  const { imageBase64, imageMimeType } = input;

  const prompt = `Look at this image. Are there any removable furniture, decorations, or personal items visible?

This is what would constitute a removable "item":

**FURNITURE:**
- Seating: sofas, couches, armchairs, dining chairs, bar stools, ottomans, benches
- Tables: coffee tables, side tables, dining tables, desks, nightstands
- Storage: dressers, bookcases, freestanding shelves, wardrobes, cabinets (freestanding only)
- Beds: bed frames, mattresses, headboards, footboards, bedding, pillows

**DECORATIONS:**
- Artwork: paintings, prints, photos, framed pictures on walls
- Mirrors: freestanding or decorative wall-mounted mirrors
- Vases, decorative bowls, sculptures, figurines
- Clocks (freestanding or decorative wall clocks)
- Candles, candle holders, candelabras
- Throw pillows, cushions, decorative objects
- Hanging decorations: wind chimes, mobiles, string lights, wall art

**ELECTRONICS:**
- TVs, televisions, speakers, sound systems
- Computers, laptops, tablets, gaming consoles
- Remote controls, chargers, cables

**PERSONAL ITEMS:**
- Books, magazines, newspapers
- Dishes, plates, bowls on counters
- Kitchenware on counters (utensils, cutting boards, etc.)
- Clothing, accessories, bags, purses, luggage
- Toiletries, personal care items, cosmetics
- Food items, beverages, bottles, containers
- Trash bins, wastebaskets, cleaning supplies
- Towels, soap dispensers, personal hygiene products

**OTHER:**
- Rugs, carpets, floor mats (freestanding)
- Lamps: table lamps, floor lamps, freestanding lights
- Potted plants, planters, vases with flowers
- Outdoor furniture (if visible)
- Exercise equipment, pet items, toys

**DO NOT INCLUDE (permanent fixtures):**
- Built-in cabinets, built-in shelves, built-in counters
- Plumbing fixtures: sinks, toilets, tubs, vanities, faucets, shower heads
- Wall sconces, ceiling fixtures, curtain rods
- Curtains, drapes, window treatments (these stay - especially if drawn)
- Kitchen appliances: refrigerators (all types), ovens, stoves, dishwashers, microwaves, range hoods (all stay regardless of whether built-in or freestanding)
- Structural elements: walls, floors, ceilings, windows, doors, fireplaces
- Any permanent architectural features

If there are removable items, list them starting with "Specific things I have noticed that would be good to remove include..." and then list the specific items you see. Be specific and natural in your description.

Example format:
"Specific things I have noticed that would be good to remove include the chaise lounges in the back, the TV, the table and chair/table set outside, and all the objects on the shelves."

If there are NO removable items, respond with only "NO_ITEMS".

If there ARE items, respond with ONLY the list starting with "Specific things I have noticed that would be good to remove include..." - nothing else before or after.`;

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2000, // Directive prompts should be concise
    thinkingConfig: {
      thinkingBudget: -1 // Auto thinking budget for better reasoning
    },
    images: [{
      mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: imageBase64
    }]
  });

  if (!result.success || !result.text) {
    throw new Error(`Failed to generate directive prompt: ${result.error || 'Unknown error'}`);
  }

  const response = result.text.trim();
  const hasItems = !response.toUpperCase().includes('NO_ITEMS') && 
                   response.length > 0 &&
                   response.toLowerCase().includes('specific things');

  return {
    directivePrompt: response,
    hasItems
  };
}

