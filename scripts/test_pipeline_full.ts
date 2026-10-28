
const BASE_URL = 'http://localhost:3000';
const TARGET_URL = 'https://www.idealista.com/es/inmueble/105445918/';

async function readStream(response: any, prefix: string) {
  if (!response.body) {
    console.log(`[${prefix}] No response body`);
    return;
  }

  const reader = response.body;
  // For node-fetch, body is a stream
  for await (const chunk of reader) {
    const text = chunk.toString();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.message) {
             console.log(`[${prefix}] ${data.message}`);
          }
        } catch (e) {
          // ignore parse errors for partial chunks
        }
      }
    }
  }
}

async function runPipeline() {
  console.log('🚀 Starting Pipeline Test');
  console.log(`📍 Target URL: ${TARGET_URL}`);

  // 1. Scrape / Manual Entry Simulation
  console.log('\n📸 Step 1: Scraping / Creating Listing...');
  const scrapeRes = await fetch(`${BASE_URL}/api/scrape/robust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: TARGET_URL })
  });

  if (!scrapeRes.ok) {
    const err = await scrapeRes.text();
    console.error(`❌ Scraping failed: ${scrapeRes.status} ${err}`);
    return;
  }

  const scrapeData = await scrapeRes.json();
  const listingId = scrapeData.listingId || scrapeData.data?.id; // Adjust based on actual response structure
  
  if (!listingId) {
      console.error('❌ No listing ID returned from scraper', scrapeData);
      return;
  }

  console.log(`✅ Listing created! ID: ${listingId}`);

  // 2. Basic Orchestrator
  console.log('\n🧠 Step 2: Basic Orchestrator (A-C, D, F3, G, BuyerReport)...');
  const basicRes = await fetch(`${BASE_URL}/api/listings/${listingId}/orchestrate-basic-package`, {
    method: 'POST'
  });

  if (!basicRes.ok) {
     console.error(`❌ Basic Orchestrator failed to start: ${basicRes.status}`);
     const err = await basicRes.text();
     console.error(err);
     // Continue? Maybe not if basic fails.
     return; 
  }

  await readStream(basicRes, 'BASIC');
  console.log('✅ Basic Orchestrator Complete');

  // 3. Renovation Orchestrator
  console.log('\n🛠️ Step 3: Renovation Orchestrator (Smart M2, Strategy, Scope, Visuals)...');
  const renoRes = await fetch(`${BASE_URL}/api/listings/${listingId}/orchestrate-renovation`, {
      method: 'POST'
  });

  if (!renoRes.ok) {
      console.error(`❌ Renovation Orchestrator failed to start: ${renoRes.status}`);
      const err = await renoRes.text();
      console.error(err);
      return;
  }

  await readStream(renoRes, 'RENO');
  console.log('✅ Renovation Orchestrator Complete');

  console.log('\n✨ Pipeline Finished Successfully ✨');
  console.log(`👉 verify UI at: ${BASE_URL}/property/${listingId}`);
}

runPipeline().catch(console.error);

