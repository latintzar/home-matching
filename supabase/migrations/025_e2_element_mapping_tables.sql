-- Migration: E2 Element Mapping and Tier-Specific Target States
-- Creates tables for Q2 (element mapping) and Q3 (tier-specific target states)
-- Date: 2025-01-27

-- Q2: E2 Element Mapping
-- Maps each E2 element to relevant renovation scope items
CREATE TABLE IF NOT EXISTS e2_element_mapping (
  listing_id TEXT NOT NULL,
  element_id TEXT NOT NULL, -- Unique ID: {room_id}_{element_type}_{index}
  element_type TEXT NOT NULL CHECK (element_type IN ('furniture', 'fixture', 'surface', 'structural', 'opening')),
  room_id TEXT NOT NULL,
  element_data JSONB NOT NULL, -- Full element data from E2 (object, surface, etc.)
  scope_items JSONB NOT NULL, -- Array of scope item references that affect this element
  matched_by TEXT, -- How the match was made: 'room_name', 'element_type', 'keyword', etc.
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, element_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2_element_mapping_listing_room ON e2_element_mapping(listing_id, room_id);
CREATE INDEX IF NOT EXISTS idx_e2_element_mapping_listing_type ON e2_element_mapping(listing_id, element_type);

-- Q3: Tier-Specific E2 Target States
-- Stores tier-specific target states for each room's elements
CREATE TABLE IF NOT EXISTS e2_tier_target_states (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  room_id TEXT NOT NULL,
  target_state JSONB NOT NULL, -- { elements: [{ element_id, action, details, reason }] }
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier, room_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2_tier_target_states_listing_tier ON e2_tier_target_states(listing_id, tier);
CREATE INDEX IF NOT EXISTS idx_e2_tier_target_states_listing_room ON e2_tier_target_states(listing_id, room_id);

-- Add comments for documentation
COMMENT ON TABLE e2_element_mapping IS 'Q2: Maps E2 layout elements to renovation scope items';
COMMENT ON TABLE e2_tier_target_states IS 'Q3: Tier-specific target states for E2 elements per room';

