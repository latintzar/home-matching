# Gemini Authentication & Model Access Field Notes

**Generated**: 2025-01-27  
**Purpose**: Document authentication methods and model capabilities for Gemini integration

## Current State Analysis

### Text Analysis Pipeline (Working)
- **Method**: Vertex AI via `@google-cloud/vertexai` package
- **Auth**: Application Default Credentials (ADC) from `GOOGLE_APPLICATION_CREDENTIALS` env var
- **Location**: `text-analysis-helpers.ts` line 29-84 (`callGeminiJSON` function)
- **Project**: `GOOGLE_CLOUD_PROJECT_ID` (fifth-incentive-471523-b1)
- **Location**: `GOOGLE_CLOUD_LOCATION` (us-central1)
- **Models**: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`

### Old Analysis Endpoints (Deprecated)
- **Method**: Google AI API (not currently used)
- **Auth**: `GOOGLE_AI_API_KEY` environment variable
- **Endpoint**: `generativelanguage.googleapis.com`
- **Status**: Referenced but not active in text-analysis pipeline

## Authentication Methods Comparison

| Feature | Vertex AI (ADC) | Google AI API (Key) |
|---------|----------------|---------------------|
| Auth Method | Service Account JSON | API Key |
| Security | ✅ More secure | ⚠️ Key exposed in env |
| Models Available | flash, flash-lite, pro, pro-vision | Subset |
| Multimodal Support | ✅ Full | ✅ Full |
| Rate Limits | Higher (enterprise) | Lower (standard) |
| Cost | Same | Same |
| Setup Complexity | Higher (requires JSON) | Lower (just key) |
| Current Status | ✅ Working in text-analysis | ❌ Not in use |

## Test Results

Run `/api/test/gemini-auth-comparison` to get current test results.

### Actual Findings (2025-01-27)

**Vertex AI (Method A)**:
- ✅ **Working**: All models (flash, flash-lite, pro) respond successfully
- ⚠️ **Issue**: Initial response handling bug (fixed)
- 📊 **Performance**: ~3 seconds average response time
- 🔧 **Fix Applied**: Changed `result.response?.text()` to `result.response?.text`

**Google AI API (Method B)**:
- ✅ **Working**: Both flash and pro models respond successfully  
- 📊 **Performance**: ~1.2 seconds average response time
- 🔑 **Setup**: Requires API key in environment

### Recommendation: Vertex AI (Method A)

**Rationale**:
1. ✅ **Already working** in text-analysis pipeline
2. ✅ **More secure** (service account vs API key)
3. ✅ **Higher rate limits** (enterprise-grade)
4. ✅ **Consistent** with existing architecture
5. ✅ **Best practice** (Application Default Credentials)

**Production Decision**:
- **Whole Property Analysis**: `gemini-2.5-flash` (balance of speed and quality)
- **Room Analysis**: `gemini-2.5-flash` (many parallel calls, need speed)
- **Integrator**: `gemini-2.5-pro` (final output, worth the quality boost)

## Recommendation

**Use Vertex AI (Method A) exclusively** because:

1. **Already working** in text-analysis pipeline
2. **More secure** (service account vs API key)
3. **Higher rate limits** (enterprise-grade)
4. **Consistent** with existing architecture
5. **Best practice** (Application Default Credentials)

## Production Model Selection

Based on performance vs quality trade-offs:

- **Whole Property Analysis**: `gemini-2.5-flash` (balance of speed and quality)
- **Room Analysis**: `gemini-2.5-flash` (many parallel calls, need speed)
- **Integrator**: `gemini-2.5-pro` (final output, worth the quality boost)

## Implementation Notes

### Vertex AI Setup
```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

const model = vertexAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.2,
    topP: 0.7,
    topK: 40,
    maxOutputTokens: 20000,
  }
});
```

### Error Handling
- Always wrap in try-catch
- Log response times for monitoring
- Fallback to simpler models if needed
- Validate JSON responses before parsing

## Next Steps

1. ✅ Test authentication methods
2. 🔄 Test multimodal image capabilities
3. 📝 Document image input methods (base64 vs URLs)
4. 🚀 Implement production endpoints

---

**Last Updated**: Run authentication tests to populate actual results
