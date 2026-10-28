/**
 * TOTAL URL CENSUS
 * 
 * Count every single URL across ALL domains with sitemaps
 * No filtering - just raw counts of everything in sitemaps
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as zlib from 'zlib';

const CONCURRENCY = 50; // High concurrency for speed

interface DomainResult {
  domain: string;
  sitemapUrl: string;
  totalUrls: number;
  sitemapCount: number;
  error?: string;
}

interface SitemapFetchResult {
  urls: string[];
  sitemapCount: number;
  error?: string;
}

async function fetchWithTimeout(url: string, timeout: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
        'Accept': 'application/xml, text/xml, */*',
        'Accept-Encoding': 'gzip, deflate'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function fetchSitemapContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    
    // Handle gzipped content
    if (url.endsWith('.gz')) {
      const buffer = await response.arrayBuffer();
      try {
        const decompressed = zlib.gunzipSync(Buffer.from(buffer));
        return decompressed.toString('utf-8');
      } catch (e) {
        // Try as plain text if gunzip fails
        return new TextDecoder().decode(buffer);
      }
    }
    
    return await response.text();
  } catch (e) {
    return null;
  }
}

async function getAllUrlsFromSitemap(sitemapUrl: string, visited: Set<string> = new Set()): Promise<SitemapFetchResult> {
  if (visited.has(sitemapUrl)) {
    return { urls: [], sitemapCount: 0 };
  }
  visited.add(sitemapUrl);
  
  const content = await fetchSitemapContent(sitemapUrl);
  if (!content) {
    return { urls: [], sitemapCount: 0, error: 'Failed to fetch' };
  }
  
  const urls: string[] = [];
  let sitemapCount = 1;
  
  // Check if this is a sitemap index
  const isSitemapIndex = content.includes('<sitemapindex') || content.includes(':sitemapindex');
  
  if (isSitemapIndex) {
    // Extract child sitemap URLs
    const sitemapMatches = content.matchAll(/<loc>([^<]+\.xml[^<]*)<\/loc>/gi);
    const childSitemaps: string[] = [];
    
    for (const match of sitemapMatches) {
      childSitemaps.push(match[1].trim());
    }
    
    // Fetch all child sitemaps in parallel (batched)
    const BATCH_SIZE = 10;
    for (let i = 0; i < childSitemaps.length; i += BATCH_SIZE) {
      const batch = childSitemaps.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(childUrl => getAllUrlsFromSitemap(childUrl, visited))
      );
      
      for (const result of results) {
        urls.push(...result.urls);
        sitemapCount += result.sitemapCount;
      }
    }
  } else {
    // Regular sitemap - extract all URLs
    const locMatches = content.matchAll(/<loc>([^<]+)<\/loc>/gi);
    for (const match of locMatches) {
      const url = match[1].trim();
      // Skip if it's another sitemap reference
      if (!url.endsWith('.xml') && !url.endsWith('.xml.gz')) {
        urls.push(url);
      }
    }
  }
  
  return { urls, sitemapCount };
}

async function processDomain(domain: string, sitemapUrl: string): Promise<DomainResult> {
  try {
    const result = await getAllUrlsFromSitemap(sitemapUrl);
    return {
      domain,
      sitemapUrl,
      totalUrls: result.urls.length,
      sitemapCount: result.sitemapCount,
      error: result.error
    };
  } catch (e: any) {
    return {
      domain,
      sitemapUrl,
      totalUrls: 0,
      sitemapCount: 0,
      error: e.message
    };
  }
}

