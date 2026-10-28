# 🏗️ Leo.casa Build Plan

> **Single source of truth for building the MVP**  
> Last updated: 2025-12-02

## ⭐ START HERE

| Document | Purpose |
|----------|---------|
| **P0_LEAN_APP.md (`./P0_LEAN_APP.md`, historical reference)** | **🎯 P0 MVP spec - validation-first approach** |

## Quick Links to Documentation

| Document | Purpose |
|----------|---------|
| P0_LEAN_APP.md (`./P0_LEAN_APP.md`, historical reference) | **P0 MVP routes, components, file structure** |
| [UI_ASCII_AND_ANALYTICS.md](./UI_ASCII_AND_ANALYTICS.md) | Screen designs + analytics events |
| [UI_BY_USER_TYPE.md](./UI_BY_USER_TYPE.md) | Features by persona |
| [PROPERTY_REPORTS_DESIGN.md](./PROPERTY_REPORTS_DESIGN.md) | Property page + reports priority order |
| [SUBSCRIPTION_AND_PAYMENTS.md](./SUBSCRIPTION_AND_PAYMENTS.md) | Stripe + billing |
| [ARCHITECTURE_FLOWS.md](ARCHITECTURE_FLOWS.md) | System architecture |
| [TECH_STACK_AND_SERVICES.md](../TECH_STACK_AND_SERVICES.md) | Tech stack |

---

## 🎨 Design System (Match Homepage)

### Colors
```css
/* From globals.css and LandingPageClient.tsx */
--background: #FDFBF7;           /* Warm cream */
--foreground: stone-900;         /* Dark text */
--muted: stone-600;              /* Secondary text */
--accent: stone-200;             /* Hover/selection */
--card-bg: white;                /* Card backgrounds */
--card-border: stone-100;        /* Subtle borders */
```

### Typography
```css
/* Headings */
font-family: 'Playfair Display', Georgia, serif;
/* Body */
font-family: system-ui, sans-serif;
```

### Component Patterns
```tsx
// Cards
<div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 hover-lift">

// Primary Button
<Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full px-6 py-3">

// Secondary Button  
<Button variant="outline" className="border-stone-200 text-stone-900 rounded-full">

// Section Container
<section className="max-w-4xl mx-auto px-6 py-16">

// Dark Section (accent)
<div className="bg-stone-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl">
```

### Animations
```css
/* Fade in on mount */
.animate-in .fade-in .duration-500

/* Hover lift */
.hover-lift { transform: translateY(-4px); box-shadow: 0 20px 40px -12px rgba(0,0,0,0.1); }

/* Waveform (for Leo voice) */
animation: waveform 1.2s ease-in-out infinite;
```

---

## 📱 Build Phases

### Phase 0: Foundation (Day 1-2)
**Goal**: Auth + DB schema

| Task | Files | Est |
|------|-------|-----|
| Supabase Auth setup | `src/app/auth/` | 2h |
| DB migration: `pro_clients` table | `supabase/migrations/064_pro_clients.sql` | 1h |
| DB migration: `viewings` table | `supabase/migrations/065_viewings.sql` | 1h |
| DB migration: `subscriptions` table | `supabase/migrations/066_subscriptions.sql` | 1h |
| Auth callback handler | `src/app/auth/callback/route.ts` | 1h |

