# P0-17: Trial & Paywall System

> **Parent:** [P0 Index](./P0_INDEX.md)
> **Related:** [P0-09-BILLING-STRIPE](./P0-09-BILLING-STRIPE.md), [P0-16-EMAIL-TEMPLATES](./P0-16-EMAIL-TEMPLATES.md)

---

## Overview

Users get a **1-week free trial** starting when they complete their intake call with Leo. After the trial, they must subscribe to continue receiving recommendations.

**Key principle:** The trial is about experiencing the value (Leo finding properties for you), not just signing up.

---

## Pricing (Weekly Billing)

| Plan | Price | Billing | Why Weekly |
|------|-------|---------|------------|
| Renter | €2.99/week | Weekly | Property search is urgent, time-bound |
| Buyer | €2.99/week | Weekly | Aligns with active search period |
| Pro | €14.99/week | Weekly | Per-client basis makes sense |

**Why weekly, not monthly:**
- Property search happens in bursts (2-8 weeks typically)
- Weekly feels low-commitment ("just €3 to keep going")
- Users can cancel anytime without feeling locked in
- Matches the cadence of new listings appearing

---

## Trial Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRIAL LIFECYCLE                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 0: INTAKE COMPLETE                                                     │
│  ├── trial_started_at = NOW()                                               │
│  ├── trial_ends_at = NOW() + 7 days                                         │
│  ├── Send "Welcome" email (mentions trial)                                  │
│  └── Full access begins                                                     │
│                                                                             │
│  Day 1-6: TRIAL ACTIVE                                                      │
│  ├── Daily recommendations (if available)                                   │
│  ├── Full access to all features                                            │
│  ├── Recommendation emails sent                                             │
│  └── Leo mentions "your trial week" in UI                                   │
│                                                                             │
│  Day 5: TRIAL REMINDER                                                      │
│  ├── Send "2 days left" email                                               │
│  ├── Show subtle banner in app                                              │
│  └── Include subscribe CTA                                                  │
│                                                                             │
│  Day 7: TRIAL ENDS                                                          │
│  ├── IF subscribed → Continue normally                                      │
│  └── IF NOT subscribed → Enter PAYWALL state                                │
│                                                                             │
│  Day 7+: PAYWALL STATE                                                      │
│  ├── Stop generating new recommendations                                    │
│  ├── Stop sending recommendation emails                                     │
│  ├── Show existing recommendations (not blurred)                            │
│  ├── Show "ghost card" suggesting more exist                                │
│  ├── Show subscribe CTA prominently                                         │
│  └── Send "Trial ended" email (once)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Add trial columns to user_lifestyle_profiles
ALTER TABLE user_lifestyle_profiles
ADD COLUMN trial_started_at TIMESTAMPTZ,
ADD COLUMN trial_ends_at TIMESTAMPTZ,
ADD COLUMN trial_reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN trial_ended_email_sent BOOLEAN DEFAULT FALSE;

-- Update subscription columns for weekly billing
-- (Modify existing P0-09 schema)
ALTER TABLE user_profiles
ADD COLUMN subscription_interval TEXT DEFAULT 'week'
  CHECK (subscription_interval IN ('week', 'month'));
```

### User States

```typescript
type UserSubscriptionState = 
  | 'no_intake'        // Signed up but hasn't done intake
  | 'trial_active'     // Within 7 days of intake, no subscription
  | 'trial_expired'    // Past 7 days, no subscription (PAYWALL)
  | 'subscribed'       // Active subscription
  | 'churned'          // Was subscribed, now canceled
  | 'paused';          // Subscription paused

