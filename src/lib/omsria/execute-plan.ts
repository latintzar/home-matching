/**
 * Step 3: Execute Editing Plan
 * 
 * Executes the editing plan using Gemini 2.5 Flash Image (same method as R3)
 * Includes retry validation loop (Step 3a).
 * 
 * Matches original manual process: execute each prompt, validate, retry until it works
 */

import { callGeminiRest } from '@/lib/gemini-rest-client';
import { getModelForTask } from '@/lib/model-registry';
import { SimplePlan } from './generate-plan';
import { validateObscuration } from './validate-obscuration';

export interface ExecutePlanInput {
  imageBase64: string;
  imageMimeType: string;
  editingPlan: SimplePlan;
  targetSpaces: string[]; // Spaces that need to be hidden (for validation)
  maxRetries?: number; // Max retries per prompt (default: 10)
}

export interface ExecutePlanOutput {
  finalImageBase64: string;
  retryCounts: Record<string, number>; // {"prompt_1": 3, "prompt_2": 1}
  success: boolean;
}

/**
 * Extract target space name from prompt text (heuristic)
 * Tries to match space names mentioned in the prompt, or infer from context
 */
function extractTargetSpace(promptText: string, allTargetSpaces: string[]): string | null {
  const promptLower = promptText.toLowerCase();
  
  // Try to find a target space mentioned in the prompt
  for (const space of allTargetSpaces) {
    const spaceLower = space.toLowerCase();
    // Check for exact match or partial match (e.g., "dining area" matches "Dining Area")
    if (promptLower.includes(spaceLower) || spaceLower.includes(promptLower.split(' ')[0])) {
      return space;
    }
  }
  
  // Try to infer from common patterns
  // "archway at the back" might refer to a space behind
  // "archway on the left/right" might refer to side spaces
  // For now, if no match found, return first target space (fallback)
  // TODO: Could be improved with better spatial reasoning
  if (allTargetSpaces.length > 0) {
    console.log(`         ⚠️  Could not extract target space from prompt, using first target: "${allTargetSpaces[0]}"`);
    return allTargetSpaces[0];
  }
  
  return null;
}

/**
 * Execute editing plan with retry validation
 * Matches original manual process: execute prompt, validate, retry until it works
 */
