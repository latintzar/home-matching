/**
 * Research Query Generation Prompt
 * 
 * Generates targeted Google search queries based on B3 snippets and C unknowns
 * Uses the same holistic grounding approach as the integrated analysis
 */

export const RESEARCH_QUERY_GENERATION_PROMPT = (inputs: {
  textAnalysis: {
    categorySnippets: Record<string, any>;
    unknowns: string[];
  };
  listingMetadata: {
    title: string;
    price: number;
    size: number;
    bedrooms: number;
    bathrooms: number;
    location?: string;
  };
}) => `
Genera 5-8 consultas de búsqueda específicas para Google SOBRE COLEGIOS Y ESCUELAS CERCANAS.

PROPIEDAD:
- Título: ${inputs.listingMetadata.title}
- Ubicación: ${inputs.listingMetadata.location || 'España'}
- Habitaciones: ${inputs.listingMetadata.bedrooms}

Genera consultas SOBRE ESCUELAS Y COLEGIOS en español que ayuden a encontrar:
1. Colegios cercanos a ${inputs.listingMetadata.location || 'la propiedad'}
2. Mejores escuelas de la zona
3. Distancias y tiempos de desplazamiento
4. Calidad educativa
5. Servicios de transporte escolar

Instrucciones:
- Usa búsquedas en español específicas para colegios y escuelas
- Incluye la ubicación específica (Portals Nous, Calvià, Mallorca, etc.)
- Busca colegios públicos, concertados y privados
- Incluye tiempo de desplazamiento y distancias
- Busca calificaciones y rankings

Devuelve SOLO este JSON exacto:

{
  "research_queries": [
    "mejores colegios cerca Portals Nous Mallorca",
    "escuelas primarias Calvià Mallorca ranking",
    "colegios privados Puerto Portals",
    "distancias colegios desde Portals Nous transporte escolar",
    "calificación enseñanza Calvià Mallorca"
  ]
}
`;
