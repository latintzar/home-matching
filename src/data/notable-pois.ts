/**
 * Curated Notable POIs for 10 SERP Cities
 * 
 * These are hand-curated POIs with rich metadata for Leo Brain to use
 * in conversations. Auto-filtering (wikidata + area) handles 90% of cases,
 * but these curated entries provide:
 * 
 * 1. Vibe descriptions for recommendations
 * 2. "Good for" tags for matching user preferences
 * 3. Local knowledge Gemini might not have
 * 
 * Cities: Barcelona, Madrid, Valencia, Sevilla, Málaga, 
 *         San Sebastián, Bilbao, Palma, Granada, Alicante
 */

export interface NotablePOI {
  name: string;
  nameEs?: string;
  coords: [number, number];  // [lng, lat]
  type: 'park' | 'beach' | 'market' | 'landmark' | 'area';
  vibe: string;
  goodFor: string[];
  notGoodFor?: string[];
  localTip?: string;
}

export interface CityPOIs {
  city: string;
  parks: NotablePOI[];
  beaches: NotablePOI[];
  other?: NotablePOI[];
}

// =============================================================================
// BARCELONA
// =============================================================================
export const BARCELONA_POIS: CityPOIs = {
  city: 'barcelona',
  parks: [
    {
      name: 'Parc de la Ciutadella',
      coords: [2.1873, 41.3887],
      type: 'park',
      vibe: 'Central green oasis, family-friendly, lake with rowboats',
      goodFor: ['dogs', 'running', 'picnics', 'families', 'remote work outdoors'],
      localTip: 'Dog area near the Passeig Picasso entrance. Sunday drum circles.',
    },
    {
      name: 'Parc Güell',
      coords: [2.1527, 41.4145],
      type: 'park',
      vibe: 'Touristy Gaudí landmark, amazing views, hilly',
      goodFor: ['tourists', 'views', 'photography', 'once-in-a-while visits'],
      notGoodFor: ['daily dog walks', 'running'],
      localTip: 'Free entry before 9:30am and after 7pm. Very crowded midday.',
    },
    {
      name: 'Parc de Montjuïc',
      coords: [2.1589, 41.3648],
      type: 'park',
      vibe: 'Huge mountain park, nature trails, castle, gardens',
      goodFor: ['hiking', 'nature', 'running', 'views', 'escaping the city'],
      localTip: 'Take the Telefèric for views. Jardí Botànic is worth it.',
    },
    {
      name: 'Turó Park',
      coords: [2.1367, 41.3953],
      type: 'park',
      vibe: 'Upscale Sarrià neighborhood, quiet, well-maintained',
      goodFor: ['families', 'quiet time', 'dogs', 'posh vibes'],
      localTip: 'Popular with expat families. Great playground.',
    },
    {
      name: 'Parc del Laberint d\'Horta',
      coords: [2.1453, 41.4397],
      type: 'park',
      vibe: 'Historic hedge maze, romantic, peaceful',
      goodFor: ['dates', 'photography', 'escaping crowds', 'history buffs'],
      notGoodFor: ['dogs', 'running'],
      localTip: 'Free on Sundays. Get lost in the labyrinth!',
    },
    {
      name: 'Parc de Collserola',
      coords: [2.1167, 41.4167],
      type: 'park',
      vibe: 'Huge natural park, forest trails, mountain biking',
      goodFor: ['hiking', 'trail running', 'mountain biking', 'nature lovers'],
      localTip: 'Access via FGC to Baixador de Vallvidrera. Carretera de les Aigües is flat and scenic.',
    },
  ],
  beaches: [
    {
      name: 'Platja de la Barceloneta',
      nameEs: 'Playa de la Barceloneta',
      coords: [2.1889, 41.3775],
      type: 'beach',
      vibe: 'Iconic, touristy, lively, restaurants and bars',
      goodFor: ['socializing', 'beach bars', 'people watching', 'central location'],
      notGoodFor: ['quiet time', 'families with small kids on weekends'],
      localTip: 'Go early morning for locals only. Chiringuitos are overpriced.',
    },
    {
      name: 'Platja de la Nova Icària',
      coords: [2.1985, 41.3893],
      type: 'beach',
      vibe: 'Family-friendly, calmer, near Port Olímpic',
      goodFor: ['families', 'swimming', 'less crowded than Barceloneta'],
      localTip: 'Good playground nearby. Water sports rentals available.',
    },
    {
      name: 'Platja del Bogatell',
      coords: [2.2086, 41.3967],
      type: 'beach',
      vibe: 'Local favorite, volleyball courts, sporty',
      goodFor: ['volleyball', 'running', 'locals', 'sports'],
      localTip: 'Regular beach volleyball games. Popular with Poblenou residents.',
    },
    {
      name: 'Platja de la Mar Bella',
      coords: [2.2185, 41.4023],
      type: 'beach',
      vibe: 'Young crowd, nudist section, alternative',
      goodFor: ['young people', 'LGBTQ+', 'nudism', 'less tourists'],
      localTip: 'Nudist section at the far end. Base Nàutica for water sports.',
    },
    {
      name: 'Platja del Llevant',
      coords: [2.2237, 41.4099],
      type: 'beach',
      vibe: 'Furthest north, very quiet, dogs allowed off-season',
      goodFor: ['dogs', 'peace and quiet', 'locals only', 'running'],
      localTip: 'Dogs allowed Oct-March. Least crowded Barcelona beach.',
    },
  ],
};

