import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const OUTPUT_FILE = 'domains_fotocasa.csv';
const DELAY_MIN = 2000; // 2 seconds
const DELAY_MAX = 5000; // 5 seconds
const MAX_RETRIES = 3;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// --- Helpers ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = () => {
  const delay = Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1) + DELAY_MIN);
  return sleep(delay);
};

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        }
      });

      if (response.status === 429 || response.status === 403) {
        console.log(`⚠️  Blocked/Rate Limited (${response.status}). Waiting 30s...`);
        await sleep(30000);
        continue;
      }

      if (!response.ok) {
        console.error(`❌ HTTP Error ${response.status} for ${url}`);
        return null;
      }

      return await response.text();
    } catch (error: any) {
      console.error(`❌ Network Error: ${error.message}`);
      await sleep(5000);
    }
  }
  return null;
}

// --- Main Logic ---

async function main() {
  console.log('🚀 Starting FREE Fotocasa Harvester...');
  
  // 1. Parse Provinces from provided HTML file
  const provincesFile = path.join(process.cwd(), 'data', 'Real estate agency search engine in Spain _ Fotocasa.html');
  if (!fs.existsSync(provincesFile)) {
    console.error('❌ Source HTML file not found!');
    return;
  }

  const html = fs.readFileSync(provincesFile, 'utf-8');
  const $ = cheerio.load(html);
  const provinceLinks = $('.re-SharedSeoFooterTabs-list a.sui-LinkBasic');
  
  const provinces: { name: string; url: string }[] = [];
  provinceLinks.each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      provinces.push({
        name: $(el).text().trim(),
        url: href.startsWith('http') ? href : `https://www.fotocasa.es${href}`
      });
    }
  });

  console.log(`📍 Found ${provinces.length} provinces to scan.`);

  // Initialize output file
  if (!fs.existsSync(OUTPUT_FILE)) {
    fs.writeFileSync(OUTPUT_FILE, 'Province,Agency Name,Fotocasa URL,Website,Email,Phone\n');
  }

  // Process each province
  for (const province of provinces) {
    console.log(`\n📂 Processing Province: ${province.name}`);
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const listUrl = page === 1 ? province.url : `${province.url}/${page}`; // Adjust pagination pattern if needed
      // NOTE: Fotocasa pagination usually adds /l/2, /l/3 etc. or just /2, /3. 
      // The base URL in the file is like `/buscar-agencias-inmobiliarias/albacete-provincia/todas-las-zonas/l`
      // Pagination for list usually appends `/2`, `/3` after `/l`.
      // Let's assume standard pattern and check for 404/empty to stop.
      // Actually, the URL provided is `/l`. Pagination is typically `/l/2`.
      
      const pageUrl = page === 1 ? province.url : `${province.url}/${page}`;
      console.log(`   📄 Scanning Page ${page}...`);

      const pageHtml = await fetchWithRetry(pageUrl);
      if (!pageHtml) break;

      const $page = cheerio.load(pageHtml);
      
      // Select Agency Cards (Selectors based on previous successful test)
      // In test-fotocasa.ts, we found 6 agencies.
      // We need to select the link to the Detail Page.
      // Classes might be `re-Card-link` or similar.
      const agencyLinks = $('article a').toArray().map(el => $(el).attr('href')).filter(href => href && href.includes('/inmobiliaria-'));
      
      // Deduplicate links
      const uniqueAgencyLinks = [...new Set(agencyLinks)];
      
      if (uniqueAgencyLinks.length === 0) {
        console.log('   ⚠️  No agencies found on this page. Ending province scan.');
        hasNextPage = false;
        break;
      }

      console.log(`   Found ${uniqueAgencyLinks.length} agencies. Harvesting details...`);

      for (const agencyPath of uniqueAgencyLinks) {
        const agencyUrl = agencyPath!.startsWith('http') ? agencyPath! : `https://www.fotocasa.es${agencyPath}`;
        
        // Polite delay before detail page
        await randomDelay();
        process.stdout.write(`      Visiting ${agencyUrl.split('/').pop()}... `);

        const detailHtml = await fetchWithRetry(agencyUrl);
        if (detailHtml) {
          const $detail = cheerio.load(detailHtml);
          
          const name = $('h1').text().trim();
          // Extract Website
          // Look for links with text "Web" or class containing "website"
          let website = '';
          const webLink = $('a[href^="http"]').filter((_, el) => $(el).text().toLowerCase().includes('web') || $(el).attr('class')?.includes('web') || false).first();
          if (webLink.length) {
            website = webLink.attr('href') || '';
          } else {
             // Fallback: Look for any external link that is not fotocasa/facebook/twitter etc.
             const candidates = $('a[href^="http"]').toArray();
             for (const el of candidates) {
                 const href = $(el).attr('href') || '';
                 if (!href.includes('fotocasa.es') && !href.includes('adevinta') && !href.includes('facebook') && !href.includes('twitter') && !href.includes('instagram') && !href.includes('linkedin') && !href.includes('youtube') && !href.includes('google')) {
                     website = href;
                     break;
                 }
             }
          }

          // Extract Phone (Optional)
          const phone = $('.re-ContactDetail-phone').text().trim() || '';

          if (website) {
            console.log(`✅ FOUND: ${website}`);
            // Save to CSV
            const csvLine = `"${province.name}","${name.replace(/"/g, '""')}","${agencyUrl}","${website}","","${phone}"\n`;
            fs.appendFileSync(OUTPUT_FILE, csvLine);
          } else {
            console.log('⚪ No website');
          }
        }
      }

      // Check for next page button or logic
      const nextButton = $('.sui-MoleculePagination-nextButton:not([disabled])');
      if (nextButton.length === 0 && page > 1) { // Safety stop if no explicit next button
         // Or if we found 0 agencies, we break above.
         // If we found agencies, we assume there might be a next page unless we check pagination explicitly.
         // Let's assume if we found < 20 agencies (typical page size), it's the last page.
         if (uniqueAgencyLinks.length < 10) { // Conservative check
             hasNextPage = false;
         }
      }
      
      page++;
      // Safety limit per province for testing
      if (page > 50) hasNextPage = false; 
      
      // Delay between pages
      await randomDelay();
    }
  }
  
  console.log('✅ Harvest Complete!');
}

main();
