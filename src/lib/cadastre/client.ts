import * as cheerio from 'cheerio';
import { CadastreUnit } from './types';

const BASE_URL_COORDS = 'http://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx';
const BASE_URL_CALLEJERO = 'http://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx';

// Wrapper to fetch text with error handling
async function fetchXml(url: string): Promise<string> {
  // Keep process-wide TLS verification enabled for every provider client.
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cadastre API Error: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export class CadastreClient {
  
  /**
   * Step 1: Get Reference from Coordinates
   * Returns either a 14-char Parcel Ref or a 20-char Unit Ref
   */
  async getRefCatFromCoordinates(lat: number, lng: number): Promise<string | null> {
    const params = new URLSearchParams({
      SRS: 'EPSG:4326',
      Coordenada_X: lng.toString(),
      Coordenada_Y: lat.toString()
    });

    const url = `${BASE_URL_COORDS}/Consulta_RCCOOR?${params.toString()}`;
    
    try {
      const xml = await fetchXml(url);
      // console.log('DEBUG XML:', xml.substring(0, 500)); // Uncomment for debug
      const $ = cheerio.load(xml, { xmlMode: true });
      
      const err = $('lerr > err > desc').text();
      if (err) {
        console.warn('Cadastre getRefCat Error:', err);
        return null;
      }

      // Note: The API structure is <coordenadas><coord><rc><pc1>... OR <pc><pc1>...
      let pc1 = $('coordenadas > coord > rc > pc1').text();
      let pc2 = $('coordenadas > coord > rc > pc2').text();
      let car = $('coordenadas > coord > rc > car').text(); // Cargo
      let cc = $('coordenadas > coord > rc > cc').text();   // Control Code

      // Fallback for Parcel-only response (common for coordinates)
      if (!pc1) {
         pc1 = $('coordenadas > coord > pc > pc1').text();
         pc2 = $('coordenadas > coord > pc > pc2').text();
      }

      if (pc1 && pc2) {
        return pc1 + pc2 + car + cc;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch RefCat from coords', error);
      return null;
    }
  }

  /**
   * Step 2: Get Details (or List of Units) from RefCat
   * Handles both 14-char (Parcel) and 20-char (Unit) inputs.
   */
  async getByRefCat(refCat: string): Promise<{
    isParcel: boolean;
    units: CadastreUnit[];
    parcelRef: string;
  }> {
    // Ensure we have at least the 14-char parcel ref
    const parcelRef = refCat.substring(0, 14);
    const rc1 = parcelRef.substring(0, 7);
    const rc2 = parcelRef.substring(7, 14);

    const params = new URLSearchParams({
      Provincia: '',
      Municipio: '',
      RC: parcelRef // We query the PARCEL to get the list of all units if possible
    });

    const url = `${BASE_URL_CALLEJERO}/Consulta_DNPRC?${params.toString()}`;
    
    try {
      const xml = await fetchXml(url);
      const $ = cheerio.load(xml, { xmlMode: true });

      if ($('lerr > err > desc').text()) {
        console.warn('Cadastre getByRefCat Error:', $('lerr > err > desc').text());
        return { isParcel: true, units: [], parcelRef };
      }

      const units: CadastreUnit[] = [];

      // Case A: It returns a list of units (lrcdnp -> rcdnp)
      $('lrcdnp > rcdnp').each((_, el) => {
        const pc1 = $(el).find('rc > pc1').text();
        const pc2 = $(el).find('rc > pc2').text();
        const car = $(el).find('rc > car').text();
        const cc = $(el).find('rc > cc').text();
        const fullRef = pc1 + pc2 + car + cc;
        const address = $(el).find('domicilio').text();

        units.push({
          refCat: fullRef,
          address: address,
          ...this.parseAddress(address)
        });
      });

      // Case B: It returns a single Property (bico) directly
      $('bico').each((_, el) => {
        const idbi = $(el).find('bi > idbi');
        const pc1 = idbi.find('rc > pc1').text();
        const pc2 = idbi.find('rc > pc2').text();
        const car = idbi.find('rc > car').text();
        const cc = idbi.find('rc > cc').text();
        
        const debi = $(el).find('bi > debi');
        
        units.push({
          refCat: pc1 + pc2 + car + cc,
          address: $(el).find('bi > ld').text(),
          usage: debi.find('luso').text(),
          surfaceConstructed: parseInt(debi.find('sfc').text()) || 0,
          yearBuilt: parseInt(debi.find('ant').text()) || 0,
          ...this.parseAddress($(el).find('bi > ld').text())
        });
      });
      
      return {
        isParcel: units.length > 1,
        units,
        parcelRef
      };

    } catch (error) {
      console.error('Failed to get by RefCat', error);
      return { isParcel: true, units: [], parcelRef };
    }
  }

  /**
   * Step 3: Get Detailed Info for a Specific Unit (20-char Ref)
   * Use this when we've identified the target flat from the list.
   */
  async getUnitDetails(refCat20: string): Promise<CadastreUnit | null> {
    const params = new URLSearchParams({
      RC: refCat20, 
      Provincia: '',
      Municipio: ''
    });
    
    const url = `${BASE_URL_CALLEJERO}/Consulta_DNPRC?${params.toString()}`;
    const xml = await fetchXml(url);
    const $ = cheerio.load(xml, { xmlMode: true });
    
    let unit: CadastreUnit | null = null;

    $('bico').each((_, el) => {
      // Verify it matches our requested RC
      const idbi = $(el).find('bi > idbi');
      const foundRc = idbi.find('rc > pc1').text() + idbi.find('rc > pc2').text() + idbi.find('rc > car').text() + idbi.find('rc > cc').text();
      
      // Relaxed check: if 20 chars match, great. If only 14 match and it's the only bico, take it?
      // But usually we want precise.
      
      const debi = $(el).find('bi > debi');
      unit = {
        refCat: foundRc,
        address: $(el).find('bi > ld').text(),
        usage: debi.find('luso').text(),
        surfaceConstructed: parseInt(debi.find('sfc').text()) || 0,
        yearBuilt: parseInt(debi.find('ant').text()) || 0,
        class: $(el).find('bi > idbi > cn').text(), 
        ...this.parseAddress($(el).find('bi > ld').text())
      };
      
      // Parse construction elements
      const areas: any = {};
      $(el).find('lcons > cons').each((_, cons) => {
          const type = $(cons).find('lcd').text().toLowerCase();
          const size = parseInt($(cons).find('dfcons > stl').text()) || 0;
          if (type.includes('vivienda')) areas.living = (areas.living || 0) + size;
          if (type.includes('almacen') || type.includes('aparcamiento')) areas.storage = (areas.storage || 0) + size;
          if (type.includes('comunes')) areas.common = (areas.common || 0) + size;
      });
      
      if (unit) {
          unit.livingArea = areas.living;
          unit.storageArea = areas.storage;
          unit.commonArea = areas.common;
      }
    });
    
    return unit;
  }

  private parseAddress(raw: string): { floor?: string; door?: string; stair?: string } {
    // Example: "C TORRENT DE LES FLORS 54 Es:1 Pl:00 Pt:01"
    const floorMatch = raw.match(/Pl:(\w+)/);
    const doorMatch = raw.match(/Pt:(\w+)/);
    const stairMatch = raw.match(/Es:(\w+)/);

    return {
      floor: floorMatch ? floorMatch[1] : undefined,
      door: doorMatch ? doorMatch[1] : undefined,
      stair: stairMatch ? stairMatch[1] : undefined
    };
  }
}
