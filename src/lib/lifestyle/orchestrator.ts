import * as turf from '@turf/turf';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { AIScout, PlaceCandidate } from './ai-scout';
import { globalCostTracker } from './cost-calculator';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) process.env[k] = envConfig[k];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '2152837cef1b4a159356a9665a701bdd';
const ISOLINE_URL = 'https://api.geoapify.com/v1/isoline';

// --- Types ---

export type TransportMode = 'walking' | 'driving' | 'moped' | 'cycling' | 'transit';

export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface SearchFilter {
  type: 'attribute' | 'rating' | 'keyword';
  value: string | number;
  operator?: '>' | '<' | '==' | 'contains';
}

// The "Smart" Anchor Definition
export interface SmartAnchor {
  id: string;
  type: 'fixed' | 'search'; // 'fixed' = specific point, 'search' = find candidates
  
  // Core Identity
  name: string; 
  query?: string; // e.g. "Coworking", "Italian Restaurant"
  location?: GeoPoint; // If fixed
  
  // Search Constraints (for 'search' type)
  searchArea?: { center: GeoPoint; radiusKm: number }; // Where to look?
  filters?: SearchFilter[]; // e.g. rating > 4.5, types include "gym"
  
  // AI Scout Verification
  vibeCheck?: string; // e.g. "Authentic, non-corporate, village feel"
  
  // Dependency Logic (The "Chain")
  // e.g. "Must be within 10 mins of X"
  dependencies?: SmartDependency[];

  // Relationship to Home (The final Isochrone)
  // If null, this anchor doesn't connect to home (it might just be a vibe signal)
  commute?: {
    mode: TransportMode;
    maxDuration: number; // minutes
  };
  
  // Visuals
  color?: string;
  layerGroup?: 'gold' | 'silver' | 'opportunity' | 'vibe';
}

export interface SmartDependency {
  targetAnchorId?: string; // If relating to another defined anchor
  searchQuery?: string;    // If relating to a generic search (e.g. "Italian Sandwich")
  relation: 'close_to' | 'far_from';
  mode: TransportMode;
  maxDuration: number; // minutes (or distance logic)
  distanceKm?: number; // simple radius check
}

// The Output
export interface OrchestratorResult {
  sweetSpot: any; // GeoJSON Polygon
  layers: {
    id: string;
    type: 'isochrone' | 'point' | 'polygon';
    data: any;
    color: string;
    name: string;
  }[];
  stats: {
    cost: number;
    apiCalls: number;
  };
}

// --- API Helpers ---

interface Place extends PlaceCandidate {
  lat: number;
  lng: number;
  reviewsCount?: number;
}

async function searchPlaces(query: string, center: GeoPoint, radiusKm: number = 2): Promise<Place[]> {
  if (!SCRAPINGDOG_API_KEY) {
    console.warn(`⚠️ No API Key. Mocking search for "${query}"`);
    return getMockPlaces(query, center);
  }

  // ScrapingDog uses Zoom level. 
  // 14z ~ few km radius. 15z ~ 1km.
  // Simple heuristic:
  const zoom = radiusKm < 1 ? 16 : radiusKm < 3 ? 14 : 13;
  
  const ll = `@${center.lat},${center.lng},${zoom}z`;
  const url = `https://api.scrapingdog.com/google_maps?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(query)}&ll=${ll}&domain=google.es`;

  try {
    // console.log(`🔍 Searching "${query}" via API...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error ${res.status}`);
    const data = await res.json();

    // Track Cost
    globalCostTracker.trackScrapingDog(1);
    
    if (data.search_results) {
      return data.search_results.map((r: any, index: number) => ({
        id: r.place_id || `place-${index}-${Date.now()}`,
        name: r.title,
        lat: r.gps_coordinates.latitude,
        lng: r.gps_coordinates.longitude,
        rating: r.rating,
        reviewsCount: r.reviews,
        types: r.types,
        categories: r.types // Map types to categories for Scout
      }));
    }
    return [];
  } catch (e) {
    console.error(`❌ Search failed:`, e);
    return [];
  }
}

