import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { readFileSync } from 'fs';

const client = new DynamoDBClient({ region: 'us-east-1' });
const TABLE_NAME = 'leo-urls';

// Read outlier domains
const outlierDomains = readFileSync('data/outlier_domains_clean.txt', 'utf-8')
  .split('\n')
  .filter(d => d.trim())
  .map(d => d.trim().toLowerCase());

console.log(`📋 Loaded ${outlierDomains.length} outlier domains to remove`);

// Create a Set for fast lookup
const outlierSet = new Set(outlierDomains);

// Function to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // Try to extract domain from malformed URLs
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1].toLowerCase() : '';
  }
}

// Scan and delete matching URLs
async function cleanupOutlierUrls() {
  let scannedCount = 0;
  let deletedCount = 0;
  let lastEvaluatedKey: any = undefined;
  const domainsFound: Record<string, number> = {};

  console.log('\n🔍 Scanning leo-urls table...\n');

  do {
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastEvaluatedKey,
      ProjectionExpression: '#url',
      ExpressionAttributeNames: { '#url': 'url' },
    });

    const result = await client.send(scanCommand);
    scannedCount += result.Items?.length || 0;

    // Find URLs to delete
    const urlsToDelete: string[] = [];
    
    for (const item of result.Items || []) {
      const url = item.url?.S;
      if (!url) continue;
      
      const domain = extractDomain(url);
      
      if (outlierSet.has(domain)) {
        urlsToDelete.push(url);
        domainsFound[domain] = (domainsFound[domain] || 0) + 1;
      }
    }

    // Delete in batches of 25
    for (let i = 0; i < urlsToDelete.length; i += 25) {
      const batch = urlsToDelete.slice(i, i + 25);
      
      const deleteCommand = new BatchWriteItemCommand({
        RequestItems: {
          [TABLE_NAME]: batch.map(url => ({
            DeleteRequest: {
              Key: { url: { S: url } }
            }
          }))
        }
      });

      try {
        await client.send(deleteCommand);
        deletedCount += batch.length;
      } catch (err) {
        console.error(`Error deleting batch:`, err);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
    
    // Progress update every 10K items
    if (scannedCount % 10000 < 5000) {
      process.stdout.write(`\r  Scanned: ${scannedCount.toLocaleString()} | Deleted: ${deletedCount.toLocaleString()}`);
    }

  } while (lastEvaluatedKey);

  console.log(`\n\n✅ Cleanup complete!`);
  console.log(`   Scanned: ${scannedCount.toLocaleString()} URLs`);
  console.log(`   Deleted: ${deletedCount.toLocaleString()} URLs`);
  
  // Show top domains removed
  const sortedDomains = Object.entries(domainsFound)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  if (sortedDomains.length > 0) {
    console.log(`\n📊 Top outlier domains removed:`);
    for (const [domain, count] of sortedDomains) {
      console.log(`   ${domain}: ${count.toLocaleString()} URLs`);
    }
  }
}

cleanupOutlierUrls().catch(console.error);

