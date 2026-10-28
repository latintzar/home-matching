// Text Analysis Pipeline Prompts
// Based on docs/TEXT_ANALYSIS_PIPELINE.md

export type Claim = {
  id: string;
  sentence_id: string;
  fact: string;
  source_span: string;
  polarity: 'affirmed' | 'negated' | 'unknown';
  units?: string | null;
  numeric_value?: number | null;
  normalized_value?: string | null;
};

export type QuickKeywords = {
  title: string | null;
  city: string | null;
  address: string | null;
  price_eur: number | null;
  constructed_sqm: number | null;
  useful_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  // year: removed from A1, will be extracted by A2
  property_type: string | null;
  floor: string | null;
  views: string[];
  features: string[];
  lat: number | null;
  lng: number | null;
};

export type Sentence = {
  id: string;
  text: string;
  source: 'title' | 'location' | 'description' | 'caption';
};

// Pass A1: Quick Keywords Extraction (using regex patterns)
// Note: This is implemented in the API route using regex, not LLM

// Pass A2: Sentence-by-sentence fact extraction
export const PASS_A_PROMPT = (listingData: any) => `You are a fact extraction system for Spanish real estate listings.

TASK: Perform sentence-by-sentence fact extraction from this property listing.
Process each sentence individually and extract ALL factual claims.

PROPERTY LISTING DATA:
- Title: ${listingData.title}
- Description: ${listingData.description || 'No description'}
- Property Type: ${listingData.property_subtype || 'Unknown'}
- Housing Situation: ${listingData.housing_situation || 'Unknown'}
- Origin: ${listingData.ad_origin || 'Unknown'}
- Condition: ${listingData.condition || 'Unknown'}
    - Floor Level: ${listingData.floor_level || 'Unknown'} (${listingData.floor_number ? '#' + listingData.floor_number : 'No Number'})
    - Booleans: Elevator=${listingData.has_elevator}, Terrace=${listingData.has_terrace} (${listingData.terrace_orientation || 'Unknown'}), Balcony=${listingData.has_balcony} (${listingData.balcony_orientation || 'Unknown'}), Pool=${listingData.has_pool}, Garage=${listingData.has_garage}, AC=${listingData.has_air_conditioning}, Wardrobes=${listingData.has_wardrobes}, Accessible=${listingData.is_accessible}, Storage=${listingData.has_storage}
- Rooms & Amenities: ${listingData.roomsAndAmenities || 'None'}
- Additional Features: ${listingData.additionalFeatures?.join(', ') || 'None'}
- Price: €${listingData.price_eur?.toLocaleString() || 'Unknown'}
- Constructed Area: ${listingData.areas?.constructed || 'Unknown'}m²
- Useful Area: ${listingData.areas?.useful || 'Unknown'}m²

Extract EVERYTHING factual mentioned - room details, layout, features, conditions, amenities, specifications.
DO NOT extract the price or area measurements (already shown above).

Return ONLY a JSON array of factual claims:
[
  { "id": "F1", "fact": "Property has sea views", "source_span": "Description mentions sea views", "polarity": "affirmed", "units": null, "numeric_value": null, "normalized_value": "sea views" }
]`;

