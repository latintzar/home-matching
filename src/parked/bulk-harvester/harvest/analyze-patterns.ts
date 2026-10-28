/**
 * Analyze URL patterns per domain
 * 
 * Find sale/rent patterns for each domain.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const SALE_PATTERNS = [
  /venta/i, /comprar/i, /sale/i, /for-sale/i, /en-venta/i, /kaufen/i, /verkauf/i, /a-vendre/i
];

const RENT_PATTERNS = [
  /alquiler/i, /rent/i, /arrendar/i, /en-alquiler/i, /miete/i, /location/i, /for-rent/i
];

interface DomainStats {
  total: number;
  sale: number;
  rent: number;
  unknown: number;
  sampleUrls: string[];
}

async function analyze() {
  console.log('📊 Analyzing URL patterns per domain...\n');
  
  const domainStats: Record<string, DomainStats> = {};
  let lastKey: any = undefined;
  let scanned = 0;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#u, #d',
      ExpressionAttributeNames: { '#u': 'url', '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    lastKey = result.LastEvaluatedKey;
    scanned += result.Items?.length || 0;
    
    for (const item of result.Items || []) {
      const url = item.url as string;
      const domain = item.domain as string;
      
      if (!domainStats[domain]) {
        domainStats[domain] = { total: 0, sale: 0, rent: 0, unknown: 0, sampleUrls: [] };
      }
      
      const stats = domainStats[domain];
      stats.total++;
      
      const isSale = SALE_PATTERNS.some(p => p.test(url));
      const isRent = RENT_PATTERNS.some(p => p.test(url));
      
      if (isSale) stats.sale++;
      else if (isRent) stats.rent++;
      else stats.unknown++;
      
      // Keep sample URLs
      if (stats.sampleUrls.length < 3) {
        stats.sampleUrls.push(url);
      }
    }
    
    if (scanned % 50000 === 0) {
      console.log(`  Scanned: ${scanned.toLocaleString()}`);
    }
    
  } while (lastKey);
  
  // Summary
  const domains = Object.entries(domainStats).sort((a, b) => b[1].total - a[1].total);
  
  console.log('\n' + '='.repeat(80));
  console.log('TOP 50 DOMAINS BY URL COUNT');
  console.log('='.repeat(80));
  console.log('Domain                                    | Total   | Sale    | Rent    | Unknown');
  console.log('-'.repeat(80));
  
  for (const [domain, stats] of domains.slice(0, 50)) {
    console.log(
      `${domain.padEnd(40)} | ${stats.total.toString().padStart(7)} | ${stats.sale.toString().padStart(7)} | ${stats.rent.toString().padStart(7)} | ${stats.unknown.toString().padStart(7)}`
    );
  }
  
  // Overall stats
  const totalUrls = domains.reduce((s, [, st]) => s + st.total, 0);
  const totalSale = domains.reduce((s, [, st]) => s + st.sale, 0);
  const totalRent = domains.reduce((s, [, st]) => s + st.rent, 0);
  const totalUnknown = domains.reduce((s, [, st]) => s + st.unknown, 0);
  
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total domains: ${domains.length}`);
  console.log(`Total URLs:    ${totalUrls.toLocaleString()}`);
  console.log(`Sale URLs:     ${totalSale.toLocaleString()} (${(totalSale/totalUrls*100).toFixed(1)}%)`);
  console.log(`Rent URLs:     ${totalRent.toLocaleString()} (${(totalRent/totalUrls*100).toFixed(1)}%)`);
  console.log(`Unknown:       ${totalUnknown.toLocaleString()} (${(totalUnknown/totalUrls*100).toFixed(1)}%)`);
}

analyze().catch(console.error);

