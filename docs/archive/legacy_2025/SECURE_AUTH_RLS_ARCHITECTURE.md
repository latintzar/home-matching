# Secure Auth & RLS Architecture Plan

## Executive Summary

This document outlines the complete architecture and implementation plan for securing Puedo Casa's authentication and database access. The plan is designed to be implemented **after** endpoint quality assurance is complete, allowing the current development workflow to continue uninterrupted while providing a clear roadmap for production security.

**Current State**: Service-role key bypasses RLS for rapid development and QA  
**Target State**: Full RLS enforcement with user-scoped access, MFA, and comprehensive audit logging  
**Timeline**: Implement after endpoint quality review is complete

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Strategy](#authentication-strategy)
3. [Row Level Security (RLS) Strategy](#row-level-security-rls-strategy)
4. [Support & Admin Access](#support--admin-access)
5. [User Telemetry & Analytics](#user-telemetry--analytics)
6. [Implementation Phases](#implementation-phases)
7. [Technical Requirements](#technical-requirements)
8. [Migration Guide](#migration-guide)
9. [QA & Launch Checklist](#qa--launch-checklist)
10. [Rollback Plan](#rollback-plan)

---

## Architecture Overview

### Current Architecture (Phase 0 - QA Period)

```
┌─────────────┐
│  Frontend   │ ──> Supabase Client (anon key)
└─────────────┘
      │
      │ API Routes
      ▼
┌─────────────┐
│ Orchestrator│ ──> Supabase Client (service-role key) ❌ Bypasses RLS
└─────────────┘
      │
      │ Calls 26 endpoints
      ▼
┌─────────────┐
│  Endpoints  │ ──> Supabase Client (service-role key) ❌ Bypasses RLS
└─────────────┘
```

**Characteristics:**
- ✅ Fast development iteration
- ✅ No RLS complexity during QA
- ❌ No security boundaries
- ❌ No user isolation
- ❌ No audit trail

### Target Architecture (Phase 2 - Production)

```
┌─────────────┐
│  Frontend   │ ──> Supabase Client (anon key + user JWT)
└─────────────┘
      │
      │ Authenticated Requests
      ▼
┌─────────────┐
│ API Gateway │ ──> Validates JWT, extracts user context
└─────────────┘
      │
      │ User-scoped requests
      ▼
┌─────────────┐
│ Orchestrator│ ──> Supabase Client (user JWT) ✅ RLS enforced
└─────────────┘
      │
      │ Calls endpoints with user context
      ▼
┌─────────────┐
│  Endpoints  │ ──> Supabase Client (user JWT) ✅ RLS enforced
└─────────────┘
      │
      │ All queries filtered by RLS
      ▼
┌─────────────┐
│  Database   │ ──> RLS Policies enforce access control
└─────────────┘
```

**Characteristics:**
- ✅ Full user isolation
- ✅ Support/admin access via Studio
- ✅ Complete audit trail
- ✅ MFA enforcement
- ✅ Telemetry tracking

---

## Authentication Strategy

### 1. Primary Authentication Methods

#### Email + Password (Default)
- **Email confirmation**: Required for all new signups
- **Password requirements**:
  - Minimum 8 characters
  - Require lowercase, uppercase, number
  - Require special character
  - No common passwords (use Supabase's built-in validation)
- **Password reset**: Token-based with 1-hour expiry
- **Rate limiting**: 5 attempts per 15 minutes per IP

#### Magic Link (Alternative)
- **Use case**: Passwordless authentication option
- **Expiry**: 1 hour
- **One-time use**: Yes

#### Social OAuth (Future)
- **Providers**: Google, GitHub (optional)
- **Account linking**: Allow linking social accounts to existing email accounts
- **Fallback**: Always require email verification

### 2. Multi-Factor Authentication (MFA)

#### TOTP Authenticator Apps (Required for Admin/Support)
- **Enforcement**: Mandatory for users with `admin` or `support` roles
- **Enrollment**: User-initiated via settings page
- **Backup codes**: Generate 10 one-time backup codes on enrollment
- **Recovery**: Support can reset MFA (logged in audit table)

#### Phone SMS (Optional)
- **Use case**: Secondary MFA option for users
- **Rate limiting**: 3 SMS per hour per user
- **Cost consideration**: Monitor usage, consider disabling if costs spike

### 3. Session Management

#### Access Tokens
- **TTL**: 1 hour
- **Refresh**: Automatic via refresh token
- **Claims**: Include `app_metadata.roles`, `aal` (authenticator assurance level)

#### Refresh Tokens
- **TTL**: 30 days
- **Rotation**: Enabled (prevents token reuse attacks)
- **Reuse detection**: Log and invalidate all tokens if reuse detected

#### Session Storage
- **Frontend**: HTTP-only cookies (via Supabase client)
- **Backend**: JWT in Authorization header
- **Revocation**: Support can revoke sessions via Studio

### 4. User Roles & Permissions

#### Role Structure
```typescript
interface UserRole {
  id: string;
  role: 'user' | 'admin' | 'support';
  workspace_id?: string; // For multi-tenant isolation
  permissions?: string[]; // Granular permissions if needed
}
```

#### Role Definitions

**`user`** (Default)
- Can create and manage own listings
- Can view own deep dives
- Can track own usage
- Cannot access admin functions

**`admin`** (Internal)
- Full access to all data
- Can manage users
- Can view analytics
- Requires MFA (`aal2`)
- Can impersonate users (logged)

**`support`** (Customer Support)
- Read-only access to user data
- Can reset passwords (logged)
- Can view user sessions
- Can send support emails
- Requires MFA (`aal2`)
- Cannot modify production data

#### Role Assignment
- **Default**: All new users get `user` role
- **Admin/Support**: Assigned manually via Supabase Studio or Edge Function
- **Audit**: All role changes logged in `user_role_changes` table

---

## Row Level Security (RLS) Strategy

### 1. RLS Policy Architecture

#### Policy Types

**Restrictive Policies** (Most Secure)
- Use `as restrictive` clause
- Override all other policies
- Use for critical tables (user data, payments)

**Permissive Policies** (Default)
- Multiple policies combined with OR logic
- Use for most tables
- Easier to manage

#### Policy Template Pattern

```sql
-- Example: User can only access their own listings
CREATE POLICY "Users can view own listings"
ON listings
FOR SELECT
TO authenticated
USING (
  -- User owns the listing
  owner_id = auth.uid()
  OR
  -- User is member of workspace that owns listing
  workspace_id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Support/admin can view (with audit)
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (raw_app_meta_data->>'roles')::jsonb ? 'support'
  )
);
```

### 2. Table-by-Table Policy Matrix

| Table | Access Pattern | Policy Type | Notes |
|-------|---------------|-------------|-------|
| `profiles` | Self read/write | Restrictive | Users can only access own profile |
| `listings` | Owner CRUD, support read | Permissive | Workspace-aware |
| `manual_photo_clusters` | Owner read/write | Permissive | Orchestrator inserts via RPC |
| `deepdives` | Owner read/update, public read if published | Permissive | Published deep dives are public |
| `intelligent_consideraciones` | Owner read | Permissive | Linked to listing ownership |
| `user_events` | Users insert own, analytics read aggregated | Restrictive | Privacy-critical |
| `support_access_log` | Support insert, admin read | Restrictive | Audit trail |
| `workspaces` | Member read/write | Permissive | Multi-tenant support |
| `workspace_members` | Member read, admin write | Permissive | Workspace management |

### 3. Service-Role Key Usage Guidelines

#### When Service-Role is Acceptable

✅ **Acceptable Use Cases:**
- Database migrations (`supabase/migrations/`)
- Background cron jobs (Edge Functions with no user context)
- System-level operations (creating initial admin users)
- Bulk data imports (one-time operations)

❌ **Never Use Service-Role For:**
- User-facing API endpoints
- Orchestrator calls (after Phase 1)
- Any operation that should be user-scoped
- Reading user data without explicit user context

#### Service-Role Audit Pattern

```typescript
// When service-role must be used, log it
async function serviceRoleOperation(operation: string, metadata: any) {
  await supabaseServiceRole
    .from('service_role_audit')
    .insert({
      operation,
      metadata,
      executed_by: 'system', // or admin user ID if available
      executed_at: new Date().toISOString(),
    });
  
  // Then perform operation
}
```

### 4. RLS Policy Examples

#### Example 1: User Profiles (Restrictive)

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Support can read profiles (for customer support)
CREATE POLICY "Support can read profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'roles')::jsonb ? 'support'
  )
)
AS restrictive; -- Override other policies
```

#### Example 2: Listings (Permissive with Workspace Support)

```sql
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Users can view own listings
CREATE POLICY "Users can view own listings"
ON listings
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Users can create listings
CREATE POLICY "Users can create listings"
ON listings
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Users can update own listings
CREATE POLICY "Users can update own listings"
ON listings
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Support can view all listings (read-only)
CREATE POLICY "Support can view listings"
ON listings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'roles')::jsonb ? 'support'
  )
);
```

#### Example 3: User Events (Restrictive - Privacy Critical)

```sql
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Users can insert own events
CREATE POLICY "Users can insert own events"
ON user_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users CANNOT read raw events (privacy)
-- Only aggregated views accessible

-- Analytics role can read aggregated data
CREATE VIEW user_event_metrics AS
SELECT 
  user_id,
  event_name,
  COUNT(*) as event_count,
  DATE_TRUNC('day', occurred_at) as date
FROM user_events
GROUP BY user_id, event_name, DATE_TRUNC('day', occurred_at);

-- Policy for aggregated view
CREATE POLICY "Analytics can read aggregated events"
ON user_event_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'roles')::jsonb ? 'admin'
  )
);
```

---

## Support & Admin Access

### 1. Supabase Studio Access

#### Support Role Setup

**Step 1: Create Support Role in Database**
```sql
-- Create support role
CREATE ROLE support_role;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO support_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO support_role;
GRANT SELECT ON auth.users TO support_role;

-- Grant on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO support_role;
```

**Step 2: Assign Support Role in Supabase Dashboard**
1. Go to Settings → Team
2. Invite support staff with "Support" role
3. Support staff can now:
   - View users in Auth → Users
   - View data in Table Editor (read-only per RLS)
   - View logs in Logs Explorer
   - Reset passwords (via Auth API)

#### Admin Role Setup

**Step 1: Create Admin User**
```sql
-- Create admin user via Supabase Auth API or Studio
-- Then assign admin role:
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{roles}',
  '["admin"]'::jsonb
)
WHERE email = 'operator@example.invalid';
```

**Step 2: Admin Capabilities**
- Full read/write access (via RLS policies)
- Can manage all users
- Can view analytics
- Can impersonate users (via Edge Function)
- Can modify system settings

### 2. Support Workflow Documentation

#### Customer Support Playbook

**Viewing Customer Account:**
1. Open Supabase Studio → Auth → Users
2. Search by email or user ID
3. View user metadata, sessions, MFA status
4. Check `profiles` table for additional info

**Resetting Password:**
1. In Auth → Users, select user
2. Click "Send password reset email"
3. Or use Edge Function: `POST /api/admin/reset-password`
4. Log action in `support_access_log`

**Viewing User Data:**
1. Use Table Editor with support role
2. RLS policies automatically filter to allowed data
3. Cannot modify data (read-only per policy)

**Troubleshooting Issues:**
1. Check `support_access_log` for recent actions
2. View user sessions in Auth → Users
3. Check `orchestrator_runs` for pipeline issues
4. Review logs in Logs Explorer

### 3. Audit Logging for Support Actions

#### Support Access Log Table

```sql
CREATE TABLE support_access_log (
  id BIGSERIAL PRIMARY KEY,
  support_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'view_user', 'reset_password', 'view_listing', etc.
  target_user_id UUID REFERENCES auth.users(id),
  target_resource_type TEXT, -- 'user', 'listing', 'deepdive', etc.
  target_resource_id TEXT, -- ID of the resource accessed
  metadata JSONB, -- Additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Support can insert, admin can read
ALTER TABLE support_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Support can log actions"
ON support_access_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'roles')::jsonb ? 'support'
  )
);

