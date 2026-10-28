import { callGeminiRest } from '@/lib/gemini-rest-client';

const runTest = async () => {
  console.log("🚀 STARTING TEST SCRIPT...");
  const input = "I want a sunny apartment in Palma, at least 2 bedrooms, max 500k. Must have a terrace and elevator.";
  
  console.log("🧠 Testing Psychologist with input:", input);
  
  const prompt = `
    You are an expert Lifestyle Architect and Real Estate Strategist.
    
    TASK:
    1. Deeply analyze the user's "Lifestyle DNA" from their unstructured request.
    2. Extract specific PROPERTY PREFERENCES (hard/soft constraints) to help filter listings.
    3. Generate 5 distinct "Trade-off Scenarios" to help them find their perfect spot, even if it requires small compromises.
    
    USER INPUT: "${input}"
    
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
    temperature: 0.2
  });

  console.log("🧠 Psychologist Output:", response.text);
  
  if (!response.success) {
      console.error("❌ API Call Failed:", JSON.stringify(response.error, null, 2));
      if (response.rawResponse) console.error("📜 Raw Response:", response.rawResponse);
  }
  
  if (response.text) {
      try {
          const profile = JSON.parse(response.text);
          console.log("✅ Parsed Profile:", JSON.stringify(profile, null, 2));
          
          console.log("\n⚙️ Testing Recommender Filter logic...");
          
          // Simulate DB candidates (using the columns we actually have)
          // Note: bedrooms/bathrooms/sqm are currently in scraped_data JSONB column in DB, not top-level columns.
          // We need to fix the Recommender query to look inside scraped_data or migrate these columns.
          // For now, let's assume the Recommender adapts.
          
          const mockCandidates = [
              { id: 1, price_eur: 450000, scraped_data: { bedrooms: 2, has_elevator: true, has_terrace: true, orientation: 'Exterior' } },
              { id: 2, price_eur: 550000, scraped_data: { bedrooms: 3, has_elevator: true, has_terrace: true } }, // Over budget
              { id: 3, price_eur: 400000, scraped_data: { bedrooms: 1, has_elevator: true, has_terrace: true } }, // Too small
              { id: 4, price_eur: 420000, scraped_data: { bedrooms: 2, has_elevator: false, has_terrace: true } }, // No elevator
              { id: 5, price_eur: 480000, scraped_data: { bedrooms: 2, has_elevator: true, has_terrace: false } }  // No terrace
          ];
          
          const prefs = profile.profile.property_preferences;
          console.log("PREFS:", prefs);
          
          const filtered = mockCandidates.filter(c => {
              const d = c.scraped_data;
              if (prefs.max_price && c.price_eur > prefs.max_price) return false;
              if (prefs.min_bedrooms && d.bedrooms < prefs.min_bedrooms) return false;
              if (prefs.must_have_elevator && d.has_elevator !== true) return false;
              if (prefs.must_have_terrace && d.has_terrace !== true) return false;
              return true;
          });
          
          console.log(`✅ Filter Result: ${filtered.length} matches (Expected 1: Candidate #1)`);
          console.log("Matches:", filtered);
          
      } catch (e) {
          console.error("JSON Parse Error", e);
      }
  }
};

runTest();

