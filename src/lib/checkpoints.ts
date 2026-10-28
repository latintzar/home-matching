import { createClient } from '@/utils/supabase/server';

export interface CheckpointData {
  data: any;
  timestamp: string;
  success: boolean;
  error?: string;
  status: 'started' | 'completed' | 'failed';
}

export interface PipelineCheckpoints {
  scrapfly?: CheckpointData;
  photos?: CheckpointData;
  a1?: CheckpointData;
  a2?: CheckpointData;
  b1?: CheckpointData;
  b2?: CheckpointData;
  b3?: CheckpointData;
  b4?: CheckpointData;
  c1?: CheckpointData;
  c2?: CheckpointData;
  clustering?: CheckpointData;
  analysis?: CheckpointData;
  deepdive?: CheckpointData;
}

/**
 * Mark a step as started
 */
export async function startCheckpoint(
  listingId: string, 
  step: keyof PipelineCheckpoints
): Promise<void> {
  console.log(`🚀 STARTING CHECKPOINT: ${step} for listing ${listingId}`);
  const supabase = createClient();
  
  const checkpointData: CheckpointData = {
    data: null,
    timestamp: new Date().toISOString(),
    success: false,
    status: 'started'
  };

  // Get existing checkpoints
  const { data: existing } = await supabase
    .from('listings')
    .select('pipeline_checkpoints')
    .eq('id', listingId)
    .single();

  const currentCheckpoints: PipelineCheckpoints = existing?.pipeline_checkpoints || {};
  
  // Update the specific step
  currentCheckpoints[step] = checkpointData;

  // Save back to database
  const { error: updateError } = await supabase
    .from('listings')
    .update({ pipeline_checkpoints: currentCheckpoints })
    .eq('id', listingId);

  if (updateError) {
    console.error(`❌ CHECKPOINT START FAILED: ${step.toUpperCase()}`, updateError);
  } else {
    console.log(`🚀 CHECKPOINT STARTED: ${step.toUpperCase()}`);
  }
}

/**
 * Save a checkpoint for a specific pipeline step
 */
export async function saveCheckpoint(
  listingId: string, 
  step: keyof PipelineCheckpoints, 
  data: any, 
  success: boolean = true,
  error?: string
): Promise<void> {
  console.log(`💾 SAVING CHECKPOINT: ${step} for listing ${listingId}`, { success, error });
  const supabase = createClient();
  
  const checkpointData: CheckpointData = {
    data,
    timestamp: new Date().toISOString(),
    success,
    error,
    status: success ? 'completed' : 'failed'
  };

  // Get existing checkpoints
  const { data: existing } = await supabase
    .from('listings')
    .select('pipeline_checkpoints')
    .eq('id', listingId)
    .single();

  const currentCheckpoints: PipelineCheckpoints = existing?.pipeline_checkpoints || {};
  
  // Update the specific step
  currentCheckpoints[step] = checkpointData;

  // Save back to database
  const { error: updateError } = await supabase
    .from('listings')
    .update({ pipeline_checkpoints: currentCheckpoints })
    .eq('id', listingId);

  if (updateError) {
    console.error(`❌ CHECKPOINT SAVE FAILED: ${step.toUpperCase()}`, updateError);
  } else {
    console.log(`💾 CHECKPOINT SAVED: ${step.toUpperCase()}`, { success, timestamp: checkpointData.timestamp });
  }
}

/**
 * Load a checkpoint for a specific pipeline step
 */
export async function loadCheckpoint(
  listingId: string, 
  step: keyof PipelineCheckpoints
): Promise<CheckpointData | null> {
  const supabase = createClient();
  
  const { data } = await supabase
    .from('listings')
    .select('pipeline_checkpoints')
    .eq('id', listingId)
    .single();

  const checkpoints: PipelineCheckpoints = data?.pipeline_checkpoints || {};
  return checkpoints[step] || null;
}

/**
 * Load all checkpoints for a listing
 */
export async function loadAllCheckpoints(listingId: string): Promise<PipelineCheckpoints> {
  const supabase = createClient();
  
  const { data } = await supabase
    .from('listings')
    .select('pipeline_checkpoints')
    .eq('id', listingId)
    .single();

  return data?.pipeline_checkpoints || {};
}

/**
 * Clear a specific checkpoint (for retry)
 */
export async function clearCheckpoint(
  listingId: string, 
  step: keyof PipelineCheckpoints
): Promise<void> {
  const supabase = createClient();
  
  // Get existing checkpoints
  const { data: existing } = await supabase
    .from('listings')
    .select('pipeline_checkpoints')
    .eq('id', listingId)
    .single();

  const currentCheckpoints: PipelineCheckpoints = existing?.pipeline_checkpoints || {};
  
  // Remove the specific step
  delete currentCheckpoints[step];

  // Save back to database
  await supabase
    .from('listings')
    .update({ pipeline_checkpoints: currentCheckpoints })
    .eq('id', listingId);

  console.log(`🗑️ CHECKPOINT CLEARED: ${step.toUpperCase()}`);
}

/**
 * Get the last successful step
 */
export async function getLastSuccessfulStep(listingId: string): Promise<keyof PipelineCheckpoints | null> {
  const checkpoints = await loadAllCheckpoints(listingId);
  
  const stepOrder: (keyof PipelineCheckpoints)[] = [
    'scrapfly', 'photos', 'a1', 'a2', 'b1', 'b2', 'b3', 'b4', 'c1', 'c2', 'clustering', 'analysis', 'deepdive'
  ];
  
  for (let i = stepOrder.length - 1; i >= 0; i--) {
    const step = stepOrder[i];
    if (checkpoints[step]?.success) {
      return step;
    }
  }
  
  return null;
}
