# P0-18: Landing Page Features

> **Parent:** [P0 Index](./P0_INDEX.md)
> **Related:** [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md)

---

## Overview

Landing page improvements to communicate Leo's value proposition. The key differentiator: **personalized intelligence vs generic search**.

---

## Feature: Map Comparison Visual (Renters Page)

### Location

Above "How it Works" section on the Renters landing page (`/[lang]` with renter persona).

### Concept

Side-by-side comparison showing the dramatic shift from generic portal search to Leo's personalized heatmaps.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│        🔍 How everyone else searches    vs    🎯 How Leo searches for you   │
│                                                                             │
│   ┌─────────────────────────────┐      ┌─────────────────────────────┐     │
│   │                             │      │                             │     │
│   │    ┌───────────────┐        │      │     🟢🟢🟢                   │     │
│   │    │               │        │      │   🟢🟢🟢🟢🟢                 │     │
│   │    │   EIXAMPLE    │        │      │  🟡🟢🟢🟢🟢🟡               │     │
│   │    │               │        │      │   🟡🟡🟢🟢🟡🟡              │     │
│   │    └───────────────┘        │      │     🟠🟡🟡🟠                │     │
│   │                             │      │       🔴🔴                   │     │
│   │    "Draw a box"             │      │                             │     │
│   │                             │      │   Personalized heatmap      │     │
│   └─────────────────────────────┘      └─────────────────────────────┘     │
│                                                                             │
│   ❌ Same results for everyone          ✅ Based on YOUR preferences        │
│   ❌ Miss great options nearby          ✅ Commute from YOUR work           │
│   ❌ No idea why it's there             ✅ Near YOUR gym, YOUR coffee        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visual Design

#### Left Side: "Traditional Search" (Idealista-style)

```
┌─────────────────────────────────────────┐
│                                         │
│    Map of Barcelona                     │
│                                         │
│       ┌─────────────────────┐           │
│       │                     │           │
│       │   RIGID BOUNDARY    │  ← Blue   │
│       │   (Rectangle/       │    dashed │
│       │    Polygon)         │    border │
│       │                     │           │
│       └─────────────────────┘           │
│                                         │
│    • • • • • (dots = listings)          │
│    All inside the box                   │
│                                         │
└─────────────────────────────────────────┘

Caption: "Draw a shape. See everything inside."
Subtext: "Same results whether you're a morning runner 
          or a night owl. A chef or a remote worker."
```

#### Right Side: "Leo's Personalized Heatmap"

```
┌─────────────────────────────────────────┐
│                                         │
│    Map of Barcelona                     │
│                                         │
│         🏢 (work icon)                  │
│          ↓                              │
│       ████████  ← Dark green            │
│     ██████████████  (best fit)          │
│    ████████████████                     │
│     ██████████████  ← Lighter green     │
│       ████████      (good fit)          │
│         ████                            │
│          ██  ← Yellow/orange            │
│              (okay fit)                 │
│                                         │
└─────────────────────────────────────────┘

Caption: "Your perfect zones. Calculated for you."
Subtext: "30 min to work. Near your gym. 
          Great coffee. Parks for your dog."
```

### Interaction

**Option A: Static comparison**
- Two side-by-side images/illustrations
- Clean, no interaction needed
- Fastest to implement

**Option B: Animated transition**
- Start with Idealista-style box
- Animate dissolve into personalized heatmap
- "This is what you're missing" feeling

**Option C: Interactive toggle**
- User clicks to switch between views
- "See the difference" button
- More engaging but more complex

**Recommendation:** Start with **Option A** (static), consider **Option B** for v2.

---

### Copy

#### Headline Options

**English:**
1. "Stop drawing boxes. Start finding homes."
2. "Generic search vs. Your search"
3. "Everyone gets the same results. Except you."
4. "The old way vs. the Leo way"

**Spanish:**
1. "Deja de dibujar cuadros. Empieza a encontrar casas."
2. "Búsqueda genérica vs. Tu búsqueda"
3. "Todos ven lo mismo. Menos tú."
4. "Lo de siempre vs. Lo de Leo"

#### Supporting Copy

**English:**
> Traditional portals show you everything in a box you draw. The same listings whether you work from home or commute an hour. Whether you need a gym nearby or couldn't care less.
>
> Leo builds a personalized map based on YOUR life. Your commute. Your habits. Your priorities. Properties you'd never find by drawing boxes.

**Spanish:**
> Los portales tradicionales te muestran todo dentro de un cuadro que dibujas. Los mismos pisos tanto si trabajas desde casa como si viajas una hora. Tanto si necesitas un gimnasio cerca como si te da igual.
>
> Leo crea un mapa personalizado basado en TU vida. Tu commute. Tus hábitos. Tus prioridades. Propiedades que nunca encontrarías dibujando cuadros.

