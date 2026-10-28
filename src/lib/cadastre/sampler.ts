import { CadastreClient } from './client';
import { CadastreUnit } from './types';
import { callGeminiRest } from '../gemini-rest-client';

export class NeighborhoodSampler {
  private cadastreClient: CadastreClient;

  constructor() {
    this.cadastreClient = new CadastreClient();
  }

  private async generateSampleAddresses(scope: 'neighborhood' | 'block', context: string, referenceNumber?: string): Promise<string[]> {
    console.log(`Asking Gemini for ${scope} addresses in: ${context}`);
    
    let prompt = "";
    if (scope === 'neighborhood') {
        prompt = `
          I need to analyze the typical building stock in the neighborhood of "${context}" in Spain.
          Provide a list of 100 REAL, existing addresses that represent the diverse areas of this neighborhood.
          Ensure the streets and numbers are real and likely to exist in the Cadastre.
          
          Return JSON format: { "addresses": ["Street 1, City", "Street 2, City"] }
        `;
    } else {
        prompt = `
          I need to analyze the specific street block context for "${context}".
          Provide a list of 100 REAL, existing addresses on "${context}" (or immediate cross streets) with house numbers CLOSE to ${referenceNumber || 'the middle'}.
          Focus on the immediate neighbors to understand this specific block's age.
          Generate even and odd numbers.
          
          Return JSON format: { "addresses": ["Street 1, City", "Street 2, City"] }
        `;
    }

    try {
      // Use our proven REST client instead of the SDK
      const response = await callGeminiRest(prompt, {
          model: 'gemini-2.5-flash', // As specifically requested by user
          temperature: 0.4,
          maxOutputTokens: 8192, 
          responseMimeType: 'application/json'
      });
      
      if (!response.success || !response.text) {
          throw new Error(response.error || 'Gemini returned empty response');
      }

      const cleaned = response.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      
      if (Array.isArray(parsed.addresses)) {
          return parsed.addresses;
      }
      return [];
      
    } catch (error) {
      console.error(`Gemini Address Generation Failed (${scope}):`, error);
      
      // Fallbacks
      if (context.toLowerCase().includes('gracia') || context.toLowerCase().includes('gràcia') || context.toLowerCase().includes('barcelona')) {
          console.log(`Using fallback addresses for ${scope} in ${context}`);
          if (scope === 'block') {
             // Generate synthetic addresses if context allows, otherwise return a fixed set
             // Ideally we'd parse the street name from context and generate numbers
             // For now, return a larger static list for the demo area
             const baseStreet = context.split(',')[0].replace(/\d+/g, '').trim();
             const nums = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40];
             return nums.map(n => `${baseStreet} ${n}, Barcelona`);
          }
          // Neighborhood fallback (Gràcia/Barcelona mix)
          return [
             'Carrer de Verdi 50, Barcelona',
             'Carrer Gran de Gràcia 74, Barcelona',
             'Travessera de Gràcia 120, Barcelona',
             'Carrer del Torrent de l\'Olla 120, Barcelona',
             'Carrer de la Perla 22, Barcelona',
             'Carrer de Torrijos 14, Barcelona',
             'Carrer de l\'Or 30, Barcelona',
             'Plaça de la Virreina 2, Barcelona',
             'Carrer d\'Astúries 12, Barcelona',
             'Carrer de Bailèn 200, Barcelona'
          ];
      }
      return [];
    }
  }

  private async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'PuedoCasa/1.0' } });
      const data = await res.json();
      
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch (e) {
      console.warn(`Geocoding failed for ${address}`, e);
      return null;
    }
  }

  public async sampleArea(scope: 'neighborhood' | 'block', context: string, referenceNumber?: string): Promise<{
    averageYear: number;
    ageRange: { min: number; max: number };
    sampleSize: number;
    dominantUse: string;
    samples: CadastreUnit[];
  } | null> {
    
    const addresses = await this.generateSampleAddresses(scope, context, referenceNumber);
    if (addresses.length === 0) return null;

    console.log(`Generated ${addresses.length} sample addresses for ${scope}. Probing Cadastre...`);

    const validSamples: CadastreUnit[] = [];

    // Add delay helper to respect Nominatim rate limits
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    console.log(`Sampling ${scope}: generated ${addresses.length} candidates.`);

    for (const addr of addresses) {
       if (validSamples.length >= 50) break;

       // Respect rate limits (600ms delay)
       await sleep(600);

       const coords = await this.geocode(addr);
       if (!coords) continue;

       const refCat = await this.cadastreClient.getRefCatFromCoordinates(coords.lat, coords.lng);
       if (!refCat) continue;

       const parcelData = await this.cadastreClient.getByRefCat(refCat);
       if (parcelData.units.length === 0) continue;

       const unit = parcelData.units[0];
       const detail = await this.cadastreClient.getUnitDetails(unit.refCat);
       
       if (detail && detail.yearBuilt && detail.yearBuilt > 1000) {
           validSamples.push(detail);
       }
    }

    if (validSamples.length === 0) return null;

    const years = validSamples.map(u => u.yearBuilt!);
    const avgYear = Math.round(years.reduce((a, b) => a + b, 0) / years.length);
    
    const uses: Record<string, number> = {};
    validSamples.forEach(u => {
        const uStr = u.usage || 'Unknown';
        uses[uStr] = (uses[uStr] || 0) + 1;
    });
    const dominantUse = Object.entries(uses).sort((a, b) => b[1] - a[1])[0][0];

    return {
        averageYear: avgYear,
        ageRange: { min: Math.min(...years), max: Math.max(...years) },
        sampleSize: validSamples.length,
        dominantUse,
        samples: validSamples
    };
  }
}
