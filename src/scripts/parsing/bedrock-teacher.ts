/**
 * Bedrock Teacher (LLM)
 * 
 * Uses Mistral 7B on AWS Bedrock for:
 * 1. Learning selectors from HTML
 * 2. Validating Cheerio extractions
 * 3. Extracting data when selectors fail
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ScrapingRule, ParsedListing, LLMExtractionResult, ValidationResult } from './types';

// Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const MODEL_ID = 'mistral.mistral-7b-instruct-v0:2';

/**
 * Clean HTML for LLM input (reduce tokens)
 */
function cleanHtmlForLLM(html: string, maxLength: number = 8000): string {
  // Remove scripts, styles, comments
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + '...';
  }
  
  return cleaned;
}

/**
 * Call Bedrock Mistral
 */
async function callMistral(prompt: string): Promise<string> {
  const body = JSON.stringify({
    prompt: `<s>[INST] ${prompt} [/INST]`,
    max_tokens: 2000,
    temperature: 0.1,
    top_p: 0.9,
  });
  
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    body: body,
    contentType: 'application/json',
    accept: 'application/json',
  });
  
  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.outputs?.[0]?.text || responseBody.generation || '';
}

/**
 * Learn selectors from HTML (Teacher mode)
 */
export async function learnSelectors(
  html: string,
  domain: string
): Promise<ScrapingRule['selectors']> {
  const cleanedHtml = cleanHtmlForLLM(html);
  
  const prompt = `You are a web scraping expert. Analyze this HTML from ${domain} and identify CSS selectors for property listing data.

HTML:
${cleanedHtml}

Return ONLY a JSON object with CSS selectors for these fields (use null if not found):
{
  "title": "CSS selector for property title",
  "price": "CSS selector for price",
  "sqm": "CSS selector for square meters",
  "bedrooms": "CSS selector for number of bedrooms",
  "bathrooms": "CSS selector for number of bathrooms",
  "description": "CSS selector for property description",
  "address": "CSS selector for address/location",
  "features": "CSS selector for feature list items",
  "photos": "CSS selector for photo images"
}

Return ONLY the JSON, no explanation.`;

  try {
    const response = await callMistral(prompt);
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in LLM response');
      return {};
    }
    
    const selectors = JSON.parse(jsonMatch[0]);
    
    // Clean null values
    const cleaned: ScrapingRule['selectors'] = {};
    for (const [key, value] of Object.entries(selectors)) {
      if (value && value !== 'null' && typeof value === 'string') {
        (cleaned as any)[key] = value;
      }
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error learning selectors:', error);
    return {};
  }
}

/**
 * Extract data directly from HTML using LLM
 */
export async function extractWithLLM(
  html: string,
  url: string,
  domain: string
): Promise<LLMExtractionResult> {
  const cleanedHtml = cleanHtmlForLLM(html);
  
  const prompt = `You are a property data extraction expert. Extract listing information from this HTML.

URL: ${url}
Domain: ${domain}

HTML:
${cleanedHtml}

Return ONLY a JSON object with:
{
  "title": "property title",
  "price_eur": number or null,
  "sqm": number or null,
  "bedrooms": number or null,
  "bathrooms": number or null,
  "description": "property description",
  "address": "property address",
  "features": ["feature1", "feature2"],
  "property_type": "apartment|house|villa|studio|other",
  "operation_type": "sale|rent",
  "confidence": 0.0-1.0
}

Return ONLY the JSON, no explanation.`;

  try {
    const response = await callMistral(prompt);
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { selectors: {}, extracted_data: {}, confidence: 0 };
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    return {
      selectors: {}, // No selectors learned in direct extraction
      extracted_data: {
        title: data.title,
        price_eur: data.price_eur,
        sqm: data.sqm,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        description: data.description,
        address: data.address,
        features: data.features,
        property_type: data.property_type,
        operation_type: data.operation_type,
      },
      confidence: data.confidence || 0.5,
    };
  } catch (error) {
    console.error('Error extracting with LLM:', error);
    return { selectors: {}, extracted_data: {}, confidence: 0 };
  }
}

/**
 * Validate Cheerio extraction using LLM
 */
export async function validateExtraction(
  html: string,
  extracted: Partial<ParsedListing>
): Promise<ValidationResult> {
  const cleanedHtml = cleanHtmlForLLM(html, 4000);
  
  const prompt = `You are a data validation expert. Check if these extracted values are correct for this property listing.

Extracted data:
${JSON.stringify(extracted, null, 2)}

HTML snippet:
${cleanedHtml}

Return ONLY a JSON object:
{
  "valid": true/false,
  "issues": ["issue1", "issue2"] or [],
  "confidence": 0.0-1.0
}

Return ONLY the JSON, no explanation.`;

  try {
    const response = await callMistral(prompt);
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { valid: false, issues: ['Could not parse validation response'], confidence: 0 };
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      valid: Boolean(result.valid),
      issues: result.issues || [],
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error('Error validating extraction:', error);
    return { valid: false, issues: ['Validation error'], confidence: 0 };
  }
}

/**
 * Generate listing ID from URL
 */
export function generateListingId(url: string, domain: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  return `${domain}_${hash}`;
}

