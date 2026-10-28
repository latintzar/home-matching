/**
 * Download Runner
 * 
 * Downloads all pending URLs using Lambda.
 * 1 Lambda = 1 URL download.
 * 
 * Usage:
 *   npx tsx scripts/download-run.ts 100       # Test with 100 URLs
 *   npx tsx scripts/download-run.ts --all     # Download all pending
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const LAMBDA_NAME = 'download-single';
const MAX_CONCURRENT = 400;  // Account limit is 400

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

interface UrlRecord {
  url: string;
  domain: string;
}

// Get pending URLs (status = 'pending')
async function getPendingUrls(): Promise<UrlRecord[]> {
  const urls: UrlRecord[] = [];
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#st = :pending',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':pending': { S: 'pending' } },
      ProjectionExpression: '#u, #d',
      ExpressionAttributeNames: { '#st': 'status', '#u': 'url', '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.url?.S && item.domain?.S) {
        urls.push({ url: item.url.S, domain: item.domain.S });
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return urls;
}

// Get download stats
async function getStats(): Promise<{ pending: number; downloaded: number; failed: number }> {
  let pending = 0, downloaded = 0, failed = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#st',
      ExpressionAttributeNames: { '#st': 'status' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const status = item.status?.S;
      if (status === 'pending') pending++;
      else if (status === 'downloaded') downloaded++;
      else if (status === 'failed') failed++;
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return { pending, downloaded, failed };
}

// Invoke Lambda for a single URL (async/fire-and-forget)
async function invokeLambda(url: string, domain: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: LAMBDA_NAME,
    InvocationType: 'Event',  // Async
    Payload: JSON.stringify({ url, domain }),
  }));
}

// Process a batch of URLs
async function processBatch(urls: UrlRecord[], batchNum: number, totalBatches: number): Promise<void> {
  console.log(`\n📦 Batch ${batchNum}/${totalBatches}: ${urls.length} URLs`);
  
  const startTime = Date.now();
  const startStats = await getStats();
  
  // Invoke all Lambdas in parallel
  console.log(`   Invoking ${urls.length} Lambdas...`);
  await Promise.all(urls.map(u => invokeLambda(u.url, u.domain)));
  console.log(`   ✓ Invoked in ${Date.now() - startTime}ms`);
  
  // Wait for completion (poll every 3s, stable for 12s = done)
  let lastDownloaded = startStats.downloaded;
  let stableChecks = 0;
  
  for (let i = 0; i < 100; i++) {  // Max 5 min wait
    await new Promise(r => setTimeout(r, 3000));
    
    const stats = await getStats();
    const newDownloads = stats.downloaded - startStats.downloaded;
    const newFailed = stats.failed - startStats.failed;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    
    process.stdout.write(`\r   ${elapsed}s: +${newDownloads} downloaded, +${newFailed} failed    `);
    
    if (stats.downloaded === lastDownloaded) {
      stableChecks++;
      if (stableChecks >= 4) {  // 12 seconds stable
        console.log(`\n   ✅ Batch complete`);
        return;
      }
    } else {
      stableChecks = 0;
    }
    lastDownloaded = stats.downloaded;
  }
  
  console.log(`\n   ⚠️ Batch timeout`);
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all');
  const testCount = parseInt(args[0]) || 100;
  
  console.log(`\n🚀 Download Runner\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Get initial stats
  const initialStats = await getStats();
  console.log(`Current status:`);
  console.log(`   Pending: ${initialStats.pending.toLocaleString()}`);
  console.log(`   Downloaded: ${initialStats.downloaded.toLocaleString()}`);
  console.log(`   Failed: ${initialStats.failed.toLocaleString()}`);
  
  // Get pending URLs
  console.log(`\nFetching pending URLs...`);
  const allPending = await getPendingUrls();
  console.log(`Found ${allPending.length.toLocaleString()} pending URLs`);
  
  // Select URLs to process
  const toProcess = runAll ? allPending : allPending.slice(0, testCount);
  console.log(`\nWill process: ${toProcess.length.toLocaleString()} URLs`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (toProcess.length === 0) {
    console.log(`\n✅ Nothing to download!\n`);
    return;
  }
  
  const startTime = Date.now();
  
  // Split into batches
  const batches: UrlRecord[][] = [];
  for (let i = 0; i < toProcess.length; i += MAX_CONCURRENT) {
    batches.push(toProcess.slice(i, i + MAX_CONCURRENT));
  }
  
  console.log(`\nSplit into ${batches.length} batch(es) of max ${MAX_CONCURRENT}`);
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i + 1, batches.length);
  }
  
  // Final stats
  const finalStats = await getStats();
  const totalTime = (Date.now() - startTime) / 1000;
  const newDownloads = finalStats.downloaded - initialStats.downloaded;
  const newFailed = finalStats.failed - initialStats.failed;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   URLs processed: ${toProcess.length.toLocaleString()}`);
  console.log(`   Downloaded: ${newDownloads.toLocaleString()}`);
  console.log(`   Failed: ${newFailed.toLocaleString()}`);
  console.log(`   Total time: ${totalTime.toFixed(0)}s`);
  console.log(`   Throughput: ${(newDownloads / totalTime).toFixed(1)} downloads/sec`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (!runAll && allPending.length > toProcess.length) {
    console.log(`💡 To download remaining ${(allPending.length - toProcess.length).toLocaleString()} URLs:`);
    console.log(`   npx tsx scripts/download-run.ts --all\n`);
  }
}

main().catch(console.error);