function getUserState(user: User): UserSubscriptionState {
  const profile = user.lifestyle_profile;
  
  if (!profile?.intake_completed) return 'no_intake';
  
  if (user.subscription_status === 'active') return 'subscribed';
  if (user.subscription_status === 'paused') return 'paused';
  if (user.subscription_status === 'canceled') return 'churned';
  
  const trialEnd = new Date(profile.trial_ends_at);
  const now = new Date();
  
  if (now < trialEnd) return 'trial_active';
  return 'trial_expired';
}
```

---

## What Users See During Trial

### Intake Call

Leo mentions the trial naturally:

> "I'll start finding properties for you right away. You'll have full access for the next week to see how I work. After that, it's just €2.99 a week to keep the recommendations coming."

### Dashboard (Trial Active)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Mis Propiedades                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✨ Tu semana de prueba · 5 días restantes                           │    │
│  │ Disfruta de recomendaciones ilimitadas. Después: €2,99/semana      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Recomendadas para ti                                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                           │
│  │ Prop 1  │ │ Prop 2  │ │ Prop 3  │ │ Prop 4  │                           │
│  │ €385k   │ │ €420k   │ │ €395k   │ │ €410k   │                           │
│  │ 87%     │ │ 84%     │ │ 82%     │ │ 81%     │                           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dashboard (Day 5-6 - Trial Ending Soon)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Mis Propiedades                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ⏰ Tu prueba termina en 2 días                                      │    │
│  │ Suscríbete para seguir recibiendo recomendaciones personalizadas   │    │
│  │                                              [Suscribirme →]        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ... recommendations ...                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Users See After Trial (Paywall State)

### Dashboard (Trial Expired)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Mis Propiedades                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔒 Tu semana de prueba ha terminado                                 │    │
│  │                                                                     │    │
│  │ Leo encontró 12 propiedades más para ti esta semana.               │    │
│  │ Suscríbete para verlas y recibir nuevas recomendaciones.           │    │
│  │                                                                     │    │
│  │                    [Suscribirme · €2,99/semana]                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Últimas recomendaciones de tu prueba                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐                     │
│  │ Prop 1  │ │ Prop 2  │ │ Prop 3  │ │ ░░░░░░░░░░░░░ │                     │
│  │ €385k   │ │ €420k   │ │ €395k   │ │ ░░ +12 más ░░ │                     │
│  │ 87%     │ │ 84%     │ │ 82%     │ │ ░░░░░░░░░░░░░ │                     │
│  └─────────┘ └─────────┘ └─────────┘ └───────────────┘                     │
│                                       ↑                                     │
│                              "Ghost card" - blurred                         │
│                              Shows there's more                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Ghost Card Component

```tsx
// src/components/recommendations/GhostCard.tsx

interface GhostCardProps {
  hiddenCount: number;
  onSubscribe: () => void;
  locale: 'es' | 'en';
}

export const GhostCard = ({ hiddenCount, onSubscribe, locale }: GhostCardProps) => {
  const text = locale === 'es' 
    ? `+${hiddenCount} más` 
    : `+${hiddenCount} more`;
  
  return (
    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100">
      {/* Blurred background suggesting a property */}
      <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300 backdrop-blur-xl" />
      
      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        <div className="text-2xl font-semibold text-stone-500 mb-2">
          {text}
        </div>
        <Button 
          onClick={onSubscribe}
          className="rounded-full"
        >
          {locale === 'es' ? 'Ver todas' : 'See all'}
        </Button>
      </div>
    </div>
  );
};
```

---

## Emails

### Trial-Related Emails (Add to P0-16)

| Email | Trigger | Day |
|-------|---------|-----|
| Welcome (with trial mention) | Intake complete | 0 |
| Trial Reminder | 2 days before expiry | 5 |
| Trial Ended | Trial expires, not subscribed | 7 |
| We Miss You | 3 days after trial ended, still not subscribed | 10 |

### Welcome Email (Updated)

**Subject:** `🏠 Welcome to Leo.casa — Your trial week starts now`

Include:
- What Leo will do
- "You have 7 days of full access"
- What happens after (€2.99/week)
- CTA: "See your dashboard"

### Trial Reminder Email (Day 5)

**Subject:** `⏰ 2 days left in your Leo.casa trial`

**Content:**
```
Hey [Name],

Your trial week ends in 2 days. So far, Leo has found [X] properties that match your preferences.

