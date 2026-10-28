/**
 * Cleanup Single Domain Lambda
 * 
 * Deletes ALL S3 files and DynamoDB entries for ONE domain.
 * Designed for 400 concurrent execution.
 * 
 * Input: { domain: "example.com" }
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand, BatchWriteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const RULES_TABLE = 'leo-scraping-rules';

const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

interface Event {
  domain: string;
}

export async function handler(event: Event) {
  const { domain } = event;
  let s3Deleted = 0;
  let dbDeleted = 0;
  
  // 1. Delete all S3 files for this domain
  let continuationToken: string | undefined;
  do {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: `html/${domain}/`,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }));
    
    const keys = listResult.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
    
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true },
      }));
      s3Deleted += keys.length;
    }
    
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);
  
  // 2. Delete all DynamoDB entries for this domain (spider source only)
  let lastKey: any = undefined;
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      FilterExpression: '#d = :domain AND #src = :spider',
      ExpressionAttributeNames: { '#d': 'domain', '#src': 'source', '#u': 'url' },
      ExpressionAttributeValues: { 
        ':domain': { S: domain },
        ':spider': { S: 'spider' }
      },
      ProjectionExpression: '#u',
      ExclusiveStartKey: lastKey,
      Limit: 1000,
    }));
    
    // Batch delete
    const urls = result.Items?.map(i => i.url?.S).filter(Boolean) || [];
    
    for (let i = 0; i < urls.length; i += 25) {
      const batch = urls.slice(i, i + 25);
      await dynamodb.send(new BatchWriteItemCommand({
        RequestItems: {
          [URLS_TABLE]: batch.map(url => ({
            DeleteRequest: { Key: { url: { S: url! } } }
          }))
        }
      }));
      dbDeleted += batch.length;
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  // 3. Reset domain status
  await dynamodb.send(new UpdateItemCommand({
    TableName: RULES_TABLE,
    Key: { domain: { S: domain } },
    UpdateExpression: 'SET needs_spider = :true REMOVE spider_status, spider_stats, spider_completed_at',
    ExpressionAttributeValues: { ':true': { BOOL: true } },
  }));
  
  return { success: true, domain, s3Deleted, dbDeleted };
}

