
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// --- Configuration ---
const MASTER_CSV = 'data/MASTER_AGENCY_LIST.csv';
const VOLUMETRICS_CSV = 'data/agency_sitemap_volumetrics.csv';

// --- Interfaces ---
interface MasterRecord {
  domain: string;
  title: string;
  snippet: string;
  source_query: string;
  platform: string;
}

interface VolumetricRecord {
  domain: string;
  total_urls: string; // CSV reads as string
  lastmod_7_days: string;
}

// --- Keywords ---
const CATEGORIES = {
  Luxury: ['luxury', 'lujo', 'exclusive', 'premium', 'alto standing', 'golden mile', 'sothebys', 'christies'],
  Coastal: ['costa', 'beach', 'mar', 'playa', 'sea', 'island', 'isla', 'tenerife', 'mallorca', 'ibiza', 'menorca', 'canarias', 'balears'],
  Rural: ['rural', 'finca', 'campo', 'rustica', 'pueblo', 'village', 'country'],
  Bank_Funds: ['servicer', 'fondo', 'banco', 'bank', 'repossessions', 'embargo', 'adjudicado'],
  International: ['international', 'overseas', 'invest', 'relocation', 'german', 'swedish', 'uk', 'russian']
};

const REGIONS = [
  'Madrid', 'Barcelona', 'Valencia', 'Alicante', 'Málaga', 'Sevilla', 'Baleares', 'Canarias', 
  'Murcia', 'Girona', 'Cádiz', 'Granada', 'Almería', 'Asturias', 'Coruña', 'Vizcaya'
];

async function main() {
  console.log('📊 Generating Agency Portfolio Report...');

  // 1. Load Data
  const master: MasterRecord[] = parse(fs.readFileSync(MASTER_CSV, 'utf-8'), { columns: true, skip_empty_lines: true });
  const volContent = fs.existsSync(VOLUMETRICS_CSV) ? fs.readFileSync(VOLUMETRICS_CSV, 'utf-8') : '';
  const volRecords: VolumetricRecord[] = volContent ? parse(volContent, { columns: true, skip_empty_lines: true }) : [];

  // Map volumetrics
  const volMap = new Map(volRecords.map(r => [r.domain, { 
    total: parseInt(r.total_urls) || 0,
    recent: parseInt(r.lastmod_7_days) || 0
  }]));

  // 2. Analysis Stats
  const stats = {
    total_agencies: master.length,
    with_sitemaps: volRecords.length,
    by_size: { small: 0, medium: 0, large: 0, huge: 0 }, // <50, 50-200, 200-1000, >1000
    by_category: {} as Record<string, number>,
    by_platform: {} as Record<string, number>,
    by_region: {} as Record<string, number>,
    top_uploaders: [] as any[]
  };

  // Initialize counters
  Object.keys(CATEGORIES).forEach(k => stats.by_category[k] = 0);
  REGIONS.forEach(k => stats.by_region[k] = 0);

  // 3. Process Each Agency
  master.forEach(agency => {
    const text = (agency.title + ' ' + agency.snippet + ' ' + agency.source_query).toLowerCase();
    const vol = volMap.get(agency.domain) || { total: 0, recent: 0 };

    // Size
    if (vol.total > 0) {
      if (vol.total < 50) stats.by_size.small++;
      else if (vol.total < 200) stats.by_size.medium++;
      else if (vol.total < 1000) stats.by_size.large++;
      else stats.by_size.huge++;
    }

    // Category
    let categorized = false;
    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
      if (keywords.some(k => text.includes(k))) {
        stats.by_category[cat]++;
        categorized = true;
      }
    }
    if (!categorized) {
      stats.by_category['General_Residential'] = (stats.by_category['General_Residential'] || 0) + 1;
    }

    // Region (Heuristic based on source query or text)
    for (const region of REGIONS) {
      if (text.includes(region.toLowerCase())) {
        stats.by_region[region]++;
        // Don't break, can be in multiple (e.g. "Costa Blanca, Alicante")
      }
    }

    // Platform
    if (agency.platform) {
      stats.by_platform[agency.platform] = (stats.by_platform[agency.platform] || 0) + 1;
    }

    // Top Uploaders List
    if (vol.recent > 0) {
      stats.top_uploaders.push({
        domain: agency.domain,
        title: agency.title,
        total: vol.total,
        recent_7_days: vol.recent,
        platform: agency.platform
      });
    }
  });

  // Sort Top Uploaders
  stats.top_uploaders.sort((a, b) => b.recent_7_days - a.recent_7_days);

  // 4. Output Report
  console.log('\n🌟 PORTFOLIO SNAPSHOT 🌟');
  console.log('=========================');
  console.log(`Total Agencies Analyzed: ${stats.total_agencies}`);
  console.log(`Active Data Sources (Sitemaps): ${stats.with_sitemaps}`);
  
  console.log('\n📏 Size Distribution (by Total URLs)');
  console.log(`   boutique (<50 listings):     ${stats.by_size.small}`);
  console.log(`   Established (50-200):       ${stats.by_size.medium}`);
  console.log(`   Large Agency (200-1000):    ${stats.by_size.large}`);
  console.log(`   Major Portal/Network (>1k): ${stats.by_size.huge}`);

  console.log('\n🏷️  Agency Types (Keywords)');
  Object.entries(stats.by_category)
    .sort(([,a], [,b]) => b - a)
    .forEach(([cat, count]) => console.log(`   ${cat.padEnd(20)}: ${count}`));

  console.log('\n📍 Geographic Focus (Top 10)');
  Object.entries(stats.by_region)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([reg, count]) => console.log(`   ${reg.padEnd(20)}: ${count}`));

  console.log('\n💻 Tech Platforms');
  Object.entries(stats.by_platform)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .forEach(([plat, count]) => console.log(`   ${plat.padEnd(20)}: ${count}`));

  console.log('\n🔥 Top Movers (Most Updates Last 7 Days)');
  stats.top_uploaders.slice(0, 5).forEach(u => {
    console.log(`   ${u.recent_7_days.toString().padEnd(6)} updates | ${u.total.toString().padEnd(6)} total | ${u.domain} (${u.platform || 'Custom'})`);
  });
}

main().catch(console.error);

