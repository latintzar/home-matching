/**
 * Supabase Wrapper
 * 
 * Drop-in replacement for direct Supabase client imports.
 * Use this instead of creating a new client in each file.
 * 
 * This allows us to intercept calls and route to DynamoDB when needed.
 * 
 * Usage (replace existing pattern):
 * 
 * OLD:
 *   import { createClient } from '@supabase/supabase-js';
 *   const supabase = createClient(URL, KEY);
 * 
 * NEW:
 *   import { getSupabase } from '@/lib/data-adapter/supabase-wrapper';
 *   const supabase = getSupabase();
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client (singleton)
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

/**
 * Create a Supabase client (for backward compatibility)
 * This just returns the singleton - same behavior as before but more efficient
 */
export function createSupabaseClient(): SupabaseClient {
  return getSupabase();
}

// Re-export for convenience
export { SupabaseClient };

