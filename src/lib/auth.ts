/**
 * Authentication Utilities
 * 
 * Handles Supabase Auth with role-based access:
 * - renter_buyer: People looking for a place
 * - professional: Real estate agents, agencies
 * 
 * Uses Supabase Auth with custom user metadata.
 */

import { createBrowserClient } from '@supabase/ssr';
import { createClient, User, Session, AuthError } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'renter_buyer' | 'professional';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  phone?: string;
  language: 'es' | 'en';
  deliveryPreference?: 'email' | 'whatsapp';
  createdAt: string;
  updatedAt: string;
}

export interface SignUpData {
  email: string;
  password: string;
  role: UserRole;
  fullName?: string;
  language?: 'es' | 'en';
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

// ============================================================================
// Client Creation
// ============================================================================

/**
 * Create Supabase client for browser (client-side)
 */
export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Create Supabase client for server (API routes)
 */
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================================================
// Auth Functions
// ============================================================================

/**
 * Sign up a new user
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
  const supabase = createSupabaseClient();
  
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        role: data.role,
        full_name: data.fullName,
        language: data.language || 'es',
      },
    },
  });
  
  if (error) {
    console.error('[Auth] Sign up error:', error.message);
    return { success: false, error: error.message };
  }
  
  // Create user profile in database
  if (authData.user) {
    try {
      await supabase.from('user_profiles').insert({
        id: authData.user.id,
        email: data.email,
        role: data.role,
        full_name: data.fullName,
        language: data.language || 'es',
      });
    } catch (profileError) {
      console.error('[Auth] Profile creation error:', profileError);
      // Continue - user is created, profile will be created on next sign in
    }
  }
  
  return {
    success: true,
    user: authData.user || undefined,
    session: authData.session || undefined,
  };
}

/**
 * Sign in an existing user
 */
export async function signIn(data: SignInData): Promise<AuthResult> {
  const supabase = createSupabaseClient();
  
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  
  if (error) {
    console.error('[Auth] Sign in error:', error.message);
    return { success: false, error: error.message };
  }
  
  return {
    success: true,
    user: authData.user,
    session: authData.session,
  };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient();
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('[Auth] Sign out error:', error.message);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  const supabase = createSupabaseClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current user
 */
export async function getUser(): Promise<User | null> {
  const supabase = createSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get user's role from metadata
 */
export function getUserRole(user: User | null): UserRole | null {
  if (!user) return null;
  return (user.user_metadata?.role as UserRole) || null;
}

/**
 * Check if user is a professional
 */
export function isProfessional(user: User | null): boolean {
  return getUserRole(user) === 'professional';
}

/**
 * Check if user is a renter/buyer
 */
export function isRenterBuyer(user: User | null): boolean {
  return getUserRole(user) === 'renter_buyer';
}

// ============================================================================
// Profile Functions
// ============================================================================

/**
 * Get user profile from database
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    fullName: data.full_name,
    phone: data.phone,
    language: data.language || 'es',
    deliveryPreference: data.delivery_preference,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt' | 'updatedAt'>>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient();
  
  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: updates.fullName,
      phone: updates.phone,
      language: updates.language,
      delivery_preference: updates.deliveryPreference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  
  if (error) {
    console.error('[Auth] Profile update error:', error.message);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

// ============================================================================
// Magic Link (Passwordless)
// ============================================================================

/**
 * Send magic link for passwordless sign in
 */
export async function sendMagicLink(
  email: string,
  role?: UserRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient();
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: role ? { role } : undefined,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    console.error('[Auth] Magic link error:', error.message);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

// ============================================================================
// OAuth (Google)
// ============================================================================

/**
 * Sign in with Google
 */
export async function signInWithGoogle(role?: UserRole): Promise<void> {
  const supabase = createSupabaseClient();
  
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: role ? { role } : undefined,
    },
  });
}

// ============================================================================
// Auth State Subscription
// ============================================================================

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const supabase = createSupabaseClient();
  
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

