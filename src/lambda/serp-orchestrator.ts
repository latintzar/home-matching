/**
 * serp-orchestrator Lambda
 * 
 * Orchestrates the SERP download and analysis pipeline using AWS Lambda:
 * 1. Get URLs to download from leo-serp-extractions
 * 2. Fire 400 concurrent serp-download-single Lambdas
 * 3. Fire serp-analyze-single Lambdas for neighborhoods with enough pages
 * 
 * Deploy: bash src/lambda/deploy-serp.sh
 * 
 * Can run in Lambda OR locally (npx tsx src/lambda/serp-orchestrator.ts)
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SERP_TABLE = 'leo-serp-extractions';
const PROFILES_TABLE = 'leo-neighborhood-profiles';
const S3_BUCKET = 'puedo-casa-html-archive';
const BATCH_SIZE = 400; // Fire 400 Lambdas at once

const lambda = new LambdaClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({ region: REGION });

interface SerpItem {
  page_id: string;
  neighborhood_id: string;
  url: string;
  query_category: string;
  credibility: number;
  download_status?: string;
}

// Get URLs to download (not yet downloaded, top 5 per category)
async function getUrlsToDownload(cityFilter?: string): Promise<SerpItem[]> {
  const items: SerpItem[] = [];
  let lastKey: Record<string, any> | undefined;
  
  do {
    const filterParts = ['attribute_not_exists(download_status) OR download_status = :failed'];
    const values: Record<string, any> = { ':failed': 'failed' };
    
    if (cityFilter) {
      filterParts.push('begins_with(neighborhood_id, :city)');
      values[':city'] = cityFilter;
    }
    
    const result = await docClient.send(new ScanCommand({
      TableName: SERP_TABLE,
      FilterExpression: filterParts.join(' AND '),
      ExpressionAttributeValues: values,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      items.push(item as SerpItem);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  // Group by neighborhood + category, take top 5 by credibility
  const grouped = new Map<string, SerpItem[]>();
  for (const item of items) {
    const key = `${item.neighborhood_id}:${item.query_category}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  
  const selected: SerpItem[] = [];
  for (const [, groupItems] of grouped) {
    const top = groupItems
      .sort((a, b) => (b.credibility || 0) - (a.credibility || 0))
      .slice(0, 5);
    selected.push(...top);
  }
  
  return selected;
}

// Get neighborhoods with enough downloaded pages but not yet analyzed
async function getNeighborhoodsToAnalyze(cityFilter?: string): Promise<string[]> {
  const neighborhoods = new Map<string, number>();
  
  // Count downloaded pages per neighborhood in S3
  let continuationToken: string | undefined;
  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'serp-html/',
      ContinuationToken: continuationToken,
    }));
    
    for (const obj of result.Contents || []) {
      if (!obj.Key) continue;
      const parts = obj.Key.split('/');
      if (parts.length >= 2) {
        const nid = parts[1];
        if (!cityFilter || nid.startsWith(cityFilter + '-')) {
          neighborhoods.set(nid, (neighborhoods.get(nid) || 0) + 1);
        }
      }
    }
    
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);
  
  // Filter: at least 5 pages
  const candidates = Array.from(neighborhoods.entries())
    .filter(([, count]) => count >= 5)
    .map(([nid]) => nid);
  
  // Exclude already analyzed
  const toAnalyze: string[] = [];
  for (const nid of candidates) {
    try {
      const existing = await docClient.send(new GetCommand({
        TableName: PROFILES_TABLE,
        Key: { neighborhood_id: nid },
      }));
      
      // Skip if already has fulltext analysis
      if (existing.Item?.analysis_type === 'fulltext') continue;
      
      toAnalyze.push(nid);
    } catch {
      toAnalyze.push(nid);
    }
  }
  
  return toAnalyze.sort();
}

// Fire download Lambdas (400 concurrent)
async function fireDownloadLambdas(urls: SerpItem[]): Promise<number> {
  console.log(`\n📥 PHASE 1: Firing ${urls.length.toLocaleString()} download Lambdas (batch: ${BATCH_SIZE})\n`);
  
  let fired = 0;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(item => 
      lambda.send(new InvokeCommand({
        FunctionName: 'serp-download-single',
        InvocationType: 'Event', // Async
        Payload: JSON.stringify({
          url: item.url,
          neighborhoodId: item.neighborhood_id,
          category: item.query_category,
          pageId: item.page_id,
          useScrapingDog: false,
        }),
      }))
    ));
    
    fired += batch.length;
    console.log(`   Fired ${fired.toLocaleString()}/${urls.length.toLocaleString()}`);
    
    // Small delay between batches
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`   ✅ Fired ${fired.toLocaleString()} download Lambdas`);
  return fired;
}

// Fire analyze Lambdas (one per neighborhood)
async function fireAnalyzeLambdas(neighborhoods: string[]): Promise<number> {
  console.log(`\n🔍 PHASE 2: Firing ${neighborhoods.length} analyze Lambdas\n`);
  
  // These can all run in parallel too
  await Promise.all(neighborhoods.map(nid => 
    lambda.send(new InvokeCommand({
      FunctionName: 'serp-analyze-single',
      InvocationType: 'Event', // Async
      Payload: JSON.stringify({ neighborhoodId: nid }),
    }))
  ));
  
  console.log(`   ✅ Fired ${neighborhoods.length} analyze Lambdas`);
  return neighborhoods.length;
}

export async function handler(event?: { city?: string; downloadOnly?: boolean; analyzeOnly?: boolean }) {
  const startTime = Date.now();
  const cityFilter = event?.city;
  const downloadOnly = event?.downloadOnly;
  const analyzeOnly = event?.analyzeOnly;
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SERP ORCHESTRATOR - LAMBDA VERSION                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Fires download Lambdas → Then analyze Lambdas               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (cityFilter) console.log(`🏙️  Filtering by city: ${cityFilter}\n`);
  if (downloadOnly) console.log(`📥 Download only mode\n`);
  if (analyzeOnly) console.log(`🔍 Analyze only mode\n`);
  
  let downloadsFired = 0;
  let analyzesFired = 0;
  
  // Phase 1: Downloads
  if (!analyzeOnly) {
    const urls = await getUrlsToDownload(cityFilter);
    console.log(`📊 Found ${urls.length.toLocaleString()} URLs to download`);
    
    if (urls.length > 0) {
      downloadsFired = await fireDownloadLambdas(urls);
    } else {
      console.log(`   No new URLs to download`);
    }
  }
  
  // Phase 2: Analysis (only if not download-only)
  if (!downloadOnly) {
    // Give downloads a head start
    if (!analyzeOnly && downloadsFired > 0) {
      console.log(`\n⏳ Waiting 60s for downloads to complete...`);
      await new Promise(r => setTimeout(r, 60000));
    }
    
    const neighborhoods = await getNeighborhoodsToAnalyze(cityFilter);
    console.log(`📊 Found ${neighborhoods.length} neighborhoods ready for analysis`);
    
    if (neighborhoods.length > 0) {
      analyzesFired = await fireAnalyzeLambdas(neighborhoods);
    } else {
      console.log(`   No neighborhoods ready for analysis yet`);
    }
  }
  
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  
  const summary = `
════════════════════════════════════════════════════════════════
✅ SERP ORCHESTRATOR COMPLETE!

📊 Fired:
   Download Lambdas: ${downloadsFired.toLocaleString()}
   Analyze Lambdas: ${analyzesFired}

⏱️  Orchestration time: ${elapsedSec}s

⏱️  Expected completion:
   Downloads: ~2 min (400 concurrent, 30s each)
   Analysis: ~5 min (all parallel, 60s each + Gemini)

Monitor with:
   aws logs tail /aws/lambda/serp-download-single --follow
   aws logs tail /aws/lambda/serp-analyze-single --follow
════════════════════════════════════════════════════════════════
`;
  
  console.log(summary);
  
  return {
    success: true,
    downloadsFired,
    analyzesFired,
    elapsedSec: parseFloat(elapsedSec),
  };
}

// Run as script locally
async function main() {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const downloadOnly = args.includes('--download-only');
  const analyzeOnly = args.includes('--analyze-only');
  const local = args.includes('--local');
  
  if (local) {
    // Run handlers directly (for testing)
    console.log('⚠️  Running in LOCAL mode - not firing Lambdas');
    const { handler: downloadHandler } = await import('./serp-download-single');
    const { handler: analyzeHandler } = await import('./serp-analyze-single');
    
    const cityFilter = cityArg?.split('=')[1];
    
    if (!analyzeOnly) {
      const urls = await getUrlsToDownload(cityFilter);
      console.log(`📊 Found ${urls.length} URLs to download`);
      
      for (let i = 0; i < urls.length; i += 10) {
        const batch = urls.slice(i, i + 10);
        await Promise.all(batch.map(item => 
          downloadHandler({
            url: item.url,
            neighborhoodId: item.neighborhood_id,
            category: item.query_category,
            pageId: item.page_id,
            useScrapingDog: false,
          })
        ));
        console.log(`Progress: ${Math.min(i + 10, urls.length)}/${urls.length}`);
      }
    }
    
    if (!downloadOnly) {
      const neighborhoods = await getNeighborhoodsToAnalyze(cityFilter);
      console.log(`📊 Found ${neighborhoods.length} neighborhoods to analyze`);
      
      for (const nid of neighborhoods) {
        await analyzeHandler({ neighborhoodId: nid });
      }
    }
  } else {
    // Fire Lambdas
    await handler({
      city: cityArg?.split('=')[1],
      downloadOnly,
      analyzeOnly,
    });
  }
}

if (require.main === module) {
  main().catch(console.error);
}
