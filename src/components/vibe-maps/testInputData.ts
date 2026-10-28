/**
 * Building Block Test Data
 * 
 * Extracted from docs/agentic-maps/BUILDING_BLOCKS.md
 * All 33 tests organized by implementation order
 */

export type TestStatus = 'done' | 'implementing' | 'not-started';

export interface BuildingBlockTest {
  id: string;
  name: string;
  input: string;
  inputType: 'text' | 'json';
  cost: string;
  api: string;
  description: string;
  status: TestStatus;
  order: number;  // Implementation order (lower = sooner)
}

export interface Scenario {
  id: number;
  name: string;
  tests: BuildingBlockTest[];
}

// Tests in implementation order
export const implementationOrder: BuildingBlockTest[] = [
  // Phase 0 - Quick Wins (DONE)
      {
        id: '1.1',
        name: 'Generate vibe areas',
        input: 'cool bars in Barcelona',
        inputType: 'text',
        cost: '~$0.005',
        api: 'Gemini 2.5 Pro',
    description: 'AI identifies real neighborhoods with accurate lat/lng',
    status: 'done',
    order: 1
  },
  {
    id: 'S.1',
    name: 'Render circles',
    input: `[
  { "name": "El Born", "lat": 41.3851, "lng": 2.1816, "color": "#f97316", "why": "Best nightlife" },
  { "name": "Gràcia", "lat": 41.4036, "lng": 2.1567, "color": "#f97316", "why": "Local vibe" },
  { "name": "Raval", "lat": 41.3797, "lng": 2.1682, "color": "#f97316", "why": "Edgy art scene" }
]`,
    inputType: 'json',
    cost: 'Included',
    api: 'Mapbox GL',
    description: 'Core map visualization works',
    status: 'done',
    order: 2
  },
  {
    id: 'S.2',
    name: 'Render info card',
    input: `{
  "name": "El Born",
  "why": "The heart of Barcelona's nightlife - narrow medieval streets packed with wine bars and cocktail lounges",
  "itinerary": [
    { "emoji": "🍸", "activity": "Cocktail bars", "searchQuery": "cocktail bars El Born" },
    { "emoji": "🍷", "activity": "Wine caves", "searchQuery": "wine caves El Born" }
  ],
  "currentIndex": 1,
  "totalCount": 5
}`,
    inputType: 'json',
    cost: 'FREE',
    api: 'UI component',
    description: 'UI displays area details correctly',
    status: 'done',
    order: 3
  },

  // Phase 0 continued - DONE
      {
        id: '2.1',
        name: 'Stay areas + booking',
        input: 'romantic trip to Tokyo',
        inputType: 'text',
        cost: '~$0.005',
        api: 'Gemini 2.5 Pro',
    description: 'AI distinguishes stay neighborhoods with booking URLs',
    status: 'done',
    order: 4
  },
      {
        id: '3.1',
        name: 'Dual-layer areas',
        input: 'romantic weekend in Paris',
        inputType: 'text',
        cost: '~$0.005',
        api: 'Gemini 2.5 Pro',
    description: 'Single AI call produces 2 stay + 3 activity areas',
    status: 'done',
    order: 5
  },
  {
    id: '3.2',
    name: 'Visual travel lines',
    input: `{
  "city": "Paris",
  "stayAreas": [
    { "name": "Le Marais", "lat": 48.8566, "lng": 2.3622 },
    { "name": "Saint-Germain", "lat": 48.8530, "lng": 2.3350 }
  ],
  "activityAreas": [
    { "name": "Montmartre", "lat": 48.8867, "lng": 2.3431 },
    { "name": "Latin Quarter", "lat": 48.8490, "lng": 2.3470 },
    { "name": "Bastille", "lat": 48.8533, "lng": 2.3692 }
  ],
  "travelLinePairs": ["stay-to-activity", "activity-to-activity"]
}`,
    inputType: 'json',
    cost: 'FREE',
    api: 'Turf.js',
    description: 'Takes 3.1 output, displays areas + configurable travel lines',
    status: 'done',
    order: 6
  },
  {
    id: '7.1',
    name: 'City character',
    input: 'Dublin',
    inputType: 'text',
    cost: '~$0.005',
    api: 'Gemini 2.5 Pro',
    description: 'AI understands city geography and area characters',
    status: 'done',
    order: 7
  },

  // Phase 1 - FREE (Turf.js + URL generation)
  {
    id: 'S.4',
    name: 'Generate search URLs',
    input: 'speakeasy bars | El Born Barcelona',
    inputType: 'text',
    cost: 'FREE',
    api: 'URL construction',
    description: 'URL patterns are correct',
    status: 'done',
    order: 7
  },
  {
    id: 'S.5',
    name: 'Generate booking URLs',
    input: 'Shibuya | Tokyo | 2024-03-15 | 2024-03-18',
    inputType: 'text',
    cost: 'FREE',
    api: 'URL construction',
    description: 'Accommodation search URLs with guests & budget filters',
    status: 'done',
    order: 8
  },
  
  // Phase 2 - Geo operations (Turf.js FREE)
  {
    id: '5.3',
    name: 'Compute intersection',
    input: `{
  "polygon_a": {
    "type": "Polygon",
    "description": "Sarah's 15-min walk from Angel",
    "center": { "name": "Angel", "lat": 51.5320, "lng": -0.1058 },
    "color": "#3B82F6",
    "coordinates": [[
      [-0.1258, 51.5220], [-0.1158, 51.5170], [-0.0958, 51.5170], [-0.0858, 51.5220],
      [-0.0858, 51.5420], [-0.0958, 51.5470], [-0.1158, 51.5470], [-0.1258, 51.5420],
      [-0.1258, 51.5220]
    ]]
  },
  "polygon_b": {
    "type": "Polygon",
    "description": "Tom's 15-min walk from Old Street",
    "center": { "name": "Old Street", "lat": 51.5255, "lng": -0.0875 },
    "color": "#EF4444",
    "coordinates": [[
      [-0.1075, 51.5155], [-0.0975, 51.5105], [-0.0775, 51.5105], [-0.0675, 51.5155],
      [-0.0675, 51.5355], [-0.0775, 51.5405], [-0.0975, 51.5405], [-0.1075, 51.5355],
      [-0.1075, 51.5155]
    ]]
  }
}`,
    inputType: 'json',
    cost: 'FREE',
    api: 'Turf.js',
    description: 'Polygon intersection - finds fair zones where both can reach',
    status: 'done',
    order: 9
  },
  {
    id: '6.2',
    name: 'Interactive matrix',
    input: `{
  "personA": {
    "name": "Sarah (Brixton)",
    "location": { "lat": 51.4613, "lng": -0.1156 },
    "isochrones": {
      "walk": { 
        "color": "#3b82f6",
        "coordinates": [[[-0.1356,51.4513],[-0.1256,51.4463],[-0.1056,51.4483],[-0.0956,51.4563],[-0.0976,51.4713],[-0.1106,51.4763],[-0.1306,51.4733],[-0.1406,51.4633],[-0.1356,51.4513]]]
      },
      "transit": { 
        "color": "#eab308",
        "coordinates": [[[-0.1756,51.4213],[-0.1356,51.4063],[-0.0556,51.4163],[-0.0256,51.4513],[-0.0356,51.5013],[-0.0756,51.5213],[-0.1456,51.5163],[-0.1856,51.4813],[-0.1956,51.4413],[-0.1756,51.4213]]]
      },
      "drive": { 
        "color": "#ef4444",
        "coordinates": [[[-0.2556,51.3613],[-0.1756,51.3263],[-0.0256,51.3463],[0.0444,51.4213],[0.0344,51.5313],[-0.0256,51.5813],[-0.1556,51.5963],[-0.2556,51.5513],[-0.3056,51.4513],[-0.2556,51.3613]]]
      }
    }
  },
  "personB": {
    "name": "Tom (Stratford)",
    "location": { "lat": 51.5423, "lng": -0.0035 },
    "isochrones": {
      "walk": { 
        "color": "#3b82f6",
        "coordinates": [[[-0.0235,51.5323],[-0.0135,51.5273],[0.0065,51.5293],[0.0165,51.5373],[0.0145,51.5523],[0.0015,51.5573],[-0.0185,51.5543],[-0.0285,51.5443],[-0.0235,51.5323]]]
      },
      "transit": { 
        "color": "#eab308",
        "coordinates": [[[-0.0735,51.5023],[-0.0235,51.4823],[0.0465,51.4923],[0.0865,51.5323],[0.0765,51.5823],[0.0265,51.6123],[-0.0535,51.6023],[-0.0935,51.5623],[-0.0935,51.5223],[-0.0735,51.5023]]]
      },
      "drive": { 
        "color": "#ef4444",
        "coordinates": [[[-0.1535,51.4423],[-0.0535,51.4023],[0.0965,51.4223],[0.1665,51.5023],[0.1565,51.6223],[0.0765,51.6823],[-0.0735,51.6923],[-0.1835,51.6323],[-0.2135,51.5323],[-0.1535,51.4423]]]
      }
    }
  },
  "travelTime": 20,
  "travelUnit": "minutes"
}`,
    inputType: 'json',
    cost: 'FREE',
    api: 'Turf.js',
    description: 'Interactive 3x3 matrix - hover to see intersections',
    status: 'done',
    order: 10
  },

  // Phase 2 - Gemini Flash (~$0.001-0.003)
  {
    id: '1.2',
    name: 'Itinerary (no coords)',
    input: 'El Born, Barcelona - nightlife',
    inputType: 'text',
    cost: '~$0.001',
    api: 'Gemini 2.5 Flash',
    description: 'AI creates suggestions from area name alone',
    status: 'not-started',
    order: 12
  },
  {
    id: '1.3',
    name: 'Itinerary (with coords)',
    input: 'El Born, Barcelona [41.3851, 2.1816] - nightlife',
    inputType: 'text',
    cost: '~$0.001',
    api: 'Gemini 2.5 Flash',
    description: 'Coordinates improve suggestion relevance',
    status: 'not-started',
    order: 13
  },
  {
    id: '2.2',
    name: 'Nearby highlights',
    input: 'Shibuya, Tokyo [35.6580, 139.7016]',
    inputType: 'text',
    cost: '~$0.001',
    api: 'Gemini 2.5 Flash',
    description: 'AI understands "near accommodation" context',
    status: 'not-started',
    order: 14
  },
  {
    id: '4.4',
    name: 'Curate winner',
    input: `{
  "criteria": ["quiet", "authentic"],
  "candidates": [
    { 
      "name": "Fuunji", 
      "rating": 4.5,
      "address": "2-14-3 Yoyogi, Shibuya",
      "lat": 35.6833,
      "lng": 139.7020,
      "priceLevel": "$$",
      "reviews": [
        "Peaceful atmosphere, no loud music.",
        "Traditional Tokyo ramen shop that hasn't changed in 20 years."
      ]
    },
    { 
      "name": "Ichiran Shibuya", 
      "rating": 4.3,
      "address": "1-22-7 Jinnan, Shibuya",
      "lat": 35.6623,
      "lng": 139.6993,
      "priceLevel": "$$",
      "reviews": [
        "Private booths are great but the line was 45 min. Very touristy.",
        "Efficient system but feels like eating in a factory."
      ]
    }
  ]
}`,
    inputType: 'json',
    cost: '~$0.0005',
    api: 'Gemini Flash Lite',
    description: 'AI picks winner using evocative language',
    status: 'not-started',
    order: 15
  },
  {
    id: '5.4',
    name: 'Identify neighborhoods',
    input: `{
  "zone": {
    "type": "Polygon",
    "description": "Intersection zone between Shoreditch and Camden 20-min walks",
    "boundingBox": {
      "sw": { "lat": 51.5240, "lng": -0.1176 },
      "ne": { "lat": 51.5446, "lng": -0.0877 }
    },
    "coordinates": [[
      [-0.1100, 51.5280], [-0.1000, 51.5250], [-0.0920, 51.5280],
      [-0.0880, 51.5350], [-0.0900, 51.5420], [-0.0980, 51.5450],
      [-0.1080, 51.5440], [-0.1150, 51.5380], [-0.1160, 51.5320],
      [-0.1100, 51.5280]
    ]],
    "areaSqKm": 0.45
  },
  "city": "London",
  "context": "Fair meeting zone for two people"
}`,
    inputType: 'json',
    cost: '~$0.001',
    api: 'Gemini 2.5 Flash',
    description: 'AI identifies which neighborhoods fall within bounds',
    status: 'not-started',
    order: 16
      },
      {
        id: '6.3',
        name: 'AI picks intersections',
        input: `{
  "personA": { "name": "Sarah", "location": "Brooklyn", "preference": "transit" },
  "personB": { "name": "Mike", "location": "Midtown", "preference": "walking" },
  "intersections": [
    { "a": "walk", "b": "walk", "areaSqKm": 0, "viable": false },
    { "a": "transit", "b": "walk", "areaSqKm": 2.1, "neighborhoods": ["SoHo"], "viable": true },
    { "a": "transit", "b": "transit", "areaSqKm": 28.5, "neighborhoods": ["SoHo", "NoHo", "West Village"], "viable": true }
  ],
  "question": "Which 3 transport combinations work best?"
}`,
        inputType: 'json',
        cost: '~$0.001',
        api: 'Gemini 2.5 Flash',
    description: 'AI reasons about transport trade-offs',
    status: 'not-started',
    order: 17
      },
      {
        id: '7.2',
        name: 'Chat: preferences',
    input: 'Definitely want to hit some classic pubs, but also see some history',
        inputType: 'text',
        cost: '~$0.003',
        api: 'Gemini 2.5 Flash',
    description: 'AI has natural preference-gathering conversation',
    status: 'not-started',
    order: 18
      },
      {
        id: '7.3',
        name: 'Chat: logistics',
    input: '4 of us - me, my partner, my dad, and a friend. Dad needs a siesta around 3pm, friend uses wheelchair',
        inputType: 'text',
        cost: '~$0.003',
        api: 'Gemini 2.5 Flash',
    description: 'AI handles complex constraint gathering',
    status: 'not-started',
    order: 19
  },
  {
    id: '7.5',
    name: 'Insert stops',
    input: `{
  "routeOptions": [{
    "id": "A",
    "name": "Trinity First",
    "stops": [
      { "order": 1, "name": "Trinity College", "type": "attraction", "lat": 53.3438, "lng": -6.2546, "arrival": "11:00", "duration": "1h 30min" },
      { "order": 2, "name": "Temple Bar lunch", "type": "food", "lat": 53.3454, "lng": -6.2644, "arrival": "12:45", "duration": "1h 45min" },
      { "order": 3, "name": "SIESTA BREAK", "type": "break", "arrival": "15:00", "duration": "2h" }
    ],
    "totals": { "walkingTime": "60 min", "finishTime": "21:35", "status": "under" }
  }],
  "constraints": { "siestaRequired": { "around": "15:00" }, "wheelchairRequired": true }
}`,
    inputType: 'json',
    cost: '~$0.01',
    api: 'Gemini 2.5 Flash',
    description: 'AI adapts routes to real-world constraints',
    status: 'not-started',
    order: 20
  },
  {
    id: '7.6',
    name: 'AI picks best',
    input: `{
  "evaluatedOptions": [
    { "id": "A", "name": "Trinity First", "finishTime": "21:35", "status": "under", "highlights": ["Trinity College ✓"], "allAccessible": true },
    { "id": "B", "name": "Guinness First", "finishTime": "21:50", "status": "under", "concerns": ["Tight buffer"] },
    { "id": "C", "name": "Cultural Focus", "finishTime": "22:35", "status": "over", "concerns": ["35 min over target"] }
  ],
  "constraints": { "mustSee": ["Trinity College"], "wheelchairRequired": true }
}`,
    inputType: 'json',
    cost: '~$0.001',
    api: 'Gemini 2.5 Flash',
    description: 'AI makes final recommendation with explanation',
    status: 'not-started',
    order: 21
  },

  // Phase 3 - Mapbox (~$0.001-0.02)
  {
    id: '5.1',
    name: 'Geocode locations',
    input: 'Shoreditch, London | Camden, London',
    inputType: 'text',
    cost: '~$0.001',
    api: 'Mapbox Geocoding',
    description: 'Fuzzy locations convert to precise coordinates',
    status: 'not-started',
    order: 22
  },
  {
    id: '5.2',
    name: 'Generate isochrone',
    input: '51.5246, -0.0777 | walking | 20 min',
    inputType: 'text',
    cost: '~$0.001',
    api: 'Mapbox Isochrone',
    description: 'Isochrone API works and renders properly',
    status: 'not-started',
    order: 23
  },
  {
    id: '5.5',
    name: 'Multi-polygon zones',
    input: 'Westminster, London | Southwark, London | walking | 15 min',
    inputType: 'text',
    cost: '~$0.002',
    api: 'Mapbox + Turf.js',
    description: 'System handles discontinuous fair zones gracefully',
    status: 'not-started',
    order: 24
      },
      {
        id: '7.4',
        name: 'Route combinations',
        input: `{
  "areas": ["Temple Bar", "Trinity College", "Georgian Quarter", "Guinness Storehouse"],
  "mode": "walking",
  "preferences": { "pace": "relaxed", "mustSee": ["Trinity College"] }
}`,
        inputType: 'json',
        cost: '~$0.02',
        api: 'Mapbox Matrix',
    description: 'Matrix computation works for multi-stop planning',
    status: 'not-started',
    order: 25
      },
      {
        id: '7.7',
        name: 'Two-stop directions',
        input: 'Trinity College, Dublin [53.3438, -6.2546] → Temple Bar, Dublin [53.3454, -6.2644]',
        inputType: 'text',
        cost: '~$0.002',
        api: 'Mapbox Directions',
    description: 'Single-segment navigation handoff works',
    status: 'not-started',
    order: 26
      },
      {
        id: '7.8',
        name: 'Multi-stop directions',
    input: 'Trinity College → Temple Bar → Guinness → Phoenix Park',
        inputType: 'text',
        cost: '~$0.01',
        api: 'Mapbox Directions',
    description: 'Full route navigation handoff works',
    status: 'not-started',
    order: 27
  },

  // Phase 4 - External APIs
  {
    id: '4.1',
    name: 'Search candidates',
    input: 'best quiet ramen Shibuya Tokyo',
    inputType: 'text',
    cost: '$0.001',
    api: 'ScrapingDog',
    description: 'ScrapingDog returns useful results for place discovery',
    status: 'not-started',
    order: 28
  },
  {
    id: '4.2',
    name: 'Place details',
    input: 'Fuunji, Tokyo',
    inputType: 'text',
    cost: '$0.001',
    api: 'ScrapingDog GMaps',
    description: 'ScrapingDog GMaps returns structured place data',
    status: 'not-started',
    order: 29
  },
  {
    id: '4.3',
    name: 'Get reviews',
    input: 'Fuunji Tokyo',
    inputType: 'text',
    cost: '$0.001',
    api: 'ScrapingDog GMaps',
    description: 'Can fetch authentic review content',
    status: 'not-started',
    order: 30
  },
  {
    id: '6.1',
    name: 'Multi-modal isochrones',
    input: '40.6782, -73.9442 | walk, transit, drive | 30 min',
    inputType: 'text',
    cost: '$0.015',
    api: 'Geoapify',
    description: 'We can show travel options from one origin',
    status: 'not-started',
    order: 31
  },

  // Phase 5 - Remaining
      {
        id: 'S.3',
        name: 'Render place pin',
        input: `{
  "name": "Fuunji",
  "lat": 35.6833,
  "lng": 139.7020,
  "rating": 4.5,
  "address": "2-14-3 Yoyogi, Shibuya City"
}`,
        inputType: 'json',
        cost: 'Included',
        api: 'Mapbox GL',
    description: 'Single-place visualization works',
    status: 'not-started',
    order: 32
  },
  {
    id: '6.4',
    name: 'Get Directions',
    input: `Active area: Angel, London [51.5362, -0.1058]
Person A: Shoreditch [51.5246, -0.0777]
Person B: Camden [51.5390, -0.1426]`,
        inputType: 'text',
        cost: 'FREE',
        api: 'URL construction',
    description: 'Seamless handoff to Google Maps',
    status: 'not-started',
    order: 33
  }
];

