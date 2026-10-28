import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { generateLocations } from './gemini-helper';
import { searchGoogleCustom, GoogleCustomSearchResult } from '@/lib/google-custom-search';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// --- Configuration ---
const GOOGLE_API_KEY = ''; 
const GOOGLE_CSE_ID = 'd26ceecff09fc48b1';

// Rate Limiting: 100 requests per minute
const DELAY_MS = 600; 

// --- Exclusion Lists ---

// 1. DOMAINS TO EXCLUDE FROM QUERY ("-site:idealista.com -site:fotocasa.es ...")
// Note: Google queries have a length limit (around 32 terms or char limit). 
// We must prioritize the biggest SEO hogs here.
const QUERY_EXCLUSIONS = [
  'idealista.com', 
  'fotocasa.es', 
  'habitaclia.com', 
  'pisos.com', 
  'yaencontre.com',
  'milanuncios.com',
  'indomio.es',
  'paginasamarillas.es',
  'engelvoelkers.com',
  'tecnocasa.es',
  'redpiso.es',
  'remax.es',
  'century21.es'
];

// 2. DOMAINS TO FILTER POST-SEARCH (The Long Tail)
// These are filtered out in code if they slip through or for smaller sites.
const BLACKLIST_POST_FILTER = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'youtube.com', 'google.com',
  'enalquiler.com', 'tucasa.com', 'expocasa.com', 'ventadepisos.com', 'tupiso.com',
  'savills.es', 'savills.com', 'donpiso.com', 'solvia.es', 'gilmar.es',
  'lucasfox.com', 'lucasfox.es', 'haya.es', 'tinsa.es'
];

// Helper to build exclusion string
const getExclusionString = () => {
  return QUERY_EXCLUSIONS.map(site => `-site:${site}`).join(' ');
};


// --- Location Data Interfaces ---
interface Municipality {
  name: string;
  population?: number;
}

interface Province {
  name: string;
  municipalities: Municipality[];
}

interface Community {
  name: string;
  provinces: Province[];
}

// --- Gemini Schemas ---
const MUNICIPALITY_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      population: { type: 'integer' }
    },
    required: ['name']
  }
};

const PROVINCE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  }
};

const COMMUNITY_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  }
};


