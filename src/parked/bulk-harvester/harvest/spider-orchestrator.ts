/**
 * Spider Orchestrator
 * 
 * Orchestrates spider crawling across all non-sitemapped domains.
 * Can run locally or invoke Lambdas with high concurrency (400).
 * 
 * Usage:
 *   npx tsx src/harvest/spider-orchestrator.ts --domain example.es
 *   npx tsx src/harvest/spider-orchestrator.ts --all --dry-run
 *   npx tsx src/harvest/spider-orchestrator.ts --all --lambda
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand,
  GetCommand,
  PutCommand 
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { spiderDomain, spiderDomainsBatch, SpiderResult } from './spider-crawler';
import { HARVEST_CONFIG } from './config';
import { sendPhaseCompleteAlert, sendErrorAlert } from './alerts';

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({ region: HARVEST_CONFIG.aws.region });

// Table to track spider domains (separate from sitemap domains)
const SPIDER_DOMAINS_TABLE = 'leo-spider-domains';

interface SpiderDomainRecord {
  domain: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  pagesFound?: number;
  urlsDownloaded?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * Get list of non-sitemapped domains (from leo-scraping-rules or a dedicated table)
 */
async function getNonSitemappedDomains(): Promise<string[]> {
  // First, try to read from a dedicated spider domains file/table
  // For now, we'll scan the scraping rules table for domains without sitemaps
  
  const domains: string[] = [];
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-scraping-rules',
      FilterExpression: 'attribute_not_exists(sitemap_url) OR sitemap_url = :empty',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':empty': '' },
      ProjectionExpression: '#d',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain) domains.push(item.domain);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return domains;
}

/**
 * Get pending spider domains (not yet crawled or failed)
 */
async function getPendingSpiderDomains(): Promise<string[]> {
  const allDomains = await getNonSitemappedDomains();
  const pendingDomains: string[] = [];
  
  for (const domain of allDomains) {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: HARVEST_CONFIG.aws.dynamodb.crawlStatusTable,
        Key: { domain },
      }));
      
      const status = result.Item?.status;
      
      // Include if never crawled or failed
      if (!status || status === 'pending' || status === 'failed') {
        pendingDomains.push(domain);
      }
    } catch {
      // Table might not exist yet, include the domain
      pendingDomains.push(domain);
    }
  }
  
  return pendingDomains;
}

/**
 * Mark domain as in progress
 */
async function markDomainInProgress(domain: string): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: HARVEST_CONFIG.aws.dynamodb.crawlStatusTable,
    Item: {
      domain,
      type: 'spider',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    },
  }));
}

/**
 * Orchestrate spider crawl across all non-sitemapped domains
 */
