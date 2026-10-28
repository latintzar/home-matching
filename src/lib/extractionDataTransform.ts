// import { ExtractionData } from '@/hooks/useExtractionData';
// import { PropertyDetailsData } from '@/components/PropertyDetails';

/**
 * Transform Text Analysis pipeline data to PropertyDetails format
 */
export function transformExtractionData(extractionData: any): any {
  if (!extractionData) {
    return {};
  }

  // Transform headlines
  const headlines = extractionData.headlines?.map((h: any) => ({
    text: h.text
  })) || [];

  // Transform category snippets
  const categorySnippets: Record<string, { text: string }[]> = {};
  if (extractionData.category_snippets) {
    Object.entries(extractionData.category_snippets).forEach(([category, categoryData]) => {
      // Handle nested structure: category_snippets[category].snippets_by_category[category]
      const snippets = (categoryData as any)?.snippets_by_category?.[category] || [];
      if (Array.isArray(snippets)) {
        categorySnippets[category] = snippets.map(s => ({
          text: s.text
        }));
      }
    });
  }

  // Transform unknowns checklist
  const unknownsChecklist = extractionData.unknowns_checklist || [];

  // Transform contextual followups
  const contextualFollowups = extractionData.contextual_followups || [];

  return {
    headlines: headlines.length > 0 ? headlines : undefined,
    categorySnippets: Object.keys(categorySnippets).length > 0 ? categorySnippets : undefined,
    unknownsChecklist: unknownsChecklist.length > 0 ? unknownsChecklist : undefined,
    contextualFollowups: contextualFollowups.length > 0 ? contextualFollowups : undefined,
  };
}

/**
 * Get Spanish category labels for display
 */
export const categoryLabels: Record<string, string> = {
  estado_materiales: 'Estado y Materiales',
  espacios_distribucion: 'Espacios y Distribución', 
  entorno_vistas: 'Entorno y Vistas',
  servicios_instalaciones: 'Servicios e Instalaciones',
  legal_economico: 'Legal y Económico',
  seguridad_accesibilidad: 'Seguridad y Accesibilidad',
  caracter_arquitectonico: 'Carácter Arquitectónico',
  marketing_promocional: 'Marketing Promocional',
  // Text Analysis pipeline categories
  heritage_architecture: 'Patrimonio/Arquitectura',
  layout_access: 'Distribución/Accesos',
  exterior: 'Exterior',
  parking_storage: 'Parking/Trastero',
  security: 'Seguridad',
  pool: 'Piscina',
  amenities: 'Amenities',
  climate: 'Clima',
  accessibility: 'Accesibilidad/Ascensor',
  legal_terms: 'Términos/Legal',
  other: 'Otros'
};
