/**
 * Endpoint Migration Script
 * 
 * Migrates endpoints from direct Supabase imports to data adapter.
 * Run with: npx tsx scripts/migrate-endpoints.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

// Old patterns to replace
const OLD_IMPORTS = [
  /import \{ createClient \} from '@supabase\/supabase-js';?\n?/g,
  /import \{ createClient \} from "@supabase\/supabase-js";?\n?/g,
];

const OLD_CONFIG = [
  /const SUPABASE_URL = process\.env\.NEXT_PUBLIC_SUPABASE_URL!;\n?/g,
  /const SUPABASE_SERVICE_KEY = process\.env\.SUPABASE_SERVICE_KEY!;\n?/g,
  /const SUPABASE_SERVICE_KEY = process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!;\n?/g,
  /if \(!SUPABASE_URL \|\| !SUPABASE_SERVICE_KEY\) \{\n?\s*throw new Error\('Missing Supabase environment variables'\);\n?\}\n?/g,
  /const supabase = createClient\(SUPABASE_URL, SUPABASE_SERVICE_KEY\);?\n?/g,
];

// New import to add
const NEW_IMPORT = `import { getAnalysis, saveAnalysis, getRawSupabaseClient } from '@/lib/data-adapter';
import { getListingWithRaw, getCachedAnalysis, saveAnalysisResult } from '@/lib/data-adapter/migration-helpers';`;

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'route.ts') {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function needsMigration(content: string): boolean {
  return content.includes("from '@supabase/supabase-js'") || 
         content.includes('from "@supabase/supabase-js"');
}

function alreadyMigrated(content: string): boolean {
  return content.includes("from '@/lib/data-adapter'");
}

function migrateFile(filePath: string): { migrated: boolean; changes: string[] } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const changes: string[] = [];
  
  if (!needsMigration(content)) {
    return { migrated: false, changes: ['No Supabase imports found'] };
  }
  
  if (alreadyMigrated(content)) {
    return { migrated: false, changes: ['Already uses data adapter'] };
  }
  
  // Remove old imports
  for (const pattern of OLD_IMPORTS) {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changes.push('Removed Supabase import');
    }
  }
  
  // Remove old config
  for (const pattern of OLD_CONFIG) {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      changes.push('Removed Supabase config');
    }
  }
  
  // Add new import after the first import line
  const firstImportIndex = content.indexOf('import ');
  if (firstImportIndex !== -1) {
    const endOfFirstImport = content.indexOf('\n', firstImportIndex);
    content = content.slice(0, endOfFirstImport + 1) + NEW_IMPORT + '\n' + content.slice(endOfFirstImport + 1);
    changes.push('Added data adapter import');
  }
  
  // Replace supabase calls with getRawSupabaseClient()
  // This is a safe migration - keeps using Supabase but through the adapter
  if (content.includes('supabase.from(') || content.includes('supabase\n      .from(')) {
    // Add const supabase = getRawSupabaseClient() at the start of the function
    content = content.replace(
      /(export async function \w+\([^)]*\)[^{]*\{)/g,
      '$1\n    const supabase = getRawSupabaseClient();'
    );
    changes.push('Added getRawSupabaseClient() call');
  }
  
  if (changes.length > 1) { // More than just "No changes"
    fs.writeFileSync(filePath, content);
    return { migrated: true, changes };
  }
  
  return { migrated: false, changes: ['No changes needed'] };
}

async function main() {
  console.log('🔄 Endpoint Migration Script');
  console.log('============================\n');
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  const routeFiles = findRouteFiles(API_DIR);
  console.log(`Found ${routeFiles.length} route files\n`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of routeFiles) {
    const relativePath = path.relative(process.cwd(), file);
    
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      if (!needsMigration(content)) {
        if (verbose) console.log(`⏭️  ${relativePath} - No Supabase imports`);
        skipped++;
        continue;
      }
      
      if (alreadyMigrated(content)) {
        if (verbose) console.log(`✅ ${relativePath} - Already migrated`);
        skipped++;
        continue;
      }
      
      if (dryRun) {
        console.log(`📝 ${relativePath} - Would migrate`);
        migrated++;
      } else {
        const result = migrateFile(file);
        if (result.migrated) {
          console.log(`✅ ${relativePath}`);
          if (verbose) {
            result.changes.forEach(c => console.log(`   - ${c}`));
          }
          migrated++;
        } else {
          if (verbose) console.log(`⏭️  ${relativePath} - ${result.changes[0]}`);
          skipped++;
        }
      }
    } catch (error) {
      console.error(`❌ ${relativePath} - Error: ${error}`);
      errors++;
    }
  }
  
  console.log('\n============================');
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);

