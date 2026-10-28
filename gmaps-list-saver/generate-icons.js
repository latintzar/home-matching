// Run this script with: node generate-icons.js
// Requires: npm install canvas (optional, will create placeholders if not available)

const fs = require('fs');
const path = require('path');

// Simple PNG generator - creates colored squares as placeholder icons
// For production, replace with proper icon files

const sizes = [16, 48, 128];

// Create a minimal valid PNG (1x1 blue pixel)
const createMinimalPNG = (size) => {
  // This creates a minimal valid PNG file
  // In a real app, you'd use canvas or proper PNG library
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk (image header)
  const width = size;
  const height = size;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT chunk (image data) - simple blue gradient
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Create a gradient from blue to green
      const t = (x + y) / (width + height);
      const r = Math.floor(66 + t * 0);   // 66 (Google blue)
      const g = Math.floor(133 + t * 35); // 133 -> 168 (Google green)
      const b = Math.floor(244 - t * 161); // 244 -> 83
      rawData.push(r, g, b);
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk (image end)
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
};

const createChunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  
  const typeBuffer = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
};

// CRC32 calculation
const crc32 = (buf) => {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();
  
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  
  return crc ^ 0xFFFFFFFF;
};

const makeCRCTable = () => {
  const table = new Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[i] = c;
  }
  
  return table;
};

// Generate icons
const iconsDir = path.join(__dirname, 'icons');

sizes.forEach(size => {
  const filename = `icon${size}.png`;
  const filepath = path.join(iconsDir, filename);
  
  try {
    const png = createMinimalPNG(size);
    fs.writeFileSync(filepath, png);
    console.log(`Created ${filename}`);
  } catch (error) {
    console.error(`Error creating ${filename}:`, error.message);
  }
});

console.log('\nIcons generated! You can replace these with proper icons later.');
