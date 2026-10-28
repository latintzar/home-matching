# P0-11: User Types & Flows

> Complete user type definitions, linked profile architecture, flows, and routes.

## 1. Four User Types

| Type | Pricing | Core Need |
|------|---------|-----------|
| **Renter** | €9.99/mo | Find rentals that fit lifestyle |
| **Buyer** | €9.99/mo | Find purchases that fit lifestyle |
| **Personal Shopper** | €49/mo | Manage clients, build shortlists |
| **Relocation Agent** | Enterprise | Same as Personal Shopper (P2 adds team features) |

> **IMPORTANT**: Renter and Buyer are **separate profile types**, not modes. A user can have BOTH profiles and switch between them.

---

## 2. Linked Profile Architecture

### The Core Concept

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ONE AUTH USER (auth.users)                                             │
│  ├── email: operator@example.invalid                                           │
│  ├── id: uuid-123                                                       │
│  └── role: 'renter_buyer' (not 'professional')                          │
│                                                                         │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │  RENTER PROFILE         │    │  BUYER PROFILE          │            │
│  │  ────────────────────── │    │  ────────────────────── │            │
│  │  profile_type: 'renter' │    │  profile_type: 'buyer'  │            │
│  │  budget: €1,200/mo      │    │  budget: €350,000       │            │
│  │  areas: Gràcia, Born    │    │  areas: Poblenou, 22@   │            │
│  │  bedrooms: 2            │    │  bedrooms: 3            │            │
│  │  intake_completed: ✅    │    │  intake_completed: ❌    │            │
│  │                         │    │                         │            │
│  │  [Separate saved props] │    │  [Separate saved props] │            │
│  │  [Separate notes]       │    │  [Separate notes]       │            │
│  │  [Separate recs]        │    │  [Separate recs]        │            │
│  └─────────────────────────┘    └─────────────────────────┘            │
│                                                                         │
│  ACTIVE PROFILE: 'renter' ← User sees renter data in UI                 │
│  [Toggle in sidebar to switch]                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Use Case | Before | After |
|----------|--------|-------|
| Renter buys a house | Loses renter history | Both profiles preserved |
| Buyer rents while renovating | Create new account | Switch to renter profile |
| Pro links to existing user | External contact only | Real account linking |
| Different search criteria | One set of prefs | Independent prefs per type |

---

## 3. Database Schema (Migration 075)

```sql
-- 1. Add profile_type to lifestyle_profiles
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter' 
  CHECK (profile_type IN ('renter', 'buyer'));

-- One profile per type per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_profile_type 
  ON user_lifestyle_profiles(user_id, profile_type);

-- 2. Track active profile at user level
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS active_profile_type TEXT DEFAULT 'renter'
  CHECK (active_profile_type IN ('renter', 'buyer'));

-- 3. Add profile_type to saved_properties
ALTER TABLE saved_properties
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- 4. Add profile_type to property_notes
ALTER TABLE property_notes
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- 5. Pro-Client Linking
ALTER TABLE pro_clients
ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id);
```

---

## 4. Profile APIs

### Switch Profile

```typescript
// POST /api/profile/switch
interface SwitchProfileRequest {
  targetProfile: 'renter' | 'buyer';
}

interface SwitchProfileResponse {
  success: boolean;
  activeProfile: 'renter' | 'buyer';
  profileExists: boolean;
  intakeCompleted: boolean;
}
```

### Get Profile

```typescript
// GET /api/profile
interface GetProfileResponse {
  user: {
    id: string;
    email: string;
    activeProfileType: 'renter' | 'buyer';
    subscription: {
      type: 'renter' | 'buyer' | 'pro' | null;
      status: 'none' | 'active' | 'paused' | 'canceled' | 'past_due';
    };
  };
  profile: UserLifestyleProfile | null;
  otherProfiles: {
    type: 'renter' | 'buyer';
    exists: boolean;
    intakeCompleted: boolean;
  }[];
}
```

### Create Second Profile

```typescript
// POST /api/profile/create
interface CreateProfileRequest {
  profileType: 'renter' | 'buyer';
}
```

---

## 5. Non-Pro User Flow (Renter & Buyer)