function getMockPlaces(query: string, center: GeoPoint): Place[] {
  const count = 5 + Math.floor(Math.random() * 5);
  const places = [];
  for(let i=0; i<count; i++) {
    places.push({
      id: `mock-${query}-${i}`,
      name: `${query} Mock ${i}`,
      lat: center.lat + (Math.random()-0.5)*0.02,
      lng: center.lng + (Math.random()-0.5)*0.02,
      rating: 4.0 + Math.random(),
      reviewsCount: 100,
      categories: ['mock_category', 'test_place']
    });
  }
  return places;
}

async function getIsochrone(lat: number, lng: number, mode: string, minutes: number) {
  const apiMode = mode === 'moped' ? 'motorcycle' : mode === 'transit' ? 'transit' : 'drive';
  const range = minutes * 60;
  const url = `${ISOLINE_URL}?lat=${lat}&lon=${lng}&type=time&mode=${apiMode}&range=${range}&apiKey=${GEOAPIFY_API_KEY}`;
  
  for(let i=0; i<3; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        globalCostTracker.trackGeoapify(1);
        return json.features?.[0];
      }
      if (res.status === 429) await new Promise(r => setTimeout(r, 1000));
    } catch(e) { console.error(e); }
  }
  return null;
}

// --- The Brain: Lifestyle Orchestrator ---

export class LifestyleOrchestrator {
  private costs = { scrapingDog: 0, geoapify: 0 };
  private scout = new AIScout();

  // Expose helper for external use (e.g. negative constraints)
  async search(query: string, center: GeoPoint, radiusKm: number): Promise<Place[]> {
      this.costs.scrapingDog++;
      return searchPlaces(query, center, radiusKm);
  }
  
  async resolveProfile(anchors: SmartAnchor[]): Promise<OrchestratorResult> {
    console.log('🧠 Orchestrator: Resolving Profile...');
    const mapLayers: any[] = [];
    const sweetSpotComponents: any[] = []; // The polygons to intersect for the final sweet spot

    // 1. Process Each Anchor
    for (const anchor of anchors) {
      console.log(`\n👉 Processing Anchor: "${anchor.name}" (${anchor.type})...`);
      
      let validLocations: Place[] = [];

      // A. Find Initial Candidates
      if (anchor.type === 'fixed' && anchor.location) {
        validLocations = [{ ...anchor.location, name: anchor.name, id: 'fixed-anchor' }];
      } else if (anchor.type === 'search' && anchor.query && anchor.searchArea) {
        const candidates = await searchPlaces(anchor.query, anchor.searchArea.center, anchor.searchArea.radiusKm);
        this.costs.scrapingDog++;
        
        // Apply Filters (e.g. Rating)
        validLocations = candidates.filter(c => {
          if (!anchor.filters) return true;
          return anchor.filters.every(f => {
            if (f.type === 'rating' && typeof f.value === 'number') {
              if (f.operator === '>') return (c.rating || 0) > f.value;
            }
            // Add more filters as needed
            return true;
          });
        });
        console.log(`   Found ${candidates.length} candidates. ${validLocations.length} passed internal filters.`);
      }

      // A.5. AI Vibe Check (The Scout)
      if (anchor.vibeCheck && validLocations.length > 0) {
        console.log(`   🕵️ Running AI Scout Vibe Check: "${anchor.vibeCheck}"...`);
        const scoutResults = await this.scout.batchVerifyVibe(validLocations, anchor.vibeCheck);
        
        const vibeFiltered = validLocations.filter(loc => {
            const result = scoutResults.get(loc.id);
            return result && result.match;
        });

        console.log(`   Scout filtered from ${validLocations.length} to ${vibeFiltered.length} matches.`);
        
        // Log rejections for debugging
        validLocations.forEach(loc => {
            const result = scoutResults.get(loc.id);
            if (result && !result.match) {
                console.log(`     ❌ Rejected "${loc.name}": ${result.reason}`);
            }
        });

        validLocations = vibeFiltered;
      }

      // B. Resolve Dependencies (The "Near X" Logic)
      if (anchor.dependencies && validLocations.length > 0) {
        console.log(`   🔗 Resolving ${anchor.dependencies.length} dependencies...`);
        
        for (const dep of anchor.dependencies) {
          // If dependency is a raw query (e.g. "Italian Sandwich")
          if (dep.searchQuery) {
            // We assume the search area for dependencies is the same as the anchor's search area
            // In a real app, we might search around EACH candidate, but that's expensive ($$$).
            // Optimization: Search once in the general area, then spatial join.
            
            const depSearchCenter = anchor.searchArea?.center || validLocations[0]; // Fallback
            const depPlaces = await searchPlaces(dep.searchQuery, depSearchCenter, 3); // Broad search
            this.costs.scrapingDog++;
            
            const filtered: Place[] = [];
            for (const loc of validLocations) {
                const locPt = turf.point([loc.lng, loc.lat]);
                
                // Check if ANY dependency place satisfies the condition
                const match = depPlaces.some(depPlace => {
                    const depPt = turf.point([depPlace.lng, depPlace.lat]);
                    const dist = turf.distance(locPt, depPt, { units: 'kilometers' });
                    
                    // Logic: "close_to"
                    if (dep.relation === 'close_to') {
                        return dep.distanceKm ? dist <= dep.distanceKm : dist <= 1.0; // Default 1km
                    }
                    return false;
                });
                
                if (match) filtered.push(loc);
            }
            
            console.log(`   Filtered from ${validLocations.length} to ${filtered.length} based on dependency "${dep.searchQuery}".`);
            validLocations = filtered;
            
            // Add Dependency Points to Map for Vibe
            mapLayers.push({
                id: `dep-${anchor.id}-${dep.searchQuery}`,
                type: 'point',
                name: dep.searchQuery,
                color: '#F59E0B', // Orange for food dependencies typically
                data: {
                    type: 'FeatureCollection',
                    features: depPlaces.map(p => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                        properties: { title: p.name, layer: 'dependency' }
                    }))
                }
            });
          }
        }
      }

