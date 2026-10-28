'use client';

import { useCallback, useState } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = '';

// Barcelona center
const BARCELONA_CENTER = { longitude: 2.1734, latitude: 41.3851 };

// Mock isochrones - representing commute anchors
const WORK_ISOCHRONE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[
    [2.140, 41.405], [2.155, 41.410], [2.175, 41.408], [2.195, 41.400],
    [2.205, 41.385], [2.200, 41.365], [2.180, 41.355], [2.155, 41.358],
    [2.135, 41.370], [2.130, 41.390], [2.140, 41.405],
  ]],
};

const PARTNER_ISOCHRONE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[
    [2.185, 41.415], [2.210, 41.418], [2.235, 41.410], [2.250, 41.395],
    [2.245, 41.375], [2.220, 41.365], [2.195, 41.368], [2.175, 41.380],
    [2.170, 41.400], [2.185, 41.415],
  ]],
};

const BEACH_ISOCHRONE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[
    [2.170, 41.395], [2.195, 41.398], [2.215, 41.390], [2.225, 41.375],
    [2.220, 41.360], [2.195, 41.355], [2.175, 41.360], [2.160, 41.375],
    [2.165, 41.390], [2.170, 41.395],
  ]],
};

// Mock neighborhood data
const NEIGHBORHOODS = [
  { name: 'Gràcia', score: 85, geometry: { type: 'Polygon' as const, coordinates: [[[2.148, 41.395], [2.170, 41.395], [2.170, 41.410], [2.148, 41.410], [2.148, 41.395]]] }},
  { name: 'Eixample Dreta', score: 72, geometry: { type: 'Polygon' as const, coordinates: [[[2.158, 41.385], [2.180, 41.385], [2.180, 41.395], [2.158, 41.395], [2.158, 41.385]]] }},
  { name: 'Vila de Gràcia', score: 90, geometry: { type: 'Polygon' as const, coordinates: [[[2.152, 41.400], [2.165, 41.400], [2.165, 41.408], [2.152, 41.408], [2.152, 41.400]]] }},
  { name: 'Sant Martí', score: 65, geometry: { type: 'Polygon' as const, coordinates: [[[2.190, 41.375], [2.220, 41.375], [2.220, 41.400], [2.190, 41.400], [2.190, 41.375]]] }},
  { name: 'Poblenou', score: 78, geometry: { type: 'Polygon' as const, coordinates: [[[2.195, 41.380], [2.210, 41.380], [2.210, 41.395], [2.195, 41.395], [2.195, 41.380]]] }},
];

// Mock POIs
const POIS = [
  { name: 'Specialty Coffee Lab', category: 'coffee', lat: 41.398, lng: 2.158, userFit: 9 },
  { name: 'CrossFit Barcelona', category: 'gym', lat: 41.392, lng: 2.175, userFit: 8 },
  { name: 'Nomad Cowork', category: 'coworking', lat: 41.387, lng: 2.168, userFit: 7 },
  { name: 'Mercat de l\'Abaceria', category: 'market', lat: 41.401, lng: 2.155, userFit: 9 },
  { name: 'Bunkers del Carmel', category: 'viewpoint', lat: 41.418, lng: 2.162, userFit: 6 },
  { name: 'Verdi Cinema', category: 'entertainment', lat: 41.403, lng: 2.157, userFit: 8 },
];

// Calculate intersection
function calculateIntersection() {
  try {
    const workFeature = turf.feature(WORK_ISOCHRONE);
    const partnerFeature = turf.feature(PARTNER_ISOCHRONE);
    const beachFeature = turf.feature(BEACH_ISOCHRONE);
    
    const firstIntersection = turf.intersect(turf.featureCollection([workFeature, partnerFeature]));
    if (firstIntersection) {
      const finalIntersection = turf.intersect(turf.featureCollection([firstIntersection, beachFeature]));
      if (finalIntersection) {
        return { intersection: finalIntersection, status: '✅ All 3 isochrones overlap! Sweet spot found.' };
      }
    }
    
    // Fallback to work+partner only
    const fallback = turf.intersect(turf.featureCollection([workFeature, partnerFeature]));
    return { intersection: fallback, status: '⚠️ Beach doesn\'t overlap. Showing work+partner intersection.' };
  } catch {
    return { intersection: null, status: '❌ Error calculating intersection' };
  }
}

