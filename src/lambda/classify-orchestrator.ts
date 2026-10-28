/**
 * Classify Orchestrator Lambda
 * 
 * Runs 100% in AWS - no laptop needed!
 * Scans DynamoDB for downloaded URLs and invokes classify-single Lambdas.
 * 
 * Max runtime: 15 minutes (Lambda limit)
 * Fires up to 400 concurrent classify-single Lambdas
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const REGION = 'us-east-1';
const CLASSIFY_LAMBDA = 'classify-single';
const BATCH_SIZE = 400;
const MAX_RUNTIME_MS = 14 * 60 * 1000; // 14 min (leave 1 min buffer)

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });
const sns = new SNSClient({ region: REGION });

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';

interface UrlRecord {
  url: string;
  domain: string;
  s3Key: string;
}

// Send email notification
async function sendNotification(subject: string, message: string) {
  if (!SNS_TOPIC_ARN) {
    console.log(`[NOTIFY] ${subject}: ${message}`);
    return;
  }
  
  try {
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `[Puedo Casa] ${subject}`,
      Message: message,
    }));
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

// Invoke classify-single Lambda (async, fire-and-forget)
async function invokeClassifier(record: UrlRecord): Promise<boolean> {
  try {
    await lambda.send(new InvokeCommand({
      FunctionName: CLASSIFY_LAMBDA,
      InvocationType: 'Event', // Async - don't wait for response
      Payload: JSON.stringify({
        url: record.url,
        domain: record.domain,
        s3Key: record.s3Key,
      }),
    }));
    return true;
  } catch (e) {
    console.error(`Failed to invoke for ${record.url}:`, e);
    return false;
  }
}

export async function handler(event: any) {
  const startTime = Date.now();
  console.log('🚀 Classify Orchestrator Started');
  console.log(`   Max runtime: ${MAX_RUNTIME_MS / 60000} min`);
  
  let totalScanned = 0;
  let totalFired = 0;
  let totalSkipped = 0;
  let lastKey: any = undefined;
  let batch: UrlRecord[] = [];
  
  try {
    // Scan DynamoDB and fire Lambdas in batches
    do {
      // Check time limit
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏱️ Time limit reached, stopping scan');
        break;
      }
      
      const result = await dynamodb.send(new ScanCommand({
        TableName: 'leo-urls',
        FilterExpression: 'attribute_exists(s3_key) AND attribute_not_exists(classification_status)',
        ExpressionAttributeNames: { '#d': 'domain', '#u': 'url' },
        ProjectionExpression: '#u, #d, s3_key',
        ExclusiveStartKey: lastKey,
      }));
      
      for (const item of result.Items || []) {
        totalScanned++;
        
        const urlStr = item.url?.S;
        const s3Key = item.s3_key?.S;
        
        if (urlStr && s3Key) {
          // Extract domain from URL if not present
          let domain = item.domain?.S;
          if (!domain) {
            try {
              domain = new URL(urlStr).hostname.replace(/^www\./, '');
            } catch {
              totalSkipped++;
              continue;
            }
          }
          
          batch.push({
            url: urlStr,
            domain,
            s3Key,
          });
          
          // Fire batch when full
          if (batch.length >= BATCH_SIZE) {
            console.log(`   Firing batch of ${batch.length} (total fired: ${totalFired})`);
            await Promise.all(batch.map(r => invokeClassifier(r)));
            totalFired += batch.length;
            batch = [];
            
            // Small delay to avoid throttling
            await new Promise(r => setTimeout(r, 200));
          }
        } else {
          totalSkipped++;
        }
      }
      
      lastKey = result.LastEvaluatedKey;
      
      // Progress log every 50k records
      if (totalScanned % 50000 < 1000) {
        console.log(`   Scanned ${totalScanned.toLocaleString()}, fired ${totalFired.toLocaleString()}`);
      }
      
    } while (lastKey);
    
    // Fire remaining batch
    if (batch.length > 0) {
      console.log(`   Firing final batch of ${batch.length}`);
      await Promise.all(batch.map(r => invokeClassifier(r)));
      totalFired += batch.length;
    }
    
    const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
    
    const summary = `
Classification Orchestrator Complete!

📊 Results:
   Scanned: ${totalScanned.toLocaleString()} URLs
   Fired: ${totalFired.toLocaleString()} Lambdas
   Skipped: ${totalSkipped.toLocaleString()} (missing data)
   
⏱️ Time: ${elapsedMin} min

Each classify-single Lambda will process 1 URL.
With 400 concurrent, expect ~${Math.ceil(totalFired / 400 / 12)} min to complete.

Check progress:
aws dynamodb scan --table-name leo-urls --filter-expression "attribute_exists(classification_status)" --select COUNT
`;
    
    console.log(summary);
    await sendNotification('Classification Started', summary);
    
    return {
      success: true,
      scanned: totalScanned,
      fired: totalFired,
      skipped: totalSkipped,
      elapsedMin: parseFloat(elapsedMin),
    };
    
  } catch (error: any) {
    console.error('Orchestrator error:', error);
    await sendNotification('Classification FAILED', `Error: ${error.message}`);
    throw error;
  }
}

