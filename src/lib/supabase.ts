import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cached client instance (lazy singleton)
let _supabaseClient: SupabaseClient | null = null;
let _supabaseServiceClient: SupabaseClient | null = null;

/**
 * Get the Supabase client (anon key)
 * Lazily initialized to avoid build-time errors on Vercel
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
}

    _supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return _supabaseClient;
}

/**
 * Get the Supabase service role client (service key)
 * For server-side operations that need to bypass RLS
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!_supabaseServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase service environment variables');
    }

    _supabaseServiceClient = createClient(supabaseUrl, supabaseKey);
  }
  return _supabaseServiceClient;
}

/**
 * @deprecated Use getSupabaseClient() instead
 * Legacy export for backwards compatibility - will be evaluated lazily
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return Reflect.get(getSupabaseClient(), prop);
  }
});
