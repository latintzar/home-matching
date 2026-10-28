# INE Income Data Integration (ADRH - Atlas de Distribución de Renta de los Hogares)

## Overview

This document describes how to integrate Spain's official household income data at the **census section level** into our location scoring heatmap system. This data provides the most granular income distribution data available for Spain.

## Data Sources

### 1. Income Data (INE ADRH)

**Source**: Instituto Nacional de Estadística - Atlas de Distribución de Renta de los Hogares  
**Year**: 2023 (updated annually)  
**Coverage**: All of Spain  
**Granularity**: Census sections (secciones censales) - ~36,000+ sections

**API Endpoint** (JSON):
```
https://www.ine.es/jaxiT3/files/t/csv_bdsc/30896.csv   # Barcelona (province 08)
https://www.ine.es/jaxiT3/files/t/csv_bdsc/31097.csv   # Madrid (province 28)
```

**Full Province Code → Table ID Mapping**:
| Province | Code | Table ID |
|----------|------|----------|
| Barcelona | 08 | 30896 |
| Madrid | 28 | 31097 |
| Valencia | 46 | 31250 |
| Sevilla | 41 | 31205 |
| Málaga | 29 | 31106 |
| Bilbao (Bizkaia) | 48 | 30917 |
| ... | ... | ... |

**Sample Data Structure** (CSV):
```csv
Municipios;Distritos;Secciones;Indicadores de renta media y mediana;Periodo;Total
08019 Barcelona;0801901 Barcelona distrito 01;0801901001 Barcelona sección 01001;Renta neta media por persona;2023;13.122
08019 Barcelona;0801901 Barcelona distrito 01;0801901001 Barcelona sección 01001;Renta neta media por hogar;2023;32.710
```

**Key Indicators Available**:
- `Renta neta media por persona` - Net income per person (€)
- `Renta neta media por hogar` - Net income per household (€)
- `Media de la renta por unidad de consumo` - Mean income per consumption unit (€)
- `Mediana de la renta por unidad de consumo` - Median income per consumption unit (€)
- `Renta bruta media por persona` - Gross income per person (€)
- `Renta bruta media por hogar` - Gross income per household (€)

### 2. Census Section Boundaries (GeoJSON)

**Official Source**: Centro Nacional de Información Geográfica (CNIG)  
**Alternative**: ESRI España Open Data

**CNIG Download** (requires registration):
```
https://centrodedescargas.cnig.es/CentroDescargas/
→ "Información Geográfica de Referencia" 
→ "Límites administrativos"
→ "Secciones censales"
```

**ESRI Open Data** (direct API):
```
https://opendata.esri.es/datasets/limites-secciones-censales
```

**Section Code Format**: `PPMMMDDSSS`
- `PP` = Province code (01-52)
- `MMM` = Municipality code (001-999)
- `DD` = District code (01-99)
- `SSS` = Section code (001-999)

Example: `0801901001` = Barcelona (08), Barcelona city (019), District 01 (01), Section 001

## Database Schema

### DynamoDB Table: `leo-census-income`

**Primary Key**: `section_code` (String) - e.g., "0801901001"

**Attributes**:
```json
{
  "section_code": "0801901001",
  "municipality_code": "08019",
  "district_code": "0801901",
  "municipality_name": "Barcelona",
  "year": 2023,
  "income_data": {
    "net_income_per_person": 13122,
    "net_income_per_household": 32710,
    "mean_income_consumption_unit": 19668,
    "median_income_consumption_unit": 16450,
    "gross_income_per_person": 17200,
    "gross_income_per_household": 42900
  },
  "normalized_score": 0.45,
  "percentile_national": 35,
  "percentile_city": 28,
  "geometry_centroid": {
    "lat": 41.3751,
    "lng": 2.1690
  }
}
```

**GSI: `municipality-income-index`**
- Partition Key: `municipality_code`
- Sort Key: `normalized_score`
- Purpose: Query all sections in a city sorted by income

### DynamoDB Table: `leo-census-boundaries`

**Primary Key**: `section_code` (String)

**Attributes**:
```json
{
  "section_code": "0801901001",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[2.168, 41.374], [2.170, 41.375], ...]]
  },
  "area_km2": 0.15,
  "centroid": {
    "lat": 41.3751,
    "lng": 2.1690
  },
  "bbox": [2.168, 41.373, 2.172, 41.377]
}
```

## Import Pipeline

### Step 1: Download Income Data

```typescript
// src/scripts/ine/downloadIncomeData.ts
import fs from 'fs';
import path from 'path';

const PROVINCE_TABLE_IDS: Record<string, string> = {
  '08': '30896', // Barcelona
  '28': '31097', // Madrid
  '46': '31250', // Valencia
  // ... all 52 provinces
};

async function downloadProvinceData(provinceCode: string): Promise<void> {
  const tableId = PROVINCE_TABLE_IDS[provinceCode];
  const url = `https://www.ine.es/jaxiT3/files/t/csv_bdsc/${tableId}.csv`;
  
  const response = await fetch(url);
  const csv = await response.text();
  
  const outputPath = path.join(__dirname, `../../../data/ine/income_${provinceCode}.csv`);
  fs.writeFileSync(outputPath, csv);
  
  console.log(`✅ Downloaded province ${provinceCode}: ${csv.split('\n').length} rows`);
}

