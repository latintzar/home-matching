/**
 * Run Parsing Pipeline V2
 * 
 * Usage:
 *   npx tsx scripts/run-parsing-v2.ts              # Run all domains
 *   npx tsx scripts/run-parsing-v2.ts --test 5     # Test with 5 domains
 *   npx tsx scripts/run-parsing-v2.ts --domain X   # Start from domain X
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const REGION = process.env.AWS_REGION || 'us-east-1';
const lambda = new LambdaClient({ region: REGION });

async function main() {
  const args = process.argv.slice(2);
  
  let maxDomains = 2002; // All domains by default
  let startFromDomain: string | undefined;

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test' && args[i + 1]) {
      maxDomains = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--domain' && args[i + 1]) {
      startFromDomain = args[i + 1];
      i++;
    }
  }

  console.log('🚀 STARTING PARSING PIPELINE V2');
  console.log('================================');
  console.log(`Max domains: ${maxDomains}`);
  if (startFromDomain) console.log(`Starting from: ${startFromDomain}`);
  console.log(`Budget limit: $250`);
  console.log('================================\n');

  const payload = {
    maxDomains,
    ...(startFromDomain && { startFromDomain }),
  };

  console.log('Invoking Lambda (this may take a while)...\n');

  const response = await lambda.send(new InvokeCommand({
    FunctionName: 'parse-orchestrator-v2',
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(payload)),
  }));

  if (response.Payload) {
    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    console.log('\n================================');
    console.log('📊 RESULTS');
    console.log('================================');
    console.log(`Processed: ${result.processed} domains`);
    console.log(`Graduated: ${result.graduated} ✅`);
    console.log(`Parked:    ${result.parked} 🅿️`);
    console.log(`Budget:    $${result.budgetUsed?.toFixed(2) || '?'} / $250`);
    if (result.stoppedReason) {
      console.log(`Stopped:   ${result.stoppedReason}`);
    }
    console.log('================================\n');
  }

  if (response.FunctionError) {
    console.error('Lambda error:', response.FunctionError);
  }
}

main().catch(console.error);

