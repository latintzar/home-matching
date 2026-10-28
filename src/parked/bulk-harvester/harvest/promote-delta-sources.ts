/**
 * Promote Delta Sources
 * 
 * Copies classified LIST pages to leo-delta-sources table.
 * These pages will be re-fetched daily to discover new listings.
 * 
 * Usage:
 *   npx tsx src/harvest/promote-delta-sources.ts --dry-run
 *   npx tsx src/harvest/promote-delta-sources.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand,
  PutCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { HARVEST_CONFIG } from './config';
import { PageType } from './page-classifier';
import { sendPhaseCompleteAlert } from './alerts';

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const DELTA_SOURCES_TABLE = 'leo-delta-sources';

interface DeltaSource {
  url: string;
  domain: string;
  page_type: string;
  transaction: string;
  check_frequency: 'daily' | 'twice_daily' | 'weekly';
  last_checked?: string;
  last_listings_count?: number;
  created_at: string;
}

/**
 * Determine check frequency based on page type
 */
function getCheckFrequency(pageType: string): 'daily' | 'twice_daily' | 'weekly' {
  // Search pages and active list pages - check more frequently
  if (pageType === PageType.SEARCH_PAGE || pageType === PageType.LIST_RENT) {
    return 'twice_daily';
  }
  // Sale listings change less frequently
  if (pageType === PageType.LIST_SALE) {
    return 'daily';
  }
  // Everything else
  return 'weekly';
}

/**
 * Promote all list pages to delta sources
 */
export async function promoteDeltaSources(options: {
  dryRun?: boolean;
}): Promise<{ promoted: number; errors: number }> {
  console.log('📋 Promoting List Pages to Delta Sources\n');
  
  const startTime = Date.now();
  let promoted = 0;
  let errors = 0;
  
  // Scan for all URLs classified as list pages or search pages
  const listPageTypes = [
    PageType.LIST_SALE,
    PageType.LIST_RENT,
    PageType.LIST_MIXED,
    PageType.LIST_LOCATION,
    PageType.SEARCH_PAGE,
  ];
  
  let lastKey: Record<string, any> | undefined;
  const batch: DeltaSource[] = [];
  
  console.log('Scanning for list pages...');
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
      FilterExpression: '#action = :delta_source',
      ExpressionAttributeNames: { '#action': 'action' },
      ExpressionAttributeValues: { ':delta_source': 'delta_source' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const deltaSource: DeltaSource = {
        url: item.url,
        domain: item.domain,
        page_type: item.page_type,
        transaction: item.transaction || 'unknown',
        check_frequency: getCheckFrequency(item.page_type),
        created_at: new Date().toISOString(),
      };
      
      batch.push(deltaSource);
      
      // Write in batches of 25
      if (batch.length >= 25) {
        if (!options.dryRun) {
          try {
            await writeBatch(batch);
            promoted += batch.length;
          } catch (error: any) {
            console.error(`Error writing batch: ${error.message}`);
            errors += batch.length;
          }
        } else {
          promoted += batch.length;
        }
        batch.length = 0;
        
        if (promoted % 100 === 0) {
          console.log(`  Progress: ${promoted} promoted`);
        }
      }
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  // Write remaining batch
  if (batch.length > 0) {
    if (!options.dryRun) {
      try {
        await writeBatch(batch);
        promoted += batch.length;
      } catch (error: any) {
        console.error(`Error writing final batch: ${error.message}`);
        errors += batch.length;
      }
    } else {
      promoted += batch.length;
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log('\n========================================');
  console.log('DELTA SOURCES PROMOTION COMPLETE');
  console.log('========================================');
  console.log(`Promoted: ${promoted.toLocaleString()}`);
  console.log(`Errors: ${errors}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)} seconds`);
  
  if (options.dryRun) {
    console.log('\nDRY RUN - no records were written');
  }
  
  return { promoted, errors };
}

/**
 * Write batch to DynamoDB
 */
async function writeBatch(items: DeltaSource[]): Promise<void> {
  const writeRequests = items.map(item => ({
    PutRequest: { Item: item },
  }));
  
  await docClient.send(new BatchWriteCommand({
    RequestItems: {
      [DELTA_SOURCES_TABLE]: writeRequests,
    },
  }));
}

/**
 * Get delta source stats
 */
export async function getDeltaSourceStats(): Promise<{
  total: number;
  byFrequency: Record<string, number>;
  byTransaction: Record<string, number>;
}> {
  const stats = {
    total: 0,
    byFrequency: {} as Record<string, number>,
    byTransaction: {} as Record<string, number>,
  };
  
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: DELTA_SOURCES_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      stats.total++;
      stats.byFrequency[item.check_frequency] = 
        (stats.byFrequency[item.check_frequency] || 0) + 1;
      stats.byTransaction[item.transaction] = 
        (stats.byTransaction[item.transaction] || 0) + 1;
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
    getDeltaSourceStats().then(stats => {
      console.log('Delta Source Statistics');
      console.log('=======================\n');
      console.log(`Total: ${stats.total.toLocaleString()}`);
      console.log('\nBy Check Frequency:');
      for (const [freq, count] of Object.entries(stats.byFrequency)) {
        console.log(`  ${freq}: ${count.toLocaleString()}`);
      }
      console.log('\nBy Transaction:');
      for (const [tx, count] of Object.entries(stats.byTransaction)) {
        console.log(`  ${tx}: ${count.toLocaleString()}`);
      }
    }).catch(console.error);
  } else {
    promoteDeltaSources({ dryRun }).catch(console.error);
  }
}

