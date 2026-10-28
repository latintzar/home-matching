/**
 * PARSING ORCHESTRATOR V2
 * 
 * Flow:
 * 1. Pro Teacher (1 HTML) → Selectors
 * 2. Cheerio extracts 5 listings
 * 3. Pro Validate+Correct (all 5 at once)
 * 4. Cheerio extracts 5 MORE listings
 * 5. Flash Final Check
 * 6. Graduate or Park
 * 
 * HARD BUDGET: $250 - STOPS if exceeded
 */

import { DynamoDBClient, ScanCommand, PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Config
const REGION = process.env.AWS_REGION || 'us-east-1';
const URLS_TABLE = 'leo-urls';
const SELECTORS_TABLE = 'leo-domain-selectors';
const PARKED_TABLE = 'leo-parked-domains';
const BUDGET_TABLE = 'leo-budget-tracker';
const S3_BUCKET = 'puedo-casa-html-archive';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const HARD_LIMIT = 250.00;

// Gemini endpoints - using Vertex AI publisher endpoint
const API_ENDPOINT = 'aiplatform.googleapis.com';
const GEMINI_PRO_MODEL = 'gemini-3-pro-preview';
const GEMINI_FLASH_MODEL = 'gemini-2.5-flash';
const GEMINI_PRO_ENDPOINT = `https://${API_ENDPOINT}/v1/publishers/google/models/${GEMINI_PRO_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_FLASH_ENDPOINT = `https://${API_ENDPOINT}/v1/publishers/google/models/${GEMINI_FLASH_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Clients
const dynamodb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

interface Selectors {
  title?: string | null;
  price?: string | null;
  bedrooms?: string | null;
  bathrooms?: string | null;
  m2_built?: string | null;
  address?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  description?: string | null;
  features?: string | null;
  photos?: string | null;
  reference?: string | null;
  agency_name?: string | null;
  agency_phone?: string | null;
}

interface ExtractedData {
  url: string;
  title?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  m2_built?: number;
  address?: string;
  city?: string;
  photos?: number;
}

// ============ BUDGET TRACKING ============

async function initBudget(): Promise<number> {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: BUDGET_TABLE,
      Key: { id: { S: 'parsing-v2' } },
    }));
    
    if (result.Item) {
      return parseFloat(result.Item.spent?.N || '0');
    }
    
    // Initialize
    await dynamodb.send(new PutItemCommand({
      TableName: BUDGET_TABLE,
      Item: {
        id: { S: 'parsing-v2' },
        spent: { N: '0' },
        budget_limit: { N: String(HARD_LIMIT) },
        domains_processed: { N: '0' },
        domains_graduated: { N: '0' },
        domains_parked: { N: '0' },
        last_updated: { S: new Date().toISOString() },
      },
    }));
    return 0;
  } catch (err) {
    console.error('Budget init error:', err);
    return 0;
  }
}

async function recordSpend(cost: number): Promise<number> {
  const result = await dynamodb.send(new UpdateItemCommand({
    TableName: BUDGET_TABLE,
    Key: { id: { S: 'parsing-v2' } },
    UpdateExpression: 'SET spent = spent + :cost, last_updated = :now',
    ExpressionAttributeValues: {
      ':cost': { N: String(cost) },
      ':now': { S: new Date().toISOString() },
    },
    ReturnValues: 'ALL_NEW',
  }));
  return parseFloat(result.Attributes?.spent?.N || '0');
}

async function recordDomainResult(graduated: boolean): Promise<void> {
  const field = graduated ? 'domains_graduated' : 'domains_parked';
  await dynamodb.send(new UpdateItemCommand({
    TableName: BUDGET_TABLE,
    Key: { id: { S: 'parsing-v2' } },
    UpdateExpression: `SET domains_processed = domains_processed + :one, ${field} = ${field} + :one`,
    ExpressionAttributeValues: { ':one': { N: '1' } },
  }));
}

// ============ HTML HELPERS ============

