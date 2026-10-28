#!/usr/bin/env npx tsx
// OpenStreetMap-derived geometry: © OpenStreetMap contributors; ODbL 1.0.
// https://www.openstreetmap.org/copyright · https://opendatacommons.org/licenses/odbl/1-0/
// Application code remains MIT. See docs/data-licenses.md.
/**
 * Generate Pre-Calculated Heatmap Demo for Barcelona
 * 
 * Creates smooth contour polygons using Turf.js isobands for the
 * comparison page demo. Outputs GeoJSON files for:
 * - Barcelona city boundary (clipped to coast)
 * - Yellow commute zone (reachable area)
 * - Red lifestyle hotspots
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && npx tsx src/scripts/generateHeatmapDemo.ts
 * 
 * Output:
 *   public/heatmap-demo/barcelona-heatmap.json
 */

import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

// Barcelona bounding box and center
const BARCELONA_BOUNDS = {
  west: 2.05,
  south: 41.32,
  east: 2.23,
  north: 41.47,
};

const BARCELONA_CENTER = { lng: 2.1734, lat: 41.3851 };

// Mock user preferences for demo
const MOCK_ANCHORS = {
  work: { lng: 2.1686, lat: 41.3874, name: 'Work (Diagonal)' },        // Diagonal area
  partner: { lng: 2.1899, lat: 41.4036, name: 'Partner (Horta)' },     // Horta area
};

// Lifestyle hotspots (places with high POI density in Barcelona)
const LIFESTYLE_HOTSPOTS = [
  { lng: 2.1543, lat: 41.4025, weight: 1.0, name: 'Gràcia' },          // Gràcia - trendy, cafes
  { lng: 2.1734, lat: 41.3874, weight: 0.9, name: 'Eixample' },        // Eixample - central
  { lng: 2.1830, lat: 41.3850, weight: 0.85, name: 'Sagrada Familia' }, // Tourist + local
  { lng: 2.1950, lat: 41.3890, weight: 0.7, name: 'Sant Martí' },      // Poblenou tech
  { lng: 2.1200, lat: 41.3750, weight: 0.6, name: 'Sants' },           // Transport hub
];

// Scoring thresholds (in km)
const COMMUTE_MAX_KM = 8;        // Beyond this = blue (far)
const COMMUTE_GOOD_KM = 4;       // Within this = yellow (commutable)
const LIFESTYLE_RADIUS_KM = 2;   // Radius of influence for lifestyle spots

// Grid resolution for smooth contours
const GRID_CELL_SIZE_KM = 0.15;  // 150m cells for smooth appearance

// ============================================================================
// Barcelona City Boundary (Simplified from OSM)
// ============================================================================

// Simplified Barcelona municipality boundary including coast
const BARCELONA_BOUNDARY: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  properties: { name: 'Barcelona' },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      // Start from northwest, go clockwise
      [2.0528, 41.4617], // NW - Collserola
      [2.0693, 41.4685],
      [2.095, 41.47],
      [2.12, 41.468],
      [2.145, 41.465],
      [2.17, 41.46],     // N - Nou Barris
      [2.19, 41.455],
      [2.205, 41.445],
      [2.22, 41.43],     // NE - Sant Andreu
      [2.228, 41.405],
      [2.23, 41.385],    // E - Sant Martí
      [2.225, 41.365],
      [2.215, 41.35],    // SE - Diagonal Mar
      [2.19, 41.375],    // Coast - Barceloneta
      [2.17, 41.372],
      [2.16, 41.37],     // Port
      [2.145, 41.365],
      [2.12, 41.358],    // SW - Zona Franca
      [2.10, 41.355],
      [2.08, 41.36],
      [2.06, 41.38],     // W - Montjuïc
      [2.05, 41.41],
      [2.048, 41.44],
      [2.0528, 41.4617], // Close polygon
    ]],
  },
};

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate commute score (0-1, higher = closer to anchors)
 */
