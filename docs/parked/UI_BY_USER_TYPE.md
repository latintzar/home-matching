# UI by User Type - Complete Breakdown

**Last Updated**: December 2, 2025  
**Status**: DRAFT - Iterating with user feedback

> **📌 See also**: P0_LEAN_APP.md (`./P0_LEAN_APP.md`, historical reference) - Consolidated P0 MVP spec with routes, components, and build checklist

---

## Overview

Leo serves 4 distinct user types, each with different UI needs:

| User Type | Pricing | Core Value |
|-----------|---------|------------|
| **Renter** | €10/mo | Find rentals that fit your lifestyle |
| **Buyer** | €20/mo | Same + viewing checklists + renovation explorer |
| **Personal Shopper** | €X/client | Manage multiple clients, build shortlists |
| **Relocation Agent** | Enterprise | Team management, assignee briefs, analytics |

---

## 1. RENTER (€10/mo)

### Pages Needed

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| **Landing** | `/` → Renters tab | ✅ Built | Value prop, CTA to intake |
| **Intake** | `/recommend/intake` | ✅ Built | Voice/chat conversation with Leo |
| **Dashboard** | `/dashboard` | ❌ NEW | Home base: searches, alerts, activity |
| **Recommendations Feed** | `/recommend` | ⚠️ Partial | Properties Leo found, with fit scores |
| **Property Card** | (component) | ❌ NEW | Quick view card with fit score + reasons |
| **Property Detail** | `/property/[id]` | ⚠️ Exists | Needs DynamoDB version for harvested listings |
| **Post-Viewing Feedback** | `/feedback/[id]` | ❌ NEW | Rate viewing, add notes/photos |
| **Profile Settings** | `/settings/profile` | ❌ NEW | Edit preferences, delivery method |
| **Saved Properties** | `/saved` | ❌ NEW | Bookmarked listings |
| **Viewing History** | `/viewings` | ❌ NEW | Past viewings with feedback |
| **Sign In/Up** | `/auth/signin` | ❌ NEW | Supabase Auth |

### User Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        RENTER FLOW                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Homepage (/) ──────► Intake (Leo) ──────► Dashboard          │
│       │                    │                   │              │
│       │                    │                   ▼              │
│       │                    │           Recommendations        │
│       │                    │                   │              │
│       │                    ▼                   ▼              │
│       │            Profile created     Property Detail        │
│       │                                        │              │
│       │                                        ▼              │
│       │                               Book Viewing (external) │
│       │                                        │              │
│       │                                        ▼              │
│       │                               Post-Viewing Feedback   │
│       │                                        │              │
│       │                                        ▼              │
│       │                               Leo learns → Better recs│
│       │                                                       │
│       └────────────────────────────────────────────────────── │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Dashboard Components

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 Leo                                    [Settings] [Logout] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Hola, María! 👋                                               │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│  │ 🔔 New Matches      │  │ 📊 Your Search                  │ │
│  │                     │  │                                  │ │
│  │ 3 new properties    │  │ Areas: Chamberí, Malasaña       │ │
│  │ since yesterday     │  │ Budget: €1,200/mo               │ │
│  │                     │  │ Bedrooms: 1-2                   │ │
│  │ [View All →]        │  │                                  │ │
│  └─────────────────────┘  │ [Edit Preferences]              │ │
│                           └─────────────────────────────────┘ │
│                                                                │
│  Recent Recommendations                                        │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ [Photo]  │ │ [Photo]  │ │ [Photo]  │ │ [Photo]  │         │
│  │ €1,100   │ │ €1,250   │ │ €950     │ │ €1,180   │         │
│  │ Chamberí │ │ Malasaña │ │ Trafalgar│ │ Chueca   │         │
│  │ 🟢 87%   │ │ 🟢 82%   │ │ 🟡 71%   │ │ 🟢 79%   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  [See All Recommendations →]                                   │
│                                                                │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  ❤️ Saved (4)          📅 Viewings (2)          📝 Feedback   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Property Card Component

