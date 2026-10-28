/**
 * Spatial Aggregation Script: Census Sections → Neighborhoods
 * 
 * This script:
 * 1. Loads neighborhood boundaries from DynamoDB (leo-neighborhood-boundaries)
 * 2. Loads census sections with income data from spain-datasets
 * 3. Performs spatial join to find which census sections fall within each neighborhood
 * 4. Calculates weighted average income per neighborhood
 * 5. Updates neighborhood records with aggregated income data
 * 
 * Usage: npx tsx src/scripts/aggregateCensusToNeighborhoods.ts --city barcelona
 */

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// Types
interface CensusSection {
  cusec: string;
  geometry: turf.Feature<turf.Polygon | turf.MultiPolygon>;
  incomePerPerson: number | null;
  incomePerHousehold: number | null;
  area: number;
}

interface Neighborhood {
  city: string;
  neighborhood_id: string;
  name: string;
  geometry: turf.Feature<turf.Polygon | turf.MultiPolygon>;
  income_per_person?: number;
  income_per_household?: number;
  income_score?: number;
  census_sections_count?: number;
}

interface IncomeRecord {
  codigo: string;
  comunidad: string;
  provincia: string;
  municipio: string;
  tipo: string;
  rentaPersona: number | null;
  rentaHogar: number | null;
}

const SPAIN_DATASETS_PATH = '/Users/peterneyra/puedo_casa/Random Files I Want To Give Cursor/spain-datasets';
const DYNAMODB_TABLE = 'leo-neighborhood-boundaries';

const CITY_PROVINCE_MAP: Record<string, { provinceCode: string; regionCode: string; municipalityCode?: string }> = {
  barcelona: { provinceCode: '08', regionCode: 'ES-CT', municipalityCode: '019' },
  madrid: { provinceCode: '28', regionCode: 'ES-MD', municipalityCode: '079' },
  valencia: { provinceCode: '46', regionCode: 'ES-VC', municipalityCode: '250' },
  sevilla: { provinceCode: '41', regionCode: 'ES-AN', municipalityCode: '091' },
  malaga: { provinceCode: '29', regionCode: 'ES-AN', municipalityCode: '067' },
  bilbao: { provinceCode: '48', regionCode: 'ES-PV', municipalityCode: '020' },
};

const dynamodb = DynamoDBDocument.from(new DynamoDB({
  region: process.env.AWS_REGION || 'eu-west-1',
}));

function loadIncomeData(): Map<string, IncomeRecord> {
  const csvPath = path.join(SPAIN_DATASETS_PATH, 'data', 'Renta media en España.csv');
  console.log(`📊 Loading income data from ${csvPath}`);
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
  });
  
  const incomeMap = new Map<string, IncomeRecord>();
  
  for (const record of records) {
    if (record['Tipo de elemento'] !== 'sección') continue;
    
    const codigo = record['Código de territorio'];
    const cusec = codigo.padStart(10, '0');
    
    incomeMap.set(cusec, {
      codigo,
      comunidad: record['Comunidad autónoma'],
      provincia: record['Provincia'],
      municipio: record['Municipio'],
      tipo: record['Tipo de elemento'],
      rentaPersona: record['Renta media por persona'] ? parseFloat(record['Renta media por persona']) : null,
      rentaHogar: record['Renta media por hogar'] ? parseFloat(record['Renta media por hogar']) : null,
    });
  }
  
  console.log(`   Loaded ${incomeMap.size} census section income records`);
  return incomeMap;
}

function loadCensusSections(regionCode: string, incomeMap: Map<string, IncomeRecord>): CensusSection[] {
  const geojsonPath = path.join(SPAIN_DATASETS_PATH, 'data', 'census', `SECC_CE_${regionCode}_20190101.json`);
  console.log(`🗺️  Loading census sections from ${geojsonPath}`);
  
  if (!fs.existsSync(geojsonPath)) {
    throw new Error(`Census section file not found: ${geojsonPath}`);
  }
  
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
  const sections: CensusSection[] = [];
  
  for (const feature of geojson.features) {
    const cusec = feature.properties.CUSEC;
    const income = incomeMap.get(cusec);
    
    sections.push({
      cusec,
      geometry: feature,
      incomePerPerson: income?.rentaPersona ?? null,
      incomePerHousehold: income?.rentaHogar ?? null,
      area: turf.area(feature),
    });
  }
  
  console.log(`   Loaded ${sections.length} census sections`);
  const withIncome = sections.filter(s => s.incomePerPerson !== null).length;
  console.log(`   ${withIncome} sections have income data (${((withIncome/sections.length)*100).toFixed(1)}%)`);
  
  return sections;
}