// --- Main ---

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function main() {
  // Safety / Limit check
  const MAX_COMMUNITIES = process.env.LIMIT_COMMUNITIES ? parseInt(process.env.LIMIT_COMMUNITIES) : 100; 
  const MAX_PROVINCES = process.env.LIMIT_PROVINCES ? parseInt(process.env.LIMIT_PROVINCES) : 100;
  const MAX_MUNICIPALITIES = process.env.LIMIT_MUNICIPALITIES ? parseInt(process.env.LIMIT_MUNICIPALITIES) : 10000;

  console.log('🚀 Starting Real Estate Agency Harvester (Google CSE + Exclusions)...');
  console.log(`Configuration:`);
  console.log(`- Communities Limit: ${MAX_COMMUNITIES}`);
  console.log(`- Provinces Limit: ${MAX_PROVINCES}`);
  console.log(`- Municipalities Limit: ${MAX_MUNICIPALITIES}`);
  console.log(`- Using Credit Account: ${GOOGLE_CSE_ID}`);
  
  const exclusionStr = getExclusionString();
  console.log(`- Query Exclusions: ${QUERY_EXCLUSIONS.length} domains`);
  console.log(`  Sample: ${exclusionStr.substring(0, 50)}...`);

  // 1. Generate Location Hierarchy
  console.log('\n🗺️  Generating Location Hierarchy...');
  
  let communities: Community[] = [];

  // Step A: Get Communities
  console.log('   Fetching Autonomous Communities...');
  try {
    const commData = await generateLocations(
      'List all Autonomous Communities in Spain. Return just the names.',
      COMMUNITY_SCHEMA
    );
    communities = commData.slice(0, MAX_COMMUNITIES).map((c: any) => ({ name: c.name, provinces: [] }));
    console.log(`   Found ${communities.length} communities.`);
  } catch (e) {
    console.error('   Failed to get communities:', e);
    return;
  }

  // Step B: Get Provinces
  for (const community of communities) {
    console.log(`   Fetching Provinces for ${community.name}...`);
    try {
        const provData = await generateLocations(
            `List all Provinces in the autonomous community of ${community.name}, Spain. Return just the names.`,
            PROVINCE_SCHEMA
        );
        community.provinces = provData.slice(0, MAX_PROVINCES).map((p: any) => ({ name: p.name, municipalities: [] }));
        console.log(`      Found ${community.provinces.length} provinces.`);
    } catch (e) {
        console.error(`      Failed to get provinces for ${community.name}`, e);
    }
  }

  // Step C: Get Municipalities
  for (const community of communities) {
      for (const province of community.provinces) {
          console.log(`   Fetching Municipalities for ${province.name} (${community.name})...`);
          try {
             const muniData = await generateLocations(
                 `List the top ${MAX_MUNICIPALITIES} municipalities (cities, towns, villages) in ${province.name}, Spain. Order by population. Return name and approximate population.`,
                 MUNICIPALITY_SCHEMA
             );
             province.municipalities = muniData.map((m: any) => ({ name: m.name, population: m.population }));
             console.log(`      Found ${province.municipalities.length} municipalities.`);
          } catch (e) {
              console.error(`      Failed to get municipalities for ${province.name}`, e);
          }
      }
  }

  // 2. Build Query List
  console.log('\n📝 Building Search Queries...');
  const queries: string[] = [];

  // A. Nationwide
  queries.push('inmobiliarias en España');
  queries.push('agencias inmobiliarias España');

  // B. Per Community
  for (const c of communities) {
      queries.push(`inmobiliarias en ${c.name}`);
      queries.push(`agencias inmobiliarias ${c.name}`);
  }

  // C. Per Province
  for (const c of communities) {
      for (const p of c.provinces) {
          queries.push(`inmobiliarias en ${p.name}`);
          queries.push(`agencias inmobiliarias ${p.name}`);
      }
  }

  // D. Per Municipality
  for (const c of communities) {
      for (const p of c.provinces) {
          for (const m of p.municipalities) {
              queries.push(`inmobiliarias en ${m.name} ${p.name}`); 
              queries.push(`agencias inmobiliarias ${m.name}`);
          }
      }
  }

  const uniqueQueries = [...new Set(queries)];
  console.log(`Generated ${uniqueQueries.length} unique search queries.`);


  // 3. Execute Search
  console.log('\n🕵️  Executing Search...');
  
  const domainsFile = path.join(process.cwd(), 'domains_cse.csv');
  if (!fs.existsSync(domainsFile)) {
      fs.writeFileSync(domainsFile, 'Domain,URL,Title,Snippet,SourceQuery\n');
  }

  let allDomains = new Set<string>();
  
  if (fs.existsSync(domainsFile)) {
    const content = fs.readFileSync(domainsFile, 'utf-8');
    content.split('\n').forEach(line => {
        const parts = line.split(',');
        if (parts[0] && parts[0] !== 'Domain') allDomains.add(parts[0]);
    });
  }

  console.log(`Resuming with ${allDomains.size} existing unique domains...`);

  for (let i = 0; i < uniqueQueries.length; i++) {
    const baseQuery = uniqueQueries[i];
    // Append the exclusion string to the query
    const fullQuery = `${baseQuery} ${exclusionStr}`;
    
    console.log(`[${i + 1}/${uniqueQueries.length}] Searching: "${baseQuery}"`);

    try {
         const start = 1; // Top 10
         const response = await searchGoogleCustom(fullQuery, GOOGLE_CSE_ID, { apiKey: GOOGLE_API_KEY }, start);
         
         if (response.items) {
            response.items.forEach(result => {
                try {
                    const url = new URL(result.link);
                    const domain = url.hostname.replace(/^www\./, '');
                    
                    // Post-Filter Check (for things not in the query exclusion)
                    const isBlacklisted = BLACKLIST_POST_FILTER.some(b => domain.includes(b)) || 
                                          QUERY_EXCLUSIONS.some(b => domain.includes(b)); // Double check
                    
                    if (!isBlacklisted) {
                         if (!allDomains.has(domain)) {
                            allDomains.add(domain);
                            const cleanTitle = result.title.replace(/"/g, '""');
                            const cleanSnippet = result.snippet.replace(/"/g, '""');
                            fs.appendFileSync(domainsFile, `"${domain}","${result.link}","${cleanTitle}","${cleanSnippet}","${baseQuery}"\n`);
                            process.stdout.write('+');
                        } else {
                            process.stdout.write('.');
                        }
                    } else {
                        process.stdout.write('x'); // Skipped
                    }

                } catch (e) {
                    // Ignore invalid URLs
                }
            });
         } else {
             process.stdout.write('-'); 
         }
         
         process.stdout.write(' ');
         await sleep(DELAY_MS); 
         
      console.log('');
    } catch (err: any) {
      console.error(`\n❌ Failed to search for "${baseQuery}":`, err.message);
      await sleep(2000);
    }
  }

  console.log(`\n✅ Harvest complete. Found ${allDomains.size} unique domains.`);
}
