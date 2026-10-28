#!/usr/bin/env node
/**
 * Optimize landing page images
 * 
 * Converts large PNG files to optimized WebP while maintaining quality
 * - Resizes to max 1920px width (web-friendly)
 * - Converts to WebP format (much smaller file size)
 * - Maintains high quality (90%)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const LANDING_DIR = path.join(process.cwd(), 'public', 'images', 'landing');
const MAX_WIDTH = 1920;
const QUALITY = 85; // Good balance of quality and size

async function optimizeImage(inputPath) {
  const filename = path.basename(inputPath, '.png');
  const outputPath = path.join(LANDING_DIR, `${filename}.webp`);
  
  try {
    const inputStats = fs.statSync(inputPath);
    const inputSizeMB = (inputStats.size / 1024 / 1024).toFixed(2);
    
    console.log(`📸 Processing: ${filename}.png (${inputSizeMB}MB)`);
    
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    
    // Resize if wider than MAX_WIDTH
    let pipeline = sharp(inputPath);
    if (metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }
    
    // Convert to WebP with high quality
    await pipeline
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(outputPath);
    
    const outputStats = fs.statSync(outputPath);
    const outputSizeKB = (outputStats.size / 1024).toFixed(0);
    const outputSizeMB = (outputStats.size / 1024 / 1024).toFixed(2);
    const reduction = (100 - (outputStats.size / inputStats.size * 100)).toFixed(1);
    
    console.log(`   ✅ → ${filename}.webp (${outputSizeKB}KB) - ${reduction}% smaller`);
    
    return {
      filename,
      inputSize: inputStats.size,
      outputSize: outputStats.size,
      reduction: parseFloat(reduction)
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🖼️  Optimizing landing page images...\n');
  console.log(`   Settings: max ${MAX_WIDTH}px width, ${QUALITY}% quality WebP\n`);
  
  // Get all PNG files
  const files = fs.readdirSync(LANDING_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(LANDING_DIR, f));
  
  if (files.length === 0) {
    console.log('No PNG files found in', LANDING_DIR);
    return;
  }
  
  console.log(`Found ${files.length} PNG files to optimize\n`);
  
  const results = [];
  for (const file of files) {
    const result = await optimizeImage(file);
    if (result) results.push(result);
  }
  
  // Summary
  console.log('\n📊 Summary:');
  const totalInputMB = results.reduce((sum, r) => sum + r.inputSize, 0) / 1024 / 1024;
  const totalOutputMB = results.reduce((sum, r) => sum + r.outputSize, 0) / 1024 / 1024;
  const avgReduction = results.reduce((sum, r) => sum + r.reduction, 0) / results.length;
  
  console.log(`   Original:  ${totalInputMB.toFixed(1)}MB (${results.length} files)`);
  console.log(`   Optimized: ${totalOutputMB.toFixed(1)}MB`);
  console.log(`   Saved:     ${(totalInputMB - totalOutputMB).toFixed(1)}MB (${avgReduction.toFixed(1)}% reduction)`);
  
  console.log('\n✨ Done! Update your components to use .webp instead of .png');
}

main().catch(console.error);

