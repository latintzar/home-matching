# Property Reports & Checklists Design

**Last Updated**: December 2, 2025  
**Status**: Specification for Buyer vs Renter versions

> **📌 See also**: P0_LEAN_APP.md (`./P0_LEAN_APP.md`, historical reference) - Consolidated P0 MVP spec implementing these priorities

---

## 🎯 PRIORITY ORDER (Keep It Tight)

### P0 — VALIDATE FIRST (before building everything)

#### Non-Pro Users (Direct Buyers/Renters)
| # | Validation Point | Metric |
|---|------------------|--------|
| 1 | **Add WhatsApp number** | Do they sign up for alerts? |
| 2 | **Recommendations arrive** | Do they open email/WhatsApp? |
| 3 | **Click property** | Do they go to leo.casa/property/[id]? |
| 4 | **See fit score** | Do they understand why it fits? |
| 5 | **"Quiero verlo"** | Do they click? (→ agent WhatsApp) |
| 6 | **Shortlist** | Do they come back on viewing day? |
| 7 | **Take notes** | Do they actually use note-taking? |
| 8 | **Reassessment** | Do they find updated fit score useful? |

#### Pro Users (Personal Shoppers / Relocation Agents)
| # | Validation Point | Metric |
|---|------------------|--------|
| 1 | **Set up client** | Do they add a new client? |
| 2 | **Intake method** | Do they do call themselves OR send link to client? |
| 3 | **Client lifestyle summary** | Do they find it useful? |
| 4 | **Use extension** | Do they use browser extension to add properties? |
| 5 | **Use our recommendations** | Do they add our recs to client shortlist? |
| 6 | **Send shortlist link** | Do they share with their client? |
| 7 | **Client clicks properties** | Does client engage with shortlist? |
| 8 | **Notes (both sides)** | Do Pro and/or client take notes? |
| 9 | **Post-viewing summary** | Do they use the summary with their client? |

**Success = usage at each step. If people use it, we can refine.**

### P1 — ADD-ONS (after validation)
- **Viewing checklist** → Suggestions of what to ask/check (may be ignored)
- **Negotiation summary** → Post-viewing leverage points

### P2 — FOLLOW-ONS (later focus)
- **Full property report cards** → Detailed breakdowns (Airbnb, Geology, etc.)
- **Renovation/baseline costs** → Habitissimo integration

---

## 👤 "Quiero Verlo" — Different Flows by User Type

### Non-Pro Users (Direct Buyers/Renters)

```
User clicks "Quiero verlo"
        ↓
┌─────────────────────────────────────┐
│  Opens agent's WhatsApp directly    │
│  wa.me/34612345678?text=Hola,...    │
└─────────────────────────────────────┘
        ↓
Property added to user's Shortlist
```

### Pro-User Clients (Personal Shopper / Relocation Agent clients)

```
Client clicks "Quiero verlo"
        ↓
┌─────────────────────────────────────┐
│  Property marked as ⭐ Favorite     │
│  Notification sent to their Pro    │
│  "Tu cliente quiere ver Gran Via"  │
└─────────────────────────────────────┘
        ↓
Pro user sees notification
        ↓
Pro clicks "Contactar agente"
        ↓
┌─────────────────────────────────────┐
│  Opens agent's WhatsApp             │
│  (same experience as non-pro)       │
└─────────────────────────────────────┘
        ↓
Property added to client's Shortlist
```

---

## 📱 User Journey (Simplified P0)

```
1. ALERT         →  Email/WhatsApp with photos + fit scores
2. CLICK         →  leo.casa/property/[id]  
3. FIT SCORE     →  "78% match — Why it fits + Watch out for"
4. QUIERO VERLO  →  WhatsApp to agent (or notify Pro)
5. SHORTLIST     →  Properties they want to view
6. VIEWING DAY   →  Open from shortlist, take notes
7. REASSESS      →  Updated fit score based on notes
```

---

## 📊 What "Analysis" Means for P0

**Analysis = Fit Score + Why** (NOT full 7-card report)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FIT SCORE: 78%  ████████░░                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ✓ POR QUÉ ENCAJA                    ⚠️ A TENER EN CUENTA               │
│                                                                         │
│ • Cerca de trabajo (12 min)         • Gran Via = ruido                 │
│ • 3 habitaciones ✓                  • Necesita reforma                 │
│ • Terraza exterior                  • 1ª planta (bajantes)             │
│ • Precio en rango                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

This comes from WPA + life profile matching. Simple, actionable.

---

## 🔧 Endpoints Needed (P0 only)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/shortlist/add` | Add property to shortlist ("Quiero verlo") |
| `GET /api/shortlist` | Get user's shortlisted properties |
| `POST /api/shortlist/[id]/notify-pro` | Notify pro user that client wants to view |
| `POST /api/viewings/[id]/notes` | Add note during viewing |
| `POST /api/viewings/[id]/complete` | Trigger reassessment |
| `GET /api/viewings/[id]/assessment` | Get updated fit score |

**P2 Endpoints (later):**
- Full analysis cards endpoints
- Checklist generation  
- Renovation/baseline costs

---

## 📝 Renter vs Buyer — Separate Final-Scope

Need a **separate endpoint** for renters (P2):

| Endpoint | Focus |
|----------|-------|
| `/api/listings/[id]/analysis/final-scope` | Buyer: Due diligence, structure, legality |
| `/api/listings/[id]/analysis/final-scope-renter` | Renter: Livability, costs, contract |

**Same structure, different checklist nature.**

---

## Overview

We have two key outputs for users viewing a property:

1. **Verification Checklist** — What to check/ask during viewing (different for buyers vs renters)
2. **Property Report Modal** — Full intelligence from our data sources (cards in a modal)

