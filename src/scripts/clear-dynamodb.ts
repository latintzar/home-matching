/**
 * Fast DynamoDB table clear using BatchWriteItem
 * Deletes up to 25 items per API call with parallelism
 */

import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { config } from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = 'leo-listings';
const BATCH_SIZE = 25; // DynamoDB limit
const PARALLEL_BATCHES = 10; // Run 10 batch deletes in parallel

async function clearTable() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEARING DynamoDB TABLE: leo-listings');
  console.log('═══════════════════════════════════════════════════════════════');
  
  let totalDeleted = 0;
  let lastKey: Record<string, any> | undefined;
  const startTime = Date.now();
  
  while (true) {
    // Scan for items to delete
    const scanResponse = await client.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: '#d, listing_id',
      ExpressionAttributeNames: { '#d': 'domain' },
      Limit: BATCH_SIZE * PARALLEL_BATCHES,
      ExclusiveStartKey: lastKey,
    }));
    
    const items = scanResponse.Items || [];
    if (items.length === 0) break;
    
    // Split into batches of 25
    const batches: typeof items[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }
    
    // Delete batches in parallel
    await Promise.all(batches.map(async (batch) => {
      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: {
            domain: item.domain,
            listing_id: item.listing_id,
          }
        }
      }));
      
      try {
        await client.send(new BatchWriteItemCommand({
          RequestItems: {
            [TABLE_NAME]: deleteRequests
          }
        }));
      } catch (err) {
        console.error('Batch delete error:', err);
      }
    }));
    
    totalDeleted += items.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (totalDeleted / parseFloat(elapsed)).toFixed(0);
    console.log(`  Deleted: ${totalDeleted.toLocaleString()} (${rate}/sec)`);
    
    lastKey = scanResponse.LastEvaluatedKey;
    if (!lastKey) break;
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ COMPLETE: Deleted ${totalDeleted.toLocaleString()} items in ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════════');
}

clearTable().catch(console.error);
