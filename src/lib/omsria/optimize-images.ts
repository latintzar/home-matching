/**
 * Step 5: Optimization Pass
 * 
 * Eliminates redundant single-space images when they're already shown in multi-space images.
 */

import { callGeminiRest } from '@/lib/gemini-rest-client';
import { OMSRIAPlan } from './generate-plan';

export interface ImageInfo {
  image_id: string;
  image_url: string;
  image_type: 'SINGLE_SPACE' | 'DEAD_END' | 'MULTI_SPACE';
  room_id: string;
  visible_spaces: string[];
  unavoidable_spaces: string[]; // From Step 2's Areas_Unavoidable
  editing_plan?: OMSRIAPlan;
}

export interface RedundancyCase {
  deadEndImage: ImageInfo;
  singleSpaceImages: ImageInfo[];
}

export interface SelectionDecision {
  decision: 'KEEP_MULTI_SPACE' | 'KEEP_SINGLE_SPACES';
  reasoning: string;
  images_to_keep: string[];
  images_to_discard: string[];
}

/**
 * Step 5.1: Extract space information from Step 2 output
 */
export function extractSpaceInfo(images: ImageInfo[]): ImageInfo[] {
  // For SINGLE_SPACE: visible_spaces = [primary_space] (all others hidden)
  // For DEAD_END: visible_spaces = Areas_Hidden + Areas_Unavoidable (from Step 2)
  // We already have this info from Step 2's output, just ensure it's populated
  
  return images.map(img => {
    if (img.image_type === 'SINGLE_SPACE') {
      // All others were hidden, so only primary space is visible
      // visible_spaces should already be set correctly
      return img;
    } else if (img.image_type === 'DEAD_END') {
      // visible_spaces = hidden + unavoidable (from Step 2)
      // This should already be populated from Step 2's Areas_Hidden + Areas_Unavoidable
      return img;
    }
    return img;
  });
}

/**
 * Step 5.2: Detect redundancy cases
 */
export function detectRedundancy(images: ImageInfo[]): RedundancyCase[] {
  const singleSpaceImages = images.filter(img => img.image_type === 'SINGLE_SPACE');
  const deadEndImages = images.filter(img => img.image_type === 'DEAD_END');

  const redundancyCases: RedundancyCase[] = [];

  for (const deadEndImage of deadEndImages) {
    const deadEndSpaces = deadEndImage.visible_spaces;

    // Find all SINGLE_SPACE images that show spaces contained in this DEAD_END
    const matchingSingleSpaces = singleSpaceImages.filter(single => 
      deadEndSpaces.includes(single.visible_spaces[0])
    );

    // If ALL spaces in DEAD_END have corresponding SINGLE_SPACE images, redundancy detected
    const singleSpaceSpaces = matchingSingleSpaces.map(s => s.visible_spaces[0]);
    const allSpacesCovered = deadEndSpaces.every(space => singleSpaceSpaces.includes(space));

    if (allSpacesCovered && matchingSingleSpaces.length === deadEndSpaces.length) {
      redundancyCases.push({
        deadEndImage,
        singleSpaceImages: matchingSingleSpaces
      });
    }
  }

  return redundancyCases;
}

/**
 * Step 5.3: Selection decision (Gemini 2.5 Flash)
 */
export async function makeSelectionDecision(
  redundancyCase: RedundancyCase
): Promise<SelectionDecision> {
  const { deadEndImage, singleSpaceImages } = redundancyCase;

  // Fetch images as base64 for comparison
  const imagesBase64: Array<{ mimeType: string; data: string }> = [];
  
  try {
    // Fetch DEAD_END image
    const deadEndResponse = await fetch(deadEndImage.image_url);
    if (deadEndResponse.ok) {
      const buffer = await deadEndResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = deadEndResponse.headers.get('content-type') || 'image/jpeg';
      imagesBase64.push({ mimeType: contentType, data: base64 });
    }

    // Fetch SINGLE_SPACE images
    for (const singleImage of singleSpaceImages) {
      const response = await fetch(singleImage.image_url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        imagesBase64.push({ mimeType: contentType, data: base64 });
      }
    }
  } catch (error) {
    console.warn('Failed to fetch images for comparison, using logic-based decision', error);
    // Fallback to logic-based decision if images can't be fetched
    return {
      decision: 'KEEP_MULTI_SPACE', // Default: keep multi-space
      reasoning: 'Could not fetch images for comparison, defaulting to keep multi-space',
      images_to_keep: [deadEndImage.image_id],
      images_to_discard: singleSpaceImages.map(img => img.image_id)
    };
  }

  const spacesList = deadEndImage.visible_spaces.join(', ');
  const singleSpacesList = singleSpaceImages.map(img => img.visible_spaces[0]).join(', ');

  const prompt = `You are comparing images to determine which to keep for a before/after renovation workflow.

DEAD_END MULTI-SPACE IMAGE:
- Shows: ${spacesList}
- Image: [First image provided]

SINGLE-SPACE IMAGES:
${singleSpaceImages.map((img, idx) => 
  `- Image ${idx + 1}: Shows ${img.visible_spaces[0]} - [Image ${idx + 2} provided]`
).join('\n')}

TASK:
Determine which set provides better value for renovation visualization:
1. Keep the multi-space DEAD_END image and discard single-space images?
2. Keep the single-space images and discard the DEAD_END?

Consider:
- Clarity of each space in multi-space vs single-space views
- Which is more useful for before/after comparison
- Quality and composition

Return JSON:
{
  "decision": "KEEP_MULTI_SPACE" | "KEEP_SINGLE_SPACES",
  "reasoning": "Explanation",
  "images_to_keep": ["image_id_1", "image_id_2"],
  "images_to_discard": ["image_id_3"]
}`;

  const decisionSchema = {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['KEEP_MULTI_SPACE', 'KEEP_SINGLE_SPACES'] },
      reasoning: { type: 'string' },
      images_to_keep: { type: 'array', items: { type: 'string' } },
      images_to_discard: { type: 'array', items: { type: 'string' } }
    },
    required: ['decision', 'reasoning', 'images_to_keep', 'images_to_discard']
  };

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: decisionSchema,
    images: imagesBase64.map(img => ({
      mimeType: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data: img.data
    }))
  });

  if (!result.success || !result.text) {
    // Fallback to logic-based decision
    return {
      decision: 'KEEP_MULTI_SPACE',
      reasoning: 'Failed to get AI decision, defaulting to keep multi-space',
      images_to_keep: [deadEndImage.image_id],
      images_to_discard: singleSpaceImages.map(img => img.image_id)
    };
  }

  // Parse JSON response
  let cleaned = result.text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  let parsed: SelectionDecision;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError: any) {
    // Fallback to logic-based decision
    return {
      decision: 'KEEP_MULTI_SPACE',
      reasoning: `Failed to parse decision: ${parseError.message}`,
      images_to_keep: [deadEndImage.image_id],
      images_to_discard: singleSpaceImages.map(img => img.image_id)
    };
  }

  return parsed;
}

