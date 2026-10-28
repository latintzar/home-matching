
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const CONCURRENCY = 8; // 8 parallel downloads
const INPUT_FILE = 'urls_to_scrape.txt';
const OUTPUT_DIR = 'data/pricing_htmls';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const urls = fs.readFileSync(INPUT_FILE, 'utf-8').split('\n').filter(Boolean);
console.log(`Loaded ${urls.length} URLs.`);

let completed = 0;
let active = 0;
let index = 0;

function download(url) {
  return new Promise((resolve) => {
    const filename = url.split('/').pop() + '.html';
    const filepath = path.join(OUTPUT_DIR, filename);
    
    if (fs.existsSync(filepath)) {
      // console.log(`Skipping ${filename} (exists)`);
      resolve();
      return;
    }

    // curl with timeout 10s
    exec(`curl -s -L -A "Mozilla/5.0" -m 10 -o "${filepath}" "${url}"`, (error) => {
      if (error) {
        console.error(`Failed ${url}: ${error.message}`);
      } else {
        // console.log(`Downloaded ${filename}`);
      }
      resolve();
    });
  });
}

async function worker() {
  while (index < urls.length) {
    const url = urls[index++];
    active++;
    await download(url);
    completed++;
    active--;
    if (completed % 50 === 0) {
        process.stdout.write(`Progress: ${completed}/${urls.length} (${Math.round(completed/urls.length*100)}%)\r`);
    }
  }
}

async function main() {
  console.log(`Starting scrape with ${CONCURRENCY} workers...`);
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  console.log('\nScrape Complete!');
}

main();
