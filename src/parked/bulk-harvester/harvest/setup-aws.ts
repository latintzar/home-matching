/**
 * Setup AWS Resources for Harvest Pipeline
 * 
 * Creates all necessary DynamoDB tables and SNS topics.
 * Run once before starting the harvest.
 * 
 * Usage:
 *   npx tsx src/harvest/setup-aws.ts
 */

import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand,
  ResourceNotFoundException 
} from '@aws-sdk/client-dynamodb';
import { 
  SNSClient, 
  CreateTopicCommand, 
  SubscribeCommand,
  ListSubscriptionsByTopicCommand 
} from '@aws-sdk/client-sns';
import { HARVEST_CONFIG } from './config';

const ddb = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const sns = new SNSClient({ region: HARVEST_CONFIG.aws.region });

/**
 * Check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

/**
 * Create leo-urls table
 */
async function createUrlsTable(): Promise<void> {
  const tableName = HARVEST_CONFIG.aws.dynamodb.urlsTable;
  
  if (await tableExists(tableName)) {
    console.log(`  ✅ ${tableName} already exists`);
    return;
  }
  
  console.log(`  Creating ${tableName}...`);
  
  await ddb.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'url', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'url', AttributeType: 'S' },
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
  }));
  
  console.log(`  ✅ ${tableName} created`);
}

/**
 * Create leo-crawl-status table
 */
async function createCrawlStatusTable(): Promise<void> {
  const tableName = HARVEST_CONFIG.aws.dynamodb.crawlStatusTable;
  
  if (await tableExists(tableName)) {
    console.log(`  ✅ ${tableName} already exists`);
    return;
  }
  
  console.log(`  Creating ${tableName}...`);
  
  await ddb.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'domain', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'domain', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }));
  
  console.log(`  ✅ ${tableName} created`);
}

/**
 * Create leo-delta-sources table
 */
async function createDeltaSourcesTable(): Promise<void> {
  const tableName = HARVEST_CONFIG.aws.dynamodb.deltaSourcesTable;
  
  if (await tableExists(tableName)) {
    console.log(`  ✅ ${tableName} already exists`);
    return;
  }
  
  console.log(`  Creating ${tableName}...`);
  
  await ddb.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'url', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'url', AttributeType: 'S' },
      { AttributeName: 'domain', AttributeType: 'S' },
      { AttributeName: 'check_frequency', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'domain-index',
        KeySchema: [
          { AttributeName: 'domain', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'frequency-index',
        KeySchema: [
          { AttributeName: 'check_frequency', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }));
  
  console.log(`  ✅ ${tableName} created`);
}

/**
 * Create leo-listings table
 */
async function createListingsTable(): Promise<void> {
  const tableName = HARVEST_CONFIG.aws.dynamodb.listingsTable;
  
  if (await tableExists(tableName)) {
    console.log(`  ✅ ${tableName} already exists`);
    return;
  }
  
  console.log(`  Creating ${tableName}...`);
  
  await ddb.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'url', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'url', AttributeType: 'S' },
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
  }));
  
  console.log(`  ✅ ${tableName} created`);
}

/**
 * Create leo-scraping-rules table (if needed)
 */
async function createScrapingRulesTable(): Promise<void> {
  const tableName = HARVEST_CONFIG.aws.dynamodb.scrapingRulesTable;
  
  if (await tableExists(tableName)) {
    console.log(`  ✅ ${tableName} already exists`);
    return;
  }
  
  console.log(`  Creating ${tableName}...`);
  
  await ddb.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'domain', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'domain', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }));
  
  console.log(`  ✅ ${tableName} created`);
}

/**
 * Setup SNS topic and email subscription
 */
async function setupSNS(): Promise<void> {
  console.log('\n2. Setting up SNS alerts...');
  
  const topicName = 'leo-harvest-alerts';
  const email = HARVEST_CONFIG.alerts.email;
  
  // Create topic
  console.log(`  Creating topic: ${topicName}`);
  const createResult = await sns.send(new CreateTopicCommand({
    Name: topicName,
  }));
  
  const topicArn = createResult.TopicArn;
  console.log(`  ✅ Topic ARN: ${topicArn}`);
  
  // Check for existing subscription
  const subs = await sns.send(new ListSubscriptionsByTopicCommand({
    TopicArn: topicArn,
  }));
  
  const existingSub = subs.Subscriptions?.find(
    s => s.Protocol === 'email' && s.Endpoint === email
  );
  
  if (existingSub) {
    if (existingSub.SubscriptionArn === 'PendingConfirmation') {
      console.log(`  ⚠️ Subscription pending - check ${email} inbox`);
    } else {
      console.log(`  ✅ Already subscribed: ${email}`);
    }
  } else {
    console.log(`  Subscribing ${email}...`);
    await sns.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: email,
    }));
    console.log(`  ✅ Check ${email} for confirmation link!`);
  }
  
  // Check if config needs update
  if (HARVEST_CONFIG.aws.snsTopicArn !== topicArn) {
    console.log(`\n  ⚠️ Update config.ts with:`);
    console.log(`     snsTopicArn: '${topicArn}'`);
  }
}

/**
 * Main setup function
 */
async function setup(): Promise<void> {
  console.log('🔧 Setting Up AWS Resources for Harvest Pipeline');
  console.log('================================================\n');
  console.log(`Region: ${HARVEST_CONFIG.aws.region}`);
  console.log(`S3 Bucket: ${HARVEST_CONFIG.aws.s3Bucket}`);
  console.log(`Alert Email: ${HARVEST_CONFIG.alerts.email}`);
  
  console.log('\n1. Creating DynamoDB tables...');
  
  await createUrlsTable();
  await createCrawlStatusTable();
  await createDeltaSourcesTable();
  await createListingsTable();
  await createScrapingRulesTable();
  
  await setupSNS();
  
  console.log('\n========================================');
  console.log('SETUP COMPLETE');
  console.log('========================================');
  console.log('\nNext steps:');
  console.log('1. Confirm email subscription (check inbox)');
  console.log('2. Run: npx tsx src/harvest/alerts.ts --test');
  console.log('3. Start Phase 0: npx tsx src/harvest/cleanup-urls-with-log.ts');
}

// CLI
if (require.main === module) {
  setup().catch(console.error);
}

