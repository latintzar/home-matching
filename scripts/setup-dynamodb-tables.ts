#!/usr/bin/env npx tsx
/**
 * DynamoDB Table Setup Script
 * 
 * Creates the required DynamoDB tables for the P0 Lean App:
 * - leo-wpa-cache: WPA results cache
 * - leo-serp-extractions: Raw SERP extraction data
 * - leo-neighborhood-profiles: Aggregated neighborhood profiles
 * - leo-h3-lookup: H3 geo-index to neighborhood mapping
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
 *   npx tsx scripts/setup-dynamodb-tables.ts
 */

import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand,
  ListTablesCommand,
  ResourceNotFoundException 
} from '@aws-sdk/client-dynamodb';

// ============================================================================
// Table Definitions
// ============================================================================

const TABLES = [
  {
    name: 'leo-wpa-cache',
    description: 'WPA (Whole Property Analysis) results cache',
    partitionKey: 'listing_id',
    sortKey: 'wpa_mode', // 'instant' | 'full' | 'descriptions' | 'scores'
    attributes: [
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'wpa_mode', AttributeType: 'S' },
    ],
    gsi: [
      {
        IndexName: 'city-index',
        KeySchema: [
          { AttributeName: 'city', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      }
    ],
    extraAttributes: [
      { AttributeName: 'city', AttributeType: 'S' },
    ],
  },
  {
    name: 'leo-serp-extractions',
    description: 'Raw SERP extraction data for neighborhood research',
    partitionKey: 'page_id', // Hash of URL
    sortKey: 'neighborhood_id',
    attributes: [
      { AttributeName: 'page_id', AttributeType: 'S' },
      { AttributeName: 'neighborhood_id', AttributeType: 'S' },
    ],
    gsi: [
      {
        IndexName: 'neighborhood-index',
        KeySchema: [
          { AttributeName: 'neighborhood_id', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      }
    ],
  },
  {
    name: 'leo-neighborhood-profiles',
    description: 'Aggregated 20-dimension neighborhood profiles',
    partitionKey: 'neighborhood_id',
    attributes: [
      { AttributeName: 'neighborhood_id', AttributeType: 'S' },
      { AttributeName: 'city', AttributeType: 'S' },
    ],
    gsi: [
      {
        IndexName: 'city-index',
        KeySchema: [
          { AttributeName: 'city', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      }
    ],
  },
  {
    name: 'leo-h3-lookup',
    description: 'H3 hex index to neighborhood mapping for geo-lookup',
    partitionKey: 'h3_index',
    attributes: [
      { AttributeName: 'h3_index', AttributeType: 'S' },
    ],
  },
  {
    name: 'airbnb_reviews_tagged',
    description: 'Tagged Airbnb reviews with extracted neighborhood insights',
    partitionKey: 'review_id',
    sortKey: 'neighborhood',
    attributes: [
      { AttributeName: 'review_id', AttributeType: 'S' },
      { AttributeName: 'neighborhood', AttributeType: 'S' },
    ],
    gsi: [
      {
        IndexName: 'neighborhood-index',
        KeySchema: [
          { AttributeName: 'neighborhood', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      }
    ],
  },
];

// ============================================================================
// DynamoDB Client
// ============================================================================

function getClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// ============================================================================
// Table Operations
// ============================================================================

async function tableExists(client: DynamoDBClient, tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

async function createTable(client: DynamoDBClient, tableConfig: typeof TABLES[0]): Promise<void> {
  const exists = await tableExists(client, tableConfig.name);
  
  if (exists) {
    console.log(`  ⏭️  Table ${tableConfig.name} already exists, skipping...`);
    return;
  }
  
  console.log(`  🔨 Creating table ${tableConfig.name}...`);
  console.log(`     ${tableConfig.description}`);
  
  const keySchema = [
    { AttributeName: tableConfig.partitionKey, KeyType: 'HASH' as const },
  ];
  
  if (tableConfig.sortKey) {
    keySchema.push({ AttributeName: tableConfig.sortKey, KeyType: 'RANGE' as const });
  }
  
  const attributeDefinitions = [...tableConfig.attributes];
  if (tableConfig.extraAttributes) {
    attributeDefinitions.push(...tableConfig.extraAttributes);
  }
  
  const params: any = {
    TableName: tableConfig.name,
    KeySchema: keySchema,
    AttributeDefinitions: attributeDefinitions,
    BillingMode: 'PAY_PER_REQUEST', // On-demand for cost efficiency
  };
  
  if (tableConfig.gsi && tableConfig.gsi.length > 0) {
    params.GlobalSecondaryIndexes = tableConfig.gsi;
  }
  
  try {
    await client.send(new CreateTableCommand(params));
    console.log(`  ✅ Created table ${tableConfig.name}`);
  } catch (error) {
    console.error(`  ❌ Failed to create table ${tableConfig.name}:`, error);
    throw error;
  }
}

async function listAllTables(client: DynamoDBClient): Promise<string[]> {
  const result = await client.send(new ListTablesCommand({}));
  return result.TableNames || [];
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           DYNAMODB TABLE SETUP                               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Creates tables for P0 Lean App:                             ║');
  console.log('║  - leo-wpa-cache                                             ║');
  console.log('║  - leo-serp-extractions                                      ║');
  console.log('║  - leo-neighborhood-profiles                                 ║');
  console.log('║  - leo-h3-lookup                                             ║');
  console.log('║  - airbnb_reviews_tagged                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Check environment
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error('❌ AWS credentials not set. Run:');
    console.log('cd /Users/peterneyra/puedo_casa && source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION');
    process.exit(1);
  }
  
  const client = getClient();
  
  // List existing tables
  console.log('📋 Checking existing tables...\n');
  const existingTables = await listAllTables(client);
  console.log(`   Found ${existingTables.length} existing tables:\n   ${existingTables.join(', ') || '(none)'}\n`);
  
  // Create each table
  console.log('🏗️  Creating tables...\n');
  
  for (const tableConfig of TABLES) {
    await createTable(client, tableConfig);
  }
  
  console.log('\n✅ All tables created successfully!\n');
  
  // List tables again to confirm
  console.log('📋 Final table list:');
  const finalTables = await listAllTables(client);
  for (const table of finalTables) {
    const isNew = TABLES.some(t => t.name === table);
    console.log(`   ${isNew ? '🆕' : '  '} ${table}`);
  }
  
  console.log('\n🎉 Setup complete!\n');
}

main().catch(console.error);

