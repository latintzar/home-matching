"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Map, { Source, Layer, Marker, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import { Check, X, MapPin, Loader2, Layers, Train, TreePine, Waves, Building2, Eye, EyeOff, MapPinned } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePOIs, type BoundingBox, type POIFeature } from "@/hooks/usePOIs";

/**
 * Map Comparison Page - Progressive Layers + Raster Heatmap
 * 
 * URL: /test-map-comparison
 * 
 * Shows:
 * - Toggleable lightweight layers (neighborhoods, metro, parks, coast)
 * - Final heatmap as PNG raster overlay (efficient!)
 * - Progressive building simulation for Leo chat UX
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 
  "";

// Barcelona center
const BARCELONA_CENTER = { longitude: 2.1686, latitude: 41.3900 };

// Heatmap PNG bounds (must match the generator)
const HEATMAP_BOUNDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [2.02, 41.47],   // Top-left (NW)
  [2.23, 41.47],   // Top-right (NE)
  [2.23, 41.32],   // Bottom-right (SE)
  [2.02, 41.32],   // Bottom-left (SW)
];

// ============================================================================
// Idealista-style Box Selection (Static Mockup)
// ============================================================================

const TraditionalMapIllustration = () => (
  <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
    <Image
      src="/images/landing/barcelona-map-base.png"
      alt="Barcelona map"
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      className="object-cover opacity-90"
    />
    
    <svg 
      viewBox="0 0 400 300" 
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Selection rectangle (Idealista blue) */}
      <rect 
        x="120" y="90" 
        width="160" height="120" 
        fill="rgba(59, 130, 246, 0.15)" 
        stroke="#3b82f6" 
        strokeWidth="3" 
        strokeDasharray="10 5"
      />
      
      {/* Listings inside (blue dots) */}
      <g fill="#3b82f6">
        <circle cx="150" cy="120" r="5" />
        <circle cx="200" cy="110" r="5" />
        <circle cx="240" cy="150" r="5" />
        <circle cx="180" cy="170" r="5" />
        <circle cx="220" cy="130" r="5" />
        <circle cx="160" cy="155" r="5" />
        <circle cx="250" cy="180" r="5" />
      </g>
      
      {/* Listings OUTSIDE that user misses (faded gray) */}
      <g fill="#9ca3af" opacity="0.6">
        <circle cx="90" cy="140" r="5" />
        <circle cx="310" cy="130" r="5" />
        <circle cx="330" cy="200" r="5" />
        <circle cx="70" cy="200" r="5" />
      </g>
      
      {/* Corner drag handles */}
      <g fill="#3b82f6">
        <rect x="114" y="84" width="12" height="12" rx="2" />
        <rect x="274" y="84" width="12" height="12" rx="2" />
        <rect x="114" y="204" width="12" height="12" rx="2" />
        <rect x="274" y="204" width="12" height="12" rx="2" />
      </g>
      
      <text x="200" y="240" textAnchor="middle" fill="#3b82f6" fontSize="14" fontWeight="600">
        "Eixample"
      </text>
    </svg>
  </div>
);

// ============================================================================
// Layer Types & Data
// ============================================================================

interface LayerData {
  neighborhoods: GeoJSON.FeatureCollection | null;
  metro: GeoJSON.FeatureCollection | null;
  // Parks and coast now use Mapbox's built-in layers (no JSON needed)
}

interface LayerVisibility {
  neighborhoods: boolean;
  metro: boolean;
  parks: boolean;
  coast: boolean;
  pois: boolean;
  heatmap: boolean;
}

// ============================================================================
// Progressive Leo Heatmap with Toggleable Layers
// ============================================================================

