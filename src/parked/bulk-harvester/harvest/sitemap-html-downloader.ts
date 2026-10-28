/**
 * Sitemap HTML Downloader
 * 
 * Downloads HTML for URLs from sitemapped domains.
 * Designed to run as Lambda with high concurrency (400).
 * 
 * Usage:
 *   npx tsx src/harvest/sitemap-html-downloader.ts --domain example.es
 *   npx tsx src/harvest/sitemap-html-downloader.ts --all --dry-run
 *   npx tsx src/harvest/sitemap-html-downloader.ts --all
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  QueryCommand, 
  UpdateCommand,
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as zlib from 'zlib';
import { HARVEST_CONFIG, shouldSkipUrl } from './config';
import { urlToS3Key, canonicalizeUrl } from './url-canonicalizer';
import { sendPhaseCompleteAlert, sendErrorAlert } from './alerts';

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region: HARVEST_CONFIG.aws.region });
const lambdaClient = new LambdaClient({ region: HARVEST_CONFIG.aws.region });

export interface DownloadResult {
  domain: string;
  urlsProcessed: number;
  urlsDownloaded: number;
  urlsSkipped: number;
  urlsFailed: number;
  durationMs: number;
}

/**
 * Download all pending URLs for a single domain
 */
export async function downloadDomainUrls(
  domain: string,
  options: { dryRun?: boolean; limit?: number } = {}
): Promise<DownloadResult> {
  const startTime = Date.now();
  
  const result: DownloadResult = {
    domain,
    urlsProcessed: 0,
    urlsDownloaded: 0,
    urlsSkipped: 0,
    urlsFailed: 0,
    durationMs: 0,
  };
  
  console.log(`📥 Downloading URLs for: ${domain}`);
  
  try {
    // Query URLs for this domain that haven't been downloaded yet
    let lastEvaluatedKey: Record<string, any> | undefined;
    let urlsToProcess: Array<{ url: string; domain: string }> = [];
    
    do {
      const queryResult = await docClient.send(new QueryCommand({
        TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
        IndexName: 'domain-index', // Assumes GSI on domain
        KeyConditionExpression: '#d = :domain',
        FilterExpression: 'attribute_not_exists(s3Key) OR s3Key = :empty',
        ExpressionAttributeNames: { '#d': 'domain' },
        ExpressionAttributeValues: { ':domain': domain, ':empty': '' },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: options.limit || 1000,
      }));
      
      urlsToProcess.push(...(queryResult.Items || []) as Array<{ url: string; domain: string }>);
      lastEvaluatedKey = queryResult.LastEvaluatedKey;
      
      // Stop if we've hit the limit
      if (options.limit && urlsToProcess.length >= options.limit) {
        urlsToProcess = urlsToProcess.slice(0, options.limit);
        break;
      }
    } while (lastEvaluatedKey);
    
    console.log(`  Found ${urlsToProcess.length} URLs to download`);
    
    // Process in batches
    const batchSize = HARVEST_CONFIG.limits.concurrentRequests;
    
    for (let i = 0; i < urlsToProcess.length; i += batchSize) {
      const batch = urlsToProcess.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(item => downloadUrl(item.url, options.dryRun))
      );
      
      for (const r of batchResults) {
        result.urlsProcessed++;
        if (r.status === 'downloaded') result.urlsDownloaded++;
        else if (r.status === 'skipped') result.urlsSkipped++;
        else result.urlsFailed++;
      }
      
      // Progress log
      if (result.urlsProcessed % 100 === 0) {
        console.log(`  Progress: ${result.urlsProcessed}/${urlsToProcess.length} (${result.urlsDownloaded} downloaded)`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, HARVEST_CONFIG.limits.delayBetweenBatchesMs));
    }
    
    result.durationMs = Date.now() - startTime;
    console.log(`  ✅ Complete: ${result.urlsDownloaded} downloaded, ${result.urlsSkipped} skipped, ${result.urlsFailed} failed`);
    
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    result.durationMs = Date.now() - startTime;
  }
  
  return result;
}

