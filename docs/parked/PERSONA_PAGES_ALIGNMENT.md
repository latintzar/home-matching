# Persona Pages Alignment Plan

## Executive Summary

The **Renters page** has reached a high level of visual communication. The other personas (Buyers, Relocation, Buyer Agents) need to be elevated to the same standard.

### What Makes Renters Good
1. **Integrated vignettes** in "How it Works" — each step shows a UI mockup
2. **Checklist visuals** — each category shows HOW Leo analyzes (isochrones, AI boxes, research flow)
3. **Narrative sections** — life stages with pause/reactivate, listing vs reality
4. **Gemini-generated images** — authentic lifestyle photos, not stock
5. **Unified color palette** — stone/emerald/amber/indigo

### What Others Need
| Page | Vignettes | Checklist Visuals | Narrative Section | Generated Images |
|------|-----------|-------------------|-------------------|------------------|
| Buyers | ❌ Missing | ❌ Missing | ⚠️ Partial | ❌ Need 8 images |
| Relocation | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Need 6 images |
| Buyer Agents | ❌ Missing | ❌ Missing | ⚠️ Partial | ❌ Need 5 images |

### Effort Estimate
- **React components**: ~3-4 days (vignettes, adapted checklist visuals)
- **Image generation**: ~2 hours (19 images, batch generate + optimize)
- **Copy updates**: ~1 day
- **Integration + polish**: ~2 days

### Reusable Assets
| Asset | Location | Reusable For |
|-------|----------|--------------|
| `IsochroneVisual` | `ChecklistVisuals.tsx` | All (configure zones) |
| `MapPinsVisual` | `ChecklistVisuals.tsx` | All (configure POIs) |
| `ImageRecognitionVisual` | `ChecklistVisuals.tsx` | All (same AI overlay) |
| `InvestigationVisual` | `ChecklistVisuals.tsx` | All (configure research items) |
| `ListingVsRealityMockup` | `CompactVignettes.tsx` | Buyers, Agents |
| `VignetteLeoAsks` | `CompactVignettes.tsx` | All (voice/chat works for all) |
| `VignettePropertyMatch` | `CompactVignettes.tsx` | All (property card works for all) |
| `VignetteFeedbackLoop` | `CompactVignettes.tsx` | All (feedback works for all) |
| `LifeStagesCinematic` | `LifeStagesVisual.tsx` | Buyers (different images) |
| `PauseSearchCard` | `LifeStagesVisual.tsx` | All (pause feature is universal) |
| `ReactivateSearchCard` | `LifeStagesVisual.tsx` | All (reactivate is universal) |

---

## Visual Harmony Guide

### Color Palette (Unified Across All Pages)
| Color | Usage | Tailwind Classes |
|-------|-------|------------------|
| **Stone** | Neutrals, backgrounds, dark sections | `stone-50` to `stone-900` |
| **Emerald** | Positive signals, success, good fit | `emerald-400` to `emerald-700` |
| **Amber** | Warnings, highlights, attention | `amber-400` to `amber-700` |
| **Indigo** | Secondary accent, floor areas, data | `indigo-400` to `indigo-600` |

### Styling Rules
- **Corners**: `rounded-2xl` for cards, `rounded-xl` for smaller elements
- **Shadows**: `shadow-md` for cards, `shadow-lg` for elevated, `shadow-xl` for hero elements
- **Borders**: `border-stone-200` for light mode cards
- **Dark sections**: `bg-stone-900` with white/stone-300 text
- **Translucency**: Isochrones at `0.3-0.4` opacity, overlays at `0.1-0.2`

### Typography
- **Headlines**: `font-serif` (for warmth)
- **Body**: Default sans
- **Labels**: `text-xs` to `text-sm`, `font-medium` or `font-semibold`

---

## Current State

### ✅ Renters Page (Gold Standard)
The renters page has reached a high level of visual communication:

1. **Hero with Isochrone Map** — Shows "where you live" immediately
2. **RentersHowItWorks** — Each step has an integrated vignette:
   - Step 1: VignetteLeoAsks (voice orb + conversation)
   - Step 2: VignettePropertyMatch (property card with fit %)
   - Step 3: VignetteFeedbackLoop (iMessage-style feedback)
3. **SectionChecklist with Visuals** — Each category shows HOW Leo does it:
   - City & Access: Isochrone map (transit/bike/walk in 15 min)
   - Street & Building: Map pins with POIs + noise indicator
   - Look & Feel: AI bounding boxes on apartment photo
   - Age & Structure: Research flow (listing → cadastro → search → vices)
4. **ListingVsRealityMockup** — The "gotcha" moment (staged listing vs viewing photos)
5. **LifeStagesTimeline** — Cinematic narrative with pause/reactivate UI
6. **Clean copy** — Conversational, benefit-focused

### ❌ Buyers Page (Needs Work)
Currently uses generic components without visual storytelling:
- Standard SectionHero (waveform, not relevant)
- Standard SectionHowItWorks (text only, no vignettes)
- Standard SectionChecklist (no visuals)
- BuyersChecklistMockup, BuyersComparisonMockup (exist but not integrated)
- Lots of text-heavy sections

### ❌ Relocation Page (Needs Work)
- Standard components throughout
- RelocationBriefMockup, RelocationMapMockup exist but feel disconnected
- No visual storytelling of the workflow
- B2B tone but not visually compelling

### ❌ Buyer Agents Page (Needs Work)
- Standard components
- BuyerAgentsExtensionMockup, BuyerAgentsViewsMockup exist
- Client profile card is good but isolated
- No visual flow showing agent workflow

---

## What Each Page Needs

### Buyers Page

#### Hero
- **Change**: Replace waveform with something buyer-specific
- **Idea**: Property comparison visual or "before/after renovation" teaser

#### How It Works — Needs Vignettes
| Step | Current | Needed Vignette |
|------|---------|-----------------|
| 1. Tell Leo your goals | Text only | Voice/chat mockup about budget, timeline, renovation appetite |
| 2. Get matched properties | Text only | Property card with fit score + "Why it fits" |
| 3. Compare & decide | Text only | Side-by-side comparison card |

#### Checklist Section — Needs Visuals
The 4 categories should have visuals showing Leo's analysis:
- **Location**: Similar to renters isochrone, but focused on appreciation zones, future developments
- **Building**: Cadastro lookup + ITE check + community fees
- **Layout potential**: Floor plan analysis, renovation scenarios
- **Investment**: Price per m² comparison, rental yield estimate

#### Key Narrative Section
**"Don't get fooled by the listing"** exists but needs upgrade:
- Show staged listing vs reality (reuse renters concept)
- Show hidden costs Leo catches (community fees, IBI, renovation needs)

#### Moving Profile Equivalent
**"Your search history follows you"**
- Show: First-time buyer → Upgrader → Investor journey
- Pause/reactivate for buyers who need to wait for mortgage approval

---

### Relocation Page (B2B)

#### Hero
- **Change**: Show dashboard/multi-assignee view
- **Idea**: Map with multiple pins for different assignees across cities

#### How It Works — Needs Vignettes
| Step | Current | Needed Vignette |
|------|---------|-----------------|
| 1. Create housing brief | Text only | Structured brief form mockup |
| 2. Leo scouts the city | Text only | City analysis card (schools, transit, expat areas) |
| 3. Track all assignees | Text only | Dashboard with multiple profile cards |

#### Checklist Section — Needs Visuals
Focus on what matters to relocating families:
- **Schools**: Map with international school pins + commute times
- **Expat community**: Neighborhood analysis (English-speaking %, amenities)
- **Commute**: Isochrone from office location
- **Family needs**: Playgrounds, parks, safety scores

#### Key Narrative Section
**"One family, many requirements"**
- Show: Partner's commute + Kids' school + Language needs → Sweet spot
- Visual overlap like the hero isochrone