```
┌─────────────────────────────────────────────────────┐
│  [Photo Carousel]                          ❤️ Save  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  €1,100/mo · 2 hab · 65m² · Chamberí               │
│  Calle Fuencarral 42, 3º izq                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🟢 87% Match                                  │ │
│  │                                               │ │
│  │ ✓ 12 min walk to your gym                    │ │
│  │ ✓ Quiet interior courtyard                   │ │
│  │ ✓ Good natural light (south-facing)          │ │
│  │ ⚠️ 3rd floor, no lift (you said "prefer")    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [View Details]        [Contact Agent →]           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Post-Viewing Feedback

```
┌─────────────────────────────────────────────────────┐
│  📝 How was the viewing?                            │
│                                                     │
│  Calle Fuencarral 42, Chamberí                     │
│  Viewed: Today at 11:00                            │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Overall feeling:                                   │
│  😍  😊  😐  😕  😞                                  │
│                                                     │
│  What stood out?                                    │
│  [Light ✓] [Layout] [Location ✓] [Noise] [Vibe ✓] │
│  [Building] [Street] [Size] [Condition]            │
│                                                     │
│  Quick notes:                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Loved the light in the living room. Kitchen   │ │
│  │ smaller than expected. Neighbours seem quiet. │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  📷 Add photos from your visit                     │
│  [+ Add Photos]                                    │
│                                                     │
│  [Save Feedback]                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. BUYER (€20/mo)

### Additional Pages (on top of Renter)

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| **Viewing Checklist** | `/checklist/[id]` | ❌ NEW | Tailored checklist for each property |
| **Comparison View** | `/compare` | ❌ NEW | Side-by-side candidate comparison |
| **Renovation Explorer** | `/property/[id]/renovation` | ⚠️ Exists | R1/R2/R3 tiers, before/after |
| **Decision Helper** | `/decide` | ❌ NEW | Pros/cons, patterns from viewings |

### User Flow (extends Renter)

