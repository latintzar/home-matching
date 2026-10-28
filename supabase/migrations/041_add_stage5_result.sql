-- Migration 041: Add stage5_result column to auto_clustering_test_runs
-- Purpose: Store Stage 5 (Visual Refinement) results for promotion endpoint

ALTER TABLE auto_clustering_test_runs
ADD COLUMN IF NOT EXISTS stage5_result JSONB;

COMMENT ON COLUMN auto_clustering_test_runs.stage5_result IS 'Stage 5 (Visual Refinement) output with refined_clusters and merges_applied';

