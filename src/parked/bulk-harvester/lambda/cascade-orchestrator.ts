/**
 * CASCADE LEARNING ORCHESTRATOR
 * 
 * Sequential processing of domains with cumulative learning.
 * Each domain's success patterns inform the next.
 * 
 * Flow:
 * 1. Load Universal Ruleset (context from previous domains)
 * 2. For each domain:
 *    a. Teacher learns selectors (with Universal Ruleset context)
 *    b. Validate 5x with different listings
 *    c. If fails, re-teach with failure history
 *    d. Validate 5 more times
 *    e. Graduate or Park
 * 3. Save updated Universal Ruleset
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { 
  loadUniversalRuleset, 
  saveUniversalRuleset, 
  addGraduatedDomain, 
  parkDomain,
  generateTeacherContext,
  getRulesetStats,
  UniversalRuleset 
} from '../harvest/universal-ruleset';
import { generateValidatorPrompt, parseValidatorResponse, generateReteachPrompt, ValidationOutput } from '../harvest/validator-prompt';

const REGION = 'us-east-1';
const dynamodb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const RULES_TABLE = 'leo-scraping-rules';

// Budget tracking
const BUDGET_LIMIT = 200;
const TEACHER_INPUT_PRICE = 2.00 / 1_000_000;
const TEACHER_OUTPUT_PRICE = 12.00 / 1_000_000;
const VALIDATOR_INPUT_PRICE = 0.30 / 1_000_000;
const VALIDATOR_OUTPUT_PRICE = 2.50 / 1_000_000;

interface BudgetTracker {
  teacherInputTokens: number;
  teacherOutputTokens: number;
  validatorInputTokens: number;
  validatorOutputTokens: number;
}

function calculateCost(budget: BudgetTracker): number {
  return (
    budget.teacherInputTokens * TEACHER_INPUT_PRICE +
    budget.teacherOutputTokens * TEACHER_OUTPUT_PRICE +
    budget.validatorInputTokens * VALIDATOR_INPUT_PRICE +
    budget.validatorOutputTokens * VALIDATOR_OUTPUT_PRICE
  );
}

// ============ HELPERS ============

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

function cleanHtml(html: string): string {
  // Extract JSON-LD first
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const jsonLdContent = jsonLdMatches.join('\n');

  // Keep script tags (they have data!)
  let clean = html;
  
  // Remove only noise
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  clean = clean.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  clean = clean.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');
  
  // Collapse whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  // Prepend JSON-LD if found
  if (jsonLdContent) {
    clean = '<!-- JSON-LD -->\n' + jsonLdContent + '\n<!-- HTML -->\n' + clean;
  }

  // Cap at 100KB for LLM
  if (clean.length > 100000) {
    clean = clean.substring(0, 100000);
  }

  return clean;
}

async function getListingsForDomain(domain: string): Promise<{ url: string; s3Key: string }[]> {
  const listings: { url: string; s3Key: string }[] = [];
  let lastKey: any;

  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      FilterExpression: 'begins_with(#u, :prefix) AND attribute_exists(s3_key) AND contains(classification, :parse)',
      ExpressionAttributeNames: { '#u': 'url' },
      ExpressionAttributeValues: {
        ':prefix': { S: `https://${domain}` },
        ':parse': { S: '"action":"parse"' },  // Classification JSON contains action:parse for listings
      },
      ProjectionExpression: '#u, s3_key',
      ExclusiveStartKey: lastKey,
      Limit: 100,
    }));

    for (const item of result.Items || []) {
      if (item.url?.S && item.s3_key?.S) {
        listings.push({ url: item.url.S, s3Key: item.s3_key.S });
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey && listings.length < 20);

  return listings;
}

async function getAllDomains(): Promise<string[]> {
  const domains: string[] = [];
  let lastKey: any;

  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: RULES_TABLE,
      FilterExpression: '#d <> :universal',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':universal': { S: '__UNIVERSAL_RULESET__' } },
      ProjectionExpression: '#d',
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      if (item.domain?.S) {
        domains.push(item.domain.S);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return domains;
}

// ============ LLM CALLS ============

async function callTeacher(
  domain: string,
  html: string,
  universalContext: string,
  budget: BudgetTracker
): Promise<{ success: boolean; selectors?: Record<string, string | null>; error?: string }> {
  try {
    const response = await lambda.send(new InvokeCommand({
      FunctionName: 'parse-teacher',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        domain,
        sampleHtml: html,
        sampleUrl: `https://${domain}/sample`,
        universalContext,
      }),
    }));

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    budget.teacherInputTokens += result.inputTokens || 0;
    budget.teacherOutputTokens += result.outputTokens || 0;

    return {
      success: result.success,
      selectors: result.selectors,
      error: result.error,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function callValidator(
  domain: string,
  html: string,
  extracted: Record<string, any>,
  selectors: Record<string, string | null>,
  budget: BudgetTracker
): Promise<ValidationOutput> {
  try {
    const response = await lambda.send(new InvokeCommand({
      FunctionName: 'parse-validator',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ domain, html, extracted, selectors }),
    }));

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    budget.validatorInputTokens += result.inputTokens || 0;
    budget.validatorOutputTokens += result.outputTokens || 0;

    if (result.success) {
      return {
        valid: result.valid,
        confidence: result.confidence || 0,
        essentialFieldsFound: result.essentialFieldsFound || 0,
        issues: result.issues || [],
        missedData: result.missedData || [],
        suggestions: result.suggestions || [],
      };
    }

    return {
      valid: false,
      confidence: 0,
      essentialFieldsFound: 0,
      issues: [result.error || 'Validator call failed'],
      missedData: [],
      suggestions: [],
    };
  } catch (error: any) {
    return {
      valid: false,
      confidence: 0,
      essentialFieldsFound: 0,
      issues: [error.message],
      missedData: [],
      suggestions: [],
    };
  }
}

// ============ MAIN ORCHESTRATOR ============

async function processDomain(
  domain: string,
  ruleset: UniversalRuleset,
  budget: BudgetTracker
): Promise<{ graduated: boolean; failures: string[] }> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${domain}`);
  console.log(`${'='.repeat(50)}`);

  const failures: string[] = [];

  // Get listings for this domain
  const listings = await getListingsForDomain(domain);
  if (listings.length < 6) {
    console.log(`   ❌ Not enough listings (${listings.length}), need at least 6`);
    return { graduated: false, failures: ['Not enough listings'] };
  }

  // Get sample HTML for Teacher
  const teacherHtml = await getHtml(listings[0].s3Key);
  if (!teacherHtml) {
    console.log(`   ❌ Could not load HTML for teaching`);
    return { graduated: false, failures: ['Could not load HTML'] };
  }

  const cleanedTeacherHtml = cleanHtml(teacherHtml);

  // Generate Universal Ruleset context
  const universalContext = generateTeacherContext(ruleset);

  // ===== PHASE 1: INITIAL TEACHING =====
  console.log(`\n📚 Phase 1: Initial Teaching...`);
  const teacherResult = await callTeacher(domain, cleanedTeacherHtml, universalContext, budget);

  if (!teacherResult.success || !teacherResult.selectors) {
    console.log(`   ❌ Teacher failed: ${teacherResult.error}`);
    return { graduated: false, failures: [`Teacher failed: ${teacherResult.error}`] };
  }

  let selectors = teacherResult.selectors;
  console.log(`   ✅ Learned ${Object.keys(selectors).filter(k => selectors[k]).length} selectors`);

  // ===== PHASE 2: FIRST VALIDATION (5 listings) =====
  console.log(`\n🔍 Phase 2: First Validation (5 listings)...`);
  const validationListings = listings.slice(1, 6);
  let validationResults: ValidationOutput[] = [];
  let passCount = 0;

  for (let i = 0; i < validationListings.length; i++) {
    const listing = validationListings[i];
    const html = await getHtml(listing.s3Key);
    if (!html) continue;

    const cleanedHtml = cleanHtml(html);
    
    // Simulate extraction (in real impl, would use Cheerio)
    const extracted = {}; // TODO: Actually parse with Cheerio

    const result = await callValidator(domain, cleanedHtml, extracted, selectors, budget);
    validationResults.push(result);

    if (result.valid) {
      passCount++;
      console.log(`   ✅ Validation ${i + 1}/5: PASS (confidence: ${result.confidence})`);
    } else {
      console.log(`   ❌ Validation ${i + 1}/5: FAIL - ${result.issues.join(', ')}`);
      failures.push(...result.issues);
    }
  }

  // Check if graduated
  if (passCount >= 5) {
    console.log(`\n🎓 GRADUATED after first validation!`);
    return { graduated: true, failures: [] };
  }

  // ===== PHASE 3: RE-TEACH WITH FAILURE HISTORY =====
  console.log(`\n📚 Phase 3: Re-teaching with failure history...`);
  
  // Generate re-teach prompt with failure context
  const reteachPrompt = generateReteachPrompt(
    cleanedTeacherHtml,
    domain,
    selectors,
    validationResults.filter(v => !v.valid)
  );

  const reteachResult = await callTeacher(domain, reteachPrompt, '', budget);

  if (!reteachResult.success || !reteachResult.selectors) {
    console.log(`   ❌ Re-teach failed: ${reteachResult.error}`);
    return { graduated: false, failures };
  }

  selectors = reteachResult.selectors;
  console.log(`   ✅ Re-learned selectors`);

  // ===== PHASE 4: SECOND VALIDATION (5 more listings) =====
  console.log(`\n🔍 Phase 4: Second Validation (5 listings)...`);
  const secondValidationListings = listings.slice(6, 11).length >= 5 
    ? listings.slice(6, 11) 
    : listings.slice(1, 6); // Reuse if not enough

  passCount = 0;
  validationResults = [];

  for (let i = 0; i < Math.min(5, secondValidationListings.length); i++) {
    const listing = secondValidationListings[i];
    const html = await getHtml(listing.s3Key);
    if (!html) continue;

    const cleanedHtml = cleanHtml(html);
    const extracted = {}; // TODO: Actually parse with Cheerio

    const result = await callValidator(domain, cleanedHtml, extracted, selectors, budget);
    validationResults.push(result);

    if (result.valid) {
      passCount++;
      console.log(`   ✅ Validation ${i + 1}/5: PASS`);
    } else {
      console.log(`   ❌ Validation ${i + 1}/5: FAIL - ${result.issues.join(', ')}`);
      failures.push(...result.issues);
    }
  }

  // Final verdict
  if (passCount >= 5) {
    console.log(`\n🎓 GRADUATED after re-teach!`);
    return { graduated: true, failures: [] };
  } else {
    console.log(`\n🅿️ PARKED - Still failing after re-teach`);
    return { graduated: false, failures };
  }
}

// ============ MAIN HANDLER ============

export async function handler(event: {
  maxDomains?: number;
  startFromDomain?: string;
}): Promise<{
  success: boolean;
  stats: {
    processed: number;
    graduated: number;
    parked: number;
    costUSD: number;
  };
  message: string;
}> {
  const maxDomains = event.maxDomains || 999999;
  
  console.log('🎓 CASCADE LEARNING ORCHESTRATOR');
  console.log(`   Max domains: ${maxDomains}`);
  console.log(`   Budget limit: $${BUDGET_LIMIT}`);

  // Load Universal Ruleset
  console.log('\n📊 Loading Universal Ruleset...');
  const ruleset = await loadUniversalRuleset();
  console.log(`   ${getRulesetStats(ruleset)}`);

  // Get all domains
  console.log('\n📋 Getting domains to process...');
  let domains = await getAllDomains();
  console.log(`   Found ${domains.length} domains`);

  // Skip to start domain if specified
  if (event.startFromDomain) {
    const startIdx = domains.indexOf(event.startFromDomain);
    if (startIdx > 0) {
      domains = domains.slice(startIdx);
      console.log(`   Starting from ${event.startFromDomain} (${domains.length} remaining)`);
    }
  }

  // Budget tracker
  const budget: BudgetTracker = {
    teacherInputTokens: 0,
    teacherOutputTokens: 0,
    validatorInputTokens: 0,
    validatorOutputTokens: 0,
  };

  let processed = 0;
  let graduated = 0;
  let parked = 0;

  // Process domains sequentially
  for (const domain of domains) {
    if (processed >= maxDomains) {
      console.log('\n⏹️ Reached max domains limit');
      break;
    }

    // Check budget
    const currentCost = calculateCost(budget);
    if (currentCost >= BUDGET_LIMIT * 0.95) {
      console.log(`\n⚠️ BUDGET LIMIT APPROACHING: $${currentCost.toFixed(2)}`);
      break;
    }

    // Process this domain
    const result = await processDomain(domain, ruleset, budget);
    processed++;

    if (result.graduated) {
      graduated++;
      // Add to Universal Ruleset (we'd need the selectors here)
      // addGraduatedDomain(ruleset, domain, selectors);
      ruleset.stats.graduated++;
    } else {
      parked++;
      parkDomain(ruleset, domain, result.failures);
    }

    ruleset.stats.totalDomainsProcessed++;

    // Save ruleset periodically
    if (processed % 10 === 0) {
      await saveUniversalRuleset(ruleset);
      console.log(`\n💾 Saved Universal Ruleset (${processed} processed)`);
    }

    // Log progress
    const cost = calculateCost(budget);
    console.log(`\n📊 Progress: ${processed}/${maxDomains} | ${graduated} graduated, ${parked} parked | Cost: $${cost.toFixed(2)}`);
  }

  // Final save
  await saveUniversalRuleset(ruleset);

  const finalCost = calculateCost(budget);

  console.log('\n' + '='.repeat(60));
  console.log('FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`Domains processed: ${processed}`);
  console.log(`Graduated: ${graduated}`);
  console.log(`Parked: ${parked}`);
  console.log(`Total cost: $${finalCost.toFixed(2)}`);
  console.log(`${getRulesetStats(ruleset)}`);

  return {
    success: true,
    stats: {
      processed,
      graduated,
      parked,
      costUSD: finalCost,
    },
    message: `Processed ${processed} domains. ${graduated} graduated, ${parked} parked. Cost: $${finalCost.toFixed(2)}`,
  };
}

