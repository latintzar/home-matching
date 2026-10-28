#!/usr/bin/env npx tsx
/**
 * Extract tennis courts directly from GeoJSON
 * (sport attribute wasn't saved to DynamoDB)
 */

import * as fs from 'fs';
import * as path from 'path';

// Wider Barcelona metro area
const BARCELONA_BBOX = {
  minLng: 2.00,
  maxLng: 2.30,
  minLat: 41.28,
  maxLat: 41.50,
};

const isInBarcelona = (lat: number, lng: number): boolean => {
  return lat >= BARCELONA_BBOX.minLat && lat <= BARCELONA_BBOX.maxLat &&
         lng >= BARCELONA_BBOX.minLng && lng <= BARCELONA_BBOX.maxLng;
};

function getCentroid(geometry: any): { lat: number; lng: number } | null {
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates;
    return { lat, lng };
  }
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0];
    let sumLng = 0, sumLat = 0;
    for (const [lng, lat] of coords) {
      sumLng += lng;
      sumLat += lat;
    }
    return { lat: sumLat / coords.length, lng: sumLng / coords.length };
  }
  return null;
}

async function main() {
  const filePath = path.join(process.cwd(), 'data/geo/osm-extracts/sports_pitches.geojson');
  
  console.log('🎾 Loading sports_pitches.geojson...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  console.log(`   Total features: ${data.features.length}`);
  
  // Filter for tennis courts in Barcelona
  const tennisCourts: { lng: number; lat: number; name: string }[] = [];
  
  for (const feature of data.features) {
    if (feature.properties?.sport !== 'tennis') continue;
    
    const centroid = getCentroid(feature.geometry);
    if (!centroid) continue;
    
    if (!isInBarcelona(centroid.lat, centroid.lng)) continue;
    
    tennisCourts.push({
      lng: Math.round(centroid.lng * 100000) / 100000,
      lat: Math.round(centroid.lat * 100000) / 100000,
      name: feature.properties.name || 'Tennis Court',
    });
    
    if (tennisCourts.length >= 25) break;
  }
  
  console.log(`\n✅ Found ${tennisCourts.length} tennis courts in Barcelona\n`);
  console.log(JSON.stringify(tennisCourts, null, 2));
}

main().catch(console.error);
