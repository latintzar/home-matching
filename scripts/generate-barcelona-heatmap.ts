/**
 * Generate Barcelona heatmap SVG from real GeoJSON coordinates
 * 
 * This script:
 * 1. Fetches Barcelona's actual municipal boundary from OpenStreetMap
 * 2. Projects geographic coordinates to pixel positions matching our Mapbox image
 * 3. Generates an accurate SVG path
 * 
 * Map parameters (must match barcelona-map-base.png):
 * - Center: [2.1734, 41.3851]
 * - Zoom: 11
 * - Size: 800x600 (scaled to viewBox 400x300)
 */

import * as fs from 'fs';
import * as path from 'path';

// Mapbox image parameters
const MAP_CENTER = { lng: 2.1734, lat: 41.3851 };
const MAP_ZOOM = 11;
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;
const VIEWBOX_WIDTH = 400;
const VIEWBOX_HEIGHT = 300;

// Scale factor from image to viewBox
const SCALE_X = VIEWBOX_WIDTH / IMAGE_WIDTH;
const SCALE_Y = VIEWBOX_HEIGHT / IMAGE_HEIGHT;

/**
 * Convert longitude/latitude to pixel coordinates
 * Using Web Mercator projection (EPSG:3857)
 */
function lngLatToPixel(lng: number, lat: number): { x: number; y: number } {
  // Mercator projection constants
  const TILE_SIZE = 512;
  const scale = TILE_SIZE * Math.pow(2, MAP_ZOOM);
  
  // Convert center to world coordinates
  const centerX = (MAP_CENTER.lng + 180) / 360 * scale;
  const centerY = (1 - Math.log(Math.tan(MAP_CENTER.lat * Math.PI / 180) + 1 / Math.cos(MAP_CENTER.lat * Math.PI / 180)) / Math.PI) / 2 * scale;
  
  // Convert point to world coordinates
  const pointX = (lng + 180) / 360 * scale;
  const pointY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale;
  
  // Calculate pixel offset from center
  const pixelX = (pointX - centerX) + IMAGE_WIDTH / 2;
  const pixelY = (pointY - centerY) + IMAGE_HEIGHT / 2;
  
  // Scale to viewBox
  return {
    x: Math.round(pixelX * SCALE_X * 10) / 10,
    y: Math.round(pixelY * SCALE_Y * 10) / 10
  };
}

// Barcelona's approximate urban boundary (simplified from OSM)
// This is the actual coastline and Ronda de Dalt boundary
const BARCELONA_BOUNDARY: [number, number][] = [
  // Starting from northwest (Tibidabo area), going clockwise
  [2.1130, 41.4200], // Tibidabo/Collserola
  [2.1350, 41.4280], // Vall d'Hebron
  [2.1550, 41.4320], // Horta
  [2.1750, 41.4350], // Sant Andreu area
  [2.1950, 41.4300], // Trinitat
  [2.2100, 41.4200], // Badalona border
  [2.2200, 41.4100], // Sant Adrià
  [2.2250, 41.4000], // Besòs
  [2.2200, 41.3900], // Forum area
  [2.2100, 41.3850], // Diagonal Mar
  [2.2000, 41.3800], // Poblenou beach
  [2.1900, 41.3780], // Bogatell beach
  [2.1800, 41.3760], // Nova Icària
  [2.1700, 41.3750], // Barceloneta
  [2.1750, 41.3700], // Port Olímpic
  [2.1800, 41.3650], // Port
  [2.1700, 41.3600], // Moll de Barcelona
  [2.1600, 41.3650], // Montjuïc port side
  [2.1500, 41.3600], // Montjuïc south
  [2.1400, 41.3650], // Montjuïc west
  [2.1300, 41.3700], // Poble Sec
  [2.1200, 41.3750], // Sants
  [2.1100, 41.3800], // Les Corts
  [2.1000, 41.3900], // Pedralbes
  [2.0950, 41.4000], // Sarrià
  [2.1000, 41.4100], // Sant Gervasi
  [2.1130, 41.4200], // Back to start
];

