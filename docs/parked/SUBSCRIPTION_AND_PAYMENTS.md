# Subscription & Payments Model

**Last Updated**: December 1, 2024

---

## 💳 Subscription Tiers

### B2C Users (Renters & Buyers)

| Tier | Free Trial | After Trial |
|------|------------|-------------|
| **Free** | 7 days of recommendations | ❌ Recommendations stop until paid |
| **Paid** | N/A | ✅ Unlimited recommendations |

**Flow:**
1. User signs up → Gets 7 days free
2. After 7 days → Recommendations stop
3. User sees paywall → Subscribe via Stripe Checkout
4. After payment → Recommendations resume

### Pro Users (Personal Shoppers / Relocation Agents)

| Tier | Free Trial | After Trial |
|------|------------|-------------|
| **Free** | 3 property analyses | ❌ Analysis stops until paid |
| **Paid** | N/A | ✅ Unlimited analyses |

**Flow:**
1. Pro signs up → Gets 3 free analyses
2. Can add properties via extension OR "Add Property" button
3. After 3 analyses → Analysis button disabled, paywall shown
4. Subscribe via Stripe Checkout → Unlimited analyses

---

## 🔐 Extension Authentication

**Requirement**: Extension MUST require login before use.

```
┌─────────────────────────────────────┐
│  🏠 Leo Pro                    [×]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │      [🔒 Login Required]        ││
│  │                                 ││
│  │  Inicia sesión para añadir      ││
│  │  propiedades a tus clientes.    ││
│  │                                 ││
│  │  [Iniciar sesión →]             ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

**After login:**
- Extension shows client list
- Can add properties (auto-analyzed)
- Tracks usage against subscription

---

## 🏠 Property Analysis Flow

### For Personal Shoppers

**Two ways to add properties:**

#### 1. Via Extension (Auto-Analyze)

```
┌─────────────────────────────────────┐
│  🏠 Leo Pro                    [×]  │
├─────────────────────────────────────┤
│                                     │
│  Añadir este piso a:                │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [○] Juan Pérez                  ││
│  │     Comprando • Madrid          ││
│  │     ✓ 2/3 análisis gratis       ││
│  ├─────────────────────────────────┤│
│  │ [○] Ana López                   ││
│  │     Alquilando • Barcelona      ││
│  │     ⚠️ Sin análisis gratis     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ☑ Analizar automáticamente      ││
│  │   (recomendado para compras)    ││
│  └─────────────────────────────────┘│
│                                     │
│  [Añadir y analizar]                │
│                                     │
└─────────────────────────────────────┘
```

**Behavior:**
- ✅ Checkbox checked by default
- ✅ Auto-triggers WPA when added
- ✅ Shows analysis progress in extension
- ✅ Counts against free tier (3 analyses)

#### 2. Via "Add Property" Button

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Clientes                                      [📧] [📞] [⚙️]        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📋 SU SHORTLIST (3 pisos)                                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ [📷] Gran Via 42       78%    ⭐ Quiere verlo   [→]      │          │
│  │ [📷] Balmes 156        91%    ✓ Analizado       [→]      │          │
│  │ [📷] Pau Claris        74%    Añadido          [→]      │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  [+ Añadir piso]                [📤 Enviar shortlist al cliente]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ clicks "+ Añadir piso"

┌─────────────────────────────────────────────────────────────────────────┐
│  ← Juan Pérez                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ➕ AÑADIR PROPIEDAD                                  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Pega la URL del anuncio:                                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  https://www.idealista.com/inmueble/12345678/                       ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ☑ Analizar automáticamente                                          ││
│  │   (recomendado para compras)                                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  💡 Análisis gratis restantes: 2/3                                     │
│                                                                         │
│                    [Añadir y analizar →]                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Uses same ingester as `/admin/add-property`:**
- Same URL bar component
- Same ingestion logic
- Works perfectly for Idealista
- For other sites: Uses AWS ingestion rules (learns from our scraping rules)

---

## 📊 Property Analysis Status

### In Client Shortlist

```
┌───────────────────────────────────────────────────────────┐
│ [📷] Gran Via 42       78%    ⭐ Quiere verlo   [→]      │
│ [📷] Balmes 156        91%    ✓ Analizado       [→]      │
│ [📷] Pau Claris        74%    [🔍 Analizar]      [→]      │  ← Button if not analyzed
└───────────────────────────────────────────────────────────┘
```

**"Analizar" button:**
- Only shown if property not yet analyzed
- Triggers WPA pipeline
- Counts against free tier
- Shows progress modal

---

## 💰 Payment & Billing

### Stripe Checkout Integration

**Key Principle**: Use Stripe Checkout for ALL subscription management. Don't manage subscriptions ourselves.

#### Flow

```
User hits paywall
        ↓