```
┌──────────────────────────────────────────────────────────────┐
│                        BUYER FLOW                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  [Same as Renter until Property Detail]                       │
│                                                               │
│  Property Detail                                              │
│       │                                                       │
│       ├──────► "I'm interested" ──────► Viewing Checklist    │
│       │                                        │              │
│       │                                        ▼              │
│       │                               Use on viewing day      │
│       │                                        │              │
│       │                                        ▼              │
│       │                               Post-Viewing Feedback   │
│       │                                        │              │
│       │                                        ▼              │
│       │                               Comparison View         │
│       │                                        │              │
│       ├──────► "Almost works" ──────► Renovation Explorer    │
│       │                                        │              │
│       │                                        ▼              │
│       │                               See 3 tier options      │
│       │                                                       │
│       └──────► Decision Helper ──────► Final decision        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Viewing Checklist

```
┌─────────────────────────────────────────────────────┐
│  📋 Viewing Checklist                               │
│                                                     │
│  Calle Fuencarral 42, Chamberí                     │
│  Viewing: Tomorrow at 11:00                        │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  🏠 IN THE FLAT                                    │
│                                                     │
│  Living Room:                                       │
│  □ Check natural light at different times          │
│  □ Note noise from street when windows closed      │
│  □ Look for signs of damp on exterior walls        │
│                                                     │
│  Kitchen:                                           │
│  □ Check water pressure                            │
│  □ Note appliance condition                        │
│  □ Look at ventilation/extraction                  │
│                                                     │
│  Bathroom:                                          │
│  □ Check for mold around tiles                     │
│  □ Test hot water                                  │
│  □ Note window/ventilation                         │
│                                                     │
│  🏢 BUILDING & COMMUNITY                           │
│                                                     │
│  □ Read last 3 community meeting minutes           │
│  □ Ask about planned works (derrama)               │
│  □ Check lift condition, last inspection           │
│  □ Note state of entrance, mailboxes               │
│                                                     │
│  📝 QUESTIONS TO ASK                               │
│                                                     │
│  □ Why is the owner selling?                       │
│  □ How long has it been on market?                 │
│  □ Are there other interested parties?             │
│  □ Community fees and what they include?           │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ⚠️ SPECIFIC TO THIS PROPERTY                      │
│                                                     │
│  • Building is from 1965 - check for aluminum      │
│    window frames (may need replacement)            │
│  • Ground floor: verify humidity in walls          │
│  • Ask about recent ITE inspection                 │
│                                                     │
│  [Start Viewing] - opens interactive checklist     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Comparison View

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚖️ Compare Your Candidates                                         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  │ Fuencarral 42     │ Gran Vía 18       │ Malasaña 7       │      │
│  │────────────────────│───────────────────│──────────────────│      │
│  │ [Photo]           │ [Photo]           │ [Photo]          │      │
│  │ €320,000          │ €345,000          │ €298,000         │      │
│  │ 🟢 87%            │ 🟢 82%            │ 🟡 74%           │      │
│  │────────────────────│───────────────────│──────────────────│      │
│  │ Light: ⭐⭐⭐⭐⭐    │ Light: ⭐⭐⭐⭐     │ Light: ⭐⭐⭐      │      │
│  │ Layout: ⭐⭐⭐⭐     │ Layout: ⭐⭐⭐⭐⭐   │ Layout: ⭐⭐⭐⭐    │      │
│  │ Location: ⭐⭐⭐⭐   │ Location: ⭐⭐⭐    │ Location: ⭐⭐⭐⭐⭐ │      │
│  │ Condition: ⭐⭐⭐   │ Condition: ⭐⭐⭐⭐  │ Condition: ⭐⭐    │      │
│  │────────────────────│───────────────────│──────────────────│      │
│  │ Your notes:        │ Your notes:       │ Your notes:      │      │
│  │ "Loved the light"  │ "Noisy street"    │ "Needs work"     │      │
│  │────────────────────│───────────────────│──────────────────│      │
│  │ Reno potential:    │ Reno potential:   │ Reno potential:  │      │
│  │ Minor (€15k)       │ None needed       │ Major (€45k)     │      │
│  └────────────────────┴───────────────────┴──────────────────┘      │
│                                                                     │
│  💡 Pattern Leo noticed:                                           │
│  "You consistently rate natural light highly and compromise on     │
│   location. Fuencarral 42 best matches this pattern."              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. PERSONAL SHOPPER / BUYER AGENT (€X/client)

### Pages Needed

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| **Pro Dashboard** | `/pro` | ❌ NEW | Overview: clients, recent activity |
| **Client List** | `/pro/clients` | ❌ NEW | All their clients |
| **Client Profile** | `/pro/clients/[id]` | ❌ NEW | Full life profile, preferences |
| **Add Client** | `/pro/clients/new` | ❌ NEW | Create + send intake link |
| **Shortlist Builder** | `/pro/clients/[id]/shortlist` | ❌ NEW | Curated properties for client |
| **Property Fit Check** | `/pro/property/[id]?client=[id]` | ❌ NEW | Fit analysis for specific client |
| **Shared Checklist** | `/pro/checklist/[id]` | ❌ NEW | Agent + client see same checklist |
| **Viewing Notes** | `/pro/viewings` | ❌ NEW | All client viewings + feedback |
| **Chrome Extension** | (extension) | ❌ NEW | "Send to Leo" while browsing |
| **Client Invite Link** | `/invite/[code]` | ❌ NEW | Branded intake for their client |

