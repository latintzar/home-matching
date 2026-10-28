import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const STATE_FILE = 'test_pipeline_state.json';

// --- State Management ---
function loadState(): { listingId?: string } {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Could not read state file, starting fresh.');
    }
  }
  return {};
}

function saveState(data: { listingId?: string }) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  console.log(`💾 State saved: listingId=${data.listingId}`);
}

// --- SSE Stream Reader ---
async function readStream(response: Response, prefix: string) {
  if (!response.body) {
    console.log(`[${prefix}] No response body`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        try {
          const jsonStr = line.substring(6).trim();
          if (!jsonStr) continue;
          const data = JSON.parse(jsonStr);
          
          // Format log based on message type
          if (data.message) {
            console.log(`[${prefix}] ${data.message}`);
          }
          
          if (data.error) {
             console.error(`[${prefix}] ❌ Error: ${data.error}`);
          }

        } catch (e) {
          // ignore parse errors for partial chunks
        }
      }
    }
  }
}

// --- Pipeline Steps ---

async function runScrape(url: string): Promise<string | null> {
  console.log('\n📸 Step 1: Scraping / Creating Listing...');
  const res = await fetch(`${BASE_URL}/api/scrape/robust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Scraping failed: ${res.status} ${err}`);
    return null;
  }

  const data = await res.json();
  const listingId = data.listingId || data.data?.id;
  
  if (!listingId) {
    console.error('❌ No listing ID returned from scraper', data);
    return null;
  }

  console.log(`✅ Listing created! ID: ${listingId}`);
  return listingId;
}

async function runBasicOrchestrator(listingId: string, startFrom?: string) {
  console.log(`\n🧠 Step 2: Basic Orchestrator (A-C, D, F3, G, BuyerReport)${startFrom ? ` resuming from ${startFrom}` : ''}...`);
  const body: any = {};
  if (startFrom) body.startFrom = startFrom;

  const res = await fetch(`${BASE_URL}/api/listings/${listingId}/orchestrate-basic-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error(`❌ Basic Orchestrator failed to start: ${res.status}`);
    const err = await res.text();
    console.error(err);
    throw new Error('Basic Orchestrator failed');
  }

  await readStream(res, 'BASIC');
  console.log('✅ Basic Orchestrator Complete');
}

async function runRenovationOrchestrator(listingId: string, startFrom?: string) {
  console.log(`\n🛠️ Step 3: Renovation Orchestrator (Smart M2, Strategy, Scope, Visuals)${startFrom ? ` resuming from ${startFrom}` : ''}...`);
  const body: any = {};
  if (startFrom) body.startFrom = startFrom;

  const res = await fetch(`${BASE_URL}/api/listings/${listingId}/orchestrate-renovation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error(`❌ Renovation Orchestrator failed to start: ${res.status}`);
    const err = await res.text();
    console.error(err);
    throw new Error('Renovation Orchestrator failed');
  }

  await readStream(res, 'RENO');
  console.log('✅ Renovation Orchestrator Complete');
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  
  // Parse args
  let url = 'https://www.idealista.com/es/inmueble/105445918/';
  let resumeId: string | undefined;
  let orchestrator = 'both'; // basic, reno, both
  let startFrom: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--resume') {
      resumeId = args[++i];
    } else if (arg === '--orchestrator') {
      orchestrator = args[++i];
    } else if (arg === '--start-from') {
      startFrom = args[++i];
    } else if (!arg.startsWith('--')) {
      url = arg;
    }
  }

  // If resuming without specific ID, try loading from state
  if (args.includes('--resume') && !resumeId) {
    const state = loadState();
    if (state.listingId) {
      resumeId = state.listingId;
      console.log(`🔄 Resuming with saved listing ID: ${resumeId}`);
    } else {
      console.error('❌ No saved state found to resume from. Please provide ID.');
      process.exit(1);
    }
  }

  let listingId = resumeId;

  // Step 1: Scrape (if not resuming)
  if (!listingId) {
    const id = await runScrape(url);
    if (!id) process.exit(1);
    listingId = id;
    saveState({ listingId });
  }

  // Step 2: Basic Orchestrator
  if (orchestrator === 'basic' || orchestrator === 'both') {
    try {
      // Only pass startFrom if we are strictly in basic mode or if it's the first step of "both"
      // For simplicity, if user says --start-from and --orchestrator both, we apply it.
      // If they say --orchestrator reno --start-from X, it applies to reno.
      // If they say --orchestrator basic --start-from X, it applies to basic.
      const stepStart = orchestrator === 'basic' || orchestrator === 'both' ? startFrom : undefined;
      await runBasicOrchestrator(listingId!, stepStart);
    } catch (e) {
      console.error('❌ Basic Orchestrator failed. Fix and resume.');
      process.exit(1);
    }
  }

  // Step 3: Renovation Orchestrator
  if (orchestrator === 'reno' || orchestrator === 'both') {
    try {
        const stepStart = orchestrator === 'reno' ? startFrom : undefined;
        await runRenovationOrchestrator(listingId!, stepStart);
    } catch (e) {
      console.error('❌ Renovation Orchestrator failed. Fix and resume.');
      process.exit(1);
    }
  }

  console.log('\n✨ Pipeline Finished Successfully ✨');
  console.log(`👉 Verify UI at: ${BASE_URL}/property/${listingId}`);
}

main().catch(console.error);

