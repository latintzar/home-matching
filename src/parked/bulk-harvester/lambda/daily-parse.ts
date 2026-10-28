/**
 * Daily Parse Lambda
 * 
 * Runs daily to parse new HTML files that haven't been parsed yet.
 * Uses Student/Teacher pattern with Cheerio + Bedrock Mistral.
 * 
 * Schedule: Daily at 4 AM UTC (cron(0 4 * * ? *)) - 1 hour after harvest
 * Timeout: 15 minutes
 * Memory: 1024 MB
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as cheerio from 'cheerio';
import * as zlib from 'zlib';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const S3_BUCKET = process.env.S3_BUCKET || '';
const LISTINGS_TABLE = 'leo-listings';
const SCRAPING_RULES_TABLE = 'leo-scraping-rules';
const TRUST_THRESHOLD = 10;
const MAX_PARSE_PER_RUN = 500;  // Limit per Lambda invocation
const BATCH_SIZE = 20;

interface ScrapingRule {
  domain: string;
  selectors: Record<string, string>;
  trust_level: number;
  last_validated: string;
}

interface ParsedListing {
  listing_id: string;
  url: string;
  domain: string;
  title?: string;
  price_eur?: number;
  sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  address?: string;
  photo_urls?: string[];
  parsed_at: string;
  parse_method: string;
  confidence: number;
}

/**
 * Check if listing already parsed
 */
async function isAlreadyParsed(listingId: string): Promise<boolean> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: LISTINGS_TABLE,
      Key: { listing_id: listingId },
      ProjectionExpression: 'listing_id',
    }));
    return !!result.Item;
  } catch {
    return false;
  }
}

/**
 * Get scraping rule for domain
 */
async function getScrapingRule(domain: string): Promise<ScrapingRule | null> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: SCRAPING_RULES_TABLE,
      Key: { domain },
    }));
    return result.Item as ScrapingRule | undefined || null;
  } catch {
    return null;
  }
}

/**
 * Download HTML from S3
 */
async function getHtmlFromS3(key: string): Promise<string | null> {
  try {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    
    const bodyBuffer = await result.Body?.transformToByteArray();
    if (!bodyBuffer) return null;
    
    if (key.endsWith('.gz')) {
      return zlib.gunzipSync(Buffer.from(bodyBuffer)).toString('utf-8');
    }
    return new TextDecoder().decode(bodyBuffer);
  } catch {
    return null;
  }
}

/**
 * Parse with Cheerio using selectors
 */
function parseWithCheerio(html: string, selectors: Record<string, string>): Partial<ParsedListing> {
  const $ = cheerio.load(html);
  const result: Partial<ParsedListing> = {};
  
  if (selectors.title) {
    result.title = $(selectors.title).first().text().trim() || undefined;
  }
  if (selectors.price) {
    const priceText = $(selectors.price).first().text().trim();
    const priceMatch = priceText.replace(/[^\d]/g, '');
    result.price_eur = priceMatch ? parseInt(priceMatch) : undefined;
  }
  if (selectors.sqm) {
    const sqmText = $(selectors.sqm).first().text().trim();
    const sqmMatch = sqmText.match(/[\d,.]+/);
    result.sqm = sqmMatch ? Math.round(parseFloat(sqmMatch[0].replace(',', '.'))) : undefined;
  }
  if (selectors.bedrooms) {
    const bedsText = $(selectors.bedrooms).first().text().trim();
    const bedsMatch = bedsText.match(/\d+/);
    result.bedrooms = bedsMatch ? parseInt(bedsMatch[0]) : undefined;
  }
  if (selectors.description) {
    result.description = $(selectors.description).first().text().trim() || undefined;
  }
  if (selectors.address) {
    result.address = $(selectors.address).first().text().trim() || undefined;
  }
  if (selectors.photos) {
    const photos: string[] = [];
    $(selectors.photos).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src?.startsWith('http')) photos.push(src);
    });
    if (photos.length > 0) result.photo_urls = photos;
  }
  
  return result;
}

/**
 * Learn selectors using Bedrock Mistral
 */
async function learnSelectors(html: string, domain: string): Promise<Record<string, string>> {
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .slice(0, 8000);
  
  const prompt = `<s>[INST] You are a web scraping expert. Analyze this HTML from ${domain} and return CSS selectors for property listing data.

HTML:
${cleanHtml}

Return ONLY a JSON object:
{"title":"selector","price":"selector","sqm":"selector","bedrooms":"selector","description":"selector","address":"selector","photos":"selector"}

Use null for fields not found. Return ONLY JSON. [/INST]`;

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'mistral.mistral-7b-instruct-v0:2',
      body: JSON.stringify({
        prompt,
        max_tokens: 500,
        temperature: 0.1,
      }),
      contentType: 'application/json',
      accept: 'application/json',
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.outputs?.[0]?.text || responseBody.generation || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const selectors = JSON.parse(jsonMatch[0]);
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(selectors)) {
        if (v && v !== 'null' && typeof v === 'string') {
          cleaned[k] = v;
        }
      }
      return cleaned;
    }
  } catch (error) {
    console.error('Bedrock error:', error);
  }
  
  return {};
}

