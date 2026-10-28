
const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('data/habitissimo_prices.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const outStream = fs.createWriteStream('data/habitissimo_prices_fixed.jsonl');

  for await (const line of rl) {
    try {
      const record = JSON.parse(line);
      
      // Transform record to match Vertex AI Search expectations
      const newRecord = {
        id: record.id,
        // 'content' is the required field for default content config
        // We combine title and description for better searchability
        content: `${record.title}\n${record.description}`,
        
        // Keep original metadata for retrieval
        title: record.title,
        description: record.description,
        price_avg: record.price_avg,
        price_min: record.price_min,
        price_max: record.price_max,
        url: record.url,
        
        // Struct data for filtering if needed later
        structData: {
            price_avg: record.price_avg
        }
      };

      outStream.write(JSON.stringify(newRecord) + '\n');
    } catch (err) {
      console.error('Error parsing line:', line, err);
    }
  }
  
  console.log('Transformation complete: data/habitissimo_prices_fixed.jsonl');
}

processLineByLine();

