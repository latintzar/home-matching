# P0-13: Core Implementation Tasks

> Detailed task breakdown for Tasks 1, 4, 5, 6, 7.

## Task 1: Speak with Leo Agents 🎙️

### 1.1 Onboarding State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING STATES                             │
├─────────────────────────────────────────────────────────────────┤
│ State 0: NOTHING_DONE                                           │
│   - User signed up but never talked to Leo                      │
│   - intake_step = 0, intake_completed = false                   │
│                                                                 │
│ State 1: CORE_STARTED                                           │
│   - User started onboarding but didn't finish core questions    │
│   - intake_step = 1-5, intake_completed = false                 │
│                                                                 │
│ State 2: CORE_FINISHED                                          │
│   - Core questions done, but whatifs not started                │
│   - intake_step = 6, whatifs_completed = false                  │
│                                                                 │
│ State 3: WHATIFS_FINISHED                                       │
│   - Full onboarding complete                                    │
│   - intake_completed = true, whatifs_completed = true           │
│                                                                 │
│ State 4+: FOLLOWUPS_ADDED                                       │
│   - User has had N follow-up conversations                      │
│   - followup_count = 1, 2, 3, ... N                            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Database Columns

```sql
-- Migration: 070_onboarding_states.sql (APPLIED)
intake_step INTEGER DEFAULT 0
whatifs_completed BOOLEAN DEFAULT FALSE
followup_count INTEGER DEFAULT 0
last_followup_at TIMESTAMPTZ
```

### 1.3 ElevenLabs Agents

| Agent | Profile Type | Purpose |
|-------|--------------|---------|
| `leo-intake-renter` | Renter | First-time renter intake |
| `leo-intake-buyer` | Buyer | First-time buyer intake |
| `leo-intake-renter-pro` | Renter | Pro's client renter intake |
| `leo-intake-buyer-pro` | Buyer | Pro's client buyer intake |
| `leo-whatifs-renter` | Renter | Explore renter tradeoffs |
| `leo-whatifs-buyer` | Buyer | Explore buyer tradeoffs |
| `leo-followup` | Both | Post-onboarding check-ins |

**Key Differences:**
- **Renter intake**: Focuses on lifestyle, commute, monthly budget, neighborhood vibe
- **Buyer intake**: Adds renovation appetite, investment vs living, total purchase budget

### 1.4 UI States

| State | Title | Agent | Sidebar Badge |
|-------|-------|-------|---------------|
| NOTHING_DONE | "Conoce a Leo" | `leo-intake-{profileType}` | 🔴 Red |
| CORE_STARTED | "Continúa donde lo dejaste" | `leo-intake-{profileType}` | 🔴 Red |
| CORE_FINISHED | "Exploremos algunos 'qué pasaría si'" | `leo-whatifs-{profileType}` | 🟡 Yellow |
| WHATIFS_FINISHED | "¿Hay algo que quieras actualizar?" | `leo-followup` | None |

### 1.5 Task 1 Checklist

- [x] Apply migration 070 (onboarding states)
- [x] Apply migration 075 (linked profiles)
- [x] Create all ElevenLabs agent configs (7 agents)
- [x] Create `/api/agents/context` endpoint
- [x] Create `/api/agents/update-profile` endpoint
- [x] Create `/api/profile/switch` endpoint
- [x] Create `/api/profile/create` endpoint
- [x] Update `SpeakWithLeoContent.tsx` with state machine
- [x] Update sidebar with profile-specific agents
- [x] Add notification badge to sidebar
- [x] Add profile switcher to sidebar
- [x] Add alert banners for incomplete states
- [x] Fix orb cropping issue
- [ ] **TODO**: Push new agents to ElevenLabs Dashboard

---

## Task 4: Property Liking Feature ❤️

### 4.1 Current State

- ✅ API exists: `/api/saved` (GET, POST, DELETE)
- ✅ Database table exists: `user_saved_properties`
- ⚠️ UI needs polish

