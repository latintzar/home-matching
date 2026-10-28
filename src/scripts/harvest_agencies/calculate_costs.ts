
/**
 * Cost Analysis for Variable-Cost Photo Analysis Pipeline
 * 
 * NEW ARCHITECTURE (2025-01-27):
 * - Only analyze properties that pass lifestyle recommender (Sweet Spot + hard criteria)
 * - Use Gemini 3 Pro Preview for one-time analysis (high quality, reusable)
 * - Use Gemini 2.5 Flash Lite for per-user fit scoring (cheap, reuses stored analysis)
 * - Cost scales with paying customers, not total volume
 * 
 * Assumptions:
 * - Daily Volume: 10,000 listings scraped
 * - Average recommendations per user: 50 listings
 * - Average new listings per user: 20 (40% cache hit rate after warm-up)
 * - Paying customers per day: Variable (scales with revenue)
 * - Exchange Rate: $1 USD = €0.95 EUR
 */

const VOLUME = 10000; // Total scraped listings
const RECOMMENDATIONS_PER_USER = 50;
const NEW_LISTINGS_PER_USER = 20; // 40% cache miss initially
const PAYING_CUSTOMERS_PER_DAY = 100; // Example: scales with revenue

// --- 1. Street View Costs (Google Maps Static API) ---
// Price: $2.00 per 1000 requests (approx, varies by volume tier)
// We need: 4 images per property (0, 90, 180, 270 degrees)
const STREET_VIEW_PRICE_PER_1K = 2.00;
const IMAGES_PER_PROPERTY = 4;
const TOTAL_IMAGES = VOLUME * IMAGES_PER_PROPERTY;
const STREET_VIEW_COST_USD = (TOTAL_IMAGES / 1000) * STREET_VIEW_PRICE_PER_1K;

// --- 2. Gemini Token Costs (Gemini 1.5 Flash) ---
// Pricing (Nov 2025 estimates):
// Input: $0.075 / 1M tokens
// Output: $0.30 / 1M tokens
// Images (Multimodal): $0.00013 / image (approx token equivalent)

const PRICING = {
  input_1m: 0.075,
  output_1m: 0.30,
  image: 0.00013 // Cost per image processed
};

// --- Stage 2.5: Visual Analysis (The "Vibe" Check) ---
// Input: 4 Street View Images
// Output: ~300 tokens (Description, Vibe Score, Condition)
const S2_5_INPUT_IMAGES = 4;
const S2_5_OUTPUT_TOKENS = 300;

const cost_s2_5_images = VOLUME * S2_5_INPUT_IMAGES * PRICING.image;
const cost_s2_5_output = (VOLUME * S2_5_OUTPUT_TOKENS / 1000000) * PRICING.output_1m;
const total_s2_5 = cost_s2_5_images + cost_s2_5_output;

// --- Stage 2.7: Location & Lifestyle (The "Map" Check) ---
// Input: ~1000 tokens (JSON of nearby POIs, distances) + System Prompt (~500)
// Output: ~500 tokens (Lifestyle Analysis, Pros/Cons)
const S2_7_INPUT_TOKENS = 1500;
const S2_7_OUTPUT_TOKENS = 500;

const cost_s2_7_input = (VOLUME * S2_7_INPUT_TOKENS / 1000000) * PRICING.input_1m;
const cost_s2_7_output = (VOLUME * S2_7_OUTPUT_TOKENS / 1000000) * PRICING.output_1m;
const total_s2_7 = cost_s2_7_input + cost_s2_7_output;

// --- Stage 2: Property Details Extraction (The "Facts" Check) ---
// Input: ~2000 tokens (Raw HTML/Text of listing)
// Output: ~800 tokens (Structured JSON: beds, baths, size, features)
const S2_INPUT_TOKENS = 2000;
const S2_OUTPUT_TOKENS = 800;

const cost_s2_input = (VOLUME * S2_INPUT_TOKENS / 1000000) * PRICING.input_1m;
const cost_s2_output = (VOLUME * S2_OUTPUT_TOKENS / 1000000) * PRICING.output_1m;
const total_s2 = cost_s2_input + cost_s2_output;

// --- NEW: Variable-Cost Photo Analysis (2025-01-27) ---
// Gemini 3 Pro Preview: One-time analysis per listing
const GEMINI_3_PRO_INPUT_PRICE = 2.00; // per 1M tokens
const GEMINI_3_PRO_OUTPUT_PRICE = 12.00; // per 1M tokens
const PHOTO_ANALYSIS_INPUT_TOKENS = 8310; // 600 text + 7710 for 30 images
const PHOTO_ANALYSIS_OUTPUT_TOKENS = 2500; // Detailed JSON analysis

const cost_per_listing_analysis = 
  (PHOTO_ANALYSIS_INPUT_TOKENS / 1000000) * GEMINI_3_PRO_INPUT_PRICE +
  (PHOTO_ANALYSIS_OUTPUT_TOKENS / 1000000) * GEMINI_3_PRO_OUTPUT_PRICE;

