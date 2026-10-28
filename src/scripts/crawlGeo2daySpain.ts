#!/usr/bin/env npx tsx
/**
 * Geo2day Spain Neighborhood Crawler & PBF Parser
 * 
 * 1. Crawls geo2day.com/europe/spain to discover all region .pbf files
 * 2. Downloads the PBF files (or uses smaller regional ones)
 * 3. Extracts admin boundaries (level 9-10) as GeoJSON
 * 4. Stores in DynamoDB for fast querying
 * 
 * Usage:
 *   npx tsx src/scripts/crawlGeo2daySpain.ts              # Discover PBF links
 *   npx tsx src/scripts/crawlGeo2daySpain.ts --download   # Download PBFs
 *   npx tsx src/scripts/crawlGeo2daySpain.ts --extract    # Extract boundaries
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://geo2day.com';
const OUTPUT_DIR = 'data/geo2day-spain';
const CRAWL_DELAY_MS = 500;

// All Spanish regions from the spain.html page
const SPAIN_REGIONS = [
  { name: 'Andalusia', slug: 'andalucia', pbfSize: '134.55MB' },
  { name: 'Aragon', slug: 'aragon', pbfSize: '75.58MB' },
  { name: 'Asturias', slug: 'asturias', pbfSize: '29.06MB' },
  { name: 'Cantabria', slug: 'cantabria', pbfSize: '27.73MB' },
  { name: 'Castile-La Mancha', slug: 'castilla_la_mancha', pbfSize: '86.26MB' },
  { name: 'Castile and Leon', slug: 'castilla_y_leon', pbfSize: '1.1MB' },
  { name: 'Catalonia', slug: 'catalunya', pbfSize: '213.37MB' },
  { name: 'Madrid', slug: 'comunidad_de_madrid', pbfSize: '64.74MB' },
  { name: 'Navarre', slug: 'comunidad_foral_de_navarra', pbfSize: '31.09MB' },
  { name: 'Valencia', slug: 'comunitat_valenciana', pbfSize: '111.54MB' },
  { name: 'Euskadi', slug: 'euskadi', pbfSize: '57.11MB' },
  { name: 'Extremadura', slug: 'extremadura', pbfSize: '32.65MB' },
  { name: 'Galicia', slug: 'galicia', pbfSize: '89.39MB' },
  { name: 'Balearic Islands', slug: 'illes_balears', pbfSize: '37.33MB' },
  { name: 'Rioja', slug: 'la_rioja', pbfSize: '10.78MB' },
  { name: 'Murcia', slug: 'region_de_murcia', pbfSize: '29.62MB' },
];

interface RegionData {
  name: string;
  slug: string;
  pageUrl: string;
  pbfUrl: string;
  polyUrl: string;
  geojsonUrl: string;
  pbfSize: string;
  subRegions: SubRegion[];
}

interface SubRegion {
  name: string;
  slug: string;
  pageUrl: string;
  pbfUrl?: string;
  polyUrl?: string;
}

/**
 * Fetch HTML page
 */
async function fetchPage(url: string): Promise<string> {
  console.log(`   📄 Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Leo.casa Neighborhood Data Collector/1.0 (operator@example.invalid)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  
  return response.text();
}

/**
 * Parse region page to find sub-regions
 */
function parseRegionPage(html: string, regionSlug: string): SubRegion[] {
  const subRegions: SubRegion[] = [];
  
  // Find all links to sub-region pages
  // Pattern: href="/europe/spain/catalunya/barcelona.html"
  const linkPattern = new RegExp(
    `href="(/europe/spain/${regionSlug}/([^"]+)\\.html)"[^>]*>([^<]+)</a>`,
    'gi'
  );
  
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const pagePath = match[1];
    const slug = match[2];
    const name = match[3].trim();
    
    // Skip if it's not a sub-region link
    if (slug.includes('/') || slug === regionSlug) continue;
    
    subRegions.push({
      name,
      slug,
      pageUrl: `${BASE_URL}${pagePath}`,
    });
  }
  
  // Also find PBF links for sub-regions
  const pbfPattern = new RegExp(
    `href="(/europe/spain/${regionSlug}/([^"]+)\\.pbf)"`,
    'gi'
  );
  
  while ((match = pbfPattern.exec(html)) !== null) {
    const pbfPath = match[1];
    const slug = match[2];
    
    const existing = subRegions.find(r => r.slug === slug);
    if (existing) {
      existing.pbfUrl = `${BASE_URL}${pbfPath}`;
    }
  }
  
  return subRegions;
}

/**
 * Crawl all Spain regions
 */