### User Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    PERSONAL SHOPPER FLOW                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Pro Dashboard                                                │
│       │                                                       │
│       ├──────► Add Client                                    │
│       │            │                                          │
│       │            ▼                                          │
│       │       Send Intake Link ──────► Client talks to Leo   │
│       │            │                           │              │
│       │            │                           ▼              │
│       │            │                    Profile populated     │
│       │            │                           │              │
│       │            ▼                           │              │
│       │       Client Profile ◄─────────────────┘              │
│       │            │                                          │
│       │            ▼                                          │
│       ├──────► Browse Portals (with Extension)               │
│       │            │                                          │
│       │            ▼                                          │
│       │       Extension shows fit hint per listing           │
│       │            │                                          │
│       │            ▼                                          │
│       │       "Send to Leo" ──────► Shortlist                │
│       │                                  │                    │
│       │                                  ▼                    │
│       │                           Share with client           │
│       │                                  │                    │
│       │                                  ▼                    │
│       │                           Generate Checklist          │
│       │                                  │                    │
│       │                                  ▼                    │
│       │                           Viewing (both record)       │
│       │                                  │                    │
│       └──────────────────────────────────┘                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Pro Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 Leo for Agents                         [Account] [Logout]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Buenos días, Carlos! 👋                                       │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│  │ 👥 Active Clients   │  │ 📊 This Month                   │ │
│  │                     │  │                                  │ │
│  │ 8 clients           │  │ 12 properties analyzed          │ │
│  │ 3 need attention    │  │ 6 viewings scheduled            │ │
│  │                     │  │ 2 deals closing                 │ │
│  │ [View All →]        │  │                                  │ │
│  └─────────────────────┘  └─────────────────────────────────┘ │
│                                                                │
│  Recent Activity                                               │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  • María García viewed Fuencarral 42 - awaiting feedback      │
│  • New property added to Pedro's shortlist                    │
│  • Ana completed her intake - profile ready                   │
│  • Luis rejected 3 properties - "too noisy"                   │
│                                                                │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  Clients Needing Attention                                     │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ María García          │ No viewings scheduled            │ │
│  │ Budget: €400k         │ 5 properties in shortlist        │ │
│  │ Looking: 3 months     │ [View Profile] [Add Property]    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [+ Add New Client]                                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Chrome Extension

```
┌─────────────────────────────────┐
│  🏠 Leo for Agents              │
├─────────────────────────────────┤
│                                 │
│  Active Client:                 │
│  ┌───────────────────────────┐  │
│  │ María García          ▼  │  │
│  └───────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│                                 │
│  This listing:                  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🟢 Strong Match (82%)     │  │
│  │                           │  │
│  │ ✓ Location fits commute   │  │
│  │ ✓ 2+ bedrooms            │  │
│  │ ✓ Within budget          │  │
│  │ ⚠️ Ground floor (check)   │  │
│  │ ⚠️ Building from 1960     │  │
│  └───────────────────────────┘  │
│                                 │
│  [Send to María's Shortlist]    │
│                                 │
│  [See Full Analysis]            │
│                                 │
├─────────────────────────────────┤
│                                 │
│  Quick Actions:                 │
│  [+ Add New Client]             │
│  [View All Clients]             │
│                                 │
└─────────────────────────────────┘
```

### Pro-Led Intake (Different Leo Agent)

**Key Insight**: Pros can do the intake on behalf of their client. Leo behaves differently:

| Aspect | Consumer Intake | Pro-Led Intake |
|--------|-----------------|----------------|
| **Who talks** | The end user | The pro (about their client) |
| **Leo's tone** | Friendly, exploratory | Collaborative, strategic |
| **Questions** | "Tell me about your day..." | "Tell me about your client..." |
| **Expertise** | Leo guides discovery | Pro has experience, Leo assists |
| **Flexibility Qs** | "Could YOU stretch budget?" | "What do you think is realistic?" |
| **Strategy** | Leo suggests | Pro + Leo discuss together |

**Pro-Led Intake Flow**:
```
┌──────────────────────────────────────────────────────────────┐
│                    PRO-LED INTAKE                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Pro clicks "Add Client" → chooses:                          │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │ Send intake link    │  │ Do intake myself    │            │
│  │ to client           │  │ (I know them well)  │            │
│  └─────────────────────┘  └─────────────────────┘            │
│           │                         │                         │
│           ▼                         ▼                         │
│  Client talks to Leo       Pro talks to Leo (Pro Agent)      │
│  (Consumer Agent)          "Tell me about your client..."    │
│           │                         │                         │
│           ▼                         ▼                         │
│  Profile saved              Profile saved                     │
│                                                               │
│  [Same data structure, different conversation]                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Pro Agent System Prompt Differences**:

```text
CONSUMER AGENT:
"Eres Leo, un amigo que ayuda a la gente a encontrar casa..."
- Asks about THEIR life
- Treats them as the expert on their own needs
- Discovers preferences through conversation