/**
 * Download a single URL
 */
async function downloadUrl(
  url: string,
  dryRun?: boolean
): Promise<{ url: string; status: 'downloaded' | 'skipped' | 'failed'; error?: string }> {
  // Skip blocklisted URLs
  if (shouldSkipUrl(url)) {
    return { url, status: 'skipped' };
  }
  
  if (dryRun) {
    return { url, status: 'downloaded' };
  }
  
  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': HARVEST_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(HARVEST_CONFIG.limits.requestTimeoutMs),
      redirect: 'follow',
    });
    
    if (!response.ok) {
      // Update DynamoDB with error
      await updateUrlStatus(url, 'failed', undefined, `HTTP ${response.status}`);
      return { url, status: 'failed', error: `HTTP ${response.status}` };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { url, status: 'skipped' };
    }
    
    const html = await response.text();
    
    // Save to S3
    const s3Key = urlToS3Key(url);
    await saveToS3(s3Key, html);
    
    // Update DynamoDB
    await updateUrlStatus(url, 'downloaded', s3Key);
    
    return { url, status: 'downloaded' };
    
  } catch (error: any) {
    await updateUrlStatus(url, 'failed', undefined, error.message);
    return { url, status: 'failed', error: error.message };
  }
}

/**
 * Save HTML to S3 (gzip compressed)
 */
async function saveToS3(key: string, html: string): Promise<void> {
  const compressed = zlib.gzipSync(Buffer.from(html, 'utf-8'));
  
  await s3Client.send(new PutObjectCommand({
    Bucket: HARVEST_CONFIG.aws.s3Bucket,
    Key: key,
    Body: compressed,
    ContentType: 'text/html',
    ContentEncoding: 'gzip',
    Metadata: {
      'original-size': html.length.toString(),
      'compressed-size': compressed.length.toString(),
      'downloaded-at': new Date().toISOString(),
    },
  }));
}

/**
 * Update URL status in DynamoDB
 */
async function updateUrlStatus(
  url: string,
  status: 'downloaded' | 'failed',
  s3Key?: string,
  error?: string
): Promise<void> {
  const updateExpr: string[] = ['#status = :status', 'downloadedAt = :now'];
  const exprValues: Record<string, any> = {
    ':status': status,
    ':now': new Date().toISOString(),
  };
  
  if (s3Key) {
    updateExpr.push('s3Key = :s3Key');
    exprValues[':s3Key'] = s3Key;
  }
  
  if (error) {
    updateExpr.push('#error = :error');
    exprValues[':error'] = error;
  }
  
  await docClient.send(new UpdateCommand({
    TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
    Key: { url },
    UpdateExpression: `SET ${updateExpr.join(', ')}`,
    ExpressionAttributeNames: { 
      '#status': 'status',
      ...(error ? { '#error': 'error' } : {}),
    },
    ExpressionAttributeValues: exprValues,
  }));
}

/**
 * Get all sitemapped domains
 */
async function getSitemappedDomains(): Promise<string[]> {
  const domains = new Set<string>();
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
      FilterExpression: '#source = :sitemap',
      ExpressionAttributeNames: { '#source': 'source', '#d': 'domain' },
      ExpressionAttributeValues: { ':sitemap': 'sitemap' },
      ProjectionExpression: '#d',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain) domains.add(item.domain);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return Array.from(domains);
}

/**
 * Orchestrate downloading for all sitemapped domains (runs locally or triggers Lambdas)
 */
