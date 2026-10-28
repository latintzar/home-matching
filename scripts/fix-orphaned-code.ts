/**
 * Fix orphaned code fragments from incomplete function removal
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

function fixFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Pattern 1: orphaned return createClient... line
  content = content.replace(/^\s*return createClient\([^)]+\);\s*\n?\}?\s*\n?/gm, '');
  
  // Pattern 2: orphaned closing brace after removal
  content = content.replace(/^\s*\}\s*\n\s*\n\s*interface/gm, '\ninterface');
  
  // Pattern 3: const declarations without usage  
  const urlDecl = /const\s+SUPABASE_URL\s*=\s*process\.env\.[^;]+;?\s*\n?/g;
  const keyDecl = /const\s+SUPABASE_SERVICE_KEY\s*=\s*process\.env\.[^;]+;?\s*\n?/g;
  
  // Only remove if no longer used
  if (!content.includes('SUPABASE_URL,') && !content.includes('SUPABASE_URL)')) {
    content = content.replace(urlDecl, '');
  }
  if (!content.includes('SUPABASE_SERVICE_KEY,') && !content.includes('SUPABASE_SERVICE_KEY)')) {
    content = content.replace(keyDecl, '');
  }
  
  // Pattern 4: orphaned lazy init comment
  content = content.replace(/\/\/\s*Lazy\s+init[^\n]*\n?\s*\n?/gi, '');
  
  // Pattern 5: Multiple consecutive blank lines
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
  console.log('🔧 Fixing orphaned code...\n');
  
  const routes = findApiRoutes(API_DIR);
  let fixed = 0;
  
  for (const route of routes) {
    const relativePath = path.relative(process.cwd(), route);
    if (fixFile(route)) {
      console.log(`✅ ${relativePath}`);
      fixed++;
    }
  }
  
  console.log(`\n📊 Fixed ${fixed} files`);
}

main().catch(console.error);

