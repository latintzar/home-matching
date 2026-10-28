/**
 * serp-analyze-batch Lambda
 * 
 * Reads downloaded SERP pages from S3 and analyzes with Gemini 2.5 Flash.
 * Called automatically after serp-download-batch completes.
 * 
 * Timeout: 15 minutes
 * Memory: 1024 MB
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as cheerio from 'cheerio';

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const PROFILES_TABLE = 'leo-neighborhood-profiles';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;

// Gemini 2.5 Flash pricing
const FLASH_INPUT_PRICE = 0.30 / 1_000_000;
const FLASH_OUTPUT_PRICE = 2.50 / 1_000_000;

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface Event {
  neighborhoodId?: string;  // Analyze single neighborhood
  city?: string;            // Analyze all in city
}

interface PageContent {
  url: string;
  category: string;
  content: string;
}

function extractMainContent(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Remove noise elements
    $('script, style, nav, header, footer, aside, .sidebar, .comments, .ad, .advertisement, .cookie, .popup, .menu, .navigation, noscript, iframe').remove();
    
    // Try common content selectors
    let content = '';
    const selectors = ['article', 'main', '.content', '.post-content', '.entry-content', '.article-body', '#content', '.post', '[role="main"]'];
    
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        content = el.text();
        break;
      }
    }
    
    // Fallback to body
    if (!content || content.length < 200) {
      content = $('body').text();
    }
    
    // Clean whitespace
    return content.replace(/\s+/g, ' ').trim().slice(0, 4000);
  } catch {
    return '';
  }
}

async function getDownloadedPages(neighborhoodId: string): Promise<PageContent[]> {
  const pages: PageContent[] = [];
  const prefix = `serp-html/${neighborhoodId}/`;
  
  let token: string | undefined;
  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    
    for (const obj of result.Contents || []) {
      if (!obj.Key) continue;
      
      try {
        const getResult = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: obj.Key }));
        const html = await getResult.Body?.transformToString() || '';
        const content = extractMainContent(html);
        
        if (content.length > 100) {
          pages.push({
            url: getResult.Metadata?.['source-url'] || obj.Key,
            category: getResult.Metadata?.['query-category'] || 'general',
            content,
          });
        }
      } catch (err) {
        // Skip failed reads silently
      }
    }
    token = result.NextContinuationToken;
  } while (token);
  
  return pages;
}

async function callGeminiFlash(prompt: string): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  // Publisher endpoint (works for all models)
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error: ${response.status} - ${errorText.slice(0, 200)}`);
  }
  
  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

function buildPrompt(neighborhoodId: string, pages: PageContent[]): string {
  const [city, ...nameParts] = neighborhoodId.split('-');
  const name = nameParts.join(' ').replace(/-/g, ' ');
  
  // Group by category
  const byCategory = new Map<string, PageContent[]>();
  for (const p of pages) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }
  
  let contentSummary = '';
  for (const [cat, catPages] of byCategory) {
    contentSummary += `\n### ${cat.toUpperCase()}\n`;
    for (const p of catPages.slice(0, 3)) {
      contentSummary += `[Source: ${p.url.slice(0, 80)}]\n${p.content.slice(0, 2000)}\n\n`;
    }
  }
  
  return `You are a neighborhood analyst for ${city}, Spain. Analyze these articles about "${name}" and score it on 20 dimensions.

SCORING GUIDE (0-100):
- 0-30: Poor/very negative sentiment
- 31-50: Below average
- 51-70: Average/decent
- 71-85: Good/above average  
- 86-100: Excellent/outstanding

Pay attention to:
- Current state (not historical - "used to be" means it's not anymore)
- Sentiment and context in the articles
- Specific mentions of demographics, activities, amenities
- Safety concerns, noise levels, transportation

ARTICLES ABOUT "${name.toUpperCase()}":
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
  "vibes": ["descriptive", "words", "about", "the", "area"],
  "evidence": {
    "lgbtq_friendly": ["direct quote from article"],
    "safety": ["quote about safety"],
    "nightlife": ["quote about nightlife"]
  },
  "summary": "2-3 sentence summary of the neighborhood character and who it's best for"
}

Extract ACTUAL QUOTES from the articles as evidence. Use 50 if no evidence for a dimension.`;
}

async function analyzeNeighborhood(neighborhoodId: string): Promise<{ success: boolean; cost?: number; error?: string }> {
  console.log(`  📍 Analyzing: ${neighborhoodId}`);
  
  try {
    const pages = await getDownloadedPages(neighborhoodId);
    console.log(`     Found ${pages.length} pages`);
    
    if (pages.length < 5) {
      console.log(`     ⚠️ Not enough pages, skipping`);
      return { success: false, error: 'Not enough pages' };
    }
    
    const prompt = buildPrompt(neighborhoodId, pages);
    const { text, inputTokens, outputTokens } = await callGeminiFlash(prompt);
    
    const cost = inputTokens * FLASH_INPUT_PRICE + outputTokens * FLASH_OUTPUT_PRICE;
    console.log(`     Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${cost.toFixed(4)}`);
    
    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.log(`     ❌ Failed to parse JSON response`);
      return { success: false, error: 'JSON parse error' };
    }
    
    // Build profile
    const [city, ...nameParts] = neighborhoodId.split('-');
    const profile = {
      neighborhood_id: neighborhoodId,
      city,
      name: nameParts.join(' ').replace(/^\w/, c => c.toUpperCase()),
      
      // Scores
      student_friendly: parsed.student_friendly ?? 50,
      young_professional: parsed.young_professional ?? 50,
      couple_friendly: parsed.couple_friendly ?? 50,
      family_friendly: parsed.family_friendly ?? 50,
      retiree_friendly: parsed.retiree_friendly ?? 50,
      digital_nomad: parsed.digital_nomad ?? 50,
      fitness_friendly: parsed.fitness_friendly ?? 50,
      foodie_scene: parsed.foodie_scene ?? 50,
      nightlife: parsed.nightlife ?? 50,
      arts_culture: parsed.arts_culture ?? 50,
      nature_access: parsed.nature_access ?? 50,
      pet_friendly: parsed.pet_friendly ?? 50,
      lgbtq_friendly: parsed.lgbtq_friendly ?? 50,
      eco_conscious: parsed.eco_conscious ?? 50,
      safety: parsed.safety ?? 50,
      quietness: parsed.quietness ?? 50,
      transport: parsed.transport ?? 50,
      gentrification_risk: parsed.gentrification_risk ?? 50,
      affordability: parsed.affordability ?? 50,
      
      // Qualitative
      vibes: parsed.vibes || [],
      evidence: parsed.evidence || {},
      summary: parsed.summary || '',
      
      // Meta
      source_count: pages.length,
      confidence: pages.length >= 15 ? 'high' : pages.length >= 8 ? 'medium' : 'low',
      analyzed_at: new Date().toISOString(),
      analysis_model: 'gemini-2.5-flash',
      analysis_type: 'fulltext',
    };
    
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: PROFILES_TABLE,
      Item: profile,
    }));
    
    console.log(`     ✅ Saved: lgbtq=${profile.lgbtq_friendly}, safety=${profile.safety}, nightlife=${profile.nightlife}`);
    
    return { success: true, cost };
    
  } catch (err: any) {
    console.log(`     ❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function getNeighborhoodsWithPages(cityFilter?: string): Promise<Map<string, number>> {
  const neighborhoods = new Map<string, number>();
  let token: string | undefined;
  
  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'serp-html/',
      ContinuationToken: token,
    }));
    
    for (const obj of result.Contents || []) {
      const parts = obj.Key?.split('/');
      if (parts && parts.length >= 2) {
        const nid = parts[1];
        if (!cityFilter || nid.startsWith(cityFilter + '-')) {
          neighborhoods.set(nid, (neighborhoods.get(nid) || 0) + 1);
        }
      }
    }
    token = result.NextContinuationToken;
  } while (token);
  
  return neighborhoods;
}

export async function handler(event: Event) {
  const { neighborhoodId, city } = event;
  
  console.log(`🔍 SERP Analysis starting${city ? ` (city: ${city})` : ''}`);
  
  // Single neighborhood mode
  if (neighborhoodId) {
    return await analyzeNeighborhood(neighborhoodId);
  }
  
  // Get all neighborhoods with enough pages
  const neighborhoodCounts = await getNeighborhoodsWithPages(city);
  const toAnalyze = Array.from(neighborhoodCounts.entries())
    .filter(([, count]) => count >= 5)
    .map(([nid]) => nid)
    .sort();
  
  console.log(`📊 Found ${toAnalyze.length} neighborhoods ready for analysis\n`);
  
  if (toAnalyze.length === 0) {
    return { analyzed: 0, totalCost: 0 };
  }
  
  let analyzed = 0;
  let failed = 0;
  let totalCost = 0;
  
  for (const nid of toAnalyze) {
    const result = await analyzeNeighborhood(nid);
    
    if (result.success) {
      analyzed++;
      totalCost += result.cost || 0;
    } else {
      failed++;
    }
    
    // Rate limit for Gemini
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n✅ Analysis complete: ${analyzed} analyzed, ${failed} failed`);
  console.log(`💰 Total Gemini cost: $${totalCost.toFixed(4)}`);
  
  return { analyzed, failed, totalCost };
}

// Run as script
if (require.main === module) {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const nidArg = args.find(a => a.startsWith('--neighborhood='));
  
  const city = cityArg?.split('=')[1];
  const neighborhoodId = nidArg?.split('=')[1];
  
  handler({ city, neighborhoodId }).then(result => {
    console.log('\n📊 Final Result:', JSON.stringify(result, null, 2));
  }).catch(console.error);
}