export async function orchestrateSpiderCrawl(options: {
  dryRun?: boolean;
  useLambda?: boolean;
  concurrency?: number;
  limit?: number;
}): Promise<void> {
  console.log('🕷️ Starting Spider Crawl Orchestration\n');
  
  const startTime = Date.now();
  let domains = await getPendingSpiderDomains();
  
  if (options.limit) {
    domains = domains.slice(0, options.limit);
  }
  
  console.log(`Found ${domains.length} non-sitemapped domains to crawl\n`);
  
  if (domains.length === 0) {
    console.log('No domains to crawl!');
    return;
  }
  
  if (options.dryRun) {
    console.log('DRY RUN - no actual crawling will be performed\n');
    console.log('Domains that would be crawled:');
    domains.slice(0, 20).forEach(d => console.log(`  - ${d}`));
    if (domains.length > 20) console.log(`  ... and ${domains.length - 20} more`);
    return;
  }
  
  const concurrency = options.concurrency || HARVEST_CONFIG.limits.lambdaConcurrency;
  
  if (options.useLambda) {
    // Invoke Lambdas for each domain
    console.log(`Invoking Lambdas with concurrency: ${Math.min(concurrency, domains.length)}`);
    
    let invoked = 0;
    let failed = 0;
    
    for (let i = 0; i < domains.length; i += concurrency) {
      const batch = domains.slice(i, i + concurrency);
      
      const results = await Promise.allSettled(batch.map(async domain => {
        await markDomainInProgress(domain);
        
        await lambdaClient.send(new InvokeCommand({
          FunctionName: 'harvest-spider-domain',
          InvocationType: 'Event', // Async
          Payload: Buffer.from(JSON.stringify({ domain })),
        }));
        
        return domain;
      }));
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          invoked++;
        } else {
          failed++;
          console.error(`  ❌ Failed to invoke: ${result.reason}`);
        }
      }
      
      console.log(`Progress: ${invoked}/${domains.length} Lambdas invoked`);
    }
    
    console.log('\n========================================');
    console.log('LAMBDA INVOCATIONS COMPLETE');
    console.log('========================================');
    console.log(`Invoked: ${invoked}`);
    console.log(`Failed to invoke: ${failed}`);
    console.log('\nCheck CloudWatch for crawl progress.');
    
  } else {
    // Run locally with batch processing
    console.log(`Running locally with concurrency: ${Math.min(concurrency, 10)}`);
    
    const results = await spiderDomainsBatch(domains, {
      concurrency: Math.min(concurrency, 10), // Limit local concurrency
    });
    
    // Summary
    const complete = results.filter(r => r.status === 'complete').length;
    const truncated = results.filter(r => r.status === 'truncated').length;
    const errors = results.filter(r => r.status === 'error').length;
    const totalPages = results.reduce((sum, r) => sum + r.pagesVisited, 0);
    const totalSaved = results.reduce((sum, r) => sum + r.pagesSaved, 0);
    const duration = Date.now() - startTime;
    
    console.log('\n========================================');
    console.log('SPIDER CRAWL COMPLETE');
    console.log('========================================');
    console.log(`Domains: ${results.length}`);
    console.log(`  ✅ Complete: ${complete}`);
    console.log(`  ⚠️ Truncated: ${truncated}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`Pages visited: ${totalPages.toLocaleString()}`);
    console.log(`Pages saved: ${totalSaved.toLocaleString()}`);
    console.log(`Duration: ${(duration / 60000).toFixed(1)} minutes`);
    
    // Send alert
    await sendPhaseCompleteAlert({
      phase: 'Phase 2B: Spider Crawl',
      domainsProcessed: results.length,
      pagesDownloaded: totalSaved,
      listingsFound: 0, // Will be determined after classification
      truncatedDomains: truncated,
      errors: errors,
      durationMinutes: duration / 60000,
      estimatedCost: totalSaved * 0.000005, // Rough S3 cost
    });
    
    // List errors
    if (errors > 0) {
      console.log('\nDomains with errors:');
      results
        .filter(r => r.status === 'error')
        .slice(0, 10)
        .forEach(r => console.log(`  - ${r.domain}: ${r.error}`));
    }
  }
}

/**
 * Lambda handler for spidering a single domain
 */
export async function handler(event: { domain: string; maxPages?: number }): Promise<SpiderResult> {
  return spiderDomain(event.domain, { maxPages: event.maxPages });
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const useLambda = args.includes('--lambda');
  
  const domainArg = args.find(a => a.startsWith('--domain='));
  const domain = domainArg?.split('=')[1];
  
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : undefined;
  
  if (args.includes('--all')) {
    orchestrateSpiderCrawl({ dryRun, useLambda, concurrency, limit }).catch(console.error);
  } else if (domain) {
    spiderDomain(domain, { dryRun }).then(result => {
      console.log('\nResult:');
      console.log(JSON.stringify(result, null, 2));
    }).catch(console.error);
  } else {
    console.log('Spider Orchestrator');
    console.log('===================\n');
    console.log('Usage:');
    console.log('  npx tsx src/harvest/spider-orchestrator.ts --domain=example.es');
    console.log('  npx tsx src/harvest/spider-orchestrator.ts --all');
    console.log('  npx tsx src/harvest/spider-orchestrator.ts --all --dry-run');
    console.log('  npx tsx src/harvest/spider-orchestrator.ts --all --lambda');
    console.log('  npx tsx src/harvest/spider-orchestrator.ts --all --limit=10');
    console.log('  npx tsx src/harvest/spider-orchestrator.ts --all --concurrency=50');
  }
}

