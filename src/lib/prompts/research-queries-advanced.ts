/**
 * Advanced Research Query Generation - "Double-Barrel" Hybrid Engine
 * 
 * Replaces the old 22-category system with 8 Mega-Categories.
 * Implements two distinct logic paths:
 * 1. Barrel A (The Syllabus): Mandatory, rigorous checklists (Hard-coded logic)
 * 2. Barrel B (The Detective): Creative, context-aware investigation (LLM logic)
 */

export interface MegaCategory {
  id: string;
  name: string;
  description: string;
  syllabus_triggers: Array<{
    condition: (data: any) => boolean;
    required_concepts: string[];
    reason: string;
  }>;
}

// ============================================================================
// 1. MEGA-CATEGORIES DEFINITION
// ============================================================================

export const MEGA_CATEGORIES: MegaCategory[] = [
  {
    id: 'structural_pathology',
    name: 'Structural Pathology & Building Health',
    description: 'Physical health of the building: structure, damp, pests, materials.',
    syllabus_triggers: [
      {
        condition: (d) => d.yearBuilt && d.yearBuilt >= 1950 && d.yearBuilt <= 1980,
        required_concepts: ['aluminosis vigas test', 'cemento aluminoso'],
        reason: 'Built between 1950-1980 (Aluminosis risk)'
  },
  {
        condition: (d) => d.floor === 'ground' || d.floor === 'basement',
        required_concepts: ['humedades capilaridad', 'nivel freático zona', 'radón mapa'],
        reason: 'Ground/Basement floor (Damp/Radon risk)'
      },
      {
        condition: (d) => d.yearBuilt && d.yearBuilt < 1920,
        required_concepts: ['estructura madera carcoma', 'rehabilitación estructural'],
        reason: 'Pre-1920 (Wood structure/Pest risk)'
      }
    ]
  },
  {
    id: 'environmental_hostility',
    name: 'Environmental Hostility & Sensory Risk',
    description: 'External factors: flood, noise, smells, pests, air quality.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['mapa inundabilidad', 'mapa ruido', 'calidad aire'],
        reason: 'Mandatory environmental baseline'
      },
      {
        condition: (d) => d.location && (d.location.toLowerCase().includes('mar') || d.location.toLowerCase().includes('playa')),
        required_concepts: ['ley costas deslinde', 'corrosión marina'],
        reason: 'Coastal location (Costas law/Corrosion)'
      }
    ]
  },
  {
    id: 'social_security',
    name: 'Social, Security & Neighborhood Context',
    description: 'Human environment: squatters, crime, tourism, conflict.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['okupas barrio', 'tasa criminalidad', 'conflictos vecinales'],
        reason: 'Mandatory social safety check'
  },
  {
        condition: (d) => d.propertyType === 'penthouse' || d.floor === 'top',
        required_concepts: ['robo áticos', 'seguridad terrazas'],
        reason: 'Top floor (Roof access burglary risk)'
      }
    ]
  },
  {
    id: 'urban_legality',
    name: 'Urban Legality, Planning & "Ghosts"',
    description: 'Legal status: planning, illegal works, licenses, expropriations.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['PGOU planeamiento', 'afectación urbanística', 'ITE edificio'],
        reason: 'Mandatory urban planning check'
  },
  {
        condition: (d) => d.propertyType === 'attic' || d.description?.toLowerCase().includes('terraza cerrada'),
        required_concepts: ['legalización cerramiento terraza', 'expediente disciplina urbanística'],
        reason: 'Attic/Terrace (Illegal enclosure risk)'
      }
    ]
  },
  {
    id: 'renovation_reality',
    name: 'The "Charm Tax" & Renovation Reality',
    description: 'Execution: costs, permits, contractors, timelines.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['precio reforma integral m2', 'plazo licencia obra mayor'],
        reason: 'Mandatory renovation baseline'
  },
  {
        condition: (d) => d.yearBuilt && d.yearBuilt < 1980,
        required_concepts: ['retirada amianto coste', 'cambio bajantes comunidad'],
        reason: 'Old building (Asbestos/Plumbing risk)'
      }
    ]
  },
  {
    id: 'financial_opex',
    name: 'Financials, Hidden OpEx & Incentives',
    description: 'Money: taxes, community fees, grants, hidden costs.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['IBI anual', 'gastos comunidad promedio', 'derramas comunidad'],
        reason: 'Mandatory OpEx check'
      },
      {
        condition: (d) => true, // Always check
        required_concepts: ['ayudas rehabilitación fondos next generation', 'deducción IRPF obras'],
        reason: 'Mandatory Incentives check'
      }
    ]
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure & Connectivity',
    description: 'Services: internet, transport, EV charging, medical.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['cobertura fibra óptica', 'cargadores coche eléctrico', 'transporte público'],
        reason: 'Mandatory infrastructure baseline'
      }
    ]
  },
  {
    id: 'market_context',
    name: 'Market Context & Comps',
    description: 'Value: price trends, liquidity, negotiation.',
    syllabus_triggers: [
      {
        condition: (d) => true, // Always check
        required_concepts: ['precio m2 venta real', 'tendencia precios', 'tiempo medio venta'],
        reason: 'Mandatory market baseline'
      }
    ]
  }
];

