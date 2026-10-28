/**
 * BUILD DOMAIN STATS
 * 
 * One-time aggregation to create leo-domain-stats table with
 * pre-computed metrics per domain. This eliminates slow scans.
 * 
 * Run: npx tsx scripts/build-domain-stats.ts
 */

import { DynamoDBClient, ScanCommand, PutItemCommand, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const dynamodb = new DynamoDBClient({ region: REGION });

const URLS_TABLE = 'leo-urls';
const STATS_TABLE = 'leo-domain-stats';

interface DomainStats {
  domain: string;
  total_urls: number;
  urls_with_html: number;
  urls_classified: number;
  listings_parse: number;      // action=parse
  list_pages: number;          // action=delta_source
  junk_skip: number;           // action=skip
  errors_download: number;
  errors_classify: number;
  sample_urls: string[];       // First 5 URLs for debugging
  sample_classifications: string[]; // Sample classification results
}

async function createStatsTable(): Promise<void> {
  try {
    await dynamodb.send(new DescribeTableCommand({ TableName: STATS_TABLE }));
    console.log(`✅ Table ${STATS_TABLE} already exists`);
    return;
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }

  console.log(`📦 Creating table ${STATS_TABLE}...`);
  await dynamodb.send(new CreateTableCommand({
    TableName: STATS_TABLE,
    KeySchema: [{ AttributeName: 'domain', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'domain', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  }));

  // Wait for table to be active
  let active = false;
  while (!active) {
    await new Promise(r => setTimeout(r, 2000));
    const desc = await dynamodb.send(new DescribeTableCommand({ TableName: STATS_TABLE }));
    active = desc.Table?.TableStatus === 'ACTIVE';
    console.log(`   Table status: ${desc.Table?.TableStatus}`);
  }
  console.log(`✅ Table ${STATS_TABLE} created`);
}

async function aggregateStats(): Promise<Map<string, DomainStats>> {
  const stats = new Map<string, DomainStats>();
  let lastKey: any = undefined;
  let scanned = 0;
  let processed = 0;

  console.log('\n📊 Scanning leo-urls table...');
  console.log('   This will take a few minutes for 600K items...\n');

  const startTime = Date.now();

  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      ExclusiveStartKey: lastKey,
      Limit: 5000,
    }));

    scanned += result.ScannedCount || 0;

    for (const item of result.Items || []) {
      const domain = item.domain?.S || 'unknown';
      const url = item.url?.S || '';
      const s3Key = item.s3_key?.S;
      const classification = item.classification?.S;
      const downloadError = item.download_error?.S;
      const classificationStatus = item.classification_status?.S;

      if (!stats.has(domain)) {
        stats.set(domain, {
          domain,
          total_urls: 0,
          urls_with_html: 0,
          urls_classified: 0,
          listings_parse: 0,
          list_pages: 0,
          junk_skip: 0,
          errors_download: 0,
          errors_classify: 0,
          sample_urls: [],
          sample_classifications: [],
        });
      }

      const s = stats.get(domain)!;
      s.total_urls++;

      if (s3Key) s.urls_with_html++;
      if (classificationStatus === 'classified') s.urls_classified++;
      if (downloadError) s.errors_download++;
      if (classificationStatus === 'failed') s.errors_classify++;

      // Parse classification JSON
      if (classification) {
        try {
          const c = JSON.parse(classification);
          if (c.action === 'parse') s.listings_parse++;
          else if (c.action === 'delta_source') s.list_pages++;
          else if (c.action === 'skip') s.junk_skip++;
        } catch {}
      }

      // Collect samples
      if (s.sample_urls.length < 5) {
        s.sample_urls.push(url);
      }
      if (s.sample_classifications.length < 3 && classification) {
        s.sample_classifications.push(classification.substring(0, 200));
      }

      processed++;
    }

    lastKey = result.LastEvaluatedKey;

    // Progress update every 50K items
    if (scanned % 50000 < 5000) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(scanned / elapsed);
      console.log(`   Scanned: ${scanned.toLocaleString()} | Domains: ${stats.size} | Rate: ${rate}/sec`);
    }

  } while (lastKey);

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Scan complete in ${elapsed.toFixed(1)}s`);
  console.log(`   Total URLs: ${scanned.toLocaleString()}`);
  console.log(`   Unique domains: ${stats.size}`);

  return stats;
}

async function saveStats(stats: Map<string, DomainStats>): Promise<void> {
  console.log('\n💾 Saving stats to DynamoDB...');
  
  let saved = 0;
  let errors = 0;
  
  for (const [domain, s] of stats) {
    try {
      // Dedupe and limit samples
      const uniqueUrls = [...new Set(s.sample_urls)].slice(0, 5);
      const uniqueClassifications = [...new Set(s.sample_classifications)].slice(0, 3);
      
      await dynamodb.send(new PutItemCommand({
        TableName: STATS_TABLE,
        Item: {
          domain: { S: domain },
          total_urls: { N: String(s.total_urls) },
          urls_with_html: { N: String(s.urls_with_html) },
          urls_classified: { N: String(s.urls_classified) },
          listings_parse: { N: String(s.listings_parse) },
          list_pages: { N: String(s.list_pages) },
          junk_skip: { N: String(s.junk_skip) },
          errors_download: { N: String(s.errors_download) },
          errors_classify: { N: String(s.errors_classify) },
          sample_urls: { L: uniqueUrls.map(u => ({ S: u })) },
          sample_classifications: { L: uniqueClassifications.map(c => ({ S: c })) },
          updated_at: { S: new Date().toISOString() },
        },
      }));
      saved++;
    } catch (e: any) {
      errors++;
      if (errors < 5) console.error(`   Error saving ${domain}: ${e.message}`);
    }

    if (saved % 200 === 0) {
      console.log(`   Saved ${saved}/${stats.size} domains`);
    }
  }

  console.log(`✅ Saved ${saved} domain stats (${errors} errors)`);
}

async function printSummary(stats: Map<string, DomainStats>): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('HARVEST SUMMARY');
  console.log('='.repeat(60));

  let totalUrls = 0;
  let totalWithHtml = 0;
  let totalClassified = 0;
  let totalListings = 0;
  let totalListPages = 0;
  let totalJunk = 0;
  let domainsWithListings = 0;
  let domainsWithZeroListings = 0;
  let domainsWithZeroUrls = 0;

  const zeroListingDomains: string[] = [];

  for (const [domain, s] of stats) {
    totalUrls += s.total_urls;
    totalWithHtml += s.urls_with_html;
    totalClassified += s.urls_classified;
    totalListings += s.listings_parse;
    totalListPages += s.list_pages;
    totalJunk += s.junk_skip;

    if (s.listings_parse > 0) {
      domainsWithListings++;
    } else {
      domainsWithZeroListings++;
      if (s.total_urls === 0) {
        domainsWithZeroUrls++;
      }
      zeroListingDomains.push(`${domain}: ${s.total_urls} URLs, ${s.urls_with_html} HTMLs`);
    }
  }

  console.log(`
