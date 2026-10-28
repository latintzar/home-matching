/**
 * generateHeatmapPNG.ts
 * 
 * Converts H3 hex GeoJSON heatmap to a PNG raster image.
 * This allows efficient display of the heatmap without loading massive JSON files.
 * 
 * Output: Transparent PNG overlay that can be positioned on a map
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

// Image configuration - parse from args or use defaults
const args = process.argv.slice(2);
const resArg = args.find(a => a.startsWith('--res='));
const resolution = resArg ? parseInt(resArg.split('=')[1]) : 4096;

const IMAGE_WIDTH = resolution;   // Default 4096 for high-res
const IMAGE_HEIGHT = resolution;

// Barcelona bounding box (should match the heatmap data)
const BBOX = {
  minLng: 2.02,
  maxLng: 2.23,
  minLat: 41.32,
  maxLat: 41.47,
};

// Color scale: WARM ONLY (no blue to avoid clashing with water layer)
// Pale cream (0) → Soft yellow (3) → Warm orange (6) → Coral red (10)
const getColor = (score: number): { r: number; g: number; b: number; a: number } => {
  const t = Math.min(1, Math.max(0, score / 10));
  
  // Warm palette that complements cool map layers:
  // Pale cream:    #FEF3C7 → rgb(254, 243, 199) - barely visible base
  // Soft yellow:   #FCD34D → rgb(252, 211, 77)  - medium scores
  // Warm orange:   #FB923C → rgb(251, 146, 60)  - good scores
  // Coral red:     #F87171 → rgb(248, 113, 113) - hot spots
  
  if (t < 0.3) {
    // Pale cream (0) to Soft yellow (3)
    const tt = t / 0.3;
    return {
      r: Math.round(254 + (252 - 254) * tt),  // 254 → 252
      g: Math.round(243 + (211 - 243) * tt),  // 243 → 211
      b: Math.round(199 + (77 - 199) * tt),   // 199 → 77
      a: Math.round(80 + (180 - 80) * tt),    // Very transparent → visible
    };
  } else if (t < 0.6) {
    // Soft yellow (3) to Warm orange (6)
    const tt = (t - 0.3) / 0.3;
    return {
      r: Math.round(252 + (251 - 252) * tt),  // 252 → 251
      g: Math.round(211 + (146 - 211) * tt),  // 211 → 146
      b: Math.round(77 + (60 - 77) * tt),     // 77 → 60
      a: Math.round(180 + (210 - 180) * tt),  // More visible
    };
  } else {
    // Warm orange (6) to Coral red (10)
    const tt = (t - 0.6) / 0.4;
    return {
      r: Math.round(251 + (248 - 251) * tt),  // 251 → 248
      g: Math.round(146 + (113 - 146) * tt),  // 146 → 113
      b: Math.round(60 + (113 - 60) * tt),    // 60 → 113
      a: Math.round(210 + (240 - 210) * tt),  // Most visible for hotspots
    };
  }
};

// Convert lat/lng to pixel coordinates
const lngToX = (lng: number): number => {
  return ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * IMAGE_WIDTH;
};

const latToY = (lat: number): number => {
  // Y is inverted (top = 0)
  return IMAGE_HEIGHT - ((lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * IMAGE_HEIGHT;
};

// Main function
const generateHeatmapPNG = async () => {
  const inputFile = process.argv[2] || 'public/heatmap-demo/barcelona-h3-heatmap-v2.json';
  const outputFile = process.argv[3] || 'public/heatmap-demo/barcelona-heatmap.png';
  
  console.log(`📊 Loading heatmap from: ${inputFile}`);
  
  // Check file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const fileSize = fs.statSync(inputFile).size;
  console.log(`📦 File size: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
  
  // Load GeoJSON
  console.log('⏳ Parsing GeoJSON (this may take a moment for large files)...');
  const startParse = Date.now();
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  console.log(`✅ Parsed in ${((Date.now() - startParse) / 1000).toFixed(1)}s`);
  
  // Handle both formats: direct FeatureCollection or nested under .geojson
  const geojson = data.geojson || data;
  const features = geojson.features || [];
  
  // Get source metadata if available
  const sourceMetadata = data.metadata || {};
  if (sourceMetadata.scoreRange) {
    console.log(`📈 Score range: ${sourceMetadata.scoreRange.min} - ${sourceMetadata.scoreRange.max} (avg: ${sourceMetadata.scoreRange.avg?.toFixed(2)})`);
  }
  console.log(`📍 Found ${features.length.toLocaleString()} hexes`);
  
  if (features.length === 0) {
    console.error('❌ No features found in GeoJSON');
    process.exit(1);
  }
  
  // Create SVG for the heatmap
  console.log('🎨 Generating SVG...');
  const startSvg = Date.now();
  
  let svgPaths = '';
  let processedCount = 0;
  
  // For very large datasets, skip lowest scores (they're just faint blue background)
  const skipLowScores = features.length > 100000;
  const minScoreThreshold = skipLowScores ? 0.5 : 0;
  let skippedCount = 0;
  
  for (const feature of features) {
    const score = feature.properties?.fitScore || 0;
    
    // Skip very low scores for large datasets (optimization)
    if (score < minScoreThreshold) {
      skippedCount++;
      continue;
    }
    
    const color = getColor(score);
    
    // Get polygon coordinates
    const coords = feature.geometry?.coordinates?.[0];
    if (!coords || coords.length < 3) continue;
    
    // Convert to pixel coordinates
    const points = coords.map((coord: number[]) => {
      const x = lngToX(coord[0]);
      const y = latToY(coord[1]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    
    // Add SVG polygon
    svgPaths += `<polygon points="${points}" fill="rgba(${color.r},${color.g},${color.b},${color.a / 255})" />\n`;
    
    processedCount++;
    if (processedCount % 100000 === 0) {
      console.log(`  Processed ${processedCount.toLocaleString()} hexes...`);
    }
  }
  
  if (skippedCount > 0) {
    console.log(`  Skipped ${skippedCount.toLocaleString()} low-score hexes (< ${minScoreThreshold})`);
  }
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">
  <rect width="100%" height="100%" fill="transparent"/>
  ${svgPaths}
</svg>`;
  
  console.log(`✅ SVG generated in ${((Date.now() - startSvg) / 1000).toFixed(1)}s`);
  
  // Save intermediate SVG (for debugging)
  const svgFile = outputFile.replace('.png', '.svg');
  fs.writeFileSync(svgFile, svg);
  console.log(`💾 Saved SVG: ${svgFile} (${(fs.statSync(svgFile).size / 1024 / 1024).toFixed(1)}MB)`);
  
  // Convert SVG to PNG using Sharp
  console.log('🖼️ Converting to PNG...');
  const startPng = Date.now();
  
  await sharp(Buffer.from(svg))
    .png({
      compressionLevel: 9,
    })
    .toFile(outputFile);
  
  const pngSize = fs.statSync(outputFile).size;
  console.log(`✅ PNG generated in ${((Date.now() - startPng) / 1000).toFixed(1)}s`);
  console.log(`💾 Saved PNG: ${outputFile} (${(pngSize / 1024 / 1024).toFixed(1)}MB)`);
  
  // Output metadata for map overlay
  const metadata = {
    bounds: [
      [BBOX.minLng, BBOX.minLat],  // SW corner
      [BBOX.maxLng, BBOX.maxLat],  // NE corner
    ],
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    hexCount: features.length,
    generatedAt: new Date().toISOString(),
  };
  
  const metadataFile = outputFile.replace('.png', '-metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  console.log(`📋 Saved metadata: ${metadataFile}`);
  
  console.log('\n✨ Done! Use this to overlay on Mapbox:');
  console.log(`   Image: ${outputFile}`);
  console.log(`   Bounds: [[${BBOX.minLng}, ${BBOX.minLat}], [${BBOX.maxLng}, ${BBOX.maxLat}]]`);
  
  // Offer to delete large JSON
  console.log('\n🗑️ To save space, you can delete the large JSON file:');
  console.log(`   rm ${inputFile}`);
};

// Run
generateHeatmapPNG().catch(console.error);
