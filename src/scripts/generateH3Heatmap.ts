#!/usr/bin/env npx tsx
/**
 * Generate H3 Hex-Based Heatmap for Barcelona
 * 
 * Creates a coordinate-based heatmap using H3 hexagonal grid.
 * Uses CENSUS SECTIONS boundary for accurate city limits.
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && \
 *   export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
 *   npx tsx src/scripts/generateH3Heatmap.ts
 * 
 * Output:
 *   public/heatmap-demo/barcelona-h3-heatmap.json
 */

import * as h3 from 'h3-js';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// ============================================================================
// Configuration
// ============================================================================

const H3_RESOLUTION = 11; // ~29m hexes

// Mock user preferences - TWO ANCHORS (work + partner)
const ANCHORS = {
  work: { lng: 2.1686, lat: 41.3874, name: 'Work (Diagonal)', weight: 1.0 },
  partner: { lng: 2.1899, lat: 41.4036, name: 'Partner (Horta)', weight: 0.8 },
};

// Lifestyle hotspots - COMPACT with SURPRISES
const LIFESTYLE_HOTSPOTS = [
  // Core hotspots - concentrated blobs
  { lng: 2.1543, lat: 41.4025, weight: 1.2, name: 'Gràcia', radius: 0.6 },
  { lng: 2.1734, lat: 41.3874, weight: 1.0, name: 'Eixample Center', radius: 0.5 },
  { lng: 2.1800, lat: 41.3780, weight: 1.1, name: 'Born/Gothic', radius: 0.45 },
  
  // SURPRISE hidden gems - blobby concentrated spots
  { lng: 2.1420, lat: 41.4080, weight: 1.3, name: 'Vila de Gràcia', radius: 0.35 },
  { lng: 2.1660, lat: 41.4100, weight: 0.9, name: 'Vallcarca', radius: 0.3 },
  { lng: 2.1950, lat: 41.3950, weight: 1.0, name: 'Poblenou Village', radius: 0.4 },
  { lng: 2.1480, lat: 41.3920, weight: 0.95, name: 'Sant Antoni', radius: 0.35 },
  
  // Unexpected surprises
  { lng: 2.1920, lat: 41.3820, weight: 0.8, name: 'Barceloneta', radius: 0.25 },
  { lng: 2.1350, lat: 41.3950, weight: 0.75, name: 'Les Corts hidden', radius: 0.25 },
];

// TIGHTER scoring parameters
const COMMUTE_MAX_KM = 4.5;    // Tighter falloff
const COMMUTE_IDEAL_KM = 1.5;  // Smaller perfect zone

// ============================================================================
// DynamoDB Client
// ============================================================================

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface CensusSection {
  cusec: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid: { lat: number; lng: number };
}

async function fetchBarcelonaCensusSections(): Promise<CensusSection[]> {
  console.log('📥 Fetching Barcelona census sections from DynamoDB...');
  
  const sections: CensusSection[] = [];
  let lastKey: Record<string, unknown> | undefined;
  
  do {
    const command = new ScanCommand({
      TableName: 'leo-census-sections',
      FilterExpression: 'municipalityName = :m',
      ExpressionAttributeValues: { ':m': { S: 'Barcelona' } },
      ExclusiveStartKey: lastKey as never,
    });
    
    const result = await dynamodb.send(command);
    
    if (result.Items) {
      for (const item of result.Items) {
        const data = unmarshall(item);
        if (data.geometry) {
          sections.push({
            cusec: data.cusec,
            geometry: typeof data.geometry === 'string' ? JSON.parse(data.geometry) : data.geometry,
            centroid: data.centroid,
          });
        }
      }
    }
    
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    process.stdout.write(`\r   Fetched ${sections.length} sections...`);
  } while (lastKey);
  
  console.log(`\n   ✓ Total: ${sections.length} census sections`);
  return sections;
}

