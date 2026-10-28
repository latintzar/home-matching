-- Migration 037: Deprecate Legacy Tier Generation Tables
-- Phase 2: Pipeline Simplification - Mark old tier tables as deprecated
-- 
-- These tables are replaced by tier_element_synthesis:
-- - group_tier_directives (T3 output) → consolidated into tier_element_synthesis
-- - e2_tier_target_states (T4/T5.5/T6.5 output) → consolidated into tier_element_synthesis
-- - cohesion_notes (T5 output) → consolidated into tier_element_synthesis.cohesion_summary
--
-- NOTE: Tables are NOT dropped - kept for backward compatibility and data migration
-- Endpoints still exist but are no longer called by orchestrator

-- Add deprecation comments
COMMENT ON TABLE group_tier_directives IS 'DEPRECATED (Phase 2): Replaced by tier_element_synthesis. T3 (apply-to-groups) no longer in orchestrator. Kept for backward compatibility.';
COMMENT ON TABLE e2_tier_target_states IS 'DEPRECATED (Phase 2): Replaced by tier_element_synthesis. T4/T5.5/T6.5 no longer in orchestrator. Kept for backward compatibility.';
COMMENT ON TABLE cohesion_notes IS 'DEPRECATED (Phase 2): Replaced by tier_element_synthesis.cohesion_summary. T5/T5.5 no longer in orchestrator. Kept for backward compatibility.';

-- Update existing comments to reflect deprecation
COMMENT ON COLUMN group_tier_directives.directives IS 'DEPRECATED: Use tier_element_synthesis.synthesis_data.works instead';
COMMENT ON COLUMN e2_tier_target_states.target_state IS 'DEPRECATED: Use tier_element_synthesis.synthesis_data.works instead';
COMMENT ON COLUMN cohesion_notes.cohesion IS 'DEPRECATED: Use tier_element_synthesis.synthesis_data.cohesion_summary instead';

