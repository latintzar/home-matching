/** Admission for the retained configured API. SAMPLE_MODE keeps its own isolated boundary. */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { sampleBodyWithinLimit, samplePath } from '@/lib/sample/request.mjs';

// These handlers bind every private record to their verified current user.
// Provider generation, ingestion, administration and unclassified future APIs are operator work.
export const USER_SCOPED_API_PATHS = new Set([
  '/api/agents/context', '/api/agents/update-profile', '/api/analytics',
  '/api/billing/checkout', '/api/billing/invoices', '/api/billing/pause',
  '/api/billing/resume', '/api/billing/subscription', '/api/notes',
  '/api/saved', '/api/user/settings', '/api/viewings',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function denied(status: number, code: string, error: string): NextResponse {
  return NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
function equalSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function apiPath(request: NextRequest): string {
  const base = request.nextUrl.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '';
  return samplePath(request.nextUrl.pathname, base).replace(/\/+$/, '') || '/';
}
function sameOrigin(request: NextRequest): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return /^Bearer \S+$/i.test(request.headers.get('authorization') || '');
  try {
    const expected = new URL(process.env.NEXT_PUBLIC_BASE_URL || request.url).origin;
    return origin === expected;
  } catch { return false; }
}

export async function configuredApiAccess(request: NextRequest): Promise<NextResponse> {
  if (process.env.SAMPLE_MODE === '1') {
    return denied(503, 'RECIPIENT_SERVICE_REQUIRED', 'Use the isolated sample API for this action.');
  }
  const path = apiPath(request);
  if (path === '/api/auth/test-login') {
    return denied(503, 'VERIFIED_AUTH_REQUIRED', 'Sign in through the configured authentication provider.');
  }

  // Only the handler's cryptographic Stripe verifier can authorize a callback.
  if (path === '/api/stripe/webhook') {
    if (request.method !== 'POST' || !process.env.STRIPE_WEBHOOK_SECRET) {
      return denied(503, 'SIGNED_WEBHOOK_REQUIRED', 'Configure the signed Stripe webhook for this action.');
    }
    if (!await sampleBodyWithinLimit(request, 1024 * 1024)) {
      return denied(413, 'BODY_TOO_LARGE', 'Use a webhook body of up to 1 MiB.');
    }
    return NextResponse.next();
  }
  if (path.startsWith('/api/cron/')) {
    const secret = process.env.CRON_SECRET || '';
    if (secret.length < 32) return denied(503, 'CRON_CONFIGURATION_REQUIRED', 'Configure a cron secret of at least 32 characters.');
    if (!equalSecret(request.headers.get('authorization') || '', `Bearer ${secret}`)) {
      return denied(401, 'CRON_AUTH_REQUIRED', 'Authenticate the scheduled job.');
    }
    return NextResponse.next();
  }

  const userScoped = USER_SCOPED_API_PATHS.has(path);
  const operator = (process.env.HOME_MATCHING_OPERATOR_USER_ID || '').trim().toLowerCase();
  if (!userScoped && !UUID.test(operator)) {
    return denied(503, 'OPERATOR_CONFIGURATION_REQUIRED', 'Configure the installation operator for this action.');
  }
  if (MUTATIONS.has(request.method)) {
    if (!sameOrigin(request)) return denied(403, 'APP_ORIGIN_REQUIRED', 'Send this action from the application origin.');
    if (!await sampleBodyWithinLimit(request, userScoped ? 32768 : 10 * 1024 * 1024)) {
      return denied(413, 'BODY_TOO_LARGE', userScoped ? 'Use a request of up to 32 KiB.' : 'Use a request of up to 10 MiB.');
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return denied(503, 'AUTH_CONFIGURATION_REQUIRED', 'Connect the installation’s Supabase authentication.');

  const headers = new Headers(request.headers);
  // An identity supplied by a caller is input, rather than authorization.
  for (const name of ['x-user-id', 'x-user-email', 'x-supabase-user-id', 'x-home-matching-operator']) headers.delete(name);
  let response = NextResponse.next({ request: { headers } });
  const bearer = request.headers.get('authorization');
  try {
    let user;
    if (bearer) {
      const match = /^Bearer (\S+)$/i.exec(bearer);
      if (!match || match[1].length > 16384) return denied(401, 'AUTHENTICATION_REQUIRED', 'Sign in to use this action.');
      const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const verified = await auth.auth.getUser(match[1]);
      if (verified.error) return denied(401, 'AUTHENTICATION_REQUIRED', 'Sign in to use this action.');
      user = verified.data.user;
    } else {
      const auth = createServerClient(url, key, { cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: changes => {
          changes.forEach(({ name, value }) => request.cookies.set(name, value));
          headers.set('cookie', request.headers.get('cookie') || '');
          response = NextResponse.next({ request: { headers } });
          changes.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      } });
      const verified = await auth.auth.getUser();
      if (verified.error) return denied(401, 'AUTHENTICATION_REQUIRED', 'Sign in to use this action.');
      user = verified.data.user;
    }
    if (!user || !UUID.test(user.id)) return denied(401, 'AUTHENTICATION_REQUIRED', 'Sign in to use this action.');
    if (!userScoped && user.id.toLowerCase() !== operator) {
      return denied(403, 'OPERATOR_ACCESS_REQUIRED', 'This action belongs to the installation operator.');
    }
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return denied(401, 'AUTHENTICATION_REQUIRED', 'Sign in to use this action.');
  }
}

/** Defense in depth for provider/admin handlers also invoked directly by local tools/tests. */
export async function requireConfiguredApiAccess(request: Request): Promise<NextResponse | null> {
  const nextRequest = request instanceof NextRequest ? request : new NextRequest(request.clone());
  const response = await configuredApiAccess(nextRequest);
  return response.headers.get('x-middleware-next') === '1' ? null : response;
}
