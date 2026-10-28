import { callGeminiRest } from '../gemini-rest-client';
import { globalCostTracker } from './cost-calculator';

// --- Types ---

export interface AIProfile {
  user_persona: string;
  core_values: string[];
  hidden_gems: string[]; // Creative search ideas
  hard_constraints: any[];
  soft_constraints: any[];
  property_preferences: {
    max_price?: number;
    min_bedrooms?: number;
    min_bathrooms?: number;
    min_area?: number;
    must_have_elevator?: boolean;
    must_have_terrace?: boolean;
    must_have_balcony?: boolean;
    must_have_parking?: boolean;
    must_have_pool?: boolean;
    must_have_air_conditioning?: boolean;
    min_floor_level?: string[]; // 'ground', 'intermediate', 'top'
    orientation_preference?: string[]; // 'Exterior', 'Interior'
    condition_preference?: string[]; // 'new', 'good', 'renovate'
  };
}

export interface AIScenario {
  name: string;
  justification: string;
  changes: {
    anchor_id: string;
    parameter: 'distance' | 'rating' | 'dependency';
    value: any;
  }[];
}

export interface SmartLifestyleResult {
  profile: AIProfile;
  scenarios: AIScenario[];
}

// --- Combined Smart Profiler (Gemini 3 Pro Preview) ---

export async function generateSmartLifestyleProfile(userInput: string): Promise<SmartLifestyleResult> {
  console.log('🧠 AI Profiler: Analyzing & Strategizing with Gemini 3 Pro Preview...');
  
  const prompt = `
    You are an expert Lifestyle Architect and Real Estate Strategist.
    
    TASK:
    1. Deeply analyze the user's "Lifestyle DNA" from their unstructured request.
    2. Extract specific PROPERTY PREFERENCES (hard/soft constraints) to help filter listings.
    3. Generate 5 distinct "Trade-off Scenarios" to help them find their perfect spot, even if it requires small compromises.
    
    USER INPUT: "${userInput}"
    
    OUTPUT SCHEMA (JSON):
    {
      "profile": {
        "user_persona": "Creative name (e.g. The Cultured Solitary Athlete)",
        "core_values": ["Value 1", "Value 2", "Value 3"],
        "hidden_gems": ["Creative search query 1", "Creative search query 2"],
        "property_preferences": {
            "max_price": 500000,
            "min_bedrooms": 2,
            "min_bathrooms": 1,
            "min_area": 80,
            "must_have_elevator": true,
            "must_have_terrace": false,
            "must_have_balcony": true,
            "must_have_parking": false,
            "must_have_pool": false,
            "must_have_air_conditioning": true,
            "min_floor_level": ["intermediate", "top"],
            "orientation_preference": ["Exterior"],
            "condition_preference": ["good", "renovate"]
        },
        "hard_constraints": [],
        "soft_constraints": []
      },
      "scenarios": [
        {
          "name": "Scenario Title",
          "justification": "Why this trade-off makes sense for THIS user.",
          "changes": [
            { "anchor_id": "beach|tennis|pool|work", "parameter": "distance|rating|dependency", "value": 20 }
          ]
        }
      ]
    }
    
    SCENARIO GUIDELINES:
    - Scenario 1: "The Perfectionist" (Strict constraints).
    - Scenario 2: "The Commuter" (Relax work distance for better lifestyle).
    - Scenario 3: "The Explorer" (Relax specific amenity distance if vibe is right).
    - Scenario 4: "The Socialite" (Prioritize "hidden_gems" or social areas).
    - Scenario 5: "The Wildcard" (A surprising but logical trade-off).
    - Ensure 'changes' map to valid Anchor IDs: 'beach', 'tennis', 'pool', 'work'.
    - 'dependency' value should be a search query string (e.g. "specialty coffee").
    
    PROPERTY EXTRACTION RULES:
    - Only set boolean to true if explicitly requested or strongly implied (e.g. "high floor" -> elevator=true).
    - Infer "min_floor_level" from "views", "light", "penthouse".
    - Infer "orientation" from "light", "sun".
    - If unmentioned, leave as null/undefined.
  `;

  const response = await callGeminiRest(prompt, {
    model: 'gemini-3-pro-preview',
    responseMimeType: 'application/json',
    temperature: 0.2,
    thinkingConfig: {
      thinkingLevel: 'HIGH'
    }
  });

  if (!response.success || !response.text) {
    throw new Error(`Gemini Profiler Error: ${JSON.stringify(response.error)}`);
  }
  
  // Track Cost
  globalCostTracker.trackGeminiPro(prompt.length, response.text.length);
  
  try {
    // Handle potential markdown code blocks in response
    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    throw new Error(`Failed to parse Smart Lifestyle JSON: ${e}`);
  }
}
