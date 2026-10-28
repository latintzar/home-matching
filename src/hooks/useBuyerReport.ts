import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Simple in-memory cache to share data between components
const cache = new Map<string, { data: BuyerReport | null; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

interface BuyerReport {
  listing_id: string;
  generated_at: string;
  property_info: {
    title: string;
    location: string;
    price_eur?: number;
    last_updated: string;
  };
  house_as_a_whole: {
    narrative_synthesis: string;
    cross_room_themes: string[];
    room_one_liners: Array<{
      room_id: string;
      room_name: string;
      one_liner: string;
      anchor: string;
    }>;
  };
  forensic_risk_audit: {
    structural_pathology: {
      summary: string;
      key_findings: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    environmental_hostility: {
      summary: string;
      key_findings: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    social_security: {
      summary: string;
      key_findings: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    urban_legality: {
      summary: string;
      key_findings: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
  };
  execution_reality_check: {
    renovation_reality: {
      summary: string;
      key_findings: string[];
      cost_estimates?: string[];
      timeline_expectations?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    infrastructure: {
    summary: string;
      key_findings: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
  };
    room_by_room: Array<{
    room_id: string;
    room_name: string;
    findings: string[];
      renovation_costs?: string[];
    uncertainties: string[];
    anchor: string;
  }>;
  };
  financial_intelligence: {
    hidden_opex_incentives: {
      summary: string;
      hidden_costs: string[];
      incentives?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    market_context: {
      summary: string;
      key_findings: string[];
      price_trends?: string[];
      negotiation_leverage?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
  };
  citations_references?: {
    diagnostic: any[];
    contextual: any[];
    all_sources: any[];
  };
  inline_citations?: Array<{
    claim_id: string;
    claim_text: string;
    section: string;
    paragraph_index?: number;
    evidence_ids: string[];
    confidence: string;
    key_phrases?: string[];
  }>;
  evidence_map?: Record<string, {
    url: string;
    title?: string;
    publisher?: string;
    date?: string;
    type: string;
    snippet: string;
    confidence: string;
  }>;
  citation_chips?: Record<string, {
    count: number;
    confidence: string;
  }>;
}

export function useBuyerReport(listingId: string | undefined) {
  const [report, setReport] = useState<BuyerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache first - instant load if data already fetched
    const cached = cache.get(listingId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setReport(cached.data);
      setLoading(false);
      setError(null);
      // Still subscribe for updates, but don't show loading
    } else {
      setLoading(true);
      setError(null);
    }

    let cancelled = false;

    const fetchBuyerReport = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('text_analysis_results')
          .select('results, created_at, updated_at')
          .eq('listing_id', listingId)
          .eq('phase', 'buyer_report')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(fetchError.message || "Failed to fetch buyer report");
        }

        if (cancelled) return;

          if (data) {
          const reportData = data.results as BuyerReport;
          // Cache the data for instant subsequent loads
          cache.set(listingId, { data: reportData, timestamp: Date.now() });
          setReport(reportData);
          setLoading(false);
          } else {
            // Try generating if not found
            const generateResponse = await fetch(`/api/listings/${listingId}/analysis/final-scope`, {
              method: "POST"
            });
            if (generateResponse.ok) {
              const generateData = await generateResponse.json();
              if (generateData.success && generateData.data) {
              const reportData = generateData.data as BuyerReport;
              // Cache the generated data
              cache.set(listingId, { data: reportData, timestamp: Date.now() });
              setReport(reportData);
              setLoading(false);
            } else {
              cache.set(listingId, { data: null, timestamp: Date.now() });
              setLoading(false);
              }
          } else {
            cache.set(listingId, { data: null, timestamp: Date.now() });
          setLoading(false);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load buyer report");
          setLoading(false);
        }
      }
    };

    // Only fetch if not cached
    if (!cached || Date.now() - cached.timestamp >= CACHE_TTL) {
    fetchBuyerReport();
    }

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`buyer-report-hook-${listingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'text_analysis_results',
        filter: `listing_id=eq.${listingId} AND phase=eq.buyer_report`
      }, (payload) => {
        if (payload.new && !cancelled) {
          const reportData = (payload.new as any).results as BuyerReport;
          // Update cache on real-time update
          cache.set(listingId, { data: reportData, timestamp: Date.now() });
          setReport(reportData);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [listingId]);

  return { report, loading, error };
}