```
1. SIGN UP
   - Social Login: Google or Apple
   - OR Magic Link

2. ONBOARDING
   - Call/chat with Leo (voice orb)
   - Leo learns lifestyle, preferences, dealbreakers
   - Profile created with commute zones

3. RECEIVE RECOMMENDATIONS
   - See properties in Dashboard
   - Get alerts via Email
   - Get alerts via WhatsApp (if number provided)

4. VIEW PROPERTIES
   - Click any property to see details
   - See Fit Score (why it matches/doesn't match)
   - Click "Contact Agent" to reach listing agent

5. TAKE NOTES
   - Add text notes
   - Add photo notes
   - Add voice notes

6. MANAGE PROFILE
   - See profile summary
   - See commute zones
   - Have follow-up call with Leo

7. SEE UPDATED RECOMMENDATIONS
   - Recommendations update based on notes
   - Leo learns from feedback
```

---

## 6. Pro User Flow (Personal Shopper & Relocation Agent)

```
1. SIGN UP (as Professional)
   - Social Login or Magic Link

2. PRO DASHBOARD
   - See all clients at a glance
   - See notifications (new likes, notes, messages)

3. ADD NEW CLIENT
   - Enter client name/email
   - CHOOSE intake method:
     a) "I'll add the profile" → Pro fills in details
     b) "Send client a link" → Client has call/chat with Leo

4. VIEW CLIENT PROFILE
   - See client's lifestyle summary
   - See client's preferences and dealbreakers
   - See client's commute zones

5. SEE CLIENT ACTIVITY
   - See client's "likes" (favorited properties)
   - See client's notes on properties
   - See which properties client viewed

6. MANAGE RECOMMENDATIONS
   - See Leo's recommendations for this client
   - Add properties manually
   - Remove properties that don't fit

7. SEND SHORTLIST
   - Select properties for client
   - Send shortlist link (email or WhatsApp)
   - Client views shortlist WITHOUT needing to log in

8. CLIENT VIEWS SHORTLIST (Public Page)
   - Client sees curated properties
   - Client can "like" properties
   - Client can take notes
   - Pro sees activity in real-time
```

---

## 7. Pro-Client Linking

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PRO-CLIENT LINKING FLOW                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCENARIO: Client already has Leo account, hires a relocation agent    │
│                                                                         │
│  1. Pro creates client in their dashboard                               │
│     - Enters client email                                               │
│     - System checks: does this email exist in auth.users?               │
│                                                                         │
│  2a. IF EMAIL EXISTS (existing Leo user):                               │
│      - System sends link request to client                              │
│      - Email: "María from ReloMadrid wants to help with your search"   │
│      - Client clicks "Approve" → accounts linked                        │
│      - pro_clients.linked_user_id = client's auth.users.id              │
│                                                                         │
│  2b. IF EMAIL DOESN'T EXIST (new client):                               │
│      - Pro creates external client as before                            │
│      - Client can do intake via intake_token                            │
│      - If client later signs up, we can auto-link by email              │
│                                                                         │
│  3. ONCE LINKED:                                                        │
│     - Pro sees client's profile (read-only)                             │
│     - Pro sees client's saved properties                                │
│     - Pro can add properties to shared shortlist                        │
│     - Client sees pro's shortlist additions                             │
│     - Client controls their own profile (pro can suggest, not edit)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Link Request API

```typescript
// POST /api/pro/link-request
interface LinkRequestBody {
  clientEmail: string;
  clientName: string;
  message?: string;
}

interface LinkRequestResponse {
  success: boolean;
  clientExists: boolean;
  requestSent?: boolean;
  proClientId?: string;
}
```

---

## 8. Route Structure

### Auth Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/auth/signin` | Sign in page with Google/Apple/Magic Link | NEW |
| `/auth/callback` | OAuth callback handler | ✅ exists |

### Non-Pro Routes (Renter/Buyer)

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Homepage | ✅ exists |
| `/recommend/intake` | Onboarding call/chat with Leo | ✅ exists |
| `/dashboard` | See new recommendations, activity | NEW |
| `/property/[id]` | View property, fit score, notes | REFACTOR |
| `/saved` | See liked/saved properties | NEW |
| `/profile` | See profile summary | ✅ exists |
| `/profile/call` | Follow-up call with Leo | NEW |
| `/billing` | Subscription management | ✅ exists |

### Pro Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/pro` | Pro dashboard - see all clients | NEW |
| `/pro/clients/new` | Add new client | NEW |
| `/pro/clients/[id]` | View client profile, likes, notes | NEW |
| `/pro/clients/[id]/shortlist` | Build and send shortlist | NEW |
| `/pro/clients/[id]/intake` | Pro does intake for client | ✅ exists |

### Public Routes (No Auth)

