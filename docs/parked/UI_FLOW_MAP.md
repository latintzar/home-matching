# Leo.casa UI Flow Map

## 🗺️ Complete Flow Diagram

```
                                    ┌─────────────────────────────────┐
                                    │         HOMEPAGE (/)            │
                                    │   http://localhost:3003/        │
                                    │                                 │
                                    │  [Dev Mode: Login As...] button │
                                    │         appears top-right       │
                                    └───────────────┬─────────────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
                    │    COMPRADOR    │   │    INQUILINO    │   │   PROFESIONAL   │
                    │    (Buyer)      │   │    (Renter)     │   │      (Pro)      │
                    └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
                             │                     │                     │
                             └──────────┬──────────┘                     │
                                        │                                │
                                        ▼                                ▼
                    ┌───────────────────────────────┐     ┌───────────────────────────────┐
                    │       NON-PRO FLOW            │     │         PRO FLOW              │
                    └───────────────────────────────┘     └───────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════
                                NON-PRO USER FLOW
═══════════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   1. SIGN IN                          2. PROFILE                                    │
│   /auth/signin                        /profile                                      │
│   localhost:3003/auth/signin          localhost:3003/profile                        │
│                                                                                     │
│   ┌─────────────────────────┐        ┌─────────────────────────────────────────┐   │
│   │  🏠 Iniciar sesión       │        │  👤 Mi Perfil                           │   │
│   │                         │        │                                         │   │
│   │  Email: [__________]    │───────▶│  📋 Lo que entendí (summary)            │   │
│   │                         │        │  🗺️ Tus zonas (isochrone map)           │   │
│   │  [Enviar magic link]    │        │  📊 Stats & preferences                 │   │
│   └─────────────────────────┘        └───────────────┬─────────────────────────┘   │
│                                                      │                             │
│                                                      ▼                             │
│   3. SHORTLIST                        4. PROPERTY DETAIL                           │
│   /shortlist                          /property/[id]                               │
│   localhost:3003/shortlist            localhost:3003/property/listing-001          │
│                                                                                     │
│   ┌─────────────────────────────┐    ┌─────────────────────────────────────────┐   │
│   │  📋 Mi Shortlist             │    │  🏠 Gran Via 42                         │   │
│   │                             │    │                                         │   │
│   │  [Property Card] 91% ──────────▶│  Photos, details, fit score             │   │
│   │  [Property Card] 78%        │    │                                         │   │
│   │  [Property Card] 74%        │    │  [Quiero verlo] → Contact agent        │   │
│   │                             │    └───────────────┬─────────────────────────┘   │
│   └─────────────────────────────┘                    │                             │
│                                                      ▼                             │
│   5. VIEWING NOTES                                                                 │
│   /viewing/[id]                                                                    │
│   localhost:3003/viewing/listing-001                                               │
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐ │
│   │  📝 Notas de la visita                                                       │ │
│   │                                                                             │ │
│   │  [💬 Text note] "El agente dice que la ITE está pasada..."                  │ │
│   │  [📷 Photo]     Grieta en techo salón                                       │ │
│   │  [🎤 Voice]     0:12 "El ruido de la Gran Via..."                           │ │
│   │                                                                             │ │
│   │  [📷] [🎤] [Escribe una nota...]                                            │ │
│   │                                                                             │ │
│   │  [✓ He terminado la visita]                                                 │ │
│   └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════
                                   PRO USER FLOW
═══════════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   1. PRO DASHBOARD                                                                  │
│   /pro/dashboard                                                                    │
│   localhost:3003/pro/dashboard                                                      │
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐ │
│   │  🏠 Leo Pro                                                    [Settings]    │ │
│   │                                                                             │ │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐                                        │ │
│   │  │ 👥 5    │ │ 🏠 23   │ │ 📊 4    │    Stats cards                         │ │
│   │  │Clientes │ │ Pisos   │ │Análisis │                                        │ │
│   │  └─────────┘ └─────────┘ └─────────┘                                        │ │
│   │                                                                             │ │
│   │  🔔 NOTIFICACIONES                                                          │ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│   │  │ ⭐ Juan Pérez quiere ver Gran Via 42              [Ver piso]        │   │ │
│   │  └─────────────────────────────────────────────────────────────────────┘   │ │
│   │                                                                             │ │
│   │  👥 MIS CLIENTES                                                            │ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│   │  │ [👤] Juan Pérez         Comprando • Madrid • €300-400k        [→]  │───┐│ │
│   │  └─────────────────────────────────────────────────────────────────────┘   ││ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐   ││ │
│   │  │ [👤] Ana López          Alquilando • Barcelona                [→]  │   ││ │
│   │  └─────────────────────────────────────────────────────────────────────┘   ││ │
│   │                                                                             ││ │
│   │                    [+ Añadir nuevo cliente] ───────────────────────────────┐││ │
│   │                                                                            │││ │
│   └────────────────────────────────────────────────────────────────────────────┘││ │
│                                                                                 ││ │
│                                    ┌────────────────────────────────────────────┘│ │
│                                    │                                             │ │
│   2. ADD CLIENT                    │    3. CLIENT PROFILE                        │ │
│   /pro/clients/new                 │    /pro/clients/[id]                        │ │
│   localhost:3003/pro/clients/new   │    localhost:3003/pro/clients/client-001    │ │
│                                    │                                             │ │
│   ┌────────────────────────────┐   │   ┌─────────────────────────────────────┐  │ │
│   │  + Añadir Nuevo Cliente    │   │   │  👤 Juan Pérez                      │  │ │
│   │                            │   │   │     Comprando en Madrid             │  │ │
│   │  Nombre: [__________]      │   │   │                                     │  │ │
│   │  Email:  [__________]      │   │   │  📋 Resumen de lo que busca        │  │ │
│   │  Phone:  [__________]      │   │   │  🎯 Criterios clave                │  │ │
│   │                            │   └──▶│                                     │  │ │
│   │  ¿Cómo hacer la entrevista?│       │  📋 Su Shortlist (3 pisos)         │  │ │
│   │                            │       │  ┌───────────────────────────────┐  │  │ │
│   │  [🎤 Yo hago la llamada]   │       │  │ Gran Via 42    78% ⭐         │──┼──┘ │
│   │  [📧 Enviar link]          │       │  │ Balmes 156     91% ✓         │  │    │
│   │                            │       │  │ Pau Claris     74% [Analizar]│  │    │
│   └────────────────────────────┘       │  └───────────────────────────────┘  │    │
│                                        │                                     │    │
│                                        │  [+ Añadir piso]                    │    │
│                                        │  [📤 Enviar shortlist al cliente]───┼────┐
│                                        │                                     │    │
│                                        │  🔗 Link: leo.casa/shortlist/abc123│    │
│                                        │  [Copiar] [Abrir]                   │    │
│                                        └─────────────────────────────────────┘    │
│                                                                                    │
└───────────────────────────────────────────────────────────────────────────────────┘
                                                                                     │
                                                                                     │
═══════════════════════════════════════════════════════════════════════════════════════
                              PUBLIC SHORTLIST (Client View)
═══════════════════════════════════════════════════════════════════════════════════════
                                                                                     │
┌───────────────────────────────────────────────────────────────────────────────────┘
│
│   PUBLIC SHORTLIST (No auth required!)
│   /shortlist/[token]
│   localhost:3003/shortlist/
│
│   ┌─────────────────────────────────────────────────────────────────────────────┐
│   │  🏠 Leo                                                                     │
│   │                                                                             │
│   │                    ¡Hola Juan! 👋                                           │
│   │         María García te ha preparado una selección de pisos                 │
│   │                                                                             │
│   │  💡 Marca los pisos que quieres ver y añade notas después de las visitas   │
│   │                                                                             │
│   │  ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  │  [Photo]                                             91% Fit Score  │   │
│   │  │  Balmes 156 • Salamanca, Madrid                                     │   │
│   │  │  92m² • 3 hab • 2 baños • €420,000                                  │   │
│   │  │                                                                     │   │
│   │  │  [⭐ Quiero verlo]  [📝 Notas]  [→]                                 │   │
│   │  └─────────────────────────────────────────────────────────────────────┘   │
│   │                                                                             │
│   │  ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  │  [Photo]                                             78% Fit Score  │   │
│   │  │  Gran Via 42 • Centro, Madrid                                       │   │
│   │  │  ⭐ Has marcado que quieres verlo                                   │   │
│   │  │                                                                     │   │
│   │  │  [✓ Marcado para ver]  [📝 3]  [→]                                 │   │
│   │  └─────────────────────────────────────────────────────────────────────┘   │
│   │                                                                             │
│   │                 [📞 Escribir a María García]                               │
│   │                                                                             │
│   └─────────────────────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────────────────────────


═══════════════════════════════════════════════════════════════════════════════════════
                                    QUICK LINKS
═══════════════════════════════════════════════════════════════════════════════════════

## Non-Pro Flow
| Page | URL |
|------|-----|
| Homepage | http://localhost:3003/ |
| Sign In | http://localhost:3003/auth/signin |
| Profile | http://localhost:3003/profile |
| Shortlist | http://localhost:3003/shortlist |
| Property Detail | http://localhost:3003/property/listing-001 |
| Viewing Notes | http://localhost:3003/viewing/listing-001 |

## Pro Flow  
| Page | URL |
|------|-----|
| Pro Dashboard | http://localhost:3003/pro/dashboard |
| Add Client | http://localhost:3003/pro/clients/new |
| Client Profile | http://localhost:3003/pro/clients/client-001 |
| Client Intake | http://localhost:3003/pro/clients/client-001/intake |

## Public (No Auth)
| Page | URL |
|------|-----|
| Public Shortlist | http://localhost:3003/shortlist/ |
| Viewing Notes (with token) | http://localhost:3003/viewing/listing-001?token= |

```

## 🔄 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   SUPABASE (User-facing)              DynamoDB (Bulk data)                     │
│   ├── auth.users                      ├── puedo-casa-listings                  │
│   ├── subscriptions                   ├── puedo-casa-analysis                  │
│   ├── pro_clients                     └── puedo-casa-wpa-cache                 │
│   ├── viewings                                                                  │
│   ├── analytics_events                                                          │
│   └── user_lifestyle_profiles                                                   │
│                                                                                 │
│                         ┌─────────────────────┐                                 │
│                         │   DATA ADAPTER      │                                 │
│                         │   (src/lib/data-    │                                 │
│                         │    adapter/index.ts)│                                 │
│                         └──────────┬──────────┘                                 │
│                                    │                                            │
│               ┌────────────────────┼────────────────────┐                       │
│               ▼                    ▼                    ▼                       │
│        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                │
│        │ Non-Pro UI   │    │   Pro UI     │    │ Public UI    │                │
│        │ /profile     │    │ /pro/*       │    │ /shortlist/* │                │
│        │ /shortlist   │    │              │    │              │                │
│        └──────────────┘    └──────────────┘    └──────────────┘                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

