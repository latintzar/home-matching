/**
 * Progress Logger for Orchestrator
 * 
 * New approach: Use explicit step loggers that forward structured events.
 * This eliminates global console interception and prevents log leakage between steps.
 */

/**
 * Structured progress event sent from endpoints to orchestrator
 */
export type ProgressEvent = {
  step?: string | null;
  level: 'log' | 'error' | 'warn';
  message: string;
};

type ProgressCallback = (event: ProgressEvent) => void;

// Use Node's global object to ensure callback is accessible across ALL request contexts
// This is critical for Next.js where separate HTTP requests might have module isolation
// On fresh server starts, module-level variables might not be immediately accessible
const GLOBAL_KEY = '__orchestratorProgressCallback';
const GLOBAL_STEP_KEY = '__orchestratorCurrentStep';
const GLOBAL_RUN_ID_KEY = '__orchestratorRunId';

// Track current orchestrator run ID to prevent log leakage from previous runs
let currentRunId: string | null = null;

// Helper to get global object (works in Node.js)
function getGlobal(): any {
  if (typeof global !== 'undefined') return global;
  if (typeof window !== 'undefined') return window;
  return {};
}

// Fallback to module-level variables for backward compatibility
let moduleProgressCallback: ProgressCallback | null = null;
let moduleCurrentStepName: string | null = null;

/**
 * Set progress callback for orchestrator
 * @param callback - Callback function to receive ProgressEvent objects
 */
export function setProgressCallback(callback: ProgressCallback | null) {
  // Store in both global object (for cross-request access) and module variable (for same-request access)
  const globalObj = getGlobal();
  globalObj[GLOBAL_KEY] = callback;
  moduleProgressCallback = callback;
  
  // Generate new run ID when setting callback (new orchestrator run)
  if (callback) {
    currentRunId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    globalObj[GLOBAL_RUN_ID_KEY] = currentRunId;
  } else {
    currentRunId = null;
    globalObj[GLOBAL_RUN_ID_KEY] = null;
  }
}

/**
 * Get current orchestrator run ID
 */
export function getCurrentRunId(): string | null {
  const globalObj = getGlobal();
  return globalObj[GLOBAL_RUN_ID_KEY] || currentRunId;
}

/**
 * Set current step name (called by orchestrator before each endpoint)
 */
export function setCurrentStepName(stepName: string | null) {
  // Store in both global object (for cross-request access) and module variable (for same-request access)
  const globalObj = getGlobal();
  globalObj[GLOBAL_STEP_KEY] = stepName;
  moduleCurrentStepName = stepName;
}

/**
 * Get progress callback
 * @returns Callback function or null if not set
 */
export function getProgressCallback(): ProgressCallback | null {
  // First try global object (works across request boundaries)
  const globalObj = getGlobal();
  if (globalObj[GLOBAL_KEY]) {
    return globalObj[GLOBAL_KEY];
  }
  // Fallback to module variable (for same-request access)
  return moduleProgressCallback;
}

/**
 * Log progress update - will be sent through orchestrator SSE if callback is set
 * Falls back to console.log if no callback is set
 * 
 * @deprecated Prefer createStepLogger for structured logging
 */
export function logProgress(message: string, data?: any) {
  const callback = getProgressCallback();
  if (callback) {
    // Convert legacy string format to ProgressEvent
    callback({ step: null, level: 'log', message });
  } else {
    console.log(message, data || '');
  }
}

/**
 * Step logger interface - matches console API for drop-in replacement
 */
