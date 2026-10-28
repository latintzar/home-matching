/**
 * Run Sitemaps Only
 * 
 * Process only domains that have sitemaps (faster, more reliable).
 * Skip spider domains entirely.
 * 
 * Usage:
 *   npx tsx src/harvest/run-sitemaps-only.ts
 *   npx tsx src/harvest/run-sitemaps-only.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { mapSitemapsBatch, SitemapMapperResult } from './sitemap-mapper';
import { sendPhaseCompleteAlert, PhaseResult } from './alerts';
import { HARVEST_CONFIG } from './config';

interface DomainRecord {
  domain: string;
  sitemapUrl?: string;
  hasSitemap: boolean;
}

function loadSitemapDomains(): DomainRecord[] {
  const csvPath = path.join(process.cwd(), 'data', 'agencies_sitemaps.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  
  // Only return domains WITH sitemaps
  return records
    .filter((r: any) => r.sitemap_found === 'YES' && r.sitemap_url)
    .map((r: any) => ({
      domain: r.domain,
      sitemapUrl: r.sitemap_url,
      hasSitemap: true,
    }));
}

async function runSitemapsOnly(options: { dryRun?: boolean } = {}): Promise<void> {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(70));
  console.log('🗺️  SITEMAP-ONLY HARVEST');
  console.log('='.repeat(70));
  console.log(`   Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log('='.repeat(70) + '\n');
  
  // Load only sitemap domains
  const sitemapDomains = loadSitemapDomains();
  console.log(`📋 Loaded ${sitemapDomains.length} sitemap domains\n`);
  
  // Process in batches of 100 for progress updates
  const BATCH_SIZE = 100;
  let totalUrls = 0;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < sitemapDomains.length; i += BATCH_SIZE) {
    const batch = sitemapDomains.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(sitemapDomains.length / BATCH_SIZE);
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📍 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} sitemaps...`);
    console.log('─'.repeat(70));
    
    const results = await mapSitemapsBatch(
      batch.map(d => ({ domain: d.domain, sitemapUrl: d.sitemapUrl! })),
      { dryRun: options.dryRun, concurrency: 10 }
    );
    
    for (const r of results) {
      totalUrls += r.savedUrls;
      if (r.status === 'success') successCount++;
      else errorCount++;
    }
    
    console.log(`\n✅ Batch ${batchNum} complete: ${results.filter(r => r.status === 'success').length} success, ${results.filter(r => r.status === 'error').length} errors`);
    console.log(`📊 Running total: ${totalUrls.toLocaleString()} URLs saved`);
  }
  
  // Final summary
  const durationMs = Date.now() - startTime;
  const durationMinutes = durationMs / 60000;
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ SITEMAP HARVEST COMPLETE');
  console.log('='.repeat(70));
  console.log(`   Domains processed:  ${sitemapDomains.length}`);
  console.log(`   Success:            ${successCount}`);
  console.log(`   Errors:             ${errorCount}`);
  console.log(`   URLs saved:         ${totalUrls.toLocaleString()}`);
  console.log(`   Duration:           ${durationMinutes.toFixed(1)} minutes`);
  console.log('='.repeat(70) + '\n');
  
  // Send email notification
  if (!options.dryRun) {
    const phaseResult: PhaseResult = {
      phase: 'Sitemap-Only Harvest (All 1,087 domains)',
      domainsProcessed: sitemapDomains.length,
      pagesDownloaded: sitemapDomains.length, // Just the sitemaps themselves
      listingsFound: totalUrls,
      truncatedDomains: 0,
      errors: errorCount,
      durationMinutes,
      estimatedCost: 0.05, // Minimal cost for sitemap parsing
    };
    
    await sendPhaseCompleteAlert(phaseResult);
  }
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

runSitemapsOnly({ dryRun })
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Failed:', e.message);
    process.exit(1);
  });