async function downloadAllProvinces(): Promise<void> {
  for (const provinceCode of Object.keys(PROVINCE_TABLE_IDS)) {
    await downloadProvinceData(provinceCode);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }
}
```

### Step 2: Parse and Transform

```typescript
// src/scripts/ine/parseIncomeData.ts
interface RawIncomeRow {
  municipality: string;    // "08019 Barcelona"
  district: string;        // "0801901 Barcelona distrito 01"
  section: string;         // "0801901001 Barcelona sección 01001"
  indicator: string;       // "Renta neta media por persona"
  period: string;          // "2023"
  value: string;           // "13.122"
}

interface SectionIncome {
  sectionCode: string;
  municipalityCode: string;
  districtCode: string;
  municipalityName: string;
  year: number;
  incomeData: {
    netIncomePerPerson: number | null;
    netIncomePerHousehold: number | null;
    meanIncomeConsumptionUnit: number | null;
    medianIncomeConsumptionUnit: number | null;
    grossIncomePerPerson: number | null;
    grossIncomePerHousehold: number | null;
  };
}

function parseSectionCode(sectionStr: string): string {
  // "0801901001 Barcelona sección 01001" → "0801901001"
  const match = sectionStr.match(/^(\d{10})/);
  return match ? match[1] : '';
}

function parseCsvToSections(csv: string): SectionIncome[] {
  const lines = csv.split('\n').slice(1); // Skip header
  const sectionMap = new Map<string, SectionIncome>();
  
  for (const line of lines) {
    const [municipality, district, section, indicator, period, value] = line.split(';');
    
    if (!section || period !== '2023') continue;
    
    const sectionCode = parseSectionCode(section);
    if (!sectionCode) continue;
    
    if (!sectionMap.has(sectionCode)) {
      sectionMap.set(sectionCode, {
        sectionCode,
        municipalityCode: municipality.split(' ')[0],
        districtCode: district?.split(' ')[0] || '',
        municipalityName: municipality.split(' ').slice(1).join(' '),
        year: 2023,
        incomeData: {
          netIncomePerPerson: null,
          netIncomePerHousehold: null,
          meanIncomeConsumptionUnit: null,
          medianIncomeConsumptionUnit: null,
          grossIncomePerPerson: null,
          grossIncomePerHousehold: null,
        }
      });
    }
    
    const section = sectionMap.get(sectionCode)!;
    const numValue = parseFloat(value.replace('.', '').replace(',', '.'));
    
    switch (indicator) {
      case 'Renta neta media por persona':
        section.incomeData.netIncomePerPerson = numValue;
        break;
      case 'Renta neta media por hogar':
        section.incomeData.netIncomePerHousehold = numValue;
        break;
      case 'Media de la renta por unidad de consumo':
        section.incomeData.meanIncomeConsumptionUnit = numValue;
        break;
      case 'Mediana de la renta por unidad de consumo':
        section.incomeData.medianIncomeConsumptionUnit = numValue;
        break;
      // ... etc
    }
  }
  
  return Array.from(sectionMap.values());
}
```

### Step 3: Normalize and Calculate Scores

```typescript
// src/scripts/ine/normalizeIncomeScores.ts
function calculateNormalizedScores(sections: SectionIncome[]): SectionIncome[] {
  // Get all median incomes (most stable indicator)
  const incomes = sections
    .map(s => s.incomeData.medianIncomeConsumptionUnit)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  
  const min = incomes[0];
  const max = incomes[incomes.length - 1];
  const range = max - min;
  
  return sections.map(section => {
    const income = section.incomeData.medianIncomeConsumptionUnit;
    if (income === null) return section;
    
    // 0-1 normalized score (0 = lowest income, 1 = highest)
    const normalizedScore = (income - min) / range;
    
    // Calculate percentile
    const percentileNational = incomes.indexOf(income) / incomes.length * 100;
    
    return {
      ...section,
      normalizedScore: Math.round(normalizedScore * 100) / 100,
      percentileNational: Math.round(percentileNational),
    };
  });
}
```

### Step 4: Import to DynamoDB

```typescript
// src/scripts/ine/importToDynamoDB.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function importSections(sections: SectionIncome[]): Promise<void> {
  const TABLE_NAME = 'leo-census-income';
  const BATCH_SIZE = 25;
  
  for (let i = 0; i < sections.length; i += BATCH_SIZE) {
    const batch = sections.slice(i, i + BATCH_SIZE);
    
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: batch.map(section => ({
          PutRequest: {
            Item: {
              section_code: section.sectionCode,
              municipality_code: section.municipalityCode,
              district_code: section.districtCode,
              municipality_name: section.municipalityName,
              year: section.year,
              income_data: section.incomeData,
              normalized_score: section.normalizedScore,
              percentile_national: section.percentileNational,
            }
          }
        }))
      }
    }));
    
    console.log(`Imported ${i + batch.length} / ${sections.length} sections`);
  }
}
```

## Heatmap Integration

### Query Income for a Search Area

```typescript
// src/lib/location/incomeHeatmap.ts
import * as turf from '@turf/turf';

