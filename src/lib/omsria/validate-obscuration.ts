/**
 * Step 3a: Validate Obscuration
 * 
 * Checks if a target space is fully obscured after an edit.
 */

import { callGeminiRest } from '@/lib/gemini-rest-client';

export interface ValidateObscurationInput {
  imageBase64: string;
  imageMimeType: string;
  targetArea: string; // Space name to check (e.g., "KITCHEN")
}

export interface ValidateObscurationOutput {
  is_fully_obscured: boolean;
  reasoning: string;
  visible_portions: string[]; // Empty if fully obscured
}

const validationResponseSchema = {
  type: 'object',
  properties: {
    is_fully_obscured: { type: 'boolean' },
    reasoning: { type: 'string' },
    visible_portions: { type: 'array', items: { type: 'string' } }
  },
  required: ['is_fully_obscured', 'reasoning', 'visible_portions']
};

/**
 * Validate if target space is fully obscured
 */
export async function validateObscuration(
  input: ValidateObscurationInput
): Promise<ValidateObscurationOutput> {
  const { imageBase64, imageMimeType, targetArea } = input;

  const prompt = `Analyze this image and determine if the target space "${targetArea}" is EFFECTIVELY HIDDEN.

TARGET AREA: ${targetArea}
IMAGE: [Current edited image]

Check if the target area is effectively hidden from view. The goal is to determine if the space is obscured enough that it won't interfere with renovation visualization.

Check:
1. Is the target area mostly or completely hidden? (small glimpses may be acceptable if they don't dominate the view)
2. Can you clearly see into the target space? (if only partially visible or obscured, that may be acceptable)
3. Is the target area effectively obscured? (the main view should focus on the primary space, not the target area)

Return JSON:
{
  "is_fully_obscured": true | false,
  "reasoning": "Detailed explanation of what is visible or hidden",
  "visible_portions": ["Specific description of visible parts if any"] // empty array if effectively hidden
}`;

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: validationResponseSchema,
    images: [{
      mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: imageBase64
    }]
  });

  if (!result.success || !result.text) {
    throw new Error(`Failed to validate obscuration: ${result.error || 'Unknown error'}`);
  }

  // Parse JSON response
  let cleaned = result.text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  let parsed: ValidateObscurationOutput;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError: any) {
    throw new Error(`Failed to parse validation result: ${parseError.message}`);
  }

  return parsed;
}

