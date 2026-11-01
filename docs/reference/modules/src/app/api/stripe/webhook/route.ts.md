# src/app/api/stripe/webhook/route.ts

[Source](../../../../../../../../src/app/api/stripe/webhook/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getStripe` | function | [L7](../../../../../../../../src/app/api/stripe/webhook/route.ts#L7) |  |
| `POST` | function | [L16](../../../../../../../../src/app/api/stripe/webhook/route.ts#L16) | request |
| `handleSubscriptionCheckout` | function | [L91](../../../../../../../../src/app/api/stripe/webhook/route.ts#L91) | session |
| `handleSubscriptionUpdate` | function | [L128](../../../../../../../../src/app/api/stripe/webhook/route.ts#L128) | subscription |
| `handleSubscriptionDeleted` | function | [L170](../../../../../../../../src/app/api/stripe/webhook/route.ts#L170) | subscription |
| `handlePaymentFailed` | function | [L199](../../../../../../../../src/app/api/stripe/webhook/route.ts#L199) | invoice |
| `handleSuccessfulPayment` | function | [L228](../../../../../../../../src/app/api/stripe/webhook/route.ts#L228) | session |

Imports: `@/lib/security/configured-api`, `next/server`, `stripe`, `@/utils/supabase/server`