      // C. Generate Isochrones (Connect to Home)
      if (anchor.commute && validLocations.length > 0) {
        console.log(`   🛵 Generating Isochrones (${anchor.commute.mode}, ${anchor.commute.maxDuration}m)...`);
        
        const polys: any[] = [];
        for (const loc of validLocations) {
            // Rate limit protection
            await new Promise(r => setTimeout(r, 200));
            const iso = await getIsochrone(loc.lat, loc.lng, anchor.commute.mode, anchor.commute.maxDuration);
            if (iso) {
                polys.push(iso);
                this.costs.geoapify++;
            }
        }

        if (polys.length > 0) {
            // Union them into a single "Zone" for this anchor
            let zone = polys[0];
            if (polys.length > 1) {
                for(let i=1; i<polys.length; i++) {
                    try { zone = turf.union(turf.featureCollection([zone, polys[i]])); } catch(e){}
                }
            }
            
            sweetSpotComponents.push(zone);
            
            // Add to map
            mapLayers.push({
                id: `zone-${anchor.id}`,
                type: 'isochrone',
                name: anchor.name,
                color: anchor.color || '#3B82F6',
                data: zone
            });
        }
      }

      // D. Add Points to Map
      if (validLocations.length > 0) {
          mapLayers.push({
              id: `points-${anchor.id}`,
              type: 'point',
              name: `${anchor.name} Locations`,
              color: anchor.color || '#3B82F6',
              data: {
                  type: 'FeatureCollection',
                  features: validLocations.map(p => ({
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                      properties: { title: p.name, rating: p.rating }
                  }))
              }
          });
      }
    }

    // 2. Calculate Final Sweet Spot (Intersection of All Components)
    console.log('\n🎯 Calculating Final Intersection...');
    let sweetSpot = null;
    if (sweetSpotComponents.length > 0) {
        sweetSpot = sweetSpotComponents[0];
        for(let i=1; i<sweetSpotComponents.length; i++) {
            if (!sweetSpot) break; // Stop if we already lost the spot
            
            try { 
                const result: any = turf.intersect(turf.featureCollection([sweetSpot, sweetSpotComponents[i]])); 
                sweetSpot = result; // Result is null if no overlap
                
                if (!sweetSpot) {
                    console.log(`   ⚠️ No intersection found at step ${i}. Spot is empty.`);
                    break;
                }
            } catch(e) {
                console.error('Intersection logic failed:', e);
                sweetSpot = null;
                break;
            }
        }
    }

    // 3. Return Result
    return {
        sweetSpot: sweetSpot,
        layers: mapLayers,
        stats: {
            cost: (this.costs.scrapingDog * 0.001) + (this.costs.geoapify * 0), // Geoapify free
            apiCalls: this.costs.scrapingDog + this.costs.geoapify
        }
    };
  }
}

