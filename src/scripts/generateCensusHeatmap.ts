#!/usr/bin/env npx tsx
/**
 * Generate Real Heatmap from Census Sections
 * 
 * Uses 1,068 Barcelona census sections with full polygon geometry
 * to create a smooth, high-resolution heatmap based on fit scores.
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && \
 *   export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
 *   npx tsx src/scripts/generateCensusHeatmap.ts
 * 
 * Output:
 *   public/heatmap-demo/barcelona-census-heatmap.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// DynamoDB Setup
// ============================================================================

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'leo-census-sections';

// ============================================================================
// Configuration - Mock User Preferences
// ============================================================================

// Work and partner locations (commute anchors)
const ANCHORS = {
  work: { lng: 2.1686, lat: 41.3874, name: 'Work (Diagonal)', weight: 1.0 },
  partner: { lng: 2.1899, lat: 41.4036, name: 'Partner (Horta)', weight: 0.8 },
};

// Lifestyle hotspots with weights (where user wants to be near)
const LIFESTYLE_HOTSPOTS = [
  { lng: 2.1543, lat: 41.4025, weight: 1.0, name: 'Gràcia' },
  { lng: 2.1734, lat: 41.3874, weight: 0.9, name: 'Eixample Center' },
  { lng: 2.1830, lat: 41.3850, weight: 0.7, name: 'Sagrada Familia' },
  { lng: 2.1950, lat: 41.4000, weight: 0.85, name: 'Poblenou Tech' },
  { lng: 2.1800, lat: 41.3780, weight: 0.8, name: 'Born/Gothic' },
  { lng: 2.1200, lat: 41.3750, weight: 0.5, name: 'Sants Station' },
  { lng: 2.1650, lat: 41.3920, weight: 0.75, name: 'Sant Gervasi' },
];

// Scoring parameters
const COMMUTE_MAX_KM = 7;       // Beyond this = very low score
const COMMUTE_IDEAL_KM = 2.5;   // Within this = max score
const LIFESTYLE_RADIUS_KM = 2.0;
const INCOME_WEIGHT = 0.15;     // How much income affects score

// ============================================================================
// Fetch Census Sections
// ============================================================================

interface CensusSection {
  PK: string;
  SK: string;
  cusec: string;
  municipalityName: string;
  centroid: { lat: number; lng: number };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  incomePerPerson?: number;
  incomePerHousehold?: number;
}

async function fetchBarcelonaCensusSections(): Promise<CensusSection[]> {
  console.log('📥 Fetching Barcelona census sections from DynamoDB...');
  
  const sections: CensusSection[] = [];
  let lastKey: Record<string, unknown> | undefined;
  let scanned = 0;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'municipalityName = :bcn',
      ExpressionAttributeValues: { ':bcn': 'Barcelona' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.geometry && item.centroid) {
        sections.push(item as CensusSection);
      }
    }
    
    scanned += result.ScannedCount || 0;
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    
    process.stdout.write(`\r   Scanned ${scanned} / ~36k items, found ${sections.length} Barcelona sections...`);
  } while (lastKey);
  
  console.log(`\n   ✓ Found ${sections.length} census sections with geometry`);
  return sections;
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate commute score (0-10) based on distance to anchors
 * Uses weighted average if multiple anchors
 */
function calculateCommuteScore(centroid: { lat: number; lng: number }): number {
  const point = turf.point([centroid.lng, centroid.lat]);
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const anchor of Object.values(ANCHORS)) {
    const anchorPoint = turf.point([anchor.lng, anchor.lat]);
    const distance = turf.distance(point, anchorPoint, { units: 'kilometers' });
    
    let score: number;
    if (distance <= COMMUTE_IDEAL_KM) {
      score = 10;
    } else if (distance >= COMMUTE_MAX_KM) {
      score = 0;
    } else {
      // Smooth curve between ideal and max
      const t = (distance - COMMUTE_IDEAL_KM) / (COMMUTE_MAX_KM - COMMUTE_IDEAL_KM);
      score = 10 * Math.pow(1 - t, 1.5); // Exponential falloff
    }
    
    weightedSum += score * anchor.weight;
    totalWeight += anchor.weight;
  }
  
  return weightedSum / totalWeight;
}

/**
 * Calculate lifestyle score (0-10) based on proximity to hotspots
 */
function calculateLifestyleScore(centroid: { lat: number; lng: number }): number {
  const point = turf.point([centroid.lng, centroid.lat]);
  
  let totalInfluence = 0;
  
  for (const hotspot of LIFESTYLE_HOTSPOTS) {
    const hotspotPoint = turf.point([hotspot.lng, hotspot.lat]);
    const distance = turf.distance(point, hotspotPoint, { units: 'kilometers' });
    
    if (distance < LIFESTYLE_RADIUS_KM) {
      // Gaussian-like falloff
      const sigma = LIFESTYLE_RADIUS_KM * 0.5;
      const influence = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(sigma, 2)));
      totalInfluence += influence * hotspot.weight;
    }
  }
  
  // Normalize to 0-10 (assuming max ~2 overlapping hotspots)
  return Math.min(10, totalInfluence * 5);
}