PRO AGENT:
"Eres Leo, un asistente para personal shoppers inmobiliarios..."
- Asks about THE CLIENT
- Treats the pro as the expert with experience
- Validates pro's intuition, adds data perspective
- "Based on what you know about similar clients..."
- "What's your gut feeling on their flexibility?"
- Still does check_availability and flexibility questions
```

**Pro Agent Example Dialogue**:

```
Leo (Pro): "Cuéntame sobre tu cliente. ¿Qué tipo de búsqueda es?"

Pro: "Es una familia, pareja con dos niños. Están alquilando en 
      Chamberí pero quieren comprar."

Leo (Pro): "Vale, familia con niños. ¿Qué presupuesto manejan?"

Pro: "Sobre 450k, pero creo que podrían estirar un poco."

Leo (Pro): "Genial. ¿Y qué zonas han mencionado?"

Pro: "Les gusta Chamberí pero están abiertos. Los niños van al 
      colegio en Alonso Martínez."

Leo (Pro): "Entendido. Déjame ver qué hay disponible..."
           [calls check_availability]

Leo (Pro): "Tengo 8 opciones en la zona. No es mucho, pero hay 
           movimiento. Basándote en tu experiencia con este tipo 
           de cliente, ¿crees que considerarían barrios como 
           Trafalgar o Ríos Rosas? Están cerca del cole."

Pro: "Sí, Trafalgar seguro. Ríos Rosas quizás les quede lejos 
     para el día a día."

Leo (Pro): "Perfecto, añado Trafalgar. ¿Y en cuanto a la vivienda,
           qué crees que priorizan más: metros o ubicación?"

Pro: "Ubicación. Con dos niños pequeños, no quieren depender 
     del coche."
```

**Key Differences in Opportunity Questions**:

| Consumer Agent | Pro Agent |
|----------------|-----------|
| "¿Podrías estirar hasta €X?" | "¿Crees que podrían estirar?" |
| "¿Considerarías Malasaña?" | "¿Les encajaría Malasaña?" |
| "¿Funcionaría con 1 habitación?" | "¿Qué mínimo de habs ves realista?" |

**Same Backend, Different Prompt**:
- Both agents call the same `check_availability` endpoint
- Both generate the same profile structure
- Different ElevenLabs agent IDs:

| Agent | ID | Route |
|-------|-----|-------|
| **Leo Intake v2** (consumers) | `recipient-owned-agent-id` | `/recommend/intake` |
| **Leo Pro Intake** (professionals) | `recipient-owned-agent-id` | `/pro/clients/new/intake` |

### Client Profile

```
┌────────────────────────────────────────────────────────────────┐
│  👤 María García                           [Edit] [Share Link] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Status: Active · Looking since: Oct 2024 · Budget: €400k     │
│                                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                │
│  📍 LOCATIONS                                                  │
│  Primary: Chamberí, Malasaña                                  │
│  Would consider: Trafalgar, Chueca                            │
│  Commute to: Calle Serrano (office) - max 25 min              │
│                                                                │
│  🏠 PROPERTY                                                   │
│  Type: Apartment                                               │
│  Bedrooms: 2-3                                                 │
│  Min sqm: 80                                                   │
│  Floor: Any with lift, or max 2nd without                     │
│                                                                │
│  ❌ DEALBREAKERS                                               │
│  • No ground floor                                             │
│  • No busy street facing                                       │
│  • No buildings pre-1950 without recent rehab                 │
│                                                                │
│  💡 LIFESTYLE NOTES                                            │
│  • Works hybrid (3 days office)                               │
│  • Has a dog - needs nearby green space                       │
│  • Entertains frequently - wants open kitchen                 │
│  • Light is top priority                                       │
│                                                                │
│  🔄 FLEXIBILITY (from opportunity questions)                   │
│  • Could stretch to €440k for perfect location                │
│  • Would accept 1 bedroom if large enough                     │
│  • Open to minor renovation                                    │
│                                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                │
│  📋 SHORTLIST (5 properties)           [+ Add Property]        │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ [Photo]  │ │ [Photo]  │ │ [Photo]  │ │ [Photo]  │ ...     │
│  │ 🟢 87%   │ │ 🟢 82%   │ │ 🟡 74%   │ │ 🟢 79%   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  📅 VIEWINGS                                                   │
│  • Fuencarral 42 - Tomorrow 11:00 [Checklist Ready]           │
│  • Gran Vía 18 - Pending scheduling                           │
│                                                                │
│  📝 RECENT FEEDBACK                                            │
│  • Rejected "Malasaña 23" - too noisy                         │
│  • Loved "Chamberí 45" but over budget                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. RELOCATION AGENT / DSP (Enterprise)

