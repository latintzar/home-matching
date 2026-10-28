#!/usr/bin/env npx tsx
/**
 * Match SERP Neighborhood Profiles to OSM Barrios
 * 
 * Reads from: leo-neighborhood-profiles (86 profiles)
 * Updates: leo-neighborhood-boundaries (17,594 barrios)
 * 
 * Matching strategy:
 * 1. Exact match: city + normalized name
 * 2. Fuzzy match: Levenshtein distance for close matches
 * 
 * Usage:
 *   npx tsx scripts/geo/match-serp-to-barrios.ts
 *   npx tsx scripts/geo/match-serp-to-barrios.ts --dry-run
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Config
// ============================================================================

const PROFILES_TABLE = 'leo-neighborhood-profiles';
const BOUNDARIES_TABLE = 'leo-neighborhood-boundaries';

const DRY_RUN = process.argv.includes('--dry-run');

// DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// ============================================================================
// Types
// ============================================================================

interface SerpProfile {
  neighborhood_id: string;  // "barcelona-sants"
  city: string;             // "barcelona"
  name: string;             // "Sants"
  
  // Life stage scores
  student_friendly?: number;
  young_professional?: number;
  couple_friendly?: number;
  family_friendly?: number;
  retiree_friendly?: number;
  
  // Lifestyle scores
  digital_nomad?: number;
  fitness_friendly?: number;
  foodie_scene?: number;
  nightlife?: number;
  arts_culture?: number;
  nature_access?: number;
  pet_friendly?: number;
  lgbtq_friendly?: number;
  eco_conscious?: number;
  
  // Universal quality
  safety?: number;
  quietness?: number;
  transport?: number;
  vibe?: string;
  budget_level?: string;
  gentrification?: number;
  
  // Evidence
  evidence?: Record<string, string[]>;
}

interface BarrioBoundary {
  city: string;
  neighborhood_id: string;
  name: string;
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/[^a-z0-9]/g, '')        // Remove non-alphanumeric
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// ============================================================================
// Load Data
// ============================================================================

async function loadSerpProfiles(): Promise<SerpProfile[]> {
  const profiles: SerpProfile[] = [];
  let lastKey: Record<string, unknown> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: PROFILES_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      profiles.push(item as unknown as SerpProfile);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return profiles;
}

async function loadBarriosForCity(city: string): Promise<BarrioBoundary[]> {
  const barrios: BarrioBoundary[] = [];
  let lastKey: Record<string, unknown> | undefined;
  
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: BOUNDARIES_TABLE,
      KeyConditionExpression: 'city = :city',
      ExpressionAttributeValues: { ':city': city },
      ProjectionExpression: 'city, neighborhood_id, #n',
      ExpressionAttributeNames: { '#n': 'name' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      barrios.push(item as unknown as BarrioBoundary);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return barrios;
}

// ============================================================================
// Matching
// ============================================================================

interface MatchResult {
  profile: SerpProfile;
  barrio: BarrioBoundary | null;
  matchType: 'exact' | 'fuzzy' | 'none';
  distance?: number;
}

// Spanish article prefixes that barrios often have
const ARTICLE_PREFIXES = ['el', 'la', 'les', 'los', 'las', 'l'];

// Manual mappings for known mismatches (SERP name → OSM barrio)
// Format: "city/serpName" → { city, neighborhood_id } in leo-neighborhood-boundaries
const MANUAL_MAPPINGS: Record<string, { city: string; neighborhood_id: string; osmName: string }> = {
  // Valencia
  'valencia/ruzafa': { city: 'valencia', neighborhood_id: 'russafa', osmName: 'Russafa' },
  'valencia/cabanyal': { city: 'valencia', neighborhood_id: 'el-cabanyal---el-canyamelar', osmName: 'el Cabanyal - el Canyamelar' },
  
  // Sevilla
  'sevilla/macarena': { city: 'sevilla', neighborhood_id: 'distrito-macarena', osmName: 'Distrito Macarena' },
  
  // Barcelona
  'barcelona/sant gervasi': { city: 'barcelona', neighborhood_id: 'sant-gervasi---galvany', osmName: 'Sant Gervasi - Galvany' },
  'barcelona/vallcarca': { city: 'barcelona', neighborhood_id: 'vallcarca-i-els-penitents', osmName: 'Vallcarca i els Penitents' },
  'barcelona/el born': { city: 'barcelona', neighborhood_id: 'sant-pere--santa-caterina-i-la-ribera', osmName: 'Sant Pere, Santa Caterina i la Ribera' },
  
  // Madrid
  'madrid/fuencarral': { city: 'madrid', neighborhood_id: 'fuencarral-el-pardo', osmName: 'Fuencarral-El Pardo' },
  'madrid/moncloa': { city: 'madrid', neighborhood_id: 'moncloa-aravaca', osmName: 'Moncloa-Aravaca' },
  'madrid/vallecas': { city: 'madrid', neighborhood_id: 'puente-de-vallecas', osmName: 'Puente de Vallecas' },
  'madrid/malasaña': { city: 'madrid', neighborhood_id: 'universidad', osmName: 'Universidad' },
  'madrid/lavapiés': { city: 'madrid', neighborhood_id: 'embajadores', osmName: 'Embajadores' },
  
  // Donostia / San Sebastian (in "other" bucket)
  'donostia/amara': { city: 'other', neighborhood_id: 'amara-zaharra', osmName: 'Amara Zaharra' },
  
  // Granada (in "other" bucket)
  'granada/realejo': { city: 'other', neighborhood_id: 'san-matias---realejo', osmName: 'San Matías - Realejo' },
};

function findBestMatch(profile: SerpProfile, barrios: BarrioBoundary[], city: string): MatchResult {
  if (!profile.name) {
    return { profile, barrio: null, matchType: 'none' };
  }
  const profileNameNorm = normalizeForMatching(profile.name);
  
  // Check manual mapping first
  const manualKey = `${city}/${profile.name.toLowerCase()}`;
  const manual = MANUAL_MAPPINGS[manualKey];
  if (manual) {
    return { 
      profile, 
      barrio: { city: manual.city, neighborhood_id: manual.neighborhood_id, name: manual.osmName },
      matchType: 'exact'  // Treat as exact since we verified it
    };
  }
  
  // Try exact match
  for (const barrio of barrios) {
    if (!barrio.name) continue;
    const barrioNameNorm = normalizeForMatching(barrio.name);
    if (barrioNameNorm === profileNameNorm) {
      return { profile, barrio, matchType: 'exact' };
    }
  }
  
  // Try match with article prefix (barrio has "el/la/les" + profile name)
  for (const barrio of barrios) {
    if (!barrio.name) continue;
    const barrioNameNorm = normalizeForMatching(barrio.name);
    
    for (const prefix of ARTICLE_PREFIXES) {
      // Check if barrio is "el/la + profile" or profile is "el/la + barrio"
      if (barrioNameNorm === prefix + profileNameNorm || 
          profileNameNorm === prefix + barrioNameNorm) {
        return { profile, barrio, matchType: 'fuzzy', distance: 0 };
      }
    }
  }
  
  // Try single-character typo match (same length, starts same, distance=1)
  // This catches Ruzafa/Russafa type variations
  for (const barrio of barrios) {
    if (!barrio.name) continue;
    const barrioNameNorm = normalizeForMatching(barrio.name);
    
    // Must be exactly same length
    if (profileNameNorm.length !== barrioNameNorm.length) {
      continue;
    }
    
    // Must start with same 3 characters
    if (profileNameNorm.length >= 3 && 
        profileNameNorm.substring(0, 3) !== barrioNameNorm.substring(0, 3)) {
      continue;
    }
    
    const distance = levenshteinDistance(profileNameNorm, barrioNameNorm);
    
    // Only accept distance of 1 (single character difference)
    if (distance === 1) {
      return { profile, barrio, matchType: 'fuzzy', distance: 1 };
    }
  }
  
  return { profile, barrio: null, matchType: 'none' };
}

// ============================================================================
// Update
// ============================================================================

async function updateBarrioWithSerpData(
  city: string,
  neighborhoodId: string,
  serpData: Omit<SerpProfile, 'neighborhood_id' | 'city'>
): Promise<void> {
  if (DRY_RUN) return;
  
  await docClient.send(new UpdateCommand({
    TableName: BOUNDARIES_TABLE,
    Key: { city, neighborhood_id: neighborhoodId },
    UpdateExpression: 'SET serpData = :serpData, serpMatchedAt = :now',
    ExpressionAttributeValues: {
      ':serpData': serpData,
      ':now': new Date().toISOString(),
    },
  }));
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('🔗 SERP → Barrios Matching Script');
  console.log(`   Profiles table: ${PROFILES_TABLE}`);
  console.log(`   Boundaries table: ${BOUNDARIES_TABLE}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log('');
  
  // Load SERP profiles
  console.log('📂 Loading SERP profiles...');
  const profiles = await loadSerpProfiles();
  console.log(`   Found ${profiles.length} profiles`);
  
  // Group profiles by city (with special handling for San Sebastian)
  const profilesByCity = new Map<string, SerpProfile[]>();
  for (const profile of profiles) {
    let city = profile.city.toLowerCase();
    
    // Fix San Sebastian profiles (stored as "san" with name "Sebastian xxx")
    if (city === 'san' && profile.name.toLowerCase().startsWith('sebastian')) {
      // Extract the actual neighborhood name
      const actualName = profile.name.replace(/^sebastian\s*/i, '').trim();
      profile.name = actualName || 'Centro';  // Default to Centro if just "Sebastian"
      city = 'donostia';  // San Sebastian's Basque name
    }
    
    if (!profilesByCity.has(city)) {
      profilesByCity.set(city, []);
    }
    profilesByCity.get(city)!.push(profile);
  }
  
  console.log(`   Cities: ${[...profilesByCity.keys()].join(', ')}`);
  console.log('');
  
  // Match each city's profiles
  const results: MatchResult[] = [];
  let matched = 0;
  let fuzzyMatched = 0;
  let unmatched = 0;
  
  for (const [city, cityProfiles] of profilesByCity) {
    console.log(`📍 Processing ${city} (${cityProfiles.length} profiles)...`);
    
    // Load barrios for this city
    const barrios = await loadBarriosForCity(city);
    console.log(`   Found ${barrios.length} barrios in boundaries table`);
    
    // Also check "other" city for this region
    const otherBarrios = await loadBarriosForCity('other');
    const allBarrios = [...barrios, ...otherBarrios];
    
    for (const profile of cityProfiles) {
      const result = findBestMatch(profile, allBarrios, city);
      results.push(result);
      
      if (result.matchType === 'exact') {
        console.log(`   ✅ ${profile.name} → ${result.barrio!.name} (exact)`);
        matched++;
        
        // Update the barrio
        const { neighborhood_id: _, city: __, ...serpData } = profile;
        await updateBarrioWithSerpData(result.barrio!.city, result.barrio!.neighborhood_id, serpData);
        
      } else if (result.matchType === 'fuzzy') {
        console.log(`   🔶 ${profile.name} → ${result.barrio!.name} (fuzzy, dist=${result.distance})`);
        fuzzyMatched++;
        
        // Update the barrio
        const { neighborhood_id: _, city: __, ...serpData } = profile;
        await updateBarrioWithSerpData(result.barrio!.city, result.barrio!.neighborhood_id, serpData);
        
      } else {
        console.log(`   ❌ ${profile.name} → NO MATCH`);
        unmatched++;
      }
    }
    
    console.log('');
  }
  
  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`   Total profiles: ${profiles.length}`);
  console.log(`   Exact matches:  ${matched}`);
  console.log(`   Fuzzy matches:  ${fuzzyMatched}`);
  console.log(`   Unmatched:      ${unmatched}`);
  console.log('');
  
  if (unmatched > 0) {
    console.log('❌ Unmatched profiles:');
    for (const result of results.filter(r => r.matchType === 'none')) {
      console.log(`   - ${result.profile.city}/${result.profile.name}`);
    }
  }
  
  if (DRY_RUN) {
    console.log('');
    console.log('🔸 DRY RUN - No changes made. Run without --dry-run to apply.');
  }
}

main().catch(console.error);
