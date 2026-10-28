
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// --- Configuration ---
const ANALYZED_CSV = 'data/agencies_analyzed.csv';
const SITEMAPS_CSV = 'data/agencies_sitemaps.csv';
const HARVEST_CSV = 'domains_cse.csv';
const OUTPUT_CSV = 'data/MASTER_AGENCY_LIST.csv';

// --- Interfaces ---
interface AnalyzedRecord {
  domain: string;
  url: string;
  title: string;
  email: string;
  phone: string;
  isLikelyAgency: string; // 'YES' | 'NO'
  socialLinks: string;
  poweredBy: string;
}

interface SitemapRecord {
  domain: string;
  sitemap_found: string; // 'YES' | 'NO'
  sitemap_url: string;
}

interface HarvestRecord {
  Domain: string;
  Snippet: string;
  SourceQuery: string;
}

// --- Main Script ---
async function main() {
  console.log('🔄 Merging datasets into MASTER LIST...');

  // 1. Load Data
  console.log('📖 Reading files...');
  
  const analyzed: AnalyzedRecord[] = parse(fs.readFileSync(ANALYZED_CSV, 'utf-8'), { 
    columns: true, skip_empty_lines: true, relax_quotes: true 
  });
  
  const sitemaps: SitemapRecord[] = parse(fs.readFileSync(SITEMAPS_CSV, 'utf-8'), { 
    columns: true, skip_empty_lines: true, relax_quotes: true 
  });
  
  const harvest: HarvestRecord[] = parse(fs.readFileSync(HARVEST_CSV, 'utf-8'), { 
    columns: true, skip_empty_lines: true, relax_quotes: true 
  });

  // 2. Index Data for O(1) Lookup
  const sitemapMap = new Map(sitemaps.map(r => [r.domain, r]));
  const harvestMap = new Map(harvest.map(r => [r.Domain, r]));

  // 3. Merge
  console.log('🔗 Linking records...');
  
  const masterList = analyzed.map(record => {
    const sitemap = sitemapMap.get(record.domain);
    const harvestInfo = harvestMap.get(record.domain);

    // Filter Logic:
    // We want to verify if it's a real agency.
    // Logic: isLikelyAgency == 'YES' OR (sitemap_found == 'YES' AND snippet contains keywords)
    
    return {
      domain: record.domain,
      url: record.url,
      title: record.title || '',
      email: record.email || '',
      phone: record.phone || '',
      social_links: record.socialLinks || '',
      platform: record.poweredBy || '',
      
      // Validation
      is_likely_agency: record.isLikelyAgency,
      
      // Scrape Feasibility
      sitemap_found: sitemap?.sitemap_found || 'NO',
      sitemap_url: sitemap?.sitemap_url || '',
      
      // Context
      source_query: harvestInfo?.SourceQuery || '',
      snippet: harvestInfo?.Snippet || ''
    };
  });

  // 4. Sort: High Value First (Likely Agency AND Sitemap Found)
  masterList.sort((a, b) => {
    const scoreA = (a.is_likely_agency === 'YES' ? 2 : 0) + (a.sitemap_found === 'YES' ? 1 : 0);
    const scoreB = (b.is_likely_agency === 'YES' ? 2 : 0) + (b.sitemap_found === 'YES' ? 1 : 0);
    return scoreB - scoreA;
  });

  // 5. Write Output
  console.log(`💾 Writing ${masterList.length} records to ${OUTPUT_CSV}...`);
  const csvContent = stringify(masterList, { header: true });
  fs.writeFileSync(OUTPUT_CSV, csvContent);

  // 6. Stats
  const highValue = masterList.filter(r => r.is_likely_agency === 'YES' && r.sitemap_found === 'YES').length;
  const validAgencies = masterList.filter(r => r.is_likely_agency === 'YES').length;
  
  console.log(`
✅ MERGE COMPLETE
-----------------
Total Records: ${masterList.length}
Valid Agencies: ${validAgencies} (Based on homepage analysis)
High Value Targets: ${highValue} (Valid Agency + Sitemap)
  `);
}

main().catch(console.error);