function calculateCommuteScore(lng: number, lat: number): number {
  const point = turf.point([lng, lat]);
  
  // Distance to each anchor
  const distances = Object.values(MOCK_ANCHORS).map(anchor => {
    const anchorPoint = turf.point([anchor.lng, anchor.lat]);
    return turf.distance(point, anchorPoint, { units: 'kilometers' });
  });
  
  // Use the WORST (longest) commute
  const worstDistance = Math.max(...distances);
  
  // Score: 1.0 at 0km, 0.0 at COMMUTE_MAX_KM
  if (worstDistance >= COMMUTE_MAX_KM) return 0;
  if (worstDistance <= 0.5) return 1.0;  // Very close
  
  // Smooth falloff curve
  const normalized = worstDistance / COMMUTE_MAX_KM;
  return Math.pow(1 - normalized, 1.5);  // Exponential falloff
}

/**
 * Calculate lifestyle score (0-1, higher = near hotspots)
 */
function calculateLifestyleScore(lng: number, lat: number): number {
  const point = turf.point([lng, lat]);
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const hotspot of LIFESTYLE_HOTSPOTS) {
    const hotspotPoint = turf.point([hotspot.lng, hotspot.lat]);
    const distance = turf.distance(point, hotspotPoint, { units: 'kilometers' });
    
    if (distance < LIFESTYLE_RADIUS_KM) {
      // Gaussian-like falloff from hotspot center
      const influence = Math.exp(-Math.pow(distance / (LIFESTYLE_RADIUS_KM * 0.5), 2));
      totalScore += influence * hotspot.weight;
      totalWeight += hotspot.weight;
    }
  }
  
  if (totalWeight === 0) return 0;
  return Math.min(1, totalScore / totalWeight);
}

/**
 * Calculate combined score (0-10)
 */
function calculateCombinedScore(lng: number, lat: number): number {
  const commuteScore = calculateCommuteScore(lng, lat);
  const lifestyleScore = calculateLifestyleScore(lng, lat);
  
  // Combine: 60% commute, 40% lifestyle (commute is usually more important)
  const combined = (commuteScore * 0.6) + (lifestyleScore * 0.4);
  
  return combined * 10;  // Scale to 0-10
}

// ============================================================================
// Grid Generation
// ============================================================================

/**
 * Generate a dense point grid covering Barcelona
 */
function generateScoreGrid(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const bbox = turf.bbox(BARCELONA_BOUNDARY);
  const cellSize = GRID_CELL_SIZE_KM;
  
  // Create point grid
  const grid = turf.pointGrid(bbox, cellSize, { units: 'kilometers' });
  
  // Filter to only points inside Barcelona and add scores
  const pointsInside: GeoJSON.Feature<GeoJSON.Point>[] = [];
  
  for (const point of grid.features) {
    const [lng, lat] = point.geometry.coordinates;
    
    // Check if inside Barcelona boundary
    if (turf.booleanPointInPolygon(point, BARCELONA_BOUNDARY)) {
      const score = calculateCombinedScore(lng, lat);
      point.properties = { score };
      pointsInside.push(point);
    }
  }
  
  console.log(`Generated ${pointsInside.length} scored points inside Barcelona`);
  
  return turf.featureCollection(pointsInside);
}

// ============================================================================
// Isoband Generation (Smooth Contours)
// ============================================================================

/**
 * Generate smooth contour bands using Turf isobands
 */
function generateIsobands(grid: GeoJSON.FeatureCollection<GeoJSON.Point>): {
  blue: GeoJSON.FeatureCollection;
  yellow: GeoJSON.FeatureCollection;
  red: GeoJSON.FeatureCollection;
} {
  // Extract coordinates and scores for interpolation
  const points: [number, number, number][] = grid.features.map(f => [
    f.geometry.coordinates[0],
    f.geometry.coordinates[1],
    f.properties?.score || 0,
  ]);
  
  // Score thresholds for color bands:
  // - 0-3: Blue (far, low score)
  // - 3-6: Yellow (commutable, medium score)  
  // - 6-10: Red (hot spots, high score)
  
  const breaks = [0, 3, 6, 10];
  
  console.log('Generating isobands...');
  
  // Use Turf's isobands which creates smooth polygons
  const isobands = turf.isobands(grid, breaks, { zProperty: 'score' });
  
  // Separate by score range
  const blue: GeoJSON.Feature[] = [];
  const yellow: GeoJSON.Feature[] = [];
  const red: GeoJSON.Feature[] = [];
  
  for (const feature of isobands.features) {
    const minScore = feature.properties?.score_min ?? feature.properties?.['score-min'] ?? 0;
    
    if (minScore < 3) {
      blue.push(feature);
    } else if (minScore < 6) {
      yellow.push(feature);
    } else {
      red.push(feature);
    }
  }
  
  console.log(`  Blue bands: ${blue.length}`);
  console.log(`  Yellow bands: ${yellow.length}`);
  console.log(`  Red bands: ${red.length}`);
  
  return {
    blue: turf.featureCollection(blue),
    yellow: turf.featureCollection(yellow),
    red: turf.featureCollection(red),
  };
}

