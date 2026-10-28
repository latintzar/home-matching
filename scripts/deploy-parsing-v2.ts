/**
 * Deploy Parsing Pipeline V2
 * 
 * Creates necessary DynamoDB tables and deploys the orchestrator Lambda.
 */

import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand,
  ResourceNotFoundException 
} from '@aws-sdk/client-dynamodb';
import { 
  LambdaClient, 
  CreateFunctionCommand, 
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
  ResourceNotFoundException as LambdaResourceNotFound
} from '@aws-sdk/client-lambda';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import AdmZip from 'adm-zip';

const REGION = process.env.AWS_REGION || 'us-east-1';
const LAMBDA_ROLE = process.env.LEO_LAMBDA_ROLE || (process.env.AWS_EXECUTION_ROLE_ARN || '');

const dynamodb = new DynamoDBClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

/**
 * Create DynamoDB table if it doesn't exist
 */
async function ensureTable(
  tableName: string, 
  keySchema: { name: string; type: 'S' | 'N' }[]
): Promise<void> {
  try {
    await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`✅ Table ${tableName} already exists`);
    return;
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
  }

  console.log(`📦 Creating table ${tableName}...`);
  
  await dynamodb.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: keySchema.map((k, i) => ({
      AttributeName: k.name,
      KeyType: i === 0 ? 'HASH' : 'RANGE',
    })),
    AttributeDefinitions: keySchema.map(k => ({
      AttributeName: k.name,
      AttributeType: k.type,
    })),
    BillingMode: 'PAY_PER_REQUEST',
  }));

  console.log(`✅ Table ${tableName} created`);
}

/**
 * Bundle and deploy Lambda function
 */
async function deployLambda(
  functionName: string,
  entryPoint: string,
  timeout: number = 900,
  memorySize: number = 1024
): Promise<void> {
  console.log(`\n🔧 Building ${functionName}...`);

  // Bundle with esbuild
  const outfile = `/tmp/${functionName}.js`;
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile,
    external: ['@aws-sdk/*'],
    minify: true,
  });

  // Create ZIP
  const zip = new AdmZip();
  zip.addLocalFile(outfile, '', 'index.js');
  const zipBuffer = zip.toBuffer();

  console.log(`   Bundle size: ${(zipBuffer.length / 1024).toFixed(1)} KB`);

  // Check if function exists
  let exists = false;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
    exists = true;
  } catch (err) {
    if (!(err instanceof LambdaResourceNotFound)) throw err;
  }

  if (exists) {
    console.log(`   Updating existing function...`);
    await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: functionName,
      ZipFile: zipBuffer,
    }));
  } else {
    console.log(`   Creating new function...`);
    await lambda.send(new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs18.x',
      Role: LAMBDA_ROLE,
      Handler: 'index.handler',
      Code: { ZipFile: zipBuffer },
      Timeout: timeout,
      MemorySize: memorySize,
      Environment: {
        Variables: {
          GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        },
      },
    }));
  }

  console.log(`✅ ${functionName} deployed`);
}

async function main() {
  console.log('🚀 DEPLOYING PARSING PIPELINE V2\n');
  console.log('================================\n');

  // 1. Create DynamoDB tables
  console.log('📦 STEP 1: Creating DynamoDB Tables\n');
  
  await ensureTable('leo-domain-selectors', [{ name: 'domain', type: 'S' }]);
  await ensureTable('leo-parked-domains', [{ name: 'domain', type: 'S' }]);
  await ensureTable('leo-budget-tracker', [{ name: 'id', type: 'S' }]);

  // 2. Deploy orchestrator Lambda
  console.log('\n📦 STEP 2: Deploying Lambda Functions\n');
  
  await deployLambda(
    'parse-orchestrator-v2',
    'src/lambda/parse-orchestrator-v2.ts',
    900,  // 15 min timeout
    2048  // 2GB memory
  );

  console.log('\n================================');
  console.log('✅ DEPLOYMENT COMPLETE\n');
  console.log('To run the parsing pipeline:');
  console.log('  npx tsx scripts/run-parsing-v2.ts');
  console.log('\nOr invoke directly:');
  console.log('  aws lambda invoke --function-name parse-orchestrator-v2 \\');
  console.log('    --payload \'{"maxDomains": 5}\' \\');
  console.log('    --cli-read-timeout 900 /tmp/result.json');
}

main().catch(console.error);

