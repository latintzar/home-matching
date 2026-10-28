#!/usr/bin/env npx tsx
/**
 * SERP Neighborhood Research Script
 * 
 * Phase 1 Pre-Launch Setup
 * 
 * Uses Serper.dev (FREE tier: 2,500 queries) + ScrapingDog credits
 * to research neighborhood profiles for 10 cities.
 * 
 * Extracts 20 dimensions:
 * - Life stage: student, young professional, couple, family, retiree
 * - Lifestyle: digital nomad, fitness, foodie, nightlife, arts, nature, pet, LGBTQ, eco
 * - Universal: safety, quietness, transport, vibe
 * - Economic: gentrification, budget level
 * 
 * Total cost: ~$5 (one-time)
 * 
 * Usage:
 *   npx tsx scripts/serp-research.ts --city=barcelona
 *   npx tsx scripts/serp-research.ts --all
 *   npx tsx scripts/serp-research.ts --aggregate
 */

import * as fs from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { callGeminiRest } from '../src/lib/gemini-rest-client';

// ============================================================================
// Config
// ============================================================================

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const OUTPUT_TABLE = 'leo-serp-extractions';
const PROFILES_TABLE = 'leo-neighborhood-profiles';

// Target cities and neighborhoods (Spain focus)
const CITIES: Record<string, string[]> = {
  barcelona: [
    'Gràcia', 'El Born', 'Raval', 'Barceloneta', 'Sant Antoni', 'Poble Sec',
    'Eixample', 'Poble Nou', 'Sants', 'Les Corts', 'Sarrià', 'Horta',
    'Clot', 'Sant Gervasi', 'Pedralbes', 'Guinardó', 'Carmel', 'Vallcarca',
  ],
  madrid: [
    'Malasaña', 'Chueca', 'Lavapiés', 'La Latina', 'Chamberí', 'Salamanca',
    'Retiro', 'Argüelles', 'Moncloa', 'Usera', 'Vallecas', 'Carabanchel',
    'Tetuán', 'Chamartín', 'Hortaleza', 'Fuencarral',
  ],
  valencia: [
    'El Carmen', 'Ruzafa', 'Benimaclet', 'Cabanyal', 'Ciutat Vella', 'Extramurs',
    'Campanar', 'Benicalap', 'Patraix', 'Jesús',
  ],
  sevilla: [
    'Triana', 'Santa Cruz', 'Macarena', 'Nervión', 'Centro', 'Alameda',
    'Los Remedios', 'Bellavista',
  ],
  malaga: [
    'Centro Histórico', 'La Malagueta', 'Pedregalejo', 'El Palo', 'Teatinos',
    'Huelin', 'Ciudad Jardín',
  ],
  bilbao: [
    'Casco Viejo', 'Abando', 'Indautxu', 'Deusto', 'San Francisco', 'Santutxu',
  ],
  'san-sebastian': [
    'Parte Vieja', 'Centro', 'Gros', 'Antiguo', 'Amara', 'Egia',
  ],
  palma: [
    'Casco Antiguo', 'Santa Catalina', 'El Terreno', 'Son Armadams', 'El Molinar',
  ],
  alicante: [
    'Centro', 'Playa San Juan', 'Albufereta', 'Carolinas', 'Benalúa',
  ],
  granada: [
    'Albaicín', 'Centro', 'Realejo', 'Sacromonte', 'Zaidín',
  ],
};

// Combo queries (7 per neighborhood for efficiency)
const COMBO_QUERIES = {
  life_stages: (barrio: string, city: string) => 
    `"${barrio}" ${city} vivir opiniones familias jóvenes estudiantes jubilados`,
  
  social: (barrio: string, city: string) =>
    `"${barrio}" ${city} vida nocturna bares citas ambiente social LGBTQ`,
  
  work: (barrio: string, city: string) =>
    `"${barrio}" ${city} coworking wifi cafetería trabajar nómadas digitales`,
  
  active: (barrio: string, city: string) =>
    `"${barrio}" ${city} gimnasios correr ciclismo parques mascotas perros`,
  
  culture: (barrio: string, city: string) =>
    `"${barrio}" ${city} restaurantes galerías teatro mercados vegano`,
  
  family_safety: (barrio: string, city: string) =>
    `"${barrio}" ${city} colegios niños seguridad parques familias`,
  
  practical: (barrio: string, city: string) =>
    `"${barrio}" ${city} transporte metro ruido precio alquiler gentrificación`,
};

// ============================================================================
// Types
// ============================================================================

interface SerpResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

