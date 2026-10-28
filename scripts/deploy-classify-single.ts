/**
 * Deploy classify-single Lambda
 * 
 * Classifies a single HTML file from S3.
 * Optimized: reads only first 200KB of HTML.
 */

import * as path from 'path';
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import * as esbuild from 'esbuild';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const FUNCTION_NAME = 'classify-single';
const ROLE_ARN = (process.env.AWS_EXECUTION_ROLE_ARN || '');
const TIMEOUT = 60; // 60 seconds (was 30)
const MEMORY = 256; // 256MB (was 512, now reading less data)

const lambda = new LambdaClient({ region: REGION });

async function deploy() {
  console.log(`\n🚀 Deploying ${FUNCTION_NAME}\n`);
  
  // Build
  const srcPath = path.join(__dirname, '../src/lambda/classify-single.ts');
  const outPath = '/tmp/classify-single.js';
  
  console.log('📦 Building...');
  await esbuild.build({
    entryPoints: [srcPath],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: outPath,
    minify: true,
    external: [], // Bundle everything
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
  console.log(`   Timeout: ${TIMEOUT}s`);
  console.log(`   Memory: ${MEMORY}MB`);
  console.log(`   Optimization: Reads only first 200KB of HTML`);
}

deploy().catch(console.error);

