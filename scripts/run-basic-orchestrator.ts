/**
 * Run Basic Package Orchestrator with polished UI
 * Features:
 * - SSE stream handling
 * - Rolling clock animation (no new lines for waiting)
 * - Clean formatting
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000';


async function runOrchestrator(listingId: string, startFrom?: string, skipSearch?: boolean) {
  console.log(`\n🚀 Starting Basic Package Orchestrator for listing ${listingId}`);
  if (startFrom) console.log(`   From step: ${startFrom}`);
  console.log(`   Endpoint: ${BASE_URL}/api/listings/${listingId}/orchestrate-basic-package\n`);

  try {
    const body: { startFrom?: string; skipSearch?: boolean; force?: boolean } = {
      force: true // Force run even if checks fail
    };
    if (startFrom) body.startFrom = startFrom;
    if (skipSearch) body.skipSearch = true;
    
    const response = await fetch(`${BASE_URL}/api/listings/${listingId}/orchestrate-basic-package`, {
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

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Timer state
    const startTime = Date.now();
    let lastMessageTime = Date.now();
    let isTimerRunning = false;
    let elapsedSeconds = 0;
    let timerLine = '';

    // Start the simple timer (one | per second)
    const timerInterval = setInterval(() => {
      if (!isTimerRunning) return;
      
      elapsedSeconds++;
      timerLine += '|';
      
      // Update the timer line (overwrite same line)
      process.stdout.write(`\r\x1b[K\x1b[90m${timerLine}\x1b[0m`);
    }, 1000); // Update every second

    // Function to print a clean log line
    const printLog = (timestamp: string, step: string, message: string, isError = false, data?: any) => {
      // Clear the current timer line before printing log
      process.stdout.write('\r\x1b[K');
      
      // Colorize step
      const stepColored = `\x1b[36m[${step}]\x1b[0m`; // Cyan
      const timeColored = `\x1b[90m${timestamp}\x1b[0m`; // Gray
      
      let msgColored = message;
      if (isError) msgColored = `\x1b[31m${message}\x1b[0m`; // Red
      else if (message.includes('✅')) msgColored = `\x1b[32m${message}\x1b[0m`; // Green
      else if (message.includes('🚀')) msgColored = `\x1b[35m${message}\x1b[0m`; // Magenta

      console.log(`${timeColored} ${stepColored.padEnd(20)} ${msgColored}`);
      
      if (data && Object.keys(data).length > 0) {
        // Pretty print data indented
        const dataStr = JSON.stringify(data, null, 2);
        const indentedData = dataStr.split('\n').map(line => `                      \x1b[90m${line}\x1b[0m`).join('\n');
        console.log(indentedData);
      }

      // Restore timer line on a new line (will keep updating)
      if (timerLine) {
        process.stdout.write(`\x1b[90m${timerLine}\x1b[0m`);
      }
      lastMessageTime = Date.now();
    };

    isTimerRunning = true;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        clearInterval(timerInterval);
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write('\r\x1b[K'); // Clear timer line
        console.log(`\n✅ Orchestrator completed successfully! (Total time: ${totalTime}s)\n`);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Skip internal endpoint logs if needed, or format them
            if (data.step === 'endpoint-log') {
              // Optional: ignore generic logs or print them differently
              // printLog(new Date().toLocaleTimeString(), 'LOG', data.message);
            } else {
              const timestamp = new Date(data.timestamp).toLocaleTimeString();
              const step = data.step || 'SYSTEM';
              
              printLog(timestamp, step, data.message, !!data.error, data.data);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
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
    i++; 
  } else if (process.argv[i] === '--skipSearch') {
    skipSearch = true;
  }
}

if (listingId) {
  runOrchestrator(listingId, startFrom, skipSearch);
} else {
  console.error('Usage: tsx scripts/run-basic-orchestrator.ts <listing_id> [--startFrom <step>] [--skipSearch]');
  process.exit(1);
}
