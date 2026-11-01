// src/lib/auth-helpers.ts
// Server identity and subscription helpers.

import { getSupabaseServer } from './supabase-server';
import { User } from '@supabase/supabase-js';

// Extended user with Leo-specific fields
export interface LeoUser extends User {
  is_pro?: boolean;
  subscription_plan?: 'free' | 'personal' | 'pro_solo' | 'pro_team' | 'enterprise';
}

// Authenticate the user with the recipient’s Supabase project.
export async function getCurrentUser(request?: Request): Promise<LeoUser | null> {

  try {
    const supabase = await getSupabaseServer(request);
    const authorization = request?.headers.get('authorization');
    const match = authorization ? /^Bearer (\S+)$/i.exec(authorization) : null;
    if (authorization && !match) return null;
    const { data: { user }, error } = await supabase.auth.getUser(match?.[1]);
    
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

// Retained UI compatibility: server actions always use provider-verified identity.
export function isDevBypassActive(): boolean {
  return false;
}

