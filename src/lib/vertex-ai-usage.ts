import { GenerateContentResult, GenerativeModel } from '@google-cloud/vertexai';

/**
 * Extracts token usage metadata from a Vertex AI generation result
 */
export function extractUsageFromVertexAI(result: GenerateContentResult) {
  if (!result.response?.usageMetadata) {
    return {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0
    };
  }
  
  return {
    promptTokenCount: result.response.usageMetadata.promptTokenCount || 0,
    candidatesTokenCount: result.response.usageMetadata.candidatesTokenCount || 0,
    totalTokenCount: result.response.usageMetadata.totalTokenCount || 0
  };
}

/**
 * Gets the model name from a GenerativeModel instance
 * Note: The SDK doesn't strongly expose this, so we fallback or inspect internals
 */
export function getModelName(model: GenerativeModel | any): string {
  // Try to find model name in common locations or fallback
  if (model.model) return model.model;
  if (model._model) return model._model;
  return 'gemini-2.5-flash'; // Default fallback
}