#### Dashboard Mockup
**"Track 20 moves, not 20 spreadsheets"**
- Show: List of assignees with status (searching, viewing, signed)
- Show: Alerts (lease ending, viewing scheduled)

---

### Buyer Agents Page (B2B)

#### Hero
- **Change**: Show the browser extension in action
- **Idea**: Idealista/Fotocasa screenshot with Leo overlay showing fit scores

#### How It Works — Needs Vignettes
| Step | Current | Needed Vignette |
|------|---------|-----------------|
| 1. Create client profiles | Text only | Profile card with preferences sliders |
| 2. Leo analyzes listings | Text only | Property card with match % and notes |
| 3. Share curated shortlist | Text only | Client-facing clean view vs agent full view |

#### Checklist Section — Needs Visuals
Focus on what agents need:
- **Client fit**: Match score breakdown (location 90%, noise 40%, etc.)
- **Due diligence**: Automatic cadastro, ITE, cargas check
- **Viewing prep**: Personalized checklist per property
- **Comparison**: Side-by-side with weighted scores

#### Key Narrative Section
**"Two views: Simple for clients, full context for you"**
- Already exists conceptually, needs stronger visual
- Show: Client sees "Great light, quiet street" vs Agent sees full research

#### Efficiency Visual
**"10 clients, 50 listings, 1 Leo"**
- Show: Agent dashboard with multiple client columns
- Show: Time saved metrics

---

## Copy Changes Needed

### Buyers Page Copy

**Current Hero:**
> "Find a home you'll actually love"

**New Hero:**
> "Buy smarter, not faster"

**Current Subcopy:**
> "Leo learns what matters to you and spots the homes worth seeing..."

**New Subcopy:**
> "Leo researches every listing like you would if you had infinite time—cadastro, community fees, renovation potential, and the stuff agents don't mention."

### Relocation Page Copy

**Current Hero:**
> "Relocation housing, handled"

**New Hero:**
> "20 assignees. 5 cities. 1 dashboard."

**Current Subcopy:**
> Generic B2B language

**New Subcopy:**
> "Leo creates structured housing briefs, scouts cities before your team arrives, and tracks every move in one place. Your partners focus on the offer letter."

### Buyer Agents Page Copy

**Current Hero:**
> "Research every listing like a pro"

**New Hero:**
> "Your research assistant that never sleeps"

**Current Subcopy:**
> Generic about saving time

**New Subcopy:**
> "Leo analyzes every listing against your client's profile—fit scores, red flags, viewing checklists. You stay the expert; Leo does the legwork."

---

## Implementation Priority

### Phase 1: Core Visuals (High Impact)
1. [ ] Create "How it Works" vignettes for each page
2. [ ] Add checklist visuals for each page (adapt from renters)
3. [ ] Unify color palette (stone/emerald/amber/indigo)

### Phase 2: Narrative Sections
4. [ ] Buyers: "Your journey" visual (first-time → upgrader → investor)
5. [ ] Relocation: "Family requirements overlap" visual
6. [ ] Agents: "Client vs Agent view" side-by-side

### Phase 3: Copy Alignment
7. [ ] Update hero copy for each page
8. [ ] Update section headlines to be benefit-focused
9. [ ] Remove fake testimonials (hidden until real)

### Phase 4: Polish
10. [ ] Ensure responsive behavior
11. [ ] Add subtle animations
12. [ ] Test visual flow on each page

---

## Shared Components to Create

### New Vignettes Needed
```
src/components/landing/illustrations/
├── BuyersVignettes.tsx
│   ├── VignetteBuyerGoals
│   ├── VignetteBuyerMatch
│   └── VignetteBuyerCompare
├── RelocationVignettes.tsx
│   ├── VignetteBriefForm
│   ├── VignetteCityAnalysis
│   └── VignetteDashboard
└── AgentVignettes.tsx
    ├── VignetteClientProfile
    ├── VignetteListingAnalysis
    └── VignetteShortlist
```