/**
 * Generate listing ID
 */
function generateListingId(url: string, domain: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  return `${domain}_${hash}`;
}

/**
 * Extract URL from S3 key
 */
function keyToUrl(key: string): string {
  const parts = key.replace('html/', '').replace('.html.gz', '').split('/');
  const domain = parts[0];
  const path = parts.slice(1).join('/').replace(/_/g, '/') || '';
  return `https://${domain}/${path}`;
}

/**
 * Parse a single file
 */
async function parseFile(s3Key: string): Promise<ParsedListing | null> {
  const domain = s3Key.replace('html/', '').split('/')[0];
  const url = keyToUrl(s3Key);
  const listingId = generateListingId(url, domain);
  
  // Skip if already parsed
  if (await isAlreadyParsed(listingId)) {
    return null;
  }
  
  // Get HTML
  const html = await getHtmlFromS3(s3Key);
  if (!html || html.length < 500) return null;
  
  // Get or learn selectors
  let rule = await getScrapingRule(domain);
  
  if (!rule || Object.keys(rule.selectors).length === 0) {
    console.log(`  Learning selectors for ${domain}...`);
    const selectors = await learnSelectors(html, domain);
    
    rule = {
      domain,
      selectors,
      trust_level: 0,
      last_validated: new Date().toISOString(),
    };
    
    await dynamoClient.send(new PutCommand({
      TableName: SCRAPING_RULES_TABLE,
      Item: rule,
    }));
  }
  
  // Parse with Cheerio
  const parsed = parseWithCheerio(html, rule.selectors);
  
  // Validate minimum fields
  if (!parsed.title && !parsed.price_eur && !parsed.description) {
    return null;
  }
  
  // Update trust level
  await dynamoClient.send(new UpdateCommand({
    TableName: SCRAPING_RULES_TABLE,
    Key: { domain },
    UpdateExpression: 'SET trust_level = trust_level + :inc, last_validated = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':now': new Date().toISOString(),
    },
  }));
  
  const listing: ParsedListing = {
    listing_id: listingId,
    url,
    domain,
    ...parsed,
    parsed_at: new Date().toISOString(),
    parse_method: rule.trust_level >= TRUST_THRESHOLD ? 'cheerio' : 'hybrid',
    confidence: rule.trust_level >= TRUST_THRESHOLD ? 0.9 : 0.7,
  };
  
  // Save to DynamoDB
  await dynamoClient.send(new PutCommand({
    TableName: LISTINGS_TABLE,
    Item: listing,
  }));
  
  return listing;
}

/**
 * List unparsed HTML files
 */
async function listUnparsedFiles(limit: number): Promise<string[]> {
  const files: string[] = [];
  let continuationToken: string | undefined;
  
  do {
    const result = await s3Client.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'html/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    
    for (const obj of result.Contents || []) {
      if (obj.Key?.endsWith('.html.gz')) {
        files.push(obj.Key);
        if (files.length >= limit * 2) break;  // Get extra to account for already-parsed
      }
    }
    
    continuationToken = result.NextContinuationToken;
  } while (continuationToken && files.length < limit * 2);
  
  return files;
}

/**
 * Main Lambda handler
 */
export async function handler(event: any): Promise<any> {
  console.log('🔍 Daily Parse - Starting');
  const startTime = Date.now();
  
  // Get files to parse
  const files = await listUnparsedFiles(MAX_PARSE_PER_RUN);
  console.log(`Found ${files.length} files to check`);
  
  let parsed = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < files.length && parsed < MAX_PARSE_PER_RUN; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    for (const file of batch) {
      try {
        const result = await parseFile(file);
        if (result) {
          parsed++;
          process.stdout.write('.');
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
        errors++;
      }
      
      // Check timeout
      if (Date.now() - startTime > 14 * 60 * 1000) {
        console.log('\nApproaching timeout, stopping');
        break;
      }
    }
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n\n✅ Completed in ${elapsed.toFixed(1)}s`);
  console.log(`   Parsed: ${parsed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      parsed,
      skipped,
      errors,
      duration: elapsed,
    }),
  };
}

