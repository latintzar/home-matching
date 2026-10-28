/**
 * VALIDATOR Lambda - Active Search Validation
 * 
 * Uses Gemini 2.5 Flash via publisher endpoint.
 * ACTIVELY SEARCHES for all data in HTML, then checks if we got it.
 * This catches silent failures where Cheerio returned null but data exists.
 * 
 * Input: { domain, html, extracted, selectors }
 * Output: { success, valid, issues, missedData, suggestions, inputTokens, outputTokens, cost }
 */

import { generateValidatorPrompt, parseValidatorResponse } from '../parked/bulk-harvester/harvest/validator-prompt';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-2.5-flash';

// Pricing for our own tracking
const INPUT_PRICE_PER_1M = 0.30;
const OUTPUT_PRICE_PER_1M = 2.50;

interface ValidatorEvent {
  domain: string;
  html: string;  // Cleaned HTML
  extracted: Record<string, any>;  // What Cheerio extracted
  selectors: Record<string, string | null>;  // Selectors used
}

interface ValidatorResult {
  success: boolean;
  domain: string;
  valid: boolean;
  confidence: number;
  essentialFieldsFound: number;
  issues: string[];
  missedData: { field: string; foundValue: string; location: string }[];
  suggestions: string[];
  inputTokens: number;
  outputTokens: number;
  cost: number;
  error?: string;
}

export async function handler(event: ValidatorEvent): Promise<ValidatorResult> {
  const { domain, html, extracted, selectors } = event;
  
  console.log(`🔍 Validator called for domain: ${domain}`);
  
  if (!API_KEY) {
    return {
      success: false,
      domain,
      valid: false,
      confidence: 0,
      essentialFieldsFound: 0,
      issues: ['Missing API key'],
      missedData: [],
      suggestions: [],
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      error: 'Missing GEMINI_API_KEY',
    };
  }

  // Generate enhanced prompt that ACTIVELY SEARCHES for data
  const prompt = generateValidatorPrompt({ domain, html, extracted, selectors });

  const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:generateContent?key=${encodeURIComponent(API_KEY)}`;
  
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,  // Increased for reliable responses
      topP: 0.95,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        domain,
        valid: false,
        confidence: 0,
        essentialFieldsFound: 0,
        issues: [`HTTP error: ${response.status}`],
        missedData: [],
        suggestions: [],
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        error: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    
    console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
    
    // Extract token counts
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    
    console.log(`   Tokens: ${inputTokens} in / ${outputTokens} out`);
    
    // Calculate cost ourselves
    const cost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M + 
                 (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;

    // Handle both streaming and non-streaming response formats
    let text = '';
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = data.candidates[0].content.parts[0].text;
    } else if (Array.isArray(data)) {
      // Streaming response
      for (const chunk of data) {
        text += chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    }
    
    console.log(`   Text length: ${text.length}`);
    if (text.length > 0) {
      console.log(`   Text preview: ${text.slice(0, 300)}...`);
    } else {
      console.log(`   Full response: ${JSON.stringify(data).slice(0, 500)}`);
    }
    
    if (!text) {
      return {
        success: false,
        domain,
        valid: false,
        confidence: 0,
        essentialFieldsFound: 0,
        issues: ['Empty response'],
        missedData: [],
        suggestions: [],
        inputTokens,
        outputTokens,
        cost,
        error: 'Empty response from Gemini',
      };
    }

    // Parse validation result using enhanced parser
    const result = parseValidatorResponse(text);
    
    if (result.issues.length > 0 && result.issues[0].startsWith('Failed to parse')) {
      return {
        success: false,
        domain,
        valid: false,
        confidence: 0,
        essentialFieldsFound: 0,
        issues: result.issues,
        missedData: [],
        suggestions: [],
        inputTokens,
        outputTokens,
        cost,
        error: result.issues[0],
      };
    }

    console.log(`${result.valid ? '✅' : '❌'} Validator for ${domain}: ${result.valid ? 'PASS' : 'FAIL'}`);
    console.log(`   Confidence: ${result.confidence}, Essential fields: ${result.essentialFieldsFound}`);
    if (result.issues.length > 0) {
      console.log(`   Issues: ${result.issues.join(', ')}`);
    }
    if (result.missedData.length > 0) {
      console.log(`   Missed data: ${result.missedData.map(m => m.field).join(', ')}`);
    }
    console.log(`   Tokens: ${inputTokens} in / ${outputTokens} out, Cost: $${cost.toFixed(4)}`);

    return {
      success: true,
      domain,
      valid: result.valid,
      confidence: result.confidence,
      essentialFieldsFound: result.essentialFieldsFound,
      issues: result.issues,
      missedData: result.missedData,
      suggestions: result.suggestions,
      inputTokens,
      outputTokens,
      cost,
    };

  } catch (error: any) {
    return {
      success: false,
      domain,
      valid: false,
      confidence: 0,
      essentialFieldsFound: 0,
      issues: [error.message],
      missedData: [],
      suggestions: [],
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      error: error.message,
    };
  }
}