### Additional Pages (on top of Personal Shopper)

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| **Team Dashboard** | `/team` | ❌ NEW | Multi-consultant overview |
| **Assignee List** | `/team/assignees` | ❌ NEW | All relocating employees |
| **Assignee Profile** | `/team/assignees/[id]` | ❌ NEW | Housing brief for assignee |
| **Partner Handoff** | `/team/handoff/[id]` | ❌ NEW | Share brief with local partner |
| **City Playbooks** | `/team/playbooks` | ❌ NEW | What works in each city |
| **Analytics** | `/team/analytics` | ❌ NEW | Acceptance rates, patterns |
| **Branded Intake** | `/intake/[company-slug]` | ❌ NEW | Whitelabel intake |

### User Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    RELOCATION FLOW                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  HR/Mobility Manager                                          │
│       │                                                       │
│       ▼                                                       │
│  Add Assignee ──────► Branded Leo link sent to assignee      │
│                              │                                │
│                              ▼                                │
│                       Leo interviews (in their language)      │
│                              │                                │
│                              ▼                                │
│                       Housing Brief generated                 │
│                              │                                │
│       ┌──────────────────────┼──────────────────────┐        │
│       ▼                      ▼                      ▼        │
│  Internal DSP         Local Partner          Analytics       │
│  sees brief           receives handoff       updated         │
│       │                      │                               │
│       ▼                      ▼                               │
│  Proposes options     Proposes options                       │
│       │                      │                               │
│       └──────────┬───────────┘                               │
│                  ▼                                            │
│           Leo checks fit                                      │
│                  │                                            │
│                  ▼                                            │
│           Assignee viewings                                   │
│                  │                                            │
│                  ▼                                            │
│           Feedback captured                                   │
│                  │                                            │
│                  ▼                                            │
│           Analytics: "What works for [segment] in [city]?"   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Team Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 Leo for [Company Name]                 [Settings] [Admin]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Team Overview                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ 45       │ │ 12       │ │ 8        │ │ 92%      │         │
│  │ Active   │ │ In       │ │ Completed│ │ First-   │         │
│  │ Assignees│ │ Progress │ │ This Mo  │ │ round OK │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  By City                                                       │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  │ Madrid     │████████████████████│ 28 assignees             │
│  │ Barcelona  │██████████│ 12 assignees                       │
│  │ Valencia   │████│ 5 assignees                              │
│                                                                │
│  Recent Activity                                               │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  • Klaus Weber (SAP) completed intake - Madrid brief ready    │
│  • Handoff sent to Barcelona partner for Anna Schmidt         │
│  • 3 viewings scheduled for tomorrow                          │
│                                                                │
│  [View All Assignees] [Analytics] [City Playbooks]            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Analytics

