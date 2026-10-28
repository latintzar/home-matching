"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useRenovationTierData } from "@/hooks/useRenovationTierData";

interface TierCardData {
  tier: 'estandar' | 'optimo' | 'plus';
  name: string;
  costRange: [number, number]; // EUR
  timelineWeeks: [number, number];
  keyWorkItems: string[]; // First 3-5 work items
  afterImageUrl?: string; // Anchor image URL
}

interface TierCardsProps {
  listingId: string;
  onTierClick: (tier: 'estandar' | 'optimo' | 'plus') => void;
}

const tierConfig = {
  estandar: {
    name: "Estándar",
    uiName: "Livable",
    color: "border-blue-200 hover:border-blue-400"
  },
  optimo: {
    name: "Óptimo",
    uiName: "Comfortable",
    color: "border-green-200 hover:border-green-400"
  },
  plus: {
    name: "Plus",
    uiName: "Competitive",
    color: "border-purple-200 hover:border-purple-400"
  }
};

export const TierCards: React.FC<TierCardsProps> = ({
  listingId,
  onTierClick
}) => {
  // Use shared hook for scope, timeline, and permits (instant if already cached)
  const { scope, timeline, loading: dataLoading, error: dataError } = useRenovationTierData(listingId);
  
  const [tierData, setTierData] = useState<Record<string, TierCardData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch photos separately (TierCards-specific)
  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPhotos = async () => {
      try {
        const [anchorPhotosResult, allPhotosResult] = await Promise.all([
          // Try anchor photos first
          supabase
          .from('after_photos')
          .select('url, tier, room_id, is_anchor')
          .eq('listing_id', parseInt(listingId, 10))
            .eq('is_anchor', true),
          // Fallback: any after photo per tier
          supabase
            .from('after_photos')
            .select('url, tier, room_id')
            .eq('listing_id', parseInt(listingId, 10))
            .order('index', { ascending: true })
        ]);

        const { data: anchorPhotosData } = anchorPhotosResult;
        const { data: allPhotosData } = allPhotosResult;

        if (cancelled) return;

        // Process tier data using shared hook data
        const tiers: Record<string, TierCardData> = {};

        // Map Spanish tier names to UI tier names for after_photos lookup
        const tierMap: Record<'estandar' | 'optimo' | 'plus', 'livable' | 'comfortable' | 'competitive'> = {
          estandar: 'livable',
          optimo: 'comfortable',
          plus: 'competitive'
        };

        // Get anchor images by tier (map UI tier names back to Spanish tier keys)
        // First try anchor photos, then fallback to any photo for that tier
        const anchorImagesByTier: Record<string, string> = {};
        
        // First pass: use anchor photos
        if (anchorPhotosData && anchorPhotosData.length > 0) {
          anchorPhotosData.forEach((photo) => {
            if (photo.tier && photo.url) {
              const spanishTier = Object.entries(tierMap).find(([_, uiTier]) => uiTier === photo.tier)?.[0];
              if (spanishTier && !anchorImagesByTier[spanishTier]) {
                anchorImagesByTier[spanishTier] = photo.url;
              }
            }
          });
        }

        // Second pass: fill missing tiers with any available photo
        if (allPhotosData && allPhotosData.length > 0) {
          for (const tierKey of ['estandar', 'optimo', 'plus'] as const) {
            if (!anchorImagesByTier[tierKey]) {
              const uiTier = tierMap[tierKey];
              const fallbackPhoto = allPhotosData.find((photo: any) => photo.tier === uiTier && photo.url);
              if (fallbackPhoto) {
                anchorImagesByTier[tierKey] = fallbackPhoto.url;
              }
            }
          }
        }

        // Process tier data using shared hook data (scope and timeline)
        for (const tierKey of ['estandar', 'optimo', 'plus'] as const) {
          const tierScope = scope?.tiers?.[tierKey];
          if (!tierScope) continue;

          const workItems = Array.isArray(tierScope.work_items) ? tierScope.work_items : [];
          const costRangeArray = Array.isArray(tierScope.total_estimate_range_eur) 
            ? tierScope.total_estimate_range_eur 
            : [0, 0];
          const costRange: [number, number] = costRangeArray.length >= 2 
            ? [costRangeArray[0] || 0, costRangeArray[1] || 0]
            : [0, 0];

          // Calculate timeline weeks from phases
          let timelineWeeks: [number, number] = [0, 0];
          const phases = timeline?.tiers?.[tierKey]?.phases || timeline?.phases || [];
          if (Array.isArray(phases) && phases.length > 0) {
            const totalWeeks = phases.reduce((sum: number, phase: any) => {
              return sum + (phase.weeks || phase.duration_weeks || 0);
            }, 0);
            timelineWeeks = [Math.max(0, totalWeeks - 2), totalWeeks + 2]; // Add buffer
          }

          // Get key work items (first 3-5)
          const keyWorkItems = workItems
            .slice(0, 5)
            .map((item: any) => item.name || item.summary || item.label)
            .filter(Boolean);

          tiers[tierKey] = {
            tier: tierKey,
            name: tierConfig[tierKey].name,
            costRange,
            timelineWeeks,
            keyWorkItems,
            afterImageUrl: anchorImagesByTier[tierKey]
          };
        }

        setTierData(tiers);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load tier data");
          setLoading(false);
        }
      }
    };

    fetchPhotos();

    // Subscribe to photo updates only (scope/timeline handled by hook)
    const photosSubscription = supabase
      .channel(`tier-photos-${listingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'after_photos',
        filter: `listing_id=eq.${parseInt(listingId, 10)} AND is_anchor=eq.true`
      }, () => {
        if (!cancelled) fetchPhotos();
      })
      .subscribe();

    return () => {
      cancelled = true;
      photosSubscription.unsubscribe();
    };
  }, [listingId, scope, timeline]); // Re-process when shared data changes

  // Update loading/error state based on shared hook
  useEffect(() => {
    if (dataLoading) {
      setLoading(true);
    } else if (dataError) {
      setError(dataError);
      setLoading(false);
    } else if (scope !== null || timeline !== null) {
      // Data loaded, but photos might still be loading
      // Loading state managed by photos effect
    }
  }, [dataLoading, dataError, scope, timeline]);

  const formatCostRange = (range: [number, number]): string => {
    if (range[0] === 0 && range[1] === 0) return "Precio no disponible";
    return `€${Math.round(range[0] / 1000)}k–€${Math.round(range[1] / 1000)}k`;
  };

  const formatTimeline = (weeks: [number, number]): string => {
    if (weeks[0] === 0 && weeks[1] === 0) return "Duración no disponible";
    if (weeks[0] === weeks[1]) {
      return `${weeks[0]} semana${weeks[0] !== 1 ? 's' : ''}`;
    }
    return `${weeks[0]}–${weeks[1]} semanas`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="aspect-[4/3] bg-muted" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Error al cargar las opciones de renovación: {error}
      </div>
    );
  }

  const tierKeys: Array<'estandar' | 'optimo' | 'plus'> = ['estandar', 'optimo', 'plus'];
  const availableTiers = tierKeys.filter(key => tierData[key]);

  if (availableTiers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay opciones de renovación disponibles para esta propiedad.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {availableTiers.map((tierKey) => {
        const tier = tierData[tierKey];
        const config = tierConfig[tierKey];

        return (
          <Card
            key={tierKey}
            className={cn(
              "group cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border overflow-hidden",
              config.color
            )}
            onClick={() => onTierClick(tierKey)}
          >
            <div className="relative">
              {/* Image */}
              <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                {tier.afterImageUrl ? (
                  <img
                    src={tier.afterImageUrl}
                    alt={`${tier.name} renovation preview`}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">Sin imagen</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="bg-white text-black px-2 py-1 rounded text-sm font-medium">
                    {config.uiName}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 pb-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Costo total</div>
                    <div className="font-semibold">{formatCostRange(tier.costRange)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Duración</div>
                    <div className="font-semibold">{formatTimeline(tier.timelineWeeks)}</div>
                  </div>
                </div>

                {/* Key work items */}
                {tier.keyWorkItems.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <div className="text-xs text-muted-foreground mb-1">Trabajos principales:</div>
                    <ul className="text-xs text-foreground space-y-0.5">
                      {tier.keyWorkItems.slice(0, 3).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-muted-foreground mt-0.5">•</span>
                          <span className="line-clamp-1">{item}</span>
                        </li>
                      ))}
                      {tier.keyWorkItems.length > 3 && (
                        <li className="text-muted-foreground text-xs">
                          +{tier.keyWorkItems.length - 3} más
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-primary mt-3 pt-3 border-t">
                  <span>Ver detalles</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

