/**
 * Deploy cleanup Lambda and run it
 */

import * as path from 'path';
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, GetFunctionCommand, InvokeCommand } from '@aws-sdk/client-lambda';
import * as esbuild from 'esbuild';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const ROLE_ARN = (process.env.AWS_EXECUTION_ROLE_ARN || '');

const lambda = new LambdaClient({ region: REGION });

async function deployLambda(name: string, srcFile: string, timeout: number, memory: number) {
  console.log(`📦 Deploying ${name}...`);
  
  const srcPath = path.join(__dirname, `../src/lambda/${srcFile}`);
  const outPath = `/tmp/${name}.js`;
  
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
    await lambda.send(new GetFunctionCommand({ FunctionName: name }));
    exists = true;
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }
  
  if (exists) {
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: name,
      ZipFile: zipBuffer,
    }));
    await new Promise(r => setTimeout(r, 3000));
    await lambda.send(new UpdateFunctionConfigurationCommand({
      FunctionName: name,
      Timeout: timeout,
      MemorySize: memory,
      Handler: 'index.handler',
    }));
  } else {
    await lambda.send(new CreateFunctionCommand({
      FunctionName: name,
      Runtime: 'nodejs18.x',
      Role: ROLE_ARN,
      Handler: 'index.handler',
      Code: { ZipFile: zipBuffer },
      Timeout: timeout,
      MemorySize: memory,
    }));
  }
  
  console.log(`   ✅ ${name} deployed`);
}

async function main() {
  console.log('🚀 Deploy and Run Cleanup\n');
  
  // Deploy cleanup Lambda
  await deployLambda('cleanup-broken-spider', 'cleanup-broken-spider.ts', 900, 512);
  
  // Deploy fixed spider
  await deployLambda('spider-single', 'spider-single.ts', 300, 256);
  
  // Trigger cleanup
  console.log('\n🧹 Triggering cleanup (runs in AWS)...');
  await lambda.send(new InvokeCommand({
    FunctionName: 'cleanup-broken-spider',
    InvocationType: 'Event',
  }));
  
  console.log('✅ Cleanup triggered! It will:');
  console.log('   1. Delete ~296K broken spider URLs');
  console.log('   2. Reset ~1,953 domains for re-crawl');
  console.log('\nAfter cleanup completes (~15 min), run:');
  console.log('   npx tsx scripts/spider-fire-all.ts');
}

main().catch(console.error);

