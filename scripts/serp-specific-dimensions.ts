#!/usr/bin/env npx tsx
/**
 * SERP Specific Dimension Searches
 * 
 * Does SPECIFIC searches for each of the 20 neighborhood dimensions.
 * Not combo queries - one search per dimension!
 * 
 * 20 Dimensions:
 * - Life stage (5): student, young_professional, couple, family, retiree
 * - Lifestyle (9): digital_nomad, fitness, foodie, nightlife, arts, nature, pet, lgbtq, eco
 * - Universal (4): safety, quietness, transport, vibe
 * - Economic (2): gentrification, budget
 * 
 * Usage:
 *   npx tsx scripts/serp-specific-dimensions.ts --city=barcelona
 *   npx tsx scripts/serp-specific-dimensions.ts --all
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Config
// ============================================================================

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const PROFILES_TABLE = 'leo-neighborhood-profiles';

// All neighborhoods we researched
const NEIGHBORHOODS: Record<string, string[]> = {
  barcelona: ['Gràcia', 'El Born', 'Raval', 'Barceloneta', 'Sant Antoni', 'Poble Sec', 'Eixample', 'Poble Nou', 'Sants', 'Les Corts', 'Sarrià', 'Horta', 'Clot', 'Sant Gervasi', 'Pedralbes', 'Guinardó', 'Carmel', 'Vallcarca'],
  madrid: ['Malasaña', 'Chueca', 'Lavapiés', 'La Latina', 'Chamberí', 'Salamanca', 'Retiro', 'Argüelles', 'Moncloa', 'Usera', 'Vallecas', 'Carabanchel', 'Tetuán', 'Chamartín', 'Hortaleza', 'Fuencarral'],
  valencia: ['El Carmen', 'Ruzafa', 'Benimaclet', 'Cabanyal', 'Ciutat Vella', 'Extramurs', 'Campanar', 'Benicalap', 'Patraix', 'Jesús'],
  sevilla: ['Triana', 'Santa Cruz', 'Macarena', 'Nervión', 'Centro', 'Alameda', 'Los Remedios', 'Bellavista'],
  malaga: ['Centro Histórico', 'La Malagueta', 'Pedregalejo', 'El Palo', 'Teatinos', 'Huelin', 'Ciudad Jardín'],
  bilbao: ['Casco Viejo', 'Abando', 'Indautxu', 'Deusto', 'San Francisco', 'Santutxu'],
  'san-sebastian': ['Parte Vieja', 'Centro', 'Gros', 'Antiguo', 'Amara', 'Egia'],
  palma: ['Casco Antiguo', 'Santa Catalina', 'El Terreno', 'Son Armadams', 'El Molinar'],
  alicante: ['Centro', 'Playa San Juan', 'Albufereta', 'Carolinas', 'Benalúa'],
  granada: ['Albaicín', 'Centro', 'Realejo', 'Sacromonte', 'Zaidín'],
};

// SPECIFIC queries for each dimension - ONE search per dimension!
const DIMENSION_QUERIES: Record<string, (barrio: string, city: string) => string> = {
  // Life Stage (5) - "best neighborhoods for X" / opinion style
  student: (b, c) => `vivir "${b}" ${c} estudiantes opiniones experiencia foro`,
  young_professional: (b, c) => `mejores barrios ${c} jóvenes profesionales "${b}" blog`,
  couple: (b, c) => `vivir en pareja "${b}" ${c} opiniones experiencia blog`,
  family: (b, c) => `mejores barrios ${c} familias niños "${b}" opiniones guía`,
  retiree: (b, c) => `vivir "${b}" ${c} jubilados mayores opiniones tranquilo blog`,
  
  // Lifestyle (9) - opinion/experience blogs, NOT business listings
  digital_nomad: (b, c) => `"${b}" ${c} nómadas digitales experiencia vivir blog`,
  fitness: (b, c) => `vivir "${b}" ${c} deportes running opiniones barrio activo`,
  foodie: (b, c) => `"${b}" ${c} escena gastronómica opiniones ambiente blog`,
  nightlife: (b, c) => `"${b}" ${c} vida nocturna ambiente opiniones salir blog`,
  arts: (b, c) => `"${b}" ${c} barrio artístico bohemio cultural opiniones`,
  nature: (b, c) => `"${b}" ${c} zonas verdes parques opiniones vivir blog`,
  pet: (b, c) => `vivir "${b}" ${c} perros mascotas opiniones experiencia foro`,
  lgbtq: (b, c) => `"${b}" ${c} barrio gay LGBTQ friendly opiniones blog expat`,
  eco: (b, c) => `"${b}" ${c} sostenible ecológico bicicleta verde opiniones`,
  
  // Universal (4) - direct opinion queries
  safety: (b, c) => `"${b}" ${c} seguro peligroso opiniones vivir seguridad foro`,
  quietness: (b, c) => `"${b}" ${c} ruidoso tranquilo opiniones vivir ruido foro`,
  transport: (b, c) => `"${b}" ${c} bien comunicado transporte opiniones vivir`,
  vibe: (b, c) => `como es vivir en "${b}" ${c} opiniones experiencias blog`,
  
  // Economic (2) - trend/change focused articles
  gentrification: (b, c) => `"${b}" ${c} gentrificación cambio barrio opiniones artículo`,
  budget: (b, c) => `"${b}" ${c} caro barato alquiler precio opiniones foro`,
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

interface DimensionScore {
  dimension: string;
  score: number;      // 0-100
  evidence: string[]; // Snippets that support the score
  confidence: 'high' | 'medium' | 'low';
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
// Serper API
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
      gl: 'es',
      hl: 'es',
      num: 5, // 5 results per dimension
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
// Score Extraction (Simple keyword matching - no LLM needed)
// ============================================================================

const POSITIVE_KEYWORDS: Record<string, string[]> = {
  student: ['universitario', 'estudiantes', 'barato', 'joven', 'ambiente estudiantil', 'erasmus'],
  young_professional: ['jóvenes', 'profesionales', 'moderno', 'dinámico', 'networking', 'afterwork'],
  couple: ['pareja', 'romántico', 'tranquilo', 'restaurantes', 'pasear', 'acogedor'],
  family: ['familia', 'niños', 'colegios', 'parques', 'seguro', 'tranquilo', 'escuelas'],
  retiree: ['jubilados', 'mayores', 'tranquilo', 'servicios', 'centros salud', 'pasear'],
  digital_nomad: ['coworking', 'wifi', 'nómadas', 'remote', 'cafetería', 'freelance', 'portátil'],
  fitness: ['gimnasio', 'running', 'correr', 'ciclismo', 'yoga', 'deportes', 'fit', 'entrenar'],
  foodie: ['restaurantes', 'gastronomía', 'mercado', 'tapas', 'cocina', 'gourmet', 'foodie'],
  nightlife: ['bares', 'discotecas', 'fiesta', 'nocturna', 'copas', 'salir', 'ambiente'],
  arts: ['galería', 'arte', 'teatro', 'cultura', 'museo', 'exposición', 'artista'],
  nature: ['parque', 'verde', 'naturaleza', 'jardín', 'aire libre', 'árboles', 'playa'],
  pet: ['perro', 'mascota', 'canino', 'pet friendly', 'parque perros', 'veterinario'],
  lgbtq: ['lgbtq', 'gay', 'friendly', 'diversidad', 'orgullo', 'inclusivo', 'ambiente gay'],
  eco: ['ecológico', 'sostenible', 'bici', 'reciclaje', 'orgánico', 'verde', 'carril bici'],
  safety: ['seguro', 'tranquilo', 'familia', 'sin problemas', 'confianza'],
  quietness: ['tranquilo', 'silencioso', 'calma', 'paz', 'residencial', 'sin ruido'],
  transport: ['metro', 'bus', 'bien comunicado', 'transporte', 'céntrico', 'conexiones'],
  vibe: ['encanto', 'carácter', 'auténtico', 'bohemio', 'trendy', 'tradicional', 'moderno'],
  gentrification: ['gentrificación', 'subiendo precios', 'turistas', 'cambio', 'hipster', 'moda'],
  budget: ['barato', 'asequible', 'económico', 'low cost', 'presupuesto'],
};

const NEGATIVE_KEYWORDS: Record<string, string[]> = {
  student: ['caro', 'lujoso', 'familiar'],
  young_professional: ['jubilados', 'familiar', 'tranquilo'],
  couple: ['ruidoso', 'fiesta', 'turístico'],
  family: ['ruidoso', 'fiesta', 'peligroso', 'inseguro'],
  retiree: ['ruidoso', 'fiesta', 'joven', 'marcha'],
  digital_nomad: ['sin wifi', 'tradicional'],
  fitness: [],
  foodie: ['cadenas', 'fast food'],
  nightlife: ['tranquilo', 'familiar', 'aburrido'],
  arts: [],
  nature: ['cemento', 'sin verde', 'contaminado'],
  pet: ['prohibido perros', 'no mascotas'],
  lgbtq: ['conservador', 'tradicional'],
  eco: ['contaminado', 'tráfico'],
  safety: ['peligroso', 'inseguro', 'crimen', 'robo', 'cuidado', 'evitar'],
  quietness: ['ruidoso', 'ruido', 'tráfico', 'fiesta', 'turistas'],
  transport: ['mal comunicado', 'lejos', 'aislado', 'sin metro'],
  vibe: [],
  gentrification: ['estable', 'tradicional', 'sin cambios'],
  budget: ['caro', 'lujoso', 'exclusivo', 'premium'],
};

function scoreDimension(dimension: string, snippets: string[]): DimensionScore {
  const positives = POSITIVE_KEYWORDS[dimension] || [];
  const negatives = NEGATIVE_KEYWORDS[dimension] || [];
  
  let positiveHits = 0;
  let negativeHits = 0;
  const evidence: string[] = [];
  
  const allText = snippets.join(' ').toLowerCase();
  
  for (const keyword of positives) {
    if (allText.includes(keyword.toLowerCase())) {
      positiveHits++;
      // Find the snippet containing this keyword
      const match = snippets.find(s => s.toLowerCase().includes(keyword.toLowerCase()));
      if (match && evidence.length < 3) {
        evidence.push(match.slice(0, 150));
      }
    }
  }
  
  for (const keyword of negatives) {
    if (allText.includes(keyword.toLowerCase())) {
      negativeHits++;
    }
  }
  
  // Calculate score
  let score = 50; // Neutral baseline
  score += positiveHits * 10;  // +10 per positive keyword
  score -= negativeHits * 15;  // -15 per negative keyword
  score = Math.max(0, Math.min(100, score));
  
  // Confidence based on evidence
  const totalHits = positiveHits + negativeHits;
  let confidence: 'high' | 'medium' | 'low';
  if (totalHits >= 5) confidence = 'high';
  else if (totalHits >= 2) confidence = 'medium';
  else confidence = 'low';
  
  return { dimension, score, evidence, confidence };
}

// ============================================================================
// Main Research Function
// ============================================================================

async function researchNeighborhood(city: string, neighborhood: string): Promise<Record<string, DimensionScore>> {
  const neighborhoodId = `${city.toLowerCase()}-${neighborhood.toLowerCase().replace(/\s+/g, '-')}`;
  console.log(`  📍 ${neighborhood}, ${city}...`);
  
  const scores: Record<string, DimensionScore> = {};
  
  for (const [dimension, queryFn] of Object.entries(DIMENSION_QUERIES)) {
    const query = queryFn(neighborhood, city);
    
    try {
      const results = await searchSerper(query);
      const snippets = results.map(r => r.snippet).filter(Boolean);
      
      const score = scoreDimension(dimension, snippets);
      scores[dimension] = score;
      
      const emoji = score.score >= 70 ? '🟢' : score.score >= 40 ? '🟡' : '🔴';
      console.log(`    ${emoji} ${dimension}: ${score.score} (${score.confidence})`);
      
      // Rate limit - Serper has 5 req/sec limit
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`    ❌ ${dimension}: Error`);
      scores[dimension] = { dimension, score: 50, evidence: [], confidence: 'low' };
    }
  }
  
  return scores;
}

async function saveNeighborhoodProfile(
  city: string,
  neighborhood: string,
  scores: Record<string, DimensionScore>
): Promise<void> {
  const client = getDocClient();
  const neighborhoodId = `${city.toLowerCase()}-${neighborhood.toLowerCase().replace(/\s+/g, '-')}`;
  
  // Build the profile
  const profile = {
    neighborhood_id: neighborhoodId,
    city: city.toLowerCase(),
    name: neighborhood,
    
    life_stages: {
      student_friendly: scores.student?.score || 50,
      young_professional: scores.young_professional?.score || 50,
      couple_friendly: scores.couple?.score || 50,
      family_friendly: scores.family?.score || 50,
      retiree_friendly: scores.retiree?.score || 50,
    },
    
    lifestyle: {
      digital_nomad: scores.digital_nomad?.score || 50,
      fitness_active: scores.fitness?.score || 50,
      foodie_scene: scores.foodie?.score || 50,
      nightlife_social: scores.nightlife?.score || 50,
      arts_culture: scores.arts?.score || 50,
      nature_outdoor: scores.nature?.score || 50,
      pet_friendly: scores.pet?.score || 50,
      lgbtq_friendly: scores.lgbtq?.score || 50,
      eco_conscious: scores.eco?.score || 50,
    },
    
    universal: {
      safety: scores.safety?.score || 50,
      quietness: scores.quietness?.score || 50,
      transport: scores.transport?.score || 50,
      vibes: [], // Would need more analysis
    },
    
    economics: {
      gentrification_stage: scores.gentrification?.score >= 70 ? 'advanced' : 
                           scores.gentrification?.score >= 50 ? 'mid' : 'stable',
      budget_level: scores.budget?.score >= 70 ? 'budget' :
                   scores.budget?.score >= 40 ? 'middle' : 'upper',
    },
    
    // Evidence for each dimension
    evidence: Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, v.evidence])
    ),
    
    source_count: 20 * 5, // 20 dimensions × 5 results each
    confidence: 'high',
    updated_at: new Date().toISOString(),
  };
  
  await client.send(new PutCommand({
    TableName: PROFILES_TABLE,
    Item: profile,
  }));
  
  console.log(`    ✅ Saved profile for ${neighborhood}`);
}

// ============================================================================
// Main
// ============================================================================

async function researchCity(city: string): Promise<void> {
  const neighborhoods = NEIGHBORHOODS[city];
  if (!neighborhoods) {
    console.error(`Unknown city: ${city}`);
    return;
  }
  
  console.log(`\n🏙️ ${city.toUpperCase()} (${neighborhoods.length} neighborhoods, ${neighborhoods.length * 20} searches)`);
  
  for (const neighborhood of neighborhoods) {
    const scores = await researchNeighborhood(city, neighborhood);
    await saveNeighborhoodProfile(city, neighborhood, scores);
  }
  
  console.log(`\n✅ ${city} complete!\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='))?.split('=')[1];
  const runAll = args.includes('--all');
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SPECIFIC DIMENSION SEARCHES (20 per neighborhood)       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  One search per dimension - not combo queries!              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error('❌ AWS credentials not set');
    process.exit(1);
  }
  
  if (!SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY not set');
    process.exit(1);
  }
  
  // Check remaining credits
  const accountRes = await fetch('https://google.serper.dev/account', {
    headers: { 'X-API-KEY': SERPER_API_KEY },
  });
  const account = await accountRes.json();
  console.log(`💰 Serper credits remaining: ${account.balance}\n`);
  
  if (runAll) {
    const totalSearches = Object.values(NEIGHBORHOODS).flat().length * 20;
    console.log(`📊 Total searches needed: ${totalSearches}`);
    
    if (account.balance < totalSearches) {
      console.error(`❌ Not enough credits! Need ${totalSearches}, have ${account.balance}`);
      process.exit(1);
    }
    
    for (const city of Object.keys(NEIGHBORHOODS)) {
      await researchCity(city);
    }
  } else if (cityArg) {
    await researchCity(cityArg);
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/serp-specific-dimensions.ts --city=barcelona');
    console.log('  npx tsx scripts/serp-specific-dimensions.ts --all');
    console.log('\nAvailable cities:', Object.keys(NEIGHBORHOODS).join(', '));
  }
}

main().catch(console.error);

