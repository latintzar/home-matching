/**
 * Spider Fire All
 * 
 * Fires Lambda for all domains needing spider crawl.
 * 1 Lambda = 1 domain (fully crawled).
 * 
 * Usage:
 *   npx tsx scripts/spider-fire-all.ts
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const LAMBDA_NAME = 'spider-single';
const BATCH_SIZE = 400;
const DELAY_BETWEEN_BATCHES = 1000;  // 1s between batches

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

// Get domains needing spider (no sitemap OR empty sitemap)
async function getSpiderDomains(): Promise<string[]> {
  const domains: string[] = [];
  let lastKey: any = undefined;
  
  do {
    // Get domains with no sitemap
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-scraping-rules',
      FilterExpression: 'has_sitemap = :f OR needs_spider = :t',
      ExpressionAttributeValues: { 
        ':f': { BOOL: false },
        ':t': { BOOL: true },
      },
      ProjectionExpression: '#d, spider_status',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      // Skip if already spidered
      if (item.spider_status?.S === 'complete') {
        continue;
      }
      if (item.domain?.S) {
        domains.push(item.domain.S);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return domains;
}

// Get spider stats
async function getSpiderStats(): Promise<{ complete: number; pending: number }> {
  let complete = 0;
  let pending = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-scraping-rules',
      FilterExpression: 'has_sitemap = :f OR needs_spider = :t',
      ExpressionAttributeValues: { 
        ':f': { BOOL: false },
        ':t': { BOOL: true },
      },
      ProjectionExpression: 'spider_status',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.spider_status?.S === 'complete') {
        complete++;
      } else {
        pending++;
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return { complete, pending };
}

// Get URL count from spider
async function getSpiderUrlCount(): Promise<number> {
  let count = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#src = :spider',
      ExpressionAttributeNames: { '#src': 'source' },
      ExpressionAttributeValues: { ':spider': { S: 'spider' } },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return count;
}

// Invoke Lambda (async)
async function invokeLambda(domain: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: LAMBDA_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify({ domain }),
  }));
}

async function main() {
  console.log(`\n🕷️ Spider Fire All\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Get initial stats
  const initialStats = await getSpiderStats();
  const initialUrls = await getSpiderUrlCount();
  console.log(`Initial: ${initialStats.complete} complete, ${initialStats.pending} pending`);
  console.log(`Spider URLs so far: ${initialUrls.toLocaleString()}`);
  
  // Get domains to spider
  console.log(`\nFetching domains to spider...`);
  const domains = await getSpiderDomains();
  console.log(`Found ${domains.length.toLocaleString()} domains to spider`);
  
  if (domains.length === 0) {
    console.log(`\n✅ All domains already spidered!\n`);
    return;
  }
  
  const startTime = Date.now();
  
  // Fire ALL in batches
  const batches = Math.ceil(domains.length / BATCH_SIZE);
  console.log(`\n⚡ Firing ${batches} batches of ${BATCH_SIZE}...`);
  
  let fired = 0;
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    await Promise.all(batch.map(d => invokeLambda(d)));
    fired += batch.length;
    
    process.stdout.write(`\r   Fired ${fired.toLocaleString()}/${domains.length.toLocaleString()} (batch ${batchNum}/${batches})`);
    
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }
  
  const fireTime = (Date.now() - startTime) / 1000;
  console.log(`\n   ✅ All ${fired.toLocaleString()} Lambdas fired in ${fireTime.toFixed(0)}s`);
  
  // Monitor until complete
  console.log(`\n📊 Monitoring progress (Lambdas running in AWS)...\n`);
  console.log(`   Each Lambda crawls 1 domain for ~4.5 min max (up to 2000 pages).`);
  console.log(`   With 400 concurrent, ~${Math.ceil(domains.length / 400) * 5} min total.\n`);
  
  let lastComplete = initialStats.complete;
  let stableCount = 0;
  
  while (true) {
    await new Promise(r => setTimeout(r, 30000));  // Check every 30s
    
    const stats = await getSpiderStats();
    const urls = await getSpiderUrlCount();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const newComplete = stats.complete - initialStats.complete;
    const newUrls = urls - initialUrls;
    
    console.log(`   ${elapsed}s: ${stats.complete} domains complete (+${newComplete}), ${newUrls.toLocaleString()} URLs found, ${stats.pending} pending`);
    
    // Check if stable
    if (stats.complete === lastComplete) {
      stableCount++;
      if (stableCount >= 4) {  // 2 min stable
        break;
      }
    } else {
      stableCount = 0;
    }
    lastComplete = stats.complete;
    
    // Check if all done
    if (stats.pending === 0) {
      break;
    }
  }
  
  // Final stats
  const finalStats = await getSpiderStats();
  const finalUrls = await getSpiderUrlCount();
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Domains spidered: ${finalStats.complete - initialStats.complete}`);
  console.log(`   URLs found: ${(finalUrls - initialUrls).toLocaleString()}`);
  console.log(`   Total time: ${(totalTime / 60).toFixed(1)} min`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);

