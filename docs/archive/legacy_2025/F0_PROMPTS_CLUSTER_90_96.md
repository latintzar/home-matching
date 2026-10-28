# F0 Prompts for Cluster 90 and Cluster 96

## Overview

This document shows the exact prompts used by F0 (Furniture Removal) for:
- **Cluster 90**: Bedroom 1 (SINGLE_SPACE)
- **Cluster 96**: Central Foyer (DEAD_END)

---

## Base Prompt (Used for Initial Generation)

The base prompt is the same for all clusters and is used for the first generation attempt:

```
Remove all furniture, decorations, and personal items from this image. Keep the exact same resolution, detail, and quality as the original.

KEEP these permanent fixtures (do not remove):
- Kitchen islands and countertops
- All kitchen appliances: refrigerators (all types), ovens, stoves, dishwashers, microwaves, range hoods (keep all regardless of whether built-in or freestanding)
- Built-in cabinets and storage (including all bathroom vanities and under-sink units)
- Sinks, faucets, and plumbing fixtures
- Built-in lighting fixtures
- Curtains and window treatments (keep all curtains exactly as they are, especially if drawn)
- All walls, doors, windows, and architectural elements

REMOVE these items:
- All loose furniture (sofas, chairs, tables, beds, etc.)
- Electronics (TVs, speakers, etc.)
- Decorations and artwork
- Personal items and belongings
- Rugs
- Any loose items that movers would take (but not built-in cabinets, vanities, or anything fixed to walls or plumbing)

Keep the image sharp and detailed, matching the original quality exactly. 

IMPORTANT: Only remove things - never add anything. 

Do not add:
- Doors, windows, walls, or any architectural features
- Furniture, fixtures, or objects
- Anything to fill empty spaces
- Anything to "complete" or "fix" the image

Only do this:
- Remove loose furniture, decorations, and personal items
- Leave empty spaces empty
- Keep everything else exactly as it was

Keep all curtains exactly as they are. Do not change existing doors, walls, windows, or architecture.
```

---

## Cluster 90 (Bedroom 1) - Prompts Used

### Attempt 1: Base Prompt
Used the base prompt above.

### Attempt 2: Retry Prompt (if validation found items)
Based on the validation output, the retry prompt would have been:

```
Remove all furniture, decorations, and personal items from this image. Keep the exact same resolution, detail, and quality as the original.

KEEP these permanent fixtures (do not remove):
- Kitchen islands and countertops
- All kitchen appliances: refrigerators (all types), ovens, stoves, dishwashers, microwaves, range hoods (keep all regardless of whether built-in or freestanding)
- Built-in cabinets and storage (including all bathroom vanities and under-sink units)
- Sinks, faucets, and plumbing fixtures
- Built-in lighting fixtures
- Curtains and window treatments (keep all curtains exactly as they are, especially if drawn)
- All walls, doors, windows, and architectural elements

REMOVE these items:
- All loose furniture (sofas, chairs, tables, beds, etc.)
- Electronics (TVs, speakers, etc.)
- Decorations and artwork
- Personal items and belongings
- Rugs
- Any loose items that movers would take (but not built-in cabinets, vanities, or anything fixed to walls or plumbing)

Keep the image sharp and detailed, matching the original quality exactly. 

IMPORTANT: Only remove things - never add anything. 

Do not add:
- Doors, windows, walls, or any architectural features
- Furniture, fixtures, or objects
- Anything to fill empty spaces
- Anything to "complete" or "fix" the image

Only do this:
- Remove loose furniture, decorations, and personal items
- Leave empty spaces empty
- Keep everything else exactly as it was

Keep all curtains exactly as they are. Do not change existing doors, walls, windows, or architecture.

[VALIDATION OUTPUT APPENDED HERE]
Remove these but anything else I might have missed too, because I want the place bare.

IMPORTANT: Only remove things - never add anything. Do not add doors, windows, or any architectural features. Do not fill empty spaces. Do not add anything new.

Keep all curtains and window treatments exactly as they are - do not remove them. Only remove loose furniture and decorations.
```

**Note**: The `[VALIDATION OUTPUT APPENDED HERE]` would be replaced with the actual validation output from `generateRemovalDirectivePrompt`, which starts with "Specific things I have noticed that would be good to remove include..." followed by specific items found.

---

## Cluster 96 (Central Foyer) - Prompts Used

### Attempt 1: Base Prompt
Used the base prompt above.

### Attempt 2-6: Retry Prompts (if validation found items)
Based on the logs, cluster 96 had multiple retry attempts. Each retry would use the same structure as above, with the validation output appended.

The retry prompt structure is:

```
[Base Prompt]

[Filtered Validation Output]
Remove these but anything else I might have missed too, because I want the place bare.

IMPORTANT: Only remove things - never add anything. Do not add doors, windows, or any architectural features. Do not fill empty spaces. Do not add anything new.

Keep all curtains and window treatments exactly as they are - do not remove them. Only remove loose furniture and decorations.
```

---

## Validation Prompt (Used to Check for Remaining Items)

The validation step uses this prompt (via `generateRemovalDirectivePrompt`):

```
Look at this image. Are there any removable furniture, decorations, or personal items visible?

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

If there ARE items, respond with ONLY the list starting with "Specific things I have noticed that would be good to remove include..." - nothing else before or after.
```

---

## Filtering Logic

Before appending validation output to retry prompts, the following items are filtered out (to prevent removing permanent fixtures):

- Watermark/logo mentions (watermark, idealista, logo, branding, text overlay)
- Built-in joinery (vanity, under-sink, built-in cabinet, fixed cabinet, wall-mounted cabinet, bathroom cabinet)
- Curtains (curtain, drape, window treatment)
- Kitchen appliances (refrigerator, fridge, oven, stove, dishwasher, microwave, range hood, kitchen appliance)
- Built-in kitchen cabinets (if mentioned as attached/built-in/fixed)

---

## Model Configuration

- **Generation Model**: `gemini-2.5-flash-image`
- **Validation Model**: `gemini-2.5-flash-lite`
- **Max Retries**: 5 (6 total attempts)
- **Temperature**: 0.1
- **TopP**: 0.5
- **Validation Max Output Tokens**: 2000

---

## Notes

1. **Progressive Removal**: Each retry uses the output from the previous attempt as input, ensuring progressive removal of items.

2. **No Reference Image**: The reference image logic has been removed - F0 now only uses the image being edited for all attempts.

3. **Subtractive Only**: The prompts explicitly instruct the model to only remove items, never add anything.

4. **Curtain Protection**: Curtains are explicitly protected in both the base prompt and retry prompts.

5. **Kitchen Appliance Protection**: All kitchen appliances are explicitly protected, regardless of whether they're built-in or freestanding.

