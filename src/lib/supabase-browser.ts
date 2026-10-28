/**
 * Supabase Browser Client
 * 
 * Client-side Supabase client with auth support
 * Use this in React components for auth operations
 */

import { createBrowserClient } from '@supabase/ssr';

// Singleton browser client
let _browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Get the Supabase browser client (for client components)
 * Supports auth session management
 */
export function getSupabaseBrowser() {
  if (!_browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }
  return _browserClient;
}

/**
 * Get current user (client-side)
 */
export async function getCurrentUser() {
  const supabase = getSupabaseBrowser();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

/**
 * Get current session (client-side)
 */
export async function getCurrentSession() {
  const supabase = getSupabaseBrowser();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

/**
 * Sign in with magic link
 */
export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(redirectTo?: string) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo || '/dashboard')}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { data, error };
}

/**
 * Sign in with Apple OAuth
 */
export async function signInWithApple(redirectTo?: string) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo || '/dashboard')}`,
    },
  });
  return { data, error };
}

/**
 * Sign in as test user (development only)
 * This uses a server-side API to create a session for test users
 */
export async function signInAsTestUser(
  persona: 'renter' | 'buyer' | 'pro',
  resetOnboarding: boolean = false
) {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    return { error: new Error('Test auth is not enabled') };
  }

  try {
    const response = await fetch('/api/auth/test-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ persona, resetOnboarding }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: new Error(errorData.error || 'Test login failed') };
    }

    const data = await response.json();
    
    // Set the session in the browser client
    if (data.session) {
      const supabase = getSupabaseBrowser();
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    return { data, error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Test login failed') };
  }
}

/**
 * Sign out
 */
export async function signOut() {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('user_lifestyle_profiles')
    .select('intake_completed')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.intake_completed === true;
}

/**
 * Get user's lifestyle profile
 */
export async function getUserProfile(userId: string) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('user_lifestyle_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error getting user profile:', error);
    return null;
  }

  return data;
}
