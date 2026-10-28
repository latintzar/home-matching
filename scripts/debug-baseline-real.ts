
import { VertexRAGClient } from '../src/lib/vertex-rag';
import { callGeminiRest } from '../src/lib/gemini-rest-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
// Recipient configuration is supplied by tools/runtime-env.py.
const vertexRAG = new VertexRAGClient();

async function extractPriceFromText(text: string, context: string): Promise<{ price_m2: number; confidence: string; reasoning: string } | null> {
    try {
        console.log(`\n🤖 Extracting from text length: ${text.length}`);
        const prompt = `You are a construction estimator in Spain. Extract the renovation price per square meter (EUR/m2) from the potentially messy text snippet.

CONTEXT: ${context}
TEXT: "${text.substring(0, 10000)}"

RULES:
1. IGNORE JSON syntax, HTML tags, or metadata. Focus on the content.
2. LOOK FOR "Reforma Integral" or "Complete Renovation" prices.
3. If a range is given (e.g. "600-800 €/m2"), return the AVERAGE (700).
4. If a total price is given for a specific size (e.g. "3000 € for 6m2"), calculate per m2 (500).
5. If the text refers to a MINOR task (e.g. "Painting only") when the Context is "Complete Renovation", IGNORE it or set confidence 'low'.
6. If no valid price is found, return null.

OUTPUT JSON:
{
  "price_m2": number | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "string"
}`;

        const result = await callGeminiRest(prompt, {
            model: 'gemini-2.5-flash-lite', // Fast & Cheap
            temperature: 0.0,
            responseMimeType: 'application/json'
        });

        if (!result.success || !result.text) {
            console.log('❌ Extraction failed: No text returned');
            return null;
        }
        console.log('✅ Extraction Raw:', result.text);
        
        const parsed = JSON.parse(result.text);
        return parsed;

    } catch (e) {
        console.warn('Price extraction failed', e);
        return null;
    }
}

async function run() {
  console.log('🔍 Debugging Baseline Check Logic...');
  
  const queries = [
      "presupuestos_proyecto-y-reforma-integral-cocina",
      "precio reforma integral cocina m2",
      "precio reforma integral piso m2"
  ];

  for (const query of queries) {
    console.log(`\n\n----------------------------------------`);
    console.log(`🔍 Query: "${query}"`);
    
    const results = await vertexRAG.search('pricing', query, 3);
    console.log(`📄 Results found: ${results.length}`);

    for (const result of results) {
        console.log(`\n  📄 Title: ${result.title}`);
        console.log(`  📄 Source: ${result.source}`);
        console.log(`  📄 Content Length: ${result.content.length}`);
        console.log(`  📄 Metadata: ${JSON.stringify(result.metadata)}`); // Added logging
        
        const context = query.includes('cocina') ? "Complete Kitchen Renovation" : "General Renovation";
        const extraction = await extractPriceFromText(result.content, context);
        
        if (extraction) {
            console.log(`  💰 Extracted: ${extraction.price_m2} €/m2 (Conf: ${extraction.confidence})`);
            console.log(`  📝 Reasoning: ${extraction.reasoning}`);
        } else {
            console.log(`  ❌ No price extracted.`);
        }
    }
  }
}

run();