// Group tests by scenario (for backward compatibility)
export const scenarios: Scenario[] = [
  {
    id: 1,
    name: 'Things to Do',
    tests: implementationOrder.filter(t => ['1.1', '1.2', '1.3'].includes(t.id))
  },
  {
    id: 2,
    name: 'Where to Stay',
    tests: implementationOrder.filter(t => ['2.1', '2.2'].includes(t.id))
  },
  {
    id: 3,
    name: 'Stay + Do',
    tests: implementationOrder.filter(t => ['3.1', '3.2'].includes(t.id))
  },
  {
    id: 4,
    name: 'Single Place',
    tests: implementationOrder.filter(t => ['4.1', '4.2', '4.3', '4.4'].includes(t.id))
  },
  {
    id: 5,
    name: 'Meet in Middle',
    tests: implementationOrder.filter(t => ['5.1', '5.2', '5.3', '5.4', '5.5'].includes(t.id))
  },
  {
    id: 6,
    name: 'Areas Together',
    tests: implementationOrder.filter(t => ['6.1', '6.2', '6.3', '6.4'].includes(t.id))
  },
  {
    id: 7,
    name: 'Multi-Stop Route',
    tests: implementationOrder.filter(t => ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'].includes(t.id))
  },
  {
    id: 0,
    name: 'Shared',
    tests: implementationOrder.filter(t => t.id.startsWith('S.'))
  }
];

// Helper to get all tests as a flat array (in implementation order)
export const getAllTests = (): BuildingBlockTest[] => {
  return implementationOrder;
};

// Helper to get a specific test by ID
export const getTestById = (id: string): BuildingBlockTest | undefined => {
  return implementationOrder.find(t => t.id === id);
};

// Helper to count tests
export const getTestCount = (): number => {
  return implementationOrder.length;
};

// Get tests by status
export const getTestsByStatus = (status: TestStatus): BuildingBlockTest[] => {
  return implementationOrder.filter(t => t.status === status);
};

// Get progress stats
export const getProgress = () => {
  const done = implementationOrder.filter(t => t.status === 'done').length;
  const implementing = implementationOrder.filter(t => t.status === 'implementing').length;
  const notStarted = implementationOrder.filter(t => t.status === 'not-started').length;
  return { done, implementing, notStarted, total: implementationOrder.length };
};