To keep receiving personalized recommendations, subscribe for just €2.99/week.

[Continue with Leo →]

No commitment — cancel anytime.
```

### Trial Ended Email (Day 7)

**Subject:** `Your Leo.casa trial has ended`

**Content:**
```
Hey [Name],

Your free trial week has ended. Leo found [X] new properties for you this week that you haven't seen yet.

Subscribe now to unlock them and keep receiving daily recommendations.

[Subscribe · €2.99/week →]

Your saved properties and notes are still there waiting for you.
```

### We Miss You Email (Day 10)

**Subject:** `[X] properties are waiting for you`

**Content:**
```
Hey [Name],

Since your trial ended, Leo has found [X] more properties that match what you're looking for.

Ready to continue your search?

[Come back to Leo →]
```

---

## API Endpoints

### Trial Status

```typescript
// GET /api/user/trial-status
interface TrialStatusResponse {
  state: UserSubscriptionState;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  hiddenRecommendationsCount: number;  // For ghost card
}
```

### Recommendations (Modified)

```typescript
// GET /api/recommendations
interface RecommendationsResponse {
  recommendations: Property[];
  
  // Paywall info (only if trial_expired)
  paywall?: {
    hiddenCount: number;           // How many they can't see
    lastTrialRecommendations: Property[];  // Last 3 from trial
    subscribeUrl: string;
  };
}
```

---

## Stripe Configuration (Weekly)

```bash
# Create weekly prices
stripe prices create \
  --product="prod_RENTER" \
  --unit-amount=299 \
  --currency=eur \
  --recurring[interval]=week

stripe prices create \
  --product="prod_BUYER" \
  --unit-amount=299 \
  --currency=eur \
  --recurring[interval]=week

stripe prices create \
  --product="prod_PRO" \
  --unit-amount=1499 \
  --currency=eur \
  --recurring[interval]=week
```

### Price IDs

| Plan | Interval | Price ID | Amount |
|------|----------|----------|--------|
| Renter | Weekly | `price_renter_weekly` | €2.99 |
| Buyer | Weekly | `price_buyer_weekly` | €2.99 |
| Pro | Weekly | `price_pro_weekly` | €14.99 |

---

## Cron Jobs

### Daily Trial Check

```typescript
// /api/cron/trial-check (runs daily)

async function checkTrials() {
  const supabase = getSupabaseAdmin();
  
  // 1. Find users whose trial ends in 2 days (send reminder)
  const { data: almostExpired } = await supabase
    .from('user_lifestyle_profiles')
    .select('user_id, trial_ends_at')
    .eq('trial_reminder_sent', false)
    .lt('trial_ends_at', addDays(new Date(), 2))
    .gt('trial_ends_at', new Date());
  
  for (const user of almostExpired) {
    await sendTrialReminderEmail(user.user_id);
    await supabase
      .from('user_lifestyle_profiles')
      .update({ trial_reminder_sent: true })
      .eq('user_id', user.user_id);
  }
  
  // 2. Find users whose trial just ended (send ended email)
  const { data: justExpired } = await supabase
    .from('user_lifestyle_profiles')
    .select('user_id, trial_ends_at')
    .eq('trial_ended_email_sent', false)
    .lt('trial_ends_at', new Date())
    .is('subscription_status', null);  // Not subscribed
  
  for (const user of justExpired) {
    await sendTrialEndedEmail(user.user_id);
    await supabase
      .from('user_lifestyle_profiles')
      .update({ trial_ended_email_sent: true })
      .eq('user_id', user.user_id);
  }
}
```

---

## Edge Cases

### User Subscribes Mid-Trial

- Trial columns remain (for analytics)
- `subscription_status` = 'active' takes precedence
- Full access continues seamlessly

### User Cancels Subscription

- Access continues until `subscription_ends_at`
- Then enters same state as `trial_expired`
- Can re-subscribe anytime

### User Re-subscribes After Lapse

- Immediately regain full access
- See all recommendations that accumulated
- Resume recommendation emails

### Payment Fails

- Stripe retries automatically (3 attempts over ~7 days)
- User stays active during retry period
- If all retries fail → `subscription_status` = 'past_due'
- Treat `past_due` same as `trial_expired` (paywall)
- Send "Payment failed" email with update payment link

---

## Implementation Checklist

### Phase 1: Trial Infrastructure

```
□ 1.1 Database migration (1 hr)
      - Add trial_started_at, trial_ends_at columns
      - Add trial_reminder_sent, trial_ended_email_sent flags

