
import { NextRequest, NextResponse } from 'next/server';

// Domains to test
const DOMAINS = [
  'idealista.com',
  'fotocasa.es',
  'savills.es',
  'lucasfox.es',
  'engelvoelkers.com',
  'remax.es',
  'century21.es',
  'donpiso.com',
  'tecnocasa.es',
  'inmoweb.es', // Generic/smaller
  'habitaclia.com'
];

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

export async function GET(request: NextRequest) {
  if (!SCRAPINGDOG_API_KEY) {
    return NextResponse.json({ error: 'SCRAPINGDOG_API_KEY is missing in environment variables' }, { status: 500 });
  }

  const results = [];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000';

  console.log('🚀 Starting Universal Extraction Test Suite...');

  for (const domain of DOMAINS) {
    try {
      console.log(`\n🔎 Searching for listing on ${domain}...`);
      
      // 1. Get URL via ScrapingDog Google Search
      const query = `site:${domain} piso en venta madrid`;
      const searchUrl = `https://api.scrapingdog.com/google/?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(query)}&results=1&country=es`;
      
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        throw new Error(`ScrapingDog Search Failed: ${searchRes.status}`);
      }
      
      const searchData = await searchRes.json();
      const listingUrl = searchData.organic_results?.[0]?.link;
      
      if (!listingUrl) {
        console.warn(`⚠️ No results found for ${domain}`);
        results.push({ domain, status: 'skipped', reason: 'No URL found' });
        continue;
      }

      console.log(`🔗 Found URL: ${listingUrl}`);

      // 2. Call Universal Scraper (Preview Mode)
      console.log(`🕷️ Scraping ${listingUrl}...`);
      const scrapeRes = await fetch(`${baseUrl}/api/scrape/universal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl, preview: true })
      });

      const scrapeData = await scrapeRes.json();
      
      if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Scrape failed');
      }

      const data = scrapeData.data;
      const agency = data.agency;

      console.log(`✅ Extracted Data for ${domain}:`);
      console.log(`   - Title: ${data.title}`);
      console.log(`   - Agency Name: ${agency?.name || 'Not Found'}`);
      console.log(`   - Agency Logo: ${agency?.logo_url ? '✅ Found' : '❌ Missing'}`);

      results.push({
        domain,
        url: listingUrl,
        status: 'success',
        title: data.title,
        agency: {
          name: agency?.name,
          logo_found: !!agency?.logo_url,
          logo_url: agency?.logo_url
        }
      });

    } catch (error: any) {
      console.error(`❌ Error testing ${domain}:`, error.message);
      results.push({ domain, status: 'error', error: error.message });
    }
  }

  return NextResponse.json({
    summary: 'Universal Extraction Test Complete',
    results
  });
}