// =============================================================================
// MADRID
// =============================================================================
export const MADRID_POIS: CityPOIs = {
  city: 'madrid',
  parks: [
    {
      name: 'Parque del Retiro',
      coords: [-3.6833, 40.4153],
      type: 'park',
      vibe: 'Madrid\'s Central Park, royal gardens, iconic lake',
      goodFor: ['running', 'rowing', 'dates', 'families', 'tourists'],
      localTip: 'Crystal Palace is free. Rent a boat on the lake. Sunday drummers.',
    },
    {
      name: 'Casa de Campo',
      coords: [-3.7500, 40.4167],
      type: 'park',
      vibe: 'Massive forest park, zoo, amusement park, trails',
      goodFor: ['mountain biking', 'hiking', 'nature', 'escaping city'],
      notGoodFor: ['central location seekers'],
      localTip: 'Teleférico cable car from Rosales. Avoid at night.',
    },
    {
      name: 'Madrid Río',
      coords: [-3.7167, 40.4000],
      type: 'park',
      vibe: 'Modern riverside park, playgrounds, sports',
      goodFor: ['running', 'cycling', 'families', 'skateboards'],
      localTip: 'Best playground at Matadero. Great for evening runs.',
    },
    {
      name: 'Parque del Oeste',
      coords: [-3.7267, 40.4297],
      type: 'park',
      vibe: 'Rose gardens, Egyptian temple, sunset views',
      goodFor: ['sunset', 'roses', 'dates', 'Temple of Debod views'],
      localTip: 'Templo de Debod sunsets are magical. Rosaleda in May.',
    },
    {
      name: 'Jardín del Príncipe de Anglona',
      coords: [-3.7089, 40.4133],
      type: 'park',
      vibe: 'Hidden gem in La Latina, tiny but charming',
      goodFor: ['dates', 'quiet reading', 'escaping crowds'],
      localTip: 'Secret garden most tourists miss. Near Plaza de la Paja.',
    },
  ],
  beaches: [], // Madrid has no beaches - could add pools or nearby options
};

// =============================================================================
// VALENCIA
// =============================================================================
export const VALENCIA_POIS: CityPOIs = {
  city: 'valencia',
  parks: [
    {
      name: 'Jardín del Turia',
      coords: [-0.3667, 39.4750],
      type: 'park',
      vibe: '9km of converted riverbed, bikes, playgrounds, sports',
      goodFor: ['running', 'cycling', 'families', 'connecting neighborhoods'],
      localTip: 'Gulliver playground is amazing for kids. Rent bikes at Valenbisi.',
    },
    {
      name: 'Jardines de Viveros',
      coords: [-0.3620, 39.4820],
      type: 'park',
      vibe: 'Royal gardens, shaded paths, central location',
      goodFor: ['dogs', 'running', 'quiet time', 'families'],
      localTip: 'Free concerts in summer. Best jogging in the city.',
    },
    {
      name: 'Parque Natural de la Albufera',
      coords: [-0.3500, 39.3333],
      type: 'park',
      vibe: 'Lagoon nature reserve, birdwatching, paella origins',
      goodFor: ['nature', 'birdwatching', 'escaping city', 'paella'],
      localTip: 'Boat rides at sunset. Eat paella in El Palmar.',
    },
  ],
  beaches: [
    {
      name: 'Playa de la Malvarrosa',
      coords: [-0.3167, 39.4750],
      type: 'beach',
      vibe: 'Main city beach, promenade, paella restaurants',
      goodFor: ['families', 'beach bars', 'central location'],
      localTip: 'Go south to Playa de las Arenas for slightly less crowds.',
    },
    {
      name: 'Playa de la Patacona',
      coords: [-0.3167, 39.4917],
      type: 'beach',
      vibe: 'Quieter extension of Malvarrosa, more local',
      goodFor: ['locals', 'volleyball', 'less tourists'],
      localTip: 'Walk here from Malvarrosa. Better vibe, same water.',
    },
    {
      name: 'Playa del Saler',
      coords: [-0.3167, 39.3667],
      type: 'beach',
      vibe: 'Natural beach near Albufera, dunes, pine forest',
      goodFor: ['nature lovers', 'escaping crowds', 'quiet'],
      localTip: 'Protected dunes. Combine with Albufera visit.',
    },
  ],
};

