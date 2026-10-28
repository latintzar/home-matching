// src/lib/auth-helpers.ts
// Authentication helpers with dev bypass for page review

import { getSupabaseServer } from './supabase-server';
import { User } from '@supabase/supabase-js';

// Dev bypass configuration
// Set NEXT_PUBLIC_DEV_BYPASS=true in .env.local to enable auth bypass
const DEV_BYPASS_ENABLED = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true';

// Mock user for dev bypass
const MOCK_DEV_USER: User = {
  id: 'dev-user-mock-00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'operator@example.invalid',
  email_confirmed_at: new Date().toISOString(),
  phone: '+12025550123',
  confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { 
    full_name: 'Dev User',
    is_pro: true, // Allow Pro features in dev mode
    avatar_url: null 
  },
  identities: [],
};

// Extended user with Leo-specific fields
export interface LeoUser extends User {
  is_pro?: boolean;
  subscription_plan?: 'free' | 'personal' | 'pro_solo' | 'pro_team' | 'enterprise';
}

// Get current user (with dev bypass support)
export async function getCurrentUser(): Promise<LeoUser | null> {
  // In dev mode with bypass enabled, return mock user
  if (DEV_BYPASS_ENABLED && process.env.NODE_ENV === 'development') {
    console.log('🔓 Auth bypass enabled - using mock dev user');
    return {
      ...MOCK_DEV_USER,
      is_pro: true,
      subscription_plan: 'pro_solo',
    };
  }

  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    // Fetch subscription plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    return {
      ...user,
      is_pro: subscription?.plan_id?.startsWith('pro_') || subscription?.plan_id === 'enterprise',
      subscription_plan: subscription?.plan_id || 'free',
    } as LeoUser;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Check if user has Pro access
export async function hasProAccess(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.is_pro ?? false;
}

// Get auth redirect path
export function getAuthRedirect(currentPath: string): string {
  return `/auth/signin?redirectTo=${encodeURIComponent(currentPath)}`;
}

// Check dev mode status (for UI badges)
export function isDevBypassActive(): boolean {
  return DEV_BYPASS_ENABLED && process.env.NODE_ENV === 'development';
}

