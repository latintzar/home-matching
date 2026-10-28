# P0-09: Billing & Stripe Integration

> Complete Stripe integration for subscription management.
>
> **See also:** [P0-17-TRIAL-PAYWALL](./P0-17-TRIAL-PAYWALL.md) for trial flow, paywall UI, and weekly billing details.

## Quick Reference

| Product | Price | Profile Type | Product ID |
|---------|-------|--------------|------------|
| Renter | €9.99/month | `renter` | `prod_RENTER` |
| Buyer | €9.99/month | `buyer` | `prod_BUYER` |
| Pro | €49/month | `pro` | `prod_PRO` |

---

## 1. Stripe Products Setup

```bash
# Install & Login
brew install stripe/stripe-cli/stripe
stripe login --api-key $STRIPE_SECRET_KEY

# Create Products
stripe products create --name="Leo.casa Alquiler (Renter)"
stripe prices create --product="prod_RENTER" --unit-amount=999 --currency=eur --recurring[interval]=month

stripe products create --name="Leo.casa Compra (Buyer)"
stripe prices create --product="prod_BUYER" --unit-amount=999 --currency=eur --recurring[interval]=month

stripe products create --name="Leo.casa Pro"
stripe prices create --product="prod_PRO" --unit-amount=4900 --currency=eur --recurring[interval]=month
```

---

## 2. Database Schema

> **NOTE**: Billing is at USER level (not profile level). One subscription = one profile type.

```sql
-- Migration: 075_linked_profiles.sql (billing portion)

-- Billing columns on user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_type TEXT 
  CHECK (subscription_type IN ('renter', 'buyer', 'pro', NULL));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'paused', 'canceled', 'past_due'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe 
  ON user_profiles(stripe_customer_id);
```

---

## 3. Billing APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/billing/checkout` | POST | Create Stripe Checkout session |
| `/api/billing/subscription` | GET | Get current subscription status |
| `/api/billing/invoices` | GET | Get invoice history |
| `/api/billing/pause` | POST | Pause subscription |
| `/api/billing/resume` | POST | Resume subscription |
| `/api/webhooks/stripe` | POST | Handle Stripe events |

### Checkout Endpoint

```typescript
// POST /api/billing/checkout
interface CheckoutRequest {
  profileType: 'renter' | 'buyer' | 'pro';
  successUrl: string;
  cancelUrl: string;
}

interface CheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}
```

### Subscription Status Endpoint

```typescript
// GET /api/billing/subscription
interface SubscriptionResponse {
  subscription_type: 'renter' | 'buyer' | 'pro' | null;
  subscription_status: 'none' | 'active' | 'paused' | 'canceled' | 'past_due';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
```

---

## 4. Subscription Rules

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SUBSCRIPTION → PROFILE ACCESS                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  subscription_type = 'renter'                                           │
│    → Can access renter profile ✅                                        │
│    → Cannot access buyer profile ❌ (paywall)                            │
│                                                                         │
│  subscription_type = 'buyer'                                            │
│    → Can access buyer profile ✅                                         │
│    → Cannot access renter profile ❌ (paywall)                           │
│                                                                         │
│  subscription_type = NULL (no subscription)                             │
│    → Can do intake for ONE profile (trial)                              │
│    → Hits paywall after intake                                          │
│                                                                         │
│  SWITCHING SUBSCRIPTIONS:                                               │
│    User wants to switch from renter to buyer:                           │
│    1. Cancel renter subscription                                        │
│    2. Start buyer subscription                                          │
│    3. Renter profile preserved but read-only                            │
│                                                                         │
│  BOTH SUBSCRIPTIONS (rare):                                             │
│    User can subscribe to BOTH if they want both active                  │
│    Cost: €9.99 + €9.99 = €19.98/mo                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Billing Page UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 💳 Facturación                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Tus suscripciones                                                       │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🏠 Alquiler (Renter)                                   ✅ ACTIVA   │ │
│ │ €9,99/mes · Próximo cobro: 15 ene 2026                              │ │
│ │ [Pausar]  [Cancelar]                                                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🔑 Compra (Buyer)                                      ❌ NO ACTIVA │ │
│ │ €9,99/mes                                                           │ │
│ │ [Suscribirse →]                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Historial de facturas                                                   │
│ ─────────────────────────────────────────────────────────────────────── │
│ │ Fecha      │ Plan     │ Importe │ Estado  │                         │ │
│ │ 15 dic 25  │ Alquiler │ €9,99   │ ✅ Paid  │ [Ver →]                │ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Stripe Webhook Events

```typescript
// POST /api/webhooks/stripe
const HANDLED_EVENTS = [
  'checkout.session.completed',    // User completed checkout
  'customer.subscription.created', // New subscription
  'customer.subscription.updated', // Status change (pause/resume)
  'customer.subscription.deleted', // Subscription canceled
  'invoice.paid',                  // Payment successful
  'invoice.payment_failed',        // Payment failed
];

// Example handler
switch (event.type) {
  case 'checkout.session.completed':
    const session = event.data.object;
    const userId = session.metadata.userId;
    const profileType = session.metadata.profileType;
    
    await supabase.from('user_profiles').update({
      stripe_customer_id: session.customer,
      subscription_type: profileType,
      subscription_status: 'active',
      stripe_subscription_id: session.subscription,
      subscription_started_at: new Date().toISOString(),
    }).eq('id', userId);
    break;
    
  case 'customer.subscription.deleted':
    await supabase.from('user_profiles').update({
      subscription_status: 'canceled',
      subscription_ends_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', event.data.object.id);
    break;
}
```

---

## 7. Task Checklist

- [x] Apply migration 071 (billing tables)
- [ ] Install Stripe CLI (user setup required)
- [ ] Configure Stripe products and prices (user setup required)
- [x] Create Checkout endpoint (`/api/billing/checkout`)
- [x] Create subscription status endpoint (`/api/billing/subscription`)
- [x] Create invoices endpoint (`/api/billing/invoices`)
- [x] Create pause/resume endpoints (`/api/billing/pause`, `/api/billing/resume`)
- [x] Set up Stripe webhooks (updated `/api/stripe/webhook`)
- [x] Create Billing page UI (`/billing`)
- [x] Add "Facturación" to sidebar

---

## 8. Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

---

*Part of [P0 Lean App Documentation](./P0_INDEX.md)*
