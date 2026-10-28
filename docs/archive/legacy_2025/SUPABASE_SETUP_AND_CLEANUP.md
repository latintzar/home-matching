# Supabase Setup & Security Cleanup Documentation

**Last Updated**: 2025-11-20
**Status**: Cleaned & Secure

## 🔒 Security & Configuration

This repository uses **Supabase** for database, storage, and authentication (future). To ensure security and best practices, all hardcoded credentials have been removed from the codebase and replaced with environment variables.

### Required Environment Variables

The following variables must be set in your `.env.local` file:

| Variable Name | Purpose | Scope |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | Client & Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous API Key (Safe for browser) | Client-side RLS |
| `SUPABASE_SERVICE_KEY` | **Service Role Key** (Admin privileges) | **Server-side ONLY** |

> **⚠️ CRITICAL SECURITY WARNING:**
> Never expose `SUPABASE_SERVICE_KEY` to the client side. It bypasses Row Level Security (RLS) and has full admin access to your database.

### Usage Patterns

#### 1. Client-Side (Browser)
Use the helper in `src/lib/supabase.ts`:
```typescript
import { supabase } from '@/lib/supabase';
// Uses NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### 2. Server-Side (API Routes)
When you need admin privileges (e.g., scraping, analysis pipelines), create a service client:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
```

### Cleanup Actions (2025-11-20)

We performed a repository-wide audit and cleanup of hardcoded credentials:

- **Scanned** codebase for potential key leaks (`eyJ...`, specific URLs).
- **Fixed** hardcoded keys in the following critical pipeline files:
  - `src/app/api/listings/[id]/text-analysis/b2-merge/route.ts`
  - `src/app/api/listings/[id]/text-analysis/b3-snippets/route.ts`
  - `src/app/api/listings/[id]/text-analysis/c-unknowns/route.ts`
  - `src/app/api/listings/[id]/whatsapp-message/route.ts`
- **Verified** that all `createClient` calls in API routes use `process.env`.

### Future Auth Setup 🛡️

The user has indicated that **Auth setup** is upcoming.
When ready to implement Auth:
1.  Enable Auth providers in Supabase Dashboard.
2.  Update `middleware.ts` to handle session management.
3.  Ensure RLS policies in the database are linked to `auth.uid()`.

*Note: The current pipeline mostly uses the Service Role key because it runs as a background/admin process. User-facing features (like saving favorites or user specific projects) will rely on the Auth setup.*