const ProgressiveLeoMap = () => {
  const mapRef = useRef<MapRef>(null);
  
  const [layers, setLayers] = useState<LayerData>({
    neighborhoods: null,
    metro: null,
  });
  
  const [visibility, setVisibility] = useState<LayerVisibility>({
    neighborhoods: false,
    metro: false,
    parks: false,   // Uses Mapbox built-in landuse layer
    coast: false,   // Uses Mapbox built-in water layer
    pois: false,    // Tennis courts, bakeries, etc.
    heatmap: true,
  });

  const [loading, setLoading] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  
  // Map bounds for POI queries
  const [mapBounds, setMapBounds] = useState<BoundingBox | null>(null);
  
  // Dynamic POI loading using the hook
  const { pois: bakeries, loading: loadingBakeries } = usePOIs({
    type: 'bakeries',
    bbox: mapBounds,
    enabled: visibility.pois,
    limit: 100,
    debounceMs: 500,
  });
  
  const { pois: tennisCourts, loading: loadingTennis } = usePOIs({
    type: 'sports_pitches',
    bbox: mapBounds,
    filter: { sport: 'tennis' },
    enabled: visibility.pois,
    limit: 50,
    debounceMs: 500,
  });
  
  // Update bounds when map moves
  const handleMapMove = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    
    const bounds = map.getBounds();
    if (bounds) {
      setMapBounds({
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
      });
    }
  }, []);

  // Load GeoJSON layers (parks/coast now use Mapbox native layers - no loading needed)
  useEffect(() => {
    const loadLayers = async () => {
      try {
        const [neighborhoods, metro] = await Promise.all([
          fetch("/heatmap-demo/layers/barcelona-neighborhoods.json").then(r => r.ok ? r.json() : null),
          fetch("/heatmap-demo/layers/barcelona-metro-stations.json").then(r => r.ok ? r.json() : null),
        ]);
        
        setLayers({ neighborhoods, metro });
        setLoading(false);
      } catch (err) {
        console.error("Failed to load layers:", err);
        setLoading(false);
      }
    };
    
    loadLayers();
  }, []);

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // Layer control buttons
  const LayerButton = ({ 
    layer, 
    icon: Icon, 
    label, 
    color 
  }: { 
    layer: keyof LayerVisibility; 
    icon: React.ComponentType<{ className?: string }>; 
    label: string;
    color: string;
  }) => (
    <button
      onClick={() => toggleLayer(layer)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
        visibility[layer] 
          ? `${color} text-white shadow-sm` 
          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
      }`}
      title={`Toggle ${label}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
      {visibility[layer] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-50" />}
    </button>
  );

  if (loading) {
    return (
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-stone-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading map layers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl">
      <Map
        ref={mapRef}
        initialViewState={{ ...BARCELONA_CENTER, zoom: 11.8 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        interactive={true}
        scrollZoom={true}
        dragPan={true}
        dragRotate={false}
        onLoad={handleMapMove}
        onMoveEnd={handleMapMove}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        
        {/* === NEIGHBORHOODS (outlines only, rendered FIRST so it's below everything) === */}
        {visibility.neighborhoods && layers.neighborhoods && (
          <Source id="neighborhoods" type="geojson" data={layers.neighborhoods}>
            <Layer
              id="neighborhoods-outline"
              type="line"
              paint={{
                "line-color": "#A5B4FC",  // Soft indigo matching palette
                "line-width": 1,
                "line-opacity": 0.6,
              }}
            />
          </Source>
        )}
        
        {/* === RASTER HEATMAP (PNG overlay - 4096x4096 high-res) === */}
        {visibility.heatmap && (
          <Source
            id="heatmap-raster"
            type="image"
            url="/heatmap-demo/barcelona-heatmap-v3.png"
            coordinates={HEATMAP_BOUNDS}
          >
            <Layer
              id="heatmap-image"
              type="raster"
              paint={{
                "raster-opacity": 0.8,
                "raster-fade-duration": 300,
              }}
            />
          </Source>
        )}
        
        {/* === METRO STATIONS (dots) === */}
        {/* Soft rose/coral matching hero palette */}
        {visibility.metro && layers.metro && (
          <Source id="metro" type="geojson" data={layers.metro}>
            <Layer
              id="metro-dots"
              type="circle"
              paint={{
                "circle-radius": 5,
                "circle-color": "#FB7185",  // Soft rose matching hero
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}
        
        {/* === PARKS (using Mapbox built-in landuse layer) === */}
        {/* Soft mint green matching hero palette - full opacity for exact color */}
        {visibility.parks && (
          <Layer
            id="parks-highlight"
            type="fill"
            source="composite"
            source-layer="landuse"
            filter={["in", ["get", "class"], ["literal", ["park", "pitch", "grass"]]]}
            paint={{
              "fill-color": "#86EFAC",  // Exact soft mint from hero
              "fill-opacity": 1,
            }}
          />
        )}
        {visibility.parks && (
          <Layer
            id="parks-outline"
            type="line"
            source="composite"
            source-layer="landuse"
            filter={["in", ["get", "class"], ["literal", ["park", "pitch", "grass"]]]}
            paint={{
              "line-color": "#4ADE80",
              "line-width": 1,
              "line-opacity": 0.6,
            }}
          />
        )}
        
        {/* === FOREST/WOOD (Collserola and other forests) === */}
        {visibility.parks && (
          <Layer
            id="forest-highlight"
            type="fill"
            source="composite"
            source-layer="landcover"
            filter={["in", ["get", "class"], ["literal", ["wood", "forest", "scrub"]]]}
            paint={{
              "fill-color": "#86EFAC",  // Same soft mint as parks
              "fill-opacity": 0.85,
            }}
          />
        )}
        
        {/* === COAST/WATER (using Mapbox built-in water layer) === */}
        {/* Light sky blue matching hero "Work" circle */}
        {visibility.coast && (
          <Layer
            id="water-highlight"
            type="fill"
            source="composite"
            source-layer="water"
            paint={{
              "fill-color": "#BFDBFE",  // Lighter soft blue (blue-200)
              "fill-opacity": 1,
            }}
          />
        )}
        
        {/* === POI ICONS: Bakeries (dynamic from DynamoDB) === */}
        {visibility.pois && bakeries.map((bakery: POIFeature) => (
          <Marker 
            key={`bakery-${bakery.properties.id}`} 
            longitude={bakery.geometry.coordinates[0]} 
            latitude={bakery.geometry.coordinates[1]} 
            anchor="center"
          >
            <div 
              className="w-5 h-5 rounded-full bg-amber-100 border border-amber-500 shadow-sm flex items-center justify-center text-[10px] cursor-pointer hover:scale-110 transition-transform" 
              title={bakery.properties.name}
            >
              🥐
            </div>
          </Marker>
        ))}
        
        {/* === POI ICONS: Tennis Courts (dynamic from DynamoDB - sport=tennis) === */}
        {visibility.pois && tennisCourts.map((court: POIFeature) => (
          <Marker 
            key={`tennis-${court.properties.id}`} 
            longitude={court.geometry.coordinates[0]} 
            latitude={court.geometry.coordinates[1]} 
            anchor="center"
          >
            <div 
              className="w-5 h-5 rounded-full bg-green-100 border border-green-600 shadow-sm flex items-center justify-center text-[10px] cursor-pointer hover:scale-110 transition-transform" 
              title={court.properties.name}
            >
              🎾
            </div>
          </Marker>
        ))}
        
        {/* Loading indicator for POIs */}
        {visibility.pois && (loadingBakeries || loadingTennis) && (
          <div className="absolute top-16 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
            <span className="text-[10px] text-stone-500">Loading POIs...</span>
          </div>
        )}
          
        {/* Work Anchor Marker */}
        <Marker longitude={2.1686} latitude={41.3874} anchor="center">
          <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-600 shadow-lg flex items-center justify-center" title="Work: Diagonal">
            <MapPin className="w-4 h-4 text-indigo-600" />
          </div>
        </Marker>
      </Map>
      
      {/* Layer Controls Panel */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden">
        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 w-full"
        >
          <Layers className="w-4 h-4" />
          <span>Layers</span>
          <span className="ml-auto text-[10px] text-stone-400">
            {Object.values(visibility).filter(Boolean).length} active
          </span>
        </button>
        
        {showLayerPanel && (
          <div className="px-3 py-2 border-t border-stone-100 space-y-2">
            <div className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">
              Progressive Layers
            </div>
            <div className="flex flex-wrap gap-1.5">
              <LayerButton layer="neighborhoods" icon={Building2} label="Barrios" color="bg-violet-400" />
              <LayerButton layer="metro" icon={Train} label="Metro" color="bg-rose-400" />
              <LayerButton layer="parks" icon={TreePine} label="Parks" color="bg-emerald-400" />
              <LayerButton layer="coast" icon={Waves} label="Coast" color="bg-sky-400" />
              <LayerButton layer="pois" icon={MapPinned} label="POIs" color="bg-amber-400" />
            </div>
            <div className="border-t border-stone-100 pt-2 mt-2">
              <div className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">
                Final Result
              </div>
              <button
                onClick={() => toggleLayer('heatmap')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all w-full justify-center ${
                  visibility.heatmap 
                    ? 'text-stone-700 shadow-sm' 
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
                style={visibility.heatmap ? {
                  background: 'linear-gradient(to right, #FEF3C7, #FCD34D, #FB923C, #F87171)'
                } : undefined}
              >
                <span>Heatmap</span>
                {visibility.heatmap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-50" />}
              </button>
            </div>
          </div>
        )}
      </div>
    
    {/* Legend overlay */}
      {visibility.heatmap && (
    <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
          <div className="text-xs font-medium text-stone-600 mb-1.5">Fit Score</div>
          <div className="flex items-center gap-1">
            {/* Warm gradient: cream → yellow → orange → coral */}
            <div className="w-20 h-2 rounded-full" style={{
              background: 'linear-gradient(to right, #FEF3C7, #FCD34D, #FB923C, #F87171)'
            }} />
        </div>
          <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
            <span>Far</span>
            <span>Good</span>
            <span>Perfect</span>
        </div>
        </div>
      )}
      
      {/* Stats badge */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
        <div className="text-[10px] text-stone-500">
          {visibility.pois ? (
            <span>🥐 {bakeries.length} • 🎾 {tennisCourts.length}</span>
          ) : (
            <span>4K PNG • 3.9MB</span>
          )}
      </div>
    </div>
  </div>
);
};

// ============================================================================
// Main Page
// ============================================================================

export default function TestMapComparisonPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-4">
            Stop drawing boxes.<br />Start finding homes.
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            Traditional portals show everyone the same listings. Leo builds a personalized map based on YOUR life.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Left: Traditional */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
            <div className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">
              🔍 How everyone else searches
            </div>
            <TraditionalMapIllustration />
            <p className="text-stone-600 text-sm mt-4">
              Draw a rectangle. See everything inside. Miss great options just outside.
            </p>
          </div>

          {/* Right: Leo */}
          <div className="bg-gradient-to-br from-red-50/50 via-yellow-50/30 to-blue-50/50 rounded-2xl p-6 border border-red-200/50 shadow-sm">
            <div className="text-sm font-medium text-red-600 uppercase tracking-wider mb-4">
              🎯 How Leo searches for you
            </div>
            <ProgressiveLeoMap />
            <p className="text-stone-600 text-sm mt-4">
              Your perfect zones. Based on your commute, lifestyle, and what matters to YOU.
            </p>
          </div>
        </div>

        {/* Comparison Points */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <h3 className="font-medium text-stone-900 mb-4">Traditional search</h3>
            {[
              "Same results for everyone",
              "Hard boundary — in or out",
              "Miss nearby gems outside the box",
              "Filter by specs only",
              "You do all the work",
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-stone-500">
                <X className="w-5 h-5 text-stone-300 shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="font-medium text-stone-900 mb-4">Leo&apos;s search</h3>
            {[
              "Personalized to YOUR lifestyle",
              "Smooth gradient — perfect → okay → far",
              "Discover hidden spots you'd love",
              "Match by how you actually live",
              "Leo does the work for you",
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-stone-700">
                <Check className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Color Legend Explanation */}
        <div className="mt-16 bg-white rounded-2xl p-8 border border-stone-200">
          <h2 className="font-serif text-2xl text-stone-900 mb-6">How the Heatmap Works</h2>
          
          {/* Gradient bar - warm palette */}
          <div className="mb-8">
            <div 
              className="h-8 rounded-lg shadow-inner" 
              style={{ background: 'linear-gradient(to right, #FEF3C7, #FCD34D, #FB923C, #F87171)' }}
            />
            <div className="flex justify-between mt-2 text-sm text-stone-500">
              <span>0 — Far from everything</span>
              <span>5 — Okay fit</span>
              <span>10 — Perfect match</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FEF3C7' }} />
                <span className="font-medium text-stone-800">Cream (0-3)</span>
              </div>
              <p className="text-sm text-stone-500">
                Far from your anchors. Long commute, few lifestyle matches nearby.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FB923C' }} />
                <span className="font-medium text-stone-800">Orange (4-6)</span>
              </div>
              <p className="text-sm text-stone-500">
                Decent commute, some amenities. Worth considering if price is right.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F87171' }} />
                <span className="font-medium text-stone-800">Coral (7-10)</span>
              </div>
              <p className="text-sm text-stone-500">
                Sweet spot! Easy commute AND great lifestyle fit. Focus your search here.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-stone-50 rounded-xl p-6 border border-stone-200">
          <h3 className="font-medium text-stone-900 mb-4">🔧 Technical Details</h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm text-stone-600">
            <div>
              <div className="font-medium text-stone-800">Progressive Layers</div>
              <div>~1.8MB total (toggle on/off)</div>
            </div>
            <div>
              <div className="font-medium text-stone-800">Heatmap</div>
              <div>PNG raster (5.5MB vs 424MB JSON)</div>
            </div>
            <div>
              <div className="font-medium text-stone-800">Chat UX</div>
              <div>Layers show as you mention topics</div>
            </div>
            <div>
              <div className="font-medium text-stone-800">Final Result</div>
              <div>Heatmap generated at end</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-200 text-xs text-stone-400">
            <strong>During chat:</strong> Progressive layers (neighborhoods, metro, parks, coast) show your research.
            <br />
            <strong>At end:</strong> Server generates personalized heatmap PNG (2-5 sec) and displays instantly.
          </div>
        </div>
      </div>
    </div>
  );
}
