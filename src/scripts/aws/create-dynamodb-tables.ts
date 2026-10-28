/**
 * Create DynamoDB Tables for Leo Harvest Engine
 * 
 * Tables:
 * - listings: Core property data (650k records)
 * - scraping_rules: Domain selectors (3,635 domains)
 * - crawl_tracking: Crawl metadata per domain
 * - wpa_cache: Whole Property Analysis results
 * - geo_intelligence: Dossier system (building/street/neighborhood)
 * - market_velocity: Sold/rented analytics by location
 * 
 * Run: npx tsx src/scripts/aws/create-dynamodb-tables.ts
 */

import { 
  DynamoDBClient, 
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
  ResourceInUseException
} from '@aws-sdk/client-dynamodb';
import * as dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface TableDefinition {
  TableName: string;
  KeySchema: { AttributeName: string; KeyType: 'HASH' | 'RANGE' }[];
  AttributeDefinitions: { AttributeName: string; AttributeType: 'S' | 'N' | 'B' }[];
  GlobalSecondaryIndexes?: {
    IndexName: string;
    KeySchema: { AttributeName: string; KeyType: 'HASH' | 'RANGE' }[];
    Projection: { ProjectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE' };
  }[];
  BillingMode: 'PAY_PER_REQUEST';
}

const TABLES: TableDefinition[] = [
  // Core listings table - all property data
  {
    TableName: 'leo-listings',
    KeySchema: [
      { AttributeName: 'domain', KeyType: 'HASH' },      // Partition by domain
      { AttributeName: 'listing_id', KeyType: 'RANGE' }, // Sort by listing ID
    ],
    AttributeDefinitions: [
      { AttributeName: 'domain', AttributeType: 'S' },
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'city', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'city-index',
        KeySchema: [
          { AttributeName: 'city', KeyType: 'HASH' },
          { AttributeName: 'listing_id', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'status-index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'listing_id', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // Scraping rules - learned selectors per domain
  {
    TableName: 'leo-scraping-rules',
    KeySchema: [
      { AttributeName: 'domain', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'domain', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // Crawl tracking - metadata per domain
  {
    TableName: 'leo-crawl-tracking',
    KeySchema: [
      { AttributeName: 'domain', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'domain', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // WPA cache - Whole Property Analysis results
  {
    TableName: 'leo-wpa-cache',
    KeySchema: [
      { AttributeName: 'listing_url', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'listing_url', AttributeType: 'S' },
      { AttributeName: 'domain', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'domain-index',
        KeySchema: [
          { AttributeName: 'domain', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // Geo-Intelligence - dossier system
  {
    TableName: 'leo-geo-intelligence',
    KeySchema: [
      { AttributeName: 'geohash', KeyType: 'HASH' },     // Geohash for spatial queries
      { AttributeName: 'insight_id', KeyType: 'RANGE' }, // Unique insight ID
    ],
    AttributeDefinitions: [
      { AttributeName: 'geohash', AttributeType: 'S' },
      { AttributeName: 'insight_id', AttributeType: 'S' },
      { AttributeName: 'city', AttributeType: 'S' },
      { AttributeName: 'insight_type', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'city-type-index',
        KeySchema: [
          { AttributeName: 'city', KeyType: 'HASH' },
          { AttributeName: 'insight_type', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // Market velocity - sold/rented analytics
  {
    TableName: 'leo-market-velocity',
    KeySchema: [
      { AttributeName: 'location_key', KeyType: 'HASH' }, // "Madrid/Salamanca"
      { AttributeName: 'period', KeyType: 'RANGE' },      // "2025-11"
    ],
    AttributeDefinitions: [
      { AttributeName: 'location_key', AttributeType: 'S' },
      { AttributeName: 'period', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // Analysis results cache (text analysis, room analysis, etc.)
  {
    TableName: 'leo-analysis-cache',
    KeySchema: [
      { AttributeName: 'listing_id', KeyType: 'HASH' },
      { AttributeName: 'analysis_type', KeyType: 'RANGE' }, // "text_a", "room_by_room", etc.
    ],
    AttributeDefinitions: [
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'analysis_type', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    return false;
  }
}

async function createTable(table: TableDefinition): Promise<void> {
  const exists = await tableExists(table.TableName);
  
  if (exists) {
    console.log(`  ✅ ${table.TableName} already exists`);
    return;
  }

  try {
    await client.send(new CreateTableCommand({
      ...table,
      GlobalSecondaryIndexes: table.GlobalSecondaryIndexes?.map(gsi => ({
        ...gsi,
        ProvisionedThroughput: undefined, // Not needed for PAY_PER_REQUEST
      })),
    }));
    console.log(`  ✅ ${table.TableName} created`);
  } catch (error) {
    if (error instanceof ResourceInUseException) {
      console.log(`  ⚠️ ${table.TableName} already exists (race condition)`);
    } else {
      throw error;
    }
  }
}

async function listExistingTables(): Promise<string[]> {
  const response = await client.send(new ListTablesCommand({}));
  return response.TableNames || [];
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DYNAMODB TABLE CREATION - Leo Harvest Engine');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS credentials not found in .env.local');
    process.exit(1);
  }

  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`Access Key: ${process.env.AWS_ACCESS_KEY_ID.slice(0, 8)}...`);
  console.log('');

  // List existing tables
  console.log('📋 Checking existing tables...');
  const existing = await listExistingTables();
  console.log(`   Found ${existing.length} existing tables\n`);

  // Create each table
  console.log('📦 Creating tables...\n');
  
  for (const table of TABLES) {
    await createTable(table);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ DONE - All tables ready');
  console.log('═══════════════════════════════════════════════════════════════');

  // Summary
  console.log('\n📊 Table Summary:\n');
  const allTables = await listExistingTables();
  const leoTables = allTables.filter(t => t.startsWith('leo-'));
  
  for (const tableName of leoTables) {
    const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
    const status = desc.Table?.TableStatus;
    const itemCount = desc.Table?.ItemCount || 0;
    console.log(`   ${tableName}: ${status} (${itemCount} items)`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

