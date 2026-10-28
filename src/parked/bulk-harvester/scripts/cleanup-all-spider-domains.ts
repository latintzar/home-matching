/**
 * Cleanup All Spider Domains
 * 
 * Gets spider domains and fires cleanup-domain Lambda for each.
 * 400 concurrent = done in minutes.
 */

import { LambdaClient, InvokeCommand, CreateFunctionCommand, UpdateFunctionCodeCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import * as esbuild from 'esbuild';
import * as path from 'path';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const ROLE_ARN = (process.env.AWS_EXECUTION_ROLE_ARN || '');
const BATCH_SIZE = 400;

const lambda = new LambdaClient({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

async function deployCleanupLambda() {
  console.log('📦 Deploying cleanup-domain Lambda...');
  
  const srcPath = path.join(__dirname, '../src/lambda/cleanup-domain.ts');
  const outPath = '/tmp/cleanup-domain.js';
  
  await esbuild.build({
    entryPoints: [srcPath],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: outPath,
    minify: true,
  });
  
  const zip = new AdmZip();
  zip.addLocalFile(outPath, '', 'index.js');
  const zipBuffer = zip.toBuffer();
  
  let exists = false;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: 'cleanup-domain' }));
    exists = true;
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }
  
  if (exists) {
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: 'cleanup-domain',
      ZipFile: zipBuffer,
    }));
  } else {
    await lambda.send(new CreateFunctionCommand({
      FunctionName: 'cleanup-domain',
      Runtime: 'nodejs18.x',
      Role: ROLE_ARN,
      Handler: 'index.handler',
      Code: { ZipFile: zipBuffer },
      Timeout: 300, // 5 min per domain
      MemorySize: 256,
    }));
  }
  
  console.log('   ✅ cleanup-domain deployed');
}

async function getSpiderDomains(): Promise<string[]> {
  const domains: string[] = [];
  let lastKey: any = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: 'leo-scraping-rules',
      FilterExpression: 'needs_spider = :true OR attribute_exists(spider_status)',
      ExpressionAttributeValues: { ':true': { BOOL: true } },
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain?.S) domains.push(item.domain.S);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return domains;
}

async function main() {
  console.log('\n🧹 Cleanup All Spider Domains\n');
  
  // Deploy
  await deployCleanupLambda();
  
  // Get domains
  console.log('\n📋 Getting spider domains...');
  const domains = await getSpiderDomains();
  console.log(`   Found ${domains.length} spider domains`);
  
  // Fire all in batches
  console.log(`\n⚡ Firing ${domains.length} cleanup Lambdas (${BATCH_SIZE} concurrent)...`);
  
  let fired = 0;
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(domain => 
      lambda.send(new InvokeCommand({
        FunctionName: 'cleanup-domain',
        InvocationType: 'Event',
        Payload: JSON.stringify({ domain }),
      }))
    ));
    
    fired += batch.length;
    console.log(`   Fired ${fired}/${domains.length}`);
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n✅ All ${fired} cleanup Lambdas fired!`);
  console.log(`   Each Lambda cleans S3 + DynamoDB for 1 domain.`);
  console.log(`   With 400 concurrent, expect ~5-10 min total.`);
  console.log(`\nAfter cleanup completes, run:`);
  console.log(`   npx tsx scripts/spider-fire-all.ts`);
}

main().catch(console.error);

