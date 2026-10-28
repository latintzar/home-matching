/**
 * Category-specific research query generation
 * 
 * Generate 2-4 Google search queries per category to help discover
 * credible contextual information about a specific property
 */

export interface CategoryQueryInput {
  propertyData: {
    title: string;
    location: string;
    size: number;
    bedrooms: number;
    bathrooms: number;
    price: number;
    propertyType?: string;
    yearBuilt?: number;
  };
  knownFacts: Record<string, any>; // B3 snippets
  unknowns: string[]; // C-phase unknowns
  photoAnalysis?: string; // Combined photo analysis summary (legacy, for backward compatibility)
  spatialLayout?: string; // Allocentric layouts spatial context (Phase 1)
  e3WholeProperty?: string; // E3 whole-property analysis summary
  e4RoomByRoom?: string; // E4 room-by-room analysis summary
  category: {
    id: string;
    name: string;
    description: string;
    goal: string;
  };
}

export const generateCategoryPrompt = (input: CategoryQueryInput) => `
You are a research analyst specialized in Spanish property, renovation, and real-estate diagnostics.
Your task is to generate precise Google search queries that will help a human analyst discover
credible contextual information about a specific property and its environment.

PROPERTY DATA:
- Title: ${input.propertyData.title}
- Location: ${input.propertyData.location}
- Size: ${input.propertyData.size} m²
- Bedrooms: ${input.propertyData.bedrooms}, Bathrooms: ${input.propertyData.bathrooms}
- Price: €${input.propertyData.price?.toLocaleString()}
${input.propertyData.propertyType ? `- Type: ${input.propertyData.propertyType}` : ''}
${input.propertyData.yearBuilt ? `- Year Built: ${input.propertyData.yearBuilt}` : ''}

WHAT WE KNOW (B3 Snippets):
${JSON.stringify(input.knownFacts, null, 2)}

WHAT'S MISSING/UNCERTAIN (C Unknowns):
${input.unknowns.map(u => `- ${u}`).join('\n')}

${input.spatialLayout ? `SPATIAL LAYOUT CONTEXT (Allocentric Layouts):\n${input.spatialLayout}\n` : ''}
${input.e3WholeProperty ? `WHOLE-PROPERTY VISUAL ANALYSIS (E3):\n${input.e3WholeProperty}\n` : ''}
${input.e4RoomByRoom ? `ROOM-BY-ROOM VISUAL ANALYSIS (E4):\n${input.e4RoomByRoom}\n` : ''}
${input.photoAnalysis && !input.spatialLayout && !input.e3WholeProperty && !input.e4RoomByRoom ? `PHOTO ANALYSIS SUMMARY:\n${input.photoAnalysis}\n` : ''}

RESEARCH CATEGORY:
${input.category.name} - ${input.category.description}
Goal: ${input.category.goal}

INSTRUCTIONS:
Generate 10 Google search queries that:
1. Fit this research category's purpose
2. Are phrased naturally for Google Search (Spanish)
3. Use available specificity (city, neighborhood, property features)
4. Can yield useful context even if exact address is unknown
5. Aim to surface local, recent, credible results (.gob.es, .es, ayuntamiento, habitissimo, idealista, forums, press)
6. Avoid redundant or too-broad terms ("Spain real estate")
7. Are investigative and contextual — not marketing-like
8. Leverage spatial layout context (allocentric layouts) to understand room types, connections, and structural elements
9. Use photo analysis insights (E3/E4) to focus queries on observed issues, strengths, or property characteristics
10. Connect visual observations to local context (e.g., if photos show specific finishes or issues, search for local norms/costs for those)

Return ONLY a valid JSON object with a "queries" array (no markdown, no code blocks):

{
  "queries": [
    {
      "query": "specific search query here",
      "reasoning": "Why this search would reveal useful contextual information."
    }
  ]
}

Generate exactly 10 queries per category. If a category is not relevant, still generate 10 queries but make them more general to the property/area context. Aim for comprehensive coverage of the category topic.

Generate queries that are SPECIFIC and ACTIONABLE based on the property data, unknowns, spatial layout context, and photo analysis provided. Use the spatial and visual context to generate more precise, property-specific queries rather than generic ones.
`;