// ============================================================================
// Alternative: Interpolated Raster Grid to Smooth Polygons
// ============================================================================

/**
 * Create smooth zones using buffer/union approach
 * (More reliable than isobands for sparse data)
 */
function generateSmoothZones(grid: GeoJSON.FeatureCollection<GeoJSON.Point>): {
  blue: GeoJSON.Feature | null;
  yellow: GeoJSON.Feature | null;
  red: GeoJSON.Feature | null;
} {
  console.log('Generating smooth zones via buffer/union...');
  
  // Group points by score range
  const bluePoints: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const yellowPoints: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const redPoints: GeoJSON.Feature<GeoJSON.Point>[] = [];
  
  for (const point of grid.features) {
    const score = point.properties?.score || 0;
    if (score >= 6) {
      redPoints.push(point);
    } else if (score >= 3) {
      yellowPoints.push(point);
    } else {
      bluePoints.push(point);
    }
  }
  
  console.log(`  Points: ${redPoints.length} red, ${yellowPoints.length} yellow, ${bluePoints.length} blue`);
  
  // Buffer and union points to create smooth polygons
  const bufferRadius = GRID_CELL_SIZE_KM * 1.2;  // Slight overlap for smoothness
  
  const createZone = (points: GeoJSON.Feature<GeoJSON.Point>[]): GeoJSON.Feature | null => {
    if (points.length === 0) return null;
    
    // Buffer each point
    const buffers = points.map(p => turf.buffer(p, bufferRadius, { units: 'kilometers' }));
    
    // Union all buffers
    let merged = buffers[0];
    for (let i = 1; i < buffers.length; i++) {
      try {
        const result = turf.union(turf.featureCollection([merged!, buffers[i]!]));
        if (result) merged = result;
      } catch (e) {
        // Skip failed unions
      }
    }
    
    return merged || null;
  };
  
  // Clip all zones to Barcelona boundary
  const clipToBoundary = (zone: GeoJSON.Feature | null): GeoJSON.Feature | null => {
    if (!zone) return null;
    try {
      return turf.intersect(turf.featureCollection([zone, BARCELONA_BOUNDARY]));
    } catch (e) {
      return zone;
    }
  };
  
  // Red is smallest (hotspots)
  const redZone = clipToBoundary(createZone(redPoints));
  
  // Yellow includes red points too (commutable area)
  const yellowZone = clipToBoundary(createZone([...yellowPoints, ...redPoints]));
  
  // Blue is the Barcelona boundary minus yellow
  let blueZone = BARCELONA_BOUNDARY as GeoJSON.Feature;
  
  return {
    blue: blueZone,
    yellow: yellowZone,
    red: redZone,
  };
}

// ============================================================================
// Main Generation
// ============================================================================

