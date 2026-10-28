
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// --- Configuration ---
const INPUT_CSV = 'domains_cse.csv';
const OUTPUT_DIR = 'data/agency_homepages';
const STATUS_CSV = 'data/agency_homepages_status.csv';
const CONCURRENCY = 20; // Number of concurrent downloads
const TIMEOUT_MS = 15000; // 15 seconds timeout
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- Interfaces ---
interface DomainRecord {
  Domain: string;
  URL: string;
  Title: string;
  Snippet: string;
  SourceQuery: string;
}

interface StatusRecord {
  domain: string;
  url: string;
  status: 'success' | 'error' | 'blocked' | 'timeout' | 'skipped';
  statusCode?: number;
  filepath?: string;
  errorDetails?: string;
  timestamp: string;
}

// --- Main Script ---
async function main() {
  console.log('🚀 Starting Homepage Downloader...');

  // 1. Prepare directories
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 2. Read Input CSV
  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`❌ Input file not found: ${INPUT_CSV}`);
    process.exit(1);
  }
  const inputContent = fs.readFileSync(INPUT_CSV, 'utf-8');
  const records: DomainRecord[] = parse(inputContent, {
    columns: true,
    skip_empty_lines: true,
  });
  console.log(`📋 Found ${records.length} records in ${INPUT_CSV}`);

  // 3. Deduplicate by URL
  const uniqueRecords = new Map<string, DomainRecord>();
  records.forEach(r => {
    if (!uniqueRecords.has(r.URL)) {
      uniqueRecords.set(r.URL, r);
    }
  });
  console.log(`ℹ️ Unique URLs to process: ${uniqueRecords.size}`);
  const queue = Array.from(uniqueRecords.values());

  // 4. Load existing status to resume (optional but good)
  const processedUrls = new Set<string>();
  if (fs.existsSync(STATUS_CSV)) {
    const statusContent = fs.readFileSync(STATUS_CSV, 'utf-8');
    try {
      const statusRecords = parse(statusContent, { columns: true, skip_empty_lines: true });
      statusRecords.forEach((r: any) => processedUrls.add(r.url));
      console.log(`⏩ Skipping ${processedUrls.size} already processed URLs.`);
    } catch (e) {
      console.warn('⚠️ Could not parse existing status CSV. Starting fresh/appending.');
    }
  }

  // Filter out processed
  const toProcess = queue.filter(r => !processedUrls.has(r.URL));
  console.log(`🎯 ${toProcess.length} URLs remaining to download.`);

  // 5. Process in Batches
  let completed = 0;
  const total = toProcess.length;
  
  // Create output CSV stream or append
  const writeHeader = !fs.existsSync(STATUS_CSV);
  
  if (writeHeader) {
    fs.writeFileSync(STATUS_CSV, 'domain,url,status,statusCode,filepath,errorDetails,timestamp\n');
  }

  // Concurrency Helper
  async function processBatch(batch: DomainRecord[]) {
    const promises = batch.map(async (record) => {
      const result = await downloadHomepage(record);
      
      // Write result to CSV immediately
      const csvLine = stringify([[
        result.domain,
        result.url,
        result.status,
        result.statusCode || '',
        result.filepath || '',
        result.errorDetails || '',
        result.timestamp
      ]]);
      fs.appendFileSync(STATUS_CSV, csvLine);
      
      completed++;
      if (completed % 50 === 0) {
        console.log(`⏳ Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
      }
    });
    await Promise.all(promises);
  }

  // Run batches
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  console.log('✅ Download complete!');
}

async function downloadHomepage(record: DomainRecord): Promise<StatusRecord> {
  const sanitizeFilename = (str: string) => str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${sanitizeFilename(record.Domain)}.html`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const statusResult: StatusRecord = {
    domain: record.Domain,
    url: record.URL,
    status: 'error',
    timestamp: new Date().toISOString()
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(record.URL, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    statusResult.statusCode = response.status;

    if (response.ok) {
      const html = await response.text();
      fs.writeFileSync(filepath, html);
      statusResult.status = 'success';
      statusResult.filepath = filepath;
    } else if (response.status === 403 || response.status === 429) {
      statusResult.status = 'blocked';
      statusResult.errorDetails = `HTTP ${response.status}`;
    } else {
      statusResult.status = 'error';
      statusResult.errorDetails = `HTTP ${response.status}`;
    }

  } catch (error: any) {
    if (error.name === 'AbortError') {
      statusResult.status = 'timeout';
      statusResult.errorDetails = 'Request timed out';
    } else {
      statusResult.status = 'error';
      statusResult.errorDetails = error.message;
    }
  }

  return statusResult;
}

main().catch(console.error);

