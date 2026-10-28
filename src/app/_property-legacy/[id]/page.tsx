"use client";

import React, { useMemo, useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Sparkles, ChevronsRight, Settings, Copy, Trash2, Calendar, Check, ArrowRight, FileText } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PropertyDetails } from "@/components/PropertyDetails";
import { RenovationTierModal } from "@/components/renovation/RenovationTierModal";
import { PersonaliseRenovationModal } from "@/components/renovation/PersonaliseRenovationModal";
import { TierCards } from "@/components/renovation/TierCards";
import { BuyerReportModal } from "@/components/BuyerReportModal";
import { ViewingChecklist } from "@/components/ViewingChecklist";
import { supabase } from "@/lib/supabase";
import { useRenovationTiers, formatCostRange, formatTimeRange, getTierByName } from "@/hooks/useRenovationTiers";
import dynamic from "next/dynamic";
import AISidebar from "@/components/AISidebar";

// Lazy-load components from the large client bundle to avoid heavy SSR
const SixBlockGrid = dynamic(() => Promise.resolve(() => <div className="h-[60vh] rounded-xl bg-muted animate-pulse" />), { ssr: false, loading: () => <div className="h-[60vh] rounded-xl bg-muted animate-pulse" /> });

interface Listing {
  id: string;
  title: string;
  price_eur: number;
  created_at: string;
}

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTier, setActiveTier] = useState<null | "livable" | "comfortable" | "competitive">(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyerReportModalOpen, setBuyerReportModalOpen] = useState(false);
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<{[tier: string]: string[]}>({});
  const [agentLogoUrl, setAgentLogoUrl] = useState<string | null>(null);
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentWhatsapp, setAgentWhatsapp] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true); // Start as loading until we have suggestions
  const [copyAllClicked, setCopyAllClicked] = useState(false);
  const [personaliseModalOpen, setPersonaliseModalOpen] = useState(false);

  // Use ID from URL params
  const selectedListingId = id;

  // Renovation data
  const { tiers: renovationTiers, loading: renovationLoading, error: renovationError } = useRenovationTiers(selectedListingId);

  // Fetch all listings function (removed - using URL param)

  // Auto-start analysis if requested
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('auto');
    
    // Only trigger if we have an ID and not loading. 
    // We allow re-running even if propertyData exists to force refresh or ensure completeness.
    if (auto === 'true' && selectedListingId && !loading) {
        console.log('🚗 Auto-Starting Analysis for listing:', selectedListingId);
        
        // Trigger Orchestrator
        fetch(`/api/listings/${selectedListingId}/orchestrate-basic-package`, {
            method: 'POST',
            body: JSON.stringify({ force: false })
        }).catch(err => console.error('Auto-analysis failed:', err));
        
        // Show loading UI via Buyer Report Modal
        setBuyerReportModalOpen(true);
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }
  }, [selectedListingId, propertyData, loading]);

  // Handle tier modal opening from AI sidebar links
  useEffect(() => {
    const handleOpenTierModal = (e: CustomEvent) => {
      const tier = e.detail?.tier;
      if (tier && ['livable', 'comfortable', 'competitive'].includes(tier)) {
        setActiveTier(tier as 'livable' | 'comfortable' | 'competitive');
      }
    };
    window.addEventListener('open-tier-modal', handleOpenTierModal as EventListener);
    return () => window.removeEventListener('open-tier-modal', handleOpenTierModal as EventListener);
  }, []);

  // Generate initial suggestions on page load when we have a listing
  // Only run once per listing change, not on subsequent updates
  useEffect(() => {
    if (!selectedListingId) {
      // Don't reset state if we're just waiting for a listing to be selected
      return;
    }
    
    // Loading state is already set in fetchListings, so we don't set it again here
    // This prevents double-setting and flickering
    fetch(`/api/ai/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: selectedListingId, messages: [] })
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => {
        const suggs = Array.isArray(d.suggestions) ? d.suggestions : [];
        setInitialSuggestions(suggs);
        setSuggestionsLoading(false); // Only clear loading after we have suggestions
      })
      .catch((err) => {
        console.error('❌ Failed to generate initial suggestions:', err);
        setInitialSuggestions([]);
        setSuggestionsLoading(false);
      });
  }, [selectedListingId]); // Only re-run when listing changes

  // Real-time subscription for new listings
  /*
  useEffect(() => {
    const subscription = supabase
      .channel('listings-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'listings'
      }, (payload) => {
        console.log('🆕 New listing created:', payload);
        console.log('🔄 Refreshing listings due to new listing');
        // fetchListings(); // No longer fetching all listings
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  */

  // Real-time subscription for property data updates
  useEffect(() => {
    if (!selectedListingId) return;

    const subscription = supabase
      .channel(`property-updates-${selectedListingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'text_analysis_results',
        filter: `listing_id=eq.${selectedListingId}`
      }, () => {
        fetchPropertyData(selectedListingId);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedListingId]);

  // Fetch property data when selected listing changes
  useEffect(() => {
    if (selectedListingId) {
      // show skeletons by nulling data; do not block UI with overlay
      setPropertyData(null);
      setListingPhotos([]);
      setAfterPhotos({});
      fetchPropertyData(selectedListingId);
      fetchListingPhotos(selectedListingId);
      fetchAllAfterPhotos(selectedListingId);
      fetchAgentInfo(selectedListingId);
    } else {
      setPropertyData(null);
      setListingPhotos([]);
      setAfterPhotos({});
      setAgentLogoUrl(null);
      setAgentName(null);
      setAgentWhatsapp(null);
      setAgentId(null);
    }
  }, [selectedListingId]);

  // Fetch property data (integrated text-analysis results)
  const fetchPropertyData = async (listingId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/listings/${listingId}/text-analysis/results`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch property data');
      }
      setPropertyData(data.data);
    } catch (err) {
      console.error('Error fetching property data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Fetch listing photos
  const fetchListingPhotos = async (listingId: string) => {
    try {
      const response = await fetch(`/api/listings/${listingId}/photos`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.photos) {
          const photoUrls = data.photos.map((photo: any) => photo.url);
          setListingPhotos(photoUrls);
        }
      }
    } catch (err) {
      console.error('Error fetching listing photos:', err);
    }
  };

  // Fetch after photos for a specific tier
  const fetchAfterPhotos = async (listingId: string, tier: string) => {
    try {
      console.log(`🖼️ Fetching after photos for ${tier}...`);
      const response = await fetch(`/api/listings/${listingId}/photos/after?tier=${tier}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`🖼️ After photos response for ${tier}:`, data);
        if (data.success && data.photos) {
          const photoUrls = data.photos.map((photo: any) => photo.url);
          console.log(`🖼️ Setting after photos for ${tier}:`, photoUrls);
          setAfterPhotos(prev => ({
            ...prev,
            [tier]: photoUrls
          }));
        }
      } else {
        console.log(`🖼️ Failed to fetch after photos for ${tier}:`, response.status);
      }
    } catch (err) {
      console.error(`Error fetching after photos for ${tier}:`, err);
    }
  };

  // Fetch all after photos for all tiers
  const fetchAllAfterPhotos = async (listingId: string) => {
    const tiers = ['livable', 'comfortable', 'competitive'];
    for (const tier of tiers) {
      await fetchAfterPhotos(listingId, tier);
    }
  };

  // Fetch agent info live from Supabase for the selected listing
  const fetchAgentInfo = async (listingId: string) => {
    try {
      // Get listing agent_id and scraped_data.agency fallback
      const { data: listingRow, error: listingErr } = await supabase
        .from('listings')
        .select('agent_id, scraped_data')
        .eq('id', listingId)
        .single();

      if (listingErr) {
        console.error('Error fetching listing agent info:', listingErr);
        return;
      }

      const fallbackAgency = listingRow?.scraped_data?.agency || null;
      const fallbackName = fallbackAgency?.name || null;
      const fallbackLogo = fallbackAgency?.stored_logo_url || fallbackAgency?.original_logo_url || null;

      setAgentId(listingRow?.agent_id ?? null);

      if (listingRow?.agent_id) {
        const { data: agentRow, error: agentErr } = await supabase
          .from('agents')
          .select('id, name, logo_url, whatsapp')
          .eq('id', listingRow.agent_id)
          .single();
        if (agentErr) {
          console.warn('Agent fetch failed, using fallback agency from scraped_data:', agentErr);
          setAgentName(fallbackName);
          setAgentLogoUrl(fallbackLogo);
          setAgentWhatsapp(null);
          return;
        }
        setAgentName(agentRow?.name || fallbackName);
        setAgentLogoUrl(agentRow?.logo_url || fallbackLogo);
        setAgentWhatsapp(agentRow?.whatsapp || null);
      } else {
        // No linked agent yet; use scraped_data agency if present
        setAgentName(fallbackName);
        setAgentLogoUrl(fallbackLogo);
        setAgentWhatsapp(null);
      }
    } catch (e) {
      console.error('fetchAgentInfo error:', e);
    }
  };

  // Real-time updates for listing agent changes and agent record changes
  useEffect(() => {
    if (!selectedListingId) return;
    const ch = supabase
      .channel(`listing-agent-${selectedListingId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings', filter: `id=eq.${selectedListingId}` }, () => {
        fetchAgentInfo(selectedListingId);
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [selectedListingId]);

  useEffect(() => {
    if (!agentId) return;
    const ch = supabase
      .channel(`agent-updates-${agentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents', filter: `id=eq.${agentId}` }, () => {
        if (selectedListingId) fetchAgentInfo(selectedListingId);
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [agentId, selectedListingId]);

  const loadLatestListing = async () => {}; // fetchListings();

  const loadOldestListing = () => {
    // Removed
  };

  // -------- Export helpers (tiers as rendered) --------
  const mapEsToUi: Record<string, "livable" | "comfortable" | "competitive"> = {
    estandar: "livable",
    optimo: "comfortable",
    plus: "competitive",
  };

  // Canonical prompt templates for local export (guaranteed availability)
  const CANON_PROMPTS = {
    scope_seed: `You are a renovation planner. Generate Estándar/Óptimo/Plus work items with cost_low_eur, cost_high_eur, duration_weeks, requires_permit, and category per item for this listing and context. Output JSON only.`,
    finalize: `You are consolidating tiers into a final, UI‑ready scope (estandar/optimo/plus). Reconcile overlaps, ensure totals and time realism, and return the FinalRenovationScope schema exactly.`,
    timeline: `Create realistic renovation timeline phases with weeks per phase based on tier ambition and permits. Use Spanish municipal realism when possible. Return an array of phases with name, weeks, and summary.`,
    permits: `Determine permits required for the selected scope in Spain (obra menor/obra mayor/structural). Provide why_needed, documentation_required, issuing_authority, expected_time_weeks, and pitfalls.`,
    pricing: `Summarize pricing across work items using aggregated research. Provide ranges in EUR, assumptions, and any exclusions. Return structured pricing report.`,
  } as const;

  const computeTotals = (workItems: any[]) => {
    // Mirror ScopeMatrix totals
    const items = (Array.isArray(workItems) ? workItems : []).map((it: any) => ({
      months: {
        min: Math.max(0.2, ((it?.duration_weeks ?? 4) / 4.3) * 0.7),
        max: Math.max(0.3, ((it?.duration_weeks ?? 4) / 4.3) * 1.3),
      },
      cost: {
        minEur: Math.max(0, it?.cost_low_eur ?? 0),
        maxEur: Math.max(it?.cost_low_eur ?? 0, it?.cost_high_eur ?? 0),
      },
    }));
    const totalAvgMonths = items.reduce((a, b) => a + (b.months.min + b.months.max) / 2, 0);
    const totalAvgWeeks = totalAvgMonths * 4.3;
    const totalAvgCostEur = items.reduce((a, b) => a + (b.cost.minEur + b.cost.maxEur) / 2, 0);
    return { avg_months: Number(totalAvgMonths.toFixed(1)), avg_weeks: Math.round(totalAvgWeeks), avg_cost_eur: Math.round(totalAvgCostEur) };
  };

  const exportTiers = async (format: "json" | "md") => {
    if (!selectedListingId) return;
    try {
      // final scope
      const { data: scopeRow } = await supabase
        .from('final_renovation_scope')
        .select('scope_data')
        .eq('listing_id', selectedListingId)
        .single();
      const sd: any = scopeRow?.scope_data || {};

      // timeline
      const { data: tlRow } = await supabase
        .from('renovation_timeline_reports')
        .select('report_data')
        .eq('listing_id', selectedListingId)
        .single();
      const tl: any = tlRow?.report_data || {};

      // permits
      const { data: pmRow } = await supabase
        .from('renovation_permits_reports')
        .select('report_data')
        .eq('listing_id', selectedListingId)
        .single();
      const pm: any = pmRow?.report_data || {};

      // pricing
      const { data: prRow } = await supabase
        .from('renovation_pricing_reports')
        .select('report_data')
        .eq('listing_id', selectedListingId)
        .single();
      const pr: any = prRow?.report_data || {};

      const tiersOut: Record<string, any> = {};
      for (const k of ["estandar", "optimo", "plus"]) {
        const ui = mapEsToUi[k];
        const t = sd?.tiers?.[k] || {};
        const workItems = Array.isArray(t.work_items) ? t.work_items : [];
        const totals = computeTotals(workItems);
        const phases = tl?.tiers?.[k]?.phases || tl?.phases || [];
        const permits = pm?.permits || [];
        tiersOut[ui] = {
          name: ui,
          totals,
          work_items: workItems,
          timeline: phases,
          permits,
        };
      }

      // collect prompts if present in each report (best-effort)
      const prompts = {
        scope_seed_prompt: (sd?.prompt || sd?.meta?.prompt || CANON_PROMPTS.scope_seed),
        finalize_prompt: (sd?.finalize_prompt || CANON_PROMPTS.finalize),
        timeline_prompt: (tl?.prompt || tl?.meta?.prompt || CANON_PROMPTS.timeline),
        permits_prompt: (pm?.prompt || pm?.meta?.prompt || CANON_PROMPTS.permits),
        pricing_prompt: (pr?.prompt || pr?.meta?.prompt || CANON_PROMPTS.pricing),
      } as const;

      const payload = {
        listing_id: selectedListingId,
        generated_at: new Date().toISOString(),
        prompts,
        tiers: tiersOut,
      };

      if (format === "json") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiers_${selectedListingId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // MD export
      const mdLines: string[] = [];
      mdLines.push(`# Renovation Tiers – Listing ${selectedListingId}`);
      mdLines.push("");
      for (const id of ["livable","comfortable","competitive"]) {
        const t = tiersOut[id];
        mdLines.push(`## ${id.charAt(0).toUpperCase()}${id.slice(1)}`);
        mdLines.push(`- Avg time: ${t.totals.avg_weeks} weeks (${t.totals.avg_months} months)`);
        mdLines.push(`- Avg cost: €${t.totals.avg_cost_eur.toLocaleString()}`);
        mdLines.push("");
        mdLines.push(`### Work Items`);
        for (const it of t.work_items) {
          mdLines.push(`- ${it.name || it.summary} · ${it.requires_permit ? 'Obra mayor' : 'Obra menor'} · ${it.duration_weeks ?? '—'} weeks · €${(it.cost_low_eur||0).toLocaleString()}–€${(it.cost_high_eur||0).toLocaleString()}`);
        }
        mdLines.push("");
        mdLines.push(`### Timeline Phases`);
        for (const ph of (Array.isArray(t.timeline) ? t.timeline : [])) {
          mdLines.push(`- ${ph.name || ph.label}: ${ph.weeks || ph.duration_weeks || ''} ${ph.summary ? `– ${ph.summary}` : ''}`);
        }
        mdLines.push("");
        mdLines.push(`### Permits`);
        for (const p of (Array.isArray(t.permits) ? t.permits : [])) {
          mdLines.push(`- ${p.permit_type || p.name}: ${p.issuing_authority ? `Authority ${p.issuing_authority}` : ''} ${p.expected_time_weeks ? `· ${p.expected_time_weeks} weeks` : ''}`);
        }
        mdLines.push("");
      }
      // Append prompts section
      mdLines.push("\n---\n\n### Prompts (best-effort captured)\n");
      mdLines.push(`- Scope seed prompt:`);
      mdLines.push("\n```\n" + prompts.scope_seed_prompt + "\n```\n");
      mdLines.push(`- Finalize prompt:`);
      mdLines.push("\n```\n" + prompts.finalize_prompt + "\n```\n");
      mdLines.push(`- Timeline prompt:`);
      mdLines.push("\n```\n" + prompts.timeline_prompt + "\n```\n");
      mdLines.push(`- Permits prompt:`);
      mdLines.push("\n```\n" + prompts.permits_prompt + "\n```\n");
      mdLines.push(`- Pricing prompt:`);
      mdLines.push("\n```\n" + prompts.pricing_prompt + "\n```\n");

      const mdBlob = new Blob([mdLines.join('\n')], { type: 'text/markdown' });
      const mdUrl = URL.createObjectURL(mdBlob);
      const a2 = document.createElement('a');
      a2.href = mdUrl;
      a2.download = `tiers_${selectedListingId}.md`;
      a2.click();
      URL.revokeObjectURL(mdUrl);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  // (Removed utility that deleted the last two listings)

  // Hash-based modal opening implementation
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      // Handle buyer report modal: #buyer-report
      if (hash === '#buyer-report') {
        setBuyerReportModalOpen(true);
        return;
      }
      
      // Handle tier modal: #tier=comfortable
      const tierMatch = hash.match(/#tier=([a-z]+)/);
      if (tierMatch && ['livable', 'comfortable', 'competitive'].includes(tierMatch[1])) {
        setActiveTier(tierMatch[1] as any);
        return;
      }
      
      // Handle buyer report modal: #buyer-report or #buyer-report#section-id
      const buyerReportMatch = hash.match(/^#buyer-report(?:#(.+))?$/);
      if (buyerReportMatch) {
        const sectionId = buyerReportMatch[1];
        setBuyerReportModalOpen(true);
        // Scroll to section after modal opens
        if (sectionId) {
          setTimeout(() => {
            const modalContent = document.querySelector('[role="dialog"] [class*="backdrop-blur-xl"][class*="overflow-y-auto"]') as HTMLElement;
            const section = document.querySelector(`#${sectionId}`);
            
            if (section && modalContent) {
              const containerRect = modalContent.getBoundingClientRect();
              const sectionRect = section.getBoundingClientRect();
              const relativeTop = sectionRect.top - containerRect.top + modalContent.scrollTop - 30;
              modalContent.scrollTo({ top: Math.max(0, relativeTop), behavior: 'smooth' });
            } else if (section) {
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 600);
        }
        return;
      }
      
      // Clear active tier if hash is empty
      if (hash === '') {
        setActiveTier(null);
        setBuyerReportModalOpen(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  React.useEffect(() => {
    if (activeTier) {
      window.history.replaceState(null, '', `#tier=${activeTier}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeTier]);

  // Use propertyData directly; PropertyDetails handles skeleton when null
  const sidebarData = propertyData;

  // Dynamic tiers from renovation data
  const tiers = useMemo(() => {
    const tierMap = {
      livable: { name: "Livable", cost: "€25–35k", duration: "2–3 months" },
      comfortable: { name: "Comfortable", cost: "€45–60k", duration: "3–5 months" },
      competitive: { name: "Competitive", cost: "€80–120k", duration: "5–7 months" }
    };

    // Update with real data if available
    renovationTiers.forEach(tier => {
      tierMap[tier.tier_name] = {
        name: tier.tier_name.charAt(0).toUpperCase() + tier.tier_name.slice(1),
        cost: formatCostRange(tier),
        duration: formatTimeRange(tier)
      };
    });

    return tierMap;
  }, [renovationTiers]);

  // Mock tier data for carousels - matching Tier type structure
  const mockTierData = {
    livable: {
      id: "livable" as const,
      name: "Estándar",
      description: "Essential renovations for comfortable living",
      priceRangeEur: "€25k–35k",
      permitDifficulty: "Minor",
      timeEstimate: "2–3 months",
      scope: [
        { id: "kitchen-1", label: "Kitchen renovation", trade: "Kitchen", permitImpact: "minor", time: { min: 2, max: 4 }, cost: { minEur: 15000, maxEur: 20000 }, selected: true },
        { id: "bathroom-1", label: "Bathroom update", trade: "Bathroom", permitImpact: "minor", time: { min: 1, max: 3 }, cost: { minEur: 10000, maxEur: 15000 }, selected: true }
      ],
      costBreakdown: [
        { item: "Kitchen renovation", rangeEur: "€15–20k" },
        { item: "Bathroom update", rangeEur: "€10–15k" }
      ],
      permitChecklist: [
        { step: "Apply for permits", owner: "Owner", duration: "2 weeks", status: "todo" as const },
        { step: "Submit plans", owner: "Architect", duration: "1 week", status: "todo" as const }
      ],
      beforeAfter: [
        { beforeUrl: "", afterUrl: "/images/estandar-after.png", caption: "" }
      ],
      timeline: [
        { name: "Planning", description: "Design and planning phase", duration: "2-4 weeks", status: "todo" as const },
        { name: "Permits", description: "Obtain necessary permits", duration: "4-6 weeks", status: "todo" as const },
        { name: "Construction", description: "Main construction work", duration: "8-12 weeks", status: "todo" as const }
      ],
      permits: [
        { id: "minor-1", name: "Minor works permit", type: "obra-menor", description: "Required for minor renovations", required: true, duration: "2-4 weeks" },
        { id: "electrical-1", name: "Electrical permit", type: "obra-menor", description: "Required for electrical work", required: true, duration: "1-2 weeks" }
      ]
    },
    comfortable: {
      id: "comfortable" as const, 
      name: "Óptimo",
      description: "Comprehensive renovation with modern finishes",
      priceRangeEur: "€45k–60k",
      permitDifficulty: "Major",
      timeEstimate: "3–5 months",
      scope: [
        { id: "full-1", label: "Full renovation", trade: "Masonry/Structural", permitImpact: "major", time: { min: 3, max: 6 }, cost: { minEur: 30000, maxEur: 40000 }, selected: true },
        { id: "finishes-1", label: "Modern finishes", trade: "Finishes", permitImpact: "minor", time: { min: 2, max: 4 }, cost: { minEur: 15000, maxEur: 20000 }, selected: true }
      ],
      costBreakdown: [
        { item: "Full renovation", rangeEur: "€30–40k" },
        { item: "Modern finishes", rangeEur: "€15–20k" }
      ],
      permitChecklist: [
        { step: "Apply for permits", owner: "Owner", duration: "2 weeks", status: "todo" as const },
        { step: "Submit plans", owner: "Architect", duration: "1 week", status: "todo" as const }
      ],
      beforeAfter: [
        { beforeUrl: "", afterUrl: "/images/optimo-after.png", caption: "" }
      ],
      timeline: [
        { name: "Planning", description: "Design and planning phase", duration: "4-6 weeks", status: "todo" as const },
        { name: "Permits", description: "Obtain necessary permits", duration: "6-8 weeks", status: "todo" as const },
        { name: "Construction", description: "Main construction work", duration: "12-16 weeks", status: "todo" as const }
      ],
      permits: [
        { id: "major-1", name: "Major works permit", type: "obra-mayor", description: "Required for major renovations", required: true, duration: "6-8 weeks" },
        { id: "structural-1", name: "Structural permit", type: "obra-mayor", description: "Required for structural changes", required: true, duration: "4-6 weeks" }
      ]
    },
    competitive: {
      id: "competitive" as const,
      name: "Plus",
      description: "Luxury renovation with premium materials",
      priceRangeEur: "€80k–120k",
      permitDifficulty: "Major Structural",
      timeEstimate: "5–7 months",
      scope: [
        { id: "luxury-1", label: "Luxury renovation", trade: "Masonry/Structural", permitImpact: "major_structural", time: { min: 4, max: 8 }, cost: { minEur: 60000, maxEur: 80000 }, selected: true },
        { id: "premium-1", label: "Premium materials", trade: "Finishes", permitImpact: "minor", time: { min: 3, max: 6 }, cost: { minEur: 20000, maxEur: 40000 }, selected: true }
      ],
      costBreakdown: [
        { item: "Luxury renovation", rangeEur: "€60–80k" },
        { item: "Premium materials", rangeEur: "€20–40k" }
      ],
      permitChecklist: [
        { step: "Apply for permits", owner: "Owner", duration: "2 weeks", status: "todo" as const },
        { step: "Submit plans", owner: "Architect", duration: "1 week", status: "todo" as const }
      ],
      beforeAfter: [
        { beforeUrl: "", afterUrl: "/images/plus-after.png", caption: "" }
      ],
      timeline: [
        { name: "Planning", description: "Design and planning phase", duration: "6-8 weeks", status: "todo" as const },
        { name: "Permits", description: "Obtain necessary permits", duration: "8-12 weeks", status: "todo" as const },
        { name: "Construction", description: "Main construction work", duration: "16-20 weeks", status: "todo" as const }
      ],
      permits: [
        { type: "Major structural", required: true, duration: "8-12 weeks" },
        { type: "Architectural", required: true, duration: "6-8 weeks" }
      ]
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Recommendations</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 font-sans selection:bg-stone-200">
      {/* Header */}
      <header className={`sticky top-0 z-40 border-b border-stone-100 bg-[#FDFBF7]/80 backdrop-blur-sm supports-[backdrop-filter]:bg-[#FDFBF7]/60`}
      >
        <div className={`flex ${aiOpen ? '' : ''}`}>
          {/* Left column: Logo and WhatsApp (moved left when sidebar open) */}
          <div className="flex-1 mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-serif text-xl font-medium tracking-tight text-stone-900 hidden md:block">Leo.casa</span>
                <div className="h-6 w-px bg-stone-200 hidden md:block"></div>
                <div className="flex items-center gap-3">
                  <img
                    src={agentLogoUrl || '/favicon.png'}
                    alt={agentName || 'Agent'}
                    className="h-10 w-auto max-h-10 rounded-full object-contain border border-stone-100 bg-white p-0.5"
                  />
                  <div className="font-medium text-sm">{agentName || 'Agent'}</div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {aiOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const num = agentWhatsapp || '';
                      const href = num ? `https://wa.me/${num.replace(/\D/g, '')}` : 'https://wa.me/';
                      window.open(href, '_blank');
                    }}
                    className="bg-[#25d366] hover:bg-[#20bd5a] text-white border-transparent hover:border-transparent rounded-full shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                )}
                {!aiOpen && (
                  <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAiOpen(!aiOpen);
                    }}
                    disabled={suggestionsLoading}
                    className={`relative rounded-full border-stone-200 hover:bg-stone-100 hover:text-stone-900 ${initialSuggestions.length > 0 ? 'border-stone-300' : ''}`}
                  >
                    <Sparkles className="h-4 w-4 mr-2 text-[#da654d]" />
                    Ask AI
                    {suggestionsLoading ? (
                      <span className="ml-2 h-2 w-2 rounded-full bg-stone-200 animate-pulse" />
                    ) : initialSuggestions.length > 0 ? (
                      <span className="ml-2 h-2 w-2 rounded-full bg-[#da654d] animate-pulse" />
                    ) : null}
                  </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const num = agentWhatsapp || '';
                        const href = num ? `https://wa.me/${num.replace(/\D/g, '')}` : 'https://wa.me/';
                        window.open(href, '_blank');
                      }}
                      className="bg-[#25d366] hover:bg-[#20bd5a] text-white border-transparent hover:border-transparent rounded-full shadow-sm"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Right column: Chat header (only when sidebar is open) */}
          {aiOpen && (
            <div className="w-[90vw] sm:w-[360px] border-l border-stone-100 bg-[#FDFBF7] flex-none">
              <div className="flex items-center justify-between h-16 px-3 sm:px-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-[#da654d]" />
                  <span>Ask AI</span>
                  {suggestionsLoading ? (
                    <span className="h-2 w-2 rounded-full bg-stone-200 animate-pulse" />
                  ) : initialSuggestions.length > 0 ? (
                    <span className="h-2 w-2 rounded-full bg-[#da654d] animate-pulse" />
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('copy-ai-chat'));
                      setCopyAllClicked(true);
                      setTimeout(() => setCopyAllClicked(false), 2000);
                    }}
                    className="h-8 w-8 p-0 hover:bg-stone-100"
                    aria-label="Copy all chat"
                  >
                    {copyAllClicked ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('clear-ai-chat'));
                    }}
                    className="h-8 w-8 p-0 hover:bg-stone-100"
                    aria-label="Clear chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiOpen(false)}
                    className="h-8 w-8 p-0 hover:bg-stone-100"
                    aria-label="Hide AI sidebar"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className={`mx-auto max-w-7xl px-4 sm:px-6 xl:px-12 py-8 ${aiOpen ? 'xl:mr-[360px]' : ''}`}>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Property Details - Above 2min summary on mobile, sticky sidebar on desktop */}
          <div className="xl:col-span-4 xl:order-1 order-1 xl:sticky xl:top-8 xl:self-start">
            <PropertyDetails 
              data={sidebarData} 
              onAnalysisClick={() => setBuyerReportModalOpen(true)}
              onPhotoClick={(index) => console.log('Photo clicked:', index)}
            />
          </div>
          
          {/* Main content area */}
          <div className="xl:col-span-8 space-y-8 xl:order-2 order-2">
            {/* Viewing Checklist */}
            <section className="space-y-4">
              {selectedListingId ? (
                <ViewingChecklist
                  listingId={selectedListingId}
                  agentWhatsapp={agentWhatsapp}
                  onViewAnalysis={() => setBuyerReportModalOpen(true)}
                  onItemClick={(anchor) => {
                    setBuyerReportModalOpen(true);
                    // Scroll to anchor in buyer report modal after it opens
                            setTimeout(() => {
                      const modalContent = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]') as HTMLElement;
                      const section = document.querySelector(`#${anchor}`);
                              
                              if (section && modalContent) {
                                const containerRect = modalContent.getBoundingClientRect();
                                const sectionRect = section.getBoundingClientRect();
                                const relativeTop = sectionRect.top - containerRect.top + modalContent.scrollTop - 30;
                                modalContent.scrollTo({ top: Math.max(0, relativeTop), behavior: 'smooth' });
                              } else if (section) {
                                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }, 600);
                          }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Selecciona una propiedad para ver la lista de verificación.
                          </div>
              )}
            </section>

            {/* Renovation Tiers */}
            <section id="renovation-ideas" className="space-y-6">
              <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight italic">Renovation Ideas...</h2>
                <p className="text-muted-foreground mt-1">We're suggesting renovation ideas with prices to help you imagine what's possible</p>
                </div>
                {selectedListingId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPersonaliseModalOpen(true)}
                    className="ml-4"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Personalise
                  </Button>
                )}
              </div>
              {selectedListingId ? (
                <TierCards
                  listingId={selectedListingId}
                  onTierClick={(tier) => {
                    const tierMap: Record<'estandar' | 'optimo' | 'plus', 'livable' | 'comfortable' | 'competitive'> = {
                      estandar: 'livable',
                      optimo: 'comfortable',
                      plus: 'competitive'
                    };
                    setActiveTier(tierMap[tier]);
                    window.location.hash = `#tier=${tierMap[tier]}`;
                  }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Selecciona una propiedad para ver las opciones de renovación.
                        </div>
              )}
            </section>

          </div>
        </div>
      </main>

      {/* Renovation Tier Modal */}
      {activeTier && (
        <RenovationTierModal
          open={!!activeTier}
          onOpenChange={(v) => !v && setActiveTier(null)}
          tierLabel={activeTier === "livable" ? "Livable" : activeTier === "comfortable" ? "Comfortable" : "Competitive"}
          tierData={(getTierByName(renovationTiers, activeTier) || mockTierData[activeTier]) as any}
          listingPhotos={listingPhotos}
          listingId={selectedListingId}
        />
      )}

      {/* Buyer Report Modal */}
      <BuyerReportModal
        listingId={selectedListingId || ''}
        open={buyerReportModalOpen}
        onOpenChange={(open) => {
          setBuyerReportModalOpen(open);
          if (!open) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        listingMetadata={sidebarData ? {
          title: sidebarData.title,
          price: sidebarData.price,
          size: sidebarData.constructedArea || sidebarData.usefulArea,
          bedrooms: sidebarData.bedrooms,
          bathrooms: sidebarData.bathrooms,
          location: sidebarData.address
        } : undefined}
      />

      {/* Personalise Renovation Modal */}
      {selectedListingId && (
        <PersonaliseRenovationModal
          open={personaliseModalOpen}
          onOpenChange={setPersonaliseModalOpen}
          listingId={selectedListingId}
          onStrategiesGenerated={() => {
            // Real-time subscriptions will update the UI automatically
            // No need to reload the page
            console.log('Renovation generation started, watching for updates...');
          }}
        />
      )}

      {/* AI Sidebar */}
            <AISidebar
              open={aiOpen}
              onOpenChange={setAiOpen}
              listingId={selectedListingId}
              initialSuggestions={initialSuggestions}
              afterPhotos={afterPhotos}
              tierInfo={{
                livable: tiers.livable ? { name: tiers.livable.name, priceRange: tiers.livable.cost } : undefined,
                comfortable: tiers.comfortable ? { name: tiers.comfortable.name, priceRange: tiers.comfortable.cost } : undefined,
                competitive: tiers.competitive ? { name: tiers.competitive.name, priceRange: tiers.competitive.cost } : undefined,
              }}
              agentWhatsapp={agentWhatsapp}
              onOpenAnalysisModal={(sectionId) => {
                setBuyerReportModalOpen(true);
                // Scroll to section in modal after it opens
                if (sectionId) {
                  // Wait for modal to render, then scroll within the modal's content container
                  setTimeout(() => {
                    // Find the modal's scrollable content container (backdrop-blur-xl with overflow-y-auto)
                    const modalContent = document.querySelector('[role="dialog"] [class*="backdrop-blur-xl"][class*="overflow-y-auto"]') as HTMLElement;
                    const section = document.querySelector(`#${sectionId}`);
                    
                    if (section && modalContent) {
                      // Calculate scroll position within the modal container
                      const containerRect = modalContent.getBoundingClientRect();
                      const sectionRect = section.getBoundingClientRect();
                      const relativeTop = sectionRect.top - containerRect.top + modalContent.scrollTop - 30; // 30px offset
                      
                      modalContent.scrollTo({ top: Math.max(0, relativeTop), behavior: 'smooth' });
                    } else if (section) {
                      // Fallback: scroll section into view (if modal container not found)
                      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 600); // Wait for modal to fully render and open
                }
              }}
            />
      
      {/* Footer */}
      <footer className="w-full border-t border-stone-100 bg-white mt-16 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif text-xl font-medium tracking-tight text-stone-900">Leo.casa</span>
          </div>
          <p className="text-sm text-stone-500">
            © 2025 Leo.casa — Your AI Home Advisor. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}