async function crawlSpainRegions(): Promise<RegionData[]> {
  const regions: RegionData[] = [];
  
  console.log('🕷️ Crawling geo2day.com Spain regions...\n');
  
  for (const region of SPAIN_REGIONS) {
    const pageUrl = `${BASE_URL}/europe/spain/${region.slug}.html`;
    const pbfUrl = `${BASE_URL}/europe/spain/${region.slug}.pbf`;
    const polyUrl = `${BASE_URL}/europe/spain/${region.slug}.poly`;
    const geojsonUrl = `${BASE_URL}/europe/spain/${region.slug}.geojson`;
    
    console.log(`📍 ${region.name} (${region.pbfSize})`);
    
    try {
      const html = await fetchPage(pageUrl);
      const subRegions = parseRegionPage(html, region.slug);
      
      console.log(`   Found ${subRegions.length} sub-regions`);
      
      regions.push({
        name: region.name,
        slug: region.slug,
        pageUrl,
        pbfUrl,
        polyUrl,
        geojsonUrl,
        pbfSize: region.pbfSize,
        subRegions,
      });
      
      await new Promise(resolve => setTimeout(resolve, CRAWL_DELAY_MS));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      regions.push({
        name: region.name,
        slug: region.slug,
        pageUrl,
        pbfUrl,
        polyUrl,
        geojsonUrl,
        pbfSize: region.pbfSize,
        subRegions: [],
      });
    }
  }
  
  return regions;
}

/**
 * Generate download commands for osmium extraction
 */
function generateOsmiumCommands(regions: RegionData[]): string {
  const commands: string[] = [
    '#!/bin/bash',
    '# Download PBF files and extract admin boundaries',
    '# Requires: osmium-tool (brew install osmium-tool)',
    '',
    'mkdir -p data/pbf data/boundaries',
    '',
  ];
  
  for (const region of regions) {
    commands.push(`# ${region.name}`);
    commands.push(`echo "Downloading ${region.slug}..."`);
    commands.push(`curl -o data/pbf/${region.slug}.pbf "${region.pbfUrl}"`);
    commands.push('');
    commands.push(`echo "Extracting admin boundaries from ${region.slug}..."`);
    commands.push(`osmium tags-filter data/pbf/${region.slug}.pbf \\`);
    commands.push(`  r/boundary=administrative \\`);
    commands.push(`  -o data/boundaries/${region.slug}-boundaries.osm.pbf`);
    commands.push('');
    commands.push(`echo "Converting to GeoJSON..."`);
    commands.push(`osmium export data/boundaries/${region.slug}-boundaries.osm.pbf \\`);
    commands.push(`  -o data/boundaries/${region.slug}-boundaries.geojson`);
    commands.push('');
  }
  
  return commands.join('\n');
}

/**
 * Alternative: Use Overpass API directly (no download needed)
 */
function generateOverpassQuery(regionName: string): string {
  return `
[out:json][timeout:300];
// Get admin boundaries level 9-10 in ${regionName}
area["name"="${regionName}"]["admin_level"="4"]->.region;
(
  relation["boundary"="administrative"]["admin_level"~"9|10"](area.region);
);
out geom;
`.trim();
}

/**
 * Save results
 */
function saveResults(regions: RegionData[]): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Save full crawl results
  const resultsPath = path.join(OUTPUT_DIR, 'spain-regions.json');
  fs.writeFileSync(resultsPath, JSON.stringify(regions, null, 2));
  console.log(`\n💾 Saved region data to ${resultsPath}`);
  
  // Save download script
  const scriptPath = path.join(OUTPUT_DIR, 'download-and-extract.sh');
  fs.writeFileSync(scriptPath, generateOsmiumCommands(regions));
  fs.chmodSync(scriptPath, '755');
  console.log(`💾 Saved download script to ${scriptPath}`);
  
  // Save Overpass queries for each major city
  const cities = ['Barcelona', 'Madrid', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao'];
  for (const city of cities) {
    const queryPath = path.join(OUTPUT_DIR, `overpass-${city.toLowerCase()}.txt`);
    fs.writeFileSync(queryPath, generateOverpassQuery(city));
  }
  console.log(`💾 Saved Overpass queries for major cities`);
}

/**
 * Print summary
 */
function printSummary(regions: RegionData[]): void {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SPAIN REGIONS SUMMARY');
  console.log('═'.repeat(60));
  
  let totalSubRegions = 0;
  let totalPbfSize = 0;
  
  for (const region of regions) {
    const size = parseFloat(region.pbfSize.replace('MB', ''));
    totalPbfSize += size;
    totalSubRegions += region.subRegions.length;
    
    console.log(`\n${region.name}:`);
    console.log(`  PBF: ${region.pbfSize}`);
    console.log(`  Sub-regions: ${region.subRegions.length}`);
    
    if (region.subRegions.length > 0 && region.subRegions.length <= 10) {
      for (const sub of region.subRegions) {
        console.log(`    • ${sub.name}`);
      }
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Total regions: ${regions.length}`);
  console.log(`Total sub-regions discovered: ${totalSubRegions}`);
  console.log(`Total PBF size: ${totalPbfSize.toFixed(2)} MB`);
  console.log('─'.repeat(60));
  
  console.log('\n📋 NEXT STEPS:');
  console.log('');
  console.log('Option A: Use Overpass API (recommended - no download)');
  console.log('  npx tsx src/scripts/fetchOverpassBoundaries.ts');
  console.log('');
  console.log('Option B: Download PBFs and extract with osmium');
  console.log('  brew install osmium-tool');
  console.log('  bash data/geo2day-spain/download-and-extract.sh');
  console.log('');
}

// Main
async function main() {
  console.log('🇪🇸 geo2day.com Spain Neighborhood Crawler');
  console.log('═'.repeat(40));
  console.log('');
  
  const regions = await crawlSpainRegions();
  saveResults(regions);
  printSummary(regions);
  
  console.log('\n✅ Crawl complete!');
}

main().catch(console.error);

