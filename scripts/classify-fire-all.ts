/**
 * Classify Fire All
 * 
 * Fires Lambda to classify all downloaded HTMLs.
 * 1 Lambda = 1 HTML file classification.
 * 
 * Usage:
 *   npx tsx scripts/classify-fire-all.ts
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const LAMBDA_NAME = 'classify-single';
const BATCH_SIZE = 400;
const DELAY_BETWEEN_BATCHES = 500;

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

interface UrlRecord {
  url: string;
  domain: string;
  s3Key?: string;
}

// Get URLs that need classification (downloaded but not classified)
async function getUrlsToClassify(): Promise<UrlRecord[]> {
  const urls: UrlRecord[] = [];
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#st = :downloaded AND attribute_not_exists(classification)',
      ExpressionAttributeNames: { '#st': 'status', '#u': 'url', '#d': 'domain' },
      ExpressionAttributeValues: { ':downloaded': { S: 'downloaded' } },
      ProjectionExpression: '#u, #d, s3_key',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.url?.S && item.domain?.S && item.s3_key?.S) {
        urls.push({
          url: item.url.S,
          domain: item.domain.S,
          s3Key: item.s3_key.S,
        });
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return urls;
}

// Get classification stats
async function getClassificationStats(): Promise<{ classified: number; unclassified: number }> {
  let classified = 0;
  let unclassified = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#st = :downloaded',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':downloaded': { S: 'downloaded' } },
      ProjectionExpression: 'classification',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.classification?.S) {
        classified++;
      } else {
        unclassified++;
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return { classified, unclassified };
}

// Invoke Lambda (async)
async function invokeLambda(url: UrlRecord): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: LAMBDA_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify({
      url: url.url,
      domain: url.domain,
      s3Key: url.s3Key,
    }),
  }));
}

async function main() {
  console.log(`\n🔍 Classify Fire All\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Get initial stats
  const initialStats = await getClassificationStats();
  console.log(`Initial: ${initialStats.classified} classified, ${initialStats.unclassified} unclassified`);
  
  // Get URLs to classify
  console.log(`\nFetching URLs to classify...`);
  const urls = await getUrlsToClassify();
  console.log(`Found ${urls.length.toLocaleString()} URLs to classify`);
  
  if (urls.length === 0) {
    console.log(`\n✅ All URLs already classified!\n`);
    return;
  }
  
  const startTime = Date.now();
  
  // Fire ALL in batches
  const batches = Math.ceil(urls.length / BATCH_SIZE);
  console.log(`\n⚡ Firing ${batches} batches of ${BATCH_SIZE}...`);
  
  let fired = 0;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    await Promise.all(batch.map(u => invokeLambda(u)));
    fired += batch.length;
    
    process.stdout.write(`\r   Fired ${fired.toLocaleString()}/${urls.length.toLocaleString()} (batch ${batchNum}/${batches})`);
    
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }
  
  const fireTime = (Date.now() - startTime) / 1000;
  console.log(`\n   ✅ All ${fired.toLocaleString()} Lambdas fired in ${fireTime.toFixed(0)}s`);
  
  // Monitor until complete
  console.log(`\n📊 Monitoring progress (Lambdas running in AWS)...\n`);
  console.log(`   Each Lambda classifies 1 HTML in ~2-5 seconds.`);
  console.log(`   With 400 concurrent, ~${Math.ceil(urls.length / 400) * 5} min total.\n`);
  
  let lastClassified = initialStats.classified;
  let stableCount = 0;
  
  while (true) {
    await new Promise(r => setTimeout(r, 20000));  // Check every 20s
    
    const stats = await getClassificationStats();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const newClassified = stats.classified - initialStats.classified;
    
    console.log(`   ${elapsed}s: ${stats.classified.toLocaleString()} classified (+${newClassified.toLocaleString()}), ${stats.unclassified.toLocaleString()} remaining`);
    
    // Check if stable
    if (stats.classified === lastClassified) {
      stableCount++;
      if (stableCount >= 6) {  // 2 min stable
        break;
      }
    } else {
      stableCount = 0;
    }
    lastClassified = stats.classified;
    
    // Check if all done
    if (stats.unclassified === 0) {
      break;
    }
  }
  
  // Final stats
  const finalStats = await getClassificationStats();
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Classified: ${(finalStats.classified - initialStats.classified).toLocaleString()}`);
  console.log(`   Remaining: ${finalStats.unclassified.toLocaleString()}`);
  console.log(`   Total time: ${(totalTime / 60).toFixed(1)} min`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);