interface SerpExtraction {
  page_id: string;
  neighborhood_id: string;
  city: string;
  neighborhood: string;
  query_category: string;
  url: string;
  title: string;
  snippet: string;
  position: number;
  
  // Extracted dimensions (nullable)
  life_stages?: {
    student_friendly?: number;
    young_professional?: number;
    couple_friendly?: number;
    family_friendly?: number;
    retiree_friendly?: number;
  };
  
  lifestyle?: {
    digital_nomad?: number;
    fitness_active?: number;
    foodie_scene?: number;
    nightlife_social?: number;
    arts_culture?: number;
    nature_outdoor?: number;
    pet_friendly?: number;
    lgbtq_friendly?: number;
    eco_conscious?: number;
  };
  
  universal?: {
    safety?: number;
    quietness?: number;
    transport?: number;
    vibe?: string[];
  };
  
  economics?: {
    gentrification_stage?: string;
    budget_level?: string;
  };
  
  credibility: string;
  extracted_at: string;
}

// ============================================================================
// DynamoDB Client
// ============================================================================

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

// ============================================================================
// Serper.dev API
// ============================================================================

async function searchSerper(query: string): Promise<SerpResult[]> {
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY not set');
  }
  
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'es',  // Spain
      hl: 'es',  // Spanish
      num: 10,   // 10 results
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }
  
  const data = await response.json();
  return (data.organic || []).map((r: any, i: number) => ({
    position: i + 1,
    title: r.title,
    link: r.link,
    snippet: r.snippet || '',
  }));
}

// ============================================================================
// LLM Extraction
// ============================================================================

const EXTRACTION_PROMPT = `Extract neighborhood insights from this search result snippet.
Focus ONLY on the AREA and NEIGHBORHOOD character.

SNIPPET:
"""
{SNIPPET}
"""

URL: {URL}
TITLE: {TITLE}

Extract (null if not mentioned):
{
  "life_stages": {
    "student_friendly": 1-5 | null,
    "young_professional": 1-5 | null,
    "couple_friendly": 1-5 | null,
    "family_friendly": 1-5 | null,
    "retiree_friendly": 1-5 | null
  },
  "lifestyle": {
    "digital_nomad": 1-5 | null,
    "fitness_active": 1-5 | null,
    "foodie_scene": 1-5 | null,
    "nightlife_social": 1-5 | null,
    "arts_culture": 1-5 | null,
    "nature_outdoor": 1-5 | null,
    "pet_friendly": 1-5 | null,
    "lgbtq_friendly": 1-5 | null,
    "eco_conscious": 1-5 | null
  },
  "universal": {
    "safety": 1-5 | null,
    "quietness": 1-5 | null,
    "transport": 1-5 | null,
    "vibe": ["hipster", "traditional", etc.]
  },
  "economics": {
    "gentrification_stage": "early|mid|advanced|peaked|stable" | null,
    "budget_level": "budget|middle|upper|luxury" | null
  },
  "credibility": "official|news|blog_expert|blog_personal|forum|unknown"
}

JSON only:`;

async function extractFromSnippet(
  result: SerpResult,
  neighborhoodId: string,
  city: string,
  neighborhood: string,
  category: string
): Promise<SerpExtraction> {
  const prompt = EXTRACTION_PROMPT
    .replace('{SNIPPET}', result.snippet)
    .replace('{URL}', result.link)
    .replace('{TITLE}', result.title);
  
  const response = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash-lite',
    temperature: 0.1,
    maxOutputTokens: 500,
    responseMimeType: 'application/json',
  });
  
  let extracted: any = {};
  if (response.success && response.text) {
    try {
      extracted = JSON.parse(response.text);
    } catch {
      // Use empty extraction
    }
  }
  
  // Generate page_id from URL hash
  const pageId = Buffer.from(result.link).toString('base64').substring(0, 40);
  
  return {
    page_id: pageId,
    neighborhood_id: neighborhoodId,
    city,
    neighborhood,
    query_category: category,
    url: result.link,
    title: result.title,
    snippet: result.snippet,
    position: result.position,
    life_stages: extracted.life_stages,
    lifestyle: extracted.lifestyle,
    universal: extracted.universal,
    economics: extracted.economics,
    credibility: extracted.credibility || 'unknown',
    extracted_at: new Date().toISOString(),
  };
}

// ============================================================================
// Research Pipeline
// ============================================================================

