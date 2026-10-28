/**
 * Gemini API Client for Parsing Pipeline
 * 
 * Uses the PUBLISHER ENDPOINT (for credits):
 * https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent?key={API_KEY}
 * 
 * Models:
 * - Teacher: gemini-3-pro-preview ($2/1M input, $12/1M output)
 * - Validator: gemini-2.5-flash ($0.30/1M input, $2.50/1M output)
 */

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';

// Model IDs
export const MODELS = {
  TEACHER: 'gemini-3-pro-preview',
  VALIDATOR: 'gemini-2.5-flash',
} as const;

// Pricing per 1M tokens (for budget tracking)
export const PRICING = {
  'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
} as const;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
  };
}

interface CallResult {
  success: boolean;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

/**
 * Call Gemini via Publisher Endpoint
 */
export async function callGemini(
  model: keyof typeof MODELS,
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseFormat?: 'json' | 'text';
  }
): Promise<CallResult> {
  if (!API_KEY) {
    return { success: false, error: 'Missing GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY' };
  }

  const modelId = MODELS[model];
  const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${modelId}:generateContent?key=${encodeURIComponent(API_KEY)}`;

  const body: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.1,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
      topP: 0.95,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    ],
  };

  // Add JSON response format if requested
  if (options?.responseFormat === 'json') {
    body.generationConfig.responseMimeType = 'application/json';
  }

  // Add thinking config for Gemini 3 Pro
  if (model === 'TEACHER') {
    body.generationConfig.thinkingConfig = { thinkingLevel: 'HIGH' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message || 'Unknown error' };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

    return {
      success: true,
      text,
      inputTokens,
      outputTokens,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Fetch error' };
  }
}

/**
 * Call Teacher (Gemini 3 Pro Preview)
 */
export async function callTeacher(prompt: string): Promise<CallResult> {
  return callGemini('TEACHER', prompt, {
    temperature: 0.1,
    maxOutputTokens: 2048,
    responseFormat: 'json',
  });
}

/**
 * Call Validator (Gemini 2.5 Flash)
 */
export async function callValidator(prompt: string): Promise<CallResult> {
  return callGemini('VALIDATOR', prompt, {
    temperature: 0.1,
    maxOutputTokens: 512,
    responseFormat: 'json',
  });
}

/**
 * Calculate cost from tokens
 */
export function calculateCost(
  model: keyof typeof MODELS,
  inputTokens: number,
  outputTokens: number
): number {
  const modelId = MODELS[model];
  const pricing = PRICING[modelId];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Budget Tracker
 */
export class BudgetTracker {
  private totalInputTokens: { [model: string]: number } = {};
  private totalOutputTokens: { [model: string]: number } = {};
  private budget: number;

  constructor(budgetUSD: number = 200) {
    this.budget = budgetUSD;
    for (const model of Object.values(MODELS)) {
      this.totalInputTokens[model] = 0;
      this.totalOutputTokens[model] = 0;
    }
  }

  track(model: keyof typeof MODELS, inputTokens: number, outputTokens: number): void {
    const modelId = MODELS[model];
    this.totalInputTokens[modelId] += inputTokens;
    this.totalOutputTokens[modelId] += outputTokens;
  }

  getTotalCost(): number {
    let total = 0;
    for (const modelId of Object.values(MODELS)) {
      const pricing = PRICING[modelId];
      total += (this.totalInputTokens[modelId] / 1_000_000) * pricing.input;
      total += (this.totalOutputTokens[modelId] / 1_000_000) * pricing.output;
    }
    return total;
  }

  getRemainingBudget(): number {
    return this.budget - this.getTotalCost();
  }

  isOverBudget(): boolean {
    return this.getTotalCost() > this.budget;
  }

  getReport(): string {
    const lines: string[] = ['=== BUDGET REPORT ==='];
    
    for (const modelId of Object.values(MODELS)) {
      const pricing = PRICING[modelId];
      const inputCost = (this.totalInputTokens[modelId] / 1_000_000) * pricing.input;
      const outputCost = (this.totalOutputTokens[modelId] / 1_000_000) * pricing.output;
      
      lines.push(`\n${modelId}:`);
      lines.push(`  Input:  ${(this.totalInputTokens[modelId] / 1_000_000).toFixed(2)}M tokens = $${inputCost.toFixed(2)}`);
      lines.push(`  Output: ${(this.totalOutputTokens[modelId] / 1_000_000).toFixed(2)}M tokens = $${outputCost.toFixed(2)}`);
    }
    
    lines.push(`\n${'─'.repeat(30)}`);
    lines.push(`TOTAL:     $${this.getTotalCost().toFixed(2)}`);
    lines.push(`BUDGET:    $${this.budget.toFixed(2)}`);
    lines.push(`REMAINING: $${this.getRemainingBudget().toFixed(2)}`);
    
    if (this.isOverBudget()) {
      lines.push(`\n⚠️ OVER BUDGET!`);
    } else {
      lines.push(`\n✅ Within budget`);
    }
    
    return lines.join('\n');
  }
}

