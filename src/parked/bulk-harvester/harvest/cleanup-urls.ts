/**
 * Cleanup URLs
 * 
 * Delete junk URLs from DynamoDB using improved blocklist.
 * Then analyze patterns per domain.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// IMPROVED BLOCKLIST
const BLOCKLIST_PATTERNS = [
  // Blogs & News
  /\/blog\//i,
  /\/blog$/i,
  /\/noticias\//i,
  /\/news\//i,
  /\/news$/i,
  /\/articulo\//i,
  /\/article\//i,
  /\/posts?\//i,
  
  // WordPress system
  /\/wp-content\//i,
  /\/wp-includes\//i,
  /\/wp-admin\//i,
  /\/admin\//i,
  
  // Taxonomy pages
  /\/tag\//i,
  /\/tags\//i,
  /\/category\//i,
  /\/categoria\//i,
  /\/author\//i,
  /\/autor\//i,
  
  // Auth pages
  /\/login/i,
  /\/registro/i,
  /\/register/i,
  /\/signin/i,
  /\/signup/i,
  
  // Feeds & static
  /\/feed\/?$/i,
  /\/rss/i,
  /\.(jpg|jpeg|png|gif|pdf|css|js|xml)$/i,
  
  // Contact & About (these are not listings)
  /\/contacto?\/?$/i,
  /\/contact\/?$/i,
  /\/about\/?$/i,
  /\/nosotros\/?$/i,
  /\/quienes-somos/i,
  /\/sobre-nosotros/i,
  /\/equipo\/?$/i,
  /\/team\/?$/i,
  
  // Legal
  /\/privacy/i,
  /\/privacidad/i,
  /\/legal/i,
  /\/cookies/i,
  /\/aviso-legal/i,
  /\/terms/i,
  /\/condiciones/i,
  
  // Search & Sitemap
  /\/search\/?$/i,
  /\/buscar\/?$/i,
  /\/sitemap/i,
  
  // FAQs & Help
  /\/faq/i,
  /\/help/i,
  /\/ayuda/i,
  
  // Agent profiles (not listings)
  /\/real-estate-agent\//i,
  /\/agente\//i,
  /\/agent\//i,
  /\/agents\/?$/i,
  /\/agentes\/?$/i,
  /\/equipo\//i,
  
  // Gambling/Casino spam (seen in data)
  /\/tragaperras/i,
  /\/apuestas/i,
  /\/casino/i,
  /\/slots/i,
  /\/poker/i,
  /\/ruleta/i,
  /\/blackjack/i,
  /\/jackpot/i,
  /gunsbet/i,
  /content_id=[A-Z]{3,}/i,  // laoliva.es spam pattern
  
  // Services pages (not listings)
  /\/servicios\/?$/i,
  /\/services\/?$/i,
  /\/valoracion/i,
  /\/tasacion/i,
  
  // Property features/tags (not actual listings)
  /\/property_features\//i,
  /\/property_types\//i,
  /\/property-type\//i,
  
  // Publish/Submit pages
  /\/publica/i,
  /\/publicar/i,
  /\/submit/i,
  /\/anunciar/i,
  
  // Social/Newsletter
  /\/newsletter/i,
  /\/subscribe/i,
  /\/suscribir/i,
  
  // Careers
  /\/careers/i,
  /\/empleo/i,
  /\/trabaja/i,
  /\/jobs/i,
];

function shouldDelete(url: string): boolean {
  return BLOCKLIST_PATTERNS.some(pattern => pattern.test(url));
}

async function cleanupUrls(): Promise<void> {
  console.log('🧹 Starting URL cleanup...\n');
  
  let scanned = 0;
  let deleted = 0;
  let lastEvaluatedKey: any = undefined;
  
  const deletedByPattern: Record<string, number> = {};
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-urls',
      ProjectionExpression: '#u',
      ExpressionAttributeNames: { '#u': 'url' },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 1000,
    }));
    
    lastEvaluatedKey = result.LastEvaluatedKey;
    const items = result.Items || [];
    scanned += items.length;
    
    // Find and delete junk URLs
    for (const item of items) {
      const url = item.url as string;
      
      if (shouldDelete(url)) {
        // Find which pattern matched (for stats)
        const matchedPattern = BLOCKLIST_PATTERNS.find(p => p.test(url));
        const patternKey = matchedPattern?.source.slice(0, 30) || 'unknown';
        deletedByPattern[patternKey] = (deletedByPattern[patternKey] || 0) + 1;
        
        try {
          await docClient.send(new DeleteCommand({
            TableName: 'leo-urls',
            Key: { url },
          }));
          deleted++;
        } catch (e) {
          // Skip errors
        }
      }
    }
    
    // Progress update
    if (scanned % 10000 === 0) {
      console.log(`  Scanned: ${scanned.toLocaleString()}, Deleted: ${deleted.toLocaleString()}`);
    }
    
  } while (lastEvaluatedKey);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`   URLs scanned: ${scanned.toLocaleString()}`);
  console.log(`   URLs deleted: ${deleted.toLocaleString()}`);
  console.log(`   URLs remaining: ${(scanned - deleted).toLocaleString()}`);
  console.log('\n📊 Deletions by pattern:');
  
  const sorted = Object.entries(deletedByPattern).sort((a, b) => b[1] - a[1]);
  for (const [pattern, count] of sorted.slice(0, 20)) {
    console.log(`   ${count.toString().padStart(6)} - ${pattern}`);
  }
}

// Run
cleanupUrls().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

