
import fs from 'fs';

const filePath = '/Users/peterneyra/.cursor/projects/Users-peterneyra-puedo-casa-puedo-casa-code-workspace/agent-tools/42b6837d-3548-4e18-af8e-dcf53d1f64d5.txt';

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const startMarker = '<untrusted-data-27319de7-970c-4872-a122-a87027047742>';
  let markerPos = content.indexOf(startMarker);
  
  if (markerPos !== -1) {
      const jsonStart = content.indexOf('[', markerPos);
      const jsonEnd = content.lastIndexOf(']');
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonStr = content.substring(jsonStart, jsonEnd + 1);
          
          // The snippet shows: [{\"results\":...
          // This is NOT valid JSON directly because of the backslashes escaping the quotes.
          // It looks like a stringified JSON inside the array? Or the tool output escaped the JSON?
          // If it is `[{\"results\":...`, it means the array contains a STRING, not an object?
          // But the array starts with `[`.
          // If the content is literally `[{\"results\":...`, then `\` is a character in the string.
          
          // To parse this, we need to unescape it.
          // Or, treat it as a string literal and JSON.parse it as a string? No, it's an array.
          
          // Try replacing \" with "
          const unescaped = jsonStr.replace(/\\"/g, '"');
          
          // But wait, if it was `[{\"results\":...`, replacing `\"` with `"` gives `[{"results":...`
          // which IS valid JSON.
          
          try {
             const parsed = JSON.parse(unescaped);
             if (Array.isArray(parsed) && parsed.length > 0) {
                 const row = parsed[0];
                 let data = row.results;
                 
                 // If results is a string, parse it again
                 if (typeof data === 'string') {
                     data = JSON.parse(data);
                 }
                 
                  const simplified = {
                    property_info: data.property_info,
                    forensic_risk_audit: {
                        structural_pathology: data.forensic_risk_audit?.structural_pathology?.alerts || [],
                        environmental_hostility: data.forensic_risk_audit?.environmental_hostility?.alerts || [],
                        urban_legality: data.forensic_risk_audit?.urban_legality?.alerts || []
                    },
                    execution_reality_check: {
                        renovation_reality: data.execution_reality_check?.renovation_reality?.cost_estimates || [],
                        room_sample: data.execution_reality_check?.room_by_room?.[0]
                    },
                    source_data_keys: Object.keys(data.source_data || {})
                };
                console.log(JSON.stringify(simplified, null, 2));
             }
         } catch (e: any) {
             console.error('Parsing failed:', e.message);
         }
      }
  }

} catch (err) {
  console.error(err);
}
