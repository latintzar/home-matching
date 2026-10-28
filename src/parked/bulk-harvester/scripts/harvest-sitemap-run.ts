/**
 * Sitemap Harvest Runner
 * 
 * Simple, clean, systematic:
 * - Gets list of sitemapped domains
 * - Invokes 1 Lambda per domain (async)
 * - Monitors progress
 * - Reports results
 * 
 * Usage:
 *   npx tsx scripts/harvest-sitemap-run.ts 50        # Test with 50 domains
 *   npx tsx scripts/harvest-sitemap-run.ts --all     # Run all remaining
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const LAMBDA_NAME = 'sitemap-single';
const MAX_CONCURRENT = 350;  // Stay under 400 account limit

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

// Get all sitemapped domains
async function getSitemappedDomains(): Promise<string[]> {
  const domains: string[] = [];
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-scraping-rules',
      FilterExpression: 'has_sitemap = :t',
      ExpressionAttributeValues: { ':t': { BOOL: true } },
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain?.S) {
        domains.push(item.domain.S);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return domains;
}

// Get domains already processed (have URLs in leo-urls)
async function getProcessedDomains(): Promise<Set<string>> {
  const processed = new Set<string>();
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain?.S) {
        processed.add(item.domain.S);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return processed;
}

// Get URL count
async function getUrlCount(): Promise<number> {
  let count = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return count;
}

// Invoke Lambda for a single domain (async/fire-and-forget)
async function invokeLambda(domain: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: LAMBDA_NAME,
    InvocationType: 'Event',  // Async
    Payload: JSON.stringify({ domain }),
  }));
}

// Process a batch of domains
async function processBatch(domains: string[], batchNum: number, totalBatches: number): Promise<void> {
  console.log(`\n📦 Batch ${batchNum}/${totalBatches}: ${domains.length} domains`);
  
  const startCount = await getUrlCount();
  const startTime = Date.now();
  
  // Invoke all Lambdas in parallel
  console.log(`   Invoking ${domains.length} Lambdas...`);
  await Promise.all(domains.map(d => invokeLambda(d)));
  console.log(`   ✓ Invoked in ${Date.now() - startTime}ms`);
  
  // Wait for completion (poll every 5s, stable for 15s = done)
  let lastCount = startCount;
  let stableChecks = 0;
  
  for (let i = 0; i < 60; i++) {  // Max 5 min wait
    await new Promise(r => setTimeout(r, 5000));
    
    const currentCount = await getUrlCount();
    const newUrls = currentCount - startCount;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    
    process.stdout.write(`\r   ${elapsed}s: ${currentCount.toLocaleString()} URLs (+${newUrls.toLocaleString()})    `);
    
    if (currentCount === lastCount) {
      stableChecks++;
      if (stableChecks >= 3) {
        console.log(`\n   ✅ Batch complete: +${newUrls.toLocaleString()} URLs`);
        return;
      }
    } else {
      stableChecks = 0;
    }
    lastCount = currentCount;
  }
  
  console.log(`\n   ⚠️ Batch timeout`);
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all');
  const testCount = parseInt(args[0]) || 50;
  
  console.log(`\n🚀 Sitemap Harvest Runner\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Get domains
  const allDomains = await getSitemappedDomains();
  console.log(`Total sitemapped domains: ${allDomains.length}`);
  
  // Get already processed
  const processed = await getProcessedDomains();
  console.log(`Already processed: ${processed.size}`);
  
  // Filter to unprocessed
  const remaining = allDomains.filter(d => !processed.has(d));
  console.log(`Remaining: ${remaining.length}`);
  
  // Select domains to process
  const toProcess = runAll ? remaining : remaining.slice(0, testCount);
  console.log(`\nWill process: ${toProcess.length} domains`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (toProcess.length === 0) {
    console.log(`\n✅ Nothing to do!\n`);
    return;
  }
  
  const initialCount = await getUrlCount();
  console.log(`\nInitial URL count: ${initialCount.toLocaleString()}`);
  
  const startTime = Date.now();
  
  // Split into batches of MAX_CONCURRENT
  const batches: string[][] = [];
  for (let i = 0; i < toProcess.length; i += MAX_CONCURRENT) {
    batches.push(toProcess.slice(i, i + MAX_CONCURRENT));
  }
  
  console.log(`Split into ${batches.length} batch(es) of max ${MAX_CONCURRENT}`);
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i + 1, batches.length);
  }
  
  // Final stats
  const finalCount = await getUrlCount();
  const totalTime = (Date.now() - startTime) / 1000;
  const newUrls = finalCount - initialCount;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Domains processed: ${toProcess.length}`);
  console.log(`   URLs collected: ${newUrls.toLocaleString()}`);
  console.log(`   Total time: ${totalTime.toFixed(0)}s`);
  console.log(`   Avg URLs/domain: ${Math.round(newUrls / toProcess.length)}`);
  console.log(`   Throughput: ${(newUrls / totalTime).toFixed(1)} URLs/sec`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (!runAll && remaining.length > toProcess.length) {
    console.log(`💡 To process remaining ${remaining.length - toProcess.length} domains:`);
    console.log(`   npx tsx scripts/harvest-sitemap-run.ts --all\n`);
  }
}

main().catch(console.error);

