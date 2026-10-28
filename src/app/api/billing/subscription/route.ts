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
 * GET /api/billing/subscription
 * Get current subscription status for the user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServer();

    // Get user's profile with billing info
    const { data: profile } = await supabase
      .from("user_lifestyle_profiles")
      .select("stripe_customer_id, subscription_status, stripe_subscription_id, stripe_price_id, subscription_paused_at")
      .eq("user_id", user.id)
      .single();

    if (!profile || !profile.stripe_subscription_id) {
      return NextResponse.json({
        success: true,
        subscription: null,
        status: "none",
        message: "No active subscription",
      });
    }

    // Get subscription details from Stripe
    try {
      const stripe = getStripe();
      const subscriptionRaw = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      // Type assertion for Stripe subscription fields
      const subscription = subscriptionRaw as unknown as {
        id: string;
        status: string;
        current_period_start: number;
        current_period_end: number;
        cancel_at_period_end: boolean;
        items: { data: Array<{ price: { id: string; unit_amount?: number; currency?: string; recurring?: { interval: string } } }> };
      };

      return NextResponse.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          priceId: subscription.items.data[0]?.price.id,
          planName: getPlanName(subscription.items.data[0]?.price.id),
          amount: subscription.items.data[0]?.price.unit_amount || 0,
          currency: subscription.items.data[0]?.price.currency || "eur",
          interval: subscription.items.data[0]?.price.recurring?.interval || "month",
        },
        status: profile.subscription_status || subscription.status,
        pausedAt: profile.subscription_paused_at,
      });
    } catch (stripeError) {
      console.error("Stripe error:", stripeError);
      // Return cached status if Stripe is unavailable
      return NextResponse.json({
        success: true,
        subscription: null,
        status: profile.subscription_status || "unknown",
        message: "Unable to fetch latest subscription details",
      });
    }

  } catch (error) {
    console.error("Subscription GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getPlanName(priceId: string | undefined): string {
  if (!priceId) return "Unknown";
  
  // Map price IDs to plan names (these would be configured in your env)
  const planMap: Record<string, string> = {
    [process.env.STRIPE_RENTER_PRICE_ID || '']: "Leo.casa Renter",
    [process.env.STRIPE_BUYER_PRICE_ID || '']: "Leo.casa Buyer",
  };
  
  return planMap[priceId] || "Leo.casa";
}

