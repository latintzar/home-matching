# Cleanup: Confusing & Duplicated Items

**Date**: 2025-01-27  
**Status**: ✅ **COMPLETED**

---

## ✅ Issues Fixed

### 1. Duplicate GET Endpoints ✅
**Problem**: Both `/clusters/route.ts` and `/clusters/save/route.ts` had GET handlers doing the same thing.

**Fix**: Updated `/clusters/save/route.ts` GET to redirect (301) to main `/clusters` endpoint.

---

### 2. Duplicate Stage Directory ✅
**Problem**: Both `stage-1-5/` (used) and `stage-1.5/` (unused) directories existed.

**Fix**: Deleted unused `stage-1.5/` directory. Code uses `stage-1-5` (with hyphen).

---

### 3. Confusing Comments ✅
**Problem**: Code comments said "manual clusters" when referring to `clusters` table.

**Fixed Files**:
- `src/lib/photo-storage.ts` - Updated all "manual clusters" → "clusters"
- `src/app/api/listings/[id]/clusters/promote-auto-to-manual/route.ts` - Updated header comment

---

### 4. Empty Directory ✅
**Problem**: `clusters/visibility/` directory was empty (old endpoint removed).

**Fix**: Removed empty directory.

---

### 5. Endpoint Name Clarification ✅
**Problem**: `promote-auto-to-manual` endpoint name is confusing (promotes to `clusters`, not "manual").

**Fix**: Added clarifying comment explaining endpoint name is kept for backward compatibility but actually promotes to `clusters` table.

---

## 📝 Remaining (Non-Critical)

### Endpoint Name
- `promote-auto-to-manual` - Name kept for backward compatibility
- Could be renamed to `promote-to-clusters` in future, but would require updating all callers

---

## ✅ Summary

All confusing and duplicated items have been cleaned up:
- ✅ No duplicate endpoints
- ✅ No duplicate directories  
- ✅ Comments updated to reflect actual behavior
- ✅ Empty directories removed
- ✅ Endpoint names clarified with comments

**Status**: ✅ **CLEAN** - Codebase is now clearer and less confusing.

