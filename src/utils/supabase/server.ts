import type {SupabaseClient} from '@supabase/supabase-js';
import {sampleMode,sampleServerClient} from '@/lib/sample/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/** Privileged client, used after operator authentication or a verified Stripe signature. */
export function createServiceClient(): SupabaseClient<any> {
  if(sampleMode())return sampleServerClient() as SupabaseClient<any>;
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
