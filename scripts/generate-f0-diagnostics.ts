/**
 * Generate F0 diagnostic report with validation outputs and interim images
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function generateDiagnostics(listingId: string) {
  console.log(`📊 Generating F0 diagnostics for listing ${listingId}\n`);

  const listingIdStr = listingId.toString();
  const validationLogPath = `f0-validation-logs-${listingIdStr}.json`;

  // Load validation logs if they exist
  let validationLogs: Record<string, any> = {};
  if (existsSync(validationLogPath)) {
    try {
      validationLogs = JSON.parse(readFileSync(validationLogPath, 'utf-8'));
      console.log(`✅ Loaded validation logs for ${Object.keys(validationLogs).length} rooms`);
    } catch (err) {
      console.log(`⚠️  Could not load validation logs: ${err}`);
    }
  } else {
    console.log(`⚠️  Validation logs file not found: ${validationLogPath}`);
  }

  // Fetch OMSRIA images
  const { data: omsriaImages } = await supabase
    .from('omsria_processed_images')
    .select('room_id, image_url, image_type')
    .eq('listing_id', listingIdStr)
    .eq('is_redundant', false)
    .order('room_id');

  // Fetch F0 images
  const { data: f0Images } = await supabase
    .from('listing_photos_furniture_free')
    .select('omsria_room_id, furniture_free_url')
    .eq('listing_id', listingIdStr)
    .not('omsria_room_id', 'is', null)
    .order('omsria_room_id');

  // Fetch room names
  const { data: clusters } = await supabase
    .from('manual_photo_clusters')
    .select('id, room_name')
    .eq('listing_id', listingIdStr);

  const roomNameMap = new Map<string, string>();
  clusters?.forEach(cluster => {
    roomNameMap.set(cluster.id, cluster.room_name || cluster.id);
  });

  // Fetch interim images
  const { data: storageFiles } = await supabase.storage
    .from('property-images')
    .list(`${listingIdStr}/furniture-free/`, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  const interimMap = new Map<string, Array<{ attempt: number; url: string; isFinal?: boolean }>>();
  if (storageFiles) {
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
        interimMap.get(roomId)!.push({ attempt, url: urlData.publicUrl, isFinal: false });
      } else if (finalMatch) {
        const roomId = finalMatch[1];
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(`${listingIdStr}/furniture-free/${file.name}`);
        
        if (!interimMap.has(roomId)) {
          interimMap.set(roomId, []);
        }
        interimMap.get(roomId)!.push({ attempt: 999, url: urlData.publicUrl, isFinal: true });
      }
    });
    
    interimMap.forEach((retries) => {
      retries.sort((a, b) => a.attempt - b.attempt);
    });
  }

  // Generate MD report
  let md = `# F0 Diagnostic Report - Listing ${listingIdStr}\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- OMSRIA Images: ${omsriaImages?.length || 0}\n`;
  md += `- F0 Images: ${f0Images?.length || 0}\n`;
  md += `- Rooms with Validation Logs: ${Object.keys(validationLogs).length}\n\n`;
  md += `---\n\n`;

  // Generate section for each room
  if (omsriaImages && omsriaImages.length > 0) {
    for (const omsriaImg of omsriaImages) {
      const roomName = roomNameMap.get(omsriaImg.room_id) || omsriaImg.room_id;
      const f0Url = f0Images?.find(img => img.omsria_room_id === omsriaImg.room_id)?.furniture_free_url;
      const interimRetries = interimMap.get(omsriaImg.room_id) || [];
      const roomValidationLogs = validationLogs[omsriaImg.room_id] || [];

      md += `## ${omsriaImg.room_id} - ${roomName}\n\n`;
      md += `**Image Type**: ${omsriaImg.image_type || 'UNKNOWN'}\n\n`;

      // Validation logs section
      if (roomValidationLogs.length > 0) {
        md += `### Validation Logs\n\n`;
        roomValidationLogs.forEach((log: any, idx: number) => {
          md += `#### Attempt ${log.attempt}\n\n`;
          md += `- **Has Items**: ${log.hasItems ? '✅ Yes' : '❌ No'}\n`;
          md += `- **Passed**: ${log.passed ? '✅ Yes' : '❌ No'}\n`;
          md += `- **Reason**: ${log.reason}\n\n`;
          
          if (log.rawResponse) {
            md += `**Raw Validation Response**:\n\`\`\`\n${log.rawResponse}\n\`\`\`\n\n`;
          }
          
          if (log.filteredDirective) {
            md += `**Filtered Directive** (after removing permanent fixtures):\n\`\`\`\n${log.filteredDirective}\n\`\`\`\n\n`;
          }
          
          md += `---\n\n`;
        });
      } else {
        md += `### Validation Logs\n\n`;
        md += `⚠️ No validation logs found for this room.\n\n`;
      }

      // Images section
      md += `### Images\n\n`;
      md += `**Original OMSRIA**: [View](${omsriaImg.image_url})\n\n`;
      
      if (f0Url) {
        md += `**Final F0 Result**: [View](${f0Url})\n\n`;
      }
      
      if (interimRetries.length > 0) {
        md += `**Interim Steps**:\n\n`;
        interimRetries.forEach((retry) => {
          const label = retry.isFinal ? 'After Architectural Correction' : `Attempt ${retry.attempt}`;
          md += `- ${label}: [View](${retry.url})\n`;
        });
        md += `\n`;
      }
      
      md += `---\n\n`;
    }
  }

  // Write MD file
  const mdPath = `f0-diagnostics-${listingIdStr}.md`;
  writeFileSync(mdPath, md, 'utf-8');
  console.log(`✅ Generated diagnostic report: ${mdPath}`);
  
  return mdPath;
}

// Run if called directly
const listingId = process.argv[2];
if (listingId) {
  generateDiagnostics(listingId)
    .then((mdPath) => {
      console.log(`\n✨ Done! Open ${mdPath} to view diagnostics.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  console.error('Usage: tsx scripts/generate-f0-diagnostics.ts <listing_id>');
  process.exit(1);
}

