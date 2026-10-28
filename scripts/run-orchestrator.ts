/**
 * Run orchestrator for a listing and display SSE progress
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000';

async function runOrchestrator(listingId: string, startFrom?: string, skipSearch?: boolean) {
  console.log(`🚀 Starting orchestrator for listing ${listingId}${startFrom ? ` from ${startFrom}` : ''}${skipSearch ? ' (curation only)' : ''}\n`);
  console.log(`📡 Connecting to: ${BASE_URL}/api/listings/${listingId}/orchestrate-d-to-r3\n`);

  try {
    const body: { startFrom?: string; skipSearch?: boolean } = {};
    if (startFrom) {
      body.startFrom = startFrom;
    }
    if (skipSearch) {
      body.skipSearch = true;
    }
    
    const response = await fetch(`${BASE_URL}/api/listings/${listingId}/orchestrate-d-to-r3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      console.error(errorText);
      process.exit(1);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('\n✅ Orchestrator completed!');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            // For endpoint-log messages, the step is already in the message, so don't duplicate it
            if (data.step === 'endpoint-log') {
              console.log(data.message);
            } else {
            const timestamp = new Date(data.timestamp).toLocaleTimeString();
            const step = data.step ? `[${data.step}]` : '';
            console.log(`${timestamp} ${step} ${data.message}`);
            
            if (data.error) {
              console.error(`   ❌ Error: ${data.error}`);
            }
            if (data.data && Object.keys(data.data).length > 0) {
              console.log(`   📊 Data:`, JSON.stringify(data.data, null, 2));
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

const listingId = process.argv[2];
let startFrom: string | undefined;
let skipSearch = false;

// Parse command line arguments
for (let i = 3; i < process.argv.length; i++) {
  if (process.argv[i] === '--startFrom' && i + 1 < process.argv.length) {
    startFrom = process.argv[i + 1];
    i++; // Skip next arg as it's the value
  } else if (process.argv[i] === '--skipSearch') {
    skipSearch = true;
  }
}

if (listingId) {
  runOrchestrator(listingId, startFrom, skipSearch)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/run-orchestrator.ts <listing_id> [--startFrom <step>] [--skipSearch]');
  process.exit(1);
}