async function loadNeighborhoods(city: string): Promise<Neighborhood[]> {
  console.log(`🏘️  Loading neighborhoods for ${city} from DynamoDB`);
  
  const result = await dynamodb.query({
    TableName: DYNAMODB_TABLE,
    KeyConditionExpression: 'city = :city',
    ExpressionAttributeValues: { ':city': city },
  });
  
  const neighborhoods: Neighborhood[] = [];
  
  for (const item of result.Items || []) {
    if (!item.geometry) {
      console.warn(`   ⚠️ Neighborhood ${item.name} has no geometry, skipping`);
      continue;
    }
    
    neighborhoods.push({
      city: item.city,
      neighborhood_id: item.neighborhood_id,
      name: item.name,
      geometry: typeof item.geometry === 'string' ? JSON.parse(item.geometry) : item.geometry,
    });
  }
  
  console.log(`   Loaded ${neighborhoods.length} neighborhoods`);
  return neighborhoods;
}

function spatialJoin(neighborhoods: Neighborhood[], censusSections: CensusSection[], municipalityCode?: string): Map<string, CensusSection[]> {
  console.log(`\n🔗 Performing spatial join...`);
  
  let filteredSections = censusSections;
  if (municipalityCode) {
    filteredSections = censusSections.filter(s => {
      const sectionMunicipality = s.cusec.substring(2, 5);
      return sectionMunicipality === municipalityCode;
    });
    console.log(`   Filtered to ${filteredSections.length} sections in municipality ${municipalityCode}`);
  }
  
  const neighborhoodSections = new Map<string, CensusSection[]>();
  let totalMatches = 0;
  
  for (const hood of neighborhoods) {
    const matchingSections: CensusSection[] = [];
    
    for (const section of filteredSections) {
      try {
        const centroid = turf.centroid(section.geometry);
        const isWithin = turf.booleanPointInPolygon(centroid, hood.geometry);
        
        if (isWithin) {
          matchingSections.push(section);
        }
      } catch (error) {
        continue;
      }
    }
    
    neighborhoodSections.set(hood.neighborhood_id, matchingSections);
    totalMatches += matchingSections.length;
    
    if (matchingSections.length > 0) {
      console.log(`   ${hood.name}: ${matchingSections.length} census sections`);
    }
  }
  
  console.log(`\n   Total matches: ${totalMatches} census sections across ${neighborhoods.length} neighborhoods`);
  return neighborhoodSections;
}

function calculateAggregatedIncome(neighborhoods: Neighborhood[], neighborhoodSections: Map<string, CensusSection[]>, allSections: CensusSection[]): Neighborhood[] {
  console.log(`\n💰 Calculating aggregated income...`);
  
  const allIncomes = allSections.filter(s => s.incomePerPerson !== null).map(s => s.incomePerPerson!);
  const minIncome = Math.min(...allIncomes);
  const maxIncome = Math.max(...allIncomes);
  
  console.log(`   National income range: €${minIncome.toFixed(0)} - €${maxIncome.toFixed(0)}`);
  
  const results: Neighborhood[] = [];
  
  for (const hood of neighborhoods) {
    const sections = neighborhoodSections.get(hood.neighborhood_id) || [];
    
    if (sections.length === 0) {
      results.push({ ...hood, income_per_person: undefined, income_per_household: undefined, income_score: undefined, census_sections_count: 0 });
      continue;
    }
    
    const sectionsWithIncome = sections.filter(s => s.incomePerPerson !== null);
    
    if (sectionsWithIncome.length === 0) {
      results.push({ ...hood, income_per_person: undefined, income_per_household: undefined, income_score: undefined, census_sections_count: sections.length });
      continue;
    }
    
    const totalArea = sectionsWithIncome.reduce((sum, s) => sum + s.area, 0);
    
    const weightedIncomePerPerson = sectionsWithIncome.reduce((sum, s) => {
      const weight = s.area / totalArea;
      return sum + (s.incomePerPerson! * weight);
    }, 0);
    
    const weightedIncomePerHousehold = sectionsWithIncome.reduce((sum, s) => {
      const weight = s.area / totalArea;
      return sum + ((s.incomePerHousehold || 0) * weight);
    }, 0);
    
    const incomeScore = (weightedIncomePerPerson - minIncome) / (maxIncome - minIncome);
    
    results.push({
      ...hood,
      income_per_person: Math.round(weightedIncomePerPerson),
      income_per_household: Math.round(weightedIncomePerHousehold),
      income_score: Math.round(incomeScore * 1000) / 1000,
      census_sections_count: sections.length,
    });
  }
  
  const withIncome = results.filter(r => r.income_per_person !== undefined);
  console.log(`   ${withIncome.length}/${results.length} neighborhoods have income data`);
  
  if (withIncome.length > 0) {
    const avgIncome = withIncome.reduce((sum, r) => sum + r.income_per_person!, 0) / withIncome.length;
    console.log(`   Average neighborhood income: €${avgIncome.toFixed(0)}/person`);
  }
  
  return results;
}

