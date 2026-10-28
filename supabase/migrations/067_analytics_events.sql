-- Migration: 067_analytics_events.sql
-- Purpose: Create analytics_events table for tracking user behavior
-- Part of Phase 0: Foundation

-- Analytics events table
-- Stores all user interaction events for funnel analysis
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who triggered the event (can be null for anonymous)
  user_id UUID,
  
  -- Session tracking
  session_id TEXT,
  
  -- Event info
  event_name TEXT NOT NULL,
  
  -- Event properties (flexible JSON)
  properties JSONB DEFAULT '{}'::JSONB,
  
  -- Context
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  
  -- Device info
  device_type TEXT,  -- desktop, mobile, tablet
  
  -- Location (from IP, optional)
  country TEXT,
  city TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable for time-series optimization (if using TimescaleDB)
-- SELECT create_hypertable('analytics_events', 'created_at', if_not_exists => TRUE);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- Composite index for funnel analysis
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event_time 
  ON analytics_events(user_id, event_name, created_at DESC);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own events
CREATE POLICY "Users can view own events"
  ON analytics_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert (from API)
-- No policy needed - handled by service role key

-- Allow anonymous inserts via API (will be validated server-side)
CREATE POLICY "Allow anonymous event inserts"
  ON analytics_events
  FOR INSERT
  WITH CHECK (true);

-- Key events we track (documented here for reference):
-- 
-- NON-PRO FUNNEL:
-- - signup_started
-- - signup_completed
-- - intake_started
-- - intake_completed
-- - whatsapp_opted_in
-- - whatsapp_skipped
-- - alert_sent
-- - alert_clicked
-- - property_viewed
-- - contact_agent_clicked
-- - viewing_created
-- - note_added
-- - viewing_completed
--
-- PRO FUNNEL:
-- - pro_signup_started
-- - pro_signup_completed
-- - client_created
-- - intake_method_chosen
-- - pro_intake_completed
-- - client_intake_completed (self-service)
-- - extension_installed
-- - extension_property_added
-- - shortlist_sent
-- - client_shortlist_opened
-- - client_note_added
-- - pro_notes_viewed
--
-- PAYMENT FUNNEL:
-- - pricing_page_viewed
-- - checkout_started
-- - checkout_completed
-- - subscription_canceled

-- Function to track an event (used by API)
CREATE OR REPLACE FUNCTION track_event(
  p_user_id UUID,
  p_event_name TEXT,
  p_properties JSONB DEFAULT '{}',
  p_session_id TEXT DEFAULT NULL,
  p_page_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO analytics_events (
    user_id,
    event_name,
    properties,
    session_id,
    page_url,
    created_at
  ) VALUES (
    p_user_id,
    p_event_name,
    p_properties,
    p_session_id,
    p_page_url,
    NOW()
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funnel analysis helper view
CREATE OR REPLACE VIEW funnel_signup_to_viewing AS
SELECT
  user_id,
  MAX(CASE WHEN event_name = 'signup_completed' THEN created_at END) as signed_up_at,
  MAX(CASE WHEN event_name = 'intake_completed' THEN created_at END) as intake_at,
  MAX(CASE WHEN event_name = 'whatsapp_opted_in' THEN created_at END) as whatsapp_at,
  MAX(CASE WHEN event_name = 'alert_clicked' THEN created_at END) as first_alert_click,
  MAX(CASE WHEN event_name = 'contact_agent_clicked' THEN created_at END) as first_contact,
  MAX(CASE WHEN event_name = 'viewing_completed' THEN created_at END) as first_viewing,
  COUNT(CASE WHEN event_name = 'property_viewed' THEN 1 END) as properties_viewed,
  COUNT(CASE WHEN event_name = 'note_added' THEN 1 END) as notes_added
FROM analytics_events
WHERE user_id IS NOT NULL
GROUP BY user_id;

COMMENT ON TABLE analytics_events IS 'User behavior tracking for funnel analysis';
COMMENT ON FUNCTION track_event IS 'Track a user event with properties';