function compressHtml(html: string, maxChars: number = 20000): string {
  if (!html || html.length <= maxChars) return html;
  
  // Remove scripts except JSON-LD and data scripts
  let compressed = html
    .replace(/<script[^>]*src[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');
  
  if (compressed.length > maxChars) {
    compressed = compressed.substring(0, maxChars) + '<!-- truncated -->';
  }
  
  return compressed;
}

function simpleExtract(html: string, selectors: Selectors, url: string): ExtractedData {
  // Simple regex-based extraction for validation
  const extracted: ExtractedData = { url };
  
  // Extract price (look for euro amounts)
  const priceMatch = html.match(/(\d{1,3}(?:[.,]\d{3})*)\s*€|€\s*(\d{1,3}(?:[.,]\d{3})*)/);
  if (priceMatch) {
    const priceStr = (priceMatch[1] || priceMatch[2]).replace(/[.,]/g, '');
    extracted.price = parseInt(priceStr);
  }
  
  // Extract bedrooms
  const bedroomMatch = html.match(/(\d+)\s*(?:hab|dorm|bedroom|habitacion)/i);
  if (bedroomMatch) {
    extracted.bedrooms = parseInt(bedroomMatch[1]);
  }
  
  // Extract m2
  const m2Match = html.match(/(\d+)\s*(?:m²|m2|metros)/i);
  if (m2Match) {
    extracted.m2_built = parseInt(m2Match[1]);
  }
  
  // Count photos (img tags)
  const photoMatches = html.match(/<img[^>]+>/gi);
  extracted.photos = photoMatches ? photoMatches.length : 0;
  
  return extracted;
}

// ============ GEMINI CALLS ============

async function callTeacher(html: string, domain: string): Promise<{ selectors: Selectors; reasoning: string; cost: number }> {
  const compressed = compressHtml(html, 15000);
  
  const prompt = `You are a CSS selector expert. Analyze this HTML from ${domain} and provide CSS selectors to extract property listing data.

HTML:
${compressed}

IMPORTANT: Return a JSON with TWO parts:
1. "reasoning" - A brief explanation of WHERE you found each piece of data and WHY you chose those selectors
2. "selectors" - The actual CSS selectors

Example format:
{
  "reasoning": "Price is in a div.price-box with the euro symbol. Bedrooms are shown as '3 hab' in the features list. Photos are in a gallery carousel with data-src attributes for lazy loading. Address appears in the breadcrumb and also in a span.location element...",
  "selectors": {
    "title": ".property-title h1",
    "price": ".price-box .amount",
    ...
  }
}

SELECTOR FIELDS NEEDED:
- title, price, bedrooms, bathrooms, m2_built
- address, city, neighborhood
- description, features (list items), photos (img elements)
- reference, agency_name, agency_phone

Rules:
- Use CSS selectors that work with cheerio/jQuery
- Return null for fields you can't find reliably
- In reasoning, explain your logic so a validator can verify`;

  const response = await fetch(GEMINI_PRO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 6144 },
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    console.error('   Teacher API error:', data.error.message);
    return { selectors: {}, reasoning: '', cost: 0 };
  }
  
  const inputTokens = data.usageMetadata?.promptTokenCount || 4000;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 800;
  const cost = (inputTokens / 1e6 * 1.25) + (outputTokens / 1e6 * 10);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  console.log('   Teacher response preview:', text.substring(0, 200));
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { selectors: {}, reasoning: '', cost };
  }
  
  try {
    const result = JSON.parse(jsonMatch[0]);
    return { 
      selectors: result.selectors || result, 
      reasoning: result.reasoning || '',
      cost 
    };
  } catch (e) {
    // Fallback: old format without reasoning
    return { selectors: JSON.parse(jsonMatch[0]), reasoning: '', cost };
  }
}

