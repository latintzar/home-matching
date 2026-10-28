/**
 * Fix remaining syntax errors from incomplete cleanup
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

function fixFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Pattern 1: Orphaned || expressions  
  content = content.replace(/^\s*\|\|\s*process\.env\.[^;]+;?\s*$/gm, '');
  
  // Pattern 2: Orphaned ternary continuation
  content = content.replace(/^\s*:\s*process\.env\.[^;]+;?\s*$/gm, '');
  
  // Pattern 3: Multiple consecutive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  // Pattern 4: Remove lines that are just semicolons or close braces at wrong places
  // This needs careful handling
  
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
  console.log('🔧 Fixing syntax errors...\n');
  
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

