/**
 * Count unique domains from renovation search results
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

async function countUniqueDomains(listingId: number) {
  // Fetch all search results
  const { data: results, error } = await supabase
    .from('renovation_search_results')
    .select('url, display_link, metadata')
    .eq('listing_id', listingId);

  if (error) {
    console.error('Error fetching results:', error);
    return;
  }

  if (!results || results.length === 0) {
    console.log('No search results found');
    return;
  }

  // Extract unique domains
  const domains = new Set<string>();
  const urls = new Set<string>();
  const domainCounts: Record<string, number> = {};
  const sourceBreakdown: Record<string, Set<string>> = {
    general: new Set(),
    habitissimo: new Set(),
    leroy_merlin: new Set()
  };

  for (const result of results) {
    let domain = '';
    
    // Prefer display_link, fallback to extracting from URL
    if (result.display_link) {
      domain = result.display_link.replace(/^www\./, '');
    } else if (result.url) {
      try {
        const url = new URL(result.url);
        domain = url.hostname.replace(/^www\./, '');
      } catch (e) {
        // Skip invalid URLs
        continue;
      }
    }

    if (!domain) continue;

    // Normalize domain
    domain = domain.toLowerCase();

    // Track unique URL
    if (result.url) {
      urls.add(result.url);
    }
    
    // Track unique domains
    domains.add(domain);
    
    // Count occurrences
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;

    // Track by source
    const source = (result.metadata as any)?.source || 'general';
    if (source === 'habitissimo' || domain.includes('habitissimo')) {
      sourceBreakdown.habitissimo.add(domain);
    } else if (source === 'leroy_merlin' || domain.includes('leroy') || domain.includes('leroymerlin')) {
      sourceBreakdown.leroy_merlin.add(domain);
    } else {
      sourceBreakdown.general.add(domain);
    }
  }

  // Display results
  console.log('\n📊 DOMAIN ANALYSIS\n');
  console.log(`Total search results (rows): ${results.length}`);
  console.log(`Unique pages (distinct URLs): ${urls.size}`);
  console.log(`Unique websites (distinct domains): ${domains.size}`);
  console.log(`\nBreakdown by source:`);
  console.log(`  General Google: ${sourceBreakdown.general.size} unique domains`);
  console.log(`  Habitissimo: ${sourceBreakdown.habitissimo.size} unique domains`);
  console.log(`  Leroy Merlin: ${sourceBreakdown.leroy_merlin.size} unique domains`);

  // Top 20 domains by frequency
  const sortedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log(`\n🔝 Top 20 domains by frequency:`);
  sortedDomains.forEach(([domain, count], index) => {
    console.log(`  ${index + 1}. ${domain}: ${count} results`);
  });

  // List all Habitissimo and Leroy Merlin domains
  if (sourceBreakdown.habitissimo.size > 0) {
    console.log(`\n🏪 Habitissimo domains:`);
    Array.from(sourceBreakdown.habitissimo).forEach(domain => {
      console.log(`  - ${domain}`);
    });
  }

  if (sourceBreakdown.leroy_merlin.size > 0) {
    console.log(`\n🛒 Leroy Merlin domains:`);
    Array.from(sourceBreakdown.leroy_merlin).forEach(domain => {
      console.log(`  - ${domain}`);
    });
  }
}

// Run for listing 1000000121
const listingId = 1000000121;
countUniqueDomains(listingId)
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

