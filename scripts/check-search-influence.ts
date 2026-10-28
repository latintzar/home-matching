
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Recipient configuration is supplied by tools/runtime-env.py.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSearchQueries() {
  // Fetch recent search queries for this listing
  const { data: results, error } = await supabase
    .from('analysis_search_results')
    .select('query, metadata')
    .eq('listing_id', 1000000132)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching search results:', error);
    return;
  }

  console.log(`✅ Found ${results.length} recent search queries.`);
  
  const cadastreTriggers = results.filter(r => {
      const q = r.query.toLowerCase();
      const reason = r.metadata?.reasoning?.toLowerCase() || '';
      return (
          q.includes('1924') || 
          reason.includes('cadastre') || 
          reason.includes('official') ||
          q.includes('plomo') ||
          q.includes('aluminosis')
      );
  });

  console.log(`🎯 Queries likely influenced by Cadastre (Year 1924, etc):`);
  cadastreTriggers.forEach(t => {
      console.log(`- Query: "${t.query}"`);
      console.log(`  Reason: ${t.metadata?.reasoning}`);
  });
}

checkSearchQueries();