async function researchNeighborhood(
  city: string,
  neighborhood: string
): Promise<SerpExtraction[]> {
  const neighborhoodId = `${city.toLowerCase()}-${neighborhood.toLowerCase().replace(/\s+/g, '-')}`;
  const extractions: SerpExtraction[] = [];
  
  console.log(`  📍 Researching ${neighborhood}, ${city}...`);
  
  for (const [category, queryFn] of Object.entries(COMBO_QUERIES)) {
    const query = queryFn(neighborhood, city);
    
    try {
      const results = await searchSerper(query);
      console.log(`    ${category}: ${results.length} results`);
      
      // Extract from each result
      for (const result of results) {
        try {
          const extraction = await extractFromSnippet(
            result,
            neighborhoodId,
            city,
            neighborhood,
            category
          );
          extractions.push(extraction);
        } catch (error) {
          console.error(`    Error extracting from ${result.link}:`, error);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Delay between queries
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`    Error searching ${category}:`, error);
    }
  }
  
  return extractions;
}

async function researchCity(city: string): Promise<void> {
  const neighborhoods = CITIES[city];
  if (!neighborhoods) {
    console.error(`Unknown city: ${city}`);
    return;
  }
  
  console.log(`\n🏙️ Researching ${city} (${neighborhoods.length} neighborhoods)...\n`);
  
  const client = getDocClient();
  let totalExtractions = 0;
  
  for (const neighborhood of neighborhoods) {
    const extractions = await researchNeighborhood(city, neighborhood);
    totalExtractions += extractions.length;
    
    // Save to DynamoDB in batches
    for (let i = 0; i < extractions.length; i += 25) {
      const batch = extractions.slice(i, i + 25);
      
      const writeRequests = batch.map(e => ({
        PutRequest: { Item: e },
      }));
      
      try {
        await client.send(new BatchWriteCommand({
          RequestItems: {
            [OUTPUT_TABLE]: writeRequests,
          },
        }));
      } catch (error) {
        console.error('Batch write error:', error);
        
        // Fallback to individual writes
        for (const extraction of batch) {
          try {
            await client.send(new PutCommand({
              TableName: OUTPUT_TABLE,
              Item: extraction,
            }));
          } catch (e) {
            console.error('Individual write error:', e);
          }
        }
      }
    }
    
    console.log(`    ✅ Saved ${extractions.length} extractions for ${neighborhood}`);
  }
  
  console.log(`\n✅ ${city}: ${totalExtractions} total extractions saved\n`);
}

// ============================================================================
// Aggregation
// ============================================================================

async function aggregateNeighborhoodProfiles(): Promise<void> {
  console.log('\n📊 Aggregating neighborhood profiles...\n');
  
  const client = getDocClient();
  
  // Scan all extractions
  let lastKey: any;
  const extractionsByNeighborhood = new Map<string, SerpExtraction[]>();
  
  do {
    const result = await client.send(new ScanCommand({
      TableName: OUTPUT_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      const extraction = item as SerpExtraction;
      const existing = extractionsByNeighborhood.get(extraction.neighborhood_id) || [];
      existing.push(extraction);
      extractionsByNeighborhood.set(extraction.neighborhood_id, existing);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`Found extractions for ${extractionsByNeighborhood.size} neighborhoods\n`);
  
  // Aggregate each neighborhood
  for (const [neighborhoodId, extractions] of extractionsByNeighborhood) {
    const first = extractions[0];
    
    // Calculate averages for each dimension
    const avgScores: Record<string, number[]> = {};
    const vibes: string[] = [];
    const gentrificationStages: string[] = [];
    const budgetLevels: string[] = [];
    
    for (const e of extractions) {
      // Life stages
      if (e.life_stages) {
        for (const [k, v] of Object.entries(e.life_stages)) {
          if (v !== null && v !== undefined) {
            avgScores[k] = avgScores[k] || [];
            avgScores[k].push(v);
          }
        }
      }
      
      // Lifestyle
      if (e.lifestyle) {
        for (const [k, v] of Object.entries(e.lifestyle)) {
          if (v !== null && v !== undefined) {
            avgScores[k] = avgScores[k] || [];
            avgScores[k].push(v);
          }
        }
      }
      
      // Universal
      if (e.universal) {
        for (const [k, v] of Object.entries(e.universal)) {
          if (k === 'vibe' && Array.isArray(v)) {
            vibes.push(...v);
          } else if (v !== null && v !== undefined && typeof v === 'number') {
            avgScores[k] = avgScores[k] || [];
            avgScores[k].push(v);
          }
        }
      }
      
      // Economics
      if (e.economics) {
        if (e.economics.gentrification_stage) {
          gentrificationStages.push(e.economics.gentrification_stage);
        }
        if (e.economics.budget_level) {
          budgetLevels.push(e.economics.budget_level);
        }
      }
    }
    
    // Calculate final scores
    const finalScores: Record<string, number> = {};
    for (const [k, values] of Object.entries(avgScores)) {
      if (values.length > 0) {
        finalScores[k] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 20); // Convert 1-5 to 0-100
      }
    }
    
    // Determine confidence based on source count
    let confidence: 'high' | 'medium' | 'low';
    if (extractions.length >= 50) confidence = 'high';
    else if (extractions.length >= 20) confidence = 'medium';
    else confidence = 'low';
    
    // Most common vibe
    const vibeCounts = new Map<string, number>();
    vibes.forEach(v => vibeCounts.set(v, (vibeCounts.get(v) || 0) + 1));
    const topVibes = [...vibeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([v]) => v);
    
    // Most common gentrification stage
    const gentrificationCount = new Map<string, number>();
    gentrificationStages.forEach(s => gentrificationCount.set(s, (gentrificationCount.get(s) || 0) + 1));
    const topGentrification = [...gentrificationCount.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
    
    // Most common budget level
    const budgetCount = new Map<string, number>();
    budgetLevels.forEach(l => budgetCount.set(l, (budgetCount.get(l) || 0) + 1));
    const topBudget = [...budgetCount.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'middle';
    
    // Build final profile
    const profile = {
      neighborhood_id: neighborhoodId,
      city: first.city,
      name: first.neighborhood,
      
      // Life stage scores (0-100)
      life_stages: {
        student_friendly: finalScores.student_friendly || 50,
        young_professional: finalScores.young_professional || 50,
        couple_friendly: finalScores.couple_friendly || 50,
        family_friendly: finalScores.family_friendly || 50,
        retiree_friendly: finalScores.retiree_friendly || 50,
      },
      
      // Lifestyle scores (0-100)
      lifestyle: {
        digital_nomad: finalScores.digital_nomad || 50,
        fitness_active: finalScores.fitness_active || 50,
        foodie_scene: finalScores.foodie_scene || 50,
        nightlife_social: finalScores.nightlife_social || 50,
        arts_culture: finalScores.arts_culture || 50,
        nature_outdoor: finalScores.nature_outdoor || 50,
        pet_friendly: finalScores.pet_friendly || 50,
        lgbtq_friendly: finalScores.lgbtq_friendly || 50,
        eco_conscious: finalScores.eco_conscious || 50,
      },
      
      // Universal scores (0-100)
      universal: {
        safety: finalScores.safety || 50,
        quietness: finalScores.quietness || 50,
        transport: finalScores.transport || 50,
        vibes: topVibes,
      },
      
      // Economics
      economics: {
        gentrification_stage: topGentrification,
        budget_level: topBudget,
      },
      
      // Meta
      source_count: extractions.length,
      confidence,
      updated_at: new Date().toISOString(),
    };
    
    // Save to profiles table
    await client.send(new PutCommand({
      TableName: PROFILES_TABLE,
      Item: profile,
    }));
    
    console.log(`✅ ${first.neighborhood}, ${first.city}: ${extractions.length} sources → ${Object.keys(finalScores).length} dimensions`);
  }
  
  console.log('\n✅ Aggregation complete!\n');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='))?.split('=')[1];
  const runAll = args.includes('--all');
  const aggregate = args.includes('--aggregate');
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           SERP NEIGHBORHOOD RESEARCH                         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Serper.dev FREE tier: 2,500 queries                         ║');
  console.log('║  Estimated cost: ~$5 for 10 cities                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Check environment
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error('❌ AWS credentials not set. Run:');
    console.log('source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION');
    process.exit(1);
  }
  
  if (!SERPER_API_KEY && !aggregate) {
    console.error('❌ SERPER_API_KEY not set in environment');
    process.exit(1);
  }
  
  if (aggregate) {
    await aggregateNeighborhoodProfiles();
  } else if (runAll) {
    for (const city of Object.keys(CITIES)) {
      await researchCity(city);
    }
    await aggregateNeighborhoodProfiles();
  } else if (cityArg) {
    await researchCity(cityArg);
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/serp-research.ts --city=barcelona');
    console.log('  npx tsx scripts/serp-research.ts --all');
    console.log('  npx tsx scripts/serp-research.ts --aggregate');
    console.log('\nAvailable cities:', Object.keys(CITIES).join(', '));
  }
  
  console.log('\n✅ Done!\n');
}

main().catch(console.error);

