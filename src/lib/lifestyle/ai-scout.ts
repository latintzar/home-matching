import { callGeminiRest } from '../gemini-rest-client';
import { globalCostTracker } from './cost-calculator';

export interface PlaceCandidate {
  id: string;
  name: string;
  categories?: string[];
  rating?: number;
  address?: string;
  // In a real app, we might pass review snippets here
}

export interface VibeCheckResult {
  match: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * The Scout: AI-powered verification of candidates against soft "vibe" constraints.
 * Uses Gemini 2.5 Flash for speed and cost-efficiency.
 */
export class AIScout {
  
  /**
   * Verifies if a list of candidates matches a specific "Vibe" description.
   * Batch processes candidates to save API calls.
   */
  async batchVerifyVibe(candidates: PlaceCandidate[], vibeDescription: string): Promise<Map<string, VibeCheckResult>> {
    console.log(`🕵️ AIScout: Checking ${candidates.length} candidates for vibe: "${vibeDescription}"...`);

    if (candidates.length === 0) return new Map();

    // Prepare a concise list for the prompt
    const candidatesList = candidates.map((c, i) => 
      `${i + 1}. [ID: ${c.id}] Name: "${c.name}", Categories: ${c.categories?.join(', ')}, Rating: ${c.rating}`
    ).join('\n');

    const prompt = `
      You are a discerning "Vibe Curator" for a lifestyle map.
      
      GOAL: Filter this list of places. Keep ONLY those that match the VIBE: "${vibeDescription}".
      
      CRITERIA:
      - Be strict. If it sounds generic or corporate, reject it.
      - If the vibe is "Authentic", reject chains (unless specified otherwise).
      - If the vibe is "Village", look for local/traditional indicators.
      
      CANDIDATES:
      ${candidatesList}
      
      OUTPUT:
      Return a strictly valid JSON array of objects. No markdown, no code blocks.
      [
        { "id": "string", "match": boolean, "reason": "string" }
      ]
    `;

    const response = await callGeminiRest(prompt, {
      model: 'gemini-2.5-flash',
      responseMimeType: 'application/json',
      temperature: 0.1 // Low temp for classification
    });

    if (!response.success || !response.text) {
      console.warn(`⚠️ AIScout failed: ${response.error}. Defaulting to passing all.`);
      // Fallback: Pass all if AI fails to avoid breaking the pipeline
      const fallbackMap = new Map<string, VibeCheckResult>();
      candidates.forEach(c => fallbackMap.set(c.id, { match: true, confidence: 'low', reason: 'AI Check Failed' }));
      return fallbackMap;
    }

    // Track Cost (Gemini Flash)
    globalCostTracker.trackGeminiFlash(prompt.length, response.text.length);

    try {
      let cleanText = response.text.trim();
      // Remove potential markdown code blocks
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      
      const results = JSON.parse(cleanText) as { id: string; match: boolean; reason: string }[];
      
      const resultMap = new Map<string, VibeCheckResult>();
      results.forEach(r => {
        resultMap.set(r.id, {
          match: r.match,
          confidence: 'high',
          reason: r.reason
        });
      });
      
      return resultMap;

    } catch (e) {
      console.error('❌ AIScout Parsing Error:', e);
      
      // FALLBACK: Pass all candidates instead of failing
      console.warn('⚠️ Applying Fallback: Passing all candidates due to AI error.');
      const fallbackMap = new Map<string, VibeCheckResult>();
      candidates.forEach(c => fallbackMap.set(c.id, { 
          match: true, 
          confidence: 'low', 
          reason: 'AI Verification Failed (Fallback applied)' 
      }));
      return fallbackMap;
    }
  }
}