**Schema from [ARCHITECTURE_FLOWS.md](ARCHITECTURE_FLOWS.md):**
```sql
CREATE TABLE pro_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  shortlist_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  intake_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  lifestyle_profile_id UUID REFERENCES user_lifestyle_profiles(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Phase 1: Non-Pro Flow (Day 3-5)
**Goal**: User can sign up, talk to Leo, get alerts, view properties

**Reference**: [UI_ASCII_AND_ANALYTICS.md](./UI_ASCII_AND_ANALYTICS.md) screens 1-9

#### 1.1 Post-Signup Flow
```
Homepage CTA → Supabase Auth → Intake Page → WhatsApp Ask → Profile Page
```

| Screen | Route | Component | Est |
|--------|-------|-----------|-----|
| Auth (magic link) | `/auth/signin` | `SignInPage.tsx` | 2h |
| Intake (Leo voice) | `/recommend/intake` | Already exists | - |
| WhatsApp Ask Modal | - | `WhatsAppOptIn.tsx` | 1h |
| Profile Page | `/profile` | `ProfilePage.tsx` | 3h |

**Profile Page wireframe (from docs):**
```
┌────────────────────────────────────────────┐
│  TU PERFIL                    [⚙️ Ajustes] │
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │     [ISOCHRONE MAP]                  │  │
│  │     🟢 Sweet spot  🟡 Opportunity    │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Leo entiende que buscas...               │
│  ┌──────────────────────────────────────┐  │
│  │ • 2-3 hab cerca del metro            │  │
│  │ • Presupuesto: €1.2-1.5k/mes        │  │
│  │ • Importante: luz natural            │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [🎤 Actualizar con Leo]                   │
└────────────────────────────────────────────┘
```

#### 1.2 Property Flow
```
Alert (email/WhatsApp) → Property Page → "Quiero verlo" → Note-taking
```

| Screen | Route | Component | Est |
|--------|-------|-----------|-----|
| Property Page | `/property/[id]` | Enhance existing | 4h |
| "Quiero verlo" transform | - | `ContactAgentButton.tsx` | 2h |
| Note-taking interface | - | `ViewingNotes.tsx` | 4h |
| Shortlist | `/shortlist` | `ShortlistPage.tsx` | 3h |

**"Quiero verlo" behavior (from docs):**
- Button transforms to show agent contact
- Pre-loads WhatsApp message with user 1-liner
- Records viewing intent in DB

---

### Phase 2: Pro Flow (Day 6-8)
**Goal**: Pro can add clients, do intake, manage shortlists, send links

**Reference**: [UI_ASCII_AND_ANALYTICS.md](./UI_ASCII_AND_ANALYTICS.md) screens 1-5 (Pro)

#### 2.1 Pro Dashboard
```
Login → Dashboard → Client List → Client Profile → Shortlist
```

| Screen | Route | Component | Est |
|--------|-------|-----------|-----|
| Pro Dashboard | `/pro/dashboard` | `ProDashboard.tsx` | 4h |
| Add Client | `/pro/clients/new` | Already exists | - |
| Pro Intake | `/pro/clients/new/intake` | Already exists | - |
| Client Profile | `/pro/clients/[id]` | `ClientProfile.tsx` | 3h |
| Client Shortlist | `/pro/clients/[id]/shortlist` | `ClientShortlist.tsx` | 3h |

#### 2.2 Secure Link System
```
Pro sends link → Client opens → Views shortlist → Takes notes → Pro sees
```

| Feature | Route | Component | Est |
|---------|-------|-----------|-----|
| Send Link Modal | - | `SendShortlistModal.tsx` | 2h |
| Client Shortlist (public) | `/shortlist/[token]` | `PublicShortlist.tsx` | 3h |
| Client Note-taking | - | Reuse `ViewingNotes.tsx` | - |
| Pro reads notes | - | Read-only mode in `ViewingNotes.tsx` | 1h |

---

### Phase 3: Extension (Day 9-10)
**Goal**: Pro can analyze properties from browser

**Reference**: [UI_ASCII_AND_ANALYTICS.md](./UI_ASCII_AND_ANALYTICS.md) screens 4a-4b

| Feature | Files | Est |
|---------|-------|-----|
| Extension popup (logged out) | `extension/popup.tsx` | 2h |
| Extension popup (logged in) | Same | 2h |
| "Añadir a cliente" flow | Same | 2h |
| Auto-analysis trigger | `extension/content.ts` | 2h |

---

### Phase 4: Payments (Day 11-12)
**Goal**: Stripe integration for subscriptions

**Reference**: [SUBSCRIPTION_AND_PAYMENTS.md](./SUBSCRIPTION_AND_PAYMENTS.md)

| Feature | Route | Est |
|---------|-------|-----|
| Checkout redirect | `/api/stripe/checkout` | 2h |
| Webhook handler | `/api/stripe/webhook` | 3h |
| Customer portal | `/api/stripe/portal` | 1h |
| B2C billing page | `/settings/billing` | 2h |
| Pro billing page | `/pro/billing` | 2h |

---

## 🧩 Shared Components

These components are reused across user types:

| Component | Used By | File |
|-----------|---------|------|
| `ViewingNotes` | Direct users, Pro clients | `src/components/viewing/ViewingNotes.tsx` |
| `PropertyCard` | Shortlist, Alerts, Dashboard | `src/components/property/PropertyCard.tsx` |
| `FitScoreBadge` | Property pages, Shortlists | `src/components/property/FitScoreBadge.tsx` |
| `IsochroneMap` | Profile, Pro Client Profile | `src/components/maps/IsochroneMap.tsx` |
| `LeoVoice` | Intake (consumer + pro) | `src/components/leo/LeoVoice.tsx` |

---

## 📊 Analytics Implementation

**Reference**: [UI_ASCII_AND_ANALYTICS.md](./UI_ASCII_AND_ANALYTICS.md) Section 12

### Key Funnel Events (Non-Pro)
```typescript
// Validation funnel
'signup_completed'
'intake_started' → 'intake_completed'
'whatsapp_opted_in' | 'whatsapp_skipped'
'alert_clicked' (from email/WhatsApp)
'property_viewed' → 'contact_agent_clicked'
'note_added' → 'viewing_completed'
```

### Key Funnel Events (Pro)
```typescript
// Pro validation funnel
'pro_signup_completed'
'client_created' → 'intake_method_chosen'
'extension_installed' → 'extension_property_added'
'shortlist_sent' → 'client_shortlist_opened'
'client_note_added' → 'pro_notes_viewed'
```

### Supabase Tables
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_name TEXT NOT NULL,
  properties JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Client Helper
```typescript
// src/lib/analytics.ts
export const track = async (event: string, properties?: Record<string, any>) => {
  await fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({ event, properties, timestamp: Date.now() }),
  });
};