### 4.2 UI Requirements

```
┌─────────────────────────────────────────────────────────────────┐
│ Property Card (in list)                                         │
├─────────────────────────────────────────────────────────────────┤
│ [Photo]                                                         │
│ €250,000 · 3 bed · 2 bath · 85m²                                │
│ Malasaña, Madrid                                                │
│                                              [♡] / [♥]          │
│                                              (toggles on click)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Property Page (detail view)                                     │
├─────────────────────────────────────────────────────────────────┤
│ [Guardar propiedad] button → becomes [♥ Guardada] when saved    │
│ Optimistic UI update (instant feedback)                         │
│ Toast notification on save/unsave                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Task 4 Checklist

- [x] Add heart icon toggle to PropertyCard component
- [x] Implement optimistic UI updates (instant feedback)
- [x] Add toast notifications for save/unsave (using Sonner)
- [x] Show "Guardada" state clearly on property page
- [ ] Add saved count to dashboard stats
- [ ] Create "Guardados" section in Propiedades page

---

## Task 5: Property Page Improvements 🏠

### 5.1 Show Property Description

```tsx
// In LeanPropertyContent.tsx, add after basic info:
<div className="mt-6">
  <h3 className="font-medium text-stone-900 mb-2">Descripción</h3>
  <p className="text-stone-600 whitespace-pre-wrap">
    {listing.description}
  </p>
</div>
```

### 5.2 Fullscreen Photo Viewer

Reference implementation: `src/app/test-recommendations-linear/`

Components needed:
- FullscreenPhotoViewer (modal/overlay)
- Photo carousel with navigation arrows
- Close button (X or click outside)
- Keyboard navigation (left/right arrows, ESC to close)
- Swipe on mobile

### 5.3 Task 5 Checklist

- [x] Add property description section
- [x] Import/adapt FullscreenPhotoViewer (PhotoGalleryModal)
- [x] Add click handler to photos to open fullscreen
- [x] Implement keyboard navigation (arrows, ESC)
- [ ] Test on mobile (swipe gestures)

---

## Task 6: Linked Profile Architecture 🔗

### 6.1 Database Migration (075_linked_profiles.sql)

```sql
-- Add profile_type to lifestyle_profiles
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter' 
  CHECK (profile_type IN ('renter', 'buyer'));

