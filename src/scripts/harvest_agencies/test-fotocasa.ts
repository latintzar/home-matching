import * as cheerio from 'cheerio';

async function testFotocasa() {
  const urls = [
    'https://www.fotocasa.es/es/inmobiliarias',
    'https://www.fotocasa.es/es/inmobiliarias/madrid-provincia/todas-las-zonas/l',
    'https://www.fotocasa.es/es/inmobiliarias/madrid',
    'https://www.fotocasa.es/agencias-inmobiliarias/madrid-provincia',
    'https://www.fotocasa.es/es/comprar/inmobiliarias/madrid-provincia/todas-las-zonas/l'
  ];

  console.log(`Testing Fotocasa URL patterns...`);

  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $('title').text().trim();
        console.log(`Title: ${title}`);
        
        // Check for agency cards
        const agencies = $('article, .re-Card, .sui-Card').length;
        console.log(`Potential Agencies found: ${agencies}`);
      } else {
        // console.log(await response.text());
      }

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
    
    // Polite delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testFotocasa();

