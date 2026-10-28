/**
 * Daily Recommendations Cron Job
 * 
 * Runs 3x daily to generate fresh recommendations for all active users.
 * 
 * Schedule: 8am, 12pm, 6pm Madrid time
 * vercel.json: "crons": [{ "path": "/api/cron/daily-recommendations", "schedule": "0 6,10,16 * * *" }]
 * 
 * Flow:
 * 1. Get all active users with profiles
 * 2. For each user:
 *    - Run pre-WPA filtering (FREE)
 *    - If new properties found, run WPA on top 3
 *    - Generate personalized explanations
 *    - Store recommendations
 *    - Queue notification if preferences set
 * 
 * Cost control:
 * - Max 3 WPA per user per run
 * - Skip users with no activity in 7 days
 * - Use cached WPA when available
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runRecommenderV2 } from '@/lib/recommender/orchestratorV2';
import { LifeProfile } from '@/types/recommender';

// ============================================================================
// Config
// ============================================================================

const MAX_WPA_PER_USER = 3;
const INACTIVE_THRESHOLD_DAYS = 7;
const MAX_USERS_PER_RUN = 50;

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================================
// Get Active Users
// ============================================================================

interface ActiveUser {
  user_id: string;
  life_profile: LifeProfile;
  last_activity: string;
  notification_preferences: {
    email: boolean;
    push: boolean;
  } | null;
}

async function getActiveUsers(): Promise<ActiveUser[]> {
  const supabase = getSupabase();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_THRESHOLD_DAYS);
  
  const { data, error } = await supabase
    .from('user_lifestyle_profiles')
    .select(`
      user_id,
      life_profile,
      updated_at
    `)
    .not('life_profile', 'is', null)
    .gte('updated_at', cutoffDate.toISOString())
    .limit(MAX_USERS_PER_RUN);
  
  if (error) {
    console.error('[DailyRecs] Error fetching users:', error);
    return [];
  }
  
  // Get notification preferences
  const userIds = data?.map(u => u.user_id) || [];
  
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('user_id, notification_email, notification_push')
    .in('user_id', userIds);
  
  const prefsMap = new Map(
    prefs?.map(p => [p.user_id, {
      email: p.notification_email ?? true,
      push: p.notification_push ?? false,
    }]) || []
  );
  
  return (data || []).map(u => ({
    user_id: u.user_id,
    life_profile: u.life_profile as LifeProfile,
    last_activity: u.updated_at,
    notification_preferences: prefsMap.get(u.user_id) || null,
  }));
}

// ============================================================================
// Store Recommendations
// ============================================================================

async function storeRecommendations(
  userId: string,
  recommendations: any[],
  runId: string
): Promise<void> {
  const supabase = getSupabase();
  
  const records = recommendations.map((rec, i) => ({
    user_id: userId,
    run_id: runId,
    listing_id: rec.listing.listing_id,
    rank: i + 1,
    fit_score: rec.fitResult.score,
    top_matches: rec.fitResult.topMatches,
    concerns: rec.fitResult.concerns,
    explanation: rec.explanation || null,
    created_at: new Date().toISOString(),
  }));
  
  const { error } = await supabase
    .from('daily_recommendations')
    .insert(records);
  
  if (error) {
    console.error(`[DailyRecs] Error storing for ${userId}:`, error);
  }
}

// ============================================================================
// Queue Notification
// ============================================================================

async function queueNotification(
  userId: string,
  recommendations: any[],
  prefs: { email: boolean; push: boolean } | null
): Promise<void> {
  if (!prefs || (!prefs.email && !prefs.push)) {
    return;
  }
  
  const supabase = getSupabase();
  
  // Get top recommendation summary
  const top = recommendations[0];
  const summary = top ? {
    title: `${top.listing.bedrooms} hab en ${top.listing.region || top.listing.city}`,
    price: top.listing.price,
    fitScore: top.fitResult.score,
    image: top.listing.image_urls?.[0] || null,
  } : null;
  
  if (!summary) return;
  
  // Queue for email
  if (prefs.email) {
    await supabase.from('notification_queue').insert({
      user_id: userId,
      type: 'daily_recommendation',
      channel: 'email',
      payload: {
        newCount: recommendations.length,
        top: summary,
        viewUrl: `https://leo.casa/recommendations`,
      },
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }
  
  // Queue for push
  if (prefs.push) {
    await supabase.from('notification_queue').insert({
      user_id: userId,
      type: 'daily_recommendation',
      channel: 'push',
      payload: {
        title: `${recommendations.length} nuevos pisos para ti`,
        body: `${summary.title} - ${summary.price.toLocaleString()}€`,
        url: `/recommendations`,
      },
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const runId = `daily_${Date.now()}`;
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    console.log(`[DailyRecs] Starting run ${runId}`);
    
    // Get active users
    const users = await getActiveUsers();
    console.log(`[DailyRecs] Found ${users.length} active users`);
    
    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        runId,
        usersProcessed: 0,
        totalRecommendations: 0,
        duration: Date.now() - startTime,
      });
    }
    
    let totalRecommendations = 0;
    let usersWithNewRecs = 0;
    const errors: string[] = [];
    
    // Process each user
    for (const user of users) {
      try {
        console.log(`[DailyRecs] Processing user ${user.user_id}`);
        
        // Run recommender with limited WPA
        const result = await runRecommenderV2(user.life_profile, {
          maxResults: 10,
          maxWPA: MAX_WPA_PER_USER,
          preFilterThreshold: 50,
          skipExplanations: false,
        });
        
        if (result.success && result.recommendations.length > 0) {
          // Store recommendations
          await storeRecommendations(user.user_id, result.recommendations, runId);
          
          // Queue notification
          await queueNotification(user.user_id, result.recommendations, user.notification_preferences);
          
          totalRecommendations += result.recommendations.length;
          usersWithNewRecs++;
          
          console.log(`[DailyRecs] User ${user.user_id}: ${result.recommendations.length} recommendations`);
        }
      } catch (userError: any) {
        console.error(`[DailyRecs] Error for ${user.user_id}:`, userError);
        errors.push(`${user.user_id}: ${userError.message}`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`[DailyRecs] Complete in ${duration}ms`);
    console.log(`[DailyRecs] ${usersWithNewRecs}/${users.length} users got new recommendations`);
    console.log(`[DailyRecs] Total recommendations: ${totalRecommendations}`);
    
    return NextResponse.json({
      success: true,
      runId,
      usersProcessed: users.length,
      usersWithNewRecs,
      totalRecommendations,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error: any) {
    console.error('[DailyRecs] Fatal error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        runId,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

