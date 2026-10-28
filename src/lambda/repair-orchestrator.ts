/**
 * Repair Orchestrator Lambda
 * 
 * Lists S3 objects and fires repair-single Lambdas in batches of 400.
 * Runs 100% in AWS - no laptop needed.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const REPAIR_LAMBDA = 'repair-single';
const BATCH_SIZE = 400;
const MAX_RUNTIME_MS = 14 * 60 * 1000;

const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

// Fire repair-single Lambda (async)
async function invokeRepair(s3Key: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: REPAIR_LAMBDA,
    InvocationType: 'Event',
    Payload: JSON.stringify({ s3Key }),
  }));
}

export async function handler(event?: { startAfter?: string }) {
  const startTime = Date.now();
  const startAfter = event?.startAfter;
  
  console.log('🔧 Repair Orchestrator Started');
  if (startAfter) console.log(`   Continuing from: ${startAfter}`);
  
  let scanned = 0;
  let fired = 0;
  let continuationToken: string | undefined;
  let lastKey = '';
  
  do {
    // Check timeout
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached');
      break;
    }
    
    // List S3 objects
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'html/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
      StartAfter: startAfter || undefined,
    }));
    
    const keys = listResult.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
    scanned += keys.length;
    
    // Fire in batches of 400
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(key => invokeRepair(key)));
      fired += batch.length;
      
      // Small delay between batches
      await new Promise(r => setTimeout(r, 100));
    }
    
    lastKey = keys[keys.length - 1] || lastKey;
    
    // Progress log every 10k
    if (scanned % 10000 < 1000) {
      console.log(`   Scanned ${scanned.toLocaleString()}, fired ${fired.toLocaleString()} Lambdas`);
    }
    
    continuationToken = listResult.NextContinuationToken;
    
  } while (continuationToken);
  
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  
  console.log(`\n✅ Orchestrator complete:`);
  console.log(`   S3 files scanned: ${scanned.toLocaleString()}`);
  console.log(`   Repair Lambdas fired: ${fired.toLocaleString()}`);
  console.log(`   Time: ${elapsedMin} min`);
  console.log(`   Last key: ${lastKey}`);
  
  return {
    success: true,
    scanned,
    fired,
    elapsedMin: parseFloat(elapsedMin),
    lastKey,
    hasMore: !!continuationToken,
  };
}

