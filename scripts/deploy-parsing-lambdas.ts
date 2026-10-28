/**
 * Deploy Parsing Lambdas (Teacher, Validator, Orchestrator)
 * 
 * Usage: npx tsx scripts/deploy-parsing-lambdas.ts
 */

import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import { IAMClient, GetRoleCommand } from '@aws-sdk/client-iam';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const REGION = 'us-east-1';
const ROLE_NAME = 'leo-lambda-role';

const lambda = new LambdaClient({ region: REGION });
const iam = new IAMClient({ region: REGION });

interface LambdaConfig {
  name: string;
  entryPoint: string;
  timeout: number;
  memory: number;
}

const LAMBDAS: LambdaConfig[] = [
  {
    name: 'parse-teacher',
    entryPoint: 'src/lambda/parse-teacher.ts',
    timeout: 120,  // 2 min - Gemini 3 Pro can be slow
    memory: 512,
  },
  {
    name: 'parse-validator',
    entryPoint: 'src/lambda/parse-validator.ts',
    timeout: 60,   // 1 min
    memory: 256,
  },
  {
    name: 'parse-orchestrator',
    entryPoint: 'src/lambda/parse-orchestrator.ts',
    timeout: 900,  // 15 min
    memory: 1024,
  },
];

async function getRoleArn(): Promise<string> {
  const result = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
  return result.Role!.Arn!;
}

async function buildAndZip(config: LambdaConfig): Promise<Buffer> {
  const buildDir = '.lambda-build';
  const outDir = path.join(buildDir, config.name);
  
  // Ensure build dir exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Build with esbuild
  await esbuild.build({
    entryPoints: [config.entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(outDir, 'index.js'),
    external: ['@aws-sdk/*'],  // Use Lambda's built-in SDK
    minify: true,
    sourcemap: false,
  });

  // Create zip
  const zip = new AdmZip();
  zip.addLocalFile(path.join(outDir, 'index.js'));
  
  const zipPath = path.join(buildDir, `${config.name}.zip`);
  zip.writeZip(zipPath);
  
  return fs.readFileSync(zipPath);
}

async function deployLambda(config: LambdaConfig, roleArn: string): Promise<void> {
  console.log(`\n📦 Deploying ${config.name}...`);
  
  // Build
  console.log('   Building...');
  const zipBuffer = await buildAndZip(config);
  
  // Try to update existing function first
  try {
    console.log('   Updating code...');
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: config.name,
      ZipFile: zipBuffer,
    }));
    
    console.log('   Updating config...');
    await lambda.send(new UpdateFunctionConfigurationCommand({
      FunctionName: config.name,
      Timeout: config.timeout,
      MemorySize: config.memory,
      Environment: {
        Variables: {
          GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
          GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY || '',
        },
      },
    }));
    
    console.log(`   ✅ Updated ${config.name}`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      // Create new function
      console.log('   Creating new function...');
      await lambda.send(new CreateFunctionCommand({
        FunctionName: config.name,
        Runtime: 'nodejs18.x',
        Role: roleArn,
        Handler: 'index.handler',
        Code: { ZipFile: zipBuffer },
        Timeout: config.timeout,
        MemorySize: config.memory,
        Environment: {
          Variables: {
            GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
            GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY || '',
          },
        },
      }));
      console.log(`   ✅ Created ${config.name}`);
    } else {
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 Deploying Parsing Lambdas');
  console.log('='.repeat(40));
  
  // Get IAM role
  console.log('\n📋 Getting IAM role...');
  const roleArn = await getRoleArn();
  console.log(`   Role: ${roleArn}`);
  
  // Deploy each Lambda
  for (const config of LAMBDAS) {
    await deployLambda(config, roleArn);
  }
  
  console.log('\n' + '='.repeat(40));
  console.log('✅ All Lambdas deployed!');
  console.log('\nTo run the orchestrator:');
  console.log('  aws lambda invoke --function-name parse-orchestrator --payload \'{"maxDomains": 10}\' /dev/stdout');
}

main().catch(console.error);

