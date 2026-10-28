#!/usr/bin/env npx tsx
/**
 * Recursive Crawler for geo2day.com Spain Regions
 * 
 * Crawls the site structure to discover all region pages and their
 * associated GeoJSON/PBF files for neighborhood boundaries.
 * 
 * Usage:
 *   npx tsx src/scripts/crawlGeo2day.ts
 *   npx tsx src/scripts/crawlGeo2day.ts --download  # Also download files
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://geo2day.com';
const START_PATH = '/europe/spain.html';
const OUTPUT_DIR = 'data/geo2day';
const CRAWL_DELAY_MS = 1000; // Be nice to the server

interface RegionInfo {
  name: string;
  url: string;
  level: number;
  parent: string | null;
  pbfUrl: string | null;
  polyUrl: string | null;
  geojsonUrl: string | null;
  children: string[];
}

const visited = new Set<string>();
const regions: Map<string, RegionInfo> = new Map();

/**
 * Fetch a page and return HTML
 */
async function fetchPage(url: string): Promise<string> {
  console.log(`   📄 Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Leo.casa Neighborhood Crawler/1.0 (operator@example.invalid)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  
  return response.text();
}

/**
 * Parse HTML to extract region links and file URLs
 */
function parseRegionPage(html: string, currentUrl: string): {
  subRegions: { name: string; url: string }[];
  pbfUrl: string | null;
  polyUrl: string | null;
  geojsonUrl: string | null;
} {
  const subRegions: { name: string; url: string }[] = [];
  let pbfUrl: string | null = null;
  let polyUrl: string | null = null;
  let geojsonUrl: string | null = null;
  
  // Extract base path for relative URLs
  const basePath = currentUrl.replace(/\/[^\/]*\.html$/, '');
  
  // Find sub-region links in the table
  // Pattern: <a href="/europe/spain/catalunya.html">Catalonia</a>
  const regionLinkPattern = /<a\s+href="([^"]+\.html)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = regionLinkPattern.exec(html)) !== null) {
    const href = match[1];
    const name = match[2].trim();
    
    // Only follow links that are deeper in the hierarchy
    if (href.includes('/europe/spain/') && 
        !href.includes('..') && 
        href !== currentUrl &&
        !href.includes('#')) {
      
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      
      // Skip if already visited or is the current page
      if (!visited.has(fullUrl) && fullUrl !== currentUrl) {
        subRegions.push({ name, url: fullUrl });
      }
    }
  }
  
  // Find .pbf file link
  const pbfPattern = /\[([^\]]+\.pbf)\]/g;
  const pbfMatch = pbfPattern.exec(html);
  if (pbfMatch) {
    const pbfPath = html.match(new RegExp(`href="([^"]*${pbfMatch[1].replace('.', '\\.')})"`))?.[1];
    if (pbfPath) {
      pbfUrl = pbfPath.startsWith('http') ? pbfPath : `${BASE_URL}${pbfPath}`;
    }
  }
  
  // Find .poly file link  
  const polyPattern = /\[([^\]]+\.poly)\]/g;
  const polyMatch = polyPattern.exec(html);
  if (polyMatch) {
    const polyPath = html.match(new RegExp(`href="([^"]*${polyMatch[1].replace('.', '\\.')})"`))?.[1];
    if (polyPath) {
      polyUrl = polyPath.startsWith('http') ? polyPath : `${BASE_URL}${polyPath}`;
    }
  }
  
  // Find .geojson file link
  const geojsonPattern = /\[([^\]]+\.geojson)\]/g;
  const geojsonMatch = geojsonPattern.exec(html);
  if (geojsonMatch) {
    const geojsonPath = html.match(new RegExp(`href="([^"]*${geojsonMatch[1].replace('.', '\\.')})"`))?.[1];
    if (geojsonPath) {
      geojsonUrl = geojsonPath.startsWith('http') ? geojsonPath : `${BASE_URL}${geojsonPath}`;
    }
  }
  
  // Also look for direct href patterns
  const directPbfPattern = /href="([^"]+\.pbf)"/g;
  while ((match = directPbfPattern.exec(html)) !== null) {
    if (!pbfUrl) {
      pbfUrl = match[1].startsWith('http') ? match[1] : `${BASE_URL}${match[1]}`;
    }
  }
  
  const directGeojsonPattern = /href="([^"]+\.geojson)"/g;
  while ((match = directGeojsonPattern.exec(html)) !== null) {
    if (!geojsonUrl) {
      geojsonUrl = match[1].startsWith('http') ? match[1] : `${BASE_URL}${match[1]}`;
    }
  }
  
  return { subRegions, pbfUrl, polyUrl, geojsonUrl };
}

/**
 * Extract region name from URL
 */
