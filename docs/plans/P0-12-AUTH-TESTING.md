# P0-12: Authentication & Testing

> Test auth system, test users, and development workflow.

## 1. Test Auth System

### Environment Flag

```bash
# .env.local (development only)
NEXT_PUBLIC_ENABLE_TEST_AUTH=true

# .env.production (NEVER set this)
# NEXT_PUBLIC_ENABLE_TEST_AUTH is not set
```

---

## 2. Test Users (Seeded in Supabase)

| Email | Type | State | Purpose |
|-------|------|-------|---------|
| `operator@example.invalid` | Renter | ✅ Onboarded | Test main app flow |
| `operator@example.invalid` | Renter | ❌ Fresh | Test onboarding |
| `operator@example.invalid` | Buyer | ✅ Onboarded | Test main app flow |
| `operator@example.invalid` | Buyer | ❌ Fresh | Test onboarding |
| `operator@example.invalid` | Pro | ✅ Has clients | Test pro dashboard |
| `operator@example.invalid` | Pro | ❌ Fresh | Test pro onboarding |

**Password for all**: `TestPassword123!`

---

## 3. Sign-in UI (Dev Mode)

```
┌─────────────────────────────────────────────┐
│            🏠 Leo.casa                      │
│                                             │
│  [🔵 Continue with Google]                  │
│  [⚫ Continue with Apple]                   │
│  [✉️  Continue with Email]                  │
│                                             │
│  ─────────────────────────────────────────  │
│  🧪 Test Mode (dev only)                    │
│                                             │
│  [👤 Renter] [🏠 Buyer] [💼 Pro]            │
│                                             │
│  ☐ Start fresh (reset onboarding)          │
└─────────────────────────────────────────────┘
```

---

## 4. How Test Auth Works

1. Test users are **real users in Supabase** (dev database only)
2. Clicking a test button creates a session for that user
3. If "Start fresh" is checked, user's profile is cleared first
4. Onboarding redirect works identically to real users
5. All data (notes, saves, etc.) is real and persisted

---

## 5. Running Locally

```bash
cd puedo_casa
npm run dev
# Open http://localhost:3000
# Dev bypass auto-signs you in as operator@example.invalid
```

---

## 6. Error Handling & Fallbacks

| Failure | Fallback | User Experience |
|---------|----------|-----------------|
| OAuth timeout | Show error, retry button | "Connection failed, try again" |
| Session expired | Redirect to sign-in | Seamless re-auth |
| Invalid test user | Create on-the-fly | Dev continues working |
| Database connection | Retry 3x | "Connecting..." spinner |
| ElevenLabs timeout | Skip voice, use text | "Let's use text chat instead" |

**Critical principle:** Never block the user. Always have graceful degradation.

---

## 7. External Service Fallbacks

| Failure | Fallback | User Experience |
|---------|----------|-----------------|
| Geoapify timeout | Use cached zones OR skip | "I'll calculate zones after" |
| ScrapingDog timeout | Skip POI, note in profile | "I'll search POIs later" |
| WPA timeout (vibe-check) | Skip vibe-check | "Let me show the map first" |
| Heatmap calculation error | Show outline only | "Here's your commute area" |
| WebSocket disconnect | Polling fallback | Slightly delayed updates |
| Batch WPA failure | Retry 3x, then skip | User doesn't see that listing |
| Email delivery failure | Retry queue | Delayed notification |

---

## 8. Performance Requirements

| Operation | Max Time | Notes |
|-----------|----------|-------|
| Auth redirect | 2 sec | Cache aggressively |
| Profile load | 1 sec | Essential for UX |
| Isochrone generation | 2 sec | Cache results |
| POI search (single) | 3 sec | Fire in parallel |
| WPA quick (single) | 30 sec | Background, don't block |
| Heatmap calculation | 3 sec | Pure math, no AI |
| WebSocket push | 500 ms | Critical for UX |

---

## 9. Development Workflow

### Local Development

```bash
# Start dev server
npm run dev

# Run with test user
# Click "Test Mode" buttons in sign-in

# Reset test user
# Check "Start fresh" before clicking test user button
```

### Database

```bash
# Check migrations
npx supabase migration list

# Apply new migration
npx supabase migration up
```

### Test User Seeding

```sql
-- Seed test renter (run in Supabase SQL editor)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  gen_random_uuid(),
  'operator@example.invalid',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW()
);

-- Create their profile
INSERT INTO user_profiles (id, email)
SELECT id, email FROM auth.users WHERE email = 'operator@example.invalid';

-- Create lifestyle profile (onboarded state)
INSERT INTO user_lifestyle_profiles (user_id, profile_type, intake_completed)
SELECT id, 'renter', true FROM auth.users WHERE email = 'operator@example.invalid';
```

---

## 10. Environment Variables

### Required for Auth

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://recipient-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# OAuth Providers
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
APPLE_CLIENT_ID=xxx
APPLE_CLIENT_SECRET=xxx

# Dev only
NEXT_PUBLIC_ENABLE_TEST_AUTH=true
```

### External Services

```bash
# API Keys
GEOAPIFY_API_KEY=xxx
SCRAPINGDOG_API_KEY=xxx
NEXT_PUBLIC_MAPBOX_TOKEN=xxx
ELEVENLABS_API_KEY=xxx
GOOGLE_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Email
RESEND_API_KEY=xxx

# WebSocket (optional)
PUSHER_APP_ID=xxx
PUSHER_KEY=xxx
PUSHER_SECRET=xxx
PUSHER_CLUSTER=xxx
```

---

## 11. Build Phases (Sequential)

```
Phase 1: RENTER     →  User Tests  →  Approved? 
                                          ↓
Phase 2: BUYER      →  User Tests  →  Approved?
                                          ↓
Phase 3: PRO        →  User Tests  →  Approved?
                                          ↓
                                      🎉 P0 Complete!
```

**We build ONE user type at a time, test it, then move to the next.**

---

## 12. Current Status

### ✅ Phase 1 COMPLETE (December 2, 2025)

- Full authentication flow with dev bypass
- Voice-first onboarding with amorphous orb
- AI-generated needs summary
- 2-column property page with notes
- Save/like functionality
- Isochrone map visualization
- Full i18n system (Spanish/English)

### ✅ Phase 2 COMPLETE (December 4, 2025)

- Migration 075: profile_type on all tables
- User can have both Renter AND Buyer profiles
- Separate saved properties, notes per profile
- Profile switcher in sidebar
- Billing at user level

### ✅ Phase 3 COMPLETE (December 4, 2025)

- All ElevenLabs agent configs created (7 agents)
- Agent selection based on profile type
- Test users seeded (buyer, pro-fresh)

### 🎯 Next Steps

1. Push ElevenLabs Agents to dashboard
2. User Testing (Renter + Buyer + Profile Switching)
3. Phase 4: Pro flow (client management, shortlists)

---

*Part of [P0 Lean App Documentation](./P0_INDEX.md)*

