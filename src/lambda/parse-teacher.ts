/**
 * TEACHER Lambda - Learn CSS Selectors for a Domain
 * 
 * Uses Gemini 3 Pro Preview via publisher endpoint.
 * Called ONCE per domain to learn selectors.
 * 
 * Input: { domain, sampleHtml, sampleUrl }
 * Output: { success, selectors, inputTokens, outputTokens, cost }
 */

import { generateTeacherPrompt } from '../parked/bulk-harvester/harvest/teacher-prompt';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-3-pro-preview';

// Pricing for our own tracking
const INPUT_PRICE_PER_1M = 2.00;
const OUTPUT_PRICE_PER_1M = 12.00;

interface TeacherEvent {
  domain: string;
  sampleHtml: string;
  sampleUrl: string;
  universalContext?: string;  // Context from Universal Ruleset
}

interface TeacherResult {
  success: boolean;
  domain: string;
  selectors?: Record<string, string | null>;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  error?: string;
}

export async function handler(event: TeacherEvent): Promise<TeacherResult> {
  const { domain, sampleHtml, sampleUrl, universalContext } = event;
  
  console.log(`🎓 Teacher called for domain: ${domain}`);
  console.log(`   HTML size: ${sampleHtml?.length || 0} chars`);
  console.log(`   URL: ${sampleUrl}`);
  console.log(`   Universal context: ${universalContext ? 'provided' : 'none'}`);
  
  if (!API_KEY) {
    console.log('❌ Missing API KEY!');
    return {
      success: false,
      domain,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      error: 'Missing GEMINI_API_KEY',
    };
  }
  
  console.log(`   API Key: ${API_KEY?.slice(0, 10)}...`);

  // Generate prompt with our learnings + Universal Ruleset context
  let prompt = generateTeacherPrompt(sampleHtml, domain, sampleUrl);
  
  // Prepend Universal Ruleset context if available
  if (universalContext) {
    prompt = universalContext + '\n\n---\n\n' + prompt;
  }
  
  // Call Gemini 3 Pro via publisher endpoint
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
      maxOutputTokens: 16384,  // Increased! Thinking uses ~2K, need room for response
      topP: 0.95,
      thinkingConfig: { thinkingLevel: 'MEDIUM' },  // Reduced to save tokens
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
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    
    console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
    console.log(`   Full response (first 2000 chars): ${JSON.stringify(data).slice(0, 2000)}`);
    
    // Check for blocking/errors
    if (data.candidates?.[0]?.finishReason) {
      console.log(`   Finish reason: ${data.candidates[0].finishReason}`);
    }
    if (data.candidates?.[0]?.safetyRatings) {
      console.log(`   Safety ratings: ${JSON.stringify(data.candidates[0].safetyRatings)}`);
    }
    
    // Extract token counts from response
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    
    console.log(`   Tokens: ${inputTokens} in / ${outputTokens} out`);
    
    // Calculate cost ourselves
    const cost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M + 
                 (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;

    // Extract text response - handle various formats including thinking model
    let text = '';
    const candidate = data.candidates?.[0];
    
    if (candidate?.content?.parts) {
      // Iterate through all parts - thinking models may have multiple parts
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text;
        }
      }
      console.log(`   Parts count: ${candidate.content.parts.length}`);
    } else if (Array.isArray(data)) {
      // Streaming response comes as array
      for (const chunk of data) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) text += part.text;
        }
      }
    }
    
    console.log(`   Text length: ${text.length} chars`);
    if (text.length > 0) {
      console.log(`   Text preview: ${text.slice(0, 200)}...`);
    }
    
    if (!text) {
      return {
        success: false,
        domain,
        inputTokens,
        outputTokens,
        cost,
        error: 'Empty response from Gemini',
      };
    }

    // Parse JSON selectors
    let selectors: Record<string, string | null>;
    try {
      // Try to extract JSON from response (might have markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }
      selectors = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      return {
        success: false,
        domain,
        inputTokens,
        outputTokens,
        cost,
        error: `JSON parse error: ${parseError.message}`,
      };
    }

    console.log(`✅ Teacher learned selectors for ${domain}`);
    console.log(`   Tokens: ${inputTokens} in / ${outputTokens} out`);
    console.log(`   Cost: $${cost.toFixed(4)}`);

    return {
      success: true,
      domain,
      selectors,
      inputTokens,
      outputTokens,
      cost,
    };

  } catch (error: any) {
    return {
      success: false,
      domain,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      error: error.message,
    };
  }
}

