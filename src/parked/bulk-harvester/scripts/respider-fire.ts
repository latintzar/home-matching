/**
 * RESPIDER FIRE - Simple fire-and-forget
 * 
 * Just fires the Lambdas and exits. Check results later with build-domain-stats.ts
 * 
 * Run: npx tsx scripts/respider-fire.ts
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const REGION = process.env.AWS_REGION || 'us-east-1';
const lambda = new LambdaClient({ region: REGION });

// Priority domains with their pass counts
const DOMAINS_TO_SPIDER: Array<{ domain: string; passes: number; tier: string }> = [
  // TIER 1: Major agencies - 3 passes
  { domain: 'century21.es', passes: 3, tier: 'TIER1' },
  { domain: 'remax.es', passes: 3, tier: 'TIER1' },
  { domain: 'remaxpremium.es', passes: 3, tier: 'TIER1' },
  { domain: 'remaxcasaelite.es', passes: 3, tier: 'TIER1' },
  { domain: 'tecnicasa.net', passes: 3, tier: 'TIER1' },
  { domain: 'andorra-sothebysrealty.com', passes: 3, tier: 'TIER1' },
  
  // TIER 1B: Never crawled - 1 pass
  { domain: 'engelvoelkers.com', passes: 1, tier: 'TIER1B' },
  { domain: 'housfy.com', passes: 1, tier: 'TIER1B' },
  { domain: 'grocasa.com', passes: 1, tier: 'TIER1B' },
  { domain: 'kwspain.es', passes: 1, tier: 'TIER1B' },
  
  // TIER 2: Low listings - 2 passes
  { domain: 'savills.es', passes: 2, tier: 'TIER2' },
  { domain: 'coldwellbanker.es', passes: 2, tier: 'TIER2' },
  
  // TIER 3: High URL count - 1 pass
  { domain: 'gestinfer.es', passes: 1, tier: 'TIER3' },
  { domain: 'elgi.es', passes: 1, tier: 'TIER3' },
  { domain: 'vincent-realestate.com', passes: 1, tier: 'TIER3' },
  { domain: 'castilloproperties.es', passes: 1, tier: 'TIER3' },
  { domain: 'vibeinmobiliaria.com', passes: 1, tier: 'TIER3' },
  { domain: 'inmobiliariacalidad.com', passes: 1, tier: 'TIER3' },
  { domain: 'vallesdelpirineo.com', passes: 1, tier: 'TIER3' },
  { domain: 'manuelaperez.com', passes: 1, tier: 'TIER3' },
  { domain: 'impulsoinmobiliario.com', passes: 1, tier: 'TIER3' },
  { domain: 'tenerife-inmobiliarias.es', passes: 1, tier: 'TIER3' },
];

async function fireSpider(domain: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: 'spider-single',
    InvocationType: 'Event',  // Async - fire and forget
    Payload: Buffer.from(JSON.stringify({ domain })),
  }));
}

async function main() {
  console.log('🕷️  RESPIDER FIRE - Priority Domains\n');
  
  // Build invocation list
  const invocations: Array<{ domain: string; pass: number }> = [];
  for (const { domain, passes } of DOMAINS_TO_SPIDER) {
    for (let pass = 1; pass <= passes; pass++) {
      invocations.push({ domain, pass });
    }
  }
  
  console.log(`📋 Plan: ${invocations.length} Lambda invocations`);
  console.log(`   ${DOMAINS_TO_SPIDER.filter(d => d.tier === 'TIER1').length} major agencies × 3 passes`);
  console.log(`   ${DOMAINS_TO_SPIDER.filter(d => d.tier === 'TIER1B').length} never crawled × 1 pass`);
  console.log(`   ${DOMAINS_TO_SPIDER.filter(d => d.tier === 'TIER2').length} low listings × 2 passes`);
  console.log(`   ${DOMAINS_TO_SPIDER.filter(d => d.tier === 'TIER3').length} high URL count × 1 pass`);
  
  const startTime = Date.now();
  
  // Fire all at once (they'll queue in AWS)
  console.log(`\n⚡ Firing ${invocations.length} Lambdas...`);
  
  let fired = 0;
  for (const inv of invocations) {
    await fireSpider(inv.domain);
    fired++;
    if (fired % 10 === 0) {
      process.stdout.write(`\r   Fired ${fired}/${invocations.length}`);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ All ${fired} Lambdas fired in ${elapsed}s`);
  
  console.log(`
📊 Lambdas are now running in AWS (up to 400 concurrent).
   Each Lambda runs for ~4.5 min max, crawling up to 2000 pages.
   
   Expected completion: ~5-10 minutes

🔍 To check results, wait 5-10 min then run:
   npx tsx scripts/build-domain-stats.ts
   
   Or check a specific domain:
   aws dynamodb get-item --table-name leo-domain-stats --key '{"domain":{"S":"century21.es"}}'
`);
}

main().catch(console.error);

