-- Migration 042: Add pair-graph clustering stage result columns
-- Purpose: Store intermediate stages (0a, 0b, 0c, 0d) for debugging and transparency
-- These stages replace the old Super Stage 0 + Stage 2/3/5 clustering logic

ALTER TABLE auto_clustering_test_runs
ADD COLUMN IF NOT EXISTS stage0a_result JSONB,
ADD COLUMN IF NOT EXISTS stage0b_result JSONB,
ADD COLUMN IF NOT EXISTS stage0c_result JSONB,
ADD COLUMN IF NOT EXISTS stage0d_result JSONB;

COMMENT ON COLUMN auto_clustering_test_runs.stage0a_result IS 'Stage 0A (Per-photo descriptors) - Flash Lite descriptors for each photo';
COMMENT ON COLUMN auto_clustering_test_runs.stage0b_result IS 'Stage 0B (Pair judgements) - Pairwise "same space?" judgements from Flash Lite';
COMMENT ON COLUMN auto_clustering_test_runs.stage0c_result IS 'Stage 0C (Graph clustering) - Code-only union-find clustering results';
COMMENT ON COLUMN auto_clustering_test_runs.stage0d_result IS 'Stage 0D (Naming) - Pro naming and listing sanity check (replaces old Super Stage 0)';