/**
 * Calculate income score (0-10) - higher income = higher score for this demo
 */
function calculateIncomeScore(income: number | undefined): number {
  if (!income) return 5; // Default to middle
  
  // Barcelona income range roughly €8k-25k per person
  const minIncome = 8000;
  const maxIncome = 25000;
  
  if (income <= minIncome) return 2;
  if (income >= maxIncome) return 10;
  
  return 2 + 8 * ((income - minIncome) / (maxIncome - minIncome));
}

/**
 * Calculate combined fit score (0-10)
 */
function calculateFitScore(section: CensusSection): {
  fitScore: number;
  commuteScore: number;
  lifestyleScore: number;
  incomeScore: number;
} {
  const commuteScore = calculateCommuteScore(section.centroid);
  const lifestyleScore = calculateLifestyleScore(section.centroid);
  const incomeScore = calculateIncomeScore(section.incomePerPerson);
  
  // Weighted combination
  const commuteWeight = 0.50;
  const lifestyleWeight = 0.35;
  const incomeWeightActual = INCOME_WEIGHT;
  
  const fitScore = 
    (commuteScore * commuteWeight) + 
    (lifestyleScore * lifestyleWeight) + 
    (incomeScore * incomeWeightActual);
  
  return { 
    fitScore: Math.min(10, fitScore), 
    commuteScore, 
    lifestyleScore, 
    incomeScore 
  };
}

// ============================================================================
// Generate Heatmap GeoJSON
// ============================================================================

async function generateHeatmap() {
  // 1. Fetch real census sections
  const sections = await fetchBarcelonaCensusSections();
  
  if (sections.length === 0) {
    console.error('❌ No census sections found!');
    return;
  }
  
  // 2. Calculate scores for each section
  console.log('\n📊 Calculating fit scores for each census section...');
  
  const features: GeoJSON.Feature[] = [];
  const scoreStats = { min: 10, max: 0, sum: 0 };
  
  for (const section of sections) {
    const { fitScore, commuteScore, lifestyleScore, incomeScore } = calculateFitScore(section);
    
    // Track stats
    scoreStats.min = Math.min(scoreStats.min, fitScore);
    scoreStats.max = Math.max(scoreStats.max, fitScore);
    scoreStats.sum += fitScore;
    
    // Create GeoJSON feature
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {
        id: section.cusec,
        fitScore: Math.round(fitScore * 100) / 100,
        commuteScore: Math.round(commuteScore * 10) / 10,
        lifestyleScore: Math.round(lifestyleScore * 10) / 10,
        incomeScore: Math.round(incomeScore * 10) / 10,
        income: section.incomePerPerson,
      },
      geometry: section.geometry as GeoJSON.Polygon,
    };
    
    features.push(feature);
  }
  
  console.log(`   ✓ Processed ${features.length} sections`);
  console.log(`   Score range: ${scoreStats.min.toFixed(2)} - ${scoreStats.max.toFixed(2)}`);
  console.log(`   Average: ${(scoreStats.sum / features.length).toFixed(2)}`);
  
  // 3. Create output structure
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      city: 'Barcelona',
      sectionCount: features.length,
      source: 'INE Census Sections + Income Data',
      anchors: ANCHORS,
      lifestyleHotspots: LIFESTYLE_HOTSPOTS.map(h => h.name),
      weights: {
        commute: 0.50,
        lifestyle: 0.35,
        income: INCOME_WEIGHT,
      },
      scoreRange: {
        min: Math.round(scoreStats.min * 100) / 100,
        max: Math.round(scoreStats.max * 100) / 100,
        avg: Math.round((scoreStats.sum / features.length) * 100) / 100,
      },
    },
    geojson: {
      type: 'FeatureCollection' as const,
      features,
    },
  };
  
  // 4. Write output
  const outputDir = path.join(process.cwd(), 'public', 'heatmap-demo');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'barcelona-census-heatmap.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✅ Heatmap generated!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Size: ${fileSizeMB} MB`);
  console.log(`   Features: ${features.length}`);
  
  // 5. Show score distribution
  const buckets = [0, 0, 0, 0, 0]; // 0-2, 2-4, 4-6, 6-8, 8-10
  for (const f of features) {
    const score = f.properties?.fitScore || 0;
    const bucket = Math.min(4, Math.floor(score / 2));
    buckets[bucket]++;
  }
  
  console.log('\n📊 Score Distribution:');
  console.log(`   0-2 (blue):    ${buckets[0]} sections`);
  console.log(`   2-4 (blue):    ${buckets[1]} sections`);
  console.log(`   4-6 (yellow):  ${buckets[2]} sections`);
  console.log(`   6-8 (orange):  ${buckets[3]} sections`);
  console.log(`   8-10 (red):    ${buckets[4]} sections`);
  
  return output;
}

// ============================================================================
// Main
// ============================================================================

generateHeatmap().catch(console.error);
