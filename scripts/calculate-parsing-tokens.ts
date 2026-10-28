/**
 * Calculate ACTUAL token counts for Teacher/Validator parsing
 * 
 * For each domain with listing pages:
 * - 1 Teacher call: Full cleaned HTML → generates selectors
 * - 10 Validator calls: HTML + parsed output → validates extraction
 * 
 * Token counting uses character-based estimation (~4 chars per token for Gemini)
 */

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as cheerio from 'cheerio';

const db = new DynamoDBClient({ region: 'us-east-1' });
const s3 = new S3Client({ region: 'us-east-1' });

// Token counting (Gemini uses ~4 chars per token)
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Smart clean HTML - preserve structured data, remove only true noise
function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  
  // PRESERVE: JSON-LD structured data (goldmine for parsing)
  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    jsonLd.push($(el).html() || '');
  });
  
  // PRESERVE: Meta tags with property data
  const metas: string[] = [];
  $('meta[property], meta[name]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name') || '';
    const content = $(el).attr('content') || '';
    if (prop && content && (
      prop.includes('price') || prop.includes('og:') || 
      prop.includes('description') || prop.includes('title')
    )) {
      metas.push(`${prop}: ${content}`);
    }
  });
  
  // Remove only TRUE noise (not data-carrying scripts)
  $('script:not([type="application/ld+json"])').remove();
  $('style, svg, noscript, iframe, link').remove();
  $('[class*="cookie"], [class*="banner"], [class*="popup"], [class*="modal"]').remove();
  $('[class*="gdpr"], [class*="consent"]').remove();
  
  // Keep nav/footer - they sometimes have useful data
  // Remove only obvious ad containers
  $('[class*="advertisement"], [id*="google_ads"]').remove();
  
  // Get body content
  let body = $('body').html() || $.html();
  body = body.replace(/\s+/g, ' ').trim();
  
  // Combine: JSON-LD + Metas + Body
  let clean = '';
  if (jsonLd.length > 0) {
    clean += '<!-- STRUCTURED DATA -->\n' + jsonLd.join('\n') + '\n';
  }
  if (metas.length > 0) {
    clean += '<!-- META -->\n' + metas.join('\n') + '\n';
  }
  clean += '<!-- BODY -->\n' + body;
  
  // Cap at 150KB (more generous since we're keeping structured data)
  if (clean.length > 150000) {
    clean = clean.substring(0, 150000);
  }
  
  return clean;
}