```
┌────────────────────────────────────────────────────────────────┐
│  📊 Analytics                              [Export] [Filter]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Time Period: Last 6 months                   City: All ▼     │
│                                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                │
│  ACCEPTANCE METRICS                                            │
│                                                                │
│  First-round acceptance rate:  92%  (↑ 8% vs last period)     │
│  Avg viewings to acceptance:   2.3  (↓ 0.5 vs last period)    │
│  Avg days to settled:          18   (↓ 3 vs last period)      │
│                                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                │
│  WHAT WORKS BY SEGMENT                                         │
│                                                                │
│  German Engineers (n=15):                                      │
│  • Prefer: Eixample, Poblenou                                  │
│  • Avoid: Gothic (too noisy)                                   │
│  • Common request: Home office space                           │
│                                                                │
│  US Executives (n=8):                                          │
│  • Prefer: Salamanca, Chamberí                                 │
│  • Avoid: Buildings pre-1980                                   │
│  • Common request: Doorman, parking                            │
│                                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                │
│  TOP REJECTION REASONS                                         │
│                                                                │
│  1. Street noise (23%)                                         │
│  2. Kitchen too small (18%)                                    │
│  3. Not enough natural light (15%)                            │
│  4. Building too old (12%)                                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Build Priority

### Phase 1 - Consumer MVP (Renter + Buyer basics)

**Timeline**: 2-3 weeks

```
1. Dashboard (simple version)
2. Recommendations Feed (with property cards)
3. Property Card component
4. Property Detail (DynamoDB version)
5. Saved Properties
6. Auth (Sign in/up with Supabase)
7. Profile Settings
```

### Phase 2 - Buyer Extras

**Timeline**: 1-2 weeks

```
1. Viewing Checklist
2. Post-Viewing Feedback
3. Comparison View
4. Connect existing Renovation Explorer
```

### Phase 3 - Personal Shopper

**Timeline**: 3-4 weeks

```
1. Pro Dashboard
2. Client List + Profiles
3. Add/Edit Client flow
4. Shortlist Builder
5. Chrome Extension (MVP)
6. Shared Checklist
7. Client Invite Links
```

### Phase 4 - Relocation (Enterprise)

**Timeline**: 4-6 weeks

```
1. Team Dashboard
2. Assignee management
3. Partner Handoff
4. Branded Intake
5. Analytics
6. City Playbooks
```

---

## 🎨 Design System Notes

### Inspiration: Jack & Jill (app.jacknjill.ai)

**Sidebar Design** — Simple, clean, minimal:
- Logo at top
- Main nav items with icons (Dashboard, Clients, Profile, Settings)
- User avatar + email at bottom with dropdown (Manage account, Get help, Sign out)
- Collapsed state on mobile
- **Key insight**: During onboarding/intake, sidebar is MINIMAL (just logo + exit)

**Sign-in Split** — Different buttons for different user types:
```
┌─────────────────────────────────────────┐
│                                         │
│           🏠 Leo.casa                   │
│                                         │
│     Find your next home in Spain        │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Sign in as Renter / Buyer     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Sign in as Professional       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Professional = Personal Shoppers,      │
│  Relocation Agents, Property Managers   │
│                                         │
└─────────────────────────────────────────┘
```

**Onboarding Sidebar State** — Minimal during Leo conversation:
```
┌─────────────────────────────────────────────────────────────┐
│ NORMAL APP STATE              │ DURING ONBOARDING/INTAKE    │
├───────────────────────────────┼─────────────────────────────┤
│                               │                             │
│ 🏠 Leo.casa                   │ 🏠 Leo.casa                 │
│                               │                             │
│ 📊 Dashboard                  │ [Exit ×]                    │
│ 🏠 Recommendations            │                             │
│ ❤️ Saved                      │ ┌─────────────────────────┐ │
│ 📅 Viewings                   │ │                         │ │
│ ⚙️ Settings                   │ │   [Leo Voice Orb]       │ │
│                               │ │                         │ │
│ ─────────────────             │ │   Conversation with     │ │
│ 👤 María García               │ │   Leo takes full        │ │
│    operator@example.invalid            │ │   screen focus          │ │
│                               │ │                         │ │
│                               │ └─────────────────────────┘ │
│                               │                             │
└───────────────────────────────┴─────────────────────────────┘
```

**Voice Call Copy** (from Jack & Jill):
- "Kickoff with Leo" — start intake button
- "Speak with Leo" / "Join call with Leo"
- "Ready" status indicator
- Our animated orb is better than theirs, keep it

### Colors (from existing landing)
- Primary: Green (`#6DB035`)
- Secondary: Peach/Coral (`#F5CABB`)
- Text: Dark gray/black
- Background: White with subtle gradients