-- Unique constraint: (user_id, profile_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_profile_type 
  ON user_lifestyle_profiles(user_id, profile_type);

-- Track active profile at user level
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS active_profile_type TEXT DEFAULT 'renter';

-- Add profile_type to saved_properties
ALTER TABLE saved_properties
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter';

-- Move billing to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_type TEXT;
```

### 6.2 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/profile/switch` | POST | Switch active profile type |
| `/api/profile/create` | POST | Create second profile type |
| `/api/profile` | GET | Get active profile + other profiles |
| `/api/pro/link-request` | POST | Pro requests to link with Leo user |
| `/api/pro/approve-link` | POST | Client approves pro link |

### 6.3 Task 6 Checklist

- [x] Apply migration 075 (linked profiles)
- [x] Create `/api/profile/switch` endpoint
- [x] Create `/api/profile/create` endpoint
- [x] Update `/api/profile` endpoint
- [ ] Create `/api/pro/link-request` endpoint
- [ ] Create `/api/pro/approve-link` endpoint
- [x] Add profile switcher to sidebar
- [ ] Create "Create Profile" modal
- [ ] Update billing page UI
- [ ] Update all data queries to filter by `profile_type`

---

## Task 7: Buyer UI (Clone of Renter) 🔑

### 7.1 What's Identical

Everything in the Renter flow applies to Buyer:
- Dashboard
- Speak with Leo (different agent, same UI)
- Recommendations feed
- Property detail page
- Saved properties
- Notes (text, photo, voice)
- Settings
- Billing

### 7.2 What's Different

| Aspect | Renter | Buyer |
|--------|--------|-------|
| **Label** | "Alquilando" | "Comprando" |
| **Icon** | 🏠 | 🔑 |
| **Intake agent** | `leo-intake-renter` | `leo-intake-buyer` |
| **Whatifs agent** | `leo-whatifs-renter` | `leo-whatifs-buyer` |
| **Budget field** | `budget_max` (monthly) | `budget_max` (total purchase) |
| **Price display** | €X/mes | €X |

### 7.3 Intake Question Differences

**Renter Intake:**
1. "¿Cuántas personas vivirán en el piso?"
2. "¿Cuánto es tu presupuesto mensual máximo?"
3. "¿En qué zonas te gustaría vivir?"
4. "¿Trabajas desde casa, híbrido, o en oficina?"
5. "¿Qué es lo que más te importa?"
6. "¿Hay algo que sea un NO rotundo?"

**Buyer Intake:**
1. "¿Cuántas personas vivirán en la propiedad?"
2. "¿Cuál es tu presupuesto total de compra?"
3. "¿En qué zonas estás buscando?"
4. "¿Es para vivir, invertir, o ambos?"
5. "¿Estás dispuesto a hacer reformas?"
6. "¿Qué características son imprescindibles?"
7. "¿Hay algo que descarte una propiedad automáticamente?"

### 7.4 Task 7 Checklist

- [x] Create `leo-intake-buyer` agent config
- [x] Create `leo-intake-buyer-pro` agent config
- [x] Create `leo-whatifs-buyer` agent config
- [x] Update `/api/agents/context` for profile-specific agents
- [x] Update sidebar labels/icons for buyer mode
- [ ] Test buyer intake flow end-to-end
- [ ] Test switching between renter and buyer

---

## Pro Dashboard Tasks (Phase 3)

### Pro Dashboard Features

- [ ] All clients list
- [ ] Notifications (new likes, notes)
- [ ] Add client button

### Add Client Flow

- [ ] Name/email form
- [ ] Choose intake method:
  - "I'll add the profile" → Pro intake
  - "Send client a link" → Generate invite link

### Client Profile View

- [ ] Lifestyle summary
- [ ] Preferences & dealbreakers
- [ ] Commute zones
- [ ] Client's likes
- [ ] Client's notes
- [ ] Recommendations for client

### Shortlist Builder

- [ ] Add properties to shortlist
- [ ] Remove properties
- [ ] Send shortlist (email/WhatsApp)

### Public Shortlist

- [ ] Client views without login
- [ ] Client can like properties
- [ ] Client can take notes
- [ ] Pro sees activity in real-time

---

## Components to Build

### New Components

| Component | Used By | Priority |
|-----------|---------|----------|
| `AppSidebar` | All pages | ✅ DONE |
| `AppLayout` | All pages | ✅ DONE |
| `Dashboard` | Non-Pro | ✅ DONE |
| `RecommendationsFeed` | Non-Pro | ✅ DONE |
| `PropertyCardSimple` | Feeds | ✅ DONE |
| `LeanPropertyPage` | Property detail | ✅ DONE |
| `NotesPanel` | Property detail | ✅ DONE |
| `FitScoreSimple` | Property detail | ✅ DONE |
| `QuieroVerloButton` | Property detail | ✅ DONE |
| `ProDashboard` | Pro users | PENDING |
| `ClientCard` | Pro dashboard | PENDING |
| `ClientProfile` | Pro users | PENDING |
| `ShortlistBuilder` | Pro users | PENDING |
| `PublicShortlist` | Public pages | PENDING |

### Reuse Existing

| Component | Location | Status |
|-----------|----------|--------|
| Leo Voice Orb | `/recommend/intake` | ✅ |
| Pro Intake | `/pro/clients/new/intake` | ✅ |
| Homepage | `/` | ✅ |
| Auth | `/auth/*` | ✅ |
| PropertyCard | `src/components/property/` | ✅ (adapted) |

---

*Part of [P0 Lean App Documentation](./P0_INDEX.md)*