### Checklist Visuals to Adapt

| Visual | Renters | Buyers | Relocation | Agents |
|--------|---------|--------|------------|--------|
| **IsochroneVisual** | Work, friends, gym (15 min) | Work, appreciation zones, transit | Office, school, expat areas | Client-specific zones |
| **MapPinsVisual** | Bar, café, metro, noise | Schools, parks, future metro, development zones | International school, English pharmacy, expat café | Per-client POIs |
| **ImageRecognitionVisual** | Light, ceiling, floor area | Same + renovation potential overlay | Same | Same + match score overlay |
| **InvestigationVisual** | Listing → Cadastro → Search → Vices | Listing → Cadastro → ITE → Community fees → Cargas | Listing → Schools → Commute → Expat score | Listing → Client fit → Due diligence → Checklist |

### Adaptation Strategy
Rather than creating 4x copies, create **configurable components**:

```typescript
// Example: ConfigurableIsochrone
interface IsochroneConfig {
  centerLabel: string; // "🏠" | "🏢" | "👨‍👩‍👧"
  zones: {
    label: string;
    icon: ReactNode;
    color: 'stone' | 'emerald' | 'amber';
  }[];
}

// Renters config
{ centerLabel: "🏠", zones: [
  { label: "Transit", icon: <Train />, color: "stone" },
  { label: "Bike", icon: <Bike />, color: "emerald" },
  { label: "Walk", icon: <Footprints />, color: "amber" }
]}

// Relocation config  
{ centerLabel: "🏢", zones: [
  { label: "Office", icon: <Briefcase />, color: "stone" },
  { label: "School", icon: <GraduationCap />, color: "emerald" },
  { label: "Expat area", icon: <Globe />, color: "amber" }
]}
```

---

---

## Gemini-Generated Images

### Existing Images (Renters)
Located in `public/images/landing/`:

| File | Description | Reusable? |
|------|-------------|-----------|
| `hero-barcelona-aerial.webp` | Stylized aerial Barcelona | ✅ All personas |
| `interior-spanish-apartment.webp` | Bright apartment interior | ✅ All personas |
| `street-spanish-neighborhood.webp` | Walkable street, golden light | ✅ All personas |
| `building-facade-spanish.webp` | Typical Spanish apartment block | ✅ All personas |
| `listing-staged-beautiful.webp` | Staged listing photo | ✅ Buyers, Agents |
| `reality-dark-corner.webp` | Dark corner reality | ✅ Buyers, Agents |
| `reality-water-stain.webp` | Water stain on ceiling | ✅ Buyers, Agents |
| `reality-street-view.webp` | Street view from window | ✅ Buyers, Agents |
| `reality-nice-light.webp` | Nice morning light | ✅ Buyers, Agents |
| `checklist-look-feel.webp` | Wide-angle interior for AI overlay | ✅ All personas |
| `life-first-place.webp` | First apartment, young person | ❌ Renters only |
| `life-flatmates.webp` | Flatmates dinner | ❌ Renters only |
| `life-moving-in.webp` | Couple moving in | ✅ Buyers could use |
| `life-family.webp` | Family in apartment | ✅ Buyers, Relocation |

### Images to Generate — Buyers

| ID | Description | Prompt Notes |
|----|-------------|--------------|
| `buyer-viewing-checklist` | Person with phone at viewing, checking list | Natural, not staged. Spanish apartment background. |
| `buyer-renovation-before` | Dated kitchen/bathroom, 1980s tiles | Authentic Spanish "piso antiguo" |
| `buyer-renovation-after` | Same space, modern renovation | Clean, Scandinavian-Spanish style |
| `buyer-comparison-thinking` | Person comparing two floor plans | Laptop or printed papers, thoughtful expression |
| `buyer-keys-moment` | Receiving keys at notary | Emotional moment, Spanish notary office |
| `buyer-journey-first` | Young professional, small apartment | Barcelona, modest but proud |
| `buyer-journey-upgrade` | Couple, larger apartment | More space, balcony, established |
| `buyer-journey-investor` | Viewing property with analytical eye | Notepad, measuring, calculating |

