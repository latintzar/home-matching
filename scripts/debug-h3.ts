import { latLngToCell, cellToBoundary } from 'h3-js';

// Test H3 coordinate order
const lat = 40.4168;
const lng = -3.7038;
const res = 9;

const hex = latLngToCell(lat, lng, res);
console.log(`Hex for ${lat}, ${lng}: ${hex}`);

const boundary = cellToBoundary(hex);
console.log('Boundary first point:', boundary[0]);

// Check if it looks like [lat, lng] or [lng, lat]
// Madrid lat is ~40, lng is ~-3.
const p1 = boundary[0];
if (Math.abs(p1[0] - 40) < 1 && Math.abs(p1[1] - (-3)) < 1) {
    console.log('Order is [LAT, LNG] ✅');
} else if (Math.abs(p1[1] - 40) < 1 && Math.abs(p1[0] - (-3)) < 1) {
    console.log('Order is [LNG, LAT] ❌ (Need to swap for Google Maps)');
} else {
    console.log('Order is weird:', p1);
}

