/**
 * Classify Downloaded HTMLs
 * 
 * Runs heuristic classification on all downloaded HTML files.
 * Updates leo-urls with: page_type, transaction, asset_class, action.
 * 
 * Usage:
 *   npx tsx src/harvest/classify-downloaded.ts --domain example.es
 *   npx tsx src/harvest/classify-downloaded.ts --all --dry-run
 *   npx tsx src/harvest/classify-downloaded.ts --all
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand,
  UpdateCommand,
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { HARVEST_CONFIG } from './config';
import { 
  classifyPage, 
  PageType, 
  TransactionType, 
  AssetClass,
  ClassificationResult 
} from './page-classifier';
import { sendPhaseCompleteAlert } from './alerts';

const gunzip = promisify(zlib.gunzip);

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region: HARVEST_CONFIG.aws.region });

interface ClassificationStats {
  totalProcessed: number;
  listings: number;
  listPages: number;
  junk: number;
  unknown: number;
  errors: number;
  byAssetClass: Record<string, number>;
  byTransaction: Record<string, number>;
}

/**
 * Get HTML from S3
 */
async function getHtmlFromS3(s3Key: string): Promise<string | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: HARVEST_CONFIG.aws.s3Bucket,
      Key: s3Key,
    }));
    
    const bodyBytes = await response.Body?.transformToByteArray();
    if (!bodyBytes) return null;
    
    // Decompress if gzipped
    if (s3Key.endsWith('.gz')) {
      const decompressed = await gunzip(Buffer.from(bodyBytes));
      return decompressed.toString('utf-8');
    }
    
    return Buffer.from(bodyBytes).toString('utf-8');
  } catch (error: any) {
    console.error(`Error fetching S3 key ${s3Key}: ${error.message}`);
    return null;
  }
}

/**
 * Update URL record with classification
 */
async function updateUrlClassification(
  url: string,
  classification: ClassificationResult
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
    Key: { url },
    UpdateExpression: `SET 
      page_type = :pageType,
      transaction = :transaction,
      asset_class = :assetClass,
      classification_confidence = :confidence,
      classification_signals = :signals,
      #action = :action,
      classifiedAt = :now`,
    ExpressionAttributeNames: {
      '#action': 'action',
    },
    ExpressionAttributeValues: {
      ':pageType': classification.pageType,
      ':transaction': classification.transaction,
      ':assetClass': classification.assetClass,
      ':confidence': classification.confidence,
      ':signals': classification.signals,
      ':action': classification.action,
      ':now': new Date().toISOString(),
    },
  }));
}

/**
 * Classify all downloaded URLs for a single domain
 */
export async function classifyDomain(
  domain: string,
  options: { dryRun?: boolean; limit?: number } = {}
): Promise<ClassificationStats> {
  console.log(`🏷️ Classifying URLs for: ${domain}`);
  
  const stats: ClassificationStats = {
    totalProcessed: 0,
    listings: 0,
    listPages: 0,
    junk: 0,
    unknown: 0,
    errors: 0,
    byAssetClass: {},
    byTransaction: {},
  };
  
  // Query downloaded URLs for this domain
  let lastKey: Record<string, any> | undefined;
  let urlsToProcess: Array<{ url: string; s3Key: string }> = [];
  
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
      IndexName: 'domain-index',
      KeyConditionExpression: '#d = :domain',
      FilterExpression: 'attribute_exists(s3Key) AND attribute_not_exists(page_type)',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':domain': domain },
      ExclusiveStartKey: lastKey,
      Limit: options.limit || 1000,
    }));
    
    for (const item of result.Items || []) {
      if (item.s3Key) {
        urlsToProcess.push({ url: item.url, s3Key: item.s3Key });
      }
    }
    
    lastKey = result.LastEvaluatedKey;
    
    if (options.limit && urlsToProcess.length >= options.limit) {
      urlsToProcess = urlsToProcess.slice(0, options.limit);
      break;
    }
  } while (lastKey);
  
  console.log(`  Found ${urlsToProcess.length} URLs to classify`);
  
  // Process URLs
  for (const { url, s3Key } of urlsToProcess) {
    try {
      const html = await getHtmlFromS3(s3Key);
      
      if (!html) {
        stats.errors++;
        continue;
      }
      
      const classification = classifyPage(url, html);
      
      // Update stats
      stats.totalProcessed++;
      
      if (classification.pageType.startsWith('listing_')) {
        stats.listings++;
      } else if (classification.pageType.startsWith('list_')) {
        stats.listPages++;
      } else if (classification.action === 'skip') {
        stats.junk++;
      } else {
        stats.unknown++;
      }
      
      stats.byAssetClass[classification.assetClass] = 
        (stats.byAssetClass[classification.assetClass] || 0) + 1;
      stats.byTransaction[classification.transaction] = 
        (stats.byTransaction[classification.transaction] || 0) + 1;
      
      // Save classification
      if (!options.dryRun) {
        await updateUrlClassification(url, classification);
      }
      
      // Progress
      if (stats.totalProcessed % 100 === 0) {
        console.log(`  Progress: ${stats.totalProcessed}/${urlsToProcess.length}`);
      }
      
    } catch (error: any) {
      console.error(`  Error classifying ${url}: ${error.message}`);
      stats.errors++;
    }
  }
  
  console.log(`  ✅ Complete: ${stats.listings} listings, ${stats.listPages} list pages, ${stats.junk} junk`);
  
  return stats;
}

