import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface RenovationTier {
  id: number;
  listing_id: number;
  tier_name: 'livable' | 'comfortable' | 'competitive';
  work_items: WorkItem[];
  permits: Permit[];
  timeline: TimelineMilestone[];
  total_time_months: number;
  total_cost_min: number;
  total_cost_max: number;
  style_prompts?: StylePrompts;
  created_at: string;
  updated_at: string;
}

export interface WorkItem {
  category: string;
  name: string;
  description: string;
  estimated_hours?: number;
  complexity: 'low' | 'medium' | 'high';
  material_cost_min?: number;
  material_cost_max?: number;
  labor_cost_min?: number;
  labor_cost_max?: number;
  total_cost_min?: number;
  total_cost_max?: number;
  cost_per_hour?: number;
  cost_per_m2?: number;
  pricing_notes?: string;
}

export interface Permit {
  name: string;
  type: string;
  why_needed: string;
  what_needed: string;
  how_obtained: string;
}

export interface TimelineMilestone {
  header: string;
  subtitle: string;
  duration_weeks: {
    min: number;
    max: number;
  };
  order: number;
  dependencies?: string[];
}

export interface StylePrompts {
  overall_style: string;
  color_palette: string;
  materials: string;
  lighting: string;
  furniture: string;
  decor: string;
  quality_level: string;
  full_prompt: string;
}

/**
 * Formats timeline duration from week range to display string
 * Shows weeks if max <= 8, otherwise shows rounded months
 */
export function formatTimelineDuration(duration_weeks: { min: number; max: number }): string {
  const { min, max } = duration_weeks;
  
  if (max <= 8) {
    // Show weeks for short durations
    if (min === max) {
      return `${min} week${min === 1 ? '' : 's'}`;
    }
    return `${min}–${max} weeks`;
  } else {
    // Show rounded months for longer durations
    const minMonths = Math.round(min / 4.33); // 4.33 weeks per month average
    const maxMonths = Math.round(max / 4.33);
    
    if (minMonths === maxMonths) {
      return `${minMonths} month${minMonths === 1 ? '' : 's'}`;
    }
    return `${minMonths}–${maxMonths} months`;
  }
}

