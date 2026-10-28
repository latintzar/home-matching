# P0-21: Mis Propiedades (User Dashboard)

> **Parent:** [P0 Index](./P0_INDEX.md)  
> **Related:** [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md), [P0-10-NOTES-SYSTEM](./P0-10-NOTES-SYSTEM.md), [P0-03-RECOMMENDER](./P0-03-RECOMMENDER.md)

---

## Overview

The "Mis Propiedades" page (`/dashboard`) is the user's personalized property feed. It adopts the grid-based catalogue pattern from `test-catalogue` but is **recommendation-driven** (no filters) and includes personalization elements like Fit Scores, Notes, and the user's lifestyle heatmap.

### Key Differences from Test Catalogue

| Feature | Test Catalogue (Admin) | Mis Propiedades (User) |
|---------|------------------------|------------------------|
| **Sidebar content** | Filters | Profile summary / preferences |
| **Content source** | All harvested listings | Leo's recommendations only |
| **Fit Score** | ❌ | ✅ On cards + above carousel |
| **Notes panel** | ❌ | ✅ Right column / toggle |
| **Map heatmap** | On-demand circles | Always faint user overlay |
| **Link button** | ❌ | ✅ Below carousel |
| **Liked segregation** | ❌ | ✅ Favorites above rest |

---

## Desktop Layout

