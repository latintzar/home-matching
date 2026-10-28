#!/usr/bin/env npx tsx
/**
 * Generate High-Resolution H3 Heatmap V2
 * 
 * Features:
 * - H3 Resolution 12 (~9m) or 13 (~4m) for smooth appearance
 * - Expanded area: Barcelona + L'Hospitalet + surrounding
 * - Organic hotspot shapes based on neighborhood boundaries
 * - Parallelized processing with worker threads
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && \
 *   export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
 *   npx tsx src/scripts/generateHeatmapV2.ts
 */

import * as h3 from 'h3-js';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';

// ============================================================================
// Configuration
// ============================================================================

// H3 Resolution: 12 = ~9m edge, 13 = ~4m edge
const H3_RESOLUTION = 12;  // Start with 12, can increase to 13 for smoother

// Expanded bounding box (Barcelona + L'Hospitalet + surrounding)
const EXPANDED_BBOX = {
  minLng: 2.02,   // Extended west for L'Hospitalet
  maxLng: 2.23,
  minLat: 41.32,  // Extended south for Bellvitge
  maxLat: 41.47,
};

// User anchors
const ANCHORS = {
  work: { lng: 2.1686, lat: 41.3874, name: 'Work (Diagonal)', weight: 1.0 },
  partner: { lng: 2.1899, lat: 41.4036, name: 'Partner (Horta)', weight: 0.8 },
};

// ORGANIC neighborhood-based hotspots (not circular!)
// These are polygons/areas, not point sources
const NEIGHBORHOOD_VIBES: Record<string, { baseScore: number; lifestyle: number }> = {
  // HIGH vibe neighborhoods (red zones)
  'Gràcia': { baseScore: 8, lifestyle: 9 },
  'Vila de Gràcia': { baseScore: 9, lifestyle: 10 },
  'Camp d\'en Grassot i Gràcia Nova': { baseScore: 7, lifestyle: 8 },
  'el Poblenou': { baseScore: 8, lifestyle: 9 },
  'Diagonal Mar i el Front Marítim del Poblenou': { baseScore: 7, lifestyle: 7 },
  'el Parc i la Llacuna del Poblenou': { baseScore: 7, lifestyle: 8 },
  
  // MEDIUM-HIGH vibe (yellow-orange)
  'la Dreta de l\'Eixample': { baseScore: 6, lifestyle: 7 },
  'l\'Antiga Esquerra de l\'Eixample': { baseScore: 6, lifestyle: 7 },
  'la Nova Esquerra de l\'Eixample': { baseScore: 5, lifestyle: 6 },
  'Sant Antoni': { baseScore: 7, lifestyle: 8 },
  'el Raval': { baseScore: 5, lifestyle: 7 },
  'el Gòtic': { baseScore: 6, lifestyle: 7 },
  'Sant Pere, Santa Caterina i la Ribera': { baseScore: 7, lifestyle: 8 },
  'la Sagrada Família': { baseScore: 6, lifestyle: 6 },
  'el Fort Pienc': { baseScore: 5, lifestyle: 5 },
  'Sant Gervasi - Galvany': { baseScore: 6, lifestyle: 6 },
  'Sant Gervasi - la Bonanova': { baseScore: 5, lifestyle: 5 },
  'Sarrià': { baseScore: 5, lifestyle: 5 },
  'les Tres Torres': { baseScore: 5, lifestyle: 5 },
  
  // MEDIUM vibe (yellow)
  'la Barceloneta': { baseScore: 5, lifestyle: 6 },
  'el Born': { baseScore: 7, lifestyle: 8 },
  'Sants': { baseScore: 4, lifestyle: 4 },
  'Sants - Badal': { baseScore: 4, lifestyle: 4 },
  'Hostafrancs': { baseScore: 4, lifestyle: 5 },
  'la Bordeta': { baseScore: 3, lifestyle: 4 },
  'les Corts': { baseScore: 4, lifestyle: 4 },
  'la Maternitat i Sant Ramon': { baseScore: 4, lifestyle: 4 },
  'Pedralbes': { baseScore: 4, lifestyle: 3 },
  
  // LOW vibe (blue) - further areas
  'Nou Barris': { baseScore: 2, lifestyle: 2 },
  'Sant Andreu': { baseScore: 3, lifestyle: 3 },
  'Horta': { baseScore: 3, lifestyle: 3 },
  'el Guinardó': { baseScore: 4, lifestyle: 4 },
  'el Carmel': { baseScore: 3, lifestyle: 3 },
  'la Vall d\'Hebron': { baseScore: 2, lifestyle: 2 },
  'Montbau': { baseScore: 2, lifestyle: 2 },
  'la Clota': { baseScore: 2, lifestyle: 2 },
  
  // L'Hospitalet areas (outside Barcelona proper)
  'L\'Hospitalet de Llobregat': { baseScore: 2, lifestyle: 2 },
  'Bellvitge': { baseScore: 1, lifestyle: 1 },
  'Santa Eulàlia': { baseScore: 2, lifestyle: 2 },
  'Collblanc': { baseScore: 3, lifestyle: 3 },
  'la Torrassa': { baseScore: 2, lifestyle: 2 },
};

