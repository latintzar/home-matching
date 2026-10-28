/**
 * Analyze Neighborhood SERP Data with Gemini 2.5 Flash-Lite
 * 
 * This script reads raw SERP data from leo-serp-extractions and uses
 * Gemini to properly analyze and score each dimension (instead of keyword matching).
 * 
 * Cost: ~$0.001 per neighborhood (~$0.09 for all 86)
 * 
 * Usage:
 *   npx tsx scripts/analyze-neighborhood-serp.ts [--city=<city>] [--dry-run]
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Gemini 2.5 Flash-Lite pricing
const FLASH_LITE_INPUT_PRICE_PER_1M = 0.10;
const FLASH_LITE_OUTPUT_PRICE_PER_1M = 0.40;

interface CostTracker {
  neighborhoodsProcessed: number;
  inputTokens: number;
  outputTokens: number;
}

interface SerpExtraction {
  neighborhood_id: string;
  dimension: string;
  query: string;
  results: Array<{
    title: string;
    snippet: string;
    link: string;
  }>;
  created_at: string;
}

interface NeighborhoodProfile {
  neighborhood_id: string;
  city: string;
  name: string;
  
  // Life Stage (0-100)
  student_friendly: number;
  young_professional: number;
  couple_friendly: number;
  family_friendly: number;
  retiree_friendly: number;
  
  // Lifestyle (0-100)
  digital_nomad: number;
  fitness_friendly: number;
  foodie_scene: number;
  nightlife: number;
  arts_culture: number;
  nature_access: number;
  pet_friendly: number;
  lgbtq_friendly: number;
  eco_conscious: number;
  
  // Universal (0-100)
  safety: number;
  quietness: number;
  transport: number;
  
  // Economic (0-100)
  gentrification_risk: number;
  affordability: number;
  
  // Qualitative
  vibes: string[];
  evidence: Record<string, string[]>;
  
  // Meta
  source_count: number;
  confidence: 'high' | 'medium' | 'low';
  analyzed_at: string;
  analysis_model: string;
}

const DIMENSIONS = [
  'student', 'young_professional', 'couple', 'family', 'retiree',
  'digital_nomad', 'fitness', 'foodie', 'nightlife', 'arts',
  'nature', 'pet', 'lgbtq', 'eco', 'safety',
  'quietness', 'transport', 'vibe', 'gentrification', 'budget'
];

const DIMENSION_MAP: Record<string, string> = {
  'student': 'student_friendly',
  'young_professional': 'young_professional',
  'couple': 'couple_friendly',
  'family': 'family_friendly',
  'retiree': 'retiree_friendly',
  'digital_nomad': 'digital_nomad',
  'fitness': 'fitness_friendly',
  'foodie': 'foodie_scene',
  'nightlife': 'nightlife',
  'arts': 'arts_culture',
  'nature': 'nature_access',
  'pet': 'pet_friendly',
  'lgbtq': 'lgbtq_friendly',
  'eco': 'eco_conscious',
  'safety': 'safety',
  'quietness': 'quietness',
  'transport': 'transport',
  'gentrification': 'gentrification_risk',
  'budget': 'affordability',
};

async function callGeminiFlashLite(prompt: string, tracker: CostTracker): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY not set');
  }
  
  // Use Vertex AI publisher endpoint (same as zeroShotGemini3.ts)
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
  
  return { text, inputTokens, outputTokens };
}

function buildAnalysisPrompt(neighborhoodId: string, serpData: Map<string, SerpResult[]>): string {
  const [city, ...nameParts] = neighborhoodId.split('-');
  const name = nameParts.join('-').replace(/-/g, ' ');
  
  let serpSummary = '';
  for (const [category, results] of serpData) {
    serpSummary += `\n### ${category.toUpperCase()}\n`;
    // Take top 5 results by credibility
    const topResults = results.sort((a, b) => b.credibility - a.credibility).slice(0, 5);
    for (const result of topResults) {
      serpSummary += `- ${result.title}: ${result.snippet}\n`;
    }
  }
  
  return `You are analyzing search results about the neighborhood "${name}" in ${city}, Spain.

Based on the search results below, score the neighborhood on each dimension from 0-100:
- 0-30: Poor/negative sentiment
- 31-50: Below average
- 51-70: Average/decent
- 71-85: Good/above average
- 86-100: Excellent/outstanding

If no clear evidence, use 50 (neutral).

SEARCH RESULTS:
${serpSummary}

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
  "vibes": ["word1", "word2", "word3"],
  "evidence": {
    "dimension_name": ["supporting quote 1", "supporting quote 2"]
  }
}

Be accurate and base scores ONLY on the search results provided. Extract actual quotes for evidence.`;
}

interface SerpResult {
  title: string;
  snippet: string;
  url: string;
  query_category: string;
  credibility: number;
}

async function getNeighborhoodSerpData(
  docClient: DynamoDBDocumentClient,
  neighborhoodId: string
): Promise<Map<string, SerpResult[]>> {
  const serpData = new Map<string, SerpResult[]>();
  
  // Scan for all results for this neighborhood
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-serp-extractions',
      FilterExpression: 'neighborhood_id = :nid',
      ExpressionAttributeValues: { ':nid': neighborhoodId },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const category = item.query_category as string || 'general';
      if (!serpData.has(category)) {
        serpData.set(category, []);
      }
      serpData.get(category)!.push({
        title: item.title as string,
        snippet: item.snippet as string,
        url: item.url as string,
        query_category: category,
        credibility: item.credibility as number || 50,
      });
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return serpData;
}

async function analyzeNeighborhood(
  docClient: DynamoDBDocumentClient,
  neighborhoodId: string,
  tracker: CostTracker,
  dryRun: boolean
): Promise<NeighborhoodProfile | null> {
  const serpData = await getNeighborhoodSerpData(docClient, neighborhoodId);
  
  // Count total results
  let totalResults = 0;
  for (const results of serpData.values()) {
    totalResults += results.length;
  }
  
  if (totalResults < 5) {
    console.log(`    ⚠️ Only ${totalResults} SERP results, skipping`);
    return null;
  }
  
  const prompt = buildAnalysisPrompt(neighborhoodId, serpData);
  
  if (dryRun) {
    console.log(`    [DRY RUN] Would analyze with ${prompt.length} char prompt`);
    return null;
  }
  
  try {
    const { text, inputTokens, outputTokens } = await callGeminiFlashLite(prompt, tracker);
    
    const cost = (inputTokens / 1_000_000) * FLASH_LITE_INPUT_PRICE_PER_1M +
                 (outputTokens / 1_000_000) * FLASH_LITE_OUTPUT_PRICE_PER_1M;
    
    console.log(`    Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${cost.toFixed(4)}`);
    
    // Parse response
    const parsed = JSON.parse(text);
    
    // Build profile
    const [city, ...nameParts] = neighborhoodId.split('-');
    const profile: NeighborhoodProfile = {
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
      
      source_count: totalResults,
      confidence: totalResults >= 30 ? 'high' : totalResults >= 15 ? 'medium' : 'low',
      analyzed_at: new Date().toISOString(),
      analysis_model: 'gemini-2.5-flash-lite',
    };
    
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: 'leo-neighborhood-profiles',
      Item: profile,
    }));
    
    return profile;
    
  } catch (error) {
    console.error(`    ❌ Analysis failed: ${error}`);
    return null;
  }
}

async function getUniqueNeighborhoods(
  docClient: DynamoDBDocumentClient,
  cityFilter?: string
): Promise<string[]> {
  const neighborhoods = new Set<string>();
  
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: 'leo-serp-extractions',
      ProjectionExpression: 'neighborhood_id',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const nid = item.neighborhood_id as string;
      if (!cityFilter || nid.startsWith(cityFilter + '-')) {
        neighborhoods.add(nid);
      }
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return Array.from(neighborhoods).sort();
}

async function main() {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const cityFilter = cityArg?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     GEMINI NEIGHBORHOOD ANALYSIS (Flash-Lite)                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Analyzes raw SERP data to produce proper dimension scores   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - no API calls or writes\n');
  }
  
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const docClient = DynamoDBDocumentClient.from(client);
  
  const tracker: CostTracker = {
    neighborhoodsProcessed: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  
  // Get all neighborhoods with SERP data
  const neighborhoods = await getUniqueNeighborhoods(docClient, cityFilter);
  console.log(`📊 Found ${neighborhoods.length} neighborhoods with SERP data${cityFilter ? ` (filtered: ${cityFilter})` : ''}\n`);
  
  for (const neighborhoodId of neighborhoods) {
    console.log(`  📍 ${neighborhoodId}...`);
    
    const profile = await analyzeNeighborhood(docClient, neighborhoodId, tracker, dryRun);
    
    if (profile) {
      tracker.neighborhoodsProcessed++;
      
      // Show a few key scores
      console.log(`    ✅ Analyzed: safety=${profile.safety}, nightlife=${profile.nightlife}, lgbtq=${profile.lgbtq_friendly}`);
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
  console.log(`Total input tokens: ${tracker.inputTokens.toLocaleString()}`);
  console.log(`Total output tokens: ${tracker.outputTokens.toLocaleString()}`);
  console.log(`TOTAL COST: $${totalCost.toFixed(4)}`);
}

main().catch(console.error);