---

### Comparison Points

| Traditional Search | Leo's Search |
|-------------------|--------------|
| Draw a rectangle | Tell Leo your life |
| Hard boundary (in or out) | Soft gradient (best → okay) |
| Same for everyone | Personalized to you |
| Miss nearby gems | Discover hidden spots |
| Filter by specs only | Match by lifestyle |
| You do the work | Leo does the work |

---

### Component Structure

```tsx
// src/components/landing/sections/MapComparisonSection.tsx

interface MapComparisonSectionProps {
  locale: 'es' | 'en';
}

export const MapComparisonSection = ({ locale }: MapComparisonSectionProps) => {
  const t = translations[locale];
  
  return (
    <section className="max-w-5xl mx-auto px-6 py-20">
      {/* Section header */}
      <div className="text-center mb-12">
        <h2 className="font-serif text-3xl md:text-4xl mb-4">
          {t.headline}
        </h2>
        <p className="text-lg text-stone-600 max-w-2xl mx-auto">
          {t.subheadline}
        </p>
      </div>
      
      {/* Comparison grid */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Left: Traditional */}
        <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200">
          <div className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">
            {t.traditionalLabel}
          </div>
          <div className="aspect-[4/3] bg-white rounded-xl border border-stone-200 mb-4 overflow-hidden">
            <TraditionalMapIllustration />
          </div>
          <p className="text-stone-600 text-sm">
            {t.traditionalCaption}
          </p>
        </div>
        
        {/* Right: Leo */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-6 border border-emerald-200">
          <div className="text-sm font-medium text-emerald-600 uppercase tracking-wider mb-4">
            {t.leoLabel}
          </div>
          <div className="aspect-[4/3] bg-white rounded-xl border border-emerald-200 mb-4 overflow-hidden">
            <PersonalizedHeatmapIllustration />
          </div>
          <p className="text-stone-600 text-sm">
            {t.leoCaption}
          </p>
        </div>
      </div>
      
      {/* Comparison bullets */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {t.traditionalPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-2 text-stone-500">
              <X className="w-5 h-5 text-stone-400 shrink-0" />
              <span>{point}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {t.leoPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-2 text-stone-700">
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
```

---

### Illustration Components

#### Traditional Map Illustration

```tsx
// src/components/landing/illustrations/TraditionalMapIllustration.tsx

export const TraditionalMapIllustration = () => (
  <svg viewBox="0 0 400 300" className="w-full h-full">
    {/* Base map - muted Barcelona outline */}
    <rect fill="#f5f5f4" width="400" height="300" />
    
    {/* Street grid (subtle) */}
    <g stroke="#e7e5e4" strokeWidth="1">
      <line x1="0" y1="100" x2="400" y2="100" />
      <line x1="0" y1="200" x2="400" y2="200" />
      <line x1="133" y1="0" x2="133" y2="300" />
      <line x1="266" y1="0" x2="266" y2="300" />
    </g>
    
    {/* Selection rectangle (Idealista blue) */}
    <rect 
      x="100" y="80" 
      width="200" height="140" 
      fill="rgba(59, 130, 246, 0.1)" 
      stroke="#3b82f6" 
      strokeWidth="2" 
      strokeDasharray="8 4"
    />
    
    {/* Listings inside (dots) */}
    <g fill="#3b82f6">
      <circle cx="150" cy="120" r="4" />
      <circle cx="200" cy="100" r="4" />
      <circle cx="250" cy="150" r="4" />
      <circle cx="180" cy="180" r="4" />
      <circle cx="220" cy="130" r="4" />
      <circle cx="140" cy="160" r="4" />
      <circle cx="260" cy="190" r="4" />
    </g>
    
    {/* Listings OUTSIDE that user misses (faded) */}
    <g fill="#d6d3d1">
      <circle cx="80" cy="150" r="4" />  {/* Great place, just outside */}
      <circle cx="320" cy="120" r="4" />
      <circle cx="350" cy="200" r="4" />
    </g>
    
    {/* Corner handles */}
    <g fill="#3b82f6">
      <rect x="96" y="76" width="8" height="8" />
      <rect x="296" y="76" width="8" height="8" />
      <rect x="96" y="216" width="8" height="8" />
      <rect x="296" y="216" width="8" height="8" />
    </g>
  </svg>
);
```

#### Personalized Heatmap Illustration

**Base:** Static Mapbox screenshot of Barcelona (stored in `/public/images/landing/barcelona-map-base.png`)