async function callProValidator(
  htmls: string[],
  extractions: ExtractedData[],
  selectors: Selectors,
  teacherReasoning: string,
  domain: string
): Promise<{ allCorrect: boolean; issues: string[]; correctedSelectors?: Partial<Selectors>; cost: number }> {
  try {
    const prompt = `You are validating CSS selector extractions for ${domain}.

TEACHER'S REASONING (why these selectors were chosen):
${teacherReasoning || 'No reasoning provided'}

SELECTORS USED:
${JSON.stringify(selectors, null, 2)}

RESULTS FOR ${extractions.length} LISTINGS:
${extractions.map((e, i) => `
--- LISTING ${i + 1} ---
URL: ${e.url}
Extracted: price=${e.price || 'null'}, beds=${e.bedrooms || 'null'}, m2=${e.m2_built || 'null'}, photos=${e.photos || 0}

HTML SNIPPET:
${compressHtml(htmls[i] || '', 3000)}
`).join('\n')}

TASK:
1. Compare Teacher's reasoning with the actual results - did the selectors capture what was intended?
2. For each listing, verify the extracted data is reasonable
3. Identify ANY issues (wrong values, missing data that clearly exists in HTML, selector mismatch with intent)
4. If selectors need correction, provide the corrected selectors

Return ONLY valid JSON:
{
  "allCorrect": true,
  "issues": [],
  "correctedSelectors": null
}`;

    const response = await fetch(GEMINI_PRO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('   Gemini Pro error:', data.error);
      return { allCorrect: false, issues: [`API error: ${data.error.message || 'Unknown'}`], cost: 0 };
    }

    const inputTokens = data.usageMetadata?.promptTokenCount || 8000;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 1000;
    const cost = (inputTokens / 1e6 * 1.25) + (outputTokens / 1e6 * 10);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('   Validator response preview:', text.substring(0, 200));
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { allCorrect: false, issues: ['No JSON in response'], cost };
    }
    
    const result = JSON.parse(jsonMatch[0]);
    return { 
      allCorrect: result.allCorrect || false, 
      issues: result.issues || [], 
      correctedSelectors: result.correctedSelectors,
      cost 
    };
  } catch (err: any) {
    console.error('   Validator error:', err.message);
    return { allCorrect: false, issues: [`Error: ${err.message}`], cost: 0 };
  }
}

async function callFlashValidator(
  htmls: string[],
  extractions: ExtractedData[]
): Promise<{ passRate: string; passes: number; cost: number }> {
  const prompt = `Quick validation check. For each listing, verify the extracted data makes sense.

${extractions.map((e, i) => `
LISTING ${i + 1}:
Extracted: price=${e.price}, beds=${e.bedrooms}, m2=${e.m2_built}, photos=${e.photos}
HTML snippet: ${compressHtml(htmls[i], 1500)}
`).join('\n')}

Return JSON:
{
  "results": [
    { "listing": 1, "pass": true/false, "reason": "optional reason if fail" },
    ...
  ],
  "passRate": "X/${extractions.length}"
}`;

  const response = await fetch(GEMINI_FLASH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0, 
        maxOutputTokens: 8192,  // Large to avoid truncation
      },
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    console.error('   Flash API error:', data.error.message);
    return { passRate: '0/5', passes: 0, cost: 0 };
  }
  
  const inputTokens = data.usageMetadata?.promptTokenCount || 3000;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 200;
  const cost = (inputTokens / 1e6 * 0.075) + (outputTokens / 1e6 * 0.30);

  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (!text) {
    console.log('   ⚠️ Flash returned empty response');
    return { passRate: '0/5', passes: 0, cost };
  }
  
  // Strip markdown code blocks if present
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  console.log('   Flash response (cleaned):', text.substring(0, 300));
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.log('   ⚠️ No JSON in Flash response');
    return { passRate: '0/5', passes: 0, cost };
  }
  
  try {
    const result = JSON.parse(jsonMatch[0]);
    const passes = (result.results || []).filter((r: any) => r.pass).length;
    console.log(`   Flash parsed: ${passes}/${extractions.length} passed`);
    return { passRate: result.passRate || `${passes}/${extractions.length}`, passes, cost };
  } catch (e: any) {
    console.log('   ⚠️ Flash JSON parse error:', e.message);
    return { passRate: '0/5', passes: 0, cost };
  }
}

// ============ DATA ACCESS ============

async function getListingsForDomain(domain: string, limit: number = 10): Promise<Array<{ url: string; s3Key: string }>> {
  // Use classification results! We already classified 588K pages.
  // Filter for action='parse' inside the classification JSON string.
  const listings: Array<{ url: string; s3Key: string }> = [];
  let lastKey: any = undefined;
  let scannedCount = 0;
  const maxScan = 300000;
  
  while (listings.length < limit && scannedCount < maxScan) {
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      FilterExpression: '#d = :domain AND attribute_exists(s3_key) AND contains(classification, :actionParse)',
      ExpressionAttributeNames: { 
        '#d': 'domain', 
        '#u': 'url'
      },
      ExpressionAttributeValues: { 
        ':domain': { S: domain },
        ':actionParse': { S: '"action":"parse"' }
      },
      ProjectionExpression: '#u, s3_key',
      ExclusiveStartKey: lastKey,
      Limit: 10000,
    }));

    scannedCount += result.ScannedCount || 0;
    
    for (const item of result.Items || []) {
      if (listings.length >= limit) break;
      const url = item.url?.S;
      const s3Key = item.s3_key?.S;
      if (url && s3Key) {
        listings.push({ url, s3Key });
      }
    }

    lastKey = result.LastEvaluatedKey;
    if (!lastKey) break;
  }

  console.log(`   Found ${listings.length} classified listings for ${domain} (scanned ${scannedCount} items)`);
  return listings;
}

