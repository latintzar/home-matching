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
 * GET /api/billing/invoices
 * Get invoice history for the user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServer();

    // Get user's Stripe customer ID
    const { data: profile } = await supabase
      .from("user_lifestyle_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        success: true,
        invoices: [],
        message: "No billing history",
      });
    }

    // Get invoices from Stripe
    try {
      const stripe = getStripe();
      const invoices = await stripe.invoices.list({
        customer: profile.stripe_customer_id,
        limit: 24,
      });

      const formattedInvoices = invoices.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        date: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      }));

      return NextResponse.json({
        success: true,
        invoices: formattedInvoices,
      });

    } catch (stripeError) {
      console.error("Stripe invoices error:", stripeError);
      return NextResponse.json({
        success: true,
        invoices: [],
        message: "Unable to fetch invoices",
      });
    }

  } catch (error) {
    console.error("Invoices GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

