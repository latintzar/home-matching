
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const SOURCE_DIR = path.join(__dirname, '../RAG Sources/habitissimo');
const OUTPUT_FILE = path.join(__dirname, '../data/habitissimo_prices.jsonl');

// Ensure output dir exists
if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
}

// Recursive file walker
function* walkSync(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name));
        } else {
            yield path.join(dir, file.name);
        }
    }
}

console.log(`Scanning ${SOURCE_DIR}...`);
const outStream = fs.createWriteStream(OUTPUT_FILE);
let count = 0;
let successCount = 0;

for (const filePath of walkSync(SOURCE_DIR)) {
    if (!filePath.endsWith('.html')) continue;
    count++;
    
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const $ = cheerio.load(html);
        const filename = path.basename(filePath, '.html');

        let record = {
            id: filename,
            title: filename.replace(/-/g, ' '),
            description: '',
            price_avg: null,
            price_min: null,
            price_max: null,
            url: `https://www.habitissimo.es/presupuestos/${filename}`
        };

        // 1. Try JSON-LD Extraction
        let foundJson = false;
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).html());
                const items = Array.isArray(json) ? json : [json];
                
                // Find Product/Offer
                const product = items.find(item => 
                    item['@type'] === 'Product' && item.offers
                );

                if (product) {
                    record.title = product.name || record.title;
                    record.description = product.description || '';
                    
                    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                    if (offer) {
                        record.price_avg = parseFloat(offer.price);
                        
                        if (offer.priceSpecification) {
                            record.price_min = parseFloat(offer.priceSpecification.minPrice);
                            record.price_max = parseFloat(offer.priceSpecification.maxPrice);
                        }
                    }
                    foundJson = true;
                }
            } catch (e) {}
        });

        // 2. Fallback to Regex / Text
        if (!foundJson || !record.price_avg) {
            const bodyText = $('body').text();
            
            // Title from H1 if not found
            if (!foundJson) {
                const h1 = $('h1').first().text().trim();
                if (h1) record.title = h1;
                
                // Description from meta
                const metaDesc = $('meta[name="description"]').attr('content');
                if (metaDesc) record.description = metaDesc;
            }

            // Regex for prices
            const priceMatch = bodyText.match(/Precio medio\s*([\d.,]+)/i);
            if (priceMatch) record.price_avg = parseFloat(priceMatch[1].replace(',', '.'));

            const rangeMatch = bodyText.match(/Rango de precios\s*([\d.,]+).*?-\s*([\d.,]+)/i);
            if (rangeMatch) {
                record.price_min = parseFloat(rangeMatch[1].replace(',', '.'));
                record.price_max = parseFloat(rangeMatch[2].replace(',', '.'));
            }
        }

        // Only save if we have at least a title
        if (record.title) {
            // Clean up NaN
            if (isNaN(record.price_avg)) record.price_avg = null;
            if (isNaN(record.price_min)) record.price_min = null;
            if (isNaN(record.price_max)) record.price_max = null;

            outStream.write(JSON.stringify(record) + '\n');
            successCount++;
        }
        
        if (count % 100 === 0) process.stdout.write(`Processed ${count} files...\r`);

    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
    }
}

outStream.end();
console.log(`\nDone! Processed ${count} files. Successfully extracted ${successCount} records.`);
console.log(`Output saved to: ${OUTPUT_FILE}`);

