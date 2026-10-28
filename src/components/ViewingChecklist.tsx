"use client";
import {appFetch as fetch} from '@/lib/app-path';

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageCircle, ChevronDown, ChevronUp, ExternalLink, ImageIcon, Info, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface VerifyRecommendation {
  headline: string;
  brief: string;
  priority: number;
  expansion?: {
    steps?: string[];
    photos?: Array<{
      room_id: string;
      url: string;
      note?: string;
    }>;
    questions_for_agent?: string[];
    context?: string;
    links?: Array<{
      url: string;
      title?: string;
      snippet?: string;
    }>;
    acceptance?: string[];
    oom?: {
      cost?: { low: number; high: number; currency: string };
      time_weeks?: { low: number; high: number };
    };
    evidence_note?: string;
  };
}

interface ViewingChecklistProps {
  listingId: string;
  agentWhatsapp?: string | null;
  onItemClick?: (anchor: string) => void;
  onViewAnalysis?: () => void;
}

export const ViewingChecklist: React.FC<ViewingChecklistProps> = ({
  listingId,
  agentWhatsapp,
  onItemClick,
  onViewAnalysis
}) => {
  const [recommendations, setRecommendations] = useState<VerifyRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!listingId) return;

    let cancelled = false;

    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('verify_recommendations')
          .select('recommendations')
          .eq('listing_id', listingId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(fetchError.message || "Failed to fetch verify recommendations");
        }

        if (!cancelled) {
          if (data?.recommendations) {
            const recs = Array.isArray(data.recommendations.items) 
              ? data.recommendations.items 
              : Array.isArray(data.recommendations)
              ? data.recommendations
              : [];
            // Sort by priority (1 is highest)
            recs.sort((a: VerifyRecommendation, b: VerifyRecommendation) => (a.priority || 99) - (b.priority || 99));
            setRecommendations(recs);
          } else {
            // Try generating if not found
            const generateResponse = await fetch(`/api/listings/${listingId}/recommendations/verify`, {
              method: "POST"
            });
            if (generateResponse.ok) {
              const generateData = await generateResponse.json();
              if (generateData.success && generateData.data?.items) {
                const recs = generateData.data.items;
                recs.sort((a: VerifyRecommendation, b: VerifyRecommendation) => (a.priority || 99) - (b.priority || 99));
                setRecommendations(recs);
              }
            }
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load viewing checklist");
          setLoading(false);
        }
      }
    };

    fetchRecommendations();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`verify-recommendations-${listingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'verify_recommendations',
        filter: `listing_id=eq.${listingId}`
      }, (payload) => {
        if (payload.new && !cancelled) {
          const newPayload = payload.new as any;
          const recs = Array.isArray(newPayload.recommendations?.items)
            ? newPayload.recommendations.items
            : Array.isArray(newPayload.recommendations)
            ? newPayload.recommendations
            : [];
           recs.sort((a: VerifyRecommendation, b: VerifyRecommendation) => (a.priority || 99) - (b.priority || 99));
          setRecommendations(recs);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [listingId]);

  const handleCopy = async () => {
    const checklistText = "Viewing Checklist - Puedo Casa\n\n" +
      recommendations.map((item, idx) => 
        `☐ ${item.headline}\n   Q: ${item.expansion?.questions_for_agent?.[0] || "Ask about this"}`
      ).join('\n\n');
    
    await navigator.clipboard.writeText(checklistText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Favicon component
  const Favicon: React.FC<{ url: string }> = ({ url }) => {
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
    return <img src={faviconUrl} alt="" className="w-3.5 h-3.5 inline-block mr-1.5 opacity-70" onError={() => setFaviconUrl(null)} />;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Checklist de Visita</h2>
            <p className="text-sm text-slate-500">Puntos clave para verificar in situ</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-center bg-slate-50">
        <p className="text-slate-500 mb-2">No hay checklist disponible todavía.</p>
        <p className="text-xs text-slate-400">Se generará automáticamente con el análisis completo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Checklist de Visita
            <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200">
              {recommendations.length} puntos
            </Badge>
          </h2>
          <p className="text-sm text-slate-500 mt-1">Acciones rápidas y preguntas clave para el agente.</p>
        </div>
        <div className="flex items-center gap-2">
          {onViewAnalysis && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewAnalysis}
              className="h-8 px-3 border-slate-200 hover:bg-slate-100 text-slate-600 hidden md:flex"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Ver Análisis
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100"
            title="Copiar checklist"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const num = agentWhatsapp || '';
              const href = num ? `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, me gustaría programar una visita.')}` : 'https://wa.me/';
              window.open(href, '_blank');
            }}
            className="bg-[#25d366] hover:bg-[#20bd5a] text-white border-none h-8 px-3 shadow-sm"
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            WhatsApp
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.map((item, idx) => {
          const isExpanded = expandedItems.has(idx);
          const primaryQuestion = item.expansion?.questions_for_agent?.[0];
          const hasPhotos = item.expansion?.photos && item.expansion?.photos.length > 0;
          const hasLinks = item.expansion?.links && item.expansion?.links.length > 0;
          
          return (
            <Collapsible
              key={idx}
              open={isExpanded}
              onOpenChange={() => toggleExpand(idx)}
              className={cn(
                "border border-slate-200 rounded-lg bg-white transition-all duration-200",
                isExpanded ? "shadow-md ring-1 ring-slate-200 border-slate-300" : "hover:border-slate-300 shadow-sm"
              )}
            >
              <div className="flex items-start p-3.5 gap-3 cursor-pointer" onClick={() => toggleExpand(idx)}>
                
                <div className="flex-1 min-w-0">
                  {/* Headline Action */}
                  <div className="font-bold text-[15px] text-slate-900 leading-tight">
                    {item.headline}
                  </div>
                  
                  {/* Quick Question / Action */}
                  <div className="mt-1.5 text-[14px] text-slate-600 flex items-start gap-2">
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide mt-0.5">Pregunta</span>
                    <span className="italic text-slate-700">"{primaryQuestion || "Pregunta al agente sobre este punto..."}"</span>
                  </div>
                </div>

                {/* Expand Button */}
                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 hover:bg-slate-100 text-slate-400 shrink-0 flex items-center gap-1 font-normal">
                  <span className="text-xs">Más info</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              <CollapsibleContent>
                <div className="px-3.5 pb-4 pt-0 space-y-4">
                  <div className="pl-3 border-l-2 border-slate-100 space-y-4">
                  
                  {/* Brief/Context */}
                  <div className="text-sm text-slate-600 leading-relaxed">
                    {item.expansion?.context || item.brief}
                  </div>

                  {/* Detailed Questions */}
                  {item.expansion?.questions_for_agent && item.expansion.questions_for_agent.length > 1 && (
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Más preguntas para el agente</h4>
                      <ul className="space-y-1.5">
                        {item.expansion.questions_for_agent.slice(1).map((q, qIdx) => (
                          <li key={qIdx} className="text-sm text-slate-700 flex gap-2">
                            <span className="text-slate-400">•</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Steps */}
                  {item.expansion?.steps && item.expansion.steps.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <Check className="w-3 h-3" /> Pasos de verificación
                      </h4>
                      <ul className="space-y-1.5">
                        {item.expansion.steps.map((step, stepIdx) => (
                          <li key={stepIdx} className="text-sm text-slate-700 flex gap-2">
                            <span className="text-slate-400 font-mono text-xs mt-0.5">{stepIdx + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Order of Magnitude */}
                  {item.expansion?.oom && (
                    <div className="flex items-center gap-4 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-md inline-flex">
                      {item.expansion.oom.cost && (
                        <div>
                          <span className="text-slate-400 text-xs uppercase mr-1.5">Coste Est. (Solución)</span>
                          <span className="font-medium text-slate-900">
                            {item.expansion.oom.cost.currency}{item.expansion.oom.cost.low.toLocaleString()}-{item.expansion.oom.cost.high.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {item.expansion.oom.time_weeks && (
                        <div className="border-l border-slate-200 pl-4">
                          <span className="text-slate-400 text-xs uppercase mr-1.5">Tiempo</span>
                          <span className="font-medium text-slate-900">
                            {item.expansion.oom.time_weeks.low}-{item.expansion.oom.time_weeks.high} sems
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evidence / Photos */}
                  {hasPhotos && (
                    <div className="mt-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" /> Fotos Relacionadas
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {item.expansion!.photos!.map((photo, photoIdx) => (
                          <div key={photoIdx} className="relative aspect-video rounded-md overflow-hidden border border-slate-200 group">
                            <img 
                              src={photo.url} 
                              alt={photo.note || "Reference photo"} 
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            {photo.note && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 px-2 truncate">
                                {photo.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Links / References */}
                  {hasLinks && (
                    <div className="pt-1">
                       <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3" /> Investigación
                      </h4>
                      <div className="space-y-1.5">
                        {item.expansion!.links!.map((link, linkIdx) => (
                          <a 
                            key={linkIdx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            className="block group"
                          >
                            <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors">
                              <span className="truncate flex-1 flex items-center gap-1 font-medium">
                                <Favicon url={link.url} />
                                {link.title || new URL(link.url).hostname}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {link.snippet && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 pl-5 border-l-2 border-transparent group-hover:border-slate-200 transition-colors">
                                {link.snippet}
                              </p>
                            )}
                          </a>
                        ))}
                    </div>
                    </div>
                  )}
                  
                </div>
            </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};
