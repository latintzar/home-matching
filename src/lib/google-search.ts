import { createClient } from '@supabase/supabase-js';

// Basic interface for Search Results
interface SearchResult {
  title?: string | null;
  link?: string | null;
  snippet?: string | null;
  displayLink?: string | null;
  source?: string;
}

// Helper to get ScrapingDog API Key
const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

/**
 * Executes a single Google Search via ScrapingDog API
 * This bypasses Google's bot detection and rate limits
 */
export async function executeGoogleSearch(query: string, numResults: number = 10): Promise<SearchResult[]> {
  if (!SCRAPINGDOG_API_KEY) {
    throw new Error('Missing ScrapingDog API Key (SCRAPINGDOG_API_KEY). Cannot execute search.');
  }

  try {
    console.log(`🔍 Executing ScrapingDog Google Search: "${query}"`);
    
    const params = new URLSearchParams({
      api_key: SCRAPINGDOG_API_KEY,
      query: query,
      results: numResults.toString(),
      country: 'es' // Force Spain results for consistency
    });

    const response = await fetch(`https://api.scrapingdog.com/google?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ScrapingDog API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // ScrapingDog returns { organic_results: [...] }
    const items = data.organic_results || [];
    
    return items.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayed_link,
      source: 'scrapingdog'
    }));

  } catch (error) {
    console.error(`❌ ScrapingDog Search failed for "${query}":`, error);
    throw new Error(`ScrapingDog Search failed: ${(error as any)?.message || 'Unknown error'}`);
  }
}

/**
 * Executes multiple searches in parallel with concurrency limit
 */
export async function executeMultipleSearches(queries: string[], concurrency: number = 3): Promise<Array<{
  query: string;
  title: string;
  url: string;
  snippet: string;
  display_link: string;
  rank: number;
}>> {
  const uniqueQueries = Array.from(new Set(queries));
  const allResults: Array<{
    query: string;
    title: string;
    url: string;
    snippet: string;
    display_link: string;
    rank: number;
  }> = [];

  // Process in chunks
  for (let i = 0; i < uniqueQueries.length; i += concurrency) {
    const batch = uniqueQueries.slice(i, i + concurrency);
    const promises = batch.map(async (query) => {
      try {
        const results = await executeGoogleSearch(query, 10); // Ask for 10 results
        return results.map((r, idx) => ({
          query,
          title: r.title || 'Untitled',
          url: r.link || '',
          snippet: r.snippet || '',
          display_link: r.displayLink || '',
          rank: idx + 1
        }));
      } catch (error) {
        console.error(`⚠️ Query failed in batch: "${query}"`, error);
        return [];
      }
    });

    const batchResults = await Promise.all(promises);
    batchResults.forEach(results => allResults.push(...results));
    
    // Small delay between batches
    if (i + concurrency < uniqueQueries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return allResults;
}
