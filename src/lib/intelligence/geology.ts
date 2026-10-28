// WMS Service URLs
const IGME_WMS_URL = 'https://mapas.igme.es/gis/services/BasesDatos/IGME_Geologico_Continuo_GEODE_1989/MapServer/WMSServer';
const SNCZI_WMS_URL = 'https://wms.mapama.es/sig/Agua/ZI/wms.aspx';

// Hard to query WMS without a map client (GetFeatureInfo requires pixel coordinates).
// However, we can try to find an ArcGIS REST endpoint for IGME which allows JSON queries.
// IGME often exposes ArcGIS REST services.
const IGME_REST_URL = 'https://mapas.igme.es/gis/rest/services/BasesDatos/IGME_Geologico_Continuo_GEODE_1989/MapServer/0/query';

export interface GeologyRiskResult {
  clayRisk: boolean; // Arcillas expansivas
  floodRisk: boolean;
  details: string; // Changed from description to details to match usage
  source: string;
}

export class GeologyCheck {
  
  async checkPoint(lat: number, lng: number): Promise<GeologyRiskResult> {
    // 1. Check IGME for Geology (Expansive Clays)
    const geology = await this.queryIGME(lat, lng);
    
    // 2. Check Flood Risk (SNCZI) - Harder via WMS, stubbing or simple distance check if we had vector data
    // For now, we will return a placeholder for flood unless we find a queryable API.
    
    return {
      clayRisk: geology.hasClay,
      floodRisk: false, // Needs implementation with valid Flood API
      details: geology.description,
      source: 'IGME GEODE 50k'
    };
  }

  private async queryIGME(lat: number, lng: number) {
    // Using ArcGIS REST API if available (much easier than WMS)
    // geometryType=esriGeometryPoint&geometry=lng,lat&inSR=4326&outFields=*&f=json
    
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      f: 'json',
      returnGeometry: 'false'
    });

    try {
      const res = await fetch(`${IGME_REST_URL}?${params.toString()}`);
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        const attr = data.features[0].attributes;
        // Look for "Arcillas" or lithology description
        const desc = attr.DESCRIP || attr.LITOLOGIA || JSON.stringify(attr);
        const hasClay = desc.toLowerCase().includes('arcilla') || desc.toLowerCase().includes('yeso');
        
        return { hasClay, description: `Geology: ${desc}` };
      }
      
      return { hasClay: false, description: 'No geological data found for point.' };
    } catch (error) {
      console.error('IGME Query failed:', error);
      return { hasClay: false, description: 'Geology check failed.' };
    }
  }
}