**Note: These are P1/P2 features. P0 is just fit score + notes.**

---

## 📊 Our ACTUAL Data Sources (P2)

| # | Source | Endpoint/Table | What It ACTUALLY Contains |
|---|--------|----------------|---------------------------|
| 1 | **Cadastral Data** | `text_analysis_results` phase `cadastral_data` | Official year built, official m², usage from Catastro |
| 2 | **Photo Analysis** | `whole_property_analysis` + `room_analyses` + `clusters` | Cross-room themes, room one-liners, condition findings. **Photos available per cluster.** |
| 3 | **Airbnb Radar** | `listings.social_intelligence.social` | Listings within radius, neighbor reviews from Airbnb guests, tourist pressure score |
| 4 | **Geology** | `listings.social_intelligence.geology` via IGME GEODE | Clay risk, flood risk, seismic zone |
| 5 | **Public Tenders** | `listings.social_intelligence.tenders` | Nearby infrastructure works, construction planned |
| 6 | **Double-Barrel Research** | `analysis_curated_results` via `/analysis-google-search` | Curated Google search snippets across 8 Mega-Categories. Used to generate synthesized reports with citations. |
| 7 | **Baseline Costs** | `/renovation/baseline-check` via Habitissimo RAG | €/m² per room type, queried from Vertex AI RAG corpus |
| 8 | **Forensic Risk Audit** | `/analysis/final-scope` | **AI-SYNTHESIZED** 4-pillar risk assessment — Gemini takes ALL inputs and generates narrative analysis |

### What's NOT a Card (Internal Inputs Only)
- **Smart M²** — Infers room sizes, but this is just an INPUT to Baseline Costs calculation
- **B3-Snippets / C-Unknowns** — Used as inputs to other analyses, not shown directly

---

## 🏠 Report Modal — 7 Data Source Cards

### Card 1: Catastro vs Anuncio (Discrepancies)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏛️ CATASTRO VS ANUNCIO                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────┐│
│  │ 📢 ANUNCIADO         │  │ 📜 CATASTRO (OFICIAL)                    ││
│  │                      │  │                                          ││
│  │ Año: 1968            │  │ Año: 1939                                ││
│  │ Tamaño: 120m²        │  │ Sup. construida: 98m²                    ││
│  │ Planta: 1º           │  │ Uso: Vivienda                            ││
│  │                      │  │                                          ││
│  └──────────────────────┘  └──────────────────────────────────────────┘│
│                                                                         │
│  ⚠️ DISCREPANCIAS DETECTADAS                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ • Año: 29 años de diferencia (afecta valoración bancaria)          ││
│  │ • Tamaño: 22m² menos de lo anunciado (18% menos)                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  💡 Esto significa: Pide la Nota Simple para confirmar la realidad     │
│     registral antes de hacer oferta.                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card 2: Análisis Visual (Photos + Room Findings)

**Structure**: Summary → Room-by-Room (scrollable anchors from Costs card)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📸 ANÁLISIS VISUAL                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ RESUMEN GENERAL                                                     ││
│  │                                                                     ││
│  │ Temas transversales detectados:                                     ││
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        ││
│  │ │ 🔧 Reforma │ │ 🕐 Época   │ │ 🔊 Ruido   │ │ 🌅 Luz     │        ││
│  │ │ Integral   │ │ Incierta   │ │ (Gran Via) │ │ Limitada   │        ││
│  │ └────────────┘ └────────────┘ └────────────┘ └────────────┘        ││
│  │                                                                     ││
│  │ "Propiedad con buen potencial pero requiere reforma integral.      ││
│  │  Las instalaciones son de origen, la distribución permite mejoras. ││
│  │  Puntos críticos: ruido exterior y luz limitada en interiores."    ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ────────────────────────────────────────────────────────────────────── │
│                                                                         │
│  HABITACIÓN POR HABITACIÓN                                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🏷️ #salon-comedor                                                   ││
│  │ ── Salón-Comedor (28m²) ────────────────────────────────────────── ││
│  │                                                                     ││
│  │ ┌───────────────────────────────────┐                               ││
│  │ │ [◀] 📷 Photo 1/4 ───────── [▶]  │  Hallazgos:                    ││
│  │ │                                   │  • Salida a balcón exterior   ││
│  │ │    [  Photo Carousel Here  ]     │  • Suelos a sustituir         ││
│  │ │                                   │  • Exposición directa Gran Via││
│  │ │                                   │                               ││
│  │ └───────────────────────────────────┘  💰 Coste: €12,600 (27%)      ││
│  │                                        ❓ Verificar: struct. balcón  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🏷️ #cocina                                                          ││
│  │ ── Cocina (10m²) ─────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │ ┌───────────────────────────────────┐                               ││
│  │ │ [◀] 📷 Photo 1/3 ───────── [▶]  │  Hallazgos:                    ││
│  │ │                                   │  • Amplia con salida a patio  ││
│  │ │    [  Photo Carousel Here  ]     │  • Instalaciones obsoletas    ││
│  │ │                                   │  • Posible apertura al salón  ││
│  │ │                                   │                               ││
│  │ └───────────────────────────────────┘  💰 Coste: €9,500 (21%)       ││
│  │                                        ❓ Verificar: ubic. bajantes  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  [... más habitaciones con el mismo patrón ...]                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Scroll anchors**: When user taps a room in Costs card, scrolls to `#salon-comedor`, `#cocina`, etc.