// ============================================================================
// 2. BARREL A: THE SYLLABUS (Deterministic)
// ============================================================================

export function generateBarrelAPrompt(
  category: MegaCategory,
  propertyData: any
): { queries: string[]; reasoning: string[] } {
  const queries: string[] = [];
  const reasoning: string[] = [];

  // Location string cleanup (e.g., "Calvià, Mallorca" -> "Calvià")
  const cleanLocation = propertyData.location?.split(',')[0]?.trim() || 'España';
  const city = propertyData.city || cleanLocation;

  category.syllabus_triggers.forEach(trigger => {
    if (trigger.condition(propertyData)) {
      trigger.required_concepts.forEach(concept => {
        // Construct query: Concept + Location + (Optional Context)
        const query = `${concept} ${city} ${propertyData.location || ''}`.trim();
        queries.push(query);
        reasoning.push(`[Barrel A] Triggered by: ${trigger.reason}`);
      });
    }
  });

  return { queries, reasoning };
}

// ============================================================================
// 3. BARREL B: THE DETECTIVE (LLM Creative)
// ============================================================================

export const GENERATE_BARREL_B_PROMPT = (inputs: {
  category: MegaCategory;
  propertyData: {
    title: string;
    location: string;
    size: number;
    bedrooms: number;
    bathrooms: number;
    price: number;
    propertyType?: string;
    yearBuilt?: number;
    description?: string;
  };
  visualContext?: {
    summary: string;
    risk_flags: string[];
  };
  cadastralContext?: {
    officialYear?: number;
    officialUsage?: string;
    officialSize?: number;
    neighborhoodAge?: number;
    buildingType?: string;
    warnings?: string[];
  };
}) => `
You are a "Real Estate Detective" investigating a property in Spain.
Your goal is to find "Hidden Vices" (Vicios Ocultos) or specific risks that a standard check might miss.

CATEGORY TO INVESTIGATE: ${inputs.category.name}
(${inputs.category.description})

PROPERTY EVIDENCE:
- Title: ${inputs.propertyData.title}
- Location: ${inputs.propertyData.location}
- Description: "${inputs.propertyData.description?.substring(0, 300)}..."
- Year Built: ${inputs.cadastralContext?.officialYear || inputs.propertyData.yearBuilt || 'Unknown'} ${inputs.cadastralContext?.officialYear ? '(Confirmed by Cadastre)' : ''}
- Official Usage: ${inputs.cadastralContext?.officialUsage || 'Unknown'}
- Neighborhood Context: Average Age ${inputs.cadastralContext?.neighborhoodAge || 'Unknown'}
- Visual Clues: ${inputs.visualContext?.risk_flags?.join(', ') || 'None'}
- Cadastral Warnings: ${inputs.cadastralContext?.warnings?.join(', ') || 'None'}

TASK:
Generate 3-5 specific, creative Google search queries to investigate this specific property/area for this category.
- Look for "Edge Cases" (e.g., specific building name issues, local scandals, specific street problems).
- Use specific Spanish terminology (e.g., "sentencia derribo", "problemas acústicos", "aluminosis edificio X").
- If the visual clues mention cracks, damp, or specific materials, search for those.
- **LEVERAGE CADASTRAL DATA:**
  - If the "Official Usage" is NOT residential (e.g., "Oficina", "Almacén"), search for conversion legality ("cambio uso", "cédula habitabilidad").
  - If the Year Built is different from the listing, trust the Cadastre Year and search for period-specific risks (e.g., 1950-1980 -> Aluminosis).
  - If the Neighborhood is historic (pre-1950), search for "protección patrimonio" or "PEUAT" (if Barcelona).

OUTPUT JSON:
{
  "queries": [
    {
      "query": "sentencia derribo edificio [Street Name] [City]",
      "reasoning": "Description mentions legal dispute, need to verify demolition orders"
    }
  ]
}
`;

// ============================================================================
// 4. CURATION PROMPT
// ============================================================================

export const CURATION_PROMPT = (inputs: {
  category: MegaCategory;
  searchResults: any[];
  propertyData: any;
}) => `
You are a Senior Real Estate Analyst.
Synthesize these Google Search results into a "Forensic Audit" for the category: ${inputs.category.name}.

CONTEXT:
Property: ${inputs.propertyData.title} in ${inputs.propertyData.location}

SEARCH RESULTS:
${JSON.stringify(inputs.searchResults.slice(0, 15).map(r => ({ title: r.title, snippet: r.snippet, source: r.display_link })), null, 2)}

TASK:
1. Filter out noise (ads, generic SEO content).
2. Identify "Red Flags" (risks, prohibitions, high costs) and "Green Flags" (opportunities, grants).
3. Synthesize a "Stance" (2-3 paragraphs) explaining the situation for THIS property.
4. Extract 3-5 "Key Findings" bullets.

OUTPUT JSON:
    {
  "summary": "Narrative synthesis...",
  "key_points": ["Finding 1", "Finding 2"],
  "confidence_level": "high" | "medium" | "low",
  "representative_snippets": [
    { "url": "...", "title": "...", "snippet": "..." }
  ]
}
`;
