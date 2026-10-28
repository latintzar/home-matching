# Supabase Setup & Security Guide

**Last Updated:** 2025-11-20
**Status:** Secure (Hardcoded keys removed)

## 🔒 Security Policy
**CRITICAL:** Never commit Supabase Service Role keys or API URL strings to the codebase.

### ✅ Correct Pattern (API Routes)
Always use environment variables for initialization in API routes (server-side):

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Safe for Admin/Backend operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

### ✅ Correct Pattern (Client/Shared Code)
For client-side code or shared libraries, use the singleton export:

```typescript
import { supabase } from '@/lib/supabase';

// Uses NEXT_PUBLIC_SUPABASE_ANON_KEY automatically
```

## 🛠️ Environment Variables
Ensure these are set in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="ey..."
SUPABASE_SERVICE_KEY="ey..."
```

## 🧹 Recent Cleanup (Nov 20, 2025)
We performed a repository-wide audit and removed hardcoded Service Role keys from:
1. `src/app/api/listings/[id]/text-analysis/b2-merge/route.ts`
2. `src/app/api/listings/[id]/text-analysis/b3-snippets/route.ts`
3. `src/app/api/listings/[id]/text-analysis/c-unknowns/route.ts`
4. `src/app/api/listings/[id]/whatsapp-message/route.ts`

The repository is now ready for future Auth integration without leaking administrative credentials.