**Color Scheme (Hot → Cold):**

| Zone | Color | Meaning | Opacity |
|------|-------|---------|---------|
| 🔴 Red | `#ef4444` | Great for your Lifestyle | 0.5 |
| 🟡 Yellow | `#eab308` | Good for your Commute | 0.4 |
| 🔵 Blue | `#3b82f6` | Out of the way | 0.3 |
| ⬜ Transparent | — | Outside zones | 0 |

```tsx
// src/components/landing/illustrations/PersonalizedHeatmapIllustration.tsx

import Image from 'next/image';

export const PersonalizedHeatmapIllustration = () => (
  <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl">
    {/* Static Mapbox Barcelona base */}
    <Image
      src="/images/landing/barcelona-map-base.png"
      alt="Barcelona map"
      fill
      className="object-cover"
    />
    
    {/* SVG Heatmap overlay */}
    <svg 
      viewBox="0 0 400 300" 
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Heatmap gradient: Red (hot) → Yellow → Blue (cold) → Transparent */}
      <defs>
        <radialGradient id="lifestyle-heatmap" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />   {/* Red - Lifestyle */}
          <stop offset="35%" stopColor="#eab308" stopOpacity="0.4" />  {/* Yellow - Commute */}
          <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.3" />  {/* Blue - Out of way */}
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />   {/* Transparent */}
        </radialGradient>
      </defs>
      
      {/* Main heatmap blob - organic shape centered on work */}
      <ellipse 
        cx="200" cy="120" 
        rx="140" ry="100" 
        fill="url(#lifestyle-heatmap)" 
      />
      
      {/* Work anchor icon */}
      <g transform="translate(200, 70)">
        <circle r="14" fill="#1c1917" />
        <text textAnchor="middle" dy="5" fill="white" fontSize="12">🏢</text>
      </g>
      
      {/* POI markers in hot zone */}
      <g fontSize="14">
        <text x="170" y="100">☕</text>
        <text x="230" y="95">💪</text>
        <text x="190" y="140">🌳</text>
        <text x="215" y="150">🚇</text>
      </g>
      
      {/* High-fit listings (in red zone) */}
      <g>
        <circle cx="185" cy="105" r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
        <circle cx="210" cy="115" r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
        <circle cx="195" cy="130" r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
      </g>
      
      {/* Medium-fit listings (in yellow zone) */}
      <g>
        <circle cx="140" cy="120" r="5" fill="#eab308" stroke="white" strokeWidth="2" />
        <circle cx="260" cy="130" r="5" fill="#eab308" stroke="white" strokeWidth="2" />
      </g>
      
      {/* Low-fit listings (in blue zone) */}
      <g>
        <circle cx="100" cy="150" r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
        <circle cx="300" cy="160" r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
      </g>
    </svg>
    
    {/* Legend overlay */}
    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-stone-600">Lifestyle</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-stone-600">Commute</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-stone-600">Far</span>
        </div>
      </div>
    </div>
  </div>
);
```

### Generating the Barcelona Base Map

Use Mapbox Static Images API to get a clean base:

```bash
# Mapbox Static API URL
https://api.mapbox.com/styles/v1/mapbox/light-v11/static/2.1734,41.3851,12,0/800x600@2x?access_token=YOUR_TOKEN

# Parameters:
# - Style: light-v11 (clean, minimal)
# - Center: 2.1734, 41.3851 (Barcelona)
# - Zoom: 12
# - Size: 800x600 @2x for retina
```

Save as: `/public/images/landing/barcelona-map-base.png`

---

### Implementation Checklist

```
□ 1. Create illustrations (2 hr)
      - TraditionalMapIllustration.tsx
      - PersonalizedHeatmapIllustration.tsx
      - Test at different sizes

□ 2. Create MapComparisonSection component (2 hr)
      - Two-column layout
      - Responsive (stack on mobile)
      - Add to illustrations/index.ts

□ 3. Add translations (30 min)
      - Add to en.json and es.json
      - Headline, captions, bullet points

□ 4. Integrate into RentersContent (30 min)
      - Import MapComparisonSection
      - Place above HowItWorks section

□ 5. Test & polish (1 hr)
      - Check mobile layout
      - Verify animations (if added)
      - Cross-browser check
```

---

### Future Enhancements

1. **Animated version** — Transition from box to heatmap
2. **Interactive demo** — Let user input their work address, show instant heatmap
3. **Real data teaser** — Show actual Barcelona neighborhoods
4. **A/B test headlines** — Test different value props

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0 Index](./P0_INDEX.md) | Master index |
| [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md) | In-app map components |
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | Heatmap algorithm |

---

*Last Updated: December 2024*