### Grid View with Sidebar

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                      │  │  MIS PROPIEDADES                    [🗺️ Mapa] [Ordenar ▼] [🌐]  │ │
│  │  👤 TU PERFIL        │  ├─────────────────────────────────────────────────────────────────┤ │
│  │                      │  │                                                                 │ │
│  │  Buscas: Alquiler    │  │  ❤️ TUS FAVORITOS (3)                                           │ │
│  │  Zona: Barcelona     │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │ │
│  │  Budget: €1,000-1,500│  │  │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │    │ │
│  │                      │  │  │ │   📸 PHOTO  │ │ │ │   📸 PHOTO  │ │ │ │   📸 PHOTO  │ │    │ │
│  │  ──────────────────  │  │  │ │  • • • • •  │ │ │ │  • • • • •  │ │ │ │  • • • • •  │ │    │ │
│  │                      │  │  │ └─────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ │    │ │
│  │  ✨ LO QUE VALORAS   │  │  │            [🔗] │ │            [🔗] │ │            [🔗] │    │ │
│  │                      │  │  │ ❤️ Piso Gràcia  │ │ ❤️ Ático Eixam. │ │ ❤️ Dúplex Pobl. │    │ │
│  │  ☀️ Luz natural      │  │  │ €1,200/mes      │ │ €1,450/mes      │ │ €1,100/mes      │    │ │
│  │  🏃 Cerca del gym    │  │  │ ████████░░ 85%  │ │ ████████░░ 82%  │ │ ███████░░░ 78%  │    │ │
│  │  🚇 Max 20min commute│  │  │ "Luz perfecta"  │ │ "Cerca gym"     │ │ "Tu terraza"    │    │ │
│  │  🌿 Terraza/balcón   │  │  └─────────────────┘ └─────────────────┘ └─────────────────┘    │ │
│  │                      │  │                                                                 │ │
│  │  ──────────────────  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │                      │  │                                                                 │ │
│  │  ⚠️ DEALBREAKERS     │  │  ✨ RECOMENDADOS PARA TI (24)                                   │ │
│  │                      │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │ │
│  │  ❌ Planta baja      │  │  │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │    │ │
│  │  ❌ Sin ascensor     │  │  │ │   📸 PHOTO  │ │ │ │   📸 PHOTO  │ │ │ │   📸 PHOTO  │ │    │ │
│  │  ❌ Interior oscuro  │  │  │ │  • • • • •  │ │ │ │  • • • • •  │ │ │ │  • • • • •  │ │    │ │
│  │                      │  │  │ └─────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ │    │ │
│  │  ──────────────────  │  │  │            [🔗] │ │            [🔗] │ │            [🔗] │    │ │
│  │                      │  │  │ 🤍 Sant Antoni  │ │ 🤍 Loft Born    │ │ 🤍 Sagrada Fam. │    │ │
│  │  📊 ESTADÍSTICAS     │  │  │ €1,350/mes      │ │ €1,500/mes      │ │ €1,250/mes      │    │ │
│  │                      │  │  │ ███████░░░ 76%  │ │ ██████░░░░ 74%  │ │ ██████░░░░ 72%  │    │ │
│  │  27 recomendaciones  │  │  │ "Tu vibe"       │ │ "Tu estilo"     │ │ "15min oficina" │    │ │
│  │  3 favoritos         │  │  └─────────────────┘ └─────────────────┘ └─────────────────┘    │ │
│  │  4 con notas         │  │                                                                 │ │
│  │                      │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │ │
│  │  ──────────────────  │  │  │      ...        │ │      ...        │ │      ...        │    │ │
│  │                      │  │  └─────────────────┘ └─────────────────┘ └─────────────────┘    │ │
│  │  [📞 Hablar con Leo] │  │                                                                 │ │
│  │                      │  │                                                                 │ │
│  └──────────────────────┘  └─────────────────────────────────────────────────────────────────┘ │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Map View with Sidebar

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                      │  │  MIS PROPIEDADES                    [📋 Grid] [Ordenar ▼] [🌐]  │ │
│  │  👤 TU PERFIL        │  ├─────────────────────────────────────────────────────────────────┤ │
│  │                      │  │                                                                 │ │
│  │  Buscas: Alquiler    │  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  Zona: Barcelona     │  │  │                                                         │    │ │
│  │  Budget: €1,000-1,500│  │  │              ░░░░░░░░░░░░░░░░░░░░░░░░░░                 │    │ │
│  │                      │  │  │          ░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░                │    │ │
│  │  ──────────────────  │  │  │        ░░▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒░░                  │    │ │
│  │                      │  │  │      ░░▒▒▓▓▓▓████[3]██████████▓▓▓▓▒▒░░                 │    │ │
│  │  ✨ LO QUE VALORAS   │  │  │     ░░▒▒▓▓███████[❤️]████████████▓▓▒▒░░                │    │ │
│  │                      │  │  │     ░░▒▒▓▓████████████[2]████████▓▓▒▒░░                │    │ │
│  │  ☀️ Luz natural      │  │  │     ░░▒▒▓▓██[❤️]████████████████████▓▓▒▒░░             │    │ │
│  │  🏃 Cerca del gym    │  │  │     ░░▒▒▓▓████████████████[4]████▓▓▒▒░░                │    │ │
│  │  🚇 Max 20min commute│  │  │      ░░▒▒▓▓███████[1]████████████▓▓▒▒░░                │    │ │
│  │  🌿 Terraza/balcón   │  │  │       ░░▒▒▓▓▓████████████[❤️]██▓▓▓▒▒░░                 │    │ │
│  │                      │  │  │         ░░▒▒▒▒▓▓▓▓████████▓▓▓▓▒▒▒▒░░                   │    │ │
│  │  ──────────────────  │  │  │           ░░░▒▒▒▒▒▒▓▓▓▓▒▒▒▒▒░░░                        │    │ │
│  │                      │  │  │               ░░░░░░░░░░░░░░                            │    │ │
│  │  ⚠️ DEALBREAKERS     │  │  │                                                   [+][-]│    │ │
│  │                      │  │  └─────────────────────────────────────────────────────────┘    │ │
│  │  ❌ Planta baja      │  │                                                                 │ │
│  │  ❌ Sin ascensor     │  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │                      │  │  │ 27 propiedades · 3 favoritos · 🔴🟡🔵 Tu zona ideal      │    │ │
│  │  ──────────────────  │  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                      │  │                                                                 │ │
│  │  [📞 Hablar con Leo] │  │  [❤️] = Favoritos    [#] = Recomendados        [Cerrar Mapa]   │ │
│  │                      │  │                                                                 │ │
│  └──────────────────────┘  └─────────────────────────────────────────────────────────────────┘ │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

Note: Heatmap (░▒▓█) is ALWAYS visible at 15% opacity, showing user's ideal zones
```

---

## Property Detail View

### Desktop (with Notes Panel)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  [← Volver a Mis Propiedades]                                                        [🔗]     │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐  ┌────────────────────┐ │
│  │                                                                  │  │                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │  💬 TUS NOTAS      │ │
│  │  │                                                            │  │  │                    │ │
│  │  │  FIT SCORE                                                 │  │  │  ┌──────────────┐  │ │
│  │  │  ████████████████░░░░░░  85%                               │  │  │  │ La cocina es │  │ │
│  │  │                                                            │  │  │  │ pequeña pero │  │ │
│  │  │  "Este piso tiene la luz natural que tanto valoras, y      │  │  │  │ me gusta     │  │ │
│  │  │   está a solo 12 minutos de tu oficina. La cocina es       │  │  │  │      ✓✓ 14:32│  │ │
│  │  │   pequeña pero el resto compensa."                         │  │  │  └──────────────┘  │ │
│  │  │                                                            │  │  │                    │ │
│  │  │  ✅ Luz natural  ✅ Commute  ✅ Barrio  ⚠️ Cocina pequeña   │  │  │  ┌──────────────┐  │ │
│  │  │                                                            │  │  │  │ Me encanta   │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │  │  │ el balcón!   │  │ │
│  │                                                                  │  │  │      ✓✓ 14:33│  │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │  └──────────────┘  │ │
│  │  │                                                            │  │  │                    │ │
│  │  │                                                            │  │  │  ┌──────────────┐  │ │
│  │  │                                                            │  │  │  │ 🎤 0:08      │  │ │
│  │  │                      📸 PHOTO CAROUSEL                     │  │  │  │ ▶────────    │  │ │
│  │  │                                                            │  │  │  │      ✓✓ 14:35│  │ │
│  │  │                                                            │  │  │  └──────────────┘  │ │
│  │  │                                                            │  │  │                    │ │
│  │  │   [<]              • • • • • • •                    [>]    │  │  │  ────────────────  │ │
│  │  │                                                            │  │  │                    │ │
│  │  └────────────────────────────────────────────────────────────┘  │  │  ┌──────────────┐  │ │
│  │                                                             [🔗] │  │  │ 🤖 LEO:      │  │ │
│  │                                                                  │  │  │              │  │ │
│  │  ❤️  Piso en Gràcia                                    [Logo]   │  │  │ Veo que te   │  │ │
│  │                                                                  │  │  │ gusta la luz │  │ │
│  │  €1,200/mes                                                      │  │  │ - actualizo  │  │ │
│  │  75m²  ·  3 habitaciones  ·  2 baños                             │  │  │ preferencias │  │ │
│  │                                                                  │  │  └──────────────┘  │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │                    │ │
│  │  │                                                            │  │  │  ────────────────  │ │
│  │  │  📱 Contactar Agente                          [WhatsApp]   │  │  │                    │ │
│  │  │                                                            │  │  │  💡 LEO'S VIEW    │ │
│  │  └────────────────────────────────────────────────────────────┘  │  │                    │ │
│  │                                                                  │  │  "La cocina es    │ │
│  │  ☀️ Orientación sur  •  🌿 Balcón  •  🚇 Metro 5 min             │  │   funcional pero  │ │
│  │                                                                  │  │   pequeña. Si     │ │
│  │  ──────────────────────────────────────────────────────────────  │  │   cocinas mucho,  │ │
│  │                                                                  │  │   considera el    │ │
│  │  Descripción                                                     │  │   espacio."       │ │
│  │                                                                  │  │                    │ │
│  │  Luminoso piso de 75m² en el corazón de Gràcia. Recién          │  ├────────────────────┤ │
│  │  reformado con acabados de alta calidad...                       │  │ [📷] [🎤] [____] │ │
│  │                                                                  │  │              [➤]  │ │
│  │  ──────────────────────────────────────────────────────────────  │  └────────────────────┘ │
│  │                                                                  │                         │
│  │  Ubicación                                                       │                         │
│  │  ┌────────────────────────────────────────────────────────────┐  │                         │
│  │  │            ░░▒▒▓▓███[📍]████▓▓▒▒░░                         │  │                         │
│  │  │          ░░▒▒▓▓████████████████▓▓▒▒░░  ← Heatmap faint     │  │                         │
│  │  │            ░░▒▒▓▓████████████▓▓▒▒░░                        │  │                         │
│  │  └────────────────────────────────────────────────────────────┘  │                         │
│  │                                                                  │                         │
│  │  Ver en: [Tecnocasa →]                                          │                         │
│  │                                                                  │                         │
│  └──────────────────────────────────────────────────────────────────┘                         │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Layout

### Grid View (Default)

```
┌─────────────────────────┐
│ 🏠 MIS PROPIEDADES  [🌐]│
├─────────────────────────┤
│ [📋 Grid]  [🗺️ Mapa]    │
├─────────────────────────┤
│                         │
│ ❤️ FAVORITOS (3)        │
│ ┌─────────┐ ┌─────────┐ │
│ │  📸     │ │  📸     │ │
│ │         │ │         │ │
│ │    [🔗] │ │    [🔗] │ │
│ │ €1,200  │ │ €1,450  │ │
│ │ ████ 85%│ │ ████ 82%│ │
│ └─────────┘ └─────────┘ │
│                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━ │
│                         │
│ ✨ RECOMENDADOS (24)    │
│ ┌─────────┐ ┌─────────┐ │
│ │  📸     │ │  📸     │ │
│ │         │ │         │ │
│ │    [🔗] │ │    [🔗] │ │
│ │ €1,350  │ │ €1,500  │ │
│ │ ███ 76% │ │ ███ 74% │ │
│ └─────────┘ └─────────┘ │
│ ┌─────────┐ ┌─────────┐ │
│ │  📸     │ │  📸     │ │
│ │    [🔗] │ │    [🔗] │ │
│ │ €1,250  │ │ €1,180  │ │
│ │ ███ 72% │ │ ███ 70% │ │
│ └─────────┘ └─────────┘ │
│                         │
│         · · ·           │
│                         │
└─────────────────────────┘
```

### Map View (Fullscreen)

```
┌─────────────────────────┐
│       [Cerrar Mapa]     │
├─────────────────────────┤
│                         │
│   ░░░░░░░░░░░░░░░░░░░   │
│  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  │
│ ░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░ │
│░░▒▒▓▓███[❤️]█████▓▓▒▒░░│
│░░▒▒▓▓████[3]██████▓▓▒▒░░│
│░░▒▒▓▓███████[2]███▓▓▒▒░░│
│░░▒▒▓▓██[❤️]███████▓▓▒▒░░│
│░░▒▒▓▓████[1]██████▓▓▒▒░░│
│ ░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░ │
│  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  │
│   ░░░░░░░░░░░░░░░░░░░   │
│                         │
│                   [+][-]│
├─────────────────────────┤
│ 27 propiedades          │
│ 🔴🟡🔵 Tu zona ideal    │
└─────────────────────────┘

Note: Clicking pin opens 
Detail View directly
```

### Detail View (Default)

```
┌─────────────────────────┐
│ [←]               [🔗]  │
├─────────────────────────┤
│                         │
│ ┌─────────────────────┐ │
│ │ FIT: 85%            │ │
│ │ ████████████░░░░░░  │ │
│ │                     │ │
│ │ "Luz natural que    │ │
│ │  valoras, 12 min    │ │
│ │  a tu oficina"      │ │
│ │                     │ │
│ │ ✅ Luz  ✅ Commute   │ │
│ │ ✅ Barrio ⚠️ Cocina │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │                     │ │
│ │    📸 CAROUSEL      │ │
│ │  ←  • • • • • •  →  │ │
│ │                     │ │
│ └─────────────────────┘ │
│                    [🔗] │
│                         │
│ ❤️ Piso en Gràcia       │
│ €1,200/mes              │
│ 75m² · 3 hab · 2 baños  │
│                         │
│ ┌─────────────────────┐ │
│ │  📱 Contactar       │ │
│ │     Agente          │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │  📝 Ver Notas (4)   │ │
│ └─────────────────────┘ │
│                         │
│ ☀️ Sur · 🌿 Balcón · 🚇 │
│                         │
│ ─────────────────────── │
│                         │
│ Descripción...          │
│                         │
│ ─────────────────────── │
│                         │
│ Ubicación               │
│ ┌─────────────────────┐ │
│ │  ░▒▓██[📍]██▓▒░     │ │
│ └─────────────────────┘ │
│                         │
│ Ver en: [Tecnocasa →]   │
│                         │
└─────────────────────────┘
```

### Notes View (Toggle)

```
┌─────────────────────────┐
│ [← Volver]  TUS NOTAS   │
├─────────────────────────┤
│                         │
│  ┌───────────────────┐  │
│  │ La cocina es      │  │
│  │ pequeña pero me   │  │
│  │ gusta la luz      │  │
│  │            ✓✓ 14:32│  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ Me encanta el     │  │
│  │ balcón!           │  │
│  │            ✓✓ 14:33│  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ 🎤 0:08           │  │
│  │ ▶─────────────    │  │
│  │            ✓✓ 14:35│  │
│  └───────────────────┘  │
│                         │
│  ────────────────────   │
│                         │
│  ┌───────────────────┐  │
│  │ 🤖 LEO:           │  │
│  │ Veo que te gusta  │  │
│  │ la luz - actualizo│  │
│  │ preferencias.     │  │
│  └───────────────────┘  │
│                         │
│  ────────────────────   │
│                         │
│  💡 LEO'S VIEW          │
│  "La cocina es          │
│   funcional pero        │
│   pequeña."             │
│                         │
├─────────────────────────┤
│ [📷] [🎤] [_________]   │
│                    [➤]  │
└─────────────────────────┘
```

---

## Component Architecture

### New Components Needed

| Component | Purpose | Notes |
|-----------|---------|-------|
| `UserProfileSidebar.tsx` | Left sidebar with profile summary | Replaces filter sidebar |
| `FitScoreReasoning.tsx` | Score bar + explanation | Above carousel in details |
| `LinkButton.tsx` | External link button | Below carousel corner |
| `LikedSection.tsx` | Segregated favorites | Top of grid with divider |
| `UserPropertyCard.tsx` | Card with Fit Score display | Extends existing card |

### Reused from Test Catalogue

| Component | Modifications Needed |
|-----------|---------------------|
| `PhotoCarousel` | Add LinkButton position slot |
| `DetailView` | Add FitScoreReasoning, NotesPanel |
| Grid layout | Add liked segregation logic |
| Map view | Enable always-on heatmap layer |
| Mobile responsiveness | Already built |

### Integration with P0-10 Notes System

The Notes panel uses the **WhatsApp-style NotesChat** component from [P0-10-NOTES-SYSTEM](./P0-10-NOTES-SYSTEM.md):

| Desktop | Mobile |
|---------|--------|
| Right column, always visible | Toggle view via button |
| 280px fixed width | Full screen overlay |

See P0-10 for: signal extraction, Leo's two cents, media support, cron processing.

---

## Sidebar Content

### Profile Summary Section

```typescript
interface UserProfileSummary {
  searchType: 'rent' | 'sale';
  targetCity: string;
  budget: { min: number; max: number };
  preferences: string[];      // "Luz natural", "Cerca del gym"
  dealbreakers: string[];     // "Planta baja", "Sin ascensor"
  stats: {
    recommendations: number;
    favorites: number;
    withNotes: number;
  };
}
```

### Sidebar Sections

1. **Tu Perfil** — Search type, location, budget
2. **Lo Que Valoras** — Top preferences from intake
3. **Dealbreakers** — Non-negotiables
4. **Estadísticas** — Quick counts
5. **CTA** — "Hablar con Leo" button

---

## Map Behavior

Maps in Mis Propiedades **always** show the user's lifestyle heatmap faintly:

```typescript
// src/components/dashboard/DashboardMap.tsx

const DASHBOARD_HEATMAP_OPACITY = 0.15; // Faint, always visible

export const DashboardMap = ({ listings, userHeatmap }) => {
  return (
    <MapGL {...mapProps}>
      {/* User's personalized heatmap - always visible */}
      <Source id="user-heatmap" type="geojson" data={userHeatmap}>
        <Layer
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': DASHBOARD_HEATMAP_OPACITY,
          }}
        />
      </Source>
      
      {/* Property markers on top */}
      <PropertyMarkers 
        listings={listings} 
        likedIds={likedIds}
        pinColor="#da654d"
      />
    </MapGL>
  );
};
```

---

## Link Button Placement

The link button appears **below the bottom-right corner** of the photo carousel:

```
┌────────────────────────────────────┐
│                                    │
│          📸 PHOTO                  │
│                                    │
│                                    │
└────────────────────────────────────┘
                               [🔗] ← Link button
