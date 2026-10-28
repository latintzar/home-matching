
import dotenv from 'dotenv';
// Recipient configuration is supplied by tools/runtime-env.py.
async function runSearch() {
  const { vertexRAG } = await import('./src/lib/vertex-rag');

  // 1. Search Pricing (if configured)
  if (vertexRAG.isConfigured('pricing')) {
    const pricingQuery = "precio reforma cocina 15m2";
    console.log(`🔍 Searching Pricing Store for: "${pricingQuery}"...\n`);
    try {
        const results = await vertexRAG.search('pricing', pricingQuery, 2);
        if (results.length === 0) console.log("⚠️ No results found (Pricing).");
        else results.forEach(r => console.log(`[Pricing] ${r.title}: ${r.content.substring(0, 100)}...`));
    } catch (e) { console.error("Pricing Search Error:", e.message); }
    console.log("\n");
  }

  // 2. Search Legal (if configured)
  if (vertexRAG.isConfigured('legal')) {
    const legalQuery = "licencia obra mayor";
    console.log(`🔍 Searching Legal Store for: "${legalQuery}"...\n`);
    try {
        const results = await vertexRAG.search('legal', legalQuery, 2);
        if (results.length === 0) console.log("⚠️ No results found (Legal).");
        else results.forEach(r => console.log(`[Legal] ${r.title}: ${r.content.substring(0, 100)}...`));
    } catch (e) { console.error("Legal Search Error:", e.message); }
  }
}

runSearch();
