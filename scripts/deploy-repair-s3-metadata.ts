/**
 * Deploy repair-from-s3-metadata Lambda
 */

import * as path from 'path';
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import * as esbuild from 'esbuild';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const FUNCTION_NAME = 'repair-from-s3-metadata';
const ROLE_ARN = (process.env.AWS_EXECUTION_ROLE_ARN || '');
const TIMEOUT = 900; // 15 minutes
const MEMORY = 512;

const lambda = new LambdaClient({ region: REGION });

async function deploy() {
  console.log(`\n🚀 Deploying ${FUNCTION_NAME}\n`);
  
  const srcPath = path.join(__dirname, '../src/lambda/repair-from-s3-metadata.ts');
  const outPath = '/tmp/repair-from-s3-metadata.js';
  
  console.log('📦 Building...');
  await esbuild.build({
    entryPoints: [srcPath],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: outPath,
    minify: true,
  });
  
  console.log('📦 Zipping...');
  const zip = new AdmZip();
  zip.addLocalFile(outPath, '', 'index.js');
  const zipBuffer = zip.toBuffer();
  
  let exists = false;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    exists = true;
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }
  
  if (exists) {
    console.log('📤 Updating code...');
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBuffer,
    }));
    await new Promise(r => setTimeout(r, 3000));
    console.log('⚙️ Updating config...');
    await lambda.send(new UpdateFunctionConfigurationCommand({
      FunctionName: FUNCTION_NAME,
      Timeout: TIMEOUT,
      MemorySize: MEMORY,
      Handler: 'index.handler',
    }));
  } else {
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
}

deploy().catch(console.error);