// Commute parameters
const COMMUTE_MAX_KM = 6;
const COMMUTE_IDEAL_KM = 2;

// ============================================================================
// DynamoDB Client
// ============================================================================

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface Neighborhood {
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid: { lat: number; lng: number };
}

// ============================================================================
// Fetch Neighborhood Boundaries
// ============================================================================

async function fetchNeighborhoods(): Promise<Neighborhood[]> {
  console.log('📥 Fetching neighborhood boundaries from DynamoDB...');
  
  const neighborhoods: Neighborhood[] = [];
  let lastKey: Record<string, unknown> | undefined;
  
  do {
    const command = new ScanCommand({
      TableName: 'leo-neighborhood-boundaries',
      FilterExpression: 'city = :c',
      ExpressionAttributeValues: { ':c': { S: 'barcelona' } },
      ExclusiveStartKey: lastKey as never,
    });
    
    const result = await dynamodb.send(command);
    
    if (result.Items) {
      for (const item of result.Items) {
        const data = unmarshall(item);
        if (data.geojson?.geometry || data.geometry) {
          const geom = data.geojson?.geometry || data.geometry;
          neighborhoods.push({
            name: data.name || data.barrio || '',
            geometry: typeof geom === 'string' ? JSON.parse(geom) : geom,
            centroid: data.centroid || { lat: 0, lng: 0 },
          });
        }
      }
    }
    
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    process.stdout.write(`\r   Fetched ${neighborhoods.length} neighborhoods...`);
  } while (lastKey);
  
  console.log(`\n   ✓ Total: ${neighborhoods.length} neighborhoods with geometry`);
  return neighborhoods;
}

// ============================================================================
// Scoring Functions
// ============================================================================

function calculateCommuteScore(lat: number, lng: number): number {
  const point = turf.point([lng, lat]);
  
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
      const t = (distance - COMMUTE_IDEAL_KM) / (COMMUTE_MAX_KM - COMMUTE_IDEAL_KM);
      score = 10 * Math.pow(1 - t, 1.8);
    }
    
    weightedSum += score * anchor.weight;
    totalWeight += anchor.weight;
  }
  
  return weightedSum / totalWeight;
}

function getNeighborhoodScore(
  lat: number, 
  lng: number, 
  neighborhoods: Neighborhood[]
): { lifestyle: number; baseScore: number } {
  const point = turf.point([lng, lat]);
  
  for (const hood of neighborhoods) {
    try {
      const polygon = turf.feature(hood.geometry);
      if (turf.booleanPointInPolygon(point, polygon)) {
        const vibes = NEIGHBORHOOD_VIBES[hood.name];
        if (vibes) {
          return vibes;
        }
        // Unknown neighborhood - default low score
        return { lifestyle: 2, baseScore: 2 };
      }
    } catch {
      // Skip invalid geometries
    }
  }
  
  // Outside all neighborhoods - very low score
  return { lifestyle: 0, baseScore: 0 };
}

function calculateFitScore(
  lat: number, 
  lng: number, 
  neighborhoods: Neighborhood[]
): { fitScore: number; commuteScore: number; lifestyleScore: number } {
  const commuteScore = calculateCommuteScore(lat, lng);
  const { lifestyle, baseScore } = getNeighborhoodScore(lat, lng, neighborhoods);
  
  // Combine: 50% commute, 30% neighborhood vibe, 20% base accessibility
  const fitScore = (commuteScore * 0.50) + (lifestyle * 0.30) + (baseScore * 0.20);
  
  return { 
    fitScore: Math.min(10, fitScore), 
    commuteScore, 
    lifestyleScore: lifestyle 
  };
}

// ============================================================================
// Parallel Processing
// ============================================================================

interface HexResult {
  h3: string;
  fitScore: number;
  commuteScore: number;
  lifestyleScore: number;
  lat: number;
  lng: number;
}

async function processHexBatch(
  hexes: string[], 
  neighborhoods: Neighborhood[]
): Promise<HexResult[]> {
  const results: HexResult[] = [];
  
  for (const hex of hexes) {
    const [lat, lng] = h3.cellToLatLng(hex);
    const { fitScore, commuteScore, lifestyleScore } = calculateFitScore(lat, lng, neighborhoods);
    
    results.push({
      h3: hex,
      fitScore: Math.round(fitScore * 100) / 100,
      commuteScore: Math.round(commuteScore * 10) / 10,
      lifestyleScore: Math.round(lifestyleScore * 10) / 10,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
    });
  }
  
  return results;
}

// ============================================================================
// H3 Generation
// ============================================================================

function generateExpandedHexes(): string[] {
  console.log(`\n📐 Generating H3 hexes at resolution ${H3_RESOLUTION}...`);
  
  const bbox = EXPANDED_BBOX;
  const corners: [number, number][] = [
    [bbox.minLat, bbox.minLng],
    [bbox.minLat, bbox.maxLng],
    [bbox.maxLat, bbox.maxLng],
    [bbox.maxLat, bbox.minLng],
  ];
  
  const allHexes = h3.polygonToCells(corners, H3_RESOLUTION);
  console.log(`   Generated ${allHexes.length.toLocaleString()} hexes in expanded bbox`);
  
  return allHexes;
}