export async function executeEditingPlan(
  input: ExecutePlanInput
): Promise<ExecutePlanOutput> {
  const { imageBase64, imageMimeType, editingPlan, targetSpaces, maxRetries = 10 } = input;

  // Check decision - if NOT_POSSIBLE, skip execution (will be marked as DEAD_END)
  if (editingPlan.decision === 'NOT_POSSIBLE') {
    console.log(`      ⚠️  Plan marked as NOT_POSSIBLE - skipping execution (will be marked as DEAD_END)`);
    return {
      finalImageBase64: imageBase64, // Return original image
      retryCounts: {},
      success: false // Not a success, but not an error either
    };
  }
  
  // Check if there are prompts to execute
  if (editingPlan.prompts.length === 0) {
    console.log(`      ⚠️  No prompts to execute - skipping`);
    return {
      finalImageBase64: imageBase64,
      retryCounts: {},
      success: false
    };
  }

  // Initialize model name from registry
  const modelName = getModelForTask('visuals.inpaint');

  let currentImageBase64 = imageBase64;
  const retryCounts: Record<string, number> = {};

  // Sort prompts: camera panning first, then other methods
  // This ensures camera panning (which preserves resolution) is done before physical changes
  const sortedPrompts = [...editingPlan.prompts].sort((a, b) => {
    const aIsCamera = a.text.toLowerCase().includes('pan camera') || a.text.toLowerCase().includes('tilt camera') || a.text.toLowerCase().includes('camera angle');
    const bIsCamera = b.text.toLowerCase().includes('pan camera') || b.text.toLowerCase().includes('tilt camera') || b.text.toLowerCase().includes('camera angle');
    
    if (aIsCamera && !bIsCamera) return -1; // a (camera) comes first
    if (!aIsCamera && bIsCamera) return 1;  // b (camera) comes first
    return a.id - b.id; // Otherwise maintain original order
  });

  // Execute each prompt sequentially (like original manual process)
  // Camera panning prompts will be executed first
  for (const prompt of sortedPrompts) {
    const promptKey = `prompt_${prompt.id}`;
    retryCounts[promptKey] = 0;
    let promptSuccess = false;

    // Extract target space from prompt (heuristic)
    const targetSpace = extractTargetSpace(prompt.text, targetSpaces);

    console.log(`      🔧 Executing Prompt ${prompt.id}`);
    if (targetSpace) {
      console.log(`         Target: Hide "${targetSpace}"`);
    }
    console.log(`         Prompt: ${prompt.text.substring(0, 100)}${prompt.text.length > 100 ? '...' : ''}`);

    // Retry loop for this prompt (like original: run until it works)
    while (retryCounts[promptKey] < maxRetries && !promptSuccess) {
      const attemptNum = retryCounts[promptKey] + 1;
      try {
        if (retryCounts[promptKey] > 0) {
          console.log(`         🔄 Retry attempt ${attemptNum}/${maxRetries}...`);
        } else {
          console.log(`         ⚙️  Generating edit (attempt ${attemptNum})...`);
        }

        // Execute edit using Gemini 2.5 Flash Image (same prompt, retry until it works)
        // Add note about preserving architecture and structure, plus camera/lighting/resolution
        const enhancedPrompt = `${prompt.text}

IMPORTANT: Do not alter the architecture or structure of the room. Keep all walls, ceilings, floors, windows, doors, and structural elements exactly as they are. Keep the camera angle, lighting, framing, and resolution exactly as they are. Only make the specific changes requested above.`;
        
        const result = await callGeminiRest(enhancedPrompt, {
          model: modelName,
          generateImages: true,
          images: [{
            mimeType: imageMimeType as any,
              data: currentImageBase64
          }],
          temperature: 1,
          topP: 0.95,
          maxOutputTokens: 32768,
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '4K',
            imageOutputOptions: {
              mimeType: 'image/png'
            },
            personGeneration: 'ALLOW_ALL'
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
          ]
        });

        if (!result.success || !result.images || result.images.length === 0) {
          throw new Error(result.error || 'No image generated');
        }

        const editedImageBase64 = result.images[0].data;

        // Validate obscuration (less strict - "effectively hidden" not "100% invisible")
        if (targetSpace) {
          console.log(`         ✅ Image generated, validating obscuration for "${targetSpace}"...`);

        const validation = await validateObscuration({
          imageBase64: editedImageBase64,
          imageMimeType,
            targetArea: targetSpace
        });

        // Log validation reasoning for debugging
        console.log(`         📊 Validation reasoning: ${validation.reasoning.substring(0, 150)}${validation.reasoning.length > 150 ? '...' : ''}`);

        if (validation.is_fully_obscured) {
            // Success - effectively hidden
          currentImageBase64 = editedImageBase64;
            promptSuccess = true;
            if (retryCounts[promptKey] > 0) {
              console.log(`         ✅ Prompt ${prompt.id} succeeded after ${attemptNum} attempt(s)`);
          } else {
              console.log(`         ✅ Prompt ${prompt.id} succeeded on first attempt`);
          }
        } else {
            // Not effectively hidden - retry with same prompt
          const visiblePortions = validation.visible_portions.length > 0 
            ? validation.visible_portions.join(', ')
            : 'partial visibility detected';
            console.log(`         ⚠️  Target "${targetSpace}" not effectively hidden: ${visiblePortions}`);
            console.log(`         📊 Full validation reasoning: ${validation.reasoning}`);
          console.log(`         🔄 Retrying with same prompt...`);
          currentImageBase64 = editedImageBase64; // Use current result as base for next attempt
            retryCounts[promptKey]++;
          }
        } else {
          // No target space to validate - accept the edit
          console.log(`         ⚠️  No target space found in prompt - accepting edit without validation`);
          currentImageBase64 = editedImageBase64;
          promptSuccess = true;
          if (retryCounts[promptKey] > 0) {
            console.log(`         ✅ Prompt ${prompt.id} completed after ${attemptNum} attempt(s) (no validation)`);
          } else {
            console.log(`         ✅ Prompt ${prompt.id} completed on first attempt (no validation)`);
          }
        }
      } catch (error: any) {
        console.error(`         ❌ Error on attempt ${attemptNum}:`, error.message);
        retryCounts[promptKey]++;
        
        if (retryCounts[promptKey] >= maxRetries) {
          throw new Error(`Failed to execute prompt ${prompt.id} after ${maxRetries} retries: ${error.message}`);
        }
      }
    }

    if (!promptSuccess) {
      const errorMsg = `Prompt ${prompt.id} failed after ${maxRetries} retries.`;
      console.error(`         ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  return {
    finalImageBase64: currentImageBase64,
    retryCounts,
    success: true
  };
}