€1,200/mes
████████░░ 85%
```

```typescript
// Component structure
<div className="relative">
  <PhotoCarousel photos={photos} />
  <a 
    href={listing.originalUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="absolute -bottom-2 right-2 p-2 bg-white rounded-full shadow-md 
               hover:bg-stone-50 hover:shadow-lg transition-all"
    aria-label="Ver en sitio original"
  >
    <ExternalLink className="w-4 h-4 text-stone-600" />
  </a>
</div>
```

---

## Liked Segregation Logic

```typescript
const { liked, recommended } = useMemo(() => {
  const liked = listings
    .filter(l => l.isLiked)
    .sort((a, b) => b.fitScore - a.fitScore);
  const recommended = listings
    .filter(l => !l.isLiked)
    .sort((a, b) => b.fitScore - a.fitScore);
  return { liked, recommended };
}, [listings]);

return (
  <div className="space-y-8">
    {liked.length > 0 && (
      <section>
        <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2 mb-4">
          ❤️ {t.yourFavorites} 
          <span className="text-sm font-normal text-stone-500">({liked.length})</span>
        </h2>
        <PropertyGrid listings={liked} />
      </section>
    )}
    
    {liked.length > 0 && recommended.length > 0 && (
      <hr className="border-stone-200" />
    )}
    
    <section>
      <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2 mb-4">
        ✨ {t.recommendedForYou}
        <span className="text-sm font-normal text-stone-500">({recommended.length})</span>
      </h2>
      <PropertyGrid listings={recommended} />
    </section>
  </div>
);
```

---

## Data Sources

Unlike test-catalogue (which queries `leo-listings` DynamoDB directly), Mis Propiedades queries Supabase:

| Table | Purpose |
|-------|---------|
| `user_recommendations` | Leo's picks for this user (with fit scores) |
| `user_saved_listings` | Liked/saved status per listing |
| `property_notes` | User notes per listing |
| `user_lifestyle_profiles` | Heatmap data, preferences, weights |

---

## Route Structure

```
/dashboard                    → Mis Propiedades (grid view default)
/dashboard?view=map          → Map view
/dashboard#listing-{id}      → Detail view for specific listing
```

---

## Implementation Checklist

- [ ] Create `UserProfileSidebar.tsx` component
- [ ] Create `FitScoreReasoning.tsx` component  
- [ ] Create `LinkButton.tsx` component
- [ ] Adapt `PropertyCard` → `UserPropertyCard` with fit score
- [ ] Add liked segregation to grid view
- [ ] Integrate `NotesPanel` (from P0-10) into detail view
- [ ] Enable always-on heatmap layer on maps
- [ ] Connect to Supabase tables instead of DynamoDB
- [ ] Add mobile notes toggle view
- [ ] Test responsive layouts

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md) | Card design patterns, carousel |
| [P0-10-NOTES-SYSTEM](./P0-10-NOTES-SYSTEM.md) | Notes architecture, Leo's two cents |
| [P0-03-RECOMMENDER](./P0-03-RECOMMENDER.md) | Fit scoring algorithm |
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | Heatmap colors and logic |
| [P0-11-USER-TYPES-FLOWS](./P0-11-USER-TYPES-FLOWS.md) | User routes and flows |

---

*Last Updated: December 2024*