### Card 3: Airbnb Radar (with Logo)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Airbnb Logo] AIRBNB RADAR                         Presión Turística  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Nivel de Saturación: ███████████░░░░░░░░░  ALTA                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │   [Mapa con puntos de Airbnbs cercanos]                             ││
│  │                                                                     ││
│  │   🔴 = Tu propiedad                                                 ││
│  │   ⚪ = Airbnbs activos (18 en 200m)                                 ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  📊 18 alojamientos en 200m • Rating medio: 4.5★                       │
│                                                                         │
│  👀 Lo que dicen los huéspedes del barrio:                             │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ⚠️ "Había obras en el piso de al lado, muy ruidoso                    │
│      desde primera hora de la mañana..."                                │
│      — Review Airbnb, Mayo 2025                                         │
│                                                                         │
│  ⚠️ "Olor muy fuerte del baño, sobre todo en el                        │
│      dormitorio delantero..."                                           │
│      — Review Airbnb, Dic 2024                                          │
│                                                                         │
│  💡 Riesgo oculto detectado: Posibles problemas de fontanería          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card 4: Geología (IGME GEODE)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌍 GEOLOGÍA                                               IGME GEODE  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ 🧱 Arcilla     │  │ 🌊 Inundación  │  │ 📈 Sísmico    │            │
│  │                │  │                │  │                │            │
│  │  ✅ Sin riesgo │  │  ✅ Sin riesgo │  │  Bajo (BCN)   │            │
│  │                │  │                │  │                │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                         │
│  Tipo de suelo: Cuaternario aluvial                                     │
│                                                                         │
│  💡 Esto significa: No hay riesgos geológicos especiales.              │
│     Cimentación estándar sin precauciones extra.                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card 5: Obras Públicas (Tenders)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🚧 OBRAS PÚBLICAS CERCANAS                           Licitaciones     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ✅ Sin obras activas encontradas                                       │
│     (Revisados 412 contratos recientes para Gran Via de les Corts)      │
│                                                                         │
│  💡 Esto significa: No hay grandes obras de infraestructura previstas   │
│     que puedan causar ruido, polvo o cortes de tráfico durante tu reno. │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Card 6: Investigación Curada — Report Format with Citations

**This is the key card: A proper REPORT, not just snippets.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 INFORME DE INVESTIGACIÓN                                           │
│      (8 categorías • 47 búsquedas • 156 fuentes curadas)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ══════════════════════════════════════════════════════════════════════ │
│  ESTRUCTURA Y PATOLOGÍA                                                 │
│  ══════════════════════════════════════════════════════════════════════ │
│                                                                         │
│  Los edificios construidos en Barcelona entre 1950 y 1970 presentan     │
│  un riesgo elevado de aluminosis, un defecto estructural que requiere   │
│  inspección técnica obligatoria [1]. La discrepancia entre el año       │
│  anunciado (1968) y el año catastral del bloque (1939) genera           │
│  incertidumbre sobre los materiales de construcción utilizados [2].     │
│                                                                         │
│  En Barcelona, la ITE (Inspección Técnica de Edificios) es obligatoria  │
│  para edificios de más de 45 años [3]. Si el edificio no ha pasado      │
│  la ITE, esto representa un riesgo tanto legal como estructural.        │
│                                                                         │
│  Referencias:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [1] [🌐] "Aluminosis en edificios de Barcelona"                     ││
│  │         elperiodico.com • Credibilidad: ⭐⭐⭐⭐                       ││
│  │                                                                     ││
│  │ [2] [🌐] "Diferencias entre año catastral y real"                   ││
│  │         notariosyregistradores.com • Credibilidad: ⭐⭐⭐⭐⭐          ││
│  │                                                                     ││
│  │ [3] [🌐] "ITE Barcelona: Plazos y requisitos 2024"                  ││
│  │         ajuntament.barcelona.cat • Credibilidad: ⭐⭐⭐⭐⭐            ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ══════════════════════════════════════════════════════════════════════ │
│  COSTES Y PERMISOS                                                      │
│  ══════════════════════════════════════════════════════════════════════ │
│                                                                         │
│  El precio medio de una reforma integral en Barcelona oscila entre      │
│  800€ y 1.200€ por metro cuadrado, según calidades [1]. Para una        │
│  vivienda de ~100m², esto supone un presupuesto de 80.000€ a 120.000€.  │
│                                                                         │
│  La licencia de obra mayor para reforma integral tiene un coste         │
│  aproximado del 4% del presupuesto de ejecución material, más tasas     │
│  municipales [2]. El plazo de tramitación en Barcelona es de 2-4 meses  │
│  actualmente [3].                                                       │
│                                                                         │
│  Referencias:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [1] [🏠] "Precios reforma integral Barcelona 2024"                  ││
│  │         habitissimo.es • Credibilidad: ⭐⭐⭐⭐                        ││
│  │                                                                     ││
│  │ [2] [🌐] "Tasas licencia obra mayor Barcelona"                      ││
│  │         ajuntament.barcelona.cat • Credibilidad: ⭐⭐⭐⭐⭐            ││
│  │                                                                     ││
│  │ [3] [🌐] "Plazos licencias urbanísticas BCN"                        ││
│  │         coac.net • Credibilidad: ⭐⭐⭐⭐                              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  [... 6 categorías más con el mismo formato ...]                       │
│                                                                         │
│  Categorías: ESTRUCTURA_PATOLOGIA • COSTES_PERMISOS • ZONA_EDIFICIO •  │
│  INSTALACIONES • EFICIENCIA_ENERGIA • COMUNIDAD_LEGAL • MERCADO_PRECIO │
│  • URBANISMO_EXTERIOR                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Each category is a **mini-report with narrative text**
- **Inline citations** [1], [2], [3] reference the bibliography
- **Bibliography per category** with favicon, source URL, credibility score
- **Favicon** shows site identity (🌐 = generic, 🏠 = Habitissimo, etc.)

### Card 7: Costes Base (Habitissimo with Logo)

