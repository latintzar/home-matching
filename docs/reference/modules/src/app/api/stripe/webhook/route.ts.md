# src/app/api/stripe/webhook/route.ts

[Source](../../../../../../../../src/app/api/stripe/webhook/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getStripe` | function | [L6](../../../../../../../../src/app/api/stripe/webhook/route.ts#L6) |  |
| `POST` | function | [L15](../../../../../../../../src/app/api/stripe/webhook/route.ts#L15) | request |
| `handleSubscriptionCheckout` | function | [L88](../../../../../../../../src/app/api/stripe/webhook/route.ts#L88) | session |
| `handleSubscriptionUpdate` | function | [L125](../../../../../../../../src/app/api/stripe/webhook/route.ts#L125) | subscription |
| `handleSubscriptionDeleted` | function | [L167](../../../../../../../../src/app/api/stripe/webhook/route.ts#L167) | subscription |
| `handlePaymentFailed` | function | [L196](../../../../../../../../src/app/api/stripe/webhook/route.ts#L196) | invoice |
| `handleSuccessfulPayment` | function | [L225](../../../../../../../../src/app/api/stripe/webhook/route.ts#L225) | session |

Imports: `next/server`, `stripe`, `@/utils/supabase/server`