┌─────────────────────────────────────┐
│  Create Stripe Checkout Session     │
│  POST /api/stripe/create-checkout  │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│  Redirect to Stripe Checkout        │
│  (hosted by Stripe)                 │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│  Stripe webhook: checkout.completed │
│  → Activate subscription            │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│  Redirect back to app                │
│  /success?session_id=xxx            │
└─────────────────────────────────────┘
```

### Account Settings — Billing Section

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [≡]  Ajustes                                              [←]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 💳 FACTURACIÓN Y SUSCRIPCIÓN                                        ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Plan actual:                                                       ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 🏠 Personal Shopper Pro                                         │││
│  │  │                                                                 │││
│  │  │ ✅ Análisis ilimitados                                          │││
│  │  │ ✅ Extension ilimitada                                          │││
│  │  │ ✅ Recomendaciones para clientes                                 │││
│  │  │                                                                 │││
│  │  │ €49/mes • Renovación: 15 Dic 2024                               │││
│  │  │                                                                 │││
│  │  │ [Gestionar suscripción en Stripe →]                             │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Método de pago:                                                    ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 💳 •••• 4242                                                    │││
│  │  │     Expira: 12/25                                               │││
│  │  │                                                                 │││
│  │  │ [Actualizar método de pago →]                                   │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Historial de facturas:                                             ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 15 Nov 2024    €49.00    [Descargar PDF]                       │││
│  │  │ 15 Oct 2024    €49.00    [Descargar PDF]                       │││
│  │  │ 15 Sep 2024    €49.00    [Descargar PDF]                       │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key actions:**
- "Gestionar suscripción" → Opens Stripe Customer Portal
- "Actualizar método de pago" → Stripe Checkout for payment method update
- "Descargar PDF" → Stripe invoice PDF

---

## 🚧 Paywall States

### B2C Paywall (After Free Week)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📋 MIS PISOS                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🔒 Tu semana gratis ha terminado                                    ││
│  │                                                                     ││
│  │  Para seguir recibiendo recomendaciones personalizadas,             ││
│  │  suscríbete ahora.                                                  ││
│  │                                                                     ││
│  │  ┌───────────────────────────────────────────────────────────────┐ ││
│  │  │ 🏠 Plan Básico                                                 │ ││
│  │  │                                                                │ ││
│  │  │ ✅ Recomendaciones ilimitadas                                  │ ││
│  │  │ ✅ Alertas por WhatsApp/Email                                  │ ││
│  │  │ ✅ Análisis de propiedades                                     │ ││
│  │  │                                                                │ ││
│  │  │ €9.99/mes                                                      │ ││
│  │  │                                                                │ ││
│  │  │ [Suscribirse →]                                                │ ││
│  │  └───────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pro Paywall (After 3 Free Analyses)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  👤 JUAN PÉREZ                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📋 SU SHORTLIST                                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷] Gran Via 42       78%    ⭐ Quiere verlo   [→]              ││
│  │ [📷] Balmes 156        91%    ✓ Analizado       [→]              ││
│  │ [📷] Pau Claris        74%    ✓ Analizado       [→]              ││
│  │ [📷] Carrer Muntaner   82%    ✓ Analizado       [→]              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🔒 Has usado tus 3 análisis gratis                                 ││
│  │                                                                     ││
│  │  Para seguir analizando propiedades para tus clientes,              ││
│  │  suscríbete al plan Pro.                                            ││
│  │                                                                     ││
│  │  ┌───────────────────────────────────────────────────────────────┐ ││
│  │  │ 👔 Personal Shopper Pro                                       │ ││
│  │  │                                                                │ ││
│  │  │ ✅ Análisis ilimitados                                        │ ││
│  │  │ ✅ Extension ilimitada                                        │ ││
│  │  │ ✅ Recomendaciones para clientes                               │ ││
│  │  │                                                                │ ││
│  │  │ €49/mes                                                        │ ││
│  │  │                                                                │ ││
│  │  │ [Suscribirse →]                                                │ ││
│  │  └───────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Database Schema

```sql
-- Subscription tracking
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  
  -- Stripe data
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- Status
  status TEXT NOT NULL, -- 'trialing', 'active', 'past_due', 'canceled', 'incomplete'
  current_period_end TIMESTAMPTZ,
  
  -- Trial tracking
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Usage tracking (for pro users)
  analyses_used INTEGER DEFAULT 0,
  analyses_limit INTEGER, -- NULL = unlimited
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking for B2C
CREATE TABLE recommendation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Trial tracking
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Usage
  recommendations_sent INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking for Pro (analyses)
CREATE TABLE analysis_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  listing_id BIGINT REFERENCES listings(id),
  analysis_type TEXT, -- 'wpa', 'full'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/stripe/create-checkout` | Create Stripe Checkout session |
| `POST /api/stripe/webhook` | Handle Stripe webhooks |
| `GET /api/stripe/customer-portal` | Get Stripe Customer Portal URL |
| `GET /api/subscription/status` | Get user's subscription status |
| `GET /api/subscription/usage` | Get usage (analyses/recommendations) |

### Stripe Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription |
| `customer.subscription.created` | Update subscription record |
| `customer.subscription.updated` | Update subscription status |
| `customer.subscription.deleted` | Cancel subscription |
| `invoice.payment_succeeded` | Record payment |
| `invoice.payment_failed` | Mark as past_due |

---

## 📝 Ingester Notes

### Current State

- **Works perfectly for Idealista** ✅
- **URL bar component** exists in `/admin/add-property`
- **Ingestion rules** exist for pages that brand the URL bar
- **AWS ingestion rules** can be transferred over

### Implementation Plan

1. **Reuse existing `ListingEditor` component** from `/add-property` ✅
   - Already has URL bar with brand detection (chameleon UI)
   - Already has ingestion logic for Idealista
   - Already works perfectly for Idealista
2. **Add "auto-analyze" checkbox** to existing component
3. **Connect to AWS ingestion rules** for non-Idealista sites (learns from scraping rules)
4. **Auto-trigger WPA** when property added (if checkbox checked)
5. **Track usage** against subscription (3 free analyses for pros)

---

## Changelog

| Date | Change |
|------|--------|
| Dec 1, 2024 | Initial subscription model spec |
| Dec 1, 2024 | B2C: 7-day free trial |
| Dec 1, 2024 | Pro: 3 free analyses |
| Dec 1, 2024 | Extension requires login |
| Dec 1, 2024 | Auto-analysis via extension |
| Dec 1, 2024 | "Analyse property" button for pros |
| Dec 1, 2024 | Stripe Checkout for all payments |
| Dec 1, 2024 | Stripe Customer Portal for management |

