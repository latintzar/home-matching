/**
 * Fast URL Cleanup
 * 
 * Uses parallel scanning and batch deletes.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TOTAL_SEGMENTS = 10; // Parallel scan segments
const BATCH_DELETE_SIZE = 25; // DynamoDB limit

// BLOCKLIST
const BLOCKLIST_PATTERNS = [
  /\/blog/i, /\/noticias/i, /\/news/i, /\/articulo/i, /\/article/i, /\/posts?\//i,
  /\/wp-content/i, /\/wp-includes/i, /\/wp-admin/i, /\/admin\//i,
  /\/tag\//i, /\/tags\//i, /\/category/i, /\/categoria/i, /\/author/i, /\/autor/i,
  /\/login/i, /\/registro/i, /\/register/i, /\/signin/i, /\/signup/i,
  /\/feed\/?$/i, /\/rss/i, /\.(jpg|jpeg|png|gif|pdf|css|js|xml)$/i,
  /\/contacto?\/?$/i, /\/contact\/?$/i, /\/about\/?$/i, /\/nosotros\/?$/i,
  /\/quienes-somos/i, /\/sobre-nosotros/i, /\/equipo\/?$/i, /\/team\/?$/i,
  /\/privacy/i, /\/privacidad/i, /\/legal/i, /\/cookies/i, /\/aviso-legal/i,
  /\/terms/i, /\/condiciones/i, /\/search\/?$/i, /\/buscar\/?$/i, /\/sitemap/i,
  /\/faq/i, /\/help/i, /\/ayuda/i,
  /\/real-estate-agent\//i, /\/agente\//i, /\/agent\//i, /\/agents\/?$/i, /\/agentes\/?$/i,
  /\/tragaperras/i, /\/apuestas/i, /\/casino/i, /\/slots/i, /\/poker/i, /\/ruleta/i,
  /\/servicios\/?$/i, /\/services\/?$/i, /\/valoracion/i, /\/tasacion/i,
  /\/property_features/i, /\/property_types/i, /\/property-type/i,
  /\/publica/i, /\/publicar/i, /\/submit/i, /\/anunciar/i,
  /\/newsletter/i, /\/subscribe/i, /\/suscribir/i,
  /\/careers/i, /\/empleo/i, /\/trabaja/i, /\/jobs/i,
];

function shouldDelete(url: string): boolean {
  return BLOCKLIST_PATTERNS.some(p => p.test(url));
}

async function scanSegment(segment: number): Promise<{ scanned: number; deleted: number }> {
  let scanned = 0;
  let deleted = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#u',
      ExpressionAttributeNames: { '#u': 'url' },
      Segment: segment,
      TotalSegments: TOTAL_SEGMENTS,
      ExclusiveStartKey: lastKey,
    }));
    
    lastKey = result.LastEvaluatedKey;
    const items = result.Items || [];
    scanned += items.length;
    
    // Collect URLs to delete
    const toDelete: string[] = [];
    for (const item of items) {
      if (shouldDelete(item.url as string)) {
        toDelete.push(item.url as string);
      }
    }
    
    // Batch delete
    for (let i = 0; i < toDelete.length; i += BATCH_DELETE_SIZE) {
      const batch = toDelete.slice(i, i + BATCH_DELETE_SIZE);
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            'leo-urls': batch.map(url => ({
              DeleteRequest: { Key: { url } }
            }))
          }
        }));
        deleted += batch.length;
      } catch (e) {
        // Retry individually on failure
        for (const url of batch) {
          try {
            await docClient.send(new BatchWriteCommand({
              RequestItems: { 'leo-urls': [{ DeleteRequest: { Key: { url } } }] }
            }));
            deleted++;
          } catch {}
        }
      }
    }
    
  } while (lastKey);
  
  return { scanned, deleted };
}

async function main() {
  console.log(`🧹 Fast cleanup with ${TOTAL_SEGMENTS} parallel segments...\n`);
  const startTime = Date.now();
  
  // Run all segments in parallel
  const promises = Array.from({ length: TOTAL_SEGMENTS }, (_, i) => scanSegment(i));
  const results = await Promise.all(promises);
  
  const totalScanned = results.reduce((s, r) => s + r.scanned, 0);
  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(50));
  console.log(`   Scanned:   ${totalScanned.toLocaleString()}`);
  console.log(`   Deleted:   ${totalDeleted.toLocaleString()}`);
  console.log(`   Remaining: ${(totalScanned - totalDeleted).toLocaleString()}`);
  console.log(`   Duration:  ${duration}s`);
}

main().catch(e => { console.error(e); process.exit(1); });

