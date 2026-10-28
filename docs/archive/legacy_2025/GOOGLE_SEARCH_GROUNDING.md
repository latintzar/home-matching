# Google Search Grounding in Property Analysis Pipeline

## Overview

This document explains how **Google Search grounding** fits into our property analysis pipeline, providing the "reality tether" that contextualizes agent claims and photo evidence.

---

## The Logic Chain

### 🧱 1. **Text Analysis**

Tells you *what the agent claims* — e.g., "recently renovated," "exclusive community," "built in 1985," "sea views," etc.

### 🖼️ 2. **Photo Analysis**

Tells you *what's visually plausible* — e.g., "finishes look 10–20 years old," "windows appear modern," "moisture risk low," etc.

### 🌐 3. **Google Search Grounding**

Tells you *what's typical in the real world around this context* —
e.g., "1980s Portals Nous flats commonly refurbished after 2018,"
"Calvià IBI rates ~€800–1,200,"
"Puerto Portals known for noise near marina,"
"PGOU Calvià restricts major works near coastline."

---

## Integration: How They Combine

| Source                | Function | Example Output                                                                |
| --------------------- | -------- | ----------------------------------------------------------------------------- |
| **Text**              | Claims   | "Recently renovated."                                                         |
| **Photos**            | Evidence | "Finishes appear older than 5 years."                                         |
| **Search**            | Context  | "Typical refurbishments in 2018–2020; area's stock mostly renovated."         |
| **Integration layer** | Judgment | "Likely renovated 3–7 years ago; not brand-new, but aligns with area trends." |

**The search layer acts as a "reality tether"** — it gives the LLM a grounded baseline for what's normal, so it can rate each claim or photo cue in *context* instead of isolation.

You move from *binary fact-checking* → to *context-weighted reasoning.*

This makes the final **Integrated Diagnostic Analysis** feel like a professional surveyor's narrative — credible, nuanced, and region-aware.

---

## Research Categories Framework

**Purpose:** enrich and contextualize property understanding for the integrated diagnostic analysis  
**Scope:** flexible (works with city/district-level only); uses "knowns" for anchoring and "unknowns" for focus

### 1️⃣ **Local Built-Environment Context**

*What is typical about buildings like this in the area?*

**Search intents:**
- "año construcción edificios [neighborhood or municipality]"
- "rehabilitación edificios [decade] [city]"
- "arquitectura típica [zone]"
- "tipos de vivienda [zone] (apartamento, adosado, ático…)"

**Goal:** give Gemini baselines for age, materials, and condition expectations.

---

### 2️⃣ **Renovation & Maintenance Trends**

*Are similar properties being refurbished? Common issues or costs?*

**Search intents:**
- "reformas [neighborhood or city] [year range]"
- "coste reforma integral piso [size] m² [city]"
- "problemas habituales vivienda [zone] (humedades, fontanería…)"

**Goal:** ground claims like "recently renovated," set typical refurbishment cycles.

---

### 3️⃣ **Regulatory & Zoning Framework**

*What legal or planning constraints shape possible works?*

**Search intents:**
- "PGOU [municipality] vivienda reformas"
- "licencia obra menor mayor [city] requisitos"
- "zonas protegidas [city] / ley de costas [region]"
- "tiempo tramitación licencia obra [city] 2024"

**Goal:** establish renovation friction, permit timelines, protection constraints.

---

### 4️⃣ **Energy & Sustainability Regulations**

*What standards or incentives apply?*

**Search intents:**
- "certificado energético Baleares 2024 obligatorio"
- "subvenciones rehabilitación vivienda [region]"
- "eficiencia energética edificios [city] 2024"

**Goal:** give insight on mandatory certificates, grants, or energy norms.

---

### 5️⃣ **Infrastructure & Utilities**

*What connectivity and service baseline does the area have?*

**Search intents:**
- "fibra óptica cobertura [neighborhood]"
- "abastecimiento agua Calvià incidencias"
- "red eléctrica capacidad viviendas [region]"
- "parking público / garajes [neighborhood]"

**Goal:** inform practical recommendations (e.g., solar, EV charging, smart systems).

---

### 6️⃣ **Environmental & Risk Factors**

*Any physical risks or environmental characteristics to note?*

**Search intents:**
- "mapa de inundabilidad [municipality]"
- "riesgo sísmico Baleares mapa"
- "ruido / contaminación acústica [zone]"
- "orientación solar Portals Nous viviendas"

