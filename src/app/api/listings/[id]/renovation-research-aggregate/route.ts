import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AggregatedResearchResults, AggregatedCategory } from '@/types/renovation-intelligence';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const tier: 'estandar' | 'optimo' | 'plus' = body?.tier || 'estandar';

    console.log(`🧩 Aggregating curated research for listing ${listingId}, tier ${tier}`);

    // Fetch curated research results for this listing from renovation_research_results
    // This table stores curated results from /renovation-google-search endpoint
    const { data: curated, error: curatedError } = await supabase
      .from('renovation_research_results')
      .select('*')
      .eq('listing_id', parseInt(String(listingId), 10))
      .like('category', `%_${tier}`); // e.g., 'costs_estandar'

    if (curatedError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch curated research', details: curatedError.message },
        { status: 500 }
      );
    }

    if (!curated || curated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No curated research found' },
        { status: 404 }
      );
    }

    // Group by work_item_name if available in representative snippets metadata; otherwise fallback to tier-wide
    const aggregated: AggregatedResearchResults = {
      listing_id: String(listingId),
      tier,
      aggregated_results: {}
    };

    const addToWorkItem = (
      workItem: string,
      category: keyof AggregatedResearchResults['aggregated_results'][string],
      entry: AggregatedCategory
    ) => {
      if (!aggregated.aggregated_results[workItem]) {
        aggregated.aggregated_results[workItem] = {
          overall_confidence: 'low',
          combined_sources: []
        } as any;
      }
      (aggregated.aggregated_results[workItem] as any)[category] = entry;
      // Update confidence and sources
      const conf = entry.confidence;
      const current = aggregated.aggregated_results[workItem].overall_confidence;
      const rank = (c: string) => (c === 'high' ? 3 : c === 'medium' ? 2 : 1);
      if (rank(conf) > rank(current)) aggregated.aggregated_results[workItem].overall_confidence = conf;
      aggregated.aggregated_results[workItem].combined_sources = Array.from(new Set([
        ...aggregated.aggregated_results[workItem].combined_sources,
        ...(entry.sources || [])
      ]));
    };

    // Simple heuristic mapping curated categories to aggregated categories
    const mapCategory = (c: string): keyof AggregatedResearchResults['aggregated_results'][string] | null => {
      if (/cost/i.test(c)) return 'costs';
      if (/tim/i.test(c) || /dur/i.test(c)) return 'timings';
      if (/permit/i.test(c)) return 'permits';
      if (/law|regul/i.test(c)) return 'laws';
      if (/norm|standard/i.test(c)) return 'norms';
      if (/market/i.test(c)) return 'market';
      if (/incentiv|subsid/i.test(c)) return 'incentives';
      return null;
    };

    // Iterate curated results and aggregate
    // renovation_research_results stores report_data.summaries per category
    for (const row of curated) {
      // Extract category name (remove tier suffix, e.g., 'costs_estandar' -> 'costs')
      const categoryMatch = String(row.category || '').match(/^(.+?)_(estandar|optimo|plus)$/);
      const baseCategory = categoryMatch ? categoryMatch[1] : String(row.category || '');
      const categoryKey = mapCategory(baseCategory);
      if (!categoryKey) continue;

      // renovation_research_results has report_data.summaries array
      const reportData = row.report_data as any;
      const summaries = Array.isArray(reportData?.summaries) ? reportData.summaries : [];

      for (const summary of summaries) {
        // Extract work_item_name from summary (if work-item-specific) or use tier-wide
        const workItemName = summary.work_item_name || summary.work_item_id || `${tier}_tier_wide`;

        const entry: AggregatedCategory = {
          summary: summary.summary,
          metrics: summary.metrics,
          confidence: summary.confidence || 'low',
          sources: Array.isArray(summary.sources) ? summary.sources : []
        };

        addToWorkItem(workItemName, categoryKey, entry);
      }
    }

    // Save aggregated results
    const { error: saveError } = await supabase
      .from('research_aggregated_results')
      .upsert({
        listing_id: String(listingId),
        tier,
        aggregated_data: aggregated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'listing_id,tier' });

    if (saveError) {
      return NextResponse.json(
        { success: false, error: 'Failed to save aggregated research', details: saveError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: aggregated });

  } catch (error) {
    console.error('Aggregation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