async function main() {
  console.log('🗺️  Barcelona Heatmap Demo Generator');
  console.log('═'.repeat(50));
  console.log();
  
  // 1. Generate score grid
  console.log('Step 1: Generating scored point grid...');
  const grid = generateScoreGrid();
  
  // 2. Generate smooth zones
  console.log('\nStep 2: Creating smooth contour zones...');
  const zones = generateSmoothZones(grid);
  
  // 3. Add style properties
  if (zones.blue) {
    zones.blue.properties = { 
      zone: 'blue', 
      label: 'Far', 
      fill: '#3b82f6',
      fillOpacity: 0.4,
    };
  }
  if (zones.yellow) {
    zones.yellow.properties = { 
      zone: 'yellow', 
      label: 'Commutable', 
      fill: '#eab308',
      fillOpacity: 0.5,
    };
  }
  if (zones.red) {
    zones.red.properties = { 
      zone: 'red', 
      label: 'Hot Spots', 
      fill: '#ef4444',
      fillOpacity: 0.6,
    };
  }
  
  // 4. Create output GeoJSON
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      city: 'Barcelona',
      anchors: MOCK_ANCHORS,
      lifestyleHotspots: LIFESTYLE_HOTSPOTS.map(h => h.name),
      gridCellSizeKm: GRID_CELL_SIZE_KM,
      pointCount: grid.features.length,
    },
    boundary: BARCELONA_BOUNDARY,
    zones: {
      blue: zones.blue,
      yellow: zones.yellow,
      red: zones.red,
    },
    // Include grid for debugging/alternative rendering
    grid: {
      type: 'FeatureCollection',
      features: grid.features.slice(0, 100),  // Just a sample
    },
  };
  
  // 5. Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'public', 'heatmap-demo');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`\nCreated directory: ${outputDir}`);
  }
  
  // 6. Write output file
  const outputPath = path.join(outputDir, 'barcelona-heatmap.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log('\n✅ Generation complete!');
  console.log(`   Output: ${outputPath}`);
  console.log(`   Points: ${grid.features.length}`);
  console.log(`   Zones: ${[zones.red ? 'red' : '', zones.yellow ? 'yellow' : '', zones.blue ? 'blue' : ''].filter(Boolean).join(', ')}`);
  
  // 7. Also generate simplified SVG paths for static fallback
  console.log('\nGenerating SVG paths for static fallback...');
  await generateSvgPaths(zones, outputDir);
}

/**
 * Generate SVG path strings for static rendering fallback
 */
async function generateSvgPaths(
  zones: { blue: GeoJSON.Feature | null; yellow: GeoJSON.Feature | null; red: GeoJSON.Feature | null },
  outputDir: string
) {
  // Map projection: lng/lat to SVG coordinates
  // viewBox: 0 0 400 300 (matching existing page)
  const mapCenter = BARCELONA_CENTER;
  const scale = 2000;  // pixels per degree
  
  const projectToSvg = (lng: number, lat: number): [number, number] => {
    const x = 200 + (lng - mapCenter.lng) * scale;
    const y = 150 - (lat - mapCenter.lat) * scale;  // Y is inverted
    return [x, y];
  };
  
  const polygonToPath = (feature: GeoJSON.Feature | null): string => {
    if (!feature) return '';
    
    const geom = feature.geometry;
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return '';
    
    const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    
    let path = '';
    for (const polygon of rings) {
      for (const ring of polygon) {
        if (ring.length < 3) continue;
        
        const projected = ring.map(coord => projectToSvg(coord[0], coord[1]));
        path += `M ${projected[0][0].toFixed(1)},${projected[0][1].toFixed(1)} `;
        
        for (let i = 1; i < projected.length; i++) {
          path += `L ${projected[i][0].toFixed(1)},${projected[i][1].toFixed(1)} `;
        }
        path += 'Z ';
      }
    }
    
    return path.trim();
  };
  
  const svgPaths = {
    boundary: polygonToPath(BARCELONA_BOUNDARY),
    blue: polygonToPath(zones.blue),
    yellow: polygonToPath(zones.yellow),
    red: polygonToPath(zones.red),
  };
  
  // Write TypeScript file with paths
  const tsContent = `// Auto-generated Barcelona heatmap paths
// Generated: ${new Date().toISOString()}
// For use in static SVG rendering fallback

export const BARCELONA_DEMO_PATHS = {
  boundary: \`${svgPaths.boundary}\`,
  blue: \`${svgPaths.blue}\`,
  yellow: \`${svgPaths.yellow}\`,
  red: \`${svgPaths.red}\`,
};

export const DEMO_ANCHORS = ${JSON.stringify(MOCK_ANCHORS, null, 2)};

export const DEMO_HOTSPOTS = ${JSON.stringify(LIFESTYLE_HOTSPOTS.map(h => ({ name: h.name, lng: h.lng, lat: h.lat })), null, 2)};
`;

  const tsPath = path.join(process.cwd(), 'src', 'lib', 'geo', 'barcelona-demo-paths.ts');
  fs.writeFileSync(tsPath, tsContent);
  console.log(`   SVG paths: ${tsPath}`);
}

main().catch(console.error);