**Interaction**: Tap any room row → scrolls to that room's Photo Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Habitissimo Logo] COSTES BASE REFORMA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Presupuesto por estancia (tap para ver análisis):                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷] Salón-Comedor  │  28m² │  450€/m² │  12.600€  │ ▓▓▓▓▓▓▓░ 27% → ││
│  │ [📷] Dormitorio 1   │  14m² │  350€/m² │   4.900€  │ ▓▓▓░░░░░ 11% → ││
│  │ [📷] Dormitorio 2   │  12m² │  350€/m² │   4.200€  │ ▓▓▓░░░░░  9% → ││
│  │ [📷] Cocina         │  10m² │  950€/m² │   9.500€  │ ▓▓▓▓▓░░░ 21% → ││
│  │ [📷] Baño 1         │   5m² │ 1100€/m² │   5.500€  │ ▓▓▓▓░░░░ 12% → ││
│  │ [📷] Baño 2         │   4m² │ 1100€/m² │   4.400€  │ ▓▓▓░░░░░ 10% → ││
│  │ [📷] Pasillo        │  25m² │  200€/m² │   5.000€  │ ▓▓▓░░░░░ 11% → ││
│  │────────────────────────────────────────────────────────────────────││
│  │      TOTAL          │  98m² │  ~470€/m²│  46.100€  │                ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ⚠️ Este es el coste "duro" — materiales + mano de obra estándar.     │
│     No incluye: diseño, permisos, imprevistos (+15-20%), ni calidades  │
│     premium.                                                            │
│                                                                         │
│  📊 Fuente: Precios reales de Habitissimo (corpus RAG 2024)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Room row interaction**:
- `[📷]` = Thumbnail from cluster photo
- `→` = Tap to scroll to Photo Analysis for this room
- `%` bar = Percentage of total renovation budget

---

## ✅ Verification Checklist — Mobile-First UX

### Design Principles

1. **Mobile-first** — Used during viewing on phone, one-handed
2. **Two types of items**:
   - 🗣️ **ASK THE AGENT** — Questions to ask (agents only respond during viewings!)
   - 👀 **CHECK YOURSELF** — Physical inspection, with photos showing WHERE to look
3. **Note-taking = checking off** — Swipe right to reply with note (text/voice/photo). Once noted, item is checked.
4. **Room linking** — Tap room in Costs card → scrolls to Photo Analysis for that room

### Mobile Checklist UI — "Reply to Message" Pattern

The checklist works like a **chat thread** — each item is a "message" you can **swipe right to reply** with your notes. Once you've added any note, the item is checked off.

```
┌─────────────────────────────────────────────┐
│ ← Checklist                    Gran Via 42  │
├─────────────────────────────────────────────┤
│                                             │
│  🗣️ PREGUNTAR AL AGENTE                    │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ ○  Año real de construcción             ││
│  │    "¿Es de 1939 o de 1968?"             ││
│  │    ⚠️ Catastro dice 1939, anuncio 1968  ││
│  │                                         ││
│  │              ← swipe to reply           ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ ●  ITE del edificio          ✓ noted    ││
│  │    "¿Tiene el edificio la ITE pasada?"  ││
│  │    ┌───────────────────────────────┐    ││
│  │    │ 💬 "Dice que sí pero no tiene │    ││
│  │    │     el papel, lo va a enviar" │    ││
│  │    └───────────────────────────────┘    ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ ●  Estado de los bajantes    ✓ noted    ││
│  │    "¿Se han cambiado los bajantes?"     ││
│  │    ┌───────────────────────────────┐    ││
│  │    │ 🎤 0:08 ▶️                     │    ││
│  │    └───────────────────────────────┘    ││
│  └─────────────────────────────────────────┘│
│                                             │
│                                             │
│  👀 COMPROBAR TÚ MISMO                      │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ ○  Nivel de ruido                       ││
│  │    Abre ventanas 2 min, escucha         ││
│  │    ──────────────────────────           ││
│  │    📍 Salón → [tap to see room]         ││
│  │    ┌─────────────────────┐              ││
│  │    │ [Foto del salón]    │              ││
│  │    └─────────────────────┘              ││
│  │              ← swipe to reply           ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ ●  Presión de agua           ✓ noted    ││
│  │    📍 Baño 1 → [tap to see room]        ││
│  │    ┌───────────────────────────────┐    ││
│  │    │ 📷 [Photo taken]              │    ││
│  │    │ 💬 "Bastante baja, tarda"     │    ││
│  │    └───────────────────────────────┘    ││
│  └─────────────────────────────────────────┘│
│                                             │
├─────────────────────────────────────────────┤
│  Apuntado: 4/9  ████████░░░░░░░░░ 44%      │
│                                             │
│  [Generar resumen]                          │
└─────────────────────────────────────────────┘
```

### Note-Taking Interaction

| Gesture | What Happens |
|---------|--------------|
| **Swipe right** | Opens reply input for that item (like WhatsApp) |
| **Tap mic** | Record voice note |
| **Tap camera** | Take photo that attaches to item |
| **Type** | Text note |
| **Tap room link** | Scrolls to room-by-room analysis in report |

**Key insight**: No "problem/OK" buttons. Just take notes. The AI figures out what's a problem when generating the summary.

### During Viewing: Note-Taking Flow

Notes work like a **chat thread** — some attached to checklist items, some free-form:

