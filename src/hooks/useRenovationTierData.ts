import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TierData {
  scope: any;
  timeline: any;
  permits: any;
  loading: boolean;
  error: string | null;
}

// Simple in-memory cache to share data between components
const cache = new Map<string, { data: TierData; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

export function useRenovationTierData(listingId: string | undefined) {
  const [data, setData] = useState<TierData>({
    scope: null,
    timeline: null,
    permits: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!listingId) {
      setData({ scope: null, timeline: null, permits: null, loading: false, error: null });
      return;
    }

    // Check cache first - instant load if data already fetched
    const cached = cache.get(listingId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      // Still subscribe for updates, but don't show loading
      setData(prev => ({ ...prev, loading: false }));
    } else {
      setData(prev => ({ ...prev, loading: true }));
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        const [scopeResult, timelineResult, permitsResult] = await Promise.all([
          supabase
            .from('final_renovation_scope')
            .select('scope_data')
            .eq('listing_id', listingId)
            .maybeSingle(),
          supabase
            .from('renovation_timeline_reports')
            .select('report_data')
            .eq('listing_id', parseInt(listingId, 10))
            .maybeSingle(),
          supabase
            .from('renovation_permits_reports')
            .select('report_data')
            .eq('listing_id', parseInt(listingId, 10))
            .maybeSingle()
        ]);

        if (cancelled) return;

        const tierData: TierData = {
          scope: scopeResult.data?.scope_data || null,
          timeline: timelineResult.data?.report_data || null,
          permits: permitsResult.data?.report_data || null,
          loading: false,
          error: null
        };

        // Cache the data for instant subsequent loads
        cache.set(listingId, { data: tierData, timestamp: Date.now() });
        setData(tierData);
      } catch (err: any) {
        if (!cancelled) {
          setData({
            scope: null,
            timeline: null,
            permits: null,
            loading: false,
            error: err.message
          });
        }
      }
    };

    // Only fetch if not cached
    if (!cached || Date.now() - cached.timestamp >= CACHE_TTL) {
      loadData();
    }

    // Real-time subscriptions for updates
    const scopeSubscription = supabase
      .channel(`tier-data-scope-${listingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'final_renovation_scope',
        filter: `listing_id=eq.${listingId}`
      }, () => {
        cache.delete(listingId); // Invalidate cache
        if (!cancelled) loadData();
      })
      .subscribe();

    const timelineSubscription = supabase
      .channel(`tier-data-timeline-${listingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'renovation_timeline_reports',
        filter: `listing_id=eq.${parseInt(listingId, 10)}`
      }, () => {
        cache.delete(listingId);
        if (!cancelled) loadData();
      })
      .subscribe();

    const permitsSubscription = supabase
      .channel(`tier-data-permits-${listingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'renovation_permits_reports',
        filter: `listing_id=eq.${parseInt(listingId, 10)}`
      }, () => {
        cache.delete(listingId);
        if (!cancelled) loadData();
      })
      .subscribe();

    return () => {
      cancelled = true;
      scopeSubscription.unsubscribe();
      timelineSubscription.unsubscribe();
      permitsSubscription.unsubscribe();
    };
  }, [listingId]);

  return data;
}

