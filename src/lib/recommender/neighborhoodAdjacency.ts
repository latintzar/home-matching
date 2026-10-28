/**
 * Neighborhood Adjacency Data
 * 
 * Static mapping of adjacent neighborhoods for major Spanish cities.
 * Used for "opportunity area" flexibility suggestions during intake.
 * 
 * Future: Will be replaced/augmented by Geo-Intelligence dossiers.
 */

// ============================================================================
// Types
// ============================================================================

export interface NeighborhoodInfo {
  name: string;
  city: string;
  adjacent: string[];
  // Optional metadata for smarter suggestions
  vibe?: 'trendy' | 'family' | 'quiet' | 'central' | 'upcoming' | 'traditional';
  avgPriceMultiplier?: number; // 1.0 = city average, 1.5 = 50% above, etc.
}

// ============================================================================
// Madrid Neighborhoods
// ============================================================================

const MADRID_NEIGHBORHOODS: Record<string, NeighborhoodInfo> = {
  // Centro / Premium
  'Chamberí': {
    name: 'Chamberí',
    city: 'Madrid',
    adjacent: ['Malasaña', 'Trafalgar', 'Alonso Martínez', 'Ríos Rosas', 'Gaztambide', 'Argüelles'],
    vibe: 'traditional',
    avgPriceMultiplier: 1.4,
  },
  'Salamanca': {
    name: 'Salamanca',
    city: 'Madrid',
    adjacent: ['Recoletos', 'Goya', 'Lista', 'Retiro', 'Castellana', 'Ibiza'],
    vibe: 'traditional',
    avgPriceMultiplier: 1.6,
  },
  'Malasaña': {
    name: 'Malasaña',
    city: 'Madrid',
    adjacent: ['Chamberí', 'Chueca', 'Gran Vía', 'Conde Duque', 'Universidad', 'Noviciado'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.3,
  },
  'Chueca': {
    name: 'Chueca',
    city: 'Madrid',
    adjacent: ['Malasaña', 'Justicia', 'Alonso Martínez', 'Gran Vía', 'Tribunal'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.35,
  },
  'La Latina': {
    name: 'La Latina',
    city: 'Madrid',
    adjacent: ['Lavapiés', 'Palacio', 'Puerta de Toledo', 'Rastro', 'Embajadores', 'Sol'],
    vibe: 'traditional',
    avgPriceMultiplier: 1.2,
  },
  'Lavapiés': {
    name: 'Lavapiés',
    city: 'Madrid',
    adjacent: ['Embajadores', 'La Latina', 'Atocha', 'Tirso de Molina', 'Antón Martín'],
    vibe: 'upcoming',
    avgPriceMultiplier: 1.0,
  },
  'Retiro': {
    name: 'Retiro',
    city: 'Madrid',
    adjacent: ['Salamanca', 'Ibiza', 'Niño Jesús', 'Pacífico', 'Atocha'],
    vibe: 'family',
    avgPriceMultiplier: 1.3,
  },
  'Argüelles': {
    name: 'Argüelles',
    city: 'Madrid',
    adjacent: ['Moncloa', 'Chamberí', 'Princesa', 'Ciudad Universitaria', 'Gaztambide'],
    vibe: 'family',
    avgPriceMultiplier: 1.15,
  },
  
  // Emerging / Mid-range
  'Tetuán': {
    name: 'Tetuán',
    city: 'Madrid',
    adjacent: ['Cuatro Caminos', 'Valdeacederas', 'Estrecho', 'Castillejos', 'Almenara'],
    vibe: 'upcoming',
    avgPriceMultiplier: 0.85,
  },
  'Prosperidad': {
    name: 'Prosperidad',
    city: 'Madrid',
    adjacent: ['Chamartín', 'Alfonso XIII', 'Ciudad Lineal', 'Ávila', 'Diego de León'],
    vibe: 'family',
    avgPriceMultiplier: 1.1,
  },
  'Vallecas': {
    name: 'Vallecas',
    city: 'Madrid',
    adjacent: ['Puente de Vallecas', 'Villa de Vallecas', 'Entrevías', 'Portazgo'],
    vibe: 'family',
    avgPriceMultiplier: 0.7,
  },
  'Usera': {
    name: 'Usera',
    city: 'Madrid',
    adjacent: ['Carabanchel', 'Villaverde', 'Orcasitas', 'Plaza Elíptica'],
    vibe: 'upcoming',
    avgPriceMultiplier: 0.65,
  },
  'Carabanchel': {
    name: 'Carabanchel',
    city: 'Madrid',
    adjacent: ['Usera', 'Aluche', 'Vista Alegre', 'Opañel', 'Laguna'],
    vibe: 'family',
    avgPriceMultiplier: 0.7,
  },
  
  // Additional central areas
  'Sol': {
    name: 'Sol',
    city: 'Madrid',
    adjacent: ['Gran Vía', 'Opera', 'La Latina', 'Callao', 'Sevilla'],
    vibe: 'central',
    avgPriceMultiplier: 1.5,
  },
  'Justicia': {
    name: 'Justicia',
    city: 'Madrid',
    adjacent: ['Chueca', 'Alonso Martínez', 'Colón', 'Tribunal'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.4,
  },
  'Conde Duque': {
    name: 'Conde Duque',
    city: 'Madrid',
    adjacent: ['Malasaña', 'Argüelles', 'Plaza España', 'Noviciado'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.25,
  },
};

// ============================================================================
// Barcelona Neighborhoods
// ============================================================================

const BARCELONA_NEIGHBORHOODS: Record<string, NeighborhoodInfo> = {
  // Central / Premium
  'Eixample': {
    name: 'Eixample',
    city: 'Barcelona',
    adjacent: ['Gràcia', 'Sant Antoni', 'Sagrada Família', 'Dreta Eixample', 'Esquerra Eixample'],
    vibe: 'central',
    avgPriceMultiplier: 1.4,
  },
  'Gràcia': {
    name: 'Gràcia',
    city: 'Barcelona',
    adjacent: ['Eixample', 'Vila de Gràcia', 'Camp d\'en Grassot', 'Vallcarca', 'Lesseps'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.3,
  },
  'Gótico': {
    name: 'Gótico',
    city: 'Barcelona',
    adjacent: ['Raval', 'Born', 'Barceloneta', 'Ciutat Vella', 'Plaça Catalunya'],
    vibe: 'central',
    avgPriceMultiplier: 1.5,
  },
  'Born': {
    name: 'Born',
    city: 'Barcelona',
    adjacent: ['Gótico', 'Barceloneta', 'Sant Pere', 'Ciutadella', 'La Ribera'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.45,
  },
  'Barceloneta': {
    name: 'Barceloneta',
    city: 'Barcelona',
    adjacent: ['Born', 'Gótico', 'Vila Olímpica', 'Port Vell', 'Ciutat Vella'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.35,
  },
  
  // Mid-range / Emerging
  'Poble Sec': {
    name: 'Poble Sec',
    city: 'Barcelona',
    adjacent: ['Sant Antoni', 'Montjuïc', 'Raval', 'Hostafrancs', 'Paral·lel'],
    vibe: 'upcoming',
    avgPriceMultiplier: 1.1,
  },
  'Raval': {
    name: 'Raval',
    city: 'Barcelona',
    adjacent: ['Gótico', 'Sant Antoni', 'Poble Sec', 'Barceloneta', 'Plaça Catalunya'],
    vibe: 'upcoming',
    avgPriceMultiplier: 1.0,
  },
  'Sant Antoni': {
    name: 'Sant Antoni',
    city: 'Barcelona',
    adjacent: ['Eixample', 'Raval', 'Poble Sec', 'Esquerra Eixample', 'Hostafrancs'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.25,
  },
  'Poblenou': {
    name: 'Poblenou',
    city: 'Barcelona',
    adjacent: ['Vila Olímpica', 'Diagonal Mar', 'Sant Martí', 'Llacuna', 'Bogatell'],
    vibe: 'upcoming',
    avgPriceMultiplier: 1.15,
  },
  'Sants': {
    name: 'Sants',
    city: 'Barcelona',
    adjacent: ['Hostafrancs', 'Les Corts', 'Badal', 'Plaça de Sants', 'Mercat Nou'],
    vibe: 'family',
    avgPriceMultiplier: 0.95,
  },
  
  // Premium residential
  'Sarrià': {
    name: 'Sarrià',
    city: 'Barcelona',
    adjacent: ['Sant Gervasi', 'Les Tres Torres', 'Pedralbes', 'Vallvidrera', 'Bonanova'],
    vibe: 'family',
    avgPriceMultiplier: 1.7,
  },
  'Sant Gervasi': {
    name: 'Sant Gervasi',
    city: 'Barcelona',
    adjacent: ['Sarrià', 'Gràcia', 'Les Tres Torres', 'Turó Parc', 'Galvany'],
    vibe: 'family',
    avgPriceMultiplier: 1.6,
  },
  'Les Corts': {
    name: 'Les Corts',
    city: 'Barcelona',
    adjacent: ['Sants', 'Pedralbes', 'Camp Nou', 'Diagonal', 'Maternitat'],
    vibe: 'family',
    avgPriceMultiplier: 1.3,
  },
};

// ============================================================================
// Valencia Neighborhoods
// ============================================================================

const VALENCIA_NEIGHBORHOODS: Record<string, NeighborhoodInfo> = {
  'Ciutat Vella': {
    name: 'Ciutat Vella',
    city: 'Valencia',
    adjacent: ['El Carmen', 'El Pilar', 'La Seu', 'Mercat', 'Sant Francesc'],
    vibe: 'central',
    avgPriceMultiplier: 1.3,
  },
  'El Carmen': {
    name: 'El Carmen',
    city: 'Valencia',
    adjacent: ['Ciutat Vella', 'El Pilar', 'Velluters', 'Benimaclet', 'Torres de Quart'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.25,
  },
  'Ruzafa': {
    name: 'Ruzafa',
    city: 'Valencia',
    adjacent: ['Gran Vía', 'Eixample', 'Monteolivete', 'En Corts', 'Pla del Remei'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.2,
  },
  'Eixample': {
    name: 'Eixample',
    city: 'Valencia',
    adjacent: ['Ruzafa', 'Gran Vía', 'Pla del Remei', 'Arrancapins', 'Ciutat Vella'],
    vibe: 'central',
    avgPriceMultiplier: 1.15,
  },
  'Benimaclet': {
    name: 'Benimaclet',
    city: 'Valencia',
    adjacent: ['Alboraya', 'Orriols', 'Campanar', 'Primado Reig', 'Blasco Ibáñez'],
    vibe: 'family',
    avgPriceMultiplier: 0.95,
  },
  'Poblats Marítims': {
    name: 'Poblats Marítims',
    city: 'Valencia',
    adjacent: ['Cabanyal', 'Malvarrosa', 'Grau', 'Nazaret', 'Port'],
    vibe: 'upcoming',
    avgPriceMultiplier: 0.9,
  },
  'Patraix': {
    name: 'Patraix',
    city: 'Valencia',
    adjacent: ['Jesús', 'Safranar', 'Vara de Quart', 'Favara', 'Sant Isidre'],
    vibe: 'family',
    avgPriceMultiplier: 0.85,
  },
  'Camins al Grau': {
    name: 'Camins al Grau',
    city: 'Valencia',
    adjacent: ['Penya-Roja', 'La Creu del Grau', 'Aiora', 'Algirós'],
    vibe: 'family',
    avgPriceMultiplier: 0.9,
  },
};

// ============================================================================
// Sevilla Neighborhoods
// ============================================================================

const SEVILLA_NEIGHBORHOODS: Record<string, NeighborhoodInfo> = {
  'Santa Cruz': {
    name: 'Santa Cruz',
    city: 'Sevilla',
    adjacent: ['Arenal', 'Alfalfa', 'San Bartolomé', 'Encarnación', 'Jardines de Murillo'],
    vibe: 'central',
    avgPriceMultiplier: 1.5,
  },
  'Triana': {
    name: 'Triana',
    city: 'Sevilla',
    adjacent: ['Los Remedios', 'Cartuja', 'San Jacinto', 'Pagés del Corro', 'Altozano'],
    vibe: 'traditional',
    avgPriceMultiplier: 1.2,
  },
  'Nervión': {
    name: 'Nervión',
    city: 'Sevilla',
    adjacent: ['San Bernardo', 'Felipe II', 'Santa Justa', 'Viapol', 'Gran Plaza'],
    vibe: 'family',
    avgPriceMultiplier: 1.1,
  },
  'Los Remedios': {
    name: 'Los Remedios',
    city: 'Sevilla',
    adjacent: ['Triana', 'Tablada', 'Bellavista', 'República Argentina'],
    vibe: 'family',
    avgPriceMultiplier: 1.25,
  },
  'Macarena': {
    name: 'Macarena',
    city: 'Sevilla',
    adjacent: ['San Luis', 'Feria', 'Resolana', 'San Gil', 'Cruz Roja'],
    vibe: 'traditional',
    avgPriceMultiplier: 0.9,
  },
  'Alameda': {
    name: 'Alameda',
    city: 'Sevilla',
    adjacent: ['Feria', 'San Luis', 'San Lorenzo', 'Santa Clara', 'Regina'],
    vibe: 'trendy',
    avgPriceMultiplier: 1.1,
  },
  'San Bernardo': {
    name: 'San Bernardo',
    city: 'Sevilla',
    adjacent: ['Nervión', 'Santa Justa', 'Prado de San Sebastián', 'El Porvenir'],
    vibe: 'family',
    avgPriceMultiplier: 1.0,
  },
  'Alfalfa': {
    name: 'Alfalfa',
    city: 'Sevilla',
    adjacent: ['Santa Cruz', 'San Bartolomé', 'Encarnación', 'Salvador', 'Feria'],
    vibe: 'central',
    avgPriceMultiplier: 1.35,
  },
};

// ============================================================================
// Combined Data
// ============================================================================

export const ALL_NEIGHBORHOODS: Record<string, NeighborhoodInfo> = {
  ...MADRID_NEIGHBORHOODS,
  ...BARCELONA_NEIGHBORHOODS,
  ...VALENCIA_NEIGHBORHOODS,
  ...SEVILLA_NEIGHBORHOODS,
};

// City-specific exports
export const NEIGHBORHOODS_BY_CITY: Record<string, Record<string, NeighborhoodInfo>> = {
  Madrid: MADRID_NEIGHBORHOODS,
  Barcelona: BARCELONA_NEIGHBORHOODS,
  Valencia: VALENCIA_NEIGHBORHOODS,
  Sevilla: SEVILLA_NEIGHBORHOODS,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get adjacent neighborhoods for a given neighborhood
 */
export function getAdjacentNeighborhoods(neighborhood: string): string[] {
  // Direct lookup
  const info = ALL_NEIGHBORHOODS[neighborhood];
  if (info) {
    return info.adjacent;
  }
  
  // Check if this neighborhood appears as adjacent to others (reverse lookup)
  const reverseMatches: string[] = [];
  for (const [key, data] of Object.entries(ALL_NEIGHBORHOODS)) {
    if (data.adjacent.includes(neighborhood)) {
      reverseMatches.push(key);
    }
  }
  
  return reverseMatches;
}

/**
 * Get neighborhood info with city
 */
export function getNeighborhoodInfo(neighborhood: string): NeighborhoodInfo | null {
  return ALL_NEIGHBORHOODS[neighborhood] || null;
}

/**
 * Get all neighborhoods in a city
 */
export function getNeighborhoodsInCity(city: string): string[] {
  const cityNeighborhoods = NEIGHBORHOODS_BY_CITY[city];
  if (!cityNeighborhoods) return [];
  return Object.keys(cityNeighborhoods);
}

/**
 * Find neighborhoods by vibe
 */
export function getNeighborhoodsByVibe(
  city: string, 
  vibe: NeighborhoodInfo['vibe']
): string[] {
  const cityNeighborhoods = NEIGHBORHOODS_BY_CITY[city];
  if (!cityNeighborhoods) return [];
  
  return Object.entries(cityNeighborhoods)
    .filter(([_, info]) => info.vibe === vibe)
    .map(([name]) => name);
}

/**
 * Get cheaper adjacent neighborhoods (for budget flex suggestions)
 */
export function getCheaperAdjacentNeighborhoods(neighborhood: string): string[] {
  const info = ALL_NEIGHBORHOODS[neighborhood];
  if (!info) return [];
  
  const currentMultiplier = info.avgPriceMultiplier || 1.0;
  
  return info.adjacent.filter(adj => {
    const adjInfo = ALL_NEIGHBORHOODS[adj];
    if (!adjInfo) return false;
    return (adjInfo.avgPriceMultiplier || 1.0) < currentMultiplier;
  });
}

/**
 * Get "up-and-coming" adjacent neighborhoods (opportunity areas)
 */
export function getUpcomingAdjacentNeighborhoods(neighborhood: string): string[] {
  const info = ALL_NEIGHBORHOODS[neighborhood];
  if (!info) return [];
  
  return info.adjacent.filter(adj => {
    const adjInfo = ALL_NEIGHBORHOODS[adj];
    return adjInfo?.vibe === 'upcoming';
  });
}

/**
 * Detect city from neighborhood name
 */
export function detectCityFromNeighborhood(neighborhood: string): string | null {
  const info = ALL_NEIGHBORHOODS[neighborhood];
  return info?.city || null;
}

/**
 * Get all supported cities
 */
export function getSupportedCities(): string[] {
  return Object.keys(NEIGHBORHOODS_BY_CITY);
}