CREATE POLICY "Admin can read support logs"
ON support_access_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'roles')::jsonb ? 'admin'
  )
);
```

#### Support Action Helper Function

```typescript
// src/lib/support-audit.ts
export async function logSupportAction(
  action: string,
  targetUserId: string,
  targetResourceType?: string,
  targetResourceId?: string,
  metadata?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  // Verify support role
  const roles = user.app_metadata?.roles || [];
  if (!roles.includes('support') && !roles.includes('admin')) {
    throw new Error('Insufficient permissions');
  }
  
  await supabase
    .from('support_access_log')
    .insert({
      support_user_id: user.id,
      action,
      target_user_id: targetUserId,
      target_resource_type: targetResourceType,
      target_resource_id: targetResourceId,
      metadata,
      ip_address: request.headers.get('x-forwarded-for'),
      user_agent: request.headers.get('user-agent'),
    });
}
```

---

## User Telemetry & Analytics

### 1. Event Tracking Architecture

#### Event Schema

```sql
CREATE TABLE user_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  session_id TEXT, -- Track user sessions
  event_name TEXT NOT NULL, -- 'page_view', 'click', 'hover', 'section_view'
  event_category TEXT, -- 'navigation', 'interaction', 'engagement'
  event_properties JSONB, -- Flexible event data
  page_url TEXT,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_event_name ON user_events(event_name);
