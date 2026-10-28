"use client";

import * as React from "react";
// remove framer-motion imports (not used after simplification)
// import { motion, AnimatePresence } from "framer-motion";
import { Expand, Clock, ChevronRight, ArrowDown, Shrink, CheckCircle2, AlertTriangle, Languages, ClipboardList, Heart, Share2 } from "lucide-react";
// remove mock import; main slider must be DB-backed
// import dataJson from "@/data/mockRenovation.json";
import type { RenovationData, Tier, TierId, ProcessStep, ScopeItem, PermitType, MonthRange, MoneyRange, Trade } from "@/types/renovation";
import { BeforeAfter } from "@/components/BeforeAfter";
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/supabase';

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  // Accept props for future API binding; for now we use the mock
  listing?: any;
  analysis?: any;
  dataOverride?: RenovationData;
  // NEW: favorites integration from parent (EarthClient)
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  // NEW: listingId for after photos
  listingId?: string;
};

// remove MOCK; rely on DB data
// const MOCK: RenovationData = dataJson as unknown as RenovationData;
const DEFAULT_OPEN: TierId = "livable";

export default function RenovationSlider({ dataOverride, listing, isFavorited, onToggleFavorite, analysis, listingId }: Props) {
  // Prefer DB-backed final scope for tiers if listingId provided
  const [dbData, setDbData] = React.useState<RenovationData | undefined>(undefined);
  const [permitsByTier, setPermitsByTier] = React.useState<Record<TierId, Array<{
    permit_type: string;
    why_needed: string;
    documentation_required: string[];
    issuing_authority: string;
    expected_time_weeks: number;
    common_pitfalls: string[];
    sources?: string[];
  }>> | undefined>(undefined);

  const data = (dbData ?? dataOverride ?? (analysis as RenovationData | undefined)) as RenovationData | undefined;
  const [active, setActive] = React.useState<TierId | null>(DEFAULT_OPEN);
  const [fullscreen, setFullscreen] = React.useState(false);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  // Ensure only three unique, ordered tiers are shown
  const TIER_ORDER: TierId[] = ["livable", "comfortable", "competitive"];
  const tiersRaw = Array.isArray(data?.tiers) ? (data!.tiers as Tier[]) : [];
  const tiers = Array.isArray(data?.tiers) ? data!.tiers : [];
  const activeTier = tiers.find((t) => t.id === active) || null;
  const firstTierId = tiers[0]?.id as TierId | undefined;
  const lastTierId = tiers[tiers.length - 1]?.id as TierId | undefined;
  // Ensure only three tabs are shown in a fixed order (dedupe by id)
  const tabOrder: TierId[] = ["livable", "comfortable", "competitive"];
  const tierTabs: Tier[] = tabOrder
    .map((id) => tiers.find((t) => t.id === id))
    .filter(Boolean) as Tier[];

  React.useEffect(() => {
    console.debug("[RenovationSlider] mount", { tiers: tiers.map(t => t.id) });
  }, []);
  React.useEffect(() => {
    console.debug("[RenovationSlider] state", { active, tiers: tiers.map(t => t.id) });
  }, [active, tiers]);

  // Fetch final scope (UI source of truth) and map to RenovationData.tiers
  React.useEffect(() => {
    if (!listingId) return;
    let cancelled = false;

    const mapSpanishToUi: Record<string, TierId> = {
      estandar: "livable",
      optimo: "comfortable",
      plus: "competitive",
    };

    async function load() {
      try {
        const { data: fs, error } = await supabase
          .from('final_renovation_scope')
          .select('scope_data')
          .eq('listing_id', listingId)
          .single();
        if (error || !fs?.scope_data) return;
        const sd = fs.scope_data as any;
        const tiersArr: Tier[] = ["estandar","optimo","plus"].map((k) => {
          const ui = mapSpanishToUi[k] as TierId;
          const t = sd.tiers?.[k] || {};
          const items = Array.isArray(t.work_items) ? t.work_items : [];
          const scopeItems: ScopeItem[] = items.map((it: any, i: number) => ({
            id: `${ui}-${it.id || i}`,
            label: it.name || it.summary || `Item ${i+1}`,
            trade: (it.category || 'Finishes') as any,
            permitImpact: it.requires_permit ? 'major' : 'minor',
            time: { min: Math.max(0.2, (it.duration_weeks || 4) / 4.3 * 0.7), max: Math.max(0.3, (it.duration_weeks || 4) / 4.3 * 1.3) },
            cost: { minEur: Math.max(0, it.cost_low_eur || 0), maxEur: Math.max(it?.cost_low_eur || 0, it.cost_high_eur || 0) },
            selected: true,
          }));
          const total = Array.isArray(t.total_estimate_range_eur) ? t.total_estimate_range_eur : undefined;
          return {
            id: ui,
            name: ui === 'livable' ? 'Estándar' : ui === 'comfortable' ? 'Óptimo' : 'Plus',
            description: t.description || sd?.description || '',
            scopeItems,
            // keep existing image wiring; before/after handled elsewhere
          } as unknown as Tier;
        });
        if (!cancelled) {
          setDbData({
            property: { address: (listing as any)?.address || '' } as any,
            tiers: tiersArr.filter(Boolean) as any,
          } as RenovationData);
        }
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, [listingId]);

  // Fetch permits report (canonical) and expose per-tier to PermitDetailsCards
  React.useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    async function loadPermits() {
      try {
        const { data: row } = await supabase
          .from('renovation_permits_reports')
          .select('report_data')
          .eq('listing_id', listingId)
          .single();
        const report = (row as any)?.report_data;
        if (report && Array.isArray(report.permits)) {
          // Permits are not tier-tagged in report_data; show same canonical list for each tier
          const map: Record<TierId, any[]> = { livable: report.permits, comfortable: report.permits, competitive: report.permits } as any;
          if (!cancelled) setPermitsByTier(map);
          return;
        }
        // If missing, try on-demand generation (non-blocking UI)
        fetch(`/api/listings/${listingId}/renovation-permits`, { method: 'POST' }).catch(() => {});
      } catch {}
    }
    loadPermits();
    return () => { cancelled = true; };
  }, [listingId]);

  // Fetch timeline report (canonical) and expose per-tier to TierTimeline
  const [timelineByTier, setTimelineByTier] = React.useState<Record<TierId, Array<{ label: string; weeks: number; subtitle?: string }>>>({ livable: [], comfortable: [], competitive: [] });
  React.useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    async function loadTimeline() {
      try {
        const { data: row } = await supabase
          .from('renovation_timeline_reports')
          .select('report_data')
          .eq('listing_id', listingId)
          .single();
        const report = (row as any)?.report_data;
        if (!report) return;
        // Flexible mapping: accept either per-tier arrays or a single canonical array
        const get = (k: string) =>
          (report?.tiers?.[k]?.phases || report?.[k]?.phases || report?.[k] || report?.phases || []) as Array<any>;
        const mapPh = (arr: any[]) =>
          (Array.isArray(arr) ? arr : []).map((p: any) => ({ label: String(p.name || p.label || p.phase || "Phase"), weeks: Number(p.weeks || p.duration_weeks || p.duration || 0), subtitle: p.summary || p.description || undefined }));
        const mapped: Record<TierId, any[]> = {
          livable: mapPh(get('estandar')),
          comfortable: mapPh(get('optimo')),
          competitive: mapPh(get('plus')),
        };
        if (!cancelled) setTimelineByTier(mapped);
      } catch {
        // Non-blocking; UI falls back to computed timeline
      }
    }
    loadTimeline();
    return () => { cancelled = true; };
  }, [listingId]);

  const address =
    data?.property?.address ||
    "Address unavailable";

  // Derive city dynamically (no hardcoded defaults)
  const derivedCity = (data as any)?.property?.city || (listing as any)?.city || (listing as any)?.region || "";

  // Share button state/handler
  const [copied, setCopied] = React.useState(false);
  const handleShare = async () => {
    try {
      const url = window.location.href;
      const title = address;
      if ((navigator as any).share) {
        await (navigator as any).share({ title, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // // If no data from DB yet, render a lightweight placeholder
  // // if (!data) {
  // //   return (
  // //     <div className="w-full h-full min-h-0 max-h-full overflow-y-auto pr-1">
  // //       <Card className="m-4">
  // //         <CardContent className="py-6 text-sm text-muted-foreground">
  // //           No analysis data available. Ensure the listing's Renovation analysis is seeded and try again.
  // //         </CardContent>
  // //       </Card>
  // //     </div>
  // //   );
  // // }

  // NEW: selection state per tier for scope matrix rows
  const [selection, setSelection] = React.useState<Record<TierId, Record<string, boolean>>>(() => ({
    livable: {},
    comfortable: {},
    competitive: {}
  }));
  function setTierSelection(tierId: TierId, rows: ScopeItem[]) {
    setSelection((prev) => ({
      ...prev,
      [tierId]: Object.fromEntries(rows.map((r) => [r.id, !!r.selected]))
    }));
  }
  // helper: derive scope items from legacy scope strings when scopeItems missing
  function deriveScopeItems(tier: Tier): ScopeItem[] {
    if (tier.scopeItems && tier.scopeItems.length) return tier.scopeItems;
    const guessTrade = (label: string): Trade => {
      const s = label.toLowerCase();
      if (s.includes("bath")) return "Bathroom";
      if (s.includes("kitchen")) return "Kitchen";
      if (s.includes("window") || s.includes("insulat")) return "Windows/Insulation";
      if (s.includes("hvac") || s.includes("heating") || s.includes("air")) return "HVAC";
      if (s.includes("plumb")) return "Plumbing";
      if (s.includes("elect")) return "Electrical";
      if (s.includes("demol")) return "Demolition";
      if (s.includes("struct") || s.includes("wall")) return "Masonry/Structural";
      return "Finishes";
    };
    const guessPermit = (label: string): PermitType => {
      const s = label.toLowerCase();
      if (s.includes("struct") || s.includes("load") || s.includes("wall")) return "major_structural";
      if (s.includes("major")) return "major";
      if (s.includes("permit") || s.includes("license")) return "minor";
      return "minor";
    };
    // If legacy scope strings exist, map them
    const legacy = (tier.scope || []).map((label, i) => ({
      id: `${tier.id}-row-${i}`,
      label,
      trade: guessTrade(label),
      permitImpact: guessPermit(label),
      time: { min: 0.3, max: 0.8 },
      cost: { minEur: 5000, maxEur: 15000 },
      selected: true
    }));
    if (legacy.length) return legacy;

    // Fallback defaults when no scope is provided from API
    const fallbackByTier: Record<TierId, Array<{ label: string; trade: Trade; permit: PermitType; time: MonthRange; cost: MoneyRange }>> = {
      livable: [
        { label: "Paint whole apartment", trade: "Finishes", permit: "minor", time: { min: 0.3, max: 0.6 }, cost: { minEur: 2500, maxEur: 4500 } },
        { label: "Replace light fixtures + outlets", trade: "Electrical", permit: "minor", time: { min: 0.2, max: 0.5 }, cost: { minEur: 1500, maxEur: 3500 } },
        { label: "Deep clean + minor repairs", trade: "Finishes", permit: "none", time: { min: 0.2, max: 0.4 }, cost: { minEur: 800, maxEur: 1500 } },
        { label: "Service HVAC / AC split", trade: "HVAC", permit: "minor", time: { min: 0.2, max: 0.5 }, cost: { minEur: 1200, maxEur: 2500 } }
      ],
      comfortable: [
        { label: "Refresh kitchen fronts + appliances", trade: "Kitchen", permit: "minor", time: { min: 0.8, max: 1.5 }, cost: { minEur: 8000, maxEur: 15000 } },
        { label: "Renovate 2 bathrooms (non‑structural)", trade: "Bathroom", permit: "major", time: { min: 1.0, max: 2.0 }, cost: { minEur: 12000, maxEur: 22000 } },
        { label: "New flooring throughout", trade: "Finishes", permit: "minor", time: { min: 0.8, max: 1.2 }, cost: { minEur: 6000, maxEur: 11000 } },
        { label: "Upgrade electrical panel", trade: "Electrical", permit: "major", time: { min: 0.4, max: 0.8 }, cost: { minEur: 2500, maxEur: 5000 } }
      ],
      competitive: [
        { label: "Open plan living (non‑load‑bearing walls)", trade: "Masonry/Structural", permit: "major", time: { min: 1.5, max: 3.0 }, cost: { minEur: 10000, maxEur: 20000 } },
        { label: "New custom kitchen", trade: "Kitchen", permit: "major", time: { min: 1.0, max: 2.0 }, cost: { minEur: 15000, maxEur: 30000 } },
        { label: "Window upgrade + insulation", trade: "Windows/Insulation", permit: "major", time: { min: 0.8, max: 1.5 }, cost: { minEur: 8000, maxEur: 16000 } },
        { label: "HVAC full replacement", trade: "HVAC", permit: "major", time: { min: 0.8, max: 1.2 }, cost: { minEur: 9000, maxEur: 16000 } }
      ]
    } as const;

    const fallback = (fallbackByTier[tier.id] || fallbackByTier["livable"]).map((f, i) => ({
      id: `${tier.id}-fb-${i}`,
      label: f.label,
      trade: f.trade,
      permitImpact: f.permit,
      time: f.time,
      cost: f.cost,
      selected: true
    }));
    return fallback;
  }
  function applySelection(tier: Tier): ScopeItem[] {
    const base = deriveScopeItems(tier);
    const map = selection[tier.id] || {};
    return base.map((r) => ({ ...r, selected: map[r.id] ?? true }));
  }

  // NEW: favorites view + local favorite toggle
  const [view, setView] = React.useState<"main" | "favorites">("main");
  // Local mirror only used when parent doesn't provide a value
  const [localFav, setLocalFav] = React.useState(false);
  React.useEffect(() => {
    if (typeof isFavorited === "boolean") setLocalFav(isFavorited);
  }, [isFavorited]);
  const isFav = typeof isFavorited === "boolean" ? isFavorited : localFav;

  React.useEffect(() => {
    const isFavHash = (hash: string) => {
      const h = (hash || "").toLowerCase();
      return h === "#favorites" || h === "#favorite" || h === "#favourites" || h === "#favourite" || h === "#fav";
    };
    const isFavQuery = () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        const v = (sp.get("tab") || sp.get("view") || "").toLowerCase();
        return v === "favorites" || v === "favorite" || v === "favourites" || v === "favourite" || v === "fav";
      } catch {
        return false;
      }
    };
    const apply = () => setView(isFavHash(window.location.hash) || isFavQuery() ? "favorites" : "main");

    const onHash = () => apply();
    const onNav = () => apply();
    const onOpen = () => {
      if (!isFavHash(window.location.hash)) {
        try {
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}#favorites`);
        } catch {}
      }
      setView("favorites");
    };
    const onTab = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const str = typeof d === "string" ? d : JSON.stringify(d || "");
      if (str && str.toLowerCase().includes("favorit")) onOpen();
    };

    // Patch History API once so SPA navigations are detected
    try {
      const w = window as any;
      if (!w.__favoritesHistoryPatched) {
        w.__favoritesHistoryPatched = true;
        const ps = history.pushState;
        const rs = history.replaceState;
        history.pushState = function (this: History, ...args: any[]) {
          const ret = ps.apply(this, args as any);
          window.dispatchEvent(new Event("pushstate"));
          window.dispatchEvent(new Event("locationchange"));
          return ret;
        } as typeof history.pushState;
        history.replaceState = function (this: History, ...args: any[]) {
          const ret = rs.apply(this, args as any);
          window.dispatchEvent(new Event("replacestate"));
          window.dispatchEvent(new Event("locationchange"));
          return ret;
        } as typeof history.replaceState;
        window.addEventListener("popstate", () => window.dispatchEvent(new Event("locationchange")));
      }
    } catch {}

    apply();
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onNav);
    window.addEventListener("pushstate", onNav as EventListener);
    window.addEventListener("replacestate", onNav as EventListener);
    window.addEventListener("locationchange", onNav as EventListener);
    // Support custom events from an external Favorites tab trigger
    window.addEventListener("open-favorites", onOpen as EventListener);
    window.addEventListener("favorites:open", onOpen as EventListener);
    window.addEventListener("tabchange", onTab as EventListener);
    window.addEventListener("tab:change", onTab as EventListener);

    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("pushstate", onNav as EventListener);
      window.removeEventListener("replacestate", onNav as EventListener);
      window.removeEventListener("locationchange", onNav as EventListener);
      window.removeEventListener("open-favorites", onOpen as EventListener);
      window.removeEventListener("favorites:open", onOpen as EventListener);
      window.removeEventListener("tabchange", onTab as EventListener);
      window.removeEventListener("tab:change", onTab as EventListener);
    };
  }, []);

  // New: compute single-value summaries for tab display
  const formatTierAvgCost = (tier: Tier) => {
    const items = deriveScopeItems(tier);
    const total = items.reduce((a, b) => a + (b.cost.minEur + b.cost.maxEur) / 2, 0);
    let k = Math.round(total / 1000);
    if (k <= 0) {
      const fallback: Record<TierId, number> = { livable: 4, comfortable: 8, competitive: 12 };
      k = fallback[tier.id] ?? 4;
    }
    return `€${k}k`;
  };
  const formatTierAvgTime = (tier: Tier) => {
    const items = deriveScopeItems(tier);
    const months = items.reduce((a, b) => a + (b.time.min + b.time.max) / 2, 0);
    const m = Math.max(1, Math.round(months));
    return `${m} months`;
  };

  // Helpers for Favorites card ranges and image
  const livableTier = tiers.find((t) => t.id === "livable") || tiers[0];
  const competitiveTier = tiers.find((t) => t.id === "competitive") || tiers[tiers.length - 1];
  const avgMonths = (tier?: Tier) => {
    if (!tier) return 0;
    const items = deriveScopeItems(tier);
    return items.reduce((a, b) => a + (b.time.min + b.time.max) / 2, 0);
  };
  const avgCostK = (tier?: Tier) => {
    if (!tier) return 0;
    const items = deriveScopeItems(tier);
    return Math.round(items.reduce((a, b) => a + (b.cost.minEur + b.cost.maxEur) / 2, 0) / 1000);
  };
  const favTimeRange = `${Math.max(1, Math.round(avgMonths(livableTier)))}–${Math.max(1, Math.round(avgMonths(competitiveTier)))} mo`;
  const favCostRange = `€${avgCostK(livableTier)}k–€${avgCostK(competitiveTier)}k`;
  const beforeImage = (livableTier?.beforeAfter?.[0]?.beforeUrl)
    || (competitiveTier?.beforeAfter?.[0]?.beforeUrl)
    || undefined;

  // Prevent body scroll while fullscreen is open
  React.useEffect(() => {
    if (!fullscreen) return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevDoc = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevDoc;
    };
  }, [fullscreen]);

  // a11y: close fullscreen with ESC
  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // a11y: lightweight focus trap while fullscreen is open
  React.useEffect(() => {
    if (!fullscreen) return;
    const root = overlayRef.current;
    if (!root) return;
    const prevActive = document.activeElement as HTMLElement | null;
    // Focus the dialog container itself
    root.focus();

    const focusableSelector = [
    'a[href]',
    'area[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[tabindex]:not([tabindex="-1"])'].join(',');

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => el.offsetParent !== null || el === root);
      if (focusables.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!current || current === first || !root.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!current || current === last || !root.contains(current)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    root.addEventListener('keydown', onKeydown);
    return () => {
      root.removeEventListener('keydown', onKeydown);
      if (prevActive && typeof prevActive.focus === 'function') {
        try {prevActive.focus();} catch {}
      }
    };
  }, [fullscreen]);

  const toggleTier = (id: TierId) => {
    setActive((cur) => {
      const next = cur === id ? null : id;
      console.debug("[RenovationSlider] toggle tier", { id, previous: cur, next });
      return next;
    });
    // Smooth-scroll to the Renovation Scenarios header
    const el = document.getElementById("tiers");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  if (!data) {
    return (
      <div className="w-full h-full min-h-0 max-h-full overflow-y-auto pr-1">
        <Card className="m-4">
          <CardContent className="py-6 text-sm text-muted-foreground">
            No analysis data available. Ensure the listing's Renovation analysis is seeded and try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 max-h-full overflow-y-auto pr-1 space-y-8">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Renovation Deep-Dive</div>
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xl font-semibold tracking-tight truncate">{address}</h2>
            <Button
              size="icon"
              variant="ghost"
              className={"h-8 w-8"}
              aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
              onClick={() => (onToggleFavorite ? onToggleFavorite() : setLocalFav((v) => !v))}
            >
              <Heart className={cn("h-4 w-4", isFav ? "text-rose-500 fill-rose-500" : "text-foreground/80")} />
            </Button>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleShare} className="gap-1">
            <Share2 className="h-4 w-4" /> {copied ? "Copied" : "Share"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFullscreen(true)} className="gap-1">
            <Expand className="h-4 w-4" /> Fullscreen
          </Button>
        </div>
      </div>

      {view === "favorites" ? (
        <section aria-labelledby="favorites">
          {isFav ? (
            <button
              type="button"
              className="w-full text-left"
              onClick={() => { setView("main"); try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {} }}
            >
              <Card className="border-border/70 hover:bg-accent/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {beforeImage ? (
                      <img src={beforeImage} alt="Before renovation" className="h-24 w-32 rounded-md object-cover border" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Favorited Listing</div>
                      <div className="mt-0.5 text-base font-semibold truncate">{address}</div>
                      <div className="mt-2 text-sm text-muted-foreground">Time (Livable–Competitive): {favTimeRange}</div>
                      <div className="text-sm text-muted-foreground">Cost (Livable–Competitive): {favCostRange}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ) : (
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle id="favorites" className="text-sm font-semibold tracking-wider text-muted-foreground">FAVORITES · RENOVATION</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>No favorites yet. Tap the heart next to the address to add this listing.</p>
                <div>
                  <Button size="sm" onClick={() => { setView("main"); try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {} }}>Back to Deep-Dive</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      ) : (
        <>
          {/* 1) Technical Report */}
          <section aria-labelledby="tech-state">
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle id="tech-state" className="text-sm font-semibold tracking-wider text-muted-foreground">TODAY'S STATE · TECHNICAL REPORT</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <ul className="space-y-1 text-sm">
                  <li><span className="text-muted-foreground">Structure:</span> {data.technicalReport.structure}</li>
                  <li><span className="text-muted-foreground">Electrical:</span> {data.technicalReport.electrical}</li>
                  <li><span className="text-muted-foreground">Plumbing:</span> {data.technicalReport.plumbing}</li>
                </ul>
                <ul className="space-y-1 text-sm">
                  <li><span className="text-muted-foreground">Windows:</span> {data.technicalReport.windows}</li>
                  <li><span className="text-muted-foreground">Energy rating:</span> {data.technicalReport.energyRating}</li>
                  <li><span className="text-muted-foreground">Permits likely:</span> {data.technicalReport.permitsLikely}</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* 2) Tiers Row */}
          <section aria-labelledby="tiers">
            <div className="mb-3 flex items-center gap-2">
              <h3 id="tiers" className="text-base font-semibold">Renovation Scenarios</h3>
              {/* remove helper text */}
            </div>

            <Tabs
              value={active ?? tierTabs[0]?.id}
              onValueChange={(v) => {
                setActive(v as any);
                const el = document.getElementById("reno-panel");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mt-0">
              <TabsList className="sticky top-0 z-20 relative flex flex-wrap px-1.5 py-1.5 list-none rounded-md bg-slate-100 w-full border-b border-border/60">
                {tierTabs.map((tier) => (
                  <TabsTrigger 
                    key={tier.id} 
                    value={tier.id} 
                    className="z-30 flex flex-col items-center justify-center flex-1 w-full px-0 py-2 text-sm mb-0 transition-all ease-in-out border-0 rounded-md cursor-pointer text-slate-600 bg-inherit data-[state=active]:bg-white data-[state=active]:text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium truncate">{(({ livable: "Livable", comfortable: "Comfortable", competitive: "Competitive" } as Record<string, string>))[tier.id] ?? tier.name}</span>
                    </div>
                    <div className="mt-1 text-xl font-bold leading-tight tracking-tight break-words">{formatTierAvgCost(tier)}</div>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 shrink-0"><Clock className="h-3.5 w-3.5" /> {formatTierAvgTime(tier)}</span>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
              <Card id="reno-panel" className="">
                <CardContent className="p-0">
                  {tierTabs.map((tier) => (
                    <TabsContent key={tier.id} value={tier.id} className="m-0">
                      <TierDetail
                        mode="normal"
                        tier={tier}
                        items={applySelection(tier)}
                        onChange={(next) => setTierSelection(tier.id, next)}
                        city={derivedCity}
                        listingId={listingId}
                        externalPermits={permitsByTier?.[tier.id] as any}
                        externalTimeline={timelineByTier}
                      />
                    </TabsContent>
                  ))}
                </CardContent>
              </Card>
            </Tabs>
          </section>

        </>
      )}

      {/* Fullscreen overlay */}
      {fullscreen &&
      <div
        className="fixed inset-0 z-[10000] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        ref={overlayRef}
        tabIndex={-1}>

          <div className="min-h-full snap-y snap-mandatory">
            {/* Top bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 backdrop-blur px-4 py-3">
              <div className="text-sm font-medium">Renovation · Fullscreen</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-1">
                  <Share2 className="h-4 w-4" /> {copied ? "Copied" : "Share"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setFullscreen(false)} className="gap-1">
                  <Shrink className="h-4 w-4" /> Close
                </Button>
              </div>
            </div>

            {/* Sections (100vh each) */}
            <div className="min-h-screen snap-start p-6 flex items-center justify-center">
              {/* Tech report card */}
              <Card className="max-w-3xl w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground">TODAY'S STATE · TECHNICAL REPORT</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <ul className="space-y-1 text-sm">
                    <li><span className="text-muted-foreground">Structure:</span> {data.technicalReport.structure}</li>
                    <li><span className="text-muted-foreground">Electrical:</span> {data.technicalReport.electrical}</li>
                    <li><span className="text-muted-foreground">Plumbing:</span> {data.technicalReport.plumbing}</li>
                  </ul>
                  <ul className="space-y-1 text-sm">
                    <li><span className="text-muted-foreground">Windows:</span> {data.technicalReport.windows}</li>
                    <li><span className="text-muted-foreground">Energy rating:</span> {data.technicalReport.energyRating}</li>
                    <li><span className="text-muted-foreground">Permits likely:</span> {data.technicalReport.permitsLikely}</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Tiers section */}
            <div className="min-h-screen snap-start p-6">
              <div className="mb-4">
                <h3 id="tiers" className="text-base font-semibold">Renovation Scenario</h3>
              </div>
              {(activeTier || tiers[0]) ? (
                <Card className="border">
                  <CardContent className="p-0">
                    <TierDetail
                      mode="fullscreen"
                      tier={(activeTier || tiers[0]) as Tier}
                      items={applySelection((activeTier || tiers[0]) as Tier)}
                      onChange={(next) => setTierSelection(((activeTier || tiers[0]) as Tier).id, next)}
                      city={derivedCity}
                      listingId={listingId}
                      externalPermits={permitsByTier?.[((activeTier || tiers[0]) as Tier).id] as any}
                      externalTimeline={timelineByTier}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No scenarios available.
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Experience section removed by request */}
            
          </div>
        </div>
      }

    </div>);

}

/* ---------- Subcomponents ---------- */

export function TierBeforeAfterCarousel({ 
  tier, 
  beforePhotos, 
  listingId,
  onClusterNameChange,
  currentClusterName
}: {
  tier: Tier; 
  beforePhotos?: string[]; 
  listingId?: string;
  onClusterNameChange?: (clusterName: string | null) => void;
  currentClusterName?: string | null;
}) {
  // If listing photos provided, map them as before images; pair with tier's first after image
  const afterFallback = (Array.isArray(tier.beforeAfter) && tier.beforeAfter[0]?.afterUrl) || "";
  const [index, setIndex] = React.useState(0);
  const [afterIndex, setAfterIndex] = React.useState(0); // New state for after photo selection
  const [afterUrls, setAfterUrls] = React.useState<string[]>([]); // State for fetched after photos
  const [afterByIndex, setAfterByIndex] = React.useState<Record<number, string>>({}); // index (display_order) -> url
  const [clusterNames, setClusterNames] = React.useState<string[]>([]); // State for cluster names (one per photo)
  const [clusterIds, setClusterIds] = React.useState<string[]>([]); // State for cluster IDs (one per photo)
  const [filteredBeforePhotos, setFilteredBeforePhotos] = React.useState<string[]>([]); // Filtered photos (clustered, no floor plans)
  const [displayedBeforePhotos, setDisplayedBeforePhotos] = React.useState<string[]>([]); // Photos actually displayed (filtered by after-image availability)
  const [urlToOrder, setUrlToOrder] = React.useState<Record<string, number>>({}); // before photo url -> display_order
  const [urlToClusterId, setUrlToClusterId] = React.useState<Record<string, string>>({}); // before photo url -> cluster_id
  const [showFurnished, setShowFurnished] = React.useState(false); // Toggle for furnished/unfurnished
  const [omsriaImageMap, setOmsriaImageMap] = React.useState<Record<string, string>>({}); // room_id -> omsria_image_url
  const [afterPhotosUnfurnished, setAfterPhotosUnfurnished] = React.useState<Record<string, string>>({}); // photo_url -> after_url (unfurnished)
  const [afterPhotosFurnished, setAfterPhotosFurnished] = React.useState<Record<string, string>>({}); // photo_url -> after_url (furnished)
  const filmstripRef = React.useRef<HTMLDivElement>(null); // Ref for filmstrip scrolling
  const stableOnClusterNameChange = React.useRef(onClusterNameChange); // Stable ref for callback to avoid hooks dependency issues
  
  // Filter beforePhotos to only include clustered photos (exclude floor plans and unclustered)
  // AND only include rooms that have after-images
  React.useEffect(() => {
    if (!listingId || !beforePhotos || beforePhotos.length === 0 || !tier.id) {
      setFilteredBeforePhotos(beforePhotos || []);
      setClusterNames([]);
      return;
    }

    const filterPhotos = async () => {
      try {
        // First, fetch which rooms have after-images (R3 images only)
        const { data: afterPhotos, error: afterError } = await supabase
          .from('after_photos')
          .select('room_id')
          .eq('listing_id', listingId.toString())
          .eq('tier', tier.id)
          .eq('has_furniture', false); // Only R3 images

        if (afterError) {
          console.error('Failed to fetch after photos for filtering:', afterError);
          // Fallback: show all photos
        }

        // Build set of room IDs that have after-images
        // room_id format is like "cluster_75", "cluster_76", etc.
        const roomsWithAfterImages = new Set<string>();
        if (afterPhotos) {
          for (const row of afterPhotos) {
            if (row.room_id) {
              // room_id is like "cluster_75" - extract the cluster ID part
              const roomId = row.room_id;
              roomsWithAfterImages.add(roomId);
              // Also add numeric version if it's in "cluster_XX" format
              const match = roomId.match(/cluster[_-]?(\d+)/i);
              if (match) {
                roomsWithAfterImages.add(match[1]); // Add "75" as well
                roomsWithAfterImages.add(`cluster_${match[1]}`); // Add "cluster_75"
              }
            }
          }
        }

        // Fetch manual clusters to get valid photo URLs and cluster names
        // Order by display_order to ensure photos are grouped by room/cluster
        // Include selected_photo_url to only show the selected photo per room
        const { data: clusters, error: clusterError } = await supabase
          .from('clusters')
          .select('id, cluster_name, photo_urls, selected_photo_url, display_order')
          .eq('listing_id', listingId)
          .order('display_order', { ascending: true });

        if (clusterError) {
          console.error('Failed to fetch clusters:', clusterError);
          setFilteredBeforePhotos(beforePhotos);
          return;
        }

        // Build set of valid clustered photo URLs and map URLs to cluster names and cluster IDs
        // Process clusters in order to maintain room/cluster grouping
        const clusteredUrls = new Set<string>();
        const urlToClusterName = new Map<string, string>();
        const urlToClusterId = new Map<string, string>();
        const clusterIdToName = new Map<string, string>();
        const orderedPhotoUrls: string[] = []; // Photos ordered by cluster
        
        // Filter out excluded and floorplan clusters
        // AND only include clusters that have after-images
        const validClusters = (clusters || []).filter(cluster => {
          const name = (cluster.cluster_name || '').toLowerCase();
          const isExcluded = name === 'excluded' || name === 'floorplans' || name === 'floor plans';
          if (isExcluded) return false;
          
          // Check if this cluster has an after-image
          const clusterId = (cluster as any).id?.toString() || '';
          const clusterIdFormatted = `cluster_${clusterId}`;
          const hasAfterImage = roomsWithAfterImages.size === 0 || // If no after-images fetched, show all
                                roomsWithAfterImages.has(clusterId) ||
                                roomsWithAfterImages.has(clusterIdFormatted);
          
          return hasAfterImage;
        });
        
        for (const cluster of validClusters) {
          const clusterName = cluster.cluster_name || '';
          const clusterId = (cluster as any).id?.toString() || cluster.cluster_name || '';
          clusterIdToName.set(clusterId, clusterName);
          
          // Only use the selected photo per room (or first photo if no selection)
          // This ensures we only show one photo per room, matching R3's output
          const selectedPhoto = (cluster as any).selected_photo_url || 
                               (cluster.photo_urls && cluster.photo_urls.length > 0 ? cluster.photo_urls[0] : null);
          
          if (selectedPhoto) {
            clusteredUrls.add(selectedPhoto);
            urlToClusterName.set(selectedPhoto, clusterName);
            urlToClusterId.set(selectedPhoto, clusterId);
            orderedPhotoUrls.push(selectedPhoto); // Maintain order by cluster
          }
        }

        // Fetch listing_photos to check photo_type
        const { data: photos, error: photosError } = await supabase
          .from('listing_photos')
          .select('url, photo_type, display_order')
          .eq('listing_id', listingId)
          .in('url', beforePhotos);

        if (photosError) {
          console.error('Failed to fetch photo types:', photosError);
          // Fallback: filter by clusters only
          const filtered = beforePhotos.filter(url => clusteredUrls.has(url));
          setFilteredBeforePhotos(filtered);
          return;
        }

        // Build set of valid photo URLs: must be clustered AND not a floor plan
        const photoTypeMap = new Map<string, string>();
        const urlOrder: Record<string, number> = {};
        for (const photo of (photos || [])) {
          if (photo.url) {
            photoTypeMap.set(photo.url, photo.photo_type || 'general');
            if (typeof (photo as any).display_order === 'number') urlOrder[photo.url] = (photo as any).display_order as number;
          }
        }

        // Filter photos: must be clustered AND not a floor plan
        // Use orderedPhotoUrls to maintain room/cluster grouping
        const filtered = orderedPhotoUrls.filter(url => {
          const photoType = photoTypeMap.get(url);
          const isNotFloorPlan = photoType !== 'floor_plan';
          return isNotFloorPlan;
        });

        // Fetch OMSRIA processed images mapping
        const { data: omsriaData } = await supabase
          .from('omsria_processed_images')
          .select('room_id, image_url')
          .eq('listing_id', listingId.toString())
          .eq('is_redundant', false);

        const omsriaMapping: Record<string, string> = {};
        if (omsriaData) {
          for (const row of omsriaData) {
            if (row.room_id && row.image_url) {
              omsriaMapping[row.room_id] = row.image_url;
            }
          }
        }
        setOmsriaImageMap(omsriaMapping);

        // Map filtered photos to their cluster names and IDs (preserving order by room/cluster)
        const clusterNamesForFiltered = filtered.map(url => urlToClusterName.get(url) || '');
        const clusterIdsForFiltered = filtered.map(url => urlToClusterId.get(url) || '');
        const urlToClusterIdMap: Record<string, string> = {};
        filtered.forEach(url => {
          const clusterId = urlToClusterId.get(url);
          if (clusterId) urlToClusterIdMap[url] = clusterId;
        });

        setFilteredBeforePhotos(filtered);
        setClusterNames(clusterNamesForFiltered);
        setClusterIds(clusterIdsForFiltered);
        setUrlToOrder(urlOrder);
        setUrlToClusterId(urlToClusterIdMap);
      } catch (error) {
        console.error('Error filtering photos:', error);
        setFilteredBeforePhotos(beforePhotos);
      }
    };

    filterPhotos();
  }, [listingId, beforePhotos, tier.id]);

  // Compute items and len - must be after all hooks are declared
  // Show only displayed photos (those with after-images for current toggle state)
  const items = React.useMemo(() => {
    if (displayedBeforePhotos && displayedBeforePhotos.length) {
      return displayedBeforePhotos.map((url) => ({ beforeUrl: url, afterUrl: afterFallback, caption: "" }));
    }
    return Array.isArray(tier.beforeAfter) ? tier.beforeAfter : [];
  }, [displayedBeforePhotos, afterFallback, tier.beforeAfter]);
  
  const len = items.length;

  // Fetch after photos from Supabase when listingId and tier are available
  // Fetch both furnished and unfurnished, and only show photos that have after-images
  React.useEffect(() => {
    if (!listingId || !tier.id || filteredBeforePhotos.length === 0) return;
    
    const fetchAfterPhotos = async () => {
      try {
        // Fetch both furnished and unfurnished after photos
        const { data: allAfterPhotos, error } = await supabase
          .from('after_photos')
          .select('url, room_id, photo_url, has_furniture')
          .eq('listing_id', listingId.toString())
          .eq('tier', tier.id);

        if (error) {
          console.error('Failed to fetch after photos:', error);
          return;
        }

        const rows = allAfterPhotos || [];
        
        // Build maps: photo_url -> after_url (separate for furnished and unfurnished)
        const unfurnishedMap: Record<string, string> = {};
        const furnishedMap: Record<string, string> = {};
        const photosWithAfterImages = new Set<string>(); // Track which photos have after-images
        
        for (const row of rows) {
          if (row.photo_url && row.url) {
            photosWithAfterImages.add(row.photo_url);
            if (row.has_furniture === false) {
              unfurnishedMap[row.photo_url] = row.url;
            } else if (row.has_furniture === true) {
              furnishedMap[row.photo_url] = row.url;
            }
          }
        }
        
        
        setAfterPhotosUnfurnished(unfurnishedMap);
        setAfterPhotosFurnished(furnishedMap);
        
        // Filter before photos to only include those with after-images (for current toggle state)
        // Check if photo has after-image for the current toggle state (furnished or unfurnished)
        const currentAfterMap = showFurnished ? furnishedMap : unfurnishedMap;
        const photosWithMatches = filteredBeforePhotos.filter(url => {
          // Normalize URL for matching (trim whitespace)
          const normalizedUrl = url.trim();
          const hasMatch = currentAfterMap[normalizedUrl] !== undefined;
          if (!hasMatch) {
            console.warn(`[After Photos] No match for before photo: ${normalizedUrl.substring(normalizedUrl.length - 50)}`);
            // Try to find a match by checking if any key in currentAfterMap contains this URL
            const possibleMatch = Object.keys(currentAfterMap).find(k => k.includes(normalizedUrl.split('/').pop() || ''));
            if (possibleMatch) {
              console.warn(`[After Photos] Found possible match by filename: ${possibleMatch.substring(possibleMatch.length - 50)}`);
            }
          }
          return hasMatch;
        });
        
        
        setDisplayedBeforePhotos(photosWithMatches);
        
        // Match after photos to filtered before photos by photo_url
        const matchedAfters: string[] = [];
        const matchedByOrder: Record<number, string> = {};
        
        photosWithMatches.forEach((beforeUrl, idx) => {
          const normalizedBeforeUrl = beforeUrl.trim();
          const afterUrl = currentAfterMap[normalizedBeforeUrl] || afterFallback;
          matchedAfters.push(afterUrl);
          const order = urlToOrder[beforeUrl];
          if (typeof order === 'number') {
            matchedByOrder[order] = afterUrl;
          }
        });
        
        setAfterUrls(matchedAfters);
        setAfterByIndex(matchedByOrder);
      } catch (error) {
        console.error('Error fetching after photos:', error);
      }
    };

    fetchAfterPhotos();
  }, [listingId, tier.id, filteredBeforePhotos, urlToOrder, afterFallback, showFurnished]);

  // Photo tags removed - tag column doesn't exist in listing_photos table
  // Tags are available via clusterNames which come from clusters

  // After-only gallery derived from fetched after photos, matched by photo_url
  // Use afterUrls array is matched to displayedBeforePhotos by index
  // Switch before photos based on toggle: OMSRIA processed for unfurnished, original for furnished
  const originalBeforeUrl = displayedBeforePhotos[index] || "";
  const clusterIdForUrl = urlToClusterId[originalBeforeUrl];
  const roomId = clusterIdForUrl ? `cluster_${clusterIdForUrl}` : null;
  const omsriaImageUrl = roomId ? omsriaImageMap[roomId] : null;
  const currentBeforeUrl = showFurnished 
    ? originalBeforeUrl 
    : (omsriaImageUrl || originalBeforeUrl);
  const currentAfter = afterUrls[index] || afterFallback;
  const afters = afterUrls.length > 0 ? afterUrls : [afterFallback];
  
  // Cache-busting: refresh timestamp when listingId or tier changes to force fresh image loads
  // This ensures new images are loaded when switching listings or tiers
  const [cacheBustVersion, setCacheBustVersion] = React.useState(Date.now());
  
  React.useEffect(() => {
    // Reset cache-bust version when listing or tier changes
    setCacheBustVersion(Date.now());
  }, [listingId, tier.id]);
  
  const addCacheBust = (url: string) => {
    if (!url || url === afterFallback) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_v=${cacheBustVersion}`;
  };

  // Update ref when callback changes
  React.useEffect(() => {
    stableOnClusterNameChange.current = onClusterNameChange;
  }, [onClusterNameChange]);

  // Sync index when currentClusterName prop changes (for hover/click control)
  React.useEffect(() => {
    // Only control carousel if currentClusterName is explicitly provided (not undefined)
    if (currentClusterName !== undefined && clusterNames.length > 0) {
      if (currentClusterName) {
        // Find matching cluster and set index
        const matchingIndex = clusterNames.findIndex(name => name === currentClusterName);
        if (matchingIndex !== -1 && matchingIndex !== index) {
          setIndex(matchingIndex);
          setAfterIndex(matchingIndex);
        }
      }
      // If currentClusterName is null (hover cleared), don't reset - let carousel stay where it is
      // The carousel will continue working normally via user interaction
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClusterName, clusterNames]);

  // Notify parent of current cluster name changes (only when not externally controlled)
  React.useEffect(() => {
    if (stableOnClusterNameChange.current && !currentClusterName) {
      const currentClusterNameFromIndex = clusterNames.length > 0 && clusterNames[index] ? clusterNames[index] : null;
      stableOnClusterNameChange.current(currentClusterNameFromIndex);
    }
  }, [index, clusterNames, currentClusterName]);

  // Auto-scroll filmstrip to center active thumbnail
  React.useEffect(() => {
    if (filmstripRef.current && afters.length > 1) {
      const container = filmstripRef.current;
      const activeButton = container.children[index] as HTMLElement;
      if (activeButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const scrollLeft = activeButton.offsetLeft - (containerRect.width / 2) + (buttonRect.width / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [index, afters.length]);

  // Define prev and next functions before any early returns
  const prev = React.useCallback(() => {
    const newIndex = (index - 1 + len) % len;
    setIndex(newIndex);
    setAfterIndex(newIndex); // Sync after index with before index
  }, [index, len]);
  
  const next = React.useCallback(() => {
    const newIndex = (index + 1) % len;
    setIndex(newIndex);
    setAfterIndex(newIndex); // Sync after index with before index
  }, [index, len]);

  // Keyboard navigation for photo carousel (not slider)
  React.useEffect(() => {
    if (len === 0) return; // Don't add keyboard listeners if no items
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prev, next, len]);

  // Ensure index is within bounds
  const safeIndex = len > 0 ? (index % len) : 0;
  
  // Reset index if it's out of bounds
  React.useEffect(() => {
    if (len > 0 && index >= len) {
      setIndex(0);
      setAfterIndex(0);
    }
  }, [len, index]);

  if (len === 0)
    return (
      <div className="relative aspect-video w-full bg-muted flex items-center justify-center rounded-md border text-sm text-muted-foreground">
        No before/after images
      </div>
    );

  const item = items[safeIndex];

  // Use safeIndex for image URLs
  const safeBeforeUrl = displayedBeforePhotos[safeIndex] || "";
  const safeCurrentBeforeUrl = showFurnished 
    ? safeBeforeUrl 
    : (() => {
        const safeClusterId = urlToClusterId[safeBeforeUrl];
        const safeRoomId = safeClusterId ? `cluster_${safeClusterId}` : null;
        return safeRoomId && omsriaImageMap[safeRoomId] ? omsriaImageMap[safeRoomId] : safeBeforeUrl;
      })();
  const safeCurrentAfter = afterUrls[safeIndex] || afterFallback;
  const safeCacheBustedBefore = addCacheBust(safeCurrentBeforeUrl);
  const safeCacheBustedAfter = addCacheBust(safeCurrentAfter);

  return (
    <div className="relative aspect-video">
      <BeforeAfter before={safeCacheBustedBefore} after={safeCacheBustedAfter} caption={item.caption} className="aspect-video" />
      
      {/* Toggle for furnished/unfurnished - Top middle as toggle pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
        <button
          onClick={() => {
              if (!showFurnished) return; // Already unfurnished
              const newShowFurnished = false;
            setShowFurnished(newShowFurnished);
            // Update after photos when toggling - only show photos that have after-images for the new state
            const afterMap = newShowFurnished ? afterPhotosFurnished : afterPhotosUnfurnished;
            const photosWithMatches = filteredBeforePhotos.filter(url => afterMap[url] !== undefined);
            setDisplayedBeforePhotos(photosWithMatches);
            const matchedAfters: string[] = [];
            photosWithMatches.forEach((beforeUrl) => {
              const afterUrl = afterMap[beforeUrl] || afterFallback;
              matchedAfters.push(afterUrl);
            });
            setAfterUrls(matchedAfters);
            // Reset index if current photo doesn't have a match in new state
            if (matchedAfters.length > 0 && index >= matchedAfters.length) {
              setIndex(0);
            }
          }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              !showFurnished 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Show unfurnished"
          >
            🏗️ Unfurnished
          </button>
          <button
            onClick={() => {
              if (showFurnished) return; // Already furnished
              const newShowFurnished = true;
              setShowFurnished(newShowFurnished);
              // Update after photos when toggling - only show photos that have after-images for the new state
              const afterMap = newShowFurnished ? afterPhotosFurnished : afterPhotosUnfurnished;
              const photosWithMatches = filteredBeforePhotos.filter(url => afterMap[url] !== undefined);
              setDisplayedBeforePhotos(photosWithMatches);
              const matchedAfters: string[] = [];
              photosWithMatches.forEach((beforeUrl) => {
                const afterUrl = afterMap[beforeUrl] || afterFallback;
                matchedAfters.push(afterUrl);
              });
              setAfterUrls(matchedAfters);
              // Reset index if current photo doesn't have a match in new state
              if (matchedAfters.length > 0 && index >= matchedAfters.length) {
                setIndex(0);
              }
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              showFurnished 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Show furnished"
          >
            🪑 Furnished
        </button>
        </div>
      </div>
      
      {/* Controls positioned to match Before/After labels */}
      <div className="absolute bottom-3 left-3">
        <button
          className="h-8 w-8 rounded-full border bg-background/70 backdrop-blur hover:bg-background inline-flex items-center justify-center"
          aria-label="Previous"
          onClick={prev}>
          <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="absolute bottom-3 right-3">
        <button
          className="h-8 w-8 rounded-full border bg-background/70 backdrop-blur hover:bg-background inline-flex items-center justify-center"
          aria-label="Next"
          onClick={next}>
          <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {/* Dots */}
      <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2">
        {Array.from({ length: len }).map((_, i) =>
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-white/70",
            i === safeIndex ? "opacity-100" : "opacity-50"
          )} />
        )}
      </div>

      {/* After filmstrip - Silicon Valley style */}
      {afters.length > 1 && (
        <div className="absolute -bottom-20 left-0 right-0">
          <div className="flex items-center justify-center">
            <div ref={filmstripRef} className="flex gap-2 overflow-x-auto scrollbar-hide max-w-full px-4 py-2">
              {afters.map((src, i) => (
                <button 
                  key={i} 
                  aria-label={`Photo ${i+1}`} 
                   className={cn(
                     "flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden transition-all duration-200",
                     i === index 
                       ? "ring-2 ring-white/50 shadow-lg scale-105" 
                       : "opacity-60 hover:opacity-80 hover:scale-102"
                   )}
                  onClick={() => {
                    setIndex(i);
                    setAfterIndex(i); // Sync both indices
                  }}
                >
                  <img 
                    src={src} 
                    alt={`after thumb ${i+1}`} 
                    className="h-full w-full object-cover" 
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>);

}

function ThreadCard({ title, snippet }: {title: string;snippet: string;}) {
  return (
    <div className="rounded-xl border p-3 hover:bg-accent/40 transition-colors">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{snippet}</div>
    </div>);

}

function PermitChip({ type }: {type: PermitType;}) {
  const label = { none: "None", minor: "Minor", major: "Major", major_structural: "Major" }[type];
  return <Badge variant="secondary">{label}</Badge>;
}

// NEW: Novice‑friendly Permit Details as Cards (replaces PermitOutcome)
function PermitDetailsCards({
  items,
  city,
  workload,
  tierId,
  externalPermits
}: {items: ScopeItem[];city: string;workload: "low" | "normal" | "high";tierId?: TierId;externalPermits?: Array<{ permit_type: string; why_needed: string; documentation_required: string[]; issuing_authority: string; expected_time_weeks: number; common_pitfalls: string[]; sources?: string[]; }>;}) {
  const selected = items.filter((i) => i.selected);
  const permits = Array.from(
    new Set<PermitType>(selected.map((i) => i.permitImpact).filter((p) => p !== "none"))
  );

  React.useEffect(() => {
    console.debug("[PermitDetailsCards] selection", { selected: selected.length, permits, tierId });
  }, [selected.length, permits, tierId]);

  if (externalPermits && externalPermits.length) {
    return (
      <Card className="h-full !gap-2.5">
        <CardHeader className="pb-2 !py-0">
          <CardTitle className="font-semibold !text-lg">Permits You'\ll Need</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-5">
            {externalPermits.map((p, idx) => (
              <div key={idx} className="group rounded-xl border p-5 h-full flex flex-col gap-2 transition-all motion-safe:duration-300 hover:-translate-y-0.5 hover:shadow-md hover:bg-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold leading-snug break-words hyphens-auto">{p.permit_type}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.why_needed}</div>
                  </div>
                  <PermitChip type={"major"} />
                </div>
                <div className="mt-3 text-sm">
                  <div className="font-medium mb-1">Checklist of documents</div>
                  <ul className="list-disc list-outside pl-5 text-muted-foreground space-y-1 text-sm leading-relaxed">
                    {(p.documentation_required || []).map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
                <div className="mt-3 text-sm leading-relaxed break-words hyphens-auto">
                  <div className="font-medium mb-1">Issuing authority</div>
                  <p className="text-muted-foreground">{p.issuing_authority}</p>
                </div>
                <div className="mt-3 text-sm leading-relaxed break-words hyphens-auto">
                  <div className="font-medium mb-1">Expected time</div>
                  <p className="text-muted-foreground">{p.expected_time_weeks} weeks</p>
                </div>
                {p.common_pitfalls?.length ? (
                  <div className="mt-3 text-sm leading-relaxed break-words hyphens-auto">
                    <div className="font-medium mb-1">Common pitfalls</div>
                    <ul className="list-disc list-outside pl-5 text-muted-foreground space-y-1 text-sm leading-relaxed">
                      {p.common_pitfalls.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selected.length === 0)
  return (
    <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Select scope items to see which permits typically apply.
        </CardContent>
      </Card>);


  if (permits.length === 0)
  return (
    <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Current selection likely does not require a works license. Confirm with your local Ayuntamiento.
        </CardContent>
      </Card>);


  const meta: Record<Exclude<PermitType, "none">, {
    name: string;
    covers: string;
    who: string;
    docs: string[];
    where: string;
    desc: string;
  }> = {
    minor: {
      name: "Minor Works License / Licencia de Obra Menor",
      covers: "Small, cosmetic jobs (paint, fixtures, like‑for‑like replacements). No layout or structural changes.",
      who: "Usually Owner or Contractor. Sometimes Architect assists.",
      docs: [
      "Basic description of works",
      "Photos or simple sketch",
      "Owner ID + property deed extract",
      "Community (HOA) approval if applicable"],

      where: "Local Ayuntamiento (Town Hall); often online portal depending on municipality.",
      desc:
      "This is the quick permit for small jobs like repainting or replacing fixtures. Usually filed by the owner, sometimes even online. Approval can take 2–6 weeks depending on town hall workload."
    },
    major: {
      name: "Major Works (Non‑Structural) / Licencia de Obra Mayor (sin estructura)",
      covers: "Larger renovations that change layout (moving non‑load‑bearing walls), kitchens/baths reconfiguration, new openings that are not structural.",
      who: "Architect prepares and files on behalf of the Owner.",
      docs: [
      "Architectural project (Memoria, Planos, Mediciones)",
      "Safety & waste management declarations",
      "Community (HOA) approvals where required",
      "Contractor details"],

      where: "Always filed at the local Ayuntamiento. Forms and templates vary by municipality.",
      desc:
      "This permit is for larger renovations or changes to layout. It requires an architect's project and is always filed at the local Ayuntamiento. Expect 2–6 months for review."
    },
    major_structural: {
      name: "Major Works (Structural) / Licencia de Obra Mayor (con estructura)",
      covers: "Any structural changes, beams, load‑bearing elements, or work in listed/heritage buildings.",
      who: "Architect + Structural Engineer prepare the project; Architect files for Owner.",
      docs: [
      "Full project with structural calculations",
      "Engineer and architect sign‑offs",
      "Additional heritage authority forms if protected",
      "Inspection and site safety plans"],

      where:
      "Local Ayuntamiento; heritage authority may also need to approve if the property is protected.",
      desc:
      "For structural changes or heritage buildings, a full Major Works permit is required. Additional forms and inspections apply. This can take 6–12 months depending on city."
    }
  };

  // Tier-specific copy overrides
  const overrides: Partial<Record<TierId, Partial<Record<Exclude<PermitType, "none">, Partial<typeof meta["minor"]>>>>> = {
    livable: {
      minor: {
        who: "Owner or Contractor files; often same‑day submission",
        desc: "Fastest route for touch‑ups. Many towns approve within weeks in off‑season.",
      }
    },
    comfortable: {
      major: {
        who: "Architect leads filing; owner signs",
        desc: "Plan for iterative comments from Ayuntamiento; align schedule with supplier lead times.",
      }
    },
    competitive: {
      major: {
        desc: "Expect more scrutiny for layout changes and custom elements; neighbors/HOA approvals may be required.",
      },
      major_structural: {
        who: "Architect + Structural Engineer manage end‑to‑end",
        desc: "Structural scope expands review windows—budget for 6–12 months including inspections.",
      }
    }
  };

  const mergeMeta = <T extends Exclude<PermitType, "none">>(type: T) => ({
    ...meta[type],
    ...((tierId && overrides[tierId] && (overrides[tierId] as any)[type]) || {})
  });

  const order: PermitType[] = ["minor", "major", "major_structural"];
  const sorted = order.filter((t) => permits.includes(t as PermitType)) as Exclude<PermitType, "none">[];

  return (
    <Card className="h-full !gap-2.5">
      <CardHeader className="pb-2 !py-0">
        <CardTitle className="font-semibold !text-lg">Permits You&#39ll Need</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed break-words hyphens-auto">
          Forms and requirements differ by municipality. Always file through your local Ayuntamiento. Some
          cities support online submission; others require an in‑person appointment. Your architect usually
          prepares the documentation for Major Works permits.
        </p>
        <div className="flex flex-col gap-5">
          {sorted.map((type) => {
            const info = mergeMeta(type);
            const timeframe = getPermitMonths(city, workload, type);
            console.debug("[PermitDetailsCards] timeframe", { type, timeframe });
            return (
              <div key={type} className="group rounded-xl border p-5 h-full flex flex-col gap-2 transition-all motion-safe:duration-300 hover:-translate-y-0.5 hover:shadow-md hover:bg-accent/40">
                 <div className="flex items-start justify-between gap-3">
                   <div>
                     <div className="text-base font-semibold leading-snug break-words hyphens-auto">{info.name}</div>
                     <div className="mt-1 text-xs text-muted-foreground">{info.covers}</div>
                   </div>
                   <PermitChip type={type} />
                 </div>
                 <div className="mt-3 text-sm leading-relaxed break-words hyphens-auto">
                   <div className="font-medium mb-1">Who files it</div>
                   <p className="text-muted-foreground">{info.who}</p>
                 </div>
                 <div className="mt-3 text-sm">
                   <div className="font-medium mb-1">Checklist of documents</div>
                   <ul className="list-disc list-outside pl-5 text-muted-foreground space-y-1 text-sm leading-relaxed">
                    {info.docs.map((d: string, i: number) =>
                   <li key={i}>{d}</li>
                   )}
                   </ul>
                 </div>
                 <div className="mt-3 text-sm leading-relaxed break-words hyphens-auto">
                   <div className="font-medium mb-1">Where it's filed</div>
                   <p className="text-muted-foreground">{info.where}</p>
                 </div>
                 <div className="mt-3 text-sm leading-relaxed break-words hyphens-auto">
                   <div className="font-medium mb-1">What to expect</div>
                   <p className="text-muted-foreground">{info.desc}</p>
                 </div>
                <div className="mt-auto pt-3">
                   <Button asChild variant="outline" size="sm" className="w-full">
                     <a href="#" target="_blank" rel="noreferrer">View form (placeholder)</a>
                   </Button>
                 </div>
               </div>);

          })}
        </div>
      </CardContent>
    </Card>);

}

function ScopeMatrix({
  items,
  onChange
}: {items: ScopeItem[];onChange: (next: ScopeItem[]) => void;}) {
  // remove toggle interactions for pre-bundled scopes
  // const toggle = (id: string) =>
  //   onChange(items.map(r => r.id === id ? { ...r, selected: !r.selected } : r));

  const avgMoneyK = (r: MoneyRange) => Math.round((r.minEur + r.maxEur) / 2 / 1000);
  const fmtMoney = (r: MoneyRange) => `€${avgMoneyK(r)}k`;
  const fmtWeeks = (r: MonthRange) => `${(((r.min + r.max) / 2) * 4.3).toFixed(0)} wk`;

  // totals (fixed numbers from averages of each row)
  const selected = items.filter((i) => i.selected);
  const totalAvgMonths = selected.reduce((a, b) => a + (b.time.min + b.time.max) / 2, 0);
  const totalAvgWeeks = totalAvgMonths * 4.3;
  const totalAvgMoneyK = Math.round(selected.reduce((a, b) => a + (b.cost.minEur + b.cost.maxEur) / 2, 0) / 1000);

  React.useEffect(() => {
    console.debug("[ScopeMatrix] render", { rows: items.length, selected: selected.length, totalWeeks: Math.round(totalAvgWeeks), totalMoneyK: totalAvgMoneyK });
  }, [items, selected.length, totalAvgWeeks, totalAvgMoneyK]);

  return (
    <Card className="h-full">
      {/* remove empty header to reduce extra spacing */}
      {/* <CardHeader className="pb-2"></CardHeader> */}
      <CardContent className="p-0 overflow-hidden">
        {/* Desktop/tablet: single shared grid for header + rows + totals to ensure perfect alignment (no extra wrapper) */}
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto]">
          {/* Header row */}
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 text-left">Work item</div>
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 justify-self-start text-left whitespace-nowrap leading-none">Permit</div>
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 justify-self-end text-right whitespace-nowrap font-mono tabular-nums leading-none">Time</div>
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 justify-self-end text-right whitespace-nowrap font-mono tabular-nums leading-none">Cost</div>

          {/* Data rows */}
          {items.map((row, idx) =>
          <React.Fragment key={row.id}>
              <div className="px-3 py-3 text-left">
                <div className="text-sm break-words leading-tight">{row.label}</div>
                <div className="text-[11px] text-muted-foreground">{row.trade}</div>
              </div>
              <div className="px-3 py-3 justify-self-start text-left">
                <PermitChip type={row.permitImpact} />
              </div>
              <div className="px-3 py-3 justify-self-end text-right text-sm font-mono whitespace-nowrap tabular-nums">{fmtWeeks(row.time)}</div>
              <div className="px-3 py-3 justify-self-end text-right text-sm font-mono whitespace-nowrap tabular-nums">{fmtMoney(row.cost)}</div>
              {/* Divider spanning all columns (except after last row) */}
              {idx < items.length - 1 ? <div className="col-span-4 h-px bg-border" /> : null}
            </React.Fragment>
          )}

          {/* Totals row */}
          <div className="px-3 py-3 border-t text-base font-semibold col-span-2 text-left">Total</div>
          <div className="px-3 py-3 border-t justify-self-end text-right text-base font-semibold font-mono whitespace-nowrap tabular-nums">{Math.round(totalAvgWeeks)} wk</div>
          <div className="px-3 py-3 border-t justify-self-end text-right text-base font-semibold font-mono whitespace-nowrap tabular-nums">€{totalAvgMoneyK}k</div>
        </div>

        {/* Mobile: stacked list (unchanged), desktop version hidden above */}
        <div className="md:hidden">
          <div className="divide-y">
            {items.map((row) =>
            <div key={row.id} className="px-3 py-3">
                <div className="text-sm">
                  <div className="break-words leading-tight">{row.label}</div>
                  <div className="text-[11px] text-muted-foreground">{row.trade}</div>
                </div>
                <div className="mt-2">
                  <PermitChip type={row.permitImpact} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm font-mono">
                  <span className="whitespace-nowrap tabular-nums">{fmtWeeks(row.time)}</span>
                  <span className="whitespace-nowrap tabular-nums">{fmtMoney(row.cost)}</span>
                </div>
              </div>
            )}
          </div>
          {/* Mobile totals */}
          <div className="px-3 py-3 border-t flex items-center justify-between text-base font-semibold">
            <div className="text-muted-foreground">Total</div>
            <div className="font-mono whitespace-nowrap tabular-nums">{Math.round(totalAvgWeeks)} wk · €{totalAvgMoneyK}k</div>
          </div>
        </div>
      </CardContent>
    </Card>);


}

function TotalsBar({ items }: {items: ScopeItem[];}) {
  const selected = items.filter((i) => i.selected);
  const mAvg = selected.reduce((a, b) => a + (b.cost.minEur + b.cost.maxEur) / 2, 0);
  const tAvg = selected.reduce((a, b) => a + (b.time.min + b.time.max) / 2, 0);
  return (
    <div className="mt-4 border-t pt-3 flex items-center justify-between text-base font-semibold">
      <div className="text-muted-foreground">{items.length} included</div>
      <div>
        {tAvg.toFixed(1)} mo · €{Math.round(mAvg / 1000)}k
      </div>
    </div>);

}

const permitRank: Record<PermitType, number> = { none: 0, minor: 1, major: 2, major_structural: 3 };

function computeProjectPermit(rows: ScopeItem[]): PermitType {
  const sel = rows.filter((r) => r.selected);
  if (!sel.length) return "none";
  return sel.reduce((acc, r) => permitRank[r.permitImpact] > permitRank[acc] ? r.permitImpact : acc, "none" as PermitType);
}

// Provide lightweight implementations to avoid runtime reference errors
function getPermitMonths(
city: string,
workload: "low" | "normal" | "high",
type: PermitType)
: MonthRange {
  const base: Record<PermitType, MonthRange> = {
    none: { min: 0, max: 0 },
    minor: { min: 0.5, max: 1.5 },
    major: { min: 2, max: 6 },
    major_structural: { min: 6, max: 12 }
  };
  const w = workload === "low" ? 0.9 : workload === "high" ? 1.2 : 1.0;
  const r = base[type];
  return { min: r.min * w, max: r.max * w };
}

const TierTimeline = ({
  items,
  city,
  workload,
  purchaseBase,
  completion,
  movein,
  tierId,
  externalPhases,
}: {items: ScopeItem[];city: string;workload: "low" | "normal" | "high";purchaseBase: MonthRange;completion: MonthRange;movein: MonthRange;tierId?: TierId;externalPhases?: Array<{ label: string; weeks: number; subtitle?: string }>;}) => {
  const selected = items.filter((i) => i.selected);
  const sum = (k: keyof MonthRange) => selected.reduce((a, b) => a + b.time[k], 0);
  const workTime: MonthRange = { min: sum("min"), max: sum("max") };

  // Add permitting buffer based on highest permit severity in current selection
  const highestPermit = computeProjectPermit(selected);
  const permitTime = getPermitMonths(city, workload, highestPermit);

  const total: MonthRange = {
    min: purchaseBase.min + permitTime.min + workTime.min + completion.min + movein.min,
    max: purchaseBase.max + permitTime.max + workTime.max + completion.max + movein.max
  };

  React.useEffect(() => {
    console.debug("[TierTimeline] compute", { highestPermit, workTime, permitTime, total, tierId });
  }, [highestPermit, workTime.min, workTime.max, permitTime.min, permitTime.max, total.min, total.max, tierId]);

  // Build phases: prefer external canonical phases, else compute
  const computed = [
    { key: "purchase", label: "Purchase & planning", range: purchaseBase, color: "bg-chart-2" },
    { key: "permits", label: "Permitting", range: permitTime, color: "bg-chart-4" },
    { key: "build", label: "Construction", range: workTime, color: "bg-chart-1" },
    { key: "finish", label: "Completion", range: completion, color: "bg-chart-5" },
    { key: "movein", label: "Move‑in window", range: movein, color: "bg-chart-3" },
  ] as const;

  const phases = Array.isArray(externalPhases) && externalPhases.length
    ? externalPhases.map((p, i) => ({ key: String(i), label: p.label, range: { min: p.weeks / 4.3, max: p.weeks / 4.3 }, color: computed[Math.min(i, computed.length - 1)].color }))
    : computed;

  const avg = (r: MonthRange) => (r.min + r.max) / 2;
  const totalAvg = phases.reduce((a, p) => a + avg(p.range), 0) || 1; // avoid div-by-zero
  const maxAvg = Math.max(...phases.map((p) => avg(p.range)), 1);
  // cumulative start time (from now) for each phase, based on averages
  const phaseAvgs = phases.map((p) => avg(p.range));
  const cumulativeStarts = phases.map((_, i) => phaseAvgs.slice(0, i).reduce((a, b) => a + b, 0));
  const fmtFromNow = (m: number) => m < 0.1 ? "Now" : `${Math.round(m * 4.3)} wk`;
  const baseSubtitle: Record<string, string> = {
    purchase: "Search, due diligence, financing, and closing",
    permits: "License preparation and Ayuntamiento approval",
    build: "On‑site works, trades, and coordination",
    finish: "Punch list, inspections, and deep clean",
    movein: "Scheduling deliveries and settling in"
  };
  const tierOverrides: Partial<Record<TierId, Partial<typeof baseSubtitle>>> = {
    livable: {
      permits: "Quick filings; often owner/contractor-led",
      build: "Cosmetic updates and light trade work",
    },
    comfortable: {
      permits: "Architect prepares non‑structural project",
      build: "Kitchen/baths, flooring, and systems upgrades",
    },
    competitive: {
      permits: "Major license; allow architect review cycles",
      build: "Layout changes, custom kitchen, envelope upgrades",
    }
  };
  const phaseSubtitle = { ...baseSubtitle, ...(tierId ? (tierOverrides[tierId] || {}) : {}) } as Record<string, string>;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 !gap-0">
        <CardTitle className="font-semibold !text-xl">Timeline</CardTitle>
      </CardHeader>
      <CardContent className="text-sm !my-0">
        <div className="relative mx-auto">
          <Separator orientation="vertical" className="bg-muted absolute left-1.5 top-2 h-[calc(100%-0.5rem)]" />
          {phases.map((p, idx) =>
          <div key={p.key} className="relative mb-4 pl-6 !py-0 !mb-[42px] !block !flex-col !gap-0">
              {/* Dot */}
              <div className="bg-foreground absolute left-0 top-2 flex size-3 items-center justify-center rounded-full" />
              {/* Title + Timestamp wrapper */}
              <div className="relative">
                {/* Title (right) */}
                <h4 className="rounded-xl text-base font-semibold relative -top-[0.5px] !tracking-[-0.4px] !py-0.5">
                  {p.label}
                </h4>
                {/* Date (exactly 3px above title) */}
                <h5 className="absolute left-0 bottom-[calc(100%+1px)] text-xs text-muted-foreground tracking-tight !py-0">
                  {fmtFromNow(cumulativeStarts[idx])}
                </h5>
                {/* Descriptive subtitle below title */}
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(Array.isArray(externalPhases) && externalPhases.length) ? (externalPhases[Number(p.key)]?.subtitle || "") : phaseSubtitle[p.key]}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>);

};

function ContractorPlaybook({ items, city }: {items: ScopeItem[];city: string;}) {
  const trades = Array.from(new Set(items.filter((i) => i.selected).map((i) => i.trade)));
  return (
    <Card className="h-full !py-6">
      <CardHeader className="pb-2 !gap-2 !text-base !py-0">
        <CardTitle className="font-semibold !text-lg">Practical Lessons</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          Tips on getting the work done smoothly—without the headaches or disappointment. Grounded in {city}'s local dynamics (permits, building rules, trade availability) and the realities of renovation.
        </p>

        {/* Headline learnings */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {/* Learning 1 */}
          <div className="rounded-xl border p-5 hover:bg-accent/40 transition-colors">
            <div className="italic text-base font-medium leading-snug">
              Hire the team, not the quote
            </div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Shortlist three contractors with comparable scope and timelines. Prioritize recent references and photo reports over the lowest price.
            </p>
          </div>

          {/* Learning 2 */}
          <div className="rounded-xl border p-5 hover:bg-accent/40 transition-colors">
            <div className="italic text-base font-medium leading-snug">
              Write it down, then build it
            </div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Turn decisions into written summaries with sketches/screenshots. Share them in a shared chat to prevent scope drift and memory gaps.
            </p>
          </div>

          {/* Learning 3 */}
          <div className="rounded-xl border p-5 hover:bg-accent/40 transition-colors">
            <div className="italic text-base font-medium leading-snug">
              Bilingual labels beat assumptions
            </div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Use clear room/finish labels in both languages to cut misunderstandings. Confirm building access hours, elevator protection, and waste plans.
            </p>
          </div>

          {/* Learning 4 */}
          <div className="rounded-xl border p-5 hover:bg-accent/40 transition-colors">
            <div className="italic text-base font-medium leading-snug">
              Ambiguity is expensive
            </div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Vague specs invite change orders. Lock fixtures, finishes, and disposal methods early; stage payments by milestones—not up front.
            </p>
          </div>

          {/* Learning 5 */}
          <div className="rounded-xl border p-5 hover:bg-accent/40 transition-colors">
            <div className="italic text-base font-medium leading-snug">
              Materials before demolition
            </div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Don't chase schedules with empty hands. Confirm lead times and place critical orders before demolition to avoid dead time.
            </p>
          </div>

          {/* Learning 6 */}
          <div className="rounded-xl border p-5 hover:bg-accent/40 transition-colors">
            <div className="italic text-base font-medium leading-snug">
              Permits are part of the plan
            </div>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Align scope to the right license early. Your architect leads major filings; structural work adds months—plan for it.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Pro tip: lock in electrician and plumber early if layout changes impact rough‑ins, and confirm meter/shutoff access with the utility.
        </p>
      </CardContent>
    </Card>
  );
}

function TierDetail({ mode, tier, items, onChange, city, listingId, externalPermits, externalTimeline }: {mode: "normal" | "fullscreen";tier: Tier;items: ScopeItem[];onChange: (next: ScopeItem[]) => void;city: string;listingId?: string;externalPermits?: Array<{ permit_type: string; why_needed: string; documentation_required: string[]; issuing_authority: string; expected_time_weeks: number; common_pitfalls: string[]; sources?: string[]; }>;externalTimeline?: Record<TierId, Array<{ label: string; weeks: number; subtitle?: string }>>;}) {
  const handleChange = (id: string) =>
  onChange(items.map((r) => r.id === id ? { ...r, selected: !r.selected } : r));

  if (mode === "normal") {
    // Reordered: Before/After at top, then Scope → Timeline → Permit → Playbook
    return (
      <div className="space-y-4">
        <div className="pb-0 !p-0">
          <TierBeforeAfterCarousel tier={tier} listingId={listingId} />
        </div>
        <Separator className="opacity-40" />
        <div className="px-4">
          <ScopeMatrix items={items} onChange={onChange} />
        </div>
        <div className="px-4">
          <TierTimeline
            items={items}
            city={city}
            workload="normal"
            purchaseBase={{ min: 0.5, max: 1.0 }}
            completion={{ min: 0.3, max: 0.5 }}
            movein={{ min: 0.2, max: 0.3 }}
            tierId={tier.id}
            externalPhases={externalTimeline?.[tier.id as TierId]}
          />
        </div>
        <div className="px-4">
          <PermitDetailsCards
            items={items}
            city={city}
            workload="normal"
            tierId={tier.id}
            externalPermits={externalPermits} />
        </div>
        <div className="px-4 pb-4">
          <ContractorPlaybook items={items} city={city} />
        </div>
      </div>);

  }

  // Fullscreen analytical grid
  return (
    <div className="grid md:grid-cols-4">
      {/* ROW A */}
      <div className="md:col-span-2 p-4">
        <TierBeforeAfterCarousel tier={tier} listingId={listingId} />
      </div>
      <div className="md:col-span-2 p-4">
        <ScopeMatrix items={items} onChange={onChange} />
      </div>

      <div className="md:col-span-4"><Separator className="opacity-40" /></div>

      {/* ROW B */}
      <div className="md:col-span-2 p-4">
        <TierTimeline
          items={items}
          city={city}
          workload="normal"
          purchaseBase={{ min: 0.5, max: 1.0 }}
          completion={{ min: 0.3, max: 0.5 }}
          movein={{ min: 0.2, max: 0.3 }}
          tierId={tier.id}
          externalPhases={externalTimeline?.[tier.id as TierId]}
        />

      </div>
      <div className="md:col-span-2 p-4">
        <PermitDetailsCards
          items={items}
          city={city}
          workload="normal"
          tierId={tier.id}
          externalPermits={externalPermits} />

      </div>

      {/* ROW C */}
      <div className="md:col-span-4 p-4">
        <ContractorPlaybook items={items} city={city} />
      </div>
    </div>);

}
