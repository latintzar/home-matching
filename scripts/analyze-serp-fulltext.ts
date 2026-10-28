/**
 * Analyze SERP Full-Text Content with Gemini
 * 
 * Reads downloaded HTML from S3, extracts main content,
 * and analyzes with Gemini 2.5 Flash-Lite for accurate dimension scores.
 * 
 * Usage:
 *   npx tsx scripts/analyze-serp-fulltext.ts [--city=<city>] [--dry-run]
 * 
 * Cost estimate: ~$0.005 per neighborhood (more tokens than snippets)
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as cheerio from 'cheerio';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const PROFILES_TABLE = 'leo-neighborhood-profiles';

// Gemini 2.5 Flash-Lite pricing
const FLASH_LITE_INPUT_PRICE_PER_1M = 0.10;
const FLASH_LITE_OUTPUT_PRICE_PER_1M = 0.40;

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface CostTracker {
  neighborhoodsProcessed: number;
  inputTokens: number;
  outputTokens: number;
  pagesAnalyzed: number;
}

interface ExtractedContent {
  title: string;
  content: string;
  url: string;
  category: string;
}

// Extract main content from HTML
function extractMainContent(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove noise
  $('script, style, nav, header, footer, aside, .sidebar, .comments, .ad, .advertisement, .cookie, .popup').remove();
  
  // Try to find main content
  let content = '';
  
  // Try common content selectors
  const selectors = ['article', 'main', '.content', '.post-content', '.entry-content', '.article-body', '#content'];
  for (const selector of selectors) {
    const element = $(selector);
    if (element.length && element.text().length > 200) {
      content = element.text();
      break;
    }
  }
  
  // Fallback to body
  if (!content || content.length < 200) {
    content = $('body').text();
  }
  
  // Clean up whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  // Limit length (keep first 3000 chars for cost control)
  return content.slice(0, 3000);
}

// Get downloaded pages for a neighborhood
async function getDownloadedPages(neighborhoodId: string): Promise<ExtractedContent[]> {
  const prefix = `serp-html/${neighborhoodId}/`;
  const pages: ExtractedContent[] = [];
  
  let continuationToken: string | undefined;
  
  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    
    for (const obj of result.Contents || []) {
      if (!obj.Key) continue;
      
      try {
        // Get the HTML
        const getResult = await s3.send(new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: obj.Key,
        }));
        
        const html = await getResult.Body?.transformToString() || '';
        const content = extractMainContent(html);
        
        if (content.length > 100) {
          pages.push({
            title: obj.Key.split('/').pop() || '',
            content,
            url: getResult.Metadata?.['source-url'] || '',
            category: getResult.Metadata?.['query-category'] || 'general',
          });
        }
      } catch (err) {
        // Skip failed reads
      }
    }
    
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);
  
  return pages;
}

// Call Gemini
async function callGeminiFlashLite(prompt: string, tracker: CostTracker): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 3000,
        responseMimeType: 'application/json',
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
  
  tracker.inputTokens += inputTokens;
  tracker.outputTokens += outputTokens;
  tracker.pagesAnalyzed++;
  
  return { text, inputTokens, outputTokens };
}

// Build analysis prompt
function buildAnalysisPrompt(neighborhoodId: string, pages: ExtractedContent[]): string {
  const [city, ...nameParts] = neighborhoodId.split('-');
  const name = nameParts.join(' ').replace(/-/g, ' ');
  
  let contentSummary = '';
  
  // Group by category
  const byCategory = new Map<string, ExtractedContent[]>();
  for (const page of pages) {
    if (!byCategory.has(page.category)) {
      byCategory.set(page.category, []);
    }
    byCategory.get(page.category)!.push(page);
  }
  
  for (const [category, catPages] of byCategory) {
    contentSummary += `\n### ${category.toUpperCase()}\n`;
    for (const page of catPages.slice(0, 3)) {
      contentSummary += `\n[Source: ${page.url}]\n${page.content.slice(0, 1000)}\n`;
    }
  }
  
  return `You are analyzing articles and blog posts about the neighborhood "${name}" in ${city}, Spain.

Based on the FULL CONTENT below (not just snippets), score the neighborhood on each dimension from 0-100:
- 0-30: Poor/negative sentiment
- 31-50: Below average
- 51-70: Average/decent
- 71-85: Good/above average
- 86-100: Excellent/outstanding

Pay attention to nuance, context, and sentiment. If someone says "it used to be X but now it's Y", score based on current state.

If no clear evidence, use 50 (neutral).

FULL CONTENT FROM ARTICLES:
${contentSummary}

Return a JSON object with these exact keys:
{
  "student_friendly": <0-100>,
  "young_professional": <0-100>,
  "couple_friendly": <0-100>,
  "family_friendly": <0-100>,
  "retiree_friendly": <0-100>,
  "digital_nomad": <0-100>,
  "fitness_friendly": <0-100>,
  "foodie_scene": <0-100>,
  "nightlife": <0-100>,
  "arts_culture": <0-100>,
  "nature_access": <0-100>,
  "pet_friendly": <0-100>,
  "lgbtq_friendly": <0-100>,
  "eco_conscious": <0-100>,
  "safety": <0-100>,
  "quietness": <0-100>,
  "transport": <0-100>,
  "gentrification_risk": <0-100>,
  "affordability": <0-100>,
  "vibes": ["word1", "word2", "word3", "word4", "word5"],
  "evidence": {
    "dimension_name": ["direct quote from article 1", "quote from article 2"]
  }
}

Extract ACTUAL QUOTES from the articles as evidence. Be accurate.`;
}

// Get all neighborhoods with downloaded pages
async function getNeighborhoodsWithPages(cityFilter?: string): Promise<string[]> {
  const result = await s3.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: 'serp-html/',
    Delimiter: '/',
  }));
  
  // Get second level (neighborhood folders)
  const neighborhoods = new Set<string>();
  
  let continuationToken: string | undefined;
  do {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'serp-html/',
      ContinuationToken: continuationToken,
    }));
    
    for (const obj of listResult.Contents || []) {
      if (!obj.Key) continue;
      const parts = obj.Key.split('/');
      if (parts.length >= 2) {
        const nid = parts[1];
        if (!cityFilter || nid.startsWith(cityFilter + '-')) {
          neighborhoods.add(nid);
        }
      }
    }
    
    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);
  
  return Array.from(neighborhoods).sort();
}

async function main() {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const dryRun = args.includes('--dry-run');
  
  const cityFilter = cityArg?.split('=')[1];
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     GEMINI FULL-TEXT ANALYSIS                                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Analyzes full article content from S3                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - no API calls or writes\n');
  }
  
  const tracker: CostTracker = {
    neighborhoodsProcessed: 0,
    inputTokens: 0,
    outputTokens: 0,
    pagesAnalyzed: 0,
  };
  
  // Get neighborhoods with downloaded pages
  const neighborhoods = await getNeighborhoodsWithPages(cityFilter);
  console.log(`📊 Found ${neighborhoods.length} neighborhoods with downloaded pages\n`);
  
  if (neighborhoods.length === 0) {
    console.log('⚠️ No pages downloaded yet. Run download-serp-pages.ts first.');
    return;
  }
  
  for (const neighborhoodId of neighborhoods) {
    console.log(`  📍 ${neighborhoodId}...`);
    
    // Get downloaded pages
    const pages = await getDownloadedPages(neighborhoodId);
    console.log(`    Found ${pages.length} downloaded pages`);
    
    if (pages.length < 3) {
      console.log(`    ⚠️ Too few pages, skipping`);
      continue;
    }
    
    if (dryRun) {
      console.log(`    [DRY RUN] Would analyze ${pages.length} pages`);
      continue;
    }
    
    // Build and run analysis
    const prompt = buildAnalysisPrompt(neighborhoodId, pages);
    
    try {
      const { text, inputTokens, outputTokens } = await callGeminiFlashLite(prompt, tracker);
      
      const cost = (inputTokens / 1_000_000) * FLASH_LITE_INPUT_PRICE_PER_1M +
                   (outputTokens / 1_000_000) * FLASH_LITE_OUTPUT_PRICE_PER_1M;
      
      console.log(`    Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${cost.toFixed(4)}`);
      
      // Parse response
      const parsed = JSON.parse(text);
      
      // Build profile
      const [city, ...nameParts] = neighborhoodId.split('-');
      const profile = {
        neighborhood_id: neighborhoodId,
        city,
        name: nameParts.join(' ').replace(/^\w/, c => c.toUpperCase()),
        
        student_friendly: parsed.student_friendly || 50,
        young_professional: parsed.young_professional || 50,
        couple_friendly: parsed.couple_friendly || 50,
        family_friendly: parsed.family_friendly || 50,
        retiree_friendly: parsed.retiree_friendly || 50,
        
        digital_nomad: parsed.digital_nomad || 50,
        fitness_friendly: parsed.fitness_friendly || 50,
        foodie_scene: parsed.foodie_scene || 50,
        nightlife: parsed.nightlife || 50,
        arts_culture: parsed.arts_culture || 50,
        nature_access: parsed.nature_access || 50,
        pet_friendly: parsed.pet_friendly || 50,
        lgbtq_friendly: parsed.lgbtq_friendly || 50,
        eco_conscious: parsed.eco_conscious || 50,
        
        safety: parsed.safety || 50,
        quietness: parsed.quietness || 50,
        transport: parsed.transport || 50,
        
        gentrification_risk: parsed.gentrification_risk || 50,
        affordability: parsed.affordability || 50,
        
        vibes: parsed.vibes || [],
        evidence: parsed.evidence || {},
        
        source_count: pages.length,
        confidence: pages.length >= 20 ? 'high' : pages.length >= 10 ? 'medium' : 'low',
        analyzed_at: new Date().toISOString(),
        analysis_model: 'gemini-2.5-flash-lite',
        analysis_type: 'fulltext',  // Mark as full-text analysis
      };
      
      // Save to DynamoDB
      await docClient.send(new PutCommand({
        TableName: PROFILES_TABLE,
        Item: profile,
      }));
      
      tracker.neighborhoodsProcessed++;
      console.log(`    ✅ Analyzed: safety=${profile.safety}, nightlife=${profile.nightlife}, lgbtq=${profile.lgbtq_friendly}`);
      
    } catch (err: any) {
      console.log(`    ❌ Analysis failed: ${err.message}`);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  const totalCost = (tracker.inputTokens / 1_000_000) * FLASH_LITE_INPUT_PRICE_PER_1M +
                    (tracker.outputTokens / 1_000_000) * FLASH_LITE_OUTPUT_PRICE_PER_1M;
  
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Neighborhoods analyzed: ${tracker.neighborhoodsProcessed}`);
  console.log(`Total pages processed: ${tracker.pagesAnalyzed}`);
  console.log(`Total input tokens: ${tracker.inputTokens.toLocaleString()}`);
  console.log(`Total output tokens: ${tracker.outputTokens.toLocaleString()}`);
  console.log(`TOTAL COST: $${totalCost.toFixed(4)}`);
}

main().catch(console.error);

