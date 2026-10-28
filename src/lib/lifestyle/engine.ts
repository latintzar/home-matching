/**
 * Lifestyle Engine - The Bridge
 * 
 * This module connects the AI Profiler → Orchestrator → Sweet Spot generation.
 * It's the main entry point for the Lifestyle Intelligence system.
 */

import { LifestyleOrchestrator, SmartAnchor, OrchestratorResult } from './orchestrator';
import { LifestyleProfile } from '@/types/lifestyle';

export interface ScoredHex {
  h3Index: string;
  lat: number;
  lng: number;
  scores: {
    total: number;
    commute: number;
    lifestyle: number;
    opportunity: number;
  };
}

/**
 * Generate the "Sweet Spot" polygon from a lifestyle profile.
 * 
 * This is the core function that:
 * 1. Converts a LifestyleProfile into SmartAnchors
 * 2. Runs the Orchestrator to generate isochrones
 * 3. Returns the intersection (sweet spot) and scored hexes
 */
export async function generateLifestylePolygon(profile: LifestyleProfile): Promise<ScoredHex[]> {
  const orchestrator = new LifestyleOrchestrator();
  
  // Convert LifestyleProfile to SmartAnchors
  const anchors = profileToAnchors(profile);
  
  if (anchors.length === 0) {
    console.warn('No anchors generated from profile');
    return [];
  }
  
  // Run the orchestrator
  const result = await orchestrator.resolveProfile(anchors);
  
  // Convert sweet spot polygon to scored hexes
  // For now, we return a simplified version
  // In production, this would use H3 to grid the polygon
  return polygonToScoredHexes(result);
}

/**
 * Convert a LifestyleProfile to SmartAnchors for the Orchestrator
 */
function profileToAnchors(profile: LifestyleProfile): SmartAnchor[] {
  const anchors: SmartAnchor[] = [];
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];
  
  // 1. Convert Profile Anchors (work, gym, social, family, etc.)
  profile.anchors.forEach((anchor, index) => {
    const transportMode = anchor.transport_mode === 'transit' ? 'transit' 
      : anchor.transport_mode === 'cycling' ? 'cycling'
      : anchor.transport_mode === 'walking' ? 'walking'
      : 'driving';
    
    anchors.push({
      id: `anchor-${index}`,
      type: 'fixed',
      name: anchor.type.charAt(0).toUpperCase() + anchor.type.slice(1),
      location: {
        lat: anchor.location.lat,
        lng: anchor.location.lng,
        name: anchor.location.address || anchor.type
      },
      commute: {
        mode: transportMode,
        maxDuration: anchor.max_duration_minutes
      },
      color: colors[index % colors.length],
      layerGroup: anchor.type === 'work' || anchor.type === 'family' ? 'gold' : 'silver'
    });
  });
  
  // 2. Convert Vibe preferences to search anchors
  // Get a search center from the first anchor if available
  const searchCenter = profile.anchors[0]?.location;
  
  profile.vibe.forEach((vibe, index) => {
    if (vibe.importance === 'must_have' && searchCenter) {
      anchors.push({
        id: `vibe-${index}`,
        type: 'search',
        name: vibe.amenity_type,
        query: vibe.amenity_type + ' ' + vibe.specifics.join(' '),
        searchArea: {
          center: { lat: searchCenter.lat, lng: searchCenter.lng },
          radiusKm: 5
        },
        commute: {
          mode: 'walking',
          maxDuration: 15
        },
        color: colors[(profile.anchors.length + index) % colors.length],
        layerGroup: 'silver'
      });
    }
  });
  
  return anchors;
}

/**
 * Convert an OrchestratorResult to scored hexes
 * 
 * In a full implementation, this would:
 * 1. Take the sweet spot polygon
 * 2. Fill it with H3 hexagons
 * 3. Score each hex based on proximity to anchors
 */
function polygonToScoredHexes(result: OrchestratorResult): ScoredHex[] {
  if (!result.sweetSpot) {
    console.warn('No sweet spot polygon generated');
    return [];
  }
  
  // For now, return a placeholder
  // In production, use @h3-js to grid the polygon
  const centroid = getCentroid(result.sweetSpot);
  
  if (!centroid) return [];
  
  // Return a single "representative" hex for the sweet spot
  return [{
    h3Index: 'placeholder',
    lat: centroid[1],
    lng: centroid[0],
    scores: {
      total: 85,
      commute: 90,
      lifestyle: 80,
      opportunity: 85
    }
  }];
}

/**
 * Get centroid of a GeoJSON feature
 */
function getCentroid(feature: any): [number, number] | null {
  try {
    if (!feature || !feature.geometry) return null;
    
    const coords = feature.geometry.coordinates;
    if (!coords || !coords[0]) return null;
    
    // Simple centroid calculation for polygon
    const ring = Array.isArray(coords[0][0]) ? coords[0] : coords;
    let sumLng = 0, sumLat = 0;
    
    for (const coord of ring) {
      sumLng += coord[0];
      sumLat += coord[1];
    }
    
    return [sumLng / ring.length, sumLat / ring.length];
  } catch (e) {
    console.error('Centroid calculation failed:', e);
    return null;
  }
}

export { LifestyleOrchestrator, type SmartAnchor, type OrchestratorResult };