async function getHtmlFromS3(s3Key: string): Promise<string> {
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    }));
    return await result.Body?.transformToString() || '';
  } catch (err) {
    console.error(`S3 error for ${s3Key}:`, err);
    return '';
  }
}

async function saveGraduatedSelectors(domain: string, selectors: Selectors, passRate: string): Promise<void> {
  await dynamodb.send(new PutItemCommand({
    TableName: SELECTORS_TABLE,
    Item: {
      domain: { S: domain },
      selectors: { S: JSON.stringify(selectors) },
      pass_rate: { S: passRate },
      graduated_at: { S: new Date().toISOString() },
      version: { N: '1' },
    },
  }));
}

async function parkDomain(domain: string, reasons: string[]): Promise<void> {
  await dynamodb.send(new PutItemCommand({
    TableName: PARKED_TABLE,
    Item: {
      domain: { S: domain },
      reasons: { SS: reasons.length > 0 ? reasons : ['Unknown failure'] },
      parked_at: { S: new Date().toISOString() },
    },
  }));
}

async function getDomainsToProcess(): Promise<string[]> {
  const result = await dynamodb.send(new ScanCommand({
    TableName: 'leo-scraping-rules',
    ProjectionExpression: '#d',
    ExpressionAttributeNames: { '#d': 'domain' },
  }));

  const allDomains = (result.Items || [])
    .map(item => item.domain?.S)
    .filter((d): d is string => !!d);

  // Filter out already processed
  const toProcess: string[] = [];
  for (const domain of allDomains) {
    const [graduated, parked] = await Promise.all([
      dynamodb.send(new GetItemCommand({ TableName: SELECTORS_TABLE, Key: { domain: { S: domain } } })),
      dynamodb.send(new GetItemCommand({ TableName: PARKED_TABLE, Key: { domain: { S: domain } } })),
    ]);
    if (!graduated.Item && !parked.Item) {
      toProcess.push(domain);
    }
  }

  return toProcess;
}

// ============ MAIN PROCESSING ============

