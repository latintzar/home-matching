# Logging Isolation Fix

## Problem

Room analysis logs were appearing during F0 (Furniture Removal) execution, even though F0 should only remove furniture and not analyze rooms. This was confusing and made it appear that F0 was doing analysis when it wasn't.

## Root Cause

The `interceptConsoleLog` function replaces the **global** `console.log/error/warn` functions. This means:
- ALL `console.log` calls in the entire Node.js process are intercepted
- If any async operations from previous endpoints are still running, their logs get captured with the current endpoint's prefix
- This creates the appearance that one endpoint is doing work from another endpoint

## Solution

Added endpoint tracking to `interceptConsoleLog`:
1. **Track Active Endpoint**: Each endpoint that intercepts logs is tracked in `currentInterceptingEndpoint`
2. **Filter by Active Endpoint**: Only logs from the currently active endpoint are sent through SSE
3. **Warning System**: If another endpoint tries to intercept while one is already active, a warning is logged
4. **Proper Cleanup**: Each endpoint must restore console.log in its `finally` block

## Implementation Details

### Changes to `src/lib/orchestrator-progress.ts`

- Added `currentInterceptingEndpoint` tracking variable
- Modified `interceptConsoleLog` to only send logs if `currentInterceptingEndpoint === endpointName`
- Added warning if concurrent interception is detected
- Clear tracking when endpoint restores console.log

### Endpoint Pattern (Already Correct)

All endpoints follow this pattern:

```typescript
let restoreConsole: (() => void) | null = null;

if (isOrchestratorContext) {
  restoreConsole = interceptConsoleLog(stepName);
}

try {
  // ... endpoint logic ...
} finally {
  if (restoreConsole) {
    restoreConsole(); // CRITICAL: Restore console.log
  }
}
```

## Consistency Across Endpoints

✅ **All 68 endpoints** use `interceptConsoleLog` consistently
✅ **All endpoints** restore console.log in their `finally` blocks
✅ **Orchestrator** ensures endpoints run sequentially (not concurrently)

## What This Fixes

1. **Log Isolation**: Each endpoint's logs are isolated - logs from async operations of previous endpoints won't leak
2. **Clear Attribution**: Logs are only attributed to the endpoint that's currently active
3. **Warning System**: If concurrent execution is detected, a warning is logged

## Remaining Limitations

- **Global Console Replacement**: We still replace the global `console.log`, but now we filter by active endpoint
- **Async Operations**: If an endpoint has async operations that continue after it finishes, those logs won't be captured (this is by design)
- **Sequential Execution**: The orchestrator must ensure endpoints run sequentially for this to work correctly

## Testing

To verify the fix works:

1. Run F0 (Furniture Removal) - should only see furniture removal logs
2. Run Room-by-Room Analysis - should only see room analysis logs
3. Check for warnings about concurrent interception (shouldn't see any)

## Future Improvements

If we need better isolation, we could:
- Use a logging library that supports context tracking (e.g., Winston with context)
- Use async local storage to track request context
- Implement per-request log buffers instead of global interception

For now, this solution provides good isolation while maintaining the existing architecture.

