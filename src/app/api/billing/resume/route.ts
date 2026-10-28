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
 * POST /api/billing/resume
 * Resume a paused subscription
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
      .select("stripe_subscription_id, subscription_status")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No subscription to resume" },
        { status: 400 }
      );
    }

    // Resume subscription (remove cancel at period end)
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: false }
    );

    // Update local status
    await supabase
      .from("user_lifestyle_profiles")
      .update({
        subscription_status: "active",
        subscription_paused_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: "Subscription resumed successfully",
      status: subscription.status,
    });

  } catch (error) {
    console.error("Resume subscription error:", error);
    return NextResponse.json({ error: "Failed to resume subscription" }, { status: 500 });
  }
}