function createCensusBoundary(sections: CensusSection[]): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  console.log('\n🔗 Creating unified boundary from census sections...');
  
  // Convert all sections to features
  const features: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[] = [];
  
  for (const section of sections) {
    try {
      const feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = {
        type: 'Feature',
        properties: { cusec: section.cusec },
        geometry: section.geometry,
      };
      features.push(feature);
    } catch (e) {
      // Skip invalid geometries
    }
  }
  
  console.log(`   Processing ${features.length} valid polygons...`);
  
  // Union all polygons (in batches to avoid memory issues)
  let result = features[0];
  let processed = 1;
  
  for (let i = 1; i < features.length; i++) {
    try {
      const unionResult = turf.union(
        turf.featureCollection([result, features[i]])
      );
      if (unionResult) {
        result = unionResult as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
      }
      processed++;
      
      if (processed % 100 === 0) {
        process.stdout.write(`\r   Unioned ${processed}/${features.length} sections...`);
      }
    } catch (e) {
      // Skip problematic unions
    }
  }
  
  console.log(`\n   ✓ Created unified boundary (${result.geometry?.type})`);
  return result;
}

// ============================================================================
// H3 Hex Generation
// ============================================================================

function generateBarcelonaHexes(boundary: GeoJSON.Feature): string[] {
  console.log(`\n📐 Generating H3 hexes at resolution ${H3_RESOLUTION}...`);
  
  const bbox = turf.bbox(boundary);
  console.log(`   Bbox: [${bbox.map(b => b.toFixed(4)).join(', ')}]`);
  
  const corners: [number, number][] = [
    [bbox[1], bbox[0]],
    [bbox[1], bbox[2]],
    [bbox[3], bbox[2]],
    [bbox[3], bbox[0]],
  ];
  
  const allHexes = h3.polygonToCells(corners, H3_RESOLUTION);
  console.log(`   Generated ${allHexes.length} hexes in bounding box`);
  
  const insideHexes = allHexes.filter(hex => {
    const [lat, lng] = h3.cellToLatLng(hex);
    const point = turf.point([lng, lat]);
    
    try {
      return turf.booleanPointInPolygon(point, boundary);
    } catch {
      return false;
    }
  });
  
  console.log(`   ✓ Filtered to ${insideHexes.length} hexes inside Barcelona`);
  return insideHexes;
}

// ============================================================================
// Score Calculation - TIGHTER
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
      // Steeper falloff curve
      const t = (distance - COMMUTE_IDEAL_KM) / (COMMUTE_MAX_KM - COMMUTE_IDEAL_KM);
      score = 10 * Math.pow(1 - t, 2);  // Squared for steeper falloff
    }
    
    weightedSum += score * anchor.weight;
    totalWeight += anchor.weight;
  }
  
  return weightedSum / totalWeight;
}

function calculateLifestyleScore(lat: number, lng: number): number {
  const point = turf.point([lng, lat]);
  
  let totalInfluence = 0;
  
  for (const hotspot of LIFESTYLE_HOTSPOTS) {
    const hotspotPoint = turf.point([hotspot.lng, hotspot.lat]);
    const distance = turf.distance(point, hotspotPoint, { units: 'kilometers' });
    const radius = hotspot.radius || 0.5;
    
    if (distance < radius) {
      // Gaussian falloff - creates blobby concentrated spots
      const sigma = radius * 0.5;
      const influence = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(sigma, 2)));
      totalInfluence += influence * hotspot.weight;
    }
  }
  
  // Scale to get red zones at hotspot centers
  return Math.min(10, totalInfluence * 8);
}

function calculateFitScore(lat: number, lng: number): {
  fitScore: number;
  commuteScore: number;
  lifestyleScore: number;
} {
  const commuteScore = calculateCommuteScore(lat, lng);
  const lifestyleScore = calculateLifestyleScore(lat, lng);
  
  // Base: 55% commute, 45% lifestyle
  // But boost when BOTH are high (synergy bonus for perfect spots)
  const baseScore = (commuteScore * 0.55) + (lifestyleScore * 0.45);
  
  // Synergy: if both commute AND lifestyle are good, boost the score
  const synergy = (commuteScore / 10) * (lifestyleScore / 10) * 2;
  
  const fitScore = Math.min(10, baseScore + synergy);
  
  return { fitScore, commuteScore, lifestyleScore };
}

// ============================================================================
// GeoJSON Generation
// ============================================================================

function hexToGeoJSON(hex: string, properties: Record<string, unknown>): GeoJSON.Feature {
  const boundary = h3.cellToBoundary(hex);
  const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
  coordinates.push(coordinates[0]);
  
  return {
    type: 'Feature',
    properties: { h3: hex, ...properties },
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  };
}

// ============================================================================
// Main Generation
// ============================================================================