export function useRenovationTiers(listingId: string | null) {
  const [tiers, setTiers] = useState<RenovationTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) {
      setTiers([]);
      return;
    }

    const fetchTiers = async () => {
      setLoading(true);
      setError(null);

      try {
        // Source of truth migrated to final_renovation_scope
        const { data: scopeRow, error: scopeError } = await supabase
          .from('final_renovation_scope')
          .select('scope_data')
          .eq('listing_id', String(listingId))
          .maybeSingle();

        if (scopeError) {
          throw scopeError;
        }

        if (!scopeRow) {
          setTiers([]);
          return;
        }

        const sd = (scopeRow as any)?.scope_data || {};
        const tiersMapped: RenovationTier[] = [] as any;

        // Map estandar/optimo/plus → legacy UI names for backward compatibility
        const map: Array<{ key: string; name: 'livable' | 'comfortable' | 'competitive' }> = [
          { key: 'estandar', name: 'livable' },
          { key: 'optimo', name: 'comfortable' },
          { key: 'plus', name: 'competitive' }
        ];

        for (const m of map) {
          const t = sd?.tiers?.[m.key];
          if (!t) continue;

          // Robust cost extraction (handle various schemas)
          let minCost = 0;
          let maxCost = 0;

          if (t.totals) {
            // Legacy schema with totals object
            minCost = t.totals.total_cost_min || 0;
            maxCost = t.totals.total_cost_max || 0;
          } else if (t.total_estimate_range_eur && Array.isArray(t.total_estimate_range_eur)) {
            // New generate-stream schema
            minCost = t.total_estimate_range_eur[0] || 0;
            maxCost = t.total_estimate_range_eur[1] || 0;
          } else if (t.total_price_estimated) {
            // Unified-scope schema (single value)
            minCost = t.total_price_estimated;
            maxCost = t.total_price_estimated;
          } else if (t.total_estimate_eur) {
            // Alternative single value
            minCost = t.total_estimate_eur;
            maxCost = t.total_estimate_eur;
          }

          // Robust time extraction
          let timeMonths = 0;
          if (t.totals?.duration_months) {
            timeMonths = t.totals.duration_months;
          } else if (t.duration_weeks) {
            timeMonths = Math.round(t.duration_weeks / 4.3);
          } else if (t.timeline_weeks && Array.isArray(t.timeline_weeks)) {
            const avgWeeks = ((t.timeline_weeks[0] || 0) + (t.timeline_weeks[1] || 0)) / 2;
            timeMonths = Math.round(avgWeeks / 4.3);
          }

          tiersMapped.push({
            id: 0,
            listing_id: Number(listingId),
            tier_name: m.name,
            work_items: (t.work_items as any[]) || [],
            permits: (t.permits as any[]) || [],
            timeline: (t.timeline as any[]) || (t.phases as any[]) || [],
            total_time_months: timeMonths,
            total_cost_min: minCost,
            total_cost_max: maxCost,
            created_at: '',
            updated_at: ''
          } as RenovationTier);
        }

        setTiers(tiersMapped);
      } catch (err) {
        console.error('Error fetching renovation tiers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch renovation tiers');
      } finally {
        setLoading(false);
      }
    };

    fetchTiers();

    // Set up real-time subscriptions for all tier-related tables
    const scopeChannel = supabase
      .channel(`renovation-tiers-scope-${listingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'final_renovation_scope',
          filter: `listing_id=eq.${String(listingId)}`,
        },
        () => {
          console.log('🔄 Final renovation scope updated, refetching tiers...');
          fetchTiers();
        }
      )
      .subscribe();

    const timelineChannel = supabase
      .channel(`renovation-tiers-timeline-${listingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'renovation_timeline_reports',
          filter: `listing_id=eq.${parseInt(String(listingId), 10)}`,
        },
        () => {
          console.log('🔄 Timeline updated, refetching tiers...');
          fetchTiers();
        }
      )
      .subscribe();

    const permitsChannel = supabase
      .channel(`renovation-tiers-permits-${listingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'renovation_permits_reports',
          filter: `listing_id=eq.${parseInt(String(listingId), 10)}`,
        },
        () => {
          console.log('🔄 Permits updated, refetching tiers...');
          fetchTiers();
        }
      )
      .subscribe();

    return () => {
      scopeChannel.unsubscribe();
      timelineChannel.unsubscribe();
      permitsChannel.unsubscribe();
    };
  }, [listingId]);

  return { tiers, loading, error };
}

export function useRenovationTier(listingId: string | null, tierName: 'livable' | 'comfortable' | 'competitive') {
  const { tiers, loading, error } = useRenovationTiers(listingId);
  
  const tier = tiers.find(t => t.tier_name === tierName);
  
  return { tier, loading, error };
}

// Helper function to get tier by name
export function getTierByName(tiers: RenovationTier[], tierName: 'livable' | 'comfortable' | 'competitive'): RenovationTier | null {
  return tiers.find(t => t.tier_name === tierName) || null;
}

// Helper function to format cost range
export function formatCostRange(tier: RenovationTier): string {
  if (!tier.total_cost_min || !tier.total_cost_max) {
    return 'Precio por consultar';
  }
  return `€${tier.total_cost_min.toLocaleString()}-€${tier.total_cost_max.toLocaleString()}`;
}

// Helper function to format time range
export function formatTimeRange(tier: RenovationTier): string {
  if (!tier.total_time_months) {
    return 'Tiempo por determinar';
  }
  
  if (tier.total_time_months === 1) {
    return '1 mes';
  } else if (tier.total_time_months < 12) {
    return `${tier.total_time_months} meses`;
  } else {
    const years = Math.floor(tier.total_time_months / 12);
    const months = tier.total_time_months % 12;
    if (months === 0) {
      return years === 1 ? '1 año' : `${years} años`;
    } else {
      return `${years} año${years > 1 ? 's' : ''} ${months} mes${months > 1 ? 'es' : ''}`;
    }
  }
}
