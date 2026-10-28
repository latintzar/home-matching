/**
 * Centralized Pricing Configuration for AI Models and APIs.
 * Source of Truth for all Cost Calculators in the project.
 * 
 * Last Updated: Nov 23, 2025
 */

export const PRICING = {
  VERTEX_AI: {
    // Gemini 3 Pro Preview (< 200k context)
    GEMINI_3_PRO: {
      inputPer1MTokens: 2.00,   // $2.00 / 1M tokens
      outputPer1MTokens: 12.00, // $12.00 / 1M tokens
    },
    // Gemini 2.5 Flash (< 200k context)
    GEMINI_2_5_FLASH: {
      inputPer1MTokens: 0.30,   // $0.30 / 1M tokens
      outputPer1MTokens: 2.50,  // $2.50 / 1M tokens
    },
    // Gemini 1.5 Pro (Legacy/Stable)
    GEMINI_1_5_PRO: {
      inputPer1MTokens: 1.25,
      outputPer1MTokens: 3.75,
    },
    // Gemini 1.5 Flash (Legacy/Stable)
    GEMINI_1_5_FLASH: {
      inputPer1MTokens: 0.075,
      outputPer1MTokens: 0.30,
    }
  },
  APIS: {
    SCRAPING_DOG: {
      perRequest: 0.004, // ~$0.004 per call (Standard plan average)
    },
    GEOAPIFY: {
      perRequest: 0.00, // Free tier (3000/day)
    },
    GOOGLE_MAPS: {
        places: 0.017, // $17 per 1000 requests
        routes: 0.005, // $5 per 1000 requests
    }
  }
};

