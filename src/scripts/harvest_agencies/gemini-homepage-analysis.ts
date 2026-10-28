/**
 * 🤖 Gemini Homepage Analysis for Broken Sitemaps
 * 
 * For the 84 domains with broken/empty sitemaps, analyze their
 * downloaded homepages to classify as sale/rent/both.
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-3-pro-preview';

const INPUT_CSV = 'data/final_84_unknowns.csv';
const HOMEPAGE_DIR = 'data/agency_homepages';
const FULL_DATA_CSV = 'data/domain_url_patterns_gemini.csv';
const OUTPUT_CSV = 'data/domain_url_patterns_final.csv';

interface GeminiClassification {
  domain: string;
  listing_types: 'sale' | 'rent' | 'both' | 'unknown' | 'not_listings';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

async function callGemini(prompt: string): Promise<string> {
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 20000,
      thinkingConfig: { thinkingLevel: 'HIGH' },
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    ],
  };

  const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:streamGenerateContent?key=${encodeURIComponent(API_KEY!)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const rawResponse = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawResponse.substring(0, 200)}`);

  let responseArray = JSON.parse(rawResponse);
  if (!Array.isArray(responseArray)) responseArray = [responseArray];

  let text = '';
  for (const chunk of responseArray) {
    for (const candidate of chunk?.candidates || []) {
      for (const part of candidate?.content?.parts || []) {
        if (part.text) text += part.text;
      }
    }
  }
  return text;
}

function extractTextFromHtml(html: string): string {
  // Remove scripts, styles, and HTML tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Limit to first 8000 chars
  return text.substring(0, 8000);
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🤖 Gemini Homepage Analysis (84 Broken Sitemaps)            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Read unknown domains
  const unknowns = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`📋 Domains to analyze: ${unknowns.length}`);
  console.log('');

  // Load homepage content for each
  const domainsWithContent: { domain: string; content: string }[] = [];
  
  for (const u of unknowns) {
    const domain = u.domain;
    // Convert domain to filename (e.g., century21.es -> century21_es.html)
    const filename = domain.replace(/\./g, '_') + '.html';
    const filepath = path.join(HOMEPAGE_DIR, filename);
    
    if (fs.existsSync(filepath)) {
      const html = fs.readFileSync(filepath, 'utf-8');
      const text = extractTextFromHtml(html);
      if (text.length > 100) {
        domainsWithContent.push({ domain, content: text });
      }
    }
  }

  console.log(`✅ Found homepage content for ${domainsWithContent.length} domains`);
  console.log('');

  if (domainsWithContent.length === 0) {
    console.log('❌ No homepage content found!');
    process.exit(1);
  }

  // Send ALL to Gemini in one call
  console.log('🤖 Sending to Gemini 3 Pro Preview...');

  const prompt = `You are a real estate website classifier. Analyze these Spanish real estate agency homepages and classify each one.

For EACH domain, determine:
- **listing_types**: "sale", "rent", "both", or "not_listings"
- **confidence**: "high", "medium", or "low"  
- **reasoning**: Brief explanation

Look for Spanish keywords:
- SALE: venta, comprar, compra, en venta, for sale, pisos en venta, casas en venta
- RENT: alquiler, alquilar, en alquiler, for rent, pisos en alquiler
- If both types mentioned or unclear: "both"
- If not a real estate listings site: "not_listings"

HOMEPAGE CONTENT FOR ${domainsWithContent.length} DOMAINS:

${JSON.stringify(domainsWithContent.map(d => ({
  domain: d.domain,
  homepage_text: d.content.substring(0, 3000)
})), null, 2)}

Respond with JSON array:
[{"domain": "...", "listing_types": "...", "confidence": "...", "reasoning": "..."}, ...]`;

  const responseText = await callGemini(prompt);
  
  let classifications: GeminiClassification[];
  try {
    let jsonStr = responseText;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    }
    classifications = JSON.parse(jsonStr);
  } catch (e) {
    console.error('❌ Parse error:', responseText.substring(0, 500));
    process.exit(1);
  }

  console.log(`✅ Got ${classifications.length} classifications`);
  console.log('');

  // Count
  let sale = 0, rent = 0, both = 0, notListings = 0, unknown = 0;
  for (const c of classifications) {
    if (c.listing_types === 'sale') sale++;
    else if (c.listing_types === 'rent') rent++;
    else if (c.listing_types === 'both') both++;
    else if (c.listing_types === 'not_listings') notListings++;
    else unknown++;
  }

  console.log('📈 Homepage Classifications:');
  console.log(`   🏠 Sale Only:      ${sale}`);
  console.log(`   🔑 Rent Only:      ${rent}`);
  console.log(`   🏠🔑 Both:         ${both}`);
  console.log(`   🚫 Not Listings:   ${notListings}`);
  console.log(`   ❓ Still Unknown:  ${unknown}`);
  console.log('');

  // Show samples
  console.log('📋 Sample Results:');
  for (const c of classifications.slice(0, 10)) {
    const emoji = c.listing_types === 'sale' ? '🏠' :
                  c.listing_types === 'rent' ? '🔑' :
                  c.listing_types === 'both' ? '🏠🔑' :
                  c.listing_types === 'not_listings' ? '🚫' : '❓';
    console.log(`   ${emoji} ${c.domain.padEnd(35)} → ${c.listing_types}`);
    console.log(`      ${c.reasoning.substring(0, 60)}`);
  }
  console.log('');

  // Merge with existing data
  console.log('📝 Merging into final output...');
  
  const existingData = parse(fs.readFileSync(FULL_DATA_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  const lookup = new Map<string, GeminiClassification>();
  for (const c of classifications) lookup.set(c.domain, c);

  const updatedData = existingData.map((row: any) => {
    const g = lookup.get(row.domain);
    if (g && row.listing_types === 'unknown') {
      return {
        ...row,
        listing_types: g.listing_types,
        confidence: g.confidence,
        error_details: `Homepage: ${g.reasoning.substring(0, 80)}`
      };
    }
    return row;
  });

  // Write final output
  const headers = Object.keys(updatedData[0]);
  let csvContent = headers.join(',') + '\n';
  for (const row of updatedData) {
    csvContent += stringify([headers.map(h => row[h] || '')]);
  }
  fs.writeFileSync(OUTPUT_CSV, csvContent);

  console.log('');
  console.log('✅ Final results saved to:', OUTPUT_CSV);
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});