// Pass B1: Categorize Claims - Spanish prompt with 8 categories
export const PASS_B1_PROMPT = (claims: Claim[]) => `Eres un clasificador de afirmaciones factuales extraídas de anuncios inmobiliarios en España.
Cada claim describe un aspecto objetivo del inmueble.

Tarea:
- Asigna cada claim_id a **exactamente una** categoría.
- No inventes categorías.
- Si un claim es principalmente subjetivo o promocional y no verificable, clasifícalo en "marketing_promocional".
- Devuelve SOLO el JSON que cumple el responseSchema.

Definiciones de categorías:
- estado_materiales: Condición y materiales del inmueble, estado físico, antigüedad, eficiencia, reformas documentadas.
- espacios_distribucion: Estancias, superficies, distribución interna, nivel/planta, espacios exteriores privados.
- entorno_vistas: Contexto de ubicación, proximidades, orientación, vistas y exposición declarada (p. ej., ruido).
- servicios_instalaciones: Sistemas y dotaciones del edificio/vivienda (suministros, HVAC, ascensor, garaje, piscina, zonas comunes).
- legal_economico: Precio, gastos, impuestos, titularidad/registro, licencias/permits, condiciones contractuales.
- seguridad_accesibilidad: Elementos de seguridad, riesgos declarados, accesibilidad y movilidad.
- caracter_arquitectonico: Rasgos arquitectónicos/heritage objetivos (protección, año, estilo, elementos originales, autor).
- marketing_promocional: Afirmaciones de prestigio/valor no verificables o esencialmente adjetivales.

Cobertura:
- Cada claim_id de claims[] debe aparecer **una única vez** en alguna categoría.
- "unassigned_claim_ids" debe quedar **vacío** salvo imposibilidad manifiesta.

Return ONLY valid JSON:
{
  "categories": {
    "estado_materiales": { "claim_ids": [] },
    "espacios_distribucion": { "claim_ids": [] },
    "entorno_vistas": { "claim_ids": [] },
    "servicios_instalaciones": { "claim_ids": [] },
    "legal_economico": { "claim_ids": [] },
    "seguridad_accesibilidad": { "claim_ids": [] },
    "caracter_arquitectonico": { "claim_ids": [] },
    "marketing_promocional": { "claim_ids": [] }
  },
  "unassigned_claim_ids": []
}

Claims:
${JSON.stringify(claims, null, 2)}`;

// Pass B3: Natural prose snippets
export const PASS_B3_PROMPT = (claims: Claim[], categoryKey: string) => `
You are generating natural-language prose snippets for claims belonging to category "${categoryKey}".
Use only the information in the input claims. Do NOT add new facts.

Return ONLY valid JSON:
{
  "snippets_by_category": {
    "${categoryKey}": [
      { "text": "...", "claim_ids_used": ["...","..."] },
      ... 
    ]
  }
}

Rules:
- Each snippet must read like a natural, flowing sentence or two (≤ 140 characters).
- Every claim_id from the input "claims" list must appear in **at least one** snippet.
- A single snippet may combine multiple claim_ids if they form a coherent sentence.
- Do not repeat the same claim_id in more than one snippet.
- No additional fields or prose outside the JSON structure.

Claims for "${categoryKey}":
${JSON.stringify(claims, null, 2)}
`;

// Pass B4: Cross-Category Headlines (up to 5) - Compelling Selling Points
export const PASS_B4_PROMPT = (allClaims: Claim[], categories: any, snippets: any, essentialInfo: any) => `Return ONLY JSON:
{
  "commentaries": [
    { "text": "La ubicación ofrece ventajas de conectividad pero requiere evaluación del ruido.", "claim_ids_used": ["F1","F2","F3"] },
    { "text": "El espacio exterior presenta oportunidades de mejora con inversión moderada.", "claim_ids_used": ["F4","F5"] }
  ]
}

CONTEXT (already processed):
- Title: ${essentialInfo.title}
- Price: ${essentialInfo.price} EUR
- Areas: ${JSON.stringify(essentialInfo.areas)}
- Bedrooms: ${essentialInfo.bedrooms}
- Bathrooms: ${essentialInfo.bathrooms}
- Physical Features: ${essentialInfo.physicalFeatures?.join(', ') || 'None'}

Rules:
- Generate 5 analytical commentaries that provide insights about this property
- Each commentary should offer a different perspective or observation
- Commentaries should complement each other, not repeat basic facts already shown above
- Focus on insights, implications, or context - not just restating features
- ≤140 chars; evidence via claim_ids_used
- TONE: Rational, trustworthy, neutral - analytical commentary, not sales pitch
- APPROACH: Problem-solving mindset, focus on possibilities and potential
- CREDIBILITY: Be consistent, reliable, and credible - acknowledge both strengths and areas for improvement
- MINDSET: Like Puedo Casa - giving feeling of possibility through rational analysis
- Think like a property analyst: what are 5 key insights or perspectives you'd share?
- AVOID: Restating basic facts (bedrooms, bathrooms, price) - these are already shown above
- INCLUDE: Context, implications, or analytical observations about what we know and don't know

All Claims:
${JSON.stringify(allClaims)}

Categories:
${JSON.stringify(categories)}

Snippets:
${JSON.stringify(snippets)}`;