export async function orchestrateSitemapDownload(options: {
  dryRun?: boolean;
  useLambda?: boolean;
  concurrency?: number;
}): Promise<void> {
  console.log('🚀 Starting Sitemap HTML Download Orchestration\n');
  
  const startTime = Date.now();
  const domains = await getSitemappedDomains();
  
  console.log(`Found ${domains.length} sitemapped domains\n`);
  
  if (options.dryRun) {
    console.log('DRY RUN - no actual downloads will be performed\n');
  }
  
  const results: DownloadResult[] = [];
  const concurrency = options.concurrency || 10;
  
  if (options.useLambda) {
    // Invoke Lambdas for each domain
    console.log(`Invoking Lambdas with concurrency: ${concurrency}`);
    
    for (let i = 0; i < domains.length; i += concurrency) {
      const batch = domains.slice(i, i + concurrency);
      
      await Promise.all(batch.map(async domain => {
        try {
          await lambdaClient.send(new InvokeCommand({
            FunctionName: 'harvest-sitemap-download',
            InvocationType: 'Event', // Async
            Payload: Buffer.from(JSON.stringify({ domain })),
          }));
          console.log(`  ✅ Invoked Lambda for ${domain}`);
        } catch (error: any) {
          console.error(`  ❌ Failed to invoke Lambda for ${domain}: ${error.message}`);
        }
      }));
    }
    
    console.log('\nLambdas invoked. Check CloudWatch for progress.');
    
  } else {
    // Run locally
    for (let i = 0; i < domains.length; i += concurrency) {
      const batch = domains.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map(domain => downloadDomainUrls(domain, { dryRun: options.dryRun }))
      );
      
      results.push(...batchResults);
      
      // Progress
      console.log(`\n📊 Progress: ${results.length}/${domains.length} domains\n`);
    }
    
    // Summary
    const totalDownloaded = results.reduce((sum, r) => sum + r.urlsDownloaded, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.urlsSkipped, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.urlsFailed, 0);
    const duration = Date.now() - startTime;
    
    console.log('\n========================================');
    console.log('SITEMAP DOWNLOAD COMPLETE');
    console.log('========================================');
    console.log(`Domains processed: ${results.length}`);
    console.log(`URLs downloaded: ${totalDownloaded.toLocaleString()}`);
    console.log(`URLs skipped: ${totalSkipped.toLocaleString()}`);
    console.log(`URLs failed: ${totalFailed.toLocaleString()}`);
    console.log(`Duration: ${(duration / 60000).toFixed(1)} minutes`);
    
    // Send alert
    if (!options.dryRun) {
      await sendPhaseCompleteAlert({
        phase: 'Phase 2A: Sitemap Download',
        domainsProcessed: results.length,
        pagesDownloaded: totalDownloaded,
        listingsFound: 0, // Will be determined after classification
        truncatedDomains: 0,
        errors: totalFailed,
        durationMinutes: duration / 60000,
        estimatedCost: totalDownloaded * 0.000005, // Rough S3 cost
      });
    }
  }
}

/**
 * Lambda handler for downloading a single domain
 */
export async function handler(event: { domain: string; dryRun?: boolean }): Promise<DownloadResult> {
  return downloadDomainUrls(event.domain, { dryRun: event.dryRun });
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const useLambda = args.includes('--lambda');
  
  const domainArg = args.find(a => a.startsWith('--domain='));
  const domain = domainArg?.split('=')[1];
  
  if (args.includes('--all')) {
    orchestrateSitemapDownload({ dryRun, useLambda }).catch(console.error);
  } else if (domain) {
    downloadDomainUrls(domain, { dryRun }).catch(console.error);
  } else {
    console.log('Sitemap HTML Downloader');
    console.log('=======================\n');
    console.log('Usage:');
    console.log('  npx tsx src/harvest/sitemap-html-downloader.ts --domain=example.es');
    console.log('  npx tsx src/harvest/sitemap-html-downloader.ts --all');
    console.log('  npx tsx src/harvest/sitemap-html-downloader.ts --all --dry-run');
    console.log('  npx tsx src/harvest/sitemap-html-downloader.ts --all --lambda');
  }
}

