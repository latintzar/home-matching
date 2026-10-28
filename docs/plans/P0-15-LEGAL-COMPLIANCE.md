# P0-15: Legal & GDPR Compliance

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Overview

Legal requirements for operating Leo.casa in Spain/EU. Covers GDPR, LSSI (Spain's digital services law), and email compliance.

---

## Email Domains Setup

| Domain | Purpose | Unsubscribe Required? | Status |
|--------|---------|----------------------|--------|
| `updates.leo.casa` | Transactional (welcome, viewings, alerts) | Preferences link only | ✅ Verified |
| `marketing.leo.casa` | Newsletters, promos | Yes, one-click | ⏳ TODO |

---

## Required Pages

### 1. Privacy Policy (`/privacy` or `/[lang]/privacy`)

**Status:** ⏳ TODO

**Must Include:**
- What data we collect (profile, preferences, saved listings, location)
- Why we collect it (personalized recommendations)
- How long we keep it
- Third parties we share with (Supabase, Stripe, ElevenLabs, Google/Gemini)
- User rights (access, delete, export, rectify)
- Contact for data requests
- Cookie usage

**Implementation:**
```
□ Create /src/app/[lang]/privacy/page.tsx
□ Add translations to dictionaries (en.json, es.json)
□ Link from footer on all pages
□ Link from email footers
```

---

### 2. Terms of Service (`/terms` or `/[lang]/terms`)

**Status:** ⏳ TODO

**Must Include:**
- Service description
- User responsibilities
- Limitation of liability
- Intellectual property
- Termination conditions
- Governing law (Spain)

**Implementation:**
```
□ Create /src/app/[lang]/terms/page.tsx
□ Add translations to dictionaries
□ Link from footer on all pages
□ Reference during signup
```

---

### 3. Cookie Policy (`/cookies` or `/[lang]/cookies`)

**Status:** ⏳ TODO

**Must Include:**
- Types of cookies used (essential, analytics, preferences)
- Third-party cookies (Supabase auth, Stripe, analytics)
- How to manage/delete cookies
- Consent mechanism

**Implementation:**
```
□ Create /src/app/[lang]/cookies/page.tsx
□ Add cookie consent banner component
□ Store consent preference
□ Only load non-essential cookies after consent
```

---

## Dashboard Features

### 4. Email Preferences (in Settings)

**Status:** ⏳ TODO

**Location:** `/settings` (SettingsContent.tsx)

**User Controls:**
| Setting | Description | Default |
|---------|-------------|---------|
| New recommendations | Daily/weekly property matches | ✅ On |
| Saved listing alerts | Price changes, off-market | ✅ On |
| Viewing reminders | Upcoming viewing notifications | ✅ On |
| Product updates | New features, tips | ✅ On |
| Marketing emails | Promotions, newsletters | ❌ Off |

**Database:**
```sql
-- Add to user_lifestyle_profiles or create email_preferences table
ALTER TABLE user_lifestyle_profiles ADD COLUMN email_preferences JSONB DEFAULT '{
  "new_recommendations": true,
  "saved_listing_alerts": true,
  "viewing_reminders": true,
  "product_updates": true,
  "marketing": false
}';
```

**Implementation:**
```
□ Add email_preferences column to Supabase
□ Create EmailPreferencesSection component
□ Add to SettingsContent.tsx
□ Create API route to update preferences
□ Check preferences before sending each email type
```

---

### 5. Data Export & Deletion

**Status:** ⏳ TODO

**Location:** `/settings` (SettingsContent.tsx)

**GDPR Rights:**
- **Export my data** — Download all profile data, preferences, saved listings as JSON/ZIP
- **Delete my account** — Full account deletion with confirmation

**Implementation:**
```
□ Create "Download my data" button in Settings
□ Create API route /api/user/export-data
□ Create "Delete account" with confirmation modal
□ Create API route /api/user/delete-account
□ Cascade delete all user data (profiles, notes, saved listings)
□ Send confirmation email after deletion
```

---

## Business Registration

### 6. Physical Address

**Status:** ⏳ TODO — Need registered address

**Options:**
1. **Virtual office** — ~€20-50/month, provides legal address
2. **Coworking space** — If you have one already
3. **Home address** — If registered as autónomo there

**Required for:**
- Email footer (LSSI requirement)
- Privacy policy contact
- Stripe business verification
- Google Business (if needed later)

**Action:**
```
□ Decide on address solution
□ Update email templates with address
□ Add to Privacy Policy
□ Add to website footer
```

---

### 7. Business Entity (Future)

**Not required for MVP** but eventually:
- **Autónomo** — Simplest, for solo founder
- **S.L.** (Sociedad Limitada) — For investment, multiple founders
- **NIF/CIF** — Tax ID for invoicing

---

## Email Footer Requirements

### Transactional Emails (updates.leo.casa)

```html
<!-- Minimum required -->
<footer>
  Leo.casa · [Address], Spain
  <a href="https://leo.casa/privacy">Privacy Policy</a> · 
  <a href="https://leo.casa/settings">Email Preferences</a>
</footer>
```

### Marketing Emails (marketing.leo.casa)

```html
<!-- Full GDPR/LSSI compliance -->
<footer>
  Leo.casa · [Address], Spain
  You're receiving this because you subscribed at leo.casa
  <a href="{{{unsubscribe_url}}}">Unsubscribe</a> · 
  <a href="https://leo.casa/privacy">Privacy Policy</a> · 
  <a href="https://leo.casa/settings">Manage Preferences</a>
</footer>
```

---

## Implementation Checklist

### Phase 1: Essential (Before Launch)

```
□ 1.1 Create /privacy page (2 hr)
      - Basic privacy policy content
      - ES/EN translations
      - Link from footer

□ 1.2 Create /terms page (2 hr)
      - Basic terms of service
      - ES/EN translations
      - Link from footer

□ 1.3 Email preferences in Settings (3 hr)
      - Add email_preferences column
      - UI toggles in SettingsContent
      - API route to update

□ 1.4 Update email templates (1 hr)
      - Add footer with privacy + preferences links
      - Placeholder for address

□ 1.5 Get business address (external)
      - Research virtual office options
      - Sign up for one
      - Update all templates
```

### Phase 2: Full Compliance (Post-Launch)

```
□ 2.1 Cookie consent banner (2 hr)
      - Show on first visit
      - Store preference
      - Block non-essential cookies until consent

□ 2.2 Create /cookies page (1 hr)
      - Cookie policy content
      - Link from banner

□ 2.3 Data export feature (3 hr)
      - Export API route
      - Download button in Settings

□ 2.4 Account deletion feature (2 hr)
      - Delete API route
      - Confirmation modal
      - Cascade delete all data

□ 2.5 Marketing domain setup (1 hr)
      - Verify marketing.leo.casa in Resend
      - Set up audience lists
      - One-click unsubscribe via Resend
```

---

## Resend Setup

### Current Configuration

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "resend": {
      "type": "command",
      "command": "node /Users/peterneyra/puedo_casa/mcp-send-email/build/index.js --key= --sender=operator@example.invalid"
    }
  }
}
```

### Domains to Verify

| Domain | Purpose | Status |
|--------|---------|--------|
| `updates.leo.casa` | Transactional | ✅ Verified |
| `marketing.leo.casa` | Marketing campaigns | ⏳ TODO |

---

## Virtual Office Options (Spain)

| Provider | Price | Location | Notes |
|----------|-------|----------|-------|
| Regus | ~€50/mo | Multiple cities | Well-known |
| Spaces | ~€40/mo | Barcelona, Madrid | WeWork style |
| Cloudworking | ~€25/mo | Barcelona | Budget option |
| Lexington | ~€35/mo | Barcelona | Good for startups |

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0 Index](./P0_INDEX.md) | Master index |
| [P0-09-BILLING-STRIPE](./P0-09-BILLING-STRIPE.md) | Stripe setup (needs business info) |
| [P0-11-USER-TYPES-FLOWS](./P0-11-USER-TYPES-FLOWS.md) | User flows, settings |

---

*Last Updated: December 2024*
