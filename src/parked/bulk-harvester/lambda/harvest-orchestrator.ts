/**
 * Harvest Orchestrator
 * 
 * Phase 1: Download all sitemap URLs (171K)
 * Phase 2: Spider all domains (1953)
 * 
 * Runs in AWS Lambda - no laptop needed.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const REGION = 'us-east-1';
const BATCH_SIZE = 400;
const MAX_RUNTIME_MS = 14 * 60 * 1000;

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });
const sns = new SNSClient({ region: REGION });

async function notify(message: string) {
  console.log(message);
}

// Phase 1: Download sitemap URLs
async function downloadSitemapUrls(): Promise<number> {
  console.log('\n📥 PHASE 1: Downloading sitemap URLs...');
  
  let urls: Array<{url: string, domain: string}> = [];
  let lastKey: any = undefined;
  
  // Get all sitemap URLs that need download
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-urls',
      FilterExpression: '#src = :sitemap',
      ExpressionAttributeNames: { '#src': 'source', '#u': 'url', '#d': 'domain' },
      ExpressionAttributeValues: { ':sitemap': { S: 'sitemap' } },
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
  
  console.log(`   Found ${urls.length.toLocaleString()} sitemap URLs`);
  
  // Fire download Lambdas
  let fired = 0;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(item => 
      lambda.send(new InvokeCommand({
        FunctionName: 'download-single',
        InvocationType: 'Event',
        Payload: JSON.stringify({ url: item.url, domain: item.domain }),
      }))
    ));
    
    fired += batch.length;
    if (fired % 10000 < BATCH_SIZE) {
      console.log(`   Fired ${fired.toLocaleString()}/${urls.length.toLocaleString()}`);
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`   ✅ Fired ${fired.toLocaleString()} download Lambdas`);
  return fired;
}

// Phase 2: Spider all domains
async function spiderDomains(): Promise<number> {
  console.log('\n🕷️ PHASE 2: Spidering all domains...');
  
  let domains: string[] = [];
  let lastKey: any = undefined;
  
  // Get all spider domains
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-scraping-rules',
      FilterExpression: 'needs_spider = :true',
      ExpressionAttributeValues: { ':true': { BOOL: true } },
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain?.S) domains.push(item.domain.S);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`   Found ${domains.length.toLocaleString()} domains to spider`);
  
  // Fire spider Lambdas
  let fired = 0;
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(domain => 
      lambda.send(new InvokeCommand({
        FunctionName: 'spider-single',
        InvocationType: 'Event',
        Payload: JSON.stringify({ domain }),
      }))
    ));
    
    fired += batch.length;
    console.log(`   Fired ${fired.toLocaleString()}/${domains.length.toLocaleString()}`);
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`   ✅ Fired ${fired.toLocaleString()} spider Lambdas`);
  return fired;
}

export async function handler(event?: { phase?: string }) {
  const startTime = Date.now();
  const phase = event?.phase || 'all';
  
  console.log('🚀 Harvest Orchestrator Started');
  console.log(`   Phase: ${phase}`);
  
  let downloadsFired = 0;
  let spidersFired = 0;
  
  if (phase === 'all' || phase === 'download') {
    downloadsFired = await downloadSitemapUrls();
  }
  
  if (phase === 'all' || phase === 'spider') {
    spidersFired = await spiderDomains();
  }
  
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  
  const summary = `
✅ Harvest Orchestrator Complete!

📊 Results:
   Downloads fired: ${downloadsFired.toLocaleString()}
   Spiders fired: ${spidersFired.toLocaleString()}
   Time: ${elapsedMin} min

⏱️ Expected completion:
   Downloads: ~10 min (400 concurrent)
   Spiders: ~25 min (400 concurrent, 5 min each)

Monitor with:
   aws logs tail /aws/lambda/download-single --follow
   aws logs tail /aws/lambda/spider-single --follow
`;
  
  console.log(summary);
  await notify(summary);
  
  return {
    success: true,
    downloadsFired,
    spidersFired,
    elapsedMin: parseFloat(elapsedMin),
  };
}

