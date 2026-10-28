/**
 * Deploy parallel repair Lambdas
 */

import * as path from 'path';
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import * as esbuild from 'esbuild';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const ROLE_ARN = (process.env.AWS_EXECUTION_ROLE_ARN || '');

const lambda = new LambdaClient({ region: REGION });

async function deployLambda(name: string, srcFile: string, timeout: number, memory: number) {
  console.log(`\n📦 Deploying ${name}...`);
  
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
  
  console.log(`   ✅ ${name} deployed (${timeout}s, ${memory}MB)`);
}

async function main() {
  console.log('🚀 Deploying Parallel Repair System\n');
  
  // Deploy repair-single (fast, many concurrent)
  await deployLambda('repair-single', 'repair-single.ts', 30, 128);
  
  // Deploy repair-orchestrator (long-running)
  await deployLambda('repair-orchestrator', 'repair-orchestrator.ts', 900, 256);
  
  console.log('\n✅ All deployed!');
  console.log('\nTo run: aws lambda invoke --function-name repair-orchestrator --invocation-type Event /dev/null');
}

main().catch(console.error);