async function updateNeighborhoods(neighborhoods: Neighborhood[]): Promise<void> {
  console.log(`\n📝 Updating neighborhoods in DynamoDB...`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const hood of neighborhoods) {
    if (hood.income_per_person === undefined) {
      skipped++;
      continue;
    }
    
    try {
      await dynamodb.update({
        TableName: DYNAMODB_TABLE,
        Key: { city: hood.city, neighborhood_id: hood.neighborhood_id },
        UpdateExpression: 'SET income_per_person = :ipp, income_per_household = :iph, income_score = :is, census_sections_count = :csc',
        ExpressionAttributeValues: {
          ':ipp': hood.income_per_person,
          ':iph': hood.income_per_household,
          ':is': hood.income_score,
          ':csc': hood.census_sections_count,
        },
      });
      updated++;
    } catch (error) {
      console.error(`   ❌ Failed to update ${hood.name}:`, error);
    }
  }
  
  console.log(`   ✅ Updated ${updated} neighborhoods`);
  console.log(`   ⏭️  Skipped ${skipped} neighborhoods (no income data)`);
}

async function main() {
  const args = process.argv.slice(2);
  const cityIndex = args.indexOf('--city');
  const city = cityIndex !== -1 ? args[cityIndex + 1] : 'barcelona';
  const dryRun = args.includes('--dry-run');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Census Section → Neighborhood Income Aggregation`);
  console.log(`City: ${city}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const cityConfig = CITY_PROVINCE_MAP[city.toLowerCase()];
  if (!cityConfig) {
    console.error(`❌ Unknown city: ${city}`);
    console.log(`Available cities: ${Object.keys(CITY_PROVINCE_MAP).join(', ')}`);
    process.exit(1);
  }
  
  try {
    const incomeMap = loadIncomeData();
    const censusSections = loadCensusSections(cityConfig.regionCode, incomeMap);
    const neighborhoods = await loadNeighborhoods(city);
    
    if (neighborhoods.length === 0) {
      console.error(`❌ No neighborhoods found for ${city} in DynamoDB`);
      console.log(`   Run importNeighborhoods.ts first`);
      process.exit(1);
    }
    
    const neighborhoodSections = spatialJoin(neighborhoods, censusSections, cityConfig.municipalityCode);
    const enrichedNeighborhoods = calculateAggregatedIncome(neighborhoods, neighborhoodSections, censusSections);
    
    console.log(`\n📊 Results Summary:`);
    console.log(`${'─'.repeat(60)}`);
    
    const sorted = [...enrichedNeighborhoods]
      .filter(n => n.income_score !== undefined)
      .sort((a, b) => (b.income_score || 0) - (a.income_score || 0));
    
    console.log(`\nTop 10 highest income neighborhoods:`);
    for (const hood of sorted.slice(0, 10)) {
      console.log(`  ${hood.name.padEnd(30)} €${hood.income_per_person?.toLocaleString().padStart(7)} (score: ${hood.income_score?.toFixed(3)})`);
    }
    
    console.log(`\nTop 10 lowest income neighborhoods:`);
    for (const hood of sorted.slice(-10).reverse()) {
      console.log(`  ${hood.name.padEnd(30)} €${hood.income_per_person?.toLocaleString().padStart(7)} (score: ${hood.income_score?.toFixed(3)})`);
    }
    
    if (!dryRun) {
      await updateNeighborhoods(enrichedNeighborhoods);
    } else {
      console.log(`\n⚠️  Dry run - no changes made to DynamoDB`);
    }
    
    console.log(`\n✅ Done!`);
    
  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

main();
