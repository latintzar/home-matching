/**
 * Fix migration issues - replace remaining createClient calls
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

function fixFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Skip if doesn't use data-adapter
  if (!content.includes("from '@/lib/data-adapter'")) {
    return false;
  }
  
  // Pattern 1: Remove remaining createClient initialization lines
  // const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  content = content.replace(
    /const\s+supabase\s*=\s*createClient\s*\([^)]+\)\s*;?\s*\n?/g,
    ''
  );
  
  // Pattern 2: Remove SUPABASE_URL and SUPABASE_SERVICE_KEY declarations if they're now unused
  // But only if no other usage exists
  
  // Pattern 3: Ensure supabase const exists after imports
  if (content.includes("getRawSupabaseClient") && 
      !content.includes("const supabase = getRawSupabaseClient()") &&
      !content.includes("supabase = getRawSupabaseClient()")) {
    
    // Find position after last import
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].match(/^import\s*\{/)) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex >= 0) {
      // Check if there's already a supabase const somewhere
      const hasSupabaseConst = lines.some(line => 
        line.match(/^\s*const\s+supabase\s*=/) && 
        !line.includes('createClient')
      );
      
      if (!hasSupabaseConst && content.includes('supabase.')) {
        // Insert after last import
        lines.splice(lastImportIndex + 1, 0, '', 'const supabase = getRawSupabaseClient();');
        content = lines.join('\n');
      }
    }
  }
  
  // Pattern 4: Clean up double blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  
  return false;
}

function findApiRoutes(dir: string): string[] {
  const routes: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'route.ts') {
        routes.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return routes;
}

async function main() {
  console.log('🔧 Fixing migration issues...\n');
  
  const routes = findApiRoutes(API_DIR);
  let fixed = 0;
  
  for (const route of routes) {
    const relativePath = path.relative(process.cwd(), route);
    if (fixFile(route)) {
      console.log(`✅ Fixed: ${relativePath}`);
      fixed++;
    }
  }
  
  console.log(`\n📊 Fixed ${fixed} files`);
}

main().catch(console.error);