```
┌─────────────────────────────────────────────┐
│ ← Viewing Notes              Gran Via 42    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Re: ITE del edificio                  │  │
│  │ 💬 "Dice que sí pero lo va a enviar"  │  │
│  │                              10:34 AM │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 📷 [Photo of ceiling crack]           │  │
│  │                              10:36 AM │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 💬 "Vecina del 2º muy maja, dice que  │  │
│  │     el presidente es un pesado"       │  │
│  │                              10:38 AM │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Re: Nivel de ruido                    │  │
│  │ 🎤 0:12 ▶️                             │  │
│  │                              10:41 AM │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 💬 "El baño pequeño huele raro"       │  │
│  │                              10:45 AM │  │
│  └───────────────────────────────────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│  [📷] [🎤] [💬 Type a note...]              │
│                                             │
│  ────────────────────────────────────────── │
│  [✓ Viewing Complete — Analyze Notes]       │
└─────────────────────────────────────────────┘
```

**Note types**:
- `Re: [item]` — Reply to checklist item (swipe right)
- Free-form — Just observations, no attachment
- All are timestamped and sent immediately

---

### "Viewing Complete" → Triggers Reassessment

When user taps **"Viewing Complete"**, system:

1. **Analyzes ALL notes** (attached + free-form)
2. **Transcribes voice notes** → text
3. **Analyzes photos** (cracks, mold, condition)
4. **Cross-references with original checklist**
5. **Updates property assessment** based on findings

```
┌─────────────────────────────────────────────┐
│ 🔄 Analizando notas de la visita...         │
│                                             │
│    ████████████░░░░░░░░  60%                │
│                                             │
│    ✓ 8 notas de texto                       │
│    ✓ 2 notas de voz transcritas             │
│    ✓ 3 fotos analizadas                     │
│    ○ Actualizando valoración...             │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Post-Viewing: Updated Assessment

```
┌─────────────────────────────────────────────┐
│ 📊 VALORACIÓN ACTUALIZADA                   │
│    Gran Via 42, El Fort Pienc               │
├─────────────────────────────────────────────┤
│                                             │
│  FIT SCORE ACTUALIZADO                      │
│                                             │
│  Antes:  ████████░░ 78% "Muy buen encaje"   │
│  Ahora:  ██████░░░░ 62% "Encaje con dudas"  │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  📉 BAJÓ POR:                               │
│                                             │
│  • Ruido peor de lo esperado (-10%)         │
│    "Nivel muy alto incluso con ventanas     │
│     cerradas" — tu nota de voz              │
│                                             │
│  • Grieta detectada en techo (-6%)          │
│    [📷 tu foto] → Posible problema          │
│    estructural, requiere inspección         │
│                                             │
│  📈 CONFIRMADO OK:                          │
│                                             │
│  • Luz natural: Mejor de lo que parecía     │
│  • Vecindario: Buenos comentarios           │
│  • Presión agua: Aceptable                  │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  ❓ AÚN SIN VERIFICAR (3 items):            │
│                                             │
│  • ITE del edificio (prometieron enviar)    │
│  • Actas de comunidad                       │
│  • M² reales con medidor                    │
│                                             │
│  [Ver checklist restante]                   │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  💡 RECOMENDACIÓN                           │
│                                             │
│  "Vale la pena seguir, pero negocia fuerte  │
│   el precio por el ruido y pide inspección  │
│   de la grieta antes de ofertar."           │
│                                             │
│  [📋 Generar resumen para negociar]         │
│  [📧 Enviar preguntas pendientes al agente] │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Negotiation Summary (Shareable)

```
┌─────────────────────────────────────────────┐
│ 📋 RESUMEN PARA NEGOCIAR                    │
├─────────────────────────────────────────────┤
│                                             │
│ ⚠️ Puntos a negociar (3):                   │
│                                             │
│ 1. Ruido Gran Via                           │
│    → Presupuestar +€8k en carpintería       │
│    → Justifica reducción de -€5k-€10k       │
│                                             │
│ 2. Grieta techo salón                       │
│    → Exigir informe técnico antes de oferta │
│    → Si estructural: renegociar o descartar │
│                                             │
│ 3. ITE pendiente                            │
│    → No ofertar hasta recibir documentación │
│                                             │
│ ✅ A tu favor (2):                          │
│                                             │
│ • Piso lleva 3 meses en mercado             │
│ • Propietario tiene prisa (comentario       │
│   vecina)                                   │
│                                             │
│ 💰 OFERTA SUGERIDA                          │
│                                             │
│    Piden: €285,000                          │
│    Sugerir: €255,000 - €265,000             │
│    (-7% a -11% sobre asking)                │
│                                             │
│ [Copiar para WhatsApp] [Enviar por email]   │
└─────────────────────────────────────────────┘
```

---

## 🔄 Component Reuse Strategy (MVP)

