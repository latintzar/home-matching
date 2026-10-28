import { supabase } from '@/lib/supabase';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { WholePropertyAnalysis } from '@/types/integrated-analysis';

export interface FitScoreResult {
  fit_score: number;
  explanation: string;
  strengths: string[];
  concerns: string[];
  match_details?: {
    property_preferences_match: string;
    lifestyle_dna_match: string;
    visual_quality_match: string;
  };
  usage?: any;
}

export interface FitScoreInput {
  listing_id: number;
  user_preferences: any;
  analysis_data?: WholePropertyAnalysis; // Optional: pass if already fetched
  listing_data?: any; // Optional: pass if already fetched
}

/**
 * Calculates a fit score for a listing based on whole property analysis + user preferences
 * Uses Gemini 2.5 Flash Lite for cost-effective scoring
 */
export async function calculateFitScore(input: FitScoreInput): Promise<FitScoreResult> {
  const { listing_id, user_preferences } = input;
  let { analysis_data, listing_data } = input;

  // 1. Fetch analysis if not provided
  if (!analysis_data) {
    const { data: analysis, error: analysisError } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data')
      .eq('listing_id', listing_id)
      .single();

    if (analysisError || !analysis) {
      throw new Error(`No analysis found for listing ${listing_id}`);
    }
    analysis_data = analysis.analysis_data as WholePropertyAnalysis;
  }

  // 2. Fetch listing data if not provided
  if (!listing_data) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, price_eur, sqm, bedrooms, bathrooms, city')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      throw new Error(`Listing ${listing_id} not found`);
    }
    listing_data = listing;
  }

  // 3. Build scoring prompt
  const prompt = `
You are a real estate matchmaker. Calculate a fit score (0-100) for this property based on the user's preferences.

PROPERTY ANALYSIS (from photo analysis):
${JSON.stringify(analysis_data, null, 2)}

PROPERTY DETAILS:
- Title: ${listing_data.title}
- Price: €${listing_data.price_eur?.toLocaleString()}
- Size: ${listing_data.sqm} m²
- Bedrooms: ${listing_data.bedrooms}
- Bathrooms: ${listing_data.bathrooms}
- City: ${listing_data.city}

USER PREFERENCES:
${JSON.stringify(user_preferences, null, 2)}

TASK:
1. Analyze how well this property matches the user's preferences
2. Consider:
   - Property preferences (price, size, features)
   - Lifestyle DNA (values, persona)
   - Visual analysis (lighting, finishes, condition)
   - Summary ratings (envelope, moisture, windows, etc.)
3. Calculate a fit score (0-100) where:
   - 90-100: Excellent match, exceeds expectations
   - 75-89: Very good match, minor concerns
   - 60-74: Good match, some trade-offs
   - 40-59: Moderate match, significant concerns
   - 0-39: Poor match, major issues

OUTPUT JSON:
{
  "fit_score": 87,
  "explanation": "2-3 sentences explaining the match",
  "strengths": ["Natural lighting matches preference", "Modern finishes", "Good location"],
  "concerns": ["May need AC upgrade", "Price at upper limit"],
  "match_details": {
    "property_preferences_match": "high|medium|low",
    "lifestyle_dna_match": "high|medium|low",
    "visual_quality_match": "high|medium|low"
  }
}

Return ONLY valid JSON without additional text.
`;

  // 4. Call Gemini 2.5 Flash Lite
  const geminiResponse = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.3,
    topP: 0.8,
    maxOutputTokens: 2000,
    responseMimeType: 'application/json'
  });

  if (!geminiResponse.success || !geminiResponse.text) {
    throw new Error(geminiResponse.error || 'Gemini scoring failed');
  }

  // 5. Parse response
  let result: FitScoreResult;
  try {
    let cleaned = geminiResponse.text.trim();
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    result = JSON.parse(cleaned);
    
    // Add usage metadata
    result.usage = geminiResponse.usage;
    
    // Validate
    if (typeof result.fit_score !== 'number' || result.fit_score < 0 || result.fit_score > 100) {
      // Fallback if score is invalid
      result.fit_score = 50;
      result.explanation = "Score calculation returned invalid range. Review manually.";
    }
  } catch (e) {
    throw new Error(`Failed to parse scoring response: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}

