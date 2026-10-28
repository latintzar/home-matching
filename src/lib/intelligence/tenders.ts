import { callGeminiRest } from '../gemini-rest-client';
import * as cheerio from 'cheerio';

// Configuration for Contratación del Estado
const ATOM_FEED_URL = 'https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom';

export class TenderWatch {
  
  async checkStreetWorks(streetName: string, city: string): Promise<{ activeWorks: any[], summary: string }> {
    console.log(`🏗️ Checking Tenders for: ${streetName}, ${city}`);
    
    try {
      const res = await fetch(ATOM_FEED_URL);
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      const entries = $('entry').toArray();
      const relevantTenders: any[] = [];

      for (const entry of entries) {
        const title = $(entry).find('title').text();
        const summary = $(entry).find('summary').text();
        
        if (!title.toLowerCase().includes(city.toLowerCase()) && !summary.toLowerCase().includes(city.toLowerCase())) continue;
        
        const isWorks = summary.toLowerCase().includes('obras') || summary.toLowerCase().includes('reforma') || summary.toLowerCase().includes('paviment');
        if (!isWorks) continue;

        if (streetName && (title.toLowerCase().includes(streetName.toLowerCase()) || summary.toLowerCase().includes(streetName.toLowerCase()))) {
           relevantTenders.push({
             title: title.substring(0, 200),
             summary: summary.substring(0, 200),
             link: $(entry).find('link').attr('href'),
             date: $(entry).find('updated').text()
           });
        }
      }

      if (relevantTenders.length === 0) {
        return {
          activeWorks: [],
          summary: `No active public tenders found for ${streetName} in ${city} (checked ${entries.length} recent tenders).`
        };
      }

      const prompt = `
        Analyze these public tender snippets for a property report. Street: ${streetName}, City: ${city}.
        Tenders Found: ${JSON.stringify(relevantTenders)}
        Summarize the impact: Noise, duration, benefit.
      `;

      const schema = {
        type: 'object',
        properties: {
            summary: { type: 'string' },
            impact_level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            works_type: { type: 'string' }
        },
        required: ['summary', 'impact_level', 'works_type']
      };

      const response = await callGeminiRest(prompt, {
        model: 'gemini-2.5-flash',
        responseSchema: schema,
        responseMimeType: 'application/json'
      });

      if (response.success && response.text) {
          const object = JSON.parse(response.text);
          return {
            activeWorks: relevantTenders,
            summary: `⚠️ Active Works Detected: ${object.summary} (Impact: ${object.impact_level})`
          };
      }
      
      return {
        activeWorks: relevantTenders,
        summary: `⚠️ Active Works Detected (${relevantTenders.length}). AI analysis failed.`
      };

    } catch (error) {
      console.error('Tender Scraper failed:', error);
      return { activeWorks: [], summary: 'Failed to check public tenders directory.' };
    }
  }
}
