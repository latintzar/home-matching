'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { VibeArea, ViewState } from './types';
import { createCircleGeoJSON } from './types';
import { getPriceTierDisplay, getPriceTierLabel } from '@/lib/vibe-maps/bookingUrls';
import * as turf from '@turf/turf';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 
  "";

// Intersection data for Test 5.3
interface IntersectionData {
  polygonA: {
    feature: GeoJSON.Feature;
    color: string;
    description: string;
    center?: { name: string; lat: number; lng: number };
  };
  polygonB: {
    feature: GeoJSON.Feature;
    color: string;
    description: string;
    center?: { name: string; lat: number; lng: number };
  };
  intersectionZones: GeoJSON.Feature[];
  intersectionArea: number;
}

// Matrix data for Test 6.2
interface MatrixIsochrone {
  mode: 'walk' | 'transit' | 'drive';
  feature: GeoJSON.Feature;
  color: string;
  radiusKm: number;
}
interface MatrixPerson {
  name: string;
  location: { lat: number; lng: number };
  isochrones: MatrixIsochrone[];
}
interface MatrixCell {
  modeA: 'walk' | 'transit' | 'drive';
  modeB: 'walk' | 'transit' | 'drive';
  intersection: GeoJSON.Feature | null;
  areaSqKm: number;
  sizeLabel: string;
  blendedColor: string;
}
interface MatrixData {
  personA: MatrixPerson;
  personB: MatrixPerson;
  cells: MatrixCell[];
  travelTime: number;
  travelUnit: string;
}

interface MapPanelProps {
  areas: VibeArea[];
  currentAreaIndex: number;
  viewState: ViewState;
  onViewStateChange: (viewState: ViewState) => void;
  onAreaSelect: (index: number) => void;
  showCard: boolean;
  cardPersistent: boolean;
  onMapClick: () => void;
  onCardShow: () => void;
  city?: string;
  queryType?: 'activity' | 'stay';
  showTravelLinesMode?: boolean;  // True when Test 3.2 is active
  travelLinePairs?: string[];  // Which line pairs to show: 'stay-to-activity', 'activity-to-activity', 'stay-to-stay'
  intersectionData?: IntersectionData | null;  // For Test 5.3
  matrixData?: MatrixData | null;  // For Test 6.2
  hoveredCell?: MatrixCell | null;  // Currently hovered matrix cell
  onCellHover?: (cell: MatrixCell | null) => void;  // Callback when cell is hovered
}

