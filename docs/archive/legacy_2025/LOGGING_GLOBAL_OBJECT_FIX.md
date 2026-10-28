# Why Global Object Fix Works: Module Isolation in Next.js

## The Problem

On fresh server starts, logs from orchestrated endpoints (like G) weren't appearing in the SSE stream, even though:
- The orchestrator set the callback correctly
- The endpoints were being called
- The endpoints were logging to the server terminal

## Root Cause: Next.js Module Isolation

### Module-Level Variables (The Old Way)

```typescript
// ❌ OLD APPROACH - Module-level variable
let moduleProgressCallback: ProgressCallback | null = null;

export function setProgressCallback(callback: ProgressCallback | null) {
  moduleProgressCallback = callback; // Stored in module scope
}

export function getProgressCallback(): ProgressCallback | null {
  return moduleProgressCallback; // Retrieved from module scope
}
```

**Why this failed:**

1. **Separate HTTP Request Contexts**: 
   - Orchestrator endpoint runs in Request A
   - Sets `moduleProgressCallback` in its module instance
   - Calls G endpoint via `fetch()` → creates Request B
   - G endpoint runs in Request B, imports the module
   - **Problem**: Next.js might create a separate module instance or the module state isn't immediately accessible

2. **Module Lazy Loading**:
   - Next.js lazy-loads modules on first import
   - On fresh server starts, there's a timing window where:
     - Orchestrator sets callback in Module Instance A
     - G endpoint imports module → might get Module Instance B (or A not fully initialized)
     - Module Instance B doesn't have the callback yet

3. **Module Caching Edge Cases**:
   - Next.js caches modules, but on fresh starts:
     - First request (orchestrator) initializes module
     - Second request (G endpoint) might hit before module is fully cached/shared
     - Race condition between module initialization and callback access

### Global Object (The Fix)

```typescript
// ✅ NEW APPROACH - Global object
const GLOBAL_KEY = '__orchestratorProgressCallback';

function getGlobal(): any {
  if (typeof global !== 'undefined') return global; // Node.js global
  if (typeof window !== 'undefined') return window; // Browser fallback
  return {};
}

export function setProgressCallback(callback: ProgressCallback | null) {
  const globalObj = getGlobal();
  globalObj[GLOBAL_KEY] = callback; // Stored in PROCESS-LEVEL scope
  moduleProgressCallback = callback; // Also store in module for fallback
}

export function getProgressCallback(): ProgressCallback | null {
  const globalObj = getGlobal();
  if (globalObj[GLOBAL_KEY]) {
    return globalObj[GLOBAL_KEY]; // Retrieved from PROCESS-LEVEL scope
  }
  return moduleProgressCallback; // Fallback to module variable
}
```

**Why this works:**

1. **Process-Level Scope**:
   - Node's `global` object is shared across **ALL** requests in the same Node.js process
   - Not affected by module boundaries or lazy loading
   - Immediately accessible from any module, any request, any time

2. **No Timing Issues**:
   - Orchestrator sets callback → stored in `global.__orchestratorProgressCallback`
   - G endpoint runs → reads from `global.__orchestratorProgressCallback`
   - **No race condition**: Global object is always accessible, even on fresh server starts

3. **Cross-Request Communication**:
   - Request A (orchestrator) writes to `global`
   - Request B (G endpoint) reads from `global`
   - Both access the **same** process-level object
   - Works regardless of Next.js module caching or isolation

## Technical Details

### Node.js Global Object

- `global` is Node.js's process-level namespace
- Shared across all modules in the same process
- Persists for the lifetime of the Node.js process
- Not affected by:
  - Module boundaries
  - Request isolation
  - Lazy loading
  - Hot module reloading (in dev mode)

### Next.js Request Isolation

- Next.js API routes run in separate request contexts
- Each request can have its own module instance (in edge cases)
- Module-level state might not be immediately shared
- **But**: `global` object is always shared across all requests

### Why We Still Keep Module Variables

```typescript
// Store in both places for maximum compatibility
globalObj[GLOBAL_KEY] = callback; // Process-level (primary)
moduleProgressCallback = callback; // Module-level (fallback)
```

- **Primary**: Global object for cross-request access
- **Fallback**: Module variable for same-request access (if global somehow fails)
- **Defense in depth**: Two layers of storage ensure reliability

## Verification

The fix was verified by:
1. Killing all processes
2. Starting fresh Next.js dev server
3. Running orchestrator from G endpoint
4. **Result**: Logs appeared immediately ✅

## Key Takeaway

**For cross-request state in Next.js, use Node's `global` object, not module-level variables.**

Module-level variables work fine for same-request state, but when you need to share state across separate HTTP requests (like orchestrator → endpoint), you need process-level storage.