### Images to Generate — Relocation

| ID | Description | Prompt Notes |
|----|-------------|--------------|
| `relocation-family-arriving` | Family at Barcelona airport | Suitcases, excited kids, new beginning |
| `relocation-school-visit` | Parent visiting international school | Modern school building, welcoming |
| `relocation-neighborhood-explore` | Family exploring Sarrià/Pedralbes | Tree-lined streets, family-friendly |
| `relocation-expat-community` | Diverse group at café | International feel, English menus |
| `relocation-office-view` | Modern office in @22 or Diagonal | Barcelona business district |
| `relocation-settled-in` | Family in new home, boxes unpacked | Relief, comfort, new chapter |

### Images to Generate — Buyer Agents

| ID | Description | Prompt Notes |
|----|-------------|--------------|
| `agent-at-laptop` | Agent working, multiple screens | Professional, organized workspace |
| `agent-with-client` | Agent showing property to client | Professional relationship, Spanish apartment |
| `agent-browser-extension` | Screenshot-style: Idealista with Leo overlay | UI mockup, not photo |
| `agent-viewing-notes` | Agent taking notes during viewing | Professional, iPad or notebook |
| `agent-client-handover` | Agent handing keys to happy client | Success moment, professional pride |

### Image Generation Settings
Use the existing `/api/landing/generate-images` endpoint with:
```typescript
{
  aspectRatio: '16:9' | '4:3' | '1:1',
  imageSize: '4K',
  mimeType: 'image/png',
  personGeneration: 'ALLOW_ALL'
}
```

Then optimize with `scripts/optimize-landing-images.mjs` to convert to WebP.

---

## Success Criteria

Each page should:
1. ✅ Tell a visual story within 10 seconds of scrolling
2. ✅ Show, don't tell — mockups demonstrate features
3. ✅ Have consistent color palette (stone/emerald/amber/indigo)
4. ✅ Feel like the same product, adapted to the audience
5. ✅ Have clear CTAs without repetition
6. ✅ Work on mobile without cluttered labels
7. ✅ Use Gemini-generated images that feel authentic (not stock)
8. ✅ Reuse existing images where appropriate
9. ✅ Available in Spanish (default) and English

---

## Internationalization (i18n)

### Language Strategy
- **Spanish = Default** — Primary market is Spain
- **English = Toggle** — For expats, relocation clients, international agents
- **URL Structure**: `/es/` (default, can omit) and `/en/`

### Implementation Approach

#### Option 1: Next.js App Router i18n (Recommended)
```
src/app/
├── [lang]/
│   ├── page.tsx          # Landing with language param
│   ├── layout.tsx        # Includes language toggle
│   └── ...
├── dictionaries/
│   ├── es.json           # Spanish translations
│   └── en.json           # English translations
```

#### Language Toggle Component
```typescript
// src/components/LanguageToggle.tsx
const LanguageToggle = () => {
  const { lang } = useParams();
  return (
    <div className="flex gap-1 bg-stone-100 rounded-full p-1">
      <button className={lang === 'es' ? 'bg-white shadow' : ''}>ES</button>
      <button className={lang === 'en' ? 'bg-white shadow' : ''}>EN</button>
    </div>
  );
};
```

