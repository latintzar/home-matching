import { LifestyleProfile, HexScore } from '@/types/lifestyle';
import * as turf from '@turf/turf';

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '2152837cef1b4a159356a9665a701bdd';
const ISOLINE_URL = 'https://api.geoapify.com/v1/isoline';

// Map our modes to Geoapify modes
const MODE_MAP: Record<string, string> = {
  'driving': 'drive',
  'transit': 'transit', // Geoapify uses 'transit' or 'approximated_transit'
  'cycling': 'bicycle',
  'walking': 'walk'
};

async function getIsochrone(lat: number, lng: number, mode: string, minutes: number) {
  const apiMode = MODE_MAP[mode] || 'drive';
  const range = minutes * 60; // seconds
  
  const url = `${ISOLINE_URL}?lat=${lat}&lon=${lng}&type=time&mode=${apiMode}&range=${range}&apiKey=${GEOAPIFY_API_KEY}`;
  
  // console.log(`Fetching Isochrone: ${url}`); // Debug
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Geoapify Error ${res.status}: ${await res.text()}`);
    return null;
  }
  return res.json();
}

export async function generateLifestyleIsochrones(profile: LifestyleProfile) {
  if (!profile || !profile.anchors || profile.anchors.length === 0) {
    throw new Error('Invalid profile: Anchors required');
  }

  const polygons: any[] = [];

  // 1. Generate Isochrones for each Anchor
  for (const anchor of profile.anchors) {
    const { lat, lng } = anchor.location;
    const geojson = await getIsochrone(lat, lng, anchor.transport_mode, anchor.max_duration_minutes);
    
    if (geojson && geojson.features && geojson.features.length > 0) {
      // Geoapify returns a FeatureCollection. We take the first feature (the isochrone).
      // Sometimes it's a MultiPolygon. Turf handles both usually.
      const feature = geojson.features[0];
      feature.properties = { ...feature.properties, type: anchor.type, mode: anchor.transport_mode };
      polygons.push(feature);
    }
  }

  if (polygons.length === 0) return [];

  // 2. Calculate Intersection (Sweet Spot)
  let intersection = polygons[0];
  
  // If we have multiple constraints, find where they ALL overlap
  if (polygons.length > 1) {
    try {
      for (let i = 1; i < polygons.length; i++) {
        const nextPoly = polygons[i];
        const intersect = turf.intersect(turf.featureCollection([intersection, nextPoly]));
        if (intersect) {
          intersection = intersect;
        } else {
          // If no intersection, returns null. This means constraints are impossible.
          console.warn('No intersection found between anchors. Returning empty set.');
          return {
            sweetSpot: null,
            anchors: polygons.map(p => ({ ...p, properties: { ...p.properties, layerType: 'anchor' } }))
          };
        }
      }
    } catch (e) {
      console.error('Turf intersection error:', e);
      // Fallback: just return all polygons if intersection fails technically
      return {
        sweetSpot: null,
        anchors: polygons.map(p => ({ ...p, properties: { ...p.properties, layerType: 'anchor' } }))
      };
    }
  }

  // Tag features for the frontend renderer
  if (intersection) {
    intersection.properties = { ...intersection.properties, layerType: 'sweetspot' };
  }
  
  const taggedAnchors = polygons.map(p => ({
    ...p,
    properties: { ...p.properties, layerType: 'anchor' }
  }));

  return {
    sweetSpot: intersection,
    anchors: taggedAnchors
  };
}

