/**
 * Harvest Orchestrator
 * 
 * Coordinates the phased harvest testing and sends alerts.
 * Phases: 10 domains → 100 domains → 1000 domains → full harvest
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { mapSitemap, mapSitemapsBatch, SitemapMapperResult } from './sitemap-mapper';
import { spiderDomain, spiderDomainsBatch, SpiderResult } from './spider-crawler';
import { sendPhaseCompleteAlert, sendErrorAlert, PhaseResult } from './alerts';
import { HARVEST_CONFIG } from './config';

interface DomainRecord {
  domain: string;
  sitemapUrl?: string;
  hasSitemap: boolean;
}

/**
 * Load domains from CSV
 */
function loadDomains(): DomainRecord[] {
  const csvPath = path.join(process.cwd(), 'data', 'agencies_sitemaps.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  
  return records.map((r: any) => ({
    domain: r.domain,
    sitemapUrl: r.sitemap_url || undefined,
    hasSitemap: r.sitemap_found === 'YES',
  }));
}

/**
 * Run a harvest phase
 */
export async function runPhase(
  phaseName: string,
  domainCount: number | 'all',
  options: { dryRun?: boolean } = {}
): Promise<PhaseResult> {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 Starting ${phaseName}`);
  console.log(`   Domains: ${domainCount === 'all' ? 'ALL' : domainCount}`);
  console.log(`   Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log('='.repeat(70) + '\n');
  
  try {
    // Load all domains
    const allDomains = loadDomains();
    console.log(`📋 Loaded ${allDomains.length} domains from CSV`);
    
    // Select domains for this phase
    const count = domainCount === 'all' ? allDomains.length : domainCount;
    const selectedDomains = allDomains.slice(0, count);
    
    // Split by sitemap vs spider
    const sitemapDomains = selectedDomains.filter(d => d.hasSitemap && d.sitemapUrl);
    const spiderDomains = selectedDomains.filter(d => !d.hasSitemap || !d.sitemapUrl);
    
    console.log(`\n📊 Phase breakdown:`);
    console.log(`   Sitemap domains: ${sitemapDomains.length}`);
    console.log(`   Spider domains:  ${spiderDomains.length}`);
    
    let totalPages = 0;
    let totalListings = 0;
    let truncated = 0;
    let errors = 0;
    
    // Phase 1A: Map sitemaps
    if (sitemapDomains.length > 0) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📍 Phase 1A: Mapping ${sitemapDomains.length} sitemaps...`);
      console.log('─'.repeat(70));
      
      const sitemapResults = await mapSitemapsBatch(
        sitemapDomains.map(d => ({ domain: d.domain, sitemapUrl: d.sitemapUrl! })),
        { dryRun: options.dryRun, concurrency: 5 }
      );
      
      for (const r of sitemapResults) {
        totalPages += 1; // Sitemap itself
        totalListings += r.savedUrls;
        if (r.status === 'error') errors++;
      }
      
      console.log(`\n✅ Sitemaps complete: ${sitemapResults.filter(r => r.status === 'success').length} success, ${errors} errors`);
    }
    
    // Phase 1B: Spider non-sitemap domains
    if (spiderDomains.length > 0) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🕷️ Phase 1B: Spidering ${spiderDomains.length} domains...`);
      console.log('─'.repeat(70));
      
      const spiderResults = await spiderDomainsBatch(
        spiderDomains.map(d => d.domain),
        { dryRun: options.dryRun, concurrency: 3 }
      );
      
      for (const r of spiderResults) {
        totalPages += r.pagesVisited;
        totalListings += r.pagesSaved;
        if (r.status === 'truncated') truncated++;
        if (r.status === 'error') errors++;
      }
      
      const complete = spiderResults.filter(r => r.status === 'complete').length;
      console.log(`\n✅ Spider complete: ${complete} complete, ${truncated} truncated, ${errors} errors`);
    }
    
    // Calculate results
    const durationMs = Date.now() - startTime;
    const durationMinutes = durationMs / 60000;
    
    // Estimate cost (rough calculation)
    const lambdaGbSeconds = totalPages * 3 * 0.5; // 3 sec per page, 512MB
    const lambdaCost = lambdaGbSeconds * 0.0000166667;
    const s3PutCost = (totalListings / 1000) * 0.005;
    const estimatedCost = lambdaCost + s3PutCost;
    
    const phaseResult: PhaseResult = {
      phase: phaseName,
      domainsProcessed: selectedDomains.length,
      pagesDownloaded: totalPages,
      listingsFound: totalListings,
      truncatedDomains: truncated,
      errors,
      durationMinutes,
      estimatedCost,
    };
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log(`✅ ${phaseName} COMPLETE`);
    console.log('='.repeat(70));
    console.log(`   Domains processed:  ${phaseResult.domainsProcessed}`);
    console.log(`   Pages downloaded:   ${phaseResult.pagesDownloaded.toLocaleString()}`);
    console.log(`   Listings found:     ${phaseResult.listingsFound.toLocaleString()}`);
    console.log(`   Truncated domains:  ${phaseResult.truncatedDomains}`);
    console.log(`   Errors:             ${phaseResult.errors}`);
    console.log(`   Duration:           ${phaseResult.durationMinutes.toFixed(1)} minutes`);
    console.log(`   Estimated cost:     $${phaseResult.estimatedCost.toFixed(2)}`);
    console.log('='.repeat(70) + '\n');
    
    // Send email alert
    if (!options.dryRun) {
      await sendPhaseCompleteAlert(phaseResult);
    }
    
    return phaseResult;
    
  } catch (error: any) {
    console.error(`\n❌ ${phaseName} FAILED: ${error.message}`);
    
    if (!options.dryRun) {
      await sendErrorAlert(phaseName, error.message);
    }
    
    throw error;
  }
}