export type StepLogger = {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * Create a step logger that logs to console AND forwards to orchestrator
 * 
 * This is the preferred way for orchestrator endpoints to log.
 * - Always logs to server console (exact same output as standalone)
 * - Also forwards structured events to orchestrator SSE stream
 * - No global console monkey-patching - safe for concurrent requests
 * 
 * @param stepName - Name of the step (e.g. 'F0', 'F3', 'RoomByRoom')
 * @returns Logger object with log/error/warn methods
 */
export function createStepLogger(stepName?: string): StepLogger {
  // CRITICAL: Capture callback AND run ID at creation time to prevent log leakage
  // If we read it dynamically, async operations from previous runs might log to new orchestrator runs
  const capturedCallback = getProgressCallback();
  const capturedRunId = getCurrentRunId();
  
  const forward = (level: 'log' | 'error' | 'warn', args: any[]) => {
    // 1) Always log to server console exactly as endpoint would (no prefix)
    console[level](...args);

    // 2) Forward to orchestrator if callback was captured at creation time
    if (!capturedCallback) {
      // Debug: Log when callback is not available (only in orchestrator context)
      // This helps diagnose why logs aren't appearing
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[createStepLogger] No callback available for step: ${stepName || 'unknown'}`);
      }
      return;
    }
    
    // 3) CRITICAL: Check if this logger is from the current orchestrator run
    // If not, ignore the log (prevents log leakage from previous runs)
    const currentRunId = getCurrentRunId();
    // Block if: logger has a run ID AND current run has a different run ID (or no run ID)
    // This ensures logs from previous runs don't leak into new runs
    // ALSO block if current run has a run ID but logger doesn't (logger is stale)
    if (capturedRunId) {
      // Logger has a run ID - must match current run ID exactly
      if (!currentRunId || capturedRunId !== currentRunId) {
        // This logger is from a previous run - don't forward to current orchestrator
        // ALWAYS log when blocking (helps debug early firing issues)
        console.warn(`[createStepLogger] ⚠️ BLOCKING log from previous run: step=${stepName}, capturedRunId=${capturedRunId}, currentRunId=${currentRunId}`);
        return;
      }
    } else if (currentRunId) {
      // Logger has NO run ID but current run DOES have one - logger is stale/from standalone call
      // Block to prevent standalone endpoint logs from leaking into orchestrator
      console.warn(`[createStepLogger] ⚠️ BLOCKING log from standalone call (no run ID): step=${stepName}, currentRunId=${currentRunId}`);
      return;
    }

    // Build message string from args
    const message = args
      .map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg))
      .join(' ')
      .trim();

    if (!message) return;

    try {
      // Send structured event - orchestrator will add [Step] prefix
      // Use captured callback, not dynamic lookup
      capturedCallback({ step: stepName, level, message });
    } catch (e) {
      // Log error to help debug - callback should not fail
      console.error(`[createStepLogger] Callback error for step ${stepName}:`, e);
    }
  };

  return {
    log: (...args) => forward('log', args),
    error: (...args) => forward('error', args),
    warn: (...args) => forward('warn', args),
  };
}

/**
 * Intercept console.log to also send through progress callback
 * 
 * DEPRECATED: For orchestrator endpoints, use createStepLogger instead.
 * This function uses global console monkey-patching which can cause log leakage
 * between concurrent requests. Only kept for backward compatibility.
 * 
 * @deprecated Use createStepLogger for new orchestrator endpoints
 * @param stepName - Name of the step (for server terminal prefix ONLY)
 * @returns Function to restore original console.log/error/warn - CALL THIS WHEN DONE!
 */
export function interceptConsoleLog(stepName?: string) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const prefix = stepName ? `[${stepName}] ` : '';
  
  console.log = (...args: any[]) => {
    // Log to server terminal with step prefix (for server terminal visibility)
    originalLog(prefix, ...args);
    // Send ProgressEvent to callback (orchestrator will add prefix)
    const currentCallback = getProgressCallback();
    if (currentCallback) {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ').trim();
      if (message) {
        try {
          // Send ProgressEvent - orchestrator callback will add step prefix
          currentCallback({ step: stepName, level: 'log', message });
        } catch (e) {
          // Log error to help debug - callback should not fail
          originalError(`[interceptConsoleLog] Callback error: ${e}`);
        }
      }
    } else {
      // Debug: Log when callback is not available
      originalLog(`[interceptConsoleLog] No callback available (stepName: ${stepName})`);
    }
  };
  
  console.error = (...args: any[]) => {
    originalError(prefix, ...args);
    const currentCallback = getProgressCallback();
    if (currentCallback) {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      try {
        // Send ProgressEvent - orchestrator callback will add step prefix
        currentCallback({ step: stepName, level: 'error', message });
      } catch (e) {
        // Silent fail
      }
    }
  };
  
  console.warn = (...args: any[]) => {
    originalWarn(prefix, ...args);
    const currentCallback = getProgressCallback();
    if (currentCallback) {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      try {
        // Send ProgressEvent - orchestrator callback will add step prefix
        currentCallback({ step: stepName, level: 'warn', message });
      } catch (e) {
        // Silent fail
      }
    }
  };
  
  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  };
}