/**
 * Classify all downloaded URLs across all domains
 */
export async function classifyAll(options: {
  dryRun?: boolean;
  concurrency?: number;
}): Promise<void> {
  console.log('🏷️ Starting Classification of All Downloaded HTMLs\n');
  
  const startTime = Date.now();
  
  // Get all unique domains with downloaded URLs
  const domains = new Set<string>();
  let lastKey: Record<string, any> | undefined;
  
  console.log('Scanning for domains with downloaded URLs...');
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
      FilterExpression: 'attribute_exists(s3Key) AND attribute_not_exists(page_type)',
      ExpressionAttributeNames: { '#d': 'domain' },
      ProjectionExpression: '#d',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain) domains.add(item.domain);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  const domainList = Array.from(domains);
  console.log(`Found ${domainList.length} domains to classify\n`);
  
  if (options.dryRun) {
    console.log('DRY RUN - no classifications will be saved\n');
  }
  
  // Process domains
  const allStats: ClassificationStats = {
    totalProcessed: 0,
    listings: 0,
    listPages: 0,
    junk: 0,
    unknown: 0,
    errors: 0,
    byAssetClass: {},
    byTransaction: {},
  };
  
  const concurrency = options.concurrency || 5;
  
  for (let i = 0; i < domainList.length; i += concurrency) {
    const batch = domainList.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(domain => classifyDomain(domain, { dryRun: options.dryRun }))
    );
    
    // Aggregate stats
    for (const stats of batchResults) {
      allStats.totalProcessed += stats.totalProcessed;
      allStats.listings += stats.listings;
      allStats.listPages += stats.listPages;
      allStats.junk += stats.junk;
      allStats.unknown += stats.unknown;
      allStats.errors += stats.errors;
      
      for (const [key, val] of Object.entries(stats.byAssetClass)) {
        allStats.byAssetClass[key] = (allStats.byAssetClass[key] || 0) + val;
      }
      for (const [key, val] of Object.entries(stats.byTransaction)) {
        allStats.byTransaction[key] = (allStats.byTransaction[key] || 0) + val;
      }
    }
    
    console.log(`\n📊 Progress: ${Math.min(i + concurrency, domainList.length)}/${domainList.length} domains\n`);
  }
  
  const duration = Date.now() - startTime;
  
  // Print summary
  console.log('\n========================================');
  console.log('CLASSIFICATION COMPLETE');
  console.log('========================================');
  console.log(`Total URLs classified: ${allStats.totalProcessed.toLocaleString()}`);
  console.log(`  📋 Listings: ${allStats.listings.toLocaleString()}`);
  console.log(`  📄 List pages: ${allStats.listPages.toLocaleString()}`);
  console.log(`  🗑️ Junk: ${allStats.junk.toLocaleString()}`);
  console.log(`  ❓ Unknown: ${allStats.unknown.toLocaleString()}`);
  console.log(`  ❌ Errors: ${allStats.errors.toLocaleString()}`);
  console.log(`\nDuration: ${(duration / 60000).toFixed(1)} minutes`);
  
  console.log('\nBy Transaction Type:');
  for (const [type, count] of Object.entries(allStats.byTransaction).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count.toLocaleString()}`);
  }
  
  console.log('\nBy Asset Class (top 10):');
  const sortedAssets = Object.entries(allStats.byAssetClass).sort((a, b) => b[1] - a[1]);
  for (const [assetClass, count] of sortedAssets.slice(0, 10)) {
    console.log(`  ${assetClass}: ${count.toLocaleString()}`);
  }
  
  // Send alert
  if (!options.dryRun) {
    await sendPhaseCompleteAlert({
      phase: 'Phase 3: Classification',
      domainsProcessed: domainList.length,
      pagesDownloaded: allStats.totalProcessed,
      listingsFound: allStats.listings,
      truncatedDomains: 0,
      errors: allStats.errors,
      durationMinutes: duration / 60000,
      estimatedCost: 0, // Classification is free
    });
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  const domainArg = args.find(a => a.startsWith('--domain='));
  const domain = domainArg?.split('=')[1];
  
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : undefined;
  
  if (args.includes('--all')) {
    classifyAll({ dryRun, concurrency }).catch(console.error);
  } else if (domain) {
    classifyDomain(domain, { dryRun }).then(stats => {
      console.log('\nStats:');
      console.log(JSON.stringify(stats, null, 2));
    }).catch(console.error);
  } else {
    console.log('Classify Downloaded HTMLs');
    console.log('=========================\n');
    console.log('Usage:');
    console.log('  npx tsx src/harvest/classify-downloaded.ts --domain=example.es');
    console.log('  npx tsx src/harvest/classify-downloaded.ts --all');
    console.log('  npx tsx src/harvest/classify-downloaded.ts --all --dry-run');
    console.log('  npx tsx src/harvest/classify-downloaded.ts --all --concurrency=10');
  }
}

