/**
 * Helper script to add interceptConsoleLog pattern to endpoints
 * This is a reference - actual updates are done manually via search_replace
 */

// Pattern to add to each endpoint:
/*
1. Add import:
import { interceptConsoleLog } from '@/lib/orchestrator-progress';

2. Add at start of POST function (before try block):
  // Check if called from orchestrator - if so, intercept console.log to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'STEP_NAME';
  let restoreConsole: (() => void) | null = null;
  
  if (isOrchestratorContext) {
    restoreConsole = interceptConsoleLog(stepName);
  }

3. Add finally block before closing brace:
  } finally {
    // Restore original console if we intercepted it
    if (restoreConsole) {
      restoreConsole();
    }
  }
*/

// Endpoints remaining to update:
const endpointsToUpdate = [
  { file: 'src/app/api/listings/[id]/rooms/group-catalog/route.ts', step: 'T1' },
  { file: 'src/app/api/listings/[id]/tiers/budgeting/route.ts', step: 'T1.5' },
  { file: 'src/app/api/listings/[id]/tiers/ideation/route.ts', step: 'T2' },
  { file: 'src/app/api/listings/[id]/tiers/style-direction/route.ts', step: 'T2.5' },
  { file: 'src/app/api/listings/[id]/tiers/apply-to-groups/route.ts', step: 'T3' },
  { file: 'src/app/api/listings/[id]/tiers/decide-elements/route.ts', step: 'T4' },
  { file: 'src/app/api/listings/[id]/tiers/cohesion/route.ts', step: 'T5' },
  { file: 'src/app/api/listings/[id]/tiers/apply-cohesion-corrections/route.ts', step: 'T5.5' },
  { file: 'src/app/api/listings/[id]/renovation-scope/seed-from-tiers/route.ts', step: 'I' },
  { file: 'src/app/api/listings/[id]/renovation-pricing/route.ts', step: 'K' },
  { file: 'src/app/api/listings/[id]/renovation-timeline/route.ts', step: 'L' },
  { file: 'src/app/api/listings/[id]/renovation-permits/route.ts', step: 'M' },
  { file: 'src/app/api/listings/[id]/renovation-scope-finalize/route.ts', step: 'N' },
  { file: 'src/app/api/listings/[id]/tiers/budget-calibration/route.ts', step: 'T6' },
  { file: 'src/app/api/listings/[id]/tiers/iterate-element-decisions/route.ts', step: 'T6.5' },
  { file: 'src/app/api/listings/[id]/after/select-room-images/route.ts', step: 'R1' },
  { file: 'src/app/api/listings/[id]/after/describe-room-images/route.ts', step: 'R2a' },
  { file: 'src/app/api/listings/[id]/after/generate-master-references/route.ts', step: 'R2b-Master' },
  { file: 'src/app/api/listings/[id]/after/generate-room-prompts/route.ts', step: 'R2b' },
  { file: 'src/app/api/listings/[id]/after/render-rooms/route.ts', step: 'R3' },
];

console.log('Endpoints to update:', endpointsToUpdate.length);

