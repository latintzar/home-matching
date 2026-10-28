/**
 * Deploy classify-orchestrator Lambda
 * 
 * This Lambda orchestrates classification - runs 100% in AWS, no laptop needed.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import * as esbuild from 'esbuild';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const FUNCTION_NAME = 'classify-orchestrator';
const ROLE_ARN = (process.env.AWS_EXECUTION_ROLE_ARN || '');
const TIMEOUT = 900; // 15 minutes (max)
const MEMORY = 512; // More memory for faster scanning

const lambda = new LambdaClient({ region: REGION });

async function deploy() {
  console.log(`\n🚀 Deploying ${FUNCTION_NAME}\n`);
  
  // Build
  const srcPath = path.join(__dirname, '../src/lambda/classify-orchestrator.ts');
  const outPath = '/tmp/classify-orchestrator.js';
  
  console.log('📦 Building...');
  await esbuild.build({
    entryPoints: [srcPath],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: outPath,
    minify: true,
  });
  
  // Zip
  console.log('📦 Zipping...');
  const zip = new AdmZip();
  zip.addLocalFile(outPath, '', 'index.js');
  const zipBuffer = zip.toBuffer();
  
  // Check if function exists
  let exists = false;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    exists = true;
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }
  
  if (exists) {
    // Update code
    console.log('📤 Updating code...');
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBuffer,
    }));
    
    // Wait for update
    await new Promise(r => setTimeout(r, 3000));
    
    // Update config
    console.log('⚙️ Updating config...');
    await lambda.send(new UpdateFunctionConfigurationCommand({
      FunctionName: FUNCTION_NAME,
      Timeout: TIMEOUT,
      MemorySize: MEMORY,
      Handler: 'index.handler',
    }));
  } else {
    // Create
    console.log('📤 Creating function...');
    await lambda.send(new CreateFunctionCommand({
      FunctionName: FUNCTION_NAME,
      Runtime: 'nodejs18.x',
      Role: ROLE_ARN,
      Handler: 'index.handler',
      Code: { ZipFile: zipBuffer },
      Timeout: TIMEOUT,
      MemorySize: MEMORY,
    }));
  }
  
  console.log(`\n✅ ${FUNCTION_NAME} deployed!`);
  console.log(`   Timeout: ${TIMEOUT}s (15 min)`);
  console.log(`   Memory: ${MEMORY}MB`);
  console.log(`\nTo trigger:\n   aws lambda invoke --function-name ${FUNCTION_NAME} --invocation-type Event /dev/null\n`);
}

deploy().catch(console.error);

