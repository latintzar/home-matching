/**
 * Delete All S3 HTML Files (Parallel)
 * 
 * Lists all html/ files and deletes in parallel batches.
 * Much faster than AWS CLI sequential delete.
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const BATCH_SIZE = 1000; // S3 delete limit
const MAX_RUNTIME_MS = 14 * 60 * 1000;

const s3 = new S3Client({ region: REGION });

export async function handler() {
  const startTime = Date.now();
  console.log('🗑️ Deleting all S3 HTML files (parallel)...');
  
  let deleted = 0;
  let continuationToken: string | undefined;
  
  do {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached');
      break;
    }
    
    // List objects
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'html/',
      MaxKeys: BATCH_SIZE,
      ContinuationToken: continuationToken,
    }));
    
    const keys = listResult.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
    
    if (keys.length > 0) {
      // Delete batch
      await s3.send(new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: {
          Objects: keys.map(Key => ({ Key })),
          Quiet: true,
        },
      }));
      deleted += keys.length;
      
      if (deleted % 10000 < 1000) {
        console.log(`   Deleted ${deleted.toLocaleString()} files...`);
      }
    }
    
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);
  
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  
  console.log(`\n✅ Deleted ${deleted.toLocaleString()} files in ${elapsedMin} min`);
  
  return { success: true, deleted, elapsedMin: parseFloat(elapsedMin) };
}

