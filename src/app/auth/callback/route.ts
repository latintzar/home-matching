/**
 * Auth Callback Handler
 * 
 * Handles the redirect from Supabase after magic link click
 * Exchanges the code for a session and redirects to the appropriate page
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/profile';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle auth errors from Supabase
  if (error) {
    console.error('Auth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/auth/signin?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    );
  }

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore cookie errors in server context
            }
          },
        },
      }
    );

    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(
        new URL(`/auth/signin?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      );
    }

    // Check if this is a new user (for analytics)
    const isNewUser = data.user?.created_at && 
      (new Date().getTime() - new Date(data.user.created_at).getTime()) < 60000; // Created within last minute

    // Create free subscription for new users
    if (isNewUser && data.user) {
      try {
        const { error: subError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: data.user.id,
            plan_id: 'free',
            status: 'active',
          });
        
        if (subError && !subError.message.includes('duplicate')) {
          console.error('Error creating subscription:', subError);
        }
      } catch (e) {
        console.error('Error creating subscription:', e);
      }
    }

    // Determine where to redirect new vs returning users
    let finalRedirect = redirectTo;
    
    if (isNewUser) {
      // New users go to intake first
      finalRedirect = '/recommend/intake';
    }

    return NextResponse.redirect(new URL(finalRedirect, requestUrl.origin));
  }

  // No code present - redirect to signin
  return NextResponse.redirect(new URL('/auth/signin', requestUrl.origin));
}