// Helper function for expected details per category
const getExpectedDetailsForCategory = (categoryKey: string) => {
  const expectedDetails: Record<string, string[]> = {
    "estado_materiales": ["año de construcción","última reforma mayor","certificación de eficiencia energética","estado visible de la estructura"],
    "espacios_distribucion": ["superficie total","número de dormitorios y baños","planta/piso","terrazas o espacios exteriores privados"],
    "entorno_vistas": ["orientación","vistas al entorno (mar/monte/urbano)","ruido/tráfico cercano","prox. a servicios/transporte"],
    "servicios_instalaciones": ["tipo de calefacción/aire acondicionado","ascensor (si corresponde)","plaza de garaje","piscina/zonas comunes"],
    "legal_economico": ["tipo de titularidad (propiedad/arrendamiento)","impuestos/IBI/gastos comunidad","licencia/turma turística (si aplica)","cargas registrales/notas simples"],
    "seguridad_accesibilidad": ["puerta blindada o sistema de seguridad","acceso minusválidos o movilidad reducida","vías de evacuación/seguridad contra incendios","grado de violencia o riesgo zona (si se menciona)"],
    "caracter_arquitectonico": ["edificio catalogado/patrimonial","año arquitecto conocido o estilo","elementos originales conservados","protección urbanística específica"],
    "marketing_promocional": []
  };
  return expectedDetails[categoryKey] || [];
};

// Pass C1: Category-Specific Unknowns (single category processing)
export const PASS_C_PROMPT = (claims: Claim[], categoryKey: string, categoryData: any, essentialInfo: any, jurisdiction: string = "España", buyerType: string = "comprador residencial") => `
Eres un asistente que ayuda al comprador a identificar **qué detalles clave no están indicados** en las afirmaciones extraídas de un anuncio inmobiliario, en el contexto de ${jurisdiction} y para un comprador tipo "${buyerType}".

A continuación se presentan los **detalles estándar esperados** para la categoría "${categoryKey}":

{
  "expected_details": {
    "${categoryKey}": ${JSON.stringify(getExpectedDetailsForCategory(categoryKey))}
  }
}

Tarea:
Compara las afirmaciones ("claims") para esta categoría con los "expected_details". Genera una lista de los **detalles que no están indicados** por las claims pero que el comprador razonablemente debería conocer.

Devuelve SOLO JSON:
{
  "categoryUnknowns": {
    "${categoryKey}": [
      "<detalle no declarado 1>",
      "<detalle no declarado 2>"
    ]
  }
}

Reglas:
- Usa español.
- Sólo incluye si hay **algún detalle faltante**.
- No más de 5 detalles por categoría.
- Usa lenguaje de tipo "[detalle concreto]" (sin "falta de").
- No inventes nuevos detalles fuera del expected list.

Contexto del anuncio:
- Título: ${essentialInfo.title}
- Precio: ${essentialInfo.price} EUR
- Superficies: ${JSON.stringify(essentialInfo.areas)}
- Dormitorios: ${essentialInfo.bedrooms}
- Baños: ${essentialInfo.bathrooms}

Claims para "${categoryKey}":
${JSON.stringify(claims, null, 2)}
`;

