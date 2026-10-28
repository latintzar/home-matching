/**
 * Generate HTML results page for OMSRIA and F0 outputs
 * Queries database and creates a side-by-side comparison page
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateResultsPage(listingId: string) {
  console.log(`📊 Generating OMSRIA & F0 results page for listing ${listingId}\n`);

  const listingIdStr = listingId.toString();
  
  // Load validation logs if they exist
  const validationLogPath = `f0-validation-logs-${listingIdStr}.json`;
  let validationLogs: Record<string, any> = {};
  if (existsSync(validationLogPath)) {
    try {
      validationLogs = JSON.parse(readFileSync(validationLogPath, 'utf-8'));
      console.log(`✅ Loaded validation logs for ${Object.keys(validationLogs).length} rooms`);
    } catch (err) {
      console.log(`⚠️  Could not load validation logs: ${err}`);
    }
  }

  // Fetch OMSRIA results
  const { data: omsriaImages, error: omsriaError } = await supabase
    .from('omsria_processed_images')
    .select('room_id, image_url, image_type, visible_spaces')
    .eq('listing_id', listingIdStr)
    .eq('is_redundant', false)
    .order('room_id');

  if (omsriaError) {
    console.error(`❌ Error fetching OMSRIA images:`, omsriaError.message);
    return;
  }

  // Fetch F0 results
  const { data: f0Images, error: f0Error } = await supabase
    .from('listing_photos_furniture_free')
    .select('omsria_room_id, furniture_free_url, omsria_image_url')
    .eq('listing_id', listingIdStr)
    .not('omsria_room_id', 'is', null)
    .order('omsria_room_id');

  if (f0Error) {
    console.error(`❌ Error fetching F0 images:`, f0Error.message);
    return;
  }

  // Fetch room names from clusters
  const { data: clusters } = await supabase
    .from('manual_photo_clusters')
    .select('id, room_name')
    .eq('listing_id', listingIdStr);

  const roomNameMap = new Map<string, string>();
  clusters?.forEach(cluster => {
    roomNameMap.set(cluster.id, cluster.room_name || cluster.id);
  });

  // Create a map of F0 images by room_id
  const f0Map = new Map<string, string>();
  f0Images?.forEach(img => {
    if (img.omsria_room_id) {
      f0Map.set(img.omsria_room_id, img.furniture_free_url);
    }
  });

  // Fetch interim retry images from storage
  const interimMap = new Map<string, Array<{ attempt: number; url: string; isFinal?: boolean }>>(); // room_id -> array of retry image objects
  if (f0Images && f0Images.length > 0) {
    const { data: storageFiles } = await supabase.storage
      .from('property-images')
      .list(`${listingIdStr}/furniture-free/`, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (storageFiles) {
      // Group retry images by room_id
      storageFiles.forEach(file => {
        const retryMatch = file.name.match(/^(.+)_retry_(\d+)\.jpg$/);
        const finalMatch = file.name.match(/^(.+)_retry_final\.jpg$/);
        
        if (retryMatch) {
          const roomId = retryMatch[1];
          const attempt = parseInt(retryMatch[2], 10);
          const { data: urlData } = supabase.storage
            .from('property-images')
            .getPublicUrl(`${listingIdStr}/furniture-free/${file.name}`);
          
          if (!interimMap.has(roomId)) {
            interimMap.set(roomId, []);
          }
          const retries = interimMap.get(roomId)!;
          // Store as object with attempt number to preserve order and handle gaps
          retries.push({ attempt, url: urlData.publicUrl, isFinal: false });
        } else if (finalMatch) {
          const roomId = finalMatch[1];
          const { data: urlData } = supabase.storage
            .from('property-images')
            .getPublicUrl(`${listingIdStr}/furniture-free/${file.name}`);
          
          if (!interimMap.has(roomId)) {
            interimMap.set(roomId, []);
          }
          const retries = interimMap.get(roomId)!;
          // Store final architectural correction result
          retries.push({ attempt: 999, url: urlData.publicUrl, isFinal: true });
        }
      });
      
      // Sort by attempt number for each room (final comes last)
      interimMap.forEach((retries, roomId) => {
        retries.sort((a, b) => a.attempt - b.attempt);
      });
    }
  }

  console.log(`✅ Found ${omsriaImages?.length || 0} OMSRIA images`);
  console.log(`✅ Found ${f0Images?.length || 0} F0 images\n`);

  // Generate HTML
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OMSRIA & F0 Results</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1600px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
        }
        .room-section {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .room-section h2 {
            margin-top: 0;
            color: #555;
            font-size: 18px;
        }
        .room-section .meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 15px;
        }
        .room-section .meta .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            margin-right: 8px;
        }
        .badge.SINGLE_SPACE {
            background: #d4edda;
            color: #155724;
        }
        .badge.DEAD_END {
            background: #f8d7da;
            color: #721c24;
        }
        .images-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .image-box {
            text-align: center;
        }
        .image-box h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .image-box img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            cursor: pointer;
        }
        .image-box img:hover {
            opacity: 0.9;
        }
        .image-box a {
            display: block;
            margin-top: 10px;
            color: #0066cc;
            text-decoration: none;
            font-size: 12px;
        }
        .image-box a:hover {
            text-decoration: underline;
        }
        .interim-retries {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .interim-retries h4 {
            margin: 0 0 15px 0;
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .interim-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
        }
        .interim-item {
            text-align: center;
        }
        .interim-item img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            cursor: pointer;
        }
        .interim-item img:hover {
            opacity: 0.9;
        }
        .interim-item .label {
            font-size: 11px;
            color: #888;
            margin-top: 5px;
        }
        .validation-logs {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .validation-logs h4 {
            margin: 0 0 15px 0;
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .validation-entries {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .validation-entry {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 12px;
            font-size: 12px;
        }
        .validation-entry strong {
            color: #495057;
            display: block;
            margin-bottom: 8px;
        }
        .validation-entry details {
            margin-top: 8px;
        }
        .validation-entry details summary {
            cursor: pointer;
            color: #0066cc;
            font-size: 11px;
            margin-bottom: 5px;
        }
        .validation-entry details pre {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 3px;
            padding: 8px;
            font-size: 10px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 200px;
            overflow-y: auto;
        }
        .missing-note {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 15px;
            font-size: 13px;
            color: #856404;
        }
        .stats {
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .stats strong {
            color: #0066cc;
        }
    </style>
</head>
<body>
    <h1>OMSRIA & F0 Results</h1>
    <div class="subtitle">Complete Pipeline Results - OMSRIA (Space Isolation) → F0 (Furniture Removal)</div>
    
    <div class="stats">
        <strong>Statistics:</strong><br>
        OMSRIA Images: ${omsriaImages?.length || 0}<br>
        F0 Images: ${f0Images?.length || 0}<br>
        Complete Pairs: ${omsriaImages?.filter(img => f0Map.has(img.room_id)).length || 0}
    </div>
`;

  // Generate sections for each OMSRIA image
  if (omsriaImages && omsriaImages.length > 0) {
    for (const omsriaImg of omsriaImages) {
      const roomName = roomNameMap.get(omsriaImg.room_id) || omsriaImg.room_id;
      const imageType = omsriaImg.image_type || 'UNKNOWN';
      const f0Url = f0Map.get(omsriaImg.room_id);
      const visibleSpaces = omsriaImg.visible_spaces ? (typeof omsriaImg.visible_spaces === 'string' ? JSON.parse(omsriaImg.visible_spaces) : omsriaImg.visible_spaces) : [];
      const roomValidationLogs = validationLogs[omsriaImg.room_id] || [];

      html += `
    <div class="room-section">
        <h2>${omsriaImg.room_id} - ${roomName}</h2>
        <div class="meta">
            <span class="badge ${imageType}">${imageType}</span>
            ${visibleSpaces.length > 0 ? `Visible Spaces: ${visibleSpaces.join(', ')}` : ''}
        </div>
`;

      if (f0Url) {
        html += `
        <div class="images-grid">
            <div class="image-box">
                <h3>After OMSRIA (Space Isolated)</h3>
                <img src="${omsriaImg.image_url}" alt="OMSRIA: ${roomName}" onclick="window.open('${omsriaImg.image_url}', '_blank')">
                <a href="${omsriaImg.image_url}" target="_blank">View Full Size</a>
            </div>
            <div class="image-box">
                <h3>After F0 (Furniture Removed)</h3>
                <img src="${f0Url}" alt="F0: ${roomName}" onclick="window.open('${f0Url}', '_blank')">
                <a href="${f0Url}" target="_blank">View Full Size</a>
            </div>
        </div>
`;

        // Add validation logs if available
        if (roomValidationLogs.length > 0) {
          html += `
        <div class="validation-logs">
            <h4>Validation Logs (${roomValidationLogs.length} attempt(s))</h4>
            <div class="validation-entries">
`;
          roomValidationLogs.forEach((log: any) => {
            const statusIcon = log.passed ? '✅' : '❌';
            html += `
                <div class="validation-entry">
                    <strong>${statusIcon} Attempt ${log.attempt}</strong>
                    <div>Has Items: ${log.hasItems ? 'Yes' : 'No'} | Passed: ${log.passed ? 'Yes' : 'No'} | Reason: ${log.reason}</div>
`;
            if (log.rawResponse && log.rawResponse !== 'NO_RESPONSE') {
              const truncatedResponse = log.rawResponse.length > 500 ? log.rawResponse.substring(0, 500) + '...' : log.rawResponse;
              html += `
                    <details>
                        <summary>Raw Validation Response</summary>
                        <pre>${truncatedResponse.replace(/`/g, '\\`')}</pre>
                    </details>
`;
            }
            if (log.filteredDirective) {
              const truncatedDirective = log.filteredDirective.length > 500 ? log.filteredDirective.substring(0, 500) + '...' : log.filteredDirective;
              html += `
                    <details>
                        <summary>Filtered Directive (after removing permanent fixtures)</summary>
                        <pre>${truncatedDirective.replace(/`/g, '\\`')}</pre>
                    </details>
`;
            }
            html += `
                </div>
`;
          });
          html += `
            </div>
        </div>
`;
        }
        
        // Add interim retry images if available
        const interimRetries = interimMap.get(omsriaImg.room_id);
        if (interimRetries && interimRetries.length > 0) {
          html += `
        <div class="interim-retries">
            <h4>Interim Retry Images (${interimRetries.length} attempts)</h4>
            <div class="interim-grid">
`;
          interimRetries.forEach((retry) => {
            const label = retry.isFinal ? 'After Architectural Correction' : `Attempt ${retry.attempt}`;
            html += `
                <div class="interim-item">
                    <img src="${retry.url}" alt="${label}" onclick="window.open('${retry.url}', '_blank')">
                    <div class="label">${label}</div>
                </div>
`;
          });
          html += `
            </div>
        </div>
`;
        }
      } else {
        html += `
        <div class="missing-note">
            ⚠️ OMSRIA image available, but F0 (furniture removal) not yet processed for this room.
        </div>
        <div class="images-grid">
            <div class="image-box">
                <h3>After OMSRIA (Space Isolated)</h3>
                <img src="${omsriaImg.image_url}" alt="OMSRIA: ${roomName}" onclick="window.open('${omsriaImg.image_url}', '_blank')">
                <a href="${omsriaImg.image_url}" target="_blank">View Full Size</a>
            </div>
            <div class="image-box">
                <h3>After F0 (Furniture Removed)</h3>
                <p style="color: #999; font-style: italic;">Pending...</p>
            </div>
        </div>
`;
      }

      html += `
    </div>
`;
    }
  } else {
    html += `
    <div class="room-section">
        <p style="color: #999;">No OMSRIA images found. Run R1.5 (OMSRIA) first.</p>
    </div>
`;
  }

  html += `
</body>
</html>`;

  // Write to file
  const outputPath = 'omsria-f0-results.html';
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`✅ Generated results page: ${outputPath}`);
  
  if (Object.keys(validationLogs).length > 0) {
    console.log(`\n💡 Tip: Run 'npx tsx scripts/generate-f0-diagnostics.ts ${listingIdStr}' to generate a detailed MD diagnostic report.`);
  }
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  generateResultsPage(listingId)
    .then(() => {
      console.log('\n✨ Done! Open omsria-f0-results.html in your browser to view results.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/generate-omsria-f0-results.ts <listing_id>');
  process.exit(1);
}

