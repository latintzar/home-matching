/**
 * Test Login API Route
 * 
 * Creates/manages test users and generates sessions (development only).
 * Requires NEXT_PUBLIC_ENABLE_TEST_AUTH=true and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Test user configurations
const TEST_USERS: Record<string, { email: string; password: string; userType: string }> = {
  renter: {
    email: 'operator@example.invalid',
    password: 'TestRenter2025!',
    userType: 'renter',
  },
  buyer: {
    email: 'operator@example.invalid',
    password: 'TestBuyer2025!',
    userType: 'buyer',
  },
  pro: {
    email: 'operator@example.invalid',
    password: 'TestPro2025!',
    userType: 'pro',
  },
};

export async function POST(request: NextRequest) {
  // Check if test auth is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH !== 'true') {
    return NextResponse.json(
      { error: 'Test auth is not enabled' },
      { status: 403 }
    );
  }

  // Check for service role key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
    return NextResponse.json(
      { error: 'Server not configured for test auth. Add SUPABASE_SERVICE_ROLE_KEY to .env.local' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { persona, resetOnboarding } = body as {
      persona: 'renter' | 'buyer' | 'pro';
      resetOnboarding?: boolean;
    };

    if (!persona || !TEST_USERS[persona]) {
      return NextResponse.json(
        { error: 'Invalid persona. Use: renter, buyer, or pro' },
        { status: 400 }
      );
    }

    const testUser = TEST_USERS[persona];

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create regular client for login
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if test user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let existingUser = existingUsers?.users?.find(u => u.email === testUser.email);

    if (!existingUser) {
      // Create the test user with password
      console.log(`Creating test user: ${testUser.email}`);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: {
          is_test_user: true,
          user_type: testUser.userType,
        },
      });

      if (createError) {
        console.error('Error creating test user:', createError);
        return NextResponse.json(
          { error: `Failed to create test user: ${createError.message}` },
          { status: 500 }
        );
      }

      existingUser = newUser.user;
      console.log(`Created test user: ${existingUser?.id}`);
    }

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Failed to find or create test user' },
        { status: 500 }
      );
    }

    const userId = existingUser.id;

    // If reset onboarding is requested, clear the profile
    if (resetOnboarding) {
      console.log(`Resetting onboarding for user: ${userId}`);
      await supabaseAdmin
        .from('user_lifestyle_profiles')
        .delete()
        .eq('user_id', userId);
    } else {
      // Ensure user has a profile (for smooth testing)
      await ensureUserProfile(supabaseAdmin, userId, testUser.userType);
    }

    // Sign in as the test user to get a session
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (signInError || !signInData.session) {
      console.error('Error signing in test user:', signInError);
      
      // If password is wrong, update it
      if (signInError?.message?.includes('Invalid login credentials')) {
        console.log('Updating test user password...');
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: testUser.password,
        });

        // Try again
        const { data: retryData, error: retryError } = await supabaseClient.auth.signInWithPassword({
          email: testUser.email,
          password: testUser.password,
        });

        if (retryError || !retryData.session) {
          return NextResponse.json(
            { error: `Failed to sign in test user: ${retryError?.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          userId,
          email: testUser.email,
          userType: testUser.userType,
          session: {
            access_token: retryData.session.access_token,
            refresh_token: retryData.session.refresh_token,
          },
        });
      }

      return NextResponse.json(
        { error: `Failed to sign in test user: ${signInError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      email: testUser.email,
      userType: testUser.userType,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });

  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Ensure user has a profile (creates one if missing)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUserProfile(
  supabase: any,
  userId: string,
  userType: string
) {
  // Check if profile exists
  const { data: existing } = await supabase
    .from('user_lifestyle_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    return; // Profile already exists
  }

  // Create profile based on user type
  const baseProfile = {
    user_id: userId,
    intake_completed: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const profileData = userType === 'pro' 
    ? {
        ...baseProfile,
        // Pro-specific data could go here
      }
    : {
        ...baseProfile,
        // Sample renter/buyer preferences for testing
      };

  const { error } = await supabase
    .from('user_lifestyle_profiles')
    .insert(profileData);

  if (error && !error.message.includes('duplicate')) {
    console.error('Error creating user profile:', error);
  }
}
