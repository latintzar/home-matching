import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import Stripe from "stripe";

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
  });
};

/**
 * POST /api/billing/pause
 * Pause the user's subscription (cancel at period end)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServer();

    // Get user's subscription ID
    const { data: profile } = await supabase
      .from("user_lifestyle_profiles")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription to pause" },
        { status: 400 }
      );
    }

    // Pause subscription (cancel at period end)
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: true }
    ) as unknown as { cancel_at?: number; current_period_end: number };

    // Update local status
    await supabase
      .from("user_lifestyle_profiles")
      .update({
        subscription_status: "paused",
        subscription_paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: "Subscription will be paused at the end of the current period",
      cancelAt: subscription.cancel_at 
        ? new Date(subscription.cancel_at * 1000).toISOString() 
        : new Date(subscription.current_period_end * 1000).toISOString(),
    });

  } catch (error) {
    console.error("Pause subscription error:", error);
    return NextResponse.json({ error: "Failed to pause subscription" }, { status: 500 });
  }
}