function getRegionName(url: string): string {
  const match = url.match(/\/([^\/]+)\.html$/);
  if (match) {
    return match[1]
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'Unknown';
}

/**
 * Calculate depth level from URL
 */
function getLevel(url: string): number {
  const path = url.replace(BASE_URL, '');
  return (path.match(/\//g) || []).length - 2; // Subtract /europe/
}

/**
 * Recursively crawl regions
 */
async function crawlRegion(url: string, parentUrl: string | null, depth: number = 0): Promise<void> {
  if (visited.has(url)) return;
  if (depth > 5) {
    console.log(`   ⚠️ Max depth reached at ${url}`);
    return;
  }
  
  visited.add(url);
  const indent = '  '.repeat(depth);
  
  try {
    const html = await fetchPage(url);
    const { subRegions, pbfUrl, polyUrl, geojsonUrl } = parseRegionPage(html, url);
    
    const regionName = getRegionName(url);
    const level = getLevel(url);
    
    console.log(`${indent}📍 ${regionName} (level ${level})`);
    if (pbfUrl) console.log(`${indent}   📦 PBF: ${pbfUrl.split('/').pop()}`);
    if (geojsonUrl) console.log(`${indent}   🗺️ GeoJSON: ${geojsonUrl.split('/').pop()}`);
    console.log(`${indent}   🔗 ${subRegions.length} sub-regions`);
    
    // Store region info
    regions.set(url, {
      name: regionName,
      url,
      level,
      parent: parentUrl,
      pbfUrl,
      polyUrl,
      geojsonUrl,
      children: subRegions.map(r => r.url),
    });
    
    // Crawl sub-regions
    for (const subRegion of subRegions) {
      await new Promise(resolve => setTimeout(resolve, CRAWL_DELAY_MS));
      await crawlRegion(subRegion.url, url, depth + 1);
    }
    
  } catch (error) {
    console.error(`${indent}❌ Error crawling ${url}:`, error);
  }
}

/**
 * Download a file
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`   ⬇️ Downloading: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  
  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`   ✅ Saved: ${outputPath} (${sizeMB} MB)`);
}

/**
 * Download all discovered files
 */
async function downloadAllFiles(): Promise<void> {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  console.log('\n\n📥 DOWNLOADING FILES...\n');
  
  for (const [url, region] of regions) {
    const regionDir = path.join(OUTPUT_DIR, region.name.toLowerCase().replace(/\s+/g, '_'));
    
    if (!fs.existsSync(regionDir)) {
      fs.mkdirSync(regionDir, { recursive: true });
    }
    
    // Download GeoJSON (smaller, easier to process)
    if (region.geojsonUrl) {
      try {
        const filename = region.geojsonUrl.split('/').pop() || 'region.geojson';
        await downloadFile(region.geojsonUrl, path.join(regionDir, filename));
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`   ❌ Failed: ${region.geojsonUrl}`);
      }
    }
    
    // Optionally download PBF (large files, need osmium to parse)
    // Uncomment if you want to download PBF files:
    // if (region.pbfUrl) {
    //   try {
    //     const filename = region.pbfUrl.split('/').pop() || 'region.pbf';
    //     await downloadFile(region.pbfUrl, path.join(regionDir, filename));
    //     await new Promise(resolve => setTimeout(resolve, 1000));
    //   } catch (error) {
    //     console.error(`   ❌ Failed: ${region.pbfUrl}`);
    //   }
    // }
  }
}

/**
 * Save crawl results to JSON
 */
function saveCrawlResults(): void {
  const outputPath = path.join(OUTPUT_DIR, 'crawl-results.json');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const results = {
    crawledAt: new Date().toISOString(),
    totalRegions: regions.size,
    regions: Object.fromEntries(regions),
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved crawl results to ${outputPath}`);
}

/**
 * Print summary
 */
function printSummary(): void {
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 CRAWL SUMMARY');
  console.log('═'.repeat(60));
  
  // Group by level
  const byLevel: Record<number, RegionInfo[]> = {};
  for (const region of regions.values()) {
    if (!byLevel[region.level]) byLevel[region.level] = [];
    byLevel[region.level].push(region);
  }
  
  for (const level of Object.keys(byLevel).map(Number).sort()) {
    const levelRegions = byLevel[level];
    console.log(`\nLevel ${level}: ${levelRegions.length} regions`);
    
    const withPbf = levelRegions.filter(r => r.pbfUrl).length;
    const withGeojson = levelRegions.filter(r => r.geojsonUrl).length;
    
    console.log(`  - With PBF: ${withPbf}`);
    console.log(`  - With GeoJSON: ${withGeojson}`);
    
    if (levelRegions.length <= 10) {
      for (const r of levelRegions) {
        console.log(`  • ${r.name}`);
      }
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Total regions discovered: ${regions.size}`);
  console.log('─'.repeat(60));
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const shouldDownload = args.includes('--download');
  
  console.log('🕷️ geo2day.com Recursive Crawler');
  console.log('═'.repeat(40));
  console.log(`Starting at: ${BASE_URL}${START_PATH}`);
  console.log(`Download files: ${shouldDownload}`);
  console.log('');
  
  // Start crawling
  const startUrl = `${BASE_URL}${START_PATH}`;
  await crawlRegion(startUrl, null, 0);
  
  // Print summary
  printSummary();
  
  // Save results
  saveCrawlResults();
  
  // Download files if requested
  if (shouldDownload) {
    await downloadAllFiles();
  } else {
    console.log('\n💡 Run with --download to download GeoJSON files');
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);

