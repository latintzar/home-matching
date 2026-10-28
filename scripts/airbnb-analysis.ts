#!/usr/bin/env npx tsx
/**
 * Airbnb Review Analysis Script
 * 
 * Phase 1 Pre-Launch Setup
 * 
 * Analyzes 5M Airbnb reviews to extract neighborhood-level insights:
 * - Noise levels
 * - Safety perception
 * - Tourist saturation
 * - Walkability
 * - Cleanliness
 * 
 * Two modes:
 * 1. Keyword-based (FREE) - Simple pattern matching
 * 2. LLM-enhanced ($14) - Gemini Flash-lite for richer extraction
 * 
 * Output: neighborhood_profiles table in DynamoDB
 * 
 * Usage:
 *   npx tsx scripts/airbnb-analysis.ts --mode=keywords   # FREE
 *   npx tsx scripts/airbnb-analysis.ts --mode=llm        # ~$14
 *   npx tsx scripts/airbnb-analysis.ts --mode=schema     # Discover schema first
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest } from '../src/lib/gemini-rest-client';

// ============================================================================
// Config
// ============================================================================

const AIRBNB_DB_PATH = process.env.AIRBNB_DB_PATH || 'data/airbnb_reviews.db';
const OUTPUT_TABLE = 'leo-neighborhood-profiles';
const BATCH_SIZE = 100;  // Reviews per LLM batch

// Red flag keywords for keyword-based analysis
const RED_FLAG_KEYWORDS: Record<string, string[]> = {
  noise: ['ruido', 'noise', 'ruidoso', 'noisy', 'loud', 'sonido', 'sound', 'música', 'music', 'fiesta', 'party'],
  smell: ['olor', 'smell', 'huele', 'smells', 'olfato', 'odor'],
  construction: ['obras', 'construction', 'construcc', 'reforma', 'renovation'],
  cold: ['frío', 'cold', 'frio', 'freezing', 'congelando'],
  damp: ['humedad', 'damp', 'húmedo', 'humid', 'mold', 'moho'],
  thin_walls: ['paredes finas', 'thin walls', 'se escucha', 'hear neighbors', 'vecinos'],
  pests: ['cucaracha', 'cockroach', 'ratón', 'mouse', 'insecto', 'insect', 'bichos', 'bugs'],
  safety: ['robo', 'robbery', 'theft', 'inseguro', 'unsafe', 'peligroso', 'dangerous', 'policía', 'police'],
  dirty: ['sucio', 'dirty', 'basura', 'garbage', 'trash', 'litter'],
};

const POSITIVE_KEYWORDS: Record<string, string[]> = {
  quiet: ['tranquilo', 'quiet', 'silencioso', 'peaceful', 'paz', 'calm', 'sereno'],
  safe: ['seguro', 'safe', 'tranquila', 'peaceful neighborhood'],
  walkable: ['andando', 'walking', 'caminando', 'a pie', 'walk to', 'cerca de todo', 'close to everything'],
  clean: ['limpio', 'clean', 'pulcro', 'neat', 'well-maintained'],
  green: ['parque', 'park', 'jardín', 'garden', 'verde', 'green', 'árboles', 'trees'],
};

// ============================================================================
// Types
// ============================================================================

interface NeighborhoodProfile {
  neighborhood_id: string;
  city: string;
  name: string;
  
  // Counts
  total_reviews: number;
  total_listings: number;
  
  // Keyword-based scores (from pattern matching)
  keyword_scores: {
    noise_mentions: number;
    safety_concerns: number;
    tourist_saturation: number;
    cleanliness_issues: number;
    walkability_mentions: number;
    quietness_mentions: number;
  };
  
  // Derived scores (0-100)
  scores: {
    quietness: number;          // Inverse of noise (100 = very quiet)
    safety: number;             // Safety perception
    walkability: number;        // Walkability mentions
    tourist_density: number;    // Airbnb density (inverted: 100 = few tourists)
    cleanliness: number;        // Street cleanliness
  };
  
  // LLM-enhanced (if available)
  llm_enhanced?: {
    noise_level: number;        // 0-100
    safety_feeling: number;     // 0-100
    tourist_crowding: number;   // 0-100
    common_complaints: string[];
    vibe_description: string;
  };
  
  // Meta
  confidence: 'high' | 'medium' | 'low';
  updated_at: string;
}

interface ReviewData {
  review_id: string;
  listing_id: string;
  comments: string;
  listing_neighborhood?: string;
  listing_city?: string;
}

// ============================================================================
// Database
// ============================================================================

function openAirbnbDB(): Database.Database | null {
  if (!fs.existsSync(AIRBNB_DB_PATH)) {
    console.error(`❌ Airbnb database not found at: ${AIRBNB_DB_PATH}`);
    console.log('Please download the Inside Airbnb data first.');
    return null;
  }
  
  return new Database(AIRBNB_DB_PATH, { readonly: true });
}

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

// ============================================================================
// Keyword-Based Analysis (FREE)
// ============================================================================

function countKeywordMatches(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  return keywords.filter(k => lowerText.includes(k.toLowerCase())).length;
}

function analyzeReviewKeywords(comments: string): {
  noise: number;
  safety: number;
  cleanliness: number;
  walkability: number;
  quietness: number;
} {
  const lowerComments = comments.toLowerCase();
  
  return {
    noise: countKeywordMatches(lowerComments, RED_FLAG_KEYWORDS.noise),
    safety: countKeywordMatches(lowerComments, RED_FLAG_KEYWORDS.safety),
    cleanliness: countKeywordMatches(lowerComments, [
      ...RED_FLAG_KEYWORDS.dirty,
      ...RED_FLAG_KEYWORDS.pests,
    ]),
    walkability: countKeywordMatches(lowerComments, POSITIVE_KEYWORDS.walkable),
    quietness: countKeywordMatches(lowerComments, POSITIVE_KEYWORDS.quiet),
  };
}

async function runKeywordAnalysis(db: Database.Database): Promise<Map<string, NeighborhoodProfile>> {
  console.log('\n📊 Running keyword-based analysis (FREE)...\n');
  
  // Get all neighborhoods with reviews
  const neighborhoods = db.prepare(`
    SELECT DISTINCT 
      l.neighbourhood_cleansed as neighborhood,
      l.city
    FROM listings l
    JOIN reviews r ON l.id = r.listing_id
    WHERE l.neighbourhood_cleansed IS NOT NULL
  `).all() as { neighborhood: string; city: string }[];
  
  console.log(`Found ${neighborhoods.length} neighborhoods to analyze\n`);
  
  const profiles = new Map<string, NeighborhoodProfile>();
  let processed = 0;
  
  for (const { neighborhood, city } of neighborhoods) {
    const neighborhoodId = `${city.toLowerCase()}-${neighborhood.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Get all reviews for this neighborhood
    const reviews = db.prepare(`
      SELECT r.id, r.comments
      FROM reviews r
      JOIN listings l ON l.id = r.listing_id
      WHERE l.neighbourhood_cleansed = ?
      AND r.comments IS NOT NULL
      AND LENGTH(r.comments) > 50
    `).all(neighborhood) as { id: string; comments: string }[];
    
    // Get listing count
    const listingCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM listings
      WHERE neighbourhood_cleansed = ?
    `).get(neighborhood) as { count: number };
    
    // Analyze all reviews
    let totalNoise = 0;
    let totalSafety = 0;
    let totalCleanliness = 0;
    let totalWalkability = 0;
    let totalQuietness = 0;
    
    for (const review of reviews) {
      const analysis = analyzeReviewKeywords(review.comments);
      totalNoise += analysis.noise;
      totalSafety += analysis.safety;
      totalCleanliness += analysis.cleanliness;
      totalWalkability += analysis.walkability;
      totalQuietness += analysis.quietness;
    }
    
    const reviewCount = reviews.length;
    
    // Calculate scores (normalize to 0-100)
    // More mentions of noise = lower quietness score
    const noiseRate = reviewCount > 0 ? (totalNoise / reviewCount) * 100 : 0;
    const safetyRate = reviewCount > 0 ? (totalSafety / reviewCount) * 100 : 0;
    const cleanlinessRate = reviewCount > 0 ? (totalCleanliness / reviewCount) * 100 : 0;
    
    // Positive mentions = higher scores
    const walkabilityRate = reviewCount > 0 ? Math.min((totalWalkability / reviewCount) * 50, 100) : 50;
    const quietnessRate = reviewCount > 0 ? Math.min((totalQuietness / reviewCount) * 50, 100) : 50;
    
    // Invert negative rates
    const quietnessScore = Math.max(0, Math.min(100, 100 - noiseRate * 20 + quietnessRate));
    const safetyScore = Math.max(0, Math.min(100, 80 - safetyRate * 30));  // Start at 80, subtract for concerns
    const cleanlinessScore = Math.max(0, Math.min(100, 80 - cleanlinessRate * 20));
    
    // Tourist density (more listings = more tourists)
    const listingDensity = listingCount.count;
    const touristScore = Math.max(0, Math.min(100, 100 - Math.min(listingDensity / 50, 1) * 60));
    
    // Confidence based on review count
    let confidence: 'high' | 'medium' | 'low';
    if (reviewCount >= 1000) confidence = 'high';
    else if (reviewCount >= 100) confidence = 'medium';
    else confidence = 'low';
    
    const profile: NeighborhoodProfile = {
      neighborhood_id: neighborhoodId,
      city,
      name: neighborhood,
      total_reviews: reviewCount,
      total_listings: listingCount.count,
      keyword_scores: {
        noise_mentions: totalNoise,
        safety_concerns: totalSafety,
        tourist_saturation: listingDensity,
        cleanliness_issues: totalCleanliness,
        walkability_mentions: totalWalkability,
        quietness_mentions: totalQuietness,
      },
      scores: {
        quietness: Math.round(quietnessScore),
        safety: Math.round(safetyScore),
        walkability: Math.round(walkabilityRate),
        tourist_density: Math.round(touristScore),
        cleanliness: Math.round(cleanlinessScore),
      },
      confidence,
      updated_at: new Date().toISOString(),
    };
    
    profiles.set(neighborhoodId, profile);
    processed++;
    
    if (processed % 50 === 0) {
      console.log(`Processed ${processed}/${neighborhoods.length} neighborhoods...`);
    }
  }
  
  console.log(`\n✅ Analyzed ${profiles.size} neighborhoods\n`);
  
  return profiles;
}

// ============================================================================
// LLM-Enhanced Analysis (~$14 for 5M reviews)
// ============================================================================

const LLM_EXTRACTION_PROMPT = `Extract neighborhood insights from these Airbnb reviews.
Focus ONLY on the AREA/NEIGHBORHOOD - NOT the apartment or host.

IGNORE:
- Apartment interior (bed, wifi, kitchen)
- Host behavior (responsive, friendly)
- Check-in process
- Value for money

EXTRACT (only if mentioned):
{
  "noise_level": 1-5 or null (1=silent, 5=very loud),
  "safety_feeling": 1-5 or null (1=unsafe, 5=very safe),
  "tourist_crowding": 1-5 or null (1=quiet, 5=overrun),
  "walkability": 1-5 or null (1=car needed, 5=everything walkable),
  "construction_nearby": true/false/null,
  "street_smells": true/false/null,
  "nightlife_noise": true/false/null,
  "parking_difficulty": 1-5 or null (1=easy, 5=impossible)
}

REVIEWS:
`;

async function runLLMAnalysis(
  db: Database.Database, 
  profiles: Map<string, NeighborhoodProfile>
): Promise<void> {
  console.log('\n🤖 Running LLM-enhanced analysis (~$14 for all reviews)...\n');
  
  let totalCost = 0;
  let processedReviews = 0;
  
  for (const [neighborhoodId, profile] of profiles) {
    // Get sample reviews (up to 500 per neighborhood for cost control)
    const reviews = db.prepare(`
      SELECT r.id, r.comments
      FROM reviews r
      JOIN listings l ON l.id = r.listing_id
      WHERE l.neighbourhood_cleansed = ?
      AND r.comments IS NOT NULL
      AND LENGTH(r.comments) > 100
      ORDER BY RANDOM()
      LIMIT 500
    `).all(profile.name) as { id: string; comments: string }[];
    
    if (reviews.length < 10) continue;  // Not enough reviews for meaningful analysis
    
    // Process in batches
    const batchResults: any[] = [];
    
    for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
      const batch = reviews.slice(i, i + BATCH_SIZE);
      const reviewText = batch.map((r, idx) => `Review ${idx + 1}: "${r.comments.substring(0, 300)}"`).join('\n\n');
      
      const prompt = LLM_EXTRACTION_PROMPT + reviewText;
      
      const response = await callGeminiRest(prompt, {
        model: 'gemini-2.5-flash-lite',
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      });
      
      if (response.success && response.text) {
        try {
          const parsed = JSON.parse(response.text);
          batchResults.push(parsed);
        } catch {
          // Ignore parse errors
        }
      }
      
      // Estimate cost
      const inputTokens = prompt.length / 4;  // ~4 chars per token
      const outputTokens = 200;  // Estimated
      totalCost += (inputTokens * 0.00002 + outputTokens * 0.00008) / 1000;
      
      processedReviews += batch.length;
      
      if (processedReviews % 1000 === 0) {
        console.log(`Processed ${processedReviews} reviews, estimated cost: $${totalCost.toFixed(2)}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Aggregate batch results
    if (batchResults.length > 0) {
      const avgNoise = batchResults.filter(r => r.noise_level).reduce((a, r) => a + r.noise_level, 0) / batchResults.filter(r => r.noise_level).length || null;
      const avgSafety = batchResults.filter(r => r.safety_feeling).reduce((a, r) => a + r.safety_feeling, 0) / batchResults.filter(r => r.safety_feeling).length || null;
      const avgTourist = batchResults.filter(r => r.tourist_crowding).reduce((a, r) => a + r.tourist_crowding, 0) / batchResults.filter(r => r.tourist_crowding).length || null;
      
      const constructionMentions = batchResults.filter(r => r.construction_nearby === true).length;
      const smellMentions = batchResults.filter(r => r.street_smells === true).length;
      const nightlifeMentions = batchResults.filter(r => r.nightlife_noise === true).length;
      
      const complaints: string[] = [];
      if (constructionMentions > batchResults.length * 0.1) complaints.push('construction');
      if (smellMentions > batchResults.length * 0.1) complaints.push('street smells');
      if (nightlifeMentions > batchResults.length * 0.1) complaints.push('nightlife noise');
      if (avgNoise && avgNoise > 3) complaints.push('general noise');
      
      profile.llm_enhanced = {
        noise_level: avgNoise ? Math.round((5 - avgNoise) / 5 * 100) : profile.scores.quietness,
        safety_feeling: avgSafety ? Math.round(avgSafety / 5 * 100) : profile.scores.safety,
        tourist_crowding: avgTourist ? Math.round((5 - avgTourist) / 5 * 100) : profile.scores.tourist_density,
        common_complaints: complaints,
        vibe_description: `${complaints.length === 0 ? 'Pleasant' : 'Mixed'} neighborhood with ${profile.total_listings} Airbnb listings`,
      };
      
      // Update main scores with LLM data
      if (profile.llm_enhanced.noise_level) {
        profile.scores.quietness = Math.round((profile.scores.quietness + profile.llm_enhanced.noise_level) / 2);
      }
      if (profile.llm_enhanced.safety_feeling) {
        profile.scores.safety = Math.round((profile.scores.safety + profile.llm_enhanced.safety_feeling) / 2);
      }
    }
  }
  
  console.log(`\n✅ LLM analysis complete. Total cost: $${totalCost.toFixed(2)}\n`);
}

// ============================================================================
// Schema Discovery (Optional - find what dimensions to extract)
// ============================================================================

async function discoverSchema(db: Database.Database): Promise<void> {
  console.log('\n🔍 Discovering extraction schema from sample reviews...\n');
  
  // Get 200 random reviews
  const reviews = db.prepare(`
    SELECT r.comments
    FROM reviews r
    WHERE r.comments IS NOT NULL
    AND LENGTH(r.comments) > 150
    ORDER BY RANDOM()
    LIMIT 200
  `).all() as { comments: string }[];
  
  const reviewText = reviews.map((r, i) => `${i + 1}. "${r.comments.substring(0, 400)}"`).join('\n\n');
  
  const prompt = `You are analyzing Airbnb reviews to discover what measurable attributes 
we can extract about the AREA/NEIGHBORHOOD/STREET - NOT the apartment itself.

IGNORE anything about:
- The host (responsiveness, friendliness)
- The apartment interior (cleanliness, bed comfort, TV, wifi)
- Check-in process
- Value for money

FOCUS ONLY ON:
- Street/neighborhood noise levels
- Area safety feeling
- Walkability to amenities
- Tourist density/crowding
- Construction in the area
- Parking situation
- Nightlife/bar noise from outside
- Smells from the street/area
- Public transport access
- Beach/nature proximity feeling

Here are 200 sample reviews from various properties:
${reviewText}

TASK: Identify 8-12 measurable dimensions about the AREA that:
1. Are mentioned frequently across reviews
2. Tell us about the NEIGHBORHOOD (not the apartment)
3. Would help a home buyer/renter understand what living there is like
4. Can be scored 1-5 or as boolean

Output JSON schema with name, type, description, example_phrases.`;

  console.log('Calling Gemini for schema discovery...');
  
  const response = await callGeminiRest(prompt, {
    model: 'gemini-3-pro-preview',
    temperature: 0.3,
    maxOutputTokens: 2000,
    thinkingConfig: { thinkingLevel: 'MEDIUM' },
  });
  
  if (response.success && response.text) {
    console.log('\n📋 Discovered Schema:\n');
    console.log(response.text);
    
    // Save to file
    fs.writeFileSync('data/airbnb_schema.json', response.text);
    console.log('\nSaved to data/airbnb_schema.json');
  } else {
    console.error('❌ Schema discovery failed:', response.error);
  }
}

// ============================================================================
// Save to DynamoDB
// ============================================================================

async function saveProfiles(profiles: Map<string, NeighborhoodProfile>): Promise<void> {
  console.log(`\n💾 Saving ${profiles.size} profiles to DynamoDB...\n`);
  
  const client = getDocClient();
  const profileArray = Array.from(profiles.values());
  
  // Batch write (25 items per batch)
  for (let i = 0; i < profileArray.length; i += 25) {
    const batch = profileArray.slice(i, i + 25);
    
    const writeRequests = batch.map(profile => ({
      PutRequest: {
        Item: profile,
      },
    }));
    
    try {
      await client.send(new BatchWriteCommand({
        RequestItems: {
          [OUTPUT_TABLE]: writeRequests,
        },
      }));
      
      console.log(`Saved batch ${Math.floor(i / 25) + 1}/${Math.ceil(profileArray.length / 25)}`);
    } catch (error) {
      console.error('Batch write error:', error);
      
      // Fallback to individual writes
      for (const profile of batch) {
        try {
          await client.send(new PutCommand({
            TableName: OUTPUT_TABLE,
            Item: profile,
          }));
        } catch (e) {
          console.error(`Failed to save ${profile.neighborhood_id}:`, e);
        }
      }
    }
  }
  
  console.log('\n✅ Profiles saved to DynamoDB\n');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'keywords';
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           AIRBNB REVIEW ANALYSIS SCRIPT                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Mode: ${mode.padEnd(54)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Check environment
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error('❌ AWS credentials not set. Run:');
    console.log('source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION');
    process.exit(1);
  }
  
  const db = openAirbnbDB();
  if (!db) {
    process.exit(1);
  }
  
  try {
    if (mode === 'schema') {
      await discoverSchema(db);
    } else {
      // Always run keyword analysis first (FREE)
      const profiles = await runKeywordAnalysis(db);
      
      // Optionally enhance with LLM
      if (mode === 'llm') {
        await runLLMAnalysis(db, profiles);
      }
      
      // Save to DynamoDB
      await saveProfiles(profiles);
      
      // Summary
      const totalReviews = Array.from(profiles.values()).reduce((a, p) => a + p.total_reviews, 0);
      console.log('\n📊 Summary:');
      console.log(`   Neighborhoods analyzed: ${profiles.size}`);
      console.log(`   Total reviews processed: ${totalReviews.toLocaleString()}`);
      console.log(`   Mode: ${mode === 'llm' ? 'LLM-enhanced (~$14)' : 'Keywords (FREE)'}`);
    }
  } finally {
    db.close();
  }
  
  console.log('\n✅ Done!\n');
}

main().catch(console.error);

