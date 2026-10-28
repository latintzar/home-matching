import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const runtime = 'nodejs';

export async function GET(request: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    
    // Fetch raw snippets
    const { data: rawSnippets, error } = await supabase
      .from('research_search_results')
      .select('*')
      .eq('listing_id', listingId)
      .order('rank', { ascending: true });

    if (error || !rawSnippets || rawSnippets.length === 0) {
      return NextResponse.json({ 
        error: 'No snippets found',
        listing_id: listingId 
      }, { status: 404 });
    }

    // Group by category
    const byCategory = new Map();
    rawSnippets.forEach((snippet: any) => {
      const category = snippet.metadata?.category || 'unknown';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category).push(snippet);
    });

    // Return category breakdown
    const categorySummary = Array.from(byCategory.entries()).map(([category, snippets]: [string, any]) => ({
      category,
      snippetCount: snippets.length,
      sampleSnippets: snippets.slice(0, 2).map((s: any) => ({
        display_link: s.display_link,
        snippet_preview: s.snippet.substring(0, 100),
        rank: s.rank
      }))
    })).sort((a, b) => b.snippetCount - a.snippetCount);

    return NextResponse.json({
      listing_id: listingId,
      totalSnippets: rawSnippets.length,
      totalCategories: byCategory.size,
      categories: categorySummary,
      categoriesWithSnippets: categorySummary.filter(c => c.snippetCount > 0).length,
      emptyCategories: categorySummary.filter(c => c.snippetCount === 0).map(c => c.category)
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

