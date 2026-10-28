/**
 * 🤖 Gemini-Powered URL Pattern Analysis
 * 
 * Uses Gemini 3 Pro Preview to analyze sitemap URLs from "unknown" domains
 * and identify Sale vs Rent patterns that regex couldn't catch.
 * 
 * Usage:
 *   npx tsx src/scripts/harvest_agencies/gemini-url-pattern-analysis.ts
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';
import { callGeminiRest } from '@/lib/gemini-rest-client';

// --- Configuration ---
const INPUT_CSV = 'data/unknown_domains_for_gemini.csv';
const FULL_DATA_CSV = 'data/domain_url_patterns.csv';
const OUTPUT_CSV = 'data/domain_url_patterns_gemini.csv';
const BATCH_SIZE = 15; // Domains per Gemini call
const MAX_URLS_PER_DOMAIN = 30; // Sample URLs per domain
const TIMEOUT_MS = 20000;
const USER_AGENT = 'Mozilla/5.0 (compatible; LeoBot/1.0; +https://leo.casa)';

interface DomainInput {
  domain: string;
  sitemap_url: string;
  total_sampled: string;
}

interface DomainUrls {
  domain: string;
  sitemap_url: string;
  urls: string[];
}

interface GeminiClassification {
  domain: string;
  listing_types: 'sale' | 'rent' | 'both' | 'unknown' | 'not_listings';
  sale_pattern?: string;
  rent_pattern?: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// --- Main Script ---
async function main() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🤖 Gemini 3 Pro Preview URL Pattern Analysis                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`❌ Input file not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  // 1. Read unknown domains
  const unknownDomains: DomainInput[] = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`📋 Unknown domains to analyze: ${unknownDomains.length}`);
  console.log(`⚙️  Batch size: ${BATCH_SIZE} | URLs per domain: ${MAX_URLS_PER_DOMAIN}`);
  console.log('');

  // 2. Fetch URLs for each domain
  console.log('📥 Fetching sitemap URLs...');
  const domainsWithUrls: DomainUrls[] = [];
  
  for (let i = 0; i < unknownDomains.length; i++) {
    const d = unknownDomains[i];
    try {
      const urls = await fetchSitemapUrls(d.sitemap_url, MAX_URLS_PER_DOMAIN);
      if (urls.length > 0) {
        domainsWithUrls.push({
          domain: d.domain,
          sitemap_url: d.sitemap_url,
          urls
        });
      }
      if ((i + 1) % 50 === 0) {
        console.log(`   Fetched ${i + 1}/${unknownDomains.length} sitemaps...`);
      }
    } catch (e) {
      // Skip failed fetches
    }
  }

  console.log(`✅ Successfully fetched ${domainsWithUrls.length} domains with URLs`);
  console.log('');

  // 3. Batch process with Gemini
  console.log('🤖 Analyzing with Gemini 3 Pro Preview...');
  console.log('─'.repeat(70));
  
  const allClassifications: GeminiClassification[] = [];
  const batches = Math.ceil(domainsWithUrls.length / BATCH_SIZE);
  
  for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, domainsWithUrls.length);
    const batch = domainsWithUrls.slice(batchStart, batchEnd);
    
    console.log(`\n📦 Batch ${batchIdx + 1}/${batches} (${batch.length} domains)`);
    
    try {
      const classifications = await analyzeWithGemini(batch);
      allClassifications.push(...classifications);
      
      // Log results
      for (const c of classifications) {
        const emoji = c.listing_types === 'sale' ? '🏠' :
                      c.listing_types === 'rent' ? '🔑' :
                      c.listing_types === 'both' ? '🏠🔑' :
                      c.listing_types === 'not_listings' ? '🚫' : '❓';
        const conf = c.confidence === 'high' ? '🟢' :
                     c.confidence === 'medium' ? '🟡' : '🔴';
        console.log(`   ${emoji} ${conf} ${c.domain.padEnd(35)} ${c.listing_types}`);
      }
      
      // Rate limit between batches
      if (batchIdx < batches - 1) {
        console.log('   ⏳ Waiting 2s before next batch...');
        await sleep(2000);
      }
    } catch (e: any) {
      console.error(`   ❌ Batch failed: ${e.message}`);
    }
  }

  console.log('');
  console.log('─'.repeat(70));

  // 4. Merge with existing data
  console.log('\n📊 Merging results with existing data...');
  
  const existingData = parse(fs.readFileSync(FULL_DATA_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  // Create lookup for Gemini classifications
  const geminiLookup = new Map<string, GeminiClassification>();
  for (const c of allClassifications) {
    geminiLookup.set(c.domain, c);
  }

  // Update existing data with Gemini results
  const updatedData = existingData.map((row: any) => {
    const geminiResult = geminiLookup.get(row.domain);
    if (geminiResult && geminiResult.listing_types !== 'unknown') {
      return {
        ...row,
        listing_types: geminiResult.listing_types,
        confidence: geminiResult.confidence,
        sale_patterns: geminiResult.sale_pattern ? 
          JSON.stringify([{ pattern: geminiResult.sale_pattern, count: 'gemini' }]) : row.sale_patterns,
        rent_patterns: geminiResult.rent_pattern ?
          JSON.stringify([{ pattern: geminiResult.rent_pattern, count: 'gemini' }]) : row.rent_patterns,
        error_details: `Gemini: ${geminiResult.reasoning.substring(0, 100)}`
      };
    }
    return row;
  });

  // Write updated CSV
  const headers = Object.keys(updatedData[0]);
  let csvContent = headers.join(',') + '\n';
  for (const row of updatedData) {
    csvContent += stringify([headers.map(h => row[h] || '')]);
  }
  fs.writeFileSync(OUTPUT_CSV, csvContent);

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Count improvements
  let newSale = 0, newRent = 0, newBoth = 0, notListings = 0, stillUnknown = 0;
  for (const c of allClassifications) {
    if (c.listing_types === 'sale') newSale++;
    else if (c.listing_types === 'rent') newRent++;
    else if (c.listing_types === 'both') newBoth++;
    else if (c.listing_types === 'not_listings') notListings++;
    else stillUnknown++;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 GEMINI ANALYSIS COMPLETE                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`⏱️  Time: ${elapsed}s`);
  console.log(`🤖 Analyzed: ${allClassifications.length} domains`);
  console.log('');
  console.log('📈 Gemini Classifications:');
  console.log(`   🏠 Sale Only:      ${newSale}`);
  console.log(`   🔑 Rent Only:      ${newRent}`);
  console.log(`   🏠🔑 Both:         ${newBoth}`);
  console.log(`   🚫 Not Listings:   ${notListings}`);
  console.log(`   ❓ Still Unknown:  ${stillUnknown}`);
  console.log('');
  console.log(`📁 Results saved to: ${OUTPUT_CSV}`);
  console.log('');
}

async function analyzeWithGemini(domains: DomainUrls[]): Promise<GeminiClassification[]> {
  // Build prompt with all domain URLs
  const domainData = domains.map(d => ({
    domain: d.domain,
    sample_urls: d.urls.slice(0, 15) // Send 15 sample URLs per domain
  }));

  const prompt = `You are a real estate URL pattern analyst. Analyze these Spanish real estate agency sitemap URLs and classify each domain.

For each domain, determine:
1. **listing_types**: Is this agency focused on SALE, RENT, BOTH, or is it NOT_LISTINGS (not a real listings site)?
2. **sale_pattern**: If sale listings exist, what URL pattern indicates sale? (e.g., "/venta/", "-en-venta", "comprar")
3. **rent_pattern**: If rent listings exist, what URL pattern indicates rent? (e.g., "/alquiler/", "-en-alquiler", "rent")
4. **confidence**: HIGH (clear patterns), MEDIUM (some indicators), LOW (unclear)
5. **reasoning**: Brief explanation (1 sentence)

IMPORTANT: Many Spanish sites use:
- "venta" or "compra" for SALE
- "alquiler" or "arrendar" for RENT
- Some sites show properties without specifying type in URL (mark as BOTH if it's clearly a real estate site)
- Some sitemaps are just blog posts or company pages (mark as NOT_LISTINGS)

DOMAIN DATA:
${JSON.stringify(domainData, null, 2)}

Respond with a JSON array of classifications:
[
  {
    "domain": "example.com",
    "listing_types": "sale" | "rent" | "both" | "unknown" | "not_listings",
    "sale_pattern": "pattern if found",
    "rent_pattern": "pattern if found", 
    "confidence": "high" | "medium" | "low",
    "reasoning": "Brief explanation"
  }
]`;

  const response = await callGeminiRest(prompt, {
    model: 'gemini-3-pro-preview',
    temperature: 0,
    responseMimeType: 'application/json',
    maxOutputTokens: 8000,
    thinkingConfig: {
      thinkingLevel: 'HIGH'
    }
  });

  if (!response.success || !response.text) {
    throw new Error(response.error || 'Gemini call failed');
  }

  try {
    // Clean markdown if present
    let jsonStr = response.text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    }
    
    const classifications: GeminiClassification[] = JSON.parse(jsonStr);
    return classifications;
  } catch (e: any) {
    console.error('Failed to parse Gemini response:', response.text?.substring(0, 200));
    throw new Error('JSON parse error: ' + e.message);
  }
}

async function fetchSitemapUrls(sitemapUrl: string, maxUrls: number, depth: number = 0): Promise<string[]> {
  if (depth > 3) return [];
  
  const response = await fetchWithTimeout(sitemapUrl);
  if (!response.ok) return [];

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const urls: string[] = [];

  // Check for sitemap index
  const sitemaps = $('sitemap');
  if (sitemaps.length > 0) {
    const childUrls: string[] = [];
    sitemaps.each((_, el) => {
      const loc = $(el).find('loc').text().trim();
      if (loc) childUrls.push(loc);
    });
    
    // Fetch first few child sitemaps
    for (const childUrl of childUrls.slice(0, 3)) {
      if (urls.length >= maxUrls) break;
      try {
        const childResults = await fetchSitemapUrls(childUrl, maxUrls - urls.length, depth + 1);
        urls.push(...childResults);
      } catch (e) {}
    }
    return urls;
  }

  // Parse urlset
  $('url').each((i, el) => {
    if (urls.length >= maxUrls) return false;
    const loc = $(el).find('loc').text().trim();
    if (loc) urls.push(loc);
  });

  return urls;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'application/xml,text/xml,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (e: any) {
    clearTimeout(id);
    throw e;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

