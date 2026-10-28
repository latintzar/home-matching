/*
  Export renovation search URLs for a listing into a markdown file.
  Usage: node scripts/export-renovation-search-urls.js 1000000121
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function main() {
  const listingId = process.argv[2];
  if (!listingId) {
    console.error('Usage: node scripts/export-renovation-search-urls.js <listingId>');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('renovation_search_results')
    .select('url, title, metadata, rank')
    .eq('listing_id', listingId)
    .order('rank', { ascending: true });

  if (error) {
    console.error('Failed to fetch search results:', error);
    process.exit(1);
  }

  const byTierCategory = new Map();
  const seen = new Set();

  for (const row of data || []) {
    const tier = row.metadata?.tier || 'unknown_tier';
    const category = row.metadata?.category || 'unknown_category';
    const key = `${tier}/${category}`;
    if (!byTierCategory.has(key)) byTierCategory.set(key, []);
    const list = byTierCategory.get(key);
    const url = row.url || '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    list.push({ url, title: row.title || '', rank: row.rank || null });
  }

  const lines = [];
  lines.push(`# Renovation Google Search URLs for Listing ${listingId}`);
  lines.push('');
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('');

  const sortedKeys = Array.from(byTierCategory.keys()).sort();
  for (const key of sortedKeys) {
    const [tier, category] = key.split('/');
    const entries = byTierCategory.get(key);
    lines.push(`## ${tier} / ${category} (${entries.length})`);
    lines.push('');
    for (const e of entries) {
      const safeTitle = e.title.replace(/\|/g, ' ');
      lines.push(`- ${e.rank !== null ? `(${e.rank}) ` : ''}[${safeTitle || e.url}](${e.url})`);
    }
    lines.push('');
  }

  const outDir = path.join(process.cwd(), 'docs');
  const outPath = path.join(outDir, `RENOVATION_SEARCH_URLS_${listingId}.md`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`✅ Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