// =============================================================================
// SEVILLA
// =============================================================================
export const SEVILLA_POIS: CityPOIs = {
  city: 'sevilla',
  parks: [
    {
      name: 'Parque de María Luisa',
      coords: [-5.9878, 37.3772],
      type: 'park',
      vibe: 'Grand park, Plaza de España, romantic paths',
      goodFor: ['tourists', 'running', 'dates', 'photos'],
      localTip: 'Plaza de España is stunning. Early morning or late afternoon.',
    },
    {
      name: 'Jardines de Murillo',
      coords: [-5.9875, 37.3847],
      type: 'park',
      vibe: 'Next to Alcázar, shaded, central',
      goodFor: ['escape after Alcázar visit', 'cool shade', 'central'],
      localTip: 'Great for cooling down in summer heat.',
    },
    {
      name: 'Alameda de Hércules',
      coords: [-5.9958, 37.3956],
      type: 'area',
      vibe: 'Trendy plaza, bars, nightlife, alternative scene',
      goodFor: ['nightlife', 'tapas', 'young crowd', 'LGBTQ+'],
      localTip: 'Best bar scene in Sevilla. Sunday flea market.',
    },
  ],
  beaches: [
    // Sevilla has no beaches - nearest is ~1hr drive
  ],
};

// =============================================================================
// MÁLAGA
// =============================================================================
export const MALAGA_POIS: CityPOIs = {
  city: 'malaga',
  parks: [
    {
      name: 'Parque de Málaga',
      coords: [-4.4200, 36.7178],
      type: 'park',
      vibe: 'Central promenade, tropical plants, sculptures',
      goodFor: ['walking', 'central location', 'tourists'],
      localTip: 'Beautiful tile benches. Connects port to city center.',
    },
    {
      name: 'Jardín Botánico-Histórico La Concepción',
      coords: [-4.4333, 36.7500],
      type: 'park',
      vibe: '150-year-old gardens, tropical, peaceful',
      goodFor: ['nature lovers', 'photography', 'escaping city'],
      localTip: 'Beautiful any time of year. ~20min from center.',
    },
  ],
  beaches: [
    {
      name: 'Playa de la Malagueta',
      coords: [-4.4100, 36.7150],
      type: 'beach',
      vibe: 'Main city beach, chiringuitos, central',
      goodFor: ['central location', 'beach bars', 'families'],
      localTip: 'Most accessible. Walk from center along promenade.',
    },
    {
      name: 'Playa de Pedregalejo',
      coords: [-4.3700, 36.7217],
      type: 'beach',
      vibe: 'Local neighborhood, best espetos, authentic',
      goodFor: ['espetos (grilled fish)', 'locals', 'less tourists'],
      localTip: 'Best chiringuitos for espetos. Walk or bike from center.',
    },
  ],
};

