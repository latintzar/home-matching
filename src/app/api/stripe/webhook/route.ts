import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

// Only initialize Stripe if the key is available
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      // One-time payment events (DeepDive)
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleSubscriptionCheckout(session);
        } else {
        await handleSuccessfulPayment(session);
        }
        break;
      
      case 'checkout.session.expired':
        console.log('Checkout session expired:', event.data.object.id);
        break;
      
      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(deletedSub);
        break;
        
      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice paid: ${invoice.id} for customer ${invoice.customer}`);
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(failedInvoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Handle subscription checkout completed
async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.user_id;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId) {
      console.error('No user ID in subscription checkout metadata');
      return;
    }

    const supabase = createClient();

    // Update user profile with subscription info
    const { error } = await supabase
      .from('user_lifestyle_profiles')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update profile after subscription:', error);
      return;
    }

    console.log(`Subscription ${subscriptionId} activated for user ${userId}`);

  } catch (error) {
    console.error('Error handling subscription checkout:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    const supabase = createClient();

    // Find user by customer ID
    const { data: profile } = await supabase
      .from('user_lifestyle_profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) {
      console.error('No user found for customer:', customerId);
      return;
    }

    // Map Stripe status to our status
    let status = subscription.status;
    if (subscription.cancel_at_period_end) {
      status = 'paused';
    }

    // Update profile
    await supabase
      .from('user_lifestyle_profiles')
      .update({
        subscription_status: status,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price.id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', profile.user_id);

    console.log(`Subscription ${subscription.id} updated to ${status}`);

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    const supabase = createClient();

    const { data: profile } = await supabase
      .from('user_lifestyle_profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) return;

    await supabase
      .from('user_lifestyle_profiles')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', profile.user_id);

    console.log(`Subscription deleted for customer ${customerId}`);

  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;
    const supabase = createClient();

    const { data: profile } = await supabase
      .from('user_lifestyle_profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) return;

    await supabase
      .from('user_lifestyle_profiles')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', profile.user_id);

    console.log(`Payment failed for customer ${customerId}`);

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Handle one-time payment (DeepDive)
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  try {
    const listingId = session.metadata?.listingId;
    const paymentIntentId = session.payment_intent as string;

    if (!listingId) {
      console.error('No listing ID in session metadata');
      return;
    }

    const supabase = createClient();

    // Update DeepDive to mark as unlocked
    const { error } = await supabase
      .from('deepdives')
      .update({
        stripe_payment_id: paymentIntentId,
        paywall_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(listingId));

    if (error) {
      console.error('Failed to update DeepDive after payment:', error);
      return;
    }

    console.log(`DeepDive ${listingId} unlocked after successful payment`);

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}
