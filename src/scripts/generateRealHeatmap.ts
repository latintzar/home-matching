#!/usr/bin/env npx tsx
/**
 * Generate Real Heatmap from DynamoDB Neighborhood Boundaries
 * 
 * Fetches actual Barcelona neighborhood polygons and calculates
 * fit scores for each, creating a smooth heatmap visualization.
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && \
 *   export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
 *   npx tsx src/scripts/generateRealHeatmap.ts
 * 
 * Output:
 *   public/heatmap-demo/barcelona-real-heatmap.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// DynamoDB Setup
// ============================================================================

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'leo-neighborhood-boundaries';

// ============================================================================
// Configuration - Mock User Preferences
// ============================================================================

// Work and partner locations (commute anchors)
const ANCHORS = {
  work: { lng: 2.1686, lat: 41.3874, name: 'Work (Diagonal)', maxMinutes: 30 },
  partner: { lng: 2.1899, lat: 41.4036, name: 'Partner (Horta)', maxMinutes: 25 },
};

// Lifestyle hotspots with weights
const LIFESTYLE_HOTSPOTS = [
  { lng: 2.1543, lat: 41.4025, weight: 1.0, name: 'Gràcia', category: 'trendy' },
  { lng: 2.1734, lat: 41.3874, weight: 0.9, name: 'Eixample', category: 'central' },
  { lng: 2.1830, lat: 41.3850, weight: 0.8, name: 'Sagrada Familia', category: 'tourist' },
  { lng: 2.1950, lat: 41.4000, weight: 0.85, name: 'Poblenou', category: 'tech' },
  { lng: 2.1200, lat: 41.3750, weight: 0.6, name: 'Sants', category: 'transport' },
  { lng: 2.1800, lat: 41.3780, weight: 0.7, name: 'Born', category: 'nightlife' },
  { lng: 2.1700, lat: 41.3800, weight: 0.75, name: 'Gothic', category: 'historic' },
];

// Scoring parameters
const COMMUTE_MAX_KM = 8;      // Beyond this = score 0
const COMMUTE_GOOD_KM = 3;    // Within this = full score
const LIFESTYLE_RADIUS_KM = 2.5;

// ============================================================================
// Fetch Neighborhoods from DynamoDB
// ============================================================================

interface NeighborhoodBoundary {
  city: string;
  neighborhood_id: string;
  name: string;
  geojson: GeoJSON.Feature;
  centroid: { lat: number; lng: number };
  properties?: Record<string, unknown>;
}

async function fetchBarcelonaNeighborhoods(): Promise<NeighborhoodBoundary[]> {
  console.log('📥 Fetching Barcelona neighborhoods from DynamoDB...');
  
  const neighborhoods: NeighborhoodBoundary[] = [];
  let lastKey: Record<string, unknown> | undefined;
  
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'city = :city',
      ExpressionAttributeValues: { ':city': 'barcelona' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      neighborhoods.push(item as NeighborhoodBoundary);
    }
    
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  
  console.log(`   Found ${neighborhoods.length} neighborhoods`);
  return neighborhoods;
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate commute score (0-10) based on distance to anchors
 */
function calculateCommuteScore(centroid: { lat: number; lng: number }): number {
  const point = turf.point([centroid.lng, centroid.lat]);
  
  // Calculate distance to each anchor
  const distances = Object.values(ANCHORS).map(anchor => {
    const anchorPoint = turf.point([anchor.lng, anchor.lat]);
    return turf.distance(point, anchorPoint, { units: 'kilometers' });
  });
  
  // Use the WORST (longest) commute
  const worstDistance = Math.max(...distances);
  
  // Score: 10 at 0km, 0 at COMMUTE_MAX_KM
  if (worstDistance >= COMMUTE_MAX_KM) return 0;
  if (worstDistance <= COMMUTE_GOOD_KM) return 10;
  
  // Linear interpolation between GOOD and MAX
  const range = COMMUTE_MAX_KM - COMMUTE_GOOD_KM;
  const excess = worstDistance - COMMUTE_GOOD_KM;
  return 10 * (1 - excess / range);
}

/**
 * Calculate lifestyle score (0-10) based on proximity to hotspots
 */
function calculateLifestyleScore(centroid: { lat: number; lng: number }): number {
  const point = turf.point([centroid.lng, centroid.lat]);
  
  let totalInfluence = 0;
  let maxPossible = 0;
  
  for (const hotspot of LIFESTYLE_HOTSPOTS) {
    const hotspotPoint = turf.point([hotspot.lng, hotspot.lat]);
    const distance = turf.distance(point, hotspotPoint, { units: 'kilometers' });
    
    maxPossible += hotspot.weight;
    
    if (distance < LIFESTYLE_RADIUS_KM) {
      // Gaussian falloff
      const influence = Math.exp(-Math.pow(distance / (LIFESTYLE_RADIUS_KM * 0.6), 2));
      totalInfluence += influence * hotspot.weight;
    }
  }
  
  // Normalize to 0-10
  return (totalInfluence / maxPossible) * 10;
}

