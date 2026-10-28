"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useBuyerReport } from "@/hooks/useBuyerReport";

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
      synthesis?: string;
      risk_level?: string;
      alerts?: string[];
      // Backwards compatibility
      summary?: string;
      key_findings?: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    environmental_hostility: {
      synthesis?: string;
      risk_level?: string;
      alerts?: string[];
      // Backwards compatibility
      summary?: string;
      key_findings?: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
  };
    social_security: {
      synthesis?: string;
      risk_level?: string;
      alerts?: string[];
      // Backwards compatibility
      summary?: string;
      key_findings?: string[];
      red_flags?: string[];
      evidence?: Array<{ url: string; snippet: string; title?: string }>;
    };
    urban_legality: {
      synthesis?: string;
      risk_level?: string;
      alerts?: string[];
      // Backwards compatibility
      summary?: string;
      key_findings?: string[];
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
    one_liner?: string;
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

interface BuyerReportModalProps {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingMetadata?: { title?: string; price?: number; size?: number; bedrooms?: number; bathrooms?: number; location?: string };
}

type Photo = { url: string; display_order: number; cluster_name?: string; room_type?: string };

// RoomCarousel component from IntegratedAnalysisModal
function RoomCarousel({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  if (!photos?.length) return <div className="aspect-video bg-muted rounded border" />;
  const go = (dir: -1 | 1) => {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0) return 0;
      if (next > photos.length - 1) return photos.length - 1;
      return next;
    });
  };
  return (
    <div className="w-full">
      <div className="relative aspect-video overflow-hidden bg-muted rounded">
        <img
          src={photos[index].url}
          alt="room"
          className="absolute inset-0 w-full h-full object-cover select-none"
          draggable={false}
          onClick={() => setOpen(true)}
        />
        {index > 0 && (
          <button aria-label="Anterior" className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full grid place-items-center bg-black/55 text-white" onClick={() => go(-1)}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2.5]"><path d="M14.5 6.5 9 12l5.5 5.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        {index < photos.length - 1 && (
          <button aria-label="Siguiente" className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full grid place-items-center bg-black/55 text-white" onClick={() => go(1)}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2.5]"><path d="M9.5 17.5 15 12 9.5 6.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 flex-nowrap items-end" style={{ minHeight: 64 }}>
          {photos.map((p, i) => {
            const isActive = i === index;
            return (
              <button key={p.url} onClick={() => setIndex(i)} className="rounded shrink-0 cursor-pointer">
                <img src={p.url} className={`object-cover rounded select-none shrink-0 transition-opacity duration-150 h-12 w-20 ${isActive ? "opacity-100" : "opacity-60 hover:opacity-80"}`} draggable={false} />
              </button>
            );
          })}
        </div>
      )}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="relative w-[min(96vw,1100px)] h-[min(90vh,700px)]">
            <img src={photos[index].url} className="absolute inset-0 w-full h-full object-contain" alt="room" />
            <button aria-label="Cerrar" className="absolute top-4 right-4 h-9 px-3 rounded bg-white text-black" onClick={() => setOpen(false)}>Cerrar</button>
            <button aria-label="Anterior" className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/20 text-white grid place-items-center" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
            <button aria-label="Siguiente" className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/20 text-white grid place-items-center" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeRoom(name: string) {
  const s = (name || "").toLowerCase();
  // Spanish and English room name normalization
  if (/bed|dormitorio|habitaci[oó]n/i.test(s)) return "Bedroom";
  if (/bath|baño|bano|wc|toilet/i.test(s)) return "Bathroom";
  if (/kitchen|cocina/i.test(s)) return "Kitchen";
  if (/living|sal[oó]n|living room|sala/i.test(s)) return "Living Room";
  if (/terraza|terrace|balcon|balcón/i.test(s)) return "Terraza";
  if (/piscina|pool/i.test(s)) return "Piscina";
  if (/garaje|garage|parking/i.test(s)) return "Garaje";
  if (/trastero|storage|almacen|almacén/i.test(s)) return "Trastero";
  // Return original if no match
  return name;
}

// Enhanced room matching function
function findRoomPhotos(roomName: string, byRoom: Record<string, Photo[]>): Photo[] {
  const normalized = normalizeRoom(roomName);
  const roomLower = roomName.toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  
  // Try exact matches first
  if (byRoom[roomName]) return byRoom[roomName];
  if (byRoom[normalized]) return byRoom[normalized];
  if (byRoom[roomLower]) return byRoom[roomLower];
  if (byRoom[normalizedLower]) return byRoom[normalizedLower];
  
  // Try partial matches (room name contains cluster name or vice versa)
  for (const [clusterName, photos] of Object.entries(byRoom)) {
    const clusterLower = clusterName.toLowerCase();
    if (
      roomLower.includes(clusterLower) ||
      clusterLower.includes(roomLower) ||
      normalizedLower.includes(clusterLower) ||
      clusterLower.includes(normalizedLower)
    ) {
      return photos;
    }
  }
  
  // Try word-by-word matching (e.g., "Terraza con Piscina" matches "Terraza")
  const roomWords = roomLower.split(/\s+/);
  for (const word of roomWords) {
    if (word.length > 3) { // Skip short words like "con", "de", etc.
      for (const [clusterName, photos] of Object.entries(byRoom)) {
        const clusterLower = clusterName.toLowerCase();
        if (clusterLower.includes(word) || word.includes(clusterLower)) {
          return photos;
        }
      }
    }
  }
  
  return [];
}

