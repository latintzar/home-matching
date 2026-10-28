# P0-16: Transactional Email System

> **Parent:** [P0 Index](./P0_INDEX.md)
> **Related:** [P0-08-TASKS](./P0-08-TASKS.md) (Phase 5.4), [P0-15-LEGAL-COMPLIANCE](./P0-15-LEGAL-COMPLIANCE.md)

---

## Overview

All transactional emails sent by Leo.casa. Covers templates, triggers, orchestration, and the Resend integration.

**Sending Domain:** `updates.leo.casa` (verified in Resend)

---

## Email Catalog

### User Lifecycle Emails

| Email | Trigger | Priority | Status |
|-------|---------|----------|--------|
| [Welcome](#1-welcome-email) | User signs up | P0 | ⏳ TODO |
| [Onboarding Complete](#2-onboarding-complete) | Finishes intake with Leo | P0 | ⏳ TODO |
| [Account Deleted](#3-account-deleted) | User deletes account | P1 | ⏳ TODO |

### Recommendation Emails

| Email | Trigger | Priority | Status |
|-------|---------|----------|--------|
| [New Recommendations](#4-new-recommendations) | Daily batch finds matches | P0 | ⏳ TODO |
| [Stock Insufficient](#5-stock-insufficient) | Day 3 check shows low inventory | P0 | ⏳ TODO |
| [First Recommendations](#6-first-recommendations) | Initial batch after intake | P0 | ⏳ TODO |

### Listing Alert Emails

| Email | Trigger | Priority | Status |
|-------|---------|----------|--------|
| [Price Drop](#7-price-drop-alert) | Saved listing price decreases | P0 | ⏳ TODO |
| [Price Increase](#8-price-increase-alert) | Saved listing price increases | P1 | ⏳ TODO |
| [Off Market](#9-off-market-alert) | Saved listing removed | P0 | ⏳ TODO |
| [Back on Market](#10-back-on-market) | Previously saved listing returns | P1 | ⏳ TODO |

### Viewing Emails

| Email | Trigger | Priority | Status |
|-------|---------|----------|--------|
| [Viewing Scheduled](#11-viewing-scheduled) | User schedules a viewing | P1 | ⏳ TODO |
| [Viewing Reminder](#12-viewing-reminder) | 24h before scheduled viewing | P1 | ⏳ TODO |
| [Post-Viewing Follow-up](#13-post-viewing-followup) | 2h after viewing time | P2 | ⏳ TODO |

### Pro/Agent Emails

| Email | Trigger | Priority | Status |
|-------|---------|----------|--------|
| [Client Invitation](#14-client-invitation) | Agent adds new client | P1 | ⏳ TODO |
| [Shortlist Shared](#15-shortlist-shared) | Agent shares properties | P1 | ⏳ TODO |
| [Client Reacted](#16-client-reacted) | Client likes/comments on property | P1 | ⏳ TODO |

### Nudge Emails

| Email | Trigger | Priority | Status |
|-------|---------|----------|--------|
| [Incomplete Intake](#17-incomplete-intake-nudge) | Signed up but no intake after 24h | P0 | ⏳ TODO |
| [Incomplete Intake Final](#18-incomplete-intake-final) | Still no intake after 72h | P1 | ⏳ TODO |
| [Follow-up Call Request](#19-follow-up-call-request) | Leo flags need for follow-up | P1 | ⏳ TODO |
| [Post-Viewing Notes Nudge](#20-post-viewing-notes-nudge) | 24h after viewing, no notes added | P0 | ⏳ TODO |
| [Weekly Engagement](#21-weekly-engagement) | 7 days since last app visit | P2 | ⏳ TODO |

---

## Email Specifications

### 1. Welcome Email

**Trigger:** `auth.users` insert (Supabase webhook or after signup redirect)

**Subject:** `🏠 Welcome to Leo.casa`

**Content:**
- Welcome message
- What Leo does (brief)
- CTA: "Talk to Leo" → `/speak-with-leo`
- What to expect next

**Data needed:**
```typescript
interface WelcomeEmailData {
  userName: string;        // from user_metadata.full_name or email
  locale: 'es' | 'en';
}
```

**Template location:** `src/lib/email/templates/welcome.tsx`

---

### 2. Onboarding Complete

**Trigger:** `user_lifestyle_profiles.intake_completed` set to `true`

**Subject:** `✨ Leo conoce tus preferencias` / `✨ Leo knows what you're looking for`

**Content:**
- Summary of preferences captured
- What happens next (daily recommendations)
- CTA: "See your dashboard" → `/dashboard`

**Data needed:**
```typescript
interface OnboardingCompleteData {
  userName: string;
  locale: 'es' | 'en';
  profileSummary: {
    budgetRange: string;      // "€300k - €450k"
    areas: string[];          // ["Gràcia", "Eixample"]
    bedrooms: string;         // "2-3"
    keyPreferences: string[]; // ["Natural light", "Near metro"]
  };
}
```

---

### 3. Account Deleted

**Trigger:** User confirms account deletion in Settings

**Subject:** `Goodbye from Leo.casa`

**Content:**
- Confirmation of deletion
- What data was removed
- How to come back if they change their mind

**Data needed:**
```typescript
interface AccountDeletedData {
  userName: string;
  locale: 'es' | 'en';
}
```

---

### 4. New Recommendations

**Trigger:** Daily cron (`/api/cron/daily-recommendations`) finds new matches above threshold

**Frequency:** Max 1x per day (even if cron runs 3x)

**Subject:** `🏠 Leo encontró X propiedades para ti` / `🏠 Leo found X properties for you`

**Content:**
- Count of new recommendations
- Top 3 property cards (image, price, location, fit score)
- CTA: "See all recommendations" → `/recommendations`

**Data needed:**
```typescript
interface NewRecommendationsData {
  userName: string;
  locale: 'es' | 'en';
  newCount: number;
  topProperties: Array<{
    id: string;
    imageUrl: string;
    price: string;           // "€385,000"
    location: string;        // "Gràcia, Barcelona"
    beds: number;
    sqm: number;
    fitScore: number;        // 87
    fitReason: string;       // "Great natural light, near your gym"
  }>;
}
```

**Orchestration:**
```
┌─────────────────────────────────────────────────────────────┐
│  /api/cron/daily-recommendations (runs 3x daily)            │
├─────────────────────────────────────────────────────────────┤
│  1. Get all active users with intake_completed = true       │
│  2. For each user:                                          │
│     a. Run fit scoring against new listings (last 24h)      │
│     b. Filter to listings above threshold                   │
│     c. Check last_recommendation_email timestamp            │
│     d. If > 24h ago AND newMatches > 0:                     │
│        → Queue email via Resend                             │
│        → Update last_recommendation_email                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. Stock Insufficient

**Trigger:** Day 3 cron (`/api/cron/stock-check`) finds < 10 listings above threshold

**Subject:** `💡 Expanding your search might help` / `💡 Ampliar tu búsqueda podría ayudar`

**Content:**
- Current match count (low)
- Suggestion to soften criteria
- What Leo suggests adjusting
- CTA: "Talk to Leo about options" → `/speak-with-leo`

**Data needed:**
```typescript
interface StockInsufficientData {
  userName: string;
  locale: 'es' | 'en';
  currentMatchCount: number;
  suggestions: Array<{
    type: 'area' | 'budget' | 'size' | 'commute';
    current: string;
    suggested: string;
    additionalListings: number;
  }>;
}
```

**Orchestration:**
```
┌─────────────────────────────────────────────────────────────┐
│  /api/cron/stock-check (runs Day 3, then weekly)            │
├─────────────────────────────────────────────────────────────┤
│  1. Get users where created_at is 3 days ago OR             │
│     last_stock_check is > 7 days ago                        │
│  2. For each user:                                          │
│     a. Count listings above fit threshold                   │
│     b. If count < 10:                                       │
│        → Calculate what relaxations would add               │
│        → Queue stock-insufficient email                     │
│     c. Update last_stock_check timestamp                    │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. First Recommendations

**Trigger:** First batch run after onboarding complete (special variant of #4)

**Subject:** `🎉 Tus primeras recomendaciones están listas` / `🎉 Your first recommendations are ready`

**Content:**
- Excitement about first matches
- Top 3-5 property cards
- How the fit score works (brief)
- CTA: "Explore your matches" → `/recommendations`

**Data needed:** Same as New Recommendations + `isFirstBatch: true`

---

### 7. Price Drop Alert

**Trigger:** Saved listing price decreases (detected by harvester delta)

**Subject:** `📉 Price dropped on [Address]`

**Content:**
- Property card
- Old price → New price (with % drop)
- How long it's been on market
- CTA: "View property" → `/property/[id]`

**Data needed:**
```typescript
interface PriceDropData {
  userName: string;
  locale: 'es' | 'en';
  property: {
    id: string;
    imageUrl: string;
    address: string;
    oldPrice: number;
    newPrice: number;
    priceDrop: number;       // percentage
    daysOnMarket: number;
  };
}
```

**Orchestration:**
```
┌─────────────────────────────────────────────────────────────┐
│  Harvester Delta Detection                                  │
├─────────────────────────────────────────────────────────────┤
│  1. During harvest, compare new price to stored price       │
│  2. If price decreased:                                     │
│     a. Query saved_listings for users who saved this        │
│     b. For each user with saved_listing_alerts = true:      │
│        → Queue price-drop email                             │
│     c. Update listing price in database                     │
└─────────────────────────────────────────────────────────────┘
```

---

### 8. Price Increase Alert

**Trigger:** Saved listing price increases

**Subject:** `📈 Price increased on [Address]`

**Content:**
- Property card
- Old price → New price
- Option to remove from saved
- CTA: "View property" → `/property/[id]`

**Data needed:** Same as Price Drop

---

### 9. Off Market Alert

**Trigger:** Saved listing no longer found by harvester

**Subject:** `🏷️ [Address] is no longer available`

**Content:**
- Property card (last known info)
- "This property appears to be off the market"
- Similar alternatives (2-3 properties)
- CTA: "See similar properties" → `/recommendations`

**Data needed:**
```typescript
interface OffMarketData {
  userName: string;
  locale: 'es' | 'en';
  property: {
    id: string;
    imageUrl: string;
    address: string;
    lastPrice: number;
  };
  alternatives: Array<{
    id: string;
    imageUrl: string;
    price: string;
    location: string;
    fitScore: number;
  }>;
}
```

---

### 10. Back on Market

**Trigger:** Previously off-market listing reappears in harvest

**Subject:** `🔔 [Address] is back on the market!`

**Content:**
- Property card
- Current price (note if changed)
- CTA: "View property" → `/property/[id]`

---

### 11. Viewing Scheduled

**Trigger:** User confirms a viewing in the app

**Subject:** `📅 Viewing confirmed: [Address]`

**Content:**
- Property card
- Date/time of viewing
- Address with map link
- What to look for (from WPA)
- Add to calendar button

**Data needed:**
```typescript
interface ViewingScheduledData {
  userName: string;
  locale: 'es' | 'en';
  viewing: {
    propertyId: string;
    propertyImage: string;
    address: string;
    datetime: Date;
    agentName?: string;
    agentPhone?: string;
  };
  thingsToCheck: string[];   // From WPA analysis
}
```

---

### 12. Viewing Reminder

**Trigger:** Cron 24h before scheduled viewing

**Subject:** `⏰ Reminder: Viewing tomorrow at [Address]`

**Content:**
- Property card
- Date/time
- Address with directions link
- Checklist of things to ask/check
- Weather forecast (nice touch)

---

### 13. Post-Viewing Follow-up

**Trigger:** 2h after viewing datetime

**Subject:** `🏠 How was the viewing at [Address]?`

**Content:**
- Quick reaction buttons (Loved it / It was okay / Not for me)
- Prompt to add notes
- CTA: "Add your notes" → `/property/[id]#notes`

---

### 14. Client Invitation (Pro)

**Trigger:** Agent adds client email in Pro dashboard

**Subject:** `🏠 [Agent Name] wants to help you find a home`

**Content:**
- Agent/agency intro
- What Leo does for them
- CTA: "Accept invitation" → `/auth/signup?invite=[token]`

**Data needed:**
```typescript
interface ClientInvitationData {
  clientEmail: string;
  agentName: string;
  agencyName: string;
  locale: 'es' | 'en';
  inviteToken: string;
}
```

---

### 15. Shortlist Shared (Pro)

**Trigger:** Agent clicks "Send to client" on shortlist

**Subject:** `🏠 [Agent Name] shared X properties with you`

**Content:**
- Agent name
- Count of properties
- Top 3 property previews
- CTA: "View shortlist" → `/shortlist/[id]`

---

### 16. Client Reacted (Pro → Agent)

**Trigger:** Client likes/comments on property in shared shortlist

**Subject:** `💬 [Client Name] reacted to [Address]`

**Content:**
- Client name + avatar
- Property card
- Their reaction (❤️ liked / 💬 comment text)
- CTA: "View in dashboard" → `/pro/clients/[id]`

---

### 17. Incomplete Intake Nudge

**Trigger:** User signed up 24h ago but hasn't completed intake call

**Subject:** `🏠 Leo is ready when you are` / `🏠 Leo está listo cuando tú lo estés`

**Content:**
```
Hey [Name],

You signed up for Leo.casa but haven't told me what you're looking for yet!

I'd love to help you find your perfect place. It only takes a 5-minute chat.

[Talk to Leo →]

I'll ask about your budget, preferred areas, and what matters most to you. 
Then I'll start finding properties that actually fit.
```

**Data needed:**
```typescript
interface IncompleteIntakeData {
  userName: string;
  locale: 'es' | 'en';
  signupDate: Date;
}
```

**Orchestration:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  /api/cron/incomplete-intake-check (runs daily)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Find users where:                                                       │
│     - created_at > 24h ago AND < 48h ago                                    │
│     - intake_completed = false                                              │
│     - incomplete_intake_nudge_sent = false                                  │
│  2. For each user:                                                          │
│     → Send incomplete intake email                                          │
│     → Set incomplete_intake_nudge_sent = true                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 18. Incomplete Intake Final

**Trigger:** User signed up 72h ago, still no intake, first nudge already sent

**Subject:** `⏰ Don't miss out — Leo is waiting` / `⏰ No te lo pierdas — Leo te espera`

**Content:**
```
Hey [Name],

It's been a few days since you signed up. Properties are coming and going fast!

The sooner you tell Leo what you're looking for, the sooner you'll see matches.

[Start now — takes 5 minutes →]

After this, I won't bug you again. But I'll be here whenever you're ready.
```

**Data needed:**
```typescript
interface IncompleteIntakeFinalData {
  userName: string;
  locale: 'es' | 'en';
  daysSinceSignup: number;
}
```

---

### 19. Follow-up Call Request

**Trigger:** Leo flags during intake that preferences are unclear or need refinement

**Subject:** `📞 Leo wants to follow up with you`

**Content:**
```
Hey [Name],

During our last chat, I noticed [reason — e.g., "we didn't finish discussing your commute preferences" or "you mentioned some things I'd like to clarify"].

A quick 5-minute follow-up would help me find you better matches.

[Schedule follow-up with Leo →]

Current understanding:
• Budget: €300k - €450k
• Areas: Gràcia, Eixample  
• Beds: 2-3
• [❓ Commute preferences unclear]
```

**Data needed:**
```typescript
interface FollowUpCallData {
  userName: string;
  locale: 'es' | 'en';
  reason: string;                    // Why follow-up is needed
  currentPreferences: {
    budget?: string;
    areas?: string[];
    beds?: string;
    unclear?: string[];              // What's unclear
  };
}
```

**Trigger mechanism:**
- Leo sets `needs_followup = true` and `followup_reason = "..."` during intake
- Cron job picks this up and sends email
- Or: Manual trigger from admin dashboard

---

### 20. Post-Viewing Notes Nudge

**Trigger:** 24h after scheduled viewing time, user hasn't added notes

**Subject:** `🏠 How was [Address]? Add your thoughts`

**Content:**
```
Hey [Name],

You viewed this property yesterday:

┌─────────────────────────────────────────┐
│ [Property Image]                        │
│                                         │
│ Carrer de Bailèn 124, 3º 2ª            │
│ Eixample, Barcelona                     │
│                                         │
│ €385,000 · 3 hab · 85m²                │
│ Your fit score: 87%                     │
└─────────────────────────────────────────┘

What did you think? Your notes help Leo understand what you really want.

[Add my notes →]

Quick prompts:
• Did it feel like the photos?
• How was the natural light?
• Any red flags?
• Would you live there?
```

**Data needed:**
```typescript
interface PostViewingNotesData {
  userName: string;
  locale: 'es' | 'en';
  viewing: {
    propertyId: string;
    propertyImage: string;
    address: string;
    neighborhood: string;
    city: string;
    price: number;
    beds: number;
    sqm: number;
    fitScore: number;
    viewingDate: Date;
  };
}
```

**Orchestration:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  /api/cron/post-viewing-notes-check (runs hourly)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Find viewings where:                                                    │
│     - scheduled_at > 24h ago AND < 48h ago                                  │
│     - notes_nudge_sent = false                                              │
│  2. For each viewing, check if notes exist:                                 │
│     - Query notes table for this user + property                            │
│  3. If NO notes:                                                            │
│     → Send post-viewing notes nudge                                         │
│     → Set notes_nudge_sent = true                                           │
│  4. If notes exist:                                                         │
│     → Skip, set notes_nudge_sent = true (no need to nudge)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 21. Weekly Engagement

**Trigger:** 7+ days since last app visit, user is subscribed

**Subject:** `🏠 [X] new properties match your search`

**Content:**
```
Hey [Name],

It's been a week since you checked in. Leo has been busy!

Since your last visit:
• 8 new properties match your criteria
• 2 saved properties had price changes
• 1 saved property went off market

[See what's new →]

Still looking? Leo is here to help.
Not searching anymore? You can pause your subscription anytime.
```

**Data needed:**
```typescript
interface WeeklyEngagementData {
  userName: string;
  locale: 'es' | 'en';
  daysSinceVisit: number;
  newMatchesCount: number;
  priceChangesCount: number;
  offMarketCount: number;
}
```

---

## Email Template Architecture

### Base Template

All emails share a common wrapper:

```tsx
// src/lib/email/templates/BaseEmail.tsx

interface BaseEmailProps {
  previewText: string;
  children: React.ReactNode;
  locale: 'es' | 'en';
}

export const BaseEmail = ({ previewText, children, locale }: BaseEmailProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={bodyStyle}>
      <Container style={containerStyle}>
        {/* Header */}
        <Section style={headerStyle}>
          <Text style={logoStyle}>Leo.casa</Text>
        </Section>
        
        {/* Content */}
        <Section style={contentStyle}>
          {children}
        </Section>
        
        {/* Footer */}
        <Section style={footerStyle}>
          <Text style={footerTextStyle}>Leo.casa · Barcelona, Spain</Text>
          <Link href="https://leo.casa/privacy">
            {locale === 'es' ? 'Privacidad' : 'Privacy'}
          </Link>
          <Text> · </Text>
          <Link href="https://leo.casa/settings">
            {locale === 'es' ? 'Preferencias de email' : 'Email Preferences'}
          </Link>
        </Section>
      </Container>
    </Body>
  </Html>
);
```

### Brand Styles

```typescript
// src/lib/email/styles.ts

export const colors = {
  background: '#ffffff',
  text: '#1c1917',          // stone-900
  textMuted: '#78716c',     // stone-500
  textLight: '#a8a29e',     // stone-400
  border: '#f5f5f4',        // stone-100
  cardBg: '#ffffff',
  footerBg: '#fafaf9',      // stone-50
  
  // Accent colors
  amber: '#fef9c3',         // amber-100 (recommendations)
  rose: '#fce7f3',          // rose-100 (saved/liked)
  green: '#dcfce7',         // green-100 (success)
  
  // Button
  buttonBg: '#1c1917',
  buttonText: '#ffffff',
};

export const fonts = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};
```

### Property Card Component

```tsx
// src/lib/email/components/PropertyCard.tsx

interface PropertyCardProps {
  imageUrl: string;
  price: string;
  location: string;
  beds: number;
  sqm: number;
  fitScore?: number;
  href: string;
}

export const PropertyCard = (props: PropertyCardProps) => (
  <Section style={cardStyle}>
    <Img src={props.imageUrl} style={imageStyle} />
    <Row>
      <Column>
        <Text style={priceStyle}>{props.price}</Text>
        <Text style={detailsStyle}>{props.beds} hab · {props.sqm}m²</Text>
        <Text style={locationStyle}>{props.location}</Text>
      </Column>
      {props.fitScore && (
        <Column style={fitScoreColumn}>
          <Text style={fitScoreStyle}>{props.fitScore}%</Text>
        </Column>
      )}
    </Row>
  </Section>
);
```

---

## Orchestration

### Cron Jobs

| Cron | Schedule | Emails Triggered |
|------|----------|------------------|
| `/api/cron/daily-recommendations` | 3x daily (8am, 2pm, 8pm) | New Recommendations, First Recommendations |
| `/api/cron/stock-check` | Daily | Stock Insufficient |
| `/api/cron/viewing-reminders` | Hourly | Viewing Reminder |
| `/api/cron/post-viewing` | Hourly | Post-Viewing Follow-up |
| `/api/cron/incomplete-intake` | Daily | Incomplete Intake, Incomplete Intake Final |
| `/api/cron/post-viewing-notes` | Hourly | Post-Viewing Notes Nudge |
| `/api/cron/weekly-engagement` | Daily | Weekly Engagement |
| `/api/cron/followup-calls` | Daily | Follow-up Call Request |

### Event-Driven

| Event | Source | Email Triggered |
|-------|--------|-----------------|
| User signup | Supabase webhook | Welcome |
| Intake complete | Profile update | Onboarding Complete |
| Account deleted | Settings action | Account Deleted |
| Price change | Harvester delta | Price Drop / Increase |
| Listing removed | Harvester delta | Off Market |
| Listing returned | Harvester delta | Back on Market |
| Viewing created | User action | Viewing Scheduled |
| Agent adds client | Pro action | Client Invitation |
| Agent shares shortlist | Pro action | Shortlist Shared |
| Client reacts | Client action | Client Reacted |

### Email Queue

Use Resend's batch API for high-volume sends:

```typescript
// src/lib/email/queue.ts

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface QueuedEmail {
  to: string;
  subject: string;
  html: string;
  scheduledAt?: Date;
}

export async function sendBatch(emails: QueuedEmail[]) {
  // Resend supports up to 100 emails per batch
  const batches = chunk(emails, 100);
  
  for (const batch of batches) {
    await resend.batch.send(
      batch.map(email => ({
        from: 'Leo <operator@example.invalid>',
        to: email.to,
        subject: email.subject,
        html: email.html,
      }))
    );
  }
}
```

---

## Database Schema

### Email Tracking

```sql
-- Track email sends and preferences
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,           -- 'welcome', 'new_recommendations', etc.
  resend_id TEXT,                     -- Resend message ID
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,              -- Via Resend webhook
  clicked_at TIMESTAMPTZ,             -- Via Resend webhook
  metadata JSONB                      -- Additional context
);

-- Index for querying user email history
CREATE INDEX idx_email_logs_user ON email_logs(user_id, email_type, sent_at DESC);

-- Timestamps for rate limiting
ALTER TABLE user_lifestyle_profiles ADD COLUMN last_recommendation_email TIMESTAMPTZ;
ALTER TABLE user_lifestyle_profiles ADD COLUMN last_stock_check TIMESTAMPTZ;

-- Nudge email tracking
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN incomplete_intake_nudge_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN incomplete_intake_final_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN needs_followup BOOLEAN DEFAULT FALSE,
ADD COLUMN followup_reason TEXT,
ADD COLUMN followup_email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN last_app_visit TIMESTAMPTZ,
ADD COLUMN weekly_engagement_sent_at TIMESTAMPTZ;

-- Viewing notes nudge tracking (on viewings table)
ALTER TABLE viewings 
ADD COLUMN notes_nudge_sent BOOLEAN DEFAULT FALSE;
```

---

## Implementation Checklist

### Phase 1: Core Emails (P0)

```
□ 1.1 Set up email infrastructure (2 hr)
      - Create src/lib/email/ folder structure
      - Install @react-email/components
      - Create BaseEmail template
      - Create brand styles

□ 1.2 Welcome email (1 hr)
      - Create template
      - Hook to signup flow
      - Test send

□ 1.3 New Recommendations email (3 hr)
      - Create template with PropertyCard
      - Create /api/cron/daily-recommendations
      - Add rate limiting (1x per 24h)
      - Test with sample data

□ 1.4 Stock Insufficient email (2 hr)
      - Create template
      - Create /api/cron/stock-check
      - Calculate suggestions logic

□ 1.5 Price Drop alert (2 hr)
      - Create template
      - Hook to harvester delta detection
      - Query saved_listings for affected users

□ 1.6 Off Market alert (2 hr)
      - Create template
      - Hook to harvester removal detection
      - Include alternatives logic
```

### Phase 2: Engagement Emails (P1)

```
□ 2.1 Onboarding Complete email (1 hr)
□ 2.2 Viewing Scheduled email (1 hr)
□ 2.3 Viewing Reminder email (1 hr)
□ 2.4 Client Invitation email (2 hr)
□ 2.5 Shortlist Shared email (2 hr)
□ 2.6 Client Reacted email (1 hr)
```

### Phase 3: Nudge Emails (P0/P1)

```
□ 3.1 Incomplete Intake nudge (2 hr)
      - Template with CTA to speak-with-leo
      - Cron: /api/cron/incomplete-intake
      - Track with incomplete_intake_nudge_sent flag

□ 3.2 Incomplete Intake Final (1 hr)
      - "Last chance" template
      - Trigger 72h after signup

□ 3.3 Post-Viewing Notes nudge (2 hr)
      - Template with property card + photo
      - Note prompts (light, red flags, would you live there?)
      - Cron: /api/cron/post-viewing-notes
      - Track with notes_nudge_sent on viewings table

□ 3.4 Follow-up Call Request (2 hr)
      - Template showing what's unclear
      - Leo sets needs_followup flag during intake
      - Cron picks up and sends

□ 3.5 Weekly Engagement (1 hr)
      - Template with activity summary
      - Track last_app_visit
      - Only for subscribed users
```

### Phase 4: Polish (P2)

```
□ 4.1 Post-Viewing Follow-up email (basic) (1 hr)
□ 4.2 Back on Market email (1 hr)
□ 4.3 Price Increase alert (1 hr)
□ 4.4 Account Deleted email (1 hr)
□ 4.5 Email open/click tracking via Resend webhooks (2 hr)
```

---

## Testing

### Local Testing

```bash
# Preview emails in browser
npm run email:dev

# Send test email
npx tsx scripts/test-email.ts --template=welcome --to=operator@example.invalid
```

### Test Checklist

```
□ All emails render correctly in:
  - Gmail (web + mobile)
  - Apple Mail
  - Outlook
  - Yahoo Mail

□ All links work and track correctly
□ Images load (check Supabase storage URLs)
□ Unsubscribe/preferences links work
□ Spanish and English versions correct
□ Rate limiting prevents spam
□ Cron jobs run on schedule
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0 Index](./P0_INDEX.md) | Master index |
| [P0-08-TASKS](./P0-08-TASKS.md) | Phase 5.4 original spec |
| [P0-15-LEGAL-COMPLIANCE](./P0-15-LEGAL-COMPLIANCE.md) | GDPR, email preferences |
| [P0-14-HARVESTING](./P0-14-HARVESTING.md) | Delta detection for alerts |

---

*Last Updated: December 2024*
