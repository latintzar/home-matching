/**
 * Parse HTML Batch
 * 
 * Main orchestrator for parsing harvested HTML files.
 * Implements Student/Teacher pattern with validation trust loop.
 * 
 * Usage:
 *   npx tsx src/scripts/parsing/parse-html-batch.ts [--limit 1000] [--domain example.com]
 */

import * as zlib from 'zlib';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';

import { ScrapingRule, ParsedListing } from './types';
import { parseWithCheerio, validateParsedResult, suggestSelectors } from './cheerio-parser';
import { learnSelectors, extractWithLLM, validateExtraction, generateListingId } from './bedrock-teacher';

// Recipient configuration is supplied by tools/runtime-env.py.
// AWS Clients
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
}));

// Constants
const S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const TRUST_THRESHOLD = 10;  // Selectors trusted after 10 consecutive successes
const BATCH_SIZE = 50;       // Process in batches

// Table names (existing tables with leo- prefix)
const TABLES = {
  SCRAPING_RULES: 'leo-scraping-rules',
  LISTINGS: 'leo-listings',
};

// Stats
interface ParseStats {
  total: number;
  parsed: number;
  cheerio_success: number;
  llm_used: number;
  failures: number;
  new_rules_learned: number;
}

/**
 * Get or create scraping rule for a domain
 */
async function getScrapingRule(domain: string): Promise<ScrapingRule | null> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: TABLES.SCRAPING_RULES,
      Key: { domain },
    }));
    return result.Item as ScrapingRule | undefined || null;
  } catch {
    return null;
  }
}

/**
 * Save scraping rule
 */
async function saveScrapingRule(rule: ScrapingRule): Promise<void> {
  await dynamoClient.send(new PutCommand({
    TableName: TABLES.SCRAPING_RULES,
    Item: rule,
  }));
}

/**
 * Update trust level for a rule
 */
async function updateTrustLevel(domain: string, success: boolean): Promise<void> {
  if (success) {
    await dynamoClient.send(new UpdateCommand({
      TableName: TABLES.SCRAPING_RULES,
      Key: { domain },
      UpdateExpression: 'SET trust_level = trust_level + :inc, last_validated = :now, validation_failures = :zero',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': new Date().toISOString(),
        ':zero': 0,
      },
    }));
  } else {
    await dynamoClient.send(new UpdateCommand({
      TableName: TABLES.SCRAPING_RULES,
      Key: { domain },
      UpdateExpression: 'SET trust_level = :zero, validation_failures = validation_failures + :inc',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
      },
    }));
  }
}

/**
 * Save parsed listing to DynamoDB
 */
async function saveParsedListing(listing: ParsedListing): Promise<void> {
  await dynamoClient.send(new PutCommand({
    TableName: TABLES.LISTINGS,
    Item: listing,
  }));
}

/**
 * Download and decompress HTML from S3
 */
async function getHtmlFromS3(key: string): Promise<string | null> {
  try {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    
    const bodyBuffer = await result.Body?.transformToByteArray();
    if (!bodyBuffer) return null;
    
    // Decompress gzip
    if (key.endsWith('.gz')) {
      const decompressed = zlib.gunzipSync(Buffer.from(bodyBuffer));
      return decompressed.toString('utf-8');
    }
    
    return new TextDecoder().decode(bodyBuffer);
  } catch (error) {
    console.error(`Error fetching ${key}:`, error);
    return null;
  }
}

/**
 * Extract URL from S3 key
 */
function keyToUrl(key: string): string {
  // key format: html/domain.com/path_to_page.html.gz
  const parts = key.replace('html/', '').replace('.html.gz', '').split('/');
  const domain = parts[0];
  const path = parts.slice(1).join('/').replace(/_/g, '/') || '';
  return `https://${domain}/${path}`;
}

/**
 * Parse a single HTML file using Student/Teacher pattern
 */