CREATE INDEX idx_user_events_occurred_at ON user_events(occurred_at);
CREATE INDEX idx_user_events_session_id ON user_events(session_id);
```

#### Event Types

**Page Views**
```typescript
{
  event_name: 'page_view',
  event_category: 'navigation',
  event_properties: {
    page_title: 'Deep Dive - Property 123',
    page_type: 'deepdive',
    deepdive_id: 'uuid-here'
  }
}
```

**Clicks**
```typescript
{
  event_name: 'click',
  event_category: 'interaction',
  event_properties: {
    element_id: 'tier-optimo-button',
    element_type: 'button',
    element_text: 'View Óptimo Tier',
    section: 'renovation-tiers'
  }
}
```

**Hovers**
```typescript
{
  event_name: 'hover',
  event_category: 'interaction',
  event_properties: {
    element_id: 'consideraciones-card',
    hover_duration_ms: 2500,
    section: 'intelligent-consideraciones'
  }
}
```

**Section Views**
```typescript
{
  event_name: 'section_view',
  event_category: 'engagement',
  event_properties: {
    section_name: 'renovation-tiers',
    section_id: 'tiers-section',
    view_duration_ms: 45000,
    scroll_depth: 0.75
  }
}
```

### 2. Frontend Tracking Implementation

#### Tracking Hook

```typescript
// src/hooks/useTelemetry.ts
import { useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-nextjs';

export function useTelemetry() {
  const supabase = useSupabaseClient();
  
  const trackEvent = useCallback(async (
    eventName: string,
    eventCategory: string,
    properties?: Record<string, any>
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Don't track anonymous users
    
    // Get session ID (create if doesn't exist)
    let sessionId = sessionStorage.getItem('telemetry_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('telemetry_session_id', sessionId);
    }
    
    // Batch events (send every 5 seconds or 10 events)
    const events = JSON.parse(sessionStorage.getItem('telemetry_queue') || '[]');
    events.push({
      user_id: user.id,
      session_id: sessionId,
      event_name: eventName,
      event_category: eventCategory,
      event_properties: properties,
      page_url: window.location.href,
      page_path: window.location.pathname,
      referrer: document.referrer,
      occurred_at: new Date().toISOString(),
    });
    
    sessionStorage.setItem('telemetry_queue', JSON.stringify(events));
    
    // Send batch if threshold reached
    if (events.length >= 10) {
      await sendTelemetryBatch(events);
      sessionStorage.removeItem('telemetry_queue');
    }
  }, [supabase]);
  
  return { trackEvent };
}

async function sendTelemetryBatch(events: any[]) {
  // Call Edge Function to insert events
  await fetch('/api/telemetry/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
}
```

#### Component Integration

```typescript
// Example: Track section views
import { useEffect } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';

export function RenovationTiersSection() {
  const { trackEvent } = useTelemetry();
  
  useEffect(() => {
    // Track section view when component mounts
    trackEvent('section_view', 'engagement', {
      section_name: 'renovation-tiers',
      section_id: 'tiers-section',
    });
    
    // Track scroll depth
    const handleScroll = () => {
      const element = document.getElementById('tiers-section');
      if (element) {
        const scrollDepth = 
          (window.scrollY + window.innerHeight - element.offsetTop) / 
          element.scrollHeight;
        
        if (scrollDepth > 0.75) {
          trackEvent('section_view', 'engagement', {
            section_name: 'renovation-tiers',
            scroll_depth: scrollDepth,
          });
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [trackEvent]);
  
  // Track clicks
  const handleTierClick = (tier: string) => {
    trackEvent('click', 'interaction', {
      element_id: `tier-${tier}-button`,
      element_type: 'button',
      element_text: `View ${tier} Tier`,
      section: 'renovation-tiers',
    });
  };
  
  return (
    <section id="tiers-section">
      {/* Component content */}
    </section>
  );
}
```

### 3. Backend Telemetry Endpoint

#### Edge Function: Track Events

```typescript
// supabase/functions/track-telemetry/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }
    
    // Parse events
    const { events } = await req.json();
    
    // Validate events
    if (!Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid events' }), {
        status: 400,
      });
    }
    
    // Ensure all events belong to authenticated user
    const validatedEvents = events.map(event => ({
      ...event,
      user_id: user.id, // Override user_id from client
      occurred_at: event.occurred_at || new Date().toISOString(),
    }));
    
    // Insert events (RLS will enforce user_id match)
    const { error } = await supabase
      .from('user_events')
      .insert(validatedEvents);
    
    if (error) {
      throw error;
    }
    
    return new Response(
      JSON.stringify({ success: true, inserted: validatedEvents.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

### 4. Analytics Views & Queries

#### Aggregated Metrics View

```sql
-- Daily user engagement metrics
CREATE VIEW daily_user_engagement AS
SELECT 
  DATE_TRUNC('day', occurred_at) as date,
  user_id,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(*) as total_events,
  COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN page_path END) as pages_viewed,
  COUNT(DISTINCT CASE WHEN event_name = 'click' THEN event_properties->>'element_id' END) as unique_elements_clicked,
  AVG((event_properties->>'hover_duration_ms')::numeric) FILTER (
    WHERE event_name = 'hover'
  ) as avg_hover_duration_ms,
  MAX((event_properties->>'scroll_depth')::numeric) FILTER (
    WHERE event_name = 'section_view'
  ) as max_scroll_depth
FROM user_events
GROUP BY DATE_TRUNC('day', occurred_at), user_id;

-- Section popularity
CREATE VIEW section_popularity AS
SELECT 
  event_properties->>'section_name' as section_name,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_views,
  AVG((event_properties->>'view_duration_ms')::numeric) as avg_view_duration_ms
FROM user_events
WHERE event_name = 'section_view'
GROUP BY event_properties->>'section_name';

-- Click-through rates by element
CREATE VIEW element_ctr AS
SELECT 
  event_properties->>'element_id' as element_id,
  event_properties->>'section' as section,
  COUNT(*) as clicks,
  COUNT(DISTINCT user_id) as unique_users_clicked
FROM user_events
WHERE event_name = 'click'
GROUP BY 
  event_properties->>'element_id',
  event_properties->>'section';
```

#### RLS for Analytics Views

```sql
-- Users can only see their own aggregated data
CREATE POLICY "Users can view own engagement"
ON daily_user_engagement
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin can see all aggregated data
CREATE POLICY "Admin can view all engagement"
ON daily_user_engagement
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_app_meta_data->>'roles')::jsonb ? 'admin'
  )
);

-- Section popularity is public (aggregated, no PII)
CREATE POLICY "Anyone can view section popularity"
ON section_popularity
FOR SELECT
TO authenticated
USING (true);
```

### 5. Privacy & Compliance

#### Consent Management

```typescript
// src/components/TelemetryConsent.tsx
export function TelemetryConsent() {
  const [consented, setConsented] = useState(false);
  
  useEffect(() => {
    const consent = localStorage.getItem('telemetry_consent');
    if (consent === 'granted') {
      setConsented(true);
    }
  }, []);
  
  const handleConsent = (granted: boolean) => {
    localStorage.setItem('telemetry_consent', granted ? 'granted' : 'denied');
    setConsented(granted);
    
    if (!granted) {
      // Disable telemetry tracking
      window.telemetryEnabled = false;
    }
  };
  
  if (consented) return null;
  
  return (
    <div className="telemetry-consent-banner">
      <p>We use analytics to improve your experience. Do you consent?</p>
      <button onClick={() => handleConsent(true)}>Accept</button>
      <button onClick={() => handleConsent(false)}>Decline</button>
    </div>
  );
}
```

#### Data Retention Policy

```sql
-- Automated cleanup: Delete events older than 2 years
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM user_events
  WHERE occurred_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron (if available) or Edge Function cron
-- Run monthly: SELECT cleanup_old_events();
```

---

## Implementation Phases

### Phase 0: Current State (QA Period) ✅

**Status**: Active  
**Duration**: Until endpoint quality review complete

**Characteristics:**
- Service-role key used in orchestrator and endpoints
- RLS disabled or bypassed
- No user authentication required
- Fast iteration for QA

**No changes needed** - continue as-is until QA complete

---

### Phase 1: Pre-Enforcement Refactor (Before RLS)

**Goal**: Refactor endpoints to accept user context without enforcing RLS yet

#### Step 1.1: Create User Context Helper

```typescript
// src/lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function getUserSupabaseClient() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}
```

#### Step 1.2: Update Orchestrator to Use User Context

```typescript
// src/app/api/listings/[id]/orchestrate-d-to-r3/route.ts

// BEFORE (Phase 0):
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// AFTER (Phase 1):
export async function POST(request: NextRequest, { params }) {
  // Get user context
  const supabase = await getUserSupabaseClient();
  
  // Continue with user-scoped client
  // All queries will use user's JWT
}
```

#### Step 1.3: Update All Endpoints

**Pattern for each endpoint:**

```typescript
// BEFORE:
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// AFTER:
export async function POST(request: NextRequest, { params }) {
  // Verify authentication
  const supabase = await getUserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Use user-scoped client for all queries
  // RLS will be enforced once policies are enabled
}
```

#### Step 1.4: Feature Flag for Gradual Rollout

```typescript
// src/lib/feature-flags.ts
export const FEATURE_FLAGS = {
  USE_USER_CONTEXT: process.env.USE_USER_CONTEXT === 'true',
  ENABLE_RLS: process.env.ENABLE_RLS === 'true',
};

// In orchestrator:
const supabase = FEATURE_FLAGS.USE_USER_CONTEXT
  ? await getUserSupabaseClient()
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

**Checklist:**
- [ ] Create `getUserSupabaseClient()` helper
- [ ] Update orchestrator to use user context (behind feature flag)
- [ ] Update all 26 endpoints to use user context (behind feature flag)
- [ ] Test endpoints still work with user context (RLS still disabled)
- [ ] Document any endpoints that legitimately need service-role

---

### Phase 2: RLS Enforcement (Production Ready)

**Goal**: Enable RLS policies and enforce security boundaries

#### Step 2.1: Create Migration for RLS Policies

```sql
-- supabase/migrations/XXX_enable_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_photo_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE deepdives ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligent_consideraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
-- ... all other tables

-- Create policies (see examples in RLS Strategy section)
-- ... policy creation SQL ...
```

#### Step 2.2: Create Audit Tables

```sql
-- Orchestrator runs audit
CREATE TABLE orchestrator_runs (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT, -- 'running', 'completed', 'failed'
  steps_completed TEXT[], -- Array of completed step names
  error_message TEXT,
  token_usage JSONB, -- Store token usage data
  metadata JSONB
);

-- Service-role usage audit
CREATE TABLE service_role_audit (
  id BIGSERIAL PRIMARY KEY,
  operation TEXT NOT NULL,
  executed_by TEXT, -- 'system' or user ID
  metadata JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Step 2.3: Update Orchestrator to Log Runs

```typescript
// In orchestrator route.ts
const runId = await supabase
  .from('orchestrator_runs')
  .insert({
    listing_id: listingId,
    user_id: user.id,
    status: 'running',
  })
  .select('id')
  .single();

// At end of pipeline:
await supabase
  .from('orchestrator_runs')
  .update({
    completed_at: new Date().toISOString(),
    status: 'completed',
    steps_completed: results.map(r => r.step),
    token_usage: tokenUsage,
  })
  .eq('id', runId.data.id);
```

#### Step 2.4: Enable MFA for Admin/Support

```sql
-- Update auth.config to require MFA for admin/support
-- This is done via Supabase Dashboard or Management API
-- See: https://supabase.com/docs/guides/auth/auth-mfa
```

#### Step 2.5: Flip Feature Flags

```bash
# .env.local
USE_USER_CONTEXT=true
ENABLE_RLS=true
```

**Checklist:**
- [ ] Create RLS policy migration
- [ ] Test policies with sample user accounts
- [ ] Create audit tables
- [ ] Update orchestrator to log runs
- [ ] Enable MFA for admin/support roles
- [ ] Test support access in Supabase Studio
- [ ] Verify telemetry tracking works
- [ ] Run full QA checklist (see below)

---

## Technical Requirements

### 1. Environment Variables

```bash
# .env.local

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Keep secret!

# Feature flags (Phase 1)
USE_USER_CONTEXT=false # Set to true in Phase 1
ENABLE_RLS=false # Set to true in Phase 2

# Auth configuration
AUTH_REQUIRE_EMAIL_CONFIRMATION=true
AUTH_REQUIRE_MFA_FOR_ADMIN=true
AUTH_SESSION_TTL_HOURS=1
AUTH_REFRESH_TOKEN_TTL_DAYS=30

# Telemetry
TELEMETRY_ENABLED=true
TELEMETRY_BATCH_SIZE=10
TELEMETRY_BATCH_INTERVAL_MS=5000
TELEMETRY_RETENTION_DAYS=730 # 2 years
```

### 2. Database Schema Requirements

#### Required Tables

**Auth & Users:**
- `profiles` (extends auth.users)
- `workspaces` (multi-tenant support)
- `workspace_members` (workspace membership)

**Audit & Logging:**
- `orchestrator_runs`
- `service_role_audit`
- `support_access_log`
- `user_role_changes`

**Telemetry:**
- `user_events`
- `daily_user_engagement` (view)
- `section_popularity` (view)
- `element_ctr` (view)

#### Required Functions

**RLS Helper Functions:**
```sql
-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id
    AND (raw_app_meta_data->>'roles')::jsonb ? 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is support
CREATE OR REPLACE FUNCTION is_support(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id
    AND (raw_app_meta_data->>'roles')::jsonb ? 'support'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 3. Code Requirements

#### Required Utilities

**File**: `src/lib/supabase-server.ts`
- `getUserSupabaseClient()` - Get user-scoped client
- `requireAuth()` - Middleware to require authentication
- `requireRole(role: string)` - Middleware to require specific role

**File**: `src/lib/support-audit.ts`
- `logSupportAction()` - Log support actions
- `canAccessResource()` - Check if support can access resource

**File**: `src/hooks/useTelemetry.ts`
- `useTelemetry()` - React hook for tracking events
- `trackEvent()` - Track single event
- `trackBatch()` - Track multiple events

#### Required Middleware

**File**: `src/middleware.ts`
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const { data: { session } } = await supabase.auth.getSession();
  
  // Protect API routes
  if (req.nextUrl.pathname.startsWith('/api/') && !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### 4. Supabase Configuration

#### Auth Settings (via Dashboard or SQL)

**Email Settings:**
- Enable email confirmation
- Custom email templates (optional)
- Rate limiting: 5 emails per 15 minutes

**Password Settings:**
- Minimum length: 8
- Require uppercase, lowercase, number, special character
- Enable password strength validation

**Session Settings:**
- Access token TTL: 1 hour
- Refresh token TTL: 30 days
- Enable refresh token rotation

**MFA Settings:**
- Enable TOTP
- Require MFA for admin/support roles
- Generate backup codes on enrollment

---

## Migration Guide

### Step-by-Step Migration Process

#### Pre-Migration Checklist

- [ ] All endpoints tested and QA approved
- [ ] Backup database (via Supabase Dashboard)
- [ ] Document current service-role usage
- [ ] Create rollback plan
- [ ] Schedule maintenance window (if needed)

#### Migration Steps

**1. Phase 1 Migration (User Context)**

```bash
# 1. Create user context helper
# File: src/lib/supabase-server.ts (see Technical Requirements)

# 2. Update orchestrator
# File: src/app/api/listings/[id]/orchestrate-d-to-r3/route.ts
# - Replace service-role client with getUserSupabaseClient()
# - Add authentication check
# - Wrap in feature flag

# 3. Update all endpoints (26 endpoints)
# - Replace service-role client with getUserSupabaseClient()
# - Add authentication check
# - Test each endpoint

# 4. Test with feature flag disabled (should still work)
# 5. Test with feature flag enabled (should work with user context)
# 6. Monitor for errors
```

**2. Phase 2 Migration (RLS Enforcement)**

```bash
# 1. Create RLS policy migration
# File: supabase/migrations/XXX_enable_rls_policies.sql
# - Enable RLS on all tables
# - Create policies (see examples)
# - Create audit tables
# - Create helper functions

# 2. Test migration on staging/dev database first
supabase db reset --db-url $STAGING_DB_URL
supabase migration up --db-url $STAGING_DB_URL

# 3. Test endpoints with RLS enabled
# - Create test user accounts
# - Test each endpoint
# - Verify RLS policies work correctly

# 4. Apply to production
supabase migration up

# 5. Enable feature flags
# Update .env.local:
USE_USER_CONTEXT=true
ENABLE_RLS=true

# 6. Monitor for errors
# - Check orchestrator_runs for failures
# - Check service_role_audit for unexpected usage
# - Check support_access_log for support actions
```

#### Post-Migration Verification

**Verify RLS Policies:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- Test policy: User can only see own listings
-- (Run as test user)
SELECT * FROM listings; -- Should only return user's listings

-- Test policy: Support can see all listings
-- (Run as support user)
SELECT * FROM listings; -- Should return all listings
```

**Verify Audit Logging:**
```sql
-- Check orchestrator runs are logged
SELECT COUNT(*) FROM orchestrator_runs;

-- Check support actions are logged
SELECT * FROM support_access_log ORDER BY created_at DESC LIMIT 10;
```

**Verify Telemetry:**
```sql
-- Check events are being tracked
SELECT COUNT(*) FROM user_events;

-- Check aggregated views
SELECT * FROM daily_user_engagement LIMIT 10;
```

---

## QA & Launch Checklist

### Pre-Launch Security Checklist

#### Authentication
- [ ] Email confirmation required for new signups
- [ ] Password requirements enforced (8+ chars, complexity)
- [ ] Password reset flow works correctly
- [ ] Magic link authentication works
- [ ] MFA enrollment works for admin/support
- [ ] MFA required for admin/support roles
- [ ] Session management works (refresh tokens, rotation)
- [ ] Logout clears sessions correctly

#### Authorization
- [ ] RLS enabled on all tables
- [ ] Users can only access own data
- [ ] Support can view user data (read-only)
- [ ] Admin can access all data
- [ ] Public deep dives are accessible without auth
- [ ] Private deep dives require authentication
- [ ] Workspace membership enforced

#### Audit & Logging
- [ ] Orchestrator runs are logged
- [ ] Support actions are logged
- [ ] Service-role usage is logged (if any)
- [ ] User role changes are logged
- [ ] Failed authentication attempts are logged

#### Telemetry
- [ ] Events are tracked correctly
- [ ] User consent banner works
- [ ] Events respect user consent
- [ ] Aggregated views are accessible
- [ ] Raw events are not accessible to users
- [ ] Data retention policy implemented

#### Support Tools
- [ ] Support can view users in Studio
- [ ] Support can reset passwords
- [ ] Support can view user sessions
- [ ] Support can view user data (read-only)
- [ ] Support actions are audited
- [ ] Support workflow documented

### Performance Testing

- [ ] RLS policies don't significantly impact query performance
- [ ] Telemetry batching doesn't block UI
- [ ] Authentication checks don't add latency
- [ ] Database indexes are optimized for RLS queries

### Security Testing

- [ ] Test user cannot access other users' data
- [ ] Test user cannot bypass RLS policies
- [ ] Test support cannot modify data (read-only)
- [ ] Test admin can access all data
- [ ] Test MFA enforcement for admin/support
- [ ] Test session expiration works
- [ ] Test refresh token rotation works

### User Experience Testing

- [ ] Signup flow is smooth
- [ ] Login flow is smooth
- [ ] Password reset flow is smooth
- [ ] MFA enrollment is intuitive
- [ ] Telemetry consent banner is clear
- [ ] Error messages are user-friendly
- [ ] Support can help users effectively

---

## Rollback Plan

### If Issues Occur After Phase 1

**Rollback Steps:**
1. Disable feature flag: `USE_USER_CONTEXT=false`
2. Restart application
3. Endpoints revert to service-role key
4. Investigate issues
5. Fix and retry

**No database changes** - safe to rollback

### If Issues Occur After Phase 2

**Rollback Steps:**
1. Disable feature flag: `ENABLE_RLS=false`
2. Drop RLS policies (if needed):
```sql
-- Emergency: Disable RLS (use with caution!)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE listings DISABLE ROW LEVEL SECURITY;
-- ... repeat for all tables
```
3. Restart application
4. Investigate issues
5. Fix policies and re-enable

**Database changes required** - test rollback on staging first

### Emergency Contacts

- **Database Admin**: [Contact info]
- **Security Team**: [Contact info]
- **Supabase Support**: operator@example.invalid

---

## Appendix

### A. RLS Policy Templates

See [RLS Strategy Section](#row-level-security-rls-strategy) for complete policy examples.

### B. Support Workflow Examples

See [Support & Admin Access Section](#support--admin-access) for complete workflows.

### C. Telemetry Event Schema

See [User Telemetry & Analytics Section](#user-telemetry--analytics) for complete event schemas.

### D. Migration SQL Examples

See [Migration Guide Section](#migration-guide) for complete migration scripts.

### E. Feature Flag Implementation

```typescript
// src/lib/feature-flags.ts
export const FEATURE_FLAGS = {
  USE_USER_CONTEXT: process.env.USE_USER_CONTEXT === 'true',
  ENABLE_RLS: process.env.ENABLE_RLS === 'true',
  TELEMETRY_ENABLED: process.env.TELEMETRY_ENABLED === 'true',
};

// Usage:
if (FEATURE_FLAGS.USE_USER_CONTEXT) {
  const supabase = await getUserSupabaseClient();
} else {
  const supabase = createClient(URL, SERVICE_KEY);
}
```

---

## Document History

- **Created**: 2025-01-27
- **Last Updated**: 2025-01-27
- **Status**: Draft - Awaiting endpoint QA completion
- **Next Review**: After Phase 0 (QA) completion

---

## Questions & Support

For questions about this architecture plan:
1. Review this document thoroughly
2. Check Supabase documentation: https://supabase.com/docs
3. Contact development team lead
4. Escalate to security team if security concerns

---

**End of Document**