// Usage
track('property_viewed', { listing_id: '123', source: 'alert_email' });
```

---

## 🗂️ File Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   └── callback/route.ts
│   ├── profile/page.tsx
│   ├── shortlist/
│   │   ├── page.tsx                    # User's shortlist
│   │   └── [token]/page.tsx            # Public client shortlist
│   ├── property/[id]/page.tsx          # Enhanced
│   ├── pro/
│   │   ├── dashboard/page.tsx
│   │   ├── clients/
│   │   │   ├── new/page.tsx            # Exists
│   │   │   ├── new/intake/page.tsx     # Exists
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Client profile
│   │   │       └── shortlist/page.tsx  # Client shortlist
│   │   └── billing/page.tsx
│   ├── settings/
│   │   └── billing/page.tsx
│   └── api/
│       ├── stripe/
│       │   ├── checkout/route.ts
│       │   ├── webhook/route.ts
│       │   └── portal/route.ts
│       ├── viewings/
│       │   ├── route.ts                # POST: create viewing
│       │   └── [id]/
│       │       ├── notes/route.ts      # POST: add note
│       │       └── complete/route.ts   # POST: complete viewing
│       └── analytics/route.ts
├── components/
│   ├── viewing/
│   │   └── ViewingNotes.tsx            # Shared note-taking
│   ├── property/
│   │   ├── PropertyCard.tsx
│   │   ├── FitScoreBadge.tsx
│   │   └── ContactAgentButton.tsx
│   ├── leo/
│   │   └── LeoVoice.tsx                # Voice interface
│   ├── maps/
│   │   └── IsochroneMap.tsx
│   └── modals/
│       ├── WhatsAppOptIn.tsx
│       └── SendShortlistModal.tsx
└── lib/
    ├── analytics.ts
    └── supabase/
        └── client.ts
```

---

## ✅ Checklist by Day

### Day 1-2: Foundation
- [ ] Set up Supabase Auth (magic link)
- [ ] Run migrations (pro_clients, viewings, subscriptions)
- [ ] Create auth callback handler
- [ ] Test auth flow end-to-end

### Day 3-4: Non-Pro Core
- [ ] Profile page with isochrone map
- [ ] WhatsApp opt-in modal (end of intake)
- [ ] Shortlist page
- [ ] Property page enhancements

### Day 5: Non-Pro Viewing
- [ ] "Quiero verlo" button transform
- [ ] ViewingNotes component
- [ ] Viewing intent recording

### Day 6-7: Pro Dashboard
- [ ] Pro dashboard with notifications
- [ ] Client profile page
- [ ] Client shortlist page

### Day 8: Secure Links
- [ ] Send shortlist modal
- [ ] Public shortlist page (/shortlist/[token])
- [ ] Pro read-only notes view

### Day 9-10: Extension
- [ ] Extension popup (logged out/in states)
- [ ] "Añadir a cliente" flow
- [ ] Auto-analysis on page load

### Day 11-12: Payments
- [ ] Stripe checkout integration
- [ ] Webhook handler
- [ ] Billing pages (B2C + Pro)

---

## 🎯 Success Metrics

### Week 1 Targets
- [ ] 10 non-pro signups complete intake
- [ ] 5 non-pro users opt in to WhatsApp
- [ ] 3 pro users create at least 1 client

### Week 2 Targets
- [ ] 20 property clicks from alerts
- [ ] 5 viewing notes added
- [ ] 2 pro users send shortlist links

---

## 🚀 Quick Start

```bash
# 1. Run migrations
npx supabase db push

# 2. Start dev server
npm run dev

# 3. Open homepage
open http://localhost:3000

# 4. Test auth flow
# Click CTA → Sign in → Complete intake → See profile
```

---

## 📝 Notes

### Reusable Patterns
- **Note-taking**: Same component for direct users and pro clients
- **Property cards**: Same component everywhere
- **Voice interface**: Same Leo widget for consumer and pro intake

### Mobile First
- All components designed for mobile first
- Touch-friendly note-taking (swipe gestures)
- Minimal cognitive load during viewings

### Security
- Secure tokens for client shortlists (UUID, not guessable)
- RLS policies on all tables
- Pro can only see their own clients' data