async function main() {
  console.log('📊 TOTAL URL CENSUS - Counting Every URL Across All Domains\n');
  console.log('='.repeat(70));
  
  const startTime = Date.now();
  
  // Load sitemap data
  const sitemapPath = path.join(process.cwd(), 'data', 'agencies_sitemaps.csv');
  const sitemapData = fs.readFileSync(sitemapPath, 'utf-8');
  const sitemapRecords = parse(sitemapData, { columns: true, skip_empty_lines: true });
  
  // Filter for domains with sitemaps
  const domainsWithSitemaps = sitemapRecords.filter((r: any) => 
    r.sitemap_found === 'YES' && r.sitemap_url && r.sitemap_url.trim() !== ''
  );
  
  console.log(`\n🔍 Found ${domainsWithSitemaps.length} domains with sitemaps\n`);
  console.log('Processing in parallel...\n');
  
  const results: DomainResult[] = [];
  let processed = 0;
  
  // Process in batches
  for (let i = 0; i < domainsWithSitemaps.length; i += CONCURRENCY) {
    const batch = domainsWithSitemaps.slice(i, i + CONCURRENCY);
    
    const batchResults = await Promise.all(
      batch.map((record: any) => processDomain(record.domain, record.sitemap_url))
    );
    
    results.push(...batchResults);
    processed += batch.length;
    
    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = (domainsWithSitemaps.length - processed) / rate;
    
    process.stdout.write(`\r⏳ Processed: ${processed}/${domainsWithSitemaps.length} (${Math.round(rate)}/sec, ~${Math.round(remaining)}s remaining)`);
  }
  
  console.log('\n');
  
  // Calculate totals
  const successfulResults = results.filter(r => r.totalUrls > 0);
  const failedResults = results.filter(r => r.error || r.totalUrls === 0);
  
  const totalUrls = results.reduce((sum, r) => sum + r.totalUrls, 0);
  const totalSitemaps = results.reduce((sum, r) => sum + r.sitemapCount, 0);
  
  // Sort by URL count
  const sortedResults = [...results].sort((a, b) => b.totalUrls - a.totalUrls);
  
  // Summary
  console.log('='.repeat(70));
  console.log('📈 TOTAL URL CENSUS RESULTS\n');
  
  console.log(`✅ Domains processed: ${results.length}`);
  console.log(`✅ Domains with URLs: ${successfulResults.length}`);
  console.log(`❌ Domains failed/empty: ${failedResults.length}`);
  console.log(`📄 Total sitemaps parsed: ${totalSitemaps.toLocaleString()}`);
  console.log(`\n🔢 GRAND TOTAL URLS: ${totalUrls.toLocaleString()}\n`);
  
  // Top 20 domains by URL count
  console.log('='.repeat(70));
  console.log('🏆 TOP 20 DOMAINS BY URL COUNT\n');
  console.log('Rank | Domain                              | URLs        | Sitemaps');
  console.log('-'.repeat(70));
  
  for (let i = 0; i < Math.min(20, sortedResults.length); i++) {
    const r = sortedResults[i];
    if (r.totalUrls > 0) {
      console.log(
        `${String(i + 1).padStart(4)} | ${r.domain.padEnd(35)} | ${r.totalUrls.toLocaleString().padStart(11)} | ${r.sitemapCount}`
      );
    }
  }
  
  // Distribution
  console.log('\n' + '='.repeat(70));
  console.log('📊 URL DISTRIBUTION\n');
  
  const brackets = [
    { min: 10000, max: Infinity, label: '10,000+ URLs' },
    { min: 5000, max: 9999, label: '5,000 - 9,999' },
    { min: 1000, max: 4999, label: '1,000 - 4,999' },
    { min: 500, max: 999, label: '500 - 999' },
    { min: 100, max: 499, label: '100 - 499' },
    { min: 1, max: 99, label: '1 - 99' },
    { min: 0, max: 0, label: '0 (empty/failed)' },
  ];
  
  for (const bracket of brackets) {
    const count = results.filter(r => 
      r.totalUrls >= bracket.min && r.totalUrls <= bracket.max
    ).length;
    const urlsInBracket = results
      .filter(r => r.totalUrls >= bracket.min && r.totalUrls <= bracket.max)
      .reduce((sum, r) => sum + r.totalUrls, 0);
    
    console.log(`${bracket.label.padEnd(20)} | ${count.toString().padStart(4)} domains | ${urlsInBracket.toLocaleString().padStart(12)} URLs`);
  }
  
  // Time
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n⏱️ Total time: ${totalTime.toFixed(1)} seconds`);
  
  // Save detailed results
  const outputPath = path.join(process.cwd(), 'data', 'total_url_census.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    summary: {
      totalDomains: results.length,
      domainsWithUrls: successfulResults.length,
      domainsFailed: failedResults.length,
      totalSitemaps,
      grandTotalUrls: totalUrls
    },
    topDomains: sortedResults.slice(0, 100).map(r => ({
      domain: r.domain,
      totalUrls: r.totalUrls,
      sitemapCount: r.sitemapCount
    })),
    allDomains: sortedResults.map(r => ({
      domain: r.domain,
      totalUrls: r.totalUrls,
      sitemapCount: r.sitemapCount,
      error: r.error
    }))
  }, null, 2));
  
  console.log(`\n💾 Full data saved to: ${outputPath}`);
  
  // Also save CSV for easy viewing
  const csvPath = path.join(process.cwd(), 'data', 'total_url_census.csv');
  const csvContent = [
    'domain,total_urls,sitemap_count,error',
    ...sortedResults.map(r => 
      `${r.domain},${r.totalUrls},${r.sitemapCount},${r.error || ''}`
    )
  ].join('\n');
  fs.writeFileSync(csvPath, csvContent);
  console.log(`📄 CSV saved to: ${csvPath}`);
}

main().catch(console.error);