/**
 * Run all phases sequentially with user confirmation between phases
 */
export async function runFullHarvest(options: { dryRun?: boolean } = {}): Promise<void> {
  console.log('\n' + '🌟'.repeat(35));
  console.log('   LEO HARVEST - FULL RUN');
  console.log('🌟'.repeat(35) + '\n');
  
  // Phase 1: 10 domains
  console.log('📌 Starting Phase 1: 10 domains (test)');
  await runPhase('Phase 1: 10 domains', 10, options);
  
  // Phase 2: 100 domains
  console.log('\n📌 Starting Phase 2: 100 domains');
  await runPhase('Phase 2: 100 domains', 100, options);
  
  // Phase 3: 1000 domains
  console.log('\n📌 Starting Phase 3: 1000 domains');
  await runPhase('Phase 3: 1000 domains', 1000, options);
  
  // Phase 4: All domains
  console.log('\n📌 Starting Phase 4: Full harvest');
  await runPhase('Phase 4: Full Harvest', 'all', options);
  
  console.log('\n' + '🎉'.repeat(35));
  console.log('   HARVEST COMPLETE!');
  console.log('🎉'.repeat(35) + '\n');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const phase = args.find(a => a.startsWith('--phase='))?.split('=')[1];
  
  console.log('🌱 Leo Harvest Orchestrator');
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Phase: ${phase || 'all'}`);
  
  let promise: Promise<any>;
  
  if (phase === '1') {
    promise = runPhase('Phase 1: 10 domains', 10, { dryRun });
  } else if (phase === '2') {
    promise = runPhase('Phase 2: 100 domains', 100, { dryRun });
  } else if (phase === '3') {
    promise = runPhase('Phase 3: 1000 domains', 1000, { dryRun });
  } else if (phase === '4' || phase === 'full') {
    promise = runPhase('Phase 4: Full Harvest', 'all', { dryRun });
  } else {
    promise = runFullHarvest({ dryRun });
  }
  
  promise
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((e) => {
      console.error('\n❌ Failed:', e.message);
      process.exit(1);
    });
}

