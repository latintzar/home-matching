/**
 * Cleanup URLs WITH LOGGING
 * 
 * Same as cleanup-urls-fast.ts but saves deleted URLs to CSV.
 * 
 * Usage:
 *   npx tsx src/harvest/cleanup-urls-with-log.ts
 *   npx tsx src/harvest/cleanup-urls-with-log.ts --dry-run
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TOTAL_SEGMENTS = 10;
const BATCH_DELETE_SIZE = 25;

// Pattern categories for logging
const BLOCKLIST_CATEGORIES: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: 'blogs_news',
    patterns: [/\/blog/i, /\/noticias/i, /\/news/i, /\/articulo/i, /\/article/i, /\/posts?\//i],
  },
  {
    name: 'wordpress',
    patterns: [/\/wp-content/i, /\/wp-includes/i, /\/wp-admin/i, /\/admin\//i],
  },
  {
    name: 'taxonomy',
    patterns: [/\/tag\//i, /\/tags\//i, /\/category/i, /\/categoria/i, /\/author/i, /\/autor/i],
  },
  {
    name: 'auth',
    patterns: [/\/login/i, /\/registro/i, /\/register/i, /\/signin/i, /\/signup/i],
  },
  {
    name: 'static_files',
    patterns: [/\/feed\/?$/i, /\/rss/i, /\.(jpg|jpeg|png|gif|pdf|css|js|xml)$/i],
  },
  {
    name: 'contact_about',
    patterns: [
      /\/contacto?\/?$/i, /\/contact\/?$/i, /\/about\/?$/i, /\/nosotros\/?$/i,
      /\/quienes-somos/i, /\/sobre-nosotros/i, /\/equipo\/?$/i, /\/team\/?$/i,
    ],
  },
  {
    name: 'legal',
    patterns: [
      /\/privacy/i, /\/privacidad/i, /\/legal/i, /\/cookies/i, /\/aviso-legal/i,
      /\/terms/i, /\/condiciones/i,
    ],
  },
  {
    name: 'search_sitemap',
    patterns: [/\/search\/?$/i, /\/buscar\/?$/i, /\/sitemap/i],
  },
  {
    name: 'faq_help',
    patterns: [/\/faq/i, /\/help/i, /\/ayuda/i],
  },
  {
    name: 'agent_profiles',
    patterns: [/\/real-estate-agent\//i, /\/agente\//i, /\/agent\//i, /\/agents\/?$/i, /\/agentes\/?$/i],
  },
  {
    name: 'gambling_spam',
    patterns: [/\/tragaperras/i, /\/apuestas/i, /\/casino/i, /\/slots/i, /\/poker/i, /\/ruleta/i],
  },
  {
    name: 'services',
    patterns: [/\/servicios\/?$/i, /\/services\/?$/i, /\/valoracion/i, /\/tasacion/i],
  },
  {
    name: 'property_taxonomy',
    patterns: [/\/property_features/i, /\/property_types/i, /\/property-type/i],
  },
  {
    name: 'publish_submit',
    patterns: [/\/publica/i, /\/publicar/i, /\/submit/i, /\/anunciar/i],
  },
  {
    name: 'newsletter',
    patterns: [/\/newsletter/i, /\/subscribe/i, /\/suscribir/i],
  },
  {
    name: 'careers',
    patterns: [/\/careers/i, /\/empleo/i, /\/trabaja/i, /\/jobs/i],
  },
];

function categorizeUrl(url: string): string | null {
  for (const category of BLOCKLIST_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(url)) {
        return category.name;
      }
    }
  }
  return null;
}

interface DeletedUrl {
  url: string;
  domain: string;
  category: string;
}

async function scanSegment(
  segment: number,
  dryRun: boolean
): Promise<{ scanned: number; deleted: number; deletedUrls: DeletedUrl[] }> {
  let scanned = 0;
  let deleted = 0;
  const deletedUrls: DeletedUrl[] = [];
  let lastKey: any = undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#u, #d',
      ExpressionAttributeNames: { '#u': 'url', '#d': 'domain' },
      Segment: segment,
      TotalSegments: TOTAL_SEGMENTS,
      ExclusiveStartKey: lastKey,
    }));
    
    lastKey = result.LastEvaluatedKey;
    const items = result.Items || [];
    scanned += items.length;
    
    // Collect URLs to delete with their categories
    const toDelete: Array<{ url: string; domain: string; category: string }> = [];
    for (const item of items) {
      const url = item.url as string;
      const domain = (item.domain as string) || '';
      const category = categorizeUrl(url);
      
      if (category) {
        toDelete.push({ url, domain, category });
        deletedUrls.push({ url, domain, category });
      }
    }
    
    // Batch delete (unless dry run)
    if (!dryRun) {
      for (let i = 0; i < toDelete.length; i += BATCH_DELETE_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_DELETE_SIZE);
        try {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              'leo-urls': batch.map(item => ({
                DeleteRequest: { Key: { url: item.url } }
              }))
            }
          }));
          deleted += batch.length;
        } catch (e) {
          // Skip on error
          console.error(`  Batch delete error: ${(e as Error).message}`);
        }
      }
    } else {
      deleted += toDelete.length;
    }
    
  } while (lastKey);
  
  return { scanned, deleted, deletedUrls };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log(`\n🧹 URL Cleanup ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`   Parallel segments: ${TOTAL_SEGMENTS}`);
  console.log('='.repeat(60) + '\n');
  
  const startTime = Date.now();
  
  // Run all segments in parallel
  const promises = Array.from({ length: TOTAL_SEGMENTS }, (_, i) => 
    scanSegment(i, dryRun)
  );
  const results = await Promise.all(promises);
  
  // Aggregate results
  const totalScanned = results.reduce((s, r) => s + r.scanned, 0);
  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  const allDeletedUrls = results.flatMap(r => r.deletedUrls);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Count by category
  const byCategory: Record<string, number> = {};
  for (const item of allDeletedUrls) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  }
  
  // Save log to CSV
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const logPath = path.join(process.cwd(), 'data', `cleanup_log_${timestamp}.csv`);
  
  const csvContent = [
    'url,domain,category',
    ...allDeletedUrls.map(u => `"${u.url}","${u.domain}","${u.category}"`)
  ].join('\n');
  
  fs.writeFileSync(logPath, csvContent);
  console.log(`📝 Log saved: ${logPath}`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`✅ CLEANUP ${dryRun ? '(DRY RUN) ' : ''}COMPLETE`);
  console.log('='.repeat(60));
  console.log(`   Scanned:   ${totalScanned.toLocaleString()}`);
  console.log(`   Deleted:   ${totalDeleted.toLocaleString()}`);
  console.log(`   Remaining: ${(totalScanned - totalDeleted).toLocaleString()}`);
  console.log(`   Duration:  ${duration}s`);
  
  console.log('\n📊 Deletions by Category:');
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`   ${count.toString().padStart(8)} - ${cat}`);
  }
  
  // Summary JSON
  const summaryPath = path.join(process.cwd(), 'data', `cleanup_summary_${timestamp}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    scanned: totalScanned,
    deleted: totalDeleted,
    remaining: totalScanned - totalDeleted,
    durationSeconds: parseFloat(duration),
    byCategory,
  }, null, 2));
  
  console.log(`\n📋 Summary saved: ${summaryPath}`);
}

main().catch(e => { 
  console.error('❌ Error:', e.message); 
  process.exit(1); 
});

