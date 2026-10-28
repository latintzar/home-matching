/**
 * RE-SPIDER PRIORITY DOMAINS
 * 
 * Fires spider-single Lambda with 400 CONCURRENCY (async).
 * Major agencies get 3 passes, others get 1-2.
 * 
 * Run: npx tsx scripts/respider-priority.ts
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

const BATCH_SIZE = 400;  // Fire 400 Lambdas at once
const DELAY_BETWEEN_BATCHES = 1000;  // 1s between batches

// TIER 1: Major agency brands - run 3x each
const TIER1_DOMAINS = [
  'century21.es',
  'remax.es',
  'remaxpremium.es',
  'remaxcasaelite.es',
  'tecnicasa.net',
  'andorra-sothebysrealty.com',
];

// TIER 1B: Never crawled - run 1x
const TIER1B_DOMAINS = [
  'engelvoelkers.com',
  'housfy.com',
  'grocasa.com',
  'kwspain.es',
];

// TIER 2: Low listing count - run 2x
const TIER2_DOMAINS = [
  'savills.es',
  'coldwellbanker.es',
];

// TIER 3: High URL count - run 1x
const TIER3_DOMAINS = [
  'gestinfer.es',
  'elgi.es',
  'vincent-realestate.com',
  'castilloproperties.es',
  'vibeinmobiliaria.com',
  'inmobiliariacalidad.com',
  'vallesdelpirineo.com',
  'manuelaperez.com',
  'impulsoinmobiliario.com',
  'tenerife-inmobiliarias.es',
];

// Invoke Lambda ASYNC (fire and forget) - this is the fast way
async function invokeSpiderAsync(domain: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: 'spider-single',
    InvocationType: 'Event',  // Async - fire and forget
    Payload: Buffer.from(JSON.stringify({ domain })),
  }));
}

// Get URL count for a domain from leo-urls
async function getUrlCount(domain: string): Promise<number> {
  let count = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#d = :domain',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':domain': { S: domain } },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
      Limit: 10000,
    }));
    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
    // Only scan a bit - don't need exact count
    if (count > 0 || !lastKey) break;
  } while (lastKey);
  
  return count;
}

async function main() {
  console.log('🕷️  RE-SPIDER PRIORITY DOMAINS\n');
  console.log('Using 400 CONCURRENT Lambdas (async fire-and-forget).');
  console.log('Major agencies get 3 passes to ensure deep crawling.\n');

  // Build list of all invocations
  const invocations: Array<{ domain: string; pass: number; tier: string }> = [];
  
  // TIER 1: Major agencies - 3 passes each
  for (const domain of TIER1_DOMAINS) {
    for (let pass = 1; pass <= 3; pass++) {
      invocations.push({ domain, pass, tier: 'TIER1' });
    }
  }
  
  // TIER 1B: Never crawled - 1 pass each
  for (const domain of TIER1B_DOMAINS) {
    invocations.push({ domain, pass: 1, tier: 'TIER1B' });
  }
  
  // TIER 2: Low listings - 2 passes each
  for (const domain of TIER2_DOMAINS) {
    for (let pass = 1; pass <= 2; pass++) {
      invocations.push({ domain, pass, tier: 'TIER2' });
    }
  }
  
  // TIER 3: High URL count - 1 pass each
  for (const domain of TIER3_DOMAINS) {
    invocations.push({ domain, pass: 1, tier: 'TIER3' });
  }

  console.log(`📋 Total invocations planned: ${invocations.length}`);
  console.log(`   TIER1 (major agencies, 3x): ${TIER1_DOMAINS.length * 3} invocations`);
  console.log(`   TIER1B (never crawled): ${TIER1B_DOMAINS.length} invocations`);
  console.log(`   TIER2 (low listings, 2x): ${TIER2_DOMAINS.length * 2} invocations`);
  console.log(`   TIER3 (high URL count): ${TIER3_DOMAINS.length} invocations`);

  // Get initial URL counts for comparison
  console.log('\n📊 Getting initial URL counts...');
  const initialCounts: Record<string, number> = {};
  const allDomains = [...new Set(invocations.map(i => i.domain))];
  for (const domain of allDomains) {
    initialCounts[domain] = await getUrlCount(domain);
  }
  console.log(`   Got counts for ${allDomains.length} domains`);

  // Fire ALL invocations in batches of 400
  const startTime = Date.now();
  console.log(`\n⚡ Firing ${invocations.length} Lambdas in batches of ${BATCH_SIZE}...`);
  
  let fired = 0;
  for (let i = 0; i < invocations.length; i += BATCH_SIZE) {
    const batch = invocations.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(inv => invokeSpiderAsync(inv.domain)));
    fired += batch.length;
    
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(invocations.length / BATCH_SIZE);
    console.log(`   Fired batch ${batchNum}/${totalBatches} (${fired}/${invocations.length})`);
    
    if (i + BATCH_SIZE < invocations.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }
  
  const fireTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ All ${fired} Lambdas fired in ${fireTime}s`);

  // Monitor progress
  console.log('\n📊 Monitoring progress (Lambdas running in AWS)...');
  console.log('   Each Lambda runs up to 4.5 min, crawling up to 2000 pages.');
  console.log('   Checking every 30s...\n');

  let lastTotalUrls = Object.values(initialCounts).reduce((a, b) => a + b, 0);
  let stableCount = 0;
  const maxWait = 15 * 60 * 1000;  // 15 min max wait
  
  while (Date.now() - startTime < maxWait) {
    await new Promise(r => setTimeout(r, 30000));  // Check every 30s
    
    // Sample a few domains to check progress
    let currentTotal = 0;
    for (const domain of allDomains.slice(0, 5)) {
      currentTotal += await getUrlCount(domain);
    }
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const newUrls = currentTotal - Object.values(initialCounts).slice(0, 5).reduce((a, b) => a + b, 0);
    
    console.log(`   ${elapsed}s: Sampled domains have +${newUrls} new URLs`);
    
    // Check if stable (no new URLs for 2 min)
    if (currentTotal === lastTotalUrls) {
      stableCount++;
      if (stableCount >= 4) {  // 2 min stable
        console.log('   Stable for 2 min - assuming complete');
        break;
      }
    } else {
      stableCount = 0;
    }
    lastTotalUrls = currentTotal;
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n📊 URL counts by domain (before → after):');
  for (const domain of allDomains) {
    const before = initialCounts[domain];
    const after = await getUrlCount(domain);
    const diff = after - before;
    const status = diff > 0 ? '✅' : (diff === 0 ? '⚠️' : '❓');
    console.log(`   ${status} ${domain}: ${before} → ${after} (+${diff})`);
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n⏱️  Total time: ${totalTime} min`);
  console.log('\n✅ DONE! Run these commands to see full results:');
  console.log('   npx tsx scripts/build-domain-stats.ts  # Update stats');
  console.log('   aws dynamodb get-item --table-name leo-domain-stats --key \'{"domain":{"S":"century21.es"}}\'');
}

main().catch(console.error);