/**
 * Calculate combined fit score (0-10)
 */
function calculateFitScore(centroid: { lat: number; lng: number }): {
  fitScore: number;
  commuteScore: number;
  lifestyleScore: number;
} {
  const commuteScore = calculateCommuteScore(centroid);
  const lifestyleScore = calculateLifestyleScore(centroid);
  
  // Weighted combination: 55% commute, 45% lifestyle
  const fitScore = (commuteScore * 0.55) + (lifestyleScore * 0.45);
  
  return { fitScore, commuteScore, lifestyleScore };
}

// ============================================================================
// Generate Heatmap GeoJSON
// ============================================================================

async function generateHeatmap() {
  // 1. Fetch real neighborhoods
  const neighborhoods = await fetchBarcelonaNeighborhoods();
  
  if (neighborhoods.length === 0) {
    console.error('❌ No neighborhoods found!');
    return;
  }
  
  // 2. Calculate scores for each neighborhood
  console.log('\n📊 Calculating fit scores...');
  
  const features: GeoJSON.Feature[] = [];
  const scoreStats = { min: 10, max: 0, sum: 0 };
  
  for (const hood of neighborhoods) {
    // Skip if no geometry
    if (!hood.geojson?.geometry) {
      console.warn(`   ⚠️ Skipping ${hood.name} - no geometry`);
      continue;
    }
    
    // Calculate centroid if not provided
    let centroid = hood.centroid;
    if (!centroid || !centroid.lat || !centroid.lng) {
      try {
        const c = turf.centroid(hood.geojson);
        centroid = { lng: c.geometry.coordinates[0], lat: c.geometry.coordinates[1] };
      } catch {
        console.warn(`   ⚠️ Skipping ${hood.name} - invalid geometry`);
        continue;
      }
    }
    
    // Calculate scores
    const { fitScore, commuteScore, lifestyleScore } = calculateFitScore(centroid);
    
    // Track stats
    scoreStats.min = Math.min(scoreStats.min, fitScore);
    scoreStats.max = Math.max(scoreStats.max, fitScore);
    scoreStats.sum += fitScore;
    
    // Create feature with score properties
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {
        id: hood.neighborhood_id,
        name: hood.name,
        fitScore: Math.round(fitScore * 10) / 10,
        commuteScore: Math.round(commuteScore * 10) / 10,
        lifestyleScore: Math.round(lifestyleScore * 10) / 10,
        centroid,
      },
      geometry: hood.geojson.geometry,
    };
    
    features.push(feature);
  }
  
  console.log(`   Processed ${features.length} neighborhoods`);
  console.log(`   Score range: ${scoreStats.min.toFixed(1)} - ${scoreStats.max.toFixed(1)}`);
  console.log(`   Average: ${(scoreStats.sum / features.length).toFixed(1)}`);
  
  // 3. Sort by score (lowest first so higher scores render on top)
  features.sort((a, b) => (a.properties?.fitScore || 0) - (b.properties?.fitScore || 0));
  
  // 4. Create output
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      city: 'Barcelona',
      neighborhoodCount: features.length,
      anchors: ANCHORS,
      lifestyleHotspots: LIFESTYLE_HOTSPOTS.map(h => ({ name: h.name, category: h.category })),
      scoreWeights: { commute: 0.55, lifestyle: 0.45 },
      scoreRange: {
        min: Math.round(scoreStats.min * 10) / 10,
        max: Math.round(scoreStats.max * 10) / 10,
        avg: Math.round((scoreStats.sum / features.length) * 10) / 10,
      },
    },
    geojson: {
      type: 'FeatureCollection' as const,
      features,
    },
    // Top neighborhoods by score
    topNeighborhoods: features
      .slice(-10)
      .reverse()
      .map(f => ({
        name: f.properties?.name,
        fitScore: f.properties?.fitScore,
        commuteScore: f.properties?.commuteScore,
        lifestyleScore: f.properties?.lifestyleScore,
      })),
  };
  
  // 5. Write output
  const outputDir = path.join(process.cwd(), 'public', 'heatmap-demo');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'barcelona-real-heatmap.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Heatmap generated!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Features: ${features.length}`);
  
  // 6. Show top neighborhoods
  console.log('\n🏆 Top 10 Neighborhoods:');
  for (const hood of output.topNeighborhoods) {
    console.log(`   ${hood.fitScore?.toFixed(1)} - ${hood.name} (commute: ${hood.commuteScore}, lifestyle: ${hood.lifestyleScore})`);
  }
  
  return output;
}

// ============================================================================
// Main
// ============================================================================

generateHeatmap().catch(console.error);
