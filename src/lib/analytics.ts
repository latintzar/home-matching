/**
 * Analytics Client
 * 
 * Client-side analytics tracking for user behavior
 */

import { getSupabaseBrowser } from './supabase-browser';

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('leo_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('leo_session_id', sessionId);
  }
  return sessionId;
}

// Get device type
function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

interface TrackOptions {
  /**
   * Additional properties to include with the event
   */
  properties?: Record<string, unknown>;
  
  /**
   * Override page URL
   */
  pageUrl?: string;
}

/**
 * Track an analytics event
 * 
 * @example
 * track('property_viewed', { listing_id: '123', source: 'alert_email' })
 */
export async function track(eventName: string, options: TrackOptions = {}) {
  try {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('analytics_events').insert({
      user_id: user?.id || null,
      event_name: eventName,
      properties: options.properties || {},
      session_id: getSessionId(),
      page_url: options.pageUrl || (typeof window !== 'undefined' ? window.location.href : null),
      device_type: getDeviceType(),
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.error('Analytics error:', error);
  }
}

/**
 * Track page view
 */
export function trackPageView(pageName: string, properties?: Record<string, unknown>) {
  return track('page_view', {
    properties: {
      page_name: pageName,
      ...properties,
    },
  });
}

/**
 * Identify user (call after login)
 */
export async function identify(userId: string, traits?: Record<string, unknown>) {
  return track('user_identified', {
    properties: {
      user_id: userId,
      traits,
    },
  });
}

// =============================================================================
// NON-PRO FUNNEL EVENTS
// =============================================================================

export const NonProEvents = {
  signupStarted: () => track('signup_started'),
  signupCompleted: () => track('signup_completed'),
  intakeStarted: () => track('intake_started'),
  intakeCompleted: (profileId?: string) => track('intake_completed', { properties: { profile_id: profileId } }),
  whatsappOptedIn: () => track('whatsapp_opted_in'),
  whatsappSkipped: () => track('whatsapp_skipped'),
  alertClicked: (source: 'email' | 'whatsapp' | 'push') => track('alert_clicked', { properties: { source } }),
  propertyViewed: (listingId: string, source?: string) => track('property_viewed', { properties: { listing_id: listingId, source } }),
  contactAgentClicked: (listingId: string) => track('contact_agent_clicked', { properties: { listing_id: listingId } }),
  viewingCreated: (listingId: string) => track('viewing_created', { properties: { listing_id: listingId } }),
  noteAdded: (viewingId: string, category: string) => track('note_added', { properties: { viewing_id: viewingId, category } }),
  viewingCompleted: (viewingId: string) => track('viewing_completed', { properties: { viewing_id: viewingId } }),
};

// =============================================================================
// PRO FUNNEL EVENTS
// =============================================================================

export const ProEvents = {
  proSignupStarted: () => track('pro_signup_started'),
  proSignupCompleted: () => track('pro_signup_completed'),
  clientCreated: (clientId: string) => track('client_created', { properties: { client_id: clientId } }),
  intakeMethodChosen: (method: 'voice' | 'form' | 'client_self_service') => 
    track('intake_method_chosen', { properties: { method } }),
  proIntakeCompleted: (clientId: string) => track('pro_intake_completed', { properties: { client_id: clientId } }),
  clientIntakeCompleted: (clientId: string) => track('client_intake_completed', { properties: { client_id: clientId } }),
  extensionInstalled: () => track('extension_installed'),
  extensionPropertyAdded: (listingId: string, clientId: string) => 
    track('extension_property_added', { properties: { listing_id: listingId, client_id: clientId } }),
  shortlistSent: (clientId: string, method: 'email' | 'whatsapp' | 'link') => 
    track('shortlist_sent', { properties: { client_id: clientId, method } }),
  clientShortlistOpened: (clientId: string) => track('client_shortlist_opened', { properties: { client_id: clientId } }),
  clientNoteAdded: (viewingId: string) => track('client_note_added', { properties: { viewing_id: viewingId } }),
  proNotesViewed: (clientId: string) => track('pro_notes_viewed', { properties: { client_id: clientId } }),
};

// =============================================================================
// PAYMENT FUNNEL EVENTS
// =============================================================================

export const PaymentEvents = {
  pricingPageViewed: () => track('pricing_page_viewed'),
  checkoutStarted: (planId: string) => track('checkout_started', { properties: { plan_id: planId } }),
  checkoutCompleted: (planId: string) => track('checkout_completed', { properties: { plan_id: planId } }),
  subscriptionCanceled: (planId: string) => track('subscription_canceled', { properties: { plan_id: planId } }),
};

