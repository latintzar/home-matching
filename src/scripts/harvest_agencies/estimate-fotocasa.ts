// Estimate Fotocasa scraping costs based on directory structure
// Usage: npx tsx src/scripts/harvest_agencies/estimate-fotocasa.ts

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

function estimateFotocasa() {
  console.log(`\n🇪🇸 Fotocasa Real Estate Harvest Estimation\n`);

  // 1. Parse the provided HTML file to get the directory links
  const filePath = path.join(process.cwd(), 'data', 'Real estate agency search engine in Spain _ Fotocasa.html');
  
  if (!fs.existsSync(filePath)) {
    console.error('Error: HTML file not found at:', filePath);
    return;
  }

  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  // Find links in the footer list (re-SharedSeoFooter)
  const provinceLinks = $('.re-SharedSeoFooterTabs-list a.sui-LinkBasic');
  
  console.log(`Found ${provinceLinks.length} Province/Region links in the footer.`);
  
  const provinces = [];
  provinceLinks.each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && href.includes('/buscar-agencias-inmobiliarias/')) {
      provinces.push({ name: text, url: href });
    }
  });

  console.log(`Unique Provinces extracted: ${provinces.length}`);
  
  // Estimates
  // Total Agencies (Conservative estimate, similar to Idealista/Google)
  const TOTAL_AGENCIES = 15000;
  const AGENCIES_PER_PAGE = 20; // Fotocasa usually lists 20 per page
  
  const totalListPages = Math.ceil(TOTAL_AGENCIES / AGENCIES_PER_PAGE);
  
  // Scrape Volume
  // 1. Province List Page (1)
  // 2. Pagination Pages (N)
  // 3. Detail Pages (Not always needed if website is on list card - Checking...)
  
  // Checking if website is typically on the list card...
  // Based on previous tests, Fotocasa cards often have "Contact" buttons but obfuscate the website URL or require a click.
  // Assuming we need to visit the detail page for the website URL to be safe.
  
  const totalScrapes = totalListPages + TOTAL_AGENCIES; // List pages + Detail pages
  
  // Cost Calculation (Scrapfly @ $0.01/scrape for JS rendering)
  // Fotocasa is React-heavy, so JS rendering is likely required.
  const COST_PER_SCRAPE_JS = 5; // Scrapfly API credits (usually 5 for JS rendering)
  const TOTAL_CREDITS = totalScrapes * COST_PER_SCRAPE_JS;
  
  // Price varies, but roughly $30 for 300k credits? Or is it $30 for 3000 scrapes?
  // User said: "3000 scrapes cost me 30 dollars" -> $0.01 per scrape.
  // If JS rendering costs 5 credits vs 1 credit for static... let's assume $0.05 per scrape?
  // Or if "3000 scrapes" meant successful API calls regardless of credits.
  
  // Let's use the user's baseline: 3000 scrapes = $30.
  const costUsd = (totalScrapes / 3000) * 30;

  console.log(`\n--- Scraping Volume (Fotocasa) ---`);
  console.log(`Total Agencies (Est.): ${TOTAL_AGENCIES.toLocaleString()}`);
  console.log(`List Pages: ${totalListPages}`);
  console.log(`Detail Pages: ${TOTAL_AGENCIES}`);
  console.log(`Total Scrapes: ${totalScrapes.toLocaleString()}`);
  
  console.log(`\n--- Estimated Cost ---`);
  console.log(`Based on your rate ($30 per 3000 scrapes):`);
  console.log(`Estimated Total: $${costUsd.toLocaleString()} USD`);
  
  console.log(`\nNOTE: This assumes 1 scrape per detail page.`);
}

estimateFotocasa();

