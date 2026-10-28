/**
 * Cleanup URLs Lambda
 * 
 * Fast parallel cleanup running in AWS.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// COMPREHENSIVE BLOCKLIST - Keep in sync with src/harvest/config.ts
// NOTE: Contact/About pages are KEPT (not blocked) - they may have useful agency info
const BLOCKLIST_PATTERNS = [
  // Blogs & News & Articles
  /\/blog/i, /\/noticias/i, /\/noticia\//i, /\/news/i, /\/articulo/i, /\/article/i, /\/posts?\//i,
  
  // WordPress system files
  /\/wp-content/i, /\/wp-includes/i, /\/wp-admin/i, /\/admin\//i,
  
  // Taxonomy/Archive pages
  /\/tag\//i, /\/tags\//i, /\/category/i, /\/categoria/i, /\/author/i, /\/autor/i,
  
  // Auth pages
  /\/login/i, /\/registro/i, /\/register/i, /\/signin/i, /\/signup/i,
  
  // Static files & feeds
  /\/feed\/?$/i, /\/rss/i, /\.(jpg|jpeg|png|gif|pdf|css|js|xml|ico|svg)$/i,
  
  // Legal (not listings)
  /\/privacy/i, /\/privacidad/i, /\/cookies/i, /\/aviso-legal/i,
  /\/terms/i, /\/condiciones/i, /\/legal\/?$/i,
  
  // Search & Sitemap
  /\/search\/?$/i, /\/buscar\/?$/i, /\/sitemap/i,
  
  // FAQs & Help
  /\/faq/i, /\/help\/?$/i, /\/ayuda/i,
  
  // Agent profiles (not property listings)
  /\/real-estate-agent\//i, /\/agente\//i, /\/agent\//i, /\/agents\/?$/i, /\/agentes\/?$/i,
  
  // 🎰 GAMBLING SPAM (HIGH PRIORITY!)
  /\/tragaperras/i, /\/apuestas/i, /\/casino/i, /\/slots/i, /\/poker/i, /\/ruleta/i,
  /\/blackjack/i, /\/jackpot/i, /gunsbet/i, /content_id=.*[A-Z]{4,}/i,
  
  // Services pages (not listings)
  /\/servicios\/?$/i, /\/services\/?$/i, /\/valoracion/i, /\/tasacion/i,
  
  // Property taxonomy (not actual listings)
  /\/property_features/i, /\/property_types/i, /\/property-type/i,
  
  // Publish/Submit forms
  /\/publica/i, /\/publicar/i, /\/submit/i, /\/anunciar/i,
  
  // Newsletter/Social
  /\/newsletter/i, /\/subscribe/i, /\/suscribir/i,
  
  // Careers
  /\/careers/i, /\/empleo/i, /\/trabaja/i, /\/jobs/i,
];

function shouldDelete(url: string): boolean {
  return BLOCKLIST_PATTERNS.some(p => p.test(url));
}

interface LambdaEvent {
  segment: number;
  totalSegments: number;
}

export async function handler(event: LambdaEvent) {
  const { segment, totalSegments } = event;
  console.log(`Segment ${segment}/${totalSegments} starting...`);
  
  let scanned = 0;
  let deleted = 0;
  let lastKey: any = undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#u',
      ExpressionAttributeNames: { '#u': 'url' },
      Segment: segment,
      TotalSegments: totalSegments,
      ExclusiveStartKey: lastKey,
    }));
    
    lastKey = result.LastEvaluatedKey;
    const items = result.Items || [];
    scanned += items.length;
    
    // Collect URLs to delete
    const toDelete = items.filter(i => shouldDelete(i.url as string)).map(i => i.url as string);
    
    // Batch delete (25 at a time)
    for (let i = 0; i < toDelete.length; i += 25) {
      const batch = toDelete.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          'leo-urls': batch.map(url => ({ DeleteRequest: { Key: { url } } }))
        }
      }));
      deleted += batch.length;
    }
    
  } while (lastKey);
  
  console.log(`Segment ${segment}: scanned=${scanned}, deleted=${deleted}`);
  return { segment, scanned, deleted };
}