export default function MapPanel({
  areas,
  currentAreaIndex,
  viewState,
  onViewStateChange,
  onAreaSelect,
  showCard,
  cardPersistent,
  onMapClick,
  onCardShow,
  city,
  queryType = 'activity',
  showTravelLinesMode = false,
  travelLinePairs = ['stay-to-activity', 'activity-to-activity'],
  intersectionData = null,
  matrixData = null,
  hoveredCell = null,
  onCellHover,
}: MapPanelProps) {
  const mapRef = useRef<MapRef>(null);
  const currentArea = areas[currentAreaIndex];
  
  // Track if intro has been dismissed
  const [introDismissed, setIntroDismissed] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  
  // Travel lines toggle (Test 3.2)
  const [showTravelLines, setShowTravelLines] = useState(true);
  
  // Original polygons toggle (Test 5.3)
  const [showOriginalPolygons, setShowOriginalPolygons] = useState(true);
  
  // Helper to blend two hex colors
  const blendColors = useCallback((color1: string, color2: string, ratio = 0.5): string => {
    const hex = (c: string) => parseInt(c, 16);
    const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
    const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));
    const r = Math.round(r1 * ratio + r2 * (1 - ratio));
    const g = Math.round(g1 * ratio + g2 * (1 - ratio));
    const b = Math.round(b1 * ratio + b2 * (1 - ratio));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }, []);
  
  // Reset intro state when areas change (new search)
  useEffect(() => {
    if (areas.length > 0) {
      setIntroDismissed(false);
      setShowIntro(true);
    } else {
      setShowIntro(false);
    }
  }, [areas.length, city]);

  // Fit bounds to all areas
  const zoomToFitAllCircles = useCallback(() => {
    if (!mapRef.current || areas.length === 0) return;
    
    const lngs = areas.map(a => a.lng);
    const lats = areas.map(a => a.lat);
    
    const minLng = Math.min(...lngs) - 0.02;
    const maxLng = Math.max(...lngs) + 0.02;
    const minLat = Math.min(...lats) - 0.02;
    const maxLat = Math.max(...lats) + 0.02;
    
    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 80, duration: 1000 }
    );
  }, [areas]);

  // Zoom to fit when areas change
  useEffect(() => {
    if (areas.length > 0 && mapRef.current) {
      setTimeout(() => zoomToFitAllCircles(), 500);
    }
  }, [areas, zoomToFitAllCircles]);
  
  // Handle map resize when sidebar closes
  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 100);
    return () => clearTimeout(timer);
  });

  // Fly to area when selected
  const flyToArea = useCallback((area: VibeArea) => {
    mapRef.current?.flyTo({
      center: [area.lng, area.lat],
      zoom: 15,
      duration: 1000
    });
  }, []);

  const handleCircleClick = useCallback((index: number) => {
    onAreaSelect(index);
    onCardShow();
    flyToArea(areas[index]);
    setIntroDismissed(true);
    setShowIntro(false);
  }, [areas, flyToArea, onAreaSelect, onCardShow]);

  const handleNavigate = (direction: number) => {
    const newIndex = (currentAreaIndex + direction + areas.length) % areas.length;
    onAreaSelect(newIndex);
    mapRef.current?.flyTo({
      center: [areas[newIndex].lng, areas[newIndex].lat],
      zoom: 15,
      duration: 800
    });
  };
  
  // Handle "Let's Go" - select first area
  const handleLetsGo = () => {
    setIntroDismissed(true);
    setShowIntro(false);
    if (areas.length > 0) {
      onAreaSelect(0);
      onCardShow();
      flyToArea(areas[0]);
    }
  };
  
  // Handle "See All" - zoom to fit all circles and show intro again
  const handleSeeAll = () => {
    setIntroDismissed(false); // Reset so intro card shows
    setShowIntro(true);
    onMapClick(); // Close any open card
    zoomToFitAllCircles();
  };

  // Handle map click - detect if a circle was clicked
  const handleMapClick = useCallback((event: MapMouseEvent) => {
    if (!mapRef.current || areas.length === 0) {
      if (!cardPersistent) onMapClick();
      return;
    }

    // Get all circle fill layer IDs
    const circleLayerIds = areas.map((_, i) => `circle-fill-${i}`);
    
    // Query features at click point
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: circleLayerIds
    });

    if (features && features.length > 0) {
      // Extract index from layer ID (e.g., "circle-fill-2" -> 2)
      const layerId = features[0].layer?.id;
      if (layerId) {
        const match = layerId.match(/circle-fill-(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          handleCircleClick(index);
          return;
        }
      }
    }

    // No circle clicked - close card if not persistent
    if (!cardPersistent) {
      onMapClick();
    }
  }, [areas, cardPersistent, handleCircleClick, onMapClick]);

  // Set cursor to pointer when hovering over circles
  const handleMouseMove = useCallback((event: MapMouseEvent) => {
    if (!mapRef.current || areas.length === 0) return;
    
    const circleLayerIds = areas.map((_, i) => `circle-fill-${i}`);
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: circleLayerIds
    });

    mapRef.current.getCanvas().style.cursor = features && features.length > 0 ? 'pointer' : '';
  }, [areas]);
  
  // Check result types
  const isDualLayer = areas.some(a => a.dualLayerType);
  const isCityCharacter = areas.some(a => a.characterType);
  const stayAreas = isDualLayer ? areas.filter(a => a.dualLayerType === 'stay') : [];
  const activityAreas = isDualLayer ? areas.filter(a => a.dualLayerType === 'activity') : [];
  
  // Calculate travel lines for dual-layer mode (Test 3.2)
  interface TravelLine {
    id: string;
    from: { name: string; lat: number; lng: number };
    to: { name: string; lat: number; lng: number };
    type: 'stay-to-activity' | 'activity-to-activity' | 'stay-to-stay';
    distanceKm: number;
    walkMin: number;
    transitMin: number;
    driveMin: number;
    midpoint: { lat: number; lng: number };
  }
  
  const travelLines = useMemo<TravelLine[]>(() => {
    if (!isDualLayer || stayAreas.length === 0 || activityAreas.length === 0) return [];
    
    const lines: TravelLine[] = [];
    
    // Stay → Activity lines (purple) - only if configured
    if (travelLinePairs.includes('stay-to-activity')) {
      stayAreas.forEach((stay, si) => {
        activityAreas.forEach((activity, ai) => {
          const from = turf.point([stay.lng, stay.lat]);
          const to = turf.point([activity.lng, activity.lat]);
          const distanceKm = turf.distance(from, to, { units: 'kilometers' });
          const midpoint = turf.midpoint(from, to);
          
          lines.push({
            id: `stay${si}-act${ai}`,
            from: { name: stay.name, lat: stay.lat, lng: stay.lng },
            to: { name: activity.name, lat: activity.lat, lng: activity.lng },
            type: 'stay-to-activity',
            distanceKm,
            walkMin: Math.round(distanceKm * 12), // 5 km/h walking
            transitMin: Math.round(distanceKm * 4), // 15 km/h transit avg
            driveMin: Math.round(distanceKm * 2),  // 30 km/h city driving
            midpoint: {
              lat: midpoint.geometry.coordinates[1],
              lng: midpoint.geometry.coordinates[0]
            }
          });
        });
      });
    }
    
    // Activity → Activity lines (orange) - only if configured
    if (travelLinePairs.includes('activity-to-activity')) {
      for (let i = 0; i < activityAreas.length; i++) {
        for (let j = i + 1; j < activityAreas.length; j++) {
          const from = turf.point([activityAreas[i].lng, activityAreas[i].lat]);
          const to = turf.point([activityAreas[j].lng, activityAreas[j].lat]);
          const distanceKm = turf.distance(from, to, { units: 'kilometers' });
          const midpoint = turf.midpoint(from, to);
          
          lines.push({
            id: `act${i}-act${j}`,
            from: { name: activityAreas[i].name, lat: activityAreas[i].lat, lng: activityAreas[i].lng },
            to: { name: activityAreas[j].name, lat: activityAreas[j].lat, lng: activityAreas[j].lng },
            type: 'activity-to-activity',
            distanceKm,
            walkMin: Math.round(distanceKm * 12),
            transitMin: Math.round(distanceKm * 4),
            driveMin: Math.round(distanceKm * 2),
            midpoint: {
              lat: midpoint.geometry.coordinates[1],
              lng: midpoint.geometry.coordinates[0]
            }
          });
        }
      }
    }
    
    // Stay → Stay lines (green) - only if configured (e.g., comparing accommodation options)
    if (travelLinePairs.includes('stay-to-stay') && stayAreas.length > 1) {
      for (let i = 0; i < stayAreas.length; i++) {
        for (let j = i + 1; j < stayAreas.length; j++) {
          const from = turf.point([stayAreas[i].lng, stayAreas[i].lat]);
          const to = turf.point([stayAreas[j].lng, stayAreas[j].lat]);
          const distanceKm = turf.distance(from, to, { units: 'kilometers' });
          const midpoint = turf.midpoint(from, to);
          
          lines.push({
            id: `stay${i}-stay${j}`,
            from: { name: stayAreas[i].name, lat: stayAreas[i].lat, lng: stayAreas[i].lng },
            to: { name: stayAreas[j].name, lat: stayAreas[j].lat, lng: stayAreas[j].lng },
            type: 'stay-to-stay',
            distanceKm,
            walkMin: Math.round(distanceKm * 12),
            transitMin: Math.round(distanceKm * 4),
            driveMin: Math.round(distanceKm * 2),
            midpoint: {
              lat: midpoint.geometry.coordinates[1],
              lng: midpoint.geometry.coordinates[0]
            }
          });
        }
      }
    }
    
    return lines;
  }, [isDualLayer, stayAreas, activityAreas, travelLinePairs]);
  
  // Create GeoJSON for travel lines
  const travelLinesGeoJSON = useMemo(() => {
    if (travelLines.length === 0) return null;
    
    return {
      type: 'FeatureCollection' as const,
      features: travelLines.map(line => ({
        type: 'Feature' as const,
        properties: {
          id: line.id,
          type: line.type,
          walkMin: line.walkMin,
          transitMin: line.transitMin
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [line.from.lng, line.from.lat],
            [line.to.lng, line.to.lat]
          ]
        }
      }))
    };
  }, [travelLines]);
  
  // Character type labels and colors
  const characterTypeLabels: Record<string, { label: string; emoji: string }> = {
    'historic': { label: 'Historic', emoji: '🏛️' },
    'nightlife': { label: 'Nightlife', emoji: '🌙' },
    'cultural': { label: 'Cultural', emoji: '🎭' },
    'foodie': { label: 'Foodie', emoji: '🍽️' },
    'local': { label: 'Local', emoji: '🏘️' },
    'tourist': { label: 'Tourist', emoji: '📸' },
    'nature': { label: 'Nature', emoji: '🌳' },
    'shopping': { label: 'Shopping', emoji: '🛍️' }
  };
  
  // Determine intro content based on query type
  const getIntroContent = () => {
    if (isCityCharacter) {
      return {
        emoji: '🏙️',
        title: `${city || 'City'} Guide`,
        subtitle: `${areas.length} neighborhoods to know`,
        description: 'Each area is color-coded by vibe. Click any to see its character and how to explore it.',
        cta: "Explore the City"
      };
    }
    if (isDualLayer) {
      return {
        emoji: '🗺️',
        title: `Your ${city || 'trip'} plan`,
        subtitle: `${stayAreas.length} places to stay + ${activityAreas.length} areas to explore`,
        description: 'Blue circles are for accommodation, orange circles are for activities.',
        cta: "Let's Plan It"
      };
    }
    if (queryType === 'stay') {
      return {
        emoji: '🏨',
        title: `${areas.length} areas to stay in ${city || 'this city'}`,
        subtitle: 'Perfect neighborhoods for your accommodation',
        description: 'Each area includes price tiers and direct booking links to Airbnb and Booking.com.',
        cta: "Let's Find Your Stay"
      };
    }
    return {
      emoji: '🗺️',
      title: `${areas.length} neighborhoods in ${city || 'this city'}`,
      subtitle: 'Perfect spots for your trip',
      description: 'Each area includes itinerary suggestions with Google Maps and TikTok links.',
      cta: "Let's Explore"
    };
  };
  
  const introContent = getIntroContent();
  
  // Get area label for dual-layer mode
  const getAreaLabel = (area: VibeArea, index: number) => {
    if (area.dualLayerType === 'stay') {
      return `STAY #${area.dualLayerIndex || index + 1}`;
    }
    if (area.dualLayerType === 'activity') {
      return `DO #${area.dualLayerIndex || index + 1}`;
    }
    return null;
  };

  return (
    <div className="relative w-full h-full bg-[#0D0D0D]">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => onViewStateChange(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        interactiveLayerIds={areas.map((_, i) => `circle-fill-${i}`)}
      >
        <NavigationControl position="bottom-right" />
        
        {/* Render intersection polygons (Test 5.3) */}
        {intersectionData && (
          <>
            {/* Polygon A - toggleable */}
            {showOriginalPolygons && (
              <Source
                id="polygon-a"
                type="geojson"
                data={intersectionData.polygonA.feature}
              >
                <Layer
                  id="polygon-a-fill"
                  type="fill"
                  paint={{
                    'fill-color': intersectionData.polygonA.color,
                    'fill-opacity': 0.2
                  }}
                />
                <Layer
                  id="polygon-a-border"
                  type="line"
                  paint={{
                    'line-color': intersectionData.polygonA.color,
                    'line-width': 2,
                    'line-opacity': 0.7
                  }}
                />
              </Source>
            )}
            
            {/* Polygon B - toggleable */}
            {showOriginalPolygons && (
              <Source
                id="polygon-b"
                type="geojson"
                data={intersectionData.polygonB.feature}
              >
                <Layer
                  id="polygon-b-fill"
                  type="fill"
                  paint={{
                    'fill-color': intersectionData.polygonB.color,
                    'fill-opacity': 0.2
                  }}
                />
                <Layer
                  id="polygon-b-border"
                  type="line"
                  paint={{
                    'line-color': intersectionData.polygonB.color,
                    'line-width': 2,
                    'line-opacity': 0.7
                  }}
                />
              </Source>
            )}
            
            {/* Intersection zones - blended color from both inputs */}
            {intersectionData.intersectionZones.map((zone, idx) => {
              const blendedColor = blendColors(
                intersectionData.polygonA.color,
                intersectionData.polygonB.color,
                0.5
              );
              return (
                <Source
                  key={`intersection-${idx}`}
                  id={`intersection-${idx}`}
                  type="geojson"
                  data={zone}
                >
                  <Layer
                    id={`intersection-fill-${idx}`}
                    type="fill"
                    paint={{
                      'fill-color': blendedColor,
                      'fill-opacity': 0.6
                    }}
                  />
                  <Layer
                    id={`intersection-border-${idx}`}
                    type="line"
                    paint={{
                      'line-color': blendedColor,
                      'line-width': 3,
                      'line-opacity': 0.95
                    }}
                  />
                </Source>
              );
            })}
            
            {/* Center markers for each polygon */}
            {intersectionData.polygonA.center && (
              <Marker
                longitude={intersectionData.polygonA.center.lng}
                latitude={intersectionData.polygonA.center.lat}
              >
                <div 
                  className="px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg"
                  style={{ backgroundColor: intersectionData.polygonA.color }}
                >
                  {intersectionData.polygonA.center.name}
                </div>
              </Marker>
            )}
            {intersectionData.polygonB.center && (
              <Marker
                longitude={intersectionData.polygonB.center.lng}
                latitude={intersectionData.polygonB.center.lat}
              >
                <div 
                  className="px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg"
                  style={{ backgroundColor: intersectionData.polygonB.color }}
                >
                  {intersectionData.polygonB.center.name}
                </div>
              </Marker>
            )}
          </>
        )}
        
        {/* Render transport matrix isochrones (Test 6.2) */}
        {matrixData && (
          <>
            {/* Person A isochrones - very faint */}
            {matrixData.personA.isochrones.map((iso, idx) => (
              <Source
                key={`pA-${iso.mode}`}
                id={`person-a-${iso.mode}`}
                type="geojson"
                data={iso.feature}
              >
                <Layer
                  id={`pA-fill-${idx}`}
                  type="fill"
                  paint={{
                    'fill-color': iso.color,
                    'fill-opacity': 0.08
                  }}
                />
                <Layer
                  id={`pA-border-${idx}`}
                  type="line"
                  paint={{
                    'line-color': iso.color,
                    'line-width': 1,
                    'line-opacity': 0.3,
                    'line-dasharray': [2, 2]
                  }}
                />
              </Source>
            ))}
            
            {/* Person B isochrones - very faint */}
            {matrixData.personB.isochrones.map((iso, idx) => (
              <Source
                key={`pB-${iso.mode}`}
                id={`person-b-${iso.mode}`}
                type="geojson"
                data={iso.feature}
              >
                <Layer
                  id={`pB-fill-${idx}`}
                  type="fill"
                  paint={{
                    'fill-color': iso.color,
                    'fill-opacity': 0.08
                  }}
                />
                <Layer
                  id={`pB-border-${idx}`}
                  type="line"
                  paint={{
                    'line-color': iso.color,
                    'line-width': 1,
                    'line-opacity': 0.3,
                    'line-dasharray': [2, 2]
                  }}
                />
              </Source>
            ))}
            
            {/* Hovered intersection - bright */}
            {hoveredCell?.intersection && (
              <Source
                id="hovered-intersection"
                type="geojson"
                data={hoveredCell.intersection}
              >
                <Layer
                  id="hovered-int-fill"
                  type="fill"
                  paint={{
                    'fill-color': hoveredCell.blendedColor,
                    'fill-opacity': 0.5
                  }}
                />
                <Layer
                  id="hovered-int-border"
                  type="line"
                  paint={{
                    'line-color': hoveredCell.blendedColor,
                    'line-width': 3,
                    'line-opacity': 0.9
                  }}
                />
              </Source>
            )}
            
            {/* Person markers */}
            <Marker
              longitude={matrixData.personA.location.lng}
              latitude={matrixData.personA.location.lat}
            >
              <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-blue-600 shadow-lg border-2 border-white">
                {matrixData.personA.name.split('(')[0].trim()}
              </div>
            </Marker>
            <Marker
              longitude={matrixData.personB.location.lng}
              latitude={matrixData.personB.location.lat}
            >
              <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-red-600 shadow-lg border-2 border-white">
                {matrixData.personB.name.split('(')[0].trim()}
              </div>
            </Marker>
          </>
        )}
        
        {/* Render circles */}
        {areas.map((area, index) => (
          <Source
            key={`circle-${index}`}
            id={`circle-source-${index}`}
            type="geojson"
            data={createCircleGeoJSON(area.lng, area.lat, area.radius || 400)}
          >
            <Layer
              id={`circle-fill-${index}`}
              type="fill"
              paint={{
                'fill-color': area.color,
                'fill-opacity': currentAreaIndex === index && !showIntro ? 0.4 : 0.25
              }}
            />
            <Layer
              id={`circle-border-${index}`}
              type="line"
              paint={{
                'line-color': area.color,
                'line-width': currentAreaIndex === index && !showIntro ? 3 : 2,
                'line-opacity': 0.8
              }}
            />
          </Source>
        ))}
        
        {/* Travel lines - ONLY when Test 3.2 is active */}
        {showTravelLinesMode && showTravelLines && travelLinesGeoJSON && (
          <>
            {/* Stay → Activity lines (purple dashed) */}
            <Source id="travel-lines-stay" type="geojson" data={{
              type: 'FeatureCollection',
              features: travelLinesGeoJSON.features.filter(f => f.properties.type === 'stay-to-activity')
            }}>
              <Layer
                id="travel-lines-stay-layer"
                type="line"
                paint={{
                  'line-color': '#A855F7',
                  'line-width': 2,
                  'line-opacity': 0.5,
                  'line-dasharray': [4, 4]
                }}
              />
            </Source>
            
            {/* Activity → Activity lines (orange dashed) */}
            <Source id="travel-lines-activity" type="geojson" data={{
              type: 'FeatureCollection',
              features: travelLinesGeoJSON.features.filter(f => f.properties.type === 'activity-to-activity')
            }}>
              <Layer
                id="travel-lines-activity-layer"
                type="line"
                paint={{
                  'line-color': '#F97316',
                  'line-width': 2,
                  'line-opacity': 0.5,
                  'line-dasharray': [4, 4]
                }}
              />
            </Source>
            
            {/* Stay → Stay lines (green dashed) */}
            <Source id="travel-lines-stay-stay" type="geojson" data={{
              type: 'FeatureCollection',
              features: travelLinesGeoJSON.features.filter(f => f.properties.type === 'stay-to-stay')
            }}>
              <Layer
                id="travel-lines-stay-stay-layer"
                type="line"
                paint={{
                  'line-color': '#22C55E',
                  'line-width': 2,
                  'line-opacity': 0.5,
                  'line-dasharray': [4, 4]
                }}
              />
            </Source>
          </>
        )}
        
        {/* Travel time labels at midpoints - ONLY when Test 3.2 is active */}
        {showTravelLinesMode && showTravelLines && travelLines.map(line => (
          <Marker
            key={`time-label-${line.id}`}
            longitude={line.midpoint.lng}
            latitude={line.midpoint.lat}
            anchor="center"
          >
            <div 
              className={`px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                line.type === 'stay-to-activity' 
                  ? 'bg-purple-900/80 text-purple-200 border border-purple-500/50' 
                  : line.type === 'stay-to-stay'
                  ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-500/50'
                  : 'bg-orange-900/80 text-orange-200 border border-orange-500/50'
              }`}
            >
              {line.walkMin} min
            </div>
          </Marker>
        ))}
      </Map>

      {/* "See All" button - only show when intro has been dismissed and a card is visible */}
      {introDismissed && areas.length > 0 && (
        <button
          onClick={handleSeeAll}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-[#1A1A1A]/90 border border-gray-700 rounded-xl text-sm text-gray-300 hover:bg-[#252525] hover:text-white transition-all backdrop-blur-sm z-10"
          aria-label="See all areas"
        >
          <span>🗺️</span>
          <span>See All</span>
        </button>
      )}
      
      {/* Travel Times toggle - ONLY show when Test 3.2 is active */}
      {showTravelLinesMode && travelLines.length > 0 && (
        <button
          onClick={() => setShowTravelLines(!showTravelLines)}
          className={`absolute top-4 right-16 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm z-10 ${
            showTravelLines 
              ? 'bg-emerald-600/90 text-white border border-emerald-500' 
              : 'bg-[#1A1A1A]/90 text-gray-400 border border-gray-700 hover:bg-[#252525] hover:text-gray-300'
          }`}
          aria-label="Toggle travel times"
        >
          {/* iOS-style toggle indicator */}
          <div className={`w-8 h-5 rounded-full flex items-center transition-all ${
            showTravelLines ? 'bg-emerald-400 justify-end' : 'bg-gray-600 justify-start'
          }`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-all`} />
          </div>
          <span>Travel Times</span>
        </button>
      )}
      
      {/* Original Polygons toggle - ONLY show when Test 5.3 intersection data exists */}
      {intersectionData && (
        <button
          onClick={() => setShowOriginalPolygons(!showOriginalPolygons)}
          className={`absolute top-4 right-16 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm z-10 ${
            showOriginalPolygons 
              ? 'bg-violet-600/90 text-white border border-violet-500' 
              : 'bg-[#1A1A1A]/90 text-gray-400 border border-gray-700 hover:bg-[#252525] hover:text-gray-300'
          }`}
          aria-label="Toggle original polygons"
        >
          {/* iOS-style toggle indicator */}
          <div className={`w-8 h-5 rounded-full flex items-center transition-all ${
            showOriginalPolygons ? 'bg-violet-400 justify-end' : 'bg-gray-600 justify-start'
          }`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-all`} />
          </div>
          <span>Show Areas</span>
        </button>
      )}
      
      {/* Transport Matrix Card (Test 6.2) - positioned top-left to avoid test panel */}
      {matrixData && (
        <div className="absolute top-4 left-4 bg-[#0D0D0D]/95 border border-gray-700 rounded-2xl overflow-hidden z-30 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-blue-900/30 to-red-900/30">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">⏱️ {matrixData.travelTime} {matrixData.travelUnit}</div>
              <div className="text-xs font-medium text-gray-300">Transport Matrix</div>
            </div>
          </div>
          
          {/* Matrix Grid */}
          <div className="p-3">
            {/* Header row - Person B modes */}
            <div className="grid grid-cols-4 gap-1 mb-1">
              <div className="text-[10px] text-gray-500 text-center"></div>
              <div className="text-[10px] text-gray-400 text-center flex flex-col items-center">
                <span>🚶</span>
                <span className="text-[8px]">walk</span>
              </div>
              <div className="text-[10px] text-gray-400 text-center flex flex-col items-center">
                <span>🚇</span>
                <span className="text-[8px]">transit</span>
              </div>
              <div className="text-[10px] text-gray-400 text-center flex flex-col items-center">
                <span>🚗</span>
                <span className="text-[8px]">drive</span>
              </div>
            </div>
            
            {/* Matrix rows - Person A modes */}
            {(['walk', 'transit', 'drive'] as const).map((modeA, rowIdx) => (
              <div key={modeA} className="grid grid-cols-4 gap-1 mb-1">
                {/* Row label */}
                <div className="text-[10px] text-gray-400 flex items-center justify-center">
                  {modeA === 'walk' ? '🚶' : modeA === 'transit' ? '🚇' : '🚗'}
                </div>
                
                {/* Cells */}
                {(['walk', 'transit', 'drive'] as const).map((modeB) => {
                  const cell = matrixData.cells.find(c => c.modeA === modeA && c.modeB === modeB);
                  if (!cell) return null;
                  
                  const isHovered = hoveredCell?.modeA === modeA && hoveredCell?.modeB === modeB;
                  const hasOverlap = cell.areaSqKm > 0.1;
                  
                  return (
                    <button
                      key={`${modeA}-${modeB}`}
                      className={`w-12 h-10 rounded-lg text-sm font-bold transition-all ${
                        isHovered 
                          ? 'ring-2 ring-white scale-105' 
                          : hasOverlap 
                            ? 'hover:scale-105' 
                            : 'opacity-50'
                      }`}
                      style={{ 
                        backgroundColor: hasOverlap ? cell.blendedColor : '#1A1A1A',
                        color: hasOverlap ? 'white' : '#666'
                      }}
                      onMouseEnter={() => onCellHover?.(cell)}
                      onMouseLeave={() => onCellHover?.(null)}
                      aria-label={`${modeA} to ${modeB}: ${cell.sizeLabel}`}
                    >
                      {cell.sizeLabel}
                    </button>
                  );
                })}
              </div>
            ))}
            
            {/* Person labels */}
            <div className="flex justify-between mt-2 pt-2 border-t border-gray-800">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-[10px] text-gray-400">{matrixData.personA.name.split('(')[0].trim()}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-[10px] text-gray-400">{matrixData.personB.name.split('(')[0].trim()}</span>
              </div>
            </div>
            
            {/* Hovered cell info */}
            {hoveredCell && (
              <div className="mt-2 pt-2 border-t border-gray-800 text-center">
                <div className="text-xs text-gray-300">
                  {hoveredCell.modeA} + {hoveredCell.modeB}
                </div>
                <div className="text-sm font-bold" style={{ color: hoveredCell.blendedColor }}>
                  {hoveredCell.areaSqKm > 0.1 ? `${hoveredCell.areaSqKm.toFixed(1)} km²` : 'No overlap'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Intro/Overview Card */}
      {showIntro && areas.length > 0 && !introDismissed && (
        <div className="absolute bottom-6 left-6 w-[380px] bg-[#0D0D0D]/95 border border-gray-800 rounded-2xl overflow-hidden z-20 backdrop-blur-xl">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-[#FF6B6B]/20 to-[#FF8E53]/20 px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center text-2xl">
                {introContent.emoji}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{introContent.title}</h3>
                <p className="text-gray-400 text-sm">{introContent.subtitle}</p>
              </div>
            </div>
          </div>
          
          {/* Area pills - grouped by type for dual-layer */}
          <div className="px-5 py-4">
            {isDualLayer ? (
              <div className="space-y-3 mb-4">
                {/* Stay areas (blue) */}
                <div>
                  <div className="text-xs text-blue-400 font-medium mb-2 flex items-center gap-1">
                    <span>🏨</span> WHERE TO STAY
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stayAreas.map((area, i) => {
                      const globalIndex = areas.findIndex(a => a.name === area.name);
                      return (
                        <button
                          key={i}
                          onClick={() => handleCircleClick(globalIndex)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full hover:border-blue-500/50 transition-colors"
                        >
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-xs text-blue-300 font-medium">STAY #{area.dualLayerIndex}</span>
                          <span className="text-sm text-white">{area.name}</span>
                          {area.priceTier && (
                            <span className="text-xs text-gray-500">{getPriceTierDisplay(area.priceTier)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Activity areas (orange) */}
                <div>
                  <div className="text-xs text-orange-400 font-medium mb-2 flex items-center gap-1">
                    <span>🎯</span> THINGS TO DO
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activityAreas.map((area, i) => {
                      const globalIndex = areas.findIndex(a => a.name === area.name);
                      return (
                        <button
                          key={i}
                          onClick={() => handleCircleClick(globalIndex)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full hover:border-orange-500/50 transition-colors"
                        >
                          <div className="w-3 h-3 rounded-full bg-orange-500" />
                          <span className="text-xs text-orange-300 font-medium">DO #{area.dualLayerIndex}</span>
                          <span className="text-sm text-white">{area.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : isCityCharacter ? (
              <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
                {areas.map((area, i) => {
                  const charInfo = characterTypeLabels[area.characterType || 'tourist'];
                  return (
                    <button
                      key={i}
                      onClick={() => handleCircleClick(i)}
                      className="w-full flex items-center gap-3 px-3 py-2 bg-[#1A1A1A] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors text-left"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: area.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{area.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${area.color}20`, color: area.color }}>
                            {charInfo?.emoji} {charInfo?.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {area.specificPercent}% places • {area.areaPercent}% explore
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {areas.map((area, i) => (
                  <button
                    key={i}
                    onClick={() => handleCircleClick(i)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] border border-gray-800 rounded-full hover:border-gray-600 transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                    <span className="text-sm text-white">{area.name}</span>
                    {area.priceTier && (
                      <span className="text-xs text-gray-500">
                        {getPriceTierDisplay(area.priceTier)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            <p className="text-gray-500 text-sm mb-4">
              {introContent.description}
            </p>
            
            {/* Let's Go button */}
            <button
              onClick={handleLetsGo}
              className="w-full py-3 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span>{introContent.cta}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Area Info Card - only show when intro is dismissed */}
      {showCard && currentArea && introDismissed && (
        <div className="absolute bottom-6 left-6 w-[360px] bg-[#0D0D0D]/95 border border-gray-800 rounded-2xl p-5 z-20 backdrop-blur-xl">
          <button
            onClick={onMapClick}
            className="absolute top-4 right-4 text-gray-600 hover:text-white text-xl"
            aria-label="Close card"
          >
            ×
          </button>
          
          {/* Dual-layer type badge */}
          {currentArea.dualLayerType && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-3 ${
              currentArea.dualLayerType === 'stay' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-orange-500/20 text-orange-400'
            }`}>
              {currentArea.dualLayerType === 'stay' ? '🏨 STAY' : '🎯 DO'} #{currentArea.dualLayerIndex}
            </div>
          )}
          
          {/* City character type badge */}
          {currentArea.characterType && (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-3"
              style={{ backgroundColor: `${currentArea.color}20`, color: currentArea.color }}
            >
              {characterTypeLabels[currentArea.characterType]?.emoji} {characterTypeLabels[currentArea.characterType]?.label}
            </div>
          )}
          
          <div className="flex items-start gap-3.5 mb-3">
            <div
              className="w-11 h-11 rounded-full flex-shrink-0"
              style={{ background: currentArea.color }}
            />
            <div className="flex-1">
              <div className="text-lg font-semibold text-white flex items-center gap-2 flex-wrap">
                {currentArea.areaType === 'stay' && !currentArea.dualLayerType ? '🏨' : ''} 
                {currentArea.areaType === 'activity' && !currentArea.dualLayerType && !currentArea.characterType ? '📍' : ''} 
                {currentArea.name}
                {/* Price tier badge for stay areas */}
                {currentArea.priceTier && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-lg"
                    style={{ 
                      backgroundColor: `${currentArea.color}20`,
                      color: currentArea.color 
                    }}
                  >
                    {getPriceTierDisplay(currentArea.priceTier)} {getPriceTierLabel(currentArea.priceTier)}
                  </span>
                )}
                {currentArea.grounded && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg">
                    🔍 Web verified
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-1">{currentArea.why}</p>
            </div>
          </div>
          
          {/* City character mix display */}
          {currentArea.characterType && currentArea.specificPercent !== undefined && (
            <div className="mb-4 p-3 bg-white/5 rounded-xl">
              <div className="text-xs text-gray-500 mb-2">How to explore this area:</div>
              <div className="flex gap-2">
                <div className="flex-1 text-center p-2 bg-white/5 rounded-lg">
                  <div className="text-lg font-bold text-white">{currentArea.specificPercent}%</div>
                  <div className="text-[10px] text-gray-500">Specific places</div>
                  <div className="text-[10px] text-gray-600">restaurants, landmarks</div>
                </div>
                <div className="flex-1 text-center p-2 bg-white/5 rounded-lg">
                  <div className="text-lg font-bold text-white">{currentArea.areaPercent}%</div>
                  <div className="text-[10px] text-gray-500">Wandering</div>
                  <div className="text-[10px] text-gray-600">streets, atmosphere</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Booking URLs for stay areas */}
          {currentArea.areaType === 'stay' && currentArea.bookingUrls && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-600 mb-3">🔗 Book accommodation:</div>
              <div className="flex gap-2">
                <a
                  href={currentArea.bookingUrls.airbnb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF5A5F]/20 text-[#FF5A5F] rounded-xl text-sm font-medium hover:bg-[#FF5A5F]/30 transition-colors"
                >
                  <span>🏠</span> Airbnb
                </a>
                <a
                  href={currentArea.bookingUrls.booking}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#003580]/30 text-[#6BB4F0] rounded-xl text-sm font-medium hover:bg-[#003580]/40 transition-colors"
                >
                  <span>🏨</span> Booking.com
                </a>
              </div>
            </div>
          )}
          
          {/* Itinerary / Nearby Highlights */}
          {currentArea.itinerary && currentArea.itinerary.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-600 mb-3">
                {currentArea.areaType === 'stay' ? '🚶 Nearby highlights:' : '🗺️ Suggested itinerary:'}
              </div>
              {currentArea.itinerary.map((item, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-3 mb-2.5">
                  <div className="text-sm font-medium text-white mb-2">{item.purpose}</div>
                  <div className="flex gap-2">
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(item.query)}/@${currentArea.lat},${currentArea.lng},16z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-xs hover:bg-blue-500/30 transition-colors"
                    >
                      📍 Maps
                    </a>
                    <a
                      href={`https://www.tiktok.com/search?q=${encodeURIComponent(item.query + ' ' + currentArea.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 bg-pink-500/15 text-pink-400 rounded-lg text-xs hover:bg-pink-500/25 transition-colors"
                    >
                      🎵 TikTok
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Navigation */}
          {areas.length > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
              <button
                onClick={() => handleNavigate(-1)}
                className="w-9 h-9 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white"
                aria-label="Previous area"
              >
                ←
              </button>
              <div className="text-center">
                {isDualLayer && currentArea.dualLayerType && (
                  <span className={`text-[10px] font-medium ${
                    currentArea.dualLayerType === 'stay' ? 'text-blue-400' : 'text-orange-400'
                  }`}>
                    {currentArea.dualLayerType === 'stay' ? 'STAY' : 'DO'} #{currentArea.dualLayerIndex}
                  </span>
                )}
                <span className="text-sm text-gray-600 block">
                {currentAreaIndex + 1} / {areas.length}
              </span>
              </div>
              <button
                onClick={() => handleNavigate(1)}
                className="w-9 h-9 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white"
                aria-label="Next area"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