// Per-user fit scoring (Gemini 2.5 Flash Lite)
const GEMINI_FLASH_LITE_INPUT_PRICE = 0.10; // per 1M tokens
const GEMINI_FLASH_LITE_OUTPUT_PRICE = 0.40; // per 1M tokens
const FIT_SCORE_INPUT_TOKENS = 1500; // Stored analysis + user preferences
const FIT_SCORE_OUTPUT_TOKENS = 200; // Fit score + explanation

const cost_per_fit_score = 
  (FIT_SCORE_INPUT_TOKENS / 1000000) * GEMINI_FLASH_LITE_INPUT_PRICE +
  (FIT_SCORE_OUTPUT_TOKENS / 1000000) * GEMINI_FLASH_LITE_OUTPUT_PRICE;

// Daily costs (variable with paying customers)
const daily_photo_analysis_cost = PAYING_CUSTOMERS_PER_DAY * NEW_LISTINGS_PER_USER * cost_per_listing_analysis;
const daily_fit_scoring_cost = PAYING_CUSTOMERS_PER_DAY * RECOMMENDATIONS_PER_USER * cost_per_fit_score;
const total_variable_cost = daily_photo_analysis_cost + daily_fit_scoring_cost;

// --- Totals (Existing Pipeline) ---
const total_ai_cost = total_s2_5 + total_s2_7 + total_s2;
const total_api_cost = STREET_VIEW_COST_USD;
const grand_total_usd = total_ai_cost + total_api_cost + total_variable_cost;
const grand_total_eur = grand_total_usd * 0.95;

console.log(`
💰 DAILY OPERATIONAL COST ESTIMATE
==================================================

📦 EXISTING PIPELINE (Fixed Costs)
--------------------------------------------------
1. Google Street View API (Harvesting)
   - Volume: ${TOTAL_IMAGES.toLocaleString()} images (4 per listing)
   - Cost: $${STREET_VIEW_COST_USD.toFixed(2)} / day

2. Gemini 1.5 Flash Analysis
   
   Stage 2.5 (Visual/Vibe Analysis)
   - Images: ${VOLUME * 4} processed
   - Cost: $${total_s2_5.toFixed(2)} / day

   Stage 2.7 (Location/Lifestyle)
   - Input: ${(VOLUME * S2_7_INPUT_TOKENS / 1000000).toFixed(1)}M tokens
   - Output: ${(VOLUME * S2_7_OUTPUT_TOKENS / 1000000).toFixed(1)}M tokens
   - Cost: $${total_s2_7.toFixed(2)} / day

   Stage 2 (Fact Extraction)
   - Input: ${(VOLUME * S2_INPUT_TOKENS / 1000000).toFixed(1)}M tokens
   - Output: ${(VOLUME * S2_OUTPUT_TOKENS / 1000000).toFixed(1)}M tokens
   - Cost: $${total_s2.toFixed(2)} / day

🆕 VARIABLE-COST PHOTO ANALYSIS (NEW - 2025-01-27)
--------------------------------------------------
Architecture: Only analyze properties that pass recommender
- Paying Customers/Day: ${PAYING_CUSTOMERS_PER_DAY}
- Recommendations/User: ${RECOMMENDATIONS_PER_USER}
- New Listings/User: ${NEW_LISTINGS_PER_USER} (40% cache miss)

3. Whole Property Analysis (Gemini 3 Pro Preview)
   - One-time cost per listing: $${cost_per_listing_analysis.toFixed(4)}
   - Daily volume: ${PAYING_CUSTOMERS_PER_DAY * NEW_LISTINGS_PER_USER} analyses
   - Cost: $${daily_photo_analysis_cost.toFixed(2)} / day

4. Fit Scoring (Gemini 2.5 Flash Lite)
   - Cost per listing: $${cost_per_fit_score.toFixed(6)}
   - Daily volume: ${PAYING_CUSTOMERS_PER_DAY * RECOMMENDATIONS_PER_USER} scores
   - Cost: $${daily_fit_scoring_cost.toFixed(2)} / day

--------------------------------------------------
TOTAL DAILY COST: $${grand_total_usd.toFixed(2)} USD  (€${grand_total_eur.toFixed(2)})
  - Fixed Pipeline: $${(total_ai_cost + total_api_cost).toFixed(2)}
  - Variable Photo Analysis: $${total_variable_cost.toFixed(2)}
  
COST PER PAYING CUSTOMER: $${(total_variable_cost / PAYING_CUSTOMERS_PER_DAY).toFixed(2)}
  - Photo Analysis: $${(daily_photo_analysis_cost / PAYING_CUSTOMERS_PER_DAY).toFixed(2)}
  - Fit Scoring: $${(daily_fit_scoring_cost / PAYING_CUSTOMERS_PER_DAY).toFixed(2)}

==================================================
MONTHLY RUN RATE: $${(grand_total_usd * 30).toFixed(0)} USD (€${(grand_total_eur * 30).toFixed(0)})
  - Scales with paying customers, not total volume
  - Break-even: ~19 customers/day to match old flat cost
`);

