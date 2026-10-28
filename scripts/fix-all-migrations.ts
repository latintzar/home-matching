/**
 * Comprehensive fix for migration issues
 * 
 * Patterns to fix:
 * 1. Remove old getSupabase() functions that use createClient
 * 2. Replace createClient calls with getRawSupabaseClient()
 * 3. Remove unused SUPABASE_URL/KEY declarations
 * 4. Clean up duplicate supabase initializations
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

function fixFile(filePath: string): { changed: boolean; fixes: string[] } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const fixes: string[] = [];
  
  // Pattern 1: Remove getSupabase function blocks that use createClient
  const getSupabasePattern = /\/\/[^\n]*\n?function getSupabase\(\)[^{]*\{[^}]+createClient[^}]+\}\n*/g;
  if (getSupabasePattern.test(content)) {
    content = content.replace(getSupabasePattern, '');
    fixes.push('removed getSupabase function');
  }
  
  // Pattern 2: Remove inline getSupabase functions (single line style)
  const inlineGetSupabase = /function\s+getSupabase\s*\(\)\s*\{[^}]+\}\s*\n*/g;
  if (inlineGetSupabase.test(content)) {
    content = content.replace(inlineGetSupabase, '');
    fixes.push('removed inline getSupabase');
  }
  
  // Pattern 3: Replace `const supabase = getSupabase();` with getRawSupabaseClient
  const getSupabaseCall = /const\s+supabase\s*=\s*getSupabase\s*\(\s*\)\s*;?/g;
  if (getSupabaseCall.test(content)) {
    content = content.replace(getSupabaseCall, 'const supabase = getRawSupabaseClient();');
    fixes.push('replaced getSupabase() call');
  }
  
  // Pattern 4: Replace `const supabase = createClient(...)` with getRawSupabaseClient
  const createClientCall = /const\s+supabase\s*=\s*createClient\s*\([^)]+\)\s*;?/g;
  if (createClientCall.test(content)) {
    content = content.replace(createClientCall, 'const supabase = getRawSupabaseClient();');
    fixes.push('replaced createClient() call');
  }
  
  // Pattern 5: Remove SUPABASE_URL and SUPABASE_SERVICE_KEY declarations if no createClient
  if (!content.includes('createClient') && !content.includes('getSupabase()')) {
    // Safe to remove these if they exist and are unused
    const urlDecl = /const\s+SUPABASE_URL\s*=\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*;?\n*/g;
    const keyDecl = /const\s+SUPABASE_SERVICE_KEY\s*=\s*process\.env\.SUPABASE_SERVICE_KEY!?\s*;?\n*/g;
    const keyDecl2 = /const\s+SUPABASE_SERVICE_ROLE_KEY\s*=\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!?\s*;?\n*/g;
    const envCheck = /if\s*\(\s*!SUPABASE_URL\s*\|\|\s*!SUPABASE_SERVICE_KEY\s*\)\s*\{[^}]+\}\s*\n*/g;
    const envCheck2 = /if\s*\(\s*!SUPABASE_URL\s*\|\|\s*!SUPABASE_SERVICE_ROLE_KEY\s*\)\s*\{[^}]+\}\s*\n*/g;
    
    if (urlDecl.test(content)) {
      content = content.replace(urlDecl, '');
      fixes.push('removed SUPABASE_URL');
    }
    if (keyDecl.test(content)) {
      content = content.replace(keyDecl, '');
      fixes.push('removed SUPABASE_SERVICE_KEY');
    }
    if (keyDecl2.test(content)) {
      content = content.replace(keyDecl2, '');
      fixes.push('removed SUPABASE_SERVICE_ROLE_KEY');
    }
    if (envCheck.test(content)) {
      content = content.replace(envCheck, '');
      fixes.push('removed env check');
    }
    if (envCheck2.test(content)) {
      content = content.replace(envCheck2, '');
      fixes.push('removed env check 2');
    }
  }
  
  // Pattern 6: Remove duplicate module-level supabase declarations
  // Keep only one: const supabase = getRawSupabaseClient();
  const moduleSupabaseMatches = content.match(/^const supabase = getRawSupabaseClient\(\);$/gm);
  if (moduleSupabaseMatches && moduleSupabaseMatches.length > 1) {
    // Keep only one
    let found = false;
    content = content.replace(/const supabase = getRawSupabaseClient\(\);\n*/g, (match) => {
      if (!found) {
        found = true;
        return match;
      }
      return '';
    });
    fixes.push('removed duplicate supabase init');
  }
  
  // Pattern 7: Clean up triple+ blank lines
  content = content.replace(/\n{4,}/g, '\n\n\n');
  
  // Pattern 8: Ensure import is present if using getRawSupabaseClient
  if (content.includes('getRawSupabaseClient') && !content.includes("from '@/lib/data-adapter'")) {
    // Add import after first line
    const lines = content.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i + 1;
      }
    }
    lines.splice(insertIndex, 0, "import { getRawSupabaseClient } from '@/lib/data-adapter';");
    content = lines.join('\n');
    fixes.push('added data-adapter import');
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { changed: true, fixes };
  }
  
  return { changed: false, fixes: [] };
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
  console.log('🔧 Comprehensive migration fix...\n');
  
  const routes = findApiRoutes(API_DIR);
  let fixed = 0;
  
  for (const route of routes) {
    const relativePath = path.relative(process.cwd(), route);
    const result = fixFile(route);
    if (result.changed) {
      console.log(`✅ ${relativePath}`);
      console.log(`   Fixes: ${result.fixes.join(', ')}`);
      fixed++;
    }
  }
  
  console.log(`\n📊 Fixed ${fixed} files`);
}

main().catch(console.error);

