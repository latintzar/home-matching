# OMSRIA Process and Prompts

## Overview

OMSRIA (Organic Multi-Space Reduction Image Altering) is a 3-step process that isolates a single primary space in an image by organically altering other visible spaces.

## Process Flow

1. **Step 1**: Generate descriptive prompt about visible spaces
2. **Step 2**: Generate editing plan (sequence of prompts)
3. **Step 3**: Execute editing plan (apply prompts to image)

---

## Step 1: Generate Prompt for Step 2

**File**: `src/lib/omsria/generate-prompt.ts`

**Purpose**: Analyzes the image and describes where each visible space is located, providing context for Step 2.

**Model**: `gemini-2.5-pro` with `thinkingBudget: -1`

**Base Prompt**:
```
Analyze this image and describe where each visible space is located.

VISIBLE SPACES: {visibleSpaces}

CRITICAL: You MUST ONLY use these exact space names: {visibleSpaces}
- Use ONLY the exact names from the list above, rather than generic terms like "Living Room", "Kitchen", "Bedroom"
- Use the names provided from the list above, rather than inferring or guessing names from the image
- Ignore filenames and any other names - use ONLY: {visibleSpaces}

Describe where each space is visible in the image. Be specific about:
- Position (left, right, back, front, etc.)
- Type of opening (archway, doorway, window, etc.)
- How much of the space is visible

Write a natural, flowing description. Use ONLY the space names from the list above. Only output the description, nothing else.
```

**Example Output** (Step 1 result):
```
In the back through the doors, there's a Dining Area visible. On the left side, through a wide archway, you can see part of a Kitchen. The main space is the Living Room, which occupies the foreground of the image.
```

---

## Step 2: Generate Editing Plan

**File**: `src/lib/omsria/generate-plan.ts`

**Purpose**: Takes Step 1's description and generates a sequence of editing prompts to hide visible spaces.

**Model**: `gemini-2.5-pro` with `thinkingBudget: -1`, structured JSON output

**Full Prompt** (includes Step 1 output):
```
{step1Prompt}

CRITICAL: When referencing spaces in your reasoning and prompts, use ONLY the exact space names mentioned in the description above. Do NOT use generic terms like "Living Room", "Kitchen", "Bedroom" unless they are explicitly mentioned in the description above. Do NOT infer space names from the image.

Your goal is to make the areas mentioned above to be not visible, in an organic way, by picking the smartest out of the following options:

1. Closing a door

2. Drawing curtains

3. Panning the camera left or right by up to 30 degrees.

4. A combination of the above

Decide which strategy is best.

When drawing curtains:
- Only use curtains on windows, glass doors, balcony/terrace doors, floor-to-ceiling glazed openings, or similar openings where curtains would naturally be used.
- It is okay to add simple curtains even if they are not currently visible, as long as they are placed in a realistic location (over glass or a large opening), not on a solid wall.
- Do not hang curtains on plain solid walls or on purely structural openings where curtains would be unnatural.

Naturally, don't close a door where there isn't already a door. The context for this work is being able to work with the images to show before-and-after renovation images, and with our current image editing technology, it is difficult to achieve consistency in elements that show up in multiple images, hence the goal to do organic edits to the images to have simpler images to work with, which only show ONE space clearly.

If one of the mentioned areas would inevitably be visible, please say NOT POSSIBLE, and say why. If only some of the areas are possible to be obscured, say PARTIALLY POSSIBLE.

Please output prompts for gemini-2.5-flash-image to perform the edits, which it would do one at a time. The prompts should be clear, efficient, and explicit. If you choose camera movement as one of the options, it should be the first in the list of prompt(s) you write. 

```

**Output Format** (JSON Schema):
```json
{
  "Decision": "POSSIBLE" | "PARTIALLY_POSSIBLE" | "NOT_POSSIBLE",
  "Reasoning": "string",
  "Prompts": [
    {
      "id": 1,
      "text": "prompt text for gemini-2.5-flash-image"
    }
  ]
}
```

**Example Output**:
```json
{
  "Decision": "POSSIBLE",
  "Reasoning": "The Dining Area can be hidden by closing the doors, and the Kitchen can be partially obscured by panning the camera slightly to the right.",
  "Prompts": [
    {
      "id": 1,
      "text": "Pan the camera slightly to the right by about 15 degrees to reduce visibility of the Kitchen archway on the left."
    },
    {
      "id": 2,
      "text": "Close the doors at the back to hide the Dining Area."
    }
  ]
}
```

---

## Step 3: Execute Editing Plan

**File**: `src/lib/omsria/execute-plan.ts`

**Purpose**: Executes each prompt from Step 2 sequentially, validating results and retrying if needed.

**Model**: `gemini-2.5-flash-image` (for image editing)

**Process**:
1. Prompts are sorted: camera panning first, then other methods
2. Each prompt is executed sequentially
3. After each prompt, validation checks if target space is hidden
4. If not hidden, retry with same prompt (up to 10 retries)
5. Move to next prompt once current one succeeds

**Enhanced Prompt** (for each editing step):
```
{prompt.text}

IMPORTANT: Do not alter the architecture or structure of the room. Keep all walls, ceilings, floors, windows, doors, and structural elements exactly as they are. Keep the camera angle, lighting, framing, and resolution exactly as they are. Only make the specific changes requested above.
```

**Example Prompts Used**:
- `"Pan the camera slightly to the right by about 15 degrees to reduce visibility of the Kitchen archway on the left."`
- `"Close the doors at the back to hide the Dining Area."`
- `"Draw the curtains on the left window to obscure the view of the Terrace."`

**Validation**: After each prompt execution, `validateObscuration` checks if the target space is effectively hidden. If not, the prompt is retried.

---

## Current Issues

### Empty Plans / NOT_POSSIBLE

**When it happens**:
- Step 2 returns `Decision: "NOT_POSSIBLE"` with empty `Prompts` array
- Step 2 returns `Decision: "POSSIBLE"` but with empty `Prompts` array (shouldn't happen, throws error)

**Result**: Image is saved unchanged (original image)

**Possible Causes**:
1. Step 1 prompt doesn't provide enough actionable context
2. Step 2 is too conservative and marks things as NOT_POSSIBLE when they could be possible
3. Visible spaces are truly unavoidable (e.g., wide open archways with no doors/curtains)

**Logging Added**:
- Logs when plans are empty or NOT_POSSIBLE
- Shows Step 1 prompt preview
- Shows Step 2 reasoning

---

## Key Constraints

1. **Only 4 editing methods allowed**:
   - Closing doors
   - Drawing curtains
   - Panning camera (up to 30 degrees)
   - Combination of above

2. **Cannot add anything**: Prompts are validated to ensure they don't contain words like "add", "place", "install", "put", "insert", "create", "build", "construct"

3. **Must preserve architecture**: All prompts include instruction to not alter architecture/structure

4. **Camera panning first**: If camera movement is used, it's executed before other changes

5. **Space names must match**: Step 1 and Step 2 must use exact space names from visibility mappings, not generic terms

---

## Files

- `src/lib/omsria/generate-prompt.ts` - Step 1
- `src/lib/omsria/generate-plan.ts` - Step 2
- `src/lib/omsria/execute-plan.ts` - Step 3
- `src/lib/omsria/validate-obscuration.ts` - Validation after each prompt
- `src/app/api/listings/[id]/after/omsria/route.ts` - Main orchestrator