// Fetch HTML from S3
async function getHtml(s3Key: string): Promise<string | null> {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: 'puedo-casa-html-archive',
      Key: s3Key,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== PARSING TOKEN CALCULATOR ===\n');
  
  // Step 1: Get ALL listing URLs grouped by domain
  console.log('Step 1: Scanning all listing pages...');
  const byDomain: { [domain: string]: string[] } = {};
  let lastKey: any;
  let totalListings = 0;
  
  do {
    const r = await db.send(new ScanCommand({ 
      TableName: 'leo-urls',
      FilterExpression: 'classification_status = :c',
      ExpressionAttributeValues: { ':c': { S: 'classified' } },
      ProjectionExpression: 's3_key, classification, #u',
      ExpressionAttributeNames: { '#u': 'url' },
      ExclusiveStartKey: lastKey,
      Limit: 10000
    }));
    
    for (const item of r.Items || []) {
      try {
        const cls = JSON.parse(item.classification?.S || '{}');
        if (cls.action === 'parse' && item.s3_key?.S) {
          const url = item.url!.S!;
          const domain = new URL(url).hostname.replace(/^www\./, '');
          
          if (!byDomain[domain]) byDomain[domain] = [];
          // Keep up to 11 per domain (1 teacher + 10 validators)
          if (byDomain[domain].length < 11) {
            byDomain[domain].push(item.s3_key.S);
          }
          totalListings++;
        }
      } catch {}
    }
    lastKey = r.LastEvaluatedKey;
    if (totalListings % 50000 === 0) console.log(`  Scanned ${totalListings.toLocaleString()} listings...`);
  } while (lastKey);
  
  const domains = Object.keys(byDomain);
  console.log(`\nTotal listing pages: ${totalListings.toLocaleString()}`);
  console.log(`Unique domains: ${domains.length}`);
  
  // Step 2: Calculate HTML counts
  let teacherHtmlCount = 0;
  let validatorHtmlCount = 0;
  
  for (const domain of domains) {
    const count = byDomain[domain].length;
    teacherHtmlCount += 1; // 1 teacher per domain
    validatorHtmlCount += Math.min(10, count); // up to 10 validators
  }
  
  console.log(`\nHTMLs to process:`);
  console.log(`  Teacher HTMLs: ${teacherHtmlCount}`);
  console.log(`  Validator HTMLs: ${validatorHtmlCount}`);
  console.log(`  Total: ${teacherHtmlCount + validatorHtmlCount}`);
  
  // Step 3: Process ALL HTMLs and count tokens
  console.log(`\nStep 2: Processing ${teacherHtmlCount + validatorHtmlCount} HTMLs...`);
  
  let teacherTokensTotal = 0;
  let validatorInputTokensTotal = 0;
  let processedDomains = 0;
  let processedHtmls = 0;
  let failedHtmls = 0;
  
  const PARSED_OUTPUT_TOKENS = 500; // Estimated tokens for parsed output
  const TEACHER_OUTPUT_TOKENS = 500; // Estimated tokens for selector generation
  const VALIDATOR_OUTPUT_TOKENS = 100; // Estimated tokens for validation response
  
  for (const domain of domains) {
    const s3Keys = byDomain[domain];
    
    // Process all HTMLs for this domain
    for (let i = 0; i < s3Keys.length; i++) {
      const s3Key = s3Keys[i];
      const html = await getHtml(s3Key);
      
      if (html && html.length > 500) {
        const cleaned = cleanHtml(html);
        const tokens = countTokens(cleaned);
        
        if (i === 0) {
          // First HTML is for Teacher
          teacherTokensTotal += tokens;
        }
        
        // All HTMLs (including first) are used for Validator
        // Validator input = HTML tokens + parsed output tokens
        if (i < 10) {
          validatorInputTokensTotal += tokens + PARSED_OUTPUT_TOKENS;
        }
        
        processedHtmls++;
      } else {
        failedHtmls++;
      }
    }
    
    processedDomains++;
    if (processedDomains % 100 === 0) {
      console.log(`  Processed ${processedDomains}/${domains.length} domains (${processedHtmls} HTMLs)...`);
    }
  }
  
  // Step 4: Calculate final totals
  const teacherOutputTokens = teacherHtmlCount * TEACHER_OUTPUT_TOKENS;
  const validatorOutputTokens = validatorHtmlCount * VALIDATOR_OUTPUT_TOKENS;
  
  console.log('\n' + '='.repeat(60));
  console.log('FINAL TOKEN COUNTS');
  console.log('='.repeat(60));
  
  console.log(`\nProcessed: ${processedHtmls} HTMLs (${failedHtmls} failed)`);
  console.log(`Domains: ${processedDomains}`);
  
  console.log(`\nTEACHER (${teacherHtmlCount} calls):`);
  console.log(`  Input tokens:  ${(teacherTokensTotal / 1e6).toFixed(3)} M`);
  console.log(`  Output tokens: ${(teacherOutputTokens / 1e6).toFixed(3)} M`);
  
  console.log(`\nVALIDATOR (${validatorHtmlCount} calls):`);
  console.log(`  Input tokens:  ${(validatorInputTokensTotal / 1e6).toFixed(3)} M`);
  console.log(`  Output tokens: ${(validatorOutputTokens / 1e6).toFixed(3)} M`);
  
  const totalInput = teacherTokensTotal + validatorInputTokensTotal;
  const totalOutput = teacherOutputTokens + validatorOutputTokens;
  
  console.log(`\nTOTAL:`);
  console.log(`  Input tokens:  ${(totalInput / 1e6).toFixed(3)} M`);
  console.log(`  Output tokens: ${(totalOutput / 1e6).toFixed(3)} M`);
  
  // Step 5: Calculate costs
  console.log('\n' + '='.repeat(60));
  console.log('COST CALCULATION');
  console.log('='.repeat(60));
  
  // Gemini 3 Pro Preview for Teacher
  // Input: $2/1M, Output: $12/1M
  const teacher_input_cost = (teacherTokensTotal / 1e6) * 2;
  const teacher_output_cost = (teacherOutputTokens / 1e6) * 12;
  const teacher_total = teacher_input_cost + teacher_output_cost;
  
  // Gemini 2.5 Flash for Validator  
  // Input: $0.30/1M, Output: $2.50/1M
  const validator_input_cost = (validatorInputTokensTotal / 1e6) * 0.30;
  const validator_output_cost = (validatorOutputTokens / 1e6) * 2.50;
  const validator_total = validator_input_cost + validator_output_cost;
  
  console.log(`\nGemini 3 Pro Preview (Teacher):`);
  console.log(`  Input:  $${teacher_input_cost.toFixed(2)} (${(teacherTokensTotal / 1e6).toFixed(3)}M × $2)`);
  console.log(`  Output: $${teacher_output_cost.toFixed(2)} (${(teacherOutputTokens / 1e6).toFixed(3)}M × $12)`);
  console.log(`  TOTAL:  $${teacher_total.toFixed(2)}`);
  
  console.log(`\nGemini 2.5 Flash (Validator):`);
  console.log(`  Input:  $${validator_input_cost.toFixed(2)} (${(validatorInputTokensTotal / 1e6).toFixed(3)}M × $0.30)`);
  console.log(`  Output: $${validator_output_cost.toFixed(2)} (${(validatorOutputTokens / 1e6).toFixed(3)}M × $2.50)`);
  console.log(`  TOTAL:  $${validator_total.toFixed(2)}`);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GRAND TOTAL: $${(teacher_total + validator_total).toFixed(2)}`);
  console.log(`${'='.repeat(60)}`);
}

main().catch(console.error);

