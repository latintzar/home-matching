/**
 * Clear all items from leo-listings DynamoDB table
 * Run with: npx tsx src/scripts/clear-leo-listings.ts
 */

import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const TABLE_NAME = "leo-listings";

async function clearTable() {
  let totalDeleted = 0;
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  
  console.log("🗑️  Clearing leo-listings table...");
  console.log("   This will delete ALL items. Press Ctrl+C within 5 seconds to cancel...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  do {
    // Scan for items (get keys only)
    const scanResult = await client.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: "#d, listing_id",
      ExpressionAttributeNames: { "#d": "domain" },
      Limit: 25,
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    
    lastEvaluatedKey = scanResult.LastEvaluatedKey;
    
    if (!scanResult.Items || scanResult.Items.length === 0) break;
    
    // Batch delete
    const deleteRequests = scanResult.Items.map(item => ({
      DeleteRequest: {
        Key: {
          domain: item.domain,
          listing_id: item.listing_id,
        }
      }
    }));
    
    await client.send(new BatchWriteItemCommand({
      RequestItems: {
        [TABLE_NAME]: deleteRequests
      }
    }));
    
    totalDeleted += deleteRequests.length;
    process.stdout.write(`\r   Deleted ${totalDeleted} items...`);
    
  } while (lastEvaluatedKey);
  
  console.log(`\n✅ Deleted ${totalDeleted} total items from leo-listings`);
}

clearTable().catch(console.error);
