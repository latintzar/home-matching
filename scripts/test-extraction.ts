
import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleAuth } from 'google-auth-library';

// Load env
// Recipient configuration is supplied by tools/runtime-env.py.
async function callGemini(prompt: string) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const modelId = 'gemini-2.5-flash-lite'; // Using a known model ID or fallback

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    console.error(await response.text());
    throw new Error(`Gemini API failed: ${response.status}`);
  }

  return await response.json();
}

async function testExtraction() {
  const snippet = `{"link":"gs://fifth-incentive-471523-b1-rag-data/pricing/presupuestos_proyecto-y-reforma-integral-cocina.html","snippets":[{"snippet":"presupuestos_proyecto-y-reforma-integral-cocina. ... El precio medio de una reforma integral de cocina es de 700 €/m2 aproximadamente..."}]}`;
  
  const context = "Complete Kitchen Renovation";
  
  const prompt = `You are a construction estimator in Spain. Extract the renovation price per square meter (EUR/m2) from the potentially messy text snippet.

CONTEXT: ${context}
TEXT: "${snippet}"

RULES:
1. IGNORE JSON syntax, HTML tags, or metadata (e.g., {"snippet":..., <b>). Focus on the content.
2. LOOK FOR "Reforma Integral" or "Complete Renovation" prices.
3. If a range is given (e.g. "600-800 €/m2"), return the AVERAGE (700).
4. If a total price is given for a specific size (e.g. "3000 € for 6m2"), calculate per m2 (500).
5. If the text refers to a MINOR task (e.g. "Painting only" or "Smoothing walls only") when the Context is "Complete Renovation", IGNORE it or set confidence 'low'.
6. If no valid price is found, return null.

OUTPUT JSON:
{
  "price_m2": number | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "string"
}`;

  console.log("🧪 Testing AI Extraction...");
  try {
    const result = await callGemini(prompt);
    console.log("Result:", JSON.stringify(result, null, 2));
    
    const text = result.candidates[0].content.parts[0].text;
    console.log("\nParsed:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

testExtraction();