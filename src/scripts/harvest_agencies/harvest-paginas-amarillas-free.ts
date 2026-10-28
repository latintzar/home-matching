import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const OUTPUT_FILE = 'domains_paginas_amarillas.csv';
const DELAY_MIN = 2000; // 2 seconds
const DELAY_MAX = 5000; // 5 seconds
const MAX_RETRIES = 2;
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
        console.log(`⚠️  Blocked/Rate Limited (${response.status}). Waiting 15s...`);
        await sleep(15000);
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
  console.log('🚀 Starting FREE Paginas Amarillas Harvester...');
  
  const startUrl = 'https://www.paginasamarillas.es/search/inmobiliarias/all-ma/all-pr/all-is/all-ci/all-ba/all-pu/all-nc/1?what=inmobiliarias';
  
  // Initialize output file
  if (!fs.existsSync(OUTPUT_FILE)) {
    fs.writeFileSync(OUTPUT_FILE, 'Name,Website,Phone,Address\n');
  }

  let page = 1;
  let hasNextPage = true;
  let totalFound = 0;

  while (hasNextPage) {
    const pageUrl = `https://www.paginasamarillas.es/search/inmobiliarias/all-ma/all-pr/all-is/all-ci/all-ba/all-pu/all-nc/${page}?what=inmobiliarias`;
    console.log(`\n📄 Scanning Page ${page}...`);

    const html = await fetchWithRetry(pageUrl);
    if (!html) {
        console.log('🛑 Failed to fetch page. Stopping.');
        break;
    }

    const $ = cheerio.load(html);
    
    // Select Business Cards
    const cards = $('.listado-item'); // Based on standard Paginas Amarillas structure, usually 'listado-item' or 'box'
    // Let's try to find the specific container based on the snippet provided by user
    // The snippet shows structure like: 
    // <div class="box"> ... <span itemprop="name"> ... </div>
    // Wait, the snippet provided is text, not raw HTML classes.
    // Standard Paginas Amarillas usually uses `ul.listado-empresas > li` or `.box`.
    
    // Let's look for the "Web" link specifically as requested.
    // <a class="... web ..." href="...">Web</a>
    
    // Actually, let's count items first to see if selectors work.
    // The snippet had `Inmobiliarias (64.629)` - wait, 64k results? 
    // User said "65 businesses total in there". 
    // Ah, "64.629 resultados" in the snippet implies 64,000 results nationwide.
    // User might be misreading "64.629" as "65"? Or looking at a filtered view?
    // The URL `all-pr` implies "all provinces". So it IS 64k results.
    
    // If it's 64k results, that's ~2,000 pages (30 per page).
    // That's A LOT.
    
    // Let's just process what we see.
    
    const items = $('li[itemtype="http://schema.org/LocalBusiness"], .box'); 
    // Let's try a more generic selector for the items
    const businessItems = $('.listado-item');

    if (businessItems.length === 0) {
        // Fallback to searching for "Web" links directly if card selector fails
        const webLinks = $('a').filter((i, el) => $(el).text().trim() === 'Web');
        console.log(`   Found ${webLinks.length} 'Web' links directly.`);
        
        if (webLinks.length === 0) {
             console.log('   ⚠️  No items found. Content might be JS rendered or blocked.');
             // Check for "no results" text
             if (html.includes('No se han encontrado resultados')) {
                 console.log('   ⚪ End of results.');
                 hasNextPage = false;
             }
        } else {
            // Extract from links
             webLinks.each((i, el) => {
                const url = $(el).attr('href');
                // Need to find name - usually in a parent header
                const name = $(el).closest('.box').find('span[itemprop="name"]').text().trim() || "Unknown";
                if (url) {
                    fs.appendFileSync(OUTPUT_FILE, `"${name}","${url}","",""\n`);
                    totalFound++;
                }
             });
        }

    } else {
        console.log(`   Found ${businessItems.length} business cards.`);
        
        businessItems.each((i, el) => {
            const name = $(el).find('span[itemprop="name"], h2, .titulo-nombre').text().trim();
            // Web link
            const webLink = $(el).find('a').filter((j, a) => $(a).text().trim() === 'Web' || $(a).attr('title') === 'Web').attr('href');
            const phone = $(el).find('.telefono, .phone').text().trim();
            const address = $(el).find('.direccion, .address').text().trim();

            if (webLink) {
                console.log(`   ✅ ${name}: ${webLink}`);
                fs.appendFileSync(OUTPUT_FILE, `"${name.replace(/"/g, '""')}","${webLink}","${phone}","${address.replace(/"/g, '""')}"\n`);
                totalFound++;
            }
        });
    }

    // Check for Next Page
    // Paginas Amarillas usually has a pagination block. 
    // If we found 0 items, we stop.
    if (businessItems.length === 0) {
         // Retry one more time? No, if 0 items, it's likely blocked or empty.
         console.log('   ⚠️  Stopping due to 0 items found (Blocked or End).');
         break;
    }

    page++;
    if (page > 5) { // Safety cap for first test run
        console.log('   ⏸️  Paused after 5 pages for safety check.');
        hasNextPage = false;
    }
    
    await randomDelay();
  }
  
  console.log(`\n✅ Harvest Complete. Found ${totalFound} websites.`);
}

main();

