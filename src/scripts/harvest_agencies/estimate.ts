// Estimate cost for full Spanish harvest
// Based on official municipality counts provided by user

const COUNTS = {
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

const PROVINCES = 50;
const COMMUNITIES = 19;

function estimate() {
  const totalMunicipalities = Object.values(COUNTS).reduce((a, b) => a + b, 0);
  const totalLocations = totalMunicipalities + PROVINCES + COMMUNITIES;

  console.log(`\n🇪🇸 Spain Real Estate Harvest Estimation\n`);
  console.log(`Total Municipalities: ${totalMunicipalities.toLocaleString()}`);
  console.log(`Total Provinces: ${PROVINCES}`);
  console.log(`Total Communities: ${COMMUNITIES}`);
  console.log(`----------------------------------------`);
  console.log(`Total Locations to Search: ${totalLocations.toLocaleString()}`);
  
  // Scenarios
  const scenarios = [
    { name: 'Basic', queriesPerLoc: 2, pages: 1 },    // Just top 10 results
    { name: 'Standard', queriesPerLoc: 2, pages: 5 }, // Top 50 results
    { name: 'Deep', queriesPerLoc: 2, pages: 10 },    // Top 100 results (Requested)
    { name: 'Ultra', queriesPerLoc: 3, pages: 10 },   // Include "Urbanización"
  ];

  console.log(`\nCost Scenarios (ScrapingDog @ 5 credits/request):\n`);

  scenarios.forEach(s => {
    const requests = totalLocations * s.queriesPerLoc * s.pages;
    const credits = requests * 5;
    console.log(`[${s.name}]`);
    console.log(`  Queries per Location: ${s.queriesPerLoc} ("inmobiliaria", "real estate"...)`);
    console.log(`  Pages per Query: ${s.pages}`);
    console.log(`  Total Requests: ${requests.toLocaleString()}`);
    console.log(`  Total Credits: ${credits.toLocaleString()}`);
    console.log(`----------------------------------------`);
  });
}

estimate();