async function parseHtmlFile(
  s3Key: string,
  stats: ParseStats
): Promise<ParsedListing | null> {
  const domain = s3Key.replace('html/', '').split('/')[0];
  const url = keyToUrl(s3Key);
  
  // Get HTML
  const html = await getHtmlFromS3(s3Key);
  if (!html || html.length < 100) {
    stats.failures++;
    return null;
  }
  
  // Get existing rule
  let rule = await getScrapingRule(domain);
  
  // PHASE 1: Try Cheerio with trusted selectors
  if (rule && rule.trust_level >= TRUST_THRESHOLD) {
    const result = parseWithCheerio(html, url, domain, rule);
    
    if (validateParsedResult(result)) {
      stats.cheerio_success++;
      stats.parsed++;
      
      const listing: ParsedListing = {
        listing_id: generateListingId(url, domain),
        ...result,
        url,
        domain,
        scraped_at: new Date().toISOString(),
        parsed_at: new Date().toISOString(),
        parse_method: 'cheerio',
        confidence: result.confidence || 0.8,
      } as ParsedListing;
      
      return listing;
    }
  }
  
  // PHASE 2: Learn or validate selectors
  if (!rule || Object.keys(rule.selectors).length === 0) {
    // Learn new selectors
    console.log(`  🎓 Learning selectors for ${domain}...`);
    stats.llm_used++;
    
    const selectors = await learnSelectors(html, domain);
    
    rule = {
      domain,
      selectors,
      trust_level: 0,
      last_validated: new Date().toISOString(),
      validation_failures: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await saveScrapingRule(rule);
    stats.new_rules_learned++;
  }
  
  // Try Cheerio with learned selectors
  const cheerioResult = parseWithCheerio(html, url, domain, rule);
  
  // Validate if under trust threshold
  if (rule.trust_level < TRUST_THRESHOLD) {
    stats.llm_used++;
    const validation = await validateExtraction(html, cheerioResult);
    
    if (validation.valid) {
      await updateTrustLevel(domain, true);
      stats.parsed++;
      
      const listing: ParsedListing = {
        listing_id: generateListingId(url, domain),
        ...cheerioResult,
        url,
        domain,
        scraped_at: new Date().toISOString(),
        parsed_at: new Date().toISOString(),
        parse_method: 'hybrid',
        confidence: validation.confidence,
      } as ParsedListing;
      
      return listing;
    } else {
      // Validation failed - re-learn selectors
      await updateTrustLevel(domain, false);
      
      // Fall back to direct LLM extraction
      stats.llm_used++;
      const llmResult = await extractWithLLM(html, url, domain);
      
      if (llmResult.confidence > 0.5) {
        stats.parsed++;
        
        const listing: ParsedListing = {
          listing_id: generateListingId(url, domain),
          ...llmResult.extracted_data,
          url,
          domain,
          scraped_at: new Date().toISOString(),
          parsed_at: new Date().toISOString(),
          parse_method: 'llm',
          confidence: llmResult.confidence,
        } as ParsedListing;
        
        return listing;
      }
    }
  } else if (validateParsedResult(cheerioResult)) {
    stats.cheerio_success++;
    stats.parsed++;
    
    const listing: ParsedListing = {
      listing_id: generateListingId(url, domain),
      ...cheerioResult,
      url,
      domain,
      scraped_at: new Date().toISOString(),
      parsed_at: new Date().toISOString(),
      parse_method: 'cheerio',
      confidence: cheerioResult.confidence || 0.8,
    } as ParsedListing;
    
    return listing;
  }
  
  stats.failures++;
  return null;
}

/**
 * List all HTML files in S3
 */
async function listHtmlFiles(limit?: number, filterDomain?: string): Promise<string[]> {
  const files: string[] = [];
  let continuationToken: string | undefined;
  
  const prefix = filterDomain ? `html/${filterDomain}/` : 'html/';
  
  do {
    const result = await s3Client.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    
    for (const obj of result.Contents || []) {
      if (obj.Key?.endsWith('.html.gz')) {
        files.push(obj.Key);
        if (limit && files.length >= limit) {
          return files;
        }
      }
    }
    
    continuationToken = result.NextContinuationToken;
  } while (continuationToken && (!limit || files.length < limit));
  
  return files;
}

/**
 * Main parsing function
 */
async function main() {
  console.log('🔍 HTML PARSING PIPELINE');
  console.log('========================\n');
  
  // Parse args
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const domainArg = args.find(a => a.startsWith('--domain='));
  
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const filterDomain = domainArg ? domainArg.split('=')[1] : undefined;
  
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Domain filter: ${filterDomain || 'all'}`);
  console.log('');
  
  // List files to parse
  console.log('📋 Listing HTML files...');
  const files = await listHtmlFiles(limit, filterDomain);
  console.log(`Found ${files.length} files to parse\n`);
  
  if (files.length === 0) {
    console.log('No files to parse. Exiting.');
    return;
  }
  
  const stats: ParseStats = {
    total: files.length,
    parsed: 0,
    cheerio_success: 0,
    llm_used: 0,
    failures: 0,
    new_rules_learned: 0,
  };
  
  const startTime = Date.now();
  
  // Process in batches
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}...`);
    
    for (const file of batch) {
      try {
        const listing = await parseHtmlFile(file, stats);
        
        if (listing) {
          await saveParsedListing(listing);
          process.stdout.write('.');
        } else {
          process.stdout.write('x');
        }
      } catch (error) {
        console.error(`\nError parsing ${file}:`, error);
        stats.failures++;
      }
    }
    
    // Progress
    const progress = Math.min(i + BATCH_SIZE, files.length);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = progress / elapsed;
    const eta = (files.length - progress) / rate;
    
    console.log(`\n   Progress: ${progress}/${files.length} (${((progress/files.length)*100).toFixed(1)}%)`);
    console.log(`   Rate: ${rate.toFixed(1)} files/sec, ETA: ${(eta/60).toFixed(1)} min`);
    console.log(`   Cheerio: ${stats.cheerio_success}, LLM: ${stats.llm_used}, Failures: ${stats.failures}`);
  }
  
  // Summary
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log('\n\n========================');
  console.log('📊 PARSING SUMMARY\n');
  console.log(`Total files: ${stats.total}`);
  console.log(`Parsed: ${stats.parsed} (${((stats.parsed/stats.total)*100).toFixed(1)}%)`);
  console.log(`Cheerio success: ${stats.cheerio_success}`);
  console.log(`LLM calls: ${stats.llm_used}`);
  console.log(`Failures: ${stats.failures}`);
  console.log(`New rules learned: ${stats.new_rules_learned}`);
  console.log(`Time: ${(elapsed/60).toFixed(1)} minutes`);
  console.log(`Rate: ${(stats.parsed/elapsed).toFixed(1)} files/sec`);
  
  // Cost estimate
  const llmCost = stats.llm_used * 0.0004;  // ~$0.0004 per Mistral call
  console.log(`\nEstimated LLM cost: $${llmCost.toFixed(2)}`);
}

main().catch(console.error);

