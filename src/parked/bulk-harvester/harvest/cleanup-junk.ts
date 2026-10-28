/**
 * Cleanup Junk Pages
 * 
 * Deletes HTML files from S3 that were classified as junk.
 * Also removes their records from leo-urls.
 * Saves S3 storage costs.
 * 
 * Usage:
 *   npx tsx src/harvest/cleanup-junk.ts --dry-run
 *   npx tsx src/harvest/cleanup-junk.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { HARVEST_CONFIG } from './config';
import { PageType } from './page-classifier';
import { sendPhaseCompleteAlert } from './alerts';

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region: HARVEST_CONFIG.aws.region });

interface CleanupStats {
  s3Deleted: number;
  ddbDeleted: number;
  errors: number;
  bytesFreed: number;
}

/**
 * Junk page types to delete
 */
const JUNK_PAGE_TYPES = [
  PageType.BLOG_POST,
  PageType.NEWS_ARTICLE,
  PageType.LEGAL,
  PageType.ERROR_404,
  PageType.CONTACT,
  PageType.AGENCY_ABOUT,
  PageType.AGENT_PROFILE,
];

/**
 * Cleanup all junk pages
 */
export async function cleanupJunk(options: {
  dryRun?: boolean;
  pageTypes?: string[];
}): Promise<CleanupStats> {
  console.log('🗑️ Cleaning Up Junk Pages\n');
  
  const startTime = Date.now();
  const stats: CleanupStats = {
    s3Deleted: 0,
    ddbDeleted: 0,
    errors: 0,
    bytesFreed: 0,
  };
  
  const pageTypesToDelete = options.pageTypes || JUNK_PAGE_TYPES;
  
  console.log(`Page types to delete: ${pageTypesToDelete.join(', ')}`);
  console.log();
  
  // Scan for URLs with junk page types
  let lastKey: Record<string, any> | undefined;
  const batch: Array<{ url: string; s3Key?: string }> = [];
  
  console.log('Scanning for junk pages...');
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
      FilterExpression: '#action = :skip OR contains(:pageTypes, page_type)',
      ExpressionAttributeNames: { '#action': 'action' },
      ExpressionAttributeValues: { 
        ':skip': 'skip',
        ':pageTypes': pageTypesToDelete,
      },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      batch.push({ url: item.url, s3Key: item.s3Key });
      
      // Process in batches of 100
      if (batch.length >= 100) {
        await processBatch(batch, stats, options.dryRun);
        batch.length = 0;
      }
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  // Process remaining batch
  if (batch.length > 0) {
    await processBatch(batch, stats, options.dryRun);
  }
  
  const duration = Date.now() - startTime;
  
  console.log('\n========================================');
  console.log('JUNK CLEANUP COMPLETE');
  console.log('========================================');
  console.log(`S3 files deleted: ${stats.s3Deleted.toLocaleString()}`);
  console.log(`DynamoDB records deleted: ${stats.ddbDeleted.toLocaleString()}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Storage freed: ~${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)} seconds`);
  
  if (options.dryRun) {
    console.log('\nDRY RUN - no files were deleted');
  }
  
  return stats;
}

/**
 * Process a batch of URLs
 */
async function processBatch(
  batch: Array<{ url: string; s3Key?: string }>,
  stats: CleanupStats,
  dryRun?: boolean
): Promise<void> {
  // Delete from S3
  const s3Keys = batch.filter(b => b.s3Key).map(b => b.s3Key!);
  
  if (s3Keys.length > 0 && !dryRun) {
    try {
      // Delete in batches of 1000 (S3 limit)
      for (let i = 0; i < s3Keys.length; i += 1000) {
        const keyBatch = s3Keys.slice(i, i + 1000);
        
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: HARVEST_CONFIG.aws.s3Bucket,
          Delete: {
            Objects: keyBatch.map(Key => ({ Key })),
            Quiet: true,
          },
        }));
        
        stats.s3Deleted += keyBatch.length;
        // Estimate ~50KB average per compressed HTML
        stats.bytesFreed += keyBatch.length * 50 * 1024;
      }
    } catch (error: any) {
      console.error(`Error deleting from S3: ${error.message}`);
      stats.errors++;
    }
  } else {
    stats.s3Deleted += s3Keys.length;
    stats.bytesFreed += s3Keys.length * 50 * 1024;
  }
  
  // Delete from DynamoDB
  if (!dryRun) {
    // DynamoDB BatchWriteItem limit is 25
    for (let i = 0; i < batch.length; i += 25) {
      const ddbBatch = batch.slice(i, i + 25);
      
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [HARVEST_CONFIG.aws.dynamodb.urlsTable]: ddbBatch.map(item => ({
              DeleteRequest: { Key: { url: item.url } },
            })),
          },
        }));
        
        stats.ddbDeleted += ddbBatch.length;
      } catch (error: any) {
        console.error(`Error deleting from DynamoDB: ${error.message}`);
        stats.errors++;
      }
    }
  } else {
    stats.ddbDeleted += batch.length;
  }
  
  console.log(`  Progress: ${stats.s3Deleted} S3 files, ${stats.ddbDeleted} DDB records`);
}

/**
 * Get junk stats before cleanup
 */
export async function getJunkStats(): Promise<{
  total: number;
  byPageType: Record<string, number>;
  withS3Key: number;
}> {
  console.log('📊 Analyzing Junk Pages...\n');
  
  const stats = {
    total: 0,
    byPageType: {} as Record<string, number>,
    withS3Key: 0,
  };
  
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
      FilterExpression: '#action = :skip',
      ExpressionAttributeNames: { '#action': 'action' },
      ExpressionAttributeValues: { ':skip': 'skip' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      stats.total++;
      stats.byPageType[item.page_type || 'unknown'] = 
        (stats.byPageType[item.page_type || 'unknown'] || 0) + 1;
      if (item.s3Key) stats.withS3Key++;
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return stats;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (args.includes('--stats')) {
    getJunkStats().then(stats => {
      console.log('Junk Page Statistics');
      console.log('====================\n');
      console.log(`Total junk pages: ${stats.total.toLocaleString()}`);
      console.log(`With S3 files: ${stats.withS3Key.toLocaleString()}`);
      console.log(`\nBy Page Type:`);
      for (const [type, count] of Object.entries(stats.byPageType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count.toLocaleString()}`);
      }
      console.log(`\nEstimated storage to free: ~${(stats.withS3Key * 50 / 1024).toFixed(2)} MB`);
    }).catch(console.error);
  } else {
    cleanupJunk({ dryRun }).catch(console.error);
  }
}

