/**
 * Download Fire All - Fast version
 * 
 * Fires ALL Lambda invocations as fast as possible (400 concurrent).
 * Doesn't wait between batches - just fires and monitors.
 * 
 * Usage:
 *   npx tsx scripts/download-fire-all.ts
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const LAMBDA_NAME = 'download-single';
const BATCH_SIZE = 400;  // Fire 400 at a time
const DELAY_BETWEEN_BATCHES = 500;  // 500ms between batches

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

interface UrlRecord {
  url: string;
  domain: string;
}

// Get pending URLs
async function getPendingUrls(): Promise<UrlRecord[]> {
  const urls: UrlRecord[] = [];
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#st = :pending',
      ExpressionAttributeNames: { '#st': 'status', '#u': 'url', '#d': 'domain' },
      ExpressionAttributeValues: { ':pending': { S: 'pending' } },
      ProjectionExpression: '#u, #d',
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

// Get stats
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

// Invoke Lambda (async)
async function invokeLambda(url: string, domain: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: LAMBDA_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify({ url, domain }),
  }));
}

async function main() {
  console.log(`\n🚀 Download Fire All\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const initialStats = await getStats();
  console.log(`Initial: ${initialStats.downloaded.toLocaleString()} downloaded, ${initialStats.pending.toLocaleString()} pending`);
  
  console.log(`\nFetching pending URLs...`);
  const pending = await getPendingUrls();
  console.log(`Found ${pending.length.toLocaleString()} pending URLs`);
  
  if (pending.length === 0) {
    console.log(`\n✅ Nothing to download!\n`);
    return;
  }
  
  const startTime = Date.now();
  
  // Fire ALL in batches of 400, minimal delay between batches
  const batches = Math.ceil(pending.length / BATCH_SIZE);
  console.log(`\n⚡ Firing ${batches} batches of ${BATCH_SIZE}...`);
  
  let fired = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    await Promise.all(batch.map(u => invokeLambda(u.url, u.domain)));
    fired += batch.length;
    
    process.stdout.write(`\r   Fired ${fired.toLocaleString()}/${pending.length.toLocaleString()} (batch ${batchNum}/${batches})`);
    
    // Small delay to avoid overwhelming the invoke API
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }
  
  const fireTime = (Date.now() - startTime) / 1000;
  console.log(`\n   ✅ All ${fired.toLocaleString()} Lambdas fired in ${fireTime.toFixed(0)}s`);
  
  // Monitor until complete
  console.log(`\n📊 Monitoring progress...\n`);
  
  let lastDownloaded = initialStats.downloaded;
  let stableCount = 0;
  
  while (true) {
    await new Promise(r => setTimeout(r, 10000));  // Check every 10s
    
    const stats = await getStats();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const newDownloads = stats.downloaded - initialStats.downloaded;
    const newFailed = stats.failed - initialStats.failed;
    const rate = newDownloads / elapsed;
    
    console.log(`   ${elapsed}s: ${stats.downloaded.toLocaleString()} downloaded (+${newDownloads.toLocaleString()}), ${stats.failed.toLocaleString()} failed (+${newFailed.toLocaleString()}), ${stats.pending.toLocaleString()} pending | ${rate.toFixed(1)}/sec`);
    
    // Check if stable
    if (stats.downloaded === lastDownloaded && stats.pending < 100) {
      stableCount++;
      if (stableCount >= 6) {  // 60 seconds stable
        break;
      }
    } else {
      stableCount = 0;
    }
    lastDownloaded = stats.downloaded;
    
    // Check if all done
    if (stats.pending === 0) {
      break;
    }
  }
  
  // Final stats
  const finalStats = await getStats();
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Downloaded: ${(finalStats.downloaded - initialStats.downloaded).toLocaleString()}`);
  console.log(`   Failed: ${(finalStats.failed - initialStats.failed).toLocaleString()}`);
  console.log(`   Total time: ${totalTime.toFixed(0)}s (${(totalTime/60).toFixed(1)} min)`);
  console.log(`   Throughput: ${((finalStats.downloaded - initialStats.downloaded) / totalTime).toFixed(1)} downloads/sec`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);

