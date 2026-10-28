/**
 * Leo Vibe Maps - Background Service Worker
 * 
 * Handles Gemini API calls for AI-generated vibe areas.
 * Uses the same endpoint as zero-shot clustering (gemini-3-pro-preview).
 */

// Gemini API Configuration
// Using gemini-2.5-pro - the most advanced model available via API key
// (gemini-3-pro-preview requires OAuth2 which Chrome extensions can't use)
const API_ENDPOINT = 'generativelanguage.googleapis.com';
const MODEL_ID = 'gemini-2.5-pro';
const GENERATE_CONTENT_API = 'generateContent';

// API Key - hardcoded for testing (from .env.local GOOGLE_AI_API_KEY)
let API_KEY = '';

/**
 * Build the prompt for generating vibe areas
 */
function buildVibePrompt(tripDescription, city = 'Barcelona') {
  return `You are a ${city} local expert helping travelers find the PERFECT neighborhoods AND plan activities for their specific trip.

TRIP: "${tripDescription}"

Your job: Recommend exactly 5 neighborhoods that are IDEAL for this exact trip, with a mini-itinerary of things to search for in each area.

REQUIREMENTS:
1. Pick 5 REAL ${city} neighborhoods with ACCURATE coordinates
2. Write a SHORT "why" (max 140 characters!) - punchy, exciting, sells the area
3. Create an "itinerary" of 3 contextual Google Maps searches per area - things that make sense for THIS trip in THIS neighborhood

ITINERARY EXAMPLES (be creative based on the trip!):
- For "lads trip after a football game": 
  - { "purpose": "🍺 Pre-match beers", "query": "sports bars big screens" }
  - { "purpose": "🍖 Victory feast", "query": "steakhouse open late" }
  - { "purpose": "🎉 Keep the party going", "query": "nightclubs open late" }
- For "work trip with evening free":
  - { "purpose": "💻 Afternoon work spot", "query": "laptop friendly cafes" }
  - { "purpose": "🍷 Client dinner", "query": "upscale restaurants" }
  - { "purpose": "🥃 Nightcap", "query": "cocktail bars" }

COORDINATE REFERENCE (use these as starting points):
- Gothic Quarter: 41.3833, 2.1777
- El Born: 41.3850, 2.1825
- Gràcia: 41.4025, 2.1530
- Barceloneta: 41.3807, 2.1897
- Eixample: 41.3917, 2.1649
- Poble Sec: 41.3730, 2.1620
- Sant Antoni: 41.3790, 2.1590
- Raval: 41.3800, 2.1680
- Poblenou: 41.4033, 2.2044
- Les Corts: 41.3870, 2.1300
- Sarrià: 41.3990, 2.1220
- Sants: 41.3750, 2.1350

COLORS (use one per area, don't repeat):
"#E74C3C" (red), "#3498DB" (blue), "#2ECC71" (green), "#F39C12" (orange), "#9B59B6" (purple)

Return ONLY valid JSON array:
[
  {
    "name": "Neighborhood Name",
    "lat": 41.XXXX,
    "lng": 2.XXXX,
    "radius": 400,
    "color": "#HEXCODE",
    "why": "Short punchy reason - max 140 chars!",
    "itinerary": [
      { "purpose": "🍽️ What you'll do", "query": "google maps search terms" },
      { "purpose": "🍺 Next activity", "query": "relevant search terms" },
      { "purpose": "🌙 End the night", "query": "appropriate search" }
    ]
  }
]

CRITICAL REQUIREMENTS:
- "why" MUST be under 140 characters - punchy and exciting!
- "itinerary" MUST have exactly 3 items per area
- "purpose" should explain what this activity is for (include emoji!)
- "query" should be Google Maps search terms that will find relevant places
- Make itineraries flow logically (e.g., dinner → drinks → dancing)
- Tailor searches to the SPECIFIC trip described
- Use Google Search to understand what's actually in each neighborhood!`;
}

/**
 * Call Gemini API to generate vibe areas
 */