□ 1.2 Set trial on intake complete (1 hr)
      - Update intake completion handler
      - Set trial_ends_at = NOW() + 7 days

□ 1.3 Trial status API (1 hr)
      - GET /api/user/trial-status
      - Calculate daysRemaining, state

□ 1.4 getUserState utility (1 hr)
      - Centralized state calculation
      - Used by all components
```

### Phase 2: Paywall UI

```
□ 2.1 Trial banner component (1 hr)
      - Shows days remaining
      - Different states (active, ending soon, expired)

□ 2.2 Ghost card component (1 hr)
      - Blurred card showing "+X more"
      - Subscribe CTA

□ 2.3 Update recommendations page (2 hr)
      - Check user state
      - Show ghost card if trial_expired
      - Show trial banner

□ 2.4 Paywall modal (1 hr)
      - Full-screen modal for expired users
      - Price, benefits, subscribe button
```

### Phase 3: Stripe Weekly

```
□ 3.1 Create weekly prices in Stripe (30 min)
□ 3.2 Update checkout to use weekly prices (30 min)
□ 3.3 Update billing UI to show weekly (30 min)
```

### Phase 4: Trial Emails

```
□ 4.1 Update Welcome email (30 min)
      - Add trial week mention

□ 4.2 Trial Reminder email (1 hr)
      - Template + trigger

□ 4.3 Trial Ended email (1 hr)
      - Template + trigger

□ 4.4 Trial check cron job (1 hr)
      - Daily check for reminders/expirations

□ 4.5 "We Miss You" email (30 min)
      - Template + 3-day-after trigger
```

### Phase 5: Recommendation Flow Updates

```
□ 5.1 Skip recommendations for expired users (1 hr)
      - Update daily-recommendations cron
      - Don't process users with trial_expired state

□ 5.2 Track hidden count (1 hr)
      - Count recommendations generated but not shown
      - Store for ghost card display

□ 5.3 Stop emails for expired users (30 min)
      - Check subscription state before sending
```

---

## Metrics to Track

| Metric | Description |
|--------|-------------|
| `trial_started` | Users who completed intake |
| `trial_converted` | Users who subscribed during/after trial |
| `trial_conversion_rate` | converted / started |
| `trial_to_paid_days` | Average days from trial start to subscribe |
| `churn_rate` | Weekly cancellations / active subscribers |
| `reactivation_rate` | Churned users who re-subscribe |

---

## Leo's Voice (Intake Call)

When Leo explains the trial during intake:

**English:**
> "Great! I'll start finding properties for you right away. You'll have full access for the next week — I'll send you new matches as they come up. After your trial week, it's just €2.99 a week to keep the recommendations coming. You can cancel anytime."

**Spanish:**
> "¡Perfecto! Empezaré a buscar propiedades para ti ahora mismo. Tendrás acceso completo durante la próxima semana — te enviaré nuevas coincidencias según aparezcan. Después de tu semana de prueba, son solo €2,99 a la semana para seguir recibiendo recomendaciones. Puedes cancelar cuando quieras."

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0 Index](./P0_INDEX.md) | Master index |
| [P0-09-BILLING-STRIPE](./P0-09-BILLING-STRIPE.md) | Stripe integration, webhooks |
| [P0-16-EMAIL-TEMPLATES](./P0-16-EMAIL-TEMPLATES.md) | Email templates |
| [P0-05-ELEVENLABS-AGENTS](./P0-05-ELEVENLABS-AGENTS.md) | Leo's voice scripts |

---

*Last Updated: December 2024*