### Components to Reuse
- Button (shadcn)
- Card (shadcn)
- Input/Form (shadcn)
- Navigation (from landing)
- Voice orb (from intake)

### New Components Needed
- Property Card
- Fit Score Badge
- Checklist Item
- Feedback Rating
- Comparison Table
- Activity Feed Item
- Client Card (for pros)
- Sidebar (with collapsed onboarding state)

---

## ✅ IMPLEMENTED: Leo Pro Agent

**Agent Created**: December 1, 2024

| Agent | ID | Use Case |
|-------|-----|----------|
| **Leo Intake v2** | `recipient-owned-agent-id` | Direct users (renters/buyers) |
| **Leo Pro Intake** | `recipient-owned-agent-id` | Professionals (personal shoppers & relocation agents) |

Both agents:
- Use the same `check_availability` tool
- Generate the same profile structure
- Support ES/EN (multilingual)

Key differences in Pro Agent:
- Asks "about your client" not "about you"
- Treats the pro as the expert
- Reformulates flexibility questions for strategic discussion
- Asks who to send properties to (pro, client, or both)

---

## 🚧 UI Components Now Needed

### 1. Pro Client Add Page (`/pro/clients/new`)

Two paths for adding a client:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Add New Client                                             │
│                                                             │
│  How do you want to create this client's profile?           │
│                                                             │
│  ┌───────────────────────┐  ┌───────────────────────────┐  │
│  │                       │  │                           │  │
│  │  📧 Send intake link  │  │  🎙️ Do intake myself      │  │
│  │                       │  │                           │  │
│  │  Client talks to Leo  │  │  I talk to Leo about      │  │
│  │  directly             │  │  my client                │  │
│  │                       │  │                           │  │
│  └───────────────────────┘  └───────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Path A: Send Intake Link**
- Pro enters client name + email
- System generates unique link: `/invite/[code]?agent=consumer`
- Client receives email with link
- Client talks to Leo Intake v2 (consumer agent)
- Profile gets associated with pro's account

**Path B: Do Intake Myself**
- Pro clicks → goes to `/pro/clients/new/intake`
- Uses Leo Pro Intake agent (`recipient-owned-agent-id`)
- Leo asks about "your client"
- Pro creates profile on behalf of client

### 2. Pro Intake Page (`/pro/clients/new/intake`)

Same structure as `/recommend/intake` but:
- Uses `AGENT_ID = 'recipient-owned-agent-id'` (Pro Agent)
- Different first message from Leo
- Creates profile linked to pro's account
- After completion, redirects to client profile page

### 3. Client Invite Page (`/invite/[code]`)

- Validates invite code
- Shows branded experience (pro's name/logo optional)
- Uses Leo Intake v2 (consumer agent)
- After completion, profile linked to pro

### 4. Pro Dashboard Updates

Add "Add Client" button that leads to `/pro/clients/new`

---

## Questions / Decisions Needed

1. **Dashboard vs Feed**: Should recommendations be on dashboard or separate page?
2. **Checklist format**: PDF download vs interactive in-app?
3. **Extension**: Chrome only or also Firefox/Safari?
4. **Pricing for Personal Shoppers**: Per client? Monthly? Tiered?
5. **Enterprise onboarding**: Self-serve or sales-led?
6. **Mobile**: Responsive web only or native app later?
7. ~~**Pro Agent**: Separate ElevenLabs agent ID, or same agent with dynamic prompt?~~ ✅ **DONE** - Separate agent
8. **Sidebar during intake**: Completely hidden, or minimal (logo + exit)?

---

## Changelog

| Date | Change |
|------|--------|
| Dec 1, 2024 | Initial draft with all 4 user types |
| Dec 1, 2024 | Added Jack & Jill inspiration (sidebar, sign-in split, onboarding state) |
| Dec 1, 2024 | Added Pro-Led Intake flow with different Leo agent behavior |
| Dec 1, 2024 | **Leo Pro Agent created** - `recipient-owned-agent-id` |
| Dec 1, 2024 | Added concrete UI specs for Pro Client Add page and intake flows |