#### Dictionary Structure
```json
// dictionaries/es.json
{
  "renters": {
    "hero": {
      "eyebrow": "Tu próximo piso, encontrado",
      "headline": "Deja de buscar pisos.\nDeja que Leo los encuentre por ti.",
      "subcopy": "Leo aprende cómo vives y te envía solo los pisos que realmente valen la pena ver.",
      "primaryCta": "Hablar con Leo",
      "secondaryCta": "Ver cómo funciona"
    },
    "howItWorks": {
      "title": "Cómo Leo encaja en tu próxima mudanza",
      "steps": [...]
    },
    "checklist": {
      "title": "En qué se fija Leo",
      "categories": {
        "cityAccess": {
          "title": "Ciudad y acceso",
          "items": ["Tiempo al trabajo", "Transporte público", "Vida nocturna"]
        },
        ...
      }
    }
  },
  "buyers": { ... },
  "relocation": { ... },
  "agents": { ... },
  "shared": {
    "footer": { ... },
    "navigation": { ... }
  }
}
```

### Copy to Translate

#### Renters Page
| Section | English | Spanish |
|---------|---------|---------|
| Hero eyebrow | "Your next flat, found" | "Tu próximo piso, encontrado" |
| Hero headline | "Stop satisficing on rentals" | "Deja de conformarte con el piso" |
| Hero subcopy | "Leo learns how you live..." | "Leo aprende cómo vives..." |
| CTA | "Talk to Leo" | "Hablar con Leo" |
| How it works | "How Leo fits into your next move" | "Cómo Leo encaja en tu próxima mudanza" |
| Step 1 | "Tell Leo how you live" | "Cuéntale a Leo cómo vives" |
| Step 2 | "Get rentals worth leaving the sofa for" | "Recibe pisos que merecen levantarte del sofá" |
| Step 3 | "View, react, and let Leo sharpen" | "Visita, reacciona, y deja que Leo afine" |
| Checklist title | "What Leo pays attention to" | "En qué se fija Leo" |
| City & Access | "City & access" | "Ciudad y acceso" |
| Street & Building | "Street & building" | "Calle y edificio" |
| Look & Feel | "Look & feel" | "Luz y espacio" |
| Age & Structure | "Age & structure" | "Edad y estructura" |
| Viewing Day | "Your viewing, supercharged" | "Tu visita, potenciada" |
| Life stages | "One profile that follows you between flats" | "Un perfil que te sigue entre pisos" |
| Pause | "Your search is paused" | "Tu búsqueda está pausada" |
| Resume | "Resume search" | "Reanudar búsqueda" |

#### UI Labels (All Pages)
| English | Spanish |
|---------|---------|
| "15 min" | "15 min" |
| "Transit" | "Transporte" |
| "Bike" | "Bici" |
| "Walk" | "A pie" |
| "East facing" | "Orientación este" |
| "Morning sun" | "Sol de mañana" |
| "High ceiling" | "Techos altos" |
| "Living area" | "Salón" |
| "Light: Excellent" | "Luz: Excelente" |
| "Noise: Moderate" | "Ruido: Moderado" |
| "Del anuncio" | Already Spanish ✓ |
| "Cadastro" | Already Spanish ✓ |
| "Vicios ocultos" | Already Spanish ✓ |

### Visual Elements — Language Agnostic
These don't need translation:
- ✅ Isochrone blobs (visual)
- ✅ Map pins (icons)
- ✅ AI bounding boxes (visual)
- ✅ Photos (Gemini-generated)
- ✅ Emojis (🏠, etc.)

These need translation:
- ⚠️ Labels on visuals (Transit, Bike, Walk)
- ⚠️ Checklist category names
- ⚠️ Mockup UI text (property cards, chat bubbles)

### Implementation Priority
1. **Phase 1**: Extract all copy to `content-data.ts` (already mostly done)
2. **Phase 2**: Create `dictionaries/es.json` and `dictionaries/en.json`
3. **Phase 3**: Add `[lang]` dynamic route
4. **Phase 4**: Add language toggle to header
5. **Phase 5**: Update all components to use dictionary
6. **Phase 6**: Translate mockup/vignette UI text

### SEO Considerations
- `<html lang="es">` or `<html lang="en">`
- `<link rel="alternate" hreflang="es" href="https://leo.casa/es/" />`
- `<link rel="alternate" hreflang="en" href="https://leo.casa/en/" />`
- Default to Spanish for `.es` domain