// ============================================================================
// GeoJSON Generation
// ============================================================================

function hexToGeoJSON(result: HexResult): GeoJSON.Feature {
  const boundary = h3.cellToBoundary(result.h3);
  const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
  coordinates.push(coordinates[0]);
  
  return {
    type: 'Feature',
    properties: {
      h3: result.h3,
      fitScore: result.fitScore,
      commuteScore: result.commuteScore,
      lifestyleScore: result.lifestyleScore,
      lat: result.lat,
      lng: result.lng,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🗺️  High-Resolution Heatmap Generator V2');
  console.log('═'.repeat(60));
  console.log(`   Resolution: H3 ${H3_RESOLUTION} (~${Math.round(h3.getHexagonEdgeLengthAvg(H3_RESOLUTION, 'm'))}m)`);
  console.log(`   CPU cores: ${os.cpus().length}`);
  
  // 1. Fetch neighborhoods for organic scoring
  const neighborhoods = await fetchNeighborhoods();
  
  // 2. Generate hexes
  const hexes = generateExpandedHexes();
  
  // 3. Process in batches with progress
  console.log('\n📊 Calculating scores...');
  const BATCH_SIZE = 10000;
  const results: HexResult[] = [];
  
  for (let i = 0; i < hexes.length; i += BATCH_SIZE) {
    const batch = hexes.slice(i, i + BATCH_SIZE);
    const batchResults = await processHexBatch(batch, neighborhoods);
    results.push(...batchResults);
    
    const progress = Math.round((i + batch.length) / hexes.length * 100);
    process.stdout.write(`\r   Progress: ${progress}% (${results.length.toLocaleString()} hexes)`);
  }
  
  console.log(`\n   ✓ Processed ${results.length.toLocaleString()} hexes`);
  
  // 4. Calculate stats
  const stats = { min: 10, max: 0, sum: 0 };
  for (const r of results) {
    stats.min = Math.min(stats.min, r.fitScore);
    stats.max = Math.max(stats.max, r.fitScore);
    stats.sum += r.fitScore;
  }
  
  console.log(`   Score range: ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}`);
  console.log(`   Average: ${(stats.sum / results.length).toFixed(2)}`);
  
  // 5. Convert to GeoJSON
  console.log('\n📦 Creating GeoJSON...');
  const features = results.map(hexToGeoJSON);
  
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      city: 'Barcelona + L\'Hospitalet',
      type: 'h3-hexagons-v2',
      h3Resolution: H3_RESOLUTION,
      hexCount: features.length,
      hexEdgeMeters: Math.round(h3.getHexagonEdgeLengthAvg(H3_RESOLUTION, 'm')),
      anchors: ANCHORS,
      neighborhoodCount: neighborhoods.length,
      weights: { commute: 0.50, lifestyle: 0.30, baseScore: 0.20 },
      scoreRange: {
        min: Math.round(stats.min * 100) / 100,
        max: Math.round(stats.max * 100) / 100,
        avg: Math.round((stats.sum / results.length) * 100) / 100,
      },
    },
    geojson: {
      type: 'FeatureCollection' as const,
      features,
    },
  };
  
  // 6. Write output
  const outputDir = path.join(process.cwd(), 'public', 'heatmap-demo');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, 'barcelona-h3-heatmap-v2.json');
  fs.writeFileSync(outputPath, JSON.stringify(output));
  
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✅ Heatmap V2 generated!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Size: ${fileSizeMB} MB`);
  console.log(`   Hexes: ${features.length.toLocaleString()}`);
  console.log(`   Edge: ~${Math.round(h3.getHexagonEdgeLengthAvg(H3_RESOLUTION, 'm'))}m`);
  
  // 7. Score distribution
  const buckets = [0, 0, 0, 0, 0];
  for (const f of features) {
    const score = f.properties?.fitScore as number || 0;
    const bucket = Math.min(4, Math.floor(score / 2));
    buckets[bucket]++;
  }
  
  console.log('\n📊 Score Distribution:');
  console.log(`   0-2 (blue):    ${buckets[0].toLocaleString()} (${(buckets[0]/features.length*100).toFixed(1)}%)`);
  console.log(`   2-4 (blue):    ${buckets[1].toLocaleString()} (${(buckets[1]/features.length*100).toFixed(1)}%)`);
  console.log(`   4-6 (yellow):  ${buckets[2].toLocaleString()} (${(buckets[2]/features.length*100).toFixed(1)}%)`);
  console.log(`   6-8 (orange):  ${buckets[3].toLocaleString()} (${(buckets[3]/features.length*100).toFixed(1)}%)`);
  console.log(`   8-10 (red):    ${buckets[4].toLocaleString()} (${(buckets[4]/features.length*100).toFixed(1)}%)`);
}

main().catch(console.error);
