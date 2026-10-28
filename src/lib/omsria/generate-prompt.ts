/**
 * Step 1: Generate Prompt for Step 2
 * 
 * Takes visibility mappings and generates a tailored prompt for Step 2
 * that specifies which spaces are visible and their positions.
 */

import { callGeminiRest } from '@/lib/gemini-rest-client';

export interface GeneratePromptInput {
  imageBase64: string;
  imageMimeType: string;
  visibleClusterNames: string[]; // Cluster names visible in this photo (from Stage 4 format)
  primaryClusterName: string; // The name of the primary cluster
}

export interface GeneratePromptOutput {
  prompt: string; // Tailored prompt for Step 2
}

/**
 * Generate a tailored prompt for Step 2 using visibility mappings
 */
export async function generatePromptForStep2(
  input: GeneratePromptInput
): Promise<GeneratePromptOutput> {
  const { imageBase64, imageMimeType, visibleClusterNames, primaryClusterName } = input;

  // Filter out primary cluster from visible spaces (Stage 4 format uses names directly)
  const visibleSpaces = visibleClusterNames
    .filter(name => name !== primaryClusterName) // Exclude primary space
    .filter(Boolean);

  if (visibleSpaces.length === 0) {
    throw new Error('No visible spaces found in visibility mappings');
  }

  // Step 1: Generate descriptive position description - just describe where spaces are
  const basePrompt = `Analyze this image and describe where each visible space is located.

VISIBLE SPACES: ${visibleSpaces.join(', ')}

CRITICAL: You MUST ONLY use these exact space names: ${visibleSpaces.join(', ')}
- Use ONLY the exact names from the list above, rather than generic terms like "Living Room", "Kitchen", "Bedroom"
- Use the names provided from the list above, rather than inferring or guessing names from the image
- Ignore filenames and any other names - use ONLY: ${visibleSpaces.join(', ')}

Describe where each space is visible in the image. Be specific about:
- Position (left, right, back, front, etc.)
- Type of opening (archway, doorway, window, etc.)
- How much of the space is visible

Write a natural, flowing description. Use ONLY the space names from the list above. Only output the description, nothing else.`;

  // Call Gemini to generate the tailored prompt
  const result = await callGeminiRest(basePrompt, {
    model: 'gemini-2.5-pro',
    temperature: 0.2,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
    thinkingConfig: {
      thinkingBudget: -1
    },
    images: [{
      mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: imageBase64
    }]
  });

  if (!result.success || !result.text) {
    throw new Error(`Failed to generate prompt: ${result.error || 'Unknown error'}`);
  }

  return {
    prompt: result.text.trim()
  };
}

