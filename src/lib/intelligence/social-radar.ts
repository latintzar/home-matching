import path from 'path';
import { callGeminiRest } from '../gemini-rest-client';
import { z } from 'zod';

// Configuration
const DATA_DIR = process.env.DATA_DIR || '/Users/peterneyra/puedo_casa/data';
const AIRBNB_DB_PATH = path.join(DATA_DIR, 'airbnb_consolidated_20250902_150025.db');

export interface SocialRadarResult {
  airbnb: {
    nearbyListings: number;
    reviewsAnalyzed: number;
    redFlags: string[];
    ratingSummary: string;
    radiusUsed: number;
    touristSaturationLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    listingsDetail: Array<{
        id: string;
        name: string;
        price: string;
        rating: number;
        lat: number;
        lon: number;
    }>;
  };
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class SocialRadar {
  private airbnbDb: any = null;

  constructor() {
    // Initialize databases lazily/dynamically to avoid build-time issues
  }

  private ensureAirbnbDb() {
    if (!this.airbnbDb) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require('better-sqlite3');
        this.airbnbDb = new Database(AIRBNB_DB_PATH, { readonly: true, fileMustExist: true });
      } catch (error) {
        console.warn('SocialRadar: Airbnb DB (better-sqlite3) not found or accessible:', error);
      }
    }
    return this.airbnbDb;
  }

  private getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; 
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dphi = ((lat2 - lat1) * Math.PI) / 180;
    const dlambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dphi/2) * Math.sin(dphi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda/2) * Math.sin(dlambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  public async analyzeLocation(lat: number, lon: number, addressTerms: string[], locationType: 'exact' | 'neighborhood' = 'exact'): Promise<SocialRadarResult> {
    console.log(`📡 Social Radar scanning: ${lat}, ${lon} [${addressTerms.join(', ')}] (Type: ${locationType})`);
    const airbnbData = this.scanAirbnb(lat, lon, locationType);
    const synthesis = await this.generateReport(airbnbData, addressTerms[0]);
    return {
      airbnb: airbnbData,
      summary: synthesis.summary,
      riskLevel: synthesis.riskLevel
    };
  }

  private scanAirbnb(lat: number, lon: number, locationType: 'exact' | 'neighborhood') {
    const db = this.ensureAirbnbDb();
    if (!db) return { 
        nearbyListings: 0, 
        reviewsAnalyzed: 0, 
        redFlags: [], 
        ratingSummary: 'Database unavailable', 
        radiusUsed: 0, 
        touristSaturationLevel: 'LOW' as const,
        listingsDetail: []
    };
    
    const radii = locationType === 'neighborhood' ? [500, 1000, 2000] : [100, 300, 500];
    let nearbyListings: any[] = [];
    let usedRadius = 0;

    for (const r of radii) {
      const delta = 0.02; 
      // Fetch basic fields needed for map & list
      const stmt = db.prepare(`SELECT id, name, latitude, longitude, review_scores_rating, price FROM listings WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`);
      const candidates = stmt.all(lat - delta, lat + delta, lon - delta, lon + delta) as any[];
      const filtered = candidates.filter((c: any) => this.getHaversineDistance(lat, lon, parseFloat(c.latitude), parseFloat(c.longitude)) <= r);
      const threshold = locationType === 'neighborhood' ? 20 : 5;
      if (filtered.length >= threshold) { nearbyListings = filtered; usedRadius = r; break; }
      nearbyListings = filtered; usedRadius = r;
    }

    // Calculate Saturation Level
    let touristSaturationLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const density = nearbyListings.length; 
    
    if (usedRadius === 100) {
        if (density > 10) touristSaturationLevel = 'HIGH';
        else if (density > 3) touristSaturationLevel = 'MEDIUM';
    } else if (usedRadius === 300) {
        if (density > 30) touristSaturationLevel = 'HIGH';
        else if (density > 10) touristSaturationLevel = 'MEDIUM';
    } else {
        if (density > 50) touristSaturationLevel = 'HIGH';
        else if (density > 20) touristSaturationLevel = 'MEDIUM';
    }

    if (nearbyListings.length === 0) return { 
        nearbyListings: 0, 
        reviewsAnalyzed: 0, 
        redFlags: [], 
        ratingSummary: 'No listings found nearby.', 
        radiusUsed: usedRadius,
        touristSaturationLevel: 'LOW' as const,
        listingsDetail: []
    };

    // Get details for top 50 listings to show on map/list
    const listingsDetail = nearbyListings.slice(0, 50).map((l: any) => ({
        id: l.id,
        name: l.name,
        price: l.price,
        rating: l.review_scores_rating,
        lat: parseFloat(l.latitude),
        lon: parseFloat(l.longitude)
    }));

    const sampleListings = nearbyListings.slice(0, 30).map((l: any) => l.id);
    const placeholders = sampleListings.map(() => '?').join(',');
    const reviewsStmt = db.prepare(`SELECT comments, date, review_scores_rating FROM reviews LEFT JOIN listings ON reviews.listing_id = listings.id WHERE listing_id IN (${placeholders}) ORDER BY date DESC LIMIT 100`);
    const reviews = reviewsStmt.all(...sampleListings) as any[];
    const redFlagKeywords = ['ruido', 'noise', 'olor', 'smell', 'obras', 'construction', 'frio', 'cold', 'damp', 'humedad', 'paredes', 'thin walls', 'cockroach', 'cucarachas', 'robbery', 'robo', 'policia'];
    const flags = reviews.filter((r: any) => r.comments && redFlagKeywords.some(k => r.comments.toLowerCase().includes(k))).map((r: any) => {
      const text = r.comments;
      const lowerText = text.toLowerCase();
      const matchedKeyword = redFlagKeywords.find(k => lowerText.includes(k));
      
      if (matchedKeyword) {
        const index = lowerText.indexOf(matchedKeyword);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + 100);
        return { 
          date: r.date, 
          text: (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '') 
        };
      }
      return { date: r.date, text: r.comments.substring(0, 150) + '...' };
    });

    return { 
        nearbyListings: nearbyListings.length, 
        reviewsAnalyzed: reviews.length, 
        redFlags: flags.slice(0, 20).map(f => f.text), 
        ratingSummary: `Found ${nearbyListings.length} listings within ${usedRadius}m.`, 
        radiusUsed: usedRadius,
        touristSaturationLevel,
        listingsDetail
    };
  }

  private async generateReport(airbnb: any, locationName: string) {
    const prompt = `
      You are an expert Real Estate Intelligence Agent.
      Analyze the following "Lived Reality" data for a property location: "${locationName}".
      ## Tourist Market Analysis (Airbnb Proxy for Saturation)
      - Listings found: ${airbnb.nearbyListings} (Radius: ${airbnb.radiusUsed}m)
      - Saturation Level: ${airbnb.touristSaturationLevel}
      - Note: This data serves as a proxy for official RTA saturation metrics.
      - Potential Issues Flagged (Reviews): ${JSON.stringify(airbnb.redFlags)}
      ## Task
      1. Summarize the "Vibe" and "Hidden Risks". Specifically mention tourist pressure if saturation is HIGH.
      2. Assign a Risk Level (LOW, MEDIUM, HIGH).
      Output JSON: { "summary": string, "riskLevel": "LOW" | "MEDIUM" | "HIGH" }
    `;

    const schema = {
        type: 'object',
        properties: {
            summary: { type: 'string' },
            riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] }
        },
        required: ['summary', 'riskLevel']
    };

    try {
      const response = await callGeminiRest(prompt, {
        model: 'gemini-2.5-flash',
        responseSchema: schema,
        responseMimeType: 'application/json'
      });

      if (response.success && response.text) {
        return JSON.parse(response.text);
      }
      throw new Error(response.error || 'No text returned');
    } catch (error) {
      console.error('Gemini Social Radar failed:', error);
      return { summary: "Failed to generate intelligence report.", riskLevel: "LOW" as const };
    }
  }
}