// =============================================================================
// SAN SEBASTIÁN
// =============================================================================
export const SAN_SEBASTIAN_POIS: CityPOIs = {
  city: 'san_sebastian',
  parks: [
    {
      name: 'Monte Urgull',
      coords: [-1.9917, 43.3250],
      type: 'park',
      vibe: 'Forested hill, castle ruins, city views',
      goodFor: ['hiking', 'views', 'history', 'escaping beach crowds'],
      localTip: 'Free entry. Best sunset views of the bay.',
    },
    {
      name: 'Parque de Cristina Enea',
      coords: [-1.9750, 43.3167],
      type: 'park',
      vibe: 'English-style gardens, peacocks, quiet',
      goodFor: ['families', 'dogs', 'quiet time', 'central'],
      localTip: 'Peacocks roam free. Nice café inside.',
    },
  ],
  beaches: [
    {
      name: 'Playa de la Concha',
      coords: [-1.9917, 43.3167],
      type: 'beach',
      vibe: 'Iconic shell-shaped beach, beautiful, touristy',
      goodFor: ['everyone', 'swimming', 'views', 'central'],
      localTip: 'One of Europe\'s best urban beaches. Crowded in summer.',
    },
    {
      name: 'Playa de Ondarreta',
      coords: [-2.0000, 43.3167],
      type: 'beach',
      vibe: 'Western extension of Concha, slightly calmer',
      goodFor: ['families', 'slightly less crowded', 'Peine del Viento'],
      localTip: 'Eduardo Chillida sculptures at the end. Beautiful.',
    },
    {
      name: 'Playa de la Zurriola',
      coords: [-1.9750, 43.3250],
      type: 'beach',
      vibe: 'Surfer beach, young crowd, Gros neighborhood',
      goodFor: ['surfing', 'young people', 'bars nearby'],
      localTip: 'Best surf in the city. Pintxo bars in Gros after.',
    },
  ],
};

// =============================================================================
// BILBAO
// =============================================================================
export const BILBAO_POIS: CityPOIs = {
  city: 'bilbao',
  parks: [
    {
      name: 'Parque de Doña Casilda',
      coords: [-2.9417, 43.2633],
      type: 'park',
      vibe: 'Central English-style park, pond, near Guggenheim',
      goodFor: ['families', 'running', 'near museums', 'central'],
      localTip: 'Duck pond for kids. Adjacent to Fine Arts Museum.',
    },
    {
      name: 'Monte Artxanda',
      coords: [-2.9250, 43.2750],
      type: 'park',
      vibe: 'Hill with funicular, panoramic views, picnic areas',
      goodFor: ['views', 'hiking', 'escaping city', 'families'],
      localTip: 'Take the funicular from Plaza Funicular. Great city views.',
    },
  ],
  beaches: [
    // Nearest beaches are ~15-20min by metro (Getxo, Sopelana)
    {
      name: 'Playa de Ereaga (Getxo)',
      coords: [-3.0117, 43.3517],
      type: 'beach',
      vibe: 'Nearest "nice" beach, upscale Getxo suburb',
      goodFor: ['day trip', 'families', 'combining with Portugalete bridge'],
      localTip: '20min by metro. See the Vizcaya Bridge nearby.',
    },
  ],
};

// =============================================================================
// PALMA DE MALLORCA
// =============================================================================
export const PALMA_POIS: CityPOIs = {
  city: 'palma',
  parks: [
    {
      name: 'Parc de la Mar',
      coords: [2.6475, 39.5678],
      type: 'park',
      vibe: 'Cathedral views, lake, central esplanade',
      goodFor: ['cathedral views', 'central location', 'tourists'],
      localTip: 'Best views of the Cathedral. Night lighting is magical.',
    },
    {
      name: 'Jardines de s\'Hort del Rei',
      coords: [2.6472, 39.5689],
      type: 'park',
      vibe: 'Moorish-style gardens, fountains, shaded',
      goodFor: ['escaping heat', 'romantic', 'history'],
      localTip: 'Beautiful Moorish arches. Cool shade in summer.',
    },
  ],
  beaches: [
    {
      name: 'Platja de Palma',
      coords: [2.7333, 39.5167],
      type: 'beach',
      vibe: 'Long beach, tourist strip, hotels',
      goodFor: ['tourists', 'beach clubs', 'long walks'],
      notGoodFor: ['authentic local experience'],
      localTip: 'Very long beach. Quieter towards the east end.',
    },
    {
      name: 'Cala Major',
      coords: [2.6000, 39.5500],
      type: 'beach',
      vibe: 'Closer to center, rocky, mixed crowd',
      goodFor: ['accessible from center', 'locals', 'snorkeling'],
      localTip: 'Near Miró Foundation. Good for quick dip.',
    },
  ],
};

