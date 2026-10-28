// Estimate based on the user's provided list and "all of these" request
// Usage: npx tsx src/scripts/harvest_agencies/estimate-google.ts

const MUNI_COUNTS = {
  'Andalusia': 785,
  'Aragon': 731,
  'Asturias': 78,
  'Balearic Islands': 67,
  'Basque Country': 252,
  'Canary Islands': 88,
  'Cantabria': 102,
  'Castile and León': 2248,
  'Castile–La Mancha': 919,
  'Catalonia': 947,
  'Extremadura': 388,
  'Galicia': 313,
  'Madrid': 179,
  'Murcia': 45,
  'Navarre': 272,
  'La Rioja': 174,
  'Valencian Community': 542,
  'Ceuta': 1,
  'Melilla': 1
};

const NUM_PROVINCES = 50;
const NUM_COMMUNITIES = 19;

function estimate() {
  const totalMunicipalities = Object.values(MUNI_COUNTS).reduce((a, b) => a + b, 0);
  const totalLocations = totalMunicipalities + NUM_PROVINCES + NUM_COMMUNITIES + 1; // +1 for Spain

  console.log(`\n🇪🇸 Spain Real Estate Harvest Estimation (Google CSE)\n`);
  console.log(`Total Municipalities: ${totalMunicipalities.toLocaleString()}`);
  console.log(`Total Locations to Search: ${totalLocations.toLocaleString()}`);
  
  // Queries per location
  const QUERIES_PER_LOC = 4; // "inmobiliaria X", "real estate X", "urbanizacion X", etc.
  
  // Results Strategy
  // If we only request the FIRST PAGE (top 10 results)
  const RESULTS_PER_PAGE = 10;
  const TARGET_RESULTS = 10; // Changed from 100 to 10
  const REQUESTS_PER_QUERY = 1; // Just 1 request per query

  const totalQueries = totalLocations * QUERIES_PER_LOC;
  const totalRequests = totalQueries * REQUESTS_PER_QUERY;
  
  // Rate limits
  const RATE_LIMIT_PER_MIN = 100;
  const minutesNeeded = totalRequests / RATE_LIMIT_PER_MIN;
  const hoursNeeded = minutesNeeded / 60;

  console.log(`\nScenario: "Top 10 Results Only" (First Page)`);
  console.log(`- Queries per Location: ${QUERIES_PER_LOC}`);
  console.log(`- Requests per Query: 1`);
  
  console.log(`\n----------------------------------------`);
  console.log(`TOTAL REQUESTS:  ${totalRequests.toLocaleString()}`);
  console.log(`----------------------------------------`);
  
  console.log(`\nTime Estimate (@ ${RATE_LIMIT_PER_MIN} req/min):`);
  console.log(`- ${Math.round(hoursNeeded)} hours`);
  
  const costUsd = (totalRequests / 1000) * 5;
  console.log(`\nEstimated Cost (at $5/1k queries): $${costUsd.toLocaleString()}`);

  console.log(`\n--- COMPARISON ---`);
  console.log(`Top 100 results (10 pages) = $${(costUsd * 10).toLocaleString()}`);
  console.log(`Top 10 results (1 page)    = $${costUsd.toLocaleString()}`);
}

estimate();