async function generateVibeAreas(tripDescription, city = 'Barcelona') {
  console.log('🤖 Generating vibe areas for:', tripDescription);
  
  // Use stored key if available, otherwise use hardcoded
  const stored = await chrome.storage.local.get('geminiApiKey');
  const key = stored.geminiApiKey || API_KEY;
  
  if (!key) {
    throw new Error('Gemini API key not configured');
  }
  
  const prompt = buildVibePrompt(tripDescription, city);
  
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8000,
      topP: 0.95,
      // Note: Can't use responseMimeType with tools, so we parse JSON from text
    },
    // Enable Google Search grounding for up-to-date restaurant/bar info
    tools: [
      {
        googleSearch: {}
      }
    ],
  };
  
  // Use v1beta for generativelanguage API
  const url = `https://${API_ENDPOINT}/v1beta/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${key}`;
  
  console.log('🌐 Calling Gemini API...', url.replace(key, 'API_KEY_HIDDEN'));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  
  const rawResponse = await response.text();
  
  if (!response.ok) {
    let errorData = {};
    try {
      errorData = JSON.parse(rawResponse);
    } catch {}
    console.error('❌ Gemini API error:', response.status, errorData);
    console.error('❌ Error details:', JSON.stringify(errorData, null, 2));
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${rawResponse.substring(0, 200)}`);
  }
  
  // Parse response (non-streaming returns single object)
  let responseData;
  try {
    responseData = JSON.parse(rawResponse);
  } catch (parseError) {
    console.error('❌ Failed to parse response:', rawResponse.substring(0, 500));
    throw new Error(`Failed to parse API response: ${parseError.message}`);
  }
  
  // Extract text from response
  let responseText = '';
  const candidates = responseData?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        responseText += part.text;
      }
    }
  }
  
  console.log('📝 Raw response text:', responseText);
  
  // Parse the JSON array from response
  let areas;
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      areas = JSON.parse(jsonMatch[0]);
    } else {
      areas = JSON.parse(responseText);
    }
  } catch (parseError) {
    console.error('❌ Failed to parse areas JSON:', responseText);
    throw new Error('AI returned invalid JSON format');
  }
  
  // Validate the areas
  if (!Array.isArray(areas) || areas.length === 0) {
    throw new Error('AI returned empty or invalid areas array');
  }
  
  // Check if grounding was used
  const groundingMetadata = responseData?.candidates?.[0]?.groundingMetadata;
  const wasGrounded = !!groundingMetadata?.groundingChunks?.length;
  const searchQueries = groundingMetadata?.webSearchQueries || [];
  
  console.log('🔍 Grounding used:', wasGrounded);
  if (wasGrounded) {
    console.log('🔍 Search queries:', searchQueries);
    console.log('🔍 Sources:', groundingMetadata.groundingChunks.map(c => c.web?.title).filter(Boolean));
  }
  
  // Validate each area has required fields
  const validatedAreas = areas.map((area, i) => {
    if (!area.name || !area.lat || !area.lng) {
      console.warn(`⚠️ Area ${i} missing required fields:`, area);
    }
    
    // Validate itinerary items
    let itinerary = [];
    if (Array.isArray(area.itinerary)) {
      itinerary = area.itinerary.map(item => ({
        purpose: item.purpose || '📍 Explore',
        query: item.query || 'things to do'
      })).slice(0, 3); // Max 3 items
    }
    
    return {
      name: area.name || `Area ${i + 1}`,
      lat: parseFloat(area.lat) || 41.3870,
      lng: parseFloat(area.lng) || 2.1700,
      radius: parseInt(area.radius) || 400,
      color: area.color || ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'][i % 5],
      why: area.why || 'A great neighborhood for your trip!',
      itinerary: itinerary,
      places: Array.isArray(area.places) ? area.places : [], // Keep for backwards compat
      grounded: wasGrounded,
    };
  });
  
  console.log('✅ Generated areas:', validatedAreas);
  console.log('📊 Grounding status:', wasGrounded ? '✅ Web search used' : '❌ No grounding');
  return validatedAreas;
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request.action);
  
  if (request.action === 'generateVibeAreas') {
    generateVibeAreas(request.tripDescription, request.city || 'Barcelona')
      .then(areas => {
        console.log('✅ Sending areas back to popup');
        sendResponse({ success: true, areas });
      })
      .catch(err => {
        console.error('❌ Error generating areas:', err);
        sendResponse({ success: false, error: err.message });
      });
    
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'setApiKey') {
    chrome.storage.local.set({ geminiApiKey: request.apiKey });
    API_KEY = request.apiKey;
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Background script is running' });
    return true;
  }
});

console.log('🚀 Leo Vibe Maps background script loaded');