**Goal:** highlight flood, noise, slope, humidity, or exposure issues.

---

### 7️⃣ **Market & Price Context**

*How does this property's price relate to local norms?*

**Search intents:**
- "precio medio vivienda [neighborhood] €/m²"
- "piso 3 habitaciones [zone] precio actual"
- "histórico precios vivienda [city] 2015-2024"

**Goal:** contextualize valuation claims and affordability.

---

### 8️⃣ **Neighborhood & Livability**

*What is daily life and perception of this area?*

**Search intents:**
- "opiniones barrio [neighborhood] seguridad / ruido / calidad de vida"
- "colegios cercanos [zone]"
- "restaurantes / servicios / transporte público [neighborhood]"

**Goal:** add human-level flavor to the diagnostic narrative.

---

### 9️⃣ **Legal & Administrative Indicators**

*Are there bureaucratic or ownership aspects worth noting?*

**Search intents:**
- "impuesto IBI vivienda [municipality] promedio"
- "registro propiedad Calvià trámites"
- "coste notaría compra vivienda Baleares"

**Goal:** infer recurring fees or procedural friction relevant to buyer experience.

---

### 🔟 **Developer / Community Reputation**

*How reliable are local developers, agents, and communities?*

**Search intents:**
- "opiniones [agency name] inmobiliaria"
- "comunidad propietarios [urbanización or marina name] opiniones"
- "promotora [name] calidad construcción"

**Goal:** strengthen or weaken trust scores behind listing tone.

---

### 11️⃣ **Heritage or Architectural Protection**

*Any design constraints, historical or aesthetic controls?*

**Search intents:**
- "catálogo patrimonio [municipality] viviendas"
- "edificios protegidos [city] listado"
- "restricciones fachada / color / material [zone]"

**Goal:** set boundary for architectural creativity later.

---

### 12️⃣ **Active / Planned Developments Nearby**

*Any construction or infrastructure projects that may affect value?*

**Search intents:**
- "proyectos urbanísticos [municipality] 2024"
- "obras públicas [neighborhood]"
- "nuevo puerto / carretera / centro comercial [city]"

**Goal:** anticipate potential disruption or uplift.

---

### 13️⃣ **Insurance & Safety Considerations**

*Typical risks influencing insurance or maintenance.*

**Search intents:**
- "seguro vivienda Baleares requisitos"
- "daños por humedad edificios costeros"
- "incendios vivienda [city] frecuencia"

**Goal:** link physical condition to insurability and upkeep.

---

### 14️⃣ **Comparables / Reference Properties**

*Reference examples of similar homes in same area or typology.*

**Search intents:**
- "ático reformado [neighborhood] venta"
- "piso lujo Puerto Portals 3 habitaciones"
- "vivienda similar superficie [zone] precio"

**Goal:** let analysis contrast price, finishes, and style clusters.

---

### 15️⃣ **Social / Media Mentions**

*Recent discussions or local news about the area or building type.*

**Search intents:**
- "noticias Puerto Portals vivienda / reforma / licencias"
- "foro burbuja.info Portals Nous"
- "reddit spain Portals Nous property"

**Goal:** detect sentiment or notable events impacting perception.

---

## Implementation Notes

### Dynamic Relevance

For each category, Gemini should generate a query *only if* relevant `unknowns` or `snippets` suggest a gap.

### Flexible Specificity

If you lack exact address, queries should default to `[neighborhood or municipality]` granularity.

### Output Format

```json
{
  "research_queries": [
    "certificado eficiencia energética obligatorio venta España",
    "gastos comunidad IBI promedio piso lujo Calvià Mallorca",
    "normativa Inspección Técnica Edificios ITE obligatorio Calvià",
    "precio metro cuadrado Portals Nous Bendinat mercado actual",
    "riesgos naturales zona costera Calvià inundación incendio"
  ]
}
```

### Query Cap

Max ~10–12 queries per property (prioritize by unknown density and contextual richness).

---

## Summary

This framework ensures that **search grounding** always covers the *full environment of the property* — physical, legal, economic, environmental, and social — yet stays adaptive to how much you actually know and where your "unknowns" point.

The result: **Professional, context-aware diagnostic analysis** that feels like it comes from someone who truly understands both the property and its local environment.

