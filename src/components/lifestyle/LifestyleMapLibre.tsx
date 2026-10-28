'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';

interface LifestyleMapLibreProps {
  geojsonData?: any;
  center?: { lat: number; lng: number };
  className?: string;
}

export function LifestyleMapLibre({ geojsonData, center, className }: LifestyleMapLibreProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAnchors, setShowAnchors] = useState(true);
  // State to track visibility of individual anchors. Default all true.
  const [activeAnchors, setActiveAnchors] = useState<boolean[]>([]);
    const [showPerfectSweetSpot, setShowPerfectSweetSpot] = useState(true);
    // We now track which opportunity scenario is active (index), or -1 for none
    const [activeOpportunityIndex, setActiveOpportunityIndex] = useState<number>(-1);
    const [showVibeIslands, setShowVibeIslands] = useState(true);
    const [showVibeMarkers, setShowVibeMarkers] = useState(true);

    // Initialize activeAnchors when geojsonData changes
  useEffect(() => {
    if (geojsonData?.anchors) {
        setActiveAnchors(new Array(geojsonData.anchors.length).fill(true));
    }
  }, [geojsonData]);

  // Use a completely public, no-key required OSM tile server as fallback
  // This guarantees the map will load even if Geoapify keys/domains are restricted in this specific browser context
  const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  const validCenter = center && (center.lat !== 0 || center.lng !== 0) 
    ? [center.lng, center.lat] as [number, number]
    : [-3.7038, 40.4168] as [number, number];

  // 1. Initialize Map
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    console.log('🗺️ Initializing LifestyleMapLibre (OSM Fallback Mode)...');

    try {
      const style: maplibregl.StyleSpecification = {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [OSM_TILE_URL],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      };

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: style,
        center: validCenter,
        zoom: 12,
        attributionControl: true as any,
        // Explicitly set pixel ratio to avoid blurriness or rendering issues
        pixelRatio: window.devicePixelRatio || 1
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.current.on('load', () => {
        // console.log('✅ MapLibre style loaded (OSM)');
        setIsMapLoaded(true);
        
        // const canvas = map.current?.getCanvas();
        // console.log(`📏 Canvas Dimensions on Load: ${canvas?.width}x${canvas?.height}`);
        // console.log(`📦 Container Dimensions on Load: ${mapContainer.current?.clientWidth}x${mapContainer.current?.clientHeight}`);

        // Force a resize to ensure canvas fills container
        map.current?.resize();
      });

      // Monitor tile loading
      map.current.on('sourcedata', (e) => {
        if (e.sourceId === 'osm-tiles' && e.isSourceLoaded) {
            // console.log('🗺️ OSM Tiles Loaded/Updated');
        }
      });

      map.current.on('moveend', () => {
         // const center = map.current?.getCenter();
         // const zoom = map.current?.getZoom();
         // console.log(`📍 Map moved to: ${center?.lng}, ${center?.lat} | Zoom: ${zoom}`);
      });

      // Add a resize observer to handle container size changes
      const resizeObserver = new ResizeObserver((entries) => {
        // for (const entry of entries) {
        //     console.log(`📏 Container resized: ${entry.contentRect.width}x${entry.contentRect.height}`);
        // }
        map.current?.resize();
      });
      resizeObserver.observe(mapContainer.current);

      map.current.on('error', (e) => {
        console.error('❌ MapLibre error:', e);
        setError(e.error?.message || 'Map error');
      });

    } catch (err: any) {
      console.error('❌ Failed to initialize map:', err);
      setError(err.message);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 2. Update Data & Layers
  useEffect(() => {
    if (!map.current || !isMapLoaded || !geojsonData) return;

    const mapInstance = map.current;

    const updateLayer = (id: string, data: any, color: string, opacity: number) => {
        const sourceId = `${id}-source`;
        const fillLayerId = `${id}-fill`;
        const lineLayerId = `${id}-line`;

        if (mapInstance.getLayer(lineLayerId)) mapInstance.removeLayer(lineLayerId);
        if (mapInstance.getLayer(fillLayerId)) mapInstance.removeLayer(fillLayerId);
        if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

        if (!data) return;

        if (!data.type && !Array.isArray(data)) {
             console.warn(`Invalid GeoJSON for ${id}`, data);
             return;
        }

        try {
            mapInstance.addSource(sourceId, {
                type: 'geojson',
                data: data
            });

            mapInstance.addLayer({
                id: fillLayerId,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': color,
                    'fill-opacity': opacity
                }
            });

            mapInstance.addLayer({
                id: lineLayerId,
                type: 'line',
                source: sourceId,
                paint: {
                    'line-color': color,
                    'line-width': 2,
                    // Ensure line-opacity does not exceed 1.0
                    'line-opacity': Math.min(opacity + 0.4, 1.0)
                }
            });
        } catch (e) {
            console.error(`Error adding layer ${id}:`, e);
        }
    };

    // console.log('🎨 Updating Map Layers with data:', geojsonData);

    const anchorsCollection = {
        type: 'FeatureCollection',
        features: geojsonData.anchors || []
    };

    const perfectSweetSpotData = geojsonData.perfectSweetSpot || null;
    const opportunities = geojsonData.opportunities || [];
    const vibeMarkers = geojsonData.vibeMarkers || [];
    const vibePolygons = geojsonData.vibePolygons || [];

    // Update Layers Visibility based on Toggle State
    if (showAnchors) {
        // Separate anchors by type to color them differently
        if (geojsonData.anchors && geojsonData.anchors.length > 0) {
            // Define a color palette for different anchors (Extended to 10 distinct colors)
            const anchorColors = [
                '#3B82F6', // Blue
                '#EF4444', // Red
                '#10B981', // Green
                '#F59E0B', // Yellow
                '#8B5CF6', // Purple
                '#06B6D4', // Cyan
                '#EC4899', // Pink
                '#F97316', // Orange
                '#14B8A6', // Teal
                '#6366F1'  // Indigo
            ];
            
            geojsonData.anchors.forEach((anchor: any, index: number) => {
                const layerId = `anchor-${index}`;
                const color = anchorColors[index % anchorColors.length];
                
                // Create a single-feature collection for this anchor
                const singleAnchorData = {
                    type: 'FeatureCollection',
                    features: [anchor]
                };
                
                // Only show if it's active in the state
                if (activeAnchors[index]) {
                    updateLayer(layerId, singleAnchorData, color, 0.4);
                } else {
                    if (mapInstance.getLayer(`${layerId}-fill`)) mapInstance.removeLayer(`${layerId}-fill`);
                    if (mapInstance.getLayer(`${layerId}-line`)) mapInstance.removeLayer(`${layerId}-line`);
                }
            });
        }
    } else {
        // Remove all individual anchor layers
        if (geojsonData.anchors) {
            geojsonData.anchors.forEach((_: any, index: number) => {
                const layerId = `anchor-${index}`;
                if (mapInstance.getLayer(`${layerId}-fill`)) mapInstance.removeLayer(`${layerId}-fill`);
                if (mapInstance.getLayer(`${layerId}-line`)) mapInstance.removeLayer(`${layerId}-line`);
            });
        }
        // Also clean up the old monolithic layer if it exists
        if (mapInstance.getLayer('anchors-fill')) mapInstance.removeLayer('anchors-fill');
        if (mapInstance.getLayer('anchors-line')) mapInstance.removeLayer('anchors-line');
    }

    if (showPerfectSweetSpot && perfectSweetSpotData) {
        // Perfect Sweet Spot in Gold
        updateLayer('perfect-sweetspot', perfectSweetSpotData, '#FFD700', 0.8);
    } else {
        if (mapInstance.getLayer('perfect-sweetspot-fill')) mapInstance.removeLayer('perfect-sweetspot-fill');
        if (mapInstance.getLayer('perfect-sweetspot-line')) mapInstance.removeLayer('perfect-sweetspot-line');
    }

    // Opportunity Layer Logic
    // Clean up any existing opportunity layers first
    opportunities.forEach((_: any, idx: number) => {
        if (mapInstance.getLayer(`opportunity-${idx}-fill`)) mapInstance.removeLayer(`opportunity-${idx}-fill`);
        if (mapInstance.getLayer(`opportunity-${idx}-line`)) mapInstance.removeLayer(`opportunity-${idx}-line`);
        if (mapInstance.getSource(`opportunity-${idx}-source`)) mapInstance.removeSource(`opportunity-${idx}-source`);
    });

    if (activeOpportunityIndex >= 0 && opportunities[activeOpportunityIndex]) {
        const opp = opportunities[activeOpportunityIndex];
        updateLayer(`opportunity-${activeOpportunityIndex}`, opp.geometry, opp.color || '#60A5FA', 0.6);
    }

    // 3. Render Vibe Layers (Markers + Polygons)
    // Clean up previous vibe layers first
    const vibeLayerIds = ['vibe-markers', 'vibe-polygons-fill', 'vibe-polygons-line'];
    const vibeSourceIds = ['vibe-markers', 'vibe-polygons'];
    
    vibeLayerIds.forEach(id => {
        if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    });
    vibeSourceIds.forEach(id => {
        if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    });

    if (showVibeIslands && vibePolygons.length > 0) {
        const polySourceId = 'vibe-polygons';
        mapInstance.addSource(polySourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: vibePolygons }
        });
        
        mapInstance.addLayer({
            id: 'vibe-polygons-fill',
            type: 'fill',
            source: polySourceId,
            paint: {
                'fill-color': '#10B981', // Green Islands
                'fill-opacity': 0.3
            }
        });
        mapInstance.addLayer({
            id: 'vibe-polygons-line',
            type: 'line',
            source: polySourceId,
            paint: {
                'line-color': '#10B981',
                'line-width': 2
            }
        });
    }

    if (showVibeMarkers && vibeMarkers.length > 0) {
        const markerSourceId = 'vibe-markers';
        mapInstance.addSource(markerSourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: vibeMarkers }
        });

        mapInstance.addLayer({
            id: 'vibe-markers',
            type: 'circle',
            source: markerSourceId,
            paint: {
                'circle-radius': 6,
                'circle-color': [
                    'match',
                    ['get', 'layer'],
                    'amenities', '#10B981', // Green
                    'gentrification_high', '#EF4444', // Red
                    'gentrification_low', '#3B82F6', // Blue
                    'lunch', '#F59E0B', // Orange
                    'italian sandwich', '#F59E0B', // Orange (Same as lunch)
                    'menu del dia', '#0EA5E9', // Light Blue (Opportunity)
                    'valid_coworking_gold', '#8B5CF6', // Purple (Matches Work Theme)
                    'valid_coworking_silver', '#6366F1', // Indigo (Matches Opportunity Theme)
                    '#888888' // Default
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });
        
        // Add popups on click
        mapInstance.on('click', 'vibe-markers', (e) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const props = feature.properties;
            
            // @ts-ignore
            const coordinates = feature.geometry.coordinates.slice();
            
            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <div class="p-1">
                        <strong class="block text-sm">${props?.name}</strong>
                        <div class="text-xs text-gray-600">
                            <span class="font-bold">${props?.rating}⭐</span> (${props?.reviews} reviews)
                        </div>
                        <div class="text-xs mt-1 capitalize px-2 py-0.5 rounded-full inline-block bg-gray-100 text-gray-800">
                            ${props?.layer.replace('_', ' ')}
                        </div>
                    </div>
                `)
                .addTo(mapInstance);
        });
        
        // Change cursor on hover
        mapInstance.on('mouseenter', 'vibe-markers', () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
        });
        mapInstance.on('mouseleave', 'vibe-markers', () => {
            mapInstance.getCanvas().style.cursor = '';
        });
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    try {
        if (geojsonData.anchors && Array.isArray(geojsonData.anchors)) {
            geojsonData.anchors.forEach((f: any) => {
                if (!f) return;
                const bbox = turf.bbox(f);
                bounds.extend([bbox[0], bbox[1]]);
                bounds.extend([bbox[2], bbox[3]]);
                hasBounds = true;
            });
        }
        if (geojsonData.sweetSpot) {
            const bbox = turf.bbox(geojsonData.sweetSpot);
            bounds.extend([bbox[0], bbox[1]]);
            bounds.extend([bbox[2], bbox[3]]);
            hasBounds = true;
        }

        if (hasBounds) {
            console.log('🔎 Fitting bounds:', bounds.toArray());
            // Only fit bounds on initial load, not on every toggle update
            // We check if the map center is still at default or close to it
            // Actually, the best way is to track if we've ever fitted bounds for this specific geojson ID
            // For now, we just don't refit if map is already moved, or we accept the user wants to stay put.
            // A simple heuristic: Only fit bounds if activeAnchors changed length OR first load
            
            // FIX: Only fit bounds if we haven't done it yet for this dataset
            // OR if the user explicitly requests it (e.g. by switching profile, which is a new component mount)
            // Since this useEffect runs on toggles, we need to prevent re-fitting.
            
            // We can use a ref to track if we've fitted for this data
        }
    } catch (e) {
        console.error('Error fitting bounds:', e);
    }

  }, [isMapLoaded, geojsonData, showAnchors, activeAnchors, showPerfectSweetSpot, activeOpportunityIndex, showVibeIslands, showVibeMarkers]); 

  // Ref to track if we've fitted bounds for current data
  const hasFittedBounds = useRef<boolean>(false);
  
  // Reset fit flag when data changes entirely
  useEffect(() => {
      hasFittedBounds.current = false;
  }, [geojsonData]);

  // Separate effect just for bounds fitting
  useEffect(() => {
      if (!map.current || !isMapLoaded || !geojsonData || hasFittedBounds.current) return;
      
      const bounds = new maplibregl.LngLatBounds();
      let hasBounds = false;

      try {
        if (geojsonData.anchors && Array.isArray(geojsonData.anchors)) {
            geojsonData.anchors.forEach((f: any) => {
                if (!f) return;
                const bbox = turf.bbox(f);
                bounds.extend([bbox[0], bbox[1]]);
                bounds.extend([bbox[2], bbox[3]]);
                hasBounds = true;
            });
        }
        
        // If we have a sweet spot, ensure it's included
        if (geojsonData.sweetSpot) {
             const bbox = turf.bbox(geojsonData.sweetSpot);
             bounds.extend([bbox[0], bbox[1]]);
             bounds.extend([bbox[2], bbox[3]]);
             hasBounds = true;
        }

        if (hasBounds) {
            console.log('🔎 Fitting bounds (Initial)...');
            map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
            hasFittedBounds.current = true;
        }
      } catch(e) {
          console.error("Bounds fit error", e);
      }
  }, [isMapLoaded, geojsonData]);

  // 3. Handle Center Update
  useEffect(() => {
      if (!map.current || !isMapLoaded) return;
      if (geojsonData) return;
      
      map.current.flyTo({ center: validCenter, zoom: 12 });
  }, [center, isMapLoaded]);

  return (
    <div className={`w-full h-full relative notranslate ${className || ''}`} translate="no">
      {/* Debug Info Overlay - Removed */}
      
      {/* Layer Controls */}
      {isMapLoaded && (
        <div className="absolute top-2 right-2 bg-white/90 p-2 rounded shadow-md z-10 flex flex-col gap-2 text-xs border border-gray-200">
            <label className="flex items-center space-x-2 cursor-pointer border-b border-gray-100 pb-1 mb-1">
                <input 
                    type="checkbox" 
                    checked={showAnchors} 
                    onChange={(e) => {
                        setShowAnchors(e.target.checked);
                        // If turning on, enable all. If turning off, keep state but they won't render due to parent check.
                        if (e.target.checked) {
                            setActiveAnchors(new Array(geojsonData?.anchors?.length || 0).fill(true));
                        }
                    }}
                    className="rounded text-gray-600 focus:ring-gray-500"
                />
                <span className="font-semibold">All Isochrones</span>
            </label>

            {/* Individual Anchor Toggles */}
            {showAnchors && geojsonData?.anchors?.map((anchor: any, index: number) => {
                const anchorColors = [
                    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
                    '#06B6D4', '#EC4899', '#F97316', '#14B8A6', '#6366F1'
                ];
                const color = anchorColors[index % anchorColors.length];
                const type = anchor.properties?.type || `Anchor ${index + 1}`;
                const mode = anchor.properties?.mode || '';
                
                return (
                    <label key={index} className="flex items-center space-x-2 cursor-pointer pl-2">
                        <input 
                            type="checkbox" 
                            checked={!!activeAnchors[index]} 
                            onChange={(e) => {
                                const newActive = [...activeAnchors];
                                newActive[index] = e.target.checked;
                                setActiveAnchors(newActive);
                            }}
                            className="rounded focus:ring-0"
                            style={{ color: color }}
                        />
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                            <span className="truncate max-w-[150px]">{type} {mode && `(${mode})`}</span>
                        </span>
                    </label>
                );
            })}

            <div className="border-t border-gray-100 pt-1 mt-1 space-y-1">
                {geojsonData?.perfectSweetSpot && (
                    <label className="flex items-center space-x-2 cursor-pointer bg-yellow-50 p-1 rounded border border-yellow-100">
                        <input 
                            type="checkbox" 
                            checked={showPerfectSweetSpot} 
                            onChange={(e) => setShowPerfectSweetSpot(e.target.checked)}
                            className="rounded text-yellow-500 focus:ring-yellow-400"
                        />
                        <span className="flex items-center gap-1 font-bold text-sm text-yellow-800">
                            <span className="w-3 h-3 bg-[#FFD700] border border-yellow-600 inline-block rounded-full"></span>
                            Perfect Sweet Spot 🏆
                        </span>
                    </label>
                )}

                {/* Scenarios Section */}
                {geojsonData?.opportunities && geojsonData.opportunities.length > 0 && (
                    <div className="pt-2">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Explore Trade-offs</div>
                        <div className="space-y-1">
                            {geojsonData.opportunities.map((opp: any, idx: number) => (
                                <div key={idx} className="group">
                                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input 
                                            type="radio" // Use radio behavior
                                            name="opportunity-toggle"
                                            checked={activeOpportunityIndex === idx} 
                                            onChange={() => setActiveOpportunityIndex(activeOpportunityIndex === idx ? -1 : idx)}
                                            onClick={(e) => {
                                                // Allow unchecking by clicking again
                                                if (activeOpportunityIndex === idx) {
                                                    setActiveOpportunityIndex(-1);
                                                    // @ts-ignore
                                                    e.target.checked = false;
                                                }
                                            }}
                                            className="rounded-full text-blue-500 focus:ring-blue-400"
                                        />
                                        <div className="flex flex-col">
                                            <span className="flex items-center gap-1 font-semibold text-xs text-gray-700">
                                                <span 
                                                    className="w-2 h-2 rounded-full" 
                                                    style={{ backgroundColor: opp.color || '#60A5FA' }}
                                                ></span>
                                                {opp.name}
                                            </span>
                                        </div>
                                    </label>
                                    {/* Helper text on hover or active */}
                                    {activeOpportunityIndex === idx && (
                                        <div className="text-[10px] text-gray-500 pl-6 pr-1 pb-1 leading-tight italic border-l-2 border-blue-100 ml-1">
                                            {opp.justification}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {geojsonData?.vibePolygons?.length > 0 && (
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showVibeIslands} 
                            onChange={(e) => setShowVibeIslands(e.target.checked)}
                            className="rounded text-green-600 focus:ring-green-500"
                        />
                        <span className="flex items-center gap-1 font-medium text-xs text-green-700">
                            <span className="w-3 h-3 bg-[#10B981] opacity-30 border border-[#10B981] inline-block rounded-sm"></span>
                            Vibe Islands (Bakeries)
                        </span>
                    </label>
                )}

                {geojsonData?.vibeMarkers?.length > 0 && (
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showVibeMarkers} 
                            onChange={(e) => setShowVibeMarkers(e.target.checked)}
                            className="rounded text-gray-600 focus:ring-gray-500"
                        />
                        <span className="flex items-center gap-1 font-medium text-xs text-gray-600">
                            📍 Show Pins
                        </span>
                    </label>
                )}
            </div>
        </div>
      )}

      {/* Map Container - using w-full h-full instead of absolute inset-0 to ensure it takes up space naturally */}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg overflow-hidden bg-gray-200" 
        style={{ minHeight: '400px' }} // Failsafe minimum height
      />
      {error && (
        <div className="absolute top-2 left-2 bg-red-100 text-red-800 p-2 rounded text-xs z-10 max-w-[200px]">
          Map Error: {error}
        </div>
      )}
      {!isMapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 z-10">
          <span className="text-gray-500 text-sm animate-pulse">Loading Map (OSM)...</span>
        </div>
      )}
      {isMapLoaded && (
        <div className="absolute bottom-1 left-1 bg-white/80 px-1 rounded text-[10px] text-gray-500 z-10 pointer-events-none">
          Source: OpenStreetMap
        </div>
      )}
    </div>
  );
}