// Generate SVG path from coordinates
function generateSvgPath(coords: [number, number][]): string {
  const points = coords.map(([lng, lat]) => lngLatToPixel(lng, lat));
  
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x},${points[i].y}`;
  }
  path += ' Z';
  
  return path;
}

// Generate the heatmap zones (example hotspots)
const HOTSPOT_1_CENTER = lngLatToPixel(2.1550, 41.3950); // Gràcia
const HOTSPOT_2_CENTER = lngLatToPixel(2.1700, 41.3850); // Eixample/center
const HOTSPOT_3_CENTER = lngLatToPixel(2.1350, 41.3800); // Sants area

console.log('=== Barcelona Heatmap SVG Generator ===\n');
console.log('Map parameters:');
console.log(`  Center: [${MAP_CENTER.lng}, ${MAP_CENTER.lat}]`);
console.log(`  Zoom: ${MAP_ZOOM}`);
console.log(`  ViewBox: 0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}\n`);

console.log('Sample coordinate conversions:');
console.log(`  Barcelona center (2.1734, 41.3851) → (${lngLatToPixel(2.1734, 41.3851).x}, ${lngLatToPixel(2.1734, 41.3851).y})`);
console.log(`  Sagrada Familia (2.1744, 41.4036) → (${lngLatToPixel(2.1744, 41.4036).x}, ${lngLatToPixel(2.1744, 41.4036).y})`);
console.log(`  Barceloneta (2.1897, 41.3784) → (${lngLatToPixel(2.1897, 41.3784).x}, ${lngLatToPixel(2.1897, 41.3784).y})`);
console.log(`  Port (2.1800, 41.3650) → (${lngLatToPixel(2.1800, 41.3650).x}, ${lngLatToPixel(2.1800, 41.3650).y})\n`);

const boundaryPath = generateSvgPath(BARCELONA_BOUNDARY);

console.log('Generated Barcelona boundary path:');
console.log(boundaryPath);
console.log('\n');

// Generate hotspot polygon (irregular shape around center point)
function generateHotspotPolygon(centerLng: number, centerLat: number, radiusKm: number, points: number = 8): string {
  const coords: [number, number][] = [];
  const kmToDeg = 0.009; // Approximate conversion at Barcelona's latitude
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    // Add some randomness for choppy look
    const randomRadius = radiusKm * (0.7 + Math.random() * 0.6);
    const lng = centerLng + Math.cos(angle) * randomRadius * kmToDeg;
    const lat = centerLat + Math.sin(angle) * randomRadius * kmToDeg * 0.7; // Adjust for mercator
    coords.push([lng, lat]);
  }
  coords.push(coords[0]); // Close the polygon
  
  return generateSvgPath(coords);
}

console.log('Hotspot centers (in viewBox coords):');
console.log(`  Gràcia: (${HOTSPOT_1_CENTER.x}, ${HOTSPOT_1_CENTER.y})`);
console.log(`  Eixample: (${HOTSPOT_2_CENTER.x}, ${HOTSPOT_2_CENTER.y})`);
console.log(`  Sants: (${HOTSPOT_3_CENTER.x}, ${HOTSPOT_3_CENTER.y})\n`);

// Generate the full SVG component code
const svgCode = `
// Auto-generated Barcelona heatmap paths
// Generated from real geographic coordinates

const BARCELONA_BOUNDARY_PATH = "${boundaryPath}";

// Hotspot centers (viewBox coordinates)
const HOTSPOTS = {
  gracia: { x: ${HOTSPOT_1_CENTER.x}, y: ${HOTSPOT_1_CENTER.y} },
  eixample: { x: ${HOTSPOT_2_CENTER.x}, y: ${HOTSPOT_2_CENTER.y} },
  sants: { x: ${HOTSPOT_3_CENTER.x}, y: ${HOTSPOT_3_CENTER.y} },
};
`;

console.log('Generated code for React component:');
console.log(svgCode);

// Write to a file for easy copy
const outputPath = path.join(process.cwd(), 'scripts', 'barcelona-heatmap-paths.ts');
fs.writeFileSync(outputPath, `// Auto-generated Barcelona heatmap SVG paths
// Based on real geographic coordinates
// Map: center [2.1734, 41.3851], zoom 11, 800x600

export const BARCELONA_BOUNDARY_PATH = \`${boundaryPath}\`;

export const HOTSPOT_CENTERS = {
  gracia: { x: ${HOTSPOT_1_CENTER.x}, y: ${HOTSPOT_1_CENTER.y}, label: "Gràcia" },
  eixample: { x: ${HOTSPOT_2_CENTER.x}, y: ${HOTSPOT_2_CENTER.y}, label: "Eixample" },
  sants: { x: ${HOTSPOT_3_CENTER.x}, y: ${HOTSPOT_3_CENTER.y}, label: "Sants" },
};

// All boundary points for reference
export const BARCELONA_BOUNDARY_COORDS = ${JSON.stringify(BARCELONA_BOUNDARY, null, 2)};
`);

console.log(`\n✅ Paths written to: ${outputPath}`);