**CRITICAL FOR MVP:** The note-taking experience is THE SAME for:
- Direct renters/buyers
- Pro clients (when they're viewing properties)

**Why:** Keep it limber. One codebase, one set of components.

**Implementation:**
- Note-taking interface → same component for both user types
- Notes display → same component for everyone  
- Reassessment display → same component for everyone
- Only difference: Pro clients' notes linked to `client_id` in DB
- Pro can view via: `/pro/clients/[id]/viewings/[listing_id]` (read-only mode)

**Pro viewing client notes:**
- Uses SAME component as client used
- Just in read-only mode
- Same design, same layout, same UX
- No separate "pro view" — just the same component

---

## 🔌 API Endpoints for Viewing Flow

### Database: `viewings` table

```sql
CREATE TABLE viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  listing_id BIGINT REFERENCES listings(id),
  
  -- Viewing state
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'analyzed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Pre-viewing data (snapshot)
  original_fit_score INTEGER,
  original_checklist JSONB, -- The checklist items generated for this property
  
  -- Post-viewing analysis
  updated_fit_score INTEGER,
  score_changes JSONB, -- { ruido: -10, grieta: -6, luz: +3 }
  uncovered_items TEXT[], -- Checklist items not addressed
  ai_recommendation TEXT,
  negotiation_summary JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE viewing_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_id UUID REFERENCES viewings(id) ON DELETE CASCADE,
  
  -- Note content
  note_type TEXT NOT NULL, -- 'text', 'voice', 'photo'
  content TEXT, -- Text content or transcription
  media_url TEXT, -- URL to voice/photo in storage
  
  -- Optional attachment to checklist item
  checklist_item_id TEXT, -- e.g., 'ite-edificio', 'nivel-ruido'
  
  -- Timestamps
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Post-analysis fields (filled after "Viewing Complete")
  transcription TEXT, -- For voice notes
  photo_analysis JSONB, -- Gemini vision output
  sentiment TEXT, -- 'positive', 'negative', 'neutral', 'concern'
  extracted_facts TEXT[] -- Key facts extracted by AI
);
```

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/viewings` | Start a viewing session |
| `GET` | `/api/viewings/[id]` | Get viewing state + notes |
| `POST` | `/api/viewings/[id]/notes` | Add a note (text/voice/photo) |
| `POST` | `/api/viewings/[id]/complete` | Trigger analysis pipeline |
| `GET` | `/api/viewings/[id]/assessment` | Get updated assessment |
| `POST` | `/api/viewings/[id]/share` | Generate shareable summary |

### `POST /api/viewings` — Start Viewing

```typescript
// Request
{
  listing_id: 1000000003
}

// Response
{
  viewing_id: "uuid",
  checklist: [...], // Generated checklist for this property
  original_fit_score: 78
}
```

### `POST /api/viewings/[id]/notes` — Add Note

```typescript
// Request (text)
{
  note_type: "text",
  content: "Vecina dice que el presidente es un pesado",
  checklist_item_id: null // free-form
}

// Request (voice)
{
  note_type: "voice",
  media_url: "supabase-storage-url",
  checklist_item_id: "nivel-ruido" // attached to item
}

// Request (photo)
{
  note_type: "photo",
  media_url: "supabase-storage-url",
  content: "Grieta en techo del salón" // optional caption
}

// Response
{
  note_id: "uuid",
  recorded_at: "2024-12-01T10:34:00Z"
}
```

### `POST /api/viewings/[id]/complete` — Trigger Analysis

This is the heavy endpoint that:
1. Transcribes all voice notes (Whisper API)
2. Analyzes all photos (Gemini Vision)
3. Extracts facts from all notes
4. Cross-references with checklist
5. Calculates updated fit score
6. Generates recommendation + negotiation summary

```typescript
// Request
{} // No body needed

// Response (async - returns immediately, polls for status)
{
  status: "analyzing",
  estimated_seconds: 30
}

// Or if using streaming:
// Stream updates as each step completes
```

### `GET /api/viewings/[id]/assessment` — Get Results

```typescript
// Response
{
  status: "analyzed",
  
  fit_score: {
    original: 78,
    updated: 62,
    change: -16,
    verdict: "Encaje con dudas"
  },
  
  score_changes: [
    { factor: "ruido", change: -10, evidence: "Nota de voz: muy alto..." },
    { factor: "grieta", change: -6, evidence: "Foto analizada: posible estructural" },
    { factor: "luz", change: +3, evidence: "Mejor de lo esperado" }
  ],
  
  confirmed_ok: [
    "Presión agua",
    "Luz natural",
    "Vecindario"
  ],
  
  uncovered_items: [
    { id: "ite-edificio", reason: "Prometieron enviar" },
    { id: "actas-comunidad", reason: "No verificado" },
    { id: "m2-reales", reason: "No medido" }
  ],
  
  recommendation: {
    verdict: "proceed_with_caution",
    summary: "Vale la pena seguir, pero negocia fuerte...",
    next_steps: [
      "Pedir informe técnico de la grieta",
      "No ofertar hasta recibir ITE",
      "Presupuestar carpintería para ruido"
    ]
  },
  
  negotiation: {
    leverage_against: [...],
    leverage_for: [...],
    suggested_offer: { min: 255000, max: 265000, asking: 285000 }
  }
}
```

---

## 📱 Mobile UX — Progressive Disclosure

**Key principle**: During viewing = minimal. After viewing = detailed.

### During Viewing (Minimal Mode)

```
┌─────────────────────────────────────────────┐
│ ← Gran Via 42                    [Checklist]│
├─────────────────────────────────────────────┤
│                                             │
│  [Your notes appear here as you add them]   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 💬 "ITE - dice que lo envía"         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 📷 [Grieta techo]                     │  │
│  └───────────────────────────────────────┘  │
│                                             │
│                                             │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  [📷] [🎤] [💬 Add note...]                 │
│                                             │
│  [Checklist (5 left)] [✓ Done with viewing] │
└─────────────────────────────────────────────┘
```

**What's hidden during viewing:**
- No fit scores
- No analysis
- No recommendations
- Just note-taking + checklist access

### After Viewing (Progressive Cards)

Each section is a **collapsed card** that expands on tap:

```
┌─────────────────────────────────────────────┐
│ 📊 RESUMEN DE LA VISITA                     │
│    Gran Via 42                              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 📉 Fit Score: 78% → 62%          [v] │  │
│  │    "Encaje con dudas"                 │  │
│  └───────────────────────────────────────┘  │
│           ↓ tap to expand                   │
│  ┌───────────────────────────────────────┐  │
│  │ Bajó por:                             │  │
│  │ • Ruido (-10%)                        │  │
│  │ • Grieta detectada (-6%)              │  │
│  │                                       │  │
│  │ OK confirmado:                        │  │
│  │ • Luz, agua, vecindario               │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ ❓ Sin verificar (3 items)        [>] │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 💰 Qué negociar                   [>] │  │
│  │    3 puntos a tu favor                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 💡 Oferta sugerida                [>] │  │
│  │    €255k - €265k (vs €285k)           │  │
│  └───────────────────────────────────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│  [📤 Compartir resumen]                     │
└─────────────────────────────────────────────┘
```

**Progressive disclosure rules:**
1. Summary card always expanded first
2. Other cards show 1-line preview
3. Tap to expand full content
4. Most important info visible without scrolling

---

## 🎓 First-Time Onboarding Walkthrough

### Pattern: "Coach Marks" with Real Data

Uses their **actual property data** with an overlay tutorial.

### Implementation

```tsx
// Use react-joyride or custom Framer Motion implementation

const ONBOARDING_STEPS = [
  {
    target: '.checklist-section',
    content: 'Este es tu checklist para la visita. Cosas que preguntar y comprobar.',
    placement: 'bottom'
  },
  {
    target: '.checklist-item',
    content: 'Desliza a la derecha en cualquier item para añadir una nota.',
    placement: 'right',
    spotlightClicks: true, // Let them try it
    showSwipeAnimation: true
  },
  {
    target: '.note-input',
    content: 'O simplemente escribe, graba o haz una foto de lo que veas.',
    placement: 'top'
  },
  {
    target: '.complete-button',
    content: 'Cuando termines la visita, pulsa aquí y analizaremos todo.',
    placement: 'top'
  }
];
```

### Visual Flow

```
┌─────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░┌───────────────────────────────┐░░░░░ │
│ ░░░░│ ○  ITE del edificio           │░░░░░ │  ← SPOTLIGHT
│ ░░░░│    "¿Tiene la ITE pasada?"    │░░░░░ │
│ ░░░░│         ← ← ← 👆              │░░░░░ │  ← SWIPE ANIMATION
│ ░░░░└───────────────────────────────┘░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Desliza a la derecha para             │  │
│  │ añadir una nota sobre este punto      │  │
│  │                                       │  │
│  │              [Siguiente →]  [Saltar]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### Steps

| Step | Spotlight | Action | Animation |
|------|-----------|--------|-----------|
| 1 | Checklist section | "Tu checklist para la visita" | Pulse |
| 2 | First checklist item | "Desliza para añadir nota" | Swipe hand gesture |
| 3 | Note input area | "O escribe/graba lo que quieras" | Keyboard rise |
| 4 | Complete button | "Cuando termines, pulsa aquí" | Pulse |

### Persistence

```typescript
// Track in user preferences
{
  onboarding_completed: {
    viewing_flow: true,
    report_cards: false,
    // ...
  }
}
```

### "Try It" Step

Step 2 should let them **actually try** the swipe:

```
┌───────────────────────────────────────┐
│ ¡Perfecto! Has añadido tu primera     │
│ nota. Así de fácil.                   │
│                                       │
│ [Continuar →]                         │
└───────────────────────────────────────┘
```

---

## 📋 BUYER Checklist — Mobile

### 🗣️ PREGUNTAR AL AGENTE

| # | Pregunta | Por qué importa |
|---|----------|-----------------|
| 1 | "¿El edificio tiene la ITE pasada?" | Obligatoria >45 años, detecta aluminosis |
| 2 | "¿Hay derramas aprobadas o previstas?" | Pueden ser €5k-€15k de sorpresa |
| 3 | "¿Se han cambiado los bajantes?" | En 1ª planta, crítico |
| 4 | "¿Cuál es la cuota de comunidad?" | Coste mensual oculto |
| 5 | "¿Por qué venden?" | Detectar urgencia/problemas |

### 👀 COMPROBAR TÚ MISMO

| # | Qué comprobar | Dónde (con foto) | Cómo |
|---|---------------|------------------|------|
| 1 | Nivel de ruido | Salón (ventana calle) | Abre ventana 2 min, hora punta |
| 2 | Luz natural | Dormitorios interiores | ¿Llega luz al fondo? |
| 3 | Humedad/manchas | Techos baños y cocina | Mira esquinas y juntas |
| 4 | Presión agua | Baño principal | Abre todo a la vez |
| 5 | Instalación eléctrica | Cuadro eléctrico | ¿Automáticos o plomos? |
| 6 | M² reales | Todas las estancias | Medidor láser |

---

## 📋 RENTER Checklist — Mobile

### 🗣️ PREGUNTAR AL AGENTE/PROPIETARIO

| # | Pregunta | Por qué importa |
|---|----------|-----------------|
| 1 | "¿Por qué se va el inquilino actual?" | Detectar problemas ocultos |
| 2 | "¿Qué incluye el alquiler?" | Agua, luz, gas, internet, comunidad |
| 3 | "¿Quién paga la calefacción/AC?" | Puede doblar tu gasto mensual |
| 4 | "¿Cuántos meses de fianza?" | 1-2 meses + aval? |
| 5 | "¿Tiene cédula de habitabilidad?" | Necesaria para empadronarte |
| 6 | "¿Se permiten mascotas?" | Si aplica |
| 7 | "¿A quién llamo si algo se rompe?" | Tiempo de respuesta del casero |

### 👀 COMPROBAR TÚ MISMO

| # | Qué comprobar | Dónde (con foto) | Cómo |
|---|---------------|------------------|------|
| 1 | Nivel de ruido | Dormitorio (ventana) | Abre ventana, escucha 2 min |
| 2 | Luz natural | Salón y dormitorios | ¿Exterior o patio oscuro? |
| 3 | Olores | Baños | Olfatea humedad, moho |
| 4 | Presión agua | Ducha | Abre ducha + WC + cocina |
| 5 | Agua caliente | Ducha | ¿Cuánto tarda en calentar? |
| 6 | Electrodomésticos | Cocina | Nevera fría, fuegos encienden |
| 7 | Ventanas | Todas | ¿Cierran bien? ¿Corrientes? |
| 8 | Señal móvil | Todas las habitaciones | Comprueba tu 4G/5G |
| 9 | Calefacción/AC | Radiadores o splits | ¿Funcionan? |

### 📸 HAZ FOTOS DE TODO

Al firmar contrato, documenta:
- Estado de paredes, suelos, techos
- Electrodomésticos (modelo, estado)
- Contadores (luz, gas, agua)
- Cualquier desperfecto existente

---

## Diferencias Clave: Buyer vs Renter Checklist

| Aspecto | Comprador | Inquilino |
|---------|-----------|-----------|
| **Objetivo** | Detectar vicios ocultos, negociar precio | Vivir cómodo, evitar sorpresas |
| **Preguntas agente** | ITE, derramas, bajantes, cargas | Por qué se va, qué incluye, fianza |
| **Comprobaciones** | Estructura, instalaciones, m² | Vibe, funcionalidad, costes |
| **Fotos** | Evidencia para negociar | Protección de fianza |
| **Post-visita** | Resumen para oferta | Comparar con otros pisos |

---

## 📋 Summary: 7 Report Cards

| # | Card Name | Data Source | Logo/Favicon |
|---|-----------|-------------|--------------|
| 1 | Catastro vs Anuncio | `cadastral_data` | Gobierno España logo |
| 2 | Análisis Visual | `whole_property_analysis` + `clusters` | — |
| 3 | Airbnb Radar | `social_intelligence.social` | **Airbnb logo** |
| 4 | Geología | `social_intelligence.geology` | IGME logo |
| 5 | Obras Públicas | `social_intelligence.tenders` | — |
| 6 | Informe Investigación | `analysis_curated_results` | **Favicon per source** in bibliography |
| 7 | Costes Base | `baseline_check` | **Habitissimo logo** |

**NOT a card:**
- Smart M² (just an input to Baseline Costs calculation)

---

## UI Notes: Logos & Favicons

### Where to Show Logos

| Element | Logo Treatment |
|---------|----------------|
| **Airbnb Radar card** | Airbnb logo in header |
| **Habitissimo card** | Habitissimo logo in header |
| **Research bibliography** | Favicon for each source URL |
| **Catastro card** | Gobierno/Catastro logo (optional) |
| **IGME Geology** | IGME logo (optional) |

### Favicon Implementation

For the Double-Barrel research bibliography:
```
[favicon] "Article Title"
         domain.com • Credibility: ⭐⭐⭐⭐
```

Use: `https://www.google.com/s2/favicons?domain={domain}&sz=32`

---

## Changelog

| Date | Change |
|------|--------|
| Dec 1, 2024 | Initial spec |
| Dec 1, 2024 | Removed Smart M² as card (just an input to Baseline Costs) |
| Dec 1, 2024 | Redesigned Double-Barrel as report with inline citations + bibliography per category |
| Dec 1, 2024 | Added Airbnb logo, Habitissimo logo, favicon guidance |
| Dec 1, 2024 | Removed Auditoría de Riesgos (not needed, checklist is what matters) |
| Dec 1, 2024 | **Mobile-first checklist redesign**: |
|             | — Split into 🗣️ ASK AGENT vs 👀 CHECK YOURSELF |
|             | — Added room photos as "where to look" guidance |
|             | — "Swipe to reply" pattern (like WhatsApp) for note-taking |
|             | — No ✓/✗ buttons — just take notes, AI figures out problems |
|             | — Post-viewing "Generate summary for negotiation" |
| Dec 1, 2024 | **Room linking & per-room costs**: |
|             | — Costs card shows cost breakdown per room |
|             | — Tap room in Costs → scrolls to Photo Analysis section |
|             | — Photo Analysis now has anchors for each room |
|             | — Each room shows: carousel + findings + cost + verify items |
| Dec 1, 2024 | **Complete viewing flow with reassessment**: |
|             | — Notes: attached to items OR free-form observations |
|             | — "Viewing Complete" button triggers analysis |
|             | — System analyzes all notes (text + voice + photos) |
|             | — Updates Fit Score based on findings |
|             | — Shows "Still to verify" remaining items |
|             | — Generates shareable negotiation summary |
| Dec 1, 2024 | **API Endpoints + DB Schema**: |
|             | — `viewings` table + `viewing_notes` table |
|             | — POST /viewings, /notes, /complete, /share |
|             | — GET /assessment for results |
| Dec 1, 2024 | **Mobile UX - Progressive Disclosure**: |
|             | — During viewing: minimal (just notes + checklist) |
|             | — After viewing: collapsed cards, tap to expand |
|             | — Most important info visible without scrolling |
| Dec 1, 2024 | **First-Time Onboarding Walkthrough**: |
|             | — Coach marks pattern with real data |
|             | — Spotlight + tooltip on each element |
|             | — Swipe animation to teach gesture |
|             | — "Try it" step lets them actually do it |
| Dec 1, 2024 | **REPRIORITIZED — P0/P1/P2 structure**: |
|             | — P0: Fit score + shortlist + notes + reassessment |
|             | — P1: Viewing checklist (add-on, may be ignored) |
|             | — P2: Full report cards, renovation costs |
| Dec 1, 2024 | **"Quiero verlo" different flows**: |
|             | — Non-pro: Opens agent WhatsApp directly |
|             | — Pro-client: Favorites + notifies their Pro |
| Dec 1, 2024 | **Renter vs Buyer**: |
|             | — Separate final-scope-renter endpoint needed |
|             | — Same structure, different checklist nature |
| Dec 1, 2024 | **Validation metrics by user type**: |
|             | — Non-pro: WhatsApp signup → clicks → notes |
|             | — Pro: Client setup → intake → extension → shortlist → notes |
