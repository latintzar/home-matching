/**
 * Early Access / Waiting List API
 * 
 * POST - Collect email for waiting list (homepage form)
 * 
 * Creates minimal profile in user_lifestyle_profiles for later conversion.
 * Triggers welcome email via Resend (TBC).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

interface EarlyAccessRequest {
  email: string;
  language?: 'es' | 'en';
  userType?: 'renter' | 'buyer' | 'professional' | 'undecided';
  source?: 'homepage' | 'product_hunt' | 'referral' | 'other';
}

export async function POST(request: NextRequest) {
    const supabase = getSupabaseServiceClient();
  try {
    const body: EarlyAccessRequest = await request.json();
    const { email, language = 'es', userType = 'undecided', source = 'homepage' } = body;
    
    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseServiceClient();
    
    // Check if email already exists
    const { data: existing } = await supabase
      .from('user_lifestyle_profiles')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single();
    
    if (existing) {
      console.log('[Early Access] Email already registered:', email);
      return NextResponse.json({
        success: true,
        message: 'already_registered',
        profileId: existing.id,
      });
    }
    
    // Create minimal profile for early access user
    const sessionId = `early_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    
    const { data: profile, error } = await supabase
      .from('user_lifestyle_profiles')
      .insert({
        session_id: sessionId,
        email: email.toLowerCase().trim(),
        language,
        delivery_preference: 'email',
        // Store early access metadata in lifestyle_dna JSONB
        lifestyle_dna: {
          earlyAccess: true,
          signupSource: source,
          userType,
          signupDate: new Date().toISOString(),
        },
        // Mark as not meeting minimum for recommendations yet
        minimum_met: false,
        completeness_score: 5, // Just email = 5%
        missing_fields: ['budget', 'location', 'household'],
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Early Access] Error creating profile:', error);
      throw error;
    }
    
    console.log('[Early Access] New signup:', { email, language, userType, source, profileId: profile.id });
    
    // TODO: Send welcome email via Resend
    // await sendWelcomeEmail(email, language);
    
    return NextResponse.json({
      success: true,
      message: 'registered',
      profileId: profile.id,
    });
    
  } catch (error: any) {
    console.error('[Early Access] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check if email is already registered
 */
export async function GET(request: NextRequest) {
    
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter required' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseServiceClient();
    
    const { data: existing } = await supabase
      .from('user_lifestyle_profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();
    
    return NextResponse.json({
      success: true,
      registered: !!existing,
    });
    
  } catch (error: any) {
    console.error('[Early Access] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check' },
      { status: 500 }
    );
  }
}

