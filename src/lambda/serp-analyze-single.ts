/**
 * serp-analyze-single Lambda
 * 
 * Analyzes downloaded SERP pages for ONE neighborhood using Gemini 2.5 Flash.
 * Reads HTML from S3, extracts content, sends to Gemini, saves profile to DynamoDB.
 * 
 * Input: { neighborhoodId }
 * Output: { success, profile, inputTokens, outputTokens, cost }
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const PROFILES_TABLE = 'leo-neighborhood-profiles';

// Gemini 2.5 Flash pricing
const FLASH_INPUT_PRICE_PER_1M = 0.30;
const FLASH_OUTPUT_PRICE_PER_1M = 2.50;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface Event {
  neighborhoodId: string;
}

interface ExtractedContent {
  url: string;
  category: string;
  content: string;
}

// Simple HTML to text extraction (no cheerio needed)
function extractMainContent(html: string): string {
  // Remove scripts, styles, and other noise
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')  // Remove all remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Limit to 4000 chars per page
  return text.slice(0, 4000);
}

// Get all downloaded pages for a neighborhood
async function getDownloadedPages(neighborhoodId: string): Promise<ExtractedContent[]> {
  const pages: ExtractedContent[] = [];
  const prefix = `serp-html/${neighborhoodId}/`;
  
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
        const getResult = await s3.send(new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: obj.Key,
        }));
        
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
        console.log(`  ⚠️ Failed to read: ${obj.Key}`);
      }
    }
    
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);
  
  return pages;
}

// Call Gemini 2.5 Flash via publisher endpoint
async function callGeminiFlash(prompt: string): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  // Publisher endpoint (works for all models)
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error.slice(0, 200)}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
  
  return { text, inputTokens, outputTokens };
}

// Build analysis prompt
function buildPrompt(neighborhoodId: string, pages: ExtractedContent[]): string {
  const [city, ...nameParts] = neighborhoodId.split('-');
  const name = nameParts.join(' ').replace(/-/g, ' ');
  
  // Group by category and build content summary
  const byCategory = new Map<string, ExtractedContent[]>();
  for (const page of pages) {
    if (!byCategory.has(page.category)) {
      byCategory.set(page.category, []);
    }
    byCategory.get(page.category)!.push(page);
  }
  
  let contentSummary = '';
  for (const [category, catPages] of byCategory) {
    contentSummary += `\n### ${category.toUpperCase()}\n`;
    for (const page of catPages.slice(0, 3)) {
      contentSummary += `\n[Source: ${page.url}]\n${page.content.slice(0, 2000)}\n`;
    }
  }
  
  return `You are a neighborhood analyst for ${city}, Spain. Analyze these articles about "${name}" and score it on 20 dimensions.

SCORING GUIDE (0-100):
- 0-30: Poor/very negative
- 31-50: Below average
- 51-70: Average/decent
- 71-85: Good/above average  
- 86-100: Excellent/outstanding

Pay attention to:
- Current state (not historical)
- Sentiment and context
- Specific mentions of demographics, activities, amenities

ARTICLES:
${contentSummary}

Return JSON with these exact keys:
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
    "lgbtq_friendly": ["direct quote 1", "quote 2"],
    "safety": ["quote about safety"],
    "nightlife": ["quote about nightlife"]
  },
  "summary": "2-3 sentence summary of the neighborhood character"
}

Extract ACTUAL QUOTES from the articles. Use 50 if no evidence.`;
}

export async function handler(event: Event) {
  const { neighborhoodId } = event;
  
  console.log(`🔍 Analyzing: ${neighborhoodId}`);
  
  try {
    // Get downloaded pages
    const pages = await getDownloadedPages(neighborhoodId);
    console.log(`  📄 Found ${pages.length} pages`);
    
    if (pages.length < 3) {
      return { success: false, neighborhoodId, error: 'Not enough pages' };
    }
    
    // Build prompt and call Gemini
    const prompt = buildPrompt(neighborhoodId, pages);
    const { text, inputTokens, outputTokens } = await callGeminiFlash(prompt);
    
    const cost = (inputTokens / 1_000_000) * FLASH_INPUT_PRICE_PER_1M +
                 (outputTokens / 1_000_000) * FLASH_OUTPUT_PRICE_PER_1M;
    
    console.log(`  💰 Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${cost.toFixed(4)}`);
    
    // Parse response
    const parsed = JSON.parse(text);
    
    // Build profile
    const [city, ...nameParts] = neighborhoodId.split('-');
    const profile = {
      neighborhood_id: neighborhoodId,
      city,
      name: nameParts.join(' ').replace(/^\w/, c => c.toUpperCase()),
      
      // Scores
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
    
    console.log(`  ✅ Saved: lgbtq=${profile.lgbtq_friendly}, safety=${profile.safety}, nightlife=${profile.nightlife}`);
    
    return {
      success: true,
      neighborhoodId,
      profile: {
        lgbtq_friendly: profile.lgbtq_friendly,
        safety: profile.safety,
        nightlife: profile.nightlife,
        foodie_scene: profile.foodie_scene,
        vibes: profile.vibes,
      },
      inputTokens,
      outputTokens,
      cost,
    };
    
  } catch (err: any) {
    console.error(`  ❌ Error: ${err.message}`);
    return { success: false, neighborhoodId, error: err.message };
  }
}
