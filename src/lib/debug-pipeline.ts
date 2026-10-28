/**
 * Pipeline Debugging and Caching System
 * 
 * This utility provides step-by-step debugging and caching for the Text Analysis pipeline.
 * Each step can be cached independently, allowing us to resume from any point.
 */

export interface PipelineStep {
  name: string;
  input: any;
  output: any;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface PipelineCache {
  listingId: string;
  steps: Map<string, PipelineStep>;
  currentStep: string | null;
  completedSteps: string[];
  failedSteps: string[];
}

export class PipelineDebugger {
  private cache: Map<string, PipelineCache> = new Map();
  private debugMode: boolean;

  constructor(debugMode = true) {
    this.debugMode = debugMode;
  }

  /**
   * Start debugging a new pipeline run
   */
  startRun(listingId: string): PipelineCache {
    const cache: PipelineCache = {
      listingId,
      steps: new Map(),
      currentStep: null,
      completedSteps: [],
      failedSteps: []
    };
    this.cache.set(listingId, cache);
    return cache;
  }

  /**
   * Start a pipeline step
   */
  startStep(listingId: string, stepName: string, input: any): void {
    const cache = this.cache.get(listingId);
    if (!cache) throw new Error(`No cache found for listing ${listingId}`);

    const step: PipelineStep = {
      name: stepName,
      input,
      output: null,
      timestamp: Date.now(),
      duration: 0,
      success: false
    };

    cache.steps.set(stepName, step);
    cache.currentStep = stepName;
  }

  /**
   * Complete a pipeline step successfully
   */
  completeStep(listingId: string, stepName: string, output: any): void {
    const cache = this.cache.get(listingId);
    if (!cache) throw new Error(`No cache found for listing ${listingId}`);

    const step = cache.steps.get(stepName);
    if (!step) throw new Error(`Step ${stepName} not found`);

    step.output = output;
    step.duration = Date.now() - step.timestamp;
    step.success = true;

    cache.completedSteps.push(stepName);
    cache.currentStep = null;
  }

  /**
   * Fail a pipeline step
   */
  failStep(listingId: string, stepName: string, error: string): void {
    const cache = this.cache.get(listingId);
    if (!cache) throw new Error(`No cache found for listing ${listingId}`);

    const step = cache.steps.get(stepName);
    if (!step) throw new Error(`Step ${stepName} not found`);

    step.error = error;
    step.duration = Date.now() - step.timestamp;
    step.success = false;

    cache.failedSteps.push(stepName);
    cache.currentStep = null;
  }

  /**
   * Get cached result for a step
   */
  getCachedResult(listingId: string, stepName: string): any | null {
    const cache = this.cache.get(listingId);
    if (!cache) return null;

    const step = cache.steps.get(stepName);
    if (!step || !step.success) return null;

    return step.output;
  }

  /**
   * Check if a step is cached and successful
   */
  isStepCached(listingId: string, stepName: string): boolean {
    const cache = this.cache.get(listingId);
    if (!cache) return false;

    const step = cache.steps.get(stepName);
    return step?.success === true;
  }

  /**
   * Get the last successful step
   */
  getLastSuccessfulStep(listingId: string): string | null {
    const cache = this.cache.get(listingId);
    if (!cache || cache.completedSteps.length === 0) return null;

    return cache.completedSteps[cache.completedSteps.length - 1];
  }

  /**
   * Get debugging summary
   */
  getDebugSummary(listingId: string): string {
    const cache = this.cache.get(listingId);
    if (!cache) return "No cache found";

    const summary = [
      `Pipeline Debug Summary for ${listingId}:`,
      `Completed Steps: ${cache.completedSteps.join(', ')}`,
      `Failed Steps: ${cache.failedSteps.join(', ')}`,
      `Current Step: ${cache.currentStep || 'None'}`,
      '',
      'Step Details:'
    ];

    for (const [stepName, step] of cache.steps) {
      const status = step.success ? '✅' : '❌';
      const duration = `${step.duration}ms`;
      summary.push(`${status} ${stepName}: ${duration}${step.error ? ` (${step.error})` : ''}`);
    }

    return summary.join('\n');
  }

  /**
   * Export cache for debugging
   */
  exportCache(listingId: string): any {
    const cache = this.cache.get(listingId);
    if (!cache) return null;

    return {
      listingId: cache.listingId,
      completedSteps: cache.completedSteps,
      failedSteps: cache.failedSteps,
      currentStep: cache.currentStep,
      steps: Object.fromEntries(
        Array.from(cache.steps.entries()).map(([name, step]) => [
          name,
          {
            name: step.name,
            success: step.success,
            duration: step.duration,
            error: step.error,
            inputSize: JSON.stringify(step.input).length,
            outputSize: step.output ? JSON.stringify(step.output).length : 0
          }
        ])
      )
    };
  }

  /**
   * Clear cache for a listing
   */
  clearCache(listingId: string): void {
    this.cache.delete(listingId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
  }
}

// Global debugger instance
export const pipelineDebugger = new PipelineDebugger(true);

