import { latLngToCell, cellToLatLng, gridDisk, cellToBoundary } from 'h3-js';

// SAFEGUARD: Lowered resolution back to 8 to prevent accidental high-volume usage.
// Resolution 11 was the cause of the massive API costs (tens of thousands of hexes).
// Resolution 8 is standard (~0.7km2).
const H3_RESOLUTION = 8;

export function generateHexGrid(centerLat: number, centerLng: number, radiusKm: number): string[] {
  // Convert center to H3 index
  const centerHex = latLngToCell(centerLat, centerLng, H3_RESOLUTION);
  
  // Estimate K-ring size (number of rings) based on radius
  // Edge length of Res 8 is ~0.46km.
  // Distance between center of two adjacent hexes is ~0.8km.
  // So k = radius / 0.8
  const k = Math.ceil(radiusKm / 0.8);
  
  return gridDisk(centerHex, k);
}

export function getHexCenter(hexId: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(hexId);
  return { lat, lng };
}

export function getHexBoundary(hexId: string): { lat: number; lng: number }[] {
  const boundary = cellToBoundary(hexId);
  return boundary.map(([lat, lng]) => ({ lat, lng }));
}