// Get color based on score
function getScoreColor(score: number): string {
  if (score >= 80) return 'rgba(34, 197, 94, 0.4)';
  if (score >= 65) return 'rgba(234, 179, 8, 0.35)';
  if (score >= 50) return 'rgba(251, 146, 60, 0.3)';
  return 'rgba(239, 68, 68, 0.25)';
}

export default function TestMapPage() {
  const [showIsochrones, setShowIsochrones] = useState(true);
  const [showShape, setShowShape] = useState(true);
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);
  const [showPOIs, setShowPOIs] = useState(true);
  const [selectedPOI, setSelectedPOI] = useState<typeof POIS[0] | null>(null);
  
  const { intersection, status } = calculateIntersection();
  
  // GeoJSON sources
  const workGeoJSON = turf.feature(WORK_ISOCHRONE);
  const partnerGeoJSON = turf.feature(PARTNER_ISOCHRONE);
  const beachGeoJSON = turf.feature(BEACH_ISOCHRONE);
  
  const neighborhoodGeoJSON = turf.featureCollection(
    NEIGHBORHOODS.map(n => ({
      ...turf.feature(n.geometry),
      properties: { name: n.name, score: n.score, color: getScoreColor(n.score) }
    }))
  );

  const handleMarkerClick = useCallback((poi: typeof POIS[0]) => {
    setSelectedPOI(poi);
  }, []);

  return (
    <div className="w-full h-screen relative">
      {/* Map */}
      <Map
        initialViewState={{
          ...BARCELONA_CENTER,
          zoom: 12.5
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="bottom-right" />

        {/* Isochrones */}
        {showIsochrones && (
          <>
            <Source id="work" type="geojson" data={workGeoJSON}>
              <Layer id="work-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.15 }} />
              <Layer id="work-line" type="line" paint={{ 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] }} />
            </Source>
            
            <Source id="partner" type="geojson" data={partnerGeoJSON}>
              <Layer id="partner-fill" type="fill" paint={{ 'fill-color': '#8b5cf6', 'fill-opacity': 0.15 }} />
              <Layer id="partner-line" type="line" paint={{ 'line-color': '#8b5cf6', 'line-width': 2, 'line-dasharray': [2, 2] }} />
            </Source>
            
            <Source id="beach" type="geojson" data={beachGeoJSON}>
              <Layer id="beach-fill" type="fill" paint={{ 'fill-color': '#06b6d4', 'fill-opacity': 0.15 }} />
              <Layer id="beach-line" type="line" paint={{ 'line-color': '#06b6d4', 'line-width': 2, 'line-dasharray': [2, 2] }} />
            </Source>
          </>
        )}

        {/* Neighborhoods */}
        {showNeighborhoods && (
          <Source id="neighborhoods" type="geojson" data={neighborhoodGeoJSON}>
            <Layer 
              id="neighborhoods-fill" 
              type="fill" 
              paint={{ 
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.8
              }} 
            />
            <Layer 
              id="neighborhoods-line" 
              type="line" 
              paint={{ 'line-color': '#475569', 'line-width': 1.5 }} 
            />
            <Layer
              id="neighborhoods-label"
              type="symbol"
              layout={{
                'text-field': ['concat', ['get', 'name'], '\n', ['get', 'score'], '%'],
                'text-size': 11,
                'text-anchor': 'center'
              }}
              paint={{
                'text-color': '#1e293b',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5
              }}
            />
          </Source>
        )}

        {/* Intersection Shape */}
        {showShape && intersection && (
          <Source id="shape" type="geojson" data={intersection}>
            <Layer id="shape-fill" type="fill" paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.08 }} />
            <Layer id="shape-line" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 3 }} />
          </Source>
        )}

        {/* POI Markers */}
        {showPOIs && POIS.map((poi) => (
          <Marker
            key={poi.name}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="center"
            onClick={() => handleMarkerClick(poi)}
          >
            <div 
              className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white shadow-lg cursor-pointer flex items-center justify-center text-white text-xs font-bold hover:scale-110 transition-transform"
              title={poi.name}
            >
              {poi.userFit}
            </div>
          </Marker>
        ))}

        {/* POI Popup */}
        {selectedPOI && (
          <Popup
            longitude={selectedPOI.lng}
            latitude={selectedPOI.lat}
            anchor="bottom"
            onClose={() => setSelectedPOI(null)}
            closeOnClick={false}
          >
            <div className="p-1">
              <p className="font-semibold text-sm">{selectedPOI.name}</p>
              <p className="text-xs text-gray-500">{selectedPOI.category}</p>
              <p className="text-xs font-mono bg-gray-100 px-1 rounded mt-1">User Fit: {selectedPOI.userFit}/10</p>
            </div>
          </Popup>
        )}
      </Map>

      {/* Controls Panel */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-xl p-4 w-80 space-y-4 z-10">
        <h1 className="text-lg font-bold text-gray-900">🗺️ Heatmap Test Page</h1>
        <p className="text-xs text-gray-500">Testing the 3-layer location scoring system</p>

        <div className="text-sm bg-gray-50 rounded-lg p-2">{status}</div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Layers</h2>
          
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showIsochrones} onChange={(e) => setShowIsochrones(e.target.checked)} className="rounded" />
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500/40" />
              Isochrones (3 anchors)
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showShape} onChange={(e) => setShowShape(e.target.checked)} className="rounded" />
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-600" />
              Shape (intersection)
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showNeighborhoods} onChange={(e) => setShowNeighborhoods(e.target.checked)} className="rounded" />
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-gray-400" />
              Neighborhoods (multiplier)
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showPOIs} onChange={(e) => setShowPOIs(e.target.checked)} className="rounded" />
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              POIs
            </span>
          </label>
        </div>

        <div className="border-t pt-3 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Legend</h2>
          
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-blue-500 rounded" /> Work commute (30 min)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-purple-500 rounded" /> Partner commute (25 min)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-cyan-500 rounded" /> Beach access (15 min)
            </div>
          </div>

          <div className="text-xs space-y-1 mt-2">
            <p className="font-medium">Neighborhood Score:</p>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-500/40" /> 80%+ (great fit)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-yellow-500/35" /> 65-79%
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-orange-400/30" /> 50-64%
            </div>
          </div>
        </div>

        <div className="border-t pt-3 text-xs text-gray-600">
          <p className="font-mono bg-gray-100 p-2 rounded">
            FINAL_SCORE = POI_SCORE × HOOD_MULTIPLIER
          </p>
          <p className="mt-1">Hood multiplier: 0.7 (0%) → 1.0 (50%) → 1.3 (100%)</p>
        </div>
      </div>

      {/* POI List Panel */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-xl p-4 w-64 z-10">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Mock POIs</h2>
        <div className="space-y-2 text-xs">
          {POIS.map((poi) => (
            <div 
              key={poi.name} 
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-1 rounded"
              onClick={() => setSelectedPOI(poi)}
            >
              <span className="truncate">{poi.name}</span>
              <span className="font-mono bg-gray-100 px-1 rounded">{poi.userFit}/10</span>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-3 border-t text-xs text-gray-400">
          Map: Mapbox GL JS<br/>
          <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            Track usage →
          </a>
        </div>
      </div>
    </div>
  );
}