// =============================================================================
// GRANADA
// =============================================================================
export const GRANADA_POIS: CityPOIs = {
  city: 'granada',
  parks: [
    {
      name: 'Jardines del Generalife',
      coords: [-3.5833, 37.1767],
      type: 'park',
      vibe: 'Alhambra gardens, historic, stunning',
      goodFor: ['tourists', 'history', 'photography', 'romantic'],
      localTip: 'Included in Alhambra ticket. Book months ahead!',
    },
    {
      name: 'Carmen de los Mártires',
      coords: [-3.5917, 37.1700],
      type: 'park',
      vibe: 'Hidden gardens, peacocks, Alhambra views',
      goodFor: ['escaping Alhambra crowds', 'quiet', 'views', 'free'],
      localTip: 'FREE and rarely crowded. Best-kept secret in Granada.',
    },
    {
      name: 'Parque García Lorca',
      coords: [-3.5917, 37.1617],
      type: 'park',
      vibe: 'Poet\'s former home, rose gardens, cultural',
      goodFor: ['literature lovers', 'families', 'dogs', 'quiet'],
      localTip: 'García Lorca\'s summer house. Beautiful rose gardens.',
    },
  ],
  beaches: [
    // Granada has no coast - nearest beaches ~1hr drive
  ],
};

// =============================================================================
// ALICANTE
// =============================================================================
export const ALICANTE_POIS: CityPOIs = {
  city: 'alicante',
  parks: [
    {
      name: 'Parque de Canalejas',
      coords: [-0.4833, 38.3450],
      type: 'park',
      vibe: 'Central promenade park, ancient ficus trees',
      goodFor: ['walking', 'central location', 'shade'],
      localTip: 'Massive 100+ year old ficus trees. Very shady.',
    },
    {
      name: 'Parque El Palmeral',
      coords: [-0.4667, 38.3583],
      type: 'park',
      vibe: 'Palm grove, river walk, nature',
      goodFor: ['cycling', 'running', 'nature', 'families'],
      localTip: 'Bike path along the coast. Nice palm gardens.',
    },
  ],
  beaches: [
    {
      name: 'Playa del Postiguet',
      coords: [-0.4750, 38.3433],
      type: 'beach',
      vibe: 'Main city beach, below castle, central',
      goodFor: ['central location', 'families', 'castle views'],
      localTip: 'Castle Santa Bárbara right above. Take elevator up.',
    },
    {
      name: 'Playa de San Juan',
      coords: [-0.4250, 38.3667],
      type: 'beach',
      vibe: 'Long beach, tram accessible, less crowded',
      goodFor: ['long walks', 'less tourists', 'sports'],
      localTip: '6km of beach. Take the tram. More space than Postiguet.',
    },
  ],
};

// =============================================================================
// EXPORT ALL
// =============================================================================
export const ALL_CITY_POIS: Record<string, CityPOIs> = {
  barcelona: BARCELONA_POIS,
  madrid: MADRID_POIS,
  valencia: VALENCIA_POIS,
  sevilla: SEVILLA_POIS,
  malaga: MALAGA_POIS,
  san_sebastian: SAN_SEBASTIAN_POIS,
  bilbao: BILBAO_POIS,
  palma: PALMA_POIS,
  granada: GRANADA_POIS,
  alicante: ALICANTE_POIS,
};

/**
 * Get notable POIs for a city
 */
export function getNotablePOIs(city: string): CityPOIs | undefined {
  const normalizedCity = city.toLowerCase().replace(/[^a-z]/g, '_');
  return ALL_CITY_POIS[normalizedCity];
}

/**
 * Get all parks from all cities
 */
export function getAllParks(): NotablePOI[] {
  return Object.values(ALL_CITY_POIS).flatMap(city => city.parks);
}

/**
 * Get all beaches from all cities
 */
export function getAllBeaches(): NotablePOI[] {
  return Object.values(ALL_CITY_POIS).flatMap(city => city.beaches);
}

/**
 * Find POIs good for a specific activity
 */
export function findPOIsGoodFor(activity: string): NotablePOI[] {
  const allPOIs = [...getAllParks(), ...getAllBeaches()];
  return allPOIs.filter(poi => 
    poi.goodFor.some(g => g.toLowerCase().includes(activity.toLowerCase()))
  );
}