interface IncomeHeatmapPoint {
  lat: number;
  lng: number;
  score: number;  // 0-1 normalized income
  income: number; // Raw median income €
}

async function getIncomeHeatmapForArea(
  searchPolygon: turf.Feature<turf.Polygon>,
  municipalityCode: string
): Promise<IncomeHeatmapPoint[]> {
  // Query all sections in municipality
  const sections = await docClient.send(new QueryCommand({
    TableName: 'leo-census-income',
    IndexName: 'municipality-income-index',
    KeyConditionExpression: 'municipality_code = :muni',
    ExpressionAttributeValues: {
      ':muni': municipalityCode
    }
  }));
  
  // Load boundaries for these sections
  const boundaries = await getBoundariesForSections(
    sections.Items.map(s => s.section_code)
  );
  
  // Filter to sections that intersect search area
  const intersecting = sections.Items.filter(section => {
    const boundary = boundaries.get(section.section_code);
    if (!boundary) return false;
    return turf.booleanIntersects(searchPolygon, boundary.geometry);
  });
  
  // Return heatmap points
  return intersecting.map(section => ({
    lat: section.geometry_centroid.lat,
    lng: section.geometry_centroid.lng,
    score: section.normalized_score,
    income: section.income_data.median_income_consumption_unit
  }));
}
```

### Combine with Location Score

```typescript
// In calculateLocationScore.ts
function calculateLocationScore(
  listingCoords: [number, number],
  userPreferences: UserLocationPreferences,
  cityData: CityIntelligence
): LocationScore {
  // ... existing commute and POI scoring ...
  
  // Get census section income score
  const censusSectionCode = await getCensusSectionForPoint(listingCoords);
  const incomeData = await getIncomeBySectionCode(censusSectionCode);
  
  // Apply income preference if user cares about neighborhood affluence
  let incomeMultiplier = 1.0;
  if (userPreferences.prefersAffluentArea) {
    // Higher income = higher multiplier
    incomeMultiplier = 0.7 + (incomeData.normalized_score * 0.6); // 0.7-1.3x
  } else if (userPreferences.prefersBudgetFriendlyArea) {
    // Lower income = higher multiplier (inversed)
    incomeMultiplier = 0.7 + ((1 - incomeData.normalized_score) * 0.6);
  }
  
  return {
    ...baseScore,
    incomeScore: incomeData.normalized_score,
    incomePercentile: incomeData.percentile_national,
    adjustedScore: baseScore.total * incomeMultiplier
  };
}
```

## Cost Estimate

### Data Storage
- ~36,000 census sections × ~1KB per item = **~36 MB** in DynamoDB
- GeoJSON boundaries: ~500 MB (can compress)
- **Monthly cost**: ~$5-10 for DynamoDB storage + reads

### Update Frequency
- INE updates annually (November)
- Set up yearly cron job to refresh data

## Files Created

```
src/scripts/ine/
├── downloadIncomeData.ts     # Download CSVs from INE
├── parseIncomeData.ts        # Parse CSV to objects
├── normalizeIncomeScores.ts  # Calculate percentiles
├── importToDynamoDB.ts       # Batch import
└── downloadBoundaries.ts     # Get GeoJSON from CNIG

data/ine/
├── income_08.csv             # Barcelona raw data
├── income_28.csv             # Madrid raw data
├── ...
└── boundaries/
    └── secciones_censales.geojson
```

## Usage in Leo

Leo can use this data to:

1. **Show income distribution** on the real-time map during calls
2. **Color census sections** by income level in the heatmap
3. **Factor affluence** into location scoring if user indicates preference
4. **Explain neighborhood character**: "This section has median income of €24,000 - above Barcelona's average"

## Data Limitations

1. **Census section boundaries change** - new sections created, old ones merged
2. **Data lag** - 2023 data available, but reflects 2022 tax returns
3. **No street-level granularity** - entire section gets same income value
4. **Missing values** - some rural sections have suppressed data

## Next Steps

1. [ ] Create DynamoDB table `leo-census-income`
2. [ ] Download boundary GeoJSON from CNIG
3. [ ] Run import script for all 52 provinces
4. [ ] Add income layer to test-map page
5. [ ] Wire income score into `calculateLocationScore()`
6. [ ] Add income context to Leo's explanations

---

**Last Updated**: 2025-12-06
**Data Year**: 2023
**Source**: INE Atlas de Distribución de Renta de los Hogares (ADRH)