📊 TOTALS
   Domains:           ${stats.size.toLocaleString()}
   URLs:              ${totalUrls.toLocaleString()}
   HTMLs downloaded:  ${totalWithHtml.toLocaleString()}
   URLs classified:   ${totalClassified.toLocaleString()}

📈 CLASSIFICATION BREAKDOWN
   Listings (parse):  ${totalListings.toLocaleString()}
   List pages:        ${totalListPages.toLocaleString()}
   Junk (skip):       ${totalJunk.toLocaleString()}

🏠 DOMAIN STATUS
   With listings:     ${domainsWithListings} (${(domainsWithListings/stats.size*100).toFixed(1)}%)
   Zero listings:     ${domainsWithZeroListings} (${(domainsWithZeroListings/stats.size*100).toFixed(1)}%)
   Zero URLs:         ${domainsWithZeroUrls}
`);

  // Show domains with 0 listings but >0 URLs (likely crawl issues)
  const crawlIssues = zeroListingDomains
    .filter(d => !d.includes(': 0 URLs'))
    .slice(0, 20);

  if (crawlIssues.length > 0) {
    console.log('⚠️  DOMAINS WITH URLs BUT 0 LISTINGS (crawl depth issue?):');
    crawlIssues.forEach(d => console.log(`   ${d}`));
    console.log(`   ... and ${zeroListingDomains.filter(d => !d.includes(': 0 URLs')).length - 20} more`);
  }

  // Show domains with 0 URLs (never crawled or blocked)
  const neverCrawled = zeroListingDomains
    .filter(d => d.includes(': 0 URLs'))
    .slice(0, 10);

  if (neverCrawled.length > 0) {
    console.log('\n❌ DOMAINS WITH 0 URLs (never crawled or blocked):');
    neverCrawled.forEach(d => console.log(`   ${d.split(':')[0]}`));
    console.log(`   ... and ${zeroListingDomains.filter(d => d.includes(': 0 URLs')).length - 10} more`);
  }
}

async function main() {
  console.log('🚀 BUILD DOMAIN STATS\n');
  console.log('This creates a leo-domain-stats table with pre-computed metrics.');
  console.log('After this runs, queries will be instant instead of scanning 600K items.\n');

  await createStatsTable();
  const stats = await aggregateStats();
  await saveStats(stats);
  await printSummary(stats);

  console.log('\n✅ DONE! You can now query leo-domain-stats instantly.');
  console.log('   Example: aws dynamodb get-item --table-name leo-domain-stats --key \'{"domain":{"S":"remax.es"}}\'');
}

main().catch(console.error);