export const BuyerReportModal: React.FC<BuyerReportModalProps> = ({
  listingId,
  open,
  onOpenChange,
  listingMetadata
}) => {
  // Use shared hook for instant data loading (cached if already fetched)
  const { report, loading, error: reportError } = useBuyerReport(listingId);
  
  const [error, setError] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [byRoom, setByRoom] = React.useState<Record<string, Photo[]>>({});
  const contentRef = React.useRef<HTMLDivElement>(null);
  const reportRef = React.useRef<HTMLDivElement>(null);
  const documentRef = React.useRef<HTMLDivElement>(null);

  // Fetch photos and group by room (fetch when listingId is available, not just when modal opens)
  React.useEffect(() => {
    if (!listingId) return;

    let cancelled = false;

    const fetchPhotos = async () => {
      try {
        // Fetch photos
        const photosRes = await fetch(`/api/listings/${listingId}/photos`);
        if (!photosRes.ok) {
          console.error('Failed to fetch photos:', photosRes.statusText);
          return;
        }
        const photosJson = await photosRes.json();
        
        // Fetch clusters
        const clustersRes = await fetch(`/api/listings/${listingId}/clusters`);
        if (!clustersRes.ok) {
          console.error('Failed to fetch clusters:', clustersRes.statusText);
          return;
        }
        const clustersJson = await clustersRes.json();

        if (cancelled) return;

        // Build map of cluster_name -> photos (ONLY photos in photo_urls array, NOT visibility_mappings)
        const by: Record<string, Photo[]> = {};
        const allPhotoUrls = new Set<string>();
        
        (clustersJson?.clusters || []).forEach((c: any) => {
          const clusterName = c.cluster_name;
          if (!clusterName) return;
          
          // ONLY use photos from photo_urls array (not visibility_mappings)
          const clusterPhotoUrls = c.photos || c.photo_urls || [];
          
          // Filter photos that belong to this cluster
          const clusterPhotos: Photo[] = [];
          clusterPhotoUrls.forEach((url: string) => {
            allPhotoUrls.add(url);
            // Find the photo details from the photos response
            const photoDetails = (photosJson?.photos || []).find((p: any) => p.url === url);
            if (photoDetails && photoDetails.photo_type !== "floor_plan") {
              clusterPhotos.push({
                url: photoDetails.url,
                display_order: photoDetails.display_order || 0,
                cluster_name: clusterName,
                room_type: undefined
              });
            }
          });
          
          // Sort by display_order and add to byRoom
          clusterPhotos.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          if (clusterPhotos.length > 0) {
            by[clusterName] = clusterPhotos;
          }
        });

        if (!cancelled) {
          // Set all photos (for fallback)
          const allPhotos = (photosJson?.photos || [])
          .filter((p: any) => p.photo_type !== "floor_plan")
          .map((p: any) => ({
            url: p.url,
              display_order: p.display_order || 0,
              cluster_name: undefined,
              room_type: undefined
            }))
            .sort((a: Photo, b: Photo) => (a.display_order || 0) - (b.display_order || 0));
          
          setPhotos(allPhotos as Photo[]);
          
          // Also create normalized keys for better matching
          const byNormalized: Record<string, Photo[]> = {};
          Object.entries(by).forEach(([key, photos]) => {
            const normalized = normalizeRoom(key);
            if (normalized !== key) {
              byNormalized[normalized] = [...(byNormalized[normalized] || []), ...photos];
            }
            // Also add lowercase version
            byNormalized[key.toLowerCase()] = [...(byNormalized[key.toLowerCase()] || []), ...photos];
          });
          
          // Merge normalized keys into main by object
          Object.entries(byNormalized).forEach(([key, photos]) => {
            if (!by[key]) {
              by[key] = photos;
            }
          });
          
          console.log('📸 Photos grouped by room:', {
            total_photos: allPhotos.length,
            rooms: Object.keys(by),
            room_counts: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])),
            sample_photos: Object.entries(by).slice(0, 3).map(([k, v]) => ({ room: k, photo_urls: v.slice(0, 2).map(p => p.url) }))
          });
          
          setByRoom(by);
        }
      } catch (err) {
        console.error('Error fetching photos:', err);
      }
    };

    fetchPhotos();
    return () => { cancelled = true; };
  }, [listingId]); // Fetch when listingId changes, not when modal opens

  // Trigger citations sweep when report loads (if needed)
  React.useEffect(() => {
    if (report && !report.inline_citations) {
      triggerCitationsSweep(report);
            }
  }, [report]);

  // Sync error state from hook
  React.useEffect(() => {
    if (reportError) {
      setError(reportError);
        }
  }, [reportError]);

  const triggerCitationsSweep = async (reportData: any) => {
    try {
      const response = await fetch(`/api/listings/${listingId}/analysis/citations-sweep`, {
        method: "POST"
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Citations sweep will update the database, and the hook's real-time subscription will pick it up
          // No need to manually update state - the hook handles it
        }
      }
    } catch (err) {
      console.error("Failed to trigger citations sweep:", err);
    }
  };

  // Generate unique citation ID
  const getCitationId = (citation: any, section: string, paragraphIndex: number) => {
    return `citation-${section}-${paragraphIndex}-${citation.claim_id || citation.evidence_ids[0]}`;
  };

  // Clean URL function to handle common issues
  const cleanUrl = (url: string): string => {
    if (!url) return '';
    let cleaned = url.trim();
    
    // Ensure protocol
    if (!cleaned.startsWith('http')) {
      cleaned = `https://${cleaned}`;
    }
    
    // Try to fix common issues like "com%20%20opinion" -> "com/opinion"
    // This is a best-effort fix for malformed URLs
    try {
      const urlObj = new URL(cleaned);
      // If domain contains encoded spaces, it's likely malformed
      if (urlObj.hostname.includes('%20')) {
        // This is a severe issue, maybe unfixable, but let's try to replace %20 with empty or dot?
        // Or just leave it and let the user see it's broken
      }
      
      // Handle the specific case: .xn--... part might be valid punycode, but if followed by spaces, it's broken
      // e.g. .xn--com%20%20opinin...
      // We can't easily reverse engineer the intended URL if it's hallucinated garbage.
      // But we can decodeURI to see if it helps display.
      
      // For display purposes, we might want decoded version
      return cleaned;
    } catch (e) {
      // Invalid URL structure
      return cleaned;
    }
  };

  // Scroll to citation in references section
  const handleCitationClick = (citationId: string) => {
    const element = document.getElementById(citationId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Scroll to section from reference header
  const handleSectionHeaderClick = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderTextWithCitations = (
    text: string,
    section: string,
    paragraphIndex: number = 0
  ): React.ReactNode => {
    if (!report?.inline_citations || !report?.evidence_map) {
      return <p className="text-[15px] leading-relaxed">{text}</p>;
    }

    // Find citations for this section/paragraph
    const citations = report.inline_citations.filter(
      (c) => c.section === section && (c.paragraph_index ?? 0) === paragraphIndex
    );

    if (citations.length === 0) {
      return <p className="text-[15px] leading-relaxed">{text}</p>;
    }

    // Build text with dotted underlines for key phrases
    const elements: Array<{ type: 'text' | 'citation'; content: string; citation?: typeof citations[0] }> = [];
    let lastIndex = 0;

    // Sort citations by position in text (find claim_text in text)
    // Prioritize key_phrases if available for cleaner UI
    const sortedCitations = [...citations].sort((a, b) => {
      const aText = (a.key_phrases?.[0] || a.claim_text);
      const bText = (b.key_phrases?.[0] || b.claim_text);
      const aIndex = text.indexOf(aText);
      const bIndex = text.indexOf(bText);
      return aIndex - bIndex;
    });

    for (const citation of sortedCitations) {
      // Use key phrase if available, otherwise claim text
      // If multiple key phrases, just use the first one that matches to avoid complexity
      const matchText = (citation.key_phrases?.find(kp => text.indexOf(kp, lastIndex) !== -1)) || citation.claim_text;
      
      const claimIndex = text.indexOf(matchText, lastIndex);
      if (claimIndex === -1) continue;

      // Add text before citation
      if (claimIndex > lastIndex) {
        elements.push({
          type: 'text',
          content: text.substring(lastIndex, claimIndex)
        });
      }

      // Add citation with dotted underline
      const citationId = getCitationId(citation, section, paragraphIndex);
      elements.push({
        type: 'citation',
        content: matchText,
        citation: { ...citation, citationId } as typeof citation & { citationId: string }
      });

      lastIndex = claimIndex + matchText.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    // Render elements
    return (
      <p className="text-[15px] leading-relaxed">
          {elements.map((el, idx) => {
            if (el.type === 'citation' && el.citation) {
            const citationId = (el.citation as typeof el.citation & { citationId: string }).citationId;
              return (
              <button
                  key={idx}
                onClick={(e) => { e.stopPropagation(); handleCitationClick(citationId); }}
                className="border-b-[1.5px] border-dotted border-slate-400 hover:border-slate-800 hover:bg-slate-100 rounded-sm px-0.5 cursor-pointer transition-all text-slate-700 hover:text-slate-900 font-medium"
                title="Ver referencia"
                >
                  {el.content}
              </button>
              );
            }
            return <span key={idx}>{el.content}</span>;
          })}
        </p>
    );
  };

  // Group references by section
  const getReferencesBySection = () => {
    if (!report?.inline_citations || !report?.evidence_map) return {};

    const grouped: Record<string, Array<{
      citationId: string;
      claimText: string;
      evidence: Array<{
        id: string;
        url: string;
        title?: string;
        publisher?: string;
        snippet: string;
        confidence: string;
      }>;
    }>> = {};

    report.inline_citations.forEach((citation, idx) => {
      const section = citation.section;
      if (!grouped[section]) {
        grouped[section] = [];
      }

      const citationId = getCitationId(citation, citation.section, citation.paragraph_index ?? 0);
      const evidence = citation.evidence_ids
        .map((id) => report.evidence_map![id])
        .filter(Boolean)
        .map((ev, evIdx) => ({
          id: ev.url || `ev-${idx}-${evIdx}`,
              url: ev.url,
              title: ev.title,
              publisher: ev.publisher,
              snippet: ev.snippet,
          confidence: ev.confidence
        }));

      // Check if this citation already exists (avoid duplicates)
      const existing = grouped[section].find(c => c.citationId === citationId);
      if (!existing) {
        grouped[section].push({
          citationId,
          claimText: citation.claim_text,
          evidence
        });
      } else {
        // Merge evidence if citation already exists
        const existingEvidenceIds = new Set(existing.evidence.map(e => e.id));
        evidence.forEach(ev => {
          if (!existingEvidenceIds.has(ev.id)) {
            existing.evidence.push(ev);
            existingEvidenceIds.add(ev.id);
          }
        });
      }
    });

    return grouped;
  };

  // Get section display name
  const getSectionDisplayName = (section: string): string => {
    const sectionNames: Record<string, string> = {
      'house_as_a_whole.narrative_synthesis': 'La Casa como un Todo',
      // Chapter 1: Forensic Risk Audit
      'forensic_risk_audit.structural_pathology.summary': 'Patología Estructural',
      'forensic_risk_audit.environmental_hostility.summary': 'Hostilidad Ambiental',
      'forensic_risk_audit.social_security.summary': 'Contexto Social y Seguridad',
      'forensic_risk_audit.urban_legality.summary': 'Legalidad Urbanística',
      // Chapter 2: Execution & Reality Check
      'execution_reality_check.renovation_reality.summary': 'Realidad de Renovación',
      'execution_reality_check.infrastructure.summary': 'Infraestructura',
      // Chapter 3: Financial Intelligence
      'financial_intelligence.hidden_opex_incentives.summary': 'OpEx Ocultos e Incentivos',
      'financial_intelligence.market_context.summary': 'Contexto de Mercado',
    };
    
    // Handle old structure (backward compatibility)
    if (section.startsWith('house_diagnostics.findings_by_category.')) {
      const categoryMap: Record<string, string> = {
        'estado_materiales': 'Estado de Materiales',
        'espacios_distribucion': 'Espacios y Distribución',
        'entorno_vistas': 'Entorno y Vistas',
        'servicios_instalaciones': 'Servicios e Instalaciones',
        'legal_economico': 'Legal y Económico',
        'seguridad_accesibilidad': 'Seguridad y Accesibilidad',
        'caracter_arquitectonico': 'Carácter Arquitectónico',
      };
      const category = section.replace('house_diagnostics.findings_by_category.', '');
      return categoryMap[category] || category.replace(/_/g, ' ');
    }
    
    // Handle old contextual analysis (backward compatibility)
    if (section.startsWith('contextual_analysis.categories.')) {
      let category = section.replace('contextual_analysis.categories.', '');
      category = category.replace(/\[\d+\]/g, '').replace(/\.signals$/g, '').replace(/\.stance$/g, '');
      const categoryNames: Record<string, string> = {
        'permits': 'Permisos',
        'contractors': 'Contratistas',
        'costs': 'Costes',
        'timeline': 'Plazos',
        'seasonality': 'Estacionalidad',
        'regulations': 'Normativas',
        'market': 'Mercado',
        'neighborhood': 'Barrio',
        'utilities': 'Servicios',
        'accessibility': 'Accesibilidad',
        'environment': 'Entorno',
        'legal': 'Legal',
      };
      return categoryNames[category] || category.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    // Clean up any array indices or suffixes
    let cleanedSection = section.replace(/\[\d+\]/g, '').replace(/\.signals$/g, '').replace(/\.summary$/g, '');
    return sectionNames[cleanedSection] || cleanedSection.replace(/_/g, ' ').replace(/\./g, ' > ');
  };

  // Get section anchor ID
  const getSectionAnchorId = (section: string): string => {
    // Clean up section name first (remove array indices, .signals, etc.)
    let cleanedSection = section.replace(/\[\d+\]/g, '').replace(/\.signals$/g, '').replace(/\.stance$/g, '').replace(/\.summary$/g, '');
    
    const anchorMap: Record<string, string> = {
      'house_as_a_whole.narrative_synthesis': 'toc-house-whole',
      // Chapter 1: Forensic Risk Audit
      'forensic_risk_audit.structural_pathology': 'forensic-risk-audit',
      'forensic_risk_audit.environmental_hostility': 'forensic-risk-audit',
      'forensic_risk_audit.social_security': 'forensic-risk-audit',
      'forensic_risk_audit.urban_legality': 'forensic-risk-audit',
      // Chapter 2: Execution & Reality Check
      'execution_reality_check.renovation_reality': 'execution-reality-check',
      'execution_reality_check.infrastructure': 'execution-reality-check',
      // Chapter 3: Financial Intelligence
      'financial_intelligence.hidden_opex_incentives': 'financial-intelligence',
      'financial_intelligence.market_context': 'financial-intelligence',
    };
    
    // Old structure (backward compatibility)
    if (cleanedSection.startsWith('house_diagnostics.findings_by_category.')) {
      return 'forensic-risk-audit'; // Map old diagnostics to new Chapter 1
    }
    
    // Old contextual analysis (backward compatibility)
    if (cleanedSection.startsWith('contextual_analysis.categories.')) {
      return 'execution-reality-check'; // Map old contextual to new Chapter 2
    }
    
    return anchorMap[cleanedSection] || 'toc-overview';
  };

  // Favicon component
  const Favicon: React.FC<{ url: string; className?: string }> = ({ url, className }) => {
    const [faviconUrl, setFaviconUrl] = React.useState<string | null>(null);
    
    React.useEffect(() => {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const domain = urlObj.hostname.replace('www.', '');
        setFaviconUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=16`);
      } catch {
        setFaviconUrl(null);
      }
    }, [url]);

    if (!faviconUrl) return null;
    
    return (
      <img 
        src={faviconUrl} 
        alt="" 
        className={cn("w-4 h-4 inline-block mr-2", className)}
        onError={() => setFaviconUrl(null)}
      />
    );
  };

  // Helper to render text with bolding (**text**)
  const RenderMarkdownText = ({ text }: { text: string }) => {
    // Split by bold markers
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <span>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  const handleScrollTo = (targetId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const container = contentRef.current;
    if (!container) return;
    const section = container.querySelector(`#${targetId}`) as HTMLElement | null;
    if (!section) return;
    const heading = section.querySelector('h2, h3, h4, [data-heading]') as HTMLElement | null;
    const anchorEl = heading || section;
    const OFFSET = 30;
    const start = container.scrollTop;
    const rect = anchorEl.getBoundingClientRect();
    const crect = container.getBoundingClientRect();
    const relativeTop = rect.top - crect.top + start;
    const end = Math.max(0, relativeTop - OFFSET);
    container.scrollTo({ top: end, behavior: "smooth" });
  };

  const handleExportPDF = async () => {
    // PDF export implementation would go here
    console.log("PDF export not yet implemented");
  };

  const formattedTimestamp = report?.property_info?.last_updated
    ? new Date(report.property_info.last_updated).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="buyer-report-modal-desc" className="w-full h-full md:!max-w-none m-0 p-0 flex flex-col border-0 shadow-none bg-white md:bg-transparent print:shadow-none md:rounded-lg" showCloseButton={false}>
        <p id="buyer-report-modal-desc" className="sr-only">Informe del comprador con análisis completo, citaciones y fotos por habitación.</p>
        
        {/* Desktop TOC fixed outside the blurred/scrolling container - hidden on mobile */}
        <aside
          className="hidden md:block fixed left-6 top-43.5 w-48 p-0 z-50 print:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-t border-white/20 pt-3">
            <nav className="text-sm space-y-2 text-white">
              <div className="text-sm uppercase tracking-wide text-white/80 mb-2 font-semibold">Contenido</div>
              <button onClick={handleScrollTo('toc-overview')} className="block text-left hover:underline text-white/90 cursor-pointer text-[15px] font-medium">Resumen Ejecutivo</button>
              <button onClick={handleScrollTo('forensic-risk-audit')} className="block text-left hover:underline text-white/90 cursor-pointer text-[15px] font-medium">🛡️ Cap. 1: Análisis Forense</button>
              <button onClick={handleScrollTo('execution-reality-check')} className="block text-left hover:underline text-white/90 cursor-pointer text-[15px] font-medium">🛠️ Cap. 2: Realidad Ejecución</button>
                <div className="mt-1 ml-3 space-y-1 text-white/85">
                {report?.execution_reality_check?.room_by_room?.map((room) => (
                    <button key={room.room_id} onClick={handleScrollTo(room.anchor)} className="block text-left hover:underline italic text-[13px]">{room.room_name}</button>
                  ))}
                </div>
              <button onClick={handleScrollTo('financial-intelligence')} className="block text-left hover:underline text-white/90 cursor-pointer text-[15px] font-medium">💰 Cap. 3: Inteligencia Financiera</button>
              <button onClick={handleScrollTo('toc-references')} className="block text-left hover:underline text-white/90 cursor-pointer text-[15px] font-medium">Referencias</button>
            </nav>
          </div>
        </aside>

        <div 
          ref={contentRef} 
          className="relative w-full h-screen md:h-full bg-white md:bg-black/30 print:bg-transparent md:backdrop-blur-xl print:backdrop-blur-0 flex items-start justify-center py-0 md:pt-[50px] md:pb-[50px] print:py-0 px-0 md:px-8 overflow-y-auto" 
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
          onClick={() => onOpenChange(false)}
        >
          {/* Export PDF button - fixed at top right of viewport */}
          <div className="fixed top-6 right-6 z-50 no-print hidden md:block">
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-md border border-black bg-white text-sm text-black hover:bg-gray-50 cursor-pointer flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>

          {/* Document card: page (overlay) scrolls; header centered - full screen on mobile */}
          <div ref={documentRef} className="bg-white md:rounded-t-lg md:rounded-b-none shadow-xl md:shadow-xl print:shadow-none w-full h-full md:h-auto md:max-w-[800px] md:my-[50px] flex flex-col overflow-visible print:rounded-none print:max-w-none print:w-[210mm] print:min-h-[297mm] print:my-0" onClick={(e) => e.stopPropagation()}>
            <DialogHeader className="px-6 py-6 border-b bg-white relative print:border-0">
              <div className="w-full text-center">
                <div className="text-xs tracking-wide text-muted-foreground uppercase">Informe del Comprador</div>
                <DialogTitle className="mt-1 text-3xl font-semibold leading-tight">
                  {report?.property_info?.title || listingMetadata?.title || `Listing ${listingId}`}
                </DialogTitle>
                {formattedTimestamp && (
                  <div className="mt-1 text-xs text-muted-foreground">Actualizado: {formattedTimestamp}</div>
                )}
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0">
              {/* Main content (document scrolls with overlay, not internally) */}
              <div ref={reportRef} className="p-4 md:p-10 space-y-10 text-slate-800">
                {loading && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando informe...</div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-destructive">Error: {error}</div>
                  </div>
                )}

                {report && (
                  <>
                    {/* Section 1: Property Info */}
                    <section id="toc-overview" className="avoid-break">
                      <div className="grid md:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
                        {/* Left column: main photo + basic info */}
                        <aside className="space-y-3">
                          <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                            <div className="aspect-[4/3] relative">
                              <img src={photos?.[0]?.url || "/favicon.png"} alt="foto principal" className="absolute inset-0 w-full h-full object-cover" />
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-4 text-[14px] leading-relaxed">
                            {report.property_info.location && (
                              <div className="text-slate-600">{report.property_info.location}</div>
                            )}
                            {report.property_info.price_eur && (
                              <div className="mt-1 text-2xl font-semibold text-slate-900">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(report.property_info.price_eur)}
                              </div>
                            )}
                          </div>
                        </aside>
                        {/* Right column: Executive Summary (from House as a Whole) */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <h3 className="text-lg font-semibold tracking-tight mb-3">Resumen Ejecutivo</h3>
                        {renderTextWithCitations(
                          report.house_as_a_whole.narrative_synthesis,
                          "house_as_a_whole.narrative_synthesis",
                          0
                        )}
                        {report.house_as_a_whole.cross_room_themes.length > 0 && (
                          <div className="mt-4 space-y-2">
                              <h4 className="font-medium text-[15px] text-slate-900">Temas Transversales</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-slate-700">
                              {report.house_as_a_whole.cross_room_themes.map((theme, idx) => (
                                <li key={idx}>{theme}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        </div>
                      </div>
                    </section>

                    <hr className="border-slate-200" />

                    {/* 🛡️ CHAPTER 1: FORENSIC RISK AUDIT */}
                    <section id="forensic-risk-audit" className="avoid-break">
                      <h2 className="text-2xl font-semibold tracking-tight mb-4">🛡️ CAPÍTULO 1: ANÁLISIS FORENSE DE RIESGOS</h2>
                      <p className="text-muted-foreground mb-6 text-[15px]">Protección contra "Vicios Ocultos" - Identificación de riesgos estructurales, ambientales, legales y de seguridad.</p>
                      
                      <div className="space-y-6">
                        {/* Structural Pathology */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-lg">Patología Estructural y Salud del Edificio</h3>
                          </div>
                          
                          {/* Synthesis */}
                          <div className="text-slate-700 mb-4 text-[15px] leading-relaxed">
                          {renderTextWithCitations(
                              (report.forensic_risk_audit.structural_pathology as any).synthesis || report.forensic_risk_audit.structural_pathology.summary || "",
                              "forensic_risk_audit.structural_pathology.synthesis",
                              0
                            )}
                          </div>

                          {/* Alerts as a clean list below */}
                          {(report.forensic_risk_audit.structural_pathology as any).alerts && (report.forensic_risk_audit.structural_pathology as any).alerts.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-amber-500/50">
                              <h4 className="font-semibold text-slate-900 text-[14px] uppercase tracking-wide mb-2">
                                Puntos de Atención
                              </h4>
                              <ul className="space-y-2 text-[15px] leading-relaxed text-slate-800">
                                {(report.forensic_risk_audit.structural_pathology as any).alerts.map((alert: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-amber-600 mt-1 text-xs">●</span>
                                    <span>
                                      {alert.replace(/\*\*/g, '').split(/:(.+)/).map((part, i, arr) => 
                                        i === 0 && arr.length > 1 ? <strong key={i} className="font-semibold text-slate-900">{part}:</strong> : part
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Legacy Fallback: Key Findings & Red Flags (only if no alerts) */}
                          {!(report.forensic_risk_audit.structural_pathology as any).alerts && (
                            <>
                              {report.forensic_risk_audit.structural_pathology.key_findings?.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.forensic_risk_audit.structural_pathology.key_findings.map((finding, idx) => (
                                  <li key={idx}>{finding}</li>
                                ))}
                              </ul>
                          </div>
                          )}
                          {report.forensic_risk_audit.structural_pathology.red_flags && report.forensic_risk_audit.structural_pathology.red_flags.length > 0 && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                              <h4 className="font-medium mb-2 text-[15px] text-red-900">⚠️ Señales de Alerta:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-red-800">
                                {report.forensic_risk_audit.structural_pathology.red_flags.map((flag, idx) => (
                                  <li key={idx}>{flag}</li>
                        ))}
                              </ul>
                      </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Environmental Hostility */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-lg">Hostilidad Ambiental y Riesgo Sensorial</h3>
                          </div>

                          {/* Synthesis */}
                          <div className="text-slate-700 mb-4 text-[15px] leading-relaxed">
                          {renderTextWithCitations(
                              (report.forensic_risk_audit.environmental_hostility as any).synthesis || report.forensic_risk_audit.environmental_hostility.summary || "",
                              "forensic_risk_audit.environmental_hostility.synthesis",
                              0
                            )}
                          </div>

                          {/* Alerts as a clean list below */}
                          {(report.forensic_risk_audit.environmental_hostility as any).alerts && (report.forensic_risk_audit.environmental_hostility as any).alerts.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-amber-500/50">
                              <h4 className="font-semibold text-slate-900 text-[14px] uppercase tracking-wide mb-2">
                                Puntos de Atención
                              </h4>
                              <ul className="space-y-2 text-[15px] leading-relaxed text-slate-800">
                                {(report.forensic_risk_audit.environmental_hostility as any).alerts.map((alert: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-amber-600 mt-1 text-xs">●</span>
                                    <span>
                                      {alert.replace(/\*\*/g, '').split(/:(.+)/).map((part, i, arr) => 
                                        i === 0 && arr.length > 1 ? <strong key={i} className="font-semibold text-slate-900">{part}:</strong> : part
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                           {/* Legacy Fallback */}
                           {!(report.forensic_risk_audit.environmental_hostility as any).alerts && (
                            <>
                              {report.forensic_risk_audit.environmental_hostility.key_findings?.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                          <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.forensic_risk_audit.environmental_hostility.key_findings.map((finding, idx) => (
                                  <li key={idx}>{finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                            </>
                      )}
                        </div>

                        {/* Social Security */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-lg">Contexto Social, Seguridad y Vecindario</h3>
                          </div>

                          {/* Synthesis */}
                          <div className="text-slate-700 mb-4 text-[15px] leading-relaxed">
                            {renderTextWithCitations(
                              (report.forensic_risk_audit.social_security as any).synthesis || report.forensic_risk_audit.social_security.summary || "",
                              "forensic_risk_audit.social_security.synthesis",
                              0
                            )}
                          </div>

                          {/* Alerts as a clean list below */}
                          {(report.forensic_risk_audit.social_security as any).alerts && (report.forensic_risk_audit.social_security as any).alerts.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-amber-500/50">
                              <h4 className="font-semibold text-slate-900 text-[14px] uppercase tracking-wide mb-2">
                                Puntos de Atención
                              </h4>
                              <ul className="space-y-2 text-[15px] leading-relaxed text-slate-800">
                                {(report.forensic_risk_audit.social_security as any).alerts.map((alert: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-amber-600 mt-1 text-xs">●</span>
                                    <span>
                                      {alert.replace(/\*\*/g, '').split(/:(.+)/).map((part, i, arr) => 
                                        i === 0 && arr.length > 1 ? <strong key={i} className="font-semibold text-slate-900">{part}:</strong> : part
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                           {/* Legacy Fallback */}
                           {!(report.forensic_risk_audit.social_security as any).alerts && (
                            <>
                              {report.forensic_risk_audit.social_security.key_findings?.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.forensic_risk_audit.social_security.key_findings.map((finding, idx) => (
                                  <li key={idx}>{finding}</li>
                                ))}
                              </ul>
                              </div>
                            )}
                            </>
                          )}
                        </div>

                        {/* Urban Legality */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-lg">Legalidad Urbanística, Planificación y "Fantamas"</h3>
                          </div>

                          {/* Synthesis */}
                          <div className="text-slate-700 mb-4 text-[15px] leading-relaxed">
                          {renderTextWithCitations(
                              (report.forensic_risk_audit.urban_legality as any).synthesis || report.forensic_risk_audit.urban_legality.summary || "",
                              "forensic_risk_audit.urban_legality.synthesis",
                              0
                            )}
                          </div>

                          {/* Alerts as a clean list below */}
                          {(report.forensic_risk_audit.urban_legality as any).alerts && (report.forensic_risk_audit.urban_legality as any).alerts.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-amber-500/50">
                              <h4 className="font-semibold text-slate-900 text-[14px] uppercase tracking-wide mb-2">
                                Puntos de Atención
                              </h4>
                              <ul className="space-y-2 text-[15px] leading-relaxed text-slate-800">
                                {(report.forensic_risk_audit.urban_legality as any).alerts.map((alert: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-amber-600 mt-1 text-xs">●</span>
                                    <span>
                                      {alert.replace(/\*\*/g, '').split(/:(.+)/).map((part, i, arr) => 
                                        i === 0 && arr.length > 1 ? <strong key={i} className="font-semibold text-slate-900">{part}:</strong> : part
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Legacy Fallback */}
                          {!(report.forensic_risk_audit.urban_legality as any).alerts && (
                            <>
                              {report.forensic_risk_audit.urban_legality.key_findings?.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.forensic_risk_audit.urban_legality.key_findings.map((finding, idx) => (
                                  <li key={idx}>{finding}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                            </>
                          )}
                        </div>
                      </div>
                    </section>

                    <hr className="border-slate-200" />

                    {/* 🛠️ CHAPTER 2: EXECUTION & REALITY CHECK */}
                    <section id="execution-reality-check" className="avoid-break">
                      <h2 className="text-2xl font-semibold tracking-tight mb-4">🛠️ CAPÍTULO 2: REALIDAD DE EJECUCIÓN</h2>
                      <p className="text-muted-foreground mb-6 text-[15px]">Gestión de Expectativas "HGTV" - Costos reales, plazos, permisos y disponibilidad de contratistas.</p>
                      
                      <div className="space-y-6">
                        {/* Renovation Reality */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <h3 className="font-semibold text-lg mb-3">El "Impuesto del Encanto" y la Realidad de la Renovación</h3>
                          {renderTextWithCitations(
                            report.execution_reality_check.renovation_reality.summary,
                            "execution_reality_check.renovation_reality.summary",
                            0
                          )}
                          {report.execution_reality_check.renovation_reality.key_findings.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.execution_reality_check.renovation_reality.key_findings.map((finding, idx) => (
                                  <li key={idx}><RenderMarkdownText text={finding} /></li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.execution_reality_check.renovation_reality.cost_estimates && report.execution_reality_check.renovation_reality.cost_estimates.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Estimaciones de Costo:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.execution_reality_check.renovation_reality.cost_estimates.map((cost, idx) => (
                                  <li key={idx}><RenderMarkdownText text={cost} /></li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.execution_reality_check.renovation_reality.timeline_expectations && report.execution_reality_check.renovation_reality.timeline_expectations.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Expectativas de Plazo:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.execution_reality_check.renovation_reality.timeline_expectations.map((timeline, idx) => (
                                  <li key={idx}><RenderMarkdownText text={timeline} /></li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Infrastructure */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <h3 className="font-semibold text-lg mb-3">Infraestructura y Conectividad</h3>
                          {renderTextWithCitations(
                            report.execution_reality_check.infrastructure.summary,
                            "execution_reality_check.infrastructure.summary",
                            0
                          )}
                          {report.execution_reality_check.infrastructure.key_findings.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.execution_reality_check.infrastructure.key_findings.map((finding, idx) => (
                                  <li key={idx}><RenderMarkdownText text={finding} /></li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Room-by-Room Analysis */}
                        <div>
                          <h3 className="font-semibold text-lg mb-4">Análisis Habitación por Habitación</h3>
                      <div className="space-y-8">
                            {report.execution_reality_check.room_by_room.map((room) => {
                          // Use enhanced matching function
                          let roomPhotos = findRoomPhotos(room.room_name, byRoom);
                          
                          // Fallback: if no match found, try to get photos from "Other" or show first few photos
                          if (roomPhotos.length === 0) {
                            // Try "Other" category
                            roomPhotos = byRoom["Other"] || [];
                            
                            // If still no photos, show first 3 photos as fallback
                            if (roomPhotos.length === 0 && photos.length > 0) {
                              roomPhotos = photos.slice(0, 3);
                            }
                          }
                          
                          return (
                            <div key={room.room_id} id={room.anchor} className="grid md:grid-cols-2 gap-5 rounded-lg border border-slate-200 p-5 bg-white avoid-break">
                              <div className="relative">
                                <RoomCarousel photos={roomPhotos} />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg tracking-tight mb-3">{room.room_name}</h3>
                                {(room as any).one_liner && (
                                  <div className="mb-3 p-3 bg-slate-50 rounded-md border border-slate-100">
                                    <p className="text-[15px] text-slate-700 italic">{(room as any).one_liner}</p>
                                  </div>
                                )}
                                {room.findings.length > 0 && (
                                  <div className="mb-4">
                                    <h4 className="font-medium mb-2 text-[15px]">Hallazgos:</h4>
                                    <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                      {room.findings.map((finding, idx) => (
                                        <li key={idx}><RenderMarkdownText text={finding} /></li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {room.renovation_costs && room.renovation_costs.length > 0 && (
                                  <div className="mb-4">
                                    <h4 className="font-medium mb-2 text-[15px]">Costos de Renovación:</h4>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                      {room.renovation_costs.map((cost, idx) => {
                                        // Parse cost string if it contains specific format or just render text
                                        // Heuristic: if cost contains currency symbol and number, style it as a price tag
                                        const isPrice = /(?:€|EUR|\$)\s?[\d,.]+/.test(cost);
                                        
                                        if (isPrice) {
                                          return (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-md px-3 py-1.5 shadow-sm">
                                              <span className="font-semibold text-slate-900 text-[14px]"><RenderMarkdownText text={cost} /></span>
                                              {/* Subtle Habitissimo attribution */}
                                              <div className="flex items-center gap-1 text-[10px] text-slate-500 border-l border-slate-300 pl-2 ml-1 uppercase tracking-wider font-medium select-none">
                                                Est.
                                                <img src="https://www.google.com/s2/favicons?domain=habitissimo.es&sz=16" alt="Habitissimo" className="w-3 h-3 opacity-60" title="Fuente: Habitissimo Guía de Precios" />
                                              </div>
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <p key={idx} className="text-[15px] leading-relaxed text-slate-700">
                                            <RenderMarkdownText text={cost} />
                                          </p>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {room.uncertainties.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2 text-[15px]">Incertidumbres:</h4>
                                    <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                      {room.uncertainties.map((uncertainty, idx) => (
                                        <li key={idx}><RenderMarkdownText text={uncertainty} /></li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                            {/* Display additional rooms found in photos but not in report */}
                            {Object.entries(byRoom).map(([roomName, roomPhotos]) => {
                              // Skip if this room (normalized) is already in the report
                              const normalizedName = normalizeRoom(roomName);
                              const alreadyShown = report.execution_reality_check.room_by_room.some(
                                r => normalizeRoom(r.room_name) === normalizedName || 
                                     r.room_name.toLowerCase().includes(roomName.toLowerCase()) ||
                                     roomName.toLowerCase().includes(r.room_name.toLowerCase())
                              );
                              
                              if (alreadyShown) return null;
                              
                              // Additional exclusions
                              const excludedKeywords = ["other", "floor_plan", "zonas comunes", "exterior", "fachada", "comunidad"];
                              const lowerName = roomName.toLowerCase();
                              if (excludedKeywords.some(kw => lowerName.includes(kw))) return null;

                              return (
                                <div key={`extra-${roomName}`} className="grid md:grid-cols-2 gap-5 rounded-lg border border-slate-200 p-5 bg-white avoid-break">
                                  <div className="relative">
                                    <RoomCarousel photos={roomPhotos} />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-lg tracking-tight mb-3">{roomName}</h3>
                                    <div className="p-3 bg-slate-50 rounded border border-slate-100 text-sm text-slate-500 italic">
                                      Habitación identificada en las fotos pero sin análisis detallado específico en este informe.
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>

                    <hr className="border-slate-200" />

                    {/* 💰 CHAPTER 3: FINANCIAL INTELLIGENCE */}
                    <section id="financial-intelligence" className="avoid-break">
                      <h2 className="text-2xl font-semibold tracking-tight mb-4">💰 CAPÍTULO 3: INTELIGENCIA FINANCIERA</h2>
                      <p className="text-muted-foreground mb-6 text-[15px]">El "Libro Mayor" - Costos ocultos, incentivos, y contexto de mercado para una decisión inteligente.</p>
                      
                      <div className="space-y-6">
                        {/* Hidden OpEx & Incentives */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <h3 className="font-semibold text-lg mb-3">Finanzas, OpEx Ocultos e Incentivos</h3>
                          {renderTextWithCitations(
                            report.financial_intelligence.hidden_opex_incentives.summary,
                            "financial_intelligence.hidden_opex_incentives.summary",
                            0
                          )}
                          {report.financial_intelligence.hidden_opex_incentives.hidden_costs.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Costos Ocultos:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.financial_intelligence.hidden_opex_incentives.hidden_costs.map((cost, idx) => (
                                  <li key={idx}>{cost}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.financial_intelligence.hidden_opex_incentives.incentives && report.financial_intelligence.hidden_opex_incentives.incentives.length > 0 && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                              <h4 className="font-medium mb-2 text-[15px] text-green-900">✅ Oportunidades e Incentivos:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-green-800">
                                {report.financial_intelligence.hidden_opex_incentives.incentives.map((incentive, idx) => (
                                  <li key={idx}>{incentive}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Market Context */}
                        <div className="rounded-lg border border-slate-200 bg-white p-5">
                          <h3 className="font-semibold text-lg mb-3">Contexto de Mercado y Comparables</h3>
                          {renderTextWithCitations(
                            report.financial_intelligence.market_context.summary,
                            "financial_intelligence.market_context.summary",
                            0
                          )}
                          {report.financial_intelligence.market_context.key_findings.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Hallazgos Clave:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.financial_intelligence.market_context.key_findings.map((finding, idx) => (
                                  <li key={idx}>{finding}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.financial_intelligence.market_context.price_trends && report.financial_intelligence.market_context.price_trends.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Tendencias de Precio:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.financial_intelligence.market_context.price_trends.map((trend, idx) => (
                                  <li key={idx}>{trend}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.financial_intelligence.market_context.negotiation_leverage && report.financial_intelligence.market_context.negotiation_leverage.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2 text-[15px]">Poder de Negociación:</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed">
                                {report.financial_intelligence.market_context.negotiation_leverage.map((leverage, idx) => (
                                  <li key={idx}>{leverage}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    <hr className="border-slate-200" />

                    {/* Section 6: References */}
                    <section id="toc-references" className="avoid-break">
                      <h2 className="text-2xl font-semibold tracking-tight mb-6">Referencias y Fuentes</h2>
                      
                      {(() => {
                        const referencesBySection = getReferencesBySection();
                        const sections = Object.keys(referencesBySection);
                        
                        if (sections.length === 0) {
                          return (
                      <div className="rounded-lg border border-slate-200 bg-white p-5">
                              <div className="text-sm text-muted-foreground">No hay referencias disponibles</div>
                          </div>
                          );
                        }

                        return (
                          <div className="space-y-8">
                            {sections.map((section) => {
                              const references = referencesBySection[section];
                              const sectionDisplayName = getSectionDisplayName(section);
                              const sectionAnchorId = getSectionAnchorId(section);
                              
                              return (
                                <div key={section} className="rounded-lg border border-slate-200 bg-white p-5">
                                  <button
                                    onClick={() => handleSectionHeaderClick(sectionAnchorId)}
                                    className="text-lg font-semibold mb-4 hover:text-primary transition-colors cursor-pointer text-left"
                                  >
                                    {sectionDisplayName} →
                                  </button>
                                  
                                  <div className="space-y-4">
                                    {references.map((ref) => (
                                      <div key={ref.citationId} id={ref.citationId} className="scroll-mt-20">
                                        <div className="text-sm font-medium text-slate-700 mb-2">
                                          "{ref.claimText}"
                          </div>
                                        <div className="space-y-2 ml-4">
                                          {ref.evidence.map((ev) => {
                                            const cleanedUrl = cleanUrl(ev.url);
                                            return (
                                            <a
                                              key={ev.id}
                                              href={cleanedUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-start gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
                                            >
                                              <Favicon url={cleanedUrl} />
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium group-hover:underline">
                                                  {ev.title || ev.publisher || 'Source'}
                                                </div>
                                                {ev.publisher && ev.publisher !== ev.title && (
                                                  <div className="text-xs text-muted-foreground">{ev.publisher}</div>
                        )}
                                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                  {ev.snippet}
                      </div>
                                                <div className="text-xs text-muted-foreground mt-1 break-all">
                                                  {decodeURIComponent(cleanedUrl)}
                                                </div>
                                              </div>
                                            </a>
                                          );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </section>

                    {/* Bottom centered logo */}
                    <div className="mt-2 mb-3 flex justify-center">
                      <img src="/logo.png" alt="Puedo Casa" className="h-24 w-auto filter grayscale opacity-85" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

