/**
 * Migrate API endpoints to use data-adapter instead of direct Supabase imports
 * 
 * Strategy:
 * 1. Replace `import { supabase } from '@/lib/supabase'` 
 *    with `import { getRawSupabaseClient } from '@/lib/data-adapter'`
 * 2. Add `const supabase = getRawSupabaseClient();` at start of functions
 * 3. Handle various import patterns
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

// Files to skip (already migrated or special cases)
const SKIP_FILES = new Set([
  'src/app/api/ingest/server/route.ts',
  'src/app/api/lifestyle/recommendations/route.ts',
  'src/app/api/listings/[id]/text-analysis/b1-categorization/route.ts',
  'src/app/api/recommender/search/route.ts',
]);

// Import patterns to replace
const IMPORT_PATTERNS = [
  // Pattern: import { supabase } from '@/lib/supabase'
  {
    regex: /import\s*\{\s*supabase\s*\}\s*from\s*['"]@\/lib\/supabase['"]/g,
    replacement: `import { getRawSupabaseClient } from '@/lib/data-adapter'`,
    needsInit: true,
  },
  // Pattern: import { createClient } from '@supabase/supabase-js' + direct usage
  {
    regex: /import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]/g,
    replacement: `import { getRawSupabaseClient } from '@/lib/data-adapter'`,
    needsInit: true,
  },
  // Pattern: import { createServerClient } from '@supabase/ssr'
  {
    regex: /import\s*\{\s*createServerClient\s*\}\s*from\s*['"]@supabase\/ssr['"]/g,
    replacement: `import { getRawSupabaseClient } from '@/lib/data-adapter'`,
    needsInit: true,
  },
];

// Patterns for client initialization to remove
const INIT_PATTERNS = [
  // const supabase = createClient(...)
  /const\s+supabase\s*=\s*createClient\([^)]+\);?\n?/g,
  // const supabase = createServerClient(...)
  /const\s+supabase\s*=\s*createServerClient\([^)]+\);?\n?/g,
];

interface MigrationResult {
  file: string;
  changed: boolean;
  reason?: string;
  error?: string;
}

function migrateFile(filePath: string): MigrationResult {
  const relativePath = path.relative(process.cwd(), filePath);
  
  if (SKIP_FILES.has(relativePath)) {
    return { file: relativePath, changed: false, reason: 'skipped (already migrated)' };
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let needsInit = false;
    
    // Check if already using data-adapter
    if (content.includes("from '@/lib/data-adapter'")) {
      return { file: relativePath, changed: false, reason: 'already uses data-adapter' };
    }
    
    // Check if it uses supabase at all
    if (!content.includes('supabase')) {
      return { file: relativePath, changed: false, reason: 'no supabase usage found' };
    }
    
    // Apply import replacements
    for (const pattern of IMPORT_PATTERNS) {
      if (pattern.regex.test(content)) {
        content = content.replace(pattern.regex, pattern.replacement);
        needsInit = pattern.needsInit;
      }
    }
    
    // Remove old initialization patterns
    for (const pattern of INIT_PATTERNS) {
      content = content.replace(pattern, '');
    }
    
    // If we changed imports and need init, add it
    if (needsInit && content !== originalContent) {
      // Find first function that uses supabase and add init there
      // Or add after imports
      
      // Find the position after last import
      const importMatches = [...content.matchAll(/^import\s+.+$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index! + lastImport[0].length;
        
        // Check if getRawSupabaseClient call already exists
        if (!content.includes('getRawSupabaseClient()')) {
          // Add a note that supabase should be initialized in each function
          // Actually, for a cleaner approach, let's add it as a module-level const
          const initLine = '\n\nconst supabase = getRawSupabaseClient();\n';
          content = content.slice(0, insertPos) + initLine + content.slice(insertPos);
        }
      }
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { file: relativePath, changed: true };
    }
    
    return { file: relativePath, changed: false, reason: 'no changes needed' };
  } catch (error) {
    return { 
      file: relativePath, 
      changed: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
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
  console.log('🔄 Migrating API endpoints to data-adapter...\n');
  
  const routes = findApiRoutes(API_DIR);
  console.log(`Found ${routes.length} API routes\n`);
  
  const results: MigrationResult[] = [];
  
  for (const route of routes) {
    const result = migrateFile(route);
    results.push(result);
    
    if (result.changed) {
      console.log(`✅ ${result.file}`);
    } else if (result.error) {
      console.log(`❌ ${result.file}: ${result.error}`);
    }
  }
  
  const changed = results.filter(r => r.changed).length;
  const errors = results.filter(r => r.error).length;
  const skipped = results.filter(r => !r.changed && !r.error).length;
  
  console.log('\n📊 Summary:');
  console.log(`   Changed: ${changed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

main().catch(console.error);