async function generateHeatmap() {
  console.log('🗺️  H3 Hex-Based Heatmap Generator (Census Boundary)');
  console.log('═'.repeat(60));
  
  // 1. Fetch census sections and create boundary
  const sections = await fetchBarcelonaCensusSections();
  const boundary = createCensusBoundary(sections);
  
  // Save boundary for reference
  const boundaryPath = path.join(process.cwd(), 'public', 'heatmap-demo', 'barcelona-census-boundary.json');
  fs.writeFileSync(boundaryPath, JSON.stringify(boundary, null, 2));
  console.log(`   Saved boundary to: barcelona-census-boundary.json`);
  
  // 2. Generate hexes
  const hexes = generateBarcelonaHexes(boundary);
  
  // 3. Calculate scores
  console.log('\n📊 Calculating fit scores for each hex...');
  
  const features: GeoJSON.Feature[] = [];
  const scoreStats = { min: 10, max: 0, sum: 0 };
  
  for (const hex of hexes) {
    const [lat, lng] = h3.cellToLatLng(hex);
    const { fitScore, commuteScore, lifestyleScore } = calculateFitScore(lat, lng);
    
    scoreStats.min = Math.min(scoreStats.min, fitScore);
    scoreStats.max = Math.max(scoreStats.max, fitScore);
    scoreStats.sum += fitScore;
    
    const feature = hexToGeoJSON(hex, {
      fitScore: Math.round(fitScore * 100) / 100,
      commuteScore: Math.round(commuteScore * 10) / 10,
      lifestyleScore: Math.round(lifestyleScore * 10) / 10,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
    });
    
    features.push(feature);
  }
  
  console.log(`   ✓ Processed ${features.length} hexes`);
  console.log(`   Score range: ${scoreStats.min.toFixed(2)} - ${scoreStats.max.toFixed(2)}`);
  console.log(`   Average: ${(scoreStats.sum / features.length).toFixed(2)}`);
  
  // 4. Create output
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      city: 'Barcelona',
      type: 'h3-hexagons',
      boundarySource: 'Census Sections (1068 sections)',
      h3Resolution: H3_RESOLUTION,
      hexCount: features.length,
      hexEdgeMeters: Math.round(h3.getHexagonEdgeLengthAvg(H3_RESOLUTION, 'm')),
      anchors: ANCHORS,
      lifestyleHotspots: LIFESTYLE_HOTSPOTS.map(h => ({ name: h.name, radius: h.radius })),
      weights: { commute: 0.60, lifestyle: 0.40 },
      scoreRange: {
        min: Math.round(scoreStats.min * 100) / 100,
        max: Math.round(scoreStats.max * 100) / 100,
        avg: Math.round((scoreStats.sum / features.length) * 100) / 100,
      },
    },
    boundary: boundary.geometry,
    geojson: {
      type: 'FeatureCollection' as const,
      features,
    },
  };
  
  // 5. Write output
  const outputDir = path.join(process.cwd(), 'public', 'heatmap-demo');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, 'barcelona-h3-heatmap.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✅ H3 Heatmap generated with CENSUS boundary!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Size: ${fileSizeMB} MB`);
  console.log(`   Hexes: ${features.length}`);
  
  // 6. Score distribution
  const buckets = [0, 0, 0, 0, 0];
  for (const f of features) {
    const score = f.properties?.fitScore as number || 0;
    const bucket = Math.min(4, Math.floor(score / 2));
    buckets[bucket]++;
  }
  
  console.log('\n📊 Score Distribution:');
  console.log(`   0-2 (blue):    ${buckets[0]} hexes (${(buckets[0]/features.length*100).toFixed(1)}%)`);
  console.log(`   2-4 (blue):    ${buckets[1]} hexes (${(buckets[1]/features.length*100).toFixed(1)}%)`);
  console.log(`   4-6 (yellow):  ${buckets[2]} hexes (${(buckets[2]/features.length*100).toFixed(1)}%)`);
  console.log(`   6-8 (orange):  ${buckets[3]} hexes (${(buckets[3]/features.length*100).toFixed(1)}%)`);
  console.log(`   8-10 (red):    ${buckets[4]} hexes (${(buckets[4]/features.length*100).toFixed(1)}%)`);
  
  return output;
}

generateHeatmap().catch(console.error);
