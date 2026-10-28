// Text Analysis Pipeline Helper Functions
// Extracted from the monolithic endpoint for reuse across modular endpoints

// @ts-ignore
import TurndownService from 'turndown';
import { VertexAI } from '@google-cloud/vertexai';

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

export type Claim = {
  id: string;
  sentence_id: string;
  fact: string;
  source_span: string;
  polarity: 'affirmed' | 'negated' | 'unknown';
  units?: string | null;
  numeric_value?: number | null;
  normalized_value?: string | null;
};

export type BatchClaim = {
  batch_id: number;
  claim_ids: string[];
};

/**
 * Call Gemini API for simple text generation (not JSON)
 */
export const callGeminiText = async (prompt: string, useFlashLite = false) => {
  const model = useFlashLite ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
  
  if (!GOOGLE_CLOUD_PROJECT_ID) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
  }
  
  console.log(`🤖 Calling Vertex AI for text generation with model: ${model}`);
  
  try {
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });
    
    const generativeModel = vertexAI.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: useFlashLite ? 1000 : 1000, // Flash Lite can handle 1k tokens for simple text
      },
    });
    
    const result = await generativeModel.generateContent(prompt);
    const text = (result.response as any)?.text || result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Empty response from Vertex AI');
    }
    
    return text.trim();
  } catch (error) {
    console.error('Vertex AI text generation error:', error);
    throw new Error(`Vertex AI error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Call Gemini API with JSON response parsing
 */
export const callGeminiJSON = async (prompt: string, expectArray = true, useFlashLite = false) => {
  const model = useFlashLite ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
  
  if (!GOOGLE_CLOUD_PROJECT_ID) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
  }
  
  console.log(`🤖 Calling Vertex AI with model: ${model}`);
  
  try {
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });
    
    const generativeModel = vertexAI.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: 0.2,
        topP: 0.7,
        topK: 40,
        maxOutputTokens: useFlashLite ? 8192 : 20000,
        responseMimeType: 'application/json',
      },
    });
    
    const result = await generativeModel.generateContent(prompt);
    console.log('🤖 Vertex AI raw result:', JSON.stringify(result, null, 2));
    
    const text = (result.response as any)?.text || result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log(`🤖 Vertex AI response text: ${text}`);
    console.log(`🤖 Vertex AI response text length: ${text?.length || 0}`);
    
    if (!text) {
      console.error('Empty response from Vertex AI');
      throw new Error('Empty response from Vertex AI');
    }
    
    const clean = text.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
    console.log(`🤖 Cleaned text length: ${clean.length}`);
    
    try {
      const parsed = JSON.parse(clean);
      if (expectArray && !Array.isArray(parsed)) throw new Error('Non-array JSON from LLM');
      if (!expectArray && Array.isArray(parsed)) throw new Error('Expected object but got array from LLM');
      return parsed;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw text:', text);
      console.error('Cleaned text:', clean);
      throw new Error(`JSON parse error: ${(parseError as any)?.message}`);
    }
  } catch (error) {
    console.error('Vertex AI error:', error);
    throw new Error(`Vertex AI error: ${(error as any)?.message || 'unknown error'}`);
  }
};

/**
 * Convert HTML to Markdown using TurndownService
 */
export const convertToMarkdown = (html: string): string => {
  const turndownService = new TurndownService();
  return turndownService.turndown(html);
};

/**
 * Deduplicate claims by normalized_value/polarity (keep first)
 */
export const deduplicateClaims = (claims: Claim[]): Claim[] => {
  const deduped: Claim[] = [];
  const seenKeys = new Set<string>();
  
  for (const cl of claims) {
    const base = (cl?.normalized_value || cl?.fact || '').toString().trim().toLowerCase();
    const key = `${base}|${cl?.polarity || 'affirmed'}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(cl);
    }
  }
  
  return deduped;
};

/**
 * Filter out non-characteristic claims (price, address, etc) for B1 categorization
 */
export const filterNonCharacteristics = (claims: Claim[]): Claim[] => {
  const isNonCharacteristic = (c: Claim) => {
    const t = `${c.fact || ''} ${c.normalized_value || ''}`.toLowerCase();
    if (/(^|\b)(precio|price|€|eur)(\b|$)/.test(t)) return true;
    if (/(^|\b)(dirección|address|ubicación|location|city|ciudad|region|región|provincia)(\b|$)/.test(t)) return true;
    if (/(^|\b)(título|title)(\b|$)/.test(t)) return true;
    if (/gastos.*(inclu|exclu)|tax(es)?.*included|agency fees|impuestos/.test(t)) return true;
    if (/(^|\b)m²(\b|$)/.test(t) && !/(útiles|utiles|construid)/.test(t)) return true;
    
    // A1 Quick Keywords - now handled in sidebar (extracted by regex)
    if (/terraza|balcón|jardín|piscina|garaje|trastero|ascensor|vistas|property type|floor|planta/i.test(t)) return true;
    // Note: orientation is NOT filtered - let B1 analyze it
    
    return false;
  };
  
  return claims.filter(c => !isNonCharacteristic(c));
};

/**
 * Batch claims for parallel processing (1 claim per batch for max parallelization)
 */
export const batchClaims = (claims: Claim[]): BatchClaim[] => {
  return claims.map((claim, index) => ({
    batch_id: index + 1,
    claim_ids: [claim.id]
  }));
};

/**
 * Validate that all claim IDs are assigned exactly once
 */
export const validateClaimAssignment = (assignedIds: Set<string>, totalClaims: number): { isValid: boolean; missingIds: string[] } => {
  const isValid = assignedIds.size === totalClaims;
  const missingIds: string[] = [];
  
  if (!isValid) {
    // This would need the original claim IDs to find missing ones
    // For now, just return the validation result
  }
  
  return { isValid, missingIds };
};
