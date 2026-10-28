import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const client = new DynamoDBClient({ region: 'us-east-1' });
const TABLE_NAME = 'leo-scraping-rules';

interface CSVRow {
  domain: string;
  url: string;
  title: string;
  email: string;
  phone: string;
  social_links: string;
  platform: string;
  is_likely_agency: string;
  sitemap_found: string;
  sitemap_url: string;
  source_query: string;
  snippet: string;
}

async function loadDomains() {
  console.log('📋 Loading clean domains from MASTER_AGENCY_LIST.csv...\n');
  
  const csvContent = readFileSync('data/MASTER_AGENCY_LIST.csv', 'utf-8');
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });
  
  console.log(`Found ${records.length} domains\n`);
  
  // Prepare items for DynamoDB
  const items = records.map(row => ({
    PutRequest: {
      Item: {
        domain: { S: row.domain },
        url: { S: row.url || '' },
        has_sitemap: { BOOL: row.sitemap_found === 'YES' },
        sitemap_url: row.sitemap_url ? { S: row.sitemap_url } : { NULL: true },
        platform: row.platform ? { S: row.platform } : { NULL: true },
        source_query: row.source_query ? { S: row.source_query } : { NULL: true },
      }
    }
  }));
  
  // Count stats
  const withSitemap = items.filter(i => i.PutRequest.Item.has_sitemap.BOOL).length;
  const withoutSitemap = items.length - withSitemap;
  
  console.log(`📊 Stats:`);
  console.log(`   With sitemap: ${withSitemap}`);
  console.log(`   Without sitemap: ${withoutSitemap}`);
  console.log(`   Total: ${items.length}\n`);
  
  // Batch write (25 items at a time)
  let written = 0;
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    
    const command = new BatchWriteItemCommand({
      RequestItems: {
        [TABLE_NAME]: batch
      }
    });
    
    try {
      await client.send(command);
      written += batch.length;
      
      if (written % 500 === 0 || written === items.length) {
        console.log(`   Written: ${written}/${items.length}`);
      }
    } catch (err) {
      console.error(`Error writing batch at ${i}:`, err);
    }
  }
  
  console.log(`\n✅ Done! Loaded ${written} domains into ${TABLE_NAME}`);
}

loadDomains().catch(console.error);

