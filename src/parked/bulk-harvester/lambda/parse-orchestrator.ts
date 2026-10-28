/**
 * PARSE ORCHESTRATOR Lambda
 * 
 * Coordinates the full Teacher/Student/Validator parsing pipeline.
 * 
 * Flow:
 * 1. Get all domains with listings (action='parse')
 * 2. For each domain:
 *    a. Call Teacher to learn selectors
 *    b. Call Validator 10x to build trust
 *    c. If trust >= 10, mark domain as graduated
 * 3. Track budget throughout - STOP if approaching limit
 * 
 * After graduation, run Student (Cheerio) on all listings - FREE.
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';


const REGION = 'us-east-1';
const dynamodb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const RULES_TABLE = 'leo-scraping-rules';
const LISTINGS_TABLE = 'leo-listings';

// Budget tracking
const BUDGET_USD = 200;
const TEACHER_INPUT_PRICE = 2.00 / 1_000_000;
const TEACHER_OUTPUT_PRICE = 12.00 / 1_000_000;
const VALIDATOR_INPUT_PRICE = 0.30 / 1_000_000;
const VALIDATOR_OUTPUT_PRICE = 2.50 / 1_000_000;

interface BudgetState {
  teacherInputTokens: number;
  teacherOutputTokens: number;
  validatorInputTokens: number;
  validatorOutputTokens: number;
  domainsProcessed: number;
  domainsGraduated: number;
  domainsFailed: number;
}

function calculateCost(state: BudgetState): number {
  return (
    state.teacherInputTokens * TEACHER_INPUT_PRICE +
    state.teacherOutputTokens * TEACHER_OUTPUT_PRICE +
    state.validatorInputTokens * VALIDATOR_INPUT_PRICE +
    state.validatorOutputTokens * VALIDATOR_OUTPUT_PRICE
  );
}

async function getHtml(s3Key: string): Promise<string | null> {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
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

function smartCleanHtml(html: string): string {
  // Simple string-based cleaning (no cheerio dependency)
  
  // Extract JSON-LD first
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const jsonLdContent = jsonLdMatches.join('\n');
  
  // Remove scripts (except JSON-LD preserved above)
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  
  // Remove styles, noscript, iframes
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  clean = clean.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  clean = clean.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  
  // Collapse whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // Prepend JSON-LD if found
  if (jsonLdContent) {
    clean = '<!-- JSON-LD -->\n' + jsonLdContent + '\n<!-- HTML -->\n' + clean;
  }
  
  // Cap at 150KB
  if (clean.length > 150000) {
    clean = clean.substring(0, 150000);
  }
  
  return clean;
}

async function getListingsByDomain(): Promise<Map<string, string[]>> {
  const byDomain = new Map<string, string[]>();
  let lastKey: any;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      FilterExpression: 'classification_status = :c',
      ExpressionAttributeValues: { ':c': { S: 'classified' } },
      ProjectionExpression: 's3_key, classification, #u',
      ExpressionAttributeNames: { '#u': 'url' },
      ExclusiveStartKey: lastKey,
      Limit: 10000,
    }));
    
    for (const item of result.Items || []) {
      try {
        const cls = JSON.parse(item.classification?.S || '{}');
        if (cls.action === 'parse' && item.s3_key?.S) {
          const url = item.url!.S!;
          const domain = new URL(url).hostname.replace(/^www\./, '');
          
          if (!byDomain.has(domain)) {
            byDomain.set(domain, []);
          }
          // Keep up to 20 s3 keys per domain (1 teacher + 10 validators + buffer)
          if (byDomain.get(domain)!.length < 20) {
            byDomain.get(domain)!.push(item.s3_key.S);
          }
        }
      } catch {}
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return byDomain;
}

async function callTeacherLambda(domain: string, html: string, url: string): Promise<{
  success: boolean;
  selectors?: Record<string, string | null>;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}> {
  try {
    const response = await lambda.send(new InvokeCommand({
      FunctionName: 'parse-teacher',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ domain, sampleHtml: html, sampleUrl: url }),
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    return {
      success: result.success,
      selectors: result.selectors,
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      error: result.error,
    };
  } catch (error: any) {
    return { success: false, inputTokens: 0, outputTokens: 0, error: error.message };
  }
}

async function callValidatorLambda(
  domain: string, 
  html: string, 
  extracted: any, 
  selectors: Record<string, string | null>
): Promise<{
  success: boolean;
  valid: boolean;
  issues: string[];
  inputTokens: number;
  outputTokens: number;
  error?: string;
}> {
  try {
    const response = await lambda.send(new InvokeCommand({
      FunctionName: 'parse-validator',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ domain, html, extracted, selectors }),
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    return {
      success: result.success,
      valid: result.valid,
      issues: result.issues || [],
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      error: result.error,
    };
  } catch (error: any) {
    return { success: false, valid: false, issues: [error.message], inputTokens: 0, outputTokens: 0, error: error.message };
  }
}

async function saveSelectorsToRules(domain: string, selectors: Record<string, string | null>, trustLevel: number): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: RULES_TABLE,
    Key: { domain: { S: domain } },
    UpdateExpression: 'SET selectors = :sel, trust_level = :trust, selector_version = if_not_exists(selector_version, :zero) + :one, last_learned_at = :now',
    ExpressionAttributeValues: {
      ':sel': { S: JSON.stringify(selectors) },
      ':trust': { N: trustLevel.toString() },
      ':zero': { N: '0' },
      ':one': { N: '1' },
      ':now': { S: new Date().toISOString() },
    },
  }));
}

export async function handler(event: { maxDomains?: number; budgetUSD?: number }): Promise<{
  success: boolean;
  budget: BudgetState;
  costUSD: number;
  message: string;
}> {
  const maxDomains = event.maxDomains || 999999;
  const budgetLimit = event.budgetUSD || BUDGET_USD;
  
  console.log('🎓 PARSE ORCHESTRATOR STARTING');
  console.log(`   Budget: $${budgetLimit}`);
  console.log(`   Max domains: ${maxDomains}`);
  
  const budget: BudgetState = {
    teacherInputTokens: 0,
    teacherOutputTokens: 0,
    validatorInputTokens: 0,
    validatorOutputTokens: 0,
    domainsProcessed: 0,
    domainsGraduated: 0,
    domainsFailed: 0,
  };

  // Get all domains with listings
  console.log('\n📊 Scanning domains with listings...');
  const byDomain = await getListingsByDomain();
  console.log(`   Found ${byDomain.size} domains`);
  
  // Process each domain
  let domainsChecked = 0;
  
  for (const [domain, s3Keys] of byDomain) {
    if (domainsChecked >= maxDomains) {
      console.log('\n⏹️ Reached max domains limit');
      break;
    }
    
    // Check budget before processing
    const currentCost = calculateCost(budget);
    if (currentCost >= budgetLimit * 0.95) {
      console.log(`\n⚠️ APPROACHING BUDGET LIMIT: $${currentCost.toFixed(2)} / $${budgetLimit}`);
      break;
    }
    
    domainsChecked++;
    budget.domainsProcessed++;
    
    console.log(`\n[${domainsChecked}/${byDomain.size}] Processing ${domain}...`);
    
    // Get sample HTML for Teacher
    const teacherS3Key = s3Keys[0];
    const teacherHtml = await getHtml(teacherS3Key);
    if (!teacherHtml) {
      console.log(`   ❌ Could not load HTML`);
      budget.domainsFailed++;
      continue;
    }
    
    const cleanedHtml = smartCleanHtml(teacherHtml);
    const sampleUrl = `https://${domain}/sample`; // We don't have URL stored with s3_key
    
    // STEP 1: Call Teacher to learn selectors
    console.log('   📚 Calling Teacher...');
    const teacherResult = await callTeacherLambda(domain, cleanedHtml, sampleUrl);
    
    budget.teacherInputTokens += teacherResult.inputTokens;
    budget.teacherOutputTokens += teacherResult.outputTokens;
    
    if (!teacherResult.success || !teacherResult.selectors) {
      console.log(`   ❌ Teacher failed: ${teacherResult.error}`);
      budget.domainsFailed++;
      continue;
    }
    
    const selectors = teacherResult.selectors;
    console.log(`   ✅ Teacher learned ${Object.keys(selectors).filter(k => selectors[k]).length} selectors`);
    
    // STEP 2: Validate with 10 different listings
    let trustLevel = 0;
    const validatorS3Keys = s3Keys.slice(1, 11); // Use different listings for validation
    
    for (let i = 0; i < validatorS3Keys.length && trustLevel < 10; i++) {
      const validatorHtml = await getHtml(validatorS3Keys[i]);
      if (!validatorHtml) continue;
      
      const cleanedValidatorHtml = smartCleanHtml(validatorHtml);
      
      // Parse with Cheerio Student (FREE)
      // Note: We'd need to import and use parseWithStudent here
      // For now, simulate extraction
      const extracted = { /* Would be filled by parseWithStudent */ };
      
      console.log(`   🔍 Validation ${i + 1}/${validatorS3Keys.length}...`);
      const validatorResult = await callValidatorLambda(domain, cleanedValidatorHtml, extracted, selectors);
      
      budget.validatorInputTokens += validatorResult.inputTokens;
      budget.validatorOutputTokens += validatorResult.outputTokens;
      
      if (validatorResult.valid) {
        trustLevel++;
        console.log(`   ✅ Passed (trust: ${trustLevel})`);
      } else {
        console.log(`   ❌ Failed: ${validatorResult.issues.join(', ')}`);
        // Reset trust on failure
        trustLevel = 0;
      }
    }
    
    // Save selectors with trust level
    await saveSelectorsToRules(domain, selectors, trustLevel);
    
    if (trustLevel >= 10) {
      console.log(`   🎓 GRADUATED! Trust level: ${trustLevel}`);
      budget.domainsGraduated++;
    } else {
      console.log(`   ⚠️ Not graduated yet. Trust level: ${trustLevel}`);
    }
    
    // Log progress
    const costSoFar = calculateCost(budget);
    console.log(`   💰 Cost so far: $${costSoFar.toFixed(2)}`);
  }

  const finalCost = calculateCost(budget);
  
  console.log('\n' + '='.repeat(50));
  console.log('FINAL REPORT');
  console.log('='.repeat(50));
  console.log(`Domains processed: ${budget.domainsProcessed}`);
  console.log(`Domains graduated: ${budget.domainsGraduated}`);
  console.log(`Domains failed: ${budget.domainsFailed}`);
  console.log(`Teacher tokens: ${budget.teacherInputTokens} in / ${budget.teacherOutputTokens} out`);
  console.log(`Validator tokens: ${budget.validatorInputTokens} in / ${budget.validatorOutputTokens} out`);
  console.log(`TOTAL COST: $${finalCost.toFixed(2)}`);
  console.log(`REMAINING: $${(budgetLimit - finalCost).toFixed(2)}`);
  
  return {
    success: true,
    budget,
    costUSD: finalCost,
    message: `Processed ${budget.domainsProcessed} domains, ${budget.domainsGraduated} graduated. Cost: $${finalCost.toFixed(2)}`,
  };
}

