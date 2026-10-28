/**
 * 🤖 Gemini Bulk URL Pattern Analysis - ALL DOMAINS IN ONE CALL
 * 
 * Uses the same Gemini 3 Pro Preview setup as zeroShotGemini3.ts
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

// Load environment variables FIRST
// Recipient configuration is supplied by tools/runtime-env.py.
// Gemini config - same as zeroShotGemini3.ts
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-3-pro-preview';
const GENERATE_CONTENT_API = 'streamGenerateContent';

// --- Configuration ---
const INPUT_CSV = 'data/unknown_domains_for_gemini.csv';
const FULL_DATA_CSV = 'data/domain_url_patterns.csv';
const OUTPUT_CSV = 'data/domain_url_patterns_gemini.csv';
const MAX_URLS_PER_DOMAIN = 20;
const TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (compatible; LeoBot/1.0)';

interface DomainInput {
  domain: string;
  sitemap_url: string;
}

interface GeminiClassification {
  domain: string;
  listing_types: 'sale' | 'rent' | 'both' | 'unknown' | 'not_listings';
  sale_pattern?: string;
  rent_pattern?: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('No API key found (GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY)');
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 50000,
      topP: 0.95,
      thinkingConfig: {
        thinkingLevel: 'HIGH',
      },
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    ],
  };

  const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${encodeURIComponent(API_KEY)}`;

  console.log(`   🔗 Calling ${MODEL_ID}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = JSON.parse(rawResponse);
    } catch {}
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${rawResponse.substring(0, 200)}`);
  }

  // Parse stream response (array of chunks)
  let responseArray: any[];
  try {
    responseArray = JSON.parse(rawResponse);
    if (!Array.isArray(responseArray)) {
      responseArray = [responseArray];
    }
  } catch (parseError) {
    throw new Error(`Failed to parse response: ${parseError}`);
  }

  // Extract text from all chunks
  let responseText = '';
  for (const chunk of responseArray) {
    const candidates = chunk?.candidates || [];
    for (const candidate of candidates) {
      const content = candidate?.content;
      if (content?.parts) {
        for (const part of content.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }
      }
    }
  }

  return responseText;
}

async function main() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🤖 Gemini 3 Pro - BULK Analysis (All Domains, One Call)     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🔑 API Key: ${API_KEY ? '✅ Found' : '❌ Missing'}`);

  if (!API_KEY) {
    console.error('❌ No API key! Set GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY in .env.local');
    process.exit(1);
  }

  // 1. Read unknown domains
  const unknownDomains: DomainInput[] = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`📋 Domains to analyze: ${unknownDomains.length}`);
  console.log('');

  // 2. Fetch URLs for ALL domains
  console.log('📥 Fetching sitemap URLs for all domains...');
  const allDomainData: { domain: string; urls: string[] }[] = [];
  
  let fetchedCount = 0;
  for (const d of unknownDomains) {
    try {
      const urls = await fetchSitemapUrls(d.sitemap_url, MAX_URLS_PER_DOMAIN);
      if (urls.length > 0) {
        allDomainData.push({ domain: d.domain, urls });
        fetchedCount++;
      }
    } catch (e) {}
    
    if (fetchedCount % 50 === 0 && fetchedCount > 0) {
      console.log(`   ✓ Fetched ${fetchedCount} domains...`);
    }
  }

  console.log(`✅ Got URLs for ${allDomainData.length} domains`);
  console.log('');

  // 3. Build the mega-prompt
  console.log('🤖 Sending ALL domains to Gemini 3 Pro Preview...');
  console.log('   (This may take 30-60 seconds)');
  console.log('');

  const prompt = `You are a real estate URL pattern expert analyzing Spanish property agency websites.

I have ${allDomainData.length} domains that couldn't be classified by regex. Analyze their sitemap URLs and classify each one.

For EACH domain, determine:
- **listing_types**: "sale", "rent", "both", "not_listings" (blogs/company pages), or "unknown"
- **sale_pattern**: URL pattern that indicates FOR SALE (e.g., "/venta/", "piso-venta-", "comprar")
- **rent_pattern**: URL pattern that indicates FOR RENT (e.g., "/alquiler/", "-en-alquiler")
- **confidence**: "high", "medium", or "low"
- **reasoning**: One brief sentence

Spanish patterns to look for:
- SALE: venta, compra, comprar, en-venta, for-sale, buy, kaufen
- RENT: alquiler, alquilar, en-alquiler, for-rent, rent, miete, location
- Generic listings with /propiedad/, /inmueble/, /ficha/ = mark as "both" (they likely have both types)
- Blogs, news, company pages = "not_listings"

HERE ARE ALL THE DOMAINS AND THEIR SAMPLE URLs:

${JSON.stringify(allDomainData.map(d => ({
  domain: d.domain,
  sample_urls: d.urls.slice(0, 15)
})), null, 2)}

Respond with a JSON array containing one object per domain:
[
  {"domain": "...", "listing_types": "...", "sale_pattern": "...", "rent_pattern": "...", "confidence": "...", "reasoning": "..."},
  ...
]`;

  const responseText = await callGemini(prompt);

  console.log(`✅ Gemini response received`);
  console.log('');

  // 4. Parse results
  let classifications: GeminiClassification[];
  try {
    let jsonStr = responseText;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    }
    classifications = JSON.parse(jsonStr);
    console.log(`📊 Parsed ${classifications.length} classifications`);
  } catch (e: any) {
    console.error('❌ JSON parse error. Raw response:');
    console.error(responseText.substring(0, 1000));
    process.exit(1);
  }

  // 5. Count results
  let sale = 0, rent = 0, both = 0, notListings = 0, unknown = 0;
  for (const c of classifications) {
    if (c.listing_types === 'sale') sale++;
    else if (c.listing_types === 'rent') rent++;
    else if (c.listing_types === 'both') both++;
    else if (c.listing_types === 'not_listings') notListings++;
    else unknown++;
  }

  console.log('');
  console.log('─'.repeat(70));
  console.log('');
  console.log('📈 Gemini Classifications:');
  console.log(`   🏠 Sale Only:      ${sale}`);
  console.log(`   🔑 Rent Only:      ${rent}`);
  console.log(`   🏠🔑 Both:         ${both}`);
  console.log(`   🚫 Not Listings:   ${notListings}`);
  console.log(`   ❓ Still Unknown:  ${unknown}`);
  console.log('');

  // 6. Show some examples
  console.log('📋 Sample Classifications:');
  for (const c of classifications.slice(0, 15)) {
    const emoji = c.listing_types === 'sale' ? '🏠' :
                  c.listing_types === 'rent' ? '🔑' :
                  c.listing_types === 'both' ? '🏠🔑' :
                  c.listing_types === 'not_listings' ? '🚫' : '❓';
    console.log(`   ${emoji} ${c.domain.padEnd(35)} → ${c.listing_types} (${c.confidence})`);
    if (c.reasoning) console.log(`      ${c.reasoning.substring(0, 70)}`);
  }
  console.log('   ...');
  console.log('');

  // 7. Merge with existing data
  console.log('📝 Merging results...');
  
  const existingData = parse(fs.readFileSync(FULL_DATA_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  const geminiLookup = new Map<string, GeminiClassification>();
  for (const c of classifications) {
    geminiLookup.set(c.domain, c);
  }

  const updatedData = existingData.map((row: any) => {
    const g = geminiLookup.get(row.domain);
    if (g && g.listing_types !== 'unknown') {
      return {
        ...row,
        listing_types: g.listing_types,
        confidence: g.confidence,
        sale_patterns: g.sale_pattern ? 
          JSON.stringify([{ pattern: g.sale_pattern, source: 'gemini' }]) : row.sale_patterns,
        rent_patterns: g.rent_pattern ?
          JSON.stringify([{ pattern: g.rent_pattern, source: 'gemini' }]) : row.rent_patterns,
        error_details: g.reasoning ? `Gemini: ${g.reasoning.substring(0, 80)}` : row.error_details
      };
    }
    return row;
  });

  // Write output
  const headers = Object.keys(updatedData[0]);
  let csvContent = headers.join(',') + '\n';
  for (const row of updatedData) {
    csvContent += stringify([headers.map(h => row[h] || '')]);
  }
  fs.writeFileSync(OUTPUT_CSV, csvContent);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ ANALYSIS COMPLETE                                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`⏱️  Total time: ${elapsed}s`);
  console.log(`📁 Results: ${OUTPUT_CSV}`);
  console.log('');
}

async function fetchSitemapUrls(sitemapUrl: string, maxUrls: number, depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  
  try {
    const res = await fetchWithTimeout(sitemapUrl);
    if (!res.ok) return [];
    
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];

    // Handle sitemap index
    const sitemaps = $('sitemap');
    if (sitemaps.length > 0) {
      const childUrls: string[] = [];
      sitemaps.each((_, el) => {
        const loc = $(el).find('loc').text().trim();
        if (loc) childUrls.push(loc);
      });
      
      for (const childUrl of childUrls.slice(0, 2)) {
        if (urls.length >= maxUrls) break;
        const childResults = await fetchSitemapUrls(childUrl, maxUrls - urls.length, depth + 1);
        urls.push(...childResults);
      }
      return urls;
    }

    // Parse urlset
    $('url').each((_, el) => {
      if (urls.length >= maxUrls) return false;
      const loc = $(el).find('loc').text().trim();
      if (loc) urls.push(loc);
    });

    return urls;
  } catch (e) {
    return [];
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/xml,text/xml,*/*' },
      signal: controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
