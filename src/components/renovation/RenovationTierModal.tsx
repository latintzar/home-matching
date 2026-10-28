"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TierBeforeAfterCarousel } from "@/components/renovation/RenovationSlider";
import { Tier } from "@/types/renovation";
import { RenovationTier, formatTimelineDuration } from "@/hooks/useRenovationTiers";
import Timeline from '@mui/lab/Timeline';
import { DEFAULT_TIMELINE_PHASES_5 } from '@/types/renovation-templates';
import { supabase } from '@/lib/supabase';
import { useRenovationTierData } from '@/hooks/useRenovationTierData';
import { TimelinePhase } from './TimelinePhase';

interface RenovationTierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierLabel: string;
  tierData: Tier | RenovationTier;
  listingPhotos?: string[];
  listingId?: string;
}

export function RenovationTierModal({ 
  open, 
  onOpenChange, 
  tierLabel, 
  tierData,
  listingPhotos,
  listingId
}: RenovationTierModalProps) {
  const [copied, setCopied] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [currentClusterName, setCurrentClusterName] = useState<string | null>(null);
  const [finalWorkItems, setFinalWorkItems] = useState<Array<any>>([]);
  const [finalTimelinePhases, setFinalTimelinePhases] = useState<Array<any>>([]);
  const [finalPermits, setFinalPermits] = useState<Array<any>>([]);
  const [finalTotals, setFinalTotals] = useState<[number, number] | undefined>(undefined);
  const [openPermits, setOpenPermits] = useState<Record<string, boolean>>({});
  const [hoveredClusterName, setHoveredClusterName] = useState<string | null>(null);

  // Fetch cluster name for a work item (reusable for hover and click)
  const fetchClusterNameForItem = async (item: any): Promise<string | null> => {
    if (!listingId) return null;
    
    // Try room_ref first (cluster ID like "cluster_75")
    if (item.room_ref) {
      const roomRef = item.room_ref;
      // room_ref might be "cluster_75" or just "75" - normalize it
      const clusterId = roomRef.startsWith('cluster_') ? roomRef : `cluster_${roomRef}`;
      
      // Fetch cluster name from room_id
      try {
        const { data: clusterData } = await supabase
          .from('clusters')
          .select('cluster_name, id')
          .eq('listing_id', parseInt(listingId, 10))
          .or(`id.eq.${clusterId.replace('cluster_', '')}`)
          .limit(1)
          .maybeSingle();
        
        if (clusterData?.cluster_name) {
          return clusterData.cluster_name;
        }
      } catch (error) {
        console.error('Error fetching cluster:', error);
      }
        }
        
    // Fallback: try to find cluster from photo_refs
    if (item.photo_refs && item.photo_refs.length > 0) {
      const firstPhotoRef = item.photo_refs[0];
      try {
        // Try to find which cluster contains this photo
        const { data: photoData } = await supabase
          .from('listing_photos')
          .select('room_id')
          .eq('listing_id', parseInt(listingId, 10))
          .eq('url', firstPhotoRef)
          .limit(1)
          .maybeSingle();
        
        if (photoData?.room_id) {
          // Fetch cluster name from clusters
          // Note: listing_photos doesn't have room_id, checking photo_urls instead
          const { data: clusterData } = await supabase
            .from('clusters')
            .select('cluster_name')
            .eq('listing_id', parseInt(listingId, 10))
            .contains('photo_urls', [firstPhotoRef])
            .limit(1)
            .maybeSingle();
          
          if (clusterData?.cluster_name) {
            return clusterData.cluster_name;
          }
        }
      } catch (error) {
        console.error('Error fetching cluster from photo:', error);
        }
    }
    
    return null;
  };

  // Handle work item hover - temporarily change carousel
  const handleWorkItemHover = async (item: any) => {
    const clusterName = await fetchClusterNameForItem(item);
    if (clusterName) {
      setHoveredClusterName(clusterName);
    }
  };

  // Handle work item mouse leave - revert temporary change if not clicked
  const handleWorkItemMouseLeave = () => {
    setHoveredClusterName(null);
  };

  // Handle work item click - make carousel change permanent
  const handleWorkItemClick = async (item: any) => {
    const clusterName = await fetchClusterNameForItem(item);
    if (clusterName) {
      setCurrentClusterName(clusterName);
      setHoveredClusterName(null); // Clear hover state since it's now permanent
    }
  };

  // Use shared hook for instant data loading (cached if TierCards already fetched)
  const { scope, timeline, permits: permitsData } = useRenovationTierData(listingId);
  
  // Process data for current tier
  useEffect(() => {
    if (!listingId || !scope || !timeline) {
      setFinalWorkItems([]);
      setFinalTimelinePhases([]);
      setFinalPermits([]);
      setFinalTotals(undefined);
      return;
    }

    const mapUiToEs: Record<string, string> = { Livable: 'estandar', Comfortable: 'optimo', Competitive: 'plus' };
    const tierKey = mapUiToEs[tierLabel] || 'estandar';

    // Process scope data
    const tierScope = scope.tiers?.[tierKey];
    if (tierScope) {
      const mappedWorkItems = Array.isArray(tierScope.work_items) ? tierScope.work_items.map((item: any) => ({
        id: item.id || `item-${Math.random()}`,
        name: item.name || '',
        subtitle: item.subtitle || '',
        cost_low_eur: item.cost_low_eur || 0,
        cost_high_eur: item.cost_high_eur || 0,
        stage: item.stage || '',
        room_ref: item.room_ref || null,
        photo_refs: item.photo_refs || []
      })) : [];
      
      setFinalWorkItems(mappedWorkItems);
      setFinalTotals(Array.isArray(tierScope.total_estimate_range_eur) ? tierScope.total_estimate_range_eur as [number, number] : undefined);
          } else {
            setFinalWorkItems([]);
            setFinalTotals(undefined);
          }
          
    // Process timeline data
    const phases = timeline.tiers?.[tierKey]?.phases || timeline.phases || [];
            setFinalTimelinePhases(Array.isArray(phases) ? phases : []);
          
    // Process permits data
    if (permitsData) {
      const permits = permitsData.tiers?.[tierKey]?.permits || permitsData.permits || [];
            if (Array.isArray(permits) && permits.length > 0) {
              setFinalPermits(permits);
      } else if (tierScope?.permits) {
              // Fallback to scope_data permits
        setFinalPermits(Array.isArray(tierScope.permits) ? tierScope.permits : []);
            } else {
              setFinalPermits([]);
            }
    } else if (tierScope?.permits) {
            // Fallback to scope_data permits if permits_reports not available
      setFinalPermits(Array.isArray(tierScope.permits) ? tierScope.permits : []);
          } else {
            setFinalPermits([]);
          }
  }, [listingId, tierLabel, scope, timeline, permitsData]);

  // Helper functions to handle both Tier and RenovationTier types
  const isRenovationTier = (data: Tier | RenovationTier): data is RenovationTier => {
    return 'work_items' in data && Array.isArray(data.work_items);
  };

  const getWorkItems = () => {
    if (isRenovationTier(tierData)) {
      return tierData.work_items.map(item => ({
        id: item.name.toLowerCase().replace(/\s+/g, '-'),
        label: item.name,
        trade: item.category,
        permitImpact: item.complexity === 'high' ? 'major' : item.complexity === 'medium' ? 'minor' : 'none',
        time: { min: Math.floor((item.estimated_hours || 40) / 40), max: Math.floor((item.estimated_hours || 80) / 40) },
        cost: { minEur: item.total_cost_min || 0, maxEur: item.total_cost_max || 0 },
        selected: true
      }));
    }
    return tierData.scope || [];
  };

  const getPermits = () => {
    if (isRenovationTier(tierData)) {
      return tierData.permits.map(permit => ({
        step: permit.name,
        owner: "Owner",
        duration: "See details below",
        status: "todo" as const,
        why_needed: permit.why_needed,
        what_needed: permit.what_needed,
        how_obtained: permit.how_obtained
      }));
    }
    return tierData.permitChecklist || [];
  };

  const getTimeline = () => {
    if (isRenovationTier(tierData)) {
      return tierData.timeline.map(milestone => ({
        name: milestone.header,
        description: milestone.subtitle,
        duration_weeks: milestone.duration_weeks,
        order: milestone.order,
        dependencies: milestone.dependencies
      }));
    }
    return DEFAULT_TIMELINE_PHASES_5;
  };

  // Helper functions to get tier properties
  const getTierName = () => {
    if (isRenovationTier(tierData)) {
      return tierData.tier_name.charAt(0).toUpperCase() + tierData.tier_name.slice(1);
    }
    return tierData.name;
  };

  const getPriceRange = () => {
    // Calculate from actual work items (real totals)
    if (finalWorkItems.length > 0) {
      const totalMin = finalWorkItems.reduce((sum, item: any) => sum + (item.cost_low_eur || 0), 0);
      const totalMax = finalWorkItems.reduce((sum, item: any) => sum + (item.cost_high_eur || 0), 0);
      if (totalMin > 0 || totalMax > 0) {
        return `€${Math.round(totalMin / 1000)}k–€${Math.round(totalMax / 1000)}k`;
      }
    }
    // Fallback to database totals if work items not available
    if (finalTotals && finalTotals[0] > 0 && finalTotals[1] > 0) {
      return `€${Math.round(finalTotals[0] / 1000)}k–€${Math.round(finalTotals[1] / 1000)}k`;
    }
    // Last fallback to tierData
    if (isRenovationTier(tierData)) {
      return `€${tierData.total_cost_min?.toLocaleString() || '0'}-€${tierData.total_cost_max?.toLocaleString() || '0'}`;
    }
    return tierData.priceRangeEur || '€0-€0';
  };

  const getTimeEstimate = () => {
    // Prefer finalTimelinePhases from database
    if (finalTimelinePhases.length > 0) {
      const totalWeeks = finalTimelinePhases.reduce((sum, phase) => {
        return sum + (phase.weeks || phase.duration_weeks || 0);
      }, 0);
      const months = Math.max(1, Math.round(totalWeeks / 4.33));
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    // Fallback to tierData
    if (isRenovationTier(tierData)) {
      return `${tierData.total_time_months || 0} months`;
    }
    return tierData.timeEstimate || '0 months';
  };

  // Map UI tier label to tier ID for after_photos lookup
  const getTierId = (): 'livable' | 'comfortable' | 'competitive' => {
    const labelLower = tierLabel.toLowerCase();
    if (labelLower.includes('livable') || labelLower.includes('estandar')) return 'livable';
    if (labelLower.includes('comfortable') || labelLower.includes('optimo')) return 'comfortable';
    if (labelLower.includes('competitive') || labelLower.includes('plus')) return 'competitive';
    return 'livable'; // default
  };

  // Create a compatible tier object for TierBeforeAfterCarousel
  const getCompatibleTier = () => {
    const tierId = getTierId();
    if (isRenovationTier(tierData)) {
      return {
        id: tierId,
        name: getTierName(),
        priceRangeEur: getPriceRange(),
        permitDifficulty: "Minor" as const,
        timeEstimate: getTimeEstimate(),
        scope: getWorkItems(),
        costBreakdown: [],
        permitChecklist: getPermits(),
        beforeAfter: []
      };
    }
    // Ensure tier.id matches the expected format
    return {
      ...tierData,
      id: tierId
    };
  };

  // Handle scroll to show/hide fade effects
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Bottom fade: show when NOT near bottom (fade out as you scroll down)
    const nearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShowBottomFade(!nearBottom);
    
    // Top fade: show when NOT near top (fade in as you scroll up from bottom)
    const nearTop = scrollTop < 50;
    setShowTopFade(!nearTop);
  };

  const scopeItems = [] as any[]; // legacy mapping removed for zero-fallback mode

  const timelinePhases = finalTimelinePhases;

  // Legacy variable removed; permits rendered from finalPermits only (zero fallback)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        fullscreen
        className="overflow-hidden p-0 !bg-white"
        showCloseButton={true}
      >
        <div className="flex flex-col h-full overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b bg-slate-50/70 backdrop-blur flex-shrink-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Renovation Tier</div>
              <DialogTitle className="text-2xl font-bold">
                {tierLabel}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Renovation tier details and before/after photos for {tierLabel}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="p-4 h-full overflow-y-auto">
            <div className="grid grid-cols-1 xl:grid-cols-8 gap-4 h-full">
              {/* Left side: Images (5 columns) */}
              <div className="xl:col-span-5">
                {/* Cluster name above carousel */}
                {(hoveredClusterName || currentClusterName) && (
                  <div className="mb-2">
                    <div className="text-sm font-medium text-foreground">
                      {hoveredClusterName || currentClusterName}
                    </div>
                  </div>
                )}
                <div className="relative rounded-lg border overflow-hidden pb-20">
                  <TierBeforeAfterCarousel 
                    tier={getCompatibleTier()} 
                    beforePhotos={listingPhotos} 
                    listingId={listingId}
                    onClusterNameChange={(name) => {
                      // Only update currentClusterName if not hovering (to avoid conflicts)
                      if (!hoveredClusterName) {
                        setCurrentClusterName(name);
                      }
                    }}
                    currentClusterName={hoveredClusterName || currentClusterName || undefined}
                  />
                  
                  {/* Before/After labels */}
                  <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                    Before
                  </div>
                  <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                    After
                  </div>
                </div>
              </div>
              
              {/* Right side: Content (3 columns) - Scrollable */}
              <div 
                className="xl:col-span-3 overflow-y-auto space-y-6 relative"
                onScroll={handleScroll}
              >
                {/* Dynamic fade overlays - sticky to edges of scrollable container */}
                {showTopFade && (
                  <div className="sticky top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none z-20 -mb-8" />
                )}
                {/* Unified Timeline with Work Items */}
                <section>
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Project Timeline</h3>
                    {!timelinePhases.length ? (
                      <div className="text-sm text-muted-foreground">No timeline data available</div>
                    ) : (
                    <Timeline position="right" sx={{
                      '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
                        '& .MuiTimelineContent-root': { my: 0, pl: 0.5, pb: 3 },
                      '& .MuiTimelineOppositeContent-root': { my: 0, pr: 0.5 },
                        '& .MuiTimelineItem-root': { mb: 4 },
                    }}>
                        {timelinePhases.map((phase: any, idx: number) => {
                          // Calculate cumulative time from start
                          const cumulativeWeeks = timelinePhases.slice(0, idx + 1).reduce((sum: number, p: any) => {
                            return sum + (p.weeks || p.duration_weeks || 0);
                          }, 0);
                          const phaseWeeks = phase.weeks || phase.duration_weeks || 0;
                          const weeksFromStart = idx === 0 ? 0 : cumulativeWeeks - phaseWeeks;
                          
                          // Get work items for this phase (match by stage)
                          const phaseWorkItems = finalWorkItems.filter((item: any) => item.stage === phase.name);
                          
                          // Get permits for this phase (by matching applies_to_work_ids with phase work items)
                          const phaseWorkItemIds = new Set(phaseWorkItems.map((item: any) => item.id));
                          const phasePermits = finalPermits.filter((permit: any) => {
                            const appliesToIds = permit.applies_to_work_ids || [];
                            return appliesToIds.some((id: string) => phaseWorkItemIds.has(id));
                          });
                          
                          // Format cost range (rounded to nearest €100 per spec)
                          const formatCostRange = (low: number, high: number): string => {
                            const roundedLow = Math.round(low / 100) * 100;
                            const roundedHigh = Math.round(high / 100) * 100;
                            return `€${roundedLow.toLocaleString()}–€${roundedHigh.toLocaleString()}`;
                          };
                          
                          return (
                            <TimelinePhase
                              key={idx}
                              phase={phase}
                              phaseIndex={idx}
                              weeksFromStart={weeksFromStart}
                              workItems={phaseWorkItems}
                              permits={phasePermits}
                              openPermits={openPermits}
                              onPermitToggle={(key, open) => {
                                setOpenPermits(prev => ({ ...prev, [key]: open }));
                              }}
                              onWorkItemHover={handleWorkItemHover}
                              onWorkItemMouseLeave={handleWorkItemMouseLeave}
                              onWorkItemClick={handleWorkItemClick}
                              formatCostRange={formatCostRange}
                            />
                          );
                        })}
                      </Timeline>
                    )}
                  </div>
                </section>
                
                
                {/* Bottom fade overlay - sticky to bottom edge */}
                {showBottomFade && (
                  <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none z-20 -mt-8" />
                )}

              </div>
            </div>
          </div>
        </div>

        {/* Summary Card at bottom of modal */}
        <div className="border-t bg-background/95 backdrop-blur flex-shrink-0">
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-8 gap-6">
              {/* Left side: Empty (5 columns) */}
              <div className="xl:col-span-5"></div>
              
              {/* Right side: Summary (3 columns) */}
              <div className="xl:col-span-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Cost</div>
                      <div className="font-semibold text-lg">{getPriceRange()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Duration</div>
                      <div className="font-semibold text-lg">{getTimeEstimate()}</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      className="px-6 hover:bg-primary/80 transition-all duration-200"
                      onClick={() => {
                        const currentUrl = window.location.href;
                        const modalUrl = `${currentUrl}#tier=${tierData.id}`;
                        const message = `Hi! I saw the ${tierLabel} renovation option (${getPriceRange()}, ${getTimeEstimate()}) and I'd like to discuss this further. What would this involve for my specific property? Check it out: ${modalUrl}`;
                        const whatsappUrl = `https://wa.me/1234567890?text=${encodeURIComponent(message)}`;
                        window.open(whatsappUrl, '_blank');
                      }}
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                </svg>
                      Ask Agent
                    </Button>
                    <Button 
                      variant="outline"
                      className="px-3 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-200"
                      onClick={async () => {
                        const currentUrl = window.location.href;
                        const modalUrl = `${currentUrl}#tier=${tierData.id}`;
                        const message = `Hi! I saw the ${tierLabel} renovation option (${getPriceRange()}, ${getTimeEstimate()}) and I'd like to discuss this further. What would this involve for my specific property? Check it out: ${modalUrl}`;
                        try {
                          await navigator.clipboard.writeText(message);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch (error) {
                          console.error('Failed to copy text:', error);
                        }
                      }}
                      title={copied ? "Copied!" : "Copy message"}
                    >
                      {copied ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}