/**
 * TEST PARSING - Verify we can extract real data from real HTML
 * 
 * Downloads a few sample pages and shows what we can extract
 */

import * as cheerio from 'cheerio';

// Test URLs from different agencies
const TEST_URLS = [
  'https://www.donpiso.com/comprar/pisos/barcelona/',
  'https://www.tecnocasa.es/venta/pisos/madrid/madrid.html',
  'https://www.century21.es/comprar/viviendas/madrid/',
];

interface ParsedListing {
  url: string;
  title?: string;
  price?: string;
  location?: string;
  bedrooms?: string;
  bathrooms?: string;
  sqm?: string;
  images: string[];
  rawText?: string;
}

// Common selectors to try for each field
const SELECTORS = {
  price: [
    '.price', '.precio', '[class*="price"]', '[class*="precio"]',
    '.listing-price', '.property-price', '.amount',
    'span[itemprop="price"]', '[data-price]', '.value-price'
  ],
  title: [
    'h1', '.title', '.listing-title', '.property-title',
    '[itemprop="name"]', '.headline'
  ],
  bedrooms: [
    '[class*="bedroom"]', '[class*="habitacion"]', '[class*="dormitorio"]',
    '.beds', '.rooms', '[class*="room"]'
  ],
  bathrooms: [
    '[class*="bathroom"]', '[class*="baño"]', '[class*="bano"]',
    '.baths', '[class*="bath"]'
  ],
  sqm: [
    '[class*="area"]', '[class*="superficie"]', '[class*="size"]',
    '[class*="m2"]', '[class*="metros"]', '.sqm'
  ],
  images: [
    'img[src*="foto"]', 'img[src*="photo"]', 'img[src*="image"]',
    'img[data-src]', '.gallery img', '.slider img', '.carousel img',
    '[class*="gallery"] img', 'img[class*="listing"]'
  ],
  location: [
    '.location', '.address', '.ubicacion', '.direccion',
    '[itemprop="address"]', '[class*="location"]', '[class*="address"]'
  ]
};

function trySelectors($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length) {
      const text = el.text().trim();
      if (text && text.length > 0 && text.length < 500) {
        return text;
      }
    }
  }
  return undefined;
}

function extractImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];
  
  // Try various image selectors
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder')) {
      if (src.startsWith('http') || src.startsWith('//')) {
        images.push(src.startsWith('//') ? 'https:' + src : src);
      }
    }
  });
  
  return [...new Set(images)].slice(0, 10); // Unique, max 10
}

function extractPriceFromText(text: string): string | undefined {
  // Look for price patterns
  const patterns = [
    /€\s*([\d.,]+)/,
    /([\d.,]+)\s*€/,
    /EUR\s*([\d.,]+)/,
    /([\d.,]+)\s*EUR/,
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:€|euros?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return '€' + match[1];
    }
  }
  return undefined;
}

function parseHtml(url: string, html: string): ParsedListing {
  const $ = cheerio.load(html);
  
  // Remove scripts and styles
  $('script, style, noscript').remove();
  
  const result: ParsedListing = {
    url,
    images: extractImages($),
  };
  
  // Try to extract each field
  result.title = trySelectors($, SELECTORS.title);
  result.price = trySelectors($, SELECTORS.price);
  result.location = trySelectors($, SELECTORS.location);
  result.bedrooms = trySelectors($, SELECTORS.bedrooms);
  result.bathrooms = trySelectors($, SELECTORS.bathrooms);
  result.sqm = trySelectors($, SELECTORS.sqm);
  
  // If no price found, try extracting from body text
  if (!result.price) {
    const bodyText = $('body').text();
    result.price = extractPriceFromText(bodyText);
  }
  
  // Get some raw text for context
  result.rawText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 500);
  
  return result;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es,en;q=0.9',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PARSING TEST - Can we extract real data?');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const url of TEST_URLS) {
    console.log(`\n🔍 Testing: ${url}`);
    console.log('─'.repeat(60));
    
    const html = await fetchHtml(url);
    if (!html) continue;
    
    console.log(`  ✅ Downloaded ${(html.length / 1024).toFixed(1)} KB`);
    
    const parsed = parseHtml(url, html);
    
    console.log('\n  📊 EXTRACTED DATA:');
    console.log(`     Title:     ${parsed.title || '❌ Not found'}`);
    console.log(`     Price:     ${parsed.price || '❌ Not found'}`);
    console.log(`     Location:  ${parsed.location || '❌ Not found'}`);
    console.log(`     Bedrooms:  ${parsed.bedrooms || '❌ Not found'}`);
    console.log(`     Bathrooms: ${parsed.bathrooms || '❌ Not found'}`);
    console.log(`     Size:      ${parsed.sqm || '❌ Not found'}`);
    console.log(`     Images:    ${parsed.images.length} found`);
    
    if (parsed.images.length > 0) {
      console.log(`                ${parsed.images[0].slice(0, 60)}...`);
    }
    
    // Show snippet of raw text
    console.log(`\n  📝 RAW TEXT SAMPLE:`);
    console.log(`     "${parsed.rawText?.slice(0, 200)}..."`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
  The parsing uses Cheerio (fast, local, FREE).
  
  For complex sites where selectors don't work:
  - Option 1: Add site-specific selectors (manual, free)
  - Option 2: Use Gemini to parse ONE page, learn selectors
  - Option 3: Store raw HTML, parse later when needed
  
  For harvesting: We can store HTML now, parse later.
  No need to get parsing perfect on day 1.
  `);
}

main().catch(console.error);