| Route | Purpose | Status |
|-------|---------|--------|
| `/shortlist/[token]` | Client views shortlist | NEW |
| `/invite/[code]` | Client self-service intake | NEW |

---

## 9. Profile Switcher UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Leo Logo]                                                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  María García                                                    │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  [🏠 Alquilando ▼]  ← Dropdown to switch                        │   │
│  │                                                                  │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │ 🏠 Alquilando (activo)           ✅                        │  │   │
│  │  │ 🔑 Comprando                      [Crear perfil →]         │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🏠 Panel                                                               │
│  💬 Habla con Leo                                                       │
│  📋 Recomendaciones                                                     │
│  ❤️ Guardados                                                           │
│  ⚙️ Configuración                                                       │
│  💳 Facturación                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Switching Logic

```typescript
const handleProfileSwitch = async (targetType: 'renter' | 'buyer') => {
  const profileExists = await checkProfileExists(targetType);
  
  if (!profileExists) {
    setShowCreateProfileModal(true);
    return;
  }
  
  const hasSubscription = await checkSubscription(targetType);
  
  if (!hasSubscription) {
    router.push(`/billing?upgrade=${targetType}`);
    return;
  }
  
  await switchProfile(targetType);
  router.refresh();
};
```

---

## 10. Renter vs Buyer Differences

| Aspect | Renter | Buyer |
|--------|--------|-------|
| **Label** | "Alquilando" | "Comprando" |
| **Icon** | 🏠 | 🔑 |
| **Intake agent** | `leo-intake-renter` | `leo-intake-buyer` |
| **Whatifs agent** | `leo-whatifs-renter` | `leo-whatifs-buyer` |
| **Budget field** | `budget_max` (monthly) | `budget_max` (total purchase) |
| **Price display** | €X/mes | €X |
| **Questions** | Lifestyle, commute, monthly budget | Renovation appetite, investment goals |

---

## 11. Sidebar Navigation

### Non-Pro Sidebar

- 📊 Dashboard
- 🏠 Recommendations
- ❤️ Saved
- 📅 Viewings
- ⚙️ Settings
- 💳 Facturación

### Pro Sidebar

- 📊 Dashboard
- 👥 Clients
- 🔍 Search
- ⚙️ Settings
- 💳 Facturación

### Sidebar States

| State | When | Contents |
|-------|------|----------|
| **Full** | Normal app usage | Logo, nav items, user avatar |
| **Minimal** | During intake/onboarding | Logo + Exit button only |
| **Collapsed** | Mobile | Hamburger menu |

---

## 12. File Structure

```
src/
├── app/
│   ├── (app)/                    # App shell with sidebar
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── recommend/
│   │   ├── property/[id]/
│   │   ├── saved/
│   │   └── profile/
│   │
│   ├── (pro)/                    # Pro shell with pro sidebar
│   │   ├── layout.tsx
│   │   └── pro/
│   │       ├── page.tsx
│   │       └── clients/
│   │
│   ├── (public)/                 # No auth required
│   │   ├── shortlist/[token]/
│   │   └── invite/[code]/
│   │
│   ├── auth/
│   └── billing/
│
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx
│   │   ├── AppLayout.tsx
│   │   └── ProSidebar.tsx
│   │
│   ├── property/
│   │   ├── LeanPropertyPage.tsx
│   │   ├── FitScoreSimple.tsx
│   │   └── NotesPanel.tsx
│   │
│   └── pro/
│       ├── ClientCard.tsx
│       └── ShortlistBuilder.tsx
```

---

## 13. Implementation Checklist

### Phase A: Database
- [x] Add `profile_type` to `user_lifestyle_profiles`
- [x] Add unique constraint on `(user_id, profile_type)`
- [x] Add `active_profile_type` to `user_profiles`
- [x] Add `profile_type` to `saved_properties`
- [x] Add `profile_type` to `property_notes`
- [x] Add `linked_user_id` to `pro_clients`

### Phase B: APIs
- [x] Create `/api/profile/switch`
- [x] Update `/api/profile` for multi-profile
- [x] Create `/api/profile/create`
- [ ] Create `/api/pro/link-request`
- [ ] Create `/api/pro/approve-link`

### Phase C: UI
- [x] Add profile switcher to sidebar
- [ ] Create "Create Profile" modal
- [ ] Update billing page for per-profile subscriptions
- [ ] Update data fetching to filter by `profile_type`
- [ ] Add link request UI for pros

---

*Part of [P0 Lean App Documentation](./P0_INDEX.md)*

