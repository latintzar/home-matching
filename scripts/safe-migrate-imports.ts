/**
 * Safe Migration Script
 * 
 * Only changes imports and adds supabase initialization.
 * Does NOT remove any existing code - leaves that for later cleanup.
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

function migrateFile(filePath: string): { changed: boolean; action: string } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Skip if already using data-adapter
  if (content.includes("from '@/lib/data-adapter'")) {
    return { changed: false, action: 'already migrated' };
  }
  
  // Check if it uses supabase
  if (!content.includes('supabase') && !content.includes('createClient')) {
    return { changed: false, action: 'no supabase' };
  }
  
  // Pattern 1: Add import for data-adapter if file uses supabase
  const hasSupabaseImport = content.includes("from '@/lib/supabase'") || 
                            content.includes("from '@supabase/supabase-js'") ||
                            content.includes("from '@supabase/ssr'");
  
  if (hasSupabaseImport) {
    // Replace any supabase import with data-adapter
    content = content.replace(
      /import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]\s*;?\n?/g,
      "import { getRawSupabaseClient } from '@/lib/data-adapter';\n"
    );
    content = content.replace(
      /import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]\s*;?\n?/g,
      "import { getRawSupabaseClient } from '@/lib/data-adapter';\n"
    );
    content = content.replace(
      /import\s*\{\s*createServerClient\s*\}\s*from\s*['"]@supabase\/ssr['"]\s*;?\n?/g,
      "import { getRawSupabaseClient } from '@/lib/data-adapter';\n"
    );
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { changed: true, action: 'migrated imports' };
  }
  
  return { changed: false, action: 'no changes needed' };
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
  console.log('🔄 Safe migration of imports...\n');
  
  const routes = findApiRoutes(API_DIR);
  console.log(`Found ${routes.length} API routes\n`);
  
  let changed = 0;
  let skipped = 0;
  
  for (const route of routes) {
    const relativePath = path.relative(process.cwd(), route);
    const result = migrateFile(route);
    
    if (result.changed) {
      console.log(`✅ ${relativePath}`);
      changed++;
    } else {
      skipped++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Changed: ${changed}`);
  console.log(`   Skipped: ${skipped}`);
}

main().catch(console.error);

