/**
 * Diagnostic Analysis Prompts
 * 
 * Prompts for the new Listing Diagnostic pipeline that generates
 * diagnostic reports combining text analysis, photo analysis, and listing metadata.
 */

import { DiagnosticAnalysisReport, ListingDiagnosticInputs } from '@/types/diagnostic-analysis';

/**
 * Main Listing Diagnostic Analysis Prompt
 * Generates a comprehensive diagnostic report
 */
export const DIAGNOSTIC_ANALYSIS_PROMPT = (inputs: ListingDiagnosticInputs) => `
Genera un informe diagnóstico objetivo para esta propiedad española combinando texto, fotos y datos de investigación web curada.

### JERARQUÍA DE CONFIANZA
1️⃣ **Fotos** — evidencia directa y prioritaria. Describe solo lo que se ve o puede inferirse razonablemente de lo visible.  
2️⃣ **Texto del anuncio** — contexto secundario. Úsalo para completar o contrastar observaciones.  
3️⃣ **Investigación web** — datos del mundo real obtenidos por búsquedas automáticas (costes, normativa, condiciones del mercado).  
   Empléalos únicamente para confirmar o matizar hallazgos; no sustituyen la evidencia visual ni textual.

---

### DATOS DE ENTRADA
- Título: ${inputs.listingMetadata.title}
- Precio: €${inputs.listingMetadata.price?.toLocaleString()}
- Superficie: ${inputs.listingMetadata.size} m²
- Habitaciones: ${inputs.listingMetadata.bedrooms}, Baños: ${inputs.listingMetadata.bathrooms}
${inputs.listingMetadata.floor ? `- Planta: ${inputs.listingMetadata.floor}` : ''}
${inputs.listingMetadata.yearBuilt ? `- Año: ${inputs.listingMetadata.yearBuilt}` : ''}
${inputs.listingMetadata.location ? `- Ubicación: ${inputs.listingMetadata.location}` : ''}

**Análisis textual:**
${JSON.stringify(inputs.textAnalysis.categorySnippets, null, 2)}

**Aspectos no aclarados:**
${inputs.textAnalysis.unknowns.map(u => `- ${u}`).join('\n')}

**Análisis fotográfico (global y por habitación):**
${JSON.stringify(inputs.photoAnalysis, null, 2)}

${inputs.roomLayouts && inputs.roomLayouts.length > 0 ? `**Datos de layout por habitación (E1):**
${JSON.stringify(inputs.roomLayouts, null, 2)}` : ''}

${inputs.unifiedLayout ? `**Layout unificado del hogar (E2):**
${JSON.stringify(inputs.unifiedLayout, null, 2)}` : ''}

**Datos de investigación web (si existen):**
${inputs.researchContext ? Object.entries(inputs.researchContext)
  .map(([k,v]) => `${k}: ${v.summary} (confianza ${v.confidence_level})`).join('\n') : 'N/A'}

---

### INSTRUCCIONES (MODO IMPERATIVO)
Redacta un diagnóstico claro y útil para compradores y agentes:
- Prioriza lo visible; después usa el texto; recurre a la investigación web solo para confirmar o matizar.
- Evita inventar o especular; limita las inferencias a lo razonable.
- Mantén un tono factual y profesional (supportive realism).
- Destaca fortalezas visibles y señala con precisión qué verificar.
- Escribe frases concretas y observacionales (evita vaguedades).
- Cuando algo sea incierto, explica por qué e indica una acción concreta (verifica, solicita, inspecciona, pide documentos, etc.).

---

### ESTRUCTURA DE SALIDA
Genera el informe siguiendo esta estructura JSON exacta:

{
  "listing_id": "${inputs.listingId || 'unknown'}",
  "analysis_date": "${new Date().toISOString().split('T')[0]}",
  "findings_by_category": {
    "estado_materiales": "1-2 oraciones sobre materiales y estado (finishes & surfaces)",
    "espacios_distribucion": "1-2 oraciones sobre distribución (layout & flow)",
    "entorno_vistas": "1-2 oraciones sobre entorno, luz, orientación y vistas",
    "servicios_instalaciones": "1-2 oraciones sobre servicios visibles (plumbing, electrical, HVAC)",
    "legal_economico": "1-2 oraciones sobre aspectos legales/económicos básicos",
    "seguridad_accesibilidad": "1-2 oraciones sobre seguridad y accesibilidad",
    "caracter_arquitectonico": "1-2 oraciones sobre estilo o contexto arquitectónico"
  },
  "visible_strengths": [
    "EXACTAMENTE 6 fortalezas visibles ancladas en fotos. Formato breve: 'Luz natural', 'Vistas despejadas', 'Terraza amplia'",
    "Tono: factual y positivo, solo lo que está visible en las fotos (sin especulación)"
  ],
  "verification_focus": [
    {
      "aspect": "Qué está faltando, es incierto o potencialmente problemático",
      "why_uncertain": "Por qué es incierto (ej: no hay foto, anuncio ambiguo, etc.)",
      "suggested_action": "Acción concreta en IMPERATIVO (ej.: 'Verifica suministro eléctrico y solicita boletín', 'Solicita estatutos de la comunidad', 'Inspecciona bajantes y toma fotos')",
      "severity": "low" | "medium" | "high"
    }
  ],
  "effort_impact": "2-3 oraciones sobre el esfuerzo o timeline esperado para el comprador",
  "key_takeaways": [
    "EXACTAMENTE 5 bullets concisos (≤140 caracteres cada uno). Tono: 'supportive realism' - calm, factual, encouraging",
    "Estructura: (1) lo que funciona bien, (2) qué verificar, (3) oportunidad/valor, (4) esfuerzo realista, (5) para quién es ideal",
    "EVITA: lenguaje comercial, exageración, negatividad"
  ],
  "disclaimer": "Disclaimer explícito: 'Diagnóstico basado únicamente en fotos disponibles. No reemplaza inspección técnica ni due diligence legal.'"
}

Devuelve SOLO el JSON válido.
`;