async function processDomain(domain: string, currentSpent: number): Promise<{ graduated: boolean; reason: string; spent: number }> {
  console.log(`\n🏠 Processing: ${domain}`);
  let totalCost = 0;
  
  // Get listings - need at least 6 total (3 for validation, 3 for final check)
  const listings = await getListingsForDomain(domain, 10);
  if (listings.length < 6) {
    console.log(`   ⚠️ Only ${listings.length} listings, need at least 6`);
    return { graduated: false, reason: `Only ${listings.length} listings`, spent: 0 };
  }

  // Split: first half for validation, second half for final check
  const midpoint = Math.ceil(listings.length / 2);
  const firstBatch = listings.slice(0, Math.min(5, midpoint));
  const secondBatch = listings.slice(midpoint, midpoint + Math.min(5, listings.length - midpoint));

  // STEP 1: Teacher
  console.log(`   📚 Step 1: Teaching...`);
  const sampleHtml = await getHtmlFromS3(firstBatch[0].s3Key);
  if (!sampleHtml || sampleHtml.length < 500) {
    return { graduated: false, reason: 'Sample HTML empty', spent: 0 };
  }

  const teacherResult = await callTeacher(sampleHtml, domain);
  totalCost += teacherResult.cost;
  console.log(`   ✅ Teacher done. Cost: $${teacherResult.cost.toFixed(3)}`);
  if (teacherResult.reasoning) {
    console.log(`   📝 Reasoning: ${teacherResult.reasoning.substring(0, 150)}...`);
  }

  // STEP 2: Extract first 5
  console.log(`   🔧 Step 2: Extracting 5...`);
  const firstHtmls: string[] = [];
  const firstExtractions: ExtractedData[] = [];
  for (const listing of firstBatch) {
    const html = await getHtmlFromS3(listing.s3Key);
    firstHtmls.push(html);
    const extracted = simpleExtract(html, teacherResult.selectors, listing.url);
    console.log(`   📄 ${listing.url.substring(0, 50)}... → price=${extracted.price}, beds=${extracted.bedrooms}, m2=${extracted.m2_built}`);
    firstExtractions.push(extracted);
  }

  // STEP 3: Pro Validate + Correct (with Teacher's reasoning)
  console.log(`   🔍 Step 3: Pro validating...`);
  const validatorResult = await callProValidator(firstHtmls, firstExtractions, teacherResult.selectors, teacherResult.reasoning, domain);
  totalCost += validatorResult.cost;
  const issueCount = validatorResult.issues?.length || 0;
  console.log(`   ✅ Validator done. Issues: ${issueCount}. Cost: $${validatorResult.cost.toFixed(3)}`);

  const finalSelectors = validatorResult.correctedSelectors
    ? { ...teacherResult.selectors, ...validatorResult.correctedSelectors }
    : teacherResult.selectors;

  // STEP 4: Extract second 5
  console.log(`   🔧 Step 4: Extracting 5 more...`);
  const secondHtmls: string[] = [];
  const secondExtractions: ExtractedData[] = [];
  for (const listing of secondBatch.slice(0, 5)) {
    const html = await getHtmlFromS3(listing.s3Key);
    if (html) {
      secondHtmls.push(html);
      secondExtractions.push(simpleExtract(html, finalSelectors, listing.url));
    }
  }

  if (secondExtractions.length < 3) {
    return { graduated: false, reason: 'Not enough HTMLs for validation', spent: totalCost };
  }

  // STEP 5: Flash Final Check
  console.log(`   ⚡ Step 5: Flash checking...`);
  const flashResult = await callFlashValidator(secondHtmls, secondExtractions);
  totalCost += flashResult.cost;
  console.log(`   ✅ Flash done. Pass rate: ${flashResult.passRate}`);

  // STEP 6: Decision
  if (flashResult.passes >= Math.ceil(secondExtractions.length * 0.8)) {
    await saveGraduatedSelectors(domain, finalSelectors, flashResult.passRate);
    await recordDomainResult(true);
    console.log(`   🎓 GRADUATED! ${flashResult.passRate}`);
    return { graduated: true, reason: `Passed ${flashResult.passRate}`, spent: totalCost };
  } else {
    const reasons = [`Flash: ${flashResult.passRate}`, ...validatorResult.issues.slice(0, 2)];
    await parkDomain(domain, reasons);
    await recordDomainResult(false);
    console.log(`   🅿️ PARKED. ${reasons[0]}`);
    return { graduated: false, reason: reasons[0], spent: totalCost };
  }
}

// ============ HANDLER ============

export async function handler(event: { maxDomains?: number; startFromDomain?: string } = {}): Promise<{
  processed: number;
  graduated: number;
  parked: number;
  budgetUsed: number;
  stoppedReason?: string;
}> {
  console.log('🚀 PARSING ORCHESTRATOR V2');
  console.log(`   Budget limit: $${HARD_LIMIT}`);
  
  let currentSpent = await initBudget();
  console.log(`   Current spent: $${currentSpent.toFixed(2)}`);

  const maxDomains = event.maxDomains || 2002;
  let domains: string[];
  
  if (event.startFromDomain) {
    // Process ONLY this specific domain
    domains = [event.startFromDomain];
    console.log(`📋 Processing specific domain: ${event.startFromDomain}`);
  } else {
    domains = await getDomainsToProcess();
    console.log(`📋 ${domains.length} domains to process (max: ${maxDomains})`);
  }

  let processed = 0;
  let graduated = 0;
  let parked = 0;

  for (const domain of domains.slice(0, maxDomains)) {
    // Budget check
    if (currentSpent + 0.10 > HARD_LIMIT) {
      console.log(`\n⛔ BUDGET LIMIT - STOPPING`);
      return { processed, graduated, parked, budgetUsed: currentSpent, stoppedReason: 'Budget limit' };
    }

    try {
      const result = await processDomain(domain, currentSpent);
      currentSpent = await recordSpend(result.spent);
      processed++;
      if (result.graduated) graduated++;
      else parked++;

      if (processed % 10 === 0) {
        console.log(`\n💰 Progress: ${processed} done, $${currentSpent.toFixed(2)} spent`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      await parkDomain(domain, [`Error: ${err.message}`]);
      parked++;
      processed++;
    }
  }

  console.log(`\n🏁 COMPLETE: ${processed} processed, ${graduated} graduated, ${parked} parked`);
  console.log(`💰 Total spent: $${currentSpent.toFixed(2)}`);

  return { processed, graduated, parked, budgetUsed: currentSpent };
}
